// 🦎 Mame Leon Show — goście z faktów (wyklute TeOgochi, istniejące bryły), rozmowa tylko gospodarza i gości z nastrojami,
// liczby spoza faktów odrzucone, trasy HTTP z prawdziwym nagraniem webm → mp4 → publikacja, poprawka Suwerena.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import express from 'express';
import { utworzMameLeon, zamontujTrasyMameLeon, imieBryly, odczytajRozmowe, nastrojZEtykiety, sprawdzLiczby, kwestieOdcinka, promptRozmowy } from '../services/MameLeonShow.js';
import { programZPliku } from '../services/Formaty.js';

const GOSCIE = [{ imie: 'Joanna' }, { imie: 'Kot Tancerz' }];
const ROZMOWA = [
    'MAME LEON [ciepły]: Dobry wieczór! Dziś o muzyce.',
    'Joanna: Dziękuję za zaproszenie.',
    'MAME LEON [ciekawy]: Kot, jak się tańczy?',
    'Kot Tancerz: Lekko, na palcach.',
    'Joanna: A ja śpiewam: zawsze rano.',
    'Kot Tancerz: I dużo ćwiczę.',
    'MAME LEON [rozbawiony]: Moja skóra robi się żółta.',
    'MAME LEON [wzruszony]: Dziękuję, dobranoc!',
].join('\n');

test('nastroje: etykiety pl i en, z polskimi znakami i bez', () => {
    assert.equal(nastrojZEtykiety('ciepły'), 'cieply');
    assert.equal(nastrojZEtykiety('Amused'), 'rozbawiony');
    assert.equal(nastrojZEtykiety('wzruszony'), 'wzruszony');
    assert.equal(nastrojZEtykiety('wściekły'), null);
});

test('imię gościa-bryły: nazwa z cudzysłowu w opisie, inaczej nazwa assetu bez przedrostka', () => {
    assert.equal(imieBryly({ nazwa: 'mini-teogochi-kot-tancerz-wariant-sy', opis: 'Mini-TeOgochi „Kot Tancerz”, wariant „Synthwave Kociak”: futro…' }), 'Kot Tancerz');
    assert.equal(imieBryly({ nazwa: 'mini-teogochi-zorzanek-smukly', opis: 'stworek bez nazwy' }), 'Zorzanek smukly');
    assert.equal(imieBryly({}), 'Gość');
});

test('rozmowa: mówcy po imieniu, nastrój gospodarza, dwukropek w środku zdania to nie mówca; obcy mówca i milczący gość odrzuceni', () => {
    const r = odczytajRozmowe(ROZMOWA, GOSCIE);
    assert.deepEqual(r.map((k) => k.kto), ['kameleon', 'g1', 'kameleon', 'g2', 'g1', 'g2', 'kameleon', 'kameleon']);
    assert.equal(r[2].nastroj, 'ciekawy');
    assert.equal(r[4].tekst, 'A ja śpiewam: zawsze rano.');
    assert.throws(() => odczytajRozmowe(`${ROZMOWA}\nWidownia: Brawo!`, GOSCIE), /spoza programu: Widownia/);
    assert.throws(() => odczytajRozmowe(ROZMOWA.replace('Kot Tancerz: I dużo ćwiczę.', 'Joanna: I dużo ćwiczę.'), GOSCIE), /mniej niż dwa razy: Kot Tancerz/);
    assert.throws(() => odczytajRozmowe(['Joanna: Hej!', ...ROZMOWA.split('\n').slice(1)].join('\n'), GOSCIE), /otwiera Mame Leon/);
});

