// 🎛️ Karta 6 GB: serwer głosu usypia model (bezczynność i POST /zwolnij), most prosi głos/VoiceStudio/Ollamę o kartę przed
// każdym grafem ComfyUI (przedRenderem), 🧠 Pamięć Katedry pokazuje kartę. 2026-10-13: Chatterbox trzymał ~3,3 GB
// od pierwszego nagrania i krok Wana w TeO Game Show trwał 43 min (812 s/it). Atrapy — bez karty, modeli i sieci.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import * as Karta from '../services/RuchNaKarcie.js';
import StanKatedry from '../services/StanKatedry.js';
import { SERWER_KATEDRY } from '../services/SilnikKlonu.js';

const python = (() => { for (const p of ['python3', 'python']) { try { execFileSync(p, ['--version']); return p; } catch { /* dalej */ } } return null; })();
const czekaj = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const w = await f().catch(() => null); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 150)); } };

/** Serwer-atrapa: trasy → (req, ciało) → [kod, json]. */
async function atrapa(trasy) {
    const wolania = [];
    const s = http.createServer((req, res) => {
        let b = '';
        req.on('data', (c) => { b += c; });
        req.on('end', () => {
            const cialo = b ? JSON.parse(b) : null;
            wolania.push({ metoda: req.method, sciezka: req.url, cialo });
            const f = trasy[`${req.method} ${req.url}`];
            const [kod, dane] = f ? f(cialo) : [404, { blad: 'nie ma' }];
            res.writeHead(kod, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(dane));
        });
    });
    await new Promise((r) => s.listen(0, '127.0.0.1', r));
    return { base: `http://127.0.0.1:${s.address().port}`, wolania, zamknij: () => new Promise((r) => s.close(r)) };
}

const SMI_GPU = 'NVIDIA GeForce RTX 3060 Laptop GPU, 6144, 5900, 244';
const SMI_APPS = '75500, F:\\ComfyUI\\python_embeded\\pythonw.exe, [N/A]\n4242, C:\\a, b\\voice env\\pythonw.exe, [N/A]\n80348, C:\\Ollama\\llama-server.exe, 1900\n';
function smi(stan) {
    return async (_p, argi) => {
        if (argi[0].startsWith('--query-compute-apps')) return { stdout: SMI_APPS };
        return { stdout: stan.gpu ?? SMI_GPU };
    };
}

/** Zestaw: serwer głosu z modelem na cuda, Ollama z jednym modelem na karcie i jednym na CPU, VoiceStudio martwe. */
async function zestaw({ klonMowi = false } = {}) {
    const klon = { model: 'gotowy' };
    const glos = await atrapa({
        'GET /': () => [200, { ok: true, silnik: 'chatterbox', model: klon.model, urzadzenie: 'cuda', vram_mb: klon.model === 'gotowy' ? 3380 : 2, uspienia: 0, bezczynnosc_s: 180 }],
        'POST /zwolnij': () => {
            if (klonMowi) return [200, { ok: true, zwolniono: false, powod: 'właśnie mówi — model zostaje do końca nagrania' }];
            klon.model = 'uspiony'; return [200, { ok: true, zwolniono: true, vram_mb_przed: 3380, vram_mb_po: 2 }];
        },
    });
    const ollama = { modele: [{ name: 'gemma4:e4b', size_vram: 1900 * 1048576 }, { name: 'na-cpu:1b', size_vram: 0 }] };
    const oll = await atrapa({
        'GET /api/ps': () => [200, { models: ollama.modele }],
        'POST /api/generate': (c) => { ollama.modele = ollama.modele.filter((m) => m.name !== c.model); return [200, { done: true }]; },
    });
    const stanSmi = {};
    const szyna = [];
    let teraz = 1_000_000;
    Karta.skonfiguruj({
        uruchom: smi(stanSmi), ollamaBase: oll.base, klonBase: glos.base, voiceStudio: 'http://127.0.0.1:9',
        nadaj: async (z) => { szyna.push(z); }, wlaczone: true, teraz: () => teraz,
    });
    return {
        klon, glos, oll, szyna, stanSmi, przesun: (ms) => { teraz += ms; },
        zamknij: async () => { await glos.zamknij(); await oll.zamknij(); Karta.skonfiguruj({ wlaczone: false }); },
    };
}

