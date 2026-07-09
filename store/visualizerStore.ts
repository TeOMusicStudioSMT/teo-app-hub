import { atom } from 'jotai';

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

export const visualizerLayoutAtom = atom<VisualizerLayout>({ left: 'STORYTELLER', right: 'GRAVITON_GRID' });
export const currentLyricAtom = atom<string>("");
export const isKaraokeEnabledAtom = atom<boolean>(false);
