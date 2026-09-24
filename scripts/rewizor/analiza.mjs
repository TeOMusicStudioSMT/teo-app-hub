/**
 * 🔎 Rewizor Mostu — analiza statyczna Wiesio-Bridge (0.00G)
 *
 * Czyta kod, niczego nie uruchamia. Odpowiada na cztery pytania:
 *   1. Jakie trasy most naprawdę wystawia (i czy któraś nie jest zarejestrowana
 *      dwa razy — w Expressie druga kopia jest wtedy martwa, odpowiada pierwsza).
 *   2. Czy każdy import względny w moście i serwisach wskazuje na istniejący plik.
 *   3. Czy każda importowana nazwa (`import { x } from './m.js'`) jest w `m.js`
 *      eksportowana — inaczej ESM rzuca SyntaxError i most nie wstaje wcale.
 *   4. Które adresy `/api/...` woła klient (Hub, lib, serwisy), a których most
 *      nie zna — takie wywołanie zawsze skończy się 404.
 *
 * Czyste funkcje na tekstach — testy karmią je wycinkami, CLI całym repo.
 * Bez zależności: tylko `node:`.
 */

import fs from 'node:fs';
import path from 'node:path';

export const METODY = ['get', 'post', 'put', 'patch', 'delete', 'all'];

/** Numer linii (od 1) dla pozycji w tekście. */
function linia(tekst, poz) {
    let n = 1;
    for (let i = tekst.indexOf('\n'); i !== -1 && i < poz; i = tekst.indexOf('\n', i + 1)) n++;
    return n;
}

/**
 * Zaślepia spacjami komentarze i (opcjonalnie) tekst literałów szablonowych,
 * zachowując długość i znaki nowej linii — pozycje i numery linii zostają te same.
 * Kod wewnątrz `${…}` zostaje. Literały regex rozpoznaje heurystycznie (po tym, co je poprzedza).
 *
 * Po co: `import App from './App'` wewnątrz szablonu generowanego projektu to nie import
 * mostu, a `// app.get('/api/x')` w komentarzu to nie trasa.
 */
export function maskuj(zrodlo, { szablony = false } = {}) {
    const out = zrodlo.split('');
    const n = zrodlo.length;
    const zaslep = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
    const stos = [];            // głębokości klamer dla zagnieżdżonych `${`
    let klamry = 0, i = 0, poprzedni = '';
    const moznaRegex = () => poprzedni === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(poprzedni) || /\b(return|typeof|case|do|else|in|of|void|yield|await)$/.test(poprzedni);

    const szablon = () => {     // i wskazuje znak po otwierającym `
        const start = i;
        while (i < n) {
            if (zrodlo[i] === '\\') { i += 2; continue; }
            if (zrodlo[i] === '`') { if (szablony) zaslep(start, i); i++; return; }
            if (zrodlo[i] === '$' && zrodlo[i + 1] === '{') {
                if (szablony) zaslep(start, i);
                stos.push(klamry); klamry = 0; i += 2; return;
            }
            i++;
        }
        if (szablony) zaslep(start, i);
    };

    while (i < n) {
        const c = zrodlo[i], d = zrodlo[i + 1];
        if (c === '/' && d === '/') { const k = zrodlo.indexOf('\n', i); const e = k === -1 ? n : k; zaslep(i, e); i = e; continue; }
        if (c === '/' && d === '*') { const k = zrodlo.indexOf('*/', i + 2); const e = k === -1 ? n : k + 2; zaslep(i, e); i = e; continue; }
        if (c === '\'' || c === '"') {
            i++;
            while (i < n && zrodlo[i] !== c && zrodlo[i] !== '\n') i += zrodlo[i] === '\\' ? 2 : 1;
            i++; poprzedni = 'x'; continue;
        }
        if (c === '`') { i++; szablon(); poprzedni = 'x'; continue; }
        if (c === '/' && moznaRegex()) {
            i++; let klasa = false;
            while (i < n && zrodlo[i] !== '\n') {
                if (zrodlo[i] === '\\') { i += 2; continue; }
                if (zrodlo[i] === '[') klasa = true; else if (zrodlo[i] === ']') klasa = false;
                else if (zrodlo[i] === '/' && !klasa) break;
                i++;
            }
            i++; poprzedni = 'x'; continue;
        }
        if (c === '{') klamry++;
        if (c === '}') {
            if (klamry === 0 && stos.length) { klamry = stos.pop(); i++; szablon(); poprzedni = 'x'; continue; }
            klamry--;
        }
        if (!/\s/.test(c)) {
            if (/[\w$]/.test(c)) { let e = i; while (e < n && /[\w$]/.test(zrodlo[e])) e++; poprzedni = zrodlo.slice(i, e); i = e; continue; }
            poprzedni = c;
        }
        i++;
    }
    return out.join('');
}

