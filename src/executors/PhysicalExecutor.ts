/**
 * 🔌 PhysicalExecutor — tryb EXPORT DO FIZYCZNEGO ROBOTA
 *
 * Najbardziej krytyczny moduł: tu logika spotyka elektrykę. NIE dotyka stanu UI —
 * komunikuje się z Hardware Abstraction Layer (HAL = HardwareBus). Każda akcja jest
 * BLOKUJĄCA (await) — czekamy na potwierdzenie sprzężenia zwrotnego (encoder/sensor)
 * zanim przejdziemy do kroku N+1. Pełna, bezpieczna obsługa błędów szyny GPIO.
 *
 * (Dokończenie uciętego w strumieniu kodu HardwareBus + implementacji fizycznej.)
 */

import type { IExecutor, RobotStateSink } from './IExecutor';
import type { ExecutionPlan, RobotState, StepResult, Waypoint } from '../types/robotTypes';

// ── HAL: HardwareBus — symulowana szyna GPIO/silników (docelowo WebSerial/MQTT/ROS) ──
const HardwareBus = {
    /** Ruch siłowników z czekaniem na potwierdzenie encodera. */
    async moveActuatorMotor(target: Waypoint, signal?: AbortSignal): Promise<boolean> {
        console.log(`[HW] >> Sterownik silników: ruch do (${target.x}, ${target.y}).`);
        await HardwareBus._busDelay(120, signal);   // czas ruchu + odczyt encodera
        console.log('[HW] << Encoder potwierdził pozycję.');
        return true;
    },

    /** Zapis stanu pinu GPIO (HIGH/LOW) — fizyczna aktywacja narzędzia. */
    async writeToGpio(pinId: string, level: 'HIGH' | 'LOW', signal?: AbortSignal): Promise<boolean> {
        if (!pinId) throw new Error('HardwareBus: brak identyfikatora pinu GPIO.');
        console.log(`[HW] >> GPIO ${pinId} ← ${level}`);
        await HardwareBus._busDelay(60, signal);
        return true;
    },

    /** Odczyt sensora (np. czujnik odżywczy) z magistrali I2C/UART. */
    async readSensor(sensorId: string, signal?: AbortSignal): Promise<number> {
        console.log(`[HW] >> Odczyt sensora ${sensorId}...`);
        await HardwareBus._busDelay(80, signal);
        const value = Math.round(Math.random() * 100);
        console.log(`[HW] << ${sensorId} = ${value}`);
        return value;
    },

    /** Awaryjny stop — zwolnij wszystkie aktywatory. */
    async emergencyStop(): Promise<void> {
        console.warn('[HW] 🛑 EMERGENCY STOP — zwalniam wszystkie aktywatory (GPIO → LOW).');
        await HardwareBus._busDelay(40);
    },

    /** Wewnętrzne opóźnienie magistrali z obsługą przerwania (abort). */
    _busDelay(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new Error('Operacja przerwana (abort).'));
            const timer = setTimeout(resolve, ms);
            signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Operacja przerwana (abort).')); }, { once: true });
        });
    },
};

// Mapowanie abstrakcyjnych narzędzi (z parsera) na fizyczne piny GPIO — żyje TU (HAL), nie w parserze.
const GPIO_MAP: Record<string, string> = {
    TOOL_SEEDER:     'GPIO3',
    TOOL_SPRAYER:    'GPIO4',
    SENSOR_NUTRIENT: 'GPIO_I2C_1',
};

export class PhysicalExecutor implements IExecutor {
    private state: RobotState = { x: 0, y: 0, z: 0, battery: 100, busy: false };
    private abort = new AbortController();

    constructor(private sink?: RobotStateSink) {}

    getMode(): 'PHYSICAL' { return 'PHYSICAL'; }
    getState(): RobotState { return { ...this.state }; }
    private emit(result?: StepResult) { this.sink?.({ ...this.state }, result); }

    async executePlan(plan: ExecutionPlan): Promise<StepResult[]> {
        console.log(`[PHYSICAL] ▶ Wykonanie planu na sprzęcie (${plan.totalSteps} kroków).`);
        this.abort = new AbortController();
        this.state.busy = true;
        this.emit();

        const results: StepResult[] = [];
        const { signal } = this.abort;

        for (const step of plan.actionSequence) {
            let ok = true, message = '';
            try {
                switch (step.actionType) {
                    case 'MOVE':
                        if (step.waypoint) {
                            await HardwareBus.moveActuatorMotor(step.waypoint, signal);   // BLOKUJĄCO
                            this.state.x = step.waypoint.x; this.state.y = step.waypoint.y; this.state.z = step.waypoint.z ?? this.state.z;
                        }
                        message = `Silniki → (${this.state.x}, ${this.state.y})`;
                        break;
                    case 'PLANT':
                    case 'SPRAY': {
                        const pin = GPIO_MAP[step.toolActivator ?? ''] ?? '';
                        await HardwareBus.writeToGpio(pin, 'HIGH', signal);
                        await HardwareBus._busDelay(step.duration || 100, signal);        // czas pracy narzędzia
                        await HardwareBus.writeToGpio(pin, 'LOW', signal);
                        message = `${step.actionType} przez ${step.toolActivator} (${pin})`;
                        break;
                    }
                    case 'MEASURE': {
                        const pin = GPIO_MAP[step.toolActivator ?? ''] ?? 'SENSOR';
                        const reading = await HardwareBus.readSensor(pin, signal);
                        message = `Sensor ${pin} = ${reading}`;
                        break;
                    }
                    case 'WAIT':
                        await HardwareBus._busDelay(step.duration || 1000, signal);
                        message = `Pauza ${step.duration}ms`;
                        break;
                }
                this.state.battery = Math.max(0, this.state.battery - 1);
                this.state.lastAction = step.actionType;
            } catch (e) {
                // Bezpieczna obsługa błędów szyny GPIO: stop awaryjny + przerwanie planu.
                ok = false;
                message = `BŁĄD SPRZĘTU: ${(e as Error).message}`;
                console.error(`[PHYSICAL] ❌ krok ${step.stepId}: ${message}`);
                await HardwareBus.emergencyStop().catch(() => { /* już w trybie awaryjnym */ });
                results.push({ stepId: step.stepId, ok, message, state: { ...this.state } });
                this.state.busy = false;
                this.emit(results[results.length - 1]);
                return results;   // przerwij — nie ryzykujemy kolejnych ruchów po awarii
            }

            const result: StepResult = { stepId: step.stepId, ok, message, state: { ...this.state } };
            results.push(result);
            this.emit(result);
            console.log(`[PHYSICAL]   krok ${step.stepId}: ${message}`);
        }

        this.state.busy = false;
        this.emit();
        console.log('[PHYSICAL] ✅ Plan wykonany na sprzęcie.');
        return results;
    }

    /** Przerwij bieżące wykonanie (np. wyłącznik bezpieczeństwa Suwerena). */
    halt(): void { this.abort.abort(); }

    async resetHardware(): Promise<void> {
        this.abort.abort();
        await HardwareBus.emergencyStop().catch(() => { /* ignore */ });
        this.state = { x: 0, y: 0, z: 0, battery: 100, busy: false };
        this.emit();
        console.log('[PHYSICAL] 🔄 Reset sprzętu wykonany (GPIO → LOW).');
    }
}

export default PhysicalExecutor;
