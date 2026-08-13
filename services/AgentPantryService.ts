/**
 * 🍱 AgentPantryService — Spiżarnia Zasobów Agentów.
 *
 * Katalog darmowych źródeł (na bazie repozytorium `300-free-resource-websites`),
 * z którego mogą korzystać moduły Katedry: Joanna, Reżyser, Teledysk, Story V2.
 *
 * ⚠️ JEDNA RZECZ, KTÓRĄ TRZEBA POWIEDZIEĆ WPROST — i która zmienia kształt tego
 * modułu wobec pierwotnego zamysłu:
 *
 * Tamto repozytorium to **lista 300 STRON dla człowieka** w 19 kategoriach
 * (unsplash, pexels, notion, excalidraw, vercel…), a NIE katalog wywoływalnych
 * API. Większość wpisów nie ma darmowego, bezkluczowego interfejsu — agent nie
 * „pobierze zasobu" z `musicforprogramming.net` ani z `claude.ai`. Gdyby
 * `pobierzZasob()` udawało, że pobiera z każdego wpisu, byłaby to atrapa
 * udająca funkcję.
 *
 * Dlatego każdy zasób niesie pole `dostepnosc`, a to rozróżnienie jest CAŁĄ
 * wartością tej spiżarni dla agenta:
 *   · `api`       — wywoływalne BEZ KLUCZA (zmierzone na żywo 2026-08-13),
 *   · `api-klucz` — ma API, ale wymaga rejestracji i klucza,
 *   · `strona`    — miejsce dla człowieka; agent może co najwyżej podać odnośnik.
 *
 * `pobierzZasob()` realnie odpytuje wyłącznie pozycje `api`. Dla reszty zwraca
 * uczciwą listę odnośników i mówi, że pobrania nie było.
 */

export type Dostepnosc = 'api' | 'api-klucz' | 'strona';

export type KategoriaId =
    | 'AUDIO_SONIC' | 'VIDEO_MEDIA' | 'AI_MODELS' | 'FREE_API_HOSTING' | 'DATASTORAGE';

export interface Kategoria {
    id: KategoriaId;
    etykieta: string;
    opis: string;
}

export interface Zasob {
    nazwa: string;
    url: string;
    opis: string;
    dostepnosc: Dostepnosc;
    /** Buduje adres zapytania. Tylko dla `dostepnosc: 'api'`. */
    zapytanie?: (fraza: string, ile: number) => string;
    /** Wyciąga pozycje z odpowiedzi. Tylko dla `dostepnosc: 'api'`. */
    odczytaj?: (dane: unknown) => PozycjaZasobu[];
    /** Które moduły Katedry realnie to zjedzą — bez tego katalog jest tylko listą. */
    dlaModulu?: string[];
    licencja?: string;
}

export interface PozycjaZasobu {
    tytul: string;
    url: string;
    autor?: string;
    licencja?: string;
    podglad?: string;
}

export const KATEGORIE: Kategoria[] = [
    { id: 'AUDIO_SONIC',      etykieta: '🎵 AUDIO & SONIC',     opis: 'Dźwięk, muzyka, efekty — karma dla Joanny, radia i teledysku.' },
    { id: 'VIDEO_MEDIA',      etykieta: '🎥 VIDEO & MEDIA',     opis: 'Obraz i wideo — źródła dla TeO Kadr i etapu KADR w Story V2.' },
    { id: 'AI_MODELS',        etykieta: '🧠 AI & MODELS',       opis: 'Modele i narzędzia AI dostępne bez opłat.' },
    { id: 'FREE_API_HOSTING', etykieta: '⚡ FREE API & HOSTING', opis: 'Darmowe API, hosting, CDN — miejsce dla Katedry w sieci.' },
    { id: 'DATASTORAGE',      etykieta: '💾 DATASTORAGE',       opis: 'Bazy, przestrzeń, archiwa.' },
];

