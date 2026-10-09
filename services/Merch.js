/**
 * 🖨️ Pracownia merchu — druk 3D i gadżety z Meshy do Marketplace (Suweren 2026-10-09: „robimy druk 3D i merch do
 * Marketplace”). Plan Premium Meshy (docs.meshy.ai, odczyt 2026-10-09):
 *
 *   · CREATIVE LAB — z OBRAZU (bryła z Assetów 3D albo własne zdjęcie) dwa etapy:
 *       1. PROTOTYP  `POST /openapi/creative-lab/<produkt>/v1/prototype {image_url, name, name_text?}` — 6 kr. →
 *          jeden obraz-koncept (chibi / relief) DO AKCEPTACJI Suwerena,
 *       2. BUDOWA    `POST …/build {input_task_id, options?}` — cennik: do 30 kr. (przykłady w dokumentacji: 20) →
 *          GLB z teksturą gotowy do druku.
 *     Produkty: figurka, brelok (grawer ≤ 10 znaków, kształt odznaki, mm), magnes (kształt, mm) — sprawdzone w
 *     dokumentacji; winylowa figurka i figurka z klocków — ten sam wzór ścieżek (NIEsprawdzone, błąd Meshy wprost).
 *   · DRUK Z BRYŁY — `POST /openapi/v1/print/analyze` (DARMOWA analiza drukowalności: szczelność, dziury, cienkie
 *     ściany dla FDM/SLA/full-color w zadanym rozmiarze) i `POST /openapi/v1/print/multi-color` (10 kr.) → plik 3MF
 *     wielokolorowy pod drukarkę (Bambu, Prusa, Creality…; 1–16 kolorów; `realistic` z teksturą albo `cartoon` —
 *     przyjmuje też kolory wierzchołków, czyli bryły TRELLIS).
 * Zasada jak w ChmuraBryl: każde płatne zlecenie TYLKO z `zgodaKredyty` = wycena. Gotowy merch → Wystawa (obraz
 * w wizytówce) i Marketplace (produkt za GRV, plik 3MF/GLB w payloadzie). Katalog: `_OtakOs_Wymiar/merch/<id>/`.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const BAZA = process.env.OTAKOS_MESHY_URL || 'https://api.meshy.ai/openapi/v1';
const LAB = (process.env.OTAKOS_MESHY_URL || 'https://api.meshy.ai/openapi/v1').replace(/\/v1$/, '') + '/creative-lab';

export const PRODUKTY = {
    figurka: { slug: 'figure', nazwa: 'Figurka (chibi)', sprawdzone: true },
    brelok: { slug: 'keychain', nazwa: 'Brelok z grawerem', sprawdzone: true, ksztalt: true, grawer: true },
    magnes: { slug: 'fridge-magnet', nazwa: 'Magnes na lodówkę', sprawdzone: true, ksztalt: true },
    winyl: { slug: 'vinyl-figure', nazwa: 'Figurka winylowa', sprawdzone: false },
    klocki: { slug: 'brick-figure', nazwa: 'Figurka z klocków', sprawdzone: false },
};
export const CENNIK_MERCHU = { zrodlo: 'docs.meshy.ai/api/pricing (2026-10-09)', prototyp: 6, budowa: 30, analiza: 0, druk3mf: 10 };
export const KSZTALTY = ['circle', 'rounded-rect', 'hexagon', 'shield', 'star'];
export const DRUKARKI = ['bambu', 'prusa', 'creality', 'anycubic', 'elegoo', 'flashforge', 'qidi', 'snapmaker', 'ankermake'];
const ID = /^m-[0-9a-f]{8}$/;

/** Zlecenie Creative Lab → sprawdzone. */
export function oczyscProdukt(z = {}) {
    const p = PRODUKTY[z.produkt];
    if (!p) throw new Error(`Produkt: ${Object.keys(PRODUKTY).join(', ')}.`);
    const nazwa = String(z.nazwa ?? '').replace(/\s+/g, ' ').trim().slice(0, 100) || p.nazwa;
    const grawer = p.grawer ? [...String(z.grawer ?? '').trim()].slice(0, 10).join('') : '';
    const ksztalt = p.ksztalt ? (KSZTALTY.includes(z.ksztalt) ? z.ksztalt : 'circle') : null;
    const mm = p.ksztalt ? Math.round(Math.min(150, Math.max(15, Number(z.mm) || 40))) : null;
    return { produkt: z.produkt, nazwa, grawer, ksztalt, mm };
}
/** Druk z bryły → sprawdzone. */
export function oczyscDruk(z = {}) {
    const typ = ['fdm', 'sla', 'full_color'].includes(z.drukarkaTyp) ? z.drukarkaTyp : 'fdm';
    const mm = Math.round(Math.min(1000, Math.max(10, Number(z.mm) || 80)));
    const kolory = Math.round(Math.min(16, Math.max(1, Number(z.kolory) || 4)));
    const styl = z.styl === 'realistic' ? 'realistic' : 'cartoon';
    const marka = DRUKARKI.includes(z.marka) ? z.marka : 'bambu';
    return { drukarkaTyp: typ, mm, kolory, styl, marka };
}
export const cialoPrototypu = (z, dataUri) => ({ image_url: dataUri, name: z.nazwa, ...(z.grawer ? { name_text: z.grawer } : {}) });
export const cialoBudowy = (z, prototyp) => ({ input_task_id: prototyp, name: z.nazwa, ...(z.ksztalt ? { options: { badge_shape: z.ksztalt, size_mm: z.mm } } : {}), output: { format: 'glb' } });

