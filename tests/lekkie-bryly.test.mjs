// 📱 Lekkie bryły dla telefonu: odchudzanie prawdziwego GLB (siatka bez riga do celu, z rigiem nietknięta),
// kopie przy udostępnieniu gry (tylko zmienione, zapas na pełną, rozmiary w manifeście), ścieżka gościa `lekkie/assety/…`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { odchudzBryle } from '../services/LekkieBryly.js';
import { utworzPaczkiGier } from '../services/PaczkiGier.js';

/** Siatka-płachta n×n kwadratów (2n² trójkątów); `rig` = ze skórą i jednym stawem. */
async function glbSiatki(n, { rig = false } = {}) {
    const doc = new Document();
    const buf = doc.createBuffer();
    const poz = [], ind = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) poz.push(i / n, Math.sin(i * 0.3) * Math.cos(j * 0.2) * 0.1, j / n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; ind.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
    const prim = doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(poz)).setBuffer(buf))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ind)).setBuffer(buf));
    const wezel = doc.createNode('bryla').setMesh(doc.createMesh().addPrimitive(prim));
    if (rig) {
        const ile = (n + 1) * (n + 1);
        prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint16Array(ile * 4)).setBuffer(buf));
        prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(ile * 4).map((_, k) => (k % 4 === 0 ? 1 : 0))).setBuffer(buf));
        const staw = doc.createNode('staw');
        wezel.setSkin(doc.createSkin().addJoint(staw));
        doc.createScene().addChild(wezel).addChild(staw);
    } else doc.createScene().addChild(wezel);
    return Buffer.from(await new NodeIO().writeBinary(doc));
}
const bezFfmpeg = { ffmpeg: 'nie-trzeba', uruchom: async () => { throw new Error('bez tekstur ffmpeg niepotrzebny'); } };

test('odchudzBryle: siatka bez riga do celu (mniejszy plik), z rigiem nietknięta', async () => {
    const duza = await glbSiatki(200);   // 80 000 trójkątów
    const w = await odchudzBryle(duza, { celScian: 2000, ...bezFfmpeg });
    assert.equal(w.rig, false);
    assert.equal(w.trojkaty.z, 80_000);
    assert.ok(w.trojkaty.na <= 2400 && w.trojkaty.na > 500, `trójkątów ${w.trojkaty.na}`);
    assert.ok(w.po < w.przed / 10, `${w.przed} → ${w.po}`);
    const doc = await new NodeIO().readBinary(new Uint8Array(w.glb));
    const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    assert.ok(p.getAttribute('POSITION').getCount() < 3000, 'nieużyte wierzchołki wycięte');
    const zRigiem = await glbSiatki(60, { rig: true });
    const r = await odchudzBryle(zRigiem, { celScian: 500, ...bezFfmpeg });
    assert.deepEqual([r.rig, r.trojkaty.na], [true, 7200], 'rig: siatka bez zmian');
});

test('udostępnienie robi lekkie kopie (tylko zmienione), gość dostaje lekką albo pełną, manifest zna oba rozmiary', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lekkie-'));
    try {
        const dist = path.join(root, 'apki', 'gra-x', 'dist');
        await fs.mkdir(path.join(dist, 'assety'), { recursive: true });
        await fs.writeFile(path.join(dist, 'index.html'), '<div id="gra"></div>');
        await fs.writeFile(path.join(dist, 'assety', 'duza.glb'), await glbSiatki(200));
        await fs.writeFile(path.join(dist, 'assety', 'mala.glb'), await glbSiatki(10));
        const k = crypto.generateKeyPairSync('ed25519');
        let wywolan = 0;
        const P = utworzPaczkiGier({ katalog: path.join(root, 'wymiar'), katalogApek: path.join(root, 'apki'), nick: async () => 'teo-mas', klucz: async () => 'K', rejestr: 'x',
            podpisz: async (t) => crypto.sign(null, Buffer.from(t), k.privateKey).toString('base64'),
            odchudz: async (glb) => { wywolan++; return odchudzBryle(glb, { celScian: 2000, ...bezFfmpeg }); } });
        const { manifest: m } = await P.udostepnij('gra-x');
        assert.equal(wywolan, 2);
        assert.equal(m.rozmiary.bryl, 2);
        assert.equal(m.rozmiary.lekkichBryl, 1, 'mała bryła bez zysku — zostaje pełna');
        assert.ok(m.rozmiary.lekka < m.rozmiary.pelna / 5, JSON.stringify(m.rozmiary));
        const lekka = await P.plikGoscia('gra-x', 'lekkie/assety/duza.glb');
        assert.ok(lekka.includes(path.join('gry-paczki', 'gra-x', 'lekkie')), lekka);
        assert.ok((await P.plikGoscia('gra-x', 'lekkie/assety/mala.glb')).endsWith(path.join('dist', 'assety', 'mala.glb')), 'zapas: pełna');
        assert.equal(await P.plikGoscia('gra-x', 'lekkie/assety/..%2F..%2F..%2Fprojekt.json'), null, 'poza dist — nie');
        await P.udostepnij('gra-x');
        assert.equal(wywolan, 2, 'niezmienione bryły nie są odchudzane drugi raz');
        // lekka kopia dowolnego pliku (postać Katedry)
        const postac = path.join(root, 'postac.glb');
        await fs.writeFile(postac, await glbSiatki(200));
        assert.equal(await P.lekkiPlik(postac), null);
        const lp = await P.odchudzPlik(postac);
        assert.equal(await P.lekkiPlik(postac), lp);
        assert.ok((await fs.stat(lp)).size < (await fs.stat(postac)).size / 5);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
