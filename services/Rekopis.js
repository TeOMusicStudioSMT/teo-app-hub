/**
 * ✒️ Rekopis — miejsce, gdzie opowieść zostaje NAPISANA.
 *
 * PO CO. Suweren: „Story V2 musi mieć też moduł pisania opowieści". Pokój
 * Opowieści służy do WYMYŚLANIA w rozmowie, Reżyser trzyma kanon i odcinki,
 * Tablica rozbija to na kadry — ale między pomysłem a kadrem brakowało miejsca
 * na prozę. Tu się ją pisze.
 *
 * SKĄD WZORZEC. Z repo `hughhowey/neo` (MIT) — edytor powieści napisany przez
 * powieściopisarza. Sklonowane i przeczytane. Bierzemy z niego POMYSŁY, nie kod:
 *   · rozdział to osobny plik, książka to katalog — nie jeden wielki dokument,
 *     który przy awarii ginie w całości;
 *   · Enter / Enter / Enter — akapit, przerwa scenowa, nowy rozdział, bez
 *     odrywania rąk od klawiatury;
 *   · „darlings" — wycięty fragment nie ginie, wraca dokładnie tam, skąd wyszedł;
 *   · znaczniki — brak nazwy albo faktu nie zatrzymuje pisania, zostaje kropka
 *     do odwiedzenia później;
 *   · konspekt, którego notatki wchodzą do rękopisu jako szare duchy do nadpisania.
 *
 * ⚠️ RĘKOPIS NALEŻY DO PROJEKTU, tak jak assety. Powieść „alchemicznej
 * fluktuacji" nie ma czego szukać w Cafe Martens.
 *
 * ⚠️ ROZDZIAŁ TO OSOBNY PLIK. Jeden plik na całą książkę oznacza, że przerwany
 * zapis kosztuje CAŁĄ powieść. Tak samo zapis meta jest atomowy (tmp → rename).
 *
 * ⚠️ NIE GENERUJEMY TU PROZY ZA SUWERENA. Model pomaga na żądanie (konspekt,
 * podpowiedź), ale rękopis pisze człowiek — moduł, który sam dopisuje akapity,
 * po tygodniu daje książkę, której nikt nie napisał.
 *
 * ⚠️ …Z JEDNYM JAWNYM WYJĄTKIEM: Skryba (services/Skryba.js) spisuje z Opowieści
 * scenariusz i prozę DO tego rękopisu — bo między rozmową a tekstem nie było
 * nikogo, kto by przeniósł ustaloną historię (zmierzone: rozdział 0 bajtów).
 * Każdy jego rozdział nosi w tytule „[szkic AI]" i stopkę z silnikiem, więc
 * zasada wyżej nadal trzyma: ten plik nie pisze, a co napisał agent, jest
 * podpisane. Rekopis.js pozostaje edytorem człowieka.
 */

import fs from 'fs/promises';
import path from 'path';
import { utworzProjekt } from './Produkcje.js';

const META = 'rekopis.json';
const KAT_ROZDZIALOW = 'rozdzialy';

/** Katalog rękopisu w projekcie. */
export async function katalog(katalogKatedry, projekt) {
    const { sciezka } = await utworzProjekt(katalogKatedry, projekt);
    const kat = path.join(sciezka, 'rekopis');
    await fs.mkdir(path.join(kat, KAT_ROZDZIALOW), { recursive: true });
    return kat;
}

function pustyRekopis() {
    return {
        tytul: '',
        podtytul: '',
        autor: '',
        celSlow: 0,
        kolejnosc: [],           // identyfikatory rozdziałów, w kolejności czytania
        tytulyRozdzialow: {},    // id → tytuł
        notatkiSekcji: {},       // id rozdziału → [{ id, tekst }] — duchy konspektu
        wyciety: [],             // „darlings": fragmenty wyjęte, ale zachowane
        znaczniki: [],           // miejsca do dokończenia
        utworzono: new Date().toISOString(),
        zmieniono: new Date().toISOString(),
    };
}

async function czytajMeta(kat) {
    try {
        const d = JSON.parse(await fs.readFile(path.join(kat, META), 'utf8'));
        return { ...pustyRekopis(), ...d };
    } catch { return pustyRekopis(); }
}

