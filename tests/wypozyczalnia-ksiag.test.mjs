// 📚 Wypożyczalnia Żywych Ksiąg — publikacja, katalog publiczny, demo za darmo, 48 h przez (atrapę) Stripe, wygaśnięcie, Straż.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzWypozyczalnie, zamontujTrasyWypozyczalni, sprawdzKsiege, dozwolonyPowrot } from '../services/WypozyczalniaKsiag.js';
import { SCIEZKA_TEOSTORY, SCIEZKA_WYPOZYCZENIA } from '../services/StrazMostu.js';

const KSIEGA = { id: 'Kroniki 21:21', title: 'Kroniki 21:21', subtitle: 'Akt I', author: 'TeO', pages: [
    { pageNumber: 1, chapterTitle: 'I', narrativeText: 'Gdy zegary Katedry wskazały 21:21, stadion zaśpiewał.', dialogueLines: [], illustrationPrompt: '', imageCaption: '', imageUrl: 'data:image/png;base64,iVBORw0KGgo=' }] };

test('sprawdzKsiege i powrót: bez stron / tekstu odmowa, vip_full jeszcze nie, powrót tylko na teostory.studio', () => {
    assert.throws(() => sprawdzKsiege({ title: 'x', pages: [] }), /nie ma stron/);
    assert.throws(() => sprawdzKsiege({ title: 'x', pages: [{ narrativeText: '' }] }), /tekstu/);
    assert.throws(() => sprawdzKsiege(KSIEGA, { tier: 'vip_full' }), /vip_full/);
    assert.equal(dozwolonyPowrot('https://teostory.studio/polka?x=1'), 'https://teostory.studio/polka');
    assert.equal(dozwolonyPowrot('https://zlo.example/'), null);
    assert.ok(SCIEZKA_TEOSTORY.test('/wizytowka/teostory') && SCIEZKA_TEOSTORY.test('/wizytowka/teostory/kroniki-21-21/czytaj') && SCIEZKA_TEOSTORY.test('/wizytowka/teostory/odbior'));
    assert.ok(SCIEZKA_WYPOZYCZENIA.test('/wizytowka/teostory/kroniki-21-21/wypozycz'));
    assert.ok(!SCIEZKA_TEOSTORY.test('/wizytowka/teostory/../x/czytaj'));
});

test('publikacja → katalog → 402 bez płatności → Stripe → odbiór 302 na portal → czytanie → wygasa po 48 h', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'teostory-'));
    let zegar = Date.parse('2026-11-05T10:00:00Z');
    const sesje = [];
    const stripe = {
        sesjaZakupu: async (o) => { sesje.push(o); return { id: 'cs_test_a1', url: 'https://checkout.stripe.com/c/pay/cs_test_a1' }; },
        sprawdzSesje: async (id) => ({ id, oplacona: id === 'cs_test_a1', pakiet: 'kroniki-21-21', rodzaj: 'ksiega-48h', powrot: sesje[0]?.metadane?.powrot, kwota: 1.99, waluta: 'eur', tryb: 'test' }),
    };
    const W = utworzWypozyczalnie({ katalog: tmp, stripe, adres: async () => 'https://katedra.example', teraz: () => zegar });
    const app = express(); app.use(express.json({ limit: '50mb' })); zamontujTrasyWypozyczalni(app, W);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    try {
        const pub = await (await fetch(`${baza}/api/books/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ book: KSIEGA, cenaEur: 1.99 }) })).json();
        assert.equal(pub.wpis.id, 'kroniki-21-21');
        const kat = await (await fetch(`${baza}/wizytowka/teostory`)).json();
        assert.equal(kat.ksiegi[0].okladka, '/wizytowka/teostory/kroniki-21-21/obraz/obraz-1.png', 'dataURL strony → plik Wypożyczalni');
        assert.equal(kat.ksiegi[0].cenaEur, 1.99);
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/obraz/obraz-1.png`)).status, 200);
        assert.ok(SCIEZKA_TEOSTORY.test('/wizytowka/teostory/kroniki-21-21/obraz/obraz-1.png'));
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj`)).status, 402);
        const w = await (await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/wypozycz`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ powrot: 'https://teostory.studio/' }) })).json();
        assert.match(w.url, /checkout\.stripe\.com/);
        assert.equal(sesje[0].kwotaCentow, 199, 'cenę liczy most');
        assert.equal(sesje[0].sukces, '/wizytowka/teostory/odbior');
        const odb = await fetch(`${baza}/wizytowka/teostory/odbior?sesja=cs_test_a1`, { redirect: 'manual' });
        assert.equal(odb.status, 302);
        assert.match(odb.headers.get('location'), /^https:\/\/teostory\.studio\/\?ksiega=kroniki-21-21&sesja=cs_test_a1$/);
        const cz = await (await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj?sesja=cs_test_a1`)).json();
        assert.equal(cz.ksiega.pages.length, 1);
        assert.ok(cz.dostepDo);
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj?sesja=cs_zla`)).status, 402);
        zegar += 49 * 3600e3;
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj?sesja=cs_test_a1`)).status, 410);
        // demo = bez płatności; wycofana = znika z katalogu
        await W.publikuj({ book: { ...KSIEGA, id: 'demo-ksiega' }, rentalTier: 'demo' });
        assert.equal((await fetch(`${baza}/wizytowka/teostory/demo-ksiega/czytaj`)).status, 200);
        await W.wycofaj('demo-ksiega');
        assert.equal((await (await fetch(`${baza}/wizytowka/teostory`)).json()).ksiegi.length, 1);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});
