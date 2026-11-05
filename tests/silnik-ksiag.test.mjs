// 📖✍️ Silnik Żywych Ksiąg — Kronikarz (atrapa) → wycinanki postaci i strony (atrapa FLUX, wzory Stałej Obsady) → publikacja w Wypożyczalni.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzSilnikKsiag, odczytajKsiege } from '../services/SilnikKsiag.js';
import { utworzWypozyczalnie } from '../services/WypozyczalniaKsiag.js';

const JSON_OK = JSON.stringify({ title: 'Kotek, który uczył się latać', subtitle: 'Bajka z Teterhii', characters: [
    { id: 'Iskra', name: 'Iskra', role: 'kotek TeOgochi', look: 'small black kitten with a glowing third eye', aktor: 'a-d5a590' },
    { id: 'wiatr', name: 'Pan Wiatr', role: 'stary wiatr', look: 'swirling old wind spirit', aktor: 'a-zzzzzz' }],
  pages: [
    { chapterTitle: 'I', narrativeText: 'Iskra patrzyła na chmury.', dialogueLines: [{ speaker: 'iskra', text: 'Chcę latać!' }, { speaker: 'nikt', text: 'x' }], illustrationPrompt: 'kitten looking at clouds', imageCaption: 'Chmury' },
    { chapterTitle: 'II', narrativeText: 'Wiatr zaśmiał się cicho.', dialogueLines: [{ speaker: 'wiatr', text: 'Najpierw skocz.' }], illustrationPrompt: 'wind spirit laughing', imageCaption: 'Wiatr' }] });

test('odczytajKsiege: postacie bez dubli, mówcy tylko z postaci, aktor tylko z listy, liczba stron pilnowana', () => {
    const k = odczytajKsiege(JSON_OK, { stron: 2, aktorzy: ['a-d5a590'] });
    assert.deepEqual(k.postacie.map((p) => [p.id, p.aktor]), [['iskra', 'a-d5a590'], ['wiatr', null]]);
    assert.equal(k.pages[0].dialogueLines.length, 1, 'mówca spoza postaci odpada');
    assert.throws(() => odczytajKsiege(JSON_OK, { stron: 3 }), /stron jest 2/);
    assert.throws(() => odczytajKsiege('nie json', { stron: 1 }), /JSON/);
});

test('przebieg: zła odpowiedź → poprawka, wycinanki z wzorem aktora, strony, gotowe; publikacja kopiuje obrazy do Wypożyczalni', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'silnik-'));
    const prompty = [], rysunki = [];
    const wzor = path.join(tmp, 'wzor.png'); await fs.writeFile(wzor, 'wzor');
    try {
        const odp = ['to nie json', JSON_OK];
        const S = utworzSilnikKsiag({ katalog: path.join(tmp, 'zk'), model: () => 'atrapa',
            pisz: async (_m, system, prompt) => { prompty.push({ system, prompt }); return odp.shift(); },
            rysuj: async (o) => { rysunki.push(o); const p = path.join(tmp, `r${rysunki.length}.png`); await fs.writeFile(p, `png${rysunki.length}`); return p; },
            obsada: { lista: async () => [{ id: 'a-d5a590', imie: 'Iskra', stan: 'zatwierdzony' }], wzory: async () => [wzor] }, autor: async () => 'Mistrz' });
        const z = await S.nowa({ pomysl: 'Bajka o kotku, który uczy się latać', stron: 2, obsada: ['a-d5a590'] });
        for (let i = 0; i < 50 && !['gotowe', 'blad'].includes((await S.czytaj(z.id)).stan); i++) await new Promise((r) => setTimeout(r, 20));
        const g = await S.czytaj(z.id);
        assert.equal(g.stan, 'gotowe', g.powod);
        assert.match(prompty[0].prompt, /a-d5a590: Iskra/);
        assert.match(prompty[1].prompt, /POPRZEDNIA ODPOWIEDŹ BYŁA ZŁA/);
        assert.equal(rysunki.length, 4, '2 wycinanki + 2 strony');
        assert.deepEqual(rysunki[0].referencje, [wzor], 'Iskra z wzorem Stałej Obsady');
        assert.deepEqual(rysunki[1].referencje, [], 'Pan Wiatr bez aktora');
        assert.deepEqual(rysunki[2].referencje, [wzor], 'na stronie mówi Iskra');
        assert.match(g.ksiega.characters[0].avatarCutoutUrl, /^\/api\/zywe-ksiegi\/zk-[0-9a-f]{8}\/obraz\/postac-iskra\.png$/);
        assert.equal(g.ksiega.author, 'Mistrz');
        // publikacja: obrazy z /api/zywe-ksiegi → pliki Wypożyczalni pod adresem publicznym
        const W = utworzWypozyczalnie({ katalog: path.join(tmp, 'teostory'), obrazLokalny: (u) => S.plikZAdresu(u) });
        const ks = { ...g.ksiega, pages: g.ksiega.pages.map((s) => ({ ...s, imageUrl: `http://127.0.0.1:3001${s.imageUrl}` })) };
        const wpis = await W.publikuj({ book: ks, rentalTier: 'demo' });
        const { ksiega } = await W.czytaj(wpis.id);
        assert.match(ksiega.pages[0].imageUrl, new RegExp(`^/wizytowka/teostory/${wpis.id}/obraz/obraz-\\d\\.png$`));
        assert.match(ksiega.characters[0].avatarCutoutUrl, /^\/wizytowka\/teostory\//);
        assert.equal(await fs.readFile(W.plikObrazu(wpis.id, path.basename(ksiega.pages[0].imageUrl)), 'utf8'), 'png3');
        assert.match(wpis.okladka, /^\/wizytowka\/teostory\//);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
