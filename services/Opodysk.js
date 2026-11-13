/**
 * 🎞️ OPODYSK = Opowieść + Teledysk (Suweren 2026-11-13: „Jason ma z ujęć storyboardu i master.wav kręcić gotowy film na
 * całą długość utworu… Ken Burns, miękkie przejścia xfade, napis opowieści, AAC 320 kb/s, H.264 1920×1080 pod YouTube”).
 *
 * Czysty montaż ffmpeg — bez modelu i bez GPU:
 *   1. każde ujęcie storyboardu (klatka FLUX `storyboard/scena-N-16x9.png`) → segment mp4 z ruchem filmowym (zoompan:
 *      najazd / odjazd / panorama — dobrany do planu ujęcia, nigdy ten sam dwa razy pod rząd) i opcjonalnym napisem
 *      opowieści (wersy ujęcia, każdy przez swoją część czasu; ujęcia bez słów zostają bez napisu),
 *   2. segmenty łączone przejściami `xfade` — klip ujęcia jest dłuższy o połowę przejścia z każdej strony, więc środek
 *      przenikania wypada DOKŁADNIE na granicy ujęć ze storyboardu, a film ma długość utworu co do klatki,
 *   3. pod całość idzie `master.wav` zakodowany do AAC 320 kb/s; kontener mp4 z `+faststart`.
 * UCZCIWIE: klatki FLUX mają 1280×720 — do 1920×1080 są powiększane (Lanczos), szczegółów z tego nie przybywa.
 * To ruch po nieruchomych klatkach (Ken Burns), nie wideo generowane ujęcie po ujęciu.
 */
import fs from 'fs/promises';
import path from 'path';

export const FPS = 30, SZER = 1920, WYS = 1080;
export const PLIK_OPODYSKU = 'opodysk_youtube_16x9.mp4';
export const RUCHY = ['najazd', 'odjazd', 'w-prawo', 'w-lewo', 'w-gore', 'w-dol'];

/** Ruch kamery dla ujęcia: detale i portrety — najazd, plany szerokie — odjazd albo panorama; nigdy ten sam co poprzednio. */
export function ruchUjecia(sc, i, poprzedni = null) {
    const p = String(sc?.plan ?? '');
    const kandydaci = /Makro|Detal|Zbliżenie|Portret|Profil|Odbicie/i.test(p) ? ['najazd', 'w-prawo', 'w-lewo']
        : /Plan ogólny|Plan szeroki|Z ulicy|Zza szyby|Plan pełny/i.test(p) ? ['odjazd', 'w-lewo', 'w-prawo']
        : /Z góry|W górę/i.test(p) ? ['w-dol', 'w-gore', 'najazd']
        : /W ruchu/i.test(p) ? ['w-gore', 'odjazd', 'najazd']
        : [RUCHY[i % RUCHY.length], 'najazd', 'odjazd'];
    return kandydaci.find((r) => r !== poprzedni) ?? kandydaci[0];
}

/** Filtr zoompan dla ruchu (wejście powiększone do 1,5× kadru, żeby ruch był gładki). */
export function filtrKenBurns(ruch, klatek) {
    const N = Math.max(2, klatek);
    const srodekX = "x='iw/2-(iw/zoom/2)'", srodekY = "y='ih/2-(ih/zoom/2)'";
    const z = {
        najazd: `z='1+0.14*on/${N}':${srodekX}:${srodekY}`,
        odjazd: `z='1.14-0.14*on/${N}':${srodekX}:${srodekY}`,
        'w-prawo': `z='1.12':x='(iw-iw/zoom)*on/${N}':${srodekY}`,
        'w-lewo': `z='1.12':x='(iw-iw/zoom)*(1-on/${N})':${srodekY}`,
        'w-gore': `z='1.12':${srodekX}:y='(ih-ih/zoom)*(1-on/${N})'`,
        'w-dol': `z='1.12':${srodekX}:y='(ih-ih/zoom)*on/${N}'`,
    }[ruch] ?? `z='1+0.14*on/${N}':${srodekX}:${srodekY}`;
    return `scale=${SZER * 1.5}:${WYS * 1.5}:flags=lanczos,zoompan=${z}:d=${N}:s=${SZER}x${WYS}:fps=${FPS},setsar=1,format=yuv420p`;
}

