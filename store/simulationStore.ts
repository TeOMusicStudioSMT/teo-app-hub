/**
 * 🧠 simulationStore — Stan pętli wnioskujących TeO-Sim Academy (Reasoning Loops)
 *
 * Zustand store synchronizujący przebieg pętli wnioskującej z Dashboardem React
 * w czasie rzeczywistym (stream logów myślowych). Zasilany przez
 * ReasoningLoopSimulator (Kotwica Prawdy + 3 warstwy kontrolne).
 */

import { create } from 'zustand';

export type LogRole = 'ACTION' | 'THOUGHT' | 'ERROR' | 'VALIDATION' | 'REWARD' | 'PENALTY' | 'SYSTEM';

export interface ReasoningLog {
    timestamp: number;
    role:      LogRole;
    text:      string;
    loop?:     number;
    tier?:     string;
}

export interface SimulationResult {
    agentId:     string;
    resolved:    boolean;
    loops:       number;
    totalTokens: number;
    finalTier:   string;
}

interface SimulationStore {
    logs:       ReasoningLog[];
    isRunning:  boolean;
    result:     SimulationResult | null;
    activeAgent: string | null;

    pushLog:    (entry: Omit<ReasoningLog, 'timestamp'>) => void;
    setRunning: (v: boolean) => void;
    setResult:  (r: SimulationResult | null) => void;
    setAgent:   (id: string | null) => void;
    reset:      () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
    logs:        [],
    isRunning:   false,
    result:      null,
    activeAgent: null,

    pushLog: (entry) => set((s) => ({
        logs: [...s.logs.slice(-199), { ...entry, timestamp: Date.now() }],   // cap 200
    })),
    setRunning: (v) => set({ isRunning: v }),
    setResult:  (r) => set({ result: r }),
    setAgent:   (id) => set({ activeAgent: id }),
    reset:      () => set({ logs: [], result: null, isRunning: false, activeAgent: null }),
}));
