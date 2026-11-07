/**
 * 📥 Własny Manuskrypt (2026-11-07: zewnętrzni autorzy książek ilustrowanych wgrywają gotową książkę PDF / DOCX / TXT
 * z własnymi ilustracjami → Katedra robi z niej audiobook, film na YouTube i Żywą Księgę do Wypożyczalni teostory.studio).
 *
 * ZASADA: tekst autora zostaje w 100% — nikt go nie przepisuje. Kod tylko dzieli go na sceny (strony PDF, akapity, nagłówki,
 * miejsca ilustracji), a zgodność sprawdza: sceny złożone z powrotem = tekst ze źródła (po złączeniu białych znaków).
 * Jedyne, co znika: same numery stron w PDF i miękkie przeniesienia wyrazów na końcu linii PDF („kot-\nka” → „kotka”).
 * Model językowy pisze WYŁĄCZNIE angielski opis obrazu dla Palety (FLUX), gdy autor zaznaczy „domaluj brakujące”.
 *
 * Etapy z faktów: sceny (po wczytaniu, do przejrzenia) → obrazy → glos → wideo → audiobook → gotowe | blad.
 * Lektor = Głosek (Głosy Stada, id `glosek`, albo inny TeOgochi), wideo = obraz sceny z powolnym najazdem + pas z tytułem,
 * audiobook = mp3 z całości (+ mp3 każdej strony dla czytnika). Jedno zadanie naraz (karta graficzna i silnik głosu).
 * `_OtakOs_Wymiar/manuskrypty/mk-<8 hex>/{zadanie.json, zrodlo.<ext>, obrazy/, audio/, praca/, audiobook.mp3, ksiega.json}`,
 * film → `produkcje/wlasny-manuskrypt/montaz/manuskrypt_<tytuł>_<id>.mp4`. Duch po restarcie = błąd z powodem.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { argumentyKwestii } from './WywiadAktorow.js';
import { CZCIONKI } from './PowitanieDnia.js';

export const PROJEKT = 'wlasny-manuskrypt';
export const MAX_BAJTOW_PLIKU = 80 * 1024 * 1024;
export const MAX_BAJTOW_ILUSTRACJI = 25 * 1024 * 1024;
export const MAX_ILUSTRACJI = 120;
export const MAX_SCEN = 200;
export const MAX_ZNAKOW_SCENY = 2000;          // dłuższa strona PDF dzieli się po zdaniach
export const SLOW_NA_SCENE = 140;              // DOCX/TXT bez ilustracji: ok. tyle słów na scenę
export const MIN_BOKU_OBRAZU = 120;
export const PROB_GLOSU = 3;
export const CISZA_DB = -45;               // szczyt nagrania poniżej = cisza
export const ZNAKOW_NA_SEKUNDE_MAX = 30;    // szybciej nikt nie czyta — krótsze nagranie jest urwane            // mniejsze obrazy z PDF/DOCX to ozdobniki — pomijane
export const STYL_DOMALOWANY = ', storybook illustration, consistent with the reference illustrations, same art style and palette, no text, no letters';
const ID = /^mk-[0-9a-f]{8}$/;
const require_ = createRequire(import.meta.url);

const slug = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const krotko = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
/** Porównanie tekstów: białe znaki złączone — tylko one mogą się różnić między źródłem a scenami. */
export const normalizuj = (t) => String(t ?? '').replace(/[\s ]+/g, ' ').trim();
const slowa = (t) => (normalizuj(t).match(/\S+/g) ?? []).length;

// ─────────────────────────── rozpoznanie i wczytanie ───────────────────────────

