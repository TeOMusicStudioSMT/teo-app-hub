/**
 * 🌿🌌 Żywa Księga Wielowymiarowa (Suweren 2026-11-14) — trzy mechaniki nad Wypożyczalnią teostory.studio:
 *
 * 1. ŻYWE WPISY — księga żyje w czasie. Główna Katedra dopisuje do wystawionej księgi / Opodysku kolejne wpisy
 *    (tytuł, tekst, opcjonalnie ilustracja Palety albo własny obraz, opcjonalnie nagranie mp3). Portal pokazuje oś
 *    wpisów i licznik; TREŚĆ wpisu dostaje ten, kto ma dostęp do księgi (demo — każdy), reszta widzi daty i tytuły.
 *
 * 2. TRZY WYPOŻYCZENIA = NA STAŁE. Portal nie ma kont — czytelnika rozpoznają opłacone sesje Stripe, które pamięta jego
 *    przeglądarka. Trzy RÓŻNE opłacone sesje tej samej księgi (sprawdzane u Stripe, nie na słowo) dają dostęp bez
 *    terminu i prawo do własnej gałęzi. Sprawdzone sesje pamiętamy, żeby nie pytać Stripe przy każdym otwarciu.
 *
 * 3. GAŁĘZIE Z INNYCH KATEDR. Czytelnik z księgą na stałe (albo księgi darmowej) drukuje CIĄG DALSZY we WŁASNEJ
 *    Katedrze — jej Kronikarz pisze rozdział z dotychczasowej treści — i wysyła go podpisanego kluczem wizytówki.
 *    Główna Katedra sprawdza: nick i klucz Z REJESTRU otakos.wtf, podpis, świeżość, prawo do gałęzi → `do_zgody` →
 *    ✓/✕ Suwerena (Izba zgód) → dopiero wtedy gałąź widać w portalu pod „Wersje z Innych Katedr”.
 *    UCZCIWIE: gałąź niesie sam tekst (bez obrazu); tożsamość Katedry ręczy rejestr, treść zatwierdza człowiek.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { sprawdzPodpis } from './RozliczeniaKatedr.js';

const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;
export const WYPOZYCZEN_NA_STALE = 3;
export const SWIEZOSC_MS = 60 * 60_000;
export const MAX_WPISOW = 2000, MAX_GALEZI_CZEKAJACYCH = 3;
export const STYL_WPISU = 'painterly storybook illustration, rich gouache textures, cinematic soft light, warm deep colours, no text, no letters, no logos';

const tn = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const tresc = (s, n) => String(s ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const sha = (t) => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');
const blad = (m, kod = 400) => Object.assign(new Error(m), { kod });

/** Tekst, który podpisuje Katedra wysyłająca gałąź (klucz wizytówki, ed25519). */
export const trescGalezi = (z) => ['otakos-galaz', z.nick, z.ksiega, z.tytul, sha(z.tekst), z.czas].join('\n');
/** Lista sesji z adresu / ciała: różne, niepuste, najwyżej 8. */
export const listaSesji = (x) => [...new Set((Array.isArray(x) ? x : String(x ?? '').split(',')).map((s) => String(s).trim()).filter((s) => /^[A-Za-z0-9_-]{8,120}$/.test(s)))].slice(0, 8);

export const SYSTEM_GALEZI = 'Jesteś Kronikarzem Katedry OtakOS. Piszesz CIĄG DALSZY cudzej Żywej Księgi jako własną gałąź opowieści: nowy rozdział, '
    + 'który wyrasta z dotychczasowej treści (te same postacie, świat i ton), ale idzie w kierunku, którego główna oś jeszcze nie pokazała. '
    + 'Piszesz w języku księgi. Nie streszczasz tego, co było. Bez wstępów i komentarzy. Odpowiadasz WYŁĄCZNIE jednym obiektem JSON: '
    + '{"tytul": "<tytuł rozdziału, 2–8 słów>", "tekst": "<rozdział: 150–350 słów prozy albo wersów>"}';

/** Odpowiedź modelu → { tytul, tekst } albo błąd z powodem. */
export function odczytajGalaz(odp) {
    let j = null;
    const s = String(odp ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) { try { j = JSON.parse(s.slice(a, b + 1)); } catch { j = null; } }
    const tytul = tn(j?.tytul, 120), tekst = tresc(j?.tekst, 6000);
    if (!tytul) throw new Error('rozdział bez tytułu');
    if (tekst.length < 300) throw new Error(`rozdział za krótki (${tekst.length} znaków, potrzeba co najmniej 300)`);
    return { tytul, tekst };
}

