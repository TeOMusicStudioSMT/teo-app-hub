/**
 * 🧱 Spawacz — sklejanie RÓŻNYCH filmów w jeden: klocki (Start / Add / End, 1920×1080, z dźwiękiem)
 * z materiałem projektu (np. 960×544, często bez dźwięku) — 2026-10-03.
 *
 * Suweren: „dodaj do TeO Story Studio w post-produkcji, w montażowni, te narzędzia do dodawania klocków…
 * i wtedy montaż to wszystko skleja… etap może też być pod spodem… po tym jest finalnym produktem”.
 *
 * Dlaczego osobno od `CiagDalszy.sklej`: tamten łączy demuxerem concat — dobry dla ujęć JEDNEGO przebiegu
 * (ten sam rozmiar, ta sama ścieżka audio). Klocki mają inny rozmiar i klatkaż, a materiał bywa bez
 * dźwięku — concat albo się wywraca, albo rozjeżdża obraz z dźwiękiem. Tu KAŻDY klip jest wyrównany
 * filtrem (scale+pad do celu, fps, setsar), a klip bez dźwięku dostaje ciszę tej samej długości —
 * dopiero potem `concat` filtrem. Ta sama zasada, co w akcji CONCATENATE_VIDEO Wiesio-Spawacza.
 *
 * Oryginały zostają; wynik to nowy plik.
 */
import fs from 'fs/promises';
import path from 'path';

export const WIDEO = /\.(mp4|mov|webm|m4v|mkv)$/i;

/** Filtr wyrównania: [i:v] → scale/pad/fps; [i:a] albo cisza (anullsrc przycięty do długości klipu). */
export function filtrSpawania(klipy, { W, H, fps }) {
    if (!Array.isArray(klipy) || klipy.length < 1) throw new Error('Nie ma czego spawać.');
    if (W % 2 || H % 2) throw new Error('Wymiary celu muszą być parzyste (libx264).');
    const fc = [];
    klipy.forEach((k, i) => {
        fc.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setsar=1,format=yuv420p[v${i}]`);
        if (k.maAudio) fc.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`);
        else fc.push(`anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${Math.max(0.1, Number(k.sekundy) || 0.1)}[a${i}]`);
    });
    const wejscia = klipy.map((_, i) => `[v${i}][a${i}]`).join('');
    return `${fc.join(';')};${wejscia}concat=n=${klipy.length}:v=1:a=1[outv][outa]`;
}

/**
 * Cel wyrównania: rozmiar i klatkaż WSKAZANEGO klipu (zwykle materiału — klocki mają się dopasować do
 * filmu, nie film do klocków), parzyste wymiary, rozsądny fps.
 */
export function celSpawania(opis) {
    let W = Number(opis?.szerokosc) || 1920, H = Number(opis?.wysokosc) || 1080;
    if (W % 2) W += 1;
    if (H % 2) H += 1;
    const fps = Math.min(60, Math.max(12, Math.round(Number(opis?.fps) || 30)));
    return { W, H, fps };
}

/**
 * @param {{ klipy:string[], wyjscie:string, opisz:(p:string)=>Promise<{sekundy:number|null, maAudio:boolean, szerokosc:number|null, wysokosc:number|null, fps:number|null}>,
 *           uruchom:(bin:string, args:string[], opcje?:object)=>Promise<any>, ffmpeg:string, celWedlug?:number }} o
 *   celWedlug = indeks klipu, którego rozmiar i fps są celem (domyślnie pierwszy, który NIE jest klockiem — podaje wołający)
 */
export async function spawaj({ klipy, wyjscie, opisz, uruchom, ffmpeg, celWedlug = 0 }) {
    if (!Array.isArray(klipy) || klipy.length < 1) throw new Error('Nie ma czego spawać.');
    const opisy = [];
    for (const k of klipy) {
        const o = await opisz(k);
        if (!o) throw new Error(`Nie odczytałem pliku: ${path.basename(k)}`);
        opisy.push({ ...o, sciezka: k });
    }
    const cel = celSpawania(opisy[Math.min(Math.max(0, celWedlug), opisy.length - 1)]);
    const filtr = filtrSpawania(opisy, cel);
    await fs.mkdir(path.dirname(wyjscie), { recursive: true });
    await uruchom(ffmpeg, [
        ...klipy.flatMap((k) => ['-i', k]),
        '-filter_complex', filtr, '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', wyjscie,
    ], { maxBuffer: 64 * 1024 * 1024, timeout: 0, windowsHide: true });
    return {
        plik: wyjscie,
        metoda: `spawanie z wyrównaniem do ${cel.W}×${cel.H}@${cel.fps} (klocki + materiał)`,
        zrodla: opisy.map((o) => ({ nazwa: path.basename(o.sciezka), sekundy: o.sekundy, format: `${o.szerokosc}x${o.wysokosc}@${o.fps}`, dzwiek: o.maAudio })),
        pominiete: [],
    };
}

/** Zestaw klocków formatu: Start → Add/Adds → End (pliki wideo, alfabetycznie w każdym katalogu). */
export async function zestawKlockow(katalogKlocki, format) {
    const PODKATALOG = { YT: 'Klocki do YT', Podcat: 'Klocki do Podcatów', Kronika: 'Klocki do Kronik', Muzyka: 'Klocki do Muzyki', Movie: 'Klocki do Movie' };
    const pod = PODKATALOG[format];
    if (!pod) throw new Error(`Nieznany format klocków „${format}” (${Object.keys(PODKATALOG).join(' / ')}).`);
    const baza = path.join(katalogKlocki, pod);
    const czytaj = async (...czesci) => (await fs.readdir(path.join(baza, ...czesci)).catch(() => []))
        .filter((f) => WIDEO.test(f)).sort((a, b) => a.localeCompare(b)).map((f) => path.join(baza, ...czesci, f));
    return { katalog: baza, start: await czytaj('Start'), add: [...await czytaj('Adds'), ...await czytaj('Add')], end: await czytaj('End') };
}

export default { filtrSpawania, celSpawania, spawaj, zestawKlockow, WIDEO };
