// 🛠️ Warsztat Stada — bliźniak przepisu (most ↔ PRAWDZIWY kod gry), propozycja z atrapą modelu, Izba, ✓ raz, wersje, cofanie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { utworzWarsztat, oczyscPrzepis } from '../services/WarsztatStada.js';

const GRA = path.resolve(process.cwd(), '..', '_OtakOs_Apki', 'teterhia-wieczna-saga');
const ZAKRESY = path.join(GRA, 'src', 'gra', 'zakresyStylu.json');
const jestGra = fsSync.existsSync(ZAKRESY);

test('bliźniak: oczyscPrzepis mostu = oczyscPrzepis gry (ten sam zakresyStylu.json) na trudnych wejściach', { skip: !jestGra && 'brak gry Teterhia obok Katedry' }, async () => {
    const gra = await import(pathToFileURL(path.join(GRA, 'src', 'gra', 'stylSwiata.ts')).href);   // Node 25: TypeScript bez typów
    const zak = JSON.parse(await fs.readFile(ZAKRESY, 'utf8'));
    const wejscia = [
        null, {}, { warstwy: { woda: { barwa: [300, 0.5, 0.3], polysk: 2, zle: 1, autor: 'paleta', wersja: 3 } } },
        { warstwy: { woda: { barwa: [180, 'x', 0.3], przezroczystosc: 0.1 } } }, { warstwy: { woda: { barwa: [180, 0.5] } } },
        { warstwy: { woda: { przezroczystosc: Number.NaN, polysk: 0.33333 } } }, { warstwy: { niebo: { barwa: [1, 1, 1] } } },
        { warstwy: { woda: { autor: 'Zły Autor', wersja: -1, barwa: [200, 0.7, 0.4] } } },
    ];
    for (const w of wejscia) assert.deepEqual(oczyscPrzepis(w, zak), gra.oczyscPrzepis(w), JSON.stringify(w));
    // domyślna woda z przepisu = dokładnie dawna stała z kodu (195°, 0.8×nasycenie, 0.36, opacity 0.82, roughness ≈ 0.3)
    const wo = gra.wygladWody(null, 100);
    assert.equal(Math.round(wo.h * 360), 195);
    assert.deepEqual([wo.s, wo.l, wo.opacity], [0.8, 0.36, 0.82]);
    assert.ok(Math.abs(wo.roughness - 0.3) < 0.005);
    assert.equal(gra.wygladWody({ wersja_schematu: 1, warstwy: { woda: { barwa: [200, 0.5, 0.3] } } }, 50).s, 0.25, 'blednięcie dalej mnoży nasycenie');
});

function warsztat(tmp, o = {}) {
    const zdarzenia = { nagrody: [], decyzje: [], wiesci: [], prompty: [], zrzuty: [] };
    const odpowiedzi = [...(o.odpowiedzi ?? ['{"zmiany":{"barwa":[170,0.9,0.42],"polysk":0.95,"chmury":1},"uzasadnienie":"Turkus jak laguna."}'])];
    const W = utworzWarsztat({ katalog: path.join(tmp, 'w'), gra: 'gra', plikZakresow: ZAKRESY,
        pisz: async ({ system, prompt }) => { zdarzenia.prompty.push({ system, prompt }); return odpowiedzi.shift() ?? 'nic'; },
        model: () => 'atrapa', karta: async () => 'Jesteś Paleta.', czyWyklute: async () => o.wyklute !== false,
        zrzut: async ({ zapytanie, plik }) => { zdarzenia.zrzuty.push(decodeURIComponent(zapytanie)); await fs.mkdir(path.dirname(plik), { recursive: true }); await fs.writeFile(plik, 'png'); return plik; },
        nagroda: async (x) => zdarzenia.nagrody.push(x), jajo: { decyzja: async (x) => zdarzenia.decyzje.push(x), wiesc: async (x) => zdarzenia.wiesci.push(x) },
        teraz: o.teraz });
    return { W, zdarzenia };
}

