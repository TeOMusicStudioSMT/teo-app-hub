/**
 * 📰 RynekTunelService — Tunel Wiadomości Rynkowych (0.00G)
 *
 * Zbiera nagłówki z publicznych kanałów RSS i podaje je Katedrze w jednym kształcie.
 * Suweren zauważył rzecz trafną: rynek reaguje emocjonalnie i spekulacyjnie, więc
 * NASTRÓJ informacyjny jest realnym sygnałem — w przeciwieństwie do wróżenia ze świec.
 *
 * ZASADY:
 *  • Zero chmury AI — streszczenie robi lokalny model przez Most (osobny endpoint).
 *  • Uczciwość źródeł: raport mówi, które kanały odpowiedziały, a które padły.
 *    Cichy brak źródła fałszowałby obraz nastroju.
 *  • Nic tu nie jest poradą inwestycyjną. To czytnik nagłówków, nie doradca.
 *
 * Wszystkie kanały zweryfikowane wywołaniem 2026-07-30 (HTTP 200 + policzone pozycje).
 */

import { load } from 'cheerio';

/** Kanały RSS. `kind` pozwala potem filtrować krypto vs. makro. */
export const SOURCES = [
    { id: 'cointelegraph', name: 'Cointelegraph', kind: 'krypto', url: 'https://cointelegraph.com/rss' },
    { id: 'decrypt',       name: 'Decrypt',       kind: 'krypto', url: 'https://decrypt.co/feed' },
    { id: 'coindesk',      name: 'CoinDesk',      kind: 'krypto', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { id: 'yahoo',         name: 'Yahoo Finance', kind: 'makro',  url: 'https://finance.yahoo.com/news/rssindex' },
    { id: 'wsj',           name: 'WSJ Markets',   kind: 'makro',  url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
    { id: 'investing',     name: 'Investing.com', kind: 'makro',  url: 'https://www.investing.com/rss/news_25.rss' },
];

const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS     = 10 * 60_000;   // 10 min — kanały i tak nie zmieniają się częściej
const UA = 'Mozilla/5.0 (compatible; KatedraOtakOS/1.0; +local)';

let cache = { at: 0, items: [], raport: [] };

/** Zdejmij CDATA, encje i tagi HTML — nagłówek ma być czystym tekstem. */
function czysty(txt = '') {
    return String(txt)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Pobierz i sparsuj jeden kanał. Nigdy nie rzuca — zwraca raport z błędem. */
async function pobierzKanal(src) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const t0 = Date.now();
    try {
        const res = await fetch(src.url, {
            signal: ctrl.signal,
            redirect: 'follow',                 // CoinDesk odpowiada 308 — bez tego zero pozycji
            headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        const $ = load(xml, { xmlMode: true });

        const items = [];
        // RSS 2.0 (<item>) oraz Atom (<entry>) — bierzemy oba kształty.
        $('item, entry').each((_, el) => {
            const n = $(el);
            const tytul = czysty(n.find('title').first().text());
            if (!tytul) return;
            const link = czysty(n.find('link').first().text()) || n.find('link').first().attr('href') || '';
            const data = n.find('pubDate').first().text() || n.find('updated').first().text() || n.find('published').first().text();
            const ts = data ? Date.parse(data) : NaN;
            items.push({
                tytul,
                link,
                opis:      czysty(n.find('description').first().text() || n.find('summary').first().text()).slice(0, 320),
                zrodlo:    src.name,
                zrodloId:  src.id,
                rodzaj:    src.kind,
                czas:      Number.isFinite(ts) ? new Date(ts).toISOString() : null,
                czasMs:    Number.isFinite(ts) ? ts : 0,
            });
        });

        return { raport: { id: src.id, nazwa: src.name, ok: true, pozycji: items.length, ms: Date.now() - t0 }, items };
    } catch (e) {
        // Padnięty kanał NIE jest przemilczany — inaczej obraz nastroju byłby fałszywy.
        return {
            raport: { id: src.id, nazwa: src.name, ok: false, pozycji: 0, ms: Date.now() - t0, blad: e?.message || String(e) },
            items: [],
        };
    }
}

/**
 * Zbierz nagłówki ze wszystkich kanałów.
 * @param {{limit?:number, rodzaj?:'krypto'|'makro', odswiez?:boolean}} opt
 */
export async function zbierzWiadomosci(opt = {}) {
    const limit = Math.max(1, Math.min(120, Number(opt.limit) || 40));
    const swiezy = Date.now() - cache.at < CACHE_TTL_MS && cache.items.length > 0;

    if (!opt.odswiez && swiezy) {
        return { ...wytnij(cache.items, opt, limit), raport: cache.raport, zCache: true, pobranoO: new Date(cache.at).toISOString() };
    }

    const wyniki = await Promise.all(SOURCES.map(pobierzKanal));
    const wszystkie = wyniki.flatMap(w => w.items);

    // Odsiew duplikatów: ten sam link albo ten sam tytuł w różnych serwisach.
    const widziane = new Set();
    const unikalne = [];
    for (const it of wszystkie.sort((a, b) => b.czasMs - a.czasMs)) {
        const klucz = (it.link || '') + '|' + it.tytul.toLowerCase().slice(0, 70);
        const klucz2 = it.tytul.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);
        if (widziane.has(klucz) || widziane.has(klucz2)) continue;
        widziane.add(klucz); widziane.add(klucz2);
        unikalne.push(it);
    }

    cache = { at: Date.now(), items: unikalne, raport: wyniki.map(w => w.raport) };
    return { ...wytnij(unikalne, opt, limit), raport: cache.raport, zCache: false, pobranoO: new Date(cache.at).toISOString() };
}

function wytnij(items, opt, limit) {
    const filtr = opt.rodzaj ? items.filter(i => i.rodzaj === opt.rodzaj) : items;
    return { items: filtr.slice(0, limit), lacznie: filtr.length };
}

/**
 * Prompt dla lokalnego modelu — JEDNO wywołanie na całą paczkę nagłówków.
 * Streszczenie nastroju, nie rekomendacja. Model ma opisywać, co mówią media,
 * a nie doradzać, co kupić — to rozróżnienie jest wpisane wprost w polecenie.
 */
export function promptNastroju(items, maks = 25) {
    const lista = items.slice(0, maks)
        .map((it, i) => `${i + 1}. [${it.zrodlo}] ${it.tytul}`)
        .join('\n');
    return (
        'Jesteś analitykiem prasowym Katedry OtakOS. Poniżej surowe nagłówki rynkowe z ostatnich godzin.\n' +
        'Napisz PO POLSKU zwięzłe streszczenie nastroju medialnego: 3-4 zdania o tym, o czym media piszą ' +
        'i jaki jest ich ton (obawa / euforia / spokój / niepewność). Wskaż 2-3 tematy, które się powtarzają.\n\n' +
        'ZASADY BEZWZGLĘDNE:\n' +
        '- Opisujesz, CO MÓWIĄ MEDIA — nie prognozujesz cen i nie doradzasz kupna ani sprzedaży.\n' +
        '- Żadnych rekomendacji, poziomów wejścia, celów cenowych.\n' +
        '- Jeśli nagłówki są sprzeczne, powiedz to wprost zamiast wybierać jedną stronę.\n\n' +
        `NAGŁÓWKI:\n${lista}`
    );
}

export default { SOURCES, zbierzWiadomosci, promptNastroju };
