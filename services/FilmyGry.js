/**
 * 🎬 Filmy gry — Reżyser Gry zleca cutscenki i intro (Suweren 2026-10-09: „Reżyser Gry może zlecić wszystkie filmy,
 * jakie potrzebuje do realizacji gry… każda walka czy zdarzenie może mieć cutscenkę… czy film wstępny”).
 *
 * 🎥 REŻYSER WIDEO (Suweren 2026-10-10: „specjalny reżyser video, który będzie odzwierciedlał grę… film w stylu gry oraz
 * postacie z gry w nim… zmienić na FLUX albo mieć wybór między Wan a FLUX”): model Reżysera dostaje STYL WIZUALNY z GDD,
 * krainy i OBSADĘ GRY (postać Katedry, bohaterowie, Mini-TeOgochi, stwory — z ich obrazami) i do filmu pisze:
 * kadr (FLUX, po angielsku), ruch (Wan, po angielsku), ruch kamery i kogo z obsady obsadza (≤ 3). Silnik filmu:
 *   flux-wan (domyślny) — kadr FLUX.2 z obrazami obsady jako WZORAMI (ReferenceLatent) → Wan 2.2 TI2V ożywia kadr,
 *   flux — ten kadr + ruch kamery ffmpeg (najazd/odjazd/panorama), szybko, bez Wan,
 *   wan — jak dawniej: Wan z samego tekstu.
 * Wynik: `_OtakOs_Apki/<projekt>/public/filmy/<id>.mp4` (+ `<id>-kadr.png`) i dist/filmy, manifest `filmy.json` (gotowe).
 * Stan w GDD: pomysl → zlecony → gotowy | blad (z powodem). Uczciwie: jedno ujęcie, bez dźwięku i dialogu.
 */
