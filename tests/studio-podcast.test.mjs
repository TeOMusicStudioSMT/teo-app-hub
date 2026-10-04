// 🎙️ Studio Podcastu: zasiew z paczki, film wstępowy z nagraniem, scenariusz z bazy aktorów, PRAWDZIWE nagranie odcinka.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { utworzStudioPodcastu, promptOdcinka, planNapisow, argumentyKadru, argumentyWstepu, argumentyGosci, zapowiedzGosci, filtrTla, OGNISKA_DOMYSLNE } from '../services/StudioPodcastu.js';
import { opisz } from '../services/Montazownia.js';
import { utworzWywiady } from '../services/WywiadAktorow.js';
import { CZCIONKI } from '../services/PowitanieDnia.js';

const PACZKA = path.resolve('public/studio-podcast');
const czcionka = CZCIONKI.find((p) => fs.existsSync(p));
const czekaj = async (warunek, ms = 180_000) => { const t0 = Date.now(); for (;;) { const w = await warunek(); if (w) return w; if (Date.now() - t0 > ms) throw new Error('Za długo.'); await new Promise((r) => setTimeout(r, 200)); } };
const tmpDir = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `studio-${n}-`));
const KAEL = { id: 'kael', imie: 'Kael', rola: 'Pilot, mówi krótko', kolor: '#3b82f6', zdjecie: null, glos: { profil: 'kael-glos' } };
const ELARA = { id: 'elara', imie: 'Elara', rola: 'Astronomka, poetycka', kolor: '#ec4899', zdjecie: null, glos: null };

test('paczka Studia: prawdziwe zdjęcia, prowadzący i nagranie wstępu leżą w repo', () => {
    for (const p of ['ujecie-plaza.jpg', 'ujecie-salon.jpg', 'ujecie-rezyserka.jpg', 'prowadzacy.jpg', 'wstep-nagranie.mp3']) assert.ok(fs.statSync(path.join(PACZKA, p)).size > 10_000, p);
});

test('prompt odcinka: temat, studio, goście z rolami, fakty tylko z materiału', () => {
    const { system, user } = promptOdcinka({ prowadzacy: { imie: 'TeO', rola: 'Stylowy prowadzący' }, goscie: [KAEL, ELARA], temat: 'Muzyka z kosmosu', material: 'Kael leciał 3 lata.', uwagi: 'krótko' });
    assert.match(system, /WYŁĄCZNIE z materiału/);
    assert.match(system, /IMIĘ: tekst kwestii/);
    assert.match(system, /TEO \(Stylowy prowadzący\)/);
    assert.match(user, /TEMAT ODCINKA: Muzyka z kosmosu/);
    assert.match(user, /STUDIO: Przytulne studio/);
    assert.match(user, /- ELARA: Astronomka/);
    assert.match(user, /UWAGI SUWERENA: krótko/);
});

test('napisy wstępu: proporcjonalnie do długości, po dwie linie, w oknie nagrania', () => {
    const t = 'Witajcie w moim studiu pod Katedrą. '.repeat(8);
    const n = planNapisow(t, 20, { start: 0.5 });
    assert.ok(n.length >= 2);
    assert.equal(n[0].od, 0.5);
    assert.ok(Math.abs(n.at(-1).do - 20.5) < 0.05);
    assert.ok(n.every((x) => x.linie.length <= 2 && x.do > x.od));
    assert.deepEqual(planNapisow('', 20), []);
});

