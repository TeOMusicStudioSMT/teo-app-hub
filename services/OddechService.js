/**
 * 🫁 OddechService — Ekonomia Oddechu (Respiration GRV Engine).
 *
 * Decyzja Suwerena po naradzie z Radą: 1 + 2 = 3.
 *   · RUCH     — praca z kartami, prompty, wektory → mikro-nagroda.
 *   · WYNIK    — domknięty montaż, render ffmpeg, TeOPrint → nagroda ukończenia.
 *   · TRWAŁOŚĆ — to, co powstało, ląduje w Rejestrze Zasobów Trwałych
 *                z pieczęcią w księdze GRV.
 *
 * ⚠️ DWA ZABEZPIECZENIA, BEZ KTÓRYCH TO NIE BYŁBY ODDECH, TYLKO HIPERWENTYLACJA:
 *
 * 1. LIMIT DOBOWY. Praca własna może wytworzyć najwyżej `LIMIT_DOBOWY` GRV
 *    w oknie 24 h. Liczony z REALNYCH wpisów, nie z licznika w pamięci —
 *    restart mostu go nie zeruje. Bez tego księga da się napompować w minutę.
 *
 * 2. KLUCZ JEDNOKROTNOŚCI. Każde naliczenie niesie `klucz` (np. `kadr:abc123`).
 *    Ta sama praca płaci RAZ. Bez tego wystarczyłoby klikać jeden przycisk,
 *    żeby drukować GRV — a to zamienia nagrodę za kreatywność w automat do gry.
 *
 * Sam ruch GRV robi most przez `przelejGrv` (z pieczęcią łańcucha). Ten serwis
 * decyduje CZY i ILE, oraz prowadzi rejestr — nigdy nie dotyka księgi wprost,
 * żeby nie powstała druga droga emisji z pominięciem pieczęci.
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

const PLIK = 'oddech.json';

/** Ile GRV praca własna może wytworzyć w oknie 24 h. */
export const LIMIT_DOBOWY = 5000;

/** Stawki. RUCH jest mikro-nagrodą, WYNIK — nagrodą ukończenia. */
export const STAWKI = {
    RUCH: 5,
    WYNIK: 100,
};

/**
 * Rodzaje pracy, które Katedra potrafi rozpoznać. Biała lista jest celowa:
 * front nie może wymyślić nowego tytułu do wypłaty.
 */
export const RODZAJE = {
    // ── RUCH ──
    'kadr.dodany':        { klasa: 'RUCH',  opis: 'karta na Tablicy Produkcji' },
    'kadr.etap':          { klasa: 'RUCH',  opis: 'przesunięcie karty na kolejny etap' },
    'prompt.zbudowany':   { klasa: 'RUCH',  opis: 'prompt z kotwicą biblii' },
    'wektory.zebrane':    { klasa: 'RUCH',  opis: 'wektory soniczne utworu' },
    'fakt.kanon':         { klasa: 'RUCH',  opis: 'fakt dopisany do kanonu serialu' },
    // ── RUCH: Służba w module „Twoje Biznesy" ──
    // Obsługa klienta to praca jak każda inna — i idzie DOKŁADNIE tą samą drogą:
    // ten sam limit dobowy, ten sam klucz jednokrotności, ta sama pieczęć.
    // Osobna „ekonomia biznesowa" byłaby drugą drogą emisji, czyli księgą bez dowodu.
    'biznes.klient':      { klasa: 'RUCH',  opis: 'obsłużony klient działalności' },
    'biznes.oferta':      { klasa: 'RUCH',  opis: 'oferta wygenerowana dla klienta' },
    'biznes.rozmowa':     { klasa: 'RUCH',  opis: 'domknięta rozmowa AI z klientem' },
    // ── WYNIK ──
    'montaz.edl':         { klasa: 'WYNIK', opis: 'domknięty montaż (EDL)' },
    'render.wideo':       { klasa: 'WYNIK', opis: 'wyrenderowany plik wideo (ffmpeg)' },
    'teoprint':           { klasa: 'WYNIK', opis: 'TeOPrint z Kuźni LaB' },
    'odcinek.domkniety':  { klasa: 'WYNIK', opis: 'domknięty odcinek serialu' },
    'biznes.zamowienie':  { klasa: 'WYNIK', opis: 'złożone zamówienie w działalności' },
};

function sciezka(katalog) { return path.join(katalog, PLIK); }

async function wczytaj(katalog) {
    try {
        const d = JSON.parse(await fs.readFile(sciezka(katalog), 'utf8'));
        return {
            wdechy: Array.isArray(d.wdechy) ? d.wdechy : [],
            trwale: Array.isArray(d.trwale) ? d.trwale : [],
        };
    } catch { return { wdechy: [], trwale: [] }; }
}

async function zapisz(katalog, dane) {
    if (!fsSync.existsSync(katalog)) await fs.mkdir(katalog, { recursive: true });
    await fs.writeFile(sciezka(katalog), JSON.stringify(dane, null, 2), 'utf8');
}

