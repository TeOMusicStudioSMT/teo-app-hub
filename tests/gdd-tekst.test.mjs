import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jakoTekst, LIMIT_GDD_TEKSTU } from '../services/Gdd.js';

test('długie sekcje nie wypychają planu — Reżyser widzi wszystkie kamienie (2026-10-11: widział tylko do 7.)', () => {
    const dlugi = 'x'.repeat(6000);
    const g = { tytul: 'T', silnik: 'three', sekcje: { wizja: dlugi, mechanika: dlugi, fabula: dlugi, postacie: 'krótko' },
        kamienie: Array.from({ length: 12 }, (_, i) => ({ id: `km-${i}`, tytul: `Kamień ${i + 1}`, opis: 'o'.repeat(80), zadania: [{ stan: 'gotowe', tresc: 'z'.repeat(120) }] })) };
    const t = jakoTekst(g, { zId: true });
    assert.ok(t.length <= LIMIT_GDD_TEKSTU);
    assert.match(t, /12\. \(id: km-11\) Kamień 12/);
    assert.match(t, /krótko/, 'krótka sekcja w całości');
    assert.match(t, /\[sekcja skrócona dla modelu\]/);
});
