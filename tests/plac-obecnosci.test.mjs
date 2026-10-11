// 👥 Plac obecności — meldunki pozycji w pamięci: widzą się nawzajem, limit placu, częstotliwość, wygasanie,
// ciało tylko z assetów gry, imię oczyszczone; trasy za Strażą (tylko udostępniona gra, POST tej jednej ścieżki).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { utworzPlac, imieGracza, ZYWOTNOSC_MS } from '../services/PlacObecnosci.js';

const ja = (id, o = {}) => ({ id, imie: 'Ola', x: 1, y: 2, z: 3, rot: 0.5, ruch: 'idzie', cialo: 'bohater-mira.glb', ...o });

test('plac: dwóch graczy widzi się nawzajem, ciało tylko z assetów gry, imię oczyszczone', async () => {
    let t = 1000;
    const P = utworzPlac({ max: 3, teraz: () => t, czyCialo: async (_g, p) => p === 'bohater-mira.glb' });
    const a = await P.melduj('teterhia', '1.1.1.1', ja('aaaaaaaa'));
    assert.deepEqual(a.inni, []);
    t += 200;
    const b = await P.melduj('teterhia', '2.2.2.2', ja('bbbbbbbb', { imie: 'Kot‮\u0007 Tancerz', cialo: 'https://zly.example/x.glb', x: 9999 }));
    assert.equal(b.inni.length, 1);
    assert.deepEqual([b.inni[0].imie, b.inni[0].cialo, b.inni[0].x, b.inni[0].ruch], ['Ola', 'bohater-mira.glb', 1, 'idzie']);
    t += 200;
    const a2 = await P.melduj('teterhia', '1.1.1.1', ja('aaaaaaaa', { x: 5 }));
    assert.deepEqual([a2.inni[0].imie, a2.inni[0].cialo, a2.inni[0].x], ['Kot Tancerz', null, 500]);
    assert.equal(P.stan().place.teterhia.graczy, 2);
    assert.equal(imieGracza(''), 'Wędrowiec');
    assert.equal(imieGracza('x'.repeat(40)).length, 24);
});

test('plac: limit graczy (pełny), częstotliwość, adres, wygasanie i wyjście', async () => {
    let t = 1000;
    const P = utworzPlac({ max: 2, teraz: () => t });
    await P.melduj('g', '1.1.1.1', ja('aaaaaaaa'));
    await P.melduj('g', '2.2.2.2', ja('bbbbbbbb'));
    const c = await P.melduj('g', '3.3.3.3', ja('cccccccc'));
    assert.equal(c.pelny, true);
    assert.equal(c.ja, null);
    // częściej niż co 150 ms — stan bez zmian
    await P.melduj('g', '1.1.1.1', ja('aaaaaaaa', { x: 50 }));
    t += 200;
    assert.equal((await P.melduj('g', '2.2.2.2', ja('bbbbbbbb'))).inni[0].x, 1);
    await assert.rejects(P.melduj('g', '9.9.9.9', ja('aaaaaaaa')), /innego adresu/);
    await assert.rejects(P.melduj('g', '1.1.1.1', ja('ZLE ID')), /identyfikator/);
    // z jednego adresu najwyżej 3
    const Q = utworzPlac({ max: 10, teraz: () => t });
    for (const id of ['aaaaaaa1', 'aaaaaaa2', 'aaaaaaa3']) await Q.melduj('g', '5.5.5.5', ja(id));
    await assert.rejects(Q.melduj('g', '5.5.5.5', ja('aaaaaaa4')), /jednego adresu/);
    assert.equal(Q.wyjdz('g', '5.5.5.5', 'aaaaaaa1'), true);
    assert.equal(Q.stan().place.g.graczy, 2);
    t += ZYWOTNOSC_MS + 1;
    assert.deepEqual(Q.stan().place, {}, 'po ciszy plac pusty');
    assert.equal((await P.melduj('g', '3.3.3.3', ja('cccccccc'))).pelny, false, 'miejsce się zwolniło');
});

