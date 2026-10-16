// 🩰 Taniec w Zebrra Sports — fakty z choreografii (ocena, ranga, ruchy, turnieje, Game Show), scenariusz tylko z faktów
// (liczby spoza faktów odrzucone), skład prowadzących, trasy HTTP z prawdziwym nagraniem webm → mp4 → publikacja.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import express from 'express';
import { utworzZebrraTaniec, zamontujTrasyZebrraTanca, faktyWystepu, odczytajScenariusz, sprawdzLiczby, kwestieOdcinka, ktoMowiTaniec, promptScenariusza, nazwaRuchu } from '../services/ZebrraTaniec.js';
import { liczbyPozaFaktami } from '../services/OdcinkiStudia.js';
import { programZPliku, jezykZPliku } from '../services/Formaty.js';

const CHOREO = {
    id: 'c-0000aaaa', nazwa: 'Wizz — T1', mini: { id: 'mini-1', nazwa: 'Wizz' },
    utwor: { tytul: 'T1', bpm: 132.9, okresSek: 0.45 }, fraza: 16,
    frazy: [{ od: 0, uderzen: 16, energia: 0.1 }, { od: 7, uderzen: 16, energia: 0.3 }, { od: 14, uderzen: 16, energia: 0.2 }, { od: 21, uderzen: 16, energia: 0.25 }],
    ruchy: [{ nazwa: 'All_Night_Dance', sek: 8, moc: 2.1 }, { nazwa: 'Armature|Arm_Circle_Shuffle', sek: 9, moc: 1.9 }, { nazwa: 'Bass_Beats', sek: 6, moc: 3.4 }],
    uklad: [0, 1, 0, 2], ocena: { wynik: 74, takt: 0.533, energia: 0.925, roznorodnosc: 0.814 },
    nagrania: [{ nazwa: 'taniec_Wizz_T1_aaaaaa.mp4' }],
};

test('fakty występu: tancerz, utwór z BPM, ocena w procentach, ranga, najczęstsze i najmocniejsze ruchy, turnieje, Game Show', () => {
    const f = faktyWystepu(CHOREO, { turnieje: [{ okres: 'dzien' }, { okres: 'zly' }], gameShow: { tytul: 'TeO Game Show: Wizz', url: 'https://youtu.be/abc' }, klip: 'k.mp4' });
    assert.equal(f.tancerz, 'Wizz');
    assert.deepEqual(f.utwor, { tytul: 'T1', bpm: 133, plik: null });
    assert.deepEqual(f.ocena, { wynik: 74, takt: 53, energia: 93, roznorodnosc: 81 });
    assert.equal(f.ranga, 'B');
    assert.deepEqual(f.ruchy, ['All Night Dance', 'Bass Beats', 'Arm Circle Shuffle'], 'najczęstszy pierwszy, remis — mocniejszy');
    assert.equal(f.najmocniejszy, 'Bass Beats');
    assert.equal(f.ruchow, 3);
    assert.deepEqual(f.turnieje, ['dzien'], 'nieznany okres pominięty');
    assert.equal(f.gameShow.url, 'https://youtu.be/abc');
    assert.equal(nazwaRuchu('Armature|Hip_Hop-Move'), 'Hip Hop Move');
});

test('liczby spoza faktów: wynik, procenty, BPM przechodzą; zmyślona liczba odrzucona', () => {
    assert.deepEqual(liczbyPozaFaktami('74 punkty, takt 53%, 132,9 BPM', [74, 53, 132.9]), []);
    assert.deepEqual(liczbyPozaFaktami('aż 9000 widzów i 74', [74]), ['9000']);
    const w = [faktyWystepu(CHOREO)];
    const sc = odczytajScenariusz('INTRO: Dobry wieczór!\nWYSTĘP 1: Wizz tańczy do T1, 133 BPM.\nOCENA 1: 74 na 100, ranga B, energia 93%.\nRUCHY 1: 3 ruchy, najmocniejszy Bass Beats.\nOUTRO: Do jutra!', 1);
    assert.equal(sprawdzLiczby(sc, w), null);
    assert.match(sprawdzLiczby({ ...sc, outro: 'Wizz był 5. w rankingu z 2025 roku!' }, w), /OUTRO \(5, 2025\)/);
});

