// 🎼 Baza silników Dyrygenta i zwiad dziedzin: sondy z modułów (pad/timeout = „nie wiadomo”, nie znika),
// cele (czego brakuje, kandydaci Zwiadowcy), licencje kandydatów.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utworzSilniki, CELE } from '../services/Silniki.js';
import { czyKomercyjna, licencjaZTagow, DZIEDZINY } from '../services/ZwiadowcaHF.js';

test('sondy: gotowe, niegotowe, pad i przekroczenie czasu — każda zostaje na liście z powodem', async () => {
    const S = utworzSilniki({
        limitMs: 50,
        sondy: {
            glos: async () => [{ id: 'klon-chatterbox', nazwa: 'Chatterbox', gotowy: true, licencja: 'MIT' }, { id: 'klon-xtts', nazwa: 'XTTS', gotowy: false, powod: 'nie zainstalowany' }],
            wideo: async () => { throw new Error('ComfyUI eksplodował'); },
            muzyka: () => new Promise(() => {}),
            obraz: async () => ({ id: 'flux', nazwa: 'FLUX', gotowy: null, powod: 'ComfyUI śpi' }),
        },
    });
    const { silniki } = await S.baza();
    const po = Object.fromEntries(silniki.map((s) => [s.id, s]));
    assert.equal(po['klon-chatterbox'].gotowy, true);
    assert.equal(po['klon-xtts'].gotowy, false);
    assert.match(po['wideo-sonda'].powod, /nie wiadomo — ComfyUI eksplodował/);
    assert.equal(po['wideo-sonda'].nieWiadomo, true);
    assert.match(po['muzyka-sonda'].powod, /nie odpowiedziała/);
    assert.equal(po.flux.gotowy, false);
    assert.equal(po.flux.nieWiadomo, true, 'gotowy: null = nie wiadomo, nie „gotowy”');
});

test('do celu: potrzebne bez gotowego silnika = brakuje; kandydaci Zwiadowcy (przyjęci najpierw), odrzuceni nie', async () => {
    const S = utworzSilniki({
        sondy: {
            glos: async () => [{ id: 'klon-chatterbox', gotowy: true }],
            wideo: async () => [{ id: 'wan22', gotowy: false, powod: 'brak wag' }],
            usta: async () => [{ id: 'musetalk', gotowy: true }],
        },
        kandydaci: async () => [
            { id: 'a', rodzaj: 'silnik', dziedzina: 'wideo', repo: 'x/ltx', stan: 'nowy', pobrania: 900, licencja: 'other' },
            { id: 'b', rodzaj: 'silnik', dziedzina: 'wideo', repo: 'y/wan', stan: 'przyjety', pobrania: 10, licencja: 'apache-2.0', komercyjna: true },
            { id: 'c', rodzaj: 'silnik', dziedzina: 'wideo', repo: 'z/zly', stan: 'odrzucony' },
            { id: 'd', repo: 'q/gguf', stan: 'nowy' },
        ],
    });
    const film = await S.doCelu('film');
    assert.deepEqual(film.brakuje, ['wideo']);
    assert.equal(film.moznaRuszyc, false);
    assert.deepEqual(film.rodzaje.wideo.kandydaci.map((k) => k.repo), ['y/wan', 'x/ltx']);
    assert.equal(film.rodzaje.wideo.kandydaci[0].stan, 'do zainstalowania');
    assert.equal(film.rodzaje.glos.gotowe.length, 1);
    assert.equal(film.rodzaje.usta.potrzebny, false);
    const podcast = await S.doCelu('podcast');
    assert.equal(podcast.moznaRuszyc, true);
    assert.deepEqual(podcast.agenci, ['kronikarz', 'aktor']);
    const stol = await S.doCelu('stol');
    assert.equal(stol.agenci, null, 'stół = cały zespół karty');
    await assert.rejects(S.doCelu('kosmos'), /Nie znam celu/);
    assert.ok(Object.values(CELE).every((c) => c.potrzebne.every((r) => typeof r === 'string')));
});

test('licencje kandydatów: zarabiać wolno / nie wolno / nie wiadomo', () => {
    assert.equal(licencjaZTagow(['diffusers', 'license:apache-2.0']), 'apache-2.0');
    assert.equal(licencjaZTagow([], { license: 'MIT' }), 'mit');
    assert.equal(licencjaZTagow([]), null);
    assert.equal(czyKomercyjna('apache-2.0'), true);
    assert.equal(czyKomercyjna('cc-by-nc-4.0'), false);
    assert.equal(czyKomercyjna('other'), null);
    assert.equal(czyKomercyjna(null), null);
    assert.ok(DZIEDZINY.wideo.pipeline.includes('text-to-video'));
    assert.equal(DZIEDZINY.kod.gguf, true);
});

