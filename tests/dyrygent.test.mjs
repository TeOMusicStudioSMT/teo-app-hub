/** Dyrygent (dobór modeli do zadań) i Kuźnia Soup (własny model TeOgochi z jego pracy). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as Dyrygent from '../services/Dyrygent.js';
import * as KuzniaSoup from '../services/KuzniaSoup.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dyrygent-'));
const TAGI = { models: [
    { name: 'gemma4:e2b', size: 2.1e9, details: { family: 'gemma', parameter_size: '2B', quantization_level: 'Q4_K_M' } },
    { name: 'qwen3.5:9b', size: 6.6e9, details: { family: 'qwen', parameter_size: '9B', quantization_level: 'Q4_K_M' } },
    { name: 'teogochi-kodeks:latest', size: 4.1e9, details: { family: 'qwen', parameter_size: '7B' } },
] };
/** Projekt z pracą: Kodeks pisał na qwen, Joanna na gemmie; Sędzia 8/10, a runda 1 miała 6/10. */
const PROJEKTY = [{
    id: 'forge', nazwa: 'Forge Fashion', wizja: 'Gra RPG-fashion z Marketplace GRV.', runda: 2, rundy: 2,
    oceny: [{ runda: 1, ocena: 6 }, { runda: 2, ocena: 8 }],
    kroki: [
        { agent: 'kodeks', imie: 'Kodeks', zadanie: 'Gra: pętla', stan: 'gotowe', model: 'qwen3.5:9b', runda: 2, wklad: 'Pętla v2', wersje: [{ runda: 1, wklad: 'Pętla v1' }], szkice: [{ runda: 2, przed: 'szkic', po: 'Pętla v2' }] },
        { agent: 'joanna', imie: 'Joanna', zadanie: 'Muzyka', stan: 'gotowe', model: 'gemma4:e2b', runda: 2, wklad: 'Motyw' },
        { agent: 'kupiec', imie: 'Kupiec', zadanie: 'Merch', stan: 'blad', model: 'gemma4:e2b', wklad: null },
    ],
}, { id: 'stary', nazwa: 'Bez ocen', wizja: 'W', kroki: [{ agent: 'kodeks', imie: 'Kodeks', zadanie: 'Gra', stan: 'gotowe', model: 'qwen3.5:9b', wklad: 'bez oceny' }] }];

test('katalog: modele Ollamy + karta Suwerena + własny model z Kuźni + praca w stadzie (średnia ocena)', async () => {
    const katalogWymiar = tmp();
    Dyrygent.skonfiguruj({
        katalogWymiar, tagi: async () => TAGI, projekty: async () => PROJEKTY,
        modeleAgentow: async () => ({ joanna: 'gemma4:e2b' }), wykute: async () => [{ agent: 'kodeks', model: 'teogochi-kodeks' }],
    });
    await Dyrygent.ustawKarte('qwen3.5:9b', { opis: 'Rozumowanie i kod', mocne: 'kod, scalanie' });
    await assert.rejects(Dyrygent.ustawKarte('x; rm -rf', { opis: 'x' }), /Zła nazwa/);
    const k = await Dyrygent.katalog();
    assert.deepEqual(k.map((m) => m.nazwa), ['gemma4:e2b', 'qwen3.5:9b', 'teogochi-kodeks:latest']);   // lepiej oceniane pierwsze, przy remisie mniejszy
    assert.deepEqual(k[1].karta, { opis: 'Rozumowanie i kod', mocne: ['kod', 'scalanie'] });
    assert.deepEqual(k[1].praca, { wkladow: 2, ocen: 1, srednia: 8 });                                  // projekt bez oceny liczy się do wkładów, nie do średniej
    assert.deepEqual(k[0].agenci, ['joanna']);
    assert.deepEqual(k[2].praca, { wkladow: 0, ocen: 0, srednia: null });                             // jeszcze nie pracował — ostatni
    assert.equal(k[2].wlasny, 'kodeks');
    assert.equal(k[2].rozmiarGB, 4.1);
});

