/**
 * ⚓ KwantowaKotwica.ts - Suwerenność Materii
 * 
 * "Każde urządzenie jest unikalne. Twoja tożsamość jest w tobie."
 * 
 * Funkcje:
 * - HardwareID powiązane z tożsamością
 * - Wykrywanie klonowania urządzenia
 * - Auto-flush dla Ścieżki Ducha
 * - Integracja z VaultStorage
 * 
 * @version 1.0.0
 * @author BoB & GORGOOO
 */

import {
  generateHardwareID,
  verifySessionIntegrity,
  initializeVault,
  vaultStore,
  vaultRetrieve,
  vaultList,
  emergencyFlush,
  getVaultStatus,
  setIdentityKey,
} from './VaultStorage';

/**
 * Stan Kwantowej Kotwicy
 */
export interface KwantowaKotwicaState {
  isInitialized: boolean;
  hardwareId: string | null;
  isPathwaySelected: boolean;
  pathway: 'duch' | 'materia' | null;
  autoFlush: boolean;
  cloneDetected: boolean;
  lastVerification: Date | null;
}

/**
 * Inicjalizuj Kwantową Kotwicę
 * 
 * @param userId - unikalny ID użytkownika
 * @param pathway - wybrana ścieżka
 * @returns stan kotwicy
 */
export const initializeKwantowaKotwica = async (
  userId: string,
  pathway: 'duch' | 'materia'
): Promise<KwantowaKotwicaState> => {
  // ⚡ KROK 0: Ustawienie Klucza Tożsamości - ABSOLUTNY PRIORYTET
  setIdentityKey(userId);

  console.log(`[KwantowaKotwica] ⚓ Inicjalizacja ${pathway.toUpperCase()} dla: ${userId}...`);

  const hwId = generateHardwareID();
  let autoFlush = false;
  let cloneDetected = false;

  if (pathway === 'duch') {
    // Ścieżka Ducha = autoFlush
    autoFlush = true;
    console.log('[KwantowaKotwica] 🌙 Ścieżka Ducha - autoFlush włączony');
  } else {
    // Ścieżka Materii = pełna weryfikacja
    console.log('[KwantowaKotwica] 💎 Ścieżka Materii - sprawdzam integralność...');

    // Sprawdź czy Vault jest gotowy
    const vaultResult = initializeVault(userId);

    if (vaultResult.flushRequired) {
      cloneDetected = true;
      console.warn('[KwantowaKotwica] ⚠️ WYKRYTO KLONOWANIE!');
    }

    // Zapisz HardwareID do Vault jeśli to pierwsze uruchomienie
    if (!(await vaultRetrieve('hardware_id'))) {
      vaultStore('hardware_id', hwId);
      console.log('[KwantowaKotwica] 💾 Zapisano HardwareID w Vault');
    }
  }

  return {
    isInitialized: true,
    hardwareId: hwId,
    isPathwaySelected: true,
    pathway,
    autoFlush,
    cloneDetected,
    lastVerification: new Date(),
  };
};

/**
 * GORGOOO - Wykrywanie klonowania
 * Sprawdza czy urządzenie się nie zmieniło
 */
export const detectClone = async (): Promise<{ isCloned: boolean; message: string }> => {
  const savedHwId = await vaultRetrieve('hardware_id');
  const currentHwId = generateHardwareID();

  if (!savedHwId) {
    return {
      isCloned: false,
      message: 'Brak zapisanej tożsamości - pierwsze uruchomienie'
    };
  }

  if (savedHwId !== currentHwId) {
    console.warn('[GORGOOO] ⚠️ WYKRYTO KLONOWANIE URZĄDZENIA!');
    console.warn('[GORGOOO]   Zapisany:', savedHwId);
    console.warn('[GORGOOO]   Bieżący:', currentHwId);

    return {
      isCloned: true,
      message: 'Wykryto zmianę urządzenia! Twoja tożsamość jest zagrożona.',
    };
  }

  return {
    isCloned: false,
    message: 'Urządzenie autentyczne - kotwica bezpieczna'
  };
};

/**
 * WALIDUJ integralność sesji
 */
export const validateSession = async (): Promise<{
  isValid: boolean;
  needsFlush: boolean;
  message: string;
}> => {
  // Najpierw sprawdź weryfikację sesji
  const sessionCheck = verifySessionIntegrity();

  if (sessionCheck.shouldFlush) {
    return {
      isValid: false,
      needsFlush: true,
      message: sessionCheck.message,
    };
  }

  // Potem sprawdź czy nie ma klonowania
  const cloneCheck = await detectClone();

  if (cloneCheck.isCloned) {
    return {
      isValid: false,
      needsFlush: true,
      message: cloneCheck.message,
    };
  }

  return {
    isValid: true,
    needsFlush: false,
    message: 'Sesja ważna - Kwantowa Kotwica trzyma.',
  };
};

