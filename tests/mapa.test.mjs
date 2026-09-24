/** Mapa Katedry — parser importów mostu i spójność mapy na prawdziwym repo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapaImportow, zbudujMape } from '../scripts/rewizor/mapa.mjs';

const KORZEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('mapaImportow: namespace, default i nazwane (z aliasem), tylko services/core/lib', () => {
    const m = mapaImportow([
        "import * as Stado from './services/Stado.js';",
        "import Tost, { a, b as c } from './services/TostService.js';",
        "import express from 'express';",
        "import { x } from './public/x.js';",
    ].join('\n'));
    assert.deepEqual(Object.fromEntries(m), {
        Stado: 'services/Stado.js', Tost: 'services/TostService.js', a: 'services/TostService.js', c: 'services/TostService.js',
    });
});

test('mapa repo: domeny, serwisy i przepływy są spójne', () => {
    const m = zbudujMape(KORZEN);
    assert.ok(m.liczby.trasy > 100 && m.liczby.domeny > 20);
    // Każdy serwis wskazany przez domenę istnieje w spisie serwisów.
    for (const [d, x] of Object.entries(m.domeny)) for (const s of x.serwisy) assert.ok(m.serwisy[s], `${d} → ${s}`);
    // Znany przepływ: Stado stoi za /api/stado, a Hub (lib/stadoSync.ts) jest jej klientem.
    assert.ok(m.domeny.stado.serwisy.includes('services/Stado.js'));
    assert.ok(m.domeny.stado.klienci.includes('lib/stadoSync.ts'));
});
