/**
 * 🔐 CryptoAgility — zwinność kryptograficzna Katedry (Dekret Kwantowy 0.00G).
 *
 * Pozwala przełączać warstwę krypto między klasyczną (AES-256-GCM / RSA-ECDSA)
 * a PRAWDZIWĄ post-kwantową NIST (ML-KEM-768 = Kyber, ML-DSA-65 = Dilithium)
 * przez @noble/post-quantum — jednym wywołaniem. To istota crypto-agility:
 * architektura gotowa na erę kwantową, algorytm wpina się jak moduł.
 *
 * Tryby: 'classical' | 'pqc' | 'hybrid'. Stan w crypto_config.json.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

const MODES = ['classical', 'pqc', 'hybrid'];

class CryptoAgility {
    static _instance = null;
    static getInstance(dir) {
        if (!CryptoAgility._instance) CryptoAgility._instance = new CryptoAgility(dir);
        return CryptoAgility._instance;
    }
    constructor(dir) {
        this.file = path.join(dir || process.cwd(), 'crypto_config.json');
        this.mode = 'classical';
        this._loaded = false;
    }

    async load() {
        if (this._loaded) return this.mode;
        try { const c = JSON.parse(await fs.readFile(this.file, 'utf8')); if (MODES.includes(c.mode)) this.mode = c.mode; } catch { /* domyślnie classical */ }
        this._loaded = true;
        return this.mode;
    }

    async setMode(m) {
        if (!MODES.includes(m)) throw new Error('Tryb musi być: classical | pqc | hybrid.');
        this.mode = m; this._loaded = true;
        await fs.writeFile(this.file, JSON.stringify({ mode: m, updatedAt: Date.now() }, null, 2), 'utf8');
        return m;
    }

    status() {
        return {
            mode: this.mode,
            modes: MODES,
            pqcAvailable: true,
            suite: {
                classical: { kem: 'RSA / ECDH', sym: 'AES-256-GCM', sign: 'RSA / ECDSA', available: true },
                pqc:       { kem: 'ML-KEM-768 (Kyber)', sign: 'ML-DSA-65 (Dilithium)', sym: 'AES-256-GCM', available: true, nist: true },
                hybrid:    { kem: 'ECDH + ML-KEM-768', sign: 'ECDSA + ML-DSA-65', sym: 'AES-256-GCM', available: true },
            },
            library: '@noble/post-quantum',
            note: 'Crypto-agility: przełącz tryb jednym wywołaniem. PQC realne (NIST ML-KEM/ML-DSA).',
        };
    }

    /** Dowód, że wszystko realnie działa (round-tripy). */
    selfTest() {
        const out = {};
        try {
            const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
            const c = crypto.createCipheriv('aes-256-gcm', key, iv);
            const enc = Buffer.concat([c.update('0.00G', 'utf8'), c.final()]); const tag = c.getAuthTag();
            const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
            out.aes256gcm = Buffer.concat([d.update(enc), d.final()]).toString('utf8') === '0.00G';
        } catch { out.aes256gcm = false; }
        try {
            const a = ml_kem768.keygen();
            const { cipherText, sharedSecret } = ml_kem768.encapsulate(a.publicKey);
            const s2 = ml_kem768.decapsulate(cipherText, a.secretKey);
            out.mlkem768 = Buffer.from(sharedSecret).equals(Buffer.from(s2));
        } catch { out.mlkem768 = false; }
        try {
            const k = ml_dsa65.keygen();
            const msg = new TextEncoder().encode('Mistrz Arkadiusz 0.00G');
            const sig = ml_dsa65.sign(msg, k.secretKey);
            out.mldsa65 = ml_dsa65.verify(sig, msg, k.publicKey);
        } catch { out.mldsa65 = false; }
        out.allPass = Object.values(out).every(Boolean);
        return out;
    }
}

export default CryptoAgility;
