/**
 * 🎙️ Głos ze stemu (2026-10-03) — Suweren: „pobieram paczkę sampli z tego utworu, o którym będą rozmawiać…
 * zapisuję w `_OtakOs_Muzyka/_Stemy`… by Aktor miał głosy, no i sama Katedra”.
 *
 * `_OtakOs_Muzyka/_Stemy` to ten sam katalog, do którego Demucs (`/api/stemy/rozdziel`) zapisuje swoje
 * stemy — paczki z Suno („Lead Vocal”, „Backing Vocals”, …) wypakowane tam trafiają w to samo miejsce.
 *
 * Z wokalu robimy PRÓBKĘ KLONU dla toru `klon-lokalny` (XTTS / OpenVoice na :5002):
 *   wycinek od–do → górnoprzepustowy 80 Hz → wycięcie przerw dłuższych niż 0,4 s (instrumentalne wstawki
 *   w stemie wokalu to cisza) → mono 22 050 Hz (jak `/api/voice/clone`) → `_OtakOs_AI/voices/<id>.wav`
 *   + profil głosu, który można dać Aktorowi.
 * Uczciwie: to głos ŚPIEWANY — klon mówi barwą wokalisty, ale z mowy wychodzi lepszy niż ze śpiewu.
 * Za mało materiału po wycięciu ciszy (< 6 s) = błąd wprost, nie zła próbka.
 *
 * Podkład wywiadu: instrumental (albo cały utwór) pod rozmową, cicho, z wyciszeniem na końcu.
 */
import fs from 'fs/promises';
import path from 'path';

export const AUDIO = /\.(wav|mp3|flac|ogg|m4a|aac|opus)$/i;
export const MIN_SEKUND = 6, MAX_SEKUND = 30;

/**
 * 🎚️ Sampler głosu (2026-10-05) — Suweren: „mam taki filmik zrzut ekranu… opcja nagrywania samego wave na głos
 * aktora… nie widzę takiej opcji samplowania”. Do `_Stemy` trafiały tylko paczki stemów; teraz próbką może być
 * DOWOLNY plik z dźwiękiem (nagranie ekranu mp4, wideo, mp3, dyktafon) albo nagranie z mikrofonu w przeglądarce.
 * Każdy zamieniamy na WAV 44,1 kHz stereo (wspólny język: odsłuch w przeglądarce, Demucs, wycinek klonu)
 * w `_Stemy/_Probki` — tam stoi jak każdy stem, więc Demucs może z niego wyjąć sam wokal.
 */
export const KATALOG_PROBEK = '_Probki';
export const WGRYWALNE = /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus|wma|mp4|m4v|mov|webm|mkv|avi|3gp)$/i;
export const MAX_BAJTOW_PROBKI = 300 * 1024 * 1024;

