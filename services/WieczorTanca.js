/**
 * 🌙 Wieczór Tańca (Suweren 2026-10-20: „jak zrobię taniec jak z Misiem, to potem auto Zebrra Sports o tym tańcu + Mame
 * Leon Show z Misiem + choreografem… i to w jedną całość”). Po nagraniu występu w Tanecznym Starciu most składa JEDEN
 * film-wieczór z trzech programów Katedry — każdy zostaje też osobnym odcinkiem z własnym ✓:
 *   1. 🎪 TeO Game Show (rusza sam po nagraniu — services/TeoGameShow.js; wyłączony = w filmie surowy występ),
 *   2. 🩰 Zebrra Sports o tym tańcu (services/ZebrraTaniec.js — prowadzący i współprowadzący z ustawień),
 *   3. 🦎 Mame Leon Show (services/MameLeonShow.js) — na kanapie TANCERZ (bryła z Assetów 3D przez Bestiariusz gry)
 *      i CHOREOGRAF (TeOgochi z ustawień, domyślnie JaJo Kompozytor); rozmowa tylko z faktów występu (`faktyKanapy`).
 * Zebrra Sports i Mame Leon nagrywa studio w przeglądarce (apka studio-zebrra, „🤖 Automat nagrywania” — bierze tylko
 * odcinki z polem `wieczor`). Gdy wszystkie części mają film, Spawacz skleja je po kolei → `produkcje/wieczor-tanca/
 * montaz/wieczor_<tancerz>_<jezyk>_<id>.mp4` → Kronikarz → ✓ w Izbie. Część z błędem = wieczór czeka z powodem;
 * „🧩 sklej bez …” (`sklej(id, {pomin})`) składa z tego, co jest. Nic nie wychodzi na YouTube bez ✓.
 * `_OtakOs_Wymiar/wieczor-tanca/w-<8 hex>/odcinek.json`, ustawienia `wieczor-tanca/ustawienia.json`.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { utworzMagazyn, bezpNazwa } from './OdcinkiStudia.js';
import { rangaOceny } from './Choreografie.js';

export const PROGRAM = 'wieczor-tanca';
export const PROJEKT = 'wieczor-tanca';
export const NAZWA = 'Wieczór Tańca';
export const CZESCI = ['gameShow', 'zebrra', 'mameLeon'];
export const NAZWY_CZESCI = { gameShow: '🎪 TeO Game Show', zebrra: '🩰 Zebrra Sports', mameLeon: '🦎 Mame Leon Show' };
export const DOMYSLNE = { auto: true, jezyk: 'en', narrator: 'zebra', wspolprowadzacy: ['lew'], choreograf: 'kompozytor' };
const ID = /^w-[0-9a-f]{8}$/;
const r100 = (x) => Math.round(Number(x) * 100);

/** Fakty występu dla kanapy Mame Leona (pole `uwagi`, ≤ 600 znaków) — tylko liczby z choreografii i osi Kompozytora. */
export function faktyKanapy(c, { os = null, choreograf = 'JaJo Kompozytor' } = {}) {
    const o = c.ocena ?? {};
    const figury = (c.ruchy ?? []).filter((r) => r.figura).map((r) => r.nazwa);
    const sekcje = os?.sekcje?.length ? [...new Set(os.sekcje.map((s) => s.nazwa || s.typ))] : [];
    return [
        `Występ: „${String(c.utwor?.tytul ?? '').slice(0, 60)}”, ${Math.round(c.utwor?.bpm ?? 0)} BPM, ocena ${o.wynik}/100 (ranga ${rangaOceny(o.wynik)}), takt ${r100(o.takt)}%, energia ${r100(o.energia)}%, różnorodność ${r100(o.roznorodnosc)}%.`,
        `Układ: ${c.frazy?.length ?? 0} fraz po ${c.fraza} uderzeń, ${new Set(c.uklad ?? []).size} różnych ruchów.`,
        figury.length ? `Figury, które ${choreograf} wymyślił z klipów tancerza: ${figury.slice(0, 4).join(', ')}.` : '',
        sekcje.length ? `${choreograf} ułożył oś utworu: ${sekcje.join(' → ')}.` : `${choreograf} jest choreografem tego występu.`,
    ].filter(Boolean).join(' ').slice(0, 600);
}

