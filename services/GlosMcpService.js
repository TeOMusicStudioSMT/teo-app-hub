/**
 * 🎙️ GlosMcpService — profile głosowe Katedry i katalog przewodów Voice/Audio MCP.
 *
 * Dwie rzeczy, celowo w jednym miejscu:
 *
 *  1. PROFILE GŁOSU — który sklonowany głos obsługuje którą działalność.
 *     Mieszkają w `_OtakOs_Voice/profile.json`, obok wyrenderowanego audio.
 *     Sama próbka klonu leży tam, gdzie leżała: `_OtakOs_AI/voices/<id>.wav`
 *     (nie ruszamy jej, bo `/api/voice/clone` i `/api/voice/speak` już z niej żyją).
 *
 *  2. KATALOG PRZEWODÓW — ElevenLabs MCP, Kokoro TTS, Gemini Audio Live,
 *     Twilio Conduits, lokalny klon, Whisper.
 *
 * ⚠️ NAJWAŻNIEJSZE POLE W TYM PLIKU TO `sterownik`.
 * Katalog przewodów to KATALOG — karty tego, co da się podpiąć. `sterownik: true`
 * mają wyłącznie te przewody, które most naprawdę potrafi dziś poprowadzić.
 * Reszta ma `sterownik: false` i UI ma to pokazać wprost, zamiast rysować
 * zielone światełko przy czymś, co nic nie zrobi. Ta sama zasada, co
 * `MCP_REALNE` w rejestrze MCP — atrapa z zielonym statusem jest gorsza niż
 * brak funkcji, bo Suweren planuje pracę w oparciu o to, co widzi.
 *
 * `podpiety` (klucz w skarbcu / żywy serwer) i `sterownik` (most umie tego użyć)
 * to DWIE RÓŻNE rzeczy. Przewód bywa opłacony i skonfigurowany, a mimo to
 * bezużyteczny, dopóki nikt nie napisał jego obsługi.
 *
 * Standard ESM · zapis atomowy.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const PLIK_PROFILI = 'profile.json';

/** Ile wyrenderowanych plików audio wymieniamy w statusie. */
const LIMIT_NAGRAN = 30;

/**
 * Katalog przewodów Voice/Audio.
 *
 * `sprawdz` mówi, CZYM przewód stoi — most przekłada to na realny test:
 *   · `http`  — czy serwer odpowiada (lokalny silnik, Kokoro),
 *   · `vault` — czy w skarbcu 0.00G leży klucz [usługa, pole],
 *   · `plik`  — czy binarka istnieje na dysku.
 */
