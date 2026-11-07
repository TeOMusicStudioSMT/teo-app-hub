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
        'borowik-varsity-jacket-black,,,,,,,Size,M,X-M,119.00,',
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
