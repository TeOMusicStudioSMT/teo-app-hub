import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policzKoherencje } from '../services/KoherencjaKatedry.js';
import { rozmiarModelu } from '../services/BledyModeli.js';

const baza = { ollama: ['gemma4:12B', 'gemma4:e2b', 'qwen2.5-coder:7b'], domyslny: 'gemma4:12B', agenci: { rezyser: 'gemma4:12B' }, mechanik: 'qwen2.5-coder:7b', comfy: true, bledyMostuDoby: 0, bladChmuryDoby: null, rozmiar: rozmiarModelu };

test('wszystko dochodzi = 100%', () => {
    const k = policzKoherencje(baza);
    assert.equal(k.procent, 100); assert.equal(k.braki, 0);
});

test('Reżyser na e2b i Kodeks na modelu, którego nie ma — braki z radą', () => {
    const k = policzKoherencje({ ...baza, agenci: { rezyser: 'gemma4:e2b', kodeks: 'hf.co/x/Qwen3-Coder-30B:IQ1_M' } });
    const role = k.sprawdzenia.find((s) => s.id === 'role');
    const rozm = k.sprawdzenia.find((s) => s.id === 'rozmiar');
    assert.equal(role.ok, false); assert.match(role.opis, /kodeks/);
    assert.equal(rozm.ok, false); assert.match(rozm.opis, /rezyser \(gemma4:e2b\)/);
    assert.ok(role.rada && rozm.rada);
    assert.ok(k.procent < 100 && k.procent > 0);
});

test('Ollama milczy — koherencja nisko, ComfyUI śpiący to nie błąd', () => {
    const k = policzKoherencje({ ...baza, ollama: null, comfy: false });
    assert.equal(k.sprawdzenia.find((s) => s.id === 'ollama').ok, false);
    assert.equal(k.sprawdzenia.find((s) => s.id === 'comfy').rada, null);
    assert.ok(k.procent < 70);
});
