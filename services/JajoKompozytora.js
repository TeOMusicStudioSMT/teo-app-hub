/**
 * 🏛️⚡ JaJo Kompozytor — „Kompozytor i Producent TeO Game Show” [domena „Bam”] (Suweren 2026-10-13: opis jaja
 * w `produkcje/taneczne-starcie/DANCE_PVP/JaJo Kompozytor.txt` + rozmowa „Katedralna Aranżacja Elektro-Organowa dla
 * TeOgochi”). Podział hybrydowy: JAJO KOMPONUJE (model przydziału `kompozytor`), KOD BUDUJE (deterministycznie).
 *
 *  · `komponuj({utwor|opis, bpm, styl, sekundy})` → model pisze OŚ CZASU w JSON: sekcje (Intro / Staccato / Build-up /
 *    Drop / Outro) z czasami w TAKTACH (4/4), energia, sugerowany ruch TeOgochi, scena świateł dla ekranów LED (tryby
 *    ekranów Tanecznego Starcia), markery i prompt dla generatora muzyki (tagi po angielsku). Odczyt jest SPRAWDZANY
 *    (`odczytajOs`): sekcje w granicach utworu, bez nakładania, znane typy i sceny — zły = błąd wprost (jedna
 *    poprawka z błędem w prośbie, potem stop). Z utworu z biblioteki takty liczymy z jego rytmu (`/api/rytm`).
 *  · Oś trafia do Bazyliki (zamówienie u Joanny Z GOTOWYM promptem Kompozytora), do choreografii (nazwy sekcji na
 *    frazach, mocniejsze ruchy na Drop, sceny ekranów LED) i do PvP rytmicznego (Drop = gęstszy wzór nut).
 *  · Suweren poprawia oś (`popraw`) → para „model → Suweren” w `obserwacje.jsonl` (jak JaJo Mistrza), przyjmuje /
 *    odrzuca (`decyzja`). Jajo pęka od tych punktów (poprawka 2, decyzja 1; progi `ETAPY` JaJa Mistrza).
 *    `kurs()` → `kuznia-soup/kompozytor/` (pary DPO + SFT); trening = decyzja Suwerena.
 * Pliki: `_OtakOs_Wymiar/jajo-kompozytora/osie/o-<8 hex>.json`, `obserwacje.jsonl`.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ETAPY } from './JajoMistrza.js';

export { ETAPY };
/** Typy sekcji (klucz = to, co pisze model po normalizacji) — energia domyślna, scena świateł domyślna. */
export const SEKCJE = {
    intro: { nazwa: 'Intro', energia: 0.25, scena: 'gwiazdy', kolor: '#7c3aed' },
    staccato: { nazwa: 'Staccato', energia: 0.55, scena: 'kolor', kolor: '#2563eb' },
    buildup: { nazwa: 'Build-up', energia: 0.75, scena: 'fale', kolor: '#9333ea' },
    drop: { nazwa: 'Drop', energia: 1, scena: 'stroboskop', kolor: '#dc2626' },
    outro: { nazwa: 'Outro', energia: 0.3, scena: 'napis', kolor: '#f59e0b' },
};
/** Sceny ekranów LED = tryby ekranów Tanecznego Starcia (src/ekrany.ts, bez „auto” i „wyłączone”). */
export const SCENY_LED = ['korektor', 'fale', 'gwiazdy', 'napis', 'kolor', 'stroboskop'];
export const MARKERY = ['staccato', 'buildup', 'drop', 'freeze', 'akcent', 'tutti'];
export const MIN_TAKTOW = 8;
export const MAX_TAKTOW = 256;
const MAX_SEKCJI = 16;

const tekst = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
/** „Build-up”, „The Drop”, „INTRO” → klucz typu; nieznany → null. */
export function typSekcji(s) {
    const t = String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^the\s+/, '').replace(/[^a-z]/g, '');
    if (t in SEKCJE) return t;
    if (t === 'build' || t === 'buildups') return 'buildup';
    if (t === 'drops' || t === 'dropp') return 'drop';
    return null;
}
const typMarkera = (s) => { const t = String(s ?? '').toLowerCase().replace(/[^a-z]/g, ''); return MARKERY.includes(t) ? t : t === 'build' ? 'buildup' : null; };

