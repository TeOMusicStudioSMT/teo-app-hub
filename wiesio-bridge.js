import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// --- WEKTOROWE SOCZEWKI (EMBEDDINGS) ---
let wiesioBrain = null;

function calculateGravity(vecA, vecB) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

(async () => {
    try {
        console.log('🧠 [Wiesio-Mózg] Budzę lokalne neurony... (To może potrwać chwilę przy pierwszym uruchomieniu)');
        const { pipeline } = await import('@xenova/transformers');
        
        // Ładujemy lekki, lokalny model do wektoryzacji tekstu
        wiesioBrain = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✨ [Wiesio-Mózg] Wektorowe Soczewki założone! Gotów do czytania Kronik!');
    } catch (err) {
        console.error('❌ [Wiesio-Mózg] Błąd przy zakładaniu soczewek:', err);
    }
})();

const app = express();
const PORT = 3001;

// Ścieżki do folderów
const ANTIGRAVITY_DIR = path.join(process.cwd(), '_AntiGravity_Wymiar');
const MUSIC_DIR       = path.join(process.cwd(), '_AntiGravity_Muzyka');
const MOVE_DIR        = path.join(process.cwd(), '_AntiGravity_Move');

// Rozszerzenia audio
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.opus'];

// Podstawowe middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Zwiększamy limit dla dużych plików video (Base64)
app.use(express.json({ limit: '2000mb' }));
app.use(express.urlencoded({ limit: '2000mb', extended: true }));

// ── STATYCZNY SERWER MUZYKI ──────────────────────────────────────────
// GET http://localhost:3001/music/nazwa.mp3  →  stream pliku
app.use('/music', cors({ origin: '*' }), express.static(MUSIC_DIR, {
    setHeaders: (res) => {
        res.setHeader('Accept-Ranges', 'bytes');  // seeking w przeglądarce
        res.setHeader('Cache-Control', 'no-cache');
    }
}));

// Inicjalizacja folderów
async function initializeDimension() {
    for (const dir of [ANTIGRAVITY_DIR, MUSIC_DIR, MOVE_DIR]) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (e) {
            console.error(`[Wiesio-Bridge] Błąd tworzenia folderu:`, e);
        }
    }
    console.log(`[Wiesio-Bridge] 📁 Dane:   ${ANTIGRAVITY_DIR}`);
    console.log(`[Wiesio-Bridge] 🎵 Muzyka: ${MUSIC_DIR}`);
    console.log(`[Wiesio-Bridge] 🎬 Filmy:  ${MOVE_DIR}`);
}
initializeDimension();

// ── FUNKCJA REKURENCYJNA ─────────────────────────────────────────────
async function getAudioFilesRecursive(dir) {
    let results = [];
    try {
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const file of list) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                results = results.concat(await getAudioFilesRecursive(fullPath));
            } else {
                const ext = path.extname(file.name).toLowerCase();
                if (AUDIO_EXTENSIONS.includes(ext)) {
                    results.push(fullPath);
                }
            }
        }
    } catch (e) {
        console.error(`[Wiesio-Bridge] Błąd skanowania folderu ${dir}:`, e);
    }
    return results;
}

