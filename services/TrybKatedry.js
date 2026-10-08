/**
 * ☁️/🏠 TRYB KATEDRY — jeden przełącznik CLOUD / JusT dla całej Katedry (Suweren 2026-10-08: „rób przełącznik
 * na całą Katedrę”). Dotąd przycisk w nagłówku Huba czytały tylko Akademia i Fashion; czat, Kodeks, stado,
 * Kustosz, Tłumacz i ~40 innych miejsc wołały Ollamę wprost.
 *
 * JEDEN PUNKT: most podmienia globalny `fetch` (zainstalujFetch). W trybie `chmura` każde wywołanie Ollamy
 * `/api/generate` i `/api/chat` idzie do chmury z Kibla (Claude albo Gemini) i wraca w KSZTAŁCIE OLLAMY
 * (także strumień NDJSON) — moduły nie wiedzą, że mówiły z chmurą. Lokalnie zostaje UCZCIWIE:
 * wywołania z obrazami (`images`), z narzędziami (`tools`), embeddingi i wszystko inne niż te dwie trasy.
 *
 * Koszt pod kontrolą: licznik tokenów na dziś (z odpowiedzi dostawcy) i dzienny limit — po jego przekroczeniu
 * Katedra wraca do lokalnych modeli sama i mówi dlaczego (stan.powod). Bez klucza chmury = lokalnie + powód.
 * Stan: `_OtakOs_Wymiar/tryb-katedry.json` {tryb: 'lokalnie'|'chmura', dostawca: 'auto'|'anthropic'|'gemini',
 * model?, limitTokenow, dzien, tokeny, wywolan}. Domyślnie `lokalnie` (0.00G).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const DOMYSLNE_MODELE = { anthropic: 'claude-sonnet-5-5', gemini: 'gemini-3.8-flash' };
export const DOMYSLNY_LIMIT = 2_000_000;   // tokenów dziennie (wejście + wyjście)

const dzisiaj = (teraz) => new Date(teraz()).toISOString().slice(0, 10);

/**
 * @param {{ katalog: string, klucz: (dostawca: 'anthropic'|'gemini') => string|null, ollamaBase: string, fetch?: Function, teraz?: () => number }} o
 */
