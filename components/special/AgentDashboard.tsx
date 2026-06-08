/**
 * 👁️ AgentDashboard — Oczy Suwerena
 *
 * Panel dowodzenia Katedry: kolejka zadań + obszar obserwacyjny grafu wiedzy.
 * Zawiera zapalnik Inżynierii Chaosu (☢️ INICJUJ CHAOS).
 *
 * Estetyka: Neon / Sci-Fi / Cyberpunk (Tailwind + inline glow)
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Stałe ────────────────────────────────────────────────────────────────────

const BRIDGE_URL = 'http://127.0.0.1:3001';

// ─── Typy ─────────────────────────────────────────────────────────────────────

interface TaskQueueItem {
    id:          string;
    title:       string;
    description: string;
    priority:    'CRITICAL' | 'HIGH' | 'LOW';
    status:      'READY_FOR_REVIEW' | 'IN_PROGRESS' | 'BLOCKED';
}

interface ChaosEntry {
    id:        string;
    timestamp: string;
    scenario:  string;
    caught:    boolean;
    survived:  boolean;
    errorName: string | null;
    errorMsg:  string | null;
    taskId:    string | null;
}

// ─── Mapa priorytetów → style ──────────────────────────────────────────────────

const PRIORITY_STYLES: Record<TaskQueueItem['priority'], { border: string; bg: string; badge: string }> = {
    CRITICAL: { border: 'border-red-600',    bg: 'bg-red-900/25',    badge: 'bg-red-700'    },
    HIGH:     { border: 'border-orange-500', bg: 'bg-orange-900/25', badge: 'bg-orange-700' },
    LOW:      { border: 'border-blue-500',   bg: 'bg-blue-900/25',   badge: 'bg-blue-700'   },
};

// ─── TaskCard ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
    task:      TaskQueueItem;
    isNew?:    boolean;
    onAction?: (id: string, action: 'approve' | 'reject') => void;
}

const TaskCard = React.memo<TaskCardProps>(({ task, isNew, onAction }) => {
    const style = PRIORITY_STYLES[task.priority] ?? {
        border: 'border-gray-700',
        bg:     'bg-gray-900/20',
        badge:  'bg-gray-700',
    };

    return (
        <motion.div
            layout
            initial={isNew ? { opacity: 0, x: -20, scale: 0.96 } : false}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.28 }}
            className={`p-4 mb-3 border-l-4 ${style.border} ${style.bg} transition duration-300 rounded-r-lg`}
            style={{ boxShadow: isNew ? '0 0 16px rgba(255,50,50,0.25)' : '0 0 8px rgba(0,255,255,0.08)' }}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-mono text-cyan-300 truncate">{task.title}</h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{task.description}</p>
                </div>
                <span className={`flex-shrink-0 text-[9px] px-2 py-1 rounded font-bold tracking-widest ${style.badge} ${isNew ? 'animate-pulse' : ''}`}>
                    {task.priority}
                </span>
            </div>

            {task.status === 'READY_FOR_REVIEW' && onAction && (
                <div className="mt-3 flex justify-end gap-2">
                    <button
                        onClick={() => onAction(task.id, 'approve')}
                        className="px-3 py-1 text-xs bg-green-600/80 hover:bg-green-500 transition border border-green-400/50 rounded"
                        style={{ boxShadow: '0 0 8px rgba(0,255,100,0.2)' }}
                    >
                        ✅ Zatwierdź Patch
                    </button>
                    <button
                        onClick={() => onAction(task.id, 'reject')}
                        className="px-3 py-1 text-xs bg-red-800/80 hover:bg-red-700 transition border border-red-400/50 rounded"
                        style={{ boxShadow: '0 0 8px rgba(255,50,50,0.2)' }}
                    >
                        ❌ Odrzuć
                    </button>
                </div>
            )}

            {task.status === 'IN_PROGRESS' && (
                <p className="mt-2 text-[9px] text-yellow-400 font-mono uppercase tracking-widest animate-pulse">
                    ⚙️ W toku...
                </p>
            )}
            {task.status === 'BLOCKED' && (
                <p className="mt-2 text-[9px] text-red-400 font-mono uppercase tracking-widest">
                    🔒 ZABLOKOWANE
                </p>
            )}
        </motion.div>
    );
});
TaskCard.displayName = 'TaskCard';

// ─── Etykieta scenariusza ─────────────────────────────────────────────────────

const SCENARIO_LABELS: Record<string, string> = {
    NULL_POINTER:    'TypeError — Null Ptr',
    UNDEFINED_SCOPE: 'ReferenceError — Undefined',
    ZERO_DIVISION:   'ZeroDivision — Network Abort',
};

// ─── AgentDashboard ───────────────────────────────────────────────────────────

const AgentDashboard: React.FC = () => {

    // ── Statyczne zadania (mock) ──────────────────────────────────────────────
    const baseTasks = useMemo<TaskQueueItem[]>(() => [
        { id: 'T-001', title: 'Walidacja Protonowej Wtyczki',   description: 'Testowanie kompatybilności ESM/CJS na poziomie rdzenia. Krytyczny fail.', priority: 'CRITICAL', status: 'READY_FOR_REVIEW' },
        { id: 'T-002', title: 'Optymalizacja RAM dla Cykli',    description: 'Zredukowanie overheadu cykli predykcji. Niskopriorytetowe usprawnienia.',  priority: 'LOW',      status: 'IN_PROGRESS'      },
        { id: 'T-003', title: 'Raport Wycieku Świadomości',     description: 'Analiza niepowiązanych fraktali w strumieniach danych Katedry.',           priority: 'HIGH',     status: 'READY_FOR_REVIEW' },
        { id: 'T-004', title: 'Debugowanie Pętli Czasowej',     description: 'Obserwacja anomalii w strumieniu danych historycznych.',                   priority: 'CRITICAL', status: 'BLOCKED'          },
    ], []);

    // ── Stan dynamiczny ───────────────────────────────────────────────────────
    const [liveTasks,     setLiveTasks]     = useState<TaskQueueItem[]>(baseTasks);
    const [newTaskIds,    setNewTaskIds]     = useState<Set<string>>(new Set());
    const [chaosLog,      setChaosLog]       = useState<ChaosEntry[]>([]);
    const [isChaosActive, setIsChaosActive] = useState(false);
    const [showChaosLog,  setShowChaosLog]  = useState(false);

    const chaosLogRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logu
    useEffect(() => {
        if (chaosLogRef.current) {
            chaosLogRef.current.scrollTop = chaosLogRef.current.scrollHeight;
        }
    }, [chaosLog]);

    // ── Akcje na kartach ──────────────────────────────────────────────────────
    const handleTaskAction = useCallback((id: string, action: 'approve' | 'reject') => {
        console.log(`[ACTION_EXEC] ${action.toUpperCase()} dla zadania ${id}`);
        setLiveTasks(prev => prev.filter(t => t.id !== id));
        setNewTaskIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, []);

    // ── Wyzwalacz Chaosu ──────────────────────────────────────────────────────
    const triggerChaos = useCallback(async () => {
        if (isChaosActive) return;

        setIsChaosActive(true);
        setShowChaosLog(true);

        try {
            const res = await fetch(`${BRIDGE_URL}/api/chaos/inject`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            // Dodaj wpis do logu
            const entry: ChaosEntry = {
                id:        `chaos-${Date.now()}`,
                timestamp: new Date(data.timestamp).toLocaleTimeString('pl-PL'),
                scenario:  SCENARIO_LABELS[data.scenario] ?? data.scenario,
                caught:    data.caught,
                survived:  data.survived,
                errorName: data.errorName,
                errorMsg:  data.errorMessage,
                taskId:    data.taskId,
            };

            setChaosLog(prev => [...prev.slice(-49), entry]);

            // Jeśli błąd wychwycony — wstrzyknij task do kolejki
            if (data.caught && data.taskId) {
                const faultTask: TaskQueueItem = {
                    id:          data.taskId,
                    title:       `[FAULT] ${data.errorName ?? 'Error'} — Chaos Injection`,
                    description: data.errorMessage ?? 'Automatyczna detekcja błędu środowiskowego.',
                    priority:    data.errorName === 'TypeError' ? 'CRITICAL' : 'HIGH',
                    status:      'READY_FOR_REVIEW',
                };

                setLiveTasks(prev => [faultTask, ...prev]);
                setNewTaskIds(prev => new Set([...prev, data.taskId!]));
            }

        } catch (err: any) {
            // Backend niedostępny — dodaj wpis o błędzie połączenia
            setChaosLog(prev => [...prev.slice(-49), {
                id:        `chaos-err-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('pl-PL'),
                scenario:  'CONNECTION_ERROR',
                caught:    true,
                survived:  false,
                errorName: 'NetworkError',
                errorMsg:  `Wiesław Bridge niedostępny: ${err.message}`,
                taskId:    null,
            }]);
        } finally {
            setIsChaosActive(false);
        }
    }, [isChaosActive]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div
            className="flex flex-col w-full text-[#E6F7FF]"
            style={{ backgroundColor: 'rgba(5, 5, 15, 0.95)', boxShadow: 'inset 0 0 30px rgba(0,255,255,0.06)' }}
        >
            {/* ── Nagłówek z przyciskiem ☢️ ── */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3"
                 style={{ borderBottom: '1px solid rgba(0,229,255,0.1)' }}
            >
                <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-[0.3em]">
                    👁️ Oczy Suwerena — Panel Dowodzenia
                </span>

                <div className="flex items-center gap-3">
                    {/* Przełącznik logu */}
                    <button
                        onClick={() => setShowChaosLog(v => !v)}
                        className={`text-[9px] font-mono px-2 py-1 rounded border transition-all
                            ${chaosLog.length > 0
                                ? 'border-orange-500/50 text-orange-400 hover:bg-orange-900/20'
                                : 'border-slate-700 text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        {showChaosLog ? '▲ UKRYJ LOG' : `▼ LOG CHAOSU${chaosLog.length > 0 ? ` (${chaosLog.length})` : ''}`}
                    </button>

                    {/* ☢️ ZAPALNIK */}
                    <motion.button
                        onClick={triggerChaos}
                        disabled={isChaosActive}
                        whileHover={{ scale: isChaosActive ? 1 : 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        animate={isChaosActive ? { boxShadow: ['0 0 8px rgba(255,50,0,0.4)', '0 0 20px rgba(255,50,0,0.8)', '0 0 8px rgba(255,50,0,0.4)'] } : {}}
                        transition={isChaosActive ? { repeat: Infinity, duration: 0.8 } : {}}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-[10px] tracking-widest uppercase
                            border transition-all duration-200
                            ${isChaosActive
                                ? 'bg-red-900/60 border-red-500 text-red-300 cursor-not-allowed'
                                : 'bg-red-950/80 border-red-600/70 text-red-400 hover:bg-red-900/60 hover:border-red-500 hover:text-red-300'
                            }
                        `}
                        style={{
                            boxShadow: isChaosActive
                                ? '0 0 20px rgba(255,50,0,0.6)'
                                : '0 0 8px rgba(255,50,0,0.25)',
                        }}
                    >
                        {isChaosActive ? (
                            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                ⚙️
                            </motion.span>
                        ) : (
                            <span>☢️</span>
                        )}
                        {isChaosActive ? 'INICJOWANIE...' : 'INICJUJ CHAOS'}
                    </motion.button>
                </div>
            </div>

            {/* ── Chaos Log (zwijany) ── */}
            <AnimatePresence>
                {showChaosLog && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                        style={{ borderBottom: '1px solid rgba(255,100,0,0.2)' }}
                    >
                        <div
                            ref={chaosLogRef}
                            className="bg-black/70 px-5 py-3 max-h-[130px] overflow-y-auto font-mono text-[10px] leading-relaxed"
                        >
                            {chaosLog.length === 0 ? (
                                <span className="text-slate-600 italic">Brak wpisów — zainicjuj chaos, aby rozpocząć testy zderzeniowe.</span>
                            ) : (
                                chaosLog.map(entry => (
                                    <div key={entry.id} className="mb-1">
                                        <span className="text-slate-600">[{entry.timestamp}]</span>
                                        {' '}
                                        <span className={entry.caught ? 'text-red-400' : 'text-green-400'}>
                                            {entry.caught ? '🔴 FAULT' : '🟢 SURVIVED'}
                                        </span>
                                        {' '}
                                        <span className="text-orange-300">{entry.scenario}</span>
                                        {entry.caught && (
                                            <span className="text-slate-400"> — {entry.errorMsg}</span>
                                        )}
                                        {entry.taskId && (
                                            <span className="text-cyan-600"> → task:{entry.taskId}</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Główny układ: Kolejka + Graf ── */}
            <div className="flex flex-1" style={{ minHeight: '380px' }}>

                {/* ── Lewy Panel: Kolejka ── */}
                <div
                    className="flex-none w-[38%] overflow-y-auto p-5"
                    style={{ borderRight: '2px solid rgba(0,255,255,0.08)' }}
                    aria-label="Kolejka Zadań"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase">
                            [ Queue_System ] Kolejka FIFO
                        </h2>
                        <span className="text-[9px] font-mono text-slate-600">
                            {liveTasks.length} zadań
                        </span>
                    </div>

                    <AnimatePresence>
                        {liveTasks.length > 0 ? (
                            liveTasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    isNew={newTaskIds.has(task.id)}
                                    onAction={handleTaskAction}
                                />
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-slate-600 p-5 text-xs text-center border border-dashed border-slate-800 rounded-lg mt-4"
                            >
                                Kolejka pusta. System czeka na komendy.
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Prawy Panel: Obszar Obserwacyjny ── */}
                <div className="flex-1 flex flex-col p-5" aria-label="Graf Wiedzy">
                    <h2 className="text-[10px] font-mono text-cyan-400 mb-4 tracking-widest uppercase pb-2"
                        style={{ borderBottom: '1px dashed rgba(0,229,255,0.2)' }}
                    >
                        [ Knowledge_Graph ] Obszar Obserwacyjny
                    </h2>

                    {/* Placeholder skanera */}
                    <div
                        className="flex-1 relative flex items-center justify-center p-8 overflow-hidden rounded-lg"
                        style={{
                            background: 'rgba(0,0,0,0.3)',
                            border:     '2px solid rgba(0,229,255,0.12)',
                            boxShadow:  '0 0 20px rgba(0,255,255,0.06)',
                            minHeight:  '180px',
                        }}
                    >
                        {/* Siatka skanowania */}
                        <div
                            className="absolute inset-0 opacity-15 pointer-events-none"
                            style={{
                                backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, rgba(0,255,255,0.07) 1px, transparent 2px)',
                                backgroundSize:  '100% 28px',
                            }}
                        />

                        <div className="text-center z-10">
                            <svg
                                className={`w-12 h-12 mx-auto mb-4 opacity-60 ${isChaosActive ? 'text-red-400 animate-pulse' : 'text-cyan-500'}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <circle cx="5"  cy="12" r="2" strokeWidth={1.5} />
                                <circle cx="19" cy="5"  r="2" strokeWidth={1.5} />
                                <circle cx="19" cy="19" r="2" strokeWidth={1.5} />
                                <line x1="7"  y1="11" x2="17" y2="6"  strokeWidth={1.5} strokeLinecap="round" />
                                <line x1="7"  y1="13" x2="17" y2="18" strokeWidth={1.5} strokeLinecap="round" />
                            </svg>

                            <p className={`text-sm font-mono ${isChaosActive ? 'text-red-300 animate-pulse' : 'text-cyan-200'}`}>
                                {isChaosActive
                                    ? '⚡ Chaos injection w toku...'
                                    : chaosLog.length > 0
                                        ? `${chaosLog.filter(e => e.caught).length} błędów wychwyconych`
                                        : 'Archiwista skanuje warstwę kwantową...'
                                }
                            </p>

                            {chaosLog.length > 0 && (
                                <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-mono">
                                    <span className="text-green-400">
                                        🟢 {chaosLog.filter(e => e.survived && !e.caught).length} przeżyte
                                    </span>
                                    <span className="text-red-400">
                                        🔴 {chaosLog.filter(e => e.caught).length} wychwycone
                                    </span>
                                    <span className="text-slate-500">
                                        łącznie: {chaosLog.length}
                                    </span>
                                </div>
                            )}

                            <div className="mt-4 w-40 mx-auto h-1 rounded-full overflow-hidden bg-slate-800">
                                <motion.div
                                    className={`h-full rounded-full ${isChaosActive ? 'bg-red-500' : 'bg-cyan-500'}`}
                                    animate={{ width: isChaosActive ? '100%' : '60%' }}
                                    transition={{ duration: 0.6 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
