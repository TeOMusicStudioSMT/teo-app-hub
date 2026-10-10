/**
 * 🎬 Filmy gry — Reżyser Gry zleca cutscenki i intro (Suweren 2026-10-09: „Reżyser Gry może zlecić wszystkie filmy,
 * jakie potrzebuje do realizacji gry… każda walka czy zdarzenie może mieć cutscenkę… czy film wstępny”).
 *
 * 🎥 REŻYSER WIDEO (Suweren 2026-10-10: „specjalny reżyser video, który będzie odzwierciedlał grę… film w stylu gry oraz
 * postacie z gry w nim… zmienić na FLUX albo mieć wybór między Wan a FLUX”): model Reżysera dostaje STYL WIZUALNY z GDD,
 * krainy i OBSADĘ GRY (postać Katedry, bohaterowie, Mini-TeOgochi, stwory — z ich obrazami) i do filmu pisze plan ujęć:
 * kadr (FLUX, po angielsku), ruch (Wan, po angielsku), ruch kamery i kogo z obsady obsadza (≤ 3). Silnik filmu:
 *   flux-wan (domyślny) — kadr FLUX.2 z obrazami obsady jako WZORAMI (ReferenceLatent) → Wan 2.2 TI2V ożywia kadr,
 *   flux — kadry FLUX + ruch kamery ffmpeg (najazd/odjazd/panorama), szybko, bez Wan,
 *   wan — Wan z samego tekstu.
 * Wynik: `_OtakOs_Apki/<projekt>/public/filmy/<id>.mp4` (+ `<id>-kadr.png`) i dist/filmy, manifest `filmy.json` (gotowe).
 * Stan w GDD: pomysl → zlecony → gotowy | blad (z powodem).
 *
 * 🎞️ DŁUŻSZE FILMY (Suweren 2026-10-10: „filmy robią się lepiej, tylko trochę krótkie, 4 s”): film 2–20 s = kilka ujęć po
 * ≤ `UJECIE_MAX` s (tyle liczy jedno zlecenie Wan). Reżyser Wideo planuje LISTĘ ujęć. wan / flux-wan: pierwsze ujęcie
 * (z tekstu / z kadru FLUX), każde następne `dopisz` od ostatniej klatki poprzedniego (ciągłość), sklejenie concat.
 * flux: kadr FLUX na każde ujęcie, każde z innym ruchem kamery, przenikanie (xfade).
 * 🎵 DŹWIĘK OD JOANNY („przyda się, by potem Joanna zrobiła dźwięk”): film z `dzwiek: true` — po gotowym obrazie Joanna
 * pisze brief brzmienia (MuzykaDoFilmu.promptKompozycji z opisem filmu i stylem GDD) → ACE-Step (`komponuj`) →
 * MuzykaDoFilmu.zloz przycina do długości → ffmpeg wpisuje ścieżkę do mp4 (`maDzwiek: true`, manifest `dzwiek: true`).
 * Dźwięk, który padnie, nie psuje filmu: zostaje niemy z `dzwiekBlad`. Uczciwie: muzyka, bez dialogu i efektów.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import MuzykaDoFilmu from './MuzykaDoFilmu.js';

const uruchom = promisify(execFile);
/** Najdłuższe jedno ujęcie (s) — Wan 2.2 TI2V liczy do ~5 s na zlecenie (121 klatek przy 24 fps). */
export const UJECIE_MAX = 5;
/** Przenikanie między ujęciami silnika flux (s). Ujęcia Wan ciągną się od ostatniej klatki — cięcie bez przenikania. */
export const PRZENIKANIE_KADROW = 0.5;

const SYSTEM_PROMPTU = 'You write prompts for the Wan 2.2 video model for a cutscene of a stylized 3D fantasy game. Output ONE English paragraph, max 70 words: the subject, the place, the motion and the camera move, light and mood. No dialogue, no text on screen, no camera brand names. Nothing else.';

