/**
 * ✂️ PostProdukcja — poprawianie gotowego odcinka i dokładanie muzyki.
 *
 * PO CO. Suweren: „prosty edytor końcowy odcinka, gdzie można zaznaczyć
 * fragment i wpisać, by wygenerował poprawione" oraz „dodawanie muzyki
 * i jej fragmentów".
 *
 * DWIE OPERACJE, OBIE PRZEZ FFMPEG I OBIE NIEODWRACALNE INACZEJ NIŻ Z KOPII:
 *
 *   PODMIANA FRAGMENTU — tniemy materiał na trzy części (przed, fragment, po),
 *   nowy fragment liczy Wan startując z KLATKI TUŻ PRZED cięciem, a potem
 *   sklejamy przed + nowe + po.
 *
 *   MUZYKA — ścieżka dźwiękowa wchodzi z podanego momentu, z podaną głośnością
 *   i opcjonalnym wyciszeniem na końcu.
 *
 * ⚠️ SZEW NA KOŃCU PODMIANY JEST NIEUNIKNIONY I MÓWIMY O NIM WPROST.
 * Nowy fragment zaczyna się od właściwej klatki (więc początek zgrywa się
 * gładko), ale JEGO KONIEC nie wie nic o pierwszej klatce części „po" —
 * model nie zna przyszłości. Przy cięciu w ruchu widać przeskok. Dlatego
 * najlepiej podmieniać fragmenty kończące się na naturalnym cięciu.
 *
 * ⚠️ NIGDY NIE NADPISUJEMY ORYGINAŁU. Wynik to nowy plik z sufiksem; stary
 * zostaje. Materiał, nad którym ktoś pracował godzinami, nie może zniknąć
 * przez jedno kliknięcie „popraw".
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { bezpieczna, opisFilmu } from './CiagDalszy.js';

const uruchom = promisify(execFile);
const MAX_BUF = 16 * 1024 * 1024;

/** Nazwa wyniku: obok oryginału, z sufiksem i znacznikiem czasu. */
function nazwaWyniku(zrodlo, sufiks) {
    const kat = path.dirname(zrodlo);
    const baza = path.basename(zrodlo, path.extname(zrodlo)).slice(0, 50);
    return path.join(kat, `${baza}_${sufiks}_${Date.now().toString(36)}.mp4`);
}

/**
 * Wytnij kawałek materiału do osobnego pliku.
 * ⚠️ `-ss` przed `-i` (szybkie szukanie), ale przy CIĘCIU przekodowujemy:
 * kopia strumienia tnie tylko na klatkach kluczowych, więc „od 3,2 s"
 * zamieniłoby się w „od 2,0 s" i fragment nie trafiłby tam, gdzie trzeba.
 */