export const tematKanapy = (tancerz, utwor, jezyk) => (jezyk === 'en'
    ? `${tancerz}'s dance to “${utwor}” — the dancer and the choreographer on the couch`
    : `Taniec ${tancerz} do „${utwor}” — tancerz i choreograf na kanapie`).slice(0, 300);

/** Kontekst dla Kronikarza: co jest w filmie (bez liczb spoza faktów). */
export function kontekstKronikarza(w) {
    const czesci = CZESCI.filter((k) => w.czesci[k]?.wFilmie).map((k) => NAZWY_CZESCI[k].replace(/^\S+\s/, ''));
    return `${NAZWA} — one evening film made of Katedra OtakOS shows, in this order: ${czesci.join(' → ')}. Dancer: ${w.tancerz} (TeOgochi). Song: ${w.choreografia.utwor}. Score: ${w.choreografia.ocena}/100. ${w.czesci.mameLeon?.wFilmie ? `On the couch at Mame Leon: ${w.tancerz} and the choreographer ${w.choreograf}.` : ''}`.trim();
}

/**
 * @param {{ katalog: string, katalogMontazy: (p:string) => Promise<string>, choreografie: { wczytaj: Function },
 *   gameShow: { wczytaj: Function, lista: Function }, zebrra: { utworz: Function, wczytaj: Function },
 *   mameLeon: { utworz: Function, wczytaj: Function }, tancerz: (mini) => Promise<{ imie: string, assetId: string|null }>,
 *   os?: (plik: string) => Promise<object|null>, imieChoreografa?: (id: string) => Promise<string>,
 *   spawaj?: Function, publikuj?: Function, opisz?: Function, szyna?: any, teraz?: () => number }} o
 */
