// ⚽ Gol Dnia — fakty sprawdzane wynikiem, scenariusz w temperamencie narratora z pamięcią, prompty FLUX bez prawdziwych
// twarzy i herbów, cały łańcuch na prawdziwym ffmpeg (atrapy: Zwiadowca, narrator, FLUX, głos), studio innego narratora.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { utworzGolDnia, sprawdzGole, odczytajGole, odczytajScenariusz, promptScenariusza, promptyObrazow, meczZTheSportsDb, NARRATORZY } from '../services/GolDnia.js';

const MECZ = { id: '2494059', liga: 'English Premier League', data: '2026-10-12', gospodarze: 'Coventry City', goscie: 'Newcastle United', wynik: [2, 1], stadion: null };
const GOLE = [
    { minuta: '12', strzelec: 'Ellis Simms', druzyna: 'gospodarze', asysta: 'Jack Rudoni', opis: 'strzał głową po dośrodkowaniu' },
    { minuta: '55', strzelec: 'Alexander Isak', druzyna: 'goscie', asysta: null, opis: 'płaski strzał z 18 m' },
    { minuta: '90+2', strzelec: 'Haji Wright', druzyna: 'gospodarze', asysta: null, opis: 'rzut karny', karny: true },
];
const SCENARIUSZ = (n) => ['INTRO: Cześć! Dziś Coventry i Newcastle.', ...Array.from({ length: n }, (_, i) => [`PRZED ${i + 1}: To on.`, `OKRZYK ${i + 1}: Gooool!`, `PO ${i + 1}: Piękna bramka.`, `SCENA ${i + 1}: striker heads the ball into the net`]).flat(), 'OUTRO: Do jutra!'].join('\n');

test('fakty: liczba goli musi zgadzać się z wynikiem, minuty w meczu, strzelec i drużyna podane', () => {
    assert.equal(sprawdzGole(odczytajGole(JSON.stringify({ gole: GOLE })), [2, 1]), null);
    assert.match(sprawdzGole(odczytajGole(JSON.stringify({ gole: GOLE })), [3, 1]), /nie zgadzają się z wynikiem: gole 2:1, wynik meczu 3:1/);
    assert.match(sprawdzGole([{ ...GOLE[0], minuta: '140' }], [1, 0]), /poza meczem/);
    assert.match(sprawdzGole([{ ...GOLE[0], strzelec: '' }], [1, 0]), /brak strzelca/);
    assert.equal(odczytajGole('```json\n{"gole":[{"minuta":"7′","strzelec":"X","druzyna":"away"}]}\n```')[0].druzyna, 'goscie');
    assert.equal(odczytajGole('bez json'), null);
    assert.equal(meczZTheSportsDb({ idEvent: '1', strHomeTeam: 'A', strAwayTeam: 'B', intHomeScore: null, intAwayScore: '1' }), null, 'mecz bez wyniku pomijamy');
    assert.deepEqual(meczZTheSportsDb({ idEvent: '1', strHomeTeam: 'A', strAwayTeam: 'B', intHomeScore: '2', intAwayScore: '0', dateEvent: '2026-10-12' }).wynik, [2, 0]);
});

