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
 * ⚠️ DWA SPOSOBY OTWIERANIA, OBA W NOWEJ KARCIE:
 *   · `dev`     — most odpala lokalny serwer dev (/api/launch) i otwiera port;
 *                 tak działają studia rozwijane na tej maszynie.
 *   · `most`    — statyczny build serwowany przez most pod /apps/…; działa też
 *                 na pendrivie, gdzie nie ma serwerów dev.
 *   Fashion nie ma buildu na moście (chodzi na własnym Expressie), więc TYLKO dev.
 */

import { getBridgeBase } from './bridgeService';

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
 * Tryb DEV: poproś most o odpalenie studia, otwórz w NOWEJ KARCIE.
 * Gdy most milczy — otwieramy port wprost; jeśli studio już chodzi, zadziała.
 */
export async function odpalStudio(s: Studio): Promise<void> {
    const fallback = `http://localhost:${s.port}/${s.hash ?? ''}`;
    try {
        const r = await fetch('http://127.0.0.1:3001/api/launch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: s.apka }),
        });
        const d = await r.json();
        const url = `${d.url || `http://localhost:${s.port}`}${s.hash ?? ''}`;
        // Świeżo odpalony serwer potrzebuje chwili; już chodzący — nie.
        setTimeout(() => window.open(url, '_blank', 'noopener'), d.started ? 3500 : 200);
    } catch {
        window.open(fallback, '_blank', 'noopener');
    }
}

/** Tryb MOST: statyczny build spod /apps/…, w NOWEJ KARCIE. Działa i na pendrivie. */
export function otworzNaMoscie(s: Studio): void {
    if (!s.naMoscie) { void odpalStudio(s); return; }
    const baza = getBridgeBase().replace(/\/+$/, '');
    window.open(zKluczem(`${baza}${s.naMoscie}`) + (s.hash ?? ''), '_blank', 'noopener');
}