test('argumenty: tło z najazdem na ognisko, karta mówiącego, wstęp z napisami w oknach czasu', () => {
    const ft = filtrTla(0, { ox: 0.3, oy: 0.6, klatek: 50 });
    assert.match(ft, /scale=3840:2160:flags=lanczos/, 'ostrość: lanczos do 4K przed najazdem');
    assert.match(ft, /unsharp=/);
    assert.match(ft, /zoompan=z='1\.12\+\(1\.28-1\.12\)\*on\/50':x='max\(0,min\(iw-iw\/zoom,0\.3\*iw/);
    const a = argumentyKadru({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, karta: 'k.jpg', kolor: '#ff0000', imiePlik: 'i.txt', liniePliki: ['l0.txt'], czcionka: 'c.ttf', czas: 4, audio: 'a.wav', wyjscie: 's.mp4' });
    const f = a[a.indexOf('-filter_complex') + 1];
    assert.match(f, /overlay=x=W-w-56/);
    assert.match(f, /\[2:a\]aresample/, 'dźwięk to trzecie wejście, gdy jest karta');
    const b = argumentyKadru({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, kolor: '#00ff00', imiePlik: 'i.txt', liniePliki: ['l0.txt'], czcionka: 'c.ttf', czas: 3, audio: null, wyjscie: 's.mp4' });
    assert.ok(b.some((x) => /anullsrc/.test(x)) && !b.join(' ').includes('overlay'));
    const w = argumentyWstepu({ ujecia: [{ plik: 'a.jpg', ox: 0.5, oy: 0.6 }, { plik: 'b.jpg', ox: 0.5, oy: 0.6 }], czas: 10, portret: 'p.jpg', kolor: '#22d3ee', nazwaPliki: [{ plik: 'n0.txt', duze: true }, { plik: 'n1.txt', duze: false }], imiePlik: 'i.txt', napisy: [{ od: 1, do: 3, pliki: ['n-0-0.txt'] }], czcionka: 'c.ttf', audio: 'n.mp3', wyjscie: 'w.mp4' });
    const fw = w[w.indexOf('-filter_complex') + 1];
    assert.match(fw, /concat=n=2:v=1:a=0/);
    assert.match(fw, /textfile=n-0-0\.txt.*enable='between\(t,1,3\)'/);
    assert.match(fw, /\[3:a\]aresample/);
});

test('wideo z gośćmi: karty obok siebie, zdjęcie albo barwa, imiona pod kartami, zapowiedź po polsku i angielsku', () => {
    const a = argumentyGosci({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, goscie: [{ plik: 'g0.jpg', kolor: '#3b82f6', imiePlik: 'gi0.txt' }, { plik: null, kolor: '#ec4899', imiePlik: 'gi1.txt', inicjalPlik: 'gl1.txt' }], naglowekPlik: 'n.txt', czcionka: 'c.ttf', czas: 5, audio: null, wyjscie: 'g.mp4' });
    const f = a[a.indexOf('-filter_complex') + 1];
    assert.ok(a.includes('g0.jpg') && a.some((x) => /^color=c=0xec4899:s=300x400/.test(x)), 'gość bez zdjęcia = karta z jego barwą');
    assert.match(f, /\[1:v\]fps=25,scale=300:400/);
    assert.match(f, /\[2:v\]fps=25,scale=300:400/);
    assert.match(f, /textfile=gi1\.txt/);
    assert.match(f, /textfile=gl1\.txt/, 'inicjał dla gościa bez zdjęcia');
    assert.ok(!/textfile=gl0\.txt/.test(f));
    assert.match(f, /\[3:a\]aresample/);
    assert.equal(zapowiedzGosci(['Kael']), 'Dziś w studiu: Kael.');
    assert.equal(zapowiedzGosci(['Kael', 'Elara', 'Zed']), 'Dziś w studiu: Kael, Elara i Zed.');
    assert.equal(zapowiedzGosci(['Kael', 'Elara'], 'en'), 'Today in the studio: Kael and Elara.');
});

test('planKadru: ujęcie zmienia się co 3 kwestie, prowadzący w ognisku 0, goście po bokach', async () => {
    const tmp = tmpDir('plan');
    const S = utworzStudioPodcastu({ katalog: tmp, paczka: PACZKA, aktorzy: async () => [], opisz: async () => null, katalogMontazy: async () => tmp, chat: async () => ({ tekst: '' }) });
    const ujecia = [{ id: 'a' }, { id: 'b' }];
    assert.equal(S.planKadru(0, 'prowadzacy', ['kael', 'elara'], ujecia).ujecie.id, 'a');
    assert.equal(S.planKadru(3, 'prowadzacy', ['kael', 'elara'], ujecia).ujecie.id, 'b');
    assert.equal(S.planKadru(6, 'prowadzacy', ['kael', 'elara'], ujecia).ujecie.id, 'a');
    assert.deepEqual(S.planKadru(0, 'prowadzacy', ['kael'], ujecia).ognisko, OGNISKA_DOMYSLNE[0]);
    assert.deepEqual(S.planKadru(1, 'kael', ['kael', 'elara'], ujecia).ognisko, OGNISKA_DOMYSLNE[1]);
    assert.deepEqual(S.planKadru(2, 'elara', ['kael', 'elara'], ujecia).ognisko, OGNISKA_DOMYSLNE[2]);
});

test('Studio: zasiew z paczki, zmiana prowadzącego, ujęcia, scenariusz z bazy aktorów i poprawki', async () => {
    const tmp = tmpDir('stan');
    let wolanie = null;
    const S = utworzStudioPodcastu({
        katalog: path.join(tmp, 'studio'), paczka: PACZKA, aktorzy: async () => [KAEL, ELARA], opisz: async () => null, katalogMontazy: async () => tmp,
        modelDla: async (id) => (id === 'aktor' ? 'bielik' : null),
        chat: async (model, system, user) => { wolanie = { model, user }; return { tekst: 'TeO: Witajcie w studiu.\nKAEL: Cześć.\nProwadzący: Opowiedz o locie.\nKael: Leciałem długo.\nELARA: A ja patrzyłam w gwiazdy.', silnik: model }; },
    });
    const s = await S.studio();
    assert.equal(s.ujecia.length, 3);
    assert.ok(s.ujecia.every((u) => fs.existsSync(u.plik)));
    assert.ok(fs.existsSync(s.prowadzacy.zdjecie) && fs.existsSync(s.wstep.nagranie));
    assert.equal(s.prowadzacy.imie, 'TeO');
    await assert.rejects(S.zapiszStudio({ prowadzacy: { imie: ' ' } }), /imienia/);
    await assert.rejects(S.zapiszStudio({ prowadzacy: { zdjecie: path.join(tmp, 'nie-ma.jpg') } }), /istniejącym obrazem/);
    const s2 = await S.zapiszStudio({ nazwa: 'Podcast X', prowadzacy: { rola: 'Luzak', glos: { profil: 'teo-glos' } } });
    assert.equal(s2.nazwa, 'Podcast X');
    assert.deepEqual(s2.prowadzacy.glos, { profil: 'teo-glos' });
    const u = await S.dodajUjecie({ plik: path.join(PACZKA, 'ujecie-salon.jpg'), nazwa: 'Salon nocą' });
    assert.equal(u.id, 'salon-noca');
    assert.equal((await S.studio()).ujecia.length, 4);
    await S.usunUjecie('salon-noca');
    assert.equal((await S.studio()).ujecia.length, 3);
    await assert.rejects(S.dodajUjecie({ plik: path.join(tmp, 'x.txt') }), /istniejącym obrazem/);

    await assert.rejects(S.przygotuj({ temat: '' }), /tematu/);
    await assert.rejects(S.przygotuj({ temat: 'Lot', goscie: ['nikt'] }), /co najmniej jednego/);
    const x = await S.przygotuj({ temat: 'Lot w kosmos', goscie: ['kael', 'elara'] });
    assert.equal(wolanie.model, 'bielik');
    assert.match(wolanie.user, /TEMAT ODCINKA: Lot w kosmos/);
    assert.deepEqual(x.kwestie.map((k) => k.kto), ['prowadzacy', 'kael', 'prowadzacy', 'kael', 'elara']);
    assert.equal(x.tytul, 'Lot w kosmos');
    const z = await S.zmien(x.id, { tytul: 'Gwiazdy', kwestie: [{ kto: 'prowadzacy', tekst: ' Dzień  dobry. ' }, { kto: 'kael', tekst: 'Hej.' }, { kto: 'obcy', tekst: 'nie' }] });
    assert.deepEqual(z.kwestie, [{ kto: 'prowadzacy', tekst: 'Dzień dobry.' }, { kto: 'kael', tekst: 'Hej.' }]);
    assert.equal(z.tytul, 'Gwiazdy');
    await assert.rejects(S.nagraj(x.id), /silnika głosu/);
    assert.equal((await S.odcinki())[0].id, x.id);
});

test('PRAWDZIWY film wstępowy z nagraniem prowadzącego i PRAWDZIWY odcinek (głos = sinus) ze wstępem i podkładem', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const tmp = tmpDir('ff');
    // krótkie nagranie prowadzącego (5 s) zamiast 31-sekundowego — ten sam tor kodu
    const nagranie = path.join(tmp, 'teo.mp3');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=5', '-ac', '2', '-ar', '48000', nagranie]);
    const glosWav = path.join(tmp, 'glos.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', '-ar', '22050', '-ac', '1', glosWav]);
    const muzyka = path.join(tmp, 'muzyka');
    fs.mkdirSync(muzyka);
    const instr = path.join(muzyka, 'Instrumental.wav');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-ac', '2', instr]);
    const montaz = path.join(tmp, 'montaz');
    fs.mkdirSync(montaz);
    const glosy = [];
    const S = utworzStudioPodcastu({
        katalog: path.join(tmp, 'studio'), paczka: PACZKA, ffmpeg: ffmpegPath, opisz, katalogMontazy: async (p) => { assert.equal(p, 'studio-podcast'); return montaz; },
        aktorzy: async () => [{ ...KAEL, zdjecie: path.join(PACZKA, 'prowadzacy.jpg') }],
        chat: async () => ({ tekst: 'TeO: Witajcie w studiu pod Katedrą — zażółć gęślą jaźń.\nKAEL: Cześć, jestem Kael.\nTeO: Do usłyszenia.' }),
        mow: async ({ tekst, glos }) => { glosy.push({ tekst, glos }); return { audio: fs.readFileSync(glosWav), ext: 'wav' }; },
        sciezkaPodkladu: (p) => { const abs = path.resolve(muzyka, p); if (!abs.startsWith(muzyka)) throw new Error('poza biblioteką'); return abs; },
    });
    await S.zapiszStudio({ nagranieWstepu: nagranie });
    const wstep = await S.zrobWstep({ tekst: 'Witajcie w moim przytulnym studiu pod Katedrą OtakOS. Zapraszam na rozmowy.' });
    const ow = await opisz(wstep.plik);
    assert.equal(ow.szerokosc, 1280); assert.equal(ow.wysokosc, 720);
    assert.ok(ow.maAudio);
    assert.ok(ow.sekundy > 6 && ow.sekundy < 7.2, `wstęp ${ow.sekundy} s (5 s nagrania + 1,4 s)`);
    assert.equal(wstep.napisy, true);

    const x = await S.przygotuj({ temat: 'Kosmos', goscie: ['kael'] });
    await S.nagraj(x.id, { podklad: 'Instrumental.wav' });
    await assert.rejects(S.nagraj(x.id), /już się nagrywa/);
    const g = await czekaj(async () => { const y = await S.odcinek(x.id); return y.etap !== 'nagrywa' && y; });
    assert.equal(g.etap, 'gotowy', g.blad);
    assert.equal(path.dirname(g.plik), montaz);
    assert.match(path.basename(g.plik), /^podcast_kosmos_[a-z0-9]+\.mp4$/);
    assert.deepEqual(glosy.map((v) => v.glos?.profil ?? null), [null, null, 'kael-glos', null], 'zapowiedź gości i kwestie prowadzącego bez profilu, Kael swoim głosem');
    assert.match(glosy[0].tekst, /^Dziś w studiu: Kael\.$/);
    assert.ok(fs.existsSync(await S.plik('goscie', x.id)), 'wideo z gośćmi zostaje osobno');
    const og = await opisz(await S.plik('goscie', x.id));
    assert.ok(og.szerokosc === 1280 && og.maAudio && og.sekundy >= 4.5, `goście ${og.sekundy} s`);
    const o = await opisz(g.plik);
    assert.equal(o.szerokosc, 1280); assert.ok(o.maAudio);
    // wstęp ~6,4 s + wideo z gośćmi (min. 4,5 s; zapowiedź 1,2 s głosu + 1,2) + 3 kwestie po ~1,65 s
    assert.ok(o.sekundy > 15 && o.sekundy < 18, `odcinek ${o.sekundy} s`);
    assert.ok(!fs.existsSync(path.join(tmp, 'studio', 'odcinki', x.id, 'praca')), 'katalog roboczy sprzątnięty');
    assert.ok(fs.existsSync(await S.plik('odcinek', x.id)) && fs.existsSync(await S.plik('wstep')) && fs.existsSync(await S.plik('ujecie', 'plaza')));
    await assert.rejects(S.plik('ujecie', 'nie-ma'), /Nie ma takiego pliku/);

    // bez głosu i bez wstępu: same napisy, krótszy film
    const y = await S.przygotuj({ temat: 'Cisza', goscie: ['kael'] });
    await S.nagraj(y.id, { bezGlosu: true, zWstepem: false, zGoscmi: false });
    const g2 = await czekaj(async () => { const z = await S.odcinek(y.id); return z.etap !== 'nagrywa' && z; });
    assert.equal(g2.etap, 'gotowy', g2.blad);
    assert.equal(glosy.length, 4, 'bez głosu nie woła syntezy');
    // samo wideo z gośćmi, bez głosu: osobna trasa podglądu
    const zg = await S.zrobGosci(y.id, { bezGlosu: true });
    assert.ok(zg.goscieFilm && zg.sekundy >= 4.5);
    assert.equal(glosy.length, 4);
    const o2 = await opisz(g2.plik);
    assert.ok(o2.sekundy < o.sekundy && o2.sekundy > 8, `bez wstępu ${o2.sekundy} s`);
});

