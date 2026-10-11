import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planZGdd } from '../services/PlanGry.js';

const DZIEN = 24 * 3600_000;
const teraz = Date.parse('2026-10-11T12:00:00Z');

test('postęp kamieni i zadania wiszące ≥ 3 dni jako oferta wspólnego dokończenia', () => {
    const gdd = { tytul: 'Teterhia — Wieczna Saga', kamienie: [
        { tytul: 'Brama', zadania: [{ stan: 'gotowe' }, { stan: 'gotowe' }] },
        { tytul: 'Mistrz Gry', zadania: [
            { stan: 'gotowe' },
            { stan: 'blad', tresc: 'Mistrz wędruje po krainie', kiedy: new Date(teraz - 4 * DZIEN).toISOString(), uwaga: 'surowy błąd modelu' },
            { stan: 'blad', tresc: 'świeży błąd', kiedy: new Date(teraz - DZIEN).toISOString() },
            { stan: 'czeka', tresc: 'jeszcze nie ruszone' },
        ] },
    ] };
    const p = planZGdd(gdd, { teraz });
    assert.deepEqual(p.kamienie, [{ tytul: 'Brama', gotowe: 2, razem: 2 }, { tytul: 'Mistrz Gry', gotowe: 1, razem: 4 }]);
    assert.equal(p.wisi.length, 1);
    assert.equal(p.wisi[0].zadanie, 'Mistrz wędruje po krainie');
    assert.ok(!('uwaga' in p.wisi[0]), 'uwagi modeli nie wychodzą do sieci');
});

test('GDD bez kamieni = brak pola', () => {
    assert.equal(planZGdd({ tytul: 'x' }), null);
    assert.equal(planZGdd(null), null);
});
