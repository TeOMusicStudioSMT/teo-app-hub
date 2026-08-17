/**
 * 🧠 MUZYKA — KATALOG MODELI (MiniMax-Music-3)
 *
 * Wagi modeli muzycznych żyją SUWERENNIE w katalogu TeO_Music_V2/models/, nie w repo
 * (16+ GB). Ten serwis: skanuje katalog, mówi czego brakuje, i realnie ściąga pliki
 * z HuggingFace z wznawianiem (Range) — żeby zerwane 9-gigabajtowe pobieranie nie
 * zaczynało od zera na łączu, które potrafi mrugnąć.
 *
 * Layout katalogu jest 1:1 z repo Comfy-Org/MiniMax-Music-3, a to z układem
 * ComfyUI/models/ — dzięki temu ComfyUI widzi ten katalog przez extra_model_paths.yaml
 * i nie trzeba trzymać wag w dwóch miejscach na dysku.
 *
 * Manifest jest bliźniakiem src/services/musicModelCatalog.ts w TeO_Music_V2.
 * Rozmiary zweryfikowane przez HuggingFace API — nie zgadywane.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const REPO = 'Comfy-Org/MiniMax-Music-3';

/**
 * Katalog wag. Domyślnie obok mostu: <cwd>/../TeO_Music_V2/models
 * Podmiana bez ruszania kodu: OTAKOS_MUSIC_MODELS.
 */
export const KATALOG_MODELI = process.env.OTAKOS_MUSIC_MODELS
    || path.resolve(process.cwd(), '..', 'TeO_Music_V2', 'models');

export const MANIFEST = [
    { id: 'dit-int8',                 path: 'diffusion_models/minimax_music3_dit_int8_convrot.safetensors',            role: 'diffusion_models', precision: 'int8', bytes: 2_502_161_682,  label: 'DiT int8 (convrot)',        fitsVram6gb: true  },
    { id: 'dit-fp16',                 path: 'diffusion_models/minimax_music3_dit_fp16.safetensors',                    role: 'diffusion_models', precision: 'fp16', bytes: 4_914_197_682,  label: 'DiT fp16',                  fitsVram6gb: false },
    { id: 'dit-fp32',                 path: 'diffusion_models/minimax_music3_dit_fp32.safetensors',                    role: 'diffusion_models', precision: 'fp32', bytes: 9_828_345_396,  label: 'DiT fp32 (Studio Master)',  fitsVram6gb: false },
    { id: 'text-encoder-pruned-int8', path: 'text_encoders/minimax_music3_text_encoder_pruned_int8_convrot.safetensors', role: 'text_encoders',   precision: 'int8', bytes: 9_196_611_886,  label: 'Text Encoder pruned int8',  fitsVram6gb: true  },
    { id: 'text-encoder-pruned-bf16', path: 'text_encoders/minimax_music3_text_encoder_pruned_bf16.safetensors',        role: 'text_encoders',   precision: 'bf16', bytes: 16_706_629_398, label: 'Text Encoder pruned bf16',  fitsVram6gb: false },
    { id: 'text-encoder-bf16',        path: 'text_encoders/minimax_music3_text_encoder_bf16.safetensors',               role: 'text_encoders',   precision: 'bf16', bytes: 18_472_478_038, label: 'Text Encoder bf16 (pełny)', fitsVram6gb: false },
    { id: 'dav',                      path: 'vae/minimax_music3_dav.safetensors',                                       role: 'vae',             precision: 'fp32', bytes: 216_696_128,    label: 'DAV (dekoder audio)',       fitsVram6gb: true  },
];

const ROLE = ['diffusion_models', 'text_encoders', 'vae'];

export function modelPoId(id) {
    return MANIFEST.find((m) => m.id === id);
}

function urlHf(m) {
    return `https://huggingface.co/${REPO}/resolve/main/${m.path}`;
}

/** Bezpieczne złożenie ścieżki — manifest jest nasz, ale nie ufamy wejściu z sieci. */
function sciezkaNaDysku(m) {
    const pelna = path.resolve(KATALOG_MODELI, m.path);
    if (!pelna.startsWith(path.resolve(KATALOG_MODELI))) {
        throw new Error(`Ścieżka ucieka z katalogu modeli: ${m.path}`);
    }
    return pelna;
}

// ── STAN POBIERAŃ (w pamięci — most i tak żyje cały czas) ────────────────────
/** id → { id, label, pobrano, cel, procent, stan, blad, startedAt, predkoscBps } */
const pobierania = new Map();