/**
 * PRZYWRACAJ tożsamość z Vault
 */
export const restoreIdentity = async (): Promise<{
  success: boolean;
  keys: string[];
  hardwareId: string | null;
}> => {
  const keys = vaultList();
  const hwId = await vaultRetrieve('hardware_id');

  console.log('[KwantowaKotwica] 🔄 Przywracanie tożsamości...');
  console.log('[KwantowaKotwica]   Klucze:', keys.length);
  console.log('[KwantowaKotwica]   HardwareID:', hwId);

  return {
    success: keys.length > 0,
    keys,
    hardwareId: hwId,
  };
};

/**
 * ZAPISZ klucz do Vault (tylko Materia)
 */
export const anchorKey = (keyName: string, keyValue: string): boolean => {
  // Tryb Ducha - nie wymagaj pełnej struktury Vault
  if (localStorage.getItem('pathway_duch_mode') === 'true') {
    return false;
  }

  const status = getVaultStatus();

  if (!status.hasIdentity) {
    console.error('[KwantowaKotwica] ❌ Tożsamość nie jest zainicjalizowana!');
    return false;
  }

  const result = vaultStore(keyName, keyValue);

  if (result) {
    console.log(`[KwantowaKotwica] ⚓ Zakotwiczono klucz: ${keyName}`);
  }

  return result;
};

/**
 * POBIERZ klucz z Vault (tylko Materia)
 */
export const retrieveAnchoredKey = async (keyName: string): Promise<string | null> => {
  // Tryb Ducha - nie wymagaj pełnej struktury Vault
  if (localStorage.getItem('pathway_duch_mode') === 'true') {
    return null;
  }
  return await vaultRetrieve(keyName);
};

/**
 * KOTWICA SUKSESOOWA - zapisz aktualny stan
 */
export const anchorSession = (
  userId: string,
  pathway: 'duch' | 'materia',
  additionalData?: Record<string, string>
): void => {
  if (pathway === 'duch') {
    console.log('[KwantowaKotwica] 🌙 Ścieżka Ducha - nie kotwiczę (autoFlush)');
    return;
  }

  // Zapisz podstawowe dane
  vaultStore('last_user_id', userId);
  vaultStore('last_pathway', pathway);
  vaultStore('last_login', new Date().toISOString());

  // Zapisz dodatkowe dane
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      vaultStore(key, value);
    });
  }

  console.log('[KwantowaKotwica] ⚓ Sesja zakotwiczona w Materii');
};

/**
 * JACK Adamus - Powitalne Lekcje Mistrza
 */
export const getWelcomeLesson = (pathway: 'duch' | 'materia'): {
  title: string;
  lesson: string;
  emoji: string;
} => {
  const lessons = {
    duch: {
      title: 'Lekcja Pierwsza: Uwolnienie',
      lesson: 'Mistrzu, droga Ducha to droga zaufania. Nie musisz nosić ciężaru własnej tożsamości - inni strażnicy pomogą ci ją chronić. Twoja siła to otwartość i gotowość do przyjmowania pomocy.',
      emoji: '🌙',
    },
    materia: {
      title: 'Lekcja Pierwsza: Korzeń',
      lesson: 'Mistrzu, droga Materii to droga korzeni. Twoja tożsamość jest jak drzewo - musi być zakotwiczona w ziemi, aby rosnąć ku niebu. Nie pozwól, by ktoś przesadził cię bez twojej wiedzy.',
      emoji: '💎',
    },
  };

  return lessons[pathway];
};

/**
 * STATUS Kwantowej Kotwicy
 */
export const getKotwicaStatus = async (): Promise<{
  vaultReady: boolean;
  keyCount: number;
  hardwareId: string | null;
  pathway: string | null;
}> => {
  // Tryb Ducha - uproszczony status
  if (localStorage.getItem('pathway_duch_mode') === 'true') {
    return {
      vaultReady: false,
      keyCount: 0,
      hardwareId: null,
      pathway: 'duch',
    };
  }

  const vaultStatus = getVaultStatus();
  const lastPathway = await vaultRetrieve('last_pathway');

  return {
    vaultReady: vaultStatus.hasIdentity,
    keyCount: vaultStatus.keyCount,
    hardwareId: vaultStatus.hardwareId,
    pathway: lastPathway,
  };
};

/**
 * AWARYJNE ODCZEP (dla bezpieczeństwa)
 */
export const releaseKotwica = (): void => {
  console.log('[KwantowaKotwica] 🚨 AWARYJNE ODCZEP - uruchamiam flush...');
  emergencyFlush();
};

/**
 * Eksport domyślny
 */
export default {
  initializeKwantowaKotwica,
  detectClone,
  validateSession,
  restoreIdentity,
  anchorKey,
  retrieveAnchoredKey,
  anchorSession,
  getWelcomeLesson,
  getKotwicaStatus,
  releaseKotwica,
};
