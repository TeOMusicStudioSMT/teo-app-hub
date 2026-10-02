/**
 * 🌍 Tłumacz Katedry — teksty interfejsu na dowolny język, lokalnym modelem, z pamięcią na dysku węzła.
 *
 * Suweren (2026-10-02): „czy ma wbudowanego tłumacza na wszystkie języki (bo ja mam wszystko po polsku)".
 * Nie miała: słownik PL/EN/IT obejmował ~40 haseł w 3 komponentach na ~180. Przepisywanie każdego ekranu na klucze
 * to miesiące — więc Katedra zostaje po polsku (źródło prawdy), a przeglądarka (lib/tlumaczDom.ts) zbiera teksty
 * z ekranu i pyta most o tłumaczenia. Most tłumaczy BRAKUJĄCE modelem z Ollamy, paczkami, jedna paczka naraz,
 * i zapisuje w `_OtakOs_Wymiar/tlumaczenia/<język>.json` — kolejne wejście nie woła modelu w ogóle.
 *
 * Uczciwie: jakość = jakość lokalnego modelu (gemma4 dobrze zna główne języki). Pierwsze wejście w nowy język
 * pokazuje polski i przełącza się na tłumaczenie, gdy paczki wrócą. Nazwy własne Katedry zostają (glosariusz).
 * Teksty, których model nie oddał albo oddał podejrzanie (pusty, wielokrotnie dłuższy), zostają po polsku.
 */
import fs from 'fs/promises';
import path from 'path';

let cfg = {
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'tlumaczenia'),
    /** (system, prompt) → tekst odpowiedzi modelu */
    pisz: async () => { throw new Error('Tłumacz nie ma podpiętego modelu.'); },
    paczka: 30,
};
export function skonfiguruj(o) { if (o.katalog && o.katalog !== cfg.katalog) { pamiec.clear(); wczytywane.clear(); } cfg = { ...cfg, ...o }; }

/** Nazwy języków (do promptu i do wyboru w Hubie). Inne kody BCP-47 też przejdą — model zna je po kodzie. */
export const JEZYKI = {
    pl: 'polski', en: 'English', de: 'Deutsch', it: 'Italiano', es: 'Español', fr: 'Français', pt: 'Português',
    nl: 'Nederlands', cs: 'Čeština', sk: 'Slovenčina', uk: 'Українська', ru: 'Русский', lt: 'Lietuvių', sv: 'Svenska',
    no: 'Norsk', da: 'Dansk', fi: 'Suomi', hu: 'Magyar', ro: 'Română', el: 'Ελληνικά', tr: 'Türkçe', ar: 'العربية',
    he: 'עברית', hi: 'हिन्दी', ja: '日本語', ko: '한국어', zh: '中文', vi: 'Tiếng Việt', id: 'Bahasa Indonesia',
};

/** Nazwy własne — zostają jak są (to marki i imiona, nie słowa). */
const GLOSARIUSZ = ['Katedra OtakOS', 'OtakOS', 'TeOgochi', 'TeO', 'GRV', 'Wiesio-Bridge', 'StoL', 'Joanna', 'Kodeks', 'Klatka', 'Wektor',
    'Pionek', 'Zwiadowca', 'Dyrygent', 'Kuźnia Soup', 'Ollama', 'ComfyUI', 'Claude Code', 'Główny', 'Suweren', 'Klaudiusz', 'Adamus', 'Bella', 'ODDI'];

const KOD = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const kodJezyka = (j) => {
    const k = String(j ?? '').trim();
    if (!KOD.test(k)) throw new Error(`Nieznany kod języka „${k}" (np. en, de, uk, pt-BR).`);
    return k;
};

const pamiec = new Map();   // język → Map(tekst → tłumaczenie)
const wczytywane = new Map();   // język → Promise — dwa równoczesne wołania dostają TEN SAM słownik (inaczej model liczyłby podwójnie)
function slownikPliku(j) {
    if (pamiec.has(j)) return Promise.resolve(pamiec.get(j));
    if (!wczytywane.has(j)) {
        wczytywane.set(j, (async () => {
            let m = new Map();
            try { m = new Map(Object.entries(JSON.parse(await fs.readFile(path.join(cfg.katalog, `${j}.json`), 'utf8')))); } catch { /* jeszcze nic */ }
            pamiec.set(j, m);
            wczytywane.delete(j);
            return m;
        })());
    }
    return wczytywane.get(j);
}
let zapisWToku = Promise.resolve();
function zapisz(j) {
    zapisWToku = zapisWToku.then(async () => {
        await fs.mkdir(cfg.katalog, { recursive: true });
        const plik = path.join(cfg.katalog, `${j}.json`);
        await fs.writeFile(`${plik}.tmp`, JSON.stringify(Object.fromEntries(pamiec.get(j)), null, 1), 'utf8');
        await fs.rename(`${plik}.tmp`, plik);
    }).catch(() => {});
    return zapisWToku;
}

