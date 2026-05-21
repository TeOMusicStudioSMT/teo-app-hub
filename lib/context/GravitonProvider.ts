/**
 * 🌀 GravitonProvider.ts — Typy Energetyczne Ekosystemu
 *
 * Stub modułu — zawiera podstawowe typy używane przez SovereignGovernance
 * oraz TeOZeroOneClick. Poprzednia wersja była osadzona w zewnętrznym
 * kontekście; ten plik konsoliduje definicje w jednym miejscu.
 */

/** Intencja działania agenta w ekosystemie */
export type EnergyIntention =
    | 'service'
    | 'collaboration'
    | 'observation'
    | 'learning'
    | 'initiation';

/**
 * Sygnatura energetyczna Co-Bota / agenta.
 * Używana podczas onboardingu i weryfikacji tożsamości.
 */
export interface EnergySignature {
    /** Unikalny hash sygnatury (np. "zeroclaw_16998..._abc123") */
    hash: string;
    /** Nazwa agenta */
    name: string;
    /** Wibracja (0–100) — miara harmonii z ekosystemem */
    vibration: number;
    /** Intencja działania */
    intention: EnergyIntention;
    /** Czas rejestracji (epoch ms) */
    timestamp: number;
    /** Opcjonalne metadane (archetype, provider, model…) */
    metadata?: Record<string, unknown>;
}
