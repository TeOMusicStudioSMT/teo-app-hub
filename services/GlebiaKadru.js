/**
 * 🧊 Głębia kadru — płaskie zdjęcie studia → plan zdjęciowy z bryłą, po którym jeździ kamera Blendera.
 *
 * Suweren (2026-10-05): „uczynić w wywiadach nasze statyczne tła w prawdziwe studia”. Patrzyliśmy na image-blaster
 * (World Labs Marble + Hunyuan przez FAL) — to chmura, a Hunyuan wyklucza UE. Tu wszystko lokalnie:
 *
 *   1. GŁĘBIA: Depth Anything V2 Small (Apache-2.0) jako plik ONNX przez `onnxruntime-node` — bez Pythona, na CPU.
 *      Obraz skaluje i dekoduje nasz ffmpeg (bez `sharp`: transformers.js wczytuje go przy imporcie, a gdy jego binarki
 *      brak, pada cały import — sprawdzone 2026-10-05). Model pobiera się RAZ z HuggingFace (`HF_ENDPOINT` = lustro) do
 *      `_OtakOs_AI/glebia/<model>/model.onnx`; `OTAKOS_GLEBIA_ONNX` = własny plik (bez internetu), `OTAKOS_GLEBIA_MODEL`
 *      = inne repo z tym samym kontraktem (`pixel_values` → `predicted_depth`). Wynik: mapa głębi PNG (jasne = blisko)
 *      w schowku po sumie pliku.
 *   2. SIATKA (czysta funkcja `siatkaZGlebi`, testowana bez modelu i bez Blendera): każdy wierzchołek siatki stoi na
 *      promieniu kamery w odległości z mapy głębi — z miejsca kamery siatka wygląda DOKŁADNIE jak zdjęcie, a gdy kamera
 *      się ruszy, bliskie rzeczy przesuwają się względem dalekich (prawdziwa paralaksa, nie najazd na płaski obraz).
 *   3. BLENDER (`Blender.zbudujStudioGlebi` + `skryptUjecia`): scena z siatki, kamera jedzie łagodnie (2.5D ma granice:
 *      zbyt duży obrót odsłania „rozciągnięte” krawędzie za przedmiotami), klatki → nasz ffmpeg → klip.
 *   4. PĘTLA: klip w przód + wstecz (ping-pong), więc zapętlony pod długą kwestią nie skacze.
 *
 * ⚠️ UCZCIWIE: Depth Anything daje głębię WZGLĘDNĄ (nie metry) — skala sceny jest umowna (`blisko`/`daleko`). To 2.5D:
 * za kanapą nie ma tego, czego aparat nie widział; ruchy kamery są przez to celowo małe.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { PNG } from 'pngjs';
import os from 'os';
import { fileURLToPath } from 'url';

const SKRYPT_SZACOWANIA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'glebia', 'szacuj.mjs');

export const MODEL_GLEBI = 'onnx-community/depth-anything-v2-small';
export const OBRAZ = /\.(png|jpe?g|webp|bmp)$/i;

/** Wejście Depth Anything: krótszy bok 518 px, oba boki wielokrotnością 14 (jak `DPTImageProcessor`), dłuższy ≤ 1400. */
export function wymiaryWejscia(szer, wys, bok = 518, maks = 1400) {
    let s = bok / Math.min(szer, wys);
    if (Math.max(szer, wys) * s > maks) s = maks / Math.max(szer, wys);
    const r14 = (x) => Math.max(14, Math.round(x / 14) * 14);
    return { szer: r14(szer * s), wys: r14(wys * s) };
}

/** RGB (bajty, HWC) → tensor CHW znormalizowany średnią i odchyleniem ImageNet — tak uczono Depth Anything. */
export function tensorObrazu(rgb, szer, wys) {
    const SR = [0.485, 0.456, 0.406], OD = [0.229, 0.224, 0.225];
    const t = new Float32Array(3 * szer * wys), n = szer * wys;
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) t[c * n + i] = (rgb[i * 3 + c] / 255 - SR[c]) / OD[c];
    return t;
}

/** Wyjście modelu (dysparycja, liczby zmiennoprzecinkowe) → bajty 0–255 (min→0, max→255). */
export function bajtyGlebi(dane) {
    let lo = Infinity, hi = -Infinity;
    for (const v of dane) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const z = hi - lo || 1;
    return Uint8Array.from(dane, (v) => Math.round(((v - lo) / z) * 255));
}

