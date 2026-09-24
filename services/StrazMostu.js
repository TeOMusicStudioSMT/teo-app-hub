/**
 * 🛡️ StrazMostu — autoryzacja i ograniczenie zasięgu Wiesio-Bridge (0.00G)
 *
 * PROBLEM, KTÓRY ROZWIĄZUJE: Most nie miał ŻADNEJ kontroli — każde żądanie było
 * równe, a wystawia `EXEC_SYSTEM_CMD` (dowolna komenda PowerShell) i `WRITE_FILE`.
 * Przy otwartym Kwantowym Tunelu ktokolwiek znający adres miał zdalne wykonanie
 * kodu na maszynie Suwerena — obok `identity.json`, walleta i `.env`.
 *
 * DWIE WARSTWY, CELOWO NIEZALEŻNE:
 *
 *  1. KLUCZ SESJI — żądanie spoza maszyny musi go podać. Odcina skanery,
 *     przypadkowych gości i boty pukające po adresach *.trycloudflare.com.
 *
 *  2. OGRANICZENIE ZASIĘGU — nawet Z POPRAWNYM KLUCZEM żądanie zdalne nie
 *     uruchomi komendy systemowej ani nie zapisze pliku. To jest ta ważniejsza
 *     warstwa: kod QR NIESIE klucz, więc zdjęcie ekranu = wyciek klucza.
 *     Bez drugiej warstwy wyciek QR znaczyłby przejęcie maszyny; z nią znaczy
 *     tyle, że ktoś obcy może przełączyć Suwerenowi utwór w radiu.
 *
 * Maszyna Suwerena (localhost) działa jak dotąd — bez klucza, bez ograniczeń.
 * Kto siedzi przy klawiaturze, ma i tak pełny dostęp do systemu.
 */

import crypto from 'crypto';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

/** Plik klucza. Rozszerzenie `.key` jest już objęte `.gitignore` (`*.key`). */
const PLIK_KLUCZA = 'straz_mostu.key';

/** Nazwa nagłówka i parametru — parametr przydaje się dla <audio>/<img>, gdzie nagłówka nie da się dołożyć. */
export const NAGLOWEK_KLUCZA = 'x-teo-klucz';
export const PARAM_KLUCZA = 'k';

/**
 * Akcje, których żądanie ZDALNE nie wykona nigdy — nawet z poprawnym kluczem.
 * Lista jest jawna i konserwatywna: jak coś zapisuje, uruchamia albo kasuje, to tu jest.
 */
export const AKCJE_TYLKO_LOKALNE = new Set([
    'EXEC_SYSTEM', 'EXEC_SYSTEM_CMD', 'EXEC_COMMAND', 'EXEC_OLLAMA_CLI',
    'WRITE_FILE', 'WRITE_FILE_CONTENT', 'APPEND_CHUNK',
    'DELETE_LOCAL_PREMIERE', 'LIST_MOVE',
    'SAVE_KRONIKA', 'SAVE_METADATA', 'SAVE_PODCAT', 'SAVE_SONIC_VECTORS',
    'MCP_UI_BUILD', 'FINISH_PODCAT',
]);

/**
 * Ścieżki REST, których żądanie ZDALNE nie dotknie (dopasowanie po prefiksie).
 * Mechanik stosuje łatki do kodu, kuźnie zapisują pliki, głos klonuje próbki —
 * to wszystko należy do maszyny, nie do tunelu.
 */
export const SCIEZKI_TYLKO_LOKALNE = [
    '/api/mechanic/apply', '/api/mechanic/enqueue', '/api/mechanic/reject',
    '/api/forge/', '/api/gameforge/', '/api/voice/clone',
    '/api/teledysk/render', '/api/video/edit', '/api/chaos/inject',
    '/api/straz/',
    '/api/tunel/',   // tunelu nie odpala się (ani nie gasi) z tunelu
    '/api/system/free',   // zamyka procesy na maszynie
    // Stado należy do Katedry: telefon (StoL) PATRZY — nie publikuje migawki, nie paruje
    // innych urządzeń i nie odłącza ich. Jego jedyne zdalne wejście to /api/stado/paruj.
    '/api/stado/publikuj', '/api/stado/parowanie', '/api/stado/odlacz',
    '/api/stado/projekt/', '/api/stado/model',   // zakładanie projektów stada i zmiana silników — decyzje Suwerena przy maszynie
];

/**
 * Publiczne strony Suwerena, które w JEGO przeglądarce czytają żywe dane z mostu
 * (teo.center: stan Katedry i playlista radia; otakos.wtf: mapa AGI na żywo).
 * Dostają ZASIĘG ZDALNY bez klucza: czytać tak, uruchamiać i zapisywać nie.
 * Dopisanie kolejnej: zmienna środowiskowa OTAKOS_ZAUFANE_ORIGINY="https://a.pl,https://b.pl".
 */
export const ZAUFANE_PUBLICZNE = ['https://otakos.wtf', 'https://www.otakos.wtf', 'https://teo.center', 'https://www.teo.center'];

