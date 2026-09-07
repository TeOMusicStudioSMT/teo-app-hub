/**
 * 🌌 Uniwersum — „Blender Blendera": to, co zblendowane ze wszystkiego,
 * tworzy własną domenę.
 *
 * PO CO. Suweren: „Blender Blendera — blenduje wszystko, co tworzy unikalną
 * domenę, jak własne uniwersum. Zakłada projekt jednorazowo po pierwszym
 * odcinku, kataloguje, pomysłowuje rozwinięcia bo jest na bieżąco, rozpisuje
 * kampanie rozwijające, czym zapisuje i przekazuje dalej do punktu 1 — czyli
 * reżysera i realizacji kolejnego odcinka".
 *
 * PĘTLA, KTÓRĄ TO ZAMYKA:
 *   odcinek → uniwersum widzi, co powstało → wymyśla rozwinięcia →
 *   rozpisuje kampanię → odcinki wracają do Reżysera → realizacja → …
 *
 * ⚠️ ZAKŁADANE RAZ, POTEM TYLKO DOPISYWANE. Domena serialu nie może zmieniać
 * się przy każdym kliknięciu — inaczej trzeci odcinek dzieje się w innym
 * świecie niż pierwszy. `zaloz()` odmawia, gdy uniwersum już jest;
 * od rozwijania jest `rozwin()`.
 *
 * ⚠️ „JEST NA BIEŻĄCO" ZNACZY: CZYTA STAN, NIE PAMIĘTA GO. Przy każdym
 * rozwinięciu bierze aktualny kanon, odcinki i kadry z dysku. Model, który
 * „pamięta" świat między wywołaniami, to model, który go zmyśla.
 */

import fs from 'fs/promises';
import path from 'path';
import { slug, utworzProjekt } from './Produkcje.js';

const PLIK = 'uniwersum.json';

const sciezka = (katalog, projekt) => {
    const s = slug(projekt);
    if (!s) throw new Error('Projekt bez nazwy.');
    return path.join(katalog, 'produkcje', s, PLIK);
};

export async function wczytaj(katalog, projekt) {
    try {
        const d = JSON.parse(await fs.readFile(sciezka(katalog, projekt), 'utf8'));
        return d && typeof d === 'object' ? d : null;
    } catch { return null; }
}

