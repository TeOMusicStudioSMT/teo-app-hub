// 🎭 Aktorzy i wywiad o filmie: prompt z faktów, parser scenariusza, obsada, poprawki i PRAWDZIWE nagranie ffmpeg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { utworzWywiady, promptWywiadu, odczytajScenariusz, argumentyKwestii, czasBezGlosu, PROWADZACY } from '../services/WywiadAktorow.js';
import { opisz } from '../services/Montazownia.js';
import { CZCIONKI } from '../services/PowitanieDnia.js';

const KAEL = { id: 'kael', imie: 'Kael', rola: 'Pilot, mówi krótko' };
const ELARA = { id: 'elara', imie: 'Elara', rola: 'Astronomka, poetycka' };
const czekaj = async (warunek, ms = 120_000) => { const t0 = Date.now(); for (;;) { const w = await warunek(); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 200)); } };

test('prompt: fakty tylko z materiału, format IMIĘ:, obsada i film w treści', () => {
    const { system, user } = promptWywiadu({ goscie: [KAEL, ELARA], film: { tytul: 'Kosmiczny rytm', url: 'https://youtu.be/x', opis: 'Kael ląduje na Elarze.' }, kontekst: 'Odcinek #1: start', temat: 'muzyka' });
    assert.match(system, /WYŁĄCZNIE z materiału/);
    assert.match(system, /IMIĘ: tekst kwestii/);
    assert.match(user, /FILM: Kosmiczny rytm/);
    assert.match(user, /- KAEL: Pilot/);
    assert.match(user, /PROWADZĄCY: KRONIKARZ/);
    assert.match(user, /O CZYM SZCZEGÓLNIE ROZMAWIAĆ: muzyka/);
});

test('parser: imiona bez ogonków i z markdownem, prowadzący pod różnymi nazwami, didaskalia precz, obcy pominięci', () => {
    const surowe = [
        'Oto scenariusz:',
        '**KRONIKARZ:** Witajcie w Katedrze! Dziś „Kosmiczny rytm”.',
        'KAEL: (uśmiecha się) Lądowanie było twarde.',
        'Kael: Ale warto było.',
        '- ELARA: "Gwiazdy tam śpiewają."',
        'Widz: a ja?',
        'Prowadzący: Dziękuję, obejrzyjcie film na YouTube.',
    ].join('\n');
    const k = odczytajScenariusz(surowe, { goscie: [KAEL, ELARA] });
    assert.deepEqual(k.map((x) => x.kto), ['kronikarz', 'kael', 'elara', 'kronikarz']);
    assert.equal(k[1].tekst, 'Lądowanie było twarde. Ale warto było.');
    assert.equal(k[2].tekst, 'Gwiazdy tam śpiewają.');
    assert.throws(() => odczytajScenariusz('Nie umiem.\nKAEL: tak', { goscie: [KAEL] }), /formacie/);
    assert.equal(czasBezGlosu('krótko'), 3);
    assert.equal(czasBezGlosu('x'.repeat(140)), 10);
});

test('argumenty kwestii: zdjęcie z najazdem albo barwa, głos albo cisza, tekst przez textfile', () => {
    const a = argumentyKwestii({ obraz: 'o-kael.png', kolor: '#ff0000', imiePlik: 'i.txt', liniePliki: ['l0.txt', 'l1.txt'], czcionka: 'c.ttf', czas: 4, audio: 'a.wav', wyjscie: 's.mp4' });
    const f = a[a.indexOf('-filter_complex') + 1];
    assert.ok(a.includes('o-kael.png') && a.includes('a.wav') && a.at(-1) === 's.mp4');
    assert.match(f, /zoompan/);
    assert.match(f, /textfile=l1\.txt:expansion=none/);
    assert.match(f, /color=0xff0000/);
    const b = argumentyKwestii({ obraz: null, kolor: '#00ff00', imiePlik: 'i.txt', liniePliki: ['l0.txt'], czcionka: 'c.ttf', czas: 3, audio: null, wyjscie: 's.mp4' });
    assert.ok(b.some((x) => /^color=c=0x00ff00/.test(x)) && b.some((x) => /anullsrc/.test(x)));
});

