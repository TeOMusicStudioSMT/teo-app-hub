import { atom } from 'jotai';

export const visualizerLayoutAtom = atom({ left: 'STORYTELLER', right: 'GRAVITON_GRID' });
export const currentLyricAtom = atom<string>("");
export const isKaraokeEnabledAtom = atom<boolean>(false);
