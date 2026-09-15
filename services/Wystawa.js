/**
 * 🖼️ WYSTAWA — co Katedra pokazuje światu na teo.center (2026-09-14).
 *
 * Suweren: „teo.center jest spięta z Katedrą — chcę, by tam były prezentowane
 * najnowsze produkcje filmowe Katedry; mój komputer może pełnić rolę serwera;
 * eksponować utwory z Suno (link share odpala utwór na mojej stronie albo cała
 * ramka Suno); serwerem dla filmów może być kanał YT; prezentacja wszelkich
 * innych produktów Katedry; odnośnik graficzny do otakos.wtf."
 *
 * DWA TRYBY, JEDEN KATALOG:
 *   · PUBLICZNIE  — teo.center czyta statyczny `public/wystawa.json` (+ plakaty
 *                   w `public/media/wystawa/`), który powstaje tu przez
 *                   `opublikuj()`. Filmy grają z YouTube (link wpisuje Suweren),
 *                   utwory Suno z ramki Suno, produkty jako obrazy.
 *   · GOSPODARZ   — gdy strona otwiera się na maszynie Suwerena, Most żyje:
 *                   /api/wystawa oddaje ŻYWY katalog, a filmy bez YouTube grają
 *                   prosto z dysku przez /wystawa/plik/:id (biała lista ścieżek,
 *                   nie dowolna ścieżka z URL-a).
 *
 * KURACJA — `_OtakOs_Wymiar/wystawa.json`: linki Suno, YouTube per film, co
 * ukryte. Reszta katalogu jest ZBIERANA z tego, co Katedra naprawdę wytworzyła:
 * odcinki z `produkcje/<projekt>/odcinki/<n>`, filmy z `_OtakOs_Build`, utwory
 * z `_OtakOs_Muzyka`, kreacje z Fashion, printy i renders chipów z Labu.
 *
 * ⚠️ NIC NIE JEST „PUBLICZNE" PRZEZ PRZYPADEK. Publikacja to jawny krok
 * (przycisk w Katedrze → `opublikuj`), a strona teo.center i tak trzeba
 * zbudować i wgrać. Most nie wystawia dysku do internetu.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

let cfg = null;
export function skonfiguruj(c) { cfg = c; }

const PLIK_KURACJI = () => path.join(cfg.katalogKatedry, 'wystawa.json');
const id8 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const teraz = () => new Date().toISOString();

async function czytajJson(p, d) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } }
async function zapiszJson(p, d) { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(d, null, 2), 'utf8'); }

export async function kuracja() {
    const k = await czytajJson(PLIK_KURACJI(), {});
    return { suno: Array.isArray(k.suno) ? k.suno : [], youtube: k.youtube && typeof k.youtube === 'object' ? k.youtube : {}, ukryte: Array.isArray(k.ukryte) ? k.ukryte : [], opisy: k.opisy && typeof k.opisy === 'object' ? k.opisy : {}, ostatniaPublikacja: k.ostatniaPublikacja ?? null };
}
async function zapiszKuracje(k) { await zapiszJson(PLIK_KURACJI(), k); return k; }

/** Suno: link share `https://suno.com/song/<uuid>` (też /s/<id>) → id do ramki `https://suno.com/embed/<id>`. */
export function idSuno(url) {
    const m = String(url || '').match(/suno\.(?:com|ai)\/(?:song|s|embed)\/([A-Za-z0-9-]{8,})/i);
    return m ? m[1] : null;
}
/** Suno: link playlisty `https://suno.com/playlist/<uuid>`. */
export function idPlaylistySuno(url) {
    const m = String(url || '').match(/suno\.(?:com|ai)\/playlist\/([A-Za-z0-9-]{8,})/i);
    return m ? m[1] : null;
}

/**
 * Publiczne API Suno (to samo, z którego korzysta ich strona; bez klucza, tylko
 * publiczne treści). Sprawdzone 2026-09-15: /api/playlist/<id>/?page=N oddaje
 * `playlist_clips[].clip` (id, title, image_url, metadata.duration);
 * /api/clip/<id> — pojedynczy utwór. Gdy Suno zmieni API — dostajemy błąd HTTP
 * i wpis zostaje bez tytułów/okładek, ale ramka embed nadal gra.
 */
