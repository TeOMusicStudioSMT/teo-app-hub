/**
 * 🚌 OtakOS Bus — Magistrala Zdarzeń Katedry 0.00G
 *
 * Łączy moduły: Terminal ↔ Klaudiusz ↔ Widok ↔ Rada ↔ Crew
 *
 * Zasada: emit → subscribe → route
 * Każdy moduł emituje zdarzenia i może subskrybować zdarzenia innych.
 */

import { useEffect, useRef } from 'react';

// ── Typy ──────────────────────────────────────────────────────────

export type BusModule =
    | 'terminal'
    | 'klaudiusz'
    | 'widok'
    | 'rada'
    | 'crew'
    | 'system';

export interface BusEvent {
    id:      string;
    from:    BusModule;
    type:    string;          // np. 'report.ready', 'message', 'agent.created'
    payload: Record<string, unknown>;
    ts:      number;
}

export type BusListener = (event: BusEvent) => void;

// ── Nazwy zdarzeń (dla czytelności) ───────────────────────────────

export const BUS = {
    // Terminal
    TERMINAL_RESULT:  'terminal.result',   // wynik komendy/LLM
    TERMINAL_RUN:     'terminal.run',      // przyjmij task z zewnątrz

    // Klaudiusz
    KLAUDIUSZ_MSG:    'klaudiusz.message', // odpowiedź asystenta
    KLAUDIUSZ_INJECT: 'klaudiusz.inject',  // wstrzyknij tekst do inputu

    // Widok
    WIDOK_REPORT:     'widok.report',      // raport wygenerowany
    WIDOK_COUNCIL:    'widok.council',     // żądanie otwarcia Rady

    // Rada
    RADA_OPENED:      'rada.opened',

    // Crew
    CREW_AGENT:          'crew.agent.created',
    CREW_SAVED:          'crew.saved',
    CREW_TRAINING_QUEUE: 'crew.training.queue',

    // Inkubator
    INKUBATOR_TRAINED:   'inkubator.trained',
    INKUBATOR_DEPLOYED:  'inkubator.deployed',
} as const;

// ── Klasa magistrali ──────────────────────────────────────────────

class OtakOSBusClass {
    private listeners = new Set<BusListener>();
    private _log: BusEvent[] = [];

    emit(from: BusModule, type: string, payload: Record<string, unknown> = {}): void {
        const event: BusEvent = {
            id:      crypto.randomUUID(),
            from,
            type,
            payload,
            ts:      Date.now(),
        };
        this._log = [...this._log.slice(-99), event];
        this.listeners.forEach(l => {
            try { l(event); } catch { /* ignoruj błędy listenerów */ }
        });
        console.log(`[🚌 Bus] ${from} → ${type}`, payload);
    }

    subscribe(listener: BusListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    get log(): BusEvent[] {
        return [...this._log];
    }

    /** Ostatnie zdarzenie danego typu */
    last(type: string): BusEvent | undefined {
        return [...this._log].reverse().find(e => e.type === type);
    }

    /** Liczba listenerów (diagnostic) */
    get listenerCount(): number {
        return this.listeners.size;
    }
}

export const OtakOSBus = new OtakOSBusClass();

// ── React Hook ────────────────────────────────────────────────────

/**
 * useOtakOSBus — subskrybuje magistralę, zwraca instancję busa.
 *
 * Listener jest opakowany w ref, więc nie wymaga odnawiania subskrypcji
 * przy każdym renderze — subskrypcja rejestrowana jest raz.
 */
export function useOtakOSBus(listener?: BusListener): OtakOSBusClass {
    const listenerRef = useRef<BusListener | undefined>(listener);
    listenerRef.current = listener;

    useEffect(() => {
        if (!listenerRef.current) return;
        return OtakOSBus.subscribe(ev => listenerRef.current?.(ev));
    }, []); // subskrybuj raz

    return OtakOSBus;
}
