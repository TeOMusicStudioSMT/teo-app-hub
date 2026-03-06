import { GoogleGenerativeAI } from "@google/generative-ai";
import { VISEL_SYSTEM_INSTRUCTION } from "../lib/viselPersona";
import { getDefaultStore } from 'jotai';
import { userApiKeyAtom, aiModeAtom } from '../store/settings';
import { retrieveKey } from '../lib/kibel';

export const SYSTEM_INSTRUCTION_VISEL = VISEL_SYSTEM_INSTRUCTION;

export type CloudProvider = 'gemini' | 'groq' | 'claude' | 'gpt' | 'unknown';

/**
 * 🔍 Wykrywanie aktywnego dostawcy i klucza
 */
export const getCloudProvider = (requestedProvider?: CloudProvider): { provider: CloudProvider, apiKey: string | null } => {
    // 1. Jeśli wymuszono konkretnego dostawcę (np. z Portu Dyplomatycznego)
    if (requestedProvider && requestedProvider !== 'unknown') {
        const key = retrieveKey(requestedProvider);
        if (key) return { provider: requestedProvider, apiKey: key };
    }

    // 2. Automatyczna detekcja na podstawie klucza w Jotai/LocalStorage
    let activeKey = null;
    try {
        const store = getDefaultStore();
        activeKey = store.get(userApiKeyAtom);
    } catch (e) {
        activeKey = localStorage.getItem('teo_gemini_api_key');
    }

    if (activeKey) {
        activeKey = activeKey.replace(/^["']|["']$/g, '').trim();
        if (activeKey.startsWith('AIza')) return { provider: 'gemini', apiKey: activeKey };
        if (activeKey.startsWith('gsk_')) return { provider: 'groq', apiKey: activeKey };
    }

    // 3. Szukaj w dedykowanych skrytkach Kibla
    const geminiKibel = retrieveKey('gemini');
    if (geminiKibel && geminiKibel.startsWith('AIza')) return { provider: 'gemini', apiKey: geminiKibel };

    const groqKibel = retrieveKey('groq');
    if (groqKibel && groqKibel.startsWith('gsk_')) return { provider: 'groq', apiKey: groqKibel };

    return { provider: 'unknown', apiKey: null };
};

const LOCAL_GEMMA_ENDPOINT = "http://localhost:11434/api/generate";

/**
 * 🚀 Główna Zwrotnica Multi-Cloud (Router)
 */
export const generateContent = async (prompt: string, mode: string, providerOverride?: CloudProvider) => {
    console.log(`📡 Cloud Router: Mode=${mode}, Provider=${providerOverride || 'Auto'}`);

    // --- ŚCIEŻKA LOKALNA (Ollama) ---
    if (mode === 'just' || mode === 'local') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const localResponse = await fetch(LOCAL_GEMMA_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gemma:2b",
                    system: "Jesteś Lokalnym Duchem Katedry (SuperWiesławem). Masz dostęp do wniosków pozostawionych przez Chmurę. Bądź bystry, techniczny i rezonuj z intencjami Suwerena w przestrzeni 0.00G.",
                    prompt: prompt,
                    stream: false
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (localResponse.ok) {
                const data = await localResponse.json();
                return data.response;
            } else {
                throw new Error(`Ollama error: ${localResponse.status}`);
            }
        } catch (e: any) {
            if (e.name === 'AbortError') return "Lokalny Duch myśli zbyt długo. Zbudź go w terminalu (ollama run gemma:2b).";
            return "Lokalny Duch śpi. Zbudź go w terminalu (ollama serve).";
        }
    }

    // --- ŚCIEŻKA CHMURY ---
    const { provider, apiKey } = getCloudProvider(providerOverride);

    if (!apiKey) {
        return "Resonance Failed: Brak klucza API dla wybranego dostawcy.";
    }

    try {
        // 1. GEMINI
        if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(apiKey);
            const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];

            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(prompt);
                    return result.response.text();
                } catch (err) {
                    console.warn(`Gemini ${modelName} failed, trying fallback...`);
                }
            }
            throw new Error("Wszystkie modele Gemini zawiodły.");
        }

        // 2. GROQ (OpenAI Compatible)
        if (provider === 'groq') {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.1-70b-versatile",
                    messages: [
                        { role: "system", content: SYSTEM_INSTRUCTION_VISEL },
                        { role: "user", content: prompt }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices[0].message.content;
            }
            throw new Error(`Groq Pulse error: ${response.status}`);
        }

        // 3. CLAUDE / GPT (Szkielety)
        if (provider === 'claude') {
            return "Claude Integration in progress... Krystalizacja w toku.";
        }
        if (provider === 'gpt') {
            return "GPT-4o Integration in progress... Rezonans w toku.";
        }

        return "Nieznany dostawca chmury.";
    } catch (e: any) {
        console.error("Cloud Error:", e);
        return `Połączenie przerwane: ${e.message}`;
    }
};
