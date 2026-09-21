/**
 * 🔁 stadoSync — przeglądarka jako pamięć podręczna, most jako źródło prawdy dla XP.
 *
 * Suweren (2026-09-21), po utracie Legendy Joanny przez wyczyszczone dane Chrome:
 * „zrób most jako źródło prawdy dla XP". Stan TeOgochi leży teraz na dysku Katedry
 * (services/Stado.js → _OtakOs_Wymiar/stado.json). Ten moduł:
 *
 *   1. `hydratujStadoZMostu()` — PRZED startem UI (index.tsx) ściąga stan z mostu i wpisuje
 *      do localStorage. Reguła: dla każdego gatunku wygrywa WYŻSZE XP. Most wyżej → nadpisuje
 *      przeglądarkę (pusty Chrome dostaje Legendę z powrotem). Przeglądarka wyżej (pierwsze
 *      uruchomienie po tej zmianie, most jeszcze pusty) → odsyła w górę.
 *   2. `zsynchronizuj*()` — każdy zapis w teogochiState/teogochiStado dokłada tu deltę;
 *      wysyłka zbiorcza po 800 ms (jeden POST zamiast dziesięciu przy karmieniu).
 *
 * ⚠️ Ten plik NIE importuje teogochiState ani teogochiStado (one importują jego) —
 * dlatego czyta i pisze surowe klucze localStorage, te same, których używają tamte moduły.
 * Bez mostu wszystko działa jak dotąd (localStorage), a synchronizacja dogania po starcie.
 */

const MOST = 'http://127.0.0.1:3001';
const KLUCZ_JOANNA = 'teogochi_state';          // lib/teogochiState.ts
const KLUCZ_GATUNKU = (id: string) => `teogochi_state_${id}`;   // lib/teogochiStado.ts
const KLUCZ_STADA = 'teogochi_stado_v1';
const KLUCZ_AKTYWNY = 'teogochi_aktywny';

interface StanTeogochi { xp: number; [k: string]: unknown }
interface StanZMostu { aktywny: string; wyklute: string[]; stany: Record<string, StanTeogochi>; zmieniono: string | null; odrzucone?: Array<{ id: string; naDysku: number; przyszlo: number }> }

const kluczDla = (id: string) => (id === 'joanna' ? KLUCZ_JOANNA : KLUCZ_GATUNKU(id));

function czytajLokalnie(id: string): StanTeogochi | null {
    try { const s = localStorage.getItem(kluczDla(id)); return s ? (JSON.parse(s) as StanTeogochi) : null; } catch { return null; }
}
function zapiszLokalnie(id: string, s: StanTeogochi): void {
    try { localStorage.setItem(kluczDla(id), JSON.stringify(s)); } catch { /* pełny storage */ }
}
function wykluteLokalnie(): string[] {
    try { const s = localStorage.getItem(KLUCZ_STADA); const l = s ? (JSON.parse(s) as string[]) : []; return l.includes('joanna') ? l : ['joanna', ...l]; } catch { return ['joanna']; }
}

// ── wysyłka zbiorcza ────────────────────────────────────────────────────────
let delta: { aktywny?: string; wyklute?: string[]; stany: Record<string, StanTeogochi> } = { stany: {} };
let zegar: ReturnType<typeof setTimeout> | null = null;
let ostatniaOdpowiedz: StanZMostu | null = null;

async function wyslij(): Promise<void> {
    const paczka = delta; delta = { stany: {} }; zegar = null;
    if (!paczka.aktywny && !paczka.wyklute && !Object.keys(paczka.stany).length) return;
    try {
        const r = await fetch(`${MOST}/api/stado/stan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paczka), keepalive: true });
        if (r.ok) {
            ostatniaOdpowiedz = await r.json();
            // Most odrzucił niższe XP → w tej przeglądarce jest stary stan; bierzemy jego.
            for (const o of ostatniaOdpowiedz?.odrzucone ?? []) {
                const zMostu = ostatniaOdpowiedz?.stany?.[o.id];
                if (zMostu) zapiszLokalnie(o.id, zMostu);
            }
        }
    } catch { /* most śpi — localStorage ma wszystko, dogonimy przy następnym zapisie/starcie */ }
}
function zaplanuj(): void { if (!zegar) zegar = setTimeout(() => { void wyslij(); }, 800); }

export function zsynchronizujStan(id: string, s: StanTeogochi): void { delta.stany[id] = s; zaplanuj(); }
export function zsynchronizujWyklute(lista: string[]): void { delta.wyklute = lista; zaplanuj(); }
export function zsynchronizujAktywny(id: string): void { delta.aktywny = id; zaplanuj(); }
export function ostatniStanMostu(): StanZMostu | null { return ostatniaOdpowiedz; }

// ── hydratacja przy starcie ─────────────────────────────────────────────────
/**
 * Ściągnij stan z mostu i pogódź z localStorage (wyższe XP wygrywa). Nigdy nie rzuca,
 * nigdy nie blokuje dłużej niż `limitMs` — brak mostu nie może zatrzymać Katedry.
 * Zwraca, co zrobiono — index.tsx loguje to raz, żeby było widać w konsoli.
 */
export async function hydratujStadoZMostu(limitMs = 2500): Promise<{ zMostu: string[]; doMostu: string[]; mostZywy: boolean }> {
    const wynik = { zMostu: [] as string[], doMostu: [] as string[], mostZywy: false };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), limitMs);
    let m: StanZMostu | null = null;
    try {
        const r = await fetch(`${MOST}/api/stado/stan`, { signal: ctrl.signal });
        if (r.ok) m = (await r.json()) as StanZMostu;
    } catch { /* most nie odpowiada */ } finally { clearTimeout(t); }
    if (!m) return wynik;
    wynik.mostZywy = true;

    const lokalneWyklute = wykluteLokalnie();
    const doGory: Record<string, StanTeogochi> = {};
    const idy = new Set<string>([...Object.keys(m.stany ?? {}), ...lokalneWyklute, 'joanna']);
    for (const id of idy) {
        const lok = czytajLokalnie(id);
        const zM = m.stany?.[id] ?? null;
        const xpLok = Number(lok?.xp) || 0, xpM = Number(zM?.xp) || 0;
        if (zM && (!lok || xpM > xpLok)) { zapiszLokalnie(id, zM); wynik.zMostu.push(id); }
        else if (lok && (!zM || xpLok > xpM)) { doGory[id] = lok; wynik.doMostu.push(id); }
    }
    // wyklucie: suma zbiorów; aktywny: most, jeśli ma
    const wyklute = [...new Set(['joanna', ...(m.wyklute ?? []), ...lokalneWyklute])];
    try { localStorage.setItem(KLUCZ_STADA, JSON.stringify(wyklute)); } catch { /* — */ }
    if (m.aktywny) { try { localStorage.setItem(KLUCZ_AKTYWNY, m.aktywny); } catch { /* — */ } }

    const brakujeWMoscie = lokalneWyklute.some((id) => !(m.wyklute ?? []).includes(id));
    if (Object.keys(doGory).length || brakujeWMoscie) {
        delta = { stany: { ...delta.stany, ...doGory }, wyklute, aktywny: delta.aktywny };
        await wyslij();
    }
    return wynik;
}
