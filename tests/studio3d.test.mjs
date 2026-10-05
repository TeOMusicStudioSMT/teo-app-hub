// 🧊 Studio 3D z kadru: siatka z mapy głębi (geometria rzutu), tor głębi → Blender (bez Blendera = błąd wprost),
// pętla ping-pong w PRAWDZIWYM ffmpeg i ożywione ujęcie w Studiu Podcastu (klip zamiast zdjęcia, ruch ciągnięty dalej).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { siatkaZGlebi, utworzGlebie, pngSzary, wymiaryWejscia, tensorObrazu, bajtyGlebi } from '../services/GlebiaKadru.js';
import * as Blender from '../services/Blender.js';
import { utworzStudioPodcastu, argumentyKadru, argumentyWstepu, filtrTla } from '../services/StudioPodcastu.js';
import { opisz } from '../services/Montazownia.js';
import { CZCIONKI } from '../services/PowitanieDnia.js';

const PACZKA = path.resolve('public/studio-podcast');
const czcionka = CZCIONKI.find((p) => fs.existsSync(p));
const tmpDir = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `studio3d-${n}-`));
const czekaj = async (warunek, ms = 180_000) => { const t0 = Date.now(); for (;;) { const w = await warunek(); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 150)); } };

/** Sztuczna głębia: tło daleko (ciemne), prostokąt blisko (jasny). */
function glebiaTestowa(szer = 160, wys = 90) {
    const dane = new Uint8Array(szer * wys);
    for (let y = 0; y < wys; y++) for (let x = 0; x < szer; x++) dane[y * szer + x] = x > 60 && x < 100 && y > 40 && y < 70 ? 240 : 30 + Math.round(60 * (y / wys));
    return { dane, szer, wys };
}

test('siatka z głębi: z miejsca kamery każdy wierzchołek trafia w swój piksel zdjęcia; jasne bliżej niż ciemne', () => {
    const g = glebiaTestowa();
    const s = siatkaZGlebi({ ...g, kolumn: 64, fov: 60, brzeg: 0.1 });
    assert.equal(s.kolumn, 64);
    assert.equal(s.wierszy, Math.round(64 / (160 / 90)));
    assert.equal(s.v.length, (s.kolumn + 1) * (s.wierszy + 1) * 3);
    assert.equal(s.uv.length, (s.kolumn + 1) * (s.wierszy + 1) * 2);
    assert.equal(s.f.length, s.kolumn * s.wierszy * 4, 'czworokąty');
    // rzut perspektywiczny z pozycji kamery (patrzy wzdłuż +Y) odtwarza uv — tak wygląda zdjęcie, zanim kamera ruszy
    const [cx, cy, cz] = s.kamera.poz;
    const tx = Math.tan(Math.PI / 6), ty = tx / (160 / 90);
    for (let k = 0; k < s.v.length / 3; k += 37) {
        const x = s.v[k * 3] - cx, y = s.v[k * 3 + 1] - cy, z = s.v[k * 3 + 2] - cz;
        assert.ok(y > 0, 'siatka przed kamerą');
        const u = 0.5 + x / y / (2 * tx), v = 1 - (0.5 - z / y / (2 * ty));
        assert.ok(Math.abs(u - s.uv[k * 2]) < 2e-3 && Math.abs(v - s.uv[k * 2 + 1]) < 2e-3, `wierzchołek ${k}`);
    }
    // brzeg: siatka wystaje poza zdjęcie (uv poza [0,1]) — ruch kamery nie odsłania czerni
    assert.ok(Math.min(...s.uv) < -0.05 && Math.max(...s.uv) > 1.05);
    // głębia: piksel z prostokąta (jasny) bliżej kamery niż tło (ciemne)
    const odl = (u, w) => { const i = Math.round(((u + 0.1) / 1.2) * s.kolumn), j = Math.round(((w + 0.1) / 1.2) * s.wierszy); return s.v[(j * (s.kolumn + 1) + i) * 3 + 1] - cy; };
    assert.ok(odl(0.5, 0.6) < odl(0.1, 0.1) - 3, `prostokąt ${odl(0.5, 0.6)} vs tło ${odl(0.1, 0.1)}`);
    assert.ok(odl(0.5, 0.6) >= 2.5 - 1e-3 && odl(0.1, 0.1) <= 14 + 1e-3, 'w przedziale blisko–daleko');
    // kamera: CEL w początku układu (orbita Blendera obiega środek planu), kąt węższy niż zdjęcie (16:9 z zapasem)
    assert.deepEqual(s.kamera.cel, [0, 0, 1.6]);
    assert.ok(s.kamera.fov < 60 && s.kamera.fov > 40, `fov ${s.kamera.fov}`);
    assert.throws(() => siatkaZGlebi({ dane: new Uint8Array(4), szer: 10, wys: 10 }), /zły rozmiar/);
    assert.throws(() => siatkaZGlebi({ ...g, blisko: 5, daleko: 2 }), /daleko/);
});

