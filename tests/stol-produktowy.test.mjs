// 🛍️ Stół Produktowy: paczka TeO Fashion Studio → 1-DO-SKLEPU-SHOPIFY / 2-DO-DRUKARNI-300DPI + shopify-import.csv (produkty fizyczne).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzStolProduktowy, czytajCsv } from '../services/StolProduktowy.js';
import { SCIEZKI_TYLKO_LOKALNE } from '../services/StrazMostu.js';

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
async function fashion() {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'stol-prod-'));
    const sklep = path.join(kat, 'fashion', 'public', 'nadruki', 'sklep', 'borowik');
    const opis = '<p><strong>Pumpkin Whisper</strong> — a "quiet" glow, warm, soft</p>\n<p>Second line.</p>';
    const csv = ['﻿Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Price,Status',
        `borowik-varsity-jacket-black,Borowik — Pumpkin Whisper · Varsity Jacket,"${opis.replace(/"/g, '""')}",0.00G Style,Varsity Jacket,"0.00G Style, Borowik",FALSE,Size,S,X-S,119.00,draft`,
        ...['M', 'L', 'XL', 'XXL'].map((r) => `borowik-varsity-jacket-black,,,,,,,Size,${r},X-${r},119.00,`),
        'borowik-tote-bag-black,Borowik — Tote,<p>Bag</p>,0.00G Style,Tote Bag,Borowik,FALSE,Size,S,T-S,,draft'].join('\r\n');
    await fs.mkdir(sklep, { recursive: true });
    await fs.writeFile(path.join(sklep, 'produkty.csv'), csv);
    for (const m of ['borowik-varsity-jacket-black', 'borowik-tote-bag-black']) {
        const d = path.join(sklep, m); await fs.mkdir(d);
        for (const p of ['podglad-przod.png', 'podglad-tyl.png', 'arkusz.png', 'strefa-tyl.png', 'druk-tyl-27x26.5cm-300dpi.png', 'druk-rekaw-l-1-5.2x4cm-300dpi.png']) await fs.writeFile(path.join(d, p), PNG);
        await fs.writeFile(path.join(d, 'WYMIARY-DRUKU.txt'), 'tyl: 27 × 26.5 cm');
    }
    return { S: utworzStolProduktowy({ katalogFashion: path.join(kat, 'fashion'), katalog: path.join(kat, 'sklep-shopify') }), cel: path.join(kat, 'sklep-shopify'), opis };
}

test('lista: QC z faktów paczki, produkt bez ceny niegotowy, strefy z wymiarami', async () => {
    const { S, opis } = await fashion();
    const { postacie } = await S.lista();
    assert.equal(postacie[0].gotowe, 1); assert.equal(postacie[0].wszystkie, 2);
    const v = postacie[0].produkty.find((x) => x.model === 'borowik-varsity-jacket-black');
    assert.equal(v.opisHtml, opis); assert.equal(v.cenaEur, 119);
    assert.deepEqual(v.druk.map((s) => [s.strefa, s.szer, s.wys]), [['rekaw-l-1', 5.2, 4], ['tyl', 27, 26.5]]);
    assert.deepEqual(postacie[0].produkty.find((x) => x.model === 'borowik-tote-bag-black').braki, ['cena']);
});

