// 👄 Usta aktorów: kadr twarzy na karcie, argumenty ffmpeg dla klipu ust, silnik (instalator, schowek, kolejka, błędy)
// i PRAWDZIWY odcinek Studia Podcastu z kartą mówiącego z klipu ust (atrapa MuseTalk, prawdziwy ffmpeg).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { utworzUsta, COMMIT_MUSETALK, SKRYPT_USTA, SKRYPT_POBIERZ } from '../services/UstaAktorow.js';
import { utworzStudioPodcastu, argumentyKadru, kadrTwarzy } from '../services/StudioPodcastu.js';
import { opisz } from '../services/Montazownia.js';
import { CZCIONKI } from '../services/PowitanieDnia.js';

const PACZKA = path.resolve('public/studio-podcast');
const czcionka = CZCIONKI.find((p) => fs.existsSync(p));
const tmpDir = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `usta-${n}-`));
const czekaj = async (warunek, ms = 180_000) => { const t0 = Date.now(); for (;;) { const w = await warunek(); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 150)); } };

/** Katalog „zainstalowanych” ust: python, kod z commitem, pliki wag (puste — atrapa skryptu ich nie czyta). */
function zainstalowane(kat) {
    fs.mkdirSync(path.join(kat, 'venv', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(kat, 'venv', 'bin', 'python'), '');
    fs.mkdirSync(path.join(kat, 'MuseTalk'), { recursive: true });
    fs.writeFileSync(path.join(kat, 'MuseTalk', '.commit'), COMMIT_MUSETALK);
    for (const p of ['musetalkV15/unet.pth', 'musetalkV15/musetalk.json', 'sd-vae/config.json', 'whisper/config.json', 'whisper/preprocessor_config.json']) {
        fs.mkdirSync(path.dirname(path.join(kat, 'modele', p)), { recursive: true });
        fs.writeFileSync(path.join(kat, 'modele', p), '{}');
    }
}

test('kadr twarzy na karcie: proporcja karty 360:420, parzyste wymiary, w granicach klatki, twarz w środku', () => {
    for (const [twarz, szer, wys] of [[[210, 201, 325, 326], 572, 1024], [[0, 0, 100, 120], 640, 360], [[500, 300, 600, 420], 640, 480], [[10, 10, 30, 30], 4000, 3000]]) {
        const k = kadrTwarzy(twarz, szer, wys);
        assert.ok(k.w % 2 === 0 && k.h % 2 === 0, 'parzyste');
        assert.ok(k.x >= 0 && k.y >= 0 && k.x + k.w <= szer && k.y + k.h <= wys, `w klatce ${JSON.stringify(k)}`);
        assert.ok(Math.abs(k.w / k.h - 360 / 420) < 0.02, `proporcja ${k.w / k.h}`);
        const cx = (twarz[0] + twarz[2]) / 2, cy = (twarz[1] + twarz[3]) / 2;
        assert.ok(cx >= k.x && cx <= k.x + k.w && cy >= k.y && cy <= k.y + k.h, 'twarz na karcie');
    }
    const k = kadrTwarzy([210, 201, 325, 326], 572, 1024);
    assert.ok(k.h < 1024 * 0.5, 'na zdjęciu całej postaci karta to głowa i ramiona, nie cała postać');
});

test('argumenty kadru z klipem ust: karta gra RAZ (bez pętli), trzyma ostatnią klatkę, wycięcie głowy; zwykła karta bez zmian', () => {
    const a = argumentyKadru({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, karta: 'u-001.mp4', kartaUsta: true, kadrKarty: { x: 10, y: 20, w: 300, h: 350 }, kolor: '#ff0000', imiePlik: 'i.txt', liniePliki: ['l.txt'], czcionka: 'c.ttf', czas: 3, audio: 'a.wav', wyjscie: 's.mp4' });
    const j = a.join(' ');
    assert.ok(j.includes('-i u-001.mp4') && !j.includes('-stream_loop -1 -t 3.00 -i u-001.mp4'), 'klip ust bez pętli');
    const f = a[a.indexOf('-filter_complex') + 1];
    assert.match(f, /\[1:v\]tpad=stop_mode=clone:stop_duration=3\.00,crop=300:350:10:20,fps=25,scale=360:420/);
    const b = argumentyKadru({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, karta: 'k.mp4', kolor: '#ff0000', imiePlik: 'i.txt', liniePliki: ['l.txt'], czcionka: 'c.ttf', czas: 3, audio: 'a.wav', wyjscie: 's.mp4' });
    assert.ok(b.join(' ').includes('-stream_loop -1 -t 3.00 -i k.mp4'), 'klip aktora (nie usta) nadal w pętli');
    assert.match(b[b.indexOf('-filter_complex') + 1], /\[1:v\]fps=25,scale=360:420/);
});

test('silnik ust: stan bez instalacji mówi co zrobić; schowek; jedno naraz; błąd z kodem i sednem stderr', async () => {
    const tmp = tmpDir('silnik');
    const pusty = utworzUsta({ aiDir: tmp, katalog: path.join(tmp, 'brak'), ffmpeg: ffmpegPath });
    assert.equal(pusty.stan().gotowy, false);
    assert.match(pusty.stan().powod, /Zainstaluj usta aktorów/);
    await assert.rejects(pusty.mow({ zrodlo: path.join(PACZKA, 'prowadzacy.jpg'), audio: 'x.wav' }), /nie zainstalowane/);

    const kat = path.join(tmp, 'usta');
    zainstalowane(kat);
    const audio = path.join(tmp, 'k.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', audio]);
    let rownoczesnie = 0, maks = 0, wywolan = 0;
    const skrypt = async (py, argi, { env }) => {
        assert.equal(argi[0], SKRYPT_USTA);
        assert.equal(env.HF_HUB_OFFLINE, '1', 'generowanie bez sieci — wagi są już na dysku');
        const a = JSON.parse(argi[1]);
        assert.equal(a.repo, path.join(kat, 'MuseTalk'));
        if (a.zrodlo.endsWith('ujecie-plaza.jpg')) { const e = new Error('Command failed'); e.code = 1; e.stderr = 'Traceback (most recent call last):\n  File "usta.py"\nValueError: nie znalazłem twarzy na karcie aktora'; throw e; }
        wywolan++; rownoczesnie++; maks = Math.max(maks, rownoczesnie);
        await new Promise((r) => setTimeout(r, 40));
        fs.writeFileSync(a.wyjscie, 'mp4');
        rownoczesnie--;
        return 'log\n{"klatek": 25, "sekundy": 1.0, "urzadzenie": "cpu", "twarz": [1, 2, 3, 4], "szer": 10, "wys": 20, "wykrywacz": "yunet"}\n';
    };
    const U = utworzUsta({ aiDir: tmp, katalog: kat, ffmpeg: ffmpegPath, skrypt });
    assert.equal(U.stan().gotowy, true);
    const zdj = path.join(PACZKA, 'prowadzacy.jpg');
    const [a, b] = await Promise.all([U.mow({ zrodlo: zdj, audio }), U.mow({ zrodlo: zdj, audio, przesuniecie: 3 })]);
    assert.equal(maks, 1, 'jedno generowanie naraz (GPU)');
    assert.ok(fs.existsSync(a.plik) && a.plik !== b.plik, 'inne ustawienia = inny klip');
    assert.deepEqual(a.twarz, [1, 2, 3, 4]);
    const c = await U.mow({ zrodlo: zdj, audio });
    assert.equal(c.zSchowka, true);
    assert.equal(wywolan, 2, 'trzecie ze schowka');
    await assert.rejects(U.mow({ zrodlo: path.join(PACZKA, 'ujecie-plaza.jpg'), audio }), /Usta \(MuseTalk\) padły — kod 1: ValueError: nie znalazłem twarzy/);
    await assert.rejects(U.mow({ zrodlo: path.join(tmp, 'nie-ma.jpg'), audio }), /brak pliku \(karta aktora\)/);
});

