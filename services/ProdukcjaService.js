/**
 * 🎬 ProdukcjaService — Kolejka Kreatywna Katedry (0.00G)
 *
 * DLACZEGO OSOBNY TOR, A NIE KOLEJKA MECHANIKA:
 * Mechanik generuje ŁATKI DO PLIKÓW ŹRÓDŁOWYCH. Wrzucenie mu zadania
 * „stwórz Style Sheet dla kreskówki" kończy się bezsensowną łatką — sprawdzone
 * na żywym organizmie 2026-08-03 (trzy śmieciowe patche do skasowania).
 * Praca produkcyjna ma inny cykl życia: nie „zastosuj/odrzuć", tylko
 * „wyślij → przynieś z powrotem → przepuść dalej".
 *
 * CZEGO TA KOLEJKA NIE ROBI — I MÓWI TO WPROST:
 * Gems, AI Studio, Flow i Vids to ZEWNĘTRZNE narzędzia Google w przeglądarce.
 * Most nie ma do nich API i nie będzie udawał, że ma. Tablica robi to, co da się
 * zrobić uczciwie: **buduje gotowy prompt**, **pamięta stan każdego kadru**
 * i **trzyma spójność** (Style Sheet wraca do każdego kolejnego promptu).
 * Rundę „skopiuj → wklej → przynieś plik" robi Suweren. Dopiero MONTAŻ wraca
 * na maszynę — tam ffmpeg Katedry jest realny.
 *
 * SPÓJNOŚĆ TO CAŁA WARTOŚĆ TEGO MODUŁU. Kreskówka rozjeżdża się nie dlatego,
 * że model źle rysuje, tylko dlatego, że w kadrze 14 nikt już nie pamięta,
 * jakiego koloru był płaszcz. Biblia projektu jest doklejana automatycznie.
 *
 * Wszystko lokalnie: `_OtakOs_Wymiar/produkcja_tablica.json`. Zero chmury.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const PLIK = 'produkcja_tablica.json';

/**
 * Etapy = workflow z planu Suwerena (Gems → AI Studio → Flow → Vids),
 * przełożony na role Rady Kreatywnej. Kolejność JEST znacząca:
 * `nastepny()` po niej chodzi, a prompt każdego etapu karmi się poprzednim.
 */
export const ETAPY = [
    {
        id: 'BIBLIA',
        rola: 'SCENARZYSTA',
        narzedzie: 'Gem — Specjalista ds. Spójności Historii',
        opis: 'Style Sheet, karty postaci, paleta, zasady świata. Fundament, do którego wracają wszystkie kolejne etapy.',
    },
    {
        id: 'KADR',
        rola: 'RYSOWNIK',
        narzedzie: 'AI Studio (obraz)',
        opis: 'Nieruchome klatki kluczowe. Prompt kotwiczony Biblią, żeby postać wyglądała tak samo w kadrze 1 i 40.',
    },
    {
        id: 'RUCH',
        rola: 'ANIMATOR',
        narzedzie: 'Flow (wideo z klatki)',
        opis: 'Ożywienie klatki kluczowej: ruch kamery, akcja, długość ujęcia.',
    },
    {
        id: 'MONTAZ',
        rola: 'MONTAŻYSTA',
        narzedzie: 'TeO Kadr (ffmpeg Katedry) / Vids',
        opis: 'Sklejenie ujęć, dźwięk, napisy. Jedyny etap, który dzieje się NA maszynie Suwerena.',
    },
    {
        id: 'GOTOWE',
        rola: '—',
        narzedzie: '—',
        opis: 'Domknięte. Zostaje w tablicy jako ślad, co i jak powstało.',
    },
];

const ID_ETAPOW = ETAPY.map(e => e.id);
const PRIORYTETY = ['NISKI', 'ZWYKLY', 'WYSOKI'];

function sciezka(katalog) { return path.join(katalog, PLIK); }

async function wczytaj(katalog) {
    try {
        const raw = await fs.readFile(sciezka(katalog), 'utf8');
        const d = JSON.parse(raw);
        return Array.isArray(d) ? d : (Array.isArray(d.kadry) ? d.kadry : []);
    } catch { return []; }
}

