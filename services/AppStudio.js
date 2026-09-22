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
import http from 'http';
import * as Persony from './Persony.js';

const run = promisify(execFile);

let cfg = {
    ollamaBase: 'http://127.0.0.1:11434',
    model: () => 'qwen3.5:9b',
    katalog: path.join(process.cwd(), '..', '_OtakOs_Apki'),
    nodeModules: path.join(process.cwd(), '..', 'TeO_App_Studio', 'node_modules'),
    // Gry: three.js + @types/three leżą w Games Studio — osobna junction dla typu 'gra'.
    nodeModulesGry: path.join(process.cwd(), '..', 'TeO_Games_Studio', 'node_modules'),
    portMostu: 3001,
    szyna: null,
    puppeteer: null,   // wstrzykiwany z mostu (import dynamiczny), żeby AppStudio nie ciągnął Chrome przy każdym imporcie
    // Klucze chmury z Kibla (funkcje mostu). Suweren (2026-09-21): „klucze niech będą dodatkową
    // opcją, lecz domyślnie lokalnie" — więc chmura tylko, gdy zlecenie wprost poda model
    // `claude:…` albo `gemini:…`; bez klucza uczciwy błąd, nigdy ciche przełączenie.
    klucze: { anthropic: async () => null, gemini: async () => null },
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
// SZABLON GRY — three.js + TS (bez Reacta), okno stanu `window.__gra` do testów
// Suweren (2026-09-21): „buduj z three.js, zacznij od gry zbieraj monety GRV — to będzie
// pierwsza część przyszłej platformówki". Inspiracja: godogen (przewodnik silnika na jedną
// stronę + dowód przez uruchomienie), tylko lokalnie: three.js z Games Studio, puppeteer
// wciska klawisze i czyta `window.__gra`, sędzia patrzy, czy stan gry się zmienia.
// ─────────────────────────────────────────────────────────────────────────────
const SZABLON_GRY = {
    'package.json': (nazwa) => JSON.stringify({
        name: nazwa, private: true, version: '0.1.0', type: 'module',
        scripts: { dev: 'vite', build: 'tsc --noEmit -p tsconfig.json && vite build', preview: 'vite preview' },
        dependencies: { three: '^0.170.0' },
        devDependencies: { '@types/three': '^0.170.0', typescript: '~5.9.3', vite: '^7.2.4' },
    }, null, 2),
    'vite.config.ts': () => `import { defineConfig } from 'vite';
// base './' — gra działa pod /apki/<id>/ na moście i z USB.
export default defineConfig({ base: './' });
`,
    'tsconfig.json': () => JSON.stringify({
        compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', strict: true, noEmit: true, skipLibCheck: true, isolatedModules: true, allowImportingTsExtensions: true, types: [] },
        include: ['src'],
    }, null, 2),
    'index.html': (nazwa) => `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <title>${nazwa}</title>
    <style>
      html, body { margin: 0; height: 100%; background: #05070d; color: #e6ecff; font-family: system-ui, sans-serif; overflow: hidden; }
      #gra { position: fixed; inset: 0; }
      #hud { position: fixed; top: 12px; left: 12px; padding: 8px 12px; background: rgba(0,0,0,.55); border-radius: 10px; font-size: 14px; pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="gra"></div>
    <div id="hud">GRV: 0</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    'src/global.d.ts': () => `// Typ okna stanu do testów (puppeteer czyta window.__gra po wciśnięciu klawiszy).
// Rozszerzaj TUTAJ (nowe pola dopisuj w nowych liniach), nie w main.ts.
declare global {
  interface Window {
    __gra: {
      wynik: number;
      pozycja: { x: number; z: number };
      monety: number;
      czas: number;
    };
  }
}
export {};
`,
    'src/main.ts': (nazwa) => `// ${nazwa} — szablon gry three.js z TeO Games Studio. Kodeks rozbuduje go wg zadania.
import * as THREE from 'three';

// Okno stanu do testów — typ w src/global.d.ts, wartość ZAWSZE aktualna w każdej klatce.
const kontener = document.getElementById('gra')!;
const hud = document.getElementById('hud')!;
const scena = new THREE.Scene();
scena.background = new THREE.Color(0x05070d);
const kamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
kontener.appendChild(renderer.domElement);
scena.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.2));

const ziemia = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
ziemia.rotation.x = -Math.PI / 2;
scena.add(ziemia);

const gracz = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x22c55e }));
gracz.position.y = 0.5;
scena.add(gracz);

