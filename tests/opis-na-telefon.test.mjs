// 📱📋 Opis szkicu TikTok na telefon linkiem: token, wygasanie, strona bez tłumaczenia, Straż (strona publiczna, link tylko maszyna).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { utworzSchowekOpisow, zamontujTrasyOpisu, stronaOpisu, TTL_MS } from '../services/OpisNaTelefon.js';
import { czyWizytowka } from '../services/StrazMostu.js';

test('schowek: token 24 hex, odczyt, wygasa po 6 h, pusty/za długi odmowa', () => {
    let t = 1_000_000;
    const S = utworzSchowekOpisow({ teraz: () => t });
    const { token } = S.dodaj('Nu dances! #dance #teo');
    assert.match(token, /^[0-9a-f]{24}$/);
    assert.equal(S.odczytaj(token), 'Nu dances! #dance #teo');
    assert.equal(S.odczytaj('zly'), null);
    t += TTL_MS + 1;
    assert.equal(S.odczytaj(token), null);
    assert.throws(() => S.dodaj('  '), /Pusty/);
    assert.throws(() => S.dodaj('x'.repeat(7000)), /za długi/);
});

test('strona: blokada tłumaczenia, tekst uciekniony, przycisk Kopiuj; wygasły = komunikat', () => {
    const h = stronaOpisu('<b>Nu</b> & "TeO"');
    assert.match(h, /translate="no"/);
    assert.match(h, /name="google" content="notranslate"/);
    assert.match(h, /&lt;b&gt;Nu&lt;\/b&gt; &amp; &quot;TeO&quot;/);
    assert.match(h, /📋 Kopiuj opis/);
    assert.match(stronaOpisu(null), /Link wygasł/);
});

test('trasy: link z adresem tunelu (bez tunelu = null z powodem), strona 200/404; Straż wpuszcza tylko stronę', async () => {
    const app = express();
    app.use(express.json());
    let adres = 'https://katedra.example.com';
    zamontujTrasyOpisu(app, utworzSchowekOpisow(), { adresTunelu: () => adres });
    const srv = app.listen(0);
    const B = `http://127.0.0.1:${srv.address().port}`;
    try {
        const l = await (await fetch(`${B}/api/formaty/opis-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tekst: 'Opis Nu' }) })).json();
        assert.match(l.url, /^https:\/\/katedra\.example\.com\/wizytowka\/opis\/[0-9a-f]{24}$/);
        const sciezka = new URL(l.url).pathname;
        const r = await fetch(`${B}${sciezka}`);
        assert.equal(r.status, 200);
        assert.match(await r.text(), /Opis Nu/);
        assert.equal((await fetch(`${B}/wizytowka/opis/${'0'.repeat(24)}`)).status, 404);
        adres = null;
        const bez = await (await fetch(`${B}/api/formaty/opis-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tekst: 'x' }) })).json();
        assert.equal(bez.url, null);
        assert.match(bez.powod, /Tunel nie działa/);
        assert.equal(czyWizytowka({ method: 'GET', path: sciezka }), true);
        assert.equal(czyWizytowka({ method: 'POST', path: '/api/formaty/opis-link' }), false);
        assert.equal(czyWizytowka({ method: 'GET', path: '/wizytowka/opis/zly-token' }), false);
    } finally { srv.close(); }
});
