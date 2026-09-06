/**
 * 🎬 Produkcje — katalogi projektów i PRAWDZIWY zapis odcinków.
 *
 * ⚠️ CO NAPRAWIA. Reżyser meldował „odcinek domknięty", a na dysku nie
 * pojawiało się NIC — cała robota szła do jednego wspólnego
 * `rezyser_pamiec.json` jako trzy pola tekstowe. Z punktu widzenia Suwerena
 * wyglądało to jak atrapa: komunikat był, materiału nie było.
 *
 * Od teraz projekt to KATALOG na dysku:
 *
 *     _OtakOs_Wymiar/produkcje/<slug>/
 *         projekt.json                  ← nazwa, data założenia, notatka
 *         odcinki/
 *             001-nazwa-odcinka/
 *                 odcinek.md            ← streszczenie + kanon + lista kadrów
 *                 odcinek.json          ← te same dane maszynowo
 *                 (tu lądują materiały: kadry, ujęcia, montaż)
 *
 * Plik `odcinek.md` można otworzyć, wydrukować i wysłać — istnieje naprawdę.
 *
 * ⚠️ PAMIĘĆ ZOSTAJE ŹRÓDŁEM PRAWDY dla kanonu. Katalog jest MATERIALIZACJĄ,
 * nie drugą bazą — inaczej mielibyśmy dwa rejestry odcinków, które po
 * pierwszej ręcznej zmianie na dysku rozjechałyby się na zawsze.
 *
 * ⚠️ NAZWA KATALOGU IDZIE PRZEZ `slug()`. Nazwa projektu przychodzi z pola
 * tekstowego, a most bywa wystawiony przez Kwantowy Tunel — „../../.ssh"
 * jako nazwa serialu zapisałby pliki poza Katedrą. Slug przepuszcza wyłącznie
 * [a-z0-9-] i jest sprawdzany PONOWNIE przy każdym użyciu, nie tylko przy
 * tworzeniu.
 */

import fs from 'fs/promises';
import path from 'path';
import { lista as listaKadrow } from './ProdukcjaService.js';
import { listaSeriali } from './RezyserService.js';

const KATALOG = 'produkcje';
const PLIK_PROJEKTU = 'projekt.json';

/** Polskie znaki → ASCII. Bez tego „Café Martens" dałoby katalog „caf-martens". */
const OGONKI = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };

