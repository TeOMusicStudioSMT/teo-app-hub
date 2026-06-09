import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// NOWOŚĆ: Moduł do wykonywania komend w terminalu
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BRIDGE: Aby obsłużyć biblioteki CommonJS w środowisku ESM (jak youtube-transcript 1.0.6)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── ARCHIWISTA WIEDZY (KnowledgeGraphService) ────────────────────────────────
import KnowledgeGraphService from './services/KnowledgeGraphService.js';
import MechanicService       from './services/MechanicService.js';
import ImpresarioService     from './services/ImpresarioService.js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import multer from 'multer';

const ffprobePath = ffprobeStatic.path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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
const MUSIC_DIR = path.join(process.cwd(), '_AntiGravity_Muzyka');
const MOVE_DIR = path.join(process.cwd(), '_AntiGravity_Move');
const SONIC_DIR = path.join(process.cwd(), '_AntiGravity_Sonic');
const BUILD_DIR = path.join(process.cwd(), '_AntiGravity_Build');
const AI_DIR = path.join(process.cwd(), '_AntiGravity_AI');
const MODELS_DIR = path.join(AI_DIR, 'models');
const TEMP_DIR = path.join(AI_DIR, 'temp');
const BIN_DIR = path.join(AI_DIR, 'bin');
const WHISPER_EXE = path.join(BIN_DIR, 'whisper-cli.exe');
const COMPONENTS_DIR = path.join(process.cwd(), '_AntiGravity_Components'); // ← NOWOŚĆ od Klaudiusza
const AULA_DIR = path.join(process.cwd(), '_AntiGravity_Aula'); // ← NOWOŚĆ od Suwerena
const RAFINERIA_TEMP_DIR = path.join(process.cwd(), '_temp'); // ← Rafineria: pliki tymczasowe webm/mp4


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
// GET http://127.0.0.1:3001/music/nazwa.mp3  →  stream pliku
app.use('/music', cors({ origin: '*' }), express.static(MUSIC_DIR, {
    setHeaders: (res) => {
        res.setHeader('Accept-Ranges', 'bytes');  // seeking w przeglądarce
        res.setHeader('Cache-Control', 'no-cache');
    }
}));

const moveDir = path.join(__dirname, '_AntiGravity_Move');
app.use('/move', express.static(moveDir));
app.use('/components', express.static(COMPONENTS_DIR));

// Inicjalizacja folderów
async function initializeDimension() {
    for (const dir of [ANTIGRAVITY_DIR, path.join(ANTIGRAVITY_DIR, 'Arcade'), MUSIC_DIR, MOVE_DIR, SONIC_DIR, BUILD_DIR, AI_DIR, MODELS_DIR, TEMP_DIR, BIN_DIR, COMPONENTS_DIR, AULA_DIR, RAFINERIA_TEMP_DIR]) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (e) {
            console.error(`[Wiesio-Bridge] Błąd tworzenia folderu:`, e);
        }
    }


    console.log(`[Wiesio-Bridge] 📁 Dane:   ${ANTIGRAVITY_DIR}`);
    console.log(`[Wiesio-Bridge] 🕹️ Arcade: ${path.join(ANTIGRAVITY_DIR, 'Arcade')}`);
    console.log(`[Wiesio-Bridge] 🎵 Muzyka: ${MUSIC_DIR}`);
    console.log(`[Wiesio-Bridge] 🎬 Filmy:  ${MOVE_DIR}`);
    console.log(`[Wiesio-Bridge] 🔊 Sonic:  ${SONIC_DIR}`);
    console.log(`[Wiesio-Bridge] 🏗  Build:  ${BUILD_DIR}`);
    console.log(`[Wiesio-Bridge] 🎨 Komponenty : ${COMPONENTS_DIR}`);
    console.log(`[Wiesio-Bridge] 🏛️ Aula Budowy: ${AULA_DIR}`);
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

// ── AUTOSYNC LRC (AI) ────────────────────────────────────────────────
app.post('/api/bridge/autosync', async (req, res) => {
    let { audioPath, text, model = 'small' } = req.body;

    if (!audioPath || !text) {
        return res.status(400).json({ success: false, message: 'Brak audioPath lub text' });
    }

    // [DEKODER URL]: Wiesio musi rozumieć fizyczne ścieżki (spacje), a nie %20 z frontendu
    audioPath = decodeURIComponent(audioPath);
    console.log(`[Wiesio-AI] 🔓 Zdekodowano ścieżkę dla Auto-Sync: ${audioPath}`);

    try {
        // 1. Znalezienie fizycznego pliku
        // NAPRAWA URL: obsługujemy localhost, 127.0.0.1 i bare filename (relatywny do muzyki)
        const MUSIC_URL_PATTERNS = [
            'http://127.0.0.1:3001/music/',
            'http://localhost:3001/music/',
        ];
        let resolvedPath = audioPath;
        for (const pattern of MUSIC_URL_PATTERNS) {
            if (resolvedPath.includes(pattern)) {
                resolvedPath = resolvedPath.replace(pattern, '_AntiGravity_Muzyka/');
                break;
            }
        }
        // Jeśli to bare filename (np. "Artysta/Song.mp3") bez prefiksu muzyki — dodaj go
        if (!path.isAbsolute(resolvedPath) && !resolvedPath.startsWith('_AntiGravity_Muzyka') && !resolvedPath.startsWith('http')) {
            resolvedPath = path.join('_AntiGravity_Muzyka', resolvedPath);
        }
        const fullAudioPath = path.isAbsolute(resolvedPath)
            ? resolvedPath
            : path.join(process.cwd(), resolvedPath);

        if (!fsSync.existsSync(fullAudioPath)) {
            console.error(`[Wiesio-AI] ❌ Plik nie istnieje: ${fullAudioPath}`);
            return res.status(404).json({ success: false, message: `Plik audio nie został znaleziony: ${fullAudioPath}` });
        }

        // 2. Przygotowanie Audio (FFmpeg)
        const tempAudioPath = path.join(TEMP_DIR, `whisper_input_${Date.now()}.wav`);
        console.log(`[Wiesio-AI] 🏭 Przygotowuję audio (konwersja do 16kHz)...`);

        // REFAKTORYZACJA: Używamy execFileAsync + Tablica Argumentów (Koniec piekła cudzysłowów!)
        await execFileAsync(ffmpegPath, ['-i', fullAudioPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', tempAudioPath]);

        // 3. Sprawdzenie modelu i silnika
        const modelPath = path.join(MODELS_DIR, `ggml-${model}.bin`);
        if (!fsSync.existsSync(modelPath)) {
            return res.status(400).json({
                success: false,
                message: `Brak modelu: ${model}. Pobierz go do folderu _AntiGravity_AI/models/ jako ggml-${model}.bin`,
                hint: `https://huggingface.co/ggerganov/whisper.cpp/tree/main`
            });
        }

        if (!fsSync.existsSync(WHISPER_EXE)) {
            return res.status(400).json({
                success: false,
                message: "Brak silnika AI (whisper-cli.exe).",
                hint: "Pobierz whisper.cpp binarki i wypakuj do _AntiGravity_AI/bin/."
            });
        }

        // 4. Odpalenie Silnika AI (Whisper.cpp)
        console.log(`[Wiesio-AI] 🤖 Odpalam silnik neuronowy (Whisper.cpp)...`);
        const outputBasePath = path.join(TEMP_DIR, 'whisper_output_' + Date.now());
        const jsonFilePath = outputBasePath + '.json';

        // REFAKTORYZACJA: execFileAsync dla Whispera (Ustawiamy cwd, aby binarka widziała swoje DLLe!)
        try {
            const { stderr } = await execFileAsync(
                WHISPER_EXE,
                ['-m', modelPath, '-f', tempAudioPath, '--output-json-full', '-p', '4', '-l', 'pl', '-of', outputBasePath],
                { cwd: BIN_DIR }
            );
            if (stderr) console.log(`[Wiesio-AI] 🤖 STDERR Whispera:\n${stderr}`);
        } catch (error) {
            console.error("❌ Błąd Fazy 3 (execFile):", error.message);
            console.error("Szczegóły błędu (stderr):", error.stderr || error.message);
            throw new Error(`Silnik AI (whisper.cpp) napotkał problem: ${error.message}`);
        }

        // 5. Odczyt i Parsowanie Wyników AI
        if (!fsSync.existsSync(jsonFilePath)) throw new Error("Silnik AI nie wygenerował pliku wynikowego.");
        const aiOutput = JSON.parse(fsSync.readFileSync(jsonFilePath, 'utf8'));

        // Helper do formatowania czasu LRC: [mm:ss.xx]
        // NAPRAWA NaN: explicit cast + guard przed NaN/Infinity
        const formatLRCTime = (seconds) => {
            const s = Number(seconds);
            if (!Number.isFinite(s) || s < 0) return '[00:00.00]';
            const mins = Math.floor(s / 60);
            const secs = Math.floor(s % 60);
            const ms   = Math.floor((s % 1) * 100);
            return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
        };

        // 6. Algorytm Dopasowania (Wektorowy Aligner)
        // Whisper.cpp w formacie JSON zwraca 'transcription' -> listę segmentów
        const segments = aiOutput.transcription || [];
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const syncedLines = [];

        // Pobieramy wszystkie tokeny/słowa z segmentów
        const allWords = segments.flatMap(seg => seg.tokens || []);

        let lastWordIdx = 0;

        for (const lineText of lines) {
            const lineWords = lineText.toLowerCase().split(/\s+/);
            const firstWord = lineWords[0].replace(/[.,?!]/g, '');

            let foundIdx = -1;
            for (let i = lastWordIdx; i < allWords.length; i++) {
                // Czyścimy tekst tokena z AI (często ma spacje na początku)
                const aiWordText = allWords[i].text.toLowerCase().trim().replace(/[.,?!]/g, '');
                if (aiWordText.includes(firstWord) || firstWord.includes(aiWordText)) {
                    foundIdx = i;
                    break;
                }
            }

            if (foundIdx !== -1) {
                // NAPRAWA NaN: t0 może być undefined gdy token nie ma timestampu — fallback 0
                const startTime = (allWords[foundIdx].t0 ?? 0) / 100; // Whisper.cpp: centysekudy → sekundy
                syncedLines.push({
                    time: startTime,
                    timestamp: formatLRCTime(startTime),
                    text: lineText
                });
                lastWordIdx = foundIdx + 1;
            } else {
                // Fallback: jeśli nie znaleziono dopasowania, dodajemy z czasem ostatniego wersu + mały offset
                const lastTime = syncedLines.length > 0 ? syncedLines[syncedLines.length - 1].time + 1.0 : 0;
                syncedLines.push({
                    time: lastTime,
                    timestamp: formatLRCTime(lastTime),
                    text: `[?] ${lineText}`
                });
            }
        }

        // 7. Finalizacja i Porządki
        try {
            fsSync.unlinkSync(tempAudioPath);
            fsSync.unlinkSync(jsonFilePath);
        } catch (_) { }

        console.log(`[Wiesio-AI] ✅ Synchronizacja zakończona! Zmapowano ${syncedLines.length} linii.`);
        return res.json({ success: true, syncedLines });

    } catch (e) {
        console.error(`[Wiesio-AI] ❌ Błąd Fazy 3:`, e.message);
        return res.status(500).json({ success: false, message: `Błąd AI Faza 3: ${e.message}` });
    }
});



// ── KLUCZ ANTHROPIC (Dla Klaudiusza) ──────────────────────────────────
// Kolejność priorytetów: req.body.apiKey → env → .anthropic_key → kibel_anthropic.txt
async function getAnthropicKey(reqApiKey) {
    if (reqApiKey && reqApiKey.startsWith('sk-ant-')) return reqApiKey;
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    try {
        const key = await fs.readFile(path.join(process.cwd(), '.anthropic_key'), 'utf8');
        const match = key.match(/(sk-ant-[a-zA-Z0-9-_]+)/);
        if (match) return match[1];
    } catch { }
    try {
        const key = await fs.readFile(path.join(ANTIGRAVITY_DIR, 'kibel_anthropic.txt'), 'utf8');
        const match = key.match(/(sk-ant-[a-zA-Z0-9-_]+)/);
        if (match) return match[1];
    } catch { }
    return null;
}

// ── KLUCZ GEMINI (Google) ──────────────────────────────────────────────
// Kolejność priorytetów: req.body.apiKey → env → .gemini_key → kibel_gemini.txt
async function getGeminiKey(reqApiKey) {
    if (reqApiKey && reqApiKey.startsWith('AIza')) return reqApiKey;
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    try {
        const key = await fs.readFile(path.join(process.cwd(), '.gemini_key'), 'utf8');
        const match = key.match(/(AIza[a-zA-Z0-9_-]+)/);
        if (match) return match[1];
    } catch { }
    try {
        const key = await fs.readFile(path.join(ANTIGRAVITY_DIR, 'kibel_gemini.txt'), 'utf8');
        const match = key.match(/(AIza[a-zA-Z0-9_-]+)/);
        if (match) return match[1];
    } catch { }
    return null;
}

// ══════════════════════════════════════════════════════════════════
//  KATEDRA TOOLS — narzędzia dla agentów (prywatny MCP Katedry)
// ══════════════════════════════════════════════════════════════════
const KATEDRA_TOOLS = [
    {
        name: 'list_files',
        description: 'Lista plików w _AntiGravity_Wymiar/',
        input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'read_file',
        description: 'Odczytaj plik z _AntiGravity_Wymiar/',
        input_schema: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] },
    },
    {
        name: 'write_file',
        description: 'Zapisz plik do _AntiGravity_Build/',
        input_schema: { type: 'object', properties: { filename: { type: 'string' }, content: { type: 'string' } }, required: ['filename', 'content'] },
    },
    {
        name: 'list_components',
        description: 'Lista zbudowanych komponentów w _AntiGravity_Components/',
        input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'save_component',
        description: 'Zapisz gotowy komponent React/TSX do biblioteki _AntiGravity_Components/',
        input_schema: {
            type: 'object',
            properties: {
                filename: { type: 'string', description: 'np. PięknyPrzycisk.tsx' },
                content: { type: 'string', description: 'Pełny kod komponentu' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tagi np. ["button","animated","framer-motion"]' },
                description: { type: 'string', description: 'Krótki opis komponentu' },
            },
            required: ['filename', 'content'],
        },
    },
    {
        name: 'ollama_list',
        description: 'Lista lokalnych modeli Ollama',
        input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'ollama_chat',
        description: 'Wyślij prompt do lokalnego modelu Ollama i odbierz odpowiedź',
        input_schema: {
            type: 'object',
            properties: {
                model: { type: 'string' },
                prompt: { type: 'string' },
            },
            required: ['model', 'prompt'],
        },
    },
    {
        name: 'get_playlist',
        description: 'Lista plików muzycznych',
        input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'read_project_structure',
        description: 'Przeskanuj strukturę projektu Vite/React (src/) aby rozumieć istniejący kod',
        input_schema: {
            type: 'object',
            properties: {
                projectPath: { type: 'string', description: 'Ścieżka do projektu, domyślnie cwd' },
            },
            required: [],
        },
    },
];

async function executeTool(toolName, toolInput) {
    console.log(`[Wiesio-Bridge] 🔧 Tool: ${toolName}`, JSON.stringify(toolInput).substring(0, 100));

    switch (toolName) {
        case 'list_files': {
            try {
                const entries = await fs.readdir(ANTIGRAVITY_DIR, { withFileTypes: true });
                return { success: true, files: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
            } catch (e) { return { success: false, error: e.message }; }
        }

        case 'read_file': {
            try {
                const content = await fs.readFile(path.join(ANTIGRAVITY_DIR, toolInput.filename), 'utf8');
                return { success: true, content };
            } catch (e) { return { success: false, error: e.message }; }
        }

        case 'write_file': {
            try {
                const fp = path.join(BUILD_DIR, toolInput.filename);
                await fs.writeFile(fp, toolInput.content, 'utf8');
                return { success: true, path: fp, filename: toolInput.filename };
            } catch (e) { return { success: false, error: e.message }; }
        }

        case 'list_components': {
            try {
                const entries = await fs.readdir(COMPONENTS_DIR, { withFileTypes: true });
                const components = [];
                for (const e of entries) {
                    if (!e.isFile()) continue;
                    const metaFile = path.join(COMPONENTS_DIR, e.name + '.meta.json');
                    let meta = {};
                    try { meta = JSON.parse(await fs.readFile(metaFile, 'utf8')); } catch { }
                    components.push({ filename: e.name, ...meta });
                }
                return { success: true, components, count: components.length };
            } catch (e) { return { success: false, error: e.message }; }
        }

        case 'save_component': {
            try {
                const fp = path.join(COMPONENTS_DIR, toolInput.filename);
                await fs.writeFile(fp, toolInput.content, 'utf8');
                const meta = {
                    filename: toolInput.filename,
                    description: toolInput.description || '',
                    tags: toolInput.tags || [],
                    created: new Date().toISOString(),
                    size: toolInput.content.length,
                };
                await fs.writeFile(fp + '.meta.json', JSON.stringify(meta, null, 2), 'utf8');
                console.log(`[Wiesio-Bridge] 🎨 Komponent zapisany: ${fp}`);
                return { success: true, path: fp, filename: toolInput.filename, meta };
            } catch (e) { return { success: false, error: e.message }; }
        }

        case 'ollama_list': {
            try {
                const { stdout } = await execAsync('ollama list', { timeout: 8000 });
                const models = stdout.trim().split('\n').slice(1).filter(l => l.trim()).map(l => l.trim().split(/\s+/)[0]);
                return { success: true, models };
            } catch (e) { return { success: false, error: 'Ollama offline: ' + e.message }; }
        }

        case 'ollama_chat': {
            try {
                const esc = (toolInput.prompt || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
                const { stdout } = await execAsync(`ollama run ${toolInput.model} "${esc}"`, {
                    timeout: 90000, maxBuffer: 5 * 1024 * 1024, shell: true,
                });
                return { success: true, response: stdout.trim(), model: toolInput.model };
            } catch (e) { return { success: false, error: e.message }; }
        }

        case 'get_playlist': {
            try {
                const entries = await fs.readdir(MUSIC_DIR, { withFileTypes: true });
                const tracks = entries
                    .filter(e => e.isFile() && AUDIO_EXTENSIONS.includes(path.extname(e.name).toLowerCase()))
                    .map(e => e.name);
                return { success: true, tracks, count: tracks.length };
            } catch (e) { return { success: false, error: e.message }; }
        }

        case 'read_project_structure': {
            try {
                const projectPath = toolInput.projectPath || process.cwd();
                const structure = await scanDirectory(projectPath, 3);
                return { success: true, structure, projectPath };
            } catch (e) { return { success: false, error: e.message }; }
        }

        default:
            return { success: false, error: `Nieznane narzędzie: ${toolName}` };
    }
}

async function scanDirectory(dirPath, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth) return '...';
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const result = {};
        for (const entry of entries) {
            if (['node_modules', '.git', 'dist', '.next'].includes(entry.name)) continue;
            if (entry.isDirectory()) {
                result[entry.name + '/'] = await scanDirectory(
                    path.join(dirPath, entry.name), maxDepth, currentDepth + 1
                );
            } else {
                result[entry.name] = null;
            }
        }
        return result;
    } catch { return {}; }
}

// ── /api/ollama — Ollama proxy z SSE streamingiem ──────────────────────
app.post('/api/ollama', async (req, res) => {
    const { messages, system, model = 'gemma4' } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Brak messages' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const ollamaMessages = [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
    ];

    try {
        const resp = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: ollamaMessages, stream: true, options: { num_ctx: 8192 } }),
        });

        if (!resp.ok) {
            sendEvent({ type: 'error', error: `Ollama HTTP ${resp.status} — czy Ollama działa? (ollama serve)` });
            return res.end();
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const chunk = JSON.parse(line);
                    if (chunk.message?.content) {
                        sendEvent({ type: 'text', text: chunk.message.content });
                    }
                    if (chunk.done) {
                        sendEvent({ type: 'done' });
                    }
                } catch { /* pomiń */ }
            }
        }
    } catch (e) {
        sendEvent({ type: 'error', error: `Ollama niedostępna: ${e.message}` });
    }

    res.end();
});

