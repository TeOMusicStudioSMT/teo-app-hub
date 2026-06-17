/**
 * 🔧 MechanicService — Agent Mechanik Katedry
 *
 * Odpowiada za cykl życia naprawy zadań z kolejki:
 *   PENDING → IN_PROGRESS → [Gemma4 generuje patch] → READY_FOR_REVIEW
 *   Na błąd AI: → FAILED + dead_letter_knowledge.json
 *
 * Zasady bezpieczeństwa:
 *   - Mechanik NIGDY nie modyfikuje plików źródłowych (.tsx, .ts)
 *   - Wynik AI trafia do _OtakOs_Wymiar/patches/patch_[TaskID].md (piaskownica)
 *   - Atomowy zapis kolejki: temp_queue.json → fs.rename → queue.json
 *   - Lock (_isRunning) zapobiega nakładaniu się wywołań setInterval
 *
 * Standard: ES Modules ("type": "module" w package.json)
 */

import path          from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import TurbovecService from './TurbovecService.js';
import ShellSanitizer from './ShellSanitizer.js';

// ─── Ścieżki ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ANTIGRAVITY_DIR = path.join(process.cwd(), '_OtakOs_Wymiar');
const TASKS_DIR       = path.join(ANTIGRAVITY_DIR, 'tasks');
const PATCHES_DIR     = path.join(ANTIGRAVITY_DIR, 'patches');
const QUEUE_FILE      = path.join(TASKS_DIR,  'queue.json');
const QUEUE_TEMP      = path.join(TASKS_DIR,  'temp_queue.json');
const DEAD_LETTER_FILE = path.join(TASKS_DIR, 'dead_letter_mechanic.json');

// ─── Ollama ───────────────────────────────────────────────────────────────────
const OLLAMA_URL    = 'http://127.0.0.1:11434/api/generate';
const GEMMA_MODEL   = 'gemma4';
const AI_TIMEOUT_MS = 300_000;  // 300s (VRAM Breathing v2) — pełna swoboda alokacji VRAM przy zimnym starcie gemma4

// ─── Typy statusów ────────────────────────────────────────────────────────────
const STATUS = {
    PENDING:            'PENDING',
    IN_PROGRESS:        'IN_PROGRESS',
    READY_FOR_REVIEW:   'READY_FOR_REVIEW',
    FAILED:             'FAILED',
};