/**
 * Skan katalogu: co jest, co niekompletne, czego brak.
 * Kompletność = rozmiar na dysku zgadza się z manifestem co do bajta.
 */
export async function status() {
    const pliki = [];
    for (const m of MANIFEST) {
        const pelna = sciezkaNaDysku(m);
        let naDysku = 0;
        let obecny = false;
        try {
            const st = await fs.stat(pelna);
            naDysku = st.size;
            obecny = true;
        } catch { /* nie ma pliku — normalne */ }

        // Niedokończone pobieranie leży jako .part
        let czesciowo = 0;
        if (!obecny) {
            try { czesciowo = (await fs.stat(`${pelna}.part`)).size; } catch { /* brak */ }
        }

        const kompletny = obecny && naDysku === m.bytes;
        pliki.push({
            ...m,
            obecny,
            kompletny,
            naDysku,
            czesciowo,
            // Uszkodzony = jest, ale rozmiar się nie zgadza. Ładowanie takiego = crash.
            uszkodzony: obecny && !kompletny,
            procent: Math.min(100, Math.round(((naDysku || czesciowo) / m.bytes) * 100)),
            pobieranie: pobierania.get(m.id) ?? null,
        });
    }

    const gotowe = pliki.filter((p) => p.kompletny);
    const roleGotowe = new Set(gotowe.map((p) => p.role));
    const brakujaceRole = ROLE.filter((r) => !roleGotowe.has(r));

    return {
        success: true,
        katalog: KATALOG_MODELI,
        repo: REPO,
        pliki,
        // Pipeline ruszy tylko gdy jest po jednym z KAŻDEJ roli.
        pipelineGotowy: brakujaceRole.length === 0,
        brakujaceRole,
        bajtyNaDysku: gotowe.reduce((s, p) => s + p.naDysku, 0),
        aktywnePobierania: [...pobierania.values()].filter((p) => p.stan === 'pobieranie').length,
    };
}

/**
 * Realne pobranie jednego pliku z wznawianiem. Leci w tle — front odpytuje status().
 * Zapis do .part, rename dopiero po weryfikacji rozmiaru: przerwane pobieranie nigdy
 * nie udaje kompletnego modelu.
 */