/** Nazwa próbki: z pliku albo podana, bezpieczna dla Windows, zawsze `.wav`. */
export function nazwaProbki(nazwa) {
    const baza = String(nazwa ?? '').split(/[\\/]/).pop().replace(/\.[a-z0-9]{1,5}$/i, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
        .replace(/[^A-Za-z0-9 _.-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 60).trim();
    return `${baza || 'probka'}.wav`;
}

/** Argumenty ffmpeg: cokolwiek z dźwiękiem → WAV 44,1 kHz stereo (pierwsza ścieżka dźwięku, obraz pominięty). */
export function argumentyWgrania({ wejscie, wyjscie }) {
    return ['-y', '-i', wejscie, '-vn', '-map', '0:a:0', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', wyjscie];
}

/** Argumenty ffmpeg: dźwięk → surowe próbki do rysowania fali (mono 4 kHz, 16 bit, max `maxSekund`). */
export const HZ_FALI = 4000;
export function argumentyFali({ wejscie, maxSekund = 900 }) {
    return ['-v', 'error', '-t', String(maxSekund), '-i', wejscie, '-vn', '-ac', '1', '-ar', String(HZ_FALI), '-f', 's16le', '-'];
}

/** Surowe s16le → `n` szczytów 0–1 (maks. |próbka| w każdym przedziale). Czysta — do testów. */
export function szczytyFali(bufor, n = 600) {
    const probek = Math.floor((bufor?.length ?? 0) / 2);
    const ile = Math.max(1, Math.min(Number(n) || 600, 4000));
    if (!probek) return { szczyty: [], sekundy: 0 };
    const szczyty = new Array(ile).fill(0);
    for (let k = 0; k < ile; k++) {
        const a = Math.floor((k * probek) / ile), b = Math.max(a + 1, Math.floor(((k + 1) * probek) / ile));
        let m = 0;
        for (let i = a; i < b && i < probek; i++) { const v = Math.abs(bufor.readInt16LE(i * 2)); if (v > m) m = v; }
        szczyty[k] = Math.round((m / 32768) * 1000) / 1000;
    }
    return { szczyty, sekundy: Math.round((probek / HZ_FALI) * 100) / 100 };
}

/** Czy stem to wokal — nazwy z Suno („Lead Vocal”, „Backing Vocals”) i Demucsa („vocals”, „wokal”). */
export const czyWokal = (nazwa) => /vocal|wokal|voice|glos|głos|acapella|a cappella/i.test(String(nazwa)) && !/instrumental|no[ _-]?vocal|bez[ _-]?wokalu/i.test(String(nazwa));
/** Czy stem nadaje się na podkład — instrumental albo „bez wokalu”. */
export const czyInstrumental = (nazwa) => /instrumental|no[ _-]?vocal|bez[ _-]?wokalu|karaoke|accompaniment|backing[ _-]?track/i.test(String(nazwa));

/** Wszystkie pliki audio w katalogu stemów (do 3 poziomów — paczki wypakowują się do podkatalogu). */
export async function listaStemow(katalog, { maxGlebokosc = 3 } = {}) {
    const wynik = [];
    async function idz(kat, gl) {
        let wpisy = [];
        try { wpisy = await fs.readdir(kat, { withFileTypes: true }); } catch { return; }
        for (const w of wpisy) {
            const p = path.join(kat, w.name);
            if (w.isDirectory() && gl < maxGlebokosc) await idz(p, gl + 1);
            else if (w.isFile() && AUDIO.test(w.name)) {
                const st = await fs.stat(p).catch(() => null);
                wynik.push({
                    sciezka: p, nazwa: w.name, paczka: path.relative(katalog, kat).replace(/\\/g, '/') || '',
                    rel: path.relative(katalog, p).replace(/\\/g, '/'), bajtow: st?.size ?? 0,
                    wokal: czyWokal(w.name), instrumental: czyInstrumental(w.name),
                    probka: path.relative(katalog, kat).replace(/\\/g, '/').split('/')[0] === KATALOG_PROBEK,
                });
            }
        }
    }
    await idz(katalog, 0);
    return wynik.sort((a, b) => a.paczka.localeCompare(b.paczka) || Number(b.wokal) - Number(a.wokal) || a.nazwa.localeCompare(b.nazwa));
}

/** Argumenty ffmpeg: wycinek → czysta próbka klonu (mono 22 050 Hz, bez dziur, ≤ MAX_SEKUND). */
export function argumentyProbki({ wejscie, od = 0, do: doS = null, wyjscie }) {
    const a = Math.max(0, Number(od) || 0);
    const b = doS === null || doS === undefined || doS === '' ? null : Number(doS);
    if (b !== null && !(b > a)) throw new Error('„Do” musi być później niż „od”.');
    return [
        '-y', '-ss', String(a), ...(b !== null ? ['-to', String(b)] : []), '-i', wejscie,
        '-af', `highpass=f=80,silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.4:stop_threshold=-45dB,atrim=duration=${MAX_SEKUND}`,
        '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', wyjscie,
    ];
}

/**
 * Stem wokalu → próbka klonu + profil głosu.
 * @param {{ stem:string, od?:number, do?:number|null, id:string, nazwa?:string, katalogGlosow:string,
 *   ffmpeg:string, uruchom:(bin:string, args:string[])=>Promise<any>, opisz:(p:string)=>Promise<{sekundy:number|null}>,
 *   zapiszProfil:(dane:object)=>Promise<object> }} o
 */
export async function glosZeStemu({ stem, od = 0, do: doS = null, id, nazwa, katalogGlosow, ffmpeg, uruchom, opisz, zapiszProfil }) {
    const voiceId = String(id ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    if (!voiceId) throw new Error('Podaj nazwę głosu (np. kael).');
    await fs.mkdir(katalogGlosow, { recursive: true });
    const cel = path.join(katalogGlosow, `${voiceId}.wav`);
    const tymczasowy = path.join(katalogGlosow, `.${voiceId}.nowy.wav`);
    try {
        await uruchom(ffmpeg, argumentyProbki({ wejscie: stem, od, do: doS, wyjscie: tymczasowy }));
        const s = (await opisz(tymczasowy).catch(() => null))?.sekundy ?? null;
        if (!s || s < MIN_SEKUND) {
            throw new Error(`Po wycięciu ciszy zostało ${s ? s.toFixed(1) : '0'} s głosu — klon potrzebuje co najmniej ${MIN_SEKUND} s. Weź dłuższy fragment wokalu.`);
        }
        await fs.rename(tymczasowy, cel);   // stara próbka zostaje, dopóki nowa nie jest dobra
        const profil = await zapiszProfil({
            id: voiceId, nazwa: nazwa || voiceId, voiceId, przewod: 'klon-lokalny', jezyk: 'pl',
            opis: `Ze stemu: ${path.basename(stem)}${od || doS ? ` (${od || 0}–${doS ?? 'koniec'} s)` : ''}`.slice(0, 300),
        });
        return { profil, probka: cel, sekundy: s };
    } finally {
        await fs.rm(tymczasowy, { force: true }).catch(() => {});
    }
}

/**
 * Argumenty ffmpeg: podkład pod gotowy wywiad — zapętlony, cicho, wyciszony na końcu; obraz bez zmian.
 * `[0:a]` wywiadu prowadzi długość (duration=first). amix dzieli głośność przez liczbę wejść — `volume=2` ją oddaje
 * (bez opcji `normalize`, której starsze ffmpeg-static nie znają).
 */
export function argumentyPodkladu({ film, podklad, wyjscie, sekundy, glosnosc = 0.12 }) {
    const g = Math.min(0.6, Math.max(0.02, Number(glosnosc) || 0.12));
    const koniec = Math.max(0, (Number(sekundy) || 0) - 2.5).toFixed(2);
    return [
        '-y', '-i', film, '-stream_loop', '-1', '-i', podklad,
        '-filter_complex', `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${g},afade=t=in:st=0:d=1.5,afade=t=out:st=${koniec}:d=2.5[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0,volume=2[a]`,
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', wyjscie,
    ];
}

export default { nazwaProbki, argumentyWgrania, argumentyFali, szczytyFali, KATALOG_PROBEK, WGRYWALNE, listaStemow, glosZeStemu, argumentyProbki, argumentyPodkladu, czyWokal, czyInstrumental, AUDIO, MIN_SEKUND, MAX_SEKUND };