test('wyślij: dwa foldery, robocze pliki poza nimi, CSV fizycznych produktów (draft, S–XXL, wysyłka TRUE)', async () => {
    const { S, cel, opis } = await fashion();
    const w = await S.wyslij({ postac: 'borowik' });
    assert.equal(w.wyslane.length, 1); assert.equal(w.pominiete[0].model, 'borowik-tote-bag-black');
    const baza = path.join(cel, 'borowik', 'borowik-varsity-jacket-black');
    assert.deepEqual((await fs.readdir(path.join(baza, '1-DO-SKLEPU-SHOPIFY'))).sort(), ['WKLEJ-DO-SHOPIFY.txt', 'podglad-przod.png', 'podglad-tyl.png']);
    assert.deepEqual((await fs.readdir(path.join(baza, '2-DO-DRUKARNI-300DPI'))).sort(), ['WYMIARY-DRUKU.txt', 'druk-rekaw-l-1-5.2x4cm-300dpi.png', 'druk-tyl-27x26.5cm-300dpi.png']);
    const wklej = await fs.readFile(path.join(baza, '1-DO-SKLEPU-SHOPIFY', 'WKLEJ-DO-SHOPIFY.txt'), 'utf8');
    assert.match(wklej, /physical product/); assert.match(wklej, /119\.00 EUR/); assert.match(wklej, /NIE używaj „Digital product”/);
    const r = czytajCsv(await fs.readFile(path.join(cel, 'shopify-import.csv'), 'utf8'));
    assert.equal(r.length, 5);
    assert.deepEqual(r.map((x) => x['Option1 Value']), ['S', 'M', 'L', 'XL', 'XXL']);
    assert.equal(r[0]['Body (HTML)'], opis);   // przecinki, cudzysłowy i nowe linie przeżyły CSV
    assert.ok(r.every((x) => x['Variant Requires Shipping'] === 'TRUE' && x['Variant Price'] === '119.00'));
    assert.equal(r[0].Status, 'draft'); assert.equal(r[0]['Gift Card'], 'FALSE');
    assert.equal((await S.lista()).postacie[0].wyslane, 1);
    await assert.rejects(S.wyslij({ postac: 'borowik', model: 'borowik-tote-bag-black' }), /brakuje: cena/);
});

test('pliki: tylko makiety, druk i wymiary; Straż: tylko maszyna', async () => {
    const { S } = await fashion();
    assert.ok(S.plik('borowik', 'borowik-varsity-jacket-black', 'podglad-przod.png'));
    assert.equal(S.plik('borowik', 'borowik-varsity-jacket-black', 'strefa-tyl.png'), null);
    assert.equal(S.plik('borowik', '..', 'podglad-przod.png'), null);
    assert.ok(SCIEZKI_TYLKO_LOKALNE.some((p) => '/api/stol-produktowy/wyslij'.startsWith(p)));
});

// ── 🔄 synchronizacja i 🗓️ sezonowe dropy ──
import { utworzSezonoweDropy, najblizszeOkno, blackFriday, odczytajTeksty } from '../services/SezonoweDropy.js';

test('synchronizacja: produkt usunięty z Fashion znika z sklep-shopify i CSV; ręczny folder zostaje; torba = jeden wariant', async () => {
    const { S, cel } = await fashion();
    const sklep = path.join(path.dirname(cel), 'fashion', 'public', 'nadruki', 'sklep', 'borowik');
    const csv = (await fs.readFile(path.join(sklep, 'produkty.csv'), 'utf8')).replace(/borowik-tote-bag-black,Borowik — Tote,<p>Bag<\/p>,0.00G Style,Tote Bag,Borowik,FALSE,Size,S,T-S,,draft/, 'borowik-tote-bag-black,Borowik — Tote,<p>Bag</p>,0.00G Style,Tote Bag,Borowik,FALSE,Title,Default Title,T,29.00,draft');
    await fs.writeFile(path.join(sklep, 'produkty.csv'), csv);
    await fs.mkdir(path.join(cel, 'reczne moje'), { recursive: true }); await fs.writeFile(path.join(cel, 'reczne moje', 'x.png'), PNG);
    await S.wyslij({});
    let r = czytajCsv(await fs.readFile(path.join(cel, 'shopify-import.csv'), 'utf8'));
    assert.deepEqual(r.filter((x) => x.Handle === 'borowik-tote-bag-black').map((x) => [x['Option1 Name'], x['Option1 Value']]), [['Title', 'Default Title']]);
    // kolekcja torby usunięta w Fashion → nie ma jej w produkty.csv ani katalogu
    await fs.writeFile(path.join(sklep, 'produkty.csv'), csv.split(/\r?\n/).filter((l) => !l.startsWith('borowik-tote-bag-black')).join('\n'));
    await fs.rm(path.join(sklep, 'borowik-tote-bag-black'), { recursive: true });
    const w = await S.synchronizuj();
    assert.deepEqual(w.usuniete, ['borowik/borowik-tote-bag-black']);
    r = czytajCsv(await fs.readFile(path.join(cel, 'shopify-import.csv'), 'utf8'));
    assert.deepEqual([...new Set(r.map((x) => x.Handle))], ['borowik-varsity-jacket-black']);
    assert.ok((await fs.readdir(path.join(cel, 'reczne moje'))).includes('x.png'));
});