test('scenariusz: wszystkie linie obowiązkowe, kontynuacje doklejane, markdown zdjęty', () => {
    const sc = odczytajScenariusz('**INTRO:** Witajcie\nw studiu!\nWYSTEP 1: A\nOCENA 1: B\nRUCHY 1: C\nWYSTEP 2: D\nOCENA 2: E\nRUCHY 2: F\nOUTRO: G', 2);
    assert.equal(sc.intro, 'Witajcie w studiu!');
    assert.equal(sc.wystepy[1].ruchy, 'F');
    assert.throws(() => odczytajScenariusz('INTRO: a\nWYSTEP 1: b\nOUTRO: c', 1), /OCENA 1, RUCHY 1/);
});

test('skład: prowadzący zapowiada, współprowadzący po kolei oceniają i opisują ruchy; prompt zna temperamenty i przydział', () => {
    const s = { narrator: 'zebra', wspolprowadzacy: ['lew', 'lampart'] };
    assert.deepEqual([['wystep', 0], ['ocena', 0], ['ruchy', 0], ['ocena', 1], ['ruchy', 1], ['outro', 0]].map(([t, i]) => ktoMowiTaniec(t, s, i)), ['zebra', 'lew', 'lampart', 'lew', 'lampart', 'zebra']);
    assert.equal(ktoMowiTaniec('ocena', { narrator: 'zebra', wspolprowadzacy: [] }, 0), 'zebra');
    const p = promptScenariusza({ wystepy: [faktyWystepu(CHOREO, { turnieje: [{ okres: 'mistrzostwa' }] })], narrator: 'zebra', wspolprowadzacy: ['lew'], jezyk: 'pl', s: { narrator: 'zebra', wspolprowadzacy: ['lew'] } });
    assert.match(p.system, /Gol Donna/);
    assert.match(p.system, /trzeciej osobie/);
    assert.match(p.system, /OCENA 1 → Zlat Kadabra/);
    assert.match(p.user, /prowadzi w: Mistrzostwa Świata/);
    assert.match(p.user, /74\/100, ranga B/);
});

