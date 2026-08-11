/**
 * 🎥 StudioRelayService — Most Wiesia dla Wideopodcastu (Katedra 1/1).
 *
 * Dwa kanały WebSocket wpięte w ten sam serwer HTTP co Express (port 3001):
 *
 *   ▸ /api/rtmp-relay  — strumień webm z <canvas> Katedry → lokalny ffmpeg → RTMP
 *                        (domyślnie `rtmp://a.rtmp.youtube.com/live2/<klucz>`).
 *                        KLUCZ NIGDY NIE IDZIE Z PRZEGLĄDARKI — leży w
 *                        `_OtakOs_Wymiar/media/media_secrets.json` (plik w .gitignore).
 *
 *   ▸ /api/recorder    — ten sam strumień zapisywany jako FIZYCZNY plik `.webm`
 *                        na dysku Suwerena (opcjonalny remux do `.mp4` w tle).
 *
 * Zasada 0.00G: wszystko lokalnie. Chmura (YouTube) tylko wtedy, gdy Suweren
 * świadomie wklei klucz transmisji.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';

// ─── Ścieżki ──────────────────────────────────────────────────────────────────
const MEDIA_DIR    = path.join(process.cwd(), '_OtakOs_Wymiar', 'media');
const SECRETS_FILE = path.join(MEDIA_DIR, 'media_secrets.json');
const SECRETS_TEMP = path.join(MEDIA_DIR, 'temp_secrets_rtmp.json');

/** Domyślna baza RTMP — YouTube Live. Suweren może podmienić (Twitch, własny nginx-rtmp). */
export const DEFAULT_RTMP_URL = 'rtmp://a.rtmp.youtube.com/live2';

/**
 * Folder nagrań. Suweren trzyma odcinki w `F:\5 stars\TeO STUDIO\_Nagrane_Podcasty`,
 * ale Katedra jedzie też z pendrive'a — tam litery F: nie ma. Kolejność:
 *   1. OTAKOS_PODCAST_DIR (env, gdy ktoś chce swoje miejsce)
 *   2. ścieżka Suwerena, jeśli `TeO STUDIO` istnieje na tej maszynie
 *   3. `_OtakOs_Podcasty` obok Katedry (Live-USB)
 */
function resolveRecordingsDir() {
    const fromEnv = (process.env.OTAKOS_PODCAST_DIR || '').trim();
    if (fromEnv) return fromEnv;

    const sovereign = path.join('F:', path.sep, '5 stars', 'TeO STUDIO', '_Nagrane_Podcasty');
    try {
        if (fsSync.existsSync(path.dirname(sovereign))) return sovereign;
    } catch { /* brak dostępu do F: — lecimy dalej */ }

    return path.join(process.cwd(), '_OtakOs_Podcasty');
}

export const RECORDINGS_DIR = resolveRecordingsDir();

// ─── Stan studia (jedna transmisja i jedno nagranie na raz — to podcast 1/1) ──
const state = {
    live:        false,
    recording:   false,
    lastFile:    null,
    lastError:   null,
    startedAt:   null,
    bytesIn:     0,
};

let ffmpegBinary = null; // ustawiany przy attachStudioRelay()

// ═══════════════════════════════════════════════════════════════════════════════
//  SKARBIEC — klucz transmisji
// ═══════════════════════════════════════════════════════════════════════════════

async function readSecrets() {
    try {
        const parsed = JSON.parse(await fs.readFile(SECRETS_FILE, 'utf8'));
        delete parsed._INSTRUKCJA;
        return parsed;
    } catch {
        return {};
    }
}

/** Konfiguracja RTMP ze skarbca (z kluczem w postaci jawnej — tylko do użytku serwera). */
export async function getRtmpConfig() {
    const secrets = await readSecrets();
    const rtmp = secrets.rtmp ?? {};
    return {
        url: String(rtmp.URL || DEFAULT_RTMP_URL).replace(/\/+$/, ''),
        key: String(rtmp.STREAM_KEY || '').trim(),
    };
}

