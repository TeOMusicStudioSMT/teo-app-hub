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
        await Gdd.zapisz('gra', { tytul: 'Teterhia', gatunek: 'RPG', filmy: [{ tytul: 'Intro', zdarzenie: 'start', opis: 'Kamera opada na wyspę o świcie', sekundy: 4 }, { tytul: 'Strażnik', zdarzenie: 'straznik', opis: 'Strażnik oddaje Nutę', prompt: 'A stone guardian kneels' }] });
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
