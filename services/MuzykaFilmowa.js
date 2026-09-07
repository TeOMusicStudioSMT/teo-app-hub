/**
 * 🎼 MuzykaFilmowa — muzyka zrobiona wcześniej w Katedrze, wpięta w produkcję.
 *
 * PO CO. Suweren: „możliwość w produkcji dodania specjalnego katalogu na
 * potrzeby stworzonej wcześniej Muzyki Filmowej, którą będzie można wykorzystać
 * w trakcie kręcenia czy montażu".
 *
 * ⚠️ NIE KOPIUJEMY PLIKÓW. Utwór zostaje tam, gdzie go zrobiła Joanna
 * (`_OtakOs_Muzyka`), a projekt trzyma tylko WSKAZANIE: ścieżka, rola i notatka.
 * Kopiowanie dałoby dwa źródła prawdy i po miesiącu nikt by nie wiedział, czy
 * poprawiony miks w katalogu muzyki to ten sam utwór, co w katalogu filmu.
 *
 * ⚠️ ROLA JEST CZĘŚCIĄ DANYCH, nie ozdobą. Montaż inaczej traktuje motyw
 * przewodni (gra pod całością, ciszej), inaczej akcent (wchodzi w jednym
 * miejscu, głośniej). Bez roli montażysta — człowiek albo ffmpeg — musi zgadywać.
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffprobe from 'ffprobe-static';
import { slug, utworzProjekt } from './Produkcje.js';

const uruchom = promisify(execFile);

const PLIK = 'muzyka.json';
const ROZSZERZENIA = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.opus']);
const MAX_GLEBOKOSC = 3;
const MAX_UTWOROW = 400;

/**
 * Role, jakie utwór pełni w odcinku. Lista jest zamknięta, żeby montaż mógł
 * na niej polegać — dowolny tekst znaczyłby, że każdy projekt nazywa to inaczej.
 */
export const ROLE = [
    { id: 'przewodni', nazwa: 'Motyw przewodni', opis: 'Gra pod całością, cicho, wraca w każdym odcinku.' },
    { id: 'scena', nazwa: 'Podkład sceny', opis: 'Tło konkretnej sceny — nastrój, nie melodia.' },
    { id: 'akcent', nazwa: 'Akcent', opis: 'Wchodzi w jednym momencie: zwrot akcji, cios, odsłonięcie.' },
    { id: 'napisy', nazwa: 'Napisy / tyłówka', opis: 'Zamknięcie odcinka, może grać głośno.' },
    { id: 'cisza', nazwa: 'Cisza zamierzona', opis: 'Miejsce, w którym muzyki ma NIE być — też jest decyzją.' },
];

const katalogProjektu = (katalog, projekt) => {
    const s = slug(projekt);
    if (!s) throw new Error('Projekt bez nazwy — nie wiem, gdzie trzymać muzykę.');
    return path.join(katalog, 'produkcje', s);
};

async function wczytaj(katalog, projekt) {
    try {
        const t = await fs.readFile(path.join(katalogProjektu(katalog, projekt), PLIK), 'utf8');
        const d = JSON.parse(t);
        return Array.isArray(d.utwory) ? d : { projekt, utwory: [] };
    } catch { return { projekt, utwory: [] }; }
}

async function zapisz(katalog, projekt, dane) {
    // ⚠️ PRZEZ `utworzProjekt`, NIE PRZEZ GOŁE `mkdir`. Samo `mkdir` robi katalog
    // BEZ `projekt.json`, a wtedy `listaProjektow` czyta nazwę z NAZWY KATALOGU:
    // „Proba Realizacji" rozdwajała się na projekt z pamięcią i pusty
    // „proba-realizacji" w bibliotece. Złapane 2026-09-07 na żywej liście.
    const { sciezka } = await utworzProjekt(katalog, projekt);
    await fs.writeFile(path.join(sciezka, PLIK), JSON.stringify(dane, null, 2), 'utf8');
}

