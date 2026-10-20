/**
 * 📚 Baza Wiedzy — metadane z nazwy, czyszczenie stron, akapity i kawałki, BM25 + wektory (atrapa embeddingów),
 * zasada „tylko z fragmentów” (odnośniki, brak w materiałach bez modelu), trasy i Straż (tylko maszyna).
 * Prawdziwe PDF-y Shoudów — tylko gdy leżą w _OtakOs_Wiedza (katalog poza repo).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import {
    metaShoudu, oczyscStrony, akapity, kawalki, stronyZPdf, slowa, indeksBm25, szukajBm25, polacz, szukajWektorowo, normalizuj,
    promptOdpowiedzi, sprawdzOdpowiedz, jezykPytania, utworzBazeWiedzy, zamontujTrasyBazyWiedzy, BRAK, PRZEKLAD_ZAPYTANIA, czystyPrzeklad,
} from '../services/BazaWiedzy.js';
import { strazMostu } from '../services/StrazMostu.js';

test('metaShoudu: seria z katalogu, data, lekcja, Q&A i nietypowe nazwy', () => {
    assert.deepEqual(metaShoudu('25 - Illumination Series (2023-2024)/20231007_Illumination-Series_Shoud-01_English.pdf'),
        { seria: 'Illumination Series', nrSerii: 25, lata: '2023-2024', data: '2023-10-07', rok: 2023, lekcja: 'Shoud 01', qa: false });
    const qa = metaShoudu('02 - Creator Series (2000-2001)/20000819_Creator-Series_Lesson-01-Q&A_English.pdf');
    assert.equal(qa.lekcja, 'Lesson 01 Q&A'); assert.equal(qa.qa, true);
    assert.equal(metaShoudu('02 - Creator Series (2000-2001)/20010713_Creator-Series_Lesson-12-2_English.pdf').lekcja, 'Lesson 12 2');
    assert.equal(metaShoudu('01 - New Earth Series (1999-2000)/19991231_New-Earth-Series_Millenium-Channel III_English.pdf').lekcja, 'Millenium Channel III');
    assert.equal(metaShoudu('22 - Merlin I Am Series (2020-2021)/20210807_MerlinIAm_11_English_Letter.pdf').lekcja, 'Shoud 11');
    assert.equal(metaShoudu('28 - The Wizdom Series (2026)/20260801_Wizdom-Series_Shoud-01_English.pdf').lata, '2026');
});

/** Strona jak z PDF-a: nagłówek biegnący, linie łamane co ~80 znaków, numer strony. */
function strona(nr, akapityTekstu) {
    const linie = ['Illumination • Shoud 1'];
    for (const a of akapityTekstu) {
        const slowaA = a.split(' '); let l = '';
        for (const w of slowaA) { if ((l + ' ' + w).length > 80) { linie.push(l); l = w; } else l = l ? `${l} ${w}` : w; }
        linie.push(l);
    }
    linie.push(String(nr));
    return linie.join('\n');
}
const SLOWA = ['wisdom', 'master', 'energy', 'allowing', 'lifetime', 'dragon', 'light', 'body', 'mind', 'freedom', 'passion', 'grace', 'bench', 'heart', 'time', 'soul'];
/** Zdanie o różnej treści i długości (jak w prawdziwych Shoudach — żadna linia nie powtarza się na brzegach stron). */
const zdanie = (i) => `Sentence number ${i} talks about ${Array.from({ length: 6 + (i % 7) }, (_, j) => SLOWA[(i * 7 + j * 3) % SLOWA.length]).join(' and ')}.`;

