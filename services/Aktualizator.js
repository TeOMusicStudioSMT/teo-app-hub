/**
 * 🔄 Aktualizator Katedry — węzeł sam sprawdza, czy jest nowsza Katedra, i (po decyzji Suwerena węzła) się aktualizuje.
 *
 * Suweren (2026-10-02): „jak to ma ktoś zaktualizować… jak ma już noda… bo nazwa otakos.wtf jest w eterze".
 * Do tej pory nie było jak: paczkę z otakos.wtf trzeba było pobrać od nowa i ręcznie przenieść swoje dane.
 *
 * Dwa tryby (wykrywane same):
 *   • git     — węzeł jest klonem repo: prawdą jest `origin` (git fetch → ile commitów do przodu → git pull --ff-only).
 *               Niezapisane zmiany w plikach Katedry = STOP (nic nie nadpisujemy po cichu).
 *   • paczka  — węzeł z zipa z otakos.wtf: `wersja.json` strony (Miniaturyzator) vs `wersja.json` w Katedrze →
 *               pobranie zipa → SUMA SHA-256 MUSI się zgadzać → podmiana TYLKO kodu.
 *
 * Czego aktualizacja NIGDY nie rusza: `_OtakOs_*` (dzieła, stado, pamięć), `.env*`, sekrety, `identity.json`, modele,
 * `node_modules`, `.git`; istniejących skilli w `TeO_Skille` (nowe dochodzą). Niczego nie kasuje. Każdy nadpisany plik
 * najpierw ląduje w kopii (`_OtakOs_Wymiar/aktualizacje/kopia-…`), skąd `cofnij()` go przywraca.
 * Węzeł pyta stronę — strona nic o węźle nie wie (zero telemetrii).
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let cfg = {
    katalog: process.cwd(),
    robocze: path.join(process.cwd(), '_OtakOs_Wymiar', 'aktualizacje'),
    url: process.env.OTAKOS_AKTUALIZACJE_URL || 'https://otakos.wtf/wersja.json',
    fetch: (...a) => fetch(...a),
    /** (program, argumenty, opcje) → { stdout } — podmienialne w testach */
    uruchom: (program, argumenty, opcje = {}) => execFileAsync(program, argumenty, { windowsHide: true, maxBuffer: 32 * 1024 * 1024, ...opcje }),
    /** rozpakowanie zipa do katalogu (extract-zip; yauzl zamienia „\" ze starych paczek PowerShella na „/") */
    rozpakuj: async (zip, dokad) => { const { default: extract } = await import('extract-zip'); await extract(zip, { dir: dokad }); },
    npmInstall: async (katalog) => cfg.uruchom(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'],
        { cwd: katalog, timeout: 30 * 60_000, shell: process.platform === 'win32' }),
    szyna: null,
};
export function skonfiguruj(o) { cfg = { ...cfg, ...o }; }

// ─────────────────────────────────────────────────────────────────────────────
// Co jest chronione
// ─────────────────────────────────────────────────────────────────────────────

const SEKRET = /^(\.env(\.[\w.-]+)?|media_secrets\.json|identity\.json|\.anthropic_key\.env|[^/]*\.(key|pem|pfx|p12|keystore|jks))$/i;

/**
 * Ścieżka (względna, „/") z paczki → czy aktualizacja może ją zapisać.
 * @returns {'kod'|'tylko-nowy'|'chroniony'}
 */
export function rodzaj(rel) {
    const r = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
    const czesci = r.split('/');
    const nazwa = czesci.at(-1) ?? '';
    if (!r || czesci.includes('..') || path.isAbsolute(r)) return 'chroniony';
    if (/^_OtakOs_/i.test(czesci[0])) return 'chroniony';
    if (czesci.some((c) => ['node_modules', '.git', 'models', 'memory'].includes(c.toLowerCase()))) return 'chroniony';
    if (nazwa !== '.env.example' && SEKRET.test(nazwa)) return 'chroniony';
    if (czesci[0] === 'TeO_Skille') return 'tylko-nowy';   // skille Suwerena węzła mogą być poprawione — nie nadpisujemy
    return 'kod';
}

