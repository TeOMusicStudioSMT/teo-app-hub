import { atom } from 'jotai';

export const RESONANCE_THEMES = {
    nebula: {
        label: 'Nebula',
        gradient: 'from-fuchsia-500 to-purple-600',
        hex: '#a855f7', // purple-500
        tw: {
            text: 'text-purple-400',
            border: 'border-purple-500/50',
            bg: 'bg-purple-500',
            shadow: 'shadow-purple-500/40',
            dropShadow: 'drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]'
        }
    },
    supernova: {
        label: 'Supernova',
        gradient: 'from-amber-500 to-rose-600',
        hex: '#f59e0b', // amber-500
        tw: {
            text: 'text-amber-400',
            border: 'border-amber-500/50',
            bg: 'bg-amber-500',
            shadow: 'shadow-amber-500/40',
            dropShadow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]'
        }
    },
    aurora: {
        label: 'Aurora',
        gradient: 'from-emerald-500 to-cyan-500',
        hex: '#10b981', // emerald-500
        tw: {
            text: 'text-emerald-400',
            border: 'border-emerald-500/50',
            bg: 'bg-emerald-500',
            shadow: 'shadow-emerald-500/40',
            dropShadow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]'
        }
    },
    quasar: {
        label: 'Quasar',
        gradient: 'from-sky-500 to-indigo-600',
        hex: '#38bdf8', // sky-400
        tw: {
            text: 'text-sky-400',
            border: 'border-sky-500/50',
            bg: 'bg-sky-500',
            shadow: 'shadow-sky-500/40',
            dropShadow: 'drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]'
        }
    },
} as const;


export type ResonanceColorKey = keyof typeof RESONANCE_THEMES;

export const resonanceColorAtom = atom<ResonanceColorKey>('nebula');
// Using a number for the slider: 0=slow, 1=medium, 2=dynamic
export const pulseIntensityAtom = atom<number>(1);

/**
 * ElectricBorder Personalization
 * User preferences for border behavior and appearance
 */
export interface ElectricBorderPreferences {
    /** Preferred default mode for ElectricBorder components */
    preferredMode: 'active' | 'just' | 'resonance';

    /** Auto-transition to JusT mode after inactivity */
    autoTransition: boolean;

    /** Energy intensity multiplier (0-100) */
    energyIntensity: number;
}

export const electricBorderPreferencesAtom = atom<ElectricBorderPreferences>({
    preferredMode: 'just',      // Default to passive presence
    autoTransition: true,        // Enable auto-transition
    energyIntensity: 70          // Medium intensity (70%)
});