/**
 * 📱 Formaty i sieci — gotowe odcinki Katedry → krótkie formy pionowe (Suweren 2026-10-15: „dział, który przerabia
 * materiały na Shorts, TikTok i Instagram”).
 *
 * WEJŚCIE: mp4 z katalogów montaży (`produkcje/<projekt>/montaz/`) — ⚽ Gol Dnia i 🦓 Studio Zebrra Football, 🎪 TeO Game Show,
 * 🎭 wywiady, podcasty, sceny. Nic spoza katalogów montaży.
 * PRZERÓBKA (ffmpeg): pion 1080×1920, 30 kl/s, H.264 + AAC; układ `rozmyte` (cały kadr na środku, tło = ten sam kadr
 * powiększony i rozmyty — napisy wpalone w odcinek zostają widoczne), `letterbox` (czarne pasy) albo `srodek` (wycinek
 * 9:16 z kadru, przesuwany `kadrX` 0–1 — np. na mówiącego prowadzącego; napisy z boków odcinka giną). Wycinek od–do.
 * NAPISY: `zachowane` (to, co w odcinku) albo `z-kwestii` — duże napisy w pustym polu pionu z kwestii scenariusza, z czasem
 * kwestii. Czasy znamy tam, gdzie znamy granice: Gol Dnia z napisami składa odcinek z segmentów `praca/seg-NNN.mp4`
 * w kolejności `kwestieOdcinka` → każdy gol osobno (przed + okrzyk + po) i cały skrót. Studio Zebrra (nagranie 3D)
 * granic kwestii nie zapisuje — tam od–do ręcznie, bez zgadywania.
 * WYNIK: `produkcje/<projekt>/formaty/<nazwa>_<układ>_<id>.mp4`.
 * CELE (długość): YouTube Shorts ≤ 60 s (YouTube od 2024 przyjmuje Shorts do 3 min, ale ≤ 60 s pion jest Shortem zawsze),
 * Instagram Reels ≤ 90 s (Reels z API mogą być dłuższe, 90 s = pewny Reel w zakładce), TikTok ≤ 10 min (konkretny limit
 * twórcy podaje TikTok). Za długi klip = cel `ok: false` z powodem, nie przycinamy po cichu.
 *
 * PUBLIKACJA — zawsze ✓ Suwerena przed wysyłką:
 *   youtube   → services/PublikacjeYouTube.js (Kronikarz → ✓ w Izbie → Impresariat); pion ≤ 60 s = Short, opis niesie #Shorts;
 *   tiktok    → services/KontaSieci.js: szkic do skrzynki konta TikTok (opis Suweren wkleja w aplikacji — API szkicu go nie bierze);
 *   instagram → services/KontaSieci.js: Reel PUBLICZNY od razu po ✓ (API nie ma szkiców).
 * Opis do TikTok/Instagram pisze Kronikarz (ten sam format TYTUŁ/OPIS/TAGI), Suweren poprawia przed ✓.
 * Plik `_OtakOs_Wymiar/formaty/klipy.json`.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { kwestieOdcinka, kontekstKronikarza } from './GolDnia.js';
import { systemKronikarza, odczytajMetadane } from './PublikacjeYouTube.js';
import { CZCIONKI, zawin } from './PowitanieDnia.js';
import { SCIEZKI_ZWROTU } from './KontaSieci.js';

const uruchom = promisify(execFile);
export const SZER = 1080, WYS = 1920, FPS = 30;
export const MAX_KLIPU = 180;
export const CELE = {
    shorts: { nazwa: 'YouTube Shorts', siec: 'youtube', max: 60 },
    reels: { nazwa: 'Instagram Reels', siec: 'instagram', max: 90 },
    tiktok: { nazwa: 'TikTok', siec: 'tiktok', max: 600 },
};
export const SIECI_PUBLIKACJI = { youtube: 'shorts', tiktok: 'tiktok', instagram: 'reels' };
export const UKLADY = {
    rozmyte: '🌫️ cały kadr + rozmyte tło',
    letterbox: '⬛ cały kadr + czarne pasy',
    srodek: '✂️ wycinek 9:16 z kadru',
};
export const NAPISY = { zachowane: 'zachowane (z odcinka)', 'z-kwestii': 'duże napisy z kwestii scenariusza' };
const WIDEO = /\.(mp4|mov|webm)$/i;
const ID = /^f-[0-9a-f]{8}$/;

/** Program z nazwy pliku montażu (tak je nazywają serwisy programów). */
export function programZPliku(nazwa) {
    const n = path.basename(String(nazwa));
    if (/^gol_.*_studio_/i.test(n)) return { id: 'studio-zebrra', nazwa: '🦓 Studio Zebrra Football' };
    if (/^gol_/i.test(n)) return { id: 'gol-dnia', nazwa: '⚽ Gol Dnia' };
    if (/^gameshow_/i.test(n)) return { id: 'game-show', nazwa: '🎪 TeO Game Show' };
    if (/^wywiad_/i.test(n)) return { id: 'wywiad', nazwa: '🎭 Wywiad' };
    if (/^podcast_/i.test(n)) return { id: 'podcast', nazwa: '🎙️ Podcast' };
    if (/^scena_/i.test(n)) return { id: 'scena', nazwa: '💬 Scena' };
    return { id: 'inne', nazwa: '🎬 Montaż' };
}
export const jezykZPliku = (nazwa) => (/_en_[a-z0-9]{6,}\.[^.]+$/i.test(path.basename(String(nazwa))) ? 'en' : 'pl');

