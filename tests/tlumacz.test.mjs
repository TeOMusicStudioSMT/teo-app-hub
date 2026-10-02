// 🌍 Tłumacz: teksty Hubu na dowolny język lokalnym modelem — paczkami, z pamięcią na dysku, bez wymyślania.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as Tl from '../services/Tlumacz.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tlumacz-'));
/** Atrapa modelu: czyta JSON z promptu i oddaje „[DE] tekst" — chyba że `zepsuj` mówi inaczej. */
function model({ zepsuj = null } = {}) {
    const wolania = [];
    return {
        wolania,
        pisz: async (system, prompt) => {
            wolania.push({ system, wejscie: JSON.parse(prompt) });
            if (zepsuj === 'tekst') return 'Przepraszam, nie umiem.';
            const out = {};
            for (const [k, v] of Object.entries(JSON.parse(prompt))) out[k] = zepsuj === 'dlugie' && k === '0' ? 'x'.repeat(500) : `[DE] ${v}`;
            return `Oto tłumaczenie:\n${JSON.stringify(out)}`;
        },
    };
}

test('Tłumacz: brakujące paczkami do modelu, wynik zapamiętany na dysku — drugie wołanie bez modelu', async () => {
    const katalog = tmp();
    const m = model();
    Tl.skonfiguruj({ katalog, pisz: m.pisz, paczka: 2 });
    const r = await Tl.tlumacz('de', ['Zapisz', 'Zamknij', 'Stół ratyfikacji', 'Zapisz', '42', '⟳', 'https://otakos.wtf', 'wiesio-bridge.js']);
    assert.deepEqual(r.mapa, { 'Zapisz': '[DE] Zapisz', 'Zamknij': '[DE] Zamknij', 'Stół ratyfikacji': '[DE] Stół ratyfikacji' });
    assert.equal(r.nowych, 3);
    assert.equal(m.wolania.length, 2, 'paczki po 2');
    assert.match(m.wolania[0].system, /na język: Deutsch \(de\)/);
    assert.match(m.wolania[0].system, /nie tłumacz nazw własnych: .*TeOgochi/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(katalog, 'de.json'), 'utf8'))['Zamknij'], '[DE] Zamknij');

    const r2 = await Tl.tlumacz('de', ['Zamknij']);
    assert.deepEqual([r2.mapa, r2.nowych, m.wolania.length], [{ 'Zamknij': '[DE] Zamknij' }, 0, 2]);
    assert.deepEqual(await Tl.slownik('de'), { 'Zapisz': '[DE] Zapisz', 'Zamknij': '[DE] Zamknij', 'Stół ratyfikacji': '[DE] Stół ratyfikacji' });

    const pl = await Tl.tlumacz('pl', ['Zapisz']);
    assert.deepEqual([pl.mapa, m.wolania.length], [{ 'Zapisz': 'Zapisz' }, 2], 'polski = oryginał, bez modelu');
    await assert.rejects(Tl.tlumacz('../etc', ['x']), /Nieznany kod języka/);
});

test('Tłumacz: model bez JSON-a albo z elaboratem zamiast napisu → tekst zostaje po polsku (pominięty), nic nie zmyślamy', async () => {
    const zly = model({ zepsuj: 'tekst' });
    Tl.skonfiguruj({ katalog: tmp(), pisz: zly.pisz, paczka: 30 });
    const r = await Tl.tlumacz('fr', ['Sprawdź aktualizację']);
    assert.deepEqual([r.mapa, r.pominiete], [{}, ['Sprawdź aktualizację']]);
    assert.match(r.blad, /nie oddał JSON-a/);

    const dlugi = model({ zepsuj: 'dlugie' });
    Tl.skonfiguruj({ katalog: tmp(), pisz: dlugi.pisz });
    const r2 = await Tl.tlumacz('es', ['Tak', 'Zapisz plik']);
    assert.deepEqual(r2.mapa, { 'Zapisz plik': '[DE] Zapisz plik' });
    assert.deepEqual(r2.pominiete, ['Tak'], '500 znaków zamiast „Tak" to nie tłumaczenie');
});

test('Tłumacz: dwa ekrany naraz pytają o to samo — model liczy raz (jedna paczka naraz, kolejka)', async () => {
    const m = model();
    let rownolegle = 0, max = 0;
    Tl.skonfiguruj({ katalog: tmp(), paczka: 30, pisz: async (s, p) => { rownolegle++; max = Math.max(max, rownolegle); await new Promise((r) => setTimeout(r, 30)); rownolegle--; return m.pisz(s, p); } });
    const [a, b] = await Promise.all([Tl.tlumacz('uk', ['Projekt Stada', 'Nocna Zmiana']), Tl.tlumacz('uk', ['Nocna Zmiana', 'Kuźnia Modeli'])]);
    assert.equal(max, 1, 'model nigdy nie dostaje dwóch paczek naraz');
    assert.equal(a.mapa['Nocna Zmiana'], '[DE] Nocna Zmiana');
    assert.equal(b.mapa['Kuźnia Modeli'], '[DE] Kuźnia Modeli');
    const policzone = m.wolania.flatMap((w) => Object.values(w.wejscie));
    assert.deepEqual(policzone.sort(), ['Kuźnia Modeli', 'Nocna Zmiana', 'Projekt Stada'], 'każdy tekst raz');
});

test('Tłumacz: filtr — słowa tak; liczby, symbole, adresy i pliki nie', () => {
    for (const t of ['Zapisz', 'Stół ratyfikacji', '🔄 Aktualizacja Katedry', 'Tak']) assert.ok(Tl.doTlumaczenia(t), t);
    for (const t of ['', '4', '3,60 €', '⟳', '—', 'https://otakos.wtf', '/api/stol', 'a@b.pl', 'straz.mjs', 'GRV', '75f2edb (origin/main)', 'origin/main', 'scripts/glowny/katedra.mjs', 'x'.repeat(601)]) assert.ok(!Tl.doTlumaczenia(t), t);
});
