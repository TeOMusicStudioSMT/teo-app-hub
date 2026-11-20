// 📻➡️🎛️ Box Muzyki jako album Jasona: prawdziwy ffmpeg, prawdziwe Boxy i paczki wydań na dysku.
// Suno i FLUX w tym teście nie biorą udziału — import pracuje WYŁĄCZNIE na plikach Katedry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { utworzBoxy, zamontujTrasyBoxow } from '../services/BoxyMuzyki.js';
import { utworzWydaniaBoxow } from '../services/WydaniaBoxow.js';
import { utworzJasona, zamontujTrasyJasona, stacjaZUtworuBoxu, albumBoxu, kluczStacji, okladkaZPlikow, naglowekWav, folderWydania } from '../services/JasonOrchestrator.js';
import { czyDlaSparowanych } from '../services/StrazMostu.js';

const uruchom = promisify(execFile);

test('stacja z utworu Boxu: Box = album, bez wymyślonego tekstu', () => {
    const box = { id: 'box-09-proba', nazwa: 'Próba Albumu', artysci: 'TeO' };
    assert.equal(albumBoxu(box), 'Próba Albumu');
    assert.equal(albumBoxu({ id: 'box-09-proba' }), 'box-09-proba');
    const s = stacjaZUtworuBoxu({ box, u: { nr: 3, tytul: 'Onyks' }, bpm: 128.4, sekundy: 211.7 });
    assert.equal(s.nr, 3); assert.equal(s.tytul, 'Onyks'); assert.equal(s.bpm, 128);
    assert.equal(s.sekundy, 212);
    assert.equal(s.lyrics, '', 'tekstu Katedra nie zna — nie zmyślamy go');
    assert.equal(s.styl, ''); assert.equal(s.instrumental, false);
    assert.match(s.opis, /Próba Albumu/);
    assert.equal(stacjaZUtworuBoxu({ box, u: { nr: 1, tytul: 'X' }, bpm: 11 }).bpm, null, 'tempo poza zakresem = brak tempa');
    assert.equal(stacjaZUtworuBoxu({ box, u: { nr: 1, tytul: 'X' } }).sekundy, null);
    assert.throws(() => stacjaZUtworuBoxu({ box, u: { nr: 1, tytul: '  ' } }), /tytu/i);
    // numer stacji powtarza się między albumami — klucz dubla musi brać album
    assert.notEqual(kluczStacji({ album: 'Próba Albumu', stacja: { nr: 1 } }), kluczStacji({ album: 'Zero Gravity Heart', stacja: { nr: 1 } }));
    assert.equal(kluczStacji({ album: 'Próba', stacja: { nr: 2 } }), kluczStacji({ album: 'próba', stacja: { nr: 2 } }));
    // okładka z katalogu Boxu
    assert.equal(okladkaZPlikow(['01.wav', 'cover.jpg', 'inne.png']), 'cover.jpg');
    assert.equal(okladkaZPlikow(['01.wav', 'jedyny.png']), 'jedyny.png', 'jedyny obraz w katalogu też jest okładką');
    assert.equal(okladkaZPlikow(['01.wav', 'a.png', 'b.png']), null, 'dwa obrazy bez znanej nazwy = nie zgadujemy');
    assert.equal(okladkaZPlikow(['01.wav', 'opis.txt']), null);
});

test('Straż: wciągnięcie Boxu wolno zlecić ze sparowanego telefonu (nie wydaje kredytów)', () => {
    assert.ok(czyDlaSparowanych('/api/jason/boxy'));
    assert.ok(czyDlaSparowanych('/api/jason/boxy/box-03-hidengirl/import'));
    for (const p of ['/api/jason/boxy/BOX/import', '/api/jason/boxy/x/import/dalej', '/api/jason/kampanie/j-1a2b3c4d/pobierz', '/api/jason/opodyski/wystaw']) {
        assert.ok(!czyDlaSparowanych(p), p);
    }
});

