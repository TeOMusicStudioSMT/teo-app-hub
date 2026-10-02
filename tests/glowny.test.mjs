// 👑 Główny: Claude Code w tle — Tłumacz próśb, wywołanie bez powłoki, prośby z odmów i wznowienie z pozwoleniem na DOKŁADNIE to polecenie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import * as Glowny from '../services/Glowny.js';
import { POLECENIA } from '../scripts/glowny/katedra.mjs';
import { ocen, tylkoOdczyt } from '../scripts/glowny/straz.mjs';

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
        uruchom: function (program, args) {
            const p = new EventEmitter();
            let zabity = false;
            p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => { zabity = true; };
            const n = wolania.length;
            wolania.push({ program, args, opcje: arguments[2] });
            setImmediate(() => {
                for (const z of scenariusze[n] ?? []) { if (zabity) break; p.stdout.emit('data', Buffer.from(JSON.stringify(z) + '\n')); }
                p.emit('close', zabity ? null : 0);
            });
            return p;
        },
    };
}
// Limit 15 s: w pełnym zestawie testy idą równolegle (także z prawdziwym gitem) i tura w tle bywa wolniejsza.
const czekaj = async (w) => { for (let i = 0; i < 1500 && !(await w()); i++) await new Promise((r) => setTimeout(r, 10)); };

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

test('Główny: wklejony zrzut → plik w zalaczniki, ścieżka w wiadomości do Read; obcy plik odrzucony; zmiana modelu w trakcie rozmowy', async () => {
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'glowny-'));
    const a = claudeAtrapa([
        [{ type: 'result', subtype: 'success', is_error: false, permission_denials: [] }],
        [{ type: 'result', subtype: 'success', is_error: false, permission_denials: [] }],
    ]);
    Glowny.skonfiguruj({ katalog, uruchom: a.uruchom, katalogi: [], istnieje: (p) => fs.existsSync(p), model: () => 'gemma4:e2b' });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const z = await Glowny.zapiszZalacznik({ dane: png, nazwa: 'Zrzut ekranu (1).png' });
    assert.match(z.plik, /_Zrzut_ekranu_1\.png$/);
    assert.ok(fs.existsSync(path.join(katalog, 'zalaczniki', z.plik)));
    await assert.rejects(Glowny.zapiszZalacznik({ dane: 'data:text/html;base64,PGI+' }), /obrazem/);
    assert.equal(Glowny.sciezkaZalacznika('../stado.json'), null, 'tylko nazwa pliku z katalogu załączników');
    await assert.rejects(Glowny.wiadomosc({ tekst: 'x', zalaczniki: ['nie-ma.png'] }), /Nie ma załącznika/);

    const { sesja } = await Glowny.wiadomosc({ tekst: '', zalaczniki: [z.plik] });
    await czekaj(async () => !(await Glowny.sesja(sesja)).trwa);
    const args = a.wolania[0].args;
    assert.match(args[args.indexOf('-p') + 1], new RegExp(`Zobacz załączone obrazy\\.[\\s\\S]*otwórz każdy narzędziem Read[\\s\\S]*${z.plik.replace(/[.()]/g, '\\$&')}`));
    assert.equal(args[args.indexOf('--add-dir') + 1], path.join(katalog, 'zalaczniki'), 'katalog załączników dostępny dla Read');
    assert.match(args[args.indexOf('--append-system-prompt') + 1], /wideo przytnij/, 'Główny wie o mocach Katedry');
    assert.deepEqual((await Glowny.sesja(sesja)).wpisy[0].zalaczniki, [z.plik]);

    await Glowny.wiadomosc({ tekst: 'dalej', sesja, model: 'qwen3-coder:30b' });
    await czekaj(() => a.wolania.length === 2);
    const drugie = a.wolania[1].args;
    assert.equal(drugie[drugie.indexOf('--model') + 1], 'qwen3-coder:30b', 'mocniejszy model od następnej wiadomości');
});

