// ✦ Figury taneczne — most: przepis i moc figury liczone z przepisu (deklaracja apki poprawiona), choreografia z figurą
// (zapis, odcisk, zgłoszenie, sprawdzenie w Klubie), Kompozytor proponuje (złe figury odpadają, jedna poprawka),
// Suweren ✓/✖/✎ (para do nauki), własna figura, kurs do Kuźni, trasy HTTP. Prawdziwy dysk tymczasowy, atrapa modelu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzChoreografie, przeliczFigury, oczyscRuchy, mocFigury, oczyscPrzepis, kodFigury, tanecZSieci, frazyZRytmu, ulozChoreografie } from '../services/Choreografie.js';
import { utworzFiguryTanca, zamontujTrasyFigur, odczytajFigury } from '../services/FiguryTanca.js';

const T0 = Date.parse('2026-10-20T12:00:00Z');
const RYTM = { plik: 'Bazylika/bit.mp3', bpm: 120, okresSek: 0.5, przesuniecieSek: 0.1, sekundy: 33, pewnosc: 0.9,
    beaty: Array.from({ length: 64 }, (_, i) => ({ t: 0.1 + i * 0.5, sila: i >= 24 && i < 48 ? 0.9 : 0.3 })) };
// części klipu: [moc, ścieżek] — jak mierzy apka (24 kości riga Meshy)
const cz = (cale, gora, dol, rece, glowa) => ({ cale: [cale, 24], gora: [gora, 14], dol: [dol, 9], rece: [rece, 8], glowa: [glowa, 4] });
const KLIPY = [
    { nazwa: 'Boom_Dance', sek: 4.1, moc: 2.4, czesci: cz(2.4, 2.2, 2.7, 2.0, 1.5) },
    { nazwa: 'Arm_Circle_Shuffle', sek: 2.1, moc: 1.6, czesci: cz(1.6, 2.4, 0.4, 3.1, 0.5) },
    { nazwa: 'Squat_Stance', sek: 3.0, moc: 0.5, czesci: cz(0.5, 0.3, 0.8, 0.2, 0.1) },
    { nazwa: 'Bass_Beats', sek: 1.9, moc: 2.9, czesci: cz(2.9, 2.5, 3.5, 2.2, 2.0) },
];
const PRZEPIS = { sekcja: 'drop', a: 'Squat_Stance', b: 'Arm_Circle_Shuffle', maska: 'rece', wejscie: 'pol', warstwy: { obrot: { obrotow: 1, co: 4, kierunek: 1 } } };

test('przeliczFigury: most liczy długość i moc z przepisu — zła deklaracja apki poprawiona, brak klipu = błąd', () => {
    const p = oczyscPrzepis(PRZEPIS, KLIPY.map((k) => k.nazwa));
    const f = przeliczFigury(oczyscRuchy([...KLIPY, { nazwa: 'Wirujący Grom', sek: 99, moc: 999, figura: PRZEPIS }]), 0.5).at(-1);
    assert.deepEqual({ sek: f.sek, moc: f.moc }, mocFigury(p, KLIPY, 0.5));
    // reszta Squat (24−8 ścieżek po 0,5…) + ręce z Arm Circle + obrót π rad/s
    const oczek = Math.round(((0.5 * 24 - 0.2 * 8 + 3.1 * 8) / 24 + Math.PI) * 1000) / 1000;
    assert.equal(f.moc, oczek);
    assert.throws(() => przeliczFigury(oczyscRuchy([KLIPY[0], KLIPY[2], { nazwa: 'Grom', sek: 1, moc: 1, figura: PRZEPIS }]), 0.5), /nie ma takiego ruchu/);
    assert.throws(() => przeliczFigury(oczyscRuchy([{ nazwa: 'Squat_Stance', sek: 3, moc: 0.5 }, { nazwa: 'Arm_Circle_Shuffle', sek: 2, moc: 1 }, { nazwa: 'Grom', sek: 1, moc: 1, figura: PRZEPIS }]), 0.5), /Brak części/);
    assert.throws(() => oczyscRuchy([{ ...KLIPY[0], czesci: { ...KLIPY[0].czesci, rece: [1, 99] } }, KLIPY[1]]), /więcej ścieżek/);
});

