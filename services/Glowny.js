/**
 * 👑 Główny — Claude Code w tle, podłączony do czatów Katedry (zamiast odłączonego okna terminala).
 *
 * Suweren (2026-10-01): „Ultra Główny model, który zarządza wszystkimi agentami/TeOgochi… i miałby podłączenie do
 * Claude Code (u nas Odpal…Kurka)… tylko że tam to działa w terminalu… żaden czat czy agent nie ma do tego dostępu…
 * powinien dostać nowe zdolności… katalogi i skille, jak Claude Code". Do tej pory /api/claude/launch odpalał
 * `ollama launch claude` jako proces odłączony (stdio: 'ignore') — nikt nie widział, co robi.
 *
 * TERAZ: most uruchamia `claude -p` (tryb bez okna) z `--output-format stream-json`, czyta zdarzenia i oddaje je czatom.
 *  model     — lokalny przez Ollamę (ANTHROPIC_BASE_URL → Ollama, jak `ollama launch claude`); OTAKOS_GLOWNY_MODEL,
 *              domyślnie aktywny model Katedry. OTAKOS_GLOWNY_CHMURA=1 → konto Anthropic Suwerena (bez podmiany adresu).
 *  zdolności — katalog Katedry (CLAUDE.md, kod) + skille z TeO_Skille (--add-dir) + polecenia stada
 *              (`node scripts/glowny/katedra.mjs …` — projekty, Stół, rozmowa z TeOgochi, Nocna Zmiana).
 *  uprawnienia (decyzja Suwerena 2026-10-01): pliki w Katedrze Główny czyta i zmienia SAM; każde polecenie powłoki
 *              poza listą stada czeka na zgodę. Mechanizm sprawdzony na prawdziwym Claude Code: tryb `dontAsk` odrzuca
 *              narzędzia spoza `--allowedTools` i zapisuje je w `permission_denials`; po „✓" sesja wraca (`--resume`)
 *              z pozwoleniem na DOKŁADNIE to jedno polecenie (`Bash(<polecenie>)`).
 *  tłumacz   — każda prośba dostaje opis po ludzku: co zrobi, czym grozi, dlaczego Główny tego chce („bo panik naszego
 *              Mechanika do dziś nie mogę zrozumieć" — Suweren).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';

let cfg = {
    katalog: path.join(process.cwd(), '_OtakOs_Wymiar', 'glowny'),
    cwd: process.cwd(),
    /** dodatkowe katalogi (skille itp.) — tylko istniejące idą do --add-dir */
    katalogi: [path.join(process.cwd(), 'TeO_Skille')],
    ollama: 'http://127.0.0.1:11434',
    model: () => process.env.OTAKOS_GLOWNY_MODEL || process.env.OTAKOS_MODEL || 'gemma4',
    chmura: process.env.OTAKOS_GLOWNY_CHMURA === '1',
    platforma: process.platform,
    /** (program, argumenty, { cwd, env }) → proces z .stdout / .stderr / .on('close') — podmienialne w testach */
    uruchom: (program, argumenty, opcje) => spawn(program, argumenty, { ...opcje, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }),
    istnieje: (p) => fsSync.existsSync(p),
    szyna: null,
    maxTur: 40,
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

