/**
 * 🎬 Wideo — prawdziwa generacja scen dla Story V2.
 *
 * ⚠️ CO ZASTĘPUJE. `TeO_Story_V2/src/services/GoogleWorkflowService.ts` był
 * atrapą na wylot: zmienne nazywały się `mockFrameName` i `mockVideoName`,
 * status ustawiał się na SUCCESS bezwarunkowo, a „wygenerowany" plik był
 * NAPISEM zbudowanym z `Date.now()`. Stąd „100% COMPLETED" obok komunikatu
 * „most milczy" — potok nie potrzebował mostu, bo niczego nie robił.
 *
 * ⚠️ DWA SILNIKI, JEDEN SPRZĘT (2026-09-06).
 *
 *   WAN 2.2 TI2V-5B — tor domyślny. Model 10 GB, enkoder umT5 w fp8 (6,7 GB),
 *   VAE 1,4 GB. Mieści się w 6 GB VRAM RTX 3060 Laptop z offloadem i liczy
 *   ujęcie w minutach.
 *
 *   MiniMax H3 — tor archiwalny. Wagi (33 GB) leżą na `E:/Modele AI` i czekają
 *   na lepszą maszynę. Jego enkoder tekstu to Qwen3-VL 32B: 15 GB w najlżejszym
 *   wariancie, czyli 2,5× VRAM tej karty. Zostawiamy go widocznym, ale NIE
 *   wybieramy sami — obietnica sceny, która liczyłaby się godzinami albo padła
 *   na OOM, jest gorsza niż uczciwe „ten model nie na ten sprzęt".
 *
 * ⚠️ SPRAWDZAMY, ZANIM OBIECAMY. Jak długo brakuje enkodera albo VAE, ta trasa
 * ODMAWIA z listą braków — zamiast oddać nazwę pliku, którego nie ma.
 *
 * Grafy w `_OtakOs_AI/workflows/` napisane są z PRAWDZIWYCH schematów nodów
 * (`/object_info`), nie z pamięci.
 */
import fs from 'fs/promises';
import path from 'path';

const KATALOG_WF = () => path.join(process.cwd(), '_OtakOs_AI', 'workflows');

/** Graf dopisywania ujecia od zadanej klatki — patrz `dopiszUjecie`. */
const GRAF_KONTYNUACJI = 'wan22_kontynuacja.json';

/**
 * Opis silnika: czym rozpoznać jego pliki i pod które węzły grafu je podstawić.
 * `wezly` trzyma NUMERY z pliku grafu — dzięki temu podmiana nie zgaduje po
 * nazwach klas, a dodanie trzeciego silnika to jeden wpis w tej tablicy.
 */
const SILNIKI = [
    {
        id: 'wan22',
        nazwa: 'Wan 2.2 TI2V-5B',
        graf: 'wan22_ti2v_5b.json',
        // Na tej karcie to jedyny tor, który realnie policzy scenę.
        naTenSprzet: true,
        model: (n) => /wan2\.2.*ti2v|wan22.*ti2v/i.test(n),
        enkoder: (n) => /umt5/i.test(n),
        vae: (n) => /wan.*vae|wan2\.2_vae/i.test(n),
        wezly: { model: '1', enkoder: '2', vae: '3', prompt: '5', wymiary: '7', sampler: '8' },
        czegoBrak: {
            model: 'Brak modelu Wan 2.2 TI2V-5B (UNETLoader) — plik wan2.2_ti2v_5B_fp16.safetensors.',
            enkoder: 'Brak enkodera umT5 dla Wan (CLIPLoader, type "wan") — umt5_xxl_fp8_e4m3fn_scaled.safetensors.',
            vae: 'Brak VAE Wan 2.2 (VAELoader) — wan2.2_vae.safetensors.',
        },
    },
    {
        id: 'h3',
        nazwa: 'MiniMax H3',
        graf: 'minimax_h3_t2v.json',
        // ⚠️ 6 GB VRAM kontra enkoder 32B. Widoczny, ale nie wybierany sam.
        naTenSprzet: false,
        model: (n) => /h3|minimax/i.test(n) && !/music/i.test(n),
        enkoder: (n) => /h3|qwen3vl/i.test(n) && !/music/i.test(n),
        vae: (n) => /h3/i.test(n) && !/music/i.test(n),
        wezly: { model: '1', enkoder: '2', vae: '3', prompt: '5', wymiary: '5', sampler: '7' },
        czegoBrak: {
            model: 'Brak modelu wideo MiniMax H3 (UNETLoader).',
            enkoder: 'Brak enkodera tekstu dla MiniMax H3 (CLIPLoader, type "minimax") — to Qwen3-VL 32B.',
            vae: 'Brak VAE dla MiniMax H3 (VAELoader).',
        },
    },
];