// ── /api/ollama/models — lista dostępnych modeli ────────────────────────
app.get('/api/ollama/models', async (req, res) => {
    try {
        const resp = await fetch('http://localhost:11434/api/tags');
        if (!resp.ok) return res.json({ models: [] });
        const data = await resp.json();
        const models = (data.models || []).map(m => m.name);
        res.json({ models });
    } catch {
        res.json({ models: [] });
    }
});

// ── /api/claude — Claude proxy z pełną pętlą agentyczną ────────────────
app.post('/api/claude', async (req, res) => {
    const { messages, system, model = 'claude-sonnet-4-20250514', useTools = true, apiKey: reqApiKey } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Brak messages' });

    const apiKey = await getAnthropicKey(reqApiKey);
    if (!apiKey) return res.status(401).json({ error: 'Brak klucza Anthropic — dodaj go w TeO Kibel (sk-ant-...)' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        let currentMessages = [...messages];
        let rounds = 0;
        const MAX_ROUNDS = 10;

        while (rounds < MAX_ROUNDS) {
            rounds++;
            const body = {
                model, max_tokens: 8096, stream: true,
                messages: currentMessages,
                ...(system ? { system } : {}),
                ...(useTools ? { tools: KATEDRA_TOOLS } : {}),
            };

            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                sendEvent({ type: 'error', error: err?.error?.message || `HTTP ${resp.status}` });
                break;
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buf = '', fullText = '', toolCalls = [], currentTool = null, stopReason = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (raw === '[DONE]') continue;
                    try {
                        const evt = JSON.parse(raw);
                        if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
                            currentTool = { id: evt.content_block.id, name: evt.content_block.name, input: '' };
                            sendEvent({ type: 'tool_start', tool: evt.content_block.name });
                        }
                        if (evt.type === 'content_block_delta') {
                            if (evt.delta?.type === 'text_delta') {
                                fullText += evt.delta.text;
                                sendEvent({ type: 'text', text: evt.delta.text });
                            }
                            if (evt.delta?.type === 'input_json_delta' && currentTool) {
                                currentTool.input += evt.delta.partial_json;
                            }
                        }
                        if (evt.type === 'content_block_stop' && currentTool) {
                            try { currentTool.input = JSON.parse(currentTool.input || '{}'); } catch { currentTool.input = {}; }
                            toolCalls.push({ ...currentTool });
                            currentTool = null;
                        }
                        if (evt.type === 'message_delta') stopReason = evt.delta?.stop_reason;
                    } catch { }
                }
            }

            if (stopReason === 'tool_use' && toolCalls.length > 0) {
                const assistantContent = [];
                if (fullText) assistantContent.push({ type: 'text', text: fullText });
                toolCalls.forEach(tc => assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }));
                currentMessages.push({ role: 'assistant', content: assistantContent });

                const toolResults = [];
                for (const tc of toolCalls) {
                    sendEvent({ type: 'tool_call', tool: tc.name, input: tc.input });
                    const result = await executeTool(tc.name, tc.input);
                    sendEvent({ type: 'tool_result', tool: tc.name, result });
                    toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(result) });
                }
                currentMessages.push({ role: 'user', content: toolResults });
                toolCalls = [];
                continue;
            }
            sendEvent({ type: 'done', fullText, stopReason });
            break;
        }
    } catch (e) {
        console.error('[Wiesio] Claude proxy error:', e);
        sendEvent({ type: 'error', error: e.message });
    }
    res.end();
});

// ── /api/gemini — Gemini proxy (Google Generative AI) ─────────────────
// SSE format identyczny jak /api/claude: {type:'text'} / {type:'done'} / {type:'error'}
app.post('/api/gemini', async (req, res) => {
    const { messages, system, model = 'gemini-1.5-flash', apiKey: reqApiKey } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Brak messages' });

    const apiKey = await getGeminiKey(reqApiKey);
    if (!apiKey) return res.status(401).json({ error: 'Brak klucza Gemini — dodaj go w TeO Kibel (AIza...)' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        // Konwersja messages → Gemini contents format
        // Gemini wymaga: role 'user'|'model' (nie 'assistant')
        // Obsługuje zarówno content: string JAK I content: parts[] (vision z inlineData)
        const contents = messages.map(m => {
            const role = m.role === 'assistant' ? 'model' : 'user';
            // Jeśli content to tablica parts (obrazy + tekst)
            if (Array.isArray(m.content)) {
                const parts = m.content.map(part => {
                    if (part.inlineData) return part; // gotowy format Gemini
                    if (part.text)       return { text: part.text };
                    // Konwersja z formatu Claude → Gemini
                    if (part.type === 'image' && part.source?.type === 'base64') {
                        return { inlineData: { mimeType: part.source.media_type, data: part.source.data } };
                    }
                    if (part.type === 'text') return { text: part.text || '' };
                    return { text: '' };
                });
                return { role, parts };
            }
            // Zwykły string
            return { role, parts: [{ text: String(m.content || '') }] };
        });

        const body = {
            contents,
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        };

        const geminiModel = model || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

        console.log(`[Wiesio-Gemini] 🔵 ${geminiModel} → streaming...`);

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const msg = err?.error?.message || `Gemini HTTP ${resp.status}`;
            console.error(`[Wiesio-Gemini] ❌ ${msg}`);
            sendEvent({ type: 'error', error: msg });
            return res.end();
        }

        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '', fullText = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === '[DONE]') continue;
                try {
                    const evt = JSON.parse(raw);
                    // Gemini SSE: candidates[0].content.parts[0].text
                    const text = evt?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        fullText += text;
                        sendEvent({ type: 'text', text });
                    }
                    // Sprawdź finishReason
                    const finish = evt?.candidates?.[0]?.finishReason;
                    if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') {
                        console.warn(`[Wiesio-Gemini] finishReason: ${finish}`);
                    }
                } catch { /* skip bad lines */ }
            }
        }

        console.log(`[Wiesio-Gemini] ✅ Done (${fullText.length} znaków)`);
        sendEvent({ type: 'done', fullText });

    } catch (e) {
        console.error('[Wiesio-Gemini] ❌ Proxy error:', e);
        sendEvent({ type: 'error', error: e.message });
    }
    res.end();
});

// ── GŁÓWNY ENDPOINT ──────────────────────────────────────────────────