test('procesyKarty: Windows bez pamięci na proces („[N/A]” → null), ścieżki z przecinkami, nazwa programu bez katalogu', async () => {
    Karta.skonfiguruj({ uruchom: smi({}) });
    const p = await Karta.procesyKarty();
    assert.deepEqual(p, [
        { pid: 75500, program: 'pythonw.exe', vramMiB: null },
        { pid: 4242, program: 'pythonw.exe', vramMiB: null },
        { pid: 80348, program: 'llama-server.exe', vramMiB: 1900 },
    ]);
    Karta.skonfiguruj({ uruchom: async () => { throw new Error('nie ma nvidia-smi'); } });
    assert.deepEqual(await Karta.procesyKarty(), [], 'bez nvidia-smi = pusto, nie błąd');
});

test('przedRenderem: głos Katedry usypia model, Ollama zdejmuje TYLKO model z karty (keep_alive 0), wpis na szynie; nic nie zabija', async () => {
    const z = await zestaw();
    try {
        const r = await Karta.przedRenderem('sceną Wan');
        assert.equal(r.wolno, true);
        assert.deepEqual(r.trzymaja, []);
        const nazwy = r.zwolniono.zdjete.map((m) => m.nazwa);
        assert.deepEqual(nazwy, ['głos Katedry (chatterbox)', 'gemma4:e4b']);
        assert.equal(r.zwolniono.zdjete[0].vramMiB, 3380);
        assert.equal(z.klon.model, 'uspiony');
        const gen = z.oll.wolania.filter((w) => w.sciezka === '/api/generate');
        assert.deepEqual(gen.map((w) => w.cialo), [{ model: 'gemma4:e4b', keep_alive: 0 }], 'model na CPU nietknięty');
        assert.deepEqual(z.glos.wolania.find((w) => w.sciezka === '/zwolnij').cialo, { powod: 'sceną Wan' });
        assert.equal(z.szyna.length, 1);
        assert.equal(z.szyna[0].rodzaj, 'karta');
        assert.match(z.szyna[0].tresc, /Przed sceną Wan: oddali kartę — głos Katedry \(chatterbox\) 3380 MiB, gemma4:e4b 1900 MiB/);

        // Kolejka kadrów: druga prośba chwilę później nie puka znowu.
        const zaChwile = await Karta.przedRenderem('kadrem FLUX');
        assert.equal(zaChwile.pominiete, 'prośba przed chwilą');
        z.przesun(Karta.ODSTEP_PROSB_MS + 1);
        const potem = await Karta.przedRenderem('kadrem FLUX');
        assert.deepEqual(potem.zwolniono.zdjete, [], 'nikt już nic nie trzyma');
        assert.equal(z.szyna.length, 1, 'bez zmian — bez wpisu');
    } finally { await z.zamknij(); }
});

test('przedRenderem: głos w trakcie nagrania odmawia → „nadal trzyma”, ale render NIE jest blokowany ani nic nie rzuca', async () => {
    const z = await zestaw({ klonMowi: true });
    try {
        const r = await Karta.przedRenderem('sceną Wan');
        assert.equal(r.wolno, false);
        assert.deepEqual(r.trzymaja, ['silnik głosu Katedry']);
        assert.match(r.zwolniono.klon.powod, /właśnie mówi/);
        assert.match(z.szyna[0].tresc, /nadal trzyma: silnik głosu Katedry/);
    } finally { await z.zamknij(); }
});

