// 🎭 Aktorzy i wywiad o filmie: prompt z faktów, parser scenariusza, obsada, poprawki i PRAWDZIWE nagranie ffmpeg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
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
    const k = argumentyKwestii({ obraz: 'o.png', klip: 'k-kael.mp4', kolor: '#ff0000', imiePlik: 'i.txt', liniePliki: ['l0.txt'], czcionka: 'c.ttf', czas: 4, audio: 'a.wav', wyjscie: 's.mp4' });
    assert.ok(k.join(' ').includes('-stream_loop -1 -t 4.00 -i k-kael.mp4'), 'klip gra w pętli i wygrywa ze zdjęciem');
    assert.ok(!k.includes('o.png') && !k.some((x) => /zoompan/.test(x)));
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

test('PRAWDZIWY podkład: instrumental z biblioteki cicho pod wywiadem (bez głosu), długość wywiadu zostaje; podkład spoza biblioteki = błąd', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wywiad-pod-'));
    const muzyka = path.join(tmp, 'muzyka');
    fs.mkdirSync(path.join(muzyka, '_Stemy'), { recursive: true });
    const instrumental = path.join(muzyka, '_Stemy', 'Instrumental.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=4', '-ac', '2', instrumental]);
    const montaz = path.join(tmp, 'montaz');
    fs.mkdirSync(montaz);
    const W = utworzWywiady({
        katalog: path.join(tmp, 'aktorzy'), ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => montaz,
        sciezkaPodkladu: (p) => { const abs = path.resolve(muzyka, p); if (!abs.startsWith(muzyka + path.sep)) throw new Error('Ścieżka ucieka poza bibliotekę muzyki.'); return abs; },
        chat: async () => ({ tekst: 'KRONIKARZ: Witajcie.\nKAEL: Dzień dobry.\nKRONIKARZ: Do zobaczenia na YouTube.' }),
    });
    await W.zapiszAktora({ imie: 'Kael', rola: 'Pilot' });
    const w = await W.przygotuj({ projekt: 'elara', goscie: ['kael'] });
    await assert.rejects(W.nagraj(w.id, { bezGlosu: true, podklad: '/etc/passwd' }), /poza bibliotekę/);
    const start = await W.nagraj(w.id, { bezGlosu: true, podklad: '_Stemy/Instrumental.wav', glosnosc: 0.2 });
    assert.equal(start.podklad, 'Instrumental.wav');
    const g = await czekaj(async () => { const x = await W.wywiad(w.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g.etap, 'gotowy', g.blad);
    const o = await opisz(g.plik);
    assert.ok(o.maAudio);
    // plansza 3,5 s + 3 × 3 s — podkład (4 s, zapętlony) nie wydłuża filmu
    assert.ok(o.sekundy > 12 && o.sekundy < 13.5, `długość ${o.sekundy}`);
    // w kwestiach „bez głosu” słychać teraz podkład (nie cyfrowa cisza)
    const { stderr } = await new Promise((ok) => execFile(ffmpegPath, ['-hide_banner', '-ss', '6', '-t', '2', '-i', g.plik, '-af', 'volumedetect', '-f', 'null', '-'], (e, so, se) => ok({ stderr: se })));
    const srednia = Number(String(stderr).match(/mean_volume:\s*(-?[\d.]+)/)?.[1]);
    assert.ok(srednia > -40, `średnia głośność ${srednia} dB`);
});

test('głosy: profil VoiceStudio dla postaci i głos prowadzącego trafiają do syntezy; normalizacja odrzuca śmieci', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const { normalizujGlos } = await import('../services/WywiadAktorow.js');
    assert.deepEqual(normalizujGlos({ voicestudio: 'b468a820', smiec: 'x' }), { voicestudio: 'b468a820' });
    assert.equal(normalizujGlos({}), null);
    assert.equal(normalizujGlos('kael'), null);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wywiad-vs-'));
    const wav = path.join(tmp, 'g.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', wav]);
    const glosy = [];
    const W = utworzWywiady({
        katalog: path.join(tmp, 'aktorzy'), ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => tmp,
        chat: async () => ({ tekst: 'KRONIKARZ: Witajcie.\nKAEL: Dzień dobry.\nKRONIKARZ: Do zobaczenia.' }),
        mow: async ({ glos }) => { glosy.push(glos); return { audio: fs.readFileSync(wav), ext: 'wav' }; },
    });
    const a = await W.zapiszAktora({ imie: 'Kael', glos: { voicestudio: 'kael-vs' } });
    assert.deepEqual(a.glos, { voicestudio: 'kael-vs' });
    const w = await W.przygotuj({ projekt: 'elara', goscie: ['kael'] });
    const start = await W.nagraj(w.id, { glosProwadzacego: { voicestudio: 'narrator' } });
    assert.deepEqual(start.glosProwadzacego, { voicestudio: 'narrator' });
    const g = await czekaj(async () => { const x = await W.wywiad(w.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g.etap, 'gotowy', g.blad);
    assert.deepEqual(glosy, [{ voicestudio: 'narrator' }, { voicestudio: 'kael-vs' }, { voicestudio: 'narrator' }]);
    assert.deepEqual(g.glosProwadzacego, { voicestudio: 'narrator' }, 'głos prowadzącego zapamiętany przy wywiadzie');
});

