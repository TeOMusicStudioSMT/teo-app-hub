/**
 * 🔴 liveCallService.ts — podgląd i sterowanie rozmową na żywo (Etap 3).
 *
 * Most nadaje przebieg rozmowy strumieniem SSE (`/api/voice/live`): transkrypcję
 * obu stron, zmiany trybu, latencje i naliczone GRV. Panel tylko go słucha —
 * nie liczy, nie zgaduje i niczego nie dopisuje od siebie.
 *
 * ⚠️ DWIE RZECZY, KTÓRE MUSZĄ TU ZOSTAĆ TAKIE, JAKIE SĄ:
 *
 *  1. `EventSource` SAM SIĘ WZNAWIA po zerwaniu — i to jest pożądane, bo most
 *     bywa restartowany w trakcie pracy. Ale wznowienie NIE odtwarza zdarzeń
 *     sprzed przerwy, więc panel po każdym połączeniu dociąga stan rozmów
 *     osobnym zapytaniem. Sam strumień to nie jest źródło prawdy o stanie.
 *  2. Przejęcie i rozłączenie idą przez POST, nie przez strumień. Strumień jest
 *     jednokierunkowy z założenia — mikrofon Suwerena to osobna, świadoma akcja.
 */

const MOST = 'http://127.0.0.1:3001';

export type TypZdarzeniaLive =
    | 'polaczono' | 'start' | 'stop' | 'odmowa'
    | 'transkrypt' | 'myslimy' | 'mowimy' | 'sluchamy' | 'cisza' | 'przerwane'
    | 'minuta' | 'grv' | 'latencja' | 'blad'
    | 'przejecie' | 'oddanie' | 'rozlaczenie' | 'dtmf';

export interface ZdarzenieLive {
    typ: TypZdarzeniaLive;
    callSid?: string;
    kiedy?: number;
    /** transkrypt: kto mówił. */
    rola?: 'klient' | 'ai' | 'suweren';
    tekst?: string;
    ms?: number;
    minuta?: number;
    grv?: number;
    powod?: string | null;
    message?: string;
    biznes?: string | null;
    biznesId?: string | null;
    kierunek?: 'wychodzace' | 'przychodzace';
    sekundy?: number;
    tur?: number;
    latencje?: Latencje;
    rozmowy?: StanRozmowy[];
}

export interface Latencje {
    stt: number | null;
    llm: number | null;
    tts: number | null;
    tura: number | null;
}

export interface StanRozmowy {
    callSid: string | null;
    streamSid: string | null;
    biznesId: string | null;
    kierunek: 'wychodzace' | 'przychodzace';
    /** `sluchamy` | `myslimy` | `mowimy` | `suweren` */
    tryb: string;
    zywa: boolean;
    odMs: number;
    minut: number;
    tur: number;
    latencje: Latencje;
    historia: { rola: string; tekst: string; kiedy: number }[];
}

export interface StanTunelu {
    adres: string | null;
    wss: string | null;
    host: string | null;
    ustawiony: string | null;
    opis: string;
    /** `null`, gdy nie sprawdzano. Wpisany adres to nie to samo, co działający. */
    zywy: boolean | null;
    powod?: string | null;
    biletow: number;
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
    const d = await odp.json().catch(() => ({} as any));
    if (!odp.ok || (d as any)?.success === false) {
        throw new Error((d as any)?.message || `Most odpowiedział HTTP ${odp.status}`);
    }
    return d as T;
}

// ── Strumień zdarzeń ──────────────────────────────────────────────────────────

/**
 * Podpina się pod strumień rozmów. Zwraca funkcję odpinającą — wołaj ją
 * w sprzątaniu efektu, bo porzucony `EventSource` wisi i wznawia się w tle.
 */
export function sluchajLive(naZdarzenie: (ev: ZdarzenieLive) => void): () => void {
    let es: EventSource | null = null;
    try {
        es = new EventSource(`${MOST}/api/voice/live`);
    } catch {
        return () => { /* przeglądarka bez SSE — panel działa dalej, tylko bez podglądu */ };
    }

    es.onmessage = (m) => {
        try { naZdarzenie(JSON.parse(m.data)); } catch { /* niepełna ramka — pomijamy */ }
    };
    // Bez `onerror` EventSource i tak wznawia; logujemy tylko po to, żeby cisza
    // w panelu miała ślad w konsoli.
    es.onerror = () => { /* wznowi się sam */ };

    return () => { try { es?.close(); } catch { /* noop */ } };
}

export const pobierzRozmowy = () =>
    zawolaj<{ rozmowy: StanRozmowy[]; sluchaczy: number }>('/api/voice/live/rozmowy');

// ── Mikrofon Suwerena ─────────────────────────────────────────────────────────

/** Przejmuje rozmowę: AI milknie, a podany tekst (jeśli jest) idzie w słuchawkę. */
export const przejmijRozmowe = (callSid: string, tekst?: string) =>
    zawolaj<{ stan: StanRozmowy }>(`/api/voice/live/${encodeURIComponent(callSid)}/przejmij`, {
        method: 'POST', body: JSON.stringify({ tekst: tekst ?? null }),
    }).then(d => d.stan);

/** Oddaje mikrofon AI. Nigdy nie dzieje się samo — po przejęciu AI milczy do odwołania. */
export const oddajRozmowe = (callSid: string) =>
    zawolaj<{ stan: StanRozmowy }>(`/api/voice/live/${encodeURIComponent(callSid)}/oddaj`, { method: 'POST' })
        .then(d => d.stan);

export const rozlaczRozmowe = (callSid: string, powod?: string) =>
    zawolaj<{ rozlaczone: boolean; powod: string }>(`/api/voice/live/${encodeURIComponent(callSid)}/rozlacz`, {
        method: 'POST', body: JSON.stringify({ powod }),
    });

// ── Kwantowy Tunel ────────────────────────────────────────────────────────────

export const stanTunelu = (sprawdz = true) =>
    zawolaj<StanTunelu & { success: true }>(`/api/tunel${sprawdz ? '' : '?sprawdz=0'}`);

export const ustawTunel = (adres: string, opis?: string) =>
    zawolaj<StanTunelu & { success: true }>('/api/tunel', {
        method: 'POST', body: JSON.stringify({ adres, opis }),
    });

export const zdejmijTunel = () =>
    zawolaj<{ odpiety: boolean }>('/api/tunel', { method: 'DELETE' });

export default {
    sluchajLive, pobierzRozmowy,
    przejmijRozmowe, oddajRozmowe, rozlaczRozmowe,
    stanTunelu, ustawTunel, zdejmijTunel,
};
