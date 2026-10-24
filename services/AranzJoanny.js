/**
 * 🎼 Joanna aranżuje szkic (Suweren 2026-10-20: „czy Joanna mogłaby z tego szkicu ułożyć jakiś utwór”) — strona MOSTU.
 *
 * Droga jak w jamie i u JaJa Kompozytora: MODEL WYBIERA Z ZAMKNIĘTYCH LIST, NUTY LICZY KOD.
 *  1. Analiza jamu (.mid → tonacja, tempo, motywy z numerami) — w Music Studio (`src/jam/analiza.ts`), tu przychodzi jej opis.
 *  2. PLAN (`planuj`): model przydziału `joanna` układa formę z `SEKCJE` w całych taktach, `PROGRESJE`, `INSTRUMENTY`,
 *     numery motywów z analizy, tytuł, tagi (EN) i opcjonalny tekst → `oczyscPlan` (zła = jedna poprawka z błędem, potem błąd
 *     wprost). ✎ poprawka Suwerena = para „model → Suweren” w `obserwacje.jsonl` (jak u Kompozytora).
 *  3. ARANŻ MIDI i render demo liczy apka (`src/jam/aranz.ts`, `render.ts`) → `zapiszDemo` (wav → mp3 + .mid).
 *  4. PEŁNE BRZMIENIE (`brzmienie`): demo jako wzór → Warsztat Utworów (ACE-Step 1.5, tryb remiks, `sila` = ile zmienić)
 *     z tagami i tekstem planu → gotowy plik kopiowany obok demo.
 *  5. Gotowe pliki w `_OtakOs_Muzyka/Aranże Joanny/` (płasko: biblioteka `/api/rytm/utwory` widzi tylko jeden poziom
 *     katalogów) + oś dla Kompozytora (sekcje → ekrany i choreografia Tanecznego Starcia).
 * Listy SEKCJE / INSTRUMENTY / PROGRESJE = BLIŹNIAK `src/jam/aranz.ts` apki — zmieniasz tu, zmień tam.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';

export const KATALOG = 'Aranże Joanny';
export const SEKCJE = {
    intro: { nazwa: 'Intro', energia: 0.3, kompozytor: 'intro' },
    zwrotka: { nazwa: 'Zwrotka', energia: 0.5, kompozytor: 'staccato' },
    refren: { nazwa: 'Refren', energia: 0.8, kompozytor: 'drop' },
    przejscie: { nazwa: 'Przejście', energia: 0.6, kompozytor: 'buildup' },
    drop: { nazwa: 'Drop', energia: 1, kompozytor: 'drop' },
    outro: { nazwa: 'Outro', energia: 0.3, kompozytor: 'outro' },
};
export const INSTRUMENTY = {
    fortepian: 'melodia', syntezator: 'melodia', dzwonki: 'melodia', flet: 'melodia',
    organy: 'akordy', smyczki: 'akordy', pad: 'akordy', gitara: 'akordy', chor: 'akordy',
    'bas-syntetyczny': 'bas', 'bas-elektryczny': 'bas',
    'perkusja-elektroniczna': 'perkusja', 'perkusja-akustyczna': 'perkusja',
};
export const PROGRESJE = ['I-V-vi-IV', 'vi-IV-I-V', 'I-vi-IV-V', 'I-IV-V-IV', 'i-VI-III-VII', 'i-iv-v-i', 'i-VII-VI-VII', 'ii-V-I-I', 'I-I-IV-IV'];
export const MIN_TAKTOW = 8, MAX_TAKTOW = 128, MAX_SEKCJI = 14;

const tekst = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const bezOgonkow = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim();
const SYNONIMY = { verse: 'zwrotka', chorus: 'refren', bridge: 'przejscie', buildup: 'przejscie', 'build-up': 'przejscie', przejscia: 'przejscie' };

/** Progresja z listy bez względu na wielkość liter i rodzaj kreski — stopnie są te same („i-vi-IV-V” = „I-vi-IV-V”). */
export function progresjaZListy(p) {
    const k = String(p ?? '').trim().replace(/[–—−\s]+/g, '-').toLowerCase();
    return PROGRESJE.find((x) => x.toLowerCase() === k) ?? null;
}

