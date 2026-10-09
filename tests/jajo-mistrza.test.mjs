// 🥚 JaJo Mistrza — pary „model → Suweren” z prawdziwych poprawek, decyzje, etap jaja, kurs dla Kuźni, lekcja z dowodami.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzJajo, paryKwestii, odczytajZasady, podobienstwo } from '../services/JajoMistrza.js';

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
