// 🎞️ Ruch brył: skrypt Blendera (domknięta pętla, nazwa animacji, podgląd), orkiestracja w tle z atrapą Blendera
// (prawdziwy ffmpeg składa podgląd), meta.ruchy, „do gry” z animacją. Prawdziwy Blender sprawdzany ręcznie (bpy 5.0.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { skryptRuchu, utworzRuch, RUCHY_BRYL } from '../services/RuchBryl.js';
import { zlozKlatki } from '../services/Blender.js';
import * as Assety3D from '../services/Assety3D.js';

const uruchomProces = promisify(execFile);

test('skrypt: każdy ruch ma swoją gałąź, pętla domknięta, animacja ruch_<id>, ścieżki bez odwrotnych ukośników', () => {
    for (const r of RUCHY_BRYL) {
        const py = skryptRuchu({ wejscie: 'C:\\Katedra\\a\\model.glb', glb: 'C:\\Katedra\\a\\ruch.glb', klatki: null, ruch: r.id });
        assert.match(py, new RegExp(`RUCH = "${r.id}"`));
        assert.match(py, new RegExp(`RUCH == "${r.id}"`), `brak gałęzi ruchu ${r.id}`);
        assert.ok(!py.includes('\\'), 'odwrotny ukośnik w skrypcie');
        assert.match(py, /"ruch_" \+ RUCH/);
        assert.match(py, /KLATKI = r""/, 'bez podglądu nie renderujemy');
        assert.match(py, /ZAPISANO:/);
    }
    const zPodgladem = skryptRuchu({ wejscie: '/a/model.glb', glb: '/a/r.glb', klatki: '/a/kl', ruch: 'oddech', sekundy: 3, fps: 24 });
    assert.match(zPodgladem, /KLATEK = 72/);
    assert.match(zPodgladem, /render\(animation=True\)/);
    assert.throws(() => skryptRuchu({ wejscie: '/a', glb: '/b', ruch: 'taniec' }), /Nieznany ruch/);
    assert.throws(() => skryptRuchu({ wejscie: '/a"b', glb: '/b', ruch: 'obrot' }), /cudzysłowem/);
});

async function biblioteka() {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'ruch-bryl-'));
    const id = 'golem-ab12';
    await fs.mkdir(path.join(kat, 'assety3d', id), { recursive: true });
    await fs.writeFile(path.join(kat, 'assety3d', id, 'model.glb'), 'glTF-atrapa');
    await fs.writeFile(path.join(kat, 'assety3d', id, 'meta.json'), JSON.stringify({ id, nazwa: 'golem', opis: 'golem z kamienia', stan: 'gotowe', sciany: 8000 }));
    return { kat, id, katalogAssetu: (x) => path.join(kat, 'assety3d', x) };
}

/** Atrapa Blendera: czyta ścieżki ze skryptu, zapisuje GLB i 6 klatek PNG (ffmpeg), melduje jak prawdziwy. */
function atrapaBlendera({ jest = true, pad = null } = {}) {
    return {
        stanBlendera: async () => (jest ? { jest: true, wersja: 'atrapa' } : { jest: false, powod: 'Nie widzę blender.exe.', cozrobic: 'Wskaż OTAKOS_BLENDER.' }),
        zlozKlatki,
        uruchom: async (skrypt) => {
            const py = await fs.readFile(skrypt, 'utf8');
            if (pad) throw new Error(pad);
            const glb = py.match(/GLB = r"(.*)"/)[1];
            const klatki = py.match(/KLATKI = r"(.*)"/)[1];
            await fs.writeFile(glb, 'glTF-z-ruchem');
            if (klatki) {
                await fs.mkdir(klatki, { recursive: true });
                await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x223344:s=64x64:d=1', '-frames:v', '6', '-start_number', '1', path.join(klatki, 'klatka_%04d.png')]);
            }
            return { scena: glb, log: `ANIMACJA: ruch_x KLATEK: ${py.match(/KLATEK = (\d+)/)[1]}\nZAPISANO: ${glb}` };
        },
    };
}

