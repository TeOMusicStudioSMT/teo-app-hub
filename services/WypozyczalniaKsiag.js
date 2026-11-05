/**
 * 📚 Wypożyczalnia Żywych Ksiąg — teostory.studio (Suweren 2026-11-05: „Netflix dla interaktywnych książek… do wypożyczenia”).
 * Silnik czytnika (TeO Story Studio, moduł produkcyjny) PUBLIKUJE księgę do Katedry; portal teostory.studio czyta katalog
 * i wypożycza przez tunel Katedry — jak Sklep Mini (services/SklepMini.js), bez własnego serwera z danymi.
 *
 * Księga = JSON silnika (Storybook: title, subtitle, author, pages[{narrativeText, dialogueLines, imageUrl…}]) →
 * `_OtakOs_Wymiar/teostory/ksiegi/<id>.json` + wpis w `katalog.json`. Poziom (`tier`): `demo` = czytanie za darmo,
 * `rental_48h` = Stripe Checkout (cena liczona TU, nie w przeglądarce) → dostęp 48 h od pierwszego odbioru opłaconej sesji.
 * Dostęp = identyfikator opłaconej sesji Stripe (sprawdzany u Stripe, schowek w services/Stripe.js) + `wypozyczenia.json`.
 * NIE ma tu portfela mGRV dla gości — goście strony nie są węzłami księgi GRV (przelew GRV między Katedrami = 🏝️ Gry).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TIERY = ['demo', 'rental_48h'];
export const GODZIN_WYPOZYCZENIA = 48;
export const DOMYSLNA_CENA_EUR = 1.99;
export const MAX_BAJTOW_KSIEGI = 40 * 1024 * 1024;
export const MAX_STRON = 300;
const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const ORIGINY = (process.env.OTAKOS_TEOSTORY_ORIGINY || 'https://teostory.studio,https://www.teostory.studio').split(',').map((x) => x.trim()).filter(Boolean);

const tekst = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export function idKsiegi(wej) {
    const z = String(wej ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
    return ID.test(z) ? z : `ks-${crypto.randomBytes(4).toString('hex')}`;
}
/** Adres powrotu po płatności — tylko portal teostory.studio (albo `OTAKOS_TEOSTORY_ORIGINY`), inaczej strona odbioru mostu. */
export function dozwolonyPowrot(u, originy = ORIGINY) {
    try { const x = new URL(String(u)); return x.protocol === 'https:' && originy.includes(x.origin) ? x.origin + x.pathname : null; } catch { return null; }
}

/** Sprawdza księgę silnika i robi wpis katalogu. Rzuca z powodem. */
export function sprawdzKsiege(book, { tier = 'rental_48h', cenaEur = DOMYSLNA_CENA_EUR } = {}) {
    if (!book || typeof book !== 'object') throw new Error('Brak księgi (pole „book”).');
    const tytul = tekst(book.title, 200);
    if (!tytul) throw new Error('Księga nie ma tytułu.');
    const strony = Array.isArray(book.pages) ? book.pages : [];
    if (!strony.length) throw new Error('Księga nie ma stron.');
    if (strony.length > MAX_STRON) throw new Error(`Za dużo stron (${strony.length} > ${MAX_STRON}).`);
    if (!strony.some((s) => tekst(s?.narrativeText, 10))) throw new Error('Żadna strona nie ma tekstu narracji.');
    if (!TIERY.includes(tier)) throw new Error(`Poziom: ${TIERY.join(', ')} (vip_full jeszcze nie ma).`);
    const cena = Math.round(Number(cenaEur) * 100) / 100;
    if (tier === 'rental_48h' && !(cena >= 0.5 && cena <= 100)) throw new Error('Cena wypożyczenia: 0,50–100 €.');
    const bajtow = Buffer.byteLength(JSON.stringify(book));
    if (bajtow > MAX_BAJTOW_KSIEGI) throw new Error(`Księga za duża (${Math.round(bajtow / 1e6)} MB > ${MAX_BAJTOW_KSIEGI / 1e6} MB) — obrazy jako adresy, nie dataURL.`);
    return {
        tytul, podtytul: tekst(book.subtitle, 200), autor: tekst(book.author, 120), stron: strony.length, tier,
        cenaEur: tier === 'demo' ? 0 : cena, bajtow,
        opis: tekst(strony.find((s) => s?.narrativeText)?.narrativeText, 280),
        narrator: tekst(book.narrator ?? book.modelsUsed?.narrator, 80) || null,
    };
}