test('wideo aktora: pole w bazie (musi istnieć, tylko wideo), zdjęcie zostaje, puste zdejmuje; karta gościa i mówiącego gra klipem w pętli', async () => {
    const tmp = tmpDir('wideo');
    const klip = path.join(tmp, 'kael.mp4');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=320x480:r=25:d=1.5', '-f', 'lavfi', '-i', 'sine=frequency=500:duration=1.5', '-shortest', '-pix_fmt', 'yuv420p', klip]);
    const W = utworzWywiady({ katalog: path.join(tmp, 'aktorzy'), opisz: async () => null, katalogMontazy: async () => tmp, chat: async () => ({ tekst: '' }) });
    await assert.rejects(W.zapiszAktora({ imie: 'Kael', wideo: path.join(tmp, 'nie-ma.mp4') }), /Wideo aktora musi być istniejącym plikiem/);
    await assert.rejects(W.zapiszAktora({ imie: 'Kael', wideo: path.join(PACZKA, 'prowadzacy.jpg') }), /Wideo aktora/);
    const a = await W.zapiszAktora({ imie: 'Kael', zdjecie: path.join(PACZKA, 'prowadzacy.jpg'), wideo: klip });
    assert.equal(a.wideo, klip);
    assert.equal(a.zdjecie, path.join(PACZKA, 'prowadzacy.jpg'));
    assert.equal((await W.zapiszAktora({ ...a, rola: 'Pilot' })).wideo, klip, 'zapis z istniejącymi polami (np. nowy głos) zachowuje klip');
    assert.equal((await W.zapiszAktora({ ...a, wideo: null })).wideo, null, 'null zdejmuje klip');

    // argumenty: klip = -stream_loop zamiast -loop, obraz dalej -loop
    const ga = argumentyGosci({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, goscie: [{ plik: 'g0.mp4', kolor: '#3b82f6', imiePlik: 'gi0.txt', inicjalPlik: 'gl0.txt' }, { plik: 'g1.jpg', kolor: '#ec4899', imiePlik: 'gi1.txt', inicjalPlik: 'gl1.txt' }], naglowekPlik: 'n.txt', czcionka: 'c.ttf', czas: 5, audio: null, wyjscie: 'g.mp4' });
    assert.equal(ga[ga.indexOf('g0.mp4') - 5], '-stream_loop');
    assert.equal(ga[ga.indexOf('g1.jpg') - 7], '-loop');
    assert.match(ga[ga.indexOf('-filter_complex') + 1], /\[1:v\]fps=25,scale=300:400/);
    const ka = argumentyKadru({ tlo: { plik: 't.jpg', ox: 0.5, oy: 0.6 }, karta: 'k.mov', kolor: '#ff0000', imiePlik: 'i.txt', liniePliki: ['l0.txt'], czcionka: 'c.ttf', czas: 4, audio: 'a.wav', wyjscie: 's.mp4' });
    assert.ok(ka.includes('-stream_loop'));
});

