// 🎬 Filmy gry: GDD trzyma cutscenki przy zdarzeniach, propozycje Reżysera nie gubią stanu, zlecenie → Wan (atrapa)
// → plik w public/filmy gry + filmy.json; błąd = stan „blad” z powodem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Gdd, { oczyscFilmy, scalFilmy, ZDARZENIA_GRY } from '../services/Gdd.js';
import { utworzFilmyGry, promptFilmu } from '../services/FilmyGry.js';

test('oczyscFilmy / scalFilmy: zdarzenia z listy, sekundy 2–20, stan zostaje przy propozycji', () => {
    const f = oczyscFilmy([{ zdarzenie: 'wybuch', tytul: 'Intro', opis: 'Wyspa z lotu ptaka', sekundy: 30 }, { opis: '' }, { tytul: 'Strażnik pada', zdarzenie: 'straznik' }]);
    assert.equal(f.length, 2);
    assert.deepEqual([f[0].zdarzenie, f[0].sekundy, f[0].stan], ['start', 20, 'pomysl']);
    assert.ok(ZDARZENIA_GRY[f[1].zdarzenie]);
    const gotowy = [{ ...f[0], stan: 'gotowy', plik: 'filmy/x.mp4' }, f[1]];
    const s = scalFilmy(gotowy, [{ id: f[0].id, opis: 'Wyspa o świcie', stan: 'pomysl' }, { tytul: 'Turniej', zdarzenie: 'turniej', opis: 'Mini skacze' }]);
    assert.deepEqual([s[0].opis, s[0].stan, s[0].plik], ['Wyspa o świcie', 'gotowy', 'filmy/x.mp4'], 'propozycja zmienia treść, nie stan');
    assert.equal(s.length, 3);
    assert.equal(s[2].zdarzenie, 'turniej');
});

