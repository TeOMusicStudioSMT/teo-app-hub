/**
 * 🧩 LocalModelAdapter — Warstwa Adaptera Lokalnego (Inference Bridge)
 *
 * Izoluje TeO-Sim Academy od konkretnego modelu (Gemma/Mistral). Kieruje
 * zapytania przez most Wiesława (/api/ollama, SSE) zamiast bezpośrednio do
 * Ollamy — omija CORS i korzysta z NADRZĘDNEGO modelu z Interfejsu Wiesi
 * (klucz localStorage 'otakos_active_model', spójny string po fixie storage).
 *
 * "Fabryka Tokenów Wnioskujących": zero opłat korporacyjnych — lokalny rdzeń.
 */

const BRIDGE_OLLAMA = 'http://127.0.0.1:3001/api/ollama';

export interface ModelResponse {
    content:    string;
    tokensUsed: number;   // przybliżenie: liczba słów (brak eval_count z SSE chat)
    model:      string;
    error?:     boolean;
}

export class LocalModelAdapter {
    /** Aktywny rdzeń z Interfejsu Wiesi (nadrzędne źródło prawdy). */
    private getModel(): string {
        try { return localStorage.getItem('otakos_active_model') || 'gemma4'; }
        catch { return 'gemma4'; }
    }

    /**
     * Zapytanie do lokalnego modelu przez most (SSE → pełny tekst).
     * @param prompt        Treść zapytania.
     * @param systemPrompt  Rola systemowa.
     */
    async query(
        prompt: string,
        systemPrompt = 'Jesteś agentem analizy systemowej TeO-Sim. Odpowiadaj zwięźle i technicznie.',
    ): Promise<ModelResponse> {
        const model = this.getModel();
        try {
            const res = await fetch(BRIDGE_OLLAMA, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ model, system: systemPrompt, messages: [{ role: 'user', content: prompt }] }),
            });
            if (!res.ok || !res.body) throw new Error(`Most HTTP ${res.status}`);

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '', content = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const evt = JSON.parse(line.slice(6));
                        if (evt.type === 'text' && evt.text) content += evt.text;
                        if (evt.type === 'error') throw new Error(evt.error);
                    } catch (e: any) {
                        if (e?.message && !e.message.includes('JSON')) throw e;
                    }
                }
            }
            const trimmed = content.trim();
            return { content: trimmed, tokensUsed: trimmed.split(/\s+/).filter(Boolean).length, model };
        } catch (error: any) {
            console.error('[LocalModelAdapter] Błąd lokalnego modelu:', error.message);
            return { content: 'BŁĄD_VRAM_STALL', tokensUsed: 0, model, error: true };
        }
    }
}
