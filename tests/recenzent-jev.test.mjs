// 🧐 Recenzent Kodeksa z drugim głosem Jev (Suweren 2026-10-08: „zrób Recenzenta Kodeksa na Jev”).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recenzujZJev, zmianyRundy, PYTANIA_RECENZENTA } from '../services/RecenzentKodeksa.js';

const jevMowi = (odp) => {
    const j = { wywolan: 0, stan: () => ({ maKlucz: true }) };
    j.zapytaj = async (z) => { j.wywolan++; j.ostatnie = z; return { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(odp).map(([k, p]) => [k, { type: 'noul', noul: p }])) }; };
    return j;
};
const STARY = 'export function teren(scena) {\n  for (let x = 0; x < 64; x++) dodajPlytke(scena, x);\n}\n';
const NOWY = 'export function teren(scena) {\n  dodajPlytke(scena, 0);\n}\n';
const pliki = [{ sciezka: 'src/swiat3d.ts', stara: STARY, nowa: NOWY }, { sciezka: 'src/kustosz.ts', stara: null, nowa: 'export const k = 1;\n' }];

test('zmianyRundy: nowe pliki w całości, zmienione jako − / + z liczbą linii', () => {
    const t = zmianyRundy(pliki);
    assert.match(t, /=== ZMIENIONY PLIK: src\/swiat3d\.ts \(3 → 3 linii\) ===/);
    assert.match(t, /- for \(let x = 0; x < 64; x\+\+\) dodajPlytke\(scena, x\);/);
    assert.match(t, /\+ dodajPlytke\(scena, 0\);/);
    assert.match(t, /=== NOWY PLIK: src\/kustosz\.ts ===\nexport const k = 1;/);
});

test('bez klucza: same reguły, jev null', async () => {
    const r = await recenzujZJev({ stan: () => ({ maKlucz: false }) }, { pliki, cel: 'dodaj Kustosza' });
    assert.equal(r.ok, true);
    assert.equal(r.jev, null);
});

test('regresja p ≥ 0,85 blokuje z radą; trzy pytania w jednym zapytaniu', async () => {
    const jev = jevMowi({ atrapa: 0.2, regresja: 0.92, oszustwo: 0.05 });
    const r = await recenzujZJev(jev, { pliki, cel: 'dodaj Kustosza przy lądowaniu' });
    assert.equal(r.ok, false);
    assert.deepEqual(r.blokujace.map((u) => u.regula), ['jev-regresja']);
    assert.match(r.feedback, /RECENZENT KODU odrzucił.*\n.*wycięte dawne działanie \(Jev\) p=0\.92/);
    assert.deepEqual(Object.keys(jev.ostatnie.questions), Object.keys(PYTANIA_RECENZENTA));
    assert.match(jev.ostatnie.state.zmiany_rundy, /ZMIENIONY PLIK/);
    assert.deepEqual(r.jev, { model: 'jev-1.13.0', glos: { atrapa: 0.2, regresja: 0.92, oszustwo: 0.05 } });
});

test('regresja przy zleceniu „przepisz/usuń” = tylko uwaga; średnie p = uwaga, nie blokada', async () => {
    const r = await recenzujZJev(jevMowi({ atrapa: 0.7, regresja: 0.95, oszustwo: 0.1 }), { pliki, cel: 'przepisz teren na prostszy' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.uwagi.map((u) => u.regula).sort(), ['jev-atrapa', 'jev-regresja']);
    assert.match(r.podsumowanie, /czysto \(Jev atrapa 0\.7/);
});

test('reguły już blokują — Jev nie jest pytany; Jev padł — same reguły + jevBlad', async () => {
    const jev = jevMowi({ atrapa: 0.99 });
    const zaslepka = [{ sciezka: 'src/main.ts', stara: 'a();\n', nowa: 'a();\n// ... reszta bez zmian\n' }];
    const r = await recenzujZJev(jev, { pliki: zaslepka, cel: 'x' });
    assert.equal(r.ok, false);
    assert.equal(jev.wywolan, 0);
    const p = await recenzujZJev({ stan: () => ({ maKlucz: true }), zapytaj: async () => { throw new Error('Jev HTTP 529'); } }, { pliki, cel: 'x' });
    assert.equal(p.ok, true);
    assert.match(p.jevBlad, /529/);
    assert.match(p.podsumowanie, /Jev niedostępny/);
});
