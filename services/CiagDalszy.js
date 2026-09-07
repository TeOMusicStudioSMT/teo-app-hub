/**
 * 🎞️ CiągDalszy — dopisywanie ujęć do WŁOŻONEGO filmu i sklejanie ich w całość.
 *
 * PO CO. Suweren: „moduł, który umożliwi dokańczanie fragmentów, będzie się
 * wzorował na włożonym filmie i pozwoli robić łączenia, dokładając sceny".
 *
 * JAK TO NAPRAWDĘ DZIAŁA — bez owijania:
 *   1. Z włożonego filmu wyjmujemy OSTATNIĄ KLATKĘ (ffmpeg).
 *   2. Ta klatka wchodzi do Wan 2.2 jako `start_image`, więc nowe ujęcie
 *      zaczyna się dokładnie tam, gdzie tamto się skończyło.
 *   3. Rozdzielczość i fps bierzemy Z FILMU, nie z ustawień domyślnych —
 *      inaczej sklejka miałaby skok formatu w połowie.
 *   4. Sklejanie robi ffmpeg: kopią strumienia, gdy parametry się zgadzają,
 *      przekodowaniem, gdy nie. Zawsze mówimy, którą drogą poszło.
 *
 * ⚠️ CZEGO TO NIE ROBI, ŻEBY NIE BYŁO ROZCZAROWANIA. Model NIE ogląda całego
 * filmu i nie uczy się jego stylu. „Wzoruje się" znaczy tu: startuje z jego
 * ostatniej klatki, w jego rozdzielczości i jego tempie. Spójność postaci
 * i światła bierze się z tej klatki — i tyle. Dłuższą ciągłość buduje się
 * łańcuchem: ujęcie → jego ostatnia klatka → następne ujęcie.
 *
 * ⚠️ ŚCIEŻKI SĄ NA SMYCZY. Nazwa pliku przychodzi z przeglądarki, a most bywa
 * wystawiony przez Kwantowy Tunel. Każda ścieżka musi rozwiązać się WEWNĄTRZ
 * jednego z korzeni — inaczej `../../.ssh/id_rsa` byłby „filmem do sklejenia".
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const uruchom = promisify(execFile);

const ROZSZERZENIA = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);
const MAX_GLEBOKOSC = 4;
const MAX_PLIKOW = 300;

/** Korzenie, w których wolno szukać i zapisywać. Reszta świata jest poza zasięgiem. */
export function korzenie(comfyDir) {
    const k = [
        path.join(process.cwd(), '_OtakOs_Wymiar', 'produkcje'),
        path.join(process.cwd(), '_OtakOs_Move'),
    ];
    if (comfyDir) k.unshift(path.join(comfyDir, 'ComfyUI', 'output'));
    return k;
}

/**
 * Ścieżka wewnątrz któregoś korzenia albo wyjątek.
 * ⚠️ Porównujemy PO `path.resolve` i z separatorem na końcu korzenia —
 * samo `startsWith` przepuściłoby `…/produkcje-cudze`.
 */
export function bezpieczna(p, comfyDir) {
    const pelna = path.resolve(String(p || ''));
    for (const k of korzenie(comfyDir)) {
        const korzen = path.resolve(k);
        if (pelna === korzen || pelna.startsWith(korzen + path.sep)) return pelna;
    }
    throw new Error(`Ścieżka poza dozwolonymi katalogami: ${p}`);
}

async function zbierz(katalog, glebokosc, wynik) {
    if (glebokosc > MAX_GLEBOKOSC || wynik.length >= MAX_PLIKOW) return;
    let wpisy;
    try { wpisy = await fs.readdir(katalog, { withFileTypes: true }); } catch { return; }
    for (const w of wpisy) {
        if (wynik.length >= MAX_PLIKOW) return;
        const pelna = path.join(katalog, w.name);
        if (w.isDirectory()) { await zbierz(pelna, glebokosc + 1, wynik); continue; }
        if (!ROZSZERZENIA.has(path.extname(w.name).toLowerCase())) continue;
        try {
            const st = await fs.stat(pelna);
            wynik.push({ nazwa: w.name, sciezka: pelna, bajtow: st.size, kiedy: st.mtimeMs });
        } catch { /* plik zniknął w trakcie */ }
    }
}

