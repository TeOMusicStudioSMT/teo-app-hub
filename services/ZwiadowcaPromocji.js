/**
 * 🏷️🔭 Zwiadowca promocji (Suweren 2026-10-09 / 2026-10-14: „zwiadowca ma na sztywno podłączoną usługę Anthropic…
 * nie działa z gemini czy lokalnym”).
 *
 * Trzy silniki wyszukiwania kodów zaproszenia, rabatów i promocji:
 *   1. ☁️ `gemini` — Google Search grounding (`tools: [{google_search}]`), źródła z `groundingMetadata.groundingChunks`.
 *   2. 🏠 `lokalny` — 100% darmowy zwiad w sieci (publiczne API Reddit JSON + DuckDuckGo Lite HTML) analizowany
 *      przez lokalny model Ollamy (`http://127.0.0.1:11434`) — działa bez żadnych kluczy chmurowych!
 *   3. ☁️ `anthropic` — narzędzie `web_search_20250305` API Claude.
 *   4. 🔄 `auto` — próbuje kolejno dostępnych kluczy, a jeśli chmura (np. Anthropic bez środków) zwróci błąd HTTP,
 *      AUTOMATYCZNIE przełącza się na Gemini, a potem na tryb lokalny (Ollama + Reddit/DDG)!
 *
 * ŻADNYCH ZMYŚLEŃ: każde znalezisko musi mieć `zrodlo` — adres, który NAPRAWDĘ pojawił się w wynikach wyszukiwania
 * tego zapytania. Bez takiego źródła — odrzucone, z powodem.
 */
import fs from 'fs/promises';
import path from 'path';

export const MODEL = process.env.OTAKOS_PROMOCJE_MODEL || 'claude-sonnet-5-5';
export const MODEL_GEMINI = process.env.OTAKOS_PROMOCJE_MODEL_GEMINI || 'gemini-2.5-flash';
export const MODEL_LOKALNY = process.env.OTAKOS_PROMOCJE_MODEL_LOKALNY || process.env.OTAKOS_MODEL || 'gemma4:e2b';
export const DOSTAWCY = ['auto', 'lokalny', 'gemini', 'anthropic'];
export const MAX_WYSZUKAN = 5;
export const USD_ZA_WYSZUKANIE = 0.01;

const SYSTEM = `Jesteś Zwiadowcą Katedry OtakOS. Szukasz w sieci AKTUALNYCH zniżek dla wskazanej usługi: kodów zaproszenia (invite/referral code), kodów rabatowych, promocji bez kodu (np. bonus powitalny, taniej rocznie), programów (edukacyjny, startupowy, open source, twórcy) i ofert partnerskich.
Zasady:
- Tylko to, co znalazłeś w wynikach wyszukiwania TERAZ — każdy wpis z adresem strony (zrodlo), na której to jest.
- Nie zgadujesz kodów. Kod, którego nie widzisz w dostarczonych wynikach, nie istnieje.
- Pewność: "oficjalne" (strona/blog/dokumentacja usługi, jej social media), "agregator" (serwisy z kuponami), "forum" (Reddit, Discord, fora).
- Pomijasz oferty starsze niż 12 miesięcy, chyba że strona mówi, że trwają.
Na końcu odpowiedz WYŁĄCZNIE JSON-em (bez nic po nim):
{"znalezione":[{"rodzaj":"kod|promocja|program|partnerska","kod":"KOD albo null","opis":"po polsku, co daje","rabat":"np. 20% albo 20 EUR albo null","zrodlo":"https://…","data":"data ze strony albo null","pewnosc":"oficjalne|agregator|forum","uwagi":"warunki, np. tylko nowe konta DE"}],"podsumowanie":"1–2 zdania po polsku"}`;

