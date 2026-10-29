/**
 * 📖 Żywa Księga (Suweren 2026-10-29: „magiczna książka… zostawiam parę słów, a stado dotworzy obrazki, filmy…
 * mogę tam dodać nagranie żywych słów z swą facjatą… pokazać się światu”). Prototyp z Gemini Canvas
 * (`_OtakOs_Components/zywa_ksi_ga_multimedialny_dziennik.tsx`) stał na Firestore Canvasa, nagranie się nie zapisywało,
 * a „media od Stada” dokładał ręcznie każdy gość — tu wszystko jest naprawdę i lokalnie.
 *
 * Wpis = katalog `<katalog>/zywa-ksiega/<id>/` {wpis.json, zdjecie.jpg?, nagranie.mp4?, ilustracja.png?}:
 *  - Iskra Suwerena (tekst ≤ 4000) + opcjonalne zdjęcie (dowolny obraz → ffmpeg → JPEG ≤ 2048 px BEZ metadanych —
 *    EXIF z GPS i aparatem nie wychodzi do świata) + nagranie twarzy (webm/mp4 → ffmpeg → mp4) + rysunki AniDoodle Suwerena;
 *  - stado dotwarza samo, po kolei, jeden wpis naraz: SŁOWO (Kronikarz, model przydziału — odpowiedź na Iskrę, nic nie
 *    dopowiada) i ILUSTRACJA (Paleta, FLUX przez ComfyUI — symboliczny obraz w stylu iluminowanego rękopisu, opis kadru
 *    pisze Kronikarz w tym samym zapytaniu). Każdy dodatek ma autora, stan (czeka/robi/gotowe/blad) i powód.
 * Restart w trakcie = „robi” → błąd z powodem (↻ ponów). Usunięcie = `_kosz/` (nigdy w nicość).
 * Publiczny odczyt (wizytówka, otakos.wtf) = krok 3, pole `publiczny` już jest.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { nagranieDoMp4 } from './OdcinkiStudia.js';

export const MAX_TEKSTU = 4000;
export const MAX_RYSUNKU = 300_000;   // JSON klatek AniDoodle
export const MAX_RYSUNKOW = 6;
export const MAX_ZDJECIA = 25 * 1024 * 1024;
export const BOK_ZDJECIA = 2048;
/** ffmpeg: obraz → JPEG, dłuższy bok ≤ BOK_ZDJECIA (nie powiększa), bez metadanych. Orientację EXIF ffmpeg stosuje sam. */
export const argumentyZdjecia = (we, wy) => ['-hide_banner', '-loglevel', 'error', '-y', '-i', we, '-frames:v', '1',
    '-vf', `scale='min(${BOK_ZDJECIA},iw)':'min(${BOK_ZDJECIA},ih)':force_original_aspect_ratio=decrease,format=yuvj420p`,
    '-map_metadata', '-1', '-q:v', '3', wy];
const ID = /^k-\d{8}-[0-9a-f]{6}$/;

export const SYSTEM_SLOWA = 'Jesteś Kronikarzem stada TeOgochi Katedry OtakOS. Suweren zostawił rano w Żywej Księdze kilka słów z przepływu. '
    + 'Odpowiadasz mu krótko i ciepło, w JEGO języku: 2–3 zdania, które oddają ducha jego słów — bez pouczania, bez dopowiadania faktów, '
    + 'których nie napisał, bez emoji i markdownu. Potem jedna linia z opisem ilustracji po ANGIELSKU: symboliczny obraz (światło, natura, '
    + 'przestrzeń, symbole), bez twarzy prawdziwych ludzi, bez napisów i liter.\n'
    + 'FORMAT (dokładnie dwie linie):\nSŁOWO: <2–3 zdania>\nOBRAZ: <opis ilustracji po angielsku, 20–60 słów>';
export const STYL_ILUSTRACJI = ', illuminated manuscript illustration on aged parchment, ink line and gold leaf, warm amber and deep cyan, '
    + 'soft glow, hand-drawn, no text, no letters, no watermark';