/** Filmy, które da się wziąć na warsztat. Najnowsze pierwsze. */
export async function listaFilmow(comfyDir) {
    const wynik = [];
    for (const k of korzenie(comfyDir)) await zbierz(k, 0, wynik);
    return wynik.sort((a, b) => b.kiedy - a.kiedy);
}

/** Metryka filmu z ffprobe. Bez niej nie da się dopisać ujęcia „w tym samym formacie". */
export async function opisFilmu(plik, comfyDir) {
    const p = bezpieczna(plik, comfyDir);
    const { stdout } = await uruchom(ffprobe.path, [
        '-v', 'error', '-print_format', 'json',
        '-show_streams', '-show_format', p,
    ], { maxBuffer: 4 * 1024 * 1024 });

    const d = JSON.parse(stdout);
    const obraz = (d.streams || []).find((s) => s.codec_type === 'video');
    if (!obraz) throw new Error(`W pliku ${path.basename(p)} nie ma ścieżki obrazu.`);

    // fps przychodzi ułamkiem („24/1"), nie liczbą.
    const [licz, mian] = String(obraz.r_frame_rate || '24/1').split('/').map(Number);
    const fps = mian ? licz / mian : 24;

    return {
        sciezka: p,
        nazwa: path.basename(p),
        kodek: obraz.codec_name,
        szerokosc: Number(obraz.width) || 0,
        wysokosc: Number(obraz.height) || 0,
        fps: Math.round(fps * 100) / 100,
        klatek: Number(obraz.nb_frames) || null,
        sekundy: Math.round((Number(d.format?.duration) || 0) * 100) / 100,
        bajtow: Number(d.format?.size) || 0,
        dzwiek: (d.streams || []).some((s) => s.codec_type === 'audio'),
    };
}

/**
 * Wyjmij ostatnią klatkę do katalogu wejściowego ComfyUI.
 *
 * ⚠️ `-sseof -0.2` szuka od KOŃCA. Wersja z `-ss <czas trwania>` wypadała poza
 * materiał i zapisywała czarną klatkę — model dostawał wtedy czerń jako punkt
 * startowy i „ciąg dalszy" zaczynał się od zaciemnienia.
 */
export async function ostatniaKlatka(plik, comfyDir) {
    const p = bezpieczna(plik, comfyDir);
    if (!comfyDir) throw new Error('Nie znam katalogu ComfyUI — nie mam gdzie odłożyć klatki.');
    const katalogWejscia = path.join(comfyDir, 'ComfyUI', 'input');
    await fs.mkdir(katalogWejscia, { recursive: true });

    const nazwa = `ciag_${path.basename(p, path.extname(p)).slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now().toString(36)}.png`;
    const wyjscie = path.join(katalogWejscia, nazwa);

    await uruchom(ffmpegPath, [
        '-sseof', '-0.2', '-i', p,
        '-update', '1', '-frames:v', '1', '-y', wyjscie,
    ], { maxBuffer: 8 * 1024 * 1024 });

    const st = await fs.stat(wyjscie);
    if (!st.size) throw new Error('ffmpeg zapisał pustą klatkę — plik może być uszkodzony.');
    return { nazwa, sciezka: wyjscie, bajtow: st.size };
}

/**
 * Klatka z DOWOLNEGO momentu — dla ujęć z drugiej kamery.
 *
 * ⚠️ `-ss` PRZED `-i`. Po `-i` ffmpeg dekoduje cały materiał do wskazanego
 * miejsca: przy 135-megabajtowym pliku to kilkanaście sekund czekania zamiast
 * ułamka. Przed `-i` skacze po kluczowych klatkach i wraca od razu.
 *
 * ⚠️ Sekunda poza materiałem daje pusty plik i cichy błąd „nie ma klatki",
 * więc przycinamy ją do długości filmu, zanim ffmpeg się zdziwi.
 */
