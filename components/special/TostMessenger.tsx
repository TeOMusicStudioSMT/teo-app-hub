/**
 * 💬 TostMessenger — TOST: TeO Secret Messenger
 *
 * Szyfrowany komunikator wewnętrzny Katedry OtakOS.
 * AI: TeO (Tactical Electronic Officer) napędzany Gemma 4 (Ollama LOCAL — 100% offline)
 * P2P: Szmaragdowy Tunel przez Bridge SSE Relay
 * Skarbiec: _AntiGravity_Wymiar/secure/tost_vault.json
 *
 * Styl: Zielony cyberpunk / terminal szpiegowski — Tailwind CSS
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Stałe ────────────────────────────────────────────────────────────────────
const BRIDGE_URL = 'http://127.0.0.1:3001';

// ─── Typy ─────────────────────────────────────────────────────────────────────
type Role  = 'user' | 'model';
type Owner = 'local' | 'remote';

interface TostMessage {
    id:        string;
    role:      Role;
    text:      string;
    image?:    string | null;
    timestamp: string;
    owner?:    Owner;
    isTyping?: boolean;
}

// ─── MatrixRain — canvas efekt szumu/deszczu ─────────────────────────────────
const MatrixRain: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId = 0;

        const setup = () => {
            canvas.width  = canvas.clientWidth  || 320;
            canvas.height = canvas.clientHeight || 120;
        };
        setup();

        const FONT  = 11;
        const CHARS = '01ABCDEF#$%@&*ΩΣΔΘΛΞΨΦαβγδεζ><{}[]|/\\テオ';
        const cols  = Math.max(1, Math.floor(canvas.width / FONT));
        const drops = Array.from({ length: cols }, () => Math.random() * -60);

        const draw = () => {
            ctx.fillStyle = 'rgba(0,8,2,0.07)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            drops.forEach((y, i) => {
                const bright = Math.random() > 0.93;
                ctx.fillStyle = bright ? '#86efac' : '#15803d';
                ctx.font = `${FONT}px monospace`;
                ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FONT, y);
                drops[i] = y > canvas.height && Math.random() > 0.975 ? 0 : y + FONT;
            });

            animId = requestAnimationFrame(draw);
        };
        draw();

        return () => cancelAnimationFrame(animId);
    }, []);

    return <canvas ref={canvasRef} className="w-full h-full" />;
};

// ─── mergeLiveStreams ─────────────────────────────────────────────────────────
function mergeLiveStreams(localHistory: TostMessage[], remoteStream: TostMessage[]): TostMessage[] {
    const all = [
        ...localHistory.map(m => ({ ...m, owner: (m.owner ?? 'local') as Owner })),
        ...remoteStream.map(m => ({ ...m, owner: 'remote' as Owner })),
    ];
    return all.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

// ─── TostMessenger ────────────────────────────────────────────────────────────
const TostMessenger: React.FC = () => {

    // ── Podstawowy state ──────────────────────────────────────────────────────
    const [messages,     setMessages]     = useState<TostMessage[]>([]);
    const [inputText,    setInputText]    = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
    const [isSending,    setIsSending]    = useState(false);
    const [isLoading,    setIsLoading]    = useState(true);
    const [clearing,     setClearing]     = useState(false);

    // ── P2P state ─────────────────────────────────────────────────────────────
    const [showTerminal,   setShowTerminal]   = useState(false);
    const [myToken,        setMyToken]        = useState<string | null>(null);
    const [peerTokenInput, setPeerTokenInput] = useState('');
    const [p2pConnected,   setP2pConnected]   = useState(false);
    const [p2pPeerCount,   setP2pPeerCount]   = useState(0);
    const [remoteMessages, setRemoteMessages] = useState<TostMessage[]>([]);
    const [p2pLoading,     setP2pLoading]     = useState(false);
    const [tokenCopied,    setTokenCopied]    = useState(false);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const bottomRef      = useRef<HTMLDivElement>(null);
    const fileRef        = useRef<HTMLInputElement>(null);
    const textareaRef    = useRef<HTMLTextAreaElement>(null);
    const evtSourceRef   = useRef<EventSource | null>(null);
    const activeTokenRef = useRef<string | null>(null);
    const senderIdRef    = useRef<string>(`local_${Math.random().toString(36).slice(2, 9)}`);

    // ── Merged stream (lokalne + zdalne, posortowane po timestamp) ────────────
    const mergedMessages = useMemo(
        () => mergeLiveStreams(messages, remoteMessages),
        [messages, remoteMessages]
    );

    // ── Historia z vault ──────────────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        try {
            const res  = await fetch(`${BRIDGE_URL}/api/tost/messages`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) setMessages(data.messages ?? []);
        } catch { /* bridge offline */ }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // ── Auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mergedMessages]);

    // ── Cleanup SSE przy odmontowaniu ─────────────────────────────────────────
    useEffect(() => {
        return () => { evtSourceRef.current?.close(); };
    }, []);

    // ── P2P: subskrypcja SSE ──────────────────────────────────────────────────
    const subscribeP2P = useCallback((token: string) => {
        evtSourceRef.current?.close();
        activeTokenRef.current = token;

        const es = new EventSource(`${BRIDGE_URL}/api/tost/p2p/stream/${token}`);
        evtSourceRef.current = es;

        es.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.type === 'ping') return;

                if (msg.type === 'peer_joined' || msg.type === 'peer_left') {
                    const count = msg.peerCount ?? 0;
                    setP2pPeerCount(count);
                    setP2pConnected(count >= 2);
                    return;
                }

                if (msg.type === 'message' && msg.senderId !== senderIdRef.current) {
                    // Wiadomość od rówieśnika — RAM only, nie trafia do vault
                    setRemoteMessages(prev => [...prev, {
                        id:        msg.id,
                        role:      'user' as Role,
                        text:      msg.text,
                        image:     msg.imageBase64 || null,
                        timestamp: msg.timestamp,
                        owner:     'remote' as Owner,
                    }]);
                }
            } catch { /* zły JSON */ }
        };

        es.onerror = () => setP2pConnected(false);
    }, []);

    // ── P2P: generuj własny token ─────────────────────────────────────────────
    const handleP2PInit = useCallback(async () => {
        setP2pLoading(true);
        try {
            const res  = await fetch(`${BRIDGE_URL}/api/tost/p2p/init`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setMyToken(data.token);
                subscribeP2P(data.token);
            }
        } catch (e: any) {
            console.error('[TOST-P2P]', e.message);
        } finally {
            setP2pLoading(false);
        }
    }, [subscribeP2P]);

    // ── P2P: połącz przez token partnera ─────────────────────────────────────
    const handleP2PConnect = useCallback(async () => {
        const token = peerTokenInput.trim().toUpperCase();
        if (!token) return;
        setP2pLoading(true);
        try {
            subscribeP2P(token);
            setMyToken(token);
        } finally {
            setP2pLoading(false);
            setPeerTokenInput('');
        }
    }, [peerTokenInput, subscribeP2P]);

    // ── P2P: rozłącz ─────────────────────────────────────────────────────────
    const handleP2PDisconnect = useCallback(() => {
        evtSourceRef.current?.close();
        evtSourceRef.current   = null;
        activeTokenRef.current = null;
        setMyToken(null);
        setP2pConnected(false);
        setP2pPeerCount(0);
        setRemoteMessages([]);
    }, []);

    // ── Kopiuj token do schowka ───────────────────────────────────────────────
    const copyToken = async () => {
        if (!myToken) return;
        try {
            await navigator.clipboard.writeText(myToken);
            setTokenCopied(true);
            setTimeout(() => setTokenCopied(false), 2000);
        } catch { /* no clipboard API */ }
    };

    // ── Wybór pliku ───────────────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const f = e.target.files[0];
            setSelectedFile(f);
            setPreviewUrl(URL.createObjectURL(f));
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

        const text     = inputText.trim();
        const file     = selectedFile;
        const preview  = previewUrl;
        const mimeType = file?.type ?? 'image/jpeg';

        setInputText('');
        clearFile();
        setIsSending(true);

        const localUserMsg: TostMessage = {
            id:        `local_${Date.now()}`,
            role:      'user',
            text,
            image:     preview,
            timestamp: new Date().toISOString(),
            owner:     'local',
        };
        const typingMsg: TostMessage = {
            id:        'typing',
            role:      'model',
            text:      '...',
            timestamp: new Date().toISOString(),
            isTyping:  true,
            owner:     'local',
        };

        setMessages(prev => [...prev, localUserMsg, typingMsg]);

        try {
            let imageBase64: string | null = null;
            if (file) {
                imageBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror   = reject;
                    reader.readAsDataURL(file);
                });
            }

            // 1. Lokalne vault + Gemma4 (zawsze)
            const bridgeRes  = await fetch(`${BRIDGE_URL}/api/tost/send`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ text, imageBase64, mimeType }),
            });
            const bridgeData = await bridgeRes.json();

            if (bridgeData.success) {
                await fetchHistory();
            } else {
                setMessages(prev => prev
                    .filter(m => m.id !== 'typing')
                    .concat({ id: `err_${Date.now()}`, role: 'model', text: `[BŁĄD] ${bridgeData.message ?? 'Nieznany błąd.'}`, timestamp: new Date().toISOString(), owner: 'local' })
                );
            }

            // 2. P2P relay (jeśli tunel aktywny) — tekst do rówieśnika, non-blocking
            const token = activeTokenRef.current;
            if (token) {
                fetch(`${BRIDGE_URL}/api/tost/p2p/message/${token}`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        text,
                        imageBase64,
                        timestamp: localUserMsg.timestamp,
                        senderId:  senderIdRef.current,
                    }),
                }).catch(() => { /* P2P opcjonalne */ });
            }

        } catch (err: any) {
            setMessages(prev => prev
                .filter(m => m.id !== 'typing')
                .concat({ id: `err_${Date.now()}`, role: 'model', text: `[MOST OFFLINE] ${err.message}`, timestamp: new Date().toISOString(), owner: 'local' })
            );
        } finally {
            setIsSending(false);
        }
    }, [inputText, selectedFile, previewUrl, isSending, fetchHistory]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // ── Wyczyść historię ──────────────────────────────────────────────────────
    const handleClear = async () => {
        if (!window.confirm('Wyczyścić historię transmisji? Tej operacji nie można cofnąć.')) return;
        setClearing(true);
        try {
            await fetch(`${BRIDGE_URL}/api/tost/messages`, { method: 'DELETE' });
            setMessages([]);
            setRemoteMessages([]);
        } catch { /* bridge offline */ }
        finally { setClearing(false); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div
            className="flex flex-col w-full font-mono"
            style={{
                background: 'rgba(2, 8, 4, 0.97)',
                minHeight:  '480px',
                maxHeight:  '780px',
                borderTop:  '1px solid rgba(34,197,94,0.15)',
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
                            TOST <span className="text-slate-600 font-normal text-xs">//</span> TeO
                        </span>
                        <p className="text-[8px] text-green-900 tracking-widest uppercase mt-0.5">
                            ● LOCAL OFFLINE · GEMMA4 · SECURE
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Przycisk Szmaragdowego Terminalu */}
                    <button
                        onClick={() => setShowTerminal(v => !v)}
                        className="text-[8px] font-mono px-2 py-1 rounded border transition-all tracking-widest uppercase"
                        style={{
                            background: showTerminal ? 'rgba(34,197,94,0.12)' : 'transparent',
                            border:     showTerminal ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent',
                            color:      showTerminal ? '#22c55e' : '#374151',
                        }}
                        title="Szmaragdowy Terminal P2P"
                    >
                        📟 P2P{p2pConnected && <span className="ml-1 text-green-400">●</span>}
                    </button>

                    <span className="text-[8px] text-slate-700 font-mono">
                        {mergedMessages.filter(m => !m.isTyping).length} transm.
                    </span>
                    <button
                        onClick={handleClear}
                        disabled={clearing || (messages.length === 0 && remoteMessages.length === 0)}
                        className="text-[8px] font-mono text-slate-700 hover:text-red-500 transition-colors px-2 py-1 rounded border border-transparent hover:border-red-800/40 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {clearing ? '...' : '🗑 CLEAR'}
                    </button>
                </div>
            </div>

            {/* ══ SZMARAGDOWY TERMINAL DEKOMPOZYCJI LIVE ══ */}
            <AnimatePresence>
                {showTerminal && (
                    <motion.div
                        key="terminal"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="flex-shrink-0 overflow-hidden"
                        style={{ borderBottom: '1px solid rgba(34,197,94,0.15)' }}
                    >
                        {/* Główny panel terminalu */}
                        <div className="relative" style={{ height: '172px' }}>

                            {/* Matrix rain tło (tylko gdy rozłączony) */}
                            {!p2pConnected && (
                                <div className="absolute inset-0 opacity-35 pointer-events-none">
                                    <MatrixRain />
                                </div>
                            )}

                            {/* Zawartość overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 gap-2">

                                {!p2pConnected ? (
                                    /* ── Stan rozłączony ── */
                                    <>
                                        <motion.p
                                            animate={{ opacity: [0.3, 0.85, 0.3] }}
                                            transition={{ repeat: Infinity, duration: 2.8 }}
                                            className="text-[8px] font-mono tracking-[0.25em] uppercase text-center leading-relaxed"
                                            style={{ color: '#166534' }}
                                        >
                                            WIDZISZ TYLKO SWOJĄ POŁOWĘ SYGNAŁU<br />
                                            <span style={{ color: '#14532d' }}>// OCZEKIWANIE NA DRUGI RDZEŃ...</span>
                                        </motion.p>

                                        <div className="w-full max-w-xs flex flex-col gap-1.5 mt-0.5">
                                            {/* Generuj własny token */}
                                            {!myToken ? (
                                                <button
                                                    onClick={handleP2PInit}
                                                    disabled={p2pLoading}
                                                    className="text-[9px] font-mono font-bold uppercase tracking-widest py-1.5 rounded transition-all disabled:opacity-50"
                                                    style={{
                                                        background: 'rgba(34,197,94,0.12)',
                                                        border:     '1px solid rgba(34,197,94,0.35)',
                                                        color:      '#22c55e',
                                                        textShadow: '0 0 6px rgba(34,197,94,0.3)',
                                                    }}
                                                >
                                                    {p2pLoading ? '⟳ GENERUJĘ TOKEN...' : '⊕ GENERUJ SZMARAGDOWY TOKEN'}
                                                </button>
                                            ) : (
                                                /* Wyświetl własny token (Connection String) */
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[7px] text-green-900 font-mono shrink-0 tracking-wider">TWÓJ TOKEN:</span>
                                                    <div
                                                        className="flex-1 text-center font-bold font-mono px-2 py-1 rounded tracking-[0.2em] text-[11px]"
                                                        style={{
                                                            background: 'rgba(0,20,8,0.9)',
                                                            border:     '1px solid rgba(34,197,94,0.5)',
                                                            color:      '#4ade80',
                                                            textShadow: '0 0 8px rgba(74,222,128,0.5)',
                                                        }}
                                                    >
                                                        {myToken}
                                                    </div>
                                                    <button
                                                        onClick={copyToken}
                                                        className="shrink-0 text-[8px] px-2 py-1 rounded font-mono transition-all"
                                                        style={{
                                                            background: tokenCopied ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.1)',
                                                            border:     '1px solid rgba(34,197,94,0.35)',
                                                            color:      tokenCopied ? '#4ade80' : '#22c55e',
                                                        }}
                                                        title="Kopiuj do schowka"
                                                    >
                                                        {tokenCopied ? '✓' : '⎘'}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Wklej token partnera */}
                                            <div className="flex gap-1">
                                                <input
                                                    value={peerTokenInput}
                                                    onChange={e => setPeerTokenInput(e.target.value.toUpperCase())}
                                                    placeholder="WKLEJ TOKEN RÓWIEŚNIKA..."
                                                    className="flex-1 text-[9px] font-mono px-2 py-1 rounded outline-none tracking-widest"
                                                    style={{
                                                        background: 'rgba(0,12,5,0.85)',
                                                        border:     '1px solid rgba(34,197,94,0.2)',
                                                        color:      '#e2e8f0',
                                                    }}
                                                    onKeyDown={e => e.key === 'Enter' && handleP2PConnect()}
                                                    onFocus={e  => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'; }}
                                                    onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.2)'; }}
                                                />
                                                <button
                                                    onClick={handleP2PConnect}
                                                    disabled={!peerTokenInput.trim() || p2pLoading}
                                                    className="text-[9px] font-mono font-bold px-3 py-1 rounded transition-all disabled:opacity-40"
                                                    style={{
                                                        background: 'rgba(34,197,94,0.8)',
                                                        color:      '#000',
                                                        border:     '1px solid rgba(34,197,94,0.5)',
                                                    }}
                                                >
                                                    POŁĄCZ
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* ── Stan połączony ── */
                                    <div className="flex flex-col items-center gap-2">
                                        <motion.div
                                            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                                            transition={{ repeat: Infinity, duration: 1.6 }}
                                            className="text-2xl"
                                        >
                                            📡
                                        </motion.div>
                                        <p
                                            className="text-[11px] font-bold font-mono tracking-[0.2em] uppercase"
                                            style={{ color: '#4ade80', textShadow: '0 0 12px rgba(74,222,128,0.6)' }}
                                        >
                                            TUNEL AKTYWNY
                                        </p>
                                        <p className="text-[8px] font-mono tracking-widest" style={{ color: '#15803d' }}>
                                            {p2pPeerCount} RDZEŃ{p2pPeerCount !== 1 ? 'IE' : ''} ONLINE
                                            · TOKEN: {myToken}
                                            · ZDAL.: {remoteMessages.length}
                                        </p>
                                        <button
                                            onClick={handleP2PDisconnect}
                                            className="text-[8px] font-mono px-3 py-1 rounded transition-colors mt-1"
                                            style={{
                                                color:  '#ef4444',
                                                border: '1px solid rgba(239,68,68,0.3)',
                                            }}
                                        >
                                            ⊘ ROZŁĄCZ TUNEL
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stopka terminalu */}
                        <div
                            className="text-[7px] font-mono text-center py-1 tracking-[0.2em] uppercase"
                            style={{ color: '#14532d', background: 'rgba(0,5,2,0.9)' }}
                        >
                            📟 SZMARAGDOWY TERMINAL DEKOMPOZYCJI LIVE · WebRTC-ready SSE Relay · E2E
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                ) : mergedMessages.length === 0 ? (
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
                        {mergedMessages.map(msg => {
                            const isRemote = msg.owner === 'remote';
                            const isRight  = msg.role === 'user' && !isRemote;

                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 8, x: isRemote ? -14 : 0 }}
                                    animate={{ opacity: 1, y: 0, x: 0 }}
                                    transition={{ duration: 0.22 }}
                                    className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className="max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed"
                                        style={{
                                            background: isRemote
                                                ? 'rgba(22, 0, 35, 0.88)'
                                                : msg.role === 'user'
                                                    ? 'rgba(15, 25, 15, 0.9)'
                                                    : 'rgba(0, 20, 8, 0.85)',
                                            color: isRemote
                                                ? '#c084fc'
                                                : msg.role === 'user' ? '#e2e8f0' : '#22c55e',
                                            border: isRemote
                                                ? '1px solid rgba(168,85,247,0.3)'
                                                : msg.role === 'user'
                                                    ? '1px solid rgba(100,116,139,0.3)'
                                                    : '1px solid rgba(21,128,61,0.4)',
                                            borderRadius: isRight
                                                ? '12px 12px 0 12px'
                                                : '12px 12px 12px 0',
                                            boxShadow: isRemote
                                                ? '0 0 10px rgba(168,85,247,0.1)'
                                                : msg.role === 'model'
                                                    ? '0 0 8px rgba(34,197,94,0.08)'
                                                    : 'none',
                                        }}
                                    >
                                        {/* Badge zdalnego rdzenia */}
                                        {isRemote && (
                                            <div className="text-[7px] mb-1 tracking-widest" style={{ color: '#a855f7', opacity: 0.7 }}>
                                                ◈ RDZEŃ ZDALNY
                                            </div>
                                        )}

                                        {/* Obraz */}
                                        {msg.image && (
                                            <img
                                                src={msg.image}
                                                alt="transmisja"
                                                className="max-w-full rounded mb-2"
                                                style={{ border: '1px solid rgba(21,128,61,0.4)' }}
                                            />
                                        )}

                                        {/* Tekst / kursor typing */}
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
                                            {msg.role === 'model' && !isRemote ? 'TeO // ' : ''}
                                            {new Date(msg.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
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

                <div className="flex gap-2 items-end">
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

                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            p2pConnected
                                ? 'P2P aktywny — wiadomość trafi do rówieśnika i TeO...'
                                : 'Wpisz tajną wiadomość... (Enter = wyślij)'
                        }
                        rows={1}
                        disabled={isSending}
                        className="flex-1 resize-none text-xs rounded px-3 py-2 outline-none transition-colors font-mono disabled:opacity-50"
                        style={{
                            background: 'rgba(0, 12, 5, 0.8)',
                            border:     '1px solid rgba(34,197,94,0.2)',
                            color:      '#e2e8f0',
                            minHeight:  '36px',
                            maxHeight:  '120px',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'; }}
                        onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.2)'; }}
                    />

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
                            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 0.7 }}>
                                ···
                            </motion.span>
                        ) : 'WYŚLIJ'}
                    </motion.button>
                </div>

                <p className="text-[7px] font-mono text-green-950 mt-1.5 text-center tracking-widest">
                    E2E · GEMMA4 LOCAL · OFFLINE · BRAK CHMURY · KATEDRA OTAKOS
                    {p2pConnected && <span className="ml-2" style={{ color: '#3b0764' }}>· P2P TUNEL AKTYWNY</span>}
                </p>
            </div>
        </div>
    );
};

export default TostMessenger;
