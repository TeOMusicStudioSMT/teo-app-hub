/**
 * 🌅 Powitanie Dnia — codzienny film od stada TeOgochi dla Suwerena.
 *
 * Suweren (2026-09-26): „codzienny filmik z powitaniem dla Suwerena od Katedralnych TeOgochich…
 * forma ma być FILM, i w nim te sentencje są zawarte jako obraz — tak uczuciowo".
 *
 * JAK POWSTAJE
 *   1. KTO: wyklute TeOgochi (najpierw ci, którzy przez ostatnią dobę coś robili) — do MAX_SCEN.
 *   2. SENTENCJA: każdy, na SWOIM modelu (ModeleAgentow), pisze jedno zdanie do Suwerena —
 *      z tego, co naprawdę zrobił (ślady na szynie) — i jedno zdanie po angielsku: OBRAZ, czyli
 *      uczucie tej sentencji jako ujęcie dla generatora wideo.
 *   3. OBRAZ SCENY, od najlepszego:
 *        · ujęcie z ComfyUI z jego zdania OBRAZ (ta sama droga co zlecenia stada: /api/wideo/*),
 *        · jego prawdziwe dzieło z dysku (klocek z obrazem) z powolnym najazdem kamery,
 *        · pole w jego barwie.
 *      Każda scena zapisuje, z czego powstała — film nie udaje, że ComfyUI coś liczyło.
 *   4. SENTENCJA W OBRAZIE: ffmpeg wpisuje zdanie w kadr (drawtext), z podpisem autora
 *      w jego kolorze; tytuł „Dzień dobry, Suwerenie" na początek, zamknięcie na koniec.
 *   5. MUZYKA: najnowszy utwór z _OtakOs_Muzyka (jeśli jest) — zapętlony, wyciszony na końcu.
 *
 * KIEDY: raz na dobę, od OTAKOS_POWITANIE_GODZINA (domyślnie 5:00) — albo przy pierwszym starcie
 * Katedry po tej godzinie. Nieudana próba NIE ponawia się sama co 10 minut (karta graficzna
 * nie mieli w kółko); ponowić można ręcznie przy Katedrze.
 *
 * ⚠️ FFMPEG WOŁAMY Z KATALOGIEM ROBOCZYM JAKO cwd I SAMYMI WZGLĘDNYMI NAZWAMI (czcionka, pliki
 * tekstu, obrazy). W filtrach ffmpeg dwukropek dysku Windowsa („C:") trzeba by ucieczkować —
 * względne nazwy omijają ten problem na każdym systemie. Tekst idzie przez `textfile`
 * z `expansion=none`, więc apostrof, dwukropek czy „%" w sentencji nie psują filtra.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import * as ZleceniaStada from './ZleceniaStada.js';

export const SZER = 1280, WYS = 720, FPS = 25;
export const MAX_SCEN = 5;
export const CZAS = { tytul: 4.5, scena: 7, koniec: 4.5 };
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Czcionki z polskimi znakami, po kolei; pierwsza istniejąca wygrywa. */
export const CZCIONKI = [
    process.env.OTAKOS_POWITANIE_CZCIONKA,
    'C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Georgia.ttf', '/Library/Fonts/Arial.ttf',
].filter(Boolean);

let cfg = {
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'powitania'),
    szyna: null,
    /** (model, messages) → tekst */
    chat: async () => { throw new Error('Brak silnika czatu.'); },
    modelDla: async () => null,
    domyslnyModel: 'gemma4:e2b',
    karta: async () => null,
    /** → [{ id, imie, kolor, forma, dziedzina, wyklute, xp }] */
    gatunki: async () => [],
    /** → zdarzenia szyny (najnowsze na końcu) */
    zdarzenia: () => [],
    /** id gatunku → [{ media:{typ,url} }] — prawdziwe dzieła (klocki) */
    dziela: async () => [],
    /** url z mostu → Buffer */
    pobierz: null,
    /** (ścieżka, body?) → JSON z trasy mostu — do ujęć z ComfyUI; bez niego sceny są z dzieł. */
    most: null,
    /** → ścieżka utworu albo null */
    muzyka: async () => null,
    ffmpeg: 'ffmpeg',
    wideo: process.env.OTAKOS_POWITANIE_WIDEO !== '0',
    godzina: Number(process.env.OTAKOS_POWITANIE_GODZINA ?? 5),
    limitUjeciaMs: 30 * 60_000,
    odstepMs: 10_000,
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