app.post('/api/bridge/execute', async (req, res) => {
    const payload = req.body;
    // NAPRAWA: action ma wyższy priorytet niż command (command może być pełną komendą shellową)
    const action = payload.action || payload.command;

    // PING (Obsługa Desktopowa i Mobilna)
    if (action === 'PING') {
        console.log(`[Wiesio-Bridge] PING (Mobilny/Desktop)`);
        return res.json({
            success: true,
            status: 'AHOJ',
            message: 'Wiesio gotowy na odbiór mobilny!',
            timestamp: Date.now()
        });
    }

    const { filename, content } = payload;
    console.log(`[Wiesio-Bridge] Akcja: [${action}]`);

    // ── WRITE_FILE ───────────────────────────────────────────────────
    if (action === 'WRITE_FILE') {
        if (!filename || content === undefined || content === null) {
            return res.status(400).json({ success: false, message: 'Brak filename lub content' });
        }
        try {
            // Wyczyść ewentualny prefiks _AntiGravity_Wymiar i leading slash
            const cleanFilename = filename
                .replace(/^[/\\]?_AntiGravity_Wymiar[/\\]/i, '')
                .replace(/^[/\\]/, '');

            // ── ROUTING KATALOGÓW ─────────────────────────────────────
            // Pliki kodu źródłowego aplikacji → rdzeń projektu (__dirname)
            // Notatki, konwersacje, dane       → _AntiGravity_Wymiar
            const SOURCE_PREFIXES = [
                'components/', 'lib/', 'store/', 'styles/',
                'context/', 'hooks/', 'services/', 'pages/',
            ];
            const isSourceCode = SOURCE_PREFIXES.some(p => cleanFilename.startsWith(p));
            const baseDir  = isSourceCode ? __dirname : ANTIGRAVITY_DIR;
            const filePath = path.join(baseDir, cleanFilename);

            console.log(`[Wiesio-Bridge] 📂 WRITE_FILE → ${isSourceCode ? 'SRC' : 'DATA'}: ${filePath}`);

            // Utwórz katalog docelowy (fs = fs/promises, await gwarantuje sekwencję)
            await fs.mkdir(path.dirname(filePath), { recursive: true });

            // Pobieramy kodowanie z payloadu (np. 'base64'), domyślnie 'utf8'
            const encoding = payload.encoding || 'utf8';

            await fs.writeFile(filePath, content, encoding);
            console.log(`[Wiesio-Bridge] ✅ Zmaterializowano: ${filePath}`);
            return res.json({ success: true, message: 'Zmaterializowano.', filePath, timestamp: Date.now() });
        } catch (e) {
            console.error(`[Wiesio-Bridge] ❌ Błąd zapisu:`, e);
            return res.status(500).json({ success: false, message: `Błąd zapisu: ${e.message}` });
        }
    }

    // ── EXTERNAL SKILL: Toobit (Ted The Trader) ───────────────────────
    if (action === 'PLACE_ORDER') {
        console.log(`[Wiesio-API] Wykonuję skill PLACE_ORDER dla pary ${payload.symbol}`);

        // Tutaj docelowo uderzamy do właściwego API Toobit używając zmiennych z procesu:
        // const toobitApiKey = process.env.TOOBIT_API_KEY;
        // const response = await fetch('https://api.toobit.com/api/v1/order', { ... });

        // Symulacja rynkowa dla Suwerena:
        setTimeout(() => {
            console.log(`[Wiesio-API] Zlecenie ${payload.side} na ${payload.quantity} ${payload.symbol} zmaterializowane w Katedrze!`);
        }, 1000);

        return res.json({ success: true, message: `Skutecznie wystawiono zlecenie: ${payload.side} dla ${payload.symbol}!` });
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

    // ── LIST_DIRECTORY (Obsługa _AntiGravity_Wymiar / _AntiGravity_Move) ───────────────────────
    if (action === 'LIST_DIRECTORY') {
        try {
            let scanDir = ANTIGRAVITY_DIR;
            let filterExtensions = null;

            if (payload.target === 'MOVE') {
                scanDir = MOVE_DIR;
                filterExtensions = ['.mp4', '.webm', '.mov'];
            }

            const entries = await fs.readdir(scanDir, { withFileTypes: true });
            let files = await Promise.all(
                entries.map(async (entry) => {
                    const entryPath = path.join(scanDir, entry.name);
                    try {
                        const stats = await fs.stat(entryPath);
                        return {
                            name: entry.name,
                            type: entry.isDirectory() ? 'directory' : 'file',
                            size: entry.isFile() ? stats.size : null,
                            modified: stats.mtime.toISOString(),
                        };
                    } catch (statErr) {
                        return null;
                    }
                })
            );

            // Filtrowanie nulli i rozszerzeń (jeśli dotyczy)
            files = files.filter(f => f !== null);
            if (filterExtensions) {
                files = files.filter(f => {
                    if (f.type === 'directory') return true;
                    const ext = path.extname(f.name).toLowerCase();
                    return filterExtensions.includes(ext);
                });
            }

            console.log(`[Wiesio-Bridge] 📂 Lista ${payload.target || 'Wymiar'} (${files.length} szt.)`);
            return res.json({ success: true, files, directory: scanDir, timestamp: Date.now() });
        } catch (e) {
            return res.status(500).json({ success: false, message: `Błąd skanowania: ${e.message}` });
        }
    }

    // ── LIST_MOVE (Obsługa mobilna _AntiGravity_Move) ──────────────────────
    if (action === 'LIST_MOVE') {
        try {
            const moveFiles = await fs.readdir(moveDir);
            const files = await Promise.all(moveFiles.map(async f => {
                const stat = await fs.stat(path.join(moveDir, f));
                return { name: f, type: stat.isDirectory() ? 'directory' : 'file', size: stat.size };
            }));
            return res.status(200).json({ success: true, message: 'Zeskanowano Wymiar Move', files });
        } catch (e) {
            return res.status(500).json({ success: false, message: `Błąd skanowania Move: ${e.message}` });
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
                    audio_url: `http://127.0.0.1:3001/music/${encodedPath}`,
                    filename: relativePath,
                    image_url: null,
                    duration: 0,
                    tags: 'local · 0.00G',
                };
            });

            console.log(`[Wiesio-Bridge] 🎵 Playlista: ${tracks.length} utworów`);

            return res.json({
                success: true,
                message: `DJ Wiesław przygotował ${tracks.length} utworów.`,
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
                    '-r', '60',                               // Wymuszenie płynności 60 FPS
                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // TARCZA: Wymuszenie parzystości wymiarów!
                    '-y'                                      // ZAKLĘCIE NADPISYWANIA
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

    // ══════════════════════════════════════════════════════════════
    //  ── SZTUCZKA NR 5: OLLAMA_BUILD (TELEPATIA API) ──────────────
    // ══════════════════════════════════════════════════════════════
    if (action === 'OLLAMA_BUILD') {
        const { model, prompt: ollamaPrompt, outfile } = payload;

        if (!model || !ollamaPrompt) {
            return res.status(400).json({ success: false, message: 'Brak model lub prompt' });
        }

        console.log(`[Wiesio-Bridge] 🤖 OLLAMA_BUILD (API): model="${model}" → "${outfile || 'auto'}"`);
        console.log(`[Wiesio-Bridge] 📝 Prompt wysyłany bezpośrednio do API...`);

        try {
            // Omijamy terminal (CMD) całkowicie! Uderzamy prosto do lokalnego mózgu Ollamy.
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: ollamaPrompt,
                    stream: false // Chcemy od razu całą odpowiedź, bez strumieniowania
                })
            });

            if (!response.ok) {
                const errorDetails = await response.text();
                throw new Error(`Ollama odrzuciła zadanie (Status ${response.status}). Szczegóły: ${errorDetails}`);
            }

            const data = await response.json();
            const rawResponse = data.response || '';

            console.log(`[Wiesio-Bridge] ✅ Ollama odpowiedziała przez API (${rawResponse.length} znaków)`);

            // ── Wyciągnij blok kodu z odpowiedzi ──────────────────
            const extractedCode = extractCodeBlock(rawResponse);

            // ── Zapisz do pliku ───────────────────────────────────
            let savedPath = null;
            let savedFilename = outfile;

            if (extractedCode) {
                if (!savedFilename) {
                    const nameMatch = extractedCode.match(/(?:export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)|\/\*\*?\s*@file\s+(\S+))/);
                    const detectedName = nameMatch?.[1] || nameMatch?.[2];
                    const ext = detectExtension(rawResponse);
                    savedFilename = detectedName ? `${detectedName}${ext}` : `ollama_build_${Date.now()}${ext}`;
                }

                savedPath = path.join(BUILD_DIR, savedFilename);
                await fs.writeFile(savedPath, extractedCode, 'utf8');
                console.log(`[Wiesio-Bridge] 💾 Zapisano kod: ${savedPath}`);
            } else {
                savedFilename = outfile || `ollama_response_${Date.now()}.txt`;
                savedPath = path.join(BUILD_DIR, savedFilename);
                await fs.writeFile(savedPath, rawResponse, 'utf8');
                console.log(`[Wiesio-Bridge] 📄 Zapisano odpowiedź tekstową: ${savedPath}`);
            }

            return res.json({
                success: true,
                message: extractedCode ? `Wiesław zmaterializował kod: ${savedFilename}` : `Wiesław zapisał odpowiedź: ${savedFilename}`,
                model,
                filename: savedFilename,
                filePath: savedPath,
                code: extractedCode || null,
                rawResponse: rawResponse.substring(0, 2000),
                hasCode: !!extractedCode,
                codeLength: extractedCode?.length || 0,
                timestamp: Date.now(),
            });

        } catch (e) {
            console.error(`[Wiesio-Bridge] ❌ OLLAMA_BUILD API error:`, e.message);
            return res.status(500).json({
                success: false,
                message: `Krytyczny błąd mózgu (API): ${e.message}`,
                hint: 'Upewnij się, że Ollama działa w tle (ikona lamy w zasobniku systemowym).',
                timestamp: Date.now(),
            });
        }
    }

    // ── OLLAMA_LIST — lista dostępnych modeli ────────────────────
    if (action === 'OLLAMA_LIST') {
        try {
            const { stdout } = await execFileAsync('ollama', ['list'], { timeout: 10000 });
            const lines = stdout.trim().split('\n').slice(1);
            const models = lines
                .filter(l => l.trim())
                .map(l => {
                    const parts = l.trim().split(/\s+/);
                    return { name: parts[0], id: parts[1], size: parts[2], modified: parts.slice(3).join(' ') };
                });
            console.log(`[Wiesio-Bridge] 🤖 Dostępne modele: ${models.length}`);
            return res.json({ success: true, models, timestamp: Date.now() });
        } catch (e) {
            return res.status(500).json({ success: false, message: `Błąd ollama list: ${e.message}`, hint: 'Czy Ollama jest uruchomiona?' });
        }
    }

    // ── OLLAMA_CHAT — szybkie zapytanie bez zapisu ───────────────
    if (action === 'OLLAMA_CHAT') {
        const { model, prompt: chatPrompt, timeout: timeoutMs = 60000 } = payload;
        if (!model || !chatPrompt) return res.status(400).json({ success: false, message: 'Brak model lub prompt' });

        try {
            const { stdout } = await execFileAsync('ollama', ['run', model, chatPrompt], {
                timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024
            });
            console.log(`[Wiesio-Bridge] 💬 OLLAMA_CHAT: ${stdout.length} znaków`);
            return res.json({ success: true, response: stdout.trim(), model, timestamp: Date.now() });
        } catch (e) {
            return res.status(500).json({ success: false, message: `Błąd OLLAMA_CHAT: ${e.message}` });
        }
    }

    // ── EGZEKUCJA LOKALNEGO LLM PRZEZ CLI ─────────────────────────────
    if (action === 'EXEC_OLLAMA_CLI') {
        const prompt = payload.prompt;
        if (!prompt) return res.status(400).json({ error: 'Brak promptu' });
        const modelToUseCLI = payload.modelName || 'gemma4';
        console.log(`[Wiesio-Mózg] 🧠 Przekazuję myśl do modelu ${modelToUseCLI} (CLI): "${prompt.substring(0, 30)}..."`);

        execFile('ollama', ['run', modelToUseCLI, prompt], { maxBuffer: 1024 * 1024 * 10, encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Wiesio-Mózg] ❌ Błąd wywołania Ollamy z CLI: ${error.message}`);
                return res.status(500).json({ error: error.message, details: stderr });
            }
            // Ignorujemy standardowe logi ładowania Ollamy w stderr, szukamy tylko słowa "Error"
            if (stderr && stderr.toLowerCase().includes('error')) {
                console.error(`[Wiesio-Mózg] ❌ Błąd z terminala: ${stderr}`);
            }
            console.log(`[Wiesio-Mózg] ✨ Lokalny LLM (CLI) odpowiedział!`);
            return res.json({ success: true, response: stdout.trim() });
        });
        return; // Zakończ, odpowiedź wyślemy w callback
    }

    // ── POBIERANIE MODELI W TLE ─────────────────────────────────────
    if (action === 'PULL_MODEL') {
        const modelToPull = payload.modelName;
        if (!modelToPull) return res.status(400).json({ error: 'Brak nazwy modelu (modelName).' });

        console.log(`[Wiesio-Inżynier] ⬇️ Pobieram model z sieci: ${modelToPull}... (Proces w tle)`);

        // Puszczamy asynchronicznie, by nie zablokować Katedry
        execFile('ollama', ['pull', modelToPull], (error, stdout, stderr) => {
            if (error) {
                console.error(`[Wiesio-Inżynier] ❌ Błąd pobierania ${modelToPull}: ${error.message}`);
            } else {
                console.log(`[Wiesio-Inżynier] ✅ Model ${modelToPull} pobrany i gotowy do pracy!`);
            }
        });

        return res.json({ success: true, message: `Rozpoczęto pobieranie ${modelToPull}. Sprawdź czarną konsolę Wiesia.` });
    }

    // ── TWORZENIE FIZYCZNYCH KOMPONENTÓW Z PLANU RADY ─────────────────────
    if (action === 'CREATE_COMPONENT') {
        const compName = payload.fileName || payload.componentName;
        const instructions = payload.instructions || payload.content || payload.code;

        if (!compName || !instructions) {
            return res.status(400).json({ error: 'Brak nazwy pliku (fileName) lub kodu (instructions).' });
        }

        // Określamy ścieżkę zapisu bezpośrednio w components/special/ (BEZ src, projekt tak funkcjonuje)
        const newFilePath = path.join(process.cwd(), 'components', 'special', compName);

        try {
            await fs.mkdir(path.dirname(newFilePath), { recursive: true });

            // Zapisujemy fizycznie plik
            await fs.writeFile(newFilePath, instructions, 'utf8');

            console.log(`[Wiesio-Kowal] 🔨 Zmaterializowano nowy moduł: ${compName} w ${newFilePath}`);
            return res.json({ success: true, message: `Utworzono i zapisano ${compName}!` });
        } catch (err) {
            console.error(`[Wiesio-Kowal] ❌ Błąd rzeźbienia pliku: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
    }

    // ── NOWOŚĆ: EGZEKUCJA CZYSTYCH KOMEND W TERMINALU ───────────────
    if (action === 'EXEC_COMMAND') {
        const cmd = payload.command;
        if (!cmd) return res.status(400).json({ error: 'Brak komendy' });

        console.log(`[Wiesio-Terminal] 💻 Wykonuję komendę: ${cmd}`);

        exec(cmd, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Wiesio-Terminal] ❌ Błąd: ${error.message}`);
                return res.status(500).json({ error: error.message, details: stderr });
            }
            return res.json({ success: true, output: stdout || stderr });
        });
        return;
    }

    // ── NOWOŚĆ: WYCIĄGANIE TREŚCI ZE STRON (W.I.D.O.K. Crawler) ──────
    if (action === 'FETCH_URL_CONTENT') {
        const targetUrl = payload.url;
        if (!targetUrl) return res.status(400).json({ error: 'Brak URL' });

        console.log(`[Wiesio-Sieciarz] 🕸️ Wyrzucam sieć na: ${targetUrl}`);

        try {
            // Jeśli to YouTube, wyciągamy transkrypt
            if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
                console.log(`[Wiesio-Sieciarz] 📺 Wykryto YouTube. Dekodowanie linku...`);
                try {
                    const { YoutubeTranscript } = require('youtube-transcript');

                    // NIEZAWODNY EKSTRAKTOR ID (obsługuje standard, youtu.be oraz shorts)
                    const videoIdMatch = targetUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);

                    // Jeśli znajdzie ID (11 znaków), używa go. Jak nie, próbuje całym URLem ratunkowo.
                    const finalTarget = videoIdMatch ? videoIdMatch[1] : targetUrl;
                    console.log(`[Wiesio-Sieciarz] 🔍 Wyizolowano ID: ${finalTarget}`);

                    const transcript = await YoutubeTranscript.fetchTranscript(finalTarget);
                    if (!transcript || transcript.length === 0) throw new Error("Brak napisów nałożonych na film.");

                    let ytText = transcript.map(t => t.text).join(' ');
                    // Zabezpieczenie RAM
                    if (ytText.length > 15000) ytText = ytText.substring(0, 15000) + '... [Ucięto resztę, materiał zbyt długi]';

                    console.log(`[Wiesio-Sieciarz] ✅ Zassano transkrypt YT!`);
                    return res.json({ success: true, text: ytText });
                } catch (ytErr) {
                    console.error(`[Wiesio-Sieciarz] ❌ Błąd YT: ${ytErr.message}`);

                    // Tłumaczenie błędu dla Suwerena
                    let humanError = ytErr.message;
                    if (humanError.includes("Could not find captions") || humanError.includes("Brak napisów")) {
                        humanError = "Ten film fizycznie nie posiada wbudowanych napisów (CC). Wciągarka nie ma z czego czytać.";
                    }

                    return res.status(500).json({ error: humanError });
                }
            }            // Jeśli to zwykła strona (np. GitHub, artykuł)
            else {
                const { default: axios } = await import('axios');
                const cheerio = await import('cheerio');

                const response = await axios.get(targetUrl);
                const $ = cheerio.load(response.data);

                $('script, style, nav, footer, header, noscript, svg').remove();
                let rawText = $('body').text().replace(/\s+/g, ' ').trim();

                if (rawText.length > 15000) {
                    rawText = rawText.substring(0, 15000) + '... [Ucięto z powodu długości]';
                }

                console.log(`[Wiesio-Sieciarz] ✅ Zebrano ze strony.`);
                return res.json({ success: true, text: rawText });
            }
        } catch (err) {
            console.error(`[Wiesio-Sieciarz] ❌ Błąd pobierania: ${err.message}`);
            return res.status(500).json({ error: 'Nie udało się pobrać treści. ' + err.message });
        }
    }

    // ── 2. KUŹNIA AGENTÓW (Ollama Modelfile) ──────
    if (action === 'CREATE_CUSTOM_MODEL') {
        const { baseModel, newModelName, systemPrompt } = payload;
        if (!baseModel || !newModelName || !systemPrompt) return res.status(400).json({ error: 'Brak danych do kucia' });

        console.log(`[Wiesio-Kowal] 🔨 Kuję model: ${newModelName} na bazie ${baseModel}`);

        // Formatujemy prompt systemowy dla Ollamy
        const modelfileContent = `FROM ${baseModel}\nSYSTEM """\n${systemPrompt}\n"""\n`;
        const modelfilePath = path.join(process.cwd(), `Modelfile_${Date.now()}`);

        try {
            fsSync.writeFileSync(modelfilePath, modelfileContent, 'utf8');

            // Odpalamy komendę ollama create (execFile dla bezpieczeństwa ścieżek)
            execFile('ollama', ['create', newModelName, '-f', modelfilePath], (error, stdout, stderr) => {
                try { if (fsSync.existsSync(modelfilePath)) fsSync.unlinkSync(modelfilePath); } catch (_) { }
                if (error) {
                    console.error(`[Wiesio-Kowal] ❌ Błąd kucia: ${error.message}`);
                } else {
                    console.log(`[Wiesio-Kowal] ✅ Narodziny nowego bytu: ${newModelName}!`);
                }
            });
            return res.json({ success: true, message: `Rozpoczęto kucie ${newModelName} w tle. Zajrzyj do konsoli Wiesia.` });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // --- NOWE SKILLE (Superpowers) ---

    // 1. ODCZYT DOWOLNEGO PLIKU Z DYSKU (Skill: FILE)
    if (action === 'READ_FILE_CONTENT') {
        const filePath = payload.path;
        if (!filePath) return res.status(400).json({ error: 'Brak ścieżki do pliku (path).' });

        console.log(`[Wiesio-Skill] 📄 Odczytuję plik: ${filePath}`);
        try {
            // Podstawowe zabezpieczenie - czy plik istnieje
            if (!fsSync.existsSync(filePath)) {
                return res.status(404).json({ error: `Plik nie istnieje pod ścieżką: ${filePath}` });
            }
            const content = fsSync.readFileSync(filePath, 'utf8');
            // Zabezpieczenie przed gigantycznymi plikami
            const safeContent = content.length > 20000 ? content.substring(0, 20000) + '\n... [Ucięto ze względu na rozmiar]' : content;
            return res.json({ success: true, content: safeContent });
        } catch (err) {
            return res.status(500).json({ error: `Błąd odczytu pliku: ${err.message}` });
        }
    }

    // 2. TWORZENIE KATALOGU (Skill: DIR)
    if (action === 'CREATE_DIRECTORY') {
        const dirPath = payload.path;
        if (!dirPath) return res.status(400).json({ error: 'Brak ścieżki katalogu (path).' });

        console.log(`[Wiesio-Skill] 📁 Tworzę katalog: ${dirPath}`);
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return res.json({ success: true, message: `Katalog utworzony: ${dirPath}` });
        } catch (err) {
            return res.status(500).json({ error: `Błąd tworzenia katalogu: ${err.message}` });
        }
    }

    // 3. WYSZUKIWANIE W SIECI (Skill: SEARCH)
    if (action === 'WEB_SEARCH') {
        const query = payload.query;
        if (!query) return res.status(400).json({ error: 'Brak zapytania (query).' });

        console.log(`[Wiesio-Sieciarz] 🔍 Przeszukuję sieć: "${query}"`);
        try {
            const { default: axios } = await import('axios');
            const cheerio = await import('cheerio');

            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Katedra 0.00G' }
            });

            const $ = cheerio.load(response.data);
            let results = [];

            $('.result__body').each((i, el) => {
                if (i < 5) { // Bierzemy top 5 wyników
                    const title = $(el).find('.result__title').text().trim();
                    const snippet = $(el).find('.result__snippet').text().trim();
                    const link = $(el).find('.result__url').text().trim();
                    if (title && snippet) results.push(`[${i + 1}] ${title}\nURL: ${link}\nOpis: ${snippet}\n`);
                }
            });

            if (results.length === 0) return res.json({ success: true, content: "Nie znaleziono wyników w sieci." });

            const finalOutput = `Wyniki z Pajęczyny Świata:\n\n${results.join('\n')}`;
            return res.json({ success: true, content: finalOutput });

        } catch (err) {
            console.error(`[Wiesio-Sieciarz] ❌ Błąd szukacza: ${err.message}`);
            return res.status(500).json({ error: `Błąd sieci Web: ${err.message}` });
        }
    }

    // 4. ZAPIS PLIKU Z BEZPIECZNIKIEM (Skill: WRITE)
    if (action === 'WRITE_FILE_CONTENT') {
        const writePath = payload.path;
        const writeData = payload.content;

        if (!writePath || !writeData) return res.status(400).json({ error: 'Brak ścieżki (path) lub treści (content).' });

        console.log(`[Wiesio-Skill] 💾 Inicjacja Taśmociągu zapisu dla: ${writePath}`);
        try {
            // Upewniamy się, że folder docelowy istnieje
            fsSync.mkdirSync(path.dirname(writePath), { recursive: true });

            // BEZPIECZNIK SUWERENA: Jeśli plik już istnieje, robimy "klatkę obok" (Kopia Zapasowa)
            if (fsSync.existsSync(writePath)) {
                const backupPath = `${writePath}.bak`;
                fsSync.copyFileSync(writePath, backupPath);
                console.log(`[Wiesio-Skill] 🛡️ Utworzono kopię zapasową: ${backupPath}`);
            }

            // Wdrażamy nową materię
            fsSync.writeFileSync(writePath, writeData, 'utf8');

            return res.json({ success: true, message: `Materia wdrożona! (Kopia zapasowa .bak zabezpieczona). Ścieżka: ${writePath}` });
        } catch (err) {
            return res.status(500).json({ error: `Błąd Taśmociągu zapisu: ${err.message}` });
        }
    }

    // 5. ODCZYT STRUKTURY KATALOGU (Skill: READ_DIR)
    if (action === 'READ_DIR') {
        const dirToRead = payload.path;
        if (!dirToRead) return res.status(400).json({ error: 'Brak ścieżki (path).' });

        console.log(`[Wiesio-Skill] 👁️ Skanuję archiwum: ${dirToRead}`);
        try {
            if (!fsSync.existsSync(dirToRead)) {
                return res.status(404).json({ error: `Katalog nie istnieje: ${dirToRead}` });
            }

            const stat = fsSync.statSync(dirToRead);
            if (!stat.isDirectory()) {
                return res.status(400).json({ error: `Podana ścieżka nie jest katalogiem: ${dirToRead}` });
            }

            // Pobieramy listę elementów
            const items = fsSync.readdirSync(dirToRead, { withFileTypes: true });
            const formattedItems = items.map(item => {
                const fullPath = path.join(dirToRead, item.name);
                try {
                    const itemStat = fsSync.statSync(fullPath);
                    return {
                        name: item.name,
                        path: fullPath,
                        isDirectory: item.isDirectory(),
                        size: itemStat.size,
                        modified: itemStat.mtime
                    };
                } catch (e) {
                    // Pomijamy pliki bez uprawnień systemowych
                    return null;
                }
            }).filter(i => i !== null);

            // Sortowanie: Foldery zawsze na górze, potem alfabetycznie
            formattedItems.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

            return res.json({ success: true, items: formattedItems, currentPath: dirToRead });
        } catch (err) {
            return res.status(500).json({ error: `Błąd skanowania katalogu: ${err.message}` });
        }
    }

    // --- WYKONYWANIE KOMEND SYSTEMOWYCH (Skill: CMD) ---
    if (action === 'EXEC_SYSTEM_CMD') {
        let cmd = payload.command;
        if (!cmd) return res.status(400).json({ error: 'Brak komendy.' });

        console.log(`[Wiesio-Term] ⚡ Odpalam skrypt: ${cmd}`);

        // Wymuszamy uruchomienie przez PowerShell, co rozwiązuje problemy z uciekającymi znakami
        const execOptions = {
            cwd: process.cwd(),
            shell: 'powershell.exe'
        };

        exec(cmd, execOptions, (error, stdout, stderr) => {
            if (error) {
                // Jeśli to tylko ostrzeżenie na stderr (np. npm warn), a jest też stdout, to przepuszczamy
                if (stdout && !error.message.includes('Command failed')) {
                    console.log(`[Wiesio-Term] ⚠️ Skrypt wykonany z ostrzeżeniami.`);
                    return res.json({ success: true, content: stdout + (stderr ? `\n[Ostrzeżenia]: ${stderr}` : '') });
                }
                console.error(`[Wiesio-Term] ❌ Błąd skryptu: ${error.message}`);
                return res.status(500).json({ error: error.message || stderr });
            }
            console.log(`[Wiesio-Term] ✅ Skrypt wykonany pomyślnie.`);
            return res.json({ success: true, content: stdout || "[Brak zwrotu w konsoli - komenda wykonana w tle]" });
        });
        return;
    }

    // ── CONCATENATE_VIDEO (Sklejanie Klocków) ────────────────────────
    if (action === 'CONCATENATE_VIDEO') {
        const { type, mainVideoFilename, outputFilename } = payload;

        if (!type || !mainVideoFilename) {
            return res.status(400).json({ success: false, message: 'Brak type lub mainVideoFilename' });
        }

        console.log(`[Wiesio-Spawacz] 🎬 Sklejanie klocków. Typ: ${type}, Plik: ${mainVideoFilename}`);

        try {
            // Mapowanie typu na folder
            let klockiSubDir = type;
            if (type === 'YT') klockiSubDir = 'Klocki do YT';
            if (type === 'Podcat') klockiSubDir = 'Klocki do Podcatów';
            if (type === 'Kronika') klockiSubDir = 'Klocki do Kronik';

            const klockiDir = path.join(process.cwd(), '_AntyGravity Klocki', klockiSubDir);
            const mainVideoPath = path.join(MOVE_DIR, mainVideoFilename);

            if (!fsSync.existsSync(mainVideoPath)) {
                return res.status(404).json({ success: false, message: `Nie znaleziono głównego pliku wideo: ${mainVideoPath}` });
            }

            const getVideosFromDir = (dir) => {
                if (!fsSync.existsSync(dir)) return [];
                return fsSync.readdirSync(dir)
                    .filter(f => {
                        const lower = f.toLowerCase();
                        return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
                    })
                    .map(f => path.join(dir, f));
            };

            const introVideos = getVideosFromDir(path.join(klockiDir, 'Start'));
            const addVideos = getVideosFromDir(path.join(klockiDir, 'Adds'));
            const outroVideos = getVideosFromDir(path.join(klockiDir, 'End'));

            const toPosix = (p) => p.replace(/\\/g, '/');
            let concatLines = [];

            // 1. INTRAs (Start)
            introVideos.forEach(v => concatLines.push(`file '${toPosix(v)}'`));

            // 2. ADDs (Sponsorships/Inserts)
            addVideos.forEach(v => concatLines.push(`file '${toPosix(v)}'`));

            // 3. MAIN VIDEO
            concatLines.push(`file '${toPosix(mainVideoPath)}'`);

            // 4. OUTRAs (End)
            outroVideos.forEach(v => concatLines.push(`file '${toPosix(v)}'`));

            if (introVideos.length === 0 && addVideos.length === 0 && outroVideos.length === 0) {
                console.warn(`[Wiesio-Spawacz] ⚠️ Ostrzeżenie: Brak dodatkowych klocków (Start/Adds/End) w ${klockiDir}.`);
            }

            const concatTxtPath = path.join(MOVE_DIR, `concat_${Date.now()}.txt`);
            await fs.writeFile(concatTxtPath, concatLines.join('\n'), 'utf8');

            const finalOutputName = outputFilename || `CONCAT_${mainVideoFilename}`;
            const outputPath = path.join(BUILD_DIR, finalOutputName);

            console.log(`[Wiesio-Spawacz] 📄 Utworzono mapę klocków:\n${concatLines.join('\n')}`);
            console.log(`[Wiesio-Spawacz] 🔨 Odpalam FFmpeg... Cel: ${outputPath}`);

            // REFAKTORYZACJA: execFileAsync dla FFmpeg Concatenator
            // Zamiast kopiowania, wymuszamy nowy render (ujednolici to FPS, bazę czasu i ścieżki)
            await execFileAsync(ffmpegPath, [
                '-f', 'concat',
                '-safe', '0',
                '-i', concatTxtPath,
                '-c:v', 'libx264',    // nowy, uniwersalny kodek wideo
                '-preset', 'fast',   // szybkość spawania
                '-c:a', 'aac',       // jednolity kodek audio
                '-b:a', '192k',      // stały bitrate audio
                '-vsync', '2',       // zapobiega zacinaniu klatek
                '-async', '1',       // wymusza synchronizację audio do wideo
                '-y',
                outputPath
            ], { timeout: 0, maxBuffer: 1024 * 1024 * 500 });

            try { await fs.unlink(concatTxtPath); } catch (e) { }
            console.log(`[Wiesio-Spawacz] ✨ Magia dokonana. Posprzątano.`);

            return res.json({
                success: true,
                message: 'Sklejanie zakończone sukcesem!',
                outputFile: finalOutputName,
                outputPath: outputPath
            });

        } catch (err) {
            console.error(`[Wiesio-Spawacz] ❌ Błąd sklejania:`, err);
            return res.status(500).json({ success: false, message: `Błąd sklejania klocków: ${err.message}` });
        }
    }

    // ── EXEC_SYSTEM (Raw Terminal) — przeniesione z /wiesio/action ──────────
    if (action === 'EXEC_SYSTEM') {
        // Obsługa Uniwersalnej Paczki: command może być w body.command LUB body.payload.command
        const command = payload.command || payload.payload?.command;
        const timeout  = payload.timeout || payload.payload?.timeout || 300000;
        if (!command) return res.status(400).json({ success: false, message: 'Brak komendy (sprawdź body.command lub body.payload.command)' });

        console.log(`[Wiesio-Bridge] ⚡ EXEC_SYSTEM: ${command.substring(0, 80)}...`);

        // ── SMART INTERCEPT: `ollama run <model> "prompt"` → HTTP API ──────
        // Powód: PowerShell/cmd nie radzi sobie z długimi promptami w cudzysłowach.
        // Rozwiązanie: przechwytujemy komendę i wysyłamy przez HTTP zamiast shell.
        const ollamaRunMatch = command.match(
            /^ollama\s+run\s+([^\s"']+)\s+(?:"([\s\S]*?)"|'([\s\S]*?)'|([\s\S]+))\s*$/s
        );
        if (ollamaRunMatch) {
            const ollamaModel  = ollamaRunMatch[1];
            const ollamaPrompt = (ollamaRunMatch[2] || ollamaRunMatch[3] || ollamaRunMatch[4] || '')
                .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
            console.log(`[Wiesio-Bridge] 🧠 ollama run → HTTP API (model: ${ollamaModel}, prompt: ${ollamaPrompt.substring(0,60)}...)`);
            try {
                const ollamaResp = await fetch('http://127.0.0.1:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: ollamaModel, prompt: ollamaPrompt, stream: false }),
                    signal: AbortSignal.timeout(timeout),
                });
                if (!ollamaResp.ok) throw new Error(`Ollama HTTP ${ollamaResp.status}`);
                const ollamaData = await ollamaResp.json();
                const output = ollamaData.response || '[Ollama: brak odpowiedzi]';
                console.log(`[Wiesio-Bridge] ✅ ollama HTTP (${output.length} znaków)`);
                return res.json({ success: true, response: output, timestamp: Date.now() });
            } catch (ollamaErr) {
                console.warn(`[Wiesio-Bridge] ⚠️ ollama HTTP intercept failed: ${ollamaErr.message}, fallback do exec`);
                // Fall through — spróbuj normalnym exec
            }
        }

        // ── Normalne wykonanie shell ──────────────────────────────────────
        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout, maxBuffer: 50 * 1024 * 1024, shell: true,
            });
            const output = stdout.trim() || stderr.trim() || '[Komenda wykonana — brak wyjścia]';
            console.log(`[Wiesio-Bridge] ✅ Wynik (${output.length} znaków): ${output.substring(0, 100)}`);
            return res.json({ success: true, response: output, timestamp: Date.now() });
        } catch (e) {
            const errOut = e.stdout?.trim() || e.stderr?.trim() || e.message;
            console.error(`[Wiesio-Bridge] ❌ Błąd EXEC_SYSTEM: ${errOut}`);
            return res.status(500).json({ success: false, message: `Błąd powłoki: ${errOut}` });
        }
    }

    // ── Nieobsługiwana akcja (Gniazdo Fallback) ──────────────────────────
    return res.status(200).json({ message: `Wiesio usłyszał komendę: ${action}, ale jeszcze nie umie jej wykonać z tego poziomu!` });
});

// ══════════════════════════════════════════════════════════════════
//  HELPERS — wyciąganie kodu z odpowiedzi modelu
// ══════════════════════════════════════════════════════════════════

/**
 * Wyciąga pierwszy blok kodu z odpowiedzi Ollamy.
 * Obsługuje: ```tsx, ```ts, ```jsx, ```js, ```html, ```css, ```python, ``` (bez języka)
 */
function extractCodeBlock(text) {
    if (!text) return null;
    const patterns = [
        /```(?:tsx|typescript react)\s*\n([\s\S]*?)```/i,
        /```(?:ts|typescript)\s*\n([\s\S]*?)```/i,
        /```(?:jsx)\s*\n([\s\S]*?)```/i,
        /```(?:js|javascript)\s*\n([\s\S]*?)```/i,
        /```(?:html)\s*\n([\s\S]*?)```/i,
        /```(?:css)\s*\n([\s\S]*?)```/i,
        /```(?:python|py)\s*\n([\s\S]*?)```/i,
        /```\s*\n([\s\S]*?)```/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]?.trim()) {
            return match[1].trim();
        }
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ') ||
        trimmed.startsWith('const ') || trimmed.startsWith('function ') ||
        trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
        return trimmed;
    }

    return null;
}

/**
 * Wykrywa rozszerzenie pliku na podstawie treści odpowiedzi.
 */
function detectExtension(text) {
    if (!text) return '.txt';
    const lower = text.toLowerCase();
    if (lower.includes('```tsx') || lower.includes('react') || lower.includes('jsx')) return '.tsx';
    if (lower.includes('```ts') || lower.includes('typescript')) return '.ts';
    if (lower.includes('```html') || lower.includes('<!doctype')) return '.html';
    if (lower.includes('```css')) return '.css';
    if (lower.includes('```python') || lower.includes('def ') || lower.includes('import sys')) return '.py';
    if (lower.includes('```js') || lower.includes('javascript')) return '.js';
    return '.txt';
}

app.get('/wiesio/ping', (req, res) => {
    res.status(200).json({ status: 'alive', message: 'Wiesław czuwa! Rury drożne!' });
});

/**
 * 🛰️ Dedykowany endpoint dla akcji Wiesława (w tym PodCaT)
 * Służy do cichej komunikacji z frontendem bez barier CORS.
 */
app.post('/wiesio/action', async (req, res) => {
    const { action, payload } = req.body;

    if (action === 'ZESPAWAJ_PODCAT') {
        const moveDir = path.join(__dirname, '_AntiGravity_Move');

        // 1. SZUKAMY NAJNOWSZEGO GŁÓWNEGO WIDEO
        if (!fsSync.existsSync(moveDir)) {
            return res.status(404).json({ error: 'Folder _AntiGravity_Move nie istnieje!' });
        }

        const videos = fsSync.readdirSync(moveDir)
            .filter(f => f.endsWith('.mp4') && !f.includes('FINAL'))
            .sort((a, b) => {
                return fsSync.statSync(path.join(moveDir, b)).mtime.getTime() - fsSync.statSync(path.join(moveDir, a)).mtime.getTime();
            });

        if (videos.length === 0) return res.status(404).json({ error: 'Brak surowego wideo w _AntiGravity_Move' });
        const mainVideo = path.join(moveDir, videos[0]);

        // 2. SONAR WIBRACYJNY (Rozpoznawanie PodCaT vs Muzyka)
        const mainVideoName = videos[0].toLowerCase();
        let klockiSubDir = 'Klocki do Podcatów'; // Wartość domyślna

        if (mainVideoName.includes('muzyka') || mainVideoName.includes('music') || mainVideoName.includes('teo_music')) {
            klockiSubDir = 'Klocki do Muzyki';
            console.log(`[Wiesio-Sonar] 🎵 Wykryto wibrację Muzyczną! Przełączam tory na: ${klockiSubDir}`);
        } else {
            console.log(`[Wiesio-Sonar] 🎙️ Wykryto wibrację Słowa! Przełączam tory na: ${klockiSubDir}`);
        }

        const klockiDir = path.join(__dirname, '_AntyGravity Klocki', klockiSubDir);

        // 3. MATEMATYKA WYMIARU 0.00G (Obliczanie 28-dniowego cyklu od 1 kwietnia)
        const now = new Date();
        let april1 = new Date(now.getFullYear(), 3, 1); // 3 = Kwiecień (0-indexed)
        if (now < april1) april1.setFullYear(april1.getFullYear() - 1);
        const diffDays = Math.floor((now - april1) / (1000 * 60 * 60 * 24));
        let cycle = Math.floor(diffDays / 28) + 1;
        if (cycle > 13) cycle = 13;
        if (cycle < 1) cycle = 1;

        // 4. KOMPLETOWANIE KLOCKÓW (Z Wszechwidzącą Soczewką)
        const startDir = path.join(klockiDir, 'Start');
        const endDir = path.join(klockiDir, 'End');
        const cycleDir = path.join(klockiDir, 'start13vers');

        const getFirstMp4 = (dir, name) => {
            if (!fsSync.existsSync(dir)) {
                console.log(`[Wiesio-Archiwista] ⚠ Folder ${name} nie istnieje pod adresem: ${dir}`);
                return null;
            }
            const files = fsSync.readdirSync(dir).filter(f => {
                const lower = f.toLowerCase();
                return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.webm');
            });

            if (files.length === 0) {
                console.log(`[Wiesio-Archiwista] ⚠ Folder ${name} jest pusty (lub plik ma zły format)!`);
                return null;
            }
            console.log(`[Wiesio-Archiwista] 👁️ Znalazłem klocek w folderze ${name}: ${files[0]}`);
            return path.join(dir, files[0]);
        };

        const startVideo = getFirstMp4(startDir, 'Start');
        const endVideo = getFirstMp4(endDir, 'End');

        // (Logika dla cycleFiles uodporniona na wielkość liter)
        const cycleFiles = fsSync.existsSync(cycleDir)
            ? fsSync.readdirSync(cycleDir).filter(f => f.includes(cycle.toString()) && f.toLowerCase().endsWith('.mp4'))
            : [];
        const cycleVideo = cycleFiles.length > 0 ? path.join(cycleDir, cycleFiles[0]) : null;
        if (cycleVideo) console.log(`[Wiesio-Archiwista] 👁️ Znalazłem klocek Cyklu: ${cycleFiles[0]}`);

        const outputFile = path.join(moveDir, `FINAL_${videos[0]}`);

        console.log(`[Wiesio-Spawacz] 🧱 Kompletuję Klocki. Cykl: ${cycle}`);
        console.log(`[Wiesio-Spawacz] 🔄 Start: ${startVideo ? 'TAK' : 'BRAK'}`);
        console.log(`[Wiesio-Spawacz] 🔄 Cykl:  ${cycleVideo ? 'TAK (' + cycle + ')' : 'BRAK'}`);
        console.log(`[Wiesio-Spawacz] 🔄 Main:  ${mainVideo}`);
        console.log(`[Wiesio-Spawacz] 🔄 End:   ${endVideo ? 'TAK' : 'BRAK'}`);

        // --- 5. PRAWO JEDNI (Uniwersalny Normalizator) ---
        console.log(`[Wiesio-Spawacz] 🎓 Zaczynam studia z Prawa Jedni (Normalizacja Klocków)...`);

        // Funkcja normalizująca pojedynczy plik (Tytanowe Prawo Jedni)
        const normalizeVideo = (inputPath, outputPath, name) => {
            return new Promise((resolve, reject) => {
                if (!inputPath) {
                    resolve(null);
                    return;
                }
                console.log(`[Wiesio-Spawacz] 🗜 Normalizuję: ${name}... (to chwilę potrwa)`);
                ffmpeg(inputPath)
                    .outputOptions([
                        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black', // Kuloodporne centrowanie
                        '-r', '30',           // 30 klatek
                        '-c:v', 'libx264',    // Kodek wideo
                        '-crf', '23',         // Jakość
                        '-preset', 'fast',    // Prędkość
                        '-c:a', 'aac',        // Ujednolicenie kodeka audio
                        '-ar', '44100',       // Ujednolicenie częstotliwości audio
                        '-ac', '2',           // Wymuszenie stereo
                        '-y'                  // ZAKLĘCIE NADPISYWANIA - absolutnie konieczne!
                    ])
                    .on('end', () => resolve(outputPath))
                    .on('error', (err) => {
                        console.error(`[Wiesio-Spawacz] ❌ Błąd przy ${name}:`, err.message);
                        resolve(null); // Zwracamy null, by jeden błąd nie zawiesił całej Fabryki
                    })
                    .save(outputPath);
            });
        };

        const tempStart = path.join(moveDir, 'TEMP_START.mp4');
        const tempCycle = path.join(moveDir, 'TEMP_CYCLE.mp4');
        const tempMain = path.join(moveDir, 'TEMP_MAIN.mp4');
        const tempEnd = path.join(moveDir, 'TEMP_END.mp4');

        try {
            // Normalizujemy wszystko po kolei (bezpieczniej dla RAMu)
            const normStart = await normalizeVideo(startVideo, tempStart, 'Klocek Startowy');
            const normCycle = await normalizeVideo(cycleVideo, tempCycle, 'Klocek Cyklu');
            const normMain = await normalizeVideo(mainVideo, tempMain, 'Główny Podcast');
            const normEnd = await normalizeVideo(endVideo, tempEnd, 'Klocek Końcowy');

            console.log(`[Wiesio-Spawacz] ✨ Wszystkie klocki zjednoczone w formacie 1920x1080! Rozpoczynam spawanie finałowe...`);

            let command = ffmpeg();
            if (normStart) command = command.input(normStart);
            if (normCycle) command = command.input(normCycle);
            if (normMain) command = command.input(normMain);
            if (normEnd) command = command.input(normEnd);

            command.outputOptions('-y') // ZAKLĘCIE NADPISYWANIA
                .on('error', (err) => {
                    console.error(`[Wiesio-Spawacz] ❌ Błąd spawania:`, err.message);
                })
                .on('end', () => {
                    console.log(`[Wiesio-Spawacz] 🏆 SUKCES! FINALNY PodCaT gotowy: FINAL_${videos[0]}`);
                    // Sprzątanie po studiach (usuwamy pliki tymczasowe)
                    [tempStart, tempCycle, tempMain, tempEnd].forEach(tmp => {
                        if (fsSync.existsSync(tmp)) fsSync.unlinkSync(tmp);
                    });
                })
                .mergeToFile(outputFile, moveDir);

        } catch (error) {
            console.error(`[Wiesio-Spawacz] ❌ Błąd podczas normalizacji:`, error);
        }

        return res.status(200).json({ status: 'success', message: 'Wiesio uczy klocki Prawa Jedni i spawa! Sprawdź terminal.' });
    }
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

    if (action === 'GET_LATEST_KRONIKA') {
        const kronikiDir = path.join(__dirname, '_AntiGravity_Kroniki');

        if (!fsSync.existsSync(kronikiDir)) return res.status(404).json({ error: 'Brak biblioteki Kronik!' });

        const files = fsSync.readdirSync(kronikiDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
        if (files.length === 0) return res.status(404).json({ error: 'Brak Kronik do przetworzenia!' });

        // Sortowanie po dacie modyfikacji (najnowsza na samej górze)
        files.sort((a, b) => {
            return fsSync.statSync(path.join(kronikiDir, b)).mtime.getTime() - fsSync.statSync(path.join(kronikiDir, a)).mtime.getTime();
        });

        const latestFile = files[0];
        const content = fsSync.readFileSync(path.join(kronikiDir, latestFile), 'utf8');

        console.log(`[Wiesio-Archiwista] 📜 Wyciągnięto najnowszą Kronikę do Alchemii: ${latestFile}`);
        return res.status(200).json({ status: 'success', file: latestFile, content: content });
    }

    if (action === 'SAVE_METADATA') {
        const moveDir = path.join(__dirname, '_AntiGravity_Move');
        if (!fsSync.existsSync(moveDir)) fsSync.mkdirSync(moveDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `YouTube_Pieczec_${timestamp}.txt`;
        const filepath = path.join(moveDir, filename);

        // Zapis zrzuconego tekstu z Katedry
        fsSync.writeFileSync(filepath, payload.text, 'utf8');

        console.log(`[Wiesio-Archiwista] 💾 Pieczęć Alchemika przybita na twardo: ${filename}`);
        return res.status(200).json({ status: 'success', file: filename });
    }

    if (action === 'GET_LOCAL_PREMIERE') {
        const moveDir = path.join(__dirname, '_AntiGravity_Move');
        if (!fsSync.existsSync(moveDir)) return res.status(200).json({ file: null, metadata: null });

        const files = fsSync.readdirSync(moveDir);
        const videos = files.filter(f => f.endsWith('.mp4')).sort((a, b) => {
            return fsSync.statSync(path.join(moveDir, b)).mtime.getTime() - fsSync.statSync(path.join(moveDir, a)).mtime.getTime();
        });

        if (videos.length === 0) return res.status(200).json({ file: null, metadata: null });

        const latestVideo = videos[0];
        // Szukamy najświeższej pieczęci (pliku txt)
        const txts = files.filter(f => f.endsWith('.txt')).sort((a, b) => {
            return fsSync.statSync(path.join(moveDir, b)).mtime.getTime() - fsSync.statSync(path.join(moveDir, a)).mtime.getTime();
        });

        let latestMetadata = "Brak przybitej pieczęci z opisem.";
        let latestMetadataFile = null;
        if (txts.length > 0) {
            latestMetadataFile = txts[0];
            latestMetadata = fsSync.readFileSync(path.join(moveDir, latestMetadataFile), 'utf8');
        }

        return res.status(200).json({ file: latestVideo, metadata: latestMetadata, metadataFile: latestMetadataFile });
    }

    if (action === 'DELETE_LOCAL_PREMIERE') {
        const moveDir = path.join(__dirname, '_AntiGravity_Move');
        try {
            if (payload.video && fsSync.existsSync(path.join(moveDir, payload.video))) {
                fsSync.unlinkSync(path.join(moveDir, payload.video));
            }
            if (payload.metadata && fsSync.existsSync(path.join(moveDir, payload.metadata))) {
                fsSync.unlinkSync(path.join(moveDir, payload.metadata));
            }
            console.log(`[Wiesio-Archiwista] 🚽 Spłukano nieudane ujęcie: ${payload.video}`);
            return res.status(200).json({ status: 'success' });
        } catch (e) {
            console.error(`[Wiesio-Archiwista] ❌ Błąd spłuczki:`, e);
            return res.status(500).json({ error: 'Błąd spłuczki' });
        }
    }

    if (action === 'PING') {
        return res.status(200).json({ status: 'AHOJ', message: 'Wiesio zgłasza gotowość Wymiaru 0.00G!' });
    }

    if (action === 'INDEX_KRONIKI') {
        if (!wiesioBrain) return res.status(503).json({ error: 'Mózg jeszcze się ładuje!' });

        const kronikiDir = path.join(__dirname, '_AntiGravity_Kroniki');
        const indexFile = path.join(kronikiDir, '_podswiadomosc.json');

        if (!fsSync.existsSync(kronikiDir)) {
            return res.status(404).json({ error: 'Brak biblioteki Kronik!' });
        }

        const files = fsSync.readdirSync(kronikiDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
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
            const kronikiDir = path.join(__dirname, '_AntiGravity_Kroniki');

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
                    '-r', '60',                               // Wymuszenie płynności 60 FPS
                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // TARCZA: Wymuszenie parzystości wymiarów!
                    '-y'                                      // ZAKLĘCIE NADPISYWANIA
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

    if (action === 'SAVE_SONIC_VECTORS') {
        try {
            const { filename, vectors } = payload || {};
            if (!filename || !vectors) return res.status(400).json({ error: 'Brak nazwy pliku lub wektorów' });

            const filePath = path.join(SONIC_DIR, filename);
            fsSync.writeFileSync(filePath, JSON.stringify(vectors, null, 2), 'utf8');
            console.log(`[Wiesio-Archiwista] 🔊 Zapisano wektory soniczne: ${filename}`);
            return res.json({ success: true, message: 'Wektory zapisane.' });
        } catch (e) {
            console.error(`[Wiesio-Archiwista] ❌ Błąd zapisu wektorów:`, e);
            return res.status(500).json({ error: e.message });
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
                    '-r', '60',                               // Wymuszenie płynności 60 FPS
                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // TARCZA: Wymuszenie parzystości wymiarów!
                    '-y'                                      // ZAKLĘCIE NADPISYWANIA
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

    // ── MCP_UI_BUILD (Magia Klaudiusza) ─────────────────────────
    if (action === 'MCP_UI_BUILD') {
        const { description, componentName, style = 'OtakOS 0.00G', tags = [], model: aiModel } = payload;
        if (!description || !componentName) return res.status(400).json({ success: false, message: 'Brak description lub componentName' });

        const apiKey = await getAnthropicKey();
        if (!apiKey) return res.status(401).json({ success: false, message: 'Brak klucza Anthropic' });

        console.log(`[Wiesio-Bridge] 🎨 MCP_UI_BUILD: "${componentName}" (${style})`);
        const prompt = `Jesteś Klaudiusz — ekspert React i Framer Motion.
Zbuduj komponent React o nazwie: ${componentName}
Opis: ${description}
Styl: ${style}

WYMAGANIA TECHNICZNE:
- TypeScript (.tsx), Framer Motion dla animacji
- Tailwind CSS klasy (dark theme)
- Kolory OtakOS: złoty #c9953a, cyjan #00e5ff, fiolet #a78bfa, tło #06080f
- Komponent musi być export default
- Props z sensownymi domyślnymi wartościami
- Komentarz na górze: // ${componentName} — ${description}

ODPOWIEDZ TYLKO BLOKIEM KODU tsx. Żadnego tekstu przed ani po.`;

        try {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({
                    model: aiModel || 'claude-sonnet-4-20250514',
                    max_tokens: 4096,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                return res.status(500).json({ success: false, message: err?.error?.message || 'Błąd API' });
            }
            const data = await resp.json();
            const raw = data.content?.[0]?.text || '';
            const code = extractCodeBlock(raw) || raw;
            if (!code || code.length < 20) return res.status(500).json({ success: false, message: 'Model nie wygenerował kodu' });

            const filename = `${componentName}.tsx`;
            const fp = path.join(COMPONENTS_DIR, filename);
            await fs.writeFile(fp, code, 'utf8');

            const meta = { filename, componentName, description, style, tags, created: new Date().toISOString(), size: code.length };
            await fs.writeFile(fp + '.meta.json', JSON.stringify(meta, null, 2), 'utf8');
            return res.json({
                success: true,
                message: `✨ ${componentName} zmaterializowany w Katedrze!`,
                filename,
                filePath: fp,
                code,
                meta,
                timestamp: Date.now(),
            });
        } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
    }

    // ── LIST_COMPONENTS ──────────────────────────────────────────
    if (action === 'LIST_COMPONENTS') {
        try {
            const entries = await fs.readdir(COMPONENTS_DIR, { withFileTypes: true });
            const components = [];
            for (const e of entries) {
                if (!e.isFile() || e.name.endsWith('.meta.json')) continue;
                let meta = {};
                try { meta = JSON.parse(await fs.readFile(path.join(COMPONENTS_DIR, e.name + '.meta.json'), 'utf8')); } catch { }
                components.push({ filename: e.name, ...meta });
            }
            console.log(`[Wiesio-Bridge] 🎨 Komponenty: ${components.length}`);
            return res.json({ success: true, components, count: components.length });
        } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
    }

    // ── EXEC_SYSTEM (Raw Terminal) ───────────────────────────────────
    if (action === 'EXEC_SYSTEM') {
        const { command, timeout = 300000 } = payload;
        if (!command) return res.status(400).json({ success: false, message: 'Brak komendy' });

        console.log(`[Wiesio-Bridge] ⚡ Wykonuję komendę systemową: ${command}`);

        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: timeout,
                maxBuffer: 50 * 1024 * 1024,
                shell: true
            });

            return res.json({ success: true, response: stdout.trim() || stderr.trim(), timestamp: Date.now() });
        } catch (e) {
            return res.status(500).json({ success: false, message: `Błąd powłoki: ${e.message}` });
        }
    }

    res.status(400).json({ success: false, message: `Wiesław nie zna tej akcji: ${action}` });
});

// ══════════════════════════════════════════════════════════════════
//  🔥 RAFINERIA — Transmutacja WEBM → MP4
//  POST /api/rafineria/convert   (multipart/form-data, pole: "video")
//  Odbiera plik .webm, konwertuje przez fluent-ffmpeg do MP4,
//  odsyła jako res.download(), po czym usuwa oba pliki tymczasowe.
// ══════════════════════════════════════════════════════════════════
const rafineriaStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RAFINERIA_TEMP_DIR),
    filename:    (_req,  file, cb) => cb(null, `rafineria_${Date.now()}_${file.originalname}`),
});

const rafineriaUpload = multer({
    storage: rafineriaStorage,
    limits:  { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB
    fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === 'video/webm'
            || file.mimetype === 'application/octet-stream'
            || file.originalname.toLowerCase().endsWith('.webm');
        ok ? cb(null, true) : cb(new Error('Rafineria przyjmuje tylko pliki .webm'));
    },
});

app.post('/api/rafineria/convert', rafineriaUpload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Brak pliku. Upuść .webm do Rafinerii.' });
    }

    const inputPath  = req.file.path;
    const baseName   = req.file.originalname.replace(/\.webm$/i, '');
    const outputName = `${baseName}_MP4_${Date.now()}.mp4`;
    const outputPath = path.join(RAFINERIA_TEMP_DIR, outputName);

    console.log(`\n[Wiesio-Rafineria] 🔥 ════════════════════════════════════`);
    console.log(`[Wiesio-Rafineria] 🔥  Transmutacja: ${req.file.originalname}`);
    console.log(`[Wiesio-Rafineria] 🔥  Cel: ${outputName}`);
    console.log(`[Wiesio-Rafineria] 🔥 ════════════════════════════════════\n`);

    try {
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .inputOptions([
                    '-analyzeduration 2147483647',
                    '-probesize 2147483647',
                ])
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                    '-pix_fmt', 'yuv420p',                                // Standard YT/Adobe
                    '-vf',      'scale=trunc(iw/2)*2:trunc(ih/2)*2',     // Parzyste wymiary (H.264)
                    '-preset',  'fast',                                   // Szybkość vs jakość
                    '-crf',     '18',                                     // Wysoka jakość
                    '-b:a',     '192k',                                   // Bitrate audio
                    '-movflags', '+faststart',                            // MP4 streaming-ready
                    '-y',                                                  // Nadpisz jeśli istnieje
                ])
                .on('start',    cmd  => console.log(`[Wiesio-Rafineria] 🔨 ${cmd.substring(0, 120)}...`))
                .on('progress', prog => {
                    if (prog.percent != null) {
                        process.stdout.write(`\r[Wiesio-Rafineria] ⚗️  ${Math.round(prog.percent)}% — ${prog.timemark || ''}`);
                    }
                })
                .on('end',   () => { console.log('\n[Wiesio-Rafineria] ✨ Transmutacja zakończona!'); resolve(); })
                .on('error', (err, _stdout, stderr) => {
                    console.error(`\n[Wiesio-Rafineria] ❌ Błąd: ${err.message}`);
                    if (stderr) console.error(`[Wiesio-Rafineria] STDERR:\n${stderr}`);
                    reject(err);
                })
                .save(outputPath);
        });

        // ── Wyślij MP4 jako plik do pobrania ──────────────────────
        res.download(outputPath, outputName, (downloadErr) => {
            // Sprzątanie po pobraniu (lub błędzie wysyłki)
            setTimeout(() => {
                [inputPath, outputPath].forEach(f => {
                    try { fsSync.unlinkSync(f); console.log(`[Wiesio-Rafineria] 🧹 Usunięto: ${path.basename(f)}`); }
                    catch { /* plik już nie istnieje */ }
                });
            }, 2000); // małe opóźnienie — dajemy Express czas na flush bufora

            if (downloadErr && !res.headersSent) {
                console.error(`[Wiesio-Rafineria] ❌ Błąd pobierania: ${downloadErr.message}`);
                res.status(500).json({ success: false, message: downloadErr.message });
            }
        });

    } catch (err) {
        console.error(`[Wiesio-Rafineria] ❌ Błąd transmutacji:`, err.message);
        // Sprzątanie po błędzie
        [inputPath, outputPath].forEach(f => { try { fsSync.unlinkSync(f); } catch { } });
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: `Błąd Rafinerii: ${err.message}` });
        }
    }
});

