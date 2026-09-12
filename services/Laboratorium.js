/**
 * 🧪 LABORATORIUM — zaplecze TeO Lab Studio (2026-09-12).
 *
 * Suweren: „TeO Lab to teraz component w Story, a zasługuje na własne Studio…
 * z własnym sandboxem dla Nocnej Zmiany, gdzie mogą usprawniać nasze appki
 * i ich elementy, i tam je prezentować po nocnej zmianie — Suweren zatwierdza,
 * czy wprowadzić do Katedry, czy nie. Printy z modelem lokalnym. Arena, gdzie
 * można przeciągnąć kilka TeOgochi i niech coś labują. Dział projektowania
 * chipów pod modele AI — Blender do projektu budowy, własne pliki z analizą."
 *
 * CZTERY DZIAŁY, każdy na tym, co w Katedrze ISTNIEJE:
 *
 *   1. PRINTY      — TeOPrint (dokument koncepcyjny) z LOKALNEGO modelu przez
 *                    Ollamę. Stary moduł w Story szedł do Gemini po kluczu
 *                    i zapisywał do Firebase — tu zero chmury, plik .md na dysku.
 *   2. PIASKOWNICA — osobny `git worktree` każdej apki, POZA repozytoriami
 *                    (`<ToO APP>/_OtakOs_Piaskownica/<apka>`). Robot Nocnej
 *                    Zmiany bierze ZLECENIE (apka, plik, cel), prosi model
 *                    o cały plik po zmianie, przepuszcza przez Tarczę Prawdy,
 *                    weryfikuje (tsc / node --check), commituje na gałąź
 *                    `lab/<id>`. Rano Suweren widzi diff i decyduje:
 *                    zatwierdź = `git cherry-pick -n` do PRAWDZIWEGO drzewa
 *                    roboczego (commit robi Suweren sam), odrzuć = gałąź znika.
 *   3. ARENA       — kilka TeOgochi ze stada (migawka mostu) rozmawia o temacie
 *                    przez N rund; każdy mówi swoją dziedziną; na końcu wnioski.
 *                    Zadanie w tle, odpytywane jak Skryba.
 *   4. CHIPY       — projekt układu pod konkretny model: liczby z JAWNYCH wzorów
 *                    (wagi, KV cache, FLOPs/token, pasmo przy zadanym tok/s,
 *                    liczba stosów HBM), nota projektowa z modelu, skrypt bpy
 *                    z rozkładem bloków (interposer, die, HBM) + render przez
 *                    Blender.uruchom, gdy Blender jest. Analiza własnych plików
 *                    (tekstowych) modelem.
 *
 * ⚠️ ZERO „Z DUPY". Piaskownica pracuje na STANIE ZACOMMITOWANYM apki (HEAD),
 * nie na tym, co Suweren ma niezapisane. Zatwierdzenie nakłada zmianę na drzewo
 * robocze — jeśli konfliktuje z niezacommitowaną pracą, `cherry-pick` odmawia
 * i cofa się (`--abort`); mówimy to wprost.
 *
 * ⚠️ Weryfikacja TS w piaskownicy potrzebuje node_modules — robimy JUNCTION
 * do node_modules apki-matki (bez kopiowania gigabajtów). Gdy apka nie ma
 * node_modules, weryfikacja mówi „pominięta", nie „zielona".
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import AlignmentShield from './AlignmentShield.js';
import * as MostStada from './MostStada.js';
import * as Blender from './Blender.js';

const run = promisify(execFile);

let ollamaBase = 'http://127.0.0.1:11434';
let modelDomyslny = 'gemma4:e2b';
let modelKodu = null;   // funkcja → model Mechanika (żywy, bo Suweren zmienia go w locie)
let szyna = null;

const KATEDRA = () => process.cwd();
const RODZINA = () => path.resolve(KATEDRA(), '..');
const WYMIAR = () => path.join(KATEDRA(), '_OtakOs_Wymiar', 'lab');
const PIASKOWNICA = () => path.join(RODZINA(), '_OtakOs_Piaskownica');

/** Apki, które Lab może brać do piaskownicy. Lista kandydatów jak w LAUNCH_APPS mostu. */
const APKI = {
    katedra: { nazwa: 'Katedra (TeO_Genesis)',  dir: ['.'] },
    music:   { nazwa: 'TeO Music Studio',        dir: ['TeO_Music_Studio', 'TeO_Music_V2'] },
    story:   { nazwa: 'TeO Story Studio',        dir: ['TeO_Story_Studio', 'TeO_Story_V2'] },
    app:     { nazwa: 'TeO App Studio',          dir: ['TeO_App_Studio', 'TeO_App_V2'] },
    games:   { nazwa: 'TeO Games Studio',        dir: ['TeO_Games_Studio'] },
    fashion: { nazwa: 'TeO Fashion Studio',      dir: ['TeO_Fashion_Studio'] },
    lab:     { nazwa: 'TeO Lab Studio',          dir: ['TeO_Lab_Studio'] },
};

export function skonfiguruj({ ollama, model, modelMechanika, szynaZdarzen } = {}) {
    if (ollama) ollamaBase = ollama;
    if (model) modelDomyslny = model;
    if (modelMechanika) modelKodu = modelMechanika;
    if (szynaZdarzen) szyna = szynaZdarzen;
}

function katalogApki(id) {
    const cfg = APKI[id];
    if (!cfg) throw new Error(`Nie znam apki „${id}". Znam: ${Object.keys(APKI).join(', ')}.`);
    for (const d of cfg.dir) {
        const abs = d === '.' ? KATEDRA() : path.join(RODZINA(), d);
        if (fsSync.existsSync(path.join(abs, '.git'))) return abs;
    }
    throw new Error(`Apka „${id}" nie ma repozytorium git w żadnym z katalogów: ${cfg.dir.join(', ')}.`);
}

