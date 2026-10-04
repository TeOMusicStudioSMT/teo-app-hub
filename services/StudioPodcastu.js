/**
 * 🎙️ Studio Podcastu (2026-10-04).
 *
 * Suweren: „mam głos prowadzącego i potrzebuję to studio, do którego będę zapraszał i prowadził w tym przytulnym
 * studiu podcast… film wstępowy z nagraniem oraz moduł generujący nowe odcinki w tym studiu, co ze zdjęć…
 * goście są pobierani z naszej bazy aktorów”.
 *
 * STUDIO (`studio.json`): zdjęcia sceny (panoramy — plaża pod Katedrą, salon z kanapami, reżyserka z witrażami; można
 * dodać własne), prowadzący (imię, rola, zdjęcie, kolor, głos) i nagranie wstępu. Pierwsze użycie zasiewa je z paczki
 * `public/studio-podcast/` — to realne pliki Suwerena, nie atrapy.
 *
 * FILM WSTĘPOWY: nagranie prowadzącego (mp3/wav) na tle powolnych najazdów po ujęciach studia, plansza z nazwą
 * podcastu, karta prowadzącego i — gdy Suweren poda tekst nagrania — napisy rozłożone proporcjonalnie do długości.
 * Katedra nie zgaduje treści nagrania sama (to robi Whisper po stronie mostu), więc bez tekstu film jest bez napisów.
 *
 * ODCINEK, jak wywiad (services/WywiadAktorow.js), ale o TEMACIE, nie o filmie:
 *   1. SCENARIUSZ: model gatunku `aktor` pisze rozmowę prowadzącego z gośćmi (aktorzy z bazy — rola, głos, zdjęcie).
 *   2. NAGRANIE: każda kwestia → głos mówcy → kadr: ujęcie studia z najazdem, karta mówiącego, pas z imieniem i napis.
 *      Ujęcia zmieniają się co kilka kwestii; prowadzący stoi w ognisku środkowym, goście po bokach.
 *   2b. WIDEO Z GOŚĆMI „Dziś w studiu”: karty gości z bazy aktorów (klip `wideo` aktora, inaczej zdjęcie, inaczej inicjał) w ujęciu studia + zapowiedź głosem prowadzącego.
 *   3. SKLEJENIE: film wstępowy + wideo z gośćmi + rozmowa (+ cichy podkład) → katalog montaży projektu `studio-podcast`
 *      (Montażownia, „📺 do publikacji”).
 * ffmpeg jak w Powitaniu: cwd = katalog roboczy, względne nazwy, tekst przez `textfile` + `expansion=none`.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { CZCIONKI, zawin, kolorFf, jasniej } from './PowitanieDnia.js';
import { argumentyPodkladu } from './GlosZeStemu.js';
import { WIDEO, slug, normalizujGlos, odczytajScenariusz, czasBezGlosu, JEZYKI, jezykWywiadu, SZER, WYS, FPS } from './WywiadAktorow.js';

export const PROJEKT_STUDIA = 'studio-podcast';
export const PROWADZACY_ID = 'prowadzacy';
const OBRAZ = /\.(png|jpe?g|webp|bmp)$/i;
const AUDIO = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;
const NAJAZD_MIN = 1.1, NAJAZD_MAX = 1.3, PLANSZA_Y = 150;
export const MAX_KWESTII = 90, MAX_RUND = 6;

/** Gdzie na ujęciu „stoi” prowadzący (ognisko 0) i goście (1, 2, 3) — ułamki szerokości/wysokości kadru. */
export const OGNISKA_DOMYSLNE = [{ x: 0.5, y: 0.62 }, { x: 0.28, y: 0.66 }, { x: 0.72, y: 0.66 }, { x: 0.5, y: 0.8 }];

/** Zasiew z paczki: id → opis ujęcia (plik leży w `public/studio-podcast/`). */
export const UJECIA_PACZKI = [
    { id: 'plaza', nazwa: 'Plaża pod Katedrą', plik: 'ujecie-plaza.jpg' },
    { id: 'salon', nazwa: 'Salon z kanapami', plik: 'ujecie-salon.jpg' },
    { id: 'rezyserka', nazwa: 'Reżyserka z witrażami', plik: 'ujecie-rezyserka.jpg' },
];
const OPIS_STUDIA = 'Przytulne studio nagraniowe na plaży, pod gotycką Katedrą OtakOS: bambusowe stelaże z lampowymi przedwzmacniaczami i konsolą, neonowe palmy, '
    + 'światłowodowe kable na piasku, kanapy z bambusa, regały z winylami, witraże i szum oceanu za łukiem. Wieczór, gwiazdy.';

const minmax = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Style rozmowy (Suweren 2026-10-04: „opcje stylu wywiadu… dodatkowo do default: komediowy, luźny, deep, mistyczny”).
 * Styl zmienia TON i rytm — nie fakty (te dalej tylko z materiału).
 */
export const STYLE_WYWIADU = {
    domyslny: { nazwa: 'domyślny', opis: '' },
    komediowy: { nazwa: 'komediowy', opis: 'STYL: komediowy — dowcip, riposty, autoironia i puenty; prowadzący podkręca humor, goście grają swoje role z przymrużeniem oka. Śmiech z sytuacji, nigdy z ludzi.' },
    luzny: { nazwa: 'luźny', opis: 'STYL: luźny — swobodna pogawędka przyjaciół przy kanapie, potoczny język, krótkie wtrącenia, dygresje i spontaniczne reakcje.' },
    deep: { nazwa: 'deep', opis: 'STYL: deep — głęboka, refleksyjna rozmowa; pytania o sens, motywacje i emocje; mniej żartów, więcej szczerości, pauz i dopytywania „dlaczego”.' },
    mistyczny: { nazwa: 'mistyczny', opis: 'STYL: mistyczny — poetycki, symboliczny język; metafory światła, kosmosu, oceanu i Katedry; rozmowa jak rytuał przy ogniu, z nutą tajemnicy.' },
};
export const stylWywiadu = (s) => (STYLE_WYWIADU[s] ? s : 'domyslny');

/**
 * Pralka (suwak 1–9 jak „Stopień Roastowania” w PralkaStation) → temperatura modelu: 1 = spokojnie i przewidywalnie
 * (0,3), 5 = zwykle (0,8), 9 = szalona wena (1,3). Brak / 0 = domyślna temperatura modelu.
 */
export function temperaturaZPralki(poziom) {
    const n = Math.round(Number(poziom));
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.round((0.3 + (Math.min(9, n) - 1) * 0.125) * 100) / 100;
}

/** Fragment filtra: ujęcie studia (panorama) przycięte do 16:9 i powolny najazd na ognisko. Wejście `[i:v]`, wyjście bez etykiety. */
export function filtrTla(i, { ox = 0.5, oy = 0.62, z0 = 1.12, z1 = 1.28, klatek = 100 } = {}) {
    const x = minmax(Number(ox), 0, 1), y = minmax(Number(oy), 0, 1);
    // Ostrość: panorama ma ~2000 px, więc najpierw lanczos do 4K (najazd nie kwantyzuje pikseli), zoompan w 1080p,
    // potem lanczos w dół do 720p i delikatne wyostrzenie. To nie dorabia szczegółów — tylko nie gubi tych, które zdjęcie ma.
    return `[${i}:v]crop='min(iw,ih*16/9)':'min(ih,iw*9/16)',scale=${SZER * 3}:${WYS * 3}:flags=lanczos,`
        + `zoompan=z='${z0}+(${z1}-${z0})*on/${Math.max(1, klatek)}':x='max(0,min(iw-iw/zoom,${x}*iw-iw/zoom/2))':y='max(0,min(ih-ih/zoom,${y}*ih-ih/zoom/2))':d=1:s=${SZER * 1.5}x${WYS * 1.5}:fps=${FPS},`
        + `scale=${SZER}:${WYS}:flags=lanczos,unsharp=5:5:0.8:5:5:0.0`;
}

