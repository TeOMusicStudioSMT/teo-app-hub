/**
 * 🏷️🔭 Zwiadowca promocji (Suweren 2026-10-09: „dodaj Zwiadowcy zdolność wyszukiwania kodów rabatowych, np. Meshy :D”).
 *
 * Most nie ma własnej wyszukiwarki — bierzemy oficjalne narzędzie wyszukiwania API Claude (`web_search_20250305`,
 * $10 / 1000 wyszukiwań + tokeny; klucz Anthropic z Kibla). Claude szuka AKTUALNYCH kodów, promocji i programów
 * (edukacyjne, startupowe, roczne plany) dla wskazanej usługi i oddaje JSON.
 *
 * ŻADNYCH ZMYŚLEŃ: każde znalezisko musi mieć `zrodlo` — adres, który NAPRAWDĘ pojawił się w wynikach wyszukiwania
 * tego zapytania (bloki `web_search_tool_result` / cytowania). Bez takiego źródła — odrzucone, z powodem.
 *
 * ☁️ Nie tylko Claude (Suweren 2026-10-14: „gdzie jest na sztywno wpisany tylko Anthropic — umożliw inne chmury”):
 * `dostawca` auto | anthropic | gemini. Gemini szuka narzędziem Google Search (grounding, `tools: [{google_search}]`);
 * jego źródła (`groundingMetadata.groundingChunks`) to adresy-przekierowania Google z DOMENĄ strony w tytule —
 * więc znalezisko przechodzi, gdy domena jego adresu była wśród źródeł (`potwierdzone: 'domena'`, słabsze niż adres).
 * auto = Anthropic, gdy most ma jego klucz, inaczej Gemini.
 * Zwiadowca NIC nie wpisuje i nie płaci: kod sprawdzasz sam przy płatności. Kody z agregatorów często wygasają —
 * oznaczamy pewność (oficjalne / agregator / forum) i datę strony.
 */
import fs from 'fs/promises';
import path from 'path';

export const MODEL = process.env.OTAKOS_PROMOCJE_MODEL || 'claude-sonnet-5-5';
export const MODEL_GEMINI = process.env.OTAKOS_PROMOCJE_MODEL_GEMINI || 'gemini-2.5-flash';
export const DOSTAWCY = ['auto', 'anthropic', 'gemini'];
export const MAX_WYSZUKAN = 5;
export const USD_ZA_WYSZUKANIE = 0.01;

const SYSTEM = `Jesteś Zwiadowcą Katedry OtakOS. Szukasz w sieci AKTUALNYCH zniżek dla wskazanej usługi: kodów rabatowych, promocji bez kodu (np. taniej rocznie), programów (edukacyjny, startupowy, open source, twórcy) i ofert partnerskich.
Zasady:
- Tylko to, co znalazłeś w wynikach wyszukiwania TERAZ — każdy wpis z adresem strony (zrodlo), na której to jest.
- Nie zgadujesz kodów. Kod, którego nie widzisz na stronie, nie istnieje.
- Pewność: "oficjalne" (strona/blog/dokumentacja usługi, jej social media), "agregator" (serwisy z kuponami), "forum" (Reddit, Discord, fora).
- Pomijasz oferty starsze niż 12 miesięcy, chyba że strona mówi, że trwają.
Na końcu odpowiedz WYŁĄCZNIE JSON-em (bez nic po nim):
{"znalezione":[{"rodzaj":"kod|promocja|program|partnerska","kod":"KOD albo null","opis":"po polsku, co daje","rabat":"np. 20% albo null","zrodlo":"https://…","data":"data ze strony albo null","pewnosc":"oficjalne|agregator|forum","uwagi":"warunki, np. tylko nowe konta"}],"podsumowanie":"1–2 zdania po polsku"}`;