async function zapisz(katalog, projekt, dane) {
    const { sciezka: kat } = await utworzProjekt(katalog, projekt);
    await fs.writeFile(path.join(kat, PLIK), JSON.stringify(dane, null, 2), 'utf8');
    return dane;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ZAŁOŻENIE DOMENY — raz, po pierwszym odcinku
// ══════════════════════════════════════════════════════════════════════════════

export function promptZalozenia({ projekt, kanon = [], odcinki = [] }) {
    const system = [
        'Jesteś STRAŻNIKIEM UNIWERSUM. Z tego, co już powstało, wyprowadzasz DOMENĘ:',
        'to, co odróżnia ten świat od każdego innego. Odpowiadasz po polsku,',
        'WYŁĄCZNIE obiektem JSON, bez komentarza i bez płotu z backticków.',
        '',
        '{',
        '  "domena": "nazwa uniwersum — 2-4 słowa",',
        '  "zdanie": "jedno zdanie, które oddaje czym ten świat jest",',
        '  "filary": ["rzecz, bez której to przestaje być TEN świat", …],',
        '  "motywy": ["powracający obraz albo temat", …],',
        '  "ton": "jak to ma smakować widzowi"',
        '}',
        '',
        'ŻELAZNE ZASADY:',
        '1. FILARY wyprowadzasz z tego, co JUŻ jest w kanonie i odcinkach.',
        '   Nie dokładasz świata, o którym nikt nie napisał.',
        '2. Filar to rzecz SPRAWDZALNA („mechanik ratuje wygasające roboty"),',
        '   nie nastrój („świat pełen emocji").',
        '3. 3 do 5 filarów. Więcej znaczy, że nie wybrałeś.',
    ].join('\n');

    const prompt = [
        `PROJEKT: ${projekt}`,
        kanon.length ? `\n— KANON —\n${kanon.map((f) => `- ${f}`).join('\n')}` : '',
        odcinki.length ? `\n— ODCINKI —\n${odcinki.map((o) => `#${o.numer} ${o.tytul}: ${o.streszczenie}`).join('\n')}` : '',
        '\nWyprowadź domenę tego uniwersum. Sam JSON.',
    ].filter(Boolean).join('\n');

    return { system, prompt };
}

export function odczytajZalozenie(surowe) {
    const t = String(surowe || '');
    const a = t.indexOf('{'); const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error(`Model nie oddał obiektu JSON. Dostałem: ${t.slice(0, 200)}`);
    let d;
    try { d = JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error(`Uniwersum to niepoprawny JSON: ${e.message}`); }

    const lista = (x, ile) => (Array.isArray(x) ? x : [])
        .map((v) => String(typeof v === 'string' ? v : v?.tresc || '').trim())
        .filter((v) => v.length >= 6).slice(0, ile);

    const domena = String(d.domena || d.nazwa || '').trim().slice(0, 80);
    if (domena.length < 2) throw new Error('Model nie nazwał domeny.');

    return {
        domena,
        zdanie: String(d.zdanie || '').trim().slice(0, 300),
        filary: lista(d.filary, 5),
        motywy: lista(d.motywy, 8),
        ton: String(d.ton || '').trim().slice(0, 200),
    };
}

/** Załóż uniwersum. RAZ — potem tylko rozwijamy. */
export async function zaloz(katalog, projekt, wyprowadzone) {
    const juz = await wczytaj(katalog, projekt);
    if (juz) throw new Error(`Uniwersum „${juz.domena}" już istnieje dla tego projektu. Od rozwijania jest osobna akcja.`);

    return zapisz(katalog, projekt, {
        projekt,
        ...wyprowadzone,
        zalozone: new Date().toISOString(),
        kampanie: [],
    });
}

// ══════════════════════════════════════════════════════════════════════════════
//  ROZWINIĘCIA — kampania, która wraca do Reżysera
// ══════════════════════════════════════════════════════════════════════════════

export function promptRozwiniecia({ uniwersum, kanon = [], odcinki = [], ile = 3 }) {
    const system = [
        'Jesteś STRAŻNIKIEM UNIWERSUM planującym, co dalej. Odpowiadasz po polsku,',
        'WYŁĄCZNIE obiektem JSON, bez komentarza i bez płotu z backticków.',
        '',
        '{',
        '  "kampania": "nazwa łuku fabularnego — 2-5 słów",',
        '  "cel": "co ten łuk ma zmienić w świecie albo w bohaterze",',
        `  "odcinki": [{"tytul":"…","streszczenie":"co się dzieje","czasMinut":3,"styl":"jak to wygląda"}, …]`,
        '}',
        '',
        'ŻELAZNE ZASADY:',
        '1. Kampania ROZWIJA filary uniwersum, nie zaczyna nowego świata.',
        '2. Odcinki mają iść PO tych, które już były — nie powtarzaj ich akcji.',
        `3. Dokładnie ${ile} odcinków, każdy z własnym zwrotem akcji.`,
        '4. `czasMinut` to liczba (1-30). `styl` opisuje OBRAZ.',
    ].join('\n');

    const prompt = [
        `UNIWERSUM: ${uniwersum.domena} — ${uniwersum.zdanie}`,
        uniwersum.filary?.length ? `FILARY:\n${uniwersum.filary.map((f) => `- ${f}`).join('\n')}` : '',
        uniwersum.ton ? `TON: ${uniwersum.ton}` : '',
        kanon.length ? `\n— KANON —\n${kanon.map((f) => `- ${f}`).join('\n')}` : '',
        odcinki.length ? `\n— CO JUŻ BYŁO —\n${odcinki.map((o) => `#${o.numer} ${o.tytul}: ${o.streszczenie}`).join('\n')}` : '(jeszcze nic)',
        `\nRozpisz kampanię na ${ile} kolejnych odcinków. Sam JSON.`,
    ].filter(Boolean).join('\n');

    return { system, prompt };
}

export function odczytajRozwiniecie(surowe, ile = 3) {
    const t = String(surowe || '');
    const a = t.indexOf('{'); const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error(`Model nie oddał obiektu JSON. Dostałem: ${t.slice(0, 200)}`);
    let d;
    try { d = JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error(`Kampania to niepoprawny JSON: ${e.message}`); }

    const odcinki = (Array.isArray(d.odcinki) ? d.odcinki : []).map((o) => {
        const czas = Number(o?.czasMinut ?? o?.czas);
        return {
            tytul: String(o?.tytul || '').trim().slice(0, 90),
            streszczenie: String(o?.streszczenie || o?.opis || '').trim(),
            czasMinut: Number.isFinite(czas) && czas > 0 && czas <= 30 ? czas : null,
            styl: String(o?.styl || '').trim().slice(0, 200),
            status: 'plan',
        };
    }).filter((o) => o.tytul.length >= 3 && o.streszczenie.length >= 10).slice(0, Math.max(1, ile));

    if (!odcinki.length) throw new Error('Model nie oddał ani jednego odcinka kampanii.');

    return {
        kampania: String(d.kampania || 'Kampania').trim().slice(0, 80),
        cel: String(d.cel || '').trim().slice(0, 300),
        odcinki,
    };
}

/** Dopisz kampanię do uniwersum — ślad po tym, co i kiedy zaplanowano. */
export async function dopiszKampanie(katalog, projekt, kampania, idOdcinkow = []) {
    const u = await wczytaj(katalog, projekt);
    if (!u) throw new Error('To uniwersum jeszcze nie istnieje — najpierw je załóż.');
    u.kampanie = Array.isArray(u.kampanie) ? u.kampanie : [];
    u.kampanie.push({
        nazwa: kampania.kampania,
        cel: kampania.cel,
        odcinkow: idOdcinkow.length,
        odcinki: idOdcinkow,
        kiedy: new Date().toISOString(),
    });
    return zapisz(katalog, projekt, u);
}

export default {
    wczytaj, zaloz, dopiszKampanie,
    promptZalozenia, odczytajZalozenie,
    promptRozwiniecia, odczytajRozwiniecie,
};
