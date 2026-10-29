// 🧬 Dziedzictwo łańcucha modeli + sędzia martwego modułu po grafie importów (Suweren 2026-10-09: na zadaniu 8.1 padały
// Gemini, Opus i Sonnet w kółko — moduł podpięty w src/gra/rytm.ts był „martwy”, bo liczył się tylko import z main.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { martweZGrafu, blokDziedzictwa } from '../services/AppStudio.js';
import { scalDziedzictwo } from '../services/Gdd.js';

const plik = (sciezka, tresc = '') => ({ sciezka, tresc });

test('martwy moduł: osiągalność od main — import z innego modułu, bez `from`, z .js, dynamiczny', () => {
    const main = plik('src/main.ts', "import { rytm } from './gra/rytm';\nimport './efekty.js';\nconst x = await import('./leniwy');");
    const rytm = plik('src/gra/rytm.ts', "import { pominieteWTescie } from '../trybTestu';");
    const tryb = plik('src/trybTestu.ts', 'export const pominieteWTescie = 1;');
    const efekty = plik('src/efekty.ts');
    const leniwy = plik('src/leniwy.ts');
    const sierota = plik('src/sierota.ts', "import { pominieteWTescie } from './trybTestu';");
    const test1 = plik('src/rytm.test.ts');
    const html = plik('index.html', '<script type="module" src="/src/main.ts"></script>');
    const wszystkie = [main, rytm, tryb, efekty, leniwy, sierota, test1, html];
    const kandydaci = wszystkie.filter((p) => /^src\/.+\.tsx?$/.test(p.sciezka) && !/\.(d|test|spec)\.tsx?$/.test(p.sciezka) && !/^src\/(main|index)\./.test(p.sciezka));
    assert.deepEqual(martweZGrafu(wszystkie, kandydaci).map((k) => k.sciezka), ['src/sierota.ts'], 'tylko moduł, do którego nie prowadzi żadna droga od main');
    // ta sama nazwa w dwóch katalogach (taniec.ts i gra/taniec.ts) — nie mylimy ich
    const t1 = plik('src/taniec.ts'), t2 = plik('src/gra/taniec.ts');
    assert.deepEqual(martweZGrafu([plik('src/main.ts', "import './gra/taniec'"), t1, t2], [t1, t2]).map((k) => k.sciezka), ['src/taniec.ts']);
});

test('scalDziedzictwo: pliki najdalszej próby (remis = wcześniejsza), błędy wszystkich bez powtórek', () => {
    const a = scalDziedzictwo(null, { model: 'sonnet', etap: 'build', pliki: [plik('src/a.ts', 'A')], bledy: ['tsc: brak typu'] });
    const b = scalDziedzictwo(a, { model: 'gemini', etap: 'martwy-modul', pliki: [plik('src/b.ts', 'B')], bledy: ['martwy moduł', 'tsc: brak typu'] });
    assert.deepEqual([b.model, b.etap, b.pliki[0].sciezka, b.modele], ['sonnet', 'build', 'src/a.ts', ['sonnet', 'gemini']]);
    assert.deepEqual(b.bledy, ['tsc: brak typu', 'martwy moduł']);
    const c = scalDziedzictwo(b, { model: 'opus', etap: 'przegladarka', pliki: [plik('src/c.ts', 'C')], bledy: [] });
    assert.equal(c.model, 'opus', 'dalej posunięta próba wygrywa');
    const d = scalDziedzictwo(c, { model: 'ling', etap: 'przegladarka', pliki: [plik('src/d.ts')], bledy: [] });
    assert.equal(d.model, 'opus', 'remis = wcześniejsza');
    assert.deepEqual(scalDziedzictwo(null, null, 'zadanie zniknęło').bledy, ['zadanie zniknęło']);
});

test('blokDziedzictwa: błędy poprzedników i pliki najdalszej próby w prompcie; za długi plik pominięty', () => {
    assert.equal(blokDziedzictwa(null), '');
    const blok = blokDziedzictwa({ modele: ['sonnet', 'gemini'], model: 'sonnet', etap: 'build', bledy: ['tsc: brak typu'], pliki: [plik('src/a.ts', 'export const a = 1;'), plik('src/duzy.ts', 'x'.repeat(40_000))] });
    assert.match(blok, /sonnet → gemini/);
    assert.match(blok, /1\. tsc: brak typu/);
    assert.match(blok, /=== PLIK: src\/a\.ts ===\nexport const a = 1;\n=== KONIEC ===/);
    assert.doesNotMatch(blok, /src\/duzy\.ts ===/);
    assert.match(blok, /pominięto 1 plik/);
});

