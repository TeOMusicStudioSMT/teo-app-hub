// 🎮 MCP Game Studio — serwer stdio na atrapie mostu (lista narzędzi, grupy, wywołania, zgody, zrzut jako obraz),
// trasy mostu: walidacja przed zapisem (Recenzent + atrapa tsc na kopii projektu) i test gry (atrapa AppStudio), Straż.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { utworzSerwer, grupyZ, NARZEDZIA, GRUPY, skroc } from '../scripts/mcp/game-studio.mjs';
import { utworzStudioMcp, zamontujTrasyStudiaMcp, sciezkaPlikuGry, bledyTsc } from '../services/GameStudioMcp.js';
import * as Recenzent from '../services/RecenzentKodeksa.js';
import { strazMostu } from '../services/StrazMostu.js';
import * as Glowny from '../services/Glowny.js';

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

/** Atrapa mostu: kilka prawdziwych kształtów odpowiedzi, zapis wołań. */
async function atrapaMostu() {
    const wolania = [];
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { wolania.push(`${req.method} ${req.path}`); next(); });
    app.get('/api/appstudio/projekty', (_q, r) => r.json({ success: true, projekty: [{ id: 'gra-a', typ: 'gra', nazwa: 'Gra A' }, { id: 'apka-b', typ: 'apka', nazwa: 'Apka B' }, { id: 'gra-c', typ: 'gra', nazwa: 'Gra C' }] }));
    app.get('/api/appstudio/projekty/:id', (q, r) => (q.params.id.startsWith('gra-') ? r.json({ success: true, projekt: { id: q.params.id, typ: 'gra', nazwa: q.params.id }, zadania: [] }) : r.status(404).json({ success: false, message: 'Nie ma takiego projektu.' })));
    app.get('/api/gdd/:id/klocki', (q, r) => r.json({ success: true, katalog: [{ klucz: 'o:x', stan: 'obraz', opis: 'stworek' }, { klucz: 'a:y', stan: 'w-grze', opis: 'kot' }], zadania: { 'zd-1': { gotowe: [], doGry: [], braki: [{ rola: 'wróg', co: 'bryla', opis: 'zgrzytowiec' }], koncepty: [] }, 'zd-2': { gotowe: [], doGry: [], braki: [], koncepty: [] } }, projekt: q.params.id }));
    app.post('/api/appstudio/projekty/:id/buduj-w-tle', (q, r) => r.json({ success: true, id: 'kx-1', projekt: q.params.id, zadanie: q.body.zadanie, sondaz: '/api/appstudio/zadania/kx-1/sondaz' }));
    app.post('/api/game-studio/:id/test', (q, r) => r.json({ success: true, ok: true, bledy: [], stan: { pozycja: { x: 1, z: 2 } }, zrzut: `/api/game-studio/${q.params.id}/zrzut/zrzut-1.png` }));
    app.get('/api/game-studio/:id/zrzut/:plik', (_q, r) => r.type('png').send(PNG));
    app.post('/api/assety3d/chmura/:id/zlec', (q, r) => (q.body.zgodaKredyty === 10 ? r.json({ success: true, zadanie: { id: 'm-1' } }) : r.status(400).json({ success: false, message: 'BEZ_ZGODY' })));
    const s = http.createServer(app);
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    return { url: `http://127.0.0.1:${s.address().port}`, wolania, zamknij: () => new Promise((ok) => s.close(ok)) };
}
const tekst = (w) => w.content.find((c) => c.type === 'text')?.text ?? '';

