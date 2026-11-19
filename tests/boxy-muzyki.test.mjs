// 📻🎁 Boxy Muzyki: odczyt albumów z dysku, rendycje mp3, Range i Straż. Prawdziwy ffmpeg, atrapa albumu.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { utworzBoxy, zamontujTrasyBoxow, zNazwyPliku } from '../services/BoxyMuzyki.js';
import { SCIEZKA_BOXU, SCIEZKA_JUKEBOX } from '../services/StrazMostu.js';

const uruchom = promisify(execFile);

test('nazwa pliku → numer, tytuł i artysta', () => {
    assert.deepEqual(zNazwyPliku('TeOello - Onyks (Orion SMT) (C).wav', 1), { nr: 1, tytul: 'Onyks', artysta: 'Orion SMT' });
    assert.deepEqual(zNazwyPliku('03. Neon Rain (Kael SMT).mp3', 9), { nr: 3, tytul: 'Neon Rain', artysta: 'Kael SMT' });
    assert.deepEqual(zNazwyPliku('10. Matryca Zero (I AM).wav', 1), { nr: 10, tytul: 'Matryca Zero', artysta: null });
    assert.deepEqual(zNazwyPliku('TeOello - Echa Marjorie (TeOello)l (Elara S.M.T.)(A).wav', 4), { nr: 4, tytul: 'Echa Marjorie l', artysta: 'Elara S.M.T.' });
    assert.equal(zNazwyPliku('Sanctuary.wav', 7).tytul, 'Sanctuary');
});

async function album() {
    const muzyka = await fs.mkdtemp(path.join(os.tmpdir(), 'boxy-muzyka-'));
    const wydania = await fs.mkdtemp(path.join(os.tmpdir(), 'boxy-wydania-'));
    const kat = path.join(muzyka, 'proba-albumu');
    await fs.mkdir(path.join(kat, '2. Druga'), { recursive: true });
    // dwa prawdziwe (krótkie) .wav — żeby ffmpeg miał co przepisać
    for (const [p, sek] of [[path.join(kat, '1. Pierwsza (Orion SMT).wav'), 1], [path.join(kat, '2. Druga', 'druga.wav'), 1]]) {
        await uruchom(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${sek}`, p]);
    }
    await fs.writeFile(path.join(muzyka, 'boxy-nieuzywane.txt'), 'nie audio');
    return { muzyka, wydania, kat };
}

test('Box z dysku: spis, rendycje mp3, Range i brak ścieżek z dysku na zewnątrz', async () => {
    const { muzyka, wydania } = await album();
    const B = utworzBoxy({ katalogMuzyki: muzyka, katalogWydan: wydania, ffmpeg: ffmpegPath, uruchom });
    await fs.writeFile(path.join(wydania, 'boxy.json'), JSON.stringify({ boxy: [{ id: 'proba', nazwa: 'Próba', katalog: 'proba-albumu', artysci: 'TeO' }] }));
    const app = express(); zamontujTrasyBoxow(app, B);
    const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const b = `http://127.0.0.1:${srv.address().port}`;
    try {
        const spis = await (await fetch(`${b}/wizytowka/jukebox/boxy`)).json();
        assert.equal(spis.boxy.length, 1);
        assert.equal(spis.boxy[0].utworow, 2, 'oba utwory znalezione, plik .txt pominięty');
        assert.equal(spis.boxy[0].gotowych, 0, 'rendycji jeszcze nie ma');

        const box = await (await fetch(`${b}/wizytowka/jukebox/box/proba`)).json();
        assert.deepEqual(box.utwory.map((u) => u.nr), [1, 2]);
        assert.equal(box.utwory[0].tytul, 'Pierwsza'); assert.equal(box.utwory[0].artysta, 'Orion SMT');
        assert.equal(box.utwory[1].artysta, 'TeO', 'bez artysty w nazwie — artysta Boxu');
        assert.ok(!JSON.stringify(box).includes(muzyka), 'ścieżki z dysku nie wychodzą na zewnątrz');

        // pierwszy odsłuch robi rendycję mp3 z mastera
        const r = await fetch(`${b}${box.utwory[0].url}`);
        assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'audio/mpeg');
        assert.equal(r.headers.get('accept-ranges'), 'bytes');
        const caly = Buffer.from(await r.arrayBuffer());
        assert.ok(caly.length > 1000, `mp3 ma treść (${caly.length} B)`);
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/boxy`)).json()).boxy[0].gotowych, 1);

        // przewijanie: Range oddaje 206 i dokładnie ten kawałek
        const cz = await fetch(`${b}${box.utwory[0].url}`, { headers: { Range: 'bytes=100-199' } });
        assert.equal(cz.status, 206); assert.equal(cz.headers.get('content-length'), '100');
        assert.match(cz.headers.get('content-range'), new RegExp(`^bytes 100-199/${caly.length}$`));
        assert.deepEqual(Buffer.from(await cz.arrayBuffer()), caly.subarray(100, 200));
        assert.equal((await fetch(`${b}${box.utwory[0].url}`, { headers: { Range: `bytes=${caly.length + 10}-` } })).status, 416);

        // master zostaje nietknięty, rendycja leży w katalogu wydań
        assert.ok(await fs.access(path.join(muzyka, 'proba-albumu', '1. Pierwsza (Orion SMT).wav')).then(() => true, () => false));
        assert.ok(await fs.access(path.join(wydania, 'boxy', 'proba', '01.mp3')).then(() => true, () => false));

        // czego nie ma
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/nie-ma-takiego`)).status, 404);
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/proba/9.mp3`)).status, 404);

        // przygotowanie całego Boxu z Huba
        const p = await (await fetch(`${b}/api/jukebox/boxy/proba/przygotuj`, { method: 'POST' })).json();
        assert.equal(p.zrobione, 2);
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/boxy`)).json()).boxy[0].gotowych, 2);
    } finally { srv.close(); await fs.rm(muzyka, { recursive: true, force: true }); await fs.rm(wydania, { recursive: true, force: true }); }
});

test('Straż: Boxy publiczne tylko do odczytu', () => {
    for (const p of ['/wizytowka/jukebox/boxy']) assert.ok(SCIEZKA_JUKEBOX.test(p), p);
    for (const p of ['/wizytowka/jukebox/box/box-02-solar-pulse', '/wizytowka/jukebox/box/box-03-hidengirl/7.mp3']) assert.ok(SCIEZKA_BOXU.test(p), p);
    for (const p of ['/wizytowka/jukebox/box/../../api', '/wizytowka/jukebox/box/BOX/1.mp3', '/wizytowka/jukebox/box/proba/1.wav', '/api/jukebox/boxy']) assert.ok(!SCIEZKA_BOXU.test(p), p);
});
