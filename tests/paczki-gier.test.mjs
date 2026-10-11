// 🏝️ Paczki gier — udostępnienie (zip + manifest podpisany ed25519), instalacja w innej Katedrze z kluczem z rejestru,
// podszyty podpis / podmieniona paczka / zła ścieżka odrzucone, limit gości, dławik. Atrapa sieci, prawdziwy dysk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { utworzPaczkiGier, utworzLimitGosci, rozpakujBezpiecznie, spakujKatalog, katalogInstalacji, dlawik, wersjaZDaty } from '../services/PaczkiGier.js';

const para = () => {
    const p = crypto.generateKeyPairSync('ed25519');
    return { pub: p.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), podpisz: async (t) => crypto.sign(null, Buffer.from(t, 'utf8'), p.privateKey).toString('base64') };
};

async function gra(katApek, id) {
    const dist = path.join(katApek, id, 'dist');
    await fs.mkdir(path.join(dist, 'assety'), { recursive: true });
    await fs.writeFile(path.join(dist, 'index.html'), '<!doctype html><div id="gra"></div><script src="./assets/main.js"></script>');
    await fs.mkdir(path.join(dist, 'assets'), { recursive: true });
    await fs.writeFile(path.join(dist, 'assets', 'main.js'), 'console.log("Teterhia");\n'.repeat(200));
    await fs.writeFile(path.join(dist, 'assety', 'kot.glb'), crypto.randomBytes(50_000));
    await fs.writeFile(path.join(katApek, id, 'projekt.json'), JSON.stringify({ nazwa: 'Teterhia — Wieczna Saga' }));
}

