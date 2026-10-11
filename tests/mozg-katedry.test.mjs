import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utworzMozg, oczyscPola, ZAPAS } from '../services/MozgKatedry.js';

const katalog = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mozg-'));
const agenci = (p = {}) => ({ modelZPamieci: (id) => p[id] ?? null, wszystkie: async () => p });

test('domyślny: plik → OTAKOS_MODEL → zapas', () => {
    const k = katalog();
    assert.equal(utworzMozg({ katalog: k, agenci: agenci(), env: {} }).domyslny(), ZAPAS);
    assert.equal(utworzMozg({ katalog: k, agenci: agenci(), env: { OTAKOS_MODEL: 'gemma4:12b' } }).domyslny(), 'gemma4:12b');
    const m = utworzMozg({ katalog: k, agenci: agenci(), env: { OTAKOS_MODEL: 'gemma4:12b' } });
    const o = m.ustaw({ lokalny: 'qwen3.5:9b', chmuraCiezki: 'claude:claude-opus-5-5' });
    assert.equal(o.domyslny, 'qwen3.5:9b'); assert.equal(o.zrodlo, 'mozg');
    // nowa instancja czyta plik (most po restarcie)
    assert.equal(utworzMozg({ katalog: k, agenci: agenci(), env: {} }).domyslny(), 'qwen3.5:9b');
    // pusty = usuń wpis → wraca OTAKOS_MODEL
    assert.equal(m.ustaw({ lokalny: '' }).domyslny, 'gemma4:12b');
});

test('model roli: przydział TeOgochi wygrywa z domyślnym — rura Reżysera dochodzi', () => {
    const m = utworzMozg({ katalog: katalog(), agenci: agenci({ rezyser: 'hf.co/x/gemma-4-26B:Q4_K_M' }), env: {} });
    assert.equal(m.modelRoli('rezyser'), 'hf.co/x/gemma-4-26B:Q4_K_M');
    assert.equal(m.modelRoli('joanna'), ZAPAS);
    assert.equal(m.modelRoli(null), ZAPAS);
});

test('złe nazwy modeli odrzucone wprost', () => {
    assert.throws(() => oczyscPola({ lokalny: 'rm -rf /' }), /Zła nazwa modelu/);
    assert.deepEqual(oczyscPola({ lokalny: ' gemma4:e4b ', inne: 'x' }), { lokalny: 'gemma4:e4b' });
});
