/**
 * 🎭 Aktorzy i wywiad o filmie (2026-10-03).
 *
 * Suweren: „jak już mamy scenografię, to i aktorzy… moi aktorzy… interaktywni aktorzy, którzy opowiadają
 * o swym najnowszym dziele — filmie, który właśnie złożyliśmy na YT… wszystko odgrywają nasze TeOgochi…
 * można powołać TeOgochi Aktora”. Zaczynamy od Aktora i wywiadu o filmie.
 *
 * OBSADA (`aktorzy.json`): postać, w którą wciela się TeOgochi Aktor — imię (Kael, Elara…), rola (kim jest,
 * jak mówi), zdjęcie (kadr z projektu), głos (profil / przewód głosu Katedry), kolor. Projekt opcjonalnie.
 *
 * WYWIAD, trzy kroki — każdy prawdziwy i widoczny:
 *   1. SCENARIUSZ: lokalny model (model gatunku `aktor`) pisze rozmowę: prowadzi Kronikarz, goście mówią
 *      W ROLI o filmie — z faktów, które Katedra ma (publikacja YouTube, streszczenia odcinków projektu);
 *      zmyślać faktów nie wolno, interpretować i czuć — tak. Suweren czyta i poprawia kwestie.
 *   2. NAGRANIE: każda kwestia → głos aktora (tor głosu Katedry) → kadr: jego zdjęcie z powolnym najazdem,
 *      pas z imieniem w jego kolorze i napis tego, co mówi; plansza tytułowa na początek.
 *      Bez silnika głosu można świadomie nagrać „bez głosu” (same napisy, cisza) — film to mówi w planszy.
 *   3. FILM ląduje w katalogu montaży projektu (`produkcje/<projekt>/montaz/wywiad_<id>.mp4`) — stamtąd
 *      Montażownia może go oprawić klockami, a „📺 do publikacji” oddać Kronikarzowi i Impresariatowi.
 *
 * ffmpeg jak w Powitaniu Dnia: cwd = katalog roboczy, same względne nazwy, tekst przez `textfile` + `expansion=none`.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { CZCIONKI, zawin, kolorFf, jasniej } from './PowitanieDnia.js';
import { argumentyPodkladu } from './GlosZeStemu.js';

export const SZER = 1280;
export const WYS = 720;
export const FPS = 25;
export const PROWADZACY = { id: 'kronikarz', imie: 'Kronikarz', rola: 'Prowadzący wywiad, TeOgochi-pisarz Katedry OtakOS: ciepły, ciekawy, zadaje krótkie pytania.', kolor: '#a855f7', zdjecie: null, glos: null };
const OBRAZ = /\.(png|jpe?g|webp|bmp)$/i;
export const WIDEO = /\.(mp4|mov|webm|mkv|m4v)$/i;

export const slug = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const bezOgonkow = (s) => slug(s).replace(/-/g, '');

/**
 * Prowadzący z obsady: karta o id `kronikarz` (Suweren 2026-10-03: „nie ma nigdzie opcji dla Kronikarza”) nadpisuje
 * domyślnego Kronikarza — imię, rola, zdjęcie, kolor, głos. Brak karty = domyślny (bez głosu → tor domyślny).
 */
export function prowadzacyZObsady(obsada = []) {
    const k = (Array.isArray(obsada) ? obsada : []).find((a) => a?.id === PROWADZACY.id);
    if (!k) return { ...PROWADZACY };
    return { ...PROWADZACY, imie: k.imie || PROWADZACY.imie, rola: k.rola || PROWADZACY.rola, kolor: k.kolor || PROWADZACY.kolor, zdjecie: k.zdjecie ?? null, glos: k.glos ?? null };
}

/**
 * Język wywiadu (Suweren 2026-10-03: „możliwość zmiany wygenerowanego dialogu na angielski… bym mógł też globalnie
 * tworzyć”): scenariusz od razu w języku, tłumaczenie gotowych kwestii, głos i plansza w tym samym języku.
 */
