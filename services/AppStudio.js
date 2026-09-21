/**
 * 🛠️ AppStudio — Kodeks buduje aplikacje w piaskownicy z pętlą testów (od 2026-09-21).
 *
 * Suweren: „TeO App Studio ma działać jak inne apki — tworzyć za pośrednictwem TeOgochi".
 * Dotąd App Studio generowało kod Geminim w przeglądarce (klucz w localStorage, model
 * gemini-2.0-flash-exp) — martwe od miesięcy. Teraz buduje MOST, Kodeksem, lokalnie.
 *
 * PĘTLA (inspiracja: Playwright MCP — agent widzi, co zbudował):
 *   opis / zadanie
 *     → Kodeks (model Mechanika) oddaje CAŁE pliki w blokach `=== PLIK: … ===`
 *     → zapis do _OtakOs_Apki/<id>/ (tylko src/** i index.html — nic poza projektem)
 *     → weryfikacja: tsc --noEmit, potem vite build (node_modules: junction do TeO_App_Studio,
 *       więc zero npm install — react, vite, typescript są tam)
 *     → puppeteer otwiera dist pod http://127.0.0.1:<most>/apki/<id>/, zbiera błędy konsoli
 *       i wyjątki strony, robi zrzut
 *     → błędy wracają do Kodeksa (maks. RUND); czysto → git commit
 *   Każdy krok idzie na szynę jako „Kodeks", a Nocna Zmiana może to robić w tle.
 *
 * ⚠️ GRANICE, CELOWO: Kodeks nie dodaje zależności (tylko react/react-dom), nie wychodzi
 * poza src/ i index.html, nie uruchamia komend. Apka jest samowystarczalna i statyczna —
 * to, co da się wystawić na moście i zabrać na USB. Cofnięcie = git reset do poprzedniego
 * commitu (historia zostaje w reflogu).
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

let cfg = {
    ollamaBase: 'http://127.0.0.1:11434',
    model: () => 'qwen3.5:9b',
    katalog: path.join(process.cwd(), '..', '_OtakOs_Apki'),
    nodeModules: path.join(process.cwd(), '..', 'TeO_App_Studio', 'node_modules'),
    portMostu: 3001,
    szyna: null,
    puppeteer: null,   // wstrzykiwany z mostu (import dynamiczny), żeby AppStudio nie ciągnął Chrome przy każdym imporcie
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

const RUND = 4;
const MAX_KONTEKST_ZNAKOW = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// SZABLON PROJEKTU — minimalny Vite + React + TS, base './' (działa pod /apki/<id>/ i z USB)
// ─────────────────────────────────────────────────────────────────────────────
const SZABLON = {
    'package.json': (nazwa) => JSON.stringify({
        name: nazwa, private: true, version: '0.1.0', type: 'module',
        scripts: { dev: 'vite', build: 'tsc --noEmit -p tsconfig.json && vite build', preview: 'vite preview' },
        dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
        devDependencies: { '@vitejs/plugin-react': '^5.1.1', typescript: '~5.9.3', vite: '^7.2.4' },
    }, null, 2),
    'vite.config.ts': () => `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' — apka działa pod dowolną podścieżką (most: /apki/<id>/, USB: plik).
export default defineConfig({ plugins: [react()], base: './' });
`,
    'tsconfig.json': () => JSON.stringify({
        compilerOptions: {
            target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler',
            jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true, isolatedModules: true, allowImportingTsExtensions: true,
            types: [],
        },
        include: ['src'],
    }, null, 2),
    'index.html': (nazwa) => `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <title>${nazwa}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    'src/main.tsx': () => `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
    'src/App.tsx': (nazwa, opis) => `export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>${nazwa}</h1>
      <p>${opis || 'Nowa aplikacja z TeO App Studio. Kodeks zaraz ją zbuduje.'}</p>
    </main>
  );
}
`,
    'src/index.css': () => `:root { color-scheme: light dark; }
body { margin: 0; background: #0b0f1a; color: #e6ecff; }
`,
};

// ─────────────────────────────────────────────────────────────────────────────
// PROJEKTY
// ─────────────────────────────────────────────────────────────────────────────
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'apka';
const idOk = (id) => /^[a-z0-9-]{2,48}$/.test(String(id || ''));
const dirProjektu = (id) => path.join(cfg.katalog, id);
const plikProjektu = (id) => path.join(dirProjektu(id), 'projekt.json');

async function git(cwd, args) {
    const { stdout } = await run('git', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    return String(stdout || '').trim();
}
async function czytajProjekt(id) { try { return JSON.parse(await fs.readFile(plikProjektu(id), 'utf8')); } catch { return null; } }
async function zapiszProjekt(p) { await fs.writeFile(plikProjektu(p.id), JSON.stringify(p, null, 2), 'utf8'); return p; }
function szyna(rodzaj, tresc, dane) { return cfg.szyna?.nadaj?.({ agent: 'Kodeks', rodzaj, tresc, dane }).catch(() => {}); }

export async function projekty() {
    if (!fsSync.existsSync(cfg.katalog)) return [];
    const lista = [];
    for (const d of await fs.readdir(cfg.katalog)) {
        const p = await czytajProjekt(d);
        if (p) lista.push({ id: p.id, nazwa: p.nazwa, opis: p.opis, utworzono: p.utworzono, ostatnia: p.historia.at(-1)?.kiedy ?? p.utworzono, zbudowana: fsSync.existsSync(path.join(dirProjektu(d), 'dist', 'index.html')), zrzut: !!p.ostatniZrzut, iteracji: p.historia.length });
    }
    return lista.sort((a, b) => (a.ostatnia < b.ostatnia ? 1 : -1));
}

export async function nowyProjekt({ nazwa, opis = '' }) {
    const czysta = String(nazwa || '').trim();
    if (!czysta) throw new Error('Podaj nazwę aplikacji.');
    let id = slug(czysta);
    if (fsSync.existsSync(dirProjektu(id))) id = `${id}-${crypto.randomBytes(2).toString('hex')}`;
    const dir = dirProjektu(id);
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    for (const [rel, tresc] of Object.entries(SZABLON)) await fs.writeFile(path.join(dir, rel), tresc(czysta, String(opis).trim()), 'utf8');
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules\ndist\nzrzut*.png\nnieudane\nprojekt.json\n', 'utf8');
    // node_modules jako junction do App Studio — react/vite/typescript bez instalowania czegokolwiek.
    if (fsSync.existsSync(cfg.nodeModules)) { try { await fs.symlink(cfg.nodeModules, path.join(dir, 'node_modules'), 'junction'); } catch { /* bez node_modules build powie, czego brak */ } }
    await git(dir, ['init', '-q']);
    await git(dir, ['add', '-A']);
    await git(dir, ['-c', 'user.name=Kodeks', '-c', 'user.email=kodeks@katedra.local', 'commit', '-q', '-m', 'szablon: nowa aplikacja z TeO App Studio']);
    const p = { id, nazwa: czysta, opis: String(opis).trim(), utworzono: new Date().toISOString(), historia: [], ostatniZrzut: null };
    await zapiszProjekt(p);
    await szyna('praca', `nowa apka „${czysta}" (${id}) — szablon gotowy`, { projekt: id });
    return p;
}

