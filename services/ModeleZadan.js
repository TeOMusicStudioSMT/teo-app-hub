/**
 * 🎯 Modele do zadań technicznych Katedry (Suweren 2026-10-09: „oczy dają błąd w Ollamie… ustaw mi w ogóle precyzyjne
 * modele w Katedrze… niech Jev zbiera dane, bo na razie nie ma danych”). Dotąd oczy miały na sztywno `qwen3.5:9b`,
 * którego Ollama nie ma → HTTP 404 przy każdym „👁️ ze zdjęcia” i każdym sędziowaniu zrzutu gry.
 *
 * ZADANIA (`ZADANIA`) mówią, czego potrzebują (`capabilities` z Ollamy `/api/show`: vision, completion…). Model zadania:
 *   1. ręczny wybór Suwerena (`ustaw`) — gdy model jest w Ollamie,
 *   2. DANE: po ≥ `MIN_PROB` użyciach — najlepszy wynik (skuteczność × średnia ocena Jev, szybkość jako remis),
 *   3. inaczej ranking z faktów: ma potrzebną zdolność, lokalny (nie :cloud), niezgnieciony kwant, rozmiar najbliżej
 *      „słodkiego punktu” zadania (oczy: ~8 GB — gemma4:12B przed e2b), nazwa z listy preferencji jako remis.
 * Każde użycie zadania → `notuj` (model, ok, ms, ocena Jev 0–1 gdy jest) w `_OtakOs_Wymiar/modele-zadan.json`
 * (ostatnie 200 na zadanie). Jev ocenia wynik pytaniem `noul` dopasowanym do zadania (`PYTANIA_JEV`) — bez klucza Jev
 * zbiera się sama skuteczność i czas.
 */
import fs from 'fs/promises';
import path from 'path';

export const ZADANIA = {
    oczy: { nazwa: '👁️ Oczy Katedry', opis: 'styl tekstur ze zdjęcia bryły, sędzia zrzutów gry', potrzeba: ['vision', 'completion'], idealGB: 8, preferuj: ['gemma4:12b', 'ornith-1.5', 'gemma4:e4b', 'gemma4:latest', 'gemma4:e2b'] },
};
export const MIN_PROB = 5;
const ZGNIECIONY = /(^|[^a-z])(iq1|iq2|q2_|q2$|tq1|tq2|q2_0)/i;

/** Pytanie do Jev o jakość wyniku zadania. */
export const PYTANIA_JEV = {
    oczy: (wynik) => ({
        state: { wynik_modelu: String(wynik).slice(0, 2000) },
        questions: { jakosc: { type: 'noul', instructions: 'Czy to rzeczowy opis POWIERZCHNI obiektu (materiały, barwy, faktury, połysk) nadający się jako prompt tekstur — a nie opis sceny, tła, kamery albo odmowa?', criteria: { true: 'Konkretne materiały i kolory obiektu, zwięźle.', false: 'Ogólniki, opis tła/sceny, odmowa, bełkot albo inny język niż oczekiwany.' } } },
    }),
};

/** Ranking kandydatów z faktów (czysta funkcja): modele z Ollamy {name, size, capabilities}. */
export function rankingZFaktow(zadanie, modele) {
    const z = ZADANIA[zadanie];
    const pref = (n) => { const i = z.preferuj.findIndex((p) => n.toLowerCase().startsWith(p)); return i < 0 ? 99 : i; };
    return modele
        .filter((m) => z.potrzeba.every((c) => (m.capabilities ?? []).includes(c)))
        .filter((m) => !/:cloud$|-cloud$/.test(m.name) && !/^llamacpp:/.test(m.name) && !ZGNIECIONY.test(m.name) && m.size > 0)
        .map((m) => ({ model: m.name, gb: Math.round((m.size / 1e9) * 10) / 10, kara: Math.abs(m.size / 1e9 - z.idealGB) + pref(m.name) * 0.3 }))
        .sort((a, b) => a.kara - b.kara)
        .filter((m, i, a) => a.findIndex((x) => x.model === m.model) === i);
}

/** Statystyki zadania z dziennika użyć: na model — próby, skuteczność, średnia ocena Jev, mediana ms. */
export function statystyki(wpisy = []) {
    const mapa = new Map();
    for (const w of wpisy) {
        const s = mapa.get(w.model) ?? { model: w.model, prob: 0, ok: 0, ocen: [], ms: [] };
        s.prob++; if (w.ok) s.ok++; if (Number.isFinite(w.ocena)) s.ocen.push(w.ocena); if (Number.isFinite(w.ms)) s.ms.push(w.ms);
        mapa.set(w.model, s);
    }
    return [...mapa.values()].map((s) => {
        const ms = [...s.ms].sort((a, b) => a - b);
        const sredniaJev = s.ocen.length ? Math.round((s.ocen.reduce((a, b) => a + b, 0) / s.ocen.length) * 100) / 100 : null;
        const skutecznosc = Math.round((s.ok / s.prob) * 100) / 100;
        return { model: s.model, prob: s.prob, skutecznosc, sredniaJev, ocenJev: s.ocen.length, medianaMs: ms.length ? ms[Math.floor(ms.length / 2)] : null, wynik: Math.round(skutecznosc * (sredniaJev ?? 0.5) * 100) / 100 };
    }).sort((a, b) => b.wynik - a.wynik || (a.medianaMs ?? 1e9) - (b.medianaMs ?? 1e9));
}

/**
 * @param {{ katalog: string, ollama: string, jev?: object|null, fetch?: Function }} o
 */
