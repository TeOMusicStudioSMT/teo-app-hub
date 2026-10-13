/**
 * 💃🥊 RING TANECZNY — pojedynki taneczne Mini-TeOgochi między Katedrami (Suweren 2026-10-12: „mini gra w stylu
 * bijatyk jak Street Fighter… tylko że w naszych będą tańczyć… walka automatyczna rozgrywana przez TeOgochi…
 * w multi z innym TeOgochi innej Katedry… gracz jedynie aktywuje skille”).
 *
 * Walkę liczy KAŻDY gracz u siebie (apka `_OtakOs_Apki/taneczne-starcie`, silnik deterministyczny `src/silnik.ts`):
 * ten sam start, ziarno, tempo i ta sama lista aktywacji skilli = ta sama walka na obu ekranach (lockstep). Most
 * gospodarza jest tylko TABLICĄ: pokój z dwiema kartami zawodników, ziarnem, tempem, chwilą startu i listą ruchów
 * {takt, skill} każdej strony oraz „horyzontem” (do którego taktu gracz podał już wszystkie ruchy). Wszystko w
 * pamięci — bez dysku, bez modeli, bez ComfyUI. Tak jak Plac obecności (services/PlacObecnosci.js).
 *
 * Pokój otwiera tylko Suweren przy swojej maszynie (`otworz` z `lokalny`); dołączyć może gracz z innej Katedry
 * przez tunel. Najwyżej `MAX_POKOI` pokoi, 2 graczy, ≤ `MAX_RUCHOW` ruchów na stronę, cisza `ZYWOTNOSC_MS` = gracz
 * wyszedł (pokój przechodzi w `koniec`, nowy rywal nie wejdzie do rozpoczętej walki).
 *
 * ⚔️ PvP RYTMICZNY (Suweren 2026-10-13): pokój z polem `rytm` {takty, poziom, sekcje [{typ, od, do}], tytul} — oś JaJa
 * Kompozytora (albo wzorzec). Obie apki liczą z niej ten sam wzór nut (src/rytmika.ts, ziarno pokoju), a ruchy niosą
 * TRAFIENIA {takt: nr nuty, skill: `t<ms+500>`} i Overdrive {takt: 60000 + nr, skill: 'od'}; horyzont = ostatnia nuta,
 * której okno minęło. Most nadal tylko przekazuje — wynik liczy każdy gracz u siebie.
 *
 * UCZCIWIE: karta zawodnika (skille, moc, poziom) jest DEKLARACJĄ Katedry gracza — most przycina ją do granic
 * Bestiariusza (moc 1–100, ≤ 4 skille, poziom 1–20), ale nie sprawdza, czy ten Mini naprawdę wykluł się u niej.
 */

export const MAX_POKOI = 4;
export const MAX_RUCHOW = 2400;   // walka: aktywacje skilli; ⚔️ rytm: do 2000 nut + Overdrive
export const ZYWOTNOSC_MS = 15_000;
export const MIN_ODSTEP_MS = 120;
/** Ile ms po dołączeniu drugiego gracza rusza walka (odliczanie na ekranie). */
export const ODLICZANIE_MS = 6_000;

const ID_GRACZA = /^[a-z0-9]{8,32}$/;
const ID_POKOJU = /^r-[a-z0-9]{6,16}$/;
const PLIK_MODELU = /^[a-z0-9][a-z0-9._-]{0,90}\.glb$/i;
const NICK = /^[a-z0-9-]{2,40}$/;
const TYPY = ['cios', 'specjalny', 'pasywny', 'taniec'];
const DZIEDZINY = ['takt', 'zwinnosc', 'spryt', 'urok'];
const SEKCJE_RYTMU = ['intro', 'staccato', 'buildup', 'drop', 'outro'];
const POZIOMY_RYTMU = ['initiate', 'organist', 'archon'];

