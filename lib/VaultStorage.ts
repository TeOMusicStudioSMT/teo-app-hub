/**
 * 🔐 VaultStorage.ts - Szyfrowany Magazyn Suwerena
 * 
 * "Bezpieczny schowek dla Wygodnych Suwerenów"
 * 
 * Funkcje:
 * - Szyfrowanie kluczy pochodzących z tożsamości użytkownika
 * - Ochrona peryskopu: GORGOOO sprawdza HardwareID
 * - Automatyczny flushKibel() przy niezgodności sesji
 * 
 * @version 1.1.0
 * @author BoB & GORGOOO
 */

import { simpleEncode, simpleDecode } from './crypto';
import { retrieveKey } from './kibel';

// Prefix dla Vault w LocalStorage
const VAULT_PREFIX = 'vault_';

// Klucz szyfrowania pochodzący z tożsamości
let identityKey: string | null = null;

/**
 * � Generuj HardwareID na podstawie przeglądarki
 */
export const generateHardwareID = (): string => {
  if (typeof window === 'undefined') return 'HW_SERVER';
  const nav = navigator;
  const screen = window.screen;

  const components = [
    nav.userAgent,
    nav.language,
    nav.platform,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ];

  // Prosty hash
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `HW_${Math.abs(hash).toString(36).toUpperCase()}`;
};

/**
 * 🔑 Ustaw klucz tożsamości (derived z HardwareID)
 */
export const setIdentityKey = (userId?: string): void => {
  const hwId = generateHardwareID();
  identityKey = userId
    ? `${hwId}_${userId}`.substring(0, 32)
    : `TeO_UNIVERSAL_${hwId}`.substring(0, 32);
  console.log(`[VaultStorage] 🔑 Klucz tożsamości ustawiony: ${userId ? userId : 'TeO_UNIVERSAL'}`);
};

// �🏁 AUTO-INICJACJA: Zapobiegamy błędom Research Condition na starcie
setIdentityKey();

/**
 * 🛡️ GORGOOO - Sprawdź zgodność sesji
 * Jeśli HardwareID się nie zgadza → automatyczny flush
 */
export const verifySessionIntegrity = (): { isValid: boolean; shouldFlush: boolean; message: string } => {
  if (typeof window === 'undefined') return { isValid: true, shouldFlush: false, message: 'Server side' };
  const savedHwId = localStorage.getItem('vault_hardware_id');
  const currentHwId = generateHardwareID();

  // Jeśli nie ma zapisanego HWID, to pierwsze uruchomienie
  if (!savedHwId) {
    localStorage.setItem('vault_hardware_id', currentHwId);
    console.log('[GORGOOO] 🆔 Pierwsze uruchomienie - zapisuję HardwareID');
    return { isValid: true, shouldFlush: false, message: 'Pierwsze uruchomienie - sesja zainicjalizowana' };
  }

  // Sprawdź zgodność
  if (savedHwId !== currentHwId) {
    console.warn('[GORGOOO] ⚠️ Niezgodność HardwareID!');
    console.warn('[GORGOOO]   Zapisany:', savedHwId);
    console.warn('[GORGOOO]   Bieżący:', currentHwId);

    return {
      isValid: false,
      shouldFlush: true,
      message: 'Wykryto zmianę urządzenia! Dla bezpieczeństwa wykonuję flush.'
    };
  }

  return { isValid: true, shouldFlush: false, message: 'Sesja ważna - zgodność potwierdzona' };
};

/**
 * 🔐 Zaszyfruj i zapisz klucz do Vault (proste XOR szyfrowanie)
 */
const obfuscate = (data: string, key: string): string => {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
};

/**
 * 🔓 Odszyfruj dane
 */