/** Zapis klucza transmisji (atomowo, z zachowaniem reszty skarbca). */
export async function saveRtmpConfig(streamKey, rtmpUrl) {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    const current = await readSecrets();

    const updated = {
        _INSTRUKCJA: 'Uzupełnij pola kluczami API. Ten plik NIE MOŻE trafić do repozytorium (jest w .gitignore).',
        ...current,
        rtmp: {
            URL:        (rtmpUrl ?? current.rtmp?.URL ?? DEFAULT_RTMP_URL).trim(),
            STREAM_KEY: (streamKey ?? current.rtmp?.STREAM_KEY ?? '').trim(),
        },
    };

    await fs.writeFile(SECRETS_TEMP, JSON.stringify(updated, null, 2), 'utf8');
    await fs.rename(SECRETS_TEMP, SECRETS_FILE);

    console.log(`[Studio] 🔐 Klucz transmisji zapisany (${updated.rtmp.STREAM_KEY ? 'ustawiony' : 'wyczyszczony'}).`);
    return { configured: !!updated.rtmp.STREAM_KEY, url: updated.rtmp.URL };
}

/** Maskowanie klucza — do UI leci tylko ogon, nigdy całość. */
function maskKey(key) {
    if (!key) return '';
    return key.length <= 4 ? '••••' : `••••-${key.slice(-4)}`;
}

/** Status studia dla frontu (zero sekretów w odpowiedzi). */
export async function getStudioStatus() {
    const { url, key } = await getRtmpConfig();
    let recordings = 0;
    try {
        recordings = (await fs.readdir(RECORDINGS_DIR)).filter(f => /\.(webm|mp4)$/i.test(f)).length;
    } catch { /* folder jeszcze nie istnieje */ }

    return {
        success:        true,
        ffmpeg:         !!ffmpegBinary && fsSync.existsSync(ffmpegBinary),
        ffmpegPath:     ffmpegBinary,
        rtmpConfigured: !!key,
        rtmpUrl:        url,
        rtmpKeyMasked:  maskKey(key),
        recordingsDir:  RECORDINGS_DIR,
        recordings,
        live:           state.live,
        recording:      state.recording,
        lastFile:       state.lastFile,
        lastError:      state.lastError,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  POMOCNICZE
// ═══════════════════════════════════════════════════════════════════════════════

function send(ws, payload) {
    try {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    } catch { /* klient zniknął w trakcie — nic nie robimy */ }
}

function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/** Bezpieczna nazwa odcinka — z tego robi się nazwa pliku na dysku. */
function safeTitle(raw) {
    const cleaned = String(raw || '').trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').slice(0, 60).trim();
    return cleaned ? cleaned.replace(/\s+/g, '_') : 'Odcinek';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KANAŁ 1 — RTMP RELAY (koniec głuchoty)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Buduje argumenty ffmpeg: webm (VP8/Opus) z pipe → H.264/AAC → FLV → RTMP.
 * Transkodowanie jest konieczne — YouTube nie przyjmuje VP8 po RTMP.
 */
function buildRtmpArgs(target, opts) {
    const vBitrate = `${opts.videoKbps}k`;
    return [
        '-hide_banner', '-loglevel', 'warning',
        '-fflags', '+genpts',
        '-thread_queue_size', '1024',
        '-f', 'webm', '-i', 'pipe:0',
        // Wideo
        '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
        '-profile:v', 'main', '-pix_fmt', 'yuv420p',
        '-b:v', vBitrate, '-maxrate', vBitrate, '-bufsize', `${opts.videoKbps * 2}k`,
        '-r', String(opts.fps), '-g', String(opts.fps * 2), '-keyint_min', String(opts.fps),
        // Dźwięk (gdy ścieżki brak, ffmpeg po prostu ją pomija)
        '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
        '-f', 'flv', target,
    ];
}

async function handleRtmpConnection(ws, params) {
    const { url, key } = await getRtmpConfig();

    if (!ffmpegBinary || !fsSync.existsSync(ffmpegBinary)) {
        state.lastError = 'Brak ffmpeg na tej maszynie.';
        send(ws, { type: 'error', message: state.lastError });
        return ws.close(1011, 'ffmpeg missing');
    }
    if (!key) {
        state.lastError = 'Brak klucza transmisji — wklej go w panelu Wideopodcastu.';
        send(ws, { type: 'error', message: state.lastError });
        return ws.close(1008, 'stream key missing');
    }
    if (state.live) {
        send(ws, { type: 'error', message: 'Transmisja już trwa (podcast jest 1/1).' });
        return ws.close(1008, 'already live');
    }

    const target = `${url}/${key}`;
    const opts = {
        videoKbps: Math.min(Math.max(parseInt(params.get('vkbps') || '4500', 10) || 4500, 800), 12000),
        fps:       Math.min(Math.max(parseInt(params.get('fps') || '30', 10) || 30, 15), 60),
    };

    console.log(`[Studio·RTMP] 📡 Start relay → ${url}/${maskKey(key)} (${opts.videoKbps} kb/s, ${opts.fps} fps)`);

    const proc = spawn(ffmpegBinary, buildRtmpArgs(target, opts), { windowsHide: true });

    state.live      = true;
    state.startedAt = Date.now();
    state.bytesIn   = 0;
    state.lastError = null;

    let closed = false;
    const shutdown = (reason) => {
        if (closed) return;
        closed = true;
        state.live = false;
        try { proc.stdin.end(); } catch { /* pipe już zamknięty */ }
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* już nie żyje */ } }, 4000);
        try { if (ws.readyState === ws.OPEN) ws.close(1000, reason); } catch { /* noop */ }
        console.log(`[Studio·RTMP] ⏹️ Relay zamknięty (${reason}).`);
    };

    // ffmpeg gada po stderr — przekazujemy Suwerenowi, bo to jedyna prawda o transmisji.
    proc.stderr.on('data', (chunk) => {
        const line = chunk.toString().trim();
        if (!line) return;
        console.log(`[Studio·RTMP·ffmpeg] ${line}`);
        send(ws, { type: 'ffmpeg', line: line.slice(0, 400) });
        if (/Connection refused|Failed to|Invalid stream key|I\/O error|No such/i.test(line)) {
            state.lastError = line.slice(0, 200);
        }
    });

    proc.stdin.on('error', (err) => {
        // EPIPE = ffmpeg padł pierwszy; nie zabijamy procesu Node z tego powodu.
        if (err.code !== 'EPIPE') console.warn(`[Studio·RTMP] stdin: ${err.message}`);
        shutdown('ffmpeg-stdin-error');
    });

    proc.on('error', (err) => {
        state.lastError = err.message;
        send(ws, { type: 'error', message: `ffmpeg: ${err.message}` });
        shutdown('ffmpeg-spawn-error');
    });

    proc.on('close', (code) => {
        state.live = false;
        send(ws, { type: 'ended', code, error: state.lastError });
        shutdown(`ffmpeg-exit-${code}`);
    });

    ws.on('message', (data, isBinary) => {
        if (!isBinary || closed) return;
        state.bytesIn += data.length;
        if (!proc.stdin.destroyed) proc.stdin.write(data);
    });

    ws.on('close', () => shutdown('client-closed'));
    ws.on('error', () => shutdown('client-error'));

    send(ws, { type: 'live', target: `${url}/${maskKey(key)}`, videoKbps: opts.videoKbps, fps: opts.fps });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KANAŁ 2 — LOKALNY RECORDER (fizyczny plik na dysku)
// ═══════════════════════════════════════════════════════════════════════════════

/** Remux/transkodowanie webm → mp4 w tle. Nie blokuje nagrywania ani mostu. */
function transcodeToMp4(webmPath) {
    if (!ffmpegBinary || !fsSync.existsSync(ffmpegBinary)) return;
    const mp4Path = webmPath.replace(/\.webm$/i, '.mp4');
    console.log(`[Studio·REC] 🎞️ Konwersja w tle → ${path.basename(mp4Path)}`);

    const proc = spawn(ffmpegBinary, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', webmPath,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        mp4Path,
    ], { windowsHide: true });

    proc.on('close', (code) => {
        if (code === 0) console.log(`[Studio·REC] ✅ MP4 gotowy: ${mp4Path}`);
        else console.warn(`[Studio·REC] ⚠️ Konwersja MP4 nie wyszła (kod ${code}). Plik .webm i tak jest bezpieczny.`);
    });
    proc.on('error', (err) => console.warn(`[Studio·REC] ⚠️ Konwersja MP4: ${err.message}`));
}

