// 🕊️ Delegat na Jev + rozmowa przy karcie Stołu (Suweren 2026-10-08).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pytanieIntencji, wynikIntencji, rozpoznajIntencje, blokKarty } from '../services/DelegatJev.js';
import * as Delegat from '../services/Delegat.js';

// ── atrapa Ollamy: odpowiada kolejnymi tekstami ze skryptu, zapisuje, co dostała ──
let skrypt = [], zapytania = [], serwer, katalog;
before(async () => {
    serwer = http.createServer((req, res) => {
        let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
            zapytania.push(JSON.parse(b));
            res.end(JSON.stringify({ message: { content: skrypt.shift() ?? 'Dobrze.' } }));
        });
    });
    await new Promise((r) => serwer.listen(0, '127.0.0.1', r));
    katalog = await fs.mkdtemp(path.join(os.tmpdir(), 'delegat-jev-'));
});
after(async () => { serwer.close(); await fs.rm(katalog, { recursive: true, force: true }); });

const zwolnione = [];
const konfig = (jev, stol = null) => Delegat.skonfiguruj({
    ollamaBase: `http://127.0.0.1:${serwer.address().port}`, katalog, szyna: null, nocna: null, jev, stol, model: 'atrapa',
    stan: { raport: async () => ({ tekst: 'brak', projekty: [] }), pamiec: async () => ({ freeGB: 3.2, totalGB: 32, procesy: [{ pid: 4242, name: 'python', mb: 9000, opis: 'ComfyUI' }] }), zwolnij: async (p) => { zwolnione.push(...p); return { zamkniete: p }; } },
});
const jevMowi = (odpowiedzi) => {
    const j = { pytania: [], stan: () => ({ maKlucz: true }) };
    j.zapytaj = async (z) => { j.pytania.push(z); const klucz = Object.keys(z.questions)[0]; return { model: 'jev-1.13.0', answers: { [klucz]: odpowiedzi[klucz] } }; };
    return j;
};

test('pytanie intencji: rozmowa + dozwolone narzędzia jako criteria choice', () => {
    const q = pytanieIntencji([{ nazwa: 'system.pamiec', opis: 'RAM' }]);
    assert.equal(q.type, 'choice');
    assert.deepEqual(Object.keys(q.criteria), ['rozmowa', 'system.pamiec']);
    assert.deepEqual(wynikIntencji({ answers: { intencja: { choice: 'system.pamiec', probabilities: { 'system.pamiec': 0.8, rozmowa: 0.15, x: 0.05 } } } }),
        { wybor: 'system.pamiec', p: 0.8, drugi: { wybor: 'rozmowa', p: 0.15 } });
});

test('decyzje intencji: bez argumentów → wykonaj, z argumentami → wskazówka, niska pewność → niepewne; bez klucza null', async () => {
    const n = [{ nazwa: 'system.pamiec', opis: 'RAM' }, { nazwa: 'music.generate', opis: 'utwór' }];
    const z = (choice, p) => ({ stan: () => ({ maKlucz: true }), zapytaj: async () => ({ answers: { intencja: { choice, probabilities: { [choice]: p } } } }) });
    assert.equal((await rozpoznajIntencje(z('system.pamiec', 0.9), { tekst: 'ile RAM?', narzedzia: n })).decyzja, 'wykonaj');
    assert.equal((await rozpoznajIntencje(z('music.generate', 0.9), { tekst: 'zrób utwór', narzedzia: n })).decyzja, 'wskazowka');
    assert.equal((await rozpoznajIntencje(z('music.generate', 0.4), { tekst: 'hm', narzedzia: n })).decyzja, 'niepewne');
    assert.equal((await rozpoznajIntencje(z('rozmowa', 0.9), { tekst: 'cześć', narzedzia: n })).decyzja, 'rozmowa');
    assert.equal(await rozpoznajIntencje({ stan: () => ({ maKlucz: false }) }, { tekst: 'x', narzedzia: n }), null);
});

test('Jev rozpoznał pamięć → most wykonuje narzędzie sam, model tylko opowiada wynik', async () => {
    konfig(jevMowi({ intencja: { choice: 'system.pamiec', probabilities: { 'system.pamiec': 0.93 } } }));
    zapytania = []; skrypt = ['Masz 3,2 GB wolnego, najwięcej zjada ComfyUI.'];
    const zd = [];
    const w = await Delegat.rozmawiaj({ delegat: 'kodeks', tekst: 'co mi zjada pamięć?', lokalne: true }, (z) => zd.push(z));
    assert.equal(w.odpowiedz, 'Masz 3,2 GB wolnego, najwięcej zjada ComfyUI.');
    assert.deepEqual(w.jev.intencja, { wybor: 'system.pamiec', p: 0.93, decyzja: 'wykonaj' });
    assert.ok(zd.some((z) => z.typ === 'narzedzie' && z.narzedzie === 'system.pamiec' && z.zrodlo === 'jev'));
    assert.equal(zapytania.length, 1, 'jedno wywołanie modelu — narzędzie poszło bez niego');
    assert.match(zapytania[0].messages.at(-1).content, /WYNIK NARZĘDZIA system\.pamiec \(Katedra sprawdziła to od razu\).*PID|4242/);
});

