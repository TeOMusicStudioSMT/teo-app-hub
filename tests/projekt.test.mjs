/** Projekt Stada, Modele Agentów, Delegat dla każdego gatunku, dzień szyny, wkłady jako klocki. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ProjektStada from '../services/ProjektStada.js';
import * as ModeleAgentow from '../services/ModeleAgentow.js';
import { zbierzKlocki } from '../services/KlockiStada.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'stado-'));
const czekaj = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const w = await fn(); if (w) return w; await new Promise((r) => setTimeout(r, 20)); } throw new Error('timeout'); };

test('plan: fundament → dziedziny → całość → scalenie przez Reżysera', () => {
    const kroki = ProjektStada.zaplanuj([{ id: 'kupiec', imie: 'Kupiec' }, { id: 'joanna', imie: 'Joanna' }, { id: 'rezyser', imie: 'Reżyser' }, { id: 'ogrodnik', imie: 'Ogrodnik', dziedzina: 'Agro' }]);
    assert.deepEqual(kroki.map((k) => `${k.agent}:${k.fala}`), ['rezyser:1', 'joanna:2', 'ogrodnik:2', 'kupiec:3', 'rezyser:4']);
    assert.ok(kroki.at(-1).synteza);
    assert.match(kroki[2].zadanie, /Agro/);   // gatunek spoza tabeli dostaje zadanie ze swojej dziedziny
});

test('projekt: każdy na swoim modelu, widzi wkłady poprzedników, błąd jednego nie wywraca reszty', async () => {
    const katalog = tmp(), zdarzenia = [], wywolania = [];
    ProjektStada.skonfiguruj({
        katalog, domyslnyModel: 'gemma4:e2b',
        szyna: { nadaj: async (z) => { zdarzenia.push(z); } },
        modelDla: async (id) => ({ joanna: 'qwen3.5:9b' }[id] ?? null),
        karta: async (id) => ({ tresc: `KARTA ${id}` }),
        chat: async (model, [sys, user]) => {
            wywolania.push({ model, sys: sys.content, user: user.content });
            if (sys.content.includes('KARTA kupiec')) throw new Error('Ollama milczy');
            return `wkład (${model})`;
        },
    });
    const s = await ProjektStada.zaloz({ nazwa: 'Uniwersum Teterhia', wizja: 'Świat klocków z muzyką, grą i modą.', uczestnicy: [{ id: 'rezyser', imie: 'Reżyser' }, { id: 'joanna', imie: 'Joanna' }, { id: 'kupiec', imie: 'Kupiec' }] });
    assert.equal(s.razem, 4);
    await assert.rejects(ProjektStada.zaloz({ nazwa: 'Drugi', wizja: 'jeszcze jeden projekt', uczestnicy: [{ id: 'a1', imie: 'A' }, { id: 'b1', imie: 'B' }] }), /jeden projekt naraz/);
    const p = await czekaj(async () => { const x = await ProjektStada.projekt(s.id); return x?.stan !== 'trwa' && x; });
    assert.equal(p.stan, 'czesciowo');
    assert.deepEqual(p.kroki.map((k) => `${k.agent}:${k.stan}:${k.model}`), ['rezyser:gotowe:gemma4:e2b', 'joanna:gotowe:qwen3.5:9b', 'kupiec:blad:gemma4:e2b', 'rezyser:gotowe:gemma4:e2b']);
    assert.match(wywolania[1].user, /Reżyser: wkład/);            // Joanna widzi fundament Reżysera
    assert.match(wywolania[3].sys, /SCALACZEM/);                    // ostatni krok scala
    assert.ok(zdarzenia.some((z) => z.agent === 'Joanna' && /pracuje nad „Uniwersum Teterhia"/.test(z.tresc)));
    assert.ok(zdarzenia.some((z) => z.agent === 'Kupiec' && /nie dał rady/.test(z.tresc)));
    const { agenci } = await zbierzKlocki({ projektyStada: () => ProjektStada.lista() });
    assert.deepEqual(agenci.joanna.klocki.map((k) => k.rodzaj), ['wklad']);
    assert.equal(agenci.rezyser.klocki.length, 2);                  // wkład + Biblia projektu
    assert.equal(agenci.kupiec, undefined);                         // nieudany wkład nie jest klockiem
});

test('walidacja: bez nazwy, bez wizji, jeden uczestnik → błąd', async () => {
    await assert.rejects(ProjektStada.zaloz({ nazwa: '', wizja: 'x'.repeat(20), uczestnicy: [] }), /nazwę/);
    await assert.rejects(ProjektStada.zaloz({ nazwa: 'A', wizja: 'krótko', uczestnicy: [] }), /wizję/);
    await assert.rejects(ProjektStada.zaloz({ nazwa: 'A', wizja: 'wystarczająco długa wizja', uczestnicy: [{ id: 'joanna', imie: 'J' }] }), /dwóch/);
});

test('obiekty 3D z wkładu Palety', () => {
    assert.deepEqual(ProjektStada.obiekty3d('Paleta: ...\nOBIEKT: tron z kości słoniowej\n- Obiekt: latarnia morska\nzwykła linia'), ['tron z kości słoniowej', 'latarnia morska']);
});

test('modele agentów: ustaw, odczytaj, wyczyść, odrzuć śmieci', async () => {
    ModeleAgentow.skonfiguruj({ katalogWymiar: tmp() });
    assert.equal(await ModeleAgentow.modelDla('joanna', 'gemma4:e2b'), 'gemma4:e2b');
    await ModeleAgentow.ustaw('joanna', 'qwen3.5:9b');
    assert.equal(await ModeleAgentow.modelDla('joanna'), 'qwen3.5:9b');
    await ModeleAgentow.ustaw('joanna', '');
    assert.equal(await ModeleAgentow.modelDla('joanna', 'd'), 'd');
    await assert.rejects(ModeleAgentow.ustaw('joanna', 'x; rm -rf /'), /Zła nazwa/);
    await assert.rejects(ModeleAgentow.ustaw('../etc', 'gemma4'), /identyfikator/);
});

test('Delegat: pełny profil dla trzech, rozmowny z karty roli dla reszty', async () => {
    const Delegat = await import('../services/Delegat.js');
    assert.ok((await Delegat.profilDla('joanna')).narzedzia.includes('music.generate'));
    const paleta = await Delegat.profilDla('paleta');
    assert.equal(paleta.imie, 'Paleta');
    assert.deepEqual(paleta.narzedzia, ['katedra.stan', 'projekty.stan', 'system.pamiec', 'szyna.pytanie', 'szyna.notatka'], 'rozmowny: fakty i odczyt pamięci, bez skutków ubocznych');
    assert.equal(await Delegat.profilDla('nie-ma-takiego'), null);
});

test('ocena Sędziego: liczba i braki z odpowiedzi modelu (też z gwiazdkami i numeracją)', () => {
    assert.deepEqual(ProjektStada.czytajOcene('**ZGODNOŚĆ:** 6/10\nBRAKI:\n1. brak pętli „stwórz i udowodnij"\n- **AR** nieopisane\n'), { ocena: 6, braki: ['brak pętli „stwórz i udowodnij"', 'AR nieopisane'] });
    assert.deepEqual(ProjektStada.czytajOcene('Zgodnosc: 9\nBRAKI: brak'), { ocena: 9, braki: [] });
    assert.deepEqual(ProjektStada.czytajOcene('Świetny projekt, gratuluję!'), { ocena: null, braki: [] });
});

/** Model na niby: pamięta wywołania, Sędzia daje oceny z listy. */
function stadoNaNiby(oceny) {
    const wywolania = [], zdarzenia = [];
    let i = 0;
    ProjektStada.skonfiguruj({
        katalog: tmp(), domyslnyModel: 'gemma4:e2b', nagroda: null,
        szyna: { nadaj: async (z) => { zdarzenia.push(z); } },
        modelDla: async () => null,
        karta: async (id) => ({ tresc: `KARTA ${id}` }),
        chat: async (model, [sys, user]) => {
            wywolania.push({ sys: sys.content, user: user.content });
            if (sys.content.includes('SĘDZIĄ')) return `ZGODNOŚĆ: ${oceny[i++] ?? 5}/10\nBRAKI:\n- dołóż mechanikę Grade\n- opisz kolekcję seed`;
            if (user.content.includes('PĘTLA KREATYWNA')) return `${user.content.match(/TWÓJ SZKIC:\n([^\n]*)/)[1]} +szlif`;
            const r = user.content.match(/RUNDA (\d+)/)?.[1] ?? '1';
            return `wkład r${r}`;
        },
    });
    return { wywolania, zdarzenia };
}
const zespol = [{ id: 'rezyser', imie: 'Reżyser' }, { id: 'kodeks', imie: 'Kodeks' }, { id: 'wektor', imie: 'Wektor' }];
const skonczony = (id) => czekaj(async () => { const x = await ProjektStada.projekt(id); return x?.stan !== 'trwa' && x; });