const klawisze: Record<string, boolean> = {};
addEventListener('keydown', (e) => { klawisze[e.key.toLowerCase()] = true; });
addEventListener('keyup', (e) => { klawisze[e.key.toLowerCase()] = false; });
addEventListener('resize', () => { kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

window.__gra = { wynik: 0, pozycja: { x: 0, z: 0 }, monety: 0, czas: 0 };

let ostatni = performance.now();
function petla(teraz: number) {
  const dt = Math.min((teraz - ostatni) / 1000, 0.05);
  ostatni = teraz;
  const v = 6 * dt;
  if (klawisze['w'] || klawisze['arrowup']) gracz.position.z -= v;
  if (klawisze['s'] || klawisze['arrowdown']) gracz.position.z += v;
  if (klawisze['a'] || klawisze['arrowleft']) gracz.position.x -= v;
  if (klawisze['d'] || klawisze['arrowright']) gracz.position.x += v;
  kamera.position.set(gracz.position.x, 10, gracz.position.z + 10);
  kamera.lookAt(gracz.position);
  window.__gra.pozycja = { x: gracz.position.x, z: gracz.position.z };
  window.__gra.czas += dt;
  hud.textContent = 'GRV: ' + window.__gra.wynik;
  renderer.render(scena, kamera);
  requestAnimationFrame(petla);
}
requestAnimationFrame(petla);
`,
};

const PRZEWODNIK_THREE = `PRZEWODNIK SILNIKA (three.js 0.170, TypeScript, Vite) — jedna strona, trzymaj się go:
- Wejście: src/main.ts. Bez Reacta, bez innych bibliotek, tylko \`import * as THREE from 'three'\` (plus \`GLTFLoader\` z \`three/examples/jsm/loaders/GLTFLoader.js\`, gdy projekt ma assety w public/assety/). Wolno dzielić kod na moduły w src/ (np. src/monety.ts) i importować je z main.ts.
- Scena: PerspectiveCamera, WebGLRenderer do #gra, HemisphereLight/DirectionalLight. Ziemia = PlaneGeometry obrócona o -PI/2. Obiekty: Mesh(Geometry, MeshStandardMaterial({ color })). Współrzędne: y w górę, gracz na y=0.5.
- Pętla: requestAnimationFrame z dt (sekundy, ograniczone do 0.05). Ruch = prędkość * dt. Klawisze: mapa keydown/keyup po e.key.toLowerCase() (w/a/s/d, strzałki, ' ' = spacja).
- Kolizje proste: odległość środków (a.position.distanceTo(b.position) < promienA + promienB). Podniesiona moneta: scena.remove(mesh) + geometry.dispose().
- HUD: element #hud (textContent), nie canvas. Wynik, monety, czas.
- ZAWSZE aktualizuj window.__gra w każdej klatce: { wynik, pozycja:{x,z}, monety (ile zostało), czas } — tak testuje się grę. Dodawaj własne pola, nie usuwaj tych.
- Resize: aktualizuj aspect kamery i rozmiar renderera. Nie używaj OrbitControls (kamera podąża za graczem).
- ASSETY GLB: \`loader.load(url, (g) => …)\` daje \`g.scene\` typu **THREE.Group**, NIE Mesh. Pole, w którym trzymasz bryłę wroga/gracza, typuj \`THREE.Object3D\` (wspólna nadklasa Group i Mesh) — wtedy placeholder \`new THREE.Mesh(...)\` i wczytany model pasują bez rzutowań. Nie pisz \`as THREE.Group\` ani \`as THREE.Mesh\`. Kolor/materiał zmieniaj przez \`obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) … })\`.
- Kamera ORTOGRAFICZNA (izometria): frustum liczony z aspektu i WYSOKOŚCI WIDOKU W JEDNOSTKACH ŚWIATA (np. 20): \`const h = 20, a = innerWidth / innerHeight; kamera = new OrthographicCamera(-h * a / 2, h * a / 2, h / 2, -h / 2, 0.1, 200)\`; to samo przy resize + updateProjectionMatrix. NIGDY frustum -1..1 — gracz 1×1 zasłoni wtedy cały ekran. Kamera stoi w (gracz.x + 20, 20, gracz.z + 20) i patrzy na gracza; podłoga i przeszkody muszą być widoczne wokół niego.
- Deterministycznie: losowość tylko przez własny generator z ziarnem (np. mulberry32), żeby test był powtarzalny.
- Wydajność: maks ~200 meshy, żadnych świateł per moneta; jedna geometria + jeden materiał współdzielone.`;

const SYSTEM_KODEKSA_GRY = `Jesteś Kodeks — TeOgochi od kodu w Katedrze OtakOS. Budujesz GRĘ przeglądarkową w three.js + TypeScript (strict) + Vite. Teksty w grze po polsku.

${PRZEWODNIK_THREE}

ZASADY, KTÓRYCH NIE ŁAMIESZ:
- Oddajesz WYŁĄCZNIE pliki, w blokach dokładnie tej postaci (bez markdownu wokół, bez komentarzy poza blokami):
=== PLIK: src/main.ts ===
...cała treść pliku...
=== KONIEC ===
- Każdy plik oddajesz W CAŁOŚCI. Żadnych „reszta bez zmian".
- Wolno Ci pisać tylko w src/** i index.html. Nie ruszasz package.json, vite.config.ts, tsconfig.json.
- Zależności: tylko three. Żadnych CDN, żadnego fetch do obcych adresów, żadnych assetów z internetu — bryły i kolory z kodu.
- TypeScript strict: typuj. Typ window.__gra mieszka w src/global.d.ts (wieloliniowo, z \`export {}\` na końcu) — nowe pola dopisuj TAM, nie deklaruj \`declare global\` w main.ts.
- Gdy dostajesz BŁĘDY z weryfikacji — poprawiasz tylko to, co trzeba, i znów oddajesz całe pliki, których dotknąłeś.
- Timery i czas: w sekundach, z dt z pętli — nie setInterval.`;

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
        if (p) lista.push({ id: p.id, typ: p.typ ?? 'apka', nazwa: p.nazwa, opis: p.opis, utworzono: p.utworzono, ostatnia: p.historia.at(-1)?.kiedy ?? p.utworzono, zbudowana: fsSync.existsSync(path.join(dirProjektu(d), 'dist', 'index.html')), zrzut: !!p.ostatniZrzut, iteracji: p.historia.length });
    }
    return lista.sort((a, b) => (a.ostatnia < b.ostatnia ? 1 : -1));
}

export async function nowyProjekt({ nazwa, opis = '', typ = 'apka' }) {
    const czysta = String(nazwa || '').trim();
    if (!czysta) throw new Error('Podaj nazwę aplikacji.');
    const rodzaj = typ === 'gra' ? 'gra' : 'apka';
    const szablon = rodzaj === 'gra' ? SZABLON_GRY : SZABLON;
    const nodeModules = rodzaj === 'gra' ? cfg.nodeModulesGry : cfg.nodeModules;
    let id = slug(czysta);
    if (fsSync.existsSync(dirProjektu(id))) id = `${id}-${crypto.randomBytes(2).toString('hex')}`;
    const dir = dirProjektu(id);
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    for (const [rel, tresc] of Object.entries(szablon)) await fs.writeFile(path.join(dir, rel), tresc(czysta, String(opis).trim()), 'utf8');
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules\ndist\nzrzut*.png\nnieudane\nprojekt.json\ngdd.json\n', 'utf8');
    // node_modules jako junction do App Studio — react/vite/typescript bez instalowania czegokolwiek.
    if (fsSync.existsSync(nodeModules)) { try { await fs.symlink(nodeModules, path.join(dir, 'node_modules'), 'junction'); } catch { /* bez node_modules build powie, czego brak */ } }
    await git(dir, ['init', '-q']);
    await git(dir, ['add', '-A']);
    await git(dir, ['-c', 'user.name=Kodeks', '-c', 'user.email=kodeks@katedra.local', 'commit', '-q', '-m', rodzaj === 'gra' ? 'szablon: nowa gra three.js z TeO Games Studio' : 'szablon: nowa aplikacja z TeO App Studio']);
    const p = { id, typ: rodzaj, nazwa: czysta, opis: String(opis).trim(), utworzono: new Date().toISOString(), historia: [], ostatniZrzut: null };
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
/** Anthropic Messages API — bez strumienia (odpowiedź w sekundach), klucz z Kibla. */
async function piszAnthropic({ system, prompt, model, timeoutMs }) {
    const klucz = await cfg.klucze.anthropic();
    if (!klucz) throw new Error('Brak klucza Anthropic w TeO Kibel — wybierz silnik lokalny albo dodaj klucz (sk-ant-…).');
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', signal: ctrl.signal,
            headers: { 'content-type': 'application/json', 'x-api-key': klucz, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model, max_tokens: 16000, system, messages: [{ role: 'user', content: prompt }] }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}: ${d?.error?.message || ''}`.trim());
        const tekst = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
        return { tekst, tokeny: (d.usage?.input_tokens || 0) + (d.usage?.output_tokens || 0) };
    } finally { clearTimeout(t); }
}

/** Gemini generateContent — bez strumienia, klucz z Kibla. */
async function piszGemini({ system, prompt, model, timeoutMs }) {
    const klucz = await cfg.klucze.gemini();
    if (!klucz) throw new Error('Brak klucza Gemini w TeO Kibel — wybierz silnik lokalny albo dodaj klucz (AIza…).');
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', signal: ctrl.signal,
            headers: { 'content-type': 'application/json', 'x-goog-api-key': klucz },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 16000 } }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${d?.error?.message || ''}`.trim());
        const tekst = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        return { tekst, tokeny: d.usageMetadata?.totalTokenCount || 0 };
    } finally { clearTimeout(t); }
}

