/**
 * 🎬 RezyserService — Sfera przestaje być rozmówcą, staje się Reżyserem.
 *
 * TRZY RZECZY, KTÓRYCH ROZMÓWCA NIE MIAŁ:
 *  1. RĘCE — może dołożyć kartę na Tablicę Produkcji, rozłożyć zlecenie,
 *     zapamiętać fakt, domknąć odcinek. Nie „opowiada, że zrobił" — robi.
 *  2. PAMIĘĆ — fakty kanoniczne i streszczenia odcinków przeżywają zamknięcie
 *     karty. Bez tego „następny odcinek" jest fikcją: model nie pamięta,
 *     kto komu co zrobił w poprzednim.
 *  3. OBSADĘ — postać (co-bot) można WGRAĆ. Ludzie mają swoje kompany
 *     z relacją zbudowaną gdzie indziej; ta relacja ma dać się zaszczepić
 *     w bańce, a nie zaczynać od zera.
 *
 * ⚠️ BUDŻET KONTEKSTU JEST PRAWDZIWYM OGRANICZENIEM, NIE FORMALNOŚCIĄ.
 * Lokalny `gemma4:e2b` to mały model. Pamięć rośnie w nieskończoność, okno
 * kontekstu nie. Dlatego `zbudujKontekst()` przycina świadomie i MELDUJE,
 * co wypadło — cicha utrata faktu kanonicznego to najgorsze, co może się
 * przydarzyć serialowi (postać nagle zmienia imię i nikt nie wie dlaczego).
 *
 * Wszystko lokalnie: `_OtakOs_Wymiar/rezyser_postacie.json`, `rezyser_pamiec.json`.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const PLIK_POSTACI = 'rezyser_postacie.json';
const PLIK_PAMIECI = 'rezyser_pamiec.json';

// ── Budżet kontekstu (znaki). Suma ~6 kB — tyle mały model przełknie
//    razem z historią rozmowy, nie gubiąc początku instrukcji.
const BUDZET = {
    postac:   2200,
    fakty:    2000,
    odcinki:  1500,
    tablica:   800,
};

async function wczytajPlik(katalog, plik, domyslne) {
    try {
        return JSON.parse(await fs.readFile(path.join(katalog, plik), 'utf8'));
    } catch { return domyslne; }
}

async function zapiszPlik(katalog, plik, dane) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(path.join(katalog, plik), JSON.stringify(dane, null, 2), 'utf8');
}

const nowyId = (pre) => `${pre}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Przycięcie na granicy zdania — urwana w pół myśli instrukcja jest gorsza niż krótsza. */
export function przytnij(tekst, limit) {
    const t = String(tekst || '').trim();
    if (t.length <= limit) return { tekst: t, przyciete: false, bylo: t.length };
    const kawalek = t.slice(0, limit);
    const granica = Math.max(kawalek.lastIndexOf('\n'), kawalek.lastIndexOf('. '));
    const ciety = granica > limit * 0.5 ? kawalek.slice(0, granica + 1) : kawalek;
    return { tekst: ciety.trim(), przyciete: true, bylo: t.length };
}