async function wytnij(zrodlo, od, doCzasu, cel) {
    const args = ['-ss', String(od)];
    if (doCzasu != null) args.push('-to', String(doCzasu));
    args.push('-i', zrodlo, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-an', '-y', cel);
    await uruchom(ffmpegPath, args, { maxBuffer: MAX_BUF });
    return cel;
}

/** Sklej listę plików demuxerem concat (wszystkie mają ten sam format). */
async function sklejCzesci(pliki, cel) {
    const lista = path.join(path.dirname(cel), `.pp_${Date.now().toString(36)}.txt`);
    await fs.writeFile(
        lista,
        pliki.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
        'utf8',
    );
    try {
        await uruchom(ffmpegPath, [
            '-f', 'concat', '-safe', '0', '-i', lista,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-y', cel,
        ], { maxBuffer: MAX_BUF });
    } finally {
        await fs.rm(lista, { force: true });
    }
    return cel;
}

/**
 * Przygotuj podmianę fragmentu: policz granice i wyjmij klatkę startową.
 * Samą generacją zajmuje się Wideo.dopiszUjecie — tu tylko przygotowanie,
 * żeby ten plik nie musiał znać ComfyUI.
 */
export async function przygotujPodmiane({ plik, od, doCzasu, comfyDir }) {
    const p = bezpieczna(plik, comfyDir);
    const opis = await opisFilmu(p, comfyDir);

    const start = Math.max(0, Number(od) || 0);
    const koniec = Math.min(Number(doCzasu) || 0, opis.sekundy);
    if (!(koniec > start)) throw new Error(`Zły zakres: od ${start} s do ${koniec} s.`);
    if (koniec - start < 0.5) throw new Error('Fragment krótszy niż pół sekundy — nie ma czego podmieniać.');
    if (start < 0.2) {
        throw new Error('Fragment od samego początku nie ma z czego wystartować — model potrzebuje klatki SPRZED cięcia. Zacznij od 0,2 s wzwyż.');
    }

    // Klatka tuż PRZED cięciem — od niej ruszy nowy fragment.
    const { klatkaZCzasu } = await import('./CiagDalszy.js');
    const klatka = await klatkaZCzasu(p, Math.max(0, start - 0.05), comfyDir);

    return {
        zrodlo: p, opis, start, koniec,
        dlugoscFragmentu: Math.round((koniec - start) * 100) / 100,
        // Ile klatek ma mieć nowy fragment. Wan liczy w klatkach, nie w sekundach.
        klatek: Math.max(17, Math.round((koniec - start) * opis.fps)),
        klatka,
    };
}

/**
 * Wstaw wygenerowany fragment w miejsce starego.
 * `nowyFragment` to plik z ComfyUI; reszta to cięcie i sklejenie.
 */
export async function wstawFragment({ zrodlo, nowyFragment, start, koniec, comfyDir }) {
    const p = bezpieczna(zrodlo, comfyDir);
    const nowy = bezpieczna(nowyFragment, comfyDir);
    const opis = await opisFilmu(p, comfyDir);

    const kat = path.dirname(p);
    const przed = path.join(kat, `.pp_przed_${Date.now().toString(36)}.mp4`);
    const po = path.join(kat, `.pp_po_${Date.now().toString(36)}.mp4`);
    const czesci = [];

    try {
        if (start > 0.05) { await wytnij(p, 0, start, przed); czesci.push(przed); }
        czesci.push(nowy);
        if (koniec < opis.sekundy - 0.05) { await wytnij(p, koniec, null, po); czesci.push(po); }

        if (czesci.length < 2) throw new Error('Podmiana objęłaby cały materiał — to nie poprawka, tylko nowy film.');

        const cel = nazwaWyniku(p, 'poprawka');
        await sklejCzesci(czesci, cel);
        const wynik = await opisFilmu(cel, comfyDir);

        return {
            plik: cel,
            wynik,
            // Uczciwie: gdzie szukać szwu.
            szew: Math.round(koniec * 100) / 100,
            uwaga: 'Koniec podmienionego fragmentu nie zna pierwszej klatki dalszej części — przy cięciu w ruchu widać przeskok. Oryginał został nietknięty.',
            oryginal: p,
        };
    } finally {
        // Kawałki robocze znikają zawsze, także po błędzie.
        await fs.rm(przed, { force: true });
        await fs.rm(po, { force: true });
    }
}

/**
 * Dołóż muzykę do odcinka.
 *
 * @param {number} odSekundy  moment w FILMIE, w którym muzyka wchodzi
 * @param {number} odUtworu   moment w UTWORZE, od którego gra
 * @param {number} glosnosc   0.0-2.0 (1.0 = bez zmiany)
 * @param {number} wyciszenie sekundy fade-out na końcu (0 = brak)
 *
 * ⚠️ Gdy film MA już dźwięk, miksujemy (`amix`), a nie podmieniamy. Ciche
 * skasowanie oryginalnej ścieżki dialogowej to najgorszy możliwy skutek
 * uboczny „dodania muzyki".
 */
export async function dodajMuzyke({ plik, utwor, odSekundy = 0, odUtworu = 0, glosnosc = 0.6, wyciszenie = 2, comfyDir }) {
    const p = bezpieczna(plik, comfyDir);
    const opis = await opisFilmu(p, comfyDir);
    try { await fs.access(utwor); } catch { throw new Error(`Nie widzę utworu: ${utwor}`); }

    const wejscie = Math.max(0, Number(odSekundy) || 0);
    const odU = Math.max(0, Number(odUtworu) || 0);
    const gain = Math.min(2, Math.max(0, Number(glosnosc)));
    const fade = Math.max(0, Number(wyciszenie) || 0);

    // Muzyka gra od `wejscie` do końca filmu.
    const graPrzez = Math.max(0.5, opis.sekundy - wejscie);
    const filtry = [
        `[1:a]atrim=start=${odU},asetpts=PTS-STARTPTS`,
        `atrim=duration=${graPrzez.toFixed(2)}`,
        `volume=${gain.toFixed(2)}`,
        fade > 0 ? `afade=t=out:st=${Math.max(0, graPrzez - fade).toFixed(2)}:d=${fade}` : null,
        `adelay=${Math.round(wejscie * 1000)}|${Math.round(wejscie * 1000)}[muz]`,
    ].filter(Boolean).join(',');

    const cel = nazwaWyniku(p, 'muzyka');
    const args = ['-i', p, '-i', utwor];

    if (opis.dzwiek) {
        // Film ma dźwięk — MIKSUJEMY, nie podmieniamy.
        args.push('-filter_complex', `${filtry};[0:a][muz]amix=inputs=2:duration=first:dropout_transition=0[out]`,
            '-map', '0:v', '-map', '[out]');
    } else {
        args.push('-filter_complex', filtry, '-map', '0:v', '-map', '[muz]');
    }
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-y', cel);

    await uruchom(ffmpegPath, args, { maxBuffer: MAX_BUF });
    const wynik = await opisFilmu(cel, comfyDir);

    return {
        plik: cel,
        wynik,
        miks: opis.dzwiek ? 'zmiksowane z istniejącym dźwiękiem' : 'muzyka jako jedyna ścieżka',
        oryginal: p,
        ustawienia: { odSekundy: wejscie, odUtworu: odU, glosnosc: gain, wyciszenie: fade },
    };
}

export default { przygotujPodmiane, wstawFragment, dodajMuzyke };
