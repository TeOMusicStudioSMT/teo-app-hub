/**
 * 🕸️ KnowledgeGraphService — Archiwista Wiedzy Katedry
 *
 * Singleton oparty na EventEmitter. Dwa kanały:
 *   1. TASK_DONE   — archiwizuje ukończone zadania (poprzedni moduł)
 *   2. ERROR_EVENT — analizuje błędy przez Gemma4, zapisuje wnioski do grafu
 *
 * Zapis atomowy: temp_kg_update.json → fs.rename → knowledge_graph.json
 * Fallback: dead_letter_knowledge.json (gdy AI zawiedzie)
 *
 * Standard: ES Modules ("type": "module" w package.json)
 */

import EventEmitter  from 'events';
import path          from 'path';
import { promises as fs, renameSync } from 'fs';
import { fileURLToPath } from 'url';

// ─── Ścieżki ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const GRAPH_DIR        = path.join(process.cwd(), '_AntiGravity_Wymiar', 'KnowledgeGraph');
const GRAPH_FILE       = path.join(GRAPH_DIR, 'graph.json');
const TEMP_FILE        = path.join(GRAPH_DIR, 'temp_kg_update.json');
const DEAD_LETTER_FILE = path.join(GRAPH_DIR, 'dead_letter_knowledge.json');

// ─── Ollama ───────────────────────────────────────────────────────────────────
const OLLAMA_URL    = 'http://127.0.0.1:11434/api/generate';
const GEMMA_MODEL   = 'gemma4';

// Zimny start dużego modelu (gemma4 12B) może zająć 60–90 sekund przy ładowaniu wag do VRAM.
// Ustawiamy 120 s aby bezpiecznie pokryć oba scenariusze: zimny i ciepły start.
const AI_TIMEOUT_MS = 120_000; // 120 s (wcześniej: 30 s — zbyt krótkie dla zimnego startu)

// ─── Zdarzenia ────────────────────────────────────────────────────────────────
const EVENT_TASK_DONE = 'TASK_DONE';
const EVENT_ERROR     = 'ERROR_EVENT';

