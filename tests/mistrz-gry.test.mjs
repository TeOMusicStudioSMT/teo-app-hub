// 🎲👑 Mistrz Gry Teterhii — orzeka ton z pięciu (Jev albo model), event dnia z faktu Katedry z zamkniętego katalogu,
// turniej tylko taki, jaki dziś ogłoszono. Atrapy Jev i modelu, prawdziwy dysk w katalogu tymczasowym.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzMistrzaGry, zbudujEvent, eventZLosu, faktyKatedry, tonZJev, KATALOG } from '../services/MistrzGry.js';

const teraz = () => new Date('2026-10-09T12:00:00Z');
const jevAtrapa = (choice, probabilities) => ({ stan: () => ({ maKlucz: true }), zapytaj: async (o) => { jevAtrapa.ostatnie = o; return { answers: { ton: { choice, probabilities } } }; } });

test('zbudujEvent: tylko katalog i dozwolone parametry; widełki z katalogu, nie z modelu', () => {
    const e = zbudujEvent({ typ: 'turniej', parametr: 'Zwinność', zapowiedz: 'x' });
    assert.deepEqual([e.parametr, e.nazwa], ['zwinnosc', 'Turniej: Zwinność']);
    assert.deepEqual(e.mod, { turniej: { dziedzina: 'zwinnosc', starc: 3, nagrodaMGRV: 100 } });
    assert.throws(() => zbudujEvent({ typ: 'deszcz-zlota' }), /Nie ma takiego eventu/);
    assert.throws(() => zbudujEvent({ typ: 'dzien-tonu', parametr: 'brutalny' }), /Zły parametr/);
    assert.deepEqual(zbudujEvent({ typ: 'zlota-pauza', parametr: 'cokolwiek' }).mod, { mgrvQuestow: 1.2 });
    assert.deepEqual(eventZLosu('2026-10-09'), eventZLosu('2026-10-09'), 'los z daty jest stały cały dzień');
    assert.ok(KATALOG[eventZLosu('2026-10-10').typ]);
});

test('faktyKatedry i tonZJev', () => {
    const f = faktyKatedry([{ agent: 'Kodeks', rodzaj: 'praca', tresc: '„teterhia": zbudowane w 300 s (4 rund)' }, { agent: 'Kodeks', rodzaj: 'praca', tresc: 'buduję w „x"' }, { agent: 'Aktor', rodzaj: 'blad', tresc: 'x' }]);
    assert.equal(f.ile, 3);
    assert.equal(f.kto, 'Kodeks (2), Aktor (1)');
    assert.deepEqual(f.linie, ['Kodeks: „teterhia": zbudowane w 300 s (4 rund)']);
    assert.deepEqual(tonZJev({ answers: { ton: { choice: 'empatyczny', probabilities: { empatyczny: 0.7, holistyczny: 0.2 } } } }), { ton: 'empatyczny', p: 0.7, drugi: { ton: 'holistyczny', p: 0.2 } });
    assert.throws(() => tonZJev({ answers: { ton: { choice: 'miły' } } }), /spoza listy/);
});

