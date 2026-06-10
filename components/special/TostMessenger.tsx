/**
 * 💬 TostMessenger — TOST: TeO Secret Messenger
 *
 * Szyfrowany komunikator wewnętrzny Katedry OtakOS.
 * AI: TeO (Tactical Electronic Officer) napędzany Gemma 4 (Ollama LOCAL — 100% offline)
 * Skarbiec: _AntiGravity_Wymiar/secure/tost_vault.json
 *
 * Styl: Zielony cyberpunk / terminal szpiegowski — Tailwind CSS
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Stałe ────────────────────────────────────────────────────────────────────
const BRIDGE_URL = 'http://127.0.0.1:3001';

// ─── Typy ─────────────────────────────────────────────────────────────────────
type Role = 'user' | 'model';

interface TostMessage {
    id:        string;
    role:      Role;
    text:      string;
    image?:    string | null;
    timestamp: string;
    isTyping?: boolean; // tylko lokalnie podczas oczekiwania
}

// ─── TostMessenger ────────────────────────────────────────────────────────────

const TostMessenger: React.FC = () => {

    // ── State ─────────────────────────────────────────────────────────────────
    const [messages,     setMessages]     = useState<TostMessage[]>([]);
    const [inputText,    setInputText]    = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
    const [isSending,    setIsSending]    = useState(false);
    const [isLoading,    setIsLoading]    = useState(true);
    const [clearing,     setClearing]     = useState(false);
    const [bridgeOnline, setBridgeOnline] = useState(true);

    const bottomRef   = useRef<HTMLDivElement>(null);
    const fileRef     = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ── Ładowanie historii ────────────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        try {
            const res  = await fetch(`${BRIDGE_URL}/api/tost/messages`);
            if (!res.ok) { setBridgeOnline(false); return; }
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages ?? []);
                setBridgeOnline(true);
            }
        } catch (_) {
            setBridgeOnline(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // ── Auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Wybór pliku ───────────────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    // ── Wyślij wiadomość ──────────────────────────────────────────────────────
    const handleSend = useCallback(async () => {
        if ((!inputText.trim() && !selectedFile) || isSending) return;

        const text        = inputText.trim();
        const file        = selectedFile;
        const preview     = previewUrl;
        const mimeType    = file?.type ?? 'image/jpeg';

        setInputText('');
        clearFile();
        setIsSending(true);

        // Optymistyczne dodanie wiadomości użytkownika lokalnie
        const localUserMsg: TostMessage = {
            id:        `local_${Date.now()}`,
            role:      'user',
            text,
            image:     preview,
            timestamp: new Date().toISOString(),
        };
        const localTypingMsg: TostMessage = {
            id:        'typing',
            role:      'model',
            text:      '...',
            timestamp: new Date().toISOString(),
            isTyping:  true,
        };

        setMessages(prev => [...prev, localUserMsg, localTypingMsg]);

        try {
            // Konwertuj plik na base64 jeśli podany
            let imageBase64: string | null = null;
            if (file) {
                imageBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror   = reject;
                    reader.readAsDataURL(file);
                });
            }

            const res  = await fetch(`${BRIDGE_URL}/api/tost/send`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ text, imageBase64, mimeType }),
            });
            const data = await res.json();

            if (data.success) {
                // Usuń lokalne wiadomości i odśwież z serwera
                await fetchHistory();
            } else {
                // Zastąp "typing" komunikatem błędu
                setMessages(prev => prev
                    .filter(m => m.id !== 'typing')
                    .concat({
                        id:        `err_${Date.now()}`,
                        role:      'model',
                        text:      `[BŁĄD TRANSMISJI] ${data.message ?? 'Nieznany błąd.'}`,
                        timestamp: new Date().toISOString(),
                    })
                );
            }
        } catch (err: any) {
            setMessages(prev => prev
                .filter(m => m.id !== 'typing')
                .concat({
                    id:        `err_${Date.now()}`,
                    role:      'model',
                    text:      `[MOST OFFLINE] ${err.message}`,
                    timestamp: new Date().toISOString(),
                })
            );
        } finally {
            setIsSending(false);
        }
    }, [inputText, selectedFile, previewUrl, isSending, fetchHistory]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── Wyczyść historię ──────────────────────────────────────────────────────
    const handleClear = async () => {
        if (!window.confirm('Wyczyścić historię transmisji? Tej operacji nie można cofnąć.')) return;
        setClearing(true);
        try {
            await fetch(`${BRIDGE_URL}/api/tost/messages`, { method: 'DELETE' });
            setMessages([]);
        } catch (_) { /* bridge offline */ }
        finally { setClearing(false); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div
            className="flex flex-col w-full font-mono"
            style={{
                background:  'rgba(2, 8, 4, 0.97)',
                minHeight:   '480px',
                maxHeight:   '680px',
                borderTop:   '1px solid rgba(34,197,94,0.15)',
            }}
        >
            {/* ══ Nagłówek ══ */}
            <div
                className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                style={{
                    borderBottom: '1px solid rgba(34,197,94,0.2)',
                    background:   'rgba(0, 10, 4, 0.95)',
                    boxShadow:    '0 2px 12px rgba(34,197,94,0.06)',
                }}
            >
                <div className="flex items-center gap-3">
                    {/* Status dot */}
                    <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-green-400"
                    />
                    <div>
                        <span
                            className="text-sm font-bold tracking-[0.25em] uppercase"
                            style={{ color: '#22c55e', textShadow: '0 0 8px rgba(34,197,94,0.6)' }}
                        >
                            TOST{' '}
                            <span className="text-slate-600 font-normal text-xs">//</span>
                            {' '}TeO
                        </span>
                        <p className="text-[8px] text-green-900 tracking-widest uppercase mt-0.5">
                            ● LOCAL OFFLINE · GEMMA4 · SECURE
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[8px] text-slate-700 font-mono">
                        {messages.length} transm.
                    </span>
                    <button
                        onClick={handleClear}
                        disabled={clearing || messages.length === 0}
                        className="text-[8px] font-mono text-slate-700 hover:text-red-500 transition-colors px-2 py-1 rounded border border-transparent hover:border-red-800/40 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Wyczyść historię"
                    >
                        {clearing ? '...' : '🗑 CLEAR'}
                    </button>
                </div>
            </div>

            {/* ══ Obszar czatu ══ */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: '460px' }}>
                {isLoading ? (
                    <div className="flex items-center justify-center h-full py-12">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                            className="w-5 h-5 rounded-full border-2 border-green-700 border-t-transparent"
                        />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <motion.div
                            animate={{ opacity: [0.3, 0.7, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2.5 }}
                            className="text-3xl"
                        >
                            📡
                        </motion.div>
                        <p className="text-[9px] text-green-900 font-mono text-center leading-relaxed">
                            Kanał szyfrowany aktywny.<br />
                            <span className="text-slate-700">Czekam na Twoją transmisję, Agencie.</span>
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map(msg => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className="max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed"
                                    style={{
                                        background: msg.role === 'user'
                                            ? 'rgba(15, 25, 15, 0.9)'
                                            : 'rgba(0, 20, 8, 0.85)',
                                        color:  msg.role === 'user' ? '#e2e8f0' : '#22c55e',
                                        border: msg.role === 'user'
                                            ? '1px solid rgba(100,116,139,0.3)'
                                            : '1px solid rgba(21,128,61,0.4)',
                                        borderRadius: msg.role === 'user'
                                            ? '12px 12px 0 12px'
                                            : '12px 12px 12px 0',
                                        boxShadow: msg.role === 'model'
                                            ? '0 0 8px rgba(34,197,94,0.08)'
                                            : 'none',
                                    }}
                                >
                                    {msg.image && (
                                        <img
                                            src={msg.image}
                                            alt="transmisja"
                                            className="max-w-full rounded mb-2"
                                            style={{ border: '1px solid rgba(21,128,61,0.4)' }}
                                        />
                                    )}
                                    {msg.isTyping ? (
                                        <motion.span
                                            animate={{ opacity: [1, 0.3, 1] }}
                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                        >
                                            ▍
                                        </motion.span>
                                    ) : (
                                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                                    )}
                                    <div className="text-[7px] mt-1 opacity-30">
                                        {msg.role === 'model' ? 'TeO // ' : ''}
                                        {new Date(msg.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
                <div ref={bottomRef} />
            </div>

            {/* ══ Obszar inputu ══ */}
            <div
                className="flex-shrink-0 px-4 py-3"
                style={{
                    borderTop:  '1px solid rgba(34,197,94,0.15)',
                    background: 'rgba(0, 8, 3, 0.95)',
                }}
            >
                {/* Podgląd obrazu */}
                <AnimatePresence>
                    {previewUrl && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex gap-2 mb-2 overflow-hidden"
                        >
                            <div className="relative inline-block">
                                <img
                                    src={previewUrl}
                                    alt="preview"
                                    className="h-14 rounded"
                                    style={{ border: '1px solid rgba(34,197,94,0.4)' }}
                                />
                                <button
                                    onClick={clearFile}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center leading-none"
                                >
                                    ×
                                </button>
                            </div>
                            <span className="text-[8px] text-green-800 self-end pb-1 font-mono">
                                {selectedFile?.name}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Wiersz inputu */}
                <div className="flex gap-2 items-end">
                    {/* Przycisk załącznika */}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileRef}
                        onChange={handleFileSelect}
                    />
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="flex-shrink-0 p-2 rounded transition-colors"
                        style={{
                            background: 'transparent',
                            border:     '1px solid rgba(34,197,94,0.3)',
                            color:      '#22c55e',
                        }}
                        title="Załącz obraz"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                    </button>

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Wpisz tajną wiadomość... (Enter = wyślij)"
                        rows={1}
                        disabled={isSending}
                        className="flex-1 resize-none text-xs rounded px-3 py-2 outline-none transition-colors font-mono disabled:opacity-50"
                        style={{
                            background:  'rgba(0, 12, 5, 0.8)',
                            border:      '1px solid rgba(34,197,94,0.2)',
                            color:       '#e2e8f0',
                            minHeight:   '36px',
                            maxHeight:   '120px',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'; }}
                        onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.2)'; }}
                    />

                    {/* Przycisk wyślij */}
                    <motion.button
                        onClick={handleSend}
                        disabled={isSending || (!inputText.trim() && !selectedFile)}
                        whileHover={{ scale: isSending ? 1 : 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="flex-shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                            background: isSending ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.85)',
                            color:      isSending ? '#22c55e' : '#000',
                            border:     '1px solid rgba(34,197,94,0.4)',
                            boxShadow:  isSending ? 'none' : '0 0 10px rgba(34,197,94,0.2)',
                            cursor:     isSending ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isSending ? (
                            <motion.span
                                animate={{ opacity: [1, 0.4, 1] }}
                                transition={{ repeat: Infinity, duration: 0.7 }}
                            >
                                ···
                            </motion.span>
                        ) : 'WYŚLIJ'}
                    </motion.button>
                </div>

                {/* Stopka */}
                <p className="text-[7px] font-mono text-green-950 mt-1.5 text-center tracking-widest">
                    E2E · GEMMA4 LOCAL · OFFLINE · BRAK CHMURY · KATEDRA OTAKOS
                </p>
            </div>
        </div>
    );
};

export default TostMessenger;
