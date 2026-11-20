/**
 * 📻📦 Paczka wydawnicza utworu Boxu — Spotify Canvas i Rolowany Pergamin.
 *
 * Boxy 02 i 03 to albumy mp3 podawane prosto z Katedry (`BoxyMuzyki.js`): nie przeszły przez linię
 * Jasona, więc nie mają kampanii, storyboardu ani paczki Spotify. Teatr Opodysku bierze WYŁĄCZNIE
 * kampanie Jasona ze stanem „przyjęta”, dlatego tych utworów tam nie widać (Suweren, 2026-11-19).
 *
 * Ten moduł daje im to, co i tak wychodzi z samego DŹWIĘKU, bez storyboardu i bez karty graficznej:
 *   • 📱 Spotify Canvas — pętla 8 s, 9:16, 1080×1920, bez dźwięku,
 *   • 📜 Rolowany Pergamin — wstęga partytury (SVG + PNG z przeglądarki, PDF z Chrome mostu).
 * Akty z kadrami FLUX i Żywa Księga zostają przy Jasonie — tam, gdzie jest storyboard.
 *
 * Klucz paczki to ODCISK PLIKU ŹRÓDŁOWEGO, nie numer w albumie — tak samo jak rendycje mp3.
 * Dzięki temu zmiana kolejności utworów albo usunięcie dubla nie unieważnia tego, co już złożone.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { htmlPergaminu, sprawdzSvg } from './DrukOpodysku.js';
import { dlugoscPliku } from './Opodysk.js';

export const PLIK_CANVAS = 'spotify_canvas_9x16_8s.mp4';
export const PLIKI_PERGAMINU = { svg: 'pergamin_000g.svg', png: 'pergamin_000g.png', pdf: 'pergamin_000g.pdf' };
export const WARIANTY_CANVAS = ['fuzja', 'teofon'];
/** Co wolno pobrać z paczki — biała lista, nazwa z przeglądarki nigdy nie składa ścieżki. */
export const RODZAJE = { canvas: PLIK_CANVAS, ...PLIKI_PERGAMINU };
const MAX_PNG = 60 * 1024 * 1024;

const blad = (m, kod = 400) => Object.assign(new Error(m), { kod, status: kod });
const liczba = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