test('przedRenderem: wyłączone (testy, OTAKOS_GPU_ZWALNIAJ=0) i wszyscy martwi — bez wyjątku, bez wpisu', async () => {
    Karta.skonfiguruj({ wlaczone: false });
    assert.deepEqual(await Karta.przedRenderem('x'), { pominiete: 'wyłączone' });
    const szyna = [];
    Karta.skonfiguruj({ wlaczone: true, uruchom: smi({}), ollamaBase: 'http://127.0.0.1:9', klonBase: 'http://127.0.0.1:9', voiceStudio: 'http://127.0.0.1:9', nadaj: async (x) => { szyna.push(x); }, teraz: () => 5 });
    process.env.OTAKOS_GPU_ZWALNIAJ = '0';
    try { assert.deepEqual(await Karta.przedRenderem('x'), { pominiete: 'wyłączone' }); } finally { delete process.env.OTAKOS_GPU_ZWALNIAJ; }
    const r = await Karta.przedRenderem('x');
    assert.equal(r.wolno, true);
    assert.deepEqual(r.zwolniono.zdjete, []);
    assert.equal(szyna.length, 0);
    Karta.skonfiguruj({ uruchom: async () => { throw new Error('brak'); }, teraz: () => 10 ** 9 });
    assert.equal((await Karta.przedRenderem('x')).znane, false, 'bez nvidia-smi nie blokujemy i nie prosimy');
    Karta.skonfiguruj({ wlaczone: false });
});

test('starszy serwer głosu bez /zwolnij: mówi wprost, że trzeba go zrestartować', async () => {
    const glos = await atrapa({ 'GET /': () => [200, { ok: true, silnik: 'chatterbox', model: 'gotowy', urzadzenie: 'cuda' }] });
    Karta.skonfiguruj({ klonBase: glos.base });
    try {
        const r = await Karta.oddajKarteZKlonu('test');
        assert.equal(r.zrobione, false);
        assert.match(r.powod, /starsza wersja bez \/zwolnij/);
        assert.equal(glos.wolania.some((w) => w.sciezka === '/zwolnij'), false);
    } finally { await glos.zamknij(); }
});