/** ⚠️ Zapis atomowy — przerwany w połowie kosztowałby spis treści całej książki. */
async function zapiszMeta(kat, meta) {
    meta.zmieniono = new Date().toISOString();
    const cel = path.join(kat, META);
    const tmp = `${cel}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(meta, null, 2), 'utf8');
    await fs.rename(tmp, cel);
    return meta;
}

const idRozdzialu = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** ⚠️ Straż nazwy pliku: identyfikator wchodzi do ścieżki, więc tylko [a-z0-9-]. */
function bezpieczneId(id) {
    const c = String(id || '').trim();
    if (!/^[a-z0-9-]{3,40}$/i.test(c)) throw new Error(`Niepoprawny identyfikator rozdziału: „${c}".`);
    return c;
}

async function czytajRozdzial(kat, id) {
    try { return await fs.readFile(path.join(kat, KAT_ROZDZIALOW, `${bezpieczneId(id)}.html`), 'utf8'); }
    catch { return ''; }
}

async function zapiszRozdzial(kat, id, tresc) {
    await fs.writeFile(path.join(kat, KAT_ROZDZIALOW, `${bezpieczneId(id)}.html`), String(tresc ?? ''), 'utf8');
}

/**
 * Policz słowa w HTML rozdziału.
 * ⚠️ Znaczniki HTML wycinamy PRZED liczeniem — inaczej `<p>` liczyłoby się jako
 * słowo i licznik postępu kłamałby o kilkanaście procent.
 */
export function policzSlowa(html) {
    const tekst = String(html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/gi, '')
        .trim();
    if (!tekst) return 0;
    return tekst.split(/\s+/).filter(Boolean).length;
}

/** Cały rękopis: meta + treść rozdziałów + liczniki. */
export async function wczytaj(katalogKatedry, projekt) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);

    const rozdzialy = [];
    for (const id of meta.kolejnosc) {
        const tresc = await czytajRozdzial(kat, id);
        rozdzialy.push({
            id,
            tytul: meta.tytulyRozdzialow[id] ?? '',
            tresc,
            slow: policzSlowa(tresc),
            notatki: meta.notatkiSekcji[id] ?? [],
            znacznikow: meta.znaczniki.filter((z) => z.rozdzial === id).length,
        });
    }

    const slow = rozdzialy.reduce((s, r) => s + r.slow, 0);
    return {
        ...meta,
        rozdzialy,
        slow,
        // Postęp tylko wtedy, gdy cel ustawiony — pasek „0% z 0" nic nie mówi.
        postep: meta.celSlow > 0 ? Math.min(100, Math.round((slow / meta.celSlow) * 100)) : null,
        sciezka: kat,
    };
}

export async function zmienMeta(katalogKatedry, projekt, zmiany = {}) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    for (const pole of ['tytul', 'podtytul', 'autor']) {
        if (zmiany[pole] !== undefined) meta[pole] = String(zmiany[pole]).slice(0, 200);
    }
    if (zmiany.celSlow !== undefined) {
        const c = Number(zmiany.celSlow);
        meta.celSlow = Number.isFinite(c) && c >= 0 ? Math.min(c, 2_000_000) : 0;
    }
    return zapiszMeta(kat, meta);
}

/**
 * Nowy rozdział. `poId` wstawia go ZARAZ ZA wskazanym — trzeci Enter w środku
 * książki ma dawać rozdział w tym miejscu, nie na końcu.
 */
export async function dodajRozdzial(katalogKatedry, projekt, { tytul = '', poId = null, tresc = '' } = {}) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    const id = idRozdzialu();

    const gdzie = poId ? meta.kolejnosc.indexOf(poId) : -1;
    if (gdzie >= 0) meta.kolejnosc.splice(gdzie + 1, 0, id);
    else meta.kolejnosc.push(id);

    meta.tytulyRozdzialow[id] = String(tytul).slice(0, 200);
    await zapiszRozdzial(kat, id, tresc);
    await zapiszMeta(kat, meta);
    return { id, tytul: meta.tytulyRozdzialow[id], tresc, slow: policzSlowa(tresc) };
}

export async function zapiszTresc(katalogKatedry, projekt, id, tresc) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    if (!meta.kolejnosc.includes(id)) throw new Error(`Nie znam rozdziału „${id}".`);
    await zapiszRozdzial(kat, id, tresc);
    await zapiszMeta(kat, meta);   // odświeża `zmieniono`
    return { id, slow: policzSlowa(tresc) };
}

