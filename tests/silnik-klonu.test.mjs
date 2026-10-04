// 🎙️ Silnik klonu: prawdziwy voice_server.py (kontrakt HTTP mostu, Chatterbox i XTTS) + instalator w Katedrze (kroki, CUDA, zgoda CPML tylko dla XTTS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { instaluj, stanInstalacji, serwerGlosu, maZgode, aktywnySilnik, zainstalowane, SERWER_KATEDRY } from '../services/SilnikKlonu.js';

const python = (() => { try { execFileSync('python3', ['--version']); return 'python3'; } catch { return null; } })();
const czekaj = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const w = await f().catch(() => null); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 150)); } };

test('serwer z kodu Katedry istnieje; własny _OtakOs_AI/voice_server.py ma pierwszeństwo', () => {
    assert.ok(fs.existsSync(SERWER_KATEDRY), 'services/glos/voice_server.py');
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-'));
    assert.equal(serwerGlosu(ai), SERWER_KATEDRY);
    fs.writeFileSync(path.join(ai, 'voice_server.py'), '#');
    assert.equal(serwerGlosu(ai), path.join(ai, 'voice_server.py'));
});

test('voice_server.py: kontrakt HTTP mostu — GET / mówi silnik i stan modelu, POST /api/tts bez modelu = 503 z powodem', { skip: !python && 'brak python3' }, async () => {
    const port = 15000 + Math.floor(Math.random() * 2000);
    const p = spawn(python, [SERWER_KATEDRY], { env: { ...process.env, OTAKOS_GLOS_PORT: String(port), OTAKOS_GLOS_BEZ_MODELU: '1', OTAKOS_GLOS_SILNIK: '' }, stdio: 'ignore' });
    try {
        const stan = await czekaj(async () => (await fetch(`http://127.0.0.1:${port}/`)).json());
        assert.equal(stan.ok, true);
        assert.equal(stan.silnik, 'chatterbox', 'domyślny silnik = Chatterbox (MIT)');
        assert.match(stan.licencja, /MIT/);
        assert.ok(stan.jezyki.includes('pl') && stan.jezyki.includes('en'));
        assert.equal(stan.model, 'ladowanie');
        const r = await fetch(`http://127.0.0.1:${port}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Dzień dobry', speaker_wav: '/nie/ma.wav', language: 'pl' }) });
        assert.equal(r.status, 503);
        assert.match((await r.json()).blad, /model nie jest gotowy/);
        const pusty = await fetch(`http://127.0.0.1:${port}/api/tts`, { method: 'POST', body: '{}' });
        assert.equal(pusty.status, 400);
    } finally { p.kill(); }
});

// Ścieżka syntezy z podstawionym modelem (bez pobierania wag): próbka musi istnieć, język musi być znany, długi tekst
// idzie po zdaniach (Chatterbox ucina po ~1000 tokenach), warunki głosu liczone raz na próbkę, wynik to WAV.
const syntezaZAtrapa = (silnik, atrapa) => {
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'glos-'));
    const probka = path.join(ai, 'p.wav'); fs.writeFileSync(probka, 'x');
    const skrypt = `
import importlib.util, sys, wave, io, os
os.environ['OTAKOS_GLOS_SILNIK'] = ${JSON.stringify(silnik)}
spec = importlib.util.spec_from_file_location('vs', ${JSON.stringify(SERWER_KATEDRY)}); vs = importlib.util.module_from_spec(spec); spec.loader.exec_module(vs)
${atrapa}
vs._model = Atrapa(); vs.stan['model'] = 'gotowy'
dlugi = 'Witajcie serdecznie w studiu Katedry OtakOS, tuż nad szumem oceanu. ' * 8
wav = vs.syntezuj(dlugi, ${JSON.stringify(probka)}, 'pl')
w = wave.open(io.BytesIO(wav)); print(vs.SILNIK, w.getframerate(), w.getnchannels(), w.getnframes(), vs._model.wywolan, getattr(vs._model, 'warunkow', '-'))
for zly in [('', 'pl'), (${JSON.stringify(probka)}, 'xx')]:
    try: vs.syntezuj('a', zly[0], zly[1]); print('BEZ BLEDU')
    except ValueError as e: print('BLAD', e)
`;
    return execFileSync(python, ['-c', skrypt]).toString().trim().split('\n');
};

test('synteza Chatterbox (atrapa modelu): po zdaniach, warunki z próbki raz, pauza między kawałkami, WAV 24 kHz', { skip: !python && 'brak python3' }, () => {
    const out = syntezaZAtrapa('chatterbox', `
class Tensor:
    def __init__(self, n): self.n = n
    def squeeze(self, i): return self
    def detach(self): return self
    def cpu(self): return self
    def numpy(self): return [0.1] * self.n
class Atrapa:
    sr = 24000
    wywolan = 0; warunkow = 0
    def prepare_conditionals(self, p): self.warunkow += 1
    def generate(self, text, language_id):
        assert language_id == 'pl' and len(text) <= 250, (language_id, len(text))
        self.wywolan += 1; return Tensor(1000)
`);
    const [silnik, hz, kan, ramek, wywolan, warunkow] = out[0].split(' ');
    assert.equal(silnik, 'chatterbox'); assert.equal(hz, '24000'); assert.equal(kan, '1');
    assert.equal(warunkow, '1', 'próbka przygotowana raz na cały tekst');
    assert.ok(Number(wywolan) >= 3, `długi tekst w kawałkach (${wywolan})`);
    assert.equal(Number(ramek), Number(wywolan) * 1000 + (Number(wywolan) - 1) * 3600, 'kawałki + 0,15 s oddechu między nimi');
    assert.match(out[1], /BLAD brak próbki/);
    assert.match(out[2], /BLAD silnik chatterbox nie zna języka/);
});