test('siatka z głębi: plamy szumu nie szarpią geometrii (średnia z pola komórki; próbka z punktu dawała skoki ~2×)', () => {
    // gładka rampa + losowe plamy 4×4 px ±80 (stałe ziarno) — tak wygląda drobny szum mapy głębi
    const szer = 640, wys = 360, dane = new Uint8Array(szer * wys);
    let z = 12345;
    const los = () => { z = (z * 1103515245 + 12345) >>> 0; return (z >>> 8) / 16777216; };
    const bloki = Array.from({ length: Math.ceil(wys / 4) * Math.ceil(szer / 4) }, () => Math.round((los() - 0.5) * 160));
    for (let y = 0; y < wys; y++) for (let x = 0; x < szer; x++) dane[y * szer + x] = Math.max(0, Math.min(255, 80 + Math.round(100 * (y / wys)) + bloki[(y >> 2) * Math.ceil(szer / 4) + (x >> 2)]));
    const s = siatkaZGlebi({ dane, szer, wys, kolumn: 64, brzeg: 0 });
    // największy względny skok odległości między sąsiadami w wierszu (próbka z punktu: 2,09; średnia z pola: ~0,52)
    const cy = s.kamera.poz[1];
    let maks = 0;
    for (let j = 5; j < s.wierszy - 5; j += 3) for (let i = 1; i < s.kolumn; i++) {
        const a = s.v[(j * (s.kolumn + 1) + i) * 3 + 1] - cy, b = s.v[(j * (s.kolumn + 1) + i - 1) * 3 + 1] - cy;
        maks = Math.max(maks, Math.abs(a - b) / Math.min(a, b));
    }
    assert.ok(maks < 1, `skok sąsiadów ${maks.toFixed(3)}`);
});

test('scena Blendera z głębią: skrypt czyta siatkę, emisja kadru bez tonowania, znacznik głębi; ruchy łagodniejsze', async () => {
    const tmp = tmpDir('blend');
    const cwd = process.cwd();
    process.chdir(tmp);
    try {
        const siatka = path.join(tmp, 'siatka.json');
        fs.writeFileSync(siatka, JSON.stringify(siatkaZGlebi({ ...glebiaTestowa(), kolumn: 16 })));
        await assert.rejects(Blender.zbudujStudioGlebi({ kadr: path.join(tmp, 'brak.jpg'), siatka }), /Nie widzę kadru/);
        const b = await Blender.zbudujStudioGlebi({ kadr: path.join(PACZKA, 'ujecie-salon.jpg'), siatka, nazwa: 'salon' });
        const py = fs.readFileSync(b.skrypt, 'utf8');
        assert.match(py, /from_pydata/);
        assert.match(py, /ShaderNodeEmission/);
        assert.match(py, /view_transform = 'Standard'/);
        assert.match(py, /scena\["katedra_glebia"\] = 1/);
        assert.match(py, /OTAKOS_BLENDER_SILNIK/);
        assert.ok(!py.includes('`'), 'bez odwrotnych apostrofów w Pythonie z szablonu');
        fs.writeFileSync(b.scena, 'atrapa');
        const u = await Blender.skryptUjecia({ blend: b.scena, ruch: 'orbita', sekundy: 2 });
        const pu = fs.readFileSync(u.skrypt, 'utf8');
        assert.match(pu, /GLEBIA = bool\(scena\.get\("katedra_glebia", 0\)\)/);
        assert.match(pu, /math\.radians\(9 if GLEBIA else 70\)/);
    } finally { process.chdir(cwd); }
});

