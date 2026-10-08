/**
 * 🗿 ASSETY 3D — bryły do gier z tekstu i zdjęć (od 2026-09-22).
 *
 * Suweren: „następnym krokiem będzie generator assetów 3D do tych gier, z tekstu i zdjęć".
 *
 * ŚCIEŻKA (wszystko lokalnie, na żywym ComfyUI :8188, węzły z rdzenia 0.35 — bez custom nodes):
 *   tekst  → Ollama tłumaczy opis na prompt obrazu → FLUX.2 klein rysuje obiekt na białym tle (~60 s)
 *   zdjęcie → prosto do kroku 3D
 *   obraz  → BiRefNet zdejmuje tło → TRELLIS.2 (struktura → kształt → upsampling → tekstura)
 *          → PaintMesh (kolory wierzchołków) → DecimateMesh (liczba ścian pod grę) → GLB
 *
 * DLACZEGO TRELLIS.2, NIE HUNYUAN3D: licencja Hunyuan wyklucza UE. TRELLIS.2 jest MIT
 * (enkoder DINOv3 od Meta ma własną licencję; paczka Comfy-Org). Wagi: _OtakOs_AI/models/3d,
 * podpięte do ComfyUI junctionami models/<typ>/katedra-3d — bez restartu ComfyUI.
 *
 * BIBLIOTEKA: _OtakOs_AI/assety3d/<id>/ = { model.glb, obraz.png, meta.json }. „Do gry" kopiuje
 * GLB do _OtakOs_Apki/<gra>/public/assety/<nazwa>.glb i dopisuje do assety.json tego projektu —
 * Kodeks dostaje listę w prompcie i ładuje je GLTFLoaderem.
 *
 * CZASY: mierzone na RTX 3060 6 GB — patrz meta.json każdego assetu (sekundy per etap).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import * as Siatka3D from './Siatka3D.js';

const uruchomProces = promisify(execFile);

const cfg = {
    comfyBase: 'http://127.0.0.1:8188',
    comfyDir: null,                 // …/ComfyUI_windows_portable (output = <dir>/ComfyUI/output)
    katalogWorkflow: null,          // _OtakOs_AI/workflows
    katalogBiblioteki: null,        // _OtakOs_AI/assety3d
    katalogObrazow: null,           // _OtakOs_AI/obrazy-gry (domyślnie obok biblioteki)
    katalogApek: null,              // _OtakOs_Apki
    szyna: null,
    pisz: null,                     // AppStudio.pisz — tłumaczenie opisu na prompt obrazu
    ollamaBase: 'http://127.0.0.1:11434',
    model: () => 'gemma4:e2b',
    obudzComfy: null,               // most: zapewnijComfyUI — start ComfyUI, gdy śpi
    czekajNaComfyMs: 150_000,       // pierwszy start z FLUX/TRELLIS potrafi trwać ~1–2 min
};
export function skonfiguruj(o) { Object.assign(cfg, o); }

/**
 * ComfyUI żyje — a jak śpi, budzimy go i czekamy (Suweren 2026-10-07: „brakuje tam auto wstania Comfy").
 * Dawniej Pracownia i Assety 3D kończyły się błędem „obudź go (POST /api/comfy/ensure)".
 */
export async function zywyComfy(sciezka = '/object_info/EmptyFlux2LatentImage') {
    try { await comfy(sciezka, {}, 6000); return { budzony: false }; } catch { /* śpi — budzimy */ }
    if (!cfg.obudzComfy) throw new Error('ComfyUI nie odpowiada na :8188 — obudź go (POST /api/comfy/ensure).');
    const w = await cfg.obudzComfy('Pracownia obrazów / Assety 3D').catch((e) => ({ online: false, started: false, message: e.message }));
    if (!w?.online && !w?.started && !/wstaje|startuje/i.test(String(w?.message || ''))) throw new Error(`ComfyUI śpi i nie dał się obudzić: ${w?.message || 'brak powodu'}`);
    const koniec = Date.now() + cfg.czekajNaComfyMs;
    while (Date.now() < koniec) {
        await new Promise((r) => setTimeout(r, 3000));
        try { await comfy(sciezka, {}, 6000); return { budzony: true }; } catch { /* jeszcze wstaje */ }
    }
    throw new Error(`ComfyUI obudzony, ale nie odpowiedział w ${Math.round(cfg.czekajNaComfyMs / 1000)} s — spróbuj za chwilę (pierwszy start ładuje modele).`);
}

const GRAF_OBRAZ = 'flux2_klein_4b.json';
const GRAF_3D = 'trellis2_obraz_do_3d.json';
const WYMAGANE = {
    clip_vision: 'dino_v3_vit_l.safetensors', diffusion_models: 'trellis_2_int8_convrot.safetensors',
    vae: 'trellis_2_shape_vae_bf16.safetensors', background_removal: 'birefnet.safetensors',
};
const idOk = (id) => /^[a-z0-9-]{3,60}$/.test(String(id || ''));
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'asset';
const dirAssetu = (id) => path.join(cfg.katalogBiblioteki, id);
const outputComfy = () => path.join(cfg.comfyDir, 'ComfyUI', 'output');

async function comfy(sciezka, opcje = {}, limitMs = 20000) {
    const r = await fetch(`${cfg.comfyBase}${sciezka}`, { ...opcje, signal: AbortSignal.timeout(limitMs) });
    if (!r.ok) throw new Error(`ComfyUI HTTP ${r.status} na ${sciezka}`);
    return r.json();
}

/** Stan: ComfyUI żyje? wagi są? węzły są? — zanim ktoś kliknie „generuj". */
export async function stan() {
    const braki = [];
    let comfyZyje = false;
    try {
        const info = await comfy('/object_info/Trellis2ShapeStage', {}, 6000);
        comfyZyje = !!info.Trellis2ShapeStage;
        if (!comfyZyje) braki.push('ComfyUI bez węzłów TRELLIS.2 — potrzebny rdzeń ≥ 0.35.');
    } catch { braki.push('ComfyUI nie odpowiada na :8188 — obudź go (POST /api/comfy/ensure).'); }
    const katalogWag = path.join(cfg.katalogBiblioteki, '..', 'models', '3d');
    for (const [typ, plik] of Object.entries(WYMAGANE)) if (!fsSync.existsSync(path.join(katalogWag, typ, plik))) braki.push(`brak wag ${typ}/${plik} — uruchom _OtakOs_AI/models/3d/pobierz-trellis2.sh`);
    for (const g of [GRAF_OBRAZ, GRAF_3D]) if (!fsSync.existsSync(path.join(cfg.katalogWorkflow, g))) braki.push(`brak grafu ${g}`);
    return { gotowe: comfyZyje && braki.length === 0, comfy: comfyZyje, braki, silnik: 'TRELLIS.2 (MIT) + FLUX.2 klein + BiRefNet', zadanW_toku: [...zadania.values()].filter((z) => z.stan === 'trwa').length };
}

// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTEKA
// ─────────────────────────────────────────────────────────────────────────────
export async function lista() {
    await fs.mkdir(cfg.katalogBiblioteki, { recursive: true });
    const out = [];
    for (const d of await fs.readdir(cfg.katalogBiblioteki, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        try { out.push(JSON.parse(await fs.readFile(path.join(dirAssetu(d.name), 'meta.json'), 'utf8'))); } catch { /* katalog bez meta — pomijamy */ }
    }
    return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
}
export async function meta(id) {
    if (!idOk(id)) return null;
    try { return JSON.parse(await fs.readFile(path.join(dirAssetu(id), 'meta.json'), 'utf8')); } catch { return null; }
}
/** Katalog assetu (dla ruchu brył — services/RuchBryl.js). */
export const katalogAssetu = (id) => dirAssetu(id);
export function sciezkaPliku(id, plik) {
    if (!idOk(id) || !/^(model\.glb|master\.glb|obraz\.png|obraz-zrodlo\.(png|jpg|jpeg|webp)|ruch-[a-z]+\.(glb|mp4))$/.test(plik)) return null;
    const p = path.join(dirAssetu(id), plik);
    return fsSync.existsSync(p) ? p : null;
}
export async function usun(id) {
    if (!idOk(id) || !fsSync.existsSync(dirAssetu(id))) return false;
    await fs.rm(dirAssetu(id), { recursive: true, force: true });
    return true;
}

/** Inna liczba ścian bez liczenia od nowa: master.glb → model.glb. */
export async function uprosc(id, sciany) {
    const m = await meta(id);
    if (!m) throw new Error('Nie ma takiego assetu.');
    const master = path.join(dirAssetu(id), 'master.glb');
    if (!fsSync.existsSync(master)) throw new Error('Ten asset nie ma master.glb (starszy zapis) — wygeneruj od nowa.');
    if (m.tekstury) throw new Error(BEZ_LOKALNYCH);
    m.sciany = Math.max(300, Number(sciany) || 20000);
    m.siatka = await Siatka3D.przygotujPodGre(master, path.join(dirAssetu(id), 'model.glb'), m.sciany, opcjeFragmentu(m));
    m.rozmiarGlb = (await fs.stat(path.join(dirAssetu(id), 'model.glb'))).size;
    await fs.writeFile(path.join(dirAssetu(id), 'meta.json'), JSON.stringify(m, null, 2), 'utf8');
    return m;
}

/** „Do gry": kopia GLB do public/assety projektu + wpis w assety.json (Kodeks czyta to w prompcie). */
export async function doGry(id, projektId, { ruch = null } = {}) {
    const m = await meta(id);
    if (!m) throw new Error('Nie ma takiego assetu.');
    if (!/^[a-z0-9-]{2,48}$/.test(String(projektId || '')) || !fsSync.existsSync(path.join(cfg.katalogApek, projektId))) throw new Error('Nie ma takiego projektu gry.');
    // Z ruchem: animowany GLB z RuchBryl (ruch-<id>.glb) jako osobny plik gry, z nazwą animacji dla Kodeksa.
    const wpisRuchu = ruch ? (m.ruchy ?? []).find((r) => r.ruch === ruch) : null;
    if (ruch && !wpisRuchu) throw new Error(`Bryła nie ma ruchu „${ruch}” — najpierw go policz.`);
    const glb = path.join(dirAssetu(id), wpisRuchu ? wpisRuchu.glb : 'model.glb');
    if (!fsSync.existsSync(glb)) throw new Error('Asset nie ma jeszcze modelu (generowanie trwa albo padło).');
    const dir = path.join(cfg.katalogApek, projektId, 'public', 'assety');
    await fs.mkdir(dir, { recursive: true });
    const nazwaPliku = wpisRuchu ? `${m.nazwa}-${ruch}.glb` : `${m.nazwa}.glb`;
    await fs.copyFile(glb, path.join(dir, nazwaPliku));
    const plikKat = path.join(dir, 'assety.json');
    let kat = [];
    try { kat = JSON.parse(await fs.readFile(plikKat, 'utf8')); } catch { kat = []; }
    kat = kat.filter((a) => a.plik !== nazwaPliku);
    const sw = m.siatka?.swiatlo;   // ✨ świecące oko: gra stawia PointLight (userData.swiatlo węzła „asset”)
    kat.push({ plik: nazwaPliku, nazwa: m.nazwa, opis: m.opis, sciany: m.sciany ?? null, zrodlo: id, ...(wpisRuchu ? { animacja: `ruch_${ruch}` } : {}), ...(sw && !wpisRuchu ? { swiatlo: { kolor: sw.kolor, moc: sw.moc } } : {}), dodano: new Date().toISOString() });
    await fs.writeFile(plikKat, JSON.stringify(kat, null, 2), 'utf8');
    m.wGrach = [...new Set([...(m.wGrach ?? []), projektId])];
    await fs.writeFile(path.join(dirAssetu(id), 'meta.json'), JSON.stringify(m, null, 2), 'utf8');
    await cfg.szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'praca', tresc: `„${m.nazwa}.glb" dodany do gry „${projektId}"`, dane: { projekt: projektId, asset: id } }).catch(() => {});
    return { plik: `assety/${nazwaPliku}`, katalog: kat };
}

