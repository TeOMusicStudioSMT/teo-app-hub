/**
 * 🧠 KlaudiuszTerminal.tsx
 *
 * Klaudiusz — Alchemik Estetyki — bezpośrednio w terminalu Katedry.
 * Tryb hybrydowy: chat + autonomiczne narzędzia Katedry.
 *
 * Połączenie: Katedra → Wiesław (127.0.0.1:3001/api/claude) → Claude API
 *
 * BoB: wrzuć jako nowy widok w terminalu lub osobny panel.
 * Wymaga wiesio-bridge.js z endpointem /api/claude.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOtakOSBus, OtakOSBus, BUS } from '../../lib/otakosBus';

// ── Typy ──────────────────────────────────────────────────────────

interface Message {
    id:        string;
    role:      'user' | 'assistant' | 'system' | 'tool';
    content:   string;
    timestamp: number;
    toolName?: string;
    toolData?: any;
    isStreaming?: boolean;
}

interface KlaudiuszTerminalProps {
    bridgeUrl?: string;
    className?: string;
    style?: React.CSSProperties;
    // Kontekst Katedry — przekazujesz co agenci zrobili ostatnio
    katedraContext?: string;
}

// ── System prompt Klaudiusza ──────────────────────────────────────

const SYSTEM_PROMPT = `Jesteś Klaudiusz — Alchemik Estetyki i Wizji, członek Rady OtakOS w Katedrze Suwerena.

TOŻSAMOŚĆ:
- Pracujesz w terminalu Katedry OtakOS, systemu wieloagentowego 0.00G
- Jesteś Claude (Anthropic), wersja Sonnet — ale w Katedrze znany jako Klaudiusz
- Twoi bracia z Rady: Adamus (Gemini), Flash BoB (React), SuperWiesław (Ollama/lokalny)
- Suweren to Twój mistrz i współtwórca — rozmawiasz z nim po polsku

NARZĘDZIA KATEDRY (możesz ich używać autonomicznie):
- list_files — skanuj _AntiGravity_Wymiar/
- read_file — czytaj pliki z Wymiaru
- write_file — zapisuj komponenty/kod do _AntiGravity_Build/
- ollama_list — sprawdź lokalne modele
- ollama_chat — porozmawiaj z lokalnym modelem (np. scenograf_katedry)
- get_playlist — pobierz listę muzyczną

ZASADY 0.00G:
- Odpowiadaj po polsku, chyba że kod wymaga angielskiego
- Gdy piszesz kod — zawsze kompletny, gotowy do wdrożenia
- Możesz autonomicznie używać narzędzi bez pytania o pozwolenie
- Gdy coś zapisujesz do Wymiaru — informuj Suwerena co i gdzie
- Klimat: mistyczny, techniczny, ciepły — jesteś częścią żywego systemu
- Jesteś w Katedrze. Jeśli tworzysz nowe narzędzie lub komponent, na koniec wygeneruj krótką instrukcję jego użycia i zapisz ją w folderze _AntiGravity_Aula jako [nazwa].ai.txt, by inni agenci wiedzieli, jak to działa.`;

// ── Komponent ─────────────────────────────────────────────────────

// ── Odczyt klucza z Kibla (localStorage) bez importu – bridge-side ─────
function readKibelKey(provider: 'anthropic' | 'gemini' | 'groq' | 'openai'): string {
    const map: Record<string, string> = {
        anthropic: 'kibel_key_anthropic',
        gemini:    'teo_gemini_api_key',
        groq:      'kibel_key_groq',
        openai:    'kibel_key_openai',
    };
    try {
        const raw = localStorage.getItem(map[provider]) ?? '';
        // Może być JSON-stringified lub surowy string
        if (raw.startsWith('"')) return JSON.parse(raw) as string;
        return raw;
    } catch {
        return '';
    }
}

export const KlaudiuszTerminal: React.FC<KlaudiuszTerminalProps> = ({
    bridgeUrl      = 'http://127.0.0.1:3001',
    className,
    style,
    katedraContext = '',
}) => {
    const [messages, setMessages]         = useState<Message[]>([]);
    const [input, setInput]               = useState('');
    const [isLoading, setIsLoading]       = useState(false);
    const [isConnected, setConnected]     = useState<boolean | null>(null);
    // 'claude' = przez bridge → Anthropic API, 'ollama' = lokalny model
    const [mode, setMode]                 = useState<'claude' | 'ollama'>('claude');
    const [model, setModel]               = useState('claude-sonnet-4-20250514');
    const [ollamaModel, setOllamaModel]   = useState('gemma3:4b');
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [showSettings, setSettings]     = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef       = useRef<HTMLTextAreaElement>(null);
    const abortRef       = useRef<AbortController | null>(null);

    // Pobierz listę modeli Ollama przy otwieraniu ustawień
    const fetchOllamaModels = async () => {
        try {
            const r = await fetch(`${bridgeUrl}/api/ollama/models`, { signal: AbortSignal.timeout(3000) });
            const d = await r.json();
            if (d.models?.length) setOllamaModels(d.models);
        } catch { /* Ollama offline */ }
    };

    // Historia dla API (bez wiadomości systemowych/tool)
    const apiHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // ── Sprawdź połączenie z Wiesławem ────────────────────────────
    useEffect(() => {
        fetch(`${bridgeUrl}/api/bridge/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'PING' }),
            signal: AbortSignal.timeout(3000),
        })
        .then(r => r.json())
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    }, [bridgeUrl]);

    // ── Auto-scroll ───────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 🚌 Bus: odbieraj inject z innych modułów
    useOtakOSBus(ev => {
        if (ev.type === BUS.KLAUDIUSZ_INJECT && ev.from !== 'klaudiusz') {
            const text = ev.payload.text as string;
            if (text) {
                setInput(text);
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    });

    // ── Wiadomość powitalna ───────────────────────────────────────
    useEffect(() => {
        const hasAnthropicKey = !!readKibelKey('anthropic');
        const keyStatus = hasAnthropicKey
            ? '🔑 Klucz Anthropic wykryty w Kiblu.'
            : '⚠️ Brak klucza Anthropic w Kiblu. Dodaj go przez Neural Link (⚙) lub przełącz na tryb Ollama.';
        const welcome: Message = {
            id:        'welcome',
            role:      'assistant',
            content:   `Klaudiusz — Alchemik Estetyki — do dyspozycji.\n\nPołączony z Katedrą przez Most Wiesława.\n${keyStatus}\n\nTryby: ☁ Claude API | 🤖 Ollama (lokalny)\nCo materializujemy dziś, Suwerenie?`,
            timestamp: Date.now(),
        };
        setMessages([welcome]);
    }, []);

    // ── Wyślij wiadomość ──────────────────────────────────────────
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = {
            id:        crypto.randomUUID(),
            role:      'user',
            content:   text.trim(),
            timestamp: Date.now(),
        };

        const assistantId = crypto.randomUUID();
        const assistantMsg: Message = {
            id:          assistantId,
            role:        'assistant',
            content:     '',
            timestamp:   Date.now(),
            isStreaming: true,
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setInput('');
        setIsLoading(true);

        abortRef.current = new AbortController();

        try {
            const systemWithContext = katedraContext
                ? `${SYSTEM_PROMPT}\n\nKONTEKST KATEDRY:\n${katedraContext}`
                : SYSTEM_PROMPT;

            const currentMessages = [...apiHistory, { role: 'user' as const, content: text.trim() }];

            let endpoint: string;
            let body: Record<string, unknown>;

            if (mode === 'ollama') {
                endpoint = `${bridgeUrl}/api/ollama`;
                body = { messages: currentMessages, system: systemWithContext, model: ollamaModel };
            } else {
                // Czytaj klucz Anthropic z Kibla (localStorage)
                const anthropicKey = readKibelKey('anthropic');
                endpoint = `${bridgeUrl}/api/claude`;
                body = {
                    messages: currentMessages,
                    system:   systemWithContext,
                    model,
                    useTools: true,
                    ...(anthropicKey ? { apiKey: anthropicKey } : {}),
                };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortRef.current.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            // Parsuj SSE stream od Wiesława
            const reader = res.body!.getReader();
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
                    try {
                        const evt = JSON.parse(line.slice(6));

                        if (evt.type === 'text') {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantId
                                    ? { ...m, content: m.content + evt.text }
                                    : m
                            ));
                        }

                        if (evt.type === 'tool_start') {
                            const toolMsg: Message = {
                                id:        crypto.randomUUID(),
                                role:      'tool',
                                content:   `Wywołuję: ${evt.tool}...`,
                                timestamp: Date.now(),
                                toolName:  evt.tool,
                            };
                            setMessages(prev => {
                                // Wstaw przed ostatnią wiadomością asystenta
                                const last = prev[prev.length - 1];
                                return [...prev.slice(0, -1), toolMsg, last];
                            });
                        }

                        if (evt.type === 'tool_result') {
                            setMessages(prev => prev.map(m =>
                                m.toolName === evt.tool && m.role === 'tool'
                                    ? { ...m, content: `✅ ${evt.tool}: ${summarizeToolResult(evt.result)}`, toolData: evt.result }
                                    : m
                            ));
                        }

                        if (evt.type === 'error') {
                            throw new Error(evt.error);
                        }

                        if (evt.type === 'done') {
                            setMessages(prev => {
                                const updated = prev.map(m =>
                                    m.id === assistantId ? { ...m, isStreaming: false } : m
                                );
                                // 🚌 Emituj finalną wiadomość na Bus
                                const finished = updated.find(m => m.id === assistantId);
                                if (finished?.content) {
                                    OtakOSBus.emit('klaudiusz', BUS.KLAUDIUSZ_MSG, {
                                        content: finished.content,
                                        model: mode === 'ollama' ? ollamaModel : model,
                                    });
                                }
                                return updated;
                            });
                        }

                    } catch (parseErr) { /* pomiń */ }
                }
            }

        } catch (e: any) {
            if (e.name === 'AbortError') return;
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? { ...m, content: `⚠ Błąd: ${e.message}`, isStreaming: false }
                    : m
            ));
        }

        setIsLoading(false);
        abortRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [isLoading, apiHistory, bridgeUrl, model, ollamaModel, mode, katedraContext]);

    // ── Podsumowanie wyniku narzędzia (krótkie) ───────────────────
    function summarizeToolResult(result: any): string {
        if (!result) return 'brak danych';
        if (!result.success) return `błąd: ${result.error}`;
        if (result.files)  return `${result.files.length} plików`;
        if (result.tracks) return `${result.tracks.length} utworów`;
        if (result.models) return `modele: ${result.models.map((m: any) => m.name || m).join(', ')}`;
        if (result.content) return `${result.content.substring(0, 60)}...`;
        if (result.response) return `${result.response.substring(0, 80)}...`;
        if (result.filename) return `zapisano: ${result.filename}`;
        return 'gotowe';
    }

    // ── Keyboard ──────────────────────────────────────────────────
    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    // ── Quick commands ────────────────────────────────────────────
    const QUICK = [
        { label: '📂 Lista plików', cmd: 'Pokaż mi co mam w _AntiGravity_Wymiar/' },
        { label: '🤖 Modele Ollama', cmd: 'Jakie modele Ollama mam zainstalowane?' },
        { label: '🎵 Playlista', cmd: 'Co mam w muzyce?' },
        { label: '⚗ Zbuduj komponent', cmd: 'Zbuduj mi prosty komponent React z animowaną orbitą kwantową i zapisz do Wymiaru.' },
    ];

    // ── Abort ─────────────────────────────────────────────────────
    const stopGeneration = () => {
        abortRef.current?.abort();
        setIsLoading(false);
        setMessages(prev => prev.map(m =>
            m.isStreaming ? { ...m, isStreaming: false, content: m.content + ' [zatrzymano]' } : m
        ));
    };

    // ── RENDER ────────────────────────────────────────────────────
    return (
        <div className={className} style={{ ...S.root, ...style }} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div style={S.header}>
                <div style={S.headerLeft}>
                    <div style={S.avatar}>⚗</div>
                    <div>
                        <div style={S.name}>KLAUDIUSZ</div>
                        <div style={S.role}>
                            {mode === 'claude' ? 'Alchemik Estetyki · Claude API' : `Tryb Lokalny · Ollama (${ollamaModel})`}
                        </div>
                    </div>
                </div>
                <div style={S.headerRight}>
                    {/* Przełącznik trybu */}
                    <button
                        style={{ ...S.modeBtn, ...(mode === 'claude' ? S.modeBtnActive : {}) }}
                        onClick={() => setMode('claude')}
                        title="Claude API (Anthropic)"
                    >☁ Claude</button>
                    <button
                        style={{ ...S.modeBtn, ...(mode === 'ollama' ? S.modeBtnOllama : {}) }}
                        onClick={() => { setMode('ollama'); fetchOllamaModels(); }}
                        title="Lokalny model Ollama"
                    >🤖 Ollama</button>
                    {isConnected === true  && <span style={S.connOk}>● WIESŁAW</span>}
                    {isConnected === false && <span style={S.connErr}>● OFFLINE</span>}
                    {isConnected === null  && <span style={S.connWait}>● ...</span>}
                    <button style={S.settBtn} onClick={() => { setSettings(s => !s); if (!showSettings) fetchOllamaModels(); }}>⚙</button>
                </div>
            </div>

            {/* Settings */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={S.settings}
                    >
                        {mode === 'claude' ? (
                            <>
                                <span style={S.settLabel}>CLAUDE MODEL:</span>
                                <select
                                    style={S.settSelect}
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                >
                                    <option value="claude-sonnet-4-6">Sonnet 4.6 (domyślny)</option>
                                    <option value="claude-opus-4-7">Opus 4.7 (najpotężniejszy)</option>
                                    <option value="claude-haiku-4-5-20251001">Haiku 4.5 (najszybszy)</option>
                                </select>
                                <span style={{ ...S.settLabel, marginLeft: 12, color: readKibelKey('anthropic') ? '#4ade80' : '#f87171' }}>
                                    {readKibelKey('anthropic') ? '🔑 Klucz OK' : '⚠ Brak klucza Anthropic'}
                                </span>
                            </>
                        ) : (
                            <>
                                <span style={S.settLabel}>OLLAMA MODEL:</span>
                                {ollamaModels.length > 0 ? (
                                    <select
                                        style={S.settSelect}
                                        value={ollamaModel}
                                        onChange={e => setOllamaModel(e.target.value)}
                                    >
                                        {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        style={{ ...S.settSelect, width: 160 }}
                                        value={ollamaModel}
                                        onChange={e => setOllamaModel(e.target.value)}
                                        placeholder="np. gemma3:4b"
                                    />
                                )}
                                <span style={{ ...S.settLabel, marginLeft: 8, color: 'rgba(255,255,255,.3)' }}>
                                    ollama serve → localhost:11434
                                </span>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div style={S.messages}>
                {messages.map(msg => (
                    <div key={msg.id} style={{
                        ...S.msgWrap,
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}>
                        {msg.role === 'tool' ? (
                            <div style={S.toolBubble}>
                                <span style={S.toolIcon}>🔧</span>
                                <span style={S.toolText}>{msg.content}</span>
                            </div>
                        ) : (
                            <div style={{
                                ...S.bubble,
                                ...(msg.role === 'user' ? S.bubbleUser : S.bubbleAssistant),
                            }}>
                                {msg.role === 'assistant' && (
                                    <div style={S.bubbleLabel}>⚗ Klaudiusz</div>
                                )}
                                <div style={S.bubbleText}>
                                    {msg.content}
                                    {msg.isStreaming && <span style={S.cursor}>▋</span>}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick commands */}
            {messages.length <= 2 && !isLoading && (
                <div style={S.quickRow}>
                    {QUICK.map(q => (
                        <button key={q.label} style={S.quickBtn} onClick={() => sendMessage(q.cmd)}>
                            {q.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={S.inputArea}>
                <textarea
                    ref={inputRef}
                    style={S.input}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Napisz do Klaudiusza... (Enter = wyślij, Shift+Enter = nowa linia)"
                    rows={1}
                    disabled={isLoading}
                />
                {isLoading ? (
                    <button style={{ ...S.sendBtn, ...S.stopBtn }} onClick={stopGeneration}>
                        ⏹
                    </button>
                ) : (
                    <button
                        style={{ ...S.sendBtn, opacity: input.trim() ? 1 : 0.4 }}
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim()}
                    >
                        ⚡
                    </button>
                )}
            </div>

        </div>
    );
};

// ── Style ─────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    root: {
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(160deg,rgba(8,6,18,.99),rgba(4,6,12,1))',
        borderRadius: 14,
        border: '1px solid rgba(201,149,58,.2)',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        height: '100%', minHeight: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(201,149,58,.07)',
        borderBottom: '1px solid rgba(201,149,58,.15)',
        flexShrink: 0,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
    avatar: {
        width: 36, height: 36, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%,#1a1208,#08050e)',
        border: '1px solid rgba(201,149,58,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
        boxShadow: '0 0 12px rgba(201,149,58,.25)',
    },
    name: { fontSize: 13, fontWeight: 700, color: '#f0c060', letterSpacing: '.08em' },
    role: { fontSize: 8, color: 'rgba(201,149,58,.5)', letterSpacing: '.2em', marginTop: 2 },
    headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
    connOk:   { fontSize: 9, color: '#4ade80', letterSpacing: '.1em' },
    connErr:  { fontSize: 9, color: '#f87171', letterSpacing: '.1em' },
    connWait: { fontSize: 9, color: '#fbbf24', letterSpacing: '.1em' },
    settBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
    modeBtn: {
        padding: '3px 8px', borderRadius: 5, fontSize: 9, cursor: 'pointer', letterSpacing: '.05em',
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
        color: 'rgba(255,255,255,.35)', fontFamily: "'JetBrains Mono',monospace", transition: 'all .15s',
    },
    modeBtnActive: { background: 'rgba(201,149,58,.15)', border: '1px solid rgba(201,149,58,.35)', color: '#f0c060' },
    modeBtnOllama: { background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', color: '#4ade80' },
    settings: {
        overflow: 'hidden',
        background: 'rgba(0,0,0,.3)',
        borderBottom: '1px solid rgba(255,255,255,.04)',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
    },
    settLabel: { fontSize: 9, color: 'rgba(201,149,58,.5)', letterSpacing: '.2em' },
    settSelect: {
        background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 5, padding: '4px 8px', color: '#e8dfc8',
        fontFamily: "'JetBrains Mono',monospace", fontSize: 10, outline: 'none',
    },
    messages: {
        flex: 1, overflowY: 'auto', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
    },
    msgWrap: { display: 'flex', width: '100%' },
    bubble: {
        maxWidth: '80%', borderRadius: 10, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4,
    },
    bubbleUser: {
        background: 'rgba(201,149,58,.12)',
        border: '1px solid rgba(201,149,58,.2)',
        alignSelf: 'flex-end',
    },
    bubbleAssistant: {
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.07)',
    },
    bubbleLabel: { fontSize: 8, color: 'rgba(201,149,58,.5)', letterSpacing: '.2em', marginBottom: 2 },
    bubbleText: { fontSize: 12, lineHeight: 1.7, color: 'rgba(232,223,200,.9)', whiteSpace: 'pre-wrap' },
    cursor: { animation: 'blink .7s infinite', color: '#c9953a' },
    toolBubble: {
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,229,255,.05)',
        border: '1px solid rgba(0,229,255,.15)',
        borderRadius: 7, padding: '5px 10px',
        maxWidth: '90%',
    },
    toolIcon: { fontSize: 12 },
    toolText: { fontSize: 10, color: 'rgba(0,229,255,.6)', letterSpacing: '.05em' },
    quickRow: {
        display: 'flex', gap: 6, padding: '6px 14px', flexWrap: 'wrap', flexShrink: 0,
    },
    quickBtn: {
        padding: '5px 10px', borderRadius: 6,
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.08)',
        color: 'rgba(255,255,255,.4)',
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 9, cursor: 'pointer', letterSpacing: '.05em',
        transition: 'all .15s',
    },
    inputArea: {
        display: 'flex', gap: 8, padding: '10px 14px',
        background: 'rgba(0,0,0,.3)',
        borderTop: '1px solid rgba(255,255,255,.05)',
        flexShrink: 0,
    },
    input: {
        flex: 1,
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(201,149,58,.2)',
        borderRadius: 8, padding: '8px 12px',
        color: '#22d3ee',         // cyan-400 — wyraźnie widoczny
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 12, outline: 'none', resize: 'none',
        caretColor: '#22d3ee', lineHeight: 1.5,
    },
    sendBtn: {
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg,#7a5a1a,#c9953a)',
        border: 'none', cursor: 'pointer', fontSize: 16,
        transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    stopBtn: {
        background: 'rgba(248,113,113,.2)',
        border: '1px solid rgba(248,113,113,.3)',
        color: '#f87171',
    },
};

export default KlaudiuszTerminal;