/** Co ComfyUI naprawdę widzi w danym polu danego noda. */
async function listaPola(base, nod, pole) {
    try {
        const r = await fetch(`${base}/object_info/${nod}`);
        if (!r.ok) return null;
        const d = await r.json();
        const k = Object.keys(d)[0];
        const v = d[k]?.input?.required?.[pole];
        return Array.isArray(v?.[0]) ? v[0] : null;
    } catch { return null; }
}

async function grafIstnieje(nazwa) {
    try { await fs.access(path.join(KATALOG_WF(), nazwa)); return true; } catch { return false; }
}

/** Ocena jednego silnika na tle tego, co ComfyUI ma pod ręką. */
async function ocen(silnik, { modele, enkodery, vae }) {
    const braki = [];
    const m = modele.filter(silnik.model);
    const e = enkodery.filter(silnik.enkoder);
    const v = vae.filter(silnik.vae);
    if (!m.length) braki.push(silnik.czegoBrak.model);
    if (!e.length) braki.push(silnik.czegoBrak.enkoder);
    if (!v.length) braki.push(silnik.czegoBrak.vae);
    if (!await grafIstnieje(silnik.graf)) braki.push(`Brak grafu ${silnik.graf} w _OtakOs_AI/workflows/.`);
    return {
        id: silnik.id, nazwa: silnik.nazwa, naTenSprzet: silnik.naTenSprzet,
        modele: m, enkodery: e, vae: v, braki, gotowy: braki.length === 0,
    };
}

/**
 * Czy da się w ogóle generować. Zwraca listę BRAKÓW, a nie samo „nie" —
 * bez tego Suweren dostawałby „nie wyszło" bez informacji, czego dokupić.
 */
export async function stanWideo(comfyBase) {
    let comfy = false;
    try { comfy = (await fetch(`${comfyBase}/object_info/UNETLoader`)).ok; } catch { comfy = false; }
    if (!comfy) {
        return {
            gotowe: false, comfy: false, silniki: [], silnik: null,
            braki: ['ComfyUI nie odpowiada na :8188 — obudź go (POST /api/comfy/ensure).'],
        };
    }

    const widziane = {
        modele: (await listaPola(comfyBase, 'UNETLoader', 'unet_name')) ?? [],
        enkodery: (await listaPola(comfyBase, 'CLIPLoader', 'clip_name')) ?? [],
        vae: (await listaPola(comfyBase, 'VAELoader', 'vae_name')) ?? [],
    };

    const silniki = [];
    for (const s of SILNIKI) silniki.push(await ocen(s, widziane));

    // Wybieramy TYLKO silnik gotowy I przeznaczony na ten sprzęt.
    const wybrany = silniki.find((s) => s.gotowy && s.naTenSprzet) ?? null;

    // Braki raportujemy z toru, który MA tu liczyć — lista braków H3 tylko
    // myliłaby: on nie policzy tej sceny nawet w komplecie.
    const dlaSprzetu = silniki.find((s) => s.naTenSprzet);
    const braki = wybrany ? [] : (dlaSprzetu?.braki ?? ['Żaden silnik wideo nie jest skonfigurowany.']);

    return {
        gotowe: !!wybrany,
        comfy: true,
        silnik: wybrany,
        silniki,
        wszystkieModele: widziane.modele,
        wszystkieEnkodery: widziane.enkodery,
        wszystkieVae: widziane.vae,
        braki,
    };
}