export const KATALOG_PRZEWODOW = [
    {
        // 🇵🇱 Jedyny przewód, który mówi po POLSKU lokalnie. Dodany po sprawdzeniu,
        // że supervoice-voicebox obsługuje WYŁĄCZNIE angielski (ich README).
        id: 'piper-pl',
        nazwa: 'Piper PL (polski, lokalnie)',
        rodzaj: 'tts',
        zrodlo: 'lokalny',
        glyph: '🇵🇱',
        suwerenny: true,
        sterownik: true,
        sprawdz: { plik: 'PIPER_GLOSY' },
        opis: 'Polska mowa liczona na maszynie Suwerena — bez chmury i bez kluczy. Wagi w _OtakOs_Voice/piper/ (pl_PL-gosia-medium, pl_PL-bass-high).',
    },
    {
        // 🇬🇧 SuperVoice — osobny przewód WYŁĄCZNIE do angielskiego. Trzymany osobno
        // od piper-pl celowo: wrzucenie tu polskiego zdania da obcy akcent, a nie błąd.
        id: 'supervoice-en',
        nazwa: 'SuperVoice EN (angielski, lokalnie, GPU)',
        rodzaj: 'tts',
        zrodlo: 'lokalny',
        glyph: '🇬🇧',
        suwerenny: true,
        sterownik: true,
        sprawdz: { plik: 'SUPERVOICE_SKRYPT' },
        opis: 'Angielska mowa 24 kHz liczona na GPU Suwerena (VoiceBox, MIT, BETA). Trzy głosy: voice_1..voice_3. Modele ~5 GB w cache torcha. Polskiego NIE przeczyta — do tego jest piper-pl.',
    },
    {
        id: 'klon-lokalny',
        nazwa: 'Lokalny klon głosu (XTTS / OpenVoice)',
        rodzaj: 'tts',
        zrodlo: 'lokalny',
        glyph: '🗣️',
        suwerenny: true,
        sterownik: true,
        sprawdz: { http: 'VOICE_BASE' },
        opis: 'Mowa z próbki Suwerena, liczona na jego maszynie. Zero chmury. Most używa go w /api/voice/speak i /api/voice/render.',
    },
    {
        id: 'whisper-lokalny',
        nazwa: 'Whisper.cpp (rozpoznawanie mowy)',
        rodzaj: 'stt',
        zrodlo: 'lokalny',
        glyph: '👂',
        suwerenny: true,
        sterownik: true,
        sprawdz: { plik: 'WHISPER_EXE' },
        opis: 'Transkrypcja lokalna — wejście głosowe klienta zamienia się w tekst bez wychodzenia z maszyny (/api/voice/transcribe).',
    },
    {
        id: 'przegladarka',
        nazwa: 'Synteza przeglądarki (speechSynthesis)',
        rodzaj: 'tts',
        zrodlo: 'lokalny',
        glyph: '🌐',
        suwerenny: true,
        sterownik: true,
        sprawdz: { front: true },
        opis: 'Zapasowy tor mowy — działa u każdego bez instalacji, ale to głos systemu, nie klon. Żyje po stronie przeglądarki (voiceService).',
    },
    {
        id: 'kokoro-tts',
        nazwa: 'Kokoro TTS (MCP)',
        rodzaj: 'tts',
        zrodlo: 'lokalny',
        glyph: '🌸',
        suwerenny: true,
        sterownik: true,
        sprawdz: { http: 'KOKORO_BASE' },
        opis: 'Lekki lokalny TTS (API zgodne z OpenAI: /v1/audio/speech). Sterownik gotowy — głosy własne Kokoro, np. af_heart.',
    },
    {
        id: 'elevenlabs-mcp',
        nazwa: 'ElevenLabs MCP',
        rodzaj: 'tts+klon',
        zrodlo: 'chmura',
        glyph: '🧬',
        suwerenny: false,
        sterownik: true,
        sprawdz: { vault: ['elevenlabs', 'api_key'] },
        opis: 'Klon głosu klasy studyjnej w chmurze (model multilingual_v2). Sterownik gotowy. ⚠️ KOSZTUJE kredyty przy każdym wywołaniu — wybierany tylko wtedy, gdy profil jawnie go wskazuje.',
    },
    {
        id: 'gemini-audio-live',
        nazwa: 'Gemini Audio Live',
        rodzaj: 'live',
        zrodlo: 'chmura',
        glyph: '✦',
        suwerenny: false,
        sterownik: false,
        sprawdz: { vault: ['gemini', 'api_key'] },
        opis: 'Dwukierunkowa rozmowa głosowa w czasie rzeczywistym (WebSocket). Karta katalogu — sterownik w Etapie 3, razem z Media Streams telefonii.',
    },
    {
        id: 'twilio-conduit',
        nazwa: 'Twilio Conduits (telefonia)',
        rodzaj: 'telefonia',
        zrodlo: 'chmura',
        glyph: '☎️',
        suwerenny: false,
        sterownik: true,
        // Telefonia potrzebuje TRZECH rzeczy naraz. Sprawdzanie samego tokenu
        // pokazywałoby „podpięty" przy koncie, z którego nie da się zadzwonić,
        // bo nie ma numeru wyjściowego.
        sprawdz: { vault: [['twilio', 'account_sid'], ['twilio', 'auth_token'], ['twilio', 'from_number']] },
        opis: 'Wyjście na prawdziwą sieć telefoniczną. Sterownik Etapu 2: połączenie wychodzące, które MÓWI (TwiML Say). Rozmowa dwustronna i klon Suwerena w słuchawce wymagają publicznego adresu — Etap 3.',
    },
];

export function przewod(id) {
    return KATALOG_PRZEWODOW.find(p => p.id === id) ?? null;
}

/** Przewody, którymi most naprawdę potrafi dziś poprowadzić dźwięk. */
export const PRZEWODY_REALNE = KATALOG_PRZEWODOW.filter(p => p.sterownik).map(p => p.id);

/**
 * Status przewodów. Testy wstrzykuje most — ten serwis nie zna ani skarbca,
 * ani portów, więc nie ma jak „przypadkiem" ogłosić czegoś działającym.
 *
 * @param {object} testy
 * @param {(url:string)=>Promise<boolean>} testy.zywy    — czy serwer HTTP odpowiada
 * @param {(usluga:string, pole:string)=>Promise<boolean>} testy.maKlucz — czy klucz jest w skarbcu
 * @param {(sciezka:string)=>boolean} testy.maPlik       — czy plik istnieje
 * @param {Record<string,string>} adresy                 — podmiana symboli (VOICE_BASE, WHISPER_EXE)
 */
