/**
 * ☁️/🏠 Tryb Katedry w Hubie — przełącznik CLOUD / JusT mówi MOSTOWI (services/TrybKatedry.js), a ten
 * przełącza całą Katedrę (wszystkie wywołania Ollamy: czat, stado, Kodeks, Kustosz, Tłumacz…).
 * Most jest źródłem prawdy: Hub przy starcie i co minutę bierze stan z mostu.
 */
import { getBridgeBase } from './bridgeService';

export interface StanTrybu {
    tryb: 'lokalnie' | 'chmura';
    dostawca: 'auto' | 'anthropic' | 'gemini';
    model: string | null;
    limitTokenow: number;
    dzis: { dzien: string; tokeny: number; wywolan: number };
    chmuraAktywna: boolean;
    powod: string | null;
    wybrany: string | null;
    ostatniBlad: { kiedy: string; tekst: string } | null;
}

const adres = () => `${getBridgeBase().replace(/\/+$/, '')}/api/tryb`;

/** Ostatni znany stan — przekierowanie w przeglądarce decyduje po nim bez pytania mostu przy każdym wywołaniu. */
let biezacy: StanTrybu | null = null;

export async function pobierzTryb(): Promise<StanTrybu | null> {
    try { const r = await fetch(adres()); biezacy = r.ok ? ((await r.json()) as StanTrybu) : biezacy; return r.ok ? biezacy : null; } catch { return null; }
}

/**
 * Hub woła Ollamę prosto z przeglądarki (router czatu, Orb, Stół Narad, Studio…). W trybie CLOUD te wywołania
 * (`/api/generate`, `/api/chat`, bez obrazów i narzędzi) idą przez most — on zna klucze i Tryb Katedry.
 * Montowane raz, w index.tsx.
 */
export function zainstalujPrzekierowanie(): void {
    const w = window as unknown as { __trybKatedry?: boolean };
    if (w.__trybKatedry) return;
    w.__trybKatedry = true;
    const oryginal = window.fetch.bind(window);
    window.fetch = async (wejscie: RequestInfo | URL, init?: RequestInit) => {
        const url = String(wejscie instanceof Request ? wejscie.url : wejscie);
        const m = url.match(/^https?:\/\/(?:127\.0\.0\.1|localhost):11434\/api\/(generate|chat)\b/);
        if (m && biezacy?.tryb === 'chmura' && String(init?.method || 'GET').toUpperCase() === 'POST' && typeof init?.body === 'string' && !/"(images|tools)"\s*:\s*\[\s*[^\]\s]/.test(init.body)) {
            return oryginal(`${getBridgeBase().replace(/\/+$/, '')}/api/tryb/ollama/${m[1]}`, init);
        }
        return oryginal(wejscie, init);
    };
    void pobierzTryb();
    setInterval(() => { void pobierzTryb(); }, 60_000);
}

export async function ustawTryb(zmiana: Partial<Pick<StanTrybu, 'tryb' | 'dostawca' | 'model' | 'limitTokenow'>>): Promise<StanTrybu> {
    const r = await fetch(adres(), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(zmiana) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d as { message?: string }).message || `HTTP ${r.status}`);
    biezacy = d as StanTrybu;
    return biezacy;
}

/** Krótki opis dla nagłówka: co naprawdę liczy i ile dziś zjadło. */
export function opisTrybu(s: StanTrybu | null): string {
    if (!s) return 'most milczy — tryb nieznany';
    const tok = s.dzis.tokeny >= 1000 ? `${Math.round(s.dzis.tokeny / 1000)}k` : String(s.dzis.tokeny);
    if (s.tryb === 'lokalnie') return '🏠 cała Katedra lokalnie (Ollama)';
    if (!s.chmuraAktywna) return `⚠ ${s.powod ?? 'chmura niedostępna'}`;
    return `☁️ ${s.wybrany ?? 'chmura'} · dziś ${tok} tok.${s.limitTokenow ? ` / ${Math.round(s.limitTokenow / 1000)}k` : ''}${s.ostatniBlad ? ` · ostatni błąd: ${s.ostatniBlad.tekst.slice(0, 60)}` : ''}`;
}