/** Rodzaj pliku po zawartości (nie po nazwie): %PDF → pdf, zip z word/document.xml → docx, inaczej tekst. */
export function rodzajPliku(bufor, nazwa = '') {
    if (bufor.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
    if (bufor[0] === 0x50 && bufor[1] === 0x4b) {
        if (bufor.includes(Buffer.from('word/document.xml'))) return 'docx';
        throw new Error('To archiwum ZIP, ale nie dokument Word (.docx). Stary .doc zapisz w Wordzie jako .docx albo PDF.');
    }
    if (/\.(doc|odt|rtf|pages|epub)$/i.test(nazwa)) throw new Error(`Format ${path.extname(nazwa)} nie jest obsługiwany — zapisz książkę jako PDF, DOCX albo TXT.`);
    if (bufor.subarray(0, 4).includes(0)) throw new Error('To nie wygląda na tekst (plik binarny). Obsługiwane: PDF, DOCX, TXT.');
    return 'txt';
}

/** TXT: UTF-8 (bez BOM), a gdy to nie UTF-8 — Windows-1250 (polskie pliki z Notatnika). */
export function tekstZTxt(bufor) {
    let t = new TextDecoder('utf-8').decode(bufor).replace(/^﻿/, '');
    if (t.includes('�')) { try { t = new TextDecoder('windows-1250').decode(bufor); } catch { /* zostaje UTF-8 */ } }
    return t.replace(/\r\n?/g, '\n');
}

const NAGLOWEK_TXT = /^(#{1,3}\s+\S.*|(rozdział|rozdzial|część|czesc|chapter|part|prolog|epilog|prologue|epilogue)(?=[\s.:]|$).{0,70})$/iu;
/** TXT → bloki akapitów; akapit = pusta linia, a gdy pustych linii brak — każda linia. Nagłówki: `#`, „Rozdział…”, „Chapter…”. */
export function blokiZTxt(t) {
    const surowe = t.includes('\n\n') ? t.split(/\n\s*\n/) : t.split('\n');
    return surowe.map((a) => a.trim()).filter(Boolean).map((a) => {
        const linia = a.replace(/\s+/g, ' ');
        const naglowek = !a.includes('\n') && linia.length <= 80 && NAGLOWEK_TXT.test(linia);
        return { tekst: naglowek ? linia.replace(/^#{1,3}\s+/, '') : a, naglowek, obrazy: [] };
    });
}

const ENCJE = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const odXml = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENCJE[e.toLowerCase()]));

/** Pliki z archiwum zip w pamięci (yauzl), tylko wskazane wzorem. */
async function plikiZZipa(bufor, wzor) {
    const yauzl = require_('yauzl');
    const zip = await new Promise((ok, zle) => yauzl.fromBuffer(bufor, { lazyEntries: true }, (e, z) => (e ? zle(e) : ok(z))));
    const out = new Map();
    await new Promise((ok, zle) => {
        zip.on('entry', (w) => {
            if (!wzor.test(w.fileName) || w.uncompressedSize > MAX_BAJTOW_PLIKU) return zip.readEntry();
            zip.openReadStream(w, (e, s) => {
                if (e) return zle(e);
                const cz = []; s.on('data', (c) => cz.push(c)); s.on('error', zle);
                s.on('end', () => { out.set(w.fileName, Buffer.concat(cz)); zip.readEntry(); });
            });
        });
        zip.on('end', ok); zip.on('error', zle);
        zip.readEntry();
    });
    return out;
}

const STYL_NAGLOWKA = /^(heading|nagwek|nagłówek|title|tytu|tytuł|subtitle|podtytu)/i;
/**
 * DOCX → bloki akapitów z obrazami w miejscu, gdzie autor je wstawił. Nagłówek = styl Heading/Nagłówek/Title.
 * Zwraca też tytuł z właściwości dokumentu (docProps/core.xml).
 */
export async function blokiZDocx(bufor) {
    const pliki = await plikiZZipa(bufor, /^(word\/document\.xml|word\/_rels\/document\.xml\.rels|word\/media\/.+|docProps\/core\.xml)$/);
    const doc = pliki.get('word/document.xml')?.toString('utf8');
    if (!doc) throw new Error('W pliku DOCX nie ma treści (word/document.xml).');
    const rels = new Map();
    for (const m of (pliki.get('word/_rels/document.xml.rels')?.toString('utf8') ?? '').matchAll(/<Relationship\b[^>]*>/g)) {
        const id = /\bId="([^"]+)"/.exec(m[0])?.[1], cel = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
        if (id && cel) rels.set(id, cel.replace(/^\/?word\//, '').replace(/^\.\//, ''));
    }
    const bloki = [];
    let czekajace = [];   // obrazy w akapicie bez tekstu → idą do następnego akapitu z tekstem
    for (const p of doc.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
        const x = p[0];
        const styl = /<w:pStyle w:val="([^"]+)"/.exec(x)?.[1] ?? '';
        const tekst = odXml([...x.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)].map((m) => (m[2] === 'tab' ? ' ' : m[2] ? '\n' : m[1])).join('')).trim();
        for (const m of x.matchAll(/r:(?:embed|id)="([^"]+)"/g)) {
            const cel = rels.get(m[1]);
            const dane = cel && pliki.get(`word/${cel}`);
            if (dane && /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(cel)) czekajace.push({ dane, ext: path.extname(cel).slice(1).toLowerCase(), zrodlo: 'docx' });
        }
        if (!tekst) continue;
        bloki.push({ tekst, naglowek: STYL_NAGLOWKA.test(styl), obrazy: czekajace });
        czekajace = [];
    }
    if (czekajace.length) { if (bloki.length) bloki.at(-1).obrazyPo = czekajace; }
    const core = pliki.get('docProps/core.xml')?.toString('utf8') ?? '';
    return { bloki, tytul: krotko(odXml(/<dc:title>([\s\S]*?)<\/dc:title>/.exec(core)?.[1] ?? ''), 200) || null, autor: krotko(odXml(/<dc:creator>([\s\S]*?)<\/dc:creator>/.exec(core)?.[1] ?? ''), 120) || null };
}

/**
 * PDF → strony z tekstem i obrazami (pdf.js z pdf-parse; JPEG dekodowany w JS — `nativeImageDecoderSupport: 'none'`).
 * Obraz = surowe piksele {w, h, kind 1/2/3, dane}; zamiana na PNG robi ffmpeg (wyżej). Tekst: linie z pozycji Y,
 * same numery stron usunięte, przeniesienie „wy-\nraz” złączone.
 */
export async function stronyZPdf(bufor) {
    const pdfjs = require_('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
    pdfjs.disableWorker = true;
    let doc;
    try { doc = await pdfjs.getDocument({ data: new Uint8Array(bufor), nativeImageDecoderSupport: 'none', disableFontFace: true }); }
    catch (e) { throw new Error(`PDF nie dał się otworzyć (${e?.message ?? e}). Zaszyfrowany? Zapisz bez hasła.`); }
    const strony = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        const tc = await p.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let y, s = '';
        for (const it of tc.items) { const ty = it.transform?.[5]; if (y === undefined || Math.abs(ty - y) < 1) s += it.str; else s += '\n' + it.str; y = ty; }
        const obrazy = [];
        try {
            const ops = await p.getOperatorList();
            const widziane = new Set();
            for (let k = 0; k < ops.fnArray.length; k++) {
                if (ops.fnArray[k] !== pdfjs.OPS.paintImageXObject) continue;
                const idObr = ops.argsArray[k][0];
                if (widziane.has(idObr)) continue;
                widziane.add(idObr);
                let o = null; try { o = p.objs.get(idObr); } catch { o = null; }
                if (o?.data && o.width >= MIN_BOKU_OBRAZU && o.height >= MIN_BOKU_OBRAZU) obrazy.push({ w: o.width, h: o.height, kind: o.kind, dane: Buffer.from(o.data.buffer, o.data.byteOffset, o.data.byteLength), zrodlo: 'pdf' });
            }
        } catch { /* strona bez obrazów do wyjęcia — tekst zostaje */ }
        strony.push({ strona: i, tekst: tekstStronyPdf(s), obrazy });
    }
    return strony;
}

/** Linie strony PDF → tekst: bez linii z samym numerem strony, przeniesienia złączone, linie w akapicie spacją. */
export function tekstStronyPdf(s) {
    const linie = String(s ?? '').replace(/\r/g, '').split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim());
    const bezNumerow = linie.filter((l) => !/^[-–—]?\s*\d{1,4}\s*[-–—]?$/.test(l));
    return bezNumerow.join('\n').replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2').replace(/\n{2,}/g, '\n\n').replace(/(?<!\n)\n(?!\n)/g, ' ').trim();
}

// ─────────────────────────── podział na sceny ───────────────────────────