export async function statusPrzewodow(testy, adresy = {}) {
    const { zywy, maKlucz, maPlik } = testy;

    return Promise.all(KATALOG_PRZEWODOW.map(async p => {
        let podpiety = false;
        let czym = null;

        try {
            if (p.sprawdz.http) {
                const url = adresy[p.sprawdz.http] ?? p.sprawdz.http;
                podpiety = await zywy(url);
                czym = url;
            } else if (p.sprawdz.vault) {
                // Dwie postacie: pojedyncza para [usluga, pole] albo lista par —
                // wtedy podpięty znaczy „wszystkie obecne", bo brak jednego pola
                // i tak zatrzyma sterownik.
                const pary = Array.isArray(p.sprawdz.vault[0]) ? p.sprawdz.vault : [p.sprawdz.vault];
                const wyniki = await Promise.all(pary.map(([u, f]) => maKlucz(u, f)));
                podpiety = wyniki.every(Boolean);
                const brakujace = pary.filter((_, i) => !wyniki[i]).map(([u, f]) => `${u}.${f}`);
                czym = brakujace.length
                    ? `skarbiec — brakuje: ${brakujace.join(', ')}`
                    : `skarbiec: ${pary.map(([u, f]) => `${u}.${f}`).join(', ')}`;
            } else if (p.sprawdz.plik) {
                const sciezka = adresy[p.sprawdz.plik] ?? p.sprawdz.plik;
                podpiety = maPlik(sciezka);
                czym = sciezka;
            } else if (p.sprawdz.front) {
                // Żyje w przeglądarce — most nie ma jak tego sprawdzić i nie udaje, że ma.
                podpiety = true;
                czym = 'przeglądarka Suwerena';
            }
        } catch {
            podpiety = false;
        }

        return {
            ...p,
            podpiety,
            czym,
            // Jedno zdanie prawdy dla UI — żeby panel nie musiał sam składać werdyktu.
            werdykt: !p.sterownik
                ? (podpiety
                    ? 'Skonfigurowany, ale most nie ma jeszcze sterownika — nic nie wykona.'
                    : 'Karta katalogu — brak konfiguracji i brak sterownika.')
                : (podpiety
                    ? 'Gotowy — most potrafi tędy poprowadzić dźwięk.'
                    : (p.zrodlo === 'chmura'
                        ? 'Sterownik jest, ale brakuje konfiguracji w Skarbcu 0.00G. Uzupełnij klucze.'
                        : 'Sterownik jest, ale przewód nie odpowiada. Odpal usługę albo wskaż inny adres.')),
        };
    }));
}

// ── PROFILE GŁOSU ─────────────────────────────────────────────────────────────

function sciezkaProfili(katalog) { return path.join(katalog, PLIK_PROFILI); }

export async function wczytajProfile(katalog) {
    try {
        const d = JSON.parse(await fs.readFile(sciezkaProfili(katalog), 'utf8'));
        return Array.isArray(d.profile) ? d.profile : [];
    } catch { return []; }
}

async function zapiszProfile(katalog, profile) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    const cel = sciezkaProfili(katalog);
    const tmp = cel + '.tmp';
    await fs.writeFile(tmp, JSON.stringify({ profile, zapisano: new Date().toISOString() }, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

function bezpiecznyId(v, zapas) {
    const s = String(v ?? '').replace(/[^\w-]/g, '');
    return s || zapas;
}

/**
 * Dodaje albo nadpisuje profil głosowy.
 *
 * `voiceId` wskazuje próbkę klonu (`_OtakOs_AI/voices/<voiceId>.wav`). Most
 * sprawdza jej istnienie i zwraca `probkaIstnieje` — profil bez próbki wolno
 * zapisać (np. pod przyszły klon), ale UI ma o tym wiedzieć.
 */
export async function zapiszProfil(katalog, dane) {
    const id = bezpiecznyId(dane.id ?? dane.nazwa, `glos-${Date.now().toString(36)}`);
    const p = {
        id,
        nazwa: String(dane.nazwa ?? id).trim().slice(0, 80),
        voiceId: bezpiecznyId(dane.voiceId, 'suweren'),
        przewod: przewod(dane.przewod)?.id ?? 'klon-lokalny',
        jezyk: String(dane.jezyk ?? 'pl').slice(0, 8),
        biznesId: dane.biznesId ? String(dane.biznesId).slice(0, 64) : null,
        opis: String(dane.opis ?? '').slice(0, 300),
        utworzony: new Date().toISOString(),
    };

    const profile = await wczytajProfile(katalog);
    const i = profile.findIndex(x => x.id === p.id);
    if (i >= 0) profile[i] = { ...profile[i], ...p, utworzony: profile[i].utworzony };
    else profile.push(p);

    await zapiszProfile(katalog, profile);
    return p;
}

export async function usunProfil(katalog, id) {
    const profile = await wczytajProfile(katalog);
    const zostaje = profile.filter(p => p.id !== id);
    if (zostaje.length === profile.length) throw new Error(`Profil głosu „${id}" nieznany.`);
    await zapiszProfile(katalog, zostaje);
    return { id, usuniety: true };
}

/** Nagrania wyprodukowane przez Katedrę — najświeższe pierwsze. */
export async function nagrania(katalog) {
    try {
        const pliki = await fs.readdir(katalog);
        const audio = pliki.filter(f => /\.(wav|mp3|ogg|webm)$/i.test(f));
        const zeStanem = await Promise.all(audio.map(async f => {
            const st = await fs.stat(path.join(katalog, f)).catch(() => null);
            return st ? { plik: f, bajty: st.size, kiedy: st.mtime.toISOString() } : null;
        }));
        return zeStanem
            .filter(Boolean)
            .sort((a, b) => b.kiedy.localeCompare(a.kiedy))
            .slice(0, LIMIT_NAGRAN);
    } catch { return []; }
}

export default {
    KATALOG_PRZEWODOW, PRZEWODY_REALNE,
    przewod, statusPrzewodow,
    wczytajProfile, zapiszProfil, usunProfil, nagrania,
};
