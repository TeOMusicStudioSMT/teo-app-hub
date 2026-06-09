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
 *   ▸ Skarbiec sekretów (media_secrets.json) — nigdy w repozytorium!
 *
 * Standard: ES Modules ("type": "module" w package.json)
 */

import path          from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

// ─── Ścieżki ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MEDIA_DIR    = path.join(process.cwd(), '_AntiGravity_Wymiar', 'media');
const QUEUE_FILE   = path.join(MEDIA_DIR, 'media_queue.json');
const VAULT_FILE   = path.join(MEDIA_DIR, 'media_vault.json');
const SECRETS_FILE = path.join(MEDIA_DIR, 'media_secrets.json'); // ← Skarbiec (tylko lokalne, NIE w repo)
const QUEUE_TEMP   = path.join(MEDIA_DIR, 'temp_queue.json');
const VAULT_TEMP   = path.join(MEDIA_DIR, 'temp_vault.json');

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
    //
    // @param title     {string}       Tytuł utworu/albumu (wymagany)
    // @param album     {string|null}  Nazwa albumu (opcjonalny)
    // @param platforms {string[]}     Docelowe platformy (min. 1)
    // @param filePath  {string|null}  Ścieżka do pliku .mp4/.wav (opcjonalna)

    async enqueuePublication(title, album, platforms, filePath = null) {
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

        // Walidacja filePath — jeśli podana, musi być stringiem i rozszerzeniem audio/video
        let resolvedFilePath = null;
        if (filePath && typeof filePath === 'string') {
            const ext = path.extname(filePath).toLowerCase();
            const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.wav', '.mp3', '.flac', '.m4a', '.webm'];
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                throw new Error(`Niedozwolony typ pliku: ${ext}. Akceptowane: ${ALLOWED_EXTENSIONS.join(', ')}`);
            }
            // Normalizuj ścieżkę (nie sprawdzamy istnienia — plik może być przygotowywany asynchronicznie)
            resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
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
            filePath:         resolvedFilePath, // null gdy brak pliku
            createdAt:        new Date().toISOString(),
            last_updated:     new Date().toISOString(),
        };

        queue.push(newJob);
        await this._saveQueue(queue);

        console.log(`[Impresario] ➕ Zlecenie "${newJob.title}" (${newJob.id}) → ${validPlatforms.join(', ')}${resolvedFilePath ? ` · plik: ${path.basename(resolvedFilePath)}` : ''}`);
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

    // ── PUBLIC: Szkielet uploadu YouTube (wymaga uzupełnienia media_secrets.json) ─
    //
    // Gdy CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN są puste →
    //   zmienia status zadania na FAILED z komunikatem dla Suwerena.
    // Gdy tokeny obecne → gotowy szkielet do podłączenia google-auth-library.

    async uploadVideoToYouTube(task) {
        console.log(`[Impresario-YT] 📺 Próba uploadu: "${task.title}" (${task.id})`);

        // 1. Wczytaj skarbiec
        const secrets = await this._readSecrets();
        const ytSecrets = secrets?.youtube ?? {};

        // 2. Walidacja kluczy — wszystkie trzy pola muszą być niepuste
        const missing = ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN']
            .filter(field => !ytSecrets[field] || ytSecrets[field].trim() === '');

        if (missing.length > 0) {
            const errMsg = `Brak autentykacji API. Uzupełnij plik media_secrets.json (brak: ${missing.join(', ')}).`;
            console.error(`[Impresario-YT] ❌ ${errMsg}`);

            // Zaktualizuj status zadania w kolejce
            await this._ensureDir();
            const queue = await this._readQueue();
            await this._updateJobStatus(queue, task.id, 'FAILED', { error: errMsg });
            return { success: false, reason: 'MISSING_SECRETS', message: errMsg };
        }

        // 3. Sprawdź czy plik istnieje (jeśli task.filePath ustawiony)
        if (task.filePath) {
            try {
                await fs.access(task.filePath);
            } catch (_) {
                const errMsg = `Plik nie istnieje: ${task.filePath}`;
                console.error(`[Impresario-YT] ❌ ${errMsg}`);
                const queue = await this._readQueue();
                await this._updateJobStatus(queue, task.id, 'FAILED', { error: errMsg });
                return { success: false, reason: 'FILE_NOT_FOUND', message: errMsg };
            }
        }

        // ══ SZKIELET UPLOADU ══════════════════════════════════════════════════
        // Klucze gotowe. Poniżej należy wdrożyć pełną integrację z API Google.
        //
        // Wymagana paczka: npm install googleapis
        //
        // Przykładowy flow:
        //
        //   import { google } from 'googleapis';
        //
        //   const oauth2Client = new google.auth.OAuth2(
        //       ytSecrets.CLIENT_ID,
        //       ytSecrets.CLIENT_SECRET,
        //       'urn:ietf:wg:oauth:2.0:oob'  // lub redirect URI
        //   );
        //   oauth2Client.setCredentials({ refresh_token: ytSecrets.REFRESH_TOKEN });
        //
        //   const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        //   const response = await youtube.videos.insert({
        //       part: ['snippet', 'status'],
        //       requestBody: {
        //           snippet: { title: task.title, description: task.album ?? '' },
        //           status:  { privacyStatus: 'private' },
        //       },
        //       media: { body: fs.createReadStream(task.filePath) },
        //   });
        //   const videoId = response.data.id;
        //
        // ═════════════════════════════════════════════════════════════════════

        console.log(`[Impresario-YT] ✅ Klucze obecne — szkielet gotowy do podłączenia googleapis.`);
        console.log(`[Impresario-YT] 💡 Zainstaluj: npm install googleapis, a następnie uzupełnij blok SZKIELET UPLOADU.`);

        return {
            success: true,
            ready:   true,
            message: 'Klucze API zweryfikowane. Zaimplementuj pełny upload w bloku SZKIELET UPLOADU w ImpresarioService.js.',
            taskId:  task.id,
        };
    }

    // ── PRIVATE: Pomocnik zmiany statusu joba w kolejce ───────────────────────

    async _updateJobStatus(queue, jobId, newStatus, extras = {}) {
        const updated = queue.map(j =>
            j.id === jobId
                ? { ...j, status: newStatus, last_updated: new Date().toISOString(), ...extras }
                : j
        );
        await this._saveQueue(updated);
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

    // Odczyt Skarbca — nigdy nie rzuca wyjątku (graceful fallback)
    async _readSecrets() {
        try {
            const raw = await fs.readFile(SECRETS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            // Pomiń pole _INSTRUKCJA (metadata)
            delete parsed._INSTRUKCJA;
            return parsed;
        } catch (_) {
            // Plik nie istnieje lub błąd parsowania — zwróć puste obiekty
            console.warn(`[Impresario] ⚠️  Skarbiec (media_secrets.json) niedostępny — upload API niemożliwy.`);
            return { youtube: {}, spotify: {} };
        }
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
