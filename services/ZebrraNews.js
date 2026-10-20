/**
 * 📰 Zebrra News (Suweren 2026-10-19: „budujemy Studio dla samych Newsów… automatyczne dzienne odcinki wyszukiwane
 * z globalnych nagłówków, przygotowałem wzór studia”). Prowadzi Gol Donna 🦓, współprowadzi Zlat Kadabra 🦁 (skład jak
 * w Golu Dnia), studio = wzór Suwerena w apce `studio-zebrra` (strona `news.html`).
 *
 * PRAWA I UCZCIWOŚĆ: artykułów NIE kopiujemy — z publicznych kanałów RSS bierzemy tylko tytuł, krótki opis i link
 * (`naglowkiZXml`), a scenariusz to WŁASNE krótkie streszczenie prowadzących. Każdy news ma źródło (redakcja + link) na
 * ekranie i w opisie filmu. Każda liczba w scenariuszu musi być w tytule/opisie newsa (`sprawdzLiczby`) — inaczej jedna
 * poprawka, potem błąd wprost. Ton neutralny, bez stron politycznych; wojny, katastrofy i śmierć (`czyPowazny`) = powaga,
 * bez żartów, Zlat bez gwiazdorzenia. Obrazy FLUX (opcja) tylko SYMBOLICZNE: bez twarzy, logotypów, napisów i udawania
 * zdjęć z miejsca zdarzenia; na ekranie podpis „ilustracja AI”.
 *
 * Łańcuch: nagłówki (kilka redakcji i regionów, `ZRODLA` do zmiany w ustawieniach) → wybór 5–8 tematów (różne dziedziny,
 * bez dubli tego samego wydarzenia — `wybierzTematy`) → scenariusz INTRO / NEWS n / OUTRO → (obrazy) → `studio`
 * (nagrywa apka) → mp4 → 🎬 oprawa `_OtakOs_Klocki/Klocki News/start|end` → `produkcje/zebrra-news/montaz/
 * news_<dzień>_<jezyk>_<id>.mp4` → Kronikarz → ✓ w Izbie. 🤖 Automat: raz dziennie o godzinie z ustawień (domyślnie
 * WYŁĄCZONY) przygotowuje odcinek do stanu `studio`; nagrywa apka News, gdy jest otwarta z włączonym automatem.
 */
import fsSync from 'fs';
import fsP from 'fs/promises';
import path from 'path';
import { load } from 'cheerio';
import { NARRATORZY, MAX_WSPOL } from './GolDnia.js';
import { liczbyPozaFaktami, utworzMagazyn, glosKwestii, nagranieDoMp4 } from './OdcinkiStudia.js';
import { klockiWJezyku } from './TeoGameShow.js';

export const PROGRAM = 'zebrra-news';
export const PROJEKT = 'zebrra-news';
export const NAZWA = 'Zebrra News';
export const JEZYKI = { en: 'English', pl: 'polski' };
export const MIN_NEWSOW = 3, MAX_NEWSOW = 8;
/** Jak wybieramy tematy dnia: różnorodnie (heurystyka) albo 🤯 zaskakujące (model wybiera z szerokiej listy kandydatów). */
export const WYBORY = { roznorodne: 'różnorodne', zaskakujace: 'zaskakujące' };
export const MAX_KANDYDATOW = 24;
/** 🧬 Zadanie uprzęży (services/Uprzaz.js), z którego scenariusz bierze przyjęte dodatki. */
export const ZADANIE_UPRZEZY = 'zebrra-news-scenariusz';
const ID = /^n-[0-9a-f]{8}$/;