/**
 * @param {{ katalog: string, stripe?: object|null, adres?: () => Promise<string|null>, teraz?: () => number }} o
 */
export function utworzWypozyczalnie({ katalog, stripe = null, adres = async () => null, teraz = () => Date.now() }) {
    const KAT = path.join(katalog, 'katalog.json'), KS = path.join(katalog, 'ksiegi'), WYP = path.join(katalog, 'wypozyczenia.json');
    let kolejka = Promise.resolve();
    const poKolei = (fn) => { const p = kolejka.then(fn); kolejka = p.catch(() => {}); return p; };
    async function czytaj(p, zap) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return zap; } }
    async function zapisz(p, o) { await fs.mkdir(path.dirname(p), { recursive: true }); const t = `${p}.${process.pid}.tmp`; await fs.writeFile(t, JSON.stringify(o, null, 2)); await fs.rename(t, p); }
    const plikKsiegi = (id) => (ID.test(String(id)) ? path.join(KS, `${id}.json`) : null);

    /** Okładka: pierwszy obraz strony z adresem http(s) — dataURL zapisujemy jako plik obok księgi. */
    async function okladka(id, book) {
        const url = (book.pages ?? []).map((s) => s?.imageUrl ?? s?.plates?.[0]?.imageUrl).find((u) => typeof u === 'string' && u);
        if (!url) return null;
        const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(url);
        if (m) { const roz = m[1].replace('jpeg', 'jpg'); await fs.writeFile(path.join(KS, `${id}-okladka.${roz}`), Buffer.from(m[2], 'base64')); return `plik:${roz}`; }
        return /^https:\/\//.test(url) ? url.slice(0, 1000) : null;
    }

    function publikuj({ book, rentalTier = 'rental_48h', cenaEur = DOMYSLNA_CENA_EUR, pieczec = null } = {}) {
        return poKolei(async () => {
            const wpis = sprawdzKsiege(book, { tier: rentalTier, cenaEur });
            const id = idKsiegi(book.id || book.title);
            await fs.mkdir(KS, { recursive: true });
            await zapisz(path.join(KS, `${id}.json`), { ...book, id });
            const k = await czytaj(KAT, { ksiegi: [] });
            const stary = k.ksiegi.find((x) => x.id === id);
            const nowy = { id, ...wpis, okladka: await okladka(id, book), pieczec: pieczec ? tekst(pieczec, 120) : null,
                wystawiona: stary?.wystawiona ?? true, opublikowano: stary?.opublikowano ?? new Date(teraz()).toISOString(), zmieniono: new Date(teraz()).toISOString() };
            k.ksiegi = [nowy, ...k.ksiegi.filter((x) => x.id !== id)].slice(0, 500);
            await zapisz(KAT, k);
            return nowy;
        });
    }
    const ustawWystawienie = (id, tak) => poKolei(async () => {
        const k = await czytaj(KAT, { ksiegi: [] });
        const x = k.ksiegi.find((q) => q.id === id);
        if (!x) throw Object.assign(new Error('Nie ma takiej księgi.'), { kod: 404 });
        x.wystawiona = !!tak; await zapisz(KAT, k); return x;
    });
    const katalogPelny = async () => (await czytaj(KAT, { ksiegi: [] })).ksiegi;
    /** Publiczny katalog: tylko wystawione, bez ścieżek z dysku. */
    async function katalogPubliczny() {
        return (await katalogPelny()).filter((k) => k.wystawiona).map(({ okladka: o, bajtow: _b, wystawiona: _w, ...k }) => ({
            ...k, okladka: o?.startsWith('plik:') ? `/wizytowka/teostory/${k.id}/okladka` : o ?? null, godzinWypozyczenia: k.tier === 'demo' ? null : GODZIN_WYPOZYCZENIA,
        }));
    }
    async function plikOkladki(id) {
        const k = (await katalogPelny()).find((x) => x.id === id && x.wystawiona);
        if (!k?.okladka?.startsWith('plik:')) return null;
        const p = path.join(KS, `${id}-okladka.${k.okladka.slice(5)}`);
        return fsSync.existsSync(p) ? p : null;
    }

    async function wypozycz(id, { powrot = null } = {}) {
        const k = (await katalogPelny()).find((x) => x.id === id && x.wystawiona);
        if (!k) throw Object.assign(new Error('Tej księgi nie ma w wypożyczalni.'), { kod: 404 });
        if (k.tier === 'demo') return { darmowa: true };
        if (!stripe) throw Object.assign(new Error('Katedra nie przyjmuje teraz płatności.'), { kod: 503 });
        const s = await stripe.sesjaZakupu({ pakiet: { id: k.id, nazwa: `📚 ${k.tytul} — wypożyczenie ${GODZIN_WYPOZYCZENIA} h`, opis: k.opis || k.podtytul || 'Żywa Księga teostory.studio' },
            kwotaCentow: Math.round(k.cenaEur * 100), waluta: 'eur', powrot: await adres(), anuluj: dozwolonyPowrot(powrot),
            sukces: '/wizytowka/teostory/odbior', rodzaj: 'ksiega-48h', metadane: { powrot: dozwolonyPowrot(powrot) ?? '' } });
        return { url: s.url };
    }

    /** Opłacona sesja → wypożyczenie (start przy pierwszym odbiorze) → {ksiega, do, powrot}. Rzuca z powodem. */
    async function odbierz(sesja) {
        if (!stripe) throw Object.assign(new Error('Katedra nie przyjmuje teraz płatności.'), { kod: 503 });
        const s = await stripe.sprawdzSesje(String(sesja ?? ''));
        if (!s.oplacona) throw Object.assign(new Error('Płatność jeszcze nie przeszła.'), { kod: 402 });
        if (s.rodzaj !== 'ksiega-48h' || !s.pakiet) throw Object.assign(new Error('To nie jest wypożyczenie księgi.'), { kod: 400 });
        const w = await poKolei(async () => {
            const d = await czytaj(WYP, { wypozyczenia: [] });
            let x = d.wypozyczenia.find((q) => q.sesja === s.id);
            if (!x) { x = { sesja: s.id, ksiega: s.pakiet, od: new Date(teraz()).toISOString(), kwota: s.kwota, waluta: s.waluta, tryb: s.tryb }; d.wypozyczenia = [x, ...d.wypozyczenia].slice(0, 5000); await zapisz(WYP, d); }
            return x;
        });
        return { ksiega: w.ksiega, do: new Date(Date.parse(w.od) + GODZIN_WYPOZYCZENIA * 3600e3).toISOString(), powrot: dozwolonyPowrot(s.powrot) };
    }

    /** Pełna księga do czytania: demo bez niczego, wypożyczenie = opłacona sesja tej księgi w ciągu 48 h. */
    async function czytaj_(id, { sesja = null } = {}) {
        const k = (await katalogPelny()).find((x) => x.id === id && x.wystawiona);
        if (!k) throw Object.assign(new Error('Tej księgi nie ma w wypożyczalni.'), { kod: 404 });
        let doKiedy = null;
        if (k.tier !== 'demo') {
            if (!sesja) throw Object.assign(new Error('Ta księga jest do wypożyczenia — najpierw płatność.'), { kod: 402 });
            const o = await odbierz(sesja);
            if (o.ksiega !== id) throw Object.assign(new Error('To wypożyczenie dotyczy innej księgi.'), { kod: 403 });
            if (Date.parse(o.do) < teraz()) throw Object.assign(new Error(`Wypożyczenie wygasło (${GODZIN_WYPOZYCZENIA} h minęło).`), { kod: 410 });
            doKiedy = o.do;
        }
        const p = plikKsiegi(id);
        const book = p ? await czytaj(p, null) : null;
        if (!book) throw Object.assign(new Error('Księgi nie ma na dysku Katedry.'), { kod: 404 });
        return { ksiega: book, dostepDo: doKiedy };
    }

    return { publikuj, wystaw: (id) => ustawWystawienie(id, true), wycofaj: (id) => ustawWystawienie(id, false), katalogPelny, katalogPubliczny, plikOkladki, wypozycz, odbierz, czytaj: czytaj_,
        wypozyczenia: async () => (await czytaj(WYP, { wypozyczenia: [] })).wypozyczenia };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Trasy: Hub (Straż `/api/books`: maszyna) i publiczne `/wizytowka/teostory/…` (Straż: SCIEZKA_TEOSTORY / SCIEZKA_WYPOZYCZENIA). */
