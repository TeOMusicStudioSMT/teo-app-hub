/**
 * 🏷️🔭 Zwiadowca promocji (Suweren 2026-10-09: „dodaj Zwiadowcy zdolność wyszukiwania kodów rabatowych, np. Meshy :D”).
 *
 * Most nie ma własnej wyszukiwarki — bierzemy oficjalne narzędzie wyszukiwania API Claude (`web_search_20250305`,
 * $10 / 1000 wyszukiwań + tokeny; klucz Anthropic z Kibla). Claude szuka AKTUALNYCH kodów, promocji i programów
 * (edukacyjne, startupowe, roczne plany) dla wskazanej usługi i oddaje JSON.
 *
 * ŻADNYCH ZMYŚLEŃ: każde znalezisko musi mieć `zrodlo` — adres, który NAPRAWDĘ pojawił się w wynikach wyszukiwania
 * tego zapytania (bloki `web_search_tool_result` / cytowania). Bez takiego źródła — odrzucone, z powodem.
 * Zwiadowca NIC nie wpisuje i nie płaci: kod sprawdzasz sam przy płatności. Kody z agregatorów często wygasają —
 * oznaczamy pewność (oficjalne / agregator / forum) i datę strony.
 */
import fs from 'fs/promises';
import path from 'path';

export const MODEL = process.env.OTAKOS_PROMOCJE_MODEL || 'claude-sonnet-5-5';
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

/** Znaleziska z JSON → sprawdzone: źródło musi być wśród wyników wyszukiwania. */
export function sprawdzZnaleziska(json, zrodla) {
    const przyjete = [], odrzucone = [];
    for (const z of Array.isArray(json?.znalezione) ? json.znalezione : []) {
        const zr = zrodla.get(normUrl(z?.zrodlo ?? '')) ?? [...zrodla.values()].find((x) => normUrl(z?.zrodlo ?? '').startsWith(normUrl(x.url)));
        const wpis = {
            rodzaj: ['kod', 'promocja', 'program', 'partnerska'].includes(z?.rodzaj) ? z.rodzaj : 'promocja',
            kod: z?.kod ? String(z.kod).trim().slice(0, 60) : null,
            opis: String(z?.opis ?? '').slice(0, 400), rabat: z?.rabat ? String(z.rabat).slice(0, 40) : null,
            zrodlo: String(z?.zrodlo ?? ''), tytulZrodla: zr?.tytul ?? null, wiekStrony: zr?.wiek ?? null, data: z?.data ?? null,
            pewnosc: ['oficjalne', 'agregator', 'forum'].includes(z?.pewnosc) ? z.pewnosc : 'agregator',
            uwagi: z?.uwagi ? String(z.uwagi).slice(0, 300) : null,
        };
        if (!zr) { odrzucone.push({ ...wpis, powod: 'źródła nie było w wynikach wyszukiwania — możliwe zmyślenie' }); continue; }
        przyjete.push(wpis);
    }
    const kolej = { oficjalne: 0, forum: 1, agregator: 2 };
    przyjete.sort((a, b) => kolej[a.pewnosc] - kolej[b.pewnosc]);
    return { przyjete, odrzucone };
}

/**
 * @param {{ klucz: () => Promise<string|null>|string|null, katalog: string, szyna?: object|null, fetch?: Function }} o
 */
export function utworzZwiadowcePromocji({ klucz, katalog, szyna = null, fetch: f = globalThis.fetch }) {
    const plik = () => path.join(katalog, 'promocje.json');
    async function czytaj() { try { return JSON.parse(await fs.readFile(plik(), 'utf8')); } catch { return { zwiady: [] }; } }

    async function szukaj(usluga, { kontekst = '' } = {}) {
        const u = String(usluga ?? '').trim().slice(0, 80);
        if (u.length < 2) throw new Error('Podaj usługę, np. „Meshy”.');
        const k = await klucz();
        if (!k) throw new Error('Zwiadowca szuka przez API Claude (wyszukiwanie w sieci) — most nie ma klucza Anthropic. Hub → TeO Kibel → „🔗 Udostępnij mostowi”.');
        const messages = [{ role: 'user', content: `Usługa: ${u}${kontekst ? `\nKontekst: ${String(kontekst).slice(0, 300)}` : ''}\nDzisiaj: ${new Date().toISOString().slice(0, 10)}. Znajdź aktualne zniżki.` }];
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
        const json = wylowJson(tekst);
        if (!json) {
            await fs.mkdir(katalog, { recursive: true });
            await fs.writeFile(path.join(katalog, 'promocje-ostatnia-odpowiedz.txt'), tekst, 'utf8').catch(() => {});
            throw new Error(stop === 'max_tokens' ? 'Zwiadowca nie zmieścił listy w limicie odpowiedzi — spróbuj węższej usługi.' : `Zwiadowca nie oddał listy (JSON) — surowa odpowiedź w zwiadowca/promocje-ostatnia-odpowiedz.txt. Początek: ${tekst.slice(0, 160)}`);
        }
        const zrodla = zrodlaZOdpowiedzi(tresc);
        const { przyjete, odrzucone } = sprawdzZnaleziska(json, zrodla);
        const bledyWyszukiwania = tresc.filter((b) => b.type === 'web_search_tool_result' && b.content?.type === 'web_search_tool_result_error').map((b) => b.content.error_code);
        const wynik = {
            usluga: u, kiedy: new Date().toISOString(), model: MODEL, znalezione: przyjete, odrzucone,
            podsumowanie: String(json.podsumowanie ?? '').slice(0, 400), zrodel: zrodla.size, bledyWyszukiwania,
            koszt: { wyszukan: usage.wyszukan, tokenyWe: usage.input_tokens, tokenyWy: usage.output_tokens, usdWyszukiwania: Math.round(usage.wyszukan * USD_ZA_WYSZUKANIE * 100) / 100 },
            uwaga: 'Zwiadowca nic nie wpisuje i nie płaci — kod sprawdzisz przy płatności. Kody z agregatorów często wygasają.',
        };
        const d = await czytaj();
        d.zwiady = [wynik, ...(d.zwiady ?? []).filter((z) => z.usluga.toLowerCase() !== u.toLowerCase())].slice(0, 30);
        await fs.mkdir(katalog, { recursive: true });
        await fs.writeFile(plik(), JSON.stringify(d, null, 2), 'utf8');
        await szyna?.nadaj?.({ agent: 'Zwiadowca', rodzaj: 'zwiad', tresc: `🏷️ ${u}: ${przyjete.length} zniżek ze źródłami${przyjete.some((z) => z.kod) ? ` (kody: ${przyjete.filter((z) => z.kod).map((z) => z.kod).slice(0, 3).join(', ')})` : ''}${odrzucone.length ? `, ${odrzucone.length} odrzucone bez źródła` : ''}`, dane: { usluga: u } }).catch(() => {});
        return wynik;
    }

    return { szukaj, lista: async () => (await czytaj()).zwiady ?? [] };
}

export default { utworzZwiadowcePromocji, sprawdzZnaleziska, zrodlaZOdpowiedzi, wylowJson, MODEL };