export async function projekt(id) {
    if (!idOk(id)) return null;
    const p = await czytajProjekt(id);
    if (!p) return null;
    return { ...p, pliki: await pliki(id), zbudowana: fsSync.existsSync(path.join(dirProjektu(id), 'dist', 'index.html')), zadanieWToku: [...zadania.values()].find((z) => z.projekt === id && z.stan === 'trwa')?.id ?? null };
}

/** Pliki źródłowe projektu (src/** + index.html) z treścią — dla promptu i podglądu. */
export async function pliki(id) {
    const dir = dirProjektu(id);
    const out = [];
    const chodz = async (rel) => {
        for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
            const r = path.posix.join(rel, e.name);
            if (e.isDirectory()) await chodz(r);
            else if (/\.(tsx?|css|json|svg)$/.test(e.name)) out.push({ sciezka: r, tresc: await fs.readFile(path.join(dir, r), 'utf8') });
        }
    };
    if (fsSync.existsSync(path.join(dir, 'src'))) await chodz('src');
    if (fsSync.existsSync(path.join(dir, 'index.html'))) out.push({ sciezka: 'index.html', tresc: await fs.readFile(path.join(dir, 'index.html'), 'utf8') });
    return out;
}

export async function zrzut(id) {
    const p = idOk(id) ? await czytajProjekt(id) : null;
    if (!p?.ostatniZrzut) return null;
    const f = path.join(dirProjektu(id), p.ostatniZrzut);
    return fsSync.existsSync(f) ? f : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// KODEKS — prompt, format plików, parser
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_KODEKSA = `Jesteś Kodeks — TeOgochi od kodu w Katedrze OtakOS. Budujesz aplikację webową w Vite + React 19 + TypeScript (strict). Interfejs po polsku.

ZASADY, KTÓRYCH NIE ŁAMIESZ:
- Oddajesz WYŁĄCZNIE pliki, w blokach dokładnie tej postaci (bez markdownu wokół, bez komentarzy poza blokami):
=== PLIK: src/App.tsx ===
...cała treść pliku...
=== KONIEC ===
- Każdy plik oddajesz W CAŁOŚCI (od pierwszej do ostatniej linii). Żadnych „reszta bez zmian".
- Wolno Ci pisać tylko w src/** i index.html. Nie ruszasz package.json, vite.config.ts, tsconfig.json.
- Zależności: tylko react i react-dom. Żadnych importów bibliotek zewnętrznych, żadnych URL-i CDN.
- Stan trzymasz w localStorage, gdy ma przetrwać odświeżenie. Bez backendu, bez fetch do obcych adresów.
- Style: CSS w src/index.css albo inline. Bez Tailwinda (nie ma go w projekcie).
- TypeScript strict: typuj propsy i stan, nie używaj any bez potrzeby, importy React nie są potrzebne do JSX.
- Gdy dostajesz BŁĘDY z weryfikacji — poprawiasz tylko to, co trzeba, i znów oddajesz całe pliki, których dotknąłeś.
- Nie dodawaj plików, których nikt nie importuje. main.tsx i index.css zmieniasz tylko, gdy to konieczne.
- Timery: typ ReturnType<typeof setTimeout>, NIE NodeJS.Timeout (projekt nie ma typów Node — zmierzony błąd tsc).
- CZAS TRZYMAJ W SEKUNDACH (duration: 4, nie 4000) i odliczaj po 1 co 1000 ms przez setInterval w jednym useEffect zależnym tylko od tego, czy timer biegnie. Mieszanie ms z sekundami to zmierzona przyczyna „martwego” timera.
- W useEffect sprzątaj interwały i timeouty; nie zostawiaj pętli, które ciągle zapisują do localStorage.`;

function wylowPliki(tekst) {
    const out = [];
    const re = /===\s*PLIK:\s*([^\n=]+?)\s*===\s*\n([\s\S]*?)\n?===\s*KONIEC\s*===/g;
    let m;
    while ((m = re.exec(tekst))) {
        const sciezka = m[1].trim().replace(/\\/g, '/').replace(/^\.?\//, '');
        if (!/^(src\/[A-Za-z0-9_./-]+\.(tsx?|css|json|svg)|index\.html)$/.test(sciezka) || sciezka.includes('..')) continue;
        out.push({ sciezka, tresc: m[2].replace(/\r\n/g, '\n').replace(/^```[a-z]*\n/, '').replace(/\n```$/, '') + '\n' });
    }
    return out;
}

/**
 * Generacja STRUMIENIEM. Bez strumienia Node (undici) urywa połączenie po 300 s bez nagłówków
 * („fetch failed") — a Kodeks na 9B z częściowym GPU pisze całą apkę dłużej (zmierzone
 * 2026-09-21: pad po 304 s). Ze strumieniem nagłówki są od razu, a my składamy kawałki;
 * sufit dotyczy CAŁEJ generacji. `naKawalek` pozwala pokazać postęp (liczba znaków).
 */
async function pisz({ system, prompt, model, timeoutMs = 20 * 60_000, naKawalek = null }) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(`${cfg.ollamaBase}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            // think:false — qwen3.x bez tego oddaje pustą treść (zmierzone).
            body: JSON.stringify({ model, system, prompt, stream: true, think: false, options: { temperature: 0.2, num_ctx: 16384 } }),
        });
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        let tekst = '', tokeny = 0, bufor = '';
        const czytnik = r.body.getReader();
        const dek = new TextDecoder();
        for (;;) {
            const { value, done } = await czytnik.read();
            if (done) break;
            bufor += dek.decode(value, { stream: true });
            let i;
            while ((i = bufor.indexOf('\n')) >= 0) {
                const linia = bufor.slice(0, i).trim(); bufor = bufor.slice(i + 1);
                if (!linia) continue;
                try {
                    const j = JSON.parse(linia);
                    if (j.response) { tekst += j.response; naKawalek?.(tekst.length); }
                    if (j.done) tokeny = (Number(j.eval_count) || 0) + (Number(j.prompt_eval_count) || 0);
                } catch { /* niepełna linia */ }
            }
        }
        return { tekst, tokeny };
    } catch (e) { throw new Error(e.name === 'AbortError' ? `Ollama nie zdążyła w ${Math.round(timeoutMs / 1000)} s` : e.message); }
    finally { clearTimeout(t); }
}

// ─────────────────────────────────────────────────────────────────────────────
// WERYFIKACJA: tsc → vite build → puppeteer
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Do błędu tsc doklejamy TREŚĆ wskazanej linii. Mały model dostaje „App.tsx(46,60)" i musi
 * liczyć linie w głowie — 3 rundy z rzędu poprawiał nie tę linię (zmierzone 2026-09-21,
 * `prevCycles`). Z cytatem linii nie ma czego zgadywać.
 */
async function dopiszLinie(dir, log) {
    const re = /^(src\/[^\s(]+)\((\d+),(\d+)\): error (TS\d+): (.*)$/gm;
    const cache = new Map();
    const wyjscie = [];
    let m;
    while ((m = re.exec(log)) && wyjscie.length < 12) {
        const [, plik, linia, kol, kod, opis] = m;
        if (!cache.has(plik)) { try { cache.set(plik, (await fs.readFile(path.join(dir, plik), 'utf8')).split(/\r?\n/)); } catch { cache.set(plik, []); } }
        const tresc = cache.get(plik)[Number(linia) - 1];
        wyjscie.push(`${plik}(${linia},${kol}): ${kod}: ${opis}${tresc !== undefined ? `\n    linia ${linia}: ${tresc.trim().slice(0, 200)}` : ''}`);
    }
    return wyjscie.length ? wyjscie.join('\n') : log;
}

async function weryfikujBuild(dir) {
    const t0 = Date.now();
    const nm = path.join(dir, 'node_modules');
    if (!fsSync.existsSync(nm)) return { ok: false, etap: 'node_modules', log: `Brak node_modules (junction do ${cfg.nodeModules} nie powstał).`, sekundy: 0 };
    try {
        await run(process.execPath, [path.join(nm, 'typescript', 'bin', 'tsc'), '--noEmit', '-p', 'tsconfig.json'], { cwd: dir, windowsHide: true, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
    } catch (e) { return { ok: false, etap: 'tsc', log: await dopiszLinie(dir, `${e.stdout || ''}\n${e.stderr || ''}`.trim().slice(-6000)), sekundy: Math.round((Date.now() - t0) / 1000) }; }
    try {
        await run(process.execPath, [path.join(nm, 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'error'], { cwd: dir, windowsHide: true, timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
    } catch (e) { return { ok: false, etap: 'vite build', log: `${e.stdout || ''}\n${e.stderr || ''}`.trim().slice(-6000), sekundy: Math.round((Date.now() - t0) / 1000) }; }
    return { ok: true, etap: 'build', log: 'tsc + vite build: OK', sekundy: Math.round((Date.now() - t0) / 1000) };
}

/** Puppeteer: otwórz zbudowaną apkę na moście, zbierz błędy, zrób zrzut. */
async function przetestujWPrzegladarce(id) {
    const t0 = Date.now();
    if (!cfg.puppeteer) return { ok: null, bledy: [], log: 'puppeteer niedostępny — test w przeglądarce pominięty', sekundy: 0 };
    const dir = dirProjektu(id);
    const nazwaZrzutu = `zrzut-${Date.now()}.png`;
    const bledy = [];
    let przegladarka = null;
    try {
        przegladarka = await cfg.puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const strona = await przegladarka.newPage();
        await strona.setViewport({ width: 1200, height: 800 });
        strona.on('console', (m) => {
            if (m.type() !== 'error') return;
            // favicon.ico 404 to nie błąd apki (szablon ma już <link rel="icon" href="data:,">, starsze projekty nie)
            if (/favicon/i.test(m.location?.()?.url || '') || (/Failed to load resource/.test(m.text()) && /favicon/i.test(m.location?.()?.url || ''))) return;
            bledy.push(`console.error: ${m.text().slice(0, 400)}${m.location?.()?.url ? ` (${m.location().url.slice(0, 120)})` : ''}`);
        });
        strona.on('pageerror', (e) => bledy.push(`wyjątek: ${String(e.message || e).slice(0, 400)}`));
        strona.on('requestfailed', (r) => { if (!/favicon/.test(r.url())) bledy.push(`nie doszło: ${r.url().slice(0, 200)}`); });
        // 'load' + chwila, nie 'networkidle0': idle nigdy nie nadchodził (timeout 30 s przy stronie,
        // która ładuje się w 137 ms — zmierzone 2026-09-21). Apka z timerem i tak ma prawo „żyć".
        await strona.goto(`http://127.0.0.1:${cfg.portMostu}/apki/${id}/`, { waitUntil: 'load', timeout: 20_000 });
        await new Promise((r) => setTimeout(r, 1500));
        const root = await strona.$eval('#root', (el) => el.innerHTML.length).catch(() => 0);
        if (!root) bledy.push('#root jest pusty — React nic nie wyrenderował');
        // MIGAWKI ZACHOWANIA: tekst strony przed kliknięciem, po kliknięciu pierwszego przycisku,
        // i po kilku sekundach. Zmierzone 2026-09-21: apka „czysta" wg konsoli miała martwy timer
        // (Wdech 4 s na zawsze) — tsc i konsola tego nie widzą, model ocenia z migawek (patrz ocenZachowanie).
        const tekst = () => strona.$eval('#root', (el) => el.innerText.replace(/\s+/g, ' ').trim().slice(0, 700)).catch(() => '');
        const migawki = [{ kiedy: 'po załadowaniu', tekst: await tekst() }];
        const przyciski = await strona.$$('button');
        if (przyciski.length) {
            const etykieta = await przyciski[0].evaluate((b) => b.innerText.trim().slice(0, 40)).catch(() => '?');
            await przyciski[0].click().catch(() => {});
            await new Promise((r) => setTimeout(r, 2500));
            migawki.push({ kiedy: `2,5 s po kliknięciu „${etykieta}"`, tekst: await tekst() });
            await new Promise((r) => setTimeout(r, 4000));
            migawki.push({ kiedy: `6,5 s po kliknięciu „${etykieta}"`, tekst: await tekst() });
        }
        await strona.screenshot({ path: path.join(dir, nazwaZrzutu) });
        // Zostaje tylko ostatni zrzut — poprzednie do kosza (to nie są dane Suwerena, tylko podgląd).
        for (const f of await fs.readdir(dir)) if (/^zrzut-.*\.png$/.test(f) && f !== nazwaZrzutu) await fs.rm(path.join(dir, f), { force: true });
        return { ok: bledy.length === 0, bledy, migawki, zrzut: nazwaZrzutu, log: bledy.length ? bledy.join('\n') : 'przeglądarka: bez błędów, #root wyrenderowany', sekundy: Math.round((Date.now() - t0) / 1000) };
    } catch (e) {
        return { ok: false, bledy: [`puppeteer: ${e.message.slice(0, 300)}`], log: `puppeteer: ${e.message}`, sekundy: Math.round((Date.now() - t0) / 1000) };
    } finally { try { await przegladarka?.close(); } catch { /* — */ } }
}

/**
 * Kodeks ocenia własne dzieło z migawek tekstu strony: czy po kliknięciu coś się dzieje
 * i czy to odpowiada zadaniu. Krótki prompt (sekundy, nie minuty). Ocena jest OSTROŻNA:
 * gdy model nie jest pewien albo odpowie bełkotem — uznajemy, że jest OK, żeby nie
 * blokować dobrej apki przez kapryśny sędzia. Blokuje tylko wyraźne „NIE" z powodem.
 */
export async function ocenZachowanie({ cel, migawki, model }) {
    if (!migawki || migawki.length < 3) return { ok: true, powod: null };
    // KROK 1 (deterministyczny): czy między 2,5 s a 6,5 s po kliknięciu strona się ZMIENIŁA?
    // Jeśli tak — coś żyje, przepuszczamy bez pytania modelu. Sędzia-model pytany o żywą
    // apkę wymyślał zastrzeżenia (zmierzone 2026-09-21: odrzucił poprawny timer), więc
    // pytamy go TYLKO o martwą stronę i tylko o jedno: czy zadanie w ogóle wymaga zmian w czasie.
    const przed = String(migawki[1].tekst || ''), po = String(migawki[2].tekst || '');
    if (przed !== po) return { ok: true, powod: null };
    const prompt = `ZADANIE APLIKACJI:\n${cel}\n\nPo kliknięciu pierwszego przycisku tekst strony przez 4 sekundy NIE ZMIENIŁ SIĘ ANI O ZNAK:\n${przed || '(pusto)'}\n\nCzy to zadanie wymaga, żeby po kliknięciu coś się zmieniało w czasie (timer, odliczanie, animowana faza, licznik)? Jeśli TAK — brak zmian to błąd. Jeśli aplikacja z natury jest statyczna (formularz, lista, kalkulator bez zegara) — to nie błąd.\nOdpowiedz WYŁĄCZNIE JSON-em: {"ok": true} albo {"ok": false, "powod": "jedno zdanie po polsku"}`;
    try {
        const odp = await pisz({ system: 'Jesteś uczciwym testerem aplikacji. Odpowiadasz tylko JSON-em.', prompt, model, timeoutMs: 180_000 });
        const m = odp.tekst.match(/\{[\s\S]*\}/);
        const j = m ? JSON.parse(m[0]) : null;
        if (!j || typeof j.ok !== 'boolean') return { ok: true, powod: null, niepewne: true };
        return { ok: j.ok, powod: j.ok ? null : String(j.powod || 'po kliknięciu nic się nie dzieje, a zadanie wymaga zmian w czasie').slice(0, 300) };
    } catch { return { ok: true, powod: null, niepewne: true }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZADANIA — pętla Kodeksa w tle
// ─────────────────────────────────────────────────────────────────────────────
const zadania = new Map();   // id → { id, projekt, zadanie, stan, kroki[], rundy, wynik, od }
const noweId = () => `kx-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;

export function zadanie(id) { return zadania.get(id) ?? null; }
export function zadaniaProjektu(projektId) { return [...zadania.values()].filter((z) => z.projekt === projektId).map((z) => ({ id: z.id, stan: z.stan, zadanie: z.zadanie, rundy: z.rundy, od: z.od, koniec: z.koniec ?? null })); }

function kontekstPlikow(lista) {
    let calosc = '';
    for (const p of lista) calosc += `=== PLIK: ${p.sciezka} ===\n${p.tresc.trimEnd()}\n=== KONIEC ===\n\n`;
    return calosc.length > MAX_KONTEKST_ZNAKOW ? calosc.slice(0, MAX_KONTEKST_ZNAKOW) + '\n[…ucięto — projekt za duży na jeden prompt…]' : calosc;
}

/**
 * Zleć Kodeksowi zadanie w projekcie. Zwraca od razu id zadania; praca w tle.
 * `naKrok` — opcjonalny callback dla SSE (mostu) — dostaje każdy krok.
 */
export async function buduj(projektId, { zadanie: tresc, model, rundy = RUND } = {}, naKrok = () => {}) {
    if (!idOk(projektId) || !(await czytajProjekt(projektId))) throw new Error('Nie ma takiego projektu.');
    const cel = String(tresc || '').trim();
    if (!cel) throw new Error('Powiedz Kodeksowi, co ma zbudować.');
    if ([...zadania.values()].some((z) => z.projekt === projektId && z.stan === 'trwa')) throw new Error('Kodeks już pracuje nad tym projektem — poczekaj.');
    const z = { id: noweId(), projekt: projektId, zadanie: cel, stan: 'trwa', kroki: [], rundy: 0, wynik: null, od: new Date().toISOString(), model: model || cfg.model() };
    zadania.set(z.id, z);
    const krok = (typ, tekst, dane) => { const k = { typ, tekst: String(tekst).slice(0, 4000), kiedy: new Date().toISOString(), ...(dane || {}) }; z.kroki.push(k); naKrok(k); return k; };

    (async () => {
        const dir = dirProjektu(projektId);
        const t0 = Date.now();
        await szyna('praca', `buduję w „${projektId}": ${cel.slice(0, 160)}`, { projekt: projektId, zadanie: z.id });
        let feedback = '';
        let ostatniZrzut = null;
        let ok = false;
        // Ten sam błąd w kółko = model nie czyta komunikatu (zmierzone 2026-09-21: qwen3.5:9b
        // 3 rundy z rzędu nie dodał 'idle' do unii Phase). Za drugim razem zmieniamy ton
        // prompta, za trzecim przerywamy — nie palimy kolejnych 5 minut na to samo.
        let poprzedniBlad = '';
        let powtorki = 0;
        let ostatniBuildOk = false;   // build przeszedł, tylko przeglądarka marudziła → warto zachować
        try {
            for (let runda = 1; runda <= rundy; runda++) {
                z.rundy = runda;
                const obecne = await pliki(projektId);
                const eskalacja = powtorki >= 1
                    ? `\nUWAGA: to DOKŁADNIE TEN SAM błąd, co w poprzedniej rundzie — Twoja poprawka go nie usunęła. Zanim oddasz pliki, napisz w pierwszej linii odpowiedzi jednym zdaniem, co konkretnie zmieniasz (np. „dodaję 'idle' do typu Phase"), a potem bloki plików. Sprawdź numer linii z błędu i popraw TĘ linię i jej typ.\n`
                    : '';
                const prompt = `PROJEKT: ${projektId}\n\nOBECNE PLIKI:\n${kontekstPlikow(obecne)}\nZADANIE SUWERENA:\n${cel}\n${feedback ? `\nBŁĘDY Z POPRZEDNIEJ RUNDY (${runda - 1}) — POPRAW JE:\n${feedback}\n${eskalacja}` : ''}\nOddaj pliki, które tworzysz lub zmieniasz, w blokach === PLIK: … === / === KONIEC ===.`;
                const kPisze = krok('model', `runda ${runda}/${rundy}: Kodeks (${z.model}) pisze…`);
                let ostatniMeldunek = 0;
                const odp = await pisz({ system: SYSTEM_KODEKSA, prompt, model: z.model, naKawalek: (n) => {
                    // meldunek co ~2000 znaków — żeby front widział, że model żyje, bez zalewania szyny
                    if (n - ostatniMeldunek >= 2000) { ostatniMeldunek = n; kPisze.znakow = n; naKrok({ typ: 'postep', tekst: `Kodeks napisał ${n} znaków…`, znakow: n, kiedy: new Date().toISOString() }); }
                } });
                const nowe = wylowPliki(odp.tekst);
                if (!nowe.length) { feedback = 'Nie znalazłem żadnego bloku === PLIK: … === w Twojej odpowiedzi. Oddaj pliki DOKŁADNIE w tym formacie.'; krok('blad', `runda ${runda}: model nie oddał plików (${odp.tokeny} tokenów)`); continue; }
                for (const p of nowe) { await fs.mkdir(path.dirname(path.join(dir, p.sciezka)), { recursive: true }); await fs.writeFile(path.join(dir, p.sciezka), p.tresc, 'utf8'); }
                krok('pliki', `runda ${runda}: zapisano ${nowe.length} plik(ów): ${nowe.map((p) => p.sciezka).join(', ')}`, { pliki: nowe.map((p) => p.sciezka), tokeny: odp.tokeny });

                const w = await weryfikujBuild(dir);
                krok(w.ok ? 'build' : 'blad', `${w.etap} (${w.sekundy} s): ${w.ok ? 'OK' : w.log.slice(0, 1500)}`);
                ostatniBuildOk = w.ok;
                if (!w.ok) {
                    feedback = `${w.etap}:\n${w.log}`;
                    const odcisk = w.log.replace(/\s+/g, ' ').trim().slice(0, 400);
                    powtorki = odcisk === poprzedniBlad ? powtorki + 1 : 0;
                    poprzedniBlad = odcisk;
                    if (powtorki >= 2) { krok('blad', `ten sam błąd trzeci raz z rzędu — przerywam, żeby nie palić kolejnych rund`); break; }
                    continue;
                }

                const t = await przetestujWPrzegladarce(projektId);
                if (t.zrzut) ostatniZrzut = t.zrzut;
                krok(t.ok === false ? 'blad' : 'test', `przeglądarka (${t.sekundy} s): ${t.log.slice(0, 1500)}`, { zrzut: t.zrzut ?? null });
                if (t.ok === false) { feedback = `Aplikacja zbudowała się, ale w przeglądarce:\n${t.bledy.join('\n')}`; continue; }
                const o = await ocenZachowanie({ cel, migawki: t.migawki, model: z.model });
                krok(o.ok ? 'test' : 'blad', o.ok ? `ocena zachowania: zgodne z zadaniem${o.niepewne ? ' (sędzia niepewny — przepuszczam)' : ''}` : `ocena zachowania: ${o.powod}`, { migawki: t.migawki });
                if (!o.ok) { feedback = `Aplikacja działa bez błędów konsoli, ale ZACHOWUJE SIĘ źle: ${o.powod}
PRZEJRZYJ PO KOLEI (zmierzone przyczyny takich błędów): (1) JEDNOSTKI — czy czas trwania jest w ms (4000), a odliczasz po 1 na sekundę? Trzymaj wszystko w sekundach. (2) useEffect — czy interwał/timeout jest tworzony i czyszczony w tym samym efekcie, z właściwymi zależnościami? (3) czy stan naprawdę się zmienia (setState na nowej wartości, nie mutacja)? (4) czy przycisk woła funkcję, która startuje timer?\nMigawki tekstu strony:\n${(t.migawki || []).map((m) => `[${m.kiedy}] ${m.tekst}`).join('\n')}`; continue; }
                ok = true;
                break;
            }
            const p = await czytajProjekt(projektId);
            if (ostatniZrzut) p.ostatniZrzut = ostatniZrzut;
            let commit = null;
            if (!ok && ostatniBuildOk) {
                // Build przeszedł, padł tylko test w przeglądarce: zachowujemy — to działająca
                // apka z ostrzeżeniem, a nie kod, który się nie kompiluje. Suweren widzi powód.
                await git(dir, ['add', '-A']);
                try { await git(dir, ['-c', 'user.name=Kodeks', '-c', 'user.email=kodeks@katedra.local', 'commit', '-q', '-m', `Kodeks (z ostrzeżeniami przeglądarki): ${cel.slice(0, 180)}`]); commit = await git(dir, ['rev-parse', '--short', 'HEAD']); } catch { /* nic */ }
                krok('stan', `build przeszedł, test w przeglądarce nie — zachowuję zmiany jako commit ${commit ?? '?'} z ostrzeżeniem`);
            } else if (!ok) {
                // Nieudana próba NIE zostaje w projekcie: zapisujemy ją jako diff do wglądu
                // i wracamy do ostatniego dobrego commitu + przebudowujemy dist, żeby podgląd
                // dalej pokazywał działającą apkę (a nie kod, który nie przechodzi tsc).
                try {
                    const diff = await git(dir, ['diff']);
                    if (diff) { await fs.mkdir(path.join(dir, 'nieudane'), { recursive: true }); await fs.writeFile(path.join(dir, 'nieudane', `${z.id}.diff`), diff, 'utf8'); }
                    await git(dir, ['checkout', '--', '.']);
                    await git(dir, ['clean', '-fdq', '--', 'src']);
                    const w = await weryfikujBuild(dir);
                    krok('stan', `przywrócono ostatni dobry stan projektu (${w.ok ? 'dist przebudowany' : 'build starego stanu: ' + w.etap}); nieudana próba w nieudane/${z.id}.diff`);
                } catch (e) { krok('blad', `nie udało się przywrócić projektu: ${e.message}`); }
            }
            if (ok) {
                await git(dir, ['add', '-A']);
                try { await git(dir, ['-c', 'user.name=Kodeks', '-c', 'user.email=kodeks@katedra.local', 'commit', '-q', '-m', `Kodeks: ${cel.slice(0, 200)}`]); commit = await git(dir, ['rev-parse', '--short', 'HEAD']); } catch { /* nic do commitowania */ }
            }
            const sekundy = Math.round((Date.now() - t0) / 1000);
            p.historia.push({ zadanie: z.id, tresc: cel, ok, rundy: z.rundy, sekundy, kiedy: new Date().toISOString(), commit, model: z.model });
            await zapiszProjekt(p);
            z.stan = ok ? 'gotowe' : 'blad';
            z.wynik = { ok, rundy: z.rundy, sekundy, commit, zrzut: ostatniZrzut, powod: ok ? null : `Po ${z.rundy} rundach nadal błędy — ostatnie: ${feedback.slice(0, 600)}` };
            z.koniec = new Date().toISOString();
            krok(ok ? 'koniec' : 'blad', ok ? `GOTOWE w ${sekundy} s, ${z.rundy} rund, commit ${commit}` : z.wynik.powod);
            await szyna(ok ? 'praca' : 'blad', ok ? `„${projektId}": zbudowane w ${sekundy} s (${z.rundy} rund) — ${cel.slice(0, 100)}` : `„${projektId}": nie udało się po ${z.rundy} rundach — ${cel.slice(0, 100)}`, { projekt: projektId, zadanie: z.id });
        } catch (e) {
            z.stan = 'blad'; z.koniec = new Date().toISOString();
            z.wynik = { ok: false, rundy: z.rundy, sekundy: Math.round((Date.now() - t0) / 1000), powod: e.message };
            krok('blad', `padło: ${e.message}`);
            await szyna('blad', `„${projektId}": ${e.message}`, { projekt: projektId, zadanie: z.id });
        }
    })();

    return { id: z.id, projekt: projektId, model: z.model };
}