/** Publiczne kanały RSS bez klucza (sprawdzone 2026-10-19 z tej maszyny). Suweren zmienia listę w ustawieniach. */
export const ZRODLA = [
    { id: 'bbc-world', nazwa: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'świat', dziedzina: null },
    { id: 'bbc-tech', nazwa: 'BBC News', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', region: 'świat', dziedzina: 'technologia' },
    { id: 'bbc-nauka', nazwa: 'BBC News', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', region: 'świat', dziedzina: 'nauka' },
    { id: 'bbc-zdrowie', nazwa: 'BBC News', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', region: 'świat', dziedzina: 'zdrowie' },
    { id: 'aljazeera', nazwa: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: 'Bliski Wschód', dziedzina: null },
    { id: 'npr-world', nazwa: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml', region: 'Ameryka Północna', dziedzina: null },
    { id: 'dw', nazwa: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all', region: 'Europa', dziedzina: null },
    { id: 'france24', nazwa: 'France 24', url: 'https://www.france24.com/en/rss', region: 'Europa', dziedzina: null },
    { id: 'guardian-world', nazwa: 'The Guardian', url: 'https://www.theguardian.com/world/rss', region: 'świat', dziedzina: null },
    { id: 'japantimes', nazwa: 'The Japan Times', url: 'https://www.japantimes.co.jp/feed/', region: 'Azja', dziedzina: null },
    { id: 'abc-au', nazwa: 'ABC News (Australia)', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', region: 'Oceania', dziedzina: null },
    { id: 'nasa', nazwa: 'NASA', url: 'https://www.nasa.gov/news-release/feed/', region: 'kosmos', dziedzina: 'kosmos' },
    { id: 'tvn24', nazwa: 'TVN24', url: 'https://tvn24.pl/swiat.xml', region: 'świat (z Polski)', dziedzina: null },
    { id: 'polsat', nazwa: 'Polsat News', url: 'https://www.polsatnews.pl/rss/swiat.xml', region: 'świat (z Polski)', dziedzina: null },
    { id: 'rp', nazwa: 'Rzeczpospolita', url: 'https://www.rp.pl/rss_main', region: 'Polska', dziedzina: null },
];

/** Dziedziny z prostych słów kluczowych (en + pl) — gdy kanał nie mówi sam, o czym jest. Kolejność = pierwszeństwo. */
export const DZIEDZINY = {
    konflikt: /\b(war|wars|military|troops|missile|strike|ceasefire|army|wojn|wojsk|rakiet|zawieszeni[ea] broni|armi)/i,
    polityka: /\b(election|president|minister|parliament|government|vote|senate|congress|wybor|prezydent|premier|sejm|rząd|rzad|minist|parlament)/i,
    gospodarka: /\b(econom|market|inflation|bank|trade|tariff|stocks|jobs|gospodar|rynk|inflacj|bank|handl|cł[ao]|giełd|gield)/i,
    technologia: /\b(tech|ai\b|artificial intelligence|software|chip|apple|google|cyber|internet|technolog|sztuczn[aej] inteligencj|smartfon)/i,
    nauka: /\b(scien|research|study|scientist|discover|nauk|badani|odkry)/i,
    kosmos: /\b(space|nasa|rocket|moon|mars|orbit|astronaut|kosmos|kosmiczn|księżyc|ksiezyc|rakieta)/i,
    klimat: /\b(climate|weather|flood|storm|heat|wildfire|hurricane|earthquake|klimat|pogod|powód|powodz|burz|upał|upal|pożar|pozar|trzęsieni|trzesieni)/i,
    zdrowie: /\b(health|hospital|virus|vaccine|disease|cancer|doctor|zdrow|szpital|wirus|szczepion|chorob|lekarz)/i,
    kultura: /\b(film|music|art|museum|book|festival|celebrit|kultur|muzyk|sztuk|muzeum|książ|ksiaz|festiwal)/i,
    sport: /\b(football|soccer|tennis|olympic|championship|match|league|sport|piłk|pilk|mecz|mistrzostw|olimpi)/i,
};
export const NAZWY_DZIEDZIN = { konflikt: ['konflikty', 'conflicts'], polityka: ['polityka', 'politics'], gospodarka: ['gospodarka', 'economy'], technologia: ['technologia', 'technology'], nauka: ['nauka', 'science'], kosmos: ['kosmos', 'space'], klimat: ['klimat i pogoda', 'climate & weather'], zdrowie: ['zdrowie', 'health'], kultura: ['kultura', 'culture'], sport: ['sport', 'sport'], swiat: ['świat', 'world'] };
/** Regiony newsa (zamknięta lista; etykieta [pl, en]). Region kanału to tylko podpowiedź — Japonia z Al Jazeery to Azja. */
export const REGIONY = { swiat: ['świat', 'world'], europa: ['Europa', 'Europe'], polska: ['Polska', 'Poland'], 'ameryka-pn': ['Ameryka Północna', 'North America'],
    'ameryka-lac': ['Ameryka Łacińska', 'Latin America'], afryka: ['Afryka', 'Africa'], 'bliski-wschod': ['Bliski Wschód', 'Middle East'], azja: ['Azja', 'Asia'],
    oceania: ['Oceania', 'Oceania'], kosmos: ['kosmos', 'space'], polarne: ['Arktyka i Antarktyda', 'polar regions'] };

/**
 * 🗞️ Redakcja wybranych newsów (2026-10-20: „Bliski Wschód” przy misji Japonii, „konflikty” przy rakiecie PERUN, polski tytuł
 * w angielskim serwisie): model wydawcy ustala dziedzinę i region Z TREŚCI (zamknięte listy), powagę i tytuł w języku odcinka.
 */
export function promptRedakcji(newsy, jezyk) {
    const en = jezyk === 'en';
    const lista = newsy.map((n, i) => `${i + 1}. [${n.zrodlo}] ${n.tytul}${n.opis ? ` — ${String(n.opis).slice(0, 240)}` : ''}`).join('\n');
    return {
        system: 'Jesteś redaktorem serwisu Zebrra News. Opisujesz newsy krótkimi etykietami z zamkniętych list. Odpowiadasz tylko liniami w podanym formacie.',
        user: `Dla każdego newsa podaj jedną linię:\nNUMER | DZIEDZINA | REGION | POWAŻNY | TYTUŁ\n` +
            `DZIEDZINA — jedna z: ${Object.keys(NAZWY_DZIEDZIN).join(', ')} (o czym naprawdę jest news; rakieta badawcza to kosmos albo technologia, nie konflikt).\n` +
            `REGION — jeden z: ${Object.keys(REGIONY).join(', ')} (gdzie dzieje się wydarzenie, NIE skąd jest redakcja; misja kosmiczna = kosmos albo kraj, który ją wysyła).\n` +
            `POWAŻNY — tak, gdy news dotyczy wojny, katastrofy, śmierci albo cierpienia ludzi; inaczej nie.\n` +
            `TYTUŁ — tytuł newsa ${en ? 'po angielsku' : 'po polsku'}, krótki (do 90 znaków), wierny źródłu: tłumacz, gdy jest w innym języku, bez nowych faktów i bez liczb, których nie ma w tytule ani opisie.\n\n${lista}`,
    };
}
export function odczytajRedakcje(tekst, newsy) {
    const z = (t) => String(t ?? '').match(/\d+(?:[.,]\d+)?/g)?.map((x) => x.replace(',', '.')) ?? [];
    const wynik = new Map();
    for (const linia of String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').split('\n')) {
        const cz = linia.split('|').map((x) => x.trim().replace(/^\*+|\*+$/g, ''));
        if (cz.length < 5) continue;
        const i = Number(cz[0].replace(/[^\d]/g, '')) - 1;
        if (!(i >= 0 && i < newsy.length) || wynik.has(i)) continue;
        const dziedzina = cz[1].toLowerCase(), region = cz[2].toLowerCase(), tytul = cz.slice(4).join(' | ').replace(/^["„“]|["”]$/g, '').trim();
        if (!NAZWY_DZIEDZIN[dziedzina] || !REGIONY[region] || !tytul || tytul.length > 160) continue;
        const dozwolone = new Set([...z(newsy[i].tytul), ...z(newsy[i].opis)]);
        if (z(tytul).some((x) => !dozwolone.has(x))) continue;   // tłumacz nie dopisuje liczb
        wynik.set(i, { dziedzina, region, powaga: /^(tak|yes)/i.test(cz[3]), tytul });
    }
    return wynik;
}
/** Wynik redakcji na news: dziedzina, region w języku odcinka, tytuł do ekranu; oryginał zostaje (źródło, opis filmu, sprawdzanie liczb). */
export function zastosujRedakcje(n, red, jezyk) {
    const en = jezyk === 'en';
    return { ...n, tytulOryginalny: n.tytulOryginalny ?? n.tytul, regionKanalu: n.regionKanalu ?? n.region,
        dziedzina: red.dziedzina, regionKlucz: red.region, region: REGIONY[red.region][en ? 1 : 0], powaga: n.powaga || red.powaga, tytul: red.tytul };
}

/** Wojny, katastrofy, śmierć — powaga w tonie, zero żartów. */
const POWAGA = /\b(kill|killed|dead|death|dies|died|war|attack|bomb|shooting|earthquake|flood|disaster|crash|hostage|famine|massacre|wounded|injured|victim|genocide|zgin|zabit|śmier|smier|wojn|atak|zamach|ofiar|katastrof|trzęsieni|trzesieni|powódź|powodz|rann[iy]|zakładni|zakladni)/i;

const czysty = (t = '') => String(t).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;|&#x27;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();

/** RSS 2.0 / RDF / Atom → nagłówki {tytul, opis ≤ 300, link, czas} z jednego kanału. Treści artykułu nie bierzemy. */
export function naglowkiZXml(xml, zrodlo) {
    const $ = load(String(xml ?? ''), { xmlMode: true });
    const out = [];
    $('item, entry').each((_, el) => {
        const n = $(el);
        const tytul = czysty(n.find('title').first().text()).slice(0, 200);
        if (!tytul) return;
        const link = czysty(n.find('link').first().text()) || n.find('link').first().attr('href') || '';
        const data = n.find('pubDate').first().text() || n.find('dc\\:date').first().text() || n.find('updated').first().text() || n.find('published').first().text();
        const ts = data ? Date.parse(data) : NaN;
        out.push({ tytul, opis: czysty(n.find('description').first().text() || n.find('summary').first().text()).slice(0, 300), link: /^https?:\/\//.test(link) ? link : '',
            zrodlo: zrodlo.nazwa, zrodloId: zrodlo.id, region: zrodlo.region ?? 'świat', dziedzinaKanalu: zrodlo.dziedzina ?? null, czas: Number.isFinite(ts) ? new Date(ts).toISOString() : null });
    });
    return out;
}

export const dziedzinaNewsa = (n) => n.dziedzinaKanalu ?? Object.keys(DZIEDZINY).find((d) => DZIEDZINY[d].test(`${n.tytul} ${n.opis}`)) ?? 'swiat';
export const czyPowazny = (n) => POWAGA.test(`${n.tytul} ${n.opis}`);
const slowa = (t) => new Set(String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3));
/** Podobieństwo tytułów (Jaccard na słowach > 3 znaki) — to samo wydarzenie z kilku redakcji. */
export function podobne(a, b) {
    const A = slowa(a), B = slowa(b);
    if (!A.size || !B.size) return 0;
    let wspolne = 0; for (const w of A) if (B.has(w)) wspolne++;
    return wspolne / (A.size + B.size - wspolne);
}

/**
 * Tematy dnia: świeże (≤ `godzin` h, bez daty na końcu), bez dubli wydarzenia (podobieństwo ≥ 0,34), po kolei z RÓŻNYCH
 * dziedzin, potem regionów, najwyżej 2 z jednego kanału. Zwraca `ile` newsów z dziedziną i flagą powagi.
 */
export function wybierzTematy(naglowki, { ile = 6, teraz = Date.now(), godzin = 36, limit = MAX_NEWSOW } = {}) {
    const swieze = naglowki.filter((n) => !n.czas || teraz - Date.parse(n.czas) <= godzin * 3600_000)
        .sort((a, b) => (Date.parse(b.czas ?? 0) || 0) - (Date.parse(a.czas ?? 0) || 0));
    const unikalne = [];
    for (const n of swieze) if (!unikalne.some((u) => podobne(u.tytul, n.tytul) >= 0.34)) unikalne.push({ ...n, dziedzina: dziedzinaNewsa(n), powaga: czyPowazny(n) });
    const out = [], uzyteD = new Map(), uzyteR = new Map(), zKanalu = new Map();
    const ile_ = Math.max(MIN_NEWSOW, Math.min(limit, ile));
    while (out.length < ile_) {
        const kand = unikalne.filter((n) => !out.includes(n) && (zKanalu.get(n.zrodloId) ?? 0) < 2);
        if (!kand.length) break;
        // najmniej używana dziedzina, potem region, potem świeżość (kolejność listy)
        kand.sort((a, b) => (uzyteD.get(a.dziedzina) ?? 0) - (uzyteD.get(b.dziedzina) ?? 0) || (uzyteR.get(a.region) ?? 0) - (uzyteR.get(b.region) ?? 0));
        const n = kand[0];
        out.push(n);
        uzyteD.set(n.dziedzina, (uzyteD.get(n.dziedzina) ?? 0) + 1); uzyteR.set(n.region, (uzyteR.get(n.region) ?? 0) + 1); zKanalu.set(n.zrodloId, (zKanalu.get(n.zrodloId) ?? 0) + 1);
    }
    return out.map(({ dziedzinaKanalu: _d, ...n }) => n);
}

/**
 * 🤯 Wybór „zaskakujących” (Suweren 2026-10-20: „najważniejsze, zaskakujące wiadomości ze świata”): model dostaje
 * ponumerowanych kandydatów (już świeżych, bez dubli, z różnych kanałów) i oddaje TYLKO numery — nic nie dopisze.
 */
export function promptWyboru(kandydaci, ile) {
    const lista = kandydaci.map((n, i) => `${i + 1}. [${n.zrodlo} · ${n.region}] ${n.tytul}${n.opis ? ` — ${String(n.opis).slice(0, 200)}` : ''}`).join('\n');
    return {
        system: 'Jesteś wydawcą serwisu informacyjnego Zebrra News. Wybierasz tematy dnia. Odpowiadasz wyłącznie numerami z listy.',
        user: `Z poniższych nagłówków wybierz ${ile} wiadomości ze świata, które są NAJBARDZIEJ ZASKAKUJĄCE, a zarazem ważne: odkrycia naukowe, rekordy, nieoczekiwane zwroty, rzeczy, o których widz powie „nie wiedziałem, że to możliwe”.\n` +
            `Zasady: nie wybieraj cudzej tragedii jako ciekawostki; nie oceniaj polityki i nie dobieraj tematów pod jedną stronę; różne dziedziny i regiony; najwyżej 2 z jednej redakcji.\n` +
            `Kolejność = kolejność w serwisie: najmocniejszy temat pierwszy, drugi najmocniejszy na koniec.\n\n${lista}\n\n` +
            `Odpowiedz JEDNĄ linią: ${ile} różnych numerów oddzielonych przecinkami, np. „7, 2, 15”. Bez komentarza.`,
    };
}
/** Numery z odpowiedzi modelu → indeksy kandydatów (bez dubli, tylko z listy, ≤ 2 z redakcji). Za mało = błąd wprost. */
export function odczytajWybor(tekst, kandydaci, ile) {
    const bezMysli = String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
    const numery = [...bezMysli.matchAll(/\d+/g)].map((m) => Number(m[0]) - 1).filter((i) => i >= 0 && i < kandydaci.length);
    const out = [], zRedakcji = new Map();
    for (const i of numery) {
        if (out.includes(i)) continue;
        const z = kandydaci[i].zrodlo;
        if ((zRedakcji.get(z) ?? 0) >= 2) continue;
        zRedakcji.set(z, (zRedakcji.get(z) ?? 0) + 1);
        out.push(i);
        if (out.length >= ile) break;
    }
    if (out.length < Math.min(ile, MIN_NEWSOW)) throw new Error(`model wskazał za mało tematów z listy (${out.length}): „${bezMysli.trim().slice(0, 120)}”`);
    return out;
}

/** Kto mówi: prowadzący INTRO, OUTRO i newsy nieparzyste; współprowadzący po kolei newsy parzyste. */
export function ktoMowiNews(typ, s, i = 0) {
    const w = s.wspolprowadzacy ?? [];
    if (typ !== 'news' || !w.length || i % 2 === 0) return s.narrator;
    return w[Math.floor(i / 2) % w.length];
}

/**
 * `uprzaz` — 🧬 tekst aktywnej uprzęży (services/Uprzaz.js, warstwa nad zasadami po ✓ Suwerena) albo wersji kandydata
 * w próbie Harness²; żelazne zasady zostają, uprząż tylko dokłada.
 */
export function promptScenariusza(s, { uprzaz = '' } = {}) {
    const en = s.jezyk === 'en';
    const sklad = [s.narrator, ...(s.wspolprowadzacy ?? [])].map((k) => NARRATORZY[k]).filter(Boolean);
    const dz = (d) => NAZWY_DZIEDZIN[d]?.[en ? 1 : 0] ?? d;
    const opis = s.newsy.map((n, i) => `NEWS ${i + 1} [${dz(n.dziedzina)} · ${n.region}${n.powaga ? ' · POWAŻNY — bez żartów' : ''}] mówi: ${NARRATORZY[ktoMowiNews('news', s, i)]?.imie}\n  źródło: ${n.zrodlo}\n  tytuł: ${n.tytul}\n  opis: ${n.opis || '—'}`).join('\n');
    const system = [
        `Piszesz serwis informacyjny „${NAZWA}” (kanał Zebrra Sports, Katedra OtakOS) na ${s.dzien}. Prowadzący:`,
        ...sklad.map((n) => `- ${n.imie}: ${en ? n.temperamentEn : n.temperament}`),
        'ŻELAZNE ZASADY SERWISU:',
        '1. Każdy news to WŁASNE krótkie streszczenie (2–3 zdania) tytułu i opisu ze źródła — nie przepisuj zdań źródła, nie dodawaj faktów, których tam nie ma, żadnych cytatów w cudzysłowie.',
        '2. Każda liczba, którą wypowiesz, musi być w tytule albo opisie tego newsa. Żadnych innych liczb, dat ani statystyk.',
        '3. Na końcu newsa podaj źródło słowami („podaje BBC News” / „reports BBC News”).',
        '4. Ton neutralny, bez opinii politycznych i bez stron. Przy newsach POWAŻNYCH (wojna, katastrofa, śmierć) — powaga i szacunek, zero żartów; Zlat Kadabra w serwisie mówi skromniej, bez gwiazdorzenia.',
        `5. Mów na głos, bez emoji i markdown. Język: ${en ? 'English' : 'polski'} (tłumacz streszczenie, jeśli źródło jest w innym języku).`,
        '6. Zachowaj PUENTĘ nagłówka: jeśli news obala oczekiwanie (np. „wrak samolotu okazał się kępą drzew”), powiedz to wprost i wyraźnie, nie rozmywaj w ogólnikach.',
        ...(String(uprzaz || '').trim() ? [String(uprzaz).trim()] : []),
        'FORMAT (każda linia od etykiety, nic poza tym):',
        'INTRO: … (powitanie, data słowami bez liczb, zapowiedź dziedzin)',
        ...s.newsy.map((_, i) => `NEWS ${i + 1}: …`),
        'OUTRO: … (pożegnanie)',
    ].join('\n');
    return { system, user: `NAGŁÓWKI DNIA:\n${opis}` };
}

export function odczytajScenariusz(tekst, ile) {
    const sc = { intro: '', outro: '', newsy: Array.from({ length: ile }, () => '') };
    let biez = null;
    for (const surowa of String(tekst ?? '').replace(/\r/g, '').split('\n')) {
        const l = surowa.replace(/^[\s*#>-]+/, '').replace(/\*\*/g, '').trim();
        if (!l) continue;
        const m = /^(INTRO|OUTRO|NEWS)\s*(\d+)?\s*[:：]\s*(.*)$/i.exec(l);
        if (m) {
            const et = m[1].toUpperCase();
            if (et !== 'NEWS') { biez = { k: et.toLowerCase() }; sc[biez.k] = m[3].trim(); continue; }
            const n = Number(m[2]);
            biez = n >= 1 && n <= ile ? { k: 'news', i: n - 1 } : null;
            if (biez) sc.newsy[biez.i] = m[3].trim();
        } else if (biez) {
            if (biez.k === 'news') sc.newsy[biez.i] = `${sc.newsy[biez.i]} ${l}`.trim(); else sc[biez.k] = `${sc[biez.k]} ${l}`.trim();
        }
    }
    const braki = [!sc.intro && 'INTRO', ...sc.newsy.map((t, i) => !t && `NEWS ${i + 1}`), !sc.outro && 'OUTRO'].filter(Boolean);
    if (braki.length) throw new Error(`Scenariusz bez linii: ${braki.join(', ')}.`);
    return sc;
}

/** Liczby: każdy news tylko ze swojego tytułu i opisu; intro/outro — liczba newsów (dat słowami). */
export function sprawdzLiczby(sc, s) {
    const z = (t) => String(t ?? '').match(/\d+(?:[.,]\d+)?/g)?.map((x) => x.replace(',', '.')) ?? [];
    const zle = [];
    // nazwy redakcji też niosą liczby („France 24”, „TVN24”) — wolno je wypowiedzieć
    const zNazw = s.newsy.flatMap((n) => z(n.zrodlo));
    const intro = liczbyPozaFaktami(`${sc.intro} ${sc.outro}`, [s.newsy.length, ...zNazw]);
    if (intro.length) zle.push(`INTRO/OUTRO (${intro.join(', ')})`);
    sc.newsy.forEach((t, i) => { const n = s.newsy[i]; const b = liczbyPozaFaktami(t, [i + 1, ...z(n.tytul), ...z(n.tytulOryginalny), ...z(n.opis), ...z(n.zrodlo)]); if (b.length) zle.push(`NEWS ${i + 1} (${b.join(', ')})`); });
    return zle.length ? `liczby spoza źródeł: ${zle.join('; ')}` : null;
}

export function kwestieOdcinka(s) {
    if (!s?.scenariusz) return [];
    const out = [];
    const dodaj = (typ, news, tekst) => out.push({ nr: out.length + 1, typ, news, kto: ktoMowiNews(typ, s, news ?? 0), tekst });
    dodaj('intro', null, s.scenariusz.intro);
    s.scenariusz.newsy.forEach((t, i) => dodaj('news', i, t));
    dodaj('outro', null, s.scenariusz.outro);
    return out;
}

/** Prompt FLUX — symbol tematu, nigdy „zdjęcie z miejsca zdarzenia”. */
export function promptObrazu(n) {
    return `symbolic editorial illustration about ${NAZWY_DZIEDZIN[n.dziedzina]?.[1] ?? 'world news'} in ${n.region === 'świat' ? 'the world' : n.region}, abstract newsroom style, soft purple and cyan light, conceptual objects only, ${n.powaga ? 'calm sombre mood, ' : ''}no people, no faces, no logos, no text, no flags of real states, not a photograph of a real event, 16:9`;
}

export function kontekstKronikarza(s) {
    const en = s.jezyk === 'en';
    const sklad = [s.narrator, ...(s.wspolprowadzacy ?? [])].map((k) => NARRATORZY[k]?.imie).filter(Boolean).join(' and ');
    return `Daily news bulletin "${NAZWA}" for ${s.dzien} on the Zebrra Sports channel of Katedra OtakOS, hosted by the animated TeOgochi characters ${sklad} in a 3D newsroom. The hosts summarise public headlines in their own words; every story credits its source. Images on the studio screens are symbolic AI illustrations, not footage. Sources (put them as a list with links in the description):\n${s.newsy.map((n, i) => `${i + 1}. ${n.tytul} — ${n.zrodlo}${n.link ? ` ${n.link}` : ''}`).join('\n')}\n${en ? 'Write the title, description and tags in English. Neutral tone.' : 'Tytuł, opis i tagi po polsku. Ton neutralny.'}`;
}

const dzienLokalny = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * @param {{ katalog: string, katalogMontazy: (p: string) => Promise<string>, fetch?: Function,
 *   chat?: Function, modelDla?: Function, mow?: Function, rysuj?: (o: { prompt: string, prefiks: string }) => Promise<string>,
 *   publikuj?: Function, kanal?: () => Promise<string|null>, uprzaz?: (zadanie: string) => Promise<{ id: string, blok: string }|null>, klocki?: Function, spawaj?: Function, opisz?: Function,
 *   ffmpeg?: string, szyna?: any, teraz?: () => number }} o
 */
export function utworzZebrraNews(o) {
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), fetch: (...a) => globalThis.fetch(...a), modelDla: async () => null, opisz: async () => ({ sekundy: null }), ...o };
    const M = utworzMagazyn({ katalog: cfg.katalog, program: PROGRAM, wzorId: ID });
    const plikU = path.join(M.KAT, 'ustawienia.json');
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Gol Donna', rodzaj: 'praca', tresc: `📰 ${tresc}` })?.catch?.(() => {});

    async function ustawienia() {
        let u = {};
        try { u = JSON.parse(await fsP.readFile(plikU, 'utf8')); } catch { /* domyślne */ }
        const zrodla = Array.isArray(u.zrodla) && u.zrodla.length ? u.zrodla : ZRODLA;
        return { auto: u.auto === true, godzina: Number.isInteger(u.godzina) && u.godzina >= 0 && u.godzina <= 23 ? u.godzina : 7, jezyk: JEZYKI[u.jezyk] ? u.jezyk : 'en',
            narrator: NARRATORZY[u.narrator] ? u.narrator : 'zebra', wspolprowadzacy: Array.isArray(u.wspolprowadzacy) ? u.wspolprowadzacy.filter((k) => NARRATORZY[k]).slice(0, MAX_WSPOL) : ['lew'],
            ile: Math.max(MIN_NEWSOW, Math.min(MAX_NEWSOW, Number(u.ile) || 6)), obrazy: u.obrazy !== false, wybor: WYBORY[u.wybor] ? u.wybor : 'roznorodne', zrodla, ostatniAuto: u.ostatniAuto ?? null };
    }
    async function ustaw(z = {}) {
        const u = await ustawienia();
        if (z.auto !== undefined) u.auto = z.auto === true;
        if (z.godzina !== undefined) { const g = Number(z.godzina); if (!Number.isInteger(g) || g < 0 || g > 23) throw new Error('Godzina 0–23.'); u.godzina = g; }
        if (z.jezyk !== undefined) { if (!JEZYKI[z.jezyk]) throw new Error('Język: en albo pl.'); u.jezyk = z.jezyk; }
        if (z.narrator !== undefined) { if (!NARRATORZY[z.narrator]) throw new Error('Nieznany prowadzący.'); u.narrator = z.narrator; }
        if (z.wspolprowadzacy !== undefined) u.wspolprowadzacy = (Array.isArray(z.wspolprowadzacy) ? z.wspolprowadzacy : []).filter((k, i, a) => NARRATORZY[k] && k !== u.narrator && a.indexOf(k) === i).slice(0, MAX_WSPOL);
        if (z.ile !== undefined) u.ile = Math.max(MIN_NEWSOW, Math.min(MAX_NEWSOW, Number(z.ile) || 6));
        if (z.obrazy !== undefined) u.obrazy = z.obrazy === true;
        if (z.wybor !== undefined) { if (!WYBORY[z.wybor]) throw new Error(`Wybór tematów: ${Object.keys(WYBORY).join(' albo ')}.`); u.wybor = z.wybor; }
        if (z.zrodla !== undefined) {
            if (z.zrodla === null) u.zrodla = ZRODLA;
            else {
                const l = (Array.isArray(z.zrodla) ? z.zrodla : []).map((x, i) => ({ id: String(x.id || `z${i}`).replace(/[^a-z0-9-]/gi, '').slice(0, 30) || `z${i}`, nazwa: String(x.nazwa ?? '').trim().slice(0, 60), url: String(x.url ?? '').trim(), region: String(x.region ?? 'świat').trim().slice(0, 40) || 'świat', dziedzina: DZIEDZINY[x.dziedzina] || x.dziedzina === 'kosmos' ? x.dziedzina : null }))
                    .filter((x) => x.nazwa && /^https:\/\//.test(x.url)).slice(0, 30);
                if (l.length < 2) throw new Error('Potrzeba co najmniej dwóch kanałów RSS (https) z nazwą redakcji.');
                u.zrodla = l;
            }
        }
        await fsP.mkdir(M.KAT, { recursive: true });
        await fsP.writeFile(plikU, JSON.stringify(u, null, 1), 'utf8');
        return u;
    }

    /** Nagłówki ze wszystkich kanałów — padnięty kanał NIE znika po cichu (raport). */
    async function naglowki(zrodla) {
        const wyniki = await Promise.all(zrodla.map(async (z) => {
            const t0 = cfg.teraz();
            try {
                const r = await cfg.fetch(z.url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Mozilla/5.0 (Katedra OtakOS Zebrra News)', Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const n = naglowkiZXml(await r.text(), z);
                return { n, raport: { id: z.id, nazwa: z.nazwa, ok: true, pozycji: n.length, ms: cfg.teraz() - t0 } };
            } catch (e) { return { n: [], raport: { id: z.id, nazwa: z.nazwa, ok: false, pozycji: 0, blad: String(e.message || e).slice(0, 120) } }; }
        }));
        return { naglowki: wyniki.flatMap((w) => w.n), raport: wyniki.map((w) => w.raport) };
    }

    async function napiszScenariusz(s) {
        const model = (await cfg.modelDla(s.narrator).catch(() => null)) ?? (await cfg.modelDla('pilkarka').catch(() => null));
        // 🧬 aktywna uprząż prowadzących (Harness² po katedralnemu) — tylko przyjęta przez Suwerena
        const u = (await cfg.uprzaz?.(ZADANIE_UPRZEZY)?.catch?.(() => null)) ?? null;
        const { system, user } = promptScenariusza(s, { uprzaz: u?.blok ?? '' });
        let blad = null;
        for (let proba = 0; proba < 2; proba++) {
            const r = await cfg.chat(model, system, proba ? `${user}\n\nPOPRZEDNIA WERSJA ODRZUCONA: ${blad}. Napisz całość od nowa, trzymając się formatu i źródeł.` : user);
            try {
                const sc = odczytajScenariusz(r.tekst, s.newsy.length);
                const zle = sprawdzLiczby(sc, s);
                if (zle) throw new Error(zle);
                return { sc, model, proby: proba + 1, uprzaz: u?.id ?? null };
            } catch (e) { blad = e.message; }
        }
        throw new Error(`Scenariusz odrzucony dwa razy — ${blad}`);
    }

    async function przebieg(id) {
        const s = await M.wczytaj(id);
        try {
            if (!cfg.chat) throw new Error('Most nie ma modelu do scenariusza.');
            if (s.wybor === 'zaskakujace' && !s.wybrane && !s.napisano && s.kandydaci?.length > s.newsy.length) {
                const ile = s.newsy.length;
                try {
                    const model = (await cfg.modelDla(s.narrator).catch(() => null)) ?? (await cfg.modelDla('pilkarka').catch(() => null));
                    const { system, user } = promptWyboru(s.kandydaci, ile);
                    let blad = null, idx = null;
                    for (let proba = 0; proba < 2 && !idx; proba++) {
                        const r = await cfg.chat(model, system, proba ? `${user}\n\nPOPRZEDNIA ODPOWIEDŹ ODRZUCONA: ${blad}` : user);
                        try { idx = odczytajWybor(r.tekst, s.kandydaci, ile); } catch (e) { blad = e.message; }
                    }
                    if (!idx) throw new Error(blad);
                    s.newsy = idx.map((i) => s.kandydaci[i]);
                    s.uwagaWyboru = null;
                    s.wybrane = true;
                } catch (e) { s.uwagaWyboru = `🤯 wybór zaskakujących nie wyszedł (${String(e.message || e).slice(0, 160)}) — zostały tematy różnorodne`; }
                await M.pisz(s);
            }
            if (!s.zredagowane) {
                try {
                    const model = (await cfg.modelDla(s.narrator).catch(() => null)) ?? (await cfg.modelDla('pilkarka').catch(() => null));
                    const { system, user } = promptRedakcji(s.newsy, s.jezyk);
                    const red = odczytajRedakcje((await cfg.chat(model, system, user)).tekst, s.newsy);
                    s.newsy = s.newsy.map((n, i) => (red.has(i) ? zastosujRedakcje(n, red.get(i), s.jezyk) : n));
                    s.uwagaRedakcji = red.size < s.newsy.length ? `🗞️ redakcja objęła ${red.size} z ${s.newsy.length} newsów — reszta z etykietami kanału` : null;
                } catch (e) { s.uwagaRedakcji = `🗞️ redakcja nie wyszła (${String(e.message || e).slice(0, 160)}) — etykiety kanału`; }
                s.zredagowane = true;
                await M.pisz(s);
            }
            const w = await napiszScenariusz(s);
            Object.assign(s, { scenariusz: w.sc, model: w.model, proby: w.proby, uprzaz: w.uprzaz });
            // obrazy symboliczne (opcja) — padnięty FLUX nie zatrzymuje serwisu, ekrany pokażą kartę dziedziny
            if (s.obrazy && cfg.rysuj) {
                const praca = M.praca(id);
                await fsP.mkdir(praca, { recursive: true });
                for (const [i, n] of s.newsy.entries()) {
                    if (n.obraz && fsSync.existsSync(path.join(praca, n.obraz))) continue;   // przeróbka nie rysuje drugi raz
                    try {
                        const p = await cfg.rysuj({ prompt: promptObrazu(n), prefiks: `katedra/zebrra-news/${s.id}-${i + 1}` });
                        const cel = path.join(praca, `news-${i + 1}.png`);
                        await fsP.copyFile(p, cel);
                        n.obraz = `news-${i + 1}.png`;
                    } catch (e) { s.uwagaObrazow = `ilustracje: ${String(e.message || e).slice(0, 160)} — ekrany pokażą kartę dziedziny`; break; }
                }
            }
            Object.assign(s, { stan: 'studio', powod: null, napisano: czas() });
            nadaj(`serwis na ${s.dzien} gotowy (${s.newsy.length} newsów) — czeka na nagranie w Studiu News`);
        } catch (e) { Object.assign(s, { stan: 'blad', powod: String(e.message || e).slice(0, 600) }); }
        await M.pisz(s);
    }

    /** Nowy odcinek: nagłówki teraz → tematy dnia → scenariusz w tle. `auto` = z pętli dziennej (apka może nagrać sama). */
    async function utworz({ jezyk = null, narrator = null, wspolprowadzacy = null, ile = null, wybor = null, auto = false } = {}) {
        const u = await ustawienia();
        const n = await naglowki(u.zrodla);
        const ok = n.raport.filter((r) => r.ok).length;
        if (ok < 2) throw new Error(`Za mało działających kanałów RSS (${ok}): ${n.raport.filter((r) => !r.ok).map((r) => `${r.nazwa} — ${r.blad}`).slice(0, 4).join('; ')}`);
        const newsy = wybierzTematy(n.naglowki, { ile: ile ?? u.ile, teraz: cfg.teraz() });
        const wyb = WYBORY[wybor] ? wybor : u.wybor;
        const kandydaci = wyb === 'zaskakujace' ? wybierzTematy(n.naglowki, { ile: MAX_KANDYDATOW, limit: MAX_KANDYDATOW, teraz: cfg.teraz() }) : null;
        if (newsy.length < MIN_NEWSOW) throw new Error(`Za mało świeżych, różnych nagłówków (${newsy.length}).`);
        const prow = NARRATORZY[narrator] ? narrator : u.narrator;
        const wsp = (Array.isArray(wspolprowadzacy) ? wspolprowadzacy : u.wspolprowadzacy).filter((k, i, a) => NARRATORZY[k] && k !== prow && a.indexOf(k) === i).slice(0, MAX_WSPOL);
        const s = { wersja: 1, id: M.noweId('n'), stan: 'robi', powod: null, dzien: dzienLokalny(cfg.teraz()), auto: auto === true, jezyk: JEZYKI[jezyk] ? jezyk : u.jezyk,
            narrator: prow, wspolprowadzacy: wsp, newsy, wybor: wyb, kandydaci, raport: n.raport, obrazy: u.obrazy, scenariusz: null, plik: null, publikacja: null, utworzono: czas() };
        await M.pisz(s);
        M.zakolejkuj(s.id, () => przebieg(s.id));
        return s;
    }

    async function ponow(id) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
        // przeróbka: tematy dnia i narysowane ilustracje zostają; redakcja (etykiety, tytuły) i scenariusz od nowa
        const odRedakcji = s.newsy.map(({ tytulOryginalny, regionKanalu, regionKlucz: _rk, ...n }) => ({ ...n, tytul: tytulOryginalny ?? n.tytul, region: regionKanalu ?? n.region }));
        Object.assign(s, { stan: 'robi', powod: null, scenariusz: null, plik: null, publikacja: null, uwagaObrazow: null, zredagowane: false, uwagaRedakcji: null, newsy: odRedakcji });
        await M.pisz(s);
        M.zakolejkuj(id, () => przebieg(id));
        return s;
    }

    async function popraw(id, scenariusz) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi.');
        if (!s.scenariusz) throw new Error('Odcinek nie ma jeszcze scenariusza.');
        const t = (x, dom) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 1200) : dom);
        s.scenariusz = { intro: t(scenariusz?.intro, s.scenariusz.intro), outro: t(scenariusz?.outro, s.scenariusz.outro), newsy: s.scenariusz.newsy.map((x, i) => t(scenariusz?.newsy?.[i], x)) };
        Object.assign(s, { poprawiono: czas(), stan: 'studio', plik: null, publikacja: null });
        await M.pisz(s);
        return s;
    }

    async function glos(id, nr) {
        const s = await M.wczytaj(id);
        const k = kwestieOdcinka(s).find((x) => x.nr === Number(nr));
        if (!k) throw new Error('Nie ma takiej kwestii.');
        return { plik: await glosKwestii({ praca: M.praca(id), kwestia: k, glos: k.kto, jezyk: s.jezyk, mow: cfg.mow }), kto: k.kto };
    }

    /** 🎬 Oprawa: `_OtakOs_Klocki/Klocki News/start|end` (jak Mame Show); brak klocków = film bez nich + uwaga. */
    async function oprawa(s, we, cel) {
        let z = null;
        try { z = cfg.klocki ? await cfg.klocki() : null; } catch { z = null; }
        const start = klockiWJezyku(z?.start ?? [], s.jezyk), end = klockiWJezyku(z?.end ?? [], s.jezyk);
        const brak = [!start.length && 'start', !end.length && 'end'].filter(Boolean);
        s.uwagaOprawy = brak.length ? `brak klocków ${brak.join(' i ')} w ${z?.katalog ?? '_OtakOs_Klocki/Klocki News'}` : null;
        if (!cfg.spawaj || (!start.length && !end.length)) { await fsP.copyFile(we, cel); s.oprawa = null; return; }
        await cfg.spawaj({ klipy: [...start, we, ...end], wyjscie: cel, celWedlug: start.length });
        s.oprawa = { start: start.map((f) => path.basename(f)), end: end.map((f) => path.basename(f)) };
    }
    async function przeoprawa(id) {
        const s = await M.wczytaj(id);
        const studio = path.join(M.praca(id), 'studio.mp4');
        if (!s.plik || !fsSync.existsSync(studio)) throw new Error('Brak nagrania studia — nagraj odcinek.');
        if (s.publikacja?.etap && !['przygotowuje', 'do_akceptacji'].includes(s.publikacja.etap)) throw new Error('Film już poszedł na YouTube — nowa oprawa = nowe nagranie.');
        await oprawa(s, studio, s.plik);
        s.sekundy = (await cfg.opisz(s.plik).catch(() => null))?.sekundy ?? s.sekundy;
        await M.pisz(s);
        return s;
    }

    async function nagranie(id, bufor, { typ = 'video/webm', prowadzacy = null } = {}) {
        const s = await M.wczytaj(id);
        if (M.wRobocie.has(id)) throw new Error('Ten odcinek właśnie się robi — nagraj, gdy skończy.');
        if (!s.scenariusz) throw new Error('Odcinek nie ma jeszcze scenariusza.');
        const kat = await cfg.katalogMontazy(PROJEKT);
        await fsP.mkdir(kat, { recursive: true });
        const cel = path.join(kat, `news_${s.dzien}_${s.jezyk}_${s.id.slice(2)}.mp4`);
        const studio = path.join(M.praca(id), 'studio.mp4');
        await nagranieDoMp4({ bufor, typ, praca: M.praca(id), cel: studio, ffmpeg: cfg.ffmpeg });
        await oprawa(s, studio, cel);
        const kto = (Array.isArray(prowadzacy) && prowadzacy.length ? prowadzacy : [s.narrator, ...s.wspolprowadzacy]).filter((x) => NARRATORZY[x]);
        Object.assign(s, { plik: cel, prowadzacyNagrania: kto, nagrano: czas(), sekundy: (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null, stan: 'nagrany', publikacja: null, powod: null });
        if (cfg.publikuj) {
            try {
                const p = await cfg.publikuj({ plik: cel, nazwa: `${NAZWA} — ${s.dzien} · ${s.newsy.length} news`, jezyk: s.jezyk, kontekst: kontekstKronikarza(s), zrodlo: { projekt: PROJEKT, news: s.id }, kanalId: (await cfg.kanal?.().catch(() => null)) ?? null });
                s.publikacja = { id: p.id ?? null, etap: p.etap ?? null };
                s.stan = 'do_akceptacji';
            } catch (e) { s.powod = `publikacja: ${e.message}`; }
        }
        await M.pisz(s);
        nadaj(`serwis ${s.dzien} nagrany — Kronikarz pisze opis, potem ✓ w Izbie`);
        return s;
    }

    /** 🤖 Automat dnia: od godziny z ustawień, raz na dzień (także gdy padnie — powód w odcinku, nie ponawia w kółko). */
    async function krokAutomatu() {
        const u = await ustawienia();
        const teraz = new Date(cfg.teraz());
        const dzien = dzienLokalny(cfg.teraz());
        if (!u.auto) return { zrobione: false, powod: 'automat wyłączony' };
        if (teraz.getHours() < u.godzina) return { zrobione: false, powod: `czeka do ${u.godzina}:00` };
        if (u.ostatniAuto === dzien) return { zrobione: false, powod: 'dzisiejszy serwis już przygotowany' };
        // zapis PRZED próbą — padnięty serwis nie ponawia się co minutę (powód zostaje w odcinku / na szynie)
        await fsP.mkdir(M.KAT, { recursive: true });
        await fsP.writeFile(plikU, JSON.stringify({ ...u, ostatniAuto: dzien }, null, 1), 'utf8');
        try { const s = await utworz({ auto: true }); return { zrobione: true, odcinek: s.id }; }
        catch (e) { nadaj(`automat: serwis ${dzien} nie ruszył — ${e.message}`); return { zrobione: false, powod: e.message }; }
    }
    let petla = null;
    function startPetli() {
        if (petla || process.env.OTAKOS_ZEBRRA_NEWS === '0') return;
        petla = setInterval(() => { void krokAutomatu().catch(() => {}); }, 60_000);
        petla.unref?.();
    }

    function sciezkaObrazu(s, plik) {
        if (!/^news-\d+\.png$/.test(String(plik))) return null;
        const p = path.join(M.praca(s.id), plik);
        return fsSync.existsSync(p) ? p : null;
    }

    return { lista: M.lista, wczytaj: M.wczytaj, usun: M.usun, ustawienia, ustaw, naglowki, utworz, ponow, popraw, glos, nagranie, przeoprawa, krokAutomatu, startPetli, sciezkaObrazu, czekaj: M.czekaj };
}

export function zamontujTrasyZebrraNews(app, N, { raw = null, maxNagraniaMb = 600 } = {}) {
    const odp = (res, p, kod = 400) => p.then((w) => res.json({ success: true, ...w })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    app.get('/api/zebrra-news', (_req, res) => odp(res, (async () => ({
        odcinki: await N.lista(), ustawienia: await N.ustawienia(), jezyki: JEZYKI, dziedziny: NAZWY_DZIEDZIN, minNewsow: MIN_NEWSOW, maxNewsow: MAX_NEWSOW, maxWspol: MAX_WSPOL,
        narratorzy: Object.fromEntries(Object.entries(NARRATORZY).map(([k, v]) => [k, { imie: v.imie, imieEn: v.imieEn, emoji: v.emoji, rola: v.rola ?? 'stado', kolor: v.kolor ?? null }])),
    }))(), 500));
    app.put('/api/zebrra-news/ustawienia', (req, res) => odp(res, N.ustaw(req.body ?? {}).then((ustawienia) => ({ ustawienia }))));
    app.get('/api/zebrra-news/naglowki', (_req, res) => odp(res, N.ustawienia().then((u) => N.naglowki(u.zrodla)), 502));
    app.post('/api/zebrra-news/automat/teraz', (_req, res) => odp(res, N.krokAutomatu()));
    app.post('/api/zebrra-news', (req, res) => odp(res, N.utworz({ ...(req.body ?? {}), auto: false }).then((odcinek) => ({ odcinek }))));
    app.get('/api/zebrra-news/:id', (req, res) => odp(res, N.wczytaj(req.params.id).then((odcinek) => ({ odcinek })), 404));
    app.get('/api/zebrra-news/:id/studio', (req, res) => odp(res, N.wczytaj(req.params.id).then((o) => ({
        odcinek: o, kwestie: kwestieOdcinka(o), newsy: o.newsy.map((n) => ({ ...n, obrazUrl: n.obraz ? `/api/zebrra-news/${o.id}/obraz/${n.obraz}` : null })),
    })), 404));
    app.get('/api/zebrra-news/:id/obraz/:plik', async (req, res) => { try { const p = N.sciezkaObrazu(await N.wczytaj(req.params.id), req.params.plik); return p ? res.sendFile(p) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.get('/api/zebrra-news/:id/wideo', async (req, res) => { try { const s = await N.wczytaj(req.params.id); return s.plik && fsSync.existsSync(s.plik) ? res.sendFile(s.plik) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.get('/api/zebrra-news/:id/glos/:nr', (req, res) => N.glos(req.params.id, req.params.nr)
        .then(({ plik, kto }) => { res.set('X-Glos-Kto', kto); res.sendFile(plik); })
        .catch((e) => res.status(502).json({ success: false, message: e.message })));
    if (raw) app.post('/api/zebrra-news/:id/studio', raw({ type: ['video/*', 'application/octet-stream'], limit: `${maxNagraniaMb}mb` }), (req, res) => {
        const prowadzacy = String(req.query.prowadzacy ?? '').split(',').filter(Boolean);
        return odp(res, N.nagranie(req.params.id, req.body, { typ: String(req.get('content-type') || ''), prowadzacy }).then((odcinek) => ({ odcinek })));
    });
    app.post('/api/zebrra-news/:id/oprawa', (req, res) => odp(res, N.przeoprawa(req.params.id).then((odcinek) => ({ odcinek }))));
    app.post('/api/zebrra-news/:id/ponow', (req, res) => odp(res, N.ponow(req.params.id).then((odcinek) => ({ odcinek }))));
    app.put('/api/zebrra-news/:id/scenariusz', (req, res) => odp(res, N.popraw(req.params.id, req.body?.scenariusz).then((odcinek) => ({ odcinek }))));
    app.delete('/api/zebrra-news/:id', (req, res) => odp(res, N.usun(req.params.id).then((usuniety) => ({ usuniety }))));
}

export default { utworzZebrraNews, zamontujTrasyZebrraNews, ZRODLA, naglowkiZXml, wybierzTematy, WYBORY, promptWyboru, odczytajWybor, REGIONY, promptRedakcji, odczytajRedakcje, zastosujRedakcje, podobne, dziedzinaNewsa, czyPowazny, promptScenariusza, odczytajScenariusz, sprawdzLiczby, kwestieOdcinka, ktoMowiNews, promptObrazu, kontekstKronikarza };
