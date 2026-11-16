// 📻 Jukebox: Tiery GRV, cennik, Stripe Checkout (atrapa Stripe — żaden prawdziwy płatny ruch), Klucz Suwerena, Straż.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { utworzJukebox, zamontujTrasyJukeboxa, normalizujKlucz, KLUCZ_GRV, LIMITY_LEKTORA, LIMIT_DZIENNY_KATEDRY, TIERY, PLATNE } from '../services/JukeboxTiery.js';
import { SCIEZKA_JUKEBOX, SCIEZKI_TYLKO_LOKALNE } from '../services/StrazMostu.js';

const KLUCZ_SU = 'a'.repeat(48);
function atrapaStripe() {
    const sesje = new Map(), zalozone = [];
    return {
        zalozone, sesje,
        sesjaZakupu: async (z) => { const id = `cs_test_${sesje.size + 1}${'x'.repeat(20)}`; sesje.set(id, { id, oplacona: false, pakiet: z.pakiet.id, rodzaj: z.rodzaj, powrot: z.metadane.powrot || null, kwota: z.kwotaCentow / 100, waluta: z.waluta, tryb: 'test' }); zalozone.push(z); return { id, url: `https://checkout.stripe.com/c/pay/${id}` }; },
        sprawdzSesje: async (id) => { const s = sesje.get(id); if (!s) throw new Error('To nie jest identyfikator płatności Stripe.'); return s; },
    };
}
async function start({ tunel = 'https://katedra.test', lektor = null, limitLektoraNaMinute = 4 } = {}) {
    const katalog = await fs.mkdtemp(path.join(os.tmpdir(), 'jukebox-')), stripe = atrapaStripe();
    const J = utworzJukebox({ katalog, stripe, adres: async () => tunel, czySuweren: async (k) => k === KLUCZ_SU });
    const app = express(); app.use(express.json()); zamontujTrasyJukeboxa(app, J, { lektor, limitLektoraNaMinute });
    const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    return { J, stripe, katalog, srv, b: `http://127.0.0.1:${srv.address().port}` };
}
const post = (u, o) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }).then(async (r) => ({ s: r.status, d: await r.json() }));

test('cztery tiery, bez ceny „wkrótce” i brak zakupu; cena z mostu, nie z przeglądarki', async () => {
    const { J, b, srv, katalog } = await start();
    try {
        assert.deepEqual(TIERY.map((t) => t.id), ['iskra', 'puls', 'hact', 'venue']); assert.deepEqual(PLATNE, ['puls', 'hact', 'venue']);
        const o = await (await fetch(`${b}/wizytowka/jukebox`)).json();
        assert.equal(o.tiery.length, 4); assert.equal(o.tiery[0].cenaEur, 0); assert.ok(o.tiery.slice(1).every((t) => t.cenaEur === null), 'Katedra sama cen nie ustala');
        let k = await post(`${b}/wizytowka/jukebox/kup`, { tier: 'puls' }); assert.equal(k.s, 409); assert.match(k.d.message, /nie ma jeszcze ceny/);
        k = await post(`${b}/wizytowka/jukebox/kup`, { tier: 'iskra' }); assert.equal(k.s, 400);
        await assert.rejects(() => J.ustawCennik({ puls: 0.1 }), /od 0.5 do 999/); await assert.rejects(() => J.ustawCennik({ iskra: 5 }), /nie jest płatny/);
        assert.deepEqual(await J.ustawCennik({ puls: 4.5, hact: 12.999 }), { puls: 4.5, hact: 13 });
        const o2 = await (await fetch(`${b}/wizytowka/jukebox`)).json(); assert.equal(o2.tiery[1].cenaEur, 4.5); assert.equal(o2.tiery[3].cenaEur, null);
        assert.deepEqual(await J.ustawCennik({ hact: null }), { puls: 4.5 });
    } finally { srv.close(); await fs.rm(katalog, { recursive: true, force: true }); }
});

