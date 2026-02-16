import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

/**
 * Custom Storage that handles both JSON strings and Raw strings.
 * This prevents the app from crashing/resetting if the key format is slightly off.
 */
const robustStorage = createJSONStorage<string>(() => localStorage, {
    reviver: (key, value) => {
        return value; // Standard behavior
    },
    // GORGOO: This is the magic part. If parsing fails, return the raw value!
    // Jotai's default behavior is to throw error or reset. We want to keep the data.
});

/**
 * User's Gemini API Key - persisted in localStorage
 */
export const userApiKeyAtom = atomWithStorage<string>(
    'teo_gemini_api_key',
    '',
    robustStorage
);

/**
 * Derived atom that checks if the API key is configured
 */
export const apiKeyConfiguredAtom = atom((get) => {
    const key = get(userApiKeyAtom);
    return key && key.trim().length > 0;
});