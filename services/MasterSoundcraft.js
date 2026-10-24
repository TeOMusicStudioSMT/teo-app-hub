/**
 * 🎛️ Mastering dowolnego utworu biblioteki w SoundCraft (po produkcji aranżu Joanny, 2026-10-24) — jam, ACE-Step,
 * Suno, aranże: każdy plik audio z `_OtakOs_Muzyka`. Ten sam `soundcraft-cli` co `services/ProdukcjaSoundcraft.js`.
 *
 *  1. pomiar oryginału (sam import, bounce) — LUFS i true peak „przed”;
 *  2. łańcuch z ZAMKNIĘTEJ listy (`LANCUCHY`: EQ 7-band → kompresor → nasycenie → gain → maximizer z sufitem −1,5 dB)
 *     na ścieżce sumy — wybiera Suweren, model niczego tu nie wybiera;
 *  3. przebieg z gain 0 → wzmocnienie do celu łańcucha → przebieg końcowy; limiter ściska nieliniowo, więc gdy wynik
 *     mija cel o > 0,5 LU, najwyżej dwie poprawki wzmocnienia;
 *  4. `<tytuł> (master).mp3` OBOK oryginału (oryginał nietknięty) + karta `<tytuł> (master).json` z pomiarami;
 *     mp3 mierzony jeszcze raz ffmpegiem (ebur128) — kodowanie mp3 potrafi podnieść true peak, mówimy to wprost.
 * Skrypt sesji (`skryptMasteringu`) czysty i testowany.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { znajdzCli, wykonaj, SUFIT_DBTP } from './ProdukcjaSoundcraft.js';

export const AUDIO = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus']);
/** Tolerancja celu (LU) — dalej = poprawka wzmocnienia, najwyżej `MAX_POPRAWEK`. */
export const TOLERANCJA_LU = 0.5;
export const MAX_POPRAWEK = 2;
const MAX_HISTORII = 100;

/**
 * Łańcuchy masteringu (zamknięta lista). Parametry = id z `soundcraft-cli run --cmd engine.plugins`
 * (eq_7band, compressor, saturator, maximizer w SoundCraft 0.12.1).
 */
export const LANCUCHY = {
    przejrzysty: {
        nazwa: 'Przejrzysty', opis: 'porządek w dole, odrobina powietrza, delikatny klej — brzmienie zostaje', cel: -14,
        eq: { hpf_on: 1, hpf_freq: 28, low_mid_freq: 300, low_mid_gain: -1, low_mid_q: 0.8, high_shelf_freq: 10000, high_shelf_gain: 1 },
        kompresor: { threshold: -18, ratio: 1.5, attack: 30, release: 250, knee: 6 },
    },
    cieply: {
        nazwa: 'Ciepły', opis: 'okrągły dół, łagodniejsza góra, taśmowe nasycenie', cel: -14,
        eq: { hpf_on: 1, hpf_freq: 25, low_shelf_freq: 110, low_shelf_gain: 1.5, high_mid_freq: 3500, high_mid_gain: -0.8, high_mid_q: 0.9, high_shelf_freq: 12000, high_shelf_gain: -0.5 },
        kompresor: { threshold: -20, ratio: 2, attack: 25, release: 200, knee: 8 },
        saturator: { drive: 4, tone: 11000, mix: 35 },
    },
    klubowy: {
        nazwa: 'Głośny klubowy', opis: 'mocna stopa i bas, ściśnięta suma, głośno (−10 LUFS; serwisy i tak ściszą do ~−14)', cel: -10,
        eq: { hpf_on: 1, hpf_freq: 30, hpf_slope: 2, low_shelf_freq: 65, low_shelf_gain: 2.5, low_mid_freq: 350, low_mid_gain: -1.5, low_mid_q: 1, high_shelf_freq: 9000, high_shelf_gain: 1.5 },
        kompresor: { threshold: -22, ratio: 3, attack: 10, release: 120, knee: 6, sc_hpf_on: 1, sc_hpf_freq: 90 },
        saturator: { drive: 5, tone: 14000, mix: 25 },
        maximizer: { release: 40 },
    },
    delikatny: {
        nazwa: 'Delikatny', opis: 'ambient i akustyka: dynamika i oddech zostają, ciszej (−16 LUFS)', cel: -16,
        eq: { hpf_on: 1, hpf_freq: 22, high_shelf_freq: 12000, high_shelf_gain: 0.5 },
        kompresor: { threshold: -14, ratio: 1.3, attack: 40, release: 400, knee: 10 },
    },
};

