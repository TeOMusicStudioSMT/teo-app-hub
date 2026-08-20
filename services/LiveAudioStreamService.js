/**
 * 🔴 LiveAudioStreamService — dwustronna rozmowa AI ↔ człowiek (Etap 3).
 *
 * Kanał WebSocket `/api/voice/stream` mówi protokołem Twilio Media Streams:
 * ramki `audio/x-mulaw` 8000 Hz, po 160 bajtów (20 ms), w obie strony.
 * Pętla rozmowy: SŁUCHAMY → (cisza) → STT → LLM → TTS → MÓWIMY → SŁUCHAMY.
 *
 * ⚠️ SZEŚĆ RZECZY, KTÓRE ODRÓŻNIAJĄ DZIAŁAJĄCĄ ROZMOWĘ OD DEMA:
 *
 *  1. VAD, NIE STOPER. Tura kończy się CISZĄ rozmówcy, nie stałym oknem czasu.
 *     Stałe okno tnie ludzi w pół zdania — a przez telefon to brzmi jak awaria.
 *  2. BARGE-IN. Gdy człowiek zaczyna mówić w trakcie kwestii AI, natychmiast
 *     idzie `clear` (Twilio kasuje SWÓJ bufor) i przestajemy nadawać. Bez tego
 *     bot gada po ludziach — najczęstszy powód, dla którego się rozłączają.
 *  3. RYTM 20 ms. Ramek nie wolno wysypać hurtem: Twilio je zbuforuje, a wtedy
 *     `clear` przy barge-inie kasuje sekundy mowy, których rozmówca już
 *     wysłuchał. Nadajemy w tempie rzeczywistym.
 *  4. LIMIT ROZMÓW. Każda rozmowa to Whisper + LLM + TTS na tej samej maszynie.
 *     Trzecia równoległa rozmowa nie „spowalnia" — ona zabija wszystkie trzy.
 *  5. BILET PRZY WEJŚCIU. Publiczny WSS bez biletu to otwarty mikrofon dla
 *     każdego, kto zgadnie ścieżkę. Bilet sprawdzamy w ramce `start`.
 *  6. AWARIA MÓWI PO LUDZKU. Gdy padnie STT albo LLM, rozmówca słyszy zdanie
 *     o kłopocie, a nie ciszę. Cisza w słuchawce jest nie do odróżnienia od
 *     zerwanego połączenia.
 *
 * ⚠️ ŻADNEGO STT/LLM/TTS NIE MA W TYM PLIKU. Wszystkie trzy wchodzą przez
 * `deps` — dzięki temu most wpina prawdziwe (Whisper, Ollama, PrzewodyGlosu),
 * a test wpina atrapy i sprawdza SAMĄ PĘTLĘ: protokół, VAD, barge-in i rytm.
 * Gdyby siedziały tu na sztywno, jedyną drogą testu byłby prawdziwy telefon.
 *
 * Standard ESM.
 */

import { WebSocketServer } from 'ws';

// ── Parametry toru (Twilio Media Streams) ─────────────────────────────────────
const RAMKA_B = 160;          // 160 bajtów μ-law = 20 ms przy 8000 Hz
const RAMKA_MS = 20;
const BAJTY_NA_MS = 8;        // 8000 B/s

// ── Parametry rozmowy ─────────────────────────────────────────────────────────
export const USTAWIENIA = {
    /** Próg energii (RMS na skali 16-bit), powyżej którego uznajemy mowę. */
    progMowy: 700,
    /** Ile ciszy kończy turę rozmówcy. */
    ciszaKonczacaMs: 900,
    /** Krótszy dźwięk to kaszlnięcie, nie wypowiedź — nie budzimy dla niego STT. */
    minMowyMs: 300,
    /** Bezpiecznik: po tylu ms mówienia bez przerwy i tak zamykamy turę. */
    maxTuraMs: 20_000,
    /** Ile ciągłej mowy w trakcie kwestii AI uznajemy za wejście w słowo. */
    bargeInMs: 240,
    /** Ile rozmów naraz uciągnie ta maszyna. */
    maxRozmow: 2,
    /** Co ile naliczamy minutę Służby. */
    minutaMs: 60_000,
};

// ── μ-law (G.711) → PCM16. Potrzebne do liczenia energii, czyli do VAD ────────
// Klasyczna implementacja Suna. Tablicujemy wszystkie 256 wartości raz.
const BIAS = 0x84;
const ULAW_NA_PCM = new Int16Array(256);
for (let i = 0; i < 256; i++) {
    const u = ~i & 0xFF;
    let t = (((u & 0x0F) << 3) + BIAS) << ((u & 0x70) >> 4);
    t -= BIAS;
    ULAW_NA_PCM[i] = (u & 0x80) ? -t : t;
}