/** Prompt Wan z filmu: gotowy `prompt` albo przekład opisu modelem (z tytułem i gatunkiem gry jako tłem). */
export async function promptFilmu(film, gdd, pisz) {
    if (film.prompt) return film.prompt;
    if (!pisz) return `${film.opis}. Stylized 3D fantasy game cutscene, cinematic camera, soft volumetric light.`;
    const tlo = [gdd?.tytul && `Game: ${gdd.tytul}`, gdd?.gatunek && `Genre: ${gdd.gatunek}`, gdd?.sekcje?.wizual && `Visual style notes (Polish): ${String(gdd.sekcje.wizual).slice(0, 400)}`].filter(Boolean).join('\n');
    const t = String(await pisz({ system: SYSTEM_PROMPTU, prompt: `${tlo}\n\nCutscene (Polish description): ${film.tytul} — ${film.opis}` }) ?? '')
        .replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^["“\s]+|["”\s]+$/g, '').replace(/\s+/g, ' ').trim();
    if (t.length < 20) throw new Error(`Model nie napisał promptu ujęcia (odpowiedź: „${t.slice(0, 60)}”).`);
    return t.slice(0, 600);
}

export const RUCHY = ['najazd', 'odjazd', 'w-lewo', 'w-prawo', 'w-gore', 'staly'];
const SYSTEM_REZYSERA_WIDEO = `You are the VIDEO DIRECTOR of a video game. Every film must look like THIS game: its visual style, its places, its characters.
A film is a short sequence of SHOTS (you get how many). Return ONLY JSON:
{"ujecia": [{"kadr": "...", "ruch": "...", "kamera": "najazd|odjazd|w-lewo|w-prawo|w-gore|staly"}, ...], "postacie": ["id", ...]}
- "ujecia": exactly the requested number of shots, in order; together they tell the film's moment from start to end.
- "kadr": ONE English paragraph (max 80 words) for an image model: the still keyframe of this shot — composition, which game characters stand where and what they do, the place (a land of the game), light, colors, mood, and the game's visual style. The chosen characters are given to the image model as reference pictures, so describe them by role and pose, not by inventing new looks. Keep the same place and characters across shots.
- "ruch": ONE English sentence for a video model: what moves in this shot and how the camera moves. Every shot after the first continues from the last frame of the previous one.
- "kamera": the camera move for this shot; vary it between shots.
- "postacie": up to 3 ids from CAST that belong in this film (empty when no character fits).
No dialogue, no text on screen.`;

/** Ile ujęć ma film (każde ≤ UJECIE_MAX s). */
export function ileUjec(sekundy) { return Math.max(1, Math.ceil((Number(sekundy) || 4) / UJECIE_MAX)); }

/** Plan ujęć dopełniony / przycięty do `ile`; brakujące = poprzedni kadr z innym ruchem kamery (bez zmyślania treści). */
export function dopelnijUjecia(ujecia, ile) {
    const out = ujecia.slice(0, ile);
    while (out.length < ile && out.length) {
        const ost = out[out.length - 1];
        const uzyte = new Set(out.map((u) => u.kamera));
        out.push({ kadr: ost.kadr, ruch: ost.ruch, kamera: RUCHY.find((r) => !uzyte.has(r)) ?? RUCHY[out.length % RUCHY.length] });
    }
    return out;
}

/**
 * Odpowiedź Reżysera Wideo → plan ujęć; tylko id z obsady, ruch kamery z listy, kadr ≥ 20 znaków (inaczej błąd wprost).
 * Stary kształt (jeden kadr na górze JSON-a) = jedno ujęcie. Ujęcie bez kadru bierze kadr poprzedniego.
 */
