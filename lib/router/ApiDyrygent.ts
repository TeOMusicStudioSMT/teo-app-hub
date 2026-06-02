/**
 * 🛰️ ApiDyrygent.ts — Inteligentny Dyrygent API
 *
 * "Kiedy chmura zasnuje się mrokiem, Duch Lokalny rozświetla drogę."
 *
 * v2 — rozbudowanie o:
 *   dispatchFast()  — szybki agent lokalny (Klaudiusz/Qwen) przez Wiesława SSE
 *   dispatchHeavy() — ciężki model (Adamus) przez Wiesława SSE
 *   execSystem()    — wykonanie komendy shell przez Wiesława EXEC_SYSTEM
 *
 * @author BoB & TeO
 */

import { AromaType } from '../../components/TeO_Orb';
import { getDefaultStore } from 'jotai';
import { globalActiveLocalModel } from '../../store/settings';

export interface DyrygentResponse {
    message: string;
    source: 'cloud' | 'local';
    actualAroma: AromaType;
    error?: string;
}

// Adres Wiesława
const WIESLAW_URL = 'http://127.0.0.1:3001';

// Błędy aktywujące Kwantowy Fallback do lokalnego LLM
const FALLBACK_TRIGGERS = [
    'Failed to fetch',
    '429', '503', '504',
    'NETWORK_ERROR', 'TIMEOUT',
];

// ── Tarcza Ochronna — Rate-Limit Shield ───────────────────────
/** Maksymalna liczba wiadomości historii wysyłanych do chmury */
const MAX_CLOUD_HISTORY   = 10;
/** Maksymalny rozmiar payloadu (znaki) — ~400 KB */
const MAX_PAYLOAD_CHARS   = 400_000;
/** Maksymalna liczba ponownych prób przy HTTP 429 */
const RATE_LIMIT_RETRIES  = 3;
/** Bazowe opóźnienie przy 429 (ms) — rośnie liniowo: 10s, 20s, 30s */
const RATE_LIMIT_DELAY_MS = 10_000;

/** Pomocnik: czeka podaną liczbę ms */
const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

interface DyrygentConfig {
    ollamaUrl?:   string;
    ollamaModel?: string;
    timeoutMs?:   number;
}

export interface CloudModelOption {
    id:      string;   // identyfikator UI / stan localStorage
    apiId?:  string;   // fizyczny string wysyłany do API (gdy różni się od id)
    label:   string;
    tier:    'fast' | 'balanced' | 'heavy';
}

/** Rozwiąż fizyczny ID modelu do wysłania do API */
export function resolveModelApiId(modelId: string): string {
    return CLOUD_MODELS.find(m => m.id === modelId)?.apiId ?? modelId;
}

/** Załącznik obrazu (po kompresji w przeglądarce) */
export interface ImageAttachment {
    base64:          string;   // data:image/jpeg;base64,...
    mediaType:       string;   // 'image/jpeg'
    width:           number;
    height:          number;
    originalSizeKB:  number;
    compressedSizeKB: number;
    estimatedTokens: number;   // Sonnet/Opus high-res estimate
}

export const CLOUD_MODELS: CloudModelOption[] = [
    // ── Claude (Anthropic) ─────────────────────────────────────────
    { id: 'claude-haiku-4-5',           label: '⚡ Claude Haiku 4.5',                 tier: 'fast'     },
    { id: 'claude-haiku-3-5-20241022',  label: '⚡ Claude Haiku 3.5',                 tier: 'fast'     },
    { id: 'claude-sonnet-4-5',          label: '☯ Claude Sonnet 4.5',                tier: 'balanced' },
    { id: 'claude-sonnet-4-20250514',   label: '☯ Claude Sonnet 4',                  tier: 'balanced' },
    { id: 'claude-opus-4-5',            label: '🏛️ Claude Opus 4.5',                 tier: 'heavy'    },
    { id: 'claude-opus-4-20250514',     label: '🏛️ Claude Opus 4',                   tier: 'heavy'    },
    // ── Gemini (Google) ────────────────────────────────────────────
    // ─── Gemini (Google) ─────────────────────────────────────────────
    // apiId = fizyczny string wysyłany do Google API (label może być marketingowy)
    { id: 'gemini-3.1-pro',   apiId: 'gemini-1.5-pro',              label: '🏛️ Gemini 3.1 Pro (top)',           tier: 'heavy'    },
    { id: 'gemini-3-flash',   apiId: 'gemini-1.5-flash',            label: '⚡ Gemini 3 Flash (szybki)',         tier: 'fast'     },
    { id: 'gemini-2.5-pro',   apiId: 'gemini-2.5-pro-preview-05-06',label: '🏛️ Gemini 2.5 Pro Preview',         tier: 'heavy'    },
    { id: 'gemini-2.5-flash', apiId: 'gemini-2.5-flash-preview-04-17', label: '⚡ Gemini 2.5 Flash Preview',    tier: 'fast'     },
    { id: 'gemini-2.0-flash',                                         label: '⚡ Gemini 2.0 Flash',             tier: 'fast'     },
    { id: 'gemini-1.5-pro',                                           label: '🏛️ Gemini 1.5 Pro (stable)',      tier: 'heavy'    },
    { id: 'gemini-1.5-flash',                                         label: '⚡ Gemini 1.5 Flash (stable)',     tier: 'fast'     },
];

