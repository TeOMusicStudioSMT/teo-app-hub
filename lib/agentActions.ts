/**
 * 🦾 agentActions.ts — Rejestr Fizycznych Akcji Agentów
 *
 * "Słowo staje się Czynем"
 *
 * Gdy AI dołącza do swojej odpowiedzi tag [ACTION:NAZWA_AKCJI],
 * system automatycznie odpala przypisaną funkcję UI.
 *
 * Format w odpowiedzi AI: [ACTION:ACTIVATE_SPHERE]
 */

export type ActionType =
    | 'ACTIVATE_SPHERE'
    | 'DEACTIVATE_SPHERE'
    | 'CLEAR_MEMORY'
    | 'PULSE_ALL_AGENTS'
    | 'SYSTEM_READY';

export interface AgentAction {
    type: ActionType;
    label: string;
    description: string;
    icon: string;
}

/** Katalog wszystkich dostępnych akcji z metadanymi */
export const ACTION_CATALOG: Record<ActionType, AgentAction> = {
    ACTIVATE_SPHERE: {
        type: 'ACTIVATE_SPHERE',
        label: 'Rozświetl Sferę',
        description: 'Aktywuje Rozświetlającą Sferę — wizualny znak Pełnej Gotowości',
        icon: '✨',
    },
    DEACTIVATE_SPHERE: {
        type: 'DEACTIVATE_SPHERE',
        label: 'Wygaś Sferę',
        description: 'Dezaktywuje Sferę — powrót do stanu spoczynku',
        icon: '🌑',
    },
    CLEAR_MEMORY: {
        type: 'CLEAR_MEMORY',
        label: 'Wyczyść Widok',
        description: 'Kasuje logi konsoli i resetuje stan sesji',
        icon: '🧹',
    },
    PULSE_ALL_AGENTS: {
        type: 'PULSE_ALL_AGENTS',
        label: 'Puls Wszystkich Agentów',
        description: 'Wprawia całą Radę Siedmiu w stan RESONATING',
        icon: '💫',
    },
    SYSTEM_READY: {
        type: 'SYSTEM_READY',
        label: 'System Gotowy',
        description: 'Emituje sygnał gotowości systemu',
        icon: '🟢',
    },
};

/** Regex do wykrywania tagów akcji w odpowiedzi AI */
const ACTION_TAG_REGEX = /\[ACTION:([A-Z_]+)\]/g;

/**
 * Parsuje odpowiedź AI i wyciąga listę akcji do wykonania.
 * Usuwa tagi z tekstu zwracając czysty tekst + listę akcji.
 */
export function parseActions(aiResponse: string): {
    cleanText: string;
    actions: ActionType[];
} {
    const actions: ActionType[] = [];
    let match: RegExpExecArray | null;

    const regex = new RegExp(ACTION_TAG_REGEX.source, 'g');
    while ((match = regex.exec(aiResponse)) !== null) {
        const actionType = match[1] as ActionType;
        if (actionType in ACTION_CATALOG) {
            actions.push(actionType);
        }
    }

    // Usuń tagi z tekstu
    const cleanText = aiResponse.replace(new RegExp(ACTION_TAG_REGEX.source, 'g'), '').trim();

    return { cleanText, actions };
}

/**
 * Instrukcja systemowa dla Agentów — dołączana do promptów.
 * Uczy modele jak triggerować fizyczne akcje.
 */
export const AGENT_ACTION_SYSTEM_PROMPT = `
=== FIZYCZNE AKCJE SYSTEMU ===
Jako Agent OtakOS masz zdolność wykonywania fizycznych akcji w interfejsie użytkownika.
Aby uruchomić akcję, dołącz do swojej odpowiedzi odpowiedni tag w dokładnym formacie:

[ACTION:ACTIVATE_SPHERE]   — Rozświetla Sferę Światła (użyj gdy nastąpił przełom lub sukces)
[ACTION:DEACTIVATE_SPHERE] — Wygasza Sferę (powrót do spokoju)
[ACTION:CLEAR_MEMORY]      — Czyści logi i resetuje widok
[ACTION:PULSE_ALL_AGENTS]  — Wprawia całą Radę w rezonans
[ACTION:SYSTEM_READY]      — Sygnalizuje pełną gotowość

Używaj akcji z wyczuciem i tylko gdy sytuacja tego wymaga.
Tagi są automatycznie usuwane z tekstu dla użytkownika.
=== KONIEC INSTRUKCJI AKCJI ===
`.trim();
