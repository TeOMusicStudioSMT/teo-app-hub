/** XP za pracę stada: Stado.nagrodz (raz na pracę, bez zgubionych zapisów) + wkłady projektu płacą XP. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Stado.js pisze do <cwd>/_OtakOs_Wymiar/stado.json — test pracuje w swoim katalogu.
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'nagrody-')));
const Stado = await import('../services/Stado.js');
const ProjektStada = await import('../services/ProjektStada.js');
const czekaj = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const w = await fn(); if (w) return w; await new Promise((r) => setTimeout(r, 20)); } throw new Error('timeout'); };

test('nagroda: dodaje XP, ta sama praca płaci raz, wykluwa po progu, śmieci odrzuca', async () => {
    const a = await Stado.nagrodz({ id: 'kupiec', xp: 25, klucz: 'projekt:p1:kupiec', powod: 'wkład' });
    assert.deepEqual({ p: a.przyznane, xp: a.xp }, { p: true, xp: 25 });
    const b = await Stado.nagrodz({ id: 'kupiec', xp: 25, klucz: 'projekt:p1:kupiec' });
    assert.equal(b.przyznane, false);
    assert.match(b.powod, /już została nagrodzona/);
    assert.equal((await Stado.stan()).stany.kupiec.xp, 25);
    assert.ok((await Stado.stan()).stany.kupiec.hatchedAt, 'po 15 XP kompan jest wykluty');
    assert.equal((await Stado.stan()).nagrody, undefined, 'rejestr kluczy nie wycieka do Huba');
    assert.equal((await Stado.nagrodz({ id: '../x', xp: 5, klucz: 'k' })).przyznane, false);
    assert.equal((await Stado.nagrodz({ id: 'kupiec', xp: 5 })).przyznane, false);
});

test('nagrody i zapisy przeglądarki naraz — nic się nie gubi; niższe XP z przeglądarki odrzucone', async () => {
    await Stado.scal({ stany: { joanna: { xp: 100, satiety: 50, mood: 50 } } });
    await Promise.all([
        ...Array.from({ length: 20 }, (_, i) => Stado.nagrodz({ id: 'joanna', xp: 5, klucz: `powitanie:d${i}:joanna` })),
        Stado.scal({ stany: { paleta: { xp: 7 } } }),
        Stado.scal({ aktywny: 'joanna' }),
    ]);
    const s = await Stado.stan();
    assert.equal(s.stany.joanna.xp, 200, '20 × 5 XP do 100 — żadna nagroda nie zgubiona');
    assert.equal(s.stany.paleta.xp, 7);
    // Przeglądarka ze starym stanem (100) nie cofa nagrody.
    const r = await Stado.scal({ stany: { joanna: { xp: 101 } } });
    assert.deepEqual(r.odrzucone, [{ id: 'joanna', naDysku: 200, przyszlo: 101 }]);
    assert.equal(r.nagrody, undefined);
});

test('etap z XP: progi jak w lib/teogochiState.ts', () => {
    const ts = fs.readFileSync(new URL('../lib/teogochiState.ts', import.meta.url), 'utf8');
    const progi = [...ts.matchAll(/stage: '([^']+)',\s*minXp: (\d+)/g)].map((m) => [Number(m[2]), m[1]]);
    assert.deepEqual(Stado.ETAPY, progi, 'kopia progów w moście rozjechała się z Hubem');
    assert.equal(Stado.etapZXp(0), 'jajko');
    assert.equal(Stado.etapZXp(119), 'pisklę');
    assert.equal(Stado.etapZXp(600), 'kompan');
});

test('projekt stada: każdy oddany wkład płaci XP swojemu autorowi, Biblia więcej, nieudany nic', async () => {
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'projekt-xp-')), zdarzenia = [];
    ProjektStada.skonfiguruj({
        katalog, domyslnyModel: 'gemma4:e2b', most: null,
        szyna: { nadaj: async (z) => { zdarzenia.push(z); } },
        modelDla: async () => null, karta: async (id) => ({ tresc: `KARTA ${id}` }),
        chat: async (_m, [sys]) => { if (sys.content.includes('KARTA krawcowa')) throw new Error('Ollama milczy'); return 'wkład'; },
        nagroda: (o) => Stado.nagrodz(o),
    });
    const przed = (await Stado.stan()).stany;
    const s = await ProjektStada.zaloz({ nazwa: 'Moda Teterhii', wizja: 'Kolekcja strojów z klocków.', uczestnicy: [{ id: 'rezyser', imie: 'Reżyser' }, { id: 'kupiec', imie: 'Kupiec' }, { id: 'krawcowa', imie: 'Krawcowa' }], samoZlecanie: false });
    await czekaj(async () => { const x = await ProjektStada.projekt(s.id); return x?.stan !== 'trwa' && x; });
    const po = (await Stado.stan()).stany;
    const xp = (id) => (po[id]?.xp ?? 0) - (przed[id]?.xp ?? 0);
    assert.equal(xp('rezyser'), 25 + 40, 'Reżyser: wkład + Biblia');
    assert.equal(xp('kupiec'), 25);
    assert.equal(xp('krawcowa'), 0, 'nieudany wkład nie płaci');
    assert.ok(zdarzenia.some((z) => z.agent === 'Kupiec' && /\+25 XP za wkład „Moda Teterhii"/.test(z.tresc)));
});

test('nagroda gatunku, którego przeglądarka jeszcze nie odesłała: liczy od XP z migawki, nie od zera', async () => {
    const w = await Stado.nagrodz({ id: 'wektor', xp: 15, klucz: 'zlecenie:p9:merch-1', baza: 900 });
    assert.equal(w.xp, 915);
    const r = await Stado.scal({ stany: { wektor: { xp: 900 } } });   // późniejszy zapis starej przeglądarki
    assert.deepEqual(r.odrzucone, [{ id: 'wektor', naDysku: 915, przyszlo: 900 }]);
});
