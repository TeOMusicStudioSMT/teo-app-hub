/**
 * ☁️🗿 Dopracowanie brył w chmurze — Meshy (Suweren 2026-10-07: „udoskonalenie assetów w chmurze tanio”; plan:
 * „z kosztem pokazanym przed wysłaniem i zgodą”; 2026-10-09: „co jeszcze może dla nas robić plan premium Meshy…
 * dla jakich segmentów naszych produkcji… zrealizuj”).
 *
 * Zlecenia (docs.meshy.ai, odczyt 2026-10-09; `CENNIK_MESHY`):
 *   · RETEKSTURA — nowe tekstury z opisu stylu (≤ 800 znaków): 10 kredytów (2K/4K), 15 (8K); opcjonalnie PBR,
 *   · REMESH     — nowa topologia (trójkąty / czworokąty), 100–300 000 ścian: 5 kredytów,
 *   · OBRAZ3D    — Image-to-3D z obrazu, z którego powstała bryła (Meshy 7.1 z teksturami: 30 kr. 2K/4K, 35 kr. 8K;
 *                  Meshy 6 lite 2K: 15 kr.) — chmurowa alternatywa TRELLIS dla brył-bohaterów (gry, film, fashion),
 *   · RIG        — auto-rigging postaci humanoidalnej (5 kr.) z darmowym CHODEM i BIEGIEM + akcje z biblioteki Meshy
 *                  (3 kr. za akcję, ≤ 10, jeden plik) — „Ruch brył etap 2” (chód/gesty) dla gry i filmu. Rig potrzebuje
 *                  TEKSTUROWANEJ bryły (najpierw retekstura albo obraz3d); twarz postaci w stronę +Z.
 * Bryła idzie jako plik (data URI base64) — nic nie wystawiamy publicznie. Kredyty: ≈ $0,02/kredyt
 * (`OTAKOS_MESHY_USD_ZA_KREDYT`), trybu testowego Meshy nie ma.
 *
 * ZGODA: `zlec` wymaga `zgodaKredyty` równego wycenie (UI pokazuje kwotę i saldo, Suweren klika) — bez tego nic
 * nie wychodzi z Katedry. Wynik: GLB z TEKSTURAMI → nowa wersja bryły obok starej (model.glb z teksturą ≤ 2K pod
 * kartę graficzną, master.glb w pełnej rozdzielczości); rig dokłada ruchy (`ruch-chod|bieg|akcje.glb`) do tej wersji.
 */
export const CENNIK_MESHY = {
    zrodlo: 'docs.meshy.ai/api/pricing (2026-10-09)',
    retekstura: { '2k': 10, '4k': 10, '8k': 15 },
    remesh: 5,
    obraz3d: { latest: { '2k': 30, '4k': 30, '8k': 35 }, 'meshy-6-lite': { '2k': 15 } },
    rig: 5, akcja: 3,
};
export const USD_ZA_KREDYT = Number(process.env.OTAKOS_MESHY_USD_ZA_KREDYT) || 0.02;
export const MAX_MB = 20;
export const MAX_AKCJI = 10;
const BAZA = process.env.OTAKOS_MESHY_URL || 'https://api.meshy.ai/openapi/v1';
const SCIEZKA = { retekstura: 'retexture', remesh: 'remesh', obraz3d: 'image-to-3d', rig: 'rigging' };

