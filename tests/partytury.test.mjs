// 🎼📜 Partytury, Jev lokalny (embeddingi) i straż modeli — „auto 3” (Suweren 2026-10-08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { utworzJevLokalny, cosinus, softmax } from '../services/JevLokalny.js';
import { utworzPartytury, skilleZKatalogu, zWykonania, WZORCOWE } from '../services/Partytury.js';
import { utworzStrazModeli } from '../services/StrazModeli.js';
import * as Dyrygent from '../services/Dyrygent.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'partytury-'));
/** Atrapa Ollamy /api/embed: wektor = liczności słów-kluczy (gra, film, muzyka, kod, kot). */
const KLUCZE = ['gra', 'film', 'muzyk', 'kod', 'kot', 'three'];
const atrapaEmbed = (wywolania = []) => async (_url, o) => {
    const { input } = JSON.parse(o.body);
    wywolania.push(input.length);
    return { ok: true, json: async () => ({ embeddings: input.map((t) => KLUCZE.map((k) => (String(t).toLowerCase().split(k).length - 1) + 0.01)) }) };
};

test('Jev lokalny: wybór przez cosinus (kontrakt Jev), tak/nie i skala = odmowa wprost; model, który nie wstaje = niedostępny', async () => {
    assert.ok(Math.abs(cosinus([1, 0], [1, 0]) - 1) < 1e-9);
    assert.ok(Math.abs(softmax([0.5, 0.5]).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    const jl = utworzJevLokalny({ fetch: atrapaEmbed() });
    assert.equal(await jl.dostepny(), true);
    const d = await jl.zapytaj({ state: { zadanie: 'gra o kocie w three.js' }, questions: { a: { type: 'choice', instructions: 'Który model?', criteria: { muzyczny: 'muzyka i brzmienie', koderski: 'kod gry three, gra' } } } });
    assert.equal(d.answers.a.choice, 'koderski');
    assert.ok(d.answers.a.probabilities.koderski > 0.9);
    assert.match(d.model, /^lokalny:/);
    await assert.rejects(jl.zapytaj({ questions: { b: { type: 'noul', instructions: 'x', criteria: {} } } }), /umie tylko wybór.*Jev z chmury/);
    const padly = utworzJevLokalny({ fetch: async () => ({ ok: false, status: 500, json: async () => ({ error: "unknown model architecture: 'gemma-embedding2'" }) }) });
    assert.equal(await padly.dostepny(), false);
    assert.match(padly.stan().powod, /gemma-embedding2/);
    assert.equal(padly.stan().maKlucz, false, 'Dyrygent nie bierze go za Jev');
});

test('partytury: wzorcowe z Katedry, ręczna, genialne wykonanie od Sędziego-Jev ≥ 9 (lokalny < 9 albo nie-Jev = nic)', async () => {
    const dir = tmp();
    const szyna = [];
    const P = utworzPartytury({ plik: path.join(dir, 'partytury.json'), szyna: { nadaj: async (z) => szyna.push(z) } });
    assert.equal((await P.wszystkie()).length, WZORCOWE.length);
    await assert.rejects(P.dodaj({ nazwa: 'x' }), /potrzebuje nazwy/);
    const r = await P.dodaj({ nazwa: 'Teledysk Joanny', cel: 'muzyka', role: [{ agent: 'Joanna', model: 'mistral:latest' }], narzedzia: ['ACE-Step 1.5'] });
    assert.equal(r.zrodlo, 'reczna');
    assert.equal(r.role[0].agent, 'joanna');
    const projekt = { id: 'p-kot-123456', nazwa: 'Kot z wyspy', wizja: 'Kot-duszek z okiem', runda: 2, rundy: 3, petla: 1, zlecenia: [{ modul: 'assety3d' }, { modul: 'muzyka' }],
        kroki: [{ agent: 'pionek', model: 'ornith:latest', stan: 'gotowe', zadanie: 'GDD: kot' }, { agent: 'paleta', model: 'mistral:latest', stan: 'gotowe' }, { agent: 'kodeks', model: 'x', stan: 'blad' }] };
    assert.equal(await P.poOcenie(projekt, { kto: 'Wektor', ocena: 9.8 }), null, 'stary lokalny Sędzia się nie liczy');
    assert.equal(await P.poOcenie(projekt, { kto: 'Jev + Wektor', ocena: 8.9 }), null);
    const g = await P.poOcenie(projekt, { kto: 'Jev + Wektor', ocena: 9.2 });
    assert.equal(g.zrodlo, 'wykonanie');
    assert.deepEqual(g.role.map((x) => [x.agent, x.model]), [['pionek', 'ornith:latest'], ['paleta', 'mistral:latest']]);
    assert.deepEqual(g.narzedzia, ['assety3d', 'muzyka']);
    assert.match(szyna[0].tresc, /genialne wykonanie „Kot z wyspy” \(9\.2\/10\)/);
    await P.poOcenie(projekt, { kto: 'Jev + Wektor', ocena: 9.6 });
    assert.equal((await P.wszystkie()).filter((x) => x.projekt === projekt.id).length, 1, 'nowsza ocena nadpisuje, nie dubluje');
    assert.equal(await P.usun(r.id), true);
    assert.equal(zWykonania(projekt, { ocena: 9 }).id.startsWith('wykonanie-kot-z-wyspy-'), true);
});

test('dopasowanie: embeddingi (wektory partytur raz), bez nich — słowa; metoda w wyniku', async () => {
    const wywolania = [];
    const P = utworzPartytury({ plik: path.join(tmp(), 'p.json'), jevLokalny: utworzJevLokalny({ fetch: atrapaEmbed(wywolania) }) });
    const d = await P.dopasuj('gra three.js o kocie z kodem', { n: 2 });
    assert.equal(d.metoda, 'embeddingi');
    assert.equal(d.wyniki[0].partytura.id, 'katedra-gra-threejs');
    const ileNaPoczatku = wywolania.at(-1);
    await P.dopasuj('film o kocie');
    assert.equal(wywolania.at(-1), 1, `drugie dopasowanie osadza tylko zadanie (było ${ileNaPoczatku})`);
    const S = utworzPartytury({ plik: path.join(tmp(), 'p.json') });
    const s = await S.dopasuj('podcast z gośćmi i prowadzącym');
    assert.equal(s.metoda, 'slowa');
    assert.equal(s.wyniki[0].partytura.id, 'katedra-podcast');
});

test('katalogi: skille z TeO_Skille (nazwa + opis z SKILL.md), grafy workflow, cele', async () => {
    const k = tmp();
    fs.mkdirSync(path.join(k, 'unity', 'unity-animation'), { recursive: true });
    fs.writeFileSync(path.join(k, 'unity', 'unity-animation', 'SKILL.md'), '---\nname: unity-animation\ndescription: >\n  Drive Unity 6 character animation\n  with Animator.\nlicense: Apache-2.0\n---\n');
    fs.mkdirSync(path.join(k, 'pusty'));
    assert.deepEqual(await skilleZKatalogu(k), [{ id: 'unity/unity-animation', grupa: 'unity', opis: 'Drive Unity 6 character animation with Animator.' }]);
    const wf = tmp();
    fs.writeFileSync(path.join(wf, 'trellis2_obraz_do_3d.json'), '{}');
    fs.writeFileSync(path.join(wf, 'notatka.md'), '');
    const P = utworzPartytury({ plik: path.join(tmp(), 'p.json'), katalogSkilli: k, katalogWorkflow: wf, cele: { gra: { etykieta: 'Gra / apka' } }, modele: async () => [{ nazwa: 'ornith:latest', parametry: '9.0B' }] });
    const kat = await P.katalogi();
    assert.deepEqual(kat.workflow, ['trellis2_obraz_do_3d.json']);
    assert.deepEqual(kat.cele, { gra: 'Gra / apka' });
    assert.equal(kat.skille[0].id, 'unity/unity-animation');
});

test('straż modeli (auto 3): zniknął → zastępca wg roli (najbliższy rozmiarem), wrócił → powrót; ręczna zmiana wygrywa', async () => {
    const plik = path.join(tmp(), 'z.json');
    const przydzial = { aktor: 'teogochi_yay:latest', wektor: 'apus-9b:latest', joanna: 'mistral:latest', kronikarz: 'gemma4:31b-cloud' };
    let widzi = ['mistral:latest', 'ornith:latest', 'spark-4b:latest', 'gemma4:12B'];
    const kat = () => [{ nazwa: 'mistral:latest', parametry: '7.2B' }, { nazwa: 'ornith:latest', parametry: '9.0B' }, { nazwa: 'spark-4b:latest', parametry: '4.11B' }, { nazwa: 'gemma4:12B', parametry: '11.9B' }]
        .filter((m) => widzi.includes(m.nazwa)).map((m) => ({ ...m, praca: {} }));
    const szyna = [];
    const S = utworzStrazModeli({
        plik, modeleAgentow: async () => ({ ...przydzial }), ustaw: async (a, m) => { przydzial[a] = m; },
        tagi: async () => ({ models: widzi.map((name) => ({ name })) }), katalog: async () => kat(),
        zastepca: (k, a, o) => Dyrygent.zastepcaDlaAgenta(k, a, o), szyna: { nadaj: async (z) => szyna.push(z) },
    });
    const z1 = await S.sprawdz();
    assert.deepEqual(z1.map((c) => [c.agent, c.rodzaj, c.na]).sort(), [['aktor', 'zastepstwo', 'mistral:latest'], ['wektor', 'zastepstwo', 'ornith:latest']]);
    assert.equal(przydzial.kronikarz, 'gemma4:31b-cloud', 'chmury nie rusza');
    assert.match(szyna[0].tresc, /zniknął z Ollamy — gra teraz na/);
    widzi = [...widzi, 'teogochi_yay:latest'];
    const z2 = await S.sprawdz();
    assert.deepEqual(z2.map((c) => [c.agent, c.rodzaj]), [['aktor', 'powrot']]);
    assert.equal(przydzial.aktor, 'teogochi_yay:latest');
    przydzial.wektor = 'gemma4:12B';   // Suweren ustawił ręcznie
    const z3 = await S.sprawdz();
    assert.deepEqual(z3.map((c) => [c.agent, c.rodzaj]), [['wektor', 'zapomniane']]);
    assert.deepEqual((await S.stan()).zastepstwa, {});
    widzi = [];
    await S.sprawdz();
    assert.match((await S.stan()).blad, /nie podała żadnego modelu/, 'Ollama śpi — nic nie ruszamy');
});
