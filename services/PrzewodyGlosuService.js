/**
 * 🔊 PrzewodyGlosuService — STEROWNIKI przewodów głosowych (Etap 2).
 *
 * Etap 1 dał katalog: karty tego, co da się podpiąć. Tu zaczyna się to, co
 * naprawdę wydaje dźwięk. Jeden wspólny wjazd — `syntezuj()` — i trzy tory:
 *
 *   · `piper-pl`       → Piper na dysku Suwerena — JEDYNY tor mówiący po POLSKU
 *                       bez chmury i bez kluczy (wagi w _OtakOs_Voice/piper/),
 *   · `klon-lokalny`   → XTTS/OpenVoice na maszynie Suwerena (WAV z jego próbki),
 *   · `kokoro-tts`     → lokalny serwer zgodny z API OpenAI (`/v1/audio/speech`),
 *   · `elevenlabs-mcp` → chmura ElevenLabs (jedyny tor, który wychodzi z domu).
 *
 * ⚠️ TRZY RZECZY, KTÓRE TEN PLIK ROBI CELOWO NIEWYGODNIE:
 *
 *  1. BRAK KLUCZA TO NIE JEST BŁĄD DO POŁKNIĘCIA. Każdy tor rzuca `BladPrzewodu`
 *     ze statusem HTTP i zdaniem po polsku mówiącym, czego brakuje. Żaden tor
 *     nie „spada cicho" na inny — podmiana silnika za plecami Suwerena to
 *     dokładnie ten rodzaj uprzejmości, przez który potem nie wiadomo, co grało.
 *
 *  2. KLUCZ NIGDY NIE WYCHODZI W KOMUNIKACIE. Odpowiedzi błędu z chmury bywają
 *     echem żądania; dlatego treść cudzego błędu jest przycinana i przepuszczana
 *     przez `bezSekretow()`.
 *
 *  3. CHMURA KOSZTUJE. `elevenlabs-mcp` zużywa kredyty Suwerena przy każdym
 *     wywołaniu, więc tor chmurowy jest wybierany WYŁĄCZNIE wtedy, gdy profil
 *     głosu jawnie go wskazuje. Nie ma automatycznego „podbicia jakości".
 *
 * Standard ESM. Zero zależności — sam `fetch` z Node 18+.
 */

import fsSync from 'fs';
import fsp    from 'fs/promises';
import path   from 'path';
import os     from 'os';
import { spawn } from 'child_process';

export class BladPrzewodu extends Error {
    constructor(message, status = 424, przewod = null) {
        super(message);
        this.name = 'BladPrzewodu';
        this.status = status;
        this.przewod = przewod;
    }
}

/** Co który tor wypuszcza — most musi wiedzieć, z jakim rozszerzeniem zapisać plik. */
export const SILNIKI = {
    // 🇵🇱 Piper — jedyny przewód, który mówi po POLSKU lokalnie, bez chmury i bez
    // kluczy. Wagi leżą w _OtakOs_Voice/piper/. Dodany po tym, jak sprawdziliśmy,
    // że supervoice-voicebox obsługuje WYŁĄCZNIE angielski (ich README, nie opis).
    'piper-pl': { mime: 'audio/wav', ext: 'wav', chmura: false },
    // 🇬🇧 SuperVoice — WYŁĄCZNIE angielski (ich README, wers 11). Osobny przewód,
    // żeby nikt nie wrzucił mu polskiego zdania i nie dziwił się akcentem.
    'supervoice-en': { mime: 'audio/wav', ext: 'wav', chmura: false },
    'klon-lokalny': { mime: 'audio/wav', ext: 'wav', chmura: false },
    'kokoro-tts': { mime: 'audio/wav', ext: 'wav', chmura: false },
    'elevenlabs-mcp': { mime: 'audio/mpeg', ext: 'mp3', chmura: true },
};

/** Domyślny adres lokalnego Kokoro (obraz `kokoro-fastapi` trzyma się tego portu). */
export const KOKORO_BASE_DOMYSLNY = 'http://127.0.0.1:8880';

/** Model ElevenLabs z polskim — `multilingual_v2` jest tu jedynym sensownym domyślnym. */
const ELEVEN_MODEL = 'eleven_multilingual_v2';
const ELEVEN_API = 'https://api.elevenlabs.io/v1';

/** Czasy — synteza potrafi mielić, ale wieczności nie czekamy. */
const TIMEOUT_LOKALNY = 120_000;
const TIMEOUT_CHMURA = 60_000;

/**
 * Cudzy komunikat błędu bywa echem żądania — a w żądaniu do chmury jest klucz.
 * Przycinamy i wycinamy wszystko, co wygląda jak sekret.
 */