test('Stripe Checkout: cena z cennika w centach, odbiór opłaconej sesji, poziom skumulowany, nieopłacona/obca sesja odrzucona', async () => {
    const { J, stripe, b, srv, katalog } = await start();
    try {
        await J.ustawCennik({ puls: 4.5, hact: 12, venue: 49 });
        const k = await post(`${b}/wizytowka/jukebox/kup`, { tier: 'hact', cena: 1, kwotaCentow: 1, powrot: 'https://teostory.studio/jukebox' });
        assert.equal(k.s, 200); assert.match(k.d.url, /^https:\/\/checkout\.stripe\.com\//); assert.equal(k.d.cenaEur, 12);
        const z = stripe.zalozone[0];
        assert.equal(z.kwotaCentow, 1200, 'cena z cennika mostu — pola z przeglądarki ignorowane'); assert.equal(z.waluta, 'eur'); assert.equal(z.rodzaj, 'jukebox-tier'); assert.equal(z.sukces, '/wizytowka/jukebox/odbior'); assert.equal(z.metadane.tier, 'hact');
        const id = [...stripe.sesje.keys()][0];
        // nieopłacona → 402, dostęp = Iskra
        assert.equal((await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' })).status, 402);
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/dostep?sesje=${id}`)).json()).maks, 'iskra');
        // opłacona → przekierowanie na portal z ?app=jukebox, zakup zapisany raz, poziom skumulowany
        stripe.sesje.get(id).oplacona = true;
        const r = await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' });
        assert.equal(r.status, 302);
        const adres = new URL(r.headers.get('location'));
        assert.equal(`${adres.origin}${adres.pathname}`, 'https://teostory.studio/jukebox');
        assert.equal(adres.searchParams.get('tier'), 'hact'); assert.equal(adres.searchParams.get('sesja'), id);
        assert.match(adres.searchParams.get('key'), /^GRV-HACT-/, '🔑 klucz wydany przy opłaconej sesji');
        // druga wizyta tej samej sesji: zakup zapisany raz, klucza NIE ma drugi raz (Katedra zna tylko jego hash)
        const r2 = await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' });
        assert.equal(new URL(r2.headers.get('location')).searchParams.get('key'), null);
        assert.equal((await J.zakupy()).length, 1, 'zakup zapisany raz');
        const d = await (await fetch(`${b}/wizytowka/jukebox/dostep?sesje=${id},cs_test_nie_ma_takiej_sesji_xxxxx`)).json();
        assert.equal(d.maks, 'hact'); assert.equal(d.zrodlo, 'stripe'); assert.deepEqual(d.sesje, [{ sesja: id, tier: 'hact' }]);
        // sesja innego rodzaju (np. wypożyczenie księgi) nie odblokowuje Jukeboxa
        stripe.sesje.set('cs_test_ksiega_xxxxxxxxxxxxxxxxx', { id: 'cs_test_ksiega_xxxxxxxxxxxxxxxxx', oplacona: true, pakiet: 'jakas-ksiega', rodzaj: 'ksiega-48h', kwota: 2.99, waluta: 'eur', tryb: 'test' });
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/dostep?sesje=cs_test_ksiega_xxxxxxxxxxxxxxxxx`)).json()).maks, 'iskra');
        // wyższy zakup wygrywa
        const k2 = await post(`${b}/wizytowka/jukebox/kup`, { tier: 'venue' }); const id2 = [...stripe.sesje.values()].find((s) => s.pakiet === 'jukebox-venue').id;
        stripe.sesje.get(id2).oplacona = true;
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/dostep?sesje=${id},${id2}`)).json()).maks, 'venue'); assert.equal(k2.s, 200);
    } finally { srv.close(); await fs.rm(katalog, { recursive: true, force: true }); }
});

test('👑 Klucz Suwerena: wszystkie 4 tiery bez płacenia; zły klucz i „1” nie działają; brak tunelu = brak zakupu', async () => {
    const { J, b, srv, katalog } = await start();
    try {
        const su = await (await fetch(`${b}/wizytowka/jukebox/dostep?suweren=${KLUCZ_SU}`)).json();
        assert.equal(su.maks, 'venue'); assert.equal(su.zrodlo, 'suweren');
        for (const zly of ['1', 'true', 'b'.repeat(48), KLUCZ_SU.slice(0, 47)]) assert.equal((await (await fetch(`${b}/wizytowka/jukebox/dostep?suweren=${zly}`)).json()).maks, 'iskra', `klucz „${zly.slice(0, 6)}…” nie daje dostępu`);
        await J.ustawCennik({ puls: 5 });
    } finally { srv.close(); await fs.rm(katalog, { recursive: true, force: true }); }
    const bez = await start({ tunel: null });
    try { await bez.J.ustawCennik({ puls: 5 }); const k = await post(`${bez.b}/wizytowka/jukebox/kup`, { tier: 'puls' }); assert.equal(k.s, 503); assert.match(k.d.message, /tunel wyłączony/); assert.equal((await (await fetch(`${bez.b}/wizytowka/jukebox`)).json()).platnosci, false); }
    finally { bez.srv.close(); await fs.rm(bez.katalog, { recursive: true, force: true }); }
});

test('🔑 Klucz Dostępu GRV: wydany po płatności, odblokowuje tier na innym urządzeniu, rejestr bez danych osobowych', async () => {
    const { J, stripe, b, srv, katalog } = await start();
    try {
        await J.ustawCennik({ puls: 4.5, hact: 12, venue: 49 });
        // postać kanoniczna: małe litery, spacje i brak myślników nie przeszkadzają; znaki mylące (0 O 1 I L) nie należą do alfabetu
        assert.equal(normalizujKlucz('grvhact23ab45c'), null, 'za krótki');
        assert.equal(normalizujKlucz('grvhact23ab45cd'), 'GRV-HACT-23AB-45CD', 'bez myślników, małymi literami — też klucz');
        assert.equal(normalizujKlucz(' grv hact 23ab 45cd '), 'GRV-HACT-23AB-45CD');
        assert.equal(normalizujKlucz('GRV-HACT-23AB-45CD'), 'GRV-HACT-23AB-45CD');
        for (const zly of ['GRV-ISKRA-23AB-45CD', 'GRV-HACT-23AB-45C0', 'GRV-HACT-23AB-45CL', 'GRV-HACT-23AB-45CI', '1', 'GRV-HACT-23AB-45CD-EF'])
            assert.equal(normalizujKlucz(zly), null, `„${zly}” nie jest kluczem`);

        await post(`${b}/wizytowka/jukebox/kup`, { tier: 'hact', powrot: 'https://teostory.studio/jukebox' });
        const id = [...stripe.sesje.keys()][0];
        // nieopłacona sesja klucza nie daje
        assert.equal((await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' })).status, 402);
        assert.deepEqual(await J.klucze(), []);
        stripe.sesje.get(id).oplacona = true;
        const r = await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' });
        const klucz = new URL(r.headers.get('location')).searchParams.get('key');
        assert.ok(KLUCZ_GRV.test(klucz), `klucz w kształcie GRV-HACT-XXXX-XXXX, dostałem „${klucz}”`);

        // INNE urządzenie: sama znajomość klucza (bez sesji w przeglądarce) odblokowuje wykupiony tier
        const d = await (await fetch(`${b}/wizytowka/jukebox/dostep?klucz=${encodeURIComponent(klucz)}`)).json();
        assert.equal(d.maks, 'hact'); assert.equal(d.zrodlo, 'klucz'); assert.deepEqual(d.sesje, []);
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/dostep?klucz=${encodeURIComponent(klucz.toLowerCase().replace(/-/g, ''))}`)).json()).maks, 'hact', 'klucz przepisany z ekranu telefonu');
        const k = await (await fetch(`${b}/wizytowka/jukebox/klucz?key=${encodeURIComponent(klucz)}`)).json();
        assert.equal(k.success, true); assert.equal(k.tier, 'hact');

        // zmyślony klucz nie działa — ani w `dostep`, ani w sprawdzeniu
        const obcy = klucz.slice(0, -1) + (klucz.endsWith('2') ? '3' : '2');
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/dostep?klucz=${encodeURIComponent(obcy)}`)).json()).maks, 'iskra');
        for (const zly of [obcy, '1', 'GRV-VENUE-2345-6789', '']) assert.equal((await fetch(`${b}/wizytowka/jukebox/klucz?key=${encodeURIComponent(zly)}`)).status, 404, `„${zly}”`);

        // 👑 Suweren wygrywa z kluczem; klucz nie obniża wyższego zakupu z sesji
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/dostep?klucz=${encodeURIComponent(klucz)}&suweren=${KLUCZ_SU}`)).json()).zrodlo, 'suweren');
        await post(`${b}/wizytowka/jukebox/kup`, { tier: 'venue' });
        const idV = [...stripe.sesje.values()].find((s) => s.pakiet === 'jukebox-venue').id;
        stripe.sesje.get(idV).oplacona = true;
        const dv = await (await fetch(`${b}/wizytowka/jukebox/dostep?sesje=${idV}&klucz=${encodeURIComponent(klucz)}`)).json();
        assert.equal(dv.maks, 'venue'); assert.equal(dv.zrodlo, 'stripe');

        // REJESTR: tylko hash, tier, data i sesja — żadnych danych osobowych, nigdy jawnego klucza
        const rejestr = JSON.parse(await fs.readFile(path.join(katalog, 'jukebox', 'klucze.json'), 'utf8'));
        assert.equal(rejestr.klucze.length, 1, 'klucz powstaje TYLKO przy odbiorze płatności — sprawdzanie dostępu kluczy nie bije');
        for (const w of rejestr.klucze) {
            assert.deepEqual(Object.keys(w).sort(), ['hash', 'kiedy', 'sesja', 'tier', 'wazny']);
            assert.match(w.hash, /^[0-9a-f]{64}$/);
        }
        assert.ok(!(await fs.readFile(path.join(katalog, 'jukebox', 'klucze.json'), 'utf8')).includes(klucz), 'jawny klucz NIE leży na dysku');
        assert.ok((await J.klucze()).every((w) => !('hash' in w)), 'podgląd Suwerena bez hashy');
    } finally { srv.close(); await fs.rm(katalog, { recursive: true, force: true }); }
});

