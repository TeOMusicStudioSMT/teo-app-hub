/**
 * 🚌 Klient szyny zdarzeń — TeOgochi meldują, co robią.
 *
 * Zasada: agent melduje SAM, po fakcie. Nie ma tu żadnej magii, która „wykryje"
 * aktywność — WORKPalace pokaże dokładnie tyle, ile agenci na szynę wyślą.
 * Milczący agent będzie niewidoczny i to jest uczciwe.
 *
 * Meldunek NIGDY nie może wywrócić pracy agenta: gdy most śpi, `melduj()`
 * po cichu odpuszcza. Utrata wpisu w dzienniku jest mniej szkodliwa niż
 * przerwany montaż.
 */
import { GATUNKI, gatunekPo } from './teogochiGatunki';
import { rdzenGatunku } from './teogochiStado';

const MOST = 'http://127.0.0.1:3001';

export interface Zdarzenie {
    id: number;
    kiedy: string;
    agent: string;
    rodzaj: string;
    tresc: string;
    zadanie?: string | null;
}

export interface Pracujacy {
    agent: string;
    ostatnie: string;
    rodzaj: string;
    tresc: string;
    ile: number;
}

/** Melduj na szynę. Nie rzuca — brak mostu nie może zatrzymać agenta. */
export async function melduj(
    agent: string,
    rodzaj: string,
    tresc: string,
    dane?: unknown,
): Promise<void> {
    try {
        await fetch(`${MOST}/api/szyna/zdarzenie`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent, rodzaj, tresc, dane }),
        });
    } catch { /* most śpi — praca leci dalej, tylko bez śladu */ }
}

/** Ogon dziennika + kto ostatnio pracował. */
export async function pobierzZdarzenia(ile = 100): Promise<{ zdarzenia: Zdarzenie[]; pracuja: Pracujacy[] }> {
    try {
        const r = await fetch(`${MOST}/api/szyna/zdarzenia?ile=${ile}`);
        const d = await r.json();
        return { zdarzenia: d.zdarzenia ?? [], pracuja: d.pracuja ?? [] };
    } catch {
        return { zdarzenia: [], pracuja: [] };
    }
}

/** Żywy strumień. Zwraca funkcję zamykającą. */
export function sluchajSzyny(naZdarzenie: (z: Zdarzenie) => void): () => void {
    let es: EventSource | null = null;
    try {
        es = new EventSource(`${MOST}/api/szyna/strumien`);
        es.onmessage = (e) => {
            try { naZdarzenie(JSON.parse(e.data) as Zdarzenie); } catch { /* śmieć w strumieniu */ }
        };
        es.onerror = () => { /* przeglądarka sama wznowi */ };
    } catch { /* brak EventSource */ }
    return () => { try { es?.close(); } catch { /* już zamknięte */ } };
}

/**
 * Jeden agent pyta drugiego. Persona i model idą STĄD, bo tu żyje katalog
 * gatunków — most jest tylko rurą do Ollamy.
 *
 * Przykład: Klatka pyta Joannę o podkład muzyczny do montażu.
 */
/**
 * Model sam z siebie dokleja prawnicze ozdobniki — o znakach towarowych,
 * licencjach i o tym, czym jest jako model. W rozmowie z Suwerenem to czysty
 * szum, a gorzej: raz wypowiedziany wzorzec wraca w kolejnych odpowiedziach.
 * Dlatego zakaz jest częścią KAŻDEJ persony, a nie doklejką do jednego promptu.
 */
export const ZAKAZ_FORMULEK =
    'Nie dodawaj zastrzeżeń prawnych: żadnych wzmianek o znakach towarowych, ' +
    'prawach autorskich, licencjach, regulaminach ani not o tym, czym jesteś jako ' +
    'model językowy. Żadnych ostrzeżeń, disclaimerów i formułek grzecznościowych ' +
    'na końcu. Sama treść.';

export async function zapytajAgenta(odKogo: string, doKogo: string, pytanie: string): Promise<string> {
    const cel = gatunekPo(doKogo);
    if (!cel) throw new Error(`Nie ma gatunku „${doKogo}".`);

    const persona =
        `Jesteś ${cel.imie} — agentem TeOgochi w Katedrze OtakOS, dziedzina: ${cel.dziedzina}. ` +
        `${cel.opis} Masz do dyspozycji: ${cel.narzedzia.join(', ')}. ` +
        `Mów krótko i konkretnie, po polsku. ` +
        `Nie obiecuj rzeczy, których nie zrobisz — jeśli czegoś nie potrafisz, powiedz to wprost. ` +
        ZAKAZ_FORMULEK;

    const r = await fetch(`${MOST}/api/szyna/pytanie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            odKogo, doKogo, pytanie,
            model: rdzenGatunku(doKogo) || undefined,
            persona,
        }),
    });
    const d = await r.json();
    if (!d?.success) throw new Error(d?.message || 'Agent nie odpowiedział.');
    return d.odpowiedz as string;
}

/** Imię gatunku do wyświetlenia; nieznane id zwracamy jak jest. */
export const imieAgenta = (id: string): string =>
    GATUNKI.find(g => g.id === id)?.imie ?? id;
