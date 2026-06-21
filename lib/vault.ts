/**
 * 🔐 VAULT - Warstwa dostępu do Kibla
 * 
 * Sejf używa Kibla do przechowywania kluczy lokalnie.
 * Zasady:
 * - Klucze NIGDY nie w kodzie źródłowym
 * - Tylko LocalStorage/IndexedDB
 * - Pobieranie w momencie wykonywania akcji
 */

import { getSunoKey as getSunoFromKibel, getGeminiKey as getGeminiFromKibel } from './kibel';
import { setSystemReady } from './memory/CityMemory';

interface VaultCredentials {
  SUNO_COOKIE: string | null;
  TEO_ISKA_KEY: string | null;
}

let cachedCredentials: VaultCredentials | null = null;

export async function openVault(): Promise<VaultCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // Pobierz z Kibla (lokalnie!)
  const sunoCookie = await getSunoFromKibel();
  let iskaKey = localStorage.getItem('kibel_iska_key'); // Proste przechowanie
  if (!iskaKey && import.meta.env.VITE_TEO_ISKA_KEY) {
    iskaKey = import.meta.env.VITE_TEO_ISKA_KEY;
    localStorage.setItem('kibel_iska_key', iskaKey);
  }

  cachedCredentials = {
    SUNO_COOKIE: sunoCookie,
    TEO_ISKA_KEY: iskaKey,
  };

  console.log('🔐 [Vault] Credentials z Kibel:', {
    SUNO_COOKIE: cachedCredentials.SUNO_COOKIE ? '***' : 'NULL',
    TEO_ISKA_KEY: cachedCredentials.TEO_ISKA_KEY ? '***' : 'NULL',
  });

  return cachedCredentials;
}

/**
 * 🔐 Sprawdź czy Vault jest "odblokowany" (klucze włożone)
 * Zwraca true jeśli Gemini API key jest ustawiony
 */
export function isVaultUnlocked(): boolean {
  const geminiKey = getGeminiKey();
  const isUnlocked = !!geminiKey && geminiKey.trim().length > 0;

  console.log('🔐 [Vault] isVaultUnlocked():', isUnlocked ? 'TRUE - SYSTEM_READY!' : 'FALSE - locked');

  return isUnlocked;
}

/**
 * 🔐 Odblokuj Vault po włożeniu kluczy
 * Ustawia SYSTEM_READY = true w CityMemory
 */
export function unlockVault(): void {
  if (isVaultUnlocked()) {
    setSystemReady(true);
    console.log('🔐 [Vault] Odblokowano! SYSTEM_READY = TRUE');
  }
}

export async function getSunoCookie(): Promise<string | null> {
  // Zawsze pobieraj na świeżo (nie cacheuj!)
  return await getSunoFromKibel();
}

export function getGeminiKey(): string | null {
  // Pobierz Gemini API key z localStorage
  const stored = localStorage.getItem('teo_gemini_api_key');
  if (!stored) return null;

  try {
    // Spróbuj sparsować JSON
    return JSON.parse(stored);
  } catch {
    // Jeśli nie JSON, zwróć surowy string
    return stored;
  }
}

export function getIskraKey(): string | null {
  return localStorage.getItem('kibel_iska_key');
}

export function validateIskra(input: string): boolean {
  let key = getIskraKey();
  if (!key && import.meta.env.VITE_TEO_ISKA_KEY) {
    key = import.meta.env.VITE_TEO_ISKA_KEY;
    localStorage.setItem('kibel_iska_key', key);
  }
  if (!key) {
    console.warn('⚠️ [Vault] TEO_ISKA_KEY nie jest ustawiony!');
    return false;
  }
  return input === key;
}

/**
 * Zapisz ISKRA do Kibla
 */
export function setIskraKey(key: string): void {
  localStorage.setItem('kibel_iska_key', key);
  console.log('🔐 [Vault] ISKRA zapisana');
}