test('liczby: tylko z tematu, uwag i faktów gości; prompt zna temperament i fakty', () => {
    const s = { temat: 'Muzyka w 2026', uwagi: '', goscie: [{ imie: 'Joanna', rodzaj: 'teogochi', dziedzina: 'Muzyka', xp: 39286 }, { imie: 'Kot Tancerz', rodzaj: 'bryla', opis: 'kot z 3 ogonami' }], jezyk: 'pl' };
    assert.equal(sprawdzLiczby([{ kto: 'g1', tekst: 'Mam 39286 XP i 3 ogony w 2026, nas jest 2.' }], s), null);
    assert.match(sprawdzLiczby([{ kto: 'g1', tekst: 'Mam 7 nagród.' }], s), /linia 1 \(7\)/);
    const p = promptRozmowy(s);
    assert.match(p.system, /kameleon/);
    assert.match(p.system, /MAME LEON \[nastrój\]/);
    assert.match(p.user, /Joanna — TeOgochi ze stada Katedry, dziedzina: Muzyka, 39286 XP/);
    assert.match(p.user, /Kot Tancerz — postać z Assetów 3D Katedry: kot z 3 ogonami/);
});

test('trasy na prawdziwym ffmpeg: goście sprawdzeni → rozmowa (pierwsza ze zmyśloną liczbą odrzucona) → głosy → nagranie → mp4 → publikacja; poprawka zdejmuje nagranie', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'mame-leon-'));
    try {
        const webm = path.join(kat, 'nagranie.webm');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=1280x720:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', '-c:v', 'libvpx', '-b:v', '800k', '-c:a', 'libopus', '-shortest', webm]);
        const prosby = [], glosy = [], publikacje = [];
        const L = utworzMameLeon({
            katalog: kat, ffmpeg: ffmpegPath, katalogMontazy: async (p) => path.join(kat, 'montaz', p),
            stado: async () => ({ wyklute: ['joanna', 'kameleon'], stany: { joanna: { name: 'Joanna', xp: 39286.4 } } }),
            karta: async (id) => (id === 'joanna' ? { imie: 'Joanna', dziedzina: 'Muzyka' } : null),
            bryla: async (id) => (id === 'kot-1' ? { nazwa: 'Kot Tancerz', opis: 'czarny kot z opalem' } : null),
            chat: async (_m, _s, user) => { prosby.push(user); return { tekst: prosby.length === 1 ? ROZMOWA.replace('dobranoc!', 'dobranoc o 23!') : ROZMOWA }; },
            mow: async ({ glos }) => { glosy.push(glos); return { audio: execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=duration=0.4', '-f', 'wav', '-']), ext: 'wav' }; },
            publikuj: async (z) => { publikacje.push(z); return { id: 'yt_ml', etap: 'przygotowuje' }; },
        });
        const app = express(); app.use(express.json());
        zamontujTrasyMameLeon(app, L, { raw: express.raw });
        const serwer = app.listen(0);
        const u = (p) => `http://127.0.0.1:${serwer.address().port}${p}`;
        const post = (p, b) => fetch(u(p), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
        try {
            const g = await (await fetch(u('/api/mame-leon'))).json();
            assert.deepEqual(g.kandydaci.map((k) => k.id), ['joanna'], 'gospodarz nie siada na kanapie');
            assert.equal(g.kandydaci[0].xp, 39286);
            assert.match((await post('/api/mame-leon', { temat: 'Muzyka', goscie: [{ rodzaj: 'teogochi', id: 'kodeks' }] })).message, /nie jest wyklute/);
            assert.match((await post('/api/mame-leon', { temat: 'Muzyka', goscie: [{ rodzaj: 'bryla', id: 'brak' }] })).message, /Nie ma bryły/);
            assert.match((await post('/api/mame-leon', { temat: 'Muzyka', goscie: [1, 2, 3, 4].map(() => ({ rodzaj: 'teogochi', id: 'joanna' })) })).message, /najwyżej 3/);
            const r = await post('/api/mame-leon', { temat: 'Muzyka i taniec', jezyk: 'pl', goscie: [{ rodzaj: 'teogochi', id: 'joanna' }, { rodzaj: 'bryla', id: 'kot-1', glos: 'aktor' }] });
            assert.equal(r.success, true, r.message);
            assert.deepEqual(r.odcinek.goscie.map((x) => [x.imie, x.glos, x.bryla]), [['Joanna', 'joanna', null], ['Kot Tancerz', 'aktor', 'kot-1']]);
            await L.czekaj();
            const st = await (await fetch(u(`/api/mame-leon/${r.odcinek.id}/studio`))).json();
            assert.equal(st.odcinek.stan, 'studio', st.odcinek.powod);
            assert.equal(prosby.length, 2);
            assert.match(prosby[1], /liczby spoza faktów: linia 8 \(23\)/);
            assert.deepEqual(st.kwestie.slice(0, 4).map((k) => [k.kto, k.imie, k.glos]), [['kameleon', 'Mame Leon', 'kameleon'], ['g1', 'Joanna', 'joanna'], ['kameleon', 'Mame Leon', 'kameleon'], ['g2', 'Kot Tancerz', 'aktor']]);
            assert.equal(st.kwestie[6].nastroj, 'rozbawiony');
            assert.equal(st.nastroje.rozbawiony.kolor, '#facc15');
            for (const nr of [1, 2, 4]) assert.equal((await fetch(u(`/api/mame-leon/${r.odcinek.id}/glos/${nr}`))).status, 200);
            assert.deepEqual(glosy, ['kameleon', 'joanna', 'aktor']);
            await fetch(u(`/api/mame-leon/${r.odcinek.id}/glos/1`));
            assert.equal(glosy.length, 3, 'głos liczony raz, potem ze schowka');
            const n = await (await fetch(u(`/api/mame-leon/${r.odcinek.id}/studio`), { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: await fs.readFile(webm) })).json();
            assert.equal(n.success, true, n.message);
            assert.equal(n.odcinek.stan, 'do_akceptacji');
            assert.match(path.basename(n.odcinek.plik), /^mameleon_Muzyka-i-taniec_pl_[0-9a-f]{8}\.mp4$/);
            assert.ok((await fs.stat(n.odcinek.plik)).size > 1000);
            assert.equal(publikacje[0].zrodlo.projekt, 'mame-leon-show');
            assert.match(publikacje[0].kontekst, /chameleon/);
            assert.deepEqual(programZPliku(n.odcinek.plik), { id: 'mame-leon', nazwa: '🦎 Mame Leon Show' });
            const p = await fetch(u(`/api/mame-leon/${r.odcinek.id}/rozmowa`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kwestie: [{ kto: 'kameleon', tekst: 'Witam!', nastroj: 'zaskoczony' }, { kto: 'g2', tekst: 'Miau.' }] }) }).then((x) => x.json());
            assert.equal(p.odcinek.plik, null);
            assert.deepEqual(kwestieOdcinka(p.odcinek).map((k) => k.nastroj), ['zaskoczony', null]);
            // 🪑 ruchy bryły na stałe w programie
            const pr = await fetch(u('/api/mame-leon/ruchy/kot-1'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ przydzial: { siedzi: 'Chair_Sit_Idle_F', mowi: ['Sitting_Answering_Questions', 'Sitting_Answering_Questions', ''], okrzyk: ['Sitting_Clap'] } }) }).then((x) => x.json());
            assert.deepEqual([pr.przydzial.siedzi, pr.przydzial.mowi, pr.przydzial.okrzyk], ['Chair_Sit_Idle_F', ['Sitting_Answering_Questions'], ['Sitting_Clap']]);
            assert.equal((await (await fetch(u('/api/mame-leon/ruchy'))).json()).ruchy['kot-1'].siedzi, 'Chair_Sit_Idle_F');
            assert.equal((await fetch(u('/api/mame-leon/ruchy/..%2Fx'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((x) => x.json())).success, false);
            await fetch(u('/api/mame-leon/ruchy/kot-1'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ przydzial: null }) });
            assert.equal((await (await fetch(u('/api/mame-leon/ruchy'))).json()).ruchy['kot-1'], undefined, 'null = studio dobiera samo');
            assert.match((await fetch(u(`/api/mame-leon/${r.odcinek.id}/rozmowa`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kwestie: [{ kto: 'g9', tekst: 'x' }] }) }).then((x) => x.json())).message, /Nieznany mówca/);
        } finally { serwer.close(); }
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