/**
 * Zleć scenę. Zwraca id zlecenia ComfyUI albo POWÓD odmowy.
 * ⚠️ Nie ma tu ścieżki „udało się mimo braków" — jeśli czegoś nie ma, mówimy to.
 */
export async function generujScene({ comfyBase, prompt, szerokosc, wysokosc, klatek, kroki, ziarno }) {
    if (!prompt?.trim()) return { ok: false, powod: 'Pusty opis sceny — nie ma czego generować.' };

    const stan = await stanWideo(comfyBase);
    if (!stan.gotowe) return { ok: false, powod: stan.braki.join(' | '), braki: stan.braki };

    const opis = SILNIKI.find((s) => s.id === stan.silnik.id);
    const w = opis.wezly;
    const graf = JSON.parse(await fs.readFile(path.join(KATALOG_WF(), opis.graf), 'utf8'));
    delete graf._opis;   // komentarz dla ludzi; ComfyUI odrzuciłby go jako nieznany node

    // Podstawiamy REALNE nazwy z ComfyUI — nie te z pliku, bo plik jest szablonem.
    graf[w.model].inputs.unet_name = stan.silnik.modele[0];
    graf[w.enkoder].inputs.clip_name = stan.silnik.enkodery[0];
    graf[w.vae].inputs.vae_name = stan.silnik.vae[0];
    graf[w.prompt].inputs[graf[w.prompt].inputs.prompt !== undefined ? 'prompt' : 'text'] = prompt;

    graf[w.wymiary].inputs.width = Number(szerokosc) || 704;
    graf[w.wymiary].inputs.height = Number(wysokosc) || 480;
    graf[w.wymiary].inputs.length = Number(klatek) || 49;

    graf[w.sampler].inputs.steps = Number(kroki) || 20;
    graf[w.sampler].inputs.seed = Number.isFinite(Number(ziarno)) ? Number(ziarno) : Math.floor(Math.random() * 1e9);

    try {
        const r = await fetch(`${comfyBase}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: graf }),
        });
        const d = await r.json();
        if (!r.ok || d?.error) {
            return { ok: false, powod: `ComfyUI odrzucił graf: ${JSON.stringify(d?.error ?? d).slice(0, 300)}` };
        }
        return { ok: true, zlecenie: d.prompt_id, model: stan.silnik.modele[0], silnik: stan.silnik.nazwa };
    } catch (e) {
        return { ok: false, powod: `Nie dowiozłem grafu do ComfyUI: ${e.message}` };
    }
}

/**
 * Dopisz ujęcie ZACZYNAJĄCE SIĘ od podanej klatki (moduł Ciąg Dalszy).
 *
 * ⚠️ Format bierzemy Z FILMU ŹRÓDŁOWEGO, nie z domyślnych ustawień: inaczej
 * sklejka miałaby skok rozdzielczości albo tempa w połowie. Wymiary muszą być
 * podzielne przez 16 — VAE Wana pracuje na blokach i przy 703 px pada zamiast
 * zaokrąglić, więc przycinamy w dół sami i mówimy o tym w odpowiedzi.
 *
 * ⚠️ Tylko tor Wan. Graf H3 nie ma wejścia `start_image` — udawanie, że ma,
 * skończyłoby się błędem po kilkunastu minutach liczenia.
 */
export async function dopiszUjecie({ comfyBase, prompt, klatka, szerokosc, wysokosc, fps, klatek, kroki, ziarno }) {
    if (!prompt?.trim()) return { ok: false, powod: 'Pusty opis ujęcia — nie ma czego dopisać.' };
    if (!klatka) return { ok: false, powod: 'Brak klatki startowej — nie wiem, od czego zacząć.' };

    const stan = await stanWideo(comfyBase);
    if (!stan.gotowe) return { ok: false, powod: stan.braki.join(' | '), braki: stan.braki };
    if (stan.silnik.id !== 'wan22') {
        return { ok: false, powod: `Dopisywanie ujęć umie tylko tor Wan — aktywny jest ${stan.silnik.nazwa}.` };
    }

    const doBloku = (n, zapas) => Math.max(256, Math.floor((Number(n) || zapas) / 16) * 16);
    const w = doBloku(szerokosc, 704);
    const h = doBloku(wysokosc, 480);
    const przyciete = (Number(szerokosc) && w !== Number(szerokosc)) || (Number(wysokosc) && h !== Number(wysokosc));

    const graf = JSON.parse(await fs.readFile(path.join(KATALOG_WF(), GRAF_KONTYNUACJI), 'utf8'));
    delete graf._opis;

    graf['1'].inputs.unet_name = stan.silnik.modele[0];
    graf['2'].inputs.clip_name = stan.silnik.enkodery[0];
    graf['3'].inputs.vae_name = stan.silnik.vae[0];
    graf['5'].inputs.text = prompt;
    graf['12'].inputs.image = klatka;
    graf['13'].inputs.width = w;
    graf['13'].inputs.height = h;
    graf['7'].inputs.width = w;
    graf['7'].inputs.height = h;
    graf['7'].inputs.length = Number(klatek) || 49;
    graf['8'].inputs.steps = Number(kroki) || 20;
    graf['8'].inputs.seed = Number.isFinite(Number(ziarno)) ? Number(ziarno) : Math.floor(Math.random() * 1e9);
    graf['10'].inputs.fps = Number(fps) || 24;

    try {
        const r = await fetch(`${comfyBase}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: graf }),
        });
        const d = await r.json();
        if (!r.ok || d?.error) {
            return { ok: false, powod: `ComfyUI odrzucił graf: ${JSON.stringify(d?.error ?? d).slice(0, 300)}` };
        }
        return {
            ok: true, zlecenie: d.prompt_id, silnik: stan.silnik.nazwa,
            format: { szerokosc: w, wysokosc: h, fps: Number(fps) || 24, klatek: Number(klatek) || 49 },
            uwaga: przyciete
                ? `Wymiary przycięte do wielokrotności 16: ${szerokosc}x${wysokosc} → ${w}x${h}.`
                : null,
        };
    } catch (e) {
        return { ok: false, powod: `Nie dowiozłem grafu do ComfyUI: ${e.message}` };
    }
}