async function czekaj(R, zid) {
    for (let i = 0; i < 200; i++) {
        const z = R.zadanie(zid);
        if (z.stan !== 'trwa') return z;
        await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('zadanie nie skończyło się');
}

test('ozyw: w tle → ruch-<id>.glb + ruch-<id>.mp4, wpis w meta.ruchy, katalog klatek sprzątnięty; drugi raz podmienia', async () => {
    const { id, katalogAssetu } = await biblioteka();
    const R = utworzRuch({ katalogAssetu, blender: atrapaBlendera() });
    const { zadanie } = await R.ozyw(id, { ruch: 'lewitacja', sekundy: 1 });
    const z = await czekaj(R, zadanie);
    assert.equal(z.stan, 'gotowe', z.blad);
    const dir = katalogAssetu(id);
    assert.ok(fsSync.existsSync(path.join(dir, 'ruch-lewitacja.glb')));
    assert.ok((await fs.stat(path.join(dir, 'ruch-lewitacja.mp4'))).size > 0);
    assert.ok(!fsSync.existsSync(path.join(dir, 'ruch-lewitacja-klatki')));
    assert.ok(!fsSync.existsSync(path.join(dir, 'ruch-lewitacja.py')));
    const m = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'));
    assert.deepEqual(m.ruchy.map((r) => r.ruch), ['lewitacja']);
    assert.equal(m.ruchy[0].klatek, 24);
    const drugi = await czekaj(R, (await R.ozyw(id, { ruch: 'lewitacja', sekundy: 2, podglad: false })).zadanie);
    assert.equal(drugi.stan, 'gotowe', drugi.blad);
    const m2 = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'));
    assert.equal(m2.ruchy.length, 1, 'ten sam ruch nie dubluje wpisu');
    assert.equal(m2.ruchy[0].mp4, null);
    assert.deepEqual(await R.usun(id, 'lewitacja'), []);
    assert.ok(!fsSync.existsSync(path.join(dir, 'ruch-lewitacja.glb')));
});

test('ozyw: odmowy wprost — brak Blendera, nieznany ruch, bryła niegotowa; pad Blendera = błąd w zadaniu, bez śmieci', async () => {
    const { id, katalogAssetu } = await biblioteka();
    await assert.rejects(utworzRuch({ katalogAssetu, blender: atrapaBlendera({ jest: false }) }).ozyw(id, { ruch: 'obrot' }), /blender\.exe.*OTAKOS_BLENDER/);
    const R = utworzRuch({ katalogAssetu, blender: atrapaBlendera({ pad: 'Skrypt Blendera padł: KeyError' }) });
    await assert.rejects(R.ozyw(id, { ruch: 'taniec' }), /Nieznany ruch/);
    await assert.rejects(R.ozyw('nie-ma-takiego', { ruch: 'obrot' }), /Nie ma takiego assetu/);
    const z = await czekaj(R, (await R.ozyw(id, { ruch: 'obrot' })).zadanie);
    assert.equal(z.stan, 'blad');
    assert.match(z.blad, /KeyError/);
    const pliki = await fs.readdir(katalogAssetu(id));
    assert.deepEqual(pliki.sort(), ['meta.json', 'model.glb']);
    const m = JSON.parse(await fs.readFile(path.join(katalogAssetu(id), 'meta.json'), 'utf8'));
    m.stan = 'trwa';
    await fs.writeFile(path.join(katalogAssetu(id), 'meta.json'), JSON.stringify(m));
    await assert.rejects(utworzRuch({ katalogAssetu, blender: atrapaBlendera() }).ozyw(id, { ruch: 'obrot' }), /nie jest gotowa/);
});

test('do gry z ruchem: osobny plik <nazwa>-<ruch>.glb i animacja w assety.json; bez policzonego ruchu — odmowa', async () => {
    const { kat, id, katalogAssetu } = await biblioteka();
    await fs.mkdir(path.join(kat, 'apki', 'teterhia'), { recursive: true });
    Assety3D.skonfiguruj({ katalogBiblioteki: path.join(kat, 'assety3d'), katalogApek: path.join(kat, 'apki'), szyna: null });
    const R = utworzRuch({ katalogAssetu, blender: atrapaBlendera() });
    await assert.rejects(Assety3D.doGry(id, 'teterhia', { ruch: 'oddech' }), /nie ma ruchu „oddech”/);
    assert.equal((await czekaj(R, (await R.ozyw(id, { ruch: 'oddech', podglad: false })).zadanie)).stan, 'gotowe');
    const w = await Assety3D.doGry(id, 'teterhia', { ruch: 'oddech' });
    assert.equal(w.plik, 'assety/golem-oddech.glb');
    assert.equal(await fs.readFile(path.join(kat, 'apki', 'teterhia', 'public', 'assety', 'golem-oddech.glb'), 'utf8'), 'glTF-z-ruchem');
    await Assety3D.doGry(id, 'teterhia');
    const spis = JSON.parse(await fs.readFile(path.join(kat, 'apki', 'teterhia', 'public', 'assety', 'assety.json'), 'utf8'));
    assert.deepEqual(spis.map((a) => [a.plik, a.animacja ?? null]).sort(), [['golem-oddech.glb', 'ruch_oddech'], ['golem.glb', null]]);
    assert.ok(Assety3D.sciezkaPliku(id, 'ruch-oddech.glb'));
    assert.equal(Assety3D.sciezkaPliku(id, 'ruch-oddech.py'), null);
    assert.equal(Assety3D.sciezkaPliku(id, '../meta.json'), null);
});
