// ✂️ Ollama obcina prośbę dłuższą niż połowa num_ctx (zmierzone 0.40.13: num_ctx 4096 → limit 2051, num_ctx 32768 → 16386).
// Kodeks musi brać okno ≥ 2× prośba i trzymać prośbę w budżecie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oknoKontekstu, MAX_PROSBY_ZNAKOW, NUM_CTX_MAX, ZNAKOW_NA_TOKEN } from '../services/AppStudio.js';

test('okno zawsze ≥ 2× prośba (Ollama obcina od połowy) i mieści 8k odpowiedzi', () => {
    for (const znakow of [0, 3000, 20_000, 30_000]) {
        const o = oknoKontekstu(znakow);
        assert.ok(o.numCtx >= 2 * o.tokenow, `${znakow} znaków: okno ${o.numCtx} < 2×${o.tokenow}`);
        assert.ok(o.numCtx >= o.tokenow + 8192, `${znakow} znaków: brak miejsca na odpowiedź`);
        assert.equal(o.numCtx % 2048, 0);
        assert.equal(o.obcieta, false);
    }
});

test('prośba Teterhii sprzed poprawki (~41 tys. tokenów) jest za duża — budżet ją mieści', () => {
    assert.equal(oknoKontekstu(41_317 * ZNAKOW_NA_TOKEN).obcieta, true);
    const o = oknoKontekstu(MAX_PROSBY_ZNAKOW);
    assert.equal(o.obcieta, false);
    assert.equal(o.numCtx, NUM_CTX_MAX);
    assert.equal(NUM_CTX_MAX, 32768, "domyślnie 32k — 64k na 6 GB to 1,35 tok/s");
});
