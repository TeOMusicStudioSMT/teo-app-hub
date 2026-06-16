/**
 * 🧯 FlushService — Reaktor Flush-Core (sekwencyjne czyszczenie zasobów)
 *
 * Realizuje flushSystemResources(): bezpieczne, etapowe sprzątanie zasobów OtakOS:
 *   ETAP 1 — Integralność Skarbca (reużycie zweryfikowanego VaultService AES-256-GCM;
 *            NIE duplikujemy logiki kryptograficznej).
 *   ETAP 2 — Temp logi (*.log, ts_errors.log, *.tmp).
 *   ETAP 3 — Stare kopie .bak (Mechanik / ręczne edycje) starsze niż próg wieku.
 *   ETAP 4 — Stare patche w _AntiGravity_Wymiar/patches starsze niż próg.
 *   ETAP 5 — Reset sieci APILayer (cache + liczniki free-plan) → sterylność połączeń.
 *
 * Bezpieczeństwo:
 *   - Tylko ścieżki WEWNĄTRZ projektu (guard path-traversal).
 *   - Tylko wzorce temp/.bak/.tmp/patch — NIGDY kod źródłowy.
 *   - Próg wieku chroni przed kasowaniem świeżego backupu trwającego apply.
 *   - Tryb dryRun: zwraca listę "do usunięcia" bez kasowania.
 *
 * Standard ESM · Singleton-free (czysta funkcja + helpery).
 */

import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import VaultService from './VaultService.js';
import ApiLayerService from './ApiLayerService.js';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const ANTIGRAVITY  = path.join(PROJECT_ROOT, '_AntiGravity_Wymiar');
const PATCHES_DIR  = path.join(ANTIGRAVITY, 'patches');

// Płytkie katalogi do skanu temp/.bak (bez rekurencji w node_modules itp.)
const SCAN_DIRS = ['', 'components', 'components/special', 'services', 'lib', 'context', 'hooks', 'logs', '_temp'];
const TEMP_PATTERNS = [/\.log$/i, /\.tmp$/i];
const BAK_PATTERN   = /\.bak$/i;

/** Czy ścieżka leży bezpiecznie w obrębie projektu? */
function isInsideProject(p) {
    const abs = path.resolve(p);
    return abs.startsWith(path.resolve(PROJECT_ROOT));
}

/** Usuń pojedynczy plik, łagodnie obsługując ENOENT. */
async function safeDelete(filePath, removed, errors, dryRun) {
    if (!isInsideProject(filePath)) {
        errors.push({ file: filePath, error: 'poza projektem — pominięto' });
        return;
    }
    const rel = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
    try {
        if (!dryRun) await fs.unlink(filePath);
        removed.push(rel);
    } catch (e) {
        if (e.code === 'ENOENT') return;            // już nie istnieje — OK
        errors.push({ file: rel, error: e.message }); // EACCES / EBUSY itp.
    }
}

/** Płytki listing plików katalogu (bez wchodzenia w podkatalogi). */
async function listFiles(dirAbs) {
    try {
        const entries = await fs.readdir(dirAbs, { withFileTypes: true });
        return entries.filter(e => e.isFile()).map(e => path.join(dirAbs, e.name));
    } catch {
        return [];
    }
}

/**
 * Pełny, sekwencyjny cykl czyszczenia.
 * @param {{ dryRun?: boolean, maxAgeHours?: number }} [opts]
 * @returns {Promise<{ success, dryRun, stages, removed, errors, vault }>}
 */
