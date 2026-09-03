/**
 * 💬 Klient historii czatu.
 *
 * Bazą jest PLIK po stronie mostu (`_OtakOs_Wymiar/czaty.json`), nie pamięć
 * przeglądarki. Dzięki temu rozmowa przeżywa zamknięcie okna, wyczyszczenie
 * danych witryny i przeniesienie Katedry na inną maszynę razem z katalogiem.
 *
 * ⚠️ Gdy most śpi, funkcje zwracają pustkę i mówią o tym wołającemu, zamiast
 * po cichu podstawiać localStorage. Dwa magazyny historii to dwie historie.
 */
const MOST = 'http://127.0.0.1:3001';

export interface WiadomoscZapis {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
}

export interface StreszczenieSesji {
    id: string;
    tytul: string;
    utworzona: number;
    zmieniona: number;
    ile: number;
    uczestnicy: string[];
}

export interface SesjaCzatu extends StreszczenieSesji {
    wiadomosci: WiadomoscZapis[];
}

/** Ostatnie rozmowy. Domyślnie trzy — tyle pokazuje pasek historii. */
export async function ostatnieSesje(ile = 3): Promise<{ sesje: StreszczenieSesji[]; plik: string; wszystkich: number } | null> {
    try {
        const r = await fetch(`${MOST}/api/czat/sesje?ile=${ile}`);
        if (!r.ok) return null;
        const d = await r.json();
        if (!d?.success) return null;
        return { sesje: d.sesje ?? [], plik: d.plik ?? '', wszystkich: d.wszystkich ?? 0 };
    } catch { return null; }
}

export async function wczytajSesje(id: string): Promise<SesjaCzatu | null> {
    try {
        const r = await fetch(`${MOST}/api/czat/sesja/${encodeURIComponent(id)}`);
        if (!r.ok) return null;
        const d = await r.json();
        return d?.success ? (d.sesja as SesjaCzatu) : null;
    } catch { return null; }
}

/** Zapisz rozmowę. Zwraca `false`, gdy most nie przyjął — bez udawania sukcesu. */
export async function zapiszSesje(id: string, wiadomosci: WiadomoscZapis[]): Promise<boolean> {
    try {
        const r = await fetch(`${MOST}/api/czat/sesja`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, wiadomosci }),
        });
        const d = await r.json();
        return !!d?.success;
    } catch { return false; }
}

export async function usunSesje(id: string): Promise<boolean> {
    try {
        const r = await fetch(`${MOST}/api/czat/sesja/usun`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        const d = await r.json();
        return !!d?.success;
    } catch { return false; }
}

/** Nowy identyfikator rozmowy — czas w bazie 36, czytelny i rosnący. */
export function nowaSesja(): string {
    return `czat_${Date.now().toString(36)}`;
}

export default { ostatnieSesje, wczytajSesje, zapiszSesje, usunSesje, nowaSesja };
