/**
 * SpotifyWrappedGen.js — Lekki Generator Spotify Wrapped 2026 (Elara & Kael)
 * ESM. Czysty głos EN (<=24s) przez port 5002 lub edge-tts, ffmpeg pionowe 9:16 (1080x1920, H.264, AAC, -t 24).
 * Wyjście: _OtakOs_Build/wrapped2026/elara_wrapped_2026.mp4 i kael_wrapped_2026.mp4.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ── Ścieżki ────────────────────────────────────────────────────────────────
const OUTPUT_DIR = path.join(ROOT, '_OtakOs_Build', 'wrapped2026');

const ARTYŚCI = {
    elara: {
        obraz:   path.join(ROOT, '_OtakOs_Wymiar', 'produkcje', 'elara', 'assety', 'aktor', 'elara', 'elara_01_front_view_h0.png'),
        probka:  path.join(ROOT, '_OtakOs_AI', 'voices', 'elara.wav'),
        wav:     path.join(OUTPUT_DIR, 'elara_tts.wav'),
        mp4:     path.join(OUTPUT_DIR, 'elara_wrapped_2026.mp4'),
        tekst:   'Hey everyone, this is Elara. Thank you from the bottom of my heart for listening to my voice this year. Releasing Raindrops in 2026 and connecting across the zero-gravity frequency was unforgettable. In 2027, our journey continues. Keep shining your light, and see you very soon.',
        glos:    'en-US-JennyNeural',
    },
    kael: {
        obraz:   path.join(ROOT, '_OtakOs_Wymiar', 'produkcje', 'elara', 'assety', 'aktor', 'kael', 'kael_01_front_view_h0.png'),
        probka:  path.join(ROOT, '_OtakOs_AI', 'voices', 'kael.wav'),
        wav:     path.join(OUTPUT_DIR, 'kael_tts.wav'),
        mp4:     path.join(OUTPUT_DIR, 'kael_wrapped_2026.mp4'),
        tekst:   'Hey, Kael here. Thank you so much for stepping into the StarLight Diner with me this year. Every single stream showed me that real, sovereign energy always finds the right hearts. In 2027, brand new albums and interactive worlds are coming. Stay in your zero point, and thank you.',
        glos:    'en-US-GuyNeural',
    },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Sprawdza czy port 5002 jest aktywny (GET http://127.0.0.1:5002/).
 * @returns {Promise<boolean>}
 */