test('synteza XTTS (atrapa modelu): ten sam kontrakt, WAV z próbek', { skip: !python && 'brak python3' }, () => {
    const out = syntezaZAtrapa('xtts', `
class Atrapa:
    synthesizer = type('S', (), {'output_sample_rate': 24000})()
    wywolan = 0
    def tts(self, text, speaker_wav, language): self.wywolan += 1; return [0.0, 0.5, -0.5] * 100
`);
    assert.match(out[0], /^xtts 24000 1 \d+ \d+ -$/);
    assert.match(out[1], /BLAD brak próbki/);
    assert.match(out[2], /BLAD silnik xtts_v2 nie zna języka/);
});

const falszyweUruchom = (kroki) => async (pol, argi, { naLinie = () => {} } = {}) => {
    kroki.push([path.basename(pol), ...argi].join(' '));
    if (argi.join(' ').includes('import sys;print')) { naLinie(pol === 'python3.12' ? '3 12' : '3 13'); return 0; }
    if (pol === 'nvidia-smi') { naLinie('| NVIDIA-SMI 560.94   Driver Version: 560.94   CUDA Version: 12.6 |'); return 0; }
    if (argi.includes('venv')) { const v = argi.at(-1); fs.mkdirSync(path.join(v, 'bin'), { recursive: true }); fs.writeFileSync(path.join(v, 'bin', 'python'), ''); return 0; }
    if (argi.join(' ').includes('import torch')) { naLinie('2.11.0+cu126 True 0.1.7'); return 0; }
    return 0;
};

test('instalator Chatterbox (domyślny): bez zgody, venv glos_chatterbox → torch pod sterownik → zależności → chatterbox-tts --no-deps → aktywny', async () => {
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inst-'));
    assert.equal(aktywnySilnik(ai), null);
    const kroki = [];
    const st = instaluj({ aiDir: ai, base: 'http://127.0.0.1:1', uruchom: falszyweUruchom(kroki), log: () => {} });
    assert.equal(st.stan, 'trwa'); assert.equal(st.silnik, 'chatterbox');
    const koniec = await czekaj(async () => (stanInstalacji().stan !== 'trwa' ? stanInstalacji() : null));
    assert.equal(koniec.stan, 'gotowe', koniec.blad);
    assert.equal(koniec.kolo, 'cu126'); assert.equal(koniec.cuda, true);
    const pipy = kroki.filter((k) => k.includes('pip install'));
    assert.match(pipy[0], /--upgrade pip/);
    assert.match(pipy[1], /torch torchaudio --index-url https:\/\/download\.pytorch\.org\/whl\/cu126/);
    assert.match(pipy[2], /-r .*requirements-chatterbox\.txt/);
    assert.match(pipy[3], /chatterbox-tts==0\.1\.7 --no-deps/);
    assert.ok(kroki.some((k) => k.includes('glos_chatterbox')), 'własne środowisko');
    assert.equal(maZgode(ai), false, 'MIT — bez zgody CPML');
    assert.equal(aktywnySilnik(ai), 'chatterbox');
    assert.equal(fs.readFileSync(path.join(ai, 'glos_chatterbox', '.silnik'), 'utf8'), 'chatterbox', 'serwer wie, który silnik ładować');
});

test('instalator XTTS: bez zgody na CPML odmawia; z nią — voice_env, torch na procesorze, coqui-tts, zgoda zapisana; aktywny = ostatnio zainstalowany', async () => {
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-inst-'));
    assert.throws(() => instaluj({ aiDir: ai, base: 'http://127.0.0.1:1', silnik: 'xtts' }), /CPML/);
    assert.throws(() => instaluj({ aiDir: ai, base: 'http://127.0.0.1:1', silnik: 'nie-ma' }), /Nie znam silnika/);
    const kroki = [];
    instaluj({ aiDir: ai, base: 'http://127.0.0.1:1', silnik: 'xtts', zgodaLicencji: true, cuda: 'cpu', uruchom: falszyweUruchom(kroki), log: () => {} });
    const koniec = await czekaj(async () => (stanInstalacji().stan !== 'trwa' ? stanInstalacji() : null));
    assert.equal(koniec.stan, 'gotowe', koniec.blad);
    const pipy = kroki.filter((k) => k.includes('pip install'));
    assert.match(pipy[1], /torch torchaudio --index-url https:\/\/download\.pytorch\.org\/whl\/cpu/);
    assert.match(pipy[2], /-r .*requirements-xtts\.txt/);
    assert.equal(pipy.length, 3);
    assert.ok(maZgode(ai), 'zgoda zapisana obok środowiska');
    assert.deepEqual(zainstalowane(ai), ['xtts']);
    assert.equal(aktywnySilnik(ai), 'xtts');
    fs.mkdirSync(path.join(ai, 'glos_chatterbox', 'bin'), { recursive: true }); fs.writeFileSync(path.join(ai, 'glos_chatterbox', 'bin', 'python'), '');
    assert.equal(aktywnySilnik(ai), 'xtts', 'wybór z instalacji wygrywa z kolejnością');
    fs.rmSync(path.join(ai, 'glos_silnik.txt'));
    assert.equal(aktywnySilnik(ai), 'chatterbox', 'bez wyboru — Chatterbox pierwszy');
});
