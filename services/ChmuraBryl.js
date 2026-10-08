/**
 * ☁️🗿 Dopracowanie brył w chmurze — Meshy (Suweren 2026-10-07: „udoskonalenie assetów w chmurze tanio”; plan:
 * „z kosztem pokazanym przed wysłaniem i zgodą”).
 *
 * Dwa zlecenia (docs.meshy.ai, odczyt 2026-10-09):
 *   · RETEKSTURA — nowe tekstury z opisu stylu (≤ 800 znaków): 10 kredytów (2K/4K), 15 (8K); opcjonalnie PBR,
 *   · REMESH     — nowa topologia (trójkąty / czworokąty), 100–300 000 ścian: 5 kredytów.
 * Bryła idzie jako plik (data URI base64) — nic nie wystawiamy publicznie. Kredyty: plan płatny (Pro $20 = 1000
 * kredytów ≈ $0,02/kredyt — `OTAKOS_MESHY_USD_ZA_KREDYT`), trybu testowego Meshy nie ma.
 *
 * ZGODA: `zlec` wymaga `zgodaKredyty` równego wycenie (UI pokazuje kwotę i saldo, Suweren klika) — bez tego nic
 * nie wychodzi z Katedry. Wynik: GLB z TEKSTURAMI (nie kolory wierzchołków) → nowa wersja bryły obok starej;
 * lokalne poprawki (kolor/fragment/oko) działają na wersjach sprzed chmury — mówimy to wprost.
 */
export const CENNIK_MESHY = { zrodlo: 'docs.meshy.ai/api/pricing (2026-10-09)', retekstura: { '2k': 10, '4k': 10, '8k': 15 }, remesh: 5 };
export const USD_ZA_KREDYT = Number(process.env.OTAKOS_MESHY_USD_ZA_KREDYT) || 0.02;
export const MAX_MB = 20;
const BAZA = process.env.OTAKOS_MESHY_URL || 'https://api.meshy.ai/openapi/v1';

/** Zlecenie od Suwerena → sprawdzone. */
export function oczyscZlecenie(z = {}) {
    const rodzaj = z.rodzaj === 'remesh' ? 'remesh' : z.rodzaj === 'retekstura' ? 'retekstura' : null;
    if (!rodzaj) throw new Error('Rodzaj: retekstura albo remesh.');
    if (rodzaj === 'retekstura') {
        const styl = String(z.styl ?? '').trim().slice(0, 800);
        if (styl.length < 3) throw new Error('Retekstura: opisz styl (np. „czarna sierść mieniąca się jak opal, świecące bursztynowe oko”).');
        const rozdzielczosc = ['2k', '4k', '8k'].includes(z.rozdzielczosc) ? z.rozdzielczosc : '2k';
        return { rodzaj, styl, rozdzielczosc, pbr: !!z.pbr, oryginalneUV: !!z.oryginalneUV };
    }
    const sciany = Math.round(Number(z.sciany) || 30000);
    if (sciany < 100 || sciany > 300000) throw new Error('Remesh: od 100 do 300 000 ścian.');
    return { rodzaj, sciany, topologia: z.topologia === 'quad' ? 'quad' : 'triangle' };
}

/** Wycena: kredyty z cennika i około USD. */
export function wycena(z) {
    const kredyty = z.rodzaj === 'remesh' ? CENNIK_MESHY.remesh : CENNIK_MESHY.retekstura[z.rozdzielczosc];
    return { kredyty, usdOkolo: Math.round(kredyty * USD_ZA_KREDYT * 100) / 100, cennik: CENNIK_MESHY.zrodlo };
}

/** Ciało zapytania Meshy z sprawdzonego zlecenia. */
export function cialoMeshy(z, dataUri) {
    if (z.rodzaj === 'remesh') return { model_url: dataUri, topology: z.topologia, target_polycount: z.sciany, target_formats: ['glb'] };
    return { model_url: dataUri, text_style_prompt: z.styl, texture_resolution: z.rozdzielczosc, enable_pbr: z.pbr, enable_original_uv: z.oryginalneUV, target_formats: ['glb'] };
}

/**
 * @param {{ klucz: () => string|null, plikBryly: (id: string) => Promise<{ sciezka: string, bajty: Buffer }>,
 *           zapiszWersje: (id: string, glb: Buffer, wpis: object) => Promise<object>, szyna?: object|null, fetch?: Function, coMs?: number, limitMs?: number }} o
 */
