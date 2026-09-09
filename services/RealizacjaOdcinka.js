/**
 * 🎬 RealizacjaOdcinka — Reżyser z TeOgochi biorą odcinek i rozkładają go
 * na Tablicę Produkcji.
 *
 * PO CO. Suweren: „przechodzą do modułu reżyserskiego i sami wypełniają
 * wszystkie potrzebne pola, tworzą potrzebne kadry i realizują".
 * Do tej pory Suweren przepisywał opis odcinka na karty ręcznie, kadr po kadrze.
 *
 * CO SIĘ DZIEJE:
 *   metadane odcinka (tytuł, czas, opis, styl) + kotwica projektu
 *      → model pisze BIBLIĘ (gdy projekt jej nie ma)
 *      → model rozpisuje KADRY na cały czas trwania
 *      → karty lądują na Tablicy, odcinek przechodzi w „produkcja"
 *
 * ⚠️ CZAS TRWANIA STEROWNIKIEM, NIE OZDOBĄ. Z minut liczymy, ile kadrów ma
 * powstać. Jeden kadr to ujęcie kilkunastu sekund ekranu — nie 2-sekundowy
 * klip Wana, tylko JEDNOSTKA PRACY na tablicy, którą potem realizuje się
 * łańcuchem albo kamerami. Przy 15 s na kadr trzyminutowy odcinek to 12 kart:
 * tyle da się przejrzeć i poprawić. Sekundowe cięcie dałoby 90 kart, których
 * nikt nie przeczyta.
 *
 * ⚠️ SUFIT JEST TWARDY. Półgodzinny odcinek to 120 kart i kilkanaście minut
 * pisania przez mały model. Powyżej `MAX_KADROW` mówimy wprost, że odcinek
 * trzeba rozbić, zamiast zawiesić tablicę.
 */

/** Ile sekund ekranu przypada na jeden kadr tablicy. */
/**
 * Ile sekund EKRANU pokrywa jeden kadr.
 *
 * ⚠️ BYŁO 15 I BYŁO TO NIEPRAWDĄ — 7,4 raza za dużo. Suweren: „błędnie
 * wskazuje kadry do minut... 24 kadry są za krótkie". Sprawdzone na gotowych
 * ujęciach z tego projektu: KAŻDE trwa 2,04 s (Wan 2.2 przy obecnych
 * ustawieniach klatek). Osiem plików z rzędu, ta sama wartość co do setnej.
 *
 * Więc 24 kadry to nie 6 minut, tylko 49 SEKUND filmu. Plan, który obiecywał
 * 20-minutowy odcinek z 24 kadrów, kłamał o rząd wielkości.
 *
 * Wartość zależy od ustawień silnika (więcej klatek = dłuższe ujęcie, ale
 * więcej VRAM i czasu), dlatego da się ją nadpisać: OTAKOS_SEKUND_NA_KADR.
 */
export const SEKUND_NA_KADR = Number(process.env.OTAKOS_SEKUND_NA_KADR) || 2.04;

/**
 * Ile kadrów model rozpisuje w JEDNYM przebiegu.
 *
 * ⚠️ TO SUFIT PRZEBIEGU, NIE SUFIT ODCINKA. Mały model nie napisze 400 opisów
 * w jednym wywołaniu — rozjechałby się po dwudziestym. REALIZUJ można kliknąć
 * ponownie i kadry się DOKŁADAJĄ (odcinek #1 SOLLET ma tak 72 z trzech przebiegów).
 */
export const MAX_KADROW = 24;

/**
 * Ile kadrów dla odcinka o danej długości — i ile z tego zmieści się w tym
 * przebiegu.
 *
 * Zwraca `potrzebne` (prawda o długości), `ile` (ten przebieg) i `przebiegow`
 * (ile razy trzeba kliknąć REALIZUJ). Bez czasu — ostrożne minimum.
 */
export function ileKadrow(czasMinut, { juzMa = 0, sekundNaKadr } = {}) {
    // Długość ujęcia bywa wybrana w kolejce — wtedy liczymy według niej.
    const NA_KADR = Number(sekundNaKadr) > 0 ? Number(sekundNaKadr) : SEKUND_NA_KADR;
    const m = Number(czasMinut);
    if (!Number.isFinite(m) || m <= 0) {
        return { ile: 4, zgadywane: true, potrzebne: null, przebiegow: null, sekundNaKadr: SEKUND_NA_KADR };
    }

    const potrzebne = Math.max(2, Math.round((m * 60) / NA_KADR));
    const zostalo = Math.max(0, potrzebne - Math.max(0, juzMa));
    const ile = Math.max(2, Math.min(MAX_KADROW, zostalo || potrzebne));

    return {
        ile,
        zgadywane: false,
        potrzebne,
        zostalo,
        przebiegow: Math.ceil(zostalo / MAX_KADROW) || 0,
        sekundNaKadr: NA_KADR,
        // Zachowane pod starą nazwą — most raportuje tym polem „przycięcie".
        policzone: potrzebne,
    };
}

