// 🎨🔍 Poprawki brył: kolor i gęstość fragmentu (Suweren 2026-10-08: „zacznij od brył — kolor i zagęszczenie fragmentu”).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { przekoloruj, poziomy, oczyscFragment, uproscZFragmentem, wczytajISpawaj, zapiszGlb } from '../services/Siatka3D.js';
import * as Assety3D from '../services/Assety3D.js';

/** Płaska siatka n×n kwadratów w płaszczyźnie XY (z = 0), kolor ciemny z gradientem. */
function plaszczyzna(n = 80) {
    const P = [], C = [], I = [];
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) { P.push(x / n, y / n, 0); C.push(0.004 + 0.16 * (x / n), 0.004 + 0.12 * (y / n), 0.008 + 0.08 * (x / n) * (y / n)); }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = y * (n + 1) + x, b = a + 1, c = a + n + 1, d = c + 1; I.push(a, b, d, a, d, c); }
    return { pozycje: Float32Array.from(P), kolory: Float32Array.from(C), indeksy: Uint32Array.from(I) };
}

test('kolor: zera = bez zmian; jasność rozjaśnia; nasycenie −1 = szarość; auto rozciąga poziomy', () => {
    const k = Float32Array.from([0.02, 0.05, 0.1, 0.2, 0.1, 0.05, 0.001, 0.001, 0.001]);
    const zero = przekoloruj(k, {});
    for (let i = 0; i < k.length; i++) assert.ok(Math.abs(zero[i] - k[i]) < 1e-5);
    assert.ok(poziomy(przekoloruj(k, { jasnosc: 0.5 })).srednia > poziomy(k).srednia);
    const szare = przekoloruj(k, { nasycenie: -1 });
    assert.ok(Math.abs(szare[0] - szare[1]) < 1e-4 && Math.abs(szare[1] - szare[2]) < 1e-4);
    const auto = poziomy(przekoloruj(k, { auto: true }));
    assert.ok(auto.biel > 0.9 && auto.biel > poziomy(k).biel * 2, `biel po auto: ${auto.biel}`);
    const czarny = Float32Array.from([0, 0, 0, 1, 1, 1]);
    assert.deepEqual(Array.from(przekoloruj(czarny, { jasnosc: 1 })).map((x) => +x.toFixed(3)), [0, 0, 0, 1, 1, 1], 'sama gamma nie ruszy czerni');
    const podniesiony = przekoloruj(czarny, { czern: 0.3 });
    assert.ok(podniesiony[0] > 0.05 && Math.abs(podniesiony[3] - 1) < 1e-5, 'podnieś czerń: czerń szarzeje, biel zostaje');
    const obrot = przekoloruj(Float32Array.from([0.5, 0.05, 0.05]), { odcien: 120 });
    assert.ok(obrot[1] > obrot[0], 'czerwień obrócona o 120° idzie w zieleń');
});

test('fragment: pudełko sprawdzone; gęściej w środku, granica zablokowana (bez szczelin)', async () => {
    assert.throws(() => oczyscFragment({ x0: 0, x1: 1 }), /brak y0/);
    assert.throws(() => oczyscFragment({ x0: 0.5, x1: 0.51, y0: 0, y1: 1 }), /za mały/);
    assert.deepEqual(oczyscFragment({ x0: 0.9, x1: 0.1, y0: 0, y1: 1 }), { x0: 0.1, x1: 0.9, y0: 0, y1: 1, z0: 0, z1: 1 });
    const s = plaszczyzna(80);   // 12 800 trójkątów
    const u = await uproscZFragmentem(s, { cel: 3000, fragment: { x0: 0, x1: 1, y0: 0.7, y1: 1 }, scianyFragmentu: 2000 });
    assert.equal(u.fragment.wMasterze, 3840, '30% górnej części = 24 rzędy × 160');
    assert.ok(u.fragment.trojkaty >= 1500 && u.fragment.trojkaty <= 2000, `fragment ${u.fragment.trojkaty}`);
    assert.ok(u.fragment.reszta <= 1200, `reszta ${u.fragment.reszta}`);
    // gęstość: ściany na jednostkę powierzchni — fragment (0,3) wyraźnie gęściej niż reszta (0,7)
    assert.ok(u.fragment.trojkaty / 0.3 > 3 * (u.fragment.reszta / 0.7));
    // każdy wierzchołek granicy (y = 0,7 ± komórka) nadal w użyciu — szew nie zniknął
    const uzyte = new Set(u.indeksy);
    for (let x = 0; x <= 80; x++) assert.ok(uzyte.has(56 * 81 + x), `wierzchołek granicy ${x}`);
    const male = await uproscZFragmentem(s, { cel: 3000, fragment: { x0: 0, x1: 1, y0: 0.7, y1: 1 }, scianyFragmentu: 99999 });
    assert.equal(male.fragment.ograniczony, true, 'prośba ponad master = mówimy wprost');
    // dwa trójkąty w rogach, pudełko pośrodku — pusto
    const rogi = { pozycje: Float32Array.from([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0, 1, 1, 0, 0.9, 1, 0, 1, 0.9, 0]), kolory: null, indeksy: Uint32Array.from([0, 1, 2, 3, 4, 5]) };
    await assert.rejects(uproscZFragmentem(rogi, { cel: 100, fragment: { x0: 0.4, x1: 0.6, y0: 0.4, y1: 0.6 } }), /ani jednej ściany/);
});

