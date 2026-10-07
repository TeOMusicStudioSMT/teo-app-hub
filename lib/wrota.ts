/**
 * 🚪 WROTA — jedno źródło prawdy o studiach Katedry.
 *
 * Suweren: „kafelki w dashboardzie synchronizuj z kafelkami w Universe… ustaw
 * tym z Universe, by się otwierały w nowym oknie".
 *
 * ⚠️ DLACZEGO JEDEN PLIK. Dashboard miał 4 kafelki (ze swoim `launchStudio`),
 * Universes miało 5 (ze swoim `wejdz`) — dwie listy, dwa mechanizmy, i po kilku
 * tygodniach każda znała inne studia: dashboard nie widział Games ani LaB,
 * Universes nie widziało Fashion. Dwie kopie jednej listy ZAWSZE się rozjeżdżają.
 * Teraz obie strony mapują tę samą tablicę STUDIA.
 *
 * ⚠️ DWA SPOSOBY OTWIERANIA — od 2026-10-07 w PIERŚCIENIU APEK (to samo okno, koło z boku;
 * lib/pierscien.ts), nowa karta tylko z wyboru (localStorage otakos_apki_okno = 'nowe'):
 *   · `dev`     — most odpala lokalny serwer dev (/api/launch) i otwiera port;
 *                 tak działają studia rozwijane na tej maszynie.
 *   · `most`    — statyczny build serwowany przez most pod /apps/…; działa też
 *                 na pendrivie, gdzie nie ma serwerów dev.
 *   Fashion nie ma buildu na moście (chodzi na własnym Expressie), więc TYLKO dev.
 */

import { getBridgeBase } from './bridgeService';
import { otworzApke } from './pierscien';

export type IdStudia = 'story' | 'music' | 'app' | 'games' | 'fashion' | 'lab';

export interface Studio {
    id: IdStudia;
    tytul: string;
    podtytul: string;
    /** Klucz w LAUNCH_APPS mostu (dla trybu dev). */
    apka: 'story' | 'music' | 'app' | 'games' | 'fashion' | 'lab';
    port: number;
    /** Ścieżka statycznego buildu na moście; brak = tylko dev. */
    naMoscie?: string;
    hash?: string;
    kolor: 'purple' | 'pink' | 'cyan' | 'green' | 'blue';
}

export const STUDIA: Studio[] = [
    { id: 'story',   tytul: 'TeO Story Studio',   podtytul: 'Narracje. Reżyser. Tablica Produkcji.',        apka: 'story',   port: 5174, naMoscie: '/apps/story/', kolor: 'purple' },
    { id: 'music',   tytul: 'TeO Music Studio',   podtytul: 'Rezonans harmoniczny. Synteza dźwięku.',       apka: 'music',   port: 5173, naMoscie: '/apps/music/', kolor: 'pink' },
    { id: 'app',     tytul: 'TeO App Studio',     podtytul: 'Narzędzia. Kod. Rzeczywistość.',               apka: 'app',     port: 5175, naMoscie: '/apps/app/',   kolor: 'cyan' },
    { id: 'games',   tytul: 'TeO Games Studio',   podtytul: 'Galeria gier. Forge silników. Agenci światów.', apka: 'games',   port: 5177, naMoscie: '/apps/games/', kolor: 'green' },
    { id: 'fashion', tytul: 'TeO Fashion Studio',  podtytul: 'Kreacje z kadrów Katedry.',                     apka: 'fashion', port: 3000, kolor: 'pink' },
    // 🧪 Od 2026-09-12 własne studio (było komponentem Story): printy z lokalnego modelu,
    // piaskownica Nocnej Zmiany, arena TeOgochi, projekt chipów.
    { id: 'lab',     tytul: 'TeO Lab Studio',     podtytul: 'Printy. Piaskownica Nocnej Zmiany. Arena. Chipy.', apka: 'lab',     port: 5178, naMoscie: '/apps/lab/',   kolor: 'blue' },
];

/** Klucz Gemini jedzie w adresie: substrona ma inny origin i nie widzi pamięci Huba. */
function zKluczem(url: string): string {
    let klucz = '';
    try { klucz = localStorage.getItem('teo_gemini_key') || ''; } catch { /* prywatne okno */ }
    return klucz ? `${url}${url.includes('?') ? '&' : '?'}gemini_key=${encodeURIComponent(klucz)}` : url;
}

/**
 * Tryb Huba (CLOUD / JusT) dla studia, które umie go przyjąć — Fashion: `?tryb=chmura|lokalnie`
 * (Suweren 2026-10-07: „lokalnie, a z chmury będzie korzystał, jak się przełączy na chmurę").
 */
function zTrybem(s: Studio): string {
    if (s.id !== 'fashion') return '';
    let tryb = '';
    try { tryb = localStorage.getItem('teo_ai_mode') || ''; } catch { /* prywatne okno */ }
    return `?tryb=${/local/.test(tryb) ? 'lokalnie' : /cloud/.test(tryb) ? 'chmura' : 'lokalnie'}`;
}

/**
 * Tryb DEV: poproś most o odpalenie studia, otwórz w pierścieniu apek.
 * Gdy most milczy — otwieramy port wprost; jeśli studio już chodzi, zadziała.
 */
export async function odpalStudio(s: Studio): Promise<void> {
    const fallback = `http://localhost:${s.port}/${zTrybem(s)}${s.hash ?? ''}`;
    try {
        const r = await fetch('http://127.0.0.1:3001/api/launch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: s.apka }),
        });
        const d = await r.json();
        const url = `${d.url || `http://localhost:${s.port}`}/${zTrybem(s)}${s.hash ?? ''}`;
        // Most odpowiada dopiero, gdy świeżo odpalone studio wstało (`ready`) — bez zgadywania sekund.
        otworzApke({ id: s.id, tytul: s.tytul, url });
    } catch {
        otworzApke({ id: s.id, tytul: s.tytul, url: fallback });
    }
}

/** Tryb MOST: statyczny build spod /apps/…. Działa i na pendrivie. */
export function otworzNaMoscie(s: Studio): void {
    if (!s.naMoscie) { void odpalStudio(s); return; }
    const baza = getBridgeBase().replace(/\/+$/, '');
    otworzApke({ id: s.id, tytul: s.tytul, url: zKluczem(`${baza}${s.naMoscie}`) + (s.hash ?? '') });
}
