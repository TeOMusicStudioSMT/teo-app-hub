// 🎭 Stała Obsada Katedry: aktor z jednego obrazu → karta 6 ujęć (atrapa FLUX, prawdziwy ffmpeg tnie siatkę 3×2) → ✓ → wzory kadru.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import { utworzStalaObsada, zamontujTrasyStalejObsady, promptKarty, promptKadru, filtrKomorki, UJECIA, WZORY_KADRU, SZER_KARTY, WYS_KARTY } from '../services/StalaObsada.js';
import { referencjeObsady } from '../services/FilmyGry.js';
import { SCIEZKI_TYLKO_LOKALNE } from '../services/StrazMostu.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'obsada-'));
const czekaj = async (f) => { for (let i = 0; i < 500 && !(await f()); i++) await new Promise((r) => setTimeout(r, 10)); };
const KOLORY = ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan'];

/** Atrapa FLUX: karta 1536×1024 z sześcioma kolorowymi komórkami (kolejność jak UJECIA). */
function atrapaKadru(kat) {
    const wolania = [];
    const komorki = KOLORY.map((k) => ['-f', 'lavfi', '-i', `color=${k}:s=512x512`]).flat();
    const karta = path.join(kat, 'karta.png');
    execFileSync(ffmpegPath, ['-v', 'error', '-y', ...komorki, '-filter_complex', '[0][1][2]hstack=3[g];[3][4][5]hstack=3[d];[g][d]vstack', '-frames:v', '1', karta]);
    const kadr = path.join(kat, 'kadr.png');
    execFileSync(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=gray:s=320x180', '-frames:v', '1', kadr]);
    return { wolania, kadr: async (o) => { wolania.push(o); return o.szer === SZER_KARTY ? karta : kadr; } };
}

const kolorPiksela = (plik) => [...execFileSync(ffmpegPath, ['-v', 'error', '-i', plik, '-vf', 'crop=1:1:256:256', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])];
const wymiary = (plik) => { const b = fs.readFileSync(plik); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('prompty i siatka są czyste', () => {
    assert.match(promptKarty('rude włosy, zielony płaszcz'), /3 columns and 2 rows.*Character: rude włosy/s);
    assert.equal(filtrKomorki(2, 1), 'crop=trunc(iw/3):trunc(ih/2):trunc(iw/3)*2:trunc(ih/2)*1');
    assert.match(promptKadru({ imie: 'Iskra', opis: '' }, 'na plaży o świcie'), /na plaży o świcie\. The character Iskra/);
    assert.throws(() => promptKadru({ imie: 'Iskra' }, ' '), /Opisz scenę/);
    assert.deepEqual(WZORY_KADRU, ['twarz', 'przod', 'bok']);
});

test('aktor → karta 6 ujęć → ✓ → wzory i kadr z aktorem', async () => {
    const kat = tmp();
    const A = atrapaKadru(kat);
    const zdjecie = path.join(kat, 'foto.jpg');
    execFileSync(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=orange:s=800x1200', '-frames:v', '1', zdjecie]);
    const O = utworzStalaObsada({ katalog: path.join(kat, 'obsada'), kadr: A.kadr, ffmpeg: ffmpegPath });

    await assert.rejects(O.dodaj({ imie: 'Iskra' }), /jeden obraz/);
    const a = await O.dodaj({ imie: 'Iskra', opis: 'rude włosy', sciezka: zdjecie });
    assert.match(a.id, /^a-[0-9a-f]{6}$/);
    assert.ok(fs.existsSync(path.join(kat, 'obsada', a.id, 'zrodlo.png')));
    // przed kartą wzorem jest sam obraz źródłowy; kadr wymaga ✓
    assert.deepEqual((await O.wzory(a.id)).map((p) => path.basename(p)), ['zrodlo.png']);
    await assert.rejects(O.kadrZAktorem(a.id, { scena: 'las' }), /zatwierdzonej karty/);

    await O.rysujKarte(a.id);
    await czekaj(async () => (await O.czytaj(a.id)).stan !== 'rysuje');
    const poKarcie = await O.czytaj(a.id);
    assert.equal(poKarcie.stan, 'do_akceptacji', poKarcie.powod);
    assert.equal(A.wolania[0].referencje[0], path.join(kat, 'obsada', a.id, 'zrodlo.png'));
    // każda komórka trafiła do swojego ujęcia: 512×512 i kolor z siatki
    const RGB = { red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0], magenta: [255, 0, 255], cyan: [0, 255, 255] };
    UJECIA.forEach(([nazwa], i) => {
        const p = path.join(kat, 'obsada', a.id, poKarcie.ujecia[nazwa]);
        assert.deepEqual(wymiary(p), [512, 512], nazwa);
        kolorPiksela(p).forEach((v, k) => assert.ok(Math.abs(v - RGB[KOLORY[i]][k]) < 12, `${nazwa}: ${kolorPiksela(p)} ≠ ${KOLORY[i]}`));
    });

    await O.przyjmij(a.id);
    assert.deepEqual((await O.wzory(a.id)).map((p) => path.basename(p)), ['twarz.png', 'przod.png', 'bok.png']);
    const { plik } = await O.kadrZAktorem(a.id, { scena: 'Iskra na plaży o świcie' });
    assert.match(plik, /^kadry\/[a-z0-9]+\.png$/);
    assert.equal(A.wolania.at(-1).referencje.length, 3);
    assert.match(A.wolania.at(-1).prompt, /Iskra na plaży o świcie/);

    // 🎬 role programów: wzory tylko zatwierdzonego aktora; usunięcie aktora zwalnia jego role
    await assert.rejects(O.przypisz('zla rola', a.id), /program:kto/);
    await O.przypisz('gol-dnia:zebra', a.id);
    await O.przypisz('tancerz:Kot Tancerz', a.id);
    assert.deepEqual((await O.wzoryRoli('gol-dnia:zebra')).map((p) => path.basename(p)), ['twarz.png', 'przod.png', 'bok.png']);
    assert.deepEqual(await O.wzoryRoli('gol-dnia:lew'), []);
    assert.deepEqual(await O.wzoryRoli('nie rola'), []);

    // pliki tylko z katalogu aktora
    await assert.rejects(O.plik(a.id, '../aktor.json'), /Nie ma takiego pliku/);
    assert.ok((await O.plik(a.id, 'ujecia/twarz.png')).endsWith('twarz.png'));
    await O.usun(a.id);
    assert.deepEqual(await O.role(), {});
    assert.deepEqual(await O.wzoryRoli('gol-dnia:zebra'), []);
});

test('duch po restarcie = błąd z powodem; usunięcie do kosza', async () => {
    const kat = tmp();
    const zdjecie = path.join(kat, 'f.png');
    execFileSync(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=white:s=64x64', '-frames:v', '1', zdjecie]);
    const O = utworzStalaObsada({ katalog: path.join(kat, 'o'), kadr: async () => { throw new Error('nie'); }, ffmpeg: ffmpegPath });
    const a = await O.dodaj({ imie: 'Duch', sciezka: zdjecie });
    const p = path.join(kat, 'o', a.id, 'aktor.json');
    fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, 'utf8')), stan: 'rysuje' }));
    await O.sprzatnijDuchy();
    assert.equal((await O.czytaj(a.id)).stan, 'blad');
    await O.usun(a.id);
    assert.equal((await O.lista()).length, 0);
    assert.ok(fs.readdirSync(path.join(kat, 'o', '_kosz')).length === 1);
});