test('trasy na prawdziwym ffmpeg: odcinek z choreografii → scenariusz (1. wersja ze zmyśloną liczbą odrzucona) → studio → nagranie webm → mp4 → publikacja', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'zebrra-taniec-'));
    try {
        const montaz = (p) => path.join(kat, 'montaz', p);
        await fs.mkdir(montaz('taneczne-starcie'), { recursive: true });
        const klip = path.join(montaz('taneczne-starcie'), CHOREO.nagrania[0].nazwa);
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=320x240:r=25:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', klip]);
        const webm = path.join(kat, 'nagranie.webm');   // to, co oddaje MediaRecorder: VP8 + Opus
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=1280x720:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libvpx', '-b:v', '800k', '-c:a', 'libopus', '-shortest', webm]);
        const prosby = [], publikacje = [];
        const DOBRY = 'INTRO: Dobry wieczór w Zebrra Sports!\nWYSTEP 1: Wizz i utwór T1.\nOCENA 1: 74 na 100, ranga B.\nRUCHY 1: 3 różne ruchy.\nOUTRO: Do zobaczenia!';
        const T = utworzZebrraTaniec({
            katalog: kat, ffmpeg: ffmpegPath, katalogMontazy: async (p) => montaz(p),
            choreografie: { wczytaj: async (id) => { if (id !== CHOREO.id) throw new Error('Nie ma takiej choreografii.'); return CHOREO; }, lista: async () => [CHOREO], moje: async () => [{ okres: 'dzien', wynik: { choreografia: CHOREO.id } }] },
            gameShow: async () => [{ id: 's-1', choreografia: { id: CHOREO.id }, publikacja: { id: 'yt_1', tytul: 'Stary tytuł' } }],
            publikacja: async () => ({ id: 'yt_1', tytul: 'TeO Game Show: Wizz', url: 'https://youtu.be/xyz' }),
            chat: async (_m, _s, user) => { prosby.push(user); return { tekst: prosby.length === 1 ? DOBRY.replace('Do zobaczenia!', 'Do zobaczenia o 22!') : DOBRY }; },
            mow: async ({ glos }) => ({ audio: execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=duration=0.5', '-f', 'wav', '-']), ext: 'wav', glos }),
            publikuj: async (z) => { publikacje.push(z); return { id: 'yt_new', etap: 'przygotowuje' }; },
            kanal: async () => 'UC-zebrra',
        });
        const app = express(); app.use(express.json());
        zamontujTrasyZebrraTanca(app, T, { raw: express.raw });
        const serwer = app.listen(0);
        const u = (p) => `http://127.0.0.1:${serwer.address().port}${p}`;
        try {
            const lista = await (await fetch(u('/api/zebrra-taniec'))).json();
            assert.equal(lista.choreografie[0].zNagraniem, true);
            const bez = await (await fetch(u('/api/zebrra-taniec'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wystepy: ['c-0000bbbb'] }) })).json();
            assert.equal(bez.success, false);
            const r = await (await fetch(u('/api/zebrra-taniec'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wystepy: [CHOREO.id], narrator: 'zebra', wspolprowadzacy: ['lew', 'zebra', 'nikt'], jezyk: 'pl' }) })).json();
            assert.equal(r.success, true, r.message);
            assert.deepEqual(r.odcinek.wspolprowadzacy, ['lew'], 'prowadzący i nieznani odfiltrowani');
            assert.equal(r.odcinek.wystepy[0].gameShow.url, 'https://youtu.be/xyz');
            await T.czekaj();
            const st = await (await fetch(u(`/api/zebrra-taniec/${r.odcinek.id}/studio`))).json();
            assert.equal(st.odcinek.stan, 'studio', st.odcinek.powod);
            assert.equal(prosby.length, 2, 'pierwsza wersja (liczba 22 spoza faktów) odrzucona');
            assert.match(prosby[1], /POPRZEDNIA WERSJA ODRZUCONA: liczby spoza faktów: OUTRO \(22\)/);
            assert.deepEqual(st.kwestie.map((k) => `${k.typ}:${k.kto}`), ['intro:zebra', 'wystep:zebra', 'ocena:lew', 'ruchy:lew', 'outro:zebra']);
            assert.equal(st.wystepy[0].link, 'https://youtu.be/xyz');
            const k = await fetch(u(st.wystepy[0].klipUrl));
            assert.equal(k.status, 200);
            assert.equal((await fetch(u(`/api/zebrra-taniec/${r.odcinek.id}/klip/5`))).status, 404);
            const g = await fetch(u(`/api/zebrra-taniec/${r.odcinek.id}/glos/3`));
            assert.equal(g.status, 200); assert.equal(g.headers.get('x-glos-kto'), 'lew');
            const n = await (await fetch(u(`/api/zebrra-taniec/${r.odcinek.id}/studio?prowadzacy=zebra,lew`), { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: await fs.readFile(webm) })).json();
            assert.equal(n.success, true, n.message);
            assert.equal(n.odcinek.stan, 'do_akceptacji');
            assert.match(path.basename(n.odcinek.plik), /^zebrra_taniec_Wizz_zebra\+lew_pl_[0-9a-f]{8}\.mp4$/);
            assert.ok((await fs.stat(n.odcinek.plik)).size > 1000, 'mp4 zapisany');
            assert.match(execFileSync(ffmpegPath, ['-hide_banner', '-i', n.odcinek.plik, '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) + '', /|/);
            assert.equal(publikacje[0].kanalId, 'UC-zebrra');
            assert.match(publikacje[0].kontekst, /Full TeO Game Show episode: https:\/\/youtu\.be\/xyz/);
            assert.match(publikacje[0].kontekst, /score 74\/100, rank B/);
            assert.deepEqual(programZPliku(n.odcinek.plik), { id: 'zebrra-taniec', nazwa: '🩰 Zebrra Sports · Taniec' }, '📱 Formaty rozpoznają program');
            assert.equal(jezykZPliku(n.odcinek.plik), 'pl');
            // poprawka Suwerena zdejmuje nagranie
            const p = await (await fetch(u(`/api/zebrra-taniec/${r.odcinek.id}/scenariusz`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenariusz: { outro: 'Dobranoc!' } }) })).json();
            assert.equal(p.odcinek.scenariusz.outro, 'Dobranoc!');
            assert.equal(p.odcinek.plik, null);
            assert.equal(kwestieOdcinka(p.odcinek).length, 5);
        } finally { serwer.close(); }
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
