// 🌍 Licznik wejść: kraj z Cloudflare, bez IP na dysku, jedna wieść na osobę, boty bez wieści.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzLicznikWejsc, zamontujTrasyLicznika, opisWejscia, hostOdsylajacego } from '../services/LicznikWejsc.js';
import { czyWizytowka } from '../services/StrazMostu.js';

const UA = 'Mozilla/5.0 (Linux; Android 17) Chrome/150 Mobile Safari/537.36';

function licznik(t = Date.parse('2026-10-30T09:00:00Z')) {
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'wejscia-'));
    const wiesci = [];
    const czas = { t };
    const L = utworzLicznikWejsc({ katalog, wiesc: async (w) => { wiesci.push(w); }, teraz: () => czas.t });
    return { L, katalog, wiesci, czas };
}

test('wejście: wieść z krajem i źródłem, na dysku bez IP', async () => {
    const { L, katalog, wiesci } = licznik();
    const r = await L.zglos({ ip: '203.0.113.7', kraj: 'DE', ua: UA, strona: 'teo.center', sciezka: '/', skad: 'https://www.youtube.com/watch?v=x' });
    assert.equal(r.przyjete, true);
    assert.equal(wiesci.length, 1);
    assert.match(wiesci[0].tresc, /Niemcy.*teo\.center.*youtube\.com/);
    const dysk = fs.readFileSync(path.join(katalog, '2026-10-30.jsonl'), 'utf8');
    assert.doesNotMatch(dysk, /203\.0\.113/);
    assert.doesNotMatch(dysk, /watch\?v=/);
});

test('ta sama osoba w 30 min = jedna wieść; po przerwie znowu', async () => {
    const { L, wiesci, czas } = licznik();
    await L.zglos({ ip: '1.2.3.4', kraj: 'PL', ua: UA, strona: 'teo.center' });
    await L.zglos({ ip: '1.2.3.4', kraj: 'PL', ua: UA, strona: 'teo.center' });
    assert.equal(wiesci.length, 1);
    czas.t += 31 * 60_000;
    await L.zglos({ ip: '1.2.3.4', kraj: 'PL', ua: UA, strona: 'teo.center' });
    assert.equal(wiesci.length, 2);
});

test('bot liczony bez wieści; obca strona odrzucona', async () => {
    const { L, wiesci } = licznik();
    await L.zglos({ ip: '5.5.5.5', kraj: 'FR', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)', strona: 'teo.center' });
    assert.equal(wiesci.length, 0);
    assert.equal((await L.zglos({ ip: '6.6.6.6', kraj: 'FR', ua: UA, strona: 'zla.pl' })).przyjete, false);
    const p = await L.podsumowanie({ dni: 1 });
    assert.equal(p.boty, 1);
    assert.equal(p.ludzie, 0);
});

test('podsumowanie: kraje i źródła', async () => {
    const { L } = licznik();
    await L.zglos({ ip: 'a', kraj: 'DE', ua: UA, strona: 'teo.center', skad: 'https://google.com/' });
    await L.zglos({ ip: 'b', kraj: 'DE', ua: UA, strona: 'teo.center' });
    await L.zglos({ ip: 'c', kraj: 'JP', ua: UA, strona: 'otakos.wtf', skad: 'https://otakos.wtf/x' });
    const p = await L.podsumowanie({ dni: 1 });
    assert.equal(p.ludzie, 3);
    assert.deepEqual(p.kraje[0], { kod: 'DE', nazwa: 'Niemcy', ile: 2 });
    assert.deepEqual(p.skad, [{ host: 'google.com', ile: 1 }]);   // nawigacja wewnątrz strony to nie źródło
});

test('opis i host odsyłającego', () => {
    assert.equal(hostOdsylajacego('https://www.Facebook.com/a?b'), 'facebook.com');
    assert.equal(hostOdsylajacego('nie-adres'), null);
    assert.match(opisWejscia({ kraj: 'JP', strona: 'teo.center', sciezka: '/' }), /^🌍 Japonia — ktoś wszedł na teo\.center$/);
});

test('trasa HTTP: kraj z cf-ipcountry, Straż wpuszcza tylko POST/OPTIONS', async () => {
    const { L, wiesci } = licznik();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.lokalny = false; next(); });
    zamontujTrasyLicznika(app, L);
    const s = app.listen(0);
    try {
        const adres = `http://127.0.0.1:${s.address().port}`;
        const r = await fetch(`${adres}/wizytowka/wejscie`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-ipcountry': 'BE', 'cf-connecting-ip': '9.9.9.9', 'user-agent': UA }, body: JSON.stringify({ strona: 'teo.center', sciezka: '/#ksiega' }) });
        assert.equal((await r.json()).przyjete, true);
        assert.match(wiesci[0].tresc, /Belgia/);
        assert.equal((await fetch(`${adres}/api/wejscia`)).status, 403);
    } finally { s.close(); }
    assert.equal(czyWizytowka({ method: 'POST', path: '/wizytowka/wejscie' }), true);
    assert.equal(czyWizytowka({ method: 'GET', path: '/wizytowka/wejscie' }), false);
});
