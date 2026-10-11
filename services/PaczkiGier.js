/**
 * 🏝️ PACZKI GIER — gra Katedry jako podpisana paczka dla innych Katedr (2026-10-11).
 *
 * Suweren: „inni mogą zagrać w Teterhię i pojawić się na wyspie Suwerena, a jego komputer nie płonie —
 * gra liczy się u GRAJĄCEGO”.
 *
 * AUTOR (ta Katedra, gdy udostępnia):
 *   · `udostepnij(gra)` — `dist/` gry z `_OtakOs_Apki/<gra>` (z public/assety, filmy) → zip w `_OtakOs_Wymiar/gry-paczki/<gra>/`
 *     + manifest {gra, nazwa, wersja, sha256, bajtow, autor (nick wizytówki), klucz, podpis}. Podpis ed25519 kluczem
 *     wizytówki nad `trescManifestu` — tej samej, którą sprawdza Katedra kupującego.
 *   · Publicznie (Straż: `czyWizytowka`) tylko odczyt: `/wizytowka/gra/<gra>.json|.zip` i pliki gry dla gościa
 *     `/wizytowka/gra/<gra>/…` — wyłącznie gier z listy `gry-udostepnione.json`. Paczka idzie z ograniczoną
 *     przepustowością i ograniczoną liczbą pobrań naraz; gości wyspy jest najwyżej `OTAKOS_GOSCIE_MAX` (8).
 *
 * KUPUJĄCY (inna Katedra, tylko przy maszynie):
 *   · `instaluj({nick, gra})` — adres i klucz autora z rejestru otakos.wtf → manifest → podpis kluczem Z REJESTRU
 *     (nie z manifestu) → zip z limitem rozmiaru i SHA-256 → rozpakowanie TYLKO do `_OtakOs_Apki/<gra>-<nick>/dist`
 *     (ścieżki sprawdzane, bez dowiązań). Katalogu, który nie jest zainstalowaną paczką, nie nadpisuje nigdy.
 *
 * ⚠️ UCZCIWIE: przelewu GRV między Katedrami jeszcze nie ma (etap 4). Paczka nie pobiera i nie udaje płatności.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { Transform } from 'stream';
import cors from 'cors';

const deflateRaw = promisify(zlib.deflateRaw);
export const ID_GRY = /^[a-z0-9][a-z0-9-]{1,47}$/;
const NICK = /^[a-z0-9][a-z0-9-]{2,31}$/;
const MB = 1024 * 1024;
export const MAX_BAJTOW = Number(process.env.OTAKOS_GRA_MAX_MB || 1536) * MB;
const MAX_PLIKOW = 5000;
/** Tych plików nie ściskamy — już skompresowane albo binarne (szkoda procesora autora). */
const BEZ_KOMPRESJI = /\.(glb|gltf|bin|mp4|webm|mov|png|jpe?g|webp|gif|avif|wav|mp3|ogg|m4a|flac|zip|gz|ktx2|basis|woff2?)$/i;

/** Treść podpisu manifestu — ta sama funkcja po stronie autora i kupującego. */
export const trescManifestu = (m) => `otakos-gra\n${m.gra}\n${m.wersja}\n${m.sha256}\n${m.bajtow}\n${m.autor}`;