/** Zlecenie od Suwerena → sprawdzone. */
export function oczyscZlecenie(z = {}) {
    const rodzaj = SCIEZKA[z.rodzaj] ? z.rodzaj : null;
    if (!rodzaj) throw new Error('Rodzaj: retekstura albo remesh (albo obraz3d, rig).');
    if (rodzaj === 'retekstura') {
        const styl = String(z.styl ?? '').trim().slice(0, 800);
        if (styl.length < 3) throw new Error('Retekstura: opisz styl (np. „czarna sierść mieniąca się jak opal, świecące bursztynowe oko”).');
        const rozdzielczosc = ['2k', '4k', '8k'].includes(z.rozdzielczosc) ? z.rozdzielczosc : '2k';
        return { rodzaj, styl, rozdzielczosc, pbr: !!z.pbr, oryginalneUV: !!z.oryginalneUV };
    }
    if (rodzaj === 'obraz3d') {
        const model = z.model === 'meshy-6-lite' ? 'meshy-6-lite' : 'latest';
        const rozdzielczosc = ['2k', '4k', '8k'].includes(z.rozdzielczosc) ? z.rozdzielczosc : '2k';
        if (!CENNIK_MESHY.obraz3d[model][rozdzielczosc]) throw new Error('Meshy 6 lite robi tylko tekstury 2K — wybierz 2K albo Meshy 7.1.');
        const poza = ['a-pose', 't-pose'].includes(z.poza) ? z.poza : '';
        return { rodzaj, model, rozdzielczosc, pbr: !!z.pbr, poza };
    }
    if (rodzaj === 'rig') {
        const wzrost = Number(z.wzrost ?? 1.7);
        if (!(wzrost >= 0.2 && wzrost <= 5)) throw new Error('Wzrost postaci: od 0,2 do 5 m.');
        const akcje = [...new Set((Array.isArray(z.akcje) ? z.akcje : []).map((x) => Math.round(Number(x))).filter((x) => Number.isInteger(x) && x >= 0))];
        if (akcje.length > MAX_AKCJI) throw new Error(`Najwyżej ${MAX_AKCJI} akcji w jednym zleceniu.`);
        return { rodzaj, wzrost: Math.round(wzrost * 100) / 100, akcje };
    }
    const sciany = Math.round(Number(z.sciany) || 30000);
    if (sciany < 100 || sciany > 300000) throw new Error('Remesh: od 100 do 300 000 ścian.');
    return { rodzaj, sciany, topologia: z.topologia === 'quad' ? 'quad' : 'triangle' };
}

/** Wycena: kredyty z cennika i około USD. */
export function wycena(z) {
    const kredyty = z.rodzaj === 'remesh' ? CENNIK_MESHY.remesh
        : z.rodzaj === 'obraz3d' ? CENNIK_MESHY.obraz3d[z.model][z.rozdzielczosc]
            : z.rodzaj === 'rig' ? CENNIK_MESHY.rig + CENNIK_MESHY.akcja * z.akcje.length
                : CENNIK_MESHY.retekstura[z.rozdzielczosc];
    return { kredyty, usdOkolo: Math.round(kredyty * USD_ZA_KREDYT * 100) / 100, cennik: CENNIK_MESHY.zrodlo };
}

/** Ciało zapytania Meshy ze sprawdzonego zlecenia. `wejscie` = data URI pliku (GLB albo obraz) albo { zadanie } Meshy. */
export function cialoMeshy(z, wejscie) {
    if (z.rodzaj === 'remesh') return { model_url: wejscie, topology: z.topologia, target_polycount: z.sciany, target_formats: ['glb'] };
    if (z.rodzaj === 'obraz3d') return { image_url: wejscie, ai_model: z.model, should_texture: true, enable_pbr: z.pbr, texture_resolution: z.rozdzielczosc, ...(z.poza ? { pose_mode: z.poza } : {}), target_formats: ['glb'] };
    if (z.rodzaj === 'rig') return { ...(typeof wejscie === 'object' && wejscie?.zadanie ? { input_task_id: wejscie.zadanie } : { model_url: wejscie }), height_meters: z.wzrost };
    return { model_url: wejscie, text_style_prompt: z.styl, texture_resolution: z.rozdzielczosc, enable_pbr: z.pbr, enable_original_uv: z.oryginalneUV, target_formats: ['glb'] };
}

/**
 * 👁️ Styl retekstury ze zdjęcia bryły (Suweren 2026-10-09: „jeśli tylko wpiszę styl… może niech idzie auto ze zdjęcia”):
 * model widzący (oczy Katedry) opisuje MATERIAŁY i BARWY obiektu z obrazu, z którego powstała bryła — po angielsku,
 * jak przykłady promptów Meshy. Opis bryły i jej poprawki (świecące oko) idą jako wskazówka.
 */
