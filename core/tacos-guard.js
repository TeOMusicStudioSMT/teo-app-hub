import { exec } from 'child_process';
import fsSync from 'fs';
import path from 'path';

// Helper to load config value from process.env or .env file
function getEnvValue(key, defaultValue) {
    if (process.env[key]) {
        return process.env[key];
    }
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fsSync.existsSync(envPath)) {
            const content = fsSync.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
                if (match && match[1] === key) {
                    let val = match[2].trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    return val;
                }
            }
        }
    } catch (e) {
        // ignore errors
    }
    return defaultValue;
}

// Configuration
// ⚠️ TO JEST LIMIT **VRAM** (pamięci KARTY), nie RAM-u systemowego.
// Dołożenie pamięci do płyty NIC tu nie zmienia — RTX 3060 Laptop ma 6 GB i tyle
// zostaje. Próg 300 MB był absurdalnie niski: przekracza go dosłownie każdy
// program dotykający GPU. Po naprawieniu whitelisty strażnik i tak pilnuje już
// tylko procesów NIEZNANYCH, więc 2 GB jest rozsądniejszym progiem „coś tu żre
// kartę, a nie wiem co". Nadpisuje TACOS_GUARD_LIMIT_MB.
const VRAM_LIMIT_MB = parseInt(getEnvValue('TACOS_GUARD_LIMIT_MB', '2000'), 10);

/**
 * ⚠️ WHITELISTA BYLA ZA WASKA — I TO BYLA MINA.
 *
 * Straznik co 30 s robi `taskkill /F` KAZDEMU procesowi GPU powyzej limitu, ktory
 * nie jest na tej liscie. Poprzednia lista miala tylko: ollama, cursor, dwm,
 * explorer, nvcontainer. NIE BYLO NA NIEJ:
 *   · python.exe      → ComfyUI, czyli SILNIK TeO Music V2
 *   · UnrealEditor    → Game Forge / TGS
 *   · chrome/chromium → render HyperFrames (App V2, Story V2) leci headless Chrome
 *   · ffmpeg          → kodowanie wideo i audio
 * Kazdy z nich przekracza 300 MB VRAM bez wysilku. „ComfyUI samo sie zamknelo"
 * albo „UE padlo w trakcie buildu" mialo tu swoje zrodlo, bez sladu w logach apki.
 *
 * Liste nadpisuje TACOS_GUARD_WHITELIST (po przecinku), a calego straznika
 * wylacza TACOS_GUARD=off.
 */
const WHITELIST_DOMYSLNA = [
    'ollama', 'cursor', 'dwm.exe', 'explorer.exe', 'nvcontainer.exe',
    'python', 'pythonw', 'unrealeditor', 'ue4editor', 'ue5editor',
    'chrome', 'chromium', 'msedge', 'node', 'ffmpeg',
];
const WHITELIST = getEnvValue('TACOS_GUARD_WHITELIST', '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const LISTA = WHITELIST.length ? WHITELIST : WHITELIST_DOMYSLNA;

const STRAZNIK_WLACZONY = String(getEnvValue('TACOS_GUARD', 'on')).toLowerCase() !== 'off';

let isMonitoringActive = true;

/**
 * Checks nvidia-smi and launches VRAM guard if available.
 */
export function initTacosGuard() {
    if (!STRAZNIK_WLACZONY) {
        console.log('[33m%s[0m', '[TACOS GUARD] Wylaczony (TACOS_GUARD=off). Zaden proces GPU nie bedzie ubijany.');
        isMonitoringActive = false;
        return;
    }
    exec('nvidia-smi -h', (err) => {
        if (err) {
            console.log('\x1b[33m%s\x1b[0m', '[TACOS GUARD] Warning: nvidia-smi not found. VRAM monitoring disabled.');
            isMonitoringActive = false;
            return;
        }

        console.log(`[TACOS GUARD] Sentinel initialized. VRAM Limit: ${VRAM_LIMIT_MB}MB. Whitelist: ${LISTA.join(', ')}`);
        
        // Run once immediately
        executeTacosGuard();
        // Schedule every 30 seconds
        setInterval(executeTacosGuard, 30000);
    });
}

/**
 * Performs check and execution
 */
export function executeTacosGuard() {
    if (!isMonitoringActive) return;

    exec('nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader', (err, stdout) => {
        if (err) {
            // Silently ignore runtime errors of nvidia-smi to avoid spamming logs
            return;
        }

        const output = stdout.trim();
        if (!output) return;

        const lines = output.split('\n');
        lines.forEach(line => {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length < 3) return;

            const [pid, name, memoryStr] = parts;
            const memMB = parseInt(memoryStr.replace(/[^0-9]/g, ''), 10);

            if (isNaN(memMB)) return;

            // Check if process name contains any of whitelisted strings (case-insensitive)
            const nameLower = name.toLowerCase();
            const isWhitelisted = LISTA.some(item => nameLower.includes(item));

            if (!isWhitelisted && memMB > VRAM_LIMIT_MB) {
                console.log(`[TACOS GUARD] Wykryto delikwenta: ${name} (PID: ${pid}) pożera ${memMB}MB VRAM!`);

                exec(`taskkill /F /PID ${pid}`, (killErr) => {
                    if (killErr) {
                        console.error(`[TACOS GUARD] ❌ Błąd przy tacosowaniu procesu ${pid}:`, killErr.message);
                    } else {
                        console.log(`[TACOS GUARD] 🔥 Użytkownik ${name} został pomyślnie TACOS-OWANY.`);
                    }
                });
            }
        });
    });
}