export function zamontujTrasyWypozyczalni(app, W, { limitNaMinute = 10 } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    const cors = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); };
    // Hub
    app.get('/api/books/catalog', (_req, res) => odp(res, W.katalogPelny().then((ksiegi) => ({ ksiegi }))));
    app.post('/api/books/publish', (req, res) => odp(res, W.publikuj(req.body ?? {}).then((wpis) => ({ wpis }))));
    app.post('/api/books/:id/wystaw', (req, res) => odp(res, W.wystaw(req.params.id).then((wpis) => ({ wpis }))));
    app.post('/api/books/:id/wycofaj', (req, res) => odp(res, W.wycofaj(req.params.id).then((wpis) => ({ wpis }))));
    app.post('/api/books/rent', (req, res) => odp(res, W.wypozycz(String(req.body?.id ?? ''), { powrot: req.body?.powrot })));
    app.get('/api/books/rentals', (_req, res) => odp(res, W.wypozyczenia().then((wypozyczenia) => ({ wypozyczenia }))));
    // Publiczne (portal teostory.studio przez tunel Katedry)
    const proby = new Map();
    app.get('/wizytowka/teostory', (_req, res) => { cors(res); odp(res, W.katalogPubliczny().then((ksiegi) => ({ ksiegi }))); });
    app.get('/wizytowka/teostory/:id/okladka', async (req, res) => { const p = await W.plikOkladki(req.params.id); return p ? res.sendFile(p) : res.status(404).end(); });
    app.get('/wizytowka/teostory/:id/czytaj', (req, res) => { cors(res); odp(res, W.czytaj(req.params.id, { sesja: req.query.sesja ? String(req.query.sesja) : null })); });
    app.options('/wizytowka/teostory/:id/wypozycz', (_req, res) => { cors(res); res.sendStatus(204); });
    app.post('/wizytowka/teostory/:id/wypozycz', (req, res) => {
        cors(res);
        const ip = req.ip || '?', t = Date.now(), l = (proby.get(ip) ?? []).filter((x) => t - x < 60_000);
        if (l.length >= limitNaMinute) return res.status(429).json({ success: false, message: 'Za dużo prób — spróbuj za minutę.' });
        proby.set(ip, [...l, t]);
        return odp(res, W.wypozycz(req.params.id, { powrot: req.body?.powrot }));
    });
    app.get('/wizytowka/teostory/odbior', async (req, res) => {
        try {
            const o = await W.odbierz(String(req.query.sesja ?? ''));
            if (o.powrot) return res.redirect(302, `${o.powrot}?ksiega=${encodeURIComponent(o.ksiega)}&sesja=${encodeURIComponent(String(req.query.sesja))}`);
            return res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Wypożyczone</title><body style="font-family:Georgia;background:#F6F2EA;padding:40px"><h1>📚 Wypożyczone na ${GODZIN_WYPOZYCZENIA} h</h1><p>Dostęp do: ${esc(o.do)}. Wróć do teostory.studio — księga czeka na Twojej półce.</p></body>`);
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).type('html').send(`<!doctype html><meta charset="utf-8"><body style="font-family:Georgia;padding:40px"><h1>Nie rozpoznaję tej płatności</h1><p>${esc(e.message)}</p></body>`); }
    });
}

export default { utworzWypozyczalnie, zamontujTrasyWypozyczalni, sprawdzKsiege, idKsiegi, dozwolonyPowrot, TIERY };
