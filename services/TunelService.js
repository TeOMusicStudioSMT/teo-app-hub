/**
 * 🌀 TunelService — Kwantowy Tunel: publiczny adres maszyny Suwerena (Etap 3).
 *
 * Twilio nie zadzwoni do `127.0.0.1`. Żeby rozmowa dwustronna w ogóle mogła
 * ruszyć, Katedra musi mieć adres widoczny z internetu (Cloudflare Tunnel,
 * ngrok, własna domena). Ten plik trzyma ten adres i pilnuje, żeby był sensowny.
 *
 * ⚠️ TO JEST NAJNIEBEZPIECZNIEJSZY PLIK W CAŁYM MODULE, i tak został napisany:
 *
 *  1. TUNEL OTWIERA MASZYNĘ SUWERENA NA ŚWIAT. Dlatego adres nie „wpina się"
 *     sam z żadnej zmiennej środowiskowej ani z pliku, który mógłby przyjechać
 *     z paczką — musi zostać ustawiony świadomie, jednym wywołaniem.
 *  2. TYLKO HTTPS/WSS. Adres `http://` odpadałby na pierwszym połączeniu
 *     (Twilio wymaga TLS), ale przede wszystkim niósłby ruch głosowy jawnym
 *     tekstem przez cudze sieci.
 *  3. ŻADNEGO LOCALHOSTA I ADRESÓW PRYWATNYCH. Wpisanie `127.0.0.1` albo
 *     `192.168.x.x` wygląda jak konfiguracja, a jest cichą awarią: Twilio
 *     dostanie adres, pod który nigdy się nie dodzwoni.
 *  4. KAŻDA ROZMOWA MA WŁASNY BILET. Sam adres tunelu nie wystarcza do wejścia
 *     na kanał audio — `nowyBilet()` wydaje jednorazowy token na jedno
 *     połączenie. Bez tego publiczny WSS byłby otwartym mikrofonem dla
 *     każdego, kto zgadnie ścieżkę.
 *
 * Standard ESM · zapis atomowy.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const NAZWA_PLIKU = 'tunel.json';

/** Ile żyje bilet na kanał audio, jeśli rozmowa nie ruszy. */
const WAZNOSC_BILETU_MS = 10 * 60 * 1000;

/** Adresy, które wyglądają jak konfiguracja, a są cichą awarią. */
const PRYWATNE = [
    /^localhost$/i,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /\.local$/i,
];

export class BladTunelu extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'BladTunelu';
        this.status = status;
    }
}

function sciezka(katalog) { return path.join(katalog, NAZWA_PLIKU); }

/**
 * Sprawdza i normalizuje adres tunelu. Zwraca postać `https://host[/sciezka]`
 * bez końcowego ukośnika — reszta systemu dokleja do niej ścieżki.
 */
export function sprawdzAdres(adres) {
    const surowy = String(adres ?? '').trim();
    if (!surowy) throw new BladTunelu('Pusty adres tunelu.');

    let u;
    try { u = new URL(surowy); }
    catch { throw new BladTunelu(`„${surowy}" nie jest adresem URL.`); }

    if (!['https:', 'wss:'].includes(u.protocol)) {
        throw new BladTunelu(
            `Tunel musi być na HTTPS albo WSS (dostałem „${u.protocol}//"). Twilio nie przyjmie zwykłego HTTP, ` +
            'a ruch głosowy szedłby jawnym tekstem przez cudze sieci.');
    }
    if (PRYWATNE.some(re => re.test(u.hostname))) {
        throw new BladTunelu(
            `„${u.hostname}" to adres lokalny — Twilio nigdy się pod niego nie dodzwoni. ` +
            'Podaj adres publiczny (Cloudflare Tunnel, ngrok, własna domena).');
    }

    const baza = `https://${u.host}${u.pathname.replace(/\/+$/, '')}`;
    return {
        baza,
        wss: `wss://${u.host}${u.pathname.replace(/\/+$/, '')}`,
        host: u.host,
    };
}