test('choreografia z figurą: zapis liczy figurę sam, odcisk niesie przepis, Klub sprawdza kod, podmiana odrzucona', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'figury-c-'));
    try {
        const C = utworzChoreografie({ katalog: kat, teraz: () => T0, rytm: async () => RYTM, katalogMontazy: async () => kat });
        const ruchy = [...KLIPY, { nazwa: 'Wirujący Grom', sek: 1, moc: 0.1, figura: PRZEPIS }];
        const policzone = przeliczFigury(oczyscRuchy(ruchy), 0.5);
        const u = ulozChoreografie(frazyZRytmu(RYTM, 8), policzone, 0.5);
        assert.ok(u.includes(4), 'figura (najmocniejsza) jest w układzie');
        const c = await C.zapisz({ mini: { id: 'kot', nazwa: 'Kot Tancerz' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy, uklad: u });
        const g = c.ruchy.find((r) => r.nazwa === 'Wirujący Grom');
        assert.equal(g.moc, policzone[4].moc, 'moc z przepisu, nie z ciała żądania');
        assert.deepEqual(g.figura, oczyscPrzepis(PRZEPIS, KLIPY.map((k) => k.nazwa)));
        const z = await C.zglos(c.id);
        assert.ok(z.okresy.every((o) => o.poprawiony));
        const [wpis] = await C.publiczne();
        assert.equal(wpis.dane.ruchy[4][3], kodFigury(g.figura), 'wizytówka niesie kod przepisu');
        assert.equal(wpis.dane.ruchy[0].length, 3, 'zwykły klip bez kodu (jak dawniej)');
        const ok = tanecZSieci(wpis, 'kot-katedra', T0);
        assert.equal(ok.odcisk, c.odcisk);
        assert.ok(!ok.odrzucony);
        const podmiana = structuredClone(wpis);
        podmiana.dane.ruchy[4][3] = kodFigury({ ...g.figura, warstwy: { lustro: true } });
        assert.match(tanecZSieci(podmiana, 'oszust', T0).powod, /odcisk/);
        const zepsuty = structuredClone(wpis);
        zepsuty.dane.ruchy[4][3] = '["drop","Moonwalk",null,null,"pol",[["lustro"]]]';
        assert.match(tanecZSieci(zepsuty, 'oszust', T0).powod, /nie ma takiego ruchu/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('odczyt figur od modelu: złe odpadają z powodem, dobre kanoniczne, dubel przepisu i nazwy odrzucony', () => {
    const odp = '```json\n' + JSON.stringify({ figury: [
        { nazwa: 'Grom 2', sekcja: 'drop', a: 'K3', b: 'K2', maska: 'rece', warstwy: { obrot: { obrotow: 1 } } },
        { nazwa: 'Salto', sekcja: 'drop', a: 'K1', warstwy: { salto: {} } },
        { nazwa: 'Kopia', sekcja: 'drop', a: 'Squat_Stance', b: 'Arm_Circle_Shuffle', maska: 'rece', warstwy: { obrot: { obrotow: 1, co: 4 } } },
        { nazwa: 'Boom_Dance', sekcja: 'intro', a: 'K1', warstwy: { lustro: true } },
        { nazwa: 'Mroźny Wdech', opis: 'stop-klatka na raz', sekcja: 'Intro', a: 'K1', warstwy: { freeze: { czesc: 0.9 } } },
    ] }) + '\n```';
    const { figury, odrzucone } = odczytajFigury(odp, KLIPY.map((k) => k.nazwa));
    assert.deepEqual(figury.map((f) => f.nazwa), ['Grom', 'Mroźny Wdech'], 'cyfry z nazwy zdjęte');
    assert.equal(figury[1].przepis.warstwy.freeze.czesc, 0.5, 'freeze przycięty do granicy');
    assert.deepEqual(odrzucone.map((o) => o.nazwa), ['Salto', 'Kopia', 'Boom_Dance']);
    assert.match(odrzucone[1].powod, /ten sam przepis/);
    assert.match(odrzucone[2].powod, /zajęta/);
    assert.throws(() => odczytajFigury('nie wiem', ['a']), /JSON/);
});

async function srodowiskoFigur(odpowiedzi) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'figury-'));
    const prosby = [];
    const F = utworzFiguryTanca({
        katalog: path.join(kat, 'choreografie', 'figury'), katalogKuzni: path.join(kat, 'kuznia-soup'), teraz: () => new Date(T0),
        pisz: async ({ system, prompt }) => { prosby.push({ system, prompt }); const o = odpowiedzi.shift(); if (!o) throw new Error('koniec atrapy'); return { tekst: o, model: 'atrapa:8b' }; },
    });
    return { kat, F, prosby };
}

