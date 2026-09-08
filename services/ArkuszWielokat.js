/**
 * 🧭 ArkuszWielokat — jedna klatka odniesienia → arkusz widoków z wielu kątów.
 *
 * PO CO. Suweren pokazał Director Studio: wgrywasz JEDNO zdjęcie pokoju, a
 * dostajesz siedem ujęć tego samego wnętrza z różnych stron kamery. To samo dla
 * aktora: jedna twarz + garderoba → arkusz sylwetek. Dzięki temu kolejne kadry
 * pokazują TĘ SAMĄ postać w TYM SAMYM wnętrzu, zamiast siedmiu podobnych.
 *
 * SKĄD TO WIEM. Z workflow `QwenEdit2511_MultiAngle_SceneRef.api.json` w repo
 * ai2764/Director-Studio (sklonowane i przeczytane, nie zgadywane): Qwen Image
 * Edit 2511 + LoRA „multiple-angles" + LoRA Lightning 4 kroki, KSampler euler/
 * simple, cfg 1, płyta skalowana do 1728×960.
 *
 * ⚠️ CO ZMIENIŁEM ŚWIADOMIE. Tamten graf liczy siedem kątów jedną listą
 * promptów (węzły `CR Prompt List` i `StringConstantMultiline` z Comfyroll).
 * Tutaj każdy kąt to OSOBNE zlecenie z promptem wpisanym wprost:
 *   · znikają dwie zależności od cudzych węzłów — zostają same węzły rdzenia,
 *   · na 6 GB VRAM siedem obrazów naraz to OOM i siedem straconych ujęć
 *     zamiast trzech gotowych,
 *   · przerwane liczenie zostawia to, co już policzone.
 *
 * ⚠️ TEN MODUŁ MOŻE NIE MIEĆ CZYM LICZYĆ i mówi to wprost. Qwen Image Edit 2511
 * to ~20 GB wag plus ~8,5 GB enkodera tekstu; RTX 3060 Laptop ma 6 GB VRAM.
 * `stanSilnika()` wypisuje co do pliku, czego brakuje — zamiast udawać, że
 * arkusz się liczy.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Siedem kątów sceny — 1:1 z workflow Director Studio, razem z ich konwencją
 * nazw plików (`<nazwa>_01_left_side_view_h270_v0.png`), żeby arkusze z obu
 * narzędzi dało się trzymać w jednym katalogu.
 */
export const KATY_SCENY = [
    { nr: 1, klucz: 'left_side_view_h270_v0', prompt: 'left side view, eye level, medium shot (horizontal: 270, vertical: 0, zoom: 5.0)' },
    { nr: 2, klucz: 'back_view_h180_v0', prompt: "back view, eye level, medium shot (horizontal: 180, vertical: 0, zoom: 5.0)" },
    { nr: 3, klucz: 'right_side_view_h90_v0', prompt: 'right side view, eye level, medium shot (horizontal: 90, vertical: 0, zoom: 5.0)' },
    { nr: 4, klucz: 'front_left_view_h315_v0', prompt: 'front-left view, eye level, medium shot (horizontal: 315, vertical: 0, zoom: 5.0)' },
    { nr: 5, klucz: 'front_right_view_h45_v0', prompt: 'front-right view, eye level, medium shot (horizontal: 45, vertical: 0, zoom: 5.0)' },
    { nr: 6, klucz: 'front_view_birds_eye_h0_v45', prompt: "front view, bird's eye view, medium shot (horizontal: 0, vertical: 45, zoom: 5.0)" },
    { nr: 7, klucz: 'front_view_low_angle_h0_vm30', prompt: 'front view, low angle, medium shot (horizontal: 0, vertical: -30, zoom: 5.0)' },
];

/**
 * Sześć widoków aktora — arkusz tożsamości.
 *
 * ⚠️ CAŁA SYLWETKA, nie portret. Kadr potrzebuje wiedzieć, jak postać wygląda
 * w ruchu i w ubraniu; sześć zbliżeń twarzy nie powie nic o garderobie.
 */
