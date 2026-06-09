/**
 * 🎙️ ImpresarioService — Agent Medialny Katedry
 *
 * Zarządza kolejką wydawniczą i stanem kont na platformach muzycznych.
 * Wdrożone wzorce z analizy Rady (Adamus v1.0):
 *
 *   ▸ Atomowy zapis pliku (temp → rename) — ochrona przed race condition
 *   ▸ Lock (_isRunning) — pętla tła nie nakłada się na siebie
 *   ▸ Job Manager: PENDING → PROCESSING → COMPLETE/FAILED
 *   ▸ Singleton pattern
 *
 * Standard: ES Modules ("type": "module" w package.json)
 */

import path          from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

// ─── Ścieżki ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MEDIA_DIR  = path.join(process.cwd(), '_AntiGravity_Wymiar', 'media');
const QUEUE_FILE = path.join(MEDIA_DIR, 'media_queue.json');
const VAULT_FILE = path.join(MEDIA_DIR, 'media_vault.json');
const QUEUE_TEMP = path.join(MEDIA_DIR, 'temp_queue.json');
const VAULT_TEMP = path.join(MEDIA_DIR, 'temp_vault.json');

// ─── Dostępne platformy ───────────────────────────────────────────────────────
const SUPPORTED_PLATFORMS = ['youtube', 'spotify', 'soundcloud'];

// ─── Symulacja — krok postępu ─────────────────────────────────────────────────
const PROGRESS_STEP     = 18;   // % na jeden cykl
const ERROR_PROBABILITY = 0.04; // 4% szansa na FAILED

// ─── Klasa ────────────────────────────────────────────────────────────────────
class ImpresarioService {
    constructor() {
        this._isRunning = false; // Lock zapobiega nakładaniu cykli
        console.log('[ImpresarioService] 🎙️ Agent Impresario zainicjalizowany.');
    }

    // ── PUBLIC: Odczyt kolejki ────────────────────────────────────────────────

    async getQueue() {
        await this._ensureDir();
        return this._readQueue();
    }

    // ── PUBLIC: Odczyt vault ──────────────────────────────────────────────────

    async getVault() {
        await this._ensureDir();
        return this._readVault();
    }

    // ── PUBLIC: Odczyt pełnego statusu (dla GET /api/impresario/status) ───────

    async getStatus() {
        await this._ensureDir();
        const [vault, queue] = await Promise.all([this._readVault(), this._readQueue()]);
        return {
            vault,
            queue,
            activePlatforms: Object.entries(vault)
                .filter(([, v]) => v.connected)
                .map(([k]) => k),
            pendingCount:    queue.filter(j => j.status === 'PENDING').length,
            processingCount: queue.filter(j => j.status === 'PROCESSING').length,
            lastUpdated:     new Date().toISOString(),
        };
    }

    // ── PUBLIC: Dodaj publikację do kolejki ───────────────────────────────────