/** Energia ramki (RMS) w skali 16-bit. Tanio i wystarczająco dobrze dla VAD. */
export function energiaRamki(buf) {
    if (!buf?.length) return 0;
    let suma = 0;
    for (let i = 0; i < buf.length; i++) {
        const s = ULAW_NA_PCM[buf[i]];
        suma += s * s;
    }
    return Math.sqrt(suma / buf.length);
}

export function ulawNaPcm16(buf) {
    const out = Buffer.allocUnsafe(buf.length * 2);
    for (let i = 0; i < buf.length; i++) out.writeInt16LE(ULAW_NA_PCM[buf[i]], i * 2);
    return out;
}

// ── Rejestr żywych rozmów ─────────────────────────────────────────────────────
const rozmowy = new Map();

export function zyweRozmowy() {
    return [...rozmowy.values()].map(r => r.stan());
}

export function rozmowa(callSid) {
    return rozmowy.get(callSid) ?? null;
}

/**
 * Jedna rozmowa = jedno gniazdo WebSocket od Twilio.
 *
 * Cały stan (bufory, tryb, historia) żyje w instancji, nie w module — dwie
 * rozmowy naraz nie mają prawa mieszać sobie audio.
 */
class Rozmowa {
    constructor(ws, deps, ustawienia) {
        this.ws = ws;
        this.deps = deps;
        this.u = { ...USTAWIENIA, ...(ustawienia ?? {}) };

        this.streamSid = null;
        this.callSid = null;
        this.biznesId = null;
        this.biznes = null;
        this.kierunek = 'wychodzace';

        /** `sluchamy` | `myslimy` | `mowimy` | `suweren` */
        this.tryb = 'sluchamy';
        this.zywa = false;
        this.start = Date.now();

        // Bufor tury rozmówcy
        this.bufor = [];
        this.mowyMs = 0;
        this.ciszaMs = 0;
        this.zaczetoMowic = false;

        // Nadawanie
        this.kolejka = null;      // Buffer z μ-law do wysłania
        this.pozycja = 0;
        this.timerNadawania = null;
        this.bargeMs = 0;

        this.historia = [];
        this.minut = 0;
        this.timerMinut = null;
        this.latencje = { stt: null, llm: null, tts: null, tura: null };
        this.tur = 0;
    }

    stan() {
        return {
            callSid: this.callSid,
            streamSid: this.streamSid,
            biznesId: this.biznesId,
            kierunek: this.kierunek,
            tryb: this.tryb,
            zywa: this.zywa,
            odMs: Date.now() - this.start,
            minut: this.minut,
            tur: this.tur,
            latencje: this.latencje,
            historia: this.historia.slice(-12),
        };
    }

    zdarzenie(typ, dane = {}) {
        try { this.deps.naZdarzenie?.({ typ, callSid: this.callSid, kiedy: Date.now(), ...dane }); }
        catch { /* telemetria nie ma prawa wywrócić rozmowy */ }
    }

    wyslij(obj) {
        if (this.ws.readyState === 1) {
            try { this.ws.send(JSON.stringify(obj)); } catch { /* gniazdo padło */ }
        }
    }

    // ── Protokół Twilio ───────────────────────────────────────────────────────

    async wiadomosc(surowa) {
        let m;
        try { m = JSON.parse(surowa); } catch { return; }

        switch (m.event) {
            case 'connected': return;
            case 'start': return this.naStart(m);
            case 'media': return this.naMedia(m);
            case 'mark': return this.naMark(m);
            case 'dtmf': return this.zdarzenie('dtmf', { cyfra: m.dtmf?.digit ?? null });
            case 'stop': return this.naStop();
            default: return;
        }
    }

