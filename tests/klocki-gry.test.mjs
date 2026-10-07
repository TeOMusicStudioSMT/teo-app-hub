// 🧱 Klocki gry: plan zna obrazy i bryły warsztatu, zadanie bez klocka nie idzie do Kodeksa, bryła z Assetów
// sama trafia do gry, Kodeks dostaje tylko klocki swojego zadania. Suweren 2026-10-07: „każą im budować z lego,
// a klocków jeszcze nie ma… sam porobiłem w obrazach i assetach 3D, a one nawet o tym nie wiedzą”.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import Klocki from '../services/KlockiGry.js';
import Gdd from '../services/Gdd.js';

/** Warsztat jak u Suwerena: bryła w grze z obrazu, bryła tylko w Assetach, sam obraz, krajobraz, bryła bez obrazu. */
function atrapaAssetow(katalogApek) {
    const wGrze = [
        { plik: 'rycerz.glb', nazwa: 'rycerz', opis: 'Wyblakły Rycerz', zrodlo: 'rycerz-1' },
        { plik: 'ujecie.glb', nazwa: 'ujecie', opis: 'ujęcie', zrodlo: 'ujecie-9' },
    ];
    const dolozone = [];
    return {
        dolozone,
        assetyProjektu: async () => wGrze,
        listaObrazow: async () => [
            { id: 'o-rycerz', projekt: 'gra', galaz: 'stwory', styl: 'postac', opis: 'Wyblakły Rycerz', bryly: ['rycerz-1'] },
            { id: 'o-rycerz-2', projekt: 'gra', galaz: 'stwory', styl: 'pojedynczy', opis: 'Wyblakły Rycerz', bryly: [] },
            { id: 'o-helm', projekt: 'gra', galaz: 'ekwipunek', styl: 'postac', opis: 'słuchawki-hełm', bryly: ['helm-2'] },
            { id: 'o-szumak', projekt: 'gra', galaz: 'stwory', styl: 'postac', opis: 'Szumak — stwór z szumu', bryly: [] },
            { id: 'o-gaj', projekt: 'gra', galaz: 'krainy', styl: 'krajobraz', opis: 'Gaj, który pamięta', bryly: [] },
            { id: 'o-obcy', projekt: 'inna-gra', galaz: 'stwory', styl: 'postac', opis: 'z innej gry', bryly: [] },
        ],
        lista: async () => [{ id: 'rycerz-1' }, { id: 'helm-2' }, { id: 'ujecie-9' }],
        async doGry(id, projekt) {
            dolozone.push(id);
            if (katalogApek) {
                const dir = path.join(katalogApek, projekt, 'public', 'assety');
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(path.join(dir, `${id}.glb`), 'glb');
            }
            wGrze.push({ plik: `${id}.glb`, nazwa: id, opis: 'słuchawki-hełm', zrodlo: id });
            return { plik: `assety/${id}.glb` };
        },
    };
}

