import { GoogleGenerativeAI } from "@google/generative-ai";
import { VISEL_SYSTEM_INSTRUCTION } from "../lib/viselPersona";
import { getDefaultStore } from 'jotai';
import { userApiKeyAtom } from '../store/settings';

export const SYSTEM_INSTRUCTION_VISEL = VISEL_SYSTEM_INSTRUCTION;

export const getGeminiApiKey = (): string | undefined => {
    const store = getDefaultStore();
    let apiKey = store.get(userApiKeyAtom);
    if (!apiKey || apiKey.trim().length === 0) {
        const localKey = localStorage.getItem('teo_gemini_api_key');
        if (localKey) {
            try { apiKey = JSON.parse(localKey); } catch (e) { apiKey = localKey; }
        }
    }
    return apiKey && apiKey.trim().length > 0 ? apiKey : undefined;
};

export const ensureApiKey = (): string => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing.");
    return apiKey;
};

// 📡 KONFIGURACJA DLA SMARTFONA:
// Na komputerze działa: "http://localhost:11434/api/generate"
// Na telefonie musisz użyć IP komputera, np.: "http://192.168.1.XX:11434/api/generate"
// Zmień to poniżej przed testem na telefonie!
const LOCAL_GEMMA_ENDPOINT = "http://localhost:11434/api/generate";

export const generateContent = async (prompt: string, mode: string) => {
    console.log(`📡 Generating in mode: ${mode.toUpperCase()}`);

    // --- ŚCIEŻKA 1: JusT MODE (Lokalna Gemma / Ollama) ---
    if (mode === 'just') {
        try {
            console.log("🦙 Calling Local Gemma (Ollama)...");
            // Dodajemy AbortController dla szybszego timeoutu na mobile
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s na odpowiedź lamy

            const localResponse = await fetch(LOCAL_GEMMA_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gemma:2b",
                    prompt: prompt,
                    stream: false
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (localResponse.ok) {
                const data = await localResponse.json();
                console.log("✅ Local Emanation Received.");
                return data.response;
            } else {
                console.warn(`⚠️ Ollama Error: ${localResponse.status}`);
                throw new Error("Ollama error");
            }
        } catch (e) {
            console.error("⚠️ Local Connection Failed. Is Ollama running? Is IP correct?", e);
            return "Local Field Unreachable. (Sprawdź Ollamę lub IP w geminiService.ts)";
        }
    }

    // --- ŚCIEŻKA 2: RESONANCE / ACTIVE (Google Cloud) ---
    try {
        console.log("☁️ Connecting to Global Field (Gemini Cloud)...");
        const apiKey = ensureApiKey();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (e) {
        console.error("☁️ Cloud Resonance Failed:", e);
        return "Connection with the Field lost. (Sprawdź klucz API)";
    }
};