export function promptStylu({ opis = '', swiatlo = null } = {}) {
    return [
        'This image shows a single object that was turned into a 3D model. Write a texture style prompt for re-texturing it (Meshy AI).',
        'Describe ONLY surfaces: materials, colors, patterns, wear, sheen, emissive parts. No camera, background, pose or story.',
        opis ? `Object description from its maker: ${String(opis).slice(0, 300)}` : null,
        swiatlo ? `It has a glowing part (emissive) of color ${swiatlo}.` : null,
        'Answer with ONE paragraph in English, at most 600 characters, nothing else.',
    ].filter(Boolean).join('\n');
}
/** Odpowiedź modelu → styl (bez cudzysłowów, nagłówków, ≤ 800 znaków); za krótka = błąd wprost. */
export function oczyscStyl(t) {
    const s = String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*(style( prompt)?|prompt)\s*:\s*/i, '').replace(/^["'„”\s]+|["'„”\s]+$/g, '').replace(/\s+/g, ' ').trim();
    if (s.length < 15) throw new Error(`Oczy Katedry nie opisały tekstur (odpowiedź: „${s.slice(0, 80)}”).`);
    return s.slice(0, 800);
}

/** Wpis biblioteki animacji Meshy → bezpieczna postać. */
export function akcjaZBiblioteki(a) {
    if (!a || !Number.isInteger(a.action_id)) return null;
    const t = (v, n) => String(v ?? '').slice(0, n);
    return { id: a.action_id, nazwa: t(a.name, 80), klucz: t(a.key, 80), kategoria: t(a.category, 40), podkategoria: t(a.sub_category, 60), podglad: /^https:\/\//.test(a.preview_url ?? '') ? a.preview_url : null };
}

/**
 * @param {{ klucz: () => string|null, plikBryly: (id: string) => Promise<{ sciezka: string, bajty: Buffer }>,
 *           obrazBryly?: (id: string) => Promise<Buffer>, metaBryly?: (id: string) => Promise<object|null>,
 *           zapiszWersje: (id: string, glb: Buffer, wpis: object) => Promise<object>,
 *           zapiszRuch?: (id: string, ruch: string, glb: Buffer, wpis: object) => Promise<unknown>,
 *           szyna?: object|null, fetch?: Function, coMs?: number, limitMs?: number }} o
 */
export function utworzChmureBryl({ klucz, plikBryly, obrazBryly = null, metaBryly = async () => null, zapiszWersje, zapiszRuch = null, szyna = null, fetch: f = globalThis.fetch, coMs = 5000, limitMs = 30 * 60_000 }) {
    const zadania = new Map();
    let biblioteka = { kiedy: 0, lista: null };
    const naglowki = () => {
        const k = klucz();
        if (!k) throw Object.assign(new Error('Brak klucza Meshy — Hub → TeO Kibel (msy_…) → „🔗 Udostępnij mostowi”.'), { kod: 'BEZ_KLUCZA' });
        return { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' };
    };

    async function saldo() {
        const r = await f(`${BAZA}/balance`, { headers: naglowki(), signal: AbortSignal.timeout(15000) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Meshy (saldo) HTTP ${r.status}: ${JSON.stringify(d).slice(0, 160)}`);
        return Number(d.balance);
    }

    /** Co idzie do Meshy dla tego zlecenia: data URI pliku bryły / obrazu albo id zadania Meshy (rig). */
    async function wejscie(id, z) {
        if (z.rodzaj === 'obraz3d') {
            if (!obrazBryly) throw new Error('Ta Katedra nie podaje obrazu bryły.');
            const b = await obrazBryly(id);
            const mime = b[0] === 0x89 ? 'image/png' : 'image/jpeg';
            return { wartosc: `data:${mime};base64,${b.toString('base64')}`, mb: b.length / 1e6 };
        }
        if (z.rodzaj === 'rig') {
            const m = await metaBryly(id);
            if (!m?.tekstury) throw new Error('Rig potrzebuje bryły z TEKSTURAMI — najpierw „Retekstura” albo „Image-to-3D” w chmurze, potem rig tej nowej wersji.');
            if (m.chmura?.zadanie && ['retekstura', 'obraz3d'].includes(m.chmura.rodzaj)) return { wartosc: { zadanie: m.chmura.zadanie }, mb: 0 };
        }
        const { bajty } = await plikBryly(id);
        return { wartosc: `data:application/octet-stream;base64,${bajty.toString('base64')}`, mb: bajty.length / 1e6 };
    }

    /** Wycena przed wysłaniem: kredyty, około USD, saldo konta, czy wystarczy, rozmiar pliku. */
    async function wycen(id, zlecenie) {
        const z = oczyscZlecenie(zlecenie);
        const we = await wejscie(id, z);
        const mb = Math.round(we.mb * 10) / 10;
        const w = wycena(z);
        const s = await saldo();
        return { zlecenie: z, ...w, saldo: s, wystarczy: s >= w.kredyty, mb, zaDuzy: mb > MAX_MB };
    }

    /** Czekanie na zadanie Meshy: `sciezka`/id → obiekt zadania po SUCCEEDED; FAILED/CANCELED/limit = błąd wprost. */
    async function czekaj(zad, sciezka, meshyId) {
        const t0 = Date.now();
        while (Date.now() - t0 < limitMs) {
            await new Promise((r) => setTimeout(r, coMs));
            let d;
            try {
                const r = await f(`${BAZA}/${sciezka}/${meshyId}`, { headers: naglowki(), signal: AbortSignal.timeout(20000) });
                d = await r.json();
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
            } catch { continue; }   // mrugnięcie sieci — następna próba
            zad.postep = Number(d.progress) || 0;
            zad.stan = String(d.status ?? '').toLowerCase();
            if (d.status === 'SUCCEEDED') return d;
            if (d.status === 'FAILED' || d.status === 'CANCELED') throw new Error(`Meshy: ${d.status}${d.task_error?.message ? ` — ${d.task_error.message}` : ''}`);
        }
        throw new Error(`Meshy nie skończyło w ${Math.round(limitMs / 60000)} min (zadanie ${meshyId} — sprawdź w panelu Meshy).`);
    }
    const pobierz = async (url) => Buffer.from(await (await f(url, { signal: AbortSignal.timeout(180000) })).arrayBuffer());

    async function sledz(zad) {
        const z = zad.zlecenie;
        const d = await czekaj(zad, SCIEZKA[z.rodzaj], zad.meshyId);
        let kredyty = Number(d.consumed_credits ?? zad.kredyty);
        const url = z.rodzaj === 'rig' ? d.result?.rigged_character_glb_url : d.model_urls?.glb;
        if (!url) throw new Error('Meshy skończyło, ale nie oddało GLB.');
        const glb = await pobierz(url);
        const wpis = { usluga: 'meshy', rodzaj: z.rodzaj, zlecenie: z, zadanie: zad.meshyId, kredyty, kiedy: new Date().toISOString() };
        const nowa = await zapiszWersje(zad.bryla, glb, wpis);
        zad.asset = nowa.id;
        if (z.rodzaj === 'rig') {
            // 🦴 darmowy chód i bieg z riggingu + akcje z biblioteki (osobne zadanie animacji)
            zad.ruchy = [];
            const podst = d.result?.basic_animations ?? {};
            for (const [ruch, u] of [['chod', podst.walking_glb_url], ['bieg', podst.running_glb_url]]) {
                if (!u || !zapiszRuch) continue;
                try { await zapiszRuch(nowa.id, ruch, await pobierz(u), { zrodlo: 'meshy', opis: ruch === 'chod' ? 'chód (Meshy)' : 'bieg (Meshy)' }); zad.ruchy.push(ruch); }
                catch (e) { zad.uwagi = [...(zad.uwagi ?? []), `${ruch}: ${e.message}`]; }
            }
            if (z.akcje.length && zapiszRuch) {
                zad.stan = 'animacje';
                const r = await f(`${BAZA}/animations`, { method: 'POST', headers: naglowki(), signal: AbortSignal.timeout(60000), body: JSON.stringify({ rig_task_id: zad.meshyId, action_ids: z.akcje }) });
                const a = await r.json().catch(() => ({}));
                if (!r.ok || !a.result) throw new Error(`Rig gotowy (${nowa.id}, ruchy: ${zad.ruchy.join(', ') || 'brak'}), ale Meshy odmówiło animacji (HTTP ${r.status}): ${JSON.stringify(a).slice(0, 160)}`);
                const da = await czekaj(zad, 'animations', a.result);
                kredyty += Number(da.consumed_credits ?? 0);
                const ua = da.result?.animation_glb_url;
                if (!ua) throw new Error('Meshy skończyło animacje, ale nie oddało GLB.');
                await zapiszRuch(nowa.id, 'akcje', await pobierz(ua), { zrodlo: 'meshy', opis: `akcje Meshy: ${z.akcje.join(', ')}`, akcje: z.akcje });
                zad.ruchy.push('akcje');
            }
        }
        zad.kredyty = kredyty;
        zad.stan = 'gotowe';
        await szyna?.nadaj?.({ agent: 'Assety3D', rodzaj: 'praca', tresc: `☁️ Meshy: ${z.rodzaj} „${zad.bryla}” gotowa → ${zad.asset}${zad.ruchy?.length ? ` (ruchy: ${zad.ruchy.join(', ')})` : ''} (${kredyty} kredytów)`, dane: { asset: zad.asset } }).catch(() => {});
    }

    /** Zlecenie — TYLKO z potwierdzoną kwotą (zgodaKredyty === wycena). Wraca od razu, praca w tle. */
    async function zlec(id, zlecenie, { zgodaKredyty } = {}) {
        const z = oczyscZlecenie(zlecenie);
        const w = wycena(z);
        if (Number(zgodaKredyty) !== w.kredyty) throw Object.assign(new Error(`Brak zgody na koszt: to zlecenie kosztuje ${w.kredyty} kredytów (≈ $${w.usdOkolo}) — potwierdź kwotę.`), { kod: 'BEZ_ZGODY' });
        const we = await wejscie(id, z);
        if (we.mb > MAX_MB) throw new Error(`Plik ma ${we.mb.toFixed(1)} MB — powyżej ${MAX_MB} MB nie wysyłam (najpierw „Uprość”).`);
        const r = await f(`${BAZA}/${SCIEZKA[z.rodzaj]}`, { method: 'POST', headers: naglowki(), signal: AbortSignal.timeout(120000), body: JSON.stringify(cialoMeshy(z, we.wartosc)) });
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

    /** 📚 Biblioteka animacji Meshy (darmowa) — z pamięci na godzinę; filtr po kategorii / szukaj. */
    async function akcje({ kategoria = '', szukaj = '' } = {}) {
        if (!biblioteka.lista || Date.now() - biblioteka.kiedy > 3600_000) {
            const r = await f(`${BAZA}/animations/library`, { headers: naglowki(), signal: AbortSignal.timeout(20000) });
            const d = await r.json().catch(() => null);
            if (!r.ok) throw new Error(`Meshy (biblioteka animacji) HTTP ${r.status}: ${JSON.stringify(d).slice(0, 160)}`);
            const surowa = Array.isArray(d) ? d : Array.isArray(d?.result) ? d.result : Array.isArray(d?.animations) ? d.animations : [];
            biblioteka = { kiedy: Date.now(), lista: surowa.map(akcjaZBiblioteki).filter(Boolean) };
        }
        const s = String(szukaj).toLowerCase();
        return biblioteka.lista.filter((a) => (!kategoria || a.kategoria === kategoria) && (!s || a.nazwa.toLowerCase().includes(s) || a.klucz.toLowerCase().includes(s)));
    }

    return { saldo, wycen, zlec, akcje, zadanie: (id) => zadania.get(id) ?? null, lista: () => [...zadania.values()], stan: () => ({ maKlucz: !!klucz(), cennik: CENNIK_MESHY, usdZaKredyt: USD_ZA_KREDYT }) };
}

export default { utworzChmureBryl, oczyscZlecenie, wycena, cialoMeshy, promptStylu, oczyscStyl, akcjaZBiblioteki, CENNIK_MESHY, USD_ZA_KREDYT, MAX_AKCJI };