/**
 * Trasy zarejestrowane przez `app.<metoda>('<ścieżka>', …)` oraz prefiksy `app.use('/api…', …)`.
 * @returns {{ metoda:string, sciezka:string, linia:number, prefiks:boolean }[]}
 */
export function wyciagnijTrasy(zrodlo) {
    const trasy = [];
    const re = new RegExp(`\\bapp\\.(${METODY.join('|')}|use)\\(\\s*(['"\`])([^'"\`]+)\\2`, 'g');
    for (const m of maskuj(zrodlo).matchAll(re)) {
        const [, metoda, , sciezka] = m;
        if (metoda === 'use' && !sciezka.startsWith('/api')) continue;   // statyki nas nie interesują
        if (sciezka.includes('${')) continue;                            // trasa z pętli — nie da się ustalić statycznie
        trasy.push({ metoda: metoda === 'use' ? 'use' : metoda, sciezka, linia: linia(zrodlo, m.index), prefiks: metoda === 'use' });
    }
    return trasy;
}

/** Ta sama metoda + ta sama ścieżka zarejestrowana więcej niż raz. */
export function duplikaty(trasy) {
    const mapa = new Map();
    for (const t of trasy) {
        if (t.prefiks) continue;
        const k = `${t.metoda.toUpperCase()} ${t.sciezka}`;
        mapa.set(k, [...(mapa.get(k) || []), t.linia]);
    }
    return [...mapa].filter(([, l]) => l.length > 1).map(([klucz, linie]) => ({ klucz, linie }));
}

