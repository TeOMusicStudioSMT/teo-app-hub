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
import * as Siatka3D from './Siatka3D.js';

const cfg = {
    comfyBase: 'http://127.0.0.1:8188',
    comfyDir: null,                 // …/ComfyUI_windows_portable (output = <dir>/ComfyUI/output)
    katalogWorkflow: null,          // _OtakOs_AI/workflows
    katalogBiblioteki: null,        // _OtakOs_AI/assety3d
    katalogApek: null,              // _OtakOs_Apki
    szyna: null,
    pisz: null,                     // AppStudio.pisz — tłumaczenie opisu na prompt obrazu
    ollamaBase: 'http://127.0.0.1:11434',
    model: () => 'gemma4:e2b',
};
export function skonfiguruj(o) { Object.assign(cfg, o); }

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
export function sciezkaPliku(id, plik) {
    if (!idOk(id) || !/^(model\.glb|master\.glb|obraz\.png|obraz-zrodlo\.(png|jpg|jpeg|webp))$/.test(plik)) return null;
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
    m.sciany = Math.max(300, Number(sciany) || 20000);
    m.siatka = await Siatka3D.przygotujPodGre(master, path.join(dirAssetu(id), 'model.glb'), m.sciany);
    m.rozmiarGlb = (await fs.stat(path.join(dirAssetu(id), 'model.glb'))).size;
    await fs.writeFile(path.join(dirAssetu(id), 'meta.json'), JSON.stringify(m, null, 2), 'utf8');
    return m;
}

/** „Do gry": kopia GLB do public/assety projektu + wpis w assety.json (Kodeks czyta to w prompcie). */
export async function doGry(id, projektId) {
    const m = await meta(id);
    if (!m) throw new Error('Nie ma takiego assetu.');
    if (!/^[a-z0-9-]{2,48}$/.test(String(projektId || '')) || !fsSync.existsSync(path.join(cfg.katalogApek, projektId))) throw new Error('Nie ma takiego projektu gry.');
    const glb = path.join(dirAssetu(id), 'model.glb');
    if (!fsSync.existsSync(glb)) throw new Error('Asset nie ma jeszcze modelu (generowanie trwa albo padło).');
    const dir = path.join(cfg.katalogApek, projektId, 'public', 'assety');
    await fs.mkdir(dir, { recursive: true });
    const nazwaPliku = `${m.nazwa}.glb`;
    await fs.copyFile(glb, path.join(dir, nazwaPliku));
    const plikKat = path.join(dir, 'assety.json');
    let kat = [];
    try { kat = JSON.parse(await fs.readFile(plikKat, 'utf8')); } catch { kat = []; }
    kat = kat.filter((a) => a.plik !== nazwaPliku);
    kat.push({ plik: nazwaPliku, nazwa: m.nazwa, opis: m.opis, sciany: m.sciany ?? null, zrodlo: id, dodano: new Date().toISOString() });
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
export function zadaniaLista() { return [...zadania.values()].map((z) => ({ id: z.id, asset: z.asset, stan: z.stan, etap: z.etap, od: z.od, koniec: z.koniec ?? null, blad: z.blad ?? null })); }

/** Opis po polsku → prompt obrazu po angielsku pod asset (białe tło, cały obiekt, bez tekstu). */
async function promptObrazu(opis) {
    const baza = 'game asset concept art, single object, full body, front three-quarter view, centered, isolated on plain white background, no ground shadow, no text, clean silhouette, studio lighting';
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

/**
 * Zlecenie. `zrodlo`: { tekst } albo { zdjecie: <ścieżka pliku> }. Opcje: sciany (domyślnie 20000),
 * rozdzielczosc (1024|1152|…|2048 — wokselowa, więcej = dokładniej i wolniej), ziarno.
 */
export async function generuj({ nazwa, opis, tekst, zdjecie, projekt = null, sciany = 8000, rozdzielczosc = 512, ziarno = null } = {}) {
    if (!tekst && !zdjecie) throw new Error('Podaj opis albo zdjęcie.');
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
    const m = { id: assetId, nazwa: baza, opis: String(opis || tekst || nazwa || '').slice(0, 500), zrodlo: tekst ? 'tekst' : 'zdjecie', tekst: tekst ? String(tekst).slice(0, 1000) : null, sciany: Number(sciany) || 8000, rozdzielczosc: Number(rozdzielczosc) || 512, utworzono: z.od, stan: 'trwa', silnik: 'TRELLIS.2', czasy: {}, wGrach: [] };
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
                const g = JSON.parse(await fs.readFile(path.join(cfg.katalogWorkflow, GRAF_OBRAZ), 'utf8')); delete g._opis;
                g['5'].inputs.text = prompt;
                g['7'].inputs.width = 1024; g['7'].inputs.height = 1024; g['8'].inputs.width = 1024; g['8'].inputs.height = 1024;
                g['11'].inputs.noise_seed = Number.isFinite(Number(ziarno)) ? Number(ziarno) : Math.floor(Math.random() * 1e9);
                g['14'].inputs.filename_prefix = `katedra/assety/${assetId}_obraz`;
                const t1 = Date.now();
                const w = await czekajNaComfy(await zlecGraf(g), { limitMs: 15 * 60_000, naPostep: (s) => { z.sekundyEtapu = s; } });
                const zrodlo = plikZOutputs(w.outputs, ['images']);
                if (!zrodlo) throw new Error('FLUX nie oddał obrazu.');
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
            const t3 = Date.now();
            m.siatka = await Siatka3D.przygotujPodGre(path.join(dir, 'master.glb'), path.join(dir, 'model.glb'), m.sciany);
            m.czasy.uproszczenie = Math.round((Date.now() - t3) / 1000);
            m.rozmiarGlb = (await fs.stat(path.join(dir, 'model.glb'))).size;
            krok('siatka', `siatka: ${m.siatka.przed.trojkaty} → ${m.siatka.trojkaty} trójkątów (${(m.rozmiarGlb / 1e6).toFixed(2)} MB)`);
            m.stan = 'gotowe'; m.czasy.razem = Math.round((Date.now() - t0) / 1000);
            await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(m, null, 2), 'utf8');
            krok('gotowe', `GLB ${(m.rozmiarGlb / 1e6).toFixed(1)} MB w ${m.czasy.razem} s (3D: ${m.czasy['3d']} s)`);
            z.stan = 'gotowe';
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

export default { skonfiguruj, stan, lista, meta, sciezkaPliku, usun, uprosc, doGry, assetyProjektu, generuj, zadanie, zadaniaLista };
