// 💃🥊 Ring taneczny — pokój w pamięci: otwarcie, dołączenie rywala, odliczanie → walka, ruchy {takt, skill} tylko
// powyżej horyzontu, karta przycięta do granic Bestiariusza, trzeci gracz odbity, wygasanie; trasy za Strażą.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cors from 'cors';
import { utworzRing, oczyscKarte, zamontujTrasyRingu, ZYWOTNOSC_MS, ODLICZANIE_MS, MAX_POKOI } from '../services/RingTaneczny.js';

const karta = (o = {}) => ({ id: 'mini-a', nazwa: 'Mszak', rzadkosc: 'pospolity', poziom: 3, mnoznik: 1, skille: [{ id: 'sk-a', nazwa: 'Bęben', typ: 'cios', moc: 13, dziedzina: 'takt' }], ...o });

test('ring: otwarcie, dołączenie, odliczanie → walka, ruchy i horyzont, trzeci gracz odbity', () => {
    let t = 10_000;
    const R = utworzRing({ teraz: () => t, losuj: () => 0.5 });
    const p = R.otworz({ gracz: 'aaaaaaaa', karta: karta(), bpm: 999 });
    assert.equal(p.stan, 'czeka');
    assert.equal(p.bpm, 160, 'tempo przycięte');
    assert.equal(R.lista().length, 1);
    t += 200;
    const b = R.melduj(p.id, '2.2.2.2', { gracz: 'bbbbbbbb', karta: karta({ nazwa: 'Eterek', skille: [{ id: 'sk-b', nazwa: 'Oko', typ: 'specjalny', moc: 999 }] }) });
    assert.equal(b.pokoj.stan, 'odliczanie');
    assert.equal(b.pokoj.start, t + ODLICZANIE_MS);
    assert.equal(b.pokoj.ja, 1);
    assert.equal(b.pokoj.gracze[1].karta.skille[0].moc, 100, 'moc przycięta do granic Bestiariusza');
    assert.equal(R.melduj(p.id, '3.3.3.3', { gracz: 'cccccccc', karta: karta() }).pelny, true);
    t += ODLICZANIE_MS;
    const a = R.melduj(p.id, 'maszyna', { gracz: 'aaaaaaaa', ruchy: [{ takt: 5, skill: 'sk-a' }, { takt: 5, skill: 'sk-a' }, { takt: -3, skill: 'sk-a' }], horyzont: 6 });
    assert.equal(a.pokoj.stan, 'walka');
    assert.deepEqual(a.pokoj.gracze[0].ruchy, [{ takt: 5, skill: 'sk-a' }]);
    assert.equal(a.pokoj.gracze[0].horyzont, 6);
    t += 200;
    // ruch wstecz (poniżej horyzontu) nie wchodzi — ta strona już obiecała, że do taktu 6 nic więcej nie ma
    const a2 = R.melduj(p.id, 'maszyna', { gracz: 'aaaaaaaa', ruchy: [{ takt: 4, skill: 'sk-a' }, { takt: 9, skill: 'sk-a' }], horyzont: 3 });
    assert.deepEqual(a2.pokoj.gracze[0].ruchy.map((r) => r.takt), [5, 9]);
    assert.equal(a2.pokoj.gracze[0].horyzont, 6, 'horyzont nie cofa się');
    assert.throws(() => R.melduj(p.id, '9.9.9.9', { gracz: 'aaaaaaaa' }), /innego adresu/);
    t += 200;
    R.melduj(p.id, 'maszyna', { gracz: 'aaaaaaaa', wynik: { zwyciezca: 0, rundy: '2:1' } });
    t += 200;
    assert.equal(R.melduj(p.id, '2.2.2.2', { gracz: 'bbbbbbbb', wynik: { zwyciezca: 0, rundy: '2:1' } }).pokoj.stan, 'koniec');
});

