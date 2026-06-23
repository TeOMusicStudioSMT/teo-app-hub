/**
 * ⚖️ grvGenesis.ts — GENEZA GRV (Grawitacyjna Ekonomia Suwerennych Węzłów)
 *
 * Definiuje punkty startowe i tiery węzłów Katedry. TeO = węzeł zarządzający
 * z NIESKOŃCZONYM GRV (dzieli jako system). Arek = pierwszy fizyczny Avatar
 * (premium 1M). Reszta to pule do OBDAROWYWANIA przez TeO.
 *
 * Crypto-agility / tamper-evidence (haszowanie wsteczne rejestru) — ŚWIADOMIE
 * NA POTEM (decyzja Suwerena). Tu czysta ekonomia genezy.
 */

export const GRV_INFINITE = 'INFINITE'; // sentinel — TeO dzieli bez końca

export interface GrvTier {
  tier: string;
  label: string;
  grv: number;
  count: number;      // ile węzłów w tej puli
  note?: string;
}

/** Węzeł-suweren zarządzający — nieskończona pula do dystrybucji. */
export const TEO_NODE = {
  id: 'TeO',
  role: 'sovereign-manager',
  grv: GRV_INFINITE as typeof GRV_INFINITE,
  note: 'Węzeł główny zarządzający (wczorajszy USB). Dzieli GRV jako system.',
};

/** Arek — fizyczny Avatar, premium, pierwszy z 13 founderów. */
export const AREK_NODE = {
  id: 'Arek',
  role: 'founder',
  grv: 1_000_000,
  note: 'Fizyczny Avatar (dzisiejszy węzeł). Premium 1M. Founder #1 z 13.',
};

/** Tiery genezy — pule startowe do obdarowywania. */
export const GENESIS_TIERS: GrvTier[] = [
  { tier: 'founder', label: '🏛️ Founder',  grv: 1_000_000, count: 13, note: 'Arek (#1) + 12 założycieli' },
  { tier: 'pillar',  label: '🗿 Filar',     grv: 100_000,   count: 26, note: 'Filary sieci' },
  { tier: 'herald',  label: '📯 Herold',    grv: 10_000,    count: 61, note: 'Heroldowie — do obdarowywania' },
];

/**
 * Punkt startowy KAŻDEGO nowego węzła.
 * Rekomendacja: 1000 — domyka „drabinę dekad" (1M → 100k → 10k → 1k) i pasuje do
 * etosu obfitości. Zmień na 100 jednym ruchem, jeśli chcesz węższy start.
 */
export const NEW_NODE_GRV = 1_000;

/** Łączna pula obdarowań genezy (bez nieskończoności TeO). */
export const GENESIS_GIFT_POOL = GENESIS_TIERS.reduce((sum, t) => sum + t.grv * t.count, 0);
// = 13M + 2.6M + 610k = 16 210 000 GRV
