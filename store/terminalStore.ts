/**
 * 🖥️ terminalStore — Centralna Pamięć Logów Terminala
 *
 * Operational Baseline v3.0 — Uszczelnienie Pamięci (RAM Kill)
 *
 * Mechanizm Sliding Window:
 *   - Tablica logów nigdy nie przekracza MAX_TERMINAL_LOGS (200) wpisów
 *   - Przy każdym dodaniu nowego logu najstarszy wpis jest automatycznie usuwany
 *   - addTerminalLogAtom jest jedynym autoryzowanym kanałem zapisu
 *
 * Wzorzec: atom (store) + atom pisania (write-only) — Jotai best practice
 */

import { atom } from 'jotai';

// ─── Twarda granica bufora logów ─────────────────────────────────────────────
export const MAX_TERMINAL_LOGS = 200;

// ─── Typy ────────────────────────────────────────────────────────────────────

export type TerminalLogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug' | 'system';

export interface TerminalLog {
    id:        string;
    timestamp: number;
    level:     TerminalLogLevel;
    message:   string;
    source?:   string;
}

// ─── Atom główny — przechowuje maksymalnie MAX_TERMINAL_LOGS wpisów ───────────
export const terminalLogsAtom = atom<TerminalLog[]>([]);

// ─── Atom pochodny (write-only) — implementuje Sliding Window ────────────────
// Użycie: const addLog = useSetAtom(addTerminalLogAtom);
//         addLog({ level: 'info', message: 'OK', source: 'Wiesław' });
export const addTerminalLogAtom = atom(
    null,
    (get, set, entry: Omit<TerminalLog, 'id' | 'timestamp'>) => {
        const newLog: TerminalLog = {
            id:        `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            ...entry,
        };

        const current = get(terminalLogsAtom);

        // Sliding Window: zatrzymaj ostatnie (MAX - 1) wpisów + nowy
        const next =
            current.length >= MAX_TERMINAL_LOGS
                ? [...current.slice(-(MAX_TERMINAL_LOGS - 1)), newLog]
                : [...current, newLog];

        set(terminalLogsAtom, next);
    }
);

// ─── Atom czytelny — filtruje logi według poziomu ────────────────────────────
export const terminalErrorLogsAtom = atom<TerminalLog[]>(
    (get) => get(terminalLogsAtom).filter(l => l.level === 'error')
);

// ─── Atom akcji — czyści całą tablicę ────────────────────────────────────────
export const clearTerminalLogsAtom = atom(null, (_get, set) => {
    set(terminalLogsAtom, []);
});
