// 📚 Wypożyczalnia Żywych Ksiąg — publikacja, katalog publiczny, demo za darmo, 48 h przez (atrapę) Stripe, wygaśnięcie, Straż.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { utworzWypozyczalnie, zamontujTrasyWypozyczalni, sprawdzKsiege, dozwolonyPowrot } from '../services/WypozyczalniaKsiag.js';
import { SCIEZKA_TEOSTORY, SCIEZKA_WYPOZYCZENIA } from '../services/StrazMostu.js';

const KSIEGA = { id: 'Kroniki 21:21', title: 'Kroniki 21:21', subtitle: 'Akt I', author: 'TeO', pages: [
    { pageNumber: 1, chapterTitle: 'I', narrativeText: 'Gdy zegary Katedry wskazały 21:21, stadion zaśpiewał.', dialogueLines: [], illustrationPrompt: '', imageCaption: '', imageUrl: 'data:image/png;base64,iVBORw0KGgo=' }] };

test('sprawdzKsiege i powrót: bez stron / tekstu odmowa, vip_full jeszcze nie, powrót tylko na teostory.studio', () => {
    assert.throws(() => sprawdzKsiege({ title: 'x', pages: [] }), /nie ma stron/);
    assert.throws(() => sprawdzKsiege({ title: 'x', pages: [{ narrativeText: '' }] }), /tekstu/);
    assert.throws(() => sprawdzKsiege(KSIEGA, { tier: 'vip_full' }), /vip_full/);
    assert.equal(dozwolonyPowrot('https://teostory.studio/polka?x=1'), 'https://teostory.studio/polka');
    assert.equal(dozwolonyPowrot('https://zlo.example/'), null);
    assert.ok(SCIEZKA_TEOSTORY.test('/wizytowka/teostory') && SCIEZKA_TEOSTORY.test('/wizytowka/teostory/kroniki-21-21/czytaj') && SCIEZKA_TEOSTORY.test('/wizytowka/teostory/odbior'));
    assert.ok(SCIEZKA_WYPOZYCZENIA.test('/wizytowka/teostory/kroniki-21-21/wypozycz'));
    assert.ok(!SCIEZKA_TEOSTORY.test('/wizytowka/teostory/../x/czytaj'));
});

test('publikacja → katalog → 402 bez płatności → Stripe → odbiór 302 na portal → czytanie → wygasa po 48 h', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'teostory-'));
    let zegar = Date.parse('2026-11-05T10:00:00Z');
    const sesje = [];
    const stripe = {
        sesjaZakupu: async (o) => { sesje.push(o); return { id: 'cs_test_a1', url: 'https://checkout.stripe.com/c/pay/cs_test_a1' }; },
        sprawdzSesje: async (id) => ({ id, oplacona: id === 'cs_test_a1', pakiet: 'kroniki-21-21', rodzaj: 'ksiega-48h', powrot: sesje[0]?.metadane?.powrot, kwota: 1.99, waluta: 'eur', tryb: 'test' }),
    };
    const W = utworzWypozyczalnie({ katalog: tmp, stripe, adres: async () => 'https://katedra.example', teraz: () => zegar });
    const app = express(); app.use(express.json({ limit: '50mb' })); zamontujTrasyWypozyczalni(app, W);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    try {
        const pub = await (await fetch(`${baza}/api/books/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ book: KSIEGA, cenaEur: 1.99 }) })).json();
        assert.equal(pub.wpis.id, 'kroniki-21-21');
        const kat = await (await fetch(`${baza}/wizytowka/teostory`)).json();
        assert.equal(kat.ksiegi[0].okladka, '/wizytowka/teostory/kroniki-21-21/obraz/obraz-1.png', 'dataURL strony → plik Wypożyczalni');
        assert.equal(kat.ksiegi[0].cenaEur, 1.99);
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/obraz/obraz-1.png`)).status, 200);
        assert.ok(SCIEZKA_TEOSTORY.test('/wizytowka/teostory/kroniki-21-21/obraz/obraz-1.png'));
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj`)).status, 402);
        const w = await (await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/wypozycz`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ powrot: 'https://teostory.studio/' }) })).json();
        assert.match(w.url, /checkout\.stripe\.com/);
        assert.equal(sesje[0].kwotaCentow, 199, 'cenę liczy most');
        assert.equal(sesje[0].sukces, '/wizytowka/teostory/odbior');
        const odb = await fetch(`${baza}/wizytowka/teostory/odbior?sesja=cs_test_a1`, { redirect: 'manual' });
        assert.equal(odb.status, 302);
        assert.match(odb.headers.get('location'), /^https:\/\/teostory\.studio\/\?ksiega=kroniki-21-21&sesja=cs_test_a1$/);
        const cz = await (await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj?sesja=cs_test_a1`)).json();
        assert.equal(cz.ksiega.pages.length, 1);
        assert.ok(cz.dostepDo);
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj?sesja=cs_zla`)).status, 402);
        zegar += 49 * 3600e3;
        assert.equal((await fetch(`${baza}/wizytowka/teostory/kroniki-21-21/czytaj?sesja=cs_test_a1`)).status, 410);
        // demo = bez płatności; wycofana = znika z katalogu
        await W.publikuj({ book: { ...KSIEGA, id: 'demo-ksiega' }, rentalTier: 'demo' });
        assert.equal((await fetch(`${baza}/wizytowka/teostory/demo-ksiega/czytaj`)).status, 200);
        await W.wycofaj('demo-ksiega');
        assert.equal((await (await fetch(`${baza}/wizytowka/teostory`)).json()).ksiegi.length, 1);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});

