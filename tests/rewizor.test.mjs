/**
 * Testy Rewizora Mostu + niezmienniki repo, które MUSZĄ trzymać, żeby most wstał.
 * Uruchom: `npm test` (node:test, bez zależności).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    maskuj, wyciagnijTrasy, duplikaty, wzorTrasy, wyciagnijWywolania, znajdzTrase,
    wyciagnijImporty, wyciagnijEksporty, wyciagnijImportyNazwane, wyciagnijSciezkiWs,
    prefiksyProxy, plikiSerwera, rewizja,
} from '../scripts/rewizor/analiza.mjs';
import { planSondy, sonduj, werdykt } from '../scripts/rewizor/sonda.mjs';

const KORZEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('maskuj', () => {
    test('zaślepia komentarze, zachowuje długość i linie', () => {
        const src = "a(); // app.get('/api/x')\n/* app.get('/api/y') */ b();";
        const m = maskuj(src);
        assert.equal(m.length, src.length);
        assert.equal(m.split('\n').length, 2);
        assert.ok(!m.includes('/api/'));
        assert.ok(m.includes('a();') && m.includes('b();'));
    });
    test('z { szablony: true } zaślepia tekst szablonu, ale nie kod w ${}', () => {
        const m = maskuj("const s = `import App from './App'; ${f('./x')}`;", { szablony: true });
        assert.ok(!m.includes('./App'));
        assert.ok(m.includes("f('./x')"));
    });
    test('literał regex z cudzysłowem nie rozjeżdża reszty pliku', () => {
        const m = maskuj("const r = /'/g;\n// komentarz\nx();");
        assert.ok(!m.includes('komentarz'));
        assert.ok(m.includes('x();'));
    });
    test('dzielenie nie jest brane za regex', () => {
        const m = maskuj('const a = b / c; // koniec\nd();');
        assert.ok(!m.includes('koniec'));
        assert.ok(m.includes('d();'));
    });
});

describe('trasy', () => {
    const src = [
        "app.get('/api/a', h);",
        "app.post(\"/api/b/:id\", h);",
        "// app.get('/api/zakomentowana', h);",
        "app.use('/api/prefiks', h);",
        "app.use('/music', h);",
        "app.get('/api/a', h2);",
    ].join('\n');
    const trasy = wyciagnijTrasy(src);

    test('wyciąga trasy i prefiksy /api, pomija komentarze i statyki', () => {
        assert.deepEqual(trasy.map((t) => `${t.metoda} ${t.sciezka}`),
            ['get /api/a', 'post /api/b/:id', 'use /api/prefiks', 'get /api/a']);
        assert.equal(trasy[3].linia, 6);
    });
    test('wykrywa duplikat metody + ścieżki', () => {
        assert.deepEqual(duplikaty(trasy), [{ klucz: 'GET /api/a', linie: [1, 6] }]);
    });
    test('wzorTrasy: parametry i prefiksy', () => {
        assert.ok(wzorTrasy({ sciezka: '/api/b/:id' }).test('/api/b/X'));
        assert.ok(!wzorTrasy({ sciezka: '/api/b/:id' }).test('/api/b/X/y'));
        assert.ok(wzorTrasy({ sciezka: '/api/prefiks', prefiks: true }).test('/api/prefiks/cokolwiek/dalej'));
    });
    test('ścieżki WebSocket z obsługi upgrade', () => {
        const ws = wyciagnijSciezkiWs("if (pathname === '/api/ws1') {}\nif (url.pathname !== '/api/ws2') return;");
        assert.deepEqual(ws.map((w) => w.sciezka), ['/api/ws1', '/api/ws2']);
    });
});