test('rundy: stado doskonali swoje wkłady na brakach Sędziego i kończy wcześniej, gdy wizja spełniona', async () => {
    const { wywolania, zdarzenia } = stadoNaNiby([6, 9]);
    const s = await ProjektStada.zaloz({ nazwa: 'Forge Fashion', wizja: 'Gra RPG-fashion z Marketplace GRV.', uczestnicy: zespol, rundy: 4 });
    assert.equal(s.rundy, 4);
    const p = await skonczony(s.id);
    assert.equal(p.stan, 'gotowe');
    assert.equal(p.runda, 2, 'po ocenie 9/10 w rundzie 2 stado nie robi rund 3 i 4');
    assert.deepEqual(p.oceny.map((o) => [o.runda, o.ocena, o.kto]), [[1, 6, 'Wektor'], [2, 9, 'Wektor']]);
    assert.deepEqual(p.kroki.map((k) => k.wklad), ['wkład r2', 'wkład r2', 'wkład r2', 'wkład r2']);
    const kodeksR2 = wywolania.find((w) => w.sys.includes('KARTA kodeks') && w.user.includes('RUNDA 2'));
    assert.match(kodeksR2.user, /TWÓJ WKŁAD Z POPRZEDNIEJ RUNDY:\nwkład r1/);          // buduje na swojej poprzedniej pracy
    assert.match(kodeksR2.user, /zgodność z wizją 6\/10[^]*- dołóż mechanikę Grade/);   // i na brakach Sędziego
    assert.match(kodeksR2.user, /BIBLIA Z RUNDY 1:\nwkład r1/);
    const koniec = zdarzenia.find((z) => z.dane?.koniec);
    assert.match(koniec.tresc, /skończony po 2 z 4 rund, zgodność z wizją 9\/10 — wizja spełniona przed czasem/);
    assert.equal(koniec.dane.glos, 'Stado skończyło projekt Forge Fashion po 2 rundach, zgodność z wizją 9 na 10.');
    assert.equal(ProjektStada.skrot(p).oceny.length, 2);
});

