/**
 * 🧠 Mózg Katedry po stronie Huba — jedna rura do mostu (services/MozgKatedry.js, `GET|PUT /api/mozg`).
 *
 * Dotąd model wybierało się w trzech miejscach głównego studia (Sterowanie Rdzeniem, ustawienia czatu, Terminal Zero),
 * każde zapisywało tylko localStorage przeglądarki, a most o tym nie wiedział — zadania mostu (Reżyser, Joanna,
 * Kronikarz…) szły na jego własnym, wpisanym na sztywno modelu. Teraz:
 *  · przy starcie Huba `zsynchronizujMozg()` przepisuje prawdę z mostu do localStorage (stare klucze zostają — czyta je
 *    reszta Huba),
 *  · każda zmiana idzie przez `ustawMozg()`: most (źródło prawdy) → localStorage → zdarzenie dla paneli,
 *  · jedno miejsce wyboru: TeO-Sim → 🧠 Mózg Katedry (`otworzMozg()` otwiera je z każdego miejsca Huba).
 */
import { ZDARZENIE_ZMIANY } from './router/trybPracy';

const MOST = 'http://127.0.0.1:3001';
export const KLUCZE = {
    lokalny: 'otakos_active_model',
    lokalnyCiezki: 'otakos_heavy_model',
    chmuraLekki: 'otakos_cloud_fast_model',
    chmuraCiezki: 'otakos_cloud_heavy_model',
} as const;
export type PoleMozgu = keyof typeof KLUCZE;
export const ZDARZENIE_OTWORZ = 'otakos:otworz-mozg';

export interface MozgMostu { lokalny?: string; lokalnyCiezki?: string; chmuraLekki?: string; chmuraCiezki?: string; domyslny: string; zrodlo: string; zapas: string }

function doPamieci(pole: PoleMozgu, wartosc: string): void {
    try {
        if (wartosc) localStorage.setItem(KLUCZE[pole], wartosc); else localStorage.removeItem(KLUCZE[pole]);
        window.dispatchEvent(new CustomEvent(ZDARZENIE_ZMIANY, { detail: { klucz: KLUCZE[pole], wartosc } }));
    } catch { /* bez pamięci przeglądarki */ }
}

/** Start Huba: prawda z mostu → localStorage. Most milczy = zostaje to, co w przeglądarce. */
export async function zsynchronizujMozg(): Promise<MozgMostu | null> {
    try {
        const r = await fetch(`${MOST}/api/mozg`, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        if (!d?.success) return null;
        const m = d.mozg as MozgMostu;
        doPamieci('lokalny', m.lokalny || m.domyslny);
        for (const p of ['lokalnyCiezki', 'chmuraLekki', 'chmuraCiezki'] as const) if (m[p]) doPamieci(p, m[p]!);
        return m;
    } catch { return null; }
}

/** Zmiana modelu Katedry: najpierw most (odmowa = błąd wprost, np. Ollama nie ma modelu), potem przeglądarka. */
export async function ustawMozg(zmiany: Partial<Record<PoleMozgu, string>>): Promise<MozgMostu> {
    const r = await fetch(`${MOST}/api/mozg`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(zmiany), signal: AbortSignal.timeout(10000) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.success) throw new Error(d?.message || `most HTTP ${r.status}`);
    for (const [p, v] of Object.entries(zmiany) as [PoleMozgu, string][]) doPamieci(p, p === 'lokalny' ? (v || d.mozg.domyslny) : v);
    return d.mozg as MozgMostu;
}

/** Otwórz jedno miejsce wyboru modeli (TeO-Sim → 🧠 Mózg Katedry). */
export function otworzMozg(): void { try { window.dispatchEvent(new CustomEvent(ZDARZENIE_OTWORZ)); } catch { /* SSR */ } }

export const czytajModel = (pole: PoleMozgu, zapas = ''): string => { try { return localStorage.getItem(KLUCZE[pole]) || zapas; } catch { return zapas; } };
