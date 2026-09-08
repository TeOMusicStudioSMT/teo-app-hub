/**
 * 🎚️ Montaz — sklejanie gotowych filmów i podkładanie pod nie dźwięku.
 *
 * PO CO. Suweren: „z wczorajszej generacji mam 5 filmów, które potrzebuję teraz
 * z sobą skleić i podłożyć dźwięk — a w zasadzie nie mam gdzie, bo w post-
 * produkcji też tego nie ma. Potrzebny mi taki moduł."
 *
 * Miał rację co do dziury. Kolejka kadrów skleja UJĘCIA jednego przebiegu,
 * Ciąg Dalszy dopisuje ujęcie do filmu — ale nie było miejsca, w którym bierze
 * się kilka GOTOWYCH filmów, układa w kolejności i kładzie pod nie muzykę.
 *
 * ⚠️ NIE DUBLUJEMY SKLEJANIA. Samo łączenie robi sprawdzony `CiagDalszy.sklej`
 * (kopia strumienia, gdy parametry pasują; przekodowanie, gdy nie). Tutaj jest
 * DRUGI KROK, którego nigdzie nie było: ścieżka dźwiękowa.
 *
 * ⚠️ MUZYKA KRÓTSZA NIŻ FILM ZAPĘTLA SIĘ, nie ucina filmu. Naiwne `-shortest`
 * przycięłoby pięciominutowy montaż do długości trzyminutowego utworu — i to
 * po cichu. `-stream_loop -1` na wejściu audio pilnuje, żeby to DŹWIĘK
 * dopasował się do obrazu.
 *
 * ⚠️ ORYGINAŁY ZOSTAJĄ NIETKNIĘTE. Montaż to nowy plik obok, nigdy nadpisanie
 * materiału źródłowego.
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { utworzProjekt } from './Produkcje.js';

const uruchom = promisify(execFile);

/** Rozszerzenia, które uznajemy za materiał filmowy. */
const WIDEO = /\.(mp4|mov|mkv|webm)$/i;
const AUDIO = /\.(wav|mp3|ogg|flac|m4a|aac)$/i;

/** Katalog montaży projektu — gotowe składanki lądują osobno od ujęć. */
export async function katalogMontazy(katalogKatedry, projekt) {
    const { sciezka } = await utworzProjekt(katalogKatedry, projekt);
    const kat = path.join(sciezka, 'montaz');
    await fs.mkdir(kat, { recursive: true });
    return kat;
}

/** Opis materiału: długość, format, czy MA JUŻ dźwięk. */
export async function opisz(plik) {
    const { stdout } = await uruchom(ffmpegPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1'), [
        '-v', 'error',
        '-show_entries', 'format=duration,size',
        '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate',
        '-of', 'json', plik,
    ]).catch(async () => {
        // ⚠️ `ffmpeg-static` nie wiezie ffprobe. Gdy go nie ma, długość
        // wyciągamy samym ffmpegiem — wolniej, ale bez dokładania zależności.
        const { stderr } = await uruchom(ffmpegPath, ['-i', plik, '-f', 'null', '-'], { maxBuffer: 8 * 1024 * 1024 })
            .catch((e) => ({ stderr: e.stderr ?? '' }));
        const m = String(stderr).match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        const sek = m ? (+m[1] * 3600 + +m[2] * 60 + parseFloat(m[3])) : null;
        const maAudio = /Stream #\d+:\d+.*Audio:/.test(String(stderr));
        const wym = String(stderr).match(/,\s*(\d{2,5})x(\d{2,5})/);
        return { stdout: JSON.stringify({ _zFfmpega: true, sek, maAudio, wym: wym ? [+wym[1], +wym[2]] : null }) };
    });

    const st = await fs.stat(plik);
    let d;
    try { d = JSON.parse(stdout); } catch { d = {}; }

    if (d._zFfmpega) {
        return {
            sciezka: plik, nazwa: path.basename(plik), bajtow: st.size,
            sekundy: d.sek ?? null, maAudio: Boolean(d.maAudio),
            szerokosc: d.wym?.[0] ?? null, wysokosc: d.wym?.[1] ?? null, fps: null,
        };
    }

    const strumienie = d.streams ?? [];
    const wideo = strumienie.find((s) => s.codec_type === 'video');
    const audio = strumienie.find((s) => s.codec_type === 'audio');
    const [licz, mian] = String(wideo?.r_frame_rate ?? '0/1').split('/').map(Number);

    return {
        sciezka: plik,
        nazwa: path.basename(plik),
        bajtow: st.size,
        sekundy: d.format?.duration ? Math.round(parseFloat(d.format.duration) * 10) / 10 : null,
        maAudio: Boolean(audio),
        kodekAudio: audio?.codec_name ?? null,
        szerokosc: wideo?.width ?? null,
        wysokosc: wideo?.height ?? null,
        fps: mian ? Math.round((licz / mian) * 100) / 100 : null,
    };
}

