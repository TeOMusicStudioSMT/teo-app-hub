/**
 * 📻🎁 Boxy Muzyki 0.00G — albumy Suwerena z dysku jako stacje Jukeboxa.
 *
 * Box 01 (Zero Gravity Heart) to opublikowane Żywe Księgi i zostaje tam, gdzie był — ma okładki, akty,
 * tempo i bramkę wypożyczenia. Boxy 02+ to SUROWE albumy z `_OtakOs_Muzyka/OtakOS RADIO Album's`:
 * mastery .wav po 25–68 MB. Nie da się ich podać światu wprost — jeden utwór to tyle, co cały album
 * w mp3, a idzie przez domowy tunel Katedry. Dlatego Box ma RENDYCJE: przy pierwszym sięgnięciu po
 * utwór most przepisuje go raz na mp3 192 kb/s do `jukebox/boxy/<box>/<nr>.mp3` i od tej pory podaje
 * gotowy plik (z obsługą `Range`, żeby dało się przewijać). Oryginały zostają nietknięte.
 *
 * Co Box WIE, a czego nie: tytuł i artystę czyta z nazwy pliku (`TeOello - Onyks (Orion SMT) (C).wav`),
 * bo tyle jest na dysku. Tempa (BPM) nie zna — partytura z Boxu nie powstanie, dopóki utwór nie
 * przejdzie przez Opodysk. Mówimy o tym wprost zamiast zgadywać liczby.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const AUDIO = /\.(wav|mp3|flac|m4a|aiff?)$/i;
export const ID_BOXU = /^[a-z0-9][a-z0-9-]{1,48}$/;
export const BITRATE = '192k';
/** Domyślna mapa Boxów — foldery albumów Suwerena. Suweren zmienia ją w `jukebox/boxy.json`. */
export const BOXY_DOMYSLNE = [
    { id: 'box-02-solar-pulse', nazwa: 'Solar Pulse', katalog: '2Solar Puso', artysci: 'TeO · 0.00G', opis: 'Box 02 — dziesięć stacji Solar Pulse' },
    { id: 'box-03-hidengirl', nazwa: 'The Story Of HidenGirl', katalog: '3The life of hiden girl', artysci: 'Elara S.M.T. · Kael SMT · Orion SMT', opis: 'Box 03 — opowieść TeOello' },
];

/** `03. Neon Rain (Kael SMT) (A).wav` → { nr: 3, tytul: 'Neon Rain', artysta: 'Kael SMT' }. */
export function zNazwyPliku(nazwa, domyslnyNr) {
    const bez = nazwa.replace(AUDIO, '');
    const mNr = /^\s*(\d{1,2})\s*[.\-_)]/.exec(bez);
    let t = mNr ? bez.slice(mNr[0].length) : bez;
    t = t.replace(/^\s*[\w.]*TeOello\s*[-–]\s*/i, '').trim();            // wspólny przedrostek albumu
    const mArt = /\(([^)]*(?:S\.?M\.?T\.?)[^)]*)\)/i.exec(t);            // artysta bywa w nawiasie: (Orion SMT)
    const artysta = mArt ? mArt[1].trim() : null;
    t = t.replace(/\([^)]*\)/g, ' ').replace(/\s{2,}/g, ' ').replace(/[\s_-]+$/, '').trim();
    return { nr: mNr ? Number(mNr[1]) : domyslnyNr, tytul: t || bez.trim(), artysta };
}

