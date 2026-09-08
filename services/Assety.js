/**
 * 🎭 Assety — biblioteka wielokrotnego użytku: aktorzy, sceny, rekwizyty,
 * głosy i muzyka, które Reżyser obsadza w kadrach.
 *
 * PO CO. Suweren, po obejrzeniu Director Studio: „zakładka Aktorzy powinna
 * mieć takie możliwości, ponadto wybór roli — obecne trzeba nadpisać, bo już
 * nie pasują", „dodanie modułu scen otoczenia", „menu assetowe dla sceny,
 * możemy tam dodać moduł muzyki filmowej".
 *
 * Dotąd „aktor" był wklejonym tekstem persony z polem `rola: kompan|ekipa` —
 * to opis TOWARZYSZA z Domu TeOgochi, a nie obsada filmu. Postać w opowieści
 * potrzebuje twarzy, garderoby i roli fabularnej.
 *
 * ⚠️ ASSET NALEŻY DO PROJEKTU, NIE DO KATEDRY. Molita z „alchemicznej
 * fluktuacji" nie ma czego szukać w obsadzie Cafe Martens. Każdy projekt ma
 * własny katalog `produkcje/<slug>/assety/` i własny indeks.
 *
 * ⚠️ MUZYKA JEST WSKAZANIEM, NIE KOPIĄ. Utwory żyją w bibliotece Katedry
 * (MuzykaFilmowa) i tam zostają — asset trzyma ścieżkę. Kopiowanie 185
 * utworów do każdego projektu to gigabajty duplikatów i dwa źródła prawdy
 * o tym, która wersja miksu jest aktualna.
 *
 * ⚠️ ARKUSZ WIELOKĄTOWY NIE JEST CZĘŚCIĄ TEGO PLIKU. Tu trzymamy dane;
 * liczeniem widoków zajmuje się `ArkuszWielokat.js`, bo to osobna sprawa
 * i osobne ryzyko (potrzebuje modeli, których na tej maszynie może nie być).
 */

import fs from 'fs/promises';
import path from 'path';
import { slug, utworzProjekt } from './Produkcje.js';

const PLIK = 'assety.json';

/**
 * Typy assetów. Zamknięta lista — „różne" jako typ oznacza szufladę, do której
 * po miesiącu nikt nie zagląda.
 */
export const TYPY = {
    aktor: { etykieta: 'Aktorzy', opis: 'Tożsamość obsady', arkusz: true },
    scena: { etykieta: 'Sceny', opis: 'Świat i lokacje', arkusz: true },
    rekwizyt: { etykieta: 'Rekwizyty', opis: 'Przedmioty opowieści', arkusz: true },
    glos: { etykieta: 'Głosy', opis: 'Wzorzec wykonania', arkusz: false },
    muzyka: { etykieta: 'Muzyka filmowa', opis: 'Utwory z biblioteki Katedry', arkusz: false },
};

/**
 * Role fabularne.
 *
 * ⚠️ TO NIE SĄ role z Domu TeOgochi („kompan"/„ekipa"). Tamte mówią, czym jest
 * agent w Katedrze; te mówią, ile miejsca postać zajmuje w opowieści — i to
 * jest informacja, której potrzebuje Reżyser przy obsadzaniu kadru.
 */
export const ROLE = {
    glowna: 'Główna',
    drugoplanowa: 'Drugoplanowa',
    epizod: 'Epizod',
    tlo: 'Tło',
    narrator: 'Narrator',
    antagonista: 'Antagonista',
};

/** Katalog assetów projektu. */
export async function katalog(katalogKatedry, projekt) {
    const { sciezka } = await utworzProjekt(katalogKatedry, projekt);
    const kat = path.join(sciezka, 'assety');
    await fs.mkdir(kat, { recursive: true });
    return kat;
}

async function wczytajIndeks(kat) {
    try {
        const d = JSON.parse(await fs.readFile(path.join(kat, PLIK), 'utf8'));
        return Array.isArray(d.assety) ? d.assety : [];
    } catch { return []; }
}

/**
 * ⚠️ ZAPIS ATOMOWY (tmp → rename). Indeks bywa zapisywany, gdy w tle liczy się
 * arkusz widoków; przerwanie w połowie zostawiłoby plik nie do odczytania,
 * czyli utratę CAŁEJ obsady, nie jednego wpisu.
 */