// ══════════════════════════════════════════════════════════════════
//  ⚛️ QUANTUM FORGE — Mint Node Triplet
//  POST /api/graviton/mint   (JSON body: { nodes: NodeAsset[] })
//  Przyjmuje tablicę węzłów, dołącza do pliku graviton_nodes.json
//  w wymiarze AntiGravity i odsyła listę nadanych ID.
// ══════════════════════════════════════════════════════════════════
app.post('/api/graviton/mint', async (req, res) => {
    const { nodes } = req.body;

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
        return res.status(400).json({ success: false, message: 'Brak węzłów. Przekaż tablicę nodes[].' });
    }

    try {
        const NODES_FILE = path.join(ANTIGRAVITY_DIR, 'graviton_nodes.json');

        // Wczytaj istniejące węzły (jeśli plik istnieje)
        let existing = [];
        try {
            const raw = await fs.readFile(NODES_FILE, 'utf8');
            existing = JSON.parse(raw);
        } catch (_) { /* plik jeszcze nie istnieje — tworzymy od zera */ }

        const updated = [...existing, ...nodes];
        await fs.writeFile(NODES_FILE, JSON.stringify(updated, null, 2), 'utf8');

        console.log(`\n[Wiesio-Forge] ⚛️  Zmintowano ${nodes.length} węzłów. Archiwum: ${updated.length} łącznie.`);
        nodes.forEach(n => console.log(`   · ${n.id}  (${n.type}/${n.stability})  ${n.fileName}`));

        return res.json({
            success:   true,
            minted:    nodes.length,
            total:     updated.length,
            ids:       nodes.map(n => n.id),
        });
    } catch (err) {
        console.error('[Wiesio-Forge] ❌ Błąd zapisu węzłów:', err);
        return res.status(500).json({ success: false, message: `Błąd Forge: ${err.message}` });
    }
});

