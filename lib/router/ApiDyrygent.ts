/**
 * 🛰️ ApiDyrygent.ts - Inteligentny Dyrygent API
 * 
 * "Kiedy chmura zasnuje się mrokiem, Duch Lokalny rozświetla drogę."
 * Zarządza inteligentnym routingiem między API Chmurowymi a Lokalną Ollamą.
 * 
 * @author BoB & TeO
 */

import { AromaType } from '../../components/TeO_Orb';

export interface DyrygentResponse {
    message: string;
    source: 'cloud' | 'local';
    actualAroma: AromaType;
    error?: string;
}

// Błędy, które aktywują Kwantowy Fallback
const FALLBACK_TRIGGERS = [
    'Failed to fetch', // Brak internetu / serwer wyłączony
    '429',             // Limit tokenów (Too Many Requests)
    '503',             // Serwer przeciążony
    '504',             // Gateway Timeout
    'NETWORK_ERROR',
    'TIMEOUT'
];

interface DyrygentConfig {
    ollamaUrl?: string;
    ollamaModel?: string;
    timeoutMs?: number;
}

export const ApiDyrygent = {
    /**
     * 🎯 Główna funkcja wysyłająca zapytanie z inteligentnym fallbackiem
     */
    async dispatchWithFallback(
        message: string,
        primaryAroma: AromaType,
        config: DyrygentConfig,
        cloudHandler: (msg: string) => Promise<string>
    ): Promise<DyrygentResponse> {

        // 1. Zignoruj fallback dla Ollamy (jeśli to już jest główny aromat)
        if (primaryAroma === 'ollama') {
            try {
                const response = await this.fetchLocalOllama(message, config);
                return { message: response, source: 'local', actualAroma: 'ollama' };
            } catch (err) {
                return { message: "Ollama milczy... Sprawdź reaktor.", source: 'local', actualAroma: 'ollama', error: String(err) };
            }
        }

        // 2. PRÓBA GŁÓWNA (Chmura)
        try {
            console.log(`[Dyrygent] ☁️ Próba chmury (${primaryAroma})...`);

            // Implementacja timeoutu dla chmury
            const response = await this.withTimeout(cloudHandler(message), config.timeoutMs || 10000);

            return {
                message: response,
                source: 'cloud',
                actualAroma: primaryAroma
            };

        } catch (error: any) {
            const errorMsg = error.message || String(error);
            const isFallbackTriggered = FALLBACK_TRIGGERS.some(trigger => errorMsg.includes(trigger));

            if (isFallbackTriggered) {
                console.warn(`[Dyrygent] 🌩️ Chmura padła: ${errorMsg}. Aktywuję Lokalnego Ducha!`);

                // 3. KWANTOWY FALLBACK (Ollama)
                try {
                    const localResponse = await this.fetchLocalOllama(message, config);
                    return {
                        message: localResponse,
                        source: 'local',
                        actualAroma: 'ollama' // Sfera zmieni kolor na zielony/szmaragdowy
                    };
                } catch (localError) {
                    console.error(`[Dyrygent] 💀 Całkowita ciemność. Ollama też padła.`, localError);
                    throw new Error('SYSTEM_FAILURE: Cloud and Local failure');
                }
            }

            // Jeśli to inny błąd, nie robimy fallbacku (np. błąd walidacji promptu)
            throw error;
        }
    },

    /**
     * 🏠 Bezpośrednie uderzenie do lokalnego portu Ollamy
     */
    async fetchLocalOllama(message: string, config: DyrygentConfig): Promise<string> {
        const url = config.ollamaUrl || 'http://127.0.0.1:11435/api/generate';
        const model = config.ollamaModel || 'qwen2.5-coder:7b';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: message,
                stream: false,
            }),
        });

        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        return data.response || 'Duch lokalny milczy...';
    },

    /**
     * ⏳ Wspomaganie timeoutem
     */
    async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), ms)
        );
        return Promise.race([promise, timeout]);
    }
};
