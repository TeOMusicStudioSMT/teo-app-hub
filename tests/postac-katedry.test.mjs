// 🏛️ Postać Katedry: jedna karta na Katedrę, imię z księgi, droga z opisu i ze zdjęcia, rodzina wersji po łańcuchu
// `ulepsza`, publikacja najlepszej (z chodem) jako postac.glb + publiczna karta dla gry i wizytówki.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzPostacKatedry, rodzinaPostaci } from '../services/PostacKatedry.js';

test('rodzina postaci: z obrazu Pracowni i potomkowie bryły ze zdjęcia (łańcuch ulepsza)', () => {
    const lista = [{ id: 'z1' }, { id: 'z2', ulepsza: 'z1' }, { id: 'z3', ulepsza: 'z2' }, { id: 'obca', ulepsza: 'inna' }, { id: 'o1b', zObrazu: 'o1' }];
    assert.deepEqual(rodzinaPostaci({ korzen: 'z1' }, lista).map((m) => m.id), ['z1', 'z2', 'z3']);
    assert.deepEqual(rodzinaPostaci({ obraz: 'o1' }, lista).map((m) => m.id), ['o1b']);
});

test('droga postaci: karta z imieniem z księgi, zdjęcie → bryła, rig → publikacja postac.glb z chodem', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'postac-'));
    try {
        const bryly = [], wyw = [];
        const rig = path.join(kat, 'ruch-chod.glb');
        await fs.writeFile(rig, 'glTF-chod');
        const P = utworzPostacKatedry({
            katalog: path.join(kat, 'postac'), imieSuwerena: async () => 'Mistrz Arkadiusz',
            assety: {
                obraz: async (o) => { wyw.push(['obraz', o.styl, o.opis]); return { obraz: 'o1' }; },
                metaObrazu: async () => ({ stan: 'gotowe' }),
                generuj: async (o) => { wyw.push(['generuj', o.zdjecie ? path.basename(o.zdjecie) : o.zObrazu]); bryly.push({ id: 'z1', stan: 'gotowe', utworzono: '1' }); return { asset: 'z1' }; },
                lista: async () => bryly,
                sciezkaPliku: (id, p) => (id === 'z2' && p === 'ruch-chod.glb' ? rig : null),
            },
        });
        assert.deepEqual([(await P.stan()).etap, (await P.stan()).imie], ['brak', 'Mistrz Arkadiusz']);
        await assert.rejects(P.narysuj(), /Najpierw karta/);
        const k = await P.zapisz({ opis: 'wędrowiec w płaszczu z nut i złotych kabli', plec: 'mezczyzna', zywiol: 'eter', droga: 'tworca' });
        assert.equal(k.imie, 'Mistrz Arkadiusz', 'puste imię = imię Suwerena z księgi GRV');
        await P.narysuj();
        assert.deepEqual(wyw[0].slice(0, 2), ['obraz', 'postac3d']);
        assert.match(wyw[0][2], /^man — Mistrz Arkadiusz/);
        await assert.rejects(P.zeZdjecia('data:text/plain;base64,AAAA'), /PNG, JPG albo WEBP/);
        await P.zeZdjecia(`data:image/jpeg;base64,${Buffer.from('jpg').toString('base64')}`);
        assert.deepEqual(wyw.at(-1), ['generuj', 'zdjecie.jpg']);
        assert.equal((await P.stan()).etap, 'bryla');
        assert.equal(await P.publiczna(), null, 'nieopublikowana = nic dla sieci');
        bryly.push({ id: 'z2', ulepsza: 'z1', stan: 'gotowe', tekstury: true, ruchy: [{ ruch: 'chod' }], utworzono: '2' });
        assert.equal((await P.stan()).etap, 'rig');
        const o = await P.opublikuj();
        assert.deepEqual([o.zrodlo, o.ruch], ['z2', 'chod']);
        assert.equal(await fs.readFile(P.plik(), 'utf8'), 'glTF-chod');
        const pub = await P.publiczna();
        assert.deepEqual([pub.imie, pub.zywiol, pub.ruch], ['Mistrz Arkadiusz', 'eter', 'chod']);
        assert.match(pub.glb, /^\/wizytowka\/postac\.glb\?v=\d+&ruch=chod$/);
        assert.equal((await P.stan()).etap, 'opublikowana');
        const zm = await P.zapisz({ opis: 'nowy wygląd: płaszcz z piór i lutnia' });
        assert.deepEqual([zm.obraz, zm.korzen, zm.imie], [null, 'z1', 'Mistrz Arkadiusz'], 'nowy opis = obraz od nowa, bryła ze zdjęcia zostaje');
        await P.wycofaj();
        assert.equal(P.plik(), null);
        assert.equal(await P.publiczna(), null);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