/** Wejście karty: obraz zapętlony w czasie albo klip wideo (zapętlony, ucięty do `d`; jego dźwięk i tak nie jest mapowany). */
const wejscieKarty = (plik, d) => (WIDEO.test(plik) ? ['-stream_loop', '-1', '-t', d, '-i', plik] : ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', plik]);
const kartaFiltr = (i, kolor) => `[${i}:v]fps=${FPS},scale=360:420:force_original_aspect_ratio=decrease,pad=iw+10:ih+10:5:5:color=${kolorFf(kolor)}`;

/**
 * Argumenty ffmpeg dla jednej kwestii odcinka. `tlo` = { plik, ox, oy }, `karta` = zdjęcie mówiącego (albo null).
 * Nazwy plików WZGLĘDNE do cwd.
 */
export function argumentyKadru({ tlo, karta = null, kolor, imiePlik, liniePliki, czcionka, czas, audio, wyjscie }) {
    const d = Number(czas).toFixed(2), klatek = Math.max(1, Math.round(czas * FPS));
    const wejscia = ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', tlo.plik];
    if (karta) wejscia.push(...wejscieKarty(karta, d));
    wejscia.push(...(audio ? ['-i', audio] : ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']));
    const ia = karta ? 2 : 1;
    const gora = WYS - 60 - 46 - liniePliki.length * 42;
    const pas = `drawbox=x=0:y=${gora - 24}:w=iw:h=${WYS - gora + 24}:color=black@0.55:t=fill,drawbox=x=48:y=${gora - 6}:w=6:h=42:color=${kolorFf(kolor)}:t=fill`;
    const imie = `drawtext=fontfile=${czcionka}:textfile=${imiePlik}:expansion=none:fontsize=36:fontcolor=${jasniej(kolor)}:x=68:y=${gora}`;
    const napisy = liniePliki.map((p, i) => `drawtext=fontfile=${czcionka}:textfile=${p}:expansion=none:fontsize=32:fontcolor=white:x=68:y=${gora + 52 + i * 42}:shadowcolor=black@0.7:shadowx=2:shadowy=2`);
    const koniec = [pas, imie, ...napisy, `fade=t=in:st=0:d=0.25`, `fade=t=out:st=${Math.max(0, czas - 0.25).toFixed(2)}:d=0.25`, 'format=yuv420p'].join(',');
    const tloF = `${filtrTla(0, { ox: tlo.ox, oy: tlo.oy, klatek })}[bg]`;
    const wizja = karta
        ? `${tloF};${kartaFiltr(1, kolor)}[k];[bg][k]overlay=x=W-w-56:y=48:shortest=0[bk];[bk]${koniec}[v]`
        : `${tloF};[bg]${koniec}[v]`;
    const filtr = `${wizja};[${ia}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${d}[a]`;
    return ['-y', ...wejscia, '-filter_complex', filtr, '-map', '[v]', '-map', '[a]', '-t', d, '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', wyjscie];
}

/**
 * Wideo z gośćmi („Dziś w studiu”): ujęcie studia pod spodem, nagłówek, karty gości obok siebie (zdjęcie w kolorze
 * aktora albo sama barwa, gdy nie ma zdjęcia) i imiona pod nimi. Dźwięk = zapowiedź prowadzącego albo cisza.
 * `goscie` = [{ plik|null, kolor, imiePlik, inicjalPlik }]; `naglowekPlik`. Nazwy plików WZGLĘDNE do cwd.
 */
export function argumentyGosci({ tlo, goscie, naglowekPlik, czcionka, czas, audio, wyjscie }) {
    const n = goscie.length, d = Number(czas).toFixed(2), klatek = Math.max(1, Math.round(czas * FPS));
    const KW = 300, KH = 400, ODSTEP = 50;
    const x0 = Math.round((SZER - (n * (KW + 10) + (n - 1) * ODSTEP)) / 2);
    const wejscia = ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', tlo.plik];
    for (const g of goscie) wejscia.push(...(g.plik ? wejscieKarty(g.plik, d) : ['-f', 'lavfi', '-i', `color=c=${kolorFf(g.kolor)}:s=${KW}x${KH}:r=${FPS}:d=${d}`]));
    wejscia.push(...(audio ? ['-i', audio] : ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']));
    const f = [`${filtrTla(0, { ox: tlo.ox, oy: tlo.oy, z0: 1.1, z1: 1.22, klatek })},drawbox=x=0:y=0:w=iw:h=${WYS}:color=black@0.2:t=fill[bg]`];
    let kon = 'bg';
    goscie.forEach((g, i) => {
        const x = x0 + i * (KW + 10 + ODSTEP);
        f.push(`[${i + 1}:v]fps=${FPS},scale=${KW}:${KH}:force_original_aspect_ratio=increase,crop=${KW}:${KH}:(iw-${KW})/2:0,pad=iw+10:ih+10:5:5:color=${kolorFf(g.kolor)}[k${i}]`);
        f.push(`[${kon}][k${i}]overlay=x=${x}:y=170[o${i}]`);
        kon = `o${i}`;
    });
    const rys = [
        `drawbox=x=0:y=36:w=iw:h=84:color=black@0.55:t=fill`,
        `drawtext=fontfile=${czcionka}:textfile=${naglowekPlik}:expansion=none:fontsize=54:fontcolor=white:x=(w-text_w)/2:y=50:shadowcolor=black@0.8:shadowx=3:shadowy=3`,
        // Gość bez zdjęcia: jego inicjał na barwie karty, zamiast gołego prostokąta.
        ...goscie.map((g, i) => (g.plik ? null : `drawtext=fontfile=${czcionka}:textfile=${g.inicjalPlik}:expansion=none:fontsize=190:fontcolor=white@0.85:x=${x0 + i * (KW + 10 + ODSTEP) + 5 + KW / 2}-text_w/2:y=${170 + 5 + KH / 2}-text_h/2`)).filter(Boolean),
        ...goscie.map((g, i) => `drawtext=fontfile=${czcionka}:textfile=${g.imiePlik}:expansion=none:fontsize=38:fontcolor=${jasniej(g.kolor)}:x=${x0 + i * (KW + 10 + ODSTEP) + (KW + 10) / 2}-text_w/2:y=${170 + KH + 28}:shadowcolor=black@0.8:shadowx=2:shadowy=2`),
    ];
    f.push(`[${kon}]${rys.join(',')},fade=t=in:st=0:d=0.4,fade=t=out:st=${Math.max(0, czas - 0.4).toFixed(2)}:d=0.4,format=yuv420p[v]`);
    f.push(`[${n + 1}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${d}[a]`);
    return ['-y', ...wejscia, '-filter_complex', f.join(';'), '-map', '[v]', '-map', '[a]', '-t', d, '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', wyjscie];
}

/** Zapowiedź prowadzącego: „Dziś w studiu: A, B i C.” */
export function zapowiedzGosci(imiona, jezyk = 'pl') {
    const en = jezykWywiadu(jezyk) === 'en';
    const lista = imiona.length > 1 ? `${imiona.slice(0, -1).join(', ')} ${en ? 'and' : 'i'} ${imiona.at(-1)}` : imiona[0];
    return en ? `Today in the studio: ${lista}.` : `Dziś w studiu: ${lista}.`;
}

/** Tekst nagrania → napisy: linie ≤ `szer` znaków po dwie na napis; czas proporcjonalny do liczby znaków w [start, start+sekundy]. */
export function planNapisow(tekst, sekundy, { start = 0.5, szer = 58 } = {}) {
    const linie = zawin(String(tekst ?? '').replace(/\s+/g, ' ').trim(), szer, 400);
    if (!linie.length || !(sekundy > 0)) return [];
    const grupy = [];
    for (let i = 0; i < linie.length; i += 2) grupy.push(linie.slice(i, i + 2));
    const wagi = grupy.map((g) => g.join(' ').length + 8), suma = wagi.reduce((a, b) => a + b, 0);
    let t = start;
    return grupy.map((g, i) => { const dl = (wagi[i] / suma) * sekundy; const o = { od: Math.round(t * 100) / 100, do: Math.round((t + dl) * 100) / 100, linie: g }; t += dl; return o; });
}

/**
 * Argumenty ffmpeg filmu wstępowego: n ujęć (każde z najazdem, przejście przez czerń) pod nagraniem prowadzącego;
 * plansza z nazwą podcastu na początku, od `kartaOd` karta prowadzącego i pas z imieniem, opcjonalne napisy.
 * `ujecia` = [{ plik, ox, oy }]; `nazwaPliki` = [{ plik, duze }] (linie planszy: nazwa podcastu dużym fontem, reszta małym); `napisy` = [{ od, do, pliki[] }] (pliki tekstowe linii). Nazwy WZGLĘDNE do cwd.
 */
export function argumentyWstepu({ ujecia, czas, portret = null, kolor, nazwaPliki, imiePlik, napisy = [], czcionka, audio, opoznienie = 0.5, kartaOd = 2, wyjscie }) {
    const n = ujecia.length, seg = czas / n, d = czas.toFixed(2), sd = seg.toFixed(3), klatek = Math.round(seg * FPS);
    const wejscia = [];
    for (const u of ujecia) wejscia.push('-loop', '1', '-framerate', String(FPS), '-t', sd, '-i', u.plik);
    if (portret) wejscia.push('-loop', '1', '-framerate', String(FPS), '-t', d, '-i', portret);
    wejscia.push('-i', audio);
    const ip = n, ia = portret ? n + 1 : n;
    const f = [];
    ujecia.forEach((u, i) => {
        const [z0, z1] = i % 2 ? [NAJAZD_MAX - 0.08, NAJAZD_MIN] : [NAJAZD_MIN, NAJAZD_MAX - 0.05];
        f.push(`${filtrTla(i, { ox: u.ox, oy: u.oy, z0, z1, klatek })},fade=t=in:st=0:d=0.5,fade=t=out:st=${Math.max(0, seg - 0.5).toFixed(2)}:d=0.5[s${i}]`);
    });
    f.push(`${ujecia.map((_, i) => `[s${i}]`).join('')}concat=n=${n}:v=1:a=0[bg]`);
    let kon = 'bg';
    if (portret) { f.push(`${kartaFiltr(ip, kolor)}[k]`, `[${kon}][k]overlay=x=W-w-56:y=48:enable='gte(t,${kartaOd})'[bk]`); kon = 'bk'; }
    const wiersze = Math.max(0, ...napisy.map((x) => x.pliki.length));
    const gora = WYS - 60 - 46 - wiersze * 42;
    const ys = [];
    let y = 0;
    for (const l of nazwaPliki) { ys.push(y); y += l.duze ? 76 : 48; }
    const wysPlanszy = y, doPlanszy = (kartaOd + 3).toFixed(2);
    const rys = [
        `drawbox=x=0:y=${gora - 24}:w=iw:h=${WYS - gora + 24}:color=black@0.55:t=fill:enable='gte(t,${kartaOd})'`,
        `drawbox=x=48:y=${gora - 6}:w=6:h=42:color=${kolorFf(kolor)}:t=fill:enable='gte(t,${kartaOd})'`,
        `drawtext=fontfile=${czcionka}:textfile=${imiePlik}:expansion=none:fontsize=36:fontcolor=${jasniej(kolor)}:x=68:y=${gora}:enable='gte(t,${kartaOd})'`,
        `drawbox=x=0:y=${PLANSZA_Y - 30}:w=iw:h=${wysPlanszy + 50}:color=black@0.5:t=fill:enable='between(t,0.4,${doPlanszy})'`,
        ...nazwaPliki.map((l, i) => `drawtext=fontfile=${czcionka}:textfile=${l.plik}:expansion=none:fontsize=${l.duze ? 60 : 34}:fontcolor=${l.duze ? 'white' : jasniej(kolor)}:x=(w-text_w)/2:y=${PLANSZA_Y + ys[i]}:shadowcolor=black@0.8:shadowx=3:shadowy=3:enable='between(t,0.4,${doPlanszy})'`),
        ...napisy.flatMap((x) => x.pliki.map((p, i) => `drawtext=fontfile=${czcionka}:textfile=${p}:expansion=none:fontsize=32:fontcolor=white:x=68:y=${gora + 52 + i * 42}:shadowcolor=black@0.7:shadowx=2:shadowy=2:enable='between(t,${x.od},${x.do})'`)),
    ];
    f.push(`[${kon}]${rys.join(',')},fade=t=out:st=${Math.max(0, czas - 0.6).toFixed(2)}:d=0.6,format=yuv420p[v]`);
    f.push(`[${ia}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(opoznienie * 1000)}|${Math.round(opoznienie * 1000)},apad,atrim=duration=${d},afade=t=out:st=${Math.max(0, czas - 0.6).toFixed(2)}:d=0.6[a]`);
    return ['-y', ...wejscia, '-filter_complex', f.join(';'), '-map', '[v]', '-map', '[a]', '-t', d, '-r', String(FPS),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', wyjscie];
}

/** Prośba do modelu o scenariusz odcinka (temat, nie film). */
export function promptOdcinka({ prowadzacy, goscie, temat, tytul = '', material = '', studio = OPIS_STUDIA, uwagi = '', jezyk = 'pl', styl = 'domyslny' }) {
    const obsada = goscie.map((a) => `- ${a.imie.toUpperCase()}: ${a.rola || 'gość podcastu'}`).join('\n');
    const system = [
        `Jesteś scenarzystą odcinka podcastu nagrywanego w studiu Katedry OtakOS. ${JEZYKI[jezykWywiadu(jezyk)].piszesz}, żywo, ciepło i konkretnie — jak rozmowa przy kanapie, nie wykład.`,
        `Prowadzi ${prowadzacy.imie.toUpperCase()} (${prowadzacy.rola || 'stylowy prowadzący podcastu'}) — mówi w pierwszej osobie. Goście to aktorzy z bazy Katedry; mówią W SWOICH ROLACH.`,
        'Fakty bierzesz WYŁĄCZNIE z materiału poniżej i z opisu ról. Nie wymyślasz liczb, nagród, cytatów ani wydarzeń, których tam nie ma. Opinie, uczucia i pomysły — tak, jako zdanie postaci.',
        'Format — każda kwestia w osobnej linii, nic poza tym:',
        'IMIĘ: tekst kwestii',
        'Zasady: 10–18 kwestii; każda najwyżej 2 zdania (do 220 znaków); bez didaskaliów w nawiasach; zaczyna prowadzący (powitanie w studiu i zapowiedź tematu, przedstawia gości); każdy gość mówi co najmniej dwa razy; prowadzący zadaje pytania i reaguje; kończy prowadzący podziękowaniem i zaproszeniem na kolejny odcinek.',
        STYLE_WYWIADU[stylWywiadu(styl)].opis || null,
    ].filter(Boolean).join('\n');
    const user = [
        `TEMAT ODCINKA: ${String(temat).slice(0, 500)}`,
        tytul ? `TYTUŁ ODCINKA: ${tytul}` : null,
        `STUDIO: ${studio}`,
        material ? `MATERIAŁ:\n${String(material).slice(0, 4000)}` : null,
        uwagi ? `UWAGI SUWERENA: ${String(uwagi).slice(0, 600)}` : null,
        `PROWADZĄCY: ${prowadzacy.imie.toUpperCase()}`,
        `GOŚCIE:\n${obsada}`,
    ].filter(Boolean).join('\n\n');
    return { system, user };
}

/**
 * Dogrywka (Suweren: „dodatkowe rundy wywiadu… by wydłużyć materiał”): dotychczasowa rozmowa BEZ końcowego pożegnania
 * → model dopisuje dalszy ciąg (nowe wątki, bez powtórek) i sam kończy pożegnaniem prowadzącego.
 */
export function promptDogrywki({ prowadzacy, goscie, temat, kwestie, imie = (id) => id, jezyk = 'pl', styl = 'domyslny', runda = 1 }) {
    const system = [
        `Jesteś scenarzystą odcinka podcastu Katedry OtakOS. Dopisujesz DALSZY CIĄG trwającej rozmowy (runda ${runda + 1}). ${JEZYKI[jezykWywiadu(jezyk)].piszesz}.`,
        `Prowadzi ${prowadzacy.imie.toUpperCase()} (${prowadzacy.rola || 'prowadzący'}). Goście mówią W SWOICH ROLACH; fakty tylko z tego, co już padło i z opisu ról — nic nie zmyślasz.`,
        'Nie witasz się ponownie i nie powtarzasz tego, co już padło: prowadzący otwiera NOWY wątek tematu (głębiej, z innej strony, pytanie od widzów, anegdota z roli), goście odpowiadają i reagują na siebie.',
        'Format — każda kwestia w osobnej linii: IMIĘ: tekst kwestii. 8–12 kwestii, każda najwyżej 2 zdania, bez didaskaliów. Kończy prowadzący podziękowaniem i pożegnaniem.',
        STYLE_WYWIADU[stylWywiadu(styl)].opis || null,
    ].filter(Boolean).join('\n');
    const user = [
        `TEMAT ODCINKA: ${String(temat).slice(0, 500)}`,
        `PROWADZĄCY: ${prowadzacy.imie.toUpperCase()}`,
        `GOŚCIE:\n${goscie.map((a) => `- ${a.imie.toUpperCase()}: ${a.rola || 'gość podcastu'}`).join('\n')}`,
        `DOTYCHCZASOWA ROZMOWA:\n${kwestie.slice(-40).map((k) => `${imie(k.kto).toUpperCase()}: ${k.tekst}`).join('\n')}`,
        'DALSZY CIĄG:',
    ].join('\n\n');
    return { system, user };
}

/**
 * @param {{ katalog:string, paczka?:string, aktorzy:()=>Promise<object[]>,
 *   chat:(model:string|null, system:string, user:string)=>Promise<{tekst:string, silnik?:string}>,
 *   modelDla?:(id:string)=>Promise<string|null>, mow?:(o:{tekst:string, glos:object|null, jezyk:string})=>Promise<{audio:Buffer, ext:string}>,
 *   opisz:(p:string)=>Promise<{sekundy:number|null}>, katalogMontazy:(projekt:string)=>Promise<string>,
 *   ffmpeg?:string, szyna?:any, teraz?:()=>number, sciezkaPodkladu?:(plik:string)=>string }} o
 *   `paczka`: katalog z zasiewem (zdjęcia studia, prowadzący, nagranie wstępu); `aktorzy`: baza aktorów Katedry.
 */
export function utworzStudioPodcastu(o) {
    // `start` = nazwa, opis i prowadzący nowego studia bez paczki (własne studia Suwerena i innych); `projekt` = katalog montaży.
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), modelDla: async () => null, projekt: PROJEKT_STUDIA, start: null, ...o };
    const PLIK = path.join(cfg.katalog, 'studio.json');
    const KAT_UJEC = path.join(cfg.katalog, 'ujecia');
    const KAT_ODC = path.join(cfg.katalog, 'odcinki');
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Aktor', rodzaj: 'praca', tresc })?.catch?.(() => {});
    const wRobocie = new Map();   // id odcinka albo 'wstep' → { etap, zrobione, wszystkich }

    const czytaj = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const pisz = async (p, d) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(`${p}.tmp`, JSON.stringify(d, null, 1), 'utf8'); await fs.rename(`${p}.tmp`, p); };
    const ff = async (args, cwd) => {
        await new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, windowsHide: true, timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 },
            (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`)) : ok())));
    };
    const czcionka = () => CZCIONKI.find((p) => fsSync.existsSync(p));
    const ogniska = (u) => (Array.isArray(u?.ogniska) && u.ogniska.length ? u.ogniska : OGNISKA_DOMYSLNE);

    // ── Studio ────────────────────────────────────────────────────────────
    /** Zasiew z paczki (tylko to, co jest na dysku); nic nie nadpisuje. */
    async function zasiej() {
        const s = await czytaj(PLIK, null);
        if (s) return s;
        const z = (nazwa) => (cfg.paczka && fsSync.existsSync(path.join(cfg.paczka, nazwa)) ? path.join(cfg.paczka, nazwa) : null);
        const ujecia = [];
        for (const u of UJECIA_PACZKI) {
            const zr = z(u.plik);
            if (!zr) continue;
            const cel = path.join(KAT_UJEC, u.plik);
            await fs.mkdir(KAT_UJEC, { recursive: true });
            await fs.copyFile(zr, cel);
            ujecia.push({ id: u.id, nazwa: u.nazwa, plik: cel, ogniska: OGNISKA_DOMYSLNE });
        }
        let zdjecie = null, nagranie = null;
        if (z('prowadzacy.jpg')) { zdjecie = path.join(cfg.katalog, 'prowadzacy.jpg'); await fs.mkdir(cfg.katalog, { recursive: true }); await fs.copyFile(z('prowadzacy.jpg'), zdjecie); }
        if (z('wstep-nagranie.mp3')) { nagranie = path.join(cfg.katalog, 'wstep-nagranie.mp3'); await fs.mkdir(cfg.katalog, { recursive: true }); await fs.copyFile(z('wstep-nagranie.mp3'), nagranie); }
        const st = cfg.start ?? {};
        const nowe = {
            nazwa: st.nazwa || 'TeO Podcast — Studio pod Katedrą', opis: st.opis || OPIS_STUDIA,
            prowadzacy: { id: PROWADZACY_ID, imie: st.prowadzacy?.imie || 'TeO', rola: st.prowadzacy?.rola || 'Stylowy prowadzący podcastu, Suweren Katedry OtakOS: luz, ciepło, ciekawość gości.', kolor: st.prowadzacy?.kolor || '#22d3ee', zdjecie, glos: null },
            ujecia, wstep: { nagranie, tekst: '', plik: null, sekundy: null, zrobiono: null }, zmieniono: czas(),
        };
        await pisz(PLIK, nowe);
        return nowe;
    }
    async function studio() { return zasiej(); }

    /** Zmiana nazwy, opisu, prowadzącego (imię, rola, kolor, zdjęcie, głos) i tekstu nagrania wstępu. */
    async function zapiszStudio(dane = {}) {
        const s = await zasiej();
        const p = { ...s.prowadzacy };
        const d = dane.prowadzacy ?? {};
        if (d.imie !== undefined) { p.imie = String(d.imie).replace(/\s+/g, ' ').trim().slice(0, 40); if (!p.imie) throw new Error('Prowadzący potrzebuje imienia.'); }
        if (d.rola !== undefined) p.rola = String(d.rola).trim().slice(0, 600);
        if (d.kolor !== undefined && /^#[0-9a-f]{6}$/i.test(d.kolor)) p.kolor = d.kolor;
        if (d.zdjecie) {
            const z = String(d.zdjecie).trim();
            if (!OBRAZ.test(z) || !fsSync.existsSync(z)) throw new Error(`Zdjęcie prowadzącego musi być istniejącym obrazem (png/jpg/webp): ${z}`);
            p.zdjecie = z;
        }
        if (d.glos !== undefined) p.glos = normalizujGlos(d.glos);
        const wstep = { ...s.wstep };
        if (dane.wstepTekst !== undefined) wstep.tekst = String(dane.wstepTekst).trim().slice(0, 4000);
        if (dane.nagranieWstepu) {
            const n = String(dane.nagranieWstepu).trim();
            if (!AUDIO.test(n) || !fsSync.existsSync(n)) throw new Error(`Nagranie wstępu musi być istniejącym plikiem audio: ${n}`);
            wstep.nagranie = n; wstep.plik = null; wstep.sekundy = null;
        }
        const nowe = {
            ...s, prowadzacy: p, wstep,
            nazwa: dane.nazwa !== undefined ? String(dane.nazwa).trim().slice(0, 80) || s.nazwa : s.nazwa,
            opis: dane.opis !== undefined ? String(dane.opis).trim().slice(0, 800) || OPIS_STUDIA : s.opis,
            zmieniono: czas(),
        };
        await pisz(PLIK, nowe);
        return nowe;
    }

    /** Nowe zdjęcie studia (istniejący obraz z dysku → kopia w katalogu Studia). */
    async function dodajUjecie({ plik, nazwa = '' } = {}) {
        const s = await zasiej();
        const zr = String(plik ?? '').trim();
        if (!OBRAZ.test(zr) || !fsSync.existsSync(zr)) throw new Error(`Ujęcie musi być istniejącym obrazem (png/jpg/webp): ${zr || '(brak)'}`);
        if (s.ujecia.length >= 8) throw new Error('Studio ma już 8 ujęć — usuń któreś.');
        const imie = String(nazwa).replace(/\s+/g, ' ').trim().slice(0, 60) || path.basename(zr).replace(/\.[^.]+$/, '');
        let id = slug(imie) || `ujecie-${cfg.teraz().toString(36)}`;
        if (s.ujecia.some((u) => u.id === id)) id = `${id}-${cfg.teraz().toString(36).slice(-4)}`;
        const cel = path.join(KAT_UJEC, `${id}${path.extname(zr).toLowerCase()}`);
        await fs.mkdir(KAT_UJEC, { recursive: true });
        await fs.copyFile(zr, cel);
        const u = { id, nazwa: imie, plik: cel, ogniska: OGNISKA_DOMYSLNE };
        await pisz(PLIK, { ...s, ujecia: [...s.ujecia, u], zmieniono: czas() });
        return u;
    }

    async function usunUjecie(id) {
        const s = await zasiej();
        const u = s.ujecia.find((x) => x.id === id);
        if (!u) throw new Error('Nie ma takiego ujęcia.');
        if (s.ujecia.length <= 1) throw new Error('Studio potrzebuje co najmniej jednego ujęcia.');
        await pisz(PLIK, { ...s, ujecia: s.ujecia.filter((x) => x.id !== id), zmieniono: czas() });
        await fs.rm(u.plik, { force: true }).catch(() => {});
        return { id };
    }

    // ── Film wstępowy ─────────────────────────────────────────────────────
    /** Nagranie prowadzącego → film wstępowy w katalogu Studia. Rzuca na brak nagrania, ujęć albo czcionki. */
    async function zrobWstep({ tekst = undefined } = {}) {
        if (wRobocie.has('wstep')) throw new Error('Film wstępowy już się robi.');
        wRobocie.set('wstep', { etap: 'start', zrobione: 0, wszystkich: 1 });
        const praca = path.join(cfg.katalog, 'praca-wstepu');
        try {
            const s = await zasiej();
            if (!s.wstep?.nagranie || !fsSync.existsSync(s.wstep.nagranie)) throw new Error('Brak nagrania prowadzącego — wskaż plik audio (nagranieWstepu).');
            const ujecia = s.ujecia.filter((u) => fsSync.existsSync(u.plik));
            if (!ujecia.length) throw new Error('Studio nie ma żadnego ujęcia na dysku.');
            const zrodlo = czcionka();
            if (!zrodlo) throw new Error('Nie znalazłem czcionki z polskimi znakami (OTAKOS_POWITANIE_CZCIONKA).');
            const dlugosc = (await cfg.opisz(s.wstep.nagranie).catch(() => null))?.sekundy;
            if (!dlugosc) throw new Error('Nie umiem odczytać długości nagrania prowadzącego (czy to na pewno audio?).');
            const napisTekst = tekst !== undefined ? String(tekst).trim().slice(0, 4000) : s.wstep.tekst;
            await fs.rm(praca, { recursive: true, force: true });
            await fs.mkdir(praca, { recursive: true });
            await fs.copyFile(zrodlo, path.join(praca, 'czcionka.ttf'));
            const pliki = [];
            for (const [i, u] of ujecia.entries()) { const n = `u${i}${path.extname(u.plik).toLowerCase()}`; await fs.copyFile(u.plik, path.join(praca, n)); pliki.push({ plik: n, ox: ogniska(u)[0].x, oy: ogniska(u)[0].y }); }
            const ext = path.extname(s.wstep.nagranie).toLowerCase();
            await fs.copyFile(s.wstep.nagranie, path.join(praca, `nagranie${ext}`));
            let portret = null;
            if (s.prowadzacy.zdjecie && fsSync.existsSync(s.prowadzacy.zdjecie)) { portret = `portret${path.extname(s.prowadzacy.zdjecie).toLowerCase()}`; await fs.copyFile(s.prowadzacy.zdjecie, path.join(praca, portret)); }
            await fs.writeFile(path.join(praca, 'imie.txt'), s.prowadzacy.imie, 'utf8');
            const nazwaLinie = [...zawin(s.nazwa, 30, 2).map((t) => ({ t, duze: true })), { t: `prowadzi: ${s.prowadzacy.imie}`, duze: false }];
            const nazwaPliki = [];
            for (const [i, l] of nazwaLinie.entries()) { const n = `nazwa-${i}.txt`; await fs.writeFile(path.join(praca, n), l.t, 'utf8'); nazwaPliki.push({ plik: n, duze: l.duze }); }
            const napisy = [];
            for (const [i, x] of planNapisow(napisTekst, dlugosc, { start: 0.5 }).entries()) {
                const pl = [];
                for (const [j, l] of x.linie.entries()) { const n = `n-${i}-${j}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); pl.push(n); }
                napisy.push({ od: x.od, do: x.do, pliki: pl });
            }
            const calosc = Math.round((dlugosc + 1.4) * 100) / 100;
            await ff(argumentyWstepu({ ujecia: pliki, czas: calosc, portret, kolor: s.prowadzacy.kolor, nazwaPliki, imiePlik: 'imie.txt', napisy, czcionka: 'czcionka.ttf', audio: `nagranie${ext}`, wyjscie: 'wstep.mp4' }), praca);
            const cel = path.join(cfg.katalog, 'wstep.mp4');
            await fs.copyFile(path.join(praca, 'wstep.mp4'), cel);
            const o2 = await cfg.opisz(cel).catch(() => null);
            const nowe = { ...(await zasiej()) };
            nowe.wstep = { ...nowe.wstep, tekst: napisTekst, plik: cel, sekundy: o2?.sekundy ?? calosc, zrobiono: czas(), napisy: napisy.length > 0, blad: undefined };
            await pisz(PLIK, nowe);
            nadaj(`zrobił film wstępowy podcastu „${s.nazwa}” (${(o2?.sekundy ?? calosc).toFixed?.(1) ?? calosc} s, ${ujecia.length} ujęć${napisy.length ? ', z napisami' : ''})`);
            return nowe.wstep;
        } finally { wRobocie.delete('wstep'); await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); }
    }

    /** To samo w tle: zwraca od razu, a błąd zostaje w `studio.wstep.blad` (panel go pokaże). */
    function zrobWstepWTle(o2 = {}) {
        if (wRobocie.has('wstep')) throw new Error('Film wstępowy już się robi.');
        const p = zrobWstep(o2).catch(async (e) => { const st = await czytaj(PLIK, null); if (st) await pisz(PLIK, { ...st, wstep: { ...st.wstep, blad: String(e.message || e).slice(0, 400) } }).catch(() => {}); });
        return p;
    }

    // ── Odcinki ───────────────────────────────────────────────────────────
    const plikOdcinka = (id) => path.join(KAT_ODC, id, 'odcinek.json');
    async function odcinek(id) {
        if (!/^p_[a-z0-9]+$/.test(String(id))) throw new Error('Złe id odcinka.');
        const o2 = await czytaj(plikOdcinka(id), null);
        if (!o2) throw new Error('Nie ma takiego odcinka.');
        return { ...o2, ...(wRobocie.has(id) ? { postep: wRobocie.get(id) } : {}) };
    }
    async function odcinki() {
        const katalogi = await fs.readdir(KAT_ODC).catch(() => []);
        const l = [];
        for (const k of katalogi) { const x = await czytaj(plikOdcinka(k), null); if (x) l.push({ ...x, ...(wRobocie.has(k) ? { postep: wRobocie.get(k) } : {}) }); }
        return l.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    /** Krok 1: scenariusz od lokalnego modelu — goście z bazy aktorów Katedry. */
    async function przygotuj({ temat = '', tytul = '', goscie: ids = [], material = '', uwagi = '', jezyk: jezykZadany = 'pl', styl: stylZadany = 'domyslny', pralka = null } = {}) {
        const s = await zasiej();
        if (!String(temat).trim()) throw new Error('Odcinek potrzebuje tematu.');
        const baza = await cfg.aktorzy();
        const goscie = [...new Set(Array.isArray(ids) ? ids : [])].map((id) => baza.find((a) => a.id === id)).filter(Boolean).slice(0, 3);
        if (!goscie.length) throw new Error('Wybierz co najmniej jednego gościa z bazy aktorów (najwyżej trzech).');
        const jezyk = jezykWywiadu(jezykZadany);
        const styl = stylWywiadu(stylZadany);
        const temperatura = temperaturaZPralki(pralka);
        const { system, user } = promptOdcinka({ prowadzacy: s.prowadzacy, goscie, temat, tytul, material, studio: s.opis, uwagi, jezyk, styl });
        const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
        const { tekst, silnik } = await cfg.chat(model, system, user, temperatura === null ? {} : { temperatura });
        const kwestie = odczytajScenariusz(tekst, { goscie, prowadzacy: s.prowadzacy });
        const id = `p_${cfg.teraz().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const x = { id, temat: String(temat).slice(0, 500), tytul: String(tytul).trim().slice(0, 120) || String(temat).trim().slice(0, 80), goscie: goscie.map((g) => g.id), kwestie, jezyk, styl, pralka: temperatura === null ? null : Math.round(Number(pralka)), rundy: 1, model: silnik ?? model ?? null, etap: 'scenariusz', utworzono: czas() };
        await pisz(plikOdcinka(id), x);
        nadaj(`napisał scenariusz odcinka „${x.tytul}” z ${goscie.map((g) => g.imie).join(', ')}`);
        return x;
    }

    /** Suweren poprawia kwestie (i tytuł) przed nagraniem. */
    async function zmien(id, { kwestie, tytul } = {}) {
        const x = await odcinek(id);
        if (x.etap === 'nagrywa') throw new Error('Odcinek właśnie się nagrywa.');
        const mowcy = new Set([PROWADZACY_ID, ...x.goscie]);
        const { postep, ...zapis } = x;
        if (kwestie !== undefined) {
            const nowe = (Array.isArray(kwestie) ? kwestie : []).map((k) => ({ kto: String(k?.kto ?? ''), tekst: String(k?.tekst ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) })).filter((k) => mowcy.has(k.kto) && k.tekst);
            if (nowe.length < 2) throw new Error('Odcinek potrzebuje co najmniej dwóch kwestii.');
            zapis.kwestie = nowe.slice(0, MAX_KWESTII);
        }
        if (tytul !== undefined && String(tytul).trim()) zapis.tytul = String(tytul).trim().slice(0, 120);
        Object.assign(zapis, { etap: 'scenariusz', plik: undefined, blad: undefined });
        await pisz(plikOdcinka(id), zapis);
        return zapis;
    }

    /**
     * Dogrywka: `rundy` (1–3 naraz) kolejnych rund rozmowy. Końcowe pożegnanie prowadzącego wypada i wraca na końcu
     * nowej rundy (pisze je model). Styl / Pralka / język z odcinka, chyba że Suweren poda nowe. Do MAX_RUND rund.
     */
    async function dogrywka(id, { rundy = 1, styl: stylZadany, pralka: pralkaZadana } = {}) {
        const x = await odcinek(id);
        if (x.etap === 'nagrywa') throw new Error('Odcinek właśnie się nagrywa.');
        const s = await zasiej();
        const baza = await cfg.aktorzy();
        const goscie = x.goscie.map((g) => baza.find((a) => a.id === g)).filter(Boolean);
        if (!goscie.length) throw new Error('Goście tego odcinka zniknęli z bazy aktorów.');
        const styl = stylWywiadu(stylZadany ?? x.styl);
        const pralka = pralkaZadana ?? x.pralka ?? null;
        const temperatura = temperaturaZPralki(pralka);
        const ile = Math.min(3, Math.max(1, Math.round(Number(rundy) || 1)));
        const juz = Number(x.rundy) || 1;
        if (juz >= MAX_RUND) throw new Error(`Odcinek ma już ${juz} rund — więcej nie dokładam (limit ${MAX_RUND}).`);
        const imie = (kto) => (kto === PROWADZACY_ID ? s.prowadzacy.imie : baza.find((a) => a.id === kto)?.imie ?? kto);
        const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
        let kwestie = [...x.kwestie], zrobione = 0, silnik = null;
        for (let r = 0; r < ile && juz + r < MAX_RUND; r++) {
            const bezPozegnania = kwestie.length > 2 && kwestie.at(-1).kto === PROWADZACY_ID ? kwestie.slice(0, -1) : kwestie;
            const { system, user } = promptDogrywki({ prowadzacy: s.prowadzacy, goscie, temat: x.temat, kwestie: bezPozegnania, imie, jezyk: x.jezyk, styl, runda: juz + r });
            const odp = await cfg.chat(model, system, user, temperatura === null ? {} : { temperatura });
            const nowe = odczytajScenariusz(odp.tekst, { goscie, prowadzacy: s.prowadzacy });
            kwestie = [...bezPozegnania, ...nowe].slice(0, MAX_KWESTII);
            silnik = odp.silnik ?? model ?? null; zrobione += 1;
            if (kwestie.length >= MAX_KWESTII) break;
        }
        const { postep, ...zapis } = x;
        Object.assign(zapis, { kwestie, styl, pralka: temperatura === null ? null : Math.round(Number(pralka)), rundy: juz + zrobione, etap: 'scenariusz', plik: undefined, blad: undefined, ...(silnik ? { model: silnik } : {}) });
        await pisz(plikOdcinka(id), zapis);
        nadaj(`dopisał ${zrobione} ${zrobione === 1 ? 'rundę' : 'rundy'} odcinka „${x.tytul}” (${kwestie.length} kwestii)`);
        return zapis;
    }

    /**
     * Kadr kwestii nr i: ujęcie zmienia się co 3 kwestie; prowadzący w ognisku 0, goście w kolejnych (1, 2, 3).
     * Czysta funkcja — test sprawdza rozkład bez ffmpeg.
     */
    function planKadru(i, kto, goscie, ujecia) {
        const u = ujecia[Math.floor(i / 3) % ujecia.length];
        const poz = kto === PROWADZACY_ID ? 0 : 1 + Math.max(0, goscie.indexOf(kto));
        const o = ogniska(u);
        return { ujecie: u, ognisko: o[poz % o.length] };
    }

    /**
     * Wideo z gośćmi („Dziś w studiu”) → `odcinki/<id>/goscie.mp4`. Zapowiedź mówi prowadzący (jego głosem), chyba że `bezGlosu`.
     * Używane przez nagranie odcinka i osobno (podgląd przed nagraniem).
     */
    async function renderGosci(x, s, baza, { bezGlosu = false } = {}) {
        const ujecia = s.ujecia.filter((u) => fsSync.existsSync(u.plik));
        if (!ujecia.length) throw new Error('Studio nie ma żadnego ujęcia na dysku.');
        const zrodlo = czcionka();
        if (!zrodlo) throw new Error('Nie znalazłem czcionki z polskimi znakami (OTAKOS_POWITANIE_CZCIONKA).');
        const goscie = x.goscie.map((id) => baza.find((a) => a.id === id)).filter(Boolean);
        if (!goscie.length) throw new Error('Żaden z gości tego odcinka nie jest już w bazie aktorów.');
        const praca = path.join(KAT_ODC, x.id, 'goscie-praca');
        try {
            await fs.rm(praca, { recursive: true, force: true });
            await fs.mkdir(praca, { recursive: true });
            await fs.copyFile(zrodlo, path.join(praca, 'czcionka.ttf'));
            const ujecie = ujecia.find((u) => u.id === 'salon') ?? ujecia[Math.min(1, ujecia.length - 1)];
            const tlo = `tlo${path.extname(ujecie.plik).toLowerCase()}`;
            await fs.copyFile(ujecie.plik, path.join(praca, tlo));
            const J = jezykWywiadu(x.jezyk);
            await fs.writeFile(path.join(praca, 'naglowek.txt'), J === 'en' ? 'TODAY IN THE STUDIO' : 'DZIŚ W STUDIO', 'utf8');
            const karty = [];
            for (const [i, g] of goscie.entries()) {
                let plik = null;
                const zrKarty = [g.wideo, g.zdjecie].find((f) => f && fsSync.existsSync(f));   // klip aktora wygrywa ze zdjęciem
                if (zrKarty) { plik = `g${i}${path.extname(zrKarty).toLowerCase()}`; await fs.copyFile(zrKarty, path.join(praca, plik)); }
                await fs.writeFile(path.join(praca, `gi${i}.txt`), g.imie, 'utf8');
                await fs.writeFile(path.join(praca, `gl${i}.txt`), [...g.imie][0]?.toUpperCase() ?? '?', 'utf8');
                karty.push({ plik, kolor: g.kolor || '#f4c84a', imiePlik: `gi${i}.txt`, inicjalPlik: `gl${i}.txt` });
            }
            let audio = null, dl = Math.max(4.5, 2 * goscie.length + 1.5);
            if (!bezGlosu) {
                if (!cfg.mow) throw new Error('Katedra nie ma silnika głosu — zrób wideo „bez głosu”.');
                const g = await cfg.mow({ tekst: zapowiedzGosci(goscie.map((a) => a.imie), J), glos: s.prowadzacy.glos ?? null, jezyk: J }).catch((e) => { throw new Error(`Głos „${s.prowadzacy.imie}”: ${e.message}`); });
                audio = `zapowiedz.${g.ext || 'wav'}`;
                await fs.writeFile(path.join(praca, audio), g.audio);
                const sek = (await cfg.opisz(path.join(praca, audio)).catch(() => null))?.sekundy;
                if (sek) dl = Math.max(dl, Math.round((sek + 1.2) * 100) / 100);
            }
            const o = ogniska(ujecie)[0];
            await ff(argumentyGosci({ tlo: { plik: tlo, ox: o.x, oy: o.y }, goscie: karty, naglowekPlik: 'naglowek.txt', czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: 'goscie.mp4' }), praca);
            const cel = path.join(KAT_ODC, x.id, 'goscie.mp4');
            await fs.copyFile(path.join(praca, 'goscie.mp4'), cel);
            return cel;
        } finally { await fs.rm(praca, { recursive: true, force: true }).catch(() => {}); }
    }

    /** Samo wideo z gośćmi (podgląd przed nagraniem odcinka); zapisuje ścieżkę w odcinku. */
    async function zrobGosci(id, { bezGlosu = false } = {}) {
        const x = await odcinek(id);
        if (x.etap === 'nagrywa') throw new Error('Odcinek właśnie się nagrywa.');
        const plik = await renderGosci(x, await zasiej(), await cfg.aktorzy(), { bezGlosu });
        const { postep, ...zapis } = x;
        zapis.goscieFilm = plik;
        await pisz(plikOdcinka(id), zapis);
        return { ...zapis, sekundy: (await cfg.opisz(plik).catch(() => null))?.sekundy ?? null };
    }

    /** Krok 2 + 3: wstęp, głosy, kadry, sklejenie → katalog montaży projektu `studio-podcast`. Startuje w tle. */
    async function nagraj(id, { bezGlosu = false, zWstepem = true, zGoscmi = true, podklad = null, glosnosc = 0.12, projekt = cfg.projekt } = {}) {
        const x = await odcinek(id);
        const s = await zasiej();
        if (wRobocie.has(id)) throw new Error('Ten odcinek już się nagrywa.');
        if (!bezGlosu && !cfg.mow) throw new Error('Katedra nie ma silnika głosu — nagraj „bez głosu” (same napisy).');
        const ujecia = s.ujecia.filter((u) => fsSync.existsSync(u.plik));
        if (!ujecia.length) throw new Error('Studio nie ma żadnego ujęcia na dysku.');
        let plikPodkladu = null;
        if (podklad) {
            if (!cfg.sciezkaPodkladu) throw new Error('Ta Katedra nie zna biblioteki muzyki — nagraj bez podkładu.');
            plikPodkladu = cfg.sciezkaPodkladu(String(podklad));
            if (!fsSync.existsSync(plikPodkladu)) throw new Error(`Nie ma podkładu: ${path.basename(plikPodkladu)}`);
        }
        const baza = await cfg.aktorzy();
        const mowca = (kto) => (kto === PROWADZACY_ID ? s.prowadzacy : baza.find((a) => a.id === kto)) ?? { id: kto, imie: kto, kolor: '#f4c84a', zdjecie: null, glos: null };
        const { postep, ...zapis } = x;
        Object.assign(zapis, { etap: 'nagrywa', bezGlosu: !!bezGlosu, zWstepem: !!zWstepem, zGoscmi: !!zGoscmi, podklad: plikPodkladu ? path.basename(plikPodkladu) : null, blad: undefined, nagrywanoOd: czas() });
        await pisz(plikOdcinka(id), zapis);
        wRobocie.set(id, { etap: 'start', zrobione: 0, wszystkich: x.kwestie.length });
        void (async () => {
            const praca = path.join(KAT_ODC, id, 'praca');
            try {
                await fs.rm(praca, { recursive: true, force: true });
                await fs.mkdir(praca, { recursive: true });
                const schowekGlosu = path.join(KAT_ODC, id, 'glos');
                await fs.mkdir(schowekGlosu, { recursive: true });
                const zrodlo = czcionka();
                if (!zrodlo) throw new Error('Nie znalazłem czcionki z polskimi znakami (OTAKOS_POWITANIE_CZCIONKA).');
                await fs.copyFile(zrodlo, path.join(praca, 'czcionka.ttf'));
                const segmenty = [];
                // Film wstępowy: gotowy z Studia albo robiony teraz (nagranie prowadzącego jest w Studiu).
                if (zWstepem) {
                    wRobocie.set(id, { etap: 'wstęp', zrobione: 0, wszystkich: x.kwestie.length });
                    let wstep = s.wstep?.plik && fsSync.existsSync(s.wstep.plik) ? s.wstep.plik : null;
                    if (!wstep) wstep = (await zrobWstep()).plik;
                    await fs.copyFile(wstep, path.join(praca, 'wstep.mp4'));
                    segmenty.push('wstep.mp4');
                }
                if (zGoscmi) {
                    wRobocie.set(id, { etap: 'goście', zrobione: 0, wszystkich: x.kwestie.length });
                    zapis.goscieFilm = await renderGosci(x, s, baza, { bezGlosu });
                    await fs.copyFile(zapis.goscieFilm, path.join(praca, 'goscie.mp4'));
                    segmenty.push('goscie.mp4');
                }
                const tla = new Map();
                for (const [i, kw] of x.kwestie.entries()) {
                    const m = mowca(kw.kto);
                    wRobocie.set(id, { etap: `${m.imie}: ${bezGlosu ? 'kadr' : 'głos'}`, zrobione: i, wszystkich: x.kwestie.length });
                    let audio = null, dl = czasBezGlosu(kw.tekst);
                    if (!bezGlosu) {
                        // Schowek głosu: ta sama kwestia tym samym głosem nie liczy się drugi raz (ponowne nagranie po błędzie,
                        // po dogrywce czy poprawce jednej linii) — silnik głosu bywa najwolniejszym ogniwem.
                        const jez = jezykWywiadu(x.jezyk);
                        const klucz = createHash('sha1').update(JSON.stringify([kw.tekst, m.glos ?? null, jez])).digest('hex').slice(0, 20);
                        const zSchowka = ['wav', 'mp3'].map((e) => path.join(schowekGlosu, `${klucz}.${e}`)).find((f) => fsSync.existsSync(f));
                        if (zSchowka) {
                            audio = `a-${String(i + 1).padStart(3, '0')}${path.extname(zSchowka)}`;
                            await fs.copyFile(zSchowka, path.join(praca, audio));
                        } else {
                            const g = await cfg.mow({ tekst: kw.tekst, glos: m.glos ?? null, jezyk: jez }).catch((e) => { throw new Error(`Głos „${m.imie}” (kwestia ${i + 1}/${x.kwestie.length}): ${e.message}`); });
                            audio = `a-${String(i + 1).padStart(3, '0')}.${g.ext || 'wav'}`;
                            await fs.writeFile(path.join(praca, audio), g.audio);
                            await fs.writeFile(path.join(schowekGlosu, `${klucz}.${g.ext || 'wav'}`), g.audio).catch(() => {});
                        }
                        const sek = (await cfg.opisz(path.join(praca, audio)).catch(() => null))?.sekundy;
                        if (sek) dl = Math.round((sek + 0.45) * 100) / 100;
                    }
                    const { ujecie, ognisko } = planKadru(i, kw.kto, x.goscie, ujecia);
                    if (!tla.has(ujecie.id)) { const n = `t-${ujecie.id}${path.extname(ujecie.plik).toLowerCase()}`; await fs.copyFile(ujecie.plik, path.join(praca, n)); tla.set(ujecie.id, n); }
                    let karta = null;
                    const zrKarty = [m.wideo, m.zdjecie].find((f) => f && fsSync.existsSync(f));
                    if (zrKarty) { karta = `k-${m.id}${path.extname(zrKarty).toLowerCase()}`; if (!fsSync.existsSync(path.join(praca, karta))) await fs.copyFile(zrKarty, path.join(praca, karta)); }
                    const nr = String(i + 1).padStart(3, '0');
                    await fs.writeFile(path.join(praca, `i-${nr}.txt`), m.imie, 'utf8');
                    const pliki = [];
                    for (const [j, l] of zawin(kw.tekst, 62, 4).entries()) { const n = `l-${nr}-${j}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); pliki.push(n); }
                    await ff(argumentyKadru({ tlo: { plik: tla.get(ujecie.id), ox: ognisko.x, oy: ognisko.y }, karta, kolor: m.kolor || '#f4c84a', imiePlik: `i-${nr}.txt`, liniePliki: pliki, czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: `seg-${nr}.mp4` }), praca);
                    segmenty.push(`seg-${nr}.mp4`);
                }
                wRobocie.set(id, { etap: 'sklejanie', zrobione: x.kwestie.length, wszystkich: x.kwestie.length });
                await fs.writeFile(path.join(praca, 'lista.txt'), segmenty.map((p) => `file '${p}'`).join('\n'), 'utf8');
                await ff(['-y', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', '-movflags', '+faststart', 'odcinek.mp4'], praca);
                let gotowy = 'odcinek.mp4';
                if (plikPodkladu) {
                    wRobocie.set(id, { etap: 'podkład', zrobione: x.kwestie.length, wszystkich: x.kwestie.length });
                    const ext = path.extname(plikPodkladu).toLowerCase();
                    await fs.copyFile(plikPodkladu, path.join(praca, `podklad${ext}`));
                    const dl = (await cfg.opisz(path.join(praca, 'odcinek.mp4')).catch(() => null))?.sekundy ?? 0;
                    await ff(argumentyPodkladu({ film: 'odcinek.mp4', podklad: `podklad${ext}`, wyjscie: 'odcinek-p.mp4', sekundy: dl, glosnosc }), praca);
                    gotowy = 'odcinek-p.mp4';
                }
                const katMontazy = await cfg.katalogMontazy(projekt);
                const jez = jezykWywiadu(x.jezyk);
                const cel = path.join(katMontazy, `podcast_${slug(x.tytul) || 'odcinek'}${jez === 'pl' ? '' : `_${jez}`}_${id.slice(2)}.mp4`);
                await fs.copyFile(path.join(praca, gotowy), cel);
                const o2 = await cfg.opisz(cel).catch(() => null);
                Object.assign(zapis, { etap: 'gotowy', plik: cel, projekt, sekundy: o2?.sekundy ?? null, nagrano: czas() });
                await pisz(plikOdcinka(id), zapis);
                nadaj(`odcinek podcastu „${x.tytul}” nagrany w studiu (${x.goscie.map((g) => mowca(g).imie).join(', ')}) — w montażach projektu ${projekt}`);
                await fs.rm(praca, { recursive: true, force: true }).catch(() => {});
            } catch (e) {
                Object.assign(zapis, { etap: 'blad', blad: String(e.message || e).slice(0, 500) });
                await pisz(plikOdcinka(id), zapis).catch(() => {});
            } finally { wRobocie.delete(id); }
        })();
        return { ...zapis, postep: wRobocie.get(id) };
    }

    /** Plik do podglądu w panelu — tylko z listy: ujęcie, prowadzący, wstęp, nagranie wstępu, gotowy odcinek. */
    async function plik(rodzaj, id = '') {
        const s = await zasiej();
        let p = null;
        if (rodzaj === 'ujecie') p = s.ujecia.find((u) => u.id === id)?.plik;
        else if (rodzaj === 'prowadzacy') p = s.prowadzacy.zdjecie;
        else if (rodzaj === 'wstep') p = s.wstep?.plik;
        else if (rodzaj === 'nagranie') p = s.wstep?.nagranie;
        else if (rodzaj === 'odcinek') p = (await odcinek(id)).plik;
        else if (rodzaj === 'goscie') p = (await odcinek(id)).goscieFilm;
        if (!p || !fsSync.existsSync(p)) throw new Error('Nie ma takiego pliku.');
        return p;
    }

    return {
        studio, zapiszStudio, dodajUjecie, usunUjecie, zrobWstep, zrobWstepWTle, zrobGosci, odcinki, odcinek, przygotuj, zmien, dogrywka, nagraj, plik, planKadru,
        zajete: () => wRobocie.size > 0,
        postepWstepu: () => wRobocie.get('wstep') ?? null,
    };
}

