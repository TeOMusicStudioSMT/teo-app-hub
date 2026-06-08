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
    status:      'PENDING' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'BLOCKED' | 'FAILED';
    patchFile?:  string;
    createdAt?:  string;
    updatedAt?:  string;
    error?:      string;
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

interface KgNode {
    id:        string;
    timestamp: string;
    errorType: string;
    errorMsg?: string;
    insight:   string;
    status:    string;
    aiSuccess: boolean;
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

            {/* ── Status badges ─────────────────────────────────── */}
            {task.status === 'PENDING' && (
                <div className="mt-2 flex items-center gap-2">
                    <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1.4 }}
                        className="text-[9px] text-slate-400 font-mono uppercase tracking-widest"
                    >
                        ⏳ OCZEKUJE W KOLEJCE
                    </motion.span>
                </div>
            )}
            {task.status === 'IN_PROGRESS' && (
                <div className="mt-2 flex items-center gap-2">
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                        className="inline-block"
                    >
                        ⚙️
                    </motion.span>
                    <span className="text-[9px] text-yellow-400 font-mono uppercase tracking-widest animate-pulse">
                        MECHANIK PRACUJE...
                    </span>
                </div>
            )}
            {task.status === 'BLOCKED' && (
                <p className="mt-2 text-[9px] text-red-400 font-mono uppercase tracking-widest">
                    🔒 ZABLOKOWANE
                </p>
            )}
            {task.status === 'FAILED' && (
                <div className="mt-2 rounded p-2" style={{ background: 'rgba(180,0,0,0.12)', border: '1px solid rgba(255,50,50,0.2)' }}>
                    <p className="text-[9px] text-red-400 font-mono uppercase tracking-widest mb-1">
                        💀 BŁĄD MECHANIKA
                    </p>
                    {task.error && (
                        <p className="text-[9px] text-red-300/70 font-mono leading-relaxed break-all">
                            {task.error}
                        </p>
                    )}
                </div>
            )}
            {task.status === 'READY_FOR_REVIEW' && onAction && (
                <div className="mt-3">
                    {task.patchFile && (
                        <p className="text-[9px] font-mono text-cyan-700 mb-2 truncate"
                           title={task.patchFile}
                        >
                            📄 <span className="text-cyan-600">{task.patchFile}</span>
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
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
                </div>
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

    // ── Stan dynamiczny ───────────────────────────────────────────────────────
    const [liveTasks,     setLiveTasks]     = useState<TaskQueueItem[]>([]);
    const [queueLoading,  setQueueLoading]  = useState(true);
    const [newTaskIds,    setNewTaskIds]     = useState<Set<string>>(new Set());
    const queuePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Odczyt kolejki z backendu
    const fetchQueueTasks = useCallback(async () => {
        try {
            const res  = await fetch(`${BRIDGE_URL}/api/mechanic/queue`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                setLiveTasks(data.tasks as TaskQueueItem[]);
            }
        } catch (_) { /* bridge niedostępny — zachowaj poprzedni stan */ }
    }, []);

    // Polling kolejki co 8 sekund
    useEffect(() => {
        setQueueLoading(true);
        fetchQueueTasks().finally(() => setQueueLoading(false));
        queuePollRef.current = setInterval(fetchQueueTasks, 8000);
        return () => {
            if (queuePollRef.current) clearInterval(queuePollRef.current);
        };
    }, [fetchQueueTasks]);
    const [chaosLog,      setChaosLog]       = useState<ChaosEntry[]>([]);
    const [isChaosActive, setIsChaosActive] = useState(false);
    const [showChaosLog,  setShowChaosLog]  = useState(false);

    // ── Stan grafu wiedzy (live polling) ─────────────────────────────────────
    const [kgNodes,     setKgNodes]     = useState<KgNode[]>([]);
    const [kgUpdatedAt, setKgUpdatedAt] = useState<string | null>(null);
    const [kgLoading,   setKgLoading]   = useState(false);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchKgNodes = useCallback(async () => {
        try {
            const res  = await fetch(`${BRIDGE_URL}/api/kg/nodes`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                // Pokaż tylko węzły typu błąd (mają pole insight)
                const errorNodes: KgNode[] = (data.nodes as KgNode[])
                    .filter(n => n.insight)
                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                    .slice(0, 20);
                setKgNodes(errorNodes);
                setKgUpdatedAt(data.updatedAt ?? null);
            }
        } catch (_) { /* bridge niedostępny */ }
    }, []);

    // Polling co 5 sekund
    useEffect(() => {
        setKgLoading(true);
        fetchKgNodes().finally(() => setKgLoading(false));
        pollTimerRef.current = setInterval(fetchKgNodes, 5000);
        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [fetchKgNodes]);

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

            // Jeśli błąd wychwycony — enqueue do Mechanika (trwała kolejka)
            if (data.caught && data.taskId) {
                const faultTask = {
                    id:          data.taskId,
                    title:       `[FAULT] ${data.errorName ?? 'Error'} — Chaos Injection`,
                    description: data.errorMessage ?? 'Automatyczna detekcja błędu środowiskowego.',
                    priority:    data.errorName === 'TypeError' ? 'CRITICAL' : 'HIGH',
                    targetFiles: ['TestProxy/wiesio-bridge.ts', 'wiesio-bridge.js'],
                };

                // Wstrzyknij do trwałej kolejki Mechanika
                await fetch(`${BRIDGE_URL}/api/mechanic/enqueue`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(faultTask),
                }).catch(() => {/* non-critical */});

                setNewTaskIds(prev => new Set([...prev, data.taskId!]));
                // Odśwież widok kolejki
                setTimeout(fetchQueueTasks, 500);
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
            // Odśwież graf po ~3s (czas potrzebny Gemma4 na analizę)
            setTimeout(fetchKgNodes, 3000);
            setTimeout(fetchKgNodes, 8000);
        }
    }, [isChaosActive, fetchKgNodes]);

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

                    <AnimatePresence mode="wait">
                        {queueLoading && liveTasks.length === 0 ? (
                            <motion.div
                                key="queue-loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-10 gap-3"
                            >
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                    className="w-6 h-6 rounded-full border-2 border-cyan-700 border-t-transparent"
                                />
                                <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                                    Łączę z Mechanikiem…
                                </span>
                            </motion.div>
                        ) : liveTasks.length > 0 ? (
                            <motion.div key="queue-tasks">
                                {liveTasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        isNew={newTaskIds.has(task.id)}
                                        onAction={handleTaskAction}
                                    />
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="queue-empty"
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

                    {/* ── Graf Wiedzy — live węzły z knowledge_graph.json ── */}
                    <div
                        className="flex-1 flex flex-col rounded-lg overflow-hidden"
                        style={{
                            background: 'rgba(0,0,0,0.35)',
                            border:     '2px solid rgba(0,229,255,0.12)',
                            boxShadow:  '0 0 20px rgba(0,255,255,0.05)',
                            minHeight:  '180px',
                        }}
                    >
                        {/* Nagłówek strefy */}
                        <div className="flex items-center justify-between px-4 py-2"
                             style={{ borderBottom: '1px solid rgba(0,229,255,0.1)' }}
                        >
                            <span className="text-[9px] font-mono text-cyan-600 uppercase tracking-widest">
                                Wnioski Archiwisty — Gemma4
                            </span>
                            <div className="flex items-center gap-3">
                                {kgUpdatedAt && (
                                    <span className="text-[8px] font-mono text-slate-700">
                                        sync: {new Date(kgUpdatedAt).toLocaleTimeString('pl-PL')}
                                    </span>
                                )}
                                {isChaosActive && (
                                    <motion.span
                                        animate={{ opacity: [1, 0.3, 1] }}
                                        transition={{ repeat: Infinity, duration: 0.8 }}
                                        className="text-[9px] text-red-400 font-mono"
                                    >
                                        ⚡ CHAOS AKTYWNY
                                    </motion.span>
                                )}
                                <span className="text-[9px] font-mono text-slate-600">
                                    {kgNodes.length} węzłów
                                </span>
                            </div>
                        </div>

                        {/* Lista węzłów */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {kgLoading && kgNodes.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <motion.p
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                        className="text-xs font-mono text-cyan-700"
                                    >
                                        Łączę z Archiwistą…
                                    </motion.p>
                                </div>
                            ) : kgNodes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
                                    <svg className="w-10 h-10 text-cyan-900 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <circle cx="5"  cy="12" r="2" strokeWidth={1.5} />
                                        <circle cx="19" cy="5"  r="2" strokeWidth={1.5} />
                                        <circle cx="19" cy="19" r="2" strokeWidth={1.5} />
                                        <line x1="7" y1="11" x2="17" y2="6"  strokeWidth={1.5} strokeLinecap="round" />
                                        <line x1="7" y1="13" x2="17" y2="18" strokeWidth={1.5} strokeLinecap="round" />
                                    </svg>
                                    <p className="text-xs font-mono text-slate-600 text-center">
                                        Graf wiedzy pusty.<br />
                                        <span className="text-slate-700">Uruchom ☢️ INICJUJ CHAOS, aby zasilić Archiwistę.</span>
                                    </p>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {kgNodes.map((node) => (
                                        <motion.div
                                            key={node.id}
                                            layout
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1,  y:  0 }}
                                            transition={{ duration: 0.25 }}
                                            className="rounded-lg p-3"
                                            style={{
                                                background:  node.aiSuccess
                                                    ? 'rgba(0,229,255,0.04)'
                                                    : 'rgba(255,100,0,0.04)',
                                                border: `1px solid ${node.aiSuccess
                                                    ? 'rgba(0,229,255,0.15)'
                                                    : 'rgba(255,100,0,0.2)'}`,
                                            }}
                                        >
                                            {/* Nagłówek węzła */}
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                                    node.errorType === 'TypeError'      ? 'bg-red-900/50 text-red-400' :
                                                    node.errorType === 'ReferenceError' ? 'bg-orange-900/50 text-orange-400' :
                                                    'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {node.errorType}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[8px] font-mono ${node.aiSuccess ? 'text-cyan-700' : 'text-orange-800'}`}>
                                                        {node.aiSuccess ? '🧠 AI' : '⚠️ FALLBACK'}
                                                    </span>
                                                    <span className="text-[8px] font-mono text-slate-700">
                                                        {new Date(node.timestamp).toLocaleTimeString('pl-PL')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Wniosek AI */}
                                            <p className="text-xs text-slate-300 leading-relaxed mt-1">
                                                {node.insight}
                                            </p>

                                            {/* Status */}
                                            <div className="mt-2 flex items-center gap-1">
                                                <span className="text-[8px] font-mono text-green-700 uppercase tracking-widest">
                                                    ✓ {node.status}
                                                </span>
                                                <span className="text-[8px] font-mono text-slate-800">
                                                    #{node.id}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>

                        {/* Pasek statusu */}
                        <div className="px-4 py-2 flex items-center gap-3"
                             style={{ borderTop: '1px solid rgba(0,229,255,0.08)' }}
                        >
                            <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-slate-900">
                                <motion.div
                                    className={`h-full rounded-full ${isChaosActive ? 'bg-red-500' : 'bg-cyan-700'}`}
                                    animate={{ width: isChaosActive ? '100%' : kgNodes.length > 0 ? '75%' : '20%' }}
                                    transition={{ duration: 0.8 }}
                                />
                            </div>
                            <span className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">
                                {isChaosActive ? 'CHAOS IN PROGRESS' : kgNodes.length > 0 ? 'GRAF AKTYWNY' : 'OCZEKIWANIE'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