export function utworzWydaniaBoxow({ boxy, katalogWydan, ffmpeg = null, uruchom = null, pdf = null, qr = null, wiesc = () => {} }) {
    const KAT = path.resolve(katalogWydan);
    const katalogUtworu = (boxId, odcisk) => path.join(KAT, boxId, 'wydania', odcisk);
    const plikOpisu = (boxId, odcisk) => `${katalogUtworu(boxId, odcisk)}.json`;

    const czytaj = async (boxId, odcisk) => {
        try { return JSON.parse(await fs.readFile(plikOpisu(boxId, odcisk), 'utf8')); } catch { return {}; }
    };
    const zapisz = async (boxId, odcisk, d) => {
        await fs.mkdir(path.dirname(plikOpisu(boxId, odcisk)), { recursive: true });
        await fs.writeFile(plikOpisu(boxId, odcisk), JSON.stringify(d, null, 1), 'utf8');
        return d;
    };

    /** Utwór Boxu razem z odciskiem — jedyne miejsce, które tłumaczy numer na klucz paczki. */
    async function utwor(boxId, nr) {
        const { box, utwory } = await boxy.utworyZOdciskiem(String(boxId));
        const u = utwory.find((x) => x.nr === Number(nr));
        if (!u) throw blad('Nie ma takiego utworu w Boxie.', 404);
        return { box, u };
    }

    const adresy = (boxId, nr, d) => {
        const b = `/api/jukebox/boxy/${encodeURIComponent(boxId)}/utwor/${nr}`;
        return {
            canvas: d.canvas ? { url: `${b}/canvas/wideo?v=${d.canvas.wersja ?? 1}`, sekundy: d.canvas.sekundy ?? 8, wariant: d.canvas.wariant ?? null, od: d.canvas.od ?? null, bajtow: d.canvas.bajtow ?? null } : null,
            pergamin: d.pergamin ? {
                ...Object.fromEntries(Object.keys(PLIKI_PERGAMINU).filter((r) => d.pergamin[r]).map((r) => [r, `${b}/pergamin/${r}?v=${d.pergamin.wersja ?? 1}`])),
                szer: d.pergamin.szer ?? null, wys: d.pergamin.wys ?? null, uwaga: d.pergamin.uwaga ?? null,
            } : null,
        };
    };

    /** Stan Boxu dla panelu: utwory z tempem i tym, co już leży w paczce. */
    async function stan(boxId) {
        const { box, utwory } = await boxy.utworyZOdciskiem(String(boxId));
        const out = [];
        for (const u of utwory) {
            const d = await czytaj(box.id, u.odcisk);
            out.push({
                nr: u.nr, tytul: u.tytul, artysta: u.artysta ?? box.artysci ?? null, odcisk: u.odcisk,
                audio: `/wizytowka/jukebox/box/${encodeURIComponent(box.id)}/${u.nr}.mp3`,
                bpm: liczba(d.bpm), sekundy: liczba(d.sekundy), ...adresy(box.id, u.nr, d),
            });
        }
        return { id: box.id, nazwa: box.nazwa ?? box.id, artysci: box.artysci ?? null, utwory: out };
    }

    /**
     * Tempo i długość zmierzone w przeglądarce (ten sam silnik, co w Szafie Grającej).
     * Bez nich partytura nie powstanie, a Canvas nie ma czego rysować.
     */
    async function ustawTempo(boxId, nr, { bpm, sekundy } = {}) {
        const { box, u } = await utwor(boxId, nr);
        const b = liczba(bpm), s = liczba(sekundy);
        if (!(b > 30 && b < 300)) throw blad('Tempo poza zakresem 30–300 BPM.');
        if (!(s > 1 && s < 3600)) throw blad('Długość utworu poza zakresem 1 s – 1 h.');
        const d = await czytaj(box.id, u.odcisk);
        await zapisz(box.id, u.odcisk, { ...d, tytul: u.tytul, bpm: Math.round(b * 100) / 100, sekundy: Math.round(s * 100) / 100, kiedy: new Date().toISOString() });
        return { bpm: Math.round(b * 100) / 100, sekundy: Math.round(s * 100) / 100 };
    }

    // ── 📱 Spotify Canvas ──
    let renderowany = null;
    /** webm z przeglądarki → mp4 1080×1920, 30 kl/s, bez dźwięku, DOKŁADNIE 8,0 s (sprawdzane po kodowaniu). */
    async function zapiszCanvas(boxId, nr, bufor, { wariant = 'fuzja', od = null, trwaloMs = null } = {}) {
        const { box, u } = await utwor(boxId, nr);
        if (!WARIANTY_CANVAS.includes(wariant)) throw blad('Wariant Canvas: fuzja albo teofon.');
        if (!ffmpeg || !uruchom) throw blad('Most nie ma podłączonego ffmpeg.', 409);
        if (!Buffer.isBuffer(bufor) || bufor.length < 20_000) throw blad('Nagranie Canvas jest puste albo za małe.');
        if (trwaloMs != null && trwaloMs < 7500) throw blad(`Nagranie trwało ${(trwaloMs / 1000).toFixed(1)} s — Canvas ma 8 s; nie zapisuję urwanego.`, 422);
        if (renderowany) throw blad('Most właśnie przelicza inny Canvas — poczekaj chwilę.', 409);
        renderowany = `${box.id}/${nr}`;
        const kat = katalogUtworu(box.id, u.odcisk), praca = path.join(kat, '.canvas');
        try {
            await fs.mkdir(kat, { recursive: true });
            await fs.rm(praca, { recursive: true, force: true }); await fs.mkdir(praca, { recursive: true });
            const we = path.join(praca, 'we.webm'), wy = path.join(praca, 'canvas.mp4');
            await fs.writeFile(we, bufor);
            await uruchom(ffmpeg, ['-loglevel', 'error', '-y', '-i', we,
                '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,tpad=stop_mode=clone:stop_duration=2,trim=duration=8,setpts=PTS-STARTPTS',
                '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', wy],
                { windowsHide: true, timeout: 5 * 60_000, maxBuffer: 1 << 24 });
            const sekundy = await dlugoscPliku(ffmpeg, uruchom, wy);
            if (!(sekundy > 7.9 && sekundy < 8.1)) throw blad(`Po przeliczeniu Canvas trwa ${sekundy ?? '?'} s, a ma 8,0 — nie zapisuję.`, 422);
            const cel = path.join(kat, PLIK_CANVAS);
            await fs.rename(wy, cel).catch(async () => { await fs.copyFile(wy, cel); });
            const bajtow = (await fs.stat(cel)).size;
            const d = await czytaj(box.id, u.odcisk);
            const canvas = { plik: PLIK_CANVAS, wariant, od: liczba(od) == null ? null : Math.round(liczba(od) * 100) / 100, sekundy: 8, bajtow, wersja: (Number(d.canvas?.wersja) || 0) + 1, kiedy: new Date().toISOString() };
            await zapisz(box.id, u.odcisk, { ...d, tytul: u.tytul, canvas });
            wiesc(`📱 Box: Spotify Canvas „${u.tytul}” (${box.nazwa ?? box.id}, ${wariant === 'teofon' ? 'skaner pergaminu' : 'fuzja partytury'}, 8 s · 9:16) gotowy.`);
            return { canvas: adresy(box.id, nr, { canvas }).canvas, plik: PLIK_CANVAS, bajtow, od: canvas.od };
        } finally { renderowany = null; await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); }
    }

    // ── 📜 Rolowany Pergamin ──
    /** Treść kodu optycznego. Format `teofon://` jest NASZ — specyfikacji urządzenia w Katedrze nie ma. */
    async function kod(boxId, nr) {
        const { box, u } = await utwor(boxId, nr);
        const d = await czytaj(box.id, u.odcisk);
        const tresc = `teofon://box-000g/${box.id}?utwor=${u.nr}&bpm=${d.bpm ?? ''}&sek=${Math.round(d.sekundy ?? 0)}&tytul=${encodeURIComponent(String(u.tytul).slice(0, 60))}`;
        return { tresc, ...(qr ? qr(tresc) : { rozmiar: 0, wiersze: [] }) };
    }
    let drukowany = null;
    async function zapiszPergamin(boxId, nr, { svg, png = null } = {}) {
        const { box, u } = await utwor(boxId, nr);
        const { szer, wys } = sprawdzSvg(svg);
        if (drukowany) throw blad('Most właśnie drukuje inny pergamin — poczekaj chwilę.', 409);
        drukowany = `${box.id}/${nr}`;
        const kat = katalogUtworu(box.id, u.odcisk), praca = path.join(kat, '.pergamin');
        try {
            await fs.mkdir(praca, { recursive: true });
            const pliki = {};
            await fs.writeFile(path.join(kat, PLIKI_PERGAMINU.svg), svg, 'utf8'); pliki.svg = PLIKI_PERGAMINU.svg;
            const m = /^data:image\/png;base64,(.+)$/i.exec(String(png ?? ''));
            if (m) {
                const b = Buffer.from(m[1], 'base64');
                if (b.length > MAX_PNG) throw blad('PNG za duży (limit 60 MB).');
                await fs.writeFile(path.join(kat, PLIKI_PERGAMINU.png), b); pliki.png = PLIKI_PERGAMINU.png;
            }
            let uwaga = null;
            if (pdf) {
                await fs.writeFile(path.join(praca, 'index.html'), htmlPergaminu(svg, szer, wys), 'utf8');
                const tmp = path.join(kat, `${PLIKI_PERGAMINU.pdf}.tmp.pdf`);
                try { await pdf({ plikHtml: path.join(praca, 'index.html'), wyjscie: tmp }); await fs.rename(tmp, path.join(kat, PLIKI_PERGAMINU.pdf)); pliki.pdf = PLIKI_PERGAMINU.pdf; }
                catch (e) { await fs.rm(tmp, { force: true }).catch(() => {}); uwaga = `PDF nie powstał: ${String(e.message ?? e).slice(0, 240)}`; }
            } else uwaga = 'Most nie ma puppeteera (Chrome) — PDF nie powstał; SVG i PNG są w paczce.';
            const d = await czytaj(box.id, u.odcisk);
            const pergamin = { ...pliki, szer, wys, uwaga, wersja: (Number(d.pergamin?.wersja) || 0) + 1, kiedy: new Date().toISOString() };
            await zapisz(box.id, u.odcisk, { ...d, tytul: u.tytul, pergamin });
            wiesc(`📜 Box: Rolowany Pergamin „${u.tytul}” (${box.nazwa ?? box.id}) zapisany — ${Math.round(szer)}×${Math.round(wys)} px${pliki.pdf ? ', z PDF' : ''}.`);
            return { pergamin: adresy(box.id, nr, { pergamin }).pergamin, uwaga };
        } finally { drukowany = null; await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); }
    }

    /**
     * 🌍 Paczki Boxu dla świata (portal teostory.studio). Oddajemy tylko to, co NAPRAWDĘ leży na dysku —
     * opis w JSON-ie mógłby zostać po przeniesionym pliku, a karta w Jukeboxie pokazałaby wtedy martwy link.
     * Sterowanie (zapis, tempo) zostaje przy maszynie Suwerena, pod `/api/jukebox`.
     */
    async function publiczne(boxId) {
        const { box, utwory } = await boxy.utworyZOdciskiem(String(boxId));
        const out = [];
        for (const u of utwory) {
            const d = await czytaj(box.id, u.odcisk);
            const kat = katalogUtworu(box.id, u.odcisk);
            const jest = (n) => fsSync.existsSync(path.join(kat, n));
            const b = `/wizytowka/jukebox/box/${encodeURIComponent(box.id)}/${u.nr}`;
            const perg = Object.keys(PLIKI_PERGAMINU).filter((r) => jest(PLIKI_PERGAMINU[r]));
            out.push({
                nr: u.nr, tytul: u.tytul, bpm: liczba(d.bpm), sekundy: liczba(d.sekundy),
                canvas: jest(PLIK_CANVAS) ? { url: `${b}/canvas.mp4?v=${d.canvas?.wersja ?? 1}`, sekundy: 8, wariant: d.canvas?.wariant ?? null, od: liczba(d.canvas?.od) } : null,
                pergamin: perg.length ? { ...Object.fromEntries(perg.map((r) => [r, `${b}/pergamin.${r}?v=${d.pergamin?.wersja ?? 1}`])), szer: liczba(d.pergamin?.szer), wys: liczba(d.pergamin?.wys) } : null,
            });
        }
        return { id: box.id, nazwa: box.nazwa ?? box.id, artysci: box.artysci ?? null, utwory: out };
    }

    /** Ścieżka gotowego pliku paczki — tylko z białej listy `RODZAJE`. */
    async function sciezka(boxId, nr, rodzaj) {
        const nazwa = RODZAJE[String(rodzaj)];
        if (!nazwa) throw blad('Nie znam takiego pliku paczki.', 404);
        const { box, u } = await utwor(boxId, nr);
        const p = path.join(katalogUtworu(box.id, u.odcisk), nazwa);
        if (!fsSync.existsSync(p)) throw blad('Tego pliku jeszcze nie ma w paczce.', 404);
        return p;
    }

    return { stan, publiczne, utwor, ustawTempo, zapiszCanvas, zapiszPergamin, kod, sciezka };
}