export function slug(nazwa) {
    return String(nazwa || '')
        .toLowerCase()
        .replace(/[ąćęłńóśźż]/g, (z) => OGONKI[z] ?? z)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // znaki laczace po rozkladzie
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

/**
 * Ścieżka katalogu projektu — z POWTÓRNYM sprawdzeniem sluga.
 * Wołający potrafi podać slug prosto z URL-a; jedno sprawdzenie przy
 * tworzeniu by nie wystarczyło.
 */
function sciezkaProjektu(katalog, s) {
    if (!/^[a-z0-9-]+$/.test(String(s || ''))) {
        throw new Error(`Nieprawidłowy identyfikator projektu: "${s}".`);
    }
    return path.join(katalog, KATALOG, s);
}

async function czyJest(p) {
    try { await fs.access(p); return true; } catch { return false; }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PROJEKTY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Lista projektów — złożona z TRZECH źródeł, bo do tej pory każde żyło osobno:
 * katalogi na dysku, pamięć Reżysera (fakty/odcinki) i Tablica Produkcji (kadry).
 * Projekt widziany tylko przez jedno z nich to nie błąd, tylko starszy stan —
 * pokazujemy go i mówimy, czego mu brakuje (`katalog: false`).
 */
export async function listaProjektow(katalog) {
    const wpisy = new Map();
    const wez = (nazwa) => {
        const s = slug(nazwa);
        if (!s) return null;
        if (!wpisy.has(s)) {
            wpisy.set(s, {
                slug: s, nazwa, katalog: false, sciezka: null, utworzono: null,
                notatka: '', faktow: 0, odcinkow: 0, kadrow: 0,
            });
        }
        return wpisy.get(s);
    };

    // 1. Katalogi na dysku
    const korzen = path.join(katalog, KATALOG);
    let nazwy = [];
    try {
        nazwy = (await fs.readdir(korzen, { withFileTypes: true }))
            .filter((d) => d.isDirectory()).map((d) => d.name);
    } catch { /* katalogu jeszcze nie ma — to nie błąd */ }

    for (const n of nazwy) {
        let meta = {};
        try { meta = JSON.parse(await fs.readFile(path.join(korzen, n, PLIK_PROJEKTU), 'utf8')); } catch { /* bez metryki */ }
        const w = wez(meta.nazwa || n);
        if (!w) continue;
        w.katalog = true;
        w.sciezka = path.join(korzen, n);
        w.utworzono = meta.utworzono ?? null;
        w.notatka = meta.notatka ?? '';
    }

    // 2. Pamięć Reżysera
    for (const s of await listaSeriali(katalog)) {
        const w = wez(s.serial);
        if (!w) continue;
        w.faktow = s.faktow;
        w.odcinkow = s.odcinkow;
    }

    // 3. Tablica Produkcji
    try {
        for (const k of await listaKadrow(katalog)) {
            const w = wez(k.projekt || '');
            if (w) w.kadrow += 1;
        }
    } catch { /* brak tablicy */ }

    return [...wpisy.values()].sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
}

/** Załóż katalog projektu. Idempotentne: istniejący katalog nie jest błędem. */
export async function utworzProjekt(katalog, nazwa, notatka = '') {
    const n = String(nazwa || '').trim();
    if (n.length < 2) throw new Error('Nazwa projektu jest za krótka (min. 2 znaki).');
    const s = slug(n);
    if (!s) throw new Error(`Z nazwy "${n}" nie da się zrobić nazwy katalogu — użyj liter lub cyfr.`);

    const sciezka = sciezkaProjektu(katalog, s);
    const bylo = await czyJest(sciezka);
    await fs.mkdir(path.join(sciezka, 'odcinki'), { recursive: true });
    if (!bylo) {
        await fs.writeFile(
            path.join(sciezka, PLIK_PROJEKTU),
            JSON.stringify({ nazwa: n, slug: s, utworzono: new Date().toISOString(), notatka }, null, 2),
            'utf8',
        );
    }
    return { slug: s, nazwa: n, sciezka, nowy: !bylo };
}

/**
 * Usuń katalog projektu — TYLKO PUSTY.
 *
 * ⚠️ Świadomie NIE ma tu kasowania rekurencyjnego. Usunięcie katalogu z
 * odcinkami i materiałami jednym kliknięciem w przeglądarce (wystawionej
 * przez tunel na telefon) to dokładnie ta operacja, po której nie ma powrotu.
 * Projekt z zawartością zgłasza odmowę i mówi, co w nim jest.
 */
export async function usunProjekt(katalog, s) {
    const sciezka = sciezkaProjektu(katalog, s);
    if (!await czyJest(sciezka)) throw new Error(`Katalog projektu "${s}" nie istnieje.`);

    let odcinki = [];
    try { odcinki = await fs.readdir(path.join(sciezka, 'odcinki')); } catch { /* brak */ }
    if (odcinki.length) {
        throw new Error(
            `Projekt "${s}" ma ${odcinki.length} odcinek/odcinków na dysku — nie kasuję. `
            + `Usuń je najpierw albo skasuj katalog ręcznie: ${sciezka}`,
        );
    }
    await fs.rm(path.join(sciezka, 'odcinki'), { recursive: true, force: true });
    await fs.rm(path.join(sciezka, PLIK_PROJEKTU), { force: true });
    const reszta = await fs.readdir(sciezka);
    if (reszta.length) {
        throw new Error(`W katalogu został materiał (${reszta.join(', ')}) — kasuj ręcznie: ${sciezka}`);
    }
    await fs.rmdir(sciezka);
    return { slug: s, sciezka };
}

// ══════════════════════════════════════════════════════════════════════════════
//  ODCINKI NA DYSKU
// ══════════════════════════════════════════════════════════════════════════════

const nazwaKatalogu = (odcinek) =>
    `${String(odcinek.numer).padStart(3, '0')}-${slug(odcinek.tytul) || 'odcinek'}`;

/** Katalog odcinka — zakładany na żądanie, nie przy okazji odczytu. */
export async function katalogOdcinka(katalog, projekt, odcinek, tworz = false) {
    const s = slug(projekt);
    if (!s) throw new Error('Projekt bez nazwy — nie wiem, gdzie zapisać odcinek.');
    const sciezka = path.join(sciezkaProjektu(katalog, s), 'odcinki', nazwaKatalogu(odcinek));
    if (tworz) await fs.mkdir(sciezka, { recursive: true });
    return sciezka;
}

/**
 * Zmaterializuj odcinek: `odcinek.md` (do czytania) + `odcinek.json` (dla maszyny).
 * Zwraca ścieżkę i rozmiar — front pokazuje DOWÓD, nie komunikat.
 */
export async function zapiszOdcinek(katalog, projekt, odcinek, { fakty = [], kadry = [] } = {}) {
    await utworzProjekt(katalog, projekt);
    const sciezka = await katalogOdcinka(katalog, projekt, odcinek, true);

    const linie = [
        `# Odcinek ${odcinek.numer}: ${odcinek.tytul}`,
        '',
        `**Projekt:** ${projekt}  `,
        `**Status:** ${odcinek.status ?? 'zrealizowany'}  `,
        `**Zapisany:** ${new Date(odcinek.kiedy ?? Date.now()).toLocaleString('pl-PL')}`,
        '',
        '## Streszczenie',
        '',
        odcinek.streszczenie || '_(brak)_',
        '',
    ];

    // Zapisujemy MIGAWKĘ kanonu z chwili domknięcia. Kanon rośnie; bez migawki
    // nie dałoby się później odtworzyć, co obowiązywało, gdy odcinek powstawał.
    if (fakty.length) {
        linie.push('## Kanon obowiązujący w tym odcinku', '');
        for (const f of fakty) linie.push(`- ${f.tresc}`);
        linie.push('');
    }

    linie.push('## Kadry z Tablicy Produkcji', '');
    if (kadry.length) {
        for (const k of kadry) linie.push(`- **${k.tytul || k.id}** — etap ${k.etap}, stan ${k.stan}`);
    } else {
        linie.push('_Żaden kadr nie był przypisany do tego projektu w chwili zapisu._');
    }
    linie.push('');

    const md = linie.join('\n');
    await fs.writeFile(path.join(sciezka, 'odcinek.md'), md, 'utf8');
    await fs.writeFile(
        path.join(sciezka, 'odcinek.json'),
        JSON.stringify({ ...odcinek, projekt, fakty, kadry }, null, 2),
        'utf8',
    );
    return { sciezka, plik: path.join(sciezka, 'odcinek.md'), bajtow: Buffer.byteLength(md, 'utf8') };
}

/**
 * Co NAPRAWDĘ leży w katalogu odcinka. Front pokazuje tę listę zamiast
 * obiecywać — jeśli jest pusta, znaczy, że materiału nie ma i tyle.
 */
export async function materialyOdcinka(katalog, projekt, odcinek) {
    let sciezka;
    try { sciezka = await katalogOdcinka(katalog, projekt, odcinek, false); } catch { return { sciezka: null, pliki: [] }; }
    try {
        const wpisy = await fs.readdir(sciezka, { withFileTypes: true });
        const pliki = [];
        for (const w of wpisy) {
            if (!w.isFile()) { pliki.push({ nazwa: w.name, bajtow: null, katalog: true }); continue; }
            const st = await fs.stat(path.join(sciezka, w.name));
            pliki.push({ nazwa: w.name, bajtow: st.size, katalog: false });
        }
        return { sciezka, pliki };
    } catch {
        return { sciezka, pliki: [] };
    }
}

export default {
    slug, listaProjektow, utworzProjekt, usunProjekt,
    katalogOdcinka, zapiszOdcinek, materialyOdcinka,
};
