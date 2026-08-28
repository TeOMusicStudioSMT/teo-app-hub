/**
 * 🎞️ contextFrames.ts — Dynamiczne Klatki Kontekstowe TeOgochi & Integracja DeepSeek-Harness.
 *
 * System przełączania Klatek (Multi-Frame) w locie podczas dialogu ze Sferą/Orbem:
 * - Klatka Muzyczna (MUSIC -> Joanna / Pętle audio / Synteza)
 * - Klatka Filmowa (VIDEO -> Klatka / Sceny / Montaż / Kadry)
 * - Klatka Kodu & Harnessu (CODE_HARNESS -> Kodeks / DeepSeek-Harness Loop)
 * - Klatka Wiedzy (KNOWLEDGE -> Wektor / Graf powiązań)
 * - Klatka Biznesu (BUSINESS -> Bilans / GRV Ledger)
 */

export type ContextFrameId = 'MUSIC' | 'VIDEO' | 'CODE_HARNESS' | 'KNOWLEDGE' | 'BUSINESS';

export interface ContextFrame {
    id: ContextFrameId;
    title: string;
    companionId: string;
    companionName: string;
    color: string;
    icon: string;
    description: string;
    triggerKeywords: string[];
    quickActions: { label: string; action: string; icon: string }[];
}

export const CONTEXT_FRAMES: Record<ContextFrameId, ContextFrame> = {
    MUSIC: {
        id: 'MUSIC',
        title: 'Klatka Muzyczna',
        companionId: 'joanna',
        companionName: 'Joanna',
        color: '#a855f7',
        icon: '🎵',
        description: 'Tworzenie pętli dźwiękowych, podkładów rytmicznych i playlist sonicznych.',
        triggerKeywords: ['muzyk', 'piosenk', 'utwór', 'audio', 'beat', 'rytmiczn', 'dźwięk', 'playlista', 'suno', 'melodi', 'śpiew', 'wokal', 'nut'],
        quickActions: [
            { label: 'Generuj Pętlę Audio', action: 'gen_audio_loop', icon: '🎧' },
            { label: 'Otwórz Studio Joanny', action: 'open_music_studio', icon: '🎹' },
            { label: 'Wektor Soniczny', action: 'sonic_vector', icon: '🧬' },
        ],
    },
    VIDEO: {
        id: 'VIDEO',
        title: 'Klatka Filmowa',
        companionId: 'klatka',
        companionName: 'Klatka',
        color: '#22d3ee',
        icon: '🎬',
        description: 'Układanie scen, cięcia montażowe, storyboard i generowanie kadrów.',
        triggerKeywords: ['wideo', 'video', 'film', 'kadr', 'scen', 'montaż', 'ujęci', 'timeline', 'animacj', 'klatki', 'kamera', 'render'],
        quickActions: [
            { label: 'Podgląd Scen', action: 'preview_scenes', icon: '🎞️' },
            { label: 'Renderuj Kadr', action: 'render_frame', icon: '🦎' },
            { label: 'Otwórz Montażownię', action: 'open_video_editor', icon: '✂️' },
        ],
    },
    CODE_HARNESS: {
        id: 'CODE_HARNESS',
        title: 'Klatka Kodu & Harness',
        companionId: 'kodeks',
        companionName: 'Kodeks',
        color: '#10b981',
        icon: '⚡',
        description: 'Autonomiczna pętla DeepSeek-Harness: planowanie, kodowanie, testy i autokorekta.',
        triggerKeywords: ['kod', 'skrypt', 'harness', 'deepseek', 'funkcj', 'refaktor', 'błąd', 'napraw', 'test', 'kompilacj', 'architektur', 'algorytm', 'backend', 'api'],
        quickActions: [
            { label: 'Uruchom Pętlę Harness', action: 'run_harness_loop', icon: '🔄' },
            { label: 'Audyt Kodu', action: 'code_audit', icon: '🛡️' },
            { label: 'Konsola Mechanika', action: 'open_mechanic', icon: '🔧' },
        ],
    },
    KNOWLEDGE: {
        id: 'KNOWLEDGE',
        title: 'Klatka Wiedzy',
        companionId: 'wektor',
        companionName: 'Wektor',
        color: '#06b6d4',
        icon: '🔮',
        description: 'Graf Katedry, powiązania semantyczne, trasy modułów i architektura.',
        triggerKeywords: ['wiedz', 'graf', 'wektor', 'powiązan', 'ścieżk', 'moduł', 'wyjaśnij', 'architektur', 'struktura'],
        quickActions: [
            { label: 'Przelicz Graf Wiedzy', action: 'recalculate_graph', icon: '🕸️' },
            { label: 'Eksplorator Loci', action: 'explore_loci', icon: '🧭' },
        ],
    },
    BUSINESS: {
        id: 'BUSINESS',
        title: 'Klatka Biznesu',
        companionId: 'bilans',
        companionName: 'Bilans',
        color: '#fbbf24',
        icon: '👑',
        description: 'Rejestr działalności, przepływy GRV, bilans energii i rynek.',
        triggerKeywords: ['biznes', 'pieniądz', 'grv', 'saldo', 'portfel', 'faktur', 'koszt', 'bilans', 'zarob', 'obrót', 'rynek'],
        quickActions: [
            { label: 'Raport Finansowy', action: 'financial_report', icon: '📊' },
            { label: 'Rejestr GRV', action: 'grv_ledger', icon: '🪙' },
        ],
    },
};