/** Trasy Huba (Straż: `/api/jukebox` tylko przy maszynie Suwerena). `raw` dla nagrania Canvas. */
export function zamontujTrasyWydanBoxow(app, W, { raw = null } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    const B = '/api/jukebox/boxy/:box/utwor/:nr';
    app.get('/api/jukebox/boxy/:box/wydania', (req, res) => odp(res, W.stan(req.params.box)));
    app.put(`${B}/tempo`, (req, res) => odp(res, W.ustawTempo(req.params.box, req.params.nr, req.body ?? {})));
    if (raw) app.post(`${B}/canvas`, raw({ type: ['video/*', 'application/octet-stream'], limit: '400mb' }), (req, res) =>
        odp(res, W.zapiszCanvas(req.params.box, req.params.nr, req.body, { wariant: String(req.query.wariant ?? 'fuzja'), od: req.query.od, trwaloMs: Number(req.query.ms) || null })));
    app.get(`${B}/pergamin/kod`, (req, res) => odp(res, W.kod(req.params.box, req.params.nr)));
    app.post(`${B}/pergamin`, (req, res) => odp(res, W.zapiszPergamin(req.params.box, req.params.nr, req.body ?? {})));
    app.get(`${B}/canvas/wideo`, async (req, res) => {
        try { return res.type('mp4').sendFile(await W.sciezka(req.params.box, req.params.nr, 'canvas')); }
        catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }); }
    });
    app.get(`${B}/pergamin/:rodzaj`, async (req, res) => {
        try {
            const r = String(req.params.rodzaj);
            if (!['svg', 'png', 'pdf'].includes(r)) return res.status(404).json({ success: false, message: 'Nie znam takiego pliku pergaminu.' });
            return res.type(r === 'svg' ? 'image/svg+xml' : r === 'png' ? 'png' : 'pdf').sendFile(await W.sciezka(req.params.box, req.params.nr, r));
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }); }
    });

    // 🌍 Paczki Boxów dla portalu teostory.studio — publicznie, TYLKO odczyt (Straż: `SCIEZKA_BOXU`).
    // Canvas i pergamin i tak jadą na Spotify oraz do druku, więc nie ma czego chować; zapis i tempo
    // zostają wyżej, pod `/api/jukebox`, czyli przy maszynie Suwerena.
    const swiat = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Cache-Control', 'public, max-age=300'); };
    const plikSwiata = async (req, res, rodzaj, typ) => {
        try {
            const p = await W.sciezka(req.params.box, req.params.nr, rodzaj);
            swiat(res);
            return res.type(typ).sendFile(p);
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }); }
    };
    app.get('/wizytowka/jukebox/box/:box/wydania', (req, res) => { swiat(res); return odp(res, W.publiczne(req.params.box)); });
    app.get('/wizytowka/jukebox/box/:box/:nr/canvas.mp4', (req, res) => plikSwiata(req, res, 'canvas', 'mp4'));
    app.get('/wizytowka/jukebox/box/:box/:nr/pergamin.:rodzaj', (req, res) => {
        const r = String(req.params.rodzaj);
        if (!['svg', 'png', 'pdf'].includes(r)) return res.status(404).json({ success: false, message: 'Nie znam takiego pliku pergaminu.' });
        return plikSwiata(req, res, r, r === 'svg' ? 'image/svg+xml' : r === 'png' ? 'png' : 'pdf');
    });
}

export default { utworzWydaniaBoxow, zamontujTrasyWydanBoxow, PLIK_CANVAS, PLIKI_PERGAMINU, RODZAJE, WARIANTY_CANVAS };