async function zapisz(katalog, kadry) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(sciezka(katalog), JSON.stringify(kadry, null, 2), 'utf8');
}

function nowyId() {
    return `kadr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Przycięcie NA GRANICY ZDANIA, nie w połowie słowa.
 * Lekcja z `nastrojPrasy`: ślepy `slice()` uciął streszczenie w pół myśli
 * i po miesiącu nie dało się go odczytać. Urwana biblia stylu jest gorsza
 * niż jej brak, bo model dopowie sobie resztę po swojemu.
 */
export function przytnijNaGranicy(tekst, limit) {
    const t = String(tekst || '').trim();
    if (t.length <= limit) return t;
    const kawalek = t.slice(0, limit);
    const granica = Math.max(
        kawalek.lastIndexOf('\n'),
        kawalek.lastIndexOf('. '),
        kawalek.lastIndexOf('; '),
    );
    const ciety = granica > limit * 0.5 ? kawalek.slice(0, granica + 1) : kawalek;
    return `${ciety.trim()}\n\n[…przycięte: biblia ma ${t.length} znaków, w prompcie mieści się ${ciety.trim().length}]`;
}

// ── Odczyt ────────────────────────────────────────────────────────────────────

/** Lista kadrów, najnowsze pierwsze. Opcjonalnie zawężona do projektu. */
export async function lista(katalog, projekt = '') {
    const kadry = await wczytaj(katalog);
    const p = String(projekt || '').trim().toLowerCase();
    return kadry
        .filter(k => !p || String(k.projekt || '').toLowerCase() === p)
        .sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
}

/** Nazwy projektów obecnych na tablicy (do przełącznika w UI). */
export async function projekty(katalog) {
    const kadry = await wczytaj(katalog);
    const mapa = new Map();
    for (const k of kadry) {
        const nazwa = k.projekt || 'bez nazwy';
        mapa.set(nazwa, (mapa.get(nazwa) || 0) + 1);
    }
    return [...mapa.entries()]
        .map(([nazwa, kadrow]) => ({ nazwa, kadrow }))
        .sort((a, b) => b.kadrow - a.kadrow);
}

/**
 * BIBLIA PROJEKTU — kotwica spójności.
 * Bierzemy TYLKO to, co realnie wróciło z Gema (pole `zwrot`), nie sam prompt.
 * Prompt to pytanie; biblią jest odpowiedź. Gdy nic nie wróciło — mówimy to
 * wprost, zamiast po cichu generować kadry bez kotwicy.
 */
export async function biblia(katalog, projekt) {
    const kadry = await lista(katalog, projekt);
    const zrodla = kadry
        .filter(k => k.etap !== 'BIBLIA' ? false : true)
        .filter(k => String(k.zwrot || '').trim().length > 0)
        // Chronologicznie: pierwsze ustalenia są nadrzędne wobec późniejszych dopisków.
        .sort((a, b) => String(a.utworzono).localeCompare(String(b.utworzono)));

    // Domknięte karty biblii też są kotwicą — etap GOTOWE nie kasuje ustaleń.
    const domkniete = kadry
        .filter(k => k.etapZrodlowy === 'BIBLIA' && k.etap === 'GOTOWE')
        .filter(k => String(k.zwrot || '').trim().length > 0)
        .sort((a, b) => String(a.utworzono).localeCompare(String(b.utworzono)));

    const wszystkie = [...zrodla, ...domkniete];
    const tekst = wszystkie.map(k => `### ${k.tytul}\n${String(k.zwrot).trim()}`).join('\n\n');

    return {
        projekt,
        kart: wszystkie.length,
        tekst,
        pusta: wszystkie.length === 0,
        // Uczciwie: bez tego zdania UI mogłoby sugerować, że spójność jest pilnowana.
        uwaga: wszystkie.length === 0
            ? 'Biblia jest pusta — kadry pójdą BEZ kotwicy stylu i rozjadą się po kilku ujęciach. ' +
              'Najpierw domknij kartę etapu BIBLIA (wklej odpowiedź Gema w pole „co wróciło").'
            : null,
    };
}

// ── Zapis ─────────────────────────────────────────────────────────────────────