/** Raport drukowalności Meshy → po polsku (tylko to, co Meshy zwróciło). */
export function raportDruku(p) {
    if (!p || typeof p !== 'object') return null;
    const m = p.metrics ?? {}, t = p.thin_walls ?? null;
    const werdykt = { healthy: '✅ gotowe do druku', warning: '⚠ do druku z uwagami', error: '⛔ wymaga naprawy przed drukiem', unknown: '❔ nie wiadomo' }[p.status] ?? '❔ nie wiadomo';
    return {
        status: p.status ?? 'unknown', werdykt, bledy: p.error_count ?? 0, ostrzezenia: p.warning_count ?? 0,
        szczelna: m.is_watertight ?? null, dziury: m.holes ?? null, krawedzieNieRozmaitosci: m.non_manifold_edges ?? null, zdegenerowane: m.degenerate_faces ?? null,
        cienkieScianki: t ? { sa: !!t.has_thin_walls, udzial: t.thin_area_ratio ?? null, status: t.status } : null,
        wymiaryMm: p.intended_print?.dimensions_mm ?? null, minScianaMm: p.intended_print?.wall_thickness_mm ?? null,
    };
}

/**
 * @param {{ katalog: string, klucz: () => string|null, obrazBryly: (id:string)=>Promise<Buffer>, glbBryly: (id:string)=>Promise<{bajty:Buffer, zadanie?:string|null}>,
 *           szyna?: object|null, fetch?: Function, coMs?: number, limitMs?: number }} o
 */
