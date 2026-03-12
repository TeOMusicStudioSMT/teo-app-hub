import { GoogleGenerativeAI } from "@google/generative-ai";
import { VISEL_SYSTEM_INSTRUCTION } from "../lib/viselPersona";
import { getDefaultStore } from 'jotai';
import { userApiKeyAtom } from '../store/settings';
import { retrieveKey } from '../lib/kibel';
import { vaultRetrieve } from '../lib/VaultStorage';

export const SYSTEM_INSTRUCTION_VISEL = VISEL_SYSTEM_INSTRUCTION;

export type CloudProvider = 'gemini' | 'groq' | 'claude' | 'openai' | 'gpt' | 'ollama' | 'unknown';

export interface CloudMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface StreamChunk {
    text: string;
    done: boolean;
}

export interface RouterConfig {
    provider: CloudProvider;
    model?: string;
    systemPrompt?: string;
}

/**
 * 🔍 Wykrywanie aktywnego dostawcy i klucza
 */
export const getCloudProvider = async (requestedProvider?: CloudProvider): Promise<{ provider: CloudProvider, apiKey: string | null }> => {
    // 1. Jeśli wymuszono konkretnego dostawcę (np. z Portu Dyplomatycznego)
    if (requestedProvider && requestedProvider !== 'unknown') {
        const key = await retrieveKey(requestedProvider);
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
    const geminiKibel = await retrieveKey('gemini');
    if (geminiKibel && geminiKibel.startsWith('AIza')) return { provider: 'gemini', apiKey: geminiKibel };

    const groqKibel = await retrieveKey('groq');
    if (groqKibel && groqKibel.startsWith('gsk_')) return { provider: 'groq', apiKey: groqKibel };

    return { provider: 'unknown', apiKey: null };
};

const LOCAL_GEMMA_ENDPOINT = "http://localhost:11434/api/generate";

// ── Wykrywanie środowiska (Kwantowa Tarcza) ────────────────────────
const IS_LOCAL = import.meta.env.DEV;
const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? '';

// ── 1. NATYWNE WYWOŁANIE CLAUDE (Anthropic) ze streamingiem ─────────
export async function callClaude(
    messages: CloudMessage[],
    apiKey: string,            // używany TYLKO lokalnie
    onChunk: (chunk: StreamChunk) => void,
    model = 'claude-sonnet-4-20250514',
    systemPrompt?: string
): Promise<void> {
    const body: Record<string, unknown> = {
        model,
        max_tokens: 1024,
        stream: true,
        messages: messages.filter(m => m.role !== 'system'),
        ...(systemPrompt ? { system: systemPrompt } : {}),
    };

    // ── Wybór endpoint i headerów zależnie od środowiska ────────────
    let url: string;
    let headers: Record<string, string>;

    if (IS_LOCAL) {
        // LOKALNIE: uderz bezpośrednio do Anthropic
        url = 'https://api.anthropic.com/v1/messages';
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        };
    } else {
        // PRODUKCJA: uderz przez Cloudflare Worker (klucz ukryty w Workerze)
        if (!WORKER_URL) throw new Error('Brak VITE_WORKER_URL w zmiennych środowiskowych! Aktywuj Kwantową Tarczę.');
        url = WORKER_URL;
        headers = {
            'Content-Type': 'application/json',
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Claude API error: ${err?.error?.message ?? response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
                onChunk({ text: '', done: true });
                return;
            }

            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    onChunk({ text: parsed.delta.text, done: false });
                }
            } catch { }
        }
    }
    onChunk({ text: '', done: true });
}

// ── 2. OPENAI-COMPATIBLE (Groq, OpenAI, lokalny Ollama) ─────────────
export async function callOpenAICompatible(
    messages: CloudMessage[],
    apiKey: string,
    onChunk: (chunk: StreamChunk) => void,
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4o-mini',
    systemPrompt?: string
): Promise<void> {
    const allMessages = systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
        : messages;

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            stream: true,
            messages: allMessages,
        }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`API error: ${err?.error?.message ?? response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
                onChunk({ text: '', done: true });
                return;
            }

            try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) onChunk({ text, done: false });
            } catch { }
        }
    }
    onChunk({ text: '', done: true });
}

// ── 3. ZWROTNICA ───────────────────────────────────────────────────
export async function cloudRouter(
    messages: CloudMessage[],
    config: RouterConfig,
    onChunk: (chunk: StreamChunk) => void
): Promise<void> {
    switch (config.provider) {
        case 'claude':
            await callClaude(
                messages,
                (await vaultRetrieve('ANTHROPIC_API_KEY')) || '',
                onChunk,
                config.model ?? 'claude-sonnet-4-20250514',
                config.systemPrompt
            );
            break;

        case 'gpt':
        case 'openai':
            await callOpenAICompatible(
                messages,
                (await vaultRetrieve('OPENAI_API_KEY')) || '',
                onChunk,
                'https://api.openai.com/v1',
                config.model ?? 'gpt-4o-mini',
                config.systemPrompt
            );
            break;

        case 'groq':
            await callOpenAICompatible(
                messages,
                (await vaultRetrieve('GROQ_API_KEY')) || '',
                onChunk,
                'https://api.groq.com/openai/v1',
                config.model ?? 'llama-3.3-70b-versatile',
                config.systemPrompt
            );
            break;

        case 'ollama':
            await callOpenAICompatible(
                messages,
                'ollama',
                onChunk,
                'http://localhost:11434/v1',
                config.model ?? 'llama3',
                config.systemPrompt
            );
            break;

        default:
            throw new Error(`Nieznany provider: ${config.provider}`);
    }
}

/**
 * 🚀 Główna Zwrotnica Multi-Cloud (Router) - Wrapper dla kompatybilności
 */
export const generateContent = async (prompt: string, mode: string, providerOverride?: CloudProvider) => {
    console.log(`📡 Cloud Router: Mode=${mode}, Provider=${providerOverride || 'Auto'}`);

    if (mode === 'just' || mode === 'local') {
        const response = await fetch(LOCAL_GEMMA_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "gemma:2b",
                system: "Jesteś Lokalnym Duchem Katedry (SuperWiesławem). Bądź bystry, techniczny i rezonuj z intencjami Suwerena.",
                prompt: prompt,
                stream: false
            }),
        });
        if (response.ok) {
            const data = await response.json();
            return data.response;
        }
        return "Lokalny Duch śpi.";
    }

    const { provider: detectedProvider } = await getCloudProvider(providerOverride);
    const provider = providerOverride || detectedProvider;

    if (provider === 'gemini') {
        const { apiKey } = await getCloudProvider('gemini');
        if (!apiKey) return "Resonance Failed: Brak klucza Gemini.";

        try {
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
        } catch (e: any) {
            return `Gemini Pulse Error: ${e.message}`;
        }
    }

    // Dla nowych dostawców używamy cloudRouter (zbieramy stream do stringa)
    let fullText = "";
    try {
        await cloudRouter(
            [{ role: 'user', content: prompt }],
            { provider: provider as CloudProvider, systemPrompt: SYSTEM_INSTRUCTION_VISEL },
            (chunk) => { if (!chunk.done) fullText += chunk.text; }
        );
        return fullText;
    } catch (e: any) {
        console.error("Cloud Router Error:", e);
        return `Błąd: ${e.message}`;
    }
};
