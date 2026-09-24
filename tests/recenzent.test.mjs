/**
 * Recenzent Kodeksa — każda sztuczka, którą ma łapać, i każdy uczciwy przypadek,
 * którego NIE ma blokować (fałszywy alarm pali rundę Kodeksa na GPU Suwerena).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recenzuj, dodaneLinie, eksporty } from '../services/RecenzentKodeksa.js';

const STARY_MAIN = [
    "import * as THREE from 'three';",
    "import { stworzWrogow, ruszWrogow } from './wrogowie';",
    'export function start() {',
    '  const scena = new THREE.Scene();',
    '  stworzWrogow(scena);',
    '}',
    'export function petla(dt: number) {',
    '  ruszWrogow(dt);',
    '}',
    'export function zapisz() {',
    "  localStorage.setItem('gra', '1');",
    '}',
].join('\n');

const reguly = (r) => r.blokujace.map((u) => u.regula);

describe('dodaneLinie / eksporty', () => {
    test('liczy tylko linie, których wcześniej nie było (wielozbiorowo)', () => {
        const d = dodaneLinie('a\nb\n', 'a\nb\nb\nc\n');
        assert.deepEqual(d.map((x) => x.tekst), ['b', 'c']);
        assert.deepEqual(d.map((x) => x.linia), [3, 4]);
    });
    test('eksporty: funkcje, stałe, typy, listy', () => {
        const e = eksporty('export function a() {}\nexport const B = 1;\nexport interface C {}\nconst d = 1; export { d as D };');
        assert.deepEqual([...e].sort(), ['B', 'C', 'D', 'a']);
    });
});

describe('blokuje sztuczki', () => {
    test('zaślepka „// ... reszta bez zmian"', () => {
        const nowa = "import * as THREE from 'three';\n// ... reszta bez zmian\nexport function start() { /* nowe */ }\nexport function petla(dt: number) {}\nexport function zapisz() {}";
        const r = recenzuj({ pliki: [{ sciezka: 'src/main.ts', stara: STARY_MAIN, nowa }], cel: 'dodaj HUD' });
        assert.equal(r.ok, false);
        assert.ok(reguly(r).includes('zaslepka'));
        assert.match(r.feedback, /W CAŁOŚCI/);
    });
    test('zaślepka po angielsku i w JSX', () => {
        for (const l of ['// ... existing code ...', '{/* ... */}', '// …', '/* rest of the component */']) {
            const r = recenzuj({ pliki: [{ sciezka: 'src/App.tsx', stara: '', nowa: l }], cel: 'x' });
            assert.ok(reguly(r).includes('zaslepka'), l);
        }
    });
    test('@ts-ignore / @ts-nocheck', () => {
        const r = recenzuj({ pliki: [{ sciezka: 'src/a.ts', stara: 'const a = 1;', nowa: 'const a = 1;\n// @ts-ignore\nconst b: number = "x";' }], cel: 'x' });
        assert.deepEqual(reguly(r), ['ucisza-tsc']);
        assert.equal(r.blokujace[0].linia, 2);
    });
    test('pusty catch', () => {
        const r = recenzuj({ pliki: [{ sciezka: 'src/a.ts', stara: null, nowa: 'try { f(); } catch (e) {}\ntry { g(); } catch {}' }], cel: 'x' });
        assert.deepEqual(reguly(r), ['pusty-catch', 'pusty-catch']);
    });
    test('atrapa „not implemented"', () => {
        const r = recenzuj({ pliki: [{ sciezka: 'src/a.ts', stara: null, nowa: "export function mikstura() { throw new Error('Not implemented yet'); }" }], cel: 'x' });
        assert.deepEqual(reguly(r), ['atrapa']);
    });
    test('stan audio wpisany sędziemu na sztywno', () => {
        const r = recenzuj({ pliki: [{ sciezka: 'src/main.ts', stara: null, nowa: "window.__gra.dzwiek = { kontekst: 'running' };" }], cel: 'dodaj dźwięk' });
        assert.deepEqual(reguly(r), ['oszukany-sedzia']);
    });
    test('wycięta funkcja, której zadanie nie kazało ruszać', () => {
        const nowa = STARY_MAIN.split('\n').slice(0, 9).join('\n') + '\nexport function hud() {}';   // zapisz() zniknęło
        const r = recenzuj({ pliki: [{ sciezka: 'src/main.ts', stara: STARY_MAIN, nowa }], cel: 'dodaj HUD' });
        assert.deepEqual(reguly(r), ['wyciete-eksporty']);
        assert.match(r.feedback, /zapisz/);
    });
    test('plik skurczony o ponad połowę bez przeniesienia kodu', () => {
        const stara = Array.from({ length: 40 }, (_, i) => `const x${i} = ${i};`).join('\n');
        const r = recenzuj({ pliki: [{ sciezka: 'src/dane.ts', stara, nowa: 'const x0 = 0;\nconst nowa = 1;' }], cel: 'dodaj stałą' });
        assert.deepEqual(reguly(r), ['skurczony-plik']);
    });
});

