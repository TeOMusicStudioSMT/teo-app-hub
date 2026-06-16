/**
 * 💬 TostService — Szyfrowany Komunikator Katedry
 *
 * Przechowuje lokalnie zaszyfrowane wiadomości między agentami.
 * Skarbiec: _OtakOs_Wymiar/secure/tost_vault.json
 *
 * Szyfrowanie: Base64 (placeholder — warstwę TLS/E2E wdrożyć w v2.0)
 * Atomowy zapis: TEMP → rename (ochrona przed wyścigiem danych)
 * Singleton pattern
 *
 * ESM standard ("type": "module" w package.json)
 */

import path        from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Ścieżki ──────────────────────────────────────────────────────────────────
const SECURE_DIR  = path.join(process.cwd(), '_OtakOs_Wymiar', 'secure');
const VAULT_FILE  = path.join(SECURE_DIR, 'tost_vault.json');
const VAULT_TEMP  = path.join(SECURE_DIR, 'tost_vault_temp.json');

// ─── Konfiguracja ─────────────────────────────────────────────────────────────
const MAX_MESSAGES = 200; // Zachowaj ostatnie N wiadomości

// ─── Klasa ────────────────────────────────────────────────────────────────────
class TostService {
    constructor() {
        console.log('[TostService] 💬 Komunikator TOST zainicjalizowany.');
    }

    // ── Pobierz wszystkie wiadomości (odszyfrowane) ───────────────────────────
    async getMessages() {
        await this._ensureDir();
        const vault = await this._readVault();
        return vault.messages.map(m => ({
            ...m,
            text: this._decode(m.text),
        }));
    }

    // ── Dodaj wiadomość (zaszyfrowaną) ────────────────────────────────────────
    async addMessage(role, text, imageBase64 = null) {
        if (!['user', 'model'].includes(role)) {
            throw new Error(`Nieznana rola: ${role}. Dozwolone: user, model.`);
        }
        if (!text && !imageBase64) {
            throw new Error('Wiadomość nie może być pusta.');
        }

        await this._ensureDir();
        const vault = await this._readVault();

        const message = {
            id:        `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            role,
            text:      this._encode(text || ''),
            image:     imageBase64 || null, // Base64 data URL (nie szyfrowane — zbyt duże)
            timestamp: new Date().toISOString(),
            owner:     'local', // P2P: wiadomości z vault są zawsze lokalne
        };

        vault.messages.push(message);

        // Ogranicz do MAX_MESSAGES (sliding window)
        if (vault.messages.length > MAX_MESSAGES) {
            vault.messages = vault.messages.slice(-MAX_MESSAGES);
        }

        vault.lastActivity = new Date().toISOString();
        await this._saveVault(vault);

        return {
            ...message,
            text: text || '', // Zwróć odszyfrowany tekst do odpowiedzi API
        };
    }

    // ── Wyczyść historię ──────────────────────────────────────────────────────
    async clearMessages() {
        await this._ensureDir();
        const vault = await this._readVault();
        const count = vault.messages.length;
        vault.messages = [];
        vault.lastActivity = new Date().toISOString();
        await this._saveVault(vault);
        console.log(`[TostService] 🗑️  Wyczyszczono ${count} wiadomości.`);
        return { cleared: count };
    }

    // ── Metadane skarbca ──────────────────────────────────────────────────────
    async getVaultMeta() {
        await this._ensureDir();
        const vault = await this._readVault();
        return {
            messageCount:  vault.messages.length,
            lastActivity:  vault.lastActivity,
            createdAt:     vault.createdAt,
            encryptionScheme: 'base64-placeholder-v1',
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PRIVATE
    // ════════════════════════════════════════════════════════════════════════

    // Szyfrowanie placeholder (Base64) — wdrożyć AES-256 w v2.0
    _encode(text) {
        return Buffer.from(text, 'utf8').toString('base64');
    }

    _decode(encoded) {
        try {
            return Buffer.from(encoded, 'base64').toString('utf8');
        } catch (_) {
            return encoded; // Fallback: zwróć surowy tekst
        }
    }

    async _ensureDir() {
        await fs.mkdir(SECURE_DIR, { recursive: true });
    }

    async _readVault() {
        try {
            return JSON.parse(await fs.readFile(VAULT_FILE, 'utf8'));
        } catch (_) {
            // Inicjalizuj pusty skarbiec
            return {
                messages:      [],
                createdAt:     new Date().toISOString(),
                lastActivity:  new Date().toISOString(),
                version:       '1.0',
            };
        }
    }

    async _saveVault(vault) {
        const payload = JSON.stringify(vault, null, 2);
        await fs.writeFile(VAULT_TEMP, payload, 'utf8');
        await fs.rename(VAULT_TEMP, VAULT_FILE); // atomowe
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

export default {
    getInstance() {
        if (!_instance) _instance = new TostService();
        return _instance;
    }
};