// ── ☢️ CHAOS INJECTION ENDPOINT ─────────────────────────────────────────────
/**
 * POST /api/chaos/inject
 *
 * Ręczny wyzwalacz Inżynierii Chaosu (Fault Injection).
 * Odpowiednik simulateEdgeCases() z TestProxy/wiesio-bridge.ts —
 * uruchamia jeden losowy scenariusz awaryjny i zwraca raport.
 *
 * Zwraca:
 *   { success, scenario, caught, errorName, errorMessage, survived, taskId }
 *
 * Jeśli błąd zostanie wychwycony (survived=true), automatycznie tworzy
 * zadanie READY_FOR_REVIEW i archiwizuje je przez KnowledgeGraphService.
 */
app.post('/api/chaos/inject', async (req, res) => {
    console.warn('[⚡️ FAULT INJECTION ACTIVE ⚡️] Symulowanie krytycznych błędów środowiskowych...');

    const scenarios = ['NULL_POINTER', 'UNDEFINED_SCOPE', 'ZERO_DIVISION'];
    const scenario  = scenarios[Math.floor(Math.random() * scenarios.length)];
    const taskId    = `FAULT-${Date.now().toString(36).toUpperCase()}`;

    let caught      = false;
    let errorName   = null;
    let errorMsg    = null;
    let survived    = false;

    try {
        if (scenario === 'NULL_POINTER') {
            // Scenariusz A: TypeError (Null Pointer)
            if (Math.random() < 0.7) {
                throw new TypeError('Nie można odwołać właściwości z null');
            }
        }

        if (scenario === 'UNDEFINED_SCOPE') {
            // Scenariusz B: ReferenceError (Undefined Scope)
            const x = undefined;
            const result = x * 2;
            if (isNaN(result)) {
                throw new ReferenceError('Brak definicji kluczowego zmiennego obiektu.');
            }
        }

        if (scenario === 'ZERO_DIVISION') {
            // Scenariusz C: ZeroDivision (Network Abort sim)
            console.log('[CHAOS] Symulacja przekroczenia limitu danych...');
            const result = 1 / 0;   // Infinity — test stabilności liczbowej
            survived = isFinite(result) || true; // system zawsze przeżywa
        }

        survived = true;

    } catch (error) {
        caught    = true;
        survived  = true;   // System Mechanika przechwytuje błąd
        errorName = error.name;
        errorMsg  = error.message;
        console.error(`[FAULT CAUGHT]: Wystąpiono symulowanego krytycznego błędu: ${error.name}. System przeżył.`);

        // ── Zamknięcie Pętli: przekaż błąd do Archiwisty (Gemma4 + Graf) ──
        KnowledgeGraphService.getInstance().emitErrorEvent(error);
    }

    // ── Auto-generacja zadania READY_FOR_REVIEW jeśli błąd złapany ─────────
    if (caught) {
        const faultTask = {
            id:          taskId,
            title:       `[AUTO] ${errorName} — Chaos Injection`,
            description: errorMsg || 'Nieznany błąd środowiskowy',
            priority:    errorName === 'TypeError' ? 'CRITICAL' : 'HIGH',
            targetFiles: ['TestProxy/wiesio-bridge.ts', 'wiesio-bridge.js'],
            status:      'DONE',    // handleTaskCompletion wymaga status DONE
        };

        handleTaskCompletion(faultTask);
    }

    return res.json({
        success:      true,
        scenario,
        caught,
        errorName,
        errorMessage: errorMsg,
        survived,
        taskId:       caught ? taskId : null,
        timestamp:    new Date().toISOString(),
    });
});