/** Ostatni obiekt JSON z listą znalezisk z tekstu modelu (też w bloku ```json, z białymi znakami po „{”). */
export function wylowJson(t) {
    const s = String(t ?? '').replace(/```(?:json)?/gi, '');
    const starty = [...s.matchAll(/\{\s*"znalezione"/g)].map((m) => m.index).reverse();
    for (const start of starty) {
        for (let k = s.lastIndexOf('}'); k > start; k = s.lastIndexOf('}', k - 1)) { try { return JSON.parse(s.slice(start, k + 1)); } catch { /* krócej */ } }
    }
    return null;
}

/** Adresy, które naprawdę przyszły z wyszukiwania (wyniki + cytowania), bez śmieci w adresie. */
export function zrodlaZOdpowiedzi(content = []) {
    const out = new Map();
    for (const b of content) {
        if (b?.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r?.url) out.set(normUrl(r.url), { url: r.url, tytul: r.title ?? null, wiek: r.page_age ?? null });
        for (const c of b?.citations ?? []) if (c?.url && !out.has(normUrl(c.url))) out.set(normUrl(c.url), { url: c.url, tytul: c.title ?? null, wiek: null });
    }
    return out;
}
const normUrl = (u) => String(u).trim().replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
const DOMENA = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
/** Domena adresu bez „www.” (null, gdy to nie adres). */
export function domenaZ(u) { try { return new URL(String(u)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; } }

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
        if (!zr) {   // Gemini: źródło potwierdzone domeną (adres lub jego poddomena)
            const d = domenaZ(z?.zrodlo);
            zr = d ? [...zrodla.values()].find((x) => x.domena && (d === x.domena || d.endsWith(`.${x.domena}`))) : null;
            if (zr) potwierdzone = 'domena';
        }
        const wpis = {
            rodzaj: ['kod', 'promocja', 'program', 'partnerska'].includes(z?.rodzaj) ? z.rodzaj : 'promocja',
            kod: z?.kod ? String(z.kod).trim().slice(0, 60) : null,
            opis: String(z?.opis ?? '').slice(0, 400), rabat: z?.rabat ? String(z.rabat).slice(0, 40) : null,
            zrodlo: String(z?.zrodlo ?? ''), tytulZrodla: zr?.tytul ?? null, wiekStrony: zr?.wiek ?? null, data: z?.data ?? null,
            pewnosc: ['oficjalne', 'agregator', 'forum'].includes(z?.pewnosc) ? z.pewnosc : 'agregator',
            uwagi: z?.uwagi ? String(z.uwagi).slice(0, 300) : null,
            potwierdzone,
        };
        if (!zr) { odrzucone.push({ ...wpis, powod: 'źródła nie było w wynikach wyszukiwania — możliwe zmyślenie' }); continue; }
        przyjete.push(wpis);
    }
    const kolej = { oficjalne: 0, forum: 1, agregator: 2 };
    przyjete.sort((a, b) => kolej[a.pewnosc] - kolej[b.pewnosc]);
    return { przyjete, odrzucone };
}

/**
 * @param {{ klucze?: { anthropic?: Function, gemini?: Function }, klucz?: Function, katalog: string, szyna?: object|null, fetch?: Function, modelGemini?: () => Promise<string>|string }} o
 *   `klucz` (dawne) = klucz Anthropic.
 */
export function utworzZwiadowcePromocji({ klucze = {}, klucz = null, katalog, szyna = null, fetch: f = globalThis.fetch, modelGemini = () => MODEL_GEMINI }) {
    const kluczDla = { anthropic: klucze.anthropic ?? klucz ?? (async () => null), gemini: klucze.gemini ?? (async () => null) };
    const plik = () => path.join(katalog, 'promocje.json');
    async function czytaj() { try { return JSON.parse(await fs.readFile(plik(), 'utf8')); } catch { return { zwiady: [] }; } }

    /** Który dostawca i czy ma klucz. auto = Anthropic z kluczem, inaczej Gemini z kluczem. */
    async function wybierz(dostawca = 'auto') {
        if (!DOSTAWCY.includes(dostawca)) throw new Error(`Dostawca: ${DOSTAWCY.join(', ')}.`);
        const [a, g] = await Promise.all([kluczDla.anthropic(), kluczDla.gemini()].map((p) => Promise.resolve(p).catch(() => null)));
        if (dostawca === 'anthropic' || (dostawca === 'auto' && a)) {
            if (!a) throw new Error('Most nie ma klucza Anthropic — Hub → TeO Kibel → „🔗 Udostępnij mostowi” (albo wybierz Gemini).');
            return { dostawca: 'anthropic', k: a };
        }
        if (!g) throw new Error(dostawca === 'gemini' ? 'Most nie ma klucza Gemini — Hub → TeO Kibel → „🔗 Udostępnij mostowi” (albo wybierz Claude).' : 'Zwiadowca szuka w sieci przez Claude albo Gemini — most nie ma klucza żadnego z nich. Hub → TeO Kibel → „🔗 Udostępnij mostowi”.');
        return { dostawca: 'gemini', k: g };
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
        const wynikSzukania = wyb.dostawca === 'gemini' ? await szukajGemini(wyb.k, prosba) : await szukajClaude(wyb.k, prosba);
        return zapiszWynik(u, wyb.dostawca, wynikSzukania);
    }

    async function szukajClaude(k, prosba) {
        const messages = [{ role: 'user', content: prosba }];
        const tresc = [];
        let usage = { input_tokens: 0, output_tokens: 0, wyszukan: 0 };
        let stop = null;
        // pause_turn: API potrafi przerwać długą turę — odsyłamy ją bez zmian (najwyżej 3 razy)
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
            // Gemini: grounding liczony wg cennika Google (część zapytań w darmowej puli) — kwoty nie zgadujemy
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
        /** Kto może szukać — bez kluczy, tylko czy są. */
        async dostawcy() {
            const [a, g] = await Promise.all([kluczDla.anthropic(), kluczDla.gemini()].map((p) => Promise.resolve(p).catch(() => null)));
            return { anthropic: !!a, gemini: !!g, auto: a ? 'anthropic' : g ? 'gemini' : null };
        },
    };
}

export default { utworzZwiadowcePromocji, sprawdzZnaleziska, zrodlaZOdpowiedzi, zrodlaZGroundingu, wylowJson, MODEL, MODEL_GEMINI };