// ── Odczyty odpowiedzi (osobno, żeby dało się je przetestować bez sieci) ─────

const czytajOpenverse = (dane: any): PozycjaZasobu[] =>
    (dane?.results ?? []).map((r: any) => ({
        tytul: r.title || '(bez tytułu)',
        url: r.url || r.foreign_landing_url || '',
        autor: r.creator || undefined,
        licencja: r.license ? `${r.license} ${r.license_version ?? ''}`.trim() : undefined,
        podglad: r.thumbnail || undefined,
    }));

const czytajArchive = (dane: any): PozycjaZasobu[] =>
    (dane?.response?.docs ?? []).map((d: any) => ({
        tytul: d.title || d.identifier,
        url: `https://archive.org/details/${d.identifier}`,
        autor: d.creator || undefined,
    }));

const czytajCommons = (dane: any): PozycjaZasobu[] =>
    (dane?.query?.search ?? []).map((s: any) => ({
        tytul: s.title,
        url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(s.title)}`,
        licencja: 'Creative Commons / public domain (sprawdź na stronie pliku)',
    }));

/**
 * Spiżarnia. Pozycje `api` zostały ZMIERZONE — 2026-08-13 każda odpowiedziała
 * HTTP 200 bez klucza. Reszta jest oznaczona uczciwie, żeby agent nie próbował
 * z nich pobierać i nie dostawał ciszy zamiast błędu.
 */
export const SPIZARNIA: Record<KategoriaId, Zasob[]> = {
    AUDIO_SONIC: [
        {
            nazwa: 'Openverse Audio', url: 'https://openverse.org',
            opis: 'Wyszukiwarka dźwięku na wolnych licencjach. Bezkluczowe API.',
            dostepnosc: 'api', licencja: 'Creative Commons',
            dlaModulu: ['Dom Joanny (playlista)', 'Teledysk (podkład)', 'PodcastCore'],
            zapytanie: (f, ile) => `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(f)}&page_size=${ile}`,
            odczytaj: czytajOpenverse,
        },
        {
            nazwa: 'Internet Archive — audio', url: 'https://archive.org',
            opis: 'Archiwum nagrań, w tym domena publiczna. Bezkluczowe wyszukiwanie.',
            dostepnosc: 'api', licencja: 'różne / domena publiczna',
            dlaModulu: ['Dom Joanny (playlista)', 'Radio Katedry'],
            zapytanie: (f, ile) =>
                `https://archive.org/advancedsearch.php?q=${encodeURIComponent(f)}+AND+mediatype%3Aaudio`
                + `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=${ile}&output=json`,
            odczytaj: czytajArchive,
        },
        { nazwa: 'Freesound', url: 'https://freesound.org', opis: 'Wielka biblioteka efektów dźwiękowych. API istnieje, ale wymaga klucza.', dostepnosc: 'api-klucz', licencja: 'Creative Commons' },
        { nazwa: 'musicforprogramming.net', url: 'https://musicforprogramming.net', opis: 'Ambient do pracy. Ma kanał RSS, ale to audycje w całości — nie wyszukiwarka.', dostepnosc: 'strona' },
        { nazwa: 'Incompetech', url: 'https://incompetech.com', opis: 'Muzyka royalty-free (Kevin MacLeod). Pobieranie ręczne.', dostepnosc: 'strona', licencja: 'CC BY' },
        { nazwa: 'Uppbeat', url: 'https://uppbeat.io', opis: 'Muzyka dla twórców, darmowy plan z limitem.', dostepnosc: 'strona' },
        { nazwa: 'myNoise', url: 'https://mynoise.net', opis: 'Generatory szumu i tła. Dla człowieka, nie dla agenta.', dostepnosc: 'strona' },
    ],

    VIDEO_MEDIA: [
        {
            nazwa: 'Openverse Images', url: 'https://openverse.org',
            opis: 'Ponad 800 mln materiałów na wolnych licencjach. Bezkluczowe API.',
            dostepnosc: 'api', licencja: 'Creative Commons',
            dlaModulu: ['Story V2 — etap KADR', 'TeO Kadr', 'Kronika'],
            zapytanie: (f, ile) => `https://api.openverse.org/v1/images/?q=${encodeURIComponent(f)}&page_size=${ile}`,
            odczytaj: czytajOpenverse,
        },
        {
            nazwa: 'Wikimedia Commons', url: 'https://commons.wikimedia.org',
            opis: 'Repozytorium mediów Wikipedii. Bezkluczowe API.',
            dostepnosc: 'api', licencja: 'CC / domena publiczna',
            dlaModulu: ['Story V2 — etap KADR', 'Kronika'],
            zapytanie: (f, ile) =>
                `https://commons.wikimedia.org/w/api.php?action=query&list=search`
                + `&srsearch=${encodeURIComponent(f)}&format=json&srlimit=${ile}&origin=*`,
            odczytaj: czytajCommons,
        },
        {
            nazwa: 'Internet Archive — wideo', url: 'https://archive.org',
            opis: 'Filmy i nagrania archiwalne, bezkluczowe wyszukiwanie.',
            dostepnosc: 'api', licencja: 'różne / domena publiczna',
            dlaModulu: ['TeO Kadr', 'Teledysk'],
            zapytanie: (f, ile) =>
                `https://archive.org/advancedsearch.php?q=${encodeURIComponent(f)}+AND+mediatype%3Amovies`
                + `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=${ile}&output=json`,
            odczytaj: czytajArchive,
        },
        { nazwa: 'Unsplash', url: 'https://unsplash.com', opis: 'Zdjęcia wysokiej jakości. API wymaga klucza aplikacji.', dostepnosc: 'api-klucz' },
        { nazwa: 'Pexels', url: 'https://pexels.com', opis: 'Zdjęcia i wideo. API wymaga klucza.', dostepnosc: 'api-klucz' },
        { nazwa: 'Pixabay', url: 'https://pixabay.com', opis: 'Zdjęcia, wideo, ilustracje. API wymaga klucza.', dostepnosc: 'api-klucz' },
        { nazwa: 'Mixkit', url: 'https://mixkit.co', opis: 'Darmowe klipy wideo i szablony. Pobieranie ręczne.', dostepnosc: 'strona' },
        { nazwa: 'Coverr', url: 'https://coverr.co', opis: 'Wideo tłowe. Pobieranie ręczne.', dostepnosc: 'strona' },
    ],

    AI_MODELS: [
        { nazwa: 'Ollama', url: 'https://ollama.com', opis: 'Modele lokalne — to na nim stoi rdzeń Katedry. Bez chmury.', dostepnosc: 'strona', dlaModulu: ['Rdzeń Katedry', 'Reżyser', 'Rada Kreatywna'] },
        { nazwa: 'Hugging Face', url: 'https://huggingface.co', opis: 'Modele i zbiory danych. Pobieranie modeli bez klucza, API wnioskowania z kluczem.', dostepnosc: 'api-klucz' },
        { nazwa: 'Claude', url: 'https://claude.ai', opis: 'Rozmowa i praca z kodem. Interfejs dla człowieka.', dostepnosc: 'strona' },
        { nazwa: 'Perplexity', url: 'https://perplexity.ai', opis: 'Wyszukiwanie z odpowiedzią. Interfejs dla człowieka.', dostepnosc: 'strona' },
        { nazwa: 'Google AI Studio', url: 'https://aistudio.google.com', opis: 'Generowanie obrazu i tekstu — etap KADR w workflow kreskówki.', dostepnosc: 'strona', dlaModulu: ['Tablica Produkcji — KADR'] },
    ],

    FREE_API_HOSTING: [
        { nazwa: 'Cloudflare Pages', url: 'https://pages.cloudflare.com', opis: 'Hosting stron i tunel — Katedra używa już Kwantowego Tunelu Cloudflare.', dostepnosc: 'strona', dlaModulu: ['Kwantowy Tunel', 'Panel Podłączeń'] },
        { nazwa: 'Vercel', url: 'https://vercel.com', opis: 'Hosting aplikacji, darmowy plan.', dostepnosc: 'strona' },
        { nazwa: 'Netlify', url: 'https://netlify.com', opis: 'Hosting statyczny, darmowy plan.', dostepnosc: 'strona' },
        { nazwa: 'Hoppscotch', url: 'https://hoppscotch.io', opis: 'Klient API w przeglądarce — do ręcznego sprawdzania endpointów.', dostepnosc: 'strona' },
        {
            nazwa: 'CoinGecko', url: 'https://www.coingecko.com/api',
            opis: 'Notowania krypto. Bez klucza działa, ale limit jest niski — zmierzone: JEDEN adres kontraktu na zapytanie cenowe.',
            dostepnosc: 'api', dlaModulu: ['Portfel', 'Ted the Trader', 'Mapa Sektorów'],
            // Wyszukiwarka monet — jedyny endpoint CoinGecko pasujący do kształtu
            // „szukaj frazy". Ceny mają własną drogę w TokenyErc20Service.
            zapytanie: (f) => `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(f)}`,
            odczytaj: (dane: any) => (dane?.coins ?? []).map((c: any) => ({
                tytul: `${c.name} (${c.symbol})`,
                url: `https://www.coingecko.com/en/coins/${c.id}`,
                podglad: c.thumb || undefined,
            })),
        },
    ],

    DATASTORAGE: [
        {
            nazwa: 'Internet Archive', url: 'https://archive.org',
            opis: 'Archiwum wszystkiego. Bezkluczowe wyszukiwanie pełnotekstowe.',
            dostepnosc: 'api', dlaModulu: ['Kronika', 'Archiwum Akaszy'],
            zapytanie: (f, ile) =>
                `https://archive.org/advancedsearch.php?q=${encodeURIComponent(f)}`
                + `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=${ile}&output=json`,
            odczytaj: czytajArchive,
        },
        { nazwa: 'Supabase', url: 'https://supabase.com', opis: 'Baza Postgres z darmowym planem.', dostepnosc: 'api-klucz' },
        { nazwa: 'Obsidian', url: 'https://obsidian.md', opis: 'Notatki w plikach Markdown — lokalnie, po suwerennemu.', dostepnosc: 'strona' },
        { nazwa: 'Excalidraw', url: 'https://excalidraw.com', opis: 'Szkice i diagramy w przeglądarce.', dostepnosc: 'strona' },
    ],
};

