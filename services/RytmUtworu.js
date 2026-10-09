/**
 * 🥁 Rytm utworu — tempo (BPM) i uderzenia z samego dźwięku, LOKALNIE (Suweren 2026-10-09: „TeOgochi będzie się mógł
 * uczyć tańczyć i brać udział w wyzwaniach tanecznych… symulować lokalnie”). Bez chmury i bez nowych zależności:
 * ffmpeg dekoduje utwór do mono 11 025 Hz (float), a reszta to czysta matematyka:
 *   1. obwiednia energii co ~23 ms → siła NAPŁYWU (dodatnia różnica energii — tam, gdzie coś uderza),
 *   2. autokorelacja napływu dla tempa 70–180 BPM (lekka preferencja okolic 120 — tak słychać „puls” utworu),
 *   3. faza: przesunięcie siatki uderzeń, które zbiera najwięcej napływu,
 *   4. uderzenia = siatka okresu od fazy do końca, każde z siłą (akcent) 0–1.
 * Wynik w schowku `_OtakOs_Wymiar/rytm/<sha1(ścieżka, rozmiar, czas)>.json`. Uczciwie: siatka stałego tempa — utwór
 * ze zmianami tempa dostanie średnie tempo (pewność to mówi).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

export const SR = 11025;
export const HOP = 256;
export const MAX_SEK = 6 * 60;
const BPM_MIN = 70, BPM_MAX = 180;

/** Obwiednia napływu (onset strength) z próbek PCM. */
export function naplyw(pcm, hop = HOP) {
    const n = Math.floor(pcm.length / hop);
    const e = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = i * hop; k < (i + 1) * hop; k++) s += pcm[k] * pcm[k]; e[i] = Math.sqrt(s / hop); }
    const o = new Float32Array(n);
    for (let i = 1; i < n; i++) o[i] = Math.max(0, e[i] - e[i - 1]);
    let max = 0; for (const v of o) if (v > max) max = v;
    if (max > 0) for (let i = 0; i < n; i++) o[i] /= max;
    return o;
}

/**
 * Tempo, faza i uderzenia z obwiedni napływu (czysta funkcja).
 * @returns {{ bpm:number, okresSek:number, przesuniecieSek:number, pewnosc:number, beaty:{t:number, sila:number}[] }}
 */
export function analizujNaplyw(o, { sr = SR, hop = HOP } = {}) {
    const klatkaSek = hop / sr;
    const lagMin = Math.floor(60 / BPM_MAX / klatkaSek), lagMax = Math.ceil(60 / BPM_MIN / klatkaSek);
    let najlepszy = -1, najLag = 0, suma = 0, ile = 0;
    const wyniki = [];
    for (let lag = lagMin; lag <= lagMax; lag++) {
        let s = 0;
        for (let i = lag; i < o.length; i++) s += o[i] * o[i - lag];
        const bpm = 60 / (lag * klatkaSek);
        const waga = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);   // „puls” bliżej 120 słychać mocniej
        const w = s * waga;
        wyniki.push(w); suma += w; ile++;
        if (w > najlepszy) { najlepszy = w; najLag = lag; }
    }
    if (najlepszy <= 0) throw new Error('Nie słychać rytmu (cisza albo bez uderzeń).');
    // dokładniejsze tempo: parabola wokół najlepszego opóźnienia
    const i0 = najLag - lagMin;
    const [a, b, c] = [wyniki[i0 - 1] ?? najlepszy, najlepszy, wyniki[i0 + 1] ?? najlepszy];
    const d = (a - 2 * b + c) !== 0 ? 0.5 * (a - c) / (a - 2 * b + c) : 0;
    const okres0 = (najLag + Math.max(-0.5, Math.min(0.5, d))) * klatkaSek;
    // okres ±1,5% i faza razem: siatka, która zbiera najwięcej napływu (autokorelacja daje tempo z dokładnością
    // ~1 klatki na okres — na 3 minutach to już wyraźne rozjechanie z muzyką)
    const zbierz = (P, f) => { let s = 0; for (let t = f; t < o.length; t += P) { const k = Math.floor(t), u = t - k; s += (o[k] ?? 0) * (1 - u) + (o[k + 1] ?? 0) * u; } return s; };
    let P = okres0 / klatkaSek, najFaza = 0, najSuma = -1;
    for (let q = -0.015; q <= 0.0151; q += 0.0005) {
        const Pq = (okres0 / klatkaSek) * (1 + q);
        for (let f = 0; f < Pq; f += 0.25) { const sm = zbierz(Pq, f); if (sm > najSuma) { najSuma = sm; najFaza = f; P = Pq; } }
    }
    const okres = P * klatkaSek;
    // Korekta czasu siatki względem ataku dźwięku, zmierzona na klikach 96/128/150 BPM (2026-10-09): bez niej siatka
    // z interpolowaną fazą wyprzedzała atak o ~1 klatkę — przesuwamy o ćwierć klatki PÓŹNIEJ.
    const KOREKTA = -0.25;
    const beaty = [];
    let maxSila = 0;
    for (let t = najFaza; t < o.length; t += P) {
        const k = Math.round(t);
        let s = 0; for (let j = Math.max(0, k - 2); j <= Math.min(o.length - 1, k + 2); j++) s = Math.max(s, o[j]);
        beaty.push({ t: Math.max(0, Math.round((t - KOREKTA) * klatkaSek * 1000) / 1000), sila: s }); if (s > maxSila) maxSila = s;
    }
    if (maxSila > 0) for (const x of beaty) x.sila = Math.round((x.sila / maxSila) * 100) / 100;
    return {
        bpm: Math.round((60 / okres) * 10) / 10, okresSek: Math.round(okres * 10000) / 10000,
        przesuniecieSek: Math.max(0, Math.round((najFaza - KOREKTA) * klatkaSek * 1000) / 1000),
        pewnosc: Math.round(Math.min(1, najlepszy / (suma / ile) / 4) * 100) / 100, beaty,
    };
}

