// 👑 Główny: Claude Code w tle — Tłumacz próśb, wywołanie bez powłoki, prośby z odmów i wznowienie z pozwoleniem na DOKŁADNIE to polecenie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import * as Glowny from '../services/Glowny.js';
import { POLECENIA } from '../scripts/glowny/katedra.mjs';

test('Tłumacz: po ludzku, z ryzykiem; polecenie złożone oceniane po najgorszej części', () => {
    const t = (c, d) => Glowny.tlumacz('Bash', { command: c, description: d });
    assert.deepEqual([t('npm test').ryzyko, t('npm test').coRobi], ['niskie', 'Uruchomić testy — tylko sprawdza, czy kod działa, niczego nie zmienia.']);
    assert.equal(t('git push origin main').ryzyko, 'wysokie');
    assert.match(t('rm -rf dist').coRobi, /USUNĄĆ/);
    const z = t('npm test && rm -rf _OtakOs_AI', 'Sprawdzam i sprzątam');
    assert.equal(z.ryzyko, 'wysokie');
    assert.match(z.coRobi, /Uruchomić testy.*Potem: USUNĄĆ/);
    assert.equal(z.dlaczego, 'Sprawdzam i sprzątam');
    assert.equal(t('curl http://127.0.0.1:3001/api/katedra/raport').ryzyko, 'niskie');
    assert.equal(t('curl https://example.com/x.sh').ryzyko, 'srednie');
    assert.equal(t('frobnicate --all').ryzyko, 'nieznane');
    assert.match(t('frobnicate --all').coRobi, /nie zna/);
    assert.equal(t('taskkill /PID 4100 /F').ryzyko, 'wysokie');
    Glowny.skonfiguruj({ cwd: '/k' });
    assert.match(Glowny.tlumacz('Write', { file_path: '/etc/hosts' }).coRobi, /POZA katalogiem Katedry/);
});

