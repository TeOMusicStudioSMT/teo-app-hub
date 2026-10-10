// 🌍 Tłumacz w apkach Pierścienia: rdzeń (lib/tlumaczRdzen.js), origin Huba, wstrzykiwanie skryptu w HTML mostu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { doTlumaczenia, czyOriginKatedry, kodJezyka } from '../lib/tlumaczRdzen.js';
import { wstrzyknijTlumacza, htmlZTlumaczem } from '../services/TlumaczApek.js';

const KORZEN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('filtr tekstów: słowa tak, adresy/pliki/hashe/liczby nie', () => {
    assert.equal(doTlumaczenia('Zapisz projekt'), true);
    assert.equal(doTlumaczenia('  Galeria  '), true);
    for (const t of ['42', 'https://otakos.wtf', '/api/tlumacz', 'model.glb.json', 'a1b2c3d4e5', 'src/gra/postac.ts', 'x', 'GDD']) assert.equal(doTlumaczenia(t), false, t);
    assert.equal(doTlumaczenia('MENU'), true);
});

test('origin Huba: tylko ta maszyna albo origin mostu', () => {
    for (const o of ['http://localhost:5173', 'http://127.0.0.1:3001', 'http://[::1]:5177', 'https://localhost']) assert.equal(czyOriginKatedry(o, 'http://127.0.0.1:3001'), true, o);
    for (const o of ['https://zla.strona', 'http://localhost.zla.pl', 'null', 'file:///C:/x.html', '', undefined]) assert.equal(czyOriginKatedry(o, 'http://127.0.0.1:3001'), false, String(o));
    assert.equal(czyOriginKatedry('https://katedra.graviton.pw', 'https://katedra.graviton.pw'), true);
    assert.equal(czyOriginKatedry('https://inna.pw', 'https://katedra.graviton.pw'), false);
});

test('kod języka jak w moście', () => {
    assert.equal(kodJezyka('en'), 'en');
    assert.equal(kodJezyka('pt-BR'), 'pt-BR');
    for (const k of ['', 'english', '<x>', null, 3]) assert.equal(kodJezyka(k), null);
});

test('wstrzykiwanie: przed </head>, bez dubla, bez head → body / początek', () => {
    const tag = '<script type="module" src="/tlumacz.js"></script>';
    assert.equal(wstrzyknijTlumacza('<html><head><title>A</title></head><body></body></html>'), `<html><head><title>A</title>${tag}</head><body></body></html>`);
    const juz = '<head><script type="module" src="http://127.0.0.1:3001/tlumacz.js"></script></head>';
    assert.equal(wstrzyknijTlumacza(juz), juz);
    assert.equal(wstrzyknijTlumacza('<body class="x"><p>a</p></body>'), `<body class="x">${tag}<p>a</p></body>`);
    assert.equal(wstrzyknijTlumacza('<p>a</p>'), `${tag}<p>a</p>`);
});

test('middleware mostu: index.html i .html z tłumaczem, reszta i ucieczki do static', async () => {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-apek-'));
    fs.writeFileSync(path.join(kat, 'index.html'), '<head></head><body>Gra</body>');
    fs.writeFileSync(path.join(kat, 'app.js'), 'x');
    const mw = htmlZTlumaczem(kat);
    const wolaj = (sciezka, originalUrl = sciezka, method = 'GET') => new Promise((ok) => {
        const res = { naglowki: {}, set(k, v) { this.naglowki[k] = v; return this; }, type(t) { this.typ = t; return this; }, send(b) { ok({ wyslane: b, typ: this.typ }); } };
        void mw({ method, path: sciezka, originalUrl }, res, () => ok({ dalej: true }));
    });
    assert.match((await wolaj('/', '/apki/gra/')).wyslane, /src="\/tlumacz\.js"/);
    assert.match((await wolaj('/index.html')).wyslane, /tlumacz\.js/);
    assert.deepEqual(await wolaj('/', '/apki/gra'), { dalej: true });   // static przekieruje na „/”
    assert.deepEqual(await wolaj('/app.js'), { dalej: true });
    assert.deepEqual(await wolaj('/brak.html'), { dalej: true });
    assert.deepEqual(await wolaj('/../../sekret.html'), { dalej: true });
    assert.deepEqual(await wolaj('/', '/x/', 'POST'), { dalej: true });
});

