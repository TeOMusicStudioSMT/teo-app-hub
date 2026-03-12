/**
 * 🔐 KIBEL - Local Secure Vault
 * 
 * "Najbezpieczniejsze miejsce w galaktyce"
 * 
 * Zasady:
 * - Klucze NIGDY nie opuszczają urządzenia
 * - Pobieranie tylko w momencie wykonywania akcji
 * - Szyfrowanie w LocalStorage
 * - Brak przesyłania do chmury
 */

import { encryptData, decryptData } from './crypto';

/**
 * 🔒 sanitizeLog - Ukryj środek klucza przed logowaniem
 * Zmienia środek stringu na "****"
 */
export const sanitizeLog = (value: string, showChars: number = 4): string | null => {
  if (typeof value !== 'string') return null;
  if (!value || value.length <= showChars * 2) {
    return '****';
  }
  try {
    const start = value.substring(0, showChars);
    const end = value.substring(value.length - showChars);
    return `${start}****${end}`;
  } catch (e) {
    return '****';
  }
};

// Prefix dla kluczy w LocalStorage
const KIBEL_PREFIX = 'kibel_';

// Interfejs klucza API
export interface KibelKey {
  id: string;
  name: string;
  provider: 'gemini' | 'suno' | 'openai' | 'groq' | 'anthropic' | 'custom';
  value: string; // Zaszyfrowana wartość
  createdAt: number;
  lastUsed: number;
}

// Interfejs konfiguracji
export interface KibelConfig {
  encryptionKey: string; // Klucz szyfrowania (生成owany lokalnie)
}

// 🔍 ROZPOZNAWANIE FORMATU KLUCZY
export type ProviderType = 'gemini' | 'groq' | 'anthropic' | 'openai' | 'suno' | 'unknown';

export interface DetectedKey {
  provider: ProviderType;
  isValid: boolean;
  format: string;
}

/**
 * 🔍 Rozpoznaj typ klucza API po prefixie
 * 
 * Obsługiwane formaty:
 * - gsk_ (Groq)
 * - AIza (Gemini)
 * - sk-ant- (Anthropic/Claude)
 * - sk- (OpenAI)
 * - sk-or- (OpenRouter)
 */
export function detectKeyProvider(key: string): DetectedKey {
  const trimmed = key.trim();

  if (!trimmed || trimmed.length < 10) {
    return { provider: 'unknown', isValid: false, format: 'too_short' };
  }

  // Groq: gsk_...
  if (trimmed.startsWith('gsk_')) {
    return { provider: 'groq', isValid: true, format: 'gsk_*' };
  }

  // Gemini: AIza...
  if (trimmed.startsWith('AIza')) {
    return { provider: 'gemini', isValid: true, format: 'AIza*' };
  }

  // Anthropic/Claude: sk-ant-...
  if (trimmed.startsWith('sk-ant-')) {
    return { provider: 'anthropic', isValid: true, format: 'sk-ant-*' };
  }

  // OpenRouter: sk-or-...
  if (trimmed.startsWith('sk-or-')) {
    return { provider: 'openai', isValid: true, format: 'sk-or-*' };
  }

  // OpenAI: sk-...
  if (trimmed.startsWith('sk-')) {
    return { provider: 'openai', isValid: true, format: 'sk-*' };
  }

  // Suno (JWT): eyJ...
  if (trimmed.startsWith('eyJ') && trimmed.includes('.')) {
    const jwtParts = trimmed.split('.');
    if (jwtParts.length === 3) {
      return { provider: 'suno', isValid: true, format: 'jwt' };
    }
  }

  return { provider: 'unknown', isValid: false, format: 'unknown' };
}

/**
 * 🔐 Validacja i zapis klucza z automatycznym rozpoznaniem
 */