const deobfuscate = (data: string, key: string): string => {
  try {
    const decoded = atob(data);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
};

export const vaultStore = (key: string, value: string): boolean => {
  if (!identityKey) {
    console.warn('[VaultStorage] ⚠️ Klucz tożsamości był null, wymuszam TeO_UNIVERSAL');
    setIdentityKey();
  }

  if (!identityKey) return false;

  try {
    const encrypted = obfuscate(value, identityKey);
    const vaultKey = `${VAULT_PREFIX}${key}`;
    localStorage.setItem(vaultKey, encrypted);

    console.log(`[VaultStorage] 🔐 Zapisano zaszyfrowany klucz: ${key}`);
    return true;
  } catch (error) {
    console.error('[VaultStorage] ❌ Błąd szyfrowania:', error);
    return false;
  }
};

export const vaultRetrieve = (key: string): string | null => {
  // Tryb Ducha - nie wymagaj pełnej struktury Vault
  if (typeof window !== 'undefined' && localStorage.getItem('pathway_duch_mode') === 'true') {
    return null;
  }

  if (!identityKey) {
    console.warn('[VaultStorage] ⚠️ Klucz tożsamości był null, wymuszam TeO_UNIVERSAL');
    setIdentityKey();
  }

  if (!identityKey) return null;

  try {
    const vaultKey = `${VAULT_PREFIX}${key}`;
    const encrypted = localStorage.getItem(vaultKey);

    if (!encrypted) {
      // 🔄 FALLBACK DO KIBLA: Jeśli nie ma w Vault, szukaj w Kiblu (dla Cloud Routera)
      if (key === 'ANTHROPIC_API_KEY' || key === 'CLAUDE_API_KEY') return retrieveKey('anthropic');
      if (key === 'OPENAI_API_KEY' || key === 'GPT_API_KEY') return retrieveKey('openai');
      if (key === 'GROQ_API_KEY') return retrieveKey('groq');
      if (key === 'GEMINI_API_KEY') return retrieveKey('gemini');

      return null;
    }

    const decrypted = deobfuscate(encrypted, identityKey);
    console.log(`[VaultStorage] 🔓 Pobrano klucz: ${key}`);
    return decrypted;
  } catch (error) {
    console.error('[VaultStorage] ❌ Błąd deszyfrowania:', error);
    return null;
  }
};

export const vaultRemove = (key: string): boolean => {
  try {
    const vaultKey = `${VAULT_PREFIX}${key}`;
    localStorage.removeItem(vaultKey);
    console.log(`[VaultStorage] 🗑️ Usunięto z Vault: ${key}`);
    return true;
  } catch (error) {
    console.error('[VaultStorage] ❌ Błąd usuwania:', error);
    return false;
  }
};

export const vaultList = (): string[] => {
  const keys: string[] = [];
  if (typeof window === 'undefined') return [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(VAULT_PREFIX)) {
      keys.push(key.replace(VAULT_PREFIX, ''));
    }
  }

  return keys;
};

export const vaultClear = (): void => {
  const keys = vaultList();
  keys.forEach(key => vaultRemove(key));
  localStorage.removeItem('vault_hardware_id');
  identityKey = null;
  console.log('[VaultStorage] 🧹 Vault wyczyszczony');
};

export const emergencyFlush = (): void => {
  console.log('[GORGOOO] 🚨 EMERGENCY FLUSH - Niezgodność sesji!');

  vaultClear();

  console.log('[GORGOOO] ⚠️ Sesja unieważniona. Wymagana ponowna autoryzacja.');
};

export const initializeVault = (userId: string): { ready: boolean; flushRequired: boolean } => {
  setIdentityKey(userId);

  const sessionCheck = verifySessionIntegrity();

  if (sessionCheck.shouldFlush) {
    emergencyFlush();
    return { ready: false, flushRequired: true };
  }

  console.log('[VaultStorage] ✅ Vault gotowy - sesja ważna');
  return { ready: true, flushRequired: false };
};

export const hasVaultKeys = (): boolean => {
  return vaultList().length > 0;
};

export const getVaultStatus = (): {
  hasIdentity: boolean;
  keyCount: number;
  hardwareId: string | null;
} => {
  return {
    hasIdentity: identityKey !== null,
    keyCount: vaultList().length,
    hardwareId: typeof window !== 'undefined' ? localStorage.getItem('vault_hardware_id') : null,
  };
};