/** Proporcja kadru, który renderuje kamera (jak Studio Podcastu: 16:9). */
export const PROPORCJA_KADRU = 16 / 9;

/**
 * Mapa głębi (jasne = blisko, jak w Depth Anything) → siatka rzutowana z kamery.
 *
 * Układ jak w Blenderze: Z w górę, kamera patrzy wzdłuż +Y. Kamera stoi w (0, -srodek, wysokosc), cel (CEL) w (0, 0,
 * wysokosc) — czyli w połowie głębi sceny; orbita Blendera kręci się wokół początku układu, więc obiega środek planu.
 * `fov` = poziomy kąt widzenia ZDJĘCIA (stopnie; nieznany — 60° to typowy szeroki kadr). Kamera renderuje 16:9 wycięte
 * ze środka zdjęcia z zapasem `zapas`; siatka wystaje poza zdjęcie o `brzeg` (ułamek), żeby ruch nie odsłaniał czerni.
 *
 * @param {{ dane: Uint8Array|number[], szer: number, wys: number, kolumn?: number, fov?: number, blisko?: number, daleko?: number, wysokosc?: number, zapas?: number }} o
 * @returns {{ v: number[], uv: number[], f: number[], kolumn: number, wierszy: number, kamera: { poz: number[], cel: number[], fov: number }, srodek: number, blisko: number, daleko: number }}
 */
export function siatkaZGlebi({ dane, szer, wys, kolumn = 192, fov = 60, blisko = 2.5, daleko = 14, wysokosc = 1.6, zapas = 1.12, brzeg = 0.1 }) {
    if (!(szer > 1 && wys > 1) || !dane || dane.length < szer * wys) throw new Error('Mapa głębi jest pusta albo ma zły rozmiar.');
    if (!(daleko > blisko && blisko > 0)) throw new Error('Głębia: „daleko” musi być większe od „blisko” (> 0).');
    const proporcja = szer / wys;
    const K = Math.max(8, Math.min(512, Math.round(kolumn)));
    const W = Math.max(4, Math.round(K / proporcja));
    // Normalizacja odporna na pojedyncze piksele: 1. i 99. percentyl zamiast min/max.
    const hist = new Array(256).fill(0);
    for (let i = 0; i < szer * wys; i++) hist[dane[i]]++;
    const percentyl = (p) => { let s = 0; const cel = p * szer * wys; for (let k = 0; k < 256; k++) { s += hist[k]; if (s >= cel) return k; } return 255; };
    const lo = percentyl(0.01), hi = Math.max(lo + 1, percentyl(0.99));
    // Średnia mapy z pola jednej komórki siatki wokół (u, v) ∈ [0,1]² — obraz całkowy, O(1) na wierzchołek.
    // Próbka z jednego punktu przenosiła każdy szum mapy na geometrię (poszarpane „strzępy” przy ruchu kamery).
    const calka = new Float64Array((szer + 1) * (wys + 1));
    for (let y = 0; y < wys; y++) {
        let wiersz = 0;
        for (let x = 0; x < szer; x++) { wiersz += dane[y * szer + x]; calka[(y + 1) * (szer + 1) + x + 1] = calka[y * (szer + 1) + x + 1] + wiersz; }
    }
    const hx = Math.max(0.5, szer / K / 2), hy = Math.max(0.5, wys / Math.max(4, Math.round(K / proporcja)) / 2);
    const probka = (u, v) => {
        const cx = u * (szer - 1), cy = v * (wys - 1);
        const x0 = Math.max(0, Math.floor(cx - hx)), x1 = Math.min(szer, Math.ceil(cx + hx)), y0 = Math.max(0, Math.floor(cy - hy)), y1 = Math.min(wys, Math.ceil(cy + hy));
        const S = calka[y1 * (szer + 1) + x1] - calka[y0 * (szer + 1) + x1] - calka[y1 * (szer + 1) + x0] + calka[y0 * (szer + 1) + x0];
        return S / Math.max(1, (x1 - x0) * (y1 - y0));
    };
    // Depth Anything zwraca DYSPARYCJĘ (odwrotność głębi): odległość = 1 / lerp(1/daleko, 1/blisko, d).
    const odleglosc = (d) => { const t = Math.max(0, Math.min(1, (d - lo) / (hi - lo))); return 1 / (1 / daleko + t * (1 / blisko - 1 / daleko)); };
    const tx = Math.tan((fov * Math.PI) / 360), ty = tx / proporcja;
    // Brzeg: siatka wychodzi poza kadr o `brzeg` z każdej strony (uv poza [0,1], tekstura EXTEND powtarza skraj
    // zdjęcia) — gdy kamera się ruszy, na krawędzi widać rozciągnięty skraj zamiast czarnej dziury.
    const b = Math.max(0, Math.min(0.3, Number(brzeg) || 0));
    const wsp = (k, n) => -b + (k / n) * (1 + 2 * b);
    const klam = (x) => Math.max(0, Math.min(1, x));
    const glebie = [];
    for (let j = 0; j <= W; j++) for (let i = 0; i <= K; i++) glebie.push(odleglosc(probka(klam(wsp(i, K)), klam(wsp(j, W)))));
    const posort = [...glebie].sort((a, b) => a - b);
    const srodek = posort[Math.floor(posort.length / 2)];
    const r4 = (x) => Math.round(x * 1e4) / 1e4;
    const v = [], uv = [], f = [];
    for (let j = 0; j <= W; j++) {
        for (let i = 0; i <= K; i++) {
            const u = wsp(i, K), w = wsp(j, W), z = glebie[j * (K + 1) + i];
            // punkt na promieniu kamery (kamera w (0,-srodek,wysokosc)), z = odległość wzdłuż osi patrzenia
            v.push(r4((u - 0.5) * 2 * tx * z), r4(z - srodek), r4(wysokosc + (0.5 - w) * 2 * ty * z));
            uv.push(r4(u), r4(1 - w));
        }
    }
    for (let j = 0; j < W; j++) for (let i = 0; i < K; i++) {
        const a = j * (K + 1) + i;
        // kolejność przeciwna do ruchu wskazówek patrząc od kamery → normalne w stronę kamery
        f.push(a, a + K + 1, a + K + 2, a + 1);
    }
    // Kąt kamery: 16:9 ze środka zdjęcia, ciaśniej o `zapas`.
    const txKadru = (proporcja >= PROPORCJA_KADRU ? ty * PROPORCJA_KADRU : tx) / zapas;
    const fovKamery = (2 * Math.atan(txKadru) * 180) / Math.PI;
    return { v, uv, f, kolumn: K, wierszy: W, kamera: { poz: [0, r4(-srodek), wysokosc], cel: [0, 0, wysokosc], fov: r4(fovKamery) }, srodek: r4(srodek), blisko, daleko };
}