export const JEZYKI = {
    pl: { nazwa: 'polski', piszesz: 'Piszesz po polsku', tytul: 'WYWIAD', udzial: 'z udziałem', bezGlosu: '(nagranie bez głosu — same napisy)' },
    en: { nazwa: 'angielski', piszesz: 'Całą rozmowę piszesz PO ANGIELSKU (English) — kwestie po angielsku, imiona mówców i format bez zmian', tytul: 'INTERVIEW', udzial: 'featuring', bezGlosu: '(no voice — subtitles only)' },
};
export const jezykWywiadu = (j) => (JEZYKI[j] ? j : 'pl');

/** Prośba do modelu o tłumaczenie kwestii — numerowane linie, żeby mówcy zostali na swoich miejscach. */
export function promptTlumaczenia(kwestie, jezyk, film) {
    const cel = JEZYKI[jezykWywiadu(jezyk)].nazwa;
    const system = [
        `Tłumaczysz dialog krótkiego wywiadu wideo na język: ${cel}. Zachowujesz ton i charakter każdej postaci, piszesz naturalnie, do wypowiedzenia na głos.`,
        'Imiona własne, tytuły i nazwy (postaci, filmów, Katedry OtakOS, TeO) zostają bez zmian.',
        'Odpowiadasz WYŁĄCZNIE liniami w formacie „N. przetłumaczona kwestia” — tyle linii, ile dostałeś, w tej samej kolejności, nic poza tym.',
    ].join('\n');
    const user = [film?.tytul ? `FILM: ${film.tytul}` : null, kwestie.map((k, i) => `${i + 1}. ${k.tekst}`).join('\n')].filter(Boolean).join('\n\n');
    return { system, user };
}