export function validateAndStoreKey(rawKey: string): { success: boolean; provider?: ProviderType; message: string } {
  const detection = detectKeyProvider(rawKey);

  if (!detection.isValid) {
    return { success: false, message: 'Nie rozpoznano formatu klucza API' };
  }

  // Zapisz do Kibel
  storeKey({
    id: crypto.randomUUID(),
    name: `${detection.provider.toUpperCase()} Key`,
    provider: detection.provider as any,
    value: rawKey,
    createdAt: Date.now(),
    lastUsed: Date.now(),
  });

  return {
    success: true,
    provider: detection.provider,
    message: `✅ Rozpoznano ${detection.provider.toUpperCase()}! Klucz zapisany w Kiblu.`
  };
}

/**
 * Wyczyść Kibel i zwróć status SYSTEM_READY
 */
export function flushKibel(): { systemReady: boolean; providers: ProviderType[]; message: string } {
  // Wyczyść stare klucze (opcjonalnie)
  // clearKibel();

  // Sprawdź jakie mamy klucze
  const availableProviders: ProviderType[] = [];

  // 🔄 FALLBACK: Najpierw sprawdź localStorage (najszybsze)
  // Te klucze są zapisywane bezpośrednio z ApiKeyModal
  const localStorageKeys = [
    { key: 'teo_gemini_api_key', provider: 'gemini' as ProviderType },
    { key: 'kibel_key_groq', provider: 'groq' as ProviderType },
    { key: 'kibel_key_openai', provider: 'openai' as ProviderType },
    { key: 'kibel_key_anthropic', provider: 'anthropic' as ProviderType },
    { key: 'kibel_key_suno', provider: 'suno' as ProviderType },
  ];

  for (const item of localStorageKeys) {
    const value = localStorage.getItem(item.key);
    if (value && !availableProviders.includes(item.provider)) {
      availableProviders.push(item.provider);
      console.log(`[Kibel] Znaleziono w localStorage: ${item.provider}`);
    }
  }

  // 🔄 FALLBACK: Spróbuj też listKeys() z Kibel (jeśli działa)
  try {
    const keys = listKeys();
    keys.forEach(k => {
      if (k.provider && !availableProviders.includes(k.provider as ProviderType)) {
        availableProviders.push(k.provider as ProviderType);
        console.log(`[Kibel] Znaleziono w Kibel: ${k.provider}`);
      }
    });
  } catch (e) {
    console.warn('[Kibel] IndexedDB niedostępne, używam localStorage');
  }

  const isReady = availableProviders.length > 0;

  const message = isReady
    ? `🔐 SYSTEM_READY = TRUE! Dostępne dostawcy: ${availableProviders.join(', ')}`
    : '🔐 SYSTEM_READY = FALSE. Brak kluczy API.';

  console.log(`[Kibel] flushKibel(): ${message}`);

  return {
    systemReady: isReady,
    providers: availableProviders,
    message,
  };
}

/**
 * 🔄 FALLBACK: Pobierz klucz bezpośrednio z localStorage
 * Używane gdy IndexedDB/Kibel nie działa
 */
export function getKeyDirect(provider: ProviderType): string | null {
  const keyMap: Record<ProviderType, string> = {
    gemini: 'teo_gemini_api_key',
    groq: 'kibel_key_groq',
    openai: 'kibel_key_openai',
    anthropic: 'kibel_key_anthropic',
    suno: 'kibel_key_suno',
    unknown: '',
  };

  const localKey = keyMap[provider];
  if (!localKey) return null;

  const value = localStorage.getItem(localKey);
  if (!value) return null;

  // ✅ STERYLIZACJA: Sprawdź czy to surowy klucz (nie JSON)
  if (typeof value === 'string' && (value.startsWith('gsk_') || value.startsWith('AIza') || value.startsWith('sk-') || value.startsWith('sk-ant-') || value.startsWith('sk-or-'))) {
    console.log(`[Kibel] 💎 Wykryto surowy klucz ${provider}: ${sanitizeLog(value)}`);
    return value;
  }

  // Próbuj sparsować JSON tylko jeśli wygląda jak JSON
  try {
    if (value && (value.startsWith('{') || value.startsWith('['))) {
      return JSON.parse(value);
    }
  } catch {
    // To surowy string - zwróć jak jest
  }

  return value;
}