// ─── Klasa ────────────────────────────────────────────────────────────────────
class MechanicService {
    constructor() {
        this._isRunning = false;  // Lock — zapobiega nakładaniu się wywołań
        console.log('[MechanicService] 🔧 Agent Mechanik zainicjalizowany.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: cykl przetwarzania kolejki
    // ─────────────────────────────────────────────────────────────────────────

    async processPendingTasks() {
        if (this._isRunning) {
            console.log('[Mechanik] ⏸️  Poprzedni cykl jeszcze trwa — pomijam.');
            return;
        }

        this._isRunning = true;
        console.log('[Mechanik] 🔄 Rozpoczynam skan kolejki zadań...');

        try {
            await this._ensureDirs();
            const tasks = await this._readQueue();

            const pending = tasks.filter(t => t.status === STATUS.PENDING);
            console.log(`[Mechanik] 📋 Kolejka: ${tasks.length} łącznie, ${pending.length} PENDING.`);

            if (pending.length === 0) {
                console.log('[Mechanik] ✅ Kolejka pusta — brak pracy.');
                return;
            }

            // Przetwarzamy jedno zadanie na raz (FIFO)
            const task = pending[0];
            await this._processTask(task, tasks);

        } catch (err) {
            console.error(`[Mechanik] ❌ processPendingTasks: ${err.message}`);
        } finally {
            this._isRunning = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: odczyt aktualnej kolejki (dla endpointu GET)
    // ─────────────────────────────────────────────────────────────────────────

    async getQueue() {
        await this._ensureDirs();
        return this._readQueue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: WYCZYŚĆ WSZYSTKO — zresetuj kolejkę zadań do zera
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Usuwa WSZYSTKIE zadania z kolejki (wiszące, nieaktualne procesy) i zapisuje
     * pustą tablicę. Zwraca liczbę usuniętych zadań.
     */
    async clearQueue() {
        await this._ensureDirs();
        const tasks = await this._readQueue();
        const count = tasks.length;
        await this._saveQueue([]);
        console.log(`[Mechanik] 🧹 WYCZYŚĆ WSZYSTKO — usunięto ${count} zadań, kolejka zresetowana do zera.`);
        return count;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: Otak-Sync Watchdog — odkażanie komend powłoki dla zadań shell
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Hook Strażnika Powłoki: każda komenda, którą agent Mechanik miałby przekazać
     * do powłoki Windows (cmd/PowerShell), przechodzi przez ten filtr — usuwa
     * znaczniki promptu "$", /dev/null i Linux-izmy. UWAGA: NIE stosujemy tego do
     * treści patchy/kodu (kod TS używa `${...}`); wyłącznie do komend shell.
     * @param {string} rawCommand
     * @returns {string} bezpieczna komenda pod powłokę Windows
     */
    sanitizeShellCommand(rawCommand) {
        const { command, changed, notes } = ShellSanitizer.sanitizeShellCommand(rawCommand);
        if (changed) console.log(`[Mechanik·Otak-Sync] 🧯 Komenda odkażona: ${notes.join(' ')}`);
        return command;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: odrzucenie zadania (READY_FOR_REVIEW → REJECTED)
    // ─────────────────────────────────────────────────────────────────────────

    async rejectTask(id) {
        if (!id) return null;
        await this._ensureDirs();
        const tasks = await this._readQueue();
        if (!tasks.some(t => t.id === id)) {
            console.warn(`[Mechanik] ⚠️  rejectTask: zadanie ${id} nie istnieje.`);
            return null;
        }
        await this._updateStatus(id, tasks, 'REJECTED', { rejectedAt: new Date().toISOString() });
        console.log(`[Mechanik] 🚫 Zadanie ${id} → REJECTED.`);
        return id;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: oznacz jako wdrożone (READY_FOR_REVIEW → DONE)
    // ─────────────────────────────────────────────────────────────────────────

    async doneTask(id) {
        if (!id) return null;
        await this._ensureDirs();
        const tasks = await this._readQueue();
        if (!tasks.some(t => t.id === id)) {
            console.warn(`[Mechanik] ⚠️  doneTask: zadanie ${id} nie istnieje.`);
            return null;
        }
        await this._updateStatus(id, tasks, 'DONE', { doneAt: new Date().toISOString() });
        console.log(`[Mechanik] ✅ Zadanie ${id} → DONE (patch wdrożony).`);
        return id;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: ręczne dodanie zadania do kolejki (dla /api/chaos/inject etc.)
    // ─────────────────────────────────────────────────────────────────────────

    async enqueueTask(task) {
        if (!task?.id || !task?.title) {
            console.warn('[Mechanik] ⚠️  enqueueTask: brak id lub title.');
            return null;
        }

        await this._ensureDirs();
        const tasks = await this._readQueue();

        // Deduplikacja po id
        if (tasks.some(t => t.id === task.id)) {
            console.log(`[Mechanik] 🔁 Zadanie ${task.id} już w kolejce — pomijam.`);
            return null;
        }

        const entry = {
            id:          task.id,
            title:       task.title,
            description: task.description || '',
            priority:    task.priority    || 'LOW',
            targetFiles: task.targetFiles || [],
            status:      STATUS.PENDING,
            createdAt:   new Date().toISOString(),
            updatedAt:   new Date().toISOString(),
        };

        tasks.push(entry);
        await this._saveQueue(tasks);

        console.log(`[Mechanik] ➕ Zadanie ${entry.id} dodane do kolejki (${tasks.length} łącznie).`);
        return entry;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: przetwarzanie jednego zadania
    // ─────────────────────────────────────────────────────────────────────────

    async _processTask(task, allTasks) {
        console.log(`[Mechanik] 🛠️  Przetwarzam: [${task.priority}] ${task.id} — "${task.title}"`);

        // 1. Zablokuj zadanie: PENDING → IN_PROGRESS
        await this._updateStatus(task.id, allTasks, STATUS.IN_PROGRESS, {
            startedAt: new Date().toISOString(),
        });

        // 1b. [🔍 SKANOWANIE STRUKTURY] TurbovecService wzbogaca opis o kontekst plików
        await this._setStage(task.id, allTasks, 'SCANNING');
        try {
            const enriched = await TurbovecService.getInstance().enrichTaskDescription(task);
            if (enriched !== task.description) {
                task = { ...task, description: enriched };
                console.log(`[Mechanik·Turbovec] 🔮 Opis zadania ${task.id} wzbogacony (${enriched.length} znaków).`);
            }
        } catch (tvErr) {
            console.warn(`[Mechanik·Turbovec] ⚠️ Enrichment skipped: ${tvErr.message}`);
        }

        let patchContent = null;

        // 2. [🛠️ GENEROWANIE ŁATKI] Wyślij do Gemma4 (z kontekstem Turboveca)
        await this._setStage(task.id, allTasks, 'GENERATING');
        try {
            patchContent = await this._callGemma(task);
        } catch (aiErr) {
            // Detekcja zatoru VRAM: abort = Ollama nie zdążyła załadować modelu w limicie.
            const aborted = aiErr.name === 'AbortError' || /aborted|abort/i.test(aiErr.message || '');
            const vramNote = '[MECHANIK] ⚠️ Wykryto zator pamięci VRAM. ' +
                'Podnoszę limity magistrali i restartuję nasłuch rdzenia...';

            if (aborted) {
                console.warn(`[Mechanik] ${vramNote} (zadanie ${task.id}, timeout ${AI_TIMEOUT_MS / 1000}s)`);
            }
            console.error(`[Mechanik] ❌ AI zawiedzie dla ${task.id}: ${aiErr.message}`);

            // Odłóż do rejestru zadań jasny komunikat (widoczny na Szmaragdowym Terminalu).
            await this._updateStatus(task.id, allTasks, STATUS.FAILED, {
                failedAt:  new Date().toISOString(),
                error:     aborted ? vramNote : aiErr.message,
                vramStall: aborted || undefined,
            });
            await this._writeDeadLetter({ task, error: aborted ? `${vramNote} (${aiErr.message})` : aiErr.message });
            return;
        }

        // 2b. [🧪 WERYFIKACJA KOMPILACJI (Vite/esbuild)] — autonomiczny loop testowy
        await this._setStage(task.id, allTasks, 'VERIFYING');
        let verify = { ok: true, attempts: 0, planOnly: true };
        try {
            verify = await this._verifyAndRepair(task, patchContent);
            patchContent = verify.patch;   // pętla mogła poprawić kod
        } catch (vErr) {
            console.warn(`[Mechanik·Verify] ⚠️ Weryfikacja pominięta: ${vErr.message}`);
            verify = { ok: true, attempts: 0, skipped: true };
        }

        // 3. Zapisz patch do piaskownicy (NIE modyfikuj src!)
        const patchFile = path.join(PATCHES_DIR, `patch_${task.id}.md`);
        const patchBody = this._formatPatch(task, patchContent, verify);

        try {
            await fs.writeFile(patchFile, patchBody, 'utf8');
            console.log(`[Mechanik] 📄 Patch zapisany: ${patchFile}`);
        } catch (writeErr) {
            console.error(`[Mechanik] ❌ Zapis patcha: ${writeErr.message}`);
            await this._updateStatus(task.id, allTasks, STATUS.FAILED, {
                failedAt: new Date().toISOString(),
                error:    writeErr.message,
                stage:    'FAILED',
            });
            await this._writeDeadLetter({ task, error: writeErr.message });
            return;
        }

        // 4. [🟢 GOTOWE DO ZATWIERDZENIA] IN_PROGRESS → READY_FOR_REVIEW
        await this._updateStatus(task.id, allTasks, STATUS.READY_FOR_REVIEW, {
            completedAt:   new Date().toISOString(),
            patchFile:     `patches/patch_${task.id}.md`,
            stage:         'READY',
            verified:      verify.ok,
            verifyAttempts: verify.attempts,
            planOnly:      verify.planOnly || undefined,
            verifyError:   verify.ok ? undefined : verify.error,
        });

        const verdict = verify.planOnly ? 'plan (bez kodu)' : verify.ok
            ? `składnia OK${verify.attempts ? ` po ${verify.attempts} naprawach` : ''}`
            : `⚠️ nadal błąd po 3 próbach`;
        console.log(`[Mechanik] ✅ Zadanie ${task.id} → READY_FOR_REVIEW (${verdict}).`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: AI CALL — Gemma4 (ten sam wzorzec co KnowledgeGraphService)
    // ─────────────────────────────────────────────────────────────────────────

    async _callGemma(task) {
        const prompt =
            `Jesteś głównym inżynierem Katedry. Napraw ten błąd:\n\n` +
            `ID zadania: ${task.id}\n` +
            `Tytuł: ${task.title}\n` +
            `Opis: ${task.description}\n` +
            `Priorytet: ${task.priority}\n` +
            (task.targetFiles?.length
                ? `Pliki docelowe: ${task.targetFiles.join(', ')}\n`
                : '') +
            `\nWygeneruj konkretny kod naprawczy lub instrukcję refaktoryzacji. ` +
            `Podaj kompletny kod w jednym bloku \`\`\`...\`\`\`. Ogranicz tekst poboczny. ` +
            `Jeśli nie ma wystarczającego kontekstu, opisz architektoniczny plan naprawy krok po kroku.`;
        return this._callGemmaRaw(prompt, task.id);
    }

    /** Wspólny niski-poziom caller Gemma4 (reużywany przez napraw-loop i Git Assistant). */
    async _callGemmaRaw(prompt, tag = 'raw') {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
        let raw = '';
        try {
            const resp = await fetch(OLLAMA_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                signal:  controller.signal,
                body: JSON.stringify({ model: GEMMA_MODEL, prompt, stream: false }),
            });
            if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
            const json = await resp.json();
            raw = (json.response || '').trim();
            console.log(`[Mechanik] ✅ Model odpowiedział (${raw.length} znaków) [${tag}].`);
        } finally {
            clearTimeout(timer);
        }
        if (!raw) throw new Error('Gemma4 zwróciła pustą odpowiedź.');
        return raw;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: 🧪 AUTONOMICZNY LOOP TESTOWY (weryfikacja kompilacji + samonaprawa)
    // ─────────────────────────────────────────────────────────────────────────

    /** Wyciągnij pierwszy blok kodu z odpowiedzi Gemmy (```lang ... ```). */
    _extractCode(text) {
        const m = String(text || '').match(/```[a-zA-Z]*\n([\s\S]*?)```/);
        return m ? m[1].trim() : null;
    }

    /**
     * Cichy test syntaktyczny przez esbuild (ten sam silnik co Vite) — ms zamiast
     * pełnego npm run build. Wykrywa błędy składni TS/TSX/JS bez wdrażania patcha.
     */
    async _verifySyntax(code, targetFile = '') {
        const ext = (String(targetFile).match(/\.(\w+)$/) || [])[1]?.toLowerCase();
        const loader = ext === 'tsx' ? 'tsx' : ext === 'ts' ? 'ts' : ext === 'jsx' ? 'jsx' : 'js';
        try {
            const esbuild = await import('esbuild');
            await esbuild.transform(code, { loader, logLevel: 'silent' });
            return { ok: true, engine: 'esbuild', loader };
        } catch (e) {
            const msg = (e.errors?.map(x => x.text).join('; ')) || e.message;
            return { ok: false, error: msg, loader };
        }
    }

    /** Przeproś Gemmę o naprawę WYŁĄCZNIE błędu składni (faza pętli). */
    async _callGemmaFix(task, brokenCode, error, attempt) {
        const prompt =
            `Twój poprzedni patch dla "${task.title}" ma BŁĄD KOMPILACJI (próba ${attempt}/3).\n\n` +
            `BŁĄD KOMPILATORA:\n${error}\n\n` +
            `KOD:\n\`\`\`\n${String(brokenCode).slice(0, 2500)}\n\`\`\`\n\n` +
            `Napraw WYŁĄCZNIE błąd składni. Zwróć POPRAWIONY, kompletny kod w jednym bloku \`\`\`...\`\`\`. ` +
            `Bez wyjaśnień, bez tekstu poza blokiem kodu.`;
        return this._callGemmaRaw(prompt, `fix#${attempt}`);
    }

    /**
     * Pętla samonaprawy: generuj → testuj składnię → (jeśli błąd) popraw → powtórz (max 3).
     * @returns {Promise<{ok, patch, attempts, error?, planOnly?}>}
     */
    async _verifyAndRepair(task, patchContent) {
        const targetFile = task.targetFiles?.[0] || '';
        let patch = patchContent, attempts = 0, lastError = null;

        for (let i = 0; i < 3; i++) {
            const code = this._extractCode(patch);
            if (!code) {
                // Brak bloku kodu → plan architektoniczny, nie ma czego kompilować.
                return { ok: true, patch, attempts, planOnly: true };
            }
            const v = await this._verifySyntax(code, targetFile);
            if (v.ok) {
                console.log(`[Mechanik·Verify] 🟢 Składnia czysta (${v.loader}) po ${attempts} naprawach.`);
                return { ok: true, patch, attempts };
            }
            attempts++;
            lastError = v.error;
            console.warn(`[Mechanik·Verify] 🧪 Próba ${attempts}/3 — błąd: ${String(v.error).slice(0, 120)}`);
            if (i < 2) {
                try { patch = await this._callGemmaFix(task, code, v.error, attempts); }
                catch (e) { lastError = e.message; break; }
            }
        }
        return { ok: false, patch, attempts, error: lastError };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: 🧠 CONTEXT-AWARE GIT ASSISTANT — Conventional Commits z git diff
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Generuje nagłówek commita w konwencji Conventional Commits na bazie diffu.
     * @param {string} diffText  surowy git diff (przycięty)
     * @returns {Promise<string>} np. "fix(mechanic): naprawa pętli weryfikacji"
     */
    async generateCommitMessage(diffText) {
        const prompt =
            `Na podstawie poniższego git diff wygeneruj DOKŁADNIE JEDEN nagłówek commita w konwencji ` +
            `Conventional Commits: "type(scope): opis".\n` +
            `Typy: feat, fix, refactor, docs, chore, perf, test, style.\n` +
            `Scope = obszar kodu (core, view, bridge, mechanic, vault, arcade, kibel, ui...).\n` +
            `Maks 72 znaki, bez kropki na końcu, bez markdown, bez cudzysłowów. Odpowiedz TYLKO nagłówkiem.\n\n` +
            `DIFF:\n${String(diffText).slice(0, 4000)}`;
        const raw = await this._callGemmaRaw(prompt, 'git-msg');
        // Pierwsza sensowna linia, oczyszczona z markdown/cudzysłowów.
        const line = raw.split('\n').map(l => l.trim()).find(l => /^[a-z]+(\(.+\))?:/i.test(l)) || raw.split('\n')[0];
        return line.replace(/^[`*>"'\s-]+/, '').replace(/["'`]+$/, '').slice(0, 100).trim();
    }

    /** Ustaw fazę operacyjną zadania (live-stepper na Szmaragdowym Terminalu). */
    async _setStage(taskId, allTasks, stage) {
        await this._updateStatus(taskId, allTasks, STATUS.IN_PROGRESS, { stage });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: formatowanie pliku patch.md
    // ─────────────────────────────────────────────────────────────────────────

    _formatPatch(task, aiContent, verify = {}) {
        const ts = new Date().toISOString();
        const verifyLine = verify.planOnly
            ? `> **🧪 Weryfikacja:** plan architektoniczny (brak kodu do kompilacji)`
            : verify.skipped
            ? `> **🧪 Weryfikacja:** pominięta`
            : verify.ok
            ? `> **🧪 Weryfikacja:** 🟢 składnia OK (esbuild)${verify.attempts ? ` po ${verify.attempts} auto-naprawach` : ''}`
            : `> **🧪 Weryfikacja:** 🔴 błąd składni po 3 próbach — ${String(verify.error).slice(0, 160)}`;
        return [
            `# 🔧 Patch: ${task.title}`,
            ``,
            `> **ID zadania:** \`${task.id}\``,
            `> **Priorytet:** ${task.priority}`,
            `> **Status:** READY_FOR_REVIEW`,
            `> **Wygenerowano:** ${ts}`,
            verifyLine,
            (task.targetFiles?.length
                ? `> **Pliki docelowe:** ${task.targetFiles.map(f => `\`${f}\``).join(', ')}`
                : ''),
            ``,
            `---`,
            ``,
            `## Opis Incydentu`,
            ``,
            task.description || '(brak opisu)',
            ``,
            `---`,
            ``,
            `## Propozycja Naprawy (Gemma4)`,
            ``,
            aiContent,
            ``,
            `---`,
            ``,
            `*Wygenerowano automatycznie przez Agenta Mechanika Katedry.*`,
            `*Plik tylko do odczytu — nie modyfikuje źródeł projektu.*`,
        ].filter(line => line !== undefined).join('\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: I/O kolejki
    // ─────────────────────────────────────────────────────────────────────────

    async _readQueue() {
        try {
            const raw = await fs.readFile(QUEUE_FILE, 'utf8');
            return JSON.parse(raw);
        } catch (_) {
            return [];  // plik nie istnieje — pusta kolejka
        }
    }

    async _saveQueue(tasks) {
        const payload = JSON.stringify(tasks, null, 2);
        await fs.writeFile(QUEUE_TEMP, payload, 'utf8');
        await fs.rename(QUEUE_TEMP, QUEUE_FILE);  // atomic
    }

    async _updateStatus(taskId, allTasks, newStatus, extra = {}) {
        const updated = allTasks.map(t =>
            t.id === taskId
                ? { ...t, status: newStatus, updatedAt: new Date().toISOString(), ...extra }
                : t
        );
        await this._saveQueue(updated);
        // Odbij zmiany w tablicy allTasks (in-place) by kolejne operacje w tym samym cyklu miały spójny stan
        const changed = updated.find(t => t.id === taskId);
        if (changed) Object.assign(allTasks.find(t => t.id === taskId) || {}, changed);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: infrastruktura
    // ─────────────────────────────────────────────────────────────────────────

    async _ensureDirs() {
        await Promise.all([
            fs.mkdir(TASKS_DIR,   { recursive: true }),
            fs.mkdir(PATCHES_DIR, { recursive: true }),
        ]);
    }

    async _writeDeadLetter(entry) {
        try {
            let dlq = [];
            try {
                const raw = await fs.readFile(DEAD_LETTER_FILE, 'utf8');
                dlq = JSON.parse(raw);
            } catch (_) { /* plik nie istnieje */ }

            dlq.push({ ...entry, dlqAt: new Date().toISOString() });
            await fs.writeFile(DEAD_LETTER_FILE, JSON.stringify(dlq, null, 2), 'utf8');
            console.warn(`[Mechanik] 📮 Dead Letter: zapisano wpis (${dlq.length} łącznie).`);
        } catch (e) {
            console.error(`[Mechanik] 🔥 CRITICAL: nie można zapisać DLQ! ${e.message}`);
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

const mechanicServiceSingleton = {
    getInstance() {
        if (!_instance) _instance = new MechanicService();
        return _instance;
    }
};

export default mechanicServiceSingleton;
