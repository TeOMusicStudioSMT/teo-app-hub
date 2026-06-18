/**
 * 🌾 AgroBridgeService — Trójfazowy parser komend Agro-Robotics
 *
 * Warstwa abstrakcyjna (zero zależności od React i sprzętu). Tłumaczy deklaratywny
 * skrypt (np. "move(North), plant('A'), wait(2)") na ustrukturyzowany ExecutionPlan.
 *
 * Trzy fazy (zatwierdzone przez Radę):
 *   I.   Tokenizacja  — rozbicie tekstu na segmenty komend.
 *   II.  Parsing AST  — wyciągnięcie nazwy akcji + parametrów, walidacja składni.
 *   III. Semantic Map — przekształcenie na ActionStep (waypoint XYZ + abstrakcyjny
 *        toolActivator). GPIO NIE należy tu (Rada: pin-mapping żyje w HAL).
 *
 * + Safe-Mode: validatePlan() sprawdza granice pola zanim plan trafi do Executora.
 */

import type { ExecutionPlan, Waypoint, ActionStep, ActionType } from '../types/robotTypes';

/** Słownik kierunków → wektory ruchu w gridzie. */
const DIRECTION_MAP: Record<string, { dx: number; dy: number }> = {
    NORTH: { dx: 0, dy: +1 },
    SOUTH: { dx: 0, dy: -1 },
    EAST:  { dx: +1, dy: 0 },
    WEST:  { dx: -1, dy: 0 },
};

/** Abstrakcyjny słownik narzędzi (bez pinów GPIO — te rozwiązuje HAL/PhysicalExecutor). */
const TOOL_MAP: Record<string, { toolActivator: string; label: string }> = {
    A: { toolActivator: 'TOOL_SEEDER',     label: 'Siewnik' },
    B: { toolActivator: 'TOOL_SPRAYER',    label: 'Opryskiwacz' },
    N: { toolActivator: 'SENSOR_NUTRIENT', label: 'Sensor odżywczy' },
};

/** Granice pola dla Safe-Mode (Rada rec. #3). */
const FIELD_BOUNDS = { minX: -50, maxX: 50, minY: -50, maxY: 50 };

export class AgroBridgeService {
    /**
     * Pełny potok: surowy skrypt → ExecutionPlan.
     * @param scriptCode np. "move(North), plant('A'), wait(2)"
     */
    public static parseScript(scriptCode: string): ExecutionPlan {
        if (!scriptCode || !scriptCode.trim()) {
            throw new Error('AgroBridge: pusty skrypt — nie załadowano komend.');
        }

        // ── FAZA I: Tokenizacja ────────────────────────────────────────────────
        const tokens = this.tokenize(scriptCode);

        // ── FAZA II + III: Parsing + Mapowanie semantyczne ─────────────────────
        const actionSequence: ActionStep[] = [];
        const waypoints: Waypoint[] = [];
        let cursor: Waypoint = { x: 0, y: 0, z: 0 };  // bieżąca pozycja robota

        tokens.forEach((token, index) => {
            try {
                const { actionName, params } = this.parseToken(token);          // FAZA II
                const step = this.mapSemantics(actionName, params, cursor, index); // FAZA III
                actionSequence.push(step);
                if (step.actionType === 'MOVE' && step.waypoint) {
                    cursor = step.waypoint;
                    waypoints.push(step.waypoint);
                }
            } catch (e) {
                // Decyzja architektoniczna: błędny token logujemy i kontynuujemy.
                console.warn(`[AgroBridge] ⚠️ Token "${token}" pominięty: ${(e as Error).message}`);
            }
        });

        return { totalSteps: actionSequence.length, waypoints, actionSequence };
    }

    /** FAZA I — rozbij skrypt na komendy `action(params)`. */
    private static tokenize(scriptCode: string): string[] {
        return scriptCode
            .replace(/\/\/[^\n]*/g, '')           // usuń komentarze //
            .split(/[;,\n]+/)                       // separatory: ; , nowa linia
            .map(t => t.trim())
            .filter(Boolean);
    }

    /** FAZA II — wyciągnij nazwę akcji i listę parametrów. */
    private static parseToken(token: string): { actionName: string; params: string[] } {
        const m = token.match(/^([a-zA-Z_]+)\s*\((.*)\)$/);
        if (!m) throw new Error(`Nieprawidłowy format (oczekiwano action(params)): ${token}`);
        const [, actionName, rawParams] = m;
        const params = rawParams.trim()
            ? rawParams.split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''))
            : [];
        return { actionName: actionName.toLowerCase(), params };
    }

    /** FAZA III — mapowanie na ActionStep z waypointem / abstrakcyjnym narzędziem. */
    private static mapSemantics(actionName: string, params: string[], cursor: Waypoint, idx: number): ActionStep {
        const base = { stepId: idx + 1, parameters: {} as Record<string, unknown>, duration: 0 };

        switch (actionName) {
            case 'move': {
                const dir = (params[0] || '').toUpperCase();
                const vec = DIRECTION_MAP[dir];
                if (!vec) throw new Error(`Nieznany kierunek: ${params[0]}`);
                const waypoint: Waypoint = { x: cursor.x + vec.dx, y: cursor.y + vec.dy, z: cursor.z ?? 0 };
                return { ...base, actionType: 'MOVE', waypoint, parameters: { direction: dir }, duration: 600, expectedState: `pos=(${waypoint.x},${waypoint.y})` };
            }
            case 'plant':
            case 'spray': {
                const key = (params[0] || 'A').toUpperCase();
                const tool = TOOL_MAP[key];
                if (!tool) throw new Error(`Nieznane narzędzie/składnik: ${params[0]}`);
                const actionType: ActionType = actionName === 'plant' ? 'PLANT' : 'SPRAY';
                return { ...base, actionType, waypoint: { ...cursor }, toolActivator: tool.toolActivator, parameters: { resource: key, tool: tool.label }, duration: 800, expectedState: `${tool.toolActivator}=DONE` };
            }
            case 'measure': {
                return { ...base, actionType: 'MEASURE', waypoint: { ...cursor }, toolActivator: TOOL_MAP.N.toolActivator, parameters: { sensor: 'nutrient' }, duration: 400, expectedState: 'reading=OK' };
            }
            case 'wait': {
                const sec = parseFloat(params[0] || '1');
                return { ...base, actionType: 'WAIT', parameters: { seconds: sec }, duration: Math.max(0, sec) * 1000, expectedState: 'idle' };
            }
            default:
                throw new Error(`Nieobsługiwana akcja: ${actionName}`);
        }
    }

    /**
     * Safe-Mode (Rada rec. #3): waliduje plan przed wykonaniem.
     * @returns lista naruszeń (pusta = plan bezpieczny).
     */
    public static validatePlan(plan: ExecutionPlan): string[] {
        const violations: string[] = [];
        for (const wp of plan.waypoints) {
            if (wp.x < FIELD_BOUNDS.minX || wp.x > FIELD_BOUNDS.maxX || wp.y < FIELD_BOUNDS.minY || wp.y > FIELD_BOUNDS.maxY) {
                violations.push(`Waypoint (${wp.x}, ${wp.y}) poza granicami pola.`);
            }
        }
        if (plan.totalSteps === 0) violations.push('Plan pusty — brak prawidłowych komend.');
        return violations;
    }
}

export default AgroBridgeService;
