/**
 * 🎼 Joanna aranżuje szkic — most: plan z zamkniętych list (atrapa modelu, jedna poprawka), ✎ = para do nauki,
 * demo (prawdziwy ffmpeg wav → mp3), pełne brzmienie przez Warsztat (atrapa ACE-Step), oś Kompozytora, biblioteka, Straż.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import { utworzAranz, zamontujTrasyAranzu, oczyscPlan, osZPlanu, typSekcji, KATALOG } from '../services/AranzJoanny.js';
import { utworzKompozytora } from '../services/JajoKompozytora.js';
import { utworzRytm } from '../services/RytmUtworu.js';
import { strazMostu } from '../services/StrazMostu.js';

const ANALIZA = { bpm: 120, tonacja: 'a-moll', pewnoscTonacji: 0.8, nut: 16, motywy: [{ nr: 1, takty: 1, nut: 7, melodia: 'A3 C4 E4 D4 C4 H3 A3', kontur: 'falująca', ocena: 20 }, { nr: 2, takty: 1, nut: 8, melodia: 'E4 F4 G4 A4', kontur: 'wznosząca', ocena: 18 }] };
const PLAN = {
    tytul: 'Szkic a-moll', styl: 'synthwave nocą', tagi: 'synthwave, a minor, 120 bpm, instrumental', tekst: '',
    sekcje: [
        { typ: 'intro', takty: 4, energia: 0.3, progresja: 'i-VI-III-VII', motyw: null, instrumenty: ['pad'] },
        { typ: 'Zwrotka', takty: 8, energia: 0.5, progresja: 'i-iv-v-i', motyw: 1, instrumenty: ['syntezator', 'pad', 'bas-syntetyczny', 'perkusja-elektroniczna', 'theremin'] },
        { typ: 'chorus', takty: 8, energia: 0.9, progresja: 'i-VI-III-VII', motyw: 2, instrumenty: ['dzwonki', 'smyczki', 'bas syntetyczny', 'perkusja-elektroniczna'] },
        { typ: 'outro', takty: 4, progresja: 'i-iv-v-i', motyw: 1, instrumenty: ['fortepian'] },
    ],
};

function wav(sekundy = 1) {
    const sr = 22050, n = sr * sekundy, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / sr) * 9000), 44 + i * 2);
    return b;
}
const MIDI = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 4, 0, 0xff, 0x2f, 0]);

test('oczyscPlan: listy zamknięte, synonimy, motywy z analizy, granice', () => {
    const p = oczyscPlan(PLAN, { motywy: [1, 2] });
    assert.deepEqual(p.sekcje.map((s) => s.typ), ['intro', 'zwrotka', 'refren', 'outro']);
    assert.equal(p.takty, 24);
    assert.equal(p.pominiete, 1, 'theremin spoza listy pominięty');
    assert.deepEqual(p.sekcje[2].instrumenty, ['dzwonki', 'smyczki', 'bas-syntetyczny', 'perkusja-elektroniczna']);
    assert.equal(p.sekcje[3].energia, 0.3, 'domyślna energia typu');
    assert.equal(typSekcji('Przejście'), 'przejscie');
    assert.equal(oczyscPlan({ ...PLAN, sekcje: [PLAN.sekcje[0], { ...PLAN.sekcje[1], progresja: 'i-vi-IV-V' }] }, { motywy: [1, 2] }).sekcje[1].progresja, 'I-vi-IV-V');
    const zle = (zmiana, re) => assert.throws(() => oczyscPlan({ ...PLAN, ...zmiana }, { motywy: [1, 2] }), re);
    zle({ sekcje: [{ ...PLAN.sekcje[0], typ: 'solo' }, PLAN.sekcje[1]] }, /nieznany typ/);
    zle({ sekcje: [PLAN.sekcje[0], { ...PLAN.sekcje[1], progresja: 'I-bVII' }] }, /spoza listy/);
    zle({ sekcje: [PLAN.sekcje[0], { ...PLAN.sekcje[1], motyw: 7 }] }, /spoza analizy/);
    zle({ sekcje: [PLAN.sekcje[0], { ...PLAN.sekcje[1], takty: 2.5 }] }, /całą liczbą/);
    zle({ sekcje: [PLAN.sekcje[0], { ...PLAN.sekcje[1], instrumenty: ['theremin'] }] }, /żaden instrument/);
    zle({ sekcje: [{ ...PLAN.sekcje[0], takty: 2 }, { ...PLAN.sekcje[1], takty: 2 }] }, /taktów/);
    zle({ sekcje: PLAN.sekcje.map((s) => ({ ...s, motyw: null })) }, /motywu Suwerena/);
    zle({ tagi: '' }, /tagów/);
    // motyw bez instrumentu melodii milknie (nie zgadujemy instrumentu)
    assert.equal(oczyscPlan({ ...PLAN, sekcje: [...PLAN.sekcje, { typ: 'drop', takty: 4, progresja: 'I-V-vi-IV', motyw: 2, instrumenty: ['pad'] }] }, { motywy: [1, 2] }).sekcje[4].motyw, null);
    const o = osZPlanu(p, 120);
    assert.deepEqual(o.sekcje.map((s) => [s.typ, s.od, s.do]), [['intro', 0, 4], ['staccato', 4, 12], ['drop', 12, 20], ['outro', 20, 24]]);
});

async function przygotuj({ zStraza = false, odpowiedzi } = {}) {
    const korzen = await fs.mkdtemp(path.join(os.tmpdir(), 'aranz-'));
    const katalogMuzyki = path.join(korzen, 'muzyka');
    await fs.mkdir(path.join(katalogMuzyki, 'Jam z Joanną'), { recursive: true });
    await fs.writeFile(path.join(katalogMuzyki, 'Jam z Joanną', 'jam.mid'), MIDI);
    const kolejne = [...(odpowiedzi ?? [])];
    const zapytania = [];
    const pisz = async (z) => { zapytania.push(z); return { tekst: kolejne.shift() ?? '{}', model: 'atrapa' }; };
    const zadania = new Map();
    const wynikACE = path.join(korzen, 'ace.mp3');
    const warsztat = {
        przerob: async (o) => { const z = { id: `wr-${zadania.size + 1}`, stan: 'liczy', sila: o.sila, o }; zadania.set(z.id, z); return z; },
        stanZadania: (id) => zadania.get(id) ?? null,
    };
    const kompozytor = utworzKompozytora({ katalog: path.join(korzen, 'kompozytor'), pisz: async () => ({ tekst: '{}' }) });
    const A = utworzAranz({ katalogMuzyki, katalog: path.join(korzen, 'wymiar'), ffmpeg: ffmpegPath, pisz, warsztat, comfy: async () => ({ online: true }), kompozytor });
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    if (zStraza) app.use(strazMostu({ klucz: () => 'k'.repeat(48), zaufane: [] }));
    zamontujTrasyAranzu(app, A);
    const s = await new Promise((ok) => { const x = app.listen(0, '127.0.0.1', () => ok(x)); });
    const url = `http://127.0.0.1:${s.address().port}`;
    const j = async (m, p, body) => { const r = await fetch(`${url}${p}`, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
    return { korzen, katalogMuzyki, j, url, zapytania, zadania, wynikACE, kompozytor, zamknij: async () => { await new Promise((ok) => s.close(ok)); await fs.rm(korzen, { recursive: true, force: true }); } };
}

test('trasy: plan (zła odpowiedź → poprawka), ✎, demo, pełne brzmienie, oś Kompozytora, biblioteka', async () => {
    const zly = JSON.stringify({ ...PLAN, sekcje: [{ ...PLAN.sekcje[0], progresja: 'jazz' }, PLAN.sekcje[1]] });
    const T = await przygotuj({ odpowiedzi: [`Oto plan: ${zly}`, JSON.stringify(PLAN)] });
    try {
        let d = await T.j('POST', '/api/aranz', { jam: 'Jam z Joanną/jam.mid', analiza: ANALIZA, uwagi: 'nocny klimat' });
        assert.equal(d.success, true, d.message);
        const id = d.aranz.id;
        assert.match(id, /^a-[0-9a-f]{8}$/);
        assert.equal(T.zapytania.length, 2);
        assert.match(T.zapytania[1].prompt, /poprzednia odpowiedź była zła: .*progresja „jazz” spoza listy/);
        assert.match(T.zapytania[0].prompt, /nocny klimat/);
        assert.match(T.zapytania[0].system, /NUT NIE PISZESZ/);
        assert.equal(d.aranz.plan.sekcje.length, 4);
        // brak motywów i nieznany jam = odmowa bez modelu
        assert.equal((await T.j('POST', '/api/aranz', { analiza: { ...ANALIZA, motywy: [] } })).status, 400);
        assert.equal((await T.j('POST', '/api/aranz', { jam: 'Jam z Joanną/nie-ma.mid', analiza: ANALIZA })).status, 400);
        // ✎ poprawka Suwerena = para „model → Suweren”
        const nowy = { ...d.aranz.plan, tytul: 'Nocny szkic', sekcje: d.aranz.plan.sekcje.map((s, i) => (i === 2 ? { ...s, typ: 'drop', energia: 1 } : s)) };
        d = await T.j('PUT', `/api/aranz/${id}`, { plan: nowy });
        assert.equal(d.aranz.poprawiony, true);
        assert.equal(d.aranz.odModelu.tytul, 'Szkic a-moll');
        const obs = (await fs.readFile(path.join(T.korzen, 'wymiar', 'obserwacje.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
        assert.equal(obs[0].odSuwerena.tytul, 'Nocny szkic');
        assert.equal(obs[0].odModelu.tytul, 'Szkic a-moll');
        assert.equal((await T.j('PUT', `/api/aranz/${id}`, { plan: { ...nowy, sekcje: [{ typ: 'solo' }] } })).status, 400);
        // brzmienie przed demo = odmowa
        assert.equal((await T.j('POST', `/api/aranz/${id}/brzmienie`, {})).status, 424);
        // demo: wav → mp3 + .mid + plan.json w bibliotece, oś Kompozytora
        d = await T.j('POST', `/api/aranz/${id}/demo`, { audio: wav(2).toString('base64'), typAudio: 'audio/wav', midi: MIDI.toString('base64') });
        assert.equal(d.success, true, d.message);
        assert.equal(d.aranz.demo.mp3, `${KATALOG}/Nocny szkic [${id.slice(2)}] (demo).mp3`);
        const mp3 = await fs.readFile(path.join(T.katalogMuzyki, d.aranz.demo.mp3));
        assert.ok(mp3.length > 4000);
        assert.ok((await fs.readdir(path.join(T.katalogMuzyki, KATALOG))).some((f) => f.endsWith('.plan.json')));
        assert.ok(!(await fs.readdir(path.join(T.katalogMuzyki, KATALOG))).some((f) => f.includes('surowe')));
        const osDemo = await T.kompozytor.dla(d.aranz.demo.mp3);
        assert.equal(osDemo.stan, 'aranz');
        assert.deepEqual(osDemo.sekcje.map((s) => [s.typ, s.od, s.do]), [['intro', 0, 4], ['staccato', 4, 12], ['drop', 12, 20], ['outro', 20, 24]]);
        assert.equal((await T.kompozytor.kurs({ zapisz: false })).sft, 0, 'oś z aranżu nie uczy Kompozytora');
        // pełne brzmienie: Warsztat remiks z tagami, tempem i tonacją
        d = await T.j('POST', `/api/aranz/${id}/brzmienie`, { sila: 0.4 });
        assert.equal(d.aranz.brzmienie.stan, 'liczy');
        const z = T.zadania.get(d.aranz.brzmienie.zadanie);
        assert.deepEqual([z.o.tryb, z.o.plik, z.o.tags, z.o.bpm, z.o.keyscale, z.o.sila], ['remiks', d.aranz.demo.mp3, PLAN.tagi, 120, 'A minor', 0.4]);
        await fs.writeFile(T.wynikACE, mp3);
        Object.assign(z, { stan: 'gotowe', wynik: T.wynikACE, sekundyWyniku: 2 });
        d = await T.j('GET', `/api/aranz/${id}`);
        assert.equal(d.aranz.brzmienie.stan, 'gotowe');
        assert.equal(d.aranz.brzmienie.plik, `${KATALOG}/Nocny szkic [${id.slice(2)}].mp3`);
        assert.equal(d.aranz.osie.length, 2);
        const rytm = utworzRytm({ katalogMuzyki: T.katalogMuzyki, katalog: path.join(T.korzen, '_rytm'), ffmpeg: ffmpegPath, uruchom: async () => ({ stdout: Buffer.alloc(0) }) });
        const pliki = (await rytm.utwory()).map((u) => u.plik);
        assert.ok(pliki.includes(d.aranz.brzmienie.plik) && pliki.includes(d.aranz.demo.mp3), 'biblioteka widzi demo i utwór');
        // błąd Warsztatu = powód
        await T.j('POST', `/api/aranz/${id}/brzmienie`, {});
        const z2 = [...T.zadania.values()].at(-1);
        Object.assign(z2, { stan: 'blad', blad: 'ComfyUI: brak wag' });
        assert.equal((await T.j('GET', `/api/aranz/${id}`)).aranz.brzmienie.blad, 'ComfyUI: brak wag');
        // lista, decyzja, usunięcie
        assert.equal((await T.j('POST', `/api/aranz/${id}/przyjmij`)).aranz.stan, 'przyjety');
        d = await T.j('GET', '/api/aranz');
        assert.equal(d.aranze.length, 1);
        assert.ok(d.progresje.includes('i-VI-III-VII'));
        assert.equal((await T.j('DELETE', `/api/aranz/${id}`)).usuniety, true);
        assert.equal((await T.j('GET', `/api/aranz/${id}`)).status, 404);
    } finally { await T.zamknij(); }
});

test('plan: dwa razy zła odpowiedź = błąd wprost; Straż: tylko maszyna', async () => {
    const T = await przygotuj({ odpowiedzi: ['C4 E4 G4', '{"sekcje":[]}'], zStraza: true });
    try {
        const r = await fetch(`${T.url}/api/aranz`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://localhost:5173' }, body: JSON.stringify({ analiza: ANALIZA }) });
        assert.equal(r.status, 400);
        assert.match((await r.json()).message, /co najmniej 2 sekcji/);
        assert.equal((await fetch(`${T.url}/api/aranz`, { headers: { origin: 'https://zla-strona.example' } })).status, 401);
        assert.equal((await fetch(`${T.url}/api/aranz`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4', 'x-teo-klucz': 'k'.repeat(48) }, body: '{}' })).status, 403);
    } finally { await T.zamknij(); }
});