/** Dodaj kadr. `tytul` wymagany — karta bez tytułu jest nieczytelna na tablicy. */
export async function dodaj(katalog, dane = {}) {
    const tytul = String(dane.tytul || '').trim();
    if (tytul.length < 3) throw new Error('Pole "tytul" jest wymagane (min. 3 znaki).');

    const etap = String(dane.etap || 'BIBLIA').toUpperCase();
    if (!ID_ETAPOW.includes(etap)) {
        throw new Error(`Nieznany etap "${dane.etap}". Dozwolone: ${ID_ETAPOW.join(', ')}.`);
    }
    const priorytet = String(dane.priorytet || 'ZWYKLY').toUpperCase();

    const kadr = {
        id: nowyId(),
        utworzono: new Date().toISOString(),
        zmieniono: new Date().toISOString(),
        projekt: String(dane.projekt || '').trim() || 'bez nazwy',
        tytul,
        opis: String(dane.opis || '').trim(),
        etap,
        // Zapamiętane, bo po przejściu na GOTOWE „etap" przestaje mówić, czym karta była.
        etapZrodlowy: etap,
        priorytet: PRIORYTETY.includes(priorytet) ? priorytet : 'ZWYKLY',
        // Co wróciło z zewnętrznego narzędzia: tekst od Gema, ścieżka pliku, URL.
        zwrot: String(dane.zwrot || '').trim(),
        notatki: String(dane.notatki || '').trim(),
        // Skąd się wzięła karta — 'reka' albo 'rada' (dekompozycja Rady Kreatywnej).
        zrodlo: dane.zrodlo === 'rada' ? 'rada' : 'reka',
        sesjaRady: String(dane.sesjaRady || '').trim() || null,
        historia: [{ kiedy: new Date().toISOString(), co: `utworzono na etapie ${etap}` }],
    };

    const kadry = await wczytaj(katalog);
    kadry.push(kadr);
    await zapisz(katalog, kadry);
    return kadr;
}

/** Zmiana kadru. Ruch między etapami dopisuje się do historii. */
export async function zmien(katalog, id, zmiany = {}) {
    const kadry = await wczytaj(katalog);
    const i = kadry.findIndex(k => k.id === id);
    if (i < 0) throw new Error(`Kadr "${id}" nie istnieje.`);
    const kadr = kadry[i];

    if (zmiany.etap !== undefined) {
        const nowy = String(zmiany.etap).toUpperCase();
        if (!ID_ETAPOW.includes(nowy)) {
            throw new Error(`Nieznany etap "${zmiany.etap}". Dozwolone: ${ID_ETAPOW.join(', ')}.`);
        }
        if (nowy !== kadr.etap) {
            kadr.historia.push({ kiedy: new Date().toISOString(), co: `${kadr.etap} → ${nowy}` });
            kadr.etap = nowy;
        }
    }
    for (const pole of ['tytul', 'opis', 'zwrot', 'notatki', 'projekt']) {
        if (zmiany[pole] !== undefined) kadr[pole] = String(zmiany[pole]).trim();
    }
    if (zmiany.priorytet !== undefined) {
        const p = String(zmiany.priorytet).toUpperCase();
        if (PRIORYTETY.includes(p)) kadr.priorytet = p;
    }
    kadr.zmieniono = new Date().toISOString();

    kadry[i] = kadr;
    await zapisz(katalog, kadry);
    return kadr;
}

/** Usuń kadr. Zwraca usuniętą kartę, żeby UI mogło pokazać, co zniknęło. */
export async function usun(katalog, id) {
    const kadry = await wczytaj(katalog);
    const i = kadry.findIndex(k => k.id === id);
    if (i < 0) throw new Error(`Kadr "${id}" nie istnieje.`);
    const [usuniety] = kadry.splice(i, 1);
    await zapisz(katalog, kadry);
    return usuniety;
}

/** Następny etap w kolejności (null, gdy karta jest już GOTOWE). */
export function nastepny(etap) {
    const i = ID_ETAPOW.indexOf(String(etap).toUpperCase());
    return i >= 0 && i < ID_ETAPOW.length - 1 ? ID_ETAPOW[i + 1] : null;
}

