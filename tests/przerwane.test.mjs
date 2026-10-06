// 👻 Duchy nagrań: „nagrywa” na dysku bez pracy w pamięci (most wstał od nowa) → błąd z powodem i zapis,
// żeby Suweren mógł nagrać ponownie; żywe nagranie (wpis w wRobocie) zostaje nietknięte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { bezDucha, POWOD_PRZERWANIA } from '../services/Przerwane.js';
import { utworzSceny } from '../services/ScenyDialogowe.js';

test('bezDucha: duch → błąd z powodem i zapisem; żywe nagranie i inne etapy bez zmian', async () => {
    const zapisy = [];
    const pisz = async (p, d) => { zapisy.push([p, d]); };
    const duch = await bezDucha({ id: 'p_1', etap: 'nagrywa', postep: { etap: 'x' }, tytul: 'Music in Cathedral' }, { wRobocie: new Map(), pisz, plik: '/o.json', dopisek: 'Schowek.' });
    assert.equal(duch.etap, 'blad');
    assert.equal(duch.blad, `${POWOD_PRZERWANIA} Schowek.`);
    assert.equal(duch.tytul, 'Music in Cathedral');
    assert.ok(!('postep' in duch));
    assert.deepEqual(zapisy.map(([p, d]) => [p, d.etap]), [['/o.json', 'blad']]);
    const zywy = { id: 'p_2', etap: 'nagrywa' };
    assert.equal(await bezDucha(zywy, { wRobocie: new Map([['p_2', {}]]), pisz, plik: '/x' }), zywy);
    const gotowy = { id: 'p_3', etap: 'gotowy' };
    assert.equal(await bezDucha(gotowy, { wRobocie: new Map(), pisz, plik: '/x' }), gotowy);
    assert.equal(await bezDucha(null, { wRobocie: new Map(), pisz, plik: '/x' }), null);
    assert.equal(zapisy.length, 1);
});

test('Sceny dialogowe: scena „nagrywa” z poprzedniego życia mostu da się po restarcie zmienić (nie wisi na zawsze)', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'duchy-'));
    const katalog = path.join(tmp, 'sceny');
    await fs.mkdir(path.join(katalog, 's_duch1'), { recursive: true });
    await fs.writeFile(path.join(katalog, 's_duch1', 'scena.json'), JSON.stringify({ id: 's_duch1', projekt: 'film', etap: 'nagrywa', postacie: ['kael', 'elara'], kwestie: [{ kto: 'kael', tekst: 'Lecimy.' }, { kto: 'elara', tekst: 'Razem.' }], utworzono: '2026-10-06' }));
    const S = utworzSceny({ katalog, aktorzy: async () => [], katalogProjektu: async () => tmp, chat: async () => ({ tekst: '' }) });
    const lista = await S.sceny();
    assert.equal(lista[0].etap, 'blad');
    assert.match(lista[0].blad, /przerwane/);
    const zDysku = JSON.parse(await fs.readFile(path.join(katalog, 's_duch1', 'scena.json'), 'utf8'));
    assert.equal(zDysku.etap, 'blad', 'zapisane — drugi odczyt i zmiany już nie widzą „nagrywa”');
    assert.equal((await S.scena('s_duch1')).etap, 'blad');
});
