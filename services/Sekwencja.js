/**
 * 🎬 Sekwencja — cała SCENA z jednego opisu, ujęcie po ujęciu, aż do klapsa.
 *
 * PO CO. Suweren: „jak zrobić, by wytwarzał sceny po opisie co dalej, aż do
 * klapsa — jak kamera poszła do przodu, po czym ukazała twarz postaci".
 * Jedno ujęcie Wana to ~2 sekundy. Scena to kilka ujęć, z których każde
 * zaczyna się tam, gdzie skończyło się poprzednie.
 *
 * ŁAŃCUCH:
 *   opis sceny → model rozpisuje UJĘCIA → ujęcie 1 → jego ostatnia klatka →
 *   ujęcie 2 → … → ujęcie N → ffmpeg skleja wszystko w jeden plik = SCENA.
 *
 * ⚠️ DRYF JEST PRAWDZIWY I NIE UDAJEMY, ŻE GO NIE MA. Każde ujęcie startuje
 * z klatki, która sama jest już wynikiem modelu. Po czwartym-piątym ogniwie
 * kolory i szczegóły twarzy potrafią odjechać od oryginału — to cecha metody,
 * nie usterka. Dlatego: (a) sekwencja ma twardy sufit ogniw, (b) stan zadania
 * niesie numer ogniwa, żeby było widać, jak daleko od źródła jesteśmy,
 * (c) prompt każdego ujęcia POWTARZA opis postaci z kotwicy — model dostaje
 * szansę wrócić do właściwego wyglądu zamiast pogłębiać dryf.
 *
 * ⚠️ TO NIE JEST HTTP-SYNCHRONICZNE. Jedno ujęcie liczy się minutami, scena
 * z pięciu ujęć — kwadransami. Zadanie żyje w pamięci mostu, przeglądarka
 * odpytuje o stan. Restart mostu kasuje zadania w toku i mówimy to wprost,
 * zamiast trzymać widmo zadania, którego nikt już nie liczy.
 */

import path from 'path';

/** Sufit ogniw. Powyżej dryf zjada scenę, a czekanie robi się absurdalne. */
export const MAX_UJEC = 8;

/** Ile zadań trzymamy w pamięci, żeby historia nie rosła bez końca. */
const MAX_ZADAN = 20;

const zadania = new Map();

// ══════════════════════════════════════════════════════════════════════════════
//  ROZPISANIE SCENY NA UJĘCIA
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Prompt dla modelu. Wymuszamy JSON i JEDNĄ myśl na ujęcie — „kamera jedzie
 * do przodu, po czym pokazuje twarz" to DWA ujęcia, nie jedno zdanie.
 */
export function promptRozpisania({ opis, kotwica = '', ile = 4, sekundNaUjecie = 2 }) {
    const system = [
        'Jesteś OPERATOREM KAMERY rozpisującym scenę na ujęcia. Odpowiadasz po polsku.',
        `Scena ma mieć ${ile} ujęć po około ${sekundNaUjecie} sekundy.`,
        '',
        'ŻELAZNE ZASADY:',
        '1. JEDNO ujęcie = JEDNA myśl kamery. „Kamera jedzie do przodu, po czym pokazuje twarz"',
        '   to DWA ujęcia: najazd, potem zbliżenie na twarz.',
        '2. Każde ujęcie zaczyna się DOKŁADNIE tam, gdzie skończyło się poprzednie —',
        '   bez cięć, bez przeskoków w czasie, bez zmiany miejsca.',
        '3. W każdym ujęciu POWTÓRZ krótko wygląd postaci i światło. Model liczy każde',
        '   ujęcie osobno i nie pamięta poprzedniego opisu.',
        '4. Opisuj RUCH i to, co widać. Bez fabuły, bez dialogów, bez nazw ujęć filmowych',
        '   w rodzaju „ujęcie mistrzowskie".',
        '',
        'Odpowiadasz WYŁĄCZNIE tablicą JSON, bez komentarza i bez płotu z backticków:',
        '[{"nr":1,"kamera":"powolny najazd","opis":"…"}, …]',
    ].join('\n');

    const czesci = [`SCENA: ${opis}`];
    if (kotwica.trim()) czesci.push(`\nKOTWICA (wygląd i świat, nie wolno zaprzeczyć):\n${kotwica.trim().slice(0, 1500)}`);
    czesci.push(`\nRozpisz ${ile} ujęć. Sama tablica JSON.`);

    return { system, prompt: czesci.join('\n') };
}