// ── KNOWLEDGE GRAPH — odczyt dla frontendu ───────────────────────────────────
/**
 * GET /api/kg/nodes
 * Zwraca tablicę węzłów z knowledge_graph.json.
 * Odczyt przez KGS zapewnia spójność z cache serwisu.
 */
app.get('/api/kg/nodes', async (req, res) => {
    try {
        const kgs   = KnowledgeGraphService.getInstance();
        const graph = await kgs._loadGraph();
        return res.json({
            success:   true,
            nodes:     graph.nodes,
            updatedAt: graph.updatedAt,
            total:     graph.nodes.length,
        });
    } catch (err) {
        console.error('[KG-READ] ❌', err.message);
        return res.status(500).json({ success: false, nodes: [], message: err.message });
    }
});

// ── 🔧 MECHANIC — odczyt kolejki dla frontendu ───────────────────────────────
/**
 * GET /api/mechanic/queue
 * Zwraca aktualną zawartość queue.json dla AgentDashboard.
 */
app.get('/api/mechanic/queue', async (req, res) => {
    try {
        const tasks = await MechanicService.getInstance().getQueue();
        return res.json({ success: true, tasks, total: tasks.length });
    } catch (err) {
        console.error('[Mechanic-API] ❌ GET queue:', err.message);
        return res.status(500).json({ success: false, tasks: [], message: err.message });
    }
});

