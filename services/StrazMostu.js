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
];

/** Czy żądanie przyszło z tej samej maszyny. */
export function czyLokalny(req) {
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
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
export function strazMostu({ klucz, pelnyTunel = false }) {
    return (req, res, next) => {
        req.lokalny = czyLokalny(req);
        if (req.lokalny) return next();          // własna maszyna — bez zmian

        // ── Żądanie spoza maszyny: najpierw klucz ──
        const podany = req.get(NAGLOWEK_KLUCZA) || req.query?.[PARAM_KLUCZA];
        if (!rowneStale(podany, klucz())) {
            console.warn(`[Straż] ⛔ Odrzucone zdalne żądanie bez klucza: ${req.method} ${req.path}`);
            return res.status(401).json({
                success: false,
                blad: 'BRAK_KLUCZA',
                message: 'Żądanie spoza maszyny Suwerena wymaga klucza sesji. ' +
                         'Otwórz Katedrę linkiem dispatchowym z Kwantowego Tunelu.',
            });
        }

        // ── Klucz poprawny, ale zasięg zdalny jest węższy niż lokalny ──
        if (!pelnyTunel) {
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

export default { strazMostu, czyLokalny, wczytajLubUtworzKlucz, przekujKlucz, NAGLOWEK_KLUCZA, PARAM_KLUCZA };