// 🌍🎨🎵 2026-11-09: przekład PL/EN/DE, ilustracje Palety, podkład księgi, kwestie (Prolog < 20), ponowna publikacja nie gubi plików
import { liczKwestie, sprawdzPrzekladStrony, MIN_KWESTII_PELNEJ } from '../services/WypozyczalniaKsiag.js';
const czekaj = async (W, id) => { for (let i = 0; i < 200; i++) { const p = W.stanPracy(id); if (p && p.stan !== 'robi') return p; await new Promise((r) => setTimeout(r, 10)); } throw new Error('praca nie skończyła'); };

test('przekład: strona po stronie, zła odpowiedź = jedna poprawka, katalog zna języki i tytuł przekładu', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'teostory-pr-'));
    const prosby = [];
    let zepsuj = 1;
    const pisz = async (_s, prompt) => {
        prosby.push(prompt);
        const k = JSON.parse(prompt.split('\n\n')[0]);
        if (k.lines?.length && zepsuj-- > 0) return JSON.stringify({ ...k, lines: [] });   // zła liczba kwestii → poprawka
        return JSON.stringify({ chapterTitle: k.chapterTitle && `EN ${k.chapterTitle}`, imageCaption: k.imageCaption && `EN ${k.imageCaption}`, narrativeText: k.narrativeText && `EN ${k.narrativeText}`, lines: k.lines.map((l) => `EN ${l}`) });
    };
    const W = utworzWypozyczalnie({ katalog: tmp, pisz });
    const book = { id: 'legende', title: 'Die Legende', subtitle: 'Hörprobe', language: 'de', pages: [
        { chapterTitle: 'Eins', narrativeText: 'Es war einmal eine Welt.', dialogueLines: [{ speaker: 'iskra', text: 'Warum?' }], audioUrl: '/wizytowka/teostory/legende/audio/audio-1.mp3' }] };
    const w = await W.publikuj({ book, rentalTier: 'demo' });
    assert.equal(w.kwestii, 2); assert.equal(w.jezyk, 'de'); assert.deepEqual(w.jezyki, ['de']);
    await assert.rejects(() => W.przeloz('legende', 'de'), /oryginału/);
    await assert.rejects(() => W.przeloz('legende', 'fr'), /Język/);
    await W.przeloz('legende', 'en');
    const p = await czekaj(W, 'legende');
    assert.equal(p.stan, 'gotowe', p.blad);
    assert.ok(prosby.some((x) => /rejected: kwestii 0 zamiast 1/.test(x)), 'poprawka niesie powód');
    const { ksiega } = await W.czytaj('legende');
    assert.equal(ksiega.translations.en.pages[0].dialogueLines[0].text, 'EN Warum?');
    assert.equal(ksiega.translations.en.title, 'EN Die Legende');
    assert.equal(ksiega.pages[0].audioUrl, '/wizytowka/teostory/legende/audio/audio-1.mp3', 'oryginał z nagraniami nietknięty');
    const kat = (await W.katalogPubliczny())[0];
    assert.deepEqual(kat.jezyki, ['de', 'en']); assert.equal(kat.przeklady.en.tytul, 'EN Die Legende');
    // ponowna publikacja oryginału: przekład, nagrania i liczba kwestii zostają
    const w2 = await W.publikuj({ book: ksiega, rentalTier: 'demo' });
    assert.deepEqual(w2.jezyki, ['de', 'en']);
    assert.equal((await W.czytaj('legende')).ksiega.pages[0].audioUrl, '/wizytowka/teostory/legende/audio/audio-1.mp3');
});