/**
 * 🎛️ Wiele studiów (Suweren 2026-10-04: „opcje dodawania nowych studiów z hostami, tak by inni mogli własne tworzyć”).
 * `teo` = pierwsze studio (dotychczasowy katalog i paczka — nic się nie przenosi); kolejne w `<katalog>/studia/<id>/`,
 * każde z własnymi ujęciami, prowadzącym (zdjęcie, głos, nagranie wstępu), odcinkami i katalogiem montaży
 * `studio-podcast-<id>`. Nowe studio startuje bez ujęć — Suweren dodaje własne zdjęcia sceny.
 */
export const STUDIO_DOMYSLNE = 'teo';
export function utworzStudia({ katalog, paczka = null, ...wspolne }) {
    const KAT = path.join(katalog, 'studia');
    const instancje = new Map();
    const katalogStudia = (id) => (id === STUDIO_DOMYSLNE ? katalog : path.join(KAT, id));
    const zKatalogu = (id, start = null) => utworzStudioPodcastu({
        ...wspolne, katalog: katalogStudia(id), paczka: id === STUDIO_DOMYSLNE ? paczka : null,
        projekt: id === STUDIO_DOMYSLNE ? PROJEKT_STUDIA : `${PROJEKT_STUDIA}-${id}`, start,
    });
    function get(id = STUDIO_DOMYSLNE) {
        const i = String(id || STUDIO_DOMYSLNE);
        if (instancje.has(i)) return instancje.get(i);
        if (i !== STUDIO_DOMYSLNE && (!/^[a-z0-9-]{1,40}$/.test(i) || !fsSync.existsSync(path.join(KAT, i, 'studio.json')))) throw new Error(`Nie ma studia „${i}”.`);
        const inst = zKatalogu(i);
        instancje.set(i, inst);
        return inst;
    }
    async function skrot(id) {
        const st = await get(id).studio();
        const odc = await get(id).odcinki().catch(() => []);
        return { id, nazwa: st.nazwa, prowadzacy: st.prowadzacy?.imie ?? '', kolor: st.prowadzacy?.kolor ?? '#22d3ee', ujec: st.ujecia?.length ?? 0, odcinkow: odc.length, domyslne: id === STUDIO_DOMYSLNE };
    }
    async function lista() {
        const ids = (await fs.readdir(KAT, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && fsSync.existsSync(path.join(KAT, d.name, 'studio.json'))).map((d) => d.name).sort();
        return Promise.all([STUDIO_DOMYSLNE, ...ids].map(skrot));
    }
    async function stworz({ nazwa = '', opis = '', prowadzacy = {} } = {}) {
        const n = String(nazwa).replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!n) throw new Error('Nowe studio potrzebuje nazwy.');
        const imie = String(prowadzacy?.imie ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        if (!imie) throw new Error('Nowe studio potrzebuje prowadzącego (imię).');
        let id = slug(n) || `studio-${Date.now().toString(36)}`;
        if (id === STUDIO_DOMYSLNE || fsSync.existsSync(path.join(KAT, id))) id = `${id}-${Date.now().toString(36).slice(-4)}`;
        const inst = zKatalogu(id, { nazwa: n, opis: String(opis).trim().slice(0, 800), prowadzacy: { imie, rola: String(prowadzacy?.rola ?? '').trim().slice(0, 600), kolor: /^#[0-9a-f]{6}$/i.test(prowadzacy?.kolor ?? '') ? prowadzacy.kolor : '#a855f7' } });
        await inst.studio();   // zapisuje studio.json
        instancje.set(id, inst);
        return skrot(id);
    }
    /** Usuwa studio z Katedry (ujęcia, odcinki robocze). Gotowe filmy zostają w montażach projektu. Pierwsze studio zostaje. */
    async function usun(id) {
        if (id === STUDIO_DOMYSLNE) throw new Error('Pierwszego studia nie usuwam — możesz je przemianować i zmienić prowadzącego.');
        const inst = get(id);
        if (inst.zajete()) throw new Error('W tym studiu coś się właśnie nagrywa.');
        await fs.rm(path.join(KAT, id), { recursive: true, force: true });
        instancje.delete(id);
        return { id };
    }
    return { get, lista, stworz, usun };
}

export default { utworzStudioPodcastu, utworzStudia, STUDIO_DOMYSLNE, STYLE_WYWIADU, temperaturaZPralki, promptDogrywki, filtrTla, argumentyGosci, zapowiedzGosci, argumentyKadru, argumentyWstepu, planNapisow, promptOdcinka, PROJEKT_STUDIA, PROWADZACY_ID, UJECIA_PACZKI, OGNISKA_DOMYSLNE };