/** Ścieżka Expressa (`/api/x/:id`) → wyrażenie regularne. */
export function wzorTrasy(t) {
    const czesci = t.sciezka.split('/').map((s) => (s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return new RegExp(`^${czesci.join('/')}${t.prefiks ? '(/.*)?' : ''}/?$`);
}

/** Nazwy/definicje wskazujące na cudze serwery z własnym `/api/` (Ollama, Kokoro, ComfyUI…). */
const OBCY = /ollama|11434|kokoro|8880|artemis|comfy|8188|piper|suno/i;
/** Nazwy/definicje wskazujące na most. */
const SWOJ = /most|bridge|wiesl|baza|3001|location\.origin/i;

/** Tekst definicji zmiennej w pliku (`nazwa = …`, `nazwa: …`, `nazwa(…) { return …`). */
function definicja(zrodlo, nazwa) {
    if (!/^[A-Za-z_$][\w$]*$/.test(nazwa)) return '';
    const re = new RegExp(`\\b${nazwa.replace(/\$/g, '\\$')}\\b\\s*(?:=|:|\\([^)]*\\)\\s*(?:=>|\\{))([^;\\n]*)`, 'g');
    return [...zrodlo.matchAll(re)].map((m) => m[1]).join(' ');
}

/**
 * Czy przedrostek literału przed `/api/` wskazuje na most.
 * Klient (Hub, przeglądarka): goły `/api/…` i `${ZMIENNA}/api/…` idą do mostu, chyba że zmienna jest obca.
 * Serwer (serwisy Node): goły `/api/…` to zwykle cudze API — liczy się tylko jawny adres mostu.
 */
function prefiksToMost(przed, zrodlo, serwer) {
    if (przed === '') return !serwer;
    if (/^(https?:)?\/\/(127\.0\.0\.1|localhost):3001$/.test(przed)) return true;
    const m = przed.match(/^\$\{([^}]*)\}$/);
    if (!m) return false;
    const nazwa = m[1].replace(/\(\)$/, '').split('.').pop();
    const def = definicja(zrodlo, nazwa);
    if (OBCY.test(m[1]) || OBCY.test(def)) return false;
    return serwer ? SWOJ.test(m[1]) || SWOJ.test(def) : true;
}

/**
 * Ścieżki `/api/...` wołane w kodzie klienta.
 * Fragmenty `${…}` w środku ścieżki zamieniane są na „X" (jeden segment);
 * `${…}` doklejone na końcu bez ukośnika to query (`/api/tunel${sprawdz}`) — odcinane.
 * Literał kończący się ukośnikiem (`/api/forge/`) to prefiks — `prefiks: true`.
 * @param {{ serwer?:boolean, pominPrefiksy?:string[] }} [opcje]
 * @returns {{ sciezka:string, surowa:string, linia:number, prefiks:boolean }[]}
 */
export function wyciagnijWywolania(zrodlo, { serwer = false, pominPrefiksy = [] } = {}) {
    const wynik = [];
    const kod = maskuj(zrodlo);            // komentarze zaślepione — literały zostają
    const re = /\/api\/(?:[A-Za-z0-9_.:-]|\/|\$\{[^}\n]*\})*/g;
    for (const m of zrodlo.matchAll(re)) {
        if (kod[m.index] !== '/') continue;                  // w komentarzu
        // Cofnij się do otwierającego cudzysłowu w tej samej linii.
        let i = m.index - 1, przed = '';
        while (i >= 0 && !`'"\`\n`.includes(zrodlo[i])) przed = zrodlo[i--] + przed;
        if (i < 0 || zrodlo[i] === '\n') continue;          // nie literał (regex, goły tekst)
        if (!prefiksToMost(przed, zrodlo, serwer)) continue;

        let surowa = m[0];
        surowa = surowa.replace(/([^/])\$\{[^}]*\}$/, '$1'); // `…/status${q}` → query
        if (pominPrefiksy.some((p) => surowa === p || surowa.startsWith(p + '/'))) continue;
        const prefiks = surowa.endsWith('/');
        const sciezka = surowa.replace(/\$\{[^}]*\}/g, 'X').replace(/\/+$/, '');
        if (sciezka === '/api') continue;
        wynik.push({ sciezka, surowa, linia: linia(zrodlo, m.index), prefiks });
    }
    return wynik;
}

/**
 * Ścieżki WebSocket obsługiwane ręcznie w `upgrade` (`pathname === '/api/…'`).
 * Express ich nie zna, ale klient ma prawo je wołać.
 */