test('kwestia: Jev orzeka ton, model opisuje skutek; bez Jev — model; ton spoza listy = błąd wprost', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'mg-'));
    try {
        let prompt = '', system = '';
        const M = utworzMistrzaGry({ katalog: kat, teraz, jev: jevAtrapa('empatyczny', { empatyczny: 0.81, autentyczny: 0.1 }), zasady: async () => ['Skracaj do jednego zdania.'],
            pisz: async (o) => { prompt = o.prompt; system = o.system; return '{"ton":"brutalny","narracja":"Zgrzytowiec milknie i odchodzi w mgłę."}'; } });
        await assert.rejects(M.rozstrzygnijKwestie({ czyn: 'x' }), /Opisz swój czyn/);
        const r = await M.rozstrzygnijKwestie({ sytuacja: 'Oszołomiony Zgrzytowiec leży na plaży.', czyn: 'Siadam obok i pytam, co go boli', gracz: { imie: 'Arek' } });
        assert.deepEqual([r.ton, r.p, r.silnik, r.narracja], ['empatyczny', 0.81, 'jev', 'Zgrzytowiec milknie i odchodzi w mgłę.'], 'ton z Jev wygrywa z modelem');
        assert.deepEqual(Object.keys(jevAtrapa.ostatnie.questions.ton.criteria), ['autentyczny', 'empatyczny', 'holistyczny', 'sztuczny', 'brutalny']);
        assert.match(prompt, /TON CZYNU \(już orzeczony\): empatyczny/);
        assert.match(system, /Skracaj do jednego zdania/);
        const bezJev = utworzMistrzaGry({ katalog: kat, teraz, pisz: async () => 'Myślę… {"ton":"sztuczny","narracja":"Uśmiech jak maska."}' });
        const r2 = await bezJev.rozstrzygnijKwestie({ czyn: 'Udaję, że pomagam, żeby dostał nagrodę' });
        assert.deepEqual([r2.ton, r2.silnik], ['sztuczny', 'model']);
        const zly = utworzMistrzaGry({ katalog: kat, teraz, pisz: async () => '{"ton":"bohaterski"}' });
        await assert.rejects(zly.rozstrzygnijKwestie({ czyn: 'Ratuję kota' }), /ton spoza listy: bohaterski/);
        await assert.rejects(utworzMistrzaGry({ katalog: kat, teraz }).rozstrzygnijKwestie({ czyn: 'Ratuję kota' }), /brak Jev i modelu/);
        const k = await M.kronika();
        assert.deepEqual(k.map((x) => x.ton), ['sztuczny', 'empatyczny']);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('event dnia: z faktu Katedry przez model, raz na dzień, ogłoszony kanałem Mistrza; bez modelu — los', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'mg-e-'));
    try {
        const wiesci = [];
        let wolan = 0;
        const M = utworzMistrzaGry({ katalog: kat, teraz, wiesc: async (w) => wiesci.push(w),
            zdarzenia: async (d) => (d === '2026-10-09' ? [{ agent: 'JaJo Mistrza', rodzaj: 'wiesc', tresc: '⚖️ Kodeks przegrał 3 rundy i wygrał w 4.' }] : []),
            pisz: async (o) => { wolan++; assert.match(o.prompt, /Kodeks przegrał 3 rundy/); return '{"typ":"turniej","parametr":"takt","fakt":"Kodeks przegrał 3 rundy","zapowiedz":"Kto upadł trzy razy, wstaje w rytmie."}'; } });
        const [a, b] = await Promise.all([M.eventDnia(), M.eventDnia()]);
        assert.equal(wolan, 1, 'jeden event na dzień, nawet przy dwóch pytaniach naraz');
        assert.deepEqual([a.typ, a.parametr, a.silnik, a.dzien], ['turniej', 'takt', 'model', '2026-10-09']);
        assert.deepEqual(b, a);
        assert.equal(wiesci.length, 1);
        assert.match(wiesci[0].tresc, /W Teterhii dziś: Turniej: Takt — 3 starcia.*Kto upadł trzy razy/);
        assert.equal((await M.eventDnia()).ogloszono, a.ogloszono, 'drugi raz z dysku');
        // turniej
        await assert.rejects(M.wynikTurnieju({ dziedzina: 'urok', wygrane: 3, starc: 3 }), /w dziedzinie Takt/);
        await assert.rejects(M.wynikTurnieju({ dziedzina: 'takt', wygrane: 9, starc: 3 }), /się nie zgadza/);
        const w = await M.wynikTurnieju({ dziedzina: 'takt', wygrane: 3, starc: 3, gracz: { imie: 'Arek' }, mini: ['Iskra'] });
        assert.equal(w.nagrodaMGRV, 100);
        assert.match(wiesci.at(-1).tresc, /Arek wygrał Turniej Taktu w Teterhii — 3\/3 \(armia: Iskra\)/);
        // model oddał event spoza katalogu → los, z powodem
        const kat2 = await fs.mkdtemp(path.join(os.tmpdir(), 'mg-e2-'));
        const M2 = utworzMistrzaGry({ katalog: kat2, teraz, zdarzenia: async () => [{ agent: 'Kodeks', rodzaj: 'praca', tresc: 'x' }], pisz: async () => '{"typ":"deszcz-zlota"}' });
        const e2 = await M2.eventDnia();
        assert.deepEqual([e2.silnik, e2.typ], ['los', eventZLosu('2026-10-09').typ]);
        assert.match(e2.blad, /Nie ma takiego eventu/);
        if (e2.typ !== 'turniej') await assert.rejects(M2.wynikTurnieju({ dziedzina: 'takt', wygrane: 1, starc: 3 }), /nie ma turnieju/);
        await fs.rm(kat2, { recursive: true, force: true });
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