test('🎙 Lektor Katedry: tylko tier z funkcją, licznik znaków na kluczu, archiwum za darmo', async () => {
    const zlecenia = [];
    let katalogNagran = null;
    // atrapa silnika głosu: zapisuje plik i oddaje tyle znaków, ile naprawdę „nagrała” (0 = było już w archiwum)
    const lektor = async ({ tekst, rola, klucz }) => {
        const plik = path.join(katalogNagran, `${klucz}-${zlecenia.length}.mp3`);
        await fs.writeFile(plik, 'ID3-atrapa-nagrania');
        const zArchiwum = zlecenia.some((z) => z.tekst === tekst);
        zlecenia.push({ tekst, rola, klucz });
        return { plik, nazwa: path.basename(plik), znakow: zArchiwum ? 0 : tekst.length };
    };
    const { J, stripe, b, srv, katalog } = await start({ lektor, limitLektoraNaMinute: 50 });
    katalogNagran = katalog;
    try {
        await J.ustawCennik({ puls: 4.99, hact: 9.99, venue: 24.99 });
        const dajKlucz = async (tier) => {
            await post(`${b}/wizytowka/jukebox/kup`, { tier, powrot: 'https://teostory.studio/jukebox' });
            const id = [...stripe.sesje.values()].find((s) => s.pakiet === `jukebox-${tier}` && !s.oplacona).id;
            stripe.sesje.get(id).oplacona = true;
            const r = await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' });
            return new URL(r.headers.get('location')).searchParams.get('key');
        };
        const kluczPuls = await dajKlucz('puls'), kluczHact = await dajKlucz('hact');
        const mow = (klucz, tekst) => fetch(`${b}/wizytowka/jukebox/lektor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ klucz, tekst }) });

        // Puls nie ma lektorów — Katedra odmawia, nie przeglądarka
        const bezTieru = await mow(kluczPuls, 'Neon brzęczy w bursztynowym świetle.');
        assert.equal(bezTieru.status, 403); assert.match((await bezTieru.json()).message, /HACT Studio/);
        assert.equal(zlecenia.length, 0, 'silnik głosu nie został w ogóle zawołany');

        // HACT nagrywa i zużywa dokładnie tyle znaków, ile ma tekst
        const tekst = 'Zegar stanął na jedenastej jedenaście.';
        const ok = await mow(kluczHact, tekst);
        assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'audio/mpeg');
        assert.equal(await ok.text(), 'ID3-atrapa-nagrania');
        assert.equal(zlecenia.length, 1); assert.equal(zlecenia[0].klucz.length, 16, 'silnik dostaje ODCISK klucza, nie klucz');
        assert.ok(!zlecenia[0].klucz.includes('GRV'), 'jawny klucz nie wychodzi do silnika');
        let st = await J.lektorStan(kluczHact);
        assert.equal(st.limit, LIMITY_LEKTORA.hact); assert.equal(st.zuzyte, tekst.length); assert.equal(st.zostalo, LIMITY_LEKTORA.hact - tekst.length);
        assert.equal(Number(ok.headers.get('X-Lektor-Zostalo')), st.zostalo);

        // to samo nagranie drugi raz = z archiwum, licznik stoi (klient nie płaci dwa razy za to samo)
        assert.equal((await mow(kluczHact, tekst)).status, 200);
        assert.equal((await J.lektorStan(kluczHact)).zuzyte, tekst.length, 'archiwum nie zużywa limitu');

        // tekst dłuższy niż limit jednego nagrania
        assert.equal((await mow(kluczHact, 'a'.repeat(1300))).status, 413);
        // nieznany klucz i pusty tekst
        assert.equal((await mow('GRV-HACT-2345-6789', 'cokolwiek')).status, 404);
        assert.equal((await mow(kluczHact, ' ')).status, 400);

        // wyczerpany miesiąc → 402 z liczbami, silnik nie rusza
        await J.lektorZuzyj(kluczHact, LIMITY_LEKTORA.hact);
        st = await J.lektorStan(kluczHact); assert.equal(st.zostalo, 0);
        const ile = zlecenia.length;
        const pusto = await mow(kluczHact, 'Jeszcze jedno zdanie.');
        assert.equal(pusto.status, 402); assert.match((await pusto.json()).message, /zostało Ci 0 znaków/);
        assert.equal(zlecenia.length, ile, 'po wyczerpaniu limitu karta graficzna stoi');

        // 🛡 bezpiecznik doby: Venue ma jeszcze zapas miesięczny, ale karta graficzna Katedry na dziś skończyła
        const kluczVenue = await dajKlucz('venue');
        await J.lektorZuzyj(kluczVenue, LIMIT_DZIENNY_KATEDRY);
        const stV = await J.lektorStan(kluczVenue);
        assert.ok(stV.zostalo > 0, 'Venue ma jeszcze miesiąc');
        assert.equal(stV.katedra.zostalo, 0, 'doba Katedry wyczerpana');
        const doba = await mow(kluczVenue, 'Jeszcze jedno zdanie na dziś.');
        assert.equal(doba.status, 503); assert.match((await doba.json()).message, /karta graficzna|Wróć jutro/);

        // klucz niesie stan lektora, dalej bez danych osobowych
        const kj = await (await fetch(`${b}/wizytowka/jukebox/klucz?key=${encodeURIComponent(kluczHact)}`)).json();
        assert.equal(kj.tier, 'hact'); assert.equal(kj.lektor.limit, LIMITY_LEKTORA.hact); assert.equal(kj.lektor.lektor, true);
        for (const w of await J.klucze()) assert.deepEqual(Object.keys(w).filter((x) => !['tier', 'sesja', 'kiedy', 'wazny', 'znakow'].includes(x)), []);
    } finally { srv.close(); await fs.rm(katalog, { recursive: true, force: true }); }

    // dławik nagrań: karta graficzna Katedry jest jedna, więc seria żądań z jednego adresu dostaje 429
    const d = await start({ lektor: async () => { throw new Error('nie powinno dojść do silnika'); }, limitLektoraNaMinute: 2 });
    try {
        const strzal = () => fetch(`${d.b}/wizytowka/jukebox/lektor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ klucz: 'GRV-HACT-2345-6789', tekst: 'proba' }) });
        assert.equal((await strzal()).status, 404); assert.equal((await strzal()).status, 404);
        assert.equal((await strzal()).status, 429, 'trzecie żądanie w minucie odbite');
    } finally { d.srv.close(); await fs.rm(d.katalog, { recursive: true, force: true }); }
});

