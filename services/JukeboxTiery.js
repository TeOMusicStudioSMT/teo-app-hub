/**
 * 📻 TeOfon Studio & Jukebox 0.00G — Tiery GRV i płatność Stripe (Suweren 2026-11-16).
 *
 * Cztery poziomy (bliźniak `tieryGrv.ts` w TeO Story Studio i `src/jukebox/tiery.ts` w portalu): Iskra (free), Puls, HACT Studio, Katedra Venue.
 * Płatne poziomy kupuje się przez prawdziwy Stripe Checkout (`Stripe.sesjaZakupu`, rodzaj `jukebox-tier`), CENĘ liczy most z `jukebox/cennik.json`
 * (nigdy przeglądarka). Zakup = opłacona sesja Stripe — jak w Wypożyczalni: bez webhooka, most pyta Stripe o `payment_status` i zapisuje zakup
 * w `jukebox/zakupy.json`. Poziom jest SKUMULOWANY: kupiony wyższy odblokowuje niższe. 👑 Klucz Suwerena Katedry (`WypozyczalniaKsiag.czySuweren`)
 * daje wszystkie 4 poziomy bez płacenia (do testów Twórcy).
 *
 * UCZCIWIE: Katedra NIE ustala cen sama — dopóki Suweren nie wpisze ceny (`PUT /api/jukebox/cennik`), poziom jest „wkrótce” i kupić go nie można.
 * Funkcje własnych plików (partytura, zwoje, Canvas) liczą się w przeglądarce kupującego, więc bramka tych funkcji jest w interfejsie;
 * serwer pilnuje tego, co jest po jego stronie: ceny, zakupu, weryfikacji sesji i dostępu do plików utworów (bramka księgi).
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { dozwolonyPowrot } from './WypozyczalniaKsiag.js';

// 🔑 Klucz Dostępu GRV — `GRV-HACT-XXXX-XXXX`. Powstaje w chwili potwierdzonej płatności (`payment_status: paid`),
// pokazywany kupującemu RAZ (ekran sukcesu + link powrotny). Rejestr `jukebox/klucze.json` trzyma wyłącznie
// hash SHA-256, wykupiony tier i datę — zero danych osobowych, zero kont i haseł (architektura „zero RODO”).
// Alfabet bez znaków mylących (0/O/1/I/L), żeby klucz dało się przepisać z ekranu telefonu.
const ALFABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const KLUCZ_GRV = /^GRV-(PULS|HACT|VENUE)-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;
/** Klucz z przeglądarki → postać kanoniczna (wielkie litery, myślniki) albo `null`, gdy to nie jest klucz GRV. */
export function normalizujKlucz(wejscie) {
    const t = String(wejscie ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = /^GRV(PULS|HACT|VENUE)([2-9A-HJKMNP-Z]{8})$/.exec(t);
    return m ? `GRV-${m[1]}-${m[2].slice(0, 4)}-${m[2].slice(4)}` : null;
}
const hashKlucza = (k) => crypto.createHash('sha256').update(k, 'utf8').digest('hex');
/** `n` znaków z alfabetu, bez przechyłu modulo (odrzucamy bajty ≥ 248 = 8×31). */
function losoweZnaki(n) {
    let s = '';
    while (s.length < n) for (const v of crypto.randomBytes(n * 2)) { if (v < 248 && s.length < n) s += ALFABET[v % ALFABET.length]; }
    return s;
}
const nowyKlucz = (tier) => { const z = losoweZnaki(8); return `GRV-${tier.toUpperCase()}-${z.slice(0, 4)}-${z.slice(4)}`; };

/**
 * 🎙 Lektorzy Katedry — ile znaków mowy mieści się w Tierze przez jeden miesiąc kalendarzowy.
 * Licznik siedzi na Kluczu Dostępu, więc rozliczamy klienta BEZ konta i bez danych osobowych.
 *
 * ZMIERZONE u Suwerena 2026-11-16 (głos lokalny 🏠 Kalen, VoiceStudio na karcie 6 GB):
 *   · 199 znaków → 14,2 s nagrania w 9,6 s pracy karty (1,48× szybciej niż czas rzeczywisty),
 *   · narracja ciągła ≈ 841 znaków na minutę nagrania, dialog z pauzami (Teterhia) ≈ 545,
 *   · czyli ≈ 20,7 znaku na sekundę pracy karty graficznej.
 * Stąd: HACT 60 000 znaków ≈ 71–110 min nagrań ≈ 48 min karty na miesiąc,
 *       Venue 250 000 znaków ≈ 5–7,6 h nagrań ≈ 3,4 h karty na miesiąc.
 * Liczby ustala Suweren — tutaj.
 */
export const LIMITY_LEKTORA = { iskra: 0, puls: 0, hact: 60_000, venue: 250_000 };
/**
 * 🛡 Bezpiecznik całej Katedry: limit miesięczny chroni PRZED JEDNYM łakomym klientem, ale nie przed
 * powodzeniem — stu klientów w swoich limitach zajęłoby kartę na tygodnie. Karta jest jedna i dzieli ją
 * z ComfyUI, Ollamą i renderami, więc doba ma twardy sufit. 150 000 znaków ≈ 2 h pracy karty.
 */
export const LIMIT_DZIENNY_KATEDRY = 150_000;
export const miesiacLektora = (t) => new Date(t).toISOString().slice(0, 7);
export const dzienLektora = (t) => new Date(t).toISOString().slice(0, 10);
export const maFunkcje = (id, f) => (TIERY[TIERY.findIndex((t) => t.id === id)]?.funkcje ?? []).includes(f);

export const NAZWY_FUNKCJI = {
    szafa: 'Odtwarzacz szafy grającej (album Opodysków, kolejka)', 'proba-pergaminu': '1 próbny pergamin z własnego pliku',
    'wlasny-plik': 'Konwersja własnych utworów do partytury 0.00G i zwojów TeOfonu', canvas: 'Pętla Spotify Canvas 9:16 (8 s)',
    'wideo-16x9': 'Pełny eksport wideo 16:9 MP4', opodysk: '12-aktowe Opodyski', manuskrypt: 'Manuskrypty PDF', lektor: 'Lektorzy Katedry (głosy 0.00G)',
    wypozyczalnia: 'Publikacja w Wypożyczalni teostory.studio', venue: 'Licencja dla lokali, tabletów Smart Display i fizycznych TeOfonów',
};
export const TIERY = [
    { id: 'iskra', kod: '0.01', nazwa: 'Iskra', rola: 'Free / Jukebox Viewer', funkcje: ['szafa', 'proba-pergaminu'] },
    { id: 'puls', kod: '0.10', nazwa: 'Puls', rola: 'Creator GRV', funkcje: ['szafa', 'proba-pergaminu', 'wlasny-plik', 'canvas'] },
    { id: 'hact', kod: '0.11', nazwa: 'HACT Studio', rola: 'Pro Producer', funkcje: ['szafa', 'proba-pergaminu', 'wlasny-plik', 'canvas', 'wideo-16x9', 'opodysk', 'manuskrypt', 'lektor'] },
    { id: 'venue', kod: '0.00G', nazwa: 'Katedra Venue', rola: 'VIP & Smart Display', funkcje: ['szafa', 'proba-pergaminu', 'wlasny-plik', 'canvas', 'wideo-16x9', 'opodysk', 'manuskrypt', 'lektor', 'wypozyczalnia', 'venue'] },
];
export const PLATNE = TIERY.filter((t) => t.id !== 'iskra').map((t) => t.id);
const indeks = (id) => TIERY.findIndex((t) => t.id === id);
export const MIN_EUR = 0.5, MAX_EUR = 999;
const blad = (m, kod = 400) => Object.assign(new Error(m), { kod });

export function utworzJukebox({ katalog, stripe = null, adres = async () => null, czySuweren = async () => false, teraz = () => Date.now() }) {
    const KAT = path.join(katalog, 'jukebox'), PLIK_CENNIKA = path.join(KAT, 'cennik.json'), PLIK_ZAKUPOW = path.join(KAT, 'zakupy.json'), PLIK_KLUCZY = path.join(KAT, 'klucze.json');
    const json = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const pisz = async (p, o) => { await fs.mkdir(path.dirname(p), { recursive: true }); const t = `${p}.${process.pid}.tmp`; await fs.writeFile(t, JSON.stringify(o, null, 2)); await fs.rename(t, p); };
    let kolej = Promise.resolve();
    const poKolei = (fn) => { const p = kolej.then(fn, fn); kolej = p.catch(() => {}); return p; };

    const cennik = async () => { const d = await json(PLIK_CENNIKA, {}); const o = {}; for (const id of PLATNE) { const c = Number(d[id]); if (Number.isFinite(c) && c >= MIN_EUR && c <= MAX_EUR) o[id] = Math.round(c * 100) / 100; } return o; };
    /** Ustawia ceny (EUR) płatnych poziomów; `null` zdejmuje cenę (poziom wraca do „wkrótce”). */
    const ustawCennik = (z = {}) => poKolei(async () => {
        const d = await json(PLIK_CENNIKA, {});
        for (const [id, c] of Object.entries(z)) {
            if (!PLATNE.includes(id)) throw blad(`Poziom „${id}” nie jest płatny. Płatne: ${PLATNE.join(', ')}.`);
            if (c === null) { delete d[id]; continue; }
            const n = Number(c);
            if (!Number.isFinite(n) || n < MIN_EUR || n > MAX_EUR) throw blad(`Cena „${id}”: od ${MIN_EUR} do ${MAX_EUR} EUR.`);
            d[id] = Math.round(n * 100) / 100;
        }
        await pisz(PLIK_CENNIKA, d);
        return cennik();
    });

    /** Publiczna oferta: poziomy, funkcje, ceny (null = wkrótce), czy Katedra przyjmuje płatności. */
    async function oferta() {
        const c = await cennik(), tunel = !!(await adres().catch(() => null));
        return { waluta: 'EUR', platnosci: !!stripe && tunel, tiery: TIERY.map((t) => ({ ...t, platny: t.id !== 'iskra', cenaEur: t.id === 'iskra' ? 0 : c[t.id] ?? null, funkcje: t.funkcje.map((f) => ({ id: f, nazwa: NAZWY_FUNKCJI[f] })) })) };
    }

    async function kup(tier, { powrot = null } = {}) {
        if (!PLATNE.includes(tier)) throw blad('Wybierz płatny poziom: puls, hact albo venue.');
        if (!stripe) throw blad('Katedra nie przyjmuje teraz płatności.', 503);
        const cena = (await cennik())[tier];
        if (cena == null) throw blad('Ten poziom nie ma jeszcze ceny — pojawi się, gdy Suweren ją ustali.', 409);
        const t = TIERY[indeks(tier)], baza = await adres();
        if (!baza) throw blad('Katedra nie ma adresu w sieci (tunel wyłączony) — zakup niemożliwy.', 503);
        const wroc = dozwolonyPowrot(powrot);
        const s = await stripe.sesjaZakupu({ pakiet: { id: `jukebox-${tier}`, nazwa: `📻 TeOfon Studio & Jukebox 0.00G — Tier ${t.kod} ${t.nazwa}`, opis: `${t.rola}. Poziom skumulowany: odblokowuje też niższe.` },
            kwotaCentow: Math.round(cena * 100), waluta: 'eur', powrot: baza, anuluj: wroc, sukces: '/wizytowka/jukebox/odbior', rodzaj: 'jukebox-tier', metadane: { powrot: wroc ?? '', tier } });
        return { url: s.url, tier, cenaEur: cena };
    }

    /**
     * 🔑 Wydaje Klucz Dostępu GRV dla opłaconej sesji. Rejestr trzyma SAM HASH — jawnego klucza Katedra nie zna,
     * więc ta sama sesja drugi raz klucza nie odda (kupujący dostał go w przekierowaniu i na ekranie sukcesu).
     * Zwraca `null`, gdy klucz dla tej sesji już powstał — dostęp działa wtedy dalej przez sesję.
     */
    const wydajKlucz = (tier, sesja) => poKolei(async () => {
        const d = await json(PLIK_KLUCZY, { klucze: [] });
        if (d.klucze.some((x) => x.sesja === sesja)) return null;
        const klucz = nowyKlucz(tier);
        d.klucze = [{ hash: hashKlucza(klucz), tier, sesja, kiedy: new Date(teraz()).toISOString(), wazny: null }, ...d.klucze].slice(0, 20000);
        await pisz(PLIK_KLUCZY, d);
        return klucz;
    });

    /** Klucz GRV → wykupiony tier, albo `null`. Porównanie hashy w stałym czasie (klucz jest sekretem jak Klucz Suwerena). */
    async function sprawdzKlucz(wejscie) {
        const k = normalizujKlucz(wejscie);
        if (!k) return null;
        const h = Buffer.from(hashKlucza(k), 'hex');
        const d = await json(PLIK_KLUCZY, { klucze: [] });
        for (const w of d.klucze) {
            if (typeof w.hash !== 'string' || w.hash.length !== 64) continue;
            if (!crypto.timingSafeEqual(h, Buffer.from(w.hash, 'hex'))) continue;
            if (w.wazny && Date.parse(w.wazny) < teraz()) return null;
            return PLATNE.includes(w.tier) ? { tier: w.tier, kiedy: w.kiedy ?? null } : null;
        }
        return null;
    }

    /** Opłacona sesja Stripe → zakup poziomu (zapis raz). `zKluczem` wydaje Klucz Dostępu GRV. Rzuca z powodem. */
    async function odbierz(sesja, { zKluczem = false } = {}) {
        if (!stripe) throw blad('Katedra nie przyjmuje teraz płatności.', 503);
        const s = await stripe.sprawdzSesje(String(sesja ?? ''));
        if (!s.oplacona) throw blad('Płatność jeszcze nie przeszła.', 402);
        const tier = String(s.pakiet ?? '').replace(/^jukebox-/, '');
        if (s.rodzaj !== 'jukebox-tier' || !PLATNE.includes(tier)) throw blad('To nie jest zakup poziomu Jukeboxa.');
        await poKolei(async () => {
            const d = await json(PLIK_ZAKUPOW, { zakupy: [] });
            if (!d.zakupy.some((x) => x.sesja === s.id)) { d.zakupy = [{ sesja: s.id, tier, kwota: s.kwota, waluta: s.waluta, tryb: s.tryb, kiedy: new Date(teraz()).toISOString() }, ...d.zakupy].slice(0, 5000); await pisz(PLIK_ZAKUPOW, d); }
        });
        return { tier, powrot: dozwolonyPowrot(s.powrot), klucz: zKluczem ? await wydajKlucz(tier, s.id) : null };
    }

    /** Dostęp czytelnika: 👑 Suweren = wszystkie poziomy; inaczej najwyższy z Klucza GRV i opłaconych sesji (`sesje`); inaczej Iskra. */
    async function dostep({ sesje = [], suweren = null, klucz = null } = {}) {
        if (suweren && (await czySuweren(String(suweren)))) return { maks: 'venue', zrodlo: 'suweren', sesje: [] };
        const zKlucza = klucz ? await sprawdzKlucz(klucz) : null;
        const ok = [];
        for (const s of (Array.isArray(sesje) ? sesje : []).slice(0, 8)) { try { const o = await odbierz(s); ok.push({ sesja: s, tier: o.tier }); } catch { /* niewazna sesja — pomijamy */ } }
        const zSesji = ok.reduce((m, x) => (indeks(x.tier) > indeks(m) ? x.tier : m), 'iskra');
        const maks = zKlucza && indeks(zKlucza.tier) > indeks(zSesji) ? zKlucza.tier : zSesji;
        const zrodlo = zKlucza && maks === zKlucza.tier ? 'klucz' : ok.length ? 'stripe' : 'free';
        return { maks, zrodlo, sesje: ok };
    }

    /** 🎙 Ile mowy zostało temu Kluczowi w tym miesiącu. `null` = Katedra nie zna klucza. */
    async function lektorStan(wejscie) {
        const w = await sprawdzKlucz(wejscie);
        if (!w) return null;
        const h = hashKlucza(normalizujKlucz(wejscie)), m = miesiacLektora(teraz());
        const wpis = (await json(PLIK_KLUCZY, { klucze: [] })).klucze.find((x) => x.hash === h);
        const limit = LIMITY_LEKTORA[w.tier] ?? 0, zuzyte = Number(wpis?.znakow?.[m]) || 0;
        const dzis = dzienLektora(teraz()), katedraDzis = Number((await json(PLIK_KLUCZY, { klucze: [] })).dzien?.[dzis]) || 0;
        return { tier: w.tier, lektor: maFunkcje(w.tier, 'lektor'), miesiac: m, limit, zuzyte, zostalo: Math.max(0, limit - zuzyte),
            katedra: { dzien: dzis, limit: LIMIT_DZIENNY_KATEDRY, zuzyte: katedraDzis, zostalo: Math.max(0, LIMIT_DZIENNY_KATEDRY - katedraDzis) } };
    }
    /** Dopisuje zużyte znaki PO udanym nagraniu (nagranie z archiwum kosztuje 0 — klient nie płaci dwa razy za to samo). */
    const lektorZuzyj = (wejscie, znakow) => poKolei(async () => {
        const n = Math.max(0, Math.round(Number(znakow) || 0));
        if (!n) return;
        const k = normalizujKlucz(wejscie);
        if (!k) return;
        const h = hashKlucza(k), m = miesiacLektora(teraz()), dzis = dzienLektora(teraz()), d = await json(PLIK_KLUCZY, { klucze: [] });
        const wpis = d.klucze.find((x) => x.hash === h);
        if (!wpis) return;
        wpis.znakow = { ...(wpis.znakow ?? {}), [m]: (Number(wpis.znakow?.[m]) || 0) + n };
        const dni = { ...(d.dzien ?? {}), [dzis]: (Number(d.dzien?.[dzis]) || 0) + n };   // 🛡 wspólny licznik doby całej Katedry
        d.dzien = Object.fromEntries(Object.entries(dni).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 40));
        await pisz(PLIK_KLUCZY, d);
    });

    /** Krótki odcisk klucza — nazwa katalogu na nagrania tego klienta. Z odcisku nie da się odtworzyć klucza. */
    const odciskKlucza = async (wejscie) => { const k = normalizujKlucz(wejscie); return k ? hashKlucza(k).slice(0, 16) : null; };

    const zakupy = async () => (await json(PLIK_ZAKUPOW, { zakupy: [] })).zakupy;
    /** Rejestr kluczy BEZ hashy — do podglądu Suwerena (ile kluczy, jakie tiery, kiedy). */
    const klucze = async () => (await json(PLIK_KLUCZY, { klucze: [] })).klucze.map(({ hash, ...r }) => r);   // eslint-disable-line no-unused-vars
    return { oferta, kup, odbierz, dostep, cennik, ustawCennik, zakupy, sprawdzKlucz, klucze, lektorStan, lektorZuzyj, odciskKlucza };
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Trasy: publiczne `/wizytowka/jukebox*` (Straż `SCIEZKA_JUKEBOX`) i Hub `/api/jukebox*` (tylko maszyna). */
export function zamontujTrasyJukeboxa(app, J, { limitNaMinute = 10, lektor = null, maxZnakowLektora = 1200, limitLektoraNaMinute = 4 } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    const cors = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); };
    const proby = new Map();
    const limit = (req, klucz, n) => { const ip = `${klucz}:${req.ip || '?'}`, t = Date.now(), l = (proby.get(ip) ?? []).filter((x) => t - x < 60_000); if (l.length >= n) return false; proby.set(ip, [...l, t]); return true; };
    // Hub (Straż `/api/jukebox`: tylko maszyna)
    app.get('/api/jukebox', (_req, res) => odp(res, (async () => ({ ...(await J.oferta()), zakupy: await J.zakupy(), klucze: await J.klucze() }))()));
    app.put('/api/jukebox/cennik', (req, res) => odp(res, J.ustawCennik(req.body ?? {}).then((cennik) => ({ cennik }))));
    // Publiczne
    app.get('/wizytowka/jukebox', (_req, res) => { cors(res); odp(res, J.oferta()); });
    app.options('/wizytowka/jukebox/:akcja', (_req, res) => { cors(res); res.sendStatus(204); });
    app.post('/wizytowka/jukebox/kup', (req, res) => {
        cors(res);
        if (!limit(req, 'k', limitNaMinute)) return res.status(429).json({ success: false, message: 'Za dużo prób — spróbuj za minutę.' });
        return odp(res, J.kup(String(req.body?.tier ?? ''), { powrot: req.body?.powrot }));
    });
    app.get('/wizytowka/jukebox/dostep', (req, res) => {
        cors(res);
        if (!limit(req, 'd', limitNaMinute * 6)) return res.status(429).json({ success: false, message: 'Za dużo zapytań — spróbuj za minutę.' });
        return odp(res, J.dostep({ sesje: String(req.query.sesje ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8), suweren: req.query.suweren ? String(req.query.suweren).slice(0, 64) : null, klucz: req.query.klucz ? String(req.query.klucz).slice(0, 64) : null }));
    });
    // 🔑 Klucz Dostępu GRV z innego urządzenia: czy jest w rejestrze i jaki tier odblokowuje. Limit jak przy zakupie — klucz jest sekretem.
    app.get('/wizytowka/jukebox/klucz', (req, res) => {
        cors(res);
        if (!limit(req, 'kl', limitNaMinute)) return res.status(429).json({ success: false, message: 'Za dużo prób — spróbuj za minutę.' });
        return odp(res, (async () => {
            const k = String(req.query.key ?? req.query.klucz ?? '').slice(0, 64), w = await J.sprawdzKlucz(k);
            if (!w) throw blad('Nie znam takiego Klucza Dostępu.', 404);
            const { tier: _t, ...lek } = (await J.lektorStan(k)) ?? {};   // eslint-disable-line no-unused-vars
            return { tier: w.tier, kiedy: w.kiedy, lektor: lek };
        })());
    });
    /**
     * 🎙 Lektor Katedry dla klienta z Kluczem GRV. Zwraca gotowe mp3.
     * Pilnuje Katedra, nie przeglądarka: tier musi mieć funkcję `lektor`, tekst ma limit, a miesięczny
     * licznik znaków siedzi na kluczu. Silnik wstrzykuje most — publiczna trasa NIGDY nie podaje zgody
     * na płatne głosy, więc nie da się nią wydać kredytów ElevenLabs.
     */
    app.post('/wizytowka/jukebox/lektor', async (req, res) => {
        cors(res);
        if (!lektor) return res.status(503).json({ success: false, message: 'Lektor Katedry jest teraz wyłączony.' });
        if (!limit(req, 'lk', limitLektoraNaMinute)) return res.status(429).json({ success: false, message: 'Za dużo nagrań — spróbuj za minutę.' });
        try {
            const klucz = String(req.body?.klucz ?? req.body?.key ?? '').slice(0, 64);
            const tekst = String(req.body?.tekst ?? '').replace(/\s+/g, ' ').trim();
            const st = await J.lektorStan(klucz);
            if (!st) throw blad('Nie znam takiego Klucza Dostępu.', 404);
            if (!st.lektor) throw blad(`Lektorzy Katedry należą do poziomu ${TIERY.find((t) => t.funkcje.includes('lektor'))?.nazwa ?? 'wyższego'} — Twój to ${st.tier}.`, 403);
            if (tekst.length < 2) throw blad('Nie ma tekstu do przeczytania.');
            if (tekst.length > maxZnakowLektora) throw blad(`Za długi tekst na jedno nagranie (limit ${maxZnakowLektora} znaków) — podziel na części.`, 413);
            if (tekst.length > st.zostalo) throw blad(`W tym miesiącu zostało Ci ${st.zostalo} znaków z ${st.limit}. Ten tekst ma ${tekst.length}.`, 402);
            if (tekst.length > st.katedra.zostalo) throw blad('Katedra nagrała dziś tyle, ile zniesie jej karta graficzna. Wróć jutro — Twój miesięczny limit zostaje nietknięty.', 503);
            const w = await lektor({ tekst, rola: String(req.body?.rola ?? 'kronikarz').slice(0, 24), klucz: await J.odciskKlucza(klucz) });
            await J.lektorZuzyj(klucz, w.znakow ?? 0);   // nagranie z archiwum = 0 znaków, klient nie płaci dwa razy
            const po = await J.lektorStan(klucz);
            res.set('X-Lektor-Zostalo', String(po?.zostalo ?? 0));
            res.set('X-Lektor-Znakow', String(w.znakow ?? 0));
            return res.type('audio/mpeg').sendFile(w.plik);
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }); }
    });
    app.get('/wizytowka/jukebox/odbior', async (req, res) => {
        try {
            const o = await J.odbierz(String(req.query.sesja ?? ''), { zKluczem: true });
            if (o.powrot) return res.redirect(302, `${o.powrot}?app=jukebox&tier=${encodeURIComponent(o.tier)}&sesja=${encodeURIComponent(String(req.query.sesja))}${o.klucz ? `&key=${encodeURIComponent(o.klucz)}` : ''}`);
            // 🔑 Bez adresu powrotu kupujący widzi klucz TU — Katedra zna tylko jego hash, więc drugi raz go nie pokaże.
            const kl = o.klucz ? `<p style="margin-top:28px">Twój <b>Klucz Dostępu</b> — zapisz go, odblokuje ten poziom na każdym urządzeniu:</p>
      <p style="font:bold 28px/1.4 ui-monospace,Consolas,monospace;letter-spacing:2px;background:#1b1626;border:1px solid #b08a3c;border-radius:12px;padding:16px 20px;display:inline-block">${esc(o.klucz)}</p>
      <p style="color:#b9a87e">Pokazuję go tylko raz — Katedra przechowuje wyłącznie jego odcisk, nigdy sam klucz.</p>` : '';
            return res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Odblokowane</title><body style="font-family:Georgia;background:#0b0a10;color:#f1e3b8;padding:40px"><h1>📻 Poziom ${esc(o.tier)} odblokowany</h1><p>Wróć do TeOfon Studio &amp; Jukebox 0.00G na teostory.studio.</p>${kl}</body>`);
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).type('html').send(`<!doctype html><meta charset="utf-8"><body style="font-family:Georgia;padding:40px"><h1>Nie rozpoznaję tej płatności</h1><p>${esc(e.message)}</p></body>`); }
    });
}

export default { utworzJukebox, zamontujTrasyJukeboxa, TIERY, PLATNE, NAZWY_FUNKCJI };
