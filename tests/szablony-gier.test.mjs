// 📜 Scenariusz Teterhii jako projekt: zasiew raz (drugi raz nie nadpisuje GDD Suwerena), gałęzie świata w GDD,
// GDD mieści się w limitach (sekcje ≤ 6000, kamienie ≤ 12 × zadania ≤ 6), style propozycji = style Pracowni obrazów.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import * as Gdd from '../services/Gdd.js';
import { zasiej, TETERHIA } from '../services/SzablonyGier.js';
import { STYLE_OBRAZU } from '../services/Assety3D.js';

test('scenariusz Teterhii mieści się w GDD i niczego nie gubi przy czyszczeniu', () => {
    const g = TETERHIA.gdd;
    for (const [k, v] of Object.entries(g.sekcje)) assert.ok(v.length > 100 && v.length <= 6000, `sekcja ${k}: ${v.length}`);
    assert.ok(g.kamienie.length <= 12 && g.kamienie.every((k) => k.zadania.length >= 1 && k.zadania.length <= 6));
    const galezie = Gdd.oczyscGalezie(g.galezie);
    assert.equal(galezie.length, g.galezie.length);
    assert.deepEqual(galezie.map((x) => x.propozycje.length), g.galezie.map((x) => x.propozycje.length));
    for (const x of g.galezie) for (const p of x.propozycje) assert.ok(STYLE_OBRAZU[p.styl], `styl ${p.styl} nie istnieje w Pracowni`);
    assert.ok(g.galezie.some((x) => x.propozycje.some((p) => p.styl === 'zestaw')), 'zestaw modelarski jak u Suwerena');
});

test('zasiej: nowy projekt gry + GDD z gałęziami; drugi raz zwraca istniejący i nie nadpisuje zmian Suwerena', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'szablon-'));
    Gdd.skonfiguruj({ katalog: kat });
    const projekty = [];
    const appStudio = {
        projekty: async () => projekty,
        nowyProjekt: async ({ nazwa, typ }) => { const p = { id: 'teterhia-wieczna-saga', nazwa, typ }; await fs.mkdir(path.join(kat, p.id)); projekty.push(p); return p; },
    };
    const w1 = await zasiej('teterhia', { appStudio, gdd: Gdd });
    assert.equal(w1.nowy, true);
    assert.equal(w1.projekt, 'teterhia-wieczna-saga');
    assert.equal(w1.gdd.galezie.length, 8, '7 gałęzi świata + Mini-TeOgochi (2026-10-09)');
    assert.equal(w1.gdd.kamienie.length, 6);
    assert.equal(w1.gdd.zrodlo, 'szablon:teterhia');
    assert.match(Gdd.jakoTekst(w1.gdd), /Gałęzie świata/);
    // Suweren zmienia wizję — ponowny zasiew jej nie rusza.
    await Gdd.zapisz(w1.projekt, { sekcje: { wizja: 'Moja wizja po zmianach.' } });
    const w2 = await zasiej('teterhia', { appStudio, gdd: Gdd });
    assert.equal(w2.nowy, false);
    assert.equal(w2.nadpisano, false);
    assert.equal(w2.gdd.sekcje.wizja, 'Moja wizja po zmianach.');
    assert.equal(projekty.length, 1, 'bez drugiego projektu');
    const w3 = await zasiej('teterhia', { appStudio, gdd: Gdd }, { nadpisz: true });
    assert.equal(w3.nadpisano, true);
    assert.match(w3.gdd.sekcje.wizja, /Bramę „To Get Sauce”/);
    await assert.rejects(zasiej('diablo', { appStudio, gdd: Gdd }), /Nie znam szablonu/);
});
