/**
 * 🔤 Słownik wymowy głosów lokalnych (VoiceStudio): nazwy własne, które syntezator czyta krzywo („Teterhia” → „Teta Hia”,
 * „Teterchia”), dostają zapis fonetyczny TYLKO w tekście posyłanym do syntezy — napisy i tekst księgi zostają bez zmian.
 *
 * Wpis: `{ "Teterhia": { "de": "Teterija", "pl": "Teterija", "en": "Teterija", "*": "…" } }` (język albo `*` = każdy).
 * Dobór zapisu (2026-11-16): Kalen, test Whisper VoiceStudio na zdaniu „Welcome to X…”: Teterhia → DE „Teterhia”/EN „Tetrahia”,
 * Teteria → PL „Tetyria”, **Teterija → DE „Teteria”, PL „Tetheria”, EN „Teteria”** (najbliżej zamierzonego brzmienia we wszystkich trzech).
 * UCZCIWIE: to wynik rozpoznawania mowy, nie odsłuch — ostatnie słowo ma ucho Suwerena; zapis zmienia się w `wymowa.json` Katedry.
 */
import crypto from 'crypto';

export const WYMOWA_DOMYSLNA = {
    Teterhia: { '*': 'Teterija' },
};
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Zamienia nazwy ze słownika (całe słowa; wielkość pierwszej litery zachowana) → `{ tekst, uzyte: [[z, na]…] }`. */
export function zastosujWymowe(tekst, jezyk, slownik = WYMOWA_DOMYSLNA) {
    let t = String(tekst ?? ''); const uzyte = [];
    for (const [z, wpis] of Object.entries(slownik ?? {})) {
        const na = typeof wpis === 'string' ? wpis : wpis?.[jezyk] ?? wpis?.['*'];
        if (!na || na === z) continue;
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(z)}(?![\\p{L}\\p{N}])`, 'giu');
        let trafil = false;
        t = t.replace(re, (m) => { trafil = true; return m[0] === m[0].toLowerCase() && m[0] !== m[0].toUpperCase() ? na[0].toLowerCase() + na.slice(1) : na; });
        if (trafil) uzyte.push([z, na]);
    }
    return { tekst: t, uzyte };
}

/** Krótki odcisk zastosowanych zamian — wchodzi do nazwy pliku nagrania, więc zmiana zapisu = nowe nagranie tylko tam, gdzie nazwa występuje. */
export const odciskWymowy = (uzyte) => (uzyte.length ? crypto.createHash('sha1').update(JSON.stringify(uzyte)).digest('hex').slice(0, 6) : '');

export default { WYMOWA_DOMYSLNA, zastosujWymowe, odciskWymowy };