function bezSekretow(tekst, limit = 300) {
    return String(tekst ?? '')
        .replace(/sk[-_][A-Za-z0-9_-]{8,}/g, '[klucz]')
        .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[klucz]')
        .replace(/(xi-api-key|authorization|api[_-]?key)\s*[:=]\s*\S+/gi, '$1: [klucz]')
        .slice(0, limit);
}

async function pobierzZLimitem(url, init, ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try { return await fetch(url, { ...init, signal: c.signal }); }
    finally { clearTimeout(t); }
}

// ── TOR 1: lokalny klon (XTTS / OpenVoice) ────────────────────────────────────

async function torKlonLokalny({ tekst, jezyk, probka, base }) {
    let r;
    try {
        r = await pobierzZLimitem(`${base}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: tekst,
                speaker_wav: probka && fsSync.existsSync(probka) ? probka : undefined,
                language: jezyk || 'pl',
            }),
        }, TIMEOUT_LOKALNY);
    } catch (e) {
        throw new BladPrzewodu(
            `Lokalny silnik klonu (${base}) nie odpowiedział (${e.name === 'AbortError' ? 'przekroczony czas' : e.message}). ` +
            'Nic nie zabrzmiało — odpal XTTS/OpenVoice albo wybierz inny przewód.',
            424, 'klon-lokalny');
    }
    if (!r.ok) {
        throw new BladPrzewodu(
            `Lokalny silnik klonu odrzucił żądanie (HTTP ${r.status}): ${bezSekretow(await r.text().catch(() => ''))}`,
            502, 'klon-lokalny');
    }
    return Buffer.from(await r.arrayBuffer());
}

// ── TOR 2: Kokoro TTS (lokalny, API zgodne z OpenAI) ──────────────────────────

/**
 * Kokoro wystawia `/v1/audio/speech` w konwencji OpenAI. Nazwy głosów są jego
 * własne (`af_heart`, `pf_dora` itd.) — jeśli profil wskazuje głos, którego
 * Kokoro nie zna, serwer odpowiada błędem i my go pokazujemy, zamiast po cichu
 * podstawiać inny głos.
 */
async function torKokoro({ tekst, glos, base }) {
    let r;
    try {
        r = await pobierzZLimitem(`${base}/v1/audio/speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'kokoro',
                input: tekst,
                voice: glos || 'af_heart',
                response_format: 'wav',
            }),
        }, TIMEOUT_LOKALNY);
    } catch (e) {
        throw new BladPrzewodu(
            `Kokoro TTS (${base}) nie odpowiedziało (${e.name === 'AbortError' ? 'przekroczony czas' : e.message}). ` +
            'Nic nie zabrzmiało — uruchom serwer Kokoro albo wybierz inny przewód.',
            424, 'kokoro-tts');
    }
    if (!r.ok) {
        throw new BladPrzewodu(
            `Kokoro odrzuciło żądanie (HTTP ${r.status}): ${bezSekretow(await r.text().catch(() => ''))}`,
            502, 'kokoro-tts');
    }
    return Buffer.from(await r.arrayBuffer());
}

// ── TOR 3: ElevenLabs (chmura — kosztuje kredyty Suwerena) ────────────────────