export function utworzBoxy({ katalogMuzyki, katalogWydan, ffmpeg = null, uruchom = null, teraz = () => Date.now() }) {
    const PLIK = path.join(katalogWydan, 'boxy.json'), KAT = path.join(katalogWydan, 'boxy');
    const json = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const pisz = async (p, o) => { await fs.mkdir(path.dirname(p), { recursive: true }); const t = `${p}.${process.pid}.tmp`; await fs.writeFile(t, JSON.stringify(o, null, 2)); await fs.rename(t, p); };
    let kolej = Promise.resolve();
    const poKolei = (fn) => { const p = kolej.then(fn, fn); kolej = p.catch(() => {}); return p; };

    /** Mapa Boxów: z pliku Suwerena, a gdy go nie ma — domyślna, zapisana przy pierwszym użyciu. */
    async function mapa() {
        const d = await json(PLIK, null);
        if (Array.isArray(d?.boxy) && d.boxy.length) return d.boxy.filter((b) => ID_BOXU.test(String(b?.id ?? '')) && b.katalog);
        const istnieja = BOXY_DOMYSLNE.filter((b) => fsSync.existsSync(path.join(katalogMuzyki, b.katalog)));
        if (istnieja.length) await pisz(PLIK, { boxy: istnieja, zapisano: new Date(teraz()).toISOString() });
        return istnieja;
    }

    /** Utwory Boxu z dysku — posortowane po numerze z nazwy, bez wchodzenia poza katalog albumu. */
    async function utwory(box) {
        const kat = path.resolve(katalogMuzyki, box.katalog);
        if (!kat.startsWith(path.resolve(katalogMuzyki))) throw Object.assign(new Error('Box poza katalogiem muzyki.'), { kod: 400 });
        const znalezione = [];
        const wejdz = async (d, glebokosc) => {
            for (const w of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
                const p = path.join(d, w.name);
                if (w.isDirectory() && glebokosc < 2) await wejdz(p, glebokosc + 1);
                else if (w.isFile() && AUDIO.test(w.name)) znalezione.push({ plik: p, nazwa: w.name, katalog: path.basename(d) });
            }
        };
        await wejdz(kat, 0);
        // numer bierzemy z nazwy pliku, a gdy jej brak — z nazwy podkatalogu („3. The Graviton Streams”)
        let lista = znalezione.map((z, i) => {
            const zPliku = zNazwyPliku(z.nazwa, 0);
            const zKatalogu = /^\s*(\d{1,2})\s*[.\-_)]/.exec(z.katalog);
            const nr = zPliku.nr || (zKatalogu ? Number(zKatalogu[1]) : i + 1);
            return { ...zPliku, nr, plik: z.plik, nazwaPliku: z.nazwa };
        });
        // `pomin` zdejmuje z Boxu pliki, które są na dysku, ale nie należą do albumu (dublety, wersje robocze)
        const pomin = (box.pomin ?? []).map(String);
        if (pomin.length) lista = lista.filter((u) => !pomin.includes(u.nazwaPliku));
        // `kolejnosc` = prawdziwa kolejność albumu (nazwy plików po kolei). Czego w niej nie ma — ląduje na końcu.
        const kolejnosc = (box.kolejnosc ?? []).map(String);
        if (kolejnosc.length) lista.sort((a, b) => {
            const ia = kolejnosc.indexOf(a.nazwaPliku), ib = kolejnosc.indexOf(b.nazwaPliku);
            return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib) || a.tytul.localeCompare(b.tytul);
        });
        else lista.sort((a, b) => a.nr - b.nr || a.tytul.localeCompare(b.tytul));
        return lista.map((u, i) => ({ ...u, nr: i + 1 }));   // numeracja ciągła, bez dziur po duplikatach
    }

    // Nazwa rendycji idzie od PLIKU ŹRÓDŁOWEGO, nie od numeru w albumie — dzięki temu zmiana kolejności
    // albo usunięcie dubla nie unieważnia tego, co już przepisane.
    const plikRendycji = (boxId, u) => path.join(KAT, boxId, `${crypto.createHash('sha1').update(String(u.nazwaPliku)).digest('hex').slice(0, 16)}.mp3`);

    /** Rendycja mp3 — raz na utwór, po kolei (ffmpeg zjada rdzenie, a Katedra ma swoje zajęcia). */
    const przygotuj = (box, u) => poKolei(async () => {
        const cel = plikRendycji(box.id, u);
        if (await fs.access(cel).then(() => true, () => false)) return cel;
        if (!ffmpeg || !uruchom) throw Object.assign(new Error('Most nie ma ffmpeg — Boxu nie da się przygotować.'), { kod: 503 });
        await fs.mkdir(path.dirname(cel), { recursive: true });
        const tmp = `${cel}.${process.pid}.tmp.mp3`;
        await uruchom(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', u.plik, '-vn', '-c:a', 'libmp3lame', '-b:a', BITRATE, '-ar', '44100', tmp], { windowsHide: true, timeout: 10 * 60_000, maxBuffer: 1 << 24 });
        await fs.rename(tmp, cel);
        return cel;
    });

    /** Publiczny spis Boxów — ile utworów i ile już gotowych do podania. */
    async function spis() {
        const out = [];
        for (const b of await mapa()) {
            const u = await utwory(b).catch(() => []);
            let gotowych = 0;
            for (const x of u) if (await fs.access(plikRendycji(b.id, x)).then(() => true, () => false)) gotowych += 1;
            out.push({ id: b.id, nazwa: b.nazwa ?? b.id, artysci: b.artysci ?? null, opis: b.opis ?? null, utworow: u.length, gotowych });
        }
        return out;
    }

    async function box(id) {
        const b = (await mapa()).find((x) => x.id === String(id));
        if (!b) throw Object.assign(new Error('Nie ma takiego Boxu.'), { kod: 404 });
        return b;
    }
    /** Spis utworów Boxu dla przeglądarki: numer, tytuł, artysta i adres dźwięku. Bez ścieżek z dysku. */
    async function utworyPubliczne(id) {
        const b = await box(id);
        const u = await utwory(b);
        return { id: b.id, nazwa: b.nazwa ?? b.id, artysci: b.artysci ?? null,
            utwory: u.map((x) => ({ nr: x.nr, tytul: x.tytul, artysta: x.artysta ?? b.artysci ?? null, url: `/wizytowka/jukebox/box/${encodeURIComponent(b.id)}/${x.nr}.mp3` })) };
    }
    /**
     * Utwory Boxu z ODCISKIEM pliku źródłowego — klucz paczki wydawniczej (Canvas, pergamin).
     * Ten sam odcisk, co nazwa rendycji mp3, więc zmiana kolejności w albumie nie gubi tego,
     * co już złożone. Tylko dla maszyny Suwerena: nazwy plików z dysku zostają w środku.
     */
    async function utworyZOdciskiem(id) {
        const b = await box(id);
        return { box: b, utwory: (await utwory(b)).map((x) => ({ nr: x.nr, tytul: x.tytul, artysta: x.artysta ?? b.artysci ?? null, odcisk: odcisk(x.nazwaPliku) })) };
    }
    /**
     * 🎛️ Źródło utworu dla maszyny Suwerena: master z dysku (zwykle .wav), nazwa pliku i odcisk.
     * Tym żyje import Boxu do Jasona (`JasonOrchestrator.importujBox`) — paczka wydawnicza składa
     * `master.wav` z ORYGINAŁU, nie z rendycji mp3, więc nie tracimy jakości po drodze.
     * NIGDY nie oddajemy tego publicznie: ścieżki z dysku zostają w Katedrze.
     */
    async function zrodloUtworu(id, nr) {
        const b = await box(id);
        const u = (await utwory(b)).find((x) => x.nr === Number(nr));
        if (!u) throw Object.assign(new Error('Nie ma takiego utworu w Boxie.'), { kod: 404 });
        return { box: b, nr: u.nr, tytul: u.tytul, artysta: u.artysta ?? b.artysci ?? null, odcisk: odcisk(u.nazwaPliku),
            plik: u.plik, nazwaPliku: u.nazwaPliku, katalog: path.dirname(u.plik), katalogBoxu: path.resolve(katalogMuzyki, b.katalog) };
    }
    /** Ścieżka gotowego mp3 — przygotowuje rendycję, jeśli jej jeszcze nie ma. */
    async function plikUtworu(id, nr) {
        const b = await box(id);
        const u = (await utwory(b)).find((x) => x.nr === Number(nr));
        if (!u) throw Object.assign(new Error('Nie ma takiego utworu w Boxie.'), { kod: 404 });
        return przygotuj(b, u);
    }
    /** Przygotowuje cały Box (Hub Suwerena) — żeby pierwszy słuchacz nie czekał na ffmpeg. */
    async function przygotujBox(id) {
        const b = await box(id);
        const u = await utwory(b);
        let zrobione = 0;
        for (const x of u) { await przygotuj(b, x); zrobione += 1; }
        return { id: b.id, utworow: u.length, zrobione };
    }
    const odcisk = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
    return { mapa, spis, utworyPubliczne, utworyZOdciskiem, zrodloUtworu, plikUtworu, przygotujBox, odcisk };
}