/** Bez emoji i znaków sterujących — drawtext ich nie narysuje (kwadraty). */
export const czystyNapis = (t) => String(t ?? '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

/** Filtr wideo układu → 1080×1920. `kadrX` 0–1 tylko dla `srodek`. */
export function filtrUkladu(uklad = 'rozmyte', { kadrX = 0.5 } = {}) {
    const x = Math.min(1, Math.max(0, Number.isFinite(Number(kadrX)) ? Number(kadrX) : 0.5));
    if (uklad === 'srodek') return `scale=${SZER}:${WYS}:force_original_aspect_ratio=increase,crop=${SZER}:${WYS}:(iw-${SZER})*${x.toFixed(3)}:(ih-${WYS})/2,setsar=1`;
    if (uklad === 'letterbox') return `scale=${SZER}:${WYS}:force_original_aspect_ratio=decrease,pad=${SZER}:${WYS}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
    if (uklad !== 'rozmyte') throw new Error(`Nieznany układ: ${uklad}`);
    return `split=2[tlo0][przod0];[tlo0]scale=${SZER}:${WYS}:force_original_aspect_ratio=increase,crop=${SZER}:${WYS},boxblur=28:2,eq=brightness=-0.12[tlo];`
        + `[przod0]scale=${SZER}:${WYS}:force_original_aspect_ratio=decrease[przod];[tlo][przod]overlay=(W-w)/2:(H-h)/2,setsar=1`;
}

/**
 * Argumenty ffmpeg jednego klipu. Pliki tekstowe WZGLĘDNE do cwd (drawtext `textfile`, bez rozwijania).
 * @param {{ wejscie:string, od:number, dlugosc:number, uklad:string, kadrX?:number, maAudio:boolean, czcionka?:string|null,
 *   tytulPliki?:string[], napisy?:{od:number, do:number, pliki:string[]}[], wyjscie:string }} a
 */
export function argumentyKlipu({ wejscie, od, dlugosc, uklad, kadrX = 0.5, maAudio, czcionka = null, tytulPliki = [], napisy = [], wyjscie }) {
    const d = Number(dlugosc).toFixed(3);
    const tekst = (plik, y, rozmiar, kolor, wlacz = null) => `,drawtext=fontfile=${czcionka}:textfile=${plik}:expansion=none:fontsize=${rozmiar}:fontcolor=${kolor}`
        + `:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.55:boxborderw=16:shadowcolor=black@0.8:shadowx=2:shadowy=2${wlacz ? `:enable='between(t,${wlacz[0].toFixed(2)},${wlacz[1].toFixed(2)})'` : ''}`;
    const goraNapisow = uklad === 'srodek' ? 1380 : 1330;
    let warstwy = '';
    if (czcionka) {
        tytulPliki.forEach((p, i) => { warstwy += tekst(p, 190 + i * 84, 66, '0xffd166'); });
        for (const n of napisy) n.pliki.forEach((p, i) => { warstwy += tekst(p, goraNapisow + i * 80, 58, 'white', [n.od, n.do]); });
    }
    const filtr = `[0:v]fps=${FPS},${filtrUkladu(uklad, { kadrX })}${warstwy},format=yuv420p[v];`
        + `[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${d}[a]`;
    const audio = maAudio ? ['-ss', Number(od).toFixed(3), '-t', d, '-i', wejscie] : ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
    return ['-y', '-ss', Number(od).toFixed(3), '-t', d, '-i', wejscie, ...audio, '-filter_complex', filtr,
        '-map', '[v]', '-map', '[a]', '-t', d, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-profile:v', 'high',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', wyjscie];
}

/** Czy klip mieści się w celu (długość). */
export function celeKlipu(sekundy) {
    return Object.fromEntries(Object.entries(CELE).map(([id, c]) => [id, sekundy == null ? { ok: false, powod: 'nieznana długość' }
        : sekundy <= c.max ? { ok: true } : { ok: false, powod: `${Math.round(sekundy)} s > ${c.max} s — skróć wycinek` }]));
}

/**
 * Gol Dnia z napisami: segmenty w kolejności kwestii → propozycje klipów. `dlugosci[i]` = sekundy segmentu kwestii nr i+1.
 * Każdy gol = przed + okrzyk + po; „cały skrót” = wszystko. Napisy z kwestii z czasem względem klipu.
 */
export function propozycjeGolDnia(s, dlugosci) {
    const kw = kwestieOdcinka(s);
    if (!kw.length || kw.length !== dlugosci.length || dlugosci.some((x) => !(x > 0))) return [];
    const start = [];
    let t = 0;
    for (const d of dlugosci) { start.push(t); t += d; }
    const en = s.jezyk === 'en';
    const zakres = (nry, id, nazwa, tytul) => {
        const od = start[nry[0] - 1], dok = start[nry.at(-1) - 1] + dlugosci[nry.at(-1) - 1];
        const napisy = nry.map((nr) => ({ od: start[nr - 1] - od, do: start[nr - 1] + dlugosci[nr - 1] - od, tekst: kw[nr - 1].tekst }));
        return { id, nazwa, od: Math.round(od * 100) / 100, do: Math.round(dok * 100) / 100, tytul, napisy };
    };
    const out = s.gole.map((g, i) => zakres(kw.filter((k) => k.gol === i).map((k) => k.nr), `gol-${i + 1}`,
        `⚽ ${g.minuta}' ${g.strzelec}`, `${en ? 'GOAL' : 'GOL'} ${g.minuta}' · ${g.strzelec}`));
    out.push(zakres(kw.map((k) => k.nr), 'skrot', `🏟️ ${en ? 'Full recap' : 'Cały skrót'}`, `${s.mecz.gospodarze} ${s.mecz.wynik[0]}:${s.mecz.wynik[1]} ${s.mecz.goscie}`));
    return out;
}

/**
 * @param {{ katalog:string, katalogMontazy:(projekt:string)=>Promise<string>, opisz:(p:string)=>Promise<{sekundy:number|null, maAudio?:boolean, szerokosc?:number, wysokosc?:number}>,
 *   ffmpeg?:string, pisz?:(system:string, prompt:string)=>Promise<{tekst:string, silnik?:string}>,
 *   youtube?:{ przygotuj:Function, zmien:Function, zatwierdz?:Function, wszystkie:()=>Promise<any[]> },
 *   tiktok?:{ stan:Function, wyslijSzkic:Function, stanWysylki:Function }, instagram?:{ stan:Function, opublikujReel:Function },
 *   szyna?:any, teraz?:()=>number }} o
 */
export function utworzFormaty(o) {
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), ...o };
    const KAT = path.join(cfg.katalog, 'formaty');
    const PLIK = path.join(KAT, 'klipy.json');
    const PRODUKCJE = path.join(cfg.katalog, 'produkcje');
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Impresario', rodzaj: 'praca', tresc: `📱 ${tresc}` })?.catch?.(() => {});
    const wRobocie = new Set();   // id klipów i `id:siec` wysyłek żyjących w tym procesie
    let lista = null, zapis = Promise.resolve(), kolejka = Promise.resolve();

    async function wczytaj() {
        if (lista) return lista;
        try { lista = JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { lista = []; }
        if (!Array.isArray(lista)) lista = [];
        // 👻 duchy po restarcie mostu: praca nie żyje w pamięci → błąd z powodem (nie „robi” na zawsze)
        for (const k of lista) {
            if (['w_kolejce', 'robi'].includes(k.stan) && !wRobocie.has(k.id)) Object.assign(k, { stan: 'blad', powod: 'przerwane restartem mostu — „↻ Przerób ponownie”' });
            for (const [siec, p] of Object.entries(k.publikacje ?? {})) {
                if (siec !== 'youtube' && p.etap === 'wysylanie' && !wRobocie.has(`${k.id}:${siec}`)) Object.assign(p, { etap: 'blad', blad: siec === 'instagram' ? 'Wysyłka przerwana restartem mostu — sprawdź na Instagramie, czy Reel nie wyszedł, zanim wyślesz ponownie.' : 'Wysyłka przerwana restartem mostu.' });
            }
        }
        return lista;
    }
    function zapisz() {
        zapis = zapis.then(async () => {
            await fs.mkdir(KAT, { recursive: true });
            await fs.writeFile(`${PLIK}.tmp`, JSON.stringify(lista, null, 1), 'utf8');
            await fs.rename(`${PLIK}.tmp`, PLIK);
        }).catch(() => {});
        return zapis;
    }
    const znajdz = async (id) => {
        if (!ID.test(String(id))) throw new Error('Złe id klipu.');
        const k = (await wczytaj()).find((x) => x.id === id);
        if (!k) throw new Error('Nie ma takiego klipu.');
        return k;
    };

    /** Plik z katalogu montaży (i tylko stamtąd) → { abs, projekt }. */
    function zrodloMontazu(plik) {
        const abs = path.resolve(String(plik ?? ''));
        const rel = path.relative(PRODUKCJE, abs).split(path.sep);
        if (rel.length !== 3 || rel[0].startsWith('..') || rel[1] !== 'montaz' || !/^[a-z0-9-]+$/.test(rel[0]) || !WIDEO.test(abs)) throw new Error('Formaty przerabiają tylko gotowe filmy z katalogu montaży projektu (produkcje/<projekt>/montaz/).');
        if (!fsSync.existsSync(abs)) throw new Error(`Nie ma pliku: ${path.basename(abs)}`);
        return { abs, projekt: rel[0] };
    }

    /** Odcinki do przeróbki: wszystkie montaże projektów, najnowsze pierwsze. */
    async function zrodla({ limit = 200 } = {}) {
        const out = [];
        const projekty = await fs.readdir(PRODUKCJE, { withFileTypes: true }).catch(() => []);
        for (const p of projekty) {
            if (!p.isDirectory() || !/^[a-z0-9-]+$/.test(p.name)) continue;
            const kat = path.join(PRODUKCJE, p.name, 'montaz');
            for (const f of await fs.readdir(kat).catch(() => [])) {
                if (!WIDEO.test(f)) continue;
                const st = await fs.stat(path.join(kat, f)).catch(() => null);
                if (st?.isFile()) out.push({ plik: path.join(kat, f), nazwa: f, projekt: p.name, program: programZPliku(f), jezyk: jezykZPliku(f), bajtow: st.size, zmieniono: st.mtime.toISOString() });
            }
        }
        return out.sort((a, b) => b.zmieniono.localeCompare(a.zmieniono)).slice(0, limit);
    }

    /** Odcinek Gol Dnia (tylko odczyt) po końcówce nazwy pliku `_<8 hex>.mp4`. */
    async function odcinekGolDnia(abs) {
        const id = path.basename(abs).match(/_([0-9a-f]{8})\.mp4$/i)?.[1];
        if (!id) return null;
        try { return JSON.parse(await fs.readFile(path.join(cfg.katalog, 'gol-dnia', `g-${id}`, 'odcinek.json'), 'utf8')); } catch { return null; }
    }

    /**
     * Opis źródła + propozycje klipów. Gol Dnia z napisami → każdy gol i cały skrót (granice z segmentów). Inne → bez
     * propozycji (od–do ręcznie), chyba że cały film mieści się w Shorts.
     */
    async function propozycje(plik) {
        const { abs, projekt } = zrodloMontazu(plik);
        const opis = await cfg.opisz(abs).catch(() => null);
        const program = programZPliku(abs);
        let lista_ = [], uwaga = null, kwestie = false;
        if (program.id === 'gol-dnia' || program.id === 'studio-zebrra') {
            const s = await odcinekGolDnia(abs);
            if (!s) uwaga = 'Nie znalazłem odcinka Gol Dnia dla tego pliku — od–do ręcznie.';
            else if (s.studio?.plik && path.resolve(s.studio.plik) === abs) uwaga = 'Nagranie ze Studia Zebrra nie zapisuje granic kwestii — wytnij od–do ręcznie (podgląd obok).';
            else if (path.resolve(s.plik ?? '') !== abs || !Array.isArray(s.segmenty)) uwaga = 'Ten plik nie jest bieżącym odcinkiem z segmentów — od–do ręcznie.';
            else {
                const dl = [];
                for (const seg of s.segmenty) dl.push((await cfg.opisz(path.join(cfg.katalog, 'gol-dnia', s.id, 'praca', seg)).catch(() => null))?.sekundy ?? null);
                lista_ = propozycjeGolDnia(s, dl);
                kwestie = lista_.length > 0;
                if (!kwestie) uwaga = 'Segmentów odcinka już nie ma na dysku albo nie pasują do kwestii — od–do ręcznie.';
            }
        }
        if (!lista_.length && opis?.sekundy && opis.sekundy <= CELE.shorts.max) lista_ = [{ id: 'calosc', nazwa: '🎬 Cały film', od: 0, do: opis.sekundy, tytul: '', napisy: [] }];
        return { plik: abs, nazwa: path.basename(abs), projekt, program, jezyk: jezykZPliku(abs), opis, propozycje: lista_.map((p) => ({ ...p, cele: celeKlipu(p.do - p.od) })), kwestie, uwaga };
    }

    async function ffmpeg(args, cwd) {
        try { await uruchom(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, maxBuffer: 1 << 24, timeout: 20 * 60_000, windowsHide: true }); }
        catch (e) { throw new Error(`ffmpeg: ${String(e.stderr || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`); }
    }

    async function przerob(k) {
        const praca = path.join(KAT, 'praca', k.id);
        await fs.rm(praca, { recursive: true, force: true });
        await fs.mkdir(praca, { recursive: true });
        try {
            const opis = await cfg.opisz(k.zrodlo);
            const dlugosc = Math.min(k.do, opis?.sekundy ?? k.do) - k.od;
            if (!(dlugosc > 0.5)) throw new Error('Wycinek pusty albo poza filmem.');
            const tytulL = k.tytul ? zawin(czystyNapis(k.tytul), 26, 2) : [];
            const napisyL = (k.napisy === 'z-kwestii' ? k.napisyLista ?? [] : []).map((n) => ({ ...n, linie: zawin(czystyNapis(n.tekst), 30, 4) })).filter((n) => n.linie.length && n.do > n.od);
            let czcionka = null;
            if (tytulL.length || napisyL.length) {
                const z = CZCIONKI.find((p) => fsSync.existsSync(p));
                if (!z) throw new Error('Nie znalazłem czcionki z polskimi znakami (OTAKOS_POWITANIE_CZCIONKA).');
                await fs.copyFile(z, path.join(praca, 'czcionka.ttf'));
                czcionka = 'czcionka.ttf';
            }
            const tytulPliki = [];
            for (const [i, l] of tytulL.entries()) { await fs.writeFile(path.join(praca, `t-${i}.txt`), l, 'utf8'); tytulPliki.push(`t-${i}.txt`); }
            const napisy = [];
            for (const [j, n] of napisyL.entries()) {
                const pliki = [];
                for (const [i, l] of n.linie.entries()) { const p = `n-${j}-${i}.txt`; await fs.writeFile(path.join(praca, p), l, 'utf8'); pliki.push(p); }
                napisy.push({ od: Math.max(0, n.od), do: Math.min(dlugosc, n.do), pliki });
            }
            await ffmpeg(argumentyKlipu({ wejscie: k.zrodlo, od: k.od, dlugosc, uklad: k.uklad, kadrX: k.kadrX, maAudio: opis?.maAudio !== false, czcionka, tytulPliki, napisy, wyjscie: 'klip.mp4' }), praca);
            const kat = path.join(path.dirname(await cfg.katalogMontazy(k.projekt)), 'formaty');
            await fs.mkdir(kat, { recursive: true });
            const baza = path.basename(k.zrodlo).replace(/\.[^.]+$/, '').replace(/_[0-9a-f]{8}$/i, '').slice(0, 60);
            const cel = path.join(kat, `${baza}_${k.propozycja ?? 'wycinek'}_${k.uklad}_${k.id.slice(2)}.mp4`);
            await fs.copyFile(path.join(praca, 'klip.mp4'), cel);
            const wynik = await cfg.opisz(cel).catch(() => null);
            if (wynik?.szerokosc && (wynik.szerokosc !== SZER || wynik.wysokosc !== WYS)) throw new Error(`ffmpeg oddał ${wynik.szerokosc}×${wynik.wysokosc} zamiast ${SZER}×${WYS}.`);
            Object.assign(k, { stan: 'gotowy', plik: cel, sekundy: wynik?.sekundy ?? Math.round(dlugosc * 10) / 10, cele: celeKlipu(wynik?.sekundy ?? dlugosc), powod: null, gotowy: czas() });
            nadaj(`klip pionowy gotowy: ${path.basename(cel)}`);
        } catch (e) {
            Object.assign(k, { stan: 'blad', powod: e.message });
        } finally {
            await fs.rm(praca, { recursive: true, force: true }).catch(() => {});
            wRobocie.delete(k.id);
            await zapisz();
        }
    }
    function wKolejke(k) {
        wRobocie.add(k.id);
        kolejka = kolejka.then(async () => { k.stan = 'robi'; await zapisz(); await przerob(k); }).catch(() => {});
    }

    /**
     * Nowy klip. { plik, od, do, uklad, kadrX, napisy: zachowane|z-kwestii, napisyLista?, tytul?, propozycja? }
     * `propozycja` (id z `propozycje`) wypełnia od/do/napisy/tytuł z odcinka — jawne pola wygrywają.
     */
    async function utworz(z = {}) {
        const { abs, projekt } = zrodloMontazu(z.plik);
        let p = null;
        if (z.propozycja) {
            p = (await propozycje(abs)).propozycje.find((x) => x.id === z.propozycja);
            if (!p) throw new Error('Nie ma takiej propozycji dla tego odcinka.');
        }
        const od = Number(z.od ?? p?.od ?? 0), dok = Number(z.do ?? p?.do);
        if (!Number.isFinite(od) || !Number.isFinite(dok) || od < 0 || dok <= od) throw new Error('Podaj wycinek: od < do (sekundy).');
        if (dok - od > MAX_KLIPU) throw new Error(`Klip najwyżej ${MAX_KLIPU} s (TikTok/Reels/Shorts to krótkie formy) — skróć wycinek.`);
        const uklad = z.uklad ?? 'rozmyte';
        if (!UKLADY[uklad]) throw new Error('Układ: rozmyte, letterbox albo srodek.');
        const napisy = z.napisy ?? 'zachowane';
        if (!NAPISY[napisy]) throw new Error('Napisy: zachowane albo z-kwestii.');
        let napisyLista = Array.isArray(z.napisyLista) ? z.napisyLista : (p?.napisy ?? []);
        napisyLista = napisyLista.map((n) => ({ od: Number(n.od), do: Number(n.do), tekst: String(n.tekst ?? '').slice(0, 400) })).filter((n) => Number.isFinite(n.od) && Number.isFinite(n.do) && n.tekst.trim()).slice(0, 60);
        if (napisy === 'z-kwestii' && !napisyLista.length) throw new Error('Ten odcinek nie ma kwestii z czasem — napisy „z kwestii” tylko przy Golu Dnia z segmentów (albo podaj napisyLista).');
        const k = {
            id: `f-${crypto.randomBytes(4).toString('hex')}`, projekt, zrodlo: abs, nazwaZrodla: path.basename(abs), program: programZPliku(abs), jezyk: jezykZPliku(abs),
            propozycja: p?.id ?? null, nazwa: String(z.nazwa ?? p?.nazwa ?? `${Math.round(od)}–${Math.round(dok)} s`).slice(0, 120),
            od, do: dok, uklad, kadrX: Math.min(1, Math.max(0, Number(z.kadrX ?? 0.5) || 0)), napisy, napisyLista, tytul: czystyNapis(z.tytul ?? p?.tytul ?? '').slice(0, 80),
            stan: 'w_kolejce', plik: null, sekundy: null, cele: null, publikacje: {}, utworzono: czas(), ...(z.autopilot ? { autopilot: true } : {}),
        };
        (await wczytaj()).unshift(k);
        await zapisz();
        wKolejke(k);
        return k;
    }

    async function ponow(id) {
        const k = await znajdz(id);
        if (['w_kolejce', 'robi'].includes(k.stan)) throw new Error('Ten klip właśnie się przerabia.');
        zrodloMontazu(k.zrodlo);
        Object.assign(k, { stan: 'w_kolejce', powod: null });
        await zapisz();
        wKolejke(k);
        return k;
    }

    /** Usuwa klip z listy i jego plik z katalogu formatów (tylko ten, który zrobił dział). */
    async function usun(id) {
        const k = await znajdz(id);
        if (['w_kolejce', 'robi'].includes(k.stan)) throw new Error('Ten klip właśnie się przerabia.');
        if (Object.values(k.publikacje ?? {}).some((p) => p.etap === 'wysylanie')) throw new Error('Klip właśnie idzie do sieci.');
        if (k.plik && path.basename(path.dirname(k.plik)) === 'formaty') await fs.rm(k.plik, { force: true }).catch(() => {});
        lista = (await wczytaj()).filter((x) => x.id !== id);
        await zapisz();
        return true;
    }

    // ── 📤 Publikacje ─────────────────────────────────────────────────────

    async function kontekstKlipu(k) {
        const linie = [`Krótki pionowy klip (YouTube Shorts / TikTok / Reels, ${Math.round(k.sekundy ?? 0)} s) z odcinka: ${k.nazwaZrodla}`, `Fragment: ${k.nazwa}`];
        if (k.tytul) linie.push(`Napis na klipie: ${k.tytul}`);
        if (k.napisyLista?.length) linie.push(`Kwestie w klipie:\n${k.napisyLista.map((n) => `- ${n.tekst}`).join('\n')}`);
        if (k.program.id === 'gol-dnia' || k.program.id === 'studio-zebrra') {
            const s = await odcinekGolDnia(k.zrodlo);
            if (s) linie.push(kontekstKronikarza(s, { studio: k.program.id === 'studio-zebrra' }));
        }
        return linie.join('\n').slice(0, 6000);
    }

    /** Stan konta sieci (tiktok / instagram) — bez połączenia = błąd z powodem z KontaSieci. */
    async function wymagajKonta(siec) {
        const konto = cfg[siec];
        if (!konto) throw new Error(`${siec}: niepodłączone — most nie ma modułu kont.`);
        const s = await konto.stan();
        if (!s.polaczony) throw new Error(`${siec === 'tiktok' ? 'TikTok' : 'Instagram'} ${s.powod ?? 'niepodłączony'}.`);
        return s;
    }

    /**
     * Klip → publikacja do ✓. youtube: PublikacjeYouTube (Kronikarz, Izba); tiktok/instagram: Kronikarz pisze opis tutaj.
     * `auto` = 🤖 autopilot formatów (Suweren 2026-10-16: „wysyła automatycznie” — dla sieci, które włączył): po opisie
     * Kronikarza wysyłka idzie od razu, bez ręcznego ✓. Bez opisu Kronikarza autopilot NIE wysyła (czeka na ✓ jak zwykle).
     */
    async function doPublikacji(id, siec, { kontoId = null, kanalId = null, auto = false } = {}) {
        const k = await znajdz(id);
        if (k.stan !== 'gotowy' || !k.plik || !fsSync.existsSync(k.plik)) throw new Error('Najpierw gotowy klip (przerobienie).');
        const cel = SIECI_PUBLIKACJI[siec];
        if (!cel) throw new Error('Sieć: youtube, tiktok albo instagram.');
        const c = celeKlipu(k.sekundy)[cel];
        if (!c.ok) throw new Error(`${CELE[cel].nazwa}: ${c.powod}.`);
        const stara = k.publikacje?.[siec];
        if (stara && !['odrzucona', 'blad'].includes(stara.etap) && !(auto && stara.auto && stara.etap === 'do_akceptacji')) throw new Error('Ten klip już czeka (albo poszedł) do tej sieci.');
        if (siec === 'youtube') {
            if (!cfg.youtube) throw new Error('Publikacje YouTube niedostępne.');
            let p = await cfg.youtube.przygotuj({ plik: k.plik, nazwa: `${k.nazwa} — Short`, jezyk: k.jezyk, kontekst: `${await kontekstKlipu(k)}\nTo YouTube Short: tytuł krótki, opis 1–2 zdania.`, zrodlo: { projekt: k.projekt, format: 'shorts', klip: k.id }, kanalId });
            if (p.etap === 'do_akceptacji' && !/#shorts/i.test(`${p.tytul} ${p.opis}`)) p = await cfg.youtube.zmien(p.id, { opis: `${p.opis}\n\n#Shorts` });
            if (auto && p.etap === 'do_akceptacji') p = await cfg.youtube.zatwierdz(p.id);
            k.publikacje = { ...k.publikacje, youtube: { etap: p.etap, publikacjaId: p.id, tytul: p.tytul ?? null, kanalNazwa: p.kanalNazwa ?? null, blad: p.blad ?? null, auto: auto || undefined } };
            await zapisz();
            if (auto && p.etap === 'blad') throw new Error(`Short: ${p.blad ?? 'Kronikarz nie przygotował opisu'}`);
            return k;
        }
        const st = await wymagajKonta(siec);
        const konto = st.konta.find((x) => x.id === kontoId) ?? st.konta.find((x) => x.id === st.domyslny) ?? st.konta[0];
        const p = { etap: 'przygotowuje', kontoId: konto.id, kontoNazwa: konto.nazwa, utworzono: czas(), opis: '', ...(auto ? { auto: true } : {}) };
        k.publikacje = { ...k.publikacje, [siec]: p };
        await zapisz();
        try {
            if (!cfg.pisz) throw new Error('Brak Kronikarza — wpisz opis ręcznie.');
            const { tekst, silnik } = await cfg.pisz(systemKronikarza(k.jezyk), `Klip na ${siec === 'tiktok' ? 'TikTok' : 'Instagram Reels'} (krótki opis, hashtagi jako TAGI).\n${await kontekstKlipu(k)}`);
            const m = odczytajMetadane(tekst);
            const tagi = m.tagi.map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, '')}`).filter((t) => t.length > 1).slice(0, 8);
            Object.assign(p, { opis: `${m.tytul}\n\n${m.opis.split('\n\n')[0]}\n\n${tagi.join(' ')}`.slice(0, 2200), model: silnik ?? null, etap: 'do_akceptacji' });
        } catch (e) {
            Object.assign(p, { etap: 'do_akceptacji', opis: k.tytul || k.nazwa, uwaga: `Kronikarz: ${e.message} — popraw opis ręcznie.` });
            if (auto) { await zapisz(); throw new Error(`Kronikarz nie napisał opisu (${e.message}) — autopilot nie wysyła bez opisu; czeka na Twoje ✓.`); }
        }
        await zapisz();
        if (auto) return zatwierdz(id, siec, { czekaj: true });
        return k;
    }

    async function zmienPublikacje(id, siec, { opis, kontoId } = {}) {
        const k = await znajdz(id);
        const p = k.publikacje?.[siec];
        if (!p || siec === 'youtube') throw new Error(siec === 'youtube' ? 'Short na YouTube poprawiasz w Izbie / publikacjach YouTube.' : 'Ten klip nie czeka na tę sieć.');
        if (!['do_akceptacji', 'blad'].includes(p.etap)) throw new Error('Ta publikacja już poszła albo została odrzucona.');
        if (typeof opis === 'string') p.opis = opis.slice(0, 2200);
        if (kontoId) {
            const st = await wymagajKonta(siec);
            const konto = st.konta.find((x) => x.id === kontoId);
            if (!konto) throw new Error('To konto nie jest połączone z Katedrą.');
            Object.assign(p, { kontoId: konto.id, kontoNazwa: konto.nazwa });
        }
        if (p.etap === 'blad') Object.assign(p, { etap: 'do_akceptacji', blad: null });
        await zapisz();
        return k;
    }

    async function odrzucPublikacje(id, siec) {
        const k = await znajdz(id);
        const p = k.publikacje?.[siec];
        if (!p || siec === 'youtube') throw new Error(siec === 'youtube' ? 'Short na YouTube odrzucasz w publikacjach YouTube.' : 'Ten klip nie czeka na tę sieć.');
        if (!['do_akceptacji', 'blad', 'przygotowuje'].includes(p.etap)) throw new Error('Tej publikacji nie da się już odrzucić.');
        Object.assign(p, { etap: 'odrzucona', odrzucono: czas() });
        await zapisz();
        return k;
    }

    /** ✓ Suwerena → wysyłka. TikTok: szkic do skrzynki; Instagram: Reel publiczny (w tle — przetwarzanie trwa minuty). */
    async function zatwierdz(id, siec, { czekaj = false } = {}) {
        const k = await znajdz(id);
        const p = k.publikacje?.[siec];
        if (!p || siec === 'youtube') throw new Error(siec === 'youtube' ? 'Short na YouTube zatwierdzasz w Izbie (publikacje YouTube).' : 'Ten klip nie czeka na tę sieć.');
        if (p.etap !== 'do_akceptacji') throw new Error('Ta publikacja nie czeka na ✓.');
        if (!k.plik || !fsSync.existsSync(k.plik)) throw new Error('Nie ma już pliku klipu.');
        await wymagajKonta(siec);
        Object.assign(p, { etap: 'wysylanie', zatwierdzono: czas(), blad: null });
        await zapisz();
        const klucz = `${k.id}:${siec}`;
        wRobocie.add(klucz);
        const praca = (async () => {
            try {
                if (siec === 'tiktok') {
                    const w = await cfg.tiktok.wyslijSzkic(k.plik, p.kontoId);
                    Object.assign(p, { publishId: w.publishId, etap: 'wysylanie', uwaga: 'TikTok przetwarza — potem szkic w skrzynce aplikacji (opis wklej z pola obok).' });
                    nadaj(`klip „${k.nazwa}” poszedł do skrzynki TikTok (${p.kontoNazwa})`);
                } else {
                    const w = await cfg.instagram.opublikujReel(k.plik, { opis: p.opis, kontoId: p.kontoId, postep: (e) => { p.postep = e; } });
                    Object.assign(p, { etap: 'opublikowana', mediaId: w.mediaId, url: w.url, postep: null, opublikowano: czas() });
                    nadaj(`Reel „${k.nazwa}” jest na Instagramie (${p.kontoNazwa})${w.url ? `: ${w.url}` : ''}`);
                }
            } catch (e) { Object.assign(p, { etap: 'blad', blad: e.message, postep: null }); }
            finally { wRobocie.delete(klucz); await zapisz(); }
        })();
        if (siec === 'tiktok' || czekaj) await praca;   // szkic TikTok to sekundy — wynik od razu; autopilot czeka też na Instagram
        if (czekaj && p.etap === 'blad') throw new Error(`${siec === 'tiktok' ? 'TikTok' : 'Instagram'}: ${p.blad}`);
        return k;
    }

    /** Postęp: stan Shortów z PublikacjeYouTube, szkiców TikTok z API. Woła odczyt listy. */
    async function sprawdz() {
        const l = await wczytaj();
        let zmiana = false;
        const yt = cfg.youtube && l.some((k) => k.publikacje?.youtube) ? await cfg.youtube.wszystkie().catch(() => []) : [];
        for (const k of l) {
            const y = k.publikacje?.youtube;
            if (y?.publikacjaId) {
                const p = yt.find((x) => x.id === y.publikacjaId);
                const nowy = p ? { etap: p.etap, publikacjaId: p.id, tytul: p.tytul ?? null, kanalNazwa: p.kanalNazwa ?? null, url: p.url ?? null, blad: p.blad ?? null } : { ...y, etap: 'blad', blad: 'Publikacji YouTube już nie ma.' };
                if (JSON.stringify(nowy) !== JSON.stringify(y)) { k.publikacje.youtube = nowy; zmiana = true; }
            }
            const t = k.publikacje?.tiktok;
            if (t?.publishId && ['wysylanie', 'w_skrzynce'].includes(t.etap) && cfg.tiktok && !wRobocie.has(`${k.id}:tiktok`)) {
                try {
                    const s = await cfg.tiktok.stanWysylki(t.publishId, t.kontoId);
                    const etap = s.status === 'FAILED' ? 'blad' : s.status === 'PUBLISH_COMPLETE' ? 'opublikowana' : s.status === 'SEND_TO_USER_INBOX' ? 'w_skrzynce' : t.etap;
                    if (etap !== t.etap) { Object.assign(t, { etap, blad: etap === 'blad' ? `TikTok: ${s.powod ?? 'wysyłka nieudana'}` : null, uwaga: etap === 'w_skrzynce' ? 'Szkic w skrzynce aplikacji TikTok — otwórz powiadomienie, wklej opis, ustaw prywatność, opublikuj.' : t.uwaga }); zmiana = true; }
                } catch (e) { t.uwaga = `Nie sprawdziłem stanu: ${e.message}`; }
            }
        }
        if (zmiana) await zapisz();
        return l;
    }

    async function wszystkie() { return [...(await sprawdz())]; }
    const sciezkaKlipu = async (id) => { const k = await znajdz(id); return k.plik && fsSync.existsSync(k.plik) ? k.plik : null; };

    /** Klip po przerobieniu (czeka na kolejkę ffmpeg) — dla autopilota. */
    async function gotowy(id) { await kolejka; return znajdz(id); }

    return { zrodla, propozycje, utworz, ponow, usun, wszystkie, sprawdz, doPublikacji, zmienPublikacje, odrzucPublikacje, zatwierdz, sciezkaKlipu, zrodloMontazu, gotowy, czekaj: () => kolejka };
}

/**
 * Trasy działu (Straż: `/api/formaty`, `/api/impresario/tiktok/`, `/api/impresario/instagram/` — tylko maszyna; powroty OAuth
 * wpuszcza `czyZwrotYouTube`). Montowane z mostu, testowalne na Expressie.
 */
export function zamontujTrasyFormatow(app, F, { tiktok = null, instagram = null, youtubeStan = null, szyna = null, autopilot = null } = {}) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    const strona = (res, siec, kolor, tekst) => res.type('html').send(`<meta charset="utf-8"><title>${siec} · Katedra</title><body style="font-family:sans-serif;background:#0b1020;color:${kolor};padding:2rem;font-size:18px">${String(tekst).replace(/</g, '&lt;')}<p style="color:#64748b;font-size:14px">Możesz zamknąć to okno i wrócić do Katedry.</p></body>`);

    app.get('/api/formaty', (_req, res) => odp(res, (async () => ({ klipy: await F.wszystkie(), cele: CELE, uklady: UKLADY, napisy: NAPISY, maxKlipu: MAX_KLIPU }))()));
    app.get('/api/formaty/zrodla', (_req, res) => odp(res, F.zrodla().then((zrodla) => ({ zrodla })), 500));
    app.get('/api/formaty/propozycje', (req, res) => odp(res, F.propozycje(String(req.query.plik ?? ''))));
    /** Podgląd odcinka źródłowego (tylko z katalogu montaży) — do wyboru od–do w panelu. */
    app.get('/api/formaty/zrodlo', (req, res) => { try { return res.sendFile(F.zrodloMontazu(String(req.query.plik ?? '')).abs); } catch (e) { return res.status(404).json({ success: false, message: e.message }); } });
    app.get('/api/formaty/sieci', (_req, res) => odp(res, (async () => {
        const bezpiecznie = async (f, siec) => { try { return f ? await f() : { siec, polaczony: false, powod: 'niepodłączone: most nie ma modułu kont' }; } catch (e) { return { siec, polaczony: false, powod: e.message }; } };
        return { youtube: await bezpiecznie(youtubeStan, 'youtube'), tiktok: await bezpiecznie(tiktok?.stan, 'tiktok'), instagram: await bezpiecznie(instagram?.stan, 'instagram') };
    })(), 500));
    if (autopilot) {
        // 🤖 autopilot formatów (services/AutopilotFormatow.js) — przełączniki, limity, „▶ przerób zaległe teraz”, ↻ porzucony
        app.get('/api/formaty/autopilot', (_req, res) => odp(res, autopilot.stan().then((stan) => ({ autopilot: stan })), 500));
        app.put('/api/formaty/autopilot', (req, res) => odp(res, autopilot.ustaw(req.body ?? {}).then((stan) => ({ autopilot: stan }))));
        app.post('/api/formaty/autopilot/teraz', (_req, res) => odp(res, (async () => {
            const st = await autopilot.stan();
            if (!Object.values(st.cele).some((c) => c.wlaczony)) throw new Error('Autopilot ma wyłączone wszystkie sieci — włącz Shorts, Reels albo TikTok.');
            void autopilot.przebieg({ reczny: true }).catch(() => {});   // trwa minuty (ffmpeg, wysyłki) — wynik w stanie
            return { ruszyl: true };
        })()));
        app.post('/api/formaty/autopilot/ponow', (req, res) => odp(res, autopilot.ponow(String(req.body?.plik ?? ''), String(req.body?.cel ?? '')).then((stan) => ({ autopilot: stan }))));
    }
    app.post('/api/formaty', (req, res) => odp(res, F.utworz(req.body ?? {}).then((klip) => ({ klip }))));
    app.get('/api/formaty/:id/plik', async (req, res) => { try { const p = await F.sciezkaKlipu(req.params.id); return p ? res.sendFile(p) : res.status(404).end(); } catch { return res.status(404).end(); } });
    app.post('/api/formaty/:id/ponow', (req, res) => odp(res, F.ponow(req.params.id).then((klip) => ({ klip }))));
    app.delete('/api/formaty/:id', (req, res) => odp(res, F.usun(req.params.id).then((usuniety) => ({ usuniety }))));
    /** { siec: youtube|tiktok|instagram, kontoId?, kanalId? } → publikacja do ✓ */
    app.post('/api/formaty/:id/publikuj', (req, res) => odp(res, F.doPublikacji(req.params.id, String(req.body?.siec ?? ''), { kontoId: req.body?.kontoId || null, kanalId: req.body?.kanalId || null }).then((klip) => ({ klip }))));
    app.post('/api/formaty/:id/publikacja/:siec/zmien', (req, res) => odp(res, F.zmienPublikacje(req.params.id, req.params.siec, req.body ?? {}).then((klip) => ({ klip }))));
    app.post('/api/formaty/:id/publikacja/:siec/zatwierdz', (req, res) => odp(res, F.zatwierdz(req.params.id, req.params.siec).then((klip) => ({ klip }))));
    app.post('/api/formaty/:id/publikacja/:siec/odrzuc', (req, res) => odp(res, F.odrzucPublikacje(req.params.id, req.params.siec).then((klip) => ({ klip }))));

    // ── Konta TikTok i Instagram (OAuth z pętlą zwrotną na moście) ──
    for (const [siec, K, nazwa] of [['tiktok', tiktok, 'TikTok'], ['instagram', instagram, 'Instagram']]) {
        if (!K) continue;
        app.get(`/api/impresario/${siec}/stan`, (_req, res) => odp(res, K.stan(), 500));
        app.post(`/api/impresario/${siec}/klient`, (req, res) => odp(res, K.zapiszKlienta(req.body ?? {}).then((stan) => ({ stan }))));
        app.get(`/api/impresario/${siec}/polacz`, async (_req, res) => {
            try { return res.redirect(302, await K.adresZgody()); } catch (e) { return strona(res, nazwa, '#fca5a5', `📱 ${e.message}`); }
        });
        app.get(SCIEZKI_ZWROTU[siec], async (req, res) => {
            try {
                const w = await K.przyjmijZwrot(req.query ?? {});
                const ile = w.konta?.map((x) => x.nazwa).join(', ') ?? w.konto?.nazwa ?? '';
                await szyna?.nadaj?.({ agent: 'Impresario', rodzaj: 'praca', tresc: `📱 ${nazwa} połączony${ile ? `: ${ile}` : ''}` })?.catch?.(() => {});
                return strona(res, nazwa, '#86efac', `✓ ${nazwa} połączony${ile ? `: ${ile}` : ''}.`);
            } catch (e) { return strona(res, nazwa, '#fca5a5', `⚠ ${e.message}`); }
        });
        app.post(`/api/impresario/${siec}/domyslne`, (req, res) => odp(res, K.ustawDomyslne(String(req.body?.kontoId ?? '')).then((konta) => ({ konta }))));
        app.post(`/api/impresario/${siec}/rozlacz`, (req, res) => odp(res, K.rozlacz(typeof req.body?.kontoId === 'string' ? req.body.kontoId : null).then((konta) => ({ konta }))));
    }
}

export default { utworzFormaty, zamontujTrasyFormatow, argumentyKlipu, filtrUkladu, propozycjeGolDnia, programZPliku, celeKlipu, CELE, UKLADY, NAPISY };