test('pętla kreatywna: każdy punkt planu szlifowany N razy, zanim pójdzie dalej', async () => {
    const { wywolania } = stadoNaNiby([]);
    const s = await ProjektStada.zaloz({ nazwa: 'Szlif', wizja: 'Mały projekt z pętlą kreatywną.', uczestnicy: zespol.slice(0, 2), petla: 2 });
    const p = await skonczony(s.id);
    assert.deepEqual(p.kroki.map((k) => [k.wklad, k.petle]), [['wkład r1 +szlif +szlif', 2], ['wkład r1 +szlif +szlif', 2], ['wkład r1 +szlif +szlif', 2]]);
    assert.equal(wywolania.length, 9);                                                   // 3 kroki × (szkic + 2 pętle), bez Sędziego (1 runda)
    assert.match(wywolania.find((w) => w.sys.includes('KARTA kodeks') && !w.user.includes('PĘTLA')).user, /Reżyser: wkład r1 \+szlif \+szlif/);   // następny widzi wersję po szlifie
    assert.equal(ProjektStada.skrot(p).kroki[0].petle, 2);
});

test('kontynuuj: skończony projekt dostaje kolejne rundy (Nocna Zmiana, Stół), sondaż mówi prawdę', async () => {
    stadoNaNiby([4, 5, 7]);
    const s = await ProjektStada.zaloz({ nazwa: 'Warsztat', wizja: 'Projekt do dalszego doskonalenia.', uczestnicy: zespol });
    let p = await skonczony(s.id);
    assert.equal(p.runda, 1); assert.deepEqual(p.oceny, []);                            // jedna runda: bez Sędziego
    assert.equal((await ProjektStada.sondaz(s.id)).stan, 'gotowe');
    const k = await ProjektStada.kontynuuj(s.id, { rundy: 2, petla: 1 });
    assert.deepEqual([k.runda, k.rundy, k.petla], [1, 3, 1]);                          // najpierw Sędzia ocenia rundę 1, potem runda 2
    assert.equal((await ProjektStada.sondaz(s.id)).stan, 'trwa');
    await assert.rejects(ProjektStada.kontynuuj(s.id), /właśnie pracuje/);
    p = await skonczony(s.id);
    assert.deepEqual(p.oceny.map((o) => [o.runda, o.ocena]), [[1, 4], [2, 5], [3, 7]]);   // ocena rundy 1 dopisana przed doskonaleniem
    assert.equal(p.runda, 3);
    assert.match((await ProjektStada.sondaz(s.id)).podsumowanie, /runda 3\/3, 4\/4 wkładów, zgodność 7\/10/);
    await assert.rejects(ProjektStada.kontynuuj('nie-ma-go'), /Nie ma takiego/);
});