export function utworzTryb({ katalog, klucz, ollamaBase, fetch: f = globalThis.fetch, teraz = () => Date.now() }) {
    const plik = path.join(katalog, 'tryb-katedry.json');
    let s = { tryb: 'lokalnie', dostawca: 'auto', model: null, limitTokenow: DOMYSLNY_LIMIT, dzien: dzisiaj(teraz), tokeny: 0, wywolan: 0 };
    try { s = { ...s, ...JSON.parse(fsSync.readFileSync(plik, 'utf8')) }; } catch { /* pierwszy raz */ }
    let zapisDo = null;
    const zapisz = () => { clearTimeout(zapisDo); zapisDo = setTimeout(() => { fs.mkdir(katalog, { recursive: true }).then(() => fs.writeFile(plik, JSON.stringify(s, null, 2), 'utf8')).catch(() => {}); }, 500); };
    const nowyDzien = () => { const d = dzisiaj(teraz); if (s.dzien !== d) { s.dzien = d; s.tokeny = 0; s.wywolan = 0; } };

    /** Dostawca i model chmury, którym naprawdę możemy mówić — albo null z powodem. */
    function chmura() {
        const kolejnosc = s.dostawca === 'auto' ? ['anthropic', 'gemini'] : [s.dostawca];
        for (const d of kolejnosc) {
            const k = klucz(d);
            if (k) return { dostawca: d, model: (s.model && (s.dostawca === d)) ? s.model : DOMYSLNE_MODELE[d], klucz: k };
        }
        return null;
    }

    /** Czy TERAZ mówimy z chmurą (tryb + klucz + limit). */
    function aktywna() {
        nowyDzien();
        if (s.tryb !== 'chmura') return { tak: false, powod: null };
        const c = chmura();
        if (!c) return { tak: false, powod: 'tryb CLOUD, ale most nie ma klucza chmury — Kibel → „🔗 Udostępnij mostowi”; liczę lokalnie' };
        if (s.limitTokenow > 0 && s.tokeny >= s.limitTokenow) return { tak: false, powod: `dzienny limit chmury (${s.limitTokenow} tokenów) wyczerpany — do jutra liczę lokalnie` };
        return { tak: true, ...c };
    }

    function stan() {
        const a = aktywna();
        const c = chmura();
        return { tryb: s.tryb, dostawca: s.dostawca, model: s.model, limitTokenow: s.limitTokenow, dzis: { dzien: s.dzien, tokeny: s.tokeny, wywolan: s.wywolan },
            chmuraAktywna: a.tak, powod: a.powod, wybrany: c ? `${c.dostawca}:${c.model}` : null, ostatniBlad: s.ostatniBlad ?? null };
    }

    function ustaw({ tryb, dostawca, model, limitTokenow } = {}) {
        if (tryb !== undefined) { if (!['lokalnie', 'chmura'].includes(tryb)) throw new Error('Tryb: lokalnie albo chmura.'); s.tryb = tryb; }
        if (dostawca !== undefined) { if (!['auto', 'anthropic', 'gemini'].includes(dostawca)) throw new Error('Dostawca: auto, anthropic albo gemini.'); s.dostawca = dostawca; }
        if (model !== undefined) s.model = model ? String(model).replace(/^(claude|gemini):/, '').slice(0, 80) : null;
        if (limitTokenow !== undefined) s.limitTokenow = Math.max(0, Math.floor(Number(limitTokenow) || 0));
        zapisz();
        return stan();
    }

    /** Model dla Kodeksa/produkcji: w chmurze `claude:…`/`gemini:…`, inaczej podany lokalny. */
    function modelDla(lokalny) {
        const a = aktywna();
        return a.tak ? `${a.dostawca === 'anthropic' ? 'claude' : 'gemini'}:${a.model}` : lokalny;
    }

    // ── tłumaczenie Ollama ↔ chmura ──────────────────────────────────────────
    async function mow({ dostawca, model, klucz: k }, { system, wiadomosci, json, temperatura }) {
        const sys = [system, json ? 'Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON, bez markdown i komentarzy.' : ''].filter(Boolean).join('\n\n');
        if (dostawca === 'anthropic') {
            const r = await f('https://api.anthropic.com/v1/messages', {
                method: 'POST', signal: AbortSignal.timeout(600_000),
                headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model, max_tokens: 16000, ...(sys ? { system: sys } : {}), ...(temperatura !== undefined ? { temperature: Math.min(1, temperatura) } : {}), messages: wiadomosci }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(`Claude HTTP ${r.status}: ${d?.error?.message || ''}`.trim());
            return { tekst: (d.content || []).map((c) => c.text || '').join(''), wej: d.usage?.input_tokens || 0, wyj: d.usage?.output_tokens || 0 };
        }
        const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', signal: AbortSignal.timeout(600_000),
            headers: { 'content-type': 'application/json', 'x-goog-api-key': k },
            body: JSON.stringify({
                ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
                contents: wiadomosci.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
                generationConfig: { maxOutputTokens: 32000, ...(temperatura !== undefined ? { temperature: temperatura } : {}), ...(json ? { responseMimeType: 'application/json' } : {}) },
            }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${d?.error?.message || ''}`.trim());
        return { tekst: (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''), wej: d.usageMetadata?.promptTokenCount || 0, wyj: d.usageMetadata?.candidatesTokenCount || 0 };
    }

    /** Wiadomości Ollamy → {system, wiadomosci} chmury (kolejne tej samej roli sklejone — Claude tego wymaga). */
    function zCzatu(messages = []) {
        const system = messages.filter((m) => m.role === 'system').map((m) => String(m.content || '')).join('\n\n');
        const out = [];
        for (const m of messages.filter((x) => x.role !== 'system')) {
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            const content = String(m.content || '');
            if (out.length && out.at(-1).role === role) out.at(-1).content += `\n\n${content}`; else out.push({ role, content });
        }
        if (!out.length || out[0].role !== 'user') out.unshift({ role: 'user', content: '(początek rozmowy)' });
        return { system, wiadomosci: out };
    }

    const odpowiedz = (cialo, strumien) => new Response(strumien ? cialo.map((c) => JSON.stringify(c)).join('\n') + '\n' : JSON.stringify(cialo.at(-1)), {
        status: 200, headers: { 'content-type': strumien ? 'application/x-ndjson' : 'application/json', 'x-tryb-katedry': 'chmura' },
    });

    /**
     * Przechwycenie wywołania Ollamy. Zwraca Response (chmura) albo null (niech idzie lokalnie).
     * @param {string|URL|Request} url @param {RequestInit} [init]
     */
    async function przechwyc(url, init) {
        const adres = String(url instanceof Request ? url.url : url);
        // Część serwisów ma adres Ollamy na sztywno (127.0.0.1:11434) — łapiemy każdy z nich, nie tylko OLLAMA_HOST.
        const baza = [ollamaBase, 'http://127.0.0.1:11434', 'http://localhost:11434'].find((b) => adres.startsWith(b));
        if (!baza) return null;
        const trasa = adres.slice(baza.length).split('?')[0];
        if (trasa !== '/api/generate' && trasa !== '/api/chat') return null;
        if (String(init?.method || 'GET').toUpperCase() !== 'POST' || typeof init?.body !== 'string') return null;
        const a = aktywna();
        if (!a.tak) return null;
        let b;
        try { b = JSON.parse(init.body); } catch { return null; }
        // Uczciwie lokalnie: obrazy, narzędzia, rozgrzewka/zwolnienie modelu (pusty prompt, keep_alive).
        if (b.images?.length || b.tools?.length || b.messages?.some((m) => m.images?.length)) return null;
        if (trasa === '/api/generate' && !String(b.prompt || '').trim()) return null;
        const json = b.format === 'json' || (b.format && typeof b.format === 'object');
        const temperatura = b.options?.temperature;
        const wejscie = trasa === '/api/chat' ? zCzatu(b.messages) : { system: b.system || '', wiadomosci: [{ role: 'user', content: String(b.prompt) }] };
        const strumien = b.stream !== false;
        const model = `${a.dostawca === 'anthropic' ? 'claude' : 'gemini'}:${a.model}`;
        try {
            const w = await mow(a, { ...wejscie, json, temperatura });
            nowyDzien(); s.tokeny += w.wej + w.wyj; s.wywolan++; zapisz();
            const czesc = trasa === '/api/chat' ? { message: { role: 'assistant', content: w.tekst } } : { response: w.tekst };
            const pusta = trasa === '/api/chat' ? { message: { role: 'assistant', content: '' } } : { response: '' };
            const koniec = { model, created_at: new Date(teraz()).toISOString(), done: true, done_reason: 'stop', prompt_eval_count: w.wej, eval_count: w.wyj, ...pusta };
            return strumien ? odpowiedz([{ model, done: false, ...czesc }, koniec], true) : odpowiedz([{ ...koniec, ...czesc }], false);
        } catch (e) {
            // Chmura padła (kredyty, sieć) — nie wywracamy modułu: idzie lokalnie, a powód zostaje w stanie.
            s.ostatniBlad = { kiedy: new Date(teraz()).toISOString(), tekst: String(e.message).slice(0, 300) }; zapisz();
            return null;
        }
    }

    return { stan, ustaw, modelDla, przechwyc, aktywna };
}

/** Podmiana globalnego fetch: najpierw Tryb Katedry, potem prawdziwy fetch. Zwraca oryginał. */
export function zainstalujFetch(tryb) {
    const oryginal = globalThis.fetch;
    globalThis.fetch = async (url, init) => (await tryb.przechwyc(url, init)) ?? oryginal(url, init);
    return oryginal;
}

export default { utworzTryb, zainstalujFetch, DOMYSLNE_MODELE, DOMYSLNY_LIMIT };