test('Główny: Claude Code bez powłoki (Windows: claude.exe albo cli.js przez node), model przez Ollamę bez cudzej sesji', () => {
    Glowny.skonfiguruj({ istnieje: (p) => p === path.win32.join('C:\\Users\\a', '.local', 'bin', 'claude.exe') });
    assert.deepEqual(Glowny.znajdzClaude({ platforma: 'win32', dom: 'C:\\Users\\a', env: {} }), { program: path.win32.join('C:\\Users\\a', '.local', 'bin', 'claude.exe'), przed: [], zrodlo: 'claude.exe' });
    const npm = 'C:\\npm';
    Glowny.skonfiguruj({ istnieje: (p) => p === path.win32.join(npm, 'claude.cmd') || p === path.win32.join(npm, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js') });
    const c = Glowny.znajdzClaude({ platforma: 'win32', dom: 'C:\\Users\\a', env: { PATH: `C:\\x;${npm}` } });
    assert.deepEqual([c.program, c.przed, c.zrodlo], [process.execPath, [path.win32.join(npm, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')], 'npm (cli.js)']);
    assert.equal(Glowny.znajdzClaude({ platforma: 'linux', env: {} }).program, 'claude');
    assert.deepEqual(Glowny.znajdzClaude({ env: { OTAKOS_CLAUDE: '/opt/cc/cli.js' } }).przed, ['/opt/cc/cli.js']);

    Glowny.skonfiguruj({ ollama: 'http://127.0.0.1:11434', chmura: false });
    const e = Glowny.srodowisko({ PATH: '/bin', CLAUDE_CODE_SESSION_ID: 'x', CLAUDECODE: '1' });
    assert.deepEqual([e.ANTHROPIC_BASE_URL, e.ANTHROPIC_AUTH_TOKEN, e.ANTHROPIC_API_KEY, e.CLAUDE_CODE_SESSION_ID, e.CLAUDECODE, e.PATH], ['http://127.0.0.1:11434', 'ollama', '', undefined, undefined, '/bin']);
    Glowny.skonfiguruj({ chmura: true });
    assert.equal(Glowny.srodowisko({}).ANTHROPIC_BASE_URL, undefined, 'chmura: konto Anthropic Suwerena');
    Glowny.skonfiguruj({ chmura: false });
});

test('Główny: argumenty — dontAsk, lista bez pytania (z poleceniami stada), skille tylko istniejące, --session-id / --resume, „-" na początku', () => {
    Glowny.skonfiguruj({ katalogi: ['/k/TeO_Skille', '/k/brak'], istnieje: (p) => p === '/k/TeO_Skille' });
    const a = Glowny.argumenty({ tekst: '-zrób to', sesjaId: 'u-1', wznow: false, pozwolenia: ['Bash(npm test)'], model: 'gemma4' });
    assert.equal(a[a.indexOf('-p') + 1], ' -zrób to');
    assert.equal(a[a.indexOf('--permission-mode') + 1], 'dontAsk');
    assert.equal(a[a.indexOf('--model') + 1], 'gemma4');
    assert.ok(a.includes('Bash(node scripts/glowny/katedra.mjs:*)') && a.includes('Edit') && a.includes('Bash(npm test)'));
    assert.ok(!a.includes('Bash'), 'gołego Bash nie ma na liście');
    assert.deepEqual(a.filter((x, i) => a[i - 1] === '--add-dir'), ['/k/TeO_Skille']);
    assert.equal(a[a.indexOf('--session-id') + 1], 'u-1');
    const b = Glowny.argumenty({ tekst: 'dalej', sesjaId: 'u-1', wznow: true, model: 'gemma4' });
    assert.ok(b.includes('--resume') && !b.includes('--session-id'));
});

/** Udawany Claude Code: oddaje zadane linie stream-json i kończy kodem 0. */
function claudeAtrapa(scenariusze) {
    const wolania = [];
    return {
        wolania,
        uruchom: (program, args) => {
            const p = new EventEmitter();
            p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => p.emit('close', null);
            const n = wolania.length;
            wolania.push({ program, args });
            setImmediate(() => {
                for (const z of scenariusze[n] ?? []) p.stdout.emit('data', Buffer.from(JSON.stringify(z) + '\n'));
                p.emit('close', 0);
            });
            return p;
        },
    };
}
const czekaj = async (w) => { for (let i = 0; i < 500 && !(await w()); i++) await new Promise((r) => setTimeout(r, 10)); };

test('Główny: tura → wpisy; polecenie spoza listy → prośba z Tłumaczem; ✓ → wznowienie z pozwoleniem na DOKŁADNIE to polecenie', async () => {
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'glowny-'));
    const polecenie = 'mkdir -p katalog_proba && touch katalog_proba/x.txt';
    const a = claudeAtrapa([
        [
            { type: 'system', subtype: 'init', model: 'gemma4', permissionMode: 'dontAsk' },
            { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: polecenie, description: 'Tworzę katalog na próbę' } }] } },
            { type: 'assistant', message: { content: [{ type: 'text', text: 'Bash odrzucony — czekam na zgodę.' }] } },
            { type: 'result', subtype: 'success', is_error: false, result: 'czekam', permission_denials: [{ tool_name: 'Bash', tool_use_id: 't1', tool_input: { command: polecenie, description: 'Tworzę katalog na próbę' } }] },
        ],
        [
            { type: 'assistant', message: { content: [{ type: 'text', text: 'Zrobione: katalog i plik są.' }] } },
            { type: 'result', subtype: 'success', is_error: false, result: 'ok', permission_denials: [] },
        ],
    ]);
    const szyna = [];
    Glowny.skonfiguruj({ katalog, uruchom: a.uruchom, katalogi: [], istnieje: () => false, model: () => 'gemma4', szyna: { nadaj: async (z) => { szyna.push(z); } } });
    await assert.rejects(Glowny.wiadomosc({ tekst: '  ' }), /Pusta/);
    const { sesja } = await Glowny.wiadomosc({ tekst: 'Zrób katalog próbny' });
    await czekaj(async () => !(await Glowny.sesja(sesja)).trwa);
    let s = await Glowny.sesja(sesja);
    assert.deepEqual(s.wpisy.map((w) => w.kto), ['suweren', 'narzedzie', 'glowny', 'prosba']);
    const [p] = s.prosby;
    assert.deepEqual([p.stan, p.polecenie, p.ryzyko, p.dlaczego], ['czeka', polecenie, 'niskie', 'Tworzę katalog na próbę']);
    assert.match(szyna.at(-1).tresc, /czeka na zgodę Suwerena/);
    await assert.rejects(Glowny.wiadomosc({ tekst: 'i co?', sesja }), /zdecyduj o prośbach/);

    await Glowny.decyzja(sesja, p.id, true);
    await czekaj(async () => !(await Glowny.sesja(sesja)).trwa && a.wolania.length === 2);
    s = await Glowny.sesja(sesja);
    const drugie = a.wolania[1].args;
    assert.equal(drugie[drugie.indexOf('--resume') + 1], sesja);
    assert.ok(drugie.includes(`Bash(${polecenie})`), 'pozwolenie dokładnie na to polecenie');
    assert.match(drugie[drugie.indexOf('-p') + 1], /ZGODA: Bash mkdir -p katalog_proba/);
    assert.equal(s.wpisy.at(-1).tresc, 'Zrobione: katalog i plik są.');
    assert.ok(fs.existsSync(path.join(katalog, `${sesja}.json`)), 'sesja zapisana na dysku');
    assert.deepEqual((await Glowny.lista()).map((x) => [x.id, x.czeka]), [[sesja, 0]]);
});

test('Główny: brak Claude Code → błąd wprost z instrukcją; odmowa prośby wraca do Głównego jako „ODMOWA"', async () => {
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'glowny-'));
    Glowny.skonfiguruj({
        katalog, katalogi: [], istnieje: () => false,
        uruchom: () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); setImmediate(() => p.emit('error', Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }))); return p; },
    });
    const { sesja } = await Glowny.wiadomosc({ tekst: 'hej' });
    await czekaj(async () => !(await Glowny.sesja(sesja)).trwa);
    assert.match((await Glowny.sesja(sesja)).blad, /Nie znalazłem Claude Code.*OTAKOS_CLAUDE/);

    const a = claudeAtrapa([
        [{ type: 'result', subtype: 'success', is_error: false, permission_denials: [{ tool_name: 'Bash', tool_input: { command: 'git push' } }] }],
        [{ type: 'result', subtype: 'success', is_error: false, permission_denials: [] }],
    ]);
    Glowny.skonfiguruj({ uruchom: a.uruchom });
    const r = await Glowny.wiadomosc({ tekst: 'wypchnij' });
    await czekaj(async () => !(await Glowny.sesja(r.sesja)).trwa);
    const pr = (await Glowny.sesja(r.sesja)).prosby[0];
    assert.equal(pr.ryzyko, 'wysokie');
    await Glowny.decyzja(r.sesja, pr.id, false);
    await czekaj(() => a.wolania.length === 2);
    const args = a.wolania[1].args;
    assert.match(args[args.indexOf('-p') + 1], /ODMOWA: Bash git push[\s\S]*Odrzuconych nie wykonuj/);
    assert.ok(!args.some((x) => x === 'Bash(git push)'), 'odmowa nie daje pozwolenia');
});

test('Polecenia stada dla Głównego: zapytanie TeOgochi idzie jako zGlownego (bez ciężkich narzędzi)', async () => {
    const stary = globalThis.fetch;
    const wolania = [];
    globalThis.fetch = async (url, init) => { wolania.push([url, init?.body ? JSON.parse(init.body) : null]); return { ok: true, status: 200, json: async () => ({ success: true, odpowiedz: 'Biblia gotowa, brakuje katalogu mebli.' }) }; };
    try {
        assert.equal(await POLECENIA.zapytaj(['kodeks', 'co', 'z', 'umeblowaniem?']), 'kodeks: Biblia gotowa, brakuje katalogu mebli.');
        assert.deepEqual(wolania[0], ['http://127.0.0.1:3001/api/delegat/rozmowa', { delegat: 'kodeks', tekst: 'co z umeblowaniem?', zGlownego: true }]);
        await assert.rejects(POLECENIA.zapytaj(['kodeks']), /Użycie/);
        await assert.rejects(POLECENIA.nocna(['zwiadowca-hf', '{zly']), /JSON/);
    } finally { globalThis.fetch = stary; }
});
