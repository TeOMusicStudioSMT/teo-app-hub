/**
 * 🌾 robotTypes — Globalne typy Agro-Robotics Simulator
 *
 * Jedyne źródło prawdy dla struktur danych przepływających przez potok:
 *   AgroBridgeService (parser) → ExecutionPlan → IExecutor (Sim/Physical).
 *
 * Wzorzec zatwierdzony przez Radę (Adamus): separacja parsera od sprzętu (HAL),
 * pętla sprzężenia zwrotnego (expectedState) i tryb bezpieczeństwa (Safe-Mode).
 */

export type ActionType = 'MOVE' | 'PLANT' | 'SPRAY' | 'WAIT' | 'MEASURE';

export type ExecutionMode = 'SIMULATION' | 'PHYSICAL';

/** Precyzyjna trajektoria / współrzędne na polu. */
export interface Waypoint {
    x: number;
    y: number;
    z?: number;   // wysokość / głębokość (np. głębokość sadzenia)
}

/** Pojedynczy, atomowy krok wykonawczy robota (uniwersalny dla Sim i Physical). */
export interface ActionStep {
    stepId:        number;                 // ID kroku (śledzenie błędów / feedback)
    actionType:    ActionType;
    waypoint?:     Waypoint;               // cel ruchu (dla MOVE)
    toolActivator?: string;                // ABSTRAKCYJNY identyfikator narzędzia (np. 'TOOL_A')
    parameters:    Record<string, unknown>; // dane akcji (np. { seed: 'Corn' })
    duration:      number;                 // czas wykonania / oczekiwania w ms
    expectedState?: string;                // Rada: czego oczekujemy po kroku (feedback loop)
}

/** Pełny plan operacyjny — jedyny punkt prawdy dla Executora. */
export interface ExecutionPlan {
    totalSteps:    number;
    waypoints:     Waypoint[];     // sekwencja kalkulowanych punktów XYZ
    actionSequence: ActionStep[];  // ustrukturyzowana sekwencja działań
}

/** Bieżący stan robota (Sim aktualizuje w pamięci, Physical odczytuje z sensorów). */
export interface RobotState {
    x:        number;
    y:        number;
    z:        number;
    battery:  number;   // 0-100 %
    busy:     boolean;
    lastAction?: string;
}

/** Wynik wykonania pojedynczego kroku (do logów / pętli sprzężenia zwrotnego). */
export interface StepResult {
    stepId:  number;
    ok:      boolean;
    message: string;
    state:   RobotState;
}