test('dobierz: tylko modele z katalogu i agenci z zadania — zmyślenia odrzucone z powodem', async () => {
    let zapytanie;
    Dyrygent.skonfiguruj({
        katalogWymiar: tmp(), tagi: async () => TAGI, projekty: async () => [], modeleAgentow: async () => ({}), wykute: async () => [{ agent: 'kodeks', model: 'teogochi-kodeks' }],
        model: () => 'gemma4:e2b',
        pisz: async (o) => { zapytanie = o; return 'Proponuję tak:\n{"przydzial":[{"agent":"kodeks","model":"teogochi-kodeks","powod":"własny model"},{"agent":"joanna","model":"gpt-9","powod":"x"},{"agent":"szpieg","model":"gemma4:e2b"},{"agent":"joanna","model":"gemma4:e2b","powod":"krótki wkład"}]}\nPowodzenia!'; },
    });
    await assert.rejects(Dyrygent.dobierz({ zadanie: 'gra', agenci: [{ id: 'kodeks' }] }), /Opisz zadanie/);
    const w = await Dyrygent.dobierz({ zadanie: 'Forge Fashion: gra RPG-fashion', agenci: [{ id: 'kodeks', imie: 'Kodeks', zadanie: 'Gra: pętla' }, { id: 'joanna', imie: 'Joanna' }] });
    assert.deepEqual(w.przydzial, [{ agent: 'kodeks', model: 'teogochi-kodeks:latest', powod: 'własny model' }, { agent: 'joanna', model: 'gemma4:e2b', powod: 'krótki wkład' }]);
    assert.deepEqual(w.odrzucone.map((o) => o.powod), ['nie ma takiego modelu w Katedrze', 'nie ma takiego TeOgochi w zadaniu']);
    assert.match(zapytanie.prompt, /teogochi-kodeks:latest \(7B, 4\.1 GB\) — WŁASNY model TeOgochi „kodeks"/);
    assert.match(zapytanie.prompt, /- kodeks — Kodeks: Gra/);
    assert.match(zapytanie.system, /WYŁĄCZNIE modele z KATALOGU/);
});

test('Kuźnia Soup: SFT tylko z dobrze ocenionej pracy, pary z pętli i z rund, w których ocena wzrosła', () => {
    const { sft, pary, pominiete } = KuzniaSoup.zbierz(PROJEKTY, { agent: 'kodeks', kartaRoli: 'KARTA Kodeksa', prog: 7 });
    assert.equal(sft.length, 1);
    assert.deepEqual(sft[0].messages.map((m) => m.role), ['system', 'user', 'assistant']);
    assert.match(sft[0].messages[0].content, /^KARTA Kodeksa/);
    assert.match(sft[0].messages[1].content, /PROJEKT: Forge Fashion\nWIZJA SUWERENA:\nGra RPG-fashion[^]*TWOJE ZADANIE \(Kodeks\):\nGra: pętla/);
    assert.equal(sft[0].messages[2].content, 'Pętla v2');
    assert.deepEqual(pary.map((p) => [p.chosen, p.rejected]), [['Pętla v2', 'szkic'], ['Pętla v2', 'Pętla v1']]);
    assert.deepEqual(pominiete, { bezOceny: 1, slabe: 0 });
    assert.equal(KuzniaSoup.zbierz(PROJEKTY, { agent: 'kodeks', prog: 9 }).sft.length, 0, 'próg 9 — 8/10 za mało');
});

test('Kuźnia Soup: odmawia bez bazy i przy za małej liczbie próbek; przy dość — pliki + soup.yaml; wykucie woła Soup po kolei', async () => {
    const katalog = tmp();
    const duzo = Array.from({ length: 9 }, (_, i) => ({ ...PROJEKTY[0], id: `p${i}`, nazwa: `P${i}` }));
    const wolania = [];
    KuzniaSoup.skonfiguruj({
        katalog, projekty: async () => PROJEKTY, karta: async () => ({ imie: 'Kodeks', tresc: 'KARTA Kodeksa' }), baza: '',
        uruchom: async (pol, argi, { naLinie }) => { wolania.push([pol, ...argi]); naLinie('ok'); return 0; },
    });
    await assert.rejects(KuzniaSoup.przygotuj('kodeks'), /model bazowy/);
    await assert.rejects(KuzniaSoup.przygotuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' }), /Za mało dobrej pracy Kodeks do kucia: 1 wkładów z oceną ≥ 7\/10 \(potrzeba 8\)/);
    KuzniaSoup.skonfiguruj({ projekty: async () => duzo });
    const info = await KuzniaSoup.przygotuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' });
    assert.deepEqual([info.sft, info.pary], [9, 18]);
    const dir = path.join(katalog, 'kodeks');
    assert.equal(fs.readFileSync(path.join(dir, 'sft.jsonl'), 'utf8').trim().split('\n').length, 9);
    const yaml = fs.readFileSync(path.join(dir, 'soup.yaml'), 'utf8');
    assert.match(yaml, /base: "Qwen\/Qwen2.5-3B-Instruct"\ntask: sft\ndata:\n  train: .\/sft.jsonl\n  format: chatml\n  val_split: 0/);

    const z = await KuzniaSoup.wykuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' });
    await assert.rejects(KuzniaSoup.wykuj('kodeks', { baza: 'x/y' }), /już kuje/);
    for (let i = 0; i < 100 && KuzniaSoup.sondaz(z.id).stan === 'trwa'; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(KuzniaSoup.sondaz(z.id).stan, 'gotowe');
    assert.deepEqual(wolania.map((w) => w.slice(0, 3)), [['soup', '--no-telemetry', 'train'], ['soup', '--no-telemetry', 'export'], ['soup', '--no-telemetry', 'deploy']]);
    assert.ok(wolania[2].includes('teogochi-kodeks') && wolania[2].includes('KARTA Kodeksa'));
    assert.deepEqual((await KuzniaSoup.wykute()).map((w) => [w.agent, w.model]), [['kodeks', 'teogochi-kodeks']]);
});

test('Kuźnia Soup: błąd Soup (np. brak karty graficznej) zostaje w zadaniu z etapem, bez udawania modelu', async () => {
    const duzo = Array.from({ length: 8 }, (_, i) => ({ ...PROJEKTY[0], id: `q${i}` }));
    KuzniaSoup.skonfiguruj({ katalog: tmp(), projekty: async () => duzo, uruchom: async (pol, argi) => (argi[1] === 'train' ? 1 : 0) });
    const z = await KuzniaSoup.wykuj('kodeks', { baza: 'Qwen/Qwen2.5-3B-Instruct' });
    for (let i = 0; i < 100 && KuzniaSoup.sondaz(z.id).stan === 'trwa'; i++) await new Promise((r) => setTimeout(r, 10));
    const s = KuzniaSoup.sondaz(z.id);
    assert.equal(s.stan, 'blad');
    assert.match(s.blad, /trening \(LoRA\): Soup zakończył się kodem 1/);
    assert.equal(KuzniaSoup.biezace(), null, 'po błędzie Kuźnia jest wolna');
});