test('PRAWDZIWE wideo z gośćmi: klip aktora gra na karcie (ruch między klatkami), gość ze zdjęciem i bez nadal działają', { skip: !czcionka && 'brak czcionki z polskimi znakami' }, async () => {
    const tmp = tmpDir('wideo-ff');
    const klip = path.join(tmp, 'kael.mp4');
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x480:r=25:d=1.5', '-pix_fmt', 'yuv420p', klip]);   // krótszy niż wideo gości → musi się zapętlić
    const S = utworzStudioPodcastu({
        katalog: path.join(tmp, 'studio'), paczka: PACZKA, ffmpeg: ffmpegPath, opisz, katalogMontazy: async () => tmp,
        aktorzy: async () => [{ ...KAEL, wideo: klip, zdjecie: path.join(PACZKA, 'prowadzacy.jpg') }, { ...ELARA, zdjecie: path.join(PACZKA, 'prowadzacy.jpg') }, { id: 'zed', imie: 'Zed', rola: 'x', kolor: '#10b981', zdjecie: null, glos: null }],
        chat: async () => ({ tekst: 'TeO: Witajcie.\nKAEL: Hej.\nELARA: Cześć.\nZED: Siema.' }),
    });
    const x = await S.przygotuj({ temat: 'Klipy', goscie: ['kael', 'elara', 'zed'] });
    const r = await S.zrobGosci(x.id, { bezGlosu: true });
    assert.ok(r.sekundy >= 7.4, `3 gości = min. 7,5 s, jest ${r.sekundy} (klip ma 1,5 s → pętla)`);
    const ramka = (t, f) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', r.goscieFilm, '-frames:v', '1', '-vf', 'crop=300:400:300:170,scale=60:80', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
    const a = ramka(1.0), b = ramka(1.7), c = ramka(4.0);
    assert.notDeepEqual(a, b, 'klip się rusza (testsrc2)');
    assert.notDeepEqual(b, c, 'po końcu klipu (1,5 s) gra dalej — pętla');
});

