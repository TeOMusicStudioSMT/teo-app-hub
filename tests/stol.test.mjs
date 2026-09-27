/** Stół ratyfikacji: karta → przyjęcie (Projekt Stada bez samoZlecania) → Biblia → ratyfikacja (zlecenia). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as Stol from '../services/Stol.js';

const KARTA = fs.readFileSync(new URL('./fixtures/forge-fashion-grv.txt', import.meta.url), 'utf8');
const STADO = [
    { id: 'krawcowa', imie: 'Krawcowa' }, { id: 'paleta', imie: 'Paleta' }, { id: 'kodeks', imie: 'Kodeks' },
    { id: 'rezyser', imie: 'Reżyser' }, { id: 'joanna', imie: 'Joanna' }, { id: 'kupiec', imie: 'Kupiec' }, { id: 'bilans', imie: 'Bilans' },
];

/** Świat na niby dla Stołu: projekty stada w pamięci, zlecenia liczone. */
function swiat() {
    const projekty = new Map(), zalozone = [], zlecone = [], szyna = [];
    Stol.skonfiguruj({
        plik: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stol-')), 'stol.json'),
        szyna: { nadaj: async (z) => { szyna.push(z.tresc); } },
        projekt: async (id) => projekty.get(id) ?? null,
        zaloz: async (o) => {
            zalozone.push(o);
            const p = { id: `p${zalozone.length}`, stan: 'trwa', kroki: o.uczestnicy.map((u) => ({ agent: u.id, stan: 'czeka' })), zlecenia: [] };
            projekty.set(p.id, p);
            return p;
        },
        zlec: async (id) => { zlecone.push(id); return { ile: 3 }; },
        uczestnicy: async (kogo) => (kogo.length ? STADO.filter((g) => kogo.includes(g.imie) || kogo.includes(g.id)) : STADO),
    });
    return { projekty, zalozone, zlecone, szyna };
}

test('karta z rozmowy: wizja i uczestnicy z „KARTY DLA STOŁU"', () => {
    const k = Stol.czytajKarte(KARTA);
    assert.match(k.wizja, /^Mobilna gra RPG-fashion/);
    assert.match(k.wizja, /rangi i questy GRV\.$/);
    assert.deepEqual(k.uczestnicy, ['Krawcowa', 'Paleta', 'Kodeks', 'Reżyser', 'Joanna', 'Kupiec']);
    // Tekst bez sekcji: wizja = początek treści, uczestników brak (wybierze Suweren albo całe stado).
    assert.deepEqual(Stol.czytajKarte('Suweren: "zróbmy grę o klockach"\n🔥 ISKRA: tak!'), { wizja: 'Suweren: "zróbmy grę o klockach" 🔥 ISKRA: tak!', uczestnicy: [] });
});

test('pełna droga: na stole → opracowuje → do akceptacji → zratyfikowane', async () => {
    const w = swiat();
    const k = await Stol.dodaj({ tytul: 'Forge Fashion', tresc: KARTA, zrodlo: 'podcast-twin' });
    assert.equal((await Stol.lista())[0].etap, 'na_stole');
    await assert.rejects(Stol.ratyfikuj(k.id), /etapie „na_stole"/);

    const { projekt } = await Stol.przyjmij(k.id, { kto: 'Pixel' });
    assert.equal(w.zalozone[0].samoZlecanie, false, 'projekt ze Stołu nie zleca modułów sam');
    assert.deepEqual(w.zalozone[0].uczestnicy.map((u) => u.id), ['krawcowa', 'paleta', 'kodeks', 'rezyser', 'joanna', 'kupiec']);
    assert.equal(w.zalozone[0].zalozyl, 'Pixel');
    assert.equal((await Stol.lista())[0].etap, 'opracowuje');
    await assert.rejects(Stol.odrzuc(k.id), /etapie „opracowuje"/);

    Object.assign(w.projekty.get(projekt.id), { stan: 'gotowe', kroki: [{ agent: 'rezyser', stan: 'gotowe', synteza: true, wklad: 'BIBLIA Forge Fashion' }] });
    const gotowa = await Stol.karta(k.id);
    assert.equal(gotowa.etap, 'do_akceptacji');
    assert.equal(gotowa.projektSkrot.biblia, 'BIBLIA Forge Fashion');
    assert.deepEqual(w.zlecone, [], 'przed ratyfikacją nic nie zlecone');

    const r = await Stol.ratyfikuj(k.id, { kto: 'Pixel' });
    assert.equal(r.zlecenia, 3);
    assert.deepEqual(w.zlecone, [projekt.id]);
    const po = await Stol.karta(k.id);
    assert.equal(po.etap, 'zratyfikowane');
    assert.deepEqual(po.decyzje.map((d) => [d.co, d.kto]), [['przyjeta', 'Pixel'], ['zratyfikowana', 'Pixel']]);
    assert.ok(w.szyna.some((t) => /zratyfikował „Forge Fashion" — stado zleca 3 zadań/.test(t)));
});

test('uczestnicy: bez sugestii w karcie → całe stado; odrzucenie; projekt padł → można przyjąć od nowa', async () => {
    const w = swiat();
    const k = await Stol.dodaj({ tytul: 'Gra o klockach', tresc: 'Zróbmy grę o klockach z muzyką Joanny.', zrodlo: 'plik' });
    const { projekt } = await Stol.przyjmij(k.id);
    assert.equal(w.zalozone[0].uczestnicy.length, STADO.length);
    w.projekty.get(projekt.id).stan = 'przerwany';          // restart mostu w połowie
    assert.equal((await Stol.karta(k.id)).etap, 'utknela');
    await Stol.przyjmij(k.id);
    assert.equal(w.zalozone.length, 2);

    const k2 = await Stol.dodaj({ tytul: 'Nie teraz', tresc: 'Pomysł na później, do odłożenia.' });
    await Stol.odrzuc(k2.id);
    assert.equal((await Stol.karta(k2.id)).etap, 'odrzucona');
    await assert.rejects(Stol.przyjmij(k2.id), /etapie „odrzucona"/);
});

test('walidacja i błąd Projektu Stada przechodzi do Suwerena', async () => {
    swiat();
    await assert.rejects(Stol.dodaj({ tytul: '', tresc: 'cokolwiek dłuższego' }), /tytułu/);
    await assert.rejects(Stol.dodaj({ tytul: 'X', tresc: 'krótko' }), /pusta/);
    const k = await Stol.dodaj({ tytul: 'X', tresc: 'wystarczająco długa treść', zrodlo: 'nieznane' });
    assert.equal(k.zrodlo, 'hub');
    Stol.skonfiguruj({ zaloz: async () => { throw new Error('Stado pracuje już nad innym projektem'); } });
    await assert.rejects(Stol.przyjmij(k.id), /innym projektem/);
    assert.equal((await Stol.karta(k.id)).etap, 'na_stole', 'karta zostaje na stole');
});