test('instalator ust: Python 3.10–3.12 → venv → torch + torchvision pod sterownik → zależności → pobierz.py (commit) → gotowe', async () => {
    const tmp = tmpDir('inst');
    const kat = path.join(tmp, 'usta');
    const kroki = [];
    const uruchom = async (pol, argi, { naLinie }) => {
        kroki.push([path.basename(pol), ...argi].join(' '));
        if (argi.includes('-c') && argi.join(' ').includes('sys.version_info')) { naLinie('3 12'); return 0; }
        if (pol === 'nvidia-smi') { naLinie('| NVIDIA-SMI 560.94   Driver Version: 560.94   CUDA Version: 12.6 |'); return 0; }
        if (argi[0] === '-m' && argi[1] === 'venv') { fs.mkdirSync(path.join(argi[2], 'bin'), { recursive: true }); fs.writeFileSync(path.join(argi[2], 'bin', 'python'), ''); return 0; }
        if (argi[0] === SKRYPT_POBIERZ) { assert.equal(JSON.parse(argi[1]).commit, COMMIT_MUSETALK); zainstalowane(kat); return 0; }
        if (argi[0] === '-c') { naLinie('2.5.1+cu124 True'); return 0; }
        return 0;
    };
    const U = utworzUsta({ aiDir: tmp, katalog: kat, ffmpeg: ffmpegPath, uruchom, log: () => {} });
    U.instaluj();
    assert.throws(() => U.instaluj(), /już trwa/);
    const s = await czekaj(async () => { const x = U.stan(); return x.instalacja.stan !== 'trwa' && x; });
    assert.equal(s.instalacja.stan, 'gotowe', s.instalacja.blad);
    assert.equal(s.gotowy, true);
    assert.equal(s.instalacja.cuda, true);
    const torch = kroki.find((k) => k.includes('pip install torch'));
    assert.match(torch, /torch torchvision --index-url https:\/\/download\.pytorch\.org\/whl\/cu1\d\d/, 'torchvision razem z torch (MuseTalk go importuje)');
    assert.ok(kroki.some((k) => k.includes('requirements-usta.txt')));
    assert.ok(kroki.findIndex((k) => k.includes('pobierz.py')) > kroki.findIndex((k) => k.includes('requirements-usta.txt')));
    const req = fs.readFileSync(path.resolve('services/usta/requirements-usta.txt'), 'utf8');
    assert.ok(!/^\s*mmcv|^\s*mmpose|^\s*tensorflow/m.test(req), 'bez mmcv/mmpose/tensorflow');
    const pob = fs.readFileSync(SKRYPT_POBIERZ, 'utf8');
    assert.ok(!/hf\(.*face-parse|79999_iter/.test(pob), 'parser twarzy CelebAMask-HQ (tylko niekomercyjny) nie jest pobierany');
});

test('PRAWDZIWY odcinek z ustami: karta mówiącego z klipu ust (atrapa MuseTalk), porażka jednej kwestii = karta bez ruchu + uwaga', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const tmp = tmpDir('odc');
    const montaz = path.join(tmp, 'montaz');
    fs.mkdirSync(montaz);
    const glosWav = path.join(tmp, 'glos.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', '-ar', '22050', '-ac', '1', glosWav]);
    const wolania = [];
    const usta = async ({ zrodlo, audio }) => {
        wolania.push(path.basename(zrodlo));
        assert.ok(fs.existsSync(audio), 'usta dostają prawdziwy plik kwestii');
        if (wolania.length === 2) throw new Error('Usta (MuseTalk) padły — kod 1: ValueError: nie znalazłem twarzy');
        const plik = path.join(tmp, `usta-${wolania.length}.mp4`);
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=572x1024:rate=25:duration=1.2', '-pix_fmt', 'yuv420p', plik]);
        return { plik, twarz: [210, 201, 325, 326], szer: 572, wys: 1024, sekundy: 1.2 };
    };
    const S = utworzStudioPodcastu({
        katalog: path.join(tmp, 'studio'), paczka: PACZKA, ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => montaz,
        aktorzy: async () => [{ id: 'kael', imie: 'Kael', rola: 'Pilot', kolor: '#3b82f6', zdjecie: path.join(PACZKA, 'prowadzacy.jpg'), glos: null }],
        chat: async () => ({ tekst: 'TeO: Witajcie.\nKAEL: Cześć, jestem Kael.\nTeO: Do zobaczenia.' }),
        mow: async () => ({ audio: fs.readFileSync(glosWav), ext: 'wav' }),
        usta,
    });
    const x = await S.przygotuj({ temat: 'Usta', goscie: ['kael'] });
    await assert.rejects(S.nagraj(x.id, { bezGlosu: true, usta: true }), /bez głosu/);
    await S.nagraj(x.id, { zWstepem: false, zGoscmi: false, usta: true });
    const g = await czekaj(async () => { const y = await S.odcinek(x.id); return y.etap !== 'nagrywa' && y; });
    assert.equal(g.etap, 'gotowy', g.blad);
    // prowadzący ma zdjęcie z paczki, Kael też — trzy kwestie, trzy wywołania ust, jedno padło
    assert.equal(wolania.length, 3);
    assert.equal(g.usta.ok, 2);
    assert.equal(g.usta.bledy.length, 1);
    assert.match(g.usta.bledy[0], /^Kael \(kwestia 2\): Usta \(MuseTalk\) padły/);
    const o = await opisz(g.plik);
    assert.equal(o.szerokosc, 1280);
    assert.ok(o.maAudio && o.sekundy > 4 && o.sekundy < 6, `odcinek ${o.sekundy} s`);
    // karta w prawym górnym rogu się rusza (klip ust), a nie stoi jak zdjęcie
    const karta = (t) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', g.plik, '-frames:v', '1', '-vf', 'crop=360:420:864:53,scale=90:105', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
    const r = (a, b) => a.reduce((s, v, i) => s + (Math.abs(v - b[i]) > 30 ? 1 : 0), 0) / a.length;
    assert.ok(r(karta(0.3), karta(1.0)) > 0.02, 'karta z klipu ust zmienia się w czasie kwestii');
});