/** Wszystkie zasoby jednym ciągiem — do wyszukiwarki i statystyk. */
export function wszystkieZasoby(): (Zasob & { kategoria: KategoriaId })[] {
    return (Object.entries(SPIZARNIA) as [KategoriaId, Zasob[]][])
        .flatMap(([kategoria, lista]) => lista.map(z => ({ ...z, kategoria })));
}

/** Bez ogonków i małymi literami — „Świt" i „swit" mają się spotkać. */
const uprosc = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/**
 * Dopasowanie znoszące polską odmianę.
 *
 * ⚠️ POWÓD ISTNIENIA: zwykłe `includes` nie łączyło zapytania „Joanna"
 * z modułem „Dom Joanny (playlista)" — a to najbardziej naturalne pytanie,
 * jakie Suweren zada tej wyszukiwarce. To NIE jest stemmer, tylko celowo
 * prymitywna zgoda na końcówkę: dwa słowa pasują, gdy jedno zaczyna się od
 * drugiego albo dzielą co najmniej 4 znaki początku.
 */
function pasujeSlowo(szukane: string, wStogu: string): boolean {
    if (wStogu.includes(szukane)) return true;
    if (szukane.length < 4) return false;
    for (const slowo of wStogu.split(/[^a-z0-9]+/)) {
        if (slowo.length < 4) continue;
        if (slowo.startsWith(szukane) || szukane.startsWith(slowo)) return true;
        const wspolny = Math.min(slowo.length, szukane.length);
        let i = 0;
        while (i < wspolny && slowo[i] === szukane[i]) i++;
        if (i >= 4) return true;
    }
    return false;
}

