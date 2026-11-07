// 🖨️🔄 Printful Sync + bestsellery w Stole Produktowym: kopia paczki Fashion, CSV bestsellerów, synchronizacja wariantów po SKU
// (atrapa API Printful — prawdziwego tokenu w teście nie ma), publiczny link do pliku tylko z tokenem i tylko z folderu bestsellerów.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzPrintful, SCIEZKA_PLIKU, FOLDER_BESTSELLERY } from '../services/PrintfulSync.js';
import { utworzStolProduktowy, czytajCsv } from '../services/StolProduktowy.js';
import { SCIEZKA_PRINTFUL, czyWizytowka } from '../services/StrazMostu.js';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');
const MANIFEST = {
    postac: 'pecherzik', imie: 'Pęcherzik', kiedy: '2026-11-07T20:00:00.000Z', zrodloWymiarow: { 279: 'orientacyjne' },
    produkty: [
        { klucz: 'aop-plecak', katalogId: 279, nazwaPrintful: 'All-Over Print Backpack', tytul: 'Pęcherzik — All-Over Backpack · 0.00G Style', typ: 'Bags', aop: true, opcja: 'Title',
            warianty: [{ wartosc: 'One size', variantId: 9063, cenaEur: 89, sku: 'PECHERZIK-AOP-PLECAK-ONE-SIZE', pliki: { default: 'aop-plecak/default-4200x5400.png', top: 'aop-plecak/top-4200x1500.png' } }] },
        { klucz: 'naklejki', katalogId: 358, nazwaPrintful: 'Kiss-Cut Stickers', tytul: 'Pęcherzik — Kiss-Cut Sticker · 0.00G Style', typ: 'Stickers', aop: false, opcja: 'Size',
            warianty: [{ wartosc: '3″×3″', variantId: 10163, cenaEur: 5.9, sku: 'PECHERZIK-NAKLEJKI-3-3', pliki: { default: 'naklejki/default-1650x1650.png' } },
                { wartosc: '4″×4″', variantId: 10164, cenaEur: 6.9, sku: 'PECHERZIK-NAKLEJKI-4-4', pliki: { default: 'naklejki/default-1650x1650.png' } }] },
    ],
};

async function swiat() {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'printful-'));
    const bs = path.join(kat, 'fashion', 'public', 'nadruki', 'bestsellery', 'pecherzik');
    for (const f of ['aop-plecak/default-4200x5400.png', 'aop-plecak/top-4200x1500.png', 'aop-plecak/stary-100x100.png', 'naklejki/default-1650x1650.png']) {
        await fs.mkdir(path.dirname(path.join(bs, f)), { recursive: true }); await fs.writeFile(path.join(bs, f), PNG);
    }
    await fs.writeFile(path.join(bs, 'produkty.json'), JSON.stringify(MANIFEST));
    await fs.writeFile(path.join(bs, 'CZYTAJ.txt'), 'czytaj');
    const brand = path.join(kat, 'fashion', 'public', 'nadruki', 'brand');
    await fs.mkdir(brand, { recursive: true });
    await fs.writeFile(path.join(brand, 'logo-0.00g-style.png'), PNG);
    await fs.writeFile(path.join(brand, 'baner-seo-social-1200x628.png'), PNG);
    await fs.writeFile(path.join(brand, 'obcy.png'), PNG);
    const sklep = path.join(kat, 'sklep-shopify');
    return { kat, sklep, S: utworzStolProduktowy({ katalogFashion: path.join(kat, 'fashion'), katalog: sklep }) };
}

