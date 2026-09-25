/** Most Stada: parowanie telefonu i zapis stanu pod równoległym ruchem. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// PLIK liczy się z cwd — każdy plik testów to osobny proces, więc chdir nie przecieka do innych testów.
const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'most-stada-'));
process.chdir(katalog);
const MostStada = await import('../services/MostStada.js');

test('równoległe pytania telefonu (świat + strumień) nie wywracają zapisu', async () => {
    const { kod } = await MostStada.zacznijParowanie();
    const { token } = await MostStada.sparuj(kod, 'Pixel');
    const wyniki = await Promise.allSettled(Array.from({ length: 40 }, () => MostStada.sprawdzToken(token)));
    assert.deepEqual(wyniki.filter((w) => w.status === 'rejected').map((w) => w.reason?.message), []);
    assert.ok(wyniki.every((w) => w.value?.nazwa === 'Pixel'));
    assert.deepEqual(fs.readdirSync(path.join(katalog, '_OtakOs_Wymiar')).filter((f) => f.endsWith('.tmp')), []);
    assert.equal(JSON.parse(fs.readFileSync(path.join(katalog, '_OtakOs_Wymiar', 'stado-most.json'), 'utf8')).urzadzenia.length, 1);
});

test('kod parowania działa raz', async () => {
    const { kod } = await MostStada.zacznijParowanie();
    assert.ok((await MostStada.sparuj(kod, 'A')).token);
    await assert.rejects(async () => { const r = await MostStada.sparuj(kod, 'B'); if (!r?.token) throw new Error(r?.message || 'odmowa'); });
});
