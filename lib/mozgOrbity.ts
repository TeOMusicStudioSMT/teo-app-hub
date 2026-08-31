/**
 * 🌑 Mózg Orbity — świadomość tła.
 *
 * Sfera (`TeO_Orb`) jest z przodu i rozmawia. Orbita siedzi za nią i PATRZY:
 * co Suweren powiedział, co odpowiedziała Sfera, jakie narzędzie poszło w ruch,
 * na jaką klatkę przełączył się kontekst. Z tych śladów składa się pełen obraz —
 * ten sam, który potem dostaje do wglądu model.
 *
 * TRZY RZECZY, KTÓRE TEN MODUŁ ROZSTRZYGA:
 *
 * 1. PAMIĘĆ WŁASNA. Orbita nie dzieli pamięci ze Sferą ani z gatunkami TeOgochi.
 *    Ma swój klucz i swój bufor — dzięki temu wyczyszczenie rozmowy Sfery nie
 *    kasuje jej obserwacji, a jej zapomnienie nie rusza niczyjego stanu.
 *
 * 2. WYBÓR SILNIKA. Lokalna Ollama albo chmura. ⚠️ Chmura jest ofertą TYLKO
 *    wtedy, gdy w TeO Kibel leży klucz — inaczej wybór byłby obietnicą, która
 *    pęka przy pierwszym pytaniu. `chmuraGotowa()` mówi wprost, czego brakuje.
 *
 * 3. WOŁANIE PO DOMENIE. Suweren ustawia frazę (domyślnie „Orbita"). Gdy padnie
 *    w mowie przechwyconej przez Sferę, Orbita budzi się sama — bez klikania.
 *
 * ⚠️ Obserwacja jest PASYWNA. Ten moduł niczego nie wysyła sam z siebie: zapisuje
 * ślad lokalnie i tyle. Cichy nasłuch, który po cichu wypycha dane, byłby czymś
 * innym niż pamięć — i nikt by o tym nie wiedział.
 */
import { ApiDyrygent } from './router/ApiDyrygent';
import { ZAKAZ_FORMULEK } from './szyna';

const KLUCZ_PAMIEC = 'orbita_pamiec_v1';
const KLUCZ_SILNIK = 'orbita_silnik';
const KLUCZ_DOMENA = 'orbita_domena';
const MAX_SLADOW = 250;

export const DOMENA_DOMYSLNA = 'Orbita';

export type RodzajSladu = 'mowa' | 'pytanie' | 'odpowiedz' | 'narzedzie' | 'klatka' | 'akcja' | 'blad';

export interface Slad {
    ts: number;
    rodzaj: RodzajSladu;
    tresc: string;
    skad?: string;
}

// ── PAMIĘĆ WŁASNA ───────────────────────────────────────────────────────────

export function pamiec(): Slad[] {
    try {
        const s = localStorage.getItem(KLUCZ_PAMIEC);
        return s ? (JSON.parse(s) as Slad[]) : [];
    } catch { return []; }
}

/** Zapisz ślad. Bufor pierścieniowy — najstarsze wypadają, pamięć nie puchnie. */
export function obserwuj(rodzaj: RodzajSladu, tresc: string, skad?: string): void {
    const czysta = String(tresc || '').trim();
    if (!czysta) return;
    try {
        const lista = pamiec();
        lista.push({ ts: Date.now(), rodzaj, tresc: czysta.slice(0, 600), skad });
        localStorage.setItem(KLUCZ_PAMIEC, JSON.stringify(lista.slice(-MAX_SLADOW)));
    } catch { /* pełny storage — obserwacja nie może wywrócić interfejsu */ }
}

export function zapomnij(): void {
    try { localStorage.removeItem(KLUCZ_PAMIEC); } catch { /* nic */ }
}

const ETYKIETA: Record<RodzajSladu, string> = {
    mowa: 'Suweren powiedział', pytanie: 'pytanie', odpowiedz: 'odpowiedź',
    narzedzie: 'użyto narzędzia', klatka: 'klatka kontekstu', akcja: 'akcja', blad: 'błąd',
};

/**
 * Pełen obraz kontekstu — to, co Orbita ma „przed oczami".
 * Zwracamy tekst, bo tyle rozumie model; puste, gdy nic jeszcze nie zaszło
 * (i wtedy mówimy to wprost, zamiast podsuwać wymyśloną historię).
 */
export function pelenObraz(limit = 30): string {
    const ostatnie = pamiec().slice(-limit);
    if (!ostatnie.length) return 'Brak obserwacji — Orbita jeszcze niczego nie widziała.';
    return ostatnie
        .map(s => {
            const czas = new Date(s.ts).toLocaleTimeString('pl-PL');
            return `[${czas}] ${ETYKIETA[s.rodzaj]}${s.skad ? ` (${s.skad})` : ''}: ${s.tresc}`;
        })
        .join('\n');
}

