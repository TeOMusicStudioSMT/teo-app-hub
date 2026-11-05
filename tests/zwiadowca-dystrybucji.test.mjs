// 👕🔭 Zwiadowca kanałów dystrybucji — zero zmyśleń, brak zgadywania pól, auto Claude → Gemini, Izba zgód.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sprawdzKanaly, utworzZwiadowceDystrybucji } from '../services/ZwiadowcaDystrybucji.js';
import { zrodlaZOdpowiedzi, zrodlaZGroundingu } from '../services/ZwiadowcaPromocji.js';
import { utworzIzbe } from '../services/IzbaZgod.js';

const JSON_KANALOW = { kanaly: [
    { nazwa: 'Forum o POD', link: 'https://reddit.com/r/printondemand/abc', kategoria: 'pod', pewnosc: 'forum' },
    { nazwa: 'Printful', link: 'https://www.printful.com/integrations/shopify', kategoria: 'pod', model: 'POD', prowizjaKoszty: 'bez abonamentu', wysylkaUE: true, integracje: ['Shopify'], pewnosc: 'oficjalne' },
    { nazwa: 'Zmyślony', link: 'https://nie-istnieje.example/merch', pewnosc: 'oficjalne' },
    { nazwa: 'Dziwny', link: 'https://www.printful.com/pricing', model: 'franczyza', kategoria: 'cos' },
], podsumowanie: 'Dwa kanały.' };

test('sprawdzKanaly: tylko linki z wyników, zmyślony odrzucony z powodem, oficjalne pierwsze, bez zgadywania pól', () => {
    const zrodla = zrodlaZOdpowiedzi([{ type: 'web_search_tool_result', content: [
        { url: 'https://www.printful.com/integrations/shopify', title: 'Printful Shopify' }, { url: 'https://www.printful.com/', title: 'Printful' },
        { url: 'https://reddit.com/r/printondemand/abc', title: 'r/pod' }] }]);
    const { przyjete, odrzucone } = sprawdzKanaly(JSON_KANALOW, zrodla, 'pod');
    assert.deepEqual(przyjete.map((k) => k.nazwa), ['Printful', 'Dziwny', 'Forum o POD']);
    assert.equal(odrzucone.length, 1);
    assert.match(odrzucone[0].powod, /możliwe zmyślenie/);
    const dziwny = przyjete.find((k) => k.nazwa === 'Dziwny');
    assert.equal(dziwny.model, 'POD');
    assert.equal(dziwny.kategoria, 'pod');
    assert.equal(dziwny.prowizjaKoszty, null);
    assert.equal(dziwny.licencjaWzory, null);
    assert.equal(dziwny.wysylkaUE, null);
    // Gemini: domena z groundingu
    const g = sprawdzKanaly({ kanaly: [{ nazwa: 'Gelato', link: 'https://www.gelato.com/shopify' }] },
        zrodlaZGroundingu({ groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/x', title: 'gelato.com' } }] }));
    assert.equal(g.przyjete[0].potwierdzone, 'domena');
});

test('auto: Anthropic pada → Gemini; zapis dystrybucja.json z kosztem; propozycja → Izba → ✓ / ✕', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dystr-'));
    const decyzje = [];
    try {
        const fetch = async (url) => {
            if (String(url).includes('anthropic')) return new Response(JSON.stringify({ error: { message: 'brak kredytów' } }), { status: 400 });
            return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ kanaly: [
                { nazwa: 'Printful', link: 'https://www.printful.com/shopify', wysylkaUE: true, pewnosc: 'oficjalne' },
                { nazwa: 'Zmyślony', link: 'https://nie-ma.example/' }], podsumowanie: 'ok' }) }] },
                groundingMetadata: { webSearchQueries: ['pod shopify eu'], groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/a', title: 'printful.com' } }] } }],
                usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } }), { status: 200 });
        };
        const Z = utworzZwiadowceDystrybucji({ katalog: tmp, fetch, klucze: { anthropic: async () => 'a', gemini: async () => 'g' }, modelGemini: () => 'gemini-test', jajo: { decyzja: async (x) => decyzje.push(x) } });
        const zw = await Z.szukaj({ kategoria: 'pod' });
        assert.equal(zw.dostawca, 'gemini');
        assert.equal(zw.kanaly.length, 1);
        assert.equal(zw.odrzucone.length, 1);
        assert.equal(zw.koszt.wyszukan, 1);
        assert.equal((await Z.stan()).zwiady.length, 1);
        await assert.rejects(Z.zaproponuj({ link: 'https://nie-ma.example/' }), /najpierw zwiad/);
        const p = await Z.zaproponuj({ link: 'https://www.printful.com/shopify', notatka: 'na bluzy' });
        assert.equal((await Z.zaproponuj({ link: 'https://www.printful.com/shopify' })).id, p.id, 'bez dubli');
        const I = utworzIzbe({});
        I.zarejestruj(Z.zrodloIzby);
        const izba = await I.czekajace();
        const poz = (izba.pozycje ?? izba).find?.((x) => x.id === p.id) ?? JSON.stringify(izba).includes(p.id);
        assert.ok(poz, 'propozycja w Izbie');
        assert.deepEqual(await Z.zrodloIzby.decyduj(p.id, 'przyjmij', { powod: '' }), { stan: 'przyjeta' });
        assert.deepEqual(await Z.decyduj(p.id, 'przyjmij'), { stan: 'przyjeta', juz: true });
        assert.equal(decyzje.length, 1);
        assert.equal(decyzje[0].zrodlo, 'dystrybucja');
        assert.equal((await Z.zrodloIzby.czekajace()).length, 0);
        const q = await (async () => { await Z.stan(); return null; })();
        assert.equal(q, null);
        await assert.rejects(Z.szukaj({ dostawca: 'lokalny' }), /lokalny/);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
