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
import fs from 'fs/promises';
import path from 'path';
import { dozwolonyPowrot } from './WypozyczalniaKsiag.js';

export const NAZWY_FUNKCJI = {
    szafa: 'Odtwarzacz szafy grającej (album Opodysków, kolejka)', 'proba-pergaminu': '1 próbny pergamin z własnego pliku',
    'wlasny-plik': 'Konwersja własnych utworów do partytury 0.00G i zwojów TeOfonu', canvas: 'Pętla Spotify Canvas 9:16 (8 s)',
    'wideo-16x9': 'Pełny eksport wideo 16:9 MP4', opodysk: '12-aktowe Opodyski', manuskrypt: 'Manuskrypty PDF', lektor: 'Lektorzy ElevenLabs',
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
    const KAT = path.join(katalog, 'jukebox'), PLIK_CENNIKA = path.join(KAT, 'cennik.json'), PLIK_ZAKUPOW = path.join(KAT, 'zakupy.json');
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

    /** Opłacona sesja Stripe → zakup poziomu (zapis raz). Rzuca z powodem. */
    async function odbierz(sesja) {
        if (!stripe) throw blad('Katedra nie przyjmuje teraz płatności.', 503);
        const s = await stripe.sprawdzSesje(String(sesja ?? ''));
        if (!s.oplacona) throw blad('Płatność jeszcze nie przeszła.', 402);
        const tier = String(s.pakiet ?? '').replace(/^jukebox-/, '');
        if (s.rodzaj !== 'jukebox-tier' || !PLATNE.includes(tier)) throw blad('To nie jest zakup poziomu Jukeboxa.');
        await poKolei(async () => {
            const d = await json(PLIK_ZAKUPOW, { zakupy: [] });
            if (!d.zakupy.some((x) => x.sesja === s.id)) { d.zakupy = [{ sesja: s.id, tier, kwota: s.kwota, waluta: s.waluta, tryb: s.tryb, kiedy: new Date(teraz()).toISOString() }, ...d.zakupy].slice(0, 5000); await pisz(PLIK_ZAKUPOW, d); }
        });
        return { tier, powrot: dozwolonyPowrot(s.powrot) };
    }

    /** Dostęp czytelnika: 👑 Suweren = wszystkie poziomy; inaczej najwyższy z opłaconych sesji (`sesje`); inaczej Iskra. */
    async function dostep({ sesje = [], suweren = null } = {}) {
        if (suweren && (await czySuweren(String(suweren)))) return { maks: 'venue', zrodlo: 'suweren', sesje: [] };
        const ok = [];
        for (const s of (Array.isArray(sesje) ? sesje : []).slice(0, 8)) { try { const o = await odbierz(s); ok.push({ sesja: s, tier: o.tier }); } catch { /* niewazna sesja — pomijamy */ } }
        const maks = ok.reduce((m, x) => (indeks(x.tier) > indeks(m) ? x.tier : m), 'iskra');
        return { maks, zrodlo: ok.length ? 'stripe' : 'free', sesje: ok };
    }

    const zakupy = async () => (await json(PLIK_ZAKUPOW, { zakupy: [] })).zakupy;
    return { oferta, kup, odbierz, dostep, cennik, ustawCennik, zakupy };
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Trasy: publiczne `/wizytowka/jukebox*` (Straż `SCIEZKA_JUKEBOX`) i Hub `/api/jukebox*` (tylko maszyna). */
export function zamontujTrasyJukeboxa(app, J, { limitNaMinute = 10 } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(typeof e.kod === 'number' ? e.kod : 400).json({ success: false, message: e.message }));
    const cors = (res) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); };
    const proby = new Map();
    const limit = (req, klucz, n) => { const ip = `${klucz}:${req.ip || '?'}`, t = Date.now(), l = (proby.get(ip) ?? []).filter((x) => t - x < 60_000); if (l.length >= n) return false; proby.set(ip, [...l, t]); return true; };
    // Hub (Straż `/api/jukebox`: tylko maszyna)
    app.get('/api/jukebox', (_req, res) => odp(res, (async () => ({ ...(await J.oferta()), zakupy: await J.zakupy() }))()));
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
        return odp(res, J.dostep({ sesje: String(req.query.sesje ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8), suweren: req.query.suweren ? String(req.query.suweren).slice(0, 64) : null }));
    });
    app.get('/wizytowka/jukebox/odbior', async (req, res) => {
        try {
            const o = await J.odbierz(String(req.query.sesja ?? ''));
            if (o.powrot) return res.redirect(302, `${o.powrot}?app=jukebox&tier=${encodeURIComponent(o.tier)}&sesja=${encodeURIComponent(String(req.query.sesja))}`);
            return res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Odblokowane</title><body style="font-family:Georgia;background:#0b0a10;color:#f1e3b8;padding:40px"><h1>📻 Poziom ${esc(o.tier)} odblokowany</h1><p>Wróć do TeOfon Studio &amp; Jukebox 0.00G na teostory.studio.</p></body>`);
        } catch (e) { return res.status(typeof e.kod === 'number' ? e.kod : 400).type('html').send(`<!doctype html><meta charset="utf-8"><body style="font-family:Georgia;padding:40px"><h1>Nie rozpoznaję tej płatności</h1><p>${esc(e.message)}</p></body>`); }
    });
}

export default { utworzJukebox, zamontujTrasyJukeboxa, TIERY, PLATNE, NAZWY_FUNKCJI };
