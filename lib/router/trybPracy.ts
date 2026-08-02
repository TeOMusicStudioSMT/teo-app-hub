/**
 * 🎛️ trybPracy — JEDNO źródło prawdy o tym, kto odpowiada w Katedrze.
 *
 * PROBLEM, KTÓRY ROZWIĄZUJE (zgłoszony przez Suwerena): model dało się przełączać
 * w czterech miejscach — Field Control, KatedraChat, TerminalZero i panel podcastu —
 * a każde pisało do `localStorage` na własną rękę. Panele w tej samej karcie nie
 * widziały nawzajem swoich zmian, bo `atomWithStorage` nie dostaje zdarzenia
 * `storage` przy zapisie z tego samego dokumentu. Stąd „nie wiem, gdzie włączyć,
 * jak nie działa" — bo widoczny stan bywał nieprawdą.
 *
 * DODATKOWO: przełącznik `JusT / Resonance / Active` w Field Control NIE dotyczy
 * modeli — to `electricBorderAtom`, czyli natężenie efektu obramowania. Suweren
 * brał go za wybór chmura/lokal i słusznie się gubił. Prawdziwy tryb pracy mieszka
 * tutaj i nazywa się po ludzku.
 */

export type TrybPracy = 'lokal' | 'chmura' | 'hybryda';

export const KLUCZ_TRYBU = 'otakos_tryb_pracy';
export const KLUCZ_MODELU_LOKALNEGO = 'otakos_active_model';
export const KLUCZ_MODELU_CHMURY_SZYBKI = 'otakos_cloud_fast_model';
export const KLUCZ_MODELU_CHMURY_CIEZKI = 'otakos_cloud_heavy_model';

/** Zdarzenie rozgłaszane po każdej zmianie — to ono trzyma panele w zgodzie. */
export const ZDARZENIE_ZMIANY = 'otakos:rdzen-zmiana';

export const OPIS_TRYBU: Record<TrybPracy, { etykieta: string; ikona: string; opis: string }> = {
    lokal: {
        etykieta: 'LOKAL', ikona: '🏠',
        opis: 'Tylko Ollama na tej maszynie. Zero chmury, zero kosztów, zero telemetrii. Gdy model milczy — Katedra milczy.',
    },
    chmura: {
        etykieta: 'CHMURA', ikona: '☁️',
        opis: 'Tylko model chmurowy. Najmocniejszy, ale zużywa tokeny i wymaga sieci. Awaria = brak odpowiedzi.',
    },
    hybryda: {
        etykieta: 'HYBRYDA', ikona: '⚡',
        opis: 'Najpierw chmura, a gdy padnie lub przekroczy limit czasu — Dyrygent przerzuca pytanie na lokalny rdzeń. Odpowiedź przychodzi zawsze, gdy stoi choć jedna strona.',
    },
};

const czyPrzegladarka = () => typeof window !== 'undefined';

function czytaj(klucz: string, domyslny: string): string {
    if (!czyPrzegladarka()) return domyslny;
    try { return (localStorage.getItem(klucz) || '').trim() || domyslny; } catch { return domyslny; }
}

/**
 * Zapis + rozgłoszenie. KAŻDA zmiana rdzenia ma iść tędy — dzięki temu wszystkie
 * panele odświeżają się natychmiast, zamiast pokazywać nieaktualny stan do F5.
 */
function zapisz(klucz: string, wartosc: string): void {
    if (!czyPrzegladarka()) return;
    try { localStorage.setItem(klucz, wartosc); } catch { /* storage zablokowany */ }
    try { window.dispatchEvent(new CustomEvent(ZDARZENIE_ZMIANY, { detail: { klucz, wartosc } })); } catch { /* SSR */ }
}

export const getTryb = (): TrybPracy => {
    const t = czytaj(KLUCZ_TRYBU, 'hybryda');
    return t === 'lokal' || t === 'chmura' || t === 'hybryda' ? t : 'hybryda';
};
export const setTryb = (t: TrybPracy): TrybPracy => { zapisz(KLUCZ_TRYBU, t); return t; };

export const getModelLokalny = (): string => czytaj(KLUCZ_MODELU_LOKALNEGO, 'gemma4:e2b');
export const setModelLokalny = (m: string): string => { zapisz(KLUCZ_MODELU_LOKALNEGO, m); return m; };

export const getModelChmuryLekki = (): string => czytaj(KLUCZ_MODELU_CHMURY_SZYBKI, 'claude-haiku-4-5');
export const setModelChmuryLekki = (m: string): string => { zapisz(KLUCZ_MODELU_CHMURY_SZYBKI, m); return m; };

export const getModelChmuryCiezki = (): string => czytaj(KLUCZ_MODELU_CHMURY_CIEZKI, 'claude-opus-5');
export const setModelChmuryCiezki = (m: string): string => { zapisz(KLUCZ_MODELU_CHMURY_CIEZKI, m); return m; };

/** Subskrypcja zmian — także tych z INNEJ karty (zdarzenie `storage`). */
export function nasluchujZmian(cb: () => void): () => void {
    if (!czyPrzegladarka()) return () => {};
    const lokalne = () => cb();
    const zInnejKarty = (e: StorageEvent) => {
        if (!e.key || e.key.startsWith('otakos_')) cb();
    };
    window.addEventListener(ZDARZENIE_ZMIANY, lokalne);
    window.addEventListener('storage', zInnejKarty);
    return () => {
        window.removeEventListener(ZDARZENIE_ZMIANY, lokalne);
        window.removeEventListener('storage', zInnejKarty);
    };
}

/**
 * Kto realnie odpowie na następne pytanie — do pokazania Suwerenowi wprost.
 * `aromat` to wejście dla `ApiDyrygent.dispatchWithFallback`: `'ollama'` wymusza
 * tor lokalny, cokolwiek innego idzie najpierw do chmury.
 */
export function ktoOdpowiada(tryb: TrybPracy = getTryb()): {
    opis: string; aromat: 'ollama' | 'chmura'; zapasowy: string | null;
} {
    const lokalny = getModelLokalny();
    const chmurowy = getModelChmuryCiezki();
    if (tryb === 'lokal')  return { opis: lokalny,  aromat: 'ollama', zapasowy: null };
    if (tryb === 'chmura') return { opis: chmurowy, aromat: 'chmura', zapasowy: null };
    return { opis: chmurowy, aromat: 'chmura', zapasowy: lokalny };
}

export default {
    getTryb, setTryb, getModelLokalny, setModelLokalny,
    getModelChmuryLekki, setModelChmuryLekki, getModelChmuryCiezki, setModelChmuryCiezki,
    nasluchujZmian, ktoOdpowiada, OPIS_TRYBU, ZDARZENIE_ZMIANY,
};