test('trasy placu za Strażą: tylko udostępniona gra, gość bez klucza melduje, inne POST dalej zamknięte', async () => {
    const { default: express } = await import('express');
    const { strazMostu } = await import('../services/StrazMostu.js');
    const { utworzPaczkiGier, zamontujTrasyGier } = await import('../services/PaczkiGier.js');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plac-'));
    try {
        for (const id of ['gra-a', 'gra-b']) {
            await fs.mkdir(path.join(root, 'apki', id, 'dist', 'assety'), { recursive: true });
            await fs.writeFile(path.join(root, 'apki', id, 'dist', 'index.html'), '<div id="gra"></div>');
            await fs.writeFile(path.join(root, 'apki', id, 'dist', 'assety', 'bohater-mira.glb'), 'glb');
        }
        const k = crypto.generateKeyPairSync('ed25519');
        const paczki = utworzPaczkiGier({ katalog: path.join(root, 'wymiar'), katalogApek: path.join(root, 'apki'), nick: async () => 'teo-mas', klucz: async () => 'K', podpisz: async (t) => crypto.sign(null, Buffer.from(t), k.privateKey).toString('base64'), rejestr: 'x' });
        await paczki.udostepnij('gra-a');
        const app = express();
        app.use(express.json());
        app.use(strazMostu({ klucz: () => 'k'.repeat(48) }));
        zamontujTrasyGier(app, { paczki, nick: async () => 'teo-mas', wczytajRynek: async () => ({ products: [] }), zapiszRynek: async () => {} });
        const srv = app.listen(0);
        const adres = `http://127.0.0.1:${srv.address().port}`;
        const melduj = (gra, ip, cialo) => fetch(`${adres}/wizytowka/plac/${gra}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip, origin: 'https://otakos.wtf' }, body: JSON.stringify(cialo) });
        try {
            const r1 = await melduj('gra-a', '1.1.1.1', ja('aaaaaaaa'));
            assert.equal(r1.status, 200);
            assert.equal(r1.headers.get('access-control-allow-origin'), '*');
            const r2 = await (await melduj('gra-a', '2.2.2.2', ja('bbbbbbbb', { imie: 'Gość' }))).json();
            assert.deepEqual(r2.inni.map((x) => [x.imie, x.cialo]), [['Ola', 'bohater-mira.glb']]);
            assert.equal((await melduj('gra-b', '1.1.1.1', ja('aaaaaaaa'))).status, 404, 'nieudostępniona gra nie ma placu');
            assert.equal((await melduj('gra-a', '1.1.1.1', { ...ja('aaaaaaaa'), smiec: 'x'.repeat(3000) })).status, 413);
            const pre = await fetch(`${adres}/wizytowka/plac/gra-a`, { method: 'OPTIONS', headers: { origin: 'https://inna.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type', 'cf-connecting-ip': '1.1.1.1' } });
            assert.ok(pre.status < 300, `preflight ${pre.status}`);
            assert.equal((await fetch(`${adres}/wizytowka/plac/gra-a/inne`, { method: 'POST', headers: { 'cf-connecting-ip': '1.1.1.1' } })).status, 401);
            assert.equal((await fetch(`${adres}/api/gry`, { headers: { 'cf-connecting-ip': '1.1.1.1' } })).status, 401);
            assert.equal((await (await fetch(`${adres}/api/gry`)).json()).plac.place['gra-a'].graczy, 2);
            await fetch(`${adres}/wizytowka/plac/gra-a/wyjdz`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '2.2.2.2' }, body: JSON.stringify({ id: 'bbbbbbbb' }) });
            assert.equal((await (await fetch(`${adres}/api/gry`)).json()).plac.place['gra-a'].graczy, 1);
        } finally { srv.close(); }
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