/** Odpowiedź tłumacza → nowe kwestie (te same mówcy, ta sama kolejność). Brak którejś linii = błąd wprost. */
export function odczytajTlumaczenie(surowe, kwestie) {
    const mapa = new Map();
    for (const linia of String(surowe ?? '').replace(/\r/g, '').split('\n')) {
        const m = linia.match(/^\s*\**\s*(\d{1,2})\s*[.)\]:-]\s*(.+)$/);
        if (m) mapa.set(Number(m[1]), m[2].replace(/\*\*|__|`/g, '').replace(/^["„“”'«»\s]+|["„“”'«»\s]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 400));
    }
    const brak = kwestie.map((_, i) => i + 1).filter((n) => !mapa.get(n));
    if (brak.length) throw new Error(`Tłumacz pominął kwestie nr ${brak.slice(0, 6).join(', ')} — spróbuj ponownie albo innym modelem.`);
    return kwestie.map((k, i) => ({ kto: k.kto, tekst: mapa.get(i + 1) }));
}

/** Prośba do modelu o scenariusz wywiadu. */
export function promptWywiadu({ goscie, prowadzacy = PROWADZACY, film, kontekst = '', temat = '', jezyk = 'pl' }) {
    const obsada = goscie.map((a) => `- ${a.imie.toUpperCase()}: ${a.rola || 'postać z filmu'}`).join('\n');
    const system = [
        `Jesteś scenarzystą krótkiego wywiadu wideo Katedry OtakOS. ${JEZYKI[jezykWywiadu(jezyk)].piszesz}, żywo i konkretnie.`,
        `Prowadzi ${prowadzacy.imie.toUpperCase()} (${prowadzacy.rola}). Goście to aktorzy, którzy mówią W SWOICH ROLACH — jako postaci z filmu — o filmie, w którym zagrali.`,
        'Fakty o filmie bierzesz WYŁĄCZNIE z materiału poniżej. Nie wymyślasz scen, nagród ani liczb, których tam nie ma. Uczucia, wspomnienia z planu w roli i interpretacje — tak.',
        'Format — każda kwestia w osobnej linii, nic poza tym:',
        'IMIĘ: tekst kwestii',
        'Zasady: 8–14 kwestii; każda najwyżej 2 zdania (do 220 znaków); bez didaskaliów w nawiasach; zaczyna prowadzący (powitanie i tytuł filmu); każdy gość mówi co najmniej dwa razy; kończy prowadzący zaproszeniem do obejrzenia filmu na YouTube.',
    ].join('\n');
    const user = [
        `FILM: ${film?.tytul || '(bez tytułu)'}`,
        film?.url ? `ADRES: ${film.url}` : null,
        film?.opis ? `OPIS FILMU:\n${String(film.opis).slice(0, 2500)}` : null,
        kontekst ? `MATERIAŁ Z PROJEKTU:\n${String(kontekst).slice(0, 4000)}` : null,
        temat ? `O CZYM SZCZEGÓLNIE ROZMAWIAĆ: ${String(temat).slice(0, 400)}` : null,
        `PROWADZĄCY: ${prowadzacy.imie.toUpperCase()}`,
        `GOŚCIE:\n${obsada}`,
    ].filter(Boolean).join('\n\n');
    return { system, user };
}

/** Odpowiedź modelu → [{ kto (id), tekst }]; mówią tylko prowadzący i goście. Rzuca, gdy za mało. */
export function odczytajScenariusz(surowe, { goscie, prowadzacy = PROWADZACY }) {
    const mowcy = [prowadzacy, ...goscie];
    const ktoTo = (nazwa) => {
        const n = bezOgonkow(nazwa);
        if (!n) return null;
        if (/^(prowadzacy|prowadzaca|host|kronikarz)$/.test(n)) return prowadzacy.id;
        return mowcy.find((m) => bezOgonkow(m.imie) === n || bezOgonkow(m.imie).startsWith(n) || n.startsWith(bezOgonkow(m.imie)))?.id ?? null;
    };
    const kwestie = [];
    for (const linia of String(surowe ?? '').replace(/\r/g, '').split('\n')) {
        const m = linia.match(/^[\s>*•-]*\**\s*([^:*]{2,30}?)\s*\**\s*:\s*(.+)$/);
        if (!m) continue;
        const kto = ktoTo(m[1]);
        if (!kto) continue;
        const tekst = m[2].replace(/\*\*|__|`/g, '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/^["„“”'«»\s]+|["„“”'«»\s]+$/g, '').replace(/\s+/g, ' ').trim();
        if (tekst.length < 2) continue;
        const ostatnia = kwestie.at(-1);
        if (ostatnia?.kto === kto) ostatnia.tekst = `${ostatnia.tekst} ${tekst}`.slice(0, 400);
        else kwestie.push({ kto, tekst: tekst.slice(0, 400) });
    }
    if (kwestie.length < 3) throw new Error('Model nie napisał rozmowy w formacie „IMIĘ: kwestia” — spróbuj ponownie albo innym modelem.');
    return kwestie.slice(0, 20);
}

/**
 * Głos postaci: profil Katedry (`profil` → tor z `/api/voice/profiles`: klon-lokalny, Kokoro, ElevenLabs…),
 * goły przewód/voiceId albo profil VoiceStudio (`voicestudio` — osobny program na :3900, `services/GlosStudio.js`).
 */
export function normalizujGlos(g) {
    if (!g || typeof g !== 'object') return null;
    const pole = (v) => (v ? String(v).slice(0, 80) : undefined);
    const glos = { profil: pole(g.profil), przewod: pole(g.przewod), voiceId: pole(g.voiceId), voicestudio: pole(g.voicestudio) };
    for (const k of Object.keys(glos)) if (glos[k] === undefined) delete glos[k];
    return Object.keys(glos).length ? glos : null;
}

/** Szacowany czas kwestii bez głosu (~14 znaków/s, min. 3 s). */
export const czasBezGlosu = (tekst) => Math.max(3, Math.round((String(tekst).length / 14) * 10) / 10);

/**
 * Argumenty ffmpeg dla jednej kwestii: kadr mówiącego (zdjęcie z najazdem albo jego barwa), pas z imieniem
 * i napis; dźwięk = jego kwestia (albo cisza). Nazwy plików WZGLĘDNE do cwd.
 */