    async naStart(m) {
        const s = m.start ?? {};
        this.streamSid = m.streamSid ?? s.streamSid ?? null;
        this.callSid = s.callSid ?? `bez-sid-${Date.now().toString(36)}`;
        const parametry = s.customParameters ?? {};

        // ⚠️ Bilet sprawdzamy TU, a nie przy uścisku dłoni — parametry
        // przychodzą dopiero w tej ramce. Do tego momentu gniazdo jest otwarte,
        // ale nie zrobiło jeszcze absolutnie nic.
        const bilet = parametry.bilet ?? this.biletZUrl ?? null;
        const wpuszczony = this.deps.sprawdzBilet ? this.deps.sprawdzBilet(bilet) : { ok: true };
        if (!wpuszczony?.ok) {
            console.warn(`[Live] ⛔ Rozmowa ${this.callSid} bez ważnego biletu — zamykam gniazdo.`);
            this.zdarzenie('odmowa', { powod: wpuszczony?.powod ?? 'Brak ważnego biletu.' });
            try { this.ws.close(1008, 'bilet'); } catch { /* noop */ }
            return;
        }

        this.biznesId = parametry.biznesId ?? wpuszczony.biznesId ?? null;
        this.kierunek = parametry.kierunek ?? wpuszczony.kierunek ?? 'wychodzace';
        this.biznes = this.biznesId ? await this.deps.znajdzBiznes?.(this.biznesId) ?? null : null;

        if (rozmowy.size >= this.u.maxRozmow) {
            console.warn(`[Live] 🚧 Limit ${this.u.maxRozmow} równoległych rozmów — odmawiam ${this.callSid}.`);
            this.zdarzenie('odmowa', { powod: `Limit ${this.u.maxRozmow} równoległych rozmów na tej maszynie.` });
            try { this.ws.close(1013, 'limit'); } catch { /* noop */ }
            return;
        }

        this.zywa = true;
        rozmowy.set(this.callSid, this);
        this.timerMinut = setInterval(() => this.naMinute(), this.u.minutaMs);

        console.log(`[Live] 🔴 Rozmowa ${this.callSid} (${this.kierunek}) — ${this.biznes?.nazwa ?? 'bez działalności'}.`);
        this.zdarzenie('start', {
            biznesId: this.biznesId,
            biznes: this.biznes?.nazwa ?? null,
            kierunek: this.kierunek,
            streamSid: this.streamSid,
        });
    }

    naMedia(m) {
        if (!this.zywa) return;
        // Tylko ścieżka rozmówcy. `outbound` to echo naszej własnej kwestii —
        // wpuszczone do VAD kazałoby AI przerywać samo sobie.
        if (m.media?.track && m.media.track !== 'inbound') return;

        const ramka = Buffer.from(m.media?.payload ?? '', 'base64');
        if (!ramka.length) return;

        const ms = ramka.length / BAJTY_NA_MS;
        const energia = energiaRamki(ramka);
        const mowa = energia >= this.u.progMowy;

        if (this.tryb === 'mowimy') {
            // Barge-in: człowiek wchodzi w słowo.
            this.bargeMs = mowa ? this.bargeMs + ms : 0;
            if (this.bargeMs >= this.u.bargeInMs) {
                this.przerwijMowe('rozmówca wszedł w słowo');
                this.bufor.push(ramka);
                this.zaczetoMowic = true;
                this.mowyMs = this.bargeMs;
                this.ciszaMs = 0;
            }
            return;
        }
        if (this.tryb !== 'sluchamy') return;   // myslimy / suweren — nie zbieramy tury

        this.bufor.push(ramka);
        if (mowa) {
            this.zaczetoMowic = true;
            this.mowyMs += ms;
            this.ciszaMs = 0;
        } else if (this.zaczetoMowic) {
            this.ciszaMs += ms;
        } else if (this.bufor.length > 200) {
            // Cisza przed pierwszym słowem — nie trzymamy jej w nieskończoność.
            this.bufor.shift();
        }

        const koniecTury = this.zaczetoMowic &&
            (this.ciszaMs >= this.u.ciszaKonczacaMs || this.mowyMs >= this.u.maxTuraMs);

        if (koniecTury) {
            const audio = Buffer.concat(this.bufor);
            const dosc = this.mowyMs >= this.u.minMowyMs;
            this.bufor = []; this.mowyMs = 0; this.ciszaMs = 0; this.zaczetoMowic = false;
            if (dosc) void this.tura(audio);
        }
    }

    naMark(m) {
        // Twilio potwierdza, że nasza kwestia DOSZŁA DO KOŃCA u rozmówcy.
        // Dopiero teraz wracamy do słuchania — wcześniej ucinalibyśmy sobie ogon.
        if (m.mark?.name === 'koniec-kwestii' && this.tryb === 'mowimy') {
            this.tryb = 'sluchamy';
            this.zdarzenie('sluchamy');
        }
    }

    naStop() {
        if (!this.zywa) return;
        this.zywa = false;
        this.stopNadawania();
        if (this.timerMinut) clearInterval(this.timerMinut);
        rozmowy.delete(this.callSid);

        const sekundy = Math.round((Date.now() - this.start) / 1000);
        console.log(`[Live] ⏹️ Koniec rozmowy ${this.callSid} — ${sekundy}s, ${this.tur} tur, ${this.minut} min naliczonych.`);
        this.zdarzenie('stop', { sekundy, tur: this.tur, minut: this.minut, historia: this.historia });
        try { this.deps.naKoniec?.({ callSid: this.callSid, biznesId: this.biznesId, sekundy, tur: this.tur, historia: this.historia }); }
        catch { /* noop */ }
    }

