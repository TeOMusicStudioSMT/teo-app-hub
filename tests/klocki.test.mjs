/** Klocki Stada — prawdziwe dzieła → klocki właściwego TeOgochi; brak źródła nie wywraca świata. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zbierzKlocki, WLASCICIELE } from '../services/KlockiStada.js';

const wystawa = async () => ({
    utwory: [{ id: 'utwor-a', tytul: 'Ballada', zrodlo: 'Katedra', kiedy: '2026-09-24T10:00:00Z' }, { id: 'utwor-u', tytul: 'Ukryty', ukryty: true }],
    filmy: [{ id: 'film-1', rodzaj: 'odcinek', tytul: 'Odc. 3', kiedy: '2026-09-23T10:00:00Z' }, { id: 'film-2', rodzaj: 'film', tytul: 'Zwiastun', kiedy: '2026-09-22T10:00:00Z' }],
    produkty: [{ id: 'moda-1', rodzaj: 'kreacja', tytul: 'Suknia', obraz: '/x.png' }, { id: 'chip-1', rodzaj: 'chip', tytul: 'HBM', obraz: null }],
});
const projekty = async () => [{ id: 'licznik-grv', typ: 'apka', nazwa: 'Licznik GRV', zbudowana: true, zrzut: true, iteracji: 2 }, { id: 'ogrod', typ: 'gra', nazwa: 'Ogród', zbudowana: false, zrzut: false }];
const assety3d = async () => [{ id: 'krzeslo', nazwa: 'Krzesło', stan: 'gotowe' }, { id: 'liczy', nazwa: 'W trakcie', stan: 'trwa' }];
const gatunki = [{ id: 'joanna', imie: 'Joanna' }, { id: 'kodeks', imie: 'Kodeks' }, { id: 'rezyser', imie: 'Reżyser' }];

test('każde dzieło trafia do właściciela z tabeli, ukryte i niedokończone pomijane', async () => {
    const { agenci } = await zbierzKlocki({ wystawa, projekty, assety3d, gatunki });
    const ids = (a) => (agenci[a]?.klocki ?? []).map((k) => k.id);
    assert.deepEqual(ids('joanna'), ['utwor-a']);
    assert.deepEqual(ids('rezyser'), ['film-1']);
    assert.deepEqual(ids('klatka'), ['film-2']);
    assert.deepEqual(ids('krawcowa'), ['moda-1']);
    assert.deepEqual(ids('wektor'), ['chip-1']);
    assert.deepEqual(ids('kodeks').sort(), ['apka-licznik-grv', 'apka-ogrod']);
    assert.deepEqual(ids('paleta'), ['model-krzeslo']);
    for (const r of new Set(Object.values(WLASCICIELE))) assert.ok(typeof r === 'string');
});

test('media i linki: zbudowana apka ma „otwórz", niezbudowana nie; utwór gra z wystawy', async () => {
    const { agenci } = await zbierzKlocki({ wystawa, projekty, assety3d, gatunki });
    const apka = agenci.kodeks.klocki.find((k) => k.id === 'apka-licznik-grv');
    assert.equal(apka.otworz, '/apki/licznik-grv/');
    assert.equal(apka.media.url, '/api/appstudio/projekty/licznik-grv/zrzut');
    assert.equal(agenci.kodeks.klocki.find((k) => k.id === 'apka-ogrod').otworz, null);
    assert.deepEqual(agenci.joanna.klocki[0].media, { typ: 'audio', url: '/wystawa/plik/utwor-a' });
    assert.equal(agenci.wektor.klocki[0].media, null);   // chip bez renderu — bez obrazka, nie z pustym linkiem
});

test('ślady z szyny po imieniu albo id (także z polskim znakiem), najnowsze pierwsze', async () => {
    const zdarzenia = [
        { kiedy: '1', agent: 'Joanna', rodzaj: 'praca', tresc: 'stare' },
        { kiedy: '2', agent: 'Reżyser', rodzaj: 'praca', tresc: 'kadr' },
        { kiedy: '3', agent: 'joanna', rodzaj: 'praca', tresc: 'nowe', dane: { sekret: 1 } },
        { kiedy: '4', agent: 'Nieznany', rodzaj: 'x', tresc: 'y' },
    ];
    const { agenci } = await zbierzKlocki({ zdarzenia, gatunki });
    assert.deepEqual(agenci.joanna.slady.map((s) => s.tresc), ['nowe', 'stare']);
    assert.deepEqual(agenci.rezyser.slady.map((s) => s.tresc), ['kadr']);
    assert.ok(!('dane' in agenci.joanna.slady[0]));
    assert.equal(agenci.nieznany, undefined);
});

test('padnięte źródło nie wywraca świata', async () => {
    const { agenci } = await zbierzKlocki({ wystawa: async () => { throw new Error('dysk'); }, projekty, gatunki });
    assert.equal(agenci.kodeks.razem, 2);
    assert.equal(agenci.joanna, undefined);
});
