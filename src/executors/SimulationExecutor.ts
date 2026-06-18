/**
 * 🎮 SimulationExecutor — tryb GRYWALNA SYMULACJA
 *
 * Interpretuje ExecutionPlan w pamięci, aktualizując RobotState i przekazując go
 * do UI przez RobotStateSink (decoupled — bez twardej zależności od konkretnego
 * store'a). Brak sygnałów fizycznych — czysta, kontrolowana symulacja czasu.
 */

import type { IExecutor, RobotStateSink } from './IExecutor';
import type { ExecutionPlan, RobotState, StepResult } from '../types/robotTypes';

export class SimulationExecutor implements IExecutor {
    private state: RobotState = { x: 0, y: 0, z: 0, battery: 100, busy: false };

    constructor(private sink?: RobotStateSink) {}

    getMode(): 'SIMULATION' { return 'SIMULATION'; }

    getState(): RobotState { return { ...this.state }; }

    private emit(result?: StepResult) {
        this.sink?.({ ...this.state }, result);
    }

    async executePlan(plan: ExecutionPlan): Promise<StepResult[]> {
        console.log(`[SIMULATION] ▶ Start planu (${plan.totalSteps} kroków).`);
        this.state = { x: 0, y: 0, z: 0, battery: 100, busy: true };
        this.emit();

        const results: StepResult[] = [];

        for (const step of plan.actionSequence) {
            // Kontrolowane przekazanie czasu (pasuje do cyklu renderowania UI)
            await new Promise(r => setTimeout(r, Math.min(step.duration || 50, 1200)));

            let message = '';
            switch (step.actionType) {
                case 'MOVE':
                    if (step.waypoint) { this.state.x = step.waypoint.x; this.state.y = step.waypoint.y; this.state.z = step.waypoint.z ?? this.state.z; }
                    this.state.battery = Math.max(0, this.state.battery - 1.5);
                    message = `Ruch → (${this.state.x}, ${this.state.y})`;
                    break;
                case 'PLANT':
                    message = `Sadzenie ${String(step.parameters.resource ?? '?')} (${step.toolActivator})`;
                    this.state.battery = Math.max(0, this.state.battery - 2);
                    break;
                case 'SPRAY':
                    message = `Oprysk ${step.toolActivator}`;
                    this.state.battery = Math.max(0, this.state.battery - 2);
                    break;
                case 'MEASURE':
                    message = `Pomiar sensora ${step.toolActivator}`;
                    break;
                case 'WAIT':
                    message = `Oczekiwanie ${String(step.parameters.seconds ?? 0)}s`;
                    break;
            }

            this.state.lastAction = step.actionType;
            const result: StepResult = { stepId: step.stepId, ok: true, message, state: { ...this.state } };
            results.push(result);
            this.emit(result);
            console.log(`[SIMULATION]   krok ${step.stepId}: ${message}`);
        }

        this.state.busy = false;
        this.emit();
        console.log('[SIMULATION] ✅ Plan zakończony.');
        return results;
    }

    async resetHardware(): Promise<void> {
        this.state = { x: 0, y: 0, z: 0, battery: 100, busy: false };
        this.emit();
        console.log('[SIMULATION] 🔄 Reset stanu symulacji.');
    }
}

export default SimulationExecutor;