async function zbierz(katalog, glebokosc, wynik) {
    if (glebokosc > MAX_GLEBOKOSC || wynik.length >= MAX_UTWOROW) return;
    let wpisy;
    try { wpisy = await fs.readdir(katalog, { withFileTypes: true }); } catch { return; }
    for (const w of wpisy) {
        if (wynik.length >= MAX_UTWOROW) return;
        const pelna = path.join(katalog, w.name);
        if (w.isDirectory()) { await zbierz(pelna, glebokosc + 1, wynik); continue; }
        if (!ROZSZERZENIA.has(path.extname(w.name).toLowerCase())) continue;
        try {
            const st = await fs.stat(pelna);
            wynik.push({ nazwa: w.name, sciezka: pelna, bajtow: st.size, kiedy: st.mtimeMs });
        } catch { /* plik zniknął w trakcie */ }
    }
}

/** Co Joanna nagrała — cała biblioteka Katedry, najnowsze pierwsze. */
export async function bibliotekaKatedry(katalogMuzyki) {
    const wynik = [];
    await zbierz(katalogMuzyki, 0, wynik);
    return wynik.sort((a, b) => b.kiedy - a.kiedy);
}

/** Długość utworu — montaż musi wiedzieć, czy podkład pokryje scenę. */
export async function opisUtworu(sciezka) {
    try {
        const { stdout } = await uruchom(ffprobe.path, [
            '-v', 'error', '-print_format', 'json', '-show_format', sciezka,
        ], { maxBuffer: 2 * 1024 * 1024 });
        const d = JSON.parse(stdout);
        return {
            sekundy: Math.round((Number(d.format?.duration) || 0) * 10) / 10,
            bajtow: Number(d.format?.size) || 0,
        };
    } catch {
        // Brak metryki nie jest powodem do odmowy — utwór wciąż da się wpiąć.
        return { sekundy: null, bajtow: null };
    }
}

/** Muzyka wpięta w ten projekt. */
export async function muzykaProjektu(katalog, projekt) {
    const d = await wczytaj(katalog, projekt);
    // Sprawdzamy PRZY ODCZYCIE, czy plik nadal istnieje. Wpis wskazujący
    // na skasowany utwór to pułapka: montaż pada dopiero przy renderze.
    const utwory = [];
    for (const u of d.utwory) {
        let jest = true;
        try { await fs.access(u.sciezka); } catch { jest = false; }
        utwory.push({ ...u, istnieje: jest });
    }
    return { projekt, utwory, role: ROLE };
}

/** Wepnij utwór w projekt. Ten sam plik w tej samej roli nie dubluje się. */
export async function dodajUtwor(katalog, projekt, dane = {}) {
    const sciezka = String(dane.sciezka || '').trim();
    if (!sciezka) throw new Error('Brak ścieżki utworu.');
    try { await fs.access(sciezka); } catch { throw new Error(`Nie widzę pliku: ${sciezka}`); }

    const rola = ROLE.some((r) => r.id === dane.rola) ? dane.rola : 'scena';
    const d = await wczytaj(katalog, projekt);

    const juz = d.utwory.find((u) => u.sciezka === sciezka && u.rola === rola && (u.odcinekId ?? null) === (dane.odcinekId ?? null));
    if (juz) return { utwor: juz, duplikat: true };

    const metryka = await opisUtworu(sciezka);
    const utwor = {
        id: `utw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        nazwa: String(dane.nazwa || path.basename(sciezka)).slice(0, 120),
        sciezka,
        rola,
        // `null` = utwór dla całego projektu, a nie dla jednego odcinka.
        odcinekId: dane.odcinekId ? String(dane.odcinekId) : null,
        notatka: String(dane.notatka || '').trim().slice(0, 300),
        ...metryka,
        kiedy: new Date().toISOString(),
    };
    d.utwory.push(utwor);
    await zapisz(katalog, projekt, d);
    return { utwor, duplikat: false };
}

export async function usunUtwor(katalog, projekt, id) {
    const d = await wczytaj(katalog, projekt);
    const i = d.utwory.findIndex((u) => u.id === id);
    if (i < 0) throw new Error(`Utwór "${id}" nie jest wpięty w ten projekt.`);
    const [usuniety] = d.utwory.splice(i, 1);
    await zapisz(katalog, projekt, d);
    // ⚠️ Kasujemy WPIS, nie plik. Utwór Joanny zostaje w bibliotece Katedry.
    return { utwor: usuniety, plikZostal: usuniety.sciezka };
}

export default { ROLE, bibliotekaKatedry, muzykaProjektu, dodajUtwor, usunUtwor, opisUtworu };
