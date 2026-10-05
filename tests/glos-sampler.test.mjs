// 🎚️ Sampler głosu: dowolny plik z dźwiękiem (nagranie ekranu mp4, wideo, mp3, mikrofon webm) → WAV w _Stemy/_Probki
// → fala do wyboru fragmentu → próbka klonu. Prawdziwy ffmpeg (ffmpeg-static).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { nazwaProbki, argumentyWgrania, argumentyFali, szczytyFali, argumentyProbki, listaStemow, WGRYWALNE, KATALOG_PROBEK, HZ_FALI } from '../services/GlosZeStemu.js';

const ex = promisify(execFile);

test('nazwa próbki: bez ogonków i znaków spoza Windows, zawsze .wav', () => {
    assert.equal(nazwaProbki('Nagranie ekranu 2026-10-05 Łódź ąę.mp4'), 'Nagranie ekranu 2026-10-05 Lodz ae.wav');
    assert.equal(nazwaProbki('C:\\x\\..\\a<b>:c?.webm'), 'a b c.wav');
    assert.equal(nazwaProbki(''), 'probka.wav');
    assert.equal(nazwaProbki('...'), 'probka.wav');
    assert.ok(WGRYWALNE.test('x.mp4') && WGRYWALNE.test('x.webm') && WGRYWALNE.test('x.MP3') && !WGRYWALNE.test('x.png'));
});

test('szczyty fali: maks. |próbka| w każdym przedziale, długość z 4 kHz', () => {
    const b = Buffer.alloc(HZ_FALI * 2 * 2);          // 2 s ciszy…
    b.writeInt16LE(16384, 10);                         // …z jednym trzaskiem w pierwszej połowie
    b.writeInt16LE(-32768, HZ_FALI * 2 + 100);         // i pełnym w drugiej
    const f = szczytyFali(b, 2);
    assert.deepEqual(f, { szczyty: [0.5, 1], sekundy: 2 });
    assert.deepEqual(szczytyFali(Buffer.alloc(0), 10), { szczyty: [], sekundy: 0 });
});

test('nagranie ekranu (mp4 z obrazem i dźwiękiem) → WAV → fala → próbka klonu', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'sampler-'));
    const film = path.join(kat, 'zrzut.mp4');
    // 1 s ciszy + 8 s tonu: sprawdza, że obraz znika, a fala widzi, gdzie jest dźwięk
    await ex(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=246x82:d=9', '-f', 'lavfi', '-i', "aevalsrc=if(gte(t\\,1)\\,0.5*sin(2*PI*220*t)\\,0):d=9",
        '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', film]);
    const stemy = path.join(kat, '_Stemy'), probki = path.join(stemy, KATALOG_PROBEK);
    fs.mkdirSync(probki, { recursive: true });
    const wav = path.join(probki, nazwaProbki('zrzut.mp4'));
    await ex(ffmpeg, argumentyWgrania({ wejscie: film, wyjscie: wav }));
    const { stderr } = await ex(ffmpeg, ['-i', wav, '-f', 'null', '-']).catch((e) => e);
    assert.match(String(stderr), /Audio: pcm_s16le.*44100 Hz, stereo/);
    assert.doesNotMatch(String(stderr), /Video:/);

    const { stdout } = await ex(ffmpeg, argumentyFali({ wejscie: wav }), { encoding: 'buffer', maxBuffer: 1e8 });
    const f = szczytyFali(stdout, 18);   // po pół sekundy — pierwsza połowa sekundy to cisza
    assert.ok(Math.abs(f.sekundy - 9) < 0.2, `długość ${f.sekundy}`);
    assert.ok(f.szczyty[0] < 0.05, `pierwsza sekunda cicha: ${f.szczyty}`);
    assert.ok(f.szczyty.slice(3).every((x) => x > 0.2), 'potem ton');

    const lista = await listaStemow(stemy);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].probka, true);
    assert.equal(lista[0].rel, `${KATALOG_PROBEK}/zrzut.wav`);

    const klon = path.join(kat, 'klon.wav');
    await ex(ffmpeg, argumentyProbki({ wejscie: wav, od: 0, do: 9, wyjscie: klon }));
    const { stderr: e2 } = await ex(ffmpeg, ['-i', klon, '-f', 'null', '-']).catch((e) => e);
    const m = String(e2).match(/Duration: (\d+):(\d+):([\d.]+)/);
    const s = +m[2] * 60 + +m[3];
    assert.ok(s > 7 && s < 8.5, `cisza z początku wycięta, zostało ${s} s`);
    assert.match(String(e2), /22050 Hz, mono/);
    fs.rmSync(kat, { recursive: true, force: true });
});

test('plik bez dźwięku = błąd ffmpeg (most mówi: brak ścieżki dźwięku)', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'sampler-'));
    const film = path.join(kat, 'cisza.mp4');
    await ex(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', film]);
    const blad = await ex(ffmpeg, argumentyWgrania({ wejscie: film, wyjscie: path.join(kat, 'x.wav') })).then(() => null, (e) => String(e.stderr));
    assert.ok(blad, 'ffmpeg musi odmówić');
    assert.match(blad, /matches no streams|does not contain any stream/i);
    fs.rmSync(kat, { recursive: true, force: true });
});
