// 🖼️ Pracownia obrazów (Game Studio): style, wycinek (prawdziwy ffmpeg: wytnij + białe pole do kwadratu),
// odmowy wprost — śpiący ComfyUI, koncept bez wycinka, zły wycinek. Prawdziwy FLUX/TRELLIS sprawdzany u Suwerena.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import * as Assety3D from '../services/Assety3D.js';

const uruchomProces = promisify(execFile);

async function wymiary(plik) {
    const { stderr } = await uruchomProces(ffmpegPath, ['-hide_banner', '-i', plik]).catch((e) => e);
    const m = String(stderr).match(/, (\d{2,5})x(\d{2,5})/);
    return [Number(m[1]), Number(m[2])];
}

test('style: tylko „pojedynczy” idzie do 3D w całości; wymiary podzielne przez 16 (FLUX.2)', () => {
    const S = Assety3D.STYLE_OBRAZU;
    assert.deepEqual(Object.keys(S).sort(), ['krajobraz', 'pojedynczy', 'postac', 'zestaw']);
    assert.deepEqual(Object.entries(S).filter(([, s]) => s.do3d).map(([k]) => k), ['pojedynczy']);
    for (const s of Object.values(S)) { assert.equal(s.szer % 16, 0); assert.equal(s.wys % 16, 0); }
});

test('wycinek: ffmpeg wycina prawą część arkusza i dokłada białe pole do kwadratu; złe wycinki — odmowa', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'pracownia-'));
    const arkusz = path.join(kat, 'arkusz.png');
    // Arkusz 1344×768: lewa część szara (części), prawa czerwona (złożona postać).
    await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=1344x768', '-f', 'lavfi', '-i', 'color=c=red:s=448x768',
        '-filter_complex', '[0][1]overlay=x=896:y=0', '-frames:v', '1', arkusz]);
    const wyj = path.join(kat, 'wycinek.png');
    await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-y', '-i', arkusz, '-vf', Assety3D.filtrWycinka({ x: 2 / 3, y: 0, w: 1 / 3, h: 1 }), '-frames:v', '1', wyj]);
    const [s, w] = await wymiary(wyj);
    assert.equal(s, w, 'wycinek ma być kwadratem');
    assert.ok(Math.abs(w - 768) <= 2, `wysokość ${w}`);
    // Środek kwadratu = czerwona postać, brzeg = biała ramka (nie szare części z lewej).
    const { stdout } = await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-i', wyj, '-vf', `crop=4:4:${Math.round(s / 2)}:${Math.round(w / 2)},format=rgb24`, '-f', 'rawvideo', '-'], { encoding: 'buffer' });
    assert.ok(stdout[0] > 200 && stdout[1] < 40, `środek nie jest czerwony: ${[...stdout.slice(0, 3)]}`);
    const { stdout: brzeg } = await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-i', wyj, '-vf', 'crop=4:4:2:2,format=rgb24', '-f', 'rawvideo', '-'], { encoding: 'buffer' });
    assert.ok(brzeg[0] > 240 && brzeg[1] > 240 && brzeg[2] > 240, 'brzeg ma być biały');
    for (const zly of [null, { x: 0.8, y: 0, w: 0.5, h: 1 }, { x: 0, y: 0, w: 0.01, h: 0.5 }, { x: -0.1, y: 0, w: 0.5, h: 0.5 }, { x: 'a', y: 0, w: 1, h: 1 }]) {
        assert.throws(() => Assety3D.filtrWycinka(zly), /Wycinek/);
    }
});

test('obraz i bryła z obrazu: odmowy wprost (śpiący ComfyUI, koncept bez wycinka, brak obrazu, zły styl)', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'pracownia-'));
    Assety3D.skonfiguruj({ katalogBiblioteki: path.join(kat, 'assety3d'), katalogObrazow: path.join(kat, 'obrazy'), katalogWorkflow: path.join(kat, 'wf'), comfyBase: 'http://127.0.0.1:9', pisz: null, szyna: null });
    await assert.rejects(Assety3D.obraz({ opis: 'golem', styl: 'akwarela' }), /Nieznany styl/);
    await assert.rejects(Assety3D.obraz({ opis: '' }), /Opisz/);
    await assert.rejects(Assety3D.obraz({ opis: 'golem z kamienia', styl: 'zestaw' }), /ComfyUI nie odpowiada/);
    // Obraz-koncept w Pracowni (jak po FLUX-ie).
    const id = 'kit-drift-ab12';
    await fs.mkdir(path.join(kat, 'obrazy', id), { recursive: true });
    await uruchomProces(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=1344x768', '-frames:v', '1', path.join(kat, 'obrazy', id, 'obraz.png')]);
    await fs.writeFile(path.join(kat, 'obrazy', id, 'meta.json'), JSON.stringify({ id, opis: 'DJ w tech-wear', styl: 'zestaw', do3d: false, stan: 'gotowe', galaz: 'postacie', utworzono: '2026-10-06' }));
    assert.equal((await Assety3D.listaObrazow()).length, 1);
    await assert.rejects(Assety3D.generuj({ zObrazu: id }), /zaznacz wycinek z JEDNYM obiektem/);
    await assert.rejects(Assety3D.generuj({ zObrazu: id, wycinek: { x: 0.9, y: 0, w: 0.5, h: 1 } }), /Wycinek/);
    await assert.rejects(Assety3D.generuj({ zObrazu: 'nie-ma-obrazu' }), /Nie ma takiego obrazu/);
    // Dobry wycinek przechodzi kontrole Pracowni i zatrzymuje się dopiero na stanie silnika (ComfyUI śpi) — wprost.
    await assert.rejects(Assety3D.generuj({ zObrazu: id, wycinek: { x: 0.66, y: 0, w: 0.34, h: 1 } }), /ComfyUI nie odpowiada/);
    assert.equal(await Assety3D.usunObraz(id), true);
    assert.equal(Assety3D.plikObrazu(id), null);
});
