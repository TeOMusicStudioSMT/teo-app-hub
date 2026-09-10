/**
 * 🎨 SILNIKI OBRAZU — czym rysujemy KADR.
 *
 * PO CO OSOBNO OD SILNIKÓW WIDEO. Etap KADR daje nieruchomą klatkę, RUCH ją
 * ożywia. Do dziś oba liczył Wan 2.2 — silnik WIDEO, dla którego pojedynczy
 * obraz jest produktem ubocznym (jedna klatka z czterdziestu dziewięciu).
 * Do rysowania są silniki obrazu i one rysują lepiej oraz taniej.
 *
 * ⚠️ REJESTR JEST OTWARTY. Suweren: „daj możliwość, by na przyszłość można
 * wybrać model i dodać nowy". Wbudowane siedzą w kodzie, własne w pliku
 * `_OtakOs_Wymiar/silniki-obrazu.json`. Dodanie modelu NIE WYMAGA zmiany kodu —
 * wymaga pliku grafu i powiedzenia, który węzeł jest którym.
 *
 * ⚠️ CZEGO TU NIE MA I DLACZEGO. Nie ma automatycznego wykrywania „co to za
 * model" po nazwie pliku. Raz już nas to kosztowało: przy `diffusion_models: .`
 * most wybrał LoRA jako UNET, bo nazwa pasowała do wzorca. Silnik ma jawnie
 * powiedzieć, czego szuka — i jawnie odmówić, gdy tego nie ma.
 */

import fs from 'fs/promises';
import path from 'path';

const PLIK = 'silniki-obrazu.json';

/**
 * Silniki wbudowane.
 *
 * `wezly` to NUMERY z pliku grafu. Dzięki temu podmiana wartości nie zgaduje
 * po nazwach klas — a dodanie kolejnego silnika to jeden wpis, nie przeróbka
 * funkcji generującej.
 */