/**
 * @param {{ katalogMuzyki: string, katalog: string, ffmpeg: string, uruchom: (cmd:string, args:string[], o?:object) => Promise<{stdout: Buffer}> }} o
 */
export function utworzRytm({ katalogMuzyki, katalog, ffmpeg, uruchom }) {
    const wMuzyce = (rel) => {
        const p = path.resolve(katalogMuzyki, String(rel ?? ''));
        if (!p.startsWith(path.resolve(katalogMuzyki) + path.sep)) throw new Error('Utwór spoza biblioteki muzyki.');
        if (!/\.(mp3|wav|flac|ogg|m4a)$/i.test(p) || !fsSync.existsSync(p)) throw new Error('Nie ma takiego utworu.');
        return p;
    };

    /** Utwory z biblioteki (katalog główny i jeden poziom niżej, bez stemów i próbek). */
    async function utwory() {
        const out = [];
        const dodaj = async (rel) => {
            for (const f of await fs.readdir(path.join(katalogMuzyki, rel), { withFileTypes: true }).catch(() => [])) {
                const r = rel ? `${rel}/${f.name}` : f.name;
                if (f.isFile() && /\.(mp3|wav|flac|ogg|m4a)$/i.test(f.name)) out.push({ plik: r, tytul: f.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '), url: `/music/${r.split('/').map(encodeURIComponent).join('/')}` });
                else if (f.isDirectory() && !rel && !f.name.startsWith('_')) await dodaj(f.name);
            }
        };
        await dodaj('');
        return out.slice(0, 300);
    }

    /** Rytm utworu (ze schowka albo policzony teraz). */
    async function analizuj(rel) {
        const p = wMuzyce(rel);
        const st = await fs.stat(p);
        const klucz = crypto.createHash('sha1').update(`${p}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 20);
        const plik = path.join(katalog, `${klucz}.json`);
        try { return JSON.parse(await fs.readFile(plik, 'utf8')); } catch { /* liczymy */ }
        const t0 = Date.now();
        const { stdout } = await uruchom(ffmpeg, ['-loglevel', 'error', '-t', String(MAX_SEK), '-i', p, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { encoding: 'buffer', maxBuffer: MAX_SEK * SR * 4 + 4096 });
        const pcm = new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 4));
        if (pcm.length < SR * 4) throw new Error('Utwór za krótki do tańca (min. 4 s).');
        const wynik = { plik: rel, sekundy: Math.round((pcm.length / SR) * 10) / 10, ...analizujNaplyw(naplyw(pcm)), liczone: Date.now() - t0 };
        await fs.mkdir(katalog, { recursive: true });
        await fs.writeFile(plik, JSON.stringify(wynik), 'utf8');
        return wynik;
    }

    return { utwory, analizuj };
}

export default { utworzRytm, naplyw, analizujNaplyw, SR, HOP };
