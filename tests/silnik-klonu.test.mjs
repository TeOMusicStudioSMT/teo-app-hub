// 🎙️ Silnik klonu: prawdziwy voice_server.py (kontrakt HTTP mostu, Chatterbox i XTTS) + instalator w Katedrze (kroki, CUDA, zgoda CPML tylko dla XTTS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { instaluj, stanInstalacji, serwerGlosu, maZgode, aktywnySilnik, zainstalowane, SERWER_KATEDRY } from '../services/SilnikKlonu.js';
import * as SilnikKlonu from '../services/SilnikKlonu.js';

const python = (() => { try { execFileSync('python3', ['--version']); return 'python3'; } catch { return null; } })();
const czekaj = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const w = await f().catch(() => null); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 150)); } };

test('serwer z kodu Katedry jest domyślny; stary _OtakOs_AI/voice_server.py (Flask startera) NIE przejmuje; własny tylko przez OTAKOS_GLOS_SERWER', () => {
    assert.ok(fs.existsSync(SERWER_KATEDRY), 'services/glos/voice_server.py');
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-'));
    assert.equal(serwerGlosu(ai), SERWER_KATEDRY);
    fs.writeFileSync(path.join(ai, 'voice_server.py'), 'from flask import Flask');
    assert.equal(serwerGlosu(ai), SERWER_KATEDRY, 'plik w _OtakOs_AI sam z siebie nie wygrywa');
    const stary = process.env.OTAKOS_GLOS_SERWER;
    process.env.OTAKOS_GLOS_SERWER = path.join(ai, 'voice_server.py');
    try { assert.equal(serwerGlosu(ai), path.join(ai, 'voice_server.py')); }
    finally { if (stary === undefined) delete process.env.OTAKOS_GLOS_SERWER; else process.env.OTAKOS_GLOS_SERWER = stary; }
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

test('autostart: szybkie padnięcia → przerwy 1/5 min, po 3 stop (bez pętli odpaleń); Windows: pythonw bez detached, UTF-8, dziennik w powodzie', async () => {
    const { EventEmitter } = await import('node:events');
    const ai = fs.mkdtempSync(path.join(os.tmpdir(), 'glos-auto-'));
    // „zainstalowany” Chatterbox: python w środowisku (Windows: Scripts/python.exe + pythonw.exe)
    fs.mkdirSync(path.join(ai, 'glos_chatterbox', 'Scripts'), { recursive: true });
    fs.writeFileSync(path.join(ai, 'glos_chatterbox', 'Scripts', 'python.exe'), '');
    fs.writeFileSync(path.join(ai, 'glos_chatterbox', 'Scripts', 'pythonw.exe'), '');
    const base = 'http://127.0.0.1:9';   // nikt nie słucha: silnik „nie odpowiada”, port wolny
    let czas = 1_000_000;
    const odpalenia = [];
    const spawnFn = (bin, args, opcje) => {
        const p = new EventEmitter();
        p.pid = 4000 + odpalenia.length; p.unref = () => {};
        odpalenia.push({ bin, opcje });
        fs.appendFileSync(SilnikKlonu.plikDziennika(ai), "UnicodeEncodeError: 'charmap' codec can't encode character\n");
        setImmediate(() => p.emit('exit', 1));   // pada od razu, jak u Suwerena
        return p;
    };
    const z = (dt = 0) => { czas += dt; return SilnikKlonu.zapewnij({ aiDir: ai, base, log: () => {}, spawnFn, teraz: () => czas, platforma: 'win32' }); };
    const tick = () => new Promise((r) => setImmediate(r));
    SilnikKlonu.wyzerujPadniecia();

    await z(); await tick();
    assert.equal(odpalenia.length, 1);
    const o = odpalenia[0];
    assert.match(o.bin, /pythonw\.exe$/, 'Windows: pythonw — bez okna konsoli');
    assert.equal(o.opcje.detached, false, 'Windows: bez detached (odłączony proces dostawał własne okno)');
    assert.equal(o.opcje.env.PYTHONIOENCODING, 'utf-8');
    assert.equal(typeof o.opcje.stdio[1], 'number', 'wyjście silnika do dziennika');
    let s = SilnikKlonu.stanSilnika();
    assert.equal(s.porazki, 1);
    assert.match(s.powod, /kolejna próba za 1 min/);
    assert.match(s.powod, /UnicodeEncodeError/, 'powód niesie ogon dziennika');

    for (let i = 0; i < 20; i++) await z(2500);   // panel pyta co 2,5 s przez 50 s
    assert.equal(odpalenia.length, 1, 'w przerwie żadnego odpalenia');
    await z(15_000); await tick();                 // po minucie — druga próba
    assert.equal(odpalenia.length, 2);
    assert.match(SilnikKlonu.stanSilnika().powod, /za 5 min/);
    await z(60_000);
    assert.equal(odpalenia.length, 2);
    await z(5 * 60_000); await tick();             // trzecia próba → stop
    assert.equal(odpalenia.length, 3);
    s = SilnikKlonu.stanSilnika();
    assert.match(s.powod, /padł 3× zaraz po starcie, autostart wstrzymany/);
    await z(24 * 3600_000);
    assert.equal(odpalenia.length, 3, 'po 3 padnięciach most nie odpala już sam');

    SilnikKlonu.wyzerujPadniecia();                // instalacja / zmiana silnika wznawia
    await z(); await tick();
    assert.equal(odpalenia.length, 4);
    // inna platforma: detached jak dawniej, zwykły python
    SilnikKlonu.wyzerujPadniecia();
    fs.mkdirSync(path.join(ai, 'linux', 'glos_chatterbox', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(ai, 'linux', 'glos_chatterbox', 'bin', 'python'), '');
    await SilnikKlonu.zapewnij({ aiDir: path.join(ai, 'linux'), base, log: () => {}, spawnFn, teraz: () => czas, platforma: 'linux' }); await tick();
    assert.equal(odpalenia.at(-1).opcje.detached, true);
    assert.match(odpalenia.at(-1).bin, /bin[\\/]python$/);
    SilnikKlonu.wyzerujPadniecia();
});

test('voice_server.py nie pada od meldunku startowego bez UTF-8 (Windows w tle: stdout cp1252, „ł” w „[Głos]”)', { skip: !python && 'brak python3' }, async () => {
    const port = 5000 + Math.floor(Math.random() * 400) + 100;
    const p = spawn(python, [SERWER_KATEDRY], { env: { ...process.env, PYTHONIOENCODING: 'cp1252', PYTHONUTF8: '0', OTAKOS_GLOS_BEZ_MODELU: '1', OTAKOS_GLOS_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (b) => { err += b; });
    try {
        const r = await czekaj(async () => { const x = await fetch(`http://127.0.0.1:${port}/`); return x.ok && x.json(); }, 10000);
        assert.ok(r.ok !== false, 'odpowiada na GET /');
        assert.equal(p.exitCode, null, `serwer żyje (stderr: ${err.slice(-300)})`);
    } finally { p.kill(); }
});