/** Album na dysku: dwa prawdziwe (krótkie) WAV-y i okładka — tak jak Boxy 02/03 Suwerena. */
async function katedra({ okladka = true } = {}) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jason-box-'));
    const muzyka = path.join(tmp, 'muzyka'), albumy = path.join(muzyka, "OtakOS RADIO Album's");
    const kat = path.join(albumy, 'proba-albumu');
    await fs.mkdir(kat, { recursive: true });
    for (const [n, f] of [['1. Pierwsza (Orion SMT).wav', 440], ['2. Druga (Elara S.M.T.).wav', 330]]) {
        await uruchom(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${f}:duration=1`, path.join(kat, n)]);
    }
    if (okladka) await uruchom(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=orange:s=64x64', '-frames:v', '1', path.join(kat, 'cover.jpg')]);
    const wydania = path.join(tmp, 'wydania');
    await fs.mkdir(wydania, { recursive: true });
    await fs.writeFile(path.join(wydania, 'boxy.json'), JSON.stringify({ boxy: [{ id: 'proba', nazwa: 'Próba Albumu', katalog: 'proba-albumu', artysci: 'TeO · 0.00G' }] }));
    const Boxy = utworzBoxy({ katalogMuzyki: albumy, katalogWydan: wydania, ffmpeg: ffmpegPath, uruchom });
    const Wydania = utworzWydaniaBoxow({ boxy: Boxy, katalogWydan: path.join(wydania, 'paczki'), ffmpeg: ffmpegPath, uruchom });
    const wiesci = [];
    const J = utworzJasona({ katalog: tmp, katalogMuzyki: muzyka, ffmpeg: ffmpegPath, uruchom,
        boxy: () => Boxy, wydaniaBoxow: () => Wydania, autor: async () => 'Mistrz Arkadiusz', wiesc: (t) => wiesci.push(t) });
    return { tmp, muzyka, albumy, kat, Boxy, Wydania, J, wiesci };
}

test('wciągnięcie Boxu: stacje „przyjęte” z paczką wydawniczą, tempo z Opodysku Boxów', async () => {
    const { tmp, muzyka, Boxy, Wydania, J, wiesci } = await katedra();
    try {
        // Suweren zmierzył tempo pierwszego utworu w przeglądarce („Opodysk Boxów”) — import ma je wziąć
        await Wydania.ustawTempo('proba', 1, { bpm: 128, sekundy: 1.5 });

        const spis = await J.boxyDoImportu();
        assert.deepEqual(spis.boxy.map((b) => [b.id, b.utworow, b.stacji, b.album]), [['proba', 2, 0, 'Próba Albumu']]);

        const w = await J.importujBox('proba');
        assert.equal(w.zrobione.length, 2); assert.equal(w.pominiete.length, 0); assert.deepEqual(w.bledy, []);
        assert.equal(w.box.album, 'Próba Albumu');
        assert.deepEqual(w.zrobione.map((x) => [x.nr, x.tytul, x.bpm]), [[1, 'Pierwsza', 128], [2, 'Druga', null]]);
        assert.ok(w.uwagi.some((u) => /nie ma tempa/.test(u)), 'mówimy wprost, że drugi utwór nie ma tempa');
        assert.ok(w.uwagi.some((u) => /storyboardu/.test(u)), 'mówimy wprost, czego te stacje nie mają');
        assert.ok(wiesci.some((t) => /Box „Próba Albumu” wciągnięty/.test(t)));

        const kampanie = (await J.lista()).filter((k) => k.zBoxu);
        assert.equal(kampanie.length, 2);
        const k1 = kampanie.find((k) => k.stacja.nr === 1);
        assert.equal(k1.stan, 'przyjeta', 'Teatr Opodysku bierze tylko przyjęte');
        assert.equal(k1.album, 'Próba Albumu');
        assert.equal(k1.zBoxu.box, 'proba');
        assert.match(k1.zBoxu.odcisk, /^[0-9a-f]{16}$/);
        assert.equal(k1.zBoxu.nazwaPliku, '1. Pierwsza (Orion SMT).wav');
        assert.deepEqual(k1.artysci, ['Orion SMT']);
        assert.equal(k1.stacja.bpm, 128);

        // paczka wydawnicza: ten sam układ co u kampanii Suno, master.wav 44,1 kHz / 16 bit / stereo
        assert.equal(k1.spotify.folder, folderWydania(k1));
        assert.equal(k1.spotify.folder, 'Spotify_Releases/Próba Albumu/01_Pierwsza');
        const kat = path.join(muzyka, ...k1.spotify.folder.split('/'));
        const pliki = (await fs.readdir(kat)).sort();
        assert.deepEqual(pliki, ['cover_3000x3000.jpg', 'master.wav', 'original.mp3', 'spotify_metadata.json']);
        const fd = await fs.open(path.join(kat, 'master.wav'), 'r'); const g = Buffer.alloc(4096); await fd.read(g, 0, 4096, 0); await fd.close();
        assert.deepEqual(naglowekWav(g), { pcm: true, hz: 44100, bity: 16, kanaly: 2 });
        assert.equal(k1.spotify.master.zrodlo, 'wav-boxu', 'master przepisany z ORYGINAŁU Boxu, nie z rendycji mp3');
        assert.ok(k1.spotify.master.sekundy > 0.5);
        assert.ok(k1.spotify.uwagi.some((u) => /1\. Pierwsza \(Orion SMT\)\.wav/.test(u)), 'uwaga mówi, z czego powstał master');
        assert.ok(k1.spotify.uwagi.some((u) => /Bez lyrics_clean\.txt/.test(u)));
        assert.ok(!k1.spotify.pliki.includes('lyrics_clean.txt'));
        const meta = JSON.parse(await fs.readFile(path.join(kat, 'spotify_metadata.json'), 'utf8'));
        assert.equal(meta.files.lyrics, null);
        assert.equal(k1.okladka.zBoxu, 'cover.jpg', 'okładka wzięta z katalogu Boxu');
        assert.ok((await fs.stat(path.join(kat, 'cover_3000x3000.jpg'))).size > 1000);

        // Teatr Opodysku widzi obie stacje — i nie gubi ich przy numerach wspólnych z albumem Suno
        const o = await J.opodyski();
        assert.deepEqual(o.utwory.filter((x) => x.zBoxu).map((x) => [x.nr, x.tytul, x.zBoxu.box]), [[1, 'Pierwsza', 'proba'], [2, 'Druga', 'proba']]);
        assert.ok(o.utwory.every((x) => x.audio && x.audio.endsWith('/audio')));
        assert.equal(o.utwory[0].spotifyLive, null, 'stacja z Boxu nie dziedziczy adresu albumu Suno');

        // z paczki gra Teatr: `original.mp3` istnieje i to ścieżka, której szuka most
        assert.equal(J.sciezkaAudio(k1), path.join(kat, 'original.mp3'));
        assert.ok((await fs.stat(J.sciezkaAudio(k1))).size > 100);

        // POWTÓRZENIE nic nie dubluje — rozpoznanie po odcisku pliku
        const w2 = await J.importujBox('proba');
        assert.equal(w2.zrobione.length, 0);
        assert.deepEqual(w2.pominiete.map((x) => x.nr), [1, 2]);
        assert.equal((await J.lista()).filter((k) => k.zBoxu).length, 2, 'nadal dwie stacje');

        // ↻ „uzupełnij” z nadpisaniem bierze nowe tempo i zostaje przy TEJ SAMEJ kampanii
        await Wydania.ustawTempo('proba', 2, { bpm: 90, sekundy: 1.5 });
        const w3 = await J.importujBox('proba', { nadpisz: true });
        assert.equal(w3.zrobione.length, 2);
        assert.ok(w3.zrobione.every((x) => x.nadpisana));
        const po = (await J.lista()).filter((k) => k.zBoxu);
        assert.equal(po.length, 2, 'nadpisanie nie tworzy nowych kampanii');
        assert.equal(po.find((k) => k.stacja.nr === 2).stacja.bpm, 90);
        assert.deepEqual((await J.boxyDoImportu()).boxy.map((b) => [b.stacji, b.zPaczka]), [[2, 2]]);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('Box bez okładki i Box, którego nie ma — powody wprost', async () => {
    const { tmp, J } = await katedra({ okladka: false });
    try {
        const w = await J.importujBox('proba');
        assert.equal(w.zrobione.length, 2);
        assert.ok(w.zrobione.every((x) => !x.okladka));
        assert.ok(w.uwagi.some((u) => /Przerysuj okładkę/.test(u)), 'mówimy, co zrobić, zamiast podstawiać atrapę');
        const k = (await J.lista()).find((x) => x.zBoxu);
        assert.ok(!k.spotify.pliki.includes('cover_3000x3000.jpg'));
        assert.equal(JSON.parse(await fs.readFile(path.join(tmp, 'muzyka', ...k.spotify.folder.split('/'), 'spotify_metadata.json'), 'utf8')).files.cover, null);
        await assert.rejects(() => J.importujBox('nie-ma-takiego'), /Box/i);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('trasy: spis Boxów i wciągnięcie przez HTTP', async () => {
    const { tmp, J } = await katedra();
    const app = express(); app.use(express.json());
    zamontujTrasyJasona(app, J);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    try {
        let d = await (await fetch(`${baza}/api/jason/boxy`)).json();
        assert.equal(d.success, true);
        assert.deepEqual(d.boxy.map((b) => [b.id, b.stacji]), [['proba', 0]]);

        d = await (await fetch(`${baza}/api/jason/boxy/proba/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
        assert.equal(d.success, true); assert.equal(d.zrobione.length, 2);
        assert.ok(!JSON.stringify(d).includes(tmp), 'ścieżki z dysku nie wychodzą trasą');

        const r = await fetch(`${baza}/api/jason/boxy/nie-ma/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(r.status, 404);
        assert.equal((await (await fetch(`${baza}/api/jason/boxy`)).json()).boxy[0].zPaczka, 2);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});
