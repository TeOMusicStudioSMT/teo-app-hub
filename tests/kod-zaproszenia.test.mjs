// 🗝️ Kod zaproszenia przy pierwszym wejściu: słowo = hasło Filarów (jawne z założenia), normalizacja wpisu,
// 12 345 GRV, raz na księgę.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sprawdzKod, kodDoUzycia, normalizujKod } from '../services/KodZaproszenia.js';
import { HASLO_FILARA } from '../services/Rangi.js';

test('kod = hasło Filarów: wielkość liter, spacje i ogonki bez znaczenia → 12 345 GRV; zły i pusty = null', () => {
    const slowo = HASLO_FILARA.toLowerCase();
    for (const k of [HASLO_FILARA, slowo, `  ${slowo} `, slowo.split('').join(' ')]) assert.deepEqual(sprawdzKod(k), { id: 'zaproszenie-filarow', grv: 12_345 }, k);
    assert.equal(sprawdzKod(HASLO_FILARA.slice(1)), null);
    assert.equal(sprawdzKod(''), null);
    assert.equal(sprawdzKod(null), null);
    assert.equal(normalizujKod(' a ó b '), 'AOB');
});

test('kod: raz na księgę — drugi węzeł dostaje powód z nazwą tego, który go użył', () => {
    assert.equal(kodDoUzycia(HASLO_FILARA, {}).ok, true);
    const r = kodDoUzycia(HASLO_FILARA, { 'zaproszenie-filarow': 'Iskra' });
    assert.equal(r.ok, false); assert.match(r.powod, /już użyty.*Iskra/);
    assert.match(kodDoUzycia('xyz').powod, /Nieprawidłowy/);
});
