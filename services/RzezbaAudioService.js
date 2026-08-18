/**
 * ✂️ RzezbaAudioService — CIĘCIE, SKLEJANIE, PĘTLE, PASMA
 *
 * Obróbka tego, co już wygenerowane. Wszystko przez lokalny ffmpeg — zero chmury,
 * zero zewnętrznego DAW-a.
 *
 * ⚠️ GRANICA, KTÓREJ NIE PRZEKRACZAMY W NAZEWNICTWIE:
 * To NIE jest separacja stemów. Wyciągnięcie wokalu czy perkusji z gotowego miksu
 * wymaga modelu uczonego (Demucs / Spleeter) — ffmpeg tego nie umie i nigdy nie umiał.
 * Funkcja `pasma()` rozdziela nagranie po CZĘSTOTLIWOŚCI (dół / środek / góra).
 * Bywa użyteczna („weź sam bas"), ale dolne pasmo to nie jest „stem basu" —
 * siedzi w nim wszystko, co ma niskie częstotliwości, łącznie ze stopą i dołem wokalu.
 * Nazywamy to pasmami i tak to raportujemy.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';

const uruchom = promisify(execFile);

/** Pasma — granice dobrane tak, żeby dół łapał bas i stopę, góra talerze. */
export const PASMA = {
    dol:    { etykieta: 'Dół (bas, stopa)',        filtr: 'lowpass=f=200' },
    srodek: { etykieta: 'Środek (wokal, korpus)',  filtr: 'highpass=f=200,lowpass=f=4000' },
    gora:   { etykieta: 'Góra (talerze, powietrze)', filtr: 'highpass=f=4000' },
};

/** Bezpieczna nazwa pliku wyjściowego — wejście bywa z modelu. */
function bezpiecznaNazwa(baza, sufiks, rozsz = '.wav') {
    const czysta = String(baza).replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 60) || 'audio';
    return `${czysta}__${sufiks}_${Date.now()}${rozsz}`;
}

async function upewnijSiePlik(sciezka) {
    if (!fsSync.existsSync(sciezka)) {
        throw new Error(`Nie ma takiego pliku: ${path.basename(sciezka)}`);
    }
}