export function argumentyKwestii({ obraz, kolor, imiePlik, liniePliki, czcionka, czas, audio, wyjscie }) {
    const d = Number(czas).toFixed(2), klatek = Math.max(1, Math.round(czas * FPS));
    const wejscieObrazu = obraz ? ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', obraz]
        : ['-f', 'lavfi', '-i', `color=c=${kolorFf(kolor)}:s=${SZER}x${WYS}:r=${FPS}:d=${d}`];
    const wejscieDzwieku = audio ? ['-i', audio] : ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
    const baza = obraz
        ? `scale=${SZER * 1.3}:${WYS * 1.3}:force_original_aspect_ratio=increase,crop=${SZER * 1.3}:${WYS * 1.3},zoompan=z='1+0.08*on/${klatek}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${SZER}x${WYS}:fps=${FPS}`
        : `vignette=PI/4`;
    const gora = WYS - 60 - 46 - liniePliki.length * 42;
    const pas = `,drawbox=x=0:y=${gora - 24}:w=iw:h=${WYS - gora + 24}:color=black@0.55:t=fill,drawbox=x=48:y=${gora - 6}:w=6:h=42:color=${kolorFf(kolor)}:t=fill`;
    const imie = `,drawtext=fontfile=${czcionka}:textfile=${imiePlik}:expansion=none:fontsize=36:fontcolor=${jasniej(kolor)}:x=68:y=${gora}`;
    const napisy = liniePliki.map((p, i) => `,drawtext=fontfile=${czcionka}:textfile=${p}:expansion=none:fontsize=32:fontcolor=white:x=68:y=${gora + 52 + i * 42}:shadowcolor=black@0.7:shadowx=2:shadowy=2`).join('');
    const filtr = `[0:v]${baza}${pas}${imie}${napisy},fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, czas - 0.25).toFixed(2)}:d=0.25,format=yuv420p[v];`
        + `[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${d}[a]`;
    return ['-y', ...wejscieObrazu, ...wejscieDzwieku, '-filter_complex', filtr, '-map', '[v]', '-map', '[a]', '-t', d, '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', wyjscie];
}

/**
 * @param {{ katalog:string, chat:(model:string|null, system:string, user:string)=>Promise<{tekst:string, silnik?:string}>,
 *   modelDla?:(id:string)=>Promise<string|null>, kontekst?:(projekt:string)=>Promise<{film?:object|null, opis?:string}>,
 *   mow?:(o:{tekst:string, glos:object|null})=>Promise<{audio:Buffer, ext:string}>, opisz:(p:string)=>Promise<{sekundy:number|null}>,
 *   katalogMontazy:(projekt:string)=>Promise<string>, ffmpeg?:string, szyna?:any, teraz?:()=>number,
 *   sciezkaPodkladu?:(plik:string)=>string }} o   sciezkaPodkladu: plik z biblioteki muzyki → pełna ścieżka (rzuca poza nią)
 */
