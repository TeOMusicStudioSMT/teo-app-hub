// 🐟 Złota Rybka — recenzja planu GDD bez kontekstu: prompt bez rozmowy, uwagi tylko do zadań z planu, ✓ podmienia treść.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzZlotaRybke, odczytajUwagi, zadaniaDoRecenzji, promptRybki } from '../services/ZlotaRybka.js';

const GDD = () => ({ tytul: 'Gra', sekcje: { wizja: 'Wyspa.' }, kamienie: [
    { id: 'k1', tytul: 'Ruch', opis: '', zadania: [{ id: 'zd1', tresc: 'Dodaj ruch gracza', stan: 'gotowe' }, { id: 'zd2', tresc: 'Dodaj kamerę podążającą jak ustaliliśmy', stan: 'czeka' }] },
    { id: 'k2', tytul: 'Walka', opis: '', zadania: [{ id: 'zd3', tresc: 'Zrób walkę z wrogiem', stan: 'blad', klocki: [{ rola: 'wróg Szumak' }] }] },
] });

test('zadania do recenzji: bez gotowych, z numerami i klockami; prompt nie niesie rozmowy', () => {
    const z = zadaniaDoRecenzji(GDD());
    assert.deepEqual(z.map((x) => [x.nr, x.id]), [['Z1', 'zd2'], ['Z2', 'zd3']]);
    assert.deepEqual(z[1].klocki, ['wróg Szumak']);
    const p = promptRybki({ gddTekst: 'GDD…', zadania: z, mapa: '' });
    assert.match(p, /Z2\. \[kamień 2: Walka\] Zrób walkę/);
    assert.match(p, /gra od zera/);
});

test('odczytajUwagi: tylko zadania z listy, rodzaje z listy, bez dubli', () => {
    const z = zadaniaDoRecenzji(GDD());
    const u = odczytajUwagi('<think>hm</think>{"uwagi":[{"zadanie":"Z1","rodzaj":"zalozenie","opis":"„jak ustaliliśmy” — Kodeks nie zna ustaleń","propozycja":"Dodaj kamerę trzecioosobową 6 j. za graczem"},{"zadanie":"Z1","rodzaj":"zalozenie","opis":"dubel dubel dubel"},{"zadanie":"Z9","rodzaj":"kod","opis":"nie ma takiego zadania"},{"zadanie":"2","rodzaj":"zmyslony","opis":"zły rodzaj zły"},{"zadanie":"2","rodzaj":"za-duze","opis":"walka to kilka rund pracy"}]}', z);
    assert.deepEqual(u.map((x) => [x.nr, x.rodzaj]), [['Z1', 'zalozenie'], ['Z2', 'za-duze']]);
    assert.equal(u[1].propozycja, null);
    assert.equal(odczytajUwagi('bez json', z), null);
});

test('przegląd → uwagi → ✓ podmienia treść zadania w GDD (stan zostaje), ✕ tylko decyzja, zmieniona treść = odmowa', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rybka-'));
    let g = GDD();
    const prompty = [];
    const R = utworzZlotaRybke({ katalog: tmp, model: () => 'atrapa',
        gdd: { wczytaj: async () => structuredClone(g), zapisz: async (_p, n) => { g = n; return n; }, jakoTekst: () => 'GDD tekst' },
        mapa: async () => 'MAPA PROJEKTU: src/main.ts',
        pisz: async ({ system, prompt }) => { prompty.push({ system, prompt }); return { tekst: prompty.length === 1 ? 'zepsute' : '{"uwagi":[{"zadanie":"Z1","rodzaj":"zalozenie","opis":"„jak ustaliliśmy” nic nie mówi Kodeksowi","propozycja":"Dodaj kamerę trzecioosobową 6 j. za graczem w src/main.ts"},{"zadanie":"Z2","rodzaj":"za-duze","opis":"walka to kilka rund","propozycja":"Dodaj wroga Szumaka, który podchodzi do gracza"}]}' }; } });
    try {
        await assert.rejects(R.przejrzyj('../zle'), /Złe id/);
        const { robota } = await R.przejrzyj('gra');
        await assert.rejects(R.przejrzyj('gra'), /już czyta/);
        await robota;
        assert.equal(prompty.length, 2, 'zły JSON = jedna poprawka');
        assert.match(prompty[0].prompt, /MAPA PROJEKTU: src\/main\.ts/);
        assert.doesNotMatch(prompty[0].prompt, /historia|rozmowa z Suwerenem/i);
        const st = await R.stan('gra');
        assert.equal(st.ostatni.stan, 'gotowe');
        const [u1, u2] = st.ostatni.uwagi;
        await R.rozstrzygnij('gra', u1.id, { decyzja: 'przyjmij' });
        const zd2 = g.kamienie[0].zadania[1];
        assert.equal(zd2.tresc, 'Dodaj kamerę trzecioosobową 6 j. za graczem w src/main.ts');
        assert.equal(zd2.stan, 'czeka');
        await assert.rejects(R.rozstrzygnij('gra', u1.id, { decyzja: 'przyjmij' }), /rozstrzygnięta/);
        g.kamienie[1].zadania[0].tresc = 'Suweren zmienił to ręcznie';
        await assert.rejects(R.rozstrzygnij('gra', u2.id, { decyzja: 'przyjmij' }), /zmieniła się/);
        const u = await R.rozstrzygnij('gra', u2.id, { decyzja: 'odrzuc' });
        assert.equal(u.decyzja, 'odrzuc');
        assert.equal(g.kamienie[1].zadania[0].tresc, 'Suweren zmienił to ręcznie');
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('duch po restarcie: „trwa” bez pracy w pamięci = błąd z powodem', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rybka-'));
    try {
        await fs.writeFile(path.join(tmp, 'gra.json'), JSON.stringify({ projekt: 'gra', przeglady: [{ id: 'r-1', stan: 'trwa', uwagi: [] }] }));
        const R = utworzZlotaRybke({ katalog: tmp, model: () => 'x', gdd: {}, mapa: async () => '', pisz: async () => ({ tekst: '' }) });
        const st = await R.stan('gra');
        assert.equal(st.ostatni.stan, 'blad');
        assert.match(st.ostatni.powod, /most wystartował/);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