/** Silniki do wyboru w App Studio — lokalne zawsze pierwsze i domyślne; chmura tylko z kluczem. */
export async function silniki() {
    const lokalny = cfg.model();
    const lista = [{ id: 'lokalny', model: lokalny, etykieta: `Lokalnie — ${lokalny}`, domyslny: true, dostepny: true, uwaga: 'Domyślny. Na tej maszynie runda ≈ 4–5 min.' }];
    try {
        const t = await fetch(`${cfg.ollamaBase}/api/tags`).then((r) => r.json());
        const nazwy = (t.models || []).map((m) => m.name);
        // Szybki 4B: mieści się w 6 GB VRAM w całości (9B ma połowę wag w RAM). Do dużych
        // projektów, gdzie 9B nie wyrabia się w 20 min na rundę (zmierzone 2026-09-22, ARPG zad. 10).
        const szybki = nazwy.find((n) => /^qwen3\.5:4b$/i.test(n));
        if (szybki && szybki !== lokalny) lista.push({ id: 'lokalny-szybki', model: szybki, etykieta: `Lokalnie — ${szybki} (szybki)`, domyslny: false, dostepny: true, uwaga: 'Cały w VRAM, 2–3× szybszy od 9B, słabszy w typach. Do dużych plików i wielu modułów.' });
        const duzy = nazwy.find((n) => /27b/i.test(n));
        if (duzy && duzy !== lokalny) lista.push({ id: 'lokalny-duzy', model: duzy, etykieta: `Lokalnie — ${duzy}`, domyslny: false, dostepny: true, uwaga: 'Dokładniejszy, ~2 tok/s — runda kilkanaście minut. Raczej do Nocnej Zmiany.' });
    } catch { /* Ollama śpi — zostaje wpis domyślny */ }
    const [a, g] = await Promise.all([cfg.klucze.anthropic().catch(() => null), cfg.klucze.gemini().catch(() => null)]);
    lista.push({ id: 'claude', model: 'claude:claude-sonnet-5', etykieta: 'Chmura — Claude Sonnet 5', domyslny: false, dostepny: !!a, uwaga: a ? 'Klucz z Kibla. Kod wychodzi z Katedry.' : 'Brak klucza Anthropic w TeO Kibel.' });
    lista.push({ id: 'gemini', model: 'gemini:gemini-2.5-flash', etykieta: 'Chmura — Gemini 2.5 Flash', domyslny: false, dostepny: !!g, uwaga: g ? 'Klucz z Kibla. Kod wychodzi z Katedry.' : 'Brak klucza Gemini w TeO Kibel.' });
    return lista;
}

// 32k zamiast 16k: zmierzone 2026-09-21 — przy main.ts 16 KB prompt + przepisany plik dobijały do
// 16384 i model oddawał ucięty bełkot bez bloków PLIK (3 rundy stracone). KV-cache 32k dla 9B
// mieści się obok wag (część i tak leży w RAM na 6 GB VRAM); koszt: wolniejszy prompt-eval.
const NUM_CTX = 32768;
const DUZY_PLIK_LINII = 300;   // powyżej — Kodeks ma wydzielać moduły zamiast rosnąć w jednym pliku

