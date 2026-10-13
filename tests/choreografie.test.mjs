// 🩰 Choreografie Tanecznego Starcia — zapis (frazy i ocena z rytmu mostu), nagranie występu (limit, mp4), okresy
// turniejów (UTC, tydzień ISO, Mistrzostwa w grudniu), zgłoszenia (najlepszy w okresie), sprawdzanie występów innych
// Katedr w Klubie Mistrzów (podkręcona ocena odrzucona). Prawdziwy dysk tymczasowy, atrapa sieci i ffmpeg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzChoreografie, zamontujTrasyChoreografii, okresyTanca, tydzienISO, tanecZSieci, frazyZRytmu, ulozChoreografie, ocenChoreografie, MAX_NAGRANIA_MB } from '../services/Choreografie.js';
import { utworzKlub } from '../services/KlubMistrzow.js';

const T0 = Date.parse('2026-10-13T12:00:00Z');
const RYTM = { plik: 'Bazylika/bit.mp3', bpm: 120, okresSek: 0.5, przesuniecieSek: 0.1, sekundy: 33, pewnosc: 0.9,
    beaty: Array.from({ length: 64 }, (_, i) => ({ t: 0.1 + i * 0.5, sila: i >= 24 && i < 48 ? 0.9 : 0.3 })) };
const RUCHY = [
    { nazwa: 'Boom_Dance', sek: 4.1, moc: 2.4 }, { nazwa: 'FunnyDancing_01', sek: 2.0, moc: 1.1 }, { nazwa: 'Squat_Stance', sek: 3.0, moc: 0.5 },
    { nazwa: 'Bass_Beats', sek: 1.9, moc: 2.9 }, { nazwa: 'Bubble_Dance', sek: 4.0, moc: 0.9 },
];
const uklad = () => ulozChoreografie(frazyZRytmu(RYTM, 8), RUCHY, 0.5);

async function srodowisko(teraz = () => T0) {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'choreo-'));
    const mistrz = [];
    const C = utworzChoreografie({
        katalog: kat, teraz,
        rytm: async (plik) => { if (plik !== RYTM.plik) throw new Error('Nie ma takiego utworu.'); return RYTM; },
        katalogMontazy: async (projekt) => { const k = path.join(kat, 'produkcje', projekt, 'montaz'); await fs.mkdir(k, { recursive: true }); return k; },
        ffmpeg: 'ffmpeg', uruchom: async (_c, args) => { await fs.writeFile(args[args.length - 1], Buffer.from('mp4')); return { stdout: '' }; },
        mistrzGry: { wynikChoreografii: async (w) => mistrz.push(w) },
    });
    return { kat, C, mistrz };
}

test('okresy: doba UTC, tydzień ISO, Mistrzostwa Świata tylko w grudniu', () => {
    assert.deepEqual(okresyTanca(T0).map((o) => o.klucz), ['2026-10-13', '2026-W42', '2026-10', '2026']);
    assert.equal(tydzienISO(Date.parse('2027-01-01T10:00:00Z')), '2026-W53');   // piątek 1.01.2027 należy do ostatniego tygodnia 2026
    assert.equal(tydzienISO(Date.parse('2026-01-01T10:00:00Z')), '2026-W01');
    const gr = okresyTanca(Date.parse('2026-12-24T10:00:00Z'));
    assert.equal(gr.at(-1).klucz, 'MS-2026');
    assert.equal(gr.at(-1).nazwa, 'Mistrzostwa Świata 2026');
});