test('💡 JaJo w dziedzictwie: wszystkie odrzucone rundy z modelem idą dalej, rada Mistrza na górze bloku', async () => {
    const a = scalDziedzictwo(null, { model: 'sonnet', etap: 'martwy-modul', pliki: [], bledy: ['martwy'], rundy: [{ model: 'sonnet', powod: 'Dodałeś src/x.ts, ale ŻADEN plik projektu tego nie importuje' }, { model: 'sonnet', powod: 'Dodałeś src/x.ts, ale ŻADEN plik projektu tego nie importuje' }] });
    const b = scalDziedzictwo(a, { model: 'gemini', etap: 'martwy-modul', pliki: [], bledy: ['martwy'], rundy: [{ model: 'gemini', powod: 'Dodałeś src/x.ts, ale ŻADEN plik projektu tego nie importuje' }] });
    assert.equal(b.rundy.length, 3, 'powtórki zostają — JaJo liczy, ile razy');
    assert.deepEqual(scalDziedzictwo(null, null, 'zadanie zniknęło').rundy, [{ model: null, powod: 'zadanie zniknęło' }]);
    const { ulozPodpowiedz } = await import('../services/JajoMistrza.js');
    const p = ulozPodpowiedz({ bledy: b.rundy, historia: [] });
    assert.equal(p.uparty?.razy, 3);
    const blok = blokDziedzictwa({ ...b, rada: p.tekst });
    assert.ok(blok.trimStart().startsWith('💡 PODPOWIEDŹ MISTRZA'), 'rada Mistrza na samej górze');
    assert.match(blok, /POPRZEDNIE PRÓBY TEGO ZADANIA \(sonnet → gemini\)/);
    assert.match(blokDziedzictwa({ rada: 'sama rada' }), /sama rada/);
});

test('🛁 SPA: spokojny blok bez ściany błędów i bez cudzych plików', async () => {
    const { blokDziedzictwa } = await import('../services/AppStudio.js');
    const b = blokDziedzictwa({ spa: true, przeszkoda: 'tsc: TS2304 Cannot find name THREE', rada: 'Zaimportuj three.' });
    assert.match(b, /WRACASZ Z KĄPIELI/);
    assert.match(b, /TS2304/);
    assert.match(b, /Zaimportuj three/);
    assert.doesNotMatch(b, /=== PLIK:/);
    assert.doesNotMatch(b, /NIE PRZESZŁY/);
    assert.doesNotMatch(b, /sam zobaczyłeś/, 'bez Aha — bez bloku Aha');
    const zAha = blokDziedzictwa({ spa: true, przeszkoda: 'x', aha: 'Wystarczy jeden nowy plik ze słuchaczem.' });
    assert.match(zAha, /W kąpieli sam zobaczyłeś[^]*jeden nowy plik ze słuchaczem[^]*najmniejszy ruch/);
});

test('🧩 rejestr modułów: podpina tylko moduł, który sam coś robi po imporcie', async () => {
    const { maEfektUboczny } = await import('../services/AppStudio.js');
    const fs = await import('node:fs');
    const gra = new URL('../../_OtakOs_Apki/teterhia-wieczna-saga/src/', import.meta.url);
    // samo-podpinający się moduł (wywołanie na najwyższym poziomie)
    assert.equal(maEfektUboczny("import { naKopniecie } from './tworczosc';\nnaKopniecie((k) => {\n  return 'x';\n});\n"), true);
    assert.equal(maEfektUboczny("void start();\n"), true);
    // atrapa z samymi eksportami (Teterhia 2026-10-26) i wywołania w komentarzu albo w funkcji — nie
    assert.equal(maEfektUboczny("/** naKopniecie(x) w opisie */\nexport function czyKolizja(a) {\n  return policz(a);\n}\nexport const X = 1;\n"), false);
    assert.equal(maEfektUboczny("// dodajKrok(f)\nexport interface A { b: number }\n"), false);
    if (fs.existsSync(new URL('jajaZakopane.ts', gra))) {
        assert.equal(maEfektUboczny(fs.readFileSync(new URL('jajaZakopane.ts', gra), 'utf8')), true);
        assert.equal(maEfektUboczny(fs.readFileSync(new URL('gra/jajaZakopane.ts', gra), 'utf8')), false);
    }
});
