// 📻 Jukebox: Tiery GRV, cennik, Stripe Checkout (atrapa Stripe — żaden prawdziwy płatny ruch), Klucz Suwerena, Straż.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { utworzJukebox, zamontujTrasyJukeboxa, TIERY, PLATNE } from '../services/JukeboxTiery.js';
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
async function start({ tunel = 'https://katedra.test' } = {}) {
    const katalog = await fs.mkdtemp(path.join(os.tmpdir(), 'jukebox-')), stripe = atrapaStripe();
    const J = utworzJukebox({ katalog, stripe, adres: async () => tunel, czySuweren: async (k) => k === KLUCZ_SU });
    const app = express(); app.use(express.json()); zamontujTrasyJukeboxa(app, J);
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
        assert.equal(r.status, 302); assert.equal(r.headers.get('location'), `https://teostory.studio/jukebox?app=jukebox&tier=hact&sesja=${id}`);
        await fetch(`${b}/wizytowka/jukebox/odbior?sesja=${id}`, { redirect: 'manual' });
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

test('Straż: publiczne /wizytowka/jukebox*, Hub /api/jukebox tylko maszyna', () => {
    for (const p of ['/wizytowka/jukebox', '/wizytowka/jukebox/kup', '/wizytowka/jukebox/dostep', '/wizytowka/jukebox/odbior']) assert.ok(SCIEZKA_JUKEBOX.test(p), p);
    for (const p of ['/wizytowka/jukebox/cennik', '/wizytowka/jukebox/../api', '/wizytowka/jukeboxx']) assert.ok(!SCIEZKA_JUKEBOX.test(p), p);
    assert.ok(SCIEZKI_TYLKO_LOKALNE.includes('/api/jukebox'));
});
