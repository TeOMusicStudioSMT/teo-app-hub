// 🪪 Księga GRV tej Katedry: własny skarbiec i właściciel — nowa Katedra nie dostaje kont głównego węzła.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genezaKsiegi, migrujKsiege, nowyKluczWezla, kimJestem, oczyscNazwe, nazwaWezla, NAZWA_SKARBCA } from '../services/KsiegaTozsamosc.js';
import { kontaNowejKatedry } from '../services/Konta.js';

test('geneza: unikalny skarbiec ∞, bez TeO i bez Mistrza Arkadiusza, pule puste, właściciel dopiero po imieniu', () => {
    const a = genezaKsiegi({ teraz: 1, losowo: () => 'aaaa1111' });
    const b = genezaKsiegi();
    assert.equal(a.zarzadca, 'skarbiec-aaaa1111');
    assert.notEqual(b.zarzadca, genezaKsiegi().zarzadca, 'każda Katedra ma swój klucz skarbca');
    assert.deepEqual(Object.keys(a.nodes), ['skarbiec-aaaa1111']);
    assert.equal(a.nodes['skarbiec-aaaa1111'].grv, 'INFINITE');
    assert.equal(a.nodes['skarbiec-aaaa1111'].nazwa, NAZWA_SKARBCA);
    assert.equal(a.wlasciciel, null);
    assert.deepEqual(a.pools, { founder: 0, pillar: 0, herald: 0 });
    assert.deepEqual(a.genesis, { 'skarbiec-aaaa1111': 'INFINITE' });
    assert.ok(!a.nodes.TeO && !a.nodes['Mistrz Arkadiusz']);
});

test('migracja starej księgi: skarbiec i właściciel z tego, co w niej jest — salda nietknięte', () => {
    const glowny = { nodes: { TeO: { grv: 'INFINITE' }, 'Mistrz Arkadiusz': { grv: 1_005_075, tier: 'founder' } } };
    assert.equal(migrujKsiege(glowny), true);
    assert.equal(glowny.zarzadca, 'TeO'); assert.equal(glowny.wlasciciel, 'Mistrz Arkadiusz');
    assert.equal(glowny.nodes['Mistrz Arkadiusz'].grv, 1_005_075);
    assert.equal(migrujKsiege(glowny), false, 'drugi raz nic nie zmienia');
    const nowa = genezaKsiegi(); delete nowa.genesis;
    assert.equal(migrujKsiege(nowa), false, 'nowa księga ma już oba pola');
});

test('właściciel: unikalny klucz, nazwa do zmiany, opis tożsamości', () => {
    const L = genezaKsiegi({ losowo: () => 's1' });
    let n = 0; const seq = () => ['dup', 'dup', 'x2'][n++];
    L.nodes['wezel-dup'] = { grv: 0 };
    assert.equal(nowyKluczWezla(L, seq), 'wezel-x2', 'klucz nie koliduje z istniejącym');
    L.nodes['wezel-x2'] = { grv: 12_345, nazwa: 'Ania' }; L.wlasciciel = 'wezel-x2';
    assert.equal(nazwaWezla(L, 'wezel-x2'), 'Ania');
    assert.deepEqual(kimJestem(L).wlasciciel, { id: 'wezel-x2', nazwa: 'Ania', grv: 12_345, tier: null });
    assert.equal(kimJestem(genezaKsiegi()).wlasciciel, null);
    assert.equal(oczyscNazwe('  Suweren \n Marek  '), 'Suweren Marek');
    assert.equal(oczyscNazwe('A'), null);
    assert.equal(oczyscNazwe('x'.repeat(80)).length, 40);
});

test('konta nowej Katedry: tylko jej skarbiec, bez maili głównego węzła', () => {
    const k = kontaNowejKatedry('skarbiec-ab12');
    assert.deepEqual(k.konta.map((x) => [x.id, x.wezel, x.mail]), [['skarbiec', 'skarbiec-ab12', '']]);
    assert.ok(!JSON.stringify(k).includes('@'), 'żadnego maila');
    assert.deepEqual(kontaNowejKatedry(null).konta, []);
});
