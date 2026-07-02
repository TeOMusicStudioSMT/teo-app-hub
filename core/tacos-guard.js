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
const VRAM_LIMIT_MB = parseInt(getEnvValue('TACOS_GUARD_LIMIT_MB', '300'), 10);
const WHITELIST = ['ollama', 'cursor', 'dwm.exe', 'explorer.exe', 'nvcontainer.exe'];

let isMonitoringActive = true;

/**
 * Checks nvidia-smi and launches VRAM guard if available.
 */
export function initTacosGuard() {
    exec('nvidia-smi -h', (err) => {
        if (err) {
            console.log('\x1b[33m%s\x1b[0m', '[TACOS GUARD] Warning: nvidia-smi not found. VRAM monitoring disabled.');
            isMonitoringActive = false;
            return;
        }

        console.log(`[TACOS GUARD] Sentinel initialized. VRAM Limit: ${VRAM_LIMIT_MB}MB. Whitelist: ${WHITELIST.join(', ')}`);
        
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
            const isWhitelisted = WHITELIST.some(item => nameLower.includes(item.toLowerCase()));

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
