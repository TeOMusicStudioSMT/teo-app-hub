
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils'
import { QuizProgress } from '../types';

export const EDUCATION_PROGRESS_STORAGE_KEY = 'teo_education_progress';
export const QUIZ_DUE_DATES_STORAGE_KEY = 'teo_quiz_due_dates';
export const QUIZ_PRIORITIES_STORAGE_KEY = 'teo_quiz_priorities';

// atomWithStorage will automatically persist the quiz progress to localStorage.
// It's initialized with an empty object if no saved state is found.
export const quizProgressAtom = atomWithStorage<QuizProgress>(EDUCATION_PROGRESS_STORAGE_KEY, {});

// Atom to store user-defined due dates for quizzes.
export const quizDueDatesAtom = atomWithStorage<{[quizId: string]: string}>(QUIZ_DUE_DATES_STORAGE_KEY, {});

// Atom to store user-defined priorities for quizzes
export type Priority = 'low' | 'medium' | 'high';
export const quizPrioritiesAtom = atomWithStorage<{[quizId: string]: Priority}>(QUIZ_PRIORITIES_STORAGE_KEY, {});


// A derived atom that provides a simple array of completed quiz IDs.
export const completedQuizzesAtom = atom((get) => {
    const progress = get(quizProgressAtom);
    return Object.keys(progress).filter(quizId => progress[quizId]?.completed);
});