export async function wczytaj(katalog) {
    try {
        const d = JSON.parse(await fs.readFile(sciezka(katalog), 'utf8'));
        return {
            adres: d.adres ?? null,
            wss: d.wss ?? null,
            host: d.host ?? null,
            ustawiony: d.ustawiony ?? null,
            opis: d.opis ?? '',
        };
    } catch { return { adres: null, wss: null, host: null, ustawiony: null, opis: '' }; }
}

async function zapisz(katalog, dane) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    const cel = sciezka(katalog);
    const tmp = cel + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

export async function ustaw(katalog, adres, opis = '') {
    const { baza, wss, host } = sprawdzAdres(adres);
    const dane = { adres: baza, wss, host, ustawiony: new Date().toISOString(), opis: String(opis).slice(0, 200) };
    await zapisz(katalog, dane);
    console.log(`[Tunel] 🌀 Kwantowy Tunel wpięty: ${baza}`);
    return dane;
}

export async function zdejmij(katalog) {
    await zapisz(katalog, { adres: null, wss: null, host: null, ustawiony: null, opis: '' });
    console.log('[Tunel] 🌀 Kwantowy Tunel odpięty — połączenia dwustronne wyłączone.');
    return { odpiety: true };
}

/**
 * Czy tunel realnie odpowiada. Wpisany adres i adres DZIAŁAJĄCY to dwie różne
 * rzeczy — tunel potrafi paść bez uprzedzenia i wtedy telefon dzwoni w pustkę.
 */
export async function czyZywy(adres, ms = 4000) {
    if (!adres) return { zywy: false, powod: 'Tunel nie jest ustawiony.' };
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
        const r = await fetch(`${adres}/wiesio/ping`, { signal: c.signal });
        const ok = r.ok;
        return {
            zywy: ok,
            status: r.status,
            powod: ok ? null : `Tunel odpowiedział HTTP ${r.status} — prowadzi gdzie indziej niż do tego mostu.`,
        };
    } catch (e) {
        return { zywy: false, powod: `Tunel nie odpowiedział (${e.name === 'AbortError' ? 'przekroczony czas' : e.message}).` };
    } finally { clearTimeout(t); }
}

// ── BILETY NA KANAŁ AUDIO ─────────────────────────────────────────────────────

/**
 * Jednorazowe bilety wstępu na `/api/voice/stream`.
 *
 * Publiczny WSS bez biletu to otwarty mikrofon i otwarty rachunek dla każdego,
 * kto zgadnie ścieżkę. Bilet jest wydawany na JEDNO połączenie, zużywa się przy
 * wejściu i przeterminowuje, jeśli rozmowa nie ruszy.
 */
const bilety = new Map();

export function nowyBilet(dane = {}) {
    const token = crypto.randomBytes(24).toString('base64url');
    bilety.set(token, { ...dane, wydany: Date.now(), zuzyty: false });
    // Sprzątanie przy okazji — bez osobnego timera, który trzymałby proces.
    for (const [k, v] of bilety) {
        if (Date.now() - v.wydany > WAZNOSC_BILETU_MS) bilety.delete(k);
    }
    return token;
}

/** Zużywa bilet. Zwraca dane rozmowy albo `null`, gdy biletu nie ma / wygasł. */
export function zuzyjBilet(token) {
    const b = bilety.get(String(token ?? ''));
    if (!b) return null;
    if (b.zuzyty) return null;
    if (Date.now() - b.wydany > WAZNOSC_BILETU_MS) { bilety.delete(token); return null; }
    b.zuzyty = true;
    return b;
}

export function biletowWObiegu() {
    return [...bilety.values()].filter(b => !b.zuzyty).length;
}

export default {
    BladTunelu, sprawdzAdres, wczytaj, ustaw, zdejmij, czyZywy,
    nowyBilet, zuzyjBilet, biletowWObiegu,
};