test('uwagi Suwerena (np. rozmowa Podcast Twin) trafiają do rund i do Sędziego', async () => {
    const { wywolania, zdarzenia } = stadoNaNiby([5, 7]);
    const s = await ProjektStada.zaloz({ nazwa: 'Z uwagami', wizja: 'Projekt, który wróci do rozmowy.', uczestnicy: zespol.slice(0, 2) });
    await skonczony(s.id);
    await ProjektStada.kontynuuj(s.id, { rundy: 1, uwagi: '🔥 ISKRA: brakuje pętli „stwórz i udowodnij"', zrodloUwag: 'rozmowa Podcast Twin' });
    const p = await skonczony(s.id);
    assert.deepEqual(p.uwagi.map((u) => [u.odRundy, u.zrodlo]), [[2, 'rozmowa Podcast Twin']]);
    const r2 = wywolania.filter((w) => w.user.includes('RUNDA 2') && !w.sys.includes('SĘDZIĄ'));
    assert.ok(r2.length >= 3 && r2.every((w) => /UWAGI SUWERENA \(rozmowa Podcast Twin\)[^]*brakuje pętli/.test(w.user)));
    assert.match(wywolania.filter((w) => w.sys.includes('SĘDZIĄ')).at(-1).user, /UWAGI SUWERENA do tej pracy[^]*brakuje pętli/);
    assert.ok(zdarzenia.some((z) => /wraca na warsztat: 1 runda doskonalenia — z uwagami \(rozmowa Podcast Twin\)/.test(z.tresc)));
});

test('dyrygent: projekt dostaje modele dobrane do zadania (tylko dla siebie); porażka Dyrygenta nie zatrzymuje stada', async () => {
    const { wywolania, zdarzenia } = stadoNaNiby([]);
    const modele = [];
    ProjektStada.skonfiguruj({
        chat: async (model, [sys]) => { modele.push([sys.content.match(/KARTA (\w+)/)?.[1], model]); return 'wkład'; },
        dyrygent: async ({ zadanie, agenci }) => {
            assert.match(zadanie, /^Orkiestra: /);
            assert.deepEqual(agenci.map((a) => a.id), ['rezyser', 'kodeks']);
            return { model: 'gemma4', przydzial: [{ agent: 'kodeks', model: 'qwen3.5:9b', powod: 'kod' }], odrzucone: [] };
        },
    });
    const s = await ProjektStada.zaloz({ nazwa: 'Orkiestra', wizja: 'Projekt z dyrygentem przy pulpicie.', uczestnicy: zespol.slice(0, 2), dyrygent: true });
    const p = await skonczony(s.id);
    assert.deepEqual(modele, [['rezyser', 'gemma4:e2b'], ['kodeks', 'qwen3.5:9b'], ['rezyser', 'gemma4:e2b']]);
    assert.deepEqual(p.przydzial.przydzial, [{ agent: 'kodeks', model: 'qwen3.5:9b', powod: 'kod' }]);
    assert.ok(zdarzenia.some((z) => z.agent === 'Dyrygent' && /kodeks → qwen3.5:9b/.test(z.tresc)));
    void wywolania;

    ProjektStada.skonfiguruj({ dyrygent: async () => { throw new Error('Dyrygent nie oddał JSON-a'); } });
    const s2 = await ProjektStada.zaloz({ nazwa: 'Bez batuty', wizja: 'Dyrygent zawiedzie, stado gra dalej.', uczestnicy: zespol.slice(0, 2), dyrygent: true });
    const p2 = await skonczony(s2.id);
    assert.equal(p2.stan, 'gotowe');
    assert.match(p2.przydzial.blad, /nie oddał JSON-a/);
    ProjektStada.skonfiguruj({ dyrygent: null });
});