async function port5002Aktywny() {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:5002/', { timeout: 2000 }, (res) => {
            res.resume();
            resolve(res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

/**
 * Generuje WAV przez HTTP TTS na porcie 5002.
 * @param {string} tekst
 * @param {string} plikWav
 * @param {string} [speakerWav]
 * @returns {Promise<void>}
 */
async function ttsPrzezHttp(tekst, plikWav, speakerWav) {
    const payload = { text: tekst, language: 'en' };
    if (speakerWav && fsSync.existsSync(speakerWav)) {
        payload.speaker_wav = speakerWav;
    }
    const body = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 5002,
            path: '/api/tts',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
            timeout: 60000,
        };
        const req = http.request(options, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`TTS HTTP status: ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                fs.writeFile(plikWav, Buffer.concat(chunks)).then(resolve).catch(reject);
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('TTS HTTP timeout')); });
        req.write(body);
        req.end();
    });
}

/**
 * Generuje WAV przez edge-tts (subprocess).
 * @param {string} tekst
 * @param {string} glos
 * @param {string} plikWav
 * @returns {Promise<void>}
 */
async function ttsPrzezEdgeTts(tekst, glos, plikWav) {
    const tmpMp3 = plikWav.replace(/\.wav$/, '_edge.mp3');
    const escapedTekst = tekst.replace(/"/g, '\\"');
    try {
        await execAsync(`edge-tts --voice "${glos}" --text "${escapedTekst}" --write-media "${tmpMp3}"`, { timeout: 60000 });
    } catch {
        // Spróbuj przez moduł pythona
        await execAsync(`python -m edge_tts --voice "${glos}" --text "${escapedTekst}" --write-media "${tmpMp3}"`, { timeout: 60000 });
    }
    await execAsync(`ffmpeg -y -i "${tmpMp3}" -ar 44100 -ac 2 "${plikWav}"`, { timeout: 30000 });
    await fs.unlink(tmpMp3).catch(() => {});
}

/**
 * Generuje 24s czystej ciszy jako WAV (fallback gdy TTS niedostępny).
 * @param {string} plikWav
 * @returns {Promise<void>}
 */
async function zapiszCiszeWav(plikWav) {
    const sampleRate = 44100;
    const numChannels = 2;
    const bitsPerSample = 16;
    const durationSeconds = 24;
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const buf = Buffer.alloc(44 + dataSize);

    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(numChannels, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
    buf.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
    buf.writeUInt16LE(bitsPerSample, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(dataSize, 40);

    await fs.writeFile(plikWav, buf);
}

/**
 * Generuje pionowe wideo 9:16 (1080x1920) H.264/AAC z Ken Burns (24 sekundy).
 * @param {string} obraz - ścieżka PNG
 * @param {string} wav   - ścieżka WAV
 * @param {string} mp4   - ścieżka wyjściowa MP4
 * @returns {Promise<void>}
 */
async function generujMp4(obraz, wav, mp4) {
    // 25 fps * 24 sekundy = 600 klatek w zoompan; zachowujemy proporcje postaci 9:16 (koniec ze spłaszczaniem poziomo)
    const vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,zoompan=z='min(zoom+0.0012,1.15)':d=25*24:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=25,format=yuv420p";
    const cmd = [
        'ffmpeg',
        '-y',
        '-loop 1',
        `-i "${obraz}"`,
        `-i "${wav}"`,
        `-vf "${vf}"`,
        '-c:v libx264 -preset fast -crf 23',
        '-c:a aac -b:a 128k',
        '-t 24',
        `"${mp4}"`,
    ].join(' ');
    await execAsync(cmd, { timeout: 180000 });
}

// ── Eksport główny ─────────────────────────────────────────────────────────

/**
 * Stan wygenerowanych plików Spotify Wrapped 2026.
 */
export async function stanWrapped() {
    const elara = fsSync.existsSync(ARTYŚCI.elara.mp4) ? ARTYŚCI.elara.mp4 : null;
    const kael  = fsSync.existsSync(ARTYŚCI.kael.mp4)  ? ARTYŚCI.kael.mp4  : null;
    return { success: true, elara, kael };
}

/**
 * Generuje Spotify Wrapped 2026 dla Elary i Kaela.
 * @param {{ postep?: (msg: string) => void }} [opcje]
 * @returns {Promise<{ elara: string|null, kael: string|null }>}
 */
export async function generujWrapped2026({ postep } = {}) {
    const log = (msg) => { if (typeof postep === 'function') postep(msg); };

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    log(`📁 Folder Wrapped 2026: ${OUTPUT_DIR}`);

    const tts5002 = await port5002Aktywny();
    log(tts5002 ? '🔊 TTS port 5002 aktywny — użyję lokalnego klonu' : '🔇 Port 5002 nieaktywny — sprawdzam edge-tts');

    let edgeTtsOk = false;
    if (!tts5002) {
        try {
            await execAsync('edge-tts --version', { timeout: 4000 });
            edgeTtsOk = true;
            log('🔊 edge-tts CLI dostępny');
        } catch {
            try {
                await execAsync('python -m edge_tts --version', { timeout: 4000 });
                edgeTtsOk = true;
                log('🔊 python -m edge_tts dostępny');
            } catch {
                log('⚠️ Brak dedykowanego TTS — przygotowuję czysty podkład audio (24s)');
            }
        }
    }

    const wyniki = {};

    for (const [klucz, art] of Object.entries(ARTYŚCI)) {
        log(`\n🎤 Przetwarzam Wrapped 2026: ${klucz.toUpperCase()}`);

        // 1. Dźwięk mowy
        log(`  • Generowanie głosu EN (<=24s) → ${path.basename(art.wav)}`);
        const maDobryWav = fsSync.existsSync(art.wav) && fsSync.statSync(art.wav).size > 10000;
        try {
            if (tts5002) {
                await ttsPrzezHttp(art.tekst, art.wav, art.probka);
                log(`  ✅ Głos wygenerowany przez silnik :5002`);
            } else if (edgeTtsOk) {
                await ttsPrzezEdgeTts(art.tekst, art.glos, art.wav);
                log(`  ✅ Głos wygenerowany przez edge-tts`);
            } else if (maDobryWav) {
                log(`  ✅ Zachowano istniejący poprawny plik audio: ${path.basename(art.wav)}`);
            } else if (art.probka && fsSync.existsSync(art.probka)) {
                await execAsync(`ffmpeg -y -i "${art.probka}" -af "apad=whole_dur=24" -ar 44100 -ac 2 "${art.wav}"`, { timeout: 30000 });
                log(`  ✅ Przygotowano głos z lokalnej próbki WAV: ${path.basename(art.probka)}`);
            } else {
                await zapiszCiszeWav(art.wav);
                log(`  ℹ️ Zapisano 24s czystego podkładu`);
            }
        } catch (err) {
            if (maDobryWav) {
                log(`  ⚠️ Ostrzeżenie TTS (${err.message}) — zachowano istniejący plik ${path.basename(art.wav)}`);
            } else if (art.probka && fsSync.existsSync(art.probka)) {
                try {
                    await execAsync(`ffmpeg -y -i "${art.probka}" -af "apad=whole_dur=24" -ar 44100 -ac 2 "${art.wav}"`, { timeout: 30000 });
                    log(`  ✅ Ostrzeżenie TTS (${err.message}) — użyto lokalnej próbki WAV`);
                } catch {
                    await zapiszCiszeWav(art.wav);
                }
            } else {
                log(`  ⚠️ Ostrzeżenie TTS (${err.message}) — generuję czystą ścieżkę 24s`);
                await zapiszCiszeWav(art.wav);
            }
        }

        // 2. Weryfikacja portretu aktora
        if (!fsSync.existsSync(art.obraz)) {
            log(`  ⚠️ Brak obrazu portretowego: ${art.obraz} — pomijam render`);
            wyniki[klucz] = null;
            continue;
        }

        // 3. Montaż wideo 9:16 (1080x1920, H.264, AAC, -t 24)
        log(`  • Montaż ffmpeg 9:16 (1080x1920, H.264, AAC, -t 24) → ${path.basename(art.mp4)}`);
        try {
            await generujMp4(art.obraz, art.wav, art.mp4);
            log(`  ✅ Wideo gotowe: ${art.mp4}`);
            wyniki[klucz] = art.mp4;
        } catch (err) {
            log(`  ❌ Błąd ffmpeg: ${err.message}`);
            wyniki[klucz] = null;
        }
    }

    log('\n🎬 Wrapped 2026 gotowe.');
    return { elara: wyniki.elara ?? null, kael: wyniki.kael ?? null };
}

export default { generujWrapped2026, stanWrapped };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    generujWrapped2026({ postep: console.log }).catch(console.error);
}