let kat;
before(async () => {
    kat = await fs.mkdtemp(path.join(os.tmpdir(), 'bryly-'));
    Assety3D.skonfiguruj({ katalogBiblioteki: kat });
    const dir = path.join(kat, 'kot-ab12');
    await fs.mkdir(dir);
    const s = plaszczyzna(60);
    await zapiszGlb(s, s.indeksy, path.join(dir, 'master.glb'));
    await zapiszGlb(s, s.indeksy, path.join(dir, 'model.glb'));
    // obraz źródłowy: białe tło, ciemny prostokąt 40–160 × 20–220 na 200×240
    execFileSync(ffmpegPath, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=white:s=200x240', '-vf', 'drawbox=x=40:y=20:w=120:h=200:color=0x202030:t=fill', '-frames:v', '1', path.join(dir, 'obraz.png')]);
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify({ id: 'kot-ab12', nazwa: 'kot', opis: 'kot', zrodlo: 'zdjecie', sciany: 4000, rozdzielczosc: 1024, stan: 'gotowe', wGrach: ['gra'], utworzono: '2026-10-08T10:00:00Z' }));
});
after(async () => { await fs.rm(kat, { recursive: true, force: true }); });

test('nowa wersja z kolorem: master przeliczony, stara zostaje, poprawka zapisana; bez zmian = odmowa', async () => {
    await assert.rejects(Assety3D.przekolorujBryle('kot-ab12', {}), /bez zmian/);
    const n = await Assety3D.przekolorujBryle('kot-ab12', { auto: true, jasnosc: 0.3, nasycenie: 9 });
    assert.equal(n.ulepsza, 'kot-ab12');
    assert.deepEqual(n.wGrach, []);
    assert.equal(n.poprawki.length, 1);
    assert.equal(n.poprawki[0].nasycenie, 1, 'suwak obcięty do 1');
    const przed = await wczytajISpawaj(path.join(kat, 'kot-ab12', 'master.glb'));
    const po = await wczytajISpawaj(path.join(kat, n.id, 'master.glb'));
    assert.ok(poziomy(po.kolory).srednia > poziomy(przed.kolory).srednia + 0.1, `${poziomy(przed.kolory).srednia} → ${poziomy(po.kolory).srednia}`);
    assert.ok(n.jasnoscKolorow.biel > 0.9);
    await fs.access(path.join(kat, n.id, 'obraz.png'));
    // kolejna poprawka (fragment) na wersji z kolorem — lista poprawek rośnie, kolor zostaje w masterze
    const f = await Assety3D.zageszczFragment(n.id, { fragment: { x0: 0, x1: 1, y0: 0.6, y1: 1 }, scianyFragmentu: 2000, sciany: 3000 });
    assert.deepEqual(f.poprawki.map((p) => p.rodzaj), ['kolor', 'fragment']);
    assert.equal(f.sciany, 3000);
    assert.ok(f.siatka.fragment.trojkaty > 1500, `fragment ${f.siatka.fragment.trojkaty}`);
    // „Uprość” na tej wersji trzyma fragment
    const u = await Assety3D.uprosc(f.id, 2500);
    assert.ok(u.siatka.fragment, 'uproszczenie zachowuje gęstszy fragment');
});

test('sylwetka z obrazu: ramka ciemnego prostokąta na białym tle (ułamki, y w dół)', async () => {
    const s = await Assety3D.sylwetka('kot-ab12');
    assert.equal(s.pewna, true);
    assert.ok(Math.abs(s.x0 - 0.2) < 0.02 && Math.abs(s.x1 - 0.8) < 0.02, JSON.stringify(s));
    assert.ok(Math.abs(s.y0 - 20 / 240) < 0.02 && Math.abs(s.y1 - 220 / 240) < 0.02, JSON.stringify(s));
});