export function odczytajUjecie(tekst, obsada = [], ile = 1) {
    const t = String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
    const m = t.match(/\{[\s\S]*\}/);
    let j = null;
    try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
    const czysty = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
    const surowe = Array.isArray(j?.ujecia) && j.ujecia.length ? j.ujecia : (j ? [j] : []);
    const ujecia = [];
    for (const u of surowe.slice(0, 8)) {
        const kadr = czysty(u?.kadr, 800);
        ujecia.push({ kadr: kadr.length >= 20 ? kadr : (ujecia[ujecia.length - 1]?.kadr ?? ''), ruch: czysty(u?.ruch, 400) || null, kamera: RUCHY.includes(u?.kamera) ? u.kamera : 'najazd' });
    }
    if (!ujecia.length || ujecia[0].kadr.length < 20) throw new Error(`Reżyser Wideo nie dał kadru w JSON (odpowiedź: „${t.replace(/\s+/g, ' ').slice(0, 120)}”).`);
    const ids = new Set(obsada.map((o) => o.id));
    const plan = dopelnijUjecia(ujecia, Math.max(1, ile));
    return {
        kadr: plan[0].kadr, ruch: plan[0].ruch, kamera: plan[0].kamera, ujecia: plan,
        postacie: (Array.isArray(j?.postacie) ? j.postacie : []).filter((x) => ids.has(x)).slice(0, 3),
    };
}

/** Prompt Reżysera Wideo: gra (styl, krainy), obsada z opisami, film i liczba ujęć. */
export function promptRezyseraWideo(film, gdd, obsada) {
    const krainy = (gdd?.galezie ?? []).find((g) => g.id === 'krainy')?.propozycje?.slice(0, 6).map((p) => `- ${p.opis}`).join('\n');
    const ile = ileUjec(film.sekundy);
    return [
        `GAME: ${gdd?.tytul ?? '?'} — ${gdd?.gatunek ?? ''}`,
        gdd?.sekcje?.wizual && `VISUAL STYLE (Polish): ${String(gdd.sekcje.wizual).slice(0, 700)}`,
        krainy && `LANDS OF THE GAME (Polish):\n${krainy}`,
        `CAST (id — name: look, Polish):\n${obsada.length ? obsada.map((o) => `${o.id} — ${o.imie}: ${String(o.opis ?? '').slice(0, 160)}`).join('\n') : '(no characters yet)'}`,
        `FILM: ${film.tytul} — at game event "${film.zdarzenie}" — ${film.sekundy} s — SHOTS: ${ile} (about ${Math.round((film.sekundy / ile) * 10) / 10} s each)\nDESCRIPTION (Polish): ${film.opis}`,
        film.postacie?.length ? `The Sovereign already chose the cast for this film: ${film.postacie.join(', ')} — use exactly them.` : null,
    ].filter(Boolean).join('\n\n');
}

