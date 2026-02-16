import { atom } from 'jotai';

/**
 * ElectricBorder Mode Types
 * Based on PEIE philosophy (Protocol of Energy, Information & Exchange)
 */
export type ElectricBorderMode = 'active' | 'just' | 'resonance';

/**
 * Global state for ElectricBorder components
 * Allows synchronized behavior across multiple instances
 */
export interface ElectricBorderState {
    /** Current global mode - affects all borders with useGlobalState=true */
    globalMode: ElectricBorderMode;

    /** Energy level (0-100) - visual intensity indicator */
    energyLevel: number;

    /** Is user currently interacting with the application? */
    isUserPresent: boolean;

    /** Timestamp of last interaction */
    lastInteraction: Date | null;
}

/**
 * Default state: JusT Mode - Passive Presence
 * Aligns with PEIE philosophy of respecting user attention
 */
const defaultState: ElectricBorderState = {
    globalMode: 'just',      // Default to calm, passive presence
    energyLevel: 30,         // Low baseline energy (30%)
    isUserPresent: false,    // No interaction yet
    lastInteraction: null
};

/**
 * Main atom for global ElectricBorder state
 */
export const electricBorderAtom = atom<ElectricBorderState>(defaultState);

/**
 * Write-only atom to update global mode
 */
export const setGlobalModeAtom = atom(
    null,
    (get, set, newMode: ElectricBorderMode) => {
        const currentState = get(electricBorderAtom);

        // Map mode to energy level
        const energyLevels: Record<ElectricBorderMode, number> = {
            'just': 30,       // Passive - low energy
            'active': 100,    // Active - full energy
            'resonance': 70   // Resonance - harmonious energy
        };

        set(electricBorderAtom, {
            ...currentState,
            globalMode: newMode,
            energyLevel: energyLevels[newMode],
            isUserPresent: newMode !== 'just',
            lastInteraction: new Date()
        });
    }
);

/**
 * Write-only atom to update user presence
 */
export const setUserPresenceAtom = atom(
    null,
    (get, set, isPresent: boolean) => {
        const currentState = get(electricBorderAtom);

        set(electricBorderAtom, {
            ...currentState,
            isUserPresent: isPresent,
            lastInteraction: isPresent ? new Date() : currentState.lastInteraction,
            globalMode: isPresent ? 'active' : 'just'
        });
    }
);
