/**
 * 🔮 TurbovecService — Lekki Silnik Wektorowy Katedry
 *
 * Uproszczony indeks plików źródłowych projektu oparty na podobieństwie terminów
 * (TF-IDF style, zero zewnętrznych zależności). Gdy Rada Gemma4 generuje pod-zadania,
 * TurbovecService wstrzykuje w opis zadania kontekst najbliższych wektorowo plików,
 * aby agent (Mechanik, Impresario) wiedział od razu, nad którym kodem ma pracować.
 *
 * Architektura:
 *   Rada → pod-zadanie.title + pod-zadanie.agent
 *       → TurbovecService.search(title)
 *       → [{path, score, snippet}] top-K
 *       → pod-zadanie.description += "\n[TURBOVEC] Powiązane pliki: ..."
 *
 * Standard ESM · Singleton · Lazy index (buduje przy pierwszym użyciu)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// ─── Konfiguracja indeksu ─────────────────────────────────────────────────────

const INDEX_DIRS = [
    'components/special',
    'services',
    'hooks',
    'context',
    'lib',
];

const INDEXABLE_EXTS   = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_NAMES       = new Set(['node_modules', '.git', 'dist', '.claude', '.agent']);
const MAX_FILE_CHARS   = 3000;  // Limit na plik (oszczędność RAM)
const SNIPPET_LEN      = 160;   // Długość snippetu zwracanego z wynikiem
const MIN_TERM_LEN     = 3;
const MAX_TERM_LEN     = 40;

// ─── Klasa ────────────────────────────────────────────────────────────────────

class TurbovecServiceClass {
    constructor() {
        /** @type {Array<{relPath: string, content: string, terms: Set<string>}>} */
        this._index   = [];
        this._ready   = false;
        this._building = false;
        this._lastBuildMs = 0;
        console.log('[TurbovecService] 🔮 Silnik wektorowy zainicjalizowany. Indeks buduje się leniwie.');
    }

    /**
     * Wyszukaj top-K plików podobnych semantycznie do zapytania.
     * @param {string} query
     * @param {number} [topK=5]
     * @returns {Promise<Array<{path: string, score: number, snippet: string}>>}
     */
    async search(query, topK = 5) {
        await this._ensureIndex();
        const queryTerms = this._tokenize(query);
        if (queryTerms.size === 0) return [];

        return this._index
            .map(entry => ({
                path:    entry.relPath,
                score:   this._cosineLike(queryTerms, entry.terms),
                snippet: entry.content.substring(0, SNIPPET_LEN).replace(/\n+/g, ' ').trim(),
            }))
            .filter(e => e.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    /**
     * Wstrzyknij kontekst turbovec w opis pod-zadania Rady.
     * Zwraca wzbogacony opis zadania.
     * @param {{title: string, description: string, agent: string}} task
     * @returns {Promise<string>} wzbogacony opis
     */
    async enrichTaskDescription(task) {
        const query = `${task.title} ${task.agent}`;
        const hits  = await this.search(query, 4);
        if (hits.length === 0) return task.description;

        const contextLines = hits
            .map((h, i) => `  [${i + 1}] ${h.path} (score: ${h.score.toFixed(2)})`)
            .join('\n');

        return `${task.description}\n\n[TURBOVEC] Powiązane pliki źródłowe:\n${contextLines}`;
    }

    /** Wymuś przebudowę indeksu (np. po zmianie plików). */
    async reindex() {
        this._ready   = false;
        this._index   = [];
        await this._ensureIndex();
        return { files: this._index.length, builtAt: new Date().toISOString() };
    }

    /** Status indeksu. */
    getStatus() {
        return {
            ready:      this._ready,
            files:      this._index.length,
            building:   this._building,
            lastBuildMs: this._lastBuildMs,
        };
    }

    // ── Prywatne ──────────────────────────────────────────────────────────────

    async _ensureIndex() {
        if (this._ready) return;
        // Jeśli inny async context już buduje — poczekaj
        while (this._building) {
            await new Promise(r => setTimeout(r, 80));
        }
        if (this._ready) return; // double-check po czekaniu
        this._building = true;
        const t0 = Date.now();
        try {
            await this._buildIndex();
            this._lastBuildMs = Date.now() - t0;
            this._ready = true;
            console.log(`[TurbovecService] ✅ Indeks gotowy: ${this._index.length} plików (${this._lastBuildMs}ms)`);
        } catch (e) {
            console.error('[TurbovecService] ❌ Błąd budowania indeksu:', e.message);
        } finally {
            this._building = false;
        }
    }

    async _buildIndex() {
        const entries = [];
        for (const dir of INDEX_DIRS) {
            const absDir = path.join(PROJECT_ROOT, dir);
            try {
                const files = await this._scanDir(absDir);
                for (const filePath of files) {
                    const ext = path.extname(filePath).toLowerCase();
                    if (!INDEXABLE_EXTS.has(ext)) continue;
                    try {
                        const rawContent = await fs.readFile(filePath, 'utf8');
                        const content    = rawContent.substring(0, MAX_FILE_CHARS);
                        const relPath    = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
                        entries.push({
                            relPath,
                            content,
                            terms: this._tokenize(content + ' ' + relPath),
                        });
                    } catch { /* plik bez dostępu — pomiń */ }
                }
            } catch { /* katalog nie istnieje — pomiń */ }
        }
        this._index = entries;
    }

    async _scanDir(dir) {
        const results = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (SKIP_NAMES.has(entry.name)) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    results.push(...await this._scanDir(fullPath));
                } else {
                    results.push(fullPath);
                }
            }
        } catch { /* brak uprawnień do katalogu — pomiń */ }
        return results;
    }

    /** Tokenizacja: litery/cyfry, długość 3-40, lowercase */
    _tokenize(text) {
        const terms = new Set();
        const tokens = text
            .toLowerCase()
            .replace(/[^a-z0-9À-ɏ_]/g, ' ')
            .split(/\s+/);
        for (const tok of tokens) {
            if (tok.length >= MIN_TERM_LEN && tok.length <= MAX_TERM_LEN) {
                terms.add(tok);
                // Rozbij camelCase / PascalCase: "WidokCore" → "widok", "core"
                const sub = tok.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
                for (const s of sub) {
                    if (s.length >= MIN_TERM_LEN) terms.add(s);
                }
            }
        }
        return terms;
    }

    /** Uproszczone cosine-like: overlap / |query| */
    _cosineLike(queryTerms, docTerms) {
        let overlap = 0;
        for (const term of queryTerms) {
            if (docTerms.has(term)) overlap++;
        }
        return queryTerms.size > 0 ? overlap / queryTerms.size : 0;
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

export default {
    getInstance() {
        if (!_instance) _instance = new TurbovecServiceClass();
        return _instance;
    },
};