/** Cały zapamiętany słownik języka (Hub ładuje go od razu przy starcie). */
export async function slownik(jezyk) {
    const j = kodJezyka(jezyk);
    return Object.fromEntries(await slownikPliku(j));
}

/** Czy tekst w ogóle jest do tłumaczenia (słowa, nie liczby/kod/adresy). */
export function doTlumaczenia(t) {
    const s = String(t ?? '').trim();
    if (s.length < 2 || s.length > 600) return false;
    if (!/\p{L}{2,}/u.test(s)) return false;                        // same cyfry, symbole, emoji
    if (/^(https?:\/\/|www\.|\/api\/|[\w.-]+@[\w.-]+$)/i.test(s)) return false;   // adresy
    if (/^[\w.-]+\.(js|ts|tsx|json|mjs|md|png|jpg|mp4|gguf|zip)$/i.test(s)) return false;   // nazwy plików
    if (/^[0-9a-f]{7,40}\b/.test(s) || /^[\w.-]+\/[\w./-]+$/.test(s)) return false;   // hash commita, gałąź/ścieżka
    if (/^[A-Z0-9_]{2,}$/.test(s) && !/[a-ząćęłńóśźż]/.test(s)) return s.length > 3 && /[AEIOUY]/.test(s);   // skróty typu GRV/API — zostają
    return true;
}

/** Tłumaczenie od modelu wygląda na prawdziwe? (nie puste, nie elaborat zamiast krótkiego napisu) */
function sensowne(zrodlo, wynik) {
    const w = String(wynik ?? '').trim();
    if (!w) return false;
    return w.length <= Math.max(40, zrodlo.length * 4);
}

let kolejka = Promise.resolve();   // jedna paczka naraz — model na tej samej karcie co reszta Katedry

async function paczkaModelem(j, teksty) {
    const nazwa = JEZYKI[j.split('-')[0]] ?? j;
    const system = `Jesteś tłumaczem interfejsu aplikacji „Katedra OtakOS". Tłumaczysz krótkie napisy interfejsu (przyciski, nagłówki, podpowiedzi) z polskiego na język: ${nazwa} (${j}). Zasady: zachowaj emoji, liczby, znaki i wielkość liter na początku; nie dopisuj wyjaśnień; nie tłumacz nazw własnych: ${GLOSARIUSZ.join(', ')}. Gdy tekst już jest w języku docelowym albo jest nazwą — oddaj go bez zmian. Odpowiedz WYŁĄCZNIE obiektem JSON {"0": "…", "1": "…"} z tymi samymi kluczami.`;
    const wejscie = Object.fromEntries(teksty.map((t, i) => [String(i), t]));
    const odp = await cfg.pisz(system, JSON.stringify(wejscie, null, 0));
    const m = /\{[\s\S]*\}/.exec(String(odp ?? ''));
    if (!m) throw new Error('Model nie oddał JSON-a z tłumaczeniami.');
    let d; try { d = JSON.parse(m[0]); } catch { throw new Error('Model oddał niepoprawny JSON.'); }
    const wynik = {};
    teksty.forEach((t, i) => { const w = d[String(i)]; if (sensowne(t, w)) wynik[t] = String(w).trim(); });
    return wynik;
}

/**
 * Tłumaczenia tekstów na język: z pamięci, a brakujące — modelem (paczkami, kolejno).
 * @returns {Promise<{ mapa: Record<string,string>, nowych: number, pominiete: string[], blad?: string }>}
 */
export async function tlumacz(jezyk, teksty) {
    const j = kodJezyka(jezyk);
    const lista = [...new Set((Array.isArray(teksty) ? teksty : []).map((t) => String(t ?? '').trim()))].filter(doTlumaczenia).slice(0, 200);
    if (j === 'pl' || j.startsWith('pl-')) return { mapa: Object.fromEntries(lista.map((t) => [t, t])), nowych: 0, pominiete: [] };
    const slow = await slownikPliku(j);
    const brak = lista.filter((t) => !slow.has(t));
    let nowych = 0, blad;
    if (brak.length) {
        const praca = kolejka.then(async () => {
            for (let i = 0; i < brak.length; i += cfg.paczka) {
                const czesc = brak.slice(i, i + cfg.paczka).filter((t) => !slow.has(t));   // inny klient mógł już je dostać
                if (!czesc.length) continue;
                const w = await paczkaModelem(j, czesc);
                for (const [t, tl] of Object.entries(w)) { slow.set(t, tl); nowych++; }
                await zapisz(j);
            }
        });
        kolejka = praca.catch(() => {});
        try { await praca; } catch (e) { blad = String(e.message || e).slice(0, 300); }
    }
    const mapa = {};
    const pominiete = [];
    for (const t of lista) { if (slow.has(t)) mapa[t] = slow.get(t); else pominiete.push(t); }
    return { mapa, nowych, pominiete, ...(blad ? { blad } : {}) };
}

export default { skonfiguruj, tlumacz, slownik, doTlumaczenia, JEZYKI };
