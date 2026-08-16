/**
 * 🌌 universa — klient Rejestru Modułów i Wypraw.
 *
 * Zastępuje makietę: zakładka „Universes" miała wymyślone aktywa, liczniki
 * wpisane na sztywno i przycisk wpłaty bez obsługi kliknięcia.
 *
 * Każdy ruch GRV idzie przez most i księgę z pieczęcią łańcucha. Liczniki
 * wypraw są SUMOWANE po stronie mostu z realnych wpłat — front ich nie ustawia
 * i nie potrafiłby, nawet gdyby chciał.
 */

const MOST = 'http://127.0.0.1:3001';

export interface Modul {
    id: string;
    nazwa: string;
    opis: string;
    ikona: string;
    kategoria: 'kreacja' | 'wiedza' | 'zabawa' | 'narzedzie';
    url: string | null;
    cenaGRV: number;
    autor?: string;
    wbudowany: boolean;
    subskrybowany: boolean;
    subskrybentow: number;
}

export interface Wyprawa {
    id: string;
    nazwa: string;
    opis: string;
    ikona: string;
    celGRV: number;
    autor: string;
    zebraneGRV: number;
    wplat: number;
    wspierajacych: number;
    postep: number;
}

export interface StanRejestru {
    modulowWbudowanych: number;
    modulowDodanych: number;
    subskrypcji: number;
    wypraw: number;
    wplat: number;
    grvWeWyprawach: number;
}

async function zawolaj<T>(sciezka: string, init?: RequestInit): Promise<T> {
    let odp: Response;
    try {
        odp = await fetch(`${MOST}${sciezka}`, {
            ...init,
            headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
        });
    } catch {
        throw new Error('Most (127.0.0.1:3001) milczy — odpal Katedrę.');
    }
    const d = await odp.json().catch(() => ({}));
    if (!odp.ok || (d as any)?.success === false) {
        throw new Error((d as any)?.message || `Most odpowiedział HTTP ${odp.status}`);
    }
    return d as T;
}

// ── Moduły ────────────────────────────────────────────────────────────────────
export const pobierzModuly = (wezel: string) =>
    zawolaj<{ moduly: Modul[]; stan: StanRejestru; skarbiec: string }>(
        `/api/moduly?wezel=${encodeURIComponent(wezel)}`);

export const dodajModul = (dane: Partial<Modul> & { autor: string }) =>
    zawolaj<{ modul: Modul }>('/api/moduly', { method: 'POST', body: JSON.stringify(dane) }).then(d => d.modul);

export const usunModul = (id: string) =>
    zawolaj<{ modul: Modul }>(`/api/moduly/${id}`, { method: 'DELETE' });

export const subskrybuj = (id: string, wezel: string) =>
    zawolaj<{ zaplacono: number; przelew: unknown }>(`/api/moduly/${id}/subskrybuj`, {
        method: 'POST', body: JSON.stringify({ wezel }),
    });

export const anuluj = (id: string, wezel: string) =>
    zawolaj<{ uwaga: string }>(`/api/moduly/${id}/subskrypcja?wezel=${encodeURIComponent(wezel)}`, { method: 'DELETE' });

// ── Wyprawy ───────────────────────────────────────────────────────────────────
export const pobierzWyprawy = () =>
    zawolaj<{ wyprawy: Wyprawa[] }>('/api/wyprawy').then(d => d.wyprawy);

export const dodajWyprawe = (dane: { nazwa: string; opis?: string; ikona?: string; celGRV: number; autor: string }) =>
    zawolaj<{ wyprawa: Wyprawa }>('/api/wyprawy', { method: 'POST', body: JSON.stringify(dane) }).then(d => d.wyprawa);

export const wplac = (id: string, wezel: string, grv: number) =>
    zawolaj<{ wyprawa: Wyprawa }>(`/api/wyprawy/${id}/wplac`, {
        method: 'POST', body: JSON.stringify({ wezel, grv }),
    });

// ── GRV ───────────────────────────────────────────────────────────────────────
export interface Wezel { id: string; grv: number | 'INFINITE'; role: string; tier: string | null }

export const saldoWezla = (id: string) =>
    zawolaj<Wezel>(`/api/grv/${encodeURIComponent(id)}`);

/** Integralność łańcucha — do 2026-08-15 ten punkt był MARTWY (przechwytywał go `/api/grv/:id`). */
export const integralnoscKsiegi = () =>
    zawolaj<{ ok: boolean; length: number }>('/api/grv/verify');

/** Węzeł Suwerena. Księga zna go pod tym imieniem — nie po adresie portfela. */
export const MOJ_WEZEL = 'Mistrz Arkadiusz';