/** Ile minut filmu daje N kadrów — odwrotność, do uczciwych komunikatów. */
export function minutZKadrow(ile) {
    const n = Number(ile);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round((n * SEKUND_NA_KADR) / 6) / 10;
}

/**
 * Prompt na BIBLIĘ odcinka. Powstaje TYLKO wtedy, gdy projekt jej nie ma —
 * biblia jest kotwicą stylu i pisanie jej drugi raz przy każdym odcinku
 * rozjechałoby serial szybciej niż jej brak.
 */
export function promptBiblii({ projekt, odcinek, kotwica = '' }) {
    const system = [
        'Jesteś SCENARZYSTĄ pilnującym spójności świata. Odpowiadasz po polsku.',
        'Piszesz BIBLIĘ PROJEKTU: paleta barw, karty postaci (wygląd, strój, sylwetka),',
        'zasady świata, pora dnia, styl kreski. NIE opowiadasz fabuły.',
        'Oddajesz samą treść — bez wstępu, bez „Oto…", bez komentarza o sobie.',
    ].join('\n');

    const czesci = [`PROJEKT: ${projekt}`, `ODCINEK: #${odcinek.numer} ${odcinek.tytul}`];
    if (odcinek.styl) czesci.push(`STYL ZADANY PRZEZ SUWERENA: ${odcinek.styl}`);
    czesci.push(`TREŚĆ ODCINKA: ${odcinek.streszczenie}`);
    if (kotwica.trim()) czesci.push(`\nCO JUŻ WIADOMO O ŚWIECIE:\n${kotwica.trim().slice(0, 1500)}`);
    czesci.push('\nNapisz biblię. Sama treść.');

    return { system, prompt: czesci.join('\n') };
}

/**
 * Prompt na KADRY. Wymuszamy JSON i jedną scenę na kadr.
 *
 * ⚠️ Model dostaje NUMER i CZAS każdego kadru, żeby rozłożył akcję po całym
 * odcinku, a nie streścił go w pierwszych trzech kartach i zostawił resztę
 * na „bohater idzie dalej".
 */
export function promptKadrow({ projekt, odcinek, kotwica = '', obsada = '', ile }) {
    const system = [
        'Jesteś RYSOWNIKIEM rozkładającym odcinek na KADRY. Odpowiadasz po polsku.',
        `Rozpisujesz ${ile} kadrów. Każdy to około ${SEKUND_NA_KADR} s ekranu — czyli KRÓTKIE ujęcie, jedna myśl obrazowa, nie cała scena.`,
        '',
        'ŻELAZNE ZASADY:',
        '1. Kadry układają się w CIĄG: pierwszy otwiera odcinek, ostatni go domyka.',
        '   Rozłóż akcję po całym odcinku, nie streszczaj wszystkiego w pierwszych trzech.',
        '2. Pole "opis" mówi WYŁĄCZNIE, CO WIDAĆ: plan, światło, kto jest w kadrze, co robi.',
        '   Żadnych dialogów w opisie, żadnych myśli bohatera, nic niewidocznego na obrazie.',
        '   Dialog wpisany w "opis" zostanie NARYSOWANY jako napis na ekranie.',
        '3. Powtarzaj krótko wygląd postaci — każdy kadr będzie generowany osobno.',
        '4. OBSADZAJ POSTACIE Z LISTY PONIŻEJ, po imieniu. Odcinek bez ludzi to',
        '   nie odcinek, tylko pokaz tekstur — w większości kadrów ktoś ma być widoczny.',
        '5. KWESTIE to OSOBNE pole "kwestie", nigdy część opisu. Każda ma "kto" (imię',
        '   Z OBSADY, dokładnie tak zapisane) i "tekst" (to, co pada na głos).',
        '6. WIĘKSZOŚĆ KADRÓW JEST NIEMA — daj "kwestie": []. Ujęcie trwa około',
        `   ${SEKUND_NA_KADR} s, więc mieści najwyżej jedno krótkie zdanie. Film, w którym`,
        '   każdy kadr ma dialog, to nie film, tylko słuchowisko z obrazkami.',
        '   Kwestia ma paść tam, gdzie coś wnosi — nie dla wypełnienia pola.',
        '',
        'Odpowiadasz WYŁĄCZNIE tablicą JSON, bez komentarza i bez płotu z backticków:',
        '[{"nr":1,"tytul":"krótki tytuł kadru","opis":"co widać","kwestie":[{"kto":"Imię","tekst":"co mówi"}]}, …]',
        'Kadr niemy: "kwestie": [].',
    ].join('\n');

    const czesci = [
        `PROJEKT: ${projekt}`,
        `ODCINEK #${odcinek.numer}: ${odcinek.tytul}`,
        odcinek.czasMinut ? `CZAS: ${odcinek.czasMinut} min` : 'CZAS: nie podano',
        odcinek.styl ? `STYL: ${odcinek.styl}` : '',
        `TREŚĆ: ${odcinek.streszczenie}`,
    ].filter(Boolean);
    // ⚠️ OBSADA OSOBNO OD KOTWICY. Suweren: „nie bardzo korzysta z przygotowanych
    // assetów". Sprawdzone na SOLLET: tylko 38 ze 164 kadrów wymieniało
    // jakąkolwiek postać, a Tim i Krys — ani razu. Model nie miał skąd wiedzieć,
    // że ta obsada istnieje.
    if (obsada.trim()) czesci.push(`\nOBSADA (używaj tych imion, nie wymyślaj innych):\n${obsada.trim().slice(0, 1200)}`);
    if (kotwica.trim()) czesci.push(`\nKOTWICA (nie wolno jej zaprzeczyć):\n${kotwica.trim().slice(0, 2000)}`);
    czesci.push(`\nRozpisz ${ile} kadrów. Sama tablica JSON.`);

    return { system, prompt: czesci.join('\n') };
}

