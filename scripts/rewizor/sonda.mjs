/**
 * 🩺 Rewizor Mostu — sonda żywa (0.00G)
 *
 * Puka do DZIAŁAJĄCEGO mostu (domyślnie http://127.0.0.1:3001) i sprawdza,
 * które trasy odpowiadają, które leżą, a które milczą.
 *
 * ZASADA BEZPIECZEŃSTWA: sonda wysyła WYŁĄCZNIE żądania GET, WYŁĄCZNIE na trasy
 * bez parametrów, i pomija te, które wyglądają na ruchliwe — po nazwie albo po
 * tym, co robi ich kod (zapis pliku, uruchomienie procesu, wywołanie sieci).
 * To heurystyka, nie dowód: trasa może zawołać serwis, który coś zapisuje,
 * a Rewizor tego nie zobaczy. Dlatego lista pominiętych jest zawsze drukowana.
 */

/** Nazwy tras, których sonda nie dotyka nigdy. */
const NIE_RUSZAJ = [
    /\/auth\//,          // przekierowania logowania
    /\/klucz/,           // sekrety (klucz Straży) — nawet do odczytu nie ma po co
    /selftest/,          // testy kryptografii — ciężkie, nie do sondowania
    /random/,            // losowanie z efektem ubocznym
    /\/(start|stop|odpal|uruchom|zatrzymaj|pull|render|wykuj|buduj|generuj|zapisz|usun|reset)(\/|$)/,
];

/** Ślady ruchliwego kodu w ciele obsługi trasy. */
const RUCHLIWY_KOD = /\b(writeFile|appendFile|unlink|rm|rmdir|mkdir|rename|spawn|exec|execFile|execAsync|execFileAsync|fetch|axios|pull|zapisz\w*|usun\w*|odpal\w*|uruchom\w*)\s*\(/;

/**
 * Ciało obsługi każdej trasy: tekst od rejestracji do następnego `app.<metoda>(`.
 * @param {string} zrodlo pełny wiesio-bridge.js
 * @param {{ linia:number }[]} trasy z wyciagnijTrasy
 */
function cialaTras(zrodlo, trasy) {
    const linie = zrodlo.split('\n');
    const posortowane = [...trasy].sort((a, b) => a.linia - b.linia);
    const ciala = new Map();
    posortowane.forEach((t, i) => {
        const koniec = posortowane[i + 1]?.linia ?? t.linia + 80;
        ciala.set(t, linie.slice(t.linia - 1, Math.min(koniec - 1, t.linia + 200)).join('\n'));
    });
    return ciala;
}

/**
 * Podział tras GET bez parametrów na: do sondowania / pominięte (z powodem).
 */
export function planSondy(zrodlo, trasy) {
    const ciala = cialaTras(zrodlo, trasy);
    const sondowane = [], pominiete = [];
    const widziane = new Set();
    for (const t of trasy) {
        if (t.metoda !== 'get' || t.prefiks || t.sciezka.includes(':')) continue;
        if (widziane.has(t.sciezka)) continue;           // duplikat — i tak odpowiada pierwsza kopia
        widziane.add(t.sciezka);
        const nazwa = NIE_RUSZAJ.find((re) => re.test(t.sciezka));
        if (nazwa) { pominiete.push({ ...t, powod: `nazwa (${nazwa.source})` }); continue; }
        const slad = ciala.get(t).match(RUCHLIWY_KOD);
        if (slad) { pominiete.push({ ...t, powod: `kod woła ${slad[1]}()` }); continue; }
        sondowane.push(t);
    }
    return { sondowane, pominiete };
}

/**
 * Werdykt dla jednej odpowiedzi.
 * 404 ma dwa znaczenia: Express „Cannot GET" (trasy NIE MA w działającym procesie)
 * albo obsługa trasy mówi „nie ma danych" (JSON) — to drugie jest zdrowe.
 */
export function werdykt(status, { expressNieZna = false } = {}) {
    if (status === null) return 'MILCZY';
    if (status >= 200 && status < 400) return 'ZYWA';
    if (status === 401 || status === 403) return 'ZAMKNIETA';
    if (status === 404) return expressNieZna ? 'ZNIKNELA' : 'BRAK_DANYCH';
    if (status >= 400 && status < 500) return 'ODMAWIA';
    if (status === 502 || status === 503 || status === 504) return 'ZALEZNOSC_SPI';
    return 'AWARIA';
}

/** Werdykty, które oznaczają, że most ma problem (nie że czegoś brakuje w zapytaniu). */
export const PORAZKI = new Set(['MILCZY', 'ZNIKNELA', 'AWARIA']);

/**
 * Jedno pukanie. Czyta tylko nagłówki — strumień (SSE) odcinamy od razu.
 * @returns {Promise<{ status:number|null, ms:number, blad?:string }>}
 */
async function puknij(url, ms) {
    const start = performance.now();
    const ctrl = new AbortController();
    const zegar = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(url, { signal: ctrl.signal, redirect: 'manual' });
        const czas = Math.round(performance.now() - start);
        // Ciało czytamy tylko przy 404 z HTML-em — żeby odróżnić „Cannot GET" Expressa.
        let expressNieZna = false;
        if (r.status === 404 && /text\/html/.test(r.headers.get('content-type') || '')) {
            expressNieZna = /Cannot GET/.test(await r.text());
        }
        ctrl.abort();                                   // reszty (np. strumienia SSE) nie czytamy
        return { status: r.status, ms: czas, expressNieZna };
    } catch (e) {
        return { status: null, ms: Math.round(performance.now() - start), blad: e.name === 'AbortError' ? `brak odpowiedzi w ${ms} ms` : (e.cause?.code || e.message) };
    } finally {
        clearTimeout(zegar);
    }
}

/**
 * Sonda całego planu. Najpierw `/wiesio/ping` — jeśli most nie żyje, nie ma czego badać.
 * @param {{ baza:string, trasy:object[], limitMs?:number, rownolegle?:number }} o
 */
export async function sonduj({ baza, trasy, limitMs = 8000, rownolegle = 4 }) {
    const ping = await puknij(`${baza}/wiesio/ping`, 3000);
    if (ping.status === null) return { mostZyje: false, blad: ping.blad, wyniki: [] };

    const wyniki = [];
    const kolejka = [...trasy];
    const robotnik = async () => {
        for (let t = kolejka.shift(); t; t = kolejka.shift()) {
            const r = await puknij(`${baza}${t.sciezka}`, limitMs);
            wyniki.push({ ...t, ...r, werdykt: werdykt(r.status, r) });
        }
    };
    await Promise.all(Array.from({ length: rownolegle }, robotnik));
    wyniki.sort((a, b) => a.sciezka.localeCompare(b.sciezka));
    return { mostZyje: true, wyniki };
}