/**
 * Rozpoznaje Klatkę Kontekstową na podstawie treści wiadomości / głosu
 */
export function detectContextFrame(text: string): ContextFrameId | null {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();

    for (const frame of Object.values(CONTEXT_FRAMES)) {
        for (const kw of frame.triggerKeywords) {
            if (lower.includes(kw)) {
                return frame.id;
            }
        }
    }
    return null;
}

const BRIDGE_URL = 'http://127.0.0.1:3001';

export interface HarnessRunStatus {
    id: string;
    goal: string;
    frame: ContextFrameId;
    smartRalphMode?: boolean;
    status: 'PLANNING' | 'EXECUTING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
    plan?: {
        summary?: string;
        prd?: { title: string; objective: string; acceptanceCriteria: string[] };
        steps?: { id: number; action: string; desc: string; target: string }[];
        subtasks?: { id: number; title: string; action: string; desc: string; target: string; expectedOutcome: string }[];
    };
    steps: {
        id: number;
        title?: string;
        action: string;
        desc: string;
        status: string;
        result?: any;
        verification?: { passed: boolean; attempt: number; checks: string[]; timestamp: number };
        selfCorrection?: { attempt: number; diagnostic: string; timestamp: number };
    }[];
    assets: {
        type: string;
        title: string;
        previewUrl?: string;
        bpm?: number;
        key?: string;
        genre?: string;
        cuts?: number;
        resolution?: string;
        storyboard?: string;
    }[];
    delivery?: {
        runId: string;
        verdict: string;
        durationMs: number;
        totalSubtasks: number;
        successfulSubtasks: number;
        assets: any[];
    };
    reflection?: { status: string; note: string; coherence: number };
    error?: string;
}

/**
 * Uruchamia autonomiczną pętlę DeepSeek-Harness / Smart-Ralph na Moście
 */
export async function runHarnessTask(goal: string, frame: ContextFrameId = 'CODE_HARNESS', model?: string, smartRalphMode = true): Promise<{ success: boolean; runId?: string; smartRalphMode?: boolean; message: string }> {
    try {
        const res = await fetch(`${BRIDGE_URL}/api/harness/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal, frame, model, smartRalphMode }),
        });
        return await res.json();
    } catch (e: any) {
        return { success: false, message: `Błąd połączenia z mostem Smart-Ralph: ${e.message}` };
    }
}

/**
 * Dedykowany wywoływacz Smart-Ralph
 */
export async function runSmartRalphTask(goal: string, frame: ContextFrameId, model?: string) {
    return runHarnessTask(goal, frame, model, true);
}

/**
 * Pobiera status pętli harness / Smart-Ralph
 */
export async function getHarnessStatus(runId?: string): Promise<HarnessRunStatus | null> {
    try {
        const res = await fetch(`${BRIDGE_URL}/api/harness/status${runId ? `/${runId}` : ''}`);
        const data = await res.json();
        return data.success ? data.run : null;
    } catch {
        return null;
    }
}

/**
 * Przełącza Klatkę na Moście
 */
export async function switchBridgeFrame(frameId: ContextFrameId): Promise<boolean> {
    try {
        const res = await fetch(`${BRIDGE_URL}/api/harness/frame/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frame: frameId }),
        });
        const d = await res.json();
        return Boolean(d.success);
    } catch {
        return false;
    }
}