test('Kompozytor proponuje: żadna dobra = jedna poprawka z błędami, potem propozycje do ✓; ✎ = para, ✓/✖ = decyzja; kurs', async () => {
    const zla = JSON.stringify({ figury: [{ nazwa: 'Zła', sekcja: 'drop', a: 'K9', warstwy: { lustro: true } }] });
    const dobra = JSON.stringify({ figury: [
        { nazwa: 'Wirujący Grom', opis: 'obrót na dropie', sekcja: 'drop', a: 'K4', warstwy: { obrot: { obrotow: 1, co: 4 }, podskok: { wysokosc: 0.1, co: 2 } } },
        { nazwa: 'Ręce Bazyliki', sekcja: 'staccato', a: 'K3', b: 'K2', maska: 'rece', warstwy: { akcent: { sila: 0.5, co: 1 } } },
    ] });
    const { kat, F, prosby } = await srodowiskoFigur([zla, dobra]);
    try {
        await assert.rejects(F.proponuj({ mini: { id: 'kot', nazwa: 'Kot' }, klipy: KLIPY.slice(0, 1) }), /co najmniej 2/);
        const r = await F.proponuj({ mini: { id: 'kot', nazwa: 'Kot Tancerz' }, klipy: KLIPY, sekcje: ['drop', 'staccato', 'nic'], okresSek: 0.5, ile: 2 });
        assert.equal(prosby.length, 2);
        assert.match(prosby[0].prompt, /K4 Bass_Beats — moc 100\/100/);
        assert.match(prosby[0].prompt, /Sekcje utworu \(oś Kompozytora\): drop, staccato/);
        assert.match(prosby[1].prompt, /poprzednia odpowiedź była zła: Zła: Klip A „K9”/);
        assert.deepEqual(r.figury.map((f) => [f.nazwa, f.stan]), [['Wirujący Grom', 'propozycja'], ['Ręce Bazyliki', 'propozycja']]);
        assert.ok(r.figury[0].wzor.moc > 2.9 + Math.PI, 'moc wzorcowa przy 120 BPM: Bass Beats + obrót + podskok');
        const [g, rece] = r.figury;
        // ✎ poprawka Suwerena = para „model → Suweren”
        const p = await F.popraw(g.id, { przepis: { ...g.przepis, warstwy: { obrot: { obrotow: 2, co: 4 } } } });
        assert.equal(p.zmiana, true);
        assert.equal(p.obserwacja, 1);
        await assert.rejects(F.popraw(g.id, { przepis: { ...g.przepis, a: 'Moonwalk' } }), /nie ma takiego ruchu/);
        await assert.rejects(F.popraw(rece.id, { nazwa: 'Wirujący Grom' }), /zajęta/);
        assert.equal((await F.decyzja(g.id, 'przyjmij')).stan, 'przyjeta');
        assert.equal((await F.decyzja(rece.id, 'odrzuc')).stan, 'odrzucona');
        const wlasna = await F.dodaj({ mini: { id: 'kot', nazwa: 'Kot Tancerz' }, nazwa: 'Lustro Witraża', przepis: { sekcja: 'outro', a: 'Squat_Stance', warstwy: { lustro: true, freeze: {} } } });
        assert.equal(wlasna.stan, 'przyjeta');
        assert.equal(wlasna.zrodlo, 'suweren');
        const l = await F.lista('kot');
        assert.deepEqual(l.tancerze[0].figury.map((f) => [f.nazwa, f.stan]), [['Wirujący Grom', 'przyjeta'], ['Ręce Bazyliki', 'odrzucona'], ['Lustro Witraża', 'przyjeta']]);
        assert.equal(l.stan.poprawki, 1); assert.equal(l.stan.decyzje, 2);
        const k = await F.kurs();
        assert.deepEqual([k.pary, k.sft], [1, 1]);
        const pary = (await fs.readFile(path.join(kat, 'kuznia-soup', 'figury', 'pary-figur.jsonl'), 'utf8')).trim().split('\n').map((x) => JSON.parse(x));
        assert.match(pary[0].rejected, /"obrotow":1/); assert.match(pary[0].chosen, /"obrotow":2/);
        await F.usun(rece.id);
        assert.equal((await F.lista('kot')).tancerze[0].figury.length, 2);
        await assert.rejects(F.usun('f-00000000'), /Nie ma takiej figury/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('Kompozytor drugi raz zły = błąd wprost z powodami, nic nie zapisane', async () => {
    const zla = JSON.stringify({ figury: [{ nazwa: 'Zły', sekcja: 'drop', a: 'K1' }] });
    const { kat, F } = await srodowiskoFigur([zla, zla]);
    try {
        await assert.rejects(F.proponuj({ mini: { id: 'kot' }, klipy: KLIPY }), /żadnej poprawnej figury: Zły — Figura bez miksu/);
        assert.equal((await F.lista('kot')).tancerze.length, 0);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('trasy /api/taniec/figury: lista, proponuj, poprawka, decyzja, własna, usunięcie, kurs', async () => {
    const { kat, F } = await srodowiskoFigur([JSON.stringify({ figury: [{ nazwa: 'Grom', sekcja: 'drop', a: 'K4', warstwy: { obrot: {} } }] })]);
    const app = express();
    app.use(express.json());
    zamontujTrasyFigur(app, { figury: F });
    const srv = app.listen(0);
    const url = `http://127.0.0.1:${srv.address().port}`;
    const j = (u, metoda = 'GET', cialo) => fetch(url + u, { method: metoda, headers: { 'Content-Type': 'application/json' }, body: cialo ? JSON.stringify(cialo) : undefined }).then(async (r) => ({ kod: r.status, ...(await r.json()) }));
    try {
        const p = await j('/api/taniec/figury/proponuj', 'POST', { mini: { id: 'kot', nazwa: 'Kot' }, klipy: KLIPY });
        assert.equal(p.kod, 200);
        const id = p.figury[0].id;
        assert.equal((await j(`/api/taniec/figury/${id}`, 'PUT', { przepis: { ...p.figury[0].przepis, warstwy: { lustro: true } } })).zmiana, true);
        assert.equal((await j(`/api/taniec/figury/${id}/przyjmij`, 'POST')).figura.stan, 'przyjeta');
        assert.equal((await j('/api/taniec/figury', 'POST', { mini: { id: 'kot' }, nazwa: 'Mój', przepis: { sekcja: 'intro', a: 'K1', warstwy: { lustro: true } } })).figura.stan, 'przyjeta');
        const zla = await j('/api/taniec/figury', 'POST', { mini: { id: 'kot' }, nazwa: 'Zły', przepis: { sekcja: 'intro', a: 'K1' } });
        assert.equal(zla.kod, 400); assert.match(zla.message, /zwykły klip/);
        const l = await j('/api/taniec/figury?mini=kot');
        assert.equal(l.tancerze[0].figury.length, 2);
        assert.deepEqual(l.listy.maski, ['gora', 'dol', 'rece', 'glowa']);
        assert.equal((await j('/api/taniec/figury/f-12345678/odrzuc', 'POST')).kod, 404);
        assert.equal((await j('/api/taniec/figury/kurs', 'POST')).pary, 1);
        assert.equal((await j(`/api/taniec/figury/${id}`, 'DELETE')).usunieta, true);
        const brakModelu = await j('/api/taniec/figury/proponuj', 'POST', { mini: { id: 'kot' }, klipy: KLIPY });
        assert.equal(brakModelu.kod, 502);
    } finally { srv.close(); await fs.rm(kat, { recursive: true, force: true }); }
});
