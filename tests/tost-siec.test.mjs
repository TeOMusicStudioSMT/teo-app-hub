// 💬 TOST między Katedrami: dwie Katedry w jednym procesie, sieć podstawiona (rejestr + tunele).
// Szyfr E2E, podpis kluczem z rejestru, kolejka gdy odbiorca offline, odrzucanie obcych i powtórek.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { utworzTost, trescKoperty } from '../services/TostSiec.js';

function katedra(nick) {
    const para = crypto.generateKeyPairSync('ed25519');
    const klucz = para.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    const k = { nick, klucz, adres: `https://${nick}.trycloudflare.com`, online: true, para };
    k.tost = utworzTost({
        katalog: fs.mkdtempSync(path.join(os.tmpdir(), `tost-${nick}-`)),
        nick: async () => nick,
        kluczEd: async () => klucz,
        podpisz: async (t) => crypto.sign(null, Buffer.from(t), para.privateKey).toString('base64'),
        rejestr: 'https://otakos.test/api/katedry',
        fetch: (...a) => siec(...a),
    });
    return k;
}
const A = katedra('alfa');
const B = katedra('beta');
const wszystkie = [A, B];
const przechwycone = [];
const json = (status, d) => ({ ok: status < 300, status, json: async () => d });
async function siec(url, init = {}) {
    if (url === 'https://otakos.test/api/katedry') return json(200, { katedry: wszystkie.filter((k) => k.online).map(({ nick, adres, klucz }) => ({ nick, adres, klucz, motto: '' })) });
    const k = wszystkie.find((x) => url.startsWith(x.adres));
    if (!k || !k.online) throw new Error('fetch failed');
    if (url.endsWith('/api/wizytowka')) return json(200, { nick: k.nick, klucz: k.klucz, tost: (await k.tost.kluczTost()).publiczny });
    if (url.endsWith('/api/tost/skrzynka')) {
        const koperta = JSON.parse(init.body);
        przechwycone.push(koperta);
        const w = await k.tost.odbierz(koperta);
        return json(w.status, { wiadomosc: w.wiadomosc });
    }
    return json(404, {});
}

test('alfa → beta: dostarczona, w drodze tylko szyfr, beta czyta tekst i ma nieprzeczytaną', async () => {
    const m = await A.tost.wyslij({ do: 'beta', tekst: 'Cześć Beta, tu Alfa ✨' });
    const pelna = (await A.tost.rozmowa('beta')).find((x) => x.id === m.id);
    assert.equal(pelna.stan, 'dostarczona', pelna.blad);
    const koperta = przechwycone.at(-1);
    assert.ok(!JSON.stringify(koperta).includes('Alfa ✨'), 'tekst nie leci jawnie');
    assert.equal((await B.tost.rozmowy())[0].nieprzeczytane, 1);
    const wB = await B.tost.rozmowa('alfa');
    assert.equal(wB[0].tekst, 'Cześć Beta, tu Alfa ✨');
    assert.equal((await B.tost.rozmowy())[0].nieprzeczytane, 0, 'otwarcie rozmowy = przeczytane');
});

test('powtórka tej samej koperty nie dubluje; podmieniony szyfr albo obcy klucz → odrzucone', async () => {
    const k = przechwycone.at(-1);
    assert.equal((await B.tost.odbierz(k)).wiadomosc, 'Już dostarczona.');
    assert.equal((await B.tost.rozmowa('alfa')).length, 1);
    const zly = { ...k, id: crypto.randomUUID(), szyfr: Buffer.from('xx').toString('base64') };
    assert.equal((await B.tost.odbierz(zly)).status, 401, 'zmiana czegokolwiek łamie podpis');
    const obcy = crypto.generateKeyPairSync('ed25519');
    const podszywka = { ...k, id: crypto.randomUUID(), odKlucz: obcy.publicKey.export({ format: 'der', type: 'spki' }).toString('base64') };
    podszywka.podpis = crypto.sign(null, Buffer.from(trescKoperty(podszywka)), obcy.privateKey).toString('base64');
    assert.equal((await B.tost.odbierz(podszywka)).status, 403, 'nick z innym kluczem niż w rejestrze');
    assert.equal((await B.tost.odbierz({ ...k, do: 'gamma' })).status, 400);
});

test('beta offline → wiadomość czeka u alfy, wychodzi sama, gdy beta wraca', async () => {
    B.online = false;
    const m = await A.tost.wyslij({ do: 'beta', tekst: 'Jesteś tam?' });
    let w = (await A.tost.rozmowa('beta')).find((x) => x.id === m.id);
    assert.equal(w.stan, 'czeka');
    assert.equal((await A.tost.rozmowy())[0].czeka, 1);
    B.online = true;
    // lista rejestru jest pamiętana 60 s — ponowienie bierze świeżą po czasie; tu wymuszamy nową listę
    await A.tost.katedryOnline({ swieze: true });
    assert.equal(await A.tost.ponow(), 1);
    w = (await A.tost.rozmowa('beta')).find((x) => x.id === m.id);
    assert.equal(w.stan, 'dostarczona');
    assert.ok((await B.tost.rozmowa('alfa')).some((x) => x.tekst === 'Jesteś tam?'));
});

test('kontakty: Katedry online z rejestru bez siebie samej; walidacja wysyłki', async () => {
    const k = await A.tost.kontakty();
    assert.equal(k.ja, 'alfa');
    assert.deepEqual(k.kontakty.map((x) => x.nick), ['beta']);
    await assert.rejects(A.tost.wyslij({ do: 'alfa', tekst: 'x' }), /własna/);
    await assert.rejects(A.tost.wyslij({ do: 'beta', tekst: '   ' }), /Pusta/);
    await assert.rejects(A.tost.wyslij({ do: 'Zły Nick', tekst: 'x' }), /Zły nick/);
});
