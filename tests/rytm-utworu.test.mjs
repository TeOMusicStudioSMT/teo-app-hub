// 🥁 Rytm utworu — BPM i uderzenia z dźwięku (prawdziwy ffmpeg, syntetyczne kliki), schowek, utwory tylko z biblioteki.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { utworzRytm, analizujNaplyw } from '../services/RytmUtworu.js';

const uruchom = (c, a, o) => promisify(execFile)(c, a, { maxBuffer: 1 << 28, ...o });

test('kliki 96 i 150 BPM: tempo co do 0,5, uderzenia ± 25 ms, schowek; utwór spoza biblioteki — odmowa', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'rytm-t-'));
    try {
        await fs.mkdir(path.join(kat, 'muzyka', 'Album'), { recursive: true });
        const R = utworzRytm({ katalogMuzyki: path.join(kat, 'muzyka'), katalog: path.join(kat, 'rytm'), ffmpeg, uruchom });
        for (const [bpm, start, sek, plik] of [[96, 0.1, 30, 'k96.wav'], [150, 0.5, 30, 'Album/k150.wav']]) {
            const P = 60 / bpm;
            await uruchom(ffmpeg, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc='if(lt(mod(t-${start}+100*${P},${P}),0.02),sin(2*PI*1000*t),0)':s=44100:d=${sek}`, path.join(kat, 'muzyka', plik)]);
            const w = await R.analizuj(plik);
            assert.ok(Math.abs(w.bpm - bpm) <= 0.5, `${bpm} → ${w.bpm}`);
            const prawdziwe = []; for (let t = start % P; t < sek; t += P) prawdziwe.push(t);
            const bledy = w.beaty.map((b) => Math.min(...prawdziwe.map((x) => Math.abs(x - b.t))));
            assert.ok(Math.max(...bledy) < 0.025, `maks błąd ${Math.max(...bledy)}`);
            assert.ok(Math.abs(w.beaty.length - prawdziwe.length) <= 1);
        }
        const lista = await R.utwory();
        assert.deepEqual(lista.map((u) => u.plik).sort(), ['Album/k150.wav', 'k96.wav']);
        assert.equal(lista.find((u) => u.plik === 'Album/k150.wav').url, '/music/Album/k150.wav');
        const zSchowka = await R.analizuj('k96.wav');
        assert.equal((await fs.readdir(path.join(kat, 'rytm'))).length, 2);
        assert.equal(zSchowka.bpm, 96);
        await assert.rejects(R.analizuj('../../etc/passwd'), /spoza biblioteki/);
        await assert.rejects(R.analizuj('nie-ma.mp3'), /Nie ma takiego utworu/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('cisza — nie ma rytmu, błąd wprost', () => {
    assert.throws(() => analizujNaplyw(new Float32Array(2000)), /Nie słychać rytmu/);
});