/** Wers → najwyżej dwa wiersze napisu (żeby zmieścił się w kadrze). */
export function zawin(wers, max = 46) {
    const slowa = String(wers ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const wiersze = [''];
    for (const s of slowa) {
        const ost = wiersze[wiersze.length - 1];
        if (ost && (ost + ' ' + s).length > max && wiersze.length < 2) wiersze.push(s);
        else wiersze[wiersze.length - 1] = ost ? `${ost} ${s}` : s;
    }
    return wiersze.filter(Boolean);
}

/**
 * Plan montażu: granice ujęć w klatkach, długość przejścia i klipy. Klip i trwa od (start_i − pół przejścia) do
 * (start_{i+1} + pół przejścia); pierwszy zaczyna się w 0, ostatni kończy z utworem. `offset` = chwila startu xfade.
 */
export function planMontazu(sceny, sekundy, { przejscie = 1 } = {}) {
    const razem = Math.round(Number(sekundy) * FPS);
    const start = sceny.map((sc, i) => (i === 0 ? 0 : Math.max(1, Math.round(Number(sc.od) * FPS))));
    const dlugosci = start.map((s, i) => (i < start.length - 1 ? start[i + 1] : razem) - s);
    if (dlugosci.some((d) => d < 2)) throw new Error('Ujęcia storyboardu mają złe czasy (ujęcie krótsze niż 2 klatki).');
    // przejście: parzysta liczba klatek, najwyżej 1/3 najkrótszego ujęcia
    let T = Math.min(Math.round(przejscie * FPS), Math.floor(Math.min(...dlugosci) / 3));
    T = sceny.length > 1 ? Math.max(2, T - (T % 2)) : 0;
    const pol = T / 2;
    const klipy = sceny.map((sc, i) => {
        const od = i === 0 ? 0 : start[i] - pol, doK = i === sceny.length - 1 ? razem : start[i + 1] + pol;
        return { nr: sc.nr, od, klatek: doK - od, poczatekUjecia: start[i] - od, klatekUjecia: dlugosci[i], offset: i === 0 ? 0 : (start[i] - pol) / FPS };
    });
    return { razem, sekundy: razem / FPS, przejscieKlatek: T, przejscie: T / FPS, klipy };
}

/** Napisy ujęcia w czasie KLIPU: każdy wers przez swoją część ujęcia (z oddechem 0,25 s), wiersze jeden pod drugim. */
export function napisyKlipu(sc, klip) {
    const wersy = (sc.wersy ?? []).filter(Boolean);
    if (!wersy.length) return [];
    const t0 = klip.poczatekUjecia / FPS, d = klip.klatekUjecia / FPS / wersy.length;
    return wersy.map((w, j) => ({ wiersze: zawin(w), od: Math.round((t0 + j * d + 0.25) * 100) / 100, do: Math.round((t0 + (j + 1) * d - 0.25) * 100) / 100 })).filter((n) => n.do > n.od);
}

/** Argumenty ffmpeg segmentu ujęcia (uruchamiane w katalogu roboczym — nazwy względne, bo drawtext nie lubi „C:\”). */
export function argumentySegmentu({ obraz, klatek, ruch, napisy = [], czcionka = null, wyjscie }) {
    let vf = filtrKenBurns(ruch, klatek);
    if (czcionka) for (const n of napisy) n.pliki.forEach((plik, w) => {
        const y = WYS - 150 + (w - (n.pliki.length - 1)) * 58;
        vf += `,drawtext=fontfile=${czcionka}:textfile=${plik}:expansion=none:fontsize=42:fontcolor=white@0.94:x=(w-text_w)/2:y=${y}`
            + `:shadowcolor=black@0.85:shadowx=2:shadowy=2:box=1:boxcolor=black@0.30:boxborderw=14:enable='between(t,${n.od},${n.do})'`;
    });
    return ['-loglevel', 'error', '-y', '-i', obraz, '-vf', vf, '-frames:v', String(klatek), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', wyjscie];
}

/** Argumenty ffmpeg składania: segmenty + xfade + master.wav → H.264 1080p + AAC 320 kb/s. */
export function argumentySkladania({ segmenty, plan, audio, wyjscie }) {
    const a = ['-loglevel', 'error', '-y'];
    for (const s of segmenty) a.push('-i', s);
    a.push('-i', audio);
    let ost = '0:v';
    const lancuch = [];
    for (let i = 1; i < segmenty.length; i++) {
        lancuch.push(`[${ost}][${i}:v]xfade=transition=fade:duration=${plan.przejscie}:offset=${plan.klipy[i].offset}[v${i}]`);
        ost = `v${i}`;
    }
    if (lancuch.length) a.push('-filter_complex', lancuch.join(';'), '-map', `[${ost}]`);
    else a.push('-map', '0:v');
    a.push('-map', `${segmenty.length}:a`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-t', String(plan.sekundy), wyjscie);
    return a;
}

/** Długość pliku w sekundach z nagłówka (ffmpeg -i kończy błędem „brak wyjścia”, ale Duration wypisuje). */
export async function dlugoscPliku(ffmpeg, uruchom, plik) {
    let tekst = '';
    try { const r = await uruchom(ffmpeg, ['-hide_banner', '-i', plik], { windowsHide: true }); tekst = `${r?.stderr ?? ''}`; } catch (e) { tekst = `${e?.stderr ?? ''}`; }
    const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(tekst);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * Składa Opodysk. `sb` = storyboard z klatkami 16:9, `kat` = folder paczki, `praca` = katalog roboczy (sprzątany przez wołającego).
 * `postep(zrobione, razem, etap)` — po każdym segmencie. Zwraca { plik, sekundy, bajtow, ujec, przejscie, napisy, ruchy }.
 */
export async function zlozOpodysk({ sb, kat, praca, ffmpeg, uruchom, czcionka = null, napisy = true, postep = () => {} }) {
    const sceny = sb.sceny;
    const sekundy = Number(sb.sekundy);
    if (!(sekundy > 0)) throw new Error('Storyboard nie zna długości utworu.');
    const audio = path.join(kat, 'master.wav');
    await fs.access(audio).catch(() => { throw new Error('W paczce nie ma master.wav.'); });
    const plan = planMontazu(sceny, sekundy);
    await fs.mkdir(praca, { recursive: true });
    const zNapisami = napisy && !!czcionka;
    if (zNapisami) await fs.copyFile(czcionka, path.join(praca, 'czcionka.ttf'));
    const uruchomTu = (args) => uruchom(ffmpeg, args, { cwd: praca, maxBuffer: 1 << 24, timeout: 30 * 60_000, windowsHide: true });
    const segmenty = [], ruchy = [];
    let poprzedni = null;
    for (let i = 0; i < sceny.length; i++) {
        const sc = sceny[i], klip = plan.klipy[i];
        const klatka = sc.kadry?.['16:9']?.plik;
        if (!klatka) throw new Error(`Ujęcie ${sc.nr} nie ma klatki 16:9.`);
        const nr = String(sc.nr).padStart(2, '0');
        await fs.copyFile(path.join(kat, ...klatka.split('/')), path.join(praca, `klatka-${nr}.png`));
        const ruch = ruchUjecia(sc, i, poprzedni); poprzedni = ruch; ruchy.push(ruch);
        const linie = [];
        if (zNapisami) for (const [j, n] of napisyKlipu(sc, klip).entries()) {
            const pliki = [];
            for (const [w, wiersz] of n.wiersze.entries()) { const p = `n-${nr}-${j}-${w}.txt`; await fs.writeFile(path.join(praca, p), wiersz, 'utf8'); pliki.push(p); }
            linie.push({ pliki, od: n.od, do: n.do });
        }
        await uruchomTu(argumentySegmentu({ obraz: `klatka-${nr}.png`, klatek: klip.klatek, ruch, napisy: linie, czcionka: zNapisami ? 'czcionka.ttf' : null, wyjscie: `seg-${nr}.mp4` }));
        segmenty.push(`seg-${nr}.mp4`);
        await postep(i + 1, sceny.length + 1, `ujęcie ${sc.nr} z ${sceny.length}`);
    }
    await uruchomTu(argumentySkladania({ segmenty, plan, audio, wyjscie: 'opodysk.mp4' }));
    const gotowy = path.join(praca, 'opodysk.mp4');
    const dl = await dlugoscPliku(ffmpeg, uruchom, gotowy);
    if (dl == null || Math.abs(dl - plan.sekundy) > 0.25) throw new Error(`Film wyszedł ${dl ?? '?'} s zamiast ${plan.sekundy.toFixed(2)} s.`);
    const cel = path.join(kat, PLIK_OPODYSKU);
    await fs.rm(cel, { force: true });
    await fs.copyFile(gotowy, cel);
    await postep(sceny.length + 1, sceny.length + 1, 'gotowe');
    return { plik: PLIK_OPODYSKU, sekundy: Math.round(dl * 10) / 10, bajtow: (await fs.stat(cel)).size, ujec: sceny.length, przejscie: plan.przejscie, napisy: zNapisami, ruchy };
}

export default { zlozOpodysk, planMontazu, napisyKlipu, ruchUjecia, filtrKenBurns, argumentySegmentu, argumentySkladania, dlugoscPliku, zawin, FPS, SZER, WYS, PLIK_OPODYSKU, RUCHY };