/** „SŁOWO: … / OBRAZ: …” → { slowo, obraz } albo null. */
export function odczytajSlowo(tekst) {
    const t = String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\*\*/g, '');
    // etykieta obrazu bywa po angielsku i w tej samej linii („… duszę. Image: a gentle flow…”) — nie może wejść do słowa
    const ETYKIETA_OBRAZU = /(?:^|\s)(?:OBRAZ|IMAGE|PICTURE|KADR)\s*:/i;
    const slowo = t.match(/S[ŁL]OWO\s*:\s*([\s\S]*)/i)?.[1]?.split(ETYKIETA_OBRAZU)[0]?.replace(/\s+/g, ' ').trim();
    const obraz = t.match(/(?:OBRAZ|IMAGE|PICTURE|KADR)\s*:\s*([\s\S]+)/i)?.[1]?.split('\n')[0]?.trim();
    if (!slowo || slowo.length < 10) return null;
    return { slowo: slowo.slice(0, 900), obraz: obraz && obraz.length >= 10 ? obraz.slice(0, 600) : null };
}

/** Rysunek AniDoodle: { klatki: [[{ kolor, grubosc, punkty: [[x,y]…] }…]] } — współrzędne 0–1, 1–3 klatki. */
export function oczyscRysunek(r) {
    const klatki = Array.isArray(r?.klatki) ? r.klatki.slice(0, 3) : [];
    const czyste = klatki.map((k) => (Array.isArray(k) ? k : []).slice(0, 400).map((s) => ({
        kolor: /^#[0-9a-f]{6}$/i.test(String(s?.kolor)) ? s.kolor : '#5b3a1a',
        grubosc: Math.max(1, Math.min(20, Number(s?.grubosc) || 3)),
        punkty: (Array.isArray(s?.punkty) ? s.punkty : []).slice(0, 2000)
            .map((p) => [Number(p?.[0]), Number(p?.[1])]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1)
            .map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]),
    })).filter((s) => s.punkty.length >= 2));
    if (!czyste.some((k) => k.length)) throw new Error('Rysunek jest pusty — narysuj choć jedną kreskę.');
    return { klatki: czyste.filter((k) => k.length) };
}

const dzisiaj = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, '');
/** `piszModelem` mostu oddaje { tekst, silnik } — przyjmujemy też goły napis. */
const tekstOdpowiedzi = (r) => (typeof r === 'string' ? r : r?.tekst ?? '');
/** ComfyUI budzony przez most mówi „wstaje” — to nie porażka, tylko chwila czekania. */
export const COMFY_WSTAJE = /wstaje|budz|startu|starting|not ready/i;