// ─── Klasa ────────────────────────────────────────────────────────────────────
class KnowledgeGraphService extends EventEmitter {
    constructor() {
        super();
        this._graphCache = null;

        this.on(EVENT_TASK_DONE, (task)  => this._processTaskDone(task));
        this.on(EVENT_ERROR,     (error) => this._processError(error));

        console.log('[KnowledgeGraphService] 🕸️  Archiwista wiedzy aktywny (TASK_DONE + ERROR_EVENT).');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    /** Non-blocking. Emituje zdarzenie ukończonego zadania. */
    emitTaskDoneEvent(completedTask) {
        if (!completedTask?.id) {
            console.warn('[KGS] ⚠️  emitTaskDoneEvent: brak id zadania.');
            return;
        }
        console.log(`[KGS] 📡 TASK_DONE → ${completedTask.id}`);
        this.emit(EVENT_TASK_DONE, completedTask);
    }

    /**
     * Non-blocking. Przyjmuje obiekt Error z catch-bloku Chaosu.
     * Przekazuje do przetwarzania asynchronicznego przez Gemma4.
     */
    emitErrorEvent(error) {
        if (!error) {
            console.warn('[KGS] ⚠️  emitErrorEvent: brak obiektu błędu.');
            return;
        }
        console.log(`[KGS] 📡 ERROR_EVENT → ${error.name}: ${error.message}`);
        this.emit(EVENT_ERROR, error);
    }

    /** Invalidacja cache — wymuś ponowny odczyt z dysku. */
    invalidateCache() {
        this._graphCache = null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TASK_DONE HANDLER
    // ─────────────────────────────────────────────────────────────────────────

    async _processTaskDone(task) {
        try {
            await this._ensureDir();
            const graph = await this._loadGraph();

            const node = {
                id:          task.id,
                title:       task.title       || '(brak tytułu)',
                description: task.description || '',
                priority:    task.priority     || 'LOW',
                targetFiles: task.targetFiles  || [],
                status:      'ARCHIVED',
                archivedAt:  new Date().toISOString(),
            };

            if (graph.nodes.some(n => n.id === node.id)) {
                console.log(`[KGS] 🔁 Węzeł ${node.id} już istnieje — pomijam.`);
                return;
            }

            graph.nodes.push(node);
            graph.updatedAt = new Date().toISOString();

            await this._atomicWrite(graph);
            console.log(`[KGS] ✅ Task-węzeł ${node.id} zarchiwizowany (${graph.nodes.length} łącznie).`);

        } catch (err) {
            console.error(`[KGS] ❌ _processTaskDone: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERROR_EVENT HANDLER — Analiza AI + zapis do grafu
    // ─────────────────────────────────────────────────────────────────────────

    async _processError(error) {
        const nodeId    = `ERR-${Date.now().toString(36).toUpperCase()}`;
        const timestamp = new Date().toISOString();

        console.log(`[KGS] 🔬 Analizuję błąd przez Gemma4: ${error.name}…`);

        let insight   = null;
        let aiSuccess = false;

        try {
            insight   = await this._callGemma(error);
            aiSuccess = true;
        } catch (aiErr) {
            console.error(`[KGS] ❌ Gemma4 nie odpowiedziała: ${aiErr.message}`);
            await this._writeDeadLetter({ nodeId, timestamp, error, aiError: aiErr.message });
        }

        // Zawsze zapisuj węzeł — nawet jeśli AI zawiedzie (fallback insight)
        const node = {
            id:        nodeId,
            timestamp,
            errorType: error.name  || 'UnknownError',
            errorMsg:  error.message || '',
            insight:   insight ?? `[FALLBACK] Brak analizy AI. Błąd: ${error.name} — ${error.message}`,
            status:    'RESOLVED',
            aiSuccess,
        };

        try {
            await this._ensureDir();
            const graph = await this._loadGraph();

            graph.nodes.push(node);
            graph.updatedAt = timestamp;

            await this._atomicWrite(graph);
            console.log(`[KGS] ✅ Węzeł błędu ${nodeId} zapisany w grafie (${graph.nodes.length} łącznie). AI: ${aiSuccess ? '✓' : '✗ fallback'}`);

        } catch (writeErr) {
            console.error(`[KGS] ❌ _processError write: ${writeErr.message}`);
            await this._writeDeadLetter({ nodeId, timestamp, error, writeError: writeErr.message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AI CALL — Gemma4 przez Ollama
    // ─────────────────────────────────────────────────────────────────────────

    async _callGemma(error) {
        const prompt =
            `Przeanalizuj następujący incydent środowiskowy Katedry:\n` +
            `Typ błędu: ${error.name}\n` +
            `Komunikat: ${error.message}\n\n` +
            `Wygeneruj wysokopoziomowy wniosek architektoniczny (High-Level Insight) ` +
            `w 1-2 zdaniach po polsku. Określ potencjalne powiązanie systemowe i priorytet naprawy. ` +
            `Odpowiedz TYLKO wnioskiem — bez wstępu, bez etykiet, bez JSON.`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        console.log(`[KGS] ⏳ Oczekiwanie na odpowiedź modelu ${GEMMA_MODEL} (może to potrwać przy zimnym starcie — timeout: ${AI_TIMEOUT_MS / 1000}s)...`);
        console.log(`[KGS] 🎯 Endpoint: ${OLLAMA_URL}`);

        let raw = '';
        try {
            const resp = await fetch(OLLAMA_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                signal:  controller.signal,
                body: JSON.stringify({
                    model:  GEMMA_MODEL,
                    prompt,
                    stream: false,
                }),
            });

            if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
            const json = await resp.json();
            raw = (json.response || '').trim();
            console.log(`[KGS] ✅ Model odpowiedział (${raw.length} znaków).`);

        } finally {
            clearTimeout(timer);
        }

        if (!raw) throw new Error('Gemma4 zwróciła pustą odpowiedź.');
        return raw;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ATOMIC WRITE — temp → rename
    // ─────────────────────────────────────────────────────────────────────────

    async _atomicWrite(graph) {
        const payload = JSON.stringify(graph, null, 2);
        await fs.writeFile(TEMP_FILE, payload, 'utf8');
        // rename jest atomowe na tym samym wolumenie (POSIX) lub blisko-atomowe (Windows NTFS)
        await fs.rename(TEMP_FILE, GRAPH_FILE);
        this._graphCache = graph;   // aktualizuj cache po udanym zapisie
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEAD LETTER QUEUE
    // ─────────────────────────────────────────────────────────────────────────

    async _writeDeadLetter(entry) {
        try {
            await this._ensureDir();
            let dlq = [];
            try {
                const raw = await fs.readFile(DEAD_LETTER_FILE, 'utf8');
                dlq = JSON.parse(raw);
            } catch (_) { /* plik nie istnieje — OK */ }

            dlq.push({ ...entry, dlqAt: new Date().toISOString() });
            await fs.writeFile(DEAD_LETTER_FILE, JSON.stringify(dlq, null, 2), 'utf8');
            console.warn(`[KGS] 📮 Dead Letter: zapisano wpis (${dlq.length} łącznie).`);
        } catch (e) {
            console.error(`[KGS] 🔥 CRITICAL: nie można zapisać do Dead Letter Queue! ${e.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ODCZYT GRAFU (cache + dysk)
    // ─────────────────────────────────────────────────────────────────────────

    async _loadGraph() {
        if (this._graphCache) return this._graphCache;

        try {
            const raw = await fs.readFile(GRAPH_FILE, 'utf8');
            this._graphCache = JSON.parse(raw);
        } catch (_) {
            this._graphCache = {
                version:   '1.0',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes:     [],
            };
        }
        return this._graphCache;
    }

    async _ensureDir() {
        await fs.mkdir(GRAPH_DIR, { recursive: true });
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

const knowledgeGraphServiceSingleton = {
    getInstance() {
        if (!_instance) _instance = new KnowledgeGraphService();
        return _instance;
    }
};

export default knowledgeGraphServiceSingleton;