test('Polecenia stada: wideo przytnij/potnij → trasy mostu (ścieżka względem Katedry, pełna, move:), moce', async () => {
    const stary = globalThis.fetch;
    const wolania = [];
    globalThis.fetch = async (url, init) => { wolania.push([url.replace('http://127.0.0.1:3001', ''), init?.body ? JSON.parse(init.body) : null]); return { ok: true, status: 200, json: async () => ({ success: true, wynik: '/k/x_od0_5s.mp4', sekundy: 9.5, byloSekund: 10, kawalki: [], katalog: '/k' }) }; };
    try {
        assert.match(await POLECENIA.wideo(['przytnij', '_OtakOs_Klocki/A/x.mp4', '0,5']), /Przycięte: \/k\/x_od0_5s\.mp4 \(9\.5 s, było 10 s\)/);
        await POLECENIA.wideo(['przytnij', 'F:\\K\\_OtakOs_Klocki\\A\\x.mp4', '0.5', '3']);
        await POLECENIA.wideo(['potnij', 'move:film.mp4', '10']);
        assert.deepEqual(wolania, [
            ['/api/wideo/przytnij', { zrodlo: 'klocki', plik: 'A/x.mp4', od: 0.5 }],
            ['/api/wideo/przytnij', { plik: 'F:\\K\\_OtakOs_Klocki\\A\\x.mp4', od: 0.5, do: 3 }],
            ['/api/wideo/potnij', { zrodlo: 'move', plik: 'film.mp4', sekundy: 10 }],
        ]);
        await assert.rejects(POLECENIA.wideo(['przytnij', 'x.mp4', 'pół']), /liczbę sekund/);
        assert.match(await POLECENIA.moce(), /wideo przytnij[\s\S]*zapytaj/);
    } finally { globalThis.fetch = stary; }
});

test('Straż: odczyt i tworzenie nowego bez pytania; istniejący rdzeń, sekrety, zapis poza Katedrą i reszta poleceń za zgodą', () => {
    const o = (narzedzie, wejscie, { istnieje = false, zgody = [] } = {}) => ocen({ tool_name: narzedzie, tool_input: wejscie }, { katedra: '/k', wolne: ['/k/TeO_Skille', '/z'], zgody, istnieje: () => istnieje }).decyzja;
    // To, o co Ling pytał w kółko — teraz bez pytania:
    for (const c of ['ls -la', 'ls /dev/zero', 'ffprobe -v quiet -print_format json -show_format "F:\\5 stars\\a.mp4" 2>&1', 'ffmpeg -version 2>&1 | head -1',
        'git status && git diff', 'curl -s http://127.0.0.1:3001/api/katedra/raport', 'mkdir -p raport', 'touch raport/a.txt', 'find . -name "*.mp4"',
        'node scripts/glowny/katedra.mjs wideo przytnij "F:/K/_OtakOs_Klocki/a.mp4" 0.5', 'ollama list']) assert.equal(o('Bash', { command: c }), 'allow', c);
    for (const c of ['head -c 450000 x.mp4 > /tmp/h.bin', 'cp a b', 'ffmpeg -i a.mp4 -ss 0.5 b.mp4', 'python -c "print(1)"', 'find . -delete', 'find -delete .',
        'curl -X POST http://127.0.0.1:3001/x', 'curl -s -d a=1 http://localhost:3001/x', 'curl https://example.com', 'echo $(rm x)', 'ls; rm -rf x',
        'node scripts/glowny/katedra.mjs moce; rm -rf x', 'git push']) assert.equal(o('Bash', { command: c }), 'ask', c);
    assert.match(ocen({ tool_name: 'Bash', tool_input: { command: 'ffmpeg -i a.mp4 b.mp4' } }, { katedra: '/k' }).powod, /NIE ponawiaj[\s\S]*katedra\.mjs wideo przytnij/);
    assert.equal(o('Bash', { command: 'cp a b' }, { zgody: ['cp a b'] }), 'allow', 'zgoda Suwerena na DOKŁADNIE to polecenie');
    // Pliki:
    assert.equal(o('Write', { file_path: '/k/components/Nowy.tsx' }), 'allow', 'nowy plik — swoboda tworzenia');
    assert.equal(o('Edit', { file_path: '/k/wiesio-bridge.js' }, { istnieje: true }), 'ask', 'istniejący rdzeń');
    assert.equal(o('Write', { file_path: 'services/Stado.js' }, { istnieje: true }), 'ask', 'ścieżka względna też');
    assert.equal(o('Edit', { file_path: '/k/services/X.js' }, { istnieje: true, zgody: ['plik:/k/services/X.js'] }), 'allow');
    assert.equal(o('Edit', { file_path: '/k/_OtakOs_Wymiar/stol.json' }, { istnieje: true }), 'allow', 'katalog roboczy');
    assert.equal(o('Edit', { file_path: '/k/TeO_Skille/a/SKILL.md' }, { istnieje: true }), 'allow', 'dodatkowe katalogi (skille, załączniki)');
    assert.equal(o('Write', { file_path: '/k/.env' }), 'ask', 'sekrety zawsze za zgodą');
    assert.equal(o('Write', { file_path: '/k/_OtakOs_Wymiar/media_secrets.json' }), 'ask');
    assert.equal(o('Write', { file_path: '/etc/hosts' }), 'ask', 'poza Katedrą');
    assert.equal(o('Read', { file_path: '/k/.env' }), 'allow');
    assert.ok(tylkoOdczyt('ls 2>/dev/null') && !tylkoOdczyt('ls > lista.txt') && !tylkoOdczyt(''));
});

