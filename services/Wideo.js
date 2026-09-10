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
        const r = await pobierzZLimitem(`${base}/object_info/${nod}`, {}, 8000);
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
/**
 * fetch do ComfyUI Z LIMITEM CZASU.
 *
 * ⚠️ TO BYŁ PRAWDZIWY BŁĄD I KOSZTOWAŁ SUWERENA GODZINY. Zgłoszenie: „wbija
 * mu błąd, jak wejdzie w stan czuwania". W dzienniku kolejki jedna pozycja
 * zajęła 16 056 s — cztery i pół godziny — mimo że termin oczekiwania to
 * 45 minut.
 *
 * Dlaczego termin nie zadziałał: pętla sprawdza zegar MIĘDZY zapytaniami, a
 * `fetch` bez sygnału przerwania potrafi wisieć w nieskończoność, gdy druga
 * strona uśnie (Windows usypia proces, połączenie TCP zostaje otwarte i nikt
 * nie odpowiada). `await` nigdy nie wraca, więc warunek `Date.now() < DO_KIEDY`
 * nie jest nawet sprawdzany.
 *
 * Limit na każdym zapytaniu zamienia zawieszenie w błąd, który da się obsłużyć.
 */
/** Ile klatek na sekundę produkuje Wan — z workflow (`CreateVideo.fps`). */
export const KLATEK_NA_SEKUNDE = 24;

/** Domyślna długość ujęcia: 49 klatek / 24 fps = 2,04 s. */
export const KLATEK_DOMYSLNIE = 49;

/**
 * Rozdzielczość domyślna — KOMPROMIS, nie przypadek.
 *
 * ⚠️ ZMIERZONE na tej karcie (RTX 3060 Laptop, 6 GB), 49 klatek, 20 kroków,
 * ten sam prompt i to samo ziarno:
 *     704×480   171 s   — stąd brał się wygląd „lat 80.”
 *     960×544   351 s   — TU JESTEŚMY
 *    1280×704   611 s   — natywna Wan, 3,6× drożej niż 704
 *
 * Suweren wybrał środek świadomie: 10-minutowy odcinek to ~300 ujęć, czyli
 * 14 h przy 704, 29 h przy 960 i 51 h przy 1280. Natywna rozdzielczość
 * zostaje do pojedynczych, ważnych ujęć — ustawia sią ją w profilu Reżysera.
 */
export const SZEROKOSC_DOMYSLNIE = Number(process.env.OTAKOS_SZEROKOSC) || 960;
export const WYSOKOSC_DOMYSLNIE = Number(process.env.OTAKOS_WYSOKOSC) || 544;

/**
 * Sekundy → klatki dla Wan.
 *
 * PO CO. Suweren: „można by wydłużyć kadry, teraz mają 2 sec... choć może
 * jakaś możliwość wyboru długości kadru". Odcinek 10–20 min z ujęć po 2 s to
 * setki renderów; dłuższe ujęcie zmienia całą arytmetykę planu.
 *
 * ⚠️ WAN CHCE DŁUGOŚCI POSTACI 4n+1. Latent układa się w paczki po cztery
 * klatki plus jedna; wartość spoza tego wzoru bywa po cichu zaokrąglana przez
 * silnik i dostajesz inną długość, niż prosiłeś.
 *
 * ⚠️ DŁUŻSZE UJĘCIE = WIĘCEJ VRAM I CZASU, liniowo do liczby klatek. Na 6 GB
 * to jest realna granica — dlatego funkcja nie wybiera za nikogo, tylko
 * przelicza to, o co poproszono.
 */
export function klatekZSekund(sekundy) {
    const s = Number(sekundy);
    if (!Number.isFinite(s) || s <= 0) return KLATEK_DOMYSLNIE;
    const surowe = Math.round(s * KLATEK_NA_SEKUNDE);
    const n = Math.max(1, Math.round((surowe - 1) / 4));
    return 4 * n + 1;
}

/** Odwrotność — ile sekund da N klatek. */
export function sekundZKlatek(klatek) {
    const k = Number(klatek) || KLATEK_DOMYSLNIE;
    return Math.round((k / KLATEK_NA_SEKUNDE) * 100) / 100;
}

