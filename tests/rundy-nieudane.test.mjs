import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { zapiszRundyNieudane } from '../services/AppStudio.js';

test('zapiszRundyNieudane: każda odrzucona runda z powodem i plikami', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rundy-'));
    const rundy = [
        { runda: 1, powod: 'build: TS2365', pliki: [{ sciezka: 'src/a.ts', tresc: 'export const a = 1;' }] },
        { runda: 2, powod: 'RECENZENT KODU odrzucił — atrapa (Jev) p=0.85', pliki: [{ sciezka: 'src/b.ts', tresc: 'x'.repeat(70_000) }] },
    ];
    assert.equal(await zapiszRundyNieudane(dir, 'zd-1', rundy, { cel: 'Księga', model: 'qwen' }), true);
    const z = JSON.parse(await fs.readFile(path.join(dir, 'nieudane', 'zd-1.rundy.json'), 'utf8'));
    assert.equal(z.rundy.length, 2);
    assert.match(z.rundy[1].powod, /Jev/);
    assert.equal(z.rundy[0].pliki[0].tresc, 'export const a = 1;');
    assert.equal(z.rundy[1].pliki[0].tresc.length, 60_000);
    assert.equal(z.rundy[1].pliki[0].uciete, true);
    assert.equal(await zapiszRundyNieudane(dir, 'zd-2', []), false);
    await fs.rm(dir, { recursive: true, force: true });
});