/** Wersja jak w paczce Katedry: yyyy.MM.dd.HHmm (UTC). */
export function wersjaZDaty(t = Date.now()) {
    const d = new Date(t), p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}.${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

/** Katalog instalacji u kupującego: `<gra>-<nick>` (musi mieścić się w identyfikatorze /apki/:id). */
export function katalogInstalacji(gra, nick) {
    const id = `${gra}-${nick}`;
    if (!ID_GRY.test(gra) || !NICK.test(nick) || id.length > 48) throw new Error(`Nazwa katalogu „${id}” jest za długa albo zła (do 48 znaków a–z, 0–9, „-”).`);
    return id;
}

// ── zip (bez zależności; store/deflate, bez zip64 — limit < 4 GB) ─────────────
async function plikiKatalogu(kat, baza = kat, wynik = []) {
    for (const e of await fs.readdir(kat, { withFileTypes: true })) {
        const p = path.join(kat, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) await plikiKatalogu(p, baza, wynik);
        else if (e.isFile()) wynik.push(path.relative(baza, p).split(path.sep).join('/'));
    }
    return wynik;
}

/** Pakuje katalog do zipa (strumieniowo, plik po pliku). Zwraca { sha256, bajtow, plikow }. */
export async function spakujKatalog(kat, docelowy) {
    const nazwy = (await plikiKatalogu(kat)).sort();
    if (nazwy.length > MAX_PLIKOW) throw new Error(`Gra ma ${nazwy.length} plików — limit paczki to ${MAX_PLIKOW}.`);
    await fs.mkdir(path.dirname(docelowy), { recursive: true });
    const out = fsSync.createWriteStream(docelowy);
    const hash = crypto.createHash('sha256');
    let offset = 0;
    const pisz = (buf) => new Promise((ok, zle) => {
        hash.update(buf); offset += buf.length;
        if (offset > MAX_BAJTOW) return zle(new Error(`Paczka przekracza limit ${Math.round(MAX_BAJTOW / MB)} MB (OTAKOS_GRA_MAX_MB).`));
        out.write(buf, (e) => (e ? zle(e) : ok()));
    });
    const centralne = [];
    try {
        for (const nazwa of nazwy) {
            const dane = await fs.readFile(path.join(kat, ...nazwa.split('/')));
            const crc = zlib.crc32(dane);
            const scisk = !BEZ_KOMPRESJI.test(nazwa) && dane.length > 64;
            const tresc = scisk ? await deflateRaw(dane, { level: 6 }) : dane;
            const metoda = scisk && tresc.length < dane.length ? 8 : 0;
            const zapis = metoda === 8 ? tresc : dane;
            const imie = Buffer.from(nazwa, 'utf8');
            const lh = Buffer.alloc(30);
            lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(metoda, 8);
            lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);   // czas 00:00, data 1980-01-01 — paczka powtarzalna
            lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(zapis.length, 18); lh.writeUInt32LE(dane.length, 22);
            lh.writeUInt16LE(imie.length, 26); lh.writeUInt16LE(0, 28);
            centralne.push({ imie, crc, metoda, skomp: zapis.length, rozm: dane.length, offset });
            await pisz(lh); await pisz(imie); await pisz(zapis);
        }
        const start = offset;
        for (const c of centralne) {
            const ch = Buffer.alloc(46);
            ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
            ch.writeUInt16LE(c.metoda, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
            ch.writeUInt32LE(c.crc, 16); ch.writeUInt32LE(c.skomp, 20); ch.writeUInt32LE(c.rozm, 24);
            ch.writeUInt16LE(c.imie.length, 28); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(c.offset, 42);
            await pisz(ch); await pisz(c.imie);
        }
        const koniec = Buffer.alloc(22);
        koniec.writeUInt32LE(0x06054b50, 0); koniec.writeUInt16LE(centralne.length, 8); koniec.writeUInt16LE(centralne.length, 10);
        koniec.writeUInt32LE(offset - start, 12); koniec.writeUInt32LE(start, 16);
        await pisz(koniec);
        await new Promise((ok, zle) => out.end((e) => (e ? zle(e) : ok())));
    } catch (e) {
        out.destroy();
        await fs.rm(docelowy, { force: true });
        throw e;
    }
    return { sha256: hash.digest('hex'), bajtow: offset, plikow: nazwy.length };
}

/**
 * Rozpakowanie zipa TYLKO do `dokad`: ścieżki względne bez „..”, bez dowiązań, suma rozmiarów i liczba plików w limicie.
 * Najpierw przegląd wpisów (nic nie zapisujemy, gdy coś jest nie tak), potem zapis.
 */
export async function rozpakujBezpiecznie(zip, dokad, { maxBajtow = MAX_BAJTOW, maxPlikow = MAX_PLIKOW } = {}) {
    const yauzl = (await import('yauzl')).default;
    const otworz = () => new Promise((ok, zle) => yauzl.open(zip, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (e, z) => (e ? zle(e) : ok(z))));
    const baza = path.resolve(dokad);
    const wpisy = await new Promise(async (ok, zle) => {
        const z = await otworz().catch(zle); if (!z) return;
        const lista = []; let suma = 0;
        z.on('error', zle);
        z.on('entry', (e) => {
            const nazwa = e.fileName;
            const tryb = (e.externalFileAttributes >>> 16) & 0o170000;
            if (tryb === 0o120000) { z.close(); return zle(new Error(`Paczka ma dowiązanie „${nazwa}” — odrzucona.`)); }
            if (nazwa.includes('\\') || nazwa.startsWith('/') || nazwa.split('/').includes('..') || /^[a-z]:/i.test(nazwa)) { z.close(); return zle(new Error(`Zła ścieżka w paczce: „${nazwa}”.`)); }
            const cel = path.resolve(baza, ...nazwa.split('/'));
            if (cel !== baza && !cel.startsWith(baza + path.sep)) { z.close(); return zle(new Error(`Ścieżka „${nazwa}” wychodzi poza katalog gry.`)); }
            if (!nazwa.endsWith('/')) {
                suma += e.uncompressedSize;
                lista.push(nazwa);
                if (lista.length > maxPlikow) { z.close(); return zle(new Error(`Paczka ma ponad ${maxPlikow} plików.`)); }
                if (suma > maxBajtow) { z.close(); return zle(new Error(`Paczka po rozpakowaniu przekracza ${Math.round(maxBajtow / MB)} MB.`)); }
            }
            z.readEntry();
        });
        z.on('end', () => ok(lista));
        z.readEntry();
    });
    if (!wpisy.includes('index.html')) throw new Error('Paczka nie ma index.html w korzeniu — to nie jest zbudowana gra.');
    await fs.mkdir(baza, { recursive: true });
    const z = await otworz();
    await new Promise((ok, zle) => {
        z.on('error', zle);
        z.on('entry', (e) => {
            if (e.fileName.endsWith('/')) return z.readEntry();
            const cel = path.resolve(baza, ...e.fileName.split('/'));
            fs.mkdir(path.dirname(cel), { recursive: true }).then(() => z.openReadStream(e, (err, rs) => {
                if (err) return zle(err);
                const ws = fsSync.createWriteStream(cel);
                rs.on('error', zle); ws.on('error', zle);
                ws.on('finish', () => z.readEntry());
                rs.pipe(ws);
            }), zle);
        });
        z.on('end', ok);
        z.readEntry();
    });
    return { plikow: wpisy.length };
}

// ── ochrona komputera gospodarza ─────────────────────────────────────────────
/** Strumień z ograniczeniem przepustowości (bajtów/s) — paczka i pliki gościa nie zapychają łącza Suwerena. */
export function dlawik(bajtowNaS) {
    let okno = Date.now(), wyslane = 0;
    return new Transform({
        transform(chunk, _enc, cb) {
            const idz = () => {
                const t = Date.now();
                if (t - okno >= 1000) { okno = t; wyslane = 0; }
                if (wyslane >= bajtowNaS) return void setTimeout(idz, 1000 - (t - okno));
                wyslane += chunk.length;
                cb(null, chunk);
            };
            idz();
        },
    });
}

/**
 * Limit gości wyspy: gość = adres (cf-connecting-ip) widziany w ostatnich `oknoMs`. Znany gość przechodzi zawsze,
 * nowy — tylko gdy jest miejsce. Czyste (zegar wstrzykiwany) — testowalne.
 */
export function utworzLimitGosci({ max = Number(process.env.OTAKOS_GOSCIE_MAX || 8), oknoMs = 3 * 60_000, teraz = () => Date.now() } = {}) {
    const goscie = new Map();
    const sprzataj = () => { const g = teraz() - oknoMs; for (const [k, t] of goscie) if (t < g) goscie.delete(k); };
    return {
        max,
        wpusc(kto) {
            sprzataj();
            const k = String(kto || '?');
            if (!goscie.has(k) && goscie.size >= max) return false;
            goscie.set(k, teraz());
            return true;
        },
        aktywni() { sprzataj(); return goscie.size; },
    };
}

/**
 * @param {{ katalog: string, katalogApek: string, nick: () => Promise<string>, klucz: () => Promise<string>,
 *           podpisz: (t: string) => Promise<string>, rejestr: string, fetch?: Function, teraz?: () => number, szyna?: object }} o
 */
export function utworzPaczkiGier({ katalog, katalogApek, nick, klucz, podpisz, rejestr, fetch: f = globalThis.fetch, teraz = () => Date.now(), szyna = null }) {
    const PLIK = path.join(katalog, 'gry-udostepnione.json');
    const kat = (gra) => path.join(katalog, 'gry-paczki', gra);
    const czytaj = async () => { try { return JSON.parse(await fs.readFile(PLIK, 'utf8')); } catch { return { gry: {} }; } };
    const zapisz = async (d) => { await fs.mkdir(katalog, { recursive: true }); await fs.writeFile(PLIK, JSON.stringify(d, null, 2), 'utf8'); };
    const sprawdzId = (gra) => { if (!ID_GRY.test(String(gra ?? ''))) throw new Error('Zły identyfikator gry (a–z, 0–9, „-”, do 48 znaków).'); return gra; };
    const nazwaGry = async (gra) => {
        for (const p of ['projekt.json', 'gdd.json']) {
            try { const d = JSON.parse(await fs.readFile(path.join(katalogApek, gra, p), 'utf8')); const n = d.nazwa || d.tytul || d.name; if (n) return String(n).slice(0, 80); } catch { /* brak */ }
        }
        return gra;
    };

    /** Gry tej Katedry, które da się udostępnić (zbudowany dist z index.html) — i co już udostępnione. */
    async function lista() {
        const d = await czytaj();
        const gry = [];
        let wpisy = [];
        try { wpisy = await fs.readdir(katalogApek, { withFileTypes: true }); } catch { /* brak katalogu */ }
        for (const e of wpisy) {
            if (!e.isDirectory() || !ID_GRY.test(e.name)) continue;
            if (!fsSync.existsSync(path.join(katalogApek, e.name, 'dist', 'index.html'))) continue;
            const zrodlo = await czytajZrodlo(e.name);
            gry.push({ id: e.name, nazwa: await nazwaGry(e.name), zainstalowana: zrodlo, udostepniona: d.gry[e.name] ?? null });
        }
        return gry;
    }
    async function czytajZrodlo(id) { try { return JSON.parse(await fs.readFile(path.join(katalogApek, id, 'zrodlo-paczki.json'), 'utf8')); } catch { return null; } }

    async function udostepnij(gra, { cenaGRV = 333 } = {}) {
        sprawdzId(gra);
        const autor = await nick();
        if (!autor) throw new Error('Ta Katedra nie ma nicka wizytówki — ustaw go w karcie Wystawy (🪪), bo paczkę podpisuje Katedra z nickiem.');
        const dist = path.join(katalogApek, gra, 'dist');
        if (!fsSync.existsSync(path.join(dist, 'index.html'))) throw new Error(`Gra „${gra}” nie jest zbudowana (brak dist/index.html) — zbuduj ją najpierw.`);
        if (await czytajZrodlo(gra)) throw new Error('To gra zainstalowana z cudzej paczki — udostępnia ją jej autor, nie ta Katedra.');
        const tmp = path.join(kat(gra), `paczka-${teraz()}.zip`);
        const { sha256, bajtow, plikow } = await spakujKatalog(dist, tmp);
        await fs.rename(tmp, path.join(kat(gra), 'paczka.zip'));
        const m = { gra, nazwa: await nazwaGry(gra), wersja: wersjaZDaty(teraz()), sha256, bajtow, plikow, autor, klucz: await klucz(), utworzono: new Date(teraz()).toISOString() };
        m.podpis = await podpisz(trescManifestu(m));
        await fs.writeFile(path.join(kat(gra), 'manifest.json'), JSON.stringify(m, null, 2), 'utf8');
        const d = await czytaj();
        d.gry[gra] = { ...(d.gry[gra] ?? {}), nazwa: m.nazwa, wersja: m.wersja, bajtow, udostepniono: m.utworzono, cenaGRV: Math.max(0, Math.floor(Number(cenaGRV) || 0)) };
        await zapisz(d);
        await szyna?.nadaj?.({ agent: 'kodeks', rodzaj: 'praca', tresc: `🏝️ Gra „${m.nazwa}” udostępniona jako paczka ${m.wersja} (${Math.round(bajtow / MB)} MB, podpisana).` })?.catch?.(() => {});
        return { manifest: m, wpis: d.gry[gra] };
    }

    async function ustawProdukt(gra, produkt) { const d = await czytaj(); if (d.gry[gra]) { d.gry[gra].produkt = produkt; await zapisz(d); } }

    async function wycofaj(gra) {
        sprawdzId(gra);
        const d = await czytaj();
        const byl = d.gry[gra] ?? null;
        delete d.gry[gra];
        await zapisz(d);
        await fs.rm(kat(gra), { recursive: true, force: true });
        return byl;
    }

    /** Czy gra jest udostępniona (tylko takie wychodzą publicznie). */
    async function udostepniona(gra) { return ID_GRY.test(String(gra ?? '')) && !!(await czytaj()).gry[gra]; }
    async function manifest(gra) {
        if (!(await udostepniona(gra))) return null;
        try { return JSON.parse(await fs.readFile(path.join(kat(gra), 'manifest.json'), 'utf8')); } catch { return null; }
    }
    async function sciezkaZip(gra) { if (!(await udostepniona(gra))) return null; const p = path.join(kat(gra), 'paczka.zip'); return fsSync.existsSync(p) ? p : null; }
    /** Pliki gry dla gościa (bieżący build udostępnionej gry) — ścieżka tylko wewnątrz dist. */
    async function plikGoscia(gra, rel) {
        if (!(await udostepniona(gra))) return null;
        const dist = path.resolve(katalogApek, gra, 'dist');
        let r; try { r = decodeURIComponent(String(rel || 'index.html')); } catch { return null; }
        if (!r || r.endsWith('/')) r += 'index.html';
        const p = path.resolve(dist, ...r.split('/'));
        if (!p.startsWith(dist + path.sep)) return null;
        try { return (await fs.stat(p)).isFile() ? p : null; } catch { return null; }
    }
    /** Do publicznej wizytówki: co ta Katedra daje do zagrania (rejestr podaje to dalej). */
    async function publiczne() {
        const d = await czytaj();
        return Object.entries(d.gry).filter(([id]) => fsSync.existsSync(path.join(kat(id), 'manifest.json'))).slice(0, 5)
            .map(([id, w]) => ({ id, nazwa: w.nazwa, wersja: w.wersja, bajtow: w.bajtow }));
    }

    // ── kupujący ──
    async function katedraZRejestru(n) {
        const r = await f(rejestr, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'otakos-katedra' } });
        if (!r.ok) throw new Error(`Rejestr otakos.wtf odpowiedział HTTP ${r.status}.`);
        const k = ((await r.json())?.katedry ?? []).find((x) => x?.nick === n);
        if (!k) throw new Error(`Katedry „${n}” nie ma teraz w rejestrze (offline albo niezatwierdzona).`);
        if (!/^https:\/\/[a-z0-9.-]+$/i.test(String(k.adres ?? '')) || !k.klucz) throw new Error(`Rejestr nie podał adresu https i klucza Katedry „${n}”.`);
        return k;
    }

    async function instaluj({ nick: n, gra } = {}) {
        n = String(n ?? '').trim().toLowerCase(); gra = String(gra ?? '').trim();
        if (!NICK.test(n)) throw new Error('Zły nick Katedry autora.');
        sprawdzId(gra);
        const id = katalogInstalacji(gra, n);
        if (n === await nick()) throw new Error('To Twoja własna gra — gra już jest w tej Katedrze.');
        const cel = path.join(katalogApek, id);
        if (fsSync.existsSync(cel) && !(await czytajZrodlo(id))) throw new Error(`Katalog „${id}” istnieje i nie jest zainstalowaną paczką — nie nadpisuję cudzej pracy.`);
        const k = await katedraZRejestru(n);
        const rm = await f(`${k.adres}/wizytowka/gra/${gra}.json`, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
        if (!rm.ok) throw new Error(`Katedra „${n}” nie udostępnia gry „${gra}” (HTTP ${rm.status}).`);
        const m = await rm.json();
        if (m?.gra !== gra || m?.autor !== n) throw new Error('Manifest mówi o innej grze albo innym autorze — odrzucony.');
        if (!/^[0-9a-f]{64}$/.test(String(m.sha256)) || !Number.isInteger(m.bajtow) || m.bajtow <= 0) throw new Error('Manifest bez poprawnej sumy SHA-256 i rozmiaru — odrzucony.');
        if (m.bajtow > MAX_BAJTOW) throw new Error(`Paczka ma ${Math.round(m.bajtow / MB)} MB — limit tej Katedry to ${Math.round(MAX_BAJTOW / MB)} MB (OTAKOS_GRA_MAX_MB).`);
        let ok = false;
        try { ok = crypto.verify(null, Buffer.from(trescManifestu(m), 'utf8'), crypto.createPublicKey({ key: Buffer.from(k.klucz, 'base64'), format: 'der', type: 'spki' }), Buffer.from(String(m.podpis ?? ''), 'base64')); } catch { ok = false; }
        if (!ok) throw new Error(`Podpis manifestu nie zgadza się z kluczem Katedry „${n}” z rejestru — paczka odrzucona (podszyta albo uszkodzona).`);

        const robocze = path.join(katalog, 'gry-pobrane', `${id}-${teraz()}`);
        await fs.mkdir(robocze, { recursive: true });
        try {
            const zip = path.join(robocze, 'paczka.zip');
            const rz = await f(`${k.adres}/wizytowka/gra/${gra}.zip`, { signal: AbortSignal.timeout(60 * 60_000), redirect: 'error' });
            if (!rz.ok) throw new Error(`Pobranie paczki: HTTP ${rz.status}.`);
            const hash = crypto.createHash('sha256');
            let ile = 0;
            const ws = fsSync.createWriteStream(zip);
            const zapiszKawalek = (b) => new Promise((ok2, zle) => {
                ile += b.length;
                if (ile > m.bajtow) return zle(new Error('Paczka większa, niż mówi manifest — przerwane.'));
                hash.update(b); ws.write(b, (e) => (e ? zle(e) : ok2()));
            });
            try {
                if (rz.body?.getReader) { const r = rz.body.getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; await zapiszKawalek(Buffer.from(value)); } }
                else await zapiszKawalek(Buffer.from(await rz.arrayBuffer()));
            } finally { await new Promise((x) => ws.end(x)); }
            if (ile !== m.bajtow) throw new Error(`Paczka ma ${ile} B, manifest mówi ${m.bajtow} B — odrzucona.`);
            if (hash.digest('hex') !== m.sha256) throw new Error('Suma SHA-256 paczki nie zgadza się z podpisanym manifestem — odrzucona.');
            const nowy = path.join(robocze, 'gra');
            await rozpakujBezpiecznie(zip, path.join(nowy, 'dist'));
            const zrodlo = { nick: n, gra, nazwa: String(m.nazwa ?? gra).slice(0, 80), wersja: m.wersja, sha256: m.sha256, bajtow: m.bajtow, klucz: k.klucz, adres: k.adres, zainstalowano: new Date(teraz()).toISOString() };
            await fs.writeFile(path.join(nowy, 'zrodlo-paczki.json'), JSON.stringify(zrodlo, null, 2), 'utf8');
            await fs.rm(cel, { recursive: true, force: true });
            await fs.mkdir(katalogApek, { recursive: true });
            await fs.rename(nowy, cel);
            await szyna?.nadaj?.({ agent: 'kodeks', rodzaj: 'praca', tresc: `🏝️ Zainstalowana gra „${zrodlo.nazwa}” od Katedry „${n}” (${m.wersja}, podpis i SHA-256 sprawdzone).` })?.catch?.(() => {});
            return { id, url: `/apki/${id}/`, ...zrodlo };
        } finally {
            await fs.rm(robocze, { recursive: true, force: true });
        }
    }

    /** Gry do zagrania w sieci: Katedry online z rejestru, które coś udostępniają (pole `paczkiGier`). */
    async function wSieci() {
        const r = await f(rejestr, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'otakos-katedra' } });
        if (!r.ok) throw new Error(`Rejestr otakos.wtf odpowiedział HTTP ${r.status}.`);
        const ja = await nick();
        return ((await r.json())?.katedry ?? []).filter((k) => k?.nick !== ja && Array.isArray(k?.paczkiGier) && k.paczkiGier.length)
            .map((k) => ({ nick: k.nick, adres: k.adres, gry: k.paczkiGier }));
    }

    /**
     * 🏝️ Wyspa gospodarza dla gry gracza (`?katedra=<nick>`): tylko adresy PLIKÓW statycznych z tunelu gospodarza
     * (postać, assety udostępnionej gry) i event dnia z rejestru — żadnego wywołania /api gospodarza.
     */
    async function gospodarz(n, { gra = null } = {}) {
        if (!NICK.test(String(n ?? ''))) throw new Error('Zły nick.');
        const k = await katedraZRejestru(n);
        const paczki = Array.isArray(k.paczkiGier) ? k.paczkiGier : [];
        const p = (gra && paczki.find((x) => x.id === gra)) || paczki.find((x) => /teterhia/.test(x.id)) || paczki[0] || null;
        return {
            nick: k.nick, adres: k.adres, motto: k.motto ?? '', wlasna: k.nick === await nick(),
            postac: k.postac?.glb ? { imie: k.postac.imie, plec: k.postac.plec, opis: k.postac.opis, ruch: k.postac.ruch ?? null, glb: k.postac.glb } : null,
            mistrz: k.mistrz?.teterhia ? { event: String(k.mistrz.teterhia).slice(0, 80), etap: k.mistrz.etap ?? null } : null,
            gra: p ? { id: p.id, nazwa: p.nazwa, baza: `${k.adres}/wizytowka/gra/${p.id}/` } : null,
        };
    }

    return { lista, udostepnij, wycofaj, ustawProdukt, udostepniona, manifest, sciezkaZip, plikGoscia, publiczne, instaluj, wSieci, gospodarz };
}