import fs from 'fs/promises';
import path from 'path';

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
Return ONLY JSON: {"kadr": "...", "ruch": "...", "kamera": "najazd|odjazd|w-lewo|w-prawo|w-gore|staly", "postacie": ["id", ...]}
- "kadr": ONE English paragraph (max 80 words) for an image model: the still keyframe — composition, which game characters stand where and what they do, the place (a land of the game), light, colors, mood, and the game's visual style. The chosen characters are given to the image model as reference pictures, so describe them by role and pose, not by inventing new looks.
- "ruch": ONE English sentence for a video model: what moves in this shot and how the camera moves.
- "kamera": the camera move for this shot.
- "postacie": up to 3 ids from CAST that belong in this scene (empty when no character fits).
No dialogue, no text on screen.`;

/** Odpowiedź Reżysera Wideo → ujęcie; tylko id z obsady, ruch kamery z listy, kadr ≥ 20 znaków (inaczej błąd wprost). */
export function odczytajUjecie(tekst, obsada = []) {
    const t = String(tekst ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
    const m = t.match(/\{[\s\S]*\}/);
    let j = null;
    try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
    const kadr = String(j?.kadr ?? '').replace(/\s+/g, ' ').trim();
    if (kadr.length < 20) throw new Error(`Reżyser Wideo nie dał kadru w JSON (odpowiedź: „${t.replace(/\s+/g, ' ').slice(0, 120)}”).`);
    const ids = new Set(obsada.map((o) => o.id));
    return {
        kadr: kadr.slice(0, 800),
        ruch: String(j?.ruch ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) || null,
        kamera: RUCHY.includes(j?.kamera) ? j.kamera : 'najazd',
        postacie: (Array.isArray(j?.postacie) ? j.postacie : []).filter((x) => ids.has(x)).slice(0, 3),
    };
}

/** Prompt Reżysera Wideo: gra (styl, krainy), obsada z opisami, film. */
export function promptRezyseraWideo(film, gdd, obsada) {
    const krainy = (gdd?.galezie ?? []).find((g) => g.id === 'krainy')?.propozycje?.slice(0, 6).map((p) => `- ${p.opis}`).join('\n');
    return [
        `GAME: ${gdd?.tytul ?? '?'} — ${gdd?.gatunek ?? ''}`,
        gdd?.sekcje?.wizual && `VISUAL STYLE (Polish): ${String(gdd.sekcje.wizual).slice(0, 700)}`,
        krainy && `LANDS OF THE GAME (Polish):\n${krainy}`,
        `CAST (id — name: look, Polish):\n${obsada.length ? obsada.map((o) => `${o.id} — ${o.imie}: ${String(o.opis ?? '').slice(0, 160)}`).join('\n') : '(no characters yet)'}`,
        `FILM: ${film.tytul} — at game event "${film.zdarzenie}" — ${film.sekundy} s\nDESCRIPTION (Polish): ${film.opis}`,
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

/**
 * @param {{ katalogGier: string, gdd: { wczytaj: Function, zapisz: Function },
 *           generuj: (o:{prompt:string, sekundy:number, obrazStartowy?:string}) => Promise<{ok:boolean, zlecenie?:string, powod?:string}>,
 *           stan: (zlecenie:string) => Promise<{ok:boolean, gotowe?:boolean, materialy?:{nazwa:string, sciezka:string}[], blad?:object|null, wToku?:boolean}>,
 *           pisz?: Function|null, obsada?: (projekt:string) => Promise<{id:string, imie:string, opis:string, obraz:string|null}[]>,
 *           kadr?: (o:{prompt:string, referencje:string[]}) => Promise<string>, wgraj?: (sciezka:string) => Promise<string>,
 *           ruchKadru?: (o:{kadr:string, wyjscie:string, filtr:string, sekundy:number}) => Promise<void>,
 *           szyna?: object|null, coMs?: number, limitMs?: number }} o
 */
export function utworzFilmyGry({ katalogGier, gdd, generuj, stan, pisz = null, obsada = async () => [], kadr = null, wgraj = null, ruchKadru = null, szyna = null, coMs = 15_000, limitMs = 4 * 3600_000 }) {
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
        const gotowe = (g?.filmy ?? []).filter((f) => f.stan === 'gotowy' && f.plik).map((f) => ({ id: f.id, zdarzenie: f.zdarzenie, tytul: f.tytul, plik: f.plik }));
        for (const kat of await katalogiFilmow(projekt)) {
            await fs.mkdir(kat, { recursive: true });
            await fs.writeFile(path.join(kat, 'filmy.json'), JSON.stringify({ filmy: gotowe, zmieniono: new Date().toISOString() }, null, 2), 'utf8');
        }
        return gotowe;
    }

    /** Wan: zlecenie → czekanie → plik wideo (ścieżka). */
    async function wanDoPliku(projekt, id, o) {
        const z = await generuj(o);
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

    /** 🎥 Reżyser Wideo: ujęcie z obsadą gry (bez modelu — opis filmu i obsada wybrana przez Suwerena). */
    async function ujecie(film, g, obs) {
        if (!pisz) return { kadr: `${film.opis}. ${g?.sekcje?.wizual ? String(g.sekcje.wizual).slice(0, 200) : 'Stylized 3D fantasy game'} — cinematic keyframe.`, ruch: null, kamera: film.ruch ?? 'najazd', postacie: film.postacie ?? [] };
        const u = odczytajUjecie(await pisz({ system: SYSTEM_REZYSERA_WIDEO, prompt: promptRezyseraWideo(film, g, obs) }), obs);
        if (film.postacie?.length) u.postacie = film.postacie.filter((x) => obs.some((o) => o.id === x));
        if (film.ruch) u.kamera = film.ruch;
        return u;
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
        if (pracuje.has(`${projekt}/${id}`)) throw new Error('Ten film właśnie się liczy.');
        pracuje.add(`${projekt}/${id}`);
        const f0 = await ustawFilm(projekt, id, { stan: 'zlecony', blad: null, kiedy: new Date().toISOString() });
        kolejka = kolejka.then(async () => {
            try {
                let zrodlo;
                if (silnik === 'wan') {
                    const prompt = await promptFilmu(film, g, pisz);
                    await ustawFilm(projekt, id, { prompt });
                    zrodlo = await wanDoPliku(projekt, id, { prompt, sekundy: film.sekundy });
                } else {
                    const obs = await obsada(projekt).catch(() => []);
                    const u = await ujecie(film, g, obs);
                    const zObsady = u.postacie.map((x) => obs.find((o) => o.id === x)).filter(Boolean);
                    const plikKadru = await kadr({ prompt: u.kadr, referencje: zObsady.map((o) => o.obraz).filter(Boolean) });
                    const nazwaKadru = `${id}-kadr.png`;
                    await doGry(projekt, plikKadru, nazwaKadru);
                    const prompt = [u.ruch ?? film.opis, `Camera: ${u.kamera}.`].join(' ').slice(0, 600);
                    await ustawFilm(projekt, id, { kadr: `filmy/${nazwaKadru}`, kadrPrompt: u.kadr, prompt, ruch: u.kamera, obsadaUzyta: zObsady.map((o) => ({ id: o.id, imie: o.imie })) });
                    if (silnik === 'flux') {
                        zrodlo = path.join(path.dirname(plikKadru), `${id}-ruch.mp4`);
                        await ruchKadru({ kadr: plikKadru, wyjscie: zrodlo, filtr: filtrRuchuKadru(u.kamera, film.sekundy), sekundy: film.sekundy });
                    } else {
                        const nazwa = wgraj ? await wgraj(plikKadru) : '';
                        if (!nazwa) throw new Error('Kadr nie trafił do ComfyUI (wgranie) — Wan nie ma od czego zacząć.');
                        zrodlo = await wanDoPliku(projekt, id, { prompt, sekundy: film.sekundy, obrazStartowy: nazwa });
                    }
                }
                const plik = `${id}${path.extname(zrodlo).toLowerCase() || '.mp4'}`;
                await doGry(projekt, zrodlo, plik);
                await ustawFilm(projekt, id, { stan: 'gotowy', plik: `filmy/${plik}`, blad: null, kiedy: new Date().toISOString(), silnikUzyty: silnik });
                await manifest(projekt);
                void szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'praca', tresc: `🎬 film „${film.tytul}” (${film.zdarzenie}, ${silnik}) gotowy w grze „${projekt}”` })?.catch?.(() => {});
            } catch (e) {
                await ustawFilm(projekt, id, { stan: 'blad', blad: String(e.message).slice(0, 300) }).catch(() => {});
                void szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'blad', tresc: `🎬 „${film.tytul}”: ${e.message}` })?.catch?.(() => {});
            } finally { pracuje.delete(`${projekt}/${id}`); }
        });
        return f0;
    }

    return { zlec, manifest, liczy: () => [...pracuje] };
}

export default { utworzFilmyGry, promptFilmu, odczytajUjecie, promptRezyseraWideo, filtrRuchuKadru, RUCHY };
