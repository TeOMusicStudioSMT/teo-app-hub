// Ceny Rynku: jedno pytanie do CoinGecko na minutę, ostatnie prawdziwe ceny przy odmowie (429).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as CenyRynku from '../services/CenyRynku.js';

const odpowiedz = (status, body) => ({ ok: status === 200, status, json: async () => body });

test('Ceny: jedno zapytanie na minutę dla wielu kart naraz, kolejność i duplikaty id nie mają znaczenia', async () => {
    let t = 1_000_000, pytania = 0;
    CenyRynku.wyczysc();
    CenyRynku.skonfiguruj({ teraz: () => t, fetch: async (url) => { pytania++; assert.match(url, /ids=bitcoin,ethereum&vs_currencies=usd$/); return odpowiedz(200, { bitcoin: { usd: 100 }, ethereum: { usd: 10 } }); } });
    const [a, b] = await Promise.all([CenyRynku.ceny({ ids: 'bitcoin,ethereum' }), CenyRynku.ceny({ ids: ['ethereum', 'bitcoin', 'bitcoin'] })]);
    assert.equal(pytania, 1);
    assert.deepEqual(a.ceny, { bitcoin: 100, ethereum: 10 });
    assert.deepEqual(b, a);
    assert.equal(a.nieaktualne, false);
    t += 30_000;
    await CenyRynku.ceny({ ids: 'bitcoin,ethereum' });
    assert.equal(pytania, 1, 'w ciągu minuty z pamięci');
    t += 31_000;
    await CenyRynku.ceny({ ids: 'bitcoin,ethereum' });
    assert.equal(pytania, 2, 'po minucie znowu CoinGecko');
});

test('Ceny: 429 od CoinGecko → ostatnie prawdziwe ceny z datą i nieaktualne; bez wcześniejszych — pusto z powodem', async () => {
    let t = 5_000_000, status = 200;
    CenyRynku.wyczysc();
    CenyRynku.skonfiguruj({ teraz: () => t, fetch: async () => (status === 200 ? odpowiedz(200, { solana: { usd: 150 } }) : odpowiedz(status, { status: { error_code: 429 } })) });
    const ok = await CenyRynku.ceny({ ids: 'solana' });
    t += 61_000; status = 429;
    const stare = await CenyRynku.ceny({ ids: 'solana' });
    assert.deepEqual(stare.ceny, { solana: 150 });
    assert.equal(stare.nieaktualne, true);
    assert.equal(stare.kiedy, ok.kiedy, 'data ostatnich prawdziwych cen, nie próby');
    assert.match(stare.blad, /429/);

    const pusto = await CenyRynku.ceny({ ids: 'near' });
    assert.deepEqual([pusto.ceny, pusto.kiedy, pusto.nieaktualne], [{}, null, false]);
    assert.match(pusto.blad, /429/);
});

test('Ceny: złe id albo waluta — odmowa, bez pytania CoinGecko', async () => {
    let pytania = 0;
    CenyRynku.skonfiguruj({ fetch: async () => { pytania++; return odpowiedz(200, {}); } });
    await assert.rejects(CenyRynku.ceny({ ids: '' }), /od 1 do 30/);
    await assert.rejects(CenyRynku.ceny({ ids: 'bit coin' }), /od 1 do 30/);
    await assert.rejects(CenyRynku.ceny({ ids: 'bitcoin', vs: 'u$d' }), /Zła waluta/);
    assert.equal(pytania, 0);
});
