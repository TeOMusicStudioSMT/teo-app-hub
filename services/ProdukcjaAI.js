/**
 * ✨ ProdukcjaAI — wypełnianie pól Tablicy Produkcji przez model.
 *
 * ⚠️ CO NAPRAWIA. Wszystkie pięć kolumn tablicy miało jedną akcję: „+ dodaj
 * kadr tutaj". Kolumna BIBLIA i kolumna MONTAŻ dostawały ten sam pusty
 * formularz, choć to dwie zupełnie różne prace. Suweren pisał wszystko z ręki,
 * a model — który zna kanon serialu i biblię projektu — stał obok bezczynnie.
 *
 * Każdy etap ma tu SWOJĄ instrukcję. Prompt do generatora obrazu (KADR) i lista
 * montażowa (MONTAŻ) nie mają ze sobą nic wspólnego poza tym, że dotyczą tego
 * samego ujęcia; jedna instrukcja „napisz coś o kadrze" dawałaby oba na raz
 * i żadne porządnie.
 *
 * ⚠️ MODEL PROPONUJE, SUWEREN ZATWIERDZA. Trasa oddaje TEKST, nie zapisuje
 * karty. Automatyczny zapis odpowiedzi modelu do tablicy oznaczałby, że po
 * kilku kliknięciach nie wiadomo już, co napisał człowiek, a co maszyna.
 *
 * ⚠️ KOTWICA SPÓJNOŚCI. Do każdego promptu dokleja się biblia projektu i fakty
 * kanoniczne Reżysera. Kreskówka rozjeżdża się nie dlatego, że model źle pisze,
 * tylko dlatego, że w kadrze 14 nikt nie pamięta, jakiego koloru był płaszcz.
 */

import { przytnijNaGranicy } from './ProdukcjaService.js';

/** Pola, które model ma prawo tknąć. */
export const POLA = ['tytul', 'opis', 'notatki'];

/**
 * ⚠️ `zwrot` ŚWIADOMIE POZA LISTĄ. To pole trzyma to, co WRÓCIŁO z narzędzia:
 * ścieżkę pliku, tekst od Gema, adres ujęcia. Wypełnienie go przez model
 * zrobiłoby z tablicy ściemę — karta meldowałaby materiał, którego nie ma.
 */
export const POLA_ZAKAZANE = ['zwrot'];

/** Ile znaków biblii i kanonu wpuszczamy do promptu. Reszta i tak by wypadła. */
const BUDZET_BIBLII = 2500;
const BUDZET_KANONU = 2000;

const ROLE_ETAPOW = {
    BIBLIA: {
        rola: 'SCENARZYSTĄ i strażnikiem spójności świata',
        zadanie: [
            'Piszesz BIBLIĘ PROJEKTU — fundament, do którego wracają wszystkie kolejne etapy.',
            'Konkrety: paleta barw, karty postaci (wygląd, strój, sylwetka), zasady świata, pora dnia, styl kreski.',
            'NIE opowiadasz fabuły. Biblia mówi, JAK świat wygląda, a nie CO się w nim dzieje.',
        ],
    },
    KADR: {
        rola: 'RYSOWNIKIEM piszącym prompt do generatora obrazu',
        zadanie: [
            'Opisujesz JEDNĄ nieruchomą klatkę kluczową.',
            'Konkrety: plan (szeroki/średni/bliski), kąt kamery, obiektyw, światło, kolor, kto i co jest w kadrze, tło.',
            'NIE opisujesz ruchu ani upływu czasu — to nieruchomy obraz. Ruch jest osobnym etapem.',
        ],
    },
    RUCH: {
        rola: 'ANIMATOREM ożywiającym gotową klatkę',
        zadanie: [
            'Opisujesz, co dzieje się przez kilka sekund, startując od klatki, która JUŻ istnieje.',
            'Konkrety: ruch kamery (najazd, odjazd, panorama), akcja postaci, tempo, długość ujęcia w sekundach.',
            'NIE opisujesz od nowa wyglądu postaci — ten jest ustalony w kadrze i w biblii.',
        ],
    },
    MONTAZ: {
        rola: 'MONTAŻYSTĄ składającym ujęcia w całość',
        zadanie: [
            'Piszesz LISTĘ MONTAŻOWĄ: kolejność ujęć, rodzaj cięcia, dźwięk, napisy.',
            'Konkrety: numer ujęcia, czas trwania, przejście, co gra w tle, gdzie pada napis.',
            'To jedyny etap, który dzieje się NA maszynie Suwerena (ffmpeg Katedry) — pisz tak, żeby dało się to wykonać.',
        ],
    },
    GOTOWE: {
        rola: 'ARCHIWISTĄ domykającym ujęcie',
        zadanie: [
            'Mówisz, GDZIE materiał ma trafić i pod jaką nazwą.',
            'Konkrety: katalog odcinka, nazwa pliku, format, komu to idzie dalej (kanał, klient, archiwum).',
            'Nie wymyślasz ścieżek z powietrza — jeśli katalog jest podany w kontekście, używasz jego.',
        ],
    },
};