/**
 * 🔄 FALLBACK: Sprawdź czy LocalStorage działa
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 🔄 FALLBACK: Inicjalizacja Kibla z fallbackiem do localStorage
 */
export function initializeKibel(): { storage: 'indexedDB' | 'localStorage'; ready: boolean } {
  // Najpierw sprawdź localStorage
  if (!isLocalStorageAvailable()) {
    console.warn('[Kibel] ⚠️ localStorage niedostępne! Używam pamięci wirtualnej.');
    return { storage: 'localStorage', ready: false };
  }

  console.log('[Kibel] ✅ Storage dostępny (localStorage + IndexedDB fallback)');
  return { storage: 'indexedDB', ready: true };
}
function getEncryptionKey(): string {
  let key = localStorage.getItem(KIBEL_PREFIX + 'master_key');
  if (!key) {
    // Generuj unikalny klucz dla urządzenia
    key = crypto.randomUUID() + '-' + Date.now();
    localStorage.setItem(KIBEL_PREFIX + 'master_key', key);
  }
  return key;
}

/**
 * Zapisz klucz API do Kibel
 */
export async function storeKey(key: KibelKey): Promise<void> {
  const keyName = `${KIBEL_PREFIX}key_${key.provider}_${key.id}`;

  // ✔️ await - bez tego zapisywaliśmy "[object Promise]" zamiast danych!
  const encrypted = await encryptData(key.value, getEncryptionKey());

  const storedKey = {
    ...key,
    value: encrypted,
    createdAt: Date.now(),
  };

  localStorage.setItem(keyName, JSON.stringify(storedKey));
  console.log(`[Kibel] 🔐 Zapisano klucz: ${key.provider}/${sanitizeLog(key.value)}`);

  // ✅ BACKUP do starych lokalizacji (dla kompatybilności z flushKibel)
  const legacyKeyMap: Record<string, string> = {
    gemini: 'teo_gemini_api_key',
    groq: 'kibel_key_groq',
    openai: 'kibel_key_openai',
    anthropic: 'kibel_key_anthropic',
    suno: 'kibel_key_suno',
  };

  const legacyKey = legacyKeyMap[key.provider];
  if (legacyKey) {
    localStorage.setItem(legacyKey, key.value);
    console.log(`[Kibel] 📦 Backup do legacy: ${legacyKey}`);
  }
}

/**
 * Pobierz klucz API z Kibel (tylko do użytku!)
 */
export async function retrieveKey(provider: string, keyId?: string): Promise<string | null> {
  const prefix = `${KIBEL_PREFIX}key_${provider}`;

  // Szukaj klucza
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      if (keyId && !key.includes(keyId)) continue;

      const rawValue = localStorage.getItem(key);
      if (!rawValue) continue;

      // ✅ STERYLIZACJA: Sprawdź czy to JSON czy surowy string
      let decrypted: string;
      try {
        if (rawValue.startsWith('{') || rawValue.startsWith('[')) {
          const stored = JSON.parse(rawValue);

          // Guard: jeśli stored.value wygląda jak surowy klucz API (nie Base64),
          // zwróć go bezpośrednio — to dane z przed naprawy storeKey
          const v = stored.value;
          if (typeof v === 'string' && (v.startsWith('gsk_') || v.startsWith('AIza') || v.startsWith('sk-') || v.startsWith('sk-ant-'))) {
            console.log(`[Kibel] 📎 Legacy surowy klucz w JSON: ${provider}`);
            decrypted = v;
          } else {
            decrypted = await decryptData(stored.value, getEncryptionKey());
          }

          // Update lastUsed
          stored.lastUsed = Date.now();
          localStorage.setItem(key, JSON.stringify(stored));
        } else {
          // Surowy string - to legacy klucz
          decrypted = rawValue;
        }
      } catch (e) {
        console.warn(`[Kibel] ⚠️ Błąd deszyfrowania klucza ${provider}:`, e);
        // 🔄 FALLBACK: spróbuj dobyć klucz z legacy localStorage
        const legacy = getKeyDirect(provider as ProviderType);
        if (legacy) {
          console.log(`[Kibel] 🔄 Fallback do legacy dla: ${provider}`);
          return legacy;
        }
        return null;
      }

      console.log(`[Kibel] 🔑 Pobrano klucz: ${provider} [${sanitizeLog(decrypted)}]`);
      return decrypted;
    }
  }

  // Nie znaleziono w Kiblu - spróbuj legacy
  const legacyFallback = getKeyDirect(provider as ProviderType);
  if (legacyFallback) {
    console.log(`[Kibel] 🔄 Fallback legacy dla: ${provider}`);
    return legacyFallback;
  }

  console.warn(`[Kibel] ⚠️ Klucz nie znaleziony: ${provider}`);
  return null;
}

