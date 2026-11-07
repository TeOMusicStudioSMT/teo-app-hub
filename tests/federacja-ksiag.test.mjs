// 📚🏛️ Federacja Wydawnicza teostory.studio: dwie Katedry (autor + wydawca) na prawdziwym HTTP, prawdziwe klucze ed25519,
// rejestr = atrapa (nick → adres + klucz). Zgłoszenie → weryfikacja → Izba (✓) → katalog wydawcy → aktualizacja → wycofanie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { utworzWypozyczalnie, zamontujTrasyWypozyczalni } from '../services/WypozyczalniaKsiag.js';
import { utworzFederacje, zamontujTrasyFederacji, trescZgloszenia } from '../services/FederacjaKsiag.js';
import { utworzFirme } from '../services/Firma.js';
import { czyWizytowka } from '../services/StrazMostu.js';

const klucze = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return { pub: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), podpisz: async (t) => crypto.sign(null, Buffer.from(t, 'utf8'), privateKey).toString('base64') };
};

async function katedra(nick, { rejestr, mapa, wydawca }) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), `fed-${nick}-`));
    const k = klucze();
    const app = express(); app.use(express.json({ limit: '50mb' }));
    // fetch: https://<nick>.test → http://127.0.0.1:<port> (prawdziwe HTTP, tylko inna nazwa)
    const f = (u, o) => { for (const [https, http] of mapa) if (String(u).startsWith(https)) return fetch(String(u).replace(https, http), o); return fetch(u, o); };
    const W = utworzWypozyczalnie({ katalog: path.join(kat, 'teostory') });
    const F = utworzFederacje({ katalog: path.join(kat, 'teostory'), wypozyczalnia: W, nick: async () => nick, podpisz: k.podpisz, adres: async () => `https://${nick}.test`,
        katedra: async (n) => { const x = rejestr.get(n); if (!x) throw new Error('nie ma'); return x; },
        plikKsiegi: (id) => path.join(kat, 'teostory', 'ksiegi', `${id}.json`), wydawca, fetch: f });
    zamontujTrasyFederacji(app, F);
    zamontujTrasyWypozyczalni(app, W, { federacja: () => F.pozycjePubliczne(), nick: async () => nick });
    const serwer = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
    mapa.set(`https://${nick}.test`, `http://127.0.0.1:${serwer.address().port}`);
    rejestr.set(nick, { nick, adres: `https://${nick}.test`, klucz: k.pub });
    return { W, F, kat, serwer, k };
}

const ksiega = (tytul) => ({ id: 'mk-ksiezyc', title: tytul, author: 'Ola Autorka', sourceType: 'author-manuscript', language: 'pl', pages: [{ narrativeText: 'Był sobie księżyc.', imageUrl: undefined }] });