async function handleRecorderConnection(ws, params) {
    if (state.recording) {
        send(ws, { type: 'error', message: 'Nagrywanie już trwa.' });
        return ws.close(1008, 'already recording');
    }

    const wantMp4 = params.get('mp4') === '1';
    const fileName = `${stamp()}_${safeTitle(params.get('title'))}.webm`;
    const filePath = path.join(RECORDINGS_DIR, fileName);

    try {
        await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    } catch (err) {
        state.lastError = `Nie mogę utworzyć folderu nagrań: ${err.message}`;
        send(ws, { type: 'error', message: state.lastError });
        return ws.close(1011, 'mkdir failed');
    }

    const out = fsSync.createWriteStream(filePath);
    let bytes = 0;
    let closed = false;

    state.recording = true;
    state.lastError = null;
    console.log(`[Studio·REC] 🔴 Nagrywam → ${filePath}`);
    send(ws, { type: 'recording', file: filePath, fileName, dir: RECORDINGS_DIR });

    const finish = () => {
        if (closed) return;
        closed = true;
        state.recording = false;
        out.end(() => {
            state.lastFile = filePath;
            console.log(`[Studio·REC] ⏹️ Zapisano ${fileName} (${(bytes / 1048576).toFixed(1)} MB)`);
            send(ws, { type: 'saved', file: filePath, fileName, bytes, mp4: wantMp4 });
            if (wantMp4 && bytes > 0) transcodeToMp4(filePath);
            try { if (ws.readyState === ws.OPEN) ws.close(1000, 'saved'); } catch { /* noop */ }
        });
    };

    out.on('error', (err) => {
        state.lastError = err.message;
        state.recording = false;
        send(ws, { type: 'error', message: `Zapis: ${err.message}` });
        closed = true;
        try { ws.close(1011, 'write error'); } catch { /* noop */ }
    });

    ws.on('message', (data, isBinary) => {
        if (closed) return;
        if (!isBinary) {
            // Ramka sterująca: klient prosi o domknięcie pliku i CZEKA na potwierdzenie.
            // Bez tego „✅ zapisano" nigdy by do niego nie doszło — socket padłby pierwszy.
            try { if (JSON.parse(data.toString()).type === 'stop') finish(); }
            catch { /* nie-JSON — ignorujemy */ }
            return;
        }
        bytes += data.length;
        out.write(data);
    });

    ws.on('close', finish);
    ws.on('error', finish);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MONTAŻ NA SERWERZE HTTP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wpina oba kanały WebSocket w istniejący serwer HTTP Express.
 * @param {import('http').Server} server serwer zwrócony przez app.listen()
 * @param {{ ffmpegPath: string }} deps
 */
export function attachStudioRelay(server, deps = {}) {
    ffmpegBinary = deps.ffmpegPath || null;

    const wssRtmp     = new WebSocketServer({ noServer: true });
    const wssRecorder = new WebSocketServer({ noServer: true });

    wssRtmp.on('connection', (ws, req) => {
        handleRtmpConnection(ws, new URL(req.url, 'http://127.0.0.1').searchParams)
            .catch((err) => {
                console.error(`[Studio·RTMP] ❌ ${err.message}`);
                state.live = false;
                send(ws, { type: 'error', message: err.message });
                try { ws.close(1011, 'relay error'); } catch { /* noop */ }
            });
    });

    wssRecorder.on('connection', (ws, req) => {
        handleRecorderConnection(ws, new URL(req.url, 'http://127.0.0.1').searchParams)
            .catch((err) => {
                console.error(`[Studio·REC] ❌ ${err.message}`);
                state.recording = false;
                send(ws, { type: 'error', message: err.message });
                try { ws.close(1011, 'recorder error'); } catch { /* noop */ }
            });
    });

    server.on('upgrade', (req, socket, head) => {
        let pathname;
        try { pathname = new URL(req.url, 'http://127.0.0.1').pathname; }
        catch { return socket.destroy(); }

        if (pathname === '/api/rtmp-relay') {
            req.__wsObsluzone = true;
            wssRtmp.handleUpgrade(req, socket, head, (ws) => wssRtmp.emit('connection', ws, req));
        } else if (pathname === '/api/recorder') {
            req.__wsObsluzone = true;
            wssRecorder.handleUpgrade(req, socket, head, (ws) => wssRecorder.emit('connection', ws, req));
        }
        // ⚠️ ŻADNEGO `else socket.destroy()`. Node woła WSZYSTKIE nasłuchy 'upgrade',
        // a od 2026-08-06 drugi kanał (`/api/studio/gosc`, GoscStudioService) wisi
        // na tym samym serwerze. Niszczenie „nieznanych" ścieżek zabijało połączenie
        // gościa, zanim tamten nasłuch zdążył je odebrać. Gniazda niczyje sprząta
        // teraz jeden wspólny strażnik wpięty JAKO OSTATNI w wiesio-bridge.js.
    });

    console.log(`[Studio] 🎥 Kanały WebSocket: /api/rtmp-relay (→ RTMP) | /api/recorder (→ dysk)`);
    console.log(`[Studio] 💾 Nagrania: ${RECORDINGS_DIR}`);
}

export default { attachStudioRelay, getStudioStatus, getRtmpConfig, saveRtmpConfig, RECORDINGS_DIR, DEFAULT_RTMP_URL };