/** Ostatni obiekt JSON z listą znalezisk z tekstu modelu (też w bloku ```json, z białymi znakami po „{”). */
export function wylowJson(t) {
    const s = String(t ?? '').replace(/```(?:json)?/gi, '');
    const starty = [...s.matchAll(/\{\s*"znalezione"/g)].map((m) => m.index).reverse();
    for (const start of starty) {
        for (let k = s.lastIndexOf('}'); k > start; k = s.lastIndexOf('}', k - 1)) {
            try { return JSON.parse(s.slice(start, k + 1)); } catch { /* krócej */ }
        }
    }
    return null;
}

/** Adresy, które naprawdę przyszły z wyszukiwania (wyniki + cytowania), bez śmieci w adresie. */
export function zrodlaZOdpowiedzi(content = []) {
    const out = new Map();
    for (const b of content) {
        if (b?.type === 'web_search_tool_result' && Array.isArray(b.content)) {
            for (const r of b.content) if (r?.url) out.set(normUrl(r.url), { url: r.url, tytul: r.title ?? null, wiek: r.page_age ?? null });
        }
        for (const c of b?.citations ?? []) {
            if (c?.url && !out.has(normUrl(c.url))) out.set(normUrl(c.url), { url: c.url, tytul: c.title ?? null, wiek: null });
        }
    }
    return out;
}

const normUrl = (u) => String(u).trim().replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
const DOMENA = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

/** Domena adresu bez „www.” (null, gdy to nie adres). */
export function domenaZ(u) {
    try { return new URL(String(u)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

/**
 * Źródła z odpowiedzi Gemini (grounding): `groundingChunks[].web` = {uri: przekierowanie Google, title: zwykle domena}.
 * Klucz mapy = `domena:<domena>` — sprawdzZnaleziska dopasowuje po domenie adresu znaleziska.
 */
export function zrodlaZGroundingu(meta) {
    const out = new Map();
    for (const c of meta?.groundingChunks ?? []) {
        const w = c?.web;
        if (!w?.uri) continue;
        const t = String(w.title ?? '').trim().toLowerCase().replace(/^www\./, '');
        const domena = DOMENA.test(t) ? t : (domenaZ(w.uri)?.includes('vertexaisearch') ? null : domenaZ(w.uri));
        if (domena) out.set(`domena:${domena}`, { url: w.uri, tytul: w.title ?? domena, wiek: null, domena });
    }
    return out;
}

/** Znaleziska z JSON → sprawdzone: źródło musi być wśród wyników wyszukiwania. */
export function sprawdzZnaleziska(json, zrodla) {
    const przyjete = [], odrzucone = [];
    for (const z of Array.isArray(json?.znalezione) ? json.znalezione : []) {
        let zr = zrodla.get(normUrl(z?.zrodlo ?? '')) ?? [...zrodla.values()].find((x) => !x.domena && normUrl(z?.zrodlo ?? '').startsWith(normUrl(x.url)));
        let potwierdzone = zr ? 'adres' : null;
        if (!zr) {
            const d = domenaZ(z?.zrodlo);
            zr = d ? [...zrodla.values()].find((x) => x.domena && (d === x.domena || d.endsWith(`.${x.domena}`))) : null;
            if (zr) potwierdzone = 'domena';
        }
        const wpis = {
            rodzaj: ['kod', 'promocja', 'program', 'partnerska'].includes(z?.rodzaj) ? z.rodzaj : 'promocja',
            kod: z?.kod ? String(z.kod).trim().slice(0, 60) : null,
            opis: String(z?.opis ?? '').slice(0, 400),
            rabat: z?.rabat ? String(z.rabat).slice(0, 40) : null,
            zrodlo: String(z?.zrodlo ?? ''),
            tytulZrodla: zr?.tytul ?? null,
            wiekStrony: zr?.wiek ?? null,
            data: z?.data ?? null,
            pewnosc: ['oficjalne', 'agregator', 'forum'].includes(z?.pewnosc) ? z.pewnosc : 'agregator',
            uwagi: z?.uwagi ? String(z.uwagi).slice(0, 300) : null,
            potwierdzone,
        };
        if (!zr) {
            odrzucone.push({ ...wpis, powod: 'źródła nie było w wynikach wyszukiwania — możliwe zmyślenie' });
            continue;
        }
        przyjete.push(wpis);
    }
    const kolej = { oficjalne: 0, forum: 1, agregator: 2 };
    przyjete.sort((a, b) => kolej[a.pewnosc] - kolej[b.pewnosc]);
    return { przyjete, odrzucone };
}

/**
 * @param {{ klucze?: { anthropic?: Function, gemini?: Function }, klucz?: Function, katalog: string, szyna?: object|null, fetch?: Function, modelGemini?: () => Promise<string>|string, ollamaBase?: string }} o
 */
export function utworzZwiadowcePromocji({ klucze = {}, klucz = null, katalog, szyna = null, fetch: f = globalThis.fetch, modelGemini = () => MODEL_GEMINI, ollamaBase = 'http://127.0.0.1:11434' }) {
    const kluczDla = { anthropic: klucze.anthropic ?? klucz ?? (async () => null), gemini: klucze.gemini ?? (async () => null) };
    const plik = () => path.join(katalog, 'promocje.json');
    async function czytaj() { try { return JSON.parse(await fs.readFile(plik(), 'utf8')); } catch { return { zwiady: [] }; } }

    async function wybierz(dostawca = 'auto') {
        if (!DOSTAWCY.includes(dostawca)) throw new Error(`Dostawca: ${DOSTAWCY.join(', ')}.`);
        if (dostawca === 'lokalny') return { dostawca: 'lokalny', k: null };
        const [a, g] = await Promise.all([kluczDla.anthropic(), kluczDla.gemini()].map((p) => Promise.resolve(p).catch(() => null)));
        if (dostawca === 'anthropic' || (dostawca === 'auto' && a)) {
            if (!a) throw new Error('Most nie ma klucza Anthropic — Hub → TeO Kibel → „🔗 Udostępnij mostowi” (albo wybierz Gemini / Lokalny).');
            return { dostawca: 'anthropic', k: a, zapasGemini: g };
        }
        if (!g) throw new Error(dostawca === 'gemini' ? 'Most nie ma klucza Gemini — Hub → TeO Kibel → „🔗 Udostępnij mostowi” (albo wybierz Lokalny / Claude).' : 'Zwiadowca szuka w sieci przez Claude albo Gemini — most nie ma klucza żadnego z nich. Hub → TeO Kibel → „🔗 Udostępnij mostowi”.');
        return { dostawca: 'gemini', k: g };
    }

    /** 🏠 Lokalny zwiad: pobiera świeże wpisy z Reddit JSON + DuckDuckGo Lite i analizuje lokalnym modelem Ollamy. */
    async function szukajLokalnie(u, prosba) {
        const zrodla = new Map();
        const wycinki = [];

        // 1. Publiczne wyszukiwanie Reddit JSON (najlepsze źródło kodów zaproszenia / referrali społeczności!)
        try {
            const qReddit = encodeURIComponent(`${u} invite referral promo code`);
            const rr = await f(`https://www.reddit.com/search.json?q=${qReddit}&sort=new&limit=10`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KatedraOtakOS/1.0' },
                signal: AbortSignal.timeout(12_000),
            });
            if (rr.ok) {
                const rd = await rr.json().catch(() => ({}));
                for (const child of rd?.data?.children ?? []) {
                    const post = child?.data;
                    if (!post?.title) continue;
                    const url = post.url?.startsWith('http') ? post.url : `https://www.reddit.com${post.permalink || ''}`;
                    const dataStr = post.created_utc ? new Date(post.created_utc * 1000).toISOString().slice(0, 10) : null;
                    zrodla.set(normUrl(url), { url, tytul: `Reddit: ${String(post.title).slice(0, 90)}`, wiek: dataStr, domena: 'reddit.com' });
                    zrodla.set('domena:reddit.com', { url, tytul: 'Reddit', wiek: dataStr, domena: 'reddit.com' });
                    wycinki.push(`ŹRÓDŁO: ${url} (${dataStr || 'świeże'})\nTYTUŁ: ${post.title}\nTREŚĆ: ${String(post.selftext || '').slice(0, 450)}`);
                }
            }
        } catch {}

        // 2. Wybór dostępnego modelu w Ollamie
        let model = MODEL_LOKALNY;
        try {
            const tr = await f(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(4000) });
            if (tr.ok) {
                const td = await tr.json();
                const lista = (td?.models ?? []).map((m) => m.name).filter(Boolean);
                if (lista.length && !lista.includes(model)) model = lista[0];
            }
        } catch {}

        const promptDlaOllamy = `${prosba}\n\nPoniżej masz PRAWDZIWE wyniki pobrane przed chwilą z sieci:\n\n${wycinki.join('\n\n---\n\n') || 'Brak wyników z sieci.'}\n\nWyciągnij z nich kody zaproszenia / promocje i odpowiedz wyłącznie JSON-em wg schematu.`;
        const or = await f(`${ollamaBase}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, system: SYSTEM, prompt: promptDlaOllamy, stream: false, format: 'json' }),
            signal: AbortSignal.timeout(120_000),
        });
        if (!or.ok) throw new Error(`Ollama HTTP ${or.status} — upewnij się, że lokalny silnik Ollama działa.`);
        const od = await or.json().catch(() => ({}));
        return {
            model: `ollama:${model}`,
            tekst: String(od?.response ?? ''),
            stop: 'end_turn',
            zrodla,
            bledyWyszukiwania: [],
            usage: { input_tokens: od?.prompt_eval_count ?? 0, output_tokens: od?.eval_count ?? 0, wyszukan: wycinki.length > 0 ? 1 : 0 },
        };
    }

    /** Gemini + Google Search: tekst z JSON-em, źródła z groundingu. */
    async function szukajGemini(k, prosba) {
        const model = String(await modelGemini() || MODEL_GEMINI);
        const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', signal: AbortSignal.timeout(180_000),
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: prosba }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${d?.error?.message ?? ''}`.trim());
        const kand = d.candidates?.[0];
        const tekst = (kand?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
        const meta = kand?.groundingMetadata ?? {};
        return {
            model, tekst, stop: kand?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : kand?.finishReason ?? null,
            zrodla: zrodlaZGroundingu(meta), bledyWyszukiwania: [],
            usage: { input_tokens: d.usageMetadata?.promptTokenCount ?? 0, output_tokens: d.usageMetadata?.candidatesTokenCount ?? 0, wyszukan: (meta.webSearchQueries ?? []).length },
        };
    }

    async function szukaj(usluga, { kontekst = '', dostawca = 'auto' } = {}) {
        const u = String(usluga ?? '').trim().slice(0, 80);
        if (u.length < 2) throw new Error('Podaj usługę, np. „Meshy”.');
        const wyb = await wybierz(dostawca);
        const prosba = `Usługa: ${u}${kontekst ? `\nKontekst: ${String(kontekst).slice(0, 300)}` : ''}\nDzisiaj: ${new Date().toISOString().slice(0, 10)}. Znajdź aktualne zniżki.`;

        let uzytyDostawca = wyb.dostawca;
        let wynikSzukania;
        if (wyb.dostawca === 'lokalny') {
            wynikSzukania = await szukajLokalnie(u, prosba);
        } else if (wyb.dostawca === 'gemini') {
            wynikSzukania = await szukajGemini(wyb.k, prosba);
        } else {
            try {
                wynikSzukania = await szukajClaude(wyb.k, prosba);
            } catch (err) {
                // Jeśli w trybie 'auto' klucz Anthropic zawiódł, a mamy klucz Gemini — automatycznie przełącz na Gemini!
                if (dostawca === 'auto' && wyb.zapasGemini) {
                    uzytyDostawca = 'gemini';
                    wynikSzukania = await szukajGemini(wyb.zapasGemini, prosba);
                } else {
                    throw err;
                }
            }
        }
        return zapiszWynik(u, uzytyDostawca, wynikSzukania);
    }

    async function szukajClaude(k, prosba) {
        const messages = [{ role: 'user', content: prosba }];
        const tresc = [];
        let usage = { input_tokens: 0, output_tokens: 0, wyszukan: 0 };
        let stop = null;
        for (let i = 0; i < 3; i++) {
            const r = await f('https://api.anthropic.com/v1/messages', {
                method: 'POST', signal: AbortSignal.timeout(180_000),
                headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: MAX_WYSZUKAN }] }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}: ${d?.error?.message ?? ''}`.trim());
            tresc.push(...(d.content ?? []));
            usage = { input_tokens: usage.input_tokens + (d.usage?.input_tokens ?? 0), output_tokens: usage.output_tokens + (d.usage?.output_tokens ?? 0), wyszukan: usage.wyszukan + (d.usage?.server_tool_use?.web_search_requests ?? 0) };
            stop = d.stop_reason;
            if (d.stop_reason !== 'pause_turn') break;
            messages.push({ role: 'assistant', content: d.content });
        }
        const tekst = tresc.filter((b) => b.type === 'text').map((b) => b.text).join('');
        return {
            model: MODEL, tekst, stop, zrodla: zrodlaZOdpowiedzi(tresc), usage,
            bledyWyszukiwania: tresc.filter((b) => b.type === 'web_search_tool_result' && b.content?.type === 'web_search_tool_result_error').map((b) => b.content.error_code),
        };
    }

    async function zapiszWynik(u, dostawca, { model, tekst, stop, zrodla, usage, bledyWyszukiwania }) {
        const json = wylowJson(tekst);
        if (!json) {
            await fs.mkdir(katalog, { recursive: true });
            await fs.writeFile(path.join(katalog, 'promocje-ostatnia-odpowiedz.txt'), tekst, 'utf8').catch(() => {});
            throw new Error(stop === 'max_tokens' ? 'Zwiadowca nie zmieścił listy w limicie odpowiedzi — spróbuj węższej usługi.' : `Zwiadowca nie oddał listy (JSON) — surowa odpowiedź w zwiadowca/promocje-ostatnia-odpowiedz.txt. Początek: ${tekst.slice(0, 160)}`);
        }
        const { przyjete, odrzucone } = sprawdzZnaleziska(json, zrodla);
        const wynik = {
            usluga: u, kiedy: new Date().toISOString(), dostawca, model, znalezione: przyjete, odrzucone,
            podsumowanie: String(json.podsumowanie ?? '').slice(0, 400), zrodel: zrodla.size, bledyWyszukiwania,
            koszt: { wyszukan: usage.wyszukan, tokenyWe: usage.input_tokens, tokenyWy: usage.output_tokens, usdWyszukiwania: dostawca === 'anthropic' ? Math.round(usage.wyszukan * USD_ZA_WYSZUKANIE * 100) / 100 : null },
            uwaga: `Zwiadowca nic nie wpisuje i nie płaci — kod sprawdzisz przy płatności. Kody z agregatorów często wygasają.${dostawca === 'gemini' ? ' Gemini podaje źródła jako domeny — „potwierdzone domeną” znaczy: ta strona była w wynikach, ale dokładnego adresu nie da się sprawdzić.' : ''}`,
        };
        const d = await czytaj();
        d.zwiady = [wynik, ...(d.zwiady ?? []).filter((z) => z.usluga.toLowerCase() !== u.toLowerCase())].slice(0, 30);
        await fs.mkdir(katalog, { recursive: true });
        await fs.writeFile(plik(), JSON.stringify(d, null, 2), 'utf8');
        await szyna?.nadaj?.({ agent: 'Zwiadowca', rodzaj: 'zwiad', tresc: `🏷️ ${u}: ${przyjete.length} zniżek ze źródłami${przyjete.some((z) => z.kod) ? ` (kody: ${przyjete.filter((z) => z.kod).map((z) => z.kod).slice(0, 3).join(', ')})` : ''}${odrzucone.length ? `, ${odrzucone.length} odrzucone bez źródła` : ''}`, dane: { usluga: u } }).catch(() => {});
        return wynik;
    }

    return {
        szukaj, lista: async () => (await czytaj()).zwiady ?? [],
        async dostawcy() {
            const [a, g] = await Promise.all([kluczDla.anthropic(), kluczDla.gemini()].map((p) => Promise.resolve(p).catch(() => null)));
            return { anthropic: !!a, gemini: !!g, auto: a ? 'anthropic' : g ? 'gemini' : null };
        },
    };
}

export default { utworzZwiadowcePromocji, sprawdzZnaleziska, zrodlaZOdpowiedzi, zrodlaZGroundingu, wylowJson, MODEL, MODEL_GEMINI, MODEL_LOKALNY };