/** „2026.10.02.1430" > „2026.09.21.1019" — numer z Miniaturyzatora porównywany po cyfrach. */
export function nowszy(a, b) {
    const n = (x) => String(x ?? '').split(/\D+/).filter(Boolean).map(Number);
    const x = n(a), y = n(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
    }
    return false;
}

const czytajJson = async (p) => { try { return JSON.parse((await fs.readFile(p, 'utf8')).replace(/^﻿/, '')); } catch { return null; } };
const sha256Pliku = (p) => new Promise((ok, zle) => {
    const h = crypto.createHash('sha256');
    fsSync.createReadStream(p).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', zle);
});

export const tryb = () => (fsSync.existsSync(path.join(cfg.katalog, '.git')) ? 'git' : 'paczka');
const git = async (...a) => (await cfg.uruchom('git', a, { cwd: cfg.katalog, timeout: 5 * 60_000 })).stdout.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Sprawdzenie
// ─────────────────────────────────────────────────────────────────────────────

/** Wersja ze strony. otakos.wtf ma fallback SPA: brakujący plik udaje 200 z HTML-em — to błąd, nie „brak aktualizacji". */
async function wersjaZdalna() {
    let r;
    try { r = await cfg.fetch(cfg.url, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/json' } }); }
    catch (e) { throw new Error(`Nie połączyłem się z ${cfg.url} (${e.cause?.code ?? e.message}).`); }
    if (!r.ok) throw new Error(`${cfg.url}: HTTP ${r.status}.`);
    const tekst = await r.text();
    if (/^\s*</.test(tekst)) throw new Error(`${cfg.url} zwrócił stronę HTML zamiast wersja.json — strona nie ma jeszcze pliku wersji (wymaga wdrożenia z Miniaturyzatora).`);
    let d; try { d = JSON.parse(tekst.replace(/^﻿/, '')); } catch { throw new Error(`${cfg.url}: to nie jest poprawny JSON.`); }
    if (!d?.numer || !d?.paczka) throw new Error(`${cfg.url}: brak numeru wersji albo adresu paczki.`);
    return d;
}

/**
 * Czy jest nowsza Katedra.
 * @returns {Promise<{ tryb: 'git'|'paczka', lokalna: object|null, zdalna: object|null, nowsza: boolean, zmiany: {data?:string, tytul:string}[], uwaga?: string }>}
 */
export async function sprawdz() {
    const lokalna = await czytajJson(path.join(cfg.katalog, 'wersja.json'));
    if (tryb() === 'git') {
        const galaz = await git('rev-parse', '--abbrev-ref', 'HEAD');
        const commit = await git('rev-parse', '--short', 'HEAD');
        try { await git('fetch', '--quiet', 'origin'); }
        catch (e) { throw new Error(`git fetch nie wyszedł (${String(e.stderr || e.message).trim().split('\n').at(-1)}) — czy jest internet i dostęp do repo?`); }
        let upstream;
        try { upstream = await git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'); }
        catch { return { tryb: 'git', lokalna: { commit, galaz }, zdalna: null, nowsza: false, zmiany: [], uwaga: `Gałąź „${galaz}" nie śledzi żadnej gałęzi na origin — nie mam z czym porównać.` }; }
        const log = await git('log', '--format=%cs%x09%h%x09%s', `HEAD..${upstream}`);
        const zmiany = log ? log.split('\n').map((l) => { const [data, h, ...t] = l.split('\t'); return { data, ref: h, tytul: t.join('\t') }; }) : [];
        return { tryb: 'git', lokalna: { commit, galaz, numer: lokalna?.numer ?? null }, zdalna: { commit: await git('rev-parse', '--short', upstream), galaz: upstream }, nowsza: zmiany.length > 0, zmiany };
    }
    const zdalna = await wersjaZdalna();
    const nowsza = !lokalna?.numer || nowszy(zdalna.numer, lokalna.numer);
    const zmiany = (zdalna.zmiany ?? []).filter((z) => !lokalna?.data || !z.data || String(z.data) > String(lokalna.data).slice(0, 10));
    return { tryb: 'paczka', lokalna, zdalna, nowsza, zmiany, ...(lokalna?.numer ? {} : { uwaga: 'Ta Katedra nie ma pliku wersja.json (paczka sprzed Aktualizatora) — traktuję ją jako starszą.' }) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zastosowanie
// ─────────────────────────────────────────────────────────────────────────────

let biezace = null;   // { stan, etap, postep, blad, wynik }
export function stan() { return biezace ?? { stan: 'brak' }; }

async function nadaj(tresc, dane = {}) {
    await cfg.szyna?.nadaj?.({ agent: 'Aktualizator', rodzaj: 'aktualizacja', tresc, dane })?.catch?.(() => {});
}

/** Uruchamia aktualizację w tle; postęp — `stan()`. */
export async function zastosuj() {
    if (biezace?.stan === 'trwa') throw new Error('Aktualizacja już trwa.');
    const s = await sprawdz();
    if (!s.nowsza) throw new Error('Ta Katedra jest aktualna — nie ma czego podmieniać.');
    biezace = { stan: 'trwa', etap: 'start', postep: null, blad: null, wynik: null, od: new Date().toISOString() };
    const z = biezace;
    (async () => {
        try {
            z.wynik = s.tryb === 'git' ? await zGita(z) : await zPaczki(z, s);
            z.stan = 'gotowe'; z.etap = 'gotowe';
            await nadaj(`Katedra zaktualizowana (${z.wynik.opis}). Uruchom ją ponownie, żeby zmiany zadziałały.`, z.wynik);
        } catch (e) {
            z.stan = 'blad'; z.blad = String(e.message || e).slice(0, 600);
            await nadaj(`aktualizacja przerwana: ${z.blad}`);
        } finally { z.koniec = new Date().toISOString(); }
    })();
    return { uruchomiono: true, tryb: s.tryb };
}

async function zGita(z) {
    z.etap = 'sprawdzam zmiany w plikach';
    // Bez trim(): format porcelain zaczyna linię od statusu ze spacją („ M plik") — obcięcie zjadłoby literę nazwy.
    const brudne = (await cfg.uruchom('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: cfg.katalog, timeout: 60_000 })).stdout.split('\n').filter((l) => l.trim());
    if (brudne.length) {
        const lista = brudne.slice(0, 8).map((l) => l.slice(3)).join(', ');
        throw new Error(`Masz niezapisane zmiany w plikach Katedry (${lista}${brudne.length > 8 ? '…' : ''}). Zapisz je (git commit) albo odłóż (git stash) — nie nadpisuję Twojej pracy.`);
    }
    const przed = await git('rev-parse', 'HEAD');
    z.etap = 'git pull';
    try { await git('pull', '--ff-only'); }
    catch (e) { throw new Error(`git pull --ff-only nie przeszedł (${String(e.stderr || e.message).trim().split('\n').at(-1)}) — historia się rozjechała, to decyzja dla Suwerena.`); }
    const po = await git('rev-parse', 'HEAD');
    const pliki = (await git('diff', '--name-only', przed, po)).split('\n').filter(Boolean);
    let npm = false;
    if (pliki.some((f) => /^package(-lock)?\.json$/.test(f))) { z.etap = 'npm install'; await cfg.npmInstall(cfg.katalog); npm = true; }
    return { tryb: 'git', z: przed.slice(0, 7), na: po.slice(0, 7), plikow: pliki.length, npm, restart: true, opis: `git ${przed.slice(0, 7)} → ${po.slice(0, 7)}, ${pliki.length} plików${npm ? ', npm install' : ''}` };
}

async function* wszystkiePliki(dir, baza = dir) {
    for (const w of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, w.name);
        if (w.isDirectory()) yield* wszystkiePliki(p, baza);
        else if (w.isFile()) yield path.relative(baza, p).split(path.sep).join('/');
    }
}

async function zPaczki(z, s) {
    const { zdalna, lokalna } = s;
    if (!/^[0-9a-f]{64}$/i.test(String(zdalna.sha256 ?? ''))) throw new Error('Strona nie podaje sumy SHA-256 paczki — nie podmieniam kodu na ślepo.');
    const numer = String(zdalna.numer).replace(/[^\w.-]/g, '_');
    await fs.mkdir(cfg.robocze, { recursive: true });
    const zip = path.join(cfg.robocze, `${numer}.zip`);
    const url = new URL(zdalna.paczka, cfg.url).href;

    z.etap = 'pobieram paczkę';
    const r = await cfg.fetch(url, { signal: AbortSignal.timeout(60 * 60_000) });
    if (!r.ok || !r.body) throw new Error(`Pobranie ${url}: HTTP ${r.status}.`);
    const razem = Number(r.headers?.get?.('content-length') || zdalna.bajtow || 0);
    let mam = 0;
    const out = fsSync.createWriteStream(zip);
    try {
        for await (const kawalek of r.body) {
            mam += kawalek.length;
            z.postep = razem ? Math.round((mam / razem) * 100) : null;
            if (!out.write(kawalek)) await new Promise((ok) => out.once('drain', ok));
        }
    } finally { await new Promise((ok) => out.end(ok)); }

    z.etap = 'sprawdzam sumę SHA-256'; z.postep = null;
    const suma = await sha256Pliku(zip);
    if (suma.toLowerCase() !== String(zdalna.sha256).toLowerCase()) {
        await fs.rm(zip, { force: true });
        throw new Error(`Suma SHA-256 się nie zgadza (jest ${suma.slice(0, 12)}…, strona mówi ${String(zdalna.sha256).slice(0, 12)}…) — paczka uszkodzona albo podmieniona. Nic nie ruszyłem.`);
    }

    z.etap = 'rozpakowuję';
    const rozpak = path.join(cfg.robocze, numer);
    await fs.rm(rozpak, { recursive: true, force: true });
    await cfg.rozpakuj(zip, rozpak);
    let korzen = rozpak;
    const w = zdalna.katalogWPaczce && fsSync.existsSync(path.join(rozpak, zdalna.katalogWPaczce));
    if (w) korzen = path.join(rozpak, zdalna.katalogWPaczce);
    else {
        const wpisy = await fs.readdir(rozpak, { withFileTypes: true });
        if (wpisy.length === 1 && wpisy[0].isDirectory()) korzen = path.join(rozpak, wpisy[0].name);
    }
    if (!fsSync.existsSync(path.join(korzen, 'wiesio-bridge.js'))) throw new Error('W paczce nie ma wiesio-bridge.js — to nie wygląda na Katedrę. Nic nie ruszyłem.');

    z.etap = 'podmieniam kod';
    const kopia = path.join(cfg.robocze, `kopia-${String(lokalna?.numer ?? 'sprzed-' + numer).replace(/[^\w.-]/g, '_')}`);
    const licz = { nowe: 0, zmienione: 0, bezZmian: 0, chronione: 0 };
    const zapisane = [];
    for await (const rel of wszystkiePliki(korzen)) {
        const rodz = rodzaj(rel);
        const cel = path.join(cfg.katalog, ...rel.split('/'));
        if (rodz === 'chroniony') { licz.chronione++; continue; }
        const jest = fsSync.existsSync(cel);
        if (jest && rodz === 'tylko-nowy') { licz.chronione++; continue; }
        const zrodlo = path.join(korzen, ...rel.split('/'));
        if (jest) {
            const [a, b] = await Promise.all([fs.stat(zrodlo), fs.stat(cel)]);
            if (a.size === b.size && (await sha256Pliku(zrodlo)) === (await sha256Pliku(cel))) { licz.bezZmian++; continue; }
            const kop = path.join(kopia, ...rel.split('/'));
            await fs.mkdir(path.dirname(kop), { recursive: true });
            await fs.copyFile(cel, kop);
            licz.zmienione++;
        } else licz.nowe++;
        await fs.mkdir(path.dirname(cel), { recursive: true });
        await fs.copyFile(zrodlo, cel);
        zapisane.push({ rel, nowy: !jest });
    }
    // wersja.json w Katedrze = ta ze strony (z sumą i datą), żeby kolejne sprawdzenie porównywało się z właściwą.
    const plikWersji = path.join(cfg.katalog, 'wersja.json');
    if (!zapisane.some((p) => p.rel === 'wersja.json')) {
        const byla = fsSync.existsSync(plikWersji);
        if (byla) { await fs.mkdir(kopia, { recursive: true }); await fs.copyFile(plikWersji, path.join(kopia, 'wersja.json')); }
        zapisane.push({ rel: 'wersja.json', nowy: !byla });
    }
    await fs.writeFile(plikWersji, JSON.stringify(zdalna, null, 2));
    // Rejestr kopii — cofnij() wie, co przywrócić, a co (nowe pliki) zostawić albo usunąć.
    await fs.mkdir(kopia, { recursive: true });
    await fs.writeFile(path.join(kopia, '_aktualizacja.json'), JSON.stringify({ z: lokalna?.numer ?? null, na: zdalna.numer, kiedy: new Date().toISOString(), pliki: zapisane }, null, 2));

    let npm = false;
    if (zapisane.some((p) => /^package(-lock)?\.json$/.test(p.rel))) { z.etap = 'npm install'; await cfg.npmInstall(cfg.katalog); npm = true; }
    await fs.rm(rozpak, { recursive: true, force: true }).catch(() => {});
    return { tryb: 'paczka', z: lokalna?.numer ?? null, na: zdalna.numer, ...licz, kopia, npm, restart: true,
        opis: `${lokalna?.numer ?? 'bez wersji'} → ${zdalna.numer}: ${licz.nowe} nowych, ${licz.zmienione} zmienionych, ${licz.chronione} chronionych pominiętych${npm ? ', npm install' : ''}` };
}

/** Cofa OSTATNIĄ aktualizację z paczki: przywraca nadpisane pliki z kopii (nowe pliki zostają — nie szkodzą). */
export async function cofnij() {
    if (tryb() === 'git') throw new Error('Węzeł z gita cofasz gitem (git log / git checkout) — Aktualizator nie przepisuje historii.');
    if (biezace?.stan === 'trwa') throw new Error('Aktualizacja jeszcze trwa.');
    const kopie = (await fs.readdir(cfg.robocze).catch(() => [])).filter((n) => n.startsWith('kopia-'));
    const z = [];
    for (const n of kopie) { const r = await czytajJson(path.join(cfg.robocze, n, '_aktualizacja.json')); if (r && !r.cofnieta) z.push({ n, ...r }); }
    z.sort((a, b) => String(b.kiedy).localeCompare(String(a.kiedy)));
    const ost = z[0];
    if (!ost) throw new Error('Nie ma aktualizacji do cofnięcia.');
    const dir = path.join(cfg.robocze, ost.n);
    let przywrocone = 0;
    for (const p of ost.pliki.filter((x) => !x.nowy)) {
        await fs.copyFile(path.join(dir, ...p.rel.split('/')), path.join(cfg.katalog, ...p.rel.split('/')));
        przywrocone++;
    }
    // wersja.json: stara kopia przywrócona wyżej (jeśli była); gdy jej nie było — Katedra wraca do „bez wersji".
    const wpis = ost.pliki.find((x) => x.rel === 'wersja.json');
    if (!wpis || wpis.nowy) {
        if (ost.z) await fs.writeFile(path.join(cfg.katalog, 'wersja.json'), JSON.stringify({ numer: ost.z }, null, 2));
        else await fs.rm(path.join(cfg.katalog, 'wersja.json'), { force: true });
    }
    await fs.writeFile(path.join(dir, '_aktualizacja.json'), JSON.stringify({ ...ost, n: undefined, cofnieta: new Date().toISOString() }, null, 2));
    await nadaj(`cofnięto aktualizację ${ost.na} → ${ost.z ?? 'poprzednia'} (${przywrocone} plików). Uruchom Katedrę ponownie.`);
    return { przywrocone, na: ost.z, nowePozostaly: ost.pliki.filter((x) => x.nowy).length, restart: true };
}

export default { skonfiguruj, sprawdz, zastosuj, stan, cofnij, rodzaj, nowszy, tryb };