/** Wysyła mp3 z obsługą `Range` — bez tego przeglądarka nie przewinie utworu. */
export async function podajAudio(res, req, plik) {
    const st = await fs.stat(plik);
    const zakres = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
    const naglowki = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' };
    if (!zakres) { res.writeHead(200, { ...naglowki, 'Content-Length': st.size }); return fsSync.createReadStream(plik).pipe(res); }
    const od = zakres[1] ? Number(zakres[1]) : 0;
    const do_ = zakres[2] ? Math.min(Number(zakres[2]), st.size - 1) : st.size - 1;
    if (!(od >= 0 && od <= do_ && do_ < st.size)) { res.writeHead(416, { ...naglowki, 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...naglowki, 'Content-Range': `bytes ${od}-${do_}/${st.size}`, 'Content-Length': do_ - od + 1 });
    return fsSync.createReadStream(plik, { start: od, end: do_ }).pipe(res);
}

/** Trasy: publiczne `/wizytowka/jukebox/boxy|box/*`, Hub `/api/jukebox/boxy/*` (tylko maszyna). */
export function zamontujTrasyBoxow(app, B, { limitNaMinute = 60 } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    const cors = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'Content-Type, Range'); res.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length'); };
    const proby = new Map();
    const limit = (req, n) => { const ip = req.ip || '?', t = Date.now(), l = (proby.get(ip) ?? []).filter((x) => t - x < 60_000); if (l.length >= n) return false; proby.set(ip, [...l, t]); return true; };

    app.get('/wizytowka/jukebox/boxy', (_req, res) => { cors(res); odp(res, B.spis().then((boxy) => ({ boxy }))); });
    app.get('/wizytowka/jukebox/box/:box', (req, res) => { cors(res); odp(res, B.utworyPubliczne(req.params.box)); });
    app.get('/wizytowka/jukebox/box/:box/:nr.mp3', async (req, res) => {
        cors(res);
        if (!limit(req, limitNaMinute)) return res.status(429).json({ success: false, message: 'Za dużo zapytań — spróbuj za minutę.' });
        try { return await podajAudio(res, req, await B.plikUtworu(req.params.box, req.params.nr)); }
        catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }); }
    });
    // Hub Suwerena
    app.get('/api/jukebox/boxy', (_req, res) => odp(res, B.spis().then((boxy) => ({ boxy }))));
    app.post('/api/jukebox/boxy/:box/przygotuj', (req, res) => odp(res, B.przygotujBox(req.params.box)));
}

export default { utworzBoxy, zamontujTrasyBoxow, podajAudio, zNazwyPliku, BOXY_DOMYSLNE };