test('katalog: stan każdego klocka z prawdziwego warsztatu, bez dubli wersji i bez obrazów innej gry', async () => {
    const kat = await Klocki.katalog('gra', { assety3d: atrapaAssetow() });
    const po = (opis) => kat.filter((k) => k.opis === opis || k.nazwa === opis);
    assert.equal(po('Wyblakły Rycerz').length, 1, 'dwie wersje obrazu rycerza = jeden klocek');
    assert.equal(po('Wyblakły Rycerz')[0].stan, 'w-grze');
    assert.equal(po('Wyblakły Rycerz')[0].plik, 'rycerz.glb');
    assert.equal(po('słuchawki-hełm')[0].stan, 'bryla');
    assert.equal(po('Szumak — stwór z szumu')[0].stan, 'obraz');
    assert.equal(po('Gaj, który pamięta')[0].stan, 'koncept', 'krajobraz to koncept, nie brak bryły');
    assert.ok(kat.some((k) => k.plik === 'ujecie.glb'), 'bryła w grze bez obrazu też jest klockiem');
    assert.ok(!kat.some((k) => k.opis === 'z innej gry'));
    assert.match(Klocki.katalogJakoTekst(kat), /^KATALOG KLOCKÓW[\s\S]*K1 \[/);
});

test('klocki z odpowiedzi planisty: numer z katalogu, brak z opisem, śmieci odpadają', async () => {
    const kat = await Klocki.katalog('gra', { assety3d: atrapaAssetow() });
    const nr = (opis) => `K${kat.findIndex((k) => k.opis === opis) + 1}`;
    const k = Klocki.klockiZOdpowiedzi([
        { rola: 'wróg', klocek: nr('Szumak — stwór z szumu') },
        { rola: 'NPC Kustosz', brak: 'Kustosz w płaszczu z kluczami' },
        { rola: 'zgadnięty', klocek: 'K99' },
        { klocek: 'K1' },
        'śmieć',
    ], kat);
    assert.equal(k.length, 3);
    assert.equal(k[0].klucz, 'o:o-szumak');
    assert.deepEqual(k[1], { rola: 'NPC Kustosz', klucz: null, opis: 'Kustosz w płaszczu z kluczami' });
    assert.equal(k[2].klucz, null, 'numer spoza katalogu = brak, nie zgadujemy');
});

test('rozwiaz: gotowe / do gry / braki / koncepty — po świeżym katalogu, nawet gdy klucz się zestarzał', async () => {
    const kat = await Klocki.katalog('gra', { assety3d: atrapaAssetow() });
    const r = Klocki.rozwiaz([
        { rola: 'wróg', klucz: 'o:o-rycerz-2', opis: '' },          // stary klucz obrazu — rycerz jest już w grze
        { rola: 'hełm', klucz: 'a:helm-2', opis: '' },
        { rola: 'Szumak', klucz: 'o:o-szumak', opis: '' },
        { rola: 'Kustosz', klucz: null, opis: 'Kustosz z kluczami' },
        { rola: 'klimat', klucz: 'o:o-gaj', opis: '' },
    ], kat);
    assert.deepEqual(r.gotowe.map((g) => g.plik), ['rycerz.glb']);
    assert.deepEqual(r.doGry.map((d) => d.bryla), ['helm-2']);
    assert.deepEqual(r.braki.map((b) => [b.rola, b.co]), [['Szumak', 'bryla'], ['Kustosz', 'obraz']]);
    assert.equal(r.koncepty.length, 1);
    assert.match(Klocki.opisBrakow(r.braki), /Szumak: zrób bryłę z obrazu[\s\S]*Kustosz: narysuj w Pracowni/);
});

test('blok Kodeksa: tylko klocki zadania z rolą; bez klocków — zakaz ładowania assetów', () => {
    const pusty = Klocki.blokKodeksa([]);
    assert.match(pusty, /NIE wczytuj żadnych assetów/);
    const b = Klocki.blokKodeksa([{ rola: 'wróg', plik: 'rycerz.glb', opis: 'Wyblakły Rycerz' }], [{ rola: 'Szumak' }], [{ rola: 'klimat', opis: 'Gaj' }]);
    assert.match(b, /- wróg: '\.\/assety\/rycerz\.glb'/);
    assert.match(b, /Szumak: BRYŁY JESZCZE NIE MA — zrób zastępczą/);
    assert.match(b, /KLIMAT Z KONCEPTÓW SUWERENA[\s\S]*Gaj/);
    assert.doesNotMatch(b, /ujecie/);
});

async function projekt(zadania) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'gdd-klocki-'));
    await fs.mkdir(path.join(kat, 'gra'), { recursive: true });
    const g = { wersja: 1, tytul: 'Teterhia', gatunek: 'RPG', silnik: 'three', sekcje: {}, galezie: [], historia: [], kamienie: [{ id: 'k1', tytul: 'Zgrzytowce', opis: 'wrogowie', zadania }] };
    await fs.writeFile(path.join(kat, 'gra', 'gdd.json'), JSON.stringify(g));
    return kat;
}
async function koniec(id) { for (let i = 0; i < 300; i++) { const p = Gdd.produkcja(id); if (p && p.stan !== 'trwa') return p; await new Promise((r) => setTimeout(r, 5)); } throw new Error('produkcja nie skończyła'); }