export function utworzMerch({ katalog, klucz, obrazBryly, glbBryly, szyna = null, fetch: f = globalThis.fetch, coMs = 5000, limitMs = 30 * 60_000 }) {
    const dirM = (id) => path.join(katalog, id);
    const pracuje = new Map();
    const naglowki = () => {
        const k = klucz();
        if (!k) throw new Error('Brak klucza Meshy — Hub → TeO Kibel (msy_…) → „🔗 Udostępnij mostowi”.');
        return { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' };
    };
    async function czytaj(id) {
        if (!ID.test(String(id))) throw new Error('Złe id merchu.');
        try { return JSON.parse(await fs.readFile(path.join(dirM(id), 'meta.json'), 'utf8')); } catch { throw new Error('Nie ma takiego merchu.'); }
    }
    async function zapisz(m) { m.zmieniono = new Date().toISOString(); await fs.mkdir(dirM(m.id), { recursive: true }); await fs.writeFile(path.join(dirM(m.id), 'meta.json'), JSON.stringify(m, null, 2), 'utf8'); return m; }
    const zgoda = (zgodaKredyty, kredyty, co) => { if (Number(zgodaKredyty) !== kredyty) throw Object.assign(new Error(`Brak zgody na koszt: ${co} kosztuje ${kredyty} kredytów — potwierdź kwotę.`), { kod: 'BEZ_ZGODY' }); };
    async function saldo() {
        const r = await f(`${BAZA}/balance`, { headers: naglowki(), signal: AbortSignal.timeout(15000) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Meshy (saldo) HTTP ${r.status}`);
        return Number(d.balance);
    }
    async function wyslij(url, cialo) {
        const r = await f(url, { method: 'POST', headers: naglowki(), signal: AbortSignal.timeout(120000), body: JSON.stringify(cialo) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.result) {
            const powod = { 401: 'zły klucz', 402: 'za mało kredytów na koncie Meshy', 404: 'Meshy nie zna tej ścieżki (produkt niesprawdzony w dokumentacji?)', 429: 'limit zapytań — za chwilę' }[r.status] ?? '';
            throw new Error(`Meshy odmówiło (HTTP ${r.status}${powod ? ` — ${powod}` : ''}): ${JSON.stringify(d).slice(0, 200)}`);
        }
        return d.result;
    }
    async function czekaj(url, m, etap) {
        const t0 = Date.now();
        while (Date.now() - t0 < limitMs) {
            await new Promise((r) => setTimeout(r, coMs));
            let d;
            try { const r = await f(url, { headers: naglowki(), signal: AbortSignal.timeout(20000) }); d = await r.json(); if (!r.ok) throw new Error(); } catch { continue; }
            m.postep = { etap, procent: Number(d.progress) || 0 };
            if (d.status === 'SUCCEEDED') return d;
            if (d.status === 'FAILED' || d.status === 'CANCELED') throw new Error(`Meshy (${etap}): ${d.status}${d.task_error?.message ? ` — ${d.task_error.message}` : ''}`);
        }
        throw new Error(`Meshy (${etap}) nie skończyło w ${Math.round(limitMs / 60000)} min.`);
    }
    const pobierz = async (url) => Buffer.from(await (await f(url, { signal: AbortSignal.timeout(180000) })).arrayBuffer());
    const wTle = (m, praca) => {
        pracuje.set(m.id, true);
        void praca().catch(async (e) => { m.stan = 'blad'; m.blad = e.message; await zapisz(m).catch(() => {}); void szyna?.nadaj?.({ agent: 'Merch', rodzaj: 'blad', tresc: `🖨️ ${m.nazwa}: ${e.message}` })?.catch?.(() => {}); })
            .finally(() => pracuje.delete(m.id));
    };
    const dataUri = (b, mime) => `data:${mime};base64,${b.toString('base64')}`;

    /** Wycena (kredyty + saldo) przed każdym płatnym krokiem. */
    async function wycen(co) {
        const kredyty = CENNIK_MERCHU[co];
        if (kredyty === undefined) throw new Error('Nieznany krok.');
        return { krok: co, kredyty, usdOkolo: Math.round(kredyty * 0.02 * 100) / 100, saldo: kredyty ? await saldo() : null, cennik: CENNIK_MERCHU.zrodlo };
    }

    /** 1️⃣ Creative Lab — prototyp z obrazu (bryła albo własne zdjęcie). */
    async function prototyp(zlecenie, { bryla = null, dataURL = null, zgodaKredyty } = {}) {
        const z = oczyscProdukt(zlecenie);
        zgoda(zgodaKredyty, CENNIK_MERCHU.prototyp, 'prototyp');
        let obraz;
        if (bryla) obraz = dataUri(await obrazBryly(bryla), 'image/png');
        else if (/^data:image\/(png|jpe?g|webp);base64,/.test(String(dataURL ?? '')) && String(dataURL).length < 20e6) obraz = dataURL;
        else throw new Error('Podaj bryłę z Assetów 3D albo zdjęcie (PNG/JPG/WebP, < 15 MB).');
        const m = await zapisz({ id: `m-${crypto.randomBytes(4).toString('hex')}`, rodzaj: 'lab', ...z, zrodlo: bryla ? { bryla } : { zdjecie: true }, stan: 'prototyp', kredyty: 0, utworzono: new Date().toISOString(), pliki: {} });
        const slug = PRODUKTY[z.produkt].slug;
        m.zadania = { prototyp: await wyslij(`${LAB}/${slug}/v1/prototype`, cialoPrototypu(z, obraz)) };
        await zapisz(m);
        wTle(m, async () => {
            const d = await czekaj(`${LAB}/${slug}/v1/prototype/${m.zadania.prototyp}`, m, 'prototyp');
            const u = d.image_urls?.[0];
            if (!u) throw new Error('Meshy skończyło prototyp, ale nie oddało obrazu.');
            await fs.writeFile(path.join(dirM(m.id), 'koncept.png'), await pobierz(u));
            Object.assign(m, { stan: 'koncept', kredyty: m.kredyty + Number(d.consumed_credits ?? CENNIK_MERCHU.prototyp), pliki: { ...m.pliki, koncept: 'koncept.png' } });
            await zapisz(m);
            void szyna?.nadaj?.({ agent: 'Merch', rodzaj: 'praca', tresc: `🖨️ koncept „${m.nazwa}” gotowy — czeka na Twoją akceptację (budowa do ${CENNIK_MERCHU.budowa} kr.)` })?.catch?.(() => {});
        });
        return m;
    }

    /** 2️⃣ Creative Lab — budowa bryły z zaakceptowanego konceptu. */
    async function buduj(id, { zgodaKredyty } = {}) {
        const m = await czytaj(id);
        if (m.rodzaj !== 'lab' || m.stan !== 'koncept') throw new Error('Budowa tylko z gotowego konceptu (stan „koncept”).');
        zgoda(zgodaKredyty, CENNIK_MERCHU.budowa, 'budowa');
        const slug = PRODUKTY[m.produkt].slug;
        m.zadania.budowa = await wyslij(`${LAB}/${slug}/v1/build`, cialoBudowy(m, m.zadania.prototyp));
        m.stan = 'budowa';
        await zapisz(m);
        wTle(m, async () => {
            const d = await czekaj(`${LAB}/${slug}/v1/build/${m.zadania.budowa}`, m, 'budowa');
            const u = d.model_urls?.glb;
            if (!u) throw new Error('Meshy zbudowało, ale nie oddało GLB.');
            await fs.writeFile(path.join(dirM(m.id), 'model.glb'), await pobierz(u));
            if (d.thumbnail_url) await fs.writeFile(path.join(dirM(m.id), 'miniatura.png'), await pobierz(d.thumbnail_url)).catch(() => {});
            Object.assign(m, { stan: 'gotowy', kredyty: m.kredyty + Number(d.consumed_credits ?? CENNIK_MERCHU.budowa), pliki: { ...m.pliki, model: 'model.glb', ...(d.thumbnail_url ? { miniatura: 'miniatura.png' } : {}) } });
            await zapisz(m);
            void szyna?.nadaj?.({ agent: 'Merch', rodzaj: 'praca', tresc: `🖨️ „${m.nazwa}” zbudowany — gotowy do analizy druku i Marketplace (${m.kredyty} kr.)` })?.catch?.(() => {});
        });
        return m;
    }

    /** 🖨️ Druk: darmowa analiza + (za zgodą) 3MF wielokolorowy — z bryły Assetów 3D (`bryla`) albo z gotowego merchu (`id`). */
    async function druk({ id = null, bryla = null, ustawienia = {}, z3mf = false, zgodaKredyty } = {}) {
        const u = oczyscDruk(ustawienia);
        if (z3mf) zgoda(zgodaKredyty, CENNIK_MERCHU.druk3mf, 'plik 3MF');
        let m, wejscie;
        if (id) {
            m = await czytaj(id);
            if (!m.pliki?.model) throw new Error('Ten merch nie ma jeszcze bryły (najpierw budowa).');
            wejscie = { model_url: dataUri(await fs.readFile(path.join(dirM(id), m.pliki.model)), 'application/octet-stream') };
        } else if (bryla) {
            const g = await glbBryly(bryla);
            m = await zapisz({ id: `m-${crypto.randomBytes(4).toString('hex')}`, rodzaj: 'druk', produkt: 'druk', nazwa: String(ustawienia.nazwa ?? bryla).slice(0, 100), zrodlo: { bryla }, stan: 'analiza', kredyty: 0, utworzono: new Date().toISOString(), pliki: {} });
            wejscie = g.zadanie ? { input_task_id: g.zadanie } : { model_url: dataUri(g.bajty, 'application/octet-stream') };
        } else throw new Error('Podaj bryłę albo merch.');
        if (pracuje.has(m.id)) throw new Error('Ten merch właśnie się liczy.');
        m.druk = { ...u, stan: 'analiza' };
        await zapisz(m);
        wTle(m, async () => {
            const a = await wyslij(`${BAZA}/print/analyze`, { ...wejscie, printer_type: u.drukarkaTyp, intended_print_longest_side_mm: u.mm });
            const da = await czekaj(`${BAZA}/print/analyze/${a}`, m, 'analiza');
            m.druk.raport = raportDruku(da.printability);
            m.druk.stan = z3mf ? '3mf' : 'gotowe';
            await zapisz(m);
            if (z3mf) {
                const t = await wyslij(`${BAZA}/print/multi-color`, { ...wejscie, max_colors: u.kolory, style: u.styl, ...(u.styl === 'realistic' ? { max_depth: 4 } : {}), printer_brand: u.marka });
                const dt = await czekaj(`${BAZA}/print/multi-color/${t}`, m, 'druk 3MF');
                const url = dt.model_urls?.['3mf'];
                if (!url) throw new Error('Meshy skończyło druk, ale nie oddało 3MF.');
                await fs.writeFile(path.join(dirM(m.id), 'druk.3mf'), await pobierz(url));
                m.kredyty += Number(dt.consumed_credits ?? CENNIK_MERCHU.druk3mf);
                m.pliki = { ...m.pliki, druk: 'druk.3mf' };
                m.druk.stan = 'gotowe';
            }
            if (m.rodzaj === 'druk') m.stan = 'gotowy';
            await zapisz(m);
            void szyna?.nadaj?.({ agent: 'Merch', rodzaj: 'praca', tresc: `🖨️ „${m.nazwa}”: ${m.druk.raport?.werdykt ?? 'analiza bez raportu'}${m.pliki.druk ? ' · 3MF gotowy' : ''}` })?.catch?.(() => {});
        });
        return m;
    }

    async function lista() {
        const out = [];
        for (const d of await fs.readdir(katalog).catch(() => [])) {
            if (!ID.test(d)) continue;
            try { const m = await czytaj(d); out.push({ ...m, liczy: pracuje.has(d) }); } catch { /* zepsuty wpis */ }
        }
        return out.sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
    }
    /** Plik merchu (tylko znane nazwy z katalogu merchu). */
    async function plik(id, nazwa) {
        const m = await czytaj(id);
        if (!Object.values(m.pliki ?? {}).includes(nazwa)) throw new Error('Nie ma takiego pliku.');
        return path.join(dirM(id), nazwa);
    }
    async function oznacz(id, pola) { const m = await czytaj(id); Object.assign(m, pola); return zapisz(m); }

    return { wycen, prototyp, buduj, druk, lista, plik, czytaj, oznacz, PRODUKTY };
}

export default { utworzMerch, oczyscProdukt, oczyscDruk, cialoPrototypu, cialoBudowy, raportDruku, PRODUKTY, CENNIK_MERCHU, KSZTALTY, DRUKARKI };