test('propozycja → Izba → ✓: przepis z wersją, XP raz, JaJo, wieść; drugie ✓ nic nie robi; cofnij wraca', { skip: !jestGra && 'brak gry' }, async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'warsztat-'));
    try {
        const { W, zdarzenia } = warsztat(tmp, { odpowiedzi: ['to nie json', '{"zmiany":{"barwa":[170,0.9,0.42],"polysk":0.95,"chmury":1},"uzasadnienie":"Turkus jak laguna."}'] });
        const p = await W.zaproponuj({ dziedzina: 'woda' });
        assert.equal(p.stan, 'do_zgody');
        assert.equal(zdarzenia.prompty.length, 2, 'zła odpowiedź = jedna poprawka');
        assert.match(zdarzenia.prompty[1].prompt, /POPRZEDNIA ODPOWIEDŹ BYŁA ZŁA/);
        assert.deepEqual(p.odrzucone, ['woda.chmury']);
        assert.equal(zdarzenia.zrzuty.length, 2);
        assert.match(zdarzenia.zrzuty[1], /"barwa":\[170,0\.9,0\.42\]/);
        await assert.rejects(W.zaproponuj({ dziedzina: 'woda' }), /już propozycję/);
        const izba = await W.zrodloIzby.czekajace();
        assert.equal(izba.length, 1);
        assert.equal(izba[0].obrazy.length, 2);
        assert.ok(izba[0].akcje.every((a) => a.zdalnie));
        const r = await W.zrodloIzby.decyduj(p.id, 'przyjmij', {});
        assert.deepEqual(r, { stan: 'przyjeta', wersja: 1 });
        const przepis = await W.przepis();
        assert.deepEqual(przepis.warstwy.woda, { barwa: [170, 0.9, 0.42], polysk: 0.95, autor: 'paleta', wersja: 1 });
        assert.equal(zdarzenia.nagrody.length, 1);
        assert.equal(zdarzenia.nagrody[0].klucz, `warsztat:${p.id}`);
        assert.equal(zdarzenia.decyzje[0].zrodlo, 'warsztat');
        assert.equal(zdarzenia.wiesci.length, 1);
        assert.deepEqual(await W.zrodloIzby.decyduj(p.id, 'przyjmij', {}), { stan: 'przyjeta', juz: true });
        assert.equal(zdarzenia.nagrody.length, 1, 'drugie ✓ bez drugiego XP');
        assert.deepEqual((await W.cofnij()).warstwy, {});
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('✕ z powodem, nieaktualna wersja = odmowa, niewykluty autor = odmowa, wygasanie po 7 dniach, nocny raz', { skip: !jestGra && 'brak gry' }, async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'warsztat-'));
    let zegar = Date.parse('2026-11-02T03:30:00');
    try {
        const { W, zdarzenia } = warsztat(tmp, { teraz: () => zegar, odpowiedzi: Array(6).fill('{"zmiany":{"przezroczystosc":0.7},"uzasadnienie":"Głębiej."}') });
        const a = await W.zaproponuj();
        await W.zrodloIzby.decyduj(a.id, 'odrzuc', { powod: 'za blado' });
        assert.equal(zdarzenia.decyzje[0].werdykt, 'odrzuc');
        assert.equal(zdarzenia.decyzje[0].uwagi, 'za blado');
        assert.equal((await W.propozycje()).find((x) => x.id === a.id).decyzja.powod, 'za blado');
        // dwie propozycje na tej samej wersji: druga po przyjęciu pierwszej jest nieaktualna
        const b = await W.zaproponuj();
        const plikC = path.join(tmp, 'w', 'propozycje', 'w-cccccccc.json');
        await fs.writeFile(plikC, JSON.stringify({ ...(await W.propozycje()).find((x) => x.id === b.id), id: 'w-cccccccc' }));
        await W.zrodloIzby.decyduj(b.id, 'przyjmij', {});
        await assert.rejects(W.zrodloIzby.decyduj('w-cccccccc', 'przyjmij', {}), /nieaktualna/);
        // wygasanie: propozycja starsza niż 7 dni znika z Izby
        const d = await W.zaproponuj();
        zegar += 8 * 864e5;
        assert.equal((await W.zrodloIzby.czekajace()).some((x) => x.id === d.id), false);
        // nocny przebieg raz na dzień
        zegar = Date.parse('2026-11-20T03:20:00');
        const n1 = await W.nocnyPrzebieg();
        assert.ok(n1?.id || n1?.blad);
        assert.equal(await W.nocnyPrzebieg(), null);
    } finally { await fs.rm(tmp, { recursive: true, force: true }); }
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'warsztat-'));
    try { await assert.rejects(warsztat(tmp2, { wyklute: false }).W.zaproponuj(), /nie jest jeszcze wykluty/); }
    finally { await fs.rm(tmp2, { recursive: true, force: true }); }
});