/**
 * Strona publiczna nie niesie klucza, więc dostaje BIAŁĄ listę, nie czarną: odczyt (GET/HEAD)
 * i te akcje Śluzy, których te strony naprawdę używają. Czarna lista zasięgu zdalnego jest dobra
 * dla tunelu z kluczem — tu byłaby o jedno przeoczenie od dziury (patrz /api/system/free).
 */
export const AKCJE_STRON_PUBLICZNYCH = new Set(['GET_LOCAL_PLAYLIST']);

const HOST_MASZYNY = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const IP_PETLI = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

/** Origin z nagłówka Origin, a gdy go brak (np. <audio src>, <img>) — z Referera. */
function originZadania(req) {
    const o = req.get?.('origin');
    if (o) return o;
    const ref = req.get?.('referer');
    if (!ref) return null;
    try { return new URL(ref).origin; } catch { return null; }
}

/**
 * Skąd przyszło żądanie:
 *  · 'maszyna'   — Hub i substrony z localhost/127.0.0.1 albo narzędzia bez przeglądarki
 *                  (curl, serwisy Node, agenci). Pełny dostęp, bez klucza — jak dotąd.
 *  · 'publiczne' — zaufana publiczna strona Suwerena w jego przeglądarce: bez klucza,
 *                  ale tylko zasięg zdalny (bez komend i zapisu).
 *  · 'obce'      — przeglądarka na TEJ maszynie, ale żądanie wysłała obca strona.
 *  · 'zdalne'    — spoza maszyny (tunel, sieć lokalna).
 *
 * ⚠️ DZIURA ZAŁATANA 2026-09-24: dotąd „lokalne" znaczyło „gniazdo 127.0.0.1", a CORS odbijał
 * każdy origin. Dowolna strona otwarta w przeglądarce Suwerena mogła więc wołać most jak
 * właściciel — łącznie z EXEC_SYSTEM_CMD — a formularz HTML wysyła POST nawet bez preflightu,
 * więc samo CORS niczego tu nie broni. Teraz o „maszynie" decyduje też, KTO wysłał żądanie.
 * Przy okazji: nagłówek Host musi wskazywać maszynę — inaczej to DNS rebinding
 * (obca domena przestawiona na 127.0.0.1 udaje ten sam origin).
 */
export function zrodloZadania(req, { zaufane = ZAUFANE_PUBLICZNE } = {}) {
    // cloudflared działa NA TEJ MASZYNIE i łączy się z mostem z 127.0.0.1 — ale dokłada
    // nagłówki Cloudflare. Kto je ma, jest zdalny, choćby gniazdo mówiło 127.0.0.1
    // (zmierzone 2026-09-17: /api/tunel/stan z internetu → 200 zamiast 403).
    if (req.get?.('cf-connecting-ip') || req.get?.('x-forwarded-for') || req.get?.('cf-ray')) return 'zdalne';
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    if (!IP_PETLI.has(ip)) return 'zdalne';
    const host = req.get?.('host');
    if (host && !HOST_MASZYNY.test(host)) return 'obce';
    const origin = originZadania(req);
    if (!origin) {
        // Brak Origin i Referera: curl, Node, agenci — chyba że przeglądarka sama mówi „cross-site".
        return req.get?.('sec-fetch-site') === 'cross-site' ? 'obce' : 'maszyna';
    }
    let url;
    try { url = new URL(origin); } catch { return 'obce'; }   // „null" (file://, sandbox) też tu ląduje
    if (/^https?:$/.test(url.protocol) && HOST_MASZYNY.test(url.host)) return 'maszyna';
    if (zaufane.includes(url.origin)) return 'publiczne';
    return 'obce';
}

/** Czy żądanie ma pełne prawa maszyny Suwerena (zgodność wstecz — tak jak dawniej `req.lokalny`). */
export function czyLokalny(req, o) {
    return zrodloZadania(req, o) === 'maszyna';
}

/** Wczytaj klucz z dysku albo utwórz nowy przy pierwszym starcie. */
export function wczytajLubUtworzKlucz(katalog) {
    const sciezka = path.join(katalog, PLIK_KLUCZA);
    try {
        const k = fsSync.readFileSync(sciezka, 'utf8').trim();
        if (k.length >= 32) return k;
    } catch { /* brak pliku — tworzymy niżej */ }

    const nowy = crypto.randomBytes(24).toString('hex');   // 48 znaków
    fsSync.mkdirSync(katalog, { recursive: true });
    fsSync.writeFileSync(sciezka, nowy, 'utf8');
    console.log(`[Straż] 🔑 Utworzono nowy klucz sesji (${PLIK_KLUCZA}). Poza repozytorium.`);
    return nowy;
}

/** Wymiana klucza — unieważnia wszystkie stare linki i kody QR. */
export async function przekujKlucz(katalog) {
    const nowy = crypto.randomBytes(24).toString('hex');
    await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(path.join(katalog, PLIK_KLUCZA), nowy, 'utf8');
    console.log('[Straż] 🔄 Klucz przekuty — poprzednie kody QR i linki są martwe.');
    return nowy;
}