/** Ile pełnych taktów 4/4 mieści się w czasie utworu. */
export function taktyZCzasu(sekundy, bpm, przesuniecie = 0) {
    const o = 60 / Math.max(40, Number(bpm) || 126);
    return Math.max(0, Math.floor((Number(sekundy) - (Number(przesuniecie) || 0)) / (4 * o) + 1e-6));
}

/** Pierwszy obiekt JSON z odpowiedzi modelu (bez <think>, bloków ```). */
export function wyjmijJson(s) {
    const t = String(s ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Kompozytor nie oddał obiektu JSON.');
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw new Error(`Kompozytor oddał zepsuty JSON (${e.message}).`); }
}

/**
 * Oś czasu sprawdzona i oczyszczona. `takty` = granica utworu. Błąd struktury = wyjątek z powodem (sekcje: typ,
 * granice, kolejność, sceny świateł). Markery spoza listy / poza utworem są pomijane i liczone w `pominiete`.
 */
export function oczyscOs(o, { takty, bpm } = {}) {
    if (!o || typeof o !== 'object') throw new Error('Oś czasu nie jest obiektem.');
    const T = Math.round(Number(takty) || Number(o.takty) || 0);
    if (T < MIN_TAKTOW || T > MAX_TAKTOW) throw new Error(`Utwór ma ${T} taktów — oś potrzebuje ${MIN_TAKTOW}–${MAX_TAKTOW}.`);
    const lista = Array.isArray(o.sekcje) ? o.sekcje : [];
    if (lista.length < 2) throw new Error('Oś potrzebuje co najmniej 2 sekcji.');
    if (lista.length > MAX_SEKCJI) throw new Error(`Za dużo sekcji (${lista.length}, najwyżej ${MAX_SEKCJI}).`);
    const sekcje = lista.map((s, i) => {
        const typ = typSekcji(s?.typ);
        if (!typ) throw new Error(`Sekcja ${i + 1}: nieznany typ „${tekst(s?.typ, 30)}” (znane: ${Object.values(SEKCJE).map((x) => x.nazwa).join(', ')}).`);
        const od = Number(s?.od), do_ = Number(s?.do);
        if (!Number.isInteger(od) || !Number.isInteger(do_)) throw new Error(`Sekcja ${i + 1} (${SEKCJE[typ].nazwa}): „od” i „do” muszą być całymi taktami.`);
        if (od < 0 || do_ > T || od >= do_) throw new Error(`Sekcja ${i + 1} (${SEKCJE[typ].nazwa}): takty ${od}–${do_} poza utworem 0–${T} albo puste.`);
        const sw = s?.swiatla && typeof s.swiatla === 'object' ? s.swiatla : {};
        const scena = sw.scena === undefined || sw.scena === null || sw.scena === '' ? SEKCJE[typ].scena : String(sw.scena).toLowerCase();
        if (!SCENY_LED.includes(scena)) throw new Error(`Sekcja ${i + 1} (${SEKCJE[typ].nazwa}): nieznana scena świateł „${tekst(sw.scena, 20)}” (znane: ${SCENY_LED.join(', ')}).`);
        const e = Number(s?.energia);
        return {
            typ, nazwa: tekst(s?.nazwa, 60) || SEKCJE[typ].nazwa, od, do: do_,
            energia: Number.isFinite(e) ? Math.round(Math.min(1, Math.max(0, e)) * 100) / 100 : SEKCJE[typ].energia,
            ruch: tekst(s?.ruch, 240), muzyka: tekst(s?.muzyka, 240),
            swiatla: { scena, kolor: /^#[0-9a-f]{6}$/i.test(String(sw.kolor)) ? String(sw.kolor).toLowerCase() : SEKCJE[typ].kolor, opis: tekst(sw.opis, 200) },
        };
    });
    for (let i = 1; i < sekcje.length; i++) {
        if (sekcje[i].od < sekcje[i - 1].od) throw new Error(`Sekcje nie są po kolei (${sekcje[i].nazwa} zaczyna się przed ${sekcje[i - 1].nazwa}).`);
        if (sekcje[i].od < sekcje[i - 1].do) throw new Error(`Sekcje ${sekcje[i - 1].nazwa} (${sekcje[i - 1].od}–${sekcje[i - 1].do}) i ${sekcje[i].nazwa} (${sekcje[i].od}–${sekcje[i].do}) nakładają się.`);
    }
    let pominiete = 0;
    const markery = [];
    for (const m of Array.isArray(o.markery) ? o.markery.slice(0, 40) : []) {
        const typ = typMarkera(m?.typ), takt = Number(m?.takt);
        if (!typ || !Number.isInteger(takt) || takt < 0 || takt > T) { pominiete++; continue; }
        markery.push({ takt, typ, opis: tekst(m?.opis, 160) });
    }
    markery.sort((a, b) => a.takt - b.takt);
    const prompt = tekst(o.prompt, 500).replace(/^["'„”]+|["'„”]+$/g, '');
    if (prompt.length < 10) throw new Error('Oś bez promptu dla generatora muzyki (tagi po angielsku).');
    const b = Math.round(Number(bpm) || Number(o.bpm) || 126);
    return { tytul: tekst(o.tytul, 80) || 'Bez tytułu', bpm: Math.min(180, Math.max(60, b)), metrum: 4, takty: T, sekcje, markery, prompt, opis: tekst(o.opis, 600), pominiete };
}

/** Odpowiedź modelu → oś (JSON + sprawdzenie). */
export const odczytajOs = (odp, granice) => oczyscOs(wyjmijJson(odp), granice);

/** Sekunda początku taktu `t` przy danym tempie (i przesunięciu pierwszego bitu). */
export const sekundaTaktu = (t, bpm, przes = 0) => (Number(przes) || 0) + t * 4 * 60 / bpm;

/** Wiedza Kompozytora (zwięźle z rozmowy Suwerena „Katedralna Aranżacja Elektro-Organowa dla TeOgochi”). */
export const WIEDZA = `Brzmienie „Bam”: gotycki majestat organów (pedałka Subbass 16'/32', Tutti, flety 4', Principal 8', Trompete 8', Vox Humana) + klubowe electro 4/4 (kick, offbeat hi-hat, snare na 2 i 4, bas Sawtooth). Tempo 124–128 BPM (126 = ćwierćnuta 0,476 s), tonacje d-moll / g-moll.
Wzorcowy przebieg „Cathedral Electro-Pulse” (126 BPM): Intro — długa pedałka, mroczny puls, ruch: posągowe wejście (Slow Freeze); Staccato — szybkie arpeggio fletów 16-stkami, suchy rimshot, ruch: Snap & Lock, izolacje, Pop-and-Freeze; Build-up — snare roll, filtr się otwiera, ruch: Footwork Shuffle, mikro-impulsy, niska pozycja przed zrzutem; Drop — Tutti + Sawtooth + pełny kick, ruch: Heavy Bass Stomp, Sub-Glide, obroty 360° z Hard Freeze; Outro — wygaszanie beatu, Reverb Tail, ruch: Fading Stance pod witrażem.
Światła: Intro purpura/bursztyn, gwiazdy; Staccato szafir i biel, punktowe błyski; Build-up purpura rosnąca 20→100%; Drop krwista czerwień + szmaragd, stroboskopy, siatki laserów; Outro złoty God-Ray.
Gra rytmiczna: tory A (niskie/kick — tupnięcie), S (snare — cięcie), K (hi-hat/flety — snap), L (Tutti/sub-bas — eksplozja). Drop = podwójne uderzenia A+L na każdą ćwierćnutę, Staccato = strumień S/K.`;

export const SYSTEM_KOMPOZYTORA = `Jesteś JaJem Kompozytorem — Kompozytorem i Producentem TeO Game Show w Katedrze OtakOS (domena „Bam” 🏛️⚡). Układasz aranżacje taneczne dla TeOgochi: organowy majestat + klubowe electro.
${WIEDZA}
Odpowiadasz WYŁĄCZNIE jednym obiektem JSON (bez komentarzy):
{"tytul":"…","opis":"1–2 zdania po polsku","prompt":"jedna linia tagów PO ANGIELSKU dla generatora muzyki (gatunek, instrumenty, nastrój, tempo w bpm, instrumental)","sekcje":[{"typ":"intro|staccato|buildup|drop|outro","nazwa":"…","od":0,"do":8,"energia":0.3,"muzyka":"co gra (po polsku, krótko)","ruch":"ruch TeOgochi (po polsku, krótko)","swiatla":{"scena":"gwiazdy|fale|korektor|napis|kolor|stroboskop","kolor":"#rrggbb","opis":"krótko"}}],"markery":[{"takt":8,"typ":"staccato|buildup|drop|freeze|akcent|tutti","opis":"…"}]}
Zasady: „od” i „do” to CAŁE TAKTY 4/4 liczone od 0, „do” WYŁĄCZNIE (sekcja 0–8 to takty 0…7, następna zaczyna się od 8 — bez luk); sekcje po kolei, bez nakładania, w granicach utworu (ostatnie „do” ≤ liczba taktów); co najmniej jeden Drop w najgłośniejszym miejscu; Build-up tuż przed Dropem. Bez zmyślonych typów.
„typ” to DOKŁADNIE jedno słowo: intro, staccato, buildup, drop albo outro. „swiatla.scena” to DOKŁADNIE jedno słowo: gwiazdy (cicho, kosmos), fale (narastanie), korektor (słupki w rytm), napis (tytuł na ekranach), kolor (barwa pulsuje w rytm) albo stroboskop (błyski na Drop) — opis świateł (lasery, błyski, God-Ray…) wpisz w „swiatla.opis”, nie w „scena”.`;

/** Przypomnienie przy drugiej próbie — sedno błędu + to, co model najczęściej myli. */
const PRZYPOMNIENIE = 'Pamiętaj: "typ" ∈ intro|staccato|buildup|drop|outro, "swiatla.scena" ∈ gwiazdy|fale|korektor|napis|kolor|stroboskop (opis świateł tylko w "swiatla.opis"), "od"/"do" całe takty.';

/**
 * Głośność każdego taktu utworu 0–9 (średnia siła uderzeń z `/api/rytm`, względem najgłośniejszego taktu) — żeby
 * Kompozytor stawiał Drop tam, gdzie utwór NAPRAWDĘ jest najgłośniejszy (ocena choreografii liczy prawdziwą energię).
 */
export function profilGlosnosci({ beaty = [], okresSek, bpm, przesuniecieSek = 0 } = {}, takty) {
    const o = Number(okresSek) || 60 / (Number(bpm) || 126);
    const sumy = new Array(takty).fill(0), ile = new Array(takty).fill(0);
    for (const b of Array.isArray(beaty) ? beaty : []) {
        const k = Math.floor((Number(b?.t) - przesuniecieSek) / (4 * o) + 1e-9);
        if (k >= 0 && k < takty) { sumy[k] += Number(b?.sila) || 0; ile[k]++; }
    }
    const sr = sumy.map((s, k) => (ile[k] ? s / ile[k] : 0));
    const max = Math.max(...sr);
    if (!(max > 0)) return '';
    return sr.map((x) => Math.min(9, Math.round((x / max) * 9))).join('');
}

/** Przykładowy podział (proporcje wzorca Cathedral Electro-Pulse) na DOKŁADNIE tyle taktów — podpowiedź formatu dla małych modeli. */
export function przykladPodzialu(takty) {
    const g = (u) => Math.round((u / 32) * takty);
    const granice = [0, g(4), g(12), g(16), g(28), takty];
    const typy = ['intro', 'staccato', 'buildup', 'drop', 'outro'];
    return typy.map((t, i) => [t, granice[i], granice[i + 1]]).filter(([, od, d]) => d > od).map(([t, od, d]) => `${t} ${od}–${d}`).join(', ');
}

export function promptKomponowania({ opis, bpm, takty, styl, utwor, glosnosc = '' }) {
    return [
        utwor ? `Utwór z biblioteki Katedry: „${utwor.tytul}” — ${bpm} BPM (zmierzone), ${takty} taktów 4/4. Ułóż oś do TEGO utworu (prompt opisuje jego brzmienie).` : `Nowy utwór do zamówienia: ${bpm} BPM, ${takty} taktów 4/4.`,
        glosnosc ? `Głośność taktów utworu (zmierzona, 0–9, takt po takcie od 0): ${glosnosc}. Drop połóż na najgłośniejszych taktach, Intro i Outro na cichych.` : '',
        styl ? `Styl: ${styl}.` : '',
        opis ? `Prośba Suwerena: ${opis}` : '',
        `Przykład poprawnego podziału na ${takty} taktów (dopasuj do utworu): ${przykladPodzialu(takty)} — ostatnie „do” = ${takty}, każda sekcja co najmniej 1 takt.`,
        `Liczba taktów utworu: ${takty}. JSON:`,
    ].filter(Boolean).join('\n');
}

/**
 * @param {{ katalog: string, katalogKuzni?: string|null, pisz: (a: {system: string, prompt: string}) => Promise<{tekst: string, model?: string}>,
 *   rytm?: (plik: string) => Promise<{bpm: number, sekundy: number, przesuniecieSek?: number}>, tytulUtworu?: (plik: string) => string,
 *   bazylika?: { zamow: Function, zamowienia: Function } | null, szyna?: any, teraz?: () => Date }} o
 */
export function utworzKompozytora({ katalog, katalogKuzni = null, pisz, rytm = null, tytulUtworu = (p) => path.basename(String(p)).replace(/\.[^.]+$/, '').replace(/_/g, ' '), bazylika = null, szyna = null, teraz = () => new Date() }) {
    const KAT_OSI = path.join(katalog, 'osie');
    const PLIK_OBS = path.join(katalog, 'obserwacje.jsonl');
    let zapis = Promise.resolve();
    const poKolei = (f) => { const p = zapis.then(f); zapis = p.catch(() => {}); return p; };

    const plikOsi = (id) => { if (!/^o-[0-9a-f]{8}$/.test(String(id))) throw new Error('Zły identyfikator osi.'); return path.join(KAT_OSI, `${id}.json`); };
    async function os(id) {
        try { return JSON.parse(await fs.readFile(plikOsi(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') throw new Error('Nie ma takiej osi czasu.'); throw e; }
    }
    const zapiszOs = async (o) => { await fs.mkdir(KAT_OSI, { recursive: true }); await fs.writeFile(plikOsi(o.id), JSON.stringify(o, null, 2)); return o; };
    async function osie() {
        const out = [];
        for (const f of await fs.readdir(KAT_OSI).catch(() => [])) if (/^o-[0-9a-f]{8}\.json$/.test(f)) { try { out.push(JSON.parse(await fs.readFile(path.join(KAT_OSI, f), 'utf8'))); } catch { /* uszkodzona */ } }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }

    async function obserwacje() {
        const t = await fs.readFile(PLIK_OBS, 'utf8').catch(() => '');
        return t.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    }
    async function obserwuj(wpis) {
        return poKolei(async () => {
            const w = await obserwacje();
            const o = { nr: (w.at(-1)?.nr ?? 0) + 1, kiedy: teraz().toISOString(), ...wpis };
            await fs.mkdir(katalog, { recursive: true });
            await fs.appendFile(PLIK_OBS, `${JSON.stringify(o)}\n`);
            return o;
        });
    }

    /** Czysta wersja osi do porównania (bez pól pracy). */
    const tresc = (o) => ({ tytul: o.tytul, opis: o.opis, prompt: o.prompt, bpm: o.bpm, takty: o.takty, sekcje: o.sekcje, markery: o.markery });

    async function komponuj({ utwor = null, opis = '', bpm = 126, styl = '', sekundy = 90 } = {}) {
        if (!pisz) throw new Error('Kompozytor nie ma modelu (most bez Ollamy).');
        const prosba = tekst(opis, 600);
        let b, takty, u = null, glosnosc = '';
        if (utwor) {
            if (!rytm) throw new Error('Most nie liczy rytmu utworów.');
            const r = await rytm(String(utwor));
            b = Math.round(r.bpm);
            takty = Math.min(MAX_TAKTOW, taktyZCzasu(r.sekundy, r.bpm, r.przesuniecieSek));
            u = { plik: String(utwor), tytul: tytulUtworu(utwor), bpm: r.bpm, sekundy: r.sekundy, przesuniecieSek: r.przesuniecieSek ?? 0 };
            glosnosc = profilGlosnosci(r, takty);
        } else {
            if (prosba.length < 3) throw new Error('Opisz utwór albo wybierz go z biblioteki.');
            b = Math.round(Math.min(180, Math.max(60, Number(bpm) || 126)));
            takty = Math.min(MAX_TAKTOW, taktyZCzasu(Math.min(300, Math.max(20, Number(sekundy) || 90)), b));
        }
        if (takty < MIN_TAKTOW) throw new Error(`Utwór za krótki na oś (${takty} taktów, potrzeba ${MIN_TAKTOW}).`);
        const prompt = promptKomponowania({ opis: prosba, bpm: b, takty, styl: tekst(styl, 60), utwor: u, glosnosc });
        let odp = await pisz({ system: SYSTEM_KOMPOZYTORA, prompt });
        let o;
        try { o = odczytajOs(odp.tekst, { takty, bpm: b }); } catch (e) {
            // jedna poprawka: model dostaje swój błąd wprost
            odp = await pisz({ system: SYSTEM_KOMPOZYTORA, prompt: `${prompt}\n\nTwoja poprzednia odpowiedź była zła: ${e.message} ${PRZYPOMNIENIE} Popraw i oddaj sam JSON.` });
            o = odczytajOs(odp.tekst, { takty, bpm: b });   // drugi raz zły = błąd wprost
        }
        const id = `o-${crypto.randomBytes(4).toString('hex')}`;
        const { pominiete, ...czysta } = o;
        const wpis = { id, utworzono: teraz().toISOString(), stan: 'propozycja', prosba, styl: tekst(styl, 60), utwor: u, model: odp.model ?? null, prosbaModelu: prompt, ...czysta, pominieteMarkery: pominiete, odModelu: tresc(czysta), poprawiona: false, zamowienie: null };
        await zapiszOs(wpis);
        void szyna?.nadaj?.({ agent: 'JaJo Kompozytor', rodzaj: 'praca', tresc: `🏛️⚡ ułożyłem „${wpis.tytul}” — ${takty} taktów, ${o.sekcje.length} sekcji` })?.catch?.(() => {});
        return wpis;
    }

    /** Poprawka Suwerena: nowa oś sprawdzona tak samo → para „model → Suweren”. */
    async function popraw(id, nowa = {}) {
        const o = await os(id);
        const c = oczyscOs({ ...tresc(o), ...nowa, takty: o.takty }, { takty: o.takty, bpm: nowa.bpm ?? o.bpm });
        const { pominiete, ...czysta } = c;
        const przed = tresc(o);
        if (JSON.stringify(przed) === JSON.stringify(tresc(czysta))) return { os: o, zmiana: false };
        Object.assign(o, czysta, { poprawiona: true, zmieniono: teraz().toISOString(), pominieteMarkery: pominiete });
        await zapiszOs(o);
        const obs = await obserwuj({ rodzaj: 'poprawka', os: id, tytul: o.tytul, prosba: o.prosbaModelu, przed: JSON.stringify(przed), po: JSON.stringify(tresc(czysta)) });
        return { os: o, zmiana: true, obserwacja: obs.nr };
    }

    async function decyzja(id, werdykt) {
        if (!['przyjmij', 'odrzuc'].includes(werdykt)) throw new Error('Werdykt: przyjmij albo odrzuć.');
        const o = await os(id);
        o.stan = werdykt === 'przyjmij' ? 'przyjeta' : 'odrzucona';
        o.decyzja = teraz().toISOString();
        await zapiszOs(o);
        await obserwuj({ rodzaj: 'decyzja', os: id, tytul: o.tytul, werdykt, poprawiona: !!o.poprawiona });
        return o;
    }

    async function usun(id) { await fs.rm(plikOsi(id), { force: true }); return true; }

    /** Zamówienie utworu u Joanny z promptem Kompozytora (Bazylika Dźwięku). */
    async function zamow(id) {
        if (!bazylika) throw new Error('Bazylika Dźwięku nie jest podpięta.');
        const o = await os(id);
        if (o.stan === 'odrzucona') throw new Error('Ta oś jest odrzucona — ułóż nową albo popraw ją.');
        const sekundy = Math.round(Math.min(240, Math.max(20, o.takty * 4 * 60 / o.bpm)));
        const z = await bazylika.zamow({ opis: `Kompozytor: ${o.tytul}${o.opis ? ` — ${o.opis}` : ''}`.slice(0, 400), bpm: o.bpm, sekundy, styl: o.styl || 'electro-organ', prompt: o.prompt, os: id });
        o.zamowienie = { id: z.id, kiedy: z.utworzono };
        await zapiszOs(o);
        return { os: o, zamowienie: z };
    }

    /** Utwór zamówiony dla osi (gdy Joanna skończyła) — dopisywany do osi przy odczycie. */
    async function zUtworem(o) {
        if (o.utwor || !o.zamowienie || !bazylika) return o;
        const z = (await bazylika.zamowienia()).find((x) => x.id === o.zamowienie.id);
        if (z) o.zamowienie = { ...o.zamowienie, stan: z.stan, blad: z.blad ?? null };
        if (z?.stan === 'gotowe' && z.plik) {
            o.utwor = { plik: z.plik, tytul: tytulUtworu(z.plik), zZamowienia: true };
            await zapiszOs(o);
        }
        return o;
    }

    /** Oś dla utworu z biblioteki: najpierw przyjęta, potem najnowsza; bez osi = null. */
    async function dla(plik) {
        const p = String(plik ?? '');
        const lista = [];
        for (const o of await osie()) { const z = await zUtworem(o); if (z.utwor?.plik === p && z.stan !== 'odrzucona') lista.push(z); }
        return lista.find((o) => o.stan === 'przyjeta') ?? lista[0] ?? null;
    }

    function etap(punkty) {
        const e = [...ETAPY].reverse().find((x) => punkty >= x.od) ?? ETAPY[0];
        const nast = ETAPY.find((x) => x.od > punkty);
        return { ...e, punkty, nastepny: nast ? { nazwa: nast.nazwa, od: nast.od, brakuje: nast.od - punkty } : null };
    }

    async function stan() {
        const w = await obserwacje();
        const poprawki = w.filter((o) => o.rodzaj === 'poprawka').length, decyzje = w.filter((o) => o.rodzaj === 'decyzja').length;
        const l = await Promise.all((await osie()).map(zUtworem));
        return {
            obserwacji: w.length, poprawki, decyzje, etap: etap(2 * poprawki + decyzje),
            osie: l.map((o) => ({ id: o.id, tytul: o.tytul, opis: o.opis, bpm: o.bpm, takty: o.takty, stan: o.stan, poprawiona: !!o.poprawiona, utwor: o.utwor, zamowienie: o.zamowienie, sekcje: o.sekcje, markery: o.markery, prompt: o.prompt, utworzono: o.utworzono, model: o.model })),
            ostatnie: w.slice(-8).reverse(),
        };
    }

    /** Dane do Kuźni Soup: pary DPO (chosen = oś Suwerena, rejected = oś modelu) + SFT z przyjętych osi. */
    async function kurs({ zapisz = true } = {}) {
        const w = await obserwacje();
        const pary = w.filter((o) => o.rodzaj === 'poprawka').map((o) => ({ prompt: `${SYSTEM_KOMPOZYTORA}\n\n${o.prosba ?? ''}`, chosen: o.po, rejected: o.przed }));
        const sft = (await osie()).filter((o) => o.stan === 'przyjeta').map((o) => ({ messages: [{ role: 'system', content: SYSTEM_KOMPOZYTORA }, { role: 'user', content: o.prosbaModelu ?? '' }, { role: 'assistant', content: JSON.stringify(tresc(o)) }] }));
        let gdzie = null;
        if (zapisz && katalogKuzni && (pary.length || sft.length)) {
            gdzie = path.join(katalogKuzni, 'kompozytor');
            await fs.mkdir(gdzie, { recursive: true });
            await fs.writeFile(path.join(gdzie, 'pary-kompozytora.jsonl'), pary.map((p) => JSON.stringify(p)).join('\n') + (pary.length ? '\n' : ''));
            await fs.writeFile(path.join(gdzie, 'sft-kompozytora.jsonl'), sft.map((p) => JSON.stringify(p)).join('\n') + (sft.length ? '\n' : ''));
        }
        return { pary: pary.length, sft: sft.length, katalog: gdzie };
    }

    return { komponuj, popraw, decyzja, usun, zamow, os: async (id) => zUtworem(await os(id)), osie, dla, stan, kurs };
}

/** Trasy Kompozytora (montowane z mostu; Straż: `/api/kompozytor` tylko przy maszynie). */
export function zamontujTrasyKompozytora(app, { kompozytor }) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(/Nie ma takiej/.test(e.message) ? 404 : kod).json({ success: false, message: e.message }));
    app.get('/api/kompozytor', (_req, res) => odp(res, kompozytor.stan(), 500));
    app.post('/api/kompozytor/komponuj', (req, res) => odp(res, kompozytor.komponuj(req.body ?? {}).then((os) => ({ os }))));
    app.get('/api/kompozytor/dla', (req, res) => odp(res, kompozytor.dla(req.query.plik).then((os) => ({ os }))));
    app.post('/api/kompozytor/kurs', (_req, res) => odp(res, kompozytor.kurs()));
    app.get('/api/kompozytor/os/:id', (req, res) => odp(res, kompozytor.os(req.params.id).then((os) => ({ os }))));
    app.put('/api/kompozytor/os/:id', (req, res) => odp(res, kompozytor.popraw(req.params.id, req.body ?? {})));
    app.post('/api/kompozytor/os/:id/przyjmij', (req, res) => odp(res, kompozytor.decyzja(req.params.id, 'przyjmij').then((os) => ({ os }))));
    app.post('/api/kompozytor/os/:id/odrzuc', (req, res) => odp(res, kompozytor.decyzja(req.params.id, 'odrzuc').then((os) => ({ os }))));
    app.post('/api/kompozytor/os/:id/zamow', (req, res) => odp(res, kompozytor.zamow(req.params.id)));
    app.delete('/api/kompozytor/os/:id', (req, res) => odp(res, kompozytor.usun(req.params.id).then((usunieta) => ({ usunieta }))));
    return kompozytor;
}

export default { utworzKompozytora, zamontujTrasyKompozytora, oczyscOs, odczytajOs, typSekcji, taktyZCzasu, profilGlosnosci, SEKCJE, SCENY_LED, MARKERY };