async function upewnijKatalogi() {
    for (const d of ['printy', 'arena', 'chipy']) await fs.mkdir(path.join(WYMIAR(), d), { recursive: true });
}

async function czytajJson(plik, domyslne) {
    try { return JSON.parse(await fs.readFile(plik, 'utf8')); } catch { return domyslne; }
}
async function zapiszJson(plik, dane) {
    await fs.mkdir(path.dirname(plik), { recursive: true });
    const tmp = `${plik}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(dane, null, 2), 'utf8');
    await fs.rename(tmp, plik);
}

const id8 = () => crypto.randomBytes(4).toString('hex');
const teraz = () => new Date().toISOString();

function zdarzenie(rodzaj, tresc) {
    try { szyna?.nadaj?.({ agent: 'lab', rodzaj, tresc })?.catch?.(() => {}); } catch { /* szyna opcjonalna */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// OLLAMA — jedno wywołanie, bez strumienia, think:false (qwen3.x inaczej milczy)
// ─────────────────────────────────────────────────────────────────────────────

export async function pisz({ system = '', prompt, model, timeoutMs = 300_000 }) {
    const silnik = model || modelDomyslny;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(`${ollamaBase}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ model: silnik, system, prompt, stream: false, think: false }),
        });
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        const d = await r.json();
        return { tekst: String(d.response || '').trim(), model: silnik, tokeny: (Number(d.eval_count) || 0) + (Number(d.prompt_eval_count) || 0) };
    } catch (e) {
        throw new Error(e.name === 'AbortError' ? `Ollama nie zdążyła (${Math.round(timeoutMs / 1000)} s).` : e.message);
    } finally { clearTimeout(t); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRINTY — TeOPrint z lokalnego modelu
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PRINTU = `Jesteś Agentem Architektem w TeO LaB (Katedra OtakOS). Przekuwasz „szalony pomysł" Suwerena w koncept inżynieryjny — TeOPrint. Piszesz po polsku, Markdown, konkretnie, bez lania wody.
STRUKTURA (dokładnie te nagłówki):
# 🧬 TeOPrint
**Nazwa Projektu:** …
**Klasa:** Życie / Energia / Świadomość / Materia / Informacja
## 1. Koncepcja (Iskra)
Naukowa podstawa. Jeśli pomysł w tej formie jest niemożliwy — powiedz to wprost i znajdź „Pośrednika" (mechanizm, który go umożliwia).
## 2. Technologia i Budowa
Punkty: element → co robi.
## 3. Zasada Działania
Kroki 1..n.
## 4. Analiza Wpływu
Ekologia/energia, dostępność lokalna, ryzyka.
## 5. Model Ekonomiczny (TeO Market)
Licencja, cena w GRV (0 dla dobra ogółu), royalty za użycie przemysłowe.
## 6. Czego NIE wiemy
Trzy pytania, które trzeba sprawdzić, zanim ktoś w to uwierzy.`;

export async function printy() {
    await upewnijKatalogi();
    const dir = path.join(WYMIAR(), 'printy');
    const pliki = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse();
    const lista = [];
    for (const f of pliki) lista.push(await czytajJson(path.join(dir, f), null));
    return lista.filter(Boolean).map(({ tresc, ...meta }) => ({ ...meta, znakow: (tresc || '').length }));
}

export async function print(id) {
    if (!/^[\w-]+$/.test(id)) throw new Error('Złe id.');
    const p = await czytajJson(path.join(WYMIAR(), 'printy', `${id}.json`), null);
    if (!p) throw new Error(`Nie ma printu ${id}.`);
    return p;
}

export async function syntezujPrint({ problem, iskra, model }) {
    if (!problem?.trim() || !iskra?.trim()) throw new Error('Potrzebuję problemu i iskry.');
    await upewnijKatalogi();
    const t0 = Date.now();
    const w = await pisz({
        system: SYSTEM_PRINTU,
        prompt: `PROBLEM: ${problem.trim()}\n\nISKRA (pomysł Suwerena): ${iskra.trim()}\n\nNapisz TeOPrint.`,
        model,
    });
    if (!w.tekst) throw new Error('Model oddał pustą treść.');
    const nazwa = w.tekst.match(/\*\*Nazwa Projektu:\*\*\s*(.+)/)?.[1]?.trim().slice(0, 80) || problem.trim().slice(0, 60);
    const rekord = {
        id: `${Date.now()}-${id8()}`, nazwa, problem: problem.trim(), iskra: iskra.trim(),
        model: w.model, tokeny: w.tokeny, sekundy: Math.round((Date.now() - t0) / 1000), data: teraz(),
        silnik: `${w.model} (lokalnie, Ollama)`, tresc: `${w.tekst}\n\n---\n*Silnik: ${w.model} · lokalnie · TeO Lab · ${teraz()}*`,
    };
    await zapiszJson(path.join(WYMIAR(), 'printy', `${rekord.id}.json`), rekord);
    await fs.writeFile(path.join(WYMIAR(), 'printy', `${rekord.id}.md`), rekord.tresc, 'utf8');
    zdarzenie('print', `TeOPrint „${nazwa}" (${w.model}, ${rekord.sekundy} s)`);
    return rekord;
}

export async function usunPrint(id) {
    if (!/^[\w-]+$/.test(id)) throw new Error('Złe id.');
    for (const ext of ['json', 'md']) await fs.rm(path.join(WYMIAR(), 'printy', `${id}.${ext}`), { force: true });
    return { id };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PIASKOWNICA — worktree apki + eksperymenty + zlecenia
// ─────────────────────────────────────────────────────────────────────────────

const PLIK_ZLECEN = () => path.join(WYMIAR(), 'zlecenia.json');
const PLIK_EKSPERYMENTOW = () => path.join(WYMIAR(), 'eksperymenty.json');

async function git(cwd, args, opts = {}) {
    const { stdout } = await run('git', args, { cwd, maxBuffer: 32 * 1024 * 1024, windowsHide: true, ...opts });
    return stdout;
}

export function apki() {
    return Object.entries(APKI).map(([id, a]) => {
        let dir = null;
        try { dir = katalogApki(id); } catch { /* brak repo */ }
        const piaskownica = path.join(PIASKOWNICA(), id);
        return { id, nazwa: a.nazwa, dir, jest: !!dir, piaskownica: fsSync.existsSync(path.join(piaskownica, '.git')) ? piaskownica : null };
    });
}

/** Worktree apki w `_OtakOs_Piaskownica/<id>` — tworzony raz, potem resetowany do HEAD apki. */
async function upewnijPiaskownice(idApki) {
    const dirApki = katalogApki(idApki);
    const dir = path.join(PIASKOWNICA(), idApki);
    await fs.mkdir(PIASKOWNICA(), { recursive: true });
    const head = (await git(dirApki, ['rev-parse', 'HEAD'])).trim();
    if (!fsSync.existsSync(path.join(dir, '.git'))) {
        // Uprzątnięcie wpisu po skasowanym ręcznie katalogu, żeby `add` nie odmówił.
        await git(dirApki, ['worktree', 'prune']).catch(() => {});
        await git(dirApki, ['worktree', 'add', '--detach', dir, head]);
    } else {
        await git(dir, ['checkout', '--detach', head]);
        await git(dir, ['reset', '--hard']);
        await git(dir, ['clean', '-fdq']);
    }
    // node_modules jako junction — weryfikacja TS bez kopiowania gigabajtów.
    const nm = path.join(dirApki, 'node_modules');
    const nmP = path.join(dir, 'node_modules');
    if (fsSync.existsSync(nm) && !fsSync.existsSync(nmP)) {
        try { await fs.symlink(nm, nmP, 'junction'); } catch { /* bez node_modules weryfikacja będzie „pominięta" */ }
    }
    return { dir, dirApki, head };
}

export async function zlecenia() { return czytajJson(PLIK_ZLECEN(), []); }

export async function dodajZlecenie({ apka, plik, cel }) {
    if (!APKI[apka]) throw new Error(`Nie znam apki „${apka}".`);
    if (!plik?.trim() || !cel?.trim()) throw new Error('Zlecenie potrzebuje pliku i celu.');
    const dirApki = katalogApki(apka);
    const rel = plik.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
    const abs = path.resolve(dirApki, rel);
    if (!abs.startsWith(dirApki) || !fsSync.existsSync(abs)) throw new Error(`Pliku ${rel} nie ma w ${APKI[apka].nazwa}.`);
    const lista = await zlecenia();
    const z = { id: `${Date.now()}-${id8()}`, apka, plik: rel, cel: cel.trim(), dodano: teraz(), stan: 'otwarte', eksperymentId: null };
    lista.push(z);
    await zapiszJson(PLIK_ZLECEN(), lista);
    return z;
}

export async function usunZlecenie(id) {
    const lista = await zlecenia();
    await zapiszJson(PLIK_ZLECEN(), lista.filter((z) => z.id !== id));
    return { id };
}

export async function eksperymenty() {
    const l = await czytajJson(PLIK_EKSPERYMENTOW(), []);
    return l.map(({ diff, ...e }) => ({ ...e, diffZnakow: (diff || '').length }));
}

export async function eksperymentPelny(id) {
    const l = await czytajJson(PLIK_EKSPERYMENTOW(), []);
    const e = l.find((x) => x.id === id);
    if (!e) throw new Error(`Nie ma eksperymentu ${id}.`);
    return e;
}

async function zapiszEksperyment(e) {
    const l = await czytajJson(PLIK_EKSPERYMENTOW(), []);
    const i = l.findIndex((x) => x.id === e.id);
    if (i >= 0) l[i] = e; else l.unshift(e);
    await zapiszJson(PLIK_EKSPERYMENTOW(), l.slice(0, 200));
}

const MARKERY_URYWKA = /(\.\.\.\s*$|reszta kodu|pozostał[ay] kod|existing code|rest of (the )?code|unchanged|bez zmian|\/\/\s*reszta|truncated|\/\/\s*\.\.\.)/im;

function wytnijKod(tekst) {
    const m = tekst.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
    return (m ? m[1] : tekst).replace(/\r\n/g, '\n');
}

async function weryfikuj(dir, rel) {
    const ext = path.extname(rel).toLowerCase();
    const t0 = Date.now();
    const wynik = (ok, log, sposob) => ({ ok, sposob, log: String(log || '').slice(-4000), sekundy: Math.round((Date.now() - t0) / 1000) });
    try {
        if (['.js', '.mjs', '.cjs'].includes(ext)) {
            await run(process.execPath, ['--check', path.join(dir, rel)], { cwd: dir, windowsHide: true });
            return wynik(true, 'node --check: OK', 'node --check');
        }
        if (['.ts', '.tsx'].includes(ext)) {
            if (!fsSync.existsSync(path.join(dir, 'node_modules'))) return wynik(null, 'brak node_modules w piaskownicy — tsc nie ma na czym stanąć', 'pominięta');
            const tsc = path.join(dir, 'node_modules', 'typescript', 'bin', 'tsc');
            if (!fsSync.existsSync(tsc)) return wynik(null, 'apka nie ma typescript w node_modules', 'pominięta');
            const proj = fsSync.existsSync(path.join(dir, 'tsconfig.app.json')) ? 'tsconfig.app.json' : 'tsconfig.json';
            await run(process.execPath, [tsc, '--noEmit', '-p', proj], { cwd: dir, windowsHide: true, timeout: 4 * 60_000, maxBuffer: 16 * 1024 * 1024 });
            return wynik(true, `tsc --noEmit -p ${proj}: OK`, 'tsc');
        }
        return wynik(null, `nie umiem zweryfikować ${ext || 'pliku bez rozszerzenia'}`, 'pominięta');
    } catch (e) {
        return wynik(false, `${e.stdout || ''}\n${e.stderr || ''}\n${e.message}`, ext === '.ts' || ext === '.tsx' ? 'tsc' : 'node --check');
    }
}

const SYSTEM_ROBOTA = `Jesteś Robotem Nocnej Zmiany w TeO Lab (Katedra OtakOS). Dostajesz JEDEN plik i JEDEN cel. Zwracasz CAŁY plik po zmianie w jednym bloku \`\`\` — od pierwszej do ostatniej linii, bez skrótów, bez „reszta bez zmian", bez komentarza poza blokiem. Zmieniasz tylko to, czego wymaga cel. Zachowujesz styl, język komentarzy (polski) i gęstość komentarzy pliku. Nie dodajesz zależności. Jeśli cel jest niewykonalny w tym pliku — zwróć plik BEZ ZMIAN i po bloku jedno zdanie: DLACZEGO NIE.`;

/**
 * Jeden eksperyment: apka + plik + cel → commit na gałęzi lab/<id> w piaskownicy.
 * Zwraca rekord z diffem i weryfikacją; NIC nie dotyka prawdziwego drzewa apki.
 */
export async function eksperyment({ apka, plik, cel, model, zlecenieId = null }) {
    if (!APKI[apka]) throw new Error(`Nie znam apki „${apka}".`);
    if (!plik?.trim() || !cel?.trim()) throw new Error('Eksperyment potrzebuje pliku i celu.');
    const t0 = Date.now();
    const id = `${Date.now()}-${id8()}`;
    const rel = plik.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
    const rekord = { id, apka, nazwaApki: APKI[apka].nazwa, plik: rel, cel: cel.trim(), zlecenieId, model: model || modelKodu?.() || modelDomyslny, start: teraz(), stan: 'liczy', etap: 'piaskownica' };
    await zapiszEksperyment(rekord);
    zdarzenie('eksperyment', `Nocna Zmiana: ${APKI[apka].nazwa} · ${rel} · ${cel.trim().slice(0, 80)}`);

    const koniec = async (zmiany) => {
        Object.assign(rekord, zmiany, { sekundy: Math.round((Date.now() - t0) / 1000), koniec: teraz() });
        await zapiszEksperyment(rekord);
        if (zlecenieId) {
            const l = await zlecenia();
            const z = l.find((x) => x.id === zlecenieId);
            if (z) { z.stan = rekord.stan === 'do-decyzji' ? 'zrobione' : 'padlo'; z.eksperymentId = id; await zapiszJson(PLIK_ZLECEN(), l); }
        }
        return rekord;
    };

    let dir, head;
    try {
        ({ dir, head } = await upewnijPiaskownice(apka));
        rekord.piaskownica = dir; rekord.bazaHead = head;
    } catch (e) { return koniec({ stan: 'padl', blad: `piaskownica: ${e.message}` }); }

    const abs = path.resolve(dir, rel);
    if (!abs.startsWith(dir) || !fsSync.existsSync(abs)) return koniec({ stan: 'padl', blad: `pliku ${rel} nie ma w piaskownicy` });
    const przed = await fs.readFile(abs, 'utf8');
    if (przed.length > 120_000) return koniec({ stan: 'padl', blad: `plik ma ${przed.length} znaków — za duży na jeden oddech modelu (limit 120 000)` });

    rekord.etap = 'model';
    await zapiszEksperyment(rekord);
    let odp;
    try {
        odp = await pisz({
            system: SYSTEM_ROBOTA,
            prompt: `APKA: ${APKI[apka].nazwa}\nPLIK: ${rel}\nCEL: ${cel.trim()}\n\nTREŚĆ PLIKU:\n\`\`\`\n${przed}\n\`\`\`\n\nZwróć cały plik po zmianie.`,
            model: rekord.model, timeoutMs: 20 * 60_000,
        });
    } catch (e) { return koniec({ stan: 'padl', blad: `model: ${e.message}` }); }
    rekord.tokeny = odp.tokeny;

    const po = wytnijKod(odp.tekst);
    const uwagaModelu = odp.tekst.match(/DLACZEGO NIE[:\s]*(.+)/i)?.[1]?.trim() || null;
    if (!po.trim()) return koniec({ stan: 'padl', blad: 'model oddał pustą treść' });
    if (po.trim() === przed.replace(/\r\n/g, '\n').trim()) return koniec({ stan: 'bez-zmian', uwagaModelu, blad: uwagaModelu ? `model odmówił: ${uwagaModelu}` : 'model zwrócił plik bez zmian' });
    if (po.length < przed.length * 0.5 || MARKERY_URYWKA.test(po)) return koniec({ stan: 'padl', blad: `wygląda na urywek (${po.length} vs ${przed.length} znaków) — odmowa, żeby nie okaleczyć pliku` });

    // 🛡️ Tarcza Prawdy — te same filary, co dla łatek Mechanika.
    const tarcza = AlignmentShield.getInstance().inspect(po, { existingContent: przed, targetFile: rel });
    rekord.tarcza = { score: tarcza.score, grade: tarcza.grade, blocked: tarcza.blocked, summary: tarcza.summary, findings: (tarcza.findings || []).slice(0, 8) };
    if (tarcza.blocked) return koniec({ stan: 'zablokowany', blad: `Tarcza Prawdy: ${tarcza.summary}` });

    rekord.etap = 'weryfikacja';
    await zapiszEksperyment(rekord);
    await fs.writeFile(abs, przed.includes('\r\n') ? po.replace(/\n/g, '\r\n') : po, 'utf8');
    const w = await weryfikuj(dir, rel);
    rekord.weryfikacja = w;

    try {
        await git(dir, ['add', '--', rel]);
        await git(dir, ['-c', 'user.name=Nocna Zmiana', '-c', 'user.email=lab@otakos.local', 'commit', '-q', '-m', `lab: ${cel.trim().slice(0, 72)}\n\nEksperyment ${id} · ${rekord.model} · weryfikacja: ${w.ok === true ? 'OK' : w.ok === false ? 'PADŁA' : 'pominięta'}`]);
        const sha = (await git(dir, ['rev-parse', 'HEAD'])).trim();
        await git(dir, ['branch', '-f', `lab/${id}`, sha]);
        rekord.sha = sha;
        rekord.diff = (await git(dir, ['show', '--stat', '-p', '--no-color', sha])).slice(0, 80_000);
        const stat = await git(dir, ['diff', '--shortstat', `${sha}~1`, sha]);
        rekord.statystyka = stat.trim();
        await git(dir, ['checkout', '--detach', head]);
    } catch (e) { return koniec({ stan: 'padl', blad: `git w piaskownicy: ${e.stderr || e.message}` }); }

    zdarzenie('eksperyment', `Nocna Zmiana skończyła ${rel}: weryfikacja ${w.ok === true ? 'OK' : w.ok === false ? 'PADŁA' : 'pominięta'} — czeka na decyzję Suwerena`);
    return koniec({ stan: 'do-decyzji', etap: 'decyzja', uwagaModelu });
}

/** Zatwierdzenie: cherry-pick -n do PRAWDZIWEGO drzewa apki. Commit robi Suweren. */
export async function zatwierdz(id) {
    const e = await eksperymentPelny(id);
    if (e.stan !== 'do-decyzji') throw new Error(`Eksperyment jest w stanie „${e.stan}" — zatwierdzić można tylko „do-decyzji".`);
    const dirApki = katalogApki(e.apka);
    try {
        await git(dirApki, ['cherry-pick', '-n', e.sha]);
    } catch (err) {
        await git(dirApki, ['cherry-pick', '--abort']).catch(() => {});
        await git(dirApki, ['reset', '-q', '--', e.plik]).catch(() => {});
        throw new Error(`cherry-pick odmówił (konflikt z Twoją niezacommitowaną pracą albo plik się zmienił od ${e.bazaHead?.slice(0, 7)}): ${(err.stderr || err.message).slice(0, 400)}`);
    }
    e.stan = 'wprowadzony'; e.decyzja = teraz();
    e.uwaga = `Zmiana leży w drzewie roboczym ${dirApki} (staged). Commit robisz sam — Lab nie commituje w Twoim repo.`;
    await zapiszEksperyment(e);
    zdarzenie('decyzja', `Suweren wprowadził eksperyment ${id} do ${e.nazwaApki}`);
    return e;
}

export async function odrzuc(id, powod = '') {
    const e = await eksperymentPelny(id);
    if (e.sha) {
        try { await git(katalogApki(e.apka), ['branch', '-D', `lab/${id}`]); } catch { /* gałęzi mogło nie być */ }
    }
    e.stan = 'odrzucony'; e.decyzja = teraz(); e.powodOdrzucenia = powod || null;
    await zapiszEksperyment(e);
    zdarzenie('decyzja', `Suweren odrzucił eksperyment ${id}${powod ? `: ${powod}` : ''}`);
    return e;
}

/** Dla robota Nocnej Zmiany: pierwsze otwarte zlecenie → eksperyment. */
export async function nastepneZlecenie({ model } = {}) {
    const l = await zlecenia();
    const z = l.find((x) => x.stan === 'otwarte');
    if (!z) return { nic: true, message: 'Brak otwartych zleceń — Nocna Zmiana nie ma czego labować.' };
    z.stan = 'w-toku'; await zapiszJson(PLIK_ZLECEN(), l);
    return eksperyment({ apka: z.apka, plik: z.plik, cel: z.cel, model, zlecenieId: z.id });
}

/** Lista plików apki (do wyboru w zleceniu) — tylko źródła, bez node_modules/dist. */
export async function plikiApki(idApki, filtr = '') {
    const dirApki = katalogApki(idApki);
    const out = await git(dirApki, ['ls-files', '--', '*.ts', '*.tsx', '*.js', '*.mjs', '*.css', '*.md', '*.json']);
    const f = filtr.toLowerCase();
    return out.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('node_modules/') && !s.startsWith('dist/') && !s.startsWith('public/apps/') && (!f || s.toLowerCase().includes(f))).slice(0, 400);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ARENA — TeOgochi labują razem
// ─────────────────────────────────────────────────────────────────────────────

const areny = new Map(); // id → rekord w pamięci (plik jest zwierciadłem)

export async function stado() {
    const s = await MostStada.stanDlaApki([]);
    return { migawka: s.migawka, powod: s.powod || null, gatunki: (s.gatunki || []).map(({ id, imie, dziedzina, kolor, forma, etap, xp }) => ({ id, imie, dziedzina, kolor, forma, etap, xp })) };
}

export async function areny_lista() {
    await upewnijKatalogi();
    const dir = path.join(WYMIAR(), 'arena');
    const pliki = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 50);
    const l = [];
    for (const f of pliki) { const a = await czytajJson(path.join(dir, f), null); if (a) l.push({ ...a, transkrypt: undefined, wypowiedzi: (a.transkrypt || []).length }); }
    return l;
}

export async function arena(id) {
    if (areny.has(id)) return areny.get(id);
    const a = await czytajJson(path.join(WYMIAR(), 'arena', `${id}.json`), null);
    if (!a) throw new Error(`Nie ma areny ${id}.`);
    return a;
}

export async function zacznijArene({ uczestnicy, temat, rundy = 3, model }) {
    if (!Array.isArray(uczestnicy) || uczestnicy.length < 2) throw new Error('Arena potrzebuje co najmniej dwóch TeOgochi.');
    if (!temat?.trim()) throw new Error('Arena potrzebuje tematu.');
    const s = await stado();
    const osoby = uczestnicy.map((u) => s.gatunki.find((g) => g.id === u)).filter(Boolean);
    if (osoby.length < 2) throw new Error(`W stadzie widzę tylko: ${s.gatunki.map((g) => g.id).join(', ') || 'nikogo (Katedra nie opublikowała migawki)'}.`);
    await upewnijKatalogi();
    const id = `${Date.now()}-${id8()}`;
    const rek = { id, temat: temat.trim(), rundy: Math.max(1, Math.min(8, Number(rundy) || 3)), model: model || modelDomyslny, uczestnicy: osoby, start: teraz(), stan: 'trwa', runda: 0, transkrypt: [], wnioski: null, blad: null };
    areny.set(id, rek);
    const plik = path.join(WYMIAR(), 'arena', `${id}.json`);
    await zapiszJson(plik, rek);
    zdarzenie('arena', `Arena: ${osoby.map((o) => o.imie).join(', ')} labują „${rek.temat}"`);

    (async () => {
        try {
            for (let r = 1; r <= rek.rundy; r++) {
                rek.runda = r;
                for (const o of osoby) {
                    const ostatnie = rek.transkrypt.slice(-12).map((w) => `${w.imie} (${w.dziedzina}): ${w.tekst}`).join('\n');
                    const w = await pisz({
                        system: `Jesteś ${o.imie} — TeOgochi Katedry OtakOS, dziedzina: ${o.dziedzina}, etap: ${o.etap}. Mówisz po polsku, w pierwszej osobie, 2–4 zdania, TYLKO z perspektywy swojej dziedziny. Odnosisz się do tego, co powiedzieli inni. Bez powtarzania tematu, bez grzeczności na wstępie. Jeśli nie masz nic nowego — powiedz jedno zdanie i oddaj głos.`,
                        prompt: `TEMAT ARENY: ${rek.temat}\nRUNDA ${r}/${rek.rundy}\n\nDOTĄD:\n${ostatnie || '(cisza — zaczynasz)'}\n\nTwoja wypowiedź:`,
                        model: rek.model, timeoutMs: 180_000,
                    });
                    rek.transkrypt.push({ runda: r, id: o.id, imie: o.imie, dziedzina: o.dziedzina, kolor: o.kolor, forma: o.forma, tekst: w.tekst.slice(0, 1200), kiedy: teraz() });
                    await zapiszJson(plik, rek);
                }
            }
            const w = await pisz({
                system: 'Jesteś Kronikarzem TeO Lab. Z transkryptu areny wyciągasz WNIOSKI: 3–5 punktów, każdy z imieniem, kto to wniósł. Po polsku, Markdown, bez wstępu.',
                prompt: `TEMAT: ${rek.temat}\n\n${rek.transkrypt.map((t) => `[${t.runda}] ${t.imie} (${t.dziedzina}): ${t.tekst}`).join('\n')}\n\nWnioski:`,
                model: rek.model, timeoutMs: 180_000,
            });
            rek.wnioski = w.tekst; rek.stan = 'gotowa';
        } catch (e) {
            rek.stan = 'padla'; rek.blad = e.message;
        }
        rek.koniec = teraz();
        await zapiszJson(plik, rek);
        zdarzenie('arena', `Arena „${rek.temat}" ${rek.stan === 'gotowa' ? 'skończona — wnioski gotowe' : `padła: ${rek.blad}`}`);
        setTimeout(() => areny.delete(id), 10 * 60_000);
    })();

    return rek;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CHIPY — projekt układu pod model AI
// ─────────────────────────────────────────────────────────────────────────────

/** Stałe do szacunków. HBM3: ~819 GB/s i 24 GB na stos (JEDEC, typowe konfiguracje 2024). */
const HBM = { gbsNaStos: 819, gbNaStos: 24 };

/**
 * Jawne wzory (dekodowanie autoregresyjne, jeden strumień):
 *   wagi        = parametry × bity / 8
 *   KV/token    = 2 × warstwy × d_model × bajtyKV     (MHA — górna granica; GQA dzieli przez grupy)
 *   FLOPs/token ≈ 2 × parametry
 *   pasmo       ≈ (wagi + KV_cache) × tok/s           (dekodowanie czyta wszystkie wagi na token)
 */
export function policzChip(spec) {
    const p = Math.max(0.01, Number(spec.parametryMld) || 7);
    const bity = [4, 8, 16].includes(Number(spec.bity)) ? Number(spec.bity) : 8;
    const warstwy = Math.max(1, Number(spec.warstwy) || 32);
    const dModel = Math.max(64, Number(spec.dModel) || 4096);
    const kontekst = Math.max(128, Number(spec.kontekst) || 8192);
    const kvBity = [8, 16].includes(Number(spec.kvBity)) ? Number(spec.kvBity) : 16;
    const grupyGqa = Math.max(1, Number(spec.grupyGqa) || 1);
    const tokS = Math.max(1, Number(spec.tokS) || 50);
    const strumienie = Math.max(1, Number(spec.strumienie) || 1);

    const wagiGB = (p * 1e9 * bity) / 8 / 1e9;
    const kvNaTokenB = (2 * warstwy * dModel * (kvBity / 8)) / grupyGqa;
    const kvGB = (kvNaTokenB * kontekst) / 1e9;
    const pamiecGB = wagiGB + kvGB * strumienie;
    const tflopsNaStrumien = (2 * p * 1e9 * tokS) / 1e12;
    const tflops = tflopsNaStrumien * strumienie;
    const pasmoGBs = (wagiGB + kvGB) * tokS * strumienie;
    const stosyHbm = Math.max(1, Math.ceil(pasmoGBs / HBM.gbsNaStos), Math.ceil(pamiecGB / HBM.gbNaStos));
    return {
        wejscie: { parametryMld: p, bity, warstwy, dModel, kontekst, kvBity, grupyGqa, tokS, strumienie },
        wagiGB: +wagiGB.toFixed(2), kvNaTokenKB: +(kvNaTokenB / 1024).toFixed(1), kvGB: +kvGB.toFixed(2), pamiecGB: +pamiecGB.toFixed(2),
        tflops: +tflops.toFixed(1), pasmoGBs: +pasmoGBs.toFixed(0), stosyHbm, hbm: HBM,
        uwaga: 'Szacunki z jawnych wzorów dla dekodowania (pamięciożerne). Prefill i batchowanie zmieniają proporcje; to punkt wyjścia do projektu, nie wynik symulacji.',
    };
}

function skryptBpyChipu({ nazwa, liczby }) {
    const n = liczby.stosyHbm;
    const die = Math.min(40, 12 + Math.cbrt(liczby.tflops) * 2); // mm umowne: rośnie z mocą, żeby układ był czytelny
    return `# TeO Lab — rozkład bloków układu „${nazwa}" (bpy, rdzeń Blendera, bez dodatków)
# Wygenerowano ${teraz()} z liczb: ${liczby.wagiGB} GB wag, ${liczby.pasmoGBs} GB/s, ${n} stosów HBM.
import bpy, math, os, sys

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

def blok(nazwa, x, y, z, sx, sy, sz, kolor):
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z + sz / 2))
    o = bpy.context.active_object
    o.name = nazwa
    o.scale = (sx / 2, sy / 2, sz / 2)
    m = bpy.data.materials.new(nazwa + "_mat")
    m.diffuse_color = (*kolor, 1.0)
    o.data.materials.append(m)
    return o

# Interposer (podstawa), die obliczeniowy pośrodku, stosy HBM po bokach.
szer = ${(die + 2 * 14).toFixed(1)}; gl = ${(Math.max(die, Math.ceil(n / 2) * 12 + 4)).toFixed(1)}
blok("Interposer", 0, 0, 0, szer, gl, 1.2, (0.10, 0.12, 0.16))
blok("Die_obliczeniowy", 0, 0, 1.2, ${die.toFixed(1)}, ${die.toFixed(1)}, 0.8, (0.20, 0.55, 0.85))
n = ${n}
for i in range(n):
    strona = -1 if i % 2 == 0 else 1
    rzad = i // 2
    y = (rzad - (math.ceil(n / 2) - 1) / 2) * 12
    blok(f"HBM_{i+1}", strona * (${die.toFixed(1)} / 2 + 8), y, 1.2, 10, 10, 2.4, (0.95, 0.65, 0.15))

# Kamera i światło — ujęcie izometryczne z góry. Kamera PATRZY na środek
# układu przez TRACK_TO (pierwsza wersja miała obrót „na oko" i renderowała
# pusty róg sceny); odległość rośnie z rozmiarem interposera.
bpy.ops.object.light_add(type='SUN', location=(30, -30, 60))
bpy.context.active_object.data.energy = 3
bpy.ops.object.empty_add(location=(0, 0, 1.5))
cel = bpy.context.active_object
r = max(szer, gl) * 1.35
bpy.ops.object.camera_add(location=(r * 0.75, -r * 0.9, r * 0.7))
cam = bpy.context.active_object
tr = cam.constraints.new(type='TRACK_TO'); tr.target = cel; tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'
bpy.context.scene.camera = cam
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x = 1280; sc.render.resolution_y = 704
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'

katalog = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("--python") + 1]))
png = os.path.join(katalog, "${nazwa}.png")
sc.render.filepath = png
bpy.ops.render.render(write_still=True)
blend = os.path.join(katalog, "${nazwa}.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)
print("UJECIE: " + png)
print("ZAPISANO: " + blend)
`;
}

export async function chipy() {
    await upewnijKatalogi();
    const dir = path.join(WYMIAR(), 'chipy');
    // ⚠️ Bez `analiza-*.json` — to wyniki analizy plików, nie projekty. Pierwsza wersja
    // brała wszystko i pierwsza analiza Suwerena wywracała listę projektów (brak `liczby`).
    const pliki = (await fs.readdir(dir)).filter((f) => f.endsWith('.json') && !f.startsWith('analiza-')).sort().reverse();
    const l = [];
    for (const f of pliki) { const c = await czytajJson(path.join(dir, f), null); if (c?.liczby) l.push({ ...c, nota: undefined, notaZnakow: (c.nota || '').length }); }
    return l;
}

export async function chip(id) {
    if (!/^[\w-]+$/.test(id)) throw new Error('Złe id.');
    const c = await czytajJson(path.join(WYMIAR(), 'chipy', `${id}.json`), null);
    if (!c) throw new Error(`Nie ma projektu ${id}.`);
    return c;
}

export async function projektujChip({ nazwa, spec, model, bezNoty = false }) {
    await upewnijKatalogi();
    const liczby = policzChip(spec || {});
    const id = `${Date.now()}-${id8()}`;
    const bezpiecznaNazwa = (nazwa || 'chip').replace(/[^\w-]+/g, '_').slice(0, 40) || 'chip';
    const rek = { id, nazwa: nazwa?.trim() || `Układ ${liczby.wejscie.parametryMld}B`, spec: liczby.wejscie, liczby, data: teraz(), model: null, nota: null, skrypt: null, render: null, blend: null };

    if (!bezNoty) {
        const w = await pisz({
            system: 'Jesteś Architektem Krzemu w TeO Lab. Piszesz NOTĘ PROJEKTOWĄ układu pod konkretny model AI: po polsku, Markdown, 5 sekcji: Cel · Pamięć i pasmo (odnieś się do podanych liczb) · Blok obliczeniowy (co liczy, jaka precyzja) · Termika i zasilanie (rzędy wielkości, z zastrzeżeniem że to szacunek) · Czego nie wiemy. Nie wymyślaj liczb, których nie dostałeś — rachuj z podanych.',
            prompt: `MODEL: ${JSON.stringify(liczby.wejscie)}\nWYLICZENIA: wagi ${liczby.wagiGB} GB, KV/token ${liczby.kvNaTokenKB} KB, KV cache ${liczby.kvGB} GB, pamięć razem ${liczby.pamiecGB} GB, ${liczby.tflops} TFLOPS, pasmo ${liczby.pasmoGBs} GB/s, ${liczby.stosyHbm} stosów HBM3 (${HBM.gbsNaStos} GB/s, ${HBM.gbNaStos} GB każdy).\n\nNota projektowa:`,
            model,
        });
        rek.model = w.model; rek.nota = w.tekst;
    }

    const skrypt = skryptBpyChipu({ nazwa: `${bezpiecznaNazwa}_${id}`, liczby });
    const plikPy = path.join(WYMIAR(), 'chipy', `${id}.py`);
    await fs.writeFile(plikPy, skrypt, 'utf8');
    rek.skrypt = plikPy;
    await zapiszJson(path.join(WYMIAR(), 'chipy', `${id}.json`), rek);
    zdarzenie('chip', `Projekt układu „${rek.nazwa}": ${liczby.pamiecGB} GB, ${liczby.pasmoGBs} GB/s, ${liczby.stosyHbm}× HBM`);
    return rek;
}

/** Render rozkładu bloków — TYLKO gdy Blender jest na maszynie; inaczej mówi, czego brak. */
export async function renderujChip(id) {
    const c = await chip(id);
    if (!c.skrypt || !fsSync.existsSync(c.skrypt)) throw new Error('Projekt nie ma skryptu bpy.');
    const w = await Blender.uruchom(c.skrypt);
    const dir = path.dirname(c.skrypt);
    const nazwa = path.basename(c.skrypt, '.py');
    const png = (w.log.match(/UJECIE:\s*(.+)/)?.[1] || '').trim();
    c.render = png && fsSync.existsSync(png) ? png : null;
    c.blend = w.scena; c.blenderWersja = w.wersja;
    // Pliki mają nazwę z bezpiecznej nazwy, nie z id — dopisujemy, gdzie leżą.
    if (!c.render) { const kandydat = path.join(dir, `${nazwa}.png`); if (fsSync.existsSync(kandydat)) c.render = kandydat; }
    await zapiszJson(path.join(WYMIAR(), 'chipy', `${id}.json`), c);
    return c;
}

export async function stanBlendera() { return Blender.stanBlendera(); }

/** Analiza własnego pliku (tekst ≤ 200 KB) modelem — pod kątem projektu układu. */
export async function analizujPlik({ nazwa, tresc, pytanie, model }) {
    if (!tresc?.trim()) throw new Error('Pusty plik.');
    if (tresc.length > 200_000) throw new Error(`Plik ma ${tresc.length} znaków — limit 200 000.`);
    const w = await pisz({
        system: 'Jesteś analitykiem TeO Lab (dział chipów pod modele AI). Dostajesz plik i pytanie. Odpowiadasz po polsku, Markdown: co to za plik (format, co opisuje) · liczby i parametry, które z niego wynikają · co to znaczy dla projektu układu (pamięć, pasmo, precyzja, równoległość) · czego w pliku brakuje. Nie zgaduj tego, czego nie ma.',
        prompt: `PLIK: ${nazwa}\nPYTANIE: ${pytanie?.trim() || 'Co z tego wynika dla projektu układu pod ten model?'}\n\nTREŚĆ:\n${tresc}\n\nAnaliza:`,
        model, timeoutMs: 600_000,
    });
    const rek = { id: `${Date.now()}-${id8()}`, nazwa, znakow: tresc.length, pytanie: pytanie?.trim() || null, model: w.model, analiza: w.tekst, data: teraz() };
    await upewnijKatalogi();
    await zapiszJson(path.join(WYMIAR(), 'chipy', `analiza-${rek.id}.json`), rek);
    return rek;
}

export async function analizy() {
    await upewnijKatalogi();
    const dir = path.join(WYMIAR(), 'chipy');
    const pliki = (await fs.readdir(dir)).filter((f) => f.startsWith('analiza-') && f.endsWith('.json')).sort().reverse().slice(0, 50);
    const l = [];
    for (const f of pliki) { const a = await czytajJson(path.join(dir, f), null); if (a) l.push(a); }
    return l;
}

export function stan() {
    return {
        wymiar: WYMIAR(), piaskownica: PIASKOWNICA(), model: modelDomyslny, modelKodu: modelKodu?.() || modelDomyslny,
        apki: apki(),
    };
}

export default {
    skonfiguruj, pisz, stan,
    printy, print, syntezujPrint, usunPrint,
    apki, plikiApki, zlecenia, dodajZlecenie, usunZlecenie, eksperymenty, eksperymentPelny, eksperyment, zatwierdz, odrzuc, nastepneZlecenie,
    stado, areny_lista, arena, zacznijArene,
    policzChip, chipy, chip, projektujChip, renderujChip, stanBlendera, analizujPlik, analizy,
};