test('ilustracje Palety, podkład z biblioteki, sprawdzanie przekładu i próg Prologu', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'teostory-il-'));
    const png = path.join(tmp, 'kadr.png'); await fs.writeFile(png, 'PNG');
    const mp3 = path.join(tmp, 'joanna.mp3'); await fs.writeFile(mp3, 'MP3');
    const kadry = [];
    const W = utworzWypozyczalnie({ katalog: path.join(tmp, 'kat'), rysuj: async (o) => { kadry.push(o.prompt); return png; }, muzykaLokalna: (u) => (u === 'Aranże Joanny/joanna.mp3' ? mp3 : null) });
    await W.publikuj({ book: { id: 'teterhia', title: 'Teterhia', pages: [{ narrativeText: 'Nebel über dem Meer.', imageCaption: 'Nebel' }, { narrativeText: 'Ein Kater wartet.', imageUrl: 'https://x.example/a.png' }] }, rentalTier: 'rental_48h', cenaEur: 2.99 });
    await W.ilustruj('teterhia');
    assert.equal((await czekaj(W, 'teterhia')).stan, 'gotowe');
    assert.equal(kadry.length, 1, 'tylko strona bez obrazu');
    assert.match(kadry[0], /Nebel.*no halos, no crosses/);
    assert.equal((await W.katalogPelny())[0].okladka, '/wizytowka/teostory/teterhia/obraz/obraz-1.png', 'pierwszy kadr = okładka');
    assert.ok(W.plikObrazu('teterhia', 'obraz-1.png'));
    await assert.rejects(() => W.ustawMuzyke('teterhia', { plik: '../../etc/passwd' }), /mp3/);
    const m = await W.ustawMuzyke('teterhia', { plik: 'Aranże Joanny/joanna.mp3', tytul: 'Cienie Katedry', autor: 'Joanna' });
    assert.equal(m.musicUrl, '/wizytowka/teostory/teterhia/audio/muzyka.mp3');
    assert.ok(W.plikDzwieku('teterhia', 'muzyka.mp3'));
    assert.deepEqual((await W.katalogPelny())[0].muzyka, { tytul: 'Cienie Katedry', autor: 'Joanna' });
    const z = { chapterTitle: 'A', imageCaption: '', narrativeText: 'Ein langer Satz über die Welt.', lines: ['Hallo'] };
    assert.throws(() => sprawdzPrzekladStrony(z, { chapterTitle: 'A', narrativeText: 'x', lines: ['Hi'] }), /długości/);
    assert.equal(sprawdzPrzekladStrony(z, '<think>…</think>{"chapterTitle":"A","narrativeText":"A long sentence about the world.","lines":["Hello"]}').lines[0], 'Hello');
    assert.equal(liczKwestie({ pages: [{ narrativeText: 'Eine Seite.', dialogueLines: [{ text: 'Ja' }, { text: '' }] }] }), 2);
    assert.equal(MIN_KWESTII_PELNEJ, 20);
});

