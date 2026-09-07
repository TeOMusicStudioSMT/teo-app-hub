/**
 * 🏷️ Produkty — co jeszcze może powstać z tej marki.
 *
 * PO CO. Suweren: „możliwość stworzenia innych produktów do powstałej marki
 * i możliwości z Blenderem".
 *
 * Uniwersum ma filary i motywy. Z nich wyprowadza się produkty: rzeczy,
 * które da się zrobić TYMI narzędziami, którymi Katedra dysponuje —
 * a nie życzenia w rodzaju „serial aktorski w Netfliksie".
 *
 * ⚠️ KAŻDY PRODUKT MA POWIEDZIEĆ, CZYM GO ZROBIĆ. Prompt wymusza pole
 * `czym` z listy realnych narzędzi Katedry. Produkt bez ścieżki wykonania
 * to nie plan, tylko marzenie — a marzeń Suweren nie zamawiał.
 */

import fs from 'fs/promises';
import path from 'path';
import { slug, utworzProjekt } from './Produkcje.js';

const PLIK = 'produkty.json';

/**
 * Narzędzia, którymi Katedra NAPRAWDĘ dysponuje. Lista zamknięta — model
 * ma wybierać z niej, a nie wymyślać fabryki, których nie ma.
 */
export const NARZEDZIA = [
    { id: 'wideo', nazwa: 'Wan 2.2 — ujęcia wideo', co: 'krótkie sceny, zwiastuny, pętle' },
    { id: 'blender', nazwa: 'Blender — sceny 3D i render', co: 'plany zdjęciowe, obiekty, animacje kamery' },
    { id: 'glb', nazwa: 'Eksport .glb do TeO Game Studio', co: 'scenografie do gier i prezentacji w przeglądarce' },
    { id: 'muzyka', nazwa: 'Joanna — muzyka', co: 'motywy, podkłady, sygnały dźwiękowe' },
    { id: 'obraz', nazwa: 'ComfyUI — obrazy', co: 'plakaty, karty postaci, grafiki' },
    { id: 'tekst', nazwa: 'Ollama — tekst', co: 'opowiadania, scenariusze, opisy' },
    { id: 'glos', nazwa: 'Głosek — lektor', co: 'słuchowiska, narracja, zapowiedzi' },
];

const sciezka = (katalog, projekt) => {
    const s = slug(projekt);
    if (!s) throw new Error('Projekt bez nazwy.');
    return path.join(katalog, 'produkcje', s, PLIK);
};

export async function wczytaj(katalog, projekt) {
    try {
        const d = JSON.parse(await fs.readFile(sciezka(katalog, projekt), 'utf8'));
        return Array.isArray(d.produkty) ? d : { projekt, produkty: [] };
    } catch { return { projekt, produkty: [] }; }
}

async function zapisz(katalog, projekt, dane) {
    const { sciezka: kat } = await utworzProjekt(katalog, projekt);
    await fs.writeFile(path.join(kat, PLIK), JSON.stringify(dane, null, 2), 'utf8');
    return dane;
}

