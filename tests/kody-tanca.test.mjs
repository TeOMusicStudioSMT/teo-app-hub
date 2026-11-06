import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzKodyTanca, zamontujTrasyKodowTanca, WZOR_KODU } from '../services/KodyTanca.js';
import { czyWizytowka, SCIEZKA_KODU_TANCA } from '../services/StrazMostu.js';

async function srodowisko() {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'kody-tanca-'));
    const montaz = path.join(kat, 'montaz'); await fs.mkdir(montaz);
    const utwory = [{ plik: 'Bazylika/a.mp3', tytul: 'A' }, { plik: 'Bazylika/b.mp3', tytul: 'B' }, { plik: 'c.mp3', tytul: 'C' }];
    const best = { mini: [{ id: 'mini-bor', nazwa: 'Borowik', klucz: 'a:x', utwor: 'c.mp3' }, { id: 'mini-kor', nazwa: 'Koralik', klucz: 'a:y' }, { id: 'mini-bez', nazwa: 'Bez bryły', klucz: null }] };
    let los = 1;
    let zegar = Date.parse('2026-11-06T10:00:00Z');
    const K = utworzKodyTanca({ katalog: path.join(kat, 'kody'), utwory: async () => utwory, bestiariusz: async () => best, sciezkaNagrania: async (n) => path.join(montaz, n), losuj: () => los, teraz: () => zegar });
    return { K, kat, montaz, ustawLos: (n) => { los = n; }, przesun: (ms) => { zegar += ms; } };
}

test('zlecenie Suwerena: bez utworu = „pierwszy raz” tancerza, potem automat bierze i oddaje', async () => {
    const { K, montaz } = await srodowisko();
    const z = await K.zlec({ mini: 'mini-bor' });
    assert.equal(z.utwor.plik, 'c.mp3');
    assert.equal(z.prywatny, false);
    const n = await K.nastepne();
    assert.equal(n.id, z.id); assert.equal(n.stan, 'robi');
    assert.equal(await K.nastepne(), null, 'drugi raz nic — jedno robi');
    await assert.rejects(K.gotowe(z.id, { nagranie: { nazwa: 'taniec_x.mp4' } }), /nie ma w Montażowni/);
    await fs.writeFile(path.join(montaz, 'taniec_x.mp4'), 'film');
    const g = await K.gotowe(z.id, { choreografia: 'c-12345678', nagranie: { nazwa: '../../taniec_x.mp4' } });
    assert.equal(g.stan, 'gotowe'); assert.equal(g.nagranie, 'taniec_x.mp4');
});

test('tancerz bez bryły i spoza Bestiariusza = odmowa', async () => {
    const { K } = await srodowisko();
    await assert.rejects(K.zlec({ mini: 'mini-bez' }), /Bestiariuszu/);
    await assert.rejects(K.zlec({ mini: 'nie-ma' }), /Bestiariuszu/);
    await assert.rejects(K.zlec({ mini: 'mini-kor', utwor: '../x.mp3' }), /nie ma w bibliotece/);
});

test('zawieszone „robi” wraca do kolejki, po 3 próbach = błąd', async () => {
    const { K, przesun } = await srodowisko();
    const z = await K.zlec({ mini: 'mini-kor', utwor: 'Bazylika/a.mp3' });
    for (let i = 0; i < 3; i++) { assert.equal((await K.nastepne())?.id, z.id); przesun(46 * 60_000); }
    assert.equal(await K.nastepne(), null);
    assert.equal((await K.stan()).zlecenia[0].stan, 'blad');
    const p = await K.ponow(z.id); assert.equal(p.stan, 'czeka');
});

test('🎟️ kod: jednorazowy, LOSOWY utwór (nie „pierwszy raz”), prywatne zlecenie, film tylko po nagraniu', async () => {
    const { K, montaz, ustawLos } = await srodowisko();
    const [k] = await K.noweKody({ ile: 1, postac: 'Borowik', produkt: 'Varsity Jacket' });
    assert.match(k.kod, WZOR_KODU);
    const pub = await K.kodPubliczny(k.kod);
    assert.equal(pub.stan, 'wolny');
    assert.deepEqual(pub.tancerze, [{ id: 'mini-bor', nazwa: 'Borowik' }], 'kod tylko dla Borowika');
    await assert.rejects(K.uzyjKodu(k.kod, 'mini-kor'), /different dancer/);
    ustawLos(0);
    const z = await K.uzyjKodu(k.kod, 'mini-bor');
    assert.equal(z.utwor.plik, 'Bazylika/a.mp3', 'losowy z biblioteki, nie utwór startowy');
    assert.equal(z.prywatny, true); assert.equal(z.kod, k.kod);
    await assert.rejects(K.uzyjKodu(k.kod, 'mini-bor'), /already been used/);
    assert.equal((await K.kodPubliczny(k.kod)).stan, 'czeka');
    assert.equal(await K.sciezkaFilmu(k.kod), null);
    await K.nastepne();
    await fs.writeFile(path.join(montaz, 'taniec_k.mp4'), 'prywatny film');
    await K.gotowe(z.id, { nagranie: { nazwa: 'taniec_k.mp4' } });
    const po = await K.kodPubliczny(k.kod);
    assert.equal(po.stan, 'gotowy'); assert.equal(po.film, `/wizytowka/taniec/${k.kod}/film.mp4`);
    assert.equal(await fs.readFile(await K.sciezkaFilmu(k.kod), 'utf8'), 'prywatny film');
    assert.equal(await K.kodPubliczny('t-000000000000'), null);
    assert.equal(await K.kodPubliczny('../stan'), null);
});

