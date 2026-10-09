// 🖼️ Tekstury GLB do rozmiaru, który uniesie karta (8K z Meshy czerniło Hub) — prawdziwy ffmpeg, syntetyczny GLB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { zmniejszTekstury, zlozGlb, rozbierzGlb, wymiaryObrazu } from '../services/GlbTekstury.js';

const uruchom = (c, a) => promisify(execFile)(c, a, { maxBuffer: 1 << 26 });

test('obraz 256×128 w GLB → 64×32, geometria bajt w bajt, małe obrazy nietknięte', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'glbtex-'));
    try {
        const png = path.join(tmp, 'a.png');
        await uruchom(ffmpeg, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=256x128', '-frames:v', '1', png]);
        const obraz = await fs.readFile(png);
        assert.deepEqual(wymiaryObrazu(obraz), { w: 256, h: 128, format: 'png' });
        const geometria = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        const bin = Buffer.concat([geometria, obraz]);
        const json = { asset: { version: '2.0' }, buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }, { buffer: 0, byteOffset: 12, byteLength: obraz.length }], images: [{ bufferView: 1, mimeType: 'image/png' }] };
        const glb = zlozGlb(json, bin);
        const r = await zmniejszTekstury(glb, 64, { ffmpeg, uruchom });
        assert.deepEqual(r.zmniejszone, [{ z: '256×128', na: '64×32' }]);
        const p = rozbierzGlb(r.glb);
        const v0 = p.json.bufferViews[0], v1 = p.json.bufferViews[1];
        assert.ok(p.bin.slice(v0.byteOffset, v0.byteOffset + v0.byteLength).equals(geometria));
        assert.equal(v1.byteOffset % 4, 0, 'wyrównanie do 4 bajtów');
        assert.deepEqual(wymiaryObrazu(p.bin.slice(v1.byteOffset, v1.byteOffset + v1.byteLength)), { w: 64, h: 32, format: 'png' });
        assert.equal(p.json.buffers[0].byteLength, p.bin.length >= v1.byteOffset + v1.byteLength ? p.json.buffers[0].byteLength : -1);
        const bez = await zmniejszTekstury(glb, 512, { ffmpeg, uruchom });
        assert.equal(bez.glb, glb, 'mały obraz — ten sam plik');
        await assert.rejects(zmniejszTekstury(Buffer.from('nie glb'), 64, { ffmpeg, uruchom }), /nie jest GLB/);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
