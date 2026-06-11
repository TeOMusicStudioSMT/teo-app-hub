/**
 * 🧺 PralkaStation — Roasting Station Alpha (Pralka v2)
 *
 * Główny kontener modułu "Pralka" wg architektury Rady (Adamus + Klaudiusz):
 *  - RoastingProvider (jądro: State Machine + Guardrail + Chronos + SP)
 *  - Suwak Poziomu 1-9 (filtr transakcyjny protokołu)
 *  - Strumień komunikacji (wiadomości z kontekstu)
 *  - MediaInput (WebRTC gated przez politykę)
 *  - TheVeil (warstwa interpretacyjna świadomości operacyjnej)
 *  - Singularity Protocol (przełącznik kontrolowanego chaosu)
 *  - NeuralFlowPreview (podgląd sieci neuronowej bytu + inne byty)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoastingProvider, useRoastingContext } from '../../context/roastingContext';
import MediaInput from '../MediaInput/MediaInput';
import TheVeil from '../TheVeil';
import NeuralFlowPreview from './NeuralFlowPreview';

// ─── Suwak Poziomu Roastowania ────────────────────────────────────────────────
const RoastSlider: React.FC = () => {
    const { currentLevel, setLevel, policy, state } = useRoastingContext();

    return (
        <div className="p-4 bg-gray-800/70 rounded-lg shadow-xl">
            <label htmlFor="roastLevel" className="block text-sm font-medium text-white mb-2">
                Stopień Roastowania: <span className="font-bold text-orange-400">{currentLevel}/9</span> 🚀
                <span className="ml-3 text-[9px] font-mono text-slate-500 uppercase tracking-widest">[{state}]</span>
            </label>
            <input
                type="range"
                id="roastLevel"
                min={1}
                max={9}
                value={currentLevel}
                onChange={e => setLevel(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <p className={`text-xs mt-2 ${currentLevel >= 7 ? 'text-red-400' : 'text-green-400'}`}>
                {currentLevel >= 7
                    ? '⚠️ Tryb krytyczny. Blokady węzłowe są blisko!'
                    : '✓ System w trybie stabilnym.'}
            </p>
            <p className="text-[9px] font-mono text-slate-500 mt-1">
                Protokół: {policy.requiredCodec} · {policy.maxStreamingRateKbps} kbps · media: {policy.canSendMedia ? 'TAK' : 'NIE'}
            </p>
        </div>
    );
};

// ─── Wewnętrzna stacja (wewnątrz Providera) ───────────────────────────────────
const StationInner: React.FC = () => {
    const {
        messages, sendMessageWithMedia, isAnalyzing,
        isSingularityProtocolActive, activateSP, deactivateSP,
        systemState, currentLevel,
    } = useRoastingContext();

    const [draft, setDraft] = useState('');
    const [showNetwork, setShowNetwork] = useState(true);

    // Żywe podświetlenie neuronów na podstawie stanu modułu
    const activeNodes: string[] = [
        'context',
        ...(isAnalyzing ? ['tone', 'chronos'] : []),
        ...(isSingularityProtocolActive ? ['sp'] : []),
        ...(currentLevel >= 5 ? ['media'] : []),
        ...(systemState === 'WARNING' ? ['veil'] : []),
    ];

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || isAnalyzing) return;
        setDraft('');
        await sendMessageWithMedia(text, 'TEXT');
    };

    return (
        <div className="p-5 bg-gray-900/80" style={{ borderTop: '1px solid rgba(249,115,22,0.15)' }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h2 className="text-xl font-bold text-white">
                    🧺 <span style={{ color: '#f97316', textShadow: '0 0 10px rgba(249,115,22,0.5)' }}>PRALKA</span>
                    {' '}<span className="text-sm text-slate-500 font-mono">// Roasting Station Alpha</span>
                </h2>

                <div className="flex items-center gap-2">
                    {/* Przełącznik podglądu sieci */}
                    <button
                        onClick={() => setShowNetwork(v => !v)}
                        className="text-[9px] font-mono px-2.5 py-1.5 rounded border transition-all uppercase tracking-widest"
                        style={{
                            borderColor: showNetwork ? 'rgba(249,115,22,0.5)' : 'rgba(100,116,139,0.3)',
                            color:       showNetwork ? '#f97316' : '#64748b',
                            background:  showNetwork ? 'rgba(249,115,22,0.08)' : 'transparent',
                        }}
                    >
                        🧠 SIEĆ
                    </button>

                    {/* Singularity Protocol */}
                    <motion.button
                        onClick={isSingularityProtocolActive ? deactivateSP : activateSP}
                        animate={isSingularityProtocolActive
                            ? { boxShadow: ['0 0 6px rgba(168,85,247,0.4)', '0 0 18px rgba(168,85,247,0.8)', '0 0 6px rgba(168,85,247,0.4)'] }
                            : {}}
                        transition={{ repeat: Infinity, duration: 1.6 }}
                        className="text-[9px] font-mono font-bold px-2.5 py-1.5 rounded border uppercase tracking-widest transition-colors"
                        style={{
                            borderColor: isSingularityProtocolActive ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.25)',
                            color:       isSingularityProtocolActive ? '#c084fc' : '#7c5a9e',
                            background:  isSingularityProtocolActive ? 'rgba(168,85,247,0.12)' : 'transparent',
                        }}
                    >
                        🔮 SP {isSingularityProtocolActive ? 'ON' : 'OFF'}
                    </motion.button>
                </div>
            </div>

            {/* Podgląd sieci neuronowej */}
            <AnimatePresence>
                {showNetwork && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mb-4 overflow-hidden"
                    >
                        <NeuralFlowPreview defaultEntityId="pralka-roast" activeNodeIds={activeNodes} />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Lewa kolumna: suwak + media */}
                <div className="space-y-4">
                    <RoastSlider />
                    <MediaInput />
                </div>

                {/* Prawa kolumna: strumień komunikacji */}
                <div className="flex flex-col bg-gray-800/50 rounded-lg p-3 min-h-[260px]">
                    <p className="text-[9px] font-mono text-orange-400/70 uppercase tracking-widest mb-2">
                        📡 Strumień Seansu ({messages.length})
                    </p>
                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px] pr-1">
                        {messages.length === 0 ? (
                            <p className="text-[10px] text-slate-600 italic text-center py-8">
                                Seans nie rozpoczęty. Ustaw poziom i wyślij pierwszy przekaz, Suwerenie.
                            </p>
                        ) : (
                            messages.map(msg => {
                                const isPralka = msg.sender === 'system';
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, x: isPralka ? -10 : 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`rounded px-3 py-2 border-l-2 ${
                                            isPralka
                                                ? 'bg-orange-950/40 border-orange-400'
                                                : 'bg-gray-900/80 border-slate-600/50'
                                        }`}
                                    >
                                        {isPralka && (
                                            <p className="text-[8px] font-mono text-orange-400/80 uppercase tracking-widest mb-1">
                                                🧺 PRALKA · GEMMA4
                                            </p>
                                        )}
                                        {msg.mediaUrl && (
                                            <img src={msg.mediaUrl} alt="media" className="max-h-24 rounded mb-1.5 border border-orange-900/40" />
                                        )}
                                        <p className={`text-xs ${isPralka ? 'text-orange-100' : 'text-slate-200'}`}>
                                            {msg.content}
                                        </p>
                                        <p className="text-[7px] text-slate-600 mt-0.5">
                                            {msg.timestamp.toLocaleTimeString('pl-PL')}
                                        </p>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2 mt-3">
                        <input
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Przekaz roastingowy..."
                            disabled={isAnalyzing}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-orange-500 transition-colors disabled:opacity-50"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isAnalyzing || !draft.trim()}
                            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                            style={{ background: 'rgba(249,115,22,0.85)', color: '#000' }}
                        >
                            {isAnalyzing ? '⟳' : 'ROAST'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Warstwa Interpretacyjna */}
            <TheVeil />
        </div>
    );
};

// ─── Eksport: stacja opakowana w Provider ─────────────────────────────────────
const PralkaStation: React.FC = () => (
    <RoastingProvider>
        <StationInner />
    </RoastingProvider>
);

export default PralkaStation;