// ── GŁÓWNY ENDPOINT ──────────────────────────────────────────────────
app.post('/api/bridge/execute', async (req, res) => {
    const payload = req.body;

    // PING
    if (payload.command) {
        console.log(`[Wiesio-Bridge] PING: "${payload.command}"`);
        return res.json({
            success: true,
            message: `Wiesław odebrał ping: [${payload.command}]`,
            timestamp: Date.now()
        });
    }

    const { action, filename, content } = payload;
    console.log(`[Wiesio-Bridge] Akcja: [${action}]`);

    // ── WRITE_FILE ───────────────────────────────────────────────────
    if (action === 'WRITE_FILE') {
        if (!filename || !content) {
            return res.status(400).json({ success: false, message: 'Brak filename lub content' });
        }
        try {
            const filePath = path.join(ANTIGRAVITY_DIR, filename);
            await fs.writeFile(filePath, content, 'utf8');
            console.log(`[Wiesio-Bridge] 📝 Zapisano: ${filePath}`);
            return res.json({ success: true, message: 'Zmaterializowano.', filePath, timestamp: Date.now() });
        } catch (e) {
            console.error(`[Wiesio-Bridge] ❌ Błąd zapisu:`, e);
            return res.status(500).json({ success: false, message: `Błąd zapisu: ${e.message}` });
        }
    }

    // ── READ_FILE ────────────────────────────────────────────────────
    if (action === 'READ_FILE') {
        if (!filename) {
            return res.status(400).json({ success: false, message: 'Brak filename' });
        }
        try {
            const filePath = path.join(ANTIGRAVITY_DIR, filename);
            const fileContent = await fs.readFile(filePath, 'utf8');
            console.log(`[Wiesio-Bridge] 📖 Odczytano: ${filePath}`);
            return res.json({ success: true, filename, content: fileContent, timestamp: Date.now() });
        } catch (e) {
            if (e.code === 'ENOENT') {
                return res.status(404).json({ success: false, message: `Plik "${filename}" nie istnieje.`, code: 'FILE_NOT_FOUND' });
            }
            return res.status(500).json({ success: false, message: `Błąd odczytu: ${e.message}` });
        }
    }

    // ── LIST_DIRECTORY ───────────────────────────────────────────────
    if (action === 'LIST_DIRECTORY') {
        try {
            const entries = await fs.readdir(ANTIGRAVITY_DIR, { withFileTypes: true });
            const files = await Promise.all(
                entries.map(async (entry) => {
                    const entryPath = path.join(ANTIGRAVITY_DIR, entry.name);
                    const stats = await fs.stat(entryPath);
                    return {
                        name: entry.name,
                        type: entry.isDirectory() ? 'directory' : 'file',
                        size: entry.isFile() ? stats.size : null,
                        modified: stats.mtime.toISOString(),
                    };
                })
            );
            console.log(`[Wiesio-Bridge] 📂 Lista (${files.length} szt.)`);
            return res.json({ success: true, files, directory: ANTIGRAVITY_DIR, timestamp: Date.now() });
        } catch (e) {
            return res.status(500).json({ success: false, message: `Błąd skanowania: ${e.message}` });
        }
    }

    // ── GET_LOCAL_PLAYLIST ───────────────────────────────────────────
    // Sztuczka nr 4: skanuje _AntiGravity_Muzyka/ i zwraca playlistę
    // z gotowymi URL-ami do streamowania przez Wiesia
    if (action === 'GET_LOCAL_PLAYLIST') {
        try {
            const allFiles = await getAudioFilesRecursive(MUSIC_DIR);

            const tracks = allFiles.map((fullPath, index) => {
                // Ścieżka względna np. "Album/Piosenka.wav"
                const relativePath = path.relative(MUSIC_DIR, fullPath).replace(/\\/g, '/');
                const filename = path.basename(fullPath);
                const ext = path.extname(filename);
                const title = path.basename(filename, ext)
                    .replace(/[-_]/g, ' ')
                    .replace(/^\d+[\s.\-]+/, '')
                    .trim() || filename;

                // Kodujemy każdy segment ścieżki osobno, aby '/' przetrwały
                const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');

                return {
                    id: `local-${index}-${filename}`,
                    title,
                    audio_url: `http://localhost:3001/music/${encodedPath}`,
                    filename: relativePath,
                    image_url: null,
                    duration: 0,
                    tags: 'local · 0.00G',
                };
            });

            console.log(`[Wiesio-Bridge] 🎵 Playlista: ${tracks.length} utworów`);

            return res.json({
                success:  true,
                message:  `DJ Wiesław przygotował ${tracks.length} utworów.`,
                tracks,
                musicDir: MUSIC_DIR,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error(`[Wiesio-Bridge] ❌ Błąd playlisty:`, e);
            return res.status(500).json({ success: false, message: `Błąd playlisty: ${e.message}` });
        }
    }

    // ── SAVE_PODCAT ─────────────────────────────────────────────────
    if (action === 'SAVE_PODCAT') {
        const { videoData } = payload;
        if (!videoData) {
            return res.status(400).json({ success: false, message: 'Brak videoData' });
        }
        try {
            // videoData to string Base64: "data:video/webm;base64,..."
            let base64Data = videoData;
            if (base64Data.includes(',')) {
                base64Data = base64Data.split(',')[1];
            }
            const buffer = Buffer.from(base64Data, 'base64');
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `PodCaT_${ts}.webm`;
            const filePath = path.join(MOVE_DIR, filename);

            await fs.writeFile(filePath, buffer);
            console.log(`[Wiesio-Bridge] 🎬 Zapisano wideo (Single Shot): ${filePath}`);

            // ── Rafineria FFmpeg ─────────────────────────────────────────
            const mp4Path = filePath.replace('.webm', '.mp4');
            console.log(`[Wiesio-Rafineria] 🏭 Otrzymano surowiec. Rozpoczynam tytanową destylację do MP4...`);

            ffmpeg(filePath)
                .inputOptions([
                    '-analyzeduration 2147483647',
                    '-probesize 2147483647'
                ])
                .outputOptions([
                    '-pix_fmt yuv420p',                       // Standard kolorów dla YouTube/Adobe
                    '-r 60',                                  // Wymuszenie płynności 60 FPS
                    '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'   // TARCZA: Wymuszenie parzystości wymiarów!
                ])
                .videoCodec('libx264')
                .audioCodec('aac')
                .on('error', (err, stdout, stderr) => {
                    console.error(`[Wiesio-Rafineria] ❌ Błąd destylacji: ${err.message}`);
                    console.error(`[LUPA DIAGNOSTYCZNA WIESŁAWA]:\n${stderr}`);
                })
                .on('end', () => {
                    console.log(`[Wiesio-Rafineria] ✨ Sukces! Eliksir MP4 gotowy: ${path.basename(mp4Path)}`);
                    try {
                        fsSync.unlinkSync(filePath);
                        console.log('[Wiesio-Rafineria] 🧹 Surowiec .webm zutylizowany.');
                    } catch (err) {
                        console.error('[Wiesio-Rafineria] ⚠️ Błąd utylizacji .webm:', err.message);
                    }
                })
                .save(mp4Path);

            return res.json({ success: true, message: 'Wideo zmaterializowane.', filename, timestamp: Date.now() });
        } catch (e) {
            console.error(`[Wiesio-Bridge] ❌ Błąd zapisu wideo:`, e);
            return res.status(500).json({ success: false, message: `Błąd zapisu wideo: ${e.message}` });
        }
    }

    // ── Nieobsługiwana akcja ─────────────────────────────────────────
    res.status(400).json({ success: false, message: `Nieobsługiwana akcja: ${action}` });
});

app.get('/wiesio/ping', (req, res) => {
    res.status(200).json({ status: 'alive', message: 'Wiesław czuwa! Rury drożne!' });
});

/**
 * 🛰️ Dedykowany endpoint dla akcji Wiesława (w tym PodCaT)
 * Służy do cichej komunikacji z frontendem bez barier CORS.
 */
app.post('/wiesio/action', async (req, res) => {
    const { action, payload } = req.body;
    
    if (action === 'TEST_SOCZEWEK') {
        if (!wiesioBrain) {
            return res.status(503).json({ status: 'error', message: 'Mózg jeszcze się ładuje, poczekaj chwilę!' });
        }
        
        const textToFeel = payload.text || "Suweren wchodzi w Wymiar 0.00G.";
        
        // Przepuszczamy tekst przez Soczewkę (generujemy wektory)
        const output = await wiesioBrain(textToFeel, { pooling: 'mean', normalize: true });
        
        // output.data to tablica floatów (nasz wektor grawitacyjny!)
        const vectorArray = Array.from(output.data);
        
        console.log(`🌌 [Wiesio-Mózg] Przeczytałem myśl! Wygenerowałem wektor o długości: ${vectorArray.length} wymiarów.`);
        
        return res.status(200).json({ 
            status: 'success', 
            message: 'Wibracja zmierzona!', 
            dimensions: vectorArray.length,
            sample: vectorArray.slice(0, 5) // Pokazujemy tylko 5 pierwszych liczb dla podglądu
        });
    }

    if (action === 'SZUKAJ_W_PAMIECI') {
        if (!wiesioBrain) return res.status(503).json({ error: 'Mózg śpi!' });
        
        const memoryFile = path.join('F:', '5 stars', 'TeO STUDIO', 'TeO App HuB', 'ToO APP', 'TeO_Genesis', '_AntiGravity_Kroniki', '_podswiadomosc.json');
        
        if (!fsSync.existsSync(memoryFile)) return res.status(200).json({ context: null });

        const queryVectorObj = await wiesioBrain(payload.query, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(queryVectorObj.data);
        
        const memory = JSON.parse(fsSync.readFileSync(memoryFile, 'utf8'));
        let bestMatch = null;
        let highestGravity = -1;

        for (const item of memory) {
            const gravity = calculateGravity(queryVector, item.vector);
            // Jeśli rezonans jest silny (np. powyżej 0.5)
            if (gravity > highestGravity && gravity > 0.5) {
                highestGravity = gravity;
                bestMatch = item.content;
            }
        }

        console.log(`[Wiesio-Mózg] 🔍 Szukano: "${payload.query.substring(0, 20)}..." | Max Grawitacja: ${highestGravity.toFixed(3)}`);
        return res.status(200).json({ context: bestMatch, gravity: highestGravity });
    }

    if (action === 'INDEX_KRONIKI') {
        if (!wiesioBrain) return res.status(503).json({ error: 'Mózg jeszcze się ładuje!' });

        const kronikiDir = path.join('F:', '5 stars', 'TeO STUDIO', 'TeO App HuB', 'ToO APP', 'TeO_Genesis', '_AntiGravity_Kroniki');
        const indexFile = path.join(kronikiDir, '_podswiadomosc.json');

        if (!fsSync.existsSync(kronikiDir)) {
            return res.status(404).json({ error: 'Brak biblioteki Kronik!' });
        }

        const files = fsSync.readdirSync(kronikiDir).filter(f => f.endsWith('.md'));
        let memory = [];

        console.log(`[Wiesio-Mózg] 📖 Rozpoczynam czytanie ${files.length} Kronik...`);

        for (const file of files) {
            const content = fsSync.readFileSync(path.join(kronikiDir, file), 'utf8');
            
            // Zamiana treści Kroniki na wektor grawitacyjny!
            const output = await wiesioBrain(content, { pooling: 'mean', normalize: true });
            
            memory.push({
                id: file,
                vector: Array.from(output.data),
                content: content // Zapisujemy też treść, by Rada mogła ją odzyskać
            });
            console.log(`[Wiesio-Mózg] 🧬 Przyswojono: ${file}`);
        }

        // Zapisanie Podświadomości na dysk
        fsSync.writeFileSync(indexFile, JSON.stringify(memory));
        console.log(`[Wiesio-Mózg] 🧠 Cyfrowa Podświadomość zaktualizowana! Zapisano w _podswiadomosc.json`);
        
        return res.status(200).json({ status: 'success', indexed: files.length });
    }

    if (action === 'SAVE_KRONIKA') {
        try {
            // Ścieżka do nowej Biblioteki
            const kronikiDir = path.join('F:', '5 stars', 'TeO STUDIO', 'TeO App HuB', 'ToO APP', 'TeO_Genesis', '_AntiGravity_Kroniki');
            
            // Używamy fsSync dla operacji na ścieżkach fizycznych z literą dysku, 
            // jeśli fs.mkdir na p: w windows bywał wybredny
            if (!fsSync.existsSync(kronikiDir)) {
                fsSync.mkdirSync(kronikiDir, { recursive: true });
                console.log(`[Wiesio-Archiwista] 📚 Zbudowano nowe regały na dysku F: (_AntiGravity_Kroniki)`);
            }

            const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `Kronika_Wymiaru_${dateStr}.md`;
            const filePath = path.join(kronikiDir, fileName);

            // Zapis na dysk
            fsSync.writeFileSync(filePath, payload.content, 'utf8');
            console.log(`[Wiesio-Archiwista] 📜 Nowy Traktat wyryty w miedzi: ${fileName}`);
            
            return res.status(200).json({ status: 'success', message: 'Kronika zapisana!' });
        } catch (e) {
            console.error(`[Wiesio-Archiwista] ❌ Błąd rzeźbienia:`, e);
            return res.status(500).json({ status: 'error', message: `Błąd rzeźbienia: ${e.message}` });
        }
    }

    if (action === 'APPEND_CHUNK') {
        try {
            const { filename, chunkData } = payload || {};
            if (!fsSync.existsSync(MOVE_DIR)) {
                fsSync.mkdirSync(MOVE_DIR, { recursive: true });
            }
            
            // Oczyszczenie base64 i konwersja do bufora binarnego
            const base64Data = chunkData.replace(/^data:.*?;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            
            // DOKLEJANIE (append) w locie do pliku na dysku!
            fsSync.appendFileSync(path.join(MOVE_DIR, filename), buffer);
            return res.status(200).json({ status: 'ok' });
        } catch (e) {
            console.error(`[Wiesio-Archiwista] ❌ Błąd taśmociągu (APPEND):`, e);
            return res.status(500).json({ status: 'error', message: e.message });
        }
    }

    if (action === 'FINISH_PODCAT') {
        try {
            const { filename } = payload || {};
            const filePath = path.join(MOVE_DIR, filename);
            console.log(`[Wiesio-Archiwista] 🏁 Zakończono odbiór z taśmociągu. Odpalam Rafinerię dla: ${filename}`);
            
            const mp4Path = filePath.replace('.webm', '.mp4');
            
            ffmpeg(filePath)
                .inputOptions([
                    '-analyzeduration 2147483647',
                    '-probesize 2147483647'
                ])
                .outputOptions([
                    '-pix_fmt yuv420p',                       // Standard kolorów dla YouTube/Adobe
                    '-r 60',                                  // Wymuszenie płynności 60 FPS
                    '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'   // TARCZA: Wymuszenie parzystości wymiarów!
                ])
                .videoCodec('libx264')
                .audioCodec('aac')
                .on('error', (err, stdout, stderr) => {
                    console.error(`[Wiesio-Rafineria] ❌ Błąd destylacji: ${err.message}`);
                    console.error(`[LUPA DIAGNOSTYCZNA WIESŁAWA]:\n${stderr}`);
                })
                .on('end', () => {
                    console.log(`[Wiesio-Rafineria] ✨ Sukces! Eliksir MP4 gotowy: ${path.basename(mp4Path)}`);
                    try {
                        fsSync.unlinkSync(filePath);
                        console.log('[Wiesio-Rafineria] 🧹 Surowiec .webm zutylizowany.');
                    } catch (err) {
                        console.error('[Wiesio-Rafineria] ⚠️ Błąd utylizacji .webm:', err.message);
                    }
                })
                .save(mp4Path);
            
            return res.status(200).json({ status: 'rafineria_started' });
        } catch (e) {
            console.error(`[Wiesio-Archiwista] ❌ Błąd rzafinerii (FINISH):`, e);
            return res.status(500).json({ status: 'error', message: e.message });
        }
    }

    if (action === 'SAVE_PODCAT') {
        const { chunkData, filename: customFilename } = payload || {};
        const data = chunkData;

        if (!data) {
            return res.status(400).json({ success: false, message: 'Wiesław mówi: Brak danych wideo!' });
        }

        try {
            let base64Data = data;
            if (base64Data.includes(',')) {
                base64Data = base64Data.split(',')[1];
            }
            const buffer = Buffer.from(base64Data, 'base64');
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = customFilename || `PodCaT_${ts}.webm`;
            const filePath = path.join(MOVE_DIR, filename);

            await fs.writeFile(filePath, buffer);
            console.log(`[Wiesio-Bridge] 🎬 Zapisano wideo (PodCaT): ${filePath}`);

            // ── Rafineria FFmpeg ─────────────────────────────────────────
            const mp4Path = filePath.replace('.webm', '.mp4');
            console.log(`[Wiesio-Rafineria] 🏭 Otrzymano surowiec. Rozpoczynam tytanową destylację do MP4...`);

            ffmpeg(filePath)
                .inputOptions([
                    '-analyzeduration 2147483647',
                    '-probesize 2147483647'
                ])
                .outputOptions([
                    '-pix_fmt yuv420p',                       // Standard kolorów dla YouTube/Adobe
                    '-r 60',                                  // Wymuszenie płynności 60 FPS
                    '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'   // TARCZA: Wymuszenie parzystości wymiarów!
                ])
                .videoCodec('libx264')
                .audioCodec('aac')
                .on('error', (err, stdout, stderr) => {
                    console.error(`[Wiesio-Rafineria] ❌ Błąd destylacji: ${err.message}`);
                    console.error(`[LUPA DIAGNOSTYCZNA WIESŁAWA]:\n${stderr}`);
                })
                .on('end', () => {
                    console.log(`[Wiesio-Rafineria] ✨ Sukces! Eliksir MP4 gotowy: ${path.basename(mp4Path)}`);
                    try {
                        fsSync.unlinkSync(filePath);
                        console.log('[Wiesio-Rafineria] 🧹 Surowiec .webm zutylizowany.');
                    } catch (err) {
                        console.error('[Wiesio-Rafineria] ⚠️ Błąd utylizacji .webm:', err.message);
                    }
                })
                .save(mp4Path);

            return res.json({ success: true, message: 'PodCaT zmaterializowany.', filename, timestamp: Date.now() });
        } catch (e) {
            console.error(`[Wiesio-Bridge] ❌ Błąd zapisu PodCaT:`, e);
            return res.status(500).json({ success: false, message: `Błąd zapisu: ${e.message}` });
        }
    }

    res.status(400).json({ success: false, message: `Wiesław nie zna tej akcji: ${action}` });
});

app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(` 🔌 Wiesław nasłuchuje na porcie ${PORT}`);
    console.log(`================================================`);
    console.log(` 📦 WRITE_FILE | READ_FILE | LIST_DIRECTORY`);
    console.log(` 🎵 GET_LOCAL_PLAYLIST | GET /music/* (stream)`);
    console.log(`================================================`);
    console.log(` 👉 Muzyka: _AntiGravity_Muzyka/`);
    console.log(`================================================`);
});