test('zapis: frazy i ocena z rytmu mostu (nie z przeglądarki), złe dane odrzucone, zmiana zachowuje id', async () => {
    const { kat, C } = await srodowisko();
    try {
        const u = uklad();
        await assert.rejects(C.zapisz({ utwor: { plik: RYTM.plik }, fraza: 8, ruchy: RUCHY, uklad: [0, 1] }), /Układ ma 2 fraz/);
        await assert.rejects(C.zapisz({ utwor: { plik: RYTM.plik }, fraza: 5, ruchy: RUCHY, uklad: u }), /Fraza/);
        await assert.rejects(C.zapisz({ utwor: { plik: RYTM.plik }, fraza: 8, ruchy: [RUCHY[0]], uklad: u }), /co najmniej 2 ruchów/);
        await assert.rejects(C.zapisz({ utwor: { plik: RYTM.plik }, fraza: 8, ruchy: RUCHY, uklad: u.map(() => 9) }), /ruch, którego nie ma/);
        const c = await C.zapisz({ nazwa: '', mini: { id: 'mini-kot', nazwa: 'Kot Tancerz' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy: RUCHY, uklad: u, przypiete: [2, 99], frazy: [{ od: 0, uderzen: 8, energia: 1 }] });
        assert.match(c.id, /^c-[0-9a-f]{8}$/);
        assert.equal(c.nazwa, 'Kot Tancerz — Bit');
        assert.equal(c.frazy.length, 8, 'frazy z rytmu mostu, nie z ciała żądania');
        assert.deepEqual(c.ocena, ocenChoreografie({ okresSek: 0.5, frazy: frazyZRytmu(RYTM, 8), ruchy: RUCHY, uklad: u }));
        assert.deepEqual(c.przypiete, [2]);
        const c2 = await C.zapisz({ ...c, uklad: [...u].reverse() });
        assert.equal(c2.id, c.id);
        assert.notEqual(c2.odcisk, c.odcisk);
        assert.equal((await C.lista()).length, 1);
        await assert.rejects(C.wczytaj('../x'), /Złe id/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('nagranie: pusty i za duży odrzucone, webm → mp4 w montażu projektu, wpis w choreografii', async () => {
    const { kat, C } = await srodowisko();
    try {
        const c = await C.zapisz({ mini: { nazwa: 'Kot Tancerz' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy: RUCHY, uklad: uklad() });
        await assert.rejects(C.nagranie(c.id, Buffer.alloc(10)), /puste/);
        await assert.rejects(C.nagranie(c.id, Buffer.alloc(2048), { typ: 'text/html' }), /webm albo mp4/);
        const n = await C.nagranie(c.id, Buffer.alloc(4096, 1), { typ: 'video/webm' });
        assert.match(n.nazwa, /^taniec_Kot_Tancerz_Bit_[0-9a-f]{6}\.mp4$/);
        assert.equal(n.projekt, 'taneczne-starcie');
        assert.ok(n.plik.includes(path.join('produkcje', 'taneczne-starcie', 'montaz')));
        assert.deepEqual((await fs.readdir(path.dirname(n.plik))).length, 1, 'webm zdjęty po mp4');
        assert.equal((await C.wczytaj(c.id)).nagrania.length, 1);
        assert.ok(MAX_NAGRANIA_MB >= 100);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('zgłoszenie: najlepszy występ w każdym okresie, Mistrz Gry dostaje wynik, wizytówka niesie dane do sprawdzenia', async () => {
    let teraz = T0;
    const { kat, C, mistrz } = await srodowisko(() => teraz);
    try {
        const dobra = await C.zapisz({ mini: { nazwa: 'Kot Tancerz' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy: RUCHY, uklad: uklad() });
        const nuda = await C.zapisz({ mini: { nazwa: 'Kot Tancerz' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy: RUCHY, uklad: uklad().map(() => 2) });
        assert.ok(dobra.ocena.wynik > nuda.ocena.wynik);
        const z1 = await C.zglos(nuda.id);
        assert.ok(z1.okresy.every((o) => o.poprawiony));
        const z2 = await C.zglos(dobra.id);
        assert.ok(z2.okresy.every((o) => o.poprawiony && o.poprzednia === nuda.ocena.wynik));
        const z3 = await C.zglos(nuda.id);
        assert.ok(z3.okresy.every((o) => !o.poprawiony && o.ocena === dobra.ocena.wynik), 'gorszy nie nadpisuje');
        assert.equal(mistrz.length, 3);
        assert.deepEqual(mistrz[2].okresy, []);
        const pub = await C.publiczne();
        assert.equal(pub.length, 4);
        assert.equal(pub[0].choreografia, undefined, 'id pliku nie wychodzi do sieci');
        // inna Katedra liczy tę samą ocenę z danych wizytówki
        const spr = tanecZSieci(pub[0], 'teo-mas', teraz);
        assert.equal(spr.ocena.wynik, dobra.ocena.wynik);
        // następny dzień: Taniec Dnia pusty, tydzień trwa
        teraz = T0 + 86_400_000;
        assert.deepEqual((await C.moje()).map((o) => !!o.wynik), [false, true, true, true]);
        assert.equal(tanecZSieci(pub[0], 'teo-mas', teraz), null, 'wczorajszy Taniec Dnia już nie trwa');
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('tanecZSieci: podkręcona ocena i podmieniony układ odrzucone z powodem', async () => {
    const { kat, C } = await srodowisko();
    try {
        const c = await C.zapisz({ mini: { nazwa: 'Kot' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy: RUCHY, uklad: uklad() });
        await C.zglos(c.id);
        const [w] = await C.publiczne();
        assert.match(tanecZSieci({ ...w, ocena: { ...w.ocena, wynik: 100 } }, 'x', T0).powod, /ocena się nie zgadza/);
        const inny = { ...w, dane: { ...w.dane, uklad: w.dane.uklad.map(() => 0) } };
        assert.ok(tanecZSieci(inny, 'x', T0).odrzucony);
        assert.match(tanecZSieci({ ...w, dane: { ...w.dane, ruchy: [] } }, 'x', T0).powod, /co najmniej 2/);
        assert.equal(tanecZSieci({ ...w, okres: 'stulecie' }, 'x', T0), null);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('Klub Mistrzów: tance w wizytówce, zwiad liczy ranking okresów, oszust odrzucony, lider ogłoszony raz', async () => {
    const katA = await srodowisko();
    const katB = await srodowisko();
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'klub-tance-'));
    try {
        // Katedra „wyspa-ola” — lepszy taniec; „oszust” podkręca ocenę
        const ola = await katB.C.zapisz({ mini: { nazwa: 'Lis Salsa' }, utwor: { plik: RYTM.plik, tytul: 'Salsa' }, fraza: 8, ruchy: RUCHY, uklad: uklad() });
        await katB.C.zglos(ola.id);
        const tanceOli = await katB.C.publiczne();
        const moja = await katA.C.zapisz({ mini: { nazwa: 'Kot Tancerz' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy: RUCHY, uklad: uklad().map((m, i) => (i % 2 ? 2 : m)) });
        await katA.C.zglos(moja.id);
        const siec = {
            'https://rejestr/api/katedry': { katedry: [
                { nick: 'wyspa-ola', adres: 'https://ola.example', klucz: 'KOLA', mistrz: { etap: 'pęka', eventy: [], wyniki: [] } },   // rejestr bez `tance`
                { nick: 'oszust', adres: 'https://oszust.example', klucz: 'KO' },
            ] },
            'https://ola.example/api/wizytowka': { nick: 'wyspa-ola', klucz: 'KOLA', mistrz: { etap: 'pęka', eventy: [], wyniki: [], tance: tanceOli } },
            'https://oszust.example/api/wizytowka': { nick: 'oszust', klucz: 'KO', mistrz: { etap: 'jajo', eventy: [], wyniki: [], tance: tanceOli.map((t) => ({ ...t, ocena: { ...t.ocena, wynik: 100 } })) } },
        };
        const f = async (url) => { if (!(url in siec)) throw new Error(`brak ${url}`); return { ok: true, status: 200, json: async () => siec[url] }; };
        const wiesci = [];
        const K = utworzKlub({ katalog: kat, nick: async () => 'teo-mas', rejestr: 'https://rejestr/api/katedry', fetch: f, teraz: () => T0, tance: () => katA.C.publiczne(), wiesc: async (w) => wiesci.push(w) });
        const pub = await K.publiczne();
        assert.equal(pub.tance.length, 4);
        const p = await K.zwiad({ swiezo: true });
        const dnia = p.tance.dzien;
        assert.equal(dnia.klucz, '2026-10-13');
        assert.deepEqual(dnia.ranking.map((x) => x.nick), ['wyspa-ola', 'teo-mas']);
        assert.equal(dnia.ranking[0].ocena.wynik, ola.ocena.wynik);
        assert.ok(p.tanceOdrzucone.some((x) => x.nick === 'oszust' && /ocena się nie zgadza/.test(x.powod)));
        const lid = wiesci.filter((w) => /Katedra „wyspa-ola” prowadzi/.test(w.tresc));
        assert.equal(lid.length, 1, 'jedna wieść na lidera');
        assert.match(lid[0].tresc, /Taniec Dnia, Taniec Tygodnia, Taniec Miesiąca, Taniec Roku/);
        await K.zwiad({ swiezo: true });
        assert.equal(wiesci.filter((w) => /prowadzi/.test(w.tresc)).length, 1, 'drugi zwiad nie powtarza wieści');
    } finally { for (const k of [katA.kat, katB.kat, kat]) await fs.rm(k, { recursive: true, force: true }); }
});

test('trasy: zapis, nagranie surowym ciałem, turnieje i zgłoszenie', async () => {
    const { kat, C } = await srodowisko();
    const app = express();
    app.use(express.json());
    zamontujTrasyChoreografii(app, { choreografie: C, raw: express.raw, mistrzGry: { eventDzisiaj: async () => ({ nazwa: 'Turniej: Takt', zapowiedz: 'Dziś takt' }) } });
    const srv = app.listen(0);
    const url = `http://127.0.0.1:${srv.address().port}`;
    try {
        const j = async (p, o) => { const r = await fetch(url + p, o); return { status: r.status, ...(await r.json()) }; };
        const z = await j('/api/choreografie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mini: { nazwa: 'Kot' }, utwor: { plik: RYTM.plik, tytul: 'Bit' }, fraza: 8, ruchy: RUCHY, uklad: uklad() }) });
        assert.equal(z.success, true);
        const id = z.choreografia.id;
        const n = await j(`/api/choreografie/${id}/nagranie`, { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: Buffer.alloc(5000, 7) });
        assert.equal(n.success, true);
        assert.match(n.nagranie.nazwa, /\.mp4$/);
        assert.equal((await j('/api/choreografie/c-00000000')).status, 404);
        const t = await j('/api/taniec/turnieje');
        assert.equal(t.okresy.length, 4);
        assert.equal(t.eventDnia.nazwa, 'Turniej: Takt');
        const zg = await j('/api/taniec/zglos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        assert.equal(zg.okresy.length, 4);
        assert.equal((await j(`/api/choreografie/${id}`, { method: 'DELETE' })).usunieta, true);
    } finally { srv.close(); await fs.rm(kat, { recursive: true, force: true }); }
});