const ZDANIA = /(?<=[.!?…]["”»)]?)\s+(?=["„«(—–\-]?\p{Lu}|[—–]\s)/u;
export const naZdania = (t) => String(t).split(ZDANIA).map((x) => x.trim()).filter(Boolean);

/**
 * Bloki (akapity z obrazami) → sceny. Granice: nagłówek, ilustracja autora (scena ma już obraz i tekst),
 * strona PDF (tryb `strony`), cel słów (tryb `slowa`) albo równy podział na `ileScen` (folder ilustracji).
 * Zdania nigdy nie są cięte; akapit dłuższy niż cel dzieli się po zdaniach.
 * @returns {{ sceny: {nr, rozdzial, naglowek, tekst, obraz, strona}[], zgodnosc: {znakowZrodla, znakowScen, zgodne} }}
 */
export function podzielNaSceny(bloki, { tryb = 'slowa', slowNaScene = SLOW_NA_SCENE, ileScen = null } = {}) {
    const zrodlo = normalizuj(bloki.map((b) => b.tekst).join(' '));
    const wszystkich = slowa(zrodlo) || 1;
    const cel = tryb === 'ilosc' && ileScen ? Math.max(1, wszystkich / ileScen) : Math.max(20, Math.min(600, Number(slowNaScene) || SLOW_NA_SCENE));
    const sceny = [];
    let rozdzial = null, biezaca = null, czekaObraz = [], licznik = 0;
    const nowa = (strona) => { biezaca = { rozdzial, naglowek: null, akapity: [[]], obraz: null, strona: strona ?? null, slow: 0 }; sceny.push(biezaca); return biezaca; };
    const zamknij = () => { biezaca = null; };
    const dajObraz = (s) => { if (!s.obraz && czekaObraz.length) s.obraz = czekaObraz.shift(); };
    let stronaPoprz = null;
    for (const b of bloki) {
        const tekst = String(b.tekst ?? '').trim();
        if (tryb === 'strony' && b.strona !== stronaPoprz) { zamknij(); stronaPoprz = b.strona; }
        for (const o of b.obrazy ?? []) {
            if (biezaca?.obraz && biezaca.slow > 0) zamknij();
            if (biezaca && !biezaca.obraz) biezaca.obraz = o; else czekaObraz.push(o);
        }
        if (!tekst) continue;
        if (b.naglowek) {
            zamknij(); rozdzial = krotko(tekst, 120);
            const s = nowa(b.strona); s.naglowek = tekst; s.slow += slowa(tekst); dajObraz(s);
            continue;
        }
        const czesci = slowa(tekst) > cel || tekst.length > MAX_ZNAKOW_SCENY ? naZdania(tekst) : [tekst];
        if (biezaca && biezaca.akapity.at(-1).length) biezaca.akapity.push([]);
        for (const cz of czesci) {
            const n = slowa(cz);
            const limit = tryb === 'ilosc' ? (sceny.length > 0 && licznik + n / 2 > cel * sceny.length && biezaca?.slow > 0) : (tryb === 'strony' ? false : biezaca && biezaca.slow + n > cel && biezaca.slow > 0);
            const zaDlugo = biezaca && (biezaca.akapity.flat().join(' ').length + cz.length > MAX_ZNAKOW_SCENY) && biezaca.slow > 0;
            if (!biezaca || limit || zaDlugo) { nowa(b.strona); }
            dajObraz(biezaca);
            biezaca.akapity.at(-1).push(cz);
            biezaca.slow += n; licznik += n;
        }
        for (const o of b.obrazyPo ?? []) czekaObraz.push(o);
    }
    // obrazy bez sceny (np. strony PDF z samą ilustracją na końcu) → ostatnie sceny bez obrazu, od końca
    for (const s of [...sceny].reverse()) { if (!czekaObraz.length) break; if (!s.obraz) s.obraz = czekaObraz.pop(); }
    const gotowe = sceny.map((s) => ({ rozdzial: s.rozdzial, naglowek: s.naglowek, tekst: s.akapity.map((a) => a.join(' ')).filter(Boolean).join('\n\n'), obraz: s.obraz, strona: s.strona }))
        .filter((s) => s.naglowek || s.tekst)
        .map((s, i) => ({ nr: i + 1, ...s }));
    const zlozone = normalizuj(gotowe.map((s) => [s.naglowek, s.tekst].filter(Boolean).join(' ')).join(' '));
    return { sceny: gotowe, nieuzyteObrazy: czekaObraz.length, zgodnosc: { znakowZrodla: zrodlo.length, znakowScen: zlozone.length, zgodne: zlozone === zrodlo } };
}

/** Tekst czytany przez lektora: nagłówek, pauza (nowa linia), treść. */
export const tekstLektora = (s) => [s.naglowek, s.tekst].filter(Boolean).join('\n');

const SYSTEM_OPISU = `You describe ONE illustration for a scene of an illustrated book. You never change or retell the author's story.
Write ONE English sentence (max 60 words) describing what to draw: characters, setting, action, light, mood — only what the scene text says.
No text, letters or captions in the picture. Answer with the sentence only.`;

// ─────────────────────────── serwis ───────────────────────────

/**
 * @param {{ katalog: string, katalogMontazy: (projekt:string) => Promise<string>, ffmpeg: string, uruchom: Function,
 *   opisz: (p:string) => Promise<{sekundy?:number}>, mow: (o:{tekst:string, glos:string, jezyk:string}) => Promise<{audio:Buffer, ext:string}>,
 *   pisz?: (system:string, prompt:string) => Promise<string>, rysuj?: (o:{prompt:string, referencje:string[], szer:number, wys:number, prefiks:string}) => Promise<string>,
 *   publikujYT?: (z:object) => Promise<object>, publikujWypozyczalnia?: (o:object) => Promise<object>, autor?: () => Promise<string|null>,
 *   szyna?: any, teraz?: () => number }} cfg
 */
export function utworzManuskrypt(cfg) {
    const KAT = cfg.katalog;
    const teraz = cfg.teraz ?? Date.now;
    const czas = () => new Date(teraz()).toISOString();
    const pracuje = new Set();
    let kolejka = Promise.resolve();
    const dir = (id) => path.join(KAT, id);
    const ffmpeg = (args, cwd) => cfg.uruchom(cfg.ffmpeg, args, { cwd, windowsHide: true, maxBuffer: 1 << 24 });
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Głosek', rodzaj: 'praca', tresc })?.catch?.(() => {});

    async function czytaj(id) {
        if (!ID.test(String(id))) throw Object.assign(new Error('Nie ma takiego manuskryptu.'), { kod: 404 });
        try { return JSON.parse(await fs.readFile(path.join(dir(id), 'zadanie.json'), 'utf8')); }
        catch { throw Object.assign(new Error('Nie ma takiego manuskryptu.'), { kod: 404 }); }
    }
    async function zapisz(z) {
        await fs.mkdir(dir(z.id), { recursive: true });
        const t = path.join(dir(z.id), `zadanie.json.${process.pid}.tmp`);
        await fs.writeFile(t, JSON.stringify(z, null, 1));
        await fs.rename(t, path.join(dir(z.id), 'zadanie.json'));
    }
    const krok = (z, opis) => { z.kroki = [...(z.kroki ?? []), { kiedy: czas(), opis }].slice(-60); };

    /** Obraz źródłowy → plik w `obrazy/` (PNG z surowych pikseli PDF, kopia JPG/PNG, reszta → PNG ffmpegiem). */
    async function zapiszObraz(z, o, nazwa) {
        const kat = path.join(dir(z.id), 'obrazy');
        await fs.mkdir(kat, { recursive: true });
        if (o.kind) {
            const pix = { 1: 'monob', 2: 'rgb24', 3: 'rgba' }[o.kind];
            if (!pix) return null;
            const surowy = path.join(kat, `${nazwa}.raw`);
            // pdf.js: kind 1 = 1 bit na piksel, wiersz wyrównany do bajtu — ffmpeg „monob” liczy tak samo przy szerokości ×8
            await fs.writeFile(surowy, o.dane);
            try { await ffmpeg(['-y', '-f', 'rawvideo', '-pix_fmt', pix, '-s', `${o.w}x${o.h}`, '-i', surowy, '-frames:v', '1', `${nazwa}.png`], kat); }
            catch { return null; }
            finally { await fs.rm(surowy, { force: true }); }
            return `${nazwa}.png`;
        }
        const ext = String(o.ext ?? '').toLowerCase();
        if (['png', 'jpg', 'jpeg'].includes(ext)) { const n = `${nazwa}.${ext === 'jpeg' ? 'jpg' : ext}`; await fs.writeFile(path.join(kat, n), o.dane); return n; }
        const tmp = path.join(kat, `${nazwa}.src.${ext || 'bin'}`);
        await fs.writeFile(tmp, o.dane);
        try { await ffmpeg(['-y', '-i', path.basename(tmp), '-frames:v', '1', `${nazwa}.png`], kat); return `${nazwa}.png`; }
        catch { return null; } finally { await fs.rm(tmp, { force: true }); }
    }

    const zDataUrl = (d, max, co) => {
        const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(d ?? ''));
        if (!m) throw new Error(`${co}: oczekuję pliku jako dataURL.`);
        const b = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
        if (!b.length) throw new Error(`${co}: pusty plik.`);
        if (b.length > max) throw new Error(`${co}: za duży (${Math.round(b.length / 1e6)} MB > ${Math.round(max / 1e6)} MB).`);
        return b;
    };

    /** Wczytanie: plik autora + (opcjonalnie) ilustracje → bloki → sceny. Nic nie generuje; stan `sceny` czeka na „Produkuj”. */
    async function nowy({ nazwa = '', dane, ilustracje = [], tytul = '', autor = '', jezyk = 'pl', prawa = false, slowNaScene = SLOW_NA_SCENE } = {}) {
        if (prawa !== true) throw new Error('Potwierdź, że masz prawa do tekstu i ilustracji (autor albo zgoda autora).');
        const bufor = zDataUrl(dane, MAX_BAJTOW_PLIKU, 'Plik książki');
        const rodzaj = rodzajPliku(bufor, nazwa);
        const ilu = (Array.isArray(ilustracje) ? ilustracje : []).slice(0, MAX_ILUSTRACJI + 1);
        if (ilu.length > MAX_ILUSTRACJI) throw new Error(`Najwyżej ${MAX_ILUSTRACJI} ilustracji.`);
        const z = { id: `mk-${crypto.randomBytes(4).toString('hex')}`, stan: 'wczytuje', utworzono: czas(), plik: krotko(path.basename(String(nazwa || `ksiazka.${rodzaj}`)), 120), rodzaj,
            tytul: krotko(tytul, 200), autor: krotko(autor, 120), jezyk: jezyk === 'en' ? 'en' : 'pl', kroki: [] };
        await fs.mkdir(dir(z.id), { recursive: true });
        await fs.writeFile(path.join(dir(z.id), `zrodlo.${rodzaj}`), bufor);
        try {
            let bloki, nr = 0;
            if (rodzaj === 'pdf') {
                const strony = await stronyZPdf(bufor);
                bloki = [];
                for (const s of strony) {
                    const obrazy = [];
                    for (const o of s.obrazy) { const p = await zapiszObraz(z, o, `pdf-${String(++nr).padStart(3, '0')}`); if (p) obrazy.push({ plik: p, zrodlo: 'pdf' }); }
                    bloki.push({ strona: s.strona, tekst: s.tekst, obrazy });
                }
                z.stronPdf = strony.length;
            } else if (rodzaj === 'docx') {
                const d = await blokiZDocx(bufor);
                bloki = [];
                for (const b of d.bloki) {
                    const zap = async (lista) => { const out = []; for (const o of lista ?? []) { const p = await zapiszObraz(z, o, `docx-${String(++nr).padStart(3, '0')}`); if (p) out.push({ plik: p, zrodlo: 'docx' }); } return out; };
                    bloki.push({ ...b, obrazy: await zap(b.obrazy), obrazyPo: await zap(b.obrazyPo) });
                }
                if (!z.tytul && d.tytul) z.tytul = d.tytul;
                if (!z.autor && d.autor) z.autor = d.autor;
            } else bloki = blokiZTxt(tekstZTxt(bufor));
            if (!bloki.some((b) => b.tekst)) throw new Error(rodzaj === 'pdf' ? 'PDF nie ma warstwy tekstu (skan?) — OCR nie robimy; wgraj DOCX/TXT z tekstem.' : 'W pliku nie ma tekstu.');
            // ilustracje z folderu autora — po nazwie (naturalnie: 2 przed 10)
            const posort = ilu.map((x, i) => ({ ...x, i })).sort((a, b) => String(a.nazwa ?? a.i).localeCompare(String(b.nazwa ?? b.i), undefined, { numeric: true }));
            z.ilustracje = [];
            for (const x of posort) {
                const b = zDataUrl(x.dane, MAX_BAJTOW_ILUSTRACJI, `Ilustracja ${x.nazwa ?? x.i + 1}`);
                const ext = /^data:image\/(png|jpe?g|webp|gif|bmp)/i.exec(String(x.dane))?.[1]?.toLowerCase() ?? path.extname(String(x.nazwa ?? '')).slice(1).toLowerCase();
                const p = await zapiszObraz(z, { dane: b, ext }, `autor-${String(z.ilustracje.length + 1).padStart(3, '0')}`);
                if (!p) throw new Error(`Ilustracja „${x.nazwa}” — nieznany format obrazu.`);
                z.ilustracje.push({ plik: p, nazwa: krotko(x.nazwa, 120) });
            }
            z.bloki = bloki.map((b) => ({ ...b, tekst: b.tekst }));
            z.slowNaScene = Math.max(20, Math.min(600, Number(slowNaScene) || SLOW_NA_SCENE));
            podziel(z);
            if (!z.tytul) z.tytul = krotko(z.sceny[0]?.naglowek || path.parse(z.plik).name, 200);
            z.stan = 'sceny';
            krok(z, `📥 ${z.rodzaj.toUpperCase()}: ${z.sceny.length} scen, ilustracji: ${z.sceny.filter((s) => s.obraz).length}/${z.sceny.length}, tekst ${z.zgodnosc.zgodne ? 'zgodny ze źródłem ✓' : '⚠ NIEZGODNY ze źródłem'}`);
        } catch (e) {
            Object.assign(z, { stan: 'blad', powod: String(e?.message ?? e).slice(0, 500) });
            krok(z, `⛔ ${z.powod}`);
        }
        await zapisz(z);
        if (z.stan === 'blad') throw Object.assign(new Error(z.powod), { zadanie: z });
        return z;
    }

    /** Sceny z bloków: PDF = strony, z folderem ilustracji (bez obrazów w pliku) = tyle scen, ile ilustracji, inaczej cel słów. */
    function podziel(z, { tryb = null } = {}) {
        const maObrazy = z.bloki.some((b) => b.obrazy?.length || b.obrazyPo?.length);
        const t = tryb ?? (z.rodzaj === 'pdf' ? 'strony' : z.ilustracje?.length && !maObrazy ? 'ilosc' : 'slowa');
        const { sceny, zgodnosc, nieuzyteObrazy } = podzielNaSceny(z.bloki, { tryb: t, slowNaScene: z.slowNaScene, ileScen: z.ilustracje?.length || null });
        if (!sceny.length) throw new Error('Nie wyszła żadna scena.');
        if (sceny.length > MAX_SCEN) throw new Error(`Za dużo scen (${sceny.length} > ${MAX_SCEN}) — zwiększ liczbę słów na scenę.`);
        // ilustracje z folderu → sceny bez obrazu, po kolei
        const folder = [...(z.ilustracje ?? [])];
        for (const s of sceny) {
            if (s.obraz) s.obraz = { plik: s.obraz.plik, zrodlo: s.obraz.zrodlo };
            else if (folder.length) s.obraz = { plik: folder.shift().plik, zrodlo: 'autor' };
        }
        Object.assign(z, { tryb: t, sceny, zgodnosc, nieuzyteObrazy: nieuzyteObrazy + folder.length });
    }

    async function przepodziel(id, { slowNaScene, tryb } = {}) {
        const z = await czytaj(id);
        if (pracuje.has(z.id) || !['sceny', 'gotowe', 'blad'].includes(z.stan) || !z.bloki) throw new Error('Teraz nie można dzielić od nowa.');
        if (slowNaScene) z.slowNaScene = Math.max(20, Math.min(600, Number(slowNaScene) || SLOW_NA_SCENE));
        podziel(z, { tryb: ['strony', 'slowa', 'ilosc'].includes(tryb) ? tryb : null });
        Object.assign(z, { stan: 'sceny', powod: null });
        krok(z, `✂️ podział od nowa (${z.tryb}): ${z.sceny.length} scen`);
        await zapisz(z);
        return z;
    }

    /** Podmiana ilustracji jednej sceny (autor wskazuje inny obraz). */
    async function ilustracjaSceny(id, nr, { dane, nazwa = '' } = {}) {
        const z = await czytaj(id);
        if (pracuje.has(z.id)) throw new Error('Manuskrypt właśnie się produkuje.');
        const s = z.sceny?.find((x) => x.nr === Number(nr));
        if (!s) throw Object.assign(new Error('Nie ma takiej sceny.'), { kod: 404 });
        const b = zDataUrl(dane, MAX_BAJTOW_ILUSTRACJI, 'Ilustracja');
        const ext = /^data:image\/(png|jpe?g|webp|gif|bmp)/i.exec(String(dane))?.[1]?.toLowerCase() ?? path.extname(String(nazwa)).slice(1);
        const p = await zapiszObraz(z, { dane: b, ext }, `scena-${s.nr}-${crypto.randomBytes(2).toString('hex')}`);
        if (!p) throw new Error('Nieznany format obrazu.');
        s.obraz = { plik: p, zrodlo: 'autor' };
        if (z.stan === 'gotowe') z.stan = 'sceny';
        krok(z, `🖼️ scena ${s.nr}: ilustracja autora`);
        await zapisz(z);
        return z;
    }

    /** Nagranie lektora: cisza (szczyt < −45 dB) albo krócej niż tekst przy szybkiej mowie (≈ 30 znaków/s) = problem. */
    async function problemNagrania(plik, sek, tekst) {
        if (!sek) return 'nagranie bez długości (puste)';
        const min = Math.max(0.4, normalizuj(tekst).length / ZNAKOW_NA_SEKUNDE_MAX);
        if (sek < min) return `nagranie za krótkie (${sek.toFixed(1)} s na ${normalizuj(tekst).length} znaków, oczekiwane ≥ ${min.toFixed(1)} s)`;
        try {
            const r = await cfg.uruchom(cfg.ffmpeg, ['-hide_banner', '-i', plik, '-af', 'volumedetect', '-f', 'null', '-'], { windowsHide: true, maxBuffer: 1 << 24 });
            const szczyt = Number(/max_volume:\s*(-?[\d.]+|-inf) dB/.exec(`${r?.stderr ?? ''}`)?.[1]?.replace('-inf', '-200'));
            if (Number.isFinite(szczyt) && szczyt < CISZA_DB) return `cisza w nagraniu (szczyt ${szczyt} dB)`;
        } catch { /* bez pomiaru głośności zostaje sprawdzenie długości */ }
        return null;
    }

    async function czcionka(praca) {
        const c = CZCIONKI.find((p) => p && fsSync.existsSync(p));
        if (!c) throw new Error('Nie znalazłem czcionki do napisów.');
        await fs.copyFile(c, path.join(praca, 'czcionka.ttf'));
    }

    async function przebieg(z, { domaluj, glos }) {
        pracuje.add(z.id);
        const praca = path.join(dir(z.id), 'praca');
        const etap = async (nazwa) => { z.stan = nazwa; await zapisz(z); };
        try {
            await fs.rm(praca, { recursive: true, force: true });
            await fs.mkdir(praca, { recursive: true });
            await fs.mkdir(path.join(dir(z.id), 'audio'), { recursive: true });
            await czcionka(praca);
            // 1. obrazy brakujących scen
            await etap('obrazy');
            const autorskie = z.sceny.filter((s) => s.obraz && s.obraz.zrodlo !== 'paleta').map((s) => path.join(dir(z.id), 'obrazy', s.obraz.plik));
            for (const s of z.sceny) {
                if (s.obraz && s.obraz.zrodlo !== 'poprzedni') continue;
                if (domaluj) {
                    if (!cfg.rysuj || !cfg.pisz) throw new Error('Paleta (FLUX) albo model opisu niedostępne — odznacz „domaluj”.');
                    const opis = krotko(String(await cfg.pisz(SYSTEM_OPISU, `Book: ${z.tytul}\nScene text (${z.jezyk}):\n${tekstLektora(s).slice(0, 2500)}`)).replace(/<think>[\s\S]*?<\/think>/g, ''), 500);
                    if (opis.length < 10) throw new Error(`scena ${s.nr}: model nie opisał obrazu`);
                    const plik = await cfg.rysuj({ prompt: `${opis}${STYL_DOMALOWANY}`, referencje: autorskie.slice(0, 2), szer: 1280, wys: 720, prefiks: `katedra/manuskrypt/${z.id}` });
                    const n = `paleta-${String(s.nr).padStart(3, '0')}.png`;
                    await fs.copyFile(plik, path.join(dir(z.id), 'obrazy', n));
                    s.obraz = { plik: n, zrodlo: 'paleta', opis };
                    krok(z, `🎨 Paleta domalowała scenę ${s.nr}`);
                    await zapisz(z);
                }
            }
            if (!domaluj) {
                // bez domalowania: najbliższa wcześniejsza ilustracja, a na początku — najbliższa późniejsza; bez żadnej — plansza
                let ost = null;
                for (const s of z.sceny) { if (s.obraz && s.obraz.zrodlo !== 'poprzedni') ost = s.obraz; else s.obraz = ost ? { plik: ost.plik, zrodlo: 'poprzedni' } : null; }
                let nast = null;
                for (const s of [...z.sceny].reverse()) { if (s.obraz && s.obraz.zrodlo !== 'poprzedni') nast = s.obraz; else if (!s.obraz && nast) s.obraz = { plik: nast.plik, zrodlo: 'poprzedni' }; }
            }
            // 2. głos — Głosek czyta każdą scenę (zapowiedź tytułu = segment 0)
            await etap('glos');
            const zapowiedz = `${z.tytul}.${z.autor ? (z.jezyk === 'en' ? ` By ${z.autor}.` : ` Autor: ${z.autor}.`) : ''}`;
            const kawalki = [{ nr: 0, tekst: zapowiedz, obraz: z.sceny.find((s) => s.obraz)?.obraz ?? null, naglowek: z.tytul }, ...z.sceny.map((s) => ({ nr: s.nr, tekst: tekstLektora(s), obraz: s.obraz, naglowek: `${z.tytul}${s.rozdzial ? ` · ${s.rozdzial}` : ''}` }))];
            for (const k of kawalki) {
                // 🛟 silnik klonu potrafi oddać CISZĘ albo urwane nagranie (2026-11-07: 147 znaków → 0,2 s, −90 dB) —
                // każde nagranie sprawdzamy (głośność + długość względem tekstu), cisza = ponowienie, po 3 próbach błąd z powodem
                let a = null, sek = null, problem = null;
                for (let proba = 1; proba <= PROB_GLOSU && !a; proba++) {
                    let g;
                    try { g = await cfg.mow({ tekst: k.tekst, glos, jezyk: z.jezyk }); }
                    catch (e) { problem = e.message; continue; }
                    const nazwa = `a-${String(k.nr).padStart(3, '0')}.${g.ext || 'wav'}`;
                    await fs.writeFile(path.join(praca, nazwa), g.audio);
                    sek = (await cfg.opisz(path.join(praca, nazwa)).catch(() => null))?.sekundy ?? null;
                    problem = await problemNagrania(path.join(praca, nazwa), sek, k.tekst);
                    if (!problem) a = nazwa;
                    else krok(z, `🛟 ${k.nr ? `scena ${k.nr}` : 'zapowiedź'}: ${problem} — próba ${proba}/${PROB_GLOSU}`);
                }
                if (!a) throw new Error(`głos ${k.nr ? `sceny ${k.nr}` : 'zapowiedzi'}: ${problem} (po ${PROB_GLOSU} próbach) — sprawdź silnik głosu (🎙️ Studio Podcastu → silnik klonu) albo barwę Głoska w Głosach Stada.`);
                k.audio = a; k.sekundy = Math.round((sek + 0.7) * 100) / 100;
                // strona czytnika: mp3 z oddechem na końcu
                const p = `p-${String(k.nr).padStart(3, '0')}.wav`;
                await ffmpeg(['-y', '-i', a, '-af', `aresample=44100,aformat=channel_layouts=stereo,apad=whole_dur=${k.sekundy}`, '-c:a', 'pcm_s16le', p], praca);
                k.pcm = p;
                if (k.nr > 0) {
                    await ffmpeg(['-y', '-i', p, '-c:a', 'libmp3lame', '-b:a', '128k', path.join('..', 'audio', `strona-${k.nr}.mp3`)], praca);
                    const s = z.sceny.find((x) => x.nr === k.nr); s.audio = `strona-${k.nr}.mp3`; s.sekundy = k.sekundy;
                }
                krok(z, `🎙️ ${k.nr ? `scena ${k.nr}` : 'zapowiedź'} — ${k.sekundy} s`);
                await zapisz(z);
            }
            // 3. wideo — obraz sceny z najazdem + pas z tytułem i rozdziałem
            await etap('wideo');
            const seg = [];
            for (const k of kawalki) {
                await fs.writeFile(path.join(praca, `n-${k.nr}.txt`), krotko(k.naglowek, 90), 'utf8');
                const obraz = k.obraz ? path.join(dir(z.id), 'obrazy', k.obraz.plik) : null;
                const w = `seg-${String(k.nr).padStart(3, '0')}.mp4`;
                await ffmpeg(argumentyKwestii({ obraz, klip: null, kolor: '#d4a64a', imiePlik: `n-${k.nr}.txt`, liniePliki: [], czcionka: 'czcionka.ttf', czas: k.sekundy, audio: k.audio, wyjscie: w }), praca);
                seg.push(w);
            }
            await fs.writeFile(path.join(praca, 'lista.txt'), seg.map((x) => `file '${x}'`).join('\n'), 'utf8');
            const katM = await cfg.katalogMontazy(PROJEKT);
            await fs.mkdir(katM, { recursive: true });
            const film = path.join(katM, `manuskrypt_${slug(z.tytul) || 'ksiazka'}_${z.id.slice(3)}.mp4`);
            await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', film], praca);
            z.wideo = film;
            z.sekundyWideo = (await cfg.opisz(film).catch(() => null))?.sekundy ?? null;
            krok(z, `🎬 film ${z.sekundyWideo ? `${Math.round(z.sekundyWideo)} s` : ''} → Montażownia (${PROJEKT})`);
            // 4. audiobook — całość jednym mp3 z metadanymi
            await etap('audiobook');
            await fs.writeFile(path.join(praca, 'audio.txt'), kawalki.map((k) => `file '${k.pcm}'`).join('\n'), 'utf8');
            await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'audio.txt', '-c:a', 'libmp3lame', '-b:a', '128k', '-metadata', `title=${z.tytul}`, '-metadata', `artist=${z.autor || 'nieznany autor'}`,
                '-metadata', 'comment=Lektor: Głosek (Katedra OtakOS)', path.join('..', 'audiobook.mp3')], praca);
            z.audiobook = 'audiobook.mp3';
            z.sekundyAudio = (await cfg.opisz(path.join(dir(z.id), 'audiobook.mp3')).catch(() => null))?.sekundy ?? null;
            // 5. Żywa Księga — format czytnika i Wypożyczalni
            z.ksiega = ksiegaZadania(z);
            await fs.writeFile(path.join(dir(z.id), 'ksiega.json'), JSON.stringify(z.ksiega, null, 1));
            Object.assign(z, { stan: 'gotowe', gotowe: czas(), powod: null, lektor: glos });
            krok(z, `📖 gotowe: audiobook ${z.sekundyAudio ? (z.sekundyAudio >= 60 ? `${Math.round(z.sekundyAudio / 60)} min` : `${Math.round(z.sekundyAudio)} s`) : ''}, film, Żywa Księga (${z.sceny.length} stron)`);
            await zapisz(z);
            nadaj(`📥 Własny Manuskrypt „${z.tytul}” gotowy: audiobook, film i Żywa Księga.`);
            await fs.rm(praca, { recursive: true, force: true }).catch(() => {});
        } catch (e) {
            Object.assign(z, { stan: 'blad', powod: String(e?.message ?? e).slice(0, 500) });
            krok(z, `⛔ ${z.powod}`);
            await zapisz(z).catch(() => {});
        } finally { pracuje.delete(z.id); }
    }

    const adres = (id, kat, plik) => `/api/manuskrypt/${id}/plik/${kat}/${plik}`;
    function ksiegaZadania(z) {
        return {
            id: `mk-${slug(z.tytul) || z.id.slice(3)}`.slice(0, 60), title: z.tytul, subtitle: z.autor ? (z.jezyk === 'en' ? `by ${z.autor}` : `autor: ${z.autor}`) : '', author: z.autor || 'nieznany autor',
            sourceType: 'author-manuscript', language: z.jezyk, narrator: 'Głosek', characters: [],
            pages: z.sceny.map((s) => ({ pageNumber: s.nr, chapterTitle: s.rozdzial || s.naglowek || z.tytul, narrativeText: tekstLektora(s), dialogueLines: [],
                illustrationPrompt: s.obraz?.opis ?? '', imageCaption: '', imageUrl: s.obraz ? adres(z.id, 'obrazy', s.obraz.plik) : undefined,
                audioUrl: s.audio ? adres(z.id, 'audio', s.audio) : undefined, audioSeconds: s.sekundy ?? undefined })),
        };
    }

    async function produkuj(id, { domaluj = false, glos = 'glosek', jezyk = null } = {}) {
        const z = await czytaj(id);
        if (pracuje.has(z.id) || ['obrazy', 'glos', 'wideo', 'audiobook'].includes(z.stan)) throw new Error('Ten manuskrypt już się produkuje.');
        if (!z.sceny?.length) throw new Error('Najpierw wczytaj książkę (nie ma scen).');
        if (!z.zgodnosc?.zgodne) throw new Error('Tekst scen nie zgadza się ze źródłem — nie produkuję (zgłoś ten plik, to błąd podziału).');
        const g = String(glos || 'glosek').toLowerCase();
        if (!/^[a-z0-9-]{2,30}$/.test(g)) throw new Error('Zły lektor.');
        if (jezyk) z.jezyk = jezyk === 'en' ? 'en' : 'pl';
        // ponowna produkcja: obrazy „poprzedni” liczymy od nowa, domalowane zostają
        for (const s of z.sceny) if (s.obraz?.zrodlo === 'poprzedni') s.obraz = null;
        Object.assign(z, { stan: 'czeka', domaluj: !!domaluj, powod: null });
        krok(z, `▶ produkcja: lektor ${g}${domaluj ? ', Paleta domaluje brakujące ilustracje' : ''}`);
        await zapisz(z);
        kolejka = kolejka.then(() => przebieg(z, { domaluj: !!domaluj, glos: g })).catch(() => {});
        return z;
    }

    const start = teraz();
    async function lista() {
        const out = [];
        for (const d of await fs.readdir(KAT).catch(() => [])) {
            if (!ID.test(d)) continue;
            try {
                const z = await czytaj(d);
                if (['czeka', 'obrazy', 'glos', 'wideo', 'audiobook', 'wczytuje'].includes(z.stan) && !pracuje.has(z.id) && !(z.stan === 'czeka' && Date.parse(z.kroki?.at(-1)?.kiedy ?? 0) >= start)) {
                    Object.assign(z, { stan: 'blad', powod: 'przerwane — most wystartował od nowa w trakcie' }); krok(z, `⛔ ${z.powod}`); await zapisz(z);
                }
                out.push(skrot(z));
            } catch { /* uszkodzony — pomijamy */ }
        }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }
    const skrot = (z) => ({ id: z.id, stan: z.stan, tytul: z.tytul, autor: z.autor, rodzaj: z.rodzaj, plik: z.plik, scen: z.sceny?.length ?? 0, utworzono: z.utworzono, powod: z.powod ?? null,
        krok: z.kroki?.at(-1)?.opis ?? null, youtube: z.youtube ?? null, wypozyczalnia: z.wypozyczalnia ?? null });
    /** Widok dla Huba: bez bloków źródła (duże), sceny z adresami obrazów. */
    async function widok(id) {
        const z = await czytaj(id);
        const { bloki: _b, ...reszta } = z;
        return { ...reszta, wideo: z.wideo ? path.basename(z.wideo) : null,
            sceny: (z.sceny ?? []).map((s) => ({ ...s, obrazUrl: s.obraz ? adres(z.id, 'obrazy', s.obraz.plik) : null, audioUrl: s.audio ? adres(z.id, 'audio', s.audio) : null })) };
    }

    function plik(id, kat, nazwa) {
        if (!ID.test(String(id)) || !['obrazy', 'audio'].includes(kat) || !/^[a-z0-9-]{1,40}\.(png|jpg|mp3)$/.test(String(nazwa))) return null;
        const p = path.join(dir(id), kat, nazwa);
        return fsSync.existsSync(p) ? p : null;
    }
    /** `/api/manuskrypt/<id>/plik/<obrazy|audio>/<plik>` → plik na dysku (Wypożyczalnia kopiuje przy publikacji). */
    function plikZAdresu(url) { const m = /\/api\/manuskrypt\/(mk-[0-9a-f]{8})\/plik\/(obrazy|audio)\/([a-z0-9.-]+)$/.exec(String(url ?? '')); return m ? plik(m[1], m[2], m[3]) : null; }
    async function plikWideo(id) { const z = await czytaj(id); return z.wideo && fsSync.existsSync(z.wideo) ? z.wideo : null; }
    async function plikAudiobooka(id) { const z = await czytaj(id); const p = path.join(dir(z.id), 'audiobook.mp3'); return z.stan === 'gotowe' && fsSync.existsSync(p) ? { p, nazwa: `${slug(z.tytul) || 'audiobook'}.mp3` } : null; }

    async function doYouTube(id) {
        const z = await czytaj(id);
        if (z.stan !== 'gotowe' || !z.wideo) throw new Error('Najpierw wyprodukuj film.');
        if (!cfg.publikujYT) throw new Error('Publikacje YouTube niedostępne.');
        const kontekst = `Audiobook z ilustracjami — książka „${z.tytul}”${z.autor ? `, autor: ${z.autor}` : ''}. Czyta lektor Głosek (głos syntetyczny Katedry OtakOS). Ilustracje: ${z.sceny.some((s) => s.obraz?.zrodlo === 'paleta') ? 'autora, część domalowana przez AI (FLUX)' : 'autora książki'}.\nPoczątek tekstu: ${z.sceny.slice(0, 2).map(tekstLektora).join(' ').slice(0, 1500)}`;
        const p = await cfg.publikujYT({ plik: z.wideo, nazwa: `${z.tytul} — audiobook`, jezyk: z.jezyk, kontekst, zrodlo: { projekt: PROJEKT, manuskrypt: z.id } });
        z.youtube = { id: p.id, etap: p.etap }; krok(z, `📺 do publikacji YouTube (${p.etap}) — wysyłka dopiero po ✓ w Izbie`); await zapisz(z);
        return { publikacja: p };
    }
    async function doWypozyczalni(id, { rentalTier = 'demo', cenaEur } = {}) {
        const z = await czytaj(id);
        if (z.stan !== 'gotowe' || !z.ksiega) throw new Error('Najpierw wyprodukuj Żywą Księgę.');
        if (!cfg.publikujWypozyczalnia) throw new Error('Wypożyczalnia niedostępna.');
        const wpis = await cfg.publikujWypozyczalnia({ book: z.ksiega, rentalTier, cenaEur });
        z.wypozyczalnia = { id: wpis.id, tier: wpis.tier, cenaEur: wpis.cenaEur }; krok(z, `📚 w Wypożyczalni teostory.studio (${wpis.tier}${wpis.cenaEur ? `, ${wpis.cenaEur} €` : ''})`); await zapisz(z);
        return { wpis };
    }

    async function usun(id) {
        const z = await czytaj(id);
        if (pracuje.has(z.id)) throw new Error('Manuskrypt właśnie się produkuje.');
        const kosz = path.join(KAT, '_kosz');
        await fs.mkdir(kosz, { recursive: true });
        await fs.rename(dir(z.id), path.join(kosz, `${z.id}-${Date.now()}`));
        return { usuniety: z.id };
    }

    return { nowy, przepodziel, ilustracjaSceny, produkuj, lista, widok, czytaj, plik, plikZAdresu, plikWideo, plikAudiobooka, doYouTube, doWypozyczalni, usun };
}

