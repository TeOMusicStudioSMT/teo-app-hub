// 🎁 Bonus GRV z metki: wystawca (KodyTanca) podpisuje jednorazowy bonus, odbiorca (BonusGrv) sprawdza podpis kluczem z wizytówki.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { utworzKodyTanca, zamontujTrasyKodowTanca } from '../services/KodyTanca.js';
import { odbierzBonus, rozbierzBonus } from '../services/BonusGrv.js';
import { czyWizytowka, SCIEZKA_BONUSU_GRV } from '../services/StrazMostu.js';

const para = crypto.generateKeyPairSync('ed25519');
const klucz = para.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const podpisz = async (t) => crypto.sign(null, Buffer.from(t, 'utf8'), para.privateKey).toString('base64');

async function wystawca({ zlyPodpis = false } = {}) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'bonus-grv-'));
    const K = utworzKodyTanca({ katalog: kat, utwory: async () => [{ plik: 'a.mp3', tytul: 'A' }], bestiariusz: async () => ({ mini: [{ id: 'mini-bor', nazwa: 'Borowik', klucz: 'a:x' }] }), sciezkaNagrania: async (n) => path.join(kat, n) });
    const app = express(); app.use(express.json());
    app.get('/api/wizytowka', (_q, r) => r.json({ nick: 'teo-mas', klucz }));
    zamontujTrasyKodowTanca(app, K, { adresKodow: async () => 'https://qr.teo.center', wystawca: async () => 'teo-mas', podpisz: zlyPodpis ? async () => 'AAAA' : podpisz });
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    // „sieć”: https://qr.teo.center/… → lokalny serwer wystawcy
    const f = (url, o) => fetch(String(url).replace('https://qr.teo.center', baza), o);
    return { K, baza, f, zamknij: () => srv.close() };
}

test('Straż: odbiór bonusu publicznie tylko POST na dokładną ścieżkę', () => {
    assert.ok(SCIEZKA_BONUSU_GRV.test('/wizytowka/grv-bonus/b-0123456789abcdef'));
    assert.ok(czyWizytowka({ method: 'POST', path: '/wizytowka/grv-bonus/b-0123456789abcdef' }));
    assert.ok(!czyWizytowka({ method: 'POST', path: '/wizytowka/grv-bonus/b-0123' }));
    assert.equal(rozbierzBonus(' B-0123456789ABCDEF@QR.teo.center ')?.host, 'qr.teo.center');
    assert.equal(rozbierzBonus('b-0123456789abcdef'), null);
});

test('bonus: widać dopiero po użyciu kodu, odbiór raz, podpis sprawdzony kluczem z wizytówki', async () => {
    const { K, baza, f, zamknij } = await wystawca();
    try {
        const [k] = await K.noweKody({ ile: 1, bonusGrv: 2500 });
        assert.match(k.bonusKod, /^b-[0-9a-f]{16}$/);
        let s = await (await fetch(`${baza}/wizytowka/taniec/${k.kod}/stan`)).json();
        assert.equal(s.kod.bonus, null, 'przed wyborem tancerza bonusu nie widać');
        await assert.rejects(odbierzBonus(`${k.bonusKod}@qr.teo.center`, { fetch: f }), /pick a dancer first/);
        await K.uzyjKodu(k.kod, 'mini-bor');
        s = await (await fetch(`${baza}/wizytowka/taniec/${k.kod}/stan`)).json();
        assert.equal(s.kod.bonus.kod, `${k.bonusKod}@qr.teo.center`); assert.equal(s.kod.bonus.kwota, 2500);
        const b = await odbierzBonus(s.kod.bonus.kod, { fetch: f });
        assert.equal(b.kwota, 2500); assert.equal(b.wystawca, 'teo-mas');
        await assert.rejects(odbierzBonus(s.kod.bonus.kod, { fetch: f }), /already been claimed/);
        s = await (await fetch(`${baza}/wizytowka/taniec/${k.kod}/stan`)).json();
        assert.equal(s.kod.bonus.odebrany, true);
    } finally { zamknij(); }
});

test('podszyty podpis = odmowa (GRV się nie dopisują)', async () => {
    const { K, f, zamknij } = await wystawca({ zlyPodpis: true });
    try {
        const [k] = await K.noweKody({ ile: 1, bonusGrv: 1000 });
        await K.uzyjKodu(k.kod, 'mini-bor');
        await assert.rejects(odbierzBonus(`${k.bonusKod}@qr.teo.center`, { fetch: f }), /Podpis bonusu się nie zgadza/);
    } finally { zamknij(); }
});

test('kod bez bonusu i bonus ponad limit', async () => {
    const { K, zamknij } = await wystawca();
    try {
        const [bez] = await K.noweKody({ ile: 1 });
        assert.equal(bez.bonusKod, undefined);
        const [duzy] = await K.noweKody({ ile: 1, bonusGrv: 10_000_000 });
        assert.equal(duzy.bonusGrv, 100_000);
    } finally { zamknij(); }
});