test('styl i Pralka: styl trafia do promptu (domyślny bez dopisku), Pralka 1–9 → temperatura modelu, 0/brak = domyślna', async () => {
    const { STYLE_WYWIADU, temperaturaZPralki, promptDogrywki } = await import('../services/StudioPodcastu.js');
    assert.deepEqual(Object.keys(STYLE_WYWIADU), ['domyslny', 'komediowy', 'luzny', 'deep', 'mistyczny']);
    const p = (styl) => promptOdcinka({ prowadzacy: { imie: 'TeO', rola: 'x' }, goscie: [KAEL], temat: 't', styl }).system;
    assert.match(p('komediowy'), /STYL: komediowy/);
    assert.match(p('mistyczny'), /STYL: mistyczny/);
    assert.doesNotMatch(p('domyslny'), /STYL:/);
    assert.doesNotMatch(p('nieznany'), /STYL:/);
    assert.deepEqual([1, 5, 9, 12].map(temperaturaZPralki), [0.3, 0.8, 1.3, 1.3]);
    assert.equal(temperaturaZPralki(0), null);
    assert.equal(temperaturaZPralki(undefined), null);
    const d = promptDogrywki({ prowadzacy: { imie: 'TeO', rola: 'x' }, goscie: [KAEL], temat: 'Kosmos', kwestie: [{ kto: 'prowadzacy', tekst: 'Witajcie.' }, { kto: 'kael', tekst: 'Leciałem.' }], imie: (k) => (k === 'prowadzacy' ? 'TeO' : 'Kael'), styl: 'deep', runda: 1, jezyk: 'en' });
    assert.match(d.system, /DALSZY CIĄG.*runda 2/);
    assert.match(d.system, /PO ANGIELSKU/);
    assert.match(d.system, /STYL: deep/);
    assert.match(d.user, /TEO: Witajcie\.\nKAEL: Leciałem\./);
});

