/**
 * 🎙️ ImpresarioService — Agent Medialny Katedry v2.0
 *
 * Zarządza kolejką wydawniczą i stanem kont na platformach muzycznych.
 * Wdrożone wzorce z analizy Rady (Adamus v1.0):
 *
 *   ▸ Atomowy zapis pliku (temp → rename) — ochrona przed race condition
 *   ▸ Lock (_isRunning) — pętla tła nie nakłada się na siebie
 *   ▸ Job Manager: PENDING → PROCESSING → COMPLETE/FAILED
 *   ▸ Singleton pattern
 *   ▸ Skarbiec sekretów (media_secrets.json) — nigdy w repozytorium!
 *   ▸ OAuth2 streaming upload YouTube (fs.createReadStream → HTTPS resumable)
 *   ▸ DistroKid Paczka Exportu: metadata.txt + audio + cover_placeholder.png
 *
 * Standard: ES Modules ("type": "module" w package.json)
 */

import path              from 'path';
import { promises as fs } from 'fs';
import { createReadStream, statSync } from 'fs'; // streaming dla YouTube
import { fileURLToPath }  from 'url';
import https              from 'https';
import { URL }            from 'url';

// ─── Ścieżki ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MEDIA_DIR    = path.join(process.cwd(), '_OtakOs_Wymiar', 'media');
const QUEUE_FILE   = path.join(MEDIA_DIR, 'media_queue.json');
const VAULT_FILE   = path.join(MEDIA_DIR, 'media_vault.json');
const SECRETS_FILE = path.join(MEDIA_DIR, 'media_secrets.json'); // NIE w repo!
const QUEUE_TEMP   = path.join(MEDIA_DIR, 'temp_queue.json');
const VAULT_TEMP   = path.join(MEDIA_DIR, 'temp_vault.json');
const SECRETS_TEMP = path.join(MEDIA_DIR, 'temp_secrets.json');

// ─── Dostępne platformy ───────────────────────────────────────────────────────
const SUPPORTED_PLATFORMS = ['youtube', 'spotify', 'soundcloud'];

// ─── Symulacja — krok postępu ─────────────────────────────────────────────────
const PROGRESS_STEP     = 18;   // % na jeden cykl
const ERROR_PROBABILITY = 0.04; // 4% szansa na FAILED (tylko symulacja)

// ─── Minimalny prawidłowy PNG 1×1 px (biały piksel) ──────────────────────────
// Użyty jako cover_placeholder.png w paczkach DistroKid
const COVER_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=';

