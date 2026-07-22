/**
 * 🎙️ NotebookTwinPanel — Spectrum Podcast Twin (wizualizacja dwóch gospodarzy)
 *
 * Dwa awatary (Iskra 🔥 / Echo 🌊) z dynamicznymi equalizerami mowy reagującymi
 * na to, kto aktualnie mówi (triggerAnimation). Pole tematu + generowanie kolejnych
 * tur dialogu + log skryptu rozmowy na żywo.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, Play, RotateCcw } from 'lucide-react';
import { NotebookPodcastService, SOVEREIGN_WELCOME, type PodcastTurn, type TwinAnimation } from '../../src/services/NotebookPodcastService';
import KsiegaOdbioru from './KsiegaOdbioru';
import { PodcastCore } from '../PodcastCore';

const service = new NotebookPodcastService();
const STORE_KEY = 'teo_podcast_twin_log';   // pamięć trwała rozmowy (Rozczytelnia agentów)

interface PodcastMemory { topic: string; turns: PodcastTurn[]; }
const loadMemory = (): PodcastMemory => {
    try { const m = JSON.parse(localStorage.getItem(STORE_KEY) || ''); if (m && Array.isArray(m.turns)) return m; } catch { /* brak */ }
    return { topic: 'Suwerenność danych i lokalne AI w Katedrze OtakOS', turns: [] };
};

/** Equalizer 5 słupków — animuje się gdy host „mówi". */
const Equalizer: React.FC<{ active: boolean; color: string }> = ({ active, color }) => (
    <div className="flex items-end gap-[3px] h-6" aria-hidden>
        {[0, 1, 2, 3, 4].map(i => (
            <span key={i}
                className={active ? 'eq-bar' : ''}
                style={{
                    width: 4, borderRadius: 2, background: color,
                    height: active ? undefined : 4,
                    opacity: active ? 1 : 0.35,
                    animationDelay: `${i * 0.12}s`,
                }}
            />
        ))}
    </div>
);

interface HostProps { name: string; emoji: string; color: string; active: boolean; }
const HostAvatar: React.FC<HostProps> = ({ name, emoji, color, active }) => (
    <div className="flex flex-col items-center gap-2">
        <motion.div
            animate={active ? { scale: [1, 1.06, 1], boxShadow: `0 0 28px ${color}80` } : { scale: 1, boxShadow: `0 0 8px ${color}30` }}
            transition={active ? { repeat: Infinity, duration: 0.9 } : {}}
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-2"
            style={{ borderColor: color, background: `radial-gradient(circle, ${color}22, #05080d)` }}
        >
            {emoji}
        </motion.div>
        <div className="text-xs font-bold tracking-widest" style={{ color }}>{name}</div>
        <Equalizer active={active} color={color} />
    </div>
);

