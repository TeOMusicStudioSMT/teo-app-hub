// ⚖️ Sędzia Projektu Stada na Jev (Suweren 2026-10-08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zalozeniaWizji, pytaniaSedziego, wynikSedziego, ocenJev } from '../services/SedziaJev.js';

test('założenia wizji: punkty listy, a bez listy — zdania; najwyżej 8, krótkie odpadają', () => {
    assert.deepEqual(zalozeniaWizji('Gra o wyspie.\n- Kot-towarzysz ze świecącym okiem\n- Sierść jak opal w dzień\n2) Nocą widać tylko oko'),
        ['Kot-towarzysz ze świecącym okiem', 'Sierść jak opal w dzień', 'Nocą widać tylko oko']);
    assert.deepEqual(zalozeniaWizji('Świat rodzi się z ziarna postaci. Barwa świata zależy od wyborów gracza! Ok. Czy to ma być film czy gra? Ale musimy zawęzić.'), ['Świat rodzi się z ziarna postaci.', 'Barwa świata zależy od wyborów gracza!']);
    assert.equal(zalozeniaWizji(Array.from({ length: 12 }, (_, i) => `- założenie numer ${i}`).join('\n')).length, 8);
});

test('pytania: ocena score z rubryką 10 poziomów + noul na każde założenie (z1…zN)', () => {
    const q = pytaniaSedziego(['A założenie', 'B założenie']);
    assert.equal(q.ocena.type, 'score');
    assert.equal(q.ocena.criteria.length, 10);
    assert.equal(q.z1.type, 'noul');
    assert.equal(q.z2.instructions.zalozenie, 'B założenie');
    assert.equal(Object.keys(q).length, 3);
});

test('wynik: ocena z prawdopodobieństw poziomów (klucze 0–9 albo 1–10), braki = założenia p<0,5', () => {
    const zal = ['opal', 'oko', 'wyspa'];
    const probs = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), i === 6 ? 0.5 : i === 7 ? 0.5 : 0]));
    const w = wynikSedziego({ answers: { ocena: { probabilities: probs, confidence: 0.4, score: 6.5 }, z1: { noul: 0.9 }, z2: { noul: 0.2 }, z3: { noul: 0.49 } } }, zal);
    assert.equal(w.ocena, 7.5, 'poziomy 7 i 8 po 50%');
    assert.equal(w.pewnosc, 0.4);
    assert.equal(w.braki.length, 2);
    assert.match(w.braki[0], /„oko” \(Jev p=0\.20\)/);
    const probs1 = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), i === 9 ? 1 : 0]));
    assert.equal(wynikSedziego({ answers: { ocena: { probabilities: probs1 } } }, []).ocena, 10);
    assert.equal(wynikSedziego({ answers: { ocena: { score: 4 } } }, []).ocena, 5, 'bez prawdopodobieństw: score od 0 → +1');
    assert.equal(wynikSedziego({ answers: {} }, []).ocena, null);
});

test('ocenJev: bez klucza null; z kluczem jedno zapytanie ze wszystkimi pytaniami i przyciętą Biblią', async () => {
    assert.equal(await ocenJev({ stan: () => ({ maKlucz: false }) }, { wizja: 'x', biblia: 'y' }), null);
    let zapytanie;
    const jev = {
        stan: () => ({ maKlucz: true }),
        zapytaj: async (z) => { zapytanie = z; return { model: 'jev-1.13.0', answers: { ocena: { score: 8 }, z1: { noul: 0.95 }, z2: { noul: 0.1 } } }; },
    };
    const w = await ocenJev(jev, { wizja: '- świecące oko nocą\n- opalowa sierść', biblia: 'B'.repeat(50_000), uwagi: 'więcej nocy' });
    assert.equal(w.ocena, 9);
    assert.equal(w.model, 'jev-1.13.0');
    assert.deepEqual(w.braki, ['Niespełnione założenie wizji: „opalowa sierść” (Jev p=0.10)']);
    assert.equal(zapytanie.state.biblia_projektu.length, 20_000);
    assert.equal(zapytanie.state.uwagi_suwerena, 'więcej nocy');
    assert.deepEqual(Object.keys(zapytanie.questions), ['ocena', 'z1', 'z2']);
});
