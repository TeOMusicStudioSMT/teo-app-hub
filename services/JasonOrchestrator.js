/**
 * 🎛️ Jason — autonomiczny orkiestrator kampanii (Suweren 2026-11-12: „Jason sam w kodzie Node.js: audio-create →
 * pobranie do _OtakOs_Muzyka/Suno MCP/ → okładka od Palety → pakiet »Do akcept.« w StoL”).
 *
 * BEZ czatu i BEZ modelu językowego: kroki wykonuje kod, wprost na narzędziach Suno MCP mostu (services/SunoMcp.js).
 *   1. workspace  — `workspaces-list` → istniejący o nazwie albumu albo `workspaces-create` (padło = kampania idzie dalej bez)
 *   2. utwor      — `audio-create` (tryb prosty `description` albo własny `lyrics`+`style`), `idempotency_key` = id kampanii
 *   3. czekanie   — `audio-wait {ids, until: complete}` w pętli (każde ~50 s)
 *   4. pobranie   — plik z wyniku (SunoMcp sam zapisuje gotowe audio), inaczej `audio-download` (+ `confirm`, gdy trzeba kredytu)
 *   5. okladka    — Paleta: FLUX przez `cfg.okladka({ prompt })` (padło = pakiet bez okładki, z powodem; ↻ ponawia sam ten krok)
 *   6. pakiet     — stan `do_akceptacji` → 📥 Izba zgód (źródło `jason`) → StoL „Izba Akceptacji”: ✓ / ✕ zdalnie
 *
 * KREDYTY: jedno `audio-create` = 2 utwory z konta Suno Suwerena. Ponowienie NIGDY nie tworzy utworu drugi raz, gdy
 * kampania ma już `klipy` — wznawia od czekania. Duch po restarcie mostu = błąd z powodem (↻ wznawia).
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const KLIMAT_OKLADKI = 'StarLight Diner at night: a retro 1950s American roadside diner glowing with neon under a sky full of stars, '
    + 'a red velvet booth for two by the window, silhouettes of a woman and a man sharing a quiet moment over two cups, warm amber lamp light, '
    + 'teal and magenta neon reflections on chrome and wet asphalt, cinematic, painterly album cover art, square composition, no text, no letters, no logos';

/** Stacje albumu — wzorce do nadpisania w żądaniu (`stacja: { tytul, opis, styl, lyrics, … }`). */
export const STACJE = {
    1: {
        nr: 1, tytul: 'Velvet Booth for Two (82 BPM Intro)', bpm: 82, artysci: ['Elara', 'Kael'],
        opis: 'Slow 82 BPM intro duet for a female and a male voice (Elara and Kael). Late night in a retro neon diner, a velvet booth for two, '
            + 'the first quiet conversation. Warm Rhodes piano, brushed drums, upright bass, soft tenor sax, vinyl warmth, intimate and cinematic, '
            + 'gentle build, no drop — an opening track that invites the listener in.',
    },
};

const tn = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Dane wyniku narzędzia MCP: structuredContent albo pierwszy JSON w treści. */
export function daneWyniku(wynik) {
    if (wynik?.structuredContent && typeof wynik.structuredContent === 'object') return wynik.structuredContent;
    for (const c of wynik?.content ?? []) if (c?.type === 'text') { try { const j = JSON.parse(c.text); if (j && typeof j === 'object') return j; } catch { /* zwykły tekst */ } }
    return {};
}
export function tekstWyniku(wynik) { return (wynik?.content ?? []).filter((c) => c?.type === 'text').map((c) => c.text).join('\n').slice(0, 400); }

/** Id klipów z odpowiedzi tworzenia (`clip_ids`, `id`, `clips[].id`). */
export function klipyZWyniku(d) {
    const ids = [...(Array.isArray(d?.clip_ids) ? d.clip_ids : []), ...(Array.isArray(d?.clips) ? d.clips.map((c) => c?.id) : []), d?.id];
    return [...new Set(ids.filter((x) => typeof x === 'string' && x.trim()))];
}

