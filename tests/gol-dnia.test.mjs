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
