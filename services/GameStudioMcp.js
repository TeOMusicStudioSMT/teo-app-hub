/**
 * 🎮 Game Studio dla agentów (MCP) — dwie trasy, których serwer MCP potrzebował, a most nie miał
 * (Suweren 2026-10-20: „własny MCP Game Studio na wzór unity-mcp”; serwer: scripts/mcp/game-studio.mjs).
 *
 *  1. TEST NA ŻĄDANIE — ten sam test, który Kodeks robi po buildzie (AppStudio.przetestujWPrzegladarce:
 *     puppeteer, canvas w #gra, WSAD + spacja, odczyt window.__gra po każdym ruchu, zrzut). Dotąd tylko
 *     w pętli Kodeksa; teraz agent może zobaczyć grę, zanim cokolwiek zmieni. Jeden test naraz (Chrome).
 *
 *  2. WALIDACJA PRZED ZAPISEM — odpowiednik Roslyn z unity-mcp: proponowane pliki (src/** albo index.html,
 *     jak granice Kodeksa) przechodzą przez Recenzenta Kodeksa (reguły; Jev tylko na jawne życzenie — koszt)
 *     i `tsc --noEmit` na KOPII projektu w katalogu tymczasowym (src + pliki z korzenia + junction node_modules).
 *     Gra Suwerena zostaje nietknięta — nic nie jest zapisywane w projekcie.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';

export const ID_PROJEKTU = /^[a-z0-9-]{2,48}$/;
export const ZRZUT = /^zrzut-\d+\.png$/;
export const MAX_PLIKOW = 20;
export const MAX_ZNAKOW = 400_000;

/**
 * Ścieżka pliku gry od agenta → względna z „/”, tylko src/** albo index.html (te same granice co Kodeks).
 * @returns {string} @throws gdy wychodzi poza projekt
 */
export function sciezkaPlikuGry(s) {
    const t = String(s ?? '').trim().replace(/\\/g, '/');
    if (!t || t.startsWith('/') || /^[a-z]:/i.test(t) || t.split('/').some((c) => c === '..' || c === '.' || c === '')) throw new Error(`Zła ścieżka „${s}” — podaj względną, np. src/main.ts.`);
    if (t !== 'index.html' && !t.startsWith('src/')) throw new Error(`„${t}” jest poza granicami gry — Kodeks i walidacja znają tylko src/** i index.html.`);
    return t;
}

/** Błędy tsc → [{plik, linia, kolumna, kod, tekst}] (format `plik(l,k): error TSxxxx: …`). */
export function bledyTsc(log) {
    const out = [];
    for (const l of String(log ?? '').split(/\r?\n/)) {
        const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(l.trim());
        if (m) out.push({ plik: m[1].replace(/\\/g, '/'), linia: Number(m[2]), kolumna: Number(m[3]), kod: m[4], tekst: m[5] });
    }
    return out;
}

const domyslneUruchom = (program, args, opcje) => new Promise((resolve) => {
    execFile(program, args, { ...opcje, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (e, stdout, stderr) => resolve({ kod: e ? (typeof e.code === 'number' ? e.code : 1) : 0, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), blad: e && typeof e.code !== 'number' ? e.message : null }));
});

async function kopiujSrc(z, do_) {
    await fs.mkdir(do_, { recursive: true });
    for (const w of await fs.readdir(z, { withFileTypes: true })) {
        const a = path.join(z, w.name), b = path.join(do_, w.name);
        if (w.isDirectory()) await kopiujSrc(a, b);
        else if (w.isFile() && (await fs.stat(a)).size <= 2 * 1024 * 1024) await fs.copyFile(a, b);
    }
}

/**
 * @param {{ katalogApek: string, appStudio: object, recenzent: object, jev?: object|null,
 *           nodeModulesGry?: string, uruchom?: Function, tmp?: string }} c
 */
export function utworzStudioMcp(c) {
    const cfg = { tmp: os.tmpdir(), uruchom: domyslneUruchom, jev: null, ...c };
    const dir = (id) => {
        if (!ID_PROJEKTU.test(String(id ?? ''))) throw new Error('Zły identyfikator projektu (a–z, 0–9, „-”).');
        const d = path.join(cfg.katalogApek, id);
        if (!fsSync.existsSync(path.join(d, 'projekt.json'))) throw new Error(`Nie ma projektu „${id}” w _OtakOs_Apki.`);
        return d;
    };

    async function tsc(d, pliki) {
        const nm = fsSync.existsSync(path.join(d, 'node_modules')) ? await fs.realpath(path.join(d, 'node_modules')) : cfg.nodeModulesGry;
        if (!nm || !fsSync.existsSync(path.join(nm, 'typescript', 'bin', 'tsc'))) return { ok: null, powod: 'brak typescript w node_modules projektu — tsc pominięty', bledy: [] };
        const t = await fs.mkdtemp(path.join(cfg.tmp, 'otakos-walidacja-'));
        const t0 = Date.now();
        try {
            for (const w of await fs.readdir(d, { withFileTypes: true })) {
                if (w.isFile() && (await fs.stat(path.join(d, w.name))).size <= 1024 * 1024) await fs.copyFile(path.join(d, w.name), path.join(t, w.name));
            }
            if (fsSync.existsSync(path.join(d, 'src'))) await kopiujSrc(path.join(d, 'src'), path.join(t, 'src'));
            for (const p of pliki) { await fs.mkdir(path.dirname(path.join(t, p.sciezka)), { recursive: true }); await fs.writeFile(path.join(t, p.sciezka), p.nowa, 'utf8'); }
            await fs.symlink(nm, path.join(t, 'node_modules'), 'junction');
            const r = await cfg.uruchom(process.execPath, [path.join(nm, 'typescript', 'bin', 'tsc'), '--noEmit', '-p', 'tsconfig.json'], { cwd: t, timeout: 180_000 });
            if (r.blad) return { ok: null, powod: `tsc nie ruszył: ${r.blad}`, bledy: [], sekundy: Math.round((Date.now() - t0) / 1000) };
            const log = `${r.stdout}\n${r.stderr}`.trim();
            const zmienione = new Set(pliki.map((p) => p.sciezka));
            const bledy = bledyTsc(log).map((b) => ({ ...b, wProponowanych: zmienione.has(b.plik) }));
            return { ok: r.kod === 0, bledy: bledy.slice(0, 60), razem: bledy.length, wProponowanych: bledy.filter((b) => b.wProponowanych).length, log: r.kod === 0 ? 'tsc --noEmit: OK' : log.slice(-4000), sekundy: Math.round((Date.now() - t0) / 1000) };
        } finally {
            // junction najpierw — rm -r nie wchodzi w link, ale wolę nie zgadywać (jak AppStudio.usunProjekt)
            await fs.rmdir(path.join(t, 'node_modules')).catch(() => fs.unlink(path.join(t, 'node_modules')).catch(() => {}));
            await fs.rm(t, { recursive: true, force: true }).catch(() => {});
        }
    }

    /** 🧪 Walidacja proponowanych plików — nic nie zapisuje w projekcie. */
    async function waliduj(projekt, { pliki, cel = '', tsc: zTsc = true, jev = false } = {}) {
        const d = dir(projekt);
        if (!Array.isArray(pliki) || !pliki.length) throw new Error('Podaj pliki: [{ sciezka, tresc }].');
        if (pliki.length > MAX_PLIKOW) throw new Error(`Najwyżej ${MAX_PLIKOW} plików naraz.`);
        const lista = [];
        for (const p of pliki) {
            const sciezka = sciezkaPlikuGry(p?.sciezka);
            if (typeof p?.tresc !== 'string') throw new Error(`Brak treści dla ${sciezka}.`);
            if (p.tresc.length > MAX_ZNAKOW) throw new Error(`${sciezka}: za długi (> ${MAX_ZNAKOW} znaków).`);
            if (lista.some((x) => x.sciezka === sciezka)) throw new Error(`${sciezka} podany dwa razy.`);
            const stara = await fs.readFile(path.join(d, sciezka), 'utf8').catch(() => null);
            lista.push({ sciezka, stara, nowa: p.tresc });
        }
        const rec = jev && cfg.jev && cfg.recenzent.recenzujZJev
            ? await cfg.recenzent.recenzujZJev(cfg.jev, { pliki: lista, cel })
            : cfg.recenzent.recenzuj({ pliki: lista, cel });
        const recenzent = { ok: rec.ok, podsumowanie: rec.podsumowanie, blokujace: rec.blokujace, uwagi: rec.uwagi, ...(rec.jev ? { jev: rec.jev } : {}), ...(rec.jevBlad ? { jevBlad: rec.jevBlad } : {}) };
        const t = zTsc ? await tsc(d, lista) : { ok: null, powod: 'tsc wyłączony (tsc: false)', bledy: [] };
        return {
            ok: recenzent.ok && t.ok !== false,
            pliki: lista.map((p) => ({ sciezka: p.sciezka, nowy: p.stara === null, linii: p.nowa.split('\n').length })),
            recenzent, tsc: t,
            uwaga: 'Walidacja niczego nie zapisała — pliki zapisuje agent (Główny przez Straż) albo Kodeks.',
        };
    }

    let kolejka = Promise.resolve();
    /** 🎮 Test gry w przeglądarce na żądanie (ten sam co w pętli Kodeksa), jeden naraz. */
    function test(projekt, { cel = '' } = {}) {
        const d = dir(projekt);
        const praca = kolejka.then(async () => {
            if (!fsSync.existsSync(path.join(d, 'dist', 'index.html'))) throw new Error(`Gra „${projekt}” nie jest zbudowana (brak dist/index.html) — najpierw budowa (Kodeks) albo vite build.`);
            const p = await cfg.appStudio.projekt(projekt);
            const r = await cfg.appStudio.przetestujWPrzegladarce(projekt, p?.typ ?? 'gra', cel);
            const migawki = (r.migawki ?? []).map((m) => { try { return { kiedy: m.kiedy, stan: JSON.parse(m.tekst) }; } catch { return { kiedy: m.kiedy, tekst: m.tekst }; } });
            return { ok: r.ok, typ: p?.typ ?? 'gra', bledy: r.bledy ?? [], migawki, stan: migawki.at(-1)?.stan ?? null, zrzut: r.zrzut ? `/api/game-studio/${projekt}/zrzut/${r.zrzut}` : null, log: r.log, sekundy: r.sekundy };
        });
        kolejka = praca.catch(() => {});
        return praca;
    }

    function plikZrzutu(projekt, plik) {
        const d = dir(projekt);
        if (!ZRZUT.test(String(plik ?? ''))) return null;
        const f = path.join(d, plik);
        return fsSync.existsSync(f) ? f : null;
    }

    return { waliduj, test, plikZrzutu };
}

/** Trasy (Straż: `/api/game-studio` tylko maszyna). */
export function zamontujTrasyStudiaMcp(app, S) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.post('/api/game-studio/:projekt/waliduj', (req, res) => odp(res, S.waliduj(req.params.projekt, { pliki: req.body?.pliki, cel: String(req.body?.cel ?? ''), tsc: req.body?.tsc !== false, jev: req.body?.jev === true })));
    app.post('/api/game-studio/:projekt/test', (req, res) => odp(res, S.test(req.params.projekt, { cel: String(req.body?.cel ?? '') })));
    app.get('/api/game-studio/:projekt/zrzut/:plik', (req, res) => {
        try { const f = S.plikZrzutu(req.params.projekt, req.params.plik); return f ? res.sendFile(f) : res.status(404).json({ success: false, message: 'Nie ma takiego zrzutu (zostaje tylko ostatni).' }); }
        catch (e) { return res.status(400).json({ success: false, message: e.message }); }
    });
}

export default { utworzStudioMcp, zamontujTrasyStudiaMcp, sciezkaPlikuGry, bledyTsc };