/**
 * Co w projekcie da się zmontować.
 *
 * ⚠️ NIE POKAZUJEMY WSZYSTKIEGO Z DYSKU. Bierzemy katalogi projektu (`ujecia`,
 * `montaz`, `odcinki`) — panel z setką dwusekundowych ujęć nie jest listą
 * materiału do montażu, tylko ścianą szumu. Krótsze niż `minSekund` odpadają.
 */
export async function materialy(katalogKatedry, projekt, { minSekund = 3 } = {}) {
    const { sciezka } = await utworzProjekt(katalogKatedry, projekt);
    const znalezione = [];

    for (const pod of ['ujecia', 'montaz', 'odcinki']) {
        const kat = path.join(sciezka, pod);
        let wpisy = [];
        try { wpisy = await fs.readdir(kat, { withFileTypes: true }); } catch { continue; }
        for (const w of wpisy) {
            if (w.isDirectory()) {
                // Odcinki bywają w podkatalogach — jeden poziom w głąb wystarczy.
                let glebiej = [];
                try { glebiej = await fs.readdir(path.join(kat, w.name)); } catch { continue; }
                for (const n of glebiej) if (WIDEO.test(n)) znalezione.push(path.join(kat, w.name, n));
                continue;
            }
            if (WIDEO.test(w.name)) znalezione.push(path.join(kat, w.name));
        }
    }

    const opisane = [];
    for (const p of znalezione) {
        try {
            const o = await opisz(p);
            if (o.sekundy === null || o.sekundy >= minSekund) opisane.push({ ...o, gdzie: path.basename(path.dirname(p)) });
        } catch { /* plik nie do odczytania — pomijamy, zamiast wywracać listę */ }
    }

    // Najdłuższe na górze: to zwykle gotowe filmy, a nie pojedyncze ujęcia.
    opisane.sort((a, b) => (b.sekundy ?? 0) - (a.sekundy ?? 0));
    return opisane;
}

/**
 * Utwory z biblioteki Katedry, którymi da się podłożyć dźwięk.
 *
 * ⚠️ SCHODZIMY W PODKATALOGI. Pierwsza wersja czytała tylko wierzch katalogu
 * i pokazywała 5 utworów, podczas gdy biblioteka ma ich 190 — reszta leży
 * w podkatalogach. Lista, która pokazuje 3% zbioru, jest gorsza niż żadna,
 * bo wygląda na kompletną.
 */
export async function utwory(katalogMuzyki, { maxGlebokosc = 3 } = {}) {
    const lista = [];

    async function chodz(kat, glebokosc) {
        if (glebokosc > maxGlebokosc) return;
        let wpisy = [];
        try { wpisy = await fs.readdir(kat, { withFileTypes: true }); } catch { return; }
        for (const w of wpisy) {
            const p = path.join(kat, w.name);
            if (w.isDirectory()) { await chodz(p, glebokosc + 1); continue; }
            if (!AUDIO.test(w.name)) continue;
            try {
                const st = await fs.stat(p);
                lista.push({
                    nazwa: w.name,
                    // Podkatalog w etykiecie — dwa pliki o tej samej nazwie w różnych
                    // folderach nie mogą być nie do odróżnienia na liście.
                    gdzie: path.relative(katalogMuzyki, path.dirname(p)) || '.',
                    sciezka: p, bajtow: st.size,
                });
            } catch { /* zniknal w trakcie */ }
        }
    }

    await chodz(katalogMuzyki, 0);
    return lista.sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
}