    naMinute() {
        if (!this.zywa) return;
        this.minut += 1;
        this.zdarzenie('minuta', { minut: this.minut });
        // GRV nalicza MOST (Ekonomia Oddechu) — ten serwis tylko melduje fakt.
        try { this.deps.naMinute?.({ callSid: this.callSid, biznesId: this.biznesId, minuta: this.minut }); }
        catch { /* noop */ }
    }

    // ── Tura rozmowy ──────────────────────────────────────────────────────────

    async tura(audioUlaw) {
        if (!this.zywa || this.tryb === 'suweren') return;
        this.tryb = 'myslimy';
        this.tur += 1;
        const t0 = Date.now();
        this.zdarzenie('myslimy', { bajtow: audioUlaw.length, sekund: +(audioUlaw.length / 8000).toFixed(1) });

        try {
            const tStt = Date.now();
            const tekst = String(await this.deps.transkrybuj(audioUlaw) ?? '').trim();
            this.latencje.stt = Date.now() - tStt;

            if (!tekst) {
                // Whisper nie usłyszał słów — nie zmyślamy odpowiedzi na nic.
                this.zdarzenie('cisza', { latencje: { ...this.latencje } });
                this.tryb = 'sluchamy';
                return;
            }

            this.historia.push({ rola: 'klient', tekst, kiedy: Date.now() });
            this.zdarzenie('transkrypt', { rola: 'klient', tekst, ms: this.latencje.stt });

            const tLlm = Date.now();
            const odpowiedz = String(await this.deps.odpowiedz({
                tekst, historia: this.historia, biznes: this.biznes,
            }) ?? '').trim();
            this.latencje.llm = Date.now() - tLlm;

            if (!odpowiedz) throw new Error('Model nie zwrócił odpowiedzi.');

            this.historia.push({ rola: 'ai', tekst: odpowiedz, kiedy: Date.now() });
            this.zdarzenie('transkrypt', { rola: 'ai', tekst: odpowiedz, ms: this.latencje.llm });

            await this.powiedz(odpowiedz);
            this.latencje.tura = Date.now() - t0;
            this.zdarzenie('latencja', { latencje: { ...this.latencje } });
        } catch (e) {
            console.warn(`[Live] ⚠️ Tura ${this.callSid} padła: ${e.message}`);
            this.zdarzenie('blad', { message: e.message, latencje: { ...this.latencje } });
            // Rozmówca MUSI usłyszeć, że coś nie gra. Cisza w słuchawce jest
            // nie do odróżnienia od zerwanego połączenia.
            await this.powiedz('Przepraszam, mam chwilowy kłopot techniczny. Proszę powtórzyć.')
                .catch(() => { this.tryb = 'sluchamy'; });
        }
    }

    /** Zamienia tekst na mowę i nadaje ją w rytmie 20 ms. */
    async powiedz(tekst) {
        if (!this.zywa) return;
        const tTts = Date.now();
        const ulaw = await this.deps.mowa({ tekst, biznes: this.biznes });
        this.latencje.tts = Date.now() - tTts;

        if (!ulaw?.length) throw new Error('Synteza zwróciła pustą ścieżkę.');
        if (!this.zywa) return;

        this.tryb = 'mowimy';
        this.bargeMs = 0;
        this.zdarzenie('mowimy', { tekst, sekund: +(ulaw.length / 8000).toFixed(1), ms: this.latencje.tts });
        this.nadawaj(ulaw);
    }

    nadawaj(ulaw) {
        this.stopNadawania();
        this.kolejka = ulaw;
        this.pozycja = 0;

        this.timerNadawania = setInterval(() => {
            if (!this.zywa || !this.kolejka) return this.stopNadawania();

            const koniec = Math.min(this.pozycja + RAMKA_B, this.kolejka.length);
            const kawalek = this.kolejka.subarray(this.pozycja, koniec);
            this.pozycja = koniec;

            this.wyslij({
                event: 'media',
                streamSid: this.streamSid,
                media: { payload: Buffer.from(kawalek).toString('base64') },
            });

            if (this.pozycja >= this.kolejka.length) {
                this.stopNadawania();
                // Znacznik wraca do nas, gdy rozmówca DOSŁUCHA kwestii do końca.
                this.wyslij({ event: 'mark', streamSid: this.streamSid, mark: { name: 'koniec-kwestii' } });
            }
        }, RAMKA_MS);
    }