test('scenariusz ze stylem i Pralką → temperatura do modelu; dogrywka: pożegnanie wypada i wraca na końcu, rundy liczone, limit', async () => {
    const katalog = tmpDir('dogr');
    const wolania = [];
    const S = utworzStudioPodcastu({
        katalog, paczka: PACZKA, aktorzy: async () => [KAEL], opisz, katalogMontazy: async () => katalog,
        chat: async (_m, system, _u, opcje) => {
            wolania.push({ system, opcje });
            return /DALSZY CIĄG/.test(system)
                ? { tekst: `TEO: Nowy wątek ${wolania.length}?\nKAEL: Odpowiadam ${wolania.length}.\nTEO: Dziękuję, do zobaczenia!` }
                : { tekst: 'TEO: Witajcie.\nKAEL: Dzień dobry.\nTEO: Pa, do następnego!' };
        },
    });
    const x = await S.przygotuj({ temat: 'Kosmos', goscie: ['kael'], styl: 'komediowy', pralka: 9 });
    assert.equal(x.styl, 'komediowy');
    assert.equal(x.pralka, 9);
    assert.equal(x.rundy, 1);
    assert.deepEqual(wolania[0].opcje, { temperatura: 1.3 });
    assert.match(wolania[0].system, /STYL: komediowy/);
    const d = await S.dogrywka(x.id, { rundy: 2 });
    assert.equal(d.rundy, 3);
    assert.deepEqual(d.kwestie.map((k) => k.tekst), ['Witajcie.', 'Dzień dobry.', 'Nowy wątek 2?', 'Odpowiadam 2.', 'Nowy wątek 3?', 'Odpowiadam 3.', 'Dziękuję, do zobaczenia!']);
    assert.match(wolania[1].system, /STYL: komediowy/, 'styl odcinka przechodzi na dogrywkę');
    assert.deepEqual(wolania[1].opcje, { temperatura: 1.3 });
    const e = await S.dogrywka(x.id, { rundy: 3, styl: 'deep', pralka: 1 });
    assert.equal(e.rundy, 6);
    assert.equal(e.styl, 'deep');
    assert.deepEqual(wolania.at(-1).opcje, { temperatura: 0.3 });
    await assert.rejects(S.dogrywka(x.id), /limit 6/);
});