/**
 * Wyłuskaj kadry z odpowiedzi modelu.
 * ⚠️ Ten sam problem co przy sekwencji: model lubi obudować JSON zdaniem
 * albo płotem, więc bierzemy pierwszy nawias kwadratowy i ostatni.
 */
export function odczytajKadry(surowe, ile) {
    const t = String(surowe || '');
    const start = t.indexOf('[');
    const koniec = t.lastIndexOf(']');
    if (start < 0 || koniec <= start) {
        throw new Error(`Model nie oddał tablicy JSON z kadrami. Dostałem: ${t.slice(0, 200)}`);
    }
    let dane;
    try { dane = JSON.parse(t.slice(start, koniec + 1)); } catch (e) {
        throw new Error(`Tablica kadrów jest niepoprawnym JSON-em: ${e.message}`);
    }
    if (!Array.isArray(dane) || !dane.length) throw new Error('Model oddał pustą listę kadrów.');

    return dane.slice(0, Math.min(ile, MAX_KADROW)).map((k, i) => ({
        nr: i + 1,
        tytul: String(k.tytul || k.tytuł || `Kadr ${i + 1}`).trim().slice(0, 90),
        opis: String(k.opis || k.tresc || k.treść || '').trim(),
        // ⚠️ Normalizację zostawiamy ProdukcjaService — jedno miejsce, jedna prawda
        // o tym, co jest poprawną kwestią. Tu tylko przepuszczamy dalej.
        kwestie: Array.isArray(k.kwestie) ? k.kwestie : [],
    })).filter((k) => k.opis.length > 3);
}

/**
 * Ile kadrów pokazujemy modelowi na jedno pytanie o kwestie.
 *
 * ⚠️ NIE WSZYSTKIE. SOLLET ma 218 kart — wrzucone naraz to promptem na
 * kilkadziesiąt tysięcy znaków, którego mały model nie utrzyma w głowie:
 * zaczyna gubić numery i przypisywać kwestie nie tym kadrom. Dwadzieścia
 * mieści się w oknie i wciąż daje modelowi kontekst sąsiednich ujęć.
 */
export const KADROW_NA_PYTANIE = 20;

/**
 * Prompt DOPISANIA kwestii do JUŻ ISTNIEJĄCYCH kadrów.
 *
 * PO CO OSOBNO OD `promptKadrow`. Suweren ma 218 kart rozpisanych, zanim
 * kwestie w ogóle istniały w modelu danych. Bez tego przejścia cała ścieżka
 * dialogowa działałaby wyłącznie dla odcinków napisanych OD NOWA — czyli
 * nie dałaby nic temu, co już jest.
 *
 * ⚠️ MODEL NIE TKNIE OPISÓW. Dostaje kadry tylko do przeczytania i oddaje
 * wyłącznie kwestie po numerach. Pozwolenie mu na poprawianie opisów przy
 * okazji oznaczałoby przepisanie stu kadrów, które już są policzone.
 */