// 🔁 2026-11-09: „Ponowne otwarcie wrót / Wiederkehr” — po wygaśnięciu 48 h ta sama księga za połowę (2,99 → 1,49 €)
import { cenaPowrotu } from '../services/WypozyczalniaKsiag.js';
import { SCIEZKA_TEOSTORY as ST, SCIEZKA_WYPOZYCZENIA as SW } from '../services/StrazMostu.js';
test('powrót do księgi: wygasłe opłacone wypożyczenie tej księgi = 1,49 €, trwające / obce / fałszywe = pełna cena', async () => {
    assert.equal(cenaPowrotu(2.99), 1.49); assert.equal(cenaPowrotu(1.99), 0.99); assert.equal(cenaPowrotu(0.5), 0.5);
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'teostory-pw-'));
    let zegar = Date.parse('2026-11-09T10:00:00Z');
    const kwoty = [];
    const stripe = {
        sesjaZakupu: async (o) => { kwoty.push(o.kwotaCentow); return { id: `cs_${kwoty.length}`, url: 'https://checkout.stripe.com/c/pay/x' }; },
        sprawdzSesje: async (id) => ({ id, oplacona: id === 'cs_stara' || id === 'cs_inna', pakiet: id === 'cs_inna' ? 'inna-ksiega' : 'teterhia', rodzaj: 'ksiega-48h', powrot: null, kwota: 2.99, waluta: 'eur', tryb: 'live' }),
    };
    const W = utworzWypozyczalnie({ katalog: tmp, stripe, teraz: () => zegar });
    await W.publikuj({ book: { id: 'teterhia', title: 'Teterhia', pages: [{ narrativeText: 'Nebel über dem Meer.' }] }, rentalTier: 'rental_48h', cenaEur: 2.99 });
    assert.equal((await W.oferta('teterhia')).cenaEur, 2.99);
    await W.odbierz('cs_stara');                                     // pierwsze czytanie: start 48 h
    const trwa = await W.oferta('teterhia', { poprzednia: 'cs_stara' });
    assert.equal(trwa.cenaEur, 2.99); assert.match(trwa.powod, /jeszcze trwa/);
    zegar += 49 * 3600e3;                                            // 48 h minęło
    const p = await W.wypozycz('teterhia', { poprzednia: 'cs_stara' });
    assert.equal(p.cenaEur, 1.49); assert.equal(p.powrotDoKsiegi, true); assert.equal(kwoty.at(-1), 149);
    assert.equal((await W.wypozycz('teterhia', { poprzednia: 'cs_inna' })).cenaEur, 2.99, 'wypożyczenie innej księgi nie daje rabatu');
    assert.equal((await W.wypozycz('teterhia', { poprzednia: 'cs_falszywa' })).cenaEur, 2.99, 'nieopłacona sesja nie daje rabatu');
    assert.ok(SW.test('/wizytowka/teostory/teterhia/oferta') && ST.test('/wizytowka/teostory/teterhia/audio/muzyka.mp3') && !ST.test('/wizytowka/teostory/teterhia/audio/inne.mp3'));
});

test('🎭 media Opodysku: pliki jadą do księgi, demo czyta za darmo, wypożyczenie bez sesji = 402, zła nazwa = 404, Straż wpuszcza tylko białą listę', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wyp-media-'));
    const zrodlo = path.join(tmp, 'zrodlo'); await fs.mkdir(zrodlo, { recursive: true });
    await fs.writeFile(path.join(zrodlo, 'a.mp3'), 'AUDIO-1234'); await fs.writeFile(path.join(zrodlo, 'b.pdf'), '%PDF-test');
    const W = utworzWypozyczalnie({ katalog: path.join(tmp, 'teostory') });
    const app = express(); app.use(express.json()); zamontujTrasyWypozyczalni(app, W);
    const srv = app.listen(0); const baza = `http://127.0.0.1:${srv.address().port}`;
    const ksiega = (id, tier) => ({ id, title: `Księga ${id}`, author: 'A', pages: [{ chapterTitle: 'x', narrativeText: 'Dłuższy tekst narracji strony, żeby przeszło.', dialogueLines: [] }],
        opodysk: { bpm: 90, sekundy: 120, akty: [{ nr: 1, nazwa: 'Intro', od: 0, do: 30, wersy: [], obraz: null }] } });
    try {
        await W.publikuj({ book: ksiega('opo-demo-1', 'demo'), rentalTier: 'demo', cenaEur: 0, media: { 'piesn.mp3': path.join(zrodlo, 'a.mp3'), 'pergamin.pdf': path.join(zrodlo, 'b.pdf'), 'obcy.exe': path.join(zrodlo, 'a.mp3') } });
        await W.publikuj({ book: ksiega('opo-platna-1', 'rental_48h'), rentalTier: 'rental_48h', cenaEur: 1.99, media: { 'piesn.mp3': path.join(zrodlo, 'a.mp3') } });
        const kat = await (await fetch(`${baza}/wizytowka/teostory`)).json();
        assert.deepEqual(kat.ksiegi.find((x) => x.id === 'opo-demo-1').opodysk.media.sort(), ['pergamin.pdf', 'piesn.mp3'], 'lista mediów w katalogu, bez nieznanej nazwy');
        const m = await fetch(`${baza}/wizytowka/teostory/opo-demo-1/media/piesn.mp3`);
        assert.equal(m.status, 200); assert.equal(await m.text(), 'AUDIO-1234');
        assert.equal((await fetch(`${baza}/wizytowka/teostory/opo-demo-1/media/obcy.exe`)).status, 404);
        assert.equal((await fetch(`${baza}/wizytowka/teostory/opo-demo-1/media/canvas-fuzja.mp4`)).status, 404, 'brak pliku');
        assert.equal((await fetch(`${baza}/wizytowka/teostory/opo-platna-1/media/piesn.mp3`)).status, 402, 'płatna księga bez sesji');
        const czyt = await (await fetch(`${baza}/wizytowka/teostory/opo-demo-1/czytaj`)).json();
        assert.equal(czyt.ksiega.opodysk.bpm, 90); assert.equal(czyt.ksiega.opodysk.media.length, 2);
        assert.ok(SCIEZKA_TEOSTORY.test('/wizytowka/teostory/opo-demo-1/media/teledysk.mp4') && SCIEZKA_TEOSTORY.test('/wizytowka/teostory/opo-demo-1/media/canvas-fuzja.mp4'));
        assert.equal(SCIEZKA_TEOSTORY.test('/wizytowka/teostory/opo-demo-1/media/../../x.mp3'), false);
        assert.equal(SCIEZKA_TEOSTORY.test('/wizytowka/teostory/opo-demo-1/media/obcy.exe'), false);
    } finally { srv.close(); await fs.rm(tmp, { recursive: true, force: true }); }
});