export const KATY_AKTORA = [
    { nr: 1, klucz: 'front_view_h0', prompt: 'front view, full body, eye level, neutral standing pose (horizontal: 0, vertical: 0)' },
    { nr: 2, klucz: 'front_left_view_h315', prompt: 'front-left three-quarter view, full body, eye level (horizontal: 315, vertical: 0)' },
    { nr: 3, klucz: 'left_side_view_h270', prompt: 'left side view, full body, eye level (horizontal: 270, vertical: 0)' },
    { nr: 4, klucz: 'back_view_h180', prompt: 'back view, full body, eye level (horizontal: 180, vertical: 0)' },
    { nr: 5, klucz: 'right_side_view_h90', prompt: 'right side view, full body, eye level (horizontal: 90, vertical: 0)' },
    { nr: 6, klucz: 'front_right_view_h45', prompt: 'front-right three-quarter view, full body, eye level (horizontal: 45, vertical: 0)' },
];

/** Zdanie doklejane przed każdym kątem — pilnuje, żeby zmieniła się KAMERA, nie świat. */
export const KOTWICA_SCENY =
    'Keep the same location, architecture, materials, furniture layout, lighting, and time of day. '
    + 'Only change the camera. Do not redesign the set.';

export const KOTWICA_AKTORA =
    'Keep the same person: same face, hairstyle, body proportions, wardrobe and colors. '
    + 'Plain neutral studio background. Only change the camera angle. Do not restyle the character.';

export function katy(typ) {
    return typ === 'aktor' ? KATY_AKTORA : KATY_SCENY;
}

export function kotwica(typ) {
    return typ === 'aktor' ? KOTWICA_AKTORA : KOTWICA_SCENY;
}

// ══════════════════════════════════════════════════════════════════════════════
//  CZY JEST CZYM LICZYĆ
// ══════════════════════════════════════════════════════════════════════════════

/** Wzorce plików. Dopuszczamy GGUF, bo na 6 GB VRAM to jedyna rozsądna droga. */
const POTRZEBNE = {
    // ⚠️ `nieWzor` NIE JEST OZDOBĄ. Gdy `extra_model_paths.yaml` mapuje
    // `diffusion_models: .`, ComfyUI wystawia CAŁĄ zawartość katalogu jako
    // kandydatów na model — razem z podkatalogiem `loras/`. Bez tego wykluczenia
    // most wybierał `loras\Qwen-Image-Edit-2511-Lightning-4steps.safetensors`
    // jako UNET, bo nazwa pasowała. LoRA załadowana jako model to wywrotka
    // w środku liczenia, a nie „prawie dobrze".
    unet: {
        wzor: /qwen.*image.*edit.*2511/i,
        nieWzor: /(^|[\\/])(loras|text_encoders|clip|vae)[\\/]|lora|lightning/i,
        czym: 'model Qwen Image Edit 2511',
        przyklad: 'qwen_image_edit_2511_fp8mixed.safetensors',
    },
    loraKaty: { wzor: /multiple.?angles/i, czym: 'LoRA wielu kątów', przyklad: 'qwen-image-edit-2511-multiple-angles-lora.safetensors' },
    clip: { wzor: /qwen.*2\.5.*vl.*7b/i, czym: 'enkoder tekstu Qwen2.5-VL 7B', przyklad: 'qwen_2.5_vl_7b_fp8_scaled.safetensors' },
    vae: { wzor: /qwen.*image.*vae/i, czym: 'VAE Qwen Image', przyklad: 'qwen_image_vae.safetensors' },
};

/** LoRA opcjonalna: bez niej liczymy 20 kroków zamiast 4 (czyli pięć razy dłużej). */
const LORA_SZYBKA = { wzor: /lightning.*4steps/i, czym: 'LoRA Lightning 4 kroki' };

async function listaPola(base, nod, pole) {
    try {
        const r = await fetch(`${base}/object_info/${nod}`);
        if (!r.ok) return null;
        const d = await r.json();
        const wej = d?.[nod]?.input?.required ?? {};
        const v = wej?.[pole]?.[0];
        return Array.isArray(v) ? v : [];
    } catch { return null; }
}