describe('wywołania klienta', () => {
    test('goły literał, ${MOST}, pełny adres mostu', () => {
        const src = "fetch('/api/a'); fetch(`${MOST}/api/b/${id}`); fetch('http://127.0.0.1:3001/api/c');";
        assert.deepEqual(wyciagnijWywolania(src).map((w) => w.sciezka), ['/api/a', '/api/b/X', '/api/c']);
    });
    test('Ollama i obce hosty nie są mostem', () => {
        const src = "const ollamaBase = 'http://127.0.0.1:11434';\nfetch(`${ollamaBase}/api/tags`); fetch('https://api.coingecko.com/api/v3/x');";
        assert.deepEqual(wyciagnijWywolania(src), []);
    });
    test('zmienna rozpoznana po definicji', () => {
        const src = "const base = 'http://localhost:11434';\nfetch(`${base}/api/generate`);";
        assert.deepEqual(wyciagnijWywolania(src), []);
    });
    test('w serwisie Node goły /api/ to cudze API, ${MOST} to most', () => {
        const src = "zapytaj('/api/status'); fetch(`${MOST}/api/wiedza/raport`);";
        assert.deepEqual(wyciagnijWywolania(src, { serwer: true }).map((w) => w.sciezka), ['/api/wiedza/raport']);
    });
    test('query doklejone ${} odcięte, komentarz pominięty, prefiks z ukośnikiem', () => {
        const src = "fetch(`/api/tunel${q}`);\n// fetch('/api/w-komentarzu')\nconst P = ['/api/forge/'];";
        const w = wyciagnijWywolania(src);
        assert.deepEqual(w.map((x) => [x.sciezka, x.prefiks]), [['/api/tunel', false], ['/api/forge', true]]);
    });
    test('jawny wyjątek // rewizor: poza-mostem pomija całą linię', () => {
        const src = "const a = ['/api/kadry', '/api/wykuj']; // rewizor: poza-mostem (Dział Mody)\nfetch('/api/b');";
        assert.deepEqual(wyciagnijWywolania(src).map((w) => w.sciezka), ['/api/b']);
    });
    test('prefiksy proxy Vite są pomijane', () => {
        const pomin = prefiksyProxy("proxy: { '/api/suno': { target: 'https://x' } }");
        assert.deepEqual(pomin, ['/api/suno']);
        assert.deepEqual(wyciagnijWywolania("fetch('/api/suno/api/generate')", { pominPrefiksy: pomin }), []);
    });
    test('dopasowanie do tras (z parametrem i prefiksem)', () => {
        const wzory = [{ sciezka: '/api/b/:id' }, { sciezka: '/api/forge/stories' }].map((trasa) => ({ trasa, re: wzorTrasy(trasa) }));
        assert.ok(znajdzTrase('/api/b/X', wzory));
        assert.ok(znajdzTrase({ sciezka: '/api/forge', prefiks: true }, wzory));
        assert.equal(znajdzTrase('/api/nie-ma', wzory), null);
    });
});

describe('importy i eksporty', () => {
    test('importy względne, ale nie te z tekstu szablonu', () => {
        const src = "import a from './a.js';\nconst x = await import('../b.js');\nconst t = `import App from './App';`;";
        assert.deepEqual(wyciagnijImporty(src).map((i) => i.cel), ['./a.js', '../b.js']);
    });
    test('eksporty: funkcje, stałe, listy, default; export * → null', () => {
        const e = wyciagnijEksporty('export async function f() {}\nexport const A = 1;\nfunction g() {}\nexport { g as h };\nexport default {};');
        assert.deepEqual([...e].sort(), ['A', 'default', 'f', 'h']);
        assert.equal(wyciagnijEksporty("export * from './x.js';"), null);
    });
    test('nazwy oczekiwane od importu', () => {
        const i = wyciagnijImportyNazwane("import D, { a, b as c,\n  d } from './m.js';\nimport * as N from './n.js';");
        assert.deepEqual(i, [{ cel: './m.js', nazwy: ['default', 'a', 'b', 'd'], linia: 1 }]);
    });
});

