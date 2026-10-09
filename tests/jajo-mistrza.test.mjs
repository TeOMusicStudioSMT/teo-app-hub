// 🥚 JaJo Mistrza — pary „model → Suweren” z prawdziwych poprawek, decyzje, etap jaja, kurs dla Kuźni, lekcja z dowodami.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzJajo, paryKwestii, odczytajZasady, podobienstwo, sedziaZPowodu, plikiJakoTekst } from '../services/JajoMistrza.js';

test('paryKwestii: ta sama długość = kwestia za kwestię; inna = najbliższa tego samego mówcy', () => {
    const A = [{ kto: 'k', tekst: 'Witajcie w studiu, dziś rozmawiamy o wyspie.' }, { kto: 'g', tekst: 'Dziękuję za zaproszenie, to dla mnie ogromny zaszczyt i radość.' }];
    const B = [{ kto: 'k', tekst: 'Witajcie w studiu, dziś rozmawiamy o wyspie.' }, { kto: 'g', tekst: 'Dzięki za zaproszenie.' }];
    const r = paryKwestii(A, B);
    assert.equal(r.pary.length, 1);
    assert.deepEqual([r.pary[0].kto, r.pary[0].po], ['g', 'Dzięki za zaproszenie.']);
    assert.match(r.pary[0].kontekst, /^k: Witajcie/);
    const C = [...B, { kto: 'k', tekst: 'Zupełnie nowe pytanie o kota.' }];
    const r2 = paryKwestii(A, C);
    assert.equal(r2.pary.length, 0, 'zbyt różna kwestia gościa nie jest parą (Jaccard < 0,3)');
    assert.equal(r2.dopisane, 2);
    assert.equal(r2.usuniete, 1);
    assert.ok(podobienstwo('ala ma kota', 'ala ma kota') === 1);
});

test('odczytajZasady: tylko zasady z istniejącymi numerami obserwacji', () => {
    const { zasady, odrzucone } = odczytajZasady('1. Skracaj kwestie. [#1, #2]\n2. **Mów** po ludzku [#9]\n- Bez dowodu\n3. Zmyślona [#99]', new Set([1, 2, 9]));
    assert.deepEqual(zasady.map((z) => z.zasada), ['Skracaj kwestie.', 'Mów po ludzku']);
    assert.deepEqual(zasady[0].dowody, [1, 2]);
    assert.equal(odrzucone.length, 1);
});