/** Porównanie odporne na atak czasowy. */
function rowneStale(a, b) {
    const x = Buffer.from(String(a || ''), 'utf8');
    const y = Buffer.from(String(b || ''), 'utf8');
    if (x.length !== y.length) return false;
    return crypto.timingSafeEqual(x, y);
}

/**
 * Middleware Straży. Wpiąć PO parserach ciała, PRZED trasami.
 * @param {{ klucz:() => string, pelnyTunel?:boolean }} opcje
 */
export function strazMostu({ klucz, pelnyTunel = false, zaufane = null }) {
    const lista = zaufane ?? [...ZAUFANE_PUBLICZNE, ...String(process.env.OTAKOS_ZAUFANE_ORIGINY || '').split(',').map((x) => x.trim()).filter(Boolean)];
    return (req, res, next) => {
        req.zrodlo = zrodloZadania(req, { zaufane: lista });
        req.lokalny = req.zrodlo === 'maszyna';
        if (req.lokalny) return next();          // własna maszyna — bez zmian

        // ── Żądanie spoza maszyny (albo od obcej strony): najpierw klucz ──
        // Zaufana publiczna strona Suwerena klucza nie niesie — przechodzi dalej, ale tylko
        // w zasięgu zdalnym (niżej): czytać może, uruchamiać i zapisywać nie.
        const podany = req.get(NAGLOWEK_KLUCZA) || req.query?.[PARAM_KLUCZA];
        if (req.zrodlo !== 'publiczne' && !rowneStale(podany, klucz())) {
            console.warn(`[Straż] ⛔ Odrzucone ${req.zrodlo === 'obce' ? 'żądanie obcej strony' : 'zdalne żądanie'} bez klucza: ${req.method} ${req.path}${req.get('origin') ? ` (origin ${req.get('origin')})` : ''}`);
            return res.status(401).json({
                success: false,
                blad: 'BRAK_KLUCZA',
                message: 'Żądanie spoza maszyny Suwerena wymaga klucza sesji. ' +
                         'Otwórz Katedrę linkiem dispatchowym z Kwantowego Tunelu.',
            });
        }

        // ── Zaufana strona publiczna: tylko biała lista ──
        if (req.zrodlo === 'publiczne') {
            const odczyt = req.method === 'GET' || req.method === 'HEAD';
            const akcja = String(req.body?.action || '').toUpperCase();
            const sluzaDoOdczytu = req.method === 'POST' && req.path === '/api/bridge/execute' && AKCJE_STRON_PUBLICZNYCH.has(akcja);
            if (!odczyt && !sluzaDoOdczytu) {
                console.warn(`[Straż] ⛔ Strona publiczna ${req.get('origin') || ''} chciała ${req.method} ${req.path}${akcja ? ` (${akcja})` : ''} — tylko odczyt.`);
                return res.status(403).json({
                    success: false, blad: 'TYLKO_ODCZYT',
                    message: 'Strona publiczna może z mostu tylko czytać. Zmiany robi się z Katedry na maszynie Suwerena.',
                });
            }
        }

        // ── Klucz poprawny (albo zaufana strona), ale zasięg zdalny jest węższy niż lokalny ──
        // Pełny tunel (OTAKOS_TUNEL_PELNY=1) dotyczy tylko tunelu z kluczem — nie stron publicznych.
        if (!pelnyTunel || req.zrodlo === 'publiczne') {
            const sciezkaZakazana = SCIEZKI_TYLKO_LOKALNE.some(p => req.path.startsWith(p));
            if (sciezkaZakazana) {
                console.warn(`[Straż] ⛔ Ścieżka tylko lokalna, żądanie zdalne odrzucone: ${req.path}`);
                return res.status(403).json({
                    success: false, blad: 'TYLKO_LOKALNIE',
                    message: `Ścieżka "${req.path}" działa wyłącznie z maszyny Suwerena.`,
                });
            }
            const akcja = String(req.body?.action || req.body?.command || '').toUpperCase();
            if (akcja && AKCJE_TYLKO_LOKALNE.has(akcja)) {
                console.warn(`[Straż] ⛔ Akcja tylko lokalna, żądanie zdalne odrzucone: ${akcja}`);
                return res.status(403).json({
                    success: false, blad: 'TYLKO_LOKALNIE',
                    message: `Akcja "${akcja}" zapisuje lub uruchamia rzeczy na maszynie — ` +
                             'z tunelu jest niedostępna, nawet z poprawnym kluczem.',
                });
            }
        }
        return next();
    };
}

export default { strazMostu, czyLokalny, zrodloZadania, ZAUFANE_PUBLICZNE, AKCJE_STRON_PUBLICZNYCH, wczytajLubUtworzKlucz, przekujKlucz, NAGLOWEK_KLUCZA, PARAM_KLUCZA };