/** Workspace o danej nazwie w dowolnie zagnieżdżonej odpowiedzi `workspaces-list`. */
export function znajdzWorkspace(d, nazwa) {
    const cel = String(nazwa).trim().toLowerCase();
    let hit = null;
    const idz = (o, gl = 0) => {
        if (hit || !o || typeof o !== 'object' || gl > 6) return;
        if (Array.isArray(o)) { o.forEach((x) => idz(x, gl + 1)); return; }
        if (typeof o.id === 'string' && String(o.name ?? '').trim().toLowerCase() === cel) { hit = o.id; return; }
        Object.values(o).forEach((v) => idz(v, gl + 1));
    };
    idz(d);
    return hit;
}

/** Stany klipów z `audio-wait`: [{ id, status }] (odpowiedź z `clips` albo pojedynczy klip). */
export function stanyKlipow(d) {
    const lista = Array.isArray(d?.clips) && d.clips.length ? d.clips : d?.id ? [d] : [];
    return lista.map((c) => ({ id: String(c.id ?? ''), status: String(c.status ?? (c.error ? 'error' : '')), tytul: c.title ?? null, blad: c.error ? tn(typeof c.error === 'string' ? c.error : c.error?.message ?? JSON.stringify(c.error), 200) : null }));
}

/** Zlecenie → kampania (bez skutków ubocznych). Rzuca przy brakach. */
export function oczyscZlecenie(z = {}) {
    const wzor = typeof z.stacja === 'object' && z.stacja ? z.stacja : STACJE[Number(z.stacja ?? 1)];
    if (!wzor) throw new Error(`Nie znam stacji „${z.stacja}”. Znane: ${Object.keys(STACJE).join(', ')} — albo podaj obiekt { tytul, opis }.`);
    const baza = STACJE[Number(wzor.nr)] ?? {};
    const stacja = {
        nr: Math.max(1, Math.min(99, Number(wzor.nr) || 1)), tytul: tn(wzor.tytul ?? baza.tytul, 200), bpm: Number(wzor.bpm ?? baza.bpm) || null,
        opis: tn(wzor.opis ?? baza.opis, 2800), styl: tn(wzor.styl, 900), lyrics: String(wzor.lyrics ?? '').trim().slice(0, 4900),
        instrumental: wzor.instrumental === true, sekundy: Number(wzor.sekundy) >= 15 ? Math.min(360, Math.round(Number(wzor.sekundy))) : null,
    };
    if (!stacja.tytul) throw new Error('Stacja bez tytułu.');
    if (!stacja.lyrics && !stacja.opis && !stacja.instrumental) throw new Error('Stacja potrzebuje opisu (tryb prosty) albo tekstu ze stylem (tryb własny).');
    const artysci = (Array.isArray(z.artysci) && z.artysci.length ? z.artysci : wzor.artysci ?? baza.artysci ?? []).map((a) => tn(a, 60)).filter(Boolean).slice(0, 6);
    return {
        album: tn(z.album, 100) || 'StarLight Diner', stacja, artysci,
        okladka: z.okladka === false ? null : { prompt: tn(z.okladka?.prompt, 1800) || KLIMAT_OKLADKI },
        kredytPobrania: z.kredytPobrania !== false, zlecil: tn(z.zlecil, 60) || 'Suweren', skad: tn(z.skad, 40) || 'hub',
    };
}

/** Argumenty `audio-create` — dwa tryby Suno nie mogą się mieszać (400). */
export function argumentyUtworu(k) {
    const s = k.stacja;
    const a = { title: s.tytul, idempotency_key: k.id };
    if (s.lyrics) Object.assign(a, { lyrics: s.lyrics, ...(s.styl ? { style: s.styl } : {}) });
    else if (s.instrumental && s.styl) Object.assign(a, { style: s.styl });
    else a.description = s.opis;
    if (s.instrumental) a.instrumental = true;
    if (s.sekundy) a.duration = s.sekundy;
    if (k.workspace?.id) a.workspace_id = k.workspace.id;
    return a;
}

/**
 * @param {{ katalog: string, suno: { wywolaj: Function, zapiszUtwory: Function }, okladka?: (o: { prompt: string, kampania: object }) => Promise<string|{ sciezka?: string, plik?: string }>,
 *   wiesc?: (tresc: string) => any, decyzja?: (d: object) => any, czekanMax?: number, przerwaMs?: number }} cfg
 */