test('tor głębi: mapa PNG w schowku (drugi raz bez modelu), siatka gotowa, a bez Blendera błąd wprost', async () => {
    const tmp = tmpDir('tor');
    let wolan = 0;
    const G = utworzGlebie({
        katalog: tmp, cacheModeli: path.join(tmp, 'cache'), ffmpeg: ffmpegPath,
        blender: { ...Blender, stanBlendera: async () => ({ jest: false, powod: 'Nie widzę blender.exe.', cozrobic: 'Wskaż OTAKOS_BLENDER.' }) },
        szacuj: async () => { wolan++; return glebiaTestowa(); },
    });
    const kadr = path.join(PACZKA, 'ujecie-plaza.jpg');
    const m = await G.mapaGlebi(kadr);
    assert.ok(fs.existsSync(m.plik) && !m.zSchowka);
    const odczyt = await G.czytajGlebie(m.plik);
    assert.deepEqual([odczyt.szer, odczyt.wys], [160, 90]);
    assert.deepEqual(Array.from(odczyt.dane.slice(0, 50)), Array.from(glebiaTestowa().dane.slice(0, 50)), 'PNG głębi wraca bajt w bajt');
    assert.equal((await G.mapaGlebi(kadr)).zSchowka, true);
    assert.equal(wolan, 1, 'drugi raz ze schowka');
    await assert.rejects(G.mapaGlebi(path.join(tmp, 'x.txt')), /z obrazu/);
    assert.throws(() => G.ozyw({ kadr, ruch: 'salto' }), /Nieznany ruch/);
    let koniec = null;
    const z = G.ozyw({ kadr, ruch: 'najazd', naKoniec: async (e) => { koniec = e; } });
    await G.czekaj(z.id);
    const k = G.zadanie(z.id);
    assert.equal(k.etap, 'błąd');
    assert.match(k.blad, /Głębia i siatka gotowe, ale Nie widzę blender\.exe\. Wskaż OTAKOS_BLENDER\./);
    assert.ok(koniec instanceof Error);
    assert.ok(fs.existsSync(path.join(tmp, 'studia3d', z.id, 'siatka.json')), 'siatka zostaje na dysku');
    assert.equal(fs.readFileSync(m.plik).subarray(1, 4).toString(), 'PNG');
    assert.ok(pngSzary(new Uint8Array([0, 128, 255, 64]), 2, 2).length > 20);
});

test('wejście modelu: krótszy bok 518, wielokrotności 14, długi bok ≤ 1400; normalizacja ImageNet; wyjście → bajty', () => {
    assert.deepEqual(wymiaryWejscia(1920, 1080), { szer: 924, wys: 518 });
    assert.deepEqual(wymiaryWejscia(2048, 1024), { szer: 1036, wys: 518 });
    assert.deepEqual(wymiaryWejscia(1080, 1920), { szer: 518, wys: 924 });
    const w = wymiaryWejscia(6000, 1000);
    assert.ok(w.szer <= 1400 && w.szer % 14 === 0 && w.wys % 14 === 0);
    const t = tensorObrazu(Uint8Array.from([255, 0, 128]), 1, 1);
    assert.ok(Math.abs(t[0] - (1 - 0.485) / 0.229) < 1e-6 && Math.abs(t[1] - (0 - 0.456) / 0.224) < 1e-6, 'kanały osobno (CHW)');
    assert.deepEqual(Array.from(bajtyGlebi(Float32Array.from([2, 4, 6]))), [0, 128, 255]);
    assert.deepEqual(Array.from(bajtyGlebi(Float32Array.from([3, 3]))), [0, 0], 'płaska mapa nie dzieli przez zero');
});

