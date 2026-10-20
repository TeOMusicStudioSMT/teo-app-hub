import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limitKlonu } from '../services/PrzewodyGlosuService.js';

test('⏱️ limit lokalnego klonu rośnie z tekstem (120 s + 0,6 s/znak, ≤ 900 s), zmienna środowiska wygrywa', () => {
    assert.equal(limitKlonu(0, {}), 120_000);
    assert.equal(limitKlonu(600, {}), 480_000);
    assert.equal(limitKlonu(50_000, {}), 900_000);
    assert.equal(limitKlonu(600, { OTAKOS_KLON_LIMIT_S: '45' }), 45_000);
});
