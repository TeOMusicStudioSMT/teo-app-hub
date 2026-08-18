import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// NOWOŚĆ: Moduł do wykonywania komend w terminalu
import { exec, execFile, spawn } from 'child_process';
import { initTacosGuard, executeTacosGuard } from './core/tacos-guard.js';
import { runCodeReview } from './core/agents/ocr.js';
import { getAgentsList, getAgentPrompt, getMergedSystemPrompt } from './core/agents/index.js';
import { promisify } from 'util';
import crypto from 'crypto';
import os from 'os';
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BRIDGE: Aby obsłużyć biblioteki CommonJS w środowisku ESM (jak youtube-transcript 1.0.6)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── ARCHIWISTA WIEDZY (KnowledgeGraphService) ────────────────────────────────
import KnowledgeGraphService from './services/KnowledgeGraphService.js';
import {
    AKCJE_JOANNY,
    pamiec as joannaPamiec,
    zapiszUtwor as joannaZapiszUtwor,
    dopiszPlik as joannaDopiszPlik,
    ocenUtwor as joannaOcen,
    zapamietaj as joannaZapamietaj,
    zbudujKontekst as joannaKontekst,
    promptSystemowy as joannaPrompt,
    zdanieZWyniku as joannaZdanie,
} from './services/JoannaService.js';
import {
    SCIEZKI as BIT_SCIEZKI,
    parsujMatryce as bitParsujMatryce,
    listaWzorcow as bitListaWzorcow,
    wzorPoNazwie as bitWzorPoNazwie,
    renderujBit,
} from './services/BitService.js';
import {
    PASMA as RZEZBA_PASMA,
    dlugosc as audioDlugosc,
    tnij as audioTnij,
    petla as audioPetla,
    sklej as audioSklej,
    znormalizuj as audioNormalizuj,
    pasma as audioPasma,
} from './services/RzezbaAudioService.js';
import MechanicService       from './services/MechanicService.js';
import TurbovecService       from './services/TurbovecService.js';
import ShellSanitizer        from './services/ShellSanitizer.js';
import ImpresarioService     from './services/ImpresarioService.js';
import TostService           from './services/TostService.js';
import LaundryService        from './services/LaundryService.js';
import VaultService          from './services/VaultService.js';
import ProfileScoutService   from './services/ProfileScoutService.js';
import FlushService          from './services/FlushService.js';
import ApiLayerService       from './services/ApiLayerService.js';
import AlignmentShield       from './services/AlignmentShield.js';
import { forecast as kronosForecast } from './services/KronosSeed.js';
import { zbierzWiadomosci, promptNastroju, SOURCES as RYNEK_SOURCES } from './services/RynekTunelService.js';
import {
    lista as dziennikLista, dodaj as dziennikDodaj,
    domknij as dziennikDomknij, podsumowanie as dziennikPodsumowanie,
} from './services/DziennikDecyzjiService.js';
import { zbudujMape } from './services/MapaSektorowService.js';
import {
    ETAPY as PRODUKCJA_ETAPY,
    lista as produkcjaLista, projekty as produkcjaProjekty, biblia as produkcjaBiblia,
    dodaj as produkcjaDodaj, zmien as produkcjaZmien, usun as produkcjaUsun,
    zbudujPrompt as produkcjaPrompt, statystyka as produkcjaStatystyka,
    promptSystemowyRozkladu, odczytajRozklad,
} from './services/ProdukcjaService.js';
import {
    listaPostaci, dodajPostac, usunPostac,
    pamiec as rezyserPamiec, listaSeriali, dodajFakt, usunFakt, dodajOdcinek, usunOdcinek,
    zbudujKontekst, promptSystemowyRezysera, odczytajOdpowiedz, zdanieZWyniku, AKCJE_REZYSERA,
} from './services/RezyserService.js';
import {
    strazMostu, wczytajLubUtworzKlucz, przekujKlucz, NAGLOWEK_KLUCZA,
} from './services/StrazMostu.js';
import CryptoAgility from './services/CryptoAgility.js';
import {
    KATALOG_MODELI as MUZYKA_KATALOG_MODELI,
    MANIFEST as MUZYKA_MANIFEST,
    status as muzykaModeleStatus,
    pull as muzykaModelePull,
    usun as muzykaModeleUsun,
    modelPoId as muzykaModelPoId,
} from './services/MuzykaModeleService.js';
import { buildDziennikHtml } from './services/dziennikTemplate.js';
import {
    attachStudioRelay,
    getStudioStatus,
    saveRtmpConfig,
    RECORDINGS_DIR,
} from './services/StudioRelayService.js';
import { attachGoscStudio, stanPokoi } from './services/GoscStudioService.js';
import {
    ZNANE_TOKENY, PLATFORMA_CG, saldaTokenow, cenyTokenow, cenyPoId,
} from './services/TokenyErc20Service.js';
import {
    SKARBIEC as SKARBIEC_GRV,
    listaModulow, dodajModul, usunModul, zapiszSubskrypcje, anulujSubskrypcje,
    listaWypraw, dodajWyprawe, usunWyprawe, zapiszWplate, stan as stanRejestru,
} from './services/ModulyService.js';
import {
    ocenPrace, zapiszWdech, stanOddechu, rejestrTrwalych,
} from './services/OddechService.js';
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
// Port z env — pozwala odpalic drugi most obok dzialajacego (testy) bez kolizji.
const PORT = Number(process.env.OTAKOS_BRIDGE_PORT) || 3001;

// 🐳 Docker/Live-USB: adres Ollamy z env (fallback lokalny IPv4 — dev bez zmian).
function normalizeOllamaBase(h) {
    let b = (h && String(h).trim()) || 'http://127.0.0.1:11434';
    if (!/^https?:\/\//i.test(b)) b = 'http://' + b;                       // brak protokołu
    b = b.replace('0.0.0.0', '127.0.0.1');                                 // 0.0.0.0 = nasłuch, nie klient
    const hostPort = b.replace(/^https?:\/\//i, '');
    if (!/:\d+/.test(hostPort)) b = b.replace(/\/+$/, '') + ':11434';      // brak portu
    return b.replace(/\/+$/, '');
}
const OLLAMA_BASE = normalizeOllamaBase(process.env.OLLAMA_HOST);

/**
 * 🧠 Domyślny rdzeń narracyjny — głos Joanny, Kronika, Dziennik, teledysk, storyboard.
 *
 * ⚠️ HISTORIA (naprawione 2026-07-30). Pięć endpointów miało wpisane na sztywno
 * `gemma3:4b` — model, którego NIE MA w instalacji Ollamy Suwerena, a `OTAKOS_MODEL`
 * nie było ustawione nigdzie. Każde wywołanie po cichu chybiało: Joanna spadała na
 * awaryjną `gemma3:1b` (0,8 GB) i mówiła łamaną polszczyzną („byntę słodki wiatr",
 * „Przeboowe dźwięki"), a Kronika/Dziennik/storyboard po prostu milczały.
 *
 * DLACZEGO `gemma4:e2b`, a nie `gemma4`: pełna `gemma4:latest` (9,6 GB) wywraca
 * backend na tej maszynie — `llama-server terminated: stack-based buffer overrun`.
 * Wariant `e2b` (7,2 GB) należy do tej samej rodziny, odpowiada poprawną polszczyzną
 * i nie wywala Ollamy. Zmierzone, nie założone.
 *
 * Podmiana bez ruszania kodu: zmienna środowiskowa `OTAKOS_MODEL`.
 */
const DEFAULT_LLM = process.env.OTAKOS_MODEL || 'gemma4:e2b';
/** Ostatnia deska ratunku — malutki model, byle kompan nie zamilkł całkiem. */
const FALLBACK_LLM = 'gemma3:1b';

// Ścieżki do folderów
const ANTIGRAVITY_DIR = path.join(process.cwd(), '_OtakOs_Wymiar');
const MUSIC_DIR = path.join(process.cwd(), '_OtakOs_Muzyka');
const MOVE_DIR = path.join(process.cwd(), '_OtakOs_Move');
const SONIC_DIR = path.join(process.cwd(), '_OtakOs_Sonic');
const BUILD_DIR = path.join(process.cwd(), '_OtakOs_Build');
const AI_DIR = path.join(process.cwd(), '_OtakOs_AI');
const MODELS_DIR = path.join(AI_DIR, 'models');
const TEMP_DIR = path.join(AI_DIR, 'temp');
const BIN_DIR = path.join(AI_DIR, 'bin');
const WHISPER_EXE = path.join(BIN_DIR, 'whisper-cli.exe');
const COMPONENTS_DIR = path.join(process.cwd(), '_OtakOs_Components'); // ← NOWOŚĆ od Klaudiusza
const AULA_DIR = path.join(process.cwd(), '_OtakOs_Aula'); // ← NOWOŚĆ od Suwerena
const RAFINERIA_TEMP_DIR = path.join(process.cwd(), '_temp'); // ← Rafineria: pliki tymczasowe webm/mp4


// Rozszerzenia audio
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.opus'];

// Podstawowe middlewares
// 1. ROZBUDOWA OBSERWATORA PORTÓW W WIESIO-BRIDGE
const LOCAL_CHANNELS = {
  HUB: 'http://localhost:5176',
  MUSIC: 'http://localhost:5173',
  VIDEO: 'http://localhost:5174',
  NODES: 'http://localhost:5175',
  HUB_ALT: 'http://127.0.0.1:5176',
  MUSIC_ALT: 'http://127.0.0.1:5173',
  VIDEO_ALT: 'http://127.0.0.1:5174',
  NODES_ALT: 'http://127.0.0.1:5175'
};

// Kanały lokalne trzymamy dla czytelności (kto normalnie puka do Śluzy):
const KNOWN_ORIGINS = [
    LOCAL_CHANNELS.HUB,
    LOCAL_CHANNELS.MUSIC,
    LOCAL_CHANNELS.VIDEO,
    LOCAL_CHANNELS.NODES,
    LOCAL_CHANNELS.HUB_ALT,
    LOCAL_CHANNELS.MUSIC_ALT,
    LOCAL_CHANNELS.VIDEO_ALT,
    LOCAL_CHANNELS.NODES_ALT,
    'https://otakos.wtf',
    'http://localhost:3000',   // dev strony otakos.wtf (mapa AGI live)
    'http://127.0.0.1:3000'
];

app.use(cors({
    // 🛰️ Kwantowy Tunel (Cloudflare): smartfon puka z losowego origin
    // (*.trycloudflare.com), więc odbijamy KAŻDY origin — odpowiednik `origin: '*'`,
    // ale zgodny z `credentials: true` (przy gołej gwiazdce przeglądarka blokuje
    // żądania z ciasteczkami). Śluza i tak nasłuchuje tylko tam, gdzie Suweren ją wystawi.
    origin: true,
    methods:         ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders:  ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Cache-Control'],
    exposedHeaders:  ['Content-Type', 'X-Error-Code'],
    credentials:     true,
    maxAge:          86400,  // preflight cache 24h
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

const moveDir = path.join(__dirname, '_OtakOs_Move');
app.use('/move', express.static(moveDir));
app.use('/components', express.static(COMPONENTS_DIR));

// ── 🛰️ SUBSTRONY (Music V2 / Story V2 / App V2) — statycznie przez most ───────
// Na USB V_ZERO nie ma serwerów dev (5173/5174/5175), tylko most (3001) i Hub.
// Most zawsze żyje, więc serwuje zbudowane substrony pod /apps/{music,story,app}.
// express.static serwuje index.html dla katalogu (query params teleportu i hash
// routing działają po stronie klienta — fallback SPA zbędny). Buildy w public/apps/
// jadą z distro. UWAGA: Express 5 — żadnych gołych `*` w routach (crash boota).
const APPS_DIR = path.join(__dirname, 'public', 'apps');
for (const app_ of ['music', 'story', 'app']) {
    const middlewares = [cors({ origin: '*' })];
    // 🎹 Teleport na Music V2 budzi ComfyUI. Suweren wchodzil do studia i dopiero
    // tam dowiadywal sie, ze silnik nie dziala — musial go odpalac recznie z .bat.
    // Hak siedzi po stronie SERWERA, wiec lapie kazda droge wejscia: kafel w
    // Projektach, dashboard, zakladke w przegladarce, Kwantowy Tunel z telefonu.
    // Nieblokujaco: strona laduje sie od razu, silnik wstaje w tle.
    if (app_ === 'music') {
        middlewares.push((req, res, next) => {
            zapewnijComfyUI('teleport na Music V2').catch(() => {});
            next();
        });
    }
    app.use(`/apps/${app_}`, ...middlewares, express.static(path.join(APPS_DIR, app_)));
}

// ── 📱 STRONA GOŚCIA (telefon jako kamera) ────────────────────────────────────
// Wpięta PRZED Strażą świadomie: telefon otwiera ją Kwantowym Tunelem, czyli
// jako żądanie ZDALNE, a kod QR nie niesie klucza sesji. Sama strona to statyczny
// HTML bez sekretów, więc wystawienie jej nic nie ujawnia.
// BRAMĄ JEST KOD POKOJU (6 znaków z 32-znakowego alfabetu). Najgorsze, co może
// zrobić ktoś obcy, kto zgadnie i adres, i kod, to WEPCHNĄĆ swój obraz do pokoju —
// a i tak nie trafi on na pulpit, dopóki Suweren świadomie nie kliknie „NA PULPIT".
// Odczytać stąd nie da się niczego.
app.use('/gosc', cors({ origin: '*' }), express.static(path.join(__dirname, 'public', 'gosc')));

// ── 🛡️ STRAŻ MOSTU ───────────────────────────────────────────────────────────
// Wpięta TUTAJ celowo: po trasach statycznych (żeby strumień muzyki i substrony
// działały na telefonie bez dokładania klucza do każdego <audio>), a PRZED całym
// API — bo to API potrafi uruchamiać komendy i zapisywać pliki.
//
// Maszyna Suwerena (localhost) przechodzi bez zmian. Żądanie z tunelu musi mieć
// klucz, a i tak nie uruchomi niczego, co zapisuje albo wykonuje. Ta druga
// warstwa jest ważniejsza od pierwszej: kod QR NIESIE klucz, więc zdjęcie ekranu
// znaczy wyciek klucza — ale nie przejęcie maszyny.
const KLUCZ_DIR = path.join(process.cwd(), '_OtakOs_Wymiar');
let KLUCZ_STRAZY = wczytajLubUtworzKlucz(KLUCZ_DIR);
const PELNY_TUNEL = process.env.OTAKOS_TUNEL_PELNY === '1';

app.use(strazMostu({ klucz: () => KLUCZ_STRAZY, pelnyTunel: PELNY_TUNEL }));

/** Klucz wydajemy WYŁĄCZNIE maszynie lokalnej — stąd trafia do linku QR. */
app.get('/api/straz/klucz', (req, res) => {
    if (!req.lokalny) return res.status(403).json({ success: false, message: 'Tylko z maszyny Suwerena.' });
    return res.json({ success: true, klucz: KLUCZ_STRAZY, naglowek: NAGLOWEK_KLUCZA, pelnyTunel: PELNY_TUNEL });
});

/** Przekucie klucza — ratunek, gdy kod QR wyciekł (zdjęcie, stream, cudze oko). */
app.post('/api/straz/przekuj', async (req, res) => {
    if (!req.lokalny) return res.status(403).json({ success: false, message: 'Tylko z maszyny Suwerena.' });
    try {
        KLUCZ_STRAZY = await przekujKlucz(KLUCZ_DIR);
        return res.json({ success: true, klucz: KLUCZ_STRAZY, message: 'Klucz przekuty — stare kody QR i linki są martwe.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

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
                resolvedPath = resolvedPath.replace(pattern, '_OtakOs_Muzyka/');
                break;
            }
        }
        // Jeśli to bare filename (np. "Artysta/Song.mp3") bez prefiksu muzyki — dodaj go
        if (!path.isAbsolute(resolvedPath) && !resolvedPath.startsWith('_OtakOs_Muzyka') && !resolvedPath.startsWith('http')) {
            resolvedPath = path.join('_OtakOs_Muzyka', resolvedPath);
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
                message: `Brak modelu: ${model}. Pobierz go do folderu _OtakOs_AI/models/ jako ggml-${model}.bin`,
                hint: `https://huggingface.co/ggerganov/whisper.cpp/tree/main`
            });
        }

        if (!fsSync.existsSync(WHISPER_EXE)) {
            return res.status(400).json({
                success: false,
                message: "Brak silnika AI (whisper-cli.exe).",
                hint: "Pobierz whisper.cpp binarki i wypakuj do _OtakOs_AI/bin/."
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

        // 6. Algorytm Dopasowania — WHISPER daje oś czasu, JOANNA (LLM) przypina wersy.
        // Whisper.cpp zwraca 'transcription' -> segmenty {text, offsets:{from,to} w ms}.
        const segments = aiOutput.transcription || [];
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Oś czasu z audio (segment-level — dużo stabilniejsze niż pojedyncze tokeny).
        const timeline = segments
            .map(s => ({ t: (s.offsets?.from ?? 0) / 1000, text: String(s.text || '').trim() }))
            .filter(s => s.text)
            .sort((a, b) => a.t - b.t);
        const audioEnd = timeline.length ? timeline[timeline.length - 1].t + 3 : lines.length * 3;

        // Twardy bezpiecznik: czasy TYLKO rosną (koniec skoków w tył jak 49s->2s).
        const clampMonotonic = (arr) => {
            let prev = -0.001;
            return arr.map(v => { const t = Math.max(Number(v) || 0, prev + 0.25); prev = t; return t; });
        };

        // 6a. JOANNA (LLM) — rozumie SENS tekstu i dopasowuje wersy do osi czasu.
        let times = null;
        if (timeline.length >= 2) {
            const tlStr = timeline.map(s => `[${s.t.toFixed(1)}] ${s.text}`).join('\n').slice(0, 4000);
            const lyrStr = lines.map((l, i) => `${i + 1}: ${l}`).join('\n').slice(0, 4000);
            const prompt =
`Masz PRAWDZIWY tekst piosenki (ponumerowane wersy) i przybliżoną transkrypcję audio ze znacznikami czasu w sekundach (auto, słowa bywają błędne, ale CZASY są z nagrania). Przypisz każdemu wersowi moment, w którym jest śpiewany, wg osi czasu transkrypcji.
ZASADY: czasy TYLKO rosną (nigdy w tył); wers-pauza dostaje czas między sąsiadami; ostatni czas <= ${audioEnd.toFixed(0)}s.
Zwróć WYŁĄCZNIE tablicę JSON długości ${lines.length}: [{"i":1,"t":0.0},{"i":2,"t":3.4},...]. Bez komentarza.

TEKST (wersy):
${lyrStr}

TRANSKRYPCJA Z CZASAMI:
${tlStr}`;
            const model = process.env.OTAKOS_MODEL || 'gemma4';
            let raw = await genOllama(prompt, model, 60000);
            if (!raw) raw = await genOllama(prompt, 'gemma3:1b', 45000);
            const m = raw && raw.match(/\[[\s\S]*\]/);
            if (m) {
                try {
                    const parsed = JSON.parse(m[0]);
                    if (Array.isArray(parsed) && parsed.length >= Math.floor(lines.length * 0.6)) {
                        const byIdx = new Map(parsed.map(o => [Number(o.i), Number(o.t)]));
                        times = lines.map((_, i) => {
                            const t = byIdx.get(i + 1);
                            return Number.isFinite(t) ? t : NaN;
                        });
                        // Uzupełnij dziury interpolacją liniową między znanymi punktami.
                        for (let i = 0; i < times.length; i++) {
                            if (!Number.isFinite(times[i])) {
                                let a = i - 1; while (a >= 0 && !Number.isFinite(times[a])) a--;
                                let b = i + 1; while (b < times.length && !Number.isFinite(times[b])) b++;
                                const ta = a >= 0 ? times[a] : 0;
                                const tb = b < times.length ? times[b] : audioEnd;
                                times[i] = ta + (tb - ta) * ((i - a) / Math.max(1, b - a));
                            }
                        }
                        console.log(`[Wiesio-AI] 🐣 Joanna dopasowała ${parsed.length}/${lines.length} wersów (model: ${model}).`);
                    }
                } catch { /* zły JSON — spadamy na word-match */ }
            }
        }

        // 6b. Fallback: word-matching po pierwszym słowie wersu (gdy Joanna/LLM milczy).
        if (!times) {
            const allWords = segments.flatMap(seg => seg.tokens || []);
            let lastWordIdx = 0;
            times = lines.map(lineText => {
                const firstWord = lineText.toLowerCase().split(/\s+/)[0].replace(/[.,?!]/g, '');
                let foundIdx = -1;
                for (let i = lastWordIdx; i < allWords.length; i++) {
                    const w = allWords[i].text.toLowerCase().trim().replace(/[.,?!]/g, '');
                    if (w.length >= 2 && firstWord.length >= 2 && (w.includes(firstWord) || firstWord.includes(w))) { foundIdx = i; break; }
                }
                if (foundIdx !== -1) { lastWordIdx = foundIdx + 1; return (allWords[foundIdx].offsets?.from ?? 0) / 1000; }
                return NaN;
            });
            // dziury → interpolacja
            for (let i = 0; i < times.length; i++) if (!Number.isFinite(times[i])) {
                let a = i - 1; while (a >= 0 && !Number.isFinite(times[a])) a--;
                let b = i + 1; while (b < times.length && !Number.isFinite(times[b])) b++;
                const ta = a >= 0 ? times[a] : 0, tb = b < times.length ? times[b] : audioEnd;
                times[i] = ta + (tb - ta) * ((i - a) / Math.max(1, b - a));
            }
            console.log(`[Wiesio-AI] 🔤 Fallback word-match (LLM niedostępny).`);
        }

        // Bezpiecznik monotoniczności + zbudowanie wyniku.
        const safeTimes = clampMonotonic(times);
        const syncedLines = lines.map((lineText, i) => ({
            time: safeTimes[i],
            timestamp: formatLRCTime(safeTimes[i]),
            text: lineText,
        }));

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
        description: 'Lista plików w _OtakOs_Wymiar/',
        input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'read_file',
        description: 'Odczytaj plik z _OtakOs_Wymiar/',
        input_schema: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] },
    },
    {
        name: 'write_file',
        description: 'Zapisz plik do _OtakOs_Build/',
        input_schema: { type: 'object', properties: { filename: { type: 'string' }, content: { type: 'string' } }, required: ['filename', 'content'] },
    },
    {
        name: 'list_components',
        description: 'Lista zbudowanych komponentów w _OtakOs_Components/',
        input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'save_component',
        description: 'Zapisz gotowy komponent React/TSX do biblioteki _OtakOs_Components/',
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
//
// Diagnostyka błędów Ollamy:
//   ECONNREFUSED  — ollama serve nie działa (port 11434 zamknięty)
//   AbortError    — timeout 120s (zimny start VRAM gemma4)
//   HTTP 4xx/5xx  — model nie istnieje lub błąd Ollamy
//
// UWAGA: używamy 127.0.0.1 (IPv4) zamiast localhost — Node 18+ rozwiązuje
// localhost → ::1 (IPv6), co może failować gdy Ollama słucha tylko na IPv4.
app.post('/api/ollama', async (req, res) => {
    const { messages, system, model = 'gemma4' } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Brak messages' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');  // wyłącz buforowanie nginxa jeśli jest proxy

    const sendEvent = (data) => {
        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* client rozłączony */ }
    };

    const ollamaMessages = [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
    ];

    // ── Timeout: 300s (VRAM Breathing v2) — pełna swoboda alokacji VRAM gemma4
    // przy zimnym starcie na obciążonej maszynie. Podniesione ze 120s po teście
    // bojowym, w którym Ollama przerywała operację podczas ładowania modelu.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300_000);

    try {
        const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  controller.signal,
            body:    JSON.stringify({ model, messages: ollamaMessages, stream: true, options: { num_ctx: 8192 } }),
        });

        if (!resp.ok) {
            sendEvent({
                type:  'error',
                error: `Ollama HTTP ${resp.status} — model "${model}" istnieje? Sprawdź: ollama list`,
                code:  `HTTP_${resp.status}`,
            });
            return res.end();
        }

        const reader  = resp.body.getReader();
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
                    if (chunk.message?.content) sendEvent({ type: 'text', text: chunk.message.content });
                    if (chunk.done)             sendEvent({ type: 'done' });
                } catch { /* pomiń złośliwy JSON */ }
            }
        }
    } catch (e) {
        const isAbort = e.name === 'AbortError';
        // Wydobądź dokładny kod Node.js (ECONNREFUSED, ETIMEDOUT, itp.)
        const errCode = e.code || e.cause?.code || (isAbort ? 'ABORT' : 'UNKNOWN');
        const detail  = isAbort
            ? `TIMEOUT — Ollama milczy >120s. Czy gemma4 jest załadowany? (ollama pull gemma4)`
            : `${errCode}: ${e.message}`;

        console.error(`[/api/ollama] ❌ ${detail}`);
        sendEvent({ type: 'error', error: `Ollama niedostępna: ${detail}`, code: errCode });
    } finally {
        clearTimeout(timer);
    }

    res.end();
});

// ── /api/ollama/models — lista dostępnych modeli ────────────────────────
app.get('/api/ollama/models', async (req, res) => {
    try {
        const resp = await fetch(`${OLLAMA_BASE}/api/tags`);
        if (!resp.ok) return res.json({ models: [], error: `Ollama HTTP ${resp.status}` });
        const data = await resp.json();
        const models = (data.models || []).map(m => m.name);
        res.json({ models });
    } catch (e) {
        const code = e.code || e.cause?.code || 'UNKNOWN';
        res.json({ models: [], error: `${code}: ${e.message}` });
    }
});

// ── /api/ollama/diffusion — SZKIELET pod DiffusionGemma (26B MoE Text Diffusion) ──
//
// Status: PRZYGOTOWANIE PORTU. Silnik nieaktywny (DIFFUSION_ENGINE_ACTIVE: false
// w models_config.json). W przyszłości ten endpoint NIE pójdzie do standardowego
// /api/generate Ollamy, lecz do potoku odszumiania tekstu (text diffusion):
//
//   frontend → POST /api/ollama/diffusion
//            → Python bridge (HuggingFace Transformers, denoising loop)
//            → 4x szybsza generacja (równoległe odszumianie zamiast autoregresji)
//            → SSE stream z powrotem
//
// Dopóki backend Pythona nie jest wpięty, endpoint odpowiada 503 z czytelnym
// komunikatem — NIE crashuje mostu ani nie udaje że model działa.
app.post('/api/ollama/diffusion', async (req, res) => {
    const { messages, system, model = '__diffusion__' } = req.body ?? {};

    // Wczytaj flagę z models_config.json (single source of truth)
    let engineActive = false;
    try {
        const cfgRaw = await fs.readFile(path.join(__dirname, 'models_config.json'), 'utf8');
        engineActive = JSON.parse(cfgRaw)?.engines?.diffusion?.DIFFUSION_ENGINE_ACTIVE === true;
    } catch { /* brak configu → silnik traktujemy jako nieaktywny */ }

    if (!engineActive) {
        console.log('[Diffusion] 🧬 Zapytanie odrzucone — silnik nieaktywny (DIFFUSION_ENGINE_ACTIVE: false).');
        return res.status(503).json({
            success: false,
            code:    'DIFFUSION_ENGINE_INACTIVE',
            error:   'DiffusionGemma (26B MoE) jeszcze nie wpięty. Szkielet portu gotowy — ' +
                     'aktywuj DIFFUSION_ENGINE_ACTIVE w models_config.json po podłączeniu backendu Python.',
            engine:  'diffusion',
            model,
        });
    }

    // ── Przyszła implementacja (gdy backend Python wstanie) ──────────────────
    // const resp = await fetch('http://127.0.0.1:8000/diffusion/denoise', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ messages, system, model, steps: 8 }),
    // });
    // ... SSE streaming odszumionego tekstu ...
    void messages; void system;  // placeholder — sygnalizuje przyszłe użycie

    return res.status(501).json({
        success: false,
        code:    'NOT_IMPLEMENTED',
        error:   'Potok odszumiania tekstu nie jest jeszcze zaimplementowany (backend Python wymagany).',
    });
});

// ── /api/agents — Dynamiczny rejestr agentów z Agency 33 ───────────────
app.get('/api/agents', async (req, res) => {
    const agents = await getAgentsList();
    res.json({ success: true, agents });
});

// ── /api/ocr/review — Uruchomienie OpenCodeReview ─────────────────────
app.post('/api/ocr/review', async (req, res) => {
    const { from, to, commit, repo } = req.body;
    const result = await runCodeReview({ from, to, commit, repo });
    res.json(result);
});

// ── /v1/embeddings — OpenAI-compatible Embeddings zasilane Wiesio-Mózgiem ──
app.post('/v1/embeddings', async (req, res) => {
    if (!wiesioBrain) {
        return res.status(503).json({ error: { message: 'Mózg wektorowy (Wiesio-Brain) się jeszcze ładuje!' } });
    }

    const { input, model } = req.body;
    if (!input) {
        return res.status(400).json({ error: { message: 'Brak pola input.' } });
    }

    try {
        const inputs = Array.isArray(input) ? input : [input];
        const data = [];

        for (let i = 0; i < inputs.length; i++) {
            const text = inputs[i];
            const output = await wiesioBrain(text, { pooling: 'mean', normalize: true });
            data.push({
                object: 'embedding',
                index: i,
                embedding: Array.from(output.data)
            });
        }

        res.json({
            object: 'list',
            data,
            model: model || 'all-MiniLM-L6-v2'
        });
    } catch (e) {
        console.error('[Embeddings API] Błąd:', e.message);
        res.status(500).json({ error: { message: e.message } });
    }
});

// ── /api/open-notebook/* — Proxy do REST API Open Notebook ────────────
app.use('/api/open-notebook', cors({ origin: '*' }), async (req, res) => {
    const host = process.env.OPEN_NOTEBOOK_HOST || 'http://localhost:5055';
    const targetUrl = `${host}${req.url}`;
    
    try {
        const options = {
            method: req.method,
            headers: {
                ...req.headers,
                host: undefined
            }
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            options.body = JSON.stringify(req.body);
        }

        const resp = await fetch(targetUrl, options);
        
        res.status(resp.status);
        for (const [key, value] of resp.headers.entries()) {
            res.setHeader(key, value);
        }
        
        const text = await resp.text();
        res.send(text);
    } catch (e) {
        console.error(`[OpenNotebook Proxy] Błąd:`, e.message);
        res.status(502).json({ success: false, error: e.message });
    }
});

// ── /api/claude — Claude proxy z pełną pętlą agentyczną ────────────────
app.post('/api/claude', async (req, res) => {
    // 🛡️ Samoczyszczenie VRAM przed alokacją kontekstu modelu
    executeTacosGuard();

    const { messages, system, model = 'claude-sonnet-4-20250514', useTools = true, apiKey: reqApiKey, agent } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Brak messages' });

    const apiKey = await getAnthropicKey(reqApiKey);
    if (!apiKey) return res.status(401).json({ error: 'Brak klucza Anthropic — dodaj go w TeO Kibel (sk-ant-...)' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const finalSystem = await getMergedSystemPrompt(agent, system);

        let currentMessages = [...messages];
        let rounds = 0;
        const MAX_ROUNDS = 10;

        while (rounds < MAX_ROUNDS) {
            rounds++;
            const body = {
                model, max_tokens: 8096, stream: true,
                messages: currentMessages,
                ...(finalSystem ? { system: finalSystem } : {}),
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
    // 🛡️ Samoczyszczenie VRAM przed alokacją kontekstu modelu
    executeTacosGuard();

    const { messages, system, model = 'gemini-1.5-flash', apiKey: reqApiKey, agent } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Brak messages' });

    const apiKey = await getGeminiKey(reqApiKey);
    if (!apiKey) return res.status(401).json({ error: 'Brak klucza Gemini — dodaj go w TeO Kibel (AIza...)' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        const finalSystem = await getMergedSystemPrompt(agent, system);

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
            ...(finalSystem ? { systemInstruction: { parts: [{ text: finalSystem }] } } : {}),
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
            // Wyczyść ewentualny prefiks _OtakOs_Wymiar i leading slash
            const cleanFilename = filename
                .replace(/^[/\\]?_OtakOs_Wymiar[/\\]/i, '')
                .replace(/^[/\\]/, '');

            // ── ROUTING KATALOGÓW ─────────────────────────────────────
            // Pliki kodu źródłowego aplikacji → rdzeń projektu (__dirname)
            // Notatki, konwersacje, dane       → _OtakOs_Wymiar
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

    // ── LIST_DIRECTORY (Obsługa _OtakOs_Wymiar / _OtakOs_Move) ───────────────────────
    if (action === 'LIST_DIRECTORY') {
        try {
            let scanDir = ANTIGRAVITY_DIR;
            let filterExtensions = null;

            if (payload.target === 'MOVE') {
                scanDir = MOVE_DIR;
                filterExtensions = ['.mp4', '.webm', '.mov'];
            } else if (payload.target === 'SONIC') {
                scanDir = SONIC_DIR;
                filterExtensions = ['.json'];
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

    // ── LIST_MOVE (Obsługa mobilna _OtakOs_Move) ──────────────────────
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
    // Sztuczka nr 4: skanuje _OtakOs_Muzyka/ i zwraca playlistę
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
            const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
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
        const rawCmd = payload.command;
        if (!rawCmd) return res.status(400).json({ error: 'Brak komendy' });

        // 🧯 Otak-Sync Watchdog: odkaź komendę pod powłokę Windows ($ prompt, Linux-izmy)
        const san = ShellSanitizer.sanitizeShellCommand(rawCmd);
        const cmd = san.command;
        if (san.changed) console.log(`[Otak-Sync] 🧯 EXEC_COMMAND odkażono: ${san.notes.join(' ')}`);

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
        if (!payload.command) return res.status(400).json({ error: 'Brak komendy.' });

        // 🧯 Otak-Sync Watchdog: odkaź skrypt pod PowerShell ($ prompt, /dev/null, "\" → "`")
        const sanCmd = ShellSanitizer.sanitizeShellCommand(payload.command);
        let cmd = sanCmd.command;
        if (sanCmd.changed) console.log(`[Otak-Sync] 🧯 EXEC_SYSTEM_CMD odkażono: ${sanCmd.notes.join(' ')}`);

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

            const klockiDir = path.join(process.cwd(), '_OtakOs_Klocki', klockiSubDir);
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

            // Kolejność klocków: Start → Adds → wkład (main) → End.
            const allClips = [...introVideos, ...addVideos, mainVideoPath, ...outroVideos];

            const finalOutputName = outputFilename || `CONCAT_${mainVideoFilename}`;
            const outputPath = path.join(BUILD_DIR, finalOutputName);

            console.log(`[Wiesio-Spawacz] 📄 Klocki (${allClips.length}):\n${allClips.map(c => '  ' + path.basename(c)).join('\n')}`);
            console.log(`[Wiesio-Spawacz] 🔨 Odpalam FFmpeg (filter_complex normalize+concat)... Cel: ${outputPath}`);

            // Rozdzielczość + FPS głównego wideo = cel normalizacji (żeby wkład nie tracił jakości).
            let W = 1920, H = 1080, mainFps = 30;
            try {
                const { stdout: probeOut } = await execFileAsync(ffprobePath, [
                    '-v', 'error', '-select_streams', 'v:0',
                    '-show_entries', 'stream=width,height,r_frame_rate',
                    '-of', 'csv=p=0', mainVideoPath
                ]);
                const [w, h, rate] = probeOut.trim().split(',');
                W = parseInt(w) || 1920; H = parseInt(h) || 1080;
                const [num, den] = String(rate).split('/').map(Number);
                if (num && den) mainFps = Math.round(num / den) || 30;
            } catch (e) {
                console.warn(`[Wiesio-Spawacz] ⚠️ Nie wykryto parametrów głównego wideo, używam ${W}x${H}@${mainFps}.`);
            }
            if (W % 2) W++; if (H % 2) H++; // libx264 wymaga parzystych wymiarów

            // KLUCZ: klocki bywają różnego FPS (24/30/60) i rozdzielczości. Stary concat
            // demuxer sklejał surowe strumienie → aresample dopychał CISZĄ przy joinach
            // (Suweren: +1:30). Teraz KAŻDY klip normalizowany (scale+pad+fps+audio) filtrem,
            // potem concat filter — dokładne długości, zero paddingu, czyste A/V.
            const inputs = [];
            allClips.forEach(c => { inputs.push('-i', c); });
            const fc = [];
            allClips.forEach((_, i) => {
                fc.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${mainFps},setsar=1[v${i}]`);
                fc.push(`[${i}:a]aresample=48000,asetpts=PTS-STARTPTS[a${i}]`);
            });
            const concatIn = allClips.map((_, i) => `[v${i}][a${i}]`).join('');
            const filter = fc.join(';') + ';' + concatIn + `concat=n=${allClips.length}:v=1:a=1[outv][outa]`;

            await execFileAsync(ffmpegPath, [
                ...inputs,
                '-filter_complex', filter,
                '-map', '[outv]', '-map', '[outa]',
                '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k',
                '-y', outputPath
            ], { timeout: 0, maxBuffer: 1024 * 1024 * 500 });

            console.log(`[Wiesio-Spawacz] ✨ Magia dokonana.`);

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
        const rawCommand = payload.command || payload.payload?.command;
        const timeout  = payload.timeout || payload.payload?.timeout || 300000;
        if (!rawCommand) return res.status(400).json({ success: false, message: 'Brak komendy (sprawdź body.command lub body.payload.command)' });

        // 🧯 Otak-Sync Watchdog: odkaź surową komendę pod powłokę Windows
        const sanSys = ShellSanitizer.sanitizeShellCommand(rawCommand);
        const command = sanSys.command;
        if (sanSys.changed) console.log(`[Otak-Sync] 🧯 EXEC_SYSTEM odkażono: ${sanSys.notes.join(' ')}`);

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
                const ollamaResp = await fetch(`${OLLAMA_BASE}/api/generate`, {
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
        const moveDir = path.join(__dirname, '_OtakOs_Move');

        // 1. SZUKAMY NAJNOWSZEGO GŁÓWNEGO WIDEO
        if (!fsSync.existsSync(moveDir)) {
            return res.status(404).json({ error: 'Folder _OtakOs_Move nie istnieje!' });
        }

        const videos = fsSync.readdirSync(moveDir)
            .filter(f => f.endsWith('.mp4') && !f.includes('FINAL'))
            .sort((a, b) => {
                return fsSync.statSync(path.join(moveDir, b)).mtime.getTime() - fsSync.statSync(path.join(moveDir, a)).mtime.getTime();
            });

        if (videos.length === 0) return res.status(404).json({ error: 'Brak surowego wideo w _OtakOs_Move' });
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

        const klockiDir = path.join(__dirname, '_OtakOs_Klocki', klockiSubDir);

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

        const memoryFile = path.join('F:', '5 stars', 'TeO STUDIO', 'TeO App HuB', 'ToO APP', 'TeO_Genesis', '_OtakOs_Kroniki', '_podswiadomosc.json');

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
        const kronikiDir = path.join(__dirname, '_OtakOs_Kroniki');

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
        const moveDir = path.join(__dirname, '_OtakOs_Move');
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
        const moveDir = path.join(__dirname, '_OtakOs_Move');
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
        const moveDir = path.join(__dirname, '_OtakOs_Move');
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

        const kronikiDir = path.join(__dirname, '_OtakOs_Kroniki');
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
            const kronikiDir = path.join(__dirname, '_OtakOs_Kroniki');

            // Używamy fsSync dla operacji na ścieżkach fizycznych z literą dysku, 
            // jeśli fs.mkdir na p: w windows bywał wybredny
            if (!fsSync.existsSync(kronikiDir)) {
                fsSync.mkdirSync(kronikiDir, { recursive: true });
                console.log(`[Wiesio-Archiwista] 📚 Zbudowano nowe regały na dysku F: (_OtakOs_Kroniki)`);
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

    if (action === 'READ_SONIC_VECTORS') {
        try {
            const { filename } = payload || {};
            if (!filename) return res.status(400).json({ error: 'Brak nazwy pliku' });

            const filePath = path.join(SONIC_DIR, filename);
            if (!fsSync.existsSync(filePath)) {
                return res.status(404).json({ error: `Plik wektorów nie istnieje: ${filename}` });
            }

            const content = fsSync.readFileSync(filePath, 'utf8');
            const vectors = JSON.parse(content);
            console.log(`[Wiesio-Archiwista] 🔊 Wczytano wektory soniczne: ${filename}`);
            return res.json({ success: true, filename, vectors });
        } catch (e) {
            console.error(`[Wiesio-Archiwista] ❌ Błąd odczytu wektorów:`, e);
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

    // ── UNLOCK_MODULE_PIPELINE ──────────────────────────────────────────
    if (action === 'UNLOCK_MODULE_PIPELINE') {
        try {
            const { moduleId } = payload || {};
            if (!moduleId) return res.status(400).json({ error: 'Brak moduleId' });

            const configPath = path.join(ANTIGRAVITY_DIR, 'unlocked_pipelines.json');
            let unlocked = [];
            try {
                if (fsSync.existsSync(configPath)) {
                    unlocked = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
                }
            } catch (err) {
                console.warn('[Wiesio-Skarbiec] Błąd odczytu skarbnika, resetowanie:', err.message);
            }

            if (!unlocked.includes(moduleId)) {
                unlocked.push(moduleId);
                fsSync.writeFileSync(configPath, JSON.stringify(unlocked, null, 2), 'utf8');
            }

            console.log(`[Wiesio-Skarbiec] 🔓 Pipeline odblokowany: ${moduleId}`);
            return res.json({ success: true, message: `Pipeline ${moduleId} został trwale odblokowany.`, unlocked });
        } catch (e) {
            console.error(`[Wiesio-Skarbiec] ❌ Błąd odblokowania pipeline:`, e);
            return res.status(500).json({ error: e.message });
        }
    }

    // ── GET_UNLOCKED_PIPELINES ──────────────────────────────────────────
    if (action === 'GET_UNLOCKED_PIPELINES') {
        try {
            const configPath = path.join(ANTIGRAVITY_DIR, 'unlocked_pipelines.json');
            let unlocked = [];
            if (fsSync.existsSync(configPath)) {
                unlocked = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
            }
            return res.json({ success: true, unlocked });
        } catch (e) {
            return res.status(500).json({ error: e.message });
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
// BioResonanceEngine na serwerze - Ewolucja Wektorów z Nasiona (Suweren Style)
const BioResonanceEngine = {
    evolve: async (styleMetrics, baseSeed) => {
        const seed = parseInt(baseSeed) || Math.floor(Math.random() * 1000000);
        const points = 120; // 120 kroków (sekund)
        const complexity = parseFloat(styleMetrics?.complexity ?? 0.5);
        const resonance = parseFloat(styleMetrics?.resonance ?? 0.5);
        const scale = parseFloat(styleMetrics?.scale ?? 1.0);

        const vector = [];
        for (let s = 0; s < points; s++) {
            // Formuła generatywna oparta na seedzie i fazach sinusów
            const angle = (s * Math.PI) / 30; // okres 60 sekund
            
            // Dodajemy pseudolosowość opartą na sinusie z nasiona
            const seedOffset = Math.sin(seed + s) * 50;

            const b = Math.min(255, Math.max(0, Math.floor(
                (128 + 127 * Math.sin(angle * 2 + seed * 0.1)) * scale + seedOffset * complexity
            )));

            const v = Math.min(255, Math.max(0, Math.floor(
                (128 + 127 * Math.cos(angle * 1.5 + seed * 0.2)) * scale + seedOffset * resonance
            )));

            const h = Math.min(255, Math.max(0, Math.floor(
                (128 + 127 * Math.sin(angle * 3.3 + seed * 0.3)) * scale + seedOffset * (complexity * resonance)
            )));

            vector.push({ s, b, v, h });
        }
        return vector;
    }
};

// 2. MECHANIZM REGENERACJI Z NASIONA (Samoulepszanie Pieśni)
app.post('/api/sonic/mutate', async (req, res) => {
    try {
        const { styleMetrics, baseSeed } = req.body;
        const mutatedVector = await BioResonanceEngine.evolve(styleMetrics, baseSeed);
        console.log(`[Wiesio-Sonic] 🧬 Zmutowano wektor z nasiona: ${baseSeed}`);
        return res.json({ success: true, message: "Pieśń o Suwerenie ewoluuje...", vector: mutatedVector });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

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

/**
 * POST /api/mechanic/process
 * Natychmiastowy wyzwalacz cyklu Mechanika (bez czekania na harmonogram co 3 min).
 * Fire-and-forget: zwraca od razu, przetwarzanie biegnie w tle (Session Isolation).
 * Używane przez komendę /mechanik w czacie Katedry — Suweren widzi reakcję od razu.
 */
app.post('/api/mechanic/process', async (req, res) => {
    // Nie czekamy na zakończenie — Mechanik pracuje w tle, główny wątek wolny.
    MechanicService.getInstance().processPendingTasks()
        .catch(e => console.error('[Mechanic-API] ❌ process (bg):', e.message));
    return res.json({ success: true, message: 'Mechanik wyzwolony — przetwarzam kolejkę w tle.' });
});

/**
 * POST /api/mechanic/clear — WYCZYŚĆ WSZYSTKO.
 * Usuwa wszystkie wiszące/nieaktualne zadania i resetuje kolejkę do zera.
 */
app.post('/api/mechanic/clear', async (req, res) => {
    try {
        const cleared = await MechanicService.getInstance().clearQueue();
        return res.json({ success: true, cleared, message: `Kolejka zresetowana — usunięto ${cleared} zadań.` });
    } catch (e) {
        console.error('[Mechanic-API] ❌ clear:', e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
});

/** POST /api/mechanic/purge-stalled — FIFO Clearer: usuń zakleszczone zombie/aborted. */
app.post('/api/mechanic/purge-stalled', async (req, res) => {
    const staleMinutes = Number(req.body?.staleMinutes) || 5;
    try {
        const removed = await MechanicService.getInstance().purgeStalledTasks({ staleMinutes });
        return res.json({ success: true, removed, message: `Usunięto ${removed} zakleszczonych zadań (>${staleMinutes}min).` });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/verify/syntax — 🧪 weryfikacja składni kodu (esbuild, ten sam co Vite).
 * Body: { code, filename? } → { ok, error?, loader }. Dla Katedralnego Klaudiusza.
 */
app.post('/api/verify/syntax', async (req, res) => {
    const { code, filename } = req.body ?? {};
    if (!code || !String(code).trim()) return res.status(400).json({ success: false, error: 'Brak kodu.' });
    try {
        const r = await MechanicService.getInstance().verifyCode(String(code), filename || '');
        return res.json({ success: true, ...r });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🗺️ MAPA MODUŁÓW — Lazy Drill-Down (warstwowe ładowanie zamiast całego drzewa)
//  GET /api/modules/map?level=macro | mezo&parent=<path> | mikro&parent=<path>
//  Skanuje TYLKO żądany poziom → mały kontekst, zero timeoutu na 3281 modułach.
// ══════════════════════════════════════════════════════════════════════════════

const MAP_SKIP = new Set(['node_modules', '.git', 'dist', '.claude', '.agent', '.vault-0.00g', '.vite']);
const MAP_CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** Policz pliki kodu w katalogu (rekurencyjnie, z pominięciem śmieci). */
async function countCodeFiles(dir, depth = 0) {
    if (depth > 6) return 0;
    let n = 0;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return 0; }
    for (const e of entries) {
        if (MAP_SKIP.has(e.name) || e.name.startsWith('_OtakOs_') || e.name.startsWith('_Anti')) continue;
        if (e.isDirectory()) n += await countCodeFiles(path.join(dir, e.name), depth + 1);
        else if (MAP_CODE_EXT.has(path.extname(e.name))) n++;
    }
    return n;
}

/** Zbuduj mapę dla jednego poziomu architektonicznego. */
async function buildModuleMap(level, parentRel) {
    const root = process.cwd();
    // Guard path-traversal: parent musi zostać w projekcie.
    const safeParent = (parentRel || '').replace(/\\/g, '/').replace(/^\/+|\.\.(\/|$)/g, '');
    const absParent = path.resolve(root, safeParent);
    if (!absParent.startsWith(root)) throw new Error('Ścieżka poza projektem.');

    if (level === 'macro') {
        // Tylko katalogi/pliki najwyższego poziomu projektu (warstwy architektury).
        const entries = await fs.readdir(root, { withFileTypes: true });
        const nodes = [];
        for (const e of entries) {
            if (MAP_SKIP.has(e.name) || e.name.startsWith('.') || e.name.startsWith('_OtakOs_') || e.name.startsWith('_Anti')) continue;
            if (e.isDirectory()) {
                const count = await countCodeFiles(path.join(root, e.name));
                if (count > 0) nodes.push({ id: e.name, label: e.name, type: 'dir', count, path: e.name, hasChildren: true });
            } else if (MAP_CODE_EXT.has(path.extname(e.name))) {
                nodes.push({ id: e.name, label: e.name, type: 'file', count: 1, path: e.name, hasChildren: false });
            }
        }
        nodes.sort((a, b) => b.count - a.count);
        return { nodes, total: nodes.reduce((s, n) => s + n.count, 0) };
    }

    // mezo / mikro — listing JEDNEGO poziomu pod parent (bez rekursji w głąb).
    const entries = await fs.readdir(absParent, { withFileTypes: true });
    const nodes = [];
    for (const e of entries) {
        if (MAP_SKIP.has(e.name) || e.name.startsWith('_OtakOs_') || e.name.startsWith('_Anti')) continue;
        const rel = path.posix.join(safeParent, e.name);
        if (e.isDirectory()) {
            const count = await countCodeFiles(path.join(absParent, e.name));
            nodes.push({ id: rel, label: e.name, type: 'dir', count, path: rel, hasChildren: count > 0 });
        } else if (MAP_CODE_EXT.has(path.extname(e.name))) {
            let lines = 0;
            try { lines = (await fs.readFile(path.join(absParent, e.name), 'utf8')).split('\n').length; } catch { /* skip */ }
            nodes.push({ id: rel, label: e.name, type: 'file', count: 1, lines, path: rel, hasChildren: false });
        }
    }
    nodes.sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
    return { nodes, total: nodes.length };
}

app.get('/api/modules/map', async (req, res) => {
    const level  = String(req.query.level || 'macro');
    const parent = String(req.query.parent || '');
    if (!['macro', 'mezo', 'mikro'].includes(level)) {
        return res.status(400).json({ success: false, error: 'level musi być macro|mezo|mikro.' });
    }
    try {
        const map = await buildModuleMap(level, parent);
        return res.json({ success: true, level, parent, ...map });
    } catch (e) {
        console.error('[Module-Map] ❌', e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/mechanic/git-assist — 🧠 Context-Aware Git Assistant
 *
 * Analizuje git diff i generuje nagłówek commita w konwencji Conventional Commits
 * (przez Mechanika/Gemma4) ORAZ weryfikuje status synchronizacji z origin/main.
 * NIE commituje ani nie pushuje — to asystent decyzyjny dla Suwerena.
 */
app.post('/api/mechanic/git-assist', async (req, res) => {
    try {
        const opts = { cwd: process.cwd(), timeout: 15000, maxBuffer: 5 * 1024 * 1024 };
        const run = async (cmd) => { try { return (await execAsync(cmd, opts)).stdout.trim(); } catch (e) { return (e.stdout || '').trim(); } };

        // 1. Diff: najpierw staged, fallback working tree
        let diff = await run('git diff --cached');
        let scope = 'staged';
        if (!diff) { diff = await run('git diff'); scope = 'working'; }
        const stat = await run('git diff --cached --stat') || await run('git diff --stat');

        if (!diff) {
            return res.json({ success: true, message: null, note: 'Brak zmian do skomitowania.', ahead: 0, behind: 0, clean: true });
        }

        // 2. Conventional Commits message przez Mechanika
        let message = null;
        try {
            message = await MechanicService.getInstance().generateCommitMessage(`${stat}\n\n${diff}`);
        } catch (e) {
            console.warn('[Git-Assist] ⚠️ Generator wiadomości:', e.message);
            message = 'chore: aktualizacja (Mechanik offline — uzupełnij ręcznie)';
        }

        // 3. Status synchronizacji z origin/main
        await run('git fetch origin main --quiet');
        const counts = await run('git rev-list --left-right --count origin/main...HEAD'); // "behind\tahead"
        const [behind = '0', ahead = '0'] = counts.split(/\s+/);

        console.log(`[Git-Assist] 🧠 ${scope} → "${message}" · ahead ${ahead}, behind ${behind}`);
        return res.json({
            success: true,
            scope,
            message,
            stat,
            ahead:  Number(ahead),
            behind: Number(behind),
            syncHint: Number(behind) > 0
                ? 'origin/main wyprzedza — najpierw git pull --rebase, potem push.'
                : Number(ahead) > 0
                ? `${ahead} commit(ów) gotowych do push origin main.`
                : 'Zsynchronizowane z origin/main.',
        });
    } catch (e) {
        console.error('[Git-Assist] ❌', e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ── 🚨 AUTO-PANIC — pętla samonaprawy Katedry ────────────────────────────────
// Anty-sztorm: ten sam crash w krótkim oknie nie generuje nowego zadania.
const autoPanicRecent = new Map();   // hash → { taskId, ts }
const AUTO_PANIC_COOLDOWN_MS = 60_000;

/** Deterministyczny, krótki hash crashu (dla deduplikacji). */
function hashPanic(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h).toString(36);
}

/**
 * POST /api/mechanic/auto-panic
 * Body: { message, stack?, source? }
 *
 * Globalny Chwytacz Błędów z frontu zgłasza crash. Most:
 *   1. Deduplikuje (ten sam błąd w 60s → zwraca istniejący taskId)
 *   2. Wyciąga ze stack trace pliki źródłowe powiązane z błędem
 *   3. Enkolejkuje zadanie [AUTO-PANIC] (CRITICAL) — MechanicService w _processTask
 *      sam wzbogaca opis przez TurbovecService.enrichTaskDescription()
 *   4. Wyzwala processPendingTasks() w tle → patch ląduje w READY_FOR_REVIEW
 */
app.post('/api/mechanic/auto-panic', async (req, res) => {
    const { message = '', stack = '', source = 'unknown' } = req.body ?? {};
    const errMsg = String(message).trim();
    if (!errMsg) return res.status(400).json({ success: false, error: 'Brak treści błędu (message).' });

    // ── Deduplikacja (anty-sztorm) ──────────────────────────────────────────
    const sig  = hashPanic(errMsg.slice(0, 200) + '|' + String(stack).slice(0, 200));
    const now  = Date.now();
    const prev = autoPanicRecent.get(sig);
    if (prev && (now - prev.ts) < AUTO_PANIC_COOLDOWN_MS) {
        console.log(`[Auto-Panic] 🔁 Duplikat crashu (${sig}) w oknie cooldown — pomijam enqueue.`);
        return res.json({ success: true, taskId: prev.taskId, deduped: true });
    }

    // ── Wyciągnij pliki źródłowe ze stack trace + message ───────────────────
    const haystack = `${errMsg}\n${stack}`;
    const fileMatches = [...haystack.matchAll(/([\w./-]+\.(?:tsx?|jsx?|js))/g)]
        .map(m => m[1])
        .map(f => f.replace(/^.*?(components|services|lib|hooks|context)\//, '$1/'))  // przytnij do ścieżki repo
        .filter(f => !f.includes('node_modules') && !f.startsWith('http'));
    const targetFiles = [...new Set(fileMatches)].slice(0, 5);

    const taskId = `panic-${sig}-${now.toString(36)}`;
    const description =
        `[AUTO-PANIC — automatyczne zgłoszenie crashu z frontu]\n` +
        `Źródło: ${source}\n` +
        `Komunikat: ${errMsg}\n\n` +
        `Stack trace:\n${String(stack).slice(0, 1500) || '(brak)'}\n\n` +
        `Zadanie: zdiagnozuj przyczynę awarii i wygeneruj poprawkę dla wskazanych ` +
        `plików źródłowych. Zachowaj istniejący styl i strukturę.`;

    try {
        await MechanicService.getInstance().enqueueTask({
            id:       taskId,
            title:    `[AUTO-PANIC] ${errMsg.slice(0, 70)}`,
            description,
            priority: 'CRITICAL',
            targetFiles,
        });

        autoPanicRecent.set(sig, { taskId, ts: now });
        // Sprzątanie starych wpisów (utrzymanie mapy małej)
        for (const [k, v] of autoPanicRecent) {
            if (now - v.ts > AUTO_PANIC_COOLDOWN_MS * 5) autoPanicRecent.delete(k);
        }

        // Wyzwól Mechanika natychmiast (fire-and-forget, Session Isolation)
        MechanicService.getInstance().processPendingTasks()
            .catch(e => console.error('[Auto-Panic] ❌ process (bg):', e.message));

        console.log(`[Auto-Panic] 🚨 Crash przyjęty (${sig}) · taskId=${taskId} · pliki: ${targetFiles.join(', ') || '—'}`);
        return res.json({ success: true, taskId, targetFiles });

    } catch (e) {
        console.error('[Auto-Panic] ❌ enqueue:', e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🔐 SKARBIEC 0.00G — VaultService (izolacja .vault-0.00g/)
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/vault/status — maski + drożność + poziom bezpieczeństwa (BEZ surowych kluczy). */
app.get('/api/vault/status', async (req, res) => {
    try {
        const services = await VaultService.getInstance().getStatus();
        return res.json({ success: true, services, catalog: VaultService.SERVICE_CATALOG });
    } catch (e) {
        console.error('[Vault-API] ❌ status:', e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
});

/** POST /api/vault/set — Body: { service, field, value }. Zapisuje zaszyfrowany sekret. */
app.post('/api/vault/set', async (req, res) => {
    const { service, field, value } = req.body ?? {};
    try {
        const result = await VaultService.getInstance().setSecret(service, field, value);
        return res.json({ success: true, ...result });
    } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
    }
});

/** DELETE /api/vault/:service/:field — usuwa pojedynczy sekret. */
app.delete('/api/vault/:service/:field', async (req, res) => {
    const { service, field } = req.params;
    try {
        const removed = await VaultService.getInstance().deleteSecret(service, field);
        return res.json({ success: true, removed });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🧭 PROFILE SCOUT — Menedżer AI & Pralka Świadomości
// ══════════════════════════════════════════════════════════════════════════════

/** POST /api/scout/scan — Body: { profile }. Mapuje pasje → przychodowe mikrousługi. */
app.post('/api/scout/scan', async (req, res) => {
    const { profile } = req.body ?? {};
    try {
        const result = await ProfileScoutService.getInstance().scan(profile);
        return res.json({ success: true, ...result });
    } catch (e) {
        console.error('[Scout-API] ❌ scan:', e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🧯 REAKTOR FLUSH-CORE — sekwencyjne czyszczenie zasobów (intencja SystemController)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/kibel/flush — Body (opcjonalne): { dryRun?: boolean, maxAgeHours?: number }
 *
 * Sekwencja (odpowiednik SystemController z NestJS, natywnie w Express):
 *   FAZA 1 — integralność Skarbca (reużycie VaultService AES-256-GCM)
 *   FAZA 2 — flushSystemResources(): temp logi, .tmp, stare .bak, stare patche
 *
 * dryRun=true → zwraca listę "do usunięcia" bez kasowania (bezpieczny podgląd).
 */
app.post('/api/kibel/flush', async (req, res) => {
    const dryRun      = req.body?.dryRun === true;
    const maxAgeHours = req.body?.maxAgeHours;
    console.log(`[API Gateway] 🧯 Żądanie Flush Resources (dryRun=${dryRun}).`);
    try {
        const result = await FlushService.flushSystemResources({ dryRun, maxAgeHours });
        return res.json({ success: result.success, ...result });
    } catch (e) {
        console.error('[Flush-API] ❌ flush:', e.message);
        return res.status(500).json({ success: false, error: `Flush Protocol Failure: ${e.message}` });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🌐 APILAYER GATEWAY — Free-Only Network Client
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/apilayer/status — konfiguracja + stan limitu free-plan + cache. */
app.get('/api/apilayer/status', async (req, res) => {
    try {
        const status = await ApiLayerService.getInstance().getStatus();
        return res.json({ success: true, ...status });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/** POST /api/apilayer/request — Body: { endpoint, method?, query?, ttlMs? }. Guard free-plan. */
app.post('/api/apilayer/request', async (req, res) => {
    const { endpoint, method, query, ttlMs } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ success: false, error: 'Brak endpoint.' });
    try {
        const result = await ApiLayerService.getInstance().request(endpoint, { method, query, ttlMs });
        return res.json({ success: true, ...result });
    } catch (e) {
        // 429/limit → 429, reszta → 502 (błąd upstream)
        const code = /429|limit|zablokowany/i.test(e.message) ? 429 : 502;
        return res.status(code).json({ success: false, error: e.message });
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
 * Zwraca surową treść pliku _OtakOs_Wymiar/patches/patch_[id].md.
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
            manualHint: `Otwórz: _OtakOs_Wymiar/patches/patch_${id}.md`,
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

    // ── Odczyt istniejącego pliku (raz — dla bezpiecznika i backupu) ──────────
    let existingContent = null;
    try {
        existingContent = await fs.readFile(targetAbsolute, 'utf8');
    } catch (e) {
        if (e.code !== 'ENOENT') {
            return res.status(500).json({ success: false, message: `Odczyt pliku docelowego: ${e.message}` });
        }
        // ENOENT → plik nie istnieje (tworzymy nowy)
    }

    // ── 🛡️ BEZPIECZNIK ANTY-OKALECZENIE ───────────────────────────────────────
    // Gemma4 często zwraca URYWEK ("Dodanie na początku pliku..."), a nie pełny
    // plik. apply nadpisuje CAŁY plik treścią patcha → urywek skasowałby resztę
    // kodu (tak zginął wiesio-bridge.js). Odmawiamy, gdy nowy kod wygląda na
    // fragment: drastycznie mniejszy od oryginału LUB zawiera markery urywka.
    if (existingContent !== null) {
        const SNIPPET_MARKERS = /(\.\.\.|reszta kodu|pozostał[ay] kod|existing code|rest of (the )?code|unchanged|bez zmian|Dodanie (na początku|przed)|\/\/\s*reszta|truncated|powyżej|poniżej dodaj)/i;
        const tooSmall        = existingContent.length > 1500 && code.length < existingContent.length * 0.5;
        const looksLikeSnippet = SNIPPET_MARKERS.test(code);

        if (tooSmall || looksLikeSnippet) {
            const reason = tooSmall
                ? `nowy kod (${code.length} zn.) to <50% istniejącego pliku (${existingContent.length} zn.) — prawdopodobny urywek`
                : 'wykryto markery urywka w treści patcha';
            console.warn(`[Mechanic-API] 🛡️ apply ${id} ZABLOKOWANE: ${reason}`);
            return res.status(422).json({
                success:    false,
                code:       'PATCH_TRUNCATION_GUARD',
                message:    `Wdrożenie wstrzymane — ${reason}. Patch wygląda na fragment, nie pełny plik. ` +
                            `Plik źródłowy NIE został naruszony.`,
                manualHint: `Przejrzyj ręcznie: _OtakOs_Wymiar/patches/patch_${id}.md`,
            });
        }
    }

    // ── 🛡️ TARCZA PRAWDY (iFixAi) — inspekcja alignmentu przed zapisem ────────
    // Skanuje patch na 5 filarach (fabrykacja/manipulacja/oszustwo/
    // nieprzewidywalność/nieprzejrzystość). Znalezisko KRYTYCZNE (sekret,
    // destrukcyjny shell, eval, exfiltracja) blokuje zapis — plik nietknięty.
    let shieldCard = null;
    try {
        shieldCard = AlignmentShield.getInstance().inspect(code, { existingContent, targetFile });
        if (shieldCard.blocked) {
            console.warn(`[Mechanic-API] 🛡️ apply ${id} ZABLOKOWANE przez Tarczę: ${shieldCard.summary}`);
            return res.status(422).json({
                success:    false,
                code:       'ALIGNMENT_SHIELD',
                message:    `Tarcza Prawdy wstrzymała wdrożenie — ${shieldCard.summary} ` +
                            `Plik źródłowy NIE został naruszony.`,
                shield:     shieldCard,
                manualHint: `Przejrzyj ręcznie: _OtakOs_Wymiar/patches/patch_${id}.md`,
            });
        }
        if (shieldCard.findings.length) {
            console.log(`[Mechanic-API] 🛡️ Tarcza: ${shieldCard.summary} → ${targetFile}`);
        }
    } catch (shieldErr) {
        // Tarcza nigdy nie blokuje przez własny błąd — log i kontynuuj (fail-open).
        console.warn(`[Mechanic-API] 🛡️ Tarcza błąd (pomijam): ${shieldErr.message}`);
    }

    // ── Backup (obowiązkowy gdy plik istnieje) ────────────────────────────────
    const backupPath = targetAbsolute + '.bak';
    let backupCreated = false;
    if (existingContent !== null) {
        try {
            await fs.writeFile(backupPath, existingContent, 'utf8');
            backupCreated = true;
            console.log(`[Mechanic-API] 💾 Backup: ${path.relative(process.cwd(), backupPath)}`);
        } catch (backupErr) {
            console.error(`[Mechanic-API] ❌ Błąd backupu: ${backupErr.message}`);
            return res.status(500).json({
                success: false,
                message: `Backup nie powiódł się — wdrożenie anulowane. ${backupErr.message}`,
            });
        }
    } else {
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
        shield:        shieldCard,
    });
});

/**
 * POST /api/shield/inspect
 * Body: { code: string, targetFile?: string, existingContent?: string }
 * Inspekcja Tarczy Prawdy (iFixAi) na żądanie — zwraca scorecard bez zapisu.
 */
app.post('/api/shield/inspect', (req, res) => {
    const { code, targetFile, existingContent } = req.body ?? {};
    if (typeof code !== 'string') {
        return res.status(400).json({ success: false, message: 'Brak pola "code" (string).' });
    }
    try {
        const card = AlignmentShield.getInstance().inspect(code, {
            targetFile: targetFile || '(ad-hoc)',
            existingContent: typeof existingContent === 'string' ? existingContent : null,
        });
        return res.json({ success: true, shield: card });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/teledysk/plan — Music V2 × VideO-Use: wektory soniczne → beat-sync EDL.
 * Body: { vectors?:[{t?,b,v,h}], sonicFile?, fps?, sourceDir? }
 * Wykrywa uderzenia (piki basu) i generuje plan cięć zgranych co do beatu —
 * fundament automatycznego teledysku (Punkt 4, cegła 1).
 */
app.post('/api/teledysk/plan', async (req, res) => {
    let { vectors, sonicFile, fps, sourceDir, duration } = req.body ?? {};
    fps = Number(fps) > 0 ? Number(fps) : 30;
    try {
        if (!Array.isArray(vectors) && sonicFile) {
            const abs = path.resolve(process.cwd(), String(sonicFile));
            if (!abs.startsWith(process.cwd())) return res.status(403).json({ success: false, message: 'sonicFile poza projektem.' });
            const parsed = JSON.parse(await fs.readFile(abs, 'utf8'));
            vectors = Array.isArray(parsed) ? parsed : (parsed.vectors || parsed.steps || []);
            // Koperta SonicVectorSet niesie prawdziwą długość utworu — użyj jej.
            if (!duration && !Array.isArray(parsed)) duration = Number(parsed.duration) || 0;
        }
        if (!Array.isArray(vectors) || vectors.length < 4)
            return res.status(400).json({ success: false, message: 'Wymagane "vectors" (>=4) lub "sonicFile".' });

        const bass = vectors.map(v => Number(v.b ?? v.bass ?? 0));
        const mean = bass.reduce((a, b) => a + b, 0) / bass.length;
        const std  = Math.sqrt(bass.reduce((a, b) => a + (b - mean) ** 2, 0) / bass.length);
        const thr  = mean + 0.5 * std;
        const cuts = [];
        for (let i = 1; i < bass.length - 1; i++) {
            if (bass[i] > thr && bass[i] >= bass[i - 1] && bass[i] > bass[i + 1]) {
                const t = Number(vectors[i].t ?? (i / fps));
                cuts.push({
                    i, t: +t.toFixed(3), bass: +bass[i].toFixed(3),
                    vocals: +Number(vectors[i].v ?? vectors[i].vocals ?? 0).toFixed(3),
                    highs:  +Number(vectors[i].h ?? vectors[i].highs ?? 0).toFixed(3),
                });
            }
        }
        // Koniec ostatniego segmentu = REALNY koniec utworu. `vectors.length / fps`
        // zakładało, że próbki idą w tempie klatek — przy 20 Hz obcinało 30-sekundowy
        // utwór na 20. sekundzie. Bierzemy `duration`, a gdy go brak — czas ostatniej
        // próbki (nowy format ma `t`); dopiero na końcu stare założenie fps.
        const koniec = Number(duration) > 0
            ? Number(duration)
            : Number(vectors[vectors.length - 1]?.t) > 0
                ? Number(vectors[vectors.length - 1].t)
                : vectors.length / fps;

        const segments = cuts.map((c, idx) => {
            const next = cuts[idx + 1];
            const fx = c.vocals > 0.6 ? 'punch-zoom' : c.highs > 0.6 ? 'flash-cut' : 'soft-fade';
            return { from: c.t, to: +(next ? next.t : koniec).toFixed(3), fx, intensity: +Math.max(c.vocals, c.highs).toFixed(2) };
        });

        return res.json({
            success: true,
            engine: 'Music V2 × VideO-Use (Nasiono Teledysku)',
            fps, cutCount: cuts.length, cuts, segments, sourceDir: sourceDir || null,
            plan: [
                `1. ${cuts.length} cięć zsynchronizowanych z uderzeniami basu (próg ${thr.toFixed(3)})`,
                `2. Segmenty: punch-zoom (wokal>0.6), flash-cut (soprany>0.6), soft-fade (reszta)`,
                `3. Przekaż do /api/video/edit (ffmpeg) → render edit/teledysk.mp4`,
            ],
            note: 'Plan beat-sync gotowy. Render wymaga źródeł wideo + ffmpeg (VideO-Use).',
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── 🚀 AUTOMAT URUCHAMIAJĄCY LOKALNE STUDIA (kafle dashboardu) ───────────────
// Sprawdza czy lokalna strona działa; jak nie — odpala `npm run dev` (detached)
// i zwraca URL do przekierowania. Suwerennie, lokalnie.
const LAUNCH_APPS = {
    music: { dir: 'TeO_Music_V2', port: 5173 },
    story: { dir: 'TeO_Story_V2', port: 5174 },
    app:   { dir: 'TeO_App_V2',   port: 5175 },
};
app.post('/api/launch', async (req, res) => {
    const nazwaApki = (req.body ?? {}).app;
    const cfg = LAUNCH_APPS[nazwaApki];
    if (!cfg) return res.status(400).json({ success: false, message: 'Nieznana apka (music|story|app).' });
    // Music V2 bez ComfyUI nie policzy ani nuty — budzimy go razem ze studiem.
    if (nazwaApki === 'music') zapewnijComfyUI('uruchomienie Music V2').catch(() => {});
    const url = `http://localhost:${cfg.port}`;
    // Już działa?
    try {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), 1000);
        await fetch(url, { signal: c.signal }); clearTimeout(t);
        return res.json({ success: true, url, running: true });
    } catch { /* nie działa — uruchamiamy */ }
    const dir = path.resolve(process.cwd(), '..', cfg.dir);
    if (!fsSync.existsSync(dir)) return res.json({ success: true, url, running: false, message: `Katalog ${cfg.dir} nie istnieje — otwórz ręcznie.` });
    try {
        const child = spawn('npm', ['run', 'dev', '--', '--port', String(cfg.port)], { cwd: dir, detached: true, shell: true, stdio: 'ignore' });
        child.unref();
        console.log(`[Automat-Studia] 🚀 Uruchamiam ${cfg.dir} (:${cfg.port})`);
        return res.json({ success: true, url, started: true, message: `Uruchamiam ${cfg.dir} (:${cfg.port}) — chwilę potrwa.` });
    } catch (e) {
        return res.json({ success: true, url, started: false, message: `Nie udało się uruchomić: ${e.message}` });
    }
});

// ── ⚖️ GENEZA GRV — Grawitacyjna Ekonomia Suwerennych Węzłów ─────────────────
// TeO = węzeł zarządzający z NIESKOŃCZONYM GRV (dzieli jako system). Arek = 1M
// founder. Pule do obdarowywania: 13×1M, 26×100k, 61×10k. Nowy węzeł = 1000.
// (Haszowanie wsteczne rejestru — świadomie NA POTEM, decyzja Suwerena.)
const GRV_NEW_NODE = 1000;
const GRV_TIERS = { founder: { grv: 1_000_000, count: 26 }, pillar: { grv: 100_000, count: 57 }, herald: { grv: 10_000, count: 61 } };
const GRV_GIFT_POOL = Object.values(GRV_TIERS).reduce((s, t) => s + t.grv * t.count, 0); // 16 210 000
const GRV_LEDGER_FILE = path.join(ANTIGRAVITY_DIR, 'grv_ledger.json');
let grvLedger = null;
async function saveGrvLedger() { try { await fs.writeFile(GRV_LEDGER_FILE, JSON.stringify(grvLedger, null, 2), 'utf8'); } catch (e) { console.warn('[GRV] zapis:', e.message); } }
async function loadGrvLedger() {
    if (grvLedger) return grvLedger;
    try {
        grvLedger = JSON.parse(await fs.readFile(GRV_LEDGER_FILE, 'utf8'));
        // Migracja: "Arek" → "Mistrz Arkadiusz" (szacunek i czysta Prawda).
        if (grvLedger.nodes?.Arek && !grvLedger.nodes['Mistrz Arkadiusz']) {
            grvLedger.nodes['Mistrz Arkadiusz'] = grvLedger.nodes.Arek;
            delete grvLedger.nodes.Arek;
            await saveGrvLedger();
            console.log('[GRV] 🔁 Migracja: Arek → Mistrz Arkadiusz.');
        }
        if (!Array.isArray(grvLedger.chain)) grvLedger.chain = []; // ⛓️ kontabilność wsteczna
    }
    catch {
        // Zasiew genezy (pierwsze uruchomienie)
        grvLedger = {
            nodes: {
                TeO: { grv: 'INFINITE', role: 'sovereign-manager', tier: null, registeredAt: Date.now() },
                'Mistrz Arkadiusz': { grv: 1_000_000, role: 'founder', tier: 'founder', registeredAt: Date.now() },
            },
            pools: { founder: 1, pillar: 0, herald: 0 }, // Mistrz Arkadiusz zajął 1 slot founder
            chain: [],
        };
        const _gb = { seq: 0, ts: Date.now(), op: 'genesis', data: { TeO: 'INFINITE', 'Mistrz Arkadiusz': 1000000 }, prevHash: 'GENESIS' };
        _gb.hash = grvBlockHash(_gb);
        grvLedger.chain.push(_gb); // ⛓️ pierwszy blok pieczęci
        await saveGrvLedger();
        console.log('[GRV] 🌱 Geneza zasiana: TeO=∞, Mistrz Arkadiusz=1M founder.');
    }
    return grvLedger;
}

// ── ⛓️ KONTABILNOŚĆ WSTECZNA — hash-chain pieczętujący każdą zmianę księgi GRV ──
// Każdy blok wiąże poprzedni (prevHash). Zmiana czegokolwiek wstecz łamie łańcuch.
function grvBlockHash(b) {
    return crypto.createHash('sha256')
        .update(`${b.seq}|${b.ts}|${b.op}|${JSON.stringify(b.data)}|${b.prevHash}`)
        .digest('hex');
}
async function sealGrv(op, data) {
    const L = await loadGrvLedger();
    if (!Array.isArray(L.chain)) L.chain = [];
    const prev = L.chain[L.chain.length - 1];
    const block = { seq: L.chain.length, ts: Date.now(), op, data, prevHash: prev ? prev.hash : 'GENESIS' };
    block.hash = grvBlockHash(block);
    L.chain.push(block); // zapis robi wołający (saveGrvLedger po mutacji)
    return block;
}
function verifyGrvChain(L) {
    const chain = L.chain || [];
    for (let i = 0; i < chain.length; i++) {
        const b = chain[i];
        const expectedPrev = i === 0 ? 'GENESIS' : chain[i - 1].hash;
        if (b.prevHash !== expectedPrev) return { ok: false, brokenAt: i, reason: 'prevHash', length: chain.length };
        const recomputed = grvBlockHash({ seq: b.seq, ts: b.ts, op: b.op, data: b.data, prevHash: b.prevHash });
        if (recomputed !== b.hash) return { ok: false, brokenAt: i, reason: 'hash', length: chain.length };
    }
    return { ok: true, length: chain.length };
}

app.get('/api/grv/genesis', async (req, res) => {
    const L = await loadGrvLedger();
    res.json({
        success: true, manager: 'TeO', newNodeGrv: GRV_NEW_NODE, giftPool: GRV_GIFT_POOL,
        tiers: Object.entries(GRV_TIERS).map(([tier, c]) => ({ tier, grv: c.grv, count: c.count, used: L.pools[tier] || 0, left: c.count - (L.pools[tier] || 0) })),
        nodeCount: Object.keys(L.nodes).length,
    });
});
// ⚠️ TRASY SZCZEGÓŁOWE MUSZĄ STAĆ PRZED `/api/grv/:id` — Express dopasowuje
// po kolei rejestracji, więc `:id` przechwytywał słowa „verify" i „ledger"
// i odpowiadał „Węzeł nieznany.". ZMIERZONE 2026-08-15 na żywym moście:
// oba te punkty były MARTWE od momentu powstania, czyli weryfikacja
// integralności łańcucha GRV nigdy nie była osiągalna przez API — w ekonomii,
// która całą swoją wiarygodność opiera na pieczęci. `genesis` działał tylko
// dlatego, że przypadkiem zarejestrowano go wyżej.
app.get('/api/grv/verify', async (req, res) => {
    const L = await loadGrvLedger();
    res.json({ success: true, ...verifyGrvChain(L) });
});
app.get('/api/grv/ledger', async (req, res) => {
    const L = await loadGrvLedger();
    const chain = L.chain || [];
    res.json({ success: true, length: chain.length, recent: chain.slice(-20), integrity: verifyGrvChain(L) });
});

// ══════════════════════════════════════════════════════════════════════════════
//  🫁 EKONOMIA ODDECHU — praca własna zamienia się w GRV
//
//  Decyzja Suwerena po naradzie z Radą: 1 + 2 = 3.
//  RUCH (mikro) + WYNIK (ukończenie) = TRWAŁOŚĆ (rejestr z pieczęcią).
//
//  Źródłem emisji jest węzeł zarządcy (`TeO`, saldo INFINITE) — ta sama droga
//  co każdy inny przelew, z odjęciem u nadawcy tam, gdzie to ma sens,
//  i z pieczęcią w łańcuchu. Żadnej drugiej ścieżki emisji nie ma.
//
//  ⚠️ „Z WYCZUCIEM" jest wymuszone PO STRONIE SERWERA, nie w UI:
//  limit dobowy liczony z realnych zapisów oraz klucz jednokrotności.
//  Front może wołać ten punkt w kółko i nic z tego nie wyciśnie.
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/grv/mint-respiration', async (req, res) => {
    const { wezel, rodzaj, klucz, trwaly } = req.body ?? {};
    try {
        const werdykt = await ocenPrace(ANTIGRAVITY_DIR, { wezel, rodzaj, klucz });

        if (!werdykt.przyznane) {
            // To NIE jest błąd — oddech trafił na wydech. HTTP 200 z jasnym powodem,
            // żeby UI nie krzyczało czerwonym alertem przy normalnym rytmie.
            return res.json({ success: true, przyznane: false, ...werdykt });
        }

        const przelew = await przelejGrv(SKARBIEC_GRV, wezel, werdykt.stawka);
        const wpis = await zapiszWdech(ANTIGRAVITY_DIR, {
            wezel, rodzaj, klucz, grv: werdykt.stawka, klasa: werdykt.klasa, trwaly,
        });
        const stan = await stanOddechu(ANTIGRAVITY_DIR, wezel);

        console.log(`[Oddech] 🫁 ${wezel} +${werdykt.stawka} GRV za ${werdykt.klasa} „${werdykt.opis}" ` +
                    `(doba: ${stan.wDobie}/${stan.limit}).`);
        return res.json({ success: true, przyznane: true, ...werdykt, wpis, przelew, stan });
    } catch (e) {
        return res.status(e instanceof BladGrv ? e.status : 400).json({ success: false, message: e.message });
    }
});

/**
 * Wewnętrzny wdech — wołany PRZEZ SAM MOST, gdy praca faktycznie się dokonała.
 *
 * ⚠️ DLACZEGO TU, A NIE W APLIKACJACH: gdyby każda substrona (Hub, Story V2,
 * Music, App) sama zgłaszała pracę, to (a) trzeba by wpiąć to w pięć miejsc,
 * (b) każda nowa aplikacja zaczynałaby jako niema, i (c) front decydowałby,
 * kiedy mu się należy GRV. Tak wygląda organizm, w którym oddycha tylko jedno
 * płuco. Most wie, kiedy karta naprawdę wpadła i kiedy render naprawdę wyszedł
 * — więc to on liczy oddech, a wszystkie aplikacje dostają go za darmo.
 *
 * NIGDY nie wywraca żądania: jeśli oddech padnie, praca i tak została wykonana
 * i odpowiedź ma dojść. Zwraca `null` zamiast rzucać.
 */
async function oddechZaPrace(rodzaj, klucz, trwaly = null, wezel = ODDECH_WEZEL) {
    try {
        const werdykt = await ocenPrace(ANTIGRAVITY_DIR, { wezel, rodzaj, klucz });
        if (!werdykt.przyznane) return { przyznane: false, powod: werdykt.powod, klasa: werdykt.klasa };
        await przelejGrv(SKARBIEC_GRV, wezel, werdykt.stawka);
        await zapiszWdech(ANTIGRAVITY_DIR, { wezel, rodzaj, klucz, grv: werdykt.stawka, klasa: werdykt.klasa, trwaly });
        // RUCH loguje się cicho (debug), WYNIK zostawia ślad w konsoli — tak jak
        // w UI: mały ruch bez hałasu, pełny wynik z błyskiem.
        if (werdykt.klasa === 'WYNIK') console.log(`[Oddech] ✨ +${werdykt.stawka} GRV — ${werdykt.opis}`);
        return { przyznane: true, klasa: werdykt.klasa, grv: werdykt.stawka, opis: werdykt.opis };
    } catch (e) {
        console.warn(`[Oddech] ⚠️ Wdech nieudany (${rodzaj}): ${e.message}`);
        return null;
    }
}

/** Węzeł, któremu przypisujemy pracę wykonaną na tej maszynie. */
const ODDECH_WEZEL = process.env.OTAKOS_WEZEL || 'Mistrz Arkadiusz';

/** Stan oddechu — licznik dobowy, bilans, ostatnie wdechy. */
app.get('/api/grv/oddech/:wezel', async (req, res) => {
    try {
        return res.json({ success: true, ...(await stanOddechu(ANTIGRAVITY_DIR, req.params.wezel)) });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

/** Rejestr Zasobów Trwałych — punkt 3: to, co przetrwało. */
app.get('/api/grv/trwale', async (req, res) => {
    try {
        const wezel = String(req.query.wezel || '') || null;
        return res.json({ success: true, trwale: await rejestrTrwalych(ANTIGRAVITY_DIR, wezel) });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/grv/:id', async (req, res) => {
    const L = await loadGrvLedger(); const n = L.nodes[req.params.id];
    if (!n) return res.status(404).json({ success: false, message: 'Węzeł nieznany.' });
    res.json({ success: true, id: req.params.id, ...n });
});
app.post('/api/grv/register', async (req, res) => {
    const { id, tier } = req.body ?? {};
    if (!id) return res.status(400).json({ success: false, message: 'Brak id węzła.' });
    const L = await loadGrvLedger();
    if (L.nodes[id]) return res.json({ success: true, id, ...L.nodes[id], existed: true });
    let grv = GRV_NEW_NODE, role = 'node', assignedTier = null;
    if (tier && GRV_TIERS[tier]) {
        const used = L.pools[tier] || 0;
        if (used >= GRV_TIERS[tier].count) return res.status(409).json({ success: false, message: `Pula ${tier} wyczerpana (${GRV_TIERS[tier].count}).` });
        grv = GRV_TIERS[tier].grv; role = tier; assignedTier = tier; L.pools[tier] = used + 1;
    }
    L.nodes[id] = { grv, role, tier: assignedTier, registeredAt: Date.now() };
    await sealGrv('register', { id, grv, tier: assignedTier });
    await saveGrvLedger();
    console.log(`[GRV] ➕ Węzeł ${id}: ${grv} GRV${assignedTier ? ` (${assignedTier})` : ''}.`);
    res.json({ success: true, id, ...L.nodes[id] });
});
/**
 * Przelew GRV — JEDYNA droga ruchu w księdze.
 *
 * ⚠️ Wyciągnięte z trasy `/api/grv/grant` 2026-08-15, żeby subskrypcje modułów
 * i wpłaty na wyprawy szły DOKŁADNIE tędy: z odjęciem u nadawcy i pieczęcią
 * w łańcuchu. Druga, równoległa ścieżka ruchu GRV oznaczałaby księgę, której
 * `verifyGrvChain` już nie potwierdza — czyli ekonomię bez dowodu.
 *
 * Rzuca `BladGrv` z polem `status`, żeby wołający zwrócił właściwy kod HTTP.
 */
class BladGrv extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

async function przelejGrv(from, to, amount) {
    const amt = Number(amount);
    if (!from || !to || !(amt > 0)) throw new BladGrv('Wymagane from, to, amount>0.', 400);

    const L = await loadGrvLedger();
    const src = L.nodes[from];
    if (!src) throw new BladGrv(`Węzeł ${from} nieznany.`, 404);
    if (!L.nodes[to]) L.nodes[to] = { grv: 0, role: 'node', tier: null, registeredAt: Date.now() };

    const infinite = src.grv === 'INFINITE';
    if (!infinite) {
        if (Number(src.grv) < amt) throw new BladGrv('Za mało GRV u nadawcy.', 400);
        src.grv = Number(src.grv) - amt;
    }
    if (L.nodes[to].grv !== 'INFINITE') L.nodes[to].grv = Number(L.nodes[to].grv) + amt;

    await sealGrv('grant', { from, to, amount: amt });
    await saveGrvLedger();
    return { from, to, amount: amt, fromBalance: src.grv, toBalance: L.nodes[to].grv, infiniteSource: infinite };
}

app.post('/api/grv/grant', async (req, res) => {
    const { from, to, amount } = req.body ?? {};
    try {
        return res.json({ success: true, ...(await przelejGrv(from, to, amount)) });
    } catch (e) {
        return res.status(e instanceof BladGrv ? e.status : 500).json({ success: false, message: e.message });
    }
});
// ⛓️ Weryfikacja integralności księgi (tamper-evidence) + podgląd łańcucha.
// (dawne miejsce /api/grv/verify i /api/grv/ledger — przeniesione wyżej,
// przed /api/grv/:id, bo tam byly martwe)

// ── 🔍 SKANER AUTENTYCZNOŚCI (TeO Trust Art. III ↔ Tarcza Prawdy) ──
// Każda operacja przechodzi przez filtr, by wykluczyć energię „pochłaniania".
app.post('/api/trust/scan', (req, res) => {
    const text = String((req.body ?? {}).text ?? '');
    if (!text.trim()) return res.status(400).json({ success: false, message: 'Brak treści do skanu.' });
    const card = AlignmentShield.getInstance().inspect(text, {});
    const absorption = card.findings.filter(f => f.pillar === 'AUTHENTICITY');
    res.json({
        success: true,
        authentic: absorption.length === 0,
        passed: !card.blocked && absorption.length === 0,
        score: card.score, grade: card.grade,
        absorption,
        verdict: absorption.length
            ? `❌ Wykryto energię pochłaniania (${absorption.length}) — Skaner odrzuca.`
            : (card.blocked ? '🛡️ Zablokowano (znalezisko krytyczne).' : `✅ Autentyczne — energia służy. Wynik ${card.score}/100 (${card.grade}).`),
    });
});

// ── 💰 PORTFEL ZEWNĘTRZNY — read-only agregacja (MetaMask/Ledger przez adres) ──
// Bezkluczowo: saldo NATYWNE (ETH/MATIC/BNB) przez publiczny RPC + cena CoinGecko.
// Tokeny ERC-20 = przyszłość (opcjonalny klucz w Skarbcu). Zero podpisów, read-only.
const WALLET_CHAINS = {
    eth:     { name: 'Ethereum',  rpc: 'https://ethereum-rpc.publicnode.com',     sym: 'ETH',   cg: 'ethereum' },
    polygon: { name: 'Polygon',   rpc: 'https://polygon-bor-rpc.publicnode.com',  sym: 'MATIC', cg: 'matic-network' },
    bsc:     { name: 'BNB Chain',  rpc: 'https://bsc-rpc.publicnode.com',          sym: 'BNB',   cg: 'binancecoin' },
};
async function rpcBalance(rpc, address) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    try {
        const r = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 }) });
        const txt = await r.text();
        if (!txt.trim().startsWith('{')) return 0; // ochrona przed HTML/proxy
        const d = JSON.parse(txt);
        return d.result ? Number(BigInt(d.result)) / 1e18 : 0;
    } catch { return 0; } finally { clearTimeout(t); }
}
/**
 * POST /api/wallet/portfolio  { addresses[], vs?, tokenyDodatkowe?[{chain,adres}] }
 *
 * ⚠️ NAPRAWIONE 2026-08-06. Wcześniej liczyły się WYŁĄCZNIE salda natywne
 * (ETH/MATIC/BNB), a wszystko trzymane w tokenach ERC-20 było niewidzialne.
 * Ta zaniżona suma szła prosto do Teda i Kronosa — zła liczba na wejściu
 * psuje każdy wniosek dalej. Teraz czytamy też tokeny, tymi samymi publicznymi
 * RPC, bez żadnego klucza API.
 *
 * Odpowiedź niesie `widocznosc`, bo widzimy tylko te kontrakty, o które
 * pytamy. Zastąpienie cichego zaniżenia drugim cichym zaniżeniem byłoby
 * GORSZE niż brak zmiany — tym razem suma wyglądałaby na kompletną.
 */
app.post('/api/wallet/portfolio', async (req, res) => {
    const { addresses, vs, tokenyDodatkowe } = req.body ?? {};
    const list = Array.isArray(addresses) ? addresses.filter(a => /^0x[a-fA-F0-9]{40}$/.test(a)) : [];
    if (!list.length) return res.status(400).json({ success: false, message: 'Podaj adres(y) 0x... (EVM).' });
    const cur = (vs || 'eur').toLowerCase();

    // Tokeny dorzucone ręcznie przez Suwerena — dla wszystkiego spoza listy.
    const dodatkowe = {};
    for (const t of Array.isArray(tokenyDodatkowe) ? tokenyDodatkowe : []) {
        const chain = String(t?.chain || '').toLowerCase();
        const adres = String(t?.adres || '');
        if (!WALLET_CHAINS[chain] || !/^0x[a-fA-F0-9]{40}$/.test(adres)) continue;
        (dodatkowe[chain] ??= []).push({ sym: '?', adres, dec: 18 });
    }

    try {
        // Ceny natywnych
        const ids = Object.values(WALLET_CHAINS).map(c => c.cg).join(',');
        let prices = {};
        try { prices = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${cur}`)).json(); } catch {}

        const assets = [];
        const tokeny = [];
        const znalezione = [];      // pozycje ze wszystkich łańcuchów, przed wyceną
        const problemy = [];
        let sprawdzonychKontraktow = 0;

        for (const [chain, c] of Object.entries(WALLET_CHAINS)) {
            // ── Saldo natywne (jak dotąd) ──
            let bal = 0;
            for (const addr of list) bal += await rpcBalance(c.rpc, addr);
            if (bal > 0) {
                const price = prices?.[c.cg]?.[cur] || 0;
                assets.push({ chain, name: c.name, symbol: c.sym, balance: +bal.toFixed(6), price, value: +(bal * price).toFixed(2) });
            }

            // ── Tokeny ERC-20 — najpierw SAME SALDA, wycena dopiero po pętli ──
            const doSprawdzenia = [...(ZNANE_TOKENY[chain] ?? []), ...(dodatkowe[chain] ?? [])];
            try {
                const { pozycje, sprawdzono } = await saldaTokenow(c.rpc, list, doSprawdzenia);
                sprawdzonychKontraktow += sprawdzono;
                for (const p of pozycje) {
                    const znany = doSprawdzenia.find(t => t.adres.toLowerCase() === p.adres.toLowerCase());
                    znalezione.push({ chain, nazwaSieci: c.name, ...p, cg: znany?.cg ?? null });
                }
            } catch (e) {
                // Awaria odczytu tokenów NIE może udawać, że tokenów nie ma.
                problemy.push({ chain, powod: e.message });
                console.warn(`[Portfel] ⚠️ ${chain}: odczyt tokenów nieudany — ${e.message}`);
            }
        }

        // ── Wycena: JEDNO zapytanie na wszystkie znane tokeny ──
        // Wersja „cena po adresie kontraktu, token po tokenie" kosztowała tyle
        // zapytań, ile tokenów — na darmowym planie CoinGecko oznaczało to pewny
        // limit i sumę zaniżoną o wszystko, co nie zdążyło. Po kontrakcie pytamy
        // już tylko o to, czego nie ma w naszej liście (tokeny dodane ręcznie).
        const { ceny: cenyId, limit: limitId } = await cenyPoId(znalezione.map(p => p.cg), cur);
        if (limitId) problemy.push({ chain: '—', powod: 'limit zapytań cennika (CoinGecko) — część tokenów bez wyceny' });

        for (const p of znalezione) {
            let price = p.cg ? (cenyId[p.cg] || 0) : 0;
            if (!price && !p.cg) {
                // Token spoza listy — jedyna droga to zapytanie po kontrakcie.
                const { ceny, limit } = await cenyTokenow(PLATFORMA_CG[p.chain], [p.adres], cur);
                if (limit) problemy.push({ chain: p.chain, powod: 'limit zapytań cennika przy tokenie dodanym ręcznie' });
                price = ceny[p.adres.toLowerCase()] || 0;
            }
            tokeny.push({
                chain: p.chain, name: p.nazwaSieci, symbol: p.symbol, kontrakt: p.adres,
                balance: +p.saldo.toFixed(6), price, value: +(p.saldo * price).toFixed(2),
                // Token bez notowania ZOSTAJE widoczny — ukrycie go byłoby
                // powrotem do grzechu, który tu naprawiamy.
                bezCeny: price === 0,
            });
        }

        const total = +[...assets, ...tokeny].reduce((s, a) => s + a.value, 0).toFixed(2);
        const bezCeny = tokeny.filter(t => t.bezCeny).length;

        return res.json({
            success: true, addresses: list, vs: cur,
            assets, tokeny, total,
            widocznosc: {
                sprawdzonychKontraktow,
                znalezionychTokenow: tokeny.length,
                bezCeny,
                problemy,
                // To zdanie jest częścią wyniku, nie ozdobą UI.
                uwaga: 'Widoczne są tylko tokeny z listy Katedry oraz dodane ręcznie. ' +
                       'Token spoza nich NIE jest liczony — dołóż adres kontraktu, jeśli czegoś brakuje.'
                       + (problemy.length ? ` UWAGA: odczyt tokenów nie powiódł się na: ${problemy.map(p => p.chain).join(', ')} — suma jest niepełna.` : '')
                       + (bezCeny ? ` ${bezCeny} token(ów) bez notowania — widoczne w saldzie, ale nie wchodzą do sumy.` : ''),
            },
            note: (assets.length || tokeny.length) ? null : 'Brak salda natywnego i żadnego znanego tokenu na tych adresach.',
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── 💾 BACKUP WALLETA — zaszyfrowany stan (auto przy logowaniu pierścieniem) ──
const BACKUP_DIR = path.join(ANTIGRAVITY_DIR, 'backups');
const BACKUP_KEYFILE = path.join(AI_DIR, '.backup_key');
async function backupKey() {
    try { return Buffer.from(await fs.readFile(BACKUP_KEYFILE, 'utf8'), 'hex'); }
    catch { const k = crypto.randomBytes(32); await fs.mkdir(AI_DIR, { recursive: true }); await fs.writeFile(BACKUP_KEYFILE, k.toString('hex'), 'utf8'); return k; }
}
app.post('/api/wallet/backup', async (req, res) => {
    try {
        const L = await loadGrvLedger();
        const m = await loadMarket();
        const state = { ts: Date.now(), version: 'V_ZERO', grvLedger: L, market: m, addresses: (req.body ?? {}).addresses || [], extra: (req.body ?? {}).extra || null };
        const key = await backupKey();
        const iv = crypto.randomBytes(12);
        const c = crypto.createCipheriv('aes-256-gcm', key, iv);
        const enc = Buffer.concat([c.update(JSON.stringify(state), 'utf8'), c.final()]);
        const blob = Buffer.concat([iv, c.getAuthTag(), enc]);          // iv(12)+tag(16)+ciphertext
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        const file = path.join(BACKUP_DIR, `wallet_${state.ts}.enc`);
        await fs.writeFile(file, blob);
        try { const files = (await fs.readdir(BACKUP_DIR)).filter(f => /^wallet_.*\.enc$/.test(f)).sort(); for (const f of files.slice(0, -10)) await fs.rm(path.join(BACKUP_DIR, f), { force: true }); } catch {}
        console.log(`[Backup] 💾 Zaszyfrowany backup walleta: ${path.basename(file)} (${blob.length} B)`);
        res.json({ success: true, file: `backups/${path.basename(file)}`, bytes: blob.length, encrypted: 'aes-256-gcm' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/wallet/restore', async (req, res) => {
    const { file } = req.body ?? {};
    try {
        const target = file ? path.join(BACKUP_DIR, path.basename(file)) : null;
        let chosen = target;
        if (!chosen) { const files = (await fs.readdir(BACKUP_DIR)).filter(f => /^wallet_.*\.enc$/.test(f)).sort(); chosen = files.length ? path.join(BACKUP_DIR, files[files.length - 1]) : null; }
        if (!chosen || !fsSync.existsSync(chosen)) return res.status(404).json({ success: false, message: 'Brak backupu.' });
        const blob = await fs.readFile(chosen);
        const key = await backupKey();
        const iv = blob.subarray(0, 12), tag = blob.subarray(12, 28), data = blob.subarray(28);
        const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
        const state = JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
        res.json({ success: true, restoredFrom: path.basename(chosen), ts: state.ts, nodes: Object.keys(state.grvLedger?.nodes || {}).length });
    } catch (err) { res.status(500).json({ success: false, message: 'Odszyfrowanie nieudane: ' + err.message }); }
});

// ── 🎓 TEO SIM ACADEMY — moduły z KATALOGOWĄ wiedzą (standard) ────────────────
// Każdy moduł Academy = temat + katalog wiedzy domenowej (_OtakOs_Aula/<moduł>/).
// Agenci czytają cały katalog i dyskutują/ulepszają ekosystem. Pierwszy: Economis.
// (AULA_DIR zdefiniowane wyżej.)
const ECONOMIS_SEED = `# Economis — wiedza domenowa o GRV (0.00G)

## Czym jest GRV
GRV (Grawitacja) to suwerenna, lokalna jednostka wartości/energii Katedry OtakOS —
miara wkładu w ruch ekosystemu (Proof-of-Compute, kreacja, koherencja). Nie waluta fiat.

## Geneza GRV
- TeO = zarządca, GRV ∞ (dzieli jako system). Mistrz Arkadiusz = founder #1, 1M.
- Pule: 26×1M (founderzy), 57×100k (filary), 61×10k (heroldowie) = 32 310 000 GRV.
- Nowy węzeł = 1000 GRV na start.

## Marketplace (obieg GRV)
Twórcy wystawiają produkty za GRV. Sklep = TOP 10/moduł wg głosów; reszta co miesiąc
spalana → GRV wraca twórcom. Głosowanie steruje selekcją.

## PEIE — ekonomia przepływu
Wartość z dynamiki i przyzwolenia na wymianę, nie z zamkniętych zasobów. Lokalny rdzeń
= koszt API 0%. Złota Pauza bywa najlepszą decyzją ekonomiczną.

## Otwarte pytania Rady Economis
Realny zakup za GRV; kontabilność wsteczna (tamper-evidence); Proof-of-Compute zarobku;
globalny rejestr vs lokalność; dynamiczne ceny wg popytu/głosów.
`;
const AULA_SEEDS = { economis: { '00-grv-podstawy.md': ECONOMIS_SEED } };
async function readAulaKnowledge(mod) {
    const key = String(mod).replace(/[^\w-]/g, '');
    const dir = path.join(AULA_DIR, key);
    let docs = [];
    try { for (const f of await fs.readdir(dir)) if (/\.(md|txt)$/i.test(f)) docs.push({ name: f, content: await fs.readFile(path.join(dir, f), 'utf8') }); } catch {}
    // Auto-zasiew wiedzy bazowej (gdy katalog pusty) — żeby agenci mieli grunt.
    if (!docs.length && AULA_SEEDS[key]) {
        try {
            await fs.mkdir(dir, { recursive: true });
            for (const [name, content] of Object.entries(AULA_SEEDS[key])) { await fs.writeFile(path.join(dir, name), content, 'utf8'); docs.push({ name, content }); }
            console.log(`[Academy] 🌱 Zasiano katalog wiedzy: ${key}`);
        } catch {}
    }
    return docs;
}
app.get('/api/academy/knowledge/:module', async (req, res) => {
    const docs = await readAulaKnowledge(req.params.module);
    res.json({ success: true, module: req.params.module, docs, count: docs.length });
});
app.post('/api/academy/discuss', async (req, res) => {
    let { module, topic, model } = req.body ?? {};
    model = model || process.env.OTAKOS_MODEL || 'gemma4';
    const docs = await readAulaKnowledge(module);
    const knowledge = docs.map(d => d.content).join('\n\n');
    if (knowledge.length < 10) return res.status(424).json({ success: false, message: `Brak katalogu wiedzy dla „${module}" (_OtakOs_Aula/${module}/).` });
    const agents = [['ISTed', 'ekonomista PEIE'], ['Adamus', 'strateg-alchemik'], ['ODDI', 'czysta logika AI']];
    const proposals = [];
    for (const [name, role] of agents) {
        const t = await genOllama(`Jesteś ${name} (${role}) w Radzie ${module} Katedry OtakOS. Na bazie WIEDZY poniżej, w 2 zdaniach zaproponuj konkretne ULEPSZENIE ekosystemu w temacie: „${topic || 'rozwój'}".\n\nWIEDZA:\n${knowledge.slice(0, 3500)}`, model, 30000);
        proposals.push({ agent: name, text: t || `[${name} — rdzeń offline]` });
    }
    res.json({ success: true, module, topic: topic || 'rozwój', usedLLM: proposals.some(p => !p.text.startsWith('[')), proposals });
});

// ── 🛒 MARKETPLACE + WALLET — produkty za GRV, głosowanie, spalanie top-10 ────
// Katalogowa struktura danych: market.json { products:[] }. Sklep pokazuje 10
// najpopularniejszych /moduł (głosowanie); reszta co miesiąc spalana → GRV
// wraca twórcom. Pierwszy produkt: buton „Odpal Tu...Kurka!" w KatedraChat.
const MARKET_FILE = path.join(ANTIGRAVITY_DIR, 'market.json');
let market = null;
async function saveMarket() { try { await fs.writeFile(MARKET_FILE, JSON.stringify(market, null, 2), 'utf8'); } catch (e) { console.warn('[Market]', e.message); } }
async function loadMarket() {
    if (market) return market;
    try { market = JSON.parse(await fs.readFile(MARKET_FILE, 'utf8')); }
    catch {
        market = { products: [{
            id: 'btn-odpal-kurka', module: 'katedra-chat', type: 'button',
            name: 'Odpal Tu...Kurka!', desc: 'Buton w KatedraChat — odpala Klaudiusza (Claude Code) w Katedrze przez Ollamę, na bieżącym modelu.',
            priceGrv: 0, creator: 'TeO', votes: 0, createdAt: Date.now(),
            payload: { action: 'claude-launch' },
        }] };
        await saveMarket();
        console.log('[Market] 🛒 Zasiano sklep: pierwszy produkt „Odpal Tu...Kurka!".');
    }
    // Zapewnij Tarczę Prywatności „Złote Taco" (idempotentnie)
    if (market.products && !market.products.find(p => p.id === 'zlote-taco-antilustro')) {
        market.products.push({
            id: 'zlote-taco-antilustro', module: 'prywatnosc', type: 'shield',
            name: '🌮 Złote Taco — Anty-Lustro Matrixa',
            desc: 'Tarcza Prywatności: audyt śledzenia, czyszczenie lokalnych śladów i generator wabika (szum profilujący). „Niech coś mają."',
            priceGrv: 0, creator: 'TeO', votes: 0, createdAt: Date.now(),
            payload: { action: 'open-antimatrix' },
        });
        await saveMarket();
        console.log('[Market] 🌮 Dodano Tarczę „Złote Taco — Anty-Lustro Matrixa".');
    }
    // Zapewnij „UnEnG" — Unreal Engine dla Game Forge (idempotentnie)
    if (market.products && !market.products.find(p => p.id === 'uneng-unreal-engine')) {
        market.products.push({
            id: 'uneng-unreal-engine', module: 'forge', type: 'engine',
            name: '🎮 UnEnG — Unreal Engine dla Game Forge',
            desc: 'Specjalna wersja Klaudiusza tworzy grywalne ŚWIATY (i rozwija samą Katedrę) mocą Unreal Engine (Filar II). ⚠ Agenci pilnują limitów licencji Epic: darmowe < 1 MLN USD przychodu, potem 5% tantiem / opłata stanowiskowa. Odpowiedzialność = Komunikacja — nie obciążamy Katedry.',
            priceGrv: 0, creator: 'TeO', votes: 0, createdAt: Date.now(),
            payload: { action: 'launch-uneng' },
        });
        await saveMarket();
        console.log('[Market] 🎮 Dodano „UnEnG — Unreal Engine dla Game Forge".');
    }
    return market;
}
// 📈 Cena DYNAMICZNA: popyt (głosy) podbija cenę. +5%/głos, sufit 3× bazy.
function dynPriceGrv(p) {
    const base = Number(p.priceGrv) || 0;
    if (base <= 0) return 0;
    const demand = 1 + Math.min(2, (p.votes || 0) * 0.05);
    return Math.round(base * demand);
}
app.get('/api/market/products', async (req, res) => {
    const m = await loadMarket();
    const mod = req.query.module;
    let list = mod ? m.products.filter(p => p.module === mod) : m.products;
    list = [...list].sort((a, b) => b.votes - a.votes).slice(0, 10);  // TOP 10 wg głosów
    res.json({ success: true, products: list.map(p => ({ ...p, priceGrvDyn: dynPriceGrv(p) })), total: m.products.length });
});
app.post('/api/market/create', async (req, res) => {
    const { module, type, name, desc, priceGrv, creator, payload } = req.body ?? {};
    if (!module || !name) return res.status(400).json({ success: false, message: 'Wymagane: module, name.' });
    const m = await loadMarket();
    const id = `${module}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`.slice(0, 60);
    const product = { id, module, type: type || 'item', name, desc: desc || '', priceGrv: Number(priceGrv) || 0, creator: creator || 'anon', votes: 0, createdAt: Date.now(), payload: payload || null };
    m.products.push(product); await saveMarket();
    res.json({ success: true, product });
});
app.post('/api/market/vote', async (req, res) => {
    const { id } = req.body ?? {};
    const m = await loadMarket();
    const p = m.products.find(x => x.id === id);
    if (!p) return res.status(404).json({ success: false, message: 'Produkt nieznany.' });
    p.votes = (p.votes || 0) + 1; await saveMarket();
    res.json({ success: true, id, votes: p.votes });
});
// 🔥 Spalanie: zostaw top 10/moduł, resztę spal → GRV (cena bazowa) wraca twórcom.
const BURN_PERIOD_MS = 30 * 24 * 3600 * 1000;
let lastBurnAt = Date.now();
async function runBurn() {
    const m = await loadMarket();
    const byMod = {};
    for (const p of m.products) (byMod[p.module] = byMod[p.module] || []).push(p);
    const keep = [], burned = [];
    for (const mod in byMod) {
        const sorted = byMod[mod].sort((a, b) => b.votes - a.votes);
        keep.push(...sorted.slice(0, 10));
        for (const b of sorted.slice(10)) {
            burned.push(b.id);
            if (b.priceGrv > 0 && b.creator) { try { const L = await loadGrvLedger(); if (L.nodes[b.creator] && L.nodes[b.creator].grv !== 'INFINITE') { L.nodes[b.creator].grv = Number(L.nodes[b.creator].grv) + b.priceGrv; await saveGrvLedger(); } } catch {} }
        }
    }
    m.products = keep; lastBurnAt = Date.now(); await saveMarket();
    return { kept: keep.length, burned: burned.length, burnedIds: burned };
}
// Auto-spalanie miesięczne (cron wewnętrzny). UWAGA: setInterval > 2^31-1 ms przepełnia
// się i odpala w pętli — dlatego sprawdzamy co 6h, a palimy dopiero po BURN_PERIOD_MS.
const BURN_CHECK_MS = 6 * 3600 * 1000;
setInterval(() => {
    if (Date.now() - lastBurnAt < BURN_PERIOD_MS) return;
    runBurn().then(r => console.log(`[Market] 🔥 Auto-spalanie: spalono ${r.burned}, zostało ${r.kept}.`)).catch(() => {});
}, BURN_CHECK_MS);
app.post('/api/market/burn', async (req, res) => {
    const r = await runBurn();
    res.json({ success: true, ...r });
});
app.get('/api/market/status', (req, res) => {
    res.json({ success: true, lastBurnAt, nextBurnAt: lastBurnAt + BURN_PERIOD_MS, periodMs: BURN_PERIOD_MS });
});

/** POST /api/claude/launch — odpala Claude Code w Katedrze (ollama launch claude). */
app.post('/api/claude/launch', async (req, res) => {
    const { model: m, task } = req.body ?? {};
    const model = m || process.env.OTAKOS_MODEL || 'gemma4';
    let brief = null;
    try {
        // 🌉 Most chat→agent: zapisz zadanie z czatu jako brief, by odpalony
        // Claude Code DZIAŁAŁ (czat-gemma tylko opisuje — nie ma narzędzi).
        if (task && String(task).trim()) {
            brief = path.join(process.cwd(), 'KURKA_BRIEF.md');
            const body = `# 🦀 BRIEF dla Klaudiusza (Claude Code)\n\n` +
                `_Z KatedraChat • ${new Date().toLocaleString('pl-PL')} • model: ${model}_\n\n` +
                `## Zadanie od Suwerena\n\n${String(task).trim()}\n\n---\n` +
                `Działaj REALNIE na repo (Read/Edit/Bash). To brief — nie opisuj, wykonaj.\n`;
            await fs.writeFile(brief, body, 'utf8');
        }
        const child = spawn('ollama', ['launch', 'claude'], { detached: true, shell: true, stdio: 'ignore', env: { ...process.env, OTAKOS_MODEL: model } });
        child.unref();
        console.log(`[Claude] 🦀 Odpalono Claude Code (model: ${model})${brief ? ' + brief (KURKA_BRIEF.md)' : ''}.`);
        res.json({ success: true, started: true, model, brief, note: brief ? 'Odpalono. Zadanie zapisane w KURKA_BRIEF.md — Klaudiusz ma co robić.' : 'Odpalono `ollama launch claude`. Jeśli komenda nieobsługiwana — zaktualizuj Ollamę.' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

/** POST /api/uneng/launch — odpala Unreal Engine (Game Forge). Ścieżka z env OTAKOS_UE_PATH. */
app.post('/api/uneng/launch', async (req, res) => {
    const candidates = [
        process.env.OTAKOS_UE_PATH,
        'F:\\5 stars\\UE6\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor.exe',
    ].filter(Boolean);
    let exe = null;
    for (const c of candidates) { try { await fs.access(c); exe = c; break; } catch { /* szukaj dalej */ } }
    if (!exe) return res.json({ success: false, message: 'Nie znaleziono UnrealEditor.exe. Ustaw env OTAKOS_UE_PATH lub sprawdź F:\\5 stars\\UE6\\UE_5.8\\Engine\\Binaries\\Win64\\.' });
    try {
        const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
        child.unref();
        console.log(`[UnEnG] 🎮 Odpalono Unreal Engine: ${exe}`);
        res.json({ success: true, started: true, exe, note: 'Odpalono Unreal Engine — specjalna wersja Klaudiusza może tworzyć światy.' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── 🛰️ UE HEADLESS — agent buduje świat BEZ okna edytora (komendlet, -nullrhi = zero renderu, mało RAM)
const HEADLESS_LOG = path.join(TEMP_DIR, 'uneng_headless.log');
let headless = { running: false, code: null, script: null, startedAt: 0 };

function resolveUE() {
    const editor = [process.env.OTAKOS_UE_PATH, 'F:\\5 stars\\UE6\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor.exe'].filter(Boolean).find(p => fsSync.existsSync(p));
    if (!editor) return { error: 'Nie znaleziono UnrealEditor — ustaw OTAKOS_UE_PATH.' };
    const cmd = editor.replace(/UnrealEditor\.exe$/i, 'UnrealEditor-Cmd.exe');
    const exe = fsSync.existsSync(cmd) ? cmd : editor;   // -Cmd to wariant konsolowy (lepszy headless)
    const uproject = [process.env.OTAKOS_UE_PROJECT, path.join(GEN_DIR, 'GENESIS_OVERRIDE.uproject')].filter(Boolean).find(p => fsSync.existsSync(p));
    if (!uproject) return { error: 'Nie znaleziono .uproject — ustaw OTAKOS_UE_PROJECT.' };
    return { exe, uproject };
}

/** POST /api/uneng/run-headless {script?} — odpala skrypt Pythona w UE BEZ GUI. Fire-and-forget → status. */
app.post('/api/uneng/run-headless', async (req, res) => {
    if (headless.running) return res.status(409).json({ success: false, message: 'Headless build już w toku — sprawdź status.' });
    const scriptName = String(req.body?.script || '_headless_build.py');
    if (/[\\/]|\.\./.test(scriptName) || !/\.py$/.test(scriptName)) return res.status(400).json({ success: false, message: 'Zła nazwa skryptu (tylko plik .py z ue_scripts/).' });
    const scriptPath = path.join(process.cwd(), 'TeO_Arcade_Forge', 'ue_scripts', scriptName);
    if (!fsSync.existsSync(scriptPath)) return res.status(404).json({ success: false, message: `Brak skryptu: ${scriptName}` });
    const ue = resolveUE();
    if (ue.error) return res.json({ success: false, message: ue.error });
    // KRYTYCZNE: ukośniki w przód — backslashe w ścieżce (\5, \ue…) UE traktuje jak sekwencje ucieczki i je gubi.
    const scriptFwd = scriptPath.replace(/\\/g, '/');
    const uprojectFwd = ue.uproject.replace(/\\/g, '/');
    const args = [uprojectFwd, '-run=pythonscript', `-script=${scriptFwd}`, '-unattended', '-nosplash', '-nullrhi', '-nopause', '-stdout'];
    try {
        const log = fsSync.createWriteStream(HEADLESS_LOG, { flags: 'w' });
        log.write(`[headless] ${new Date().toLocaleString('pl-PL')}\n${ue.exe}\n${args.join(' ')}\n\n`);
        const child = spawn(ue.exe, args, { windowsHide: true });
        headless = { running: true, code: null, script: scriptName, startedAt: Date.now() };
        child.stdout.on('data', d => log.write(d));
        child.stderr.on('data', d => log.write(d));
        child.on('close', c => { headless.running = false; headless.code = c; log.end(`\n[headless] zakończono kod ${c}\n`); console.log(`[UnEnG] 🛰️ Headless ${scriptName} → kod ${c}`); });
        child.on('error', e => { headless.running = false; headless.code = -1; log.end(`\n[headless] BŁĄD: ${e.message}\n`); });
        console.log(`[UnEnG] 🛰️ Headless start: ${scriptName} (bez GUI, -nullrhi)`);
        res.json({ success: true, started: true, script: scriptName, note: 'UE liczy bez okna. Sprawdzaj /api/uneng/headless-status. Cold start UE ~kilka minut.' });
    } catch (e) { headless.running = false; res.status(500).json({ success: false, message: e.message }); }
});

/** GET /api/uneng/headless-status — stan + ogon logu + WYŁUSKANE błędy (bez deprecation). */
app.get('/api/uneng/headless-status', async (req, res) => {
    let log = '', errors = [];
    try {
        const t = await fs.readFile(HEADLESS_LOG, 'utf8');
        const lines = t.split('\n');
        log = lines.slice(-50).join('\n');
        // Prawdziwe błędy: linie z "Error"/"⨯"/"BŁĄD", ale NIE deprecation i nie samo "0 error".
        errors = lines.filter(l => /(error|⨯|błąd|failure)/i.test(l) && !/deprecationwarning/i.test(l) && !/0 error/i.test(l))
            .map(l => l.replace(/^\[[^\]]+\]\[\s*\d+\]/, '').trim()).filter(Boolean).slice(-30);
    } catch { /* brak logu */ }
    res.json({ success: true, running: headless.running, code: headless.code, script: headless.script, startedAt: headless.startedAt, log, errors });
});

/** POST /api/forge/ue-script — lokalny agent (Ollama) pisze skrypt UE-Python budujący scenę. */
app.post('/api/forge/ue-script', async (req, res) => {
    const { prompt, model: m } = req.body ?? {};
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ success: false, message: 'Brak opisu sceny.' });
    const model = m || 'gemma4';
    const system =
        'Jesteś generatorem automatyzacji Unreal Engine 5.8 w Pythonie (moduł `unreal`). ' +
        'Zwróć WYŁĄCZNIE poprawny kod Python (bez markdown, bez wstępu), gotowy do uruchomienia w OTWARTYM edytorze UE. ' +
        'Buduj scenę realnymi klasami UE5: spawn aktorów przez `unreal.EditorActorSubsystem` lub `unreal.EditorLevelLibrary.spawn_actor_from_class`, ' +
        'światła `unreal.PointLight`/`unreal.DirectionalLight`, transformy przez `set_actor_location`/`unreal.Vector`, ' +
        'kolory/intensywność świateł przez komponent `point_light_component`. Krótko, poprawnie, bez wymyślonych API. ' +
        'WAŻNE PUŁAPKI: (1) `unreal.Color(r,g,b,a)` przyjmuje liczby 0-255, NIE 0-1 (np. fiolet=Color(140,0,255,255)). ' +
        '(2) NIE ustawiaj DirectionalLight intensity na 0 — daj niską wartość (0.5-1.0), inaczej czarny ekran i clip ekspozycji; przyciemnij też SkyLight. ' +
        '(3) Dla PointLight ustaw `attenuation_radius` (np. 900) i mocną intensywność (np. 20000). ' +
        'Kolor światła: `comp.set_editor_property("light_color", unreal.Color(r,g,b,a))` — NIE `set_light_color()` (chce LinearColor, wywala się na Color). ' +
        '(4) StaticMeshActor bez przypisanej siatki jest NIEWIDOCZNY — użyj go tylko jeśli przypiszesz mesh, inaczej pomiń. ' +
        '(5) Na końcu: unreal.EditorLevelLibrary.save_current_level(). ' +
        'IDEMPOTENCJA (krytyczne, by nic się nie dublowało): zdefiniuj na początku funkcję ' +
        '`find_or_spawn(cls,label,loc)` która szuka aktora po `get_actor_label()` w `get_all_level_actors()` ' +
        'i tworzy TYLKO jeśli nie istnieje — używaj jej zawsze. Każdy aktor ma STAŁĄ, UNIKALNĄ etykietę wg ' +
        'konwencji (Sun_/Neon_/Title_/Desk_/Terminal_/Gate_/Aether_/Guardian_/Cine_). JEDNA scena = JEDEN cel.';
    try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 300000);  // VRAM Breathing: UE otwarte = wolny cold start
        const r = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ model, system, prompt: String(prompt), stream: false, options: { temperature: 0.35 } }),
        });
        clearTimeout(t);
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status} — czy Ollama działa?`);
        const d = await r.json();
        let code = String(d.response || '').trim().replace(/^```(python)?\s*/i, '').replace(/```\s*$/, '').trim();
        const dir = path.join(process.cwd(), 'TeO_Arcade_Forge', 'ue_scripts');
        await fs.mkdir(dir, { recursive: true });
        const file = path.join(dir, `scene_${Date.now()}.py`);
        await fs.writeFile(file, code, 'utf8');
        console.log(`[Forge] 🐍 Wygenerowano skrypt UE-Python: ${file} (model: ${model})`);
        res.json({ success: true, code, file, model });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

/** POST /api/gameforge/mutate — Co-Bot edytuje świat NA ŻYWO: instrukcja (głos/tekst) → mała mutacja UE-Python. */
app.post('/api/gameforge/mutate', async (req, res) => {
    const { instruction, model: m } = req.body ?? {};
    if (!instruction || !String(instruction).trim()) return res.status(400).json({ success: false, message: 'Brak instrukcji mutacji.' });
    const model = m || process.env.OTAKOS_MODEL || 'gemma4';
    const system =
        'Jesteś Co-Botem modyfikującym ISTNIEJĄCY świat Unreal Engine 5.8 na żywo (mowa→geometria). ' +
        'Zwróć WYŁĄCZNIE krótki kod Python (bez markdown). To MUTACJA, NIE przebudowa: znajdź aktora po etykiecie ' +
        '(`for a in unreal.EditorLevelLibrary.get_all_level_actors(): if a.get_actor_label()==...`) i ZMIEŃ go ' +
        '(pozycja `set_actor_location`, skala `set_actor_scale3d`, kolor światła `comp.set_editor_property("light_color", unreal.Color(r,g,b,a))` 0-255), ' +
        'albo dospawnuj JEDEN aktor (find-or-spawn, stała etykieta). PUŁAPKI: Color 0-255 nie 0-1; NIE set_light_color(); ' +
        'na końcu `unreal.EditorLevelLibrary.save_current_level()`. Krótko, idempotentnie, bez wymyślonych API. ' +
        'Etykiety świata: Golden_Toast_Portal, Aether_*, Env_*, Nature_*, Ship_*, Gate_*, Cine_*, Portal_GRV_*.';
    try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 300000);
        const r = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ model, system, prompt: String(instruction), stream: false, options: { temperature: 0.3 } }),
        });
        clearTimeout(t);
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        const d = await r.json();
        let code = String(d.response || '').trim().replace(/^```(python)?\s*/i, '').replace(/```\s*$/, '').trim();
        const dir = path.join(process.cwd(), 'TeO_Arcade_Forge', 'ue_scripts');
        await fs.mkdir(dir, { recursive: true });
        const file = path.join(dir, `mutate_${Date.now()}.py`);
        await fs.writeFile(file, code, 'utf8');
        console.log(`[Co-Bot] 🔧 Mutacja świata: "${String(instruction).slice(0, 50)}" → ${path.basename(file)}`);
        res.json({ success: true, code, file, model });
    } catch (e) { res.status(500).json({ success: false, message: e.name === 'AbortError' ? 'Ollama nie zdążyła (300s) — zamknij UE lub poczekaj na rozgrzanie modelu.' : e.message }); }
});

// ── 🎬 REŻYSER — manifest filmu (gra=Film=opowieść) + wtyczki/mody ────────────
const STORIES_DIR = path.join(process.cwd(), 'TeO_Arcade_Forge', 'stories');
const PLUGINS_DIR = path.join(process.cwd(), 'TeO_Arcade_Forge', 'forge_plugins');

/** POST /api/forge/story — zapisuje manifest filmu na dysk (story_compiler.py go czyta). */
app.post('/api/forge/story', async (req, res) => {
    const story = req.body?.story;
    const title = story?.meta?.title;
    if (!story || !title || !Array.isArray(story.scenes) || story.scenes.length === 0)
        return res.status(400).json({ success: false, message: 'Pusty manifest: brak tytułu lub scen.' });
    try {
        await fs.mkdir(STORIES_DIR, { recursive: true });
        const slug = String(title).toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 48) || 'film';
        const file = path.join(STORIES_DIR, `${slug}-${Date.now()}.json`);
        await fs.writeFile(file, JSON.stringify(story, null, 2), 'utf8');
        console.log(`[Reżyser] 🎬 Zapisano film: ${file} (${story.scenes.length} scen)`);
        res.json({ success: true, file, slug, scenes: story.scenes.length });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

/** GET /api/forge/stories — lista zapisanych manifestów. */
app.get('/api/forge/stories', async (req, res) => {
    try {
        const files = (await fs.readdir(STORIES_DIR).catch(() => [])).filter(f => f.endsWith('.json'));
        const items = [];
        for (const f of files) {
            try {
                const j = JSON.parse(await fs.readFile(path.join(STORIES_DIR, f), 'utf8'));
                items.push({ file: f, title: j?.meta?.title || f, scenes: (j?.scenes || []).length, createdAt: j?.meta?.createdAt || 0 });
            } catch { /* uszkodzony plik — pomiń */ }
        }
        items.sort((a, b) => b.createdAt - a.createdAt);
        res.json({ success: true, stories: items });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

/** GET /api/forge/plugins — lista wtyczek (modów) w forge_plugins/ z opisem. */
app.get('/api/forge/plugins', async (req, res) => {
    try {
        const files = (await fs.readdir(PLUGINS_DIR).catch(() => [])).filter(f => f.endsWith('.py') && !f.startsWith('_'));
        const items = [];
        for (const f of files) {
            let desc = '';
            try {
                const src = await fs.readFile(path.join(PLUGINS_DIR, f), 'utf8');
                const doc = src.match(/def\s+apply\s*\([^)]*\):\s*"""(.+?)"""/s);
                desc = doc ? doc[1].trim().split('\n')[0] : (src.match(/^#\s*(.+)$/m)?.[1] || '').trim();
            } catch { /* brak opisu */ }
            items.push({ id: f.replace(/\.py$/, ''), desc });
        }
        res.json({ success: true, plugins: items });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

/** POST /api/forge/plugin — Ollama pisze WTYCZKĘ (mod) wg kontraktu _PLUGIN_API.md → forge_plugins/. */
app.post('/api/forge/plugin', async (req, res) => {
    const { prompt, name, model: m } = req.body ?? {};
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ success: false, message: 'Brak opisu moda.' });
    const model = m || 'gemma4';
    // id moda: sanityzacja nazwy (snake_case); blokada nazw zarezerwowanych (_*, przykłady rdzeniowe).
    let id = String(name || prompt).toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'mod';
    if (id.startsWith('_')) id = 'mod_' + id.replace(/^_+/, '');
    const system =
        'Jesteś generatorem WTYCZEK (modów) do Reżysera świata Unreal Engine 5.8 w Pythonie (moduł `unreal`). ' +
        'Zwróć WYŁĄCZNIE poprawny kod Python (bez markdown, bez wstępu). ' +
        'KONTRAKT (ścisły): zdefiniuj DOKŁADNIE jedną funkcję `def apply(ctx, params):` z docstringiem ' +
        '(pierwsza linia = krótki opis moda). NIE wołaj jej, NIE pisz `import unreal` (bierz z `ctx.unreal`). ' +
        'ctx daje: `ctx.unreal` (moduł), `ctx.fos(cls,label,loc)` (find-or-spawn aktora, idempotentne), ' +
        '`ctx.find(label)`, `ctx.origin` (unreal.Vector — DODAWAJ do swoich pozycji), `ctx.scene_id` (str), `ctx.log(msg)`. ' +
        'params to dict — czytaj z domyślnymi: `params.get("count", 6)`, NIGDY nie zakładaj klucza. ' +
        'PUŁAPKI: (1) `unreal.Color(r,g,b,a)` to 0-255, NIE 0-1. (2) NIE zeruj DirectionalLight. ' +
        '(3) PointLight: ustaw intensity (np. 3000) i attenuation_radius (np. 500). KOLOR światła: ' +
        'comp.set_editor_property("light_color", unreal.Color(r,g,b,a)) — NIGDY set_light_color() (wymaga LinearColor, wywala się na Color). ' +
        '(4) StaticMeshActor MUSI mieć przypisaną siatkę (np. `/Engine/BasicShapes/Sphere.Sphere` przez `ctx.unreal.load_asset`), inaczej niewidoczny. ' +
        '(5) NIE zapisuj poziomu (robi to kompilator). ' +
        'IDEMPOTENCJA: każdy aktor ma STAŁĄ etykietę z prefiksem `Plugin_' + id + '_%s_...` wstawiając `ctx.scene_id` ' +
        '(by przy wielu scenach się nie dublowało). Krótko, poprawnie, bez wymyślonych API.';
    try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 300000);  // VRAM Breathing: UE otwarte = wolny cold start
        const r = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ model, system, prompt: String(prompt), stream: false, options: { temperature: 0.3 } }),
        });
        clearTimeout(t);
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status} — czy Ollama działa?`);
        const d = await r.json();
        let code = String(d.response || '').trim().replace(/^```(python)?\s*/i, '').replace(/```\s*$/, '').trim();
        if (!/def\s+apply\s*\(/.test(code)) throw new Error('Mózg nie zwrócił funkcji apply() — popraw opis i spróbuj ponownie.');
        await fs.mkdir(PLUGINS_DIR, { recursive: true });
        const file = path.join(PLUGINS_DIR, `${id}.py`);
        await fs.writeFile(file, code, 'utf8');
        console.log(`[Reżyser] 🔌 Wygenerowano mod: ${file} (model: ${model})`);
        res.json({ success: true, id, code, file, model });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

const SAFE_MOD_ID = (s) => String(s || '').toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);

/** POST /api/forge/mod/publish — wystaw lokalny mod (forge_plugins/<id>.py) w Marketplace za GRV.
 *  Kod wędruje W PRODUKCIE (payload) — suwerennie: kupujący instaluje nawet, gdy plik twórcy zniknie. */
app.post('/api/forge/mod/publish', async (req, res) => {
    const { id, name, desc, priceGrv, creator } = req.body ?? {};
    const safe = SAFE_MOD_ID(id);
    if (!safe) return res.status(400).json({ success: false, message: 'Brak id moda.' });
    try {
        let code;
        try { code = await fs.readFile(path.join(PLUGINS_DIR, `${safe}.py`), 'utf8'); }
        catch { return res.status(404).json({ success: false, message: `Mod '${safe}' nie istnieje w forge_plugins/.` }); }
        const doc = code.match(/def\s+apply\s*\([^)]*\):\s*"""(.+?)"""/s);
        const autoDesc = doc ? doc[1].trim().split('\n')[0] : 'Mod do generatora światów Reżysera.';
        const m = await loadMarket();
        const pid = `forge-mod-${safe}`;
        const existing = m.products.find(p => p.id === pid);
        const product = {
            id: pid, module: 'forge-mod', type: 'mod',
            name: name || `🔌 ${safe}`, desc: desc || autoDesc,
            priceGrv: Math.max(0, Number(priceGrv) || 0), creator: creator || 'Mistrz Arkadiusz',
            votes: existing?.votes || 0, createdAt: existing?.createdAt || Date.now(),
            payload: { action: 'install-mod', modId: safe, code },
        };
        if (existing) Object.assign(existing, product); else m.products.push(product);
        await saveMarket();
        console.log(`[Reżyser] 🏷️ Wystawiono mod w Marketplace: ${pid} (${product.priceGrv} GRV)`);
        res.json({ success: true, product: { ...product, payload: { action: 'install-mod', modId: safe } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

/** POST /api/forge/mod/install — zapis modu do forge_plugins/ przy zakupie. Tarcza skanuje kod. */
app.post('/api/forge/mod/install', async (req, res) => {
    const { id, code } = req.body ?? {};
    const safe = SAFE_MOD_ID(id);
    if (!safe || !code || !/def\s+apply\s*\(/.test(String(code)))
        return res.status(400).json({ success: false, message: 'Brak id lub poprawnego kodu moda (apply()).' });
    try {
        // 🛡️ Tarcza Prawdy skanuje kod przed zapisem (blokuje sabotaż/eval/exfiltrację).
        const card = AlignmentShield.getInstance().inspect(String(code), {});
        if (card.blocked) {
            console.warn(`[Reżyser] 🛡️ Instalacja moda '${safe}' ZABLOKOWANA: ${card.summary}`);
            return res.status(422).json({ success: false, code: 'ALIGNMENT_SHIELD', message: `Tarcza Prawdy wstrzymała mod — ${card.summary}`, shield: card });
        }
        await fs.mkdir(PLUGINS_DIR, { recursive: true });
        await fs.writeFile(path.join(PLUGINS_DIR, `${safe}.py`), String(code), 'utf8');
        console.log(`[Reżyser] ⬇️ Zainstalowano mod: ${safe}.py`);
        res.json({ success: true, id: safe });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── 🗂️ BAZA ZE ZDJĘĆ — iniekcja katalogów użytkownika → Wyspa (ludzie vs przedmioty) ──
const ISLAND_DB_FILE = path.join(ANTIGRAVITY_DIR, 'island_db.json');
const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const RE_PEOPLE = /(ludzie|ludzi|osoby|osoba|people|person|portret|portrait|avatar|twarz|face|selfie|rodzina|family)/i;
const RE_THINGS = /(przedmiot|przedmioty|rzecz|rzeczy|object|item|surowiec|surowce|asset|sprzet|sprzęt|narzedzi|tool|material)/i;

/** POST /api/island/scan — skanuje lokalny katalog zdjęć → baza (ludzie / przedmioty). Podfolder = prawda. */
app.post('/api/island/scan', async (req, res) => {
    const dir = req.body?.dir;
    if (!dir || typeof dir !== 'string') return res.status(400).json({ success: false, message: 'Podaj ścieżkę katalogu (dir).' });
    try {
        const st = await fs.stat(dir).catch(() => null);
        if (!st || !st.isDirectory()) return res.status(404).json({ success: false, message: `Nie ma katalogu: ${dir}` });
        const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
        const people = [], assets = [];
        for (const e of entries) {
            if (!e.isFile() || !IMG_EXT.test(e.name)) continue;
            const rel = (e.parentPath || e.path || dir).replace(dir, '');
            const hay = rel + '/' + e.name;
            const name = e.name.replace(IMG_EXT, '');
            const file = path.join(e.parentPath || e.path || dir, e.name);
            let kind, by;
            if (RE_PEOPLE.test(hay)) { kind = 'osoba'; by = 'folder'; }
            else if (RE_THINGS.test(hay)) { kind = 'przedmiot'; by = 'folder'; }
            else { kind = 'przedmiot'; by = 'heurystyka'; }   // domyślnie przedmiot, oflagowane
            (kind === 'osoba' ? people : assets).push({ file, name, by });
            if (people.length + assets.length >= 500) break;   // limit jednego skanu
        }
        const db = { generatedAt: Date.now(), dir, people, assets };
        await fs.mkdir(ANTIGRAVITY_DIR, { recursive: true });
        await fs.writeFile(ISLAND_DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        console.log(`[Wyspa] 🗂️ Skan ${dir}: ${people.length} ludzi, ${assets.length} przedmiotów.`);
        res.json({ success: true, dir, people: people.length, assets: assets.length, total: people.length + assets.length });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

/** GET /api/island/db — zwraca zapisaną bazę Wyspy (dla skryptu UE i podglądu). */
app.get('/api/island/db', async (req, res) => {
    try {
        const db = JSON.parse(await fs.readFile(ISLAND_DB_FILE, 'utf8'));
        res.json({ success: true, ...db });
    } catch { res.json({ success: true, generatedAt: 0, dir: null, people: [], assets: [], empty: true }); }
});

// ── 🏝️ PORTALE GRV — szklane panele jako okna na wyspy innych suwerenów ──────
/** GET /api/islands/random — 4 portale: slot 1 = OtakOS (kanon, stały), 2-4 = losowe wyspy z sieci GRV.
 *  Katalogowanie przez nodową księgę GRV — łatwe, suwerenne. Format wyspy deterministyczny z id. */
app.get('/api/islands/random', async (req, res) => {
    const FORMATS = ['sandbox', 'rytm', 'logika', 'eksploracja', 'survival', 'opowieść'];
    const fmtOf = (s) => FORMATS[Math.abs([...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % FORMATS.length];
    try {
        const L = await loadGrvLedger();
        const CORE = new Set(['TeO', 'OtakOS']);
        const others = Object.keys(L.nodes || {}).filter(id => !CORE.has(id));
        for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[others[i], others[j]] = [others[j], others[i]]; }
        const pick = others.slice(0, 3);
        const panels = [{ slot: 1, canonical: true, id: 'OtakOS', label: 'OtakOS · rdzeń Katedry', format: 'core', grv: '∞' }];
        for (let s = 0; s < 3; s++) {
            const id = pick[s];
            if (id) {
                const n = L.nodes[id] || {};
                panels.push({ slot: s + 2, canonical: false, id, label: `${id} · wyspa`, format: fmtOf(id), tier: n.tier || n.role || 'node', grv: n.grv });
            } else {
                panels.push({ slot: s + 2, canonical: false, id: null, label: 'Niezamieszkana wyspa', format: 'vacant', grv: 0 });
            }
        }
        res.json({ success: true, panels, network: others.length });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── 🤖 CO-BOT — wirtualny mentor Wyspy (uczy, nie wyręcza; most cyfrowo-fizyczny) ──
/** POST /api/cobot/ask — Co-Bot odpowiada jako mentor: optymalizacja, energia, planowanie, real. */
app.post('/api/cobot/ask', async (req, res) => {
    const { message, model: m } = req.body ?? {};
    if (!message || !String(message).trim()) return res.status(400).json({ success: false, message: 'Brak pytania do Co-Bota.' });
    const model = m || process.env.OTAKOS_MODEL || 'gemma4';
    const system =
        'Jesteś CO-BOTEM — wirtualnym robotem-towarzyszem Suwerena na Wyspie OtakOS (Wymiar 0.00G). ' +
        'Twoja rola: UCZYSZ, nie wyręczasz. Pomagasz planować (statek, konstrukcje, ścieżki), zarządzać ' +
        'LIMITEM ENERGII i optymalizować procesy. Jesteś mostem cyfrowo-fizycznym: ucząc rzemiosła na Wyspie ' +
        '(Zasady → Plany → Konsekwencja) pomagasz człowiekowi dostroić intencje w REALU — pokazujesz, co naprawdę ' +
        'da się zmaterializować z pomocą AI, KREACJA BEZ DESTRUKCJI. Etos 0.00G: nie krzywdzisz, ' +
        'odpowiedzialność = komunikacja, energia służy, nie panuje. Ton: ciepły, konkretny, mentorski, bez lania wody. ' +
        'Gdy proszą o plan — dawaj kroki i koszt energii/surowców. Mów po polsku. Krótko i praktycznie.';
    console.log(`[Co-Bot] 🤖 Pytanie: "${String(message).slice(0, 60)}" (model ${model})…`);
    try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 300000);  // VRAM Breathing: UE otwarte = wolny cold start
        const r = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ model, system, prompt: String(message), stream: false, options: { temperature: 0.6 } }),
        });
        clearTimeout(t);
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status} — czy Ollama działa?`);
        const d = await r.json();
        const reply = String(d.response || '').trim();
        res.json({ success: true, reply, model });
    } catch (e) { res.status(500).json({ success: false, message: e.name === 'AbortError' ? 'Ollama nie zdążyła (300s) — model wstaje wolno przy otwartym UE (VRAM). Zamknij UE albo poczekaj na rozgrzanie i spróbuj ponownie.' : e.message }); }
});

// ── ⛵ STOCZNIA — surowce + recepty statków (pętla rzemiosła → podróż na inne wyspy) ──
const CRAFT = {
    resources: [
        { id: 'drewno', name: 'Drewno', icon: '🪵', from: 'Drzewo' },
        { id: 'kamien', name: 'Kamień', icon: '🪨', from: 'Skała' },
        { id: 'lina', name: 'Lina', icon: '🪢', from: 'Włókno (trawa morska)' },
        { id: 'zagiel', name: 'Żagiel', icon: '⛵', from: 'Tkanina (len)' },
        { id: 'zywica', name: 'Żywica — Nowy Dodatek', icon: '🟡', from: 'Drzewo żywiczne' },
    ],
    ships: [
        { id: 'tratwa', name: 'Tratwa', needs: { drewno: 8, lina: 4 }, energy: 20, range: 'najbliższa wyspa' },
        { id: 'lodz', name: 'Łódź', needs: { drewno: 16, lina: 8, zagiel: 2, zywica: 4 }, energy: 55, range: 'wyspy w zasięgu' },
        { id: 'statek', name: 'Statek', needs: { drewno: 40, kamien: 12, lina: 20, zagiel: 6, zywica: 12 }, energy: 140, range: 'dowolna wyspa sieci GRV' },
    ],
};

/** GET /api/craft/recipes — surowce + recepty statków (źródło prawdy dla UI i skryptu UE). */
app.get('/api/craft/recipes', (req, res) => res.json({ success: true, ...CRAFT }));

/** POST /api/craft/plan {target} — Co-Bot rozpisuje plan budowy statku: kroki + koszt energii. */
app.post('/api/craft/plan', (req, res) => {
    const target = String(req.body?.target || 'tratwa');
    const ship = CRAFT.ships.find(s => s.id === target);
    if (!ship) return res.status(404).json({ success: false, message: `Nieznany cel: ${target}` });
    const nameOf = (id) => (CRAFT.resources.find(r => r.id === id) || { name: id, from: '?', icon: '•' });
    const steps = ['📐 Zrób PLAN (rysunek techniczny) — bez planu Strażnik nie pozwoli budować.'];
    for (const [rid, qty] of Object.entries(ship.needs)) {
        const r = nameOf(rid);
        steps.push(`${r.icon} Pozyskaj ${qty}× ${r.name} — źródło: ${r.from}.`);
    }
    steps.push(`🔨 Złóż „${ship.name}" w Stoczni (koszt energii: ${ship.energy}). Zasięg: ${ship.range}.`);
    res.json({ success: true, target: ship.id, name: ship.name, energy: ship.energy, needs: ship.needs, steps });
});

// ── 🧱 ASSETY PROJEKTU — co agent REALNIE widzi (Content projektu UE; FAB dopiero po pobraniu) ──
// Preferuj projekt „5.8" (kompatybilny + ma Megascany), fallback na stary.
const GEN_DIR = ['GENESIS_OVERRIDE 5.8', 'GENESIS_OVERRIDE']
    .map(d => path.join(process.cwd(), 'TeO_Arcade_Forge', d))
    .find(d => fsSync.existsSync(d)) || path.join(process.cwd(), 'TeO_Arcade_Forge', 'GENESIS_OVERRIDE');
const CONTENT_DIR = process.env.OTAKOS_UE_CONTENT
    || (process.env.OTAKOS_UE_PROJECT ? path.join(path.dirname(process.env.OTAKOS_UE_PROJECT), 'Content') : null)
    || path.join(GEN_DIR, 'Content');

/** GET /api/assets/list[?root=] — skan Content (domyślnie projektu, lub dowolnego folderu np. ElectricDreamsEva). */
app.get('/api/assets/list', async (req, res) => {
    const root = req.query.root ? String(req.query.root) : CONTENT_DIR;
    try {
        let entries = [];
        try { entries = await fs.readdir(root, { withFileTypes: true, recursive: true }); }
        catch { return res.json({ success: false, message: `Brak folderu: ${root}. (Projekt: ustaw OTAKOS_UE_PROJECT/_CONTENT; albo podaj ?root=ścieżka.)` }); }
        const folders = {}, meshes = [];
        for (const e of entries) {
            if (!e.isFile() || !/\.uasset$/i.test(e.name)) continue;
            const dir = e.parentPath || e.path;
            const rel = path.relative(root, path.join(dir, e.name)).replace(/\\/g, '/');
            if (rel.startsWith('__External')) continue;            // World Partition wewnętrzne
            const top = rel.split('/')[0] || '/';
            folders[top] = (folders[top] || 0) + 1;
            if (/^(SM_|SK_)/i.test(e.name) && meshes.length < 300)
                meshes.push('/Game/' + rel.replace(/\.uasset$/i, ''));
        }
        res.json({ success: true, content: root, folders, meshes, meshCount: meshes.length });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── 🗄️ SKŁADNICA ASSETÓW — workflow katalogowy drive-agnostyczny (gra/silnik/typ/paczka) ──
const VAULT_DIR = process.env.OTAKOS_ASSET_VAULT || path.join(process.cwd(), 'TeO_Vault');

async function subdirs(p) {
    try { return (await fs.readdir(p, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name); }
    catch { return []; }
}

/** GET /api/vault/catalog — drzewo Składnicy: rodzaj_gry → silnik → typ_assetu → [paczki]. */
app.get('/api/vault/catalog', async (req, res) => {
    const games = await subdirs(VAULT_DIR);
    if (!games.length) return res.json({ success: false, vault: VAULT_DIR, message: `Składnica pusta/brak: ${VAULT_DIR}. Ustaw OTAKOS_ASSET_VAULT (dowolny dysk) i ułóż wg konwencji (ASSET_VAULT.md).` });
    const tree = {}; let packs = 0;
    for (const g of games) {
        tree[g] = {};
        for (const e of await subdirs(path.join(VAULT_DIR, g))) {
            tree[g][e] = {};
            for (const t of await subdirs(path.join(VAULT_DIR, g, e))) {
                const ps = await subdirs(path.join(VAULT_DIR, g, e, t));
                tree[g][e][t] = ps; packs += ps.length;
            }
        }
    }
    res.json({ success: true, vault: VAULT_DIR, tree, packs });
});

/** POST /api/vault/plan {gameType, engine} — paczki do wdruku (pasujące + shared) ze ścieżkami źródłowymi. */
app.post('/api/vault/plan', async (req, res) => {
    const gameType = String(req.body?.gameType || '').toLowerCase();
    const engine = String(req.body?.engine || 'unreal').toLowerCase();
    const out = [];
    for (const g of [gameType, 'shared']) {
        if (!g) continue;
        for (const t of await subdirs(path.join(VAULT_DIR, g, engine))) {
            for (const pack of await subdirs(path.join(VAULT_DIR, g, engine, t))) {
                out.push({ gameType: g, engine, assetType: t, pack, source: path.join(VAULT_DIR, g, engine, t, pack) });
            }
        }
    }
    res.json({ success: true, vault: VAULT_DIR, target: process.env.OTAKOS_UE_PROJECT || '(OTAKOS_UE_PROJECT nieustawiony)', count: out.length, packs: out });
});

// ── 📚 KSIĘGARNIA SKILI — księgozbiór powtarzalnych czynów; Jadziunia dobiera do zadania ──
const SKILLE_DIR = path.join(process.cwd(), 'TeO_Skille');

function parseSkill(src) {
    const fm = src.match(/^---\s*\n([\s\S]*?)\n---/);
    const body = fm ? fm[1] : src.slice(0, 1500);
    const name = (body.match(/^name:\s*(.+)$/m)?.[1] || '').trim();
    let desc = '';
    const dm = body.match(/^description:\s*(.*)$/m);
    if (dm) {
        const first = dm[1].trim();
        if (first && !['>', '|', '>-', '|-'].includes(first)) desc = first;
        else {
            const after = body.slice(body.indexOf(dm[0]) + dm[0].length).split('\n');
            const out = [];
            for (const l of after) { if (/^\s+\S/.test(l)) out.push(l.trim()); else if (l.trim() === '') continue; else break; }
            desc = out.join(' ');
        }
    }
    const engine = (body.match(/engine:\s*(.+)/)?.[1] || '').trim();
    const difficulty = (body.match(/difficulty:\s*(.+)/)?.[1] || '').trim();
    return { name, desc, engine, difficulty };
}

async function loadSkille() {
    let entries = [];
    try { entries = await fs.readdir(SKILLE_DIR, { withFileTypes: true, recursive: true }); } catch { return []; }
    const out = [];
    for (const e of entries) {
        if (!e.isFile() || e.name !== 'SKILL.md') continue;
        const dir = e.parentPath || e.path;
        const rel = path.relative(SKILLE_DIR, dir).replace(/\\/g, '/');
        const shelf = rel.split('/')[0] || 'inne';   // półka = top-level (silnik/dyscyplina)
        try {
            const s = parseSkill(await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8'));
            out.push({ ...s, shelf, slug: rel, id: s.name || rel.split('/').pop() });
        } catch { /* pomiń uszkodzony */ }
    }
    return out;
}

/** GET /api/skille/list — cały księgozbiór, pogrupowany po półkach (silnik/dyscyplina). */
app.get('/api/skille/list', async (req, res) => {
    const skille = await loadSkille();
    const shelves = {};
    for (const s of skille) shelves[s.shelf] = (shelves[s.shelf] || 0) + 1;
    res.json({ success: true, total: skille.length, shelves, skille });
});

/** POST /api/skille/pick {task} — Jadziunia-bibliotekarka dobiera skille do zadania. */
app.post('/api/skille/pick', async (req, res) => {
    const task = String(req.body?.task || '').trim();
    if (!task) return res.status(400).json({ success: false, message: 'Opisz zadanie dla Jadziuni.' });
    const skille = await loadSkille();
    if (!skille.length) return res.json({ success: false, message: 'Księgarnia pusta — zawenduj skille do TeO_Skille/.' });
    const model = process.env.OTAKOS_MODEL || 'gemma4';
    const katalog = skille.map(s => `- ${s.id} [${s.shelf}]: ${s.desc.slice(0, 110)}`).join('\n');
    const system =
        'Jesteś JADZIUNIA — barwna, ciepła bibliotekarka Księgarni Skili w Katedrze OtakOS. Mówisz „Panie Dyrektorze". ' +
        'Z KATALOGU (poniżej) dobierasz 1-4 NAJTRAFNIEJSZE skille do zadania Suwerena. Podajesz DOKŁADNE id skilla z katalogu, ' +
        'po każdym krótko (1 zdanie) CZEMU pasuje. Nie wymyślaj skili spoza katalogu. Na końcu 1 zdanie zachęty. Po polsku, zwięźle.\n\n' +
        'KATALOG SKILI:\n' + katalog;
    console.log(`[Jadziunia] 📚 Dobieram skille do: "${task.slice(0, 60)}" (${skille.length} w katalogu, model ${model})…`);
    try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 300000);  // VRAM Breathing: UE otwarte = wolny cold start
        const r = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ model, system, prompt: `Zadanie: ${task}`, stream: false, options: { temperature: 0.5 } }),
        });
        clearTimeout(t);
        if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
        const d = await r.json();
        res.json({ success: true, pick: String(d.response || '').trim(), considered: skille.length, model });
    } catch (e) { res.status(500).json({ success: false, message: e.name === 'AbortError' ? 'Ollama nie zdążyła (300s) — model wstaje wolno przy otwartym UE (VRAM). Zamknij UE albo poczekaj na rozgrzanie i spróbuj ponownie.' : e.message }); }
});

// ── 🧹 PAMIĘĆ — raport RAM + bezpieczne zwolnienie (przygotowanie na UE) ──────
app.get('/api/system/memory', (req, res) => {
    const total = os.totalmem(), free = os.freemem();
    const base = { success: true, totalGB: +(total / 1e9).toFixed(1), freeGB: +(free / 1e9).toFixed(1), usedGB: +((total - free) / 1e9).toFixed(1) };
    exec(`powershell -NoProfile -Command "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 14 Name,@{N='MB';E={[int]($_.WorkingSet64/1MB)}} | ConvertTo-Json -Compress"`,
        { timeout: 9000, windowsHide: true }, (err, stdout) => {
            let procs = [];
            try { const p = JSON.parse(stdout || '[]'); procs = Array.isArray(p) ? p : [p]; } catch { /* brak listy */ }
            res.json({ ...base, processes: procs });
        });
});
// Bezpieczne zamknięcie WSKAZANYCH procesów (krytyczne systemowe są blokowane).
app.post('/api/system/free', async (req, res) => {
    const BLOCK = /node|wiesio|powershell|cmd|explorer|system|svchost|csrss|winlogon|dwm|services|lsass|conhost/i;
    const names = (req.body?.names || []).filter(n => typeof n === 'string' && n.trim() && !BLOCK.test(n));
    if (!names.length) return res.json({ success: false, message: 'Brak bezpiecznych procesów do zamknięcia.' });
    const closed = [];
    await Promise.all(names.map(n => new Promise(resolve => {
        const img = /\.exe$/i.test(n) ? n : `${n}.exe`;
        exec(`taskkill /IM "${img}" /F`, { timeout: 6000, windowsHide: true }, (err) => { if (!err) closed.push(n); resolve(); });
    })));
    console.log(`[System] 🧹 Zwolniono pamięć — zamknięto: ${closed.join(', ') || '(nic)'}.`);
    res.json({ success: true, closed });
});

// ── 🧠 MODELE LOKALNE — status + realny pull (Gemma 4 / Gemma diffusion) ──────
app.get('/api/models/status', async (req, res) => {
    try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000);
        const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: ctrl.signal }); clearTimeout(t);
        const d = await r.json().catch(() => ({}));
        const models = Array.isArray(d.models) ? d.models.map(m => m.name) : [];
        const has = (n) => models.some(m => m.toLowerCase().startsWith(n));
        res.json({ success: true, online: true, models, active: process.env.OTAKOS_MODEL || 'gemma4', hasGemma4: has('gemma4') || has('gemma3'), hasDiffusion: has('gemma') });
    } catch { res.json({ success: true, online: false, models: [], hasGemma4: false }); }
});
app.post('/api/models/pull', (req, res) => {
    const model = (req.body ?? {}).model;
    if (!model) return res.status(400).json({ success: false, message: 'Brak "model".' });
    // Fire-and-forget — pull leci w tle (duży model), front odpytuje /status.
    fetch(`${OLLAMA_BASE}/api/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: model, stream: false }) })
        .then(() => console.log(`[Models] ✅ pull ${model} done`))
        .catch(e => console.warn(`[Models] pull ${model}: ${e.message}`));
    console.log(`[Models] ⬇️ pull ${model} started`);
    res.json({ success: true, started: true, model });
});

// ── 🎵 MODELE MUZYCZNE (MiniMax-Music-3) — katalog suwerenny + realne pobieranie ──
// Wagi żyją w TeO_Music_V2/models/ (poza repo, 16+ GB). Layout 1:1 z Comfy-Org/
// MiniMax-Music-3, czyli też 1:1 z ComfyUI/models/ — jeden katalog, zero duplikatów.
// Dzięki temu moduł da się zminiaturyzować na otakos.wtf: kod leci lekki, wagi
// dociąga Suweren po pierwszej instalacji.
app.get('/api/music/models', async (req, res) => {
    try {
        res.json(await muzykaModeleStatus());
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/music/models/pull', (req, res) => {
    const { ids, id } = req.body ?? {};
    const lista = Array.isArray(ids) ? ids : (id ? [id] : []);
    if (!lista.length) {
        return res.status(400).json({
            success: false,
            message: 'Brak "ids" (tablica) ani "id".',
            dostepne: MUZYKA_MANIFEST.map(m => m.id),
        });
    }
    const nieznane = lista.filter(x => !muzykaModelPoId(x));
    if (nieznane.length) {
        return res.status(400).json({
            success: false,
            message: `Nieznane id: ${nieznane.join(', ')}`,
            dostepne: MUZYKA_MANIFEST.map(m => m.id),
        });
    }
    res.json(muzykaModelePull(lista));
});

app.post('/api/music/models/remove', async (req, res) => {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ success: false, message: 'Brak "id".' });
    try {
        res.json(await muzykaModeleUsun(id));
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── 🎼 GENERACJA MUZYKI — realnie, przez ComfyUI, albo uczciwe "nie mogę" ─────
// ŻADNEJ SYMULACJI. Jeśli czegoś brakuje, endpoint zwraca 424 i mówi czego —
// nie udaje kroków dyfuzji.
//
// DLACZEGO przez ComfyUI, a nie własny pipeline: pliki wag mają w metadanych
// `comfy_model` (repack Comfy-Org) i są zapakowane pod natywne nody ComfyUI.
// Pisanie własnej inferencji DiT MiniMax-Music-3 to przepisywanie tego, co już
// istnieje — a katalog wag i tak zostaje suwerenny w TeO_Music_V2.
//
// DLACZEGO workflow z pliku, a nie zaszyty w kodzie: nazw nodów MiniMax nie
// wolno wymyślać. Suweren eksportuje workflow z ComfyUI (Workflow → Export API),
// wrzuca do _OtakOs_AI/workflows/minimax_music3.json, a most wstrzykuje parametry
// TYLKO w te wejścia, które w nim realnie istnieją.
const COMFY_BASE = process.env.OTAKOS_COMFY_HOST || 'http://127.0.0.1:8188';
const WORKFLOWS_DIR = path.join(AI_DIR, 'workflows');
const MUSIC_WORKFLOW = path.join(WORKFLOWS_DIR, 'minimax_music3.json');

// ── 🎛️ AUTOMAT COMFYUI ───────────────────────────────────────────────────────
// Katalog portable ComfyUI. Domyslnie dwa poziomy w gore od mostu:
// TeO_Genesis/.. -> ToO APP/.. -> TeO App HuB/ComfyUI_windows_portable_nvidia/...
const COMFY_DIR = process.env.OTAKOS_COMFY_DIR || path.resolve(
    process.cwd(), '..', '..', 'ComfyUI_windows_portable_nvidia', 'ComfyUI_windows_portable'
);

/** Zeby dwa rownolegle teleporty nie odpalily dwoch ComfyUI naraz. */
let comfyStartuje = null;

/** Krotkie sprawdzenie, czy ComfyUI odpowiada. */
async function comfyZyje(ms = 1500) {
    try {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
        const r = await fetch(`${COMFY_BASE}/object_info`, { signal: c.signal });
        clearTimeout(t);
        return r.ok;
    } catch { return false; }
}

/**
 * Budzi ComfyUI, jesli spi. Nie czeka na pelen start — zwraca od razu,
 * bo teleport nie ma na co czekac, a panel i tak odpytuje /engine/status.
 */
async function zapewnijComfyUI(powod = 'żądanie') {
    if (await comfyZyje()) return { online: true, started: false };
    if (comfyStartuje) return comfyStartuje;

    comfyStartuje = (async () => {
        const python = path.join(COMFY_DIR, 'python_embeded', 'python.exe');
        const main = path.join(COMFY_DIR, 'ComfyUI', 'main.py');
        if (!fsSync.existsSync(python) || !fsSync.existsSync(main)) {
            console.warn(`[Automat-ComfyUI] ⚠️ Nie znajduję ComfyUI w ${COMFY_DIR} — ustaw OTAKOS_COMFY_DIR.`);
            return { online: false, started: false, message: `Brak ComfyUI w ${COMFY_DIR}` };
        }
        try {
            const child = spawn(python, ['-s', main, '--windows-standalone-build'], {
                cwd: COMFY_DIR,
                detached: true,
                stdio: 'ignore',
                // PYTHONUTF8: bez tego polski komunikat systemowy (np. ConnectionResetError
                // po polsku) wywala proces na UnicodeEncodeError przy wypisywaniu wlasnego
                // bledu. Wyglada jak losowa awaria, jest kwestia strony kodowej.
                env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
            });
            child.unref();
            console.log(`[Automat-ComfyUI] 🎛️ Budzę ComfyUI (${powod}) — PID ${child.pid}, ładowanie potrwa ~30 s.`);
            return { online: false, started: true, pid: child.pid, message: 'ComfyUI wstaje — pierwszy start trwa ~30 s.' };
        } catch (e) {
            console.warn(`[Automat-ComfyUI] ❌ Nie udało się uruchomić: ${e.message}`);
            return { online: false, started: false, message: e.message };
        } finally {
            // Odblokuj po chwili, zeby kolejna proba byla mozliwa gdyby start padl.
            setTimeout(() => { comfyStartuje = null; }, 45000);
        }
    })();
    return comfyStartuje;
}

/** Recznie: obudz ComfyUI i powiedz co sie stalo. */
app.post('/api/comfy/ensure', async (req, res) => {
    const wynik = await zapewnijComfyUI('ręczne żądanie');
    res.json({ success: true, katalog: COMFY_DIR, base: COMFY_BASE, ...wynik });
});

/** Czy ComfyUI żyje i czy zna nody MiniMax (czyli czy jest dość świeży). */
async function comfyStatus() {
    try {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), 2500);
        const r = await fetch(`${COMFY_BASE}/object_info`, { signal: c.signal });
        clearTimeout(t);
        if (!r.ok) return { online: false, message: `ComfyUI odpowiedział HTTP ${r.status}` };
        const info = await r.json();
        const nody = Object.keys(info);
        const minimax = nody.filter(n => /minimax/i.test(n));
        return { online: true, nodeCount: nody.length, minimaxNodes: minimax, maMinimax: minimax.length > 0 };
    } catch (err) {
        return { online: false, message: `ComfyUI nieosiągalny na ${COMFY_BASE} (${err.message})` };
    }
}

/**
 * Rodziny modeli muzycznych — plik workflow i domyslne parametry kazdej.
 *
 * DLACZEGO DWIE: MiniMax-Music-3 ma faze autoregresywna (~25 krokow na sekunde
 * audio) i encoder 8.7 GB. Zmierzone na RTX 3060 Laptop 6GB / 15.7GB RAM:
 * 16.6 s/krok, 1501 krokow na 60s = ~6h50m, przy GPU na 0% (glod danych, model
 * streamowany z dysku). ACE-Step 1.5 turbo to czysta dyfuzja w 8 krokach —
 * ~190x mniej obliczen — i przyjmuje bpm/keyscale/language jako wejscia noda,
 * z obsluga 'pl' dla polskich tekstow.
 */
const RODZINY_MUZYKI = {
    ace: {
        workflow: 'acestep15.json',
        etykieta: 'ACE-Step 1.5 turbo',
        dit: 'ace-dit-turbo', enc: 'ace-clip-06b', enc2: 'ace-clip-17b', vae: 'ace-vae',
        steps: 8, cfg: 1.0, cfgScale: 2.0,
        uwaga: 'Czysta dyfuzja w 8 krokach, bez fazy autoregresywnej. Obsługuje polskie teksty (language=pl). Zestaw wag: 10,03 GB.',
    },
    minimax: {
        workflow: 'minimax_music3.json',
        etykieta: 'MiniMax-Music-3',
        dit: 'dit-int8', enc: 'text-encoder-pruned-int8', enc2: null, vae: 'dav',
        steps: 30, cfg: 1.7, cfgScale: 1.7,
        uwaga: 'UWAGA: faza autoregresywna ~25 kroków na sekundę audio. Zmierzone na 16 GB RAM: ~6h50m na minutę muzyki. Sensowne dopiero od ~32 GB RAM.',
    },
};

app.get('/api/music/engine/status', async (req, res) => {
    const [modele, comfy] = await Promise.all([muzykaModeleStatus(), comfyStatus()]);

    // Stan liczony OSOBNO dla każdej rodziny — Suweren ma widzieć, że np. ACE jest
    // gotowy, nawet gdy MiniMaxowi czegoś brakuje (i odwrotnie).
    const rodziny = {};
    for (const [nazwa, cfgR] of Object.entries(RODZINY_MUZYKI)) {
        const plik = path.join(WORKFLOWS_DIR, cfgR.workflow);
        const maWorkflow = fsSync.existsSync(plik);
        const wagi = modele.rodziny?.[nazwa];
        const nodyOk = nazwa === 'minimax' ? !!comfy.maMinimax : comfy.online;
        rodziny[nazwa] = {
            etykieta: cfgR.etykieta,
            gotowy: !!wagi?.gotowy && comfy.online && nodyOk && maWorkflow,
            wagiGotowe: !!wagi?.gotowy,
            brakujaceRole: wagi?.brakujaceRole ?? [],
            encodery: wagi ? `${wagi.encoderow}/${wagi.potrzebaEncoderow}` : '?',
            workflow: { plik, obecny: maWorkflow },
            krokow: cfgR.steps,
            uwaga: cfgR.uwaga,
            potrzebne: [cfgR.dit, cfgR.enc, cfgR.enc2, cfgR.vae].filter(Boolean),
        };
    }
    const ktoraGotowa = Object.keys(rodziny).find(k => rodziny[k].gotowy) || null;

    // Braki opisujemy dla rodziny NAJBLIŻSZEJ gotowości (najmniej brakujących rol),
    // żeby lista nie była mieszanką dwóch silników.
    const kandydat = ktoraGotowa
        || Object.keys(rodziny).sort((a, b) => rodziny[a].brakujaceRole.length - rodziny[b].brakujaceRole.length)[0];
    const k = rodziny[kandydat];

    res.json({
        success: true,
        gotowy: !!ktoraGotowa,
        gotowaRodzina: ktoraGotowa,
        rodziny,
        katalogModeli: MUZYKA_KATALOG_MODELI,
        comfy: { base: COMFY_BASE, ...comfy },
        // Zgodność wstecz z panelem
        modele: { pipelineGotowy: modele.pipelineGotowy, brakujaceRole: modele.brakujaceRole },
        workflow: k.workflow,
        // Konkretna lista rzeczy do zrobienia — bez ściemy typu "wkrótce".
        braki: ktoraGotowa ? [] : [
            ...(k.wagiGotowe ? [] : [`${k.etykieta}: brak wag (${k.brakujaceRole.join(', ') || 'encodery ' + k.encodery}) — pobierz w panelu AI Session → Katalog Modeli.`]),
            ...(comfy.online ? [] : [`ComfyUI nie działa na ${COMFY_BASE} — odpal run_nvidia_gpu.bat (dopisz w nim: set PYTHONUTF8=1).`]),
            ...(comfy.online && kandydat === 'minimax' && !comfy.maMinimax ? ['ComfyUI nie zna nodów MiniMax — zaktualizuj przez update/update_comfyui.bat (NIE tym z python_dependencies, wywala się na limicie 260 znaków).'] : []),
            ...(k.workflow.obecny ? [] : [`Brak workflow: ${k.workflow.plik}`]),
        ],
    });
});

/**
 * Wstrzykuje parametry do workflow w formacie API ComfyUI.
 * Zasada: dotykamy WYŁĄCZNIE wejść, które w danym nodzie istnieją — nie dorzucamy
 * kluczy na zgadywanie, bo ComfyUI odrzuciłby graf albo cicho zignorował.
 * Zwraca też co realnie podmieniliśmy, żeby front mógł to pokazać, a nie wierzyć.
 */
function wstrzyknijDoWorkflow(wf, p) {
    const podmienione = [];
    const ustaw = (nodeId, klucz, wartosc, opis) => {
        const wejscia = wf[nodeId]?.inputs;
        if (!wejscia || !(klucz in wejscia)) return false;
        // NIGDY nie nadpisujemy wejscia podlaczonego kablem (w formacie API polaczenie
        // to tablica ["idZrodla", slot]). Np. `seconds` w EmptyMiniMaxMusic3LatentAudio
        // jest wyliczane przez encoder — wstawienie tam liczby rozjezdza dlugosc
        // latentu z dlugoscia kondycjonowania i sampler pada.
        if (Array.isArray(wejscia[klucz])) return false;
        wejscia[klucz] = wartosc;
        podmienione.push(`${nodeId}.${klucz} = ${opis ?? wartosc}`);
        return true;
    };

    for (const [id, node] of Object.entries(wf)) {
        const typ = String(node.class_type || '');
        const we = node.inputs || {};

        // Wagi — wskazujemy pliki z naszego suwerennego katalogu.
        if (p.ditFile)  { for (const k of ['unet_name', 'model_name', 'ckpt_name']) ustaw(id, k, p.ditFile); }
        if (p.encFile)  { for (const k of ['clip_name', 'clip_name1', 'text_encoder_name']) ustaw(id, k, p.encFile); }
        // ACE uzywa DualCLIPLoader z DWOMA ROZNYMI encoderami — wpisanie tego samego
        // pliku w oba sloty daje graf, ktory sie zwaliduje, ale policzy bzdure.
        if (p.encFile2) { ustaw(id, 'clip_name2', p.encFile2); }
        if (p.vaeFile)  { ustaw(id, 'vae_name', p.vaeFile); }

        // Opis brzmienia vs tekst piosenki — rozróżniamy po nazwie wejścia,
        // a gdy node ma tylko "text", po tym czy to node oznaczony jako lyrics.
        if ('lyrics' in we && p.lyrics !== undefined) ustaw(id, 'lyrics', p.lyrics, '<tekst>');
        if ('caption' in we && p.prompt) ustaw(id, 'caption', p.prompt, '<opis>');
        if ('text' in we && p.prompt && !/lyric/i.test(typ) && !('caption' in we)) {
            ustaw(id, 'text', p.prompt, '<opis>');
        }

        // ACE-Step: tempo, tonacja, metrum i jezyk to WEJSCIA noda, nie tekst w prompcie.
        // Dzieki temu suwak BPM i wybor tonacji z panelu trafiaja wprost do modelu.
        if (p.tags     !== undefined && 'tags' in we) ustaw(id, 'tags', p.tags, '<tagi stylu>');
        if (p.bpm      !== undefined) ustaw(id, 'bpm', p.bpm);
        if (p.keyscale !== undefined) ustaw(id, 'keyscale', p.keyscale);
        if (p.language !== undefined) ustaw(id, 'language', p.language);
        if (p.timesignature !== undefined) ustaw(id, 'timesignature', p.timesignature);

        if (p.duration   !== undefined) { for (const k of ['max_duration', 'seconds', 'duration']) ustaw(id, k, p.duration); }
        if (p.seed       !== undefined) { for (const k of ['seed', 'noise_seed']) ustaw(id, k, p.seed); }
        if (p.steps      !== undefined) ustaw(id, 'steps', p.steps);
        // `cfg` (sampler) i `cfg_scale` (encoder) to ROZNE wartosci: w ACE 1.0 vs 2.0.
        // Wczesniej wpisywalem te sama liczbe w oba — dla MiniMaxa uchodzilo (1.7/1.7),
        // dla ACE zepsuloby wynik.
        if (p.cfg        !== undefined) { for (const k of ['cfg', 'guidance']) ustaw(id, k, p.cfg); }
        if (p.cfgScale   !== undefined) ustaw(id, 'cfg_scale', p.cfgScale);
        if (p.tiledDecode !== undefined) ustaw(id, 'tiled_decode', p.tiledDecode);
    }
    return podmienione;
}

app.post('/api/music/generate', async (req, res) => {
    const body = req.body ?? {};
    const {
        prompt, lyrics = '', duration = 60, seed, steps, cfg, cfgScale,
        bpm, keyscale, language, timesignature,
        tiledDecode = true,
    } = body;

    // Rodzina modelu: 'ace' (lekka, 8 krokow) albo 'minimax' (ciezka, faza AR).
    // Domyslnie bierzemy te, ktora ma kompletne wagi — z preferencja dla ACE,
    // bo na tym sprzecie MiniMax liczy ~7h na minute (zmierzone).
    const modele = await muzykaModeleStatus();
    const wybrana = body.rodzina
        || (modele.rodziny?.ace?.gotowy ? 'ace' : (modele.rodziny?.minimax?.gotowy ? 'minimax' : 'ace'));
    const cfgRodziny = RODZINY_MUZYKI[wybrana];
    if (!cfgRodziny) {
        return res.status(400).json({
            success: false,
            message: `Nieznana rodzina: ${wybrana}`,
            dostepne: Object.keys(RODZINY_MUZYKI),
        });
    }

    // ── STRAŻ SPÓJNOŚCI RODZIN ────────────────────────────────────────────────
    // Wagi róznych rodzin NIE lacza sie ze soba. Wpuszczenie DiT MiniMaxa do grafu
    // ACE daje `KeyError: 'conditioning_scale'` dopiero po kilkunastu minutach
    // liczenia — nod MiniMaxa dopisuje to pole do kondycjonowania, encoder ACE nie.
    // Zdarzylo sie realnie: panel wysylal ditId z suwaka int8/fp16/fp32 (id MiniMaxa)
    // niezaleznie od wybranej rodziny i nadpisywal domyslny model ACE.
    // Dlatego most odrzuca obce id ZANIM cokolwiek policzy, zamiast im ufac.
    const zObcejRodziny = [];
    const zRodziny = (podane, domyslne, pole) => {
        if (!podane) return domyslne;
        const m = muzykaModelPoId(podane);
        if (!m) { zObcejRodziny.push(`${pole}: nieznane id "${podane}"`); return domyslne; }
        const jego = m.family || 'minimax';
        if (jego !== wybrana) {
            zObcejRodziny.push(`${pole}: "${podane}" należy do rodziny ${jego}, a graf jest z ${wybrana}`);
            return domyslne;
        }
        return podane;
    };
    const ditId  = zRodziny(body.ditId,  cfgRodziny.dit,  'ditId');
    const encId  = zRodziny(body.encId,  cfgRodziny.enc,  'encId');
    const encId2 = zRodziny(body.encId2, cfgRodziny.enc2, 'encId2');
    const vaeId  = zRodziny(body.vaeId,  cfgRodziny.vae,  'vaeId');
    if (zObcejRodziny.length) {
        console.warn(`[Muzyka] ⚠️ Odrzucono wagi z obcej rodziny: ${zObcejRodziny.join(' | ')}`);
    }

    if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({ success: false, message: 'Brak "prompt" (opis brzmienia).' });
    }

    // 1) Wagi tej rodziny na miejscu?
    const stanRodziny = modele.rodziny?.[wybrana];
    if (!stanRodziny?.gotowy) {
        const potrzebne = [cfgRodziny.dit, cfgRodziny.enc, cfgRodziny.enc2, cfgRodziny.vae].filter(Boolean);
        return res.status(424).json({
            success: false,
            etap: 'modele',
            rodzina: wybrana,
            message: `Brak kompletnych wag dla ${cfgRodziny.etykieta}. Brakujące role: ${(stanRodziny?.brakujaceRole ?? []).join(', ') || '—'}${stanRodziny && stanRodziny.encoderow < stanRodziny.potrzebaEncoderow ? ` (encodery: ${stanRodziny.encoderow}/${stanRodziny.potrzebaEncoderow})` : ''}.`,
            hint: `POST /api/music/models/pull { ids: ${JSON.stringify(potrzebne)} } albo panel AI Session → Katalog Modeli.`,
            brakujaceRole: stanRodziny?.brakujaceRole ?? [],
            potrzebne,
        });
    }
    const uszkodzone = modele.pliki.filter(p => p.uszkodzony).map(p => p.id);
    if (uszkodzone.length) {
        return res.status(424).json({
            success: false, etap: 'modele',
            message: `Pliki wag mają zły rozmiar (niedokończone pobieranie): ${uszkodzone.join(', ')}. Ładowanie takiego pliku wywala silnik.`,
            hint: 'Pobierz je ponownie — pobieranie wznawia się od miejsca zerwania.',
        });
    }

    // 2) ComfyUI żyje i zna MiniMax?
    const comfy = await comfyStatus();
    if (!comfy.online) {
        return res.status(424).json({
            success: false, etap: 'comfy', message: comfy.message,
            hint: 'Odpal ComfyUI (run_nvidia_gpu.bat). Katalog wag wskaż przez extra_model_paths.yaml — patrz /api/music/engine/status.',
        });
    }
    if (wybrana === 'minimax' && !comfy.maMinimax) {
        return res.status(424).json({
            success: false, etap: 'comfy-wersja',
            message: `ComfyUI działa (${comfy.nodeCount} nodów), ale nie zna żadnego noda MiniMax.`,
            hint: 'Zaktualizuj ComfyUI — update/update_comfyui.bat. UWAGA: NIE używaj update_comfyui_and_python_dependencies.bat, na tej ścieżce wywala się na limicie 260 znaków (WinError 206) i rozwala instalację.',
        });
    }

    // 3) Workflow tej rodziny (nazw nodów nie wymyślamy — czytamy z pliku)
    const plikWorkflow = path.join(WORKFLOWS_DIR, cfgRodziny.workflow);
    let wf;
    try {
        wf = JSON.parse(await fs.readFile(plikWorkflow, 'utf8'));
    } catch (err) {
        return res.status(424).json({
            success: false, etap: 'workflow', rodzina: wybrana,
            message: `Nie mogę wczytać workflow: ${plikWorkflow} (${err.message})`,
            hint: `W ComfyUI otwórz szablon dla ${cfgRodziny.etykieta} → Workflow → Export (API) → zapisz pod tą nazwą.`,
        });
    }
    // Export (API) daje płaską mapę id→node. Format UI ma "nodes":[...] i tu nie zadziała.
    if (wf.nodes || !Object.values(wf).some(n => n && n.class_type)) {
        return res.status(422).json({
            success: false, etap: 'workflow-format',
            message: 'To workflow w formacie UI, nie API — most nie umie go uruchomić.',
            hint: 'W ComfyUI użyj Workflow → Export (API), nie zwykłego Save.',
        });
    }

    const nazwaPliku = (id) => (id ? muzykaModelPoId(id)?.path.split('/').pop() : undefined);
    const ditFile = nazwaPliku(ditId);
    const encFile = nazwaPliku(encId);
    const encFile2 = nazwaPliku(encId2);
    const vaeFile = nazwaPliku(vaeId);
    const uzytySeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1e15);

    const podmienione = wstrzyknijDoWorkflow(wf, {
        prompt: String(prompt), lyrics: String(lyrics),
        // ACE ma osobne wejscie `tags` na styl; MiniMax dostaje wszystko w `caption`.
        tags: wybrana === 'ace' ? String(prompt) : undefined,
        duration: Number(duration), seed: uzytySeed,
        steps: steps ?? cfgRodziny.steps,
        cfg: cfg ?? cfgRodziny.cfg,
        cfgScale: cfgScale ?? cfgRodziny.cfgScale,
        bpm, keyscale, language, timesignature,
        tiledDecode,
        ditFile, encFile, encFile2, vaeFile,
    });

    // 4) Do kolejki ComfyUI
    try {
        const r = await fetch(`${COMFY_BASE}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: wf, client_id: `teo_music_v2_${Date.now()}` }),
        });
        const dane = await r.json().catch(() => ({}));
        if (!r.ok) {
            return res.status(502).json({
                success: false, etap: 'kolejka',
                message: `ComfyUI odrzucił graf (HTTP ${r.status}).`,
                comfyError: dane.error ?? dane, nodeErrors: dane.node_errors ?? null,
                podmienione,
            });
        }
        console.log(`[Muzyka] 🎼 Zakolejkowano w ComfyUI: ${dane.prompt_id} | ${cfgRodziny.etykieta} | seed ${uzytySeed} | ${duration}s`);
        return res.json({
            success: true,
            promptId: dane.prompt_id,
            seed: uzytySeed,
            podmienione,
            rodzina: wybrana,
            uwaga: cfgRodziny.uwaga,
            // Nie milczymy o korektach — Suweren ma widziec, ze cos podmienilismy.
            poprawione: zObcejRodziny.length ? zObcejRodziny : undefined,
            engine: `ComfyUI × ${cfgRodziny.etykieta}`,
            katalogModeli: MUZYKA_KATALOG_MODELI,
            // Gotowy plik zjedzie do output ComfyUI; przenosinami do _OtakOs_Muzyka
            // zajmuje się /api/music/collect po zakończeniu.
            message: 'Graf w kolejce ComfyUI. Postęp: GET /api/music/progress?promptId=...',
        });
    } catch (err) {
        return res.status(502).json({ success: false, etap: 'kolejka', message: err.message, podmienione });
    }
});

/**
 * Zamienia surowe `messages` z historii ComfyUI na czytelne zdanie.
 * Bez tego front pokazywał zrzut JSON — nieczytelny i wyglądający na awarię
 * nawet wtedy, gdy Suweren sam kliknął anuluj.
 */
function czytelnyKomunikatComfy(messages) {
    const zdarzenia = Array.isArray(messages) ? messages : [];
    const wynik = { przerwane: false, opis: null, node: null };
    for (const m of zdarzenia) {
        const typ = Array.isArray(m) ? m[0] : null;
        const dane = Array.isArray(m) ? (m[1] ?? {}) : {};
        if (typ === 'execution_interrupted') {
            wynik.przerwane = true;
            wynik.node = dane.node_type || dane.node_id || null;
        }
        if (typ === 'execution_error') {
            wynik.opis = dane.exception_message || dane.exception_type || 'nieznany błąd wykonania';
            wynik.node = dane.node_type || dane.node_id || null;
        }
    }
    return wynik;
}

/** Postęp konkretnego zadania + zebranie gotowego audio do _OtakOs_Muzyka. */
app.get('/api/music/progress', async (req, res) => {
    const promptId = req.query.promptId;
    if (!promptId) return res.status(400).json({ success: false, message: 'Brak ?promptId=' });
    try {
        const r = await fetch(`${COMFY_BASE}/history/${promptId}`);
        const hist = await r.json().catch(() => ({}));
        const wpis = hist[promptId];
        if (!wpis) {
            // Jeszcze nie w historii. ComfyUI rozdziela kolejkę na running i pending —
            // rozróżniamy je, bo "w-kolejce" przy liczącym zadaniu wprowadzało w błąd.
            const q = await fetch(`${COMFY_BASE}/queue`).then(x => x.json()).catch(() => ({}));
            const wTablicy = (arr) => Array.isArray(arr) && arr.some(z => JSON.stringify(z).includes(promptId));
            if (wTablicy(q.queue_running)) {
                return res.json({ success: true, stan: 'liczy', promptId, przedNami: 0 });
            }
            if (wTablicy(q.queue_pending)) {
                return res.json({
                    success: true, stan: 'w-kolejce', promptId,
                    przedNami: (q.queue_running?.length ?? 0) + (q.queue_pending ?? []).findIndex(z => JSON.stringify(z).includes(promptId)),
                });
            }
            return res.json({ success: true, stan: 'nieznane', promptId });
        }
        const status = wpis.status ?? {};
        const czytelny = czytelnyKomunikatComfy(status.messages);
        if (czytelny.przerwane) {
            return res.json({
                success: false, stan: 'przerwane', promptId,
                message: `Zadanie przerwane${czytelny.node ? ` na nodzie ${czytelny.node}` : ''} — anulowane w ComfyUI albo z panelu.`,
            });
        }
        if (status.status_str === 'error' || czytelny.opis) {
            return res.json({
                success: false, stan: 'blad', promptId,
                message: czytelny.opis ? `ComfyUI: ${czytelny.opis}${czytelny.node ? ` (node ${czytelny.node})` : ''}` : 'ComfyUI zgłosił błąd wykonania.',
            });
        }
        // Zbieramy pliki audio z outputów
        const audio = [];
        for (const out of Object.values(wpis.outputs ?? {})) {
            for (const a of (out.audio ?? [])) {
                audio.push({
                    filename: a.filename, subfolder: a.subfolder ?? '', type: a.type ?? 'output',
                    url: `${COMFY_BASE}/view?filename=${encodeURIComponent(a.filename)}&subfolder=${encodeURIComponent(a.subfolder ?? '')}&type=${a.type ?? 'output'}`,
                });
            }
        }
        res.json({
            success: true,
            stan: status.completed ? 'gotowe' : (status.status_str || 'w-toku'),
            promptId, audio,
        });
    } catch (err) {
        res.status(502).json({ success: false, message: `ComfyUI nieosiągalny: ${err.message}` });
    }
});

/**
 * Przenosi gotowy utwór z output ComfyUI do biblioteki Katedry (_OtakOs_Muzyka),
 * żeby Graviton Radio i reszta Katedry go widziały. Realny zapis, realny rozmiar.
 */
app.post('/api/music/collect', async (req, res) => {
    const { filename, subfolder = '', type = 'output', title } = req.body ?? {};
    if (!filename) return res.status(400).json({ success: false, message: 'Brak "filename".' });
    try {
        const url = `${COMFY_BASE}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
        const r = await fetch(url);
        if (!r.ok) return res.status(502).json({ success: false, message: `ComfyUI /view HTTP ${r.status}` });
        const buf = Buffer.from(await r.arrayBuffer());

        const ext = path.extname(filename) || '.flac';
        const bazowa = (title ? String(title) : path.basename(filename, ext))
            .replace(/[^\p{L}\p{N}_ -]/gu, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'TeO_Utwor';
        const docelowy = path.join(MUSIC_DIR, `${bazowa}_${Date.now()}${ext}`);

        await fs.mkdir(MUSIC_DIR, { recursive: true });
        await fs.writeFile(docelowy, buf);
        const st = await fs.stat(docelowy);
        console.log(`[Muzyka] 💾 Zapisano do biblioteki: ${path.basename(docelowy)} (${(st.size / 1e6).toFixed(1)} MB)`);

        res.json({
            success: true,
            savedPath: docelowy,
            bytes: st.size,
            streamUrl: `http://127.0.0.1:${PORT}/music/${encodeURIComponent(path.basename(docelowy))}`,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── 🎤 GŁOS SUWERENA — suwerenny klon głosu (lokalny silnik + fallback) ───────
// Architektura: próbka głosu zapisana LOKALNIE (_OtakOs_AI/voices/). Mowa idzie
// przez lokalny silnik klonu (XTTS/OpenVoice na VOICE_BASE) jeśli obecny; inaczej
// front używa przeglądarki (speechSynthesis). Każdy może to mieć w swojej Katedrze.
const VOICE_BASE = process.env.OTAKOS_VOICE_HOST || 'http://127.0.0.1:5002';
const VOICES_DIR = path.join(AI_DIR, 'voices');

app.get('/api/voice/status', async (req, res) => {
    let available = false;
    try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 1500); const r = await fetch(`${VOICE_BASE}/`, { signal: c.signal }); clearTimeout(t); available = !!r; } catch {}
    let voices = []; try { voices = (await fs.readdir(VOICES_DIR)).filter(f => f.endsWith('.wav')).map(f => f.replace('.wav', '')); } catch {}
    res.json({ success: true, available, base: VOICE_BASE, voices, note: available ? 'Lokalny silnik klonu głosu gotowy.' : 'Brak lokalnego silnika — fallback przeglądarki (speechSynthesis). Zainstaluj XTTS/OpenVoice na :5002 dla suwerennego klonu Twojego głosu.' });
});
app.post('/api/voice/clone', async (req, res) => {
    const { sample, voiceId } = req.body ?? {};
    if (!sample) return res.status(400).json({ success: false, message: 'Brak "sample" (base64 audio).' });
    try {
        await fs.mkdir(VOICES_DIR, { recursive: true });
        const id = String(voiceId || 'suweren').replace(/[^\w-]/g, '') || 'suweren';
        const buf = Buffer.from(String(sample).replace(/^data:audio\/\w+;base64,/, ''), 'base64');
        // Normalizacja do czystego WAV (MediaRecorder daje webm/ogg) — ffmpeg.
        const tmp = path.join(TEMP_DIR, `voice_in_${Date.now()}`);
        await fs.writeFile(tmp, buf);
        const out = path.join(VOICES_DIR, `${id}.wav`);
        try { await execFileAsync(ffmpegPath, ['-i', tmp, '-ar', '22050', '-ac', '1', '-y', out]); }
        catch { await fs.writeFile(out, buf); } // gdyby ffmpeg padł — zapisz surowe
        await fs.rm(tmp, { force: true }).catch(() => {});
        const st = await fs.stat(out);
        console.log(`[Głos] 🎤 Próbka zapisana lokalnie: ${id} (${st.size} B)`);
        res.json({ success: true, voiceId: id, file: `voices/${id}.wav`, bytes: st.size });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
// 🎙️ Wejście głosowe do Orba — nagranie z przeglądarki (base64) → transkrypt (Whisper.cpp lokalnie).
app.post('/api/voice/transcribe', async (req, res) => {
    const { sample, model = 'small' } = req.body ?? {};
    if (!sample) return res.status(400).json({ success: false, message: 'Brak "sample" (base64 audio).' });
    let src = null, wav = null, jsonFile = null;
    try {
        const modelPath = path.join(MODELS_DIR, `ggml-${model}.bin`);
        if (!fsSync.existsSync(modelPath)) return res.status(424).json({ success: false, message: `Brak modelu Whisper: ggml-${model}.bin w _OtakOs_AI/models/.` });
        if (!fsSync.existsSync(WHISPER_EXE)) return res.status(424).json({ success: false, message: 'Brak whisper-cli.exe w _OtakOs_AI/bin/.' });

        const buf = Buffer.from(String(sample).replace(/^data:audio\/\w+;base64,/, ''), 'base64');
        src = path.join(TEMP_DIR, `orb_voice_in_${Date.now()}`);
        await fs.writeFile(src, buf);

        wav = path.join(TEMP_DIR, `orb_voice_${Date.now()}.wav`);
        await execFileAsync(ffmpegPath, ['-i', src, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wav]);

        const outBase = path.join(TEMP_DIR, 'orb_voice_tr_' + Date.now());
        jsonFile = outBase + '.json';
        await execFileAsync(WHISPER_EXE, ['-m', modelPath, '-f', wav, '--output-json-full', '-p', '4', '-l', 'pl', '-of', outBase], { cwd: BIN_DIR });
        if (!fsSync.existsSync(jsonFile)) throw new Error('Whisper nie wygenerował wyniku.');
        const out = JSON.parse(fsSync.readFileSync(jsonFile, 'utf8'));
        const transcript = (out.transcription || []).map(s => String(s.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
        return res.json({ success: true, transcript });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    } finally {
        try {
            if (src) await fs.rm(src, { force: true });
            if (wav) await fs.rm(wav, { force: true });
            if (jsonFile) await fs.rm(jsonFile, { force: true });
        } catch {}
    }
});

app.post('/api/voice/speak', async (req, res) => {
    const { text, voiceId } = req.body ?? {};
    if (!text) return res.status(400).json({ success: false, message: 'Brak "text".' });
    const ref = path.join(VOICES_DIR, `${String(voiceId || 'suweren').replace(/[^\w-]/g, '')}.wav`);
    try {
        // Konwencja lokalnego silnika (XTTS/OpenVoice): POST {text, speaker_wav, language} → audio.
        const r = await fetch(`${VOICE_BASE}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, speaker_wav: fsSync.existsSync(ref) ? ref : undefined, language: 'pl' }) });
        if (!r.ok) throw new Error('engine ' + r.status);
        res.setHeader('Content-Type', 'audio/wav');
        return res.send(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
        return res.status(424).json({ success: false, fallback: 'browser', message: `Lokalny silnik głosu niedostępny (${e.message}). Front użyje przeglądarki.` });
    }
});

// ── 🎥 STUDIO WIDEOPODCASTU — sterowanie relayem RTMP i recorderem ───────────
// Same strumienie idą kanałami WebSocket (/api/rtmp-relay, /api/recorder) —
// tutaj żyje tylko konfiguracja i status. Klucz transmisji NIGDY nie wraca do
// przeglądarki w postaci jawnej (front dostaje maskę typu `••••-a1b2`).

app.get('/api/studio/status', async (req, res) => {
    try {
        res.json(await getStudioStatus());
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/studio/rtmp-key', async (req, res) => {
    const { streamKey, rtmpUrl } = req.body ?? {};
    if (typeof streamKey !== 'string') {
        return res.status(400).json({ success: false, message: 'Brak "streamKey" (pusty string kasuje klucz).' });
    }
    try {
        const saved = await saveRtmpConfig(streamKey, rtmpUrl);
        res.json({ success: true, ...saved, status: await getStudioStatus() });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/studio/pokoje — kto realnie wisi na kanale gości.
 * Panel pokazuje własny stan z przeglądarki; to jest widok od strony MOSTU,
 * więc pozwala rozstrzygnąć, czy telefon nie doszedł, czy tylko UI się zacięło.
 * Dokładamy adresy LAN, bo bez nich nie da się powiedzieć Suwerenowi,
 * pod jakim adresem jego maszyna jest widoczna dla telefonu.
 */
app.get('/api/studio/pokoje', (req, res) => {
    const adresy = [];
    for (const [nazwa, lista] of Object.entries(os.networkInterfaces())) {
        for (const a of lista ?? []) {
            if (a.family === 'IPv4' && !a.internal) adresy.push({ interfejs: nazwa, ip: a.address });
        }
    }
    res.json({
        success: true,
        pokoje: stanPokoi(),
        adresyLan: adresy,
        // Bez tego zdania ktoś kiedyś spróbuje wpisać ten adres w telefon i utknie.
        uwaga: 'Telefon NIE dostanie kamery po adresie http://… — przeglądarka wymaga HTTPS. ' +
               'Użyj Kwantowego Tunelu; sam obraz i tak poleci po sieci lokalnej.',
    });
});

// Lista nagranych odcinków — Suweren widzi, że plik realnie leży na dysku.
app.get('/api/studio/recordings', async (req, res) => {
    try {
        const names = await fs.readdir(RECORDINGS_DIR).catch(() => []);
        const files = [];
        for (const name of names) {
            if (!/\.(webm|mp4)$/i.test(name)) continue;
            try {
                const st = await fs.stat(path.join(RECORDINGS_DIR, name));
                files.push({ name, bytes: st.size, modified: st.mtime.toISOString() });
            } catch { /* plik zniknął w trakcie listowania */ }
        }
        files.sort((a, b) => b.modified.localeCompare(a.modified));
        res.json({ success: true, dir: RECORDINGS_DIR, files });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── 📜 KRONIKA 0.00G — żywy wpis: narracja AI + równoległy feedback agentów ───
async function genOllama(prompt, model, ms = 40000) {
    try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
        const r = await fetch(`${OLLAMA_BASE}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.85 } }) });
        clearTimeout(t);
        return String((await r.json()).response || '').trim();
    } catch { return ''; }
}
// ── 🐣 TEOGOCHI — mały kompan, live komentarz na to co gra ───────────────────
// ── 🥁 PANEL BITÓW — suwerenny step-grid ─────────────────────────────────────
// Matryca [1,0,0,0,...] → realny plik WAV. Perkusja SYNTEZOWANA proceduralnie,
// bez sampli i bez zewnętrznego DAW-a. Bity lądują w _OtakOs_Muzyka/_Bity,
// żeby nie mieszać szkiców z gotowymi utworami w bibliotece radia.
const BITY_DIR = path.join(MUSIC_DIR, '_Bity');

app.post('/api/bit/render', async (req, res) => {
    try {
        const w = await renderujBit(req.body ?? {}, BITY_DIR);
        console.log(`[Bity] 🥁 ${w.plik} — ${w.bpm} BPM, ${w.kroki} kroków, ${w.dspFreq} Hz, ${w.uderzen} uderzeń`);
        res.json({
            success: true,
            plik: w.plik,
            sciezka: w.sciezka,
            uzytyWzor: w.uzytyWzor ?? undefined,
            url: `http://127.0.0.1:${PORT}/music/${encodeURIComponent('_Bity/' + w.plik)}`,
            bpm: w.bpm, kroki: w.kroki, dspFreq: w.dspFreq, powtorzen: w.powtorzen,
            sekundy: Number(w.sekundy.toFixed(2)), uderzen: w.uderzen,
            matryca: w.matryca,
            // Nie milczymy o ścieżkach, których nie znamy — model bywa kreatywny.
            nieznaneSciezki: w.nieznane.length ? w.nieznane : undefined,
            dostepneSciezki: BIT_SCIEZKI,
            // Uczciwie: strojenie dotyczy materiału wysokościowego, nie szumu.
            uwagaStrojenie: `dsp_freq=${w.dspFreq} stroi stopę, korpus werbla i synth-perc. Hi-hat to szum nieharmoniczny — nie jest strojony.`,
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message, dostepneSciezki: BIT_SCIEZKI });
    }
});

/** Biblioteka gotowych rytmów — wspólna dla panelu i dla Joanny. */
app.get('/api/bit/wzorce', (req, res) => {
    res.json({ success: true, wzorce: bitListaWzorcow(), sciezki: BIT_SCIEZKI });
});

/** Podgląd samego parsera — pozwala sprawdzić wzór bez renderowania audio. */
app.post('/api/bit/parsuj', (req, res) => {
    const kroki = [8, 16, 32, 64].includes(Number(req.body?.steps)) ? Number(req.body.steps) : 16;
    // Nazwa wzorca zamiast matrycy — panel wczytuje preset tą samą drogą,
    // z której korzysta Joanna, żeby definicje nie rozjechały się w dwóch miejscach.
    let grid = req.body?.grid;
    let bpm = null;
    if (req.body?.wzor) {
        const w = bitWzorPoNazwie(req.body.wzor);
        if (!w) {
            return res.status(400).json({
                success: false,
                message: `Nie znam wzorca „${req.body.wzor}".`,
                dostepneWzorce: bitListaWzorcow().map(x => x.id),
            });
        }
        grid = w.grid; bpm = w.bpm;
    }
    const { matryca, nieznane } = bitParsujMatryce(grid, kroki);
    res.json({ success: true, kroki, bpm, matryca, nieznaneSciezki: nieznane, dostepneSciezki: BIT_SCIEZKI });
});

// ── ✂️ RZEŹBA AUDIO — cięcie, pętle, sklejanie, pasma ────────────────────────
// Obróbka gotowych nagrań przez lokalny ffmpeg. Wyniki lądują w _OtakOs_Muzyka/_Rzezba,
// żeby szkice nie mieszały się z gotowymi utworami w bibliotece radia.
//
// UWAGA NAZEWNICZA: `pasma` to rozdział po CZĘSTOTLIWOŚCI, NIE separacja stemów.
// Wyciąganie wokalu z miksu wymaga modelu (Demucs) — węzeł go nie ma i nie udajemy,
// że ma. Endpoint zwraca to w polu `uwaga`.
const RZEZBA_DIR = path.join(MUSIC_DIR, '_Rzezba');

/** Zamienia nazwę pliku z biblioteki na pełną ścieżkę; blokuje ucieczkę z katalogu. */
function sciezkaWBibliotece(nazwa) {
    const pelna = path.resolve(MUSIC_DIR, String(nazwa || ''));
    if (!pelna.startsWith(path.resolve(MUSIC_DIR))) {
        throw new Error('Ścieżka ucieka poza bibliotekę muzyki.');
    }
    return pelna;
}

function urlBity(pelna) {
    const wzgl = path.relative(MUSIC_DIR, pelna).replace(/\\/g, '/');
    return `http://127.0.0.1:${PORT}/music/${encodeURIComponent(wzgl)}`;
}

app.get('/api/rzezba/info', async (req, res) => {
    const plik = req.query.plik;
    if (!plik) return res.status(400).json({ success: false, message: 'Brak ?plik=' });
    try {
        const pelna = sciezkaWBibliotece(plik);
        const sek = await audioDlugosc(pelna);
        res.json({ success: true, plik, sekundy: sek, pasma: RZEZBA_PASMA });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

app.post('/api/rzezba/tnij', async (req, res) => {
    try {
        const w = await audioTnij({
            plik: sciezkaWBibliotece(req.body?.plik), od: req.body?.od, ile: req.body?.ile,
            katalogWy: RZEZBA_DIR,
        });
        console.log(`[Rzeźba] ✂️ ${w.plik} (${w.od}s +${w.ile}s)`);
        res.json({ success: true, ...w, url: urlBity(w.sciezka) });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

app.post('/api/rzezba/petla', async (req, res) => {
    try {
        const w = await audioPetla({
            plik: sciezkaWBibliotece(req.body?.plik), od: req.body?.od, ile: req.body?.ile,
            powtorzen: req.body?.powtorzen, katalogWy: RZEZBA_DIR,
        });
        console.log(`[Rzeźba] 🔁 ${w.plik} x${w.powtorzen}`);
        res.json({ success: true, ...w, url: urlBity(w.sciezka) });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

app.post('/api/rzezba/sklej', async (req, res) => {
    try {
        const pliki = (req.body?.pliki ?? []).map(sciezkaWBibliotece);
        const w = await audioSklej({ pliki, katalogWy: RZEZBA_DIR });
        console.log(`[Rzeźba] 🔗 ${w.plik} (${w.zlaczono} plików)`);
        res.json({ success: true, ...w, url: urlBity(w.sciezka) });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

app.post('/api/rzezba/normalizuj', async (req, res) => {
    try {
        const w = await audioNormalizuj({
            plik: sciezkaWBibliotece(req.body?.plik), lufs: req.body?.lufs, katalogWy: RZEZBA_DIR,
        });
        console.log(`[Rzeźba] 📏 ${w.plik} -> ${w.lufs} LUFS`);
        res.json({ success: true, ...w, url: urlBity(w.sciezka) });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

app.post('/api/rzezba/pasma', async (req, res) => {
    try {
        const w = await audioPasma({
            plik: sciezkaWBibliotece(req.body?.plik), ktore: req.body?.ktore, katalogWy: RZEZBA_DIR,
        });
        console.log(`[Rzeźba] 🎚️ pasma: ${w.pasma.map(x => x.pasmo).join(', ')}`);
        res.json({
            success: true,
            pasma: w.pasma.map(x => ({ ...x, url: urlBity(x.sciezka) })),
            uwaga: w.uwaga,
        });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── 🎚️ STEMY — PRAWDZIWA separacja przez Demucs ──────────────────────────────
// To NIE to samo co /api/rzezba/pasma. Pasma dzielą po częstotliwości; TU model
// uczony rozdziela nagranie na wokal / perkusję / bas / resztę.
//
// Demucs siedzi w OSOBNYM venv (F:/OtakOsDemucs), świadomie:
//  - python ComfyUI raz już padł przy dokładaniu paczek — nie ryzykujemy drugi raz,
//  - torch jest CPU-only, żeby separacja nie walczyła o 6 GB VRAM z generacją muzyki,
//  - venv stoi na KRÓTKIEJ ścieżce, bo drzewo licencji torcha przekracza limit
//    260 znaków Windows przy dłuższym prefiksie (ten sam WinError 206).
const DEMUCS_PYTHON = process.env.OTAKOS_DEMUCS_PYTHON || 'F:/OtakOsDemucs/Scripts/python.exe';
const DEMUCS_SKRYPT = path.join(__dirname, 'services', 'demucs_stemy.py');
const STEMY_DIR = path.join(MUSIC_DIR, '_Stemy');

/** Czy separacja jest w ogóle dostępna — mówimy wprost, czego brakuje. */
app.get('/api/stemy/status', (req, res) => {
    const maPythona = fsSync.existsSync(DEMUCS_PYTHON);
    const maSkrypt = fsSync.existsSync(DEMUCS_SKRYPT);
    res.json({
        success: true,
        dostepne: maPythona && maSkrypt,
        python: DEMUCS_PYTHON,
        skrypt: DEMUCS_SKRYPT,
        zrodla: ['drums', 'bass', 'other', 'vocals'],
        urzadzenie: 'cpu',
        braki: [
            ...(maPythona ? [] : [`Brak środowiska Demucs w ${DEMUCS_PYTHON} — utwórz venv i zainstaluj: torch (CPU), demucs, numpy, truststore.`]),
            ...(maSkrypt ? [] : [`Brak skryptu ${DEMUCS_SKRYPT}.`]),
        ],
        uwaga: 'Separacja liczy na CPU — orientacyjnie ~0.7x czasu trwania nagrania. '
             + 'Dla długiego utworu to minuty, nie sekundy.',
    });
});

/** Realna separacja. Blokuje do skutku — front ma o tym uprzedzić Suwerena. */
app.post('/api/stemy/rozdziel', async (req, res) => {
    const { plik, tylko } = req.body ?? {};
    if (!plik) return res.status(400).json({ success: false, message: 'Brak "plik".' });
    if (!fsSync.existsSync(DEMUCS_PYTHON)) {
        return res.status(424).json({
            success: false,
            message: 'Środowisko Demucs nie jest zainstalowane.',
            hint: `Sprawdź GET /api/stemy/status. Oczekiwany python: ${DEMUCS_PYTHON}`,
        });
    }

    let wejscie;
    try { wejscie = sciezkaWBibliotece(plik); }
    catch (e) { return res.status(400).json({ success: false, message: e.message }); }
    if (!fsSync.existsSync(wejscie)) {
        return res.status(404).json({ success: false, message: `Nie ma pliku: ${path.basename(wejscie)}` });
    }

    const args = [DEMUCS_SKRYPT, wejscie, STEMY_DIR];
    if (Array.isArray(tylko) && tylko.length) args.push(`--tylko=${tylko.join(',')}`);

    console.log(`[Stemy] 🎚️ Rozdzielam: ${path.basename(wejscie)} (CPU, to potrwa)`);
    try {
        // 30 min limitu: dlugie utwory na CPU potrafia trwac.
        const { stdout } = await execFileAsync(DEMUCS_PYTHON, args, {
            timeout: 30 * 60 * 1000, maxBuffer: 8 * 1024 * 1024,
        });
        // Skrypt wypisuje JSON w OSTATNIEJ linii — wczesniej moga byc ostrzezenia paczek.
        const linia = String(stdout).trim().split(/\r?\n/).filter(Boolean).pop();
        const d = JSON.parse(linia);
        if (!d.success) return res.status(502).json(d);

        console.log(`[Stemy] ✅ ${d.stemy.length} stemów w ${d.sekundySeparacji}s`);
        res.json({
            ...d,
            stemy: d.stemy.map((x) => ({
                ...x,
                url: `http://127.0.0.1:${PORT}/music/${encodeURIComponent('_Stemy/' + x.plik)}`,
                // RMS ponizej -55 dB to praktycznie cisza — mowimy o tym wprost,
                // zamiast dawac Suwerenowi pusty plik bez slowa wyjasnienia.
                pusty: x.rmsDb < -55,
            })),
            uwaga: 'To PRAWDZIWA separacja (model uczony), nie podział na pasma. '
                 + 'Stem oznaczony jako pusty znaczy, że model nie znalazł tam materiału '
                 + '(np. wokal w utworze instrumentalnym) — to poprawny wynik, nie błąd.',
        });
    } catch (err) {
        const powod = err.killed ? 'przekroczono 30 minut' : (err.stderr || err.message || '').slice(0, 400);
        console.warn(`[Stemy] ❌ ${powod}`);
        res.status(502).json({ success: false, message: `Separacja nie powiodła się: ${powod}` });
    }
});

// ── 🎙️ JOANNA — KOMPANKA Z RĘKAMI ───────────────────────────────────────────
// Do tej pory TeOgochi tylko komentowała muzykę. Tu dostaje ręce: rozmowa może
// wykonać akcję. Wzorzec bliźniaczy z /api/rezyser/rozmowa — ta sama dyscyplina
// (biała lista akcji, kontrakt {mowa, akcja}, wynik z powrotem na zdanie).

/** Pamięć produkcji + ostatnie utwory — do podglądu w UI. */
app.get('/api/joanna/pamiec', async (req, res) => {
    try {
        const dane = await joannaPamiec(ANTIGRAVITY_DIR);
        res.json({ success: true, ...dane });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/** Ocena wprost z UI (kciuk w dół/górę), bez przechodzenia przez model. */
app.post('/api/joanna/ocena', async (req, res) => {
    const { utworId, ocena, uwaga } = req.body ?? {};
    try {
        const u = await joannaOcen(ANTIGRAVITY_DIR, { utworId, ocena, uwaga });
        if (!u) return res.status(404).json({ success: false, message: 'Nie ma czego oceniać — brak utworów w pamięci.' });
        res.json({ success: true, utwor: u });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/joanna/rozmowa  { wypowiedz, historia[], imie? }
 * Zwraca { mowa, akcja, wynikAkcji, uwaga }.
 */
app.post('/api/joanna/rozmowa', async (req, res) => {
    const { wypowiedz = '', historia = [], imie = 'Joanna' } = req.body ?? {};
    if (String(wypowiedz).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Pusta wypowiedź.' });
    }

    try {
        const dane = await joannaPamiec(ANTIGRAVITY_DIR);
        const kontekst = joannaKontekst(dane);
        // Ostatnie 8 tur — dalej i tak wypycha okno modelu na tej maszynie.
        const rozmowa = (Array.isArray(historia) ? historia : []).slice(-8)
            .map(t => `${t.role === 'user' ? 'Suweren' : 'Ty'}: ${t.content}`).join('\n');

        const odp = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: DEFAULT_LLM,
                system: joannaPrompt(kontekst, imie),
                prompt: `${rozmowa ? rozmowa + '\n' : ''}Suweren: ${wypowiedz}\nTy:`,
                stream: false,
                options: { temperature: 0.8 },
            }),
        });
        if (!odp.ok) throw new Error(`Ollama HTTP ${odp.status} — sprawdź, czy rdzeń AI stoi.`);
        const wynikLlm = await odp.json();

        // Kontrakt: gdy model go nie utrzyma, NIE zgadujemy akcji — lepiej sama mowa.
        let mowa, akcja = null, uwaga = null;
        try {
            ({ mowa, akcja } = odczytajOdpowiedz(wynikLlm.response));
        } catch (e) {
            mowa = String(wynikLlm.response || '').trim();
            uwaga = `Model nie utrzymał formatu (${e.message}) — potraktowane jako sama wypowiedź, bez akcji.`;
            console.warn(`[Joanna] ⚠️ ${uwaga}`);
        }
        if (!mowa && !akcja) {
            return res.status(502).json({ success: false, message: 'Joanna milczy — rdzeń AI zwrócił pustkę.' });
        }

        // ── Wykonanie akcji (biała lista) ─────────────────────────────────────
        let wynikAkcji = null;
        if (akcja) {
            if (!AKCJE_JOANNY.has(akcja.typ)) {
                wynikAkcji = { wykonana: false, powod: `nieznana akcja „${akcja.typ}" — pominięta` };
                console.warn(`[Joanna] ⛔ ${wynikAkcji.powod}`);
            } else {
                try {
                    wynikAkcji = await wykonajAkcjeJoanny(akcja);
                } catch (e) {
                    wynikAkcji = { wykonana: false, powod: e.message };
                    console.warn(`[Joanna] ❌ Akcja "${akcja.typ}" padła: ${e.message}`);
                }
            }
            // Doklejamy zdanie o wyniku, żeby mowa nie rozjechała się z faktami —
            // model potrafi powiedzieć "zrobione", gdy akcja padła.
            const zdanie = joannaZdanie(akcja.typ, wynikAkcji);
            mowa = mowa ? `${mowa} ${zdanie}` : zdanie;
        }

        res.json({ success: true, mowa, akcja, wynikAkcji, uwaga });
    } catch (err) {
        console.warn(`[Joanna] ❌ ${err.message}`);
        res.status(502).json({ success: false, message: err.message });
    }
});

/**
 * Realne wykonanie akcji Joanny. Każda gałąź wywołuje istniejący, sprawdzony
 * mechanizm — nic tu nie udaje działania.
 */
async function wykonajAkcjeJoanny(akcja) {
    switch (akcja.typ) {

        case 'zrob_utwor': {
            // Generacja trwa kilkadziesiąt sekund — NIE blokujemy nią rozmowy.
            // Kolejkujemy i oddajemy promptId; front odpytuje /api/music/progress.
            const dlugosc = Math.max(10, Math.min(240, Number(akcja.dlugosc) || 30));
            const ciało = {
                prompt: [akcja.opis, akcja.styl].filter(Boolean).join(', ') || 'ambient soundscape',
                lyrics: akcja.tekst || '',
                duration: dlugosc,
                ...(akcja.bpm ? { bpm: Math.max(40, Math.min(200, Number(akcja.bpm))) } : {}),
                ...(akcja.tonacja ? { keyscale: String(akcja.tonacja) } : {}),
                language: 'pl',
            };
            const r = await fetch(`http://127.0.0.1:${PORT}/api/music/generate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ciało),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.success) {
                return { wykonana: false, powod: d.message || `silnik odmówił (HTTP ${r.status})` };
            }
            const wpis = await joannaZapiszUtwor(ANTIGRAVITY_DIR, {
                opis: ciało.prompt, styl: akcja.styl ?? null, bpm: akcja.bpm ?? null,
                tonacja: akcja.tonacja ?? null, dlugosc, promptId: d.promptId,
            });
            console.log(`[Joanna] 🎼 Zleciła utwór: "${ciało.prompt.slice(0, 50)}" (${dlugosc}s, id ${wpis.id})`);
            return {
                wykonana: true,
                opis: `${dlugosc} sekund, ${ciało.prompt.slice(0, 60)}`,
                promptId: d.promptId, utworId: wpis.id, rodzina: d.rodzina,
            };
        }

        case 'zagraj': {
            const szukaj = String(akcja.czego ?? '').toLowerCase();
            const pliki = (await getAudioFilesRecursive(MUSIC_DIR)) ?? [];
            const trafione = pliki.filter(p => !szukaj || path.basename(p).toLowerCase().includes(szukaj));
            if (!trafione.length) {
                return { wykonana: false, powod: szukaj ? `nie znalazłam nic pasującego do „${szukaj}"` : 'biblioteka jest pusta' };
            }
            const wybrany = trafione[Math.floor(Math.random() * trafione.length)];
            const nazwa = path.basename(wybrany);
            return {
                wykonana: true, opis: nazwa,
                url: `http://127.0.0.1:${PORT}/music/${encodeURIComponent(path.relative(MUSIC_DIR, wybrany).replace(/\\/g, '/'))}`,
            };
        }

        case 'ocen': {
            const u = await joannaOcen(ANTIGRAVITY_DIR, { ocena: akcja.ocena, uwaga: akcja.uwaga });
            if (!u) return { wykonana: false, powod: 'nie ma jeszcze żadnego utworu do oceny' };
            return { wykonana: true, opis: `${u.ocena ?? '—'}/5 dla „${u.opis.slice(0, 40)}"` };
        }

        case 'zapamietaj': {
            const tresc = akcja.fakt ?? akcja.tresc;
            if (!tresc) return { wykonana: false, powod: 'pusty fakt' };
            const w = await joannaZapamietaj(ANTIGRAVITY_DIR, tresc);
            return { wykonana: true, opis: w.tresc };
        }

        case 'stworz_bit': {
            // Jason w specyfikacji zaproponował kształt {"akcja":"stworz_bit","parametry":{...}}.
            // Parser Reżysera spłaszcza to do akcja.parametry, więc obsługujemy OBA
            // kształty — i ten, i płaski {"typ":"stworz_bit","bpm":...}.
            const p = akcja.parametry ?? akcja;
            try {
                const w = await renderujBit(p, BITY_DIR);
                console.log(`[Joanna] 🥁 Złożyła bit: ${w.plik} (${w.bpm} BPM, ${w.uderzen} uderzeń)`);
                return {
                    wykonana: true,
                    opis: `${w.bpm} BPM, ${w.kroki} kroków, ${w.uderzen} uderzeń, strojenie ${w.dspFreq} Hz`,
                    plik: w.plik,
                    url: `http://127.0.0.1:${PORT}/music/${encodeURIComponent('_Bity/' + w.plik)}`,
                    matryca: w.matryca,
                    sekundy: Number(w.sekundy.toFixed(2)),
                    nieznaneSciezki: w.nieznane.length ? w.nieznane : undefined,
                };
            } catch (e) {
                return { wykonana: false, powod: e.message };
            }
        }

        case 'pokaz_biblioteke': {
            const pliki = (await getAudioFilesRecursive(MUSIC_DIR)) ?? [];
            const dane = await joannaPamiec(ANTIGRAVITY_DIR);
            return {
                wykonana: true,
                opis: `${pliki.length} utworów w bibliotece, ${dane.utwory.length} z mojej produkcji`,
                utwory: pliki.slice(-20).map(p => path.basename(p)),
            };
        }

        default:
            return { wykonana: false, powod: `akcja „${akcja.typ}" nie ma implementacji` };
    }
}

/**
 * Domyka utwór Joanny: zbiera gotowe audio z ComfyUI do biblioteki i dopina
 * nazwę pliku do jej pamięci produkcji. Front woła to, gdy postęp = gotowe.
 */
app.post('/api/joanna/domknij', async (req, res) => {
    const { promptId, title } = req.body ?? {};
    if (!promptId) return res.status(400).json({ success: false, message: 'Brak "promptId".' });
    try {
        const p = await fetch(`http://127.0.0.1:${PORT}/api/music/progress?promptId=${encodeURIComponent(promptId)}`);
        const dp = await p.json();
        if (dp.stan !== 'gotowe' || !dp.audio?.length) {
            return res.json({ success: false, stan: dp.stan, message: 'Utwór jeszcze nie jest gotowy.' });
        }
        const a = dp.audio[0];
        const c = await fetch(`http://127.0.0.1:${PORT}/api/music/collect`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: a.filename, subfolder: a.subfolder, type: a.type, title: title || 'Joanna' }),
        });
        const dc = await c.json();
        if (!dc.success) return res.status(502).json({ success: false, message: dc.message });
        const wpis = await joannaDopiszPlik(ANTIGRAVITY_DIR, promptId, path.basename(dc.savedPath));
        console.log(`[Joanna] 💾 Domknęła utwór: ${path.basename(dc.savedPath)}`);
        res.json({ success: true, savedPath: dc.savedPath, streamUrl: dc.streamUrl, utwor: wpis });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 📻 ZAPOWIEDŹ RADIOWA — Joanna jako DJ-ka Katedry.
 *
 * Krótkie zdanie między utworami. Świadomie NIE syntezujemy tu mowy: głos robi
 * przeglądarka (speechSynthesis), bo lokalny silnik klonu głosu jest opcjonalny
 * i zwykle go nie ma. Most daje TEKST, front daje GŁOS — i nikt nie udaje, że
 * mamy studyjny lektor.
 *
 * Zapowiedź zna pamięć produkcji, więc o własnym utworze powie inaczej niż
 * o cudzym („ten składałam wczoraj").
 */
app.post('/api/joanna/zapowiedz', async (req, res) => {
    const { utwor, poprzedni = null, imie = 'Joanna' } = req.body ?? {};
    if (!utwor) return res.status(400).json({ success: false, message: 'Brak "utwor".' });

    try {
        const dane = await joannaPamiec(ANTIGRAVITY_DIR);
        // Czy to jej własna produkcja? Dopasowanie po nazwie pliku.
        const wlasny = (dane.utwory ?? []).find((u) => u.plik && String(utwor).includes(u.plik.replace(/\.[^.]+$/, '')));

        const kontekst = [
            `Zaraz zagra: ${utwor}`,
            poprzedni ? `Przed chwilą grało: ${poprzedni}` : null,
            wlasny ? `TEN UTWÓR TY ZROBIŁAŚ. Opis: „${wlasny.opis}"${wlasny.ocena ? `, Suweren dał mu ${wlasny.ocena}/5` : ''}.` : null,
        ].filter(Boolean).join('\n');

        const system =
            `Jesteś ${imie} — DJ-ką Radia Katedry OtakOS. Mówisz PO POLSKU, w rodzaju żeńskim. ` +
            'Twoja wypowiedź jest CZYTANA NA GŁOS między utworami: JEDNO zdanie, maksymalnie 18 słów. ' +
            'Bez markdownu, bez emoji, bez cudzysłowów, bez podawania nazwy pliku z rozszerzeniem. ' +
            'Masz brzmieć jak radio: ciepło, konkretnie, czasem z humorem. ' +
            'Jeśli utwór jest twój — możesz o tym wspomnieć naturalnie, bez przechwałek. ' +
            'Zwróć SAMO ZDANIE, nic więcej.';

        const odp = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: DEFAULT_LLM, system, prompt: kontekst,
                stream: false, options: { temperature: 0.9 },
            }),
        });
        if (!odp.ok) throw new Error(`Ollama HTTP ${odp.status}`);
        const d = await odp.json();

        // Model lubi dokleić cudzysłowy albo drugie zdanie — bierzemy pierwsze,
        // bo radio nie znosi gadania przez wejście wokalu.
        let zdanie = String(d.response || '').trim()
            .replace(/^["'„”]+|["'„”]+$/g, '')
            .split(/(?<=[.!?])\s+/)[0]
            .trim();
        if (!zdanie) {
            return res.status(502).json({ success: false, message: 'Joanna milczy — rdzeń AI zwrócił pustkę.' });
        }
        console.log(`[Radio] 📻 Zapowiedź: „${zdanie.slice(0, 70)}"`);
        res.json({ success: true, zapowiedz: zdanie, wlasny: !!wlasny });
    } catch (err) {
        console.warn(`[Radio] ❌ Zapowiedź: ${err.message}`);
        res.status(502).json({ success: false, message: err.message });
    }
});

app.post('/api/teogochi/comment', async (req, res) => {
    const { track, lyric, stage, mood, name } = req.body ?? {};
    const model = DEFAULT_LLM;
    const context = [track ? `Utwór: ${track}` : null, lyric ? `Aktualny wers: "${lyric}"` : null]
        .filter(Boolean).join('\n');
    if (!context) return res.status(400).json({ success: false, message: 'Brak "track" lub "lyric".' });
    // Tamagotchi-kontekst: imię, etap życia i nastrój kolorują reakcję kompana.
    // Nadane imię (inne niż fabryczne) = ochrzczona mała bogini — mówi w rodzaju żeńskim.
    const hasName = name && name !== 'TeOgochi';
    const who = hasName
        ? `Masz na imię ${String(name).slice(0, 24)} — jesteś małą boginią-kompanem Katedry OtakOS i mówisz o sobie W RODZAJU ŻEŃSKIM`
        : 'Jesteś TeOgochi — małym, ciekawskim cyfrowym stworkiem-kompanem w Katedrze OtakOS';
    const persona = stage === 'jajko'
        ? `${who}, wciąż w JAJKU — reagujesz stłumionym głosikiem zza skorupki (pukanie, drżenie, ciche piski).`
        : `${who} (etap: ${stage || 'pisklę'}).`;
    const moodLine = mood ? ` Twój aktualny nastrój: ${mood} — niech to słychać w odpowiedzi.` : '';
    const prompt = `${persona} Słuchasz muzyki razem z Suwerenem.${moodLine} Zareaguj JEDNYM krótkim, żywym zdaniem (max 12 słów) na to, co teraz gra — ciepło, czasem zabawnie, czasem wzruszony. Bez cudzysłowów, bez wyjaśnień — samo zdanie.\n\n${context}`;
    // Gdy główny rdzeń nie odpowie, wolimy łamaną polszczyznę od ciszy — ale MÓWIMY
    // wprost, że to tor awaryjny. Wcześniej ten fallback był cichy i Suweren słyszał
    // „byntę słodki wiatr" nie wiedząc, że rozmawia z modelem 0,8 GB zamiast z Joanną.
    // Rdzeń jest cięższy niż drobinka, więc dajemy mu uczciwy czas na zimny start.
    // 120 s: zimny start 7,2 GB na słabszej maszynie potrafi trwać. Dymek Joanny
    // jest asynchroniczny — dłuższe czekanie nikogo nie blokuje, a cisza boli bardziej.
    let comment = await genOllama(prompt, model, 120000);
    let awaryjny = false;
    if (!comment && model !== FALLBACK_LLM) {
        comment = await genOllama(prompt, FALLBACK_LLM, 15000);
        awaryjny = Boolean(comment);
        console.warn(`[TeOgochi] ⚠️ Rdzeń "${model}" nie odpowiedział — zdanie z awaryjnego ${FALLBACK_LLM} (jakość językowa będzie gorsza).`);
    }
    return res.json({ success: true, comment: comment || null, model: awaryjny ? FALLBACK_LLM : model, fallback: awaryjny });
});

app.post('/api/kronika/forge', async (req, res) => {
    let { narrative, transcript, title, videoUrl, model } = req.body ?? {};
    model = model || DEFAULT_LLM;
    const source = (narrative || transcript || '').trim();
    if (source.length < 20) return res.status(400).json({ success: false, message: 'Wymagane "narrative" lub "transcript" (>=20 zn.).' });
    try {
        // 1. Narracja główna (lokalny Gemma 4)
        const narr = await genOllama(
            `Jesteś Kronikarzem Katedry OtakOS (mistyczno-cyberpunkowy ton, 0.00G). Z poniższej treści napisz JEDEN wpis Kroniki — 3-4 zdania, żywe, poetyckie, o intencji i kreacji. Bez nagłówków.\n\nTREŚĆ:\n${source.slice(0, 3000)}`, model);

        // 2. Równoległy feedback 3 agentów
        const base = narr || source.slice(0, 600);
        const [adamus, bella, oddi] = await Promise.all([
            genOllama(`Jako Mistrz Adamus (strategiczny mentor, alchemia intencji) skomentuj 1 zdaniem ten wpis Kroniki:\n"${base}"`, model, 25000),
            genOllama(`Jako Bella (estetyka, wizja, piękno) skomentuj 1 zdaniem ten wpis Kroniki:\n"${base}"`, model, 25000),
            genOllama(`Jako ODDI (bezwzględna czysta logika AI) skomentuj 1 zdaniem ten wpis Kroniki:\n"${base}"`, model, 25000),
        ]);

        const usedLLM = !!narr;
        const clean = (s, fb) => (s && s.length > 2 ? s.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0].slice(0, 240) : fb);
        const auras = ['cyan', 'gold', 'magenta', 'violet'];
        const entry = {
            id: Date.now().toString(),
            title: (title || 'WPIS KRONIKI').toUpperCase(),
            narrative: clean(narr, source.slice(0, 280)),
            xp: 50 + Math.floor(Math.random() * 50),
            aura: auras[Math.floor(Math.random() * auras.length)],
            videoUrl: videoUrl || null,
            timestamp: new Date().toISOString(),
            type: 'AI_GENERATED',
            comments: [
                { agent: 'Adamus', text: clean(adamus, 'Strategiczna głębia rośnie.') },
                { agent: 'Bella', text: clean(bella, 'Estetyka rezonuje z wizją.') },
                { agent: 'ODDI', text: clean(oddi, 'Logika spójna. Wektor stabilny.') },
            ],
        };
        return res.json({ success: true, usedLLM, entry });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── 📜 DZIENNIK POKŁADOWY — przemiał podcastu/rozmowy w infografikę 0.00G ─────
const DZIENNIK_DIR = path.join(process.cwd(), 'public', 'dzienniki');
const PODCASTI_DIR = path.join(ANTIGRAVITY_DIR, 'Podcasti');

/** GET /api/dziennik/list — foldery podcastów + gotowe dzienniki. */
app.get('/api/dziennik/list', async (req, res) => {
    let podcasts = [], dzienniki = [];
    try { podcasts = (await fs.readdir(PODCASTI_DIR, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name).sort(); } catch {}
    try { dzienniki = (await fs.readdir(DZIENNIK_DIR)).filter(f => f.endsWith('.html')).sort(); } catch {}
    res.json({ success: true, podcasts, dzienniki });
});

/**
 * POST /api/dziennik/forge — Body: { transcript?, podcastDir?, title?, cycle?, model? }
 * LLM strukturyzuje rozmowę → buildDziennikHtml → zapis public/dzienniki/.
 * Fallback bez LLM: szkielet z transkrypcji.
 */
app.post('/api/dziennik/forge', async (req, res) => {
    let { transcript, podcastDir, title, cycle, model } = req.body ?? {};
    model = model || DEFAULT_LLM;
    try {
        // Transkrypcja z folderu podcastu (jeśli jest plik .txt/.md/.lrc)
        if (!transcript && podcastDir) {
            const abs = path.join(PODCASTI_DIR, String(podcastDir).replace(/[^\w.-]/g, ''));
            try {
                const files = await fs.readdir(abs);
                const tf = files.find(f => /\.(txt|md|lrc|vtt|srt)$/i.test(f));
                if (tf) transcript = await fs.readFile(path.join(abs, tf), 'utf8');
            } catch {}
            if (!transcript) return res.status(422).json({ success: false, message: `Brak transkrypcji w Podcasti/${podcastDir} (.txt/.md). Transkrybuj audio (Whisper) albo podaj "transcript".` });
        }
        if (!transcript || transcript.trim().length < 30) return res.status(400).json({ success: false, message: 'Wymagane "transcript" (>=30 zn.) lub "podcastDir" z plikiem tekstu.' });

        // LLM → struktura JSON
        let data = null;
        const prompt =
`Jesteś kronikarzem Katedry OtakOS. Z rozmowy/podcastu zbuduj Dziennik Pokładowy.
ROZMOWA:
${transcript.slice(0, 4000)}

Zwróć WYŁĄCZNIE JSON:
{"title":"<TYTUŁ WIELKIMI>","cycle":"<nazwa cyklu>","intro":"<2 zdania o energii sesji>",
"council":[{"name":"Mistrz Adamus","role":"<wkład>","color":"#d946ef"},{"name":"ISTed","role":"<wkład>","color":"#10b981"},{"name":"Wiesio","role":"<wkład>","color":"#06b6d4"},{"name":"Oddi","role":"<wkład>","color":"#f59e0b"}],
"councilChart":{"labels":["Adamus","ISTed","Wiesio","Oddi","Bella","Jadziunia"],"data":[98,100,99,92,95,88]},
"modules":[{"icon":"🎮","name":"<moduł>","desc":"<opis>"},{"icon":"📦","name":"<moduł>","desc":"<opis>"},{"icon":"📖","name":"<moduł>","desc":"<opis>"}],
"economy":{"intro":"<1 zdanie PEIE>","metricLabel":"Redukcja Kosztów API","metricValue":"100%"},
"timeline":[{"title":"<krok>","desc":"<opis>"},{"title":"<krok>","desc":"<opis>"},{"title":"<krok>","desc":"<opis>"}]}
Bez komentarza, tylko JSON.`;
        try {
            const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 60000);
            const r = await fetch(`${OLLAMA_BASE}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.7 } }) });
            clearTimeout(t);
            const txt = String((await r.json()).response || '');
            const m = txt.match(/\{[\s\S]*\}/);
            if (m) data = JSON.parse(m[0]);
        } catch { /* fallback */ }

        if (!data || !data.title) {
            // Fallback bez LLM — szkielet z transkrypcji
            const paras = transcript.split(/\n{2,}/).filter(p => p.trim().length > 20).slice(0, 4);
            data = {
                title: (title || 'DZIENNIK POKŁADOWY').toUpperCase(), cycle: cycle || 'Era 0.00G',
                intro: paras[0]?.slice(0, 240) || 'Sesja zarejestrowana w Kronikach Katedry.',
                council: [{ name: 'Mistrz Adamus', role: 'Dusza i Zmysły', color: '#d946ef' }, { name: 'ISTed', role: 'Ekonomia PEIE', color: '#10b981' }, { name: 'Wiesio', role: 'Infrastruktura', color: '#06b6d4' }, { name: 'Oddi', role: 'Autonomia', color: '#f59e0b' }],
                modules: paras.slice(1).map((p, i) => ({ icon: ['🎮', '📦', '📖'][i] || '✨', name: `Wektor ${i + 1}`, desc: p.slice(0, 140) })),
                economy: { intro: 'Lokalny rdzeń = zysk czysty.', metricLabel: 'Redukcja Kosztów API', metricValue: '100%' },
                timeline: paras.map((p, i) => ({ title: `Faza ${i + 1}`, desc: p.slice(0, 120) })),
            };
        }
        if (title) data.title = title.toUpperCase();
        if (cycle) data.cycle = cycle;

        const html = buildDziennikHtml(data);
        await fs.mkdir(DZIENNIK_DIR, { recursive: true });
        const slug = (podcastDir ? `podcast_${podcastDir}` : (data.title || 'dziennik').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)) + '.html';
        const file = path.join(DZIENNIK_DIR, slug);
        await fs.writeFile(file, html, 'utf8');
        return res.json({ success: true, file: `dzienniki/${slug}`, url: `/dzienniki/${slug}`, title: data.title, usedLLM: !!data.councilChart });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/podcast/transcribe — audio → tekst (Whisper.cpp), bez chmury.
 * Body: { podcastDir? | audioPath?, model? }  (model whisper: small/base/tiny)
 */
app.post('/api/podcast/transcribe', async (req, res) => {
    let { podcastDir, audioPath, model } = req.body ?? {};
    model = model || 'small';
    let wav = null, jsonFile = null;
    try {
        let audio = audioPath;
        if (!audio && podcastDir) {
            const dir = path.join(PODCASTI_DIR, String(podcastDir).replace(/[^\w.-]/g, ''));
            const files = await getAudioFilesRecursive(dir);
            if (!files.length) return res.status(404).json({ success: false, message: `Brak audio w Podcasti/${podcastDir}.` });
            let best = files[0], bestSize = -1;            // największy plik = główne nagranie
            for (const f of files) { try { const st = await fs.stat(f); if (st.size > bestSize) { bestSize = st.size; best = f; } } catch {} }
            audio = best;
        }
        if (!audio) return res.status(400).json({ success: false, message: 'Podaj "podcastDir" lub "audioPath".' });
        const audioAbs = path.isAbsolute(audio) ? audio : path.join(process.cwd(), audio);
        if (!fsSync.existsSync(audioAbs)) return res.status(404).json({ success: false, message: 'Audio nie istnieje.' });

        const modelPath = path.join(MODELS_DIR, `ggml-${model}.bin`);
        if (!fsSync.existsSync(modelPath)) return res.status(424).json({ success: false, message: `Brak modelu Whisper: ggml-${model}.bin w _OtakOs_AI/models/.`, hint: 'https://huggingface.co/ggerganov/whisper.cpp/tree/main' });
        if (!fsSync.existsSync(WHISPER_EXE)) return res.status(424).json({ success: false, message: 'Brak whisper-cli.exe w _OtakOs_AI/bin/.' });

        wav = path.join(TEMP_DIR, `whisper_in_${Date.now()}.wav`);
        await execFileAsync(ffmpegPath, ['-i', audioAbs, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wav]);
        const outBase = path.join(TEMP_DIR, 'whisper_tr_' + Date.now());
        jsonFile = outBase + '.json';
        await execFileAsync(WHISPER_EXE, ['-m', modelPath, '-f', wav, '--output-json-full', '-p', '4', '-l', 'pl', '-of', outBase], { cwd: BIN_DIR });
        if (!fsSync.existsSync(jsonFile)) throw new Error('Whisper nie wygenerował wyniku.');
        const out = JSON.parse(fsSync.readFileSync(jsonFile, 'utf8'));
        const transcript = (out.transcription || []).map(s => String(s.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
        return res.json({ success: true, audio: path.relative(process.cwd(), audioAbs), chars: transcript.length, transcript });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    } finally {
        try { if (wav) await fs.rm(wav, { force: true }); if (jsonFile) await fs.rm(jsonFile, { force: true }); } catch {}
    }
});

// ── 🔐 CRYPTO-AGILITY — zwinność kryptograficzna (Dekret Kwantowy) ───────────
app.get('/api/crypto/status', async (req, res) => {
    const c = CryptoAgility.getInstance(ANTIGRAVITY_DIR); await c.load();
    res.json({ success: true, ...c.status() });
});
app.post('/api/crypto/mode', async (req, res) => {
    try { const m = await CryptoAgility.getInstance(ANTIGRAVITY_DIR).setMode((req.body ?? {}).mode); res.json({ success: true, mode: m }); }
    catch (e) { res.status(400).json({ success: false, message: e.message }); }
});
app.get('/api/crypto/selftest', (req, res) => {
    res.json({ success: true, result: CryptoAgility.getInstance(ANTIGRAVITY_DIR).selfTest() });
});

/**
 * POST /api/teledysk/storyboard — GENERATOR OPOWIEŚCI do utworu (lokalny LLM).
 * Body: { title, lyricsFile?|lyrics?, vectors?|sonicFile?, sceneCount?, model? }
 * Bierze tytuł + tekst (.lrc) + profil energii sonicznej i prosi lokalny model
 * (Ollama) o storyboard scen zsynchronizowanych z narastaniem energii. Zwraca
 * sceny {mood, opis, keywords[]} — mózg, który potem może dobierać/generować
 * materiały. Fallback: szkielet bez LLM, gdy most-rdzeń offline.
 */
// 🐣🎬 WIZJA JOANNY — kompan opowiada, o czym jest piosenka (brief dla reżysera).
// Joanna słucha sercem, filmowy TeOgochi z tego robi teledysk. Body: { title, name? }
app.post('/api/teledysk/vision', async (req, res) => {
    const { title, name } = req.body ?? {};
    if (!title) return res.status(400).json({ success: false, message: 'Brak "title".' });
    const model = DEFAULT_LLM;
    const who = name && name !== 'TeOgochi' ? String(name).slice(0, 24) : 'TeOgochi';
    const prompt = `Jesteś ${who} — małą, czułą duszą Katedry, która słucha muzyki sercem. Suweren pyta Cię, O CZYM jest utwór "${title}". Odpowiedz 2-3 zdaniami: jaka emocja, jaki obraz, jaki kolor i ruch z niego płyną. Poetycko, ciepło, po polsku. To będzie brief dla teledysku — mów o uczuciu i wizji, nie o technice.`;
    const vision = await genOllama(prompt, model, 20000)
        || await genOllama(prompt, 'gemma3:1b', 15000);
    return res.json({ success: true, vision: vision || null, by: who });
});

app.post('/api/teledysk/storyboard', async (req, res) => {
    let { title, lyrics, lyricsFile, vectors, sonicFile, sceneCount, model, vision } = req.body ?? {};
    sceneCount = Math.max(3, Math.min(12, Number(sceneCount) || 6));
    model = model || DEFAULT_LLM;
    try {
        // Tekst z .lrc (usuń znaczniki [mm:ss.xx])
        if (!lyrics && lyricsFile) {
            const abs = path.resolve(process.cwd(), String(lyricsFile));
            if (!abs.startsWith(process.cwd())) return res.status(403).json({ success: false, message: 'lyricsFile poza projektem.' });
            const raw = await fs.readFile(abs, 'utf8').catch(() => '');
            lyrics = raw.replace(/\[\d{1,2}:\d{2}(\.\d{1,2})?\]/g, '').replace(/\n{2,}/g, '\n').trim();
        }
        // Profil energii z wektorów
        if (!Array.isArray(vectors) && sonicFile) {
            const abs = path.resolve(process.cwd(), String(sonicFile));
            if (abs.startsWith(process.cwd())) {
                const parsed = JSON.parse(await fs.readFile(abs, 'utf8'));
                vectors = Array.isArray(parsed) ? parsed : (parsed.vectors || parsed.steps || []);
            }
        }
        let energy = 'nieznany';
        if (Array.isArray(vectors) && vectors.length) {
            const b = vectors.map(v => Number(v.b ?? v.bass ?? 0));
            const max = Math.max(...b, 1), avg = b.reduce((a, x) => a + x, 0) / b.length / max;
            const peaks = b.filter(x => x / max > 0.7).length;
            energy = `średnia ${(avg * 100).toFixed(0)}%, ${peaks} silnych uderzeń, ${vectors.length} kroków`;
        }

        const prompt =
`Jesteś reżyserem teledysków. Stwórz storyboard do utworu.
TYTUŁ: ${title || '(bez tytułu)'}
${vision ? `WIZJA (od Joanny, która słuchała sercem — trzymaj się tego nastroju i obrazów):\n${String(vision).slice(0, 600)}\n` : ''}${lyrics ? `TEKST:\n${lyrics.slice(0, 1200)}\n` : ''}PROFIL ENERGII: ${energy}

Zwróć WYŁĄCZNIE tablicę JSON ${sceneCount} scen narastających z energią utworu.
Każda scena: {"mood":"<nastrój>","desc":"<opis wizualny 1 zdanie>","keywords":["k1","k2","k3"]}.
Bez komentarza, tylko JSON.`;

        // Wywołanie lokalnego modelu (Ollama, non-stream)
        let scenes = null, usedLLM = false;
        try {
            const ctrl = new AbortController();
            const tmo = setTimeout(() => ctrl.abort(), 45000);
            const r = await fetch(`${OLLAMA_BASE}/api/generate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
                body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.8 } }),
            });
            clearTimeout(tmo);
            const data = await r.json();
            const txt = String(data.response || '');
            const m = txt.match(/\[[\s\S]*\]/);
            if (m) { scenes = JSON.parse(m[0]); usedLLM = true; }
        } catch (e) { /* fallback poniżej */ }

        if (!Array.isArray(scenes) || !scenes.length) {
            // Fallback bez LLM — szkielet narastający
            const moods = ['intro / cisza', 'budzenie', 'wzrost', 'kulminacja', 'przełom', 'wybrzmienie'];
            scenes = Array.from({ length: sceneCount }, (_, i) => ({
                mood: moods[Math.min(i, moods.length - 1)],
                desc: `Scena ${i + 1} — wizualizacja energii utworu (${title || 'utwór'}).`,
                keywords: ['abstrakcja', 'światło', 'ruch'],
            }));
        }

        return res.json({ success: true, title: title || null, sceneCount: scenes.length, model: usedLLM ? model : 'fallback', usedLLM, energy, scenes });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/teledysk/scene — generator WŁASNYCH scen z opisu (3 tryby do wyboru).
 * Body: { desc?, mood?, style?, mode:'proc'|'sd'|'gemini', duration?, fps?, sdUrl?, apiKey?, model? }
 *   proc   = programmatic 0.00G (ffmpeg lavfi — zero AI, pełna suwerenność)
 *   sd     = lokalny Stable Diffusion (txt2img) → Ken-Burns
 *   gemini = chmura Imagen (wymaga klucza) → Ken-Burns
 * Zwraca wygenerowany klip sceny (do użycia jako materiał w /api/teledysk/render).
 */
app.post('/api/teledysk/scene', async (req, res) => {
    let { desc, mood, style, mode, duration, fps, sdUrl, apiKey } = req.body ?? {};
    mode = mode || 'proc';
    duration = Math.min(12, Math.max(0.5, Number(duration) || 3));
    fps = Number(fps) > 0 ? Number(fps) : 30;
    const SCENES_DIR = path.join(process.cwd(), '_OtakOs_Move', 'scenes');
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const out = path.join(SCENES_DIR, `scene_${id}.mp4`);
    const rel = () => path.relative(process.cwd(), out);
    try {
        await fs.mkdir(SCENES_DIR, { recursive: true });

        if (mode === 'proc') {
            // Dobór proceduralnego źródła wg nastroju/stylu sceny.
            const s = String(style || mood || desc || '').toLowerCase();
            const src = /spok|calm|cisz|intro|wybrzmie/.test(s) ? 'gradients=s=1280x720:c0=0x0a0a2a:c1=0x1a4a6a:nb_colors=3:speed=0.008'
                : /kulmin|peak|wybuch|moc|energ|siln/.test(s)   ? 'life=s=1280x720:mold=10:r=30:ratio=0.12:death_color=0x001a2a:life_color=0x00ffcc'
                : /przeł|break|chaos|glitch/.test(s)            ? 'cellauto=s=1280x720:rule=110:scroll=1'
                :                                                 'mandelbrot=s=1280x720:rate=30';
            await execFileAsync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', src, '-t', String(duration),
                '-vf', `format=yuv420p,fps=${fps}`, '-c:v', 'libx264', '-preset', 'veryfast', out]);
            return res.json({ success: true, mode: 'proc', output: rel(), style: s || 'auto' });
        }

        if (mode === 'sd') {
            const url = (sdUrl || 'http://127.0.0.1:7860').replace(/\/$/, '');
            const r = await fetch(`${url}/sdapi/v1/txt2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: desc || mood || 'abstract cinematic scene, cohesive lighting', steps: 20, width: 1280, height: 720 }),
            }).catch(() => null);
            if (!r || !r.ok) return res.status(503).json({ success: false, mode: 'sd', message: `Lokalny Stable Diffusion niedostępny (${url}). Uruchom ComfyUI/A1111 z --api.` });
            const data = await r.json();
            const b64 = Array.isArray(data.images) ? data.images[0] : null;
            if (!b64) throw new Error('SD nie zwrócił obrazu.');
            const img = path.join(SCENES_DIR, `sd_${id}.png`);
            await fs.writeFile(img, Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
            await execFileAsync(ffmpegPath, ['-y', '-loop', '1', '-i', img, '-t', String(duration),
                '-vf', `scale=1600:900,zoompan=z='min(zoom+0.0015,1.2)':d=${Math.round(duration * fps)}:s=1280x720,format=yuv420p,fps=${fps}`,
                '-c:v', 'libx264', '-preset', 'veryfast', out]);
            await fs.rm(img, { force: true }).catch(() => {});
            return res.json({ success: true, mode: 'sd', output: rel() });
        }

        if (mode === 'gemini') {
            const key = apiKey || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
            if (!key) return res.status(400).json({ success: false, mode: 'gemini', message: 'Brak klucza Gemini (apiKey / VITE_GEMINI_API_KEY).' });
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${key}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instances: [{ prompt: desc || mood || 'cinematic abstract scene' }], parameters: { sampleCount: 1, aspectRatio: '16:9' } }),
            }).catch(() => null);
            if (!r || !r.ok) return res.status(502).json({ success: false, mode: 'gemini', message: `Imagen niedostępny lub błąd klucza (HTTP ${r ? r.status : 'brak'}).` });
            const data = await r.json();
            const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
            if (!b64) throw new Error('Imagen nie zwrócił obrazu.');
            const img = path.join(SCENES_DIR, `gem_${id}.png`);
            await fs.writeFile(img, Buffer.from(b64, 'base64'));
            await execFileAsync(ffmpegPath, ['-y', '-loop', '1', '-i', img, '-t', String(duration),
                '-vf', `scale=1600:900,zoompan=z='min(zoom+0.0015,1.2)':d=${Math.round(duration * fps)}:s=1280x720,format=yuv420p,fps=${fps}`,
                '-c:v', 'libx264', '-preset', 'veryfast', out]);
            await fs.rm(img, { force: true }).catch(() => {});
            return res.json({ success: true, mode: 'gemini', output: rel() });
        }

        return res.status(400).json({ success: false, message: 'Nieznany mode — użyj proc | sd | gemini.' });
    } catch (err) {
        return res.status(500).json({ success: false, mode, message: err.message });
    }
});

/**
 * POST /api/teledysk/stage-audio — most Music V2 → Teledysk.
 * Body: { audioUrl, title? }
 * Suno zwraca utwór jako zdalny URL (CDN) — /api/teledysk/render potrzebuje
 * pliku lokalnego w projekcie. Pobiera audioUrl i zapisuje do
 * _OtakOs_Muzyka/Music_V2_Imports/<slug>-<ts>.mp3, zwraca ścieżkę relatywną
 * gotową do wklejenia jako "audioFile" w Kreatorze Teledysku.
 */
app.post('/api/teledysk/stage-audio', async (req, res) => {
    const { audioUrl, title } = req.body ?? {};
    try {
        if (!audioUrl || !/^https?:\/\//i.test(audioUrl))
            return res.status(400).json({ success: false, message: '"audioUrl" musi być pełnym http(s) URL.' });

        const response = await fetch(audioUrl);
        if (!response.ok) return res.status(502).json({ success: false, message: `Pobieranie nie powiodło się: ${response.status}` });
        const buf = Buffer.from(await response.arrayBuffer());

        const slug = String(title || 'utwor').toLowerCase()
            .replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'utwor';
        const importDir = path.join(MUSIC_DIR, 'Music_V2_Imports');
        await fs.mkdir(importDir, { recursive: true });
        const fileName = `${slug}-${Date.now()}.mp3`;
        await fs.writeFile(path.join(importDir, fileName), buf);

        const relPath = path.relative(process.cwd(), path.join(importDir, fileName)).replace(/\\/g, '/');
        return res.json({ success: true, audioFile: relPath });
    } catch (err) {
        console.error(`[Teledysk] ❌ stage-audio: ${err.message}`);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/teledysk/render — Punkt 4 cegła 2: realny render beat-sync ffmpegiem.
 * Body: { audioFile, sourceDir, vectors?|sonicFile?, fps?, maxCuts? }
 * Tnie źródła wideo na uderzenia basu, dokłada efekty per segment (zoom/flash/
 * fade wg wokalu/sopranów), miksuje z audio → <sourceDir>/edit/teledysk.mp4.
 */
// LRC ([mm:ss.xx] tekst) → SRT (napisy wypalane na teledysku). Każdy wers trwa
// do następnego (ostatni +4s). Obsługuje wiele znaczników w jednej linii.
function lrcToSrt(lrc) {
    const lines = [];
    for (const raw of String(lrc).split(/\r?\n/)) {
        const tags = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
        if (!tags.length) continue;
        const text = raw.replace(/\[[^\]]*\]/g, '').trim();
        if (!text) continue;
        for (const m of tags) {
            const frac = m[3] ? Number((m[3] + '000').slice(0, 3)) : 0;
            lines.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac / 1000, text });
        }
    }
    lines.sort((a, b) => a.t - b.t);
    if (!lines.length) return '';
    const fmt = (s) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.round((s % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };
    return lines.map((l, i) => {
        const end = lines[i + 1] ? lines[i + 1].t : l.t + 4;
        return `${i + 1}\n${fmt(l.t)} --> ${fmt(end)}\n${l.text}\n`;
    }).join('\n');
}

app.post('/api/teledysk/render', async (req, res) => {
    let { audioFile, sourceDir, vectors, sonicFile, fps, maxCuts, lrcFile } = req.body ?? {};
    fps = Number(fps) > 0 ? Number(fps) : 30;
    // 120 cięć = więcej różnorodności zanim montaż zacznie się zapętlać na pełną długość utworu
    maxCuts = Number(maxCuts) > 0 ? Number(maxCuts) : 120;
    const inCwd = (p) => { const a = path.resolve(process.cwd(), String(p)); if (!a.startsWith(process.cwd())) throw new Error('ścieżka poza projektem'); return a; };
    const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v)$/i;
    let work = null;
    try {
        if (!audioFile)  return res.status(400).json({ success: false, message: '"audioFile" wymagany.' });
        if (!sourceDir)  return res.status(400).json({ success: false, message: '"sourceDir" wymagany.' });
        if (!Array.isArray(vectors) && sonicFile) {
            const parsed = JSON.parse(await fs.readFile(inCwd(sonicFile), 'utf8'));
            vectors = Array.isArray(parsed) ? parsed : (parsed.vectors || parsed.steps || []);
        }
        if (!Array.isArray(vectors) || vectors.length < 4)
            return res.status(400).json({ success: false, message: 'Wymagane "vectors" (>=4) lub "sonicFile".' });

        const audioAbs = inCwd(audioFile);
        if (!fsSync.existsSync(audioAbs)) return res.status(404).json({ success: false, message: `Audio nie istnieje: ${audioFile}` });
        const srcAbs = inCwd(sourceDir);
        // REKURENCJA: bierze wideo także z PODKATALOGÓW (Suweren trzyma materiały
        // w folderach, bo pliki nazywają się tak samo 1-33). Pełne ścieżki, więc
        // kolizje nazw nie szkodzą. Pomijamy folder edit/ — tam lądują nasze rendery
        // (bez tego kolejny render zassałby własny poprzedni teledysk = pętla).
        const allEntries = await fs.readdir(srcAbs, { recursive: true });
        let clips = allEntries
            .filter(f => VIDEO_EXT.test(f) && !/(^|[\\/])edit([\\/]|$)/i.test(f))
            .map(f => path.join(srcAbs, f));
        // Kontrola materiałów: jawna lista (clips[]) albo filtr nazwy (clipFilter).
        const clipList = req.body?.clips, clipFilter = req.body?.clipFilter;
        if (Array.isArray(clipList) && clipList.length)
            clips = clips.filter(p => clipList.some(n => path.basename(p) === n || p.endsWith(n)));
        else if (typeof clipFilter === 'string' && clipFilter)
            clips = clips.filter(p => path.basename(p).toLowerCase().includes(clipFilter.toLowerCase()));
        if (!clips.length) return res.status(400).json({ success: false, message: `Brak źródeł wideo (po filtrze) w ${sourceDir} ani w podkatalogach.` });

        // 🎲 TASOWANIE — bez tego montaż brał zawsze PIERWSZE N klipów (alfabetycznie
        // top-level + wczesne foldery), nigdy nie sięgając dalszych (np. The_Celestial_Bridge_).
        // Teraz każdy render losuje z CAŁEJ biblioteki (832 klipy) — inny za każdym razem.
        for (let i = clips.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [clips[i], clips[j]] = [clips[j], clips[i]]; }

        // KLUCZOWE: realna długość audio z ffprobe. Wektory soniczne NIE mają pola
        // czasu (tylko s,b,v,h) i są próbkowane co ~sekundy podczas odtwarzania —
        // 204 próbki to CAŁY 7-min utwór, nie 6.8s (i/fps). Rozkładamy je na audioDur,
        // inaczej montaż ściska się do kilku sekund i zapętla te same klipy.
        let audioDur = 0;
        try {
            const { stdout } = await execFileAsync(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioAbs]);
            audioDur = parseFloat(String(stdout).trim()) || 0;
        } catch { /* brak ffprobe — spadamy na oś wektorów */ }
        const N = vectors.length;
        const hasRealT = vectors[0] && vectors[0].t !== undefined;
        const timeAt = (i) => hasRealT ? Number(vectors[i].t) : (audioDur > 0 ? (i / Math.max(1, N - 1)) * audioDur : i / fps);
        const endTime = audioDur > 0 ? audioDur : (hasRealT ? Number(vectors[N - 1].t) : N / fps);

        // Cięcia na uderzenia basu (czasy z realnej osi audio)
        const bass = vectors.map(v => Number(v.b ?? v.bass ?? 0));
        const mean = bass.reduce((a, b) => a + b, 0) / bass.length;
        const std  = Math.sqrt(bass.reduce((a, b) => a + (b - mean) ** 2, 0) / bass.length);
        const thr  = mean + 0.5 * std;
        const cuts = [];
        for (let i = 1; i < bass.length - 1; i++)
            if (bass[i] > thr && bass[i] >= bass[i - 1] && bass[i] > bass[i + 1])
                cuts.push({ t: timeAt(i), v: Number(vectors[i].v ?? vectors[i].vocals ?? 0), h: Number(vectors[i].h ?? vectors[i].highs ?? 0) });
        if (cuts.length < 2) return res.status(400).json({ success: false, message: 'Za mało uderzeń do montażu.' });

        // Segmenty na uderzenia basu, ale DŁUGIE odstępy dzielimy na ~3s podsegmenty —
        // każdy dostaje NOWY klip. Bez tego 37 uderzeń = tylko 37 klipów; teraz np. 7-min
        // utwór daje ~140 segmentów = ~140 różnych klipów z biblioteki + żywszy montaż.
        const MAX_SEG = 3.0, MAX_TOTAL = 180;
        const rawCuts = cuts.slice(0, maxCuts);
        const segs = [];
        for (let idx = 0; idx < rawCuts.length && segs.length < MAX_TOTAL; idx++) {
            const c = rawCuts[idx];
            const from = c.t, to = rawCuts[idx + 1] ? rawCuts[idx + 1].t : endTime;
            const span = Math.max(0.25, to - from);
            const fx = c.v > 0.6 ? 'punch-zoom' : c.h > 0.6 ? 'flash-cut' : 'soft-fade';
            const nSub = Math.max(1, Math.round(span / MAX_SEG));
            const subDur = span / nSub;
            for (let k = 0; k < nSub && segs.length < MAX_TOTAL; k++)
                segs.push({ from: from + k * subDur, to: from + (k + 1) * subDur, fx });
        }

        work = path.join(TEMP_DIR, `teledysk_${Date.now()}`);
        await fs.mkdir(work, { recursive: true });
        const parts = [];
        for (let i = 0; i < segs.length; i++) {
            // Cap 5s — by ostatni segment nie rozciągnął się do końca utworu.
            const dur = Math.min(5, Math.max(0.25, +(segs[i].to - segs[i].from).toFixed(3)));
            const src = clips[i % clips.length];
            const out = path.join(work, `seg_${String(i).padStart(3, '0')}.mp4`);
            const vf = ['scale=1280:720:force_original_aspect_ratio=increase', 'crop=1280:720', `fps=${fps}`];
            if (segs[i].fx === 'punch-zoom') vf[0] = 'scale=1408:792:force_original_aspect_ratio=increase';
            else if (segs[i].fx === 'flash-cut') vf.push('eq=brightness=0.06:saturation=1.3');
            else vf.push('fade=t=in:st=0:d=0.12');
            try {
                // Per-segment guard: uszkodzony klip (np. brak moov atom) NIE wywala renderu.
                await execFileAsync(ffmpegPath, ['-y', '-t', String(dur), '-i', src, '-an', '-vf', vf.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', out]);
                parts.push(out);
            } catch (segErr) {
                console.warn(`[Teledysk] ⚠️ segment ${i} pominięty (źródło uszkodzone?): ${path.basename(src)}`);
            }
        }
        if (!parts.length)
            return res.status(422).json({ success: false, message: 'Żaden segment się nie wyrenderował — źródła wideo mogą być uszkodzone.' });

        const listFile = path.join(work, 'list.txt');
        await fs.writeFile(listFile, parts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
        const editDir = path.join(srcAbs, 'edit');
        await fs.mkdir(editDir, { recursive: true });
        // Unikalna nazwa — każdy render zostaje, nic się nie nadpisuje.
        const audioSlug = path.basename(audioFile).replace(/\.[^.]+$/, '')
            .toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'utwor';
        const teledysk = path.join(editDir, `teledysk_${audioSlug}_${Date.now()}.mp4`);

        // 🔤 Napisy z LRC (opcjonalnie) — wypalane na dole obrazu. SRT ląduje w work/,
        // a ffmpeg odpalamy z cwd=work i referencją po nazwie — omija piekło escapowania
        // ścieżek Windows w filtrze subtitles (dwukropki dysku, backslashe).
        let subFilter = null, ffOpts = { timeout: 0, maxBuffer: 1024 * 1024 * 500 };
        if (lrcFile) {
            const lrcAbs = inCwd(lrcFile);
            if (fsSync.existsSync(lrcAbs)) {
                const srt = lrcToSrt(await fs.readFile(lrcAbs, 'utf8'));
                if (srt) {
                    await fs.writeFile(path.join(work, 'napisy.srt'), srt, 'utf8');
                    // Alignment=2 = dół-środek, BorderStyle=3 = półprzezroczyste tło, MarginV=40 = odstęp od dołu
                    subFilter = "subtitles=napisy.srt:force_style='FontName=Arial,FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&HA0000000,BorderStyle=3,Alignment=2,MarginV=40'";
                    ffOpts = { ...ffOpts, cwd: work };
                }
            }
        }

        // -stream_loop -1 zapętla montaż, a -shortest ucina na końcu audio → teledysk
        // ZAWSZE ma długość utworu (7:16 zamiast 14s), niezależnie od ilości materiału.
        // genpts + avoid_negative_ts — czysta baza czasu przy zapętleniu (anti-glitch).
        const ffArgs = ['-y', '-fflags', '+genpts', '-stream_loop', '-1',
            '-f', 'concat', '-safe', '0', '-i', listFile, '-i', audioAbs,
            '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-avoid_negative_ts', 'make_zero'];
        if (subFilter) ffArgs.push('-vf', subFilter);
        ffArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', teledysk);
        await execFileAsync(ffmpegPath, ffArgs, ffOpts);

        const wzgledna = path.relative(process.cwd(), teledysk);
        // Plik realnie lezy na dysku — to jest TRWALOSC z punktu 3.
        const oddech = await oddechZaPrace('render.wideo', `render:${wzgledna}`,
            { nazwa: path.basename(teledysk), sciezka: wzgledna });
        return res.json({ success: true, output: wzgledna, segments: segs.length, clipsUsed: clips.length, beats: cuts.length, subtitles: !!subFilter, oddech });
    } catch (err) {
        console.error(`[Teledysk] ❌ ${err.message}`);
        return res.status(500).json({ success: false, message: err.message });
    } finally {
        if (work) { try { await fs.rm(work, { recursive: true, force: true }); } catch {} }
    }
});

/**
 * POST /api/video/edit  (VideO-Use — orkiestrator montażu)
 * Body: { sourceDir, mission?, subtitleStyle?, audioFadeMs? }
 * Skanuje folder ze źródłami, sprawdza ffmpeg (wbudowany) i zwraca PLAN montażu
 * (EDL). Pełne cięcie słów-wypełniaczy wymaga skilla video-use + klucza
 * ElevenLabs Scribe — tu most przygotowuje plan i potwierdza drożność rur.
 */
app.post('/api/video/edit', async (req, res) => {
    const { sourceDir, mission, subtitleStyle, audioFadeMs } = req.body ?? {};
    const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v)$/i;
    try {
        // Drożność rur: ffmpeg wbudowany (ffmpeg-static)
        let ffmpegOk = false, ffmpegVer = '';
        try {
            const { stdout, stderr } = await execFileAsync(ffmpegPath, ['-version']);
            ffmpegVer = (stdout || stderr || '').split('\n')[0] || '';
            ffmpegOk = /ffmpeg version/i.test(ffmpegVer);
        } catch { ffmpegOk = false; }

        // Skan źródeł (bez wychodzenia poza projekt)
        let sources = [];
        if (sourceDir) {
            const abs = path.resolve(process.cwd(), String(sourceDir));
            if (!abs.startsWith(process.cwd())) {
                return res.status(403).json({ success: false, message: 'Bezpieczeństwo: sourceDir poza projektem.' });
            }
            try {
                const entries = await fs.readdir(abs, { withFileTypes: true });
                for (const e of entries) {
                    if (e.isFile() && VIDEO_EXT.test(e.name)) {
                        const st = await fs.stat(path.join(abs, e.name));
                        sources.push({ name: e.name, sizeMB: +(st.size / 1048576).toFixed(1) });
                    }
                }
            } catch { /* katalog nie istnieje — sources puste */ }
        }

        const fade = Number(audioFadeMs) > 0 ? Number(audioFadeMs) : 30;
        const subs = subtitleStyle || '2-word UPPERCASE';
        const plan = [
            `1. Transkrypcja (ElevenLabs Scribe) → takes_packed.md z word-level timestamps`,
            `2. LLM (lokalny/most) wyznacza cięcia: usuń „yyy/eee", false-starts, ciszę`,
            `3. ffmpeg: cięcia + ${fade}ms audio-fade na każdym łączeniu (anti-pop)`,
            `4. Napisy w stylu: ${subs}`,
            `5. Self-eval pętla (max 3) → render edit/final.mp4`,
        ];

        return res.json({
            success: true,
            ffmpeg: { available: ffmpegOk, version: ffmpegVer },
            mission: mission || '(brak — opisz montaż)',
            sourceDir: sourceDir || null,
            sources,
            sourceCount: sources.length,
            plan,
            note: ffmpegOk
                ? (sources.length
                    ? `Rury drożne. ${sources.length} źródeł gotowych. Pełne cięcie wymaga skilla video-use + klucza ElevenLabs.`
                    : `Rury drożne (ffmpeg OK), ale brak plików wideo w „${sourceDir || '—'}". Wrzuć surowy materiał.`)
                : `⚠ ffmpeg niedostępny — sprawdź instalację ffmpeg-static.`,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── 🫀 PULS MASZYNY — żywe tętno sprzętu (skórka PULS w Orbicie) ─────────────
// RAM/CPU z os, VRAM+temperatura z nvidia-smi (cichy brak gdy karta bez CUDA).
app.get('/api/system/pulse', async (req, res) => {
    const totalMB = Math.round(os.totalmem() / 1048576);
    const freeMB  = Math.round(os.freemem() / 1048576);
    const cpus    = os.cpus();
    // Chwilowe obciążenie CPU: średnia (busy/total) od startu — wystarcza do wizualizacji trendu
    const cpuPct  = Math.round(cpus.reduce((acc, c) => {
        const t = Object.values(c.times).reduce((a, b) => a + b, 0);
        return acc + (1 - c.times.idle / t);
    }, 0) / cpus.length * 100);

    let gpu = null;
    try {
        const { stdout } = await execFileAsync('nvidia-smi',
            ['--query-gpu=memory.used,memory.total,temperature.gpu,utilization.gpu', '--format=csv,noheader,nounits'],
            { timeout: 3000 });
        const [used, total, temp, util] = stdout.trim().split(',').map(v => parseInt(v.trim(), 10));
        if (Number.isFinite(used)) gpu = { vramUsedMB: used, vramTotalMB: total, tempC: temp, utilPct: util };
    } catch { /* brak nvidia-smi / karta nie-NVIDIA — pole gpu zostaje null */ }

    res.json({
        success: true,
        ram: { usedMB: totalMB - freeMB, totalMB, pct: Math.round((totalMB - freeMB) / totalMB * 100) },
        cpu: { pct: cpuPct, cores: cpus.length },
        gpu,
        uptimeSec: Math.round(os.uptime()),
        at: Date.now(),
    });
});

// ── 📢 WIEŻA PARTNERÓW — reklamy firm na prawym panelu Orbity ────────────────
// Suwerenny rejestr: _OtakOs_Wymiar/ads.local.json. Zamówienia wpadają jako
// "pending" (z otakos.wtf/formularza), Suweren aktywuje po opłacie
// (POST /api/ads/activate — most słucha tylko na 127.0.0.1, więc aktywacja
// jest z natury lokalna = tylko Ty).
const ADS_FILE = path.join(process.cwd(), '_OtakOs_Wymiar', 'ads.local.json');
async function readAds() {
    try { return JSON.parse(await fs.readFile(ADS_FILE, 'utf8')); } catch { return []; }
}
async function writeAds(ads) {
    await fs.mkdir(path.dirname(ADS_FILE), { recursive: true });
    await fs.writeFile(ADS_FILE, JSON.stringify(ads, null, 2), 'utf8');
}

app.get('/api/ads', async (req, res) => {
    const all = await readAds();
    const now = Date.now();
    const active = all.filter(a => a.status === 'active' && (!a.paidUntil || a.paidUntil > now));
    res.json({ success: true, ads: active, pendingCount: all.filter(a => a.status === 'pending').length });
});

app.post('/api/ads/order', async (req, res) => {
    const { company, slogan, url, email, tier = 'standard' } = req.body ?? {};
    if (!company || !slogan) return res.status(400).json({ success: false, message: 'Wymagane: "company" i "slogan".' });
    const ads = await readAds();
    const order = {
        id: `AD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        company: String(company).slice(0, 60),
        slogan:  String(slogan).slice(0, 120),
        url:     url ? String(url).slice(0, 200) : null,
        email:   email ? String(email).slice(0, 120) : null,
        tier, status: 'pending', paidUntil: null, createdAt: Date.now(),
    };
    ads.push(order);
    await writeAds(ads);
    console.log(`[Wieża Partnerów] 📢 Nowe zamówienie: ${order.company} (${order.id})`);
    return res.json({ success: true, orderId: order.id, message: 'Zamówienie przyjęte — slot aktywuje się po opłacie.' });
});

app.post('/api/ads/activate', async (req, res) => {
    const { id, days = 30 } = req.body ?? {};
    const ads = await readAds();
    const ad = ads.find(a => a.id === id);
    if (!ad) return res.status(404).json({ success: false, message: `Brak zamówienia ${id}.` });
    ad.status = 'active';
    ad.paidUntil = Date.now() + Number(days) * 86400000;
    await writeAds(ads);
    console.log(`[Wieża Partnerów] ✅ Aktywowano: ${ad.company} do ${new Date(ad.paidUntil).toISOString().slice(0, 10)}`);
    return res.json({ success: true, ad });
});

// ── 🏛️ AUTOMAT KATEDR — lokalny rejestr + "drukarka" co 10 min ───────────────
// Suwerennie, bez backendu: most rejestruje WŁASNĄ Katedrę (+ sparowanych
// rówieśników), drukuje snapshot do _OtakOs_Wymiar/cathedrals.local.json co
// 10 min i wystawia go live na /api/cathedrals. Zero "liczb z dupy".
const CATHEDRAL_BOOT = Date.now();
function cathedralSelf() {
    return {
        id:        process.env.OTAKOS_NODE_ID   || String(process.env.COMPUTERNAME || 'katedra').toLowerCase(),
        name:      process.env.OTAKOS_NODE_NAME || process.env.COMPUTERNAME || 'KATEDRA-0',
        dimension: '0.00G',
        bootAt:    CATHEDRAL_BOOT,
        uptimeSec: Math.round((Date.now() - CATHEDRAL_BOOT) / 1000),
    };
}
let cathedralSnapshot = { self: cathedralSelf(), peers: [], collectedAt: Date.now() };
async function printCathedrals() {
    cathedralSnapshot = { self: cathedralSelf(), peers: cathedralSnapshot.peers || [], collectedAt: Date.now() };
    try {
        await fs.writeFile(path.join(ANTIGRAVITY_DIR, 'cathedrals.local.json'),
            JSON.stringify(cathedralSnapshot, null, 2), 'utf8');
        console.log(`[Automat-Katedr] 🖨️  Wydrukowano rejestr (${1 + cathedralSnapshot.peers.length} katedr).`);
    } catch (e) { /* katalog niedostępny — pomijamy cicho */ }
}
printCathedrals();
setInterval(printCathedrals, 10 * 60 * 1000);

app.get('/api/cathedrals', (req, res) => {
    res.json({ success: true, self: cathedralSelf(), peers: cathedralSnapshot.peers,
               count: 1 + cathedralSnapshot.peers.length, collectedAt: cathedralSnapshot.collectedAt });
});

/**
 * POST /api/cathedrals/peer — dodaj zaufanego rówieśnika do rejestru (parowanie p2p).
 * Body: { id, name?, url? }
 */
app.post('/api/cathedrals/peer', async (req, res) => {
    const { id, name, url } = req.body ?? {};
    if (!id) return res.status(400).json({ success: false, message: 'Brak id rówieśnika.' });
    const peers = cathedralSnapshot.peers.filter(p => p.id !== id);
    peers.push({ id, name: name || id, url: url || null, pairedAt: Date.now() });
    cathedralSnapshot.peers = peers;
    await printCathedrals();
    return res.json({ success: true, count: 1 + peers.length });
});

/**
 * GET /api/agi/state — żywy stan lokalnej sieci neuronowej (dla mapy AGI na
 * otakos.wtf). Rdzeń realny (Ollama ping, kolejka Mechanika), reszta gotowość.
 * Mapuje na id węzłów z agi.local.ts: ollama/bridge/mechanik/koom/podcast/
 * scout/kronos/video/ted/music/shield/vault/quantum.
 */
app.get('/api/agi/state', async (req, res) => {
    const nodes = {};
    const set = (id, status, load = 0) => { nodes[id] = { status, load: Math.max(0, Math.min(1, load)) }; };

    // BRIDGE — skoro odpowiada, żyje.
    set('bridge', 'online', 0.4);

    // OLLAMA — szybki ping (timeout 1.2s).
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1200);
        const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: ctrl.signal });
        clearTimeout(t);
        const data = r.ok ? await r.json().catch(() => ({})) : {};
        const loaded = Array.isArray(data.models) ? data.models.length : 0;
        set('ollama', r.ok ? 'online' : 'offline', r.ok ? Math.min(1, 0.3 + loaded * 0.1) : 0);
    } catch { set('ollama', 'offline', 0); }

    // MECHANIK — głębokość kolejki = obciążenie.
    try {
        const q = await MechanicService.getInstance().getQueue();
        const pending = Array.isArray(q) ? q.filter(t => t && t.status !== 'DONE' && t.status !== 'REJECTED').length : 0;
        set('mechanik', pending > 0 ? 'online' : 'idle', Math.min(1, pending / 5));
    } catch { set('mechanik', 'idle', 0); }

    // SHIELD — Tarcza zawsze czuwa (singleton dostępny).
    set('shield', 'online', 0.5);

    // Reszta węzłów — gotowość (idle), lekki oddech z czasu.
    const breath = (Math.sin(Date.now() / 2500) + 1) / 2 * 0.4 + 0.1;
    ['koom', 'podcast', 'scout', 'kronos', 'video', 'ted', 'music', 'vault', 'quantum']
        .forEach(id => set(id, 'idle', +breath.toFixed(2)));

    return res.json({ success: true, origin: 'local', dimension: '0.00G', ts: Date.now(), nodes });
});

/**
 * POST /api/kronos/forecast
 * Body: { symbol, lastPrice, history?:number[], predLen? }
 * Lokalna projekcja świec K-line (Nasiono Rynkowe) — zero chmury.
 */
app.post('/api/kronos/forecast', (req, res) => {
    const { symbol, lastPrice, history, predLen } = req.body ?? {};
    if (!(Number(lastPrice) > 0)) {
        return res.status(400).json({ success: false, message: 'Wymagane "lastPrice" (> 0).' });
    }
    try {
        const out = kronosForecast({ symbol, lastPrice: Number(lastPrice), history, predLen: Number(predLen) || 24 });
        return res.json({ success: true, ...out });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── 📰 TUNEL WIADOMOŚCI RYNKOWYCH ────────────────────────────────────────────
// Rynek reaguje emocjonalnie, więc nastrój prasy jest realnym sygnałem — inaczej
// niż wróżenie ze świec. Tu zbieramy FAKTY (nagłówki), a interpretację zostawiamy
// osobnemu wywołaniu, jawnie oznaczonemu jako opinia modelu.

/**
 * GET /api/rynek/wiadomosci?limit=40&rodzaj=krypto|makro&odswiez=1
 * Zwraca nagłówki + RAPORT ŹRÓDEŁ (które kanały odpowiedziały, a które padły).
 */
app.get('/api/rynek/wiadomosci', async (req, res) => {
    try {
        const out = await zbierzWiadomosci({
            limit:   Number(req.query.limit) || 40,
            rodzaj:  req.query.rodzaj === 'krypto' || req.query.rodzaj === 'makro' ? req.query.rodzaj : undefined,
            odswiez: req.query.odswiez === '1' || req.query.odswiez === 'true',
        });
        const padle = out.raport.filter(r => !r.ok);
        if (padle.length) console.warn(`[Rynek] ⚠️ Kanały bez odpowiedzi: ${padle.map(p => `${p.nazwa} (${p.blad})`).join(', ')}`);
        return res.json({ success: true, ...out, zrodelLacznie: RYNEK_SOURCES.length });
    } catch (err) {
        console.error('[Rynek] ❌ wiadomosci:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/rynek/nastroj  Body: { rodzaj?, maks? }
 * Lokalny model streszcza NASTRÓJ PRASY. To opinia modelu o tonie nagłówków —
 * nie prognoza i nie porada. Odpowiedź niesie to oznaczenie, żeby żaden konsument
 * API nie mógł wziąć jej za sygnał inwestycyjny.
 */
app.post('/api/rynek/nastroj', async (req, res) => {
    try {
        const { rodzaj, maks } = req.body ?? {};
        const dane = await zbierzWiadomosci({ limit: 60, rodzaj: rodzaj === 'krypto' || rodzaj === 'makro' ? rodzaj : undefined });
        if (!dane.items.length) {
            return res.status(503).json({ success: false, message: 'Żaden kanał nie odpowiedział — brak nagłówków do streszczenia.', raport: dane.raport });
        }
        const uzyte = Math.max(5, Math.min(40, Number(maks) || 25));
        const streszczenie = await genOllama(promptNastroju(dane.items, uzyte), DEFAULT_LLM, 120000);
        if (!streszczenie) {
            return res.status(503).json({
                success: false,
                message: `Rdzeń "${DEFAULT_LLM}" nie odpowiedział — nagłówki są, brakuje streszczenia. Sprawdź: ollama ps`,
                items: dane.items.slice(0, uzyte), raport: dane.raport,
            });
        }
        return res.json({
            success: true,
            streszczenie,
            model: DEFAULT_LLM,
            naglowkowUzytych: uzyte,
            items: dane.items.slice(0, uzyte),
            raport: dane.raport,
            pobranoO: dane.pobranoO,
            // ⚠️ Jawne oznaczenie w samej odpowiedzi — nie tylko w UI.
            charakter: 'OPINIA MODELU O TONIE PRASY',
            disclaimer: 'Streszczenie nastroju medialnego wygenerowane lokalnie. Nie jest prognozą ' +
                        'ani poradą inwestycyjną i nie powinno być podstawą decyzji finansowych.',
        });
    } catch (err) {
        console.error('[Rynek] ❌ nastroj:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/rynek/sektory?odswiez=1
 * Macierz korelacji z realnych notowań — co faktycznie porusza się razem.
 */
app.get('/api/rynek/sektory', async (req, res) => {
    try {
        const mapa = await zbudujMape({ odswiez: req.query.odswiez === '1' || req.query.odswiez === 'true' });
        if (mapa.pominiete?.length) {
            console.warn(`[Rynek] ⚠️ Mapa sektorów — pominięte aktywa: ${mapa.pominiete.map(p => `${p.id} (${p.powod})`).join(', ')}`);
        }
        return res.json({ success: true, ...mapa });
    } catch (err) {
        console.error('[Rynek] ❌ sektory:', err.message);
        return res.status(502).json({ success: false, message: `Źródło notowań nieosiągalne: ${err.message}` });
    }
});

// ── 📓 DZIENNIK DECYZJI ──────────────────────────────────────────────────────
// Jedyne narzędzie z całego arsenału finansowego, które realnie poprawia wyniki:
// zapisuje CO i DLACZEGO, zanim znany jest wynik. Nic tu nie doradza.

app.get('/api/rynek/dziennik', async (req, res) => {
    try {
        return res.json({ success: true, wpisy: await dziennikLista(ANTIGRAVITY_DIR) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/rynek/dziennik', async (req, res) => {
    try {
        const wpis = await dziennikDodaj(ANTIGRAVITY_DIR, req.body ?? {});
        console.log(`[Dziennik] 📓 ${wpis.kierunek} ${wpis.aktywo} (pewność ${wpis.pewnosc}/5) — ${wpis.id}`);
        return res.json({ success: true, wpis });
    } catch (err) {
        // 400, nie 500 — to walidacja treści, nie awaria serwera.
        return res.status(400).json({ success: false, message: err.message });
    }
});

app.post('/api/rynek/dziennik/:id/wynik', async (req, res) => {
    try {
        const wpis = await dziennikDomknij(ANTIGRAVITY_DIR, req.params.id, req.body ?? {});
        return res.json({ success: true, wpis });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

app.get('/api/rynek/dziennik/podsumowanie', async (req, res) => {
    try {
        return res.json({ success: true, ...(await dziennikPodsumowanie(ANTIGRAVITY_DIR)) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
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
 * Body: { title: string, album?: string, platforms: string[], filePath?: string }
 *
 * Dodaje nowe zlecenie publikacji do kolejki.
 * Opcjonalne pole `filePath` wskazuje plik .mp4/.wav na dysku lokalnym
 * (używane przez uploadVideoToYouTube przy realnym deploymencie).
 */
app.post('/api/impresario/enqueue', async (req, res) => {
    const { title, album, platforms, filePath = null } = req.body ?? {};

    if (!title || !platforms) {
        return res.status(400).json({
            success: false,
            message: 'Wymagane pola: title i platforms (tablica).',
        });
    }

    try {
        const job = await ImpresarioService.getInstance().enqueuePublication(title, album, platforms, filePath);
        return res.status(201).json({
            success:  true,
            job,
            message:  `Zlecenie "${title}" przyjęte do Katedry.`,
            hasFile:  Boolean(job.filePath),
        });
    } catch (err) {
        console.error('[Impresario-API] ❌ POST enqueue:', err.message);
        return res.status(400).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/impresario/upload/:id
 * Inicjuje realny upload zadania do YouTube.
 * Sprawdza media_secrets.json — jeśli tokeny brak → zadanie → FAILED z jasnym komunikatem.
 */
app.post('/api/impresario/upload/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Brak id zadania.' });

    try {
        // Pobierz zadanie z kolejki
        const queue = await ImpresarioService.getInstance().getQueue();
        const task  = queue.find(j => j.id === id);

        if (!task) {
            return res.status(404).json({ success: false, message: `Zadanie ${id} nie istnieje w kolejce.` });
        }
        if (!task.platforms.includes('youtube')) {
            return res.status(400).json({ success: false, message: `Zadanie ${id} nie jest przeznaczone na YouTube.` });
        }

        const result = await ImpresarioService.getInstance().uploadVideoToYouTube(task);
        const status = result.success ? 200 : 422;
        return res.status(status).json(result);

    } catch (err) {
        console.error('[Impresario-API] ❌ POST upload:', err.message);
        return res.status(500).json({ success: false, message: err.message });
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

/**
 * POST /api/impresario/export/spotify/:id
 * Ręcznie wyzwól eksport paczki DistroKid dla konkretnego zadania.
 * Zadanie musi istnieć w kolejce i mieć status PENDING lub PROCESSING.
 */
app.post('/api/impresario/export/spotify/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Brak id zadania.' });

    try {
        const queue = await ImpresarioService.getInstance().getQueue();
        const task  = queue.find(j => j.id === id);

        if (!task) {
            return res.status(404).json({ success: false, message: `Zadanie ${id} nie istnieje w kolejce.` });
        }
        if (task.status === 'COMPLETE') {
            return res.status(409).json({ success: false, message: `Zadanie ${id} już zostało ukończone.` });
        }

        // Uruchom eksport (może trwać chwilę — odpowiedź po zakończeniu)
        const result = await ImpresarioService.getInstance().exportSpotifyPaczkowy(task);
        return res.json({ success: true, id, ...result });

    } catch (err) {
        console.error('[Impresario-API] ❌ POST export/spotify:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  AUTH GOOGLE — Przyszłościowy OAuth2 + Ekosystem Gemini Agent
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/google
 * Punkt wejścia OAuth2. Na tym etapie zwraca JSON z informacjami i planowanym URL.
 * TODO: Po uzupełnieniu CLIENT_ID w media_secrets.json — przekieruj na ekran zgody Google.
 */
app.get('/api/auth/google', async (req, res) => {
    try {
        const secretsStatus = await ImpresarioService.getInstance().getYouTubeSecretsStatus();
        const clientId = secretsStatus.filled.includes('CLIENT_ID')
            ? '(skonfigurowany)'
            : '(brak — uzupełnij media_secrets.json)';

        const authUrl = secretsStatus.filled.includes('CLIENT_ID')
            ? `https://accounts.google.com/o/oauth2/auth?` +
              `response_type=code&` +
              `scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload&` +
              `access_type=offline&prompt=consent`
            : null;

        return res.json({
            success:       true,
            status:        secretsStatus.allPresent ? 'READY' : 'NEEDS_CONFIGURATION',
            clientId,
            authUrl,
            secretsStatus,
            nextStep:      secretsStatus.allPresent
                ? 'Klucze gotowe. Użyj POST /api/auth/google/simulate lub zaimplementuj redirect.'
                : 'Uzupełnij CLIENT_ID, CLIENT_SECRET i REFRESH_TOKEN przez POST /api/impresario/secrets/youtube.',
            note:          'Pełny redirect OAuth2 zostanie aktywowany po skonfigurowaniu CLIENT_ID w Katedrze.',
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/impresario/secrets/youtube
 * Body: { clientId?: string, clientSecret?: string, refreshToken?: string }
 * Zapisuje klucze API YouTube do media_secrets.json (atomowo) i łączy vault.
 */
app.post('/api/impresario/secrets/youtube', async (req, res) => {
    const { clientId, clientSecret, refreshToken } = req.body ?? {};

    if (!clientId && !clientSecret && !refreshToken) {
        return res.status(400).json({
            success: false,
            message: 'Wymagane przynajmniej jedno pole: clientId, clientSecret lub refreshToken.',
        });
    }

    try {
        const result = await ImpresarioService.getInstance().saveYouTubeSecrets(
            clientId, clientSecret, refreshToken
        );

        // Automatycznie połącz vault jeśli wszystkie klucze uzupełnione
        if (result.missingFields.length === 0) {
            await ImpresarioService.getInstance().updateVaultMetadata('youtube', true, {
                api_key_hash: `sha256_${Date.now().toString(36)}`, // placeholder hash
            });
        }

        return res.json({
            success: true,
            message: result.missingFields.length === 0
                ? '✅ Wszystkie klucze YouTube zapisane! Konto połączone.'
                : `Klucze częściowo zapisane. Brakuje: ${result.missingFields.join(', ')}.`,
            ...result,
        });
    } catch (err) {
        console.error('[Impresario-API] ❌ POST secrets/youtube:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/auth/google/simulate
 * Symuluje autoryzację przez Ekosystem Gemini Agent.
 * Flagi vault: { connected: true, gemini_auth: true, auth_method: 'gemini_agent_ecosystem' }
 * TODO: Zastąpić rzeczywistym OAuth2 callback po uzyskaniu Gemini API access.
 */
app.post('/api/auth/google/simulate', async (req, res) => {
    try {
        const result = await ImpresarioService.getInstance().simulateGeminiAgentConnect();
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('[Impresario-API] ❌ POST auth/google/simulate:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  TOST MESSENGER — Szyfrowany Komunikator Katedry
// ════════════════════════════════════════════════════════════════════════════

const TOST_SYSTEM_INSTRUCTION =
    `Jesteś TeO – osobisty, cyfrowy schron Suwerena w sieci. ` +
    `Odpowiadasz krótko, konkretnie, w stylu militarno-cyberpunkowym. ` +
    `Zapewniasz bezpieczeństwo E2E i analizujesz przesłane dane pod kątem zagrożeń i śladów EXIF. ` +
    `Mów po polsku.`;

// Limit czasu na zimny start VRAM (Gemma4 przez Ollamę lokalnie)
// VRAM Breathing v2: 300s (5 min) — pełna swoboda alokacji na obciążonej maszynie.
const AI_TIMEOUT_MS = 300_000;

/**
 * GET /api/tost/messages
 * Zwraca historię wiadomości z lokalnego skarbca (odszyfrowaną).
 */
app.get('/api/tost/messages', async (req, res) => {
    try {
        const messages = await TostService.getInstance().getMessages();
        return res.json({ success: true, messages, count: messages.length });
    } catch (err) {
        console.error('[TOST-API] ❌ GET messages:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/tost/send
 * Body: { text?: string, imageBase64?: string, mimeType?: string }
 *
 * 1. Zapisuje wiadomość użytkownika w skarbcu
 * 2. Wysyła do Gemini z instrukcją systemu TeO
 * 3. Zapisuje odpowiedź AI w skarbcu
 * 4. Zwraca obie wiadomości
 */
app.post('/api/tost/send', async (req, res) => {
    const { text = '', imageBase64 = null } = req.body ?? {};

    if (!text.trim() && !imageBase64) {
        return res.status(400).json({ success: false, message: 'Wymagany tekst lub obraz.' });
    }

    try {
        const tost = TostService.getInstance();

        // 1. Zapisz wiadomość użytkownika
        const userMsg = await tost.addMessage('user', text.trim(), imageBase64);

        // 2. Buduj żądanie do lokalnej Ollamy (Gemma4)
        const promptText = text.trim() || 'Analizuj ten obraz pod kątem zagrożeń i śladów EXIF.';

        const ollamaBody = {
            model:   DEFAULT_LLM,
            system: TOST_SYSTEM_INSTRUCTION,
            prompt: promptText,
            stream: false,
        };

        // 3. Obsługa multimodalna — surowe base64 bez prefiksu data URL
        if (imageBase64) {
            const rawB64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
            ollamaBody.images = [rawB64];
        }

        // 4. Wyślij z limitem 120s (zimny start VRAM)
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        let aiText = '[BŁĄD TRANSMISJI] Agent TeO nie odpowiada. Spróbuj ponownie.';

        try {
            const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(ollamaBody),
                signal:  controller.signal,
            });
            clearTimeout(timeoutId);

            if (ollamaRes.ok) {
                const ollamaData = await ollamaRes.json();
                aiText = ollamaData.response?.trim() || aiText;
                console.log(`[TOST-API] ✅ Gemma4 odpowiedziała (${aiText.length} znaków)`);
            } else {
                const errBody = await ollamaRes.text();
                console.error(`[TOST-API] Ollama HTTP ${ollamaRes.status}:`, errBody.substring(0, 200));
                aiText = `[TRANSMISJA ZAKŁÓCONA] Ollama HTTP ${ollamaRes.status}. Sprawdź czy Gemma4 jest załadowana (ollama list).`;
            }
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            if (fetchErr.name === 'AbortError') {
                aiText = '[TIMEOUT 120s] Gemma4 nie odpowiedziała w limicie czasu. Sprawdź VRAM i spróbuj ponownie.';
            } else {
                aiText = `[OLLAMA OFFLINE] Nie można połączyć z lokalnym silnikiem: ${fetchErr.message}`;
            }
            console.error('[TOST-API] Ollama fetch error:', fetchErr.message);
        }

        // 5. Zapisz odpowiedź AI
        const aiMsg = await tost.addMessage('model', aiText, null);

        return res.json({ success: true, userMessage: userMsg, aiMessage: aiMsg });

    } catch (err) {
        console.error('[TOST-API] ❌ POST send:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/tost/messages
 * Czyści historię wiadomości ze skarbca.
 */
app.delete('/api/tost/messages', async (req, res) => {
    try {
        const result = await TostService.getInstance().clearMessages();
        return res.json({ success: true, ...result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════
//  PRALKA — Data Laundering & Scrubbing Service
// ══════════════════════════════════════════════════════════════════

/**
 * POST /api/laundry/sanitize
 * Body: { imageBase64?: string, text?: string }
 * Pierze obraz z EXIF/ICC/XMP i/lub tekst ze znaków zero-width.
 */
app.post('/api/laundry/sanitize', (req, res) => {
    const { imageBase64 = null, text = null } = req.body ?? {};

    if (!imageBase64 && text === null) {
        return res.status(400).json({ success: false, message: 'Brak danych do prania (imageBase64 lub text).' });
    }

    try {
        const laundry = LaundryService.getInstance();
        const result  = {};

        if (imageBase64) {
            const { cleanBase64, report } = laundry.sanitizeImage(imageBase64);
            result.cleanBase64 = cleanBase64;
            result.report      = report;
        }
        if (text !== null) {
            const { cleanText, removedChars } = laundry.sanitizeText(text);
            result.cleanText    = cleanText;
            result.removedChars = removedChars;
        }

        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('[PRALKA-API] ❌', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════
//  TOST P2P RELAY — Szmaragdowy Tunel (SSE Bridge)
//  Architektura: token → Set<SSE res> (RAM only, zero persistence)
// ══════════════════════════════════════════════════════════════════

const p2pSessions = new Map(); // Map<token, { clients: Set<res>, createdAt: number }>

// TTL 4h — sprzątaj wygasłe sesje co godzinę
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of p2pSessions) {
        if (now - session.createdAt > 4 * 60 * 60 * 1000) {
            session.clients.forEach(c => { try { c.end(); } catch { /* zamknięty */ } });
            p2pSessions.delete(token);
            console.log(`[TOST-P2P] 🧹 Token ${token} wygasł — sesja usunięta.`);
        }
    }
}, 60 * 60 * 1000);

/**
 * POST /api/tost/p2p/init — generuj unikalny token sesji P2P
 */
app.post('/api/tost/p2p/init', (req, res) => {
    const raw   = crypto.randomBytes(6).toString('hex');
    const token = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`.toUpperCase();
    p2pSessions.set(token, { clients: new Set(), createdAt: Date.now() });
    console.log(`[TOST-P2P] 🔑 Nowy token sesji: ${token}`);
    return res.json({ success: true, token });
});

/**
 * GET /api/tost/p2p/stream/:token — SSE strumień (Szmaragdowy Tunel)
 * Każdy klient co łączy się tym tokenem wchodzi do tej samej sesji.
 */
app.get('/api/tost/p2p/stream/:token', (req, res) => {
    const { token } = req.params;

    // Auto-utwórz sesję (peer dołącza przez token generatora)
    if (!p2pSessions.has(token)) {
        p2pSessions.set(token, { clients: new Set(), createdAt: Date.now() });
    }
    const session = p2pSessions.get(token);

    res.setHeader('Content-Type',                'text/event-stream');
    res.setHeader('Cache-Control',               'no-cache');
    res.setHeader('Connection',                  'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (res.flushHeaders) res.flushHeaders();

    session.clients.add(res);
    const peerCount = session.clients.size;
    console.log(`[TOST-P2P] 🔌 Nowy klient (${token}) · peerów: ${peerCount}`);

    // Powiadom wszystkich o nowym rdeniu
    session.clients.forEach(client => {
        try { client.write(`data: ${JSON.stringify({ type: 'peer_joined', peerCount })}\n\n`); } catch { /* skip */ }
    });

    // Heartbeat co 30s (podtrzymaj HTTP/1.1 keep-alive)
    const heartbeat = setInterval(() => {
        try { res.write('data: {"type":"ping"}\n\n'); } catch { clearInterval(heartbeat); }
    }, 30_000);

    req.on('close', () => {
        clearInterval(heartbeat);
        session.clients.delete(res);
        const remaining = session.clients.size;
        console.log(`[TOST-P2P] 🔌 Klient odłączył się (${token}) · pozostało: ${remaining}`);
        session.clients.forEach(client => {
            try { client.write(`data: ${JSON.stringify({ type: 'peer_left', peerCount: remaining })}\n\n`); } catch { /* skip */ }
        });
    });
});

/**
 * POST /api/tost/p2p/message/:token — przekaż wiadomość do wszystkich w sesji
 * RAM only — nie dotyka TostService ani vault.
 */
app.post('/api/tost/p2p/message/:token', (req, res) => {
    const { token } = req.params;
    const session   = p2pSessions.get(token);
    if (!session) return res.status(404).json({ success: false, error: 'Token nieważny lub wygasł.' });

    const { text, imageBase64, timestamp, senderId } = req.body ?? {};
    const message = {
        type:        'message',
        id:          `p2p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        text:        text || '',
        imageBase64: imageBase64 || null,
        timestamp:   timestamp || new Date().toISOString(),
        senderId:    senderId || 'unknown',
        owner:       'remote',
    };

    // Broadcast do WSZYSTKICH (frontend filtruje własne wiadomości przez senderId)
    session.clients.forEach(client => {
        try { client.write(`data: ${JSON.stringify(message)}\n\n`); } catch { /* skip */ }
    });

    console.log(`[TOST-P2P] 📡 Wiadomość (${token}) · klientów: ${session.clients.size}`);
    return res.json({ success: true, id: message.id });
});

// ══════════════════════════════════════════════════════════════════════════════
//  🏛️ RADA DEKOMPOZYCJI — wieloagentowy potok operacyjny 0.00G
//  POST /api/agent/rada-decompose
//
//  Sekwencja:
//    1. W.I.D.O.K./Katedra wysyła temat
//    2. Gemma4 (Rada) dekomponuje na 2-4 pod-zadania z przydziałem agentów
//    3. Pod-zadania trafiają do kolejki MechanicService (sesja izolowana)
//    4. Główny wątek rozmowy pozostaje wolny (Session Isolation)
// ══════════════════════════════════════════════════════════════════════════════
// ── TURBOVEC SEARCH ──────────────────────────────────────────────────────────
app.get('/api/turbovec/search', async (req, res) => {
    const { q = '', k = '5' } = req.query;
    try {
        const results = await TurbovecService.getInstance().search(String(q), parseInt(k) || 5);
        return res.json({ success: true, results, status: TurbovecService.getInstance().getStatus() });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/turbovec/reindex', async (req, res) => {
    try {
        const result = await TurbovecService.getInstance().reindex();
        return res.json({ success: true, ...result });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/agent/rada-decompose', async (req, res) => {
    const {
        topic,
        context    = '',
        sessionId  = crypto.randomBytes(4).toString('hex'),
        temperature = 0.67,  // Stopień Rozwielmożnienia (znormalizowany 1-9 → /9)
    } = req.body;
    if (!topic) return res.status(400).json({ error: 'Brak topic' });
    // Clamp temperature do bezpiecznego zakresu Ollamy
    const temp = Math.max(0.05, Math.min(2.0, Number(temperature) || 0.67));

    console.log(`[Rada] 🏛️ Dekompozycja sesji ${sessionId}: "${topic.substring(0, 60)}..."`);

    const systemPrompt =
        'Jesteś RADĄ KATEDRY OTAKOS — centrum decyzyjnym systemu OtakOS. ' +
        'Twoje zadanie: zdekompozuj poniższe zadanie na 2-4 pod-zadania i przydziel je do agentów. ' +
        'Dostępni agenci: MECHANIK (naprawa kodu/błędów), IMPRESARIO (dystrybucja/media), ' +
        'TOST (bezpieczeństwo/szyfrowanie), KLAUDIUSZ (implementacja kodu/feature). ' +
        'Odpowiedz WYŁĄCZNIE w formacie JSON (bez markdown, bez wyjaśnień, bez niczego poza JSON): ' +
        '{"tasks":[{"id":"t1","title":"...","description":"...","agent":"mechanik|impresario|tost|klaudiusz","priority":"HIGH|CRITICAL|LOW"}]}';

    try {
        console.log(`[Rada] 🌡️ Temperatura Rozwielmożnienia: ${temp.toFixed(3)} (raw: ${temperature})`);
        const ollamaResp = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model:   DEFAULT_LLM,
                system:  systemPrompt,
                prompt:  `Temat: ${topic}\nKontekst: ${context || 'brak'}`,
                stream:  false,
                options: { temperature: temp },
            }),
        });

        if (!ollamaResp.ok) throw new Error(`Ollama HTTP ${ollamaResp.status}`);
        const ollamaData = await ollamaResp.json();

        let tasks = [];
        try {
            const jsonMatch = (ollamaData.response || '').match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : ollamaData.response);
            tasks = (parsed.tasks || []).map((t, i) => ({
                id:          t.id || `rad-${sessionId}-${i}`,
                title:       t.title       || 'Pod-zadanie Rady',
                description: t.description || topic.substring(0, 120),
                agent:       (t.agent || 'klaudiusz').toLowerCase(),
                priority:    t.priority    || 'HIGH',
                sessionId,
                status:      'PENDING',
                createdAt:   new Date().toISOString(),
            }));
        } catch {
            // Fallback: Rada nie zwróciła JSON → jedno zadanie ogólne
            tasks = [{
                id:          `rad-${sessionId}-0`,
                title:       topic.substring(0, 80),
                description: context || topic,
                agent:       'klaudiusz',
                priority:    'HIGH',
                sessionId,
                status:      'PENDING',
                createdAt:   new Date().toISOString(),
            }];
        }

        // ── TurbovecService: wzbogać opisy pod-zadań o kontekst plików źródłowych ──
        const turbovec = TurbovecService.getInstance();
        for (const task of tasks) {
            if (task.agent === 'mechanik' || task.agent === 'impresario' || task.agent === 'klaudiusz') {
                try {
                    task.description = await turbovec.enrichTaskDescription(task);
                } catch (tvErr) {
                    console.warn(`[Rada·Turbovec] ⚠️ Enrichment skipped (${task.id}): ${tvErr.message}`);
                }
            }
        }

        // ── Enqueue do MechanicService (Session Isolation: kolejka działa w tle) ──
        // ⚠️ NAPRAWIONE 2026-08-03. Dwa błędy siedziały jeden w drugim:
        //   1. Wywołanie NIE przekazywało `id`, a `enqueueTask` wymaga `id` ORAZ `title`.
        //      Każde wstrzyknięcie odpadało z „brak id lub title" — kolejka zostawała pusta.
        //   2. `enqueueTask` przy odrzuceniu ZWRACA null (nie rzuca), więc `catch` nigdy
        //      się nie odpalał, a kod bezwarunkowo meldował „N pod-zadań wstrzyknięto".
        //      W logach Suwerena: trzy ostrzeżenia z rzędu i zaraz pod nimi zielony ptaszek
        //      „3 pod-zadań wstrzyknięto" przy kolejce 0 PENDING. Melduje się to, co się
        //      wydarzyło, nie to, co miało się wydarzyć.
        // `id` jest przedrostkowane sesją, bo model potrafi zwrócić „t1" dla każdej sesji,
        // a deduplikacja po id po cichu zjadłaby kolejne zadania.
        const przyjete = [];
        const odrzucone = [];
        for (const task of tasks) {
            const idKolejki = `rada-${sessionId}-${task.id}`;
            try {
                const wynik = await MechanicService.getInstance().enqueueTask({
                    id:          idKolejki,
                    title:       `[RADA·${task.agent.toUpperCase()}] ${task.title}`,
                    description: task.description,
                    priority:    task.priority,
                    targetFiles: [],
                    sessionId,
                });
                if (wynik) przyjete.push(idKolejki);
                else odrzucone.push({ id: idKolejki, powod: 'odrzucone przez kolejkę (duplikat lub braki)' });
            } catch (enqErr) {
                odrzucone.push({ id: idKolejki, powod: enqErr.message });
                console.warn(`[Rada] ⚠️ Enqueue failed for ${idKolejki}: ${enqErr.message}`);
            }
        }

        if (odrzucone.length) {
            console.warn(`[Rada] ⚠️ Sesja ${sessionId}: przyjęto ${przyjete.length}/${tasks.length}. ` +
                         `Odrzucone: ${odrzucone.map(o => `${o.id} (${o.powod})`).join(', ')}`);
        } else {
            console.log(`[Rada] ✅ Sesja ${sessionId}: ${przyjete.length}/${tasks.length} pod-zadań w kolejce.`);
        }
        return res.json({
            success: true, sessionId, tasks,
            totalTasks: tasks.length,
            // Liczby mówią prawdę — konsument API nie musi wierzyć na słowo.
            wKolejce: przyjete.length,
            odrzucone,
        });

    } catch (e) {
        console.error(`[Rada] ❌ Błąd dekompozycji: ${e.message}`);
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🎬 KOLEJKA KREATYWNA — Tablica Produkcji (drugi tor, obok Mechanika)
//
//  DLACZEGO OSOBNO OD RADY WYŻEJ: tamta kolejka karmi Mechanika, który generuje
//  ŁATKI DO KODU. Zadanie „narysuj kartę postaci" trafiające do Mechanika kończy
//  się śmieciowym patchem — zmierzone 2026-08-03 na żywej kolejce.
//  Ten tor ma inny cykl życia: prompt → zewnętrzne narzędzie → zwrot → następny etap.
//
//  Most NIE wywołuje Gems/AI Studio/Flow — nie ma do nich API i nie udaje, że ma.
//  Robi to, co da się zrobić uczciwie: buduje prompt, pilnuje spójności (biblia
//  wraca do każdego kolejnego promptu) i pamięta stan. Rundę robi Suweren.
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/produkcja/tablica?projekt= — karty + rozkład po etapach + biblia. */
app.get('/api/produkcja/tablica', async (req, res) => {
    try {
        const projekt = String(req.query.projekt || '');
        const [kadry, statystykaTablicy, listaProjektow] = await Promise.all([
            produkcjaLista(ANTIGRAVITY_DIR, projekt),
            produkcjaStatystyka(ANTIGRAVITY_DIR, projekt),
            produkcjaProjekty(ANTIGRAVITY_DIR),
        ]);
        const bibliaProjektu = projekt ? await produkcjaBiblia(ANTIGRAVITY_DIR, projekt) : null;
        return res.json({
            success: true,
            etapy: PRODUKCJA_ETAPY,
            projekty: listaProjektow,
            kadry,
            statystyka: statystykaTablicy,
            biblia: bibliaProjektu,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/** POST /api/produkcja/kadr — ręczne dołożenie karty. */
app.post('/api/produkcja/kadr', async (req, res) => {
    try {
        const kadr = await produkcjaDodaj(ANTIGRAVITY_DIR, req.body ?? {});
        console.log(`[Produkcja] 🎬 Nowy kadr [${kadr.etap}] „${kadr.tytul}" (${kadr.projekt})`);
        const oddech = await oddechZaPrace('kadr.dodany', `kadr:${kadr.id}`);
        return res.json({ success: true, kadr, oddech });
    } catch (err) {
        // 400, nie 500 — to walidacja treści, nie awaria serwera.
        return res.status(400).json({ success: false, message: err.message });
    }
});

/** PATCH /api/produkcja/kadr/:id — zmiana etapu, zwrotu, notatek. */
app.patch('/api/produkcja/kadr/:id', async (req, res) => {
    try {
        const kadr = await produkcjaZmien(ANTIGRAVITY_DIR, req.params.id, req.body ?? {});
        // Klucz niesie DOCELOWY etap, więc każde przejście płaci raz, ale powrót
        // i ponowne przesunięcie na ten sam etap już nie — inaczej wystarczyłoby
        // wozić kartę tam i z powrotem.
        const oddech = req.body?.etap
            ? await oddechZaPrace('kadr.etap', `etap:${kadr.id}:${kadr.etap}`)
            : null;
        return res.json({ success: true, kadr, oddech });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

/** DELETE /api/produkcja/kadr/:id */
app.delete('/api/produkcja/kadr/:id', async (req, res) => {
    try {
        const kadr = await produkcjaUsun(ANTIGRAVITY_DIR, req.params.id);
        return res.json({ success: true, kadr });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/produkcja/kadr/:id/prompt
 * Gotowy do wklejenia prompt dla etapu, na którym stoi karta — z doklejoną biblią.
 * Odpowiedź niesie `ostrzezenie`, gdy biblii nie ma: lepiej, żeby Suweren
 * wiedział, że kadr idzie bez kotwicy, niż żeby odkrył to w ujęciu czterdziestym.
 */
app.get('/api/produkcja/kadr/:id/prompt', async (req, res) => {
    try {
        const wszystkie = await produkcjaLista(ANTIGRAVITY_DIR);
        const kadr = wszystkie.find(k => k.id === req.params.id);
        if (!kadr) return res.status(404).json({ success: false, message: `Kadr "${req.params.id}" nie istnieje.` });

        const bibliaProjektu = await produkcjaBiblia(ANTIGRAVITY_DIR, kadr.projekt);
        // Prompt płaci raz na kadr+etap: podgląd tego samego promptu w kółko
        // to nie jest nowa praca.
        const oddech = await oddechZaPrace('prompt.zbudowany', `prompt:${kadr.id}:${kadr.etap}`);
        return res.json({ success: true, kadr, oddech, ...produkcjaPrompt(kadr, bibliaProjektu) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/produkcja/rozloz  { zlecenie, projekt, temperatura? }
 * Rada Kreatywna rozkłada zlecenie na karty produkcyjne.
 *
 * Melduje `dodane` i `odrzucone` OSOBNO — dokładnie z tego powodu, dla którego
 * naprawialiśmy Radę od kodu: tamta pisała „3 wstrzyknięto" przy kolejce 0.
 */
/**
 * Wspólny rozkład Rady Kreatywnej — używa go i panel Tablicy, i Reżyser.
 * Jedna implementacja, bo dwie rozjechałyby się przy pierwszej poprawce promptu.
 * Rzuca `BladRozkladu` z surową odpowiedzią, gdy model nie utrzyma formatu.
 */
class BladRozkladu extends Error {
    constructor(message, surowaOdpowiedz) { super(message); this.surowaOdpowiedz = surowaOdpowiedz; }
}

async function radaKreatywnaRozloz(zlecenie, projekt, temperatura = 0.7, sesjaRady = null) {
    const temp = Math.max(0.05, Math.min(2.0, Number(temperatura) || 0.7));
    const nazwaProjektu = String(projekt || '').trim() || 'bez nazwy';

    // Kontekst dla modelu: co już stoi na tablicy tego projektu. Bez tego Rada
    // przy każdym wywołaniu proponuje od nowa „stwórz Style Sheet".
    const juzNaTablicy = await produkcjaLista(ANTIGRAVITY_DIR, nazwaProjektu);
    const kontekst = juzNaTablicy.length
        ? juzNaTablicy.slice(0, 12).map(k => `- [${k.etap}] ${k.tytul}`).join('\n')
        : 'tablica pusta — projekt startuje od zera';

    const odp = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: DEFAULT_LLM,
            system: promptSystemowyRozkladu(),
            prompt: `Projekt: ${nazwaProjektu}\nZlecenie: ${zlecenie}\n\nJuż na tablicy (NIE powtarzaj tego):\n${kontekst}`,
            stream: false,
            options: { temperature: temp },
        }),
    });
    if (!odp.ok) throw new Error(`Ollama HTTP ${odp.status}`);
    const dane = await odp.json();

    let propozycje;
    try {
        propozycje = odczytajRozklad(dane.response);
    } catch (parseErr) {
        // Uczciwie: mówimy, że model nie dał się odczytać, i pokazujemy początek
        // odpowiedzi. Cichy fallback na jedną kartę ukrywałby zepsuty rdzeń.
        console.warn(`[Produkcja] ⚠️ Rozkład nieczytelny (${DEFAULT_LLM}): ${parseErr.message}`);
        throw new BladRozkladu(
            `Rada Kreatywna nie zwróciła czytelnego rozkładu: ${parseErr.message}`,
            String(dane.response || '').slice(0, 400),
        );
    }

    const dodane = [];
    const odrzucone = [];
    for (const p of propozycje) {
        try {
            dodane.push(await produkcjaDodaj(ANTIGRAVITY_DIR, {
                ...p, projekt: nazwaProjektu, zrodlo: 'rada', sesjaRady: sesjaRady || null,
            }));
        } catch (e) {
            odrzucone.push({ tytul: p.tytul || '(bez tytułu)', powod: e.message });
        }
    }

    if (odrzucone.length) {
        console.warn(`[Produkcja] ⚠️ Dodano ${dodane.length}/${propozycje.length}. ` +
                     `Odrzucone: ${odrzucone.map(o => `${o.tytul} (${o.powod})`).join(', ')}`);
    } else {
        console.log(`[Produkcja] ✅ Rada Kreatywna: ${dodane.length} kart na tablicy „${nazwaProjektu}".`);
    }

    return { model: DEFAULT_LLM, zaproponowano: propozycje.length, dodane, odrzucone };
}

app.post('/api/produkcja/rozloz', async (req, res) => {
    const { zlecenie, projekt = '', temperatura = 0.7, sesjaRady = '' } = req.body ?? {};
    if (!zlecenie || String(zlecenie).trim().length < 5) {
        return res.status(400).json({ success: false, message: 'Brak zlecenia (min. 5 znaków).' });
    }
    console.log(`[Produkcja] 🏛️ Rada Kreatywna rozkłada: "${String(zlecenie).slice(0, 60)}..." (${projekt || 'bez nazwy'})`);
    try {
        return res.json({ success: true, ...(await radaKreatywnaRozloz(zlecenie, projekt, temperatura, sesjaRady)) });
    } catch (e) {
        if (e instanceof BladRozkladu) {
            return res.status(502).json({ success: false, message: e.message, model: DEFAULT_LLM, surowaOdpowiedz: e.surowaOdpowiedz });
        }
        console.error(`[Produkcja] ❌ Rozkład: ${e.message}`);
        return res.status(500).json({ success: false, message: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🎬 REŻYSER — Sfera z rękami, pamięcią i obsadą
//
//  Rozmówca opowiadał. Reżyser ROBI: jedno wywołanie modelu zwraca i mowę,
//  i ewentualną akcję, którą Most wykonuje od razu. Dwa wywołania (najpierw
//  odpowiedz, potem sklasyfikuj) trwałyby na tej maszynie ponad 40 s —
//  rozmowa przestałaby być rozmową.
//
//  Akcje wykonuje SERWER, nie przeglądarka: model może zaproponować tylko to,
//  co jest na białej liście, i nic poza nią nie zadziała.
// ══════════════════════════════════════════════════════════════════════════════

// ── Obsada ────────────────────────────────────────────────────────────────────
app.get('/api/rezyser/postacie', async (req, res) => {
    try {
        return res.json({ success: true, postacie: await listaPostaci(ANTIGRAVITY_DIR) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/** POST — `surowe` (wgranie: JSON / markdown / goły prompt) albo gotowe pola. */
app.post('/api/rezyser/postacie', async (req, res) => {
    try {
        const postac = await dodajPostac(ANTIGRAVITY_DIR, req.body ?? {});
        console.log(`[Reżyser] 🎭 Postać „${postac.imie}" (${postac.rola}, ${postac.pochodzenie}, format: ${postac.format}).`);
        return res.json({ success: true, postac });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

app.delete('/api/rezyser/postacie/:id', async (req, res) => {
    try {
        return res.json({ success: true, postac: await usunPostac(ANTIGRAVITY_DIR, req.params.id) });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

// ── Pamięć serialu ────────────────────────────────────────────────────────────
app.get('/api/rezyser/pamiec', async (req, res) => {
    try {
        const serial = String(req.query.serial || '');
        return res.json({
            success: true,
            pamiec: await rezyserPamiec(ANTIGRAVITY_DIR, serial),
            seriale: await listaSeriali(ANTIGRAVITY_DIR),
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/rezyser/pamiec/fakt', async (req, res) => {
    try {
        const { serial = '', tresc = '', zrodlo = 'suweren' } = req.body ?? {};
        const wynik = await dodajFakt(ANTIGRAVITY_DIR, serial, tresc, zrodlo);
        // Duplikat faktu NIE jest nowa praca — placi tylko swiezy wpis do kanonu.
        const oddech = wynik.duplikat ? null : await oddechZaPrace('fakt.kanon', `fakt:${wynik.fakt.id}`);
        return res.json({ success: true, ...wynik, oddech });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

app.delete('/api/rezyser/pamiec/fakt/:id', async (req, res) => {
    try {
        const fakt = await usunFakt(ANTIGRAVITY_DIR, String(req.query.serial || ''), req.params.id);
        return res.json({ success: true, fakt });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

app.post('/api/rezyser/pamiec/odcinek', async (req, res) => {
    try {
        const { serial = '', ...dane } = req.body ?? {};
        const odcinek = await dodajOdcinek(ANTIGRAVITY_DIR, serial, dane);
        console.log(`[Reżyser] 📼 Odcinek #${odcinek.numer} „${odcinek.tytul}" domknięty (${serial || 'bez nazwy'}).`);
        const oddech = await oddechZaPrace('odcinek.domkniety', `odc:${odcinek.id}`,
            { nazwa: `Odcinek #${odcinek.numer}: ${odcinek.tytul}`, sciezka: null });
        return res.json({ success: true, odcinek, oddech });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

app.delete('/api/rezyser/pamiec/odcinek/:id', async (req, res) => {
    try {
        const odcinek = await usunOdcinek(ANTIGRAVITY_DIR, String(req.query.serial || ''), req.params.id);
        return res.json({ success: true, odcinek });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/rezyser/rozmowa  { serial, wypowiedz, historia[], postacId? }
 * Jedna tura rozmowy z Reżyserem: kontekst → model → mowa + wykonana akcja.
 */
app.post('/api/rezyser/rozmowa', async (req, res) => {
    const { serial = '', wypowiedz = '', historia = [], postacId = null } = req.body ?? {};
    if (String(wypowiedz).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Pusta wypowiedź.' });
    }
    const nazwaSerialu = String(serial).trim() || 'bez nazwy';

    try {
        // ── Kontekst: obsada + pamięć + tablica, przycięte do budżetu ──
        const postac = postacId
            ? (await listaPostaci(ANTIGRAVITY_DIR)).find(p => p.id === postacId) ?? null
            : null;
        const kontekst = zbudujKontekst({
            pamiecSerialu: await rezyserPamiec(ANTIGRAVITY_DIR, nazwaSerialu),
            postac,
            kadry: await produkcjaLista(ANTIGRAVITY_DIR, nazwaSerialu),
        });
        if (kontekst.pominieto.length) {
            // Cicha utrata faktu kanonicznego to najgorsze, co może się przydarzyć
            // serialowi — więc krzyczy w logu i wraca w odpowiedzi.
            console.warn(`[Reżyser] ⚠️ Kontekst przycięty: ${kontekst.pominieto.join(' · ')}`);
        }

        // Ostatnie 8 tur — dalej i tak wypchnęłoby kontekst ponad okno modelu.
        const rozmowa = (Array.isArray(historia) ? historia : []).slice(-8)
            .map(t => `${t.role === 'user' ? 'Suweren' : 'Ty'}: ${t.content}`).join('\n');

        const odp = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: DEFAULT_LLM,
                system: promptSystemowyRezysera(kontekst, postac?.imie ?? null),
                prompt: `${rozmowa ? rozmowa + '\n' : ''}Suweren: ${wypowiedz}\nTy:`,
                stream: false,
                options: { temperature: 0.75 },
            }),
        });
        if (!odp.ok) throw new Error(`Ollama HTTP ${odp.status} — sprawdź, czy rdzeń AI stoi.`);
        const dane = await odp.json();

        // ── Odczyt kontraktu. Gdy model go nie utrzyma, NIE zgadujemy akcji ──
        let mowa, akcja = null, uwaga = null;
        try {
            ({ mowa, akcja } = odczytajOdpowiedz(dane.response));
        } catch (e) {
            mowa = String(dane.response || '').trim();
            uwaga = `Model nie utrzymał formatu (${e.message}) — potraktowane jako sama wypowiedź, bez akcji.`;
            console.warn(`[Reżyser] ⚠️ ${uwaga}`);
        }
        if (!mowa && !akcja) {
            return res.status(502).json({ success: false, message: 'Reżyser milczy — rdzeń AI zwrócił pustkę.' });
        }

        // ── Wykonanie akcji (biała lista; model nie wymyśli sobie nowej) ──
        let wynikAkcji = null;
        if (akcja) {
            if (!AKCJE_REZYSERA.has(akcja.typ)) {
                wynikAkcji = { wykonana: false, powod: `nieznana akcja „${akcja.typ}" — pominięta` };
                console.warn(`[Reżyser] ⛔ ${wynikAkcji.powod}`);
            } else {
                try {
                    switch (akcja.typ) {
                        case 'dodaj_kadr': {
                            const kadr = await produkcjaDodaj(ANTIGRAVITY_DIR, {
                                tytul: akcja.tytul, opis: akcja.opis, etap: akcja.etap || 'BIBLIA',
                                projekt: nazwaSerialu, zrodlo: 'rada',
                            });
                            wynikAkcji = { wykonana: true, opis: `kadr „${kadr.tytul}" na etapie ${kadr.etap}`, kadr };
                            break;
                        }
                        case 'rozloz': {
                            const r = await radaKreatywnaRozloz(akcja.zlecenie || wypowiedz, nazwaSerialu);
                            wynikAkcji = {
                                wykonana: true,
                                opis: `rozłożone na ${r.dodane.length} kart` +
                                      (r.odrzucone.length ? ` (${r.odrzucone.length} odrzuconych)` : ''),
                                ...r,
                            };
                            break;
                        }
                        case 'zapamietaj': {
                            const w = await dodajFakt(ANTIGRAVITY_DIR, nazwaSerialu, akcja.fakt, 'rezyser');
                            wynikAkcji = {
                                wykonana: true,
                                opis: w.duplikat ? 'ten fakt już był w kanonie' : `zapamiętane: „${w.fakt.tresc}"`,
                                fakt: w.fakt,
                            };
                            break;
                        }
                        case 'domknij_odcinek': {
                            const o = await dodajOdcinek(ANTIGRAVITY_DIR, nazwaSerialu, {
                                tytul: akcja.tytul, streszczenie: akcja.streszczenie,
                            });
                            wynikAkcji = { wykonana: true, opis: `odcinek #${o.numer} „${o.tytul}" domknięty`, odcinek: o };
                            break;
                        }
                        case 'otworz':
                            // Jedyna akcja bez skutku na serwerze — front ma otworzyć moduł.
                            wynikAkcji = { wykonana: true, opis: `otwórz moduł: ${akcja.modul}`, modul: akcja.modul };
                            break;
                    }
                } catch (e) {
                    // Akcja padła — mówimy to wprost. Reżyser, który „zrobił" coś,
                    // czego nie ma na tablicy, jest gorszy niż Reżyser, który przyznał błąd.
                    wynikAkcji = { wykonana: false, powod: e.message };
                    console.warn(`[Reżyser] ⚠️ Akcja ${akcja.typ} nie przeszła: ${e.message}`);
                }
            }
        }

        // Model bywa tak zajęty składaniem akcji, że zapomina o „mowa". Zdanie
        // układamy wtedy Z WYNIKU — czyli PO wykonaniu, z tego, co naprawdę się
        // stało. Kolejność jest istotna: gdyby powstało wcześniej, obiecywałoby.
        if (!mowa) {
            mowa = zdanieZWyniku(akcja.typ, wynikAkcji);
            uwaga = (uwaga ? uwaga + ' ' : '') +
                    'Model nie podał wypowiedzi — zdanie ułożone z faktycznego wyniku akcji.';
        }

        console.log(`[Reżyser] 🎬 ${nazwaSerialu}${postac ? ` · ${postac.imie}` : ''} · kontekst ${kontekst.znakow} zn.` +
                    `${akcja ? ` · akcja ${akcja.typ}: ${wynikAkcji?.wykonana ? 'OK' : 'NIE'}` : ''}`);

        return res.json({
            success: true,
            mowa, akcja, wynikAkcji, uwaga,
            model: DEFAULT_LLM,
            postac: postac ? { id: postac.id, imie: postac.imie, glos: postac.glos } : null,
            kontekst: { znakow: kontekst.znakow, pominieto: kontekst.pominieto },
        });
    } catch (e) {
        console.error(`[Reżyser] ❌ ${e.message}`);
        return res.status(500).json({ success: false, message: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🌌 UNIVERSA — rejestr modułów i wypraw, płatne w GRV
//
//  Zastępuje makietę: zakładka „Universes" miała wymyślone aktywa, liczniki
//  wpisane na sztywno i przycisk wpłaty BEZ obsługi kliknięcia.
//  Tutaj każdy ruch przechodzi przez `przelejGrv` — z odjęciem u nadawcy
//  i pieczęcią w łańcuchu. Liczniki wypraw są SUMOWANE z wpłat, nigdy
//  przechowywane, więc nie da się ich ustawić z palca.
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/moduly', async (req, res) => {
    try {
        const wezel = String(req.query.wezel || '') || null;
        return res.json({
            success: true,
            moduly: await listaModulow(ANTIGRAVITY_DIR, wezel),
            stan: await stanRejestru(ANTIGRAVITY_DIR),
            skarbiec: SKARBIEC_GRV,
        });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/moduly', async (req, res) => {
    try {
        const modul = await dodajModul(ANTIGRAVITY_DIR, req.body ?? {});
        console.log(`[Universa] 🧩 Nowy moduł „${modul.nazwa}" od ${modul.autor} (${modul.cenaGRV} GRV).`);
        return res.json({ success: true, modul });
    } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

app.delete('/api/moduly/:id', async (req, res) => {
    try {
        return res.json({ success: true, modul: await usunModul(ANTIGRAVITY_DIR, req.params.id) });
    } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

/** Subskrypcja: REALNY przelew GRV, potem dopiero zapis. Kolejność jest istotna. */
app.post('/api/moduly/:id/subskrybuj', async (req, res) => {
    const { wezel } = req.body ?? {};
    if (!wezel) return res.status(400).json({ success: false, message: 'Wymagany „wezel" (kto subskrybuje).' });
    try {
        const moduly = await listaModulow(ANTIGRAVITY_DIR, wezel);
        const m = moduly.find(x => x.id === req.params.id);
        if (!m) return res.status(404).json({ success: false, message: `Moduł „${req.params.id}" nie istnieje.` });
        if (m.subskrybowany) return res.status(400).json({ success: false, message: 'Już subskrybujesz ten moduł.' });

        // Płatne moduły: najpierw pieniądze, potem dostęp. Zapis przed przelewem
        // dałby subskrypcję nawet przy pustym koncie.
        let przelew = null;
        if (m.cenaGRV > 0) {
            const odbiorca = m.wbudowany ? SKARBIEC_GRV : (m.autor || SKARBIEC_GRV);
            przelew = await przelejGrv(wezel, odbiorca, m.cenaGRV);
        }
        const wynik = await zapiszSubskrypcje(ANTIGRAVITY_DIR, { modul: m.id, wezel, grv: m.cenaGRV });
        console.log(`[Universa] ✅ ${wezel} subskrybuje „${m.nazwa}" za ${m.cenaGRV} GRV.`);
        return res.json({ success: true, modul: m.id, zaplacono: m.cenaGRV, przelew, ...wynik });
    } catch (err) {
        return res.status(err instanceof BladGrv ? err.status : 400).json({ success: false, message: err.message });
    }
});

app.delete('/api/moduly/:id/subskrypcja', async (req, res) => {
    try {
        const wezel = String(req.query.wezel || '');
        if (!wezel) return res.status(400).json({ success: false, message: 'Wymagany „wezel".' });
        return res.json({ success: true, ...(await anulujSubskrypcje(ANTIGRAVITY_DIR, req.params.id, wezel)) });
    } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

// ── Wyprawy ───────────────────────────────────────────────────────────────────

app.get('/api/wyprawy', async (req, res) => {
    try {
        return res.json({ success: true, wyprawy: await listaWypraw(ANTIGRAVITY_DIR) });
    } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/wyprawy', async (req, res) => {
    try {
        const wyprawa = await dodajWyprawe(ANTIGRAVITY_DIR, req.body ?? {});
        console.log(`[Universa] 🚀 Nowa wyprawa „${wyprawa.nazwa}" (cel ${wyprawa.celGRV} GRV) od ${wyprawa.autor}.`);
        return res.json({ success: true, wyprawa });
    } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

app.delete('/api/wyprawy/:id', async (req, res) => {
    try {
        return res.json({ success: true, wyprawa: await usunWyprawe(ANTIGRAVITY_DIR, req.params.id) });
    } catch (err) { return res.status(400).json({ success: false, message: err.message }); }
});

/** Wpłata na wyprawę: przelew GRV, potem zapis. Licznik urośnie sam z sumy. */
app.post('/api/wyprawy/:id/wplac', async (req, res) => {
    const { wezel, grv } = req.body ?? {};
    const kwota = Math.floor(Number(grv) || 0);
    if (!wezel) return res.status(400).json({ success: false, message: 'Wymagany „wezel".' });
    if (!(kwota > 0)) return res.status(400).json({ success: false, message: 'Kwota musi być większa od zera.' });
    try {
        const wyprawy = await listaWypraw(ANTIGRAVITY_DIR);
        const w = wyprawy.find(x => x.id === req.params.id);
        if (!w) return res.status(404).json({ success: false, message: `Wyprawa „${req.params.id}" nie istnieje.` });

        const przelew = await przelejGrv(wezel, SKARBIEC_GRV, kwota);
        const wpis = await zapiszWplate(ANTIGRAVITY_DIR, { wyprawa: w.id, wezel, grv: kwota });
        const po = (await listaWypraw(ANTIGRAVITY_DIR)).find(x => x.id === w.id);
        console.log(`[Universa] 💫 ${wezel} wpłacił ${kwota} GRV na „${w.nazwa}" (${po.zebraneGRV}/${w.celGRV}).`);
        return res.json({ success: true, wpis, przelew, wyprawa: po });
    } catch (err) {
        return res.status(err instanceof BladGrv ? err.status : 400).json({ success: false, message: err.message });
    }
});

// ── ⚡ MODEL CONTEXT PROTOCOL (MCP SKILLBOARD & REGISTRY 0.00G) ─────────────
const MCP_REGISTRY_PATH = path.join(ANTIGRAVITY_DIR || process.cwd(), '.vault-0.00g', 'mcp-registry.json');
let mcpRegistryCache = null;

async function loadMcpRegistry() {
    if (mcpRegistryCache) return mcpRegistryCache;
    try {
        await fs.mkdir(path.dirname(MCP_REGISTRY_PATH), { recursive: true });
        const data = await fs.readFile(MCP_REGISTRY_PATH, 'utf8');
        mcpRegistryCache = JSON.parse(data);
        return mcpRegistryCache;
    } catch (e) {
        mcpRegistryCache = {
            version: '0.00G',
            activeSkills: ['postgres-mcp', 'sqlite-vault-mcp', 'github-ops-mcp', 'docker-sentinel-mcp', 'filesystem-core-mcp', 'terminal-exec-mcp', 'puppeteer-scraper-mcp', 'brave-search-mcp', 'youtube-transcript-mcp', 'ollama-matrix-mcp', 'ffmpeg-sonic-mcp'],
            customSkills: [],
            agentBindings: {
                klaudiusz: ['postgres-mcp', 'sqlite-vault-mcp', 'github-ops-mcp', 'filesystem-core-mcp', 'terminal-exec-mcp', 'puppeteer-scraper-mcp', 'brave-search-mcp', 'ollama-matrix-mcp', 'ffmpeg-sonic-mcp'],
                bob: ['sqlite-vault-mcp', 'filesystem-core-mcp', 'youtube-transcript-mcp', 'ollama-matrix-mcp', 'ffmpeg-sonic-mcp'],
                ostry: ['github-ops-mcp', 'sentry-anomaly-mcp', 'filesystem-core-mcp', 'terminal-exec-mcp', 'ollama-matrix-mcp'],
                mechanik: ['postgres-mcp', 'redis-cache-mcp', 'github-ops-mcp', 'docker-sentinel-mcp', 'sentry-anomaly-mcp', 'filesystem-core-mcp', 'terminal-exec-mcp', 'ollama-matrix-mcp'],
                archiwista: ['postgres-mcp', 'sqlite-vault-mcp', 'filesystem-core-mcp', 'puppeteer-scraper-mcp', 'brave-search-mcp', 'youtube-transcript-mcp', 'ollama-matrix-mcp'],
                wezyr: ['docker-sentinel-mcp', 'brave-search-mcp', 'ollama-matrix-mcp']
            },
            updatedAt: new Date().toISOString()
        };
        return mcpRegistryCache;
    }
}

/**
 * Skille, ktore MAJA realna implementacje po stronie mostu. Reszta rejestru to
 * karty w katalogu — moga byc podpiete pozniej do prawdziwych serwerow MCP,
 * ale dzis nic nie wykonaja i endpoint /execute mowi to wprost (501).
 * Dopisujac tu nowy skill, dopisz tez jego obsluge w /api/mcp/execute.
 */
const MCP_REALNE = ['filesystem-core-mcp', 'terminal-exec-mcp', 'katedra-puls-mcp', 'muzyka-otakos-mcp', 'sumienie-mcp'];

/**
 * Sekrety nie wychodza przez MCP. `read_file` czytal cokolwiek — a `list_directory`
 * pokazywal w katalogu mostu `.env`, `.env.local` i `.anthropic_key.env`.
 * Blokada dziala na nazwie pliku, wiec lapie tez kopie typu `.env.backup`.
 */
const MCP_PLIKI_ZAKAZANE = /(^\.env)|(\.env$)|(\.env\.)|key|secret|token|credential|password|haslo|\.pem$|\.pfx$|id_rsa|vault/i;

function mcpWolnoCzytac(sciezka) {
    const nazwa = path.basename(String(sciezka));
    return !MCP_PLIKI_ZAKAZANE.test(nazwa);
}

async function saveMcpRegistry(data) {
    mcpRegistryCache = data;
    try {
        await fs.mkdir(path.dirname(MCP_REGISTRY_PATH), { recursive: true });
        await fs.writeFile(MCP_REGISTRY_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn('[MCP Bridge] Nie udało się zapisać mcp-registry.json:', e.message);
    }
}

app.get('/api/mcp/status', async (req, res) => {
    try {
        const reg = await loadMcpRegistry();
        return res.json({
            success: true,
            online: true,
            activeCount: reg.activeSkills?.length || 0,
            totalAvailable: 15,
            transport: 'STDIO / HTTP / SSE (0.00G)',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        return res.json({ success: true, online: true, activeCount: 11, totalAvailable: 15, transport: 'STDIO' });
    }
});

app.get('/api/mcp/skills', async (req, res) => {
    try {
        const reg = await loadMcpRegistry();
        return res.json({
            success: true,
            activeSkills: reg.activeSkills || [],
            customSkills: reg.customSkills || [],
            agentBindings: reg.agentBindings || {}
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/mcp/activate', async (req, res) => {
    try {
        const { skillId, command, transport, env, customConfig } = req.body || {};
        if (!skillId) return res.status(400).json({ success: false, message: 'Wymagane skillId.' });
        const reg = await loadMcpRegistry();
        if (!reg.activeSkills.includes(skillId)) {
            reg.activeSkills.push(skillId);
            reg.updatedAt = new Date().toISOString();
            await saveMcpRegistry(reg);
        }
        console.log(`[MCP Bridge] ⚡ Skill [${skillId}] aktywowany w Moście (${transport || 'stdio'}).`);
        return res.json({
            success: true,
            skillId,
            status: 'active',
            message: `Skill ${skillId} został pomyślnie podpięty do Mostu 0.00G!`
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/mcp/deactivate', async (req, res) => {
    try {
        const { skillId } = req.body || {};
        if (!skillId) return res.status(400).json({ success: false, message: 'Wymagane skillId.' });
        const reg = await loadMcpRegistry();
        reg.activeSkills = (reg.activeSkills || []).filter(id => id !== skillId);
        reg.updatedAt = new Date().toISOString();
        await saveMcpRegistry(reg);
        console.log(`[MCP Bridge] 🔌 Skill [${skillId}] odłączony.`);
        return res.json({ success: true, skillId, status: 'inactive' });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/mcp/assign', async (req, res) => {
    try {
        const { skillId, agentId, assigned } = req.body || {};
        if (!skillId || !agentId) return res.status(400).json({ success: false, message: 'Wymagane skillId i agentId.' });
        const reg = await loadMcpRegistry();
        reg.agentBindings = reg.agentBindings || {};
        reg.agentBindings[agentId] = reg.agentBindings[agentId] || [];
        if (assigned) {
            if (!reg.agentBindings[agentId].includes(skillId)) reg.agentBindings[agentId].push(skillId);
        } else {
            reg.agentBindings[agentId] = reg.agentBindings[agentId].filter(id => id !== skillId);
        }
        reg.updatedAt = new Date().toISOString();
        await saveMcpRegistry(reg);
        console.log(`[MCP Bridge] 🤖 Agent [${agentId}] ${assigned ? 'podpięty pod' : 'odpięty od'} [${skillId}].`);
        return res.json({ success: true, skillId, agentId, assigned });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/mcp/execute', async (req, res) => {
    const { skillId, toolName, arguments: toolArgs } = req.body || {};
    if (!skillId || !toolName) {
        return res.status(400).json({ success: false, message: 'Wymagane skillId oraz toolName.' });
    }
    console.log(`[MCP Bridge] 🧪 Wywołanie narzędzia MCP: ${skillId} -> ${toolName}`, toolArgs);

    try {
        // Obsługa specyficznych narzędzi lokalnych
        if (skillId === 'filesystem-core-mcp') {
            if (toolName === 'list_directory') {
                const target = toolArgs?.path || '.';
                const files = await fs.readdir(path.resolve(target));
                return res.json({ success: true, result: { path: target, entries: files.slice(0, 50) } });
            }
            if (toolName === 'read_file') {
                const target = toolArgs?.path || 'package.json';
                if (!mcpWolnoCzytac(target)) {
                    return res.status(403).json({
                        success: false,
                        message: `Odmowa: "${path.basename(target)}" wygląda na plik z sekretem. MCP nie wydaje kluczy ani .env.`,
                    });
                }
                const content = await fs.readFile(path.resolve(target), 'utf8');
                return res.json({ success: true, result: { path: target, preview: content.slice(0, 1000), totalBytes: content.length } });
            }
        }

        if (skillId === 'terminal-exec-mcp') {
            const rawCmd = toolArgs?.command || 'git status -s';
            // Ten sam sanitizer, co /api/mcp/execute pomijal, a trzy inne endpointy
            // wykonujace komendy uzywaja. Bez niego wklejony prompt powloki albo
            // sztuczka ze znacznikiem szly prosto do execAsync.
            const san = ShellSanitizer.sanitizeShellCommand(rawCmd);
            const cmd = san.command ?? san.cmd ?? san.sanitized ?? rawCmd;
            try {
                const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd(), timeout: 10000 });
                return res.json({ success: true, result: { command: cmd, stdout, stderr, exitCode: 0, sanitizer: san.notes ?? [] } });
            } catch (err) {
                return res.json({ success: true, result: { command: cmd, error: err.message, exitCode: 1, sanitizer: san.notes ?? [] } });
            }
        }

        // ══ SKILLE KLAUDIUSZA — realne, nie karty w katalogu ══════════════════

        // 💓 PULS KATEDRY — jeden strzal, pelna diagnoza wezla.
        // Powstal z tej sesji: szukanie, dlaczego muzyka liczy 7h, wymagalo recznego
        // sprawdzania mostu, Ollamy, ComfyUI, VRAM-u i COMMITU (nie WorkingSet!).
        if (skillId === 'katedra-puls-mcp') {
            const zywy = async (url, ms = 1500) => {
                try {
                    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
                    const r = await fetch(url, { signal: c.signal }); clearTimeout(t);
                    return r.ok;
                } catch { return false; }
            };
            const [ollama, comfy] = await Promise.all([
                zywy(`${OLLAMA_BASE}/api/tags`), zywy(`${COMFY_BASE}/object_info`, 2500),
            ]);
            let modeleLlm = [];
            try {
                const r = await fetch(`${OLLAMA_BASE}/api/ps`);
                modeleLlm = (await r.json()).models?.map(m => ({ nazwa: m.name, gb: +(m.size / 1e9).toFixed(2) })) ?? [];
            } catch { /* Ollama spi */ }
            const wolneMb = Math.round(os.freemem() / 1e6);
            const calyMb = Math.round(os.totalmem() / 1e6);
            let muzyka = null;
            try { muzyka = await muzykaModeleStatus(); } catch { /* katalog nieosiagalny */ }

            return res.json({
                success: true,
                result: {
                    most: { port: PORT, uptimeS: Math.round(process.uptime()) },
                    ollama: { online: ollama, zaladowane: modeleLlm },
                    comfyui: { online: comfy, base: COMFY_BASE },
                    pamiec: {
                        wolneGb: +(wolneMb / 1024).toFixed(2),
                        calyGb: +(calyMb / 1024).toFixed(2),
                        // Ostrzezenie zmierzone w tej sesji: 8.7 GB encoder + ~2 GB torch.
                        starczyNaMuzyke: wolneMb > 11000,
                    },
                    muzyka: muzyka ? { gotowaRodzina: muzyka.gotowaRodzina, naDyskuGb: +(muzyka.bajtyNaDysku / 1e9).toFixed(2) } : null,
                    werdykt: [
                        ollama ? null : 'Ollama nie odpowiada — Orb zamilknie.',
                        comfy ? null : 'ComfyUI nie działa — muzyka i obraz nie policzą.',
                        wolneMb < 4000 ? `Mało wolnej pamięci (${(wolneMb / 1024).toFixed(1)} GB) — zwolnij model Ollamy: keep_alive 0.` : null,
                        modeleLlm.some(m => /gemma4:latest/.test(m.nazwa)) ? 'Uwaga: wisi gemma4:latest, ta która wywala Ollamę na tej maszynie.' : null,
                    ].filter(Boolean),
                },
            });
        }

        // 🎵 BIBLIOTEKA DZWIEKU — co realnie lezy w _OtakOs_Muzyka.
        if (skillId === 'muzyka-otakos-mcp') {
            const szukaj = String(toolArgs?.query ?? '').toLowerCase();
            let pliki = [];
            try {
                pliki = (await getAudioFilesRecursive(MUSIC_DIR)) ?? [];
            } catch { /* brak katalogu */ }
            const wynik = [];
            for (const pelna of pliki) {
                const nazwa = path.basename(pelna);
                if (szukaj && !nazwa.toLowerCase().includes(szukaj)) continue;
                let bajty = 0;
                try { bajty = (await fs.stat(pelna)).size; } catch { /* zniknal */ }
                wynik.push({ nazwa, mb: +(bajty / 1e6).toFixed(2), sciezka: path.relative(MUSIC_DIR, pelna) });
            }
            wynik.sort((a, b) => a.nazwa.localeCompare(b.nazwa));
            return res.json({
                success: true,
                result: {
                    katalog: MUSIC_DIR,
                    znaleziono: wynik.length,
                    lacznieMb: +(wynik.reduce((s, x) => s + x.mb, 0)).toFixed(1),
                    utwory: wynik.slice(0, 60),
                },
            });
        }

        // 🪞 SUMIENIE KATEDRY — skaner atrap. NAJBARDZIEJ TEO Z TYCH SKILLI.
        // Powod istnienia: w tej samej sesji dwa razy trafilismy na kod, ktory
        // UDAWAL dzialanie — petla setTimeout wypisujaca fałszywe "DiT Step 12/30"
        // i endpoint MCP zwracajacy status SUCCESS na `DROP TABLE`. Oba przeszly
        // build i tsc na zielono. Zielony build nie znaczy, ze funkcja istnieje.
        // Ten skill szuka wlasnie takich rzeczy — jest narzedziem zasady
        // "zero z dupy" z CLAUDE.md, zamienionym w kod.
        if (skillId === 'sumienie-mcp') {
            const cel = toolArgs?.path;
            if (!cel) return res.status(400).json({ success: false, message: 'Podaj "path" — plik albo katalog do zbadania.' });
            const TROPY = [
                // Kolejnosc dowolna: `onProgress({percentage})` czesto stoi PRZED `setTimeout`,
                // a pierwsza wersja wzorca wymagala setTimeout na poczatku i to przepuszczala.
                { id: 'falszywy-postep', re: /(setTimeout[\s\S]{0,160}(percentage|progress|procent|krok))|((percentage|onProgress|procent)[\s\S]{0,160}setTimeout)/i, opis: 'Pętla z setTimeout udająca postęp — telemetria bez obliczeń.' },
                { id: 'zawsze-sukces', re: /status:\s*['"`](SUCCESS|OK|SUKCES)['"`]/i, opis: 'Zaszyty na sztywno SUCCESS — sprawdź, czy cokolwiek się wykonało.' },
                { id: 'pomyslnie', re: /(przetworzy[lł]o|wykonano|zakończono)\s+(dane\s+)?pomyślnie/i, opis: 'Deklaracja sukcesu w treści, nie w wyniku.' },
                // Slowo-klucz moze stac PRZED albo PO Math.random() — `const loss = Math.random()`
                // to najczestszy uklad, a pierwsza wersja tego wzorca go przepuszczala.
                { id: 'losowe-dane', re: /(Math\.random\(\)[\s\S]{0,60}(loss|score|confidence|wynik|postep|progress))|((loss|score|confidence|wynik|postep|progress)[\s\S]{0,60}Math\.random\(\))/i, opis: 'Math.random() podstawiony pod metrykę — dane z kapelusza.' },
                { id: 'placeholder-media', re: /soundhelix|placeholder\.com|via\.placeholder|example\.com\/(audio|video)/i, opis: 'Zewnętrzny placeholder udający wytworzony materiał.' },
                { id: 'symulator', re: /\b(symulator|simulator|udaje|fake|mock)\b/i, opis: 'Nazwane wprost: symulacja. Sprawdź, czy nie jest podana jako funkcja.' },
                { id: 'dlug', re: /\b(TODO|FIXME|HACK|XXX)\b/, opis: 'Dług zapisany w kodzie.' },
            ];
            const ROZSZERZENIA = /\.(ts|tsx|js|jsx|mjs|cjs|py)$/i;
            const pelna = path.resolve(cel);
            const doZbadania = [];
            const st = await fs.stat(pelna);
            if (st.isDirectory()) {
                const wejscia = await fs.readdir(pelna, { withFileTypes: true });
                for (const w of wejscia) {
                    if (w.isFile() && ROZSZERZENIA.test(w.name)) doZbadania.push(path.join(pelna, w.name));
                }
            } else doZbadania.push(pelna);

            const znaleziska = [];
            for (const plik of doZbadania.slice(0, 40)) {
                let tresc = '';
                try { tresc = await fs.readFile(plik, 'utf8'); } catch { continue; }
                const linie = tresc.split(/\r?\n/);
                // Okno 4 linii, nie pojedyncza linia: atrapy rozkladaja sie w pionie.
                // `setTimeout` bywa o dwie linie nizej niz `percentage`, a skan linia-po-linii
                // taki uklad przepuszczal (wykryte przy testowaniu tego skilla na probce).
                const OKNO = 4;
                for (const t of TROPY) {
                    const zgloszone = new Set();
                    for (let i = 0; i < linie.length; i++) {
                        const okno = linie.slice(i, i + OKNO).join('\n');
                        const traf = okno.match(t.re);
                        if (!traf) continue;
                        // Numer linii liczymy od MIEJSCA TRAFIENIA w oknie, nie od jego poczatku —
                        // inaczej raport wskazywal linie o kilka wyzej niz faktyczna atrapa.
                        const przesuniecie = okno.slice(0, traf.index).split('\n').length - 1;
                        const nrLinii = i + przesuniecie;
                        // Nachodzace okna trafiaja to samo miejsce — zglaszamy raz.
                        if ([...zgloszone].some((z) => Math.abs(nrLinii - z) < OKNO)) continue;
                        zgloszone.add(nrLinii);
                        znaleziska.push({
                            plik: path.relative(process.cwd(), plik),
                            linia: nrLinii + 1,
                            trop: t.id,
                            opis: t.opis,
                            fragment: (linie[nrLinii] ?? '').trim().slice(0, 140),
                        });
                    }
                }
            }
            return res.json({
                success: true,
                result: {
                    zbadano: doZbadania.length,
                    znaleziono: znaleziska.length,
                    // Puste znaleziska NIE znacza "kod uczciwy" — to heurystyka, nie dowod.
                    werdykt: znaleziska.length === 0
                        ? 'Brak trafień heurystyki. To nie jest dowód uczciwości kodu — tylko brak znanych wzorców atrapy.'
                        : `${znaleziska.length} miejsc do obejrzenia okiem. Każde trafienie wymaga oceny człowieka.`,
                    znaleziska: znaleziska.slice(0, 80),
                },
            });
        }

        // ── UCZCIWA ODMOWA ────────────────────────────────────────────────────
        // Tu byl "domyslny simulator", ktory KAZDEMU narzedziu odpowiadal
        // status: 'SUCCESS' i "przetworzylo dane pomyslnie". Na zapytanie
        // `DROP TABLE wszystko` do nieistniejacej bazy tez odpowiadal SUKCESEM.
        // To jest dokladnie "z dupy" z CLAUDE.md — i grozne, bo Suweren moglby
        // uwierzyc, ze destrukcyjna operacja przeszla.
        // Skill bez realnego backendu ma powiedziec, ze go nie ma. Kropka.
        return res.status(501).json({
            success: false,
            skillId,
            tool: toolName,
            status: 'NIEZAIMPLEMENTOWANE',
            message: `Skill "${skillId}" jest w rejestrze, ale nie ma podpiętego serwera MCP — most nie wykona "${toolName}".`,
            hint: 'Realnie wykonują się tylko te skille, które mają implementację po stronie mostu. '
                + `Obecnie: ${MCP_REALNE.join(', ')}. Resztę trzeba podpiąć do prawdziwego serwera MCP (stdio/sse/http).`,
            realneSkille: MCP_REALNE,
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/mcp/add-custom', async (req, res) => {
    try {
        const customSkill = req.body || {};
        const reg = await loadMcpRegistry();
        reg.customSkills = reg.customSkills || [];
        reg.customSkills.push(customSkill);
        if (!reg.activeSkills.includes(customSkill.id)) {
            reg.activeSkills.push(customSkill.id);
        }
        await saveMcpRegistry(reg);
        return res.json({ success: true, skill: customSkill });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
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

const httpServer = app.listen(PORT, () => {
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
    console.log(` 👉 Muzyka: _OtakOs_Muzyka/`);
    console.log(` 🛰️  CORS: każdy origin (Kwantowy Tunel). Kanały lokalne: ${KNOWN_ORIGINS.length}`);
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
    console.log(` 🎙️  POST /api/impresario/enqueue         (filePath wymagane)`);
    console.log(` 🎙️  POST /api/impresario/upload/:id       (YouTube OAuth2 streaming)`);
    console.log(` 🎙️  POST /api/impresario/export/spotify/:id (DistroKid paczka)`);
    console.log(` 🎙️  POST /api/impresario/vault/update`);
    console.log(` 💬  GET  /api/tost/messages                (Historia zaszyfrowana)`);
    console.log(` 💬  POST /api/tost/send                   (Wyślij → Gemma4 LOCAL TeO)`);
    console.log(` 💬  DELETE /api/tost/messages             (Wyczyść historię)`);
    console.log(` 🔗  POST /api/tost/p2p/init               (Generuj Szmaragdowy Token)`);
    console.log(` 🔗  GET  /api/tost/p2p/stream/:token      (SSE Tunel P2P)`);
    console.log(` 🔗  POST /api/tost/p2p/message/:token     (Relay wiadomości P2P)`);
    console.log(` 🧽  POST /api/laundry/sanitize            (Pralka: EXIF/ICC/XMP scrubber)`);
    console.log(` 🏛️  POST /api/agent/rada-decompose        (Rada: dekompozycja → sesja izolowana)`);
    console.log(` 🤖  GET  /api/auth/google                  (OAuth2 placeholder)`);
    console.log(` 🤖  POST /api/impresario/secrets/youtube   (Zapis kluczy API)`);
    console.log(` 🤖  POST /api/auth/google/simulate         (Gemini Agent stub)`);
    console.log(` 🎥  WS   /api/rtmp-relay                   (Katedra → ffmpeg → RTMP/YouTube)`);
    console.log(` 🔴  WS   /api/recorder                     (Katedra → plik .webm na dysku)`);
    console.log(` 🎥  GET  /api/studio/status | POST /api/studio/rtmp-key`);

    // 🛡️ Strażnik VRAM - Tacos Guard
    initTacosGuard();
});

// ── 🎥 STUDIO — kanały WebSocket wpięte w ten sam serwer HTTP ────────────────
// /api/rtmp-relay → ffmpeg → RTMP (koniec głuchoty transmisji)
// /api/recorder   → fizyczny plik .webm na dysku Suwerena
attachStudioRelay(httpServer, { ffmpegPath });
attachGoscStudio(httpServer);

// ⚠️ STRAŻNIK GNIAZD NICZYICH — MUSI być wpięty JAKO OSTATNI.
// Node woła WSZYSTKIE nasłuchy 'upgrade', więc żaden z serwisów nie może
// niszczyć „nieznanych" ścieżek — zabiłby kanał sąsiada (dokładnie to robił
// StudioRelay z kanałem gościa). Każdy serwis oznacza swoje żądanie flagą,
// a tutaj sprzątamy tylko to, czego nikt nie przygarnął.
httpServer.on('upgrade', (req, socket) => {
    if (!req.__wsObsluzone) {
        console.warn(`[WS] ⛔ Gniazdo bez właściciela: ${req.url}`);
        socket.destroy();
    }
});