/** Lista assetów projektu — do promptu Kodeksa (AppStudio pyta o to przy każdej rundzie gry). */
export async function assetyProjektu(projektId) {
    try { return JSON.parse(await fs.readFile(path.join(cfg.katalogApek, projektId, 'public', 'assety', 'assety.json'), 'utf8')); } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENEROWANIE — zadanie w tle: obraz (opcjonalnie) → 3D → biblioteka
// ─────────────────────────────────────────────────────────────────────────────
const zadania = new Map();
export function zadanie(id) { return zadania.get(id) ?? null; }
export function zadaniaLista() { return [...zadania.values()].map((z) => ({ id: z.id, asset: z.asset ?? null, obraz: z.obraz ?? null, stan: z.stan, etap: z.etap, od: z.od, koniec: z.koniec ?? null, blad: z.blad ?? null })); }

/**
 * 🖼️ Style Pracowni obrazów (Suweren 2026-10-06: „generator, co generuje takie zdjęcia, a potem z nich modele 3D”).
 * Tylko `pojedynczy` idzie do TRELLIS.2 w całości. Zestaw modelarski, karta postaci i krajobraz to KONCEPT — z nich do
 * 3D idzie WYCINEK (jeden obiekt), bo cały arkusz daje bryłę-kolaż (zmierzone u Suwerena: kit DRIFT.01 → trzy bryły naraz).
 */
export const STYLE_OBRAZU = {
    pojedynczy: { nazwa: 'Jeden obiekt (prosto do 3D)', do3d: true, szer: 1024, wys: 1024, baza: 'game asset concept art, single object, full body, front three-quarter view, centered, isolated on plain white background, no ground shadow, no text, clean silhouette, studio lighting' },
    zestaw: { nazwa: 'Zestaw modelarski (części + złożony)', do3d: false, szer: 1344, wys: 768, baza: 'scale model kit product shot, left: exploded view of every separate part laid out on grey sprue frames, right: the fully assembled figure standing in a white display box, clean white studio background, orthographic, high detail 3D render' },
    postac: { nazwa: 'Karta postaci (przód, bok, tył)', do3d: false, szer: 1344, wys: 768, baza: 'character turnaround sheet, the same character shown front view, side view and back view, full body, relaxed stance, plain light grey background, orthographic, consistent design, game character concept art, no text' },
    krajobraz: { nazwa: 'Kraina / krajobraz', do3d: false, szer: 1344, wys: 768, baza: 'wide establishing shot of a fantasy game world landscape, epic scale, painterly concept art, atmospheric perspective, rich color, no characters, no text' },
};

/** Opis po polsku → prompt obrazu po angielsku pod asset (białe tło, cały obiekt, bez tekstu). */
async function promptObrazu(opis, baza = STYLE_OBRAZU.pojedynczy.baza) {
    if (!cfg.pisz) return `${opis}. ${baza}`;
    try {
        const odp = await cfg.pisz({
            system: 'Przekładasz opis obiektu do gry na krótki angielski prompt dla modelu obrazu. Odpowiadasz JEDNĄ linią po angielsku: sam obiekt, jego materiały, kolory i cechy (maks 40 słów). Bez tła, bez sceny, bez kamery, bez zdań o stylu — to dokleję sam.',
            prompt: opis, model: cfg.model(), timeoutMs: 120_000,
        });
        const linia = String(odp.tekst || '').trim().split('\n').find((l) => l.trim()) || '';
        return `${linia.replace(/^["“]|["”]$/g, '') || opis}. ${baza}`;
    } catch { return `${opis}. ${baza}`; }
}

async function czekajNaComfy(promptId, { limitMs, naPostep }) {
    const t0 = Date.now();
    for (;;) {
        await new Promise((r) => setTimeout(r, 5000));
        const h = await comfy(`/history/${encodeURIComponent(promptId)}`, {}, 20000);
        const w = h?.[promptId];
        if (w) {
            if (w.status?.status_str === 'error') {
                const msg = (w.status.messages || []).find((m) => m[0] === 'execution_error')?.[1];
                throw new Error(`ComfyUI: ${msg?.exception_message || 'błąd wykonania'} (węzeł ${msg?.node_type || '?'})`);
            }
            return { sekundy: Math.round((Date.now() - t0) / 1000), outputs: w.outputs ?? {} };
        }
        naPostep?.(Math.round((Date.now() - t0) / 1000));
        if (Date.now() - t0 > limitMs) throw new Error(`ComfyUI nie skończył w ${Math.round(limitMs / 60000)} min`);
    }
}

/** Wyładuj model Ollamy z karty (keep_alive 0). Zmierzone 2026-09-22: gemma4:e2b po przetłumaczeniu
 *  promptu trzymał 1,7 GB VRAM — a TRELLIS.2 na 6 GB liczy się wtedy dużo wolniej albo pada. */
async function zwolnijOllame(model) {
    try { await fetch(`${cfg.ollamaBase}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, keep_alive: 0 }), signal: AbortSignal.timeout(15000) }); } catch { /* nie krytyczne */ }
}

/** POST /free — wyładuj modele i zwolnij pamięć karty (między etapami; w środku grafu się nie da). */
async function zwolnijVram() {
    try { await fetch(`${cfg.comfyBase}/free`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unload_models: true, free_memory: true }), signal: AbortSignal.timeout(30000) }); } catch { /* nie krytyczne */ }
    await new Promise((r) => setTimeout(r, 3000));
}

async function zlecGraf(graf) {
    const r = await fetch(`${cfg.comfyBase}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graf }), signal: AbortSignal.timeout(30000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.error) throw new Error(`ComfyUI odrzucił graf: ${JSON.stringify(d?.error ?? d).slice(0, 300)}`);
    return d.prompt_id;
}

async function wgrajObraz(sciezka, nazwa) {
    const fd = new FormData();
    fd.append('image', new Blob([await fs.readFile(sciezka)], { type: 'image/png' }), nazwa);
    fd.append('overwrite', 'true');
    const r = await fetch(`${cfg.comfyBase}/upload/image`, { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`ComfyUI nie przyjął obrazu (HTTP ${r.status})`);
    return (await r.json()).name;
}

function plikZOutputs(outputs, klucze) {
    for (const out of Object.values(outputs)) for (const k of klucze) for (const p of out?.[k] ?? []) return path.join(outputComfy(), p.subfolder ?? '', p.filename);
    return null;
}

/** FLUX.2 klein: prompt → plik PNG w wyjściu ComfyUI (ścieżka). */
async function rysuj({ prompt, szer = 1024, wys = 1024, ziarno = null, prefiks, z }) {
    const g = JSON.parse(await fs.readFile(path.join(cfg.katalogWorkflow, GRAF_OBRAZ), 'utf8')); delete g._opis;
    g['5'].inputs.text = prompt;
    g['7'].inputs.width = szer; g['7'].inputs.height = wys; g['8'].inputs.width = szer; g['8'].inputs.height = wys;
    g['11'].inputs.noise_seed = Number.isFinite(Number(ziarno)) && ziarno !== null && ziarno !== '' ? Number(ziarno) : Math.floor(Math.random() * 1e9);
    g['14'].inputs.filename_prefix = prefiks;
    const w = await czekajNaComfy(await zlecGraf(g), { limitMs: 15 * 60_000, naPostep: (s) => { if (z) z.sekundyEtapu = s; } });
    const plik = plikZOutputs(w.outputs, ['images']);
    if (!plik) throw new Error('FLUX nie oddał obrazu.');
    return plik;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🖼️ PRACOWNIA OBRAZÓW — obraz bez 3D (koncept), potem wycinek → bryła
// ─────────────────────────────────────────────────────────────────────────────
const katalogObrazow = () => cfg.katalogObrazow || path.join(cfg.katalogBiblioteki, '..', 'obrazy-gry');
const dirObrazu = (id) => path.join(katalogObrazow(), id);

/** Wycinek {x, y, w, h} w ułamkach 0–1 → filtr ffmpeg: wytnij i dołóż białe pole do kwadratu (TRELLIS lubi kwadrat). */
export function filtrWycinka(w) {
    const n = (v) => Number(v);
    const x = n(w?.x), y = n(w?.y), sz = n(w?.w), wy = n(w?.h);
    if (![x, y, sz, wy].every(Number.isFinite) || x < 0 || y < 0 || sz <= 0.02 || wy <= 0.02 || x + sz > 1.0001 || y + wy > 1.0001) {
        throw new Error('Wycinek ma być {x, y, w, h} w ułamkach 0–1 i mieścić się w obrazie.');
    }
    const f = (v) => v.toFixed(4);
    return `crop=trunc(iw*${f(sz)}):trunc(ih*${f(wy)}):trunc(iw*${f(x)}):trunc(ih*${f(y)}),pad=max(iw\\,ih):max(iw\\,ih):(ow-iw)/2:(oh-ih)/2:white`;
}

export async function listaObrazow() {
    try { await fs.mkdir(katalogObrazow(), { recursive: true }); } catch { return []; }
    const out = [];
    for (const d of await fs.readdir(katalogObrazow(), { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        try { out.push(JSON.parse(await fs.readFile(path.join(dirObrazu(d.name), 'meta.json'), 'utf8'))); } catch { /* bez meta */ }
    }
    return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
}
export async function metaObrazu(id) {
    if (!idOk(id)) return null;
    try { return JSON.parse(await fs.readFile(path.join(dirObrazu(id), 'meta.json'), 'utf8')); } catch { return null; }
}
export function plikObrazu(id) {
    if (!idOk(id)) return null;
    const p = path.join(dirObrazu(id), 'obraz.png');
    return fsSync.existsSync(p) ? p : null;
}
export async function usunObraz(id) {
    if (!idOk(id) || !fsSync.existsSync(dirObrazu(id))) return false;
    await fs.rm(dirObrazu(id), { recursive: true, force: true });
    return true;
}

/**
 * ✨ UPIĘKSZ LOKALNIE (Suweren 2026-10-07: „daj do każdego już wygenerowanego i na przyszłość… klikając dane
 * się nie przenoszą”): ta sama bryła liczona od nowa z TEGO SAMEGO źródła (obraz Pracowni + wycinek albo
 * zdjęcie/obraz źródłowy z katalogu bryły), z opisem, nazwą i gałęzią — tylko gęściej: 1024 i więcej ścian.
 * Stara bryła zostaje (nowa ma `ulepsza: <stary id>`); do gry idzie, gdy Suweren ją tam wyśle.
 */
export async function upiekszLokalnie(id, { rozdzielczosc = 1024, sciany = 30000 } = {}) {
    const m = await meta(id);
    if (!m) throw new Error('Nie ma takiego assetu.');
    // Poprawki tej bryły (kolor, gęstszy fragment) przechodzą na nową — liczona od nowa nie wraca do ciemnej wersji.
    const wspolne = { opis: m.opis, nazwa: m.nazwa, rozdzielczosc: Number(rozdzielczosc) || 1024, sciany: Number(sciany) || 30000, ulepsza: id, poprawki: m.poprawki ?? [] };
    if (m.zObrazu && plikObrazu(m.zObrazu)) return generuj({ ...wspolne, zObrazu: m.zObrazu, wycinek: m.wycinek ?? null });
    const zrodlo = ['obraz-zrodlo.png', 'obraz-zrodlo.jpg', 'obraz-zrodlo.webp', 'obraz.png'].map((p) => path.join(dirAssetu(id), p)).find((p) => fsSync.existsSync(p));
    if (!zrodlo) throw new Error('Ta bryła nie ma zapisanego obrazu źródłowego — nie ma z czego liczyć jej od nowa.');
    return generuj({ ...wspolne, zdjecie: zrodlo });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎨🔍 POPRAWKI BRYŁY (Suweren 2026-10-07/08: „zmiana koloru” i „60 000 na samą twarz”). Bez GPU i bez
// ComfyUI: kolory wierzchołków i upraszczanie z mastera (services/Siatka3D.js), sekundy. Każda poprawka =
// NOWA wersja obok starej (`ulepsza`), z listą `poprawki` (kolejne kolory składają się; fragment — ostatni).
// ─────────────────────────────────────────────────────────────────────────────
const USTAWIENIA_KOLORU = ['jasnosc', 'kontrast', 'nasycenie', 'odcien', 'czern', 'auto'];
function oczyscKolor(k = {}) {
    const o = {};
    for (const a of ['jasnosc', 'kontrast', 'nasycenie']) o[a] = Math.max(-1, Math.min(1, Number(k[a]) || 0));
    o.odcien = Math.max(-180, Math.min(180, Number(k.odcien) || 0));
    o.czern = Math.max(0, Math.min(1, Number(k.czern) || 0));
    o.auto = !!k.auto;
    if (USTAWIENIA_KOLORU.every((a) => !o[a])) throw new Error('Kolor bez zmian — przesuń któryś suwak albo włącz auto-poziomy.');
    return o;
}
/** Opcje siatki z poprawek: ostatni „fragment” (gęściej w pudełku) i ostatnie „swiatlo” (świecące oko). */
function opcjeFragmentu(m) {
    const ost = (r) => [...(m.poprawki ?? [])].reverse().find((p) => p.rodzaj === r);
    const f = ost('fragment'), s = ost('swiatlo');
    return { ...(f ? { fragment: f.pudelko, scianyFragmentu: f.sciany } : {}), ...(s ? { swiatlo: { pudelko: s.pudelko, prog: s.prog, kolor: s.kolor, moc: s.moc } } : {}) };
}
/** Nałóż poprawki koloru (po kolei) na master → zapis do `cel`. Zwraca poziomy jasności po zmianie. */
async function kolorujMaster(zrodlo, cel, poprawki) {
    const s = await Siatka3D.wczytajISpawaj(zrodlo);
    if (!s.kolory) throw new Error('Ta bryła nie ma kolorów wierzchołków — nie ma czego przekolorować.');
    for (const p of poprawki.filter((x) => x.rodzaj === 'kolor')) s.kolory = Siatka3D.przekoloruj(s.kolory, p);
    await Siatka3D.zapiszGlb(s, s.indeksy, cel);
    return Siatka3D.poziomy(s.kolory);
}

async function nowaWersja(id, poprawka, { sciany } = {}) {
    const m = await meta(id);
    if (!m) throw new Error('Nie ma takiego assetu.');
    if (m.stan !== 'gotowe') throw new Error('Bryła jeszcze się liczy albo padła — poprawki tylko na gotowej.');
    if (m.tekstury) throw new Error(BEZ_LOKALNYCH);
    const master = path.join(dirAssetu(id), 'master.glb');
    if (!fsSync.existsSync(master)) throw new Error('Ta bryła nie ma master.glb (starszy zapis) — wygeneruj ją od nowa („Upiększ lokalnie”).');
    let nowy = `${m.nazwa}-${crypto.randomBytes(2).toString('hex')}`;
    while (fsSync.existsSync(dirAssetu(nowy))) nowy = `${m.nazwa}-${crypto.randomBytes(2).toString('hex')}`;
    const dir = dirAssetu(nowy);
    await fs.mkdir(dir, { recursive: true });
    try {
        const t0 = Date.now();
        for (const p of await fs.readdir(dirAssetu(id))) if (/^(obraz\.png|obraz-zrodlo\.(png|jpg|jpeg|webp)|wycinek\.png)$/.test(p)) await fs.copyFile(path.join(dirAssetu(id), p), path.join(dir, p));
        const { ruchy: _r, blad: _b, siatka: _s, rozmiarGlb: _g, wGrach: _w, jasnoscKolorow: _j, ...reszta } = m;
        const n = { ...reszta, id: nowy, utworzono: new Date().toISOString(), stan: 'gotowe', wGrach: [], ulepsza: id, sciany: Math.max(300, Number(sciany) || m.sciany || 8000), czasy: {}, poprawki: [...(m.poprawki ?? []), poprawka] };
        // Kolor: przeliczony master (kolejna poprawka koloru liczy się na już poprawionym). Fragment: master bez zmian.
        if (poprawka.rodzaj === 'kolor') n.jasnoscKolorow = await kolorujMaster(master, path.join(dir, 'master.glb'), [poprawka]);
        else await fs.copyFile(master, path.join(dir, 'master.glb'));
        n.siatka = await Siatka3D.przygotujPodGre(path.join(dir, 'master.glb'), path.join(dir, 'model.glb'), n.sciany, opcjeFragmentu(n));
        n.rozmiarGlb = (await fs.stat(path.join(dir, 'model.glb'))).size;
        n.czasy.razem = Math.round((Date.now() - t0) / 1000);
        await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(n, null, 2), 'utf8');
        const co = poprawka.rodzaj === 'kolor' ? 'kolor' : poprawka.rodzaj === 'swiatlo' ? `świeci ${n.siatka.swiatlo?.trojkaty ?? '?'} ścian (${n.siatka.swiatlo?.kolor ?? ''})` : `gęściej we fragmencie: ${n.siatka.fragment?.trojkaty ?? '?'} ścian`;
        await cfg.szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'praca', tresc: `„${m.nazwa}” — nowa wersja (${co})`, dane: { asset: nowy, z: id } }).catch(() => {});
        return n;
    } catch (e) { await fs.rm(dir, { recursive: true, force: true }); throw e; }
}

/** 🎨 Przekoloruj bryłę: jasność, kontrast, nasycenie (−1…1), odcień (°), podnieś czerń (0…1), auto-poziomy → nowa wersja. */
export async function przekolorujBryle(id, ustawienia = {}) {
    return nowaWersja(id, { rodzaj: 'kolor', ...oczyscKolor(ustawienia), kiedy: new Date().toISOString() });
}

/** 🔍 Gęściej we fragmencie: pudełko {x0,x1,y0,y1[,z0,z1]} (ułamki ramki bryły, y w górę) + ściany fragmentu i całości. */
export async function zageszczFragment(id, { fragment, scianyFragmentu = 40000, sciany } = {}) {
    const pudelko = Siatka3D.oczyscFragment(fragment);
    const sf = Math.max(1000, Math.min(200000, Number(scianyFragmentu) || 40000));
    const m = await meta(id);
    const razem = Math.max(sf + 1000, Number(sciany) || (m?.sciany ?? 8000) + sf);
    return nowaWersja(id, { rodzaj: 'fragment', pudelko, sciany: sf, kiedy: new Date().toISOString() }, { sciany: razem });
}

/**
 * ✨ Świecące oko: pudełko (ułamki ramki bryły, y w górę) + próg jasności 0–1 (świeci tylko to, co jaśniejsze — oko
 * na ciemnym futrze), kolor `#rrggbb` albo null (średni z oka, rozjaśniony), moc 0,5–50 → nowa wersja.
 */
export async function zaswiec(id, { fragment, prog = 0.5, kolor = null, moc = 4 } = {}) {
    const pudelko = Siatka3D.oczyscFragment(fragment);
    const k = kolor ? String(kolor) : null;
    if (k && !Siatka3D.zHex(k)) throw new Error('Kolor światła: podaj #rrggbb (albo nic — wtedy kolor oka).');
    return nowaWersja(id, { rodzaj: 'swiatlo', pudelko, prog: Math.max(0, Math.min(1, Number(prog) || 0)), kolor: k, moc: Math.max(0.5, Math.min(50, Number(moc) || 4)), kiedy: new Date().toISOString() });
}

// ─────────────────────────────────────────────────────────────────────────────
// ☁️ WERSJA Z CHMURY (services/ChmuraBryl.js — Meshy). GLB z chmury ma TEKSTURY i UV, nie kolory wierzchołków:
// zapisujemy go bez przeróbek (Siatka3D zdjęłaby tekstury) jako model.glb i master.glb nowej wersji (`tekstury: true`).
// ─────────────────────────────────────────────────────────────────────────────
const BEZ_LOKALNYCH = 'To wersja z chmury (Meshy) — ma tekstury, a lokalne poprawki (kolor, gęstszy fragment, oko, uproszczenie) działają na kolorach wierzchołków. Zrób je na wersji sprzed chmury, a potem wyślij ją do chmury jeszcze raz.';

/** Plik bryły do wysłania w chmurę: model.glb (ten, który idzie do gry). */
export async function plikDoChmury(id) {
    const m = await meta(id);
    if (!m) throw new Error('Nie ma takiego assetu.');
    if (m.stan !== 'gotowe') throw new Error('Bryła jeszcze się liczy albo padła.');
    const sciezka = path.join(dirAssetu(id), 'model.glb');
    if (!fsSync.existsSync(sciezka)) throw new Error('Bryła nie ma model.glb.');
    return { sciezka, bajty: await fs.readFile(sciezka) };
}

/** Nowa wersja z GLB z chmury — obok starej (`ulepsza`), z wpisem o usłudze, zleceniu i kredytach. */
export async function wersjaZChmury(id, glb, wpis) {
    const m = await meta(id);
    if (!m) throw new Error('Nie ma takiego assetu.');
    if (!Buffer.isBuffer(glb) || glb.length < 12 || glb.toString('ascii', 0, 4) !== 'glTF') throw new Error('Chmura oddała plik, który nie jest GLB.');
    let nowy = `${m.nazwa}-${crypto.randomBytes(2).toString('hex')}`;
    while (fsSync.existsSync(dirAssetu(nowy))) nowy = `${m.nazwa}-${crypto.randomBytes(2).toString('hex')}`;
    const dir = dirAssetu(nowy);
    await fs.mkdir(dir, { recursive: true });
    for (const p of await fs.readdir(dirAssetu(id))) if (/^(obraz\.png|obraz-zrodlo\.(png|jpg|jpeg|webp)|wycinek\.png)$/.test(p)) await fs.copyFile(path.join(dirAssetu(id), p), path.join(dir, p));
    await fs.writeFile(path.join(dir, 'model.glb'), glb);
    await fs.writeFile(path.join(dir, 'master.glb'), glb);
    const { ruchy: _r, blad: _b, siatka: _s, rozmiarGlb: _g, wGrach: _w, jasnoscKolorow: _j, ...reszta } = m;
    const n = { ...reszta, id: nowy, utworzono: new Date().toISOString(), stan: 'gotowe', wGrach: [], ulepsza: id, tekstury: true, chmura: wpis, rozmiarGlb: glb.length, czasy: {}, poprawki: [...(m.poprawki ?? []), { rodzaj: 'chmura', usluga: wpis.usluga, zlecenie: wpis.rodzaj, kredyty: wpis.kredyty, kiedy: wpis.kiedy }] };
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(n, null, 2), 'utf8');
    return n;
}

/** Ramka sylwetki na obrazie źródłowym (ułamki 0–1, y w dół) — Game Studio przelicza zaznaczenie na obrazie na pudełko bryły. */
export async function sylwetka(id) {
    const p = sciezkaPliku(id, 'obraz.png');
    if (!p) throw new Error('Ta bryła nie ma obrazu źródłowego.');
    const N = 256;
    const { stdout } = await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-i', p, '-vf', `scale=${N}:${N}:flags=area,format=rgba`, '-f', 'rawvideo', '-'], { encoding: 'buffer', maxBuffer: N * N * 4 + 1024 });
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        const tlo = stdout[i + 3] < 128 || (stdout[i] > 237 && stdout[i + 1] > 237 && stdout[i + 2] > 237);
        if (!tlo) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { x0: 0, y0: 0, x1: 1, y1: 1, pewna: false };
    return { x0: x0 / N, y0: y0 / N, x1: (x1 + 1) / N, y1: (y1 + 1) / N, pewna: true };
}

/** Obraz z opisu w stylu Pracowni — w tle (jedno zadanie GPU naraz, wspólna kolejka z bryłami). */
export async function obraz({ opis, styl = 'pojedynczy', galaz = null, projekt = null, ziarno = null } = {}) {
    const st = STYLE_OBRAZU[styl];
    if (!st) throw new Error(`Nieznany styl „${styl}”. Są: ${Object.keys(STYLE_OBRAZU).join(', ')}.`);
    const tekst = String(opis || '').trim();
    if (tekst.length < 3) throw new Error('Opisz, co narysować.');
    await zywyComfy('/object_info/EmptyFlux2LatentImage');
    if (!fsSync.existsSync(path.join(cfg.katalogWorkflow, GRAF_OBRAZ))) throw new Error(`brak grafu ${GRAF_OBRAZ}`);
    if ([...zadania.values()].some((z) => z.stan === 'trwa')) throw new Error('Jedno zadanie GPU naraz — ComfyUI już liczy.');
    const baza = slug(tekst);
    let id = `${baza}-${crypto.randomBytes(2).toString('hex')}`;
    while (fsSync.existsSync(dirObrazu(id))) id = `${baza}-${crypto.randomBytes(2).toString('hex')}`;
    await fs.mkdir(dirObrazu(id), { recursive: true });
    const m = { id, opis: tekst.slice(0, 1000), styl, galaz: galaz ? String(galaz).slice(0, 60) : null, projekt: projekt ? String(projekt).slice(0, 60) : null, szer: st.szer, wys: st.wys, do3d: st.do3d, stan: 'trwa', utworzono: new Date().toISOString(), bryly: [] };
    const zapisz = () => fs.writeFile(path.join(dirObrazu(id), 'meta.json'), JSON.stringify(m, null, 2), 'utf8');
    await zapisz();
    const z = { id: `ob-${Date.now().toString(36)}`, obraz: id, stan: 'trwa', etap: 'prompt', kroki: [], od: m.utworzono };
    zadania.set(z.id, z);
    (async () => {
        const t0 = Date.now();
        try {
            m.promptObrazu = await promptObrazu(tekst, st.baza);
            await zwolnijOllame(cfg.model());
            z.etap = 'obraz';
            const plik = await rysuj({ prompt: m.promptObrazu, szer: st.szer, wys: st.wys, ziarno, prefiks: `katedra/obrazy-gry/${id}`, z });
            await fs.copyFile(plik, path.join(dirObrazu(id), 'obraz.png'));
            m.stan = 'gotowe'; m.czas = Math.round((Date.now() - t0) / 1000);
            z.stan = 'gotowe'; z.etap = 'gotowe';
            await cfg.szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'praca', tresc: `obraz „${tekst.slice(0, 60)}” (${st.nazwa}) gotowy w ${m.czas} s`, dane: { obraz: id } }).catch(() => {});
        } catch (e) {
            m.stan = 'blad'; m.blad = e.message; z.stan = 'blad'; z.blad = e.message;
        } finally { z.koniec = new Date().toISOString(); await zapisz().catch(() => {}); }
    })();
    return { zadanie: z.id, obraz: id };
}

