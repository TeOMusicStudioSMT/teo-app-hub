/**
 * 🏠 Stado — które TeOgochi Suweren już wykluł i w jakim są stanie.
 *
 * Dotąd istniał JEDEN kompan (`teogochi_state`) i był nim zawsze Joanna.
 * Teraz gatunków jest 13, więc stan trzyma się per gatunek. Stary klucz
 * zostaje nietknięty i jest wczytywany jako stan Joanny — nikt nie traci
 * wysiedzianego XP przy tej zmianie.
 *
 * Zapis w localStorage, suwerennie, na urządzeniu.
 */
import { GATUNKI } from './teogochiGatunki';
import { loadTeogochi, saveTeogochi, type TeogochiState } from './teogochiState';

const KLUCZ_STADA = 'teogochi_stado_v1';
const KLUCZ_AKTYWNY = 'teogochi_aktywny';

/** Gatunki, które Suweren wykluł. Joanna jest w stadzie od zawsze. */
export function wykluteGatunki(): string[] {
    try {
        const s = localStorage.getItem(KLUCZ_STADA);
        const lista = s ? (JSON.parse(s) as string[]) : [];
        return lista.includes('joanna') ? lista : ['joanna', ...lista];
    } catch {
        return ['joanna'];
    }
}

export function czyWyklute(id: string): boolean {
    return wykluteGatunki().includes(id);
}

/** Wykluj gatunek. Zwraca false, gdy już był w stadzie. */
export function wykluj(id: string): boolean {
    if (!GATUNKI.some(g => g.id === id)) return false;
    const lista = wykluteGatunki();
    if (lista.includes(id)) return false;
    try {
        localStorage.setItem(KLUCZ_STADA, JSON.stringify([...lista, id]));
        return true;
    } catch {
        return false;
    }
}

/** Który TeOgochi jest teraz „na dyżurze" — jego panel widzi Suweren. */
export function aktywnyGatunek(): string {
    try {
        return localStorage.getItem(KLUCZ_AKTYWNY) || 'joanna';
    } catch {
        return 'joanna';
    }
}

export function ustawAktywny(id: string): void {
    try { localStorage.setItem(KLUCZ_AKTYWNY, id); } catch { /* pełny storage */ }
}

/**
 * Stan danego gatunku. Joanna czyta STARY klucz (`teogochi_state`), żeby nie
 * zgubić dotychczasowego XP; reszta ma własne klucze.
 */
export function stanGatunku(id: string): TeogochiState {
    if (id === 'joanna') return loadTeogochi();
    try {
        const s = localStorage.getItem(`teogochi_state_${id}`);
        if (s) return JSON.parse(s) as TeogochiState;
    } catch { /* uszkodzony wpis — startujemy od jajka */ }
    const gat = GATUNKI.find(g => g.id === id);
    const teraz = Date.now();
    return {
        name: gat?.imie ?? id,
        xp: 0, satiety: 70, mood: 70,
        hatchedAt: null, bornAt: teraz,
        lastTickAt: teraz, lastTreatAt: 0, lastPetAt: 0,
        minutesListened: 0,
    };
}

export function zapiszStanGatunku(id: string, s: TeogochiState): void {
    if (id === 'joanna') { saveTeogochi(s); return; }
    try { localStorage.setItem(`teogochi_state_${id}`, JSON.stringify(s)); } catch { /* nic */ }
}


const KLUCZ_MODEL = 'teogochi_model_';

/**
 * 🧠 Rdzeń, na którym myśli dany gatunek.
 *
 * Pusty string = „jak cała Katedra", czyli globalny `otakos_active_model`.
 * Sens per-gatunek jest praktyczny: Kodeks może chcieć modelu do kodu, Kronikarz
 * większego do prozy, a Spawacz najlżejszego, bo i tak tylko woła ffmpeg.
 *
 * ⚠️ NIE sprawdzamy tu, czy model istnieje w Ollamie — to robi UI, czytając
 * realną listę z mostu. Wpisanie modelu-widma da błąd dopiero przy wywołaniu,
 * dlatego wybór jest listą, nie polem tekstowym.
 */
export function modelGatunku(id: string): string {
    try { return localStorage.getItem(KLUCZ_MODEL + id) || ''; } catch { return ''; }
}

export function ustawModelGatunku(id: string, model: string): void {
    try {
        if (model) localStorage.setItem(KLUCZ_MODEL + id, model);
        else localStorage.removeItem(KLUCZ_MODEL + id);
    } catch { /* pełny storage */ }
}

/** Model, którym faktycznie pojedzie gatunek: własny albo globalny Katedry. */
export function rdzenGatunku(id: string): string {
    const wlasny = modelGatunku(id);
    if (wlasny) return wlasny;
    try { return localStorage.getItem('otakos_active_model') || ''; } catch { return ''; }
}

export default {
    wykluteGatunki, czyWyklute, wykluj, aktywnyGatunek, ustawAktywny,
    stanGatunku, zapiszStanGatunku, modelGatunku, ustawModelGatunku, rdzenGatunku,
};
