// 🎪 Znak programu w tytułach produkcji tanecznych — dokleja kod, nie model (PublikacjeYouTube.zPrefiksemTanca).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzPublikacje, czyTaneczna, zPrefiksemTanca, PREFIKS_TANCA } from '../services/PublikacjeYouTube.js';

test('prefiks na początku, bez dubla „TeO Game Show”, ≤ 100 znaków', () => {
    assert.equal(zPrefiksemTanca('Tribal Rhythm with Nu'), `${PREFIKS_TANCA} Tribal Rhythm with Nu`);
    assert.equal(zPrefiksemTanca('TeO Game Show: Nu wins'), `${PREFIKS_TANCA} Nu wins`);
    assert.equal(zPrefiksemTanca(`${PREFIKS_TANCA} Nu`), `${PREFIKS_TANCA} Nu`);
    assert.ok(zPrefiksemTanca('x'.repeat(200)).length <= 100);
});

test('które produkcje są taneczne', () => {
    assert.ok(czyTaneczna('m/gameshow_Nu_en_1.mp4', { projekt: 'teo-game-show' }));
    assert.ok(czyTaneczna('m/wieczor_Nu_en_1.mp4', { projekt: 'wieczor-tanca' }));
    assert.ok(czyTaneczna('m/zebrra_taniec_Nu_en_1.mp4', { projekt: 'zebrra-sports', taniec: 'z-1' }));
    assert.ok(czyTaneczna('m/mameleon_x.mp4', { projekt: 'mame-leon-show', wieczorTanca: 'w-1' }));
    assert.ok(czyTaneczna('f/gameshow_Nu_en_1_caly_rozmyte_k.mp4', { projekt: 'teo-game-show', format: 'shorts' }));
    assert.ok(!czyTaneczna('m/mameleon_y.mp4', { projekt: 'mame-leon-show', mameLeon: 'm-1' }));
    assert.ok(!czyTaneczna('m/gol_a-b_zebra_en_1.mp4', { projekt: 'gol-dnia' }));
});

test('Kronikarz bez prefiksu → publikacja taneczna dostaje go od kodu, inna nie', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prefiks-'));
    const film = (n) => { const p = path.join(dir, n); return fs.writeFile(p, 'x').then(() => p); };
    const P = utworzPublikacje({ katalog: dir, teraz: () => Date.now(), pisz: async () => ({ tekst: 'TYTUŁ: Nu dances\nOPIS: Opis otakos.wtf\nTAGI: a, b', silnik: 'atrapa' }),
        kanaly: async () => ({ domyslny: null, kanaly: [] }) });
    const t = await P.przygotuj({ plik: await film('gameshow_Nu_en_1.mp4'), nazwa: 'x', zrodlo: { projekt: 'teo-game-show' } });
    assert.equal(t.tytul, `${PREFIKS_TANCA} Nu dances`);
    const g = await P.przygotuj({ plik: await film('gol_a-b_en_1.mp4'), nazwa: 'y', zrodlo: { projekt: 'gol-dnia' } });
    assert.equal(g.tytul, 'Nu dances');
});
