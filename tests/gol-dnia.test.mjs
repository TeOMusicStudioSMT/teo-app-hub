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
    assert.deepEqual(PROWADZACY, ['zebra', 'lew', 'lampart']);
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
        await assert.rejects(G.utworz({ mecz: MECZ, gole: GOLE, narrator: 'zebra', wspolprowadzacy: ['zebra'] }), /innymi narratorami/);
        const s0 = await G.utworz({ mecz: { ...MECZ, idGospodarzy: '134', idGosci: '999' }, gole: GOLE, narrator: 'zebra', wspolprowadzacy: ['lew'], wideo: 'studio', jezyk: 'en' });
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

import { wspolprowadzacyOdcinka, skladOdcinka, MAX_WSPOL, nazwaPublikacji } from '../services/GolDnia.js';

test('prowadzący + do trzech współprowadzących: gole komentują po kolei, prompt zna przydział, 4. = odmowa, stary `wspol` działa', async () => {
    assert.equal(MAX_WSPOL, 3);
    const s = { narrator: 'zebra', wspolprowadzacy: ['lew', 'byk', 'krolik'], jezyk: 'pl', mecz: MECZ, gole: [...GOLE, { ...GOLE[0], minuta: '70' }], scenariusz: odczytajScenariusz(SCENARIUSZ(4), 4), obrazy: null };
    assert.deepEqual(skladOdcinka(s), ['zebra', 'lew', 'byk', 'krolik']);
    assert.deepEqual([0, 1, 2, 3].map((g) => ktoMowi('okrzyk', s, g)), ['lew', 'byk', 'krolik', 'lew']);
    assert.equal(ktoMowi('przed', s, 2), 'zebra');
    assert.deepEqual(wspolprowadzacyOdcinka({ narrator: 'zebra', wspol: 'lew' }), ['lew'], 'starszy odcinek z jednym wspol');
    assert.deepEqual(wspolprowadzacyOdcinka({ narrator: 'zebra', wspolprowadzacy: ['zebra', 'lew', 'lew', 'nikt'] }), ['lew'], 'bez prowadzącego, dubli i nieznanych');
    const k = kwestieOdcinka(s);
    assert.deepEqual(k.filter((x) => x.typ === 'po').map((x) => x.kto), ['lew', 'byk', 'krolik', 'lew']);
    const p = promptScenariusza({ mecz: MECZ, gole: s.gole, narrator: 'zebra', wspolprowadzacy: s.wspolprowadzacy, jezyk: 'pl' });
    assert.match(p.system, /gole → Zlat Kadabra: 1, 4; Byk: 2; Królik: 3/);
    assert.match(promptyObrazow({ mecz: MECZ, gole: s.gole, scenariusz: s.scenariusz, narrator: 'zebra', wspolprowadzacy: s.wspolprowadzacy }).intro, /together with .*lion.* and .*bull.* and .*bunny/);
    assert.match(nazwaPublikacji(s, true), /Gol Donna & Zlat Kadabra & Byk & Królik · Studio Zebrra Football/);
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'gol-wspol-'));
    try {
        const G = utworzGolDnia({ katalog: kat, katalogMontazy: async () => kat });
        await assert.rejects(G.utworz({ mecz: MECZ, gole: GOLE, narrator: 'zebra', wspolprowadzacy: ['lew', 'byk', 'krolik', 'sowa'] }), /Najwyżej 3/);
        await assert.rejects(G.utworz({ mecz: MECZ, gole: GOLE, narrator: 'zebra', wspolprowadzacy: ['lew', 'lew'] }), /każdy raz/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

import { zwiadPoKolei } from '../services/GolDnia.js';
test('zwiad po kolei: limit Claude → Gemini, złe fakty → następny, bez kluczy = rada wpisania ręcznie', async () => {
    const ok = { tekst: JSON.stringify({ gole: GOLE }), zrodla: ['https://x.example'] };
    const limit = async () => { throw new Error('HTTP 400: You have reached your specified API usage limits.'); };
    const w = await zwiadPoKolei([{ nazwa: 'Claude', klucz: () => 'k', fn: limit }, { nazwa: 'Gemini', klucz: async () => 'g', fn: async () => ok }], 'p');
    assert.equal(w.dostawca, 'Gemini');
    assert.match(w.pominieci[0], /Claude: HTTP 400: You have reached/);
    const sprawdz = (z) => { const g = JSON.parse(z.tekst).gole; if (g.length !== 3) throw new Error('fakty nie zgadzają się z wynikiem'); return { gole: g }; };
    const zle = { tekst: JSON.stringify({ gole: GOLE.slice(0, 1) }), zrodla: ['https://y.example'] };
    const w2 = await zwiadPoKolei([{ nazwa: 'Gemini', klucz: () => 'g', fn: async () => zle }, { nazwa: 'Claude', klucz: () => 'k', fn: async () => ok }], 'p', sprawdz);
    assert.equal(w2.dostawca, 'Claude');
    assert.equal(w2.gole.length, 3);
    await assert.rejects(zwiadPoKolei([{ nazwa: 'Claude', klucz: () => null, fn: limit }, { nazwa: 'Gemini', klucz: () => null, fn: limit }], 'p'), /Model lokalny nie przeszuka internetu/);
    await assert.rejects(zwiadPoKolei([{ nazwa: 'Claude', klucz: () => 'k', fn: limit }, { nazwa: 'Gemini', klucz: () => null, fn: limit }], 'p'), /Claude: HTTP 400.*Gemini: brak klucza/);
});

import { czyKompilacja, meczeOdcinka, MAX_MECZOW } from '../services/GolDnia.js';
import { spawaj as spawajNaprawde } from '../services/Spawacz.js';
import { opisz as opiszNaprawde } from '../services/Montazownia.js';
import { promisify } from 'node:util';
import { execFile as execFileCb } from 'node:child_process';
const MECZ2 = { id: '7001', liga: 'Serie A', data: '2026-10-11', gospodarze: 'Inter', goscie: 'Napoli', wynik: [1, 1] };
const MECZ3 = { id: '7002', liga: 'LaLiga', data: '2026-10-11', gospodarze: 'Real Betis', goscie: 'Sevilla', wynik: [0, 0] };
const GOLE2 = [{ minuta: '9', strzelec: 'Lautaro', druzyna: 'gospodarze' }, { minuta: '77', strzelec: 'Kvara', druzyna: 'goscie' }];
const SC_KOMP = (meczow, goli) => ['INTRO: Witajcie w kompilacji!', ...Array.from({ length: meczow }, (_, k) => `MECZ ${k + 1}: Zapowiedź meczu ${k + 1}.`), ...Array.from({ length: goli }, (_, i) => [`PRZED ${i + 1}: Strzelec.`, `OKRZYK ${i + 1}: Gol!`, `PO ${i + 1}: Piękna akcja.`, `SCENA ${i + 1}: striker shoots`]).flat(), 'OUTRO: To wszystko!'].join('\n');

test('kompilacja: kilka meczów z faktami osobno → bloki MECZ w scenariuszu i kwestiach, oprawa z klocków albo uwaga wprost; tryb studio też', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'gol-komp-'));
    try {
        const obraz = path.join(kat, 'kadr.png');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x123456:s=640x360:d=1', '-frames:v', '1', obraz]);
        const klocek = (n, kolor) => { const p = path.join(kat, n); execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${kolor}:s=1920x1080:r=25:d=1.5`, '-f', 'lavfi', '-i', 'sine=frequency=500:duration=1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p]); return p; };
        const start = klocek('start_en.mp4', 'red'), end = klocek('end.mp4', 'blue');
        const czaty = [], spawy = [], publikacje = [];
        let zwiadow = 0;
        const uruchom = promisify(execFileCb);
        const cfgBaza = {
            ffmpeg: ffmpegPath, katalogMontazy: async (p) => path.join(kat, 'montaz', p),
            zwiad: async () => { zwiadow++; return { tekst: JSON.stringify({ gole: GOLE }), zrodla: ['https://x.example'] }; },
            chat: async (_m, system, user) => { czaty.push({ system, user }); return { tekst: SC_KOMP(3, 5) }; },
            rysuj: async () => obraz,
            publikuj: async (z) => { publikacje.push(z); return { id: `yt_${publikacje.length}`, etap: 'do_akceptacji' }; },
        };
        const G = utworzGolDnia({ ...cfgBaza, katalog: kat,
            klocki: async () => ({ katalog: 'Klocki Football', start: [start], end: [end] }),
            spawaj: async (o) => { spawy.push(o); return spawajNaprawde({ ...o, opisz: opiszNaprawde, uruchom, ffmpeg: ffmpegPath }); } });
        const czekaj = async (Gx, id, stany) => { let s; for (let i = 0; i < 400; i++) { s = await Gx.wczytaj(id); if (stany.includes(s.stan)) return s; await new Promise((r) => setTimeout(r, 100)); } return s; };
        await assert.rejects(G.utworz({ kompilacja: Array.from({ length: MAX_MECZOW + 1 }, (_, i) => ({ mecz: { ...MECZ, id: `m${i}` }, gole: GOLE })) }), /najwyżej 6 meczów/);
        await assert.rejects(G.utworz({ kompilacja: [{ mecz: MECZ2, gole: GOLE2.slice(0, 1) }, { mecz: MECZ3 }] }), /Inter – Napoli: fakty nie zgadzają się/);
        // mecz 1: zwiad, mecz 2: wpisane, mecz 3: 0:0 (zwiad mówi „bezbramkowy”)
        const s0 = await G.utworz({ kompilacja: [{ mecz: MECZ }, { mecz: MECZ2, gole: GOLE2 }, { mecz: MECZ3 }], narrator: 'zebra', wspolprowadzacy: ['lampart'], jezyk: 'en' });
        assert.ok(czyKompilacja(s0));
        assert.equal(zwiadow, 1, 'zwiad tylko dla meczu bez wpisanych goli i z bramkami');
        assert.deepEqual(s0.gole.map((g) => g.mecz), [0, 0, 0, 1, 1]);
        const s = await czekaj(G, s0.id, ['gotowy', 'blad']);
        assert.equal(s.stan, 'gotowy', s.powod ?? '');
        assert.match(czaty[0].system, /MECZ 3:/);
        assert.match(czaty[0].user, /MECZ 3: Real Betis – Sevilla 0:0 .* — bez bramek/);
        assert.match(czaty[0].user, /5\. \[mecz 2\] 77' Kvara \(Napoli\)/);
        assert.equal(s.scenariusz.mecze.length, 3);
        const kw = kwestieOdcinka(s);
        assert.deepEqual(kw.filter((k) => k.typ === 'mecz').map((k) => k.mecz), [0, 1, 2]);
        assert.deepEqual(kw.map((k) => k.typ).slice(0, 3), ['intro', 'mecz', 'przed']);
        assert.equal(kw.at(-2).typ, 'mecz', 'mecz bez goli = sama zapowiedź przed outro');
        assert.equal(kw.find((k) => k.typ === 'po' && k.gol === 4).mecz, 1);
        assert.deepEqual(kw.map((k) => k.nr), kw.map((_, i) => i + 1));
        assert.equal(s.segmenty.length, kw.length);
        assert.match(path.basename(s.plik), /^gol_kompilacja-3_zebra\+lampart_en_[0-9a-f]{8}\.mp4$/);
        assert.equal(spawy.length, 1);
        assert.deepEqual(spawy[0].klipy.map((p) => path.basename(p)), ['start_en.mp4', 'odcinek.mp4', 'end.mp4']);
        assert.deepEqual(s.oprawa, { start: ['start_en.mp4'], end: ['end.mp4'] });
        const sek = (await opiszNaprawde(s.plik)).sekundy;
        assert.ok(sek > 3, `film z oprawą ma ${sek} s`);
        assert.match(publikacje[0].nazwa, /3 matches: Coventry City 2:1 Newcastle United · Inter 1:1 Napoli · Real Betis 0:0 Sevilla/);
        assert.match(publikacje[0].kontekst, /compilation of 3 matches/);
        // bez klocków: film bez oprawy i uwaga wprost; tryb studio: oprawa na nagraniu
        const B = utworzGolDnia({ ...cfgBaza, katalog: path.join(kat, 'b'), klocki: async () => ({ katalog: '_OtakOs_Klocki/Klocki Football', start: [], end: [] }), spawaj: async () => { throw new Error('nie powinien'); } });
        const b0 = await B.utworz({ kompilacja: [{ mecz: MECZ, gole: GOLE }, { mecz: MECZ2, gole: GOLE2 }, { mecz: MECZ3, gole: [] }], narrator: 'pilkarka', wideo: 'studio' });
        const b = await czekaj(B, b0.id, ['studio', 'blad']);
        assert.equal(b.stan, 'studio', b.powod ?? '');
        const webm = path.join(kat, 'n.webm');
        execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=1280x720:r=30:d=2', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libvpx', '-b:v', '800k', '-c:a', 'libopus', '-shortest', webm]);
        const bn = await B.nagranieStudia(b.id, await fs.readFile(webm));
        assert.match(path.basename(bn.studio.plik), /^gol_kompilacja-3_studio_pilkarka_/);
        assert.match(bn.uwagi.join(' '), /brak klocków w _OtakOs_Klocki\/Klocki Football/);
        // poprawka scenariusza kompilacji zna linie MECZ
        const sc = { ...s.scenariusz, mecze: ['Pierwszy mecz!', 'Drugi mecz!', 'Trzeci, bez goli.'] };
        await G.popraw(s.id, sc);
        assert.equal((await G.wczytaj(s.id)).scenariusz.mecze[2], 'Trzeci, bez goli.');
        await czekaj(G, s.id, ['gotowy', 'blad']);
        await assert.rejects(G.popraw(s.id, { ...s.scenariusz, mecze: ['tylko jeden'] }), /zapowiedź każdego meczu/);
        assert.equal(meczeOdcinka({ mecz: MECZ }).length, 1);
        await czekaj(B, b.id, ['gotowy', 'blad']);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
