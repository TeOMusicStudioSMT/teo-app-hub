// 🎙️ Silnik klonu: prawdziwy voice_server.py (kontrakt HTTP mostu) + instalator w Katedrze (zgoda CPML, kroki, CUDA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { instaluj, stanInstalacji, serwerGlosu, maZgode, SERWER_KATEDRY } from '../services/SilnikKlonu.js';

const python = (() => { try { execFileSync('python3', ['--version']); return 'python3'; } catch { return null; } })();
const czekaj = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const w = await f().catch(() => null); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 150)); } };

test('serwer z kodu Katedry istnieje; własny _OtakOs_AI/voice_server.py ma pierwszeństwo', () => {
    assert.ok(fs.existsSync(SERWER_KATEDRY), 'services/glos/voice_server.py');
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-'));
    assert.equal(serwerGlosu(ai), SERWER_KATEDRY);
    fs.writeFileSync(path.join(ai, 'voice_server.py'), '#');
    assert.equal(serwerGlosu(ai), path.join(ai, 'voice_server.py'));
});

test('voice_server.py: kontrakt HTTP mostu — GET / mówi stan modelu, POST /api/tts bez modelu = 503 z powodem, z silnikiem = WAV', { skip: !python && 'brak python3' }, async () => {
    const port = 15000 + Math.floor(Math.random() * 2000);
    const p = spawn(python, [SERWER_KATEDRY], { env: { ...process.env, OTAKOS_GLOS_PORT: String(port), OTAKOS_GLOS_BEZ_MODELU: '1' }, stdio: 'ignore' });
    try {
        const stan = await czekaj(async () => (await fetch(`http://127.0.0.1:${port}/`)).json());
        assert.equal(stan.ok, true);
        assert.equal(stan.silnik, 'xtts_v2');
        assert.equal(stan.model, 'ladowanie');
        const r = await fetch(`http://127.0.0.1:${port}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Dzień dobry', speaker_wav: '/nie/ma.wav', language: 'pl' }) });
        assert.equal(r.status, 503);
        assert.match((await r.json()).blad, /model nie jest gotowy/);
        const pusty = await fetch(`http://127.0.0.1:${port}/api/tts`, { method: 'POST', body: '{}' });
        assert.equal(pusty.status, 400);
    } finally { p.kill(); }

    // Ścieżka syntezy z podstawionym silnikiem (bez pobierania XTTS): próbka musi istnieć, język musi być znany, wynik to WAV.
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'glos-'));
    const probka = path.join(ai, 'p.wav'); fs.writeFileSync(probka, 'x');
    const skrypt = `
import importlib.util, sys, wave, io
spec = importlib.util.spec_from_file_location('vs', ${JSON.stringify(SERWER_KATEDRY)}); vs = importlib.util.module_from_spec(spec); spec.loader.exec_module(vs)
class Atrapa:
    synthesizer = type('S', (), {'output_sample_rate': 24000})()
    def tts(self, text, speaker_wav, language): return [0.0, 0.5, -0.5] * 8000
vs._tts = Atrapa(); vs.stan['model'] = 'gotowy'
wav = vs.syntezuj('Dzień dobry', ${JSON.stringify(probka)}, 'pl')
w = wave.open(io.BytesIO(wav)); print(w.getframerate(), w.getnchannels(), w.getnframes())
for zly in [('', 'pl'), (${JSON.stringify(probka)}, 'xx')]:
    try: vs.syntezuj('a', zly[0], zly[1]); print('BEZ BLEDU')
    except ValueError as e: print('BLAD', e)
`;
    const out = execFileSync(python, ['-c', skrypt]).toString().trim().split('\n');
    assert.equal(out[0], '24000 1 24000');
    assert.match(out[1], /BLAD brak próbki/);
    assert.match(out[2], /BLAD XTTS-v2 nie zna języka/);
});

test('instalator: bez zgody na CPML odmawia; z nią — venv → pip → (CUDA z nvidia-smi) → coqui-tts → zgoda zapisana → sprawdzenie', async () => {
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inst-'));
    assert.throws(() => instaluj({ aiDir: ai, base: 'http://127.0.0.1:1' }), /CPML/);
    const kroki = [];
    const uruchom = async (pol, argi, { naLinie = () => {} } = {}) => {
        const cmd = [path.basename(pol), ...argi].join(' ');
        kroki.push(cmd);
        if (argi.join(' ').includes('import sys;print')) { naLinie(pol === 'python3.12' ? '3 12' : '3 13'); return 0; }
        if (pol === 'nvidia-smi') { naLinie('| NVIDIA-SMI 560.94   Driver Version: 560.94   CUDA Version: 12.6 |'); return 0; }
        if (argi.includes('venv')) { const v = argi.at(-1); fs.mkdirSync(path.join(v, 'bin'), { recursive: true }); fs.writeFileSync(path.join(v, 'bin', 'python'), ''); return 0; }
        if (argi.join(' ').includes('import torch, TTS')) { naLinie('2.5.1+cu126 True 0.24.2'); return 0; }
        return 0;
    };
    const st = instaluj({ aiDir: ai, base: 'http://127.0.0.1:1', zgodaLicencji: true, uruchom, log: () => {} });
    assert.equal(st.stan, 'trwa');
    const koniec = await czekaj(async () => (stanInstalacji().stan !== 'trwa' ? stanInstalacji() : null));
    assert.equal(koniec.stan, 'gotowe', koniec.blad);
    assert.equal(koniec.kolo, 'cu126');
    assert.equal(koniec.cuda, true);
    assert.ok(maZgode(ai), 'zgoda zapisana obok środowiska');
    const pipy = kroki.filter((k) => k.includes('pip install'));
    assert.match(pipy[0], /--upgrade pip/);
    assert.match(pipy[1], /torch torchaudio --index-url https:\/\/download\.pytorch\.org\/whl\/cu126/);
    assert.match(pipy[2], /-r .*requirements-voice\.txt/);
});
