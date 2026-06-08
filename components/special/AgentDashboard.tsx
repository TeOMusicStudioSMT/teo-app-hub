/**
 * 👁️ AgentDashboard — Oczy Suwerena
 *
 * Panel dowodzenia Katedry: kolejka zadań operacyjnych + obszar obserwacyjny grafu wiedzy.
 * Estetyka: Neon / Sci-Fi / Cyberpunk (Tailwind + inline glow)
 *
 * Refaktoryzacja: styled-components → Tailwind CSS (pakiet nie jest zainstalowany w projekcie)
 * Fix JSX: class → className, stroke-linecap → strokeLinecap, stroke-width → strokeWidth
 */

import React, { useMemo } from 'react';

// ─── Typy ─────────────────────────────────────────────────────────────────────

interface TaskQueueItem {
    id:          string;
    title:       string;
    description: string;
    priority:    'CRITICAL' | 'HIGH' | 'LOW';
    status:      'READY_FOR_REVIEW' | 'IN_PROGRESS' | 'BLOCKED';
}

// ─── Mapa priorytetów → style ──────────────────────────────────────────────────

const PRIORITY_STYLES: Record<TaskQueueItem['priority'], { border: string; bg: string; badge: string }> = {
    CRITICAL: {
        border: 'border-red-600',
        bg:     'bg-red-900/25',
        badge:  'bg-red-700',
    },
    HIGH: {
        border: 'border-orange-500',
        bg:     'bg-orange-900/25',
        badge:  'bg-orange-700',
    },
    LOW: {
        border: 'border-blue-500',
        bg:     'bg-blue-900/25',
        badge:  'bg-blue-700',
    },
};

// ─── TaskCard — memoizowana karta zadania ──────────────────────────────────────

interface TaskCardProps {
    task: TaskQueueItem;
}