/** Atrapa api.printful.com: sklep Shopify, jeden niezsynchronizowany produkt z dwoma wariantami Katedry i jednym obcym. */
function atrapa() {
    const wywolania = [];
    const f = async (url, o = {}) => {
        const u = new URL(url), m = o.method ?? 'GET';
        wywolania.push({ m, p: u.pathname + u.search, h: o.headers, cialo: o.body ? JSON.parse(o.body) : null });
        const ok = (result) => ({ ok: true, status: 200, json: async () => ({ code: 200, result }) });
        if (o.headers?.Authorization !== 'Bearer tok_printful_1234567890abcdef') return { ok: false, status: 401, json: async () => ({ code: 401, error: { message: 'Unauthorized' } }) };
        if (u.pathname === '/stores') return ok([{ id: 11, name: 'Inny', type: 'native' }, { id: 22, name: 'teo-mas', type: 'shopify' }]);
        if (u.pathname === '/mockup-generator/printfiles/279') return ok({ product_id: 279, available_placements: { default: 'Front', top: 'Top' }, printfiles: [{ printfile_id: 5, width: 3000, height: 4000, dpi: 150 }], variant_printfiles: [{ variant_id: 9063, placements: { default: 5, top: 5 } }] });
        if (u.pathname === '/sync/products') return ok([{ id: 900, name: 'Pęcherzik — Kiss-Cut Sticker', variants: 3, synced: 0, is_ignored: true }, { id: 901, name: 'Gotowy', variants: 2, synced: 2 }]);
        if (u.pathname === '/sync/products/900') return ok({ sync_product: { id: 900 }, sync_variants: [
            { id: 1, name: '3x3', sku: 'pecherzik-naklejki-3-3', synced: false },
            { id: 2, name: '4x4', sku: 'PECHERZIK-NAKLEJKI-4-4', synced: false },
            { id: 3, name: 'obcy', sku: 'COS-INNEGO', synced: false }] });
        if (m === 'PUT' && u.pathname.startsWith('/sync/variant/')) return ok({ id: Number(u.pathname.split('/').pop()) });
        return { ok: false, status: 404, json: async () => ({ code: 404, result: 'Not found' }) };
    };
    return { f, wywolania };
}

test('Stół: synchronizacja kopiuje bestsellery (tylko pliki z manifestu) i markę, pisze CSV bestsellerów', async () => {
    const { S, sklep } = await swiat();
    const w = await S.synchronizuj();
    assert.deepEqual(w.bestsellery.skopiowane, ['pecherzik']);
    assert.deepEqual(w.bestsellery.brand.sort(), ['baner-seo-social-1200x628.png', 'logo-0.00g-style.png']);
    const cel = path.join(sklep, 'pecherzik', FOLDER_BESTSELLERY);
    assert.deepEqual((await fs.readdir(path.join(cel, 'aop-plecak'))).sort(), ['default-4200x5400.png', 'top-4200x1500.png']);
    const csv = czytajCsv(await fs.readFile(path.join(sklep, 'shopify-import-bestsellery.csv'), 'utf8'));
    assert.equal(csv.length, 3);
    assert.equal(csv[0].Handle, 'pecherzik-aop-plecak');
    assert.equal(csv[0]['Option1 Name'], 'Title'); assert.equal(csv[0]['Option1 Value'], 'Default Title');
    assert.equal(csv[0]['Variant Requires Shipping'], 'TRUE'); assert.equal(csv[0].Status, 'draft');
    assert.equal(csv[1]['Variant SKU'], 'PECHERZIK-NAKLEJKI-3-3'); assert.equal(csv[2]['Variant Price'], '6.90');
    // drugi raz bez zmian manifestu = bez kopiowania
    assert.deepEqual((await S.synchronizuj()).bestsellery.skopiowane, []);
    const l = await S.listaBestsellerow();
    assert.equal(l.bestsellery[0].produkty.length, 2);
    assert.ok(S.plikBestsellera('pecherzik', 'naklejki', 'default-1650x1650.png'));
    assert.equal(S.plikBestsellera('pecherzik', 'naklejki', '../../../x.png'), null);
    assert.ok(S.plikBestsellera('brand', '-', 'logo-0.00g-style.png'));
});

