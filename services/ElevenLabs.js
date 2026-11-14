/**
 * 🎙️ ElevenLabs w Katedrze — Voice Cast 0.00G, wieczny cache na dysku, efekty tła (Suweren 2026-11-14).
 *
 * Klucz: Skarbiec 0.00G (`elevenlabs.api_key`), czytany przy każdym użyciu, nigdy do przeglądarki.
 *
 * ZERO UTRATY KREDYTÓW:
 *  • każdy fragment mowy leży na dysku jako `<katalog miejsca>/voices/<sha1(model|głos|tekst)>.mp3`; plik jest = 0 kredytów,
 *    nic nie idzie do ElevenLabs. Ten sam tekst tym samym głosem i modelem NIGDY nie liczy się drugi raz (także gdy dwa
 *    żądania przyjdą naraz — drugie czeka na pierwsze).
 *  • generowanie wymaga `zgoda: true` w żądaniu (przycisk z wyceną w interfejsie). Bez zgody most oddaje wycenę i odmawia
 *    (`BEZ_ZGODY`) — żaden agent ani odświeżenie strony nie wyda kredytów po cichu.
 *  • wycena = znaki fragmentów, których NIE ma w archiwum (≈ 1 kredyt za znak w multilingual_v2 / v3; turbo i flash taniej).
 *    Prawdziwy koszt ElevenLabs podaje w nagłówku `character-cost` — zapisujemy go w dzienniku zużycia.
 *
 * OBSADA (role → głos): kronikarz, elara, kael, postac1–4, szept. Domyślne głosy to głosy biblioteki ElevenLabs
 * (dostępność każdego sprawdzona tym kluczem 2026-11-14 bez kosztu); dobór „na papierze” z opisów — Suweren zmienia w panelu.
 * Klucz Suwerena nie ma dziś uprawnień `voices_read` / `user_read`, więc listy głosów konta i salda nie widać, dopóki
 * ich nie włączy; mowa i efekty działają.
 *
 * ROLE W TEKŚCIE: księga ze strukturą (narracja + kwestie z mówcą) — każdy mówca dostaje swój głos (Elara i Kael po imieniu,
 * reszta po kolei postac1–4, zapamiętane w `obsada.json` miejsca). Tekst bez struktury — `rozdzielRole`: cytaty i linie
 * dialogowe od myślnika idą głosami postaci na zmianę, reszta Kronikarzem. To heurystyka — nie wie, KTO mówi.
 *
 * EFEKTY TŁA: `POST /v1/sound-generation` (0,5–30 s, `loop`) → `voices/fx-<sha1>.mp3`, ten sam cache i ta sama zgoda.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const API = 'https://api.elevenlabs.io';
export const GLOSY_BIBLIOTEKI = [
    { id: 'JBFqnCBsd6RMkjVDRZzb', nazwa: 'George', plec: 'm', opis: 'ciepły, dojrzały narrator (brytyjski)' },
    { id: 'nPczCjzI2devNBz1zQrb', nazwa: 'Brian', plec: 'm', opis: 'głęboki, niski, spokojny' },
    { id: 'onwK4e9ZLuTAKqWW03F9', nazwa: 'Daniel', plec: 'm', opis: 'stanowczy, lektorski (brytyjski)' },
    { id: 'pqHfZKP75CvOlQylNhV4', nazwa: 'Bill', plec: 'm', opis: 'starszy, mądry' },
    { id: 'pNInz6obpgDQGcFmaJgB', nazwa: 'Adam', plec: 'm', opis: 'mocny, pewny' },
    { id: 'N2lVS1w4EtoT3dr4eOWO', nazwa: 'Callum', plec: 'm', opis: 'chropawy, intensywny' },
    { id: 'cjVigY5qzO86Huf0OWal', nazwa: 'Eric', plec: 'm', opis: 'gładki, przyjazny' },
    { id: 'iP95p4xoKVk53GoZ742B', nazwa: 'Chris', plec: 'm', opis: 'swobodny, naturalny' },
    { id: 'bIHbv24MWmeRgasZH58o', nazwa: 'Will', plec: 'm', opis: 'młody, luźny' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', nazwa: 'Liam', plec: 'm', opis: 'młody, energiczny' },
    { id: 'CwhRBWXzGAHq8TQ4Fs17', nazwa: 'Roger', plec: 'm', opis: 'niski, rozluźniony' },
    { id: 'XB0fDUnXU5powFXDhCwa', nazwa: 'Charlotte', plec: 'k', opis: 'zmysłowy, ciepły' },
    { id: 'EXAVITQu4vr4xnSDxMaL', nazwa: 'Sarah', plec: 'k', opis: 'miękki, spokojny' },
    { id: 'pFZP5JQG7iQjIQuC4Bku', nazwa: 'Lily', plec: 'k', opis: 'aksamitny (brytyjski)' },
    { id: 'Xb7hH8MSUJpSbSDYk0k2', nazwa: 'Alice', plec: 'k', opis: 'wyraźny, pewny (brytyjski)' },
    { id: 'cgSgspJ2msm6clMCkdW9', nazwa: 'Jessica', plec: 'k', opis: 'młody, ekspresyjny' },
    { id: 'FGY2WhTYpPnrIDTdsKH5', nazwa: 'Laura', plec: 'k', opis: 'młody, żywy' },
    { id: '21m00Tcm4TlvDq8ikWAM', nazwa: 'Rachel', plec: 'k', opis: 'spokojny, lektorski' },
    { id: 'SAz9YHcvj6GT2YYXdXww', nazwa: 'River', plec: 'n', opis: 'neutralny, cichy' },
];
export const ROLE = {
    kronikarz: { nazwa: 'Narrator / Kronikarz (Der Chronist)', opis: 'głęboki, spokojny, filmowy głos opowieści', domyslny: 'JBFqnCBsd6RMkjVDRZzb' },
    elara: { nazwa: 'Elara', opis: 'ciepły, zmysłowy głos żeński — wersy i prologi Opodysków', domyslny: 'XB0fDUnXU5powFXDhCwa' },
    kael: { nazwa: 'Kael', opis: 'niski, ciepły głos męski', domyslny: 'nPczCjzI2devNBz1zQrb' },
    postac1: { nazwa: 'Postać 1', opis: 'pierwszy mówca dialogu', domyslny: 'cgSgspJ2msm6clMCkdW9' },
    postac2: { nazwa: 'Postać 2', opis: 'drugi mówca dialogu', domyslny: 'TX3LPaxmHKxFdv7VOQHJ' },
    postac3: { nazwa: 'Postać 3', opis: 'trzeci mówca dialogu', domyslny: 'pFZP5JQG7iQjIQuC4Bku' },
    postac4: { nazwa: 'Postać 4', opis: 'czwarty mówca dialogu', domyslny: 'onwK4e9ZLuTAKqWW03F9' },
    szept: { nazwa: 'Szept', opis: 'cichy głos w tle sceny', domyslny: 'SAz9YHcvj6GT2YYXdXww' },
};
const POSTACIE = ['postac1', 'postac2', 'postac3', 'postac4'];
/** `mnoznik` = kredyty za znak wg cennika ElevenLabs znanego autorowi (do wyceny; prawda jest w nagłówku `character-cost`). */
export const MODELE = {
    eleven_multilingual_v2: { nazwa: 'Multilingual v2 (stabilny, PL/EN/DE)', mnoznik: 1 },
    eleven_v3: { nazwa: 'Eleven v3 (najbardziej ekspresyjny)', mnoznik: 1 },
    eleven_turbo_v2_5: { nazwa: 'Turbo v2.5 (szybki, tańszy)', mnoznik: 0.5 },
    eleven_flash_v2_5: { nazwa: 'Flash v2.5 (najszybszy, tańszy)', mnoznik: 0.5 },
};
export const MODEL_DOMYSLNY = 'eleven_multilingual_v2';
export const MAX_KAWALKA = 2500, MAX_TEKSTU = 20000, MAX_EFEKTU_S = 30;
/** Efekty tła: kredyty za sekundę wg cennika znanego autorowi — NIEpotwierdzone w dokumentacji API; prawdziwy koszt z nagłówka. */
export const KREDYTY_ZA_SEKUNDE_EFEKTU = 40;

