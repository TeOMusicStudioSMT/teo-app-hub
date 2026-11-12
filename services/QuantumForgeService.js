/**
 * ⚛️ QuantumForgeService — Pieczęć Suwerena & Rejestr Graviton (Anti-Scalp / Proof-of-Origin)
 *
 * Rejestruje każde dzieło wytworzone w Katedrze OtakOS (kod, aplikacje, audio, wideo).
 * Wylicza kryptograficzny hash SHA-256 oraz podpis HMAC przy użyciu klucza ze Skarbca.
 * Zapisuje rejestr w `_OtakOs_Wymiar/graviton_registry.json` i dopisuje ślad do księgi `biznesy.json`.
 *
 * Standard ESM · Zapis atomowy (tmp → rename).
 */

import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import VaultService from './VaultService.js';
import { zapiszZdarzenie as biznesZapiszZdarzenie } from './BiznesService.js';

const ANTIGRAVITY_DIR = path.join(process.cwd(), '_OtakOs_Wymiar');
const REGISTRY_FILE = path.join(ANTIGRAVITY_DIR, 'graviton_registry.json');
const NODES_FILE = path.join(ANTIGRAVITY_DIR, 'graviton_nodes.json');

export const STABILITY_CLASSES = {
    IMPULSE: { label: 'IMPULSE', desc: 'Tymczasowy impuls / sygnał (dawniej FLASH)', color: '#facc15' },
    FLUID:   { label: 'FLUID',   desc: 'Płynna materia: audio, wideo, media',       color: '#60a5fa' },
    STABLE:  { label: 'STABLE',  desc: 'Trwałe oprogramowanie, aplikacje, narzędzia', color: '#34d399' },
    GENESIS: { label: 'GENESIS', desc: 'Fundament Katedry OtakOS (niezmienny)',     color: '#a855f7' },
};

export const AUTHOR_DEFAULT = 'Sovereign TeO — teo.center / otakos.wtf';

async function ensureRegistryDir() {
    if (!fsSync.existsSync(ANTIGRAVITY_DIR)) {
        await fs.mkdir(ANTIGRAVITY_DIR, { recursive: true });
    }
}

/** Pobiera klucz do podpisu HMAC ze Skarbca 0.00G (lub tworzy bezpieczny lokalny .genesis_seal). */
async function getSigningSecret() {
    try {
        const vault = VaultService.getInstance();
        const stored = await vault.getSecret('genesis', 'teo_genesis_signature');
        if (stored) return stored;
    } catch {}

    const sealPath = path.join(process.cwd(), '.vault-0.00g', '.genesis_seal');
    try {
        const key = await fs.readFile(sealPath, 'utf8');
        if (key && key.trim()) return key.trim();
    } catch {}

    const newKey = crypto.randomBytes(32).toString('hex');
    try {
        await fs.mkdir(path.dirname(sealPath), { recursive: true });
        await fs.writeFile(sealPath, newKey, { encoding: 'utf8', mode: 0o600 });
        console.log('[QuantumForge] 🗝️  Zainicjalizowano lokalny klucz Pieczęci Suwerena (.genesis_seal).');
    } catch {}
    return newKey;
}