/**
 * Podłóż ścieżkę dźwiękową pod gotowy film.
 *
 * @param glosnosc  0..2 — 1 to oryginalna głośność utworu.
 * @param zanikanie sekundy wyciszenia na końcu; 0 wyłącza.
 *
 * ⚠️ OBRAZ KOPIUJEMY (`-c:v copy`). Przekodowanie pięciominutowego montażu
 * tylko po to, żeby dołożyć dźwięk, to kilka minut pracy i strata jakości bez
 * żadnego powodu.
 */
export async function podlozDzwiek({ film, muzyka, wyjscie, glosnosc = 0.35, zanikanie = 3 }) {
    const opis = await opisz(film);
    const dlugosc = opis.sekundy ?? 0;
    if (!dlugosc) throw new Error(`Nie umiem odczytać długości filmu „${path.basename(film)}".`);

    const g = Math.max(0, Math.min(Number(glosnosc) || 0, 2));
    const filtry = [`volume=${g}`];
    const z = Math.max(0, Math.min(Number(zanikanie) || 0, dlugosc / 2));
    if (z > 0) filtry.push(`afade=t=out:st=${Math.max(0, dlugosc - z).toFixed(2)}:d=${z.toFixed(2)}`);

    await fs.mkdir(path.dirname(wyjscie), { recursive: true });

    const args = [
        '-i', film,
        // ⚠️ Pętla na WEJŚCIU audio: krótszy utwór ma się powtórzyć, a nie
        // przyciąć filmu. `-shortest` niżej kończy wtedy na długości obrazu.
        '-stream_loop', '-1', '-i', muzyka,
        '-filter:a', filtry.join(','),
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', '-y', wyjscie,
    ];
    await uruchom(ffmpegPath, args, { maxBuffer: 16 * 1024 * 1024 });

    const wynik = await opisz(wyjscie);
    if (!wynik.maAudio) throw new Error('ffmpeg skończył bez błędu, ale w pliku nie ma ścieżki audio.');
    return {
        plik: wyjscie,
        sekundy: wynik.sekundy,
        bajtow: wynik.bajtow,
        obraz: 'skopiowany bez przekodowania',
        dzwiek: `${path.basename(muzyka)} · głośność ${g}${z > 0 ? ` · wyciszenie ${z}s` : ''}`,
        zapetlony: (opis.sekundy ?? 0) > 0,
    };
}

/**
 * Cały montaż w jednym kroku: sklej wskazane filmy, potem (opcjonalnie) podłóż
 * dźwięk. `sklejaczem` wstrzykujemy `CiagDalszy.sklej` — ta sama, sprawdzona
 * droga co w kolejce kadrów, zamiast drugiej implementacji obok.
 */
export async function zloz({ pliki, muzyka = null, glosnosc, zanikanie, katalog, nazwa = 'montaz', sklejaczem, comfyDir }) {
    if (!Array.isArray(pliki) || pliki.length < 1) throw new Error('Wskaż przynajmniej jeden film.');
    await fs.mkdir(katalog, { recursive: true });

    const znacznik = Date.now().toString(36);
    const bezpieczna = String(nazwa).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'montaz';

    let zlozony;
    let jakSklejono = null;
    if (pliki.length === 1) {
        // Jeden film — nie ma czego sklejać, ale dźwięk nadal ma sens.
        zlozony = pliki[0];
    } else {
        const cel = path.join(katalog, `${bezpieczna}_${znacznik}_bezdzwieku.mp4`);
        const r = await sklejaczem({ pliki, wyjscie: cel, comfyDir });
        zlozony = r.plik ?? cel;
        jakSklejono = r.metoda ?? null;
    }

    if (!muzyka) {
        const o = await opisz(zlozony);
        return { plik: zlozony, sekundy: o.sekundy, bajtow: o.bajtow, sklejka: jakSklejono, dzwiek: null };
    }

    const zDzwiekiem = path.join(katalog, `${bezpieczna}_${znacznik}.mp4`);
    const d = await podlozDzwiek({ film: zlozony, muzyka, wyjscie: zDzwiekiem, glosnosc, zanikanie });
    return { plik: d.plik, sekundy: d.sekundy, bajtow: d.bajtow, sklejka: jakSklejono, dzwiek: d.dzwiek, bezDzwieku: pliki.length > 1 ? zlozony : null };
}

export default { katalogMontazy, opisz, materialy, utwory, podlozDzwiek, zloz };
