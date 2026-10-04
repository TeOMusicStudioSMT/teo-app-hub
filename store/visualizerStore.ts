import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export type VisualizerType =
  | 'PUSTKA'
  | 'STORYTELLER'
  | 'QUANTUM_EQUALIZER'
  | 'GRAVITON_GRID'
  | 'MATRIX_RAIN'
  | 'PULS';

export interface VisualizerLayout {
  left: VisualizerType;
  right: VisualizerType;
}

// Domyślnie PUSTO (Suweren 2026-10-04): skórki boczne (Storyteller + Graviton Grid) animują się bez przerwy —
// Katedra zostawiona sama z ramkami rosła do ~1,7 GB w przeglądarce, cięła i budziła panikę Mechanika.
// Wybór ze Scenografii jest zapamiętany na tym urządzeniu (localStorage `otakos_scenografia`).
export const DOMYSLNY_UKLAD: VisualizerLayout = { left: 'PUSTKA', right: 'PUSTKA' };
export const visualizerLayoutAtom = atomWithStorage<VisualizerLayout>('otakos_scenografia', DOMYSLNY_UKLAD, undefined, { getOnInit: true });
export const currentLyricAtom = atom<string>("");
export const isKaraokeEnabledAtom = atom<boolean>(false);