test('Zwiadowca: zwiad dziedziny „wideo” po pipeline_tag → silniki z licencją; „Przyjmij” nic nie pobiera', async () => {
    const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
    const Zw = await import('../services/ZwiadowcaHF.js');
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'zw-silniki-'));
    const json = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) });
    const wolania = [];
    Zw.skonfiguruj({
        katalog: kat, wlaczony: true, pisz: null, szyna: null,
        fetch: async (url, init = {}) => {
            wolania.push([init.method ?? 'GET', url]);
            if (url.includes('pipeline_tag=text-to-video')) return json([{ id: 'Wan-AI/Wan2.2-TI2V-5B', downloads: 9000, tags: ['license:apache-2.0'] }, { id: 'zly id' }]);
            if (url.includes('pipeline_tag=image-to-video')) return json([{ id: 'nc/Model', downloads: 50, tags: ['license:cc-by-nc-4.0'] }, { id: 'Wan-AI/Wan2.2-TI2V-5B', downloads: 9000 }]);
            return json([]);
        },
    });
    await Zw.zwiadDziedziny({ dziedzina: 'wideo' });
    for (let i = 0; i < 500 && Zw.sondaz().stan === 'trwa'; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(Zw.sondaz().stan, 'gotowe');
    const { kandydaci } = await Zw.kandydaci();
    assert.deepEqual(kandydaci.map((k) => [k.repo, k.rodzaj, k.dziedzina, k.licencja, k.komercyjna]), [
        ['Wan-AI/Wan2.2-TI2V-5B', 'silnik', 'wideo', 'apache-2.0', true],
        ['nc/Model', 'silnik', 'wideo', 'cc-by-nc-4.0', false],
    ]);
    const w = await Zw.akceptuj(kandydaci[0].id);
    assert.equal(w.doInstalacji, true);
    assert.equal((await Zw.kandydaci()).kandydaci[0].stan, 'przyjety');
    assert.ok(wolania.every(([m, u]) => m === 'GET' && u.startsWith('https://huggingface.co/api/models?pipeline_tag=')), 'tylko odczyt listy — nic nie pobrane');
    await assert.rejects(Zw.zwiadDziedziny({ dziedzina: 'kosmos' }), /Nie znam dziedziny/);
});

test('Dyrygent dyryguje, nie gra: poza składem projektu; sam Dyrygent = błąd wprost', async () => {
    const ProjektStada = await import('../services/ProjektStada.js');
    const kroki = ProjektStada.zaplanuj([{ id: 'dyrygent', imie: 'Dyrygent' }, { id: 'kodeks', imie: 'Kodeks' }, { id: 'rezyser', imie: 'Reżyser' }]);
    assert.ok(!kroki.some((k) => k.agent === 'dyrygent'));
    assert.ok(kroki.some((k) => k.agent === 'kodeks'));
    assert.throws(() => ProjektStada.zaplanuj([{ id: 'dyrygent', imie: 'Dyrygent' }]), /nikt, kto pisze wkłady/);
});

test('Stół: przyjęcie karty domyślnie z Dyrygentem (dobiera modele jako pierwszy), wprost false — bez', async () => {
    const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
    const Stol = await import('../services/Stol.js');
    const zalozone = [];
    Stol.skonfiguruj({
        katalog: fs.mkdtempSync(path.join(os.tmpdir(), 'stol-dyr-')),
        uczestnicy: async () => [{ id: 'kodeks', imie: 'Kodeks' }, { id: 'rezyser', imie: 'Reżyser' }],
        zaloz: async (o) => { zalozone.push(o); return { id: `p${zalozone.length}`, rundy: 1, petla: 0 }; },
        projekt: async () => null, szyna: null,
    });
    const a = await Stol.dodaj({ tytul: 'Gra o ogrodzie', tresc: 'Prosta gra o sadzeniu drzew w Katedrze.' });
    await Stol.przyjmij(a.id, {});
    const b = await Stol.dodaj({ tytul: 'Film o morzu', tresc: 'Krótki film o morzu i latarni nocą.' });
    await Stol.przyjmij(b.id, { dyrygent: false });
    assert.deepEqual(zalozone.map((z) => z.dyrygent), [true, false]);
});