export async function flushSystemResources(opts = {}) {
    const dryRun      = opts.dryRun === true;
    const maxAgeHours = Number.isFinite(opts.maxAgeHours) ? opts.maxAgeHours : 24;
    const ageCutoff   = Date.now() - maxAgeHours * 3600_000;

    const removed = [];
    const errors  = [];
    const stages  = [];

    console.log(`[FlushService] 🔄 Reaktor Flush-Core: start (dryRun=${dryRun}, maxAgeHours=${maxAgeHours}).`);

    // ── ETAP 1: Integralność Skarbca (reużycie VaultService — bez duplikacji) ──
    let vault = { ok: false };
    try {
        const status = await VaultService.getInstance().getStatus();
        vault = { ok: true, services: status.length, connected: status.filter(s => s.connected).length };
        stages.push(`ETAP 1 — Skarbiec OK (${vault.connected}/${vault.services} drożnych)`);
    } catch (e) {
        vault = { ok: false, error: e.message };
        stages.push(`ETAP 1 — Skarbiec: ostrzeżenie (${e.message})`);
    }

    // ── ETAP 2: Temp logi + .tmp ──────────────────────────────────────────────
    let tempCount = 0;
    for (const dir of SCAN_DIRS) {
        const files = await listFiles(path.join(PROJECT_ROOT, dir));
        for (const f of files) {
            if (TEMP_PATTERNS.some(rx => rx.test(path.basename(f)))) {
                const before = removed.length;
                await safeDelete(f, removed, errors, dryRun);
                if (removed.length > before) tempCount++;
            }
        }
    }
    stages.push(`ETAP 2 — Temp logi/.tmp: ${tempCount}`);

    // ── ETAP 3: Stare kopie .bak (starsze niż próg) ───────────────────────────
    let bakCount = 0;
    for (const dir of SCAN_DIRS) {
        const files = await listFiles(path.join(PROJECT_ROOT, dir));
        for (const f of files) {
            if (!BAK_PATTERN.test(path.basename(f))) continue;
            try {
                const st = await fs.stat(f);
                if (st.mtimeMs > ageCutoff) continue; // za świeży — chroń trwający apply
            } catch { continue; }
            const before = removed.length;
            await safeDelete(f, removed, errors, dryRun);
            if (removed.length > before) bakCount++;
        }
    }
    stages.push(`ETAP 3 — Stare .bak (>${maxAgeHours}h): ${bakCount}`);

    // ── ETAP 4: Stare patche Mechanika ────────────────────────────────────────
    let patchCount = 0;
    const patchFiles = await listFiles(PATCHES_DIR);
    for (const f of patchFiles) {
        if (!/\.md$/i.test(path.basename(f))) continue;
        try {
            const st = await fs.stat(f);
            if (st.mtimeMs > ageCutoff) continue;
        } catch { continue; }
        const before = removed.length;
        await safeDelete(f, removed, errors, dryRun);
        if (removed.length > before) patchCount++;
    }
    stages.push(`ETAP 4 — Stare patche (>${maxAgeHours}h): ${patchCount}`);

    // ── ETAP 5: Reset sieci APILayer (cache + liczniki free-plan) ─────────────
    // Przywraca pełną sterylność połączeń: czyści cache, zeruje limity, odblokowuje.
    let network = { cacheCleared: 0, unblocked: false };
    if (dryRun) {
        const st = await ApiLayerService.getInstance().getStatus();
        network = { cacheCleared: st.cacheSize, unblocked: st.blocked, dryRun: true };
        stages.push(`ETAP 5 — APILayer (podgląd): cache ${st.cacheSize}, zablokowany=${st.blocked}`);
    } else {
        try {
            network = ApiLayerService.getInstance().resetNetwork();
            stages.push(`ETAP 5 — Reset APILayer: cache ${network.cacheCleared} wyczyszczony, liczniki wyzerowane, ruch odblokowany`);
        } catch (e) {
            errors.push({ file: 'apilayer-reset', error: e.message });
            stages.push(`ETAP 5 — Reset APILayer: błąd (${e.message})`);
        }
    }

    console.log(`[FlushService] ✅ Flush ${dryRun ? '(dryRun) ' : ''}zakończony: ${removed.length} plików, ${errors.length} błędów.`);

    return {
        success: errors.length === 0,
        dryRun,
        maxAgeHours,
        stages,
        removedCount: removed.length,
        removed,
        errors,
        vault,
        network,
    };
}

export default { flushSystemResources };