export function utworzChmureBryl({ klucz, plikBryly, zapiszWersje, szyna = null, fetch: f = globalThis.fetch, coMs = 5000, limitMs = 30 * 60_000 }) {
    const zadania = new Map();
    const naglowki = () => {
        const k = klucz();
        if (!k) throw Object.assign(new Error('Brak klucza Meshy — Hub → TeO Kibel (msy_…) → „🔗 Udostępnij mostowi”.'), { kod: 'BEZ_KLUCZA' });
        return { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' };
    };
    const sciezka = (z) => (z.rodzaj === 'remesh' ? 'remesh' : 'retexture');

    async function saldo() {
        const r = await f(`${BAZA}/balance`, { headers: naglowki(), signal: AbortSignal.timeout(15000) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Meshy (saldo) HTTP ${r.status}: ${JSON.stringify(d).slice(0, 160)}`);
        return Number(d.balance);
    }

    /** Wycena przed wysłaniem: kredyty, około USD, saldo konta, czy wystarczy, rozmiar pliku. */
    async function wycen(id, zlecenie) {
        const z = oczyscZlecenie(zlecenie);
        const { bajty } = await plikBryly(id);
        const mb = Math.round((bajty.length / 1e6) * 10) / 10;
        const w = wycena(z);
        const s = await saldo();
        return { zlecenie: z, ...w, saldo: s, wystarczy: s >= w.kredyty, mb, zaDuzy: mb > MAX_MB };
    }

    async function sledz(zad) {
        const t0 = Date.now();
        while (Date.now() - t0 < limitMs) {
            await new Promise((r) => setTimeout(r, coMs));
            let d;
            try {
                const r = await f(`${BAZA}/${sciezka(zad.zlecenie)}/${zad.meshyId}`, { headers: naglowki(), signal: AbortSignal.timeout(20000) });
                d = await r.json();
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
            } catch { continue; }   // mrugnięcie sieci — następna próba
            zad.postep = Number(d.progress) || 0;
            zad.stan = String(d.status ?? '').toLowerCase();
            if (d.status === 'SUCCEEDED') {
                const url = d.model_urls?.glb;
                if (!url) throw new Error('Meshy skończyło, ale nie oddało GLB.');
                const glb = Buffer.from(await (await f(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer());
                zad.kredyty = Number(d.consumed_credits ?? zad.kredyty);
                zad.asset = (await zapiszWersje(zad.bryla, glb, { usluga: 'meshy', rodzaj: zad.zlecenie.rodzaj, zlecenie: zad.zlecenie, zadanie: zad.meshyId, kredyty: zad.kredyty, kiedy: new Date().toISOString() })).id;
                zad.stan = 'gotowe';
                await szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'praca', tresc: `☁️ Meshy: ${zad.zlecenie.rodzaj} „${zad.bryla}” gotowa → ${zad.asset} (${zad.kredyty} kredytów)`, dane: { asset: zad.asset } }).catch(() => {});
                return;
            }
            if (d.status === 'FAILED' || d.status === 'CANCELED') throw new Error(`Meshy: ${d.status}${d.task_error?.message ? ` — ${d.task_error.message}` : ''}`);
        }
        throw new Error(`Meshy nie skończyło w ${Math.round(limitMs / 60000)} min (zadanie ${zad.meshyId} — sprawdź w panelu Meshy).`);
    }

    /** Zlecenie — TYLKO z potwierdzoną kwotą (zgodaKredyty === wycena). Wraca od razu, praca w tle. */
    async function zlec(id, zlecenie, { zgodaKredyty } = {}) {
        const z = oczyscZlecenie(zlecenie);
        const w = wycena(z);
        if (Number(zgodaKredyty) !== w.kredyty) throw Object.assign(new Error(`Brak zgody na koszt: to zlecenie kosztuje ${w.kredyty} kredytów (≈ $${w.usdOkolo}) — potwierdź kwotę.`), { kod: 'BEZ_ZGODY' });
        const { bajty } = await plikBryly(id);
        if (bajty.length / 1e6 > MAX_MB) throw new Error(`Bryła ma ${(bajty.length / 1e6).toFixed(1)} MB — powyżej ${MAX_MB} MB nie wysyłam (najpierw „Uprość”).`);
        const r = await f(`${BAZA}/${sciezka(z)}`, {
            method: 'POST', headers: naglowki(), signal: AbortSignal.timeout(120000),
            body: JSON.stringify(cialoMeshy(z, `data:application/octet-stream;base64,${bajty.toString('base64')}`)),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.result) {
            const powod = { 401: 'zły klucz', 402: 'za mało kredytów na koncie Meshy', 429: 'limit zapytań — za chwilę' }[r.status] ?? '';
            throw new Error(`Meshy odmówiło (HTTP ${r.status}${powod ? ` — ${powod}` : ''}): ${JSON.stringify(d).slice(0, 200)}`);
        }
        const zad = { id: `ch-${Date.now().toString(36)}`, bryla: id, meshyId: d.result, zlecenie: z, kredyty: w.kredyty, stan: 'w-kolejce', postep: 0, od: new Date().toISOString(), asset: null, blad: null };
        zadania.set(zad.id, zad);
        sledz(zad).catch((e) => { zad.stan = 'blad'; zad.blad = e.message; void szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'blad', tresc: `☁️ Meshy „${id}”: ${e.message}` }).catch(() => {}); });
        return zad;
    }

    return { saldo, wycen, zlec, zadanie: (id) => zadania.get(id) ?? null, lista: () => [...zadania.values()], stan: () => ({ maKlucz: !!klucz(), cennik: CENNIK_MESHY, usdZaKredyt: USD_ZA_KREDYT }) };
}

export default { utworzChmureBryl, oczyscZlecenie, wycena, cialoMeshy, CENNIK_MESHY, USD_ZA_KREDYT };