async function pobierzPlik(m) {
    const cel = sciezkaNaDysku(m);
    const tmp = `${cel}.part`;
    await fs.mkdir(path.dirname(cel), { recursive: true });

    // Już kompletny? Nie marnujmy łącza.
    try {
        const st = await fs.stat(cel);
        if (st.size === m.bytes) {
            pobierania.set(m.id, { id: m.id, label: m.label, pobrano: m.bytes, cel: m.bytes, procent: 100, stan: 'gotowe', blad: null });
            return;
        }
        // Rozmiar się nie zgadza — plik jest śmieciem, kasujemy i ciągniemy od nowa.
        await fs.rm(cel, { force: true });
    } catch { /* nie ma — dobrze */ }

    // Wznawianie: ile już mamy w .part
    let od = 0;
    try { od = (await fs.stat(tmp)).size; } catch { /* brak */ }
    if (od > m.bytes) { await fs.rm(tmp, { force: true }); od = 0; }
    if (od === m.bytes) {
        await fs.rename(tmp, cel);
        pobierania.set(m.id, { id: m.id, label: m.label, pobrano: m.bytes, cel: m.bytes, procent: 100, stan: 'gotowe', blad: null });
        return;
    }

    const start = Date.now();
    const stan = {
        id: m.id, label: m.label, pobrano: od, cel: m.bytes,
        procent: Math.round((od / m.bytes) * 100),
        stan: 'pobieranie', blad: null, startedAt: start, predkoscBps: 0,
        wznowione: od > 0,
    };
    pobierania.set(m.id, stan);
    console.log(`[Modele-Muzyka] ⬇️ ${m.label} — start${od > 0 ? ` (wznawiam od ${(od / 1e9).toFixed(2)} GB)` : ''}`);

    try {
        const naglowki = od > 0 ? { Range: `bytes=${od}-` } : {};
        const r = await fetch(urlHf(m), { headers: naglowki, redirect: 'follow' });

        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        // Serwer zignorował Range i wysyła całość — zaczynamy plik od zera, inaczej
        // doklejilibyśmy początek pliku do środka i dostali cichą korupcję.
        if (od > 0 && r.status !== 206) {
            console.warn(`[Modele-Muzyka] ⚠️ ${m.label}: brak wsparcia Range (HTTP ${r.status}) — od zera.`);
            await fs.rm(tmp, { force: true });
            od = 0;
            stan.pobrano = 0;
            stan.wznowione = false;
        }
        if (!r.body) throw new Error('Pusta odpowiedź HuggingFace (brak body).');

        const ws = fsSync.createWriteStream(tmp, { flags: od > 0 ? 'a' : 'w' });
        let ostatniLog = Date.now();

        // Przepuszczamy strumień przez pipeline i liczymy postęp po drodze.
        const zrodlo = Readable.fromWeb(r.body);
        zrodlo.on('data', (chunk) => {
            stan.pobrano += chunk.length;
            stan.procent = Math.min(99, Math.round((stan.pobrano / m.bytes) * 100));
            const dt = (Date.now() - start) / 1000;
            stan.predkoscBps = dt > 0 ? Math.round((stan.pobrano - od) / dt) : 0;
            if (Date.now() - ostatniLog > 15000) {
                ostatniLog = Date.now();
                console.log(`[Modele-Muzyka] ${m.label}: ${stan.procent}% (${(stan.predkoscBps / 1e6).toFixed(1)} MB/s)`);
            }
        });
        await pipeline(zrodlo, ws);

        // Weryfikacja: rozmiar musi się zgadzać, inaczej to nie jest model.
        const st = await fs.stat(tmp);
        if (st.size !== m.bytes) {
            throw new Error(`Rozmiar nie zgadza się po pobraniu: ${st.size} ≠ ${m.bytes} (plik zostaje jako .part do wznowienia)`);
        }
        await fs.rename(tmp, cel);

        stan.pobrano = m.bytes;
        stan.procent = 100;
        stan.stan = 'gotowe';
        console.log(`[Modele-Muzyka] ✅ ${m.label} — pobrany i zweryfikowany (${(m.bytes / 1e9).toFixed(2)} GB)`);
    } catch (err) {
        stan.stan = 'blad';
        stan.blad = err.message;
        console.warn(`[Modele-Muzyka] ❌ ${m.label}: ${err.message}`);
    }
}

/**
 * Kolejkuje pobieranie wskazanych modeli. Szeregowo — dwa równoległe 9-gigabajtowe
 * strumienie na jednym łączu tylko się nawzajem duszą.
 */
export function pull(ids) {
    const wybrane = ids.map(modelPoId).filter(Boolean);
    if (!wybrane.length) return { success: false, message: 'Żaden z podanych id nie istnieje w manifeście.' };

    for (const m of wybrane) {
        if (pobierania.get(m.id)?.stan === 'pobieranie') continue;
        pobierania.set(m.id, { id: m.id, label: m.label, pobrano: 0, cel: m.bytes, procent: 0, stan: 'w-kolejce', blad: null });
    }

    // Fire-and-forget: front odpytuje /api/music/models
    (async () => {
        for (const m of wybrane) {
            if (pobierania.get(m.id)?.stan === 'gotowe') continue;
            await pobierzPlik(m);
        }
    })();

    const razem = wybrane.reduce((s, m) => s + m.bytes, 0);
    return {
        success: true,
        started: wybrane.map((m) => m.id),
        bytes: razem,
        message: `Kolejkuję ${wybrane.length} plik(ów), razem ${(razem / 1e9).toFixed(2)} GB. Pobieranie leci w tle i wznawia się po zerwaniu.`,
    };
}

/** Przerywa śledzenie (sam strumień dobiegnie — .part zostaje do wznowienia). */
export function zapomnij(id) {
    pobierania.delete(id);
    return { success: true, id };
}

/** Usuwa wagę z dysku — świadoma decyzja Suwerena, robi miejsce. */
export async function usun(id) {
    const m = modelPoId(id);
    if (!m) return { success: false, message: `Nieznany model: ${id}` };
    const cel = sciezkaNaDysku(m);
    let zwolnione = 0;
    try { zwolnione = (await fs.stat(cel)).size; } catch { /* brak */ }
    await fs.rm(cel, { force: true });
    await fs.rm(`${cel}.part`, { force: true });
    pobierania.delete(id);
    console.log(`[Modele-Muzyka] 🗑️ Usunięto ${m.label} (zwolniono ${(zwolnione / 1e9).toFixed(2)} GB)`);
    return { success: true, id, zwolnione };
}