    stopNadawania() {
        if (this.timerNadawania) { clearInterval(this.timerNadawania); this.timerNadawania = null; }
        this.kolejka = null;
        this.pozycja = 0;
    }

    /** Barge-in albo przejęcie: kasujemy TAKŻE bufor po stronie Twilio. */
    przerwijMowe(powod) {
        this.stopNadawania();
        this.wyslij({ event: 'clear', streamSid: this.streamSid });
        this.tryb = 'sluchamy';
        this.bargeMs = 0;
        this.zdarzenie('przerwane', { powod });
    }

    /**
     * Ręczne przejęcie rozmowy przez Suwerena.
     *
     * Po przejęciu AI MILCZY, dopóki Suweren nie odda mikrofonu (`oddaj`).
     * Automatyczny powrót do trybu AI byłby najgorszym możliwym zachowaniem:
     * bot wtrącałby się w rozmowę, którą człowiek świadomie przejął.
     */
    async przejmij({ tekst = null } = {}) {
        if (!this.zywa) throw new Error('Ta rozmowa już nie żyje.');
        this.przerwijMowe('przejęcie przez Suwerena');
        this.tryb = 'suweren';
        this.zdarzenie('przejecie', { tekst });

        if (tekst) {
            const ulaw = await this.deps.mowa({ tekst, biznes: this.biznes });
            if (ulaw?.length) {
                this.historia.push({ rola: 'suweren', tekst, kiedy: Date.now() });
                this.nadawaj(ulaw);
            }
        }
        return this.stan();
    }

    oddaj() {
        if (!this.zywa) throw new Error('Ta rozmowa już nie żyje.');
        this.tryb = 'sluchamy';
        this.zdarzenie('oddanie');
        return this.stan();
    }

    rozlacz(powod = 'decyzja Suwerena') {
        this.zdarzenie('rozlaczenie', { powod });
        try { this.ws.close(1000, 'koniec'); } catch { /* noop */ }
        this.naStop();
        return { rozlaczone: true, powod };
    }
}

/**
 * Wpina kanał `/api/voice/stream` w istniejący serwer HTTP mostu.
 *
 * @param {import('http').Server} server
 * @param {object} deps
 * @param {(ulaw: Buffer) => Promise<string>} deps.transkrybuj
 * @param {(x: {tekst: string, historia: any[], biznes: any}) => Promise<string>} deps.odpowiedz
 * @param {(x: {tekst: string, biznes: any}) => Promise<Buffer>} deps.mowa  — zwraca μ-law 8 kHz
 * @param {(bilet: string) => {ok: boolean, powod?: string, biznesId?: string, kierunek?: string}} [deps.sprawdzBilet]
 * @param {(id: string) => Promise<any>} [deps.znajdzBiznes]
 * @param {(ev: object) => void} [deps.naZdarzenie]
 * @param {(x: object) => void} [deps.naMinute]
 * @param {(x: object) => void} [deps.naKoniec]
 */
export function attachLiveAudio(server, deps = {}, ustawienia = {}) {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, req) => {
        const r = new Rozmowa(ws, deps, ustawienia);
        // Bilet z URL-a to droga zapasowa (i testowa) — normalnie przychodzi
        // jako <Parameter> w ramce `start`.
        try { r.biletZUrl = new URL(req.url, 'http://127.0.0.1').searchParams.get('bilet'); }
        catch { r.biletZUrl = null; }

        ws.on('message', (dane) => { void r.wiadomosc(dane.toString()); });
        ws.on('close', () => r.naStop());
        ws.on('error', (e) => {
            console.warn(`[Live] ⚠️ Gniazdo ${r.callSid ?? '—'}: ${e.message}`);
            r.naStop();
        });
    });

    server.on('upgrade', (req, socket, head) => {
        let pathname;
        try { pathname = new URL(req.url, 'http://127.0.0.1').pathname; }
        catch { return socket.destroy(); }

        if (pathname === '/api/voice/stream') {
            req.__wsObsluzone = true;
            wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
        }
        // Żadnego `else socket.destroy()` — inne serwisy mają własne nasłuchy,
        // a gniazda niczyje sprząta wspólny strażnik wpięty jako ostatni.
    });

    console.log('[Live] 🔴 Kanał rozmów dwustronnych: /api/voice/stream (Twilio Media Streams, μ-law 8 kHz)');
    return { zyweRozmowy, rozmowa };
}

export default { attachLiveAudio, zyweRozmowy, rozmowa, energiaRamki, ulawNaPcm16, USTAWIENIA };