export function utworzZywaKsiege(cfg = {}) {
    const katalog = path.join(cfg.katalog ?? path.join(process.cwd(), '_OtakOs_Wymiar'), 'zywa-ksiega');
    const kosz = path.join(katalog, '_kosz');
    const dir = (id) => path.join(katalog, id);
    const plikWpisu = (id) => path.join(dir(id), 'wpis.json');
    const kolejka = [];
    let pracuje = false;
    let zapis = Promise.resolve();

    async function czytaj(id) {
        if (!ID.test(String(id))) throw new Error('Nie ma takiego wpisu.');
        try { return JSON.parse(await fs.readFile(plikWpisu(id), 'utf8')); } catch { throw new Error('Nie ma takiego wpisu.'); }
    }
    /** Zapisy po kolei (stado i Suweren mogą pisać do tego samego wpisu). */
    function zmien(id, f) {
        const krok = zapis.then(async () => {
            const w = await czytaj(id);
            await f(w);
            w.zmieniony = new Date().toISOString();
            await fs.writeFile(`${plikWpisu(id)}.tmp`, JSON.stringify(w, null, 2), 'utf8');
            await fs.rename(`${plikWpisu(id)}.tmp`, plikWpisu(id));
            return w;
        });
        zapis = krok.catch(() => {});
        return krok;
    }
    const dodatek = (w, rodzaj) => w.stado.find((s) => s.rodzaj === rodzaj);

    async function lista() {
        let nazwy = [];
        try { nazwy = (await fs.readdir(katalog)).filter((n) => ID.test(n)); } catch { /* brak katalogu = pusta Księga */ }
        const wpisy = [];
        for (const n of nazwy) { try { wpisy.push(await czytaj(n)); } catch { /* uszkodzony wpis pomijamy */ } }
        return wpisy.sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy)));
    }

    async function dodaj({ tekst, publiczny = true } = {}) {
        const t = String(tekst ?? '').trim();
        if (!t) throw new Error('Zostaw choć parę słów z przepływu.');
        if (t.length > MAX_TEKSTU) throw new Error(`Iskra może mieć do ${MAX_TEKSTU} znaków.`);
        const id = `k-${dzisiaj()}-${crypto.randomBytes(3).toString('hex')}`;
        const w = {
            id, kiedy: new Date().toISOString(), tekst: t, publiczny: publiczny !== false,
            zdjecie: null, nagranie: null, rysunki: [],
            stado: [
                { rodzaj: 'slowo', kto: 'kronikarz', stan: 'czeka', tekst: null, powod: null },
                { rodzaj: 'ilustracja', kto: 'paleta', stan: 'czeka', plik: null, prompt: null, powod: null },
            ],
        };
        await fs.mkdir(dir(id), { recursive: true });
        await fs.writeFile(plikWpisu(id), JSON.stringify(w, null, 2), 'utf8');
        await cfg.szyna?.nadaj?.({ agent: 'Kronikarz', rodzaj: 'ksiega', tresc: `📖 Nowa Iskra w Żywej Księdze: „${t.slice(0, 80)}”`, dane: { wpis: id } })?.catch?.(() => {});
        zlecStado(id);
        return w;
    }

    function zlecStado(id) { if (!kolejka.includes(id)) kolejka.push(id); void pracuj(); }

    async function pracuj() {
        if (pracuje) return;
        pracuje = true;
        try {
            while (kolejka.length) {
                const id = kolejka.shift();
                try { await stado(id); } catch (e) { console.warn('📖 Żywa Księga — stado:', e.message); }
            }
        } finally { pracuje = false; }
    }

    async function stado(id) {
        let w = await czytaj(id);
        // 1. Słowo Kronikarza + opis ilustracji (jedno zapytanie)
        if (['czeka', 'blad'].includes(dodatek(w, 'slowo')?.stan)) {
            await zmien(id, (x) => { Object.assign(dodatek(x, 'slowo'), { stan: 'robi', powod: null }); });
            try {
                if (!cfg.chat) throw new Error('most nie podał modelu stada');
                const model = await cfg.modelDla?.('kronikarz');
                let s = odczytajSlowo(tekstOdpowiedzi(await cfg.chat(model, SYSTEM_SLOWA, `SŁOWA SUWERENA:\n${w.tekst}`)));
                if (!s) s = odczytajSlowo(tekstOdpowiedzi(await cfg.chat(model, SYSTEM_SLOWA, `SŁOWA SUWERENA:\n${w.tekst}\n\nPoprzednio format był zły. Dokładnie dwie linie: „SŁOWO: …” i „OBRAZ: …”.`)));
                if (!s) throw new Error('Kronikarz nie oddał formatu SŁOWO/OBRAZ (dwie próby)');
                w = await zmien(id, (x) => {
                    Object.assign(dodatek(x, 'slowo'), { stan: 'gotowe', tekst: s.slowo, model: model ?? null });
                    if (s.obraz) dodatek(x, 'ilustracja').prompt = s.obraz;
                });
            } catch (e) {
                w = await zmien(id, (x) => { Object.assign(dodatek(x, 'slowo'), { stan: 'blad', powod: String(e.message || e).slice(0, 300) }); });
            }
        }
        // 2. Ilustracja Palety (FLUX) — z opisu Kronikarza, a bez niego z samych słów
        const il = dodatek(w, 'ilustracja');
        if (['czeka', 'blad'].includes(il?.stan)) {
            await zmien(id, (x) => { Object.assign(dodatek(x, 'ilustracja'), { stan: 'robi', powod: null }); });
            try {
                if (!cfg.rysuj) throw new Error('most nie podał rysowania (FLUX)');
                const prompt = `${il.prompt || `a symbolic scene inspired by these words: ${w.tekst.slice(0, 300)}`}${STYL_ILUSTRACJI}`;
                let zrodlo = null;
                for (let proba = 0; ; proba++) {
                    try { zrodlo = await cfg.rysuj({ prompt, prefiks: `katedra/zywa-ksiega/${id}` }); break; }
                    catch (e) {
                        if (!COMFY_WSTAJE.test(String(e.message)) || proba >= (cfg.probComfy ?? 6)) throw e;
                        await new Promise((r) => setTimeout(r, cfg.czekajComfyMs ?? 30_000));
                    }
                }
                if (!zrodlo || !fsSync.existsSync(zrodlo)) throw new Error('FLUX nie oddał pliku');
                await fs.copyFile(zrodlo, path.join(dir(id), 'ilustracja.png'));
                await zmien(id, (x) => { Object.assign(dodatek(x, 'ilustracja'), { stan: 'gotowe', plik: 'ilustracja.png', promptUzyty: prompt }); });
            } catch (e) {
                await zmien(id, (x) => { Object.assign(dodatek(x, 'ilustracja'), { stan: 'blad', powod: String(e.message || e).slice(0, 300) }); });
            }
        }
    }

    /** Duchy po restarcie: „robi” bez pracy w pamięci = błąd z powodem. */
    async function sprzatnijDuchy() {
        for (const w of await lista()) {
            if (!w.stado.some((s) => s.stan === 'robi')) continue;
            await zmien(w.id, (x) => { for (const s of x.stado) if (s.stan === 'robi') Object.assign(s, { stan: 'blad', powod: 'przerwane restartem mostu — ↻ ponów' }); }).catch(() => {});
        }
    }

    async function ponowStado(id) {
        const w = await czytaj(id);
        if (!w.stado.some((s) => s.stan === 'blad' || s.stan === 'czeka')) throw new Error('Stado skończyło już ten wpis.');
        zlecStado(id);
        return w;
    }

    async function nagranie(id, { bufor, typ }) {
        await czytaj(id);
        const cel = path.join(dir(id), 'nagranie.mp4');
        const tymczasowy = path.join(dir(id), 'nagranie-nowe.mp4');
        await nagranieDoMp4({ bufor, typ, praca: path.join(dir(id), 'praca'), cel: tymczasowy, ffmpeg: cfg.ffmpeg ?? 'ffmpeg' });
        await fs.rename(tymczasowy, cel);   // stare nagranie zostaje, dopóki nowe nie jest gotowe
        await fs.rm(path.join(dir(id), 'praca'), { recursive: true, force: true }).catch(() => {});
        const opis = await cfg.opisz?.(cel).catch(() => null);
        return zmien(id, (x) => { x.nagranie = { plik: 'nagranie.mp4', kiedy: new Date().toISOString(), sekundy: opis?.sekundy ?? null }; });
    }

    async function zdjecie(id, { bufor, typ }) {
        await czytaj(id);
        if (!Buffer.isBuffer(bufor) || !bufor.length) throw new Error('Nie dostałem zdjęcia.');
        if (bufor.length > MAX_ZDJECIA) throw new Error(`Zdjęcie może mieć do ${MAX_ZDJECIA / 1024 / 1024} MB.`);
        if (typ && !/^image\//.test(typ)) throw new Error('To nie jest obraz.');
        const praca = path.join(dir(id), 'praca'); await fs.mkdir(praca, { recursive: true });
        const we = path.join(praca, 'zdjecie-we'), tymczasowy = path.join(dir(id), 'zdjecie-nowe.jpg');
        await fs.writeFile(we, bufor);
        try {
            await new Promise((ok, zle) => execFile(cfg.ffmpeg ?? 'ffmpeg', argumentyZdjecia(we, tymczasowy), { windowsHide: true, timeout: 60_000 },
                (e, _o, err) => (e ? zle(new Error(`ffmpeg nie przeczytał zdjęcia: ${String(err || e.message).trim().split(/\r?\n/).pop()}`)) : ok())));
            await fs.rename(tymczasowy, path.join(dir(id), 'zdjecie.jpg'));   // stare zostaje, dopóki nowe nie jest gotowe
        } finally { await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); await fs.rm(tymczasowy, { force: true }).catch(() => {}); }
        return zmien(id, (x) => { x.zdjecie = { plik: 'zdjecie.jpg', kiedy: new Date().toISOString() }; });
    }

    const usunZdjecie = (id) => zmien(id, async (x) => {
        x.zdjecie = null;
        await fs.rm(path.join(dir(id), 'zdjecie.jpg'), { force: true });
    });

    async function rysunek(id, { rysunek: r, tytul }) {
        const czysty = oczyscRysunek(r);
        if (JSON.stringify(czysty).length > MAX_RYSUNKU) throw new Error('Rysunek jest za duży — mniej kresek albo klatek.');
        return zmien(id, (x) => {
            if (x.rysunki.length >= MAX_RYSUNKOW) throw new Error(`Wpis ma już ${MAX_RYSUNKOW} rysunków.`);
            x.rysunki.push({ id: crypto.randomBytes(4).toString('hex'), kto: 'suweren', tytul: String(tytul ?? '').trim().slice(0, 80) || null, kiedy: new Date().toISOString(), ...czysty });
        });
    }

    const ustaw = (id, { publiczny, tekst }) => zmien(id, (x) => {
        if (typeof publiczny === 'boolean') x.publiczny = publiczny;
        if (typeof tekst === 'string') {
            const t = tekst.trim();
            if (!t || t.length > MAX_TEKSTU) throw new Error(`Iskra: 1–${MAX_TEKSTU} znaków.`);
            x.tekst = t;
        }
    });

    async function usun(id) {
        await czytaj(id);
        await fs.mkdir(kosz, { recursive: true });
        await fs.rename(dir(id), path.join(kosz, `${id}-${Date.now()}`));
        return { id };
    }

    /** Ścieżka pliku wpisu — tylko pliki, które wpis wskazuje (nie wpis.json, nic spoza katalogu). */
    async function plik(id, nazwa) {
        const w = await czytaj(id);
        const dozwolone = [w.zdjecie?.plik, w.nagranie?.plik, ...w.stado.map((s) => s.plik)].filter(Boolean);
        if (!dozwolone.includes(nazwa)) throw new Error('Nie ma takiego pliku we wpisie.');
        return path.join(dir(id), nazwa);
    }

    const stan = () => ({ pracuje, kolejka: [...kolejka] });

    /** 🌍 Dla świata (wizytówka → otakos.wtf): TYLKO wpisy `publiczny`, tylko gotowe dodatki stada, bez ścieżek i modeli. */
    async function publiczne({ ile = 30 } = {}) {
        return (await lista()).filter((w) => w.publiczny).slice(0, ile).map((w) => {
            const slowo = w.stado.find((s) => s.rodzaj === 'slowo' && s.stan === 'gotowe');
            const il = w.stado.find((s) => s.rodzaj === 'ilustracja' && s.stan === 'gotowe' && s.plik);
            const v = encodeURIComponent(w.zmieniony ?? w.kiedy);
            return {
                id: w.id, kiedy: w.kiedy, tekst: w.tekst,
                slowo: slowo ? { kto: slowo.kto, tekst: slowo.tekst } : null,
                ilustracja: il ? { kto: il.kto, url: `/wizytowka/ksiega/${w.id}/${il.plik}?v=${v}` } : null,
                zdjecie: w.zdjecie ? { url: `/wizytowka/ksiega/${w.id}/${w.zdjecie.plik}?v=${encodeURIComponent(w.zdjecie.kiedy)}` } : null,
                nagranie: w.nagranie ? { url: `/wizytowka/ksiega/${w.id}/${w.nagranie.plik}?v=${v}`, sekundy: w.nagranie.sekundy } : null,
                rysunki: w.rysunki.map((r) => ({ id: r.id, kto: r.kto, tytul: r.tytul, klatki: r.klatki })),
            };
        });
    }
    /** Plik dla świata — tylko z wpisu publicznego. */
    async function plikPubliczny(id, nazwa) {
        const w = await czytaj(id);
        if (!w.publiczny) throw new Error('Nie ma takiego pliku we wpisie.');
        return plik(id, nazwa);
    }

    return { lista, czytaj, dodaj, ponowStado, zdjecie, usunZdjecie, nagranie, rysunek, ustaw, usun, plik, stan, sprzatnijDuchy, publiczne, plikPubliczny, katalog };
}

