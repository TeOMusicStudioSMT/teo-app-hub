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
import { utworzWydaniaBoxow, zamontujTrasyWydanBoxow, PLIK_CANVAS, PLIKI_PERGAMINU } from '../services/WydaniaBoxow.js';

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
        const rendycje = await fs.readdir(path.join(wydania, 'boxy', 'proba'));
        assert.equal(rendycje.length, 1); assert.match(rendycje[0], /^[0-9a-f]{16}\.mp3$/, 'rendycja nazwana od pliku źródłowego, nie od numeru');

        // czego nie ma
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/nie-ma-takiego`)).status, 404);
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/proba/9.mp3`)).status, 404);

        // przygotowanie całego Boxu z Huba
        const p = await (await fetch(`${b}/api/jukebox/boxy/proba/przygotuj`, { method: 'POST' })).json();
        assert.equal(p.zrobione, 2);
        assert.equal((await (await fetch(`${b}/wizytowka/jukebox/boxy`)).json()).boxy[0].gotowych, 2);
    } finally { srv.close(); await fs.rm(muzyka, { recursive: true, force: true }); await fs.rm(wydania, { recursive: true, force: true }); }
});

test('kolejność albumu i pomijanie dubli — rendycja przeżywa przestawienie', async () => {
    const { muzyka, wydania } = await album();
    const kat = path.join(muzyka, 'proba-albumu');
    await fs.copyFile(path.join(kat, '1. Pierwsza (Orion SMT).wav'), path.join(kat, '1. Pierwsza (Orion SMT)1.wav'));   // dubel jak „Connect 1”
    const B = utworzBoxy({ katalogMuzyki: muzyka, katalogWydan: wydania, ffmpeg: ffmpegPath, uruchom });
    const zapisz = (b) => fs.writeFile(path.join(wydania, 'boxy.json'), JSON.stringify({ boxy: [{ id: 'proba', nazwa: 'Próba', katalog: 'proba-albumu', ...b }] }));
    try {
        await zapisz({});
        assert.equal((await B.utworyPubliczne('proba')).utwory.length, 3, 'bez mapy widać też dubel');

        // dubel zdjęty, kolejność odwrócona względem alfabetu
        await zapisz({ pomin: ['1. Pierwsza (Orion SMT)1.wav'], kolejnosc: ['druga.wav', '1. Pierwsza (Orion SMT).wav'] });
        const u = (await B.utworyPubliczne('proba')).utwory;
        assert.equal(u.length, 2, 'dubel zniknął');
        assert.deepEqual(u.map((x) => x.tytul), ['druga', 'Pierwsza'], 'kolejność z mapy, nie z alfabetu');
        assert.deepEqual(u.map((x) => x.nr), [1, 2]);

        // rendycja robiona dla utworu nr 1 zostaje tym samym plikiem po przestawieniu kolejności
        await B.plikUtworu('proba', 1);
        const po = await fs.readdir(path.join(wydania, 'boxy', 'proba'));
        await zapisz({ pomin: ['1. Pierwsza (Orion SMT)1.wav'], kolejnosc: ['1. Pierwsza (Orion SMT).wav', 'druga.wav'] });
        assert.deepEqual(await fs.readdir(path.join(wydania, 'boxy', 'proba')), po, 'przestawienie nie unieważnia rendycji');
        assert.equal((await B.spis())[0].gotowych, 1, 'ta sama rendycja dalej się liczy — teraz dla nr 2');
    } finally { await fs.rm(muzyka, { recursive: true, force: true }); await fs.rm(wydania, { recursive: true, force: true }); }
});

test('Straż: Boxy publiczne tylko do odczytu', () => {
    for (const p of ['/wizytowka/jukebox/boxy']) assert.ok(SCIEZKA_JUKEBOX.test(p), p);
    for (const p of ['/wizytowka/jukebox/box/box-02-solar-pulse', '/wizytowka/jukebox/box/box-03-hidengirl/7.mp3',
        '/wizytowka/jukebox/box/box-02-solar-pulse/wydania', '/wizytowka/jukebox/box/box-03-hidengirl/7/canvas.mp4',
        '/wizytowka/jukebox/box/box-03-hidengirl/7/pergamin.svg', '/wizytowka/jukebox/box/box-03-hidengirl/14/pergamin.pdf',
        '/wizytowka/jukebox/box/box-02-solar-pulse/1/pergamin.png']) assert.ok(SCIEZKA_BOXU.test(p), p);
    for (const p of ['/wizytowka/jukebox/box/../../api', '/wizytowka/jukebox/box/BOX/1.mp3', '/wizytowka/jukebox/box/proba/1.wav', '/api/jukebox/boxy',
        '/wizytowka/jukebox/box/proba/1/canvas.mp3', '/wizytowka/jukebox/box/proba/1/pergamin.exe', '/wizytowka/jukebox/box/proba/1/../../api',
        '/wizytowka/jukebox/box/proba/wydania/1', '/wizytowka/jukebox/box/proba/1/canvas.mp4/x']) assert.ok(!SCIEZKA_BOXU.test(p), p);
});