export async function zmienTytulRozdzialu(katalogKatedry, projekt, id, tytul) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    if (!meta.kolejnosc.includes(id)) throw new Error(`Nie znam rozdziału „${id}".`);
    meta.tytulyRozdzialow[id] = String(tytul).slice(0, 200);
    await zapiszMeta(kat, meta);
    return { id, tytul: meta.tytulyRozdzialow[id] };
}

/**
 * Skasuj rozdział.
 * ⚠️ TREŚĆ NIE GINIE — ląduje w wyciętych („darlings"). Skasowanie rozdziału
 * jednym kliknięciem nie może kosztować dnia pisania.
 */
export async function usunRozdzial(katalogKatedry, projekt, id) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    const i = meta.kolejnosc.indexOf(id);
    if (i < 0) throw new Error(`Nie znam rozdziału „${id}".`);

    const tresc = await czytajRozdzial(kat, id);
    if (policzSlowa(tresc) > 0) {
        meta.wyciety.unshift({
            id: `w-${Date.now().toString(36)}`,
            tresc,
            skad: { rozdzial: null, tytul: meta.tytulyRozdzialow[id] ?? '' },
            powod: 'skasowany rozdział',
            kiedy: new Date().toISOString(),
        });
    }

    meta.kolejnosc.splice(i, 1);
    delete meta.tytulyRozdzialow[id];
    delete meta.notatkiSekcji[id];
    meta.znaczniki = meta.znaczniki.filter((z) => z.rozdzial !== id);
    await zapiszMeta(kat, meta);
    try { await fs.unlink(path.join(kat, KAT_ROZDZIALOW, `${bezpieczneId(id)}.html`)); } catch { /* już nie ma */ }

    return { id, zachowanychSlow: policzSlowa(tresc) };
}

export async function przestawRozdzialy(katalogKatedry, projekt, kolejnosc = []) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    const znane = new Set(meta.kolejnosc);
    const nowa = kolejnosc.filter((id) => znane.has(id));
    // Rozdział pominięty w żądaniu NIE znika — dopisujemy go na koniec.
    for (const id of meta.kolejnosc) if (!nowa.includes(id)) nowa.push(id);
    meta.kolejnosc = nowa;
    await zapiszMeta(kat, meta);
    return meta.kolejnosc;
}

// ══════════════════════════════════════════════════════════════════════════════
//  WYCIĘTE — „kill your darlings, ale zachowaj ciała"
// ══════════════════════════════════════════════════════════════════════════════

export async function wytnij(katalogKatedry, projekt, { rozdzial, tresc, powod = '' }) {
    const czysta = String(tresc ?? '').trim();
    if (policzSlowa(czysta) < 1) throw new Error('Pusty fragment — nie ma czego zachowywać.');
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    const wpis = {
        id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        tresc: czysta,
        // Zapamiętujemy rozdział, ŻEBY DAŁO SIĘ WRÓCIĆ dokładnie tam, skąd wyszedł.
        skad: { rozdzial, tytul: meta.tytulyRozdzialow[rozdzial] ?? '' },
        powod: String(powod).slice(0, 200),
        slow: policzSlowa(czysta),
        kiedy: new Date().toISOString(),
    };
    meta.wyciety.unshift(wpis);
    await zapiszMeta(kat, meta);
    return wpis;
}

export async function usunWyciety(katalogKatedry, projekt, id) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    const i = meta.wyciety.findIndex((w) => w.id === id);
    if (i < 0) throw new Error('Nie znam takiego wyciętego fragmentu.');
    const [usuniety] = meta.wyciety.splice(i, 1);
    await zapiszMeta(kat, meta);
    return usuniety;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ZNACZNIKI — „brak nazwy nie zatrzymuje pisania"
// ══════════════════════════════════════════════════════════════════════════════

