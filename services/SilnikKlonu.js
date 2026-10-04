/**
 * 🎙️ Silnik klonu głosu (XTTS na :5002) — most sam go odpala, gdy go nie ma, a Katedra ma go zainstalowanego.
 *
 * Instaluje go START_KATEDRA.bat (`_OtakOs_AI/voice_env` + `voice_server.py`). Kto odpala most ręcznie
 * (`node wiesio-bridge.js`), dotąd zostawał bez klonu. Tu NIC się nie instaluje: brak voice_server.py
 * albo środowiska = uczciwy powód w `stan()`, nie atrapa. Wyłącz: OTAKOS_GLOS_AUTOSTART=0
 * (launcher ustawia to sam, gdy odpalił silnik).
 */
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const stan = { uruchomiony: false, powod: 'jeszcze nie sprawdzano', pid: null };

const pythonSrodowiska = (aiDir) => [path.join(aiDir, 'voice_env', 'Scripts', 'python.exe'), path.join(aiDir, 'voice_env', 'bin', 'python')].find((p) => fsSync.existsSync(p)) ?? null;

async function odpowiada(base) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 1500);
    try { await fetch(`${base}/`, { signal: c.signal }); return true; } catch { return false; } finally { clearTimeout(t); }
}

/** Odpala silnik, jeśli nie odpowiada i da się go uruchomić. Zwraca stan (też z powodem, gdy się nie da). */
export async function zapewnij({ aiDir, base, log = console.log, spawnFn = spawn } = {}) {
    if (process.env.OTAKOS_GLOS_AUTOSTART === '0') return Object.assign(stan, { powod: 'wyłączony (OTAKOS_GLOS_AUTOSTART=0)' });
    if (await odpowiada(base)) return Object.assign(stan, { uruchomiony: true, powod: 'już działa' });
    if (stan.pid) return stan;   // już go odpaliliśmy, ładuje model
    const serwer = path.join(aiDir, 'voice_server.py');
    const python = pythonSrodowiska(aiDir);
    if (!fsSync.existsSync(serwer)) return Object.assign(stan, { powod: `brak ${serwer} — silnik instaluje START_KATEDRA.bat` });
    if (!python) return Object.assign(stan, { powod: 'brak _OtakOs_AI/voice_env — uruchom START_KATEDRA.bat (pierwsza instalacja XTTS)' });
    try {
        const p = spawnFn(python, [serwer], { cwd: aiDir, detached: true, stdio: 'ignore', windowsHide: true });
        p.on?.('error', (e) => { stan.pid = null; stan.powod = `nie wystartował: ${e.message}`; });
        p.on?.('exit', (kod) => { stan.pid = null; stan.uruchomiony = false; stan.powod = `zakończył się (kod ${kod})`; });
        p.unref?.();
        stan.pid = p.pid ?? null; stan.powod = 'odpalony przez most (ładuje model, to chwilę trwa)';
        log(`🎙️ Silnik klonu głosu odpalony przez most (pid ${stan.pid}).`);
    } catch (e) { stan.powod = `nie wystartował: ${e.message}`; }
    return stan;
}

export const stanSilnika = () => ({ ...stan });
export default { zapewnij, stanSilnika };
