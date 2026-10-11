/**
 * 🫀 Koherencja Katedry w Hubie — `GET /api/koherencja` (services/KoherencjaKatedry.js) co minutę.
 * Pasek na głównej (dawniej „INTEGRACJA” z licznika odpuszczania) i zakładka 🫀 w TeO-Sim czytają to samo.
 */
import { useEffect, useState } from 'react';

export interface Sprawdzenie { id: string; nazwa: string; ok: boolean; waga: number; opis: string; rada: string | null; opcjonalne?: boolean }
export interface Koherencja { procent: number; braki: number; sprawdzenia: Sprawdzenie[]; kiedy: string }

const MOST = 'http://127.0.0.1:3001';
export const ZDARZENIE_TEOSIM = 'otakos:otworz-teosim';

export async function pobierzKoherencje(): Promise<Koherencja | null> {
  try {
    const r = await fetch(`${MOST}/api/koherencja`, { signal: AbortSignal.timeout(20000) });
    const d = await r.json();
    return d?.success ? (d as Koherencja) : null;
  } catch { return null; }
}

/** Koherencja odświeżana co `coMs` (domyślnie minutę); null = most milczy. */
export function useKoherencja(coMs = 60_000): Koherencja | null {
  const [k, setK] = useState<Koherencja | null>(null);
  useEffect(() => {
    let zyje = true;
    const krok = () => void pobierzKoherencje().then((x) => { if (zyje) setK(x); });
    krok();
    const t = setInterval(krok, coMs);
    return () => { zyje = false; clearInterval(t); };
  }, [coMs]);
  return k;
}

/** Otwórz TeO-Sim na zakładce (np. 'koherencja', 'mozg'). */
export function otworzTeoSim(zakladka: string): void { try { window.dispatchEvent(new CustomEvent(ZDARZENIE_TEOSIM, { detail: zakladka })); } catch { /* SSR */ } }
