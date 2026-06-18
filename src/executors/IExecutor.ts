/**
 * 🤖 IExecutor — Kontrakt warstwy wykonawczej (Factory + Strategy)
 *
 * Rada (Adamus): jeden interfejs, dwie implementacje (SimulationExecutor,
 * PhysicalExecutor). Przełącznik trybu w Szmaragdowym Terminalu zmienia silnik
 * BEZ dotykania logiki parsera (AgroBridgeService).
 */

import type { ExecutionPlan, ExecutionMode, StepResult, RobotState } from '../types/robotTypes';

/** Sink stanu robota — UI/symulacja podpina callback, sprzęt odczytuje sensory. */
export type RobotStateSink = (state: RobotState, lastResult?: StepResult) => void;

export interface IExecutor {
    /** Tryb pracy silnika. */
    getMode(): ExecutionMode;

    /**
     * Wykonuje cały ExecutionPlan krok po kroku (blokująco, z await).
     * @returns wyniki poszczególnych kroków (do logu / feedback loop).
     */
    executePlan(plan: ExecutionPlan): Promise<StepResult[]>;

    /** Reset stanu robota (po awarii / restarcie manualnym). */
    resetHardware(): Promise<void>;

    /** Bieżący stan robota. */
    getState(): RobotState;
}

/** Fabryka silników — wybór implementacji na podstawie trybu. */
export type ExecutorFactory = (mode: ExecutionMode, sink?: RobotStateSink) => IExecutor;