/**
 * Co jest, czego brak i czy to w ogóle pojedzie na tej maszynie.
 *
 * ⚠️ Osobno mówimy „brakuje wag" i „węzeł nieznany". To dwie różne naprawy:
 * pierwsza to pobranie plików, druga to aktualizacja ComfyUI.
 */
export async function stanSilnika(comfyBase) {
    let zywe = false;
    try { zywe = (await fetch(`${comfyBase}/object_info/UNETLoader`)).ok; } catch { zywe = false; }
    if (!zywe) {
        return { gotowe: false, comfy: false, braki: ['ComfyUI nie odpowiada na :8188 — obudź go (POST /api/comfy/ensure).'], widziane: {} };
    }

    const widziane = {
        unet: (await listaPola(comfyBase, 'UNETLoader', 'unet_name')) ?? [],
        lora: (await listaPola(comfyBase, 'LoraLoaderModelOnly', 'lora_name')) ?? [],
        clip: (await listaPola(comfyBase, 'CLIPLoader', 'clip_name')) ?? [],
        vae: (await listaPola(comfyBase, 'VAELoader', 'vae_name')) ?? [],
    };

    const znalezione = {};
    const braki = [];

    const szukaj = (gdzie, spec, klucz) => {
        const t = (widziane[gdzie] ?? [])
            .find((n) => spec.wzor.test(n) && !(spec.nieWzor && spec.nieWzor.test(n)));
        if (t) { znalezione[klucz] = t; return; }
        braki.push(`Brak: ${spec.czym}${spec.przyklad ? ` (np. ${spec.przyklad})` : ''}.`);
    };

    szukaj('unet', POTRZEBNE.unet, 'unet');
    szukaj('lora', POTRZEBNE.loraKaty, 'loraKaty');
    szukaj('clip', POTRZEBNE.clip, 'clip');
    szukaj('vae', POTRZEBNE.vae, 'vae');

    znalezione.loraSzybka = (widziane.lora ?? []).find((n) => LORA_SZYBKA.wzor.test(n)) ?? null;

    // Węzły rdzenia — bez nich nawet komplet wag nic nie da.
    const wezly = {};
    for (const nod of ['TextEncodeQwenImageEditPlus', 'FluxKontextMultiReferenceLatentMethod', 'ModelSamplingAuraFlow', 'CFGNorm']) {
        let ok = false;
        try { ok = (await fetch(`${comfyBase}/object_info/${nod}`)).ok; } catch { ok = false; }
        wezly[nod] = ok;
        if (!ok) braki.push(`ComfyUI nie zna węzła ${nod} — zaktualizuj ComfyUI.`);
    }

    const gotowe = braki.length === 0;

    // ⚠️ Ostrzeżenie o sprzęcie jest OSOBNE od braków: komplet plików nie znaczy,
    // że policzy się w rozsądnym czasie, a Suweren ma prawo wiedzieć to zawczasu.
    const ostrzezenie = gotowe && !/gguf|q[2-8]_/i.test(znalezione.unet ?? '')
        ? 'Wagi są w komplecie, ale to wersja pełna (~20 GB) na karcie z 6 GB VRAM — '
          + 'ComfyUI będzie zrzucał je do RAM-u i jeden widok potrwa wiele minut. '
          + 'Wersja GGUF (Q4) liczy się tu znacznie szybciej.'
        : null;

    return {
        gotowe, comfy: true, braki, ostrzezenie,
        modele: znalezione, wezly, widziane,
        kroki: znalezione.loraSzybka ? 4 : 20,
    };
}

// ══════════════════════════════════════════════════════════════════════════════
//  GRAF
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Graf jednego widoku.
 *
 * ⚠️ `plyta` to nazwa pliku WIDZIANA PRZEZ COMFYUI (w jego `input/`), a nie
 * ścieżka na dysku Katedry. ComfyUI ładuje obrazy wyłącznie ze swojego katalogu
 * wejściowego — dlatego referencję najpierw tam wstawiamy.
 */