test('🌍🎙️ przekład przeżywa ponowne złożenie księgi (ten sam tekst), znika po zmianie źródła; nagranie strony i wersu w przekładzie', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'teostory-pr2-'));
    const pisz = async (_s, prompt) => { const k = JSON.parse(prompt.split('\n\n')[0]); return JSON.stringify({ chapterTitle: k.chapterTitle && `PL ${k.chapterTitle}`, imageCaption: k.imageCaption && `PL ${k.imageCaption}`, narrativeText: k.narrativeText && `PL ${k.narrativeText}`, lines: k.lines.map((l) => `PL ${l}`) }); };
    const W = utworzWypozyczalnie({ katalog: path.join(tmp, 'teostory'), pisz });
    const mp3 = path.join(tmp, 'g.mp3'); await fs.writeFile(mp3, 'GLOS-PL');
    const nowa = (tekst) => ({ id: 'opo-pr', title: 'Opodysk', language: 'en', pages: [{ chapterTitle: 'Akt 1', narrativeText: tekst, dialogueLines: [{ speaker: 'elara', speakerLabel: 'Elara', text: 'Hold me close' }] }] });
    await W.publikuj({ book: nowa('The diner glows like a lantern at night.'), rentalTier: 'demo' });
    await W.przeloz('opo-pr', 'pl'); const p = await czekaj(W, 'opo-pr'); assert.equal(p.stan, 'gotowe', p.blad);
    await W.dodajAudioStrony('opo-pr', { jezyk: 'pl', strona: 0, plik: mp3 });
    await W.dodajAudioStrony('opo-pr', { jezyk: 'pl', strona: 0, wers: 0, plik: mp3 });
    await assert.rejects(() => W.dodajAudioStrony('opo-pr', { jezyk: 'pl', strona: 5, plik: mp3 }), /Nie ma takiej strony/);
    await assert.rejects(() => W.dodajAudioStrony('opo-pr', { jezyk: 'pl', strona: 0, plik: path.join(tmp, 'x.exe') }), /mp3/);
    let k = (await W.czytaj('opo-pr')).ksiega;
    assert.match(k.translations.pl.pages[0].audioUrl, /\/audio\/audio-\d+\.mp3$/); assert.match(k.translations.pl.pages[0].dialogueLines[0].audioUrl, /\/audio\/audio-\d+\.mp3$/);
    assert.equal(k.pages[0].audioUrl, undefined, 'oryginał bez zmian');
    assert.ok(W.plikDzwieku('opo-pr', k.translations.pl.pages[0].audioUrl.split('/').pop()), 'plik leży w księdze');
    // to samo źródło → przekład i nagrania zostają; zmiana tekstu → przekład znika (nie jedzie nieaktualny)
    await W.publikuj({ book: nowa('The diner glows like a lantern at night.'), rentalTier: 'demo' });
    k = (await W.czytaj('opo-pr')).ksiega; assert.ok(k.translations?.pl?.pages[0].audioUrl, 'przekład z nagraniem przetrwał');
    await W.publikuj({ book: nowa('A different story entirely.'), rentalTier: 'demo' });
    k = (await W.czytaj('opo-pr')).ksiega; assert.equal(k.translations, undefined, 'nieaktualny przekład odpada');
    await fs.rm(tmp, { recursive: true, force: true });
});