test('PRAWDZIWY tor ONNX (atrapa z kontraktem Depth Anything): ffmpeg skaluje, ONNX Runtime liczy, jasne = blisko; brak modelu i sieci = błąd wprost', async () => {
    const tmp = tmpDir('onnx');
    const kadr = path.join(tmp, 'pol-na-pol.png');
    // lewa połowa biała, prawa czarna
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=white:s=320x180,format=rgb24', '-f', 'lavfi', '-i', 'color=black:s=320x180,format=rgb24', '-filter_complex', '[0][1]hstack', '-frames:v', '1', kadr]);
    const G = utworzGlebie({ katalog: tmp, cacheModeli: path.join(tmp, 'cache'), ffmpeg: ffmpegPath, blender: Blender, plikModelu: path.resolve('tests/fixtures/glebia-atrapa.onnx') });
    const m = await G.mapaGlebi(kadr);
    // 640×180: krótszy bok do 518 dałby 1842 px szerokości — ponad 1400, więc długi bok przycięty do 1400
    assert.deepEqual([m.szer, m.wys], [1400, 392], 'mapa w rozdzielczości wejścia modelu');
    const g = await G.czytajGlebie(m.plik);
    const px = (x, y) => g.dane[y * g.szer + x];
    assert.ok(px(10, 100) > 200 && px(g.szer - 10, 100) < 50, `lewa ${px(10, 100)}, prawa ${px(g.szer - 10, 100)}`);
    assert.equal((await G.stan()).modelNaDysku, true);

    // uszkodzony model: pada PROCES liczenia głębi, nie wołający (most) — błąd mówi kod i stderr
    const zepsuty = path.join(tmp, 'zepsuty.onnx');
    fs.writeFileSync(zepsuty, 'to nie jest model ONNX');
    const Z = utworzGlebie({ katalog: path.join(tmp, 'z'), cacheModeli: tmp, ffmpeg: ffmpegPath, blender: Blender, plikModelu: zepsuty });
    await assert.rejects(Z.mapaGlebi(kadr), /Liczenie głębi \(model .*\) padło — kod 1: .*Most działa dalej\./);

    const B = utworzGlebie({ katalog: tmp, cacheModeli: tmp, ffmpeg: ffmpegPath, blender: Blender, plikModelu: path.join(tmp, 'nie-ma.onnx') });
    await assert.rejects(B.mapaGlebi(path.join(PACZKA, 'ujecie-plaza.jpg')), /OTAKOS_GLEBIA_ONNX/);
    const stary = process.env.HF_ENDPOINT;
    process.env.HF_ENDPOINT = 'http://127.0.0.1:9';
    try {
        const C = utworzGlebie({ katalog: tmp, cacheModeli: path.join(tmp, 'pusty'), ffmpeg: ffmpegPath, blender: Blender, plikModelu: null });
        await assert.rejects(C.mapaGlebi(path.join(PACZKA, 'ujecie-plaza.jpg')), /Nie mogę pobrać modelu głębi.*OTAKOS_GLEBIA_ONNX/);
        assert.ok(!fs.existsSync(path.join(tmp, 'pusty', 'onnx-community_depth-anything-v2-small', 'model.onnx')));
    } finally { if (stary === undefined) delete process.env.HF_ENDPOINT; else process.env.HF_ENDPOINT = stary; }
});

test('PRAWDZIWA pętla ping-pong: klip w przód i wstecz, dwa razy dłuższy, ostatnia klatka = pierwsza', async () => {
    const tmp = tmpDir('pp');
    const wej = path.join(tmp, 'ruch.mp4');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24:duration=1', '-pix_fmt', 'yuv420p', wej]);
    const G = utworzGlebie({ katalog: tmp, cacheModeli: tmp, ffmpeg: ffmpegPath, blender: Blender });
    const wyj = path.join(tmp, 'petla.mp4');
    await G.pingPong(wej, wyj);
    const o = await opisz(wyj);
    assert.ok(o.sekundy > 1.9 && o.sekundy < 2.1, `pętla ${o.sekundy} s`);
    const klatka = (t) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', wyj, '-frames:v', '1', '-vf', 'scale=32:18', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
    const roznica = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
    assert.ok(roznica(klatka(0), klatka(1.95)) < 6, 'koniec pętli wraca do początku');
    assert.ok(roznica(klatka(0), klatka(0.9)) > 6, 'w środku inna klatka');
});