/** Lista dla Huba/apki: bez parametrów wtyczek. */
export const opisLancuchow = () => Object.fromEntries(Object.entries(LANCUCHY).map(([id, l]) => [id, { nazwa: l.nazwa, opis: l.opis, cel: l.cel }]));

const zaokr = (x, n = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** n) / 10 ** n : null);
const ogranicz = (x) => zaokr(Math.max(-12, Math.min(24, x)));

/**
 * Skrypt `soundcraft-cli script` (jedna komenda `ID JSON` na linię). Czysty. `lancuch: null` = sam import (pomiar oryginału).
 */
export function skryptMasteringu({ wejscie, lancuch, wzmocnienie = 0 }) {
    const linie = [];
    const k = (id, p) => linie.push(`${id} ${JSON.stringify(p)}`);
    k('file.import_audio', { path: wejscie });
    if (lancuch != null) {
        const L = LANCUCHY[lancuch];
        if (!L) throw new Error(`Nieznany łańcuch „${lancuch}” (znane: ${Object.keys(LANCUCHY).join(', ')}).`);
        k('track.new', { kind: 'master', name: 'Suma' });
        k('mix.insert', { track: 'Suma', plugin: 'eq_7band', params: L.eq });
        k('mix.insert', { track: 'Suma', plugin: 'compressor', params: L.kompresor });
        if (L.saturator) k('mix.insert', { track: 'Suma', plugin: 'saturator', params: L.saturator });
        k('mix.insert', { track: 'Suma', plugin: 'gain', params: { gain: ogranicz(wzmocnienie) } });
        k('mix.insert', { track: 'Suma', plugin: 'maximizer', params: { threshold: 0, ceiling: SUFIT_DBTP, release: L.maximizer?.release ?? 60 } });
    }
    return linie.join('\n') + '\n';
}

/** Następne wzmocnienie: z pomiaru przebiegu przy `wzm` do celu (ograniczone −12…+24 dB). */
export const nastepneWzmocnienie = (wzm, lufs, cel) => (Number.isFinite(lufs) ? ogranicz(wzm + (cel - lufs)) : wzm);

/** Ścieżka utworu tylko wewnątrz biblioteki (względna albo bezwzględna), plik audio, nie master. */
export function sciezkaUtworu(katalogMuzyki, plik) {
    const p = String(plik ?? '').trim();
    if (!p) throw new Error('Podaj utwór z biblioteki.');
    const kat = path.resolve(katalogMuzyki);
    const pelna = path.resolve(kat, p);
    const rel = path.relative(kat, pelna);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Mastering bierze tylko utwory z biblioteki Katedry (_OtakOs_Muzyka).');
    if (!AUDIO.has(path.extname(pelna).toLowerCase())) throw new Error(`To nie jest plik audio (${[...AUDIO].join(', ')}).`);
    if (/\(master\)$/i.test(path.basename(pelna, path.extname(pelna)))) throw new Error('To już jest master — wybierz oryginał (mastering mastera tylko ściska go drugi raz).');
    if (!fsSync.existsSync(pelna) || !fsSync.statSync(pelna).isFile()) throw new Error('Nie ma takiego utworu w bibliotece.');
    return { pelna, rel: rel.split(path.sep).join('/') };
}

/** Pomiar ffmpeg ebur128 (zintegrowana głośność i true peak) z wyjścia stderr. */
export function odczytajEbur128(tekst) {
    const t = String(tekst ?? '');
    const s = t.slice(t.lastIndexOf('Summary:'));
    const lufs = s.match(/I:\s*(-?[\d.]+) LUFS/);
    const tp = s.match(/Peak:\s*(-?[\d.]+) dBFS/);
    return { lufs: lufs ? Number(lufs[1]) : null, truePeak: tp ? Number(tp[1]) : null };
}

/**
 * @param {{ katalogMuzyki: string, katalog: string, katalogAI: string, ffmpeg: string, uruchom?: typeof wykonaj, env?: object, szyna?: any }} cfg
 */
