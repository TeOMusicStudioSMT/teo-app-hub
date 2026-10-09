// 🧝 Bohaterowie startowi: Teterhia dostaje sześcioro (trzy kobiety), etap liczony z faktów Assetów 3D,
// do gry idzie najlepsza wersja (z chodem — animowany GLB), bohaterowie.json w public i dist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzBohaterow, etapBohatera, oczyscBohatera, opisDoObrazu, WZORCOWI_TETERHII } from '../services/Bohaterowie.js';

test('wzorcowi Teterhii: trzy kobiety, trzech mężczyzn, każdy żywioł; karta sprawdzana', () => {
    assert.equal(WZORCOWI_TETERHII.filter((b) => b.plec === 'kobieta').length, 3);
    assert.equal(new Set(WZORCOWI_TETERHII.map((b) => b.zywiol)).size, 5);
    assert.throws(() => oczyscBohatera({ imie: 'X', opis: 'krótko' }), /Opisz wygląd/);
    const b = oczyscBohatera({ imie: 'Łucja Żar', opis: 'wojowniczka w płaszczu z popiołu', plec: 'kobieta', zywiol: 'lawa' });
    assert.deepEqual([b.id, b.zywiol, b.plec], ['lucja-zar', 'eter', 'kobieta']);
    assert.match(opisDoObrazu(b), /^woman — Łucja Żar/);
});

test('etap z faktów: obraz → bryła → tekstury → rig; najlepsza wersja z chodem', () => {
    const b = { obraz: 'o1', wGrze: null };
    assert.equal(etapBohatera(b, { stan: 'trwa' }, []).etap, 'rysuje');
    assert.equal(etapBohatera(b, { stan: 'gotowe' }, []).etap, 'obraz');
    const lok = { id: 'a1', stan: 'gotowe', utworzono: '2026-10-09T10:00:00Z' };
    const tek = { id: 'a2', stan: 'gotowe', tekstury: true, utworzono: '2026-10-09T11:00:00Z' };
    const rig = { id: 'a3', stan: 'gotowe', tekstury: true, ruchy: [{ ruch: 'chod' }, { ruch: 'bieg' }], utworzono: '2026-10-09T12:00:00Z' };
    const nowsza = { id: 'a4', stan: 'gotowe', utworzono: '2026-10-09T13:00:00Z' };
    assert.equal(etapBohatera(b, { stan: 'gotowe' }, [lok]).etap, 'bryla');
    assert.equal(etapBohatera(b, { stan: 'gotowe' }, [lok, tek]).etap, 'tekstury');
    const e = etapBohatera(b, { stan: 'gotowe' }, [lok, tek, rig, nowsza]);
    assert.deepEqual([e.etap, e.najlepsza.id, e.najlepsza.ruchy], ['rig', 'a3', ['chod', 'bieg']], 'nowsza wersja bez riga nie wygrywa z rigiem');
    assert.equal(etapBohatera({ ...b, wGrze: { zrodlo: 'a3' } }, { stan: 'gotowe' }, [rig]).etap, 'w-grze');
    assert.equal(etapBohatera({ ...b, wGrze: { zrodlo: 'a2' } }, { stan: 'gotowe' }, [tek, rig]).nowszaNizWGrze, true);
});