test('czyszczenie: nagłówki biegnące, numery stron i prawa autorskie znikają; akapity i kawałki w granicach', () => {
    const strony = [
        'Shoud 1\n© Copyright 2023 Crimson Circle IP, Inc.\nPlease freely distribute this text, in its entirety, on a non-com-',
        ...Array.from({ length: 5 }, (_, s) => strona(s + 2, Array.from({ length: 4 }, (_, a) => Array.from({ length: 3 + a }, (_, z) => zdanie(s * 100 + a * 10 + z)).join(' ')))),
    ];
    const czyste = oczyscStrony(strony);
    const wszystko = czyste.flat().join('\n');
    assert.doesNotMatch(wszystko, /Illumination • Shoud 1/);
    assert.doesNotMatch(wszystko, /Copyright|freely distribute/);
    assert.ok(!czyste.flat().some((l) => /^\d+$/.test(l)));
    const a = akapity(czyste);
    assert.ok(a.length >= 10, `akapitów ${a.length}`);
    assert.equal(a.find((x) => x.tekst.includes('number 100 '))?.strona, 3);
    const k = kawalki(a);
    assert.ok(k.length >= 5);
    for (const x of k.slice(0, -1)) assert.ok(x.tekst.length >= 400 && x.tekst.length <= 1300, `długość ${x.tekst.length}`);
    // zakładka: początek kawałka powtarza koniec poprzedniego
    const ogon = k[0].tekst.split(/(?<=\.)\s+/).pop();
    assert.ok(k[1].tekst.startsWith(ogon), 'zakładka');
    // nic nie ginie: każde zdanie jest w którymś kawałku
    for (let s = 0; s < 5; s++) assert.ok(k.some((x) => x.tekst.includes(`number ${s * 100 + 32} `)));
});

test('za długi akapit dzielony po zdaniach, nic dłuższego niż max', () => {
    const dlugi = Array.from({ length: 40 }, (_, i) => zdanie(i)).join(' ');
    const k = kawalki([{ tekst: dlugi, strona: 4 }]);
    assert.ok(k.length >= 3);
    assert.ok(k.every((x) => x.tekst.length <= 1200 && x.strona === 4));
});

const PDF_SHOUDOW = path.join(process.cwd(), '_OtakOs_Wiedza', 'CC Shoud materials', 'ALL CC Shoud PDF');
const PRAWDZIWE = [
    '01 - New Earth Series (1999-2000)/19990821_New-Earth-Series_Lesson-01_English.pdf',
    '10 - Returning Series (2008-2009)/20080802_Returning-Series_Shoud-01-Q&A_English.pdf',
    '25 - Illumination Series (2023-2024)/20231007_Illumination-Series_Shoud-01_English.pdf',
];
test('prawdziwe PDF-y Shoudów: tekst, bez stopek praw, kawałki z numerem strony', { skip: !PRAWDZIWE.every((p) => fsSync.existsSync(path.join(PDF_SHOUDOW, p))) && 'brak materiałów w _OtakOs_Wiedza' }, async () => {
    for (const rel of PRAWDZIWE) {
        const strony = await stronyZPdf(await fs.readFile(path.join(PDF_SHOUDOW, rel)));
        assert.ok(strony.length >= 5, `${rel}: stron ${strony.length}`);
        const k = kawalki(akapity(oczyscStrony(strony)));
        assert.ok(k.length >= 15, `${rel}: kawałków ${k.length}`);
        const t = k.map((x) => x.tekst).join('\n');
        assert.doesNotMatch(t, /Copyright|Crimson Circle IP|All other uses must/);
        assert.match(t, /TOBIAS|Adamus/);
        assert.ok(k.every((x) => x.strona >= 1 && x.strona <= strony.length));
    }
});

test('BM25 i wektory: RRF łączy obie listy, filtr wyłącza kawałki', () => {
    const teksty = ['The dragon brings purification and compassion.', 'Allowing is the key to embodied realization.', 'Coffee and the bench in the park.'];
    const idx = indeksBm25(teksty);
    assert.deepEqual(slowa("Adamus's allowing the KEY"), ['adamus', 'allowing', 'key']);
    assert.equal(szukajBm25(idx, 'allowing key')[0].nr, 1);
    assert.equal(szukajBm25(idx, 'allowing', { dozwolone: Uint8Array.from([1, 0, 1]) }).length, 0);
    const wektory = new Float32Array([...normalizuj([1, 0, 0]), ...normalizuj([0, 1, 0]), ...normalizuj([0.7, 0.7, 0])]);
    const w = szukajWektorowo(wektory, 3, normalizuj([0, 1, 0.1]));
    assert.equal(w[0].nr, 1);
    const p = polacz(w, szukajBm25(idx, 'dragon'));
    assert.ok(p.some((x) => x.nr === 0 && x.bm25 > 0));
    assert.equal(p[0].nr, 0);   // w obu listach wygrywa z tym, który jest tylko w jednej
});