/**
 * Wyłuskaj tablicę ujęć z odpowiedzi modelu.
 * ⚠️ Modele lubią obudować JSON zdaniem albo płotem — bierzemy pierwszy
 * nawias kwadratowy i ostatni, zamiast wierzyć w czystą odpowiedź.
 */
export function odczytajUjecia(surowe, ile = MAX_UJEC) {
    const t = String(surowe || '');
    const start = t.indexOf('[');
    const koniec = t.lastIndexOf(']');
    if (start < 0 || koniec <= start) {
        throw new Error(`Model nie oddał tablicy JSON. Dostałem: ${t.slice(0, 200)}`);
    }
    let dane;
    try { dane = JSON.parse(t.slice(start, koniec + 1)); } catch (e) {
        throw new Error(`Tablica ujęć jest niepoprawnym JSON-em: ${e.message}`);
    }
    if (!Array.isArray(dane) || !dane.length) throw new Error('Model oddał pustą listę ujęć.');

    return dane.slice(0, Math.min(ile, MAX_UJEC)).map((u, i) => ({
        nr: i + 1,
        kamera: String(u.kamera || '').trim(),
        opis: String(u.opis || u.tresc || u.ujecie || '').trim(),
    })).filter((u) => u.opis.length > 3);
}

/** Prompt jednego ujęcia = ruch kamery + treść + kotwica. */
export function promptUjecia(ujecie, kotwica = '') {
    const czesci = [];
    if (ujecie.kamera) czesci.push(ujecie.kamera);
    czesci.push(ujecie.opis);
    // Kotwica doklejana do KAŻDEGO ujęcia — patrz uwaga o dryfie na górze pliku.
    if (kotwica.trim()) czesci.push(kotwica.trim().slice(0, 400));
    return czesci.join(', ');
}

// ══════════════════════════════════════════════════════════════════════════════
//  WIELE KAMER — pokrycie TEGO SAMEGO momentu z innych perspektyw
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gotowe ruchy kamery. To nie ozdoba: w trybie kamer RUCH jest jedynym
 * narzędziem, którym da się odejść od kadru głównego — patrz uwaga niżej.
 */
export const RUCHY_KAMERY = [
    { id: 'obrot', nazwa: 'Obrót wokół postaci', opis: 'kamera obraca się wokół postaci, orbituje w prawo, płynny ruch' },
    { id: 'przeciw', nazwa: 'Przeciwujęcie', opis: 'kamera przechodzi na drugą stronę, pokazuje scenę z przeciwnej strony' },
    { id: 'zblizenie', nazwa: 'Zbliżenie na detal', opis: 'kamera zbliża się do detalu, bliski plan, płytka głębia ostrości' },
    { id: 'odjazd', nazwa: 'Odjazd na szeroki plan', opis: 'kamera odjeżdża do tyłu, odsłania szeroki plan i otoczenie' },
    { id: 'zgory', nazwa: 'Z góry', opis: 'kamera unosi się nad scenę, ujęcie z góry, widok z lotu ptaka' },
    { id: 'zdolu', nazwa: 'Z dołu', opis: 'kamera opada nisko, ujęcie z dołu, bohater góruje nad kadrem' },
    { id: 'bok', nazwa: 'Przejazd bokiem', opis: 'kamera przesuwa się bokiem, trawelling równoległy do postaci' },
];