/** Szukaj po nazwie, opisie i module docelowym. Pusta fraza = wszystko. */
export function szukaj(fraza: string, kategoria?: KategoriaId) {
    const f = uprosc(fraza.trim());
    return wszystkieZasoby()
        .filter(z => !kategoria || z.kategoria === kategoria)
        .filter(z => !f || [
            z.nazwa, z.opis, ...(z.dlaModulu ?? []),
        ].some(pole => pasujeSlowo(f, uprosc(pole))));
}

/** Ile czego mamy — panel pokazuje to zamiast obiecywać „300+". */
export function statystyka() {
    const w = wszystkieZasoby();
    return {
        wszystkich: w.length,
        wywolywalne: w.filter(z => z.dostepnosc === 'api').length,
        zKluczem: w.filter(z => z.dostepnosc === 'api-klucz').length,
        strony: w.filter(z => z.dostepnosc === 'strona').length,
    };
}

export interface WynikPobrania {
    zrodlo: string | null;
    pozycje: PozycjaZasobu[];
    /** Puste, gdy pobranie faktycznie się udało. */
    uwaga: string | null;
    odnosniki: { nazwa: string; url: string; dostepnosc: Dostepnosc }[];
}

/**
 * Realne pobranie zasobu dla agenta.
 *
 * Odpytuje TYLKO pozycje `dostepnosc: 'api'` — pierwszą z danej kategorii,
 * która potrafi zbudować zapytanie. Gdy w kategorii nie ma nic wywoływalnego,
 * NIE udaje pobrania: zwraca puste `pozycje`, wyjaśnienie w `uwaga` i listę
 * odnośników dla człowieka.
 */