test('zasada „tylko z fragmentów”: prompt, odnośniki spoza listy usunięte, liczenie zdań ze źródłem, długie cytaty', () => {
    const fragmenty = [
        { seria: 'Wings Series', data: '2017-10-07', lekcja: 'Shoud 2', strona: 4, tekst: 'Allowing is the simple act of letting your wisdom come in without trying to control it at all, said Adamus to Shaumbra.' },
        { seria: 'Next Series', data: '2010-09-04', lekcja: 'Shoud 2', strona: 7, tekst: 'The dragon comes to purify what no longer serves.' },
    ];
    const { system, prompt, jezyk } = promptOdpowiedzi({ pytanie: 'Czym jest pozwalanie?', fragmenty });
    assert.equal(jezyk, 'pl');
    assert.match(system, /WYŁĄCZNIE na podstawie FRAGMENTÓW/);
    assert.match(system, /W Shoudach tego nie znalazłem\./);
    assert.match(prompt, /\[1\] Wings Series, 2017-10-07, Shoud 2, s\. 4/);
    assert.equal(jezykPytania('What is allowing?'), 'en');
    const s = sprawdzOdpowiedz('Pozwalanie to wpuszczenie mądrości bez kontroli [1]. Smok oczyszcza [2][7]. To zdanie nie ma źródła wcale.', fragmenty);
    assert.equal(s.zdan, 3); assert.equal(s.zZrodlem, 2); assert.equal(s.bezZrodla, 1);
    assert.deepEqual(s.zleOdnosniki, [7]); assert.deepEqual(s.uzyte, [1, 2]);
    assert.doesNotMatch(s.tekst, /\[7\]/);
    assert.equal(s.brak, false);
    const cyt = sprawdzOdpowiedz('He said "allowing is the simple act of letting your wisdom come in without trying to control it" [1].', fragmenty);
    assert.ok(cyt.najdluzszyCytat >= 15, `cytat ${cyt.najdluzszyCytat}`);
    assert.equal(sprawdzOdpowiedz(BRAK.pl, fragmenty).brak, true);
});

/** Atrapa embeddingów: worek słów rzutowany na 64 wymiary (te same słowa = podobne wektory). */
function atrapaOsadz(teksty) {
    return teksty.map((t) => {
        const v = new Array(64).fill(0);
        for (const w of slowa(t.replace(/^(title|task):[^|]*\|\s*(text|query):/, ''))) { let h = 0; for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0; v[h % 64] += 1; }
        return v;
    });
}

async function kolekcjaTestowa() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'baza-wiedzy-'));
    const zrodlo = path.join(dir, 'zrodla');
    for (const [seria, plik, temat] of [
        ['19 - Wings Series (2017-2018)', '20171007_Wings-Series_Shoud-02_English.pdf', 'allowing wisdom master'],
        ['12 - Next Series (2010-2011)', '20100904_Next-Series_Shoud-02_English.pdf', 'dragon purification compassion'],
    ]) {
        await fs.mkdir(path.join(zrodlo, seria), { recursive: true });
        const tekst = Array.from({ length: 4 }, (_, s) => strona(s + 1, Array.from({ length: 3 }, (_, a) => Array.from({ length: 4 }, (_, z) => `In paragraph ${s}${a}${z} Adamus speaks about ${temat} and the human.`).join(' ')))).join('\f');
        await fs.writeFile(path.join(zrodlo, seria, plik), tekst);
    }
    return { dir, zrodlo, kolekcja: { id: 'shoudy', nazwa: 'Biblioteka Shoudów', zrodlo, meta: metaShoudu, prywatna: true, strony: (b) => b.toString('utf8').split('\f') } };
}

async function czekaj(st) { for (let i = 0; i < 200 && !['gotowe', 'blad', 'przerwane'].includes(st.etap); i++) await new Promise((ok) => setTimeout(ok, 25)); return st; }