export function utworzWywiady(o) {
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), modelDla: async () => null, kontekst: async () => ({}), ...o };
    const PLIK_AKTOROW = path.join(cfg.katalog, 'aktorzy.json');
    const KAT_WYWIADOW = path.join(cfg.katalog, 'wywiady');
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Aktor', rodzaj: 'praca', tresc })?.catch?.(() => {});
    const wRobocie = new Map();   // id wywiadu → { etap, zrobione, wszystkich }

    const czytaj = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const pisz = async (p, d) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(`${p}.tmp`, JSON.stringify(d, null, 1), 'utf8'); await fs.rename(`${p}.tmp`, p); };

    // ── Obsada ────────────────────────────────────────────────────────────
    async function aktorzy() { const l = await czytaj(PLIK_AKTOROW, []); return Array.isArray(l) ? l : []; }

    async function zapiszAktora(dane = {}) {
        const imie = String(dane.imie ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        if (!imie) throw new Error('Aktor potrzebuje imienia postaci.');
        const id = dane.id && /^[a-z0-9-]{1,40}$/.test(dane.id) ? dane.id : slug(imie) || `aktor-${cfg.teraz().toString(36)}`;
        const zdjecie = dane.zdjecie ? String(dane.zdjecie).trim() : null;
        if (zdjecie && (!OBRAZ.test(zdjecie) || !fsSync.existsSync(zdjecie))) throw new Error(`Zdjęcie aktora musi być istniejącym obrazem (png/jpg/webp): ${zdjecie}`);
        // Wideo aktora (krótki klip w jego roli): w Studiu Podcastu gra na karcie gościa zamiast zdjęcia. Pusty/null = zdejmij.
        const wideo = dane.wideo ? String(dane.wideo).trim() : null;
        if (wideo && (!WIDEO.test(wideo) || !fsSync.existsSync(wideo))) throw new Error(`Wideo aktora musi być istniejącym plikiem (mp4/mov/webm/mkv): ${wideo}`);
        const glos = normalizujGlos(dane.glos);
        const aktor = {
            id, imie, rola: String(dane.rola ?? '').trim().slice(0, 600), projekt: dane.projekt ? String(dane.projekt).slice(0, 80) : null,
            zdjecie, wideo, glos, kolor: /^#[0-9a-f]{6}$/i.test(dane.kolor ?? '') ? dane.kolor : '#f4c84a', zmieniono: czas(),
        };
        const l = await aktorzy();
        await pisz(PLIK_AKTOROW, [...l.filter((a) => a.id !== id), aktor]);
        return aktor;
    }

    async function usunAktora(id) { await pisz(PLIK_AKTOROW, (await aktorzy()).filter((a) => a.id !== id)); return { id }; }

    // ── Wywiady ───────────────────────────────────────────────────────────
    const plikWywiadu = (id) => path.join(KAT_WYWIADOW, id, 'wywiad.json');
    async function wczytajWywiad(id) {
        if (!/^w_[a-z0-9]+$/.test(String(id))) throw new Error('Złe id wywiadu.');
        const w = await czytaj(plikWywiadu(id), null);
        if (!w) throw new Error('Nie ma takiego wywiadu.');
        return { ...w, ...(wRobocie.has(id) ? { postep: wRobocie.get(id) } : {}) };
    }
    async function wywiady() {
        const katalogi = await fs.readdir(KAT_WYWIADOW).catch(() => []);
        const l = [];
        for (const k of katalogi) { const w = await czytaj(plikWywiadu(k), null); if (w) l.push({ ...w, ...(wRobocie.has(k) ? { postep: wRobocie.get(k) } : {}) }); }
        return l.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    /** Krok 1: scenariusz od lokalnego modelu (gatunek `aktor`, potem Kronikarz, potem domyślny). */
    async function przygotuj({ projekt = '', goscie: ids = [], temat = '', film: filmPodany = null, jezyk: jezykZadany = 'pl' } = {}) {
        const jezyk = jezykWywiadu(jezykZadany);
        if (!String(projekt).trim()) throw new Error('Wywiad dotyczy filmu z projektu — podaj projekt.');
        const obsada = await aktorzy();
        const prowadzacy = prowadzacyZObsady(obsada);
        const goscie = (Array.isArray(ids) ? ids : []).filter((id) => id !== PROWADZACY.id).map((id) => obsada.find((a) => a.id === id)).filter(Boolean).slice(0, 3);
        if (!goscie.length) throw new Error('Wybierz co najmniej jednego aktora (najwyżej trzech).');
        const k = await cfg.kontekst(projekt).catch(() => ({}));
        const film = filmPodany?.tytul ? filmPodany : k?.film ?? { tytul: projekt };
        const { system, user } = promptWywiadu({ goscie, prowadzacy, film, kontekst: k?.opis ?? '', temat, jezyk });
        const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
        const { tekst, silnik } = await cfg.chat(model, system, user);
        const kwestie = odczytajScenariusz(tekst, { goscie, prowadzacy });
        const id = `w_${cfg.teraz().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const w = { id, projekt, film, temat: String(temat).slice(0, 400), goscie: goscie.map((g) => g.id), kwestie, jezyk, model: silnik ?? model ?? null, etap: 'scenariusz', utworzono: czas() };
        await pisz(plikWywiadu(id), w);
        nadaj(`napisał scenariusz wywiadu o „${film.tytul}” z ${goscie.map((g) => g.imie).join(', ')}`);
        return w;
    }

    /** Suweren poprawia kwestie przed nagraniem. */
    async function zmien(id, { kwestie } = {}) {
        const w = await wczytajWywiad(id);
        if (w.etap === 'nagrywa') throw new Error('Wywiad właśnie się nagrywa.');
        const mowcy = new Set([PROWADZACY.id, ...w.goscie]);
        const nowe = (Array.isArray(kwestie) ? kwestie : []).map((x) => ({ kto: String(x?.kto ?? ''), tekst: String(x?.tekst ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) })).filter((x) => mowcy.has(x.kto) && x.tekst);
        if (nowe.length < 2) throw new Error('Wywiad potrzebuje co najmniej dwóch kwestii.');
        const { postep, ...zapis } = w;
        Object.assign(zapis, { kwestie: nowe.slice(0, 30), etap: 'scenariusz', plik: undefined, blad: undefined });
        await pisz(plikWywiadu(id), zapis);
        return zapis;
    }

    /**
     * Tłumaczenie gotowego dialogu (np. na angielski — wywiad dla świata). Mówcy i kolejność zostają; pierwsza
     * wersja zostaje w `oryginal`, więc powrót do niej to `przetlumacz(id, {jezyk: oryginal.jezyk})` bez modelu.
     */
    async function przetlumacz(id, { jezyk: jezykZadany = 'en' } = {}) {
        const w = await wczytajWywiad(id);
        if (w.etap === 'nagrywa') throw new Error('Wywiad właśnie się nagrywa.');
        const jezyk = jezykWywiadu(jezykZadany);
        const obecny = jezykWywiadu(w.jezyk);
        if (jezyk === obecny) throw new Error(`Wywiad już jest w języku: ${JEZYKI[jezyk].nazwa}.`);
        const { postep, ...zapis } = w;
        const oryginal = w.oryginal ?? { jezyk: obecny, kwestie: w.kwestie };
        let kwestie, silnik = null;
        if (oryginal.jezyk === jezyk) kwestie = oryginal.kwestie;   // powrót do pierwszej wersji — bez modelu
        else {
            const { system, user } = promptTlumaczenia(w.kwestie, jezyk, w.film);
            const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
            const odp = await cfg.chat(model, system, user);
            kwestie = odczytajTlumaczenie(odp.tekst, w.kwestie);
            silnik = odp.silnik ?? model ?? null;
        }
        Object.assign(zapis, { kwestie, jezyk, oryginal, etap: 'scenariusz', plik: undefined, blad: undefined, ...(silnik ? { tlumacz: silnik } : {}) });
        await pisz(plikWywiadu(id), zapis);
        nadaj(`przetłumaczył wywiad o „${w.film?.tytul ?? w.projekt}” na ${JEZYKI[jezyk].nazwa}`);
        return zapis;
    }

    async function ffmpeg(args, cwd) {
        await new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, windowsHide: true, timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 },
            (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`)) : ok())));
    }

    /**
     * Krok 2 + 3: głos, kadry, film w katalogu montaży projektu. Startuje w tle; stan w `postep`.
     * `podklad` = utwór (najlepiej instrumental ze `_Stemy`) cicho pod rozmową; `glosnosc` 0.02–0.6.
     */
    async function nagraj(id, { bezGlosu = false, podklad = null, glosnosc = 0.12, glosProwadzacego = undefined } = {}) {
        const w = await wczytajWywiad(id);
        if (wRobocie.has(id)) throw new Error('Ten wywiad już się nagrywa.');
        if (!bezGlosu && !cfg.mow) throw new Error('Katedra nie ma silnika głosu — nagraj „bez głosu” (same napisy).');
        let plikPodkladu = null;
        if (podklad) {
            if (!cfg.sciezkaPodkladu) throw new Error('Ta Katedra nie zna biblioteki muzyki — nagraj bez podkładu.');
            plikPodkladu = cfg.sciezkaPodkladu(String(podklad));
            if (!fsSync.existsSync(plikPodkladu)) throw new Error(`Nie ma podkładu: ${path.basename(plikPodkladu)}`);
        }
        const obsada = await aktorzy();
        const { postep, ...zapis } = w;
        if (glosProwadzacego !== undefined) zapis.glosProwadzacego = normalizujGlos(glosProwadzacego);
        // Głos prowadzącego: wybór przy nagraniu (glosProwadzacego) → karta Kronikarza w obsadzie → tor domyślny.
        const karta = prowadzacyZObsady(obsada);
        const prowadzacy = { ...karta, glos: zapis.glosProwadzacego ?? karta.glos ?? null };
        const mowca = (kto) => (kto === PROWADZACY.id ? prowadzacy : obsada.find((a) => a.id === kto)) ?? { ...PROWADZACY, id: kto, imie: kto };
        Object.assign(zapis, { etap: 'nagrywa', bezGlosu: !!bezGlosu, podklad: plikPodkladu ? path.basename(plikPodkladu) : null, blad: undefined, nagrywanoOd: czas() });
        await pisz(plikWywiadu(id), zapis);
        wRobocie.set(id, { etap: 'start', zrobione: 0, wszystkich: w.kwestie.length + 1 });
        void (async () => {
            const praca = path.join(KAT_WYWIADOW, id, 'praca');
            try {
                await fs.rm(praca, { recursive: true, force: true });
                await fs.mkdir(praca, { recursive: true });
                const zrodlo = CZCIONKI.find((p) => fsSync.existsSync(p));
                if (!zrodlo) throw new Error('Nie znalazłem czcionki z polskimi znakami (OTAKOS_POWITANIE_CZCIONKA).');
                await fs.copyFile(zrodlo, path.join(praca, 'czcionka.ttf'));
                const segmenty = [];
                // Plansza tytułowa — mówi, kto gra i czy to nagranie bez głosu.
                const goscieImiona = w.goscie.map((g) => mowca(g).imie).join(', ');
                const J = JEZYKI[jezykWywiadu(w.jezyk)];
                await fs.writeFile(path.join(praca, 't-imie.txt'), J.tytul, 'utf8');
                const linieTytulu = [...zawin(w.film?.tytul ?? w.projekt, 52, 2), `${J.udzial}: ${goscieImiona}`, ...(bezGlosu ? [J.bezGlosu] : [])];
                const plikiTytulu = [];
                for (const [i, l] of linieTytulu.entries()) { const n = `t-${i}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); plikiTytulu.push(n); }
                await ffmpeg(argumentyKwestii({ obraz: null, kolor: prowadzacy.kolor, imiePlik: 't-imie.txt', liniePliki: plikiTytulu, czcionka: 'czcionka.ttf', czas: 3.5, audio: null, wyjscie: 'seg-000.mp4' }), praca);
                segmenty.push('seg-000.mp4');
                wRobocie.set(id, { etap: 'plansza', zrobione: 1, wszystkich: w.kwestie.length + 1 });
                for (const [i, kw] of w.kwestie.entries()) {
                    const m = mowca(kw.kto);
                    wRobocie.set(id, { etap: `${m.imie}: ${bezGlosu ? 'kadr' : 'głos'}`, zrobione: i + 1, wszystkich: w.kwestie.length + 1 });
                    let audio = null, dl = czasBezGlosu(kw.tekst);
                    if (!bezGlosu) {
                        const g = await cfg.mow({ tekst: kw.tekst, glos: m.glos ?? null, jezyk: jezykWywiadu(w.jezyk) }).catch((e) => { throw new Error(`Głos „${m.imie}”: ${e.message}`); });
                        audio = `a-${String(i + 1).padStart(3, '0')}.${g.ext || 'wav'}`;
                        await fs.writeFile(path.join(praca, audio), g.audio);
                        const s = (await cfg.opisz(path.join(praca, audio)).catch(() => null))?.sekundy;
                        if (s) dl = Math.round((s + 0.45) * 100) / 100;
                    }
                    let obraz = null;
                    if (m.zdjecie && fsSync.existsSync(m.zdjecie)) { obraz = `o-${m.id}${path.extname(m.zdjecie).toLowerCase()}`; if (!fsSync.existsSync(path.join(praca, obraz))) await fs.copyFile(m.zdjecie, path.join(praca, obraz)); }
                    const nr = String(i + 1).padStart(3, '0');
                    await fs.writeFile(path.join(praca, `i-${nr}.txt`), m.imie, 'utf8');
                    const linie = zawin(kw.tekst, 62, 4);
                    const pliki = [];
                    for (const [j, l] of linie.entries()) { const n = `l-${nr}-${j}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); pliki.push(n); }
                    await ffmpeg(argumentyKwestii({ obraz, kolor: m.kolor, imiePlik: `i-${nr}.txt`, liniePliki: pliki, czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: `seg-${nr}.mp4` }), praca);
                    segmenty.push(`seg-${nr}.mp4`);
                }
                wRobocie.set(id, { etap: 'sklejanie', zrobione: w.kwestie.length + 1, wszystkich: w.kwestie.length + 1 });
                await fs.writeFile(path.join(praca, 'lista.txt'), segmenty.map((s) => `file '${s}'`).join('\n'), 'utf8');
                await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', 'wywiad.mp4'], praca);
                let gotowy = 'wywiad.mp4';
                if (plikPodkladu) {
                    wRobocie.set(id, { etap: 'podkład', zrobione: w.kwestie.length + 1, wszystkich: w.kwestie.length + 1 });
                    const ext = path.extname(plikPodkladu).toLowerCase();
                    await fs.copyFile(plikPodkladu, path.join(praca, `podklad${ext}`));
                    const dl = (await cfg.opisz(path.join(praca, 'wywiad.mp4')).catch(() => null))?.sekundy ?? 0;
                    await ffmpeg(argumentyPodkladu({ film: 'wywiad.mp4', podklad: `podklad${ext}`, wyjscie: 'wywiad-p.mp4', sekundy: dl, glosnosc }), praca);
                    gotowy = 'wywiad-p.mp4';
                }
                const katMontazy = await cfg.katalogMontazy(w.projekt);
                const cel = path.join(katMontazy, `wywiad_${slug(w.film?.tytul || w.projekt) || 'film'}${jezykWywiadu(w.jezyk) === 'pl' ? '' : `_${jezykWywiadu(w.jezyk)}`}_${id.slice(2)}.mp4`);
                await fs.copyFile(path.join(praca, gotowy), cel);
                const o2 = await cfg.opisz(cel).catch(() => null);
                Object.assign(zapis, { etap: 'gotowy', plik: cel, sekundy: o2?.sekundy ?? null, nagrano: czas() });
                await pisz(plikWywiadu(id), zapis);
                nadaj(`wywiad o „${w.film?.tytul ?? w.projekt}” nagrany (${goscieImiona}) — w montażach projektu`);
                await fs.rm(praca, { recursive: true, force: true }).catch(() => {});
            } catch (e) {
                Object.assign(zapis, { etap: 'blad', blad: String(e.message || e).slice(0, 500) });
                await pisz(plikWywiadu(id), zapis).catch(() => {});
            } finally { wRobocie.delete(id); }
        })();
        return { ...zapis, postep: wRobocie.get(id) };
    }

    return { aktorzy, zapiszAktora, usunAktora, wywiady, wywiad: wczytajWywiad, przygotuj, zmien, przetlumacz, nagraj, mowa: (o) => cfg.mow(o) };
}

export default { utworzWywiady, normalizujGlos, prowadzacyZObsady, promptTlumaczenia, odczytajTlumaczenie, JEZYKI, promptWywiadu, odczytajScenariusz, argumentyKwestii, czasBezGlosu, PROWADZACY, slug };