export async function klatkaZCzasu(plik, sekunda, comfyDir) {
    const p = bezpieczna(plik, comfyDir);
    if (!comfyDir) throw new Error('Nie znam katalogu ComfyUI — nie mam gdzie odłożyć klatki.');

    const opis = await opisFilmu(p, comfyDir);
    const s = Math.max(0, Math.min(Number(sekunda) || 0, Math.max(0, opis.sekundy - 0.1)));

    const katalogWejscia = path.join(comfyDir, 'ComfyUI', 'input');
    await fs.mkdir(katalogWejscia, { recursive: true });
    const nazwa = `kam_${path.basename(p, path.extname(p)).slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_')}_${s.toFixed(2).replace('.', 'p')}_${Date.now().toString(36)}.png`;
    const wyjscie = path.join(katalogWejscia, nazwa);

    await uruchom(ffmpegPath, [
        '-ss', String(s), '-i', p,
        '-update', '1', '-frames:v', '1', '-y', wyjscie,
    ], { maxBuffer: 8 * 1024 * 1024 });

    const st = await fs.stat(wyjscie);
    if (!st.size) throw new Error(`ffmpeg nie wyjął klatki z sekundy ${s} pliku ${opis.nazwa}.`);
    return { nazwa, sciezka: wyjscie, bajtow: st.size, sekunda: s, zrodlo: opis };
}

/** Czy dwa opisy da się skleić bez przekodowania. */
function zgodne(a, b) {
    return a.kodek === b.kodek
        && a.szerokosc === b.szerokosc
        && a.wysokosc === b.wysokosc
        && Math.abs(a.fps - b.fps) < 0.01
        && a.dzwiek === b.dzwiek;
}

/**
 * Sklej ujęcia w jeden plik.
 *
 * ⚠️ Dwie drogi i mówimy, którą poszliśmy. Kopia strumienia (`-c copy`) jest
 * natychmiastowa i bezstratna, ale WYMAGA identycznych parametrów — przy
 * różnych ffmpeg produkuje plik, który się „psuje" dopiero w połowie
 * odtwarzania. Gdy parametry się różnią, przekodowujemy i to widać w wyniku.
 */
export async function sklej({ pliki, wyjscie, comfyDir }) {
    if (!Array.isArray(pliki) || pliki.length < 2) {
        throw new Error('Do sklejenia potrzeba co najmniej dwóch ujęć.');
    }
    const opisy = [];
    for (const p of pliki) opisy.push(await opisFilmu(p, comfyDir));

    const wszystkieZgodne = opisy.every((o) => zgodne(o, opisy[0]));
    const cel = bezpieczna(wyjscie, comfyDir);
    await fs.mkdir(path.dirname(cel), { recursive: true });

    // Lista dla demuxera concat. Apostrofy w nazwach trzeba uciec, inaczej
    // ffmpeg rozjedzie się na pierwszym pliku „Ala's scena.mp4".
    const lista = path.join(path.dirname(cel), `.concat_${Date.now().toString(36)}.txt`);
    await fs.writeFile(
        lista,
        opisy.map((o) => `file '${o.sciezka.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
        'utf8',
    );

    const wspolne = ['-f', 'concat', '-safe', '0', '-i', lista];
    const args = wszystkieZgodne
        ? [...wspolne, '-c', 'copy', '-y', cel]
        : [...wspolne, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
            '-pix_fmt', 'yuv420p', '-r', String(opisy[0].fps), '-y', cel];

    try {
        await uruchom(ffmpegPath, args, { maxBuffer: 16 * 1024 * 1024 });
    } finally {
        await fs.rm(lista, { force: true });
    }

    const wynikowy = await opisFilmu(cel, comfyDir);
    return {
        plik: cel,
        metoda: wszystkieZgodne ? 'kopia strumienia (bezstratnie)' : 'przekodowanie (parametry ujęć się różniły)',
        zrodla: opisy.map((o) => ({ nazwa: o.nazwa, sekundy: o.sekundy, format: `${o.szerokosc}x${o.wysokosc}@${o.fps}` })),
        wynik: wynikowy,
    };
}

export default { korzenie, bezpieczna, listaFilmow, opisFilmu, ostatniaKlatka, klatkaZCzasu, sklej };