test('tło-klip w argumentach: zapętlony od sekundy, bez najazdu (ruch jest w klipie); zdjęcie bez zmian', () => {
    assert.match(filtrTla(0, { wideo: true }), /^\[0:v\]fps=25,scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720,setsar=1$/);
    const a = argumentyKadru({ tlo: { plik: 't.mp4', ox: 0.5, oy: 0.6, od: 3.25 }, kolor: '#00ff00', imiePlik: 'i.txt', liniePliki: ['l.txt'], czcionka: 'c.ttf', czas: 2, audio: null, wyjscie: 's.mp4' });
    assert.deepEqual(a.slice(1, 9), ['-stream_loop', '-1', '-ss', '3.25', '-t', '2.00', '-i', 't.mp4']);
    assert.ok(!a[a.indexOf('-filter_complex') + 1].includes('zoompan'));
    const b = argumentyKadru({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, kolor: '#00ff00', imiePlik: 'i.txt', liniePliki: ['l.txt'], czcionka: 'c.ttf', czas: 2, audio: null, wyjscie: 's.mp4' });
    assert.deepEqual(b.slice(1, 7), ['-loop', '1', '-framerate', '25', '-t', '2.00']);
    assert.match(b[b.indexOf('-filter_complex') + 1], /zoompan/);
    const w = argumentyWstepu({ ujecia: [{ plik: 'a.mp4', ox: 0.5, oy: 0.6, od: 1 }, { plik: 'b.jpg', ox: 0.5, oy: 0.6 }], czas: 6, kolor: '#22d3ee', nazwaPliki: [{ plik: 'n.txt', duze: true }], imiePlik: 'i.txt', czcionka: 'c.ttf', audio: 'n.mp3', wyjscie: 'w.mp4' });
    assert.ok(w.join(' ').includes('-stream_loop -1 -ss 1.00 -t 3.000 -i a.mp4') && w.join(' ').includes('-loop 1 -framerate 25 -t 3.000 -i b.jpg'));
});

