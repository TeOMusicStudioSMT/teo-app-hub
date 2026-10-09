/**
 * 🎬 Filmy gry — Reżyser Gry zleca cutscenki i intro (Suweren 2026-10-09: „Reżyser Gry może zlecić wszystkie filmy,
 * jakie potrzebuje do realizacji gry… każda walka czy zdarzenie może mieć cutscenkę… czy film wstępny”).
 *
 * Film w GDD (`Gdd.filmy`: zdarzenie, tytuł, opis po polsku, sekundy 2–5) → `zlec`:
 *   1. prompt Wan po angielsku z opisu + świata gry (model Reżysera; gotowy `prompt` w filmie = bez modelu),
 *   2. ComfyUI Wan 2.2 lokalnie (`generuj` — ta sama droga co Klatka i Zlecenia Stada; wspólna karta, jedno naraz),
 *   3. plik do gry: `_OtakOs_Apki/<projekt>/public/filmy/<id>.mp4` + manifest `public/filmy/filmy.json`
 *      {filmy:[{id, zdarzenie, tytul, plik}]} — gra (src/filmy.ts) sama odtwarza film przy zdarzeniu.
 * Stan filmu w GDD: pomysl → zlecony → gotowy | blad (z powodem). Uczciwie: jedno ujęcie, bez dźwięku i dialogu —
 * sceny wieloujęciowe = kilka filmów przy tym samym zdarzeniu (gra gra je po kolei).
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

/**
 * @param {{ katalogGier: string, gdd: { wczytaj: Function, zapisz: Function }, generuj: (o:{prompt:string, sekundy:number}) => Promise<{ok:boolean, zlecenie?:string, powod?:string}>,
 *           stan: (zlecenie:string) => Promise<{ok:boolean, gotowe?:boolean, materialy?:{nazwa:string, sciezka:string}[], blad?:object|null, wToku?:boolean, powod?:string}>,
 *           pisz?: Function|null, szyna?: object|null, coMs?: number, limitMs?: number }} o
 */
export function utworzFilmyGry({ katalogGier, gdd, generuj, stan, pisz = null, szyna = null, coMs = 15_000, limitMs = 4 * 3600_000 }) {
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

    async function manifest(projekt) {
        const g = await gdd.wczytaj(projekt);
        const gotowe = (g?.filmy ?? []).filter((f) => f.stan === 'gotowy' && f.plik).map((f) => ({ id: f.id, zdarzenie: f.zdarzenie, tytul: f.tytul, plik: f.plik }));
        for (const kat of await katalogiFilmow(projekt)) {
            await fs.mkdir(kat, { recursive: true });
            await fs.writeFile(path.join(kat, 'filmy.json'), JSON.stringify({ filmy: gotowe, zmieniono: new Date().toISOString() }, null, 2), 'utf8');
        }
        return gotowe;
    }

    /** Zleć film (w tle, jeden naraz — karta graficzna jest jedna). Wraca od razu ze stanem „zlecony”. */
    async function zlec(projekt, id) {
        const g = await gdd.wczytaj(projekt);
        if (!g) throw new Error('Ten projekt nie ma GDD.');
        const film = (g.filmy ?? []).find((f) => f.id === id);
        if (!film) throw new Error('Nie ma takiego filmu w GDD.');
        if (pracuje.has(`${projekt}/${id}`)) throw new Error('Ten film właśnie się liczy.');
        pracuje.add(`${projekt}/${id}`);
        const f0 = await ustawFilm(projekt, id, { stan: 'zlecony', blad: null, kiedy: new Date().toISOString() });
        kolejka = kolejka.then(async () => {
            try {
                const prompt = await promptFilmu(film, g, pisz);
                await ustawFilm(projekt, id, { prompt });
                const z = await generuj({ prompt, sekundy: film.sekundy });
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
                const plik = `${id}${path.extname(src.sciezka).toLowerCase() || '.mp4'}`;
                for (const kat of await katalogiFilmow(projekt)) { await fs.mkdir(kat, { recursive: true }); await fs.copyFile(src.sciezka, path.join(kat, plik)); }
                await ustawFilm(projekt, id, { stan: 'gotowy', plik: `filmy/${plik}`, blad: null, kiedy: new Date().toISOString() });
                await manifest(projekt);
                void szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'praca', tresc: `🎬 film „${film.tytul}” (${film.zdarzenie}) gotowy w grze „${projekt}”` })?.catch?.(() => {});
            } catch (e) {
                await ustawFilm(projekt, id, { stan: 'blad', blad: String(e.message).slice(0, 300) }).catch(() => {});
                void szyna?.nadaj?.({ agent: 'Reżyser', rodzaj: 'blad', tresc: `🎬 „${film.tytul}”: ${e.message}` })?.catch?.(() => {});
            } finally { pracuje.delete(`${projekt}/${id}`); }
        });
        return f0;
    }

    return { zlec, manifest, liczy: () => [...pracuje] };
}

export default { utworzFilmyGry, promptFilmu };