test('sezonowe: okna dat, Black Friday z Compare At, drop świąteczny z edycją Kronikarza tylko w fasonach sezonu', async () => {
    assert.equal(new Date(blackFriday(2026)).toISOString().slice(0, 10), '2026-11-27');
    assert.equal(new Date(blackFriday(2025)).toISOString().slice(0, 10), '2025-11-28');
    const t = Date.parse('2026-11-07T12:00:00Z');
    assert.equal(najblizszeOkno('swieta', t).od, '2026-12-01');
    assert.equal(najblizszeOkno('walentynki', t).od, '2027-02-01');
    assert.equal(najblizszeOkno('zima', Date.parse('2027-01-10T00:00:00Z')).dniDoStartu < 0, true);
    assert.throws(() => odczytajTeksty('{"produkty":{"a":{"tytul":"X","opis":"Only 19.99 EUR this week, hurry up!"}}}', ['a']), /ceny/);

    const { S, cel } = await fashion();
    await S.wyslij({});
    const prosby = [];
    const D = utworzSezonoweDropy({ katalog: cel, stol: S, teraz: () => t,
        pisz: async (_sys, prompt) => { prosby.push(prompt); return JSON.stringify({ produkty: { 'borowik-varsity-jacket-black': { tytul: 'Lantern of the First Snow', opis: 'Borowik carries a small lantern through the first snow, keeping the family light warm for everyone.' } } }); } });
    const bf = await D.przygotuj('black-friday', { rabat: 25 });
    assert.equal(bf.produktow, 1);   // torba bez ceny = niegotowa
    const rb = czytajCsv(await fs.readFile(path.join(cel, 'sezonowe', 'shopify-import-black-friday.csv'), 'utf8'));
    assert.equal(rb[0].Handle, 'borowik-varsity-jacket-black');
    assert.equal(rb[0]['Variant Compare At Price'], '119.00'); assert.equal(rb[0]['Variant Price'], '89.25');
    assert.match(rb[0].Tags, /Seasonal, Black_Friday_Drop/);
    const sw = await D.przygotuj('swieta');
    assert.equal(sw.produktow, 1); assert.equal(prosby.length, 1); assert.match(prosby[0], /borowik-varsity-jacket-black/);
    const rs = czytajCsv(await fs.readFile(path.join(cel, 'sezonowe', 'shopify-import-swieta.csv'), 'utf8'));
    assert.equal(rs[0].Handle, 'borowik-varsity-jacket-black-swieta');
    assert.match(rs[0].Title, /Lantern of the First Snow · Varsity Jacket/);
    assert.match(rs[0]['Body (HTML)'], /Christmas Edition/); assert.equal(rs[0]['Variant Compare At Price'], '');
    await D.przygotuj('swieta'); assert.equal(prosby.length, 1);   // tekst zapisany — bez drugiego wołania modelu
    await assert.rejects(D.przygotuj('lato'), /Nie ma gotowych produktów/);   // lato: koszulki, longsleeve, torby — tu brak
    const stan = await D.stan();
    assert.equal(stan.sezony.find((x) => x.id === 'swieta').csv, 'sezonowe/shopify-import-swieta.csv');
});
