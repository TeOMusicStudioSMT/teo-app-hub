// 🧹 Porządki na dysku: propozycje tylko tego, o czym Katedra wie; usuwanie tylko zaznaczonego, ze świeżego przeglądu, w katalogach Katedry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as Porzadki from '../services/Porzadki.js';

function swiat() {
    const baza = fs.mkdtempSync(path.join(os.tmpdir(), 'porzadki-'));
    const modele = path.join(baza, 'models'), kuznia = path.join(baza, 'kuznia-soup'), srodowisko = path.join(baza, 'srodowisko');
    for (const d of [modele, path.join(kuznia, 'kodeks', 'wynik'), path.join(srodowisko, 'pip-cache')]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(modele, 'qwen-8b.gguf'), Buffer.alloc(3000));        // już w Ollamie
    fs.writeFileSync(path.join(modele, 'nowy.gguf'), Buffer.alloc(2000));           // jeszcze nie wykuty — zostaje
    fs.writeFileSync(path.join(kuznia, 'kodeks', 'wynik', 'adapter.safetensors'), Buffer.alloc(1500));
    fs.writeFileSync(path.join(kuznia, 'kodeks', 'teogochi-kodeks.gguf'), Buffer.alloc(1200));
    fs.writeFileSync(path.join(kuznia, 'kodeks', 'sft.jsonl'), 'dane');            // dane treningu — nie proponujemy
    fs.writeFileSync(path.join(srodowisko, 'pip-cache', 'torch.whl'), Buffer.alloc(800));
    const usuniete = [];
    Porzadki.skonfiguruj({
        skanGguf: async () => ({
            katalogi: [{ sciezka: modele }],
            modele: [
                { plik: 'qwen-8b.gguf', sciezka: path.join(modele, 'qwen-8b.gguf'), bajty: 3000, rodzaj: 'gguf', wykuty: fs.existsSync(path.join(modele, 'qwen-8b.gguf')), proponowanaNazwa: 'qwen-8b' },
                { plik: 'nowy.gguf', sciezka: path.join(modele, 'nowy.gguf'), bajty: 2000, rodzaj: 'gguf', wykuty: false, proponowanaNazwa: 'nowy' },
            ].filter((m) => fs.existsSync(m.sciezka)),
        }),
        katalogModeli: async () => [
            { nazwa: 'gemma4:e2b', rozmiarGB: 2, agenci: [], praca: { wkladow: 0 }, wlasny: null, karta: null },          // domyślny — chroniony
            { nazwa: 'qwen3.5:9b', rozmiarGB: 6, agenci: ['kodeks'], praca: { wkladow: 5 }, wlasny: null, karta: null },   // używany
            { nazwa: 'stary:7b', rozmiarGB: 4.1, agenci: [], praca: { wkladow: 0 }, wlasny: null, karta: null },           // nieużywany
            { nazwa: 'hf.co/a/b:Q4_K_M', rozmiarGB: 5, agenci: [], praca: { wkladow: 0 }, wlasny: null, karta: { opis: 'od Zwiadowcy' } },  // z kartą
            { nazwa: 'teogochi-kodeks:latest', rozmiarGB: 3, agenci: [], praca: { wkladow: 0 }, wlasny: 'kodeks', karta: null },             // z Kuźni
        ].filter((m) => !usuniete.includes(m.nazwa)),
        wykuteKuzni: async () => [{ agent: 'kodeks', model: 'teogochi-kodeks' }],
        katalogKuzni: kuznia, srodowiskoKuzni: srodowisko,
        chronioneModele: () => ['gemma4:e2b', undefined],
        usunModel: async (m) => { usuniete.push(m); },
        szyna: null,
    });
    return { baza, modele, kuznia, srodowisko, usuniete };
}

test('Porządki: przegląd proponuje tylko to, o czym Katedra wie — z rozmiarem i powodem; reszta nietknięta', async () => {
    const s = swiat();
    const { pozycje } = await Porzadki.przeglad();
    const po = Object.fromEntries(pozycje.map((p) => [p.nazwa, p]));
    assert.deepEqual(Object.keys(po).sort(), ['kodeks/teogochi-kodeks.gguf', 'kodeks/wynik', 'pip-cache Kuźni', 'qwen-8b.gguf', 'stary:7b'].sort());
    assert.equal(po['qwen-8b.gguf'].rodzaj, 'gguf-w-ollamie');
    assert.match(po['qwen-8b.gguf'].powod, /Ollama ma już ten model jako „qwen-8b"/);
    assert.equal(po['stary:7b'].gb, 4.1);
    assert.equal(po['kodeks/wynik'].bajty, 1500);
    assert.equal(pozycje[0].nazwa, 'stary:7b', 'największe pierwsze');
    for (const n of ['nowy.gguf', 'gemma4:e2b', 'qwen3.5:9b', 'hf.co/a/b:Q4_K_M', 'teogochi-kodeks:latest']) assert.ok(!po[n], `${n} nie jest proponowany`);
    assert.ok(fs.existsSync(path.join(s.modele, 'qwen-8b.gguf')), 'przegląd niczego nie usuwa');
});

test('Porządki: usuwa tylko zaznaczone (pliki, katalogi, model w Ollamie); nieznane id i stary stan → odmowa', async () => {
    const s = swiat();
    const { pozycje } = await Porzadki.przeglad();
    const id = (n) => pozycje.find((p) => p.nazwa === n).id;
    await assert.rejects(Porzadki.usun([]), /Zaznacz/);
    const w = await Porzadki.usun([id('qwen-8b.gguf'), id('kodeks/wynik'), id('stary:7b'), 'abcdefabcdef']);
    assert.deepEqual(w.usuniete.map((u) => u.nazwa).sort(), ['kodeks/wynik', 'qwen-8b.gguf', 'stary:7b']);
    assert.match(w.odmowy[0].powod, /nie ma już na liście/);
    assert.ok(!fs.existsSync(path.join(s.modele, 'qwen-8b.gguf')));
    assert.ok(!fs.existsSync(path.join(s.kuznia, 'kodeks', 'wynik')));
    assert.ok(fs.existsSync(path.join(s.modele, 'nowy.gguf')) && fs.existsSync(path.join(s.kuznia, 'kodeks', 'sft.jsonl')), 'nie zaznaczone zostaje');
    assert.deepEqual(s.usuniete, ['stary:7b']);
    // Druga próba tego samego: pozycji już nie ma na świeżym przeglądzie.
    const w2 = await Porzadki.usun([id('qwen-8b.gguf')]);
    assert.equal(w2.usuniete.length, 0);
    assert.match(w2.odmowy[0].powod, /odśwież/);
});

test('Porządki: ścieżka poza katalogami Katedry nie przechodzi (także przez ..)', () => {
    const k = ['/k/models', '/k/kuznia'];
    assert.ok(Porzadki.wKorzeniach('/k/models/a.gguf', k));
    assert.ok(!Porzadki.wKorzeniach('/k/models', k), 'sam korzeń — nie');
    assert.ok(!Porzadki.wKorzeniach('/k/models/../../etc/passwd', k));
    assert.ok(!Porzadki.wKorzeniach('/k/modelsX/a', k));
});