/**
 * Trasy paczek gier w moście (wiesio-bridge.js). Publiczne `/wizytowka/gra/…` przepuszcza Straż (`czyWizytowka`),
 * `/api/gry/*` — tylko maszyna (SCIEZKI_TYLKO_LOKALNE). Osobno od mostu, żeby test sprawdzał prawdziwe trasy na Expressie.
 * @param {import('express').Express} app
 * @param {{ paczki: ReturnType<typeof utworzPaczkiGier>, nick: () => Promise<string|null>, wczytajRynek: () => Promise<{products: object[]}>,
 *           zapiszRynek: () => Promise<void>, limit?: ReturnType<typeof utworzLimitGosci>, bps?: number, maxPobran?: number }} o
 */
export function zamontujTrasyGier(app, { paczki, nick, wczytajRynek, zapiszRynek, limit = utworzLimitGosci(), bps = Number(process.env.OTAKOS_PACZKA_KBPS || 2048) * 1024, maxPobran = Number(process.env.OTAKOS_PACZKA_POBRANIA || 2) }) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(kod).json({ success: false, message: e.message }));
    const GoscieWyspy = limit;
    const PACZKA_BPS = bps;
    const MAX_POBRAN_PACZKI = maxPobran;
    let pobieraniaPaczki = 0;
    const ktoGosc = (req) => req.get('cf-connecting-ip') || req.ip || '?';
    const WYSPA_PELNA = (max) => `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wyspa pełna</title>
    <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1220;color:#e2e8f0;font:16px system-ui;text-align:center;padding:16px">
    <div><div style="font-size:48px">🏝️</div><h1 style="font-size:22px">Wyspa pełna</h1><p>Na tej wyspie gra już ${max} gości — komputer Suwerena nie przyjmie więcej naraz.</p><p>Spróbuj za chwilę.</p>
    <button onclick="location.reload()" style="padding:10px 18px;border-radius:10px;border:1px solid #34d399;background:#064e3b;color:#ecfdf5;font-size:16px">↻ Spróbuj ponownie</button></div></body></html>`;
    /** Plik z ograniczoną przepustowością (Range dla nagłówków GLB, reszta strumieniem przez dławik). */
    async function wyslijDlawiony(req, res, plik, { cache = 'public, max-age=600' } = {}) {
        const st = await fs.stat(plik);
        res.type(path.extname(plik) || 'application/octet-stream');
        res.set('Cache-Control', cache); res.set('Accept-Ranges', 'bytes'); res.set('Last-Modified', st.mtime.toUTCString());
        let start = 0, koniec = st.size - 1;
        const zakres = /^bytes=(\d*)-(\d*)$/.exec(String(req.get('range') || ''));
        if (zakres && (zakres[1] || zakres[2])) {
            start = zakres[1] ? Number(zakres[1]) : Math.max(0, st.size - Number(zakres[2]));
            koniec = zakres[1] && zakres[2] ? Math.min(Number(zakres[2]), st.size - 1) : st.size - 1;
            if (start > koniec || start >= st.size) { res.set('Content-Range', `bytes */${st.size}`); return res.status(416).end(); }
            res.status(206).set('Content-Range', `bytes ${start}-${koniec}/${st.size}`);
        }
        res.set('Content-Length', String(koniec - start + 1));
        if (req.method === 'HEAD') return res.end();
        const strumien = fsSync.createReadStream(plik, { start, end: koniec });
        res.on('close', () => strumien.destroy());
        strumien.pipe(dlawik(PACZKA_BPS)).pipe(res);
    }
    app.get(/^\/wizytowka\/gra\/([a-z0-9-]{2,48})\.json$/, cors({ origin: '*' }), async (req, res) => {
        const m = await paczki.manifest(req.params[0]).catch(() => null);
        if (!m) return res.status(404).json({ success: false, message: 'Ta Katedra nie udostępnia takiej gry.' });
        res.set('Cache-Control', 'no-cache'); return res.json(m);
    });
    app.get(/^\/wizytowka\/gra\/([a-z0-9-]{2,48})\.zip$/, cors({ origin: '*' }), async (req, res) => {
        const zip = await paczki.sciezkaZip(req.params[0]).catch(() => null);
        if (!zip) return res.status(404).json({ success: false, message: 'Ta Katedra nie udostępnia takiej gry.' });
        if (pobieraniaPaczki >= MAX_POBRAN_PACZKI) { res.set('Retry-After', '60'); return res.status(503).json({ success: false, message: `Paczkę pobiera teraz ${pobieraniaPaczki} Katedr — spróbuj za minutę (ochrona łącza Suwerena).` }); }
        pobieraniaPaczki++;
        let zwolnione = false; const zwolnij = () => { if (!zwolnione) { zwolnione = true; pobieraniaPaczki--; } };
        res.on('close', zwolnij);
        try { await wyslijDlawiony(req, res, zip, { cache: 'no-cache' }); } catch (e) { zwolnij(); if (!res.headersSent) res.status(500).json({ success: false, message: e.message }); }
    });
    app.get(/^\/wizytowka\/gra\/([a-z0-9-]{2,48})$/, (req, res) => res.redirect(301, `/wizytowka/gra/${req.params[0]}/`));
    // 🎮 Gość z telefonu (otakos.wtf → „Zagraj na tej wyspie”): sama gra, statycznie; w trybie gościa gra nie woła /api tej Katedry.
    app.get(/^\/wizytowka\/gra\/([a-z0-9-]{2,48})\/(.*)$/, cors({ origin: '*' }), async (req, res) => {
        const plik = await paczki.plikGoscia(req.params[0], req.params[1]).catch(() => null);
        if (!plik) return res.status(404).json({ success: false, message: 'Nie ma takiego pliku w udostępnionej grze.' });
        if (!req.lokalny && !GoscieWyspy.wpusc(ktoGosc(req))) { res.set('Retry-After', '60'); return res.status(503).type('html').send(WYSPA_PELNA(GoscieWyspy.max)); }
        if (/\.html$/i.test(plik)) { res.set('Cache-Control', 'no-cache'); return res.sendFile(plik); }
        try { return await wyslijDlawiony(req, res, plik); } catch (e) { if (!res.headersSent) res.status(500).json({ success: false, message: e.message }); }
    });
    app.get('/api/gry', async (_req, res) => {
        try { res.json({ success: true, nick: await nick(), gry: await paczki.lista(), goscie: { aktywni: GoscieWyspy.aktywni(), max: GoscieWyspy.max }, paczka: { kbps: PACZKA_BPS / 1024, pobrania: MAX_POBRAN_PACZKI } }); }
        catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });
    app.post('/api/gry/udostepnij', async (req, res) => {
        try {
            const gra = String(req.body?.gra ?? '');
            const { manifest: m, wpis } = await paczki.udostepnij(gra, { cenaGRV: req.body?.cenaGRV ?? 333 });
            // 🛒 wpis w Marketplace tej Katedry — UCZCIWIE: przelewu GRV między Katedrami jeszcze nie ma (etap 4)
            const rynek = await wczytajRynek();
            const opis = `Gra Katedry „${m.autor}” jako podpisana paczka (${m.wersja}, ${Math.round(m.bajtow / 1048576)} MB). Instaluje się w Katedrze grającego i tam się liczy. Płatność: ręczne potwierdzenie między Suwerenami — przelew GRV między Katedrami to etap 4, instalacja niczego nie pobiera.`;
            const payload = { gra, nick: m.autor, wersja: m.wersja, paczka: `/wizytowka/gra/${gra}.zip`, manifest: `/wizytowka/gra/${gra}.json`, instaluj: { nick: m.autor, gra }, platnosc: 'reczna' };
            let produkt = rynek.products.find((p) => p.module === 'teterhia' && p.type === 'gra' && p.payload?.gra === gra && p.payload?.nick === m.autor);
            if (produkt) Object.assign(produkt, { name: m.nazwa, desc: opis, priceGrv: wpis.cenaGRV, payload });
            else { produkt = { id: `teterhia-gra-${gra}-${Date.now().toString(36)}`.slice(0, 60), module: 'teterhia', type: 'gra', name: m.nazwa, desc: opis, priceGrv: wpis.cenaGRV, creator: m.autor, votes: 0, createdAt: Date.now(), payload }; rynek.products.push(produkt); }
            await zapiszRynek();
            await paczki.ustawProdukt(gra, produkt.id);
            res.json({ success: true, manifest: m, wpis: { ...wpis, produkt: produkt.id }, produkt });
        } catch (e) { res.status(400).json({ success: false, message: e.message }); }
    });
    app.delete('/api/gry/udostepnij/:gra', async (req, res) => {
        try {
            const byl = await paczki.wycofaj(req.params.gra);
            if (byl?.produkt) { const rynek = await wczytajRynek(); rynek.products = rynek.products.filter((p) => p.id !== byl.produkt); await zapiszRynek(); }
            res.json({ success: true, wycofano: byl });
        } catch (e) { res.status(400).json({ success: false, message: e.message }); }
    });
    app.get('/api/gry/siec', (_req, res) => odp(res, paczki.wSieci().then((katedry) => ({ katedry })), 502));
    app.post('/api/gry/instaluj', async (req, res) => {
        try { res.json({ success: true, gra: await paczki.instaluj({ nick: req.body?.nick, gra: req.body?.gra }) }); }
        catch (e) { res.status(400).json({ success: false, message: e.message }); }
    });
    // 🏝️ Wyspa gospodarza dla gry gracza (?katedra=<nick>): adresy plików z tunelu gospodarza + event z rejestru — bez /api gospodarza
    app.get('/api/gry/gospodarz/:nick', (req, res) => odp(res, paczki.gospodarz(String(req.params.nick).toLowerCase(), { gra: req.query.gra ? String(req.query.gra) : null }).then((gospodarz) => ({ gospodarz })), 502));
}

export default { utworzPaczkiGier, zamontujTrasyGier, utworzLimitGosci, spakujKatalog, rozpakujBezpiecznie, trescManifestu, wersjaZDaty, katalogInstalacji, dlawik, ID_GRY, MAX_BAJTOW };