const liczba = (v, min, max, dom) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dom; };
const tekst = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Karta zawodnika przycięta do granic Bestiariusza. Zła = błąd z powodem. */
export function oczyscKarte(k = {}) {
    const nazwa = tekst(k.nazwa, 40);
    if (!nazwa) throw new Error('Karta zawodnika bez nazwy.');
    const skille = (Array.isArray(k.skille) ? k.skille : []).slice(0, 4).map((s, i) => ({
        id: /^[a-z0-9-]{2,48}$/.test(String(s?.id)) ? s.id : `sk-${i + 1}`,
        nazwa: tekst(s?.nazwa, 40) || 'Skill',
        typ: TYPY.includes(s?.typ) ? s.typ : 'cios',
        moc: Math.round(liczba(s?.moc, 1, 100, 10)),
        dziedzina: DZIEDZINY.includes(s?.dziedzina) ? s.dziedzina : null,
    }));
    if (!skille.length) throw new Error('Karta zawodnika bez skilli.');
    return {
        id: /^[a-z0-9-]{2,48}$/.test(String(k.id)) ? k.id : 'mini',
        nazwa,
        rzadkosc: tekst(k.rzadkosc, 20) || 'pospolity',
        kolor: /^#[0-9a-f]{6}$/i.test(String(k.kolor)) ? k.kolor : '#9ca3af',
        mnoznik: Math.round(liczba(k.mnoznik, 0.5, 5, 1) * 100) / 100,
        poziom: Math.round(liczba(k.poziom, 1, 20, 1)),
        dziedzina: DZIEDZINY.includes(k.dziedzina) ? k.dziedzina : 'takt',
        skille,
        // bryła tylko jako NAZWA PLIKU lekkich assetów udostępnionej gry Katedry gracza — obcy adres nie wchodzi
        model: typeof k.model === 'string' && PLIK_MODELU.test(k.model) ? k.model : null,
        katedra: typeof k.katedra === 'string' && NICK.test(k.katedra) ? k.katedra : null,
        gracz: tekst(k.gracz, 24) || null,
    };
}

/** ⚔️ Oś pojedynku rytmicznego: 8–64 taktów, sekcje po kolei w granicach, znany poziom. Zła = błąd z powodem. */
export function oczyscRytm(r = {}) {
    const takty = Math.round(Number(r.takty));
    if (!Number.isInteger(takty) || takty < 8 || takty > 64) throw new Error('Pojedynek rytmiczny: 8–64 taktów.');
    if (!POZIOMY_RYTMU.includes(r.poziom)) throw new Error(`Pojedynek rytmiczny: poziom ${POZIOMY_RYTMU.join(' / ')}.`);
    const sekcje = (Array.isArray(r.sekcje) ? r.sekcje : []).slice(0, 16).map((x) => ({ typ: String(x?.typ), od: Number(x?.od), do: Number(x?.do) }));
    if (!sekcje.length) throw new Error('Pojedynek rytmiczny bez sekcji osi.');
    let koniec = 0;
    for (const x of sekcje) {
        if (!SEKCJE_RYTMU.includes(x.typ) || !Number.isInteger(x.od) || !Number.isInteger(x.do) || x.od < koniec || x.do <= x.od || x.do > takty) throw new Error('Pojedynek rytmiczny: sekcje osi poza taktami albo nie po kolei.');
        koniec = x.do;
    }
    return { takty, poziom: r.poziom, sekcje, tytul: tekst(r.tytul, 60) || 'Pojedynek rytmiczny' };
}

const ruchyZ = (lista, horyzontStary) => (Array.isArray(lista) ? lista : [])
    .map((r) => ({ takt: Math.round(Number(r?.takt)), skill: String(r?.skill ?? '') }))
    .filter((r) => Number.isFinite(r.takt) && r.takt > horyzontStary && r.takt < 100_000 && /^[a-z0-9-]{2,48}$/.test(r.skill));

/**
 * @param {{ teraz?: () => number, losuj?: () => number }} o
 */