export async function pobierzZLimitem(url, opcje = {}, limitMs = 20000) {
    try {
        return await fetch(url, { ...opcje, signal: AbortSignal.timeout(limitMs) });
    } catch (e) {
        if (e.name === 'TimeoutError' || e.name === 'AbortError') {
            throw new Error(`ComfyUI nie odpowiedzia\u0142 w ${Math.round(limitMs / 1000)} s \u2014 prawdopodobnie u\u015bpiony.`);
        }
        throw e;
    }
}

export async function stanWideo(comfyBase) {
    let comfy = false;
    try { comfy = (await pobierzZLimitem(`${comfyBase}/object_info/UNETLoader`, {}, 6000)).ok; } catch { comfy = false; }
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
export async function generujScene({ comfyBase, prompt, szerokosc, wysokosc, klatek, sekundy, kroki, ziarno, obrazStartowy = '' }) {
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

    graf[w.wymiary].inputs.width = Number(szerokosc) || SZEROKOSC_DOMYSLNIE;
    graf[w.wymiary].inputs.height = Number(wysokosc) || WYSOKOSC_DOMYSLNIE;
    // `sekundy` ma pierwszeństwo — to nimi myśli człowiek, klatkami silnik.
    const ileKlatek = sekundy ? klatekZSekund(sekundy) : (Number(klatek) || KLATEK_DOMYSLNIE);
    graf[w.wymiary].inputs.length = ileKlatek;

    graf[w.sampler].inputs.steps = Number(kroki) || 20;
    graf[w.sampler].inputs.seed = Number.isFinite(Number(ziarno)) ? Number(ziarno) : Math.floor(Math.random() * 1e9);

    // ⚠️ ETAP RUCH: wideo powstaje Z GOTOWEJ KLATKI, nie z samego tekstu.
    //
    // ZMIERZONE, NIE ZAŁOŻONE (SOLLET, 960×544, 49 klatek). PSNR pierwszej
    // klatki ujęcia względem obrazu podanego jako `start_image`:
    //     klatka 0        33,19 dB   — to ten sam obraz
    //     ostatnia klatka 15,04 dB   — czyli ujęcie naprawdę się rusza
    //     obcy obraz      10,35 dB   — poziom odniesienia „inna scena"
    // Gdyby `start_image` był ignorowany, klatka 0 leżałaby przy 10 dB.
    // Bez tego „KADR” i „RUCH” byłyby dwoma niezależnymi losowaniami tego samego
    // opisu — postać z kadru i postać z ujęcia to byliby dwaj różni ludzie.
    // `Wan22ImageToVideoLatent` ma `start_image` jako wejście OPCJONALNE, więc
    // ten sam graf obsługuje oba tory bez drugiego pliku workflow.
    if (obrazStartowy) {
        graf['90'] = { class_type: 'LoadImage', inputs: { image: obrazStartowy } };
        graf[w.wymiary].inputs.start_image = ['90', 0];
    }

    try {
        const r = await pobierzZLimitem(`${comfyBase}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: graf }),
        }, 30000);   // zlecenie grafu: 30 s wystarczy, dluzej = silnik spi
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
 * KADR — jedna NIERUCHOMA klatka kluczowa.
 *
 * PO CO OSOBNO. Suweren: „kadr powinien produkować kadry, czyli image, potem
 * przenoszone jest do ruchu, gdzie z tego jest robione wideo”. Tablica mówiła
 * to od początku (etap KADR = „nieruchome klatki kluczowe”, RUCH = „ożywienie
 * klatki kluczowej”), ale kolejka i tak liczyła wideo na obu etapach.
 *
 * ⚠️ TO NIE JEST DRUGI MODEL. Ten sam Wan 2.2 liczy JEDNą klatkę zamiast 49
 * (`length: 1` — Wan wymaga 4n+1, a 1 = 4·0+1). Wychodzi z tego kilkanaście
 * razy taniej niż ujęcie, więc cały odcinek da się obejrzeć w kadrach ZANIM
 * zapłaci się godzinami za ruch.
 *
 * ⚠️ Podmieniamy końcówkę grafu: CreateVideo + SaveVideo znikają, wchodzi
 * SaveImage prosto z VAEDecode. Oba węzły są w rdzeniu ComfyUI — sprawdzone.
 */
export async function generujKadrObraz({ comfyBase, prompt, szerokosc, wysokosc, kroki, ziarno }) {
    if (!prompt?.trim()) return { ok: false, powod: 'Pusty opis kadru — nie ma czego rysować.' };

    const stan = await stanWideo(comfyBase);
    if (!stan.gotowe) return { ok: false, powod: stan.braki.join(' | '), braki: stan.braki };

    const opis = SILNIKI.find((s) => s.id === stan.silnik.id);
    const w = opis.wezly;
    const graf = JSON.parse(await fs.readFile(path.join(KATALOG_WF(), opis.graf), 'utf8'));
    delete graf._opis;

    graf[w.model].inputs.unet_name = stan.silnik.modele[0];
    graf[w.enkoder].inputs.clip_name = stan.silnik.enkodery[0];
    graf[w.vae].inputs.vae_name = stan.silnik.vae[0];
    graf[w.prompt].inputs[graf[w.prompt].inputs.prompt !== undefined ? 'prompt' : 'text'] = prompt;

    graf[w.wymiary].inputs.width = Number(szerokosc) || SZEROKOSC_DOMYSLNIE;
    graf[w.wymiary].inputs.height = Number(wysokosc) || WYSOKOSC_DOMYSLNIE;
    graf[w.wymiary].inputs.length = 1;

    graf[w.sampler].inputs.steps = Number(kroki) || 20;
    graf[w.sampler].inputs.seed = Number.isFinite(Number(ziarno)) ? Number(ziarno) : Math.floor(Math.random() * 1e9);

    // Wyrzucamy składanie wideo i zapisujemy obraz. Szukamy węzłów po KLASIE,
    // a nie po numerze — numer w pliku grafu może się kiedyś zmienić.
    const dekoder = Object.keys(graf).find((k) => graf[k].class_type === 'VAEDecode');
    if (!dekoder) return { ok: false, powod: 'Graf nie ma węzła VAEDecode — nie wiem, skąd wziąć obraz.' };
    for (const k of Object.keys(graf)) {
        if (['CreateVideo', 'SaveVideo', 'SaveWEBM', 'SaveAnimatedWEBP'].includes(graf[k].class_type)) delete graf[k];
    }
    graf['99'] = { class_type: 'SaveImage', inputs: { images: [dekoder, 0], filename_prefix: 'katedra/kadr' } };

    try {
        const r = await pobierzZLimitem(`${comfyBase}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: graf }),
        }, 30000);
        const d = await r.json();
        if (!r.ok || d?.error) {
            return { ok: false, powod: `ComfyUI odrzucił graf kadru: ${JSON.stringify(d?.error ?? d).slice(0, 300)}` };
        }
        return { ok: true, zlecenie: d.prompt_id, model: stan.silnik.modele[0], silnik: stan.silnik.nazwa, obraz: true };
    } catch (e) {
        return { ok: false, powod: `Nie dowiozłem grafu kadru do ComfyUI: ${e.message}` };
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
        const r = await pobierzZLimitem(`${comfyBase}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: graf }),
        }, 30000);   // zlecenie grafu: 30 s wystarczy, dluzej = silnik spi
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
        const r = await pobierzZLimitem(`${comfyBase}/history/${encodeURIComponent(id)}`, {}, 20000);
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

export default {
    generujKadrObraz, SZEROKOSC_DOMYSLNIE, WYSOKOSC_DOMYSLNIE, stanWideo, generujScene, dopiszUjecie, stanZlecenia };

/**
 * Policz OBRAZ dowolnym silnikiem z rejestru (services/SilnikiObrazu.js).
 *
 * PO CO OSOBNO OD `generujKadrObraz`. Tamta funkcja umie jedno: wziąć graf
 * WIDEO Wana i podmienić mu końcówkę na SaveImage. To sztuczka, nie droga —
 * działa tylko dla Wana i tylko dlatego, że znamy jego graf od środka.
 *
 * Ta funkcja nie zna żadnego modelu. Dostaje graf, odwzorowanie węzłów
 * i nazwy plików, które ComfyUI NAPRAWDĘ widzi — i podstawia. Dzięki temu
 * dodanie nowego silnika obrazu nie wymaga tknięcia tego pliku.
 *
 * ⚠️ NAZWY PLIKÓW BIERZEMY Z `znalezione`, nie z grafu. Graf jest szablonem;
 * to, co widzi ComfyUI, zależy od `extra_model_paths.yaml` i bywa inne niż
 * nazwa wpisana ręcznie. Raz już most wybrał LoRA jako UNET, bo ufał wzorcowi
 * nazwy zamiast liście z silnika.
 */
export async function generujObrazSilnikiem({
    comfyBase, silnik, znalezione = {}, prompt,
    szerokosc, wysokosc, kroki, ziarno,
}) {
    if (!prompt?.trim()) return { ok: false, powod: 'Pusty opis kadru — nie ma czego rysować.' };
    if (!silnik?.graf) return { ok: false, powod: 'Silnik nie ma pliku grafu.' };

    let graf;
    try {
        graf = JSON.parse(await fs.readFile(path.join(KATALOG_WF(), silnik.graf), 'utf8'));
    } catch (e) {
        return { ok: false, powod: `Nie umiem wczytać grafu „${silnik.graf}": ${e.message}` };
    }
    delete graf._opis;   // komentarz dla ludzi; ComfyUI odrzuciłby go jako nieznany node

    const w = silnik.wezly ?? {};
    const brak = ['model', 'enkoder', 'vae', 'prompt', 'wymiary'].filter((p) => !w[p] || !graf[w[p]]);
    if (brak.length) {
        return { ok: false, powod: `Graf „${silnik.graf}" nie ma węzłów: ${brak.join(', ')}.` };
    }

    if (znalezione.model) graf[w.model].inputs.unet_name = znalezione.model;
    if (znalezione.enkoder) graf[w.enkoder].inputs.clip_name = znalezione.enkoder;
    if (znalezione.vae) graf[w.vae].inputs.vae_name = znalezione.vae;

    const polePromptu = graf[w.prompt].inputs.prompt !== undefined ? 'prompt' : 'text';
    graf[w.prompt].inputs[polePromptu] = prompt;

    const szer = Number(szerokosc) || SZEROKOSC_DOMYSLNIE;
    const wys = Number(wysokosc) || WYSOKOSC_DOMYSLNIE;
    graf[w.wymiary].inputs.width = szer;
    graf[w.wymiary].inputs.height = wys;

    // ⚠️ Flux2Scheduler DRUGI RAZ chce wymiarów — i musi dostać te same.
    // Rozjechane wymiary między latentem a harmonogramem dają obraz rozmyty
    // albo przycięty, bez żadnego błędu po drodze.
    const ileKrokow = Math.max(1, Number(kroki) || Number(silnik.kroki) || 20);
    if (w.harmonogram && graf[w.harmonogram]) {
        graf[w.harmonogram].inputs.steps = ileKrokow;
        graf[w.harmonogram].inputs.width = szer;
        graf[w.harmonogram].inputs.height = wys;
    }
    if (w.sampler && graf[w.sampler]) graf[w.sampler].inputs.steps = ileKrokow;

    const nasiono = Number.isFinite(Number(ziarno)) ? Number(ziarno) : Math.floor(Math.random() * 1e9);
    if (w.ziarno && graf[w.ziarno]) graf[w.ziarno].inputs.noise_seed = nasiono;
    if (w.sampler && graf[w.sampler]) graf[w.sampler].inputs.seed = nasiono;

    try {
        const r = await pobierzZLimitem(`${comfyBase}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: graf }),
        }, 30000);
        const d = await r.json();
        if (!r.ok || d?.error) {
            return { ok: false, powod: `ComfyUI odrzucił graf „${silnik.nazwa}": ${JSON.stringify(d?.error ?? d).slice(0, 300)}` };
        }
        return { ok: true, zlecenie: d.prompt_id, silnik: silnik.nazwa, model: znalezione.model ?? null, obraz: true, kroki: ileKrokow };
    } catch (e) {
        return { ok: false, powod: `Nie dowiozłem grafu do ComfyUI: ${e.message}` };
    }
}