test('zlecenie filmu: prompt z modelu → Wan → plik w grze + manifest; błąd ComfyUI → stan blad', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'filmy-'));
    try {
        await fs.mkdir(path.join(kat, 'gra', 'dist'), { recursive: true });
        Gdd.skonfiguruj({ katalog: kat });
        await Gdd.zapisz('gra', { tytul: 'Teterhia', gatunek: 'RPG', filmy: [{ tytul: 'Intro', zdarzenie: 'start', opis: 'Kamera opada na wyspę o świcie', sekundy: 4, silnik: 'wan' }, { tytul: 'Strażnik', zdarzenie: 'straznik', opis: 'Strażnik oddaje Nutę', prompt: 'A stone guardian kneels', silnik: 'wan' }] });
        const [intro, straznik] = (await Gdd.wczytaj('gra')).filmy;
        const wan = path.join(kat, 'wan.mp4');
        await fs.writeFile(wan, 'mp4');
        const zlecone = [];
        let odczyt = 0;
        const F = utworzFilmyGry({
            katalogGier: kat, gdd: { wczytaj: (id) => Gdd.wczytaj(id), zapisz: (id, g) => Gdd.zapisz(id, g) }, coMs: 1,
            pisz: async (o) => { assert.match(o.prompt, /Game: Teterhia[\s\S]*Kamera opada na wyspę/); return '"Camera descends onto a misty island at dawn, soft light."'; },
            generuj: async (o) => { zlecone.push(o); return o.prompt.includes('guardian') ? { ok: false, powod: 'Brak modelu Wan w ComfyUI' } : { ok: true, zlecenie: 'z1' }; },
            stan: async () => (odczyt++ ? { ok: true, gotowe: true, materialy: [{ nazwa: 'wan.mp4', sciezka: wan }] } : { ok: true, gotowe: false, wToku: true }),
        });
        const f0 = await F.zlec('gra', intro.id);
        assert.equal(f0.stan, 'zlecony');
        await F.zlec('gra', straznik.id);
        for (let i = 0; i < 300 && F.liczy().length; i++) await new Promise((r) => setTimeout(r, 5));
        const filmy = (await Gdd.wczytaj('gra')).filmy;
        assert.deepEqual([filmy[0].stan, filmy[0].plik, filmy[0].prompt], ['gotowy', `filmy/${intro.id}.mp4`, 'Camera descends onto a misty island at dawn, soft light.']);
        assert.deepEqual([filmy[1].stan, filmy[1].blad], ['blad', 'Brak modelu Wan w ComfyUI']);
        assert.deepEqual(zlecone.map((z) => z.sekundy), [4, 4]);
        assert.equal(await fs.readFile(path.join(kat, 'gra', 'public', 'filmy', `${intro.id}.mp4`), 'utf8'), 'mp4');
        const m = JSON.parse(await fs.readFile(path.join(kat, 'gra', 'public', 'filmy', 'filmy.json'), 'utf8'));
        assert.deepEqual(m.filmy, [{ id: intro.id, zdarzenie: 'start', tytul: 'Intro', plik: `filmy/${intro.id}.mp4` }]);
        assert.equal(await fs.readFile(path.join(kat, 'gra', 'dist', 'filmy', `${intro.id}.mp4`), 'utf8'), 'mp4', 'zbudowana gra dostaje film od razu');
        assert.ok(JSON.parse(await fs.readFile(path.join(kat, 'gra', 'dist', 'filmy', 'filmy.json'), 'utf8')).filmy.length === 1);
        await assert.rejects(F.zlec('gra', 'fm-nieznany'), /Nie ma takiego filmu/);
        assert.equal(await promptFilmu({ prompt: 'gotowy', opis: 'x' }, {}, null), 'gotowy');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('🎥 Reżyser Wideo: obsada gry → kadr FLUX z wzorami → Wan z kadru startowego / FLUX z ruchem kamery', async () => {
    const { odczytajUjecie, filtrRuchuKadru, promptRezyseraWideo } = await import('../services/FilmyGry.js');
    const obsada = [{ id: 'katedra', imie: 'Kot Tancerz', opis: 'kremowy kocur w pomarańczowej koszulce', obraz: '/x/kot.png' }, { id: 'b:mira', imie: 'Mira', opis: 'Opiekunka Gaju', obraz: '/x/mira.png' }];
    assert.throws(() => odczytajUjecie('bez json', obsada), /nie dał kadru/);
    const u = odczytajUjecie('<think>…</think>```json\n{"kadr":"Kot Tancerz dancing on a mossy stone circle at dusk, Mira watching","ruch":"the cat spins, camera slowly pushes in","kamera":"odjazd","postacie":["katedra","nieznany","b:mira"]}\n```', obsada);
    assert.deepEqual([u.kamera, u.postacie], ['odjazd', ['katedra', 'b:mira']], 'tylko id z obsady');
    assert.match(filtrRuchuKadru('w-lewo', 3), /zoompan=z='1.18':x='\(iw-iw\/zoom\)\*\(1-on\/72\)'.*d=72:s=1280x720:fps=24/);
    assert.match(promptRezyseraWideo({ tytul: 'Intro', zdarzenie: 'start', sekundy: 4, opis: 'taniec', postacie: ['katedra'] }, { tytul: 'Teterhia', sekcje: { wizual: 'malowana fantastyka' } }, obsada), /VISUAL STYLE \(Polish\): malowana fantastyka[\s\S]*katedra — Kot Tancerz[\s\S]*use exactly them/);

    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'filmy2-'));
    try {
        await fs.mkdir(path.join(kat, 'gra'), { recursive: true });
        Gdd.skonfiguruj({ katalog: kat });
        await Gdd.zapisz('gra', { tytul: 'Teterhia', sekcje: { wizual: 'malowana fantastyka' }, filmy: [{ tytul: 'Intro', zdarzenie: 'start', opis: 'Kot tańczy', sekundy: 3, silnik: 'flux-wan' }, { tytul: 'Domyslny', zdarzenie: 'poziom', opis: 'x', sekundy: 2 }, { tytul: 'Taniec', zdarzenie: 'taniec', opis: 'Kot kłania się', sekundy: 2, silnik: 'flux', postacie: ['katedra'], ruch: 'najazd' }] });
        const [intro, domyslny, taniec] = (await Gdd.wczytaj('gra')).filmy;
        assert.equal(domyslny.silnik, 'flux', 'domyślnie FLUX + ruch kamery (Suweren 2026-10-13: „Wan 2.2 zmień na Flux”)');
        assert.equal(intro.silnik, 'flux-wan', 'Wan zostaje opcją');
        const kadrPng = path.join(kat, 'kadr.png'), wan = path.join(kat, 'wan.mp4');
        await fs.writeFile(kadrPng, 'png'); await fs.writeFile(wan, 'mp4');
        const wolania = [];
        const F = utworzFilmyGry({
            katalogGier: kat, gdd: { wczytaj: (id) => Gdd.wczytaj(id), zapisz: (id, g) => Gdd.zapisz(id, g) }, coMs: 1,
            pisz: async () => '{"kadr":"Kot Tancerz dancing in a clearing of Teterhia, painted fantasy style","ruch":"the cat spins","kamera":"odjazd","postacie":["b:mira"]}',
            obsada: async () => obsada,
            kadr: async (o) => { wolania.push(['kadr', o.referencje]); return kadrPng; },
            wgraj: async () => 'kadr-abc.png',
            generuj: async (o) => { wolania.push(['wan', o.obrazStartowy, o.prompt]); return { ok: true, zlecenie: 'z9' }; },
            stan: async () => ({ ok: true, gotowe: true, materialy: [{ nazwa: 'wan.mp4', sciezka: wan }] }),
            ruchKadru: async (o) => { wolania.push(['ruch', o.filtr.slice(0, 40)]); await fs.writeFile(o.wyjscie, 'ruch'); },
        });
        await F.zlec('gra', intro.id);
        await F.zlec('gra', taniec.id);
        for (let i = 0; i < 300 && F.liczy().length; i++) await new Promise((r) => setTimeout(r, 5));
        const po = (await Gdd.wczytaj('gra')).filmy; const i2 = po.find((f) => f.id === intro.id), t2 = po.find((f) => f.id === taniec.id);
        assert.deepEqual([i2.stan, i2.silnikUzyty, i2.kadr, i2.ruch, i2.obsadaUzyta.map((o) => o.id)], ['gotowy', 'flux-wan', `filmy/${intro.id}-kadr.png`, 'odjazd', ['b:mira']], i2.blad);
        assert.deepEqual(wolania[0], ['kadr', ['/x/mira.png']]);
        assert.deepEqual(wolania[1].slice(0, 2), ['wan', 'kadr-abc.png'], 'Wan startuje z kadru FLUX');
        assert.deepEqual([t2.stan, t2.silnikUzyty, t2.ruch, t2.obsadaUzyta.map((o) => o.id)], ['gotowy', 'flux', 'najazd', ['katedra']], 'obsada i ruch Suwerena wygrywają z Reżyserem');
        assert.equal(wolania[3][0], 'ruch');
        assert.equal(await fs.readFile(path.join(kat, 'gra', 'public', 'filmy', `${taniec.id}.mp4`), 'utf8'), 'ruch');
        assert.equal(await fs.readFile(path.join(kat, 'gra', 'public', 'filmy', `${intro.id}-kadr.png`), 'utf8'), 'png');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

// 🎞️ Dłuższe filmy i 🎵 dźwięk od Joanny — prawdziwy ffmpeg (ujęcia z testsrc, muzyka = sinus), atrapy ComfyUI i modeli.
test('plan ujęć: Reżyser Wideo daje listę, brakujące dopełnia innym ruchem kamery, stary JSON = jedno ujęcie', async () => {
    const { odczytajUjecie, ileUjec, filtrSklejenia } = await import('../services/FilmyGry.js');
    assert.deepEqual([2, 5, 6, 12, 20].map(ileUjec), [1, 1, 2, 3, 4]);
    const u = odczytajUjecie('{"ujecia":[{"kadr":"A wide misty island at dawn, painted fantasy style","ruch":"birds fly","kamera":"odjazd"},{"kadr":"","ruch":"the cat lands","kamera":"zly"}],"postacie":[]}', [], 3);
    assert.equal(u.ujecia.length, 3);
    assert.deepEqual(u.ujecia.map((x) => x.kamera), ['odjazd', 'najazd', 'w-lewo'], 'zły ruch → najazd, dopełnienie → nieużyty ruch');
    assert.equal(u.ujecia[1].kadr, u.ujecia[0].kadr, 'ujęcie bez kadru bierze poprzedni');
    assert.equal(odczytajUjecie('{"kadr":"Kot Tancerz dancing on a stone circle","kamera":"w-gore"}', [], 1).ujecia.length, 1);
    assert.match(filtrSklejenia([4, 4, 4], 0.5), /xfade=transition=fade:duration=0.5:offset=3.500\[x1\];\[x1\]\[v2\]xfade=transition=fade:duration=0.5:offset=7.000\[out\]/);
    assert.match(filtrSklejenia([4, 4], 0), /\[v0\]\[v1\]concat=n=2:v=1:a=0\[out\]/);
});

test('🎞️🎵 film 12 s Wan = 3 ujęcia od ostatniej klatki + sklejka; flux 9 s = 2 kadry z przenikaniem + muzyka Joanny w mp4', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const ffmpegPath = (await import('ffmpeg-static')).default;
    const { dlugoscPliku } = await import('../services/FilmyGry.js');
    const ff = (args) => promisify(execFile)(ffmpegPath, ['-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 24 });
    const maDzwiek = async (plik) => /Audio:/.test(String((await promisify(execFile)(ffmpegPath, ['-hide_banner', '-i', plik]).catch((e) => e)).stderr));

    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'filmy3-'));
    try {
        await fs.mkdir(path.join(kat, 'gra', 'dist'), { recursive: true });
        // ujęcia „z Wan” (po 4 s, 320x192@24), kadr „z FLUX”, muzyka „z ACE-Step” (12 s sinus)
        const ujecia = [];
        for (let i = 0; i < 3; i++) { const p = path.join(kat, `wan${i}.mp4`); await ff(['-f', 'lavfi', '-i', 'testsrc=size=320x192:rate=24:duration=4', '-pix_fmt', 'yuv420p', p]); ujecia.push(p); }
        const kadrPng = path.join(kat, 'kadr.png');
        await ff(['-f', 'lavfi', '-i', 'testsrc=size=640x360:duration=1', '-frames:v', '1', kadrPng]);
        const muzyka = path.join(kat, 'ace.flac');
        await ff(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=12', muzyka]);

        Gdd.skonfiguruj({ katalog: kat });
        await Gdd.zapisz('gra', { tytul: 'Teterhia', sekcje: { wizual: 'malowana fantastyka' }, filmy: [
            { tytul: 'Intro', zdarzenie: 'start', opis: 'Kamera opada na wyspę', sekundy: 12, silnik: 'wan', prompt: 'Camera descends onto a misty island' },
            { tytul: 'Taniec', zdarzenie: 'taniec', opis: 'Kot tańczy w kręgu', sekundy: 9, silnik: 'flux', dzwiek: true },
            { tytul: 'Nuta', zdarzenie: 'nuta', opis: 'Nuta świeci', sekundy: 3, silnik: 'flux', dzwiek: true },
        ] });
        const [intro, taniec, nuta] = (await Gdd.wczytaj('gra')).filmy;
        assert.equal(taniec.dzwiek, true);
        const wolania = [];
        let nrZlecenia = 0;
        const F = utworzFilmyGry({
            katalogGier: kat, gdd: { wczytaj: (id) => Gdd.wczytaj(id), zapisz: (id, g) => Gdd.zapisz(id, g) }, coMs: 1, roboczy: path.join(kat, 'robocze'),
            pisz: async (o) => {
                if (/SHOTS: 3/.test(o.prompt)) return '{"ujecia":[{"kadr":"Misty island from above, painted fantasy","ruch":"clouds part","kamera":"najazd"},{"ruch":"the camera glides over the forest","kamera":"w-lewo"},{"ruch":"the camera lands on the shore","kamera":"staly"}]}';
                return '{"ujecia":[{"kadr":"Kot Tancerz dancing in a stone circle, painted fantasy","ruch":"spin","kamera":"najazd"},{"kadr":"Close-up of the cat bowing under lanterns, painted fantasy","ruch":"bow","kamera":"odjazd"}]}';
            },
            generuj: async (o) => { wolania.push(['generuj', o.sekundy]); return { ok: true, zlecenie: `z${nrZlecenia++}` }; },
            dopisz: async (o) => { wolania.push(['dopisz', path.basename(o.plik), o.sekundy, o.prompt]); return { ok: true, zlecenie: `z${nrZlecenia++}` }; },
            stan: async (z) => ({ ok: true, gotowe: true, materialy: [{ nazwa: 'x.mp4', sciezka: ujecia[Number(z.slice(1))] }] }),
            kadr: async (o) => { wolania.push(['kadr', o.prompt.slice(0, 12)]); return kadrPng; },
            ruchKadru: async ({ kadr, wyjscie, filtr, sekundy }) => { await ff(['-loop', '1', '-i', kadr, '-vf', filtr.replace(/2560/g, '640').replace(/1440/g, '384').replace(/1280/g, '320').replace(/720/g, '192'), '-t', String(sekundy), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', wyjscie]); },
            joanna: async (o) => { assert.match(o.prompt, /Kot tańczy w kręgu|Nuta świeci/); assert.match(o.prompt, /STYL OBRAZU: malowana fantastyka/); return '{"tagi":"cinematic fantasy, harp, soft strings, slow, warm","unikaj":"vocals","dlaczego":"bo taniec"}'; },
            komponuj: async (o) => { wolania.push(['komponuj', o.sekundy]); if (wolania.filter((w) => w[0] === 'komponuj').length > 1) throw new Error('ACE-Step śpi'); return muzyka; },
        });
        await F.zlec('gra', intro.id);
        await F.zlec('gra', taniec.id);
        await F.zlec('gra', nuta.id);
        for (let i = 0; i < 2000 && F.liczy().length; i++) await new Promise((r) => setTimeout(r, 20));
        const [i2, t2, n2] = (await Gdd.wczytaj('gra')).filmy;

        assert.deepEqual([i2.stan, i2.plik, i2.ujecia.map((u) => u.kamera)], ['gotowy', `filmy/${intro.id}.mp4`, ['najazd', 'w-lewo', 'staly']], i2.blad);
        const wan = wolania.filter((w) => w[0] === 'generuj' || w[0] === 'dopisz');
        assert.deepEqual(wan.map((w) => w.slice(0, 3)), [['generuj', 4], ['dopisz', 'wan0.mp4', 4], ['dopisz', 'wan1.mp4', 4]], 'każde ujęcie od poprzedniego');
        assert.match(wan[2][3], /lands on the shore Camera: staly\./);
        const dlIntro = await dlugoscPliku(path.join(kat, 'gra', 'public', 'filmy', `${intro.id}.mp4`));
        assert.ok(Math.abs(dlIntro - 12) < 0.3, `intro ma ~12 s (jest ${dlIntro})`);
        assert.equal(await maDzwiek(path.join(kat, 'gra', 'public', 'filmy', `${intro.id}.mp4`)), false);

        assert.deepEqual([t2.stan, t2.maDzwiek, t2.muzykaBrief, t2.dzwiekBlad], ['gotowy', true, 'cinematic fantasy, harp, soft strings, slow, warm', null], t2.blad ?? t2.dzwiekBlad);
        assert.equal(wolania.filter((w) => w[0] === 'kadr').length, 3, 'taniec: 2 kadry, nuta: 1');
        const plikT = path.join(kat, 'gra', 'dist', 'filmy', `${taniec.id}.mp4`);
        const dlT = await dlugoscPliku(plikT);
        assert.ok(Math.abs(dlT - 9) < 0.3, `taniec ma ~9 s mimo przenikania (jest ${dlT})`);
        assert.equal(await maDzwiek(plikT), true, 'muzyka Joanny w mp4 (dist)');
        assert.deepEqual(wolania.find((w) => w[0] === 'komponuj'), ['komponuj', 9]);

        assert.deepEqual([n2.stan, n2.maDzwiek, n2.dzwiekBlad], ['gotowy', false, 'ACE-Step śpi'], 'dźwięk padł = niemy film zostaje');
        const m = JSON.parse(await fs.readFile(path.join(kat, 'gra', 'public', 'filmy', 'filmy.json'), 'utf8'));
        assert.deepEqual(m.filmy.map((f) => [f.id, !!f.dzwiek]), [[intro.id, false], [taniec.id, true], [nuta.id, false]]);
        assert.deepEqual(await fs.readdir(path.join(kat, 'robocze')), [], 'katalog roboczy posprzątany');

        // bez dopisywania Wan film > 5 s odmawia od razu; bez Joanny — film z dźwiękiem też
        const bez = utworzFilmyGry({ katalogGier: kat, gdd: { wczytaj: (id) => Gdd.wczytaj(id), zapisz: (id, g) => Gdd.zapisz(id, g) }, generuj: async () => ({ ok: true }), stan: async () => ({ ok: true }), kadr: async () => kadrPng, ruchKadru: async () => {} });
        await assert.rejects(bez.zlec('gra', intro.id), /nie umie dopisywać ujęć Wan/);
        await assert.rejects(bez.zlec('gra', taniec.id), /drogi do Joanny/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
