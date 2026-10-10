// 🌲 Otoczenie: bryła „Do gry” jako otoczenie biomu (wpis w assety.json gry), gałąź „Otoczenie i roślinność” w szablonie,
// elementy z konceptu krainy (kontekst w prompcie Reżysera).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as Assety3D from '../services/Assety3D.js';
import Gdd from '../services/Gdd.js';
import { TETERHIA } from '../services/SzablonyGier.js';

test('Do gry jako otoczenie: biom i wysokość w assety.json; zły biom = błąd wprost', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'otocz-'));
    try {
        const bib = path.join(kat, 'bib'), apki = path.join(kat, 'apki');
        await fs.mkdir(path.join(bib, 'drzewo-ab12'), { recursive: true });
        await fs.mkdir(path.join(apki, 'gra'), { recursive: true });
        await fs.writeFile(path.join(bib, 'drzewo-ab12', 'model.glb'), 'glTF');
        await fs.writeFile(path.join(bib, 'drzewo-ab12', 'meta.json'), JSON.stringify({ id: 'drzewo-ab12', nazwa: 'drzewo', opis: 'drzewo gaju', stan: 'gotowe' }));
        Assety3D.skonfiguruj({ katalogBiblioteki: bib, katalogApek: apki });
        await assert.rejects(Assety3D.doGry('drzewo-ab12', 'gra', { otoczenie: 'las' }), /Otoczenie: jeden z biomów/);
        await Assety3D.doGry('drzewo-ab12', 'gra', { otoczenie: 'gaj', wysokosc: 6 });
        const k = JSON.parse(await fs.readFile(path.join(apki, 'gra', 'public', 'assety', 'assety.json'), 'utf8'));
        assert.deepEqual([k[0].plik, k[0].otoczenie, k[0].wysokosc], ['drzewo.glb', 'gaj', 6]);
        await Assety3D.doGry('drzewo-ab12', 'gra');
        assert.equal(JSON.parse(await fs.readFile(path.join(apki, 'gra', 'public', 'assety', 'assety.json'), 'utf8'))[0].otoczenie, undefined, 'zwykłe „Do gry” bez otoczenia');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('gałąź „Otoczenie i roślinność” (pojedyncze elementy) + propozycje z konceptu krainy', async () => {
    const ot = TETERHIA.gdd.galezie.find((g) => g.id === 'otoczenie');
    assert.ok(ot.propozycje.length >= 5 && ot.propozycje.every((p) => p.styl === 'pojedynczy'));
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'otocz2-'));
    try {
        await fs.mkdir(path.join(kat, 'gra'), { recursive: true });
        let prompt = '';
        Gdd.skonfiguruj({ katalog: kat, model: () => 'atrapa', pisz: async (o) => { prompt = o.prompt; return { tekst: 'pojedynczy | paproć z perłowymi liśćmi, które dzwonią na wietrze' }; } });
        await Gdd.zapisz('gra', { tytul: 'T', galezie: [ot] });
        const nowe = await Gdd.nowePropozycje('gra', 'otoczenie', { kontekst: 'koncept krainy „Pustynia Szeptów”' });
        assert.equal(nowe.length, 1);
        assert.match(prompt, /NA PODSTAWIE: koncept krainy „Pustynia Szeptów”/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
