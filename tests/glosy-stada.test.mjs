// 🗣️ Głosy Stada: czysty tekst do mowy (bez markdownu, emoji, linków, niewidocznych znaków) i mapa TeOgochi → barwa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tekstDoMowy, utworzGlosyStada } from '../services/GlosyStada.js';

test('tekst do mowy: znaczniki, emoji, linki, kod i niewidoczne znaki znikają — słowa zostają', () => {
    assert.equal(tekstDoMowy('## Cześć! 🎵 **Jestem Joanna** — _muzyka_ to [matematyka](https://x.pl).'), 'Cześć! Jestem Joanna — muzyka to matematyka.');
    assert.equal(tekstDoMowy('- punkt 1\n- punkt 2 ✨'), 'punkt 1. punkt 2');
    assert.equal(tekstDoMowy('Zobacz https://otakos.wtf teraz'), 'Zobacz teraz');
    assert.equal(tekstDoMowy('Kod:\n```js\nconst a = 1;\n```\nGotowe.'), 'Kod: Gotowe.');
    assert.equal(tekstDoMowy('zero​szerokości i spacja'), 'zero szerokości i spacja'.replace(' ', ' '));
    assert.equal(tekstDoMowy('🇵🇱 Polska ❤️'), 'Polska');
    assert.equal(tekstDoMowy('5 * 3 = 15, a 7_8'), '5 3 = 15, a 7 8');
    assert.equal(tekstDoMowy('Akapit pierwszy.\n\nAkapit drugi!'), 'Akapit pierwszy. Akapit drugi!');
    assert.equal(tekstDoMowy(null), '');
});

test('mapa Stada: profil albo VoiceStudio, null przywraca Pipera, złe dane odrzucone', async () => {
    const G = utworzGlosyStada({ katalog: fs.mkdtempSync(path.join(os.tmpdir(), 'glosy-stada-')) });
    assert.equal(await G.glos('joanna'), null);
    await G.ustaw('joanna', { voicestudio: 'ciepla-alt' });
    await G.ustaw('Klatka', { profil: 'klon-kael', przewod: 'piper-pl' });
    assert.deepEqual(await G.glos('joanna'), { voicestudio: 'ciepla-alt' });
    assert.deepEqual(await G.glos('klatka'), { profil: 'klon-kael' }, 'id małymi literami, tylko barwa (bez przewodu)');
    await assert.rejects(G.ustaw('joanna', { przewod: 'piper-pl' }), /profil Katedry albo profil VoiceStudio/);
    await assert.rejects(G.ustaw('../x', { profil: 'a' }), /Złe id/);
    assert.equal(await G.glos('../x'), null);
    await G.ustaw('joanna', null);
    assert.deepEqual(await G.wszystkie(), { klatka: { profil: 'klon-kael' } });
});