/** Zip z jednym wpisem o dowolnej nazwie (do testu złych ścieżek). */
function zipZJednym(nazwa, dane) {
    const n = Buffer.from(nazwa), crc = zlib.crc32(dane);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(dane.length, 18); lh.writeUInt32LE(dane.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(dane.length, 20); ch.writeUInt32LE(dane.length, 24); ch.writeUInt16LE(n.length, 28);
    const cd = lh.length + n.length + dane.length;
    const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(1, 8); e.writeUInt16LE(1, 10); e.writeUInt32LE(46 + n.length, 12); e.writeUInt32LE(cd, 16);
    return Buffer.concat([lh, n, dane, ch, n, e]);
}

test('wersja i katalog instalacji', () => {
    assert.equal(wersjaZDaty(Date.parse('2026-10-11T09:05:00Z')), '2026.10.11.0905');
    assert.equal(katalogInstalacji('teterhia-wieczna-saga', 'teo-mas'), 'teterhia-wieczna-saga-teo-mas');
    assert.throws(() => katalogInstalacji('teterhia-wieczna-saga-i-dlugie-imie-gry', 'bardzo-dlugi-nick'), /za długa/);
});

test('udostępnienie → instalacja u innej Katedry; podszyty podpis i podmieniona paczka odrzucone', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paczki-'));
    try {
        const A = { wymiar: path.join(root, 'a-wymiar'), apki: path.join(root, 'a-apki') };
        const B = { wymiar: path.join(root, 'b-wymiar'), apki: path.join(root, 'b-apki') };
        await gra(A.apki, 'teterhia-wieczna-saga');
        const kluczA = para(), obcy = para();
        const autor = utworzPaczkiGier({ katalog: A.wymiar, katalogApek: A.apki, nick: async () => 'teo-mas', klucz: async () => kluczA.pub, podpisz: kluczA.podpisz, rejestr: 'https://rejestr/api/katedry' });
        await assert.rejects(autor.udostepnij('nie-ma-takiej'), /nie jest zbudowana/);
        const { manifest: m } = await autor.udostepnij('teterhia-wieczna-saga');
        assert.equal(m.autor, 'teo-mas');
        assert.equal(m.nazwa, 'Teterhia — Wieczna Saga');
        assert.equal(m.plikow, 3);
        assert.ok(await autor.udostepniona('teterhia-wieczna-saga'));
        assert.deepEqual((await autor.publiczne()).map((x) => x.id), ['teterhia-wieczna-saga']);
        assert.equal(await autor.plikGoscia('teterhia-wieczna-saga', '../../projekt.json'), null, 'gość nie wyjdzie poza dist');
        assert.ok((await autor.plikGoscia('teterhia-wieczna-saga', 'assety/kot.glb')).endsWith('kot.glb'));
        assert.ok((await autor.plikGoscia('teterhia-wieczna-saga', '')).endsWith('index.html'));
        assert.equal(await autor.manifest('inna'), null);

        const zip = await autor.sciezkaZip('teterhia-wieczna-saga');
        let kluczWRejestrze = kluczA.pub;
        let zipBajty = await fs.readFile(zip);
        const siec = async (url) => {
            if (url === 'https://rejestr/api/katedry') return new Response(JSON.stringify({ katedry: [{ nick: 'teo-mas', adres: 'https://teo.example', klucz: kluczWRejestrze, paczkiGier: await autor.publiczne() }] }));
            if (url === 'https://teo.example/wizytowka/gra/teterhia-wieczna-saga.json') return new Response(JSON.stringify(await autor.manifest('teterhia-wieczna-saga')));
            if (url === 'https://teo.example/wizytowka/gra/teterhia-wieczna-saga.zip') return new Response(Readable.toWeb(Readable.from([zipBajty])));
            return new Response('{}', { status: 404 });
        };
        const kup = utworzPaczkiGier({ katalog: B.wymiar, katalogApek: B.apki, nick: async () => 'wyspa-ola', klucz: async () => obcy.pub, podpisz: obcy.podpisz, rejestr: 'https://rejestr/api/katedry', fetch: siec });

        assert.deepEqual((await kup.wSieci()).map((x) => x.nick), ['teo-mas']);
        const g = await kup.gospodarz('teo-mas');
        assert.equal(g.gra.baza, 'https://teo.example/wizytowka/gra/teterhia-wieczna-saga/');
        assert.equal(g.wlasna, false);

        // podszyty podpis: rejestr zna inny klucz niż ten, którym podpisano manifest
        kluczWRejestrze = obcy.pub;
        await assert.rejects(kup.instaluj({ nick: 'teo-mas', gra: 'teterhia-wieczna-saga' }), /Podpis manifestu nie zgadza się/);
        assert.equal(fsSync.existsSync(path.join(B.apki, 'teterhia-wieczna-saga-teo-mas')), false);
        kluczWRejestrze = kluczA.pub;

        // podmieniona paczka (ten sam rozmiar, inna treść)
        const zepsuty = Buffer.from(zipBajty); zepsuty[200] ^= 0xff; zipBajty = zepsuty;
        await assert.rejects(kup.instaluj({ nick: 'teo-mas', gra: 'teterhia-wieczna-saga' }), /SHA-256/);
        zipBajty = await fs.readFile(zip);

        const w = await kup.instaluj({ nick: 'teo-mas', gra: 'teterhia-wieczna-saga' });
        assert.equal(w.id, 'teterhia-wieczna-saga-teo-mas');
        assert.equal(w.url, '/apki/teterhia-wieczna-saga-teo-mas/');
        const dist = path.join(B.apki, w.id, 'dist');
        assert.deepEqual(await fs.readFile(path.join(dist, 'assety', 'kot.glb')), await fs.readFile(path.join(A.apki, 'teterhia-wieczna-saga', 'dist', 'assety', 'kot.glb')));
        assert.equal((await fs.readFile(path.join(dist, 'assets', 'main.js'), 'utf8')).length, 'console.log("Teterhia");\n'.length * 200);
        assert.equal(JSON.parse(await fs.readFile(path.join(B.apki, w.id, 'zrodlo-paczki.json'), 'utf8')).wersja, m.wersja);
        assert.equal(fsSync.existsSync(path.join(B.wymiar, 'gry-pobrane')) && (await fs.readdir(path.join(B.wymiar, 'gry-pobrane'))).length, 0, 'robocze sprzątnięte');
        // ponowna instalacja nadpisuje tylko zainstalowaną paczkę; zainstalowanej gry nie da się „udostępnić” dalej
        await kup.instaluj({ nick: 'teo-mas', gra: 'teterhia-wieczna-saga' });
        await assert.rejects(kup.udostepnij('teterhia-wieczna-saga-teo-mas'), /nick|cudzej paczki/);

        // katalog z własną pracą o tej nazwie — nie nadpisujemy
        await fs.rm(path.join(B.apki, w.id, 'zrodlo-paczki.json'));
        await assert.rejects(kup.instaluj({ nick: 'teo-mas', gra: 'teterhia-wieczna-saga' }), /nie nadpisuję/);

        await assert.rejects(kup.instaluj({ nick: 'wyspa-ola', gra: 'teterhia-wieczna-saga' }), /Twoja własna gra/);
        await assert.rejects(kup.instaluj({ nick: 'nikt-taki', gra: 'teterhia-wieczna-saga' }), /nie ma teraz w rejestrze/);

        await autor.wycofaj('teterhia-wieczna-saga');
        assert.equal(await autor.sciezkaZip('teterhia-wieczna-saga'), null);
        assert.equal(await autor.plikGoscia('teterhia-wieczna-saga', 'index.html'), null);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('rozpakowanie: ścieżka „..” i brak index.html odrzucone, nic nie zapisane poza katalogiem', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paczki-zip-'));
    try {
        const zly = path.join(root, 'zly.zip');
        await fs.writeFile(zly, zipZJednym('../ucieczka.txt', Buffer.from('x')));
        await assert.rejects(rozpakujBezpiecznie(zly, path.join(root, 'cel')));
        assert.equal(fsSync.existsSync(path.join(root, 'ucieczka.txt')), false);
        const bezIndeksu = path.join(root, 'bez.zip');
        await fs.writeFile(bezIndeksu, zipZJednym('gra.js', Buffer.from('x')));
        await assert.rejects(rozpakujBezpiecznie(bezIndeksu, path.join(root, 'cel2')), /index\.html/);
        // limit rozmiaru po rozpakowaniu
        await fs.mkdir(path.join(root, 'src'));
        await fs.writeFile(path.join(root, 'src', 'index.html'), 'x'.repeat(5000));
        await spakujKatalog(path.join(root, 'src'), path.join(root, 'ok.zip'));
        await assert.rejects(rozpakujBezpiecznie(path.join(root, 'ok.zip'), path.join(root, 'cel3'), { maxBajtow: 1000 }), /przekracza/);
        assert.deepEqual(await rozpakujBezpiecznie(path.join(root, 'ok.zip'), path.join(root, 'cel4')), { plikow: 1 });
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('limit gości: znany przechodzi, nowy ponad limit czeka, po oknie miejsce wraca', () => {
    let t = 0;
    const L = utworzLimitGosci({ max: 2, oknoMs: 1000, teraz: () => t });
    assert.ok(L.wpusc('a')); assert.ok(L.wpusc('b'));
    assert.equal(L.wpusc('c'), false);
    assert.ok(L.wpusc('a'), 'znany gość');
    t = 1500;
    assert.ok(L.wpusc('c'));
    assert.equal(L.aktywni(), 1);
});

test('dławik: 200 kB przy 100 kB/s trwa ≥ 1 s', async () => {
    const t0 = Date.now();
    let ile = 0;
    const kawalki = Array.from({ length: 4 }, () => Buffer.alloc(50_000));
    await new Promise((ok, zle) => Readable.from(kawalki).pipe(dlawik(100_000)).on('data', (b) => { ile += b.length; }).on('end', ok).on('error', zle));
    assert.equal(ile, 200_000);
    assert.ok(Date.now() - t0 >= 900, `za szybko: ${Date.now() - t0} ms`);
});

test('trasy na prawdziwym Expressie za Strażą: gość czyta tylko udostępnioną grę, limit gości, /api/gry tylko maszyna', async () => {
    const { default: express } = await import('express');
    const { strazMostu } = await import('../services/StrazMostu.js');
    const { zamontujTrasyGier } = await import('../services/PaczkiGier.js');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paczki-http-'));
    const k = para();
    await gra(path.join(root, 'apki'), 'teterhia-wieczna-saga');
    await gra(path.join(root, 'apki'), 'tajna-gra');
    const paczki = utworzPaczkiGier({ katalog: path.join(root, 'wymiar'), katalogApek: path.join(root, 'apki'), nick: async () => 'teo-mas', klucz: async () => k.pub, podpisz: k.podpisz, rejestr: 'https://rejestr/api/katedry' });
    const rynek = { products: [] };
    const app = express();
    app.use(express.json());
    app.use(strazMostu({ klucz: () => 'k'.repeat(48) }));
    zamontujTrasyGier(app, { paczki, nick: async () => 'teo-mas', wczytajRynek: async () => rynek, zapiszRynek: async () => {}, limit: utworzLimitGosci({ max: 1 }), bps: 10 * 1024 * 1024 });
    const srv = app.listen(0);
    const adres = `http://127.0.0.1:${srv.address().port}`;
    const zdalnie = (ip = '9.9.9.9', h = {}) => ({ headers: { 'cf-connecting-ip': ip, ...h } });
    try {
        // udostępnienie tylko z maszyny
        assert.equal((await fetch(`${adres}/api/gry/udostepnij`, { method: 'POST', ...zdalnie(), body: '{}' })).status, 401);
        const u = await (await fetch(`${adres}/api/gry/udostepnij`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gra: 'teterhia-wieczna-saga' }) })).json();
        assert.equal(u.success, true, u.message);
        assert.equal(rynek.products.length, 1);
        assert.deepEqual([rynek.products[0].module, rynek.products[0].type, rynek.products[0].priceGrv, rynek.products[0].payload.platnosc], ['teterhia', 'gra', 333, 'reczna']);
        assert.match(rynek.products[0].desc, /etap 4/);
        await fetch(`${adres}/api/gry/udostepnij`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gra: 'teterhia-wieczna-saga', cenaGRV: 100 }) });
        assert.equal(rynek.products.length, 1, 'ponowne udostępnienie odświeża wpis, nie dubluje');
        assert.equal(rynek.products[0].priceGrv, 100);

        const m = await (await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga.json`, zdalnie())).json();
        assert.equal(m.autor, 'teo-mas');
        const zip = Buffer.from(await (await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga.zip`, zdalnie())).arrayBuffer());
        assert.equal(crypto.createHash('sha256').update(zip).digest('hex'), m.sha256);
        assert.equal((await fetch(`${adres}/wizytowka/gra/tajna-gra.json`, zdalnie())).status, 404, 'nieudostępniona gra nie wychodzi');
        assert.equal((await fetch(`${adres}/wizytowka/gra/tajna-gra/index.html`, zdalnie())).status, 404);

        const html = await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga/`, zdalnie());
        assert.equal(html.status, 200);
        assert.match(await html.text(), /id="gra"/);
        const kawalek = await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga/assety/kot.glb`, zdalnie('9.9.9.9', { range: 'bytes=0-19' }));
        assert.equal(kawalek.status, 206);
        assert.equal((await kawalek.arrayBuffer()).byteLength, 20);
        assert.equal((await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga/%2E%2E%2Fprojekt.json`, zdalnie())).status, 404);
        // drugi gość ponad limit 1 → „wyspa pełna”; pierwszy dalej gra
        const pelna = await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga/`, zdalnie('8.8.8.8'));
        assert.equal(pelna.status, 503);
        assert.match(await pelna.text(), /Wyspa pełna/);
        assert.equal((await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga/assets/main.js`, zdalnie())).status, 200);
        // gość nie zawoła /api tej Katedry (Mistrz Gry, Kustosz)
        assert.equal((await fetch(`${adres}/api/mistrz-gry/kwestia`, { method: 'POST', ...zdalnie() })).status, 401);

        const lista = await (await fetch(`${adres}/api/gry`)).json();
        assert.equal(lista.gry.find((g) => g.id === 'teterhia-wieczna-saga').udostepniona.produkt, rynek.products[0].id);
        await fetch(`${adres}/api/gry/udostepnij/teterhia-wieczna-saga`, { method: 'DELETE' });
        assert.equal(rynek.products.length, 0, 'wycofanie zdejmuje wpis z Marketplace');
        assert.equal((await fetch(`${adres}/wizytowka/gra/teterhia-wieczna-saga.zip`, zdalnie())).status, 404);
    } finally { srv.close(); await fs.rm(root, { recursive: true, force: true }); }
});