test('produkcja: brak klocka = zadanie czeka na klocek i idzie następne; bryła z Assetów sama do gry; Kodeks dostaje tylko swoje klocki', async () => {
    const kat = await projekt([
        { id: 'z1', tresc: 'Szumak goni gracza', stan: 'czeka', klocki: [{ rola: 'wróg Szumak', klucz: 'o:o-szumak', opis: 'Szumak' }] },
        { id: 'z2', tresc: 'Hełm w plecaku', stan: 'czeka', klocki: [{ rola: 'ekwipunek — hełm', klucz: 'a:helm-2', opis: 'hełm' }] },
        { id: 'z3', tresc: 'HUD z pulsem', stan: 'czeka', klocki: [] },
        { id: 'z4', tresc: 'stare zadanie bez pola klocki', stan: 'czeka' },
    ]);
    const assety = atrapaAssetow(kat);
    const wywolania = [];
    const zad = new Map();
    Gdd.skonfiguruj({ katalog: kat, odstepSondazuMs: 1, szyna: null, assety3d: assety, appStudio: {
        async buduj(_p, o) { wywolania.push(o); const id = `t${zad.size}`; zad.set(id, { stan: 'gotowe', wynik: { ok: true, rundy: 1, sekundy: 1 } }); return { id }; },
        zadanie: (id) => zad.get(id),
    } });
    await Gdd.realizuj('gra', { model: 'm' });
    const p = await koniec('gra');
    assert.equal(p.stan, 'gotowe');
    assert.equal(p.naKlocki, 1);
    assert.equal(p.zrobione, 3);
    assert.ok(p.kroki.some((k) => /🧱 czeka na klocek — wróg Szumak: zrób bryłę z obrazu/.test(k.tekst)));
    assert.deepEqual(assety.dolozone, ['helm-2'], 'bryła z Assetów trafiła do gry bez pytania');
    assert.equal(wywolania.length, 3, 'Szumak nie poszedł do Kodeksa');
    assert.match(wywolania[0].blokKlockow, /ekwipunek — hełm: '\.\/assety\/helm-2\.glb'/);
    assert.match(wywolania[1].blokKlockow, /NIE wczytuj żadnych assetów/);
    assert.equal(wywolania[2].blokKlockow, undefined, 'zadanie sprzed klocków — dawne zachowanie');
    const g = JSON.parse(await fs.readFile(path.join(kat, 'gra', 'gdd.json'), 'utf8'));
    const z1 = g.kamienie[0].zadania[0];
    assert.equal(z1.stan, 'klocki');
    assert.match(z1.uwaga, /🧱 brakuje: wróg Szumak/);
    assert.deepEqual(g.kamienie[0].zadania.slice(1).map((z) => z.stan), ['gotowe', 'gotowe', 'gotowe']);

    // Suweren pozwala na bryłę zastępczą → zadanie idzie, Kodeks wie, że bryły nie ma.
    await Gdd.ustawZadanie('gra', 'z1', { zastepcze: true });
    await Gdd.realizuj('gra', { model: 'm' });
    const p2 = await koniec('gra');
    assert.equal(p2.zrobione, 1);
    assert.match(wywolania[3].blokKlockow, /wróg Szumak: BRYŁY JESZCZE NIE MA/);
});

test('zapis GDD z frontu nie gubi klocków ani zgody na zastępcze; śmieci w klockach odpadają', async () => {
    const kat = await projekt([{ id: 'z1', tresc: 'x', stan: 'klocki', zastepcze: true, klocki: [{ rola: 'wróg', klucz: 'o:o-szumak', opis: 'Szumak' }, { rola: '', klucz: 'K1' }, { rola: 'zły klucz', klucz: '../../etc' }] }]);
    Gdd.skonfiguruj({ katalog: kat });
    const g = await Gdd.zapisz('gra', JSON.parse(await fs.readFile(path.join(kat, 'gra', 'gdd.json'), 'utf8')));
    const z = g.kamienie[0].zadania[0];
    assert.equal(z.stan, 'klocki');
    assert.equal(z.zastepcze, true);
    assert.deepEqual(z.klocki, [{ rola: 'wróg', klucz: 'o:o-szumak', opis: 'Szumak' }, { rola: 'zły klucz', klucz: null, opis: '' }]);
});
