/**
 * 🔐 VaultService — Skarbiec 0.00G (Fizyczna Izolacja Lokalna)
 *
 * Czyta i zapisuje ZASZYFROWANE klucze (GitHub token, Ollama cloud, Voice Cloning)
 * WYŁĄCZNIE z lokalnego folderu .vault-0.00g/ — bezwzględnie poza repozytorium
 * (wpisany do .gitignore). Klucze nigdy nie wychodzą do frontu w formie surowej —
 * getStatus() zwraca tylko maski i poziom bezpieczeństwa.
 *
 * Szyfrowanie: AES-256-GCM. Klucz master (32 B) generowany raz, lokalnie
 * (.vault-0.00g/.master, mode 600). Zapis atomowy (tmp → rename).
 *
 * Standard ESM · Singleton.
 */

import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const VAULT_DIR    = path.join(PROJECT_ROOT, '.vault-0.00g');
const VAULT_FILE   = path.join(VAULT_DIR, 'vault.enc');
const MASTER_FILE  = path.join(VAULT_DIR, '.master');
const ALGO         = 'aes-256-gcm';

// ── Katalog znanych usług (dla wizualnego kokpitu) ─────────────────────────────
export const SERVICE_CATALOG = {
    github_bridge:    { label: 'GitHub Bridge',         fields: ['token'],              security: 'CRITICAL', glyph: '🐙' },
    ollama_ecosystem: { label: 'Ollama Ecosystem',      fields: ['cloud_key'],          security: 'HIGH',     glyph: '🦙' },
    voice_cloning:    { label: 'Voice Cloning Vector',  fields: ['api_key'],            security: 'HIGH',     glyph: '🎙️' },
    apilayer_gateway: { label: 'APILayer Gateway',      fields: ['apilayer_free_key'],  security: 'HIGH',     glyph: '🌐' },
    anthropic:        { label: 'Klaudiusz (Anthropic)', fields: ['api_key'],            security: 'CRITICAL', glyph: '🧠' },
    gemini:           { label: 'Gemini (Google)',       fields: ['api_key'],            security: 'HIGH',     glyph: '✦' },
    // ── Przewody Voice/Audio modułu „Twoje Biznesy" (GlosMcpService) ──
    // Wpisane tu, żeby panel mógł UCZCIWIE odpowiedzieć „klucza nie ma",
    // zamiast zgadywać po zmiennych środowiskowych.
    elevenlabs:       { label: 'ElevenLabs (klon głosu)', fields: ['api_key'],          security: 'HIGH',     glyph: '🧬' },
    twilio:           { label: 'Twilio (telefonia AI)',   fields: ['account_sid', 'auth_token', 'from_number'], security: 'CRITICAL', glyph: '☎️' },
};

class VaultServiceClass {
    constructor() {
        console.log('[VaultService] 🔐 Skarbiec 0.00G zainicjalizowany (izolacja: .vault-0.00g/).');
    }

    async _ensureDir() {
        await fs.mkdir(VAULT_DIR, { recursive: true });
    }

    /** Klucz master — generowany raz, trzymany lokalnie poza repo. */
    async _getMasterKey() {
        await this._ensureDir();
        try {
            const b64 = await fs.readFile(MASTER_FILE, 'utf8');
            return Buffer.from(b64.trim(), 'base64');
        } catch {
            const key = crypto.randomBytes(32);
            await fs.writeFile(MASTER_FILE, key.toString('base64'), { encoding: 'utf8', mode: 0o600 });
            console.log('[VaultService] 🗝️  Wygenerowano nowy klucz master.');
            return key;
        }
    }