/** Długość nagrania w sekundach (ffmpeg zna ją z nagłówka). */
export async function dlugosc(plik) {
    await upewnijSiePlik(plik);
    // ffmpeg wypisuje metadane na stderr TAKŻE gdy kończy się sukcesem — dlatego
    // czytamy stderr z wyniku, a nie tylko z wyjątku (pierwsza wersja parsowała
    // wyłącznie w catch i zawsze zwracała null dla poprawnych plików).
    const zeStderr = (tekst) => {
        const m = String(tekst || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : null;
    };
    try {
        const { stderr } = await uruchom(ffmpegPath, ['-i', plik, '-f', 'null', '-']);
        return zeStderr(stderr);
    } catch (e) {
        return zeStderr(e.stderr);
    }
}

/**
 * Wycina fragment. `od` i `ile` w sekundach.
 * Reenkodujemy (nie -c copy), bo cięcie po kopii trafia w najbliższą klatkę
 * i potrafi się rozjechać o kilkadziesiąt milisekund — przy pętli to słychać.
 */
export async function tnij({ plik, od = 0, ile, katalogWy, nazwa }) {
    await upewnijSiePlik(plik);
    const start = Math.max(0, Number(od) || 0);
    const trwanie = Math.max(0.05, Number(ile) || 4);
    await fs.mkdir(katalogWy, { recursive: true });
    const wy = path.join(katalogWy, nazwa || bezpiecznaNazwa(path.parse(plik).name, `ciecie_${start.toFixed(1)}s`));
    await uruchom(ffmpegPath, [
        '-ss', String(start), '-t', String(trwanie), '-i', plik,
        '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', '-y', wy,
    ]);
    return { plik: path.basename(wy), sciezka: wy, od: start, ile: trwanie };
}

/**
 * Zapętla fragment N razy z krótkim przenikaniem na styku, żeby nie było
 * słychać "kliku" przy każdym powtórzeniu.
 */
export async function petla({ plik, od = 0, ile = 4, powtorzen = 4, przenikanie = 0.02, katalogWy, nazwa }) {
    const kawalek = await tnij({ plik, od, ile, katalogWy, nazwa: bezpiecznaNazwa('tmp_petla', 'src') });
    const n = Math.max(1, Math.min(64, Number(powtorzen) || 4));
    const wy = path.join(katalogWy, nazwa || bezpiecznaNazwa(path.parse(plik).name, `petla_x${n}`));
    try {
        // aloop na próbkach: -1 = zapętl całość, size w próbkach.
        const probek = Math.round(kawalek.ile * 44100);
        await uruchom(ffmpegPath, [
            '-i', kawalek.sciezka,
            '-filter_complex', `aloop=loop=${n - 1}:size=${probek}:start=0,afade=t=in:d=${przenikanie},afade=t=out:st=${(kawalek.ile * n) - przenikanie}:d=${przenikanie}`,
            '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', '-y', wy,
        ]);
    } finally {
        await fs.rm(kawalek.sciezka, { force: true });
    }
    return { plik: path.basename(wy), sciezka: wy, powtorzen: n, dlugoscPetli: kawalek.ile };
}

/** Skleja kilka plików po kolei. */
export async function sklej({ pliki, katalogWy, nazwa }) {
    if (!Array.isArray(pliki) || pliki.length < 2) {
        throw new Error('Do sklejenia potrzeba co najmniej dwóch plików.');
    }
    for (const p of pliki) await upewnijSiePlik(p);
    await fs.mkdir(katalogWy, { recursive: true });
    const wy = path.join(katalogWy, nazwa || bezpiecznaNazwa('sklejka', `x${pliki.length}`));

    // concat filter zamiast demuxera: pliki mogą mieć różne parametry,
    // a filtr sam je zgra do wspólnego formatu.
    const wejscia = pliki.flatMap((p) => ['-i', p]);
    const mapy = pliki.map((_, i) => `[${i}:a]`).join('');
    await uruchom(ffmpegPath, [
        ...wejscia,
        '-filter_complex', `${mapy}concat=n=${pliki.length}:v=0:a=1[out]`,
        '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', '-y', wy,
    ]);
    return { plik: path.basename(wy), sciezka: wy, zlaczono: pliki.length };
}

/** Normalizacja głośności EBU R128 — realny standard, nie "podbicie". */
export async function znormalizuj({ plik, lufs = -14, katalogWy, nazwa }) {
    await upewnijSiePlik(plik);
    await fs.mkdir(katalogWy, { recursive: true });
    const wy = path.join(katalogWy, nazwa || bezpiecznaNazwa(path.parse(plik).name, `norm_${lufs}LUFS`));
    await uruchom(ffmpegPath, [
        '-i', plik, '-af', `loudnorm=I=${lufs}:TP=-1.5:LRA=11`,
        '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', '-y', wy,
    ]);
    return { plik: path.basename(wy), sciezka: wy, lufs };
}

/**
 * Rozdziela na pasma częstotliwości.
 * TO NIE SĄ STEMY — patrz nagłówek pliku. Zwracamy to w polu `uwaga`,
 * żeby nikt po drodze nie nazwał tego separacją instrumentów.
 */
export async function pasma({ plik, katalogWy, ktore }) {
    await upewnijSiePlik(plik);
    await fs.mkdir(katalogWy, { recursive: true });
    const wybrane = (Array.isArray(ktore) && ktore.length ? ktore : Object.keys(PASMA))
        .filter((k) => PASMA[k]);
    if (!wybrane.length) throw new Error(`Nieznane pasma. Dostępne: ${Object.keys(PASMA).join(', ')}`);

    const wyniki = [];
    for (const k of wybrane) {
        const wy = path.join(katalogWy, bezpiecznaNazwa(path.parse(plik).name, `pasmo_${k}`));
        await uruchom(ffmpegPath, [
            '-i', plik, '-af', PASMA[k].filtr,
            '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', '-y', wy,
        ]);
        wyniki.push({ pasmo: k, etykieta: PASMA[k].etykieta, plik: path.basename(wy), sciezka: wy });
    }
    return {
        pasma: wyniki,
        uwaga: 'To rozdział po CZĘSTOTLIWOŚCI, nie separacja stemów. W dolnym paśmie '
             + 'siedzi wszystko, co niskie — bas, stopa i dół wokalu razem. Prawdziwe '
             + 'wyciąganie instrumentów wymaga modelu (Demucs), którego węzeł nie ma.',
    };
}

export default { PASMA, dlugosc, tnij, petla, sklej, znormalizuj, pasma };
