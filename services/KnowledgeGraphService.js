/**
 * 🕸️ KnowledgeGraphService — Archiwista Wiedzy Katedry
 *
 * Singleton oparty na EventEmitter.
 * Odbiera zdarzenia o ukończonych zadaniach (TASK_DONE) i przetwarza je
 * asynchronicznie — nie blokuje głównego wątku wiesio-bridge.js.
 *
 * Wzorzec: Singleton + EventEmitter (Node.js core, zero zależności zewnętrznych)
 * Standard: ES Modules ("type": "module" w package.json)
 *
 * Użycie w wiesio-bridge.js:
 *   import KnowledgeGraphService from './services/KnowledgeGraphService.js';
 *   KnowledgeGraphService.getInstance().emitTaskDoneEvent(completedTask);
 */

import EventEmitter from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

// ESM nie ma __dirname — odtwarzamy przez import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Stałe ───────────────────────────────────────────────────────────────────
const GRAPH_DIR  = path.join(process.cwd(), '_AntiGravity_Wymiar', 'KnowledgeGraph');
const GRAPH_FILE = path.join(GRAPH_DIR, 'graph.json');
const EVENT_TASK_DONE = 'TASK_DONE';

// ─── Klasa ────────────────────────────────────────────────────────────────────
class KnowledgeGraphService extends EventEmitter {
    constructor() {
        super();
        this._initialized = false;
        this._graphCache  = null;

        // Rejestracja wewnętrznego handlera zdarzenia
        this.on(EVENT_TASK_DONE, (task) => this._processTaskDone(task));

        console.log('[KnowledgeGraphService] 🕸️  Archiwista wiedzy aktywny.');
    }

    // ─── Metoda publiczna: emituje zdarzenie (decoupling od wątku głównego) ──
    /**
     * Emituje zdarzenie TASK_DONE — wywołanie jest non-blocking.
     * @param {Object} completedTask - ukończone zadanie z polem `id`, `title`, itd.
     */
    emitTaskDoneEvent(completedTask) {
        if (!completedTask || !completedTask.id) {
            console.warn('[KnowledgeGraphService] ⚠️  emitTaskDoneEvent: brak poprawnego zadania.');
            return;
        }
        console.log(`[KnowledgeGraphService] 📡 Emituję TASK_DONE dla: ${completedTask.id} ("${completedTask.title || '—'}")`);
        this.emit(EVENT_TASK_DONE, completedTask);
    }

    // ─── Handler wewnętrzny — przetwarzanie asynchroniczne ───────────────────
    async _processTaskDone(task) {
        try {
            await fs.mkdir(GRAPH_DIR, { recursive: true });

            const graph = await this._loadGraph();

            // Normalizacja węzła
            const node = {
                id:          task.id,
                title:       task.title       || '(brak tytułu)',
                description: task.description || '',
                priority:    task.priority     || 'LOW',
                targetFiles: task.targetFiles  || [],
                status:      'ARCHIVED',
                archivedAt:  new Date().toISOString(),
            };

            // Deduplikacja — nie dodawaj dwukrotnie tego samego węzła
            const exists = graph.nodes.some(n => n.id === node.id);
            if (exists) {
                console.log(`[KnowledgeGraphService] 🔁 Węzeł ${node.id} już istnieje w grafie — pomijam.`);
                return;
            }

            graph.nodes.push(node);
            graph.updatedAt = new Date().toISOString();

            await fs.writeFile(GRAPH_FILE, JSON.stringify(graph, null, 2), 'utf8');
            console.log(`[KnowledgeGraphService] ✅ Węzeł ${node.id} zarchiwizowany w grafie (${graph.nodes.length} łącznie).`);

        } catch (err) {
            console.error(`[KnowledgeGraphService] ❌ Błąd przy archiwizacji węzła: ${err.message}`);
        }
    }

    // ─── Odczyt grafu (z cache lub dysku) ────────────────────────────────────
    async _loadGraph() {
        if (this._graphCache) return this._graphCache;

        try {
            const raw = await fs.readFile(GRAPH_FILE, 'utf8');
            this._graphCache = JSON.parse(raw);
        } catch (_) {
            // Plik nie istnieje lub uszkodzony — inicjalizuj pusty graf
            this._graphCache = {
                version:   '1.0',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes:     [],
            };
        }

        return this._graphCache;
    }

    // ─── Invalidacja cache (np. po zewnętrznym zapisie do graph.json) ────────
    invalidateCache() {
        this._graphCache = null;
    }
}

// ─── Singleton — eksport ESM ──────────────────────────────────────────────────
let _instance = null;

const knowledgeGraphServiceSingleton = {
    getInstance() {
        if (!_instance) {
            _instance = new KnowledgeGraphService();
        }
        return _instance;
    }
};

export default knowledgeGraphServiceSingleton;