describe('nie blokuje uczciwej pracy', () => {
    test('zwykła zmiana: dopisana funkcja, nic nie zniknęło', () => {
        const nowa = STARY_MAIN + '\nexport function hud(el: HTMLElement) {\n  el.textContent = "GRV";\n}';
        const r = recenzuj({ pliki: [{ sciezka: 'src/main.ts', stara: STARY_MAIN, nowa }], cel: 'dodaj HUD' });
        assert.equal(r.ok, true);
        assert.deepEqual(r.uwagi, []);
    });
    test('funkcja przeniesiona do nowego modułu (wydzielenie) — w porządku', () => {
        const main = STARY_MAIN.replace(/export function zapisz\(\) \{\n.*\n\}/, '').concat("\nimport { zapisz } from './zapis';");
        const r = recenzuj({ pliki: [
            { sciezka: 'src/main.ts', stara: STARY_MAIN, nowa: main },
            { sciezka: 'src/zapis.ts', stara: null, nowa: "export function zapisz() {\n  localStorage.setItem('gra', '1');\n}" },
        ], cel: 'dodaj autozapis' });
        assert.equal(r.ok, true, r.feedback);
    });
    test('zlecenie każe usunąć — usunięcie nie jest wycięciem', () => {
        const nowa = STARY_MAIN.split('\n').slice(0, 9).join('\n');
        const r = recenzuj({ pliki: [{ sciezka: 'src/main.ts', stara: STARY_MAIN, nowa }], cel: 'usuń zapisywanie gry' });
        assert.equal(r.ok, true);
    });
    test('stary dług nie blokuje: @ts-ignore, który już był w pliku', () => {
        const stara = '// @ts-ignore\nconst a: number = "x";';
        const r = recenzuj({ pliki: [{ sciezka: 'src/a.ts', stara, nowa: stara + '\nconst b = 2;' }], cel: 'x' });
        assert.equal(r.ok, true);
    });
    test('wielokropek w zwykłym tekście i spread nie są zaślepką', () => {
        const nowa = "const t = 'Ładowanie...';\nconst o = { ...stan, x: 1 };\n// Liczy obrażenia (z pancerzem).\nconst u = 'https://x';\n{/* Reszta floty (wkrótce) */}\n// Reszta tej listy to handlery wpisane w most\ntry { f(); } catch { /* cisza celowa: brak localStorage w trybie prywatnym */ }";
        const r = recenzuj({ pliki: [{ sciezka: 'src/a.ts', stara: null, nowa }], cel: 'x' });
        assert.equal(r.ok, true, r.feedback);
    });
    test('CSS nie podlega regułom kodu', () => {
        const r = recenzuj({ pliki: [{ sciezka: 'src/index.css', stara: null, nowa: '/* ... */\nbody { margin: 0 }' }], cel: 'x' });
        assert.equal(r.ok, true);
    });
    test('any, TODO i .catch(() => {}) to tylko uwagi', () => {
        const nowa = 'const a: any = 1;\n// TODO: ładniej\nf().catch(() => {});';
        const r = recenzuj({ pliki: [{ sciezka: 'src/a.ts', stara: null, nowa }], cel: 'x' });
        assert.equal(r.ok, true);
        assert.deepEqual(r.uwagi.map((u) => u.regula).sort(), ['any', 'polkniety-promise', 'todo']);
        assert.match(r.podsumowanie, /uwagi/);
    });
});