export const NotebookTwinPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const mem0 = loadMemory();
    const [topic, setTopic] = useState(mem0.topic);
    const [turns, setTurns] = useState<PodcastTurn[]>(mem0.turns);
    const [anim, setAnim]   = useState<TwinAnimation>('IDLE');
    const [busy, setBusy]   = useState(false);
    const [view, setView]   = useState<'rozmowa' | 'video_podcast' | 'koom'>('rozmowa');
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [turns]);

    // 💾 Pamięć trwała — zapis rozmowy, by gospodarze kontynuowali zamiast zaczynać od nowa.
    useEffect(() => {
        try { localStorage.setItem(STORE_KEY, JSON.stringify({ topic, turns })); } catch { /* limit storage */ }
    }, [topic, turns]);

    const handleStreamStateChange = useCallback((isBroadcasting: boolean) => {
        const timestamp = new Date().toLocaleTimeString();
        setTurns(prev => [
            ...prev,
            {
                hostA: `[BROADCAST ${timestamp}] ${isBroadcasting ? '● Rozpoczęto transmisję wideo RTMP na żywo (YouTube Ingest)' : '◯ Zakończono transmisję wideo'}`,
                hostB: `[AI ORB 0.00G] Strumień ${isBroadcasting ? 'aktywny' : 'zakończony'}. Zdarzenie przekazane do pamięci Księgi Odbioru (KOOM).`,
                triggerAnimation: 'BOTH',
            }
        ]);
    }, []);

    const generate = useCallback(async () => {
        if (busy || !topic.trim()) return;
        setBusy(true); setAnim('BOTH');
        try {
            const turn = await service.generateTurn(topic, turns);
            setTurns(prev => [...prev, turn]);
            // Sekwencja mowy: najpierw A, potem B (efekt rozmowy).
            setAnim('A_SPEAKING');
            setTimeout(() => setAnim('B_SPEAKING'), 1600);
            setTimeout(() => setAnim('IDLE'), 3200);
        } finally {
            setBusy(false);
        }
    }, [busy, topic, turns]);

    const reset = () => {
        setTurns([]); setAnim('IDLE');
        try { localStorage.removeItem(STORE_KEY); } catch { /* noop */ }
    };

    const aActive = busy || anim === 'A_SPEAKING' || anim === 'BOTH';
    const bActive = busy || anim === 'B_SPEAKING' || anim === 'BOTH';

    // Zakładki: 🎙️ Rozmowa (Rozczytelnia) | 📺 Wideopodcast 1/1 | 📖 Księga KOOM
    const tabBar = (
        <div className="flex items-center gap-2 mb-2">
            {([['rozmowa', '🎙️ Rozmowa'], ['video_podcast', '📺 Wideopodcast 1/1'], ['koom', '📖 Księga KOOM']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors border
                        ${view === k ? 'bg-fuchsia-700/50 text-white border-fuchsia-400/50' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
                    {label}
                </button>
            ))}
            {onClose && (
                <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white text-sm border border-slate-700 rounded-lg px-3 py-1">✕ Zamknij</button>
            )}
        </div>
    );

    if (view === 'koom') {
        return <div className="w-full max-w-3xl mx-auto">{tabBar}<KsiegaOdbioru /></div>;
    }

    if (view === 'video_podcast') {
        return (
            <div className="w-full max-w-4xl mx-auto space-y-3">
                {tabBar}
                <div className="w-full h-[650px]">
                    <PodcastCore onStreamStateChange={handleStreamStateChange} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto">
        {tabBar}
        <div className="bg-[#05080d] border border-fuchsia-500/25 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] font-sans text-slate-200">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-fuchsia-500/20 bg-gradient-to-r from-[#140518] to-[#0a0814]">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-black border border-fuchsia-500/40 flex items-center justify-center">
                        <Mic size={22} className="text-fuchsia-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-cyan-400">PODCAST TWIN</h2>
                        <p className="text-[10px] text-slate-500 tracking-wider">
                            Spectrum · Rozczytelnia agentów · {turns.length > 0 ? <span className="text-fuchsia-400/70">💾 {turns.length} tur w pamięci</span> : 'NotebookLM-style'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Powitanie Suwerena + awatary */}
            <div className="px-6 pt-5">
                <div className="text-center text-sm italic text-fuchsia-300/80 mb-4">„{SOVEREIGN_WELCOME}"</div>
                <div className="flex items-center justify-center gap-12">
                    <HostAvatar name="ISKRA" emoji="🔥" color="#f472b6" active={aActive} />
                    <span className="text-2xl opacity-40">🎙️</span>
                    <HostAvatar name="ECHO" emoji="🌊" color="#22d3ee" active={bActive} />
                </div>
            </div>

            {/* Sterowanie */}
            <div className="px-6 py-4 flex gap-2">
                <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generate()}
                    placeholder="Temat odcinka..."
                    className="flex-1 bg-black/60 border border-fuchsia-700/30 focus:border-fuchsia-500/60 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                />
                <button onClick={generate} disabled={busy || !topic.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-fuchsia-700/70 hover:bg-fuchsia-600 text-white border border-fuchsia-400/40 disabled:opacity-40 transition-all">
                    <Play size={14} /> {busy ? 'GENERUJĘ...' : turns.length ? 'KOLEJNA TURA' : 'START ROZMOWY'}
                </button>
                <button onClick={reset} disabled={busy} title="Nowy odcinek (wyczyść pamięć rozmowy)"
                    className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 disabled:opacity-40">
                    <RotateCcw size={14} />
                </button>
            </div>

            {/* Log skryptu rozmowy */}
            <div ref={logRef} className="mx-6 mb-6 max-h-72 overflow-y-auto bg-black/40 rounded-xl border border-fuchsia-900/30 p-3 space-y-2">
                {turns.length === 0 ? (
                    <div className="text-[11px] text-slate-600 text-center py-6">Wpisz temat i kliknij START — gospodarze zaczną rozmowę.</div>
                ) : turns.map((t, i) => (
                    <div key={i} className="space-y-1">
                        {t.hostA && (
                            <div className="text-xs"><span className="font-bold" style={{ color: '#f472b6' }}>🔥 ISKRA:</span> <span className="text-slate-300">{t.hostA}</span></div>
                        )}
                        {t.hostB && (
                            <div className="text-xs"><span className="font-bold" style={{ color: '#22d3ee' }}>🌊 ECHO:</span> <span className="text-slate-300">{t.hostB}</span></div>
                        )}
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes eqPulse { 0%,100% { height: 5px; } 50% { height: 22px; } }
                .eq-bar { animation: eqPulse 0.85s ease-in-out infinite; }
            `}</style>
        </div>
        </div>
    );
};

export default NotebookTwinPanel;