const DOBA_MS = 24 * 60 * 60 * 1000;

/** Ile GRV węzeł wytworzył pracą w ostatnich 24 h — liczone z zapisów. */
function wytworzoneWDobie(wdechy, wezel, teraz = Date.now()) {
    return wdechy
        .filter(w => w.wezel === wezel && teraz - new Date(w.kiedy).getTime() < DOBA_MS)
        .reduce((s, w) => s + (Number(w.grv) || 0), 0);
}

/**
 * Rozstrzyga, czy za tę pracę należy się GRV i ile.
 * NIE wykonuje przelewu — zwraca werdykt, a most go realizuje.
 *
 * Zwraca `{ przyznane: false, powod }`, gdy praca już zapłacona albo limit
 * wyczerpany. To nie jest błąd — to normalny oddech, który akurat trafił
 * na wydech.
 */
export async function ocenPrace(katalog, { wezel, rodzaj, klucz }) {
    if (!wezel) throw new Error('Wymagany „wezel".');
    const def = RODZAJE[rodzaj];
    if (!def) throw new Error(`Nieznany rodzaj pracy „${rodzaj}". Dozwolone: ${Object.keys(RODZAJE).join(', ')}.`);
    if (!klucz) throw new Error('Wymagany „klucz" jednokrotności — bez niego ta sama praca płaciłaby w kółko.');

    const d = await wczytaj(katalog);

    if (d.wdechy.some(w => w.klucz === klucz && w.wezel === wezel)) {
        return { przyznane: false, powod: 'Ta praca już została nagrodzona.', klasa: def.klasa, stawka: 0 };
    }

    const stawka = STAWKI[def.klasa];
    const juz = wytworzoneWDobie(d.wdechy, wezel);
    if (juz >= LIMIT_DOBOWY) {
        return {
            przyznane: false, klasa: def.klasa, stawka: 0,
            powod: `Limit dobowy wyczerpany (${juz}/${LIMIT_DOBOWY} GRV). Oddech ma rytm — wróć za jakiś czas.`,
            wDobie: juz, limit: LIMIT_DOBOWY,
        };
    }

    // Ostatni wdech przed limitem bywa niepełny — płacimy tyle, ile zostało.
    const doWyplaty = Math.min(stawka, LIMIT_DOBOWY - juz);
    return { przyznane: true, klasa: def.klasa, opis: def.opis, stawka: doWyplaty, wDobie: juz, limit: LIMIT_DOBOWY };
}

/**
 * Zapis PO udanym przelewie. `trwaly` (jeśli podany) ląduje w Rejestrze
 * Zasobów Trwałych — to jest ta „TRWAŁOŚĆ" z punktu 3.
 */
export async function zapiszWdech(katalog, { wezel, rodzaj, klucz, grv, klasa, trwaly = null }) {
    const d = await wczytaj(katalog);
    const wpis = { klucz, wezel, rodzaj, klasa, grv: Number(grv) || 0, kiedy: new Date().toISOString() };
    d.wdechy.push(wpis);

    if (trwaly && String(trwaly.nazwa || '').trim()) {
        d.trwale.push({
            id: `trw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            nazwa: String(trwaly.nazwa).trim(),
            rodzaj,
            sciezka: String(trwaly.sciezka || '').trim() || null,
            wezel,
            grv: wpis.grv,
            kiedy: wpis.kiedy,
        });
    }
    await zapisz(katalog, d);
    return wpis;
}

/** Stan oddechu węzła — do licznika w Hubie. */
export async function stanOddechu(katalog, wezel) {
    const d = await wczytaj(katalog);
    const teraz = Date.now();
    const wDobie = wytworzoneWDobie(d.wdechy, wezel, teraz);
    const moje = d.wdechy.filter(w => w.wezel === wezel);

    return {
        wezel,
        wDobie,
        limit: LIMIT_DOBOWY,
        pozostalo: Math.max(0, LIMIT_DOBOWY - wDobie),
        procentDoby: +(wDobie / LIMIT_DOBOWY * 100).toFixed(1),
        wdechow: moje.length,
        grvLacznie: moje.reduce((s, w) => s + (Number(w.grv) || 0), 0),
        ruchow: moje.filter(w => w.klasa === 'RUCH').length,
        wynikow: moje.filter(w => w.klasa === 'WYNIK').length,
        trwalych: d.trwale.filter(t => t.wezel === wezel).length,
        // Najświeższe najpierw — Hub pokazuje ostatnie oddechy.
        ostatnie: moje.slice(-8).reverse(),
        stawki: STAWKI,
    };
}

/** Rejestr Zasobów Trwałych — to, co przetrwało, z pieczęcią w księdze. */
export async function rejestrTrwalych(katalog, wezel = null) {
    const d = await wczytaj(katalog);
    return d.trwale
        .filter(t => !wezel || t.wezel === wezel)
        .sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy)));
}

export default {
    LIMIT_DOBOWY, STAWKI, RODZAJE,
    ocenPrace, zapiszWdech, stanOddechu, rejestrTrwalych,
};