// 🛡️ Zmierzona długość musi zgadzać się z plikiem. Na żywo (2026-11-20) Box 02 „Solar Puso” miał zapisane
// 201,4 s przy utworze 358,5 s — pergamin wyszedł na 56% długości, a Canvas wybrał „kulminację” z pierwszej połowy.
test('tempo Boxu: długość niezgodna z plikiem odrzucona', async () => {
    const { muzyka, wydania } = await album();
    await fs.writeFile(path.join(wydania, 'boxy.json'), JSON.stringify({ boxy: [{ id: 'proba', nazwa: 'Próba', katalog: 'proba-albumu' }] }));
    const B = utworzBoxy({ katalogMuzyki: muzyka, katalogWydan: wydania, ffmpeg: ffmpegPath, uruchom });
    const W = utworzWydaniaBoxow({ boxy: B, katalogWydan: path.join(wydania, 'paczki'), ffmpeg: ffmpegPath, uruchom });
    try {
        // utwory w atrapie albumu mają 1 s
        await assert.rejects(() => W.ustawTempo('proba', 1, { bpm: 128, sekundy: 201.4 }), /nie zgadza się z plikiem/);
        const ok = await W.ustawTempo('proba', 1, { bpm: 128, sekundy: 1.4 });
        assert.equal(ok.bpm, 128);
        assert.equal((await W.stan('proba')).utwory[0].sekundy, 1.4, 'zgodna długość przechodzi (tolerancja 2 s)');
    } finally { await fs.rm(muzyka, { recursive: true, force: true }); await fs.rm(wydania, { recursive: true, force: true }); }
});

// 🌍 Paczka wydawnicza utworu w portalu: Canvas i pergamin są publiczne (i tak jadą na Spotify i do druku),
// a sterowanie zostaje pod `/api/jukebox`. Pokazujemy TYLKO to, co naprawdę leży na dysku.
test('paczka Boxu dla świata: spis, pliki i to, czego nie ma', async () => {
    const { muzyka, wydania } = await album();
    await fs.writeFile(path.join(wydania, 'boxy.json'), JSON.stringify({ boxy: [{ id: 'proba', nazwa: 'Próba', katalog: 'proba-albumu', artysci: 'TeO' }] }));
    const B = utworzBoxy({ katalogMuzyki: muzyka, katalogWydan: wydania, ffmpeg: ffmpegPath, uruchom });
    const katWydan = path.join(wydania, 'paczki');
    const W = utworzWydaniaBoxow({ boxy: B, katalogWydan: katWydan, ffmpeg: ffmpegPath, uruchom });
    const app = express(); zamontujTrasyBoxow(app, B); zamontujTrasyWydanBoxow(app, W);
    const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const b = `http://127.0.0.1:${srv.address().port}`;
    try {
        // utwór nr 1 dostaje Canvas i pergamin (SVG + PDF), utwór nr 2 — nic
        const { utwory } = await B.utworyZOdciskiem('proba');
        const kat = path.join(katWydan, 'proba', 'wydania', utwory[0].odcisk);
        await fs.mkdir(kat, { recursive: true });
        await fs.writeFile(path.join(kat, PLIK_CANVAS), 'udaje-mp4');
        await fs.writeFile(path.join(kat, PLIKI_PERGAMINU.svg), '<svg xmlns="http://www.w3.org/2000/svg"/>');
        await fs.writeFile(path.join(kat, PLIKI_PERGAMINU.pdf), '%PDF-1.4 udaje');
        await fs.writeFile(`${kat}.json`, JSON.stringify({ bpm: 128, sekundy: 42, canvas: { wariant: 'fuzja', od: 30, wersja: 2 }, pergamin: { szer: 9278, wys: 1200 } }));

        const d = await (await fetch(`${b}/wizytowka/jukebox/box/proba/wydania`)).json();
        assert.equal(d.success, true); assert.equal(d.utwory.length, 2);
        assert.equal(d.utwory[0].bpm, 128); assert.equal(d.utwory[0].sekundy, 42);
        assert.equal(d.utwory[0].canvas.url, '/wizytowka/jukebox/box/proba/1/canvas.mp4?v=2');
        assert.equal(d.utwory[0].canvas.wariant, 'fuzja'); assert.equal(d.utwory[0].canvas.od, 30);
        assert.equal(d.utwory[0].pergamin.svg, '/wizytowka/jukebox/box/proba/1/pergamin.svg?v=1');
        assert.equal(d.utwory[0].pergamin.pdf, '/wizytowka/jukebox/box/proba/1/pergamin.pdf?v=1');
        assert.equal(d.utwory[0].pergamin.png, undefined, 'PNG-a nie ma na dysku — nie obiecujemy go');
        assert.equal(d.utwory[1].canvas, null); assert.equal(d.utwory[1].pergamin, null);
        assert.ok(!JSON.stringify(d).includes(muzyka) && !JSON.stringify(d).includes(katWydan), 'ścieżki z dysku nie wychodzą');

        const c = await fetch(`${b}/wizytowka/jukebox/box/proba/1/canvas.mp4`);
        assert.equal(c.status, 200); assert.equal(c.headers.get('content-type'), 'video/mp4');
        assert.equal(c.headers.get('access-control-allow-origin'), '*', 'portal na innej domenie musi to przeczytać');
        assert.equal(await c.text(), 'udaje-mp4');
        assert.match((await fetch(`${b}/wizytowka/jukebox/box/proba/1/pergamin.svg`)).headers.get('content-type'), /image\/svg/);

        // czego nie ma i czego nie wolno
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/proba/2/canvas.mp4`)).status, 404, 'utwór bez Canvasu');
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/proba/1/pergamin.png`)).status, 404);
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/proba/1/pergamin.exe`)).status, 404);
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/nie-ma/wydania`)).status, 404);
        assert.equal((await fetch(`${b}/wizytowka/jukebox/box/proba/9/canvas.mp4`)).status, 404);
    } finally { srv.close(); await fs.rm(muzyka, { recursive: true, force: true }); await fs.rm(wydania, { recursive: true, force: true }); }
});