// ── Prompty ───────────────────────────────────────────────────────────────────

const LIMIT_BIBLII = 2400;   // znaków biblii doklejanych do promptu

/**
 * Gotowy do wklejenia prompt dla etapu, na którym stoi kadr.
 * Zwraca też `narzedzie` i `ostrzezenie` — UI ma powiedzieć, DOKĄD to wkleić
 * i czy kotwica spójności w ogóle istnieje.
 */
export function zbudujPrompt(kadr, bibliaProjektu = null) {
    const etap = ETAPY.find(e => e.id === kadr.etap) || ETAPY[0];
    const kotwica = bibliaProjektu && !bibliaProjektu.pusta
        ? przytnijNaGranicy(bibliaProjektu.tekst, LIMIT_BIBLII)
        : '';

    const naglowekKotwicy = kotwica
        ? `BIBLIA PROJEKTU „${kadr.projekt}" — TRZYMAJ SIĘ JEJ CO DO SZCZEGÓŁU:\n${kotwica}\n\n---\n\n`
        : '';

    let tresc;
    switch (kadr.etap) {
        case 'BIBLIA':
            tresc =
                'Jesteś Specjalistą ds. Spójności Historii. Tworzysz fundament kreskówki, ' +
                'do którego będą wracać wszystkie kolejne generacje obrazu i ruchu.\n\n' +
                `PROJEKT: ${kadr.projekt}\n` +
                `ZADANIE: ${kadr.tytul}\n` +
                (kadr.opis ? `SZCZEGÓŁY: ${kadr.opis}\n` : '') +
                '\nOdpowiedz w tej strukturze, zwięźle i KONKRETNIE (kolory podaj kodem HEX, ' +
                'proporcje liczbami — opis „ciepła paleta" jest bezużyteczny w kadrze 40):\n' +
                '1. STYL WIZUALNY — technika, kreska, oświetlenie, paleta (HEX).\n' +
                '2. POSTACIE — dla każdej: sylwetka, strój, 3 cechy nie do pomylenia.\n' +
                '3. ŚWIAT — miejsce, pora, zasady, których nie wolno złamać.\n' +
                '4. KADROWANIE — typowe plany, ruch kamery, rytm.\n' +
                '5. CZEGO NIGDY — lista rzeczy zakazanych w tym projekcie.';
            break;

        case 'KADR':
            tresc =
                naglowekKotwicy +
                'Wygeneruj NIERUCHOMĄ klatkę kluczową zgodną z powyższą biblią.\n\n' +
                `UJĘCIE: ${kadr.tytul}\n` +
                (kadr.opis ? `OPIS: ${kadr.opis}\n` : '') +
                '\nZachowaj sylwetki, stroje i paletę dokładnie tak, jak opisuje biblia. ' +
                'Jeśli biblia czegoś nie określa — wybierz wariant najprostszy i wypisz go pod obrazem, ' +
                'żeby dało się go dopisać do biblii.';
            break;

        case 'RUCH':
            tresc =
                naglowekKotwicy +
                'Ożyw klatkę kluczową (wgraj ją jako obraz startowy).\n\n' +
                `UJĘCIE: ${kadr.tytul}\n` +
                (kadr.opis ? `AKCJA: ${kadr.opis}\n` : '') +
                (kadr.zwrot ? `KLATKA STARTOWA: ${kadr.zwrot}\n` : '') +
                '\nOkreśl: ruch kamery, ruch postaci, długość ujęcia. ' +
                'Postać ma pozostać tą samą postacią — bez zmiany stroju, koloru i proporcji.';
            break;

        case 'MONTAZ':
            tresc =
                `MONTAŻ — ten etap dzieje się NA maszynie, nie w przeglądarce.\n\n` +
                `UJĘCIE: ${kadr.tytul}\n` +
                (kadr.opis ? `OPIS: ${kadr.opis}\n` : '') +
                (kadr.zwrot ? `MATERIAŁ: ${kadr.zwrot}\n` : '') +
                '\nWrzuć klipy do `_OtakOs_Move` i otwórz TeO Kadr (zakładka SPAWACZ albo TELEDYSK). ' +
                'ffmpeg Katedry sklei je lokalnie — bez chmury.';
            break;

        default:
            tresc = `Karta domknięta. Co powstało: ${kadr.zwrot || '(nie zapisano)'}`;
    }

    return {
        etap: etap.id,
        rola: etap.rola,
        narzedzie: etap.narzedzie,
        prompt: tresc,
        kotwicaZnakow: kotwica.length,
        // To zdanie ratuje przed cichym rozjazdem stylu w połowie odcinka.
        ostrzezenie: (kadr.etap === 'KADR' || kadr.etap === 'RUCH') && !kotwica
            ? 'Prompt idzie BEZ biblii projektu — spójność nie jest pilnowana. Domknij najpierw kartę BIBLIA.'
            : null,
    };
}

