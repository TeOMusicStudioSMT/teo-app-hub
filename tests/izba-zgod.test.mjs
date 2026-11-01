// 📥 Izba zgód — rejestr źródeł, „nie odczytałem” przy padniętym/wolnym źródle, sortowanie, `zdalnie`, wieść raz, trasy z dostępem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzIzbe, zamontujTrasyIzby } from '../services/IzbaZgod.js';

function zrodloAtrapa(id, pozycje, opcje = {}) {
    const decyzje = [];
    return { decyzje, z: { id, emoji: '🧪', nazwa: id, czekajace: async () => { if (opcje.pada) throw new Error('dysk nieczytelny'); if (opcje.wolne) await new Promise((r) => setTimeout(r, opcje.wolne)); return pozycje.filter((p) => !decyzje.some((d) => d.id === p.id)); },
        decyduj: async (pid, akcja, o) => { decyzje.push({ id: pid, akcja, ...o }); return { ok: true }; } } };
}

test('czekajace: wszystkie źródła, padnięte i wolne = „nie odczytałem”, pilne najpierw, potem najstarsze; wieść tylko o nowych', async () => {
    const wiesci = [];
    const I = utworzIzbe({ limitMs: 200, szyna: async (w) => wiesci.push(w) });
    const a = zrodloAtrapa('aaa', [{ id: '1', tytul: 'stare', kiedy: '2026-10-01' }, { id: '2', tytul: 'pilne', kiedy: '2026-10-30', pilne: true }]);
    I.zarejestruj(a.z);
    I.zarejestruj(zrodloAtrapa('padla', [], { pada: true }).z);
    I.zarejestruj(zrodloAtrapa('wolne', [{ id: 'x' }], { wolne: 1000 }).z);
    assert.throws(() => I.zarejestruj({ id: 'Złe id', czekajace() {}, decyduj() {} }), /wymagane/);
    const r = await I.czekajace();
    assert.deepEqual(r.pozycje.map((p) => p.tytul), ['pilne', 'stare']);
    assert.deepEqual(r.nieOdczytane.map((n) => n.zrodlo).sort(), ['padla', 'wolne']);
    assert.match(r.nieOdczytane.find((n) => n.zrodlo === 'wolne').powod, /brak odpowiedzi/);
    assert.equal(r.liczby.aaa, 2);
    assert.equal(r.pozycje[0].akcje.length, 2, 'domyślne ✓/✕');
    assert.equal(r.pozycje[0].akcje[0].zdalnie, false, 'domyślnie tylko przy Katedrze');
    assert.equal(wiesci.length, 1);
    assert.match(wiesci[0].tresc, /2 nowe sprawy/);
    await I.czekajace();
    assert.equal(wiesci.length, 1, 'te same pozycje — bez drugiej wieści');
});

test('decyduj: zdalnie=false z telefonu = 403 i źródło nic nie dostaje; znikła sprawa = 409; powód dochodzi do źródła', async () => {
    const I = utworzIzbe();
    const a = zrodloAtrapa('yt', [{ id: 'p1', tytul: 'film', akcje: [{ id: 'przyjmij', etykieta: '✓', zdalnie: true }, { id: 'odrzuc', etykieta: '✕', zdalnie: true }] }, { id: 'gpu', tytul: 'bryła', akcje: [{ id: 'przyjmij', etykieta: '✓ (GPU)' }] }]);
    I.zarejestruj(a.z);
    await assert.rejects(I.decyduj('yt', 'gpu', 'przyjmij', { lokalny: false }), (e) => e.kod === 403);
    assert.equal(a.decyzje.length, 0);
    await I.decyduj('yt', 'gpu', 'przyjmij', { lokalny: true });
    await I.decyduj('yt', 'p1', 'odrzuc', { powod: 'za długi tytuł', lokalny: false });
    assert.deepEqual(a.decyzje.map((d) => [d.id, d.akcja, d.powod]), [['gpu', 'przyjmij', null], ['p1', 'odrzuc', 'za długi tytuł']]);
    await assert.rejects(I.decyduj('yt', 'p1', 'przyjmij', { lokalny: true }), (e) => e.kod === 409);
    await assert.rejects(I.decyduj('nie-ma', '1', 'przyjmij'), (e) => e.kod === 404);
});

test('trasy: dostęp sprawdzany (bez parowania 401), decyzja przez HTTP, obraz tylko ze ścieżek źródła', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'izba-'));
    const png = path.join(tmp, 'po.png');
    await fs.writeFile(png, Buffer.from('obrazek'));
    const I = utworzIzbe();
    const a = zrodloAtrapa('warsztat', [{ id: 'w-1', tytul: 'woda', obrazy: [png], akcje: [{ id: 'przyjmij', etykieta: '✓', zdalnie: true }] }]);
    I.zarejestruj(a.z);
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.lokalny = false; next(); });
    zamontujTrasyIzby(app, I, { dostep: async (req, res) => (req.get('X-Stado-Token') === 'dobry' ? { urzadzenie: 'telefon' } : (res.status(401).json({ success: false, message: 'Brak sparowania.' }), null)) });
    const s = await new Promise((r) => { const x = http.createServer(app).listen(0, '127.0.0.1', () => r(x)); });
    const B = `http://127.0.0.1:${s.address().port}`;
    const H = { 'X-Stado-Token': 'dobry', 'Content-Type': 'application/json' };
    try {
        assert.equal((await fetch(`${B}/api/izba`)).status, 401);
        const lista = await (await fetch(`${B}/api/izba`, { headers: H })).json();
        assert.equal(lista.pozycje[0].obrazy, 1);
        assert.equal(await (await fetch(`${B}/api/izba/obraz/warsztat/w-1/0`, { headers: H })).text(), 'obrazek');
        assert.equal((await fetch(`${B}/api/izba/obraz/warsztat/w-1/1`, { headers: H })).status, 404);
        const d = await (await fetch(`${B}/api/izba/warsztat/w-1/przyjmij`, { method: 'POST', headers: H, body: JSON.stringify({ powod: 'pięknie' }) })).json();
        assert.equal(d.success, true);
        assert.equal(a.decyzje[0].powod, 'pięknie');
    } finally { s.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});