/** Cofnij ostatnią iterację Kodeksa (git reset do poprzedniego commitu) i przebuduj dist. */
export async function cofnij(projektId) {
    if (!idOk(projektId)) throw new Error('Zły identyfikator.');
    const dir = dirProjektu(projektId);
    const p = await czytajProjekt(projektId);
    if (!p) throw new Error('Nie ma takiego projektu.');
    if ([...zadania.values()].some((z) => z.projekt === projektId && z.stan === 'trwa')) throw new Error('Kodeks pracuje — nie cofam w trakcie.');
    const ile = Number(await git(dir, ['rev-list', '--count', 'HEAD']));
    if (ile < 2) throw new Error('Jest tylko szablon — nie ma czego cofać.');
    await git(dir, ['reset', '--hard', '-q', 'HEAD~1']);
    p.historia.push({ zadanie: null, tresc: '↩ cofnięto ostatnią zmianę', ok: true, rundy: 0, sekundy: 0, kiedy: new Date().toISOString(), commit: await git(dir, ['rev-parse', '--short', 'HEAD']) });
    await zapiszProjekt(p);
    const w = await weryfikujBuild(dir);
    await szyna('praca', `„${projektId}": cofnięto ostatnią zmianę (${w.ok ? 'dist przebudowany' : 'build padł: ' + w.etap})`, { projekt: projektId });
    return { ok: true, build: w, commit: p.historia.at(-1).commit };
}

export async function usunProjekt(projektId) {
    if (!idOk(projektId)) throw new Error('Zły identyfikator.');
    if ([...zadania.values()].some((z) => z.projekt === projektId && z.stan === 'trwa')) throw new Error('Kodeks pracuje — nie usuwam w trakcie.');
    const dir = dirProjektu(projektId);
    if (!fsSync.existsSync(dir)) return false;
    // junction node_modules odpinamy jawnie — rm -rf przez junction NIE wchodzi do celu, ale wolę nie zgadywać.
    try { await fs.unlink(path.join(dir, 'node_modules')); } catch { /* nie było */ }
    await fs.rm(dir, { recursive: true, force: true });
    return true;
}

export default { skonfiguruj, projekty, nowyProjekt, projekt, pliki, zrzut, buduj, zadanie, zadaniaProjektu, cofnij, usunProjekt };