export async function pisz({ system, prompt, model, timeoutMs = 20 * 60_000, naKawalek = null }) {
    if (/^claude:/.test(model)) return piszAnthropic({ system, prompt, model: model.slice(7), timeoutMs: Math.min(timeoutMs, 10 * 60_000) });
    if (/^gemini:/.test(model)) return piszGemini({ system, prompt, model: model.slice(7), timeoutMs: Math.min(timeoutMs, 10 * 60_000) });
    // Ollama przez node:http, NIE przez fetch. undici w Node urywa połączenie po 300 s bez
    // bajtu w treści (bodyTimeout) — a Ollama potrafi tyle milczeć, gdy liczy prompt na CPU
    // albo stoi w kolejce za innym zadaniem (zmierzone 2026-09-21: „fetch failed" po 304 s
    // w rundzie 2, mimo strumienia). http.request nie ma takich sufitów; nasz jest jeden: timeoutMs.
    const url = new URL('/api/generate', cfg.ollamaBase);
    // Okno kontekstu POD MIARĘ, nie na sztywno: przy 32k KV-cache 9B zajmuje ~4,8 GB VRAM i
    // prawie całe wagi lądują w RAM-ie — prompt 7k tokenów liczył się 20 min bez jednego znaku
    // (zmierzone 2026-09-22). Bierzemy tyle, ile prompt + 8k odpowiedzi, zaokrąglone do 2k.
    const szacunekTokenow = Math.ceil((String(system).length + String(prompt).length) / 2.5) + 8192 + 1024;
    const numCtx = Math.min(NUM_CTX, Math.max(8192, Math.ceil(szacunekTokenow / 2048) * 2048));
    const body = JSON.stringify({ model, system, prompt, stream: true, think: false, options: { temperature: 0.2, num_ctx: numCtx, num_predict: 8192 } });
    return new Promise((resolve, reject) => {
        let tekst = '', tokeny = 0, bufor = '', zakonczone = false;
        const koniec = (fn) => (v) => { if (!zakonczone) { zakonczone = true; clearTimeout(zegar); fn(v); } };
        const ok = koniec(resolve), pad = koniec(reject);
        const zegar = setTimeout(() => { req.destroy(); pad(new Error(`Ollama nie zdążyła w ${Math.round(timeoutMs / 1000)} s`)); }, timeoutMs);
        const req = http.request({ hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
            if (res.statusCode !== 200) { let e = ''; res.on('data', (c) => { e += c; }); res.on('end', () => pad(new Error(`Ollama HTTP ${res.statusCode}: ${e.slice(0, 200)}`))); return; }
            res.setEncoding('utf8');
            res.on('data', (kawalek) => {
                bufor += kawalek;
                let i;
                while ((i = bufor.indexOf('\n')) >= 0) {
                    const linia = bufor.slice(0, i).trim(); bufor = bufor.slice(i + 1);
                    if (!linia) continue;
                    try {
                        const j = JSON.parse(linia);
                        if (j.error) return pad(new Error(`Ollama: ${j.error}`));
                        if (j.response) { tekst += j.response; naKawalek?.(tekst.length); }
                        if (j.done) { tokeny = (Number(j.eval_count) || 0) + (Number(j.prompt_eval_count) || 0); if (j.done_reason === 'length') tekst += '\n/* UCIĘTE: limit tokenów */'; }
                    } catch { /* niepełna linia */ }
                }
            });
            res.on('end', () => ok({ tekst, tokeny, numCtx }));
            res.on('error', (e) => pad(new Error(`Ollama: ${e.message}`)));
        });
        req.on('error', (e) => pad(new Error(`Ollama: ${e.message}`)));
        req.end(body);
    });
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

/**
 * AUTONAPRAWA literówek: tsc mówi „Cannot find name 'plataformaLanding'. Did you mean
 * 'platformaLanding'?" (TS2552) — a 9B trzy rundy z rzędu oddawał ten sam plik (zmierzone
 * 2026-09-21 na żywym moście: 24 min zmarnowane). Podmiana całego słowa wg podpowiedzi tsc
 * jest deterministyczna i bezpieczna; po niej tsc leci jeszcze raz. Zwraca listę podmian.
 */
/** Klasy z three/examples/jsm, po ktore Kodeks siega najczesciej - do autonaprawy TS2339. */
const SCIEZKI_JSM = {
    GLTFLoader: 'three/examples/jsm/loaders/GLTFLoader.js',
    OrbitControls: 'three/examples/jsm/controls/OrbitControls.js',
    DRACOLoader: 'three/examples/jsm/loaders/DRACOLoader.js',
    FontLoader: 'three/examples/jsm/loaders/FontLoader.js',
    TextGeometry: 'three/examples/jsm/geometries/TextGeometry.js',
    EffectComposer: 'three/examples/jsm/postprocessing/EffectComposer.js',
};

export async function autonaprawLiterowki(dir, log) {
    const re = /^(src\/[^\s(]+)\(\d+,\d+\): error TS2552: Cannot find name '([A-Za-z_$][\w$]*)'\. Did you mean '([A-Za-z_$][\w$]*)'\?/gm;
    const podmiany = [];
    const widziane = new Set();
    let m;
    // TS2588 „Cannot assign to 'seed' because it is a constant" — 9B trzy rundy z rzędu zostawiał
    // `const seed` przy `seed++` (zmierzone 2026-09-21, 39 min na jednym zadaniu). Deklarację
    // `const nazwa` zamieniamy na `let nazwa` — tylko tę jedną zmienną, tylko w tym pliku.
    const reConst = /^(src\/[^\s(]+)\(\d+,\d+\): error TS2588: Cannot assign to '([A-Za-z_$][\w$]*)' because it is a constant\./gm;
    while ((m = reConst.exec(log))) {
        const [, plik, nazwa] = m;
        const klucz = `${plik}:const:${nazwa}`;
        if (widziane.has(klucz)) continue;
        widziane.add(klucz);
        try {
            const pelna = path.join(dir, plik);
            const tresc = await fs.readFile(pelna, 'utf8');
            const nowa = tresc.replace(new RegExp(`\\bconst(\\s+)${nazwa.replace(/[$]/g, '\\$&')}\\b`, 'g'), `let$1${nazwa}`);
            if (nowa !== tresc) { await fs.writeFile(pelna, nowa, 'utf8'); podmiany.push(`${plik}: const ${nazwa} → let ${nazwa}`); }
        } catch { /* zostawiamy modelowi */ }
    }
    while ((m = re.exec(log))) {
        const [, plik, zle, dobrze] = m;
        const klucz = `${plik}:${zle}`;
        if (widziane.has(klucz) || zle === dobrze) continue;
        widziane.add(klucz);
        try {
            const pelna = path.join(dir, plik);
            const tresc = await fs.readFile(pelna, 'utf8');
            const nowa = tresc.replace(new RegExp(`\\b${zle.replace(/[$]/g, '\\$&')}\\b`, 'g'), dobrze);
            if (nowa !== tresc) { await fs.writeFile(pelna, nowa, 'utf8'); podmiany.push(`${plik}: ${zle} → ${dobrze}`); }
        } catch { /* plik nie do odczytu — zostawiamy modelowi */ }
    }
    // TS2339 "Property 'GLTFLoader' does not exist on type typeof import(...three...)" - 9B trzy
    // rundy z rzedu pisal `new THREE.GLTFLoader()` (zmierzone 2026-09-22, 75 min zmarnowane).
    // Klasy z three/examples/jsm nie siedza w namespace THREE: zamieniamy `THREE.X` na `X`
    // i dokladamy import, jesli go nie ma.
    const reJsm = /^(src\/[^\s(]+)\(\d+,\d+\): error TS2339: Property '([A-Za-z_$][\w$]*)' does not exist on type 'typeof import\([^)]*three[^)]*\)'/gm;
    while ((m = reJsm.exec(log))) {
        const [, plik, klasa] = m;
        const sciezka = SCIEZKI_JSM[klasa];
        const klucz = plik + ':jsm:' + klasa;
        if (!sciezka || widziane.has(klucz)) continue;
        widziane.add(klucz);
        try {
            const pelna = path.join(dir, plik);
            let tresc = await fs.readFile(pelna, 'utf8');
            const uzycie = new RegExp('\\bTHREE\\.' + klasa + '\\b', 'g');
            if (!uzycie.test(tresc)) continue;
            tresc = tresc.replace(new RegExp('\\bTHREE\\.' + klasa + '\\b', 'g'), klasa);
            const maImport = new RegExp('import\\s*\\{[^}]*\\b' + klasa + '\\b[^}]*\\}\\s*from').test(tresc);
            if (!maImport) {
                const linie = tresc.split('\n');
                let ostatniImport = -1;
                linie.forEach((l, i) => { if (/^\s*import\s/.test(l)) ostatniImport = i; });
                linie.splice(ostatniImport + 1, 0, "import { " + klasa + " } from '" + sciezka + "';");
                tresc = linie.join('\n');
            }
            await fs.writeFile(pelna, tresc, 'utf8');
            podmiany.push(plik + ': THREE.' + klasa + ' -> import { ' + klasa + " } from '" + sciezka + "'");
        } catch { /* zostawiamy modelowi */ }
    }
    return podmiany;
}

/**
 * Nieudana próba NIE zostaje w projekcie: diff + treść NOWYCH plików (git diff ich nie widzi —
 * zmierzone 2026-09-22: 4B oddał 5 nowych modułów, po nieudanej rundzie diff miał 573 bajty
 * i nic do obejrzenia) idą do nieudane/<id>.diff, projekt wraca do ostatniego dobrego commita.
 */
async function zrzucNieudaneIPrzywroc(dir, id) {
    const diff = await git(dir, ['diff']);
    const nowe = (await git(dir, ['ls-files', '--others', '--exclude-standard', '--', 'src', 'index.html'])).split('\n').filter(Boolean);
    if (!diff && !nowe.length) return false;
    await fs.mkdir(path.join(dir, 'nieudane'), { recursive: true });
    let tresc = diff;
    for (const f of nowe) { try { tresc += `\n=== NOWY PLIK: ${f} ===\n${await fs.readFile(path.join(dir, f), 'utf8')}\n=== KONIEC ===\n`; } catch { /* nic */ } }
    await fs.writeFile(path.join(dir, 'nieudane', `${id}.diff`), tresc, 'utf8');
    // Tylko kod: gdd.json (stan planu) i projekt.json nie są częścią próby — checkout „." cofał
    // gdd.json do stanu z ostatniego commita i zadanie „gotowe" wracało na „trwa" (2026-09-22).
    await git(dir, ['checkout', '--', 'src', 'index.html']);
    await git(dir, ['clean', '-fdq', '--', 'src']);
    return true;
}

export async function weryfikujBuild(dir) {
    const t0 = Date.now();
    const nm = path.join(dir, 'node_modules');
    if (!fsSync.existsSync(nm)) return { ok: false, etap: 'node_modules', log: `Brak node_modules (junction do ${cfg.nodeModules} nie powstał).`, sekundy: 0 };
    const tsc = () => run(process.execPath, [path.join(nm, 'typescript', 'bin', 'tsc'), '--noEmit', '-p', 'tsconfig.json'], { cwd: dir, windowsHide: true, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
    let autonaprawy = [];
    try {
        await tsc();
    } catch (e) {
        const log1 = `${e.stdout || ''}\n${e.stderr || ''}`.trim().slice(-6000);
        autonaprawy = await autonaprawLiterowki(dir, log1);
        if (!autonaprawy.length) return { ok: false, etap: 'tsc', log: await dopiszLinie(dir, log1), sekundy: Math.round((Date.now() - t0) / 1000) };
        try { await tsc(); }
        catch (e2) { return { ok: false, etap: 'tsc', autonaprawy, log: `(autonaprawa literówek: ${autonaprawy.join(', ')} — nadal błędy)\n` + await dopiszLinie(dir, `${e2.stdout || ''}\n${e2.stderr || ''}`.trim().slice(-6000)), sekundy: Math.round((Date.now() - t0) / 1000) }; }
    }
    try {
        await run(process.execPath, [path.join(nm, 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'error'], { cwd: dir, windowsHide: true, timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
    } catch (e) { return { ok: false, etap: 'vite build', log: `${e.stdout || ''}\n${e.stderr || ''}`.trim().slice(-6000), sekundy: Math.round((Date.now() - t0) / 1000) }; }
    return { ok: true, etap: 'build', autonaprawy, log: `tsc + vite build: OK${autonaprawy.length ? ` (autonaprawa literówek: ${autonaprawy.join(', ')})` : ''}`, sekundy: Math.round((Date.now() - t0) / 1000) };
}

/** Puppeteer: otwórz zbudowaną apkę na moście, zbierz błędy, zrób zrzut. */
async function przetestujWPrzegladarce(id, typ = 'apka') {
    const t0 = Date.now();
    if (!cfg.puppeteer) return { ok: null, bledy: [], log: 'puppeteer niedostępny — test w przeglądarce pominięty', sekundy: 0 };
    const dir = dirProjektu(id);
    if (typ === 'gra') return przetestujGre(id, dir, t0);
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

/**
 * SĘDZIA Z OCZAMI (tylko gry): stan w window.__gra może być poprawny, a ekran pusty albo
 * zasłonięty jedną bryłą (zmierzone 2026-09-21: kamera ortograficzna z frustum -1..1 — gracz
 * na cały ekran, 8 zadań „zdało"). Model z widzeniem ogląda zrzut i mówi tylko o WIDOCZNOŚCI.
 * qwen3.5 (4b/9b) widzi poprawnie; gemma4:e2b w tym Ollamie (0.34) zwraca halucynację
 * o „kobiecie z ciemnymi włosami" dla każdego obrazu — nie używać do obrazów.
 * Niepewność (błąd, brak JSON, timeout) = przepuszczamy; sędzia ma łapać, nie blokować.
 */
export async function ocenZrzut({ cel, sciezkaZrzutu, model }) {
    const modelOczu = /^(claude|gemini):/.test(model || '') || !/qwen3\.5/.test(model || '') ? 'qwen3.5:9b' : model;
    try {
        const obraz = (await fs.readFile(sciezkaZrzutu)).toString('base64');
        const prompt = `To zrzut ekranu z automatycznego testu gry 3D w three.js (rzut z góry/izometria, Chrome bez GPU). Zadanie gry: ${String(cel).slice(0, 400)}\nOceń WIDOCZNOŚĆ, nie jakość grafiki. Odpowiedz WYŁĄCZNIE JSON-em:\n{"ok": true/false, "powod": "jedno zdanie po polsku"}\nok=false tylko gdy: (a) ekran pusty/czarny bez sceny, (b) jedna bryła zasłania prawie cały ekran (kamera za blisko lub zły frustum), (c) nie widać podłogi/świata wokół gracza. Proste bryły zamiast modeli to NIE błąd, HUD z zerami to NIE błąd.`;
        const body = JSON.stringify({ model: modelOczu, stream: false, think: false, options: { temperature: 0.1 }, messages: [{ role: 'user', content: prompt, images: [obraz] }] });
        const url = new URL('/api/chat', cfg.ollamaBase);
        const tekst = await new Promise((resolve, reject) => {
            const req = http.request({ hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 180_000 }, (res) => {
                let d = ''; res.setEncoding('utf8'); res.on('data', (c) => { d += c; }); res.on('end', () => { try { resolve(JSON.parse(d).message?.content ?? ''); } catch (e) { reject(e); } });
            });
            req.on('timeout', () => { req.destroy(new Error('oczy: timeout 180 s')); });
            req.on('error', reject);
            req.end(body);
        });
        const m = tekst.match(/\{[\s\S]*\}/);
        const j = m ? JSON.parse(m[0]) : null;
        if (!j || typeof j.ok !== 'boolean') return { ok: true, powod: null, niepewne: true, model: modelOczu };
        return { ok: j.ok, powod: j.ok ? null : String(j.powod || 'na zrzucie nie widać sceny').slice(0, 300), opis: String(j.powod || '').slice(0, 300), model: modelOczu };
    } catch (e) { return { ok: true, powod: null, niepewne: true, blad: e.message }; }
}

/**
 * Test GRY: canvas w #gra, potem WSAD przez klawiaturę puppeteera i odczyt window.__gra po każdym
 * ruchu. Migawki to JSON stanu — sędzia dostaje twarde liczby (pozycja, wynik, monety), nie tekst.
 * Chrome headless bez GPU renderuje WebGL programowo (SwiftShader) — wolno, ale wystarcza.
 */
async function przetestujGre(id, dir, t0) {
    const nazwaZrzutu = `zrzut-${Date.now()}.png`;
    const bledy = [];
    let przegladarka = null;
    try {
        przegladarka = await cfg.puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        const strona = await przegladarka.newPage();
        await strona.setViewport({ width: 960, height: 640 });
        strona.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.location?.()?.url || '')) bledy.push(`console.error: ${m.text().slice(0, 400)}`); });
        strona.on('pageerror', (e) => bledy.push(`wyjątek: ${String(e.message || e).slice(0, 400)}`));
        strona.on('requestfailed', (r) => { if (!/favicon/.test(r.url())) bledy.push(`nie doszło: ${r.url().slice(0, 200)}`); });
        await strona.goto(`http://127.0.0.1:${cfg.portMostu}/apki/${id}/`, { waitUntil: 'load', timeout: 20_000 });
        await new Promise((r) => setTimeout(r, 2500));
        const canvas = await strona.$('#gra canvas');
        if (!canvas) bledy.push('brak <canvas> w #gra — renderer three.js nie wystartował');
        const stan = () => strona.evaluate(() => (window.__gra ? JSON.stringify(window.__gra) : null)).catch(() => null);
        const migawki = [];
        const s0 = await stan();
        if (!s0) bledy.push('brak window.__gra — przewodnik wymaga okna stanu aktualizowanego w każdej klatce');
        migawki.push({ kiedy: 'po załadowaniu', tekst: s0 || '(brak)' });
        for (const [klawisz, ms] of [['w', 1500], ['d', 1500], [' ', 300]]) {
            await strona.keyboard.down(klawisz === ' ' ? 'Space' : klawisz.toUpperCase());
            await new Promise((r) => setTimeout(r, ms));
            await strona.keyboard.up(klawisz === ' ' ? 'Space' : klawisz.toUpperCase());
            await new Promise((r) => setTimeout(r, 300));
            migawki.push({ kiedy: `po ${klawisz === ' ' ? 'spacji' : 'klawiszu ' + klawisz.toUpperCase()} (${ms} ms)`, tekst: (await stan()) || '(brak)' });
        }
        await new Promise((r) => setTimeout(r, 1500));
        migawki.push({ kiedy: '1,5 s później, bez klawiszy', tekst: (await stan()) || '(brak)' });
        await strona.screenshot({ path: path.join(dir, nazwaZrzutu) });
        for (const f of await fs.readdir(dir)) if (/^zrzut-.*\.png$/.test(f) && f !== nazwaZrzutu) await fs.rm(path.join(dir, f), { force: true });
        // Deterministycznie: po W i D pozycja gracza MUSI się zmienić; inaczej gra nie reaguje na klawisze.
        try {
            const a = JSON.parse(migawki[0].tekst), b = JSON.parse(migawki[2].tekst);
            if (a?.pozycja && b?.pozycja && Math.abs(a.pozycja.x - b.pozycja.x) + Math.abs(a.pozycja.z - b.pozycja.z) < 0.01) bledy.push('gracz nie ruszył się po W i D — sterowanie nie działa (window.__gra.pozycja bez zmian)');
            // Wynik nie ma prawa SPADAĆ (zmierzone 2026-09-21: zebrana moneta wracała, bo liczono ją co klatkę z odległości).
            const wyniki = migawki.map((m) => { try { return Number(JSON.parse(m.tekst)?.wynik); } catch { return NaN; } }).filter((w) => !Number.isNaN(w));
            for (let i = 1; i < wyniki.length; i++) if (wyniki[i] < wyniki[i - 1]) { bledy.push(`wynik spadł z ${wyniki[i - 1]} na ${wyniki[i]} między migawkami — zebrane rzeczy nie mogą „wracać" (usuń je z tablicy, nie tylko ze sceny)`); break; }
        } catch { /* brak stanu — już zgłoszone */ }
        return { ok: bledy.length === 0, bledy, migawki, zrzut: nazwaZrzutu, log: bledy.length ? bledy.join('\n') : `gra: canvas OK, stan po klawiszach: ${migawki.at(-1).tekst.slice(0, 200)}`, sekundy: Math.round((Date.now() - t0) / 1000) };
    } catch (e) {
        return { ok: false, bledy: [`puppeteer: ${e.message.slice(0, 300)}`], migawki: [], log: `puppeteer: ${e.message}`, sekundy: Math.round((Date.now() - t0) / 1000) };
    } finally { try { await przegladarka?.close(); } catch { /* — */ } }
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
        const typProjektu = (await czytajProjekt(projektId))?.typ ?? 'apka';
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
                const duze = obecne.filter((p) => /\.(ts|tsx)$/.test(p.sciezka) && p.tresc.split('\n').length > DUZY_PLIK_LINII).map((p) => `${p.sciezka} (${p.tresc.split('\n').length} linii)`);
                const assety = typProjektu === 'gra' && cfg.assetyProjektu ? await cfg.assetyProjektu(projektId).catch(() => []) : [];
                const blokAssetow = assety.length
                    ? `\nASSETY 3D W PROJEKCIE (public/assety/, gotowe pliki GLB z kolorami wierzchołków — UŻYWAJ ich zamiast brył, gdy pasują): ${assety.map((a) => `${a.plik} (${a.opis || a.nazwa}${a.sciany ? ', ~' + a.sciany + ' ścian' : ''})`).join('; ')}. Ładowanie: \`import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'\`; \`new GLTFLoader().load('./assety/NAZWA.glb', (g) => { const m = g.scene; m.scale.setScalar(S); scena.add(m); })\` — do czasu wczytania trzymaj placeholder (Box), a po wczytaniu podmień; pole na bryłę typuj THREE.Object3D (g.scene to Group, nie Mesh — żadnych rzutowań as THREE.Mesh/as THREE.Group); kolizje nadal po odległości. Model ma ~1 jednostkę wysokości — dobierz scale.\n`
                    : '';
                const podzial = duze.length ? `\nPLIKI ZA DUŻE: ${duze.join(', ')}. Nie dopisuj do nich kolejnych funkcji — WYDZIEL spójne części (np. wrogowie, loot, HUD, poziom, questy) do osobnych plików src/*.ts z eksportami i importuj je w main.ts. Oddaj każdy plik, którego treść zmieniasz, W CAŁOŚCI; plików, których nie ruszasz, nie oddawaj.\n` : '';
                const prompt = `PROJEKT: ${projektId}\n\nOBECNE PLIKI:\n${kontekstPlikow(obecne)}\nZADANIE SUWERENA:\n${cel}\n${blokAssetow}${podzial}${feedback ? `\nBŁĘDY Z POPRZEDNIEJ RUNDY (${runda - 1}) — POPRAW JE:\n${feedback}\n${eskalacja}` : ''}\nOddaj pliki, które tworzysz lub zmieniasz, w blokach === PLIK: … === / === KONIEC ===.`;
                // ComfyUI po renderze trzyma modele w karcie (zmierzone: ~2 GB po TRELLIS.2) — Ollama
                // dostaje resztkę i liczy prompt na CPU. Prosimy o zwolnienie, jeśli ComfyUI nie liczy.
                if (runda === 1 && cfg.zwolnijComfy) await cfg.zwolnijComfy().catch(() => {});
                const kPisze = krok('model', `runda ${runda}/${rundy}: Kodeks (${z.model}) pisze…`);
                let ostatniMeldunek = 0;
                // Limit rundy WEDŁUG ROZMIARU PROJEKTU, nie na sztywno 20 min: 9B pisze ~25 znaków/s,
                // a przepisanie czterech plików ARPG to ~21 tys. znaków. Zmierzone 2026-09-22: runda
                // urwana na 20 010 znakach po 1200 s - brakowało minuty. Widełki 15-45 min.
                const limitRundy = Math.min(45, Math.max(15, Math.ceil(prompt.length / 25 / 60 * 1.6))) * 60_000;
                const kartaKodeksa = await Persony.karta('kodeks').catch(() => null);
                const regulyKodeksa = typProjektu === 'gra' ? SYSTEM_KODEKSA_GRY : SYSTEM_KODEKSA;
                const odp = await pisz({ system: kartaKodeksa ? `${kartaKodeksa.tresc}\n\n${regulyKodeksa}` : regulyKodeksa, prompt, model: z.model, timeoutMs: limitRundy, naKawalek: (n) => {
                    // meldunek co ~2000 znaków — żeby front widział, że model żyje, bez zalewania szyny
                    if (n - ostatniMeldunek >= 2000) { ostatniMeldunek = n; kPisze.znakow = n; naKrok({ typ: 'postep', tekst: `Kodeks napisał ${n} znaków…`, znakow: n, kiedy: new Date().toISOString() }); }
                } });
                const nowe = wylowPliki(odp.tekst);
                if (!nowe.length) {
                    const sufit = odp.tokeny >= (odp.numCtx ?? NUM_CTX) - 64;
                    feedback = sufit
                        ? `Twoja poprzednia odpowiedź nie zmieściła się w oknie modelu (${odp.tokeny}/${odp.numCtx ?? NUM_CTX} tokenów) i nie było w niej ani jednego kompletnego bloku === PLIK: … ===. Oddaj MNIEJ: tylko pliki, które zmieniasz, a duże pliki podziel na moduły (patrz PLIKI ZA DUŻE).`
                        : 'Nie znalazłem żadnego bloku === PLIK: … === w Twojej odpowiedzi. Oddaj pliki DOKŁADNIE w tym formacie.';
                    krok('blad', sufit ? `runda ${runda}: kontekst modelu wyczerpany (${odp.tokeny}/${odp.numCtx ?? NUM_CTX} tokenów) — projekt za duży na jeden prompt, wymuszam podział na moduły` : `runda ${runda}: model nie oddał plików (${odp.tokeny} tokenów)`);
                    continue;
                }
                for (const p of nowe) { await fs.mkdir(path.dirname(path.join(dir, p.sciezka)), { recursive: true }); await fs.writeFile(path.join(dir, p.sciezka), p.tresc, 'utf8'); }
                krok('pliki', `runda ${runda}: zapisano ${nowe.length} plik(ów): ${nowe.map((p) => p.sciezka).join(', ')}`, { pliki: nowe.map((p) => p.sciezka), tokeny: odp.tokeny });

                const w = await weryfikujBuild(dir);
                krok(w.ok ? 'build' : 'blad', `${w.etap} (${w.sekundy} s): ${w.ok ? 'OK' : w.log.slice(0, 1500)}`);
                ostatniBuildOk = w.ok;
                if (!w.ok) {
                    feedback = `${w.etap}:\n${w.log}`;
                    const odcisk = w.log.replace(/\(\d+,\d+\)/g, '(_)').replace(/linia \d+:/g, 'linia _:').replace(/\s+/g, ' ').trim().slice(0, 400);
                    powtorki = odcisk === poprzedniBlad ? powtorki + 1 : 0;
                    poprzedniBlad = odcisk;
                    if (powtorki >= 2) { krok('blad', `ten sam błąd trzeci raz z rzędu — przerywam, żeby nie palić kolejnych rund`); break; }
                    continue;
                }

                const t = await przetestujWPrzegladarce(projektId, typProjektu);
                if (t.zrzut) ostatniZrzut = t.zrzut;
                krok(t.ok === false ? 'blad' : 'test', `przeglądarka (${t.sekundy} s): ${t.log.slice(0, 1500)}`, { zrzut: t.zrzut ?? null });
                if (t.ok === false) { feedback = `Aplikacja zbudowała się, ale w przeglądarce:\n${t.bledy.join('\n')}`; continue; }
                // Gra ma sędziego deterministycznego w teście (pozycja po klawiszach) + sędziego z oczami
                // (zrzut → model z widzeniem: czy w ogóle widać scenę). Apka: sędzia zachowania z migawek tekstu.
                if (typProjektu === 'gra') {
                    const oczy = t.zrzut ? await ocenZrzut({ cel, sciezkaZrzutu: path.join(dir, t.zrzut), model: z.model }) : { ok: true, niepewne: true };
                    krok(oczy.ok ? 'test' : 'blad', oczy.ok ? `oczy (${oczy.model ?? '?'}): ${oczy.niepewne ? 'sędzia niepewny — przepuszczam' + (oczy.blad ? ' (' + oczy.blad + ')' : '') : 'scenę widać — ' + (oczy.opis || 'OK')}` : `oczy (${oczy.model}): ${oczy.powod}`);
                    if (!oczy.ok) { feedback = `Gra buduje się i stan window.__gra się zmienia, ale NA EKRANIE: ${oczy.powod}\nSPRAWDŹ KAMERĘ: OrthographicCamera musi mieć frustum z aspektu i wysokości widoku w jednostkach świata (np. h=20: left=-h*a/2, right=h*a/2, top=h/2, bottom=-h/2), NIE -1..1; PerspectiveCamera — pozycja (gracz.x, 10, gracz.z + 10) i lookAt(gracz). Podłoga (PlaneGeometry 40×40, obrócona -PI/2) i światło muszą być w scenie. Oddaj poprawiony plik w całości.`; continue; }
                }
                const o = typProjektu === 'gra' ? { ok: true, powod: null } : await ocenZachowanie({ cel, migawki: t.migawki, model: z.model });
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
                    await zrzucNieudaneIPrzywroc(dir, z.id);
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
            // Wyjątek w środku rundy (np. timeout Ollamy) zostawiał w projekcie pliki z połowy
            // odpowiedzi (zmierzone 2026-09-22: main.ts zmieniony + questy.ts bez commita).
            // Robimy to samo, co przy nieudanych rundach: diff do nieudane/, powrót do ostatniego commita.
            try {
                if (await zrzucNieudaneIPrzywroc(dir, z.id)) krok('stan', `przywrócono ostatni dobry stan projektu; niedokończona próba w nieudane/${z.id}.diff`);
                const p = await czytajProjekt(projektId);
                p.historia.push({ zadanie: z.id, tresc: cel, ok: false, rundy: z.rundy, sekundy: z.wynik.sekundy, kiedy: z.koniec, commit: null, model: z.model, powod: e.message });
                await zapiszProjekt(p);
            } catch (e2) { krok('blad', `nie udało się przywrócić projektu: ${e2.message}`); }
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
    // junction na Windows odpina fs.rmdir (unlink oddaje EPERM); rm -r i tak nie wchodzi w link — pas i szelki
    try { await fs.rmdir(path.join(dir, 'node_modules')); } catch { try { await fs.unlink(path.join(dir, 'node_modules')); } catch { /* nie było */ } }
    await fs.rm(dir, { recursive: true, force: true });
    return true;
}

/**
 * ANALIZA PROJEKTU — „obecny stan gry i jak może się rozwinąć" (Suweren, 2026-09-21).
 * Kodeks czyta kod i historię, a z kartą Reżysera (narracja, questy) proponuje kierunki.
 * Oddaje JSON: stan, dziala[], brakuje[], kierunki[{tytul, opis, zadanie}], nastepneZadanie.
 * `nastepneZadanie` jest gotowym zleceniem — panel produkcyjny i Nocna Zmiana biorą je 1:1.
 * Zapis do projekt.json → historia analiz zostaje, żeby kolejna widziała poprzednie.
 */
export async function analizuj(projektId, { model } = {}) {
    const p = idOk(projektId) ? await czytajProjekt(projektId) : null;
    if (!p) throw new Error('Nie ma takiego projektu.');
    const silnik = model || cfg.model();
    const obecne = await pliki(projektId);
    const [kodeks, rezyser] = await Promise.all([Persony.karta('kodeks').catch(() => null), Persony.karta('rezyser').catch(() => null)]);
    const poprzednie = (p.analizy ?? []).slice(-2).map((a) => `- ${a.kiedy.slice(0, 10)}: ${a.stan}`).join('\n');
    const system = `${kodeks ? kodeks.tresc + '\n\n' : ''}${p.typ === 'gra' && rezyser ? 'DRUGI GŁOS — Reżyser (narracja, questy, świat):\n' + rezyser.tresc + '\n\n' : ''}Analizujesz PROJEKT ${p.typ === 'gra' ? 'GRY (three.js)' : 'APLIKACJI (React)'} w Katedrze OtakOS. Odpowiadasz WYŁĄCZNIE JSON-em po polsku, bez markdownu:
{"stan":"2–3 zdania: co ten projekt dziś robi","dziala":["co działa"],"brakuje":["co kuleje albo jest atrapą"],"kierunki":[{"tytul":"krótki tytuł","opis":"1–2 zdania","zadanie":"gotowe zlecenie dla Kodeksa, konkretne, wykonalne w jednej rundzie"}],"nastepneZadanie":"jedno zlecenie, które warto zrobić jako pierwsze"}
Kierunków: 3–5, od najmniejszego (dodatek na godzinę) do największego (nowa mechanika). Nie wymyślaj funkcji, których nie widać w kodzie, jako „działających".`;
    const prompt = `PROJEKT: ${p.nazwa} (${p.id}, typ: ${p.typ ?? 'apka'})\nOPIS SUWERENA: ${p.opis || '(brak)'}\n\nHISTORIA ZLECEŃ:\n${p.historia.slice(-8).map((h) => `- ${h.ok ? '✓' : '✗'} ${h.tresc.slice(0, 140)}`).join('\n') || '(tylko szablon)'}\n${poprzednie ? `\nPOPRZEDNIE ANALIZY:\n${poprzednie}\n` : ''}\nKOD:\n${kontekstPlikow(obecne)}`;
    const odp = await pisz({ system, prompt, model: silnik, timeoutMs: 15 * 60_000 });
    const m = odp.tekst.match(/\{[\s\S]*\}/);
    let j;
    try { j = JSON.parse(m ? m[0] : odp.tekst); } catch { throw new Error(`Model nie oddał poprawnego JSON-a analizy (${odp.tokeny} tokenów). Spróbuj ponownie albo innym silnikiem.`); }
    const analiza = {
        kiedy: new Date().toISOString(), model: silnik,
        stan: String(j.stan || '').slice(0, 600),
        dziala: Array.isArray(j.dziala) ? j.dziala.map(String).slice(0, 8) : [],
        brakuje: Array.isArray(j.brakuje) ? j.brakuje.map(String).slice(0, 8) : [],
        kierunki: Array.isArray(j.kierunki) ? j.kierunki.slice(0, 6).map((k) => ({ tytul: String(k.tytul || '').slice(0, 80), opis: String(k.opis || '').slice(0, 300), zadanie: String(k.zadanie || '').slice(0, 600) })) : [],
        nastepneZadanie: String(j.nastepneZadanie || j.kierunki?.[0]?.zadanie || '').slice(0, 600),
    };
    p.analizy = [...(p.analizy ?? []), analiza].slice(-10);
    await zapiszProjekt(p);
    await szyna('praca', `analiza „${p.id}": ${analiza.stan.slice(0, 120)} → następne: ${analiza.nastepneZadanie.slice(0, 80)}`, { projekt: p.id });
    return analiza;
}

/** Nocna Zmiana: „rozwiń projekt" = analiza (jeśli nie ma świeżej) + zlecenie `nastepneZadanie` Kodeksowi. */
export async function rozwin(projektId, { model } = {}) {
    const p = idOk(projektId) ? await czytajProjekt(projektId) : null;
    if (!p) throw new Error('Nie ma takiego projektu.');
    const ostatnia = p.analizy?.at(-1);
    const swieza = ostatnia && (Date.now() - Date.parse(ostatnia.kiedy)) < 24 * 3600_000 && !p.historia.some((h) => h.kiedy > ostatnia.kiedy);
    if (swieza && ostatnia.nastepneZadanie) {
        const z = await buduj(projektId, { zadanie: ostatnia.nastepneZadanie, model });
        return { ...z, zadanie: ostatnia.nastepneZadanie, analiza: ostatnia.stan };
    }
    // ANALIZA TRWA KILKA MINUT, A TO ZABIJAŁO NOCNĄ ZMIANĘ: jej fetch do mostu leciał
    // przez cały czas analizy i undici ucinał połączenie po 300 s („fetch failed",
    // zmierzone 2026-09-22 15:35→15:40). Oddajemy id od razu, a analiza i budowa lecą
    // w tle — sondaż (`/api/appstudio/zadania/<id>/sondaz`) pokazuje, co się dzieje.
    const z = { id: noweId(), projekt: projektId, zadanie: '(analiza: co dalej z projektem)', stan: 'trwa', kroki: [], rundy: 0, wynik: null, od: new Date().toISOString(), model: model || cfg.model() };
    zadania.set(z.id, z);
    z.kroki.push({ typ: 'model', tekst: `analiza projektu (${z.model}) — z niej wyjdzie następne zadanie…`, kiedy: z.od });
    (async () => {
        try {
            const analiza = await analizuj(projektId, { model });
            if (!analiza.nastepneZadanie) throw new Error('Analiza nie wskazała następnego zadania.');
            z.kroki.push({ typ: 'stan', tekst: `analiza gotowa: ${analiza.nastepneZadanie.slice(0, 200)}`, kiedy: new Date().toISOString() });
            const wewn = await buduj(projektId, { zadanie: analiza.nastepneZadanie, model });
            // przepinamy sondaż na zadanie budowy: kroki dopisują się do naszego wpisu
            const zrodlo = zadania.get(wewn.id);
            const tik = setInterval(() => {
                if (!zrodlo) return clearInterval(tik);
                z.kroki = [...z.kroki.slice(0, 2), ...zrodlo.kroki];
                z.rundy = zrodlo.rundy;
                if (zrodlo.stan !== 'trwa') { z.stan = zrodlo.stan; z.wynik = zrodlo.wynik; z.koniec = zrodlo.koniec; clearInterval(tik); }
            }, 5000);
        } catch (e) {
            z.stan = 'blad'; z.koniec = new Date().toISOString();
            z.wynik = { ok: false, rundy: 0, sekundy: Math.round((Date.now() - Date.parse(z.od)) / 1000), powod: e.message };
            z.kroki.push({ typ: 'blad', tekst: `padło: ${e.message}`, kiedy: z.koniec });
        }
    })();
    return { id: z.id, projekt: projektId, model: z.model, zadanie: '(analiza w toku)' };
}

export default { skonfiguruj, projekty, nowyProjekt, projekt, pliki, zrzut, buduj, zadanie, zadaniaProjektu, cofnij, usunProjekt, silniki, analizuj, rozwin, ocenZrzut };