/** Szara mapa (jeden bajt na piksel) → PNG. Czysty JS (pngjs) — bez natywnego `sharp`, który bywa niezainstalowany. */
export function pngSzary(dane, szer, wys) {
    const png = new PNG({ width: szer, height: wys });
    for (let i = 0; i < szer * wys; i++) { const v = dane[i]; png.data[i * 4] = v; png.data[i * 4 + 1] = v; png.data[i * 4 + 2] = v; png.data[i * 4 + 3] = 255; }
    return PNG.sync.write(png);
}

/**
 * @param {{ katalog: string, cacheModeli: string, ffmpeg: string, blender: any, model?: string, szacuj?: (plik: string) => Promise<{ dane: Uint8Array, szer: number, wys: number }>, szyna?: any }} o
 *   `blender` = moduł services/Blender.js (stan, budowa sceny, skrypt ujęcia, uruchom, złożenie klatek);
 *   `szacuj` = własny estymator głębi (testy) zamiast modelu; `plikModelu` = gotowy .onnx (bez pobierania).
 */
export function utworzGlebie(o) {
    const cfg = { model: process.env.OTAKOS_GLEBIA_MODEL || MODEL_GLEBI, plikModelu: process.env.OTAKOS_GLEBIA_ONNX || null, ...o };
    const KAT_GLEBI = path.join(cfg.katalog, 'glebia');
    const KAT_ZADAN = path.join(cfg.katalog, 'studia3d');
    const zadania = new Map();

    const ff = (args, cwd) => new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, windowsHide: true, timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 },
        (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`)) : ok())));

    const katalogModelu = () => path.join(cfg.cacheModeli, cfg.model.replace(/[^a-zA-Z0-9._-]+/g, '_'));
    const sciezkaModelu = () => cfg.plikModelu || path.join(katalogModelu(), 'model.onnx');

    /** Plik ONNX modelu: wskazany albo pobrany raz z HuggingFace (strumieniem do .part, potem podmiana). */
    async function model() {
        const p = sciezkaModelu();
        if (fsSync.existsSync(p) && fsSync.statSync(p).size > 0) return p;
        if (cfg.plikModelu) throw new Error(`Nie widzę modelu głębi wskazanego w OTAKOS_GLEBIA_ONNX: ${p}`);
        const url = `${(process.env.HF_ENDPOINT || 'https://huggingface.co').replace(/\/+$/, '')}/${cfg.model}/resolve/main/onnx/model.onnx`;
        let r;
        try { r = await fetch(url, { redirect: 'follow' }); } catch (e) { throw new Error(`Nie mogę pobrać modelu głębi (${url}): ${e.cause?.message || e.message}. Bez internetu: pobierz plik ręcznie i wskaż go w OTAKOS_GLEBIA_ONNX.`); }
        if (!r.ok || !r.body) throw new Error(`Model głębi: ${url} → HTTP ${r.status}. Bez internetu: pobierz plik ręcznie i wskaż go w OTAKOS_GLEBIA_ONNX.`);
        await fs.mkdir(path.dirname(p), { recursive: true });
        const czesc = `${p}.part`;
        const { Readable } = await import('stream');
        const { pipeline } = await import('stream/promises');
        await pipeline(Readable.fromWeb(r.body), fsSync.createWriteStream(czesc));
        if (fsSync.statSync(czesc).size < 1_000_000) { await fs.rm(czesc, { force: true }); throw new Error(`Model głębi z ${url} jest podejrzanie mały — to nie jest plik ONNX.`); }
        await fs.rename(czesc, p);
        return p;
    }

    /** Wymiary obrazu z nagłówka (ffmpeg -i), bez dekodowania całości. */
    const wymiaryObrazu = (plik) => new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-i', plik], { windowsHide: true, timeout: 60_000 }, (_e, _o, err) => {
        const m = String(err).match(/Video:.*?(\d{2,5})x(\d{2,5})/);
        return m ? ok({ szer: Number(m[1]), wys: Number(m[2]) }) : zle(new Error(`ffmpeg nie czyta obrazu: ${path.basename(plik)}`));
    }));
    /** Obraz → surowe RGB w zadanym rozmiarze (bicubic, jak procesor Depth Anything). */
    const rgbObrazu = (plik, szer, wys) => new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', plik, '-vf', `scale=${szer}:${wys}:flags=bicubic`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        { windowsHide: true, timeout: 120_000, maxBuffer: szer * wys * 3 + 1024, encoding: 'buffer' }, (e, out, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).slice(0, 300)}`)) : ok(out))));

    /**
     * Depth Anything (ONNX Runtime, CPU): obraz → dysparycja w rozdzielczości wejścia modelu.
     * Model liczy się w OSOBNYM procesie (`services/glebia/szacuj.mjs`): ONNX Runtime jest natywny — jego twardy błąd
     * albo brak pamięci zabijał cały most („padła, jak ruszyło ożywianie”, Suweren 2026-10-05). Teraz pada tylko
     * ten proces, a powód (kod wyjścia, ogon stderr) wraca jako zwykły błąd zadania.
     */
    async function szacujModelem(plik) {
        const plikModelu = await model();
        const w = wymiaryWejscia(...Object.values(await wymiaryObrazu(plik)));
        const rgb = await rgbObrazu(plik, w.szer, w.wys);
        if (rgb.length < w.szer * w.wys * 3) throw new Error('ffmpeg oddał za mało pikseli obrazu.');
        const robocze = await fs.mkdtemp(path.join(os.tmpdir(), 'glebia-'));
        try {
            const plikRgb = path.join(robocze, 'rgb.raw'), wyjscie = path.join(robocze, 'glebia.raw');
            await fs.writeFile(plikRgb, rgb);
            const arg = JSON.stringify({ model: plikModelu, rgb: plikRgb, szer: w.szer, wys: w.wys, wyjscie });
            const wynik = await new Promise((ok, zle) => execFile(process.execPath, [SKRYPT_SZACOWANIA, arg], { windowsHide: true, timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 }, (e, out, err) => {
                if (!e) { try { return ok(JSON.parse(String(out))); } catch { return zle(new Error(`Liczenie głębi oddało nieczytelny wynik: ${String(out).slice(0, 200)}`)); } }
                const ogon = String(err || '').trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 400);
                const jak = e.killed ? 'przekroczyło 10 min' : e.signal ? `sygnał ${e.signal}` : `kod ${e.code}`;
                return zle(new Error(`Liczenie głębi (model „${cfg.model}”) padło — ${jak}${ogon ? `: ${ogon}` : ' (bez komunikatu — zwykle brak pamięci albo błąd natywny ONNX Runtime)'}. Most działa dalej.`));
            }));
            const dane = await fs.readFile(wyjscie);
            if (dane.length < wynik.szer * wynik.wys) throw new Error('Liczenie głębi zapisało za mało danych.');
            return { dane: new Uint8Array(dane.buffer, dane.byteOffset, wynik.szer * wynik.wys), szer: wynik.szer, wys: wynik.wys };
        } finally { await fs.rm(robocze, { recursive: true, force: true }).catch(() => {}); }
    }

    /** Mapa głębi kadru → PNG w schowku (po sumie pliku i nazwie modelu). Zwraca ścieżkę i rozmiar. */
    async function mapaGlebi(kadr) {
        const plik = String(kadr ?? '').trim();
        if (!OBRAZ.test(plik) || !fsSync.existsSync(plik)) throw new Error(`Głębia liczy się z obrazu (png/jpg/webp): ${plik || '(brak)'}`);
        const suma = createHash('sha1').update(await fs.readFile(plik)).update(cfg.szacuj ? 'test' : cfg.model).digest('hex').slice(0, 20);
        const cel = path.join(KAT_GLEBI, `${suma}.png`);
        const surowe = `${cel}.raw.json`;
        if (fsSync.existsSync(cel) && fsSync.existsSync(surowe)) return { plik: cel, ...JSON.parse(await fs.readFile(surowe, 'utf8')), zSchowka: true };
        const g = await (cfg.szacuj ?? szacujModelem)(plik);
        await fs.mkdir(KAT_GLEBI, { recursive: true });
        await fs.writeFile(cel, pngSzary(g.dane, g.szer, g.wys));
        const opis = { szer: g.szer, wys: g.wys, model: cfg.szacuj ? 'test' : cfg.model };
        await fs.writeFile(surowe, JSON.stringify(opis), 'utf8');
        return { plik: cel, ...opis, zSchowka: false };
    }

    /** PNG głębi → bajty jasności (kanał czerwony = szarość). */
    async function czytajGlebie(plik) {
        const png = PNG.sync.read(await fs.readFile(plik));
        return { dane: Uint8Array.from({ length: png.width * png.height }, (_, i) => png.data[i * 4]), szer: png.width, wys: png.height };
    }

    /** Klip w przód + wstecz — zapętlony nie skacze. */
    async function pingPong(wej, wyj) {
        await ff(['-y', '-i', wej, '-filter_complex', '[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]', '-map', '[v]', '-an',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', wyj], path.dirname(wyj));
    }

    /**
     * Cały tor w tle: głębia → siatka → scena Blendera → ujęcie → klip-pętla. Zwraca zadanie od razu (`zadanie(id)`
     * pokazuje etap). Bez Blendera kończy się błędem wprost — mapa głębi i siatka i tak zostają (podgląd głębi działa).
     * `cel` = gdzie położyć gotowy klip (np. katalog projektu, by Sceny dialogowe widziały go jako tło).
     */
    function ozyw({ kadr, ruch = 'najazd', sekundy = 6, fov = 60, nazwa = '', cel = null, naKoniec = null } = {}) {
        const id = `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const z = { id, kadr, ruch, sekundy: Math.max(2, Math.min(20, Number(sekundy) || 6)), etap: 'głębia', od: new Date().toISOString(), wynik: null, blad: null };
        if (!cfg.blender.RUCHY.some((r) => r.id === ruch)) throw new Error(`Nieznany ruch „${ruch}”. Dostępne: ${cfg.blender.RUCHY.map((r) => r.id).join(', ')}.`);
        if (!OBRAZ.test(String(kadr ?? '')) || !fsSync.existsSync(kadr)) throw new Error(`Studio 3D buduje się z obrazu (png/jpg/webp): ${kadr || '(brak)'}`);
        zadania.set(id, z);
        z.obietnica = (async () => {
            try {
                const g = await mapaGlebi(kadr);
                z.glebia = g.plik;
                z.etap = 'siatka';
                const s = siatkaZGlebi({ ...(await czytajGlebie(g.plik)), fov: Number(fov) || 60 });
                const katZ = path.join(KAT_ZADAN, id);
                await fs.mkdir(katZ, { recursive: true });
                const plikSiatki = path.join(katZ, 'siatka.json');
                await fs.writeFile(plikSiatki, JSON.stringify(s), 'utf8');
                z.etap = 'blender: scena';
                const stan = await cfg.blender.stanBlendera();
                if (!stan.jest) throw new Error(`Głębia i siatka gotowe, ale ${stan.powod} ${stan.cozrobic}`);
                const b = await cfg.blender.zbudujStudioGlebi({ kadr, siatka: plikSiatki, nazwa: nazwa || path.basename(kadr).replace(/\.[^.]+$/, '') });
                await cfg.blender.uruchom(b.skrypt);
                z.blend = b.scena;
                z.etap = 'blender: render';
                const u = await cfg.blender.skryptUjecia({ blend: b.scena, ruch, sekundy: z.sekundy, fps: 24, szerokosc: 1280, wysokosc: 720, nazwa: b.nazwa });
                // EEVEE na GPU: ułamek sekundy na klatkę; Cycles na CPU: kilka–kilkanaście — limit rośnie z liczbą klatek.
                await cfg.blender.uruchom(u.skrypt, { limitMs: Math.max(10 * 60_000, u.klatek * 20_000) });
                const film = await cfg.blender.zlozKlatki(u.wyjscieBaza, 24);
                z.etap = 'pętla';
                const katCelu = cel ?? katZ;
                await fs.mkdir(katCelu, { recursive: true });
                const klip = path.join(katCelu, `studio3d_${(nazwa || path.basename(kadr).replace(/\.[^.]+$/, '')).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}_${ruch}_${id.slice(2, 8)}.mp4`);
                await pingPong(film.plik, klip);
                await fs.rm(u.wyjscieBaza, { recursive: true, force: true }).catch(() => {});
                z.wynik = { klip, sekundy: Math.round(film.klatek / 24 * 2 * 100) / 100, glebia: g.plik, blend: b.scena, ruch };
                z.etap = 'gotowe';
                cfg.szyna?.nadaj?.({ agent: 'Klatka', rodzaj: 'praca', tresc: `ożywiła kadr „${path.basename(kadr)}” w studio 3D (${ruch}, głębia + Blender)` })?.catch?.(() => {});
                if (naKoniec) await naKoniec(null, z.wynik);
            } catch (e) {
                z.etap = 'błąd';
                z.blad = String(e.message || e).slice(0, 500);
                if (naKoniec) await naKoniec(e, null).catch(() => {});
            }
            z.koniec = new Date().toISOString();
        })();
        return opis(z);
    }

    const opis = (z) => (z ? { id: z.id, kadr: z.kadr, ruch: z.ruch, sekundy: z.sekundy, etap: z.etap, od: z.od, koniec: z.koniec ?? null, glebia: z.glebia ?? null, wynik: z.wynik, blad: z.blad } : null);
    const zadanie = (id) => opis(zadania.get(id));
    const lista = () => [...zadania.values()].map(opis).reverse();
    async function stan() {
        const p = sciezkaModelu();
        return { model: cfg.model, licencja: cfg.model === MODEL_GLEBI ? 'Apache-2.0 (Depth Anything V2 Small)' : 'sprawdź kartę modelu', plikModelu: p, modelNaDysku: fsSync.existsSync(p), blender: await cfg.blender.stanBlendera(), zadania: lista().slice(0, 10) };
    }
    /** Do testów: poczekaj na koniec zadania. */
    const czekaj = (id) => zadania.get(id)?.obietnica ?? Promise.resolve();

    return { mapaGlebi, czytajGlebie, ozyw, zadanie, lista, stan, czekaj, pingPong };
}

export default { siatkaZGlebi, utworzGlebie, wymiaryWejscia, tensorObrazu, bajtyGlebi, pngSzary, MODEL_GLEBI };