test('rdzeń w przeglądarce: tłumaczy tekst i atrybuty, pomija kod/translate=no/[data-bez-tlumaczenia], „pl” przywraca', async (t) => {
    let puppeteer;
    try { puppeteer = (await import('puppeteer')).default; } catch { t.skip('brak puppeteera'); return; }
    let przegladarka;
    try { przegladarka = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] }); } catch (e) { t.skip(`przeglądarka nie wstała: ${e.message}`); return; }
    try {
        const strona = await przegladarka.newPage();
        await strona.setContent(`<html><body>
            <h1>Zapisz projekt</h1><button title="Otwórz galerię">Galeria</button><input placeholder="Szukaj w nazwie">
            <code>Zapisz projekt</code><p translate="no">Galeria</p><div data-bez-tlumaczenia>Galeria</div></body></html>`);
        const rdzen = fs.readFileSync(path.join(KORZEN, 'lib', 'tlumaczRdzen.js'), 'utf8');
        await strona.evaluate(async (kod) => {
            const url = URL.createObjectURL(new Blob([kod], { type: 'text/javascript' }));
            const m = await import(url);
            const SLOWNIK = { 'Zapisz projekt': 'Save project', 'Otwórz galerię': 'Open gallery', Galeria: 'Gallery', 'Szukaj w nazwie': 'Search by name' };
            window.wyslane = [];
            const pobierz = async (adres, o) => {
                if (o?.method === 'POST') {
                    const { teksty } = JSON.parse(o.body); window.wyslane.push(...teksty);
                    return { ok: true, json: async () => ({ success: true, mapa: Object.fromEntries(teksty.filter((x) => SLOWNIK[x]).map((x) => [x, SLOWNIK[x]])) }) };
                }
                return { ok: true, json: async () => ({ success: true, slownik: {} }) };
            };
            window.tl = m.utworzTlumacza({ most: 'http://most.test', pamiec: null, pobierz });
            await window.tl.ustawJezyk('en');
        }, rdzen);
        await strona.waitForFunction(() => document.querySelector('h1').textContent === 'Save project', { timeout: 5000 });
        const po = await strona.evaluate(() => ({
            h1: document.querySelector('h1').textContent, btn: document.querySelector('button').textContent, title: document.querySelector('button').title,
            ph: document.querySelector('input').placeholder, code: document.querySelector('code').textContent,
            no: document.querySelector('[translate=no]').textContent, bez: document.querySelector('[data-bez-tlumaczenia]').textContent,
            lang: document.documentElement.lang, wyslane: window.wyslane,
        }));
        assert.equal(po.h1, 'Save project');
        assert.equal(po.btn, 'Gallery');
        assert.equal(po.title, 'Open gallery');
        assert.equal(po.ph, 'Search by name');
        assert.equal(po.code, 'Zapisz projekt');
        assert.equal(po.no, 'Galeria');
        assert.equal(po.bez, 'Galeria');
        assert.equal(po.lang, 'en');
        // React dopisuje nowy polski tekst → obserwator go łapie.
        await strona.evaluate(() => { const p = document.createElement('p'); p.id = 'nowy'; p.textContent = 'Galeria'; document.body.append(p); });
        await strona.waitForFunction(() => document.querySelector('#nowy').textContent === 'Gallery', { timeout: 5000 });
        await strona.evaluate(() => window.tl.ustawJezyk('pl'));
        assert.deepEqual(await strona.evaluate(() => [document.querySelector('h1').textContent, document.querySelector('button').title, document.querySelector('#nowy').textContent]), ['Zapisz projekt', 'Otwórz galerię', 'Galeria']);
    } finally { await przegladarka.close(); }
});
