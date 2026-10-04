/**
 * 🪪 Mój węzeł w księdze GRV TEJ Katedry — właściciel (services/KsiegaTozsamosc.js, `GET /api/grv/ja`).
 *
 * Dawniej Hub wpisywał na sztywno „Mistrz Arkadiusz” — w każdej rozdanej Katedrze. Suweren (2026-10-04): „JA to
 * tylko Jeden Jestem”. Klucz węzła (unikalny, np. `wezel-1a2b3c4d`; na głównym węźle „Mistrz Arkadiusz”) trzymamy
 * w localStorage `otakos_wezel_grv`, nazwę wyświetlaną w `otakos_sovereign_name`. Źródłem prawdy jest księga —
 * `zsynchronizujWezel()` (start Huba, Onboarding) dociąga oba. Pusty klucz = most sam weźmie właściciela.
 */
const MOST = 'http://127.0.0.1:3001';
const KLUCZ = 'otakos_wezel_grv';
const NAZWA = 'otakos_sovereign_name';

export const mojWezel = (): string => { try { return localStorage.getItem(KLUCZ) || ''; } catch { return ''; } };
export const mojaNazwa = (): string => { try { return localStorage.getItem(NAZWA) || mojWezel(); } catch { return mojWezel(); } };

export function zapamietajWezel(id: string, nazwa?: string | null) {
    try { localStorage.setItem(KLUCZ, id); if (nazwa) localStorage.setItem(NAZWA, nazwa); } catch { /* prywatne okno */ }
}

export interface WezelKsiegi { id: string; nazwa: string; grv: number | string; tier: string | null }
/** Skarbiec i właściciel z księgi; zapamiętuje właściciela. null = most śpi. */
export async function zsynchronizujWezel(): Promise<{ zarzadca: WezelKsiegi | null; wlasciciel: WezelKsiegi | null } | null> {
    try {
        const d = await (await fetch(`${MOST}/api/grv/ja`)).json();
        if (!d?.success) return null;
        if (d.wlasciciel?.id) zapamietajWezel(d.wlasciciel.id, d.wlasciciel.nazwa);
        return { zarzadca: d.zarzadca ?? null, wlasciciel: d.wlasciciel ?? null };
    } catch { return null; }
}

/** Zmiana nazwy wyświetlanej (klucz w księdze zostaje). */
export async function zmienNazwe(id: string, nazwa: string) {
    const r = await fetch(`${MOST}/api/grv/nazwa`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nazwa }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    if (id === mojWezel()) zapamietajWezel(id, d.nazwa);
    return d as { id: string; nazwa: string };
}
