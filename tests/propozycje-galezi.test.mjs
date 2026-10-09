// ✨ Nowe propozycje do gałęzi świata (model Reżysera) + 🐾 Mini-TeOgochi dopisywane z scenariusza do istniejącego GDD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Gdd, { odczytajPropozycje } from '../services/Gdd.js';
import { brakujaceGalezie, TETERHIA } from '../services/SzablonyGier.js';

test('odczytajPropozycje: tylko „STYL | opis” w stylach Pracowni, bez dubli, limit', () => {
    const t = '<think>hm</think>Oto propozycje:\npostac3d | stworek z żaru na dwóch nóżkach, ogon jak płomyk\n- pojedynczy | latarnia z kryształu nuty, oprawa z mosiądzu\nwideo | coś spoza listy stylów, nie przejdzie\npostac3d | Stworek z żaru na dwóch nóżkach, ogon jak płomyk\nzestaw | krótko';
    assert.deepEqual(odczytajPropozycje(t, []).map((p) => p.styl), ['postac3d', 'pojedynczy']);
    assert.equal(odczytajPropozycje(t, ['latarnia z kryształu nuty, oprawa z mosiądzu']).length, 1, 'to, co już jest, odpada');
    assert.equal(odczytajPropozycje(t, [], 1).length, 1);
});

test('Mini-TeOgochi: szablon ma gałąź na dwóch nogach; stare GDD Teterhii dostaje ją bez ruszania reszty; nowe propozycje na początek', async () => {
    const mini = TETERHIA.gdd.galezie.find((g) => g.id === 'mini-teogochi');
    assert.ok(mini.propozycje.length >= 4 && mini.propozycje.every((p) => p.styl === 'postac3d'));
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'galezie-'));
    try {
        await fs.mkdir(path.join(kat, 'gra'), { recursive: true });
        let prompt = '';
        Gdd.skonfiguruj({ katalog: kat, model: () => 'atrapa', pisz: async (o) => { prompt = o.prompt; return { tekst: 'postac3d | mini-TeOgochi Grzmotek — stworek z chmury burzowej na dwóch nóżkach, iskry na uszach\npostac3d | mini-TeOgochi Iskierka — mały stworek z żaru na dwóch nóżkach, ogon jak płomyk świecy, okrągłe bursztynowe oczy, słuchawki z miedzianego drutu' }; } });
        const stare = TETERHIA.gdd.galezie.filter((g) => g.id !== 'mini-teogochi');
        await Gdd.zapisz('gra', { tytul: 'Teterhia', galezie: stare, zrodlo: 'szablon:teterhia' });
        assert.deepEqual(brakujaceGalezie(await Gdd.wczytaj('gra')).map((g) => g.id), ['mini-teogochi']);
        assert.deepEqual(await Gdd.dodajGalezie('gra', brakujaceGalezie(await Gdd.wczytaj('gra'))), ['mini-teogochi']);
        const g = await Gdd.wczytaj('gra');
        assert.equal(g.galezie.length, stare.length + 1);
        assert.deepEqual(brakujaceGalezie(g), []);
        const nowe = await Gdd.nowePropozycje('gra', 'mini-teogochi', { narysowane: ['coś już narysowanego'] });
        assert.deepEqual(nowe.map((p) => p.opis.slice(0, 26)), ['mini-TeOgochi Grzmotek — s'], 'dubel z dotychczasowej propozycji odpadł');
        assert.match(prompt, /GAŁĄŹ: Mini-TeOgochi[\s\S]*coś już narysowanego/);
        const po = (await Gdd.wczytaj('gra')).galezie.find((x) => x.id === 'mini-teogochi');
        assert.match(po.propozycje[0].opis, /Grzmotek/, 'nowe na początku');
        await assert.rejects(Gdd.nowePropozycje('gra', 'nie-ma'), /Nie ma takiej gałęzi/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