export function promptKwestii({ kadry = [], obsada = '', kotwica = '' }) {
    const system = [
        'Jesteś DIALOGISTĄ. Dostajesz gotowe kadry filmu i dopisujesz do nich kwestie.',
        'Odpowiadasz po polsku, WYŁĄCZNIE tablicą JSON, bez komentarza i bez płotu z backticków.',
        '',
        'ŻELAZNE ZASADY:',
        '1. NIE zmieniasz opisów kadrów. Czytasz je i tyle.',
        `2. Ujęcie trwa około ${SEKUND_NA_KADR} s — mieści najwyżej JEDNO krótkie zdanie.`,
        '3. WIĘKSZOŚĆ UJĘĆ JEST NIEMA. Kadr bez kwestii po prostu pomijasz w odpowiedzi.',
        '   Film, w którym ktoś mówi w każdym ujęciu, to nie film, tylko słuchowisko.',
        '4. MÓWIĆ MOŻE TYLKO KTOŚ, KOGO WIDAĆ W OPISIE TEGO KADRU — albo narrator,',
        '   jeśli obsada go ma. Nie wkładaj słów w usta postaci, której w kadrze nie ma.',
        '5. Imię w polu "kto" zapisujesz DOKŁADNIE tak, jak stoi w obsadzie.',
        '6. Kwestia ma coś wnosić: pytanie, decyzję, zwrot. Żadnych "Hm...", "Tak...",',
        '   żadnego komentowania tego, co i tak widać na ekranie.',
        '',
        'Kształt odpowiedzi — TYLKO kadry, w których ktoś mówi:',
        '[{"nr":3,"kwestie":[{"kto":"Imię","tekst":"co mówi"}]}, …]',
        'Gdy w całej paczce nikt nie ma nic do powiedzenia: []',
    ].join('\n');

    const spis = kadry
        .map((k) => `${k.nr}. ${k.tytul}\n   ${String(k.opis || '').replace(/\s+/g, ' ').slice(0, 300)}`)
        .join('\n');

    const czesci = [];
    if (obsada.trim()) czesci.push(`OBSADA (tylko te imiona):\n${obsada.trim().slice(0, 1200)}`);
    if (kotwica.trim()) czesci.push(`\nKOTWICA (nie wolno jej zaprzeczyć):\n${kotwica.trim().slice(0, 1200)}`);
    czesci.push(`\nKADRY:\n${spis}`);
    czesci.push('\nDopisz kwestie. Sama tablica JSON, tylko dla kadrów, w których ktoś mówi.');

    return { system, prompt: czesci.join('\n') };
}

/**
 * Wyłuskaj kwestie z odpowiedzi modelu.
 *
 * ⚠️ PUSTA TABLICA JEST POPRAWNĄ ODPOWIEDZIĄ — w przeciwieństwie do kadrów,
 * gdzie pusto znaczy porażkę. Paczka samych ujęć niemych to normalny wynik.
 *
 * ⚠️ Numery spoza paczki ODRZUCAMY. Model potrafi wymyślić kadr 47, gdy
 * dostał numery 1-20 — wpisanie kwestii pod taki numer trafiłoby w losową kartę.
 */
export function odczytajKwestie(surowe, dozwoloneNumery = []) {
    const t = String(surowe || '');
    const start = t.indexOf('[');
    const koniec = t.lastIndexOf(']');
    if (start < 0 || koniec <= start) {
        throw new Error(`Model nie oddał tablicy JSON z kwestiami. Dostałem: ${t.slice(0, 200)}`);
    }
    let dane;
    try { dane = JSON.parse(t.slice(start, koniec + 1)); } catch (e) {
        throw new Error(`Tablica kwestii jest niepoprawnym JSON-em: ${e.message}`);
    }
    if (!Array.isArray(dane)) return [];

    const wolno = new Set(dozwoloneNumery.map(Number));
    return dane
        .map((w) => ({
            nr: Number(w?.nr ?? w?.numer),
            kwestie: Array.isArray(w?.kwestie) ? w.kwestie : [],
        }))
        .filter((w) => Number.isFinite(w.nr) && (!wolno.size || wolno.has(w.nr)) && w.kwestie.length);
}

/** Zdejmij z odpowiedzi to, czym model lubi obudować treść biblii. */
export function oczysc(tekst) {
    let t = String(tekst || '').trim();
    const plot = t.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
    if (plot) t = plot[1].trim();
    const linie = t.split('\n');
    if (linie.length > 1 && /^(oto|jasne|pewnie|świetnie|proszę)\b.*:\s*$/i.test(linie[0].trim())) {
        t = linie.slice(1).join('\n').trim();
    }
    return t;
}

export default {
    KADROW_NA_PYTANIE, promptKwestii, odczytajKwestie,
    SEKUND_NA_KADR, MAX_KADROW, ileKadrow, minutZKadrow,
    promptBiblii, promptKadrow, odczytajKadry, oczysc,
};