/** Narzędzia, których Główny używa bez pytania: czytanie i edycja plików Katedry, skille, polecenia stada. */
export const BEZ_PYTANIA = ['Read', 'Glob', 'Grep', 'LS', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'TodoWrite', 'Task', 'Skill',
    'Bash(node scripts/glowny/katedra.mjs:*)'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ─────────────────────────────────────────────────────────────────────────────
// 🗣️ TŁUMACZ PRÓŚB — o co mu chodzi, po ludzku
// ─────────────────────────────────────────────────────────────────────────────

const REGULY = [
    [/^(npm|pnpm|yarn)\s+(run\s+)?test\b|^node\s+--test\b|^npx\s+(vitest|jest)\b/, 'Uruchomić testy — tylko sprawdza, czy kod działa, niczego nie zmienia.', 'niskie'],
    [/^npm\s+run\s+(build|rewizor|mapa)\b|^npx\s+tsc\b/, 'Sprawdzić/zbudować projekt (kompilacja, rewizor) — czyta kod i tworzy pliki wynikowe, nie rusza Twojej pracy.', 'niskie'],
    [/^node\s+--check\b/, 'Sprawdzić składnię pliku — nic nie zmienia.', 'niskie'],
    [/^git\s+(status|diff|log|show|branch)\b/, 'Podejrzeć stan gita (co się zmieniło) — tylko odczyt.', 'niskie'],
    [/^(ls|dir|cat|type|head|tail|wc|pwd|echo|find|grep|rg|tree)\b/, 'Przeczytać/wylistować pliki — tylko odczyt.', 'niskie'],
    [/^git\s+(add|commit)\b/, 'Zapisać zmiany w historii gita (lokalnie, na tym komputerze). Da się cofnąć.', 'srednie'],
    [/^git\s+push\b/, 'Wysłać zmiany na GitHub — wyjdą poza Twój komputer.', 'wysokie'],
    [/^git\s+(reset\s+--hard|checkout\s+--|clean\s+-|restore)\b/, 'Cofnąć/wyczyścić zmiany w plikach — niezapisana praca może przepaść.', 'wysokie'],
    [/^(npm|pnpm|yarn)\s+(i|install|add|ci)\b|^pip3?\s+install\b|^python\S*\s+-m\s+pip\s+install\b/, 'Doinstalować paczki — pobiera z internetu i zmienia biblioteki projektu.', 'srednie'],
    [/^(rm|del|rmdir|rd|Remove-Item|erase)\b|\brm\s+-[rf]/i, 'USUNĄĆ pliki lub katalogi — tego nie cofniesz bez kopii.', 'wysokie'],
    [/^(mkdir|md|touch|New-Item)\b/i, 'Utworzyć katalog/plik.', 'niskie'],
    [/^(cp|copy|xcopy|robocopy|mv|move|ren|rename|Copy-Item|Move-Item)\b/i, 'Skopiować albo przenieść pliki — przeniesienie może nadpisać plik o tej samej nazwie.', 'srednie'],
    [/^(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b[^\n]*(127\.0\.0\.1|localhost)/i, 'Zapytać lokalny serwis Katedry (most/Ollama) — nie wychodzi do internetu.', 'niskie'],
    [/^(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i, 'Połączyć się z internetem (pobrać albo wysłać dane).', 'srednie'],
    [/^(taskkill|kill|pkill|Stop-Process)\b/i, 'Zamknąć działający program — może przerwać pracę (np. render, trening).', 'wysokie'],
    [/^(shutdown|format|diskpart|reg\s|bcdedit|sc\s)/i, 'Zmienić coś w systemie Windows (wyłączenie, dysk, rejestr, usługi).', 'wysokie'],
    [/^ollama\s+(rm|delete)\b/, 'Usunąć model z Ollamy.', 'wysokie'],
    [/^ollama\s+(pull|create)\b/, 'Pobrać albo wykuć model w Ollamie (gigabajty na dysku).', 'srednie'],
    [/^(node|python\S*|py)\s+\S+/, 'Uruchomić skrypt — zrobi to, co jest w tym pliku.', 'srednie'],
];
const RYZYKO_SLOWNIE = { niskie: '🟢 niskie', srednie: '🟡 średnie', wysokie: '🔴 wysokie', nieznane: '⚪ nieznane' };

/**
 * Prośba Głównego po ludzku. Polecenie złożone (&&, ;, |) — ocena według NAJGORSZEJ części.
 * @returns {{ coRobi: string, ryzyko: 'niskie'|'srednie'|'wysokie'|'nieznane', ryzykoSlownie: string, dlaczego: string|null, polecenie: string }}
 */
export function tlumacz(narzedzie, wejscie = {}) {
    const dlaczego = wejscie?.description ? String(wejscie.description).slice(0, 300) : null;
    if (narzedzie !== 'Bash') {
        const cel = wejscie?.file_path ?? wejscie?.url ?? wejscie?.path ?? null;
        const opis = { Write: 'Zapisać plik', Edit: 'Zmienić plik', WebFetch: 'Pobrać stronę z internetu', WebSearch: 'Szukać w internecie' }[narzedzie] ?? `Użyć narzędzia ${narzedzie}`;
        const ryzyko = /^Web/.test(narzedzie) ? 'srednie' : cel && !String(cel).startsWith(cfg.cwd) ? 'srednie' : 'nieznane';
        return { coRobi: `${opis}${cel ? `: ${cel}` : ''}${cel && !String(cel).startsWith(cfg.cwd) ? ' — POZA katalogiem Katedry' : ''}.`, ryzyko, ryzykoSlownie: RYZYKO_SLOWNIE[ryzyko], dlaczego, polecenie: JSON.stringify(wejscie).slice(0, 400) };
    }
    const polecenie = String(wejscie?.command ?? '').trim();
    const czesci = polecenie.split(/\s*(?:&&|\|\||;|\|)\s*/).map((c) => c.trim()).filter(Boolean);
    const POZIOM = { niskie: 0, nieznane: 1, srednie: 2, wysokie: 3 };
    let najgorsze = null;
    const opisy = [];
    for (const c of czesci) {
        const r = REGULY.find(([wz]) => wz.test(c));
        const [opis, ryzyko] = r ? [r[1], r[2]] : ['Polecenie, którego Tłumacz nie zna — przeczytaj je przed zgodą.', 'nieznane'];
        if (!opisy.includes(opis)) opisy.push(opis);
        if (!najgorsze || POZIOM[ryzyko] > POZIOM[najgorsze]) najgorsze = ryzyko;
    }
    const ryzyko = najgorsze ?? 'nieznane';
    return { coRobi: opisy.join(' Potem: ') || 'Puste polecenie.', ryzyko, ryzykoSlownie: RYZYKO_SLOWNIE[ryzyko], dlaczego, polecenie };
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude Code: gdzie jest i jak go wołać
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Program Claude Code. Na Windows `claude.cmd` z npm wymagałby powłoki (a w niej treść poleceń byłaby niebezpieczna),
 * więc szukamy: OTAKOS_CLAUDE → natywny claude.exe (~/.local/bin) → cli.js obok claude.cmd z npm (przez node) → `claude`.
 * @returns {{ program: string, przed: string[], zrodlo: string }}
 */
export function znajdzClaude({ platforma = cfg.platforma, dom = os.homedir(), env = process.env } = {}) {
    if (env.OTAKOS_CLAUDE) return /\.(c?js|mjs)$/i.test(env.OTAKOS_CLAUDE) ? { program: process.execPath, przed: [env.OTAKOS_CLAUDE], zrodlo: 'OTAKOS_CLAUDE' } : { program: env.OTAKOS_CLAUDE, przed: [], zrodlo: 'OTAKOS_CLAUDE' };
    if (platforma === 'win32') {
        const natywny = path.win32.join(dom, '.local', 'bin', 'claude.exe');
        if (cfg.istnieje(natywny)) return { program: natywny, przed: [], zrodlo: 'claude.exe' };
        for (const dir of String(env.PATH ?? env.Path ?? '').split(';').filter(Boolean)) {
            if (!cfg.istnieje(path.win32.join(dir, 'claude.cmd'))) continue;
            const cli = path.win32.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
            if (cfg.istnieje(cli)) return { program: process.execPath, przed: [cli], zrodlo: 'npm (cli.js)' };
        }
        return { program: 'claude.exe', przed: [], zrodlo: 'PATH' };
    }
    return { program: 'claude', przed: [], zrodlo: 'PATH' };
}

/** Środowisko procesu: model przez Ollamę (jak `ollama launch claude`), bez dziedziczenia sesji zewnętrznego Claude Code. */
export function srodowisko(baza = process.env) {
    const env = { ...baza };
    for (const k of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_PID', 'CLAUDECODE']) delete env[k];
    if (!cfg.chmura) {
        env.ANTHROPIC_BASE_URL = cfg.ollama;
        env.ANTHROPIC_AUTH_TOKEN = 'ollama';
        env.ANTHROPIC_API_KEY = '';
    }
    return env;
}

const DOPISEK = () => `Jesteś GŁÓWNY — Ultra Główny agent Katedry OtakOS, prowadzisz Imperium Kreatywne Suwerena (Mistrz Arkadiusz).
Piszesz po polsku. Najpierw CLAUDE.md w katalogu Katedry — tam są zasady i mapa modułów.
UPRAWNIENIA: pliki Katedry czytasz i zmieniasz sam. Każde inne polecenie powłoki czeka na zgodę Suwerena — opisz w polu description jednym zdaniem PO CO, a jeśli da się to zrobić narzędziami do plików, zrób to nimi.
STADO (bez pytania): node scripts/glowny/katedra.mjs <polecenie>:
  stan [fragment nazwy]        — projekty stada, Stół, Nocna Zmiana, ostatnie działania (fakty)
  stado                        — z kim można rozmawiać (TeOgochi)
  zapytaj <id> <pytanie…>      — zleć/zapytaj TeOgochi (np. kodeks, joanna, pionek, zwiadowca) — odpowiada jego model
  stol                         — karty Stołu ratyfikacji
  nocna <robota> [JSON]        — dodaj zadanie do Nocnej Zmiany (np. zwiadowca-hf, projekt-stada-rundy)
  pamiec                       — RAM i procesy
SKILLE: ${cfg.katalogi.filter((k) => cfg.istnieje(k)).map((k) => path.basename(k)).join(', ') || '(brak)'} — katalogi z SKILL.md; czytaj właściwy, gdy zadanie pasuje.
Nie udawaj: mów, co zrobiłeś, a czego nie. Na końcu krótko: co zrobione, co czeka na Suwerena.`;

/** Argumenty `claude -p` (bez powłoki — każdy element osobno). */
export function argumenty({ tekst, sesjaId, wznow, pozwolenia = [], model }) {
    // Tekst zaczynający się od „-" parser argumentów wziąłby za flagę — dokładamy spację.
    const a = ['-p', String(tekst).replace(/^-/, ' -'), '--output-format', 'stream-json', '--verbose', '--permission-mode', 'dontAsk', '--setting-sources', 'project',
        '--max-turns', String(cfg.maxTur), '--model', model, '--allowedTools', ...BEZ_PYTANIA, ...pozwolenia];
    for (const k of cfg.katalogi) if (cfg.istnieje(k)) a.push('--add-dir', k);
    a.push('--append-system-prompt', DOPISEK());
    a.push(wznow ? '--resume' : '--session-id', sesjaId);
    return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sesje
// ─────────────────────────────────────────────────────────────────────────────

const sesje = new Map();      // id → sesja (w pamięci; zapis na dysk po każdej turze)
const procesy = new Map();    // id → proces w toku
const sluchacze = new Map();  // id → Set(fn)

const plikSesji = (id) => path.join(cfg.katalog, `${id}.json`);
async function zapiszSesje(s) {
    await fs.mkdir(cfg.katalog, { recursive: true });
    await fs.writeFile(`${plikSesji(s.id)}.tmp`, JSON.stringify(s, null, 2), 'utf8');
    await fs.rename(`${plikSesji(s.id)}.tmp`, plikSesji(s.id));
}
async function wczytajSesje(id) {
    if (!UUID.test(String(id))) return null;
    if (sesje.has(id)) return sesje.get(id);
    try { const s = JSON.parse(await fs.readFile(plikSesji(id), 'utf8')); s.trwa = false; sesje.set(id, s); return s; } catch { return null; }
}
const nadaj = (s, z) => { for (const f of sluchacze.get(s.id) ?? []) { try { f(z); } catch { /* słuchacz odpadł */ } } };
const dopisz = (s, w) => { const wpis = { ...w, kiedy: new Date().toISOString() }; s.wpisy.push(wpis); if (s.wpisy.length > 500) s.wpisy.splice(0, s.wpisy.length - 500); nadaj(s, { typ: 'wpis', wpis }); };

export function sluchaj(id, fn) {
    if (!sluchacze.has(id)) sluchacze.set(id, new Set());
    sluchacze.get(id).add(fn);
    return () => sluchacze.get(id)?.delete(fn);
}

/** Jedna tura Claude Code: czyta stream-json, dopisuje wpisy, na końcu zbiera odmowy jako prośby do Suwerena. */
function tura(s, tekst, { wznow }) {
    const model = s.model;
    const { program, przed } = znajdzClaude();
    const args = [...przed, ...argumenty({ tekst, sesjaId: s.id, wznow, pozwolenia: s.pozwolenia, model })];
    s.trwa = true; s.blad = null;
    nadaj(s, { typ: 'stan', trwa: true });
    let p;
    try { p = cfg.uruchom(program, args, { cwd: cfg.cwd, env: srodowisko() }); }
    catch (e) { s.trwa = false; s.blad = `Nie uruchomiłem Claude Code: ${e.message}`; dopisz(s, { kto: 'blad', tresc: s.blad }); return Promise.resolve(); }
    procesy.set(s.id, p);
    let bufor = '', bledy = '', wynik = null;
    const linia = (l) => {
        let j; try { j = JSON.parse(l); } catch { return; }
        if (j.type === 'system' && j.subtype === 'init') { s.modelSesji = j.model ?? model; return; }
        if (j.type === 'assistant') {
            for (const c of j.message?.content ?? []) {
                if (c.type === 'text' && c.text?.trim()) dopisz(s, { kto: 'glowny', tresc: c.text.trim() });
                else if (c.type === 'tool_use') dopisz(s, { kto: 'narzedzie', narzedzie: c.name, opis: c.input?.description ?? null, wejscie: skrot(c.input) });
            }
        } else if (j.type === 'result') wynik = j;
    };
    p.stdout.on('data', (b) => { bufor += b.toString('utf8'); const ls = bufor.split('\n'); bufor = ls.pop() ?? ''; ls.forEach(linia); });
    p.stderr.on('data', (b) => { bledy = (bledy + b.toString('utf8')).slice(-2000); });
    return new Promise((resolve) => {
        const koniec = async (kod, bladUruchomienia) => {
            if (bufor) linia(bufor);
            procesy.delete(s.id);
            s.trwa = false;
            if (bladUruchomienia) {
                s.blad = bladUruchomienia.code === 'ENOENT'
                    ? `Nie znalazłem Claude Code („${program}"). Zainstaluj go (npm i -g @anthropic-ai/claude-code albo instalator z claude.ai/code) albo ustaw OTAKOS_CLAUDE na pełną ścieżkę.`
                    : `Claude Code nie wystartował: ${bladUruchomienia.message}`;
            } else if (!wynik) {
                s.blad = `Claude Code zakończył się kodem ${kod} bez wyniku${bledy.trim() ? `: ${bledy.trim().split('\n').slice(-3).join(' | ')}` : ''}${!cfg.chmura ? ` (model ${model} przez Ollamę — czy Ollama działa i ma ten model?)` : ''}`;
            } else if (wynik.is_error) {
                s.blad = String(wynik.result ?? wynik.subtype ?? 'błąd').slice(0, 500);
            }
            if (s.blad) dopisz(s, { kto: 'blad', tresc: s.blad });
            for (const d of wynik?.permission_denials ?? []) {
                const t = tlumacz(d.tool_name, d.tool_input);
                const prosba = { id: crypto.randomBytes(4).toString('hex'), narzedzie: d.tool_name, wejscie: skrot(d.tool_input), ...t, stan: 'czeka' };
                s.prosby.push(prosba);
                dopisz(s, { kto: 'prosba', prosba });
            }
            if (s.prosby.some((x) => x.stan === 'czeka')) {
                await cfg.szyna?.nadaj?.({ agent: 'Główny', rodzaj: 'prosba', tresc: `czeka na zgodę Suwerena: ${s.prosby.filter((x) => x.stan === 'czeka').map((x) => x.coRobi).join(' · ').slice(0, 300)}`, dane: { sesja: s.id } })?.catch?.(() => {});
            }
            s.ostatnia = new Date().toISOString();
            await zapiszSesje(s).catch(() => {});
            nadaj(s, { typ: 'stan', trwa: false, blad: s.blad, czeka: s.prosby.filter((x) => x.stan === 'czeka').length });
            resolve();
        };
        p.on('error', (e) => koniec(null, e));
        p.on('close', (kod) => koniec(kod, null));
    });
}
const skrot = (o) => { try { return JSON.parse(JSON.stringify(o ?? {}, (k, v) => (typeof v === 'string' && v.length > 600 ? `${v.slice(0, 600)}…` : v))); } catch { return {}; } };

/** Stan Claude Code dla panelu. */
export function stan() {
    const c = znajdzClaude();
    return { program: c.program, zrodlo: c.zrodlo, model: cfg.model(), chmura: cfg.chmura, ollama: cfg.chmura ? null : cfg.ollama, katalogi: cfg.katalogi.filter((k) => cfg.istnieje(k)), bezPytania: BEZ_PYTANIA };
}

/** Wiadomość Suwerena: nowa sesja albo dalsza rozmowa. Tura leci w tle; postęp — wpisy (sluchaj / sesja). */
export async function wiadomosc({ tekst, sesja = null, model = null, zrodlo = 'czat' }) {
    const t = String(tekst ?? '').trim();
    if (!t) throw new Error('Pusta wiadomość.');
    if (t.length > 20_000) throw new Error('Za długa wiadomość (maks. 20 000 znaków).');
    let s = sesja ? await wczytajSesje(sesja) : null;
    if (sesja && !s) throw new Error('Nie ma takiej sesji Głównego.');
    if (s?.trwa) throw new Error('Główny jeszcze pracuje nad poprzednią wiadomością.');
    if (s?.prosby.some((x) => x.stan === 'czeka')) throw new Error('Najpierw zdecyduj o prośbach Głównego (✓ albo ✕).');
    const nowa = !s;
    if (!s) {
        s = { id: crypto.randomUUID(), tytul: t.slice(0, 80), zrodlo, od: new Date().toISOString(), model: model || cfg.model(), wpisy: [], prosby: [], pozwolenia: [], trwa: false, blad: null, tury: 0 };
        sesje.set(s.id, s);
    }
    dopisz(s, { kto: 'suweren', tresc: t });
    s.tury++;
    tura(s, t, { wznow: !nowa });
    return { sesja: s.id, model: s.model };
}

/**
 * Decyzje o prośbach (✓/✕). Gdy żadna już nie czeka — sesja wraca do pracy: z pozwoleniem na DOKŁADNIE zatwierdzone
 * polecenia, a odrzucone Główny ma obejść albo powiedzieć, czego brakuje.
 */
export async function decyzja(sesjaId, prosbaId, zgoda) {
    const s = await wczytajSesje(sesjaId);
    if (!s) throw new Error('Nie ma takiej sesji Głównego.');
    if (s.trwa) throw new Error('Główny jeszcze pracuje.');
    const p = s.prosby.find((x) => x.id === prosbaId);
    if (!p || p.stan !== 'czeka') throw new Error('Tej prośby nie ma albo już zdecydowana.');
    p.stan = zgoda ? 'zgoda' : 'odmowa';
    p.decyzja = new Date().toISOString();
    if (zgoda && p.narzedzie === 'Bash' && p.polecenie) s.pozwolenia.push(`Bash(${p.polecenie})`);
    else if (zgoda) s.pozwolenia.push(p.narzedzie);
    dopisz(s, { kto: 'decyzja', prosba: p.id, zgoda: !!zgoda, tresc: `${zgoda ? '✓ Zgoda' : '✕ Odmowa'}: ${p.coRobi}` });
    if (s.prosby.some((x) => x.stan === 'czeka')) { await zapiszSesje(s); return { sesja: s.id, wznowiona: false }; }
    const swieze = s.prosby.filter((x) => x.decyzja && !x.przekazana);
    swieze.forEach((x) => { x.przekazana = true; });
    const tekst = ['Decyzje Suwerena:',
        ...swieze.map((x) => `- ${x.stan === 'zgoda' ? 'ZGODA' : 'ODMOWA'}: ${x.narzedzie} ${x.polecenie}`),
        swieze.some((x) => x.stan === 'zgoda') ? 'Wykonaj teraz polecenia, na które jest zgoda (dokładnie te same), i kontynuuj zadanie.' : '',
        swieze.some((x) => x.stan === 'odmowa') ? 'Odrzuconych nie wykonuj — znajdź inną drogę narzędziami do plików albo powiedz wprost, czego brakuje.' : ''].filter(Boolean).join('\n');
    s.tury++;
    tura(s, tekst, { wznow: true });
    return { sesja: s.id, wznowiona: true };
}

export async function przerwij(sesjaId) {
    const p = procesy.get(sesjaId);
    if (!p) return { przerwano: false };
    try { p.kill(); } catch { /* już nie żyje */ }
    return { przerwano: true };
}

export async function sesja(id) { return wczytajSesje(id); }

export async function lista(ile = 30) {
    let pliki = [];
    try { pliki = (await fs.readdir(cfg.katalog)).filter((f) => f.endsWith('.json')); } catch { /* brak sesji */ }
    const out = [];
    for (const f of pliki) {
        const s = await wczytajSesje(f.slice(0, -5));
        if (s) out.push({ id: s.id, tytul: s.tytul, od: s.od, ostatnia: s.ostatnia ?? s.od, model: s.model, trwa: s.trwa, czeka: s.prosby.filter((x) => x.stan === 'czeka').length, zrodlo: s.zrodlo });
    }
    return out.sort((a, b) => String(b.ostatnia).localeCompare(String(a.ostatnia))).slice(0, ile);
}

export default { skonfiguruj, tlumacz, znajdzClaude, srodowisko, argumenty, stan, wiadomosc, decyzja, przerwij, sesja, lista, sluchaj, BEZ_PYTANIA };