export function utworzMaster({ katalogMuzyki, katalog, katalogAI, ffmpeg, uruchom = wykonaj, env = process.env, szyna = null }) {
    let trwa = null;
    const cli = () => znajdzCli(katalogAI, env);
    const plikHistorii = path.join(katalog, 'mastery.json');
    const env2 = { ...env, SOUNDCRAFT_NO_PREFS: '1' };

    async function historia() {
        try { return JSON.parse(await fs.readFile(plikHistorii, 'utf8')); } catch { return []; }
    }

    async function stan() {
        const c = cli();
        // tylko mastery, których plik jeszcze leży w bibliotece
        const mastery = (await historia()).filter((x) => fsSync.existsSync(path.join(katalogMuzyki, x.plik))).slice(0, 30);
        const wspolne = { lancuchy: opisLancuchow(), sufit: SUFIT_DBTP, trwa, mastery };
        if (!c) return { dostepny: false, powod: 'Nie ma SoundCraft w Katedrze — rozpakuj soundcraft-<wersja>-windows-x64-portable.zip (github.com/storytold/soundcraft/releases) do _OtakOs_AI/soundcraft/<wersja>/ albo wskaż OTAKOS_SOUNDCRAFT.', ...wspolne };
        try {
            const wersja = (await uruchom(c, ['--version'], { env: env2 })).out.trim();
            return { dostepny: true, wersja, ...wspolne };
        } catch (e) { return { dostepny: false, powod: `soundcraft-cli nie odpowiada: ${e.message}`, ...wspolne }; }
    }

    /** Mastering utworu `plik` łańcuchem `lancuch`. Zwraca kartę (ścieżki względem biblioteki). */
    async function masteruj({ plik, lancuch } = {}) {
        if (!LANCUCHY[lancuch]) throw new Error(`Nieznany łańcuch „${lancuch}” (znane: ${Object.keys(LANCUCHY).join(', ')}).`);
        const { pelna, rel } = sciezkaUtworu(katalogMuzyki, plik);
        if (trwa) throw new Error(`Trwa już mastering „${trwa}” — jeden naraz.`);
        const c = cli();
        if (!c) throw new Error((await stan()).powod);
        const L = LANCUCHY[lancuch];
        const tytul = path.basename(pelna, path.extname(pelna));
        trwa = tytul;
        const t0 = Date.now();
        const praca = path.join(katalog, 'praca', `${Date.now().toString(36)}`);
        try {
            await fs.mkdir(praca, { recursive: true });
            const fwd = (p) => p.split(path.sep).join('/');
            const przebiegi = [];
            const przebieg = async (nazwa, lan, wzm) => {
                const skrypt = path.join(praca, `${nazwa}.txt`);
                await fs.writeFile(skrypt, skryptMasteringu({ wejscie: fwd(pelna), lancuch: lan, wzmocnienie: wzm }));
                const wav = path.join(praca, `${nazwa}.wav`);
                const { out } = await uruchom(c, ['script', skrypt, '--bounce', wav], { env: env2, cwd: praca }).catch((e) => { throw new Error(`SoundCraft: ${e.message}`); });
                const linia = out.split('\n').map((l) => l.trim()).find((l) => l.startsWith('{') && l.includes('"lufs"'));
                if (!linia) throw new Error(`SoundCraft nie oddał pomiaru bounce: ${out.slice(-300)}`);
                const m = JSON.parse(linia);
                if (lan) przebiegi.push({ wzmocnienie: ogranicz(wzm), lufs: zaokr(m.lufs, 1), truePeak: zaokr(m.true_peak_db, 1) });
                return { wav, ...m };
            };
            const oryginal = await przebieg('oryginal', null, 0);
            await fs.rm(oryginal.wav, { force: true });
            if (!Number.isFinite(oryginal.lufs) || oryginal.lufs < -70) throw new Error('Utwór jest cichy jak grób (pomiar poniżej −70 LUFS) — nie ma czego masterować.');
            // przebieg z gain 0, potem do celu; poprawki tylko gdy limiter zjadł/oddał > tolerancji
            const zero = await przebieg('pomiar', lancuch, 0);
            await fs.rm(zero.wav, { force: true });
            let wzm = nastepneWzmocnienie(0, zero.lufs, L.cel);
            let wynik = await przebieg('master-0', lancuch, wzm);
            for (let i = 1; i <= MAX_POPRAWEK && Math.abs(L.cel - wynik.lufs) > TOLERANCJA_LU; i++) {
                const nowe = nastepneWzmocnienie(wzm, wynik.lufs, L.cel);
                if (nowe === wzm) break; // wzmocnienie na granicy — więcej się nie da
                const kolejny = await przebieg(`master-${i}`, lancuch, nowe);
                if (Math.abs(L.cel - kolejny.lufs) < Math.abs(L.cel - wynik.lufs)) { await fs.rm(wynik.wav, { force: true }); wynik = kolejny; wzm = nowe; } else { await fs.rm(kolejny.wav, { force: true }); break; }
            }
            const katUtworu = path.dirname(pelna);
            const mp3 = path.join(katUtworu, `${tytul} (master).mp3`);
            await uruchom(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wynik.wav, '-c:a', 'libmp3lame', '-b:a', '320k', mp3]);
            // mp3 mierzony jeszcze raz — tak gra w Radiu i na kanałach
            let poMp3 = { lufs: null, truePeak: null };
            try { poMp3 = odczytajEbur128((await uruchom(ffmpeg, ['-hide_banner', '-nostats', '-i', mp3, '-af', 'ebur128=peak=true', '-f', 'null', '-'])).err); } catch { /* pomiar mp3 tylko informacyjny */ }
            const relMp3 = path.relative(katalogMuzyki, mp3).split(path.sep).join('/');
            const karta = {
                zrodlo: rel, plik: relMp3, tytul, lancuch, nazwaLancucha: L.nazwa, cel: L.cel,
                lufsPrzed: zaokr(oryginal.lufs, 1), truePeakPrzed: zaokr(oryginal.true_peak_db, 1),
                lufs: zaokr(wynik.lufs, 1), truePeak: zaokr(wynik.true_peak_db, 1), peak: zaokr(wynik.peak_db, 1),
                lufsMp3: zaokr(poMp3.lufs, 1), truePeakMp3: zaokr(poMp3.truePeak, 1),
                uwaga: Number.isFinite(poMp3.truePeak) && poMp3.truePeak > -1 ? `Kodowanie mp3 podniosło true peak do ${zaokr(poMp3.truePeak, 1)} dBTP (WAV z SoundCraft: ${zaokr(wynik.true_peak_db, 1)}).` : (Math.abs(L.cel - wynik.lufs) > TOLERANCJA_LU ? `Cel ${L.cel} LUFS nieosiągnięty (${zaokr(wynik.lufs, 1)}) — limiter nie da więcej bez zniekształceń albo wzmocnienie doszło do granicy.` : null),
                wzmocnienie: wzm, przebiegi, sekundy: zaokr(wynik.seconds, 1),
                soundcraft: (await uruchom(c, ['--version'], { env: env2 }).catch(() => ({ out: '' }))).out.trim() || null,
                sekundyLiczenia: Math.round((Date.now() - t0) / 100) / 10, kiedy: new Date().toISOString(),
            };
            await fs.writeFile(path.join(katUtworu, `${tytul} (master).json`), JSON.stringify(karta, null, 2), 'utf8');
            const h = (await historia()).filter((x) => x.plik !== karta.plik);
            await fs.mkdir(katalog, { recursive: true });
            await fs.writeFile(plikHistorii, JSON.stringify([karta, ...h].slice(0, MAX_HISTORII), null, 2), 'utf8');
            void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🎛️ master „${tytul}” (${L.nazwa}): ${karta.lufsPrzed} → ${karta.lufs} LUFS, true peak ${karta.truePeak} dBTP` })?.catch?.(() => {});
            return karta;
        } finally {
            trwa = null;
            await fs.rm(praca, { recursive: true, force: true }).catch(() => {});
        }
    }

    return { stan, masteruj, historia, cli };
}

/** Trasy (Straż `/api/master`: tylko maszyna). */
export function zamontujTrasyMasteru(app, M) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(/Nie ma takiego/.test(e.message) ? 404 : /Trwa już/.test(e.message) ? 409 : kod).json({ success: false, message: e.message }));
    app.get('/api/master/stan', (_req, res) => odp(res, M.stan().then((master) => ({ master })), 500));
    app.post('/api/master', (req, res) => odp(res, M.masteruj({ plik: req.body?.plik, lancuch: req.body?.lancuch }).then((master) => ({ master, url: `/music/${master.plik.split('/').map(encodeURIComponent).join('/')}` }))));
    return M;
}

export default { utworzMaster, zamontujTrasyMasteru, skryptMasteringu, sciezkaUtworu, nastepneWzmocnienie, odczytajEbur128, opisLancuchow, LANCUCHY };