    async _readVault() {
        try {
            const raw = await fs.readFile(VAULT_FILE, 'utf8');
            const { iv, tag, data } = JSON.parse(raw);
            const key      = await this._getMasterKey();
            const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(iv, 'base64'));
            decipher.setAuthTag(Buffer.from(tag, 'base64'));
            const dec = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
            return JSON.parse(dec.toString('utf8'));
        } catch (e) {
            if (e.code === 'ENOENT') return { services: {} };
            console.warn('[VaultService] ⚠️  Odczyt skarbca:', e.message);
            return { services: {} };
        }
    }

    async _writeVault(vault) {
        await this._ensureDir();
        const key    = await this._getMasterKey();
        const iv     = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGO, key, iv);
        const enc    = Buffer.concat([cipher.update(JSON.stringify(vault), 'utf8'), cipher.final()]);
        const tag    = cipher.getAuthTag();
        const payload = {
            iv:        iv.toString('base64'),
            tag:       tag.toString('base64'),
            data:      enc.toString('base64'),
            updatedAt: new Date().toISOString(),
        };
        const tmp = VAULT_FILE + '.tmp';
        await fs.writeFile(tmp, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
        await fs.rename(tmp, VAULT_FILE);
    }

    /** Zapisz/zaktualizuj pojedynczy sekret usługi. */
    async setSecret(service, field, value) {
        if (!service || !field || value == null || value === '') {
            throw new Error('service, field i niepuste value są wymagane.');
        }
        const vault = await this._readVault();
        vault.services[service] = vault.services[service] || { fields: {}, updatedAt: null };
        vault.services[service].fields[field] = String(value);
        vault.services[service].updatedAt = new Date().toISOString();
        await this._writeVault(vault);
        console.log(`[VaultService] 💾 Zapisano sekret: ${service}.${field} (zaszyfrowany).`);
        return { service, field, stored: true };
    }

    /** Pobierz surowy sekret — WYŁĄCZNIE do użytku backendu (np. push Git). */
    async getSecret(service, field) {
        const vault = await this._readVault();
        return vault.services?.[service]?.fields?.[field] ?? null;
    }

    async deleteSecret(service, field) {
        const vault = await this._readVault();
        if (vault.services?.[service]?.fields?.[field] !== undefined) {
            delete vault.services[service].fields[field];
            await this._writeVault(vault);
            return true;
        }
        return false;
    }

    /** Maska — surowy klucz NIGDY nie trafia do frontu. */
    _mask(v) {
        if (!v) return null;
        const s = String(v);
        if (s.length <= 8) return '••••••';
        return `${s.slice(0, 4)}••••${s.slice(-4)}`;
    }

    /** Status dla kokpitu — maski + drożność + poziom bezpieczeństwa. */
    async getStatus() {
        const vault = await this._readVault();
        const all   = new Set([...Object.keys(SERVICE_CATALOG), ...Object.keys(vault.services || {})]);
        const out   = [];

        for (const id of all) {
            const meta   = SERVICE_CATALOG[id] || { label: id, fields: [], security: 'STANDARD', glyph: '🔑' };
            const stored = vault.services?.[id]?.fields || {};
            const fieldNames = meta.fields.length ? meta.fields : Object.keys(stored);
            const fields = fieldNames.map(f => ({
                field:      f,
                configured: !!stored[f],
                masked:     this._mask(stored[f]),
            }));
            const configuredCount = fields.filter(f => f.configured).length;
            out.push({
                id,
                label:          meta.label,
                glyph:          meta.glyph,
                security:       meta.security,
                connected:      configuredCount > 0,
                configuredCount,
                totalFields:    fields.length || 1,
                fields,
                updatedAt:      vault.services?.[id]?.updatedAt || null,
            });
        }
        // Krytyczne najpierw, potem skonfigurowane
        const rank = { CRITICAL: 0, HIGH: 1, STANDARD: 2 };
        return out.sort((a, b) => (rank[a.security] ?? 9) - (rank[b.security] ?? 9));
    }
}

let _instance = null;
export default {
    getInstance() {
        if (!_instance) _instance = new VaultServiceClass();
        return _instance;
    },
    SERVICE_CATALOG,
};