const OPIS_POLA = {
    tytul: 'KRÓTKI TYTUŁ karty — maksymalnie 8 słów, bez kropki na końcu. Sama nazwa, nic więcej.',
    opis: 'TREŚĆ PRACY dla tego etapu — 3 do 8 zdań albo lista punktów. To ma być gotowe do użycia.',
    notatki: 'NOTATKA ROBOCZA — na co uważać, co może się rozjechać, czego pilnować przy tym ujęciu. 2-4 zdania.',
};

/**
 * Zbuduj parę (system, prompt). Wołający dowozi to do Ollamy — ta funkcja
 * niczego nie liczy i nie sięga do sieci, więc da się ją sprawdzić na sucho.
 */
export function promptUzupelnienia({
    etap = 'BIBLIA', pole = 'opis', projekt = '', biblia = '', fakty = [], kadr = null, wskazowka = '',
} = {}) {
    const E = String(etap).toUpperCase();
    const rola = ROLE_ETAPOW[E];
    if (!rola) throw new Error(`Nieznany etap „${etap}". Dozwolone: ${Object.keys(ROLE_ETAPOW).join(', ')}.`);
    if (!POLA.includes(pole)) {
        throw new Error(
            POLA_ZAKAZANE.includes(pole)
                ? `Pole „${pole}" trzyma to, co wróciło z narzędzia — model go nie wypełnia, bo to byłaby ściema.`
                : `Nieznane pole „${pole}". Dozwolone: ${POLA.join(', ')}.`,
        );
    }

    const system = [
        `Jesteś ${rola.rola} w studiu TeO. Odpowiadasz po polsku.`,
        ...rola.zadanie,
        `Wypełniasz JEDNO pole: ${OPIS_POLA[pole]}`,
        'Oddajesz SAMĄ TREŚĆ pola. Bez wstępu, bez „Oto…", bez komentarza o sobie, bez pytań zwrotnych.',
        'Bez zastrzeżeń prawnych i bez formułek o tym, czym jesteś jako model.',
    ].join('\n');

    const czesci = [`PROJEKT: ${projekt || 'bez nazwy'}`, `ETAP: ${E}`];

    if (biblia?.trim()) {
        czesci.push(`\n— BIBLIA PROJEKTU (kotwica spójności) —\n${przytnijNaGranicy(biblia, BUDZET_BIBLII)}`);
    }
    if (fakty.length) {
        const kanon = fakty.map((f) => `- ${f.tresc ?? f}`).join('\n');
        czesci.push(`\n— KANON SERIALU (nie wolno mu zaprzeczyć) —\n${przytnijNaGranicy(kanon, BUDZET_KANONU)}`);
    }
    if (kadr) {
        const linie = [`tytuł: ${kadr.tytul || '(pusty)'}`];
        if (kadr.opis?.trim()) linie.push(`opis: ${kadr.opis}`);
        if (kadr.notatki?.trim()) linie.push(`notatki: ${kadr.notatki}`);
        // `zwrot` DOKLEJAMY do kontekstu (model ma wiedzieć, co już wróciło),
        // ale nadal nie wolno mu go nadpisać.
        if (kadr.zwrot?.trim()) linie.push(`co wróciło z narzędzia: ${kadr.zwrot}`);
        czesci.push(`\n— KARTA, KTÓRĄ UZUPEŁNIASZ —\n${linie.join('\n')}`);
    }
    if (wskazowka?.trim()) czesci.push(`\n— WSKAZÓWKA SUWERENA —\n${wskazowka.trim()}`);

    czesci.push(`\nNapisz teraz treść pola „${pole}". Sama treść.`);
    return { system, prompt: czesci.join('\n') };
}

/**
 * Zdejmij z odpowiedzi to, czym model lubi obudować treść.
 *
 * ⚠️ Kolejność ma znaczenie: najpierw płot ```…```, dopiero potem wstępy —
 * inaczej „Oto prompt:" wewnątrz płotu zostałoby w treści.
 */
export function oczysc(tekst, pole = 'opis') {
    let t = String(tekst || '').trim();

    const plot = t.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
    if (plot) t = plot[1].trim();

    // Jednolinijkowy wstęp typu „Oto opis kadru:" — tylko gdy po nim coś jeszcze jest.
    const linie = t.split('\n');
    if (linie.length > 1 && /^(oto|jasne|pewnie|świetnie|proszę)\b.*:\s*$/i.test(linie[0].trim())) {
        t = linie.slice(1).join('\n').trim();
    }

    if (pole === 'tytul') {
        // Tytuł to jedna linia bez ozdób — model lubi dokleić cudzysłów albo kropkę.
        t = t.split('\n')[0].replace(/^["'„»]|["'”«.]$/g, '').trim();
        if (t.length > 90) t = `${t.slice(0, 87).trim()}…`;
    }
    return t;
}

export default { POLA, POLA_ZAKAZANE, promptUzupelnienia, oczysc };
