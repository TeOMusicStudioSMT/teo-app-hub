/** Projekt Stada, Modele Agentów, Delegat dla każdego gatunku, dzień szyny, wkłady jako klocki. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ProjektStada from '../services/ProjektStada.js';
import * as ModeleAgentow from '../services/ModeleAgentow.js';
import { zbierzKlocki } from '../services/KlockiStada.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'stado-'));
const czekaj = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const w = await fn(); if (w) return w; await new Promise((r) => setTimeout(r, 20)); } throw new Error('timeout'); };

test('plan: fundament → dziedziny → całość → scalenie przez Reżysera', () => {
    const kroki = ProjektStada.zaplanuj([{ id: 'kupiec', imie: 'Kupiec' }, { id: 'joanna', imie: 'Joanna' }, { id: 'rezyser', imie: 'Reżyser' }, { id: 'ogrodnik', imie: 'Ogrodnik', dziedzina: 'Agro' }]);
    assert.deepEqual(kroki.map((k) => `${k.agent}:${k.fala}`), ['rezyser:1', 'joanna:2', 'ogrodnik:2', 'kupiec:3', 'rezyser:4']);
    assert.ok(kroki.at(-1).synteza);
    assert.match(kroki[2].zadanie, /Agro/);   // gatunek spoza tabeli dostaje zadanie ze swojej dziedziny
});

test('projekt: każdy na swoim modelu, widzi wkłady poprzedników, błąd jednego nie wywraca reszty', async () => {
    const katalog = tmp(), zdarzenia = [], wywolania = [];
    ProjektStada.skonfiguruj({
        katalog, domyslnyModel: 'gemma4:e2b',
        szyna: { nadaj: async (z) => { zdarzenia.push(z); } },
        modelDla: async (id) => ({ joanna: 'qwen3.5:9b' }[id] ?? null),
        karta: async (id) => ({ tresc: `KARTA ${id}` }),
        chat: async (model, [sys, user]) => {
            wywolania.push({ model, sys: sys.content, user: user.content });
            if (sys.content.includes('KARTA kupiec')) throw new Error('Ollama milczy');
            return `wkład (${model})`;
        },
    });
    const s = await ProjektStada.zaloz({ nazwa: 'Uniwersum Teterhia', wizja: 'Świat klocków z muzyką, grą i modą.', uczestnicy: [{ id: 'rezyser', imie: 'Reżyser' }, { id: 'joanna', imie: 'Joanna' }, { id: 'kupiec', imie: 'Kupiec' }] });
    assert.equal(s.razem, 4);
    await assert.rejects(ProjektStada.zaloz({ nazwa: 'Drugi', wizja: 'jeszcze jeden projekt', uczestnicy: [{ id: 'a1', imie: 'A' }, { id: 'b1', imie: 'B' }] }), /jeden projekt naraz/);
    const p = await czekaj(async () => { const x = await ProjektStada.projekt(s.id); return x?.stan !== 'trwa' && x; });
    assert.equal(p.stan, 'czesciowo');
    assert.deepEqual(p.kroki.map((k) => `${k.agent}:${k.stan}:${k.model}`), ['rezyser:gotowe:gemma4:e2b', 'joanna:gotowe:qwen3.5:9b', 'kupiec:blad:gemma4:e2b', 'rezyser:gotowe:gemma4:e2b']);
    assert.match(wywolania[1].user, /Reżyser: wkład/);            // Joanna widzi fundament Reżysera
    assert.match(wywolania[3].sys, /SCALACZEM/);                    // ostatni krok scala
    assert.ok(zdarzenia.some((z) => z.agent === 'Joanna' && /pracuje nad „Uniwersum Teterhia"/.test(z.tresc)));
    assert.ok(zdarzenia.some((z) => z.agent === 'Kupiec' && /nie dał rady/.test(z.tresc)));
    const { agenci } = await zbierzKlocki({ projektyStada: () => ProjektStada.lista() });
    assert.deepEqual(agenci.joanna.klocki.map((k) => k.rodzaj), ['wklad']);
    assert.equal(agenci.rezyser.klocki.length, 2);                  // wkład + Biblia projektu
    assert.equal(agenci.kupiec, undefined);                         // nieudany wkład nie jest klockiem
});

test('walidacja: bez nazwy, bez wizji, jeden uczestnik → błąd', async () => {
    await assert.rejects(ProjektStada.zaloz({ nazwa: '', wizja: 'x'.repeat(20), uczestnicy: [] }), /nazwę/);
    await assert.rejects(ProjektStada.zaloz({ nazwa: 'A', wizja: 'krótko', uczestnicy: [] }), /wizję/);
    await assert.rejects(ProjektStada.zaloz({ nazwa: 'A', wizja: 'wystarczająco długa wizja', uczestnicy: [{ id: 'joanna', imie: 'J' }] }), /dwóch/);
});

test('obiekty 3D z wkładu Palety', () => {
    assert.deepEqual(ProjektStada.obiekty3d('Paleta: ...\nOBIEKT: tron z kości słoniowej\n- Obiekt: latarnia morska\nzwykła linia'), ['tron z kości słoniowej', 'latarnia morska']);
});

test('modele agentów: ustaw, odczytaj, wyczyść, odrzuć śmieci', async () => {
    ModeleAgentow.skonfiguruj({ katalogWymiar: tmp() });
    assert.equal(await ModeleAgentow.modelDla('joanna', 'gemma4:e2b'), 'gemma4:e2b');
    await ModeleAgentow.ustaw('joanna', 'qwen3.5:9b');
    assert.equal(await ModeleAgentow.modelDla('joanna'), 'qwen3.5:9b');
    await ModeleAgentow.ustaw('joanna', '');
    assert.equal(await ModeleAgentow.modelDla('joanna', 'd'), 'd');
    await assert.rejects(ModeleAgentow.ustaw('joanna', 'x; rm -rf /'), /Zła nazwa/);
    await assert.rejects(ModeleAgentow.ustaw('../etc', 'gemma4'), /identyfikator/);
});

test('Delegat: pełny profil dla trzech, rozmowny z karty roli dla reszty', async () => {
    const Delegat = await import('../services/Delegat.js');
    assert.ok((await Delegat.profilDla('joanna')).narzedzia.includes('music.generate'));
    const paleta = await Delegat.profilDla('paleta');
    assert.equal(paleta.imie, 'Paleta');
    assert.deepEqual(paleta.narzedzia, ['katedra.stan', 'szyna.pytanie', 'szyna.notatka']);
    assert.equal(await Delegat.profilDla('nie-ma-takiego'), null);
});