export function utworzWieczorTanca(o) {
    const cfg = { teraz: () => Date.now(), os: async () => null, imieChoreografa: async (id) => id, opisz: async () => ({ sekundy: null }), ...o };
    const M = utworzMagazyn({ katalog: cfg.katalog, program: PROGRAM, wzorId: ID });
    const PLIK_U = path.join(M.KAT, 'ustawienia.json');
    const czas = () => new Date(cfg.teraz()).toISOString();
    const nadaj = (tresc) => cfg.szyna?.nadaj?.({ agent: 'Wieczór Tańca', rodzaj: 'praca', tresc: `🌙 ${tresc}` })?.catch?.(() => {});
    const sklejane = new Set();

    async function ustawienia() { try { return { ...DOMYSLNE, ...JSON.parse(await fs.readFile(PLIK_U, 'utf8')) }; } catch { return { ...DOMYSLNE }; } }
    async function ustaw(z = {}) {
        const u = await ustawienia();
        if (z.auto !== undefined) u.auto = !!z.auto;
        if (z.jezyk !== undefined) { if (!['en', 'pl'].includes(z.jezyk)) throw new Error('Język: en albo pl.'); u.jezyk = z.jezyk; }
        if (z.narrator !== undefined) u.narrator = String(z.narrator).slice(0, 30);
        if (z.wspolprowadzacy !== undefined) u.wspolprowadzacy = (Array.isArray(z.wspolprowadzacy) ? z.wspolprowadzacy : []).map((x) => String(x).slice(0, 30)).slice(0, 3);
        if (z.choreograf !== undefined) u.choreograf = String(z.choreograf).slice(0, 30);
        await fs.mkdir(M.KAT, { recursive: true });
        await fs.writeFile(PLIK_U, JSON.stringify(u, null, 1), 'utf8');
        return u;
    }

    /** Start wieczoru po nagraniu występu (most woła to sam; ręcznie: `POST /api/wieczor-tanca`). */
    async function zacznij({ choreografia, nagranie, gameShowId = null } = {}) {
        const c = await cfg.choreografie.wczytaj(String(choreografia ?? ''));
        const nazwaNagrania = path.basename(String(nagranie ?? c.nagrania?.at(-1)?.nazwa ?? ''));
        if (!nazwaNagrania) throw new Error('Ta choreografia nie ma jeszcze nagrania występu.');
        const istniejacy = (await M.lista()).find((w) => w.nagranie === nazwaNagrania && w.stan !== 'blad');
        if (istniejacy) return istniejacy;
        const u = await ustawienia();
        const t = await cfg.tancerz(c.mini).catch(() => ({ imie: c.mini?.nazwa ?? 'TeOgochi', assetId: null }));
        const choreograf = await cfg.imieChoreografa(u.choreograf).catch(() => u.choreograf);
        const w = {
            wersja: 1, id: M.noweId('w'), stan: 'czeka', powod: null, jezyk: u.jezyk, tancerz: t.imie, choreograf,
            choreografia: { id: c.id, nazwa: c.nazwa, utwor: c.utwor?.tytul ?? '', ocena: c.ocena?.wynik ?? null },
            nagranie: nazwaNagrania, czesci: {}, plik: null, publikacja: null, utworzono: czas(),
        };
        // 1. TeO Game Show — rusza sam po nagraniu; bez niego w filmie idzie surowy występ
        if (!gameShowId) {
            const gs = (await cfg.gameShow.lista().catch(() => [])).find((s) => s.nagranie?.nazwa === nazwaNagrania && !['blad', 'odrzucony'].includes(s.stan));
            gameShowId = gs?.id ?? null;
        }
        w.czesci.gameShow = gameShowId ? { id: gameShowId } : { id: null, powod: 'TeO Game Show nie ruszył — w filmie surowy występ' };
        // 2. Zebrra Sports o tym tańcu
        try { const z = await cfg.zebrra.utworz({ wystepy: [c.id], narrator: u.narrator, wspolprowadzacy: u.wspolprowadzacy, jezyk: u.jezyk, wieczor: w.id }); w.czesci.zebrra = { id: z.id }; } catch (e) { w.czesci.zebrra = { id: null, blad: e.message }; }
        // 3. Mame Leon Show: tancerz (bryła) + choreograf (TeOgochi)
        try {
            if (!t.assetId) throw new Error(`${t.imie} nie ma bryły w Assetach 3D (Bestiariusz gry) — na kanapę nie usiądzie.`);
            const os = c.utwor?.plik ? await cfg.os(c.utwor.plik).catch(() => null) : null;
            const m = await cfg.mameLeon.utworz({
                temat: tematKanapy(t.imie, w.choreografia.utwor, u.jezyk), jezyk: u.jezyk, wieczor: w.id,
                uwagi: faktyKanapy(c, { os, choreograf }),
                goscie: [{ rodzaj: 'bryla', id: t.assetId, imie: t.imie }, { rodzaj: 'teogochi', id: u.choreograf }],
            });
            w.czesci.mameLeon = { id: m.id };
        } catch (e) { w.czesci.mameLeon = { id: null, blad: e.message }; }
        await M.pisz(w);
        nadaj(`${t.imie}: wieczór rusza — Game Show, Zebrra Sports i Mame Leon; studia nagrywają, potem jeden film`);
        return w;
    }

    /** Stan części z faktów jej programu: { stan, plik, powod }. */
    async function stanCzesci(k, c) {
        if (!c?.id) {
            if (k === 'gameShow') return { stan: 'zastepstwo', plik: null, powod: c?.powod ?? null };
            return { stan: 'blad', plik: null, powod: c?.blad ?? 'nie utworzono' };
        }
        const zrodlo = k === 'gameShow' ? cfg.gameShow : k === 'zebrra' ? cfg.zebrra : cfg.mameLeon;
        try {
            const s = await zrodlo.wczytaj(c.id);
            const plik = s.plik && fsSync.existsSync(s.plik) ? s.plik : null;
            return { stan: plik ? 'gotowy' : s.stan === 'blad' ? 'blad' : s.stan, plik, powod: s.stan === 'blad' ? s.powod ?? 'błąd' : null };
        } catch (e) { return { stan: 'blad', plik: null, powod: e.message }; }
    }

    async function zCzesciami(w) {
        const out = { ...w, czesci: { ...w.czesci } };
        for (const k of CZESCI) out.czesci[k] = { ...w.czesci[k], ...(await stanCzesci(k, w.czesci[k])) };
        return out;
    }
    const lista = async () => Promise.all((await M.lista()).map(zCzesciami));
    const wczytaj = async (id) => zCzesciami(await M.wczytaj(id));

    /** Sklejenie: części po kolei (Game Show albo surowy występ, Zebrra, Mame Leon), bez `pomin`. */
    async function sklej(id, { pomin = [] } = {}) {
        if (sklejane.has(id)) throw new Error('Ten wieczór właśnie się skleja.');
        const w = await wczytaj(id);
        if (!cfg.spawaj) throw new Error('Most nie ma Spawacza.');
        const klipy = [];
        for (const k of CZESCI) {
            const c = w.czesci[k];
            if (pomin.includes(k)) { c.wFilmie = false; continue; }
            let plik = c.plik;
            if (!plik && k === 'gameShow' && c.stan === 'zastepstwo') {
                const p = path.join(await cfg.katalogMontazy('taneczne-starcie'), w.nagranie);
                plik = fsSync.existsSync(p) ? p : null;
            }
            if (!plik) throw new Error(`${NAZWY_CZESCI[k]} nie ma jeszcze filmu (${c.stan}${c.powod ? `: ${c.powod}` : ''}) — poczekaj albo sklej bez tej części.`);
            c.wFilmie = true;
            klipy.push(plik);
        }
        if (klipy.length < 2) throw new Error('Wieczór to co najmniej dwie części.');
        // 🔒 blokada MIĘDZY PROCESAMI (2026-10-21: most Katedry i most-próbnik skleiły ten sam wieczór naraz do jednego
        // pliku — powstał uszkodzony film, który poszedł na YouTube). Plik `sklejanie.lock` w katalogu wieczoru,
        // starszy niż 30 min = po padniętym procesie, zdejmowany.
        const zamek = path.join(path.dirname(M.plikO(id)), 'sklejanie.lock');
        try { const st = await fs.stat(zamek); if (cfg.teraz() - st.mtimeMs > 30 * 60_000) await fs.rm(zamek, { force: true }); } catch { /* brak zamka */ }
        try { await (await fs.open(zamek, 'wx')).close(); } catch (e) { if (e.code === 'EEXIST') throw new Error('Ten wieczór skleja właśnie inny proces mostu.'); throw e; }
        sklejane.add(id);
        const s = await M.wczytaj(id);
        try {
            Object.assign(s, { stan: 'skleja', powod: null });
            await M.pisz(s);
            const kat = await cfg.katalogMontazy(PROJEKT);
            await fs.mkdir(kat, { recursive: true });
            // każde sklejenie = NOWY plik (nigdy nie nadpisujemy filmu, który mógł już pójść do publikacji);
            // ffmpeg pisze do pliku roboczego, gotowy przechodzi pod nazwę docelową dopiero po końcu
            const baza = `wieczor_${bezpNazwa(w.tancerz)}_${w.jezyk}_${id.slice(2)}`;
            let cel = path.join(kat, `${baza}.mp4`);
            for (let v = 2; fsSync.existsSync(cel); v++) cel = path.join(kat, `${baza}_v${v}.mp4`);
            const roboczy = `${cel}.sklejanie.mp4`;
            await cfg.spawaj({ klipy, wyjscie: roboczy, celWedlug: 0 });
            await fs.rename(roboczy, cel);
            for (const k of CZESCI) s.czesci[k] = { ...s.czesci[k], wFilmie: !!w.czesci[k].wFilmie };
            Object.assign(s, { plik: cel, sklejono: czas(), sekundy: (await cfg.opisz(cel).catch(() => null))?.sekundy ?? null, stan: 'sklejony', pominiete: pomin.filter((k) => CZESCI.includes(k)) });
            if (cfg.publikuj) {
                try {
                    const p = await cfg.publikuj({ plik: cel, nazwa: `${NAZWA} — ${w.tancerz} · „${w.choreografia.utwor}”`, jezyk: w.jezyk, kontekst: kontekstKronikarza({ ...w, czesci: s.czesci }), zrodlo: { projekt: PROJEKT, wieczor: id } });
                    s.publikacja = { id: p.id ?? null, etap: p.etap ?? null };
                    s.stan = 'do_akceptacji';
                } catch (e) { s.powod = `publikacja: ${e.message}`; }
            }
            nadaj(`wieczór ${w.tancerz} sklejony (${klipy.length} części) — Kronikarz pisze opis, potem ✓ w Izbie`);
        } catch (e) { Object.assign(s, { stan: 'czeka', powod: `sklejenie: ${String(e.message || e).slice(0, 400)}` }); }
        finally { sklejane.delete(id); await fs.rm(zamek, { force: true }).catch(() => {}); }
        await M.pisz(s);
        return wczytaj(id);
    }

    /** Krok pętli: wieczory czekające — gdy wszystkie części mają film, sklej; inaczej zapisz powód z faktów. */
    async function sprawdz() {
        for (const w of await lista()) {
            if (w.stan === 'skleja' && !sklejane.has(w.id)) { const s = await M.wczytaj(w.id); Object.assign(s, { stan: 'czeka', powod: 'Sklejanie przerwane restartem mostu — skleję jeszcze raz.' }); await M.pisz(s); continue; }
            if (w.stan !== 'czeka') continue;
            const czeka = CZESCI.filter((k) => !['gotowy', 'zastepstwo'].includes(w.czesci[k].stan));
            // sklejenie, które padło, nie ponawia się samo co minutę — Suweren klika „🧩 sklej” po poprawce
            if (!czeka.length) { if (!String(w.powod ?? '').startsWith('sklejenie:')) await sklej(w.id).catch(() => {}); continue; }
            const powod = czeka.map((k) => `${NAZWY_CZESCI[k]}: ${w.czesci[k].stan === 'studio' ? 'czeka na nagranie w studiu' : w.czesci[k].stan}${w.czesci[k].powod ? ` (${w.czesci[k].powod})` : ''}`).join(' · ');
            if (powod !== w.powod) { const s = await M.wczytaj(w.id); s.powod = powod; await M.pisz(s); }
        }
    }
    let petla = null;
    function startPetli(ms = 60_000) {
        if (petla) return;
        petla = setInterval(() => { void sprawdz().catch(() => {}); }, ms);
        petla.unref?.();
    }

    async function usun(id) { if (sklejane.has(id)) throw new Error('Ten wieczór właśnie się skleja.'); return M.usun(id); }

    return { ustawienia, ustaw, zacznij, lista, wczytaj, sklej, sprawdz, startPetli, usun };
}