// ─── Klasa ────────────────────────────────────────────────────────────────────
class ImpresarioService {
    constructor() {
        this._isRunning = false; // Lock zapobiega nakładaniu cykli
        console.log('[ImpresarioService] 🎙️ Agent Impresario v2.0 zainicjalizowany.');
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ════════════════════════════════════════════════════════════════════════

    async getQueue() {
        await this._ensureDir();
        return this._readQueue();
    }

    async getVault() {
        await this._ensureDir();
        return this._readVault();
    }

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

    // ── Dodaj publikację do kolejki ───────────────────────────────────────────
    //
    // @param title     {string}       Tytuł utworu/albumu (wymagany)
    // @param album     {string|null}  Nazwa albumu (opcjonalny)
    // @param platforms {string[]}     Docelowe platformy (min. 1)
    // @param filePath  {string|null}  Ścieżka do pliku .mp4/.wav/... (opcjonalna)

    async enqueuePublication(title, album, platforms, filePath = null) {
        if (!title || !title.trim()) {
            throw new Error('Tytuł jest wymagany.');
        }
        if (!Array.isArray(platforms) || platforms.length === 0) {
            throw new Error('Wymagana przynajmniej jedna platforma docelowa.');
        }

        const validPlatforms = platforms.filter(p => SUPPORTED_PLATFORMS.includes(p));
        if (validPlatforms.length === 0) {
            throw new Error(`Nieznane platformy: ${platforms.join(', ')}. Dozwolone: ${SUPPORTED_PLATFORMS.join(', ')}.`);
        }

        // Walidacja filePath — jeśli podana, sprawdź rozszerzenie
        let resolvedFilePath = null;
        if (filePath && typeof filePath === 'string' && filePath.trim()) {
            const ext = path.extname(filePath).toLowerCase();
            const ALLOWED = ['.mp4', '.mov', '.wav', '.mp3', '.flac', '.m4a', '.webm'];
            if (!ALLOWED.includes(ext)) {
                throw new Error(`Niedozwolony typ pliku: ${ext}. Akceptowane: ${ALLOWED.join(', ')}`);
            }
            resolvedFilePath = path.isAbsolute(filePath)
                ? filePath
                : path.resolve(process.cwd(), filePath);
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
            filePath:         resolvedFilePath,
            createdAt:        new Date().toISOString(),
            last_updated:     new Date().toISOString(),
        };

        queue.push(newJob);
        await this._saveQueue(queue);

        console.log(`[Impresario] ➕ Zlecenie "${newJob.title}" (${newJob.id}) → ${validPlatforms.join(', ')}` +
                    (resolvedFilePath ? ` · plik: ${path.basename(resolvedFilePath)}` : ''));
        return newJob;
    }

    // ── Aktualizacja metadanych konta ─────────────────────────────────────────

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

    // ════════════════════════════════════════════════════════════════════════
    //  PROCESOR ZADAŃ W TLE
    // ════════════════════════════════════════════════════════════════════════
    //
    // Routing:
    //   • youtube  + filePath  → uploadToYouTube()     (streaming OAuth2)
    //   • spotify              → exportSpotifyPaczkowy() (DistroKid package)
    //   • soundcloud / inne   → symulacja postępu

    async processNextJob() {
        if (this._isRunning) {
            console.log('[Impresario] ⏸️  Poprzedni cykl trwa — pomijam.');
            return;
        }

        this._isRunning = true;
        try {
            await this._ensureDir();
            const queue = await this._readQueue();

            // ── 1. Kontynuacja symulacji dla PROCESSING (bez flagi _realUpload) ──
            const simIdx = queue.findIndex(
                j => j.status === 'PROCESSING' && !j._realUpload
            );
            if (simIdx !== -1) {
                await this._advanceSimulation(queue, simIdx);
                return;
            }

            // ── 2. Weź następny PENDING (FIFO) ───────────────────────────────
            const pendingIdx = queue.findIndex(j => j.status === 'PENDING');
            if (pendingIdx === -1) return; // Kolejka pusta

            const task = queue[pendingIdx];

            // ── 3. Routing ────────────────────────────────────────────────────

            // YouTube z filePath → realny upload strumieniowy
            if (task.platforms.includes('youtube') && task.filePath) {
                queue[pendingIdx] = {
                    ...task,
                    status:       'PROCESSING',
                    _realUpload:  true,
                    startedAt:    new Date().toISOString(),
                    last_updated: new Date().toISOString(),
                };
                await this._saveQueue(queue);
                console.log(`[Impresario] 🚀 Przekazuję "${task.title}" → uploadToYouTube()`);
                // Non-blocking — upload może trwać minuty
                setImmediate(() =>
                    this.uploadToYouTube(task).catch(e =>
                        console.error('[Impresario] uploadToYouTube crash:', e.message)
                    )
                );
                return;
            }

            // Spotify → paczka DistroKid (szybkie I/O)
            if (task.platforms.includes('spotify') && !task.platforms.includes('youtube')) {
                queue[pendingIdx] = {
                    ...task,
                    status:       'PROCESSING',
                    startedAt:    new Date().toISOString(),
                    last_updated: new Date().toISOString(),
                };
                await this._saveQueue(queue);
                console.log(`[Impresario] 📦 Przekazuję "${task.title}" → exportSpotifyPaczkowy()`);
                await this.exportSpotifyPaczkowy(task);
                return;
            }

            // SoundCloud / inne → symulacja
            queue[pendingIdx] = {
                ...task,
                status:       'PROCESSING',
                startedAt:    new Date().toISOString(),
                last_updated: new Date().toISOString(),
            };
            await this._saveQueue(queue);
            console.log(`[Impresario] ▶️  Symulacja: "${task.title}" (${task.platforms.join(', ')})`);

        } catch (err) {
            console.error(`[Impresario] ❌ processNextJob: ${err.message}`);
        } finally {
            this._isRunning = false;
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  UPLOAD YOUTUBE — OAuth2 + Resumable Streaming
    // ════════════════════════════════════════════════════════════════════════
    //
    // Flow:
    //   1. Walidacja kluczy w media_secrets.json["youtube"]
    //   2. POST oauth2.googleapis.com/token → access_token
    //   3. POST googleapis.com/upload/youtube/v3/videos?uploadType=resumable → upload URL
    //   4. PUT upload URL z fs.createReadStream (strumieniuje plik bez ładowania do RAM)
    //   5. Status → COMPLETE z youtubeVideoId i youtubeUrl
    //
    // Prywatność: zawsze 'private' — Suweren decyduje o publikacji ręcznie.

    async uploadToYouTube(task) {
        console.log(`[Impresario-YT] 📺 Upload: "${task.title}" (${task.id})`);

        // ── 1. Walidacja skarbca ──────────────────────────────────────────────
        const secrets  = await this._readSecrets();
        const yt       = secrets?.youtube ?? {};
        const missing  = ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN']
            .filter(k => !yt[k]?.trim());

        if (missing.length > 0) {
            const msg = `[YouTube] Brak kluczy API w media_secrets.json (brak: ${missing.join(', ')})`;
            console.error(`[Impresario-YT] ❌ ${msg}`);
            await this._failTask(task.id, msg);
            return { success: false, reason: 'MISSING_SECRETS', message: msg };
        }

        // ── 2. Walidacja pliku ────────────────────────────────────────────────
        if (!task.filePath) {
            const msg = '[YouTube] Brak ścieżki do pliku wideo (filePath). Ustaw filePath w zleceniu.';
            await this._failTask(task.id, msg);
            return { success: false, reason: 'NO_FILE', message: msg };
        }

        let fileSize;
        try {
            fileSize = statSync(task.filePath).size;
        } catch (_) {
            const msg = `[YouTube] Plik nie istnieje: ${task.filePath}`;
            console.error(`[Impresario-YT] ❌ ${msg}`);
            await this._failTask(task.id, msg);
            return { success: false, reason: 'FILE_NOT_FOUND', message: msg };
        }

        const ext        = path.extname(task.filePath).toLowerCase();
        const MIME_MAP   = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };
        const mimeType   = MIME_MAP[ext] ?? 'video/mp4';

        try {
            // ── 3. Pobierz access token (OAuth2 Refresh Flow) ─────────────────
            console.log('[Impresario-YT] 🔑 Wymieniam refresh_token → access_token...');
            const accessToken = await this._getYouTubeAccessToken(yt);

            // ── 4. Inicjacja resumable upload ─────────────────────────────────
            console.log('[Impresario-YT] 📡 Inicjuję sesję resumable upload...');
            const uploadUrl = await this._initiateResumableUpload(
                accessToken, task, fileSize, mimeType
            );

            // ── 5. Strumieniowanie pliku ──────────────────────────────────────
            const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
            console.log(`[Impresario-YT] ⬆️  Strumieniuję plik (${sizeMB} MB)...`);
            const result = await this._streamFileToYouTube(
                uploadUrl, task.filePath, fileSize, mimeType
            );

            const videoId  = result?.id ?? result?.items?.[0]?.id ?? null;
            const ytUrl    = videoId ? `https://youtu.be/${videoId}` : null;

            console.log(`[Impresario-YT] ✅ Upload zakończony! videoId=${videoId}`);

            // ── 6. Aktualizuj status → COMPLETE ──────────────────────────────
            await this._ensureDir();
            const queue = await this._readQueue();
            await this._updateJobStatus(queue, task.id, 'COMPLETE', {
                progress_percent: 100,
                completedAt:      new Date().toISOString(),
                youtubeVideoId:   videoId,
                youtubeUrl:       ytUrl,
                note:             ytUrl
                    ? `Opublikowano (prywatnie) na YouTube: ${ytUrl}`
                    : 'Upload zakończony. Sprawdź kanał YouTube.',
            });

            return { success: true, videoId, youtubeUrl: ytUrl };

        } catch (err) {
            console.error(`[Impresario-YT] ❌ Upload nieudany: ${err.message}`);
            await this._failTask(task.id, `[YouTube] ${err.message}`);
            return { success: false, reason: 'UPLOAD_ERROR', message: err.message };
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  EKSPORT SPOTIFY / DISTROKID — Paczka na dysku
    // ════════════════════════════════════════════════════════════════════════
    //
    // Tworzy na dysku folder ${EXPORT_PATH}/${title}/ z:
    //   • metadata.txt   — pełne metadane + placeholdery AI
    //   • [plik audio]   — skopiowany z task.filePath (jeśli podany)
    //   • cover_placeholder.png — minimalny 1×1 PNG (wymień na właściwą okładkę)
    //
    // Nie wymaga API — DistroKid akceptuje wgranie folderu ręcznie.

    async exportSpotifyPaczkowy(task) {
        console.log(`[Impresario-SP] 📦 Eksportuję paczkę: "${task.title}" (${task.id})`);

        // ── 1. Czytaj ścieżkę eksportu ze skarbca ────────────────────────────
        const secrets    = await this._readSecrets();
        const exportBase = secrets?.spotify_distrokid?.EXPORT_PATH
            || path.join(MEDIA_DIR, 'exports');

        // Rozwiąż ścieżkę względem CWD jeśli nie jest absolutna
        const resolvedBase = path.isAbsolute(exportBase)
            ? exportBase
            : path.resolve(process.cwd(), exportBase);

        // Sanityzuj nazwę folderu (usuń znaki nielegalne w systemach plików)
        const safeTitle = task.title
            .replace(/[/\\?%*:|"<>]/g, '_')
            .replace(/\s+/g, '_')
            .trim()
            .substring(0, 80);

        const exportFolder = path.join(resolvedBase, safeTitle);
        await fs.mkdir(exportFolder, { recursive: true });
        console.log(`[Impresario-SP] 📁 Folder: ${exportFolder}`);

        // ── 2. Generuj metadata.txt ───────────────────────────────────────────
        const today  = new Date().toISOString().split('T')[0];
        const tagList = [
            safeTitle.toLowerCase().replace(/_/g, '-'),
            ...(task.album ? [task.album.toLowerCase().replace(/\s+/g, '-')] : []),
            ...task.platforms,
            'katedra-otakos',
            'antigravitatywna',
        ].join(', ');

        const metadata = [
            `═══════════════════════════════════════════════════════`,
            `  KATEDRA OTAKOS — PACZKA WYDAWNICZA (DistroKid)`,
            `═══════════════════════════════════════════════════════`,
            ``,
            `TYTUŁ:     ${task.title}`,
            `ALBUM:     ${task.album || '(single)'}`,
            `DATA:      ${today}`,
            `PLATFORMY: ${task.platforms.join(', ')}`,
            `TAGI:      ${tagList}`,
            `ID ZLECENIA: ${task.id}`,
            ``,
            `═══════════════════════════════════════════════════════`,
            `OPIS UTWORU (generowany przez AI — Katedra OtakOS)`,
            `═══════════════════════════════════════════════════════`,
            ``,
            `[Placeholder: Podłącz Gemma4/Claude do potoku wydawniczego,`,
            ` aby automatycznie wygenerować opis z metadanych i kontekstu albumu.]`,
            ``,
            `Sugerowane pytanie do AI:`,
            ` "Napisz opis YouTube/Spotify dla utworu '${task.title}'` +
            (task.album ? ` z albumu '${task.album}'` : '') +
            `. Styl: mroczna elektronika, antygrafitacyjna estetyka."`,
            ``,
            `═══════════════════════════════════════════════════════`,
            `TEKST UTWORU (LYRICS)`,
            `═══════════════════════════════════════════════════════`,
            ``,
            `[Placeholder: Wklej lub wygeneruj tekst utworu.]`,
            ``,
            `═══════════════════════════════════════════════════════`,
            `META`,
            `═══════════════════════════════════════════════════════`,
            ``,
            `WYGENEROWANO: ${new Date().toISOString()}`,
            `SYSTEM:       Katedra OtakOS — ImpresarioService v2.0`,
            `INSTRUKCJA:   Uzupełnij placeholdery, dodaj okładkę`,
            `              (zastąp cover_placeholder.png), wgraj folder na DistroKid.`,
            ``,
        ].join('\n');

        await fs.writeFile(path.join(exportFolder, 'metadata.txt'), metadata, 'utf8');
        console.log(`[Impresario-SP] 📄 metadata.txt ✓`);

        // ── 3. Kopiuj plik audio ──────────────────────────────────────────────
        const copiedFiles = ['metadata.txt'];
        if (task.filePath) {
            const destAudio = path.join(exportFolder, path.basename(task.filePath));
            try {
                await fs.copyFile(task.filePath, destAudio);
                copiedFiles.push(path.basename(task.filePath));
                console.log(`[Impresario-SP] 🎵 Audio skopiowane: ${path.basename(task.filePath)} ✓`);
            } catch (copyErr) {
                console.warn(`[Impresario-SP] ⚠️  Kopiowanie audio nieudane: ${copyErr.message}`);
                // Kontynuujemy — brak pliku audio nie uniemożliwia eksportu metadanych
            }
        }

        // ── 4. Stwórz cover_placeholder.png ──────────────────────────────────
        const coverBuf = Buffer.from(COVER_PNG_B64, 'base64');
        await fs.writeFile(path.join(exportFolder, 'cover_placeholder.png'), coverBuf);
        copiedFiles.push('cover_placeholder.png');
        console.log(`[Impresario-SP] 🖼️  cover_placeholder.png ✓`);

        // ── 5. Aktualizuj status → COMPLETE ──────────────────────────────────
        await this._ensureDir();
        const queue = await this._readQueue();
        await this._updateJobStatus(queue, task.id, 'COMPLETE', {
            progress_percent: 100,
            completedAt:      new Date().toISOString(),
            exportPath:       exportFolder,
            note:             'Wyeksportowano paczkę dla DistroKid!',
        });

        console.log(`[Impresario-SP] ✅ Paczka gotowa! (${copiedFiles.length} pliki)`);
        return {
            success:      true,
            exportFolder,
            filesCreated: copiedFiles,
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    //  YOUTUBE HELPERS — OAuth2 + Resumable Upload
    // ════════════════════════════════════════════════════════════════════════

    // Wymień refresh_token na krótkotrwały access_token
    async _getYouTubeAccessToken(ytSecrets) {
        const body = new URLSearchParams({
            client_id:     ytSecrets.CLIENT_ID,
            client_secret: ytSecrets.CLIENT_SECRET,
            refresh_token: ytSecrets.REFRESH_TOKEN,
            grant_type:    'refresh_token',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    body.toString(),
        });

        const data = await res.json();
        if (!data.access_token) {
            throw new Error(
                `OAuth2 token error: ${data.error ?? 'unknown'} — ${data.error_description ?? JSON.stringify(data)}`
            );
        }
        return data.access_token;
    }

    // Inicjuje sesję resumable upload, zwraca URL do wgrania danych
    async _initiateResumableUpload(accessToken, task, fileSize, mimeType) {
        const metadata = {
            snippet: {
                title:       task.title,
                description: task.album ? `Album: ${task.album}\n\nKatedra OtakOS` : 'Katedra OtakOS',
                categoryId:  '10', // Music
                tags:        ['katedra', 'otakos', task.title, task.album].filter(Boolean),
            },
            status: {
                privacyStatus: 'private', // Suweren decyduje o publikacji
                selfDeclaredMadeForKids: false,
            },
        };

        const res = await fetch(
            'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
            {
                method:  'POST',
                headers: {
                    'Authorization':           `Bearer ${accessToken}`,
                    'Content-Type':            'application/json; charset=UTF-8',
                    'X-Upload-Content-Type':   mimeType,
                    'X-Upload-Content-Length': String(fileSize),
                },
                body: JSON.stringify(metadata),
            }
        );

        if (!res.ok) {
            const err = await res.text();
            throw new Error(
                `Inicjacja resumable upload nieudana: HTTP ${res.status} — ${err.substring(0, 300)}`
            );
        }

        const uploadUrl = res.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('YouTube nie zwrócił URL sesji (brak nagłówka Location).');
        }

        return uploadUrl;
    }

    // Strumieniuje plik do uploadUrl przez Node.js https (nie ładuje do RAM)
    async _streamFileToYouTube(uploadUrl, filePath, fileSize, mimeType) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(uploadUrl);

            const options = {
                hostname: parsedUrl.hostname,
                path:     parsedUrl.pathname + parsedUrl.search,
                method:   'PUT',
                headers:  {
                    'Content-Type':   mimeType,
                    'Content-Length': fileSize,
                },
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (_) {
                            resolve({ statusCode: res.statusCode, raw: body.substring(0, 200) });
                        }
                    } else {
                        reject(new Error(
                            `Przesył YouTube nieudany: HTTP ${res.statusCode} — ${body.substring(0, 300)}`
                        ));
                    }
                });
            });

            req.on('error', (err) => reject(new Error(`HTTPS błąd połączenia: ${err.message}`)));

            // Kluczowy moment — fs.createReadStream pipe do żądania HTTPS
            createReadStream(filePath).pipe(req);
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SIMULATION HELPER
    // ════════════════════════════════════════════════════════════════════════

    async _advanceSimulation(queue, idx) {
        const job         = queue[idx];
        const newProgress = Math.min(100, job.progress_percent + PROGRESS_STEP);

        if (newProgress >= 100) {
            queue[idx] = {
                ...job,
                status:           'COMPLETE',
                progress_percent: 100,
                completedAt:      new Date().toISOString(),
                note:             'Symulacja ukończona.',
            };
            console.log(`[Impresario] ✅ Symulacja: "${job.title}" COMPLETE`);
        } else if (Math.random() < ERROR_PROBABILITY && newProgress > PROGRESS_STEP) {
            queue[idx] = {
                ...job,
                status:   'FAILED',
                failedAt: new Date().toISOString(),
                error:    'Błąd symulowanego połączenia z platformą. Ponów zlecenie.',
            };
            console.warn(`[Impresario] ❌ Symulacja: "${job.title}" FAILED`);
        } else {
            queue[idx] = {
                ...job,
                progress_percent: newProgress,
                last_updated:     new Date().toISOString(),
            };
        }

        await this._saveQueue(queue);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ════════════════════════════════════════════════════════════════════════

    // Zmień status zadania w kolejce (atomowo)
    async _updateJobStatus(queue, jobId, newStatus, extras = {}) {
        const updated = queue.map(j =>
            j.id === jobId
                ? { ...j, status: newStatus, last_updated: new Date().toISOString(), ...extras }
                : j
        );
        await this._saveQueue(updated);
    }

    // Ustaw FAILED z komunikatem błędu
    async _failTask(taskId, errorMessage) {
        try {
            await this._ensureDir();
            const queue = await this._readQueue();
            await this._updateJobStatus(queue, taskId, 'FAILED', {
                error:    errorMessage,
                failedAt: new Date().toISOString(),
            });
        } catch (e) {
            console.error(`[Impresario] _failTask error (${taskId}): ${e.message}`);
        }
    }

    // I/O — katalog
    async _ensureDir() {
        await fs.mkdir(MEDIA_DIR, { recursive: true });
    }

    // I/O — queue (read with graceful fallback)
    async _readQueue() {
        try {
            return JSON.parse(await fs.readFile(QUEUE_FILE, 'utf8'));
        } catch (_) {
            return [];
        }
    }

    // I/O — vault (read with graceful fallback)
    async _readVault() {
        try {
            return JSON.parse(await fs.readFile(VAULT_FILE, 'utf8'));
        } catch (_) {
            return {
                youtube:    { connected: false, api_key_hash: null, last_updated: new Date().toISOString() },
                spotify:    { connected: false, token_hash:   null, last_updated: new Date().toISOString() },
                soundcloud: { connected: false, api_endpoint: null, last_updated: new Date().toISOString() },
            };
        }
    }

    // I/O — queue (atomic write)
    async _saveQueue(queue) {
        await fs.writeFile(QUEUE_TEMP, JSON.stringify(queue, null, 2), 'utf8');
        await fs.rename(QUEUE_TEMP, QUEUE_FILE);
    }

    // I/O — vault (atomic write)
    async _saveVault(vault) {
        await fs.writeFile(VAULT_TEMP, JSON.stringify(vault, null, 2), 'utf8');
        await fs.rename(VAULT_TEMP, VAULT_FILE);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  ZARZĄDZANIE SEKRETAMI — zapis kluczy API z poziomu UI
    // ════════════════════════════════════════════════════════════════════════

    // Zapisuje klucze YouTube API do media_secrets.json (atomowo)
    async saveYouTubeSecrets(clientId, clientSecret, refreshToken) {
        await this._ensureDir();
        const current = await this._readSecrets();

        const updated = {
            _INSTRUKCJA: 'Uzupełnij pola kluczami API. Ten plik NIE MOŻE trafić do repozytorium (jest w .gitignore).',
            ...current,
            youtube: {
                CLIENT_ID:     clientId?.trim()     ?? current.youtube?.CLIENT_ID     ?? '',
                CLIENT_SECRET: clientSecret?.trim() ?? current.youtube?.CLIENT_SECRET ?? '',
                REFRESH_TOKEN: refreshToken?.trim() ?? current.youtube?.REFRESH_TOKEN ?? '',
            },
        };

        await fs.writeFile(SECRETS_TEMP, JSON.stringify(updated, null, 2), 'utf8');
        await fs.rename(SECRETS_TEMP, SECRETS_FILE);

        const filled  = ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN']
            .filter(k => updated.youtube[k]?.trim());
        console.log(`[Impresario] 🔐 Skarbiec YouTube zaktualizowany (${filled.length}/3 pól uzupełnionych).`);

        return {
            success:       true,
            filledFields:  filled,
            missingFields: ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'].filter(k => !updated.youtube[k]?.trim()),
        };
    }

    // Sprawdza czy klucze YouTube są uzupełnione (bez rzucania wyjątku)
    async getYouTubeSecretsStatus() {
        const secrets = await this._readSecrets();
        const yt = secrets?.youtube ?? {};
        const fields = ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'];
        const filled = fields.filter(k => yt[k]?.trim());
        return {
            allPresent: filled.length === fields.length,
            filled,
            missing:    fields.filter(k => !yt[k]?.trim()),
        };
    }

    // Symuluje natywne połączenie przez Ekosystem Gemini Agent
    // (placeholder: w przyszłości zastąpić pełnym OAuth2 redirect flow)
    async simulateGeminiAgentConnect() {
        await this._ensureDir();
        const vault = await this._readVault();

        vault.youtube = {
            ...vault.youtube,
            connected:       true,
            gemini_auth:     true,
            auth_method:     'gemini_agent_ecosystem',
            auth_timestamp:  new Date().toISOString(),
            last_updated:    new Date().toISOString(),
        };

        await this._saveVault(vault);
        console.log('[Impresario] 🤖 Ekosystem Gemini Agent: symulowane połączenie YouTube OK.');

        return {
            success:     true,
            method:      'gemini_agent_ecosystem',
            platform:    'youtube',
            note:        'Symulacja autoryzacji przez Ekosystem Gemini. Wdróż /api/auth/google dla pełnego OAuth2.',
        };
    }

    // Skarbiec sekretów — nigdy nie rzuca wyjątku (graceful degradation)
    async _readSecrets() {
        try {
            const parsed = JSON.parse(await fs.readFile(SECRETS_FILE, 'utf8'));
            delete parsed._INSTRUKCJA;
            return parsed;
        } catch (_) {
            console.warn('[Impresario] ⚠️  Skarbiec (media_secrets.json) niedostępny.');
            return { youtube: {}, spotify_distrokid: {} };
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

export default {
    getInstance() {
        if (!_instance) _instance = new ImpresarioService();
        return _instance;
    }
};