test('kolekcja: indeks przyrostowy (hash), wyszukiwanie z filtrami, odpowiedź z przypisami, brak bez modelu', async () => {
    const { dir, zrodlo, kolekcja } = await kolekcjaTestowa();
    let osadzen = 0, wolan = 0, przekladow = 0, ostatniPrompt = '';
    const baza = utworzBazeWiedzy({
        katalog: path.join(dir, 'indeks'), kolekcje: [kolekcja], modelEmbeddingow: 'atrapa-emb',
        osadz: async (t) => { osadzen += t.length; return atrapaOsadz(t); },
        pisz: async ({ system, prompt }) => {
            if (system === PRZEKLAD_ZAPYTANIA) { przekladow++; return { tekst: '"What is the dragon?"\nkomentarz', model: 'atrapa' }; }
            wolan++; ostatniPrompt = prompt; return { tekst: 'Smok oczyszcza [1]. Mistrz pozwala [9].', model: 'atrapa' };
        },
    });
    const st = await czekaj(baza.indeksuj('shoudy'));
    assert.equal(st.etap, 'gotowe', st.powod);
    assert.equal(st.nowych, 2);
    const s1 = await baza.stan('shoudy');
    assert.equal(s1.zaindeksowanych, 2); assert.ok(s1.kawalkow >= 4); assert.equal(s1.serie.length, 2);
    // drugi przebieg: nic nowego (ten sam hash), osadzeń nie przybywa
    const przed = osadzen;
    const st2 = await czekaj(baza.indeksuj('shoudy'));
    assert.equal(st2.nowych, 0); assert.equal(st2.pominiete, 2); assert.equal(osadzen, przed);
    // zmiana pliku = przeliczenie tylko jego; usunięcie = znika z indeksu
    const p2 = path.join(zrodlo, '12 - Next Series (2010-2011)', '20100904_Next-Series_Shoud-02_English.pdf');
    await fs.appendFile(p2, '\fA new page about dragon fire and purification of the old energy in the human.');
    const st3 = await czekaj(baza.indeksuj('shoudy'));
    assert.equal(st3.nowych, 1);

    const sz = await baza.szukaj('shoudy', 'dragon purification', { k: 3 });
    assert.equal(sz.wyniki[0].seria, 'Next Series');
    const filtr = await baza.szukaj('shoudy', 'dragon purification', { serie: ['Wings Series'] });
    assert.ok(filtr.wyniki.every((w) => w.seria === 'Wings Series'));
    const lata = await baza.szukaj('shoudy', 'dragon', { rokOd: 2015 });
    assert.ok(lata.wyniki.every((w) => w.rok >= 2015));

    const o = await baza.odpowiedz('shoudy', { pytanie: 'What does the dragon do?', k: 3 });
    assert.equal(wolan, 1);
    assert.match(ostatniPrompt, /\[1\] Next Series, 2010-09-04, Shoud 02/);
    assert.equal(o.jezyk, 'en');
    assert.deepEqual(o.sprawdzenie.zleOdnosniki, [9]);
    assert.equal(o.sprawdzenie.zZrodlem, 1);
    assert.equal(o.fragmenty[0].n, 1);
    assert.ok(o.fragmenty[0].plik.endsWith('.pdf'));

    // filtr bez trafień → odpowiedź „nie znalazłem” bez wołania modelu
    const nic = await baza.odpowiedz('shoudy', { pytanie: 'Czym jest smok?', rokOd: 2030 });
    assert.equal(nic.odpowiedz, BRAK.pl); assert.equal(wolan, 1);
    assert.equal(przekladow, 1); assert.equal(nic.zapytanieEn, 'What is the dragon?');   // polskie pytanie: przekład do wyszukiwania, odpowiedzi brak

    await fs.rm(p2);
    await czekaj(baza.indeksuj('shoudy'));
    assert.equal((await baza.stan('shoudy')).zaindeksowanych, 1);
    await fs.rm(dir, { recursive: true, force: true });
});

