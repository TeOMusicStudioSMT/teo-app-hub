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
import { flushKibel, retrieveKey } from './kibel';
import { vaultList } from './VaultStorage';
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

/**
 * Czy chmura ma czym mówić.
 *
 * ⚠️ PIERWSZA WERSJA BYŁA ZA WĄSKA i mówiła „brak klucza" Suwerenowi, który
 * klucze miał. Patrzyła tylko na dwa dokładne wpisy w localStorage, a Kibel
 * trzyma je na trzy sposoby (wpis legacy, `kibel_key_*`, rejestr providerów),
 * do tego istnieje osobny Skarbiec. Teraz pytamy KIBEL O JEGO WŁASNE ZDANIE
 * (`flushKibel`) i dokładamy Skarbiec, zamiast zgadywać nazwy kluczy.
 *
 * Rozróżniamy też dwa różne „nie": brak jakichkolwiek kluczy, i klucze do
 * dostawców, których tor chmurowy nie obsługuje (umie Anthropic i Gemini).
 */
export function chmuraGotowa(): { gotowa: boolean; powod: string | null; dostawcy: string[] } {
    const dostawcy = new Set<string>();

    // 1. Zdanie samego Kibla — obejmuje wpisy legacy i `kibel_key_*`.
    try { for (const p of flushKibel().providers) dostawcy.add(String(p)); } catch { /* Kibel niemy */ }

    // 2. Bezpośredni odczyt torów, których naprawdę używa dispatchCloud.
    try { if (ApiDyrygent.readKibelKey('anthropic')) dostawcy.add('anthropic'); } catch { /* nic */ }
    try { if (ApiDyrygent.readKibelKey('gemini')) dostawcy.add('gemini'); } catch { /* nic */ }

    // 3. Skarbiec — osobny magazyn, po nazwach wpisów.
    try {
        for (const w of vaultList()) {
            const n = w.toLowerCase();
            if (n.includes('anthropic') || n.includes('claude')) dostawcy.add('anthropic');
            if (n.includes('gemini') || n.includes('google')) dostawcy.add('gemini');
            if (n.includes('groq')) dostawcy.add('groq');
            if (n.includes('openai')) dostawcy.add('openai');
        }
    } catch { /* brak Skarbca */ }

    const lista = [...dostawcy].filter(d => d && d !== 'unknown');
    const obslugiwane = lista.filter(d => d === 'anthropic' || d === 'gemini');

    if (obslugiwane.length) return { gotowa: true, powod: null, dostawcy: obslugiwane };
    if (lista.length) {
        return {
            gotowa: false,
            dostawcy: lista,
            powod: `Widzę klucze: ${lista.join(', ')} — ale tor chmurowy Orbity obsługuje na razie `
                + 'tylko Anthropic i Gemini.',
        };
    }
    return {
        gotowa: false,
        dostawcy: [],
        powod: 'Nie widzę żadnego klucza — ani w Kiblu, ani w Skarbcu.',
    };
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
        const stan = await chmuraGotowaDokladnie();
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

/**
 * Dokładne sprawdzenie chmury — ASYNCHRONICZNE, bo Kibel potrafi trzymać klucz
 * w IndexedDB i tam odczyt nie jest natychmiastowy. `chmuraGotowa()` odpowiada
 * od razu (do rysowania listy), a to tutaj mówi ostatnie słowo przed pytaniem.
 */
export async function chmuraGotowaDokladnie(): Promise<{ gotowa: boolean; powod: string | null; dostawcy: string[] }> {
    const szybka = chmuraGotowa();
    if (szybka.gotowa) return szybka;
    const znalezione: string[] = [];
    for (const p of ['anthropic', 'gemini'] as const) {
        try { if (await retrieveKey(p)) znalezione.push(p); } catch { /* brak */ }
    }
    if (znalezione.length) return { gotowa: true, powod: null, dostawcy: znalezione };
    return szybka;
}

export default {
    obserwuj, pamiec, zapomnij, pelenObraz, chmuraGotowaDokladnie,
    silnikOrbity, ustawSilnikOrbity, chmuraGotowa, zapytajMozg,
    domenaSfery, ustawDomeneSfery, czyWolanie, wywolajOrbite,
};