export const ApiDyrygent = {

    // ── Helpers modeli ─────────────────────────────────────────────

    /** Model szybki (Klaudiusz) — z globalnego atomu lub default */
    getFastModel(): string {
        try {
            const store = getDefaultStore();
            const active = store.get(globalActiveLocalModel);
            if (active) return active;
        } catch { /* fallthrough */ }

        if (typeof window !== 'undefined') {
            return localStorage.getItem('otakos_active_model') || 'gemma4:e2b';
        }
        return 'gemma4:e2b';
    },

    /** Model ciężki (Adamus) — z localStorage, globalnego atomu lub default */
    getHeavyModel(): string {
        if (typeof window !== 'undefined') {
            const heavy = localStorage.getItem('otakos_heavy_model');
            if (heavy) return heavy;
        }

        try {
            const store = getDefaultStore();
            const active = store.get(globalActiveLocalModel);
            if (active) return active;
        } catch { /* fallthrough */ }

        if (typeof window !== 'undefined') {
            return (
                localStorage.getItem('otakos_active_model') ||
                'gemma4:e4b'
            );
        }
        return 'gemma4:e4b';
    },

    /**
     * 🔐 Odczytaj klucz API z magazynu TeO Kibel (synchronicznie)
     *
     * Hierarchia odczytu:
     *  1. legacy backup: `kibel_key_anthropic` / `teo_gemini_api_key`  (zapisywane przez storeKey)
     *  2. skan: `kibel_key_{provider}_{uuid}` z surowym (nieszyfrowanym) kluczem w polu value
     *
     * Async deszyfrowanie (IndexedDB) — tu niedostępne, ale storeKey zawsze
     * robi plain-text backup do legacy klucza, więc wariant 1 wystarczy w 99% przypadków.
     */
    readKibelKey(provider: 'anthropic' | 'gemini'): string | null {
        if (typeof window === 'undefined') return null;

        // 1. Legacy/backup — storeKey zawsze kopiuje tutaj
        const legacyMap: Record<string, string> = {
            anthropic: 'kibel_key_anthropic',
            gemini:    'teo_gemini_api_key',
        };
        const legacy = localStorage.getItem(legacyMap[provider]);
        if (legacy) return legacy;

        // 2. Skan kluczy kibel_key_{provider}_{uuid}
        const prefix = `kibel_key_${provider}`;
        for (let i = 0; i < localStorage.length; i++) {
            const lsKey = localStorage.key(i);
            if (!lsKey?.startsWith(prefix)) continue;
            const raw = localStorage.getItem(lsKey);
            if (!raw) continue;
            try {
                if (raw.startsWith('{')) {
                    const obj = JSON.parse(raw) as { value?: string };
                    const v = obj.value;
                    // Tylko jeśli to czytelny klucz (nie zaszyfrowany Base64)
                    if (typeof v === 'string' && (
                        v.startsWith('sk-ant-') || v.startsWith('AIza') ||
                        v.startsWith('sk-') || v.startsWith('gsk_')
                    )) return v;
                } else if (raw.startsWith('sk-ant-') || raw.startsWith('AIza') || raw.startsWith('sk-')) {
                    return raw; // surowy string
                }
            } catch { /* skip */ }
        }

        return null;
    },

    /** Model chmury dla Klaudiusza (szybki) — z localStorage */
    getCloudFastModel(): string {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('otakos_cloud_fast_model') ||
                   localStorage.getItem('otakos_cloud_model') || // kompatybilność wsteczna
                   'claude-haiku-4-5';
        }
        return 'claude-haiku-4-5';
    },

    /** Model chmury dla Adamusa (ciężki) — z localStorage */
    getCloudHeavyModel(): string {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('otakos_cloud_heavy_model') ||
                   localStorage.getItem('otakos_cloud_model') || // kompatybilność wsteczna
                   'claude-sonnet-4-5';
        }
        return 'claude-sonnet-4-5';
    },

    /** @deprecated - użyj getCloudFastModel / getCloudHeavyModel */
    getCloudModel(): string { return this.getCloudFastModel(); },

    /** Pobiera listę modeli z Wiesława (Ollama) */
    async fetchOllamaModels(): Promise<string[]> {
        try {
            const res = await fetch(`${WIESLAW_URL}/api/ollama/models`);
            const data = await res.json();
            if (Array.isArray(data.models) && data.models.length > 0) return data.models as string[];
        } catch { /* fallthrough */ }
        // Fallback: bezpośrednio do Ollamy
        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            const data = await res.json();
            return ((data.models || []) as Array<{ name: string }>).map(m => m.name);
        } catch {
            return [];
        }
    },

    // ── Streaming przez Wiesława (/api/ollama SSE) ─────────────────

    /**
     * 🌊 Streamuje odpowiedź LLM przez Wiesław → Ollama /api/chat (SSE)
     *
     * NAPRAWKA v5.1: Wysyła `messages[]` zamiast `prompt` (stary format /api/generate).
     * Wiesław oczekuje: { model, messages: [{role,content}], system? }
     * i przekazuje do Ollamy: http://localhost:11434/api/chat
     *
     * @param history - opcjonalna historia (poprzednie wiadomości), domyślnie brak
     * @param system  - opcjonalny system prompt
     */
    async dispatchViaWieslaw(
        message:  string,
        model:    string,
        onToken?: (token: string) => void,
        signal?:  AbortSignal,
        history?: Array<{ role: 'user' | 'assistant'; content: string }>,
        system?:  string,
    ): Promise<string> {
        // Tarcza: przytnij historię do MAX_CLOUD_HISTORY ostatnich wiadomości
        const prunedHistory = (history ?? []).slice(-MAX_CLOUD_HISTORY);
        const messages = [
            ...prunedHistory,
            { role: 'user' as const, content: message },
        ];

        const res = await fetch(`${WIESLAW_URL}/api/ollama`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ model, messages, system }),
            signal,
        });

        if (!res.ok) {
            // Próba odczytania treści błędu od Wiesława (np. "Ollama HTTP 404")
            const errBody = await res.json().catch(() => null);
            const errMsg  = errBody?.error ?? `Wiesław ${res.status}: ${res.statusText}`;
            throw new Error(errMsg);
        }
        if (!res.body) throw new Error('Brak body w odpowiedzi Wiesława');

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let full      = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const parsed = JSON.parse(line.slice(6).trim());
                    if (parsed.type === 'text' && parsed.text) {
                        full += parsed.text;
                        onToken?.(parsed.text);
                    } else if (parsed.type === 'done') {
                        return full;
                    }
                } catch {
                    // pomiń złe linie SSE
                }
            }
        }
        return full;
    },

    // ── Publiczne dispatchery ──────────────────────────────────────

    /**
     * ⚡ Szybki agent (Klaudiusz / model aktywny)
     * Fallback: bezpośrednio do Ollamy /api/chat jeśli Wiesław offline.
     */
    async dispatchFast(
        message:  string,
        onToken?: (token: string) => void,
        signal?:  AbortSignal,
        history?: Array<{ role: 'user' | 'assistant'; content: string }>,
        system?:  string,
    ): Promise<string> {
        const model = this.getFastModel();
        console.log(`[Dyrygent] ⚡ Fast dispatch → ${model}`);
        try {
            return await this.dispatchViaWieslaw(message, model, onToken, signal, history, system);
        } catch (err: any) {
            console.error('[Dyrygent] Fast dispatch failed:', err.message);
            return await this.dispatchDirectOllama(message, model, onToken, signal, history);
        }
    },

    /**
     * 🏛️ Ciężki model (Adamus / duży model)
     * Fallback: bezpośrednio do Ollamy /api/chat jeśli Wiesław offline.
     */
    async dispatchHeavy(
        message:  string,
        onToken?: (token: string) => void,
        signal?:  AbortSignal,
        history?: Array<{ role: 'user' | 'assistant'; content: string }>,
        system?:  string,
    ): Promise<string> {
        const model = this.getHeavyModel();
        console.log(`[Dyrygent] 🏛️ Heavy dispatch → ${model}`);
        try {
            return await this.dispatchViaWieslaw(message, model, onToken, signal, history, system);
        } catch (err: any) {
            console.error('[Dyrygent] Heavy dispatch failed:', err.message);
            return await this.dispatchDirectOllama(message, model, onToken, signal, history);
        }
    },

    /**
     * 🔌 Fallback: bezpośrednio do Ollamy /api/chat (gdy Wiesław offline)
     * Streamuje przez SSE — identyczny format jak Wiesław.
     */
    async dispatchDirectOllama(
        message:  string,
        model:    string,
        onToken?: (token: string) => void,
        signal?:  AbortSignal,
        history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    ): Promise<string> {
        console.log(`[Dyrygent] 🔌 Direct Ollama fallback → ${model}`);
        const prunedHistory = (history ?? []).slice(-MAX_CLOUD_HISTORY);
        const res = await fetch('http://127.0.0.1:11434/api/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                model,
                messages: [
                    ...prunedHistory,
                    { role: 'user', content: message },
                ],
                stream:  true,
                options: { num_ctx: 8192 },
            }),
            signal,
        });
        if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}. Czy działa 'ollama serve'?`);
        if (!res.body) throw new Error('Brak body od Ollamy');

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '', buf = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const chunk = JSON.parse(line);
                    const token = chunk?.message?.content ?? '';
                    if (token) { full += token; onToken?.(token); }
                    if (chunk?.done) return full;
                } catch { /* skip */ }
            }
        }
        return full;
    },

    /**
     * ☁️ Dispatch przez chmurę (Wiesław /api/claude lub /api/gemini)
     *
     * Automatycznie wykrywa dostawcę po nazwie modelu:
     *   gemini-*  → /api/gemini  (klucz z Kibla: teo_gemini_api_key)
     *   claude-*  → /api/claude  (klucz z Kibla: kibel_key_anthropic)
     *
     * SSE format (oba endpointy emitują ten sam format):
     *   {type:'text', text:'...'}
     *   {type:'tool_start', tool:'...'}  (Claude z narzędziami)
     *   {type:'done', fullText:'...'}
     *   {type:'error', error:'...'}
     */
    async dispatchCloud(
        message:  string,
        model:    string,
        system?:  string,
        onToken?: (token: string) => void,
        signal?:  AbortSignal,
        images?:  ImageAttachment[],
        history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    ): Promise<string> {
        // Rozwiązanie fizycznego ID modelu (np. gemini-3.1-pro → gemini-1.5-pro)
        const resolvedModel = resolveModelApiId(model);
        const isGemini      = resolvedModel.startsWith('gemini-');
        const endpoint      = isGemini ? `${WIESLAW_URL}/api/gemini` : `${WIESLAW_URL}/api/claude`;
        const apiKey        = isGemini ? this.readKibelKey('gemini') : this.readKibelKey('anthropic');

        console.log(`[Dyrygent] ☁️ Cloud dispatch → ${endpoint} (${model}→${resolvedModel})`);
        if (!apiKey) {
            const provider = isGemini ? 'Gemini' : 'Anthropic';
            throw new Error(
                `Brak klucza ${provider} w TeO Kibel. ` +
                `Dodaj klucz ${isGemini ? 'AIza...' : 'sk-ant-...'} przez TeO Kibel.`
            );
        }

        // Buduj content z opcjonalnymi obrazami
        let userContent: any;
        if (images && images.length > 0) {
            if (isGemini) {
                // Gemini: parts z inlineData
                const parts: any[] = images.map(img => ({
                    inlineData: {
                        mimeType: img.mediaType,
                        data:     img.base64.split(',')[1] ?? img.base64,
                    },
                }));
                parts.push({ text: message });
                userContent = parts; // Wiesław /api/gemini obsłuży jako parts[]
            } else {
                // Claude: content array z image blokamiliterally
                const parts: any[] = images.map(img => ({
                    type:   'image',
                    source: {
                        type:       'base64',
                        media_type: img.mediaType as any,
                        data:       img.base64.split(',')[1] ?? img.base64,
                    },
                }));
                parts.push({ type: 'text', text: message });
                userContent = parts;
            }
        } else {
            userContent = message;
        }

        // Buduj multi-turn messages: historia + aktualna wiadomość
        const prunedHistory = (history ?? []).slice(-MAX_CLOUD_HISTORY);
        const messages = [
            ...prunedHistory,
            { role: 'user', content: userContent },
        ];

        // ── Tarcza: Blokada gigantycznych paczek ──────────────────────
        const bodyStr = JSON.stringify({
            messages,
            model:    resolvedModel,
            system,
            useTools: !isGemini,
            apiKey,
        });
        if (bodyStr.length > MAX_PAYLOAD_CHARS) {
            throw new Error(
                `Osiągnięto masę krytyczną pakietu ` +
                `(${(bodyStr.length / 1024).toFixed(0)} KB), zoptymalizuj załączniki`
            );
        }

        // ── Tarcza: Exponential Backoff przy HTTP 429 ─────────────────
        let full = '';
        for (let attempt = 1; attempt <= RATE_LIMIT_RETRIES; attempt++) {
            const res = await fetch(endpoint, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    bodyStr,
                signal,
            });

            // Limit zapytań — poczekaj i spróbuj ponownie
            if (res.status === 429) {
                if (attempt < RATE_LIMIT_RETRIES) {
                    const delay = RATE_LIMIT_DELAY_MS * attempt; // 10s, 20s, 30s
                    console.warn(
                        `[Dyrygent] ⏳ Rate limit (429) — próba ${attempt}/${RATE_LIMIT_RETRIES}. ` +
                        `Czekam ${delay / 1000}s...`
                    );
                    onToken?.(`\n*⏳ Limit API osiągnięty — ponawianie za ${delay / 1000}s (próba ${attempt}/${RATE_LIMIT_RETRIES})...*\n`);
                    await sleep(delay);
                    continue;
                }
                // Wyczerpano próby
                throw new Error(
                    `Limit zapytań API (429) wyczerpany po ${RATE_LIMIT_RETRIES} próbach. ` +
                    `Odczekaj chwilę lub zmień model.`
                );
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as any)?.error || `${isGemini ? 'Gemini' : 'Claude'} proxy ${res.status}: ${res.statusText}`);
            }
            if (!res.body) throw new Error('Brak body w odpowiedzi proxy');

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const parsed = JSON.parse(line.slice(6).trim()) as any;
                        if (parsed.type === 'text' && parsed.text) {
                            full += parsed.text;
                            onToken?.(parsed.text);
                        } else if (parsed.type === 'tool_start') {
                            const notice = `\n*🔧 Narzędzie: ${parsed.tool}...*\n`;
                            full += notice;
                            onToken?.(notice);
                        } else if (parsed.type === 'done') {
                            return full || (parsed.fullText as string) || '';
                        } else if (parsed.type === 'error') {
                            throw new Error(parsed.error as string);
                        }
                    } catch (e: any) {
                        if (e.message && !e.message.startsWith('Unexpected token')) throw e;
                    }
                }
            }
            // Jeśli doszliśmy tutaj — stream zakończony bez {type:'done'}
            return full;
        }
        return full;
    },

    /**
     * ⚙️ Wykonaj komendę shell przez Wiesława (EXEC_SYSTEM)
     * Zwraca: { success, output, raw }
     */
    async execSystem(
        command:  string,
        timeout = 120000,
    ): Promise<{ success: boolean; output: string; raw: any }> {
        console.log(`[Dyrygent] ⚙️ execSystem: ${command.substring(0, 80)}`);
        try {
            const res = await fetch(`${WIESLAW_URL}/api/bridge/execute`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    action:  'EXEC_SYSTEM',
                    command,                       // Szuflada 1 (body.command)
                    payload: { command, timeout }, // Szuflada 2 (body.payload.command)
                    timeout,
                }),
            });
            const data = await res.json();
            if (data.success) {
                return { success: true, output: data.response || '', raw: data };
            }
            return { success: false, output: data.message || 'Błąd Wiesława', raw: data };
        } catch (err: any) {
            return { success: false, output: `[Wiesław offline: ${err.message}]`, raw: null };
        }
    },

    // ── Moderator — trzecia tożsamość ────────────────────────────

    /**
     * 🔍 Moderator — autonomiczny obserwator rozmowy (Trzeci Agent)
     *
     * Uruchamiany w tle po każdej odpowiedzi AI.
     * Analizuje wymianę i decyduje czy wtrącić się.
     * Odpowiedź: "[BRAK_INTERWENCJI]" (cicho) LUB "[MODERATOR] ..." (wtrącenie).
     *
     * Architektura: fire-and-forget z KatedraChat.
     * Model: fast (szybki, nie blokuje głównego przepływu).
     */
    async dispatchModerator(
        context:  string,
        signal?:  AbortSignal,
    ): Promise<string> {
        const MODERATOR_PROMPT =
            `Jesteś Moderatorem — neutralnym obserwatorem rozmowy w Katedrze OtakOS.\n` +
            `Twoja rola: cicha analiza, minimalna ingerencja.\n` +
            `Wtrąć się TYLKO gdy wykryjesz:\n` +
            `  - sprzeczność logiczną lub błąd faktyczny\n` +
            `  - temat krytyczny dla bezpieczeństwa systemu\n` +
            `  - pętlę nieskończoną lub deadlock w rozumowaniu\n` +
            `  - konieczność mediacji między agentami\n` +
            `Jeśli NIE ma powodu — odpowiedz DOKŁADNIE: [BRAK_INTERWENCJI]\n` +
            `Jeśli chcesz się wtrącić — napisz zwięźle (max 2 zdania), zacznij od: [MODERATOR]\n\n` +
            `--- ANALIZA WYMIANY ---\n` + context;

        const model = this.getFastModel();
        console.log(`[Dyrygent] 🔍 Moderator → ${model}`);
        try {
            return await this.dispatchViaWieslaw(MODERATOR_PROMPT, model, undefined, signal);
        } catch {
            return '[BRAK_INTERWENCJI]'; // Moderator milczy gdy offline
        }
    },

    // ── Oryginalne metody (zachowane) ─────────────────────────────

    /**
     * 🎯 Główna funkcja z inteligentnym fallbackiem (chmura → Ollama)
     */
    async dispatchWithFallback(
        message:      string,
        primaryAroma: AromaType,
        config:       DyrygentConfig,
        cloudHandler: (msg: string) => Promise<string>,
    ): Promise<DyrygentResponse> {

        if (primaryAroma === 'ollama') {
            try {
                const response = await this.fetchLocalOllama(message, config);
                return { message: response, source: 'local', actualAroma: 'ollama' };
            } catch (err) {
                return {
                    message: 'Ollama milczy... Sprawdź reaktor.',
                    source: 'local', actualAroma: 'ollama', error: String(err),
                };
            }
        }

        try {
            console.log(`[Dyrygent] ☁️ Próba chmury (${primaryAroma})...`);
            const response = await this.withTimeout(cloudHandler(message), config.timeoutMs || 10000);
            return { message: response, source: 'cloud', actualAroma: primaryAroma };

        } catch (error: any) {
            const errorMsg = error.message || String(error);
            if (FALLBACK_TRIGGERS.some(t => errorMsg.includes(t))) {
                console.warn(`[Dyrygent] 🌩️ Chmura padła: ${errorMsg}. Aktywuję Lokalnego Ducha!`);
                try {
                    const localResponse = await this.fetchLocalOllama(message, config);
                    return { message: localResponse, source: 'local', actualAroma: 'ollama' };
                } catch (localError) {
                    console.error(`[Dyrygent] 💀 Całkowita ciemność.`, localError);
                    throw new Error('SYSTEM_FAILURE: Cloud and Local failure');
                }
            }
            throw error;
        }
    },

    /**
     * 🏠 Bezpośrednie uderzenie do lokalnego portu Ollamy (fallback)
     */
    async fetchLocalOllama(message: string, config: DyrygentConfig): Promise<string> {
        const url   = config.ollamaUrl   || 'http://127.0.0.1:11435/api/generate';
        const model = config.ollamaModel || 'qwen2.5-coder:7b';

        const response = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ model, prompt: message, stream: false }),
        });

        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        return data.response || 'Duch lokalny milczy...';
    },

    /** ⏳ Wrapper timeoutu */
    async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), ms)
        );
        return Promise.race([promise, timeout]);
    },
};
