// 🧱 Spawacz: klocki (inny rozmiar, z dźwiękiem) + materiał (bez dźwięku) → jeden film z wyrównaniem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { filtrSpawania, celSpawania, spawaj, zestawKlockow } from '../services/Spawacz.js';

test('filtr: każdy klip wyrównany do celu; klip bez dźwięku dostaje ciszę swojej długości; concat n=wszystkie', () => {
    const f = filtrSpawania([{ maAudio: true, sekundy: 5 }, { maAudio: false, sekundy: 121.5 }], { W: 960, H: 544, fps: 24 });
    assert.match(f, /\[0:v\]scale=960:544:force_original_aspect_ratio=decrease,pad=960:544/);
    assert.match(f, /\[0:a\]aresample=48000/);
    assert.match(f, /anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=121.5\[a1\]/);
    assert.match(f, /\[v0\]\[a0\]\[v1\]\[a1\]concat=n=2:v=1:a=1\[outv\]\[outa\]$/);
    assert.throws(() => filtrSpawania([], { W: 2, H: 2, fps: 1 }), /Nie ma czego/);
    assert.throws(() => filtrSpawania([{ maAudio: true }], { W: 961, H: 544, fps: 24 }), /parzyste/);
});

test('cel: rozmiar i fps wskazanego klipu, parzyste wymiary, fps w granicach', () => {
    assert.deepEqual(celSpawania({ szerokosc: 959, wysokosc: 543, fps: 23.976 }), { W: 960, H: 544, fps: 24 });
    assert.deepEqual(celSpawania({}), { W: 1920, H: 1080, fps: 30 });
    assert.equal(celSpawania({ szerokosc: 1920, wysokosc: 1080, fps: 240 }).fps, 60);
});

test('spawaj: cel według materiału (nie klocka), wszystkie wejścia, kodek i wyjście', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spawacz-'));
    const OPISY = {
        'start.mp4': { sekundy: 4, maAudio: true, szerokosc: 1920, wysokosc: 1080, fps: 30 },
        'film.mp4': { sekundy: 121, maAudio: false, szerokosc: 960, wysokosc: 544, fps: 24 },
    };
    let wywolanie = null;
    const r = await spawaj({
        klipy: ['/k/start.mp4', '/p/film.mp4'], wyjscie: path.join(tmp, 'out', 'wynik.mp4'), ffmpeg: 'ffmpeg', celWedlug: 1,
        opisz: async (p) => OPISY[path.basename(p)], uruchom: async (bin, args) => { wywolanie = { bin, args }; },
    });
    assert.equal(wywolanie.bin, 'ffmpeg');
    assert.deepEqual(wywolanie.args.slice(0, 4), ['-i', '/k/start.mp4', '-i', '/p/film.mp4']);
    assert.match(wywolanie.args[wywolanie.args.indexOf('-filter_complex') + 1], /scale=960:544.*fps=24/);
    assert.ok(wywolanie.args.includes('libx264') && wywolanie.args.at(-1).endsWith('wynik.mp4'));
    assert.match(r.metoda, /960×544@24/);
    assert.deepEqual(r.zrodla.map((z) => z.dzwiek), [true, false]);
    await assert.rejects(spawaj({ klipy: ['/x.mp4'], wyjscie: path.join(tmp, 'w.mp4'), ffmpeg: 'f', opisz: async () => null, uruchom: async () => {} }), /Nie odczytałem/);
});

test('zestaw klocków: Start → Add + Adds → End, tylko wideo, alfabetycznie; zły format = błąd wprost', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'klocki-'));
    const baza = path.join(tmp, 'Klocki do YT');
    for (const [kat, pliki] of [['Start', ['b.mp4', 'a.mp4', 'notatka.txt']], ['Adds', ['s.mp4']], ['Add', ['t.mov']], ['End', ['z.mp4']]]) {
        fs.mkdirSync(path.join(baza, kat), { recursive: true });
        for (const p of pliki) fs.writeFileSync(path.join(baza, kat, p), 'x');
    }
    const z = await zestawKlockow(tmp, 'YT');
    assert.deepEqual(z.start.map((p) => path.basename(p)), ['a.mp4', 'b.mp4']);
    assert.deepEqual(z.add.map((p) => path.basename(p)), ['s.mp4', 't.mov']);
    assert.deepEqual(z.end.map((p) => path.basename(p)), ['z.mp4']);
    assert.deepEqual((await zestawKlockow(tmp, 'Movie')).start, [], 'brak katalogu = pusto, nie błąd');
    await assert.rejects(zestawKlockow(tmp, 'TikTok'), /Nieznany format/);
});
