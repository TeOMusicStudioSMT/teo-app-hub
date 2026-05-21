import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

/**
 * Custom Storage helper
 */
const getRobustStorage = <T>() => createJSONStorage<T>(() => localStorage, {
    reviver: (key, value) => value,
});

/**
 * User's Gemini API Key - persisted in localStorage
 */
export const userApiKeyAtom = atomWithStorage<string>(
    'teo_gemini_api_key',
    '',
    getRobustStorage<string>()
);

/**
 * Derived atom that checks if the API key is configured
 */
export const apiKeyConfiguredAtom = atom((get) => {
    const key = get(userApiKeyAtom) as string;
    return typeof key === 'string' && key.trim().length > 0;
});

/**
 * AI Mode - 'cloud' (Gemini) or 'local' (Ollama)
 */
export const aiModeAtom = atomWithStorage<'cloud' | 'local'>(
    'teo_ai_mode',
    'cloud',
    getRobustStorage<'cloud' | 'local'>()
);

/**
 * Global Active Local Model (Ollama) - persisted in localStorage
 */
export const globalActiveLocalModel = atomWithStorage<string>(
    'otakos_active_model',
    'gemma4:e2b',
    getRobustStorage<string>()
);