export function utworzModeleZadan({ katalog, ollama, jev = null, fetch: f = globalThis.fetch }) {
    const PLIK = () => path.join(katalog, 'modele-zadan.json');
    let pamiec = null;
    let modele = { kiedy: 0, lista: [] };
    async function wczytaj() { if (pamiec) return pamiec; try { pamiec = JSON.parse(await fs.readFile(PLIK(), 'utf8')); } catch { pamiec = {}; } pamiec.reczne ??= {}; pamiec.dziennik ??= {}; return pamiec; }
    async function zapisz() { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(PLIK(), JSON.stringify(pamiec, null, 2), 'utf8'); }

    /** Modele Ollamy z rozmiarem i zdolnościami (`/api/show`), schowek 5 min. */
    async function modeleOllamy() {
        if (Date.now() - modele.kiedy < 5 * 60_000 && modele.lista.length) return modele.lista;
        const tagi = (await (await f(`${ollama}/api/tags`, { signal: AbortSignal.timeout(8000) })).json())?.models ?? [];
        const lista = [];
        for (const m of tagi) {
            let capabilities = [];
            try { capabilities = (await (await f(`${ollama}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m.name }), signal: AbortSignal.timeout(8000) })).json())?.capabilities ?? []; } catch { /* model bez opisu */ }
            lista.push({ name: m.name, size: m.size ?? 0, capabilities });
        }
        modele = { kiedy: Date.now(), lista };
        return lista;
    }

    /** Model dla zadania + skąd wybór (reczny | dane | fakty) i kandydaci. */
    async function dla(zadanie) {
        if (!ZADANIA[zadanie]) throw new Error(`Nieznane zadanie: ${zadanie}`);
        const s = await wczytaj();
        const lista = await modeleOllamy();
        const jest = (n) => lista.some((m) => m.name === n);
        const kandydaci = rankingZFaktow(zadanie, lista);
        const env = zadanie === 'oczy' ? process.env.OTAKOS_OCZY_MODEL : null;
        if (env && jest(env)) return { model: env, zrodlo: 'env', kandydaci };
        if (s.reczne[zadanie] && jest(s.reczne[zadanie])) return { model: s.reczne[zadanie], zrodlo: 'reczny', kandydaci };
        const st = statystyki(s.dziennik[zadanie]).filter((x) => x.prob >= MIN_PROB && jest(x.model) && kandydaci.some((k) => k.model === x.model));
        if (st.length) return { model: st[0].model, zrodlo: 'dane', kandydaci, statystyki: st };
        if (!kandydaci.length) throw new Error(`Ollama nie ma modelu, który umie: ${ZADANIA[zadanie].potrzeba.join(' + ')} (${ZADANIA[zadanie].nazwa}). Pobierz np. gemma4:12b.`);
        return { model: kandydaci[0].model, zrodlo: 'fakty', kandydaci };
    }

    /** Zapis użycia + (gdy jest Jev i wynik) ocena jakości w tle. */
    async function notuj(zadanie, { model, ok, ms, wynik = null }) {
        const s = await wczytaj();
        const w = { kiedy: new Date().toISOString(), model, ok: !!ok, ms: Math.round(ms) };
        if (ok && wynik && jev?.stan?.().maKlucz && PYTANIA_JEV[zadanie]) {
            try { const d = await jev.zapytaj(PYTANIA_JEV[zadanie](wynik)); const p = Number(d?.answers?.jakosc?.noul); if (Number.isFinite(p)) w.ocena = Math.round(p * 100) / 100; }
            catch { /* Jev padł — zostaje skuteczność i czas */ }
        }
        s.dziennik[zadanie] = [...(s.dziennik[zadanie] ?? []), w].slice(-200);
        await zapisz();
        return w;
    }

    async function ustaw(zadanie, model) {
        if (!ZADANIA[zadanie]) throw new Error(`Nieznane zadanie: ${zadanie}`);
        const s = await wczytaj();
        if (model) {
            const m = (await modeleOllamy()).find((x) => x.name === model);
            if (!m) throw new Error(`Ollama nie ma modelu „${model}”.`);
            const brak = ZADANIA[zadanie].potrzeba.filter((c) => !(m.capabilities ?? []).includes(c));
            if (brak.length) throw new Error(`„${model}” nie umie: ${brak.join(', ')} — do zadania ${ZADANIA[zadanie].nazwa} się nie nada.`);
            s.reczne[zadanie] = model;
        } else delete s.reczne[zadanie];
        await zapisz();
        return dla(zadanie);
    }

    async function przeglad() {
        const s = await wczytaj();
        const out = {};
        for (const [id, z] of Object.entries(ZADANIA)) {
            let wybor = null, blad = null;
            try { wybor = await dla(id); } catch (e) { blad = e.message; }
            out[id] = { ...z, wybrany: wybor?.model ?? null, zrodlo: wybor?.zrodlo ?? null, kandydaci: wybor?.kandydaci?.slice(0, 6) ?? [], reczny: s.reczne[id] ?? null, statystyki: statystyki(s.dziennik[id]), uzyc: (s.dziennik[id] ?? []).length, blad };
        }
        return { zadania: out, jev: !!jev?.stan?.().maKlucz, minProb: MIN_PROB };
    }

    return { dla, notuj, ustaw, przeglad, modeleOllamy };
}

export default { utworzModeleZadan, rankingZFaktow, statystyki, ZADANIA, PYTANIA_JEV, MIN_PROB };
