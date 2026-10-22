/**
 * 🥁 Pady z dźwiękiem — most: zestawy, dźwięk z dataURL / próbki / wycinka utworu przez PRAWDZIWY ffmpeg do wav,
 * ustawienia nieniszczące, „zapisz jako” z plikami, powrót do syntezy, odmowy, Straż, karta jamu z zestawem.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import { utworzPadyJamu, zamontujTrasyPadow, oczyscZestaw, idZNazwy } from '../services/PadyJamu.js';
import { utworzJam, zamontujTrasyJamu } from '../services/JamZJoanna.js';
import { utworzRytm } from '../services/RytmUtworu.js';
import { strazMostu } from '../services/StrazMostu.js';

function wav(sekundy = 1, hz = 440, sr = 22050) {
    const n = Math.round(sr * sekundy), b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / sr) * 9000), 44 + i * 2);
    return b;
}
/** Długość wav (44,1 kHz stereo 16-bit) z rozmiaru danych. Szuka kawałka „data” (ffmpeg dokłada LIST). */
function sekundyWav(b) {
    const i = b.indexOf('data', 12, 'latin1');
    return b.readUInt32LE(i + 4) / (44100 * 4);
}

async function serwer({ zStraza = false } = {}) {
    const katalogMuzyki = await fs.mkdtemp(path.join(os.tmpdir(), 'pady-'));
    await fs.mkdir(path.join(katalogMuzyki, '_Stemy', '_Probki'), { recursive: true });
    await fs.writeFile(path.join(katalogMuzyki, '_Stemy', '_Probki', 'Klask.wav'), wav(0.5, 1200));
    await fs.writeFile(path.join(katalogMuzyki, 'Utwor.wav'), wav(6, 220));
    const app = express();
    app.use(express.json({ limit: '80mb' }));
    if (zStraza) app.use(strazMostu({ klucz: () => 'k'.repeat(48), zaufane: [] }));
    zamontujTrasyPadow(app, utworzPadyJamu({ katalogMuzyki, ffmpeg: ffmpegPath }));
    zamontujTrasyJamu(app, utworzJam({ katalogMuzyki, ffmpeg: ffmpegPath }));
    const s = await new Promise((ok) => { const x = app.listen(0, '127.0.0.1', () => ok(x)); });
    const url = `http://127.0.0.1:${s.address().port}`;
    const j = async (m, p, body, h = {}) => { const r = await fetch(`${url}${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
    return { katalogMuzyki, url, j, zamknij: async () => { await new Promise((ok) => s.close(ok)); await fs.rm(katalogMuzyki, { recursive: true, force: true }); } };
}

test('oczyscZestaw i id z nazwy', () => {
    assert.equal(oczyscZestaw({}).pady.length, 16);
    assert.equal(oczyscZestaw({ pady: [{ plik: '../x.wav' }] }).pady[0].plik, null);
    assert.equal(idZNazwy('Bity Łódzkie #1'), 'bity-lodzkie-1');
    assert.equal(idZNazwy('!!!'), 'zestaw');
});

test('trasy: zestaw, dźwięki z trzech źródeł przez ffmpeg, ustawienia, kopia, synteza, karta jamu', async () => {
    const T = await serwer();
    try {
        let d = await T.j('POST', '/api/jam/pady', { nazwa: 'Moje bity' });
        assert.equal(d.zestaw.id, 'moje-bity');
        assert.ok(d.zestaw.pady.every((p) => p.plik === null));
        // 1) dataURL (nagranie z mikrofonu / przeciągnięty plik) → wav 44,1 kHz stereo
        d = await T.j('POST', '/api/jam/pady/moje-bity/pad/1', { rodzaj: 'dane', nazwa: 'stopa.wav', dataURL: `data:audio/wav;base64,${wav(0.4, 60).toString('base64')}` });
        assert.equal(d.success, true, d.message);
        const p1 = d.zestaw.pady[0];
        assert.match(p1.plik, /^pad-1-[0-9a-f]{8}\.wav$/);
        assert.match(p1.zrodlo, /stopa\.wav/);
        assert.equal(p1.url, `/music/${encodeURIComponent('Jam z Joanną')}/Pady/moje-bity/${p1.plik}`);
        const kat = path.join(T.katalogMuzyki, 'Jam z Joanną', 'Pady', 'moje-bity');
        let b = await fs.readFile(path.join(kat, p1.plik));
        assert.equal(b.readUInt32LE(24), 44100);
        assert.equal(b.readUInt16LE(22), 2);
        assert.ok(Math.abs(sekundyWav(b) - 0.4) < 0.02, `${sekundyWav(b)}`);
        // 2) próbka z Samplera
        d = await T.j('POST', '/api/jam/pady/moje-bity/pad/5', { rodzaj: 'probka', stem: '_Stemy/_Probki/Klask.wav' });
        assert.match(d.zestaw.pady[4].zrodlo, /próbka _Probki\/Klask\.wav/);
        // 3) wycinek utworu od–do (2,5 s z 6 s)
        d = await T.j('POST', '/api/jam/pady/moje-bity/pad/9', { rodzaj: 'utwor', plik: 'Utwor.wav', od: 1, do: 3.5 });
        b = await fs.readFile(path.join(kat, d.zestaw.pady[8].plik));
        assert.ok(Math.abs(sekundyWav(b) - 2.5) < 0.03, `${sekundyWav(b)}`);
        // zamiana dźwięku usuwa stary plik
        const stary = d.zestaw.pady[0].plik;
        d = await T.j('POST', '/api/jam/pady/moje-bity/pad/1', { rodzaj: 'dane', dataURL: `data:audio/wav;base64,${wav(0.3, 80).toString('base64')}` });
        assert.notEqual(d.zestaw.pady[0].plik, stary);
        assert.equal(d.zestaw.pady[0].zrodlo, 'nagranie z mikrofonu');
        assert.ok(!(await fs.readdir(kat)).includes(stary));
        // ustawienia nieniszczące; pliku nie da się „dopisać” ustawieniami
        const pady = d.zestaw.pady.map((p, i) => (i === 0 ? { ...p, od: 0.05, do: 0.2, stroj: -3, tryb: 'trzymaj', grupa: 1, plik: 'pad-1-deadbeef.wav' } : i === 1 ? { ...p, plik: 'pad-2-deadbeef.wav' } : p));
        d = await T.j('PUT', '/api/jam/pady/moje-bity', { nazwa: 'Moje bity', pady });
        assert.deepEqual([d.zestaw.pady[0].od, d.zestaw.pady[0].do, d.zestaw.pady[0].stroj, d.zestaw.pady[0].tryb, d.zestaw.pady[0].grupa], [0.05, 0.2, -3, 'trzymaj', 1]);
        assert.notEqual(d.zestaw.pady[0].plik, 'pad-1-deadbeef.wav');
        assert.equal(d.zestaw.pady[1].plik, null);
        // „zapisz jako” kopiuje pliki i ustawienia
        d = await T.j('POST', '/api/jam/pady', { nazwa: 'Moje bity', z: 'moje-bity' });
        assert.equal(d.zestaw.id, 'moje-bity-2');
        assert.equal(d.zestaw.pady.filter((p) => p.plik).length, 3);
        assert.equal(d.zestaw.pady[0].tryb, 'trzymaj');
        // powrót do syntezy
        d = await T.j('DELETE', '/api/jam/pady/moje-bity-2/pad/5');
        assert.equal(d.zestaw.pady[4].plik, null);
        assert.equal((await T.j('GET', '/api/jam/pady')).zestawy.length, 2);
        // próbki padów nie wchodzą do biblioteki (Radio)
        const rytm = utworzRytm({ katalogMuzyki: T.katalogMuzyki, katalog: path.join(T.katalogMuzyki, '_rytm'), ffmpeg: ffmpegPath, uruchom: async () => ({ stdout: Buffer.alloc(0) }) });
        assert.ok(!(await rytm.utwory()).some((u) => u.plik.includes('Pady')));
        // odmowy
        assert.equal((await T.j('POST', '/api/jam/pady/moje-bity/pad/17', { rodzaj: 'probka', stem: 'x' })).status, 400);
        assert.match((await T.j('POST', '/api/jam/pady/moje-bity/pad/2', { rodzaj: 'probka', stem: '../../Utwor.wav' })).message, /Nie ma takiej próbki/);
        assert.match((await T.j('POST', '/api/jam/pady/moje-bity/pad/2', { rodzaj: 'utwor', plik: '../poza.wav' })).message, /Nie ma takiego utworu/);
        assert.match((await T.j('POST', '/api/jam/pady/moje-bity/pad/2', { rodzaj: 'dane', dataURL: `data:text/plain;base64,${Buffer.from('to nie jest dźwięk, tylko zwykły tekst '.repeat(20)).toString('base64')}` })).message, /ffmpeg|dźwięku/);
        assert.equal((await T.j('GET', '/api/jam/pady/nie-ma')).status, 404);
        assert.equal((await T.j('GET', '/api/jam/pady/Z%C5%81A')).status, 400);
        assert.ok(!(await fs.readdir(path.join(T.katalogMuzyki, 'Jam z Joanną', 'Pady'))).some((f) => f.startsWith('.')), 'pliki robocze sprzątnięte');
        // karta jamu pamięta zestaw padów
        const MIDI = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 4, 0, 0xff, 0x2f, 0]);
        d = await T.j('POST', '/api/jam/nagranie', { audio: wav(1).toString('base64'), typAudio: 'audio/wav', midi: MIDI.toString('base64'), meta: { nazwa: 'z padami', zestawPadow: 'moje-bity' } });
        assert.equal(d.jam.zestawPadow, 'moje-bity');
        d = await T.j('POST', '/api/jam/nagranie', { audio: wav(1).toString('base64'), typAudio: 'audio/wav', midi: MIDI.toString('base64'), meta: { nazwa: 'zła', zestawPadow: '../x' } });
        assert.equal(d.jam.zestawPadow, null);
    } finally { await T.zamknij(); }
});

test('Straż: /api/jam/pady tylko przy maszynie', async () => {
    const T = await serwer({ zStraza: true });
    try {
        assert.equal((await fetch(`${T.url}/api/jam/pady`, { headers: { origin: 'http://localhost:5173' } })).status, 200);
        assert.equal((await fetch(`${T.url}/api/jam/pady`, { headers: { origin: 'https://zla-strona.example' } })).status, 401);
        assert.equal((await T.j('POST', '/api/jam/pady', { nazwa: 'x' }, { 'cf-connecting-ip': '1.2.3.4', 'x-teo-klucz': 'k'.repeat(48) })).status, 403);
    } finally { await T.zamknij(); }
});
