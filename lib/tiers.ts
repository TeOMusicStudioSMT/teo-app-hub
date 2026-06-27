/**
 * 🏛️ tiers — FILARY: 3-poziomowy system dostępu / gra Odkrywania.
 *
 * Filar I — Poznawczy („Iskra", 1000 GRV): rozmowy, słuchanie własnej muzyki,
 *           zbieranie danych sonicznych, dziennik, lustro.
 * Filar II — Twórczy („Rezonator", 10 000 GRV): + kreacja muzyki i wideo.
 * Filar III — Mistrzowski („Mistrz/Ascendent", 26 founderów ×1M): pełny TeODash,
 *           wszystko, ascendencja (poziom ostateczny).
 *
 * Cel: progresywne odkrywanie modułów — gra uczy Suwerena obsługi Katedry.
 */

export type TierId = 'poznawczy' | 'tworczy' | 'mistrzowski';

export interface Tier {
  id: TierId;
  pillar: 1 | 2 | 3;
  name: { pl: string; en: string };   // godło filaru
  title: { pl: string; en: string };  // tytuł nosiciela
  grvMin: number;
  color: string;
  desc: { pl: string; en: string };
}

export const TIERS: Tier[] = [
  {
    id: 'poznawczy', pillar: 1, grvMin: 1000, color: '#22d3ee',
    name: { pl: 'Filar I — Poznawczy', en: 'Pillar I — Cognitive' },
    title: { pl: 'Iskra', en: 'Spark' },
    desc: { pl: 'Rozmowy, słuchanie własnej muzyki, zbiór danych sonicznych.', en: 'Talk, listen to your music, collect sonic data.' },
  },
  {
    id: 'tworczy', pillar: 2, grvMin: 10000, color: '#a855f7',
    name: { pl: 'Filar II — Twórczy', en: 'Pillar II — Creative' },
    title: { pl: 'Rezonator', en: 'Resonator' },
    desc: { pl: 'Kreacja muzyki i wideo z zebranych wektorów.', en: 'Create music and video from gathered vectors.' },
  },
  {
    id: 'mistrzowski', pillar: 3, grvMin: 1000000, color: '#fbbf24',
    name: { pl: 'Filar III — Mistrzowski', en: 'Pillar III — Master' },
    title: { pl: 'Mistrz / Ascendent', en: 'Master / Ascendant' },
    desc: { pl: 'Pełny TeODash, wszystkie moduły, ascendencja.', en: 'Full TeODash, all modules, ascension.' },
  },
];

/** Moduł → minimalny filar wymagany. Nieznane = 1 (otwarte, by nie blokować nowości). */
export const MODULE_PILLAR: Record<string, 1 | 2 | 3> = {
  // Filar I — Poznawczy
  chat: 1, radio: 1, dziennik: 1, lustro: 1, sonic: 1, mapa: 1,
  // Filar II — Twórczy (kreacja)
  story: 2, studio: 2, mockup: 2, teledysk: 2, forge: 2, market: 2, wydawnictwo: 2, widok: 2,
  // Filar III — Mistrzowski (pełnia)
  crew: 3, narada: 3, terminal: 3, archiwum: 3, klaudiusz: 3, autobus: 3, rafineria: 3, inkubator: 3, graviton: 3,

  // ── Dashboard / Lounge (górna nawigacja) ──
  dashboard: 1, projects: 1, identity: 1, profile: 1, academy: 1, trust: 1, pralka: 1, kompas: 1, // Filar I — dla wszystkich (trust=start, pralka=sumienie, kompas=mapa gry)
  'teo-market': 2, 'field-control': 2, cobots: 2, teolab: 2, robotics: 2, kancelaria: 2, gameforge: 2, // Filar II — środkowy (kreacja, TeO Lab, Robotics, Kancelaria, Game Forge)
  'crew-club': 3, 'graviton-wallet': 3,                                   // Filar III — mistrzowski
};

const TIER_KEY = 'otakos_tier';

/** Aktualny filar. Domyślnie Mistrzowski (właściciel = Suweren na swojej maszynie). */
export function currentTier(): Tier {
  let id: TierId = 'mistrzowski';
  try { const s = localStorage.getItem(TIER_KEY) as TierId | null; if (s && TIERS.find(t => t.id === s)) id = s; } catch { /* noop */ }
  return TIERS.find(t => t.id === id)!;
}

export function setTier(id: TierId): void {
  try { localStorage.setItem(TIER_KEY, id); } catch { /* noop */ }
}

/** Filar wynikający z salda GRV (dla zdalnych węzłów). */
export function tierByGrv(grv: number): Tier {
  const sorted = [...TIERS].sort((a, b) => b.grvMin - a.grvMin);
  return sorted.find(t => grv >= t.grvMin) ?? TIERS[0];
}

/** Czy dany filar ma dostęp do modułu. */
export function canAccess(moduleId: string, tier: Tier = currentTier()): boolean {
  const need = MODULE_PILLAR[moduleId] ?? 1;
  return tier.pillar >= need;
}

/** Minimalny filar dla modułu (do podpowiedzi „odblokuj na Filarze N"). */
export function requiredPillar(moduleId: string): 1 | 2 | 3 {
  return MODULE_PILLAR[moduleId] ?? 1;
}