/** Wczytuje rejestr z pliku graviton_registry.json. Jeśli plik jest pusty, importuje węzły z graviton_nodes.json. */
async function readRegistry() {
    await ensureRegistryDir();
    try {
        const raw = await fs.readFile(REGISTRY_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch {}

    // Inicjalizacja z graviton_nodes.json jeśli istnieje
    let initial = [];
    try {
        if (fsSync.existsSync(NODES_FILE)) {
            const nodesRaw = await fs.readFile(NODES_FILE, 'utf8');
            const nodes = JSON.parse(nodesRaw);
            if (Array.isArray(nodes)) {
                const secret = await getSigningSecret();
                initial = nodes.map(n => {
                    const stab = n.stability === 'FLASH' ? 'IMPULSE' : (n.stability || 'FLUID');
                    const hash = crypto.createHash('sha256').update(`${n.id}:${n.name}:${n.type}`).digest('hex');
                    const sig = crypto.createHmac('sha256', secret).update(`${hash}:${n.name}:${AUTHOR_DEFAULT}:0.00G`).digest('hex');
                    return {
                        grv_token_id: n.id?.startsWith('GRV-') ? n.id : `GRV-GEN-${hash.slice(0, 8).toUpperCase()}`,
                        name: n.name || 'Zasób Katedry',
                        type: n.type || 'IMAGE',
                        stabilityClass: stab,
                        sha256: hash,
                        signature: sig,
                        author: AUTHOR_DEFAULT,
                        origin: 'Katedra OtakOS (0.00G)',
                        canonicalUrl: 'https://teo.center',
                        antiScalpProtection: {
                            enabled: true,
                            status: 'PROTECTED',
                            license: 'TeO Sovereign License (Anti-Scalp / Non-Derivative Without Tribute)',
                            proofOfOrigin: 'GENESIS-STAMP-TEO-0.00G',
                            canonicalUrl: 'https://teo.center',
                            verificationEndpoint: '/api/forge/verify',
                        },
                        filePath: n.content || n.fileName || null,
                        sizeBytes: 0,
                        timestamp: n.timestamp || Date.now(),
                        isoDate: new Date(n.timestamp || Date.now()).toISOString(),
                        metadata: { legacyMigrated: true },
                    };
                });
                await writeRegistry(initial);
                console.log(`[QuantumForge] 📜 Zaimportowano ${initial.length} węzłów do graviton_registry.json.`);
                return initial;
            }
        }
    } catch (e) {
        console.warn('[QuantumForge] Inicjalizacja z węzłów:', e.message);
    }

    return [];
}

/** Atomowy zapis do pliku rejestru. */
async function writeRegistry(list) {
    await ensureRegistryDir();
    const tmp = `${REGISTRY_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
    await fs.rename(tmp, REGISTRY_FILE);
}

/** Dołącza nowy rekord do graviton_registry.json */
async function appendRegistry(record) {
    const list = await readRegistry();
    list.push(record);
    await writeRegistry(list);
}

/** Dołącza rekord do graviton_nodes.json dla wstecznej kompatybilności */
async function appendLegacyNodes(record) {
    try {
        await ensureRegistryDir();
        let existing = [];
        try {
            if (fsSync.existsSync(NODES_FILE)) {
                existing = JSON.parse(await fs.readFile(NODES_FILE, 'utf8'));
                if (!Array.isArray(existing)) existing = [];
            }
        } catch {}

        const legacyNode = {
            id: record.grv_token_id,
            name: record.name,
            content: record.filePath || record.name,
            type: record.type,
            stability: record.stabilityClass === 'IMPULSE' ? 'FLASH' : record.stabilityClass,
            mode: 'just',
            timestamp: record.timestamp,
            timestamp_start: record.timestamp,
            timestamp_mid: record.timestamp,
            timestamp_end: record.timestamp,
            fileName: record.filePath || `${record.name}.asset`,
            ownerAddress: '0xSOVEREIGN_TEO',
        };

        existing.push(legacyNode);
        const tmp = `${NODES_FILE}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(existing, null, 2), 'utf8');
        await fs.rename(tmp, NODES_FILE);
    } catch (e) {
        console.warn('[QuantumForge] Sync legacy nodes:', e.message);
    }
}

/**
 * Główna metoda mintująca zasób i nadająca Pieczęć Suwerena.
 */