test('federacja: zgłoszenie podpisane → weryfikacja → ✓ w Izbie → katalog wydawcy → aktualizacja → wycofanie', async (t) => {
    const rejestr = new Map(), mapa = new Map();
    const wyd = await katedra('teo-mas', { rejestr, mapa, wydawca: null });
    const aut = await katedra('ola-ksiazki', { rejestr, mapa, wydawca: 'https://teo-mas.test' });
    t.after(() => { wyd.serwer.close(); aut.serwer.close(); });

    await assert.rejects(aut.F.zglos('mk-ksiezyc'), /Nie ma takiej księgi/);
    await aut.W.publikuj({ book: ksiega('Księżyc nad łąką'), rentalTier: 'rental_48h', cenaEur: 2.5 });
    const z = await aut.F.zglos('mk-ksiezyc');
    assert.equal(z.zgloszenie.stan, 'do_zgody');

    // Izba wydawcy: czeka; w publicznym katalogu jeszcze nic
    const cz = await wyd.F.czekajace();
    assert.equal(cz.length, 1); assert.equal(cz[0].id, 'ola-ksiazki~mk-ksiezyc'); assert.match(cz[0].opis, /Ola Autorka/);
    const port = mapa.get('https://teo-mas.test');
    let kat = await (await fetch(`${port}/wizytowka/teostory`)).json();
    assert.equal(kat.ksiegi.length, 0); assert.equal(kat.wydawca.nick, 'teo-mas');

    await wyd.F.decyduj('ola-ksiazki/mk-ksiezyc', 'przyjmij');
    kat = await (await fetch(`${port}/wizytowka/teostory`)).json();
    assert.equal(kat.ksiegi.length, 1);
    const k = kat.ksiegi[0];
    assert.deepEqual(k.katedra, { nick: 'ola-ksiazki', adres: 'https://ola-ksiazki.test' });
    assert.equal(k.autor, 'Ola Autorka'); assert.equal(k.cenaEur, 2.5); assert.equal(k.narrator, 'Głosek');
    // ?tylko=moje — wydawca nie oddaje cudzych (bez pętli federacji)
    assert.equal((await (await fetch(`${port}/wizytowka/teostory?tylko=moje`)).json()).ksiegi.length, 0);
    // autor widzi, że jest w katalogu wydawcy
    assert.equal((await aut.F.moje()).zgloszenia[0].wKatalogu, true);

    // podszycie: podpis innym kluczem, cena niezgodna z katalogiem autora, nieświeże
    const prawdziwe = await aut.F.zgloszenie('mk-ksiezyc', 'zglos');
    const obcy = klucze();
    await assert.rejects(wyd.F.przyjmijZgloszenie({ ...prawdziwe, podpis: await obcy.podpisz(trescZgloszenia(prawdziwe)) }), (e) => e.kod === 403 && /Podpis/.test(e.message));
    const tanio = { ...prawdziwe, cenaEur: 0.5 }; tanio.podpis = await aut.k.podpisz(trescZgloszenia(tanio));
    await assert.rejects(wyd.F.przyjmijZgloszenie(tanio), /cena różnią się/);
    const stare = { ...prawdziwe, czas: new Date(Date.now() - 2 * 3600e3).toISOString() }; stare.podpis = await aut.k.podpisz(trescZgloszenia(stare));
    await assert.rejects(wyd.F.przyjmijZgloszenie(stare), /nieświeże/);
    await assert.rejects(wyd.F.przyjmijZgloszenie({ ...prawdziwe, nick: 'teo-mas' }), /Twoja Katedra/);

    // aktualizacja ceny u autora → ponowne zgłoszenie: zostaje przyjęta
    await aut.W.publikuj({ book: ksiega('Księżyc nad łąką'), rentalTier: 'rental_48h', cenaEur: 3 });
    assert.equal((await aut.F.zglos('mk-ksiezyc')).zgloszenie.stan, 'przyjeta');
    assert.equal((await wyd.F.pozycjePubliczne())[0].cenaEur, 3);

    // Skarbnik wydawcy: autorstwo pozycji federacji
    const firma = utworzFirme({ katalog: wyd.kat, autorstwoKsiag: () => wyd.F.autorstwo() });
    const s = await firma.skarbnik(2026);
    assert.deepEqual(s.ksiegi.federacja.map((x) => [x.katedra, x.autor, x.stan]), [['ola-ksiazki', 'Ola Autorka', 'przyjeta']]);
    const sa = await utworzFirme({ katalog: aut.kat, autorstwoKsiag: () => aut.F.autorstwo() }).skarbnik(2026);
    assert.deepEqual(sa.ksiegi.wlasne.map((x) => [x.tytul, x.katedra, x.wypozyczen]), [['Księżyc nad łąką', 'ola-ksiazki', 0]]);

    // wycofanie przez autora → znika z katalogu wydawcy
    await aut.F.wycofaj('mk-ksiezyc');
    assert.equal((await (await fetch(`${port}/wizytowka/teostory`)).json()).ksiegi.length, 0);
});

test('Straż: zgłoszenie księgi publiczne tylko jako POST', () => {
    assert.equal(czyWizytowka({ method: 'POST', path: '/wizytowka/teostory/zgloszenie' }), true);
    assert.equal(czyWizytowka({ method: 'GET', path: '/wizytowka/teostory/zgloszenie' }), false);
    assert.equal(czyWizytowka({ method: 'GET', path: '/wizytowka/teostory/mk-ksiezyc/audio/audio-1.mp3' }), true);
});