/**
 * Prompt dla dodatkowej kamery.
 *
 * ⚠️ UCZCIWIE O OGRANICZENIU. Model dostaje KLATKĘ z materiału głównego, więc
 * pierwsze klatki nowego ujęcia mają kadr taki jak oryginał — to nie jest druga
 * kamera stojąca obok, tylko ten sam moment, od którego kamera RUSZA w inną
 * stronę. Nowa perspektywa rodzi się z ruchu, dlatego ruch idzie na POCZĄTEK
 * promptu i dlatego warto wybierać ruchy zdecydowane (obrót, przeciwujęcie),
 * a nie subtelne — przy subtelnych oba ujęcia wyjdą prawie identyczne.
 */
export function promptKamery({ ruch = '', opis = '', kotwica = '' }) {
    const r = String(ruch).trim();
    const czesci = [];
    if (r) czesci.push(r);
    if (String(opis).trim()) czesci.push(String(opis).trim());
    if (kotwica.trim()) czesci.push(kotwica.trim().slice(0, 400));
    if (!czesci.length) throw new Error('Kamera bez ruchu i bez opisu — nie ma czego kręcić.');
    return czesci.join(', ');
}

// ══════════════════════════════════════════════════════════════════════════════
//  ZADANIE — łańcuch ujęć liczony w tle
// ══════════════════════════════════════════════════════════════════════════════

function sprzatnij() {
    if (zadania.size <= MAX_ZADAN) return;
    const posortowane = [...zadania.entries()].sort((a, b) => a[1].start - b[1].start);
    for (const [id] of posortowane.slice(0, zadania.size - MAX_ZADAN)) zadania.delete(id);
}

export function stanZadania(id) {
    const z = zadania.get(id);
    if (!z) return null;
    return {
        id: z.id,
        stan: z.stan,
        tryb: z.tryb,
        opisSceny: z.opisSceny,
        ujecia: z.ujecia.map((u) => ({
            nr: u.nr, prompt: u.prompt, stan: u.stan, plik: u.plik, sekundy: u.sekundy,
            nazwa: u.nazwa ?? null, odSekundy: u.odSekundy ?? null,
        })),
        biezace: z.biezace,
        ile: z.ujecia.length,
        plik: z.plik,
        sklejka: z.sklejka,
        blad: z.blad,
        sekundOd: Math.round((Date.now() - z.start) / 1000),
    };
}

export function listaZadan() {
    return [...zadania.values()]
        .sort((a, b) => b.start - a.start)
        .map((z) => ({ id: z.id, stan: z.stan, opisSceny: z.opisSceny, ile: z.ujecia.length, plik: z.plik }));
}

export function przerwij(id) {
    const z = zadania.get(id);
    if (!z) throw new Error(`Nie znam zadania „${id}".`);
    if (z.stan !== 'liczy') return stanZadania(id);
    z.przerwane = true;
    z.stan = 'przerwane';
    return stanZadania(id);
}

/**
 * Odpal łańcuch. Zwraca id NATYCHMIAST — praca leci w tle.
 *
 * Zależności wstrzykujemy, zamiast importować: dzięki temu ten plik nie wie
 * nic o ComfyUI ani o ffmpegu i da się go sprawdzić na sucho.
 *
 * @param {object} p
 * @param {{nr:number,prompt:string}[]} p.ujecia   gotowe prompty ujęć
 * @param {string|null} p.filmStartowy  film, od którego zaczynamy (null = od tekstu)
 * @param {boolean} p.dolaczZrodlo      czy włożony film ma wejść do sklejki
 * @param {function} p.generujZTekstu   ({prompt}) => {ok, zlecenie, powod}
 * @param {function} p.dopiszDoFilmu    ({plik, prompt}) => {ok, zlecenie, powod}
 * @param {function} p.czekajNaPlik     (zlecenie) => sciezka pliku
 * @param {function} p.sklej            (pliki, nazwa) => {plik, metoda, wynik}
 */
