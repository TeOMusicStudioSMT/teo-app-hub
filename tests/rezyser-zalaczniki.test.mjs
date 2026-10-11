import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zalacznikiRozmowy, blokZalacznikow, MAX_ZALACZNIKOW } from '../services/Gdd.js';

const kat = [
    { klucz: 'b:kot.glb', nazwa: 'Kot Tancerz', opis: 'Kot Tancerz w koszulce TeO', stan: 'w-grze', galaz: 'mini-teogochi' },
    { klucz: 'o:ksiega-1', nazwa: 'Księga FLOOM', opis: 'granatowa skóra, srebrne okucia', stan: 'obraz', galaz: null },
];
const assetyGry = [{ plik: 'kot.glb', animacja: 'ruch_akcje', ruchy: { bieg: 'kot-bieg.glb', akcje: 'kot-akcje.glb' }, swiatlo: { kolor: '#ffb289', moc: 6 }, sciany: 8000 }];

test('dołączone assety: tylko z katalogu gry, fakty brył w grze, bez dubli i śmieci', () => {
    const z = zalacznikiRozmowy(['b:kot.glb', 'o:ksiega-1', 'b:kot.glb', 'a:../../etc', 'x:zly', 'o:nie-ma'], kat, assetyGry);
    assert.deepEqual(z.map((x) => x.klucz), ['b:kot.glb', 'o:ksiega-1']);
    assert.ok(z[0].fakty.some((f) => /ruchy: bieg, akcje/.test(f)));
    assert.ok(z[0].fakty.some((f) => /świeci/.test(f)));
    const blok = blokZalacznikow(z);
    assert.match(blok, /\[b:kot\.glb\] Kot Tancerz — Kot Tancerz w koszulce TeO/);
    assert.match(blok, /\[o:ksiega-1\] Księga FLOOM/);
    assert.equal(blokZalacznikow([]), '');
});

test('najwyżej MAX_ZALACZNIKOW', () => {
    const duzo = Array.from({ length: 20 }, (_, i) => ({ klucz: `o:o${i}`, nazwa: `o${i}`, stan: 'obraz' }));
    assert.equal(zalacznikiRozmowy(duzo.map((x) => x.klucz), duzo).length, MAX_ZALACZNIKOW);
});