export function typSekcji(s) {
    const t = bezOgonkow(s).replace(/[^a-z-]/g, '');
    if (t in SEKCJE) return t;
    return SYNONIMY[t] ?? null;
}

/**
 * Plan sprawdzony i oczyszczony. `motywy` = numery motywów z analizy. Błąd struktury = wyjątek z powodem;
 * nieznane instrumenty są POMIJANE (liczone w `pominiete`), ale sekcja bez żadnego znanego = błąd.
 */
export function oczyscPlan(o, { motywy = [] } = {}) {
    if (!o || typeof o !== 'object') throw new Error('Plan nie jest obiektem.');
    const lista = Array.isArray(o.sekcje) ? o.sekcje : [];
    if (lista.length < 2) throw new Error('Plan potrzebuje co najmniej 2 sekcji.');
    if (lista.length > MAX_SEKCJI) throw new Error(`Za dużo sekcji (${lista.length}, najwyżej ${MAX_SEKCJI}).`);
    const nry = new Set(motywy.map(Number));
    let pominiete = 0;
    const sekcje = lista.map((s, i) => {
        const typ = typSekcji(s?.typ);
        if (!typ) throw new Error(`Sekcja ${i + 1}: nieznany typ „${tekst(s?.typ, 30)}” (znane: ${Object.keys(SEKCJE).join(', ')}).`);
        const takty = Number(s?.takty);
        if (!Number.isInteger(takty) || takty < 1 || takty > 32) throw new Error(`Sekcja ${i + 1} (${SEKCJE[typ].nazwa}): „takty” musi być całą liczbą 1–32.`);
        const progresja = progresjaZListy(s?.progresja);
        if (!progresja) throw new Error(`Sekcja ${i + 1} (${SEKCJE[typ].nazwa}): progresja „${tekst(s?.progresja, 30)}” spoza listy (${PROGRESJE.join(', ')}).`);
        let motyw = s?.motyw === null || s?.motyw === undefined || s?.motyw === '' ? null : Number(s.motyw);
        if (motyw !== null && (!Number.isInteger(motyw) || !nry.has(motyw))) throw new Error(`Sekcja ${i + 1} (${SEKCJE[typ].nazwa}): motyw ${tekst(s?.motyw, 10)} spoza analizy (są: ${[...nry].join(', ') || 'brak'}).`);
        const inst = [];
        for (const x of Array.isArray(s?.instrumenty) ? s.instrumenty : []) {
            const id = bezOgonkow(x).replace(/\s+/g, '-');
            if (id in INSTRUMENTY) { if (!inst.includes(id)) inst.push(id); } else pominiete++;
        }
        if (!inst.length) throw new Error(`Sekcja ${i + 1} (${SEKCJE[typ].nazwa}): żaden instrument z listy (${Object.keys(INSTRUMENTY).join(', ')}).`);
        if (motyw !== null && !inst.some((x) => INSTRUMENTY[x] === 'melodia')) motyw = null; // motyw bez instrumentu melodii nie zagra
        const e = Number(s?.energia);
        return { typ, takty, energia: Number.isFinite(e) ? Math.round(Math.min(1, Math.max(0, e)) * 100) / 100 : SEKCJE[typ].energia, progresja, motyw, instrumenty: inst.slice(0, 6) };
    });
    const suma = sekcje.reduce((a, s) => a + s.takty, 0);
    if (suma < MIN_TAKTOW || suma > MAX_TAKTOW) throw new Error(`Utwór ma ${suma} taktów — plan potrzebuje ${MIN_TAKTOW}–${MAX_TAKTOW}.`);
    if (nry.size && !sekcje.some((s) => s.motyw !== null)) throw new Error('Żadna sekcja nie gra motywu Suwerena — utwór ma wyrosnąć z jego szkicu.');
    const tagi = tekst(o.tagi, 300).replace(/^["'„”]+|["'„”]+$/g, '');
    if (tagi.length < 8) throw new Error('Plan bez tagów (po angielsku) dla generatora muzyki.');
    return { tytul: tekst(o.tytul, 60) || 'Szkic Suwerena', styl: tekst(o.styl, 120), tagi, tekst: String(o.tekst ?? '').replace(/\r/g, '').slice(0, 800).trim(), sekcje, takty: suma, pominiete };
}

export function wyjmijJson(s) {
    const t = String(s ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Joanna nie oddała obiektu JSON.');
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error(`Joanna oddała zepsuty JSON (${e.message}).`); }
}
export const odczytajPlan = (t, granice) => oczyscPlan(wyjmijJson(t), granice);

export const SYSTEM_PLANU = `Jesteś Joanna — TeOgochi muzyki Katedry OtakOS. Suweren zagrał szkic na klawiszach; z jego motywów układasz PLAN pełnego utworu.
NUT NIE PISZESZ — melodię z motywów Suwerena, akordy, bas i perkusję policzy kod. Ty wybierasz z list:
- typ sekcji: ${Object.keys(SEKCJE).join(' | ')}
- progresja (stopnie skali na kolejne takty): ${PROGRESJE.join(' | ')} (w moll najlepiej i-…)
- instrumenty: ${Object.keys(INSTRUMENTY).join(' | ')} (melodię grają: fortepian, syntezator, dzwonki, flet; bez instrumentu melodii motyw milczy)
- motyw: numer motywu z analizy albo null
Odpowiadasz WYŁĄCZNIE jednym obiektem JSON:
{"tytul":"…","styl":"krótko po polsku","tagi":"jedna linia tagów PO ANGIELSKU dla generatora (gatunek, instrumenty, nastrój, tonacja, tempo w bpm)","tekst":"" ,"sekcje":[{"typ":"intro","takty":4,"energia":0.3,"progresja":"i-VI-III-VII","motyw":null,"instrumenty":["pad"]}]}
Zasady: 4–10 sekcji, „takty” to CAŁE takty 4/4 (najlepiej 4 albo 8), razem 24–64 takty; refren i drop głośniej (energia 0,8–1), intro i outro ciszej; motyw Suwerena musi grać co najmniej w jednej sekcji; „tekst” krótki (kilka linii) albo pusty dla utworu instrumentalnego.`;

export function promptPlanu({ analiza = {}, uwagi = '' } = {}) {
    const a = analiza && typeof analiza === 'object' ? analiza : {};
    const motywy = (Array.isArray(a.motywy) ? a.motywy : []).slice(0, 8).map((m) => `  ${Number(m.nr)}. ${Number(m.takty) || 1} takt(y), ${Number(m.nut) || 0} nut, kontur ${tekst(m.kontur, 15)}, ocena ${Number(m.ocena) || 0}: ${tekst(m.melodia, 100)}`);
    return [
        `SZKIC SUWERENA: tonacja ${tekst(a.tonacja, 20) || '?'} (pewność ${Number(a.pewnoscTonacji ?? 0).toFixed(2)}), ${Number(a.bpm) || '?'} BPM, ${Number(a.nut) || 0} nut.`,
        'MOTYWY (z analizy kodu, najlepsze pierwsze):',
        ...(motywy.length ? motywy : ['  (brak)']),
        uwagi ? `UWAGI SUWERENA: ${tekst(uwagi, 600)}` : '',
        'JSON:',
    ].filter(Boolean).join('\n');
}

export const nazwaPliku = (s) => String(s ?? '').normalize('NFC').replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'aranz';
const ffmpegNaMp3 = (ffmpeg, we, wy) => new Promise((ok, zle) => execFile(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', we, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', wy],
    { windowsHide: true, timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 },
    (e, _o, err) => (e ? zle(new Error(`ffmpeg: ${String(err || e.message).trim().split('\n').slice(-2).join(' | ').slice(0, 300)}`)) : ok())));

/** Oś Kompozytora z planu: sekcje → typy osi, takty od–do, prompt = tagi. */
export function osZPlanu(plan, bpm) {
    let t = 0;
    return {
        tytul: plan.tytul, bpm, takty: plan.takty, prompt: plan.tagi, opis: `Aranż Joanny ze szkicu Suwerena${plan.styl ? ` — ${plan.styl}` : ''}.`,
        sekcje: plan.sekcje.map((s) => { const o = { typ: SEKCJE[s.typ].kompozytor, nazwa: SEKCJE[s.typ].nazwa, od: t, do: t + s.takty, energia: s.energia, muzyka: `${s.progresja} · ${s.instrumenty.join(', ')}` }; t += s.takty; return o; }),
        markery: [],
    };
}

/**
 * @param {{ katalogMuzyki: string, katalog: string, ffmpeg: string,
 *   pisz?: (z: {system: string, prompt: string}) => Promise<{tekst: string, model?: string}>,
 *   warsztat?: { przerob: Function, stanZadania: Function }, comfy?: () => Promise<{online: boolean, message?: string}>,
 *   kompozytor?: { zFormy?: Function } | null, szyna?: any, teraz?: () => Date }} cfg
 */
export function utworzAranz({ katalogMuzyki, katalog, ffmpeg, pisz, warsztat = null, comfy = null, kompozytor = null, produkcja = null, szyna = null, teraz = () => new Date() }) {
    const KAT = path.join(katalog, 'aranze');
    const PLIK_OBS = path.join(katalog, 'obserwacje.jsonl');
    const katMuzyki = path.join(katalogMuzyki, KATALOG);
    const rel = (p) => path.relative(katalogMuzyki, p).split(path.sep).join('/');
    const url = (r) => `/music/${r.split('/').map(encodeURIComponent).join('/')}`;
    let kolejka = Promise.resolve();
    const poKolei = (f) => { const p = kolejka.then(f); kolejka = p.catch(() => {}); return p; };
    const plik = (id) => { if (!/^a-[0-9a-f]{8}$/.test(String(id))) throw new Error('Zły identyfikator aranżu.'); return path.join(KAT, `${id}.json`); };
    async function wczytaj(id) { try { return JSON.parse(await fs.readFile(plik(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiego aranżu.'); throw e; } }
    const zapisz = async (a) => { await fs.mkdir(KAT, { recursive: true }); await fs.writeFile(plik(a.id), JSON.stringify(a, null, 2)); return a; };
    const baza = (a) => `${nazwaPliku(a.plan.tytul)} [${a.id.slice(2)}]`;
    const tresc = (p) => ({ tytul: p.tytul, styl: p.styl, tagi: p.tagi, tekst: p.tekst, sekcje: p.sekcje });

    async function obserwuj(wpis) {
        await fs.mkdir(katalog, { recursive: true });
        const stare = await fs.readFile(PLIK_OBS, 'utf8').catch(() => '');
        const nr = stare.split('\n').filter(Boolean).length + 1;
        await fs.appendFile(PLIK_OBS, `${JSON.stringify({ nr, kiedy: teraz().toISOString(), ...wpis })}\n`);
    }

    /** Analiza z apki: tylko liczby i napisy, motywy z numerami. */
    function oczyscAnalize(a) {
        const o = a && typeof a === 'object' ? a : {};
        const motywy = (Array.isArray(o.motywy) ? o.motywy : []).slice(0, 8).map((m) => ({ nr: Number(m?.nr), takty: Number(m?.takty) || 1, nut: Number(m?.nut) || 0, melodia: tekst(m?.melodia, 120), kontur: tekst(m?.kontur, 15), ocena: Number(m?.ocena) || 0 })).filter((m) => Number.isInteger(m.nr) && m.nr > 0);
        const bpm = Math.round(Number(o.bpm));
        if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) throw new Error('Analiza bez tempa 40–240 BPM.');
        if (!motywy.length) throw new Error('W szkicu nie ma motywu (co najmniej 2 nuty we frazie) — zagraj frazę i nagraj jam jeszcze raz.');
        return { bpm, tonacja: tekst(o.tonacja, 20), pewnoscTonacji: Number(o.pewnoscTonacji) || 0, nut: Number(o.nut) || 0, motywy };
    }

    async function planuj({ jam = '', analiza, uwagi = '' } = {}) {
        if (!pisz) throw new Error('Most nie ma modelu Joanny.');
        const an = oczyscAnalize(analiza);
        const jamRel = tekst(jam, 300);
        if (jamRel && !fsSync.existsSync(path.join(katalogMuzyki, jamRel))) throw new Error(`Nie widzę jamu „${jamRel}” w bibliotece.`);
        const granice = { motywy: an.motywy.map((m) => m.nr) };
        const prompt = promptPlanu({ analiza: an, uwagi });
        let odp = await pisz({ system: SYSTEM_PLANU, prompt });
        let plan;
        try { plan = odczytajPlan(odp.tekst, granice); } catch (e) {
            odp = await pisz({ system: SYSTEM_PLANU, prompt: `${prompt}\n\nTwoja poprzednia odpowiedź była zła: ${e.message} Popraw i oddaj sam JSON.` });
            plan = odczytajPlan(odp.tekst, granice); // drugi raz zła = błąd wprost
        }
        const { pominiete, ...czysty } = plan;
        const a = { id: `a-${crypto.randomBytes(4).toString('hex')}`, utworzono: teraz().toISOString(), stan: 'propozycja', jam: jamRel || null, analiza: an, uwagi: tekst(uwagi, 600), model: odp.model ?? null, plan: czysty, pominieteInstrumenty: pominiete, odModelu: tresc(czysty), poprawiony: false, demo: null, brzmienie: null, osie: [] };
        await zapisz(a);
        void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🎼 plan utworu „${czysty.tytul}” ze szkicu — ${czysty.sekcje.length} sekcji, ${czysty.takty} taktów` })?.catch?.(() => {});
        return a;
    }

    async function popraw(id, plan) {
        return poKolei(async () => {
            const a = await wczytaj(id);
            if (a.brzmienie?.stan === 'liczy') throw new Error('Pełne brzmienie się liczy — poprawka po nim.');
            const { pominiete, ...czysty } = oczyscPlan(plan, { motywy: a.analiza.motywy.map((m) => m.nr) });
            void pominiete;
            if (JSON.stringify(tresc(czysty)) === JSON.stringify(tresc(a.plan))) return a;
            await obserwuj({ rodzaj: 'poprawka', aranz: id, model: a.model, odModelu: a.odModelu, odSuwerena: tresc(czysty), prompt: promptPlanu({ analiza: a.analiza, uwagi: a.uwagi }) });
            Object.assign(a, { plan: czysty, poprawiony: true, demo: null, brzmienie: null, stan: 'propozycja' });
            return zapisz(a);
        });
    }

    async function decyzja(id, co) {
        return poKolei(async () => {
            const a = await wczytaj(id);
            a.stan = co === 'przyjmij' ? 'przyjety' : 'odrzucony';
            await obserwuj({ rodzaj: 'decyzja', aranz: id, decyzja: a.stan, poprawiony: a.poprawiony });
            return zapisz(a);
        });
    }

    async function osDla(a, plikRel) {
        if (!kompozytor?.zFormy) return null;
        try { const o = await kompozytor.zFormy({ ...osZPlanu(a.plan, a.analiza.bpm), utwor: plikRel }); return o?.id ?? null; } catch (e) { return `blad: ${e.message}`; }
    }

    async function zapiszDemo(id, { audio, midi, typAudio = 'audio/wav' } = {}) {
        return poKolei(async () => {
            const a = await wczytaj(id);
            if (a.stan === 'odrzucony') throw new Error('Aranż odrzucony — najpierw nowy plan albo poprawka.');
            const au = Buffer.from(String(audio ?? ''), 'base64');
            const mi = Buffer.from(String(midi ?? ''), 'base64');
            if (au.length < 4096) throw new Error('Demo jest puste albo za krótkie.');
            if (!/^(audio\/(wav|x-wav|webm|ogg)|application\/octet-stream)/.test(String(typAudio))) throw new Error('Demo musi być wav, webm albo ogg.');
            if (mi.length < 14 || mi.subarray(0, 4).toString('latin1') !== 'MThd') throw new Error('Aranż MIDI pusty albo uszkodzony (brak MThd).');
            await fs.mkdir(katMuzyki, { recursive: true });
            const b = baza(a);
            const surowe = path.join(katMuzyki, `.${b}.surowe.${/webm/.test(typAudio) ? 'webm' : /ogg/.test(typAudio) ? 'ogg' : 'wav'}`);
            const mp3 = path.join(katMuzyki, `${b} (demo).mp3`);
            await fs.writeFile(surowe, au);
            try { await ffmpegNaMp3(ffmpeg, surowe, mp3); } finally { await fs.rm(surowe, { force: true }).catch(() => {}); }
            const mid = path.join(katMuzyki, `${b}.mid`);
            await fs.writeFile(mid, mi);
            await fs.writeFile(path.join(katMuzyki, `${b}.plan.json`), JSON.stringify({ ...a.plan, bpm: a.analiza.bpm, tonacja: a.analiza.tonacja, jam: a.jam, aranz: a.id }, null, 2));
            a.demo = { mp3: rel(mp3), mid: rel(mid), kiedy: teraz().toISOString() };
            const os = await osDla(a, a.demo.mp3);
            if (os) a.osie = [...(a.osie ?? []).filter((x) => x.plik !== a.demo.mp3), { plik: a.demo.mp3, os }];
            return zapisz(a);
        });
    }

    async function brzmienie(id, { sila = 0.45, seed } = {}) {
        if (!warsztat) throw new Error('Most nie ma Warsztatu Utworów.');
        const a = await wczytaj(id);
        if (!a.demo) throw new Error('Najpierw demo aranżu (▶ demo) — ono jest wzorem dla ACE-Step.');
        if (a.brzmienie?.stan === 'liczy') return a;
        if (comfy) { const c = await comfy(); if (!c?.online) throw new Error(c?.message || 'ComfyUI nie odpowiada.'); }
        const t = a.analiza.tonacja.match(/^([a-hA-H][#b]?)-(dur|moll)$/);
        const keyscale = t ? `${t[1].toUpperCase().replace('H', 'B')} ${t[2] === 'dur' ? 'major' : 'minor'}` : undefined;
        const z = await warsztat.przerob({ tryb: 'remiks', plik: a.demo.mp3, tags: a.plan.tagi, lyrics: a.plan.tekst, sila: Math.max(0.1, Math.min(0.95, Number(sila) || 0.45)), bpm: a.analiza.bpm, keyscale, seed });
        return poKolei(async () => {
            const b = await wczytaj(id);
            b.brzmienie = { zadanie: z.id, sila: z.sila, stan: 'liczy', od: teraz().toISOString(), plik: null, blad: null, keyscale: keyscale ?? null };
            return zapisz(b);
        });
    }

    /** Dociąga wynik Warsztatu: gotowy → kopia do biblioteki obok demo (+ oś), błąd → powód. */
    async function odswiez(a) {
        const br = a.brzmienie;
        if (!br || br.stan !== 'liczy' || !warsztat) return a;
        const z = warsztat.stanZadania(br.zadanie);
        if (!z) return poKolei(async () => { const b = await wczytaj(a.id); b.brzmienie = { ...b.brzmienie, stan: 'blad', blad: 'Zadanie Warsztatu zgubione (restart mostu) — zleć jeszcze raz.' }; return zapisz(b); });
        if (z.stan === 'liczy') return a;
        return poKolei(async () => {
            const b = await wczytaj(a.id);
            if (z.stan === 'blad') b.brzmienie = { ...b.brzmienie, stan: 'blad', blad: z.blad };
            else {
                const cel = path.join(katMuzyki, `${baza(b)}.mp3`);
                await fs.copyFile(z.wynik, cel);
                b.brzmienie = { ...b.brzmienie, stan: 'gotowe', plik: rel(cel), sekundy: z.sekundyWyniku ?? null, do: teraz().toISOString() };
                const os = await osDla(b, b.brzmienie.plik);
                if (os) b.osie = [...(b.osie ?? []).filter((x) => x.plik !== b.brzmienie.plik), { plik: b.brzmienie.plik, os }];
                void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🎼 utwór „${b.plan.tytul}” gotowy (ACE-Step, siła ${b.brzmienie.sila})` })?.catch?.(() => {});
            }
            return zapisz(b);
        });
    }

    /** Zestaw padów, który grał w jamie aranżu (karta jamu `zestawPadow` → Pady/<id>/zestaw.json) — dla perkusji z próbek. */
    async function zestawJamu(a) {
        if (!a.jam) return null;
        try {
            const karta = JSON.parse(await fs.readFile(path.join(katalogMuzyki, a.jam.replace(/\.mid$/i, '.json')), 'utf8'));
            if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(String(karta.zestawPadow ?? ''))) return null;
            const kat = path.join(katalogMuzyki, 'Jam z Joanną', 'Pady', karta.zestawPadow);
            const z = JSON.parse(await fs.readFile(path.join(kat, 'zestaw.json'), 'utf8'));
            const pady = (Array.isArray(z.pady) ? z.pady : []).map((p) => (p && /^pad-\d{1,2}-[0-9a-f]{6,16}\.wav$/.test(String(p.plik)) ? p : { ...p, plik: null }));
            return { id: karta.zestawPadow, katalog: kat, pady };
        } catch { return null; }
    }

    /** 🎚️ Produkcja w SoundCraft (services/ProdukcjaSoundcraft.js): miks z listy, −14 LUFS, stemy, sesja .scraft. */
    async function produkuj(id, { miks, uwagi } = {}) {
        if (!produkcja) throw new Error('Most nie ma produkcji SoundCraft.');
        const a = await wczytaj(id);
        if (a.stan === 'odrzucony') throw new Error('Aranż odrzucony — najpierw nowy plan albo poprawka.');
        const zestaw = await zestawJamu(a);
        const p = await produkcja.produkuj(a, { miks, uwagi, zestaw, baza: baza(a) });
        return poKolei(async () => {
            const b = await wczytaj(id);
            b.produkcja = { ...p, wav: undefined, zestawPadow: zestaw?.id ?? null };
            const os = await osDla(b, p.plik);
            if (os) b.osie = [...(b.osie ?? []).filter((x) => x.plik !== p.plik), { plik: p.plik, os }];
            void szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc: `🎚️ „${b.plan.tytul}” wyprodukowany w SoundCraft — miks ${p.miks}, ${p.lufs} LUFS, ${p.stemy.length} stemów` })?.catch?.(() => {});
            return zapisz(b);
        });
    }
    async function otworzSesje(id) {
        if (!produkcja) throw new Error('Most nie ma produkcji SoundCraft.');
        const a = await wczytaj(id);
        if (!a.produkcja?.sesja) throw new Error('Ten aranż nie ma jeszcze sesji SoundCraft — najpierw 🎚️ produkcja.');
        return produkcja.otworz(a.produkcja.sesja);
    }

    const zUrl = (a) => ({ ...a, demoUrl: a.demo ? url(a.demo.mp3) : null, midUrl: a.demo ? url(a.demo.mid) : null, utworUrl: a.brzmienie?.plik ? url(a.brzmienie.plik) : null, produkcjaUrl: a.produkcja?.plik ? url(a.produkcja.plik) : null });
    async function jeden(id) { return zUrl(await odswiez(await wczytaj(id))); }
    async function lista() {
        const out = [];
        for (const f of await fs.readdir(KAT).catch(() => [])) if (/^a-[0-9a-f]{8}\.json$/.test(f)) { try { out.push(await jeden(f.slice(0, -5))); } catch { /* uszkodzony */ } }
        return out.sort((x, y) => String(y.utworzono).localeCompare(String(x.utworzono))).slice(0, 60);
    }
    async function usun(id) { await fs.rm(plik(id)); return true; }

    return { planuj, popraw, decyzja, zapiszDemo, brzmienie, produkuj, otworzSesje, stanProdukcji: () => (produkcja ? produkcja.stan() : Promise.resolve({ dostepny: false, powod: 'Most nie ma produkcji SoundCraft.' })), jeden, lista, usun };
}

