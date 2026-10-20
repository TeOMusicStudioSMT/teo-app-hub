/**
 * 🎹 Jam z Joanną — trasy mostu: strategia z zamkniętej listy (atrapa modelu), zapis nagrania
 * (prawdziwy ffmpeg: wav → mp3 + .mid + karta) do biblioteki muzyki, Straż: tylko maszyna.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import { utworzJam, zamontujTrasyJamu, odczytajStrategie, promptStrategii, nazwaPliku, KATALOG } from '../services/JamZJoanna.js';
import { utworzRytm } from '../services/RytmUtworu.js';
import { strazMostu } from '../services/StrazMostu.js';

/** 1 s sinusa 440 Hz jako WAV 16-bit mono 22 050 Hz. */
function wav() {
    const sr = 22050, n = sr, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 12000), 44 + i * 2);
    return b;
}
const MIDI = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 4, 0, 0xff, 0x2f, 0]);

async function serwer(cfg, { zStraza = false } = {}) {
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    if (zStraza) app.use(strazMostu({ klucz: () => 'k'.repeat(48), zaufane: [] }));
    zamontujTrasyJamu(app, utworzJam(cfg));
    const s = await new Promise((ok) => { const x = app.listen(0, '127.0.0.1', () => ok(x)); });
    return { url: `http://127.0.0.1:${s.address().port}`, zamknij: () => new Promise((ok) => s.close(ok)) };
}

test('odczytajStrategie: tylko lista, polskie znaki i wielkość liter, JSON z otoczką', () => {
    assert.deepEqual(odczytajStrategie('ok {"strategia":"Odwrócenie","komentarz":"Lustro twojej frazy.\\n"} koniec'), { strategia: 'odwrocenie', komentarz: 'Lustro twojej frazy.' });
    assert.throws(() => odczytajStrategie('{"strategia":"improwizacja","komentarz":"x"}'), /spoza listy/);
    assert.throws(() => odczytajStrategie('C D E F G'), /JSON/);
    const { system, prompt } = promptStrategii({ fraza: { tonacja: 'a-moll', bpm: 120, nut: 6, melodia: 'A3 C4 E4' }, energia: 0.8, gestosc: 0.2, poprzednie: ['echo', 'zmyślona'] });
    assert.match(system, /NUT NIE PISZESZ/);
    assert.match(prompt, /a-moll/);
    assert.match(prompt, /OSTATNIE STRATEGIE: echo\./);
    assert.equal(nazwaPliku('../..\\zła:nazwa*?'), 'zła nazwa');
    assert.equal(nazwaPliku(''), 'jam');
});

test('trasy: strategia, zapis mp3 + .mid w bibliotece, lista, odmowy', async () => {
    const katalogMuzyki = await fs.mkdtemp(path.join(os.tmpdir(), 'jam-'));
    let tekst = '{"strategia":"echo","komentarz":"Słyszę a-moll, odpowiem echem."}';
    const { url, zamknij } = await serwer({ katalogMuzyki, ffmpeg: ffmpegPath, pisz: async () => ({ tekst, model: 'atrapa' }) });
    try {
        let r = await fetch(`${url}/api/jam/strategia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fraza: { tonacja: 'a-moll' } }) });
        let d = await r.json();
        assert.equal(d.strategia, 'echo');
        assert.equal(d.model, 'atrapa');
        tekst = '{"strategia":"C4 E4 G4"}';
        r = await fetch(`${url}/api/jam/strategia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(r.status, 502);

        const cialo = { audio: wav().toString('base64'), typAudio: 'audio/wav', midi: MIDI.toString('base64'), meta: { nazwa: 'pierwszy dżem', bpm: 120, tonacja: 'a-moll', fraz: 4, sekundy: 1, strategie: ['echo', 'zła'], urzadzenie: 'MPK mini 3' } };
        r = await fetch(`${url}/api/jam/nagranie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cialo) });
        d = await r.json();
        assert.equal(d.success, true, d.message);
        assert.match(d.jam.audio, new RegExp(`^${KATALOG}/\\d{4}-\\d\\d-\\d\\d \\d{4} pierwszy dżem\\.mp3$`));
        assert.deepEqual(d.jam.strategie, ['echo']);
        const mp3 = await fs.readFile(path.join(katalogMuzyki, d.jam.audio));
        assert.ok(mp3.length > 4000 && (mp3.subarray(0, 3).toString('latin1') === 'ID3' || mp3[0] === 0xff), 'mp3');
        assert.deepEqual(await fs.readFile(path.join(katalogMuzyki, d.jam.midi)), MIDI);
        // drugi zapis o tej samej nazwie w tej samej minucie nie nadpisuje
        const d2 = await (await fetch(`${url}/api/jam/nagranie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cialo) })).json();
        assert.notEqual(d2.jam.audio, d.jam.audio);
        // biblioteka (Radio, Taneczne Starcie, Warsztat) widzi nagranie
        const rytm = utworzRytm({ katalogMuzyki, katalog: path.join(katalogMuzyki, '_rytm'), ffmpeg: ffmpegPath, uruchom: async () => ({ stdout: Buffer.alloc(0) }) });
        assert.ok((await rytm.utwory()).some((u) => u.plik === d.jam.audio));
        const l = await (await fetch(`${url}/api/jam`)).json();
        assert.equal(l.jamy.length, 2);
        assert.ok(!(await fs.readdir(path.join(katalogMuzyki, KATALOG))).some((f) => f.includes('surowe')), 'surowy plik sprzątnięty');
        // odmowy
        r = await fetch(`${url}/api/jam/nagranie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cialo, midi: Buffer.from('nie midi').toString('base64') }) });
        assert.equal(r.status, 400);
        assert.match((await r.json()).message, /MThd/);
        r = await fetch(`${url}/api/jam/nagranie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cialo, audio: '' }) });
        assert.equal(r.status, 400);
    } finally { await zamknij(); await fs.rm(katalogMuzyki, { recursive: true, force: true }); }
});

test('Straż: /api/jam tylko przy maszynie', async () => {
    const katalogMuzyki = await fs.mkdtemp(path.join(os.tmpdir(), 'jam-'));
    const { url, zamknij } = await serwer({ katalogMuzyki, ffmpeg: ffmpegPath }, { zStraza: true });
    try {
        assert.equal((await fetch(`${url}/api/jam`, { headers: { origin: 'http://localhost:5173' } })).status, 200);
        assert.equal((await fetch(`${url}/api/jam`, { headers: { origin: 'https://zla-strona.example' } })).status, 401);
        const r = await fetch(`${url}/api/jam/nagranie`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4', 'x-teo-klucz': 'k'.repeat(48) }, body: '{}' });
        assert.equal(r.status, 403);
    } finally { await zamknij(); await fs.rm(katalogMuzyki, { recursive: true, force: true }); }
});