test('scenariusz: temperament narratora, pamięć strzelców i poprawek Suwerena; brak linii = odrzucony', () => {
    const p = promptScenariusza({ mecz: MECZ, gole: GOLE, narrator: 'byk', jezyk: 'pl', pamiec: { odcinkow: 4, zawodnicy: { 'Alexander Isak': { gole: 2, ostatnio: 'X – Y, 30\'' } }, poprawki: [{ co: 'intro', bylo: 'Witam', jest: 'Siema, kibice!' }] } });
    assert.match(p.system, /ognisty, z pazurem/);
    assert.match(p.system, /Alexander Isak: już 2 gol/);
    assert.match(p.system, /Siema, kibice!/);
    assert.match(p.system, /5\. odcinek/);
    assert.match(p.system, /nie wymyślasz statystyk/);
    assert.match(p.user, /90\+2' Haji Wright .*rzut karny/);
    const sc = odczytajScenariusz(SCENARIUSZ(3), 3);
    assert.equal(sc.gole.length, 3);
    assert.equal(sc.gole[2].scena, 'striker heads the ball into the net');
    assert.equal(odczytajScenariusz(SCENARIUSZ(2), 3), null, 'brak gola 3 = nie łatamy');
    // obrazy: kreska z temperamentu, barwy drużyny, bez prawdziwych twarzy i herbów
    const P = promptyObrazow({ mecz: MECZ, gole: GOLE, scenariusz: sc, narrator: 'byk' });
    assert.match(P.gole[1].scena, /kit colors of Newcastle United/);
    assert.match(P.gole[0].karta, /fiery reds/);
    assert.ok([P.intro, P.wynik, ...P.gole.flatMap((g) => [g.karta, g.scena])].every((x) => /no real faces, no club crests, no logos/.test(x)));
});

test('łańcuch na prawdziwym ffmpeg: zwiad → scenariusz → obrazy → segmenty → mp4 → publikacja; studio drugiego narratora bez nowego zwiadu', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'gol-dnia-'));
    try {
        const obraz = path.join(kat, 'kadr.png');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x2e7d32:s=640x360:d=1', '-frames:v', '1', obraz]);
        let zwiadow = 0, rysunkow = 0;
        const czaty = [], publikacje = [];
        const G = utworzGolDnia({
            katalog: kat, ffmpeg: ffmpegPath, katalogMontazy: async (p) => path.join(kat, 'montaz', p),
            zwiad: async () => { zwiadow++; return { tekst: JSON.stringify({ gole: GOLE }), zrodla: ['https://www.bbc.com/sport/football/x'] }; },
            chat: async (_m, system) => { czaty.push(system); return { tekst: SCENARIUSZ(3) }; },
            rysuj: async () => { rysunkow++; return obraz; },
            publikuj: async (z) => { publikacje.push(z); return { id: `yt_${publikacje.length}`, etap: 'do_akceptacji' }; },
        });
        const s0 = await G.utworz({ mecz: MECZ, narrator: 'pilkarka', jezyk: 'pl' });
        let s;
        for (let i = 0; i < 300; i++) { s = await G.wczytaj(s0.id); if (['gotowy', 'blad'].includes(s.stan)) break; await new Promise((r) => setTimeout(r, 100)); }
        assert.equal(s.stan, 'gotowy', s.powod ?? '');
        assert.equal(zwiadow, 1);
        assert.equal(rysunkow, 2 + 2 * 3, 'intro, wynik, karta i scena każdego gola');
        assert.equal(s.segmenty.length, 1 + 3 * 3 + 1, 'intro, przed/okrzyk/po × 3, outro');
        assert.match(path.basename(s.plik), /^gol_Coventry_City-Newcastle_United_pilkarka_pl_[0-9a-f]{8}\.mp4$/);
        assert.ok((await fs.stat(s.plik)).size > 10_000);
        assert.match(publikacje[0].kontekst, /original AI illustrations \(no match footage\)/);
        assert.deepEqual(publikacje[0].zrodlo, { projekt: 'gol-dnia', gol: s.id });
        assert.ok(s.uwagi.length === 0, 'bez silnika głosu nie ma uwagi o błędzie — po prostu napisy');
        // pamięć narratora po odcinku
        const p = await G.pamiec('pilkarka');
        assert.equal(p.odcinkow, 1);
        assert.equal(p.zawodnicy['Haji Wright'].gole, 1);
        // studio: ten sam mecz, inny narrator — bez drugiego zwiadu, z jego temperamentem
        const w = await G.wersja(s.id, 'krolik');
        let w2;
        for (let i = 0; i < 300; i++) { w2 = await G.wczytaj(w.id); if (['gotowy', 'blad'].includes(w2.stan)) break; await new Promise((r) => setTimeout(r, 100)); }
        assert.equal(w2.stan, 'gotowy', w2.powod ?? '');
        assert.equal(zwiadow, 1, 'fakty z pierwszego odcinka');
        assert.match(czaty.at(-1), new RegExp(NARRATORZY.krolik.temperament.slice(0, 20)));
        // zwiad niezgodny z wynikiem → odmowa, nic nie powstaje
        const Z = utworzGolDnia({ katalog: kat, katalogMontazy: async () => kat, zwiad: async () => ({ tekst: JSON.stringify({ gole: GOLE.slice(0, 2) }), zrodla: ['https://x.example'] }) });
        await assert.rejects(Z.utworz({ mecz: MECZ }), /nie zgadzają się z wynikiem/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

// ── 🦓🦁 Studio Zebrra Football: duet prowadzących, kwestie, odznaki-monogramy, tryb studia i nagranie z apki ──
import express from 'express';
import { kwestieOdcinka, ktoMowi, monogram, barwyZNazwy, barwyZDruzyny, PROWADZACY, zamontujTrasyGolDnia } from '../services/GolDnia.js';

test('duet: Gol Donna prowadzi, Zlat Kadabra komentuje gole; kwestie wspólne dla napisów i studia', () => {
    assert.deepEqual(PROWADZACY, ['zebra', 'lew']);
    assert.match(NARRATORZY.lew.temperament, /trzeciej osobie/);
    assert.equal(ktoMowi('okrzyk', { narrator: 'zebra', wspol: 'lew' }), 'lew');
    assert.equal(ktoMowi('przed', { narrator: 'zebra', wspol: 'lew' }), 'zebra');
    assert.equal(ktoMowi('po', { narrator: 'byk' }), 'byk', 'solo = wszystko mówi narrator');
    const p = promptScenariusza({ mecz: MECZ, gole: GOLE, narrator: 'zebra', wspol: 'lew', jezyk: 'en' });
    assert.match(p.system, /You are Gol Donna/);
    assert.match(p.system, /TOGETHER with Zlat Kadabra/);
    assert.match(p.system, /OKRZYK n and PO n are spoken by Zlat Kadabra/);
    const P = promptyObrazow({ mecz: MECZ, gole: GOLE, scenariusz: odczytajScenariusz(SCENARIUSZ(3), 3), narrator: 'zebra', wspol: 'lew' });
    assert.match(P.intro, /zebra .* together with a charismatic lion/);
    const s = { jezyk: 'en', narrator: 'zebra', wspol: 'lew', mecz: MECZ, gole: GOLE, scenariusz: odczytajScenariusz(SCENARIUSZ(3), 3), obrazy: { intro: 'intro.png', gole: [1, 2, 3].map((i) => ({ karta: `karta-${i}.png`, scena: `scena-${i}.png` })), wynik: 'wynik.png' } };
    const k = kwestieOdcinka(s);
    assert.equal(k.length, 1 + 3 * 3 + 1);
    assert.deepEqual(k.map((x) => x.kto), ['zebra', ...Array(3).fill(['zebra', 'lew', 'lew']).flat(), 'zebra']);
    assert.equal(k[1].obraz, 'karta-1.png');
    assert.equal(k[2].naglowek, "⚽ GOAL! 12'");
    assert.equal(k.at(-1).obraz, 'wynik.png');
    assert.deepEqual(k.map((x) => x.nr), k.map((_, i) => i + 1));
});

test('odznaki: monogram z nazwy (bez FC), barwy z TheSportsDB tylko przy zgodnej nazwie, inaczej stałe z nazwy', () => {
    assert.equal(monogram('Newcastle United'), 'NU');
    assert.equal(monogram('FC Barcelona'), 'BAR');
    assert.equal(monogram('Paris Saint-Germain'), 'PSG');
    assert.equal(monogram('1. FC Köln'), 'KOL');
    assert.deepEqual(barwyZDruzyny({ strTeam: 'Newcastle United', strColour1: '#000000', strColour2: '#FFFFFF' }, 'Newcastle United'), ['#000000', '#FFFFFF']);
    assert.equal(barwyZDruzyny({ strTeam: 'Arsenal', strColour1: '#EF0107' }, 'Newcastle United'), null, 'darmowy klucz oddał inną drużynę = nie bierzemy');
    const a = barwyZNazwy('Coventry City');
    assert.deepEqual(a, barwyZNazwy('Coventry City'));
    assert.ok(a.every((c) => /^#[0-9a-f]{6}$/.test(c)));
});

test('Studio Zebrra Football: odcinek „studio” czeka na nagranie, głos kwestii z pamięci, nagranie z apki → mp4 → publikacja; wersja z napisami dostaje studio OBOK', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'gol-studio-'));
    try {
        const obraz = path.join(kat, 'kadr.png');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x111111:s=640x360:d=1', '-frames:v', '1', obraz]);
        const wav = path.join(kat, 'g.wav');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', wav]);
        const webm = path.join(kat, 'nagranie.webm');   // to, co oddaje MediaRecorder: VP8 + Opus
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=1280x720:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libopus', '-shortest', webm]);
        const glosy = [], publikacje = [], czaty = [];
        const fetchAtrapa = async (u) => ({ ok: true, json: async () => ({ teams: [/id=134/.test(u) ? { strTeam: 'Coventry City', strColour1: '#87CEEB', strColour2: '#FFFFFF' } : { strTeam: 'Inna', strColour1: '#123456' }] }) });
        const G = utworzGolDnia({
            katalog: kat, ffmpeg: ffmpegPath, katalogMontazy: async (p) => path.join(kat, 'montaz', p), fetch: fetchAtrapa,
            chat: async (_m, system) => { czaty.push(system); return { tekst: SCENARIUSZ(3) }; },
            rysuj: async () => obraz,
            mow: async (o) => { glosy.push(o); return { audio: await fs.readFile(wav), ext: 'wav' }; },
            publikuj: async (z) => { publikacje.push(z); return { id: `yt_${publikacje.length}`, etap: 'do_akceptacji' }; },
        });
        const czekaj = async (id, stany) => { let s; for (let i = 0; i < 300; i++) { s = await G.wczytaj(id); if (stany.includes(s.stan)) return s; await new Promise((r) => setTimeout(r, 100)); } return s; };
        await assert.rejects(G.utworz({ mecz: MECZ, gole: GOLE, narrator: 'zebra', wspol: 'zebra' }), /innym narratorem/);
        const s0 = await G.utworz({ mecz: { ...MECZ, idGospodarzy: '134', idGosci: '999' }, gole: GOLE, narrator: 'zebra', wspol: 'lew', wideo: 'studio', jezyk: 'en' });
        let s = await czekaj(s0.id, ['studio', 'blad', 'gotowy']);
        assert.equal(s.stan, 'studio', s.powod ?? '');
        assert.equal(s.etapy.segmenty.stan, 'pominiety');
        assert.equal(glosy.length, 0, 'w trybie studia most nie robi segmentów z głosem');
        assert.equal(publikacje.length, 0);
        assert.match(czaty[0], /TOGETHER with Zlat Kadabra/);
        // barwy: gospodarze z TheSportsDB (nazwa zgodna), goście — inna drużyna w odpowiedzi → z nazwy
        const b = await G.barwy(s.id);
        assert.deepEqual(b.gospodarze, ['#87CEEB', '#FFFFFF']);
        assert.deepEqual(b.zrodlo, { gospodarze: 'thesportsdb', goscie: 'nazwa' });
        // głos kwestii: mówca z duetu, drugi raz z pamięci (bez drugiej syntezy)
        const g3 = await G.glos(s.id, 3);
        assert.equal(g3.kto, 'lew');
        assert.equal(glosy[0].narrator, 'lew');
        await G.glos(s.id, 3);
        assert.equal(glosy.length, 1);
        await assert.rejects(G.nagranieStudia(s.id, Buffer.alloc(100)), /puste albo za krótkie/);
        // nagranie przez trasę HTTP (express.raw) — tak wysyła apka Studia
        const app = express();
        zamontujTrasyGolDnia(app, G, { raw: express.raw });
        const serwer = app.listen(0);
        try {
            const port = serwer.address().port;
            const st = await (await fetch(`http://127.0.0.1:${port}/api/gol-dnia/${s.id}/studio`)).json();
            assert.equal(st.kwestie.length, 11);
            assert.deepEqual(st.monogramy, { gospodarze: 'CC', goscie: 'NU' });
            const a = await fetch(`http://127.0.0.1:${port}/api/gol-dnia/${s.id}/glos/2`);
            assert.equal(a.status, 200);
            assert.equal(a.headers.get('x-glos-kto'), 'zebra');
            await a.arrayBuffer();
            const r = await fetch(`http://127.0.0.1:${port}/api/gol-dnia/${s.id}/studio?prowadzacy=zebra,lew`, { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: await fs.readFile(webm) });
            const j = await r.json();
            assert.equal(r.status, 200, j.message);
        } finally { serwer.close(); }
        s = await czekaj(s.id, ['gotowy', 'blad']);
        assert.equal(s.stan, 'gotowy', s.powod ?? '');
        assert.match(path.basename(s.plik), /^gol_Coventry_City-Newcastle_United_studio_zebra\+lew_en_[0-9a-f]{8}\.mp4$/);
        assert.equal(s.plik, s.studio.plik);
        assert.ok((await fs.stat(s.plik)).size > 10_000);
        assert.equal(publikacje.length, 1);
        assert.match(publikacje[0].kontekst, /3D studio "Zebrra Football"/);
        assert.match(publikacje[0].nazwa, /Gol Donna & Zlat Kadabra · Studio Zebrra Football/);
        assert.deepEqual(publikacje[0].zrodlo, { projekt: 'gol-dnia', gol: s.id, studio: true });
        assert.equal((await G.pamiec('lew')).odcinkow, 1, 'pamięć obojga prowadzących');
        // odcinek z napisami (stado) → gotowy; nagranie ze studia = druga publikacja obok, film odcinka zostaje
        const n0 = await G.utworz({ mecz: MECZ, gole: GOLE, narrator: 'sowa', jezyk: 'pl' });
        const n = await czekaj(n0.id, ['gotowy', 'blad']);
        assert.equal(n.stan, 'gotowy', n.powod ?? '');
        const zN = await G.nagranieStudia(n.id, await fs.readFile(webm), { typ: 'video/webm' });
        assert.notEqual(zN.plik, zN.studio.plik);
        assert.equal(zN.studio.publikacja.id, `yt_${publikacje.length}`);
        assert.equal(publikacje.length, 3);
        // poprawka tekstu = stare nagranie studia nie pasuje → zdjęte; poprawka linii Zlata trafia do JEGO pamięci
        const sc = { ...s.scenariusz, gole: s.scenariusz.gole.map((g, i) => (i === 0 ? { ...g, po: 'Zlat Kadabra widział lepsze, ale to było piękne.' } : g)) };
        const pop = await G.popraw(s.id, sc);
        assert.equal(pop.studio, null);
        assert.equal((await G.pamiec('lew')).poprawki.at(-1).jest, 'Zlat Kadabra widział lepsze, ale to było piękne.');
        assert.equal((await G.pamiec('zebra')).poprawki?.length ?? 0, 0);
        await czekaj(s.id, ['studio', 'blad']);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
