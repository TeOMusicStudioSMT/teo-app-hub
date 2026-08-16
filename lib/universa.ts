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

// ── 🫁 Ekonomia Oddechu ───────────────────────────────────────────────────────

/** Rodzaje pracy z białej listy mostu. Front nie wymyśli nowego tytułu do wypłaty. */
export type RodzajPracy =
    | 'kadr.dodany' | 'kadr.etap' | 'prompt.zbudowany' | 'wektory.zebrane' | 'fakt.kanon'
    | 'montaz.edl' | 'render.wideo' | 'teoprint' | 'odcinek.domkniety';

export interface StanOddechu {
    wezel: string;
    wDobie: number;
    limit: number;
    pozostalo: number;
    procentDoby: number;
    wdechow: number;
    grvLacznie: number;
    ruchow: number;
    wynikow: number;
    trwalych: number;
    ostatnie: { rodzaj: string; klasa: string; grv: number; kiedy: string }[];
    stawki: { RUCH: number; WYNIK: number };
}

export interface WynikWdechu {
    przyznane: boolean;
    klasa?: 'RUCH' | 'WYNIK';
    stawka?: number;
    opis?: string;
    /** Niepuste, gdy nagrody NIE było — praca już opłacona albo limit dobowy. */
    powod?: string;
    stan?: StanOddechu;
}

/**
 * Zgłoś wykonaną pracę. `klucz` MUSI być stały dla tej samej pracy
 * (np. `kadr:<id>`) — most płaci za dany klucz dokładnie raz.
 *
 * Brak nagrody NIE jest błędem: to normalny wydech (limit dobowy albo
 * praca już rozliczona), więc most odpowiada 200 z powodem.
 */
export const zglosPrace = (
    rodzaj: RodzajPracy,
    klucz: string,
    trwaly?: { nazwa: string; sciezka?: string },
    wezel: string = MOJ_WEZEL,
) => zawolaj<WynikWdechu>('/api/grv/mint-respiration', {
    method: 'POST', body: JSON.stringify({ wezel, rodzaj, klucz, trwaly }),
});

export const stanOddechu = (wezel: string = MOJ_WEZEL) =>
    zawolaj<StanOddechu>(`/api/grv/oddech/${encodeURIComponent(wezel)}`);

export const zasobyTrwale = (wezel: string = MOJ_WEZEL) =>
    zawolaj<{ trwale: { id: string; nazwa: string; rodzaj: string; grv: number; kiedy: string }[] }>(
        `/api/grv/trwale?wezel=${encodeURIComponent(wezel)}`).then(d => d.trwale);

/** Węzeł Suwerena. Księga zna go pod tym imieniem — nie po adresie portfela. */
export const MOJ_WEZEL = 'Mistrz Arkadiusz';