const blad = (m, kod = null, status = 400, dodatki = {}) => Object.assign(new Error(m), { kod, status, ...dodatki });
const czysc = (t) => String(t ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const sha = (t) => crypto.createHash('sha1').update(t).digest('hex');
const jest = (p) => fs.stat(p).then((s) => s.size > 200, () => false);
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Skrót nagrania: ten sam model + głos + tekst = ten sam plik (bez względu na miejsce i czas). */
export const skrotMowy = ({ tekst, glos, model }) => sha(`${model}|${glos}|${czysc(tekst)}`).slice(0, 24);

/** Długi tekst → kawałki ≤ `max` znaków, cięte na granicy zdania (każdy kawałek ma własny plik w archiwum). */
export function kawalki(tekst, max = MAX_KAWALKA) {
    const t = czysc(tekst), w = [];
    if (t.length <= max) return t ? [t] : [];
    let akt = '';
    for (const z of t.split(/(?<=[.!?…»”"])\s+/)) {
        if (akt && akt.length + z.length + 1 > max) { w.push(akt); akt = ''; }
        if (z.length > max) { for (let i = 0; i < z.length; i += max) w.push(z.slice(i, i + max)); continue; }
        akt = akt ? `${akt} ${z}` : z;
    }
    if (akt) w.push(akt);
    return w;
}

/**
 * Tekst bez struktury → segmenty {rola, tekst}. Cytaty („…”, "…", «…») i linie od myślnika = mowa postaci (postac1/postac2
 * na zmianę z każdym nowym akapitem mowy), słowo „szept” / whisper / flüster w akapicie = rola `szept`, reszta = Kronikarz.
 */
export function rozdzielRole(tekst) {
    const seg = [], dodaj = (rola, t) => { const x = czysc(t).replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/g, '').trim(); if (x.length < 2) return; const o = seg.at(-1); if (o && o.rola === rola) o.tekst += ` ${x}`; else seg.push({ rola, tekst: x }); };
    let mowca = 1;
    for (const ak of czysc(tekst).split(/\n+/)) {
        const szept = /szep|whisper|fl[uü]ster/i.test(ak), glos = () => (szept ? 'szept' : POSTACIE[mowca]);
        let bylaMowa = false;
        const mysl = /^\s*[—–-]\s+(.*)$/.exec(ak);
        if (mysl) {   // — Kwestia — powiedziała. — I dalej kwestia.
            mysl[1].split(/\s+[—–]\s+/).forEach((cz, i) => dodaj(i % 2 === 0 ? glos() : 'kronikarz', cz));
            bylaMowa = true;
        } else {
            let ost = 0;
            for (const m of ak.matchAll(/[„“"«]([^„“”"«»]{2,}?)[”"»“]/g)) { dodaj('kronikarz', ak.slice(ost, m.index)); dodaj(glos(), m[1]); ost = m.index + m[0].length; bylaMowa = true; }
            dodaj('kronikarz', ak.slice(ost));
        }
        if (bylaMowa && !szept) mowca = 1 - mowca;
    }
    return seg;
}

/** Mówca księgi → rola obsady. `mapa` (nazwa → rola) jest uzupełniana o nowych mówców po kolei: postac1…postac4, potem od nowa. */
export function rolaMowcy(nazwa, mapa = {}) {
    const n = norm(nazwa);
    if (!n || /narrat|kronik|chronist|lektor|erzahl/.test(n)) return 'kronikarz';
    if (n.includes('elara')) return 'elara';
    if (n.includes('kael')) return 'kael';
    if (/szept|whisper|fluster/.test(n)) return 'szept';
    if (!mapa[n]) mapa[n] = POSTACIE[Object.keys(mapa).length % POSTACIE.length];
    return mapa[n];
}

export function utworzElevenLabs(cfg) {
    const KAT = cfg.katalog, pob = cfg.fetch ?? fetch, teraz = cfg.teraz ?? (() => Date.now());
    const plikObsady = path.join(KAT, 'obsada.json'), plikZuzycia = path.join(KAT, 'zuzycie.json');
    const json = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const pisz = async (p, o) => { await fs.mkdir(path.dirname(p), { recursive: true }); const t = `${p}.${process.pid}.tmp`; await fs.writeFile(t, JSON.stringify(o, null, 2)); await fs.rename(t, p); };
    let kolej = Promise.resolve();
    const poKolei = (fn) => { const p = kolej.then(fn, fn); kolej = p.catch(() => {}); return p; };
    const wToku = new Map();   // plik → obietnica (dwa żądania o to samo nagranie = jedno wywołanie ElevenLabs)

    const klucz = async () => { const k = String((await cfg.klucz()) ?? '').trim(); if (!k) throw blad('Brak klucza ElevenLabs w Skarbcu 0.00G (elevenlabs.api_key).', 'BRAK_KLUCZA', 424); return k; };
    async function bladApi(r) {
        let d = null; try { d = (await r.json()).detail; } catch { /* nie JSON */ }
        const m = typeof d === 'string' ? d : d?.message ?? `HTTP ${r.status}`;
        if (d?.status === 'missing_permissions') return blad(`Klucz ElevenLabs nie ma uprawnienia do tej operacji (${m}). Włącz je w ElevenLabs → API Keys → edycja klucza.`, 'BRAK_UPRAWNIEN', 403);
        if (d?.status === 'quota_exceeded' || r.status === 429) return blad(`ElevenLabs: brak kredytów albo limit zapytań (${m}). Nic nie zostało wygenerowane.`, 'LIMIT', 429);
        if (r.status === 401) return blad('ElevenLabs odrzuciło klucz (401). Sprawdź elevenlabs.api_key w Skarbcu 0.00G.', 'ZLY_KLUCZ', 401);
        if (d?.status === 'voice_not_found') return blad(`ElevenLabs nie zna tego głosu (${m}).`, 'ZLY_GLOS', 404);
        return blad(`ElevenLabs odmówiło: ${String(m).slice(0, 300)}`, 'ELEVENLABS', 502);
    }
    const wyslij = async (sciezka, cialo) => {
        let r;
        try { r = await pob(`${API}${sciezka}`, { method: 'POST', headers: { 'xi-api-key': await klucz(), 'Content-Type': 'application/json' }, body: JSON.stringify(cialo), signal: AbortSignal.timeout(180_000) }); }
        catch (e) { if (e.kod) throw e; throw blad(`ElevenLabs nie odpowiedziało (${e.name === 'TimeoutError' ? 'przekroczony czas' : e.message}). Nic nie zostało zapisane.`, 'SIEC', 504); }
        if (!r.ok) throw await bladApi(r);
        return r;
    };

    // ── obsada i model ──
    async function ustawienia() {
        const d = await json(plikObsady, {}), obsada = {};
        for (const [rola, o] of Object.entries(ROLE)) {
            const w = d.obsada?.[rola], dom = GLOSY_BIBLIOTEKI.find((g) => g.id === o.domyslny);
            obsada[rola] = w?.id ? { id: w.id, nazwa: w.nazwa || w.id, wlasny: true } : { id: dom.id, nazwa: dom.nazwa, wlasny: false };
        }
        return { obsada, model: MODELE[d.model] ? d.model : MODEL_DOMYSLNY };
    }
    /** Czy głos istnieje dla tego klucza — BEZ kosztu: żądanie z celowo nieistniejącym modelem odpada przed syntezą. */
    async function sprawdzGlos(id) {
        if (!/^[A-Za-z0-9]{10,40}$/.test(String(id))) throw blad('ID głosu ElevenLabs to 20 liter i cyfr (z adresu albo karty głosu).', 'ZLY_GLOS');
        const r = await pob(`${API}/v1/text-to-speech/${id}`, { method: 'POST', headers: { 'xi-api-key': await klucz(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x', model_id: 'katedra_sprawdza_glos' }), signal: AbortSignal.timeout(30_000) });
        if (r.ok) { await r.arrayBuffer().catch(() => {}); return true; }   // nie powinno się zdarzyć (model nie istnieje)
        const d = await r.json().then((x) => x.detail, () => null);
        if (d?.status === 'model_not_found') return true;
        if (d?.status === 'voice_not_found') throw blad('ElevenLabs nie zna głosu o tym ID (dla tego klucza).', 'ZLY_GLOS', 404);
        throw await bladApi({ status: r.status, json: async () => ({ detail: d }) });
    }
    const ustaw = (z = {}) => poKolei(async () => {
        const d = await json(plikObsady, {});
        if (z.model !== undefined) { if (!MODELE[z.model]) throw blad(`Nieznany model. Do wyboru: ${Object.keys(MODELE).join(', ')}.`); d.model = z.model; }
        if (z.rola !== undefined) {
            if (!ROLE[z.rola]) throw blad(`Nieznana rola. Role: ${Object.keys(ROLE).join(', ')}.`);
            d.obsada = d.obsada ?? {};
            if (!z.glos?.id) delete d.obsada[z.rola];   // powrót do głosu domyślnego
            else { await sprawdzGlos(z.glos.id); d.obsada[z.rola] = { id: String(z.glos.id), nazwa: String(z.glos.nazwa ?? GLOSY_BIBLIOTEKI.find((g) => g.id === z.glos.id)?.nazwa ?? z.glos.id).slice(0, 60) }; }
        }
        await pisz(plikObsady, d);
        return ustawienia();
    });

    // ── miejsca (katalog `voices` księgi / stacji) ──
    async function katalogMiejsca(m) {
        const rodzaj = String(m?.rodzaj ?? ''), id = String(m?.id ?? '');
        if (rodzaj === 'ksiega') { const s = norm(id).slice(0, 60); if (!s) throw blad('Księga potrzebuje nazwy.'); return path.join(KAT, 'ksiegi', s, 'voices'); }
        const f = cfg.miejsca?.[rodzaj];
        if (!f) throw blad(`Nieznane miejsce nagrania („${rodzaj}”). Miejsca: ksiega${Object.keys(cfg.miejsca ?? {}).map((x) => `, ${x}`).join('')}.`);
        return f(id);
    }
    const plik = async (m, nazwa) => (/^[a-z0-9-]{8,60}\.mp3$/.test(String(nazwa)) ? path.join(await katalogMiejsca(m), nazwa) : null);

    // ── plan: tekst → fragmenty z głosem i plikiem w archiwum ──
    async function plan({ miejsce, tekst, rola = 'kronikarz', segmenty = null, model = null }) {
        const u = await ustawienia(), mdl = MODELE[model] ? model : u.model, kat = await katalogMiejsca(miejsce);
        let seg;
        if (Array.isArray(segmenty) && segmenty.length) {
            const pm = path.join(kat, 'obsada.json'), mapa = await json(pm, {}), przed = JSON.stringify(mapa);
            seg = segmenty.map((s) => ({ rola: ROLE[s?.rola] ? s.rola : rolaMowcy(s?.postac, mapa), postac: s?.postac ?? null, tekst: czysc(s?.tekst) })).filter((s) => s.tekst.length >= 2);
            if (JSON.stringify(mapa) !== przed) await pisz(pm, mapa);   // ten sam mówca = ten sam głos w całej księdze
        } else seg = rola === 'auto' ? rozdzielRole(tekst) : [{ rola: ROLE[rola] ? rola : 'kronikarz', tekst: czysc(tekst) }];
        seg = seg.filter((s) => s.tekst.length >= 2);
        if (!seg.length) throw blad('Nie ma tekstu do udźwiękowienia.');
        if (seg.reduce((n, s) => n + s.tekst.length, 0) > MAX_TEKSTU) throw blad(`Za długi tekst na jedno nagranie (limit ${MAX_TEKSTU} znaków) — podziel na sceny.`);
        const fragmenty = [];
        for (const s of seg) for (const t of kawalki(s.tekst)) {
            const glos = u.obsada[s.rola], nazwa = `${skrotMowy({ tekst: t, glos: glos.id, model: mdl })}.mp3`, p = path.join(kat, nazwa);
            fragmenty.push({ rola: s.rola, postac: s.postac ?? null, glos: glos.id, glosNazwa: glos.nazwa, tekst: t, znakow: t.length, nazwa, plik: p, wArchiwum: await jest(p) });
        }
        const brak = fragmenty.filter((f) => !f.wArchiwum), znakow = brak.reduce((n, f) => n + f.znakow, 0);
        const nazwa = fragmenty.length === 1 ? fragmenty[0].nazwa : `scena-${sha(fragmenty.map((f) => f.nazwa).join('|')).slice(0, 20)}.mp3`;
        return { kat, model: mdl, fragmenty, nazwa, plik: path.join(kat, nazwa),
            wycena: { znakow, kredytow: Math.ceil(znakow * MODELE[mdl].mnoznik), fragmentow: fragmenty.length, doNagrania: brak.length, wArchiwum: brak.length === 0, model: mdl,
                glosy: [...new Set(fragmenty.map((f) => `${ROLE[f.rola].nazwa.split(' (')[0]}: ${f.glosNazwa}`))] } };
    }
    const wycena = async (z) => (await plan(z)).wycena;

    async function zanotuj(wpis) {
        return poKolei(async () => {
            const d = await json(plikZuzycia, { znakow: 0, kredytowZNaglowka: 0, wywolan: 0, sekundEfektow: 0, ostatnie: [] });
            d.znakow += wpis.znakow ?? 0; d.kredytowZNaglowka += wpis.koszt ?? 0; d.wywolan += 1; d.sekundEfektow += wpis.sekundy ?? 0;
            d.ostatnie = [{ kiedy: new Date(teraz()).toISOString(), ...wpis }, ...(d.ostatnie ?? [])].slice(0, 60);
            await pisz(plikZuzycia, d);
        });
    }
    /** Jedno nagranie fragmentu — z archiwum albo (raz) z ElevenLabs. */
    function nagraj(f, model, miejsce) {
        if (wToku.has(f.plik)) return wToku.get(f.plik);
        const p = (async () => {
            if (await jest(f.plik)) return { zArchiwum: true };
            const r = await wyslij(`/v1/text-to-speech/${f.glos}?output_format=mp3_44100_128`, { text: f.tekst, model_id: model });
            const buf = Buffer.from(await r.arrayBuffer());
            if (buf.length < 400) throw blad('ElevenLabs oddało puste nagranie — nic nie zapisuję.', 'PUSTE', 502);
            await fs.mkdir(path.dirname(f.plik), { recursive: true });
            const tmp = `${f.plik}.${process.pid}.tmp`; await fs.writeFile(tmp, buf); await fs.rename(tmp, f.plik);
            const koszt = Number(r.headers.get('character-cost')) || null;
            await zanotuj({ rodzaj: 'mowa', miejsce: `${miejsce?.rodzaj}:${miejsce?.id}`, rola: f.rola, glos: f.glosNazwa, model, znakow: f.znakow, koszt, plik: f.nazwa });
            return { zArchiwum: false, koszt };
        })().finally(() => wToku.delete(f.plik));
        wToku.set(f.plik, p);
        return p;
    }
    /** Mowa: wszystko z archiwum = 0 kredytów i bez pytania; cokolwiek do nagrania wymaga `zgoda: true`. */
    async function mow(z = {}) {
        const pl = await plan(z);
        if (!pl.wycena.wArchiwum && z.zgoda !== true) throw blad(`To nagranie nie leży jeszcze w archiwum: ${pl.wycena.znakow} znaków ≈ ${pl.wycena.kredytow} kredytów ElevenLabs. Potrzebna zgoda Suwerena (przycisk z wyceną).`, 'BEZ_ZGODY', 402, { wycena: pl.wycena });
        let nagrano = 0, koszt = 0, znakow = 0;
        for (const f of pl.fragmenty) { const w = await nagraj(f, pl.model, z.miejsce); if (!w.zArchiwum) { nagrano += 1; znakow += f.znakow; koszt += w.koszt ?? 0; } }
        if (pl.fragmenty.length > 1 && !(await jest(pl.plik))) {   // scena wielogłosowa = fragmenty sklejone lokalnie (ffmpeg, 0 kredytów)
            if (!cfg.ffmpeg || !cfg.uruchom) throw blad('Most nie ma ffmpeg — fragmenty są w archiwum, ale nie skleję sceny.', 'BEZ_FFMPEG', 500);
            const arg = ['-hide_banner', '-loglevel', 'error', '-y'];
            pl.fragmenty.forEach((f) => arg.push('-i', f.plik));
            const tmp = path.join(pl.kat, `.${pl.nazwa}.tmp.mp3`);
            arg.push('-filter_complex', `${pl.fragmenty.map((_, i) => `[${i}:a]aresample=44100,apad=pad_dur=0.28[a${i}]`).join(';')};${pl.fragmenty.map((_, i) => `[a${i}]`).join('')}concat=n=${pl.fragmenty.length}:v=0:a=1[o]`, '-map', '[o]', '-c:a', 'libmp3lame', '-b:a', '128k', tmp);
            await cfg.uruchom(cfg.ffmpeg, arg, { windowsHide: true, timeout: 5 * 60_000, maxBuffer: 1 << 24 });
            await fs.rename(tmp, pl.plik);
        }
        return { plik: pl.plik, nazwa: pl.nazwa, zArchiwum: nagrano === 0, nagrano, znakow, koszt: koszt || null, model: pl.model,
            fragmenty: pl.fragmenty.map((f) => ({ rola: f.rola, postac: f.postac, glos: f.glosNazwa, znakow: f.znakow, nazwa: f.nazwa })), glosy: pl.wycena.glosy };
    }

    // ── efekty tła (Sound Effects) ──
    async function planEfektu({ miejsce, opis, sekundy = 10, petla = true }) {
        const o = czysc(opis).slice(0, 450), s = Math.round(Math.min(MAX_EFEKTU_S, Math.max(0.5, Number(sekundy) || 10)) * 10) / 10;
        if (o.length < 5) throw blad('Opisz dźwięk tła (po angielsku działa najlepiej), np. „night rain against a diner window, distant thunder”.');
        const kat = await katalogMiejsca(miejsce), nazwa = `fx-${sha(`${o}|${s}|${petla ? 1 : 0}`).slice(0, 20)}.mp3`, p = path.join(kat, nazwa), wArchiwum = await jest(p);
        return { kat, opis: o, sekundy: s, petla: !!petla, nazwa, plik: p, wycena: { wArchiwum, sekundy: s, kredytow: wArchiwum ? 0 : Math.ceil(s * KREDYTY_ZA_SEKUNDE_EFEKTU), szacunek: 'cennik efektów nie jest w dokumentacji API — prawdziwy koszt zapiszę z odpowiedzi ElevenLabs' } };
    }
    const wycenaEfektu = async (z) => (await planEfektu(z)).wycena;
    async function efekt(z = {}) {
        const pl = await planEfektu(z);
        if (!pl.wycena.wArchiwum) {
            if (z.zgoda !== true) throw blad(`Ten efekt nie leży jeszcze w archiwum: ${pl.sekundy} s ≈ ${pl.wycena.kredytow} kredytów (szacunek). Potrzebna zgoda Suwerena.`, 'BEZ_ZGODY', 402, { wycena: pl.wycena });
            if (!wToku.has(pl.plik)) wToku.set(pl.plik, (async () => {
                const r = await wyslij('/v1/sound-generation?output_format=mp3_44100_128', { text: pl.opis, duration_seconds: pl.sekundy, loop: pl.petla, prompt_influence: 0.3 });
                const buf = Buffer.from(await r.arrayBuffer());
                if (buf.length < 400) throw blad('ElevenLabs oddało pusty efekt — nic nie zapisuję.', 'PUSTE', 502);
                await fs.mkdir(pl.kat, { recursive: true });
                const tmp = `${pl.plik}.${process.pid}.tmp`; await fs.writeFile(tmp, buf); await fs.rename(tmp, pl.plik);
                const koszt = Number(r.headers.get('character-cost')) || null;
                await zanotuj({ rodzaj: 'efekt', miejsce: `${z.miejsce?.rodzaj}:${z.miejsce?.id}`, opis: pl.opis.slice(0, 80), sekundy: pl.sekundy, koszt, plik: pl.nazwa });
                return koszt;
            })().finally(() => wToku.delete(pl.plik)));
            const koszt = await wToku.get(pl.plik);
            return { plik: pl.plik, nazwa: pl.nazwa, zArchiwum: false, opis: pl.opis, sekundy: pl.sekundy, petla: pl.petla, koszt };
        }
        return { plik: pl.plik, nazwa: pl.nazwa, zArchiwum: true, opis: pl.opis, sekundy: pl.sekundy, petla: pl.petla, koszt: null };
    }

    // ── stan dla panelu ──
    let konto = { kiedy: 0, saldo: null, glosyKonta: null, uwagi: [] };
    async function stan() {
        const k = String((await cfg.klucz().catch(() => null)) ?? '').trim(), u = await ustawienia();
        const wspolne = { role: Object.fromEntries(Object.entries(ROLE).map(([r, o]) => [r, { nazwa: o.nazwa, opis: o.opis }])), obsada: u.obsada, model: u.model, modele: MODELE, glosyBiblioteki: GLOSY_BIBLIOTEKI,
            zuzycie: await json(plikZuzycia, { znakow: 0, kredytowZNaglowka: 0, wywolan: 0, sekundEfektow: 0, ostatnie: [] }) };
        if (!k) return { polaczony: false, powod: 'Brak klucza ElevenLabs w Skarbcu 0.00G (elevenlabs.api_key).', saldo: null, glosyKonta: null, uwagi: [], ...wspolne };
        if (teraz() - konto.kiedy > 5 * 60_000) {   // saldo i głosy konta — tylko gdy klucz ma te uprawnienia (odczyt, 0 kredytów)
            const uwagi = [], czytaj = async (s) => { try { const r = await pob(`${API}${s}`, { headers: { 'xi-api-key': k }, signal: AbortSignal.timeout(15_000) }); return r.ok ? await r.json() : null; } catch { return null; } };
            const sub = await czytaj('/v1/user/subscription'), gl = await czytaj('/v1/voices');
            if (!sub) uwagi.push('Klucz nie ma uprawnienia „User → Read”, więc nie widzę salda kredytów — sprawdzaj je w ElevenLabs albo włącz to uprawnienie.');
            if (!gl) uwagi.push('Klucz nie ma uprawnienia „Voices → Read”, więc nie widzę głosów Twojego konta (klonów, zapisanych z biblioteki). Do wyboru są głosy biblioteki sprawdzone tym kluczem; własny głos podasz po ID.');
            konto = { kiedy: teraz(), saldo: sub ? { zuzyte: sub.character_count ?? null, limit: sub.character_limit ?? null, plan: sub.tier ?? null } : null,
                glosyKonta: gl ? (gl.voices ?? []).map((v) => ({ id: v.voice_id, nazwa: v.name, kategoria: v.category ?? null, opis: [v.labels?.gender, v.labels?.age, v.labels?.accent, v.labels?.descriptive].filter(Boolean).join(', ') })) : null, uwagi };
        }
        return { polaczony: true, saldo: konto.saldo, glosyKonta: konto.glosyKonta, uwagi: konto.uwagi, ...wspolne };
    }

    return { stan, ustaw, sprawdzGlos, plan, wycena, mow, wycenaEfektu, efekt, plik, katalogMiejsca, ustawienia };
}

/**
 * Trasy (Straż `/api/elevenlabs`: tylko maszyna). `poMowie` / `poEfekcie` z mostu dopinają nagranie do celu
 * (`cel: {scena}` Opodysku, `cel: {wpis}` Żywej Księgi, `cel: {atmosfera: true}`) i mogą dołożyć pola do odpowiedzi.
 */
export function zamontujTrasyElevenLabs(app, E, { poMowie = null, poEfekcie = null } = {}) {
    const zle = (res, e) => res.status(e.status && e.status >= 400 ? e.status : 400).json({ success: false, message: e.message, kod: e.kod ?? null, ...(e.wycena ? { wycena: e.wycena } : {}) });
    const adres = (m, nazwa) => `/api/elevenlabs/plik/${encodeURIComponent(m.rodzaj)}/${encodeURIComponent(m.id)}/${nazwa}`;
    app.get('/api/elevenlabs', async (_req, res) => { try { res.json({ success: true, ...(await E.stan()) }); } catch (e) { zle(res, e); } });
    app.put('/api/elevenlabs/obsada', async (req, res) => { try { res.json({ success: true, ...(await E.ustaw(req.body ?? {})) }); } catch (e) { zle(res, e); } });
    app.post('/api/elevenlabs/wycena', async (req, res) => { try { const pl = await E.plan(req.body ?? {}); res.json({ success: true, wycena: pl.wycena, ...(pl.wycena.wArchiwum ? { url: adres(req.body.miejsce, pl.nazwa) } : {}) }); } catch (e) { zle(res, e); } });
    app.post('/api/elevenlabs/mow', async (req, res) => {
        try {
            const z = req.body ?? {}, w = await E.mow(z), { plik: _p, ...jawne } = w;
            const dodatki = poMowie && z.cel ? await poMowie({ miejsce: z.miejsce, cel: z.cel, wynik: w, zlecenie: z }) : null;
            res.json({ success: true, ...jawne, url: adres(z.miejsce, w.nazwa), ...(dodatki ?? {}) });
        } catch (e) { zle(res, e); }
    });
    app.post('/api/elevenlabs/efekt/wycena', async (req, res) => { try { res.json({ success: true, wycena: await E.wycenaEfektu(req.body ?? {}) }); } catch (e) { zle(res, e); } });
    app.post('/api/elevenlabs/efekt', async (req, res) => {
        try {
            const z = req.body ?? {}, w = await E.efekt(z), { plik: _p, ...jawne } = w;
            const dodatki = poEfekcie && z.cel ? await poEfekcie({ miejsce: z.miejsce, cel: z.cel, wynik: w, zlecenie: z }) : null;
            res.json({ success: true, ...jawne, url: adres(z.miejsce, w.nazwa), ...(dodatki ?? {}) });
        } catch (e) { zle(res, e); }
    });
    app.get('/api/elevenlabs/plik/:rodzaj/:id/:plik', async (req, res) => {
        try { const p = await E.plik({ rodzaj: req.params.rodzaj, id: req.params.id }, req.params.plik); return p && await fs.access(p).then(() => true, () => false) ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Nie ma takiego nagrania w archiwum.' }); }
        catch (e) { zle(res, e); }
    });
}

export default { utworzElevenLabs, zamontujTrasyElevenLabs, rozdzielRole, rolaMowcy, kawalki, skrotMowy, ROLE, MODELE, GLOSY_BIBLIOTEKI };
