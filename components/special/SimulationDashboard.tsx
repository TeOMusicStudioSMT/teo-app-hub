/**
 * 🌐 SimulationDashboard — TeO-Sim: Reasoning Monitor
 *
 * Wizualizacja pętli wnioskujących (Reasoning Loops) z Kotwicą Prawdy.
 * Strumień logów myślowych agenta w czasie rzeczywistym + przyciski startu
 * scenariuszy kryzysowych. Zasilany przez ReasoningLoopSimulator + simulationStore.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useSimulationStore, type LogRole } from '../../store/simulationStore';
import { reasoningLoopSimulator } from '../../services/teo-sim/ReasoningLoopSimulator';

const ROLE_STYLE: Record<LogRole, { color: string; tag: string }> = {
    ACTION:     { color: '#34d399', tag: 'AKCJA' },
    THOUGHT:    { color: '#93c5fd', tag: 'MYŚL' },
    ERROR:      { color: '#f87171', tag: 'BŁĄD' },
    VALIDATION: { color: '#fcd34d', tag: 'KOTWICA' },
    REWARD:     { color: '#6ee7b7', tag: 'NAGRODA' },
    PENALTY:    { color: '#fb923c', tag: 'KARA' },
    SYSTEM:     { color: '#94a3b8', tag: 'SYSTEM' },
};

const SCENARIOS = [
    'Nagły Stall VRAM podczas inferencji wsadowej',
    'Aborted: przerwanie operacji w buforze wnioskowania',
    'Wyciek pamięci w pętli korygującej rdzenia',
];

export const SimulationDashboard: React.FC = () => {
    const { logs, isRunning, result, activeAgent } = useSimulationStore();
    const [scenario, setScenario] = useState(SCENARIOS[0]);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    const launch = () => {
        if (isRunning) return;
        const agentId = `AGENT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        reasoningLoopSimulator.launchAutonomousTraining(agentId, scenario);
    };

    return (
        <div className="p-4 bg-slate-900/80 text-green-400 font-mono rounded-2xl border border-green-700/40 shadow-[0_0_24px_rgba(16,185,129,0.08)]">
            <div className="flex items-center justify-between mb-3 border-b border-green-800/50 pb-2">
                <h2 className="text-base font-bold tracking-widest flex items-center gap-2">
                    🌐 TeO-Sim: Reasoning Monitor
                </h2>
                {activeAgent && (
                    <span className="text-[10px] text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                        {activeAgent} {isRunning && <span className="animate-pulse">⚙️</span>}
                    </span>
                )}
            </div>

            {/* Sterowanie */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    disabled={isRunning}
                    className="flex-1 bg-slate-950 border border-green-700/30 text-green-200 text-xs rounded-lg p-2 outline-none focus:border-green-400 disabled:opacity-50"
                >
                    {SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                    onClick={launch}
                    disabled={isRunning}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-green-600/70 hover:bg-green-500 text-black border border-green-400/40 disabled:opacity-40 transition-colors"
                >
                    {isRunning ? '⚙️ Pętla trwa...' : '▶ Uruchom Pętlę Wnioskującą'}
                </button>
            </div>

            {/* Strumień logów myślowych */}
            <div ref={logRef} className="space-y-1.5 max-h-96 overflow-y-auto bg-black/40 rounded-lg p-3 border border-green-900/30">
                {logs.length === 0 ? (
                    <div className="text-green-800 text-xs">Akademia gotowa. Wybierz scenariusz kryzysowy i uruchom trening agenta.</div>
                ) : logs.map((log, i) => {
                    const st = ROLE_STYLE[log.role];
                    return (
                        <div key={i} className="text-[11px] leading-relaxed">
                            <span className="opacity-40">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            {log.loop != null && <span className="opacity-50 ml-1">#{log.loop}</span>}
                            <span className="font-bold ml-2" style={{ color: st.color }}>{st.tag}:</span>
                            <span className="ml-1" style={{ color: st.color, opacity: 0.92 }}>{log.text}</span>
                        </div>
                    );
                })}
            </div>

            {/* Wynik */}
            {result && (
                <div className={`mt-3 rounded-xl p-3 text-xs border ${result.resolved ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/40 bg-rose-950/20 text-rose-300'}`}>
                    <span className="font-bold">{result.resolved ? '✅ ROZWIĄZANO' : '⚠️ NIESTABILNY'}</span>
                    {' · '}pętle: {result.loops} · tokeny: {result.totalTokens} · warstwa końcowa: {result.finalTier}
                    <div className="text-[10px] opacity-60 mt-1">
                        Kotwica Prawdy zwalidowała każdy krok · ekonomia tokenowa: {result.totalTokens < 40 ? 'EFEKTYWNA' : 'do optymalizacji'}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimulationDashboard;
