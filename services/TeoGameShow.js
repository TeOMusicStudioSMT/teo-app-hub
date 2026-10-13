/**
 * 🎪 TeO Game Show (Suweren 2026-10-13: „po wykonaniu nagrania automatyczne zlecenie filmu przedstawiającego postać…
 * potem sklejane i dodawane 2 klocki: jeden mówiący, jaka konkurencja z Teterhii, drugi kończący — wynik, punktacja,
 * obraz TeOgochi po, mały wywiad w stworka języku… całość dostaje piękny opis TeO Game Show… trafia do Impresario…”).
 *
 * Łańcuch jednego odcinka (każdy etap ma stan i powód — nic nie udaje):
 *   1. INTRO — film postaci: Wan 2.2 w ComfyUI z obrazem tancerza jako pierwszą klatką (kolejka GPU, jedno naraz).
 *      Nie wyszło (ComfyUI śpi, brak modelu…) = odcinek STAJE z powodem: „↻ Ponów” albo „bez intro”.
 *   2. KONKURENCJA — plansza ffmpeg: która konkurencja Teterhii (Taniec Dnia / Tygodnia… z okresów turnieju),
 *      tancerz, utwór, BPM; zapowiedź głosem prowadzącego (Kronikarz z obsady Aktorów).
 *   3. WYSTĘP — nagranie z Tanecznego Starcia (bez zmian).
 *   4. FINAŁ — wynik i punktacja (ocena liczona przez most: takt / energia / różnorodność), obraz TeOgochi PO =
 *      ostatnia klatka nagrania; krótki wywiad: prowadzący pyta po polsku, stworek odpowiada po stworkowemu
 *      (model gatunku `aktor` w roli), napisy po polsku. Model nie trzymał formatu = finał bez wywiadu + uwaga.
 *      Głos padł = segment z napisami i ciszą + uwaga (widać ją przed ✓).
 *   5. SKLEJENIE — Spawacz (klocki Start z `Klocki do TeO Game Show` → intro → konkurencja → występ → finał → End),
 *      wyrównanie do rozmiaru występu → `produkcje/teo-game-show/montaz/gameshow_<…>.mp4`.
 *   6. PUBLIKACJA — Kronikarz pisze TYTUŁ / OPIS / TAGI (kontekst TeO Game Show) → `do_akceptacji` na kanale projektu
 *      `teo-game-show` (dedykowany kanał — wybór w Impresariacie). Wysyłka DOPIERO po ✓ Suwerena.
 *
 * `_OtakOs_Wymiar/game-show/<s-xxxxxxxx>/show.json` (+ `praca/` na czas składania).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { CZCIONKI, zawin } from './PowitanieDnia.js';
import { argumentyKwestii, czasBezGlosu } from './WywiadAktorow.js';

export const PROJEKT = 'teo-game-show';
export const NAZWA = 'TeO Game Show';
export const ETAPY = ['intro', 'konkurencja', 'final', 'sklejanie', 'publikacja'];
export const SEKUNDY_INTRO = 4;
const ID = /^s-[0-9a-f]{8}$/;
const KOLOR = '#f59e0b';

const procent = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
export const rangaOceny = (w) => (w >= 90 ? 'S' : w >= 75 ? 'A' : w >= 60 ? 'B' : w >= 40 ? 'C' : 'D');

/** Prompt Wan (po angielsku — Wan rozumie go najlepiej): postać z obrazu wchodzi na scenę teleturnieju. Czysta. */
export function promptIntro({ imie }) {
    const kto = String(imie || 'TeOgochi').replace(/[^\p{L}\p{N} '-]/gu, '').slice(0, 40);
    return `${kto}, a small cute TeOgochi creature from the magical island of Teterhia, steps onto a glowing game show dance stage, `
        + 'spotlights sweep across, colorful confetti falls, the creature waves happily to the audience and strikes a dance pose, '
        + 'warm stage lights, cinematic, smooth slow camera push-in, same character as in the first frame, high detail';
}

/** Która konkurencja Teterhii: najważniejszy otwarty okres turnieju (Mistrzostwa > Rok > … > Dzień — w kolejności listy). */
export function konkurencja(okresy = []) {
    const l = Array.isArray(okresy) ? okresy : [];
    const ms = l.find((o) => o.okres === 'mistrzostwa');
    const dzien = l.find((o) => o.okres === 'dzien');
    const glowna = ms ?? dzien ?? l[0] ?? null;
    return { nazwa: glowna ? glowna.nazwa : 'Taneczne Starcie', klucz: glowna?.klucz ?? null, wszystkie: l.map((o) => o.nazwa) };
}

/** Tekst zapowiedzi prowadzącego (czytany głosem, na planszy w skrócie). Czysta. */
export function zapowiedz({ tancerz, utwor, bpm, konk }) {
    return `Witajcie w TeO Game Show! Konkurencja z Teterhii: Taneczne Starcie — ${konk.nazwa}. `
        + `Na parkiet wchodzi ${tancerz} i tańczy do utworu „${utwor}”${bpm ? `, ${bpm} uderzeń na minutę` : ''}. Muzyka!`;
}

/** Tekst ogłoszenia wyniku. Czysta. */
export function ogloszenieWyniku({ tancerz, ocena }) {
    const w = Math.round(Number(ocena?.wynik) || 0);
    return `${tancerz} zdobywa ${w} punktów na sto — ranga ${rangaOceny(w)}! `
        + `Takt ${procent(ocena?.takt)}, energia ${procent(ocena?.energia)}, różnorodność ${procent(ocena?.roznorodnosc)}.`;
}

/** Prośba do Aktora: krótki wywiad po występie — prowadzący po polsku, stworek po stworkowemu z tłumaczeniem. */
export function promptWywiaduStworka({ tancerz, opis = '', utwor, ocena }) {
    const system = [
        `Jesteś TeOgochi Aktor. Grasz stworka „${tancerz}” z wyspy Teterhia, który właśnie skończył taniec w programie TeO Game Show.`,
        opis ? `Wygląd i charakter stworka: ${String(opis).slice(0, 400)}` : '',
        'Stworek mówi WŁASNYM językiem stworków: krótkie, melodyjne, wymyślone sylaby (np. „mru-tii pa-lo, nunu!”), bez prawdziwych słów polskich ani angielskich.',
        'Pod każdą odpowiedzią dajesz wierne tłumaczenie na polski. Ciepło, z humorem, 1–2 zdania na kwestię. Nie zmyślaj liczb — wynik jest podany.',
        'Odpowiedz DOKŁADNIE w tym formacie, 2 lub 3 razy, bez niczego przed i po:',
        'PYTANIE: <pytanie prowadzącego po polsku>',
        'STWOREK: <odpowiedź po stworkowemu>',
        'PO POLSKU: <tłumaczenie odpowiedzi>',
    ].filter(Boolean).join('\n');
    const user = `Tancerz: ${tancerz}\nUtwór: ${utwor}\nWynik: ${ocena?.wynik ?? '?'}/100 (ranga ${rangaOceny(ocena?.wynik ?? 0)}), takt ${procent(ocena?.takt)}, energia ${procent(ocena?.energia)}, różnorodność ${procent(ocena?.roznorodnosc)}.\nNapisz wywiad.`;
    return { system, user };
}

/** Odpowiedź modelu → [{ pytanie, stworek, polski }] (1–3); rzuca, gdy format nie trzymał. Czysta. */
export function odczytajWywiadStworka(tekst) {
    const t = String(tekst ?? '').replace(/\r/g, '').replace(/<think>[\s\S]*?<\/think>/g, '');
    const out = [];
    const re = /PYTANIE:\s*(.+)\n+\s*STWOREK:\s*(.+)\n+\s*PO POLSKU:\s*(.+)/gi;
    let m;
    while ((m = re.exec(t)) && out.length < 3) {
        const [pytanie, stworek, polski] = [m[1], m[2], m[3]].map((x) => x.replace(/\*+/g, '').trim().slice(0, 300));
        if (pytanie && stworek && polski) out.push({ pytanie, stworek, polski });
    }
    if (!out.length) throw new Error('Aktor nie trzymał formatu wywiadu (PYTANIE / STWOREK / PO POLSKU).');
    return out;
}

/** Kontekst dla Kronikarza — tylko fakty z odcinka. Czysta. */
export function kontekstKronikarza(s) {
    return [
        `To odcinek programu „${NAZWA}” Katedry OtakOS — teleturnieju, w którym TeOgochi z wyspy Teterhia rywalizują w konkurencjach gry.`,
        'Tytuł zaczynaj od „TeO Game Show:”. W opisie: konkurencja, tancerz, utwór, wynik i jedna linia z wywiadu (tłumaczenie).',
        `Konkurencja: Taneczne Starcie — ${s.konkurencja?.nazwa ?? '?'}${s.konkurencja?.wszystkie?.length ? ` (otwarte turnieje: ${s.konkurencja.wszystkie.join(', ')})` : ''}`,
        `Tancerz: ${s.tancerz?.imie ?? '?'}${s.tancerz?.opis ? ` — ${String(s.tancerz.opis).slice(0, 300)}` : ''}`,
        `Utwór: ${s.utwor?.tytul ?? '?'}${s.utwor?.bpm ? ` (${s.utwor.bpm} BPM)` : ''}`,
        `Wynik: ${s.ocena?.wynik ?? '?'}/100, ranga ${rangaOceny(s.ocena?.wynik ?? 0)}; takt ${procent(s.ocena?.takt)}, energia ${procent(s.ocena?.energia)}, różnorodność ${procent(s.ocena?.roznorodnosc)}`,
        ...(s.wywiad?.length ? ['Wywiad (tłumaczenie z języka stworków):', ...s.wywiad.map((w) => `- ${w.pytanie} → ${w.polski}`)] : []),
    ].join('\n');
}

const nowyEtap = () => Object.fromEntries(ETAPY.map((e) => [e, { stan: 'czeka' }]));

/**
 * @param {{ katalog:string, katalogMontazy:(projekt:string)=>Promise<string>, choreografie:{ wczytaj:Function },
 *   katalogNagran:()=>Promise<string>, tancerz:(mini:{id:string,nazwa:string})=>Promise<{imie:string, opis?:string, obraz?:string|null}>,
 *   intro?:(o:{prompt:string, obraz:string|null, sekundy:number})=>Promise<string>,
 *   chat?:(model:string|null, system:string, user:string)=>Promise<{tekst:string, silnik?:string}>, modelDla?:(id:string)=>Promise<string|null>,
 *   mow?:(o:{tekst:string, kto:'prowadzacy'|'stworek', jezyk:string})=>Promise<{audio:Buffer, ext:string}>,
 *   opisz:(p:string)=>Promise<{sekundy:number|null}>, spawaj:(o:{klipy:string[], wyjscie:string, celWedlug:number})=>Promise<any>,
 *   klocki?:()=>Promise<{start:string[], end:string[]}>, okresy?:()=>any[], publikuj?:(z:object)=>Promise<any>,
 *   ffmpeg?:string, szyna?:any, teraz?:()=>number }} o
 */
export function utworzGameShow(o) {
    const cfg = { ffmpeg: 'ffmpeg', teraz: () => Date.now(), modelDla: async () => null, okresy: () => [], klocki: async () => ({ start: [], end: [] }), ...o };
    const KAT = path.join(cfg.katalog, 'game-show');
    const plikS = (id) => { if (!ID.test(String(id))) throw new Error('Złe id odcinka TeO Game Show.'); return path.join(KAT, id, 'show.json'); };
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Kronikarz', rodzaj: 'praca', tresc: `🎪 ${tresc}` })?.catch?.(() => {});
    const wRobocie = new Set();
    let kolejka = Promise.resolve();   // jeden odcinek naraz (GPU i ffmpeg)

    const czytaj = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
    const pisz = async (s) => {
        const p = plikS(s.id);
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(`${p}.tmp`, JSON.stringify(s, null, 1), 'utf8');
        await fs.rename(`${p}.tmp`, p);
    };
    /** Odczyt z sprzątaniem ducha: „robi” bez pracy w pamięci = przerwane restartem mostu. */
    async function wczytaj(id) {
        let s;
        try { s = await czytaj(plikS(id)); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiego odcinka TeO Game Show.'); throw e; }
        if ((s.stan === 'robi' || s.stan === 'w_kolejce') && !wRobocie.has(id)) {
            for (const e of ETAPY) if (s.etapy[e]?.stan === 'robi') s.etapy[e] = { ...s.etapy[e], stan: 'blad', powod: 'Przerwane — most był restartowany. „↻ Ponów” liczy od tego etapu.' };
            Object.assign(s, { stan: 'blad', powod: 'Przerwane restartem mostu.' });
            await pisz(s).catch(() => {});
        }
        return s;
    }
    async function lista() {
        const kat = await fs.readdir(KAT).catch(() => []);
        const out = [];
        for (const k of kat) if (ID.test(k)) { try { out.push(await wczytaj(k)); } catch { /* uszkodzony pomijamy */ } }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    async function ffmpeg(args, cwd) {
        await new Promise((ok, zle) => execFile(cfg.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { cwd, windowsHide: true, timeout: 15 * 60_000, maxBuffer: 16 * 1024 * 1024 },
            (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-3).join(' | ').slice(0, 400)}`)) : ok())));
    }

    /**
     * Nowy odcinek z nagrania występu. Startuje łańcuch w tle (kolejka: jeden odcinek naraz).
     * @param {string} choreografiaId  @param {string} nagranie nazwa pliku nagrania (z choreografii)
     */
    async function utworz(choreografiaId, nagranie, { bezIntro = false, kanalId = null } = {}) {
        const c = await cfg.choreografie.wczytaj(choreografiaId);
        const nazwa = String(nagranie ?? c.nagrania?.at(-1)?.nazwa ?? '');
        if (!nazwa || !(c.nagrania ?? []).some((n) => n.nazwa === nazwa)) throw new Error('Ta choreografia nie ma takiego nagrania — najpierw nagraj występ.');
        const plikNagrania = path.join(await cfg.katalogNagran(), path.basename(nazwa));
        if (!fsSync.existsSync(plikNagrania)) throw new Error(`Nie ma pliku nagrania: ${nazwa}`);
        const istniejacy = (await lista()).find((s) => s.nagranie?.nazwa === nazwa && !['blad', 'odrzucony'].includes(s.stan));
        if (istniejacy) return istniejacy;   // drugi klik / drugie wywołanie nie robi drugiego odcinka
        const t = await cfg.tancerz(c.mini).catch(() => null);
        const s = {
            wersja: 1, id: `s-${crypto.randomBytes(4).toString('hex')}`, stan: 'w_kolejce', powod: null,
            choreografia: { id: c.id, nazwa: c.nazwa, odcisk: c.odcisk }, nagranie: { nazwa, plik: plikNagrania },
            tancerz: { id: c.mini?.id ?? null, imie: t?.imie || c.mini?.nazwa || 'TeOgochi', opis: t?.opis ?? '', obraz: t?.obraz ?? null },
            utwor: { tytul: c.utwor?.tytul ?? '', bpm: c.utwor?.bpm ?? null }, ocena: c.ocena,
            konkurencja: konkurencja(cfg.okresy()), etapy: nowyEtap(), uwagi: [], wywiad: null, plik: null, publikacja: null,
            kanalId: kanalId ? String(kanalId) : null, utworzono: czas(),
        };
        if (bezIntro) s.etapy.intro = { stan: 'pominiety', powod: 'bez intro (wybór Suwerena)' };
        await pisz(s);
        zakolejkuj(s.id);
        nadaj(`odcinek „${s.tancerz.imie}” w kolejce TeO Game Show`);
        return s;
    }

    function zakolejkuj(id) {
        wRobocie.add(id);
        kolejka = kolejka.then(() => przebieg(id)).catch(() => {}).finally(() => wRobocie.delete(id));
    }

    /** Łańcuch od pierwszego niegotowego etapu. Błąd etapu zatrzymuje odcinek z powodem. */
    async function przebieg(id) {
        const s = await czytaj(plikS(id));
        Object.assign(s, { stan: 'robi', powod: null });
        await pisz(s);
        const praca = path.join(KAT, id, 'praca');
        await fs.mkdir(praca, { recursive: true });
        const zrob = async (etap, fn) => {
            if (['gotowy', 'pominiety'].includes(s.etapy[etap]?.stan)) return true;
            s.etapy[etap] = { stan: 'robi', od: czas() };
            await pisz(s);
            try {
                s.etapy[etap] = { ...(await fn()), stan: 'gotowy', od: s.etapy[etap].od, do: czas() };
                await pisz(s);
                return true;
            } catch (e) {
                s.etapy[etap] = { stan: 'blad', powod: String(e.message || e).slice(0, 500), od: s.etapy[etap].od, do: czas() };
                Object.assign(s, { stan: 'blad', powod: `${etap}: ${s.etapy[etap].powod}` });
                await pisz(s);
                return false;
            }
        };
        try {
            const czcionka = CZCIONKI.find((p) => fsSync.existsSync(p));
            if (!czcionka) throw new Error('Nie znalazłem czcionki z polskimi znakami (OTAKOS_POWITANIE_CZCIONKA).');
            await fs.copyFile(czcionka, path.join(praca, 'czcionka.ttf'));
            const obrazTancerza = s.tancerz.obraz && fsSync.existsSync(s.tancerz.obraz) ? s.tancerz.obraz : null;
            if (obrazTancerza) await fs.copyFile(obrazTancerza, path.join(praca, 'tancerz.png'));

            /** Jeden segment: kadr (obraz albo barwa) + pas z nagłówkiem + napisy; głos opcjonalny (padł = cisza + uwaga). */
            const segment = async (nr, { obraz, naglowek, linie, mowa = null, kto = 'prowadzacy', czas: czasMin = 3 }) => {
                let audio = null, dl = Math.max(czasMin, czasBezGlosu(mowa ?? linie.join(' ')));
                if (mowa && cfg.mow) {
                    try {
                        // jedno ponowienie: zerwane połączenie z silnikiem głosu („terminated”) bywa chwilowe
                        const g = await cfg.mow({ tekst: mowa, kto, jezyk: 'pl' }).catch(() => cfg.mow({ tekst: mowa, kto, jezyk: 'pl' }));
                        audio = `a-${nr}.${g.ext || 'wav'}`;
                        await fs.writeFile(path.join(praca, audio), g.audio);
                        const sek = (await cfg.opisz(path.join(praca, audio)).catch(() => null))?.sekundy;
                        if (sek) dl = Math.max(czasMin, Math.round((sek + 0.5) * 100) / 100);
                    } catch (e) { s.uwagi = [...new Set([...s.uwagi, `głos (${kto}): ${String(e.message).slice(0, 160)} — segment z napisami, bez głosu`])].slice(0, 12); }
                } else if (mowa) s.uwagi = [...new Set([...s.uwagi, 'Katedra nie ma silnika głosu — napisy bez głosu'])];
                await fs.writeFile(path.join(praca, `n-${nr}.txt`), naglowek, 'utf8');
                const pliki = [];
                for (const [j, l] of linie.entries()) { const n = `l-${nr}-${j}.txt`; await fs.writeFile(path.join(praca, n), l, 'utf8'); pliki.push(n); }
                const wyj = `seg-${nr}.mp4`;
                await ffmpeg(argumentyKwestii({ obraz, klip: null, kolor: KOLOR, imiePlik: `n-${nr}.txt`, liniePliki: pliki, czcionka: 'czcionka.ttf', czas: dl, audio, wyjscie: wyj }), praca);
                return wyj;
            };
            const sklejSegmenty = async (segmenty, wyj) => {
                await fs.writeFile(path.join(praca, `${wyj}.txt`), segmenty.map((x) => `file '${x}'`).join('\n'), 'utf8');
                await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', `${wyj}.txt`, '-c', 'copy', '-movflags', '+faststart', wyj], praca);
                return path.join(praca, wyj);
            };

            // 1. INTRO — film postaci (Wan), obraz tancerza jako pierwsza klatka
            if (!(await zrob('intro', async () => {
                if (!cfg.intro) throw new Error('Ta Katedra nie ma silnika wideo — wybierz „bez intro”.');
                const prompt = promptIntro(s.tancerz);
                const plik = await cfg.intro({ prompt, obraz: obrazTancerza, sekundy: SEKUNDY_INTRO });
                const cel = path.join(praca, `intro${path.extname(plik) || '.mp4'}`);
                await fs.copyFile(plik, cel);
                return { plik: cel, prompt, zObrazu: !!obrazTancerza };
            }))) return;

            // 2. KONKURENCJA — plansza + zapowiedź prowadzącego
            if (!(await zrob('konkurencja', async () => {
                const mowa = zapowiedz({ tancerz: s.tancerz.imie, utwor: s.utwor.tytul, bpm: s.utwor.bpm, konk: s.konkurencja });
                const seg = await segment('k1', {
                    obraz: obrazTancerza ? 'tancerz.png' : null, naglowek: `${NAZWA} · konkurencja z Teterhii`, mowa, czas: 4,
                    linie: [`Taneczne Starcie — ${s.konkurencja.nazwa}`, ...zawin(`${s.tancerz.imie} · „${s.utwor.tytul}”${s.utwor.bpm ? ` · ${s.utwor.bpm} BPM` : ''}`, 62, 2)],
                });
                return { plik: await sklejSegmenty([seg], 'konkurencja.mp4'), zapowiedz: mowa };
            }))) return;

            // 4. FINAŁ — wynik, obraz PO (ostatnia klatka występu), wywiad w języku stworków
            if (!(await zrob('final', async () => {
                let obrazPo = null;
                try {
                    await ffmpeg(['-y', '-sseof', '-0.6', '-i', s.nagranie.plik, '-frames:v', '1', '-update', '1', 'po.png'], praca);
                    if (fsSync.existsSync(path.join(praca, 'po.png'))) obrazPo = 'po.png';
                } catch (e) { s.uwagi.push(`klatka „po”: ${String(e.message).slice(0, 120)} — finał na obrazie tancerza`); }
                const kadr = obrazPo ?? (obrazTancerza ? 'tancerz.png' : null);
                const segmenty = [];
                const o = s.ocena ?? {};
                segmenty.push(await segment('f1', {
                    obraz: kadr, naglowek: `${NAZWA} · wynik`, mowa: ogloszenieWyniku({ tancerz: s.tancerz.imie, ocena: o }), czas: 4,
                    linie: [`${s.tancerz.imie}: ${Math.round(Number(o.wynik) || 0)}/100 · ranga ${rangaOceny(o.wynik ?? 0)}`, `takt ${procent(o.takt)} · energia ${procent(o.energia)} · różnorodność ${procent(o.roznorodnosc)}`, `Taneczne Starcie — ${s.konkurencja.nazwa}`],
                }));
                let wywiad = null;
                if (cfg.chat) {
                    try {
                        const { system, user } = promptWywiaduStworka({ tancerz: s.tancerz.imie, opis: s.tancerz.opis, utwor: s.utwor.tytul, ocena: o });
                        const model = (await cfg.modelDla('aktor').catch(() => null)) ?? (await cfg.modelDla('kronikarz').catch(() => null));
                        const odp = await cfg.chat(model, system, user);
                        wywiad = odczytajWywiadStworka(odp.tekst);
                        s.wywiadModel = odp.silnik ?? model ?? null;
                    } catch (e) { s.uwagi.push(`wywiad: ${String(e.message).slice(0, 200)} — finał bez wywiadu`); }
                } else s.uwagi.push('Katedra nie ma modelu do wywiadu — finał bez wywiadu');
                for (const [i, w] of (wywiad ?? []).entries()) {
                    segmenty.push(await segment(`p${i}`, { obraz: kadr, naglowek: 'Kronikarz pyta', linie: zawin(w.pytanie, 62, 3), mowa: w.pytanie, kto: 'prowadzacy' }));
                    segmenty.push(await segment(`s${i}`, { obraz: kadr, naglowek: `${s.tancerz.imie} (po stworkowemu)`, linie: [...zawin(`„${w.stworek}”`, 62, 1), ...zawin(w.polski, 62, 3)], mowa: w.stworek, kto: 'stworek' }));
                }
                s.wywiad = wywiad;
                return { plik: await sklejSegmenty(segmenty, 'final.mp4'), obrazPo: !!obrazPo, wywiad: wywiad?.length ?? 0 };
            }))) return;

            // 5. SKLEJENIE — klocki Start → intro → konkurencja → występ → finał → End (wyrównanie do występu)
            if (!(await zrob('sklejanie', async () => {
                const k = await cfg.klocki().catch(() => ({ start: [], end: [] }));
                const intro = s.etapy.intro.stan === 'gotowy' && s.etapy.intro.plik && fsSync.existsSync(s.etapy.intro.plik) ? [s.etapy.intro.plik] : [];
                const klipy = [...k.start, ...intro, s.etapy.konkurencja.plik, s.nagranie.plik, s.etapy.final.plik, ...k.end];
                const kat = await cfg.katalogMontazy(PROJEKT);
                const slug = s.tancerz.imie.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'tancerz';
                const wyjscie = path.join(kat, `gameshow_${slug}_${s.id.slice(2)}.mp4`);
                await cfg.spawaj({ klipy, wyjscie, celWedlug: k.start.length + intro.length + 1 });
                const opis = await cfg.opisz(wyjscie).catch(() => null);
                s.plik = wyjscie;
                return { plik: wyjscie, sekundy: opis?.sekundy ?? null, klocki: { start: k.start.length, end: k.end.length } };
            }))) return;

            // 6. PUBLIKACJA — Kronikarz pisze opis → do_akceptacji (wysyłka dopiero po ✓ Suwerena)
            if (!(await zrob('publikacja', async () => {
                if (!cfg.publikuj) throw new Error('Publikacje YouTube niepodłączone w tej Katedrze.');
                const p = await cfg.publikuj({ plik: s.plik, nazwa: `${NAZWA} — ${s.tancerz.imie} · ${s.konkurencja.nazwa}`, kontekst: kontekstKronikarza(s), zrodlo: { projekt: PROJEKT, show: s.id }, kanalId: s.kanalId });
                s.publikacja = { id: p.id, etap: p.etap, tytul: p.tytul ?? null, kanalNazwa: p.kanalNazwa ?? null, blad: p.blad ?? null };
                if (p.etap === 'blad') throw new Error(`Kronikarz: ${p.blad ?? 'nie przygotował opisu'} — popraw w Impresariacie albo „↻ Ponów”.`);
                return { publikacja: p.id };
            }))) return;

            Object.assign(s, { stan: 'do_akceptacji', powod: null, gotowy: czas() });
            await pisz(s);
            await fs.rm(path.join(praca), { recursive: true, force: true, maxRetries: 2 }).catch(() => {});
            nadaj(`odcinek „${s.publikacja?.tytul ?? s.tancerz.imie}” gotowy — czeka na ✓ Suwerena w Impresariacie`);
        } catch (e) {
            Object.assign(s, { stan: 'blad', powod: String(e.message || e).slice(0, 500) });
            await pisz(s).catch(() => {});
        }
    }

    // Uwaga: `praca/` zostaje do końca łańcucha (intro, konkurencja i finał to pliki w niej) — „↻ Ponów” je odzyskuje.
    async function ponow(id, { bezIntro = false } = {}) {
        const s = await wczytaj(id);
        if (wRobocie.has(id)) throw new Error('Ten odcinek już jest w pracy.');
        if (!['blad'].includes(s.stan)) throw new Error('Ponowić można tylko odcinek, który stanął na błędzie.');
        for (const e of ETAPY) if (['gotowy'].includes(s.etapy[e]?.stan) && s.etapy[e].plik && !fsSync.existsSync(s.etapy[e].plik)) s.etapy[e] = { stan: 'czeka' };
        for (const e of ETAPY) if (s.etapy[e]?.stan === 'blad') s.etapy[e] = { stan: 'czeka' };
        if (bezIntro && s.etapy.intro.stan !== 'gotowy') s.etapy.intro = { stan: 'pominiety', powod: 'bez intro (wybór Suwerena)' };
        // nowa kolejność plików = nowe sklejenie i nowa publikacja
        if (s.etapy.sklejanie.stan === 'gotowy' && (bezIntro || s.etapy.intro.stan !== 'gotowy')) { s.etapy.sklejanie = { stan: 'czeka' }; s.etapy.publikacja = { stan: 'czeka' }; }
        Object.assign(s, { stan: 'w_kolejce', powod: null });
        await pisz(s);
        zakolejkuj(id);
        return s;
    }
    async function usun(id) {
        if (wRobocie.has(id)) throw new Error('Odcinek jest w pracy — poczekaj na koniec albo błąd.');
        await wczytaj(id);
        await fs.rm(path.join(KAT, id), { recursive: true, force: true });
        return true;
    }

    return { lista, wczytaj, utworz, ponow, usun, wRobocie: (id) => wRobocie.has(id), czekaj: () => kolejka };
}

/** Inne sieci społecznościowe: uczciwa lista „niepodłączone” z powodem (bez atrap). */
export const INNE_SIECI = [
    { siec: 'TikTok', stan: 'niepodłączony', powod: 'Content Posting API wymaga zatwierdzonej aplikacji TikTok for Developers i audytu — Katedra jej nie ma.' },
    { siec: 'Instagram (Reels)', stan: 'niepodłączony', powod: 'Graph API publikuje tylko z konta firmowego/twórcy przez aplikację Meta po przeglądzie uprawnień — brak aplikacji i tokenu.' },
    { siec: 'Facebook', stan: 'niepodłączony', powod: 'Publikacja wideo na stronie wymaga aplikacji Meta i tokenu strony z uprawnieniem pages_manage_posts — brak.' },
    { siec: 'X (Twitter)', stan: 'niepodłączony', powod: 'Wysyłka wideo przez API v2 wymaga płatnego planu dostępu i kluczy aplikacji — brak.' },
    { siec: 'SoundCloud', stan: 'niepodłączony', powod: 'Rejestracja nowych aplikacji API bywa zamknięta; to i tak serwis audio, nie wideo.' },
];

/** Kanał TeO Game Show — instrukcja dla Suwerena (kanału NIE da się założyć przez API YouTube). */
export const INSTRUKCJA_KANALU = [
    '1. YouTube → Twój awatar → Ustawienia → „Dodaj lub zarządzaj kanałami” → „Utwórz kanał” (kanał marki) → nazwa „TeO Game Show”.',
    '2. Katedra → Impresariat → 📺 YouTube → „➕ Dodaj kanał” → w okienku Google wybierz konto i kanał „TeO Game Show”.',
    '3. Impresariat → 🎪 TeO Game Show → „Kanał programu” → wybierz „TeO Game Show” (odcinki pójdą tam same; zmienisz przed każdym ✓).',
    '4. W YouTube Studio kanału: opis, baner i playlistę „TeO Game Show” robisz ręcznie (API tego nie potrzebuje).',
];

/** Karta Stołu: propozycja zarządzania kanałem przez stado (harmonogram, opisy). */
export function kartaZarzadzania() {
    return {
        tytul: '🎪 TeO Game Show — zarządzanie kanałem',
        tresc: [
            'Wizja: Dedykowany kanał YouTube „TeO Game Show” — teleturniej TeOgochi z Teterhii. Każdy nagrany występ Tanecznego Starcia sam składa się w odcinek (intro postaci, konkurencja, występ, wynik, wywiad po stworkowemu), a stado prowadzi kanał.',
            '',
            'Do ustalenia przez stado:',
            '- Harmonogram: ile odcinków w tygodniu i w które dni (np. wt/czw/sob 18:00), Taniec Tygodnia jako odcinek specjalny, Mistrzostwa Świata w grudniu jako sezon finałowy.',
            '- Styl opisów Kronikarza: stały początek „TeO Game Show:”, stałe tagi programu, linia o Katedrze OtakOS, język (PL, osobna wersja EN?).',
            '- Playlisty: Taniec Dnia / Tygodnia / Miesiąca / Roku / Mistrzostwa — porządek na kanale (ręcznie w YouTube Studio).',
            '- Kolejne konkurencje Teterhii w programie (turnieje Klubu Mistrzów, starcia muzyczne).',
            '',
            'Zasady: nic nie idzie na YouTube bez ✓ Suwerena (Impresariat / Izba w StoL), filmy wychodzą jako niepubliczne. Kanał zakłada Suweren ręcznie.',
            '',
            'Uczestnicy: Kronikarz, Reżyser, Aktor, Mistrz',
        ].join('\n'),
    };
}

export default { utworzGameShow, promptIntro, konkurencja, zapowiedz, ogloszenieWyniku, promptWywiaduStworka, odczytajWywiadStworka, kontekstKronikarza, kartaZarzadzania, INNE_SIECI, INSTRUKCJA_KANALU, PROJEKT, NAZWA, ETAPY };