/** Trasy (Straż `/api/manuskrypt`: tylko maszyna). */
export function zamontujTrasyManuskryptu(app, M) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message, ...(e.zadanie ? { zadanie: { id: e.zadanie.id } } : {}) }));
    app.get('/api/manuskrypt', (_req, res) => odp(res, M.lista().then((manuskrypty) => ({ manuskrypty }))));
    app.post('/api/manuskrypt', (req, res) => odp(res, M.nowy(req.body ?? {}).then((z) => M.widok(z.id)).then((zadanie) => ({ zadanie }))));
    app.get('/api/manuskrypt/:id', (req, res) => odp(res, M.widok(req.params.id).then((zadanie) => ({ zadanie }))));
    app.post('/api/manuskrypt/:id/podziel', (req, res) => odp(res, M.przepodziel(req.params.id, req.body ?? {}).then((z) => M.widok(z.id)).then((zadanie) => ({ zadanie }))));
    app.post('/api/manuskrypt/:id/scena/:nr/ilustracja', (req, res) => odp(res, M.ilustracjaSceny(req.params.id, req.params.nr, req.body ?? {}).then((z) => M.widok(z.id)).then((zadanie) => ({ zadanie }))));
    app.post('/api/manuskrypt/:id/produkuj', (req, res) => odp(res, M.produkuj(req.params.id, req.body ?? {}).then((z) => M.widok(z.id)).then((zadanie) => ({ zadanie }))));
    app.post('/api/manuskrypt/:id/youtube', (req, res) => odp(res, M.doYouTube(req.params.id)));
    app.post('/api/manuskrypt/:id/wypozyczalnia', (req, res) => odp(res, M.doWypozyczalni(req.params.id, req.body ?? {})));
    app.get('/api/manuskrypt/:id/plik/:kat/:plik', (req, res) => { const p = M.plik(req.params.id, req.params.kat, req.params.plik); return p ? res.sendFile(p) : res.status(404).end(); });
    app.get('/api/manuskrypt/:id/wideo', async (req, res) => { const p = await M.plikWideo(req.params.id).catch(() => null); return p ? res.sendFile(p) : res.status(404).end(); });
    app.get('/api/manuskrypt/:id/audiobook', async (req, res) => { const a = await M.plikAudiobooka(req.params.id).catch(() => null); return a ? res.download(a.p, a.nazwa) : res.status(404).end(); });
    app.delete('/api/manuskrypt/:id', (req, res) => odp(res, M.usun(req.params.id)));
}

export default { utworzManuskrypt, zamontujTrasyManuskryptu, podzielNaSceny, blokiZTxt, blokiZDocx, stronyZPdf, rodzajPliku, normalizuj };