export async function mintAsset({
    name,
    type = 'CODE',
    stabilityClass = 'STABLE',
    filePath = null,
    content = null,
    metadata = {},
    author = AUTHOR_DEFAULT,
}) {
    if (!name || !String(name).trim()) throw new Error('Nazwa assetu jest wymagana.');

    // Normalizacja stabilności
    let stab = String(stabilityClass || 'STABLE').toUpperCase();
    if (stab === 'FLASH') stab = 'IMPULSE';
    if (!STABILITY_CLASSES[stab]) stab = 'STABLE';

    // Normalizacja typu
    let typ = String(type || 'CODE').toUpperCase();
    if (!['VIDEO', 'IMAGE', 'AUDIO', 'CODE'].includes(typ)) typ = 'CODE';

    // Obliczanie SHA-256
    let hash = '';
    let sizeBytes = 0;
    if (content !== null && content !== undefined) {
        const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
        sizeBytes = buf.length;
        hash = crypto.createHash('sha256').update(buf).digest('hex');
    } else if (filePath && fsSync.existsSync(filePath)) {
        const buf = await fs.readFile(filePath);
        sizeBytes = buf.length;
        hash = crypto.createHash('sha256').update(buf).digest('hex');
    } else {
        const seed = `${name}:${typ}:${stab}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
        hash = crypto.createHash('sha256').update(seed).digest('hex');
    }

    // Podpis HMAC SHA-256
    const secretKey = await getSigningSecret();
    const signature = crypto.createHmac('sha256', secretKey)
        .update(`${hash}:${name}:${author}:0.00G`)
        .digest('hex');

    const tokenId = `GRV-GEN-${hash.slice(0, 8).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const now = Date.now();

    const record = {
        grv_token_id: tokenId,
        name: String(name).trim(),
        type: typ,
        stabilityClass: stab,
        sha256: hash,
        signature,
        author,
        origin: 'Katedra OtakOS (0.00G)',
        canonicalUrl: 'https://teo.center',
        antiScalpProtection: {
            enabled: true,
            status: 'PROTECTED',
            license: 'TeO Sovereign License (Anti-Scalp / Non-Derivative Without Tribute)',
            proofOfOrigin: 'GENESIS-STAMP-TEO-0.00G',
            canonicalUrl: 'https://teo.center',
            verificationEndpoint: '/api/forge/verify',
        },
        filePath: filePath ? String(filePath) : null,
        sizeBytes,
        timestamp: now,
        isoDate: new Date(now).toISOString(),
        metadata: metadata || {},
    };

    // Zapis do graviton_registry.json i graviton_nodes.json
    await appendRegistry(record);
    await appendLegacyNodes(record);

    // Zapis zdarzenia do księgi biznesu (/api/business/ledger)
    try {
        const grvAward = stab === 'GENESIS' ? 100 : (stab === 'STABLE' ? 50 : (stab === 'FLUID' ? 20 : 10));
        await biznesZapiszZdarzenie(ANTIGRAVITY_DIR, {
            biznesId: 'quantum-forge',
            akcja: 'zamowienie.zlozone',
            klucz: `forge:mint:${tokenId}`,
            opis: `Pieczęć Suwerena (Anti-Scalp): ${record.name} [${typ}/${stab}] → ${tokenId}`,
            klient: author,
            grv: grvAward,
            przyznane: true,
            powod: 'Quantum Forge — Pieczęć Suwerena',
        });
    } catch (e) {
        console.warn('[QuantumForge] ⚠️ Nie udało się dopisać do ledgeru:', e.message);
    }

    console.log(`[QuantumForge] ⚛️  Stokenizowano zasób: ${record.name} (${tokenId}) [${typ}/${stab}] — Pieczęć Anti-Scalp aktywna.`);
    return record;
}

/** Zwraca listę wszystkich rekordów w kolejności od najnowszych. */
export async function getRegistry() {
    const list = await readRegistry();
    return list.slice().reverse();
}

/** Weryfikuje zasób po hashu, tokenie lub zawartości. */
export async function verifyAsset({ hash, tokenId, grvTokenId, content, filePath }) {
    const queryToken = tokenId || grvTokenId;
    const list = await readRegistry();
    let targetHash = hash ? String(hash).toLowerCase() : null;

    if (!targetHash) {
        if (content !== null && content !== undefined) {
            targetHash = crypto.createHash('sha256').update(String(content)).digest('hex').toLowerCase();
        } else if (filePath && fsSync.existsSync(filePath)) {
            const buf = await fs.readFile(filePath);
            targetHash = crypto.createHash('sha256').update(buf).digest('hex').toLowerCase();
        }
    }

    const matched = list.find(r => 
        (targetHash && r.sha256?.toLowerCase() === targetHash) ||
        (queryToken && (r.grv_token_id === queryToken || r.grv_token_id?.toLowerCase() === String(queryToken).toLowerCase()))
    );

    if (!matched) {
        return {
            verified: false,
            original: false,
            token: null,
            message: 'Zasób nie figuruje w Rejestrze Genezy Katedry OtakOS. Brak oryginalnej Pieczęci Suwerena.',
        };
    }

    // Weryfikacja sygnatury HMAC
    const secretKey = await getSigningSecret();
    const expectedSig = crypto.createHmac('sha256', secretKey)
        .update(`${matched.sha256}:${matched.name}:${matched.author}:0.00G`)
        .digest('hex');

    const signatureValid = (matched.signature === expectedSig);

    return {
        verified: signatureValid,
        original: true,
        signatureValid,
        token: matched,
        message: signatureValid
            ? `✓ Potwierdzono autentyczność Pieczęci Suwerena (${matched.grv_token_id}). Pochodzenie: teo.center.`
            : `⚠️ Wykryto modyfikację podpisu dla tokenu ${matched.grv_token_id}.`,
    };
}

/**
 * Wstrzykuje nagłówek kryptograficzny oraz mikro-strażnika pochodzenia (Origin Guard)
 * do kodu generowanego przez App Studio / Kodeks.
 */
export function injectOriginGuard(code, { name = 'App', tokenId = 'GRV-GEN-ORIGIN', hash = '0.00G', isTs = true } = {}) {
    if (!code || typeof code !== 'string') return code;
    if (code.includes('TEO GENESIS ORIGIN GUARD')) return code;

    const tsCast = isTs ? ' as any' : '';

    const guardHeader = `/**
 * 🛡️ TEO GENESIS ORIGIN GUARD — ANTI-SCALP & PROOF-OF-ORIGIN
 * Sovereign Creator: Sovereign TeO (https://teo.center / https://otakos.wtf)
 * Asset: ${name}
 * Token ID: ${tokenId}
 * Genesis Hash: ${hash}
 * Stamp: GENESIS-STAMP-TEO-0.00G (0.00G Live-USB Cathedral)
 *
 * This asset is cryptographically anchored in the OtakOS Cathedral.
 * Unlicensed copying, scraping, or removing creator attribution is prohibited.
 */
if (typeof window !== 'undefined') {
    try {
        const _w = (window${tsCast});
        if (!_w.__TEO_GENESIS_ORIGIN__) {
            _w.__TEO_GENESIS_ORIGIN__ = {
                creator: 'Sovereign TeO — teo.center',
                asset: '${name}',
                tokenId: '${tokenId}',
                stamp: 'GENESIS-STAMP-TEO-0.00G',
                verified: true,
            };
            console.log('🏛️ [TeO Genesis] Proof-of-Origin active: teo.center (${tokenId})');
        }
    } catch (_) {}
}
`;

    return guardHeader + '\n' + code;
}

export async function autoMintMedia({ name, type = 'VIDEO', filePath, stabilityClass = 'FLUID', metadata = {} }) {
    try {
        if (!filePath || !fsSync.existsSync(filePath)) return null;
        const baseName = name || path.basename(filePath);
        return await mintAsset({
            name: baseName,
            type,
            stabilityClass,
            filePath,
            metadata: {
                ...metadata,
                autoMinted: true,
                autoMintSource: 'wiesio-bridge-pipeline',
            },
        });
    } catch (e) {
        console.warn('[QuantumForge] ⚠️ Auto-mint media error:', e.message);
        return null;
    }
}

export default {
    mintAsset,
    getRegistry,
    verifyAsset,
    injectOriginGuard,
    autoMintMedia,
    STABILITY_CLASSES,
    AUTHOR_DEFAULT,
};