/**
 * Stan zlecenia. `gotowe:false` bez pliku to NIE jest sukces.
 *
 * ⚠️ ODDAJEMY TEŻ ŚCIEŻKĘ, nie samą nazwę. ComfyUI zapisuje wynik w podkatalogu
 * (u nas `katedra/`), więc goła nazwa pliku nie wystarcza, żeby go otworzyć —
 * a „gotowe" bez możliwości znalezienia pliku niczym się nie różni od atrapy.
 * `comfyDir` jest opcjonalny: bez niego oddajemy ścieżkę względną wyjścia.
 */
export async function stanZlecenia(comfyBase, id, comfyDir = null) {
    try {
        const r = await fetch(`${comfyBase}/history/${encodeURIComponent(id)}`);
        if (!r.ok) return { ok: false, powod: `ComfyUI HTTP ${r.status}` };
        const d = await r.json();
        const wpis = d?.[id];
        if (!wpis) return { ok: true, gotowe: false, stan: 'w kolejce albo liczy' };

        const pliki = [];
        const materialy = [];
        for (const out of Object.values(wpis.outputs ?? {})) {
            for (const klucz of ['videos', 'gifs', 'images']) {
                for (const p of out?.[klucz] ?? []) {
                    const wzgledna = p.subfolder ? `${p.subfolder}/${p.filename}` : p.filename;
                    pliki.push(p.filename);
                    materialy.push({
                        nazwa: p.filename,
                        podkatalog: p.subfolder ?? '',
                        wzgledna,
                        sciezka: comfyDir
                            ? path.join(comfyDir, 'ComfyUI', 'output', p.subfolder ?? '', p.filename)
                            : path.join('output', wzgledna),
                    });
                }
            }
        }
        const blad = wpis.status?.status_str === 'error' ? wpis.status : null;
        return { ok: true, gotowe: !blad && pliki.length > 0, pliki, materialy, blad };
    } catch (e) {
        return { ok: false, powod: e.message };
    }
}

export default { stanWideo, generujScene, dopiszUjecie, stanZlecenia };