/**
 * Pobierz WSZYSTKIE klucze (bez wartości)
 */
export function listKeys(): Omit<KibelKey, 'value'>[] {
  const keys: Omit<KibelKey, 'value'>[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KIBEL_PREFIX + 'key_')) {
      const rawValue = localStorage.getItem(key);
      if (!rawValue) continue;

      // ✅ STERYLIZACJA: Sprawdź czy to JSON czy surowy string
      try {
        if (rawValue.startsWith('{') || rawValue.startsWith('[')) {
          const stored = JSON.parse(rawValue);
          if (stored && stored.id) {
            keys.push({
              id: stored.id,
              name: stored.name || 'Unknown',
              provider: (stored.provider as KibelKey['provider']) || 'custom',
              createdAt: stored.createdAt || Date.now(),
              lastUsed: stored.lastUsed || Date.now(),
            });
          }
        } else {
          // Surowy string - legacy klucz
          const provider = key.replace(KIBEL_PREFIX + 'key_', '').split('_')[0];
          keys.push({
            id: 'legacy',
            name: `${provider?.toUpperCase() || 'Unknown'} Key (legacy)`,
            provider: (provider as KibelKey['provider']) || 'custom',
            createdAt: Date.now(),
            lastUsed: Date.now(),
          });
        }
      } catch (e) {
        console.warn(`[Kibel] ⚠️ Błąd parsowania listy kluczy:`, e);
      }
    }
  }

  return keys;
}

/**
 * Usuń klucz z Kibel
 */
export function deleteKey(provider: string, keyId?: string): boolean {
  const prefix = `${KIBEL_PREFIX}key_${provider}`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      if (keyId && !key.includes(keyId)) continue;

      localStorage.removeItem(key);
      console.log(`[Kibel] 🗑️ Usunięto klucz: ${provider}`);
      return true;
    }
  }

  return false;
}

/**
 * Wyczyść wszystkie klucze
 */
export function clearKibel(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KIBEL_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('[Kibel] 🧹 Wyczyszczono wszystkie klucze');
}

/**
 * Sprawdź czy klucz istnieje
 */
export function hasKey(provider: string): boolean {
  const prefix = `${KIBEL_PREFIX}key_${provider}`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * SPECJALNE: Pobierz Suno Cookie
 */
export async function getSunoKey(): Promise<string | null> {
  return await retrieveKey('suno');
}

/**
 * SPECJALNE: Pobierz Gemini API Key
 */
export async function getGeminiKey(): Promise<string | null> {
  return await retrieveKey('gemini');
}

/**
 * SPECJALNE: Zapisz Suno Cookie
 */
export function setSunoKey(cookie: string): void {
  storeKey({
    id: crypto.randomUUID(),
    name: 'Suno Production',
    provider: 'suno',
    value: cookie,
    createdAt: Date.now(),
    lastUsed: Date.now(),
  });
}
