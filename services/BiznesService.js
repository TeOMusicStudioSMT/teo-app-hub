/**
 * 🏢 BiznesService — rejestr działalności Suwerena i księga Służby.
 *
 * Etap 1 modułu „Twoje Biznesy": firmy, strony, usługi i sklepy Suwerena
 * mieszkają w JEDNYM miejscu (`_OtakOs_Wymiar/biznesy.json`), a każda realna
 * akcja obsługi (klient, oferta, zamówienie, domknięta rozmowa) zostawia ślad
 * w księdze zdarzeń — to z niej żyje „Live Orders" w panelu.
 *
 * ⚠️ GRV NIE JEST NALICZANE W TYM PLIKU. Serwis mówi wyłącznie, CO się
 * wydarzyło. Ile za to GRV — rozstrzyga Ekonomia Oddechu (`OddechService`,
 * limit dobowy + klucz jednokrotności), a sam przelew robi most przez
 * `przelejGrv`, z pieczęcią w łańcuchu księgi. Druga ścieżka emisji byłaby
 * księgą bez dowodu, więc jej tu nie ma — jest tylko zapis skutku.
 *
 * Standard ESM · zapis atomowy (tmp → rename), bo w tym pliku siedzi rejestr
 * biznesów Suwerena i przerwany zapis nie ma prawa go zdmuchnąć.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const NAZWA_PLIKU = 'biznesy.json';

/** Ile zdarzeń Służby trzymamy w księdze. Starsze wypadają — to feed, nie archiwum. */
export const LIMIT_ZDARZEN = 500;

/** Rodzaje działalności, które Katedra rozumie. */
export const RODZAJE_BIZNESU = {
    strona: { label: 'Strona / portal', glyph: '🌐' },
    usluga: { label: 'Usługa', glyph: '🛠️' },
    sklep: { label: 'Sklep', glyph: '🛒' },
    lokal: { label: 'Lokal / miejsce', glyph: '📍' },
    studio: { label: 'Studio / produkcja', glyph: '🎬' },
};

/**
 * Akcje Służby ↔ rodzaje pracy w Ekonomii Oddechu.
 *
 * Biała lista jest celowa — tak samo jak w `OddechService`. Front nie może
 * wymyślić nowego tytułu do wypłaty, bo nieznana akcja jest odrzucana zanim
 * ktokolwiek dotknie księgi.
 */
export const AKCJE_SLUZBY = {
    'klient.obsluzony': { oddech: 'biznes.klient', opis: 'obsłużony klient' },
    'oferta.wygenerowana': { oddech: 'biznes.oferta', opis: 'wygenerowana oferta' },
    'rozmowa.domknieta': { oddech: 'biznes.rozmowa', opis: 'domknięta rozmowa AI' },
    'zamowienie.zlozone': { oddech: 'biznes.zamowienie', opis: 'złożone zamówienie' },
};

function sciezka(katalog) { return path.join(katalog, NAZWA_PLIKU); }

export async function wczytaj(katalog) {
    try {
        const d = JSON.parse(await fs.readFile(sciezka(katalog), 'utf8'));
        return {
            biznesy: Array.isArray(d.biznesy) ? d.biznesy : [],
            zdarzenia: Array.isArray(d.zdarzenia) ? d.zdarzenia : [],
        };
    } catch { return { biznesy: [], zdarzenia: [] }; }
}

async function zapisz(katalog, dane) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    const cel = sciezka(katalog);
    const tmp = cel + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

/** Identyfikator czytelny dla człowieka, z ogonem losowym przeciw kolizjom. */
function zbudujId(nazwa) {
    const rdzen = String(nazwa || 'biznes')
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/ł/g, 'l')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'biznes';
    return `${rdzen}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Pola, które front wolno zmieniać. Reszta (id, utworzony, GRV) jest poza jego zasięgiem. */
const POLA_EDYTOWALNE = ['nazwa', 'rodzaj', 'opis', 'url', 'telefon', 'voiceProfile', 'agenci', 'aktywny'];

function oczysc(dane = {}) {
    const out = {};
    if (dane.nazwa !== undefined) out.nazwa = String(dane.nazwa).trim().slice(0, 120);
    if (dane.rodzaj !== undefined) out.rodzaj = RODZAJE_BIZNESU[dane.rodzaj] ? dane.rodzaj : 'usluga';
    if (dane.opis !== undefined) out.opis = String(dane.opis).trim().slice(0, 600);
    if (dane.url !== undefined) out.url = String(dane.url).trim().slice(0, 300) || null;
    if (dane.telefon !== undefined) out.telefon = String(dane.telefon).trim().slice(0, 40) || null;
    if (dane.voiceProfile !== undefined) out.voiceProfile = dane.voiceProfile ? String(dane.voiceProfile).trim().slice(0, 64) : null;
    if (dane.agenci !== undefined) out.agenci = Array.isArray(dane.agenci) ? dane.agenci.map(a => String(a).slice(0, 32)).slice(0, 12) : [];
    if (dane.aktywny !== undefined) out.aktywny = !!dane.aktywny;
    return out;
}

export async function lista(katalog) {
    const d = await wczytaj(katalog);
    return d.biznesy;
}

export async function dodaj(katalog, dane) {
    const czyste = oczysc(dane);
    if (!czyste.nazwa) throw new Error('Wymagana „nazwa" działalności.');

    const d = await wczytaj(katalog);
    if (d.biznesy.some(b => String(b.nazwa).toLowerCase() === czyste.nazwa.toLowerCase())) {
        throw new Error(`Działalność „${czyste.nazwa}" już jest w rejestrze.`);
    }

    const biznes = {
        id: zbudujId(czyste.nazwa),
        nazwa: czyste.nazwa,
        rodzaj: czyste.rodzaj ?? 'usluga',
        opis: czyste.opis ?? '',
        url: czyste.url ?? null,
        telefon: czyste.telefon ?? null,
        voiceProfile: czyste.voiceProfile ?? null,
        agenci: czyste.agenci ?? [],
        aktywny: czyste.aktywny ?? true,
        utworzony: new Date().toISOString(),
    };
    d.biznesy.push(biznes);
    await zapisz(katalog, d);
    return biznes;
}