/** Trasy (Straż: `/api/zywa-ksiega` tylko maszyna). `raw` = express.raw z mostu (nagranie). */
export function zamontujTrasyZywejKsiegi(app, K, { raw } = {}) {
    const blad = (res, e, kod = 400) => res.status(kod).json({ success: false, message: e.message });
    app.get('/api/zywa-ksiega', async (_req, res) => { try { res.json({ success: true, wpisy: await K.lista(), stado: K.stan() }); } catch (e) { blad(res, e, 500); } });
    app.post('/api/zywa-ksiega', async (req, res) => { try { res.json({ success: true, wpis: await K.dodaj(req.body ?? {}) }); } catch (e) { blad(res, e); } });
    app.get('/api/zywa-ksiega/:id', async (req, res) => { try { res.json({ success: true, wpis: await K.czytaj(req.params.id) }); } catch (e) { blad(res, e, 404); } });
    app.put('/api/zywa-ksiega/:id', async (req, res) => { try { res.json({ success: true, wpis: await K.ustaw(req.params.id, req.body ?? {}) }); } catch (e) { blad(res, e); } });
    app.delete('/api/zywa-ksiega/:id', async (req, res) => { try { res.json({ success: true, ...(await K.usun(req.params.id)) }); } catch (e) { blad(res, e); } });
    app.post('/api/zywa-ksiega/:id/stado', async (req, res) => { try { res.json({ success: true, wpis: await K.ponowStado(req.params.id) }); } catch (e) { blad(res, e); } });
    app.post('/api/zywa-ksiega/:id/rysunek', async (req, res) => { try { res.json({ success: true, wpis: await K.rysunek(req.params.id, req.body ?? {}) }); } catch (e) { blad(res, e); } });
    const surowe = raw ? raw({ type: () => true, limit: '300mb' }) : (_q, _r, n) => n();
    app.post('/api/zywa-ksiega/:id/nagranie', surowe, async (req, res) => {
        try { res.json({ success: true, wpis: await K.nagranie(req.params.id, { bufor: req.body, typ: String(req.headers['content-type'] || '').split(';')[0] }) }); } catch (e) { blad(res, e); }
    });
    const obraz = raw ? raw({ type: () => true, limit: '26mb' }) : (_q, _r, n) => n();
    app.post('/api/zywa-ksiega/:id/zdjecie', obraz, async (req, res) => {
        try { res.json({ success: true, wpis: await K.zdjecie(req.params.id, { bufor: req.body, typ: String(req.headers['content-type'] || '').split(';')[0] }) }); } catch (e) { blad(res, e); }
    });
    app.delete('/api/zywa-ksiega/:id/zdjecie', async (req, res) => { try { res.json({ success: true, wpis: await K.usunZdjecie(req.params.id) }); } catch (e) { blad(res, e); } });
    app.get('/api/zywa-ksiega/:id/plik/:plik', async (req, res) => {
        try { res.sendFile(await K.plik(req.params.id, req.params.plik)); } catch (e) { blad(res, e, 404); }
    });
    // 🌍 PUBLICZNIE (Straż: SCIEZKA_KSIEGI, tylko GET/HEAD): wpisy „dla świata” i ich pliki — strona otakos.wtf czyta z tunelu
    app.get('/wizytowka/ksiega', async (_req, res) => {
        try { res.set('Cache-Control', 'public, max-age=60').json({ success: true, wpisy: await K.publiczne() }); } catch (e) { blad(res, e, 500); }
    });
    app.get('/wizytowka/ksiega/:id/:plik', async (req, res) => {
        try { res.set('Cache-Control', 'public, max-age=3600').sendFile(await K.plikPubliczny(req.params.id, req.params.plik)); } catch (e) { blad(res, e, 404); }
    });
}

export default { utworzZywaKsiege, zamontujTrasyZywejKsiegi, odczytajSlowo, oczyscRysunek, SYSTEM_SLOWA, STYL_ILUSTRACJI };