/** Trasy (Straż `/api/wieczor-tanca`: tylko maszyna). */
export function zamontujTrasyWieczoru(app, W) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(e.message?.startsWith('Nie ma') ? 404 : kod).json({ success: false, message: e.message }));
    app.get('/api/wieczor-tanca', (_req, res) => odp(res, (async () => ({ wieczory: await W.lista(), ustawienia: await W.ustawienia(), czesci: CZESCI, nazwy: NAZWY_CZESCI }))(), 500));
    app.put('/api/wieczor-tanca/ustawienia', (req, res) => odp(res, W.ustaw(req.body ?? {}).then((ustawienia) => ({ ustawienia }))));
    app.post('/api/wieczor-tanca', (req, res) => odp(res, W.zacznij({ choreografia: req.body?.choreografia, nagranie: req.body?.nagranie }).then((wieczor) => ({ wieczor }))));
    app.get('/api/wieczor-tanca/:id', (req, res) => odp(res, W.wczytaj(req.params.id).then((wieczor) => ({ wieczor })), 404));
    app.post('/api/wieczor-tanca/:id/sklej', (req, res) => odp(res, W.sklej(req.params.id, { pomin: Array.isArray(req.body?.pomin) ? req.body.pomin : [] }).then((wieczor) => ({ wieczor }))));
    app.delete('/api/wieczor-tanca/:id', (req, res) => odp(res, W.usun(req.params.id).then((usuniety) => ({ usuniety }))));
}

export default { utworzWieczorTanca, zamontujTrasyWieczoru, faktyKanapy, tematKanapy, kontekstKronikarza, CZESCI, DOMYSLNE };
