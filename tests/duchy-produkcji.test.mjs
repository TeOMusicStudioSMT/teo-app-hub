import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as Assety3D from '../services/Assety3D.js';
import { utworzFilmyGry } from '../services/FilmyGry.js';

test('bryła i obraz „trwa” po restarcie mostu → błąd z powodem; gotowe nietknięte', async () => {
    const k = await fs.mkdtemp(path.join(os.tmpdir(), 'duchy-'));
    const bib = path.join(k, 'assety3d'), obr = path.join(k, 'obrazy-gry');
    for (const [dir, id, stan] of [[bib, 'ambona-d968', 'trwa'], [bib, 'kot-1bfd', 'gotowe'], [obr, 'obraz-1', 'trwa']]) {
        await fs.mkdir(path.join(dir, id), { recursive: true });
        await fs.writeFile(path.join(dir, id, 'meta.json'), JSON.stringify({ id, stan, utworzono: '2026-10-11T22:44:02Z' }));
    }
    Assety3D.skonfiguruj({ katalogBiblioteki: bib, katalogObrazow: obr });
    const s = await Assety3D.sprzatnijDuchy();
    assert.deepEqual(s.sort(), ['ambona-d968', 'obraz-1']);
    const m = JSON.parse(await fs.readFile(path.join(bib, 'ambona-d968', 'meta.json'), 'utf8'));
    assert.equal(m.stan, 'blad'); assert.match(m.blad, /most wystartował od nowa/);
    assert.equal(JSON.parse(await fs.readFile(path.join(bib, 'kot-1bfd', 'meta.json'), 'utf8')).stan, 'gotowe');
});

test('film „zlecony” bez pracy → błąd; gotowy nietknięty', async () => {
    const katalogGier = await fs.mkdtemp(path.join(os.tmpdir(), 'gry-'));
    await fs.mkdir(path.join(katalogGier, 'teterhia'));
    const dysk = { teterhia: { filmy: [{ id: 'fm-972786', stan: 'zlecony' }, { id: 'fm-12ad4d', stan: 'gotowy' }] } };
    const gdd = { wczytaj: async (p) => structuredClone(dysk[p] ?? null), zapisz: async (p, g) => { dysk[p] = g; } };
    const F = utworzFilmyGry({ katalogGier, gdd, generuj: async () => ({ ok: false }), stan: async () => ({ ok: false }) });
    assert.deepEqual(await F.sprzatnijDuchy(), ['teterhia:fm-972786']);
    assert.equal(dysk.teterhia.filmy[0].stan, 'blad');
    assert.equal(dysk.teterhia.filmy[1].stan, 'gotowy');
});
