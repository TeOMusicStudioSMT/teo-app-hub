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
 * Raw-string storage — przechowuje czysty string BEZ cudzysłowów JSON.
 *
 * Powód: domyślny createJSONStorage robi JSON.stringify na zapisie ("gemma4"),
 * a liczne moduły czytają model surowo: localStorage.getItem('otakos_active_model').
 * Cudzysłowy w nazwie modelu → błędna struktura `model` → 400/404 z Ollamy.
 * To storage trzyma JEDNO, spójne źródło prawdy: zwykły string `gemma4`.
 */
const rawStringStorage = {
    getItem: (key: string, initialValue: string): string => {
        const v = localStorage.getItem(key);
        if (v === null) return initialValue;
        // Migracja: stare wartości zapisane z cudzysłowami JSON ("gemma4") → rozpakuj
        if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
            try { return JSON.parse(v); } catch { return v.slice(1, -1); }
        }
        return v;
    },
    setItem: (key: string, value: string): void => {
        localStorage.setItem(key, value);                 // zapis SUROWY (bez cudzysłowów)
        // Powiadom słuchaczy w tej samej karcie (storage event nie odpala dla self)
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
    },
    removeItem: (key: string): void => localStorage.removeItem(key),
};

/**
 * Global Active Local Model (Ollama) — NADRZĘDNE źródło prawdy.
 *
 * Sterowane z Interfejsu Wiesi (WiesioCore). Propaguje się automatycznie do
 * wszystkich zapytań mostu Wiesława przez wspólny klucz localStorage
 * 'otakos_active_model' (czytany surowo przez WidokCore, TerminalZero, ApiDyrygent…).
 */
export const globalActiveLocalModel = atomWithStorage<string>(
    'otakos_active_model',
    'gemma4',
    rawStringStorage
);

