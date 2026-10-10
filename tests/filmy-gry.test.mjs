// 🎬 Filmy gry: GDD trzyma cutscenki przy zdarzeniach, propozycje Reżysera nie gubią stanu, zlecenie → Wan (atrapa)
// → plik w public/filmy gry + filmy.json; błąd = stan „blad” z powodem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Gdd, { oczyscFilmy, scalFilmy, ZDARZENIA_GRY } from '../services/Gdd.js';
import { utworzFilmyGry, promptFilmu } from '../services/FilmyGry.js';

test('oczyscFilmy / scalFilmy: zdarzenia z listy, sekundy 2–5, stan zostaje przy propozycji', () => {
    const f = oczyscFilmy([{ zdarzenie: 'wybuch', tytul: 'Intro', opis: 'Wyspa z lotu ptaka', sekundy: 30 }, { opis: '' }, { tytul: 'Strażnik pada', zdarzenie: 'straznik' }]);
    assert.equal(f.length, 2);
    assert.deepEqual([f[0].zdarzenie, f[0].sekundy, f[0].stan], ['start', 5, 'pomysl']);
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
        await Gdd.zapisz('gra', { tytul: 'Teterhia', sekcje: { wizual: 'malowana fantastyka' }, filmy: [{ tytul: 'Intro', zdarzenie: 'start', opis: 'Kot tańczy', sekundy: 3 }, { tytul: 'Taniec', zdarzenie: 'taniec', opis: 'Kot kłania się', sekundy: 2, silnik: 'flux', postacie: ['katedra'], ruch: 'najazd' }] });
        const [intro, taniec] = (await Gdd.wczytaj('gra')).filmy;
        assert.equal(intro.silnik, 'flux-wan', 'domyślnie FLUX → Wan');
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
        const [i2, t2] = (await Gdd.wczytaj('gra')).filmy;
        assert.deepEqual([i2.stan, i2.silnikUzyty, i2.kadr, i2.ruch, i2.obsadaUzyta.map((o) => o.id)], ['gotowy', 'flux-wan', `filmy/${intro.id}-kadr.png`, 'odjazd', ['b:mira']], i2.blad);
        assert.deepEqual(wolania[0], ['kadr', ['/x/mira.png']]);
        assert.deepEqual(wolania[1].slice(0, 2), ['wan', 'kadr-abc.png'], 'Wan startuje z kadru FLUX');
        assert.deepEqual([t2.stan, t2.silnikUzyty, t2.ruch, t2.obsadaUzyta.map((o) => o.id)], ['gotowy', 'flux', 'najazd', ['katedra']], 'obsada i ruch Suwerena wygrywają z Reżyserem');
        assert.equal(wolania[3][0], 'ruch');
        assert.equal(await fs.readFile(path.join(kat, 'gra', 'public', 'filmy', `${taniec.id}.mp4`), 'utf8'), 'ruch');
        assert.equal(await fs.readFile(path.join(kat, 'gra', 'public', 'filmy', `${intro.id}-kadr.png`), 'utf8'), 'png');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