test('📚 Tier 4: księga zgłoszona Kluczem Venue czeka na ✓ Suwerena, a nie ląduje wprost w katalogu', async () => {
    const opublikowane = [];
    const publikujKsiege = async (d) => { opublikowane.push(d); return { id: `ksiega-${opublikowane.length}` }; };
    const katalogTmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jukebox-pub-')), stripe = atrapaStripe();
    const J = utworzJukebox({ katalog: katalogTmp, stripe, adres: async () => 'https://katedra.test', czySuweren: async (k) => k === KLUCZ_SU, publikujKsiege });
    const app = express(); app.use(express.json({ limit: '10mb' })); zamontujTrasyJukeboxa(app, J, { limitPublikacjiNaMinute: 50 });
    const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const b = `http://127.0.0.1:${srv.address().port}`;
    try {
        await J.ustawCennik({ puls: 4.99, hact: 9.99, venue: 24.99 });
        const dajKlucz = async (tier) => {
            await post(`${b}/wizytowka/jukebox/kup`, { tier, powrot: 'https://teostory.studio/jukebox' });
            const id = [...stripe.sesje.values()].find((s) => s.pakiet === `jukebox-${tier}` && !s.oplacona).id;
            stripe.sesje.get(id).oplacona = true;
            const r = await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' });
            return new URL(r.headers.get('location')).searchParams.get('key');
        };
        const ksiega = { title: 'Nocny Kontuar', author: 'Ktoś Obcy', language: 'pl', pages: [{ narrativeText: 'Neon brzęczy w bursztynowym świetle.' }, { narrativeText: 'Zegar stanął na jedenastej jedenaście.' }] };
        const zglos = (klucz, book = ksiega, extra = {}) => post(`${b}/wizytowka/jukebox/publikuj`, { klucz, book, ...extra });

        // HACT nie ma publikacji — to funkcja Tieru 4
        const kluczHact = await dajKlucz('hact');
        const h = await zglos(kluczHact);
        assert.equal(h.s, 403); assert.match(h.d.message, /Katedra Venue/);
        assert.equal(opublikowane.length, 0);

        // Venue zgłasza — i NIC jeszcze nie trafia do katalogu
        const kluczVenue = await dajKlucz('venue');
        const z = await zglos(kluczVenue);
        assert.equal(z.s, 200); assert.equal(z.d.stan, 'do_zgody'); assert.equal(z.d.tytul, 'Nocny Kontuar');
        assert.equal(opublikowane.length, 0, 'zgłoszenie samo niczego nie publikuje');

        // widać je w Izbie zgód, z „✓ opublikuj” tylko przy Katedrze
        const czeka = await J.zrodloIzby.czekajace();
        assert.equal(czeka.length, 1); assert.equal(czeka[0].tytul, 'Nocny Kontuar');
        assert.match(czeka[0].opis, /autor: Ktoś Obcy · 2 stron/);
        assert.equal(czeka[0].akcje.find((a) => a.id === 'przyjmij').zdalnie, false, 'obcej księgi nie ocenia się z telefonu');
        assert.equal(czeka[0].akcje.find((a) => a.id === 'odrzuc').zdalnie, true);

        // 💶 płatna księga tą drogą NIE wchodzi — Stripe wypożyczenia szedłby przez Katedrę, nie przez autora
        const platna = await zglos(kluczVenue, ksiega, { rentalTier: 'rental_48h', cenaEur: 2.99 });
        assert.equal(platna.s, 409); assert.match(platna.d.message, /tylko za darmo \(demo\)/);
        assert.match(platna.d.message, /własną Katedrę|Federacj/, 'mówi, gdzie sprzedawać');
        assert.equal(opublikowane.length, 0);

        // śmieci odpadają na wejściu, tą samą walidacją co publikacja z Huba
        assert.equal((await zglos(kluczVenue, { title: 'Pusta', pages: [] })).s, 400);
        assert.equal((await zglos('GRV-VENUE-2345-6789')).s, 404);

        // ✕ odrzucenie: treść znika, katalog nietknięty
        const odrzucone = await J.decydujKsiege(z.d.id, 'odrzuc', { powod: 'nie ten klimat' });
        assert.equal(odrzucone.stan, 'odrzucone'); assert.equal(opublikowane.length, 0);
        assert.equal((await J.zrodloIzby.czekajace()).length, 0);
        await assert.rejects(() => J.decydujKsiege(z.d.id, 'przyjmij'), /zniknęła|Nie ma takiego/, 'rozstrzygniętego zgłoszenia nie da się wskrzesić');

        // ✓ przyjęcie: dopiero teraz księga idzie do Wypożyczalni, wystawiona
        const z2 = await zglos(kluczVenue);
        const przyjete = await J.decydujKsiege(z2.d.id, 'przyjmij');
        assert.equal(przyjete.stan, 'przyjete'); assert.equal(przyjete.ksiega, 'ksiega-1');
        assert.equal(opublikowane.length, 1);
        assert.equal(opublikowane[0].wystaw, true); assert.equal(opublikowane[0].rentalTier, 'demo'); assert.equal(opublikowane[0].cenaEur, 0);
        assert.equal(opublikowane[0].book.title, 'Nocny Kontuar');
        assert.equal((await J.zrodloIzby.czekajace()).length, 0);

        // limit kolejki: trzy czekające zgłoszenia na klucz, czwarte odbite
        for (let i = 0; i < 3; i++) assert.equal((await zglos(kluczVenue)).s, 200, `zgłoszenie ${i + 1}`);
        const czwarte = await zglos(kluczVenue);
        assert.equal(czwarte.s, 409); assert.match(czwarte.d.message, /czekające na zgodę/);
    } finally { srv.close(); await fs.rm(katalogTmp, { recursive: true, force: true }); }
});

test('Straż: publiczne /wizytowka/jukebox*, Hub /api/jukebox tylko maszyna', () => {
    for (const p of ['/wizytowka/jukebox', '/wizytowka/jukebox/kup', '/wizytowka/jukebox/dostep', '/wizytowka/jukebox/odbior', '/wizytowka/jukebox/klucz', '/wizytowka/jukebox/lektor', '/wizytowka/jukebox/publikuj']) assert.ok(SCIEZKA_JUKEBOX.test(p), p);
    for (const p of ['/wizytowka/jukebox/cennik', '/wizytowka/jukebox/../api', '/wizytowka/jukeboxx']) assert.ok(!SCIEZKA_JUKEBOX.test(p), p);
    assert.ok(SCIEZKI_TYLKO_LOKALNE.includes('/api/jukebox'));
});