export function graf({
    modele, plyta, prompt, kotwica: kotwicaTekstu = '',
    szerokosc = 1728, wysokosc = 960, kroki = 4, ziarno = null, prefiks = 'katedra/arkusz',
}) {
    if (!modele?.unet || !modele?.clip || !modele?.vae || !modele?.loraKaty) {
        throw new Error('Nie mam kompletu modeli do arkusza — sprawdź stan silnika.');
    }
    const seed = Number.isFinite(ziarno) ? ziarno : Math.floor(Math.random() * 2 ** 31);
    const pelnyPrompt = [kotwicaTekstu, prompt].filter(Boolean).join(' ');

    const g = {
        '41': { class_type: 'LoadImage', inputs: { image: plyta } },
        '107': { class_type: 'ImageScale', inputs: { image: ['41', 0], upscale_method: 'lanczos', width: szerokosc, height: wysokosc, crop: 'center' } },
        '93': { class_type: 'CLIPLoader', inputs: { clip_name: modele.clip, type: 'qwen_image' } },
        '95': { class_type: 'VAELoader', inputs: { vae_name: modele.vae } },
        '108': { class_type: 'UNETLoader', inputs: { unet_name: modele.unet, weight_dtype: 'default' } },
        '109': { class_type: 'LoraLoaderModelOnly', inputs: { model: ['108', 0], lora_name: modele.loraKaty, strength_model: 1 } },
        // ModelSamplingAuraFlow bierze model z LoRA szybkiej, gdy ta jest; inaczej wprost z kątowej.
        '94': { class_type: 'ModelSamplingAuraFlow', inputs: { model: [modele.loraSzybka ? '102' : '109', 0], shift: 3.1 } },
        '98': { class_type: 'CFGNorm', inputs: { model: ['94', 0], strength: 1 } },
        '112': { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['93', 0], vae: ['95', 0], image1: ['107', 0], prompt: pelnyPrompt } },
        '97': { class_type: 'FluxKontextMultiReferenceLatentMethod', inputs: { conditioning: ['112', 0], reference_latents_method: 'index_timestep_zero' } },
        '96': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['97', 0] } },
        '105': { class_type: 'VAEEncode', inputs: { pixels: ['107', 0], vae: ['95', 0] } },
        '106': {
            class_type: 'KSampler',
            inputs: {
                model: ['98', 0], positive: ['97', 0], negative: ['96', 0], latent_image: ['105', 0],
                seed, steps: kroki, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1,
            },
        },
        '103': { class_type: 'VAEDecode', inputs: { samples: ['106', 0], vae: ['95', 0] } },
        '9': { class_type: 'SaveImage', inputs: { images: ['103', 0], filename_prefix: prefiks } },
    };

    if (modele.loraSzybka) {
        g['102'] = { class_type: 'LoraLoaderModelOnly', inputs: { model: ['109', 0], lora_name: modele.loraSzybka, strength_model: 1 } };
    }
    return { graf: g, seed, prompt: pelnyPrompt };
}

/**
 * Wstaw referencję do katalogu wejściowego ComfyUI i oddaj nazwę, którą on widzi.
 * ⚠️ Kopiujemy, nie przenosimy — plik w projekcie Katedry musi zostać na miejscu.
 */
export async function wstawPlyte(comfyDir, sciezkaZrodla, nazwaDocelowa = '') {
    const wejscie = path.join(comfyDir, 'ComfyUI', 'input');
    await fs.mkdir(wejscie, { recursive: true });
    const nazwa = (nazwaDocelowa || `katedra_${Date.now().toString(36)}${path.extname(sciezkaZrodla) || '.png'}`)
        .replace(/[^a-zA-Z0-9._-]/g, '_');
    await fs.copyFile(sciezkaZrodla, path.join(wejscie, nazwa));
    return nazwa;
}

export default {
    KATY_SCENY, KATY_AKTORA, KOTWICA_SCENY, KOTWICA_AKTORA,
    katy, kotwica, stanSilnika, graf, wstawPlyte,
};