test('referencjeObsady: jeden stały aktor = 3 wzory, kilka postaci = każda swoją twarz', () => {
    const staly = { obraz: 't', referencje: ['t', 'p', 'b'] };
    assert.deepEqual(referencjeObsady([staly]), ['t', 'p', 'b']);
    assert.deepEqual(referencjeObsady([staly, { obraz: 'x' }]), ['t', 'x', 'p']);
    assert.deepEqual(referencjeObsady([{ obraz: 'a' }, { obraz: null }]), ['a']);
});

test('trasy HTTP i Straż: tylko przy maszynie', async () => {
    assert.ok(SCIEZKI_TYLKO_LOKALNE.some((s) => '/api/obsada/a-123456'.startsWith(s)));
    const kat = tmp();
    const app = express();
    app.use(express.json({ limit: '30mb' }));
    zamontujTrasyStalejObsady(app, utworzStalaObsada({ katalog: path.join(kat, 'o'), kadr: atrapaKadru(kat).kadr, ffmpeg: ffmpegPath }));
    const srv = app.listen(0);
    const u = `http://127.0.0.1:${srv.address().port}`;
    try {
        const png = execFileSync(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', 'color=pink:s=32x32', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-']);
        const r = await (await fetch(`${u}/api/obsada`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imie: 'Mira', zdjecie: `data:image/png;base64,${png.toString('base64')}` }) })).json();
        assert.equal(r.success, true, r.message);
        const lista = await (await fetch(`${u}/api/obsada`)).json();
        assert.equal(lista.aktorzy.length, 1);
        assert.equal((await fetch(`${u}/api/obsada/${r.aktor.id}/plik/zrodlo.png`)).status, 200);
        assert.equal((await fetch(`${u}/api/obsada/${r.aktor.id}/plik/aktor.json`)).status, 404);
    } finally { srv.close(); }
});
