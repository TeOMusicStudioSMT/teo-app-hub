/**
 * 🔐 Prosty moduł szyfrowania dla Kibel
 * 
 * Używa Web Crypto API (dostępne w nowoczesnych przeglądarkach)
 * Symetryczne szyfrowanie AES-GCM
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Wygeneruj klucz z hasła
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = encoder.encode('KibelSalt_v1'); // Statyczna sól

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Szyfruj dane
 */
export async function encryptData(data: string, password: string): Promise<string> {
  try {
    const key = await deriveKey(password);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoder.encode(data)
    );

    // Łącz IV + zaszyfrowane dane
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Crypto] Błąd szyfrowania:', error);
    throw error;
  }
}

/**
 * Deszyfruj dane
 */
export async function decryptData(encryptedData: string, password: string): Promise<string> {
  try {
    const key = await deriveKey(password);
    const encoder = new TextEncoder();

    // Dekoduj z base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    // Wyciągnij IV
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('[Crypto] Błąd deszyfrowania:', error);
    throw error;
  }
}

/**
 * Prosta wersja (bez szyfrowania - dla fallback)
 * Używa base64 kodowania
 */
export function simpleEncode(data: string): string {
  return btoa(data);
}

export function simpleDecode(encoded: string): string | null {
  if (typeof encoded !== 'string') return null;
  try {
    return atob(encoded);
  } catch (e) {
    return null;
  }
}