test('PRAWDZIWE ożywione ujęcie w Studiu: robi → gotowy (klip), odcinek gra ruchome tło, nieudany nowy ruch zostawia stary, ↩ wraca do zdjęcia', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const tmp = tmpDir('ozyw');
    const montaz = path.join(tmp, 'montaz');
    fs.mkdirSync(montaz);
    const zadania = new Map();
    let porazka = false;
    const ozyw = ({ kadr, ruch, cel, naKoniec }) => {
        if (!fs.existsSync(kadr)) throw new Error('brak kadru');
        const id = `g_${zadania.size + 1}`;
        zadania.set(id, { id, etap: 'blender: render' });
        setTimeout(async () => {
            if (porazka) { zadania.delete(id); return naKoniec(new Error('Blender padł'), null); }
            fs.mkdirSync(cel, { recursive: true });
            const klip = path.join(cel, `studio3d_${ruch}_${id}.mp4`);
            // „ruch kamery” = przesuwający się wzór testsrc2 (2 s, pętla)
            execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24:duration=2', '-pix_fmt', 'yuv420p', klip]);
            zadania.delete(id);
            await naKoniec(null, { klip, sekundy: 2, glebia: path.join(tmp, 'g.png'), ruch });
        }, 30);
        return { id, etap: 'głębia' };
    };
    const S = utworzStudioPodcastu({
        katalog: path.join(tmp, 'studio'), paczka: PACZKA, ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => montaz,
        aktorzy: async () => [{ id: 'kael', imie: 'Kael', rola: 'Pilot', kolor: '#3b82f6', zdjecie: null, glos: null }],
        chat: async () => ({ tekst: 'TeO: Witajcie.\nKAEL: Cześć.\nTeO: Do zobaczenia.' }),
        ozyw, zadanieOzywienia: (id) => zadania.get(id) ?? null,
    });
    const s0 = await S.studio();
    await assert.rejects(S.ozywUjecie('nie-ma'), /Nie ma takiego ujęcia/);
    const ids = s0.ujecia.map((u) => u.id);
    for (const id of ids) await S.ozywUjecie(id, { ruch: 'orbita' });
    assert.equal((await S.studio()).ujecia[0].ruch.etap, 'robi');
    await assert.rejects(S.ozywUjecie(ids[0]), /już się ożywia/);
    const s1 = await czekaj(async () => { const s = await S.studio(); return s.ujecia.every((u) => u.ruch?.etap === 'gotowy') && s; });
    for (const u of s1.ujecia) assert.ok(fs.existsSync(u.ruch.plik) && u.ruch.ruch === 'orbita' && u.ruch.sekundy === 2);
    assert.equal(await S.plik('ruch', ids[0]), s1.ujecia[0].ruch.plik);

    // odcinek bez głosu: tło się rusza (dwie klatki tej samej kwestii różnią się w rogu kadru, gdzie nie ma napisów)
    const x = await S.przygotuj({ temat: 'Ruch', goscie: ['kael'] });
    await S.nagraj(x.id, { bezGlosu: true, zWstepem: false, zGoscmi: false });
    const g = await czekaj(async () => { const y = await S.odcinek(x.id); return y.etap !== 'nagrywa' && y; });
    assert.equal(g.etap, 'gotowy', g.blad);
    const o = await opisz(g.plik);
    assert.equal(o.szerokosc, 1280);
    const rog = (t) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', g.plik, '-frames:v', '1', '-vf', 'crop=1280:360:0:60,scale=256:72', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
    // odsetek pikseli, które zmieniły się wyraźnie (cienka przekątna wzoru testsrc2 ledwo rusza średnią)
    const r = (a, b) => a.reduce((s, v, i) => s + (Math.abs(v - b[i]) > 40 ? 1 : 0), 0) / a.length;
    assert.ok(r(rog(0.4), rog(1.2)) > 0.01, `tło z klipu się rusza (pas nad napisami): ${r(rog(0.4), rog(1.2))}`);

    // wideo z gośćmi bierze salon — ożywiony, więc tło to klip
    const zg = await S.zrobGosci(x.id, { bezGlosu: true });
    assert.ok(zg.goscieFilm && zg.sekundy >= 4.5, `goście ${zg.sekundy} s`);

    // film wstępowy z MIESZANKĄ: ożywione ujęcia (klipy) + jedno zwykłe zdjęcie — concat musi przyjąć oba rodzaje
    const nagranie = path.join(tmp, 'teo.mp3');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-ac', '2', '-ar', '48000', nagranie]);
    await S.zapiszStudio({ nagranieWstepu: nagranie });
    await S.zdejmijRuch(ids[2]);
    const wst = await S.zrobWstep({ tekst: 'Witajcie w studiu.' });
    const ow = await opisz(wst.plik);
    assert.ok(ow.szerokosc === 1280 && ow.maAudio && ow.sekundy > 4 && ow.sekundy < 5, `wstęp ${ow.sekundy} s`);

    // nowy ruch nie wychodzi → poprzedni klip zostaje i dalej gra
    porazka = true;
    const stary = s1.ujecia[0].ruch.plik;
    await S.ozywUjecie(ids[0], { ruch: 'najazd' });
    const s2 = await czekaj(async () => { const s = await S.studio(); return s.ujecia[0].ruch?.etap !== 'robi' && s; });
    assert.equal(s2.ujecia[0].ruch.etap, 'gotowy');
    assert.equal(s2.ujecia[0].ruch.plik, stary);
    assert.match(s2.ujecia[0].ruch.blad, /Nowy ruch „najazd” nie wyszedł: Blender padł/);

    // ↩ do zdjęcia: klip znika z dysku, ujęcie bez ruchu
    await S.zdejmijRuch(ids[0]);
    const s3 = await S.studio();
    assert.equal(s3.ujecia[0].ruch, undefined);
    assert.ok(!fs.existsSync(stary));

    // zadanie zginęło z mostem (restart) → studio pokazuje „przerwane”, można ponowić
    const plikStudia = path.join(tmp, 'studio', 'studio.json');
    const j = JSON.parse(fs.readFileSync(plikStudia, 'utf8'));
    j.ujecia[1].ruch = { etap: 'robi', ruch: 'dzwig', zadanie: 'g_zgubione' };
    fs.writeFileSync(plikStudia, JSON.stringify(j));
    const s4 = await S.studio();
    assert.equal(s4.ujecia[1].ruch.etap, 'blad');
    assert.match(s4.ujecia[1].ruch.blad, /przerwane/);
});