export function utworzRing({ teraz = () => Date.now(), losuj = Math.random } = {}) {
    /** id → pokój */
    const pokoje = new Map();
    const noweId = () => `r-${Math.floor(losuj() * 2 ** 40).toString(36).padStart(8, '0').slice(-8)}`;

    function sprzataj() {
        const t = teraz();
        for (const [id, p] of pokoje) {
            for (const g of p.gracze) if (!g.wyszedl && t - g.kiedy > ZYWOTNOSC_MS) g.wyszedl = true;
            const wszyscy = p.gracze.every((g) => g.wyszedl);
            if (wszyscy || t - p.utworzono > 2 * 3600_000) pokoje.delete(id);
            else if (p.gracze.some((g) => g.wyszedl) && p.stan !== 'koniec') p.stan = p.start ? 'koniec' : 'czeka';
        }
    }

    const widok = (p, kto) => ({
        id: p.id, stan: p.stan, ziarno: p.ziarno, bpm: p.bpm, rytm: p.rytm, start: p.start, teraz: teraz(),
        ja: p.gracze.findIndex((g) => g.id === kto),
        gracze: p.gracze.map((g) => ({ karta: g.karta, ruchy: g.ruchy, horyzont: g.horyzont, wyszedl: !!g.wyszedl, wynik: g.wynik ?? null })),
    });

    /** Suweren otwiera pokój (tylko przy swojej maszynie — sprawdza trasa). */
    function otworz({ gracz, karta, bpm, rytm = null, adres = 'maszyna' } = {}) {
        sprzataj();
        if (!ID_GRACZA.test(String(gracz))) throw new Error('Zły identyfikator gracza (8–32 znaki a–z0–9).');
        if (pokoje.size >= MAX_POKOI) throw new Error(`Na ringu tej Katedry jest już ${MAX_POKOI} pokoi — zamknij któryś.`);
        const p = {
            id: noweId(), utworzono: teraz(), stan: 'czeka', start: null,
            ziarno: Math.floor(losuj() * 2 ** 31), bpm: Math.round(liczba(bpm, 80, 160, 120)), rytm: rytm ? oczyscRytm(rytm) : null,
            gracze: [{ id: gracz, adres, karta: oczyscKarte(karta), ruchy: [], horyzont: -1, kiedy: teraz() }],
        };
        pokoje.set(p.id, p);
        return widok(p, gracz);
    }

    /**
     * Meldunek gracza w pokoju: dołączenie (z kartą, drugi gracz), ruchy {takt, skill} powyżej dawnego horyzontu,
     * nowy horyzont, wynik walki. `adres` = adres gracza (cf-connecting-ip) — id przypięte do adresu.
     */
    function melduj(id, adres, d = {}) {
        sprzataj();
        if (!ID_POKOJU.test(String(id))) throw new Error('Zły identyfikator pokoju.');
        const p = pokoje.get(id);
        if (!p) return { brak: true };
        const gid = String(d.gracz ?? '');
        if (!ID_GRACZA.test(gid)) throw new Error('Zły identyfikator gracza (8–32 znaki a–z0–9).');
        let g = p.gracze.find((x) => x.id === gid);
        if (!g) {
            if (p.gracze.length >= 2 || p.stan !== 'czeka') return { pelny: true, pokoj: widok(p, gid) };
            g = { id: gid, adres, karta: oczyscKarte(d.karta), ruchy: [], horyzont: -1, kiedy: 0 };
            p.gracze.push(g);
            p.stan = 'odliczanie';
            p.start = teraz() + ODLICZANIE_MS;
        } else if (g.adres !== adres) throw new Error('Ten gracz należy do innego adresu.');
        if (g.wyszedl) return { pokoj: widok(p, gid) };
        if (teraz() - g.kiedy >= MIN_ODSTEP_MS) {
            const nowe = ruchyZ(d.ruchy, g.horyzont);
            for (const r of nowe) if (g.ruchy.length < MAX_RUCHOW && !g.ruchy.some((x) => x.takt === r.takt)) g.ruchy.push(r);
            g.ruchy.sort((a, b) => a.takt - b.takt);
            const h = Math.round(Number(d.horyzont));
            if (Number.isFinite(h) && h > g.horyzont && h < 100_000) g.horyzont = h;
            if (d.wynik && typeof d.wynik === 'object') g.wynik = { zwyciezca: [0, 1].includes(d.wynik.zwyciezca) ? d.wynik.zwyciezca : null, rundy: tekst(d.wynik.rundy, 10) };
            g.kiedy = teraz();
        }
        if (p.stan === 'odliczanie' && teraz() >= p.start) p.stan = 'walka';
        if (p.gracze.length === 2 && p.gracze.every((x) => x.wynik)) p.stan = 'koniec';
        return { pokoj: widok(p, gid) };
    }

    function wyjdz(id, adres, gracz) {
        const p = pokoje.get(String(id));
        const g = p?.gracze.find((x) => x.id === String(gracz) && x.adres === adres);
        if (!g) return false;
        g.wyszedl = true;
        sprzataj();
        return true;
    }

    /** Lista pokoi czekających na rywala (publicznie — inne Katedry wybierają, z kim tańczyć). */
    function lista() {
        sprzataj();
        return [...pokoje.values()].map((p) => ({
            id: p.id, stan: p.stan, bpm: p.bpm, graczy: p.gracze.length, tryb: p.rytm ? 'rytm' : 'walka', rytm: p.rytm ? { tytul: p.rytm.tytul, poziom: p.rytm.poziom, takty: p.rytm.takty } : null,
            gospodarz: { nazwa: p.gracze[0].karta.nazwa, rzadkosc: p.gracze[0].karta.rzadkosc, poziom: p.gracze[0].karta.poziom, gracz: p.gracze[0].karta.gracz },
        }));
    }

    return { otworz, melduj, wyjdz, lista, _pokoje: pokoje };
}