test('droga bohatera: obraz w Pracowni, bryła z obrazu, do gry z chodem → bohaterowie.json (public + dist)', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'boh-'));
    try {
        const apki = path.join(kat, 'apki');
        await fs.mkdir(path.join(apki, 'teterhia-x', 'dist'), { recursive: true });
        const obrazy = {}, bryly = [], wywolania = [];
        const assety = {
            obraz: async (o) => { wywolania.push(['obraz', o.styl, o.opis]); obrazy.o1 = { stan: 'gotowe' }; return { obraz: 'o1', zadanie: 'z1' }; },
            metaObrazu: async (id) => obrazy[id] ?? null,
            generuj: async (o) => { wywolania.push(['generuj', o.zObrazu, o.nazwa]); bryly.push({ id: 'b1', zObrazu: o.zObrazu, stan: 'gotowe', utworzono: '1' }, { id: 'b2', zObrazu: o.zObrazu, stan: 'gotowe', tekstury: true, ruchy: [{ ruch: 'chod' }], utworzono: '2' }); return { asset: 'b1' }; },
            lista: async () => bryly,
            doGry: async (id, projekt, { ruch }) => {
                wywolania.push(['doGry', id, ruch]);
                const d = path.join(apki, projekt, 'public', 'assety');
                await fs.mkdir(d, { recursive: true });
                await fs.writeFile(path.join(d, `bohater-iskra-${ruch}.glb`), 'glb');
                return { plik: `assety/bohater-iskra-${ruch}.glb` };
            },
        };
        const B = utworzBohaterow({ katalog: path.join(kat, 'wymiar'), katalogApek: apki, assety });
        const l0 = await B.lista('teterhia-x');
        assert.equal(l0.length, 6);
        assert.equal(l0[0].etap, 'pomysl');
        await assert.rejects(B.wyrzezb('teterhia-x', 'iskra'), /Najpierw obraz/);
        await B.narysuj('teterhia-x', 'iskra');
        assert.deepEqual(wywolania[0].slice(0, 2), ['obraz', 'postac3d']);
        assert.match(wywolania[0][2], /^woman — Iskra/);
        await B.wyrzezb('teterhia-x', 'iskra');
        assert.equal((await B.lista('teterhia-x')).find((b) => b.id === 'iskra').etap, 'rig');
        const r = await B.doGry('teterhia-x', 'iskra');
        assert.deepEqual(wywolania.at(-1), ['doGry', 'b2', 'chod']);
        assert.equal(r.wGrze.plik, 'bohater-iskra-chod.glb');
        for (const k of ['public', 'dist']) {
            const j = JSON.parse(await fs.readFile(path.join(apki, 'teterhia-x', k, 'assety', 'bohaterowie.json'), 'utf8'));
            assert.deepEqual(j.bohaterowie.map((b) => [b.id, b.plec, b.zywiol, b.plik, b.ruch]), [['iskra', 'kobieta', 'ogien', 'bohater-iskra-chod.glb', 'chod']]);
        }
        assert.equal(await fs.readFile(path.join(apki, 'teterhia-x', 'dist', 'assety', 'bohater-iskra-chod.glb'), 'utf8'), 'glb', 'zbudowana gra dostaje bryłę od razu');
        assert.equal((await B.lista('teterhia-x')).find((b) => b.id === 'iskra').etap, 'w-grze');
        const nowy = await B.zapisz('teterhia-x', { imie: 'Iskra', opis: 'druga Iskra w zbroi z popiołu', plec: 'kobieta' });
        assert.notEqual(nowy.id, 'iskra', 'to samo imię = osobne id');
        const zm = await B.zapisz('teterhia-x', { id: 'iskra', opis: 'Iskra w nowym stroju z żaru i miedzi' });
        assert.equal(zm.obraz, null, 'nowy wygląd = obraz od nowa');
        await B.zGry('teterhia-x', 'iskra');
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(apki, 'teterhia-x', 'public', 'assety', 'bohaterowie.json'), 'utf8')).bohaterowie, []);
        await assert.rejects(B.lista('nie-ma'), /Nie ma takiego projektu/);
        assert.deepEqual(await utworzBohaterow({ katalog: path.join(kat, 'w2'), katalogApek: apki, assety }).lista('teterhia-x').then((l) => l.length), 6);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('🔗 podpięta gotowa bryła albo obraz z Pracowni: rodzina wersji od korzenia, nieistniejące = błąd wprost', async () => {
    const { rodzinaWersji } = await import('../services/Bohaterowie.js');
    const lista = [{ id: 'k1', zObrazu: 'ob1', stan: 'gotowe', utworzono: '1' }, { id: 'k2', ulepsza: 'k1', zObrazu: 'ob1', stan: 'gotowe', tekstury: true, utworzono: '2' }, { id: 'k3', ulepsza: 'k2', stan: 'gotowe', tekstury: true, ruchy: [{ ruch: 'chod' }], utworzono: '3' }, { id: 'z', zObrazu: 'ob1', stan: 'gotowe', utworzono: '0' }, { id: 'obca', stan: 'gotowe' }];
    assert.deepEqual(rodzinaWersji({ korzen: 'k2' }, lista).map((m) => m.id), ['k1', 'k2', 'k3', 'z'], 'korzeń z obrazu wciąga wersje tego obrazu');
    assert.deepEqual(rodzinaWersji({ obraz: 'ob1' }, lista).map((m) => m.id), ['k1', 'k2', 'z']);
    assert.deepEqual(rodzinaWersji({ korzen: 'k3' }, lista).map((m) => m.id), ['k3'], 'bryła bez obrazu: tylko ona i jej potomkowie');
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'boh2-'));
    try {
        await fs.mkdir(path.join(kat, 'apki', 'gra'), { recursive: true });
        const B = utworzBohaterow({ katalog: path.join(kat, 'w'), katalogApek: path.join(kat, 'apki'), assety: { lista: async () => lista, metaObrazu: async (id) => (id === 'ob1' ? { stan: 'gotowe' } : null), obraz: async () => ({}), generuj: async () => ({}), doGry: async () => ({}) } });
        await assert.rejects(B.zapisz('gra', { imie: 'Kot', opis: 'kot tancerz na dwóch nogach', korzen: 'nie-ma' }), /Nie ma takiej bryły/);
        await assert.rejects(B.zapisz('gra', { imie: 'Kot', opis: 'kot tancerz na dwóch nogach', obraz: 'nie-ma' }), /Nie ma takiego obrazu/);
        const b = await B.zapisz('gra', { imie: 'Kot Tancerz', opis: 'kot tancerz na dwóch nogach', plec: 'inna', korzen: 'k2' });
        const l = (await B.lista('gra')).find((x) => x.id === b.id);
        assert.deepEqual([l.etap, l.najlepsza.id], ['rig', 'k3']);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