test('narzędzie z argumentami → wskazówka doklejona do wypowiedzi Suwerena (nie drugi system)', async () => {
    konfig(jevMowi({ intencja: { choice: 'nocna.dodaj', probabilities: { 'nocna.dodaj': 0.88 } } }));
    zapytania = []; skrypt = ['Dobrze, zapiszę.'];
    await Delegat.rozmawiaj({ delegat: 'kodeks', tekst: 'zaplanuj produkcję gry na noc', lokalne: true });
    const m = zapytania[0].messages;
    assert.equal(m.filter((x) => x.role === 'system').length, 1);
    assert.match(m.at(-1).content, /zaplanuj produkcję gry na noc\n\n\(WSKAZÓWKA KATEDRY: ta prośba wymaga narzędzia nocna\.dodaj/);
});

test('straż: ciężkie narzędzie bez wprost zlecenia — wstrzymane; wprost zlecone — wykonane', async () => {
    zwolnione.length = 0;
    const jev = jevMowi({ intencja: { choice: 'rozmowa', probabilities: { rozmowa: 0.7 } }, wprost: { noul: 0.12 } });
    konfig(jev);
    skrypt = ['{"narzedzie":"system.zwolnij","argumenty":{"pidy":[4242]}}', 'Nie zamknąłem — powiedz, czy na pewno.'];
    const zd = [];
    await Delegat.rozmawiaj({ delegat: 'kodeks', tekst: 'ciekawe, co robi ten python', lokalne: true }, (z) => zd.push(z));
    assert.deepEqual(zwolnione, []);
    assert.ok(zd.some((z) => z.typ === 'wynik' && z.narzedzie === 'system.zwolnij' && /Wstrzymane.*p=0\.12/.test(z.wynik.blad)));

    konfig(jevMowi({ intencja: { choice: 'rozmowa', probabilities: { rozmowa: 0.7 } }, wprost: { noul: 0.96 } }));
    skrypt = ['{"narzedzie":"system.zwolnij","argumenty":{"pidy":[4242]}}', 'Zamknięte.'];
    await Delegat.rozmawiaj({ delegat: 'kodeks', tekst: 'zamknij pythona 4242', lokalne: true });
    assert.deepEqual(zwolnione, [4242]);
});

test('rozmowa przy karcie Stołu: fakty karty w prompcie, karta zapamiętana w rozmowie; bez Jev jak dawniej', async () => {
    const karta = { id: 'k-1', tytul: 'Kot z wyspy', etap: 'do_akceptacji', tresc: 'Kot ze świecącym okiem',
        projektSkrot: { stan: 'gotowy', runda: 2, rundy: 2, gotowe: 5, razem: 5, oceny: [{ runda: 1, ocena: 6 }, { runda: 2, ocena: 7.9 }], braki: ['brak opalowej sierści'], biblia: 'BIBLIA', zlecenia: [] } };
    konfig(null, { karta: async (id) => (id === 'k-1' ? karta : null) });
    zapytania = []; skrypt = ['Brakuje opalowej sierści.', 'Dalej to samo.'];
    const w = await Delegat.rozmawiaj({ delegat: 'dyrygent', tekst: 'czego brakuje?', karta: 'k-1' });
    assert.equal(w.karta, 'k-1');
    assert.equal(w.jev, null);
    const sys = zapytania[0].messages[0].content;
    assert.match(sys, /ROZMOWA PRZY KARCIE STOŁU „Kot z wyspy” \(etap: do_akceptacji\)/);
    assert.match(sys, /R1 6\/10, R2 7\.9\/10/);
    assert.match(sys, /brak opalowej sierści/);
    assert.match(sys, /PRZYCISKAMI karty/);
    // druga tura bez `karta` — rozmowa pamięta, przy której karcie jest
    await Delegat.rozmawiaj({ delegat: 'dyrygent', tekst: 'a co z okiem?', rozmowaId: w.rozmowaId });
    assert.match(zapytania[1].messages[0].content, /Kot z wyspy/);
    assert.equal(blokKarty(null), '');
});

test('🎭 scena (gra): rola w prompcie, bez narzędzi — próba narzędzia odmówiona; scena zapamiętana w rozmowie', async () => {
    const jev = jevMowi({ intencja: { choice: 'system.pamiec', probabilities: { 'system.pamiec': 0.99 } } });
    konfig(jev);
    zapytania = []; skrypt = ['{"narzedzie":"system.pamiec","argumenty":{}}', 'Miau… tu na wyspie nie liczę pamięci, liczę gwiazdy.'];
    const zd = [];
    const w = await Delegat.rozmawiaj({ delegat: 'aktor', tekst: 'co zjada pamięć?', lokalne: true, scena: 'Jesteś czarnym kotem-duszkiem z opalową sierścią na wyspie Tetynth. Jest noc.' }, (z) => zd.push(z));
    assert.equal(w.scena, true);
    assert.equal(jev.pytania.length, 0, 'w scenie Jev nie szuka narzędzi');
    const sys = zapytania[0].messages[0].content;
    assert.match(sys, /SCENA — grasz w niej rolę/);
    assert.match(sys, /wyspie Tetynth/);
    assert.doesNotMatch(sys, /Dostępne narzędzia|przez telefon/);
    assert.ok(zd.some((z) => z.typ === 'wynik' && z.narzedzie === 'system.pamiec' && /tylko z maszyny|Nie ma narzędzia/.test(z.wynik.blad)), 'narzędzie odmówione');
    assert.equal(w.odpowiedz, 'Miau… tu na wyspie nie liczę pamięci, liczę gwiazdy.');
    zapytania = []; skrypt = ['Dalej jestem kotem.'];
    await Delegat.rozmawiaj({ delegat: 'aktor', tekst: 'a teraz?', rozmowaId: w.rozmowaId });
    assert.match(zapytania[0].messages[0].content, /wyspie Tetynth/, 'kolejna tura bez sceny — rozmowa ją pamięta');
});