test('Kronikarz z obsady: karta „kronikarz” daje prowadzącemu głos, imię i kolor; nie jest gościem; wybór przy nagraniu wygrywa', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const { prowadzacyZObsady } = await import('../services/WywiadAktorow.js');
    assert.equal(prowadzacyZObsady([]).imie, 'Kronikarz');
    assert.deepEqual(prowadzacyZObsady([{ id: 'kronikarz', imie: 'Kronikarz', glos: { voicestudio: 'narr' }, kolor: '#112233' }]).glos, { voicestudio: 'narr' });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wywiad-kr-'));
    const wav = path.join(tmp, 'g.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', wav]);
    const glosy = []; let prompt = '';
    const W = utworzWywiady({
        katalog: path.join(tmp, 'aktorzy'), ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => tmp,
        chat: async (_m, system) => { prompt = system; return { tekst: 'KRONIKARZ: Witajcie.\nKAEL: Dzień dobry.\nKRONIKARZ: Do zobaczenia.' }; },
        mow: async ({ glos }) => { glosy.push(glos); return { audio: fs.readFileSync(wav), ext: 'wav' }; },
    });
    await W.zapiszAktora({ id: 'kronikarz', imie: 'Kronikarz', rola: 'Prowadzący, mówi spokojnie', glos: { voicestudio: 'narr' } });
    await W.zapiszAktora({ imie: 'Kael', glos: { voicestudio: 'kael-vs' } });
    await assert.rejects(W.przygotuj({ projekt: 'elara', goscie: ['kronikarz'] }), /co najmniej jednego/, 'Kronikarz nie jest gościem');
    const w = await W.przygotuj({ projekt: 'elara', goscie: ['kronikarz', 'kael'] });
    assert.deepEqual(w.goscie, ['kael']);
    assert.match(prompt, /mówi spokojnie/);
    await W.nagraj(w.id);
    const g = await czekaj(async () => { const x = await W.wywiad(w.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g.etap, 'gotowy', g.blad);
    assert.deepEqual(glosy, [{ voicestudio: 'narr' }, { voicestudio: 'kael-vs' }, { voicestudio: 'narr' }]);
});

test('język: scenariusz po angielsku, tłumaczenie gotowego dialogu (mówcy na miejscach), powrót do oryginału bez modelu, głos i plik w języku', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const { odczytajTlumaczenie, promptTlumaczenia } = await import('../services/WywiadAktorow.js');
    assert.match(promptWywiadu({ goscie: [KAEL], film: { tytul: 'X' }, jezyk: 'en' }).system, /PO ANGIELSKU/);
    assert.match(promptWywiadu({ goscie: [KAEL], film: { tytul: 'X' } }).system, /Piszesz po polsku/);
    const kw = [{ kto: 'kronikarz', tekst: 'Witajcie.' }, { kto: 'kael', tekst: 'Dzień dobry.' }];
    assert.match(promptTlumaczenia(kw, 'en').user, /^1\. Witajcie\.\n2\. Dzień dobry\.$/);
    assert.deepEqual(odczytajTlumaczenie('Oto:\n1. Welcome.\n**2.** "Good morning."', kw), [{ kto: 'kronikarz', tekst: 'Welcome.' }, { kto: 'kael', tekst: 'Good morning.' }]);
    assert.throws(() => odczytajTlumaczenie('1. Welcome.', kw), /pominął kwestie nr 2/);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wywiad-en-'));
    const wav = path.join(tmp, 'g.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', wav]);
    const jezyki = []; let chatow = 0;
    const W = utworzWywiady({
        katalog: path.join(tmp, 'aktorzy'), ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => tmp,
        chat: async (_m, system) => { chatow += 1; return /Tłumaczysz/.test(system) ? { tekst: '1. Welcome.\n2. Good morning.\n3. See you.' } : { tekst: 'KRONIKARZ: Witajcie.\nKAEL: Dzień dobry.\nKRONIKARZ: Do zobaczenia.' }; },
        mow: async ({ jezyk }) => { jezyki.push(jezyk); return { audio: fs.readFileSync(wav), ext: 'wav' }; },
    });
    await W.zapiszAktora({ imie: 'Kael' });
    const w = await W.przygotuj({ projekt: 'elara', goscie: ['kael'] });
    assert.equal(w.jezyk, 'pl');
    await assert.rejects(W.przetlumacz(w.id, { jezyk: 'pl' }), /już jest/);
    const en = await W.przetlumacz(w.id, { jezyk: 'en' });
    assert.deepEqual(en.kwestie.map((k) => [k.kto, k.tekst]), [['kronikarz', 'Welcome.'], ['kael', 'Good morning.'], ['kronikarz', 'See you.']]);
    assert.equal(en.oryginal.jezyk, 'pl');
    await W.nagraj(w.id, { bezGlosu: false });
    const g = await czekaj(async () => { const x = await W.wywiad(w.id); return x.etap !== 'nagrywa' && x; });
    assert.equal(g.etap, 'gotowy', g.blad);
    assert.deepEqual(jezyki, ['en', 'en', 'en']);
    assert.match(path.basename(g.plik), /^wywiad_elara_en_/);
    const przed = chatow;
    const pl = await W.przetlumacz(w.id, { jezyk: 'pl' });
    assert.equal(chatow, przed, 'powrót do oryginału bez modelu');
    assert.equal(pl.kwestie[0].tekst, 'Witajcie.');
});