/**
 * Trasy ringu (montowane z mostu; testowalne na samym Expressie).
 * Publiczne (Straż: `SCIEZKA_RINGU`): GET /wizytowka/ring (pokoje), POST /wizytowka/ring/<pokój> (meldunek),
 * POST /wizytowka/ring/<pokój>/wyjdz. Otwarcie pokoju: POST /wizytowka/ring — tylko maszyna (`req.lokalny`).
 */
export const REJESTR = String(process.env.OTAKOS_REJESTR_URL || 'https://otakos.wtf/api/katedry/meldunek').replace(/\/meldunek\/?$/, '');

/**
 * Katedry online z rejestru otakos.wtf (rejestr nie wpuszcza przeglądarek z innych stron — pyta most) + nick tej
 * Katedry. Tylko nick, adres https i to, czy udostępnia grę (lekkie bryły rywala).
 */
export async function katedryDoRingu({ rejestr = REJESTR, nick = async () => null, pobierz = fetch } = {}) {
    const r = await pobierz(rejestr, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Rejestr Katedr milczy (HTTP ${r.status}).`);
    const lista = (await r.json())?.katedry ?? [];
    return {
        ja: await nick(),
        katedry: lista.filter((k) => typeof k?.nick === 'string' && NICK.test(k.nick) && typeof k?.adres === 'string' && k.adres.startsWith('https://'))
            .map((k) => ({ nick: k.nick, adres: k.adres.replace(/\/+$/, ''), gra: Array.isArray(k.paczkiGier) && k.paczkiGier.some((g) => g?.id === 'teterhia-wieczna-saga') })),
    };
}

export function zamontujTrasyRingu(app, { ring = utworzRing(), cors, nick = async () => null, rejestr = REJESTR, pobierz = fetch } = {}) {
    const kto = (req) => req.get('cf-connecting-ip') || req.ip || '?';
    const corsRingu = cors ? cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }) : (_q, _s, n) => n();
    const zaDuze = (req) => JSON.stringify(req.body ?? {}).length > 12_000;
    app.options(/^\/wizytowka\/ring(\/r-[a-z0-9]{6,16}(\/wyjdz)?)?$/, corsRingu);
    app.get('/wizytowka/ring', corsRingu, (_req, res) => res.json({ success: true, pokoje: ring.lista() }));
    app.post('/wizytowka/ring', corsRingu, (req, res) => {
        if (!req.lokalny) return res.status(403).json({ success: false, message: 'Pokój na ringu otwiera tylko Suweren tej Katedry przy swojej maszynie.' });
        if (zaDuze(req)) return res.status(413).json({ success: false, message: 'Za duże.' });
        try { return res.json({ success: true, pokoj: ring.otworz({ ...req.body, adres: kto(req) }) }); }
        catch (e) { return res.status(400).json({ success: false, message: e.message }); }
    });
    app.post(/^\/wizytowka\/ring\/(r-[a-z0-9]{6,16})$/, corsRingu, (req, res) => {
        if (zaDuze(req)) return res.status(413).json({ success: false, message: 'Meldunek za duży.' });
        try {
            const w = ring.melduj(req.params[0], kto(req), req.body ?? {});
            if (w.brak) return res.status(404).json({ success: false, message: 'Nie ma takiego pokoju (zamknięty albo gospodarz wyszedł).' });
            if (w.pelny) return res.status(409).json({ success: false, message: 'Ten pokój ma już dwóch tancerzy.', pokoj: w.pokoj });
            return res.json({ success: true, pokoj: w.pokoj });
        } catch (e) { return res.status(400).json({ success: false, message: e.message }); }
    });
    app.post(/^\/wizytowka\/ring\/(r-[a-z0-9]{6,16})\/wyjdz$/, corsRingu, (req, res) => res.json({ success: true, wyszedl: ring.wyjdz(req.params[0], kto(req), req.body?.gracz) }));
    // przy maszynie (Straż: /api — tylko maszyna): Katedry online do wyboru ringu
    app.get('/api/ring/katedry', async (_req, res) => {
        try { res.json({ success: true, ...(await katedryDoRingu({ rejestr, nick, pobierz })) }); }
        catch (e) { res.status(502).json({ success: false, message: e.message }); }
    });
    return ring;
}

export default { utworzRing, zamontujTrasyRingu, oczyscKarte, oczyscRytm, katedryDoRingu };