let biezace = null;   // { data, etap, od } — powitanie w robocie w TYM procesie mostu

// ── Czyste klocki (testowane w tests/powitanie.test.mjs) ─────────────────────

/** Lokalna data maszyny Suwerena, RRRR-MM-DD (nie UTC — „dziś" to dziś u niego). */
export function dzien(d = new Date()) {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** „sobota, 27 września" — po polsku, bez zależności od ICU systemu. */
export function dataSlownie(data) {
    const [r, m, d] = data.split('-').map(Number);
    const dni = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
    const mies = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
    return `${dni[new Date(r, m - 1, d).getDay()]}, ${d} ${mies[m - 1]}`;
}

/** Ślady agenta z ostatniej doby (po imieniu albo id), najnowsze pierwsze. */
export function sladyDoby(g, zdarzenia, teraz = Date.now()) {
    const kto = new Set([String(g.imie ?? '').toLowerCase(), String(g.id ?? '').toLowerCase()]);
    return zdarzenia
        .filter((z) => kto.has(String(z.agent ?? '').toLowerCase()) && teraz - (Date.parse(z.kiedy) || 0) < 24 * 3600_000)
        .reverse();
}

/** Wyklute, najpierw aktywne w ostatniej dobie (więcej śladów wyżej), potem wg XP. */
export function wybierzUczestnikow(gatunki, zdarzenia, { max = MAX_SCEN, teraz = Date.now() } = {}) {
    return gatunki.filter((g) => g.wyklute)
        .map((g) => ({ g, slady: sladyDoby(g, zdarzenia, teraz) }))
        .sort((a, b) => b.slady.length - a.slady.length || (b.g.xp ?? 0) - (a.g.xp ?? 0))
        .slice(0, max);
}

export function wiadomosci({ g, slady, karta, data, reszta = [] }) {
    const system = `${karta?.tresc ?? `Jesteś ${g.imie} — TeOgochi Katedry OtakOS (${g.dziedzina ?? 'stado'}).`}

PISZESZ PORANNE POWITANIE DLA SUWERENA — jedną sentencję, która stanie się kadrem filmu.
Mów od siebie, ciepło i z uczuciem, jak ktoś bliski. Po polsku, bez emoji, bez cudzysłowów, bez markdownu.
Opieraj się na tym, co NAPRAWDĘ robiłeś (ślady niżej); nie wymyślaj dzieł, których nie było.`;
    const user = `DZIŚ: ${dataSlownie(data)}.
TWOJE ŚLADY Z OSTATNIEJ DOBY:
${slady.length ? slady.slice(0, 8).map((s) => `— ${s.tresc ?? s.rodzaj}`).join('\n') : '— cisza: odpoczywałeś i czekałeś na Suwerena'}
${reszta.length ? `\nRESZTA STADA W FILMIE: ${reszta.join(', ')}.` : ''}

Odpowiedz DOKŁADNIE dwiema liniami:
SENTENCJA: jedno zdanie do Suwerena (do 110 znaków).
OBRAZ: one English sentence — the feeling of your sentence as a cinematic shot for a video generator (light, place, motion; no text, no letters).`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** Odpowiedź modelu → { sentencja, obraz }. Bez linii SENTENCJA: pierwsze sensowne zdanie. */
export function odczytaj(surowe) {
    const t = String(surowe ?? '').replace(/\r/g, '');
    const linia = (z) => t.match(new RegExp(`^[\\s>*•-]*\\**${z}\\**\\s*:\\s*(.+)$`, 'im'))?.[1];
    const czysc = (s) => String(s ?? '').replace(/\*\*|__|`/g, '').replace(/^["„“”'«»\s]+|["„“”'«»\s]+$/g, '').replace(/\s+/g, ' ').trim();
    let sentencja = czysc(linia('SENTENCJA'));
    if (!sentencja) sentencja = czysc(t.split('\n').find((l) => l.trim() && !/^\s*OBRAZ\s*:/i.test(l)));
    if (sentencja.length > 140) sentencja = `${sentencja.slice(0, 137).replace(/\s+\S*$/, '')}…`;
    return { sentencja, obraz: czysc(linia('OBRAZ')).slice(0, 400) || null };
}

/** Zawiń tekst w linie do `szer` znaków (po słowach), najwyżej `maxLinii` (ostatnia z „…"). */
export function zawin(tekst, szer = 34, maxLinii = 4) {
    const linie = [];
    let l = '';
    for (const s of String(tekst).split(/\s+/).filter(Boolean)) {
        if (l && (l + ' ' + s).length > szer) { linie.push(l); l = s; } else l = l ? `${l} ${s}` : s;
    }
    if (l) linie.push(l);
    if (linie.length > maxLinii) { linie.length = maxLinii; linie[maxLinii - 1] = `${linie[maxLinii - 1].replace(/[.,;:!?…]*$/, '')}…`; }
    return linie;
}

/** „#a855f7" → „0xa855f7" (ffmpeg); śmieci → złoto Katedry. */
export const kolorFf = (hex) => (/^#?[0-9a-f]{6}$/i.test(String(hex ?? '')) ? `0x${String(hex).replace('#', '')}` : '0xf4c84a');

/** Rozjaśniony kolor podpisu — ciemny fiolet czy granat ginie na obrazie. */
export function jasniej(hex, ile = 0.45) {
    const h = kolorFf(hex).slice(2);
    const c = [0, 2, 4].map((i) => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (255 - v) * ile).toString(16).padStart(2, '0'); });
    return `0x${c.join('')}`;
}

/** Przyciemniony kolor tła sceny bez dzieła i bez ujęcia. */
export function tloZKoloru(hex, mnoznik = 0.28) {
    const h = kolorFf(hex).slice(2);
    const c = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * mnoznik).toString(16).padStart(2, '0'));
    return `0x${c.join('')}`;
}

/**
 * Argumenty ffmpeg dla jednej sceny (wideo bez dźwięku, SZER×WYS, FPS). Wszystkie nazwy
 * plików WZGLĘDNE do katalogu roboczego (cwd procesu).
 * @param {{ tlo:{rodzaj:'ujecie'|'dzielo'|'kolor', plik?:string, kolor?:string}, linie:{plik:string, rozmiar:number, kolor:string, y:number}[], czcionka:string, czas:number, wyjscie:string }} s
 */
export function argumentySceny({ tlo, linie, czcionka, czas, wyjscie }) {
    const d = czas.toFixed(2), klatek = Math.round(czas * FPS);
    const wejscie = tlo.rodzaj === 'ujecie' ? ['-stream_loop', '-1', '-i', tlo.plik]
        : tlo.rodzaj === 'dzielo' ? ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', tlo.plik]
            : ['-f', 'lavfi', '-i', `color=c=${tlo.kolor}:s=${SZER}x${WYS}:r=${FPS}:d=${d}`];
    const baza = tlo.rodzaj === 'ujecie'
        // ujęcie Wana to ~2–3 s: zwalniamy (uczuciowo) i zapętlamy do długości sceny
        ? `setpts=1.6*PTS,scale=${SZER}:${WYS}:force_original_aspect_ratio=increase,crop=${SZER}:${WYS},fps=${FPS},trim=duration=${d},setpts=PTS-STARTPTS,eq=brightness=-0.06`
        : tlo.rodzaj === 'dzielo'
            // powolny najazd kamery na prawdziwe dzieło (Ken Burns)
            ? `scale=${SZER * 1.5}:${WYS * 1.5}:force_original_aspect_ratio=increase,crop=${SZER * 1.5}:${WYS * 1.5},zoompan=z='1+0.12*on/${klatek}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${SZER}x${WYS}:fps=${FPS},eq=brightness=-0.1`
            : 'vignette=PI/4';
    // Ciemny pas pod napisem tylko na obrazie (ujęcie, dzieło) — na gładkiej barwie tekst czyta się sam, a pas byłby prostokątem.
    const pas = linie.length && tlo.rodzaj !== 'kolor' ? `,drawbox=x=0:y=${Math.min(...linie.map((l) => l.y)) - 36}:w=iw:h=${Math.max(...linie.map((l) => l.y + l.rozmiar)) - Math.min(...linie.map((l) => l.y)) + 72}:color=black@0.42:t=fill` : '';
    // Tekst wchodzi po chwili i gaśnie przed końcem — kadr najpierw oddycha obrazem.
    const alfa = `if(lt(t,0.7),0,if(lt(t,1.7),t-0.7,if(gt(t,${d}-0.8),max(0,(${d}-t)/0.8),1)))`;
    const napisy = linie.map((l) => `,drawtext=fontfile=${czcionka}:textfile=${l.plik}:expansion=none:fontsize=${l.rozmiar}:fontcolor=${l.kolor}:x=(w-text_w)/2:y=${l.y + Math.round(l.rozmiar * 0.8)}-ascent:shadowcolor=black@0.7:shadowx=2:shadowy=2:alpha='${alfa}'`).join('');
    const filtr = `[0:v]${baza}${pas}${napisy},fade=t=in:st=0:d=0.6,fade=t=out:st=${(czas - 0.6).toFixed(2)}:d=0.6,format=yuv420p[v]`;
    return ['-y', ...wejscie, '-filter_complex', filtr, '-map', '[v]', '-t', d, '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an', wyjscie];
}

/** Linie napisu → pozycje (wyśrodkowany blok w dolnej części kadru) + podpis. */
export function ulozNapis(linie, { rozmiar = 50, podpis = null, kolorPodpisu = '0xf4c84a', srodek = WYS * 0.72, kolor = 'white' } = {}) {
    const odstep = Math.round(rozmiar * 1.3);
    const wszystkie = [...linie.map((t) => ({ t, rozmiar, kolor })), ...(podpis ? [{ t: podpis, rozmiar: Math.round(rozmiar * 0.62), kolor: kolorPodpisu, podpis: true }] : [])];
    const wysokosc = wszystkie.reduce((s, l) => s + (l.podpis ? Math.round(l.rozmiar * 1.9) : odstep), 0);
    let y = Math.round(srodek - wysokosc / 2);
    return wszystkie.map((l) => { const out = { ...l, y: l.podpis ? y + Math.round(l.rozmiar * 0.5) : y }; y += l.podpis ? Math.round(l.rozmiar * 1.9) : odstep; return out; });
}

// ── Robota ───────────────────────────────────────────────────────────────────

const katDnia = (data) => path.join(cfg.katalog, data);
const plikMeta = (data) => path.join(katDnia(data), 'powitanie.json');
export const plikFilmu = (data) => path.join(katDnia(data), 'powitanie.mp4');

function nadaj(tresc) {
    cfg.szyna?.nadaj({ agent: 'Stado', rodzaj: 'powitanie', tresc }).catch?.(() => {});
}

function ffmpeg(args, cwd) {
    return new Promise((ok, zle) => {
        execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, windowsHide: true, timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 }, (e, _o, err) => {
            if (e) zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`));
            else ok();
        });
    });
}

async function czcionka(cel) {
    const zrodlo = CZCIONKI.find((p) => fsSync.existsSync(p));
    if (!zrodlo) throw new Error('Nie znalazłem czcionki z polskimi znakami (ustaw OTAKOS_POWITANIE_CZCIONKA na plik .ttf).');
    await fs.copyFile(zrodlo, path.join(cel, 'czcionka.ttf'));
    return 'czcionka.ttf';
}

/** Tło sceny: ujęcie z ComfyUI → dzieło z dysku → barwa. Zwraca opis + (dla ujęcia/dzieła) plik w katalogu roboczym. */
async function tloSceny({ u, s, praca, i, stanComfy, data }) {
    if (cfg.wideo && cfg.most && s.obraz && !stanComfy.padlo) {
        try {
            biezace.etap = `${u.g.imie}: ujęcie w ComfyUI`;
            const w = await ZleceniaStada.wykonaj(
                { id: `powitanie-${data}-${u.g.id}`, modul: 'wideo', agent: u.g.id, imie: u.g.imie, argumenty: { prompt: s.obraz } },
                { most: cfg.most, projekt: { id: `powitanie-${data}`, nazwa: 'Powitania' }, odstepMs: cfg.odstepMs, limityMs: { wideo: cfg.limitUjeciaMs } },
            );
            if (w?.plik && fsSync.existsSync(w.plik)) {
                const nazwa = `ujecie-${i}${path.extname(w.plik) || '.mp4'}`;
                await fs.copyFile(w.plik, path.join(praca, nazwa));
                return { rodzaj: 'ujecie', plik: nazwa, zrodlo: w.plik };
            }
        } catch (e) {
            // ComfyUI śpi / brak wag — reszta scen nie czeka na to samo po 30 minut.
            stanComfy.padlo = true; stanComfy.powod = String(e.message || e).slice(0, 200);
        }
    }
    if (cfg.pobierz) {
        const obrazy = (await cfg.dziela(u.g.id).catch(() => [])).filter((k) => k.media?.typ === 'obraz' && k.media.url);
        for (const k of obrazy.slice(0, 3)) {
            try {
                const bajty = await cfg.pobierz(k.media.url);
                if (!bajty?.length) continue;
                const nazwa = `dzielo-${i}`;
                await fs.writeFile(path.join(praca, nazwa), bajty);
                return { rodzaj: 'dzielo', plik: nazwa, zrodlo: k.tytul ?? k.media.url };
            } catch { /* następne dzieło */ }
        }
    }
    return { rodzaj: 'kolor', kolor: tloZKoloru(u.g.kolor) };
}

async function scenaNapisu({ praca, nr, tlo, linie, podpis, kolorPodpisu, rozmiar, czas, czc, kolor }) {
    const ulozone = ulozNapis(linie, { rozmiar, podpis, kolorPodpisu, kolor, srodek: tlo.rodzaj === 'kolor' ? WYS * 0.5 : WYS * 0.72 });
    const pliki = [];
    for (const [j, l] of ulozone.entries()) {
        const plik = `t-${nr}-${j}.txt`;
        await fs.writeFile(path.join(praca, plik), l.t, 'utf8');
        pliki.push({ plik, rozmiar: l.rozmiar, kolor: l.kolor, y: l.y });
    }
    const wyjscie = `scena-${String(nr).padStart(2, '0')}.mp4`;
    await ffmpeg(argumentySceny({ tlo, linie: pliki, czcionka: czc, czas, wyjscie }), praca);
    return wyjscie;
}

/**
 * Zrób powitanie na dany dzień (domyślnie dziś). Rzuca, gdy stado nie ma nic do powiedzenia
 * albo ffmpeg padnie — i zapisuje to w powitanie.json (bez udawanego filmu).
 */
export async function zrob({ data = dzien(), teraz = Date.now() } = {}) {
    if (!DATA.test(data)) throw new Error('Data w formacie RRRR-MM-DD.');
    if (biezace) throw new Error(`Powitanie ${biezace.data} już powstaje (${biezace.etap}).`);
    biezace = { data, etap: 'zbieram stado', od: new Date().toISOString() };
    const kat = katDnia(data), praca = path.join(kat, 'praca');
    const meta = { data, od: biezace.od, do: null, stan: 'trwa', sceny: [], muzyka: null, blad: null, film: null };
    try {
        await fs.rm(praca, { recursive: true, force: true });
        await fs.mkdir(praca, { recursive: true });
        await fs.writeFile(plikMeta(data), JSON.stringify(meta, null, 2));
        nadaj(`stado pisze poranne powitanie dla Suwerena (${dataSlownie(data)})`);

        const uczestnicy = wybierzUczestnikow(await cfg.gatunki(), cfg.zdarzenia(), { teraz });
        if (!uczestnicy.length) throw new Error('Nie ma wyklutych TeOgochi — nie ma kto witać. Otwórz Dom TeOgochi w Katedrze.');

        // 2. Sentencje — każdy na swoim modelu. Kto zamilknie, nie dostaje sceny (bez dopisywania za niego).
        const sentencje = [];
        for (const u of uczestnicy) {
            biezace.etap = `${u.g.imie} pisze sentencję`;
            const model = (await cfg.modelDla(u.g.id).catch(() => null)) || cfg.domyslnyModel;
            try {
                const karta = await cfg.karta(u.g.id).catch(() => null);
                const reszta = uczestnicy.filter((x) => x !== u).map((x) => x.g.imie);
                const { sentencja, obraz } = odczytaj(await cfg.chat(model, wiadomosci({ g: u.g, slady: u.slady, karta, data, reszta })));
                if (!sentencja) throw new Error('model oddał pustą odpowiedź');
                sentencje.push({ u, s: { agent: u.g.id, imie: u.g.imie, kolor: u.g.kolor ?? null, model, sentencja, obraz } });
            } catch (e) {
                meta.sceny.push({ agent: u.g.id, imie: u.g.imie, model, blad: String(e.message || e).slice(0, 200) });
            }
        }
        if (!sentencje.length) throw new Error(`Żaden TeOgochi nie napisał sentencji (${meta.sceny.map((x) => `${x.imie}: ${x.blad}`).join('; ')}).`);

        // 3–4. Sceny: tło + sentencja w kadrze.
        const czc = await czcionka(praca);
        const pliki = [];
        biezace.etap = 'tytuł';
        pliki.push(await scenaNapisu({
            praca, nr: 0, tlo: { rodzaj: 'kolor', kolor: '0x0d1320' }, czc, czas: CZAS.tytul,
            linie: ['Dzień dobry, Suwerenie'], rozmiar: 64, kolor: '0xf4c84a',
            podpis: `${dataSlownie(data)} · od Twojego stada`, kolorPodpisu: '0xeef1f6',
        }));
        const stanComfy = { padlo: false, powod: null };
        for (const [i, { u, s }] of sentencje.entries()) {
            const tlo = await tloSceny({ u, s, praca, i: i + 1, stanComfy, data });
            biezace.etap = `${u.g.imie}: kadr z sentencją`;
            pliki.push(await scenaNapisu({
                praca, nr: i + 1, tlo, czc, czas: CZAS.scena, linie: zawin(s.sentencja), rozmiar: 50,
                podpis: `— ${u.g.imie}`, kolorPodpisu: jasniej(u.g.kolor),
            }));
            meta.sceny.push({ ...s, tlo: tlo.rodzaj, zrodloTla: tlo.zrodlo ?? null });
        }
        if (stanComfy.padlo) meta.comfy = stanComfy.powod;
        biezace.etap = 'zamknięcie';
        pliki.push(await scenaNapisu({
            praca, nr: 99, tlo: { rodzaj: 'kolor', kolor: '0x0d1320' }, czc, czas: CZAS.koniec,
            linie: ['Iskra żyje, wektory tańczą.'], rozmiar: 54, kolor: '0xeef1f6',
            podpis: `${sentencje.map(({ u }) => u.g.imie).join(' · ')}`, kolorPodpisu: '0xf4c84a',
        }));

        // 5. Sklejenie (te same parametry scen → kopia strumienia) + muzyka.
        biezace.etap = 'montaż';
        await fs.writeFile(path.join(praca, 'lista.txt'), pliki.map((p) => `file '${p}'`).join('\n'));
        await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', 'film.mp4'], praca);
        const dlugosc = CZAS.tytul + CZAS.koniec + CZAS.scena * sentencje.length;
        const utwor = await cfg.muzyka().catch(() => null);
        const cel = plikFilmu(data);
        // Muzyka to dodatek: uszkodzony plik w _OtakOs_Muzyka nie może zabrać Suwerenowi filmu —
        // wtedy film jest cichy, a powód ląduje w powitanie.json.
        let zMuzyka = false;
        if (utwor && fsSync.existsSync(utwor)) {
            try {
                await fs.copyFile(utwor, path.join(praca, `muzyka${path.extname(utwor)}`));
                await ffmpeg(['-y', '-i', 'film.mp4', '-stream_loop', '-1', '-i', `muzyka${path.extname(utwor)}`,
                    '-filter:a', `volume=0.55,afade=t=in:st=0:d=1.5,afade=t=out:st=${(dlugosc - 3).toFixed(2)}:d=3`,
                    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', dlugosc.toFixed(2),
                    '-movflags', '+faststart', 'gotowy.mp4'], praca);
                meta.muzyka = path.basename(utwor);
                zMuzyka = true;
            } catch (e) {
                meta.muzykaBlad = `${path.basename(utwor)}: ${String(e.message || e).slice(0, 200)}`;
            }
        }
        if (!zMuzyka) await ffmpeg(['-y', '-i', 'film.mp4', '-c', 'copy', '-movflags', '+faststart', 'gotowy.mp4'], praca);
        await fs.rename(path.join(praca, 'gotowy.mp4'), cel);
        await fs.rm(praca, { recursive: true, force: true });

        Object.assign(meta, { stan: 'gotowe', do: new Date().toISOString(), sekund: dlugosc, film: path.basename(cel) });
        await fs.writeFile(plikMeta(data), JSON.stringify(meta, null, 2));
        const ujec = meta.sceny.filter((x) => x.tlo === 'ujecie').length;
        nadaj(`🌅 powitanie dnia gotowe: ${sentencje.length} sentencji${ujec ? `, ${ujec} ujęć z ComfyUI` : ''}${meta.muzyka ? `, muzyka „${meta.muzyka}"` : ''}`);
        return meta;
    } catch (e) {
        Object.assign(meta, { stan: 'blad', do: new Date().toISOString(), blad: String(e.message || e).slice(0, 400) });
        await fs.mkdir(kat, { recursive: true }).catch(() => {});
        await fs.writeFile(plikMeta(data), JSON.stringify(meta, null, 2)).catch(() => {});
        nadaj(`powitanie dnia nie wyszło: ${meta.blad}`);
        throw e;
    } finally {
        biezace = null;
    }
}

/** Metadane powitania z danego dnia (albo null). Stan „trwa" bez pracy w tym procesie = przerwane. */
export async function powitanie(data) {
    if (!DATA.test(String(data))) return null;
    let m;
    try { m = JSON.parse(await fs.readFile(plikMeta(data), 'utf8')); } catch { return null; }
    if (m.stan === 'trwa' && biezace?.data !== data) m.stan = 'przerwane';
    m.maFilm = m.stan === 'gotowe' && fsSync.existsSync(plikFilmu(data));
    return m;
}

/** Najnowsze GOTOWE powitanie (dziś albo wcześniej) i to, co się dzieje dziś. */
export async function ostatnie() {
    let dni = [];
    try { dni = (await fs.readdir(cfg.katalog)).filter((d) => DATA.test(d)).sort().reverse(); } catch { /* jeszcze nic */ }
    let gotowe = null;
    for (const d of dni.slice(0, 30)) {
        const m = await powitanie(d);
        if (m?.maFilm) { gotowe = m; break; }
    }
    return { dzis: dzien(), gotowe, dzisiejsze: await powitanie(dzien()), trwa: biezace ? { ...biezace } : null };
}

export const stan = () => (biezace ? { ...biezace } : null);

/**
 * Czy pętla ma dziś zrobić powitanie: po godzinie, nic w toku, a dzisiejszej próby nie było
 * albo przerwał ją restart mostu. Próba z błędem czeka na Suwerena (przycisk przy Katedrze).
 */
export async function czasNaPowitanie(teraz = new Date()) {
    if (biezace || teraz.getHours() < cfg.godzina) return false;
    const m = await powitanie(dzien(teraz));
    return !m || m.stan === 'przerwane';
}

let petla = null;
export function uruchomPetle({ coIleMs = 10 * 60_000, startPoMs = 90_000 } = {}) {
    if (petla) return;
    const sprawdz = async () => {
        try { if (await czasNaPowitanie()) await zrob(); } catch { /* zapisane w powitanie.json i na szynie */ }
    };
    setTimeout(sprawdz, startPoMs).unref?.();
    petla = setInterval(sprawdz, coIleMs);
    petla.unref?.();
}

export default { skonfiguruj, zrob, powitanie, ostatnie, stan, uruchomPetle, czasNaPowitanie, plikFilmu, dzien };
