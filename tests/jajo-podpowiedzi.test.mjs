// 💡 JaJo Mistrza podpowiada Kodeksowi: porada od sędziego, „co pomogło” z pamięci rund, uparty sędzia → wieść do Suwerena
// (raz na zadanie i sędziego). Przypadek z życia: zadanie 8.1 Teterhii, 2026-10-09 — martwy moduł u trzech modeli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzJajo, ulozPodpowiedz, coPomoglo, PORADY_SEDZIOW } from '../services/JajoMistrza.js';

const MARTWY = 'Dodałeś src/trybTestu.ts, ale ŻADEN plik projektu tego nie importuje — ten kod nigdy się nie wykona.';
const BUILD = 'tsc:\nsrc/main.ts(12,3): error TS2304: Cannot find name \'x\'.';

test('coPomoglo: linie dopisane w przyjętej, bez znaczników i nawiasów', () => {
    const odrz = '=== PLIK: src/main.ts ===\nimport { a } from \'./a\';\nstart();\n}\n=== KONIEC ===';
    const przyj = '=== PLIK: src/main.ts ===\nimport { a } from \'./a\';\nimport { trybTestu } from \'./trybTestu\';\nstart();\ntrybTestu();\n}\n=== KONIEC ===';
    assert.deepEqual(coPomoglo(odrz, przyj), ["import { trybTestu } from './trybTestu';", 'trybTestu();']);
});

test('ulozPodpowiedz: porady sędziów, uparty sędzia dopiero przy ≥ 3 razach u ≥ 2 modeli, wzór z historii', () => {
    assert.equal(ulozPodpowiedz({ bledy: [] }), null);
    const jeden = ulozPodpowiedz({ bledy: [{ model: 'gemini', powod: MARTWY }, { model: 'gemini', powod: MARTWY }, { model: 'gemini', powod: MARTWY }] });
    assert.equal(jeden.uparty, null, 'jeden model trzy razy to jeszcze nie uparty sędzia');
    assert.ok(jeden.tekst.includes(PORADY_SEDZIOW['martwy moduł']));
    const historia = [{ projekt: 'inna-gra', sedzia: 'martwy moduł', powod: MARTWY, odrzucona: 'start();', przyjeta: "import { fale } from './fale';\nstart();\nfale();" }];
    const p = ulozPodpowiedz({
        bledy: [{ model: 'claude-sonnet-5-5', powod: MARTWY }, { model: 'gemini-3.8-flash', powod: MARTWY }, { model: 'claude-opus-5-5', powod: BUILD }, { model: 'gemini-3.8-flash', powod: MARTWY }],
        historia, projekt: 'teterhia',
    });
    assert.deepEqual([p.uparty.sedzia, p.uparty.razy, p.uparty.modele.length], ['martwy moduł', 3, 2]);
    assert.match(p.tekst, /NIE przepisuj wszystkiego/);
    assert.ok(p.tekst.includes(PORADY_SEDZIOW.build), 'porada też dla drugiego sędziego');
    assert.match(p.tekst, /Przeszło, gdy dopisano m\.in\.:\n {4}import \{ fale \} from '\.\/fale';\n {4}fale\(\);/);
    assert.deepEqual(p.sedziowie.map((s) => s.sedzia), ['martwy moduł', 'build']);
});

test('podpowiedzKodeksowi: historia z rundy-kodeksa.jsonl, wieść do Suwerena raz na zadanie i sędziego', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'jajo-podp-'));
    try {
        const J = utworzJajo({ katalog: path.join(kat, 'jajo') });
        await J.rundaKodeksa({ projekt: 'gra-a', zadanie: 'z1', cel: 'fale wrogów', model: 'gemma', ok: true, rundy: 2,
            odrzucone: [{ runda: 1, powod: MARTWY, pliki: [{ sciezka: 'src/main.ts', tresc: 'start();' }] }],
            przyjete: [{ sciezka: 'src/main.ts', tresc: "import { fale } from './fale';\nstart();\nfale();" }] });
        const bledy = [{ model: 'sonnet', powod: MARTWY }, { model: 'gemini', powod: MARTWY }, { model: 'opus', powod: MARTWY }];
        const p = await J.podpowiedzKodeksowi({ projekt: 'teterhia', cel: 'Starcia sprawnościowe — Takt', bledy });
        assert.match(p.tekst, /Kiedyś \(gra-a\)/);
        assert.match(p.tekst, /import \{ fale \} from '\.\/fale';/);
        await J.podpowiedzKodeksowi({ projekt: 'teterhia', cel: 'Starcia sprawnościowe — Takt', bledy });
        const w = (await J.wiesci()).wiesci.filter((x) => x.tresc.startsWith('🧐'));
        assert.equal(w.length, 1, 'uparty sędzia ogłoszony raz');
        assert.match(w[0].tresc, /martwy moduł.*3 rund u 3 modeli.*może to sędzia się myli/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