export async function dodajZnacznik(katalogKatedry, projekt, { rozdzial, notatka = '' }) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    if (!meta.kolejnosc.includes(rozdzial)) throw new Error(`Nie znam rozdziału „${rozdzial}".`);
    const z = {
        id: `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        rozdzial,
        notatka: String(notatka).slice(0, 400),
        zalatwiony: false,
        kiedy: new Date().toISOString(),
    };
    meta.znaczniki.push(z);
    await zapiszMeta(kat, meta);
    return z;
}

export async function zmienZnacznik(katalogKatedry, projekt, id, zmiany = {}) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    const z = meta.znaczniki.find((x) => x.id === id);
    if (!z) throw new Error('Nie znam takiego znacznika.');
    if (zmiany.notatka !== undefined) z.notatka = String(zmiany.notatka).slice(0, 400);
    if (zmiany.zalatwiony !== undefined) z.zalatwiony = Boolean(zmiany.zalatwiony);
    await zapiszMeta(kat, meta);
    return z;
}

export async function usunZnacznik(katalogKatedry, projekt, id) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    const i = meta.znaczniki.findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Nie znam takiego znacznika.');
    const [u] = meta.znaczniki.splice(i, 1);
    await zapiszMeta(kat, meta);
    return u;
}

// ══════════════════════════════════════════════════════════════════════════════
//  KONSPEKT — notatki sekcji, które w rękopisie są szarymi duchami
// ══════════════════════════════════════════════════════════════════════════════

export async function ustawKonspekt(katalogKatedry, projekt, rozdzial, notatki = []) {
    const kat = await katalog(katalogKatedry, projekt);
    const meta = await czytajMeta(kat);
    if (!meta.kolejnosc.includes(rozdzial)) throw new Error(`Nie znam rozdziału „${rozdzial}".`);
    meta.notatkiSekcji[rozdzial] = notatki
        .map((n) => ({
            id: String(n?.id || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`),
            tekst: String(n?.tekst ?? '').slice(0, 600),
        }))
        .filter((n) => n.tekst.trim())
        .slice(0, 60);
    await zapiszMeta(kat, meta);
    return meta.notatkiSekcji[rozdzial];
}

// ══════════════════════════════════════════════════════════════════════════════
//  EKSPORT I PRZEKAZANIE DALEJ
// ══════════════════════════════════════════════════════════════════════════════

/** Czysty tekst całości — do czytania, do modelu, do rozbicia na odcinki. */
export async function jakoTekst(katalogKatedry, projekt) {
    const r = await wczytaj(katalogKatedry, projekt);
    const czesci = [];
    if (r.tytul) czesci.push(r.tytul.toUpperCase(), '');
    r.rozdzialy.forEach((roz, i) => {
        czesci.push(`ROZDZIAŁ ${i + 1}${roz.tytul ? ` — ${roz.tytul}` : ''}`, '');
        const tekst = String(roz.tresc)
            .replace(/<\/(p|div|h[1-6])>/gi, '\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        czesci.push(tekst, '');
    });
    return { tekst: czesci.join('\n').trim(), slow: r.slow, rozdzialow: r.rozdzialy.length };
}

/**
 * Prompt rozbicia rękopisu na odcinki dla Reżysera.
 * ⚠️ Model ma DZIELIĆ, nie dopisywać — streszczenie odcinka wolno budować tylko
 * z tego, co w rękopisie napisano.
 */
export function promptNaOdcinki(tekst, ile = 6) {
    const system = [
        'Jesteś redaktorem dzielącym gotowy tekst na odcinki serialu.',
        'Odpowiadasz po polsku, WYŁĄCZNIE obiektem JSON, bez komentarza i bez płotu z backticków.',
        '',
        '{ "odcinki": [{"tytul":"…","streszczenie":"co się w nim dzieje","czasMinut":5,"styl":"jak to wygląda"}] }',
        '',
        'ŻELAZNE ZASADY:',
        `1. Odcinków ma być ${ile}, w kolejności zdarzeń z tekstu.`,
        '2. Streszczenie budujesz TYLKO z tego, co w tekście napisano. Nie dopisujesz scen.',
        '3. `styl` opisuje OBRAZ (światło, kolor, plan), nie nastrój fabuły.',
        '4. Gdy tekst kończy się w połowie wątku — mówisz to w streszczeniu ostatniego odcinka.',
    ].join('\n');
    // Bierzemy początek: mały model i tak zgubi środek dłuższej książki.
    return { system, prompt: `— RĘKOPIS —\n${String(tekst).slice(0, 14000)}\n\nPodziel na ${ile} odcinków. Sam JSON.` };
}

export default {
    katalog, wczytaj, zmienMeta, policzSlowa,
    dodajRozdzial, zapiszTresc, zmienTytulRozdzialu, usunRozdzial, przestawRozdzialy,
    wytnij, usunWyciety, dodajZnacznik, zmienZnacznik, usunZnacznik,
    ustawKonspekt, jakoTekst, promptNaOdcinki,
};
