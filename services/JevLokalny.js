/**
 * 🧭 Jev lokalny — Dyrygent ds. Kreatywnych na embeddingach (Suweren 2026-10-08: „embeddinggemma 2 może być
 * lokalnym JEV-em… damy Jev/EG2 rolę katedralnego Dyrygenta do spraw Kreatywnych”).
 *
 * Embeddingi mierzą PODOBIEŃSTWO znaczeń. To uczciwie zastępuje Jev tylko przy WYBORZE (`choice`): zadanie
 * i opisy opcji → wektory → cosinus → rozkład prawdopodobieństwa (softmax). Pytań tak/nie (`noul`) i skali
 * (`score`) embeddingi nie rozstrzygną — tam mówimy wprost, że trzeba Jev z chmury.
 * Ten sam kontrakt co services/Jev.js (`zapytaj({state, questions})`, `stan()`), więc Dyrygent bierze go
 * zamiast chmury bez zmian. Model: `OTAKOS_JEV_LOKALNY_MODEL` (domyślnie EG2 z HF przez Ollamę).
 *
 * ⚠ 2026-10-08: Ollama 0.40.0 NIE uruchamia EG2 („unknown model architecture: gemma-embedding2”) — `dostepny()`
 * zwraca wtedy fałsz z powodem; zadziała po aktualizacji Ollamy albo z innym modelem embeddingowym.
 */
export const MODEL_DOMYSLNY = process.env.OTAKOS_JEV_LOKALNY_MODEL || 'hf.co/unsloth/embeddinggemma-2-GGUF:Q8_0';
/** Ostrość rozkładu: cosinusy embeddingów leżą blisko siebie (0,3–0,7) — bez skalowania wszystko byłoby „po równo”. */
const TEMPERATURA = 0.04;

export function cosinus(a, b) {
    let s = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? s / Math.sqrt(na * nb) : 0;
}
export function softmax(xs, t = TEMPERATURA) {
    const m = Math.max(...xs);
    const e = xs.map((x) => Math.exp((x - m) / t));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / s);
}
const tekst = (x) => (typeof x === 'string' ? x : JSON.stringify(x ?? ''));

/**
 * @param {{ ollamaBase?: string, model?: () => string, fetch?: Function }} o
 */
export function utworzJevLokalny({ ollamaBase = 'http://127.0.0.1:11434', model = () => MODEL_DOMYSLNY, fetch: f = globalThis.fetch } = {}) {
    const zdrowie = { kiedy: 0, ok: null, powod: null };

    async function osadz(teksty) {
        const r = await f(`${ollamaBase}/api/embed`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120_000),
            body: JSON.stringify({ model: model(), input: teksty.map((t) => String(t).slice(0, 4000)) }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !Array.isArray(d.embeddings)) throw new Error(`Jev lokalny (${model()}): ${String(d.error ?? `HTTP ${r.status}`).slice(0, 200)}`);
        return d.embeddings;
    }

    /** Czy model embeddingowy wstaje (wynik pamiętany 5 min — nie męczymy Ollamy przy każdym doborze). */
    async function dostepny() {
        if (Date.now() - zdrowie.kiedy < 5 * 60_000 && zdrowie.ok !== null) return zdrowie.ok;
        try { await osadz(['test']); zdrowie.ok = true; zdrowie.powod = null; }
        catch (e) { zdrowie.ok = false; zdrowie.powod = e.message; }
        zdrowie.kiedy = Date.now();
        return zdrowie.ok;
    }

    /** Kontrakt Jev: tylko `choice` (wybór). Zwraca { model, answers: { k: { type, choice, probabilities, confidence } } }. */
    async function zapytaj({ state = {}, questions = {} }) {
        const kontekst = Object.entries(state).map(([k, v]) => `${k}: ${tekst(v)}`).join('\n').slice(0, 2500);
        const answers = {};
        for (const [klucz, q] of Object.entries(questions)) {
            if (q?.type !== 'choice') throw new Error(`Jev lokalny (embeddingi) umie tylko wybór — pytanie „${klucz}” (${q?.type}) wymaga Jev z chmury.`);
            const opcje = Object.entries(q.criteria ?? {});
            if (!opcje.length) throw new Error(`Pytanie „${klucz}” bez opcji.`);
            const [zap, ...wekt] = await osadz([`${tekst(q.instructions)}\n${kontekst}`, ...opcje.map(([n, opis]) => `${n}: ${tekst(opis)}`)]);
            const pr = softmax(wekt.map((w) => cosinus(zap, w)));
            const probabilities = Object.fromEntries(opcje.map(([n], i) => [n, Math.round(pr[i] * 1000) / 1000]));
            const naj = opcje.map(([n], i) => [n, pr[i]]).sort((a, b) => b[1] - a[1])[0];
            answers[klucz] = { type: 'choice', choice: naj[0], probabilities, confidence: Math.round(naj[1] * 1000) / 1000 };
        }
        return { model: `lokalny:${model()}`, answers, usage: null };
    }

    return { zapytaj, osadz, dostepny, stan: () => ({ maKlucz: zdrowie.ok !== false, lokalny: true, model: model(), powod: zdrowie.powod }) };
}

export default { utworzJevLokalny, cosinus, softmax, MODEL_DOMYSLNY };