test('karta zajęta renderem: indeks czeka, odpowiedź odmawia (409)', async () => {
    const { dir, kolekcja } = await kolekcjaTestowa();
    let zajeta = 'ComfyUI liczy render';
    const baza = utworzBazeWiedzy({
        katalog: path.join(dir, 'indeks'), kolekcje: [kolekcja], modelEmbeddingow: 'atrapa-emb', czekanieMs: 20,
        osadz: async (t) => atrapaOsadz(t), pisz: async () => ({ tekst: 'x [1].' }), kartaZajeta: async () => zajeta,
    });
    const st = baza.indeksuj('shoudy');
    await new Promise((ok) => setTimeout(ok, 120));
    assert.equal(st.etap, 'czeka'); assert.equal(st.nowych, 0);
    zajeta = null;
    await czekaj(st);
    assert.equal(st.nowych, 2);
    zajeta = 'ComfyUI liczy render';
    await assert.rejects(baza.odpowiedz('shoudy', { pytanie: 'dragon?' }), (e) => e.kod === 409);
    await fs.rm(dir, { recursive: true, force: true });
});

test('trasy: tylko maszyna — tunel z kluczem i strona publiczna dostają 403', async () => {
    const { dir, kolekcja } = await kolekcjaTestowa();
    const baza = utworzBazeWiedzy({ katalog: path.join(dir, 'indeks'), kolekcje: [kolekcja], modelEmbeddingow: 'atrapa-emb', osadz: async (t) => atrapaOsadz(t), pisz: async () => ({ tekst: 'Smok oczyszcza stare [1].' }) });
    const app = express();
    app.use(express.json());
    const KLUCZ = 'k'.repeat(48);
    app.use(strazMostu({ klucz: () => KLUCZ, zaufane: ['https://otakos.wtf'] }));
    zamontujTrasyBazyWiedzy(app, baza, { modele: async () => ['gemma4:12B'] });
    const s = await new Promise((ok) => { const x = app.listen(0, '127.0.0.1', () => ok(x)); });
    const url = `http://127.0.0.1:${s.address().port}`;
    try {
        let r = await fetch(`${url}/api/baza-wiedzy/shoudy`);
        let d = await r.json();
        assert.equal(r.status, 200); assert.equal(d.prywatna, true); assert.deepEqual(d.modele, ['gemma4:12B']);
        r = await fetch(`${url}/api/baza-wiedzy/shoudy/indeksuj`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(r.status, 200);
        assert.equal((await r.json()).praca.etap, 'indeksuje');
        for (let i = 0; i < 100; i++) { d = await (await fetch(`${url}/api/baza-wiedzy/shoudy`)).json(); if (d.praca.etap === 'gotowe') break; await new Promise((ok) => setTimeout(ok, 25)); }
        r = await fetch(`${url}/api/baza-wiedzy/shoudy/pytanie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pytanie: 'dragon purification' }) });
        d = await r.json();
        assert.equal(r.status, 200, d.message); assert.equal(d.sprawdzenie.zZrodlem, 1);
        r = await fetch(`${url}/api/baza-wiedzy/nieznana`);
        assert.equal(r.status, 404);
        // zdalnie z poprawnym kluczem (tunel) — nadal nie
        r = await fetch(`${url}/api/baza-wiedzy/shoudy`, { headers: { 'x-forwarded-for': '8.8.8.8', 'x-teo-klucz': KLUCZ } });
        assert.equal(r.status, 403);
        r = await fetch(`${url}/api/baza-wiedzy/shoudy/pytanie`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://otakos.wtf' }, body: JSON.stringify({ pytanie: 'dragon' }) });
        assert.equal(r.status, 403);
        r = await fetch(`${url}/api/baza-wiedzy/shoudy`, { headers: { origin: 'https://otakos.wtf' } });
        assert.equal(r.status, 403);
    } finally { await new Promise((ok) => s.close(ok)); await fs.rm(dir, { recursive: true, force: true }); }
});

test('czystyPrzeklad: pierwsza linia bez etykiet i cudzysłowów, śmieci = null', () => {
    assert.equal(czystyPrzeklad('Query: "What is the Dragon?"\nTo jest przekład.'), 'What is the Dragon?');
    assert.equal(czystyPrzeklad('<think>hm</think>\n\nWho is Cauldre?'), 'Who is Cauldre?');
    assert.equal(czystyPrzeklad(''), null);
    assert.equal(czystyPrzeklad('x'.repeat(400)), null);
});