export async function zaktualizuj(katalog, id, zmiany) {
    const d = await wczytaj(katalog);
    const b = d.biznesy.find(x => x.id === id);
    if (!b) throw new Error(`Działalność „${id}" nieznana.`);

    const czyste = oczysc(zmiany);
    for (const pole of POLA_EDYTOWALNE) {
        if (czyste[pole] !== undefined) b[pole] = czyste[pole];
    }
    b.zmieniony = new Date().toISOString();
    await zapisz(katalog, d);
    return b;
}

/**
 * Usuwa działalność z rejestru. Zdarzenia ZOSTAJĄ — GRV za nie poszło już do
 * księgi z pieczęcią, więc kasowanie śladu robiłoby z księgi fikcję.
 */
export async function usun(katalog, id) {
    const d = await wczytaj(katalog);
    const przed = d.biznesy.length;
    d.biznesy = d.biznesy.filter(b => b.id !== id);
    if (d.biznesy.length === przed) throw new Error(`Działalność „${id}" nieznana.`);
    await zapisz(katalog, d);
    return { id, usuniete: true, zdarzenZachowanych: d.zdarzenia.filter(z => z.biznesId === id).length };
}

export async function znajdz(katalog, id) {
    const d = await wczytaj(katalog);
    return d.biznesy.find(b => b.id === id) ?? null;
}

/**
 * Zapis skutku Służby. Wołany PO werdykcie Oddechu — dlatego przyjmuje `grv`
 * i `przyznane` jako fakty, a nie jako coś do policzenia tutaj.
 *
 * Zapisujemy TAKŻE zdarzenia bez GRV (`przyznane: false`) — praca się wydarzyła,
 * tylko oddech trafił na wydech (limit dobowy albo ta sama praca już zapłacona).
 * Ukrywanie ich zrobiłoby z feedu ładniejszy obrazek niż rzeczywistość.
 */
export async function zapiszZdarzenie(katalog, { biznesId, akcja, klucz, opis, klient, grv = 0, przyznane = false, powod = null }) {
    const d = await wczytaj(katalog);
    const wpis = {
        id: `sluz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        biznesId,
        akcja,
        klucz,
        opis: opis ? String(opis).slice(0, 300) : (AKCJE_SLUZBY[akcja]?.opis ?? akcja),
        klient: klient ? String(klient).slice(0, 120) : null,
        grv: Number(grv) || 0,
        przyznane: !!przyznane,
        powod,
        kiedy: new Date().toISOString(),
    };
    d.zdarzenia.push(wpis);
    if (d.zdarzenia.length > LIMIT_ZDARZEN) d.zdarzenia = d.zdarzenia.slice(-LIMIT_ZDARZEN);
    await zapisz(katalog, d);
    return wpis;
}

/** Feed zdarzeń — najświeższe pierwsze. */
export async function zdarzenia(katalog, { biznesId = null, limit = 40 } = {}) {
    const d = await wczytaj(katalog);
    return d.zdarzenia
        .filter(z => !biznesId || z.biznesId === biznesId)
        .slice(-Math.max(1, Math.min(Number(limit) || 40, LIMIT_ZDARZEN)))
        .reverse();
}

/** Bilans jednej działalności — liczony ze zdarzeń, nie z licznika w pamięci. */
export function bilansZ(wszystkieZdarzenia, biznesId) {
    const moje = wszystkieZdarzenia.filter(z => z.biznesId === biznesId);
    return {
        zdarzen: moje.length,
        grv: moje.reduce((s, z) => s + (Number(z.grv) || 0), 0),
        klientow: moje.filter(z => z.akcja === 'klient.obsluzony').length,
        ofert: moje.filter(z => z.akcja === 'oferta.wygenerowana').length,
        zamowien: moje.filter(z => z.akcja === 'zamowienie.zlozone').length,
        rozmow: moje.filter(z => z.akcja === 'rozmowa.domknieta').length,
        ostatnie: moje.length ? moje[moje.length - 1].kiedy : null,
    };
}

/** Stan całego modułu — karty działalności z bilansami + suma GRV ze Służby. */
export async function stan(katalog) {
    const d = await wczytaj(katalog);
    const karty = d.biznesy.map(b => ({ ...b, bilans: bilansZ(d.zdarzenia, b.id) }));
    return {
        biznesy: karty,
        podsumowanie: {
            dzialalnosci: karty.length,
            aktywnych: karty.filter(b => b.aktywny).length,
            zdarzen: d.zdarzenia.length,
            grvZeSluzby: d.zdarzenia.reduce((s, z) => s + (Number(z.grv) || 0), 0),
            zGlosem: karty.filter(b => !!b.voiceProfile).length,
        },
        akcje: AKCJE_SLUZBY,
        rodzaje: RODZAJE_BIZNESU,
    };
}

export default {
    LIMIT_ZDARZEN, RODZAJE_BIZNESU, AKCJE_SLUZBY,
    wczytaj, lista, dodaj, zaktualizuj, usun, znajdz,
    zapiszZdarzenie, zdarzenia, bilansZ, stan,
};