test('MCP: initialize (wersja protokołu), tools/list wg grup, nieznana metoda, powiadomienia bez odpowiedzi', async () => {
    const s = utworzSerwer({ most: 'http://127.0.0.1:9', grupy: ['projekty', 'walidacja'] });
    const i = await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    assert.equal(i.result.protocolVersion, '2025-03-26');
    assert.equal(i.result.serverInfo.name, 'katedra-game-studio');
    const nowa = await s.obsluz({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2099-01-01' } });
    assert.equal(nowa.result.protocolVersion, '2025-06-18', 'nieznana wersja → nasza najnowsza');
    const l = await s.obsluz({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
    const nazwy = l.result.tools.map((t) => t.name);
    assert.ok(nazwy.includes('gs_klocki') && nazwy.includes('gs_waliduj'));
    assert.ok(!nazwy.includes('gs_buduj') && !nazwy.includes('unity_stan'), 'grupy wyłączone nie są widoczne');
    for (const t of l.result.tools) assert.equal(t.inputSchema.type, 'object');
    assert.equal(await s.obsluz({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
    assert.equal((await s.obsluz({ jsonrpc: '2.0', id: 4, method: 'nie/ma' })).error.code, -32601);
    const wylaczone = await s.obsluz({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'gs_buduj', arguments: {} } });
    assert.ok(wylaczone.result.isError && /wyłączonej/.test(tekst(wylaczone.result)));
});

test('MCP: grupy z --grupy / OTAKOS_MCP_GRUPY, literówka = błąd wprost; każda grupa ma narzędzia', () => {
    assert.deepEqual(grupyZ([], {}), GRUPY);
    assert.deepEqual(grupyZ(['--grupy=assety,unity'], {}), ['assety', 'unity']);
    assert.deepEqual(grupyZ([], { OTAKOS_MCP_GRUPY: 'budowa' }), ['budowa']);
    assert.throws(() => grupyZ(['--grupy=projekty,asety'], {}), /asety/);
    for (const g of GRUPY) assert.ok(NARZEDZIA.some((n) => n.grupa === g), g);
    assert.equal(new Set(NARZEDZIA.map((n) => n.nazwa)).size, NARZEDZIA.length, 'nazwy unikalne');
    assert.match(skroc('x'.repeat(50), 10), /ucięte: 40/);
});

test('MCP na atrapie mostu: lista gier, wybór gry (multi-instance), streszczenie klocków, zgoda dla ciężkich, zrzut jako obraz', async () => {
    const m = await atrapaMostu();
    try {
        const s = utworzSerwer({ most: m.url });
        const gry = JSON.parse(tekst(await s.wywolaj('gs_gry', {})));
        assert.deepEqual(gry.projekty.map((p) => p.id), ['gra-a', 'gra-c'], 'domyślnie tylko gry');
        assert.ok((await s.wywolaj('gs_klocki', {})).isError, 'bez wybranej gry — pyta którą');
        assert.ok((await s.wywolaj('gs_wybierz_gre', { projekt: 'nie-ma' })).isError, 'nieistniejąca gra — błąd z mostu');
        assert.equal(JSON.parse(tekst(await s.wywolaj('gs_wybierz_gre', { projekt: 'gra-c' }))).wybrana, 'gra-c');
        const k = JSON.parse(tekst(await s.wywolaj('gs_klocki', {})));
        assert.deepEqual(k.katalog.wgStanu, { obraz: 1, 'w-grze': 1 });
        assert.deepEqual(k.zadaniaZBrakami.map((z) => z.zadanie), ['zd-1']);
        assert.ok(m.wolania.includes('GET /api/gdd/gra-c/klocki'));
        // druga gra w tej samej sesji — parametr projekt wygrywa z wybraną
        await s.wywolaj('gs_klocki', { projekt: 'gra-a' });
        assert.ok(m.wolania.includes('GET /api/gdd/gra-a/klocki'));

        const bez = await s.wywolaj('gs_buduj', { zadanie: 'dodaj most' });
        assert.ok(bez.isError && /zgoda: true/.test(tekst(bez)));
        assert.ok(!m.wolania.some((w) => w.includes('buduj-w-tle')), 'bez zgody most nie jest wołany');
        const z = JSON.parse(tekst(await s.wywolaj('gs_buduj', { zadanie: 'dodaj most', zgoda: true })));
        assert.equal(z.id, 'kx-1');
        const meshyZla = await s.wywolaj('gs_meshy_zlec', { asset: 'a', zlecenie: {}, zgodaKredyty: 3, zgoda: true });
        assert.ok(meshyZla.isError && /BEZ_ZGODY/.test(tekst(meshyZla)), 'kredyty pilnuje most');

        const t = await s.wywolaj('gs_test_gry', {});
        assert.equal(t.content[1].type, 'image');
        assert.equal(Buffer.from(t.content[1].data, 'base64').subarray(1, 4).toString(), 'PNG');
        assert.equal(JSON.parse(tekst(t)).stan.pozycja.x, 1);
    } finally { await m.zamknij(); }
});

test('MCP przez stdio (prawdziwy proces): linie JSON-RPC po kolei, logi na stderr', async () => {
    const m = await atrapaMostu();
    try {
        const p = spawn(process.execPath, [path.join(KATALOG, '..', 'scripts', 'mcp', 'game-studio.mjs'), '--grupy=projekty'], { env: { ...process.env, OTAKOS_MOST: m.url }, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '', err = '';
        p.stdout.on('data', (d) => { out += d; });
        p.stderr.on('data', (d) => { err += d; });
        const linie = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, { jsonrpc: '2.0', method: 'notifications/initialized' },
            { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'gs_wybierz_gre', arguments: { projekt: 'gra-a' } } },
            { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'gs_klocki', arguments: {} } }];
        p.stdin.end(linie.map((l) => JSON.stringify(l)).join('\n') + '\n');
        await new Promise((ok) => p.on('close', ok));
        const odp = out.trim().split('\n').map((l) => JSON.parse(l));
        assert.deepEqual(odp.map((o) => o.id), [1, 2, 3]);
        assert.ok(!odp[2].result.isError, 'klocki po wyborze gry (kolejność zachowana)');
        assert.match(err, /gotowy, grupy: projekty/);
    } finally { await m.zamknij(); }
});

test('Główny: serwer MCP w --mcp-config, odczyt bez pytania, ciężkie przez prośbę z Tłumaczem', () => {
    Glowny.skonfiguruj({ katalogi: [], istnieje: () => true, mcpStudio: '/k/scripts/mcp/game-studio.mjs', unityMcp: () => null });
    const a = Glowny.argumenty({ tekst: 'x', sesjaId: 'u-1', wznow: false, model: 'gemma4' });
    const cfgMcp = JSON.parse(a[a.indexOf('--mcp-config') + 1]);
    assert.deepEqual(cfgMcp.mcpServers['katedra-game-studio'].args, ['/k/scripts/mcp/game-studio.mjs']);
    assert.ok(a.includes('mcp__katedra-game-studio__gs_klocki') && a.includes('mcp__katedra-game-studio__gs_waliduj'));
    assert.ok(!a.includes('mcp__katedra-game-studio__gs_buduj') && !a.includes('mcp__katedra-game-studio__gs_meshy_zlec'), 'ciężkie → prośba');
    const t = Glowny.tlumacz('mcp__katedra-game-studio__gs_meshy_zlec', { asset: 'a' });
    assert.equal(t.ryzyko, 'wysokie');
    assert.match(t.coRobi, /Game Studio \(MCP\)/);
    Glowny.skonfiguruj({ unityMcp: () => ({ type: 'http', url: 'http://localhost:8080/mcp' }) });
    const b = Glowny.argumenty({ tekst: 'x', sesjaId: 'u-1', wznow: false, model: 'gemma4' });
    assert.equal(JSON.parse(b[b.indexOf('--mcp-config') + 1]).mcpServers.unityMCP.url, 'http://localhost:8080/mcp');
    Glowny.skonfiguruj({ istnieje: () => false, unityMcp: () => null });
    assert.ok(!Glowny.argumenty({ tekst: 'x', sesjaId: 'u-1', model: 'm' }).includes('--mcp-config'), 'bez pliku serwera — bez flagi');
});

test('walidacja: ścieżki tylko src/** i index.html, błędy tsc z logu', () => {
    assert.equal(sciezkaPlikuGry('src\\gra\\a.ts'), 'src/gra/a.ts');
    assert.equal(sciezkaPlikuGry('index.html'), 'index.html');
    for (const zla of ['../x.ts', 'src/../../a.ts', '/etc/a', 'C:/a.ts', 'vite.config.ts', 'package.json', 'src//a.ts', '']) assert.throws(() => sciezkaPlikuGry(zla), undefined, zla);
    assert.deepEqual(bledyTsc('src/main.ts(3,7): error TS2322: Type \'string\' is not assignable to type \'number\'.\nFound 1 error.'),
        [{ plik: 'src/main.ts', linia: 3, kolumna: 7, kod: 'TS2322', tekst: 'Type \'string\' is not assignable to type \'number\'.' }]);
});

/** Projekt gry w katalogu tymczasowym z atrapą typescript (tsc: błąd, gdy plik ma „ZLE”) i node_modules jako katalog. */
async function projektGry() {
    const baza = await fs.mkdtemp(path.join(os.tmpdir(), 'gs-mcp-'));
    const d = path.join(baza, 'gra-x');
    await fs.mkdir(path.join(d, 'src'), { recursive: true });
    await fs.writeFile(path.join(d, 'projekt.json'), JSON.stringify({ id: 'gra-x', typ: 'gra' }));
    await fs.writeFile(path.join(d, 'tsconfig.json'), '{"include":["src"]}');
    await fs.writeFile(path.join(d, 'src', 'main.ts'), 'export function start() { return 1; }\nexport const WERSJA = 1;\n');
    const nm = path.join(baza, 'nm');
    await fs.mkdir(path.join(nm, 'typescript', 'bin'), { recursive: true });
    await fs.writeFile(path.join(nm, 'typescript', 'bin', 'tsc'), `const fs=require('fs'),p=require('path');
const pliki=[];(function chodz(d){for(const w of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,w.name);w.isDirectory()?chodz(f):pliki.push(f)}})('src');
let zle=0;for(const f of pliki){const t=fs.readFileSync(f,'utf8');const i=t.split('\\n').findIndex(l=>l.includes('ZLE'));if(i>=0){zle++;console.log(f.split(p.sep).join('/')+'('+(i+1)+',1): error TS2304: Cannot find name \\'ZLE\\'.')}}
if(!fs.existsSync('tsconfig.json')){console.log('brak tsconfig');process.exit(2)}process.exit(zle?2:0);`);
    await fs.symlink(nm, path.join(d, 'node_modules'), 'junction');
    return { baza, d };
}

test('walidacja przed zapisem: Recenzent (wycięty eksport, @ts-ignore) + tsc na kopii; projekt nietknięty, katalog tymczasowy sprzątnięty', async () => {
    const { baza, d } = await projektGry();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gs-tmp-'));
    const S = utworzStudioMcp({ katalogApek: baza, appStudio: {}, recenzent: Recenzent, tmp });
    const czysto = await S.waliduj('gra-x', { pliki: [{ sciezka: 'src/main.ts', tresc: 'export function start() { return 2; }\nexport const WERSJA = 2;\n' }, { sciezka: 'src/nowy.ts', tresc: 'export const a = 1;\n' }] });
    assert.equal(czysto.ok, true, JSON.stringify(czysto.tsc));
    assert.equal(czysto.tsc.ok, true);
    assert.deepEqual(czysto.pliki.map((p) => p.nowy), [false, true]);

    const zle = await S.waliduj('gra-x', { pliki: [{ sciezka: 'src/main.ts', tresc: '// @ts-ignore\nexport function start() { return ZLE; }\n' }] });
    assert.equal(zle.ok, false);
    assert.ok(zle.recenzent.blokujace.some((b) => b.regula === 'wyciete-eksporty'), 'WERSJA zniknęła');
    assert.equal(zle.tsc.ok, false);
    assert.deepEqual(zle.tsc.bledy.map((b) => [b.plik, b.linia, b.wProponowanych]), [['src/main.ts', 2, true]]);

    assert.equal(await fs.readFile(path.join(d, 'src', 'main.ts'), 'utf8'), 'export function start() { return 1; }\nexport const WERSJA = 1;\n', 'gra nietknięta');
    assert.ok(!(await fs.readdir(d + '/src')).includes('nowy.ts'));
    assert.deepEqual(await fs.readdir(tmp), [], 'kopie sprzątnięte (junction najpierw)');
    assert.ok((await fs.readdir(path.join(baza, 'nm', 'typescript', 'bin'))).includes('tsc'), 'node_modules przez junction nie skasowane');

    await assert.rejects(S.waliduj('gra-x', { pliki: [{ sciezka: 'package.json', tresc: '{}' }] }), /poza granicami/);
    await assert.rejects(S.waliduj('nie-ma', { pliki: [{ sciezka: 'src/a.ts', tresc: '' }] }), /Nie ma projektu/);
    const bezTsc = await S.waliduj('gra-x', { pliki: [{ sciezka: 'src/a.ts', tresc: 'export const b = ZLE;\n' }], tsc: false });
    assert.equal(bezTsc.tsc.ok, null);
});

test('test gry na żądanie: wymaga dist, parsuje migawki window.__gra, zrzut po nazwie; trasy za Strażą (zdalnie 401/403)', async () => {
    const { baza, d } = await projektGry();
    const wolania = [];
    const appStudio = {
        projekt: async (id) => ({ id, typ: 'gra' }),
        przetestujWPrzegladarce: async (id, typ, cel) => { wolania.push([id, typ, cel]); await fs.writeFile(path.join(d, 'zrzut-123.png'), PNG); return { ok: true, bledy: [], migawki: [{ kiedy: 'po załadowaniu', tekst: '{"pozycja":{"x":0,"z":0}}' }, { kiedy: 'po W', tekst: '{"pozycja":{"x":0,"z":-2}}' }], zrzut: 'zrzut-123.png', log: 'gra: canvas OK', sekundy: 3 }; },
    };
    const S = utworzStudioMcp({ katalogApek: baza, appStudio, recenzent: Recenzent });
    await assert.rejects(S.test('gra-x'), /nie jest zbudowana/);
    await fs.mkdir(path.join(d, 'dist'), { recursive: true });
    await fs.writeFile(path.join(d, 'dist', 'index.html'), '<div id="gra"></div>');
    const r = await S.test('gra-x', { cel: 'skok na spacji' });
    assert.deepEqual(wolania, [['gra-x', 'gra', 'skok na spacji']]);
    assert.equal(r.stan.pozycja.z, -2);
    assert.equal(r.zrzut, '/api/game-studio/gra-x/zrzut/zrzut-123.png');
    assert.equal(S.plikZrzutu('gra-x', '../projekt.json'), null);

    const app = express();
    app.use(express.json());
    app.use(strazMostu({ klucz: () => 'k'.repeat(32) }));
    zamontujTrasyStudiaMcp(app, S);
    const s = http.createServer(app);
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    const baza2 = `http://127.0.0.1:${s.address().port}`;
    try {
        const z = await fetch(`${baza2}/api/game-studio/gra-x/zrzut/zrzut-123.png`);
        assert.equal(z.status, 200);
        const w = await (await fetch(`${baza2}/api/game-studio/gra-x/waliduj`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pliki: [{ sciezka: 'src/x.ts', tresc: 'export const x = 1;\n' }] }) })).json();
        assert.equal(w.success, true);
        const zdalnie = await fetch(`${baza2}/api/game-studio/gra-x/test`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.8', 'x-forwarded-for': '8.8.8.8' }, body: '{}' });
        assert.equal(zdalnie.status, 401);
        const zKluczem = await fetch(`${baza2}/api/game-studio/gra-x/test`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.8', 'x-forwarded-for': '8.8.8.8', 'x-teo-klucz': 'k'.repeat(32) }, body: '{}' });
        assert.equal(zKluczem.status, 403, 'tylko maszyna, nawet z kluczem');
    } finally { await new Promise((ok) => s.close(ok)); }
});
