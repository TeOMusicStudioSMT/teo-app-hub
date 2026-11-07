/**
 * 🖨️🔄 Printful Sync (Suweren 2026-11-07: „ręczne wgrywanie 10 stref dla każdej kurtki w kreatorze zajmuje dużo czasu…
 * jednym przyciskiem z naszego Stołu przesłać pliki 300 DPI do Printfula z właściwą ceną detaliczną”).
 *
 * UCZCIWIE o tym, co API pozwala (dokumentacja developers.printful.com, 2026-11-07): dla sklepu POŁĄCZONEGO z Shopify
 * Printful NIE zakłada produktów przez API (`POST /store/products` jest tylko dla sklepów „Manual order / API”).
 * Produkt powstaje w Shopify (import `shopify-import-bestsellery.csv` ze Stołu) → Printful widzi go jako
 * „niezsynchronizowany” → TU: każdy wariant dostaje `PUT /store/variants/{id}` {variant_id z katalogu, retail_price,
 * files [{type: placement, url}]}. Wariant rozpoznajemy po SKU (Shopify → Printful), który pisze Stół — nic nie zgadujemy.
 * `retail_price` to cena w Printful; cenę w Shopify ustawia import CSV (albo Suweren w Shopify).
 *
 * Pliki: Printful pobiera je z PUBLICZNEGO adresu → `GET /wizytowka/printful/<token 32 hex>.png` przez tunel Katedry
 * (Straż: SCIEZKA_PRINTFUL), token losowy, ważny 72 h, tylko pliki z `sklep-shopify/<postać>/3-BESTSELLERY-…/`.
 * Token API Printful (prywatny, developers.printful.com) w Skarbcu 0.00G (`printful.api_token`), nigdy do przeglądarki.
 * Limit Printful: tworzenie/zmiana produktów 10 zapytań / 60 s → między PUT-ami 6,5 s, praca w tle.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const API = 'https://api.printful.com';
export const FOLDER_BESTSELLERY = '3-BESTSELLERY-PRINTFUL-I-ALL-OVER';
export const SCIEZKA_PLIKU = /^\/wizytowka\/printful\/([0-9a-f]{32})\.png$/;
const WAZNOSC_MS = 72 * 3600_000;
const ODSTEP_MS = 6500;

const blad = (m, kod = 400) => Object.assign(new Error(m), { kod });

/**
 * @param {{ katalog: string, wymiar: string, token: () => Promise<string|null>, zapiszToken?: (t: string|null) => Promise<void>,
 *   adres: () => Promise<string|null>, fetch?: typeof fetch, teraz?: () => number, czekaj?: (ms: number) => Promise<void> }} o
 *   katalog = `_OtakOs_Wymiar/sklep-shopify`, wymiar = `_OtakOs_Wymiar/printful` (ustawienia, linki, schowek szablonów)
 */