export function odpal(p) {
    const id = `sek-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const tryb = p.tryb === 'kamery' ? 'kamery' : 'lancuch';
    const z = {
        id,
        start: Date.now(),
        stan: 'liczy',
        tryb,
        // Łańcuch skleja domyślnie (to jedna scena), kamery domyślnie nie.
        sklejaj: p.sklejaj ?? (tryb !== 'kamery'),
        opisSceny: p.opisSceny || '',
        ujecia: p.ujecia.map((u) => ({ ...u, stan: 'czeka', plik: null, sekundy: null })),
        biezace: 0,
        plik: null,
        sklejka: null,
        blad: null,
        przerwane: false,
    };
    zadania.set(id, z);
    sprzatnij();

    (async () => {
        try {
            let poprzedni = p.filmStartowy || null;

            for (const u of z.ujecia) {
                if (z.przerwane) return;
                z.biezace = u.nr;
                u.stan = 'liczy';
                const start = Date.now();

                // ⚠️ TU SIĘ ROZCHODZĄ DWA TRYBY.
                //   łańcuch — każde ujęcie startuje z POPRZEDNIEGO (scena płynie dalej),
                //   kamery  — każde ujęcie startuje z TEGO SAMEGO materiału głównego,
                //             tylko z innej sekundy i z innym ruchem kamery.
                const zrodlo = z.tryb === 'kamery' ? p.filmStartowy : poprzedni;

                const r = zrodlo
                    ? await p.dopiszDoFilmu({ plik: zrodlo, prompt: u.prompt, odSekundy: u.odSekundy })
                    : await p.generujZTekstu({ prompt: u.prompt });
                if (!r.ok) throw new Error(`Ujęcie ${u.nr}: ${r.powod}`);

                const plik = await p.czekajNaPlik(r.zlecenie, () => z.przerwane);
                if (z.przerwane) return;
                if (!plik) throw new Error(`Ujęcie ${u.nr}: silnik nie oddał pliku.`);

                u.plik = plik;
                u.stan = 'gotowe';
                u.sekundy = Math.round((Date.now() - start) / 1000);
                // Ogniwo przesuwamy TYLKO w łańcuchu. W trybie kamer każde ujęcie
                // ma wracać do materiału głównego, inaczej druga kamera kręciłaby
                // ciąg dalszy pierwszej zamiast tego samego momentu.
                if (z.tryb !== 'kamery') poprzedni = plik;
            }

            if (z.przerwane) return;

            // KLAPS — koniec sceny. Sklejamy ujęcia w jeden plik.
            // ⚠️ W trybie kamer sklejka jest OPCJĄ, nie regułą: ujęcia z różnych
            // kamer to POKRYCIE tego samego momentu, a nie następujące po sobie
            // sceny. Sklejone jedno po drugim dają podgląd wariantów, nie film.
            const doSklejki = z.ujecia.map((u) => u.plik).filter(Boolean);
            if (p.dolaczZrodlo && p.filmStartowy) doSklejki.unshift(p.filmStartowy);

            if (!z.sklejaj) {
                z.plik = null;
                z.sklejka = { metoda: 'bez sklejania — każda kamera osobnym plikiem' };
            } else if (doSklejki.length < 2) {
                // Jedno ujęcie to nie sklejka — oddajemy je jako scenę i mówimy to.
                z.plik = doSklejki[0] ?? null;
                z.sklejka = { metoda: 'jedno ujęcie — nie było czego sklejać' };
            } else {
                const w = await p.sklej(doSklejki, `scena_${id}`);
                z.plik = w.plik;
                z.sklejka = { metoda: w.metoda, sekundy: w.wynik?.sekundy, bajtow: w.wynik?.bajtow };
            }
            z.stan = 'gotowe';
        } catch (e) {
            z.stan = 'blad';
            z.blad = e.message;
            const biezace = z.ujecia.find((u) => u.stan === 'liczy');
            if (biezace) biezace.stan = 'blad';
        }
    })();

    return id;
}

/** Nazwa pliku sceny — do pokazania w UI bez całej ścieżki. */
export const nazwaPliku = (p) => (p ? path.basename(p) : null);

export default {
    MAX_UJEC, RUCHY_KAMERY, promptRozpisania, odczytajUjecia, promptUjecia, promptKamery,
    odpal, stanZadania, listaZadan, przerwij, nazwaPliku,
};