/** Ruch kamery po nieruchomym kadrze (ffmpeg zoompan) — czysta funkcja, do testów. */
export function filtrRuchuKadru(ruch, sekundy, { fps = 24, szer = 1280, wys = 720 } = {}) {
    const n = Math.max(1, Math.round(sekundy * fps));
    const z = {
        najazd: `z='1+0.22*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
        odjazd: `z='1.22-0.22*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
        'w-lewo': `z='1.18':x='(iw-iw/zoom)*(1-on/${n})':y='ih/2-(ih/zoom/2)'`,
        'w-prawo': `z='1.18':x='(iw-iw/zoom)*on/${n}':y='ih/2-(ih/zoom/2)'`,
        'w-gore': `z='1.18':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/${n})'`,
        staly: `z='1.04':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
    }[RUCHY.includes(ruch) ? ruch : 'najazd'];
    return `scale=${szer * 2}:${wys * 2}:force_original_aspect_ratio=increase,crop=${szer * 2}:${wys * 2},zoompan=${z}:d=${n}:s=${szer}x${wys}:fps=${fps},format=yuv420p`;
}

/** Długość pliku (s) z nagłówka ffmpega — bez dekodowania całości. */
export async function dlugoscPliku(plik) {
    const { stderr } = await uruchom(ffmpegPath, ['-hide_banner', '-i', plik], { maxBuffer: 1 << 22 }).catch((e) => ({ stderr: e.stderr ?? '' }));
    const m = String(stderr).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) throw new Error(`Nie umiem odczytać długości „${path.basename(plik)}”.`);
    return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
}

/** Filtr sklejenia N ujęć wideo: concat (przenikanie 0) albo łańcuch xfade z przesunięciami z długości ujęć. Czysta. */
export function filtrSklejenia(dlugosci, przenikanie = 0) {
    const n = dlugosci.length;
    const wej = dlugosci.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
    if (!(przenikanie > 0)) return `${wej.join(';')};${dlugosci.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0[out]`;
    const kroki = [];
    let poprzedni = '[v0]', koniec = dlugosci[0];
    for (let i = 1; i < n; i += 1) {
        const offset = Math.max(0, koniec - przenikanie);
        const wynik = i === n - 1 ? '[out]' : `[x${i}]`;
        kroki.push(`${poprzedni}[v${i}]xfade=transition=fade:duration=${przenikanie}:offset=${offset.toFixed(3)}${wynik}`);
        poprzedni = wynik;
        koniec = offset + dlugosci[i];
    }
    return `${wej.join(';')};${kroki.join(';')}`;
}

/** Sklej ujęcia w jeden mp4 (przekodowanie — ujęcia z FLUX i Wan mogą mieć różne wymiary, więc skalujemy do pierwszego). */
export async function sklejUjecia({ pliki, wyjscie, przenikanie = 0 }) {
    // jedno ujęcie mp4 = kopia bez przekodowania (webm i inne idą przez ffmpeg, bo plik w grze to zawsze <id>.mp4)
    if (pliki.length === 1 && /\.mp4$/i.test(pliki[0])) { await fs.copyFile(pliki[0], wyjscie); return { plik: wyjscie }; }
    const dlugosci = [];
    for (const p of pliki) dlugosci.push(await dlugoscPliku(p));
    const przen = Math.min(przenikanie, ...dlugosci.map((d) => d / 3));
    await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', ...pliki.flatMap((p) => ['-i', p]), '-filter_complex', filtrSklejenia(dlugosci, przen), '-map', '[out]',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '24', '-movflags', '+faststart', wyjscie], { maxBuffer: 1 << 24, timeout: 20 * 60_000 });
    return { plik: wyjscie, sekundy: await dlugoscPliku(wyjscie) };
}

/** Wpisz ścieżkę dźwięku do filmu (obraz bez przekodowania, dźwięk AAC, długość = film). */
export async function wpiszDzwiek({ film, audio, wyjscie }) {
    await uruchom(ffmpegPath, ['-loglevel', 'error', '-y', '-i', film, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', wyjscie], { maxBuffer: 1 << 24, timeout: 10 * 60_000 });
    return wyjscie;
}

/**
 * @param {{ katalogGier: string, gdd: { wczytaj: Function, zapisz: Function },
 *           generuj: (o:{prompt:string, sekundy:number, obrazStartowy?:string}) => Promise<{ok:boolean, zlecenie?:string, powod?:string}>,
 *           dopisz?: (o:{plik:string, prompt:string, sekundy:number}) => Promise<{ok:boolean, zlecenie?:string, powod?:string}>,
 *           stan: (zlecenie:string) => Promise<{ok:boolean, gotowe?:boolean, materialy?:{nazwa:string, sciezka:string}[], blad?:object|null, wToku?:boolean}>,
 *           pisz?: Function|null, obsada?: (projekt:string) => Promise<{id:string, imie:string, opis:string, obraz:string|null}[]>,
 *           kadr?: (o:{prompt:string, referencje:string[]}) => Promise<string>, wgraj?: (sciezka:string) => Promise<string>,
 *           ruchKadru?: (o:{kadr:string, wyjscie:string, filtr:string, sekundy:number}) => Promise<void>,
 *           joanna?: ((o:{system:string, prompt:string}) => Promise<string>)|null,
 *           komponuj?: ((o:{prompt:string, sekundy:number}) => Promise<string>)|null,
 *           pamiecJoanny?: () => Promise<string>, roboczy?: string, szyna?: object|null, coMs?: number, limitMs?: number }} o
 */
export function utworzFilmyGry({ katalogGier, gdd, generuj, dopisz = null, stan, pisz = null, obsada = async () => [], kadr = null, wgraj = null, ruchKadru = null, joanna = null, komponuj = null, pamiecJoanny = async () => '', roboczy = path.join(os.tmpdir(), 'otakos-filmy-gry'), szyna = null, coMs = 15_000, limitMs = 4 * 3600_000 }) {
    let kolejka = Promise.resolve();
    const pracuje = new Set();

    // Zapisy GDD po kolei — dwa filmy w drodze naraz czytały i pisały GDD równocześnie, jeden nadpisywał drugi.
    let zapisy = Promise.resolve();
    function ustawFilm(projekt, id, pola) {
        const w = zapisy.then(async () => {
            const g = await gdd.wczytaj(projekt);
            const filmy = (g?.filmy ?? []).map((f) => (f.id === id ? { ...f, ...pola } : f));
            await gdd.zapisz(projekt, { ...g, filmy });
            return filmy.find((f) => f.id === id);
        });
        zapisy = w.catch(() => {});
        return w;
    }

    /** public/filmy (źródło — przetrwa przebudowę) + dist/filmy, gdy gra jest zbudowana (most serwuje /apki/<id>/ z dist). */
    async function katalogiFilmow(projekt) {
        const out = [path.join(katalogGier, projekt, 'public', 'filmy')];
        if (await fs.stat(path.join(katalogGier, projekt, 'dist')).then((s) => s.isDirectory()).catch(() => false)) out.push(path.join(katalogGier, projekt, 'dist', 'filmy'));
        return out;
    }
    const doGry = async (projekt, zrodlo, plik) => { for (const kat of await katalogiFilmow(projekt)) { await fs.mkdir(kat, { recursive: true }); await fs.copyFile(zrodlo, path.join(kat, plik)); } };

    async function manifest(projekt) {
        const g = await gdd.wczytaj(projekt);
        const gotowe = (g?.filmy ?? []).filter((f) => f.stan === 'gotowy' && f.plik).map((f) => ({ id: f.id, zdarzenie: f.zdarzenie, tytul: f.tytul, plik: f.plik, ...(f.maDzwiek ? { dzwiek: true } : {}) }));
        for (const kat of await katalogiFilmow(projekt)) {
            await fs.mkdir(kat, { recursive: true });
            await fs.writeFile(path.join(kat, 'filmy.json'), JSON.stringify({ filmy: gotowe, zmieniono: new Date().toISOString() }, null, 2), 'utf8');
        }
        return gotowe;
    }

    /** Wan: zlecenie (z tekstu / z kadru / od klatki) → czekanie → plik wideo (ścieżka). */
    async function wanDoPliku(projekt, id, zlecenie) {
        const z = await zlecenie;
        if (!z.ok) throw new Error(z.powod || 'ComfyUI nie przyjął ujęcia.');
        await ustawFilm(projekt, id, { zlecenie: z.zlecenie });
        const t0 = Date.now();
        let s;
        for (;;) {
            if (Date.now() - t0 > limitMs) throw new Error(`Wan nie skończył w ${Math.round(limitMs / 3600_000)} h (zlecenie ${z.zlecenie}).`);
            await new Promise((r) => setTimeout(r, coMs));
            s = await stan(z.zlecenie).catch(() => null);
            if (!s?.ok) continue;
            if (s.blad) throw new Error(`ComfyUI: ${s.blad.status_str || 'błąd wykonania'}`);
            if (s.gotowe) break;
        }
        const src = s.materialy?.find((m) => /\.(mp4|webm)$/i.test(m.nazwa)) ?? s.materialy?.[0];
        if (!src) throw new Error('Wan skończył, ale nie ma pliku wideo.');
        return src.sciezka;
    }

    /** 🎥 Reżyser Wideo: plan ujęć z obsadą gry (bez modelu — opis filmu, obsada Suwerena, ruchy kamery po kolei). */
    async function ujecie(film, g, obs) {
        const ile = ileUjec(film.sekundy);
        if (!pisz) {
            const kadr0 = `${film.opis}. ${g?.sekcje?.wizual ? String(g.sekcje.wizual).slice(0, 200) : 'Stylized 3D fantasy game'} — cinematic keyframe.`;
            const ujecia = dopelnijUjecia([{ kadr: kadr0, ruch: null, kamera: film.ruch ?? 'najazd' }], ile);
            return { kadr: kadr0, ruch: null, kamera: ujecia[0].kamera, ujecia, postacie: film.postacie ?? [] };
        }
        const u = odczytajUjecie(await pisz({ system: SYSTEM_REZYSERA_WIDEO, prompt: promptRezyseraWideo(film, g, obs) }), obs, ile);
        if (film.postacie?.length) u.postacie = film.postacie.filter((x) => obs.some((o) => o.id === x));
        if (film.ruch) { u.kamera = film.ruch; u.ujecia[0] = { ...u.ujecia[0], kamera: film.ruch }; }
        return u;
    }

    const promptRuchu = (uj, film) => [uj.ruch ?? film.opis, `Camera: ${uj.kamera}.`].join(' ').slice(0, 600);

    /** Obraz filmu: lista ujęć → jeden plik w katalogu roboczym. Zwraca { zrodlo, pola do GDD }. */
    async function obrazFilmu(projekt, id, film, g, silnik, kat) {
        const ile = ileUjec(film.sekundy);
        const naUjecie = film.sekundy / ile;
        const ujecia = [];
        const pola = {};
        if (silnik === 'wan') {
            const prompt = await promptFilmu(film, g, pisz);
            pola.prompt = prompt;
            const plan = ile > 1 ? (await ujecie(film, g, [])).ujecia : [];
            await ustawFilm(projekt, id, { prompt, ...(ile > 1 ? { ujecia: plan.map(({ ruch, kamera }) => ({ ruch, kamera })) } : {}) });
            ujecia.push(await wanDoPliku(projekt, id, generuj({ prompt, sekundy: naUjecie })));
            for (let i = 1; i < ile; i += 1) {
                await ustawFilm(projekt, id, { postep: `ujęcie ${i + 1}/${ile}` });
                ujecia.push(await wanDoPliku(projekt, id, dopisz({ plik: ujecia[i - 1], prompt: promptRuchu(plan[i], film), sekundy: naUjecie })));
            }
            return { zrodlo: await sklejUjecia({ pliki: ujecia, wyjscie: path.join(kat, `${id}.mp4`) }).then((w) => w.plik), pola };
        }
        const obs = await obsada(projekt).catch(() => []);
        const u = await ujecie(film, g, obs);
        const zObsady = u.postacie.map((x) => obs.find((o) => o.id === x)).filter(Boolean);
        const referencje = zObsady.map((o) => o.obraz).filter(Boolean);
        const plikKadru = await kadr({ prompt: u.kadr, referencje });
        const nazwaKadru = `${id}-kadr.png`;
        await doGry(projekt, plikKadru, nazwaKadru);
        Object.assign(pola, { kadr: `filmy/${nazwaKadru}`, kadrPrompt: u.kadr, prompt: promptRuchu(u.ujecia[0], film), ruch: u.kamera, obsadaUzyta: zObsady.map((o) => ({ id: o.id, imie: o.imie })), ujecia: u.ujecia.map(({ ruch, kamera }) => ({ ruch, kamera })) });
        await ustawFilm(projekt, id, pola);
        if (silnik === 'flux') {
            // każde ujęcie: własny kadr (ten sam kadr co poprzednie = bez drugiego FLUX), inny ruch kamery; przenikanie wydłuża ujęcia, by film miał zadaną długość
            const dl = ile > 1 ? naUjecie + (PRZENIKANIE_KADROW * (ile - 1)) / ile : film.sekundy;
            let kadrPoprzedni = u.ujecia[0].kadr, plikPoprzedni = plikKadru;
            for (let i = 0; i < ile; i += 1) {
                const uj = u.ujecia[i];
                if (i > 0) await ustawFilm(projekt, id, { postep: `ujęcie ${i + 1}/${ile}` });
                const plikK = i === 0 || uj.kadr === kadrPoprzedni ? plikPoprzedni : await kadr({ prompt: uj.kadr, referencje });
                kadrPoprzedni = uj.kadr; plikPoprzedni = plikK;
                const wyjscie = path.join(kat, `${id}-ujecie${i + 1}.mp4`);
                await ruchKadru({ kadr: plikK, wyjscie, filtr: filtrRuchuKadru(uj.kamera, dl), sekundy: dl });
                ujecia.push(wyjscie);
            }
            return { zrodlo: (await sklejUjecia({ pliki: ujecia, wyjscie: path.join(kat, `${id}.mp4`), przenikanie: PRZENIKANIE_KADROW })).plik, pola };
        }
        const nazwa = wgraj ? await wgraj(plikKadru) : '';
        if (!nazwa) throw new Error('Kadr nie trafił do ComfyUI (wgranie) — Wan nie ma od czego zacząć.');
        ujecia.push(await wanDoPliku(projekt, id, generuj({ prompt: pola.prompt, sekundy: naUjecie, obrazStartowy: nazwa })));
        for (let i = 1; i < ile; i += 1) {
            await ustawFilm(projekt, id, { postep: `ujęcie ${i + 1}/${ile}` });
            ujecia.push(await wanDoPliku(projekt, id, dopisz({ plik: ujecia[i - 1], prompt: promptRuchu(u.ujecia[i], film), sekundy: naUjecie })));
        }
        return { zrodlo: (await sklejUjecia({ pliki: ujecia, wyjscie: path.join(kat, `${id}.mp4`) })).plik, pola };
    }

    /** 🎵 Joanna: brief brzmienia → ACE-Step → przycięcie do długości filmu → ścieżka w mp4. Zwraca { plik z dźwiękiem, brief }. */
    async function dzwiekFilmu(projekt, film, g, obraz, kat) {
        const sekundy = await dlugoscPliku(obraz);
        const kanon = [g?.tytul && `Gra: ${g.tytul}${g?.gatunek ? ` (${g.gatunek})` : ''}`, `Film: ${film.tytul} — przy zdarzeniu „${film.zdarzenie}”`, `Opis filmu: ${film.opis}`].filter(Boolean).join('\n');
        const { system, prompt } = MuzykaDoFilmu.promptKompozycji({ film: `${film.id}.mp4`, projekt, kanon, styl: String(g?.sekcje?.wizual ?? '').slice(0, 400), sekundy, kontekstJoanny: String(await pamiecJoanny().catch(() => '') || '') });
        const brief = MuzykaDoFilmu.odczytajBrief(await joanna({ system, prompt }));
        const plan = MuzykaDoFilmu.planSegmentow(sekundy);
        const segmenty = [];
        for (let i = 0; i < plan.ile; i += 1) segmenty.push(await komponuj({ prompt: brief.tagi + (brief.unikaj ? `. avoid: ${brief.unikaj}` : ''), sekundy: plan.dlugosc }));
        const audio = (await MuzykaDoFilmu.zloz({ segmenty, sekundy, wyjscie: path.join(kat, `${film.id}-muzyka.flac`), wyciszenie: Math.min(2, sekundy / 4) })).plik;
        return { plik: await wpiszDzwiek({ film: obraz, audio, wyjscie: path.join(kat, `${film.id}-dzwiek.mp4`) }), brief };
    }

    /** Zleć film (w tle, jeden naraz — karta graficzna jest jedna). Wraca od razu ze stanem „zlecony”. */
    async function zlec(projekt, id) {
        const g = await gdd.wczytaj(projekt);
        if (!g) throw new Error('Ten projekt nie ma GDD.');
        const film = (g.filmy ?? []).find((f) => f.id === id);
        if (!film) throw new Error('Nie ma takiego filmu w GDD.');
        const silnik = film.silnik ?? 'flux-wan';
        if (silnik !== 'wan' && !kadr) throw new Error('Ta Katedra nie ma kadrów FLUX dla filmów — wybierz silnik „Wan”.');
        if (silnik === 'flux' && !ruchKadru) throw new Error('Ta Katedra nie ma ruchu kamery (ffmpeg) — wybierz „FLUX → Wan” albo „Wan”.');
        if (silnik !== 'flux' && ileUjec(film.sekundy) > 1 && !dopisz) throw new Error(`Film ${film.sekundy} s to kilka ujęć, a ta Katedra nie umie dopisywać ujęć Wan — skróć do ${UJECIE_MAX} s albo wybierz „FLUX”.`);
        if (film.dzwiek && (!joanna || !komponuj)) throw new Error('Ta Katedra nie ma drogi do Joanny i silnika muzyki — zlec film bez dźwięku.');
        if (pracuje.has(`${projekt}/${id}`)) throw new Error('Ten film właśnie się liczy.');
        pracuje.add(`${projekt}/${id}`);
        const f0 = await ustawFilm(projekt, id, { stan: 'zlecony', blad: null, postep: null, dzwiekBlad: null, kiedy: new Date().toISOString() });
        kolejka = kolejka.then(async () => {
            const kat = path.join(roboczy, `${projekt}-${id}-${Date.now().toString(36)}`);
            try {
                await fs.mkdir(kat, { recursive: true });
                const { zrodlo } = await obrazFilmu(projekt, id, film, g, silnik, kat);
                const plik = `${id}.mp4`;
                await doGry(projekt, zrodlo, plik);
                await ustawFilm(projekt, id, { stan: 'gotowy', plik: `filmy/${plik}`, blad: null, postep: null, maDzwiek: false, kiedy: new Date().toISOString(), silnikUzyty: silnik });
                await manifest(projekt);
                void szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'praca', tresc: `🎬 film „${film.tytul}” (${film.zdarzenie}, ${silnik}, ${film.sekundy} s) gotowy w grze „${projekt}”` })?.catch?.(() => {});
                if (film.dzwiek) {
                    // obraz jest już w grze; dźwięk dochodzi po nim — jego porażka zostawia niemy film z powodem
                    await ustawFilm(projekt, id, { postep: '🎵 Joanna komponuje' });
                    try {
                        const d = await dzwiekFilmu(projekt, film, g, zrodlo, kat);
                        await doGry(projekt, d.plik, plik);
                        await ustawFilm(projekt, id, { maDzwiek: true, muzykaBrief: d.brief.tagi, dzwiekBlad: null, postep: null });
                        await manifest(projekt);
                        void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🎵 skomponowała dźwięk do filmu „${film.tytul}” w grze „${projekt}”` })?.catch?.(() => {});
                    } catch (e) {
                        await ustawFilm(projekt, id, { dzwiekBlad: String(e.message).slice(0, 300), postep: null }).catch(() => {});
                        void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'blad', tresc: `🎵 „${film.tytul}”: ${e.message}` })?.catch?.(() => {});
                    }
                }
            } catch (e) {
                await ustawFilm(projekt, id, { stan: 'blad', blad: String(e.message).slice(0, 300), postep: null }).catch(() => {});
                void szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'blad', tresc: `🎬 „${film.tytul}”: ${e.message}` })?.catch?.(() => {});
            } finally {
                pracuje.delete(`${projekt}/${id}`);
                await fs.rm(kat, { recursive: true, force: true }).catch(() => {});
            }
        });
        return f0;
    }

    return { zlec, manifest, liczy: () => [...pracuje] };
}

export default { utworzFilmyGry, promptFilmu, odczytajUjecie, promptRezyseraWideo, filtrRuchuKadru, filtrSklejenia, sklejUjecia, wpiszDzwiek, dlugoscPliku, ileUjec, dopelnijUjecia, RUCHY, UJECIE_MAX, PRZENIKANIE_KADROW };