export async function pobierzZasob(
    kategoria: KategoriaId,
    zapytanieTekstem: string,
    ile = 8,
): Promise<WynikPobrania> {
    const lista = SPIZARNIA[kategoria] ?? [];
    const odnosniki = lista.map(z => ({ nazwa: z.nazwa, url: z.url, dostepnosc: z.dostepnosc }));
    const wywolywalne = lista.filter(z => z.dostepnosc === 'api' && z.zapytanie && z.odczytaj);

    if (!wywolywalne.length) {
        return {
            zrodlo: null, pozycje: [], odnosniki,
            uwaga: `W kategorii „${kategoria}" nie ma źródła wywoływalnego bez klucza. `
                 + 'To miejsca dla człowieka — poniżej odnośniki, pobrania nie było.',
        };
    }

    const bledy: string[] = [];
    for (const z of wywolywalne) {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 9000);
            try {
                const r = await fetch(z.zapytanie!(zapytanieTekstem, ile), { signal: ctrl.signal });
                if (!r.ok) { bledy.push(`${z.nazwa}: HTTP ${r.status}`); continue; }
                const dane = await r.json();
                const pozycje = z.odczytaj!(dane).filter(p => p.url);
                if (!pozycje.length) { bledy.push(`${z.nazwa}: brak wyników`); continue; }
                return { zrodlo: z.nazwa, pozycje, odnosniki, uwaga: null };
            } finally { clearTimeout(t); }
        } catch (e) {
            bledy.push(`${z.nazwa}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // Wszystkie źródła zawiodły — mówimy KTÓRE i DLACZEGO, zamiast oddać pustkę.
    return {
        zrodlo: null, pozycje: [], odnosniki,
        uwaga: `Żadne źródło nie odpowiedziało: ${bledy.join(' · ')}`,
    };
}

export default { KATEGORIE, SPIZARNIA, wszystkieZasoby, szukaj, statystyka, pobierzZasob };
