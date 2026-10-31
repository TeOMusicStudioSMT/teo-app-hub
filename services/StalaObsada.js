/**
 * 🎭 Stała Obsada Katedry (Suweren 2026-10-31, po filmie o Kling 4.0: „sposób na to, by Katedra mogła mieć stałych
 * aktorów… wykorzystać tylko sposób”). Metoda: z JEDNEGO obrazu postaci powstaje KARTA 6 UJĘĆ (ciało przód / bok / tył,
 * twarz przód / trzy czwarte / profil); zatwierdzona karta jest odtąd WZOREM każdego kadru z tym aktorem — twarz
 * i strój się nie rozjeżdżają. Wszystko lokalnie: karta = FLUX.2 klein z obrazem źródłowym jako wzorem
 * (`Assety3D.kadrFilmu` — ReferenceLatent), cięcie = ffmpeg. Chmury (Higgsfield/Kling) nie używamy.
 *
 * Aktor `a-<6 hex>` w `<katalog>/<id>/`: aktor.json, zrodlo.png (bez metadanych), arkusz.png (karta 3×2),
 * ujecia/<nazwa>.png ×6, kadry/*.png. Stany: rysuje → do_akceptacji → zatwierdzony (✓ Suwerena) | blad.
 * UCZCIWIE: FLUX nie zawsze trzyma siatkę 3×2 — dlatego karta czeka na ✓, a ↻ rysuje ją od nowa (nowe ziarno).
 * Usunięcie = `_kosz/`. Jedno rysowanie naraz (karta graficzna).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

/** Siatka karty: [nazwa, kolumna, wiersz] — kolejność = kolejność w prompcie. */
export const UJECIA = [
    ['przod', 0, 0], ['bok', 1, 0], ['tyl', 2, 0],
    ['twarz', 0, 1], ['twarz-34', 1, 1], ['profil', 2, 1],
];
export const NAZWY_UJEC = { przod: 'ciało — przód', bok: 'ciało — bok', tyl: 'ciało — tył', twarz: 'twarz — przód', 'twarz-34': 'twarz — trzy czwarte', profil: 'twarz — profil' };
/** Wzory kadru (FLUX przyjmuje do 3): twarz trzyma tożsamość, przód i bok — sylwetkę i strój. */
export const WZORY_KADRU = ['twarz', 'przod', 'bok'];
export const SZER_KARTY = 1536, WYS_KARTY = 1024;   // 3×2 kwadraty 512 px
const MAX_OPISU = 600, MAX_ZRODLA = 25 * 1024 * 1024;

const ID = /^a-[0-9a-f]{6}$/;
/** Rola = <program>:<kto> (litery, cyfry, spacje, myślniki; ≤ 60) — czyste. */
export function czystaRola(rola) {
    const r = String(rola ?? '').trim().replace(/\s+/g, ' ');
    if (!/^[a-z0-9-]{2,20}:[\p{L}0-9 ._-]{1,40}$/u.test(r)) throw new Error('Rola ma być w postaci program:kto (np. gol-dnia:zebra).');
    return r;
}
const czysty = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Prompt karty 6 ujęć — czyste. Opis Suwerena tylko dopowiada; tożsamość niesie obraz-wzór. */
export function promptKarty(opis = '') {
    const o = czysty(opis, MAX_OPISU);
    return 'character reference sheet of the SAME character as in the reference image, a grid of 3 columns and 2 rows of equal square cells '
        + 'on a plain light grey background. Top row: full body front view, full body side view facing right, full body back view. '
        + 'Bottom row: head and shoulders close-up front view, head close-up three-quarter view, head close-up profile view. '
        + 'Identical face, hairstyle, outfit, colors and proportions in every cell, neutral relaxed pose, even soft studio lighting, '
        + 'no text, no labels, no borders, no extra characters'
        + (o ? `. Character: ${o}` : '');
}

/** Filtr ffmpeg wycinający komórkę (kolumna, wiersz) siatki 3×2 — czyste. */
export const filtrKomorki = (kol, wiersz) => `crop=trunc(iw/3):trunc(ih/2):trunc(iw/3)*${kol}:trunc(ih/2)*${wiersz}`;

/** Prompt kadru z aktorem — czyste: scena Suwerena + przypomnienie o wzorze. */
export function promptKadru(aktor, scena) {
    const s = czysty(scena, 1200);
    if (!s) throw new Error('Opisz scenę kadru.');
    return `${s}. The character ${czysty(aktor.imie, 40)} looks exactly like in the reference images: same face, hairstyle, outfit and colors`
        + (aktor.opis ? ` (${czysty(aktor.opis, 300)})` : '') + '. Cinematic composition, no text.';
}

