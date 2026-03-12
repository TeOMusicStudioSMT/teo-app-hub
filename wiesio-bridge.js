import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 3001;

// Ścieżki do folderów
const ANTIGRAVITY_DIR = path.join(process.cwd(), '_AntiGravity_Wymiar');
const MUSIC_DIR       = path.join(process.cwd(), '_AntiGravity_Muzyka');

// Rozszerzenia audio
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.opus'];

// Podstawowe middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());

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
    for (const dir of [ANTIGRAVITY_DIR, MUSIC_DIR]) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (e) {
            console.error(`[Wiesio-Bridge] Błąd tworzenia folderu:`, e);
        }
    }
    console.log(`[Wiesio-Bridge] 📁 Dane:   ${ANTIGRAVITY_DIR}`);
    console.log(`[Wiesio-Bridge] 🎵 Muzyka: ${MUSIC_DIR}`);
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

    // ── Nieobsługiwana akcja ─────────────────────────────────────────
    res.status(400).json({ success: false, message: `Nieobsługiwana akcja: ${action}` });
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