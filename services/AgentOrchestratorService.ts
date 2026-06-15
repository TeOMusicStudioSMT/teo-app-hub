/**
 * 🏛️ AgentOrchestratorService — Wieloagentowy Potok Operacyjny 0.00G
 *
 * Session Isolation: każde zadanie Rady dostaje unikalny sessionId.
 * Główny wątek rozmowy Suwerena pozostaje wolny — agenci pracują w tle
 * przez kolejkę MechanicService na Wiesio Bridge (:3001).
 *
 * Architektura:
 *   Suweren / W.I.D.O.K.
 *       → AgentOrchestratorService.startDecomposition(topic)
 *       → POST /api/agent/rada-decompose (Gemma4 Rada)
 *       → MechanicService Queue (Mechanik / Impresario / Tost / Klaudiusz)
 *       → Polling getSessionStatus(sessionId)
 *       → onProgress / onComplete callbacks
 */

const BRIDGE = 'http://127.0.0.1:3001';

// ─── Typy ─────────────────────────────────────────────────────────────────────

export type AgentRole = 'mechanik' | 'impresario' | 'tost' | 'klaudiusz';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
export type SessionStatus = 'DECOMPOSING' | 'DISPATCHED' | 'DONE' | 'ERROR';

export interface AgentSubTask {
    id:          string;
    title:       string;
    description: string;
    agent:       AgentRole;
    priority:    'CRITICAL' | 'HIGH' | 'LOW';
    sessionId:   string;
    status:      TaskStatus;
    createdAt:   string;
}

export interface AgentSession {
    sessionId:  string;
    topic:      string;
    status:     SessionStatus;
    tasks:      AgentSubTask[];
    createdAt:  Date;
    completedAt?: Date;
    error?:     string;
}

type ProgressCallback = (session: AgentSession) => void;

// ─── Serwis ───────────────────────────────────────────────────────────────────

class AgentOrchestratorServiceClass {
    private sessions  = new Map<string, AgentSession>();
    private pollers   = new Map<string, ReturnType<typeof setInterval>>();

    /**
     * Inicjuje dekompozycję zadania przez Radę (Gemma4).
     * Nie blokuje UI — zwraca sessionId natychmiast po wysłaniu.
     * Opcjonalne callbacki: onProgress (co poll), onComplete (gdy DONE).
     */
    async startDecomposition(
        topic:       string,
        context      = '',
        temperature  = 0.67,
        onProgress?: ProgressCallback,
        onComplete?: ProgressCallback,
    ): Promise<string> {
        const tempSessionId = `orch-${Date.now().toString(36)}`;

        const session: AgentSession = {
            sessionId: tempSessionId,
            topic,
            status:    'DECOMPOSING',
            tasks:     [],
            createdAt: new Date(),
        };
        this.sessions.set(tempSessionId, session);
        onProgress?.(session);

        try {
            const res = await fetch(`${BRIDGE}/api/agent/rada-decompose`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ topic, context, temperature }),
            });

            if (!res.ok) throw new Error(`Bridge HTTP ${res.status}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Rada error');

            const realSessionId: string = data.sessionId ?? tempSessionId;

            const updatedSession: AgentSession = {
                ...session,
                sessionId: realSessionId,
                status:    'DISPATCHED',
                tasks:     data.tasks ?? [],
            };

            this.sessions.delete(tempSessionId);
            this.sessions.set(realSessionId, updatedSession);
            onProgress?.(updatedSession);

            // Rozpocznij polling statusu zadań w tle (co 8s)
            this._startPolling(realSessionId, onProgress, onComplete);

            return realSessionId;

        } catch (e: any) {
            session.status = 'ERROR';
            session.error  = e.message;
            this.sessions.set(tempSessionId, session);
            onProgress?.(session);
            throw e;
        }
    }

    getSession(sessionId: string): AgentSession | null {
        return this.sessions.get(sessionId) ?? null;
    }

    getSessions(): AgentSession[] {
        return Array.from(this.sessions.values()).sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
    }

    cancelSession(sessionId: string): void {
        this._stopPolling(sessionId);
        const s = this.sessions.get(sessionId);
        if (s) {
            s.status = 'ERROR';
            s.error  = 'Anulowano przez Suwerena.';
        }
    }

    // ── Prywatne ─────────────────────────────────────────────────────────────

    private _startPolling(
        sessionId:   string,
        onProgress?: ProgressCallback,
        onComplete?: ProgressCallback,
    ): void {
        if (this.pollers.has(sessionId)) return;

        const interval = setInterval(async () => {
            const session = this.sessions.get(sessionId);
            if (!session) { this._stopPolling(sessionId); return; }

            try {
                const res  = await fetch(`${BRIDGE}/api/mechanic/queue`);
                const data = await res.json();
                if (!data.success) return;

                const queueTasks: Array<{ id?: string; title?: string; status?: string; sessionId?: string }> =
                    data.tasks ?? [];

                // Filtruj pod-zadania tej sesji (tytuł zawiera session token lub sessionId)
                const sessionTasks = queueTasks.filter(
                    t => t.sessionId === sessionId || (t.title ?? '').includes(sessionId)
                );

                // Zaktualizuj statusy znanych zadań
                session.tasks = session.tasks.map(st => {
                    const match = sessionTasks.find(qt => qt.id === st.id);
                    if (match?.status) return { ...st, status: match.status as TaskStatus };
                    return st;
                });

                const allDone = session.tasks.length > 0 &&
                    session.tasks.every(t => t.status === 'DONE' || t.status === 'FAILED');

                if (allDone) {
                    session.status      = 'DONE';
                    session.completedAt = new Date();
                    onProgress?.(session);
                    onComplete?.(session);
                    this._stopPolling(sessionId);
                } else {
                    onProgress?.(session);
                }
            } catch { /* bridge offline — czekaj na następny poll */ }
        }, 8_000);

        this.pollers.set(sessionId, interval);
    }

    private _stopPolling(sessionId: string): void {
        const interval = this.pollers.get(sessionId);
        if (interval) {
            clearInterval(interval);
            this.pollers.delete(sessionId);
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance: AgentOrchestratorServiceClass | null = null;

export const AgentOrchestratorService = {
    getInstance(): AgentOrchestratorServiceClass {
        if (!_instance) _instance = new AgentOrchestratorServiceClass();
        return _instance;
    },
};

export default AgentOrchestratorService;