export function utworzStalaObsada({ katalog, kadr, ffmpeg = 'ffmpeg', budz = async () => {} } = {}) {
    if (!katalog) throw new Error('StalaObsada: brak katalogu.');
    const dir = (id) => path.join(katalog, id);
    const plikAktora = (id) => path.join(dir(id), 'aktor.json');
    let zajete = null;   // jedno rysowanie naraz

    const sprawdzId = (id) => { if (!ID.test(String(id))) throw new Error('Zły identyfikator aktora.'); return id; };
    async function czytaj(id) {
        sprawdzId(id);
        try { return JSON.parse(await fs.readFile(plikAktora(id), 'utf8')); } catch { throw new Error('Nie ma takiego aktora.'); }
    }
    async function zapisz(a) {
        const tmp = plikAktora(a.id) + '.tmp';
        await fs.writeFile(tmp, JSON.stringify(a, null, 2), 'utf8');
        await fs.rename(tmp, plikAktora(a.id));
        return a;
    }
    const ff = (args) => new Promise((ok, zle) => execFile(ffmpeg, ['-v', 'error', '-y', ...args], { windowsHide: true, timeout: 120_000 },
        (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').pop()}`)) : ok())));

    async function lista() {
        await fs.mkdir(katalog, { recursive: true });
        const out = [];
        for (const d of await fs.readdir(katalog, { withFileTypes: true })) {
            if (!d.isDirectory() || !ID.test(d.name)) continue;
            try { out.push(await czytaj(d.name)); } catch { /* uszkodzony — pomijamy */ }
        }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    /** Nowy aktor: imię, opis wyglądu i JEDEN obraz — dataURL (zdjęcie, rysunek) albo ścieżka istniejącego pliku. */
    async function dodaj({ imie, opis = '', zdjecie = null, sciezka = null } = {}) {
        const im = czysty(imie, 40);
        if (!im) throw new Error('Podaj imię aktora.');
        const id = `a-${crypto.randomBytes(3).toString('hex')}`;
        await fs.mkdir(path.join(dir(id), 'ujecia'), { recursive: true });
        const wej = path.join(dir(id), 'wejscie');
        try {
            if (zdjecie) {
                const m = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(String(zdjecie));
                if (!m) throw new Error('Obraz ma być dataURL obrazu.');
                const bufor = Buffer.from(m[1], 'base64');
                if (bufor.length > MAX_ZRODLA) throw new Error('Obraz większy niż 25 MB.');
                await fs.writeFile(wej, bufor);
            } else if (sciezka) {
                if (!fsSync.existsSync(String(sciezka))) throw new Error('Nie ma takiego pliku obrazu.');
                await fs.copyFile(String(sciezka), wej);
            } else throw new Error('Potrzebny jeden obraz postaci (zdjęcie albo plik).');
            // PNG bez metadanych (EXIF/GPS nie zostają), dłuższy bok ≤ 1536
            await ff(['-i', wej, '-map_metadata', '-1', '-vf', "scale='min(1536,iw)':'min(1536,ih)':force_original_aspect_ratio=decrease", '-frames:v', '1', path.join(dir(id), 'zrodlo.png')]);
        } catch (e) {
            await fs.rm(dir(id), { recursive: true, force: true });
            throw e;
        } finally { await fs.rm(wej, { force: true }); }
        const a = { id, imie: im, opis: czysty(opis, MAX_OPISU), stan: 'nowy', powod: null, zrodlo: 'zrodlo.png', arkusz: null, ujecia: {}, wersja: 0, kadry: [], utworzono: new Date().toISOString(), zatwierdzono: null };
        await zapisz(a);
        return a;
    }

    /** Karta 6 ujęć: FLUX z obrazem źródłowym jako wzorem → arkusz → ffmpeg tnie 6 komórek. W tle; stan w aktorze. */
    async function rysujKarte(id) {
        const a = await czytaj(id);
        if (zajete) throw new Error(`Karta graficzna rysuje teraz kartę „${zajete}” — chwila.`);
        if (!kadr) throw new Error('Brak silnika obrazu (FLUX).');
        zajete = a.imie;
        a.stan = 'rysuje'; a.powod = null; a.zatwierdzono = null;
        await zapisz(a);
        (async () => {
            try {
                await budz();
                const plik = await kadr({ prompt: promptKarty(a.opis), referencje: [path.join(dir(id), a.zrodlo)], szer: SZER_KARTY, wys: WYS_KARTY, prefiks: `katedra/obsada/${id}` });
                const wersja = (a.wersja ?? 0) + 1;
                await fs.copyFile(plik, path.join(dir(id), 'arkusz.png'));
                const ujecia = {};
                for (const [nazwa, kol, wiersz] of UJECIA) {
                    const cel = path.join(dir(id), 'ujecia', `${nazwa}.png`);
                    await ff(['-i', path.join(dir(id), 'arkusz.png'), '-vf', filtrKomorki(kol, wiersz), '-frames:v', '1', cel]);
                    ujecia[nazwa] = `ujecia/${nazwa}.png`;
                }
                Object.assign(a, { stan: 'do_akceptacji', arkusz: 'arkusz.png', ujecia, wersja, powod: null });
            } catch (e) {
                Object.assign(a, { stan: 'blad', powod: e.message });
            } finally {
                zajete = null;
                await zapisz(a).catch(() => {});
            }
        })();
        return a;
    }

    async function przyjmij(id) {
        const a = await czytaj(id);
        if (a.stan !== 'do_akceptacji') throw new Error('Do zatwierdzenia jest tylko gotowa karta.');
        Object.assign(a, { stan: 'zatwierdzony', zatwierdzono: new Date().toISOString() });
        return zapisz(a);
    }

    /** Zmiana imienia/opisu (karta zostaje — ↻ narysuje ją z nowym opisem). */
    async function zmien(id, { imie, opis } = {}) {
        const a = await czytaj(id);
        if (imie !== undefined) { const im = czysty(imie, 40); if (!im) throw new Error('Imię nie może być puste.'); a.imie = im; }
        if (opis !== undefined) a.opis = czysty(opis, MAX_OPISU);
        return zapisz(a);
    }

    /** Wzory do kadru: zatwierdzony = twarz, przód, bok; inaczej sam obraz źródłowy. Pełne ścieżki, tylko istniejące. */
    async function wzory(id) {
        const a = await czytaj(id);
        const pliki = a.stan === 'zatwierdzony' ? WZORY_KADRU.map((n) => a.ujecia?.[n]).filter(Boolean) : [a.zrodlo];
        return pliki.map((p) => path.join(dir(id), p)).filter((p) => fsSync.existsSync(p));
    }

    /** Kadr z aktorem (FLUX, wzory z karty) → kadry/<n>.png w katalogu aktora. */
    async function kadrZAktorem(id, { scena, szer = 1280, wys = 720 } = {}) {
        const a = await czytaj(id);
        if (a.stan !== 'zatwierdzony') throw new Error(`${a.imie} nie ma jeszcze zatwierdzonej karty — najpierw ✓.`);
        if (zajete) throw new Error(`Karta graficzna rysuje teraz „${zajete}” — chwila.`);
        zajete = a.imie;
        try {
            await budz();
            const plik = await kadr({ prompt: promptKadru(a, scena), referencje: await wzory(id), szer, wys, prefiks: `katedra/obsada/${id}-kadr` });
            await fs.mkdir(path.join(dir(id), 'kadry'), { recursive: true });
            const nazwa = `kadry/${Date.now().toString(36)}.png`;
            await fs.copyFile(plik, path.join(dir(id), nazwa));
            const swiezy = await czytaj(id);
            swiezy.kadry = [{ plik: nazwa, scena: czysty(scena, 300), kiedy: new Date().toISOString() }, ...(swiezy.kadry ?? [])].slice(0, 24);
            await zapisz(swiezy);
            return { aktor: swiezy, plik: nazwa };
        } finally { zajete = null; }
    }

    // ── ROLE: stały aktor przypisany do roli programu (np. `gol-dnia:zebra`, `tancerz:Kot Tancerz`) → program bierze jego wzory
    const plikRol = path.join(katalog, 'role.json');
    async function role() {
        try { return JSON.parse(await fs.readFile(plikRol, 'utf8')); } catch { return {}; }
    }
    async function przypisz(rola, aktorId) {
        const r = czystaRola(rola);
        const wszystkie = await role();
        if (aktorId) { await czytaj(aktorId); wszystkie[r] = aktorId; } else delete wszystkie[r];
        await fs.mkdir(katalog, { recursive: true });
        await fs.writeFile(plikRol, JSON.stringify(wszystkie, null, 2), 'utf8');
        return wszystkie;
    }
    /** Wzory roli: tylko zatwierdzony aktor; brak przypisania / karta niezatwierdzona = [] (program rysuje jak dotąd). */
    async function wzoryRoli(rola) {
        let r;
        try { r = czystaRola(rola); } catch { return []; }
        const id = (await role())[r];
        if (!id) return [];
        try { return (await czytaj(id)).stan === 'zatwierdzony' ? await wzory(id) : []; } catch { return []; }
    }

    async function usun(id) {
        sprawdzId(id);
        const r = await role();
        if (Object.values(r).includes(id)) await fs.writeFile(plikRol, JSON.stringify(Object.fromEntries(Object.entries(r).filter(([, v]) => v !== id)), null, 2), 'utf8');
        const kosz = path.join(katalog, '_kosz');
        await fs.mkdir(kosz, { recursive: true });
        await fs.rename(dir(id), path.join(kosz, `${id}-${Date.now()}`));
        return { usuniety: id };
    }

    /** Plik aktora (źródło, karta, ujęcie, kadr) — tylko z jego katalogu. */
    async function plik(id, wzgledny) {
        sprawdzId(id);
        const rel = String(wzgledny ?? '');
        if (!/^(zrodlo\.png|arkusz\.png|ujecia\/[a-z0-9-]+\.png|kadry\/[a-z0-9]+\.png)$/.test(rel)) throw new Error('Nie ma takiego pliku.');
        const p = path.join(dir(id), rel);
        if (!fsSync.existsSync(p)) throw new Error('Nie ma takiego pliku.');
        return p;
    }

    /** Po restarcie mostu „rysuje” bez pracy w pamięci = błąd z powodem (można ↻). */
    async function sprzatnijDuchy() {
        for (const a of await lista()) {
            if (a.stan === 'rysuje') await zapisz({ ...a, stan: 'blad', powod: 'Rysowanie przerwane (restart mostu) — ↻ narysuj kartę jeszcze raz.' });
        }
    }

    return { lista, czytaj, dodaj, rysujKarte, przyjmij, zmien, wzory, kadrZAktorem, usun, plik, sprzatnijDuchy, role, przypisz, wzoryRoli, zajete: () => zajete };
}

export function zamontujTrasyStalejObsady(app, O, { propozycjeRol = async () => [] } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.get('/api/obsada', (_req, res) => odp(res, Promise.all([O.lista(), O.role(), propozycjeRol()]).then(([aktorzy, role, propozycje]) => ({ aktorzy, role, propozycjeRol: propozycje, zajete: O.zajete(), ujecia: NAZWY_UJEC }))));
    app.put('/api/obsada/role', (req, res) => odp(res, O.przypisz(req.body?.rola, req.body?.aktor ?? null).then((role) => ({ role }))));
    app.post('/api/obsada', (req, res) => odp(res, O.dodaj(req.body ?? {}).then((aktor) => ({ aktor }))));
    app.get('/api/obsada/:id', (req, res) => odp(res, O.czytaj(req.params.id).then((aktor) => ({ aktor }))));
    app.put('/api/obsada/:id', (req, res) => odp(res, O.zmien(req.params.id, req.body ?? {}).then((aktor) => ({ aktor }))));
    app.delete('/api/obsada/:id', (req, res) => odp(res, O.usun(req.params.id)));
    app.post('/api/obsada/:id/karta', (req, res) => odp(res, O.rysujKarte(req.params.id).then((aktor) => ({ aktor }))));
    app.post('/api/obsada/:id/przyjmij', (req, res) => odp(res, O.przyjmij(req.params.id).then((aktor) => ({ aktor }))));
    app.post('/api/obsada/:id/kadr', (req, res) => odp(res, O.kadrZAktorem(req.params.id, req.body ?? {})));
    const wyslij = async (res, id, rel) => {
        try { res.sendFile(await O.plik(id, rel)); } catch (e) { res.status(404).json({ success: false, message: e.message }); }
    };
    app.get('/api/obsada/:id/plik/:plik', (req, res) => wyslij(res, req.params.id, req.params.plik));                       // zrodlo.png, arkusz.png
    app.get('/api/obsada/:id/plik/:katalog/:plik', (req, res) => wyslij(res, req.params.id, `${req.params.katalog}/${req.params.plik}`));   // ujecia/…, kadry/…
}