test('ring: karta bez nazwy/skilli odrzucona, model tylko jako plik, limit pokoi, wygasanie', () => {
    assert.throws(() => oczyscKarte({ nazwa: '', skille: [{}] }), /bez nazwy/);
    assert.throws(() => oczyscKarte({ nazwa: 'X', skille: [] }), /bez skilli/);
    const k = oczyscKarte(karta({ model: 'https://zly.example/x.glb', katedra: 'teo-mas', poziom: 99, skille: Array(9).fill({ id: 'sk-a', typ: 'zly', moc: 0 }) }));
    assert.deepEqual([k.model, k.katedra, k.poziom, k.skille.length, k.skille[0].typ, k.skille[0].moc], [null, 'teo-mas', 20, 4, 'cios', 1]);
    assert.equal(oczyscKarte(karta({ model: 'mini-teogochi-mszak.glb' })).model, 'mini-teogochi-mszak.glb');
    let t = 0;
    const R = utworzRing({ teraz: () => t });
    for (let i = 0; i < MAX_POKOI; i++) R.otworz({ gracz: `gospodarz${i}`, karta: karta() });
    assert.throws(() => R.otworz({ gracz: 'nadmiarowy', karta: karta() }), /pokoi/);
    t += ZYWOTNOSC_MS + 1;
    assert.equal(R.lista().length, 0, 'cisza gospodarza zamyka pokój');
});

test('trasy ringu za Strażą: lista i meldunek publicznie, otwarcie tylko z maszyny, inne POST zamknięte', async () => {
    const { default: express } = await import('express');
    const { strazMostu } = await import('../services/StrazMostu.js');
    const app = express();
    app.use(express.json());
    app.use(strazMostu({ klucz: () => 'k'.repeat(48) }));
    zamontujTrasyRingu(app, { cors });
    const srv = app.listen(0);
    const adres = `http://127.0.0.1:${srv.address().port}`;
    const post = (sciezka, cialo, ip) => fetch(`${adres}${sciezka}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip, origin: 'https://inna.example' } : {}) }, body: JSON.stringify(cialo) });
    try {
        assert.equal((await post('/wizytowka/ring', { gracz: 'zzzzzzzz', karta: karta() }, '7.7.7.7')).status, 403, 'gość nie otwiera pokoju');
        const p = (await (await post('/wizytowka/ring', { gracz: 'aaaaaaaa', karta: karta(), bpm: 120 })).json()).pokoj;
        assert.match(p.id, /^r-[a-z0-9]{6,16}$/);
        const lista = await (await fetch(`${adres}/wizytowka/ring`, { headers: { 'cf-connecting-ip': '7.7.7.7', origin: 'https://inna.example' } })).json();
        assert.equal(lista.pokoje[0].gospodarz.nazwa, 'Mszak');
        const r = await post(`/wizytowka/ring/${p.id}`, { gracz: 'bbbbbbbb', karta: karta({ nazwa: 'Gość' }) }, '7.7.7.7');
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('access-control-allow-origin'), '*');
        assert.equal((await r.json()).pokoj.stan, 'odliczanie');
        assert.equal((await post('/wizytowka/ring/r-nieistnieje', { gracz: 'bbbbbbbb' }, '7.7.7.7')).status, 404);
        assert.equal((await post(`/wizytowka/ring/${p.id}`, { gracz: 'bbbbbbbb', smiec: 'x'.repeat(13_000) }, '7.7.7.7')).status, 413);
        assert.equal((await post(`/wizytowka/ring/${p.id}/inne`, {}, '7.7.7.7')).status, 401, 'inne ścieżki dalej za kluczem');
        assert.equal((await (await post(`/wizytowka/ring/${p.id}/wyjdz`, { gracz: 'bbbbbbbb' }, '7.7.7.7')).json()).wyszedl, true);
    } finally { srv.close(); }
});

test('katedryDoRingu: rejestr przez most — tylko nick, adres https, czy udostępnia grę', async () => {
    const { katedryDoRingu } = await import('../services/RingTaneczny.js');
    const pobierz = async () => ({ ok: true, json: async () => ({ katedry: [
        { nick: 'teo-mas', adres: 'https://katedra.otakos.wtf/', paczkiGier: [{ id: 'teterhia-wieczna-saga' }], klucz: 'X' },
        { nick: 'inna', adres: 'http://nie-https.example' },
        { nick: 'ZŁY NICK', adres: 'https://x.example' },
        { nick: 'druga', adres: 'https://druga.example' },
    ] }) });
    const w = await katedryDoRingu({ pobierz, nick: async () => 'druga' });
    assert.equal(w.ja, 'druga');
    assert.deepEqual(w.katedry, [{ nick: 'teo-mas', adres: 'https://katedra.otakos.wtf', gra: true }, { nick: 'druga', adres: 'https://druga.example', gra: false }]);
    await assert.rejects(katedryDoRingu({ pobierz: async () => ({ ok: false, status: 503 }) }), /milczy/);
});