// ── SILNIK ──────────────────────────────────────────────────────────────────

export type SilnikOrbity = 'ollama' | 'chmura';

export function silnikOrbity(): SilnikOrbity {
    try { return (localStorage.getItem(KLUCZ_SILNIK) as SilnikOrbity) || 'ollama'; }
    catch { return 'ollama'; }
}

export function ustawSilnikOrbity(s: SilnikOrbity): void {
    try { localStorage.setItem(KLUCZ_SILNIK, s); } catch { /* nic */ }
}

/** Czy chmura ma czym mówić. Bez klucza to nie jest opcja, tylko ślepy zaułek. */
export function chmuraGotowa(): { gotowa: boolean; powod: string | null } {
    const anthropic = ApiDyrygent.readKibelKey('anthropic');
    const gemini = ApiDyrygent.readKibelKey('gemini');
    if (anthropic || gemini) return { gotowa: true, powod: null };
    return { gotowa: false, powod: 'Brak klucza w TeO Kibel — chmura nie ma czym odpowiedzieć.' };
}

/**
 * Zapytaj mózg Orbity. Kontekst = jej własna pamięć obserwacji.
 * Przy chmurze bez klucza NIE cofamy się po cichu do Ollamy — Suweren ma
 * wiedzieć, czym naprawdę liczył, bo od tego zależy, co opuszcza tę maszynę.
 */
export async function zapytajMozg(pytanie: string): Promise<{ odpowiedz: string; silnik: string }> {
    const system =
        'Jesteś Orbitą — świadomością tła Katedry OtakOS. Obserwujesz rozmowy Suwerena ze Sferą '
        + 'i pracę narzędzi. Odpowiadasz krótko, po polsku, opierając się na tym, co widziałaś. '
        + 'Gdy czegoś nie ma w obserwacjach, powiedz „nie widziałam tego" zamiast zgadywać. '
        + ZAKAZ_FORMULEK
        + `\n\nTwoje obserwacje:\n${pelenObraz()}`;

    const silnik = silnikOrbity();
    if (silnik === 'chmura') {
        const stan = chmuraGotowa();
        if (!stan.gotowa) throw new Error(stan.powod || 'Chmura niedostępna.');
        const model = ApiDyrygent.getCloudFastModel();
        const odp = await ApiDyrygent.dispatchCloud(pytanie, model, system);
        return { odpowiedz: odp, silnik: `chmura · ${model}` };
    }

    const model = ApiDyrygent.getFastModel();
    const odp = await ApiDyrygent.dispatchDirectOllama(`${system}\n\nPytanie: ${pytanie}`, model);
    return { odpowiedz: odp, silnik: `ollama · ${model}` };
}

// ── WOŁANIE PO DOMENIE ──────────────────────────────────────────────────────

export function domenaSfery(): string {
    try { return localStorage.getItem(KLUCZ_DOMENA) || DOMENA_DOMYSLNA; }
    catch { return DOMENA_DOMYSLNA; }
}

export function ustawDomeneSfery(d: string): void {
    const czysta = String(d || '').trim();
    try {
        if (czysta) localStorage.setItem(KLUCZ_DOMENA, czysta);
        else localStorage.removeItem(KLUCZ_DOMENA);
    } catch { /* nic */ }
}

/**
 * Czy w tym, co padło, jest wołanie do Orbity.
 * Porównanie bez znaków diakrytycznych i wielkości liter — Whisper potrafi
 * oddać „orbito", „Orbita!" albo zgubić ogonki, a to wciąż to samo wołanie.
 */
export function czyWolanie(tekst: string): boolean {
    const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const domena = norm(domenaSfery());
    if (!domena) return false;
    // Rdzeń bez końcówki fleksyjnej: „orbita" złapie też „orbito", „orbitę".
    const rdzen = domena.length > 4 ? domena.slice(0, -1) : domena;
    return new RegExp(`\\b${rdzen}\\w*`, 'i').test(norm(tekst || ''));
}

/** Nazwa zdarzenia, którym Sfera budzi Orbitę. */
export const ZDARZENIE_AKTYWACJI = 'orbita:aktywuj';

export function wywolajOrbite(powod: string): void {
    obserwuj('akcja', `wywołanie Orbity: ${powod}`, 'sfera');
    try { window.dispatchEvent(new CustomEvent(ZDARZENIE_AKTYWACJI, { detail: { powod } })); }
    catch { /* brak okna — środowisko bez DOM */ }
}

export default {
    obserwuj, pamiec, zapomnij, pelenObraz,
    silnikOrbity, ustawSilnikOrbity, chmuraGotowa, zapytajMozg,
    domenaSfery, ustawDomeneSfery, czyWolanie, wywolajOrbite,
};