async function zapiszIndeks(kat, assety) {
    const cel = path.join(kat, PLIK);
    const tmp = `${cel}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ assety }, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

export async function lista(katalogKatedry, projekt, typ = '') {
    const kat = await katalog(katalogKatedry, projekt);
    const assety = await wczytajIndeks(kat);
    return typ ? assety.filter((a) => a.typ === typ) : assety;
}

/** Bilans biblioteki — to, co widać w kafelkach „Project library". */
export async function bilans(katalogKatedry, projekt) {
    const assety = await lista(katalogKatedry, projekt);
    const wynik = {};
    for (const [typ, meta] of Object.entries(TYPY)) {
        const swoje = assety.filter((a) => a.typ === typ);
        wynik[typ] = {
            ...meta,
            ile: swoje.length,
            // Podgląd bierze pierwszy plik, jaki NAPRAWDĘ istnieje — kafelek
            // z pustą ramką mówi „nic tu nie ma" wyraźniej niż zepsuty obrazek.
            podglad: swoje.slice(0, 4).map((a) => ({ id: a.id, nazwa: a.nazwa, miniatura: a.miniatura ?? null })),
        };
    }
    return { projekt, razem: assety.length, typy: wynik };
}

export async function jeden(katalogKatedry, projekt, id) {
    const assety = await lista(katalogKatedry, projekt);
    const a = assety.find((x) => x.id === id);
    if (!a) throw new Error(`Nie znam assetu „${id}" w projekcie „${projekt}".`);
    return a;
}

/**
 * Dopisz albo nadpisz asset.
 *
 * ⚠️ NAZWA JEST TOŻSAMOŚCIĄ. Dwie „Molity" w jednej obsadzie to gwarancja, że
 * za tydzień nikt nie wie, którą obsadzić — więc ten sam typ i ta sama nazwa
 * AKTUALIZUJĄ wpis zamiast tworzyć drugi.
 */
export async function zapisz(katalogKatedry, projekt, dane = {}) {
    const typ = String(dane.typ || '').trim();
    if (!TYPY[typ]) throw new Error(`Nie znam typu assetu „${typ}". Mam: ${Object.keys(TYPY).join(', ')}.`);

    const nazwa = String(dane.nazwa || '').trim();
    if (nazwa.length < 2) throw new Error('Asset potrzebuje nazwy (min. 2 znaki).');

    const rola = String(dane.rola || '').trim();
    if (rola && !ROLE[rola]) throw new Error(`Nie znam roli „${rola}". Mam: ${Object.keys(ROLE).join(', ')}.`);

    const kat = await katalog(katalogKatedry, projekt);
    const assety = await wczytajIndeks(kat);
    const teraz = new Date().toISOString();

    const istniejacy = dane.id
        ? assety.find((a) => a.id === dane.id)
        : assety.find((a) => a.typ === typ && a.nazwa.toLowerCase() === nazwa.toLowerCase());

    const wpis = istniejacy ?? {
        id: `as-${typ}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        typ,
        utworzono: teraz,
        referencje: {},
        arkusz: [],
    };

    wpis.nazwa = nazwa;
    wpis.notatki = String(dane.notatki ?? wpis.notatki ?? '').trim();
    // Pusty łańcuch roli KASUJE rolę — inaczej raz wpisanej nie dałoby się cofnąć.
    if (dane.rola !== undefined) wpis.rola = rola || null;
    if (dane.referencje) wpis.referencje = { ...(wpis.referencje ?? {}), ...dane.referencje };
    if (dane.arkusz) wpis.arkusz = dane.arkusz;
    if (dane.miniatura !== undefined) wpis.miniatura = dane.miniatura || null;
    // Muzyka wskazuje utwór w bibliotece Katedry — nie kopiujemy pliku.
    if (dane.utwor !== undefined) wpis.utwor = dane.utwor || null;
    wpis.zmieniono = teraz;

    if (!istniejacy) assety.push(wpis);
    await zapiszIndeks(kat, assety);
    return wpis;
}

export async function usun(katalogKatedry, projekt, id) {
    const kat = await katalog(katalogKatedry, projekt);
    const assety = await wczytajIndeks(kat);
    const i = assety.findIndex((a) => a.id === id);
    if (i < 0) throw new Error(`Nie znam assetu „${id}".`);
    const [usuniety] = assety.splice(i, 1);
    await zapiszIndeks(kat, assety);
    // ⚠️ PLIKI ZOSTAJĄ. Referencje i arkusze to godziny liczenia albo zdjęcia
    // Suwerena; kasowanie wpisu z indeksu nie jest zgodą na kasowanie dorobku.
    return { ...usuniety, uwaga: 'Wpis usunięty z biblioteki. Pliki referencji i arkusza zostały na dysku.' };
}

/**
 * Zapisz plik referencyjny (obraz/audio) w katalogu assetu.
 *
 * ⚠️ PRZYJMUJEMY DANE, NIE ŚCIEŻKĘ Z ŻĄDANIA. Panel bywa wystawiony przez
 * Kwantowy Tunel na telefon; branie dowolnej ścieżki z dysku na słowo znaczy,
 * że każdy, kto ma link, może wciągnąć do projektu co zechce.
 */
export async function zapiszReferencje(katalogKatedry, projekt, { id, pole, nazwaPliku, base64 }) {
    if (!pole) throw new Error('Nie podano, czym ta referencja jest (np. aktor, garderoba, plyta).');
    const dane = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
    if (dane.length < 32) throw new Error('Pusta referencja — nie ma czego zapisać.');

    const bufor = Buffer.from(dane, 'base64');
    const MAX = 24 * 1024 * 1024;
    if (bufor.length > MAX) throw new Error(`Plik ma ${(bufor.length / 1048576).toFixed(1)} MB — limit to 24 MB.`);

    const asset = await jeden(katalogKatedry, projekt, id);
    const kat = await katalog(katalogKatedry, projekt);
    const mojKat = path.join(kat, asset.typ, slug(asset.nazwa));
    await fs.mkdir(mojKat, { recursive: true });

    const rozszerzenie = (path.extname(String(nazwaPliku || '')) || '.png').toLowerCase().slice(0, 5);
    const bezpieczne = String(pole).replace(/[^a-z0-9_-]/gi, '_').slice(0, 30);
    const cel = path.join(mojKat, `${bezpieczne}${rozszerzenie}`);
    await fs.writeFile(cel, bufor);

    const zapisany = await zapisz(katalogKatedry, projekt, {
        id: asset.id, typ: asset.typ, nazwa: asset.nazwa,
        referencje: { [bezpieczne]: cel },
        miniatura: asset.miniatura ?? cel,
    });
    return { asset: zapisany, sciezka: cel, bajtow: bufor.length };
}

/**
 * Obsadź assety w kadrze — „Cast & continuity" z Director Studio.
 * Zwracamy PEŁNE assety, nie same identyfikatory: kto czyta kartę kadru, ma
 * od razu wiedzieć, kogo i co w nim widać, bez drugiego zapytania.
 */
export async function obsadaKadru(katalogKatedry, projekt, idki = []) {
    const assety = await lista(katalogKatedry, projekt);
    const znalezione = [];
    const nieznane = [];
    for (const id of idki) {
        const a = assety.find((x) => x.id === id);
        if (a) znalezione.push(a); else nieznane.push(id);
    }
    return { obsada: znalezione, nieznane };
}

/**
 * Przenieś starych „aktorów" z pamięci Reżysera do biblioteki projektu.
 *
 * ⚠️ Suweren: „obecne trzeba nadpisać, bo już nie pasują". Nie kasujemy ich
 * jednak w ciemno — przepisujemy imiona, a rolę zostawiamy PUSTĄ, bo stara
 * („kompan") mówiła o Domu TeOgochi, nie o obsadzie filmu. Rolę wybiera
 * człowiek; zgadywanie jej za niego byłoby wymyślaniem obsady.
 */
export async function przenies(katalogKatedry, projekt, postacie = []) {
    const przeniesione = [];
    for (const p of postacie) {
        if (p.gatunek) continue;                    // to co-bot TeOgochi, nie aktor
        if (!p.imie?.trim()) continue;
        przeniesione.push(await zapisz(katalogKatedry, projekt, {
            typ: 'aktor',
            nazwa: p.imie.trim(),
            notatki: [p.opis?.trim(), p.rola ? `(dawna rola w Katedrze: ${p.rola})` : ''].filter(Boolean).join(' '),
            rola: '',
        }));
    }
    return przeniesione;
}

export default {
    TYPY, ROLE, katalog, lista, bilans, jeden, zapisz, usun,
    zapiszReferencje, obsadaKadru, przenies,
};