const TaskCard = React.memo<TaskCardProps>(({ task }) => {
    const style = PRIORITY_STYLES[task.priority] ?? {
        border: 'border-gray-700',
        bg:     'bg-gray-900/20',
        badge:  'bg-gray-700',
    };

    const handleAction = (action: 'approve' | 'reject') => {
        console.log(`[ACTION_EXEC] Wywołano akcję ${action} dla Zadania ID: ${task.id}`);
    };

    return (
        <div
            className={`p-4 mb-4 border-l-4 ${style.border} ${style.bg} transition duration-300`}
            style={{ boxShadow: '0 0 8px rgba(0, 255, 255, 0.12)' }}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                    <h3 className="text-base font-mono text-cyan-300 truncate">{task.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{task.description}</p>
                </div>
                <span
                    className={`flex-shrink-0 text-[9px] px-2 py-1 rounded font-bold tracking-widest ${style.badge} animate-pulse`}
                >
                    {task.priority}
                </span>
            </div>

            {task.status === 'READY_FOR_REVIEW' && (
                <div className="mt-3 flex justify-end gap-2">
                    <button
                        onClick={() => handleAction('approve')}
                        className="px-3 py-1 text-xs bg-green-600/80 hover:bg-green-500 transition border border-green-300 rounded"
                        style={{ boxShadow: '0 0 8px rgba(0,255,100,0.3)' }}
                    >
                        ✅ Zatwierdź Patch
                    </button>
                    <button
                        onClick={() => handleAction('reject')}
                        className="px-3 py-1 text-xs bg-red-800/80 hover:bg-red-700 transition border border-red-300 rounded"
                        style={{ boxShadow: '0 0 8px rgba(255,50,50,0.3)' }}
                    >
                        ❌ Odrzuć
                    </button>
                </div>
            )}

            {task.status === 'IN_PROGRESS' && (
                <div className="mt-2">
                    <span className="text-[9px] text-yellow-400 font-mono uppercase tracking-widest animate-pulse">
                        ⚙️ W toku...
                    </span>
                </div>
            )}

            {task.status === 'BLOCKED' && (
                <div className="mt-2">
                    <span className="text-[9px] text-red-400 font-mono uppercase tracking-widest">
                        🔒 ZABLOKOWANE
                    </span>
                </div>
            )}
        </div>
    );
});

TaskCard.displayName = 'TaskCard';

// ─── Główny komponent ─────────────────────────────────────────────────────────

const AgentDashboard: React.FC = () => {
    const mockTasks: TaskQueueItem[] = useMemo(() => [
        {
            id:          'T-001',
            title:       'Walidacja Protonowej Wtyczki',
            description: 'Testowanie kompatybilności ESM/CJS na poziomie rdzenia. Krytyczny fail.',
            priority:    'CRITICAL',
            status:      'READY_FOR_REVIEW',
        },
        {
            id:          'T-002',
            title:       'Optymalizacja RAM dla Klatek Cyklu',
            description: 'Zredukowanie overheadu cykli predykcji. Niskopriorytetowe usprawnienia.',
            priority:    'LOW',
            status:      'IN_PROGRESS',
        },
        {
            id:          'T-003',
            title:       'Raport Wycieku Świadomości',
            description: 'Analiza niepowiązanych fraktali w strumieniach danych Katedry. Wymaga ręcznego przeglądu.',
            priority:    'HIGH',
            status:      'READY_FOR_REVIEW',
        },
        {
            id:          'T-004',
            title:       'Debugowanie Pętli Czasowej',
            description: 'Obserwacja anomalii w strumieniu danych historycznych.',
            priority:    'CRITICAL',
            status:      'BLOCKED',
        },
    ], []);

    return (
        <div
            className="flex w-full text-[#E6F7FF] rounded-xl overflow-hidden"
            style={{
                minHeight:       '420px',
                backgroundColor: 'rgba(5, 5, 15, 0.95)',
                boxShadow:       'inset 0 0 30px rgba(0, 255, 255, 0.08)',
            }}
        >
            {/* ── LEWY PANEL: KOLEJKA ZADAŃ ── */}
            <div
                className="flex-none w-[38%] overflow-y-auto p-5"
                style={{ borderRight: '2px solid rgba(0, 255, 255, 0.1)' }}
                aria-label="Kolejka Zadań"
            >
                <h2 className="text-sm font-mono mb-4 text-cyan-400 pb-2 tracking-widest uppercase"
                    style={{ borderBottom: '1px dashed rgba(0,229,255,0.3)' }}
                >
                    [ Queue_System ] Kolejka Operacyjna (FIFO)
                </h2>

                {mockTasks.length > 0 ? (
                    mockTasks.map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))
                ) : (
                    <div
                        className="text-gray-400 p-6 text-xs"
                        style={{ border: '1px dashed rgba(100,100,100,0.4)' }}
                    >
                        Brak aktywnych zadań. System czeka na komendy nadawcy.
                    </div>
                )}
            </div>

            {/* ── PRAWY PANEL: OBSZAR OBSERWACYJNY ── */}
            <div
                className="flex-1 flex flex-col p-5"
                aria-label="Graf Wiedzy"
            >
                <h2 className="text-sm font-mono mb-4 text-cyan-400 pb-2 tracking-widest uppercase"
                    style={{ borderBottom: '1px dashed rgba(0,229,255,0.3)' }}
                >
                    [ Knowledge_Graph ] Obszar Obserwacyjny
                </h2>

                {/* Placeholder skanera */}
                <div
                    className="flex-1 relative flex items-center justify-center p-10 overflow-hidden rounded-lg"
                    style={{
                        background:  'rgba(0,0,0,0.3)',
                        border:      '2px solid rgba(0,229,255,0.15)',
                        boxShadow:   '0 0 20px rgba(0,255,255,0.1)',
                        minHeight:   '200px',
                    }}
                >
                    {/* Siatka skanowania */}
                    <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage:
                                'repeating-linear-gradient(to bottom, transparent 0px, rgba(0,255,255,0.08) 1px, transparent 2px)',
                            backgroundSize: '100% 28px',
                        }}
                    />

                    <div className="text-center z-10">
                        {/* Graf ikona */}
                        <svg
                            className="w-14 h-14 mx-auto text-cyan-500 mb-4 opacity-70"
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

                        <p className="text-base font-mono text-cyan-200">
                            Archiwista analizuje logi z warstwy kwantowej...
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            Status: Aktywny strumień danych. Nie znaleziono anomalii.
                        </p>

                        {/* Pasek postępu */}
                        <div className="mt-4 w-48 mx-auto h-1 rounded-full overflow-hidden bg-slate-800">
                            <div
                                className="h-full bg-cyan-500 rounded-full animate-pulse"
                                style={{ width: '60%' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