    async enqueuePublication(title, album, platforms) {
        if (!title || !title.trim()) {
            throw new Error('Tytuł jest wymagany.');
        }
        if (!Array.isArray(platforms) || platforms.length === 0) {
            throw new Error('Wymagana przynajmniej jedna platforma docelowa.');
        }

        // Sanityzacja platform — akceptujemy tylko znane
        const validPlatforms = platforms.filter(p => SUPPORTED_PLATFORMS.includes(p));
        if (validPlatforms.length === 0) {
            throw new Error(`Nieznane platformy: ${platforms.join(', ')}. Dozwolone: ${SUPPORTED_PLATFORMS.join(', ')}.`);
        }

        await this._ensureDir();
        const queue = await this._readQueue();

        const newJob = {
            id:               `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            title:            title.trim(),
            album:            album?.trim() || null,
            status:           'PENDING',
            platforms:        validPlatforms,
            progress_percent: 0,
            createdAt:        new Date().toISOString(),
            last_updated:     new Date().toISOString(),
        };

        queue.push(newJob);
        await this._saveQueue(queue);

        console.log(`[Impresario] ➕ Zlecenie "${newJob.title}" (${newJob.id}) → ${validPlatforms.join(', ')}`);
        return newJob;
    }

    // ── PUBLIC: Aktualizacja metadanych konta ─────────────────────────────────

    async updateVaultMetadata(platform, isConnected, extras = {}) {
        if (!SUPPORTED_PLATFORMS.includes(platform)) {
            throw new Error(`Nieznana platforma: ${platform}`);
        }

        await this._ensureDir();
        const vault = await this._readVault();

        vault[platform] = {
            ...vault[platform],
            ...extras,
            connected:    Boolean(isConnected),
            last_updated: new Date().toISOString(),
        };

        await this._saveVault(vault);
        console.log(`[Impresario] 🔌 Vault: ${platform} → ${isConnected ? 'POŁĄCZONO' : 'ODŁĄCZONO'}`);
        return vault[platform];
    }

    // ── PUBLIC: Procesor zadań w tle (wywołuj co N sekund) ───────────────────
    //
    // Logika:
    //   1. Jeśli jest zadanie PROCESSING → zwiększ postęp
    //   2. Jeśli brak PROCESSING, ale jest PENDING → przenieś pierwsze do PROCESSING
    //   3. Zapisz atomicznie

    async processNextJob() {
        if (this._isRunning) {
            console.log('[Impresario] ⏸️  Poprzedni cykl trwa — pomijam.');
            return;
        }

        this._isRunning = true;
        try {
            await this._ensureDir();
            const queue = await this._readQueue();

            // Szukamy aktywnego zadania
            let activeIdx = queue.findIndex(j => j.status === 'PROCESSING');

            if (activeIdx === -1) {
                // Brak aktywnego — weź pierwszy PENDING (FIFO)
                const pendingIdx = queue.findIndex(j => j.status === 'PENDING');
                if (pendingIdx === -1) return; // Kolejka pusta
                queue[pendingIdx].status      = 'PROCESSING';
                queue[pendingIdx].startedAt   = new Date().toISOString();
                queue[pendingIdx].last_updated = new Date().toISOString();
                activeIdx = pendingIdx;
                console.log(`[Impresario] ▶️  Rozpoczynam: "${queue[activeIdx].title}"`);
            }

            // Aktualizuj postęp
            const job = queue[activeIdx];
            const newProgress = Math.min(100, job.progress_percent + PROGRESS_STEP);

            if (newProgress >= 100) {
                job.status           = 'COMPLETE';
                job.progress_percent = 100;
                job.completedAt      = new Date().toISOString();
                console.log(`[Impresario] ✅ Ukończono: "${job.title}" na ${job.platforms.join(', ')}`);
            } else if (Math.random() < ERROR_PROBABILITY && newProgress > PROGRESS_STEP) {
                job.status       = 'FAILED';
                job.failedAt     = new Date().toISOString();
                job.error        = 'Błąd symulowanego połączenia z platformą. Ponów zlecenie.';
                console.warn(`[Impresario] ❌ Błąd: "${job.title}"`);
            } else {
                job.progress_percent = newProgress;
                job.last_updated     = new Date().toISOString();
            }

            await this._saveQueue(queue);
        } catch (err) {
            console.error(`[Impresario] ❌ processNextJob: ${err.message}`);
        } finally {
            this._isRunning = false;
        }
    }

    // ── PRIVATE: I/O ─────────────────────────────────────────────────────────

    async _ensureDir() {
        await fs.mkdir(MEDIA_DIR, { recursive: true });
    }

    async _readQueue() {
        try {
            const raw = await fs.readFile(QUEUE_FILE, 'utf8');
            return JSON.parse(raw);
        } catch (_) {
            return [];
        }
    }

    async _readVault() {
        try {
            const raw = await fs.readFile(VAULT_FILE, 'utf8');
            return JSON.parse(raw);
        } catch (_) {
            // Domyślny vault jeśli plik nie istnieje
            return {
                youtube:    { connected: false, api_key_hash: null, last_updated: new Date().toISOString() },
                spotify:    { connected: false, token_hash:   null, last_updated: new Date().toISOString() },
                soundcloud: { connected: false, api_endpoint: null, last_updated: new Date().toISOString() },
            };
        }
    }

    async _saveQueue(queue) {
        const payload = JSON.stringify(queue, null, 2);
        await fs.writeFile(QUEUE_TEMP, payload, 'utf8');
        await fs.rename(QUEUE_TEMP, QUEUE_FILE); // atomowe
    }

    async _saveVault(vault) {
        const payload = JSON.stringify(vault, null, 2);
        await fs.writeFile(VAULT_TEMP, payload, 'utf8');
        await fs.rename(VAULT_TEMP, VAULT_FILE); // atomowe
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

const impresarioServiceSingleton = {
    getInstance() {
        if (!_instance) _instance = new ImpresarioService();
        return _instance;
    }
};

export default impresarioServiceSingleton;