test('🧠 Pamięć Katedry: karta (całość + kto trzyma + programy) w raporcie i w tekście dla agenta', async () => {
    const z = await zestaw();
    try {
        const k = await Karta.pamiecKarty();
        assert.equal(k.wolneMiB, 244);
        assert.deepEqual(k.trzymaja.map((t) => [t.kto, t.vramMiB, t.zwolnij]), [['głos Katedry', 3380, 'glos'], ['Ollama', 1900, 'ollama']]);
        assert.match(k.trzymaja[0].uwaga, /zaśnie sam po 3 min/);
        StanKatedry.skonfiguruj({ karta: () => Karta.pamiecKarty(), uruchom: async (p, a) => (p === 'nvidia-smi' ? smi({})(p, a).then((x) => x.stdout) : '[]'), platforma: 'win32' });
        const m = await StanKatedry.pamiec();
        assert.equal(m.karta.razemMiB, 6144);
        const t = StanKatedry.tekstPamieci(m);
        assert.match(t, /KARTA NVIDIA GeForce RTX 3060 Laptop GPU: zajęte 5900 MiB z 6144 MiB, wolne 244 MiB\./);
        assert.match(t, /- głos Katedry: chatterbox · gotowy — 3380 MiB/);
        assert.match(t, /programy na karcie: pythonw\.exe#75500, pythonw\.exe#4242, llama-server\.exe#80348 1900 MiB/);
        assert.match(t, /\/zwolnij karte/);
        assert.match(StanKatedry.tekstKarty({ znane: false }), /KARTA: nie widzę \(brak nvidia-smi\)/);
        assert.equal(StanKatedry.tekstKarty(null), '');
    } finally { StanKatedry.skonfiguruj({ karta: null }); await z.zamknij(); }
});

// ── voice_server.py: usypianie modelu (atrapa modelu i torcha — bez wag i karty) ─────────────────────────────────────
const pyServer = (kod) => {
    const skrypt = `
import importlib.util, sys, os, io, wave, threading, time
os.environ['OTAKOS_GLOS_SILNIK'] = 'chatterbox'
spec = importlib.util.spec_from_file_location('vs', ${JSON.stringify(SERWER_KATEDRY)}); vs = importlib.util.module_from_spec(spec); spec.loader.exec_module(vs)
class Tensor:
    def __init__(self, n): self.n = n
    def squeeze(self, i): return self
    def detach(self): return self
    def cpu(self): return self
    def numpy(self): return [0.1] * self.n
class Atrapa:
    sr = 24000
    def prepare_conditionals(self, p): pass
    def generate(self, text, language_id): return Tensor(100)
ladowan = [0]
def zaladuj_atrapa():
    ladowan[0] += 1
    time.sleep(0.05)
    vs._model = Atrapa(); vs.stan['model'] = 'gotowy'; vs.stan['urzadzenie'] = 'cuda'
vs.zaladuj = zaladuj_atrapa
vs.melduj = lambda t: None
probka = ${JSON.stringify(SERWER_KATEDRY)}
${kod}
`;
    return execFileSync(python, ['-c', skrypt], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString('utf8').trim().split(/\r?\n/);
};

test('voice_server.py: zwolnij → „uspiony”, następna synteza sama ładuje model (czas w info), ponowne zwolnij = nic', { skip: !python && 'brak pythona' }, () => {
    const out = pyServer(`
vs.zaladuj()
print(vs.zwolnij('test')['zwolniono'], vs.stan['model'], vs._model is None, vs.stan['uspienia'], vs.stan['uspiony_bo'])
info = {}
wav = vs.syntezuj('Dzień dobry.', probka, 'pl', info)
w = wave.open(io.BytesIO(wav)); print(vs.stan['model'], ladowan[0], 'ladowanie_s' in info, w.getnframes())
wav = vs.syntezuj('Jeszcze raz.', probka, 'pl', info2 := {})
print(ladowan[0], 'ladowanie_s' in info2)
vs.zwolnij('a'); r = vs.zwolnij('b'); print(r['zwolniono'], r['powod'])
`);
    assert.deepEqual(out, [
        'True uspiony True 1 test',
        'gotowy 2 True 100',
        '2 False',
        'False model nie jest załadowany (uspiony)',
    ]);
});

test('voice_server.py: w trakcie mowy zwolnij odmawia; bezczynność usypia tylko model na karcie i tylko po czasie', { skip: !python && 'brak pythona' }, () => {
    const out = pyServer(`
vs.zaladuj()
vs._blokada.acquire(); r = vs.zwolnij('render'); vs._blokada.release()
print(r['zwolniono'], r['powod'], vs.stan['model'])
vs.BEZCZYNNOSC_S = 180
teraz = vs._ostatnio
print(vs.czy_uspic(teraz + 10), vs.czy_uspic(teraz + 181))
vs.stan['urzadzenie'] = 'cpu'; print(vs.czy_uspic(teraz + 999))
vs.stan['urzadzenie'] = 'cuda'; vs.BEZCZYNNOSC_S = 0; print(vs.czy_uspic(teraz + 999))
`);
    assert.deepEqual(out, [
        'False właśnie mówi — model zostaje do końca nagrania gotowy',
        'False True',
        'False',
        'False',
    ]);
});

test('voice_server.py HTTP: POST /zwolnij bez modelu = zwolniono false z powodem; GET / mówi bezczynnosc_s i vram_mb', { skip: !python && 'brak pythona' }, async () => {
    const port = 17000 + Math.floor(Math.random() * 2000);
    const p = spawn(python, [SERWER_KATEDRY], { env: { ...process.env, OTAKOS_GLOS_PORT: String(port), OTAKOS_GLOS_BEZ_MODELU: '1', OTAKOS_GLOS_SILNIK: '', OTAKOS_GLOS_BEZCZYNNOSC_S: '90' }, stdio: 'ignore' });
    try {
        const stan = await czekaj(async () => (await fetch(`http://127.0.0.1:${port}/`)).json());
        assert.equal(stan.bezczynnosc_s, 90);
        assert.ok('vram_mb' in stan && 'uspienia' in stan);
        const r = await (await fetch(`http://127.0.0.1:${port}/zwolnij`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ powod: 'render' }) })).json();
        assert.equal(r.zwolniono, false);
        assert.match(r.powod, /nie jest załadowany \(ladowanie\)/);
        const bezCiala = await (await fetch(`http://127.0.0.1:${port}/zwolnij`, { method: 'POST' })).json();
        assert.equal(bezCiala.ok, true);
    } finally { p.kill(); }
});