import { spawaj as spawajNaprawde, zestawKlockow } from '../services/Spawacz.js';
import { opisz as opiszNaprawde } from '../services/Montazownia.js';
import { promisify } from 'node:util';
import { execFile as execFileCb } from 'node:child_process';
test('🎬 oprawa KAŻDEGO odcinka: klocki „Klocki Mame Show” start/end przez Spawacza; brak startu = sam end + uwaga; ↻ oprawa po dołożeniu startu', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'mame-leon-oprawa-'));
    try {
        const klocki = path.join(kat, '_OtakOs_Klocki');
        await fs.mkdir(path.join(klocki, 'Klocki Mame Show', 'start'), { recursive: true });
        await fs.mkdir(path.join(klocki, 'Klocki Mame Show', 'end'), { recursive: true });
        const klocek = (p, kolor) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${kolor}:s=1920x1080:r=25:d=1.5`, '-f', 'lavfi', '-i', 'sine=frequency=500:duration=1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p]);
        klocek(path.join(klocki, 'Klocki Mame Show', 'end', 'end en.mp4'), 'blue');   // jak u Suwerena 2026-10-16: tylko end
        const webm = path.join(kat, 'n.webm');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=1280x720:r=30:d=2', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libvpx', '-b:v', '800k', '-c:a', 'libopus', '-shortest', webm]);
        const uruchom = promisify(execFileCb);
        const L = utworzMameLeon({
            katalog: kat, ffmpeg: ffmpegPath, katalogMontazy: async (p) => path.join(kat, 'montaz', p),
            stado: async () => ({ wyklute: ['joanna'], stany: { joanna: { name: 'Joanna', xp: 10 } } }),
            chat: async () => ({ tekst: ROZMOWA.replace('Kot Tancerz', 'Joanna').replace(/Kot Tancerz/g, 'Joanna') }),
            opisz: (p) => opiszNaprawde(p),
            klocki: () => zestawKlockow(klocki, 'MameShow'),
            spawaj: (o) => spawajNaprawde({ ...o, opisz: opiszNaprawde, uruchom, ffmpeg: ffmpegPath }),
        });
        const s0 = await L.utworz({ temat: 'Oprawa', jezyk: 'pl', goscie: [{ rodzaj: 'teogochi', id: 'joanna' }] });
        await L.czekaj();
        assert.equal((await L.wczytaj(s0.id)).stan, 'studio', (await L.wczytaj(s0.id)).powod);
        const s1 = await L.nagranie(s0.id, await fs.readFile(webm));
        assert.deepEqual(s1.oprawa, { start: [], end: ['end en.mp4'] }, 'odcinek po polsku bierze end po angielsku, gdy pl brak');
        assert.match(s1.uwagaOprawy, /brak klocków start w .*Klocki Mame Show/);
        assert.ok(s1.sekundy > 3.2 && s1.sekundy < 4.2, `nagranie 2 s + end 1,5 s, jest ${s1.sekundy}`);
        klocek(path.join(klocki, 'Klocki Mame Show', 'start', 'start pl.mp4'), 'red');
        const s2 = await L.przeoprawa(s0.id);
        assert.deepEqual(s2.oprawa, { start: ['start pl.mp4'], end: ['end en.mp4'] });
        assert.equal(s2.uwagaOprawy, null);
        assert.ok(s2.sekundy > 4.7 && s2.sekundy < 5.7, `start + nagranie + end, jest ${s2.sekundy}`);
        assert.equal(s2.plik, s1.plik, 'ten sam plik — publikacja czeka dalej');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