/**
 * POST /api/mechanic/enqueue
 * Ręczne dodanie zadania do kolejki (ciało: { id, title, description, priority, targetFiles }).
 */
app.post('/api/mechanic/enqueue', async (req, res) => {
    try {
        const task = req.body;
        const entry = await MechanicService.getInstance().enqueueTask(task);
        if (!entry) {
            return res.status(409).json({ success: false, message: 'Zadanie już istnieje w kolejce.' });
        }
        return res.json({ success: true, task: entry });
    } catch (err) {
        console.error('[Mechanic-API] ❌ POST enqueue:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── 🔧 MECHANIC — podgląd i wdrażanie patchy ────────────────────────────────

/**
 * Parsuje plik .md i zwraca { targetFile, code }.
 * Rzuca Error z opisem jeśli parsowanie niemożliwe (→ ręczne wdrożenie).
 */
function parsePatchFile(content) {
    // Szukamy pierwszego pliku docelowego: > **Pliki docelowe:** `ścieżka`
    const targetMatch = content.match(/\*\*Pliki docelowe:\*\*\s*`([^`]+)`/);
    if (!targetMatch) {
        throw new Error(
            'PARSE_FAIL: Brak sekcji "Pliki docelowe" w patchu — wdróż ręcznie.'
        );
    }
    const targetFile = targetMatch[1].trim();

    // Szukamy bloku kodu w sekcji "Propozycja Naprawy"
    const afterProposal = content.split(/## Propozycja Naprawy/)[1] ?? content;
    const codeMatch = afterProposal.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
    if (!codeMatch) {
        throw new Error(
            'PARSE_FAIL: Nie znaleziono bloku kodu (```...```) — wdróż ręcznie.'
        );
    }

    return { targetFile, code: codeMatch[1] };
}

/**
 * GET /api/mechanic/patch/:id
 * Zwraca surową treść pliku _AntiGravity_Wymiar/patches/patch_[id].md.
 */
app.get('/api/mechanic/patch/:id', async (req, res) => {
    const { id } = req.params;
    if (!id || !/^[\w.-]+$/.test(id)) {
        return res.status(400).json({ success: false, message: 'Nieprawidłowe id.' });
    }

    const patchFile = path.join(ANTIGRAVITY_DIR, 'patches', `patch_${id}.md`);
    try {
        const content = await fs.readFile(patchFile, 'utf8');
        console.log(`[Mechanic-API] 📄 GET patch/${id} (${content.length} znaków)`);
        return res.json({ success: true, id, content });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ success: false, message: `Patch ${id} nie istnieje.` });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/mechanic/apply
 * Body: { id: string }
 *
 * Parsuje patch_[id].md → wyciąga targetFile + blok kodu →
 * tworzy backup [targetFile].bak → nadpisuje kod → zmienia status na DONE.
 *
 * Bezpieczeństwo:
 *   - Ścieżka musi być wewnątrz process.cwd()
 *   - Backup obowiązkowy (plik .bak)
 *   - Jeśli parsing niemożliwy → 422 + instrukcja ręczna (NIE crashuje)
 */
app.post('/api/mechanic/apply', async (req, res) => {
    const { id } = req.body ?? {};
    if (!id) {
        return res.status(400).json({ success: false, message: 'Brak id zadania.' });
    }

    const patchFile = path.join(ANTIGRAVITY_DIR, 'patches', `patch_${id}.md`);

    let content;
    try {
        content = await fs.readFile(patchFile, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ success: false, message: `Patch ${id} nie istnieje.` });
        }
        return res.status(500).json({ success: false, message: err.message });
    }

    // ── Parsowanie ────────────────────────────────────────────────────────────
    let targetFile, code;
    try {
        ({ targetFile, code } = parsePatchFile(content));
    } catch (parseErr) {
        console.warn(`[Mechanic-API] ⚠️  apply ${id}: ${parseErr.message}`);
        return res.status(422).json({
            success:    false,
            message:    parseErr.message,
            manualHint: `Otwórz: _AntiGravity_Wymiar/patches/patch_${id}.md`,
        });
    }

    // ── Walidacja ścieżki (path traversal guard) ──────────────────────────────
    const targetAbsolute = path.resolve(process.cwd(), targetFile);
    if (!targetAbsolute.startsWith(process.cwd())) {
        console.error(`[Mechanic-API] 🛡️  apply ${id}: ścieżka poza projektem!`);
        return res.status(403).json({
            success: false,
            message: 'Bezpieczeństwo: ścieżka docelowa poza projektem — odrzucono.',
        });
    }

    // ── Backup (obowiązkowy) ──────────────────────────────────────────────────
    const backupPath = targetAbsolute + '.bak';
    let backupCreated = false;
    try {
        const existing = await fs.readFile(targetAbsolute, 'utf8');
        await fs.writeFile(backupPath, existing, 'utf8');
        backupCreated = true;
        console.log(`[Mechanic-API] 💾 Backup: ${path.relative(process.cwd(), backupPath)}`);
    } catch (backupErr) {
        if (backupErr.code !== 'ENOENT') {
            // Plik istnieje, ale backup się nie udał → bezpieczna odmowa
            console.error(`[Mechanic-API] ❌ Błąd backupu: ${backupErr.message}`);
            return res.status(500).json({
                success: false,
                message: `Backup nie powiódł się — wdrożenie anulowane. ${backupErr.message}`,
            });
        }
        // Plik jeszcze nie istnieje — backup nie potrzebny, tworzymy nowy
        console.log(`[Mechanic-API] 📝 Nowy plik (brak backupu potrzebny): ${targetFile}`);
    }

    // ── Zapis nowego kodu ─────────────────────────────────────────────────────
    try {
        await fs.mkdir(path.dirname(targetAbsolute), { recursive: true });
        await fs.writeFile(targetAbsolute, code, 'utf8');
        console.log(`[Mechanic-API] ✅ Wdrożono: ${targetFile} (${code.length} znaków)`);
    } catch (writeErr) {
        console.error(`[Mechanic-API] ❌ Zapis: ${writeErr.message}`);
        return res.status(500).json({
            success: false,
            message: `Błąd zapisu pliku docelowego: ${writeErr.message}`,
        });
    }

    // ── Zmiana statusu → DONE ─────────────────────────────────────────────────
    try {
        await MechanicService.getInstance().doneTask(id);
    } catch (statusErr) {
        // Kod już zapisany — logujemy, ale nie zwracamy błędu
        console.warn(`[Mechanic-API] ⚠️  doneTask ${id}: ${statusErr.message}`);
    }

    return res.json({
        success:       true,
        id,
        targetFile,
        backupCreated,
        backupPath:    backupCreated ? path.relative(process.cwd(), backupPath) : null,
        bytesWritten:  code.length,
    });
});

/**
 * POST /api/mechanic/reject/:id
 * Zmienia status zadania na REJECTED i usuwa je z widoku kolejki.
 */
app.post('/api/mechanic/reject/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Brak id.' });

    try {
        const result = await MechanicService.getInstance().rejectTask(id);
        if (!result) {
            return res.status(404).json({ success: false, message: `Zadanie ${id} nie istnieje.` });
        }
        return res.json({ success: true, id });
    } catch (err) {
        console.error(`[Mechanic-API] ❌ reject/${id}:`, err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── 🎙️ IMPRESARIO — Agent Medialny ──────────────────────────────────────────

/**
 * GET /api/impresario/status
 * Zwraca stan kont (vault) + kolejkę + metryki.
 */
app.get('/api/impresario/status', async (req, res) => {
    try {
        const status = await ImpresarioService.getInstance().getStatus();
        return res.json({ success: true, ...status });
    } catch (err) {
        console.error('[Impresario-API] ❌ GET status:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/impresario/queue
 * Zwraca aktualną kolejkę wydawniczą.
 */
app.get('/api/impresario/queue', async (req, res) => {
    try {
        const queue = await ImpresarioService.getInstance().getQueue();
        return res.json({ success: true, queue, total: queue.length });
    } catch (err) {
        console.error('[Impresario-API] ❌ GET queue:', err.message);
        return res.status(500).json({ success: false, queue: [], message: err.message });
    }
});

/**
 * POST /api/impresario/enqueue
 * Body: { title: string, album?: string, platforms: string[] }
 * Dodaje nowe zlecenie publikacji do kolejki.
 */
app.post('/api/impresario/enqueue', async (req, res) => {
    const { title, album, platforms } = req.body ?? {};

    if (!title || !platforms) {
        return res.status(400).json({
            success: false,
            message: 'Wymagane pola: title i platforms (tablica).',
        });
    }

    try {
        const job = await ImpresarioService.getInstance().enqueuePublication(title, album, platforms);
        return res.status(201).json({ success: true, job, message: `Zlecenie "${title}" przyjęte do Katedry.` });
    } catch (err) {
        console.error('[Impresario-API] ❌ POST enqueue:', err.message);
        return res.status(400).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/impresario/vault/update
 * Body: { platform: string, isConnected: boolean, ...extras }
 * Aktualizuje metadane konta (połącz/rozłącz platformę).
 */
app.post('/api/impresario/vault/update', async (req, res) => {
    const { platform, isConnected, ...extras } = req.body ?? {};

    if (!platform || typeof isConnected === 'undefined') {
        return res.status(400).json({
            success: false,
            message: 'Wymagane pola: platform i isConnected.',
        });
    }

    try {
        const updated = await ImpresarioService.getInstance().updateVaultMetadata(platform, isConnected, extras);
        return res.json({ success: true, platform, updated });
    } catch (err) {
        console.error('[Impresario-API] ❌ POST vault/update:', err.message);
        return res.status(400).json({ success: false, message: err.message });
    }
});

// ── TASK COMPLETION HANDLER ──────────────────────────────────────────────────
/**
 * NOWA LOGIKA: Zamiast wywoływania processKnowledgeGraph(task),
 * emitujemy zdarzenie, które zostanie obsłużone przez wewnętrzną kolejkę Service.
 */
function handleTaskCompletion(completedTask) {
    if (completedTask && completedTask.status === 'DONE') {
        // DECOUPLING: Zamiast blokować wątek główny, dodajemy zadanie do kolejki Archiwisty.
        KnowledgeGraphService.getInstance().emitTaskDoneEvent(completedTask);
    }
}

app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(` 🔌 Wiesław nasłuchuje na porcie ${PORT}`);
    console.log(`================================================`);
    console.log(` 📦 WRITE_FILE | READ_FILE | LIST_DIRECTORY`);
    console.log(` 🎵 GET_LOCAL_PLAYLIST | GET /music/* (stream)`);
    console.log(` ⚡ EXEC_OLLAMA_CLI — Lokalny LLM przez Ollama CLI`);
    console.log(` ⬇️ PULL_MODEL — Pobieranie modeli w tle`);
    console.log(` 🔧 MechanicService — Agent Mechanik (co 3 min)`);
    console.log(` 🕸️  KnowledgeGraphService — Archiwista Wiedzy`);
    console.log(`================================================`);
    console.log(` 👉 Muzyka: _AntiGravity_Muzyka/`);
    console.log(` 🧠 LLM: POST /api/bridge/execute`);
    console.log(` 🧠 POST /api/claude  ← Claude proxy (SSE)`);
    console.log(` 🔵 POST /api/gemini  ← Gemini proxy (SSE)`);
    console.log(` 🎨 MCP_UI_BUILD      ← gotowy do akcji!`);
    console.log(` ⚡ EXEC_SYSTEM — Surowy Terminal (Raw Exec)`);
    console.log(` 🔧 GET  /api/mechanic/queue`);
    console.log(` 🔧 POST /api/mechanic/enqueue`);
    console.log(` 🔧 GET  /api/mechanic/patch/:id`);
    console.log(` 🔧 POST /api/mechanic/apply`);
    console.log(` 🔧 POST /api/mechanic/reject/:id`);
    console.log(` 🕸️  GET  /api/kg/nodes`);
    console.log(` ☢️  POST /api/chaos/inject`);
    console.log(`================================================`);

    // ── 🔧 Agent Mechanik — skan kolejki co 3 minuty ─────────────────────
    // Lock (_isRunning) w MechanicService gwarantuje brak nakładania wywołań.
    const MECHANIC_INTERVAL_MS = 180_000; // 3 minuty
    setInterval(async () => {
        await MechanicService.getInstance().processPendingTasks();
    }, MECHANIC_INTERVAL_MS);

    console.log(`[Mechanik] ⏰ Harmonogram: processPendingTasks() co ${MECHANIC_INTERVAL_MS / 1000}s.`);

    // ── 🎙️ Agent Impresario — procesor zadań co 15 sekund ────────────────
    // Szybszy interwał bo to symulacja — widoczny postęp na dashboardzie.
    const IMPRESARIO_INTERVAL_MS = 15_000; // 15 sekund
    setInterval(async () => {
        await ImpresarioService.getInstance().processNextJob();
    }, IMPRESARIO_INTERVAL_MS);

    console.log(`[Impresario] ⏰ Harmonogram: processNextJob() co ${IMPRESARIO_INTERVAL_MS / 1000}s.`);
    console.log(` 🎙️  GET  /api/impresario/status`);
    console.log(` 🎙️  GET  /api/impresario/queue`);
    console.log(` 🎙️  POST /api/impresario/enqueue`);
    console.log(` 🎙️  POST /api/impresario/vault/update`);
});