export function utworzPrintful({ katalog, wymiar, token, zapiszToken = async () => {}, adres, fetch: f = globalThis.fetch, teraz = () => Date.now(), czekaj = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
    const PLIK_UST = path.join(wymiar, 'ustawienia.json'), PLIK_LINKOW = path.join(wymiar, 'linki.json');
    const czytajJ = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const zapiszJ = async (p, v) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(v, null, 1)); };

    async function zapytanie(sciezka, { metoda = 'GET', cialo = null, sklep = true } = {}) {
        const t = await token();
        if (!t) throw blad('Brak tokenu Printful — wklej go w Stole Produktowym (developers.printful.com → Your tokens).', 409);
        const ust = await czytajJ(PLIK_UST, {});
        const h = { Authorization: `Bearer ${t}`, 'User-Agent': 'otakos-katedra' };
        if (sklep && ust.sklep) h['X-PF-Store-Id'] = String(ust.sklep);
        if (cialo) h['Content-Type'] = 'application/json';
        const r = await f(`${API}${sciezka}`, { method: metoda, headers: h, body: cialo ? JSON.stringify(cialo) : undefined, signal: AbortSignal.timeout(30_000) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || (d.code && d.code >= 400)) {
            const m = d?.error?.message || d?.result || `HTTP ${r.status}`;
            throw blad(`Printful ${metoda} ${sciezka}: ${typeof m === 'string' ? m : JSON.stringify(m)}`, r.status === 401 ? 401 : r.status === 429 ? 429 : 502);
        }
        return d.result;
    }

    // ── 🔑 token i sklep ──
    async function ustawToken(nowy) {
        const t = String(nowy ?? '').trim();
        if (!t) { await zapiszToken(null); await zapiszJ(PLIK_UST, {}); return { polaczony: false }; }
        if (!/^[A-Za-z0-9_.-]{20,200}$/.test(t)) throw blad('To nie wygląda na token Printful (developers.printful.com → Your tokens → Create token).');
        // sprawdź, zanim zapiszesz
        const r = await f(`${API}/stores`, { headers: { Authorization: `Bearer ${t}`, 'User-Agent': 'otakos-katedra' }, signal: AbortSignal.timeout(30_000) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw blad(`Printful odrzucił token: ${d?.error?.message || d?.result || `HTTP ${r.status}`}`, 401);
        const sklepy = Array.isArray(d.result) ? d.result : [];
        const wybrany = sklepy.find((s) => /shopify/i.test(String(s.type)) && /teo-mas/i.test(JSON.stringify(s))) ?? sklepy.find((s) => /shopify/i.test(String(s.type))) ?? sklepy[0] ?? null;
        await zapiszToken(t);
        await zapiszJ(PLIK_UST, { sklep: wybrany?.id ?? null, nazwa: wybrany?.name ?? null, typ: wybrany?.type ?? null, kiedy: new Date(teraz()).toISOString() });
        return stan();
    }
    async function stan() {
        const t = await token();
        const ust = await czytajJ(PLIK_UST, {});
        if (!t) return { polaczony: false, powod: 'brak tokenu Printful w Skarbcu', sklep: null };
        try {
            const sklepy = await zapytanie('/stores', { sklep: false });
            return { polaczony: true, sklep: ust.sklep ? { id: ust.sklep, nazwa: ust.nazwa, typ: ust.typ } : null, sklepy: (sklepy ?? []).map((s) => ({ id: s.id, nazwa: s.name, typ: s.type })) };
        } catch (e) { return { polaczony: false, powod: e.message, sklep: ust.sklep ? { id: ust.sklep, nazwa: ust.nazwa } : null }; }
    }
    async function wybierzSklep(id) {
        const s = (await zapytanie('/stores', { sklep: false })).find((x) => String(x.id) === String(id));
        if (!s) throw blad('Nie ma takiego sklepu na koncie Printful.', 404);
        await zapiszJ(PLIK_UST, { sklep: s.id, nazwa: s.name, typ: s.type, kiedy: new Date(teraz()).toISOString() });
        return stan();
    }

    // ── 📐 szablony (printfiles) — schowek 7 dni ──
    async function printfiles(id) {
        const n = Number(id);
        if (!Number.isInteger(n) || n <= 0) throw blad('Zły numer produktu katalogu.');
        const plik = path.join(wymiar, `printfiles-${n}.json`);
        const sch = await czytajJ(plik, null);
        if (sch && teraz() - sch.kiedy < 7 * 24 * 3600_000) return sch.dane;
        const r = await zapytanie(`/mockup-generator/printfiles/${n}`);
        const dane = {
            produkt: n,
            miejsca: r.available_placements ?? {},
            printfiles: (r.printfiles ?? []).map((p) => ({ printfile_id: p.printfile_id, width: p.width, height: p.height, dpi: p.dpi, fill_mode: p.fill_mode, can_rotate: p.can_rotate })),
            warianty: Object.fromEntries((r.variant_printfiles ?? []).map((v) => [String(v.variant_id), v.placements ?? {}])),
        };
        await zapiszJ(plik, { kiedy: teraz(), dane });
        return dane;
    }

    // ── 📦 manifesty bestsellerów: SKU → wariant katalogu, cena, pliki ──
    async function mapaSku() {
        const mapa = new Map();
        for (const d of await fs.readdir(katalog, { withFileTypes: true }).catch(() => [])) {
            if (!d.isDirectory()) continue;
            const baza = path.join(katalog, d.name, FOLDER_BESTSELLERY);
            const m = await czytajJ(path.join(baza, 'produkty.json'), null);
            if (!m?.produkty) continue;
            for (const p of m.produkty) for (const w of p.warianty ?? []) {
                const pliki = {};
                for (const [placement, rel] of Object.entries(w.pliki ?? {})) {
                    const abs = path.resolve(baza, String(rel));
                    if (abs.startsWith(baza + path.sep) && fsSync.existsSync(abs)) pliki[placement] = abs;
                }
                mapa.set(String(w.sku).toUpperCase(), { postac: d.name, produkt: p.klucz, tytul: p.tytul, katalogId: p.katalogId, variantId: w.variantId, cena: Number(w.cenaEur), wartosc: w.wartosc, pliki });
            }
        }
        return mapa;
    }

    // ── 🔗 publiczne linki do plików (Printful pobiera z tunelu) ──
    async function link(abs) {
        const baza = await adres();
        if (!baza) throw blad('Printful pobiera pliki z publicznego adresu — włącz tunel Katedry (Tunel → Start), potem synchronizuj.', 409);
        const linki = (await czytajJ(PLIK_LINKOW, {}));
        for (const [k, v] of Object.entries(linki)) if (v.wazne < teraz()) delete linki[k];
        const istn = Object.entries(linki).find(([, v]) => v.plik === abs && v.wazne - teraz() > 24 * 3600_000);
        const tok = istn?.[0] ?? crypto.randomBytes(16).toString('hex');
        if (!istn) linki[tok] = { plik: abs, wazne: teraz() + WAZNOSC_MS };
        await zapiszJ(PLIK_LINKOW, linki);
        return `${String(baza).replace(/\/+$/, '')}/wizytowka/printful/${tok}.png`;
    }
    async function plikZLinku(tok) {
        const v = (await czytajJ(PLIK_LINKOW, {}))[tok];
        if (!v || v.wazne < teraz()) return null;
        const abs = path.resolve(v.plik), kat = path.resolve(katalog);
        if (!abs.startsWith(kat + path.sep) || !abs.includes(`${path.sep}${FOLDER_BESTSELLERY}${path.sep}`) || !abs.endsWith('.png')) return null;
        return fsSync.existsSync(abs) ? abs : null;
    }

    // ── 🛍️ produkty sklepu w Printful ──
    async function wszystkieProdukty() {
        const out = [];
        for (let offset = 0; offset < 2000; offset += 100) {
            const r = await zapytanie(`/store/products?limit=100&offset=${offset}`);
            out.push(...(r ?? []));
            if (!r || r.length < 100) break;
        }
        return out;
    }
    async function produkty() {
        const [lista, mapa] = await Promise.all([wszystkieProdukty(), mapaSku()]);
        return {
            produkty: lista.map((p) => ({ id: p.id, nazwa: p.name, wariantow: p.variants, zsynchronizowanych: p.synced, miniatura: p.thumbnail_url ?? null, ignorowany: !!p.is_ignored })),
            katedra: { wariantow: mapa.size, produktow: new Set([...mapa.values()].map((x) => `${x.postac}/${x.produkt}`)).size },
        };
    }

    // ── 🔄 synchronizacja w tle ──
    let zadanie = null;
    function stanZadania() { return zadanie; }
    async function synchronizuj({ produkt = null, takzeZsynchronizowane = false } = {}) {
        if (zadanie?.stan === 'robi') throw blad('Synchronizacja z Printful już trwa.', 409);
        if (!(await token())) throw blad('Brak tokenu Printful.', 409);
        if (!(await adres())) throw blad('Printful pobiera pliki z publicznego adresu — włącz tunel Katedry, potem synchronizuj.', 409);
        zadanie = { stan: 'robi', start: new Date(teraz()).toISOString(), krok: 'lista produktów Printful…', zrobione: [], pominiete: [], bledy: [] };
        const z = zadanie;
        (async () => {
            const mapa = await mapaSku();
            if (!mapa.size) throw blad('W sklep-shopify nie ma manifestów bestsellerów — narysuj je w TeO Fashion Studio.');
            const lista = (await wszystkieProdukty()).filter((p) => (produkt ? String(p.id) === String(produkt) : true) && !p.is_ignored);
            let pierwszy = true;
            for (const p of lista) {
                if (!produkt && !takzeZsynchronizowane && p.synced >= p.variants) continue;
                z.krok = `${p.name}: warianty…`;
                const d = await zapytanie(`/store/products/${p.id}`);
                for (const sv of d.sync_variants ?? []) {
                    const m = mapa.get(String(sv.sku ?? '').toUpperCase());
                    if (!m) { z.pominiete.push({ produkt: p.name, wariant: sv.name, powod: `SKU „${sv.sku ?? '—'}” nie pochodzi ze Stołu Katedry` }); continue; }
                    if (sv.synced && !takzeZsynchronizowane && !produkt) continue;
                    if (!Object.keys(m.pliki).length) { z.bledy.push({ produkt: p.name, wariant: sv.name, powod: 'brak plików na dysku' }); continue; }
                    try {
                        const files = [];
                        for (const [type, abs] of Object.entries(m.pliki)) files.push({ type, url: await link(abs) });
                        if (!pierwszy) await czekaj(ODSTEP_MS);
                        pierwszy = false;
                        z.krok = `${p.name} · ${m.wartosc}: wysyłam ${files.length} plik(ów)…`;
                        await zapytanie(`/store/variants/${sv.id}`, { metoda: 'PUT', cialo: { variant_id: m.variantId, retail_price: m.cena.toFixed(2), files } });
                        z.zrobione.push({ produkt: p.name, wariant: sv.name, variantId: m.variantId, cena: m.cena, plikow: files.length });
                    } catch (e) {
                        z.bledy.push({ produkt: p.name, wariant: sv.name, powod: e.message });
                        if (e.kod === 401) throw e;
                        if (e.kod === 429) await czekaj(60_000);
                    }
                }
            }
        })().then(() => { z.stan = 'gotowe'; z.krok = null; }, (e) => { z.stan = 'blad'; z.krok = null; z.powod = e.message; }).finally(() => { z.koniec = new Date(teraz()).toISOString(); });
        return { zadanie: z };
    }

    return { stan, ustawToken, wybierzSklep, printfiles, produkty, mapaSku, link, plikZLinku, synchronizuj, stanZadania };
}

/** Trasy: `/api/printful/*` (Straż: maszyna), publicznie tylko `GET /wizytowka/printful/<token>.png` (SCIEZKA_PRINTFUL). */
export function zamontujTrasyPrintful(app, P) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    app.get('/api/printful/stan', (_req, res) => odp(res, P.stan().then((s) => ({ ...s, zadanie: P.stanZadania() }))));
    app.put('/api/printful/token', (req, res) => odp(res, P.ustawToken(req.body?.token ?? null)));
    app.put('/api/printful/sklep', (req, res) => odp(res, P.wybierzSklep(req.body?.sklep)));
    app.get('/api/printful/printfiles/:id', (req, res) => odp(res, P.printfiles(req.params.id)));
    app.get('/api/printful/produkty', (_req, res) => odp(res, P.produkty()));
    app.post('/api/printful/synchronizuj', (req, res) => odp(res, P.synchronizuj(req.body ?? {})));
    app.get('/api/printful/zadanie', (_req, res) => res.json({ success: true, zadanie: P.stanZadania() }));
    app.get(SCIEZKA_PLIKU, async (req, res) => {
        const m = SCIEZKA_PLIKU.exec(req.path);
        const p = m ? await P.plikZLinku(m[1]).catch(() => null) : null;
        if (!p) return res.status(404).end();
        res.setHeader('Cache-Control', 'no-store');
        res.type('png').sendFile(p);
    });
}

export default { utworzPrintful, zamontujTrasyPrintful, SCIEZKA_PLIKU, FOLDER_BESTSELLERY };
