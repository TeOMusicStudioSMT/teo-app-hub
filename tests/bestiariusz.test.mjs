import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { oczyscBestiariusz, losujWyklucie, dropPoStarciu, utworzBestiariusz, nowyBestiariusz } from '../services/Bestiariusz.js';

const surowy = {
    skille: [{ id: 'sk-iskra', nazwa: 'Iskra', dziedzina: 'takt', typ: 'cios', moc: 500 }, { nazwa: 'Wir Wstęg', typ: 'taniec', moc: 30 }],
    mini: [
        { nazwa: 'Kot Tancerz', klucz: 'b:kot.glb', rzadkosc: 'legendarny', dziedzina: 'takt', skille: ['sk-iskra', 'nie-ma'], warianty: [{ nazwa: 'Nocny', odcien: 200, szansa: 20 }], dropy: [{ skill: 'sk-iskra', szansa: 100, odPoziomu: 3 }, { skill: 'zly', szansa: 50 }] },
        { nazwa: 'Kamyk', klucz: '../../etc', rzadkosc: 'cos', dziedzina: 'xx' },
    ],
};

test('czyszczenie: granice, odwołania tylko do istniejących, nowe id z nazw', () => {
    const b = oczyscBestiariusz(surowy);
    assert.equal(b.rzadkosci.length, 5);
    assert.equal(b.skille[0].moc, 100);
    assert.equal(b.skille[1].id, 'sk-wir-wsteg');
    const [kot, kamyk] = b.mini;
    assert.deepEqual(kot.skille, ['sk-iskra']);
    assert.equal(kot.warianty[0].odcien, 180);
    assert.equal(kot.dropy.length, 1);
    assert.equal(kamyk.klucz, null); assert.equal(kamyk.rzadkosc, 'pospolity'); assert.equal(kamyk.dziedzina, 'takt');
});

test('losowanie: rzadkości bez Mini pomijane, rozkład idzie za szansami, wariant albo bazowy', () => {
    const b = oczyscBestiariusz(surowy);
    let i = 0; const seq = [0.0, 0.0, 0.99];   // pierwsza rzadkość z Mini, pierwszy Mini, ostatni koszyk = bazowy
    const w = losujWyklucie(b, () => seq[i++ % seq.length]);
    assert.ok(['pospolity', 'legendarny'].includes(w.rzadkosc.id));
    const licz = {};
    for (let n = 0; n < 4000; n++) { const x = losujWyklucie(b); licz[x.rzadkosc.id] = (licz[x.rzadkosc.id] ?? 0) + 1; }
    // pospolity 55 vs legendarny 4 → ~93% / 7%
    assert.ok(licz.pospolity > licz.legendarny * 8, JSON.stringify(licz));
    assert.equal(losujWyklucie(nowyBestiariusz()), null);
});

test('drop od poziomu i bez dubli', () => {
    const b = oczyscBestiariusz(surowy);
    const kot = b.mini[0];
    assert.deepEqual(dropPoStarciu(b, kot, 2, [], () => 0), []);
    assert.deepEqual(dropPoStarciu(b, kot, 3, [], () => 0).map((s) => s.id), ['sk-iskra']);
    assert.deepEqual(dropPoStarciu(b, kot, 5, ['sk-iskra'], () => 0), []);
});

test('zapis do public/ i dist/ gry, odczyt czyści', async () => {
    const k = await fs.mkdtemp(path.join(os.tmpdir(), 'bestia-'));
    await fs.mkdir(path.join(k, 'teterhia', 'dist'), { recursive: true });
    const B = utworzBestiariusz({ katalogGier: k });
    await B.zapisz('teterhia', surowy);
    assert.equal(JSON.parse(await fs.readFile(path.join(k, 'teterhia', 'dist', 'bestiariusz.json'), 'utf8')).mini.length, 2);
    assert.equal((await B.wczytaj('teterhia')).mini[0].nazwa, 'Kot Tancerz');
    await assert.rejects(B.zapisz('nie-ma-gry', {}), /Nie ma gry/);
    await assert.rejects(B.wczytaj('../x'), /Zły projekt/);
});
