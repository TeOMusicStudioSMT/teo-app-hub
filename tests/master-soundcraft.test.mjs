/**
 * 🎛️ Mastering utworu biblioteki w SoundCraft — czyste części (skrypt, ścieżki, wzmocnienie, ebur128) + trasy za Strażą
 * + PRAWDZIWY soundcraft-cli z _OtakOs_AI/soundcraft (pomijane, gdy go nie ma).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import { utworzMaster, zamontujTrasyMasteru, skryptMasteringu, sciezkaUtworu, nastepneWzmocnienie, odczytajEbur128, opisLancuchow, LANCUCHY } from '../services/MasterSoundcraft.js';
import { znajdzCli } from '../services/ProdukcjaSoundcraft.js';
import { strazMostu } from '../services/StrazMostu.js';

const KATALOG_AI = path.resolve('_OtakOs_AI');
const CLI = znajdzCli(KATALOG_AI);

/** Biblioteka próbna: „utwór” 20 s (szum różowy + sinus, cicho) w podkatalogu jak album Suno. */
async function biblioteka() {
    const korzen = await fs.mkdtemp(path.join(os.tmpdir(), 'master-'));
    const M = path.join(korzen, 'muzyka');
    await fs.mkdir(path.join(M, 'Suno Test'), { recursive: true });
    execFileSync(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=color=pink:duration=20:amplitude=0.4', '-f', 'lavfi', '-i', 'sine=frequency=110:duration=20', '-filter_complex', '[1]volume=0.3[s];[0][s]amix=inputs=2:normalize=0', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(M, 'Suno Test', 'Próba [ab12].mp3')]);
    await fs.writeFile(path.join(M, 'Suno Test', 'Stary (master).mp3'), 'x');
    await fs.writeFile(path.join(M, 'notatka.txt'), 'x');
    await fs.writeFile(path.join(korzen, 'poza.mp3'), 'x');
    return { korzen, M };
}

test('skrypt masteringu: import, łańcuch na sumie, gain ograniczony, maximizer −1,5 dB, deterministycznie', () => {
    const s = skryptMasteringu({ wejscie: 'C:/m/a.mp3', lancuch: 'cieply', wzmocnienie: 40 });
    const linie = s.trim().split('\n').map((l) => { const i = l.indexOf(' '); return [l.slice(0, i), JSON.parse(l.slice(i + 1))]; });
    assert.deepEqual(linie[0], ['file.import_audio', { path: 'C:/m/a.mp3' }]);
    assert.deepEqual(linie[1], ['track.new', { kind: 'master', name: 'Suma' }]);
    assert.deepEqual(linie.slice(2).map(([id, p]) => [id, p.track, p.plugin]), [['mix.insert', 'Suma', 'eq_7band'], ['mix.insert', 'Suma', 'compressor'], ['mix.insert', 'Suma', 'saturator'], ['mix.insert', 'Suma', 'gain'], ['mix.insert', 'Suma', 'maximizer']]);
    assert.equal(linie[5][1].params.gain, 24, 'wzmocnienie ograniczone do +24 dB');
    assert.deepEqual(linie[6][1].params, { threshold: 0, ceiling: -1.5, release: 60 });
    assert.equal(s, skryptMasteringu({ wejscie: 'C:/m/a.mp3', lancuch: 'cieply', wzmocnienie: 40 }));
    // przejrzysty bez nasycenia, klubowy z szybszym maximizerem, pomiar oryginału = sam import
    assert.ok(!skryptMasteringu({ wejscie: 'x', lancuch: 'przejrzysty' }).includes('saturator'));
    assert.ok(skryptMasteringu({ wejscie: 'x', lancuch: 'klubowy' }).includes('"release":40'));
    assert.equal(skryptMasteringu({ wejscie: 'x', lancuch: null }).trim().split('\n').length, 1);
    assert.throws(() => skryptMasteringu({ wejscie: 'x', lancuch: 'rockowy' }), /Nieznany łańcuch/);
    assert.deepEqual(Object.keys(opisLancuchow()), Object.keys(LANCUCHY));
    assert.deepEqual(Object.values(LANCUCHY).map((l) => l.cel), [-14, -14, -10, -16]);
});

test('wzmocnienie do celu, odczyt ebur128', () => {
    assert.equal(nastepneWzmocnienie(0, -20, -14), 6);
    assert.equal(nastepneWzmocnienie(9.38, -10.6, -10), 9.98);
    assert.equal(nastepneWzmocnienie(20, -40, -14), 24);
    assert.equal(nastepneWzmocnienie(3, NaN, -14), 3);
    const t = '[Parsed_ebur128_0 @ x] t: 1 M: -20\n  Summary:\n\n  Integrated loudness:\n    I:         -14.2 LUFS\n    Threshold: -24.3 LUFS\n\n  True peak:\n    Peak:       -1.3 dBFS';
    assert.deepEqual(odczytajEbur128(t), { lufs: -14.2, truePeak: -1.3 });
    assert.deepEqual(odczytajEbur128('nic'), { lufs: null, truePeak: null });
});

test('ścieżki: tylko audio z biblioteki, nie master, bez wyjścia poza', async () => {
    const { korzen, M } = await biblioteka();
    try {
        assert.deepEqual(sciezkaUtworu(M, 'Suno Test/Próba [ab12].mp3').rel, 'Suno Test/Próba [ab12].mp3');
        assert.equal(sciezkaUtworu(M, path.join(M, 'Suno Test', 'Próba [ab12].mp3')).rel, 'Suno Test/Próba [ab12].mp3', 'ścieżka bezwzględna z katalogu (/api/muzyka/katalog)');
        assert.throws(() => sciezkaUtworu(M, '../poza.mp3'), /tylko utwory z biblioteki/);
        assert.throws(() => sciezkaUtworu(M, path.join(korzen, 'poza.mp3')), /tylko utwory z biblioteki/);
        assert.throws(() => sciezkaUtworu(M, 'notatka.txt'), /nie jest plik audio/);
        assert.throws(() => sciezkaUtworu(M, 'Suno Test/Stary (master).mp3'), /już jest master/);
        assert.throws(() => sciezkaUtworu(M, 'Suno Test/brak.mp3'), /Nie ma takiego utworu/);
        assert.throws(() => sciezkaUtworu(M, ''), /Podaj utwór/);
    } finally { await fs.rm(korzen, { recursive: true, force: true }); }
});

async function serwer(M, katalog, cfg = {}) {
    const app = express();
    app.use(express.json());
    app.use(strazMostu({ klucz: () => 'k'.repeat(48), zaufane: [] }));
    zamontujTrasyMasteru(app, utworzMaster({ katalogMuzyki: M, katalog, katalogAI: KATALOG_AI, ffmpeg: ffmpegPath, ...cfg }));
    const s = await new Promise((ok) => { const x = app.listen(0, '127.0.0.1', () => ok(x)); });
    const url = `http://127.0.0.1:${s.address().port}`;
    const j = async (m, p, body, h = {}) => { const r = await fetch(`${url}${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
    return { j, url, zamknij: () => new Promise((ok) => s.close(ok)) };
}

test('trasy: stan, odmowy z powodem, Straż — tylko maszyna', async () => {
    const { korzen, M } = await biblioteka();
    // bez binarki: stan mówi powód, POST odmawia wprost (OTAKOS_SOUNDCRAFT na pusty katalog, AI bez soundcraft)
    const T = await serwer(M, path.join(korzen, 'wymiar'), { katalogAI: path.join(korzen, 'brak-ai'), env: { ...process.env, OTAKOS_SOUNDCRAFT: path.join(korzen, 'brak') } });
    try {
        const s = await T.j('GET', '/api/master/stan');
        assert.equal(s.status, 200);
        assert.equal(s.master.dostepny, false);
        assert.match(s.master.powod, /Nie ma SoundCraft/);
        assert.deepEqual(Object.keys(s.master.lancuchy), ['przejrzysty', 'cieply', 'klubowy', 'delikatny']);
        assert.equal((await T.j('POST', '/api/master', { plik: '../poza.mp3', lancuch: 'cieply' })).status, 400);
        assert.equal((await T.j('POST', '/api/master', { plik: 'Suno Test/brak.mp3', lancuch: 'cieply' })).status, 404);
        assert.match((await T.j('POST', '/api/master', { plik: 'Suno Test/Próba [ab12].mp3', lancuch: 'rockowy' })).message, /Nieznany łańcuch/);
        const bez = await T.j('POST', '/api/master', { plik: 'Suno Test/Próba [ab12].mp3', lancuch: 'cieply' });
        assert.equal(bez.status, 400);
        assert.match(bez.message, /Nie ma SoundCraft/);
        // Straż: obca strona 401, przez tunel z kluczem 403
        assert.equal((await fetch(`${T.url}/api/master/stan`, { headers: { origin: 'https://zla-strona.example' } })).status, 401);
        assert.equal((await T.j('POST', '/api/master', { plik: 'x.mp3', lancuch: 'cieply' }, { 'cf-connecting-ip': '1.2.3.4', 'x-teo-klucz': 'k'.repeat(48) })).status, 403);
        assert.equal((await fetch(`${T.url}/api/master/stan`, { headers: { origin: 'http://localhost:5173' } })).status, 200, 'Music Studio z localhost');
    } finally { await T.zamknij(); await fs.rm(korzen, { recursive: true, force: true }); }
});

test('PRAWDZIWY SoundCraft: utwór z biblioteki → master −14 LUFS, TP ≤ −1, oryginał nietknięty, karta, trasa', { skip: !CLI && 'brak soundcraft-cli w _OtakOs_AI/soundcraft' }, async () => {
    const { korzen, M } = await biblioteka();
    const T = await serwer(M, path.join(korzen, 'wymiar'));
    try {
        const zrodlo = path.join(M, 'Suno Test', 'Próba [ab12].mp3');
        const skrot = async (p) => crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
        const przed = await skrot(zrodlo);
        const t0 = Date.now();
        const d = await T.j('POST', '/api/master', { plik: zrodlo, lancuch: 'przejrzysty' });
        assert.equal(d.status, 200, d.message);
        const k = d.master;
        console.log(`  mastering ${((Date.now() - t0) / 1000).toFixed(1)} s: ${k.lufsPrzed} → ${k.lufs} LUFS (wzmocnienie ${k.wzmocnienie} dB, ${k.przebiegi.length} przebiegi), TP ${k.truePeakPrzed} → ${k.truePeak}, mp3 ${k.lufsMp3} / ${k.truePeakMp3}`);
        assert.equal(k.plik, 'Suno Test/Próba [ab12] (master).mp3');
        assert.equal(d.url, `/music/Suno%20Test/${encodeURIComponent('Próba [ab12] (master).mp3')}`);
        assert.ok(Math.abs(k.lufs - -14) <= 0.6, `LUFS ${k.lufs}`);
        assert.ok(k.truePeak <= -1, `true peak ${k.truePeak}`);
        assert.ok(k.lufsPrzed < -17, `oryginał cichszy: ${k.lufsPrzed}`);
        assert.equal(k.uwaga, null);
        assert.ok(Math.abs(k.sekundy - 20) < 0.5, `${k.sekundy} s`);
        assert.ok(Number.isFinite(k.lufsMp3) && Math.abs(k.lufsMp3 - k.lufs) < 0.5, `mp3 ${k.lufsMp3}`);
        assert.equal(await skrot(zrodlo), przed, 'oryginał nietknięty');
        assert.ok((await fs.stat(path.join(M, k.plik))).size > 200_000);
        const karta = JSON.parse(await fs.readFile(path.join(M, 'Suno Test', 'Próba [ab12] (master).json'), 'utf8'));
        assert.equal(karta.lancuch, 'przejrzysty');
        assert.equal(karta.zrodlo, 'Suno Test/Próba [ab12].mp3');
        // historia w stanie, praca posprzątana, master mastera = odmowa
        const s = await T.j('GET', '/api/master/stan');
        assert.equal(s.master.dostepny, true);
        assert.equal(s.master.mastery[0].plik, k.plik);
        assert.deepEqual(await fs.readdir(path.join(korzen, 'wymiar', 'praca')), []);
        assert.match((await T.j('POST', '/api/master', { plik: k.plik, lancuch: 'cieply' })).message, /już jest master/);
    } finally { await T.zamknij(); await fs.rm(korzen, { recursive: true, force: true }); }
});