test('wiele studiów: pierwsze z paczki, nowe bez ujęć z własnym prowadzącym i katalogiem montaży; lista, osobne odcinki, usuwanie', async () => {
    const { utworzStudia, STUDIO_DOMYSLNE } = await import('../services/StudioPodcastu.js');
    const katalog = tmpDir('studia');
    const montaze = [];
    const R = utworzStudia({ katalog, paczka: PACZKA, aktorzy: async () => [KAEL], opisz, katalogMontazy: async (p) => { montaze.push(p); return katalog; }, chat: async () => ({ tekst: 'MIRA: Hej.\nKAEL: Hej.\nMIRA: Pa.' }) });
    assert.equal(STUDIO_DOMYSLNE, 'teo');
    const [teo] = await R.lista();
    assert.equal(teo.id, 'teo'); assert.equal(teo.ujec, 3); assert.equal(teo.domyslne, true);
    await assert.rejects(R.stworz({ nazwa: '' }), /nazwy/);
    await assert.rejects(R.stworz({ nazwa: 'Nocne Radio' }), /prowadzącego/);
    const n = await R.stworz({ nazwa: 'Nocne Radio Miry', opis: 'Dach w deszczu', prowadzacy: { imie: 'Mira', rola: 'DJ-ka', kolor: '#ff00aa' } });
    assert.equal(n.id, 'nocne-radio-miry'); assert.equal(n.ujec, 0); assert.equal(n.prowadzacy, 'Mira');
    const st = await R.get(n.id).studio();
    assert.equal(st.prowadzacy.kolor, '#ff00aa'); assert.equal(st.opis, 'Dach w deszczu'); assert.equal(st.wstep.nagranie, null);
    const odc = await R.get(n.id).przygotuj({ temat: 'Noc', goscie: ['kael'] });
    assert.equal(odc.kwestie[0].kto, 'prowadzacy', 'Mira rozpoznana jako prowadząca swojego studia');
    assert.equal((await R.get('teo').odcinki()).length, 0, 'odcinki studiów osobno');
    await assert.rejects(R.get(n.id).nagraj(odc.id, { zWstepem: false, zGoscmi: false, bezGlosu: true }), /ujęcia/);
    assert.deepEqual((await R.lista()).map((x) => x.id), ['teo', 'nocne-radio-miry']);
    assert.throws(() => R.get('../etc'), /Nie ma studia/);
    await assert.rejects(R.usun('teo'), /Pierwszego studia/);
    await R.usun(n.id);
    assert.deepEqual((await R.lista()).map((x) => x.id), ['teo']);
});