export function promptProduktow({ uniwersum, kanon = [], ile = 5 }) {
    const system = [
        'Jesteś PRODUCENTEM wymyślającym, co jeszcze może powstać z tej marki.',
        'Odpowiadasz po polsku, WYŁĄCZNIE tablicą JSON, bez komentarza i bez płotu z backticków.',
        '',
        `[{"nazwa":"…","rodzaj":"…","opis":"…","dlaKogo":"…","czym":"id narzędzia"}, …]`,
        '',
        'NARZĘDZIA, KTÓRYMI TO MA POWSTAĆ (pole "czym" MUSI być jednym z tych id):',
        ...NARZEDZIA.map((n) => `  ${n.id} — ${n.nazwa}: ${n.co}`),
        '',
        'ŻELAZNE ZASADY:',
        '1. Produkt ma wyrastać z FILARÓW uniwersum, nie z ogólnych trendów.',
        '2. Ma dać się zrobić WSKAZANYM narzędziem. Nic, co wymaga ekipy filmowej,',
        '   fabryki albo licencji, których nie ma.',
        `3. Dokładnie ${ile} produktów, każdy inny co do rodzaju.`,
        '4. "dlaKogo" to konkretny odbiorca, nie „wszyscy".',
    ].join('\n');

    const prompt = [
        `UNIWERSUM: ${uniwersum.domena} — ${uniwersum.zdanie}`,
        uniwersum.filary?.length ? `FILARY:\n${uniwersum.filary.map((f) => `- ${f}`).join('\n')}` : '',
        uniwersum.motywy?.length ? `MOTYWY: ${uniwersum.motywy.join(', ')}` : '',
        kanon.length ? `\nKANON:\n${kanon.slice(0, 10).map((f) => `- ${f}`).join('\n')}` : '',
        `\nWymyśl ${ile} produktów. Sama tablica JSON.`,
    ].filter(Boolean).join('\n');

    return { system, prompt };
}

export function odczytaj(surowe, ile = 5) {
    const t = String(surowe || '');
    const a = t.indexOf('['); const b = t.lastIndexOf(']');
    if (a < 0 || b <= a) throw new Error(`Model nie oddał tablicy JSON. Dostałem: ${t.slice(0, 200)}`);
    let d;
    try { d = JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error(`Lista produktów to niepoprawny JSON: ${e.message}`); }
    if (!Array.isArray(d) || !d.length) throw new Error('Model oddał pustą listę produktów.');

    return d.slice(0, Math.max(1, ile)).map((p, i) => {
        const czym = String(p?.czym || '').trim().toLowerCase();
        return {
            id: `prod-${Date.now().toString(36)}-${i}`,
            nazwa: String(p?.nazwa || '').trim().slice(0, 90),
            rodzaj: String(p?.rodzaj || '').trim().slice(0, 60),
            opis: String(p?.opis || '').trim().slice(0, 600),
            dlaKogo: String(p?.dlaKogo || '').trim().slice(0, 200),
            // ⚠️ Nieznane narzędzie NIE jest przepuszczane jako „coś tam".
            // `null` znaczy: model wskazał coś, czego Katedra nie ma.
            czym: NARZEDZIA.some((n) => n.id === czym) ? czym : null,
            stan: 'pomysł',
            kiedy: new Date().toISOString(),
        };
    }).filter((p) => p.nazwa.length >= 3 && p.opis.length >= 10);
}

/** Dopisz produkty do projektu. Duplikaty po nazwie pomijamy. */
export async function dopisz(katalog, projekt, produkty) {
    const d = await wczytaj(katalog, projekt);
    const znane = new Set(d.produkty.map((p) => p.nazwa.toLowerCase()));
    const nowe = produkty.filter((p) => !znane.has(p.nazwa.toLowerCase()));
    d.produkty.push(...nowe);
    d.projekt = projekt;
    await zapisz(katalog, projekt, d);
    return { dodane: nowe, pominiete: produkty.length - nowe.length, wszystkie: d.produkty };
}

/** Zmień stan produktu: pomysł → w robocie → gotowy → odrzucony. */
export const STANY = ['pomysł', 'w robocie', 'gotowy', 'odrzucony'];

export async function zmienStan(katalog, projekt, id, stan) {
    if (!STANY.includes(stan)) throw new Error(`Nieznany stan „${stan}". Dozwolone: ${STANY.join(', ')}.`);
    const d = await wczytaj(katalog, projekt);
    const p = d.produkty.find((x) => x.id === id);
    if (!p) throw new Error(`Produkt "${id}" nie istnieje.`);
    p.stan = stan;
    p.zmieniono = new Date().toISOString();
    await zapisz(katalog, projekt, d);
    return p;
}

export default { NARZEDZIA, STANY, wczytaj, promptProduktow, odczytaj, dopisz, zmienStan };