describe('sonda żywa', () => {
    test('werdykty', () => {
        assert.equal(werdykt(200), 'ZYWA');
        assert.equal(werdykt(400), 'ODMAWIA');
        assert.equal(werdykt(404), 'BRAK_DANYCH');
        assert.equal(werdykt(404, { expressNieZna: true }), 'ZNIKNELA');
        assert.equal(werdykt(503), 'ZALEZNOSC_SPI');
        assert.equal(werdykt(500), 'AWARIA');
        assert.equal(werdykt(null), 'MILCZY');
    });
    test('plan pomija ruchliwe, wrażliwe, parametryczne i nie-GET', () => {
        const src = [
            "app.get('/api/stan', (q, r) => r.json({}));",
            "app.get('/api/zapis', async (q, r) => { await fs.writeFile('x', ''); });",
            "app.get('/api/straz/klucz', (q, r) => r.json({}));",
            "app.get('/api/x/:id', (q, r) => r.json({}));",
            "app.post('/api/post', (q, r) => r.json({}));",
        ].join('\n');
        const plan = planSondy(src, wyciagnijTrasy(src));
        assert.deepEqual(plan.sondowane.map((t) => t.sciezka), ['/api/stan']);
        assert.deepEqual(plan.pominiete.map((t) => t.sciezka).sort(), ['/api/straz/klucz', '/api/zapis']);
    });
    test('puka do prawdziwego serwera HTTP i rozróżnia odpowiedzi', async () => {
        const serwer = http.createServer((req, res) => {
            if (req.url === '/wiesio/ping' || req.url === '/ok') return res.end('ok');
            if (req.url === '/pada') { res.statusCode = 500; return res.end(); }
            if (req.url === '/brak') { res.statusCode = 404; res.setHeader('content-type', 'application/json'); return res.end('{}'); }
            if (req.url === '/milczy') return;                         // nigdy nie odpowiada
            res.statusCode = 404; res.setHeader('content-type', 'text/html');
            res.end(`<pre>Cannot GET ${req.url}</pre>`);
        });
        await new Promise((ok) => serwer.listen(0, '127.0.0.1', ok));
        const baza = `http://127.0.0.1:${serwer.address().port}`;
        try {
            const trasy = ['/ok', '/pada', '/brak', '/milczy', '/nieznana'].map((sciezka) => ({ sciezka }));
            const r = await sonduj({ baza, trasy, limitMs: 300 });
            assert.equal(r.mostZyje, true);
            assert.deepEqual(Object.fromEntries(r.wyniki.map((w) => [w.sciezka, w.werdykt])), {
                '/ok': 'ZYWA', '/pada': 'AWARIA', '/brak': 'BRAK_DANYCH', '/milczy': 'MILCZY', '/nieznana': 'ZNIKNELA',
            });
        } finally {
            serwer.closeAllConnections();
            serwer.close();
        }
    });
    test('martwy most: zgłasza brak życia zamiast listy porażek', async () => {
        const r = await sonduj({ baza: 'http://127.0.0.1:9', trasy: [{ sciezka: '/x' }] });
        assert.equal(r.mostZyje, false);
        assert.deepEqual(r.wyniki, []);
    });
});

// ── Niezmienniki repo: bez nich most nie wstanie ─────────────────────────────
describe('repo: most i serwisy', () => {
    test('każdy plik serwera przechodzi `node --check`', () => {
        const zle = [];
        for (const plik of plikiSerwera(KORZEN)) {
            try { execFileSync(process.execPath, ['--check', plik], { stdio: 'pipe' }); }
            catch (e) { zle.push(`${path.relative(KORZEN, plik)}: ${String(e.stderr).split('\n').find((l) => /Error/.test(l))}`); }
        }
        assert.deepEqual(zle, []);
    });
    const r = rewizja(KORZEN);
    test('most wystawia trasy (analiza coś widzi)', () => {
        assert.ok(r.trasy.length > 100, `tylko ${r.trasy.length} tras — parser się rozjechał?`);
    });
    test('żaden import względny nie wskazuje na nieistniejący plik', () => {
        assert.deepEqual(r.martweImporty, []);
    });
    test('każda importowana nazwa jest eksportowana przez swój moduł', () => {
        assert.deepEqual(r.brakujaceEksporty, []);
    });
    test('żadna trasa nie jest zarejestrowana dwa razy', () => {
        assert.deepEqual(r.duplikaty, []);
    });
    test('klient nie woła tras, których most nie ma', () => {
        assert.deepEqual(r.osierocone.map((o) => `${o.plik}:${o.linia} ${o.surowa}`), []);
    });
});