test('obsada i scenariusz: zapis aktora (zdjęcie musi istnieć), model gatunku aktor, poprawki Suwerena', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wywiad-'));
    const zdjecie = path.join(tmp, 'kael.png');
    fs.writeFileSync(zdjecie, 'x');
    let wolanie = null;
    const W = utworzWywiady({
        katalog: tmp, opisz: async () => null, katalogMontazy: async () => tmp,
        modelDla: async (id) => (id === 'aktor' ? 'bielik' : null),
        kontekst: async () => ({ film: { tytul: 'Kosmiczny rytm', opis: 'Kael ląduje.' }, opis: 'Odcinek #1' }),
        chat: async (model, system, user) => { wolanie = { model, user }; return { tekst: 'KRONIKARZ: Witajcie.\nKAEL: Leciałem długo.\nKRONIKARZ: Jak było?\nKAEL: Pięknie.', silnik: model }; },
    });
    await assert.rejects(W.zapiszAktora({ imie: '' }), /imienia/);
    await assert.rejects(W.zapiszAktora({ imie: 'Kael', zdjecie: path.join(tmp, 'nie-ma.png') }), /istniejącym obrazem/);
    const a = await W.zapiszAktora({ imie: 'Kael', rola: 'Pilot', zdjecie, glos: { profil: 'kael-glos' }, kolor: '#3b82f6' });
    assert.equal(a.id, 'kael');
    assert.deepEqual((await W.aktorzy()).map((x) => x.id), ['kael']);
    await assert.rejects(W.przygotuj({ projekt: 'elara', goscie: ['nikt'] }), /co najmniej jednego/);
    const w = await W.przygotuj({ projekt: 'elara', goscie: ['kael'], temat: 'lot' });
    assert.equal(wolanie.model, 'bielik');
    assert.match(wolanie.user, /Kosmiczny rytm/);
    assert.equal(w.etap, 'scenariusz');
    assert.equal(w.kwestie.length, 4);
    const z = await W.zmien(w.id, { kwestie: [{ kto: 'kronikarz', tekst: 'Dzień dobry.' }, { kto: 'kael', tekst: ' Moja   wersja. ' }, { kto: 'obcy', tekst: 'nie' }] });
    assert.deepEqual(z.kwestie, [{ kto: 'kronikarz', tekst: 'Dzień dobry.' }, { kto: 'kael', tekst: 'Moja wersja.' }]);
    assert.equal((await W.wywiady())[0].id, w.id);
    await assert.rejects(W.nagraj(w.id), /silnika głosu/);
    await W.usunAktora('kael');
    assert.deepEqual(await W.aktorzy(), []);
});

const czcionka = CZCIONKI.find((p) => fs.existsSync(p));
test('PRAWDZIWE nagranie: plansza + kwestie z głosem (sinus jako „głos”) i bez głosu → film w katalogu montaży', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wywiad-ff-'));
    const zdjecie = path.join(tmp, 'kael.png');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=640x360:d=1', '-frames:v', '1', zdjecie]);
    const glosWav = path.join(tmp, 'glos.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.5', '-ar', '22050', '-ac', '1', glosWav]);
    const montaz = path.join(tmp, 'montaz');
    fs.mkdirSync(montaz);
    const glosy = [];
    const W = utworzWywiady({
        katalog: path.join(tmp, 'aktorzy'), ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => montaz,
        chat: async () => ({ tekst: 'KRONIKARZ: Witajcie w Katedrze, dziś „Kosmiczny rytm”.\nKAEL: Zażółć gęślą jaźń — lądowanie było twarde.\nKRONIKARZ: Dziękuję, film czeka na YouTube.' }),
        mow: async ({ tekst, glos }) => { glosy.push({ tekst, glos }); return { audio: fs.readFileSync(glosWav), ext: 'wav' }; },
    });
    await W.zapiszAktora({ imie: 'Kael', rola: 'Pilot', zdjecie, glos: { profil: 'kael' }, kolor: '#3b82f6' });
    const w = await W.przygotuj({ projekt: 'elara', goscie: ['kael'] });
    const start = await W.nagraj(w.id);
    assert.equal(start.etap, 'nagrywa');
    assert.ok(start.postep);
    await assert.rejects(W.nagraj(w.id), /już się nagrywa/);
    const gotowy = await czekaj(async () => { const x = await W.wywiad(w.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(gotowy.etap, 'gotowy', gotowy.blad);
    assert.equal(path.dirname(gotowy.plik), montaz);
    assert.match(path.basename(gotowy.plik), /^wywiad_elara_[a-z0-9]+\.mp4$/, 'bez publikacji tytułem jest projekt');
    assert.deepEqual(glosy.map((g) => g.glos?.profil ?? null), [null, 'kael', null], 'prowadzący bez profilu, Kael swoim głosem');
    const o = await opisz(gotowy.plik);
    assert.equal(o.szerokosc, 1280);
    assert.equal(o.wysokosc, 720);
    assert.ok(o.maAudio);
    // plansza 3,5 s + 3 kwestie po ~1,95 s (głos 1,5 s + oddech)
    assert.ok(o.sekundy > 8.5 && o.sekundy < 11, `długość ${o.sekundy}`);
    assert.ok(!fs.existsSync(path.join(tmp, 'aktorzy', 'wywiady', w.id, 'praca')), 'katalog roboczy sprzątnięty');

    // Bez głosu: same napisy, czas z długości tekstu, plansza to mówi.
    const w2 = await W.przygotuj({ projekt: 'elara', goscie: ['kael'] });
    await W.nagraj(w2.id, { bezGlosu: true });
    const g2 = await czekaj(async () => { const x = await W.wywiad(w2.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g2.etap, 'gotowy', g2.blad);
    assert.equal(g2.bezGlosu, true);
    assert.equal(glosy.length, 3, 'bez głosu nie woła syntezy');
    const o2 = await opisz(g2.plik);
    assert.ok(o2.sekundy > 3.5 + 3 * 3 - 0.5, `długość ${o2.sekundy}`);
});