/**
 * @param {{ katalog: string, wypozyczalnia: { katalogPelny: Function, czytaj: Function }, stripe?: { sprawdzSesje: Function } | null,
 *   pisz?: (system: string, prompt: string) => Promise<string>, rysuj?: (o: { prompt: string, szer: number, wys: number }) => Promise<string>,
 *   nick?: () => Promise<string|null>, podpisz?: (t: string) => Promise<string>, katedra?: (nick: string) => Promise<{ klucz: string }>,
 *   fetch?: typeof fetch, teraz?: () => number, wiesc?: (t: string) => any }} cfg
 */
export function utworzKsiegeWielowymiarowa({ katalog, wypozyczalnia: W, stripe = null, pisz = null, rysuj = null, nick = async () => null, podpisz = null, katedra = null,
    fetch: f = globalThis.fetch, teraz = () => Date.now(), wiesc = () => {} }) {
    const KAT = path.join(katalog, 'wpisy'), MOJE = path.join(katalog, 'galezie-moje'), STALE = path.join(katalog, 'na-stale.json');
    const powiedz = (t) => { try { Promise.resolve(wiesc(t)).catch(() => {}); } catch { /* kanał opcjonalny */ } };
    const czytajJson = async (p, zap) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return zap; } };
    const zapiszJson = async (p, o) => { await fs.mkdir(path.dirname(p), { recursive: true }); const t = `${p}.${process.pid}.tmp`; await fs.writeFile(t, JSON.stringify(o, null, 2)); await fs.rename(t, p).catch(async () => { await fs.copyFile(t, p); await fs.rm(t, { force: true }); }); };
    let kolejka = Promise.resolve();
    const poKolei = (fn) => { const p = kolejka.then(fn, fn); kolejka = p.catch(() => {}); return p; };
    const plikWpisow = (id) => path.join(KAT, `${id}.json`);
    const stan = async (id) => { const d = await czytajJson(plikWpisow(id), {}); return { wpisy: Array.isArray(d.wpisy) ? d.wpisy : [], galezie: Array.isArray(d.galezie) ? d.galezie : [] }; };
    const ksiega = async (id, { wystawiona = false } = {}) => {
        if (!ID.test(String(id))) throw blad('Zły identyfikator księgi.', 404);
        const k = (await W.katalogPelny()).find((x) => x.id === id && (!wystawiona || x.wystawiona));
        if (!k) throw blad('Tej księgi nie ma w wypożyczalni.', 404);
        return k;
    };

    // ── 2. trzy wypożyczenia = na stałe ──
    const sprawdzone = new Map();   // sesja → id księgi albo null (pamięć procesu: Stripe pytamy raz na sesję)
    async function ksiegaSesji(sesja) {
        if (sprawdzone.has(sesja)) return sprawdzone.get(sesja);
        const zapisane = (await czytajJson(STALE, {})).sesje?.[sesja];
        if (zapisane) { sprawdzone.set(sesja, zapisane); return zapisane; }
        if (!stripe) return null;
        let k = null;
        try { const s = await stripe.sprawdzSesje(sesja); if (s?.oplacona && s.rodzaj === 'ksiega-48h' && s.pakiet) k = String(s.pakiet); } catch { return null; }   // Stripe milczy = nie wiemy (nie zapamiętujemy)
        sprawdzone.set(sesja, k);
        if (k) await poKolei(async () => { const d = await czytajJson(STALE, {}); d.sesje = { ...(d.sesje ?? {}), [sesja]: k }; await zapiszJson(STALE, d); });
        return k;
    }
    /** Ile RÓŻNYCH opłaconych wypożyczeń tej księgi niesie czytelnik i czy ma ją już na stałe. */
    async function czytelnik(id, sesje) {
        const k = await ksiega(id);
        if (k.tier === 'demo') return { demo: true, wypozyczen: 0, potrzeba: WYPOZYCZEN_NA_STALE, naStale: false, galaz: true };
        let n = 0;
        for (const s of listaSesji(sesje)) if ((await ksiegaSesji(s)) === id) n++;
        return { demo: false, wypozyczen: Math.min(n, WYPOZYCZEN_NA_STALE), potrzeba: WYPOZYCZEN_NA_STALE, naStale: n >= WYPOZYCZEN_NA_STALE, galaz: n >= WYPOZYCZEN_NA_STALE };
    }
    const naStale = async (id, sesje) => { try { return (await czytelnik(id, sesje)).naStale; } catch { return false; } };

    // ── 1. żywe wpisy głównej osi ──
    const plikZalacznika = (id, nazwa) => (ID.test(String(id)) && /^w-[0-9a-f]{8}\.(png|jpg|mp3)$/.test(String(nazwa)) ? path.join(KAT, id, nazwa) : null);
    async function zapiszZalacznik(id, wid, dataUrl, typy, maxMB) {
        const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl ?? ''));
        const roz = m && typy[m[1].toLowerCase()];
        if (!roz) throw blad(`Załącznik musi być jednym z: ${Object.keys(typy).join(', ')}.`);
        const dane = Buffer.from(m[2], 'base64');
        if (dane.length > maxMB * 1024 * 1024) throw blad(`Załącznik za duży (limit ${maxMB} MB).`);
        const nazwa = `${wid}.${roz}`;
        await fs.mkdir(path.join(KAT, id), { recursive: true });
        await fs.writeFile(path.join(KAT, id, nazwa), dane);
        return nazwa;
    }
    /** Nowy wpis głównej osi (tylko Katedra-gospodarz). `ilustruj: true` = Paleta rysuje z `opisObrazu` (albo z tytułu i początku tekstu). */
    const dodajWpis = (id, z = {}) => poKolei(async () => {
        await ksiega(id);
        const tytul = tn(z.tytul, 120), tekst = tresc(z.tekst, 8000);
        if (!tytul) throw blad('Wpis potrzebuje tytułu.');
        if (tekst.length < 20) throw blad('Wpis potrzebuje treści (co najmniej 20 znaków).');
        const d = await stan(id);
        if (d.wpisy.length >= MAX_WPISOW) throw blad(`Księga ma już ${MAX_WPISOW} wpisów.`);
        const wid = `w-${crypto.randomBytes(4).toString('hex')}`;
        const wpis = { id: wid, nr: (d.wpisy.at(-1)?.nr ?? 0) + 1, kiedy: new Date(teraz()).toISOString(), tytul, tekst, obraz: null, audio: null, uwaga: null };
        if (z.obraz) wpis.obraz = await zapiszZalacznik(id, wid, z.obraz, { 'image/png': 'png', 'image/jpeg': 'jpg' }, 12);
        else if (z.ilustruj === true) {
            if (!rysuj) wpis.uwaga = 'Bez ilustracji — Katedra nie ma podłączonej Palety (FLUX).';
            else try {
                const zrodlo = await rysuj({ prompt: `${tn(z.opisObrazu, 600) || `${tytul}. ${tn(tekst, 300)}`}, ${STYL_WPISU}`, szer: 1280, wys: 720 });
                const p = typeof zrodlo === 'string' ? zrodlo : zrodlo?.sciezka ?? zrodlo?.plik;
                if (!p) throw new Error('Paleta nie oddała pliku.');
                await fs.mkdir(path.join(KAT, id), { recursive: true });
                await fs.copyFile(p, path.join(KAT, id, `${wid}.png`));
                wpis.obraz = `${wid}.png`;
            } catch (e) { wpis.uwaga = `Bez ilustracji — Paleta: ${tn(e.message, 200)}`; }   // wpis bez obrazu jest uczciwszy niż brak wpisu
        }
        if (z.audio) wpis.audio = await zapiszZalacznik(id, wid, z.audio, { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3' }, 25);
        d.wpisy.push(wpis);
        await zapiszJson(plikWpisow(id), d);
        return wpis;
    });
    /** 🎙️ Nagranie lektora do wpisu (ElevenLabs z archiwum mostu): kopia jako załącznik `<wpis>.mp3`; `null` zdejmuje nagranie. */
    const ustawAudio = (id, wid, zrodlo) => poKolei(async () => {
        await ksiega(id);
        const d = await stan(id), w = d.wpisy.find((x) => x.id === wid);
        if (!w) throw blad('Nie ma takiego wpisu.', 404);
        if (zrodlo) { await fs.mkdir(path.join(KAT, id), { recursive: true }); await fs.copyFile(zrodlo, path.join(KAT, id, `${wid}.mp3`)); w.audio = `${wid}.mp3`; }
        else { if (w.audio) await fs.rm(path.join(KAT, id, w.audio), { force: true }); w.audio = null; }
        await zapiszJson(plikWpisow(id), d);
        return adresy(id, w);
    });
    const usunWpis = (id, wid) => poKolei(async () => {
        const d = await stan(id), w = d.wpisy.find((x) => x.id === wid);
        if (!w) throw blad('Nie ma takiego wpisu.', 404);
        d.wpisy = d.wpisy.filter((x) => x.id !== wid);
        await zapiszJson(plikWpisow(id), d);
        for (const n of [w.obraz, w.audio]) if (n) await fs.rm(path.join(KAT, id, n), { force: true });
        return d.wpisy;
    });
    const adresy = (id, w) => ({ ...w, obraz: w.obraz ? `/wizytowka/teostory/${id}/wpis/${w.obraz}` : null, audio: w.audio ? `/wizytowka/teostory/${id}/wpis/${w.audio}` : null });
    /** Widok Katedry (wszystko: wpisy, gałęzie w każdym stanie). */
    async function pelne(id) { await ksiega(id); const d = await stan(id); return { wpisy: d.wpisy.map((w) => adresy(id, w)), galezie: d.galezie }; }
    /** Widok portalu: licznik i oś dla każdego; treść wpisów i gałęzi — tylko z dostępem do księgi. */
    async function publiczne(id, { sesja = null, sesje = [] } = {}) {
        const k = await ksiega(id, { wystawiona: true });
        const d = await stan(id), cz = await czytelnik(id, sesje);
        let dostep = k.tier === 'demo' || cz.naStale;
        if (!dostep && sesja) { try { await W.czytaj(id, { sesja }); dostep = true; } catch { dostep = false; } }
        const przyjete = d.galezie.filter((g) => g.stan === 'przyjeta');
        return {
            ksiega: id, dostep, czytelnik: cz, licznik: d.wpisy.length, ostatni: d.wpisy.at(-1)?.kiedy ?? null,
            wpisy: d.wpisy.map((w) => (dostep ? adresy(id, w) : { id: w.id, nr: w.nr, kiedy: w.kiedy, tytul: w.tytul })),
            galezie: przyjete.map((g) => (dostep ? { id: g.id, nick: g.nick, kiedy: g.kiedy, tytul: g.tytul, tekst: g.tekst } : { id: g.id, nick: g.nick, kiedy: g.kiedy, tytul: g.tytul })),
            katedr: new Set(przyjete.map((g) => g.nick)).size,
        };
    }
    /** Liczniki wszystkich wystawionych ksiąg — portal pokazuje „🌿 n wpisów” na kartach i liczy nowe. */
    async function liczniki() {
        const out = {};
        for (const k of (await W.katalogPelny()).filter((x) => x.wystawiona)) {
            const d = await stan(k.id);
            if (d.wpisy.length || d.galezie.some((g) => g.stan === 'przyjeta')) out[k.id] = { wpisow: d.wpisy.length, ostatni: d.wpisy.at(-1)?.kiedy ?? null, galezi: d.galezie.filter((g) => g.stan === 'przyjeta').length };
        }
        return out;
    }

    // ── 3. gałęzie: przyjęcie zgłoszenia z innej Katedry (publiczne), decyzja Suwerena ──
    const przyjmijZgloszenie = (id, z = {}) => poKolei(async () => {
        const k = await ksiega(id, { wystawiona: true });
        const g = { nick: String(z.nick ?? '').toLowerCase(), ksiega: id, tytul: tn(z.tytul, 120), tekst: tresc(z.tekst, 6000), czas: Number(z.czas), podpis: String(z.podpis ?? '').slice(0, 200) };
        if (!NICK.test(g.nick)) throw blad('Zgłoszenie bez poprawnego nicku Katedry.');
        if (!g.tytul || g.tekst.length < 300) throw blad('Gałąź potrzebuje tytułu i co najmniej 300 znaków tekstu.');
        if (!(Math.abs(teraz() - g.czas) <= SWIEZOSC_MS)) throw blad('Zgłoszenie jest nieświeże (starsze niż godzina) — wyślij ponownie.');
        if (!katedra) throw blad('Ta Katedra nie przyjmuje gałęzi (brak rejestru).', 503);
        if (g.nick === String((await nick()) ?? '').toLowerCase()) throw blad('To zgłoszenie od tej samej Katedry — własne wpisy dopisujesz na głównej osi.');
        let kt; try { kt = await katedra(g.nick); } catch (e) { throw blad(`Katedry „${g.nick}” nie ma w rejestrze otakos.wtf (${tn(e.message, 120)}).`, 403); }
        // podpis liczony nad tekstem DOKŁADNIE takim, jaki przyszedł (porządkowanie odstępów niżej nie może go unieważnić)
        const surowe = { ...g, tytul: String(z.tytul ?? '').slice(0, 400), tekst: String(z.tekst ?? '').slice(0, 20000) };
        if (!sprawdzPodpis(trescGalezi(surowe), kt.klucz, g.podpis)) throw blad('Podpis nie zgadza się z kluczem tej Katedry z rejestru — odrzucone.', 403);
        // prawo do gałęzi: księga darmowa albo trzy opłacone wypożyczenia tej księgi
        if (k.tier !== 'demo' && !(await czytelnik(id, z.sesje)).naStale) throw blad(`Gałąź może dopiąć czytelnik, który ma tę księgę na stałe (${WYPOZYCZEN_NA_STALE} wypożyczenia).`, 403);
        const d = await stan(id);
        const odcisk = sha(g.tekst);
        const stara = d.galezie.find((x) => x.nick === g.nick && x.odcisk === odcisk);
        if (stara) return stara;   // to samo zgłoszenie drugi raz = ta sama pozycja
        if (d.galezie.filter((x) => x.nick === g.nick && x.stan === 'do_zgody').length >= MAX_GALEZI_CZEKAJACYCH) throw blad(`Od tej Katedry czeka już ${MAX_GALEZI_CZEKAJACYCH} gałęzi — poczekaj na decyzję.`, 429);
        const nowa = { id: `g-${crypto.randomBytes(4).toString('hex')}`, nick: g.nick, tytul: g.tytul, tekst: g.tekst, odcisk, czas: g.czas, podpis: g.podpis, stan: 'do_zgody', kiedy: new Date(teraz()).toISOString() };
        d.galezie.push(nowa);
        await zapiszJson(plikWpisow(id), d);
        powiedz(`🌌 Katedra „${g.nick}” przysłała gałąź do księgi „${k.tytul}”: „${g.tytul}”. Czeka na ✓ w Izbie zgód.`);
        return nowa;
    });
    const rozstrzygnijGalaz = (id, gid, akcja, { powod = '' } = {}) => poKolei(async () => {
        if (!['przyjmij', 'odrzuc'].includes(akcja)) throw blad(`Nie znam akcji „${akcja}”.`);
        const d = await stan(id), g = d.galezie.find((x) => x.id === gid);
        if (!g) throw blad('Nie ma takiej gałęzi.', 404);
        g.stan = akcja === 'przyjmij' ? 'przyjeta' : 'odrzucona';
        g.decyzja = { kiedy: new Date(teraz()).toISOString(), powod: tn(powod, 300) };
        await zapiszJson(plikWpisow(id), d);
        return g;
    });
    /** 📥 Źródło Izby zgód: gałęzie czekające na decyzję (✓/✕ także z telefonu — to tylko tekst do pokazania). */
    const zrodloIzby = {
        id: 'galezie', emoji: '🌌', nazwa: 'Gałęzie Żywych Ksiąg',
        czekajace: async () => {
            const out = [];
            for (const k of await W.katalogPelny()) for (const g of (await stan(k.id)).galezie.filter((x) => x.stan === 'do_zgody')) {
                out.push({ id: `${k.id}~${g.id}`, kiedy: g.kiedy, tytul: `Gałąź do „${k.tytul}” od Katedry ${g.nick}: ${g.tytul}`, opis: tn(g.tekst, 700),
                    akcje: [{ id: 'przyjmij', etykieta: '✓ Dopnij do księgi', zdalnie: true }, { id: 'odrzuc', etykieta: '✕ Odrzuć', zdalnie: true }] });
            }
            return out;
        },
        decyduj: (klucz, akcja, { powod } = {}) => { const [id, gid] = String(klucz).split('~'); return rozstrzygnijGalaz(id, gid, akcja, { powod }); },
    };

    // ── 3. gałęzie: druk ciągu dalszego w TEJ Katedrze (czytelnik) i wysyłka do Głównej Księgi ──
    const dobraBaza = (b) => { const s = String(b ?? '').replace(/\/+$/, ''); if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(s)) throw blad('Adres Głównej Katedry musi być https://…'); return s; };
    let drukuje = false;
    /** Kronikarz tej Katedry pisze rozdział z dotychczasowej treści księgi (pobranej z Głównej Katedry prawami czytelnika). */
    async function drukuj({ baza, ksiega: id, sesje = [], wskazowka = '' } = {}) {
        if (!pisz) throw blad('Ta Katedra nie ma podłączonego Kronikarza (modelu).', 503);
        if (!ID.test(String(id))) throw blad('Zły identyfikator księgi.');
        if (drukuje) throw blad('Jedna gałąź właśnie się drukuje — poczekaj.', 409);
        const b = dobraBaza(baza), ss = listaSesji(sesje);
        drukuje = true;
        try {
            const q = new URLSearchParams(); if (ss.length) { q.set('sesja', ss.at(-1)); q.set('sesje', ss.join(',')); }
            const pobierz = async (sciezka) => { const r = await f(`${b}${sciezka}?${q}`, { signal: AbortSignal.timeout(30_000) }); const d = await r.json().catch(() => null); if (!r.ok || !d?.success) throw blad(d?.message ? `Główna Katedra: ${d.message}` : `Główna Katedra odpowiedziała HTTP ${r.status}.`, 502); return d; };
            const cz = await pobierz(`/wizytowka/teostory/${id}/czytaj`);
            const wp = await pobierz(`/wizytowka/teostory/${id}/wpisy`).catch(() => ({ wpisy: [], czytelnik: null }));
            if (wp.czytelnik && !wp.czytelnik.galaz) throw blad(`Własną gałąź odblokowują ${WYPOZYCZEN_NA_STALE} wypożyczenia tej księgi (masz ${wp.czytelnik.wypozyczen}).`, 403);
            const book = cz.ksiega ?? {};
            const strony = (book.pages ?? []).map((s) => tresc(s?.narrativeText, 1200)).filter(Boolean);
            const wpisy = (wp.wpisy ?? []).filter((w) => w.tekst).map((w) => `${w.tytul}: ${tresc(w.tekst, 800)}`);
            const prompt = [`KSIĘGA: „${tn(book.title, 200)}”${book.author ? ` — ${tn(book.author, 120)}` : ''} (język: ${tn(book.language, 10) || 'jak w tekście'})`,
                'DOTYCHCZASOWA TREŚĆ (końcówka):', ...strony.slice(-8), wpisy.length ? 'ŻYWE WPISY GŁÓWNEJ OSI (najnowsze):' : '', ...wpisy.slice(-5),
                tn(wskazowka, 400) ? `KIERUNEK OD SUWERENA TEJ KATEDRY: ${tn(wskazowka, 400)}` : '', '', 'Napisz ciąg dalszy jako własną gałąź. Tylko JSON.'].filter(Boolean).join('\n\n');
            let g, powod = '';
            for (let proba = 0; proba < 2 && !g; proba++) {
                try { g = odczytajGalaz(await pisz(SYSTEM_GALEZI, proba ? `${prompt}\n\nPoprzednia odpowiedź była zła: ${powod}. Popraw i oddaj sam JSON.` : prompt)); } catch (e) { powod = tn(e.message, 200); }
            }
            if (!g) throw blad(`Kronikarz nie oddał rozdziału (${powod}).`, 502);
            const moja = { id: `g-${crypto.randomBytes(4).toString('hex')}`, baza: b, ksiega: id, tytulKsiegi: tn(book.title, 200), ...g, sesje: ss, stan: 'wydrukowana', kiedy: new Date(teraz()).toISOString() };
            await zapiszJson(path.join(MOJE, `${moja.id}.json`), moja);
            return moja;
        } finally { drukuje = false; }
    }
    async function moje() {
        const out = [];
        for (const n of (await fs.readdir(MOJE).catch(() => [])).filter((x) => /^g-[0-9a-f]{8}\.json$/.test(x))) { const g = await czytajJson(path.join(MOJE, n), null); if (g) out.push(g); }
        return out.sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy)));
    }
    /** Podpisana wysyłka wydrukowanej gałęzi do Głównej Katedry (tam czeka na ✓ jej Suwerena). */
    async function wyslij(gid) {
        const p = path.join(MOJE, `${String(gid)}.json`);
        const g = /^g-[0-9a-f]{8}$/.test(String(gid)) ? await czytajJson(p, null) : null;
        if (!g) throw blad('Nie ma takiej gałęzi.', 404);
        const ja = String((await nick()) ?? '').toLowerCase();
        if (!NICK.test(ja) || !podpisz) throw blad('Najpierw nadaj Katedrze nick (🪪 Wizytówka) i zamelduj ją w rejestrze — Główna Katedra rozpoznaje gałąź po podpisie.');
        const z = { nick: ja, ksiega: g.ksiega, tytul: g.tytul, tekst: g.tekst, czas: teraz() };
        z.podpis = await podpisz(trescGalezi(z));
        let d = null, status = 0;
        try { const r = await f(`${g.baza}/wizytowka/teostory/${g.ksiega}/galaz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...z, sesje: g.sesje }), signal: AbortSignal.timeout(30_000) }); status = r.status; d = await r.json().catch(() => null); }
        catch (e) { throw blad(`Główna Katedra nie odpowiada (${tn(e.message, 120)}) — gałąź zostaje u Ciebie, wyślij później.`, 502); }
        if (!d?.success) { g.blad = tn(d?.message ?? `HTTP ${status}`, 300); await zapiszJson(p, g); throw blad(`Główna Katedra odmówiła: ${g.blad}`, 502); }
        g.stan = 'wyslana'; g.wyslano = new Date(teraz()).toISOString(); g.uGlownej = d.galaz?.stan ?? 'do_zgody'; delete g.blad;
        await zapiszJson(p, g);
        return g;
    }

    return { dodajWpis, ustawAudio, usunWpis, pelne, publiczne, liczniki, czytelnik, naStale, plikZalacznika, przyjmijZgloszenie, rozstrzygnijGalaz, zrodloIzby, drukuj, moje, wyslij };
}

/** Strona „Drukarnia gałęzi” — otwierana z portalu w Katedrze czytelnika (nawigacja do 127.0.0.1; sama niczego nie drukuje bez kliknięcia). */
export const STRONA_DRUKARNI = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drukarnia gałęzi — Żywa Księga Wielowymiarowa</title>
<style>body{margin:0;background:#0b0c10;color:#f4f1ea;font:16px/1.5 Georgia,serif}main{max-width:760px;margin:0 auto;padding:28px 18px}h1{font-size:24px;color:#d4a853;margin:0 0 6px}p.m{color:#a8a39a;font-size:14px}textarea,button{font:inherit}textarea{width:100%;box-sizing:border-box;background:#14161c;color:inherit;border:1px solid #3a3d47;border-radius:8px;padding:10px}button{background:#d4a853;color:#111;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;margin:10px 8px 0 0}button[disabled]{opacity:.5;cursor:default}#wynik{white-space:pre-wrap;background:#14161c;border:1px solid #3a3d47;border-radius:8px;padding:14px;margin-top:16px;display:none}#info{margin-top:12px;color:#e9c46a}</style></head><body><main>
<h1>🖨️ Drukarnia gałęzi</h1><p class="m">Kronikarz Twojej Katedry napisze ciąg dalszy tej księgi z jej dotychczasowej treści. Nic nie wychodzi z Twojej Katedry, dopóki nie klikniesz „Wyślij”. Gałąź niesie sam tekst; w Głównej Księdze pojawi się po ✓ jej Suwerena.</p>
<p id="ksiega" class="m"></p>
<textarea id="wsk" rows="3" placeholder="Kierunek dla Kronikarza (opcjonalnie): dokąd ma pójść ta gałąź?"></textarea>
<button id="drukuj">🖨️ Wydrukuj ciąg dalszy</button><button id="wyslij" disabled>📮 Wyślij do Głównej Księgi</button>
<div id="info"></div><div id="wynik"></div>
<script>
const q = new URLSearchParams(location.search), baza = q.get('baza') || '', ksiega = q.get('ksiega') || '', sesje = (q.get('sesje') || '').split(',').filter(Boolean);
const el = (i) => document.getElementById(i); let galaz = null;
el('ksiega').textContent = 'Księga: ' + ksiega + ' · Główna Katedra: ' + baza;
const post = async (s, b) => { const r = await fetch(s, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }); return r.json().catch(() => ({ success: false, message: 'HTTP ' + r.status })); };
el('drukuj').onclick = async () => { el('drukuj').disabled = true; el('info').textContent = 'Kronikarz pisze… (lokalny model, to może potrwać kilka minut)';
  const d = await post('/api/galezie-ksiag/drukuj', { baza, ksiega, sesje, wskazowka: el('wsk').value });
  el('drukuj').disabled = false;
  if (!d.success) { el('info').textContent = '⚠ ' + d.message; return; }
  galaz = d.galaz; el('info').textContent = 'Wydrukowane. Przeczytaj — jeśli chcesz inną wersję, wydrukuj jeszcze raz.'; el('wynik').style.display = 'block'; el('wynik').textContent = galaz.tytul + '\\n\\n' + galaz.tekst; el('wyslij').disabled = false; };
el('wyslij').onclick = async () => { if (!galaz || !confirm('Wysłać tę gałąź, podpisaną nickiem Twojej Katedry, do Głównej Księgi?')) return; el('wyslij').disabled = true;
  const d = await post('/api/galezie-ksiag/' + galaz.id + '/wyslij'); el('info').textContent = d.success ? '📮 Wysłane — czeka na ✓ Suwerena Głównej Katedry.' : '⚠ ' + d.message; if (!d.success) el('wyslij').disabled = false; };
</script></main></body></html>`;

/** Trasy: `/api/zywe-wpisy` i `/api/galezie-ksiag` — maszyna (Straż); `/wizytowka/teostory/…` — publiczne (portal przez tunel). */
export function zamontujTrasyKsiegiWielowymiarowej(app, K, { limitNaMinute = 10 } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(Number(e.kod) >= 400 && Number(e.kod) < 600 ? Number(e.kod) : 400).json({ success: false, message: e.message }));
    const cors = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'Content-Type'); };
    // Katedra-gospodarz: oś wpisów i decyzje o gałęziach
    app.get('/api/zywe-wpisy/:id', (req, res) => odp(res, K.pelne(req.params.id)));
    app.post('/api/zywe-wpisy/:id', (req, res) => odp(res, K.dodajWpis(req.params.id, req.body ?? {}).then((wpis) => ({ wpis }))));
    app.delete('/api/zywe-wpisy/:id/:wpis', (req, res) => odp(res, K.usunWpis(req.params.id, req.params.wpis).then((wpisy) => ({ wpisy }))));
    app.post('/api/zywe-wpisy/:id/galaz/:galaz/:akcja', (req, res) => odp(res, K.rozstrzygnijGalaz(req.params.id, req.params.galaz, req.params.akcja, { powod: req.body?.powod }).then((galaz) => ({ galaz }))));
    // Katedra czytelnika: druk i wysyłka własnej gałęzi
    app.get('/api/galezie-ksiag', (_req, res) => odp(res, K.moje().then((galezie) => ({ galezie }))));
    app.get('/api/galezie-ksiag/drukarnia', (_req, res) => res.type('html').send(STRONA_DRUKARNI));
    app.post('/api/galezie-ksiag/drukuj', (req, res) => odp(res, K.drukuj(req.body ?? {}).then((galaz) => ({ galaz }))));
    app.post('/api/galezie-ksiag/:id/wyslij', (req, res) => odp(res, K.wyslij(req.params.id).then((galaz) => ({ galaz }))));
    // Publiczne (portal teostory.studio przez tunel Katedry)
    app.get('/wizytowka/teostory/zywe', (_req, res) => { cors(res); odp(res, K.liczniki().then((ksiegi) => ({ ksiegi }))); });
    app.get('/wizytowka/teostory/:id/wpisy', (req, res) => { cors(res); odp(res, K.publiczne(req.params.id, { sesja: req.query.sesja ? String(req.query.sesja) : null, sesje: listaSesji(req.query.sesje) })); });
    app.get('/wizytowka/teostory/:id/wpis/:plik', (req, res) => { cors(res); const p = K.plikZalacznika(req.params.id, req.params.plik); return p ? res.sendFile(p, (e) => { if (e && !res.headersSent) res.status(404).end(); }) : res.status(404).end(); });
    const proby = new Map();
    app.options('/wizytowka/teostory/:id/galaz', (_req, res) => { cors(res); res.status(204).end(); });
    app.post('/wizytowka/teostory/:id/galaz', (req, res) => {
        cors(res);
        const ip = String(req.ip ?? ''), t = Date.now(), ost = (proby.get(ip) ?? []).filter((x) => t - x < 60_000);
        if (ost.length >= limitNaMinute) return res.status(429).json({ success: false, message: 'Za dużo zgłoszeń z tego adresu — spróbuj za minutę.' });
        proby.set(ip, [...ost, t]);
        odp(res, K.przyjmijZgloszenie(req.params.id, req.body ?? {}).then((g) => ({ galaz: { id: g.id, stan: g.stan } })));
    });
}

export default { utworzKsiegeWielowymiarowa, zamontujTrasyKsiegiWielowymiarowej, trescGalezi, listaSesji, odczytajGalaz, WYPOZYCZEN_NA_STALE, STRONA_DRUKARNI };