export const WBUDOWANE = [
    {
        id: 'flux2-klein-4b',
        nazwa: 'FLUX.2 [klein] 4B',
        opis: 'Silnik OBRAZU, wariant distilled — 4 kroki zamiast 20. '
            + 'Licencja Apache 2.0, komercyjnie wolno. Model 3,79 GB + enkoder 3,58 GB + VAE 0,31 GB.',
        graf: 'flux2_klein_4b.json',
        // ⚠️ Ile kroków NAPRAWDĘ. Distilled policzy i przy 20, ale to strata
        // czasu bez zysku — model jest destylowany właśnie po to.
        kroki: 4,
        wezly: { model: '1', enkoder: '2', vae: '3', prompt: '5', wymiary: '7', harmonogram: '8', ziarno: '11', zapis: '14' },
        pliki: {
            model: { wzor: /flux.?2.?klein.*4b.*fp8/i, gdzie: 'diffusion_models', czego: 'flux-2-klein-4b-fp8.safetensors' },
            enkoder: { wzor: /qwen.?3.?4b.*flux2|qwen_3_4b/i, gdzie: 'text_encoders', czego: 'qwen_3_4b_fp4_flux2.safetensors' },
            vae: { wzor: /flux2.?vae/i, gdzie: 'vae', czego: 'flux2-vae.safetensors' },
        },
        // Węzły, bez których ten graf nie ruszy. Sprawdzamy je ZANIM zlecimy.
        wymaganeWezly: ['EmptyFlux2LatentImage', 'Flux2Scheduler', 'SamplerCustomAdvanced', 'BasicGuider'],
    },
    {
        id: 'wan22-klatka',
        nazwa: 'Wan 2.2 — jedna klatka',
        opis: 'To, czym kadry powstawały do tej pory: silnik wideo liczący jedną klatkę '
            + '(`length: 1`). Zmierzone ~25 s przy 704×480. Zostaje jako droga odwrotu.',
        graf: 'wan22_ti2v_5b.json',
        kroki: 20,
        // ⚠️ Ten silnik obsługuje osobna ścieżka w Wideo.js (generujKadrObraz),
        // bo wymaga podmiany końcówki grafu z wideo na obraz. Wpis istnieje,
        // żeby panel pokazywał WYBÓR, a nie jeden model i pustkę obok.
        wlasnaSciezka: true,
        wezly: { model: '1', enkoder: '2', vae: '3', prompt: '5', wymiary: '7', sampler: '8' },
        pliki: {
            model: { wzor: /wan2\.2.*ti2v|wan22.*ti2v/i, gdzie: 'diffusion_models', czego: 'wan2.2_ti2v_5B_fp16.safetensors' },
            enkoder: { wzor: /umt5/i, gdzie: 'text_encoders', czego: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors' },
            vae: { wzor: /wan.*vae|wan2\.2_vae/i, gdzie: 'vae', czego: 'wan2.2_vae.safetensors' },
        },
        wymaganeWezly: ['Wan22ImageToVideoLatent', 'KSampler'],
    },
];

async function odczytajWlasne(katalog) {
    try {
        const j = JSON.parse(await fs.readFile(path.join(katalog, PLIK), 'utf8'));
        return Array.isArray(j) ? j : (j.silniki ?? []);
    } catch {
        return [];
    }
}

/** Zapis atomowy: tmp → rename. Przerwany zapis nie zostawia połowy pliku. */
async function zapiszWlasne(katalog, dane) {
    await fs.mkdir(katalog, { recursive: true });
    const cel = path.join(katalog, PLIK);
    const tmp = `${cel}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tmp, cel);
}

/**
 * Wszystkie silniki: wbudowane + własne.
 *
 * ⚠️ Wbudowanych NIE zapisujemy do pliku — poprawka w kodzie nigdy nie
 * dotarłaby do Katedry, w której raz je zapisano. Ta sama zasada co przy
 * Reżyserach.
 */
export async function lista(katalog) {
    const wlasne = await odczytajWlasne(katalog);
    return [
        ...WBUDOWANE.map((s) => ({ ...s, wbudowany: true })),
        ...wlasne.map((s) => ({ ...s, wbudowany: false })),
    ];
}

export async function jeden(katalog, id) {
    return (await lista(katalog)).find((s) => s.id === id) ?? null;
}

/**
 * Dodaj albo popraw własny silnik.
 *
 * ⚠️ ODRZUCAMY WPIS, KTÓREGO NIE DA SIĘ UŻYĆ. Silnik bez grafu albo bez
 * odwzorowania węzłów wygląda w panelu jak działający i wywraca się dopiero
 * pięć minut po kliknięciu „renderuj". Lepiej odmówić przy zapisie.
 */
export async function zapisz(katalog, dane = {}) {
    const nazwa = String(dane.nazwa || '').trim();
    if (nazwa.length < 2) throw new Error('Silnik potrzebuje nazwy (min. 2 znaki).');

    const graf = String(dane.graf || '').trim();
    if (!/\.json$/i.test(graf)) throw new Error('Podaj plik grafu (.json) z katalogu _OtakOs_AI/workflows.');

    const w = dane.wezly ?? {};
    for (const pole of ['model', 'enkoder', 'vae', 'prompt', 'wymiary']) {
        if (!String(w[pole] ?? '').trim()) {
            throw new Error(`Brakuje numeru węzła „${pole}" — bez niego nie wiem, gdzie podstawić wartość.`);
        }
    }

    const p = dane.pliki ?? {};
    for (const pole of ['model', 'enkoder', 'vae']) {
        if (!String(p[pole]?.czego ?? '').trim()) {
            throw new Error(`Nie wiem, jakiego pliku szukać dla „${pole}". Podaj nazwę pliku wag.`);
        }
    }

    const wlasne = await odczytajWlasne(katalog);
    const teraz = new Date().toISOString();
    const istniejacy = dane.id ? wlasne.find((s) => s.id === dane.id) : null;

    const wpis = {
        ...(istniejacy ?? { utworzono: teraz }),
        id: istniejacy?.id ?? `obraz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        nazwa,
        opis: String(dane.opis ?? '').trim(),
        graf,
        kroki: Math.max(1, Number(dane.kroki) || 20),
        wezly: {
            model: String(w.model).trim(),
            enkoder: String(w.enkoder).trim(),
            vae: String(w.vae).trim(),
            prompt: String(w.prompt).trim(),
            wymiary: String(w.wymiary).trim(),
            ...(w.harmonogram ? { harmonogram: String(w.harmonogram).trim() } : {}),
            ...(w.ziarno ? { ziarno: String(w.ziarno).trim() } : {}),
            ...(w.sampler ? { sampler: String(w.sampler).trim() } : {}),
            ...(w.zapis ? { zapis: String(w.zapis).trim() } : {}),
        },
        pliki: {
            model: { czego: String(p.model.czego).trim(), gdzie: String(p.model.gdzie ?? 'diffusion_models').trim() },
            enkoder: { czego: String(p.enkoder.czego).trim(), gdzie: String(p.enkoder.gdzie ?? 'text_encoders').trim() },
            vae: { czego: String(p.vae.czego).trim(), gdzie: String(p.vae.gdzie ?? 'vae').trim() },
        },
        wymaganeWezly: (dane.wymaganeWezly ?? []).map((s) => String(s).trim()).filter(Boolean),
        zmieniono: teraz,
    };

    if (istniejacy) Object.assign(istniejacy, wpis);
    else wlasne.push(wpis);
    await zapiszWlasne(katalog, wlasne);
    return wpis;
}

export async function usun(katalog, id) {
    if (WBUDOWANE.some((s) => s.id === id)) {
        throw new Error('To silnik wbudowany — nie da się go usunąć.');
    }
    const wlasne = await odczytajWlasne(katalog);
    const i = wlasne.findIndex((s) => s.id === id);
    if (i < 0) throw new Error('Nie ma takiego silnika.');
    const [usuniety] = wlasne.splice(i, 1);
    await zapiszWlasne(katalog, wlasne);
    return usuniety;
}

/**
 * Czy silnik ma czym liczyć — sprawdzane W COMFYUI, nie na dysku.
 *
 * ⚠️ Pytamy ComfyUI, bo to ON decyduje, co widzi: katalogi wag są mapowane
 * przez `extra_model_paths.yaml` i plik leżący na dysku wcale nie musi być
 * dla niego widoczny. Sprawdzanie `fs.existsSync` dałoby fałszywe „gotowe".
 */
export async function stan({ silnik, comfyBase, pobierz }) {
    const braki = [];
    const znalezione = {};

    const listaPola = async (nod, pole) => {
        try {
            const r = await pobierz(`${comfyBase}/object_info/${nod}`, {}, 10000);
            if (!r.ok) return null;
            const d = await r.json();
            const wej = d?.[nod]?.input?.required ?? {};
            const v = wej[pole]?.[0];
            return Array.isArray(v) ? v : null;
        } catch {
            return null;
        }
    };

    // Węzły grafu muszą istnieć w TEJ wersji ComfyUI.
    for (const nod of silnik.wymaganeWezly ?? []) {
        try {
            const r = await pobierz(`${comfyBase}/object_info/${nod}`, {}, 10000);
            const d = r.ok ? await r.json() : null;
            if (!d || !d[nod]) braki.push(`ComfyUI nie zna węzła „${nod}" — potrzebna nowsza wersja albo cudzy pakiet.`);
        } catch {
            braki.push(`Nie umiem zapytać ComfyUI o węzeł „${nod}".`);
        }
    }

    const gdzie = { model: ['UNETLoader', 'unet_name'], enkoder: ['CLIPLoader', 'clip_name'], vae: ['VAELoader', 'vae_name'] };
    for (const [pole, [nod, wejscie]] of Object.entries(gdzie)) {
        const opis = silnik.pliki?.[pole];
        if (!opis) continue;
        const widoczne = await listaPola(nod, wejscie);
        if (!widoczne) { braki.push(`ComfyUI nie odpowiada na pytanie o ${nod}.`); continue; }

        const wzor = opis.wzor instanceof RegExp
            ? opis.wzor
            : new RegExp(String(opis.czego).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const trafione = widoczne.find((n) => wzor.test(n));
        if (trafione) znalezione[pole] = trafione;
        else braki.push(`Brak pliku „${opis.czego}" w ${opis.gdzie} — ComfyUI go nie widzi.`);
    }

    return { gotowy: braki.length === 0, braki, znalezione };
}

export default { WBUDOWANE, lista, jeden, zapisz, usun, stan };