export function utworzJasona(cfg) {
    const katalog = path.join(cfg.katalog, 'jason', 'kampanie');
    const wRobocie = new Map();          // id → Promise (żywa praca)
    let kolejka = Promise.resolve();     // jedna kampania naraz (konto Suno, FLUX)
    const wiesc = (t) => { try { Promise.resolve(cfg.wiesc?.(t)).catch(() => {}); } catch { /* kanał opcjonalny */ } };
    const plik = (id) => path.join(katalog, `${id}.json`);
    const ID = /^j-[0-9a-f]{8}$/;

    async function zapisz(k) {
        await fs.mkdir(katalog, { recursive: true });
        k.zmieniono = new Date().toISOString();
        const tmp = `${plik(k.id)}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(k, null, 2));
        await fs.rename(tmp, plik(k.id)).catch(async () => { await fs.copyFile(tmp, plik(k.id)); await fs.rm(tmp, { force: true }); });
        return k;
    }
    async function wczytaj(id) {
        if (!ID.test(String(id))) return null;
        let k; try { k = JSON.parse(await fs.readFile(plik(id), 'utf8')); } catch { return null; }
        if (k.stan === 'robi' && !wRobocie.has(k.id)) {   // 👻 duch po restarcie mostu
            k.stan = 'blad'; k.blad = 'Praca przerwana (restart mostu). ↻ wznowi od miejsca przerwania — utwór nie zostanie stworzony drugi raz.';
            await zapisz(k);
        }
        return k;
    }
    async function lista() {
        const nazwy = (await fs.readdir(katalog).catch(() => [])).filter((n) => /^j-[0-9a-f]{8}\.json$/.test(n));
        const k = (await Promise.all(nazwy.map((n) => wczytaj(n.slice(0, -5))))).filter(Boolean);
        return k.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }
    const etap = async (k, nazwa, stan, dane = {}) => { k.etapy[nazwa] = { stan, ...dane, kiedy: new Date().toISOString() }; await zapisz(k); };

    async function krokWorkspace(k) {
        if (k.workspace?.id || k.etapy.workspace?.stan === 'pominiety') return;
        await etap(k, 'workspace', 'robi');
        try {
            let id = znajdzWorkspace(daneWyniku((await cfg.suno.wywolaj('workspaces-list', {}, { zapisz: false })).wynik), k.album);
            const nowy = !id;
            if (!id) {
                const r = await cfg.suno.wywolaj('workspaces-create', { name: k.album, description: tn(`Album „${k.album}” — ${k.artysci.join(' & ') || 'Katedra OtakOS'}. Kampania Jasona.`, 1900) }, { zapisz: false });
                if (r.wynik?.isError) throw new Error(tekstWyniku(r.wynik) || 'Suno odmówił utworzenia workspace.');
                id = daneWyniku(r.wynik).id ?? znajdzWorkspace(daneWyniku(r.wynik), k.album);
            }
            if (!id) throw new Error('Suno nie oddał id workspace.');
            k.workspace = { id, nazwa: k.album, nowy };
            await etap(k, 'workspace', 'gotowe');
        } catch (e) {   // workspace to porządek w bibliotece Suno, nie warunek utworu
            k.uwagi.push(`Workspace „${k.album}” — nie udało się (${tn(e.message, 200)}); utwór idzie do biblioteki bez niego.`);
            await etap(k, 'workspace', 'pominiety', { powod: tn(e.message, 300) });
        }
    }

    async function krokUtwor(k) {
        if (k.klipy?.length) return;   // 💳 nigdy drugi raz
        await etap(k, 'utwor', 'robi');
        const r = await cfg.suno.wywolaj('audio-create', argumentyUtworu(k), { zapisz: false });
        if (r.wynik?.isError) throw new Error(`Suno audio-create: ${tekstWyniku(r.wynik) || 'błąd bez opisu'}`);
        const ids = klipyZWyniku(daneWyniku(r.wynik));
        if (!ids.length) throw new Error(`Suno nie oddał id utworu. Odpowiedź: ${tekstWyniku(r.wynik) || '(pusta)'}`);
        k.klipy = ids.map((id) => ({ id, status: 'queued', plik: null }));
        await etap(k, 'utwor', 'gotowe', { klipow: ids.length });
    }

    async function krokCzekanie(k) {
        const koniec = (c) => ['complete', 'error'].includes(c.status);
        if (k.klipy.every(koniec)) return;
        await etap(k, 'czekanie', 'robi');
        for (let i = 0; i < (cfg.czekanMax ?? 20) && !k.klipy.every(koniec); i++) {
            const r = await cfg.suno.wywolaj('audio-wait', { ids: k.klipy.map((c) => c.id), until: 'complete' });
            for (const s of stanyKlipow(daneWyniku(r.wynik))) {
                const c = k.klipy.find((x) => x.id === s.id);
                if (c) Object.assign(c, { status: s.status || c.status, ...(s.tytul ? { tytul: s.tytul } : {}), ...(s.blad ? { blad: s.blad } : {}) });
            }
            for (const u of r.utwory ?? []) { const c = k.klipy.find((x) => x.id === u.id); if (c && u.plik) c.plik = u.plik; }
            await zapisz(k);
            if (!k.klipy.every(koniec) && cfg.przerwaMs) await new Promise((ok) => setTimeout(ok, cfg.przerwaMs));
        }
        if (!k.klipy.some((c) => c.status === 'complete')) throw new Error(k.klipy.every((c) => c.status === 'error') ? `Suno nie zrobił utworu: ${k.klipy.map((c) => c.blad).filter(Boolean).join(' | ') || 'błąd bez opisu'}` : 'Suno wciąż liczy utwór — ↻ wznowi czekanie (bez nowych kredytów).');
        await etap(k, 'czekanie', 'gotowe');
    }

    async function krokPobranie(k) {
        const brak = () => k.klipy.filter((c) => c.status === 'complete' && !c.plik);
        if (!brak().length) return;
        await etap(k, 'pobranie', 'robi');
        for (const c of brak()) {
            try {
                let d = {};
                for (let i = 0, confirm = false; i < 6; i++) {
                    const r = await cfg.suno.wywolaj('audio-download', { id: c.id, format: 'mp3', ...(confirm ? { confirm: true } : {}) }, { zapisz: false });
                    d = daneWyniku(r.wynik);
                    if (r.wynik?.isError) throw new Error(tekstWyniku(r.wynik) || 'audio-download: błąd');
                    if (d.status === 'requires_credit' && !confirm) {
                        if (!k.kredytPobrania) throw new Error('pobranie wymaga kredytu pobrania Suno, a kampania ma kredytPobrania: false');
                        confirm = true; c.kredytPobrania = true; continue;
                    }
                    if (d.status === 'processing' && !d.url) continue;
                    break;
                }
                if (typeof d.url !== 'string' || !/^https:\/\//.test(d.url)) throw new Error(`Suno nie oddał adresu pliku (${tn(d.status ?? d.reason ?? 'brak', 80)})`);
                const [u] = await cfg.suno.zapiszUtwory(null, [{ id: c.id, tytul: c.tytul ?? k.stacja.tytul, adres: d.url }]);
                if (!u?.plik) throw new Error(u?.blad ?? 'zapis się nie udał');
                c.plik = u.plik; delete c.bladPobrania;
            } catch (e) { c.bladPobrania = tn(e.message, 300); }
            await zapisz(k);
        }
        if (!k.klipy.some((c) => c.plik)) throw new Error(`Utwór jest w Suno, ale nie dał się pobrać: ${k.klipy.map((c) => c.bladPobrania).filter(Boolean).join(' | ')}`);
        const niepobrane = brak();
        if (niepobrane.length) k.uwagi.push(`${niepobrane.length} z ${k.klipy.length} wersji nie pobrano (${niepobrane.map((c) => c.bladPobrania).join(' | ')}).`);
        await etap(k, 'pobranie', 'gotowe');
    }

    async function krokOkladka(k) {
        if (!k.okladka || k.okladka.plik) return;
        if (!cfg.okladka) { k.okladka.blad = 'Katedra nie ma podłączonej Palety (FLUX).'; await etap(k, 'okladka', 'pominiety', { powod: k.okladka.blad }); return; }
        await etap(k, 'okladka', 'robi');
        try {
            const w = await cfg.okladka({ prompt: k.okladka.prompt, kampania: k });
            const zrodlo = typeof w === 'string' ? w : w?.sciezka ?? w?.plik;
            if (!zrodlo) throw new Error('Paleta nie oddała pliku.');
            const cel = path.join(katalog, k.id, `okladka${path.extname(zrodlo) || '.png'}`);
            await fs.mkdir(path.dirname(cel), { recursive: true });
            await fs.copyFile(zrodlo, cel);
            k.okladka.plik = path.basename(cel); delete k.okladka.blad;
            await etap(k, 'okladka', 'gotowe');
        } catch (e) {   // pakiet bez okładki jest uczciwszy niż brak pakietu — mówimy to wprost
            k.okladka.blad = tn(e.message, 300);
            await etap(k, 'okladka', 'blad', { powod: k.okladka.blad });
        }
    }

    async function prowadz(id) {
        const k = await wczytaj(id);
        if (!k) return;
        k.stan = 'robi'; delete k.blad; await zapisz(k);
        try {
            await krokWorkspace(k); await krokUtwor(k); await krokCzekanie(k); await krokPobranie(k); await krokOkladka(k);
            k.stan = 'do_akceptacji'; k.gotowe = new Date().toISOString();
            await etap(k, 'pakiet', 'gotowe');
            wiesc(`🎛️ Jason: pakiet „${k.stacja.tytul}” czeka na Twoje ✓ (Izba Akceptacji)${k.okladka?.blad ? ' — bez okładki' : ''}.`);
        } catch (e) {
            k.stan = 'blad'; k.blad = tn(e.message, 500); await zapisz(k);
            wiesc(`🎛️ Jason: kampania „${k.stacja.tytul}” stanęła — ${tn(e.message, 160)}`);
        }
    }
    function rusz(id) {
        const p = (kolejka = kolejka.then(() => prowadz(id)).catch(() => {})).finally(() => wRobocie.delete(id));
        wRobocie.set(id, p);
        return p;
    }

    /** Nowa kampania — wraca od razu, praca idzie w tle. Ta sama stacja albumu w toku / do ✓ = odmowa (kredyty). */
    async function wykonaj(zlecenie) {
        const z = oczyscZlecenie(zlecenie);
        const otwarta = (await lista()).find((k) => k.album === z.album && k.stacja.tytul === z.stacja.tytul && ['robi', 'do_akceptacji', 'blad'].includes(k.stan));
        if (otwarta && zlecenie?.nowa !== true) throw Object.assign(new Error(`Kampania „${z.stacja.tytul}” już jest (${otwarta.stan}) — ${otwarta.stan === 'blad' ? 'wznów ją (↻)' : otwarta.stan === 'robi' ? 'poczekaj, aż skończy' : 'rozstrzygnij ją w Izbie'} albo wyślij nowa: true.`), { kod: 'JUZ_JEST', kampania: otwarta });
        const k = { id: `j-${crypto.randomBytes(4).toString('hex')}`, ...z, stan: 'robi', etapy: {}, klipy: [], uwagi: [], workspace: null, utworzono: new Date().toISOString() };
        wRobocie.set(k.id, Promise.resolve());   // przed zapisem „robi” — odczyt nie weźmie jej za ducha
        await zapisz(k);
        rusz(k.id);
        return k;
    }
    async function ponow(id, { okladka = false } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (wRobocie.has(k.id)) throw new Error('Ta kampania właśnie pracuje.');
        if (['przyjeta', 'odrzucona'].includes(k.stan)) throw new Error(`Kampania jest już ${k.stan}.`);
        if (okladka && k.okladka) { delete k.okladka.plik; delete k.okladka.blad; }
        k.stan = 'robi';
        wRobocie.set(k.id, Promise.resolve());
        await zapisz(k);
        rusz(k.id);
        return k;
    }
    async function rozstrzygnij(id, akcja, { powod = '', kto = null } = {}) {
        const k = await wczytaj(id);
        if (!k) throw Object.assign(new Error('Nie ma takiej kampanii.'), { kod: 404 });
        if (k.stan !== 'do_akceptacji') throw new Error(`Kampania nie czeka na decyzję (stan: ${k.stan}).`);
        if (!['przyjmij', 'odrzuc'].includes(akcja)) throw new Error(`Nie znam akcji „${akcja}”.`);
        k.stan = akcja === 'przyjmij' ? 'przyjeta' : 'odrzucona';
        k.decyzja = { werdykt: akcja, powod: tn(powod, 300), kto: kto ?? 'Suweren', kiedy: new Date().toISOString() };
        await zapisz(k);
        try { cfg.decyzja?.({ zrodlo: 'jason', obiekt: k.id, tytul: `${k.album} · ${k.stacja.tytul}`, werdykt: akcja, opis: k.decyzja.powod }); } catch { /* JaJo opcjonalne */ }
        wiesc(`🎛️ Jason: „${k.stacja.tytul}” — ${akcja === 'przyjmij' ? '✓ przyjęte' : '✕ odrzucone'}${k.decyzja.powod ? ` (${k.decyzja.powod})` : ''}. Pliki zostają w bibliotece.`);
        return k;
    }
    const sciezkaOkladki = (k) => (k?.okladka?.plik ? path.join(katalog, k.id, k.okladka.plik) : null);

    /** 📥 Źródło Izby zgód — odczyt bez skutków ubocznych. */
    const zrodloIzby = {
        id: 'jason', emoji: '🎛️', nazwa: 'Jason — kampanie',
        czekajace: async () => (await lista()).filter((k) => k.stan === 'do_akceptacji').map((k) => ({
            id: k.id, kiedy: k.gotowe ?? k.utworzono,
            tytul: `${k.album} · Stacja ${k.stacja.nr}: ${k.stacja.tytul}`,
            opis: [`${k.artysci.join(' & ') || 'Suno'} — wersji w _OtakOs_Muzyka: ${k.klipy.filter((c) => c.plik).length} (${k.klipy.filter((c) => c.plik).map((c) => c.plik).join(', ')}).`,
                k.okladka?.plik ? 'Okładka: Paleta (FLUX).' : k.okladka ? `Bez okładki: ${k.okladka.blad ?? 'pominięta'}.` : '', ...k.uwagi].filter(Boolean).join(' '),
            obrazy: sciezkaOkladki(k) ? [sciezkaOkladki(k)] : [],
            akcje: [{ id: 'przyjmij', etykieta: '✓ Przyjmij pakiet', zdalnie: true }, { id: 'odrzuc', etykieta: '✕ Odrzuć', zdalnie: true }],
        })),
        decyduj: (id, akcja, { powod } = {}) => rozstrzygnij(id, akcja, { powod }),
    };

    return { wykonaj, ponow, rozstrzygnij, lista, kampania: wczytaj, sciezkaOkladki, zrodloIzby, _czekaj: (id) => wRobocie.get(id) ?? Promise.resolve() };
}

/** Trasy. `dostep(req, res)` = maszyna albo sparowany telefon (Stół Narad w StoL); Straż wpuszcza z telefonu tylko start i odczyt. */
export function zamontujTrasyJasona(app, J, { dostep = async () => ({ urzadzenie: null }) } = {}) {
    const blad = (res, e) => res.status(e.kod === 404 ? 404 : e.kod === 'JUZ_JEST' ? 409 : 400).json({ success: false, message: e.message, kod: e.kod ?? null, ...(e.kampania ? { kampania: e.kampania } : {}) });
    app.post('/api/jason/wykonaj-kampanie', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        try { res.json({ success: true, kampania: await J.wykonaj({ ...(req.body ?? {}), zlecil: d.urzadzenie ?? req.body?.zlecil, skad: d.urzadzenie ? 'telefon' : req.body?.skad }) }); } catch (e) { blad(res, e); }
    });
    app.get('/api/jason/kampanie', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        res.json({ success: true, kampanie: await J.lista(), stacje: Object.values(STACJE).map(({ nr, tytul, bpm, artysci }) => ({ nr, tytul, bpm, artysci })) });
    });
    app.get('/api/jason/kampanie/:id', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        const k = await J.kampania(req.params.id);
        return k ? res.json({ success: true, kampania: k }) : res.status(404).json({ success: false, message: 'Nie ma takiej kampanii.' });
    });
    app.get('/api/jason/kampanie/:id/okladka', async (req, res) => {
        const d = await dostep(req, res); if (!d) return;
        const p = J.sciezkaOkladki(await J.kampania(req.params.id));
        return p ? res.sendFile(p) : res.status(404).json({ success: false, message: 'Ta kampania nie ma okładki.' });
    });
    app.post('/api/jason/kampanie/:id/ponow', async (req, res) => { try { res.json({ success: true, kampania: await J.ponow(req.params.id, { okladka: req.body?.okladka === true }) }); } catch (e) { blad(res, e); } });
    for (const akcja of ['przyjmij', 'odrzuc']) {
        app.post(`/api/jason/kampanie/:id/${akcja}`, async (req, res) => { try { res.json({ success: true, kampania: await J.rozstrzygnij(req.params.id, akcja, { powod: req.body?.powod }) }); } catch (e) { blad(res, e); } });
    }
}