test('Główny: Straż wpięta jako hook, zgody w środowisku; Tłumacz zmiany rdzenia z podglądem; limit odmów kończy turę, prośby bez powtórek', async () => {
    const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'glowny-'));
    const edycja = { file_path: '/k/wiesio-bridge.js', old_string: 'most = 1', new_string: 'most = 2', description: 'Podbijam most' };
    const t = (() => { Glowny.skonfiguruj({ cwd: '/k' }); return Glowny.tlumacz('Edit', edycja); })();
    assert.deepEqual([t.ryzyko, t.klucz], ['srednie', 'plik:/k/wiesio-bridge.js']);
    assert.match(t.coRobi, /istniejący plik rdzenia Katedry: wiesio-bridge\.js/);
    assert.equal(t.polecenie, 'wiesio-bridge.js\n- most = 1\n+ most = 2');
    assert.equal(Glowny.tlumacz('Write', { file_path: '/k/.env', content: 'A=1' }).ryzyko, 'wysokie');

    const uzyj = (id, name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } });
    const odmowa = (id, tool_name) => ({ type: 'system', subtype: 'permission_denied', tool_name, tool_use_id: id, message: 'Czeka na zgodę Suwerena' });
    const a = claudeAtrapa([
        [   // mały model: ta sama rzecz dwa razy, potem dwie inne → po 3 RÓŻNYCH odmowach koniec tury
            uzyj('t1', 'Bash', { command: 'cp a b', description: 'kopia' }), odmowa('t1', 'Bash'),
            uzyj('t2', 'Bash', { command: 'cp a b' }), odmowa('t2', 'Bash'),
            uzyj('t3', 'Edit', edycja), odmowa('t3', 'Edit'),
            uzyj('t4', 'Bash', { command: 'python -c "1"' }), odmowa('t4', 'Bash'),
            uzyj('t5', 'Bash', { command: 'rm -rf x' }), odmowa('t5', 'Bash'),
        ],
        [{ type: 'result', subtype: 'success', is_error: false, permission_denials: [] }],
    ]);
    Glowny.skonfiguruj({ katalog, cwd: '/k', uruchom: a.uruchom, katalogi: [], istnieje: () => false, model: () => 'gemma4', straz: '/k/scripts/glowny/straz.mjs', limitOdmow: 3, szyna: null });
    const { sesja } = await Glowny.wiadomosc({ tekst: 'zrób' });
    await czekaj(async () => !(await Glowny.sesja(sesja)).trwa);
    let s = await Glowny.sesja(sesja);
    assert.equal(s.blad, null, 'zatrzymanie po odmowach to nie błąd');
    assert.deepEqual(s.prosby.map((p) => p.klucz), ['cp a b', 'plik:/k/wiesio-bridge.js', 'python -c "1"'], 'bez powtórek, bez rm (tura zatrzymana wcześniej)');
    assert.match(s.wpisy.find((w) => w.kto === 'decyzja').tresc, /Zatrzymałem turę po 3 odmowach/);
    const args = a.wolania[0].args;
    const hook = JSON.parse(args[args.indexOf('--settings') + 1]).hooks.PreToolUse[0];
    assert.equal(hook.matcher, 'Bash|Edit|MultiEdit|Write|NotebookEdit');
    assert.match(hook.hooks[0].command, /^".+" "\/k\/scripts\/glowny\/straz\.mjs"$/);

    for (const p of s.prosby) await Glowny.decyzja(sesja, p.id, p.klucz !== 'python -c "1"');
    await czekaj(() => a.wolania.length === 2);
    const env = a.wolania[1].opcje.env;
    assert.deepEqual(JSON.parse(env.OTAKOS_GLOWNY_ZGODY), ['cp a b', 'plik:/k/wiesio-bridge.js'], 'Straż przepuści dokładnie to, na co jest zgoda');
    assert.equal(env.OTAKOS_GLOWNY_KATEDRA, '/k');
    assert.ok(!a.wolania[1].args.includes('plik:/k/wiesio-bridge.js'), 'klucz pliku nie trafia do --allowedTools');
});