/**
 * System prompt Rady Kreatywnej. Świadomie INNY niż Rada od kodu:
 * tamta przydziela MECHANIKA i TOST-a, ta przydziela etapy produkcji.
 * Wspólna jest tylko dyscyplina formatu — czysty JSON, bez markdownu.
 */
export function promptSystemowyRozkladu() {
    return (
        'Jesteś RADĄ KREATYWNĄ Katedry OtakOS — stołem produkcyjnym kreskówki. ' +
        'Rozłóż zlecenie na 3-6 konkretnych kart produkcyjnych i przydziel każdej ETAP. ' +
        'Etapy: BIBLIA (fundament stylu i postaci — zawsze zaczynaj od niej, jeśli projekt jest nowy), ' +
        'KADR (nieruchoma klatka kluczowa), RUCH (ożywienie klatki), MONTAZ (sklejenie na maszynie). ' +
        'Karta ma być wykonalna w jednym podejściu — „zrób kreskówkę" to nie karta, ' +
        '„karta postaci baristy: sylwetka, strój, paleta" to karta. ' +
        'Odpowiedz WYŁĄCZNIE w formacie JSON, bez markdown, bez wyjaśnień: ' +
        '{"kadry":[{"tytul":"...","opis":"...","etap":"BIBLIA|KADR|RUCH|MONTAZ","priorytet":"WYSOKI|ZWYKLY|NISKI"}]}'
    );
}

/** Wyłuskaj karty z odpowiedzi modelu. Rzuca, gdy nie da się nic odczytać. */
export function odczytajRozklad(odpowiedzModelu) {
    const surowe = String(odpowiedzModelu || '');
    const dopasowanie = surowe.match(/\{[\s\S]*\}/);
    if (!dopasowanie) throw new Error('Model nie zwrócił JSON-a.');

    const sparsowane = JSON.parse(dopasowanie[0]);
    const lista = Array.isArray(sparsowane.kadry) ? sparsowane.kadry : [];
    if (!lista.length) throw new Error('Model zwrócił JSON bez kart („kadry" puste).');

    return lista.map(k => ({
        tytul: String(k.tytul || '').trim(),
        opis: String(k.opis || '').trim(),
        etap: ID_ETAPOW.includes(String(k.etap || '').toUpperCase())
            ? String(k.etap).toUpperCase()
            : 'BIBLIA',
        priorytet: PRIORYTETY.includes(String(k.priorytet || '').toUpperCase())
            ? String(k.priorytet).toUpperCase()
            : 'ZWYKLY',
    }));
}

/** Rozkład tablicy po etapach — surowe liczby, zero interpretacji. */
export async function statystyka(katalog, projekt = '') {
    const kadry = await lista(katalog, projekt);
    const wgEtapow = ETAPY.map(e => ({
        etap: e.id,
        rola: e.rola,
        narzedzie: e.narzedzie,
        kart: kadry.filter(k => k.etap === e.id).length,
    }));
    return {
        wszystkich: kadry.length,
        wgEtapow,
        zRady: kadry.filter(k => k.zrodlo === 'rada').length,
        czekaNaZwrot: kadry.filter(k => k.etap !== 'GOTOWE' && !String(k.zwrot || '').trim()).length,
    };
}

export default {
    ETAPY, lista, projekty, biblia, dodaj, zmien, usun, nastepny,
    zbudujPrompt, promptSystemowyRozkladu, odczytajRozklad, statystyka, przytnijNaGranicy,
};
