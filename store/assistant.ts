import { atom, PrimitiveAtom } from 'jotai';

export type AssistantStatus = 'idle' | 'listening' | 'speaking' | 'thinking';

export interface AssistantMessage {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

interface AssistantState {
    status: AssistantStatus;
    transcript: string;
    response: string;
    conversationHistory: AssistantMessage[];
}

export const assistantStateAtom = atom<AssistantState>({
    status: 'idle',
    transcript: '',
    response: '',
    conversationHistory: [],
});

export const generatedImageAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

export interface BalanceModeState {
    isActive: boolean;
    timerVisible: boolean;
    countdown: number;
}

export const balanceModeAtom: PrimitiveAtom<BalanceModeState> = atom<BalanceModeState>({
    isActive: false,
    timerVisible: false,
    countdown: 17,
});