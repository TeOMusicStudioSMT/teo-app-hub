/**
 * 🧩 Pamięć Kodu — jedna odpowiedź na pytanie „co jest w tym kodzie".
 *
 * Adaptacja `codebase-memory-mcp` (DeusData, MIT): silnik w czystym C, który
 * indeksuje repozytorium przez tree-sitter i wystawia 15 narzędzi po MCP.
 * Katedra rozmawia z nim tym samym klientem stdio, którym gada z innymi
 * serwerami MCP — nie ma tu drugiego mechanizmu.
 *
 * ⚠️ DWA SILNIKI, JEDNA PRAWDA O TYM, KTÓRY ODPOWIEDZIAŁ.
 * Katedra ma już własny graf (Graphify, `/api/wiedza/*`) — policzony, 13,8 MB.
 * `codebase-memory-mcp` jest mocniejszy (162 języki, ścieżki wywołań, architektura),
 * ale wymaga BINARIUM, którego nie ma w repozytorium: trzeba je zbudować albo
 * pobrać z wydań. Dlatego:
 *
 *   · binarium JEST  → pytamy jego,
 *   · binarium BRAK  → odpowiada Graphify,
 *
 * a każda odpowiedź niesie pole `silnik`. Ciche podmienianie jednego drugim
 * byłoby gorsze niż brak jednego z nich: Suweren musi wiedzieć, czyja to wiedza.
 *
 * ⚠️ NIE POBIERAMY I NIE URUCHAMIAMY BINARIÓW SAMI. Instalację uruchamia
 * Suweren na swojej maszynie — my tylko sprawdzamy, czy plik jest na miejscu.
 */
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { mcpPolaczenie } from './McpStdioClient.js';

const NAZWA_EXE = process.platform === 'win32' ? 'codebase-memory-mcp.exe' : 'codebase-memory-mcp';

/** Miejsca, w których binarium ląduje po instalacji — kolejność od najpewniejszej. */
function kandydaci() {
    const dom = os.homedir();
    const lista = [];
    if (process.env.CBM_BIN) lista.push(process.env.CBM_BIN);
    lista.push(
        path.join(process.cwd(), '_OtakOs_AI', 'bin', NAZWA_EXE),
        path.join(dom, '.local', 'bin', NAZWA_EXE),
        path.join(dom, '.codebase-memory-mcp', 'bin', NAZWA_EXE),
        path.join(dom, 'AppData', 'Local', 'Programs', 'codebase-memory-mcp', NAZWA_EXE),
    );
    // PATH — bez odpalania czegokolwiek, samo sprawdzenie istnienia pliku.
    for (const kat of String(process.env.PATH || '').split(path.delimiter)) {
        if (kat) lista.push(path.join(kat, NAZWA_EXE));
    }
    return lista;
}

/** Gdzie leży silnik, albo `null`. Nic nie uruchamia. */
export function znajdzSilnik() {
    for (const p of kandydaci()) {
        try { if (p && fsSync.existsSync(p) && fsSync.statSync(p).isFile()) return p; } catch { /* dalej */ }
    }
    return null;
}

export async function stan() {
    const exe = znajdzSilnik();
    if (!exe) {
        return {
            silnik: 'graphify',
            cbm: { obecny: false, sciezka: null, narzedzia: [] },
            powod: `Nie znajduję ${NAZWA_EXE}. Zbuduj ze źródeł (potrzebny gcc/clang) `
                + 'albo pobierz wydanie z github.com/DeusData/codebase-memory-mcp i połóż plik '
                + 'w _OtakOs_AI/bin/ (albo wskaż zmienną CBM_BIN). Do tego czasu odpowiada Graphify.',
        };
    }
    try {
        const p = mcpPolaczenie('codebase-memory', exe, []);
        const narzedzia = await p.listaNarzedzi();
        return {
            silnik: 'codebase-memory-mcp',
            cbm: { obecny: true, sciezka: exe, narzedzia: narzedzia.map(n => n.name) },
            powod: null,
        };
    } catch (e) {
        // Plik jest, ale nie gada po MCP. To NIE jest powód, żeby milczeć —
        // mówimy co się stało i lecimy Graphify.
        return {
            silnik: 'graphify',
            cbm: { obecny: true, sciezka: exe, narzedzia: [], blad: e.message },
            powod: `Binarium jest, ale nie odpowiada po MCP: ${e.message}`,
        };
    }
}

/**
 * Jak nazywa sie zaindeksowany projekt. Bierzemy to z `list_projects`, a nie
 * z nazwy katalogu — CBM sam wyprowadza nazwe i potrafi ja zakodowac, gdy sciezka
 * ma znaki spoza ASCII (a nasza ma spacje i polskie nazwy).
 */
let _projektCache = null;
export async function nazwaProjektu(odswiez = false) {
    if (_projektCache && !odswiez) return _projektCache;
    const exe = znajdzSilnik();
    if (!exe) return null;
    try {
        const p = mcpPolaczenie('codebase-memory', exe, []);
        const w = await p.wywolaj('list_projects', {});
        const tekst = (w?.content ?? []).map(c => (typeof c === 'string' ? c : c?.text ?? '')).join('\n');
        // Odpowiedz bywa tekstem albo JSON-em — probujemy obu, bez zakladania ksztaltu.
        try {
            const j = JSON.parse(tekst);
            const lista = Array.isArray(j) ? j : (j.projects ?? j.items ?? []);
            const pierwszy = lista[0];
            const nazwa = typeof pierwszy === 'string' ? pierwszy : (pierwszy?.name ?? pierwszy?.project);
            if (nazwa) return (_projektCache = nazwa);
        } catch { /* nie JSON — czytamy jako tekst */ }
        const m = tekst.match(/^[ \t*-]*([A-Za-z0-9_.:-]{2,})/m);
        return (_projektCache = m ? m[1] : null);
    } catch { return null; }
}