export function wyciagnijSciezkiWs(zrodlo) {
    const re = /pathname\s*[!=]==\s*(['"])(\/api\/[^'"]+)\1/g;
    return [...maskuj(zrodlo).matchAll(re)].map((m) => ({ metoda: 'ws', sciezka: m[2], linia: linia(zrodlo, m.index), prefiks: false }));
}

/** Prefiksy przekierowane przez proxy Vite do cudzych serwerów (`'/api/suno': { target: … }`). */
export function prefiksyProxy(zrodloVite) {
    return [...zrodloVite.matchAll(/(['"])(\/api\/[^'"]+)\1\s*:\s*\{/g)].map((m) => m[2]);
}

/** Czy konkretna ścieżka trafia w którąś z tras. */
export function znajdzTrase(wywolanie, wzory) {
    const { sciezka, prefiks } = typeof wywolanie === 'string' ? { sciezka: wywolanie, prefiks: false } : wywolanie;
    if (prefiks) return wzory.find((w) => w.trasa.sciezka.startsWith(sciezka + '/'))?.trasa ?? null;
    return wzory.find((w) => w.re.test(sciezka))?.trasa ?? null;
}

/** Importy względne (`from './x.js'`, `import('./x.js')`, `require('./x')`). */
export function wyciagnijImporty(zrodlo) {
    const wynik = [];
    const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(['"])(\.{1,2}\/[^'"]+)\1/gm;
    for (const m of maskuj(zrodlo, { szablony: true }).matchAll(re)) wynik.push({ cel: m[2], linia: linia(zrodlo, m.index) });
    return wynik;
}

/** Czy import względny rozwiązuje się do istniejącego pliku (z typowymi dopełnieniami). */
export function importIstnieje(plik, cel) {
    return rozwiazImport(plik, cel) !== null;
}

/**
 * Nazwy eksportowane przez moduł ESM. `null`, gdy moduł ma `export * from` —
 * wtedy pełnej listy nie da się ustalić bez czytania kolejnych plików.
 */
export function wyciagnijEksporty(zrodlo) {
    const kod = maskuj(zrodlo, { szablony: true });
    if (/\bexport\s*\*\s*from\b/.test(kod)) return null;
    const nazwy = new Set();
    for (const m of kod.matchAll(/\bexport\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([\w$]+)/g)) nazwy.add(m[1]);
    for (const m of kod.matchAll(/\bexport\s+(?:const|let|var)\s*\{([^}]*)\}/g)) {
        for (const c of m[1].split(',')) { const n = c.split(':').pop().split('=')[0].trim(); if (n) nazwy.add(n); }
    }
    for (const m of kod.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
        for (const c of m[1].split(',')) { const n = c.trim().split(/\s+as\s+/).pop().trim(); if (n) nazwy.add(n); }
    }
    if (/\bexport\s+default\b/.test(kod)) nazwy.add('default');
    return nazwy;
}

/**
 * Nazwy, których plik oczekuje od importów względnych:
 * `import X, { a, b as c } from './m.js'` → { cel:'./m.js', nazwy:['default','a','b'] }.
 * `import * as M` niczego nie wymaga.
 */
export function wyciagnijImportyNazwane(zrodlo) {
    const kod = maskuj(zrodlo, { szablony: true });
    const wynik = [];
    const re = /\bimport\s+(?!type\b)([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*(['"])(\.{1,2}\/[^'"]+)\3/g;
    for (const m of kod.matchAll(re)) {
        const nazwy = [];
        if (m[1]) nazwy.push('default');
        for (const c of (m[2] || '').split(',')) {
            const n = c.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
            if (n && !c.trim().startsWith('type ')) nazwy.push(n);
        }
        if (nazwy.length) wynik.push({ cel: m[4], nazwy, linia: linia(zrodlo, m.index) });
    }
    return wynik;
}

/** Ścieżka pliku, do którego rozwiązuje się import względny (albo null). */
export function rozwiazImport(plik, cel) {
    const baza = path.resolve(path.dirname(plik), cel);
    const kandydaci = [baza, ...['.js', '.mjs', '.cjs', '.json', '.ts'].map((r) => baza + r), path.join(baza, 'index.js')];
    return kandydaci.find((k) => fs.existsSync(k) && fs.statSync(k).isFile()) ?? null;
}

/** Rekurencyjny spis plików o danych rozszerzeniach. */
export function spisPlikow(katalog, rozszerzenia, pomin = []) {
    const wynik = [];
    if (!fs.existsSync(katalog)) return wynik;
    for (const w of fs.readdirSync(katalog, { withFileTypes: true })) {
        const p = path.join(katalog, w.name);
        if (pomin.some((x) => p.includes(x))) continue;
        if (w.isDirectory()) wynik.push(...spisPlikow(p, rozszerzenia, pomin));
        else if (rozszerzenia.includes(path.extname(w.name))) wynik.push(p);
    }
    return wynik;
}

/** Katalogi pomijane wszędzie: zależności, buildy i kopie zapasowe. */
export const POMIJANE = ['node_modules', `${path.sep}dist${path.sep}`, `public${path.sep}apps`, '.bak'];

/** Pliki serwera: most + serwisy + rdzeń (tylko JS — to, co wykonuje Node). */
export function plikiSerwera(korzen) {
    return [
        path.join(korzen, 'wiesio-bridge.js'),
        ...spisPlikow(path.join(korzen, 'services'), ['.js', '.mjs'], POMIJANE),
        ...spisPlikow(path.join(korzen, 'core'), ['.js', '.mjs'], POMIJANE),
    ].filter((p) => fs.existsSync(p));
}

/** Pliki klienta mostu: wszystko, co może zawołać `/api/...`, poza samym mostem. */
export function plikiKlienta(korzen) {
    const katalogi = ['components', 'lib', 'hooks', 'context', 'store', 'src', 'services', 'core', 'constants', path.join('public', 'delegat'), path.join('public', 'gosc')];
    const pliki = katalogi.flatMap((k) => spisPlikow(path.join(korzen, k), ['.ts', '.tsx', '.js', '.mjs', '.html'], POMIJANE));
    for (const p of ['App.tsx', 'index.tsx', 'constants.tsx']) if (fs.existsSync(path.join(korzen, p))) pliki.push(path.join(korzen, p));
    return pliki;
}

/**
 * Pełna rewizja repo. Zwraca surowe znaleziska — o tym, co jest porażką, decyduje wołający.
 */
export function rewizja(korzen) {
    const most = path.join(korzen, 'wiesio-bridge.js');
    const trasy = wyciagnijTrasy(fs.readFileSync(most, 'utf8'));
    const serwer = plikiSerwera(korzen);
    const ws = serwer.flatMap((p) => wyciagnijSciezkiWs(fs.readFileSync(p, 'utf8')));
    const wzory = [...trasy, ...ws].map((trasa) => ({ trasa, re: wzorTrasy(trasa) }));
    const vite = path.join(korzen, 'vite.config.ts');
    const pominPrefiksy = fs.existsSync(vite) ? prefiksyProxy(fs.readFileSync(vite, 'utf8')) : [];
    const katalogiSerwera = ['services', 'core'].map((k) => path.join(korzen, k) + path.sep);

    const martweImporty = [], brakujaceEksporty = [];
    const eksporty = new Map();
    for (const plik of serwer) {
        const zrodlo = fs.readFileSync(plik, 'utf8');
        for (const imp of wyciagnijImporty(zrodlo)) {
            if (!importIstnieje(plik, imp.cel)) martweImporty.push({ plik: path.relative(korzen, plik), ...imp });
        }
        for (const imp of wyciagnijImportyNazwane(zrodlo)) {
            const cel = rozwiazImport(plik, imp.cel);
            if (!cel || !/\.m?js$/.test(cel)) continue;
            if (!eksporty.has(cel)) eksporty.set(cel, wyciagnijEksporty(fs.readFileSync(cel, 'utf8')));
            const jest = eksporty.get(cel);
            if (!jest) continue;
            const brak = imp.nazwy.filter((n) => !jest.has(n));
            if (brak.length) brakujaceEksporty.push({ plik: path.relative(korzen, plik), linia: imp.linia, cel: imp.cel, brak });
        }
    }

    const osierocone = [];
    for (const plik of plikiKlienta(korzen)) {
        const jestSerwerem = katalogiSerwera.some((k) => plik.startsWith(k)) && /\.m?js$/.test(plik);
        for (const w of wyciagnijWywolania(fs.readFileSync(plik, 'utf8'), { serwer: jestSerwerem, pominPrefiksy })) {
            if (!znajdzTrase(w, wzory)) osierocone.push({ plik: path.relative(korzen, plik), ...w });
        }
    }

    return { trasy, ws, duplikaty: duplikaty(trasy), martweImporty, brakujaceEksporty, osierocone };
}