/**
 * Zlecenie. `zrodlo`: { tekst } albo { zdjecie: <ścieżka pliku> } albo { zObrazu: <id z Pracowni>, wycinek? }. Opcje: sciany (domyślnie 20000),
 * rozdzielczosc (1024|1152|…|2048 — wokselowa, więcej = dokładniej i wolniej), ziarno.
 */
export async function generuj({ nazwa, opis, tekst, zdjecie, zObrazu = null, wycinek = null, projekt = null, sciany = 8000, rozdzielczosc = 512, ziarno = null, ulepsza = null, poprawki = [] } = {}) {
    let mObrazu = null;
    if (zObrazu) {
        mObrazu = await metaObrazu(zObrazu);
        if (!mObrazu || !plikObrazu(zObrazu)) throw new Error('Nie ma takiego obrazu w Pracowni (albo jeszcze się rysuje).');
        if (!wycinek && !mObrazu.do3d) throw new Error('To koncept (arkusz, karta postaci, kraina) — zaznacz wycinek z JEDNYM obiektem, inaczej TRELLIS.2 zrobi bryłę-kolaż.');
        if (wycinek) filtrWycinka(wycinek);
        tekst = null;
        opis = opis || mObrazu.opis;
        nazwa = nazwa || mObrazu.opis.slice(0, 40);
    }
    if (!tekst && !zdjecie && !zObrazu) throw new Error('Podaj opis albo zdjęcie.');
    await zywyComfy('/object_info');
    const s = await stan();
    if (!s.gotowe) throw new Error(s.braki.join(' | '));
    if ([...zadania.values()].some((z) => z.stan === 'trwa')) throw new Error('Jeden asset naraz — ComfyUI ma 6 GB VRAM.');
    const baza = slug(nazwa || tekst || 'asset');
    let assetId = `${baza}-${crypto.randomBytes(2).toString('hex')}`;
    while (fsSync.existsSync(dirAssetu(assetId))) assetId = `${baza}-${crypto.randomBytes(2).toString('hex')}`;
    const dir = dirAssetu(assetId);
    await fs.mkdir(dir, { recursive: true });
    const z = { id: `a3-${Date.now().toString(36)}`, asset: assetId, stan: 'trwa', etap: 'start', kroki: [], od: new Date().toISOString(), czasy: {} };
    zadania.set(z.id, z);
    const krok = (etap, tekst) => { z.etap = etap; z.kroki.push({ kiedy: new Date().toISOString(), etap, tekst: String(tekst).slice(0, 500) }); };
    if (zObrazu) {
        // Wycinek liczymy od razu (szybki ffmpeg) — błąd filtra wraca w odpowiedzi, nie w tle.
        const wyj = path.join(dir, 'wycinek.png');
        const filtr = wycinek ? filtrWycinka(wycinek) : 'pad=max(iw\\,ih):max(iw\\,ih):(ow-iw)/2:(oh-ih)/2:white';
        try { await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-y', '-i', plikObrazu(zObrazu), '-vf', filtr, '-frames:v', '1', wyj]); }
        catch (e) { await fs.rm(dir, { recursive: true, force: true }); throw new Error(`Nie wyciąłem obrazu: ${String(e.stderr || e.message).slice(0, 200)}`); }
        zdjecie = wyj;
    }
    const m = { id: assetId, nazwa: baza, opis: String(opis || tekst || nazwa || '').slice(0, 500), zrodlo: zObrazu ? 'obraz' : tekst ? 'tekst' : 'zdjecie', ...(zObrazu ? { zObrazu, wycinek: wycinek ?? null, galaz: mObrazu.galaz ?? null } : {}), tekst: tekst ? String(tekst).slice(0, 1000) : null, sciany: Number(sciany) || 8000, rozdzielczosc: Number(rozdzielczosc) || 512, utworzono: z.od, stan: 'trwa', silnik: 'TRELLIS.2', czasy: {}, wGrach: [], ...(ulepsza ? { ulepsza } : {}), ...(poprawki?.length ? { poprawki } : {}) };
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(m, null, 2), 'utf8');

    (async () => {
        const t0 = Date.now();
        try {
            let obraz;
            if (zdjecie) {
                const ext = (path.extname(zdjecie).toLowerCase().replace('.', '') || 'png').replace('jpeg', 'jpg');
                obraz = path.join(dir, `obraz-zrodlo.${ext}`);
                await fs.copyFile(zdjecie, obraz);
                krok('zdjecie', `zdjęcie źródłowe: ${path.basename(zdjecie)}`);
            } else {
                krok('prompt', 'tłumaczę opis na prompt obrazu…');
                const prompt = await promptObrazu(tekst);
                await zwolnijOllame(cfg.model());
                m.promptObrazu = prompt;
                krok('obraz', `FLUX.2 klein rysuje: ${prompt.slice(0, 160)}…`);
                const t1 = Date.now();
                const zrodlo = await rysuj({ prompt, szer: 1024, wys: 1024, ziarno, prefiks: `katedra/assety/${assetId}_obraz`, z });
                obraz = path.join(dir, 'obraz.png');
                await fs.copyFile(zrodlo, obraz);
                m.czasy.obraz = Math.round((Date.now() - t1) / 1000);
                krok('obraz', `obraz gotowy w ${m.czasy.obraz} s`);
            }
            if (!fsSync.existsSync(path.join(dir, 'obraz.png'))) await fs.copyFile(obraz, path.join(dir, 'obraz.png')).catch(() => {});

            // Zwalniamy VRAM po FLUX-ie: z jego wagami w karcie TRELLIS.2 dochodził do DecimateMesh
            // i padał na „Allocation on device" (zmierzone 2026-09-22 w pełnym przebiegu).
            await zwolnijVram();
            krok('3d', 'TRELLIS.2: tło → struktura → kształt → tekstura…');
            const nazwaWejscia = await wgrajObraz(obraz, `${assetId}.png`);
            const g3 = JSON.parse(await fs.readFile(path.join(cfg.katalogWorkflow, GRAF_3D), 'utf8')); delete g3._opis;
            g3['1'].inputs.image = nazwaWejscia;
            // 512 = bez etapu upsamplingu (węzły 20/21): tekstura liczona na kształcie 512. Zmierzone
            // 2026-09-22: 1024 → 712 s i OOM na VaeDecodeTextureTrellis przy gęstszej bryle (6 GB);
            // 512 → ~70 s końcówki, 94 tys. ścian mastera, golem w pełni czytelny przy 6 tys. ścian.
            const rozdz = Number(rozdzielczosc) || 512;
            if (rozdz < 1024) {
                delete g3['20']; delete g3['21'];
                g3['22'].inputs.samples = ['19', 0];
                g3['23'].inputs = { positive: ['16', 0], negative: ['16', 1], shape_latent: ['19', 0] };
            } else {
                g3['20'].inputs.target_resolution = Math.min(2048, Math.max(1024, Math.round(rozdz / 128) * 128));
            }
            g3['26'].inputs.target_face_count = 200000;   // master; pod grę upraszcza Siatka3D (patrz niżej)
            g3['29'].inputs.filename_prefix = `katedra/assety/${assetId}`;
            if (Number.isFinite(Number(ziarno))) for (const n of ['14', '19', '21', '24']) if (g3[n]) g3[n].inputs.seed = Number(ziarno) + Number(n);
            const t2 = Date.now();
            let w3;
            try { w3 = await czekajNaComfy(await zlecGraf(g3), { limitMs: 60 * 60_000, naPostep: (s) => { z.sekundyEtapu = s; } }); }
            catch (e) {
                // OOM na końcówce (DecimateMesh): etapy modelu są w cache ComfyUI, więc druga próba po
                // zwolnieniu VRAM liczy tylko decymację + malowanie (~3 min), nie 12 min od nowa.
                if (!/Allocation on device|out of memory/i.test(e.message)) throw e;
                krok('3d', `VRAM się skończył (${e.message.slice(0, 60)}…) — zwalniam i ponawiam końcówkę`);
                await zwolnijVram();
                w3 = await czekajNaComfy(await zlecGraf(g3), { limitMs: 30 * 60_000, naPostep: (s) => { z.sekundyEtapu = s; } });
            }
            m.czasy['3d'] = Math.round((Date.now() - t2) / 1000);
            // SaveGLB nie zgłasza pliku w outputs — szukamy po prefiksie w output/katedra/assety
            let glb = plikZOutputs(w3.outputs, ['3d', 'result', 'files']);
            if (!glb || !fsSync.existsSync(glb)) {
                const kat = path.join(outputComfy(), 'katedra', 'assety');
                const kandydaci = (await fs.readdir(kat)).filter((f) => f.startsWith(assetId) && f.endsWith('.glb')).sort();
                glb = kandydaci.length ? path.join(kat, kandydaci.at(-1)) : null;
            }
            if (!glb) throw new Error('TRELLIS.2 skończył, ale nie widzę pliku GLB w output/katedra/assety.');
            await fs.copyFile(glb, path.join(dir, 'master.glb'));
            if (m.poprawki?.some((p) => p.rodzaj === 'kolor')) { await kolorujMaster(path.join(dir, 'master.glb'), path.join(dir, 'master.glb'), m.poprawki); krok('siatka', 'kolor z poprzedniej wersji nałożony na nową bryłę'); }
            const t3 = Date.now();
            m.siatka = await Siatka3D.przygotujPodGre(path.join(dir, 'master.glb'), path.join(dir, 'model.glb'), m.sciany, opcjeFragmentu(m));
            m.czasy.uproszczenie = Math.round((Date.now() - t3) / 1000);
            m.rozmiarGlb = (await fs.stat(path.join(dir, 'model.glb'))).size;
            krok('siatka', `siatka: ${m.siatka.przed.trojkaty} → ${m.siatka.trojkaty} trójkątów (${(m.rozmiarGlb / 1e6).toFixed(2)} MB)`);
            m.stan = 'gotowe'; m.czasy.razem = Math.round((Date.now() - t0) / 1000);
            await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(m, null, 2), 'utf8');
            krok('gotowe', `GLB ${(m.rozmiarGlb / 1e6).toFixed(1)} MB w ${m.czasy.razem} s (3D: ${m.czasy['3d']} s)`);
            z.stan = 'gotowe';
            if (zObrazu) { try { const mo = await metaObrazu(zObrazu); mo.bryly = [...new Set([...(mo.bryly ?? []), assetId])]; await fs.writeFile(path.join(dirObrazu(zObrazu), 'meta.json'), JSON.stringify(mo, null, 2), 'utf8'); } catch { /* obraz mógł zniknąć */ } }
            if (projekt) { try { await doGry(assetId, projekt); krok('gotowe', `dodany do gry „${projekt}"`); } catch (e) { krok('gotowe', `nie dodałem do gry: ${e.message}`); } }
            await cfg.szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'praca', tresc: `asset „${m.nazwa}" gotowy w ${m.czasy.razem} s (TRELLIS.2)`, dane: { asset: assetId } }).catch(() => {});
        } catch (e) {
            z.stan = 'blad'; z.blad = e.message; krok('blad', e.message);
            m.stan = 'blad'; m.blad = e.message;
            await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(m, null, 2), 'utf8').catch(() => {});
            await cfg.szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'blad', tresc: `asset „${m.nazwa}": ${e.message}`, dane: { asset: assetId } }).catch(() => {});
        } finally { z.koniec = new Date().toISOString(); }
    })();

    return { zadanie: z.id, asset: assetId };
}

export default { plikDoChmury, wersjaZChmury, skonfiguruj, zywyComfy, upiekszLokalnie, przekolorujBryle, zageszczFragment, zaswiec, sylwetka, stan, lista, meta, katalogAssetu, sciezkaPliku, usun, uprosc, doGry, assetyProjektu, generuj, zadanie, zadaniaLista, STYLE_OBRAZU, filtrWycinka, obraz, listaObrazow, metaObrazu, plikObrazu, usunObraz };