test('Straż: strona, stan, film i zużycie kodu publicznie; automat i lista kodów — nie', () => {
    const r = (method, p) => ({ method, path: p });
    assert.ok(czyWizytowka(r('GET', '/wizytowka/taniec/t-0123456789ab')));
    assert.ok(czyWizytowka(r('GET', '/wizytowka/taniec/t-0123456789ab/stan')));
    assert.ok(czyWizytowka(r('GET', '/wizytowka/taniec/t-0123456789ab/film.mp4')));
    assert.ok(czyWizytowka(r('POST', '/wizytowka/taniec/t-0123456789ab')));
    assert.ok(!czyWizytowka(r('POST', '/wizytowka/taniec/t-0123456789ab/stan')));
    assert.ok(!czyWizytowka(r('GET', '/wizytowka/taniec/t-01/../../x')));
    assert.ok(!SCIEZKA_KODU_TANCA.test('/api/taniec/kody'));
    assert.ok(!czyWizytowka(r('GET', '/api/taniec/kody')));
    assert.ok(!czyWizytowka(r('POST', '/api/taniec/automat/nastepne')));
});

test('trasy HTTP: kupujący zużywa kod, drugi raz 409, film 404 do nagrania', async () => {
    const { K } = await srodowisko();
    const app = express(); app.use(express.json());
    zamontujTrasyKodowTanca(app, K, { adresTunelu: async () => 'https://katedra.example', qr: async (u) => `qr:${u}` });
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    try {
        const { kody: [k] } = await (await fetch(`${baza}/api/taniec/kody`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ile: 1 }) })).json();
        const lista = await (await fetch(`${baza}/api/taniec/kody`)).json();
        assert.equal(lista.kody[0].url, `https://katedra.example/wizytowka/taniec/${k.kod}`);
        assert.equal(lista.kody[0].qr, `qr:https://katedra.example/wizytowka/taniec/${k.kod}`);
        const strona = await fetch(`${baza}/wizytowka/taniec/${k.kod}`);
        assert.equal(strona.status, 200); assert.match(await strona.text(), /0\.00G Style/);
        assert.equal((await fetch(`${baza}/wizytowka/taniec/t-ffffffffffff`)).status, 404);
        const u1 = await fetch(`${baza}/wizytowka/taniec/${k.kod}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mini: 'mini-kor' }) });
        assert.equal(u1.status, 200);
        const u2 = await fetch(`${baza}/wizytowka/taniec/${k.kod}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mini: 'mini-kor' }) });
        assert.equal(u2.status, 409);
        assert.equal((await fetch(`${baza}/wizytowka/taniec/${k.kod}/film.mp4`)).status, 404);
        const s = await (await fetch(`${baza}/wizytowka/taniec/${k.kod}/stan`)).json();
        assert.equal(s.kod.tancerz, 'Koralik'); assert.equal(s.kod.stan, 'czeka');
    } finally { srv.close(); }
});

test('stały adres kodów wygrywa z tunelem; tunel wyłączony = adres zostaje, powód mówi prawdę', async () => {
    const { K } = await srodowisko();
    for (const [tunel, oczekiwanyPowod] of [['https://abc.trycloudflare.com', null], [null, /nie odpowie/]]) {
        const app = express(); app.use(express.json());
        zamontujTrasyKodowTanca(app, K, { adresTunelu: async () => tunel, adresKodow: async () => 'https://qr.teo.center' });
        const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
        try {
            await fetch(`${baza}/api/taniec/kody`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ile: 1 }) });
            const l = await (await fetch(`${baza}/api/taniec/kody`)).json();
            assert.match(l.kody[0].url, /^https:\/\/qr\.teo\.center\/wizytowka\/taniec\/t-[0-9a-f]{12}$/);
            assert.equal(l.staly, true);
            if (oczekiwanyPowod) assert.match(l.powod, oczekiwanyPowod); else assert.equal(l.powod, null);
        } finally { srv.close(); }
    }
    const app = express(); app.use(express.json());
    zamontujTrasyKodowTanca(app, K, { adresTunelu: async () => 'https://abc.trycloudflare.com' });
    const srv = app.listen(0);
    try { assert.match((await (await fetch(`http://127.0.0.1:${srv.address().port}/api/taniec/kody`)).json()).powod, /tymczasowy/); } finally { srv.close(); }
});

test('🖨️ znacznik wydruku: tylko wskazane kody, stan kodu bez zmian; lista podaje tancerzy', async () => {
    const { K } = await srodowisko();
    const [a, b] = await K.noweKody({ ile: 2 });
    assert.equal(await K.oznaczWydruk([a.kod, 't-000000000000']), 1);
    const s = await K.stan();
    const ka = s.kody.find((k) => k.kod === a.kod), kb = s.kody.find((k) => k.kod === b.kod);
    assert.ok(ka.wydrukowano); assert.equal(ka.stan, 'wolny'); assert.equal(kb.wydrukowano, undefined);
    const app = express(); app.use(express.json());
    zamontujTrasyKodowTanca(app, K, { adresKodow: async () => 'https://qr.teo.center' });
    const srv = app.listen(0);
    try {
        const l = await (await fetch(`http://127.0.0.1:${srv.address().port}/api/taniec/kody`)).json();
        assert.ok(l.tancerze.some((t) => t.nazwa === 'Koralik')); assert.equal(l.wszystkich, 2);
    } finally { srv.close(); }
});
