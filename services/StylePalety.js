/**
 * 🎨 Style Palety z anidoodle (Suweren 2026-10-29: „rób skille anidoodle dla stada”).
 * Skill anidoodle (TeO_Skille/sztuka/anidoodle, Apache-2.0, Alex Greenshpun) opisuje 32 style jako SPOSÓB robienia
 * znaku: medium, krawędź, kolejność. Silnik skilla to robota dla agenta piszącego kod; stado bierze z niego wiedzę:
 * spis `references/styles/INDEX.md` → Kronikarz wybiera JEDEN styl z zamkniętej listy (id), a Paleta (FLUX)
 * dostaje opis medium zamiast stałego „iluminowanego rękopisu”. Brak skilla albo styl spoza listy = dawny styl.
 */
import fs from 'fs';
import path from 'path';

export const PLIK_INDEKSU = path.join('TeO_Skille', 'sztuka', 'anidoodle', 'references', 'styles', 'INDEX.md');
export const KONIEC_PROMPTU = ', hand-made illustration, no text, no letters, no watermark';

/** Wiersz tabeli „| 29 | Sumi-e ink painting (`sumiE`) | one loaded soft brush… | `…` | `…` |” → styl. */
const WIERSZ = /^\|\s*\d+\s*\|\s*(.+?)\s*\(`([A-Za-z0-9]+)`\)\s*\|\s*([^|]+?)\s*\|/;

export function styleZIndeksu(tekst) {
    const style = [];
    for (const linia of String(tekst ?? '').split(/\r?\n/)) {
        const m = linia.match(WIERSZ);
        if (!m) continue;
        const [, nazwa, id, medium] = m;
        if (!style.some((s) => s.id === id)) style.push({ id, nazwa: nazwa.trim(), medium: medium.trim().slice(0, 400) });
    }
    return style;
}

/** Style ze skilla w Katedrze; brak pliku = pusta lista (Paleta maluje dawnym stylem). */
export function wczytajStyle(katalogKatedry = process.cwd()) {
    try { return styleZIndeksu(fs.readFileSync(path.join(katalogKatedry, PLIK_INDEKSU), 'utf8')); } catch { return []; }
}

/** Lista dla Kronikarza: „sumiE — Sumi-e ink painting”, jedna linia na styl. */
export const listaDlaKronikarza = (style) => style.map((s) => `${s.id} — ${s.nazwa}`).join('\n');

/** Id od modelu → styl z listy (bez wielkości liter i ogonków typu kropka, backtick). Spoza listy = null. */
export function znajdzStyl(style, id) {
    const czysty = String(id ?? '').replace(/[`'"*.,;:()]/g, '').trim().split(/\s+/)[0]?.toLowerCase();
    if (!czysty) return null;
    return style.find((s) => s.id.toLowerCase() === czysty) ?? null;
}

/**
 * Opis medium ze skilla mówi o NARZĘDZIACH („one loaded soft brush of sumi ink…”) — FLUX malował wtedy same pędzle
 * w kadrze (na żywo 2026-10-29). Dlatego: nazwa stylu jako wygląd dzieła, medium w nawiasie jako faktura,
 * i wprost „bez narzędzi i rąk w kadrze”.
 */
export const sufiksStylu = (styl) =>
    `, a finished ${styl.nazwa} artwork (look and texture of: ${styl.medium}), only the finished picture is visible, `
    + `no brushes, no pens, no art tools, no hands in the frame${KONIEC_PROMPTU}`;

export default { styleZIndeksu, wczytajStyle, listaDlaKronikarza, znajdzStyl, sufiksStylu, PLIK_INDEKSU };
