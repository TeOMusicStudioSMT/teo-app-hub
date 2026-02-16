import { atom } from 'jotai';

export interface UserStats {
  totalStories: number;
  completedTales: number;
  readingTime: number; // in minutes
  magicPoints: number;
  favoriteStories: number;
}

const initialStats: UserStats = {
  totalStories: 7,
  completedTales: 4,
  readingTime: 248, 
  magicPoints: 1337,
  favoriteStories: 2,
};

export const userStatsAtom = atom<UserStats>(initialStats);