async function torElevenLabs({ tekst, glos, klucz }) {
    if (!klucz) {
        throw new BladPrzewodu(
            'Brak klucza ElevenLabs w Skarbcu 0.00G (elevenlabs.api_key). Nic nie zostało wysłane ani wypowiedziane.',
            424, 'elevenlabs-mcp');
    }
    if (!glos) {
        throw new BladPrzewodu(
            'Profil nie wskazuje głosu ElevenLabs (voiceId). Nie zgaduję — wybierz głos z listy /api/voice/elevenlabs/glosy.',
            400, 'elevenlabs-mcp');
    }

    let r;
    try {
        r = await pobierzZLimitem(`${ELEVEN_API}/text-to-speech/${encodeURIComponent(glos)}`, {
            method: 'POST',
            headers: { 'xi-api-key': klucz, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
            body: JSON.stringify({
                text: tekst,
                model_id: ELEVEN_MODEL,
                voice_settings: { stability: 0.4, similarity_boost: 0.8 },
            }),
        }, TIMEOUT_CHMURA);
    } catch (e) {
        throw new BladPrzewodu(
            `ElevenLabs nie odpowiedziało (${e.name === 'AbortError' ? 'przekroczony czas' : e.message}). Nic nie zabrzmiało.`,
            504, 'elevenlabs-mcp');
    }

    if (r.status === 401) {
        throw new BladPrzewodu('ElevenLabs odrzuciło klucz (401). Sprawdź elevenlabs.api_key w Skarbcu 0.00G.', 401, 'elevenlabs-mcp');
    }
    if (r.status === 429) {
        throw new BladPrzewodu('ElevenLabs: wyczerpany limit / kredyty (429). Nic nie zostało wygenerowane.', 429, 'elevenlabs-mcp');
    }
    if (!r.ok) {
        throw new BladPrzewodu(
            `ElevenLabs odrzuciło żądanie (HTTP ${r.status}): ${bezSekretow(await r.text().catch(() => ''))}`,
            502, 'elevenlabs-mcp');
    }
    return Buffer.from(await r.arrayBuffer());
}

/** Lista głosów konta ElevenLabs — do wyboru w panelu, zamiast wklepywania ID z palca. */
export async function glosyElevenLabs(klucz) {
    if (!klucz) throw new BladPrzewodu('Brak klucza ElevenLabs w Skarbcu 0.00G (elevenlabs.api_key).', 424, 'elevenlabs-mcp');
    let r;
    try {
        r = await pobierzZLimitem(`${ELEVEN_API}/voices`, { headers: { 'xi-api-key': klucz } }, TIMEOUT_CHMURA);
    } catch (e) {
        throw new BladPrzewodu(`ElevenLabs nie odpowiedziało (${e.message}).`, 504, 'elevenlabs-mcp');
    }
    if (r.status === 401) throw new BladPrzewodu('ElevenLabs odrzuciło klucz (401).', 401, 'elevenlabs-mcp');
    if (!r.ok) throw new BladPrzewodu(`ElevenLabs: HTTP ${r.status}.`, 502, 'elevenlabs-mcp');

    const d = await r.json().catch(() => ({}));
    return (d.voices ?? []).map(v => ({
        id: v.voice_id,
        nazwa: v.name,
        kategoria: v.category ?? null,
        opis: v.description ?? null,
    }));
}

// ── WSPÓLNY WJAZD ─────────────────────────────────────────────────────────────

/**
 * Zamienia tekst w dźwięk wskazanym przewodem.
 *
 * @returns {Promise<{audio: Buffer, mime: string, ext: string, przewod: string}>}
 * @throws {BladPrzewodu} zawsze z `status` i zdaniem mówiącym, co poszło nie tak.
 */
/** Katalog wag Pipera i interpreter — oba nadpisywalne z env. */
export const PIPER_GLOSY = process.env.OTAKOS_PIPER_GLOSY
    || path.join(process.cwd(), '_OtakOs_Voice', 'piper');
const PIPER_PYTHON = process.env.OTAKOS_PIPER_PYTHON
    || path.join('C:', 'OpenMontage', '.venv', 'Scripts', 'python.exe');

export const PIPER_DOMYSLNY = 'pl_PL-gosia-medium';

/** Jakie polskie głosy realnie leżą na dysku. Bez zmyślania listy. */
export async function glosyPiper() {
    try {
        const pliki = await fsp.readdir(PIPER_GLOSY);
        return pliki.filter(f => f.endsWith('.onnx')).map(f => f.replace(/\.onnx$/, ''));
    } catch {
        return [];
    }
}

/**
 * Piper: tekst na stdin, WAV do pliku, plik z powrotem jako bufor.
 * Piper nie umie pisać na stdout w tej wersji, więc idziemy przez plik tymczasowy
 * i sprzątamy po sobie.
 */
/** Ostatnia niepusta linia stderr — po niej najlatwiej poznac, co Piperowi nie pasowalo. */
const ostatniaLinia = (t) => String(t || '')
    .split(/[\r\n]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .pop() || '';

async function torPiper({ tekst, glos }) {
    const dostepne = await glosyPiper();
    if (!dostepne.length) {
        throw new BladPrzewodu(
            `Brak wag Pipera w ${PIPER_GLOSY}. Pobierz głos pl_PL z rhasspy/piper-voices.`,
            424, 'piper-pl');
    }
    const wybrany = dostepne.includes(glos) ? glos
        : (dostepne.includes(PIPER_DOMYSLNY) ? PIPER_DOMYSLNY : dostepne[0]);
    const model = path.join(PIPER_GLOSY, `${wybrany}.onnx`);
    const wyjscie = path.join(os.tmpdir(), `piper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);

    await new Promise((resolve, reject) => {
        const dziecko = spawn(PIPER_PYTHON, ['-m', 'piper', '--model', model, '--output_file', wyjscie], {
            windowsHide: true,
        });
        let blad = '';
        dziecko.stderr.on('data', d => { blad = (blad + d.toString()).slice(-800); });
        dziecko.on('error', e => reject(new BladPrzewodu(`Piper nie wstał: ${e.message}`, 424, 'piper-pl')));
        dziecko.on('close', kod => kod === 0
            ? resolve()
            : reject(new BladPrzewodu(`Piper zakonczyl sie kodem ${kod}. ${ostatniaLinia(blad)}`, 502, 'piper-pl')));
        dziecko.stdin.write(tekst);
        dziecko.stdin.end();
    });

    try {
        return await fsp.readFile(wyjscie);
    } finally {
        fsp.unlink(wyjscie).catch(() => { /* i tak zniknie z tempu */ });
    }
}

/** Katalog SuperVoice i jego interpreter — poza Katedrą, bo torch ma głębokie ścieżki. */
const SUPERVOICE_KORZEN = process.env.OTAKOS_SUPERVOICE || path.join('C:', 'SuperVoice');
const SUPERVOICE_PYTHON = path.join(SUPERVOICE_KORZEN, '.venv', 'Scripts', 'python.exe');
const SUPERVOICE_SKRYPT = path.join(SUPERVOICE_KORZEN, 'syntezuj.py');

export const SUPERVOICE_GLOSY = ['voice_1', 'voice_2', 'voice_3'];
export const SUPERVOICE_DOMYSLNY = 'voice_2';

/**
 * SuperVoice: angielski, na GPU. Ładowanie modeli to ~9 s przy każdym wywołaniu,
 * synteza zdania ~15 s — dlatego limit czasu jest hojny. Na CPU liczy ~4× wolniej.
 */
async function torSuperVoice({ tekst, glos }) {
    if (!fsSync.existsSync(SUPERVOICE_SKRYPT)) {
        throw new BladPrzewodu(
            `Brak SuperVoice w ${SUPERVOICE_KORZEN}. Ten przewód mówi tylko po angielsku i wymaga PyTorcha.`,
            424, 'supervoice-en');
    }
    const wybrany = SUPERVOICE_GLOSY.includes(glos) ? glos : SUPERVOICE_DOMYSLNY;
    const wyjscie = path.join(os.tmpdir(), `sv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);

    await new Promise((resolve, reject) => {
        const dziecko = spawn(SUPERVOICE_PYTHON, [
            SUPERVOICE_SKRYPT, '--text', tekst, '--voice', wybrany, '--out', wyjscie, '--device', 'cuda',
        ], { windowsHide: true });
        let blad = '';
        dziecko.stderr.on('data', d => { blad = (blad + d.toString()).slice(-1200); });
        dziecko.on('error', e => reject(new BladPrzewodu(`SuperVoice nie wstał: ${e.message}`, 424, 'supervoice-en')));
        dziecko.on('close', kod => kod === 0
            ? resolve()
            : reject(new BladPrzewodu(`SuperVoice zakończył się kodem ${kod}. ${ostatniaLinia(blad)}`, 502, 'supervoice-en')));
    });

    try {
        return await fsp.readFile(wyjscie);
    } finally {
        fsp.unlink(wyjscie).catch(() => { /* temp i tak zniknie */ });
    }
}

export async function syntezuj({ przewod, tekst, glos, jezyk = 'pl', probka = null, adresy = {}, klucz = null }) {
    const tresc = String(tekst ?? '').trim();
    if (!tresc) throw new BladPrzewodu('Brak tekstu do wypowiedzenia.', 400, przewod);

    const def = SILNIKI[przewod];
    if (!def) {
        throw new BladPrzewodu(
            `Przewód „${przewod}" nie ma sterownika. Dostępne: ${Object.keys(SILNIKI).join(', ')}.`,
            501, przewod);
    }

    let audio;
    if (przewod === 'piper-pl') {
        audio = await torPiper({ tekst: tresc, glos });
    } else if (przewod === 'supervoice-en') {
        audio = await torSuperVoice({ tekst: tresc, glos });
    } else if (przewod === 'klon-lokalny') {
        audio = await torKlonLokalny({ tekst: tresc, jezyk, probka, base: adresy.VOICE_BASE });
    } else if (przewod === 'kokoro-tts') {
        audio = await torKokoro({ tekst: tresc, glos, base: adresy.KOKORO_BASE ?? KOKORO_BASE_DOMYSLNY });
    } else {
        audio = await torElevenLabs({ tekst: tresc, glos, klucz });
    }

    if (!audio?.length) {
        throw new BladPrzewodu(`Przewód „${przewod}" zwrócił pusty dźwięk. Plik NIE powstał.`, 502, przewod);
    }
    return { audio, mime: def.mime, ext: def.ext, przewod };
}

export default { SILNIKI, KOKORO_BASE_DOMYSLNY, BladPrzewodu, syntezuj, glosyElevenLabs, glosyPiper, PIPER_GLOSY, PIPER_DOMYSLNY, SUPERVOICE_GLOSY, SUPERVOICE_DOMYSLNY };