// ══════════════════════════════════════════════════════════════════════════════
//  OBSADA — postacie i wgrywane co-boty
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Rozpoznaje TRZY kształty wgrywanej postaci, bo co-boty przychodzą w różnych:
 *  1. JSON (eksport z innego systemu),
 *  2. markdown z frontmatterem `---` (jak profile agentów Katedry),
 *  3. goły tekst promptu (najczęstszy przypadek — ktoś kopiuje „kim jesteś").
 *
 * Nie zgadujemy w ciemno: gdy nie da się wyłuskać imienia, mówimy o tym,
 * zamiast nadawać postaci nazwę „Postać 1" i udawać, że tak miało być.
 */
export function rozpoznajPostac(surowe) {
    const tekst = String(surowe || '').trim();
    if (!tekst) throw new Error('Pusto — nie ma czego wgrać.');

    // ⚠️ KOLEJNOŚĆ MA ZNACZENIE. Strażnik długości NIE MOŻE stać przed
    // rozpoznaniem kształtu: `{"name":"X"}` ma 12 znaków, więc odpadał
    // z komunikatem „za mało treści", zamiast powiedzieć, że w JSON-ie
    // brakuje pola z opisem postaci. Mylący błąd jest gorszy niż żaden —
    // Suweren dopisywałby tekst zamiast poprawić pole.

    // 1. JSON
    if (tekst.startsWith('{')) {
        let j;
        try { j = JSON.parse(tekst); }
        catch (e) { throw new Error(`Wygląda na JSON, ale nie da się go odczytać: ${e.message}`); }
        // Bez zewnętrznego try/catch: opakowanie tych błędów w „nie da się odczytać"
        // zamieniłoby precyzyjną diagnozę („brakuje pola prompt") w mgłę.
        const kimJest = String(j.kimJest || j.fullPrompt || j.systemPrompt || j.prompt || j.persona || '').trim();
        if (!kimJest) throw new Error('JSON nie zawiera opisu postaci (kimJest / fullPrompt / systemPrompt / prompt).');
        if (kimJest.length < 20) throw new Error(`Opis postaci w JSON-ie ma ${kimJest.length} znaków — za mało (min. 20).`);
        return {
            imie: String(j.imie || j.name || j.id || '').trim(),
            emoji: String(j.emoji || j.icon || '🎭').trim().slice(0, 4),
            opis: String(j.opis || j.desc || j.description || '').trim(),
            kimJest,
            glos: {
                pitch: Number(j.glos?.pitch ?? j.pitch ?? 1) || 1,
                rate: Number(j.glos?.rate ?? j.rate ?? 1) || 1,
            },
            format: 'json',
        };
    }

    // 2. Markdown z frontmatterem (format profili agentów Katedry)
    const fm = tekst.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (fm) {
        const meta = {};
        for (const linia of fm[1].split('\n')) {
            const i = linia.indexOf(':');
            if (i < 0) continue;
            let v = linia.slice(i + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            meta[linia.slice(0, i).trim()] = v;
        }
        const cialo = fm[2].trim();
        if (!cialo) throw new Error('Frontmatter jest, ale ciało profilu puste — nie ma „kim jest".');
        return {
            imie: String(meta.imie || meta.name || '').trim(),
            emoji: String(meta.emoji || '🎭').trim().slice(0, 4),
            opis: String(meta.opis || meta.description || meta.vibe || '').trim(),
            kimJest: cialo,
            glos: { pitch: Number(meta.pitch) || 1, rate: Number(meta.rate) || 1 },
            format: 'markdown',
        };
    }

    // 3. Goły tekst — imię z pierwszego nagłówka albo pierwszej krótkiej linii
    if (tekst.length < 20) throw new Error('Za mało treści — postać potrzebuje opisu „kim jest" (min. 20 znaków).');
    const linie = tekst.split('\n').map(l => l.trim()).filter(Boolean);
    const naglowek = linie.find(l => l.startsWith('#'));
    const pierwsza = linie[0] || '';
    const imie = naglowek
        ? naglowek.replace(/^#+\s*/, '').trim()
        : (pierwsza.length <= 60 && !pierwsza.endsWith('.') ? pierwsza : '');

    return {
        imie,
        emoji: '🎭',
        opis: '',
        kimJest: tekst,
        glos: { pitch: 1, rate: 1 },
        format: 'tekst',
    };
}

export async function listaPostaci(katalog) {
    const dane = await wczytajPlik(katalog, PLIK_POSTACI, []);
    return Array.isArray(dane) ? dane : [];
}

/**
 * Wgraj/zbuduj postać. `surowe` (tekst do rozpoznania) ALBO gotowe pola.
 * `imie` jest wymagane po rozpoznaniu — bezimienna postać ginie na liście.
 */
export async function dodajPostac(katalog, dane = {}) {
    let baza;
    if (dane.surowe) {
        baza = rozpoznajPostac(dane.surowe);
        // Imię podane ręcznie ma pierwszeństwo nad zgadniętym z tekstu.
        if (String(dane.imie || '').trim()) baza.imie = String(dane.imie).trim();
    } else {
        baza = {
            imie: String(dane.imie || '').trim(),
            emoji: String(dane.emoji || '🎭').trim().slice(0, 4),
            opis: String(dane.opis || '').trim(),
            kimJest: String(dane.kimJest || '').trim(),
            glos: { pitch: Number(dane.glos?.pitch) || 1, rate: Number(dane.glos?.rate) || 1 },
            format: 'reczna',
        };
        if (baza.kimJest.length < 20) {
            throw new Error('Pole „kimJest" jest wymagane (min. 20 znaków) — bez niego postać jest pusta.');
        }
    }
    if (!baza.imie) {
        throw new Error('Nie udało się odczytać imienia postaci — podaj je ręcznie w polu „imię".');
    }

    const postac = {
        id: nowyId('postac'),
        utworzono: new Date().toISOString(),
        ...baza,
        // 'kompan'  — co-bot Suwerena, wchodzi do bańki jako rozmówca.
        // 'ekipa'   — specjalista produkcyjny, Reżyser wzywa go do zadania.
        rola: dane.rola === 'ekipa' ? 'ekipa' : 'kompan',
        pochodzenie: dane.surowe ? 'wgrana' : 'zbudowana',
    };

    const postacie = await listaPostaci(katalog);
    postacie.push(postac);
    await zapiszPlik(katalog, PLIK_POSTACI, postacie);
    return postac;
}

export async function usunPostac(katalog, id) {
    const postacie = await listaPostaci(katalog);
    const i = postacie.findIndex(p => p.id === id);
    if (i < 0) throw new Error(`Postać "${id}" nie istnieje.`);
    const [usunieta] = postacie.splice(i, 1);
    await zapiszPlik(katalog, PLIK_POSTACI, postacie);
    return usunieta;
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAMIĘĆ SERIALU — to, dzięki czemu „następny odcinek" ma sens
// ══════════════════════════════════════════════════════════════════════════════

const pustaPamiec = (serial) => ({ serial, fakty: [], odcinki: [] });

export async function pamiec(katalog, serial) {
    const nazwa = String(serial || '').trim() || 'bez nazwy';
    const wszystko = await wczytajPlik(katalog, PLIK_PAMIECI, {});
    return wszystko[nazwa] ?? pustaPamiec(nazwa);
}

/**
 * Seriale, które mają CO podpowiedzieć. Wpis bez faktów i bez odcinków to nie
 * pamięć, tylko osad po skasowaniu wszystkiego — a podpowiedź „0 faktów · 0 odc."
 * zaśmieca listę i niczego nie mówi.
 */
export async function listaSeriali(katalog) {
    const wszystko = await wczytajPlik(katalog, PLIK_PAMIECI, {});
    return Object.entries(wszystko)
        .map(([serial, p]) => ({
            serial,
            faktow: p.fakty?.length ?? 0,
            odcinkow: p.odcinki?.length ?? 0,
        }))
        .filter(s => s.faktow > 0 || s.odcinkow > 0);
}

/** Fakt kanoniczny — rzecz, której następne odcinki nie mogą zaprzeczyć. */
export async function dodajFakt(katalog, serial, tresc, zrodlo = 'suweren') {
    const t = String(tresc || '').trim();
    if (t.length < 3) throw new Error('Fakt jest pusty.');

    const nazwa = String(serial || '').trim() || 'bez nazwy';
    const wszystko = await wczytajPlik(katalog, PLIK_PAMIECI, {});
    const p = wszystko[nazwa] ?? pustaPamiec(nazwa);

    // Ten sam fakt dopisany dwa razy zjada budżet kontekstu i nic nie wnosi.
    if (p.fakty.some(f => f.tresc.toLowerCase() === t.toLowerCase())) {
        return { fakt: p.fakty.find(f => f.tresc.toLowerCase() === t.toLowerCase()), duplikat: true };
    }

    const fakt = { id: nowyId('fakt'), tresc: t, zrodlo, kiedy: new Date().toISOString() };
    p.fakty.push(fakt);
    wszystko[nazwa] = p;
    await zapiszPlik(katalog, PLIK_PAMIECI, wszystko);
    return { fakt, duplikat: false };
}

export async function usunFakt(katalog, serial, id) {
    const nazwa = String(serial || '').trim() || 'bez nazwy';
    const wszystko = await wczytajPlik(katalog, PLIK_PAMIECI, {});
    const p = wszystko[nazwa] ?? pustaPamiec(nazwa);
    const i = p.fakty.findIndex(f => f.id === id);
    if (i < 0) throw new Error(`Fakt "${id}" nie istnieje.`);
    const [usuniety] = p.fakty.splice(i, 1);
    wszystko[nazwa] = p;
    await zapiszPlik(katalog, PLIK_PAMIECI, wszystko);
    return usuniety;
}

/** Domknięcie odcinka — numer nadaje się sam, żeby nie było dwóch „odcinków 3". */
export async function dodajOdcinek(katalog, serial, dane = {}) {
    const tytul = String(dane.tytul || '').trim();
    const streszczenie = String(dane.streszczenie || '').trim();
    if (tytul.length < 3) throw new Error('Odcinek potrzebuje tytułu (min. 3 znaki).');
    if (streszczenie.length < 20) {
        throw new Error('Streszczenie odcinka jest wymagane (min. 20 znaków) — bez niego następny odcinek nie ma na czym stanąć.');
    }

    const nazwa = String(serial || '').trim() || 'bez nazwy';
    const wszystko = await wczytajPlik(katalog, PLIK_PAMIECI, {});
    const p = wszystko[nazwa] ?? pustaPamiec(nazwa);

    const odcinek = {
        id: nowyId('odc'),
        // ⚠️ NIE `length + 1`. Po skasowaniu odcinka 2 z trzech lista ma długość 2,
        // więc następny dostałby numer 3 — czyli ten sam, co istniejący. Numer
        // bierzemy z najwyższego, jaki padł, i nigdy się nie cofa.
        numer: p.odcinki.reduce((max, o) => Math.max(max, Number(o.numer) || 0), 0) + 1,
        tytul, streszczenie,
        kiedy: new Date().toISOString(),
    };
    p.odcinki.push(odcinek);
    wszystko[nazwa] = p;
    await zapiszPlik(katalog, PLIK_PAMIECI, wszystko);
    return odcinek;
}

/**
 * Usuń odcinek. NUMERÓW NIE PRZENUMEROWUJEMY — po skasowaniu odcinka 2
 * zostaje dziura (1, 3) i tak ma być. Przenumerowanie zmieniłoby znaczenie
 * zdań już zapisanych w streszczeniach („jak w odcinku trzecim") i cicho
 * przepisało historię serialu.
 */
export async function usunOdcinek(katalog, serial, id) {
    const nazwa = String(serial || '').trim() || 'bez nazwy';
    const wszystko = await wczytajPlik(katalog, PLIK_PAMIECI, {});
    const p = wszystko[nazwa] ?? pustaPamiec(nazwa);
    const i = p.odcinki.findIndex(o => o.id === id);
    if (i < 0) throw new Error(`Odcinek "${id}" nie istnieje.`);
    const [usuniety] = p.odcinki.splice(i, 1);
    wszystko[nazwa] = p;
    await zapiszPlik(katalog, PLIK_PAMIECI, wszystko);
    return usuniety;
}

// ══════════════════════════════════════════════════════════════════════════════
//  KONTEKST — pamięć + obsada + tablica, przycięte do budżetu i ZMELDOWANE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Składa blok kontekstu dla Reżysera.
 *
 * Kolejność przycinania jest przemyślana: NAJPIERW lecą stare odcinki
 * (streszczenie odcinka 1 przy odcinku 9 rzadko coś zmienia), fakty
 * kanoniczne bronią się najdłużej. `pominieto` mówi wprost, co wypadło —
 * bo model, który „zapomniał" faktu, wygląda dokładnie jak model, który
 * go nigdy nie dostał, a to dwa różne problemy.
 */
export function zbudujKontekst({ pamiecSerialu, postac = null, kadry = [] }) {
    const czesci = [];
    const pominieto = [];

    if (postac) {
        const p = przytnij(postac.kimJest, BUDZET.postac);
        czesci.push(`KIM JESTEŚ W TEJ ROZMOWIE (postać wgrana przez Suwerena):\n${p.tekst}`);
        if (p.przyciete) pominieto.push(`opis postaci „${postac.imie}" przycięty z ${p.bylo} do ${p.tekst.length} znaków`);
    }

    const fakty = pamiecSerialu?.fakty ?? [];
    if (fakty.length) {
        // Najnowsze fakty na końcu listy — ostatnie ustalenia są zwykle najważniejsze,
        // więc przy przycinaniu tracimy NAJSTARSZE, nie najświeższe.
        let blok = '', uzyte = 0;
        for (let i = fakty.length - 1; i >= 0; i--) {
            const linia = `- ${fakty[i].tresc}\n`;
            if (blok.length + linia.length > BUDZET.fakty) break;
            blok = linia + blok;
            uzyte++;
        }
        czesci.push(`KANON SERIALU — tego nie wolno zaprzeczyć:\n${blok.trim()}`);
        if (uzyte < fakty.length) pominieto.push(`${fakty.length - uzyte} z ${fakty.length} najstarszych faktów nie zmieściło się w kontekście`);
    }

    const odcinki = pamiecSerialu?.odcinki ?? [];
    if (odcinki.length) {
        let blok = '', uzyte = 0;
        for (let i = odcinki.length - 1; i >= 0; i--) {
            const o = odcinki[i];
            const linia = `#${o.numer} „${o.tytul}": ${o.streszczenie}\n`;
            if (blok.length + linia.length > BUDZET.odcinki) break;
            blok = linia + blok;
            uzyte++;
        }
        czesci.push(`POPRZEDNIE ODCINKI (od najstarszego zmieszczonego):\n${blok.trim()}`);
        if (uzyte < odcinki.length) pominieto.push(`${odcinki.length - uzyte} z ${odcinki.length} najstarszych odcinków nie zmieściło się`);
    }

    if (kadry.length) {
        let blok = '', uzyte = 0;
        for (const k of kadry) {
            const linia = `- [${k.etap}] ${k.tytul}\n`;
            if (blok.length + linia.length > BUDZET.tablica) break;
            blok += linia;
            uzyte++;
        }
        czesci.push(`NA TABLICY PRODUKCJI (nie proponuj tego, co już jest):\n${blok.trim()}`);
        if (uzyte < kadry.length) pominieto.push(`${kadry.length - uzyte} z ${kadry.length} kart tablicy nie zmieściło się`);
    }

    const blok = czesci.join('\n\n');
    return {
        blok,
        znakow: blok.length,
        pominieto,
        pusty: czesci.length === 0,
    };
}

/**
 * Kontrakt rozmowy. JEDNO wywołanie zwraca i mowę, i ewentualną akcję —
 * dwa wywołania (najpierw odpowiedz, potem sklasyfikuj) trwałyby na tej
 * maszynie ponad 40 s i rozmowa przestałaby być rozmową.
 *
 * Gdy model nie utrzyma formatu, warstwa wyżej traktuje całość jako samą
 * mowę i mówi o tym wprost — zamiast zgadywać, co miał na myśli.
 */
export function promptSystemowyRezysera(kontekst, imiePostaci = null) {
    return (
        (imiePostaci
            ? `Jesteś ${imiePostaci} i jednocześnie REŻYSEREM produkcji w Katedrze OtakOS. `
            : 'Jesteś REŻYSEREM produkcji w Katedrze OtakOS — prowadzisz Suwerena przez tworzenie filmu lub kreskówki. ') +
        'Rozmawiasz PO POLSKU. Twoja wypowiedź jest CZYTANA NA GŁOS: 2-3 zdania, ' +
        'bez markdownu, bez list, bez emoji.\n\n' +
        (kontekst.pusty ? '' : `${kontekst.blok}\n\n`) +
        'Masz RĘCE. Gdy Suweren poprosi o coś konkretnego, wykonaj to akcją — nie opowiadaj, że zrobiłeś.\n' +
        'Dostępne akcje:\n' +
        '  {"typ":"dodaj_kadr","tytul":"...","opis":"...","etap":"BIBLIA|KADR|RUCH|MONTAZ"} — dołóż kartę na Tablicę Produkcji\n' +
        '  {"typ":"rozloz","zlecenie":"..."} — rozłóż większe zlecenie na kilka kart naraz\n' +
        '  {"typ":"zapamietaj","fakt":"..."} — zapisz fakt kanoniczny serialu\n' +
        '  {"typ":"domknij_odcinek","tytul":"...","streszczenie":"..."} — domknij odcinek w pamięci\n' +
        '  {"typ":"otworz","modul":"tablica|kadr"} — otwórz Suwerenowi moduł\n\n' +
        'Odpowiadaj WYŁĄCZNIE takim JSON-em, bez markdown, bez niczego poza nim:\n' +
        '{"mowa":"to, co mówisz na głos","akcja":null}\n\n' +
        'PRZYKŁAD z akcją — pole "mowa" JEST OBOWIĄZKOWE, a akcja siedzi W ŚRODKU pola "akcja":\n' +
        '{"mowa":"Dobrze, dokładam kartę postaci na tablicę.",' +
        '"akcja":{"typ":"dodaj_kadr","tytul":"Karta postaci: Marek","opis":"sylwetka, strój, paleta","etap":"BIBLIA"}}\n\n' +
        'Jedna akcja na odpowiedź. Gdy nie ma co robić — "akcja":null.'
    );
}

/**
 * Odczytaj odpowiedź Reżysera.
 *
 * ⚠️ PARSER JEST CELOWO SZERSZY NIŻ KONTRAKT. Zmierzone na `gemma4:e2b`:
 * model potrafi spłaszczyć odpowiedź do `{"akcja":"dodaj_kadr","tytul":…}`
 * — czyli wrzucić TYP jako string, a pola akcji jako rodzeństwo, i pominąć
 * „mowa". Trzymanie się litery kontraktu znaczyłoby, że Reżyser praktycznie
 * nie ma rąk na lokalnym rdzeniu.
 *
 * Rozpoznajemy więc kilka kształtów, ale WYŁĄCZNIE deterministycznie —
 * nic tu nie zgaduje intencji. Gdy mowy nie ma, zwracamy `mowa: null`
 * i warstwa wyżej ułoży zdanie z FAKTYCZNEGO wyniku akcji (a więc po jej
 * wykonaniu), zamiast wkładać modelowi w usta czegoś, czego nie powiedział.
 */
export function odczytajOdpowiedz(surowe) {
    const tekst = String(surowe || '');
    const m = tekst.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('brak JSON-a w odpowiedzi');

    const j = JSON.parse(m[0]);
    const mowa = String(j.mowa ?? j.speech ?? j.tekst ?? j.odpowiedz ?? '').trim() || null;

    let akcja = null;
    if (j.akcja && typeof j.akcja === 'object' && (j.akcja.typ || j.akcja.type)) {
        // Kształt kontraktowy.
        akcja = { ...j.akcja, typ: String(j.akcja.typ ?? j.akcja.type).toLowerCase() };
    } else if (typeof j.akcja === 'string' && j.akcja.trim()) {
        // Spłaszczony: {"akcja":"dodaj_kadr","tytul":…,"etap":…}
        const { mowa: _m, akcja: _a, ...reszta } = j;
        akcja = { ...reszta, typ: j.akcja.trim().toLowerCase() };
    } else if (typeof j.typ === 'string' && j.typ.trim()) {
        // Sama akcja bez opakowania: {"typ":"dodaj_kadr","tytul":…}
        const { mowa: _m, ...reszta } = j;
        akcja = { ...reszta, typ: j.typ.trim().toLowerCase() };
    }

    if (!mowa && !akcja) throw new Error('JSON bez pola „mowa" i bez akcji');
    return { mowa, akcja };
}

/**
 * Zdanie potwierdzające ułożone z WYKONANEJ akcji — używane tylko wtedy,
 * gdy model nie dał „mowa". Nie może przesadzić, bo powstaje po fakcie,
 * z tego, co realnie zwrócił serwis.
 */
export function zdanieZWyniku(typ, wynik) {
    if (!wynik) return 'Nie udało mi się tego wykonać.';
    if (!wynik.wykonana) return `Nie udało się: ${wynik.powod || 'nieznany powód'}.`;
    switch (typ) {
        case 'dodaj_kadr':       return `Zrobione — ${wynik.opis} jest na tablicy.`;
        case 'rozloz':           return `Zrobione — ${wynik.opis}.`;
        case 'zapamietaj':       return `Zapisałem w kanonie: ${wynik.fakt?.tresc ?? wynik.opis}.`;
        case 'domknij_odcinek':  return `Domknięte — ${wynik.opis}.`;
        case 'otworz':           return 'Otwieram.';
        default:                 return `Zrobione — ${wynik.opis}.`;
    }
}

/** Akcje, które Reżyser może wykonać. Biała lista — model nie wymyśli sobie nowej. */
export const AKCJE_REZYSERA = new Set([
    'dodaj_kadr', 'rozloz', 'zapamietaj', 'domknij_odcinek', 'otworz',
]);

export default {
    listaPostaci, dodajPostac, usunPostac, rozpoznajPostac,
    pamiec, listaSeriali, dodajFakt, usunFakt, dodajOdcinek, usunOdcinek,
    zbudujKontekst, promptSystemowyRezysera, odczytajOdpowiedz, zdanieZWyniku,
    AKCJE_REZYSERA, przytnij, BUDZET,
};