export function zamontujTrasyAranzu(app, A) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(/Nie ma takiego/.test(e.message) ? 404 : kod).json({ success: false, message: e.message }));
    app.get('/api/aranz', (_req, res) => odp(res, A.lista().then((aranze) => ({ aranze, sekcje: SEKCJE, instrumenty: INSTRUMENTY, progresje: PROGRESJE, katalog: KATALOG })), 500));
    app.post('/api/aranz', (req, res) => odp(res, A.planuj(req.body ?? {}).then((aranz) => ({ aranz }))));
    // 🎚️ stan SoundCraft — przed /:id
    app.get('/api/aranz/soundcraft', (_req, res) => odp(res, A.stanProdukcji().then((soundcraft) => ({ soundcraft })), 500));
    app.get('/api/aranz/:id', (req, res) => odp(res, A.jeden(req.params.id).then((aranz) => ({ aranz }))));
    app.put('/api/aranz/:id', (req, res) => odp(res, A.popraw(req.params.id, req.body?.plan).then((aranz) => ({ aranz }))));
    app.post('/api/aranz/:id/przyjmij', (req, res) => odp(res, A.decyzja(req.params.id, 'przyjmij').then((aranz) => ({ aranz }))));
    app.post('/api/aranz/:id/odrzuc', (req, res) => odp(res, A.decyzja(req.params.id, 'odrzuc').then((aranz) => ({ aranz }))));
    app.post('/api/aranz/:id/demo', (req, res) => odp(res, A.zapiszDemo(req.params.id, req.body ?? {}).then((aranz) => ({ aranz }))));
    app.post('/api/aranz/:id/brzmienie', (req, res) => odp(res, A.brzmienie(req.params.id, req.body ?? {}).then((aranz) => ({ aranz })), 424));
    app.post('/api/aranz/:id/produkcja', (req, res) => odp(res, A.produkuj(req.params.id, req.body ?? {}).then((aranz) => ({ aranz })), 424));
    app.post('/api/aranz/:id/otworz-sesje', (req, res) => odp(res, A.otworzSesje(req.params.id), 424));
    app.delete('/api/aranz/:id', (req, res) => odp(res, A.usun(req.params.id).then((usuniety) => ({ usuniety }))));
    return A;
}

export default { utworzAranz, zamontujTrasyAranzu, oczyscPlan, odczytajPlan, promptPlanu, osZPlanu, typSekcji, SEKCJE, INSTRUMENTY, PROGRESJE, KATALOG };
