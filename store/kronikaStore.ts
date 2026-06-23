/**
 * 📜 kronikaStore.ts — Trwały Stan Kroniki 0.00G
 *
 * Używa atomWithStorage → synchronizacja z localStorage.
 * Stan przeżywa odświeżenie (F5) i powrót na kartę.
 *
 * Schemat przechowywania:
 *   klucz: 'kronika_history'  → Creation[]
 *   klucz: 'kronika_grv_total' → number (cache sumy, opcjonalny)
 *
 * Reviver przekształca string ISO → Date dla pola timestamp.
 */

import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import type { Creation } from '../components/special/Kronika00G/components/types';

// ─── Custom Storage z reviwerem dla Date ───────────────────────────────────────

const kronikaStorage = createJSONStorage<Creation[]>(() => localStorage, {
  /**
   * Reviver: `timestamp` pola w JSON (string ISO) → Date object.
   * Działa głęboko — JSON.parse wywołuje go na każdym polu.
   */
  reviver: (key: string, value: unknown): unknown => {
    if (key === 'timestamp' && typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? value : parsed;
    }
    return value;
  },
});

// ─── Atom główny — historia wpisów ────────────────────────────────────────────

/**
 * Lista wpisów Kroniki.
 * Domyślna wartość (pusta tablica) jest używana tylko gdy localStorage jest puste.
 * Starter wpis jest ustawiany przez komponent przy pierwszym uruchomieniu.
 */
export const kronikaHistoryAtom = atomWithStorage<Creation[]>(
  'kronika_history',
  [],
  kronikaStorage,
);

// ─── Atom pochodny — łączne GRV ───────────────────────────────────────────────

/**
 * Suma punktów GRV ze wszystkich wpisów.
 * Read-only (derived). Automatycznie aktualizowany gdy historia się zmienia.
 */
export const totalGrvAtom = atom<number>((get) =>
  get(kronikaHistoryAtom).reduce(
    (sum, creation) => sum + (creation.mission?.xp ?? 0),
    0,
  ),
);

// ─── Atom pochodny — statystyki aur ───────────────────────────────────────────

export interface AuraStats {
  gold:   number;
  cyan:   number;
  violet: number;
}

// ─── Żywe wpisy Kroniki (narracja AI + feedback agentów) ──────────────────────

export interface KronikaComment { agent: string; text: string; }
export interface KronikaEntry {
  id:         string;
  title:      string;
  narrative:  string;
  xp:         number;
  aura:       string;              // cyan | gold | magenta | violet
  videoUrl?:  string | null;
  comments:   KronikaComment[];
  timestamp?: string;
  type?:      string;
}

/** Żywe karty Kroniki — wykuwane przez /api/kronika/forge (Gemma4 + agenci). */
export const kronikaEntriesAtom = atomWithStorage<KronikaEntry[]>('kronika_entries', []);

export const auraStatsAtom = atom<AuraStats>((get) => {
  const stats: AuraStats = { gold: 0, cyan: 0, violet: 0 };
  get(kronikaHistoryAtom).forEach(c => {
    const aura = c.mission?.aura;
    if (aura === 'gold' || aura === 'cyan' || aura === 'violet') {
      stats[aura]++;
    }
  });
  return stats;
});