test('Printful: token sprawdzony przed zapisem, sklep Shopify wybrany sam, szablony ze schowka', async () => {
    const { kat } = await swiat();
    const { f, wywolania } = atrapa();
    let zapisany = null;
    const P = utworzPrintful({ katalog: path.join(kat, 'sklep-shopify'), wymiar: path.join(kat, 'printful'), token: async () => zapisany, zapiszToken: async (t) => { zapisany = t; }, adres: async () => null, fetch: f });
    await assert.rejects(P.ustawToken('zly_token_aaaaaaaaaaaaaaaaaaaa'), /odrzucił/);
    assert.equal(zapisany, null);
    const s = await P.ustawToken('tok_printful_1234567890abcdef');
    assert.equal(s.polaczony, true); assert.equal(s.sklep.id, 22);
    const pf = await P.printfiles(279);
    assert.equal(pf.warianty['9063'].default, 5); assert.equal(pf.printfiles[0].width, 3000);
    const ile = wywolania.length;
    await P.printfiles(279);
    assert.equal(wywolania.length, ile, 'drugi raz ze schowka');
    assert.equal(wywolania.find((x) => x.p.startsWith('/mockup')).h['X-PF-Store-Id'], '22');
});

test('Printful: synchronizacja po SKU — wariant katalogu, cena, pliki przez tunel; obcy SKU pominięty; bez tunelu odmowa', async () => {
    const { kat, S } = await swiat();
    await S.synchronizuj();
    const { f, wywolania } = atrapa();
    let tunel = null;
    const P = utworzPrintful({ katalog: path.join(kat, 'sklep-shopify'), wymiar: path.join(kat, 'printful'), token: async () => 'tok_printful_1234567890abcdef', adres: async () => tunel, fetch: f, czekaj: async () => {} });
    await assert.rejects(P.synchronizuj(), /tunel/);
    tunel = 'https://katedra.otakos.wtf/';
    await P.synchronizuj();
    for (let i = 0; i < 50 && P.stanZadania().stan === 'robi'; i++) await new Promise((r) => setTimeout(r, 10));
    const z = P.stanZadania();
    assert.equal(z.stan, 'gotowe', z.powod);
    assert.equal(z.zrobione.length, 2);
    assert.equal(z.pominiete.length, 1); assert.match(z.pominiete[0].powod, /COS-INNEGO/);
    const put = wywolania.filter((x) => x.m === 'PUT');
    assert.equal(put.length, 2, 'zsynchronizowany produkt 901 nietknięty');
    assert.deepEqual(put[0].cialo.variant_id, 10163);
    assert.equal(put[0].cialo.retail_price, '5.90');
    assert.equal(put[0].cialo.is_ignored, false, 'zaimportowany z Shopify (ignorowany) zostaje przypisany');
    const url = put[0].cialo.files[0].url;
    assert.equal(put[0].cialo.files[0].type, 'default');
    assert.match(url, /^https:\/\/katedra\.otakos\.wtf\/wizytowka\/printful\/[0-9a-f]{32}\.png$/);
    // ten sam plik = ten sam link; link prowadzi do pliku, zły token nie
    assert.equal(put[1].cialo.files[0].url, url);
    const sciezka = new URL(url).pathname;
    assert.ok(SCIEZKA_PLIKU.test(sciezka) && SCIEZKA_PRINTFUL.test(sciezka));
    assert.ok(czyWizytowka({ method: 'GET', path: sciezka }));
    assert.equal(czyWizytowka({ method: 'POST', path: sciezka }), false);
    const tok = SCIEZKA_PLIKU.exec(sciezka)[1];
    assert.match(await P.plikZLinku(tok), /default-1650x1650\.png$/);
    assert.equal(await P.plikZLinku('0'.repeat(32)), null);
});

test('Printful: bez tokenu — stan mówi powód, zapytania odmawiają', async () => {
    const { kat } = await swiat();
    const P = utworzPrintful({ katalog: path.join(kat, 'sklep-shopify'), wymiar: path.join(kat, 'printful'), token: async () => null, adres: async () => null, fetch: atrapa().f });
    assert.equal((await P.stan()).polaczony, false);
    await assert.rejects(P.printfiles(279), /Brak tokenu/);
});