const SUNO_API = 'https://studio-api.prod.suno.com/api';
async function sunoJson(sciezka) {
    const r = await fetch(`${SUNO_API}${sciezka}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Katedra OtakOS)' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`Suno API HTTP ${r.status}`);
    return r.json();
}
/** suno.com/s/<kod> → uuid utworu (z nagłówka Location, bez ściągania strony). */
async function rozwiazKrotkiSuno(url) {
    try {
        const r = await fetch(url, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Katedra OtakOS)' }, signal: AbortSignal.timeout(15_000) });
        const cel = r.headers.get('location') || '';
        return cel.match(/\/song\/([0-9a-f-]{36})/i)?.[1] ?? null;
    } catch { return null; }
}
const utworZClipu = (c) => ({ id: c.id, tytul: String(c.title || '').slice(0, 120), sekundy: Math.round(Number(c?.metadata?.duration) || 0) || null, okladka: c.image_url || null, embed: `https://suno.com/embed/${c.id}`, url: `https://suno.com/song/${c.id}` });

export async function dodajSuno({ url, tytul = '', opis = '' }) {
    const k = await kuracja();
    const idPl = idPlaylistySuno(url);
    if (idPl) {
        // Playlista: ściągamy wszystkie strony (Suno stronicuje po ~20), zapisujemy utwory.
        const utwory = [];
        let nazwa = '', okladka = null, autor = '';
        for (let strona = 1; strona <= 10; strona++) {
            const d = await sunoJson(`/playlist/${idPl}/?page=${strona}`);
            nazwa = nazwa || String(d.name || '');
            okladka = okladka || d.image_url || null;
            autor = autor || String(d.user_display_name || d.user_handle || '');
            for (const pc of d.playlist_clips ?? []) if (pc?.clip?.id) utwory.push(utworZClipu(pc.clip));
            if (!d.playlist_clips?.length || utwory.length >= Number(d.num_total_results || 0)) break;
        }
        if (!utwory.length) throw new Error('Playlista jest pusta albo niepubliczna — Suno nie oddało żadnego utworu.');
        k.suno = k.suno.filter((s) => s.id !== idPl);
        k.suno.unshift({ typ: 'playlista', id: idPl, url: String(url).trim(), tytul: String(tytul || nazwa || 'Playlista').slice(0, 120), opis: String(opis || '').slice(0, 400), autor, okladka, utwory, dodano: teraz() });
        return zapiszKuracje(k);
    }
    let id = idSuno(url);
    if (!id) throw new Error('To nie wygląda na link Suno (oczekuję https://suno.com/song/<id> albo /playlist/<id>).');
    // Krótki link „share" (suno.com/s/<kod>) to przekierowanie 307 do /song/<uuid> — ramka embed
    // gra tylko z uuid. Sprawdzone 2026-09-15 na dwóch linkach Suwerena.
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
        const uuid = await rozwiazKrotkiSuno(url);
        if (!uuid) throw new Error(`Suno nie rozwinęło krótkiego linku ${url} — wklej link z /song/<uuid> (menu „Share → Copy link" na stronie utworu).`);
        id = uuid;
    }
    if (k.suno.some((s) => s.id === id)) return k;
    // Tytuł i okładka z API — gdy API milczy, wpis zostaje z tym, co podał Suweren.
    let meta = null;
    try { meta = utworZClipu(await sunoJson(`/clip/${id}`)); } catch { /* ramka embed i tak zagra */ }
    k.suno.unshift({ typ: 'utwor', id, url: String(url).trim(), tytul: String(tytul || meta?.tytul || '').trim().slice(0, 120), opis: String(opis || '').trim().slice(0, 400), sekundy: meta?.sekundy ?? null, okladka: meta?.okladka ?? null, embed: `https://suno.com/embed/${id}`, dodano: teraz() });
    return zapiszKuracje(k);
}
export async function usunSuno(id) { const k = await kuracja(); k.suno = k.suno.filter((s) => s.id !== id); return zapiszKuracje(k); }
/** YouTube: watch?v=, youtu.be/, shorts/, embed/ → id. */
export function idYouTube(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    return m ? m[1] : null;
}
export async function ustawYouTube({ filmId, url }) {
    const k = await kuracja();
    if (!url) { delete k.youtube[filmId]; return zapiszKuracje(k); }
    const id = idYouTube(url);
    if (!id) throw new Error('To nie wygląda na link YouTube.');
    k.youtube[filmId] = { id, url: String(url).trim() };
    return zapiszKuracje(k);
}
export async function ukryj({ id, ukryty = true }) {
    const k = await kuracja();
    k.ukryte = k.ukryte.filter((x) => x !== id);
    if (ukryty) k.ukryte.push(id);
    return zapiszKuracje(k);
}
export async function ustawOpis({ id, tytul, opis }) {
    const k = await kuracja();
    k.opisy[id] = { ...(k.opisy[id] || {}), ...(tytul !== undefined ? { tytul: String(tytul).slice(0, 120) } : {}), ...(opis !== undefined ? { opis: String(opis).slice(0, 600) } : {}) };
    return zapiszKuracje(k);
}

async function sekundy(plik) {
    try {
        const { stdout } = await cfg.execFile(cfg.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', plik], { windowsHide: true });
        const d = Number(String(stdout).trim()); return Number.isFinite(d) ? Math.round(d) : null;
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZBIERANIE — z tego, co istnieje
// ─────────────────────────────────────────────────────────────────────────────

async function filmy() {
    const wynik = [];
    const prod = path.join(cfg.katalogKatedry, 'produkcje');
    for (const projekt of (await fs.readdir(prod, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory())) {
        const odc = path.join(prod, projekt.name, 'odcinki');
        for (const o of (await fs.readdir(odc, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory())) {
            const pliki = (await fs.readdir(path.join(odc, o.name)).catch(() => [])).filter((f) => /\.mp4$/i.test(f));
            if (!pliki.length) continue;
            // Najnowszy plik odcinka — z muzyką, gdy jest (montaż zapisuje *_z_muzyka.mp4 obok).
            const zeStatem = await Promise.all(pliki.map(async (f) => ({ f, st: await fs.stat(path.join(odc, o.name, f)) })));
            zeStatem.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
            const naj = zeStatem.find((x) => /_z_muzyka\.mp4$/i.test(x.f)) ?? zeStatem[0];
            const abs = path.join(odc, o.name, naj.f);
            let meta = null;
            try { meta = JSON.parse(await fs.readFile(path.join(odc, o.name, 'odcinek.json'), 'utf8')); } catch { /* bez metadanych */ }
            const tytulOdc = meta?.odcinek?.tytul || meta?.tytul || o.name.replace(/^\d+-/, '').replace(/-/g, ' ');
            wynik.push({ id: `film-${id8(abs)}`, rodzaj: 'odcinek', projekt: projekt.name, tytul: `${projekt.name} — ${tytulOdc}`, opis: meta?.odcinek?.streszczenie || meta?.streszczenie || '', plik: abs, bajtow: naj.st.size, kiedy: naj.st.mtime.toISOString(), muzyka: /_z_muzyka/i.test(naj.f) });
        }
    }
    // Filmy z _OtakOs_Build (np. TeO Story — SOLLET) z opisem obok (.opis.md), gdy jest.
    const build = path.join(process.cwd(), '_OtakOs_Build');
    for (const f of (await fs.readdir(build).catch(() => [])).filter((f) => /\.mp4$/i.test(f) && !/^CONCAT_/i.test(f))) {
        const abs = path.join(build, f);
        const st = await fs.stat(abs);
        let opis = '';
        try { opis = (await fs.readFile(abs.replace(/\.mp4$/i, '.opis.md'), 'utf8')).replace(/^#.*\n/, '').trim().slice(0, 600); } catch { /* brak opisu */ }
        wynik.push({ id: `film-${id8(abs)}`, rodzaj: 'film', projekt: 'TeO Story', tytul: f.replace(/\.mp4$/i, ''), opis, plik: abs, bajtow: st.size, kiedy: st.mtime.toISOString(), muzyka: null });
    }
    wynik.sort((a, b) => b.kiedy.localeCompare(a.kiedy));
    return wynik;
}

async function utwory() {
    const dir = cfg.musicDir;
    const wynik = [];
    const dodaj = async (kat, etykieta) => {
        for (const f of (await fs.readdir(kat).catch(() => [])).filter((f) => /\.(mp3|wav|flac)$/i.test(f))) {
            const abs = path.join(kat, f); const st = await fs.stat(abs);
            wynik.push({ id: `utwor-${id8(abs)}`, tytul: f.replace(/\.(mp3|wav|flac)$/i, '').replace(/_/g, ' '), plik: abs, bajtow: st.size, kiedy: st.mtime.toISOString(), zrodlo: etykieta });
        }
    };
    await dodaj(dir, 'Katedra');
    await dodaj(path.join(dir, '_Przerobki'), 'Warsztat');
    wynik.sort((a, b) => b.kiedy.localeCompare(a.kiedy));
    return wynik.slice(0, 40);
}

async function produkty() {
    const wynik = [];
    // 👗 Fashion — wizualizacje kreacji (obrazy w wyjściu ComfyUI, pod „katedra").
    for (const d of ['TeO_Fashion_Studio', 'OtakOs_Fashion']) {
        const p = path.resolve(process.cwd(), '..', d, 'OtakOs_Fashion', 'wizualizacje.json');
        const w = await czytajJson(p, null);
        if (!w) continue;
        const lista = Array.isArray(w) ? w : w.wizualizacje ?? [];
        for (const x of lista.slice(0, 24)) {
            const m = String(x.plik || '').match(/nazwa=([^&]+)(?:&pod=([^&]+))?/);
            if (!m) continue;
            const abs = path.join(cfg.comfyDir, 'ComfyUI', 'output', decodeURIComponent(m[2] || ''), decodeURIComponent(m[1]));
            if (!fsSync.existsSync(abs)) continue;
            wynik.push({ id: `moda-${id8(abs)}`, rodzaj: 'kreacja', dzial: 'TeO Fashion Studio', tytul: x.tytul || x.nazwa || x.id, opis: String(x.prompt || '').slice(0, 240), obraz: abs, kiedy: x.kiedy || null });
        }
        break;
    }
    // 🔬 Lab — projekty chipów z renderem i printy.
    const lab = path.join(cfg.katalogKatedry, 'lab');
    for (const f of (await fs.readdir(path.join(lab, 'chipy')).catch(() => [])).filter((f) => f.endsWith('.json') && !f.startsWith('analiza-'))) {
        const c = await czytajJson(path.join(lab, 'chipy', f), null);
        if (!c?.liczby) continue;
        wynik.push({ id: `chip-${c.id}`, rodzaj: 'chip', dzial: 'TeO Lab · Chipy', tytul: c.nazwa, opis: `${c.liczby.pamiecGB} GB · ${c.liczby.pasmoGBs} GB/s · ${c.liczby.stosyHbm}× HBM3`, obraz: c.render && fsSync.existsSync(c.render) ? c.render : null, kiedy: c.data });
    }
    for (const f of (await fs.readdir(path.join(lab, 'printy')).catch(() => [])).filter((f) => f.endsWith('.json'))) {
        const p = await czytajJson(path.join(lab, 'printy', f), null);
        if (!p) continue;
        wynik.push({ id: `print-${p.id}`, rodzaj: 'print', dzial: 'TeO Lab · Printy', tytul: p.nazwa, opis: String(p.problem || '').slice(0, 240), obraz: null, kiedy: p.data });
    }
    wynik.sort((a, b) => String(b.kiedy || '').localeCompare(String(a.kiedy || '')));
    return wynik;
}

/** Żywy katalog + kuracja. `biala` = mapa id → ścieżka, dla /wystawa/plik/:id. */
let biala = new Map();
export async function zbierz() {
    const [k, f, u, p] = await Promise.all([kuracja(), filmy(), utwory(), produkty()]);
    biala = new Map();
    for (const x of f) biala.set(x.id, x.plik);
    for (const x of u) biala.set(x.id, x.plik);
    for (const x of p) if (x.obraz) biala.set(x.id, x.obraz);
    const ozdob = (x) => ({ ...x, ukryty: k.ukryte.includes(x.id), tytul: k.opisy[x.id]?.tytul || x.tytul, opis: k.opisy[x.id]?.opis ?? x.opis, youtube: k.youtube[x.id] ?? null, strumien: `/wystawa/plik/${x.id}` });
    return { filmy: f.map(ozdob), utwory: u.map(ozdob), produkty: p.map(ozdob), suno: k.suno, ostatniaPublikacja: k.ostatniaPublikacja, sciezki: { katalog: cfg.katalogKatedry, muzyka: cfg.musicDir } };
}
export function sciezkaZBialej(id) { return biala.get(id) ?? null; }

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIKACJA — statyczny katalog dla teo.center
// ─────────────────────────────────────────────────────────────────────────────

function katalogTeoCenter() {
    const p = path.resolve(process.cwd(), '..', 'teo-center');
    if (!fsSync.existsSync(path.join(p, 'package.json'))) throw new Error('Nie widzę teo-center obok Katedry.');
    return p;
}

/** Plakat z filmu (klatka z 2 s) albo kopia obrazu — do public/media/wystawa. */
async function plakat(zrodlo, cel, wideo) {
    if (fsSync.existsSync(cel) && (await fs.stat(cel)).mtimeMs >= (await fs.stat(zrodlo)).mtimeMs) return true;
    try {
        if (wideo) await cfg.execFile(cfg.ffmpeg, ['-y', '-ss', '2', '-i', zrodlo, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', cel], { windowsHide: true, timeout: 60_000 });
        else await cfg.execFile(cfg.ffmpeg, ['-y', '-i', zrodlo, '-vf', 'scale=960:-2', '-q:v', '4', cel], { windowsHide: true, timeout: 60_000 });
        return fsSync.existsSync(cel);
    } catch { return false; }
}

export async function opublikuj({ ileFilmow = 12, ileUtworow = 12, ileProduktow = 24 } = {}) {
    const tc = katalogTeoCenter();
    const zywy = await zbierz();
    const media = path.join(tc, 'public', 'media', 'wystawa');
    await fs.mkdir(media, { recursive: true });
    const t0 = Date.now();

    const filmyPub = [];
    for (const f of zywy.filmy.filter((x) => !x.ukryty).slice(0, ileFilmow)) {
        const jpg = path.join(media, `${f.id}.jpg`);
        const maPlakat = await plakat(f.plik, jpg, true);
        filmyPub.push({ id: f.id, rodzaj: f.rodzaj, projekt: f.projekt, tytul: f.tytul, opis: f.opis, kiedy: f.kiedy, sekundy: await sekundy(f.plik), muzyka: f.muzyka, plakat: maPlakat ? `/media/wystawa/${f.id}.jpg` : null, youtube: f.youtube?.id ?? null, strumien: f.strumien });
    }
    const utworyPub = zywy.utwory.filter((x) => !x.ukryty).slice(0, ileUtworow).map((u) => ({ id: u.id, tytul: u.tytul, zrodlo: u.zrodlo, kiedy: u.kiedy, strumien: u.strumien }));
    const produktyPub = [];
    for (const p of zywy.produkty.filter((x) => !x.ukryty).slice(0, ileProduktow)) {
        let obraz = null;
        if (p.obraz) { const jpg = path.join(media, `${p.id}.jpg`); if (await plakat(p.obraz, jpg, false)) obraz = `/media/wystawa/${p.id}.jpg`; }
        produktyPub.push({ id: p.id, rodzaj: p.rodzaj, dzial: p.dzial, tytul: p.tytul, opis: p.opis, kiedy: p.kiedy, obraz });
    }
    const katalog = { opublikowano: teraz(), filmy: filmyPub, utwory: utworyPub, suno: zywy.suno, produkty: produktyPub, uwaga: 'Filmy z `youtube` grają wszędzie; bez niego tylko u gospodarza (Most). Utwory z dysku tylko u gospodarza; Suno gra z ramki Suno.' };
    await zapiszJson(path.join(tc, 'public', 'wystawa.json'), katalog);
    const k = await kuracja(); k.ostatniaPublikacja = katalog.opublikowano; await zapiszKuracje(k);
    cfg.szyna?.nadaj?.({ agent: 'Kronikarz', rodzaj: 'praca', tresc: `wystawa teo.center: ${filmyPub.length} filmów, ${utworyPub.length} utworów, ${zywy.suno.length} Suno, ${produktyPub.length} produktów` })?.catch?.(() => {});
    return { plik: path.join(tc, 'public', 'wystawa.json'), media, filmy: filmyPub.length, bezYouTube: filmyPub.filter((f) => !f.youtube).length, utwory: utworyPub.length, suno: zywy.suno.length, produkty: produktyPub.length, sekundy: Math.round((Date.now() - t0) / 1000), opublikowano: katalog.opublikowano };
}

export default { skonfiguruj, kuracja, idSuno, idPlaylistySuno, idYouTube, dodajSuno, usunSuno, ustawYouTube, ukryj, ustawOpis, zbierz, sciezkaZBialej, opublikuj };
