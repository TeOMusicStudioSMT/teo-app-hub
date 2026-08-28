/**
 * 🎨 WiedzaDesign — korpus wzorców projektowania front-endu dla agentów App V2.
 *
 * Źródło: greatfrontend/awesome-front-end-system-design (klon w _OtakOs_Wiedza/).
 *
 * DLACZEGO WŁASNY PARSER, A NIE SAM GRAPHIFY:
 * `graphify update` na tym repo dał 33 węzły — same nagłówki. To tryb kodu (AST),
 * który nie widzi linków w markdownie. Pełna ekstrakcja semantyczna w Graphify
 * wymaga klucza do chmury (GEMINI_API_KEY), a to łamie 0.00G. README ma za to
 * bardzo regularną strukturę, więc 309 linków wyciągamy dokładnie i lokalnie.
 * Graf Graphify zostaje jako MAPA korpusu; agenta karmi ten parser.
 *
 * Zero tokenów, zero sieci przy odczycie — czyta plik z dysku i trzyma w pamięci.
 */
import fs from 'fs/promises';
import path from 'path';

const KORPUS = path.join(process.cwd(), '_OtakOs_Wiedza', 'front-end-system-design', 'README.md');

let cache = null;      // { mtimeMs, tematy }

/** Slug z nagłówka: „News Feed (e.g. Facebook)" → „news-feed". */
function slug(naglowek) {
    return naglowek
        .replace(/\(e\.g\..*?\)/gi, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Wyłuskaj wszystkie [tytuł](url) z linii. */
function linki(linia) {
    const out = [];
    const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let m;
    while ((m = re.exec(linia)) !== null) out.push({ tytul: m[1].trim(), url: m[2] });
    return out;
}

/**
 * Parsuje README na listę tematów.
 * `##` = kategoria, `###` = temat, `- Guides|Case Studies|Resources` = grupa,
 * zagnieżdżone punkty bez linku = nazwa firmy (kontekst dla kolejnych linków).
 */
function parsuj(tekst) {
    const linie = tekst.split(/\r?\n/);
    const tematy = [];
    let kategoria = '';
    let temat = null;
    let grupa = null;
    let firma = null;

    const zamknij = () => { if (temat) tematy.push(temat); };

    for (const linia of linie) {
        const h2 = /^##\s+(.+?)\s*$/.exec(linia);
        const h3 = /^###\s+(.+?)\s*$/.exec(linia);

        if (h2 && !linia.startsWith('###')) {
            zamknij(); temat = null; grupa = null; firma = null;
            kategoria = h2[1].trim();
            continue;
        }
        if (h3) {
            zamknij();
            const pelny = h3[1].trim();
            const przyklady = /\(e\.g\.\s*([^)]+)\)/i.exec(pelny);
            temat = {
                id: slug(pelny),
                nazwa: pelny.replace(/\s*\(e\.g\..*?\)/i, '').trim(),
                kategoria,
                przyklady: przyklady ? przyklady[1].split(',').map(s => s.trim()) : [],
                strony: [],
                zasoby: {},
                liczbaZrodel: 0,
            };
            grupa = null; firma = null;
            continue;
        }
        if (!temat) continue;

        // _Examples: [facebook.com](…), [twitter.com](…)_
        if (/^_Examples?:/i.test(linia.trim())) {
            temat.strony = linki(linia).map(l => l.tytul);
            continue;
        }

        // Nagłówek grupy: „- Guides", „- Case Studies", „- Resources"
        const g = /^-\s+(Guides|Case Studies|Resources)\s*$/i.exec(linia);
        if (g) { grupa = g[1]; firma = null; temat.zasoby[grupa] = temat.zasoby[grupa] || []; continue; }

        const wciecie = (/^(\s*)-\s/.exec(linia) || [, ''])[1].length;
        const l = linki(linia);

        // Punkt bez linku i z wcięciem = nazwa firmy, kontekst dla kolejnych.
        if (/^\s*-\s/.test(linia) && l.length === 0) {
            const nazwa = linia.replace(/^\s*-\s*/, '').trim();
            if (nazwa && wciecie >= 2) firma = nazwa;
            continue;
        }

        if (l.length && grupa) {
            for (const wpis of l) {
                temat.zasoby[grupa].push(firma ? { ...wpis, firma } : wpis);
                temat.liczbaZrodel++;
            }
        }
    }
    zamknij();
    return tematy;
}

/** Wczytaj korpus (z cache, odświeżanym po mtime pliku). */
export async function wczytajKorpus() {
    const st = await fs.stat(KORPUS);
    if (cache && cache.mtimeMs === st.mtimeMs) return cache.tematy;
    const tekst = await fs.readFile(KORPUS, 'utf8');
    const tematy = parsuj(tekst);
    cache = { mtimeMs: st.mtimeMs, tematy };
    return tematy;
}

/** Ścieżka do korpusu — żeby most mógł uczciwie powiedzieć, czego brakuje. */
export const SCIEZKA_KORPUSU = KORPUS;

const STOP = new Set(['app','aplikacja','apka','the','and','oraz','dla','sie','się','tool','strona','system','design','front','end']);

/**
 * 🇵🇱 SŁOWNIK POLSKI → TEMAT KORPUSU.
 *
 * Zmierzone, nie przewidziane: bez tego „zrób mi apkę do czatu" trafiało w NIC,
 * bo korpus jest po angielsku („Chat App"). Katedra mówi po polsku, więc moduł
 * bez tej mapy byłby ozdobą. Trzony słów bez końcówek — polska odmiana
 * (czat/czatu/czacie) łapie się wtedy sama.
 */
const SYNONIMY = {
    'news-feed':                 ['feed', 'tablic', 'aktualnośc', 'aktualnosc', 'strumień wpisów', 'oś czasu', 'os czasu', 'posty'],
    'e-commerce-site':           ['sklep', 'koszyk', 'zakup', 'e-commerce', 'ecommerce', 'produkt', 'zamówien', 'zamowien', 'płatnoś', 'platnos'],
    'photo-sharing':             ['zdjęc', 'zdjec', 'foto', 'galeri', 'album'],
    'chat-app':                  ['czat', 'chat', 'rozmow', 'wiadomośc', 'wiadomosc', 'komunikator', 'messenger'],
    'travel-booking':            ['podróż', 'podroz', 'rezerwac', 'hotel', 'nocleg', 'lot', 'wycieczk'],
    'pinterest':                 ['pinterest', 'tablica inspirac', 'moodboard', 'masonry'],
    'email-client':              ['mail', 'poczt', 'skrzynk', 'e-mail'],
    'ridesharing-app':           ['przejazd', 'taks', 'kierowc', 'uber', 'mapa na żywo', 'mapa na zywo'],
    'video-streaming':           ['wideo', 'video', 'film', 'odtwarzacz', 'streaming', 'transmisj'],
    'music-streaming':           ['muzyk', 'utwór', 'utwor', 'playlist', 'radio', 'dźwięk', 'dzwiek', 'słuchan', 'sluchan'],
    'collaborative-editor':      ['wspólna edycj', 'wspolna edycj', 'współprac', 'wspolprac', 'dokument', 'edytor tekstu', 'na żywo razem', 'na zywo razem'],
    'collaborative-spreadsheet': ['arkusz', 'tabel', 'kalkulac', 'komórk', 'komork'],
    'design-tool':               ['narzędzie projekt', 'narzedzie projekt', 'figma', 'płótn', 'plotn', 'canvas', 'rysowan', 'kształt', 'ksztalt'],
    'video-call':                ['rozmowa wideo', 'wideorozmow', 'połączeni', 'polaczeni', 'kamer', 'zoom', 'spotkani'],
    'task-tracking':             ['zadani', 'kanban', 'tablica zadań', 'tablica zadan', 'projekt', 'trello', 'sprint', 'todo'],
    'rich-text-editing':         ['edytor tekst', 'formatowani', 'wysiwyg', 'bogaty tekst'],
    'ai-in-frontend':            ['sztuczna inteligenc', 'agent', 'llm', 'model językow', 'model jezykow', 'asystent'],
    'internationalization-i18n-localization-l10n': ['tłumacz', 'tlumacz', 'język', 'jezyk', 'lokalizac', 'wielojęzyc', 'wielojezyc'],
    'server-driven-user-interfaces-sdui': ['sterowany serwer', 'sdui', 'interfejs z serwer'],
    'local-first-offline-sync':  ['offline', 'bez internetu', 'synchroniz', 'lokalnie najpierw', 'tryb samolot'],
    'autocomplete-typeahead':    ['podpowiedz', 'podpowiedź', 'autouzupełni', 'autouzupelni', 'wyszukiwar', 'szukajk', 'sugesti'],
    'image-carousel':            ['karuzel', 'suwak zdjęć', 'suwak zdjec', 'slajd', 'przewijan zdjęć'],
    'dropdown-menu':             ['rozwijan', 'menu', 'lista wybor', 'select'],
    'modal-dialog':              ['modal', 'okno dialog', 'wyskakując', 'wyskakujac', 'popup'],
    'star-widget':               ['gwiazdk', 'ocen', 'rating', 'recenzj'],
    'tooltip-popover':           ['dymek', 'podpowiedź przy najech', 'tooltip', 'popover'],
    'design-systems':            ['system projekt', 'design system', 'biblioteka komponent', 'spójność wizual', 'spojnosc wizual', 'tokeny'],
};

/**
 * Dopasuj opis od Suwerena („zrób mi apkę do czatu") do tematów korpusu.
 * Punktacja prosta i jawna — bez wektorów i bez modelu:
 *   +10 nazwa tematu w tekście, +6 przykład (Messenger), +4 słowo z nazwy, +2 domena.
 */
export async function dopasuj(opis, ile = 3) {
    const tematy = await wczytajKorpus();
    const t = ` ${String(opis).toLowerCase()} `;
    const wyniki = tematy.map((tm) => {
        let punkty = 0;
        const nazwa = tm.nazwa.toLowerCase();
        if (t.includes(nazwa)) punkty += 10;
        for (const p of tm.przyklady) if (p && t.includes(p.toLowerCase())) punkty += 6;
        for (const slowo of nazwa.split(/[^a-z0-9]+/)) {
            if (slowo.length > 2 && !STOP.has(slowo) && t.includes(slowo)) punkty += 4;
        }
        for (const s of tm.strony) {
            const rdzen = s.replace(/\.(com|org|net|io)$/i, '').toLowerCase();
            if (rdzen.length > 3 && t.includes(rdzen)) punkty += 2;
        }
        // Polski trzon — po nim najczęściej trafia Suweren, bo tak pisze.
        for (const syn of SYNONIMY[tm.id] || []) if (t.includes(syn)) punkty += 8;
        return { temat: tm, punkty };
    });
    return wyniki.filter(w => w.punkty > 0).sort((a, b) => b.punkty - a.punkty).slice(0, ile);
}

/** Zwięzły brief dla agenta — do wstrzyknięcia w instrukcję systemową. */
export function brief(temat, maxZrodel = 6) {
    const linie = [`WZORZEC: ${temat.nazwa}${temat.przyklady.length ? ` (jak ${temat.przyklady.join(', ')})` : ''}`];
    if (temat.strony.length) linie.push(`Realne przykłady: ${temat.strony.join(', ')}`);
    for (const [grupa, wpisy] of Object.entries(temat.zasoby)) {
        if (!wpisy.length) continue;
        const wybrane = wpisy.slice(0, maxZrodel)
            .map(w => (w.firma ? `${w.firma}: ${w.tytul}` : w.tytul));
        linie.push(`${grupa} (${wpisy.length}): ${wybrane.join(' · ')}`);
    }
    return linie.join('\n');
}

export default { wczytajKorpus, dopasuj, brief, SCIEZKA_KORPUSU };
