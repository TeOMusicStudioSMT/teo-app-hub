// 🐾🕺 Mini z ruchem — rodziny wersji (ulepsza + wspólny obraz) scalone do wersji z najwięcej klipami, kategoria
// z nazw klipów, tylko z ruchem, sortowanie (tancerze, potem wojownicy… i liczba klipów), klucze członków rodziny.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rodzinyZRuchem, rodzajKlipu, kategoria } from '../services/MiniZRuchem.js';

const KLIPY = { 'kot-2.glb': ['Idle', 'Attack', 'Boom_Dance'], 'kot-3.glb': ['FunnyDancing_01', 'Bubble_Dance', 'Bass_Beats', 'Walking'], 'zaba.glb': ['Punch_Combo', 'Kick', 'Walking'] };
const lista = [
    { id: 'kot-1', nazwa: 'kot', opis: 'Mini-TeOgochi Kot Tancerz: puszysty', galaz: 'mini-teogochi', zObrazu: 'o-kot', utworzono: '2026-10-01' },
    { id: 'kot-2', nazwa: 'kot', ulepsza: 'kot-1', utworzono: '2026-10-02', ruchy: [{ ruch: 'akcje', glb: 'kot-2.glb' }] },
    { id: 'kot-3', nazwa: 'kot', ulepsza: 'kot-2', utworzono: '2026-10-03', ruchy: [{ ruch: 'akcje2', glb: 'kot-3.glb' }] },
    { id: 'kot-x', nazwa: 'kot', zObrazu: 'o-kot', utworzono: '2026-10-04' },   // ta sama rodzina po obrazie, bez ruchu
    { id: 'zaba-1', nazwa: 'zaba', opis: 'Mini-TeOgochi Żaba', galaz: 'mini-teogochi', utworzono: '2026-10-01', ruchy: [{ ruch: 'akcje', glb: 'zaba.glb' }] },
    { id: 'mira-1', nazwa: 'mira', opis: 'Mira — Opiekunka Gaju', galaz: 'postacie', utworzono: '2026-10-01', ruchy: [{ ruch: 'chod', glb: 'brak.glb' }] },
    { id: 'skala', nazwa: 'skała', opis: 'skała', utworzono: '2026-10-01' },
];

test('rodziny z ruchem: scalona wersja z najwięcej klipami, kategoria, sortowanie, klucze rodziny', async () => {
    const r = await rodzinyZRuchem({ lista, sciezka: (_id, p) => (KLIPY[p] ? p : null), czytaj: async (p) => KLIPY[p] ?? [], assetyGry: [{ plik: 'kot-w-grze.glb', zrodlo: 'kot-2' }] });
    assert.deepEqual(r.map((x) => [x.nazwa, x.kategoria, x.klipow, x.klucz]), [['Kot Tancerz', 'tancerz', 4, 'a:kot-3'], ['Żaba', 'wojownik', 3, 'a:zaba-1']]);
    assert.equal(r[0].wersji, 4);
    assert.equal(r[0].wersjiZRuchem, 2);
    assert.equal(r[0].mini, true);
    assert.ok(r[0].klucze.includes('a:kot-1') && r[0].klucze.includes('o:o-kot') && r[0].klucze.includes('b:kot-w-grze.glb'));
    assert.ok(!r.some((x) => x.nazwa.startsWith('Mira')), 'plik ruchu bez klipów = bez ruchu');
});

test('rodzaj klipu i kategoria', () => {
    assert.deepEqual(['Boom_Dance', 'Punch_Combo', 'Walking', 'Idle', 'Wave'].map(rodzajKlipu), ['taniec', 'walka', 'ruch', 'spoczynek', 'gest']);
    assert.equal(kategoria({ taniec: 1, ruch: 3 }), 'gesty');
    assert.equal(kategoria({ ruch: 2, spoczynek: 1 }), 'wedrowiec');
});