test('dziennik: poprawki dialogu i pól, decyzje, etap jaja, kurs do Kuźni, lekcja', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'jajo-'));
    try {
        const szyna = { wpisy: [], nadaj: async (w) => szyna.wpisy.push(w) };
        let prompt = '';
        const J = utworzJajo({ katalog: path.join(kat, 'jajo'), katalogKuzni: path.join(kat, 'kuznia'), szyna, pisz: async (o) => { prompt = o.prompt; return '1. Skracaj podziękowania do dwóch słów. [#1]\n2. Tytuł bez wykrzyknika. [#7]\n3. Wymysł [#500]'; } });
        assert.equal((await J.stan()).etap.nazwa, 'jajo');
        await assert.rejects(J.lekcja(), /Za mało poprawek na lekcję: 0/);
        await J.poprawkaDialogu({ zrodlo: 'podcast', obiekt: 'p1', tytul: 'Wyspa', przed: [{ kto: 'g', tekst: 'Dziękuję bardzo serdecznie za zaproszenie do studia.' }, { kto: 'k', tekst: 'A' }], po: [{ kto: 'g', tekst: 'Dzięki za zaproszenie do studia.' }, { kto: 'k', tekst: 'A' }] });
        for (let i = 0; i < 4; i++) await J.poprawkaDialogu({ zrodlo: 'wywiad', obiekt: `w${i}`, przed: [{ kto: 'k', tekst: `pytanie numer ${i} o wyspę długie` }], po: [{ kto: 'k', tekst: `pytanie ${i} o wyspę` }] });
        await J.decyzja({ zrodlo: 'stol', obiekt: 'karta1', tytul: 'Gra o kocie', werdykt: 'przyjmij', uwagi: 'więcej nocy' });
        await J.poprawkaPol({ zrodlo: 'youtube', obiekt: 'yt1', przed: { tytul: 'Wielki film!!!', opis: 'x', tagi: ['a'] }, po: { tytul: 'Wielki film', opis: 'x', tagi: ['a'] }, pola: ['tytul', 'opis', 'tagi'] });
        const s = await J.stan();
        assert.deepEqual([s.obserwacji, s.poprawki, s.decyzje], [7, 6, 1]);
        assert.deepEqual(s.zrodla.youtube, { nazwa: 'Publikacja YouTube', poprawki: 1, decyzje: 0 });
        assert.equal(s.etap.punkty, 13);
        assert.equal(s.etap.nastepny.brakuje, 7);
        assert.equal(s.ostatnie[0].nr, 7);
        assert.match(szyna.wpisy[0].tresc, /widzę 1 Twoich poprawek w: Odcinek Studia Podcastu „Wyspa”/);
        const k = await J.kurs();
        assert.deepEqual([k.pary, k.sft], [6, 6]);
        const para = JSON.parse((await fs.readFile(path.join(kat, 'kuznia', 'mistrz', 'pary-suwerena.jsonl'), 'utf8')).split('\n')[0]);
        assert.deepEqual([para.chosen, para.rejected], ['Dzięki za zaproszenie do studia.', 'Dziękuję bardzo serdecznie za zaproszenie do studia.']);
        const l = await J.lekcja();
        assert.match(prompt, /#1 \[Odcinek Studia Podcastu, g\] MODEL: «Dziękuję bardzo/);
        assert.match(prompt, /#6 \[Stół ratyfikacji\] DECYZJA: przyjmij — Gra o kocie \(uwagi: więcej nocy\)/);
        assert.deepEqual([l.zasady.length, l.odrzucone], [2, 1]);
        assert.match(await fs.readFile(path.join(kat, 'jajo', 'zasady.md'), 'utf8'), /1\. Skracaj podziękowania do dwóch słów\. \[#1\]/);
        assert.equal((await J.stan()).zasady.zasady.length, 2);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});

test('sędzia z powodu rundy i pliki jako tekst', () => {
    assert.equal(sedziaZPowodu('Kod się buduje i działa, ale SĘDZIA ZADANIA uznał…'), 'Jev (sędzia zadania)');
    assert.equal(sedziaZPowodu('Dodałeś src/a.ts, ale ŻADEN plik projektu tego nie importuje'), 'martwy moduł');
    assert.equal(sedziaZPowodu('tsc:\nsrc/main.ts(41,10): TS2339: Property'), 'build');
    assert.equal(plikiJakoTekst([{ sciezka: 'a.ts', tresc: 'x' }]), '=== PLIK: a.ts ===\nx\n=== KONIEC ===');
});

test('📯 kanał Mistrza i ⚖️ rundy Kodeksa: pary tylko przy zwycięstwie po porażkach, wieści o etapie i lekcji', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'jajo-k-'));
    try {
        const J = utworzJajo({ katalog: path.join(kat, 'jajo'), katalogKuzni: path.join(kat, 'kuznia') });
        const runda = { projekt: 'teterhia', zadanie: 'z1', cel: 'Księga FLOOM: 3 komendy', model: 'claude:claude-sonnet-5-5', rundy: 3 };
        // porażka do końca albo zwycięstwo bez porażek = nic
        assert.deepEqual(await J.rundaKodeksa({ ...runda, ok: false, odrzucone: [{ runda: 1, pliki: [{ sciezka: 'a.ts', tresc: 'zle' }], powod: 'tsc: TS2339' }], przyjete: null }), []);
        assert.deepEqual(await J.rundaKodeksa({ ...runda, ok: true, odrzucone: [], przyjete: [{ sciezka: 'a.ts', tresc: 'dobrze' }] }), []);
        const z = await J.rundaKodeksa({ ...runda, ok: true, przyjete: [{ sciezka: 'a.ts', tresc: 'dobrze' }], odrzucone: [
            { runda: 1, pliki: [{ sciezka: 'a.ts', tresc: 'zle1' }], powod: 'Dodałeś src/k.ts, ale ŻADEN plik projektu tego nie importuje' },
            { runda: 2, pliki: [{ sciezka: 'a.ts', tresc: 'zle2' }], powod: 'Kod się buduje i działa, ale SĘDZIA ZADANIA uznał (p=0.20)' },
        ] });
        assert.equal(z.length, 2);
        const s = await J.stan();
        assert.equal(s.rundyKodeksa.par, 2);
        assert.deepEqual(s.rundyKodeksa.sedziowie, { 'martwy moduł': 1, 'Jev (sędzia zadania)': 1 });
        assert.equal(s.rundyKodeksa.ostatnie[0].odrzucona, undefined, 'stan bez kodu');
        let w = await J.wiesci();
        assert.equal(w.ostatni, 1);
        assert.match(w.wiesci[0].tresc, /Kodeks \(claude-sonnet-5-5\) na „teterhia” przegrał 2 rundy \(martwy moduł, Jev \(sędzia zadania\)\) i wygrał w 3\./);
        assert.equal(w.wiesci[0].glos, true);
        const k = await J.kurs();
        assert.equal(k.paryKodeksa, 2);
        const para = JSON.parse((await fs.readFile(path.join(kat, 'kuznia', 'kodeks', 'pary-kodeksa.jsonl'), 'utf8')).split('\n')[0]);
        assert.match(para.chosen, /dobrze/);
        assert.match(para.rejected, /zle1/);
        // 10 poprawek: etap jajo → drży (20 pkt z 2 rundami = 22) + propozycja lekcji (≥ 5 poprawek), każda raz
        for (let i = 0; i < 10; i++) await J.poprawkaDialogu({ zrodlo: 'wywiad', obiekt: `w${i}`, przed: [{ kto: 'k', tekst: `pytanie numer ${i} o wyspę długie` }], po: [{ kto: 'k', tekst: `pytanie ${i} o wyspę` }] });
        w = await J.wiesci({ od: 1 });
        const rodzaje = w.wiesci.map((x) => x.rodzaj);
        assert.equal(rodzaje.filter((r) => r === 'lekcja').length, 1, 'propozycja lekcji tylko raz');
        assert.equal(rodzaje.filter((r) => r === 'etap').length, 1);
        assert.match(w.wiesci.find((x) => x.rodzaj === 'etap').tresc, /Jajo drży/);
        // przekaz z pola
        const pole = await J.wiesc({ tresc: 'Klub Mistrzów: turniej w sobotę', skad: 'z pola' });
        assert.equal(pole.skad, 'z pola');
        await assert.rejects(J.wiesc({ tresc: ' ' }), /Pusta wieść/);
        assert.equal((await J.wiesci({ od: pole.nr - 1 })).wiesci.length, 1);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