/**
 * Zapytaj pamięć kodu.
 *
 * `rodzaj` mapuje się na narzędzie CBM, a przy jego braku — na trasę Graphify:
 *   szukaj      → search_graph      | /api/wiedza/wyjasnij
 *   sciezka     → trace_path        | /api/wiedza/sciezka
 *   architektura→ get_architecture  | /api/wiedza/raport
 *   fragment    → get_code_snippet  | (Graphify tego nie ma — mówimy wprost)
 */
export async function zapytaj({ rodzaj, co, b, mostBase }) {
    const exe = znajdzSilnik();

    if (exe) {
        // ⚠️ KAZDE narzedzie CBM wymaga `project` — to nie jest opcja. Nazwy
        // parametrow wzialem ze SCHEMATOW (tools/list), nie z README: pierwsze
        // podejscie strzelalo `path` i `from/to`, a silnik chce `repo_path`
        // i `function_name`. Zgadywanie ksztaltu API konczy sie „required".
        const projekt = await nazwaProjektu();
        if (!projekt) {
            return {
                ok: false, silnik: 'codebase-memory-mcp',
                powod: 'Zaden projekt nie jest zaindeksowany. Odpal /api/pamiec-kodu/indeksuj.',
            };
        }
        const mapa = {
            szukaj: ['search_graph', { project: projekt, query: co, limit: 20 }],
            sciezka: ['trace_path', { project: projekt, function_name: co, direction: 'both' }],
            architektura: ['get_architecture', { project: projekt }],
            fragment: ['get_code_snippet', { project: projekt, qualified_name: co }],
        };
        const wpis = mapa[rodzaj];
        if (!wpis) return { ok: false, powod: `Nie znam rodzaju „${rodzaj}".` };
        try {
            const p = mcpPolaczenie('codebase-memory', exe, []);
            const wynik = await p.wywolaj(wpis[0], wpis[1]);
            const tresc = (wynik?.content ?? [])
                .map(c => (typeof c === 'string' ? c : c?.text ?? ''))
                .join('\n').trim();
            return { ok: true, silnik: 'codebase-memory-mcp', narzedzie: wpis[0], tresc };
        } catch (e) {
            return { ok: false, silnik: 'codebase-memory-mcp', powod: e.message };
        }
    }

    // ── Tor zapasowy: własny graf Katedry ───────────────────────────────────
    const base = mostBase || 'http://127.0.0.1:3001';
    const pobierz = async (url) => {
        const r = await fetch(url);
        const d = await r.json().catch(() => null);
        if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
        return d;
    };

    try {
        if (rodzaj === 'szukaj') {
            const d = await pobierz(`${base}/api/wiedza/wyjasnij?wezel=${encodeURIComponent(co)}`);
            return { ok: true, silnik: 'graphify', narzedzie: 'wyjasnij', tresc: JSON.stringify(d, null, 2) };
        }
        if (rodzaj === 'sciezka') {
            const d = await pobierz(`${base}/api/wiedza/sciezka?a=${encodeURIComponent(co)}&b=${encodeURIComponent(b || '')}`);
            return { ok: true, silnik: 'graphify', narzedzie: 'sciezka', tresc: JSON.stringify(d, null, 2) };
        }
        if (rodzaj === 'architektura') {
            const d = await pobierz(`${base}/api/wiedza/raport`);
            return { ok: true, silnik: 'graphify', narzedzie: 'raport', tresc: JSON.stringify(d, null, 2) };
        }
        if (rodzaj === 'fragment') {
            // Uczciwie: Graphify indeksuje strukturę, nie trzyma treści funkcji.
            return {
                ok: false, silnik: 'graphify',
                powod: 'Graphify zna strukturę, nie treść funkcji. Fragment kodu poda dopiero '
                    + 'codebase-memory-mcp (get_code_snippet) — po jego instalacji.',
            };
        }
        return { ok: false, powod: `Nie znam rodzaju „${rodzaj}".` };
    } catch (e) {
        return { ok: false, silnik: 'graphify', powod: e.message };
    }
}

/**
 * Zaindeksuj repozytorium w CBM. Bez tego graf jest pusty i kazde pytanie
 * wraca z niczym — a „nic" bez powodu wyglada jak awaria.
 */
export async function indeksuj(sciezka) {
    const exe = znajdzSilnik();
    if (!exe) return { ok: false, powod: 'Brak binarium codebase-memory-mcp — nie ma czym indeksowac.' };
    try {
        const p = mcpPolaczenie('codebase-memory', exe, []);
        // Indeksowanie to nie zapytanie — daj mu 20 minut, zanim uznasz, ze padlo.
        const w = await p.wywolaj('index_repository', { repo_path: sciezka || process.cwd() }, 1200000);
        const tresc = (w?.content ?? []).map(c => (typeof c === 'string' ? c : c?.text ?? '')).join('\n').trim();
        return { ok: true, tresc };
    } catch (e) {
        return { ok: false, powod: e.message };
    }
}

export default { znajdzSilnik, stan, zapytaj, indeksuj };
