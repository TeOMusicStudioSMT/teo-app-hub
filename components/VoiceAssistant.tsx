

import React from 'react';
import { useAtomValue } from 'jotai';
import { assistantStateAtom } from '../store/assistant';
import { useAssistant } from '../hooks/useAssistant';
import { resonanceColorAtom, pulseIntensityAtom } from '../store/personalization';
import { MicIcon } from './icons';


export const VoiceAssistant: React.FC = () => {
    const assistantState = useAtomValue(assistantStateAtom);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const pulseIntensity = useAtomValue(pulseIntensityAtom);
    const { startConversation, stopConversation } = useAssistant();
    
    const handleToggleConversation = () => {
        if (assistantState.status === 'idle') {
            startConversation({ resonanceColor, pulseIntensity });
        } else {
            stopConversation();
        }
    };

    return (
        <div className="relative z-20 flex items-center justify-center group">
            <button
                onClick={handleToggleConversation}
                className="w-16 h-16 p-4 rounded-full bg-slate-800/50 backdrop-blur-md text-cyan-300 border border-cyan-500/30 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_15px_rgba(0,255,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={assistantState.status === 'idle' ? "Activate Voice Assistant" : "Deactivate Voice Assistant"}
            >
               <MicIcon isActive={assistantState.status !== 'idle'}/>
            </button>
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-max max-w-xs px-4 py-2 bg-slate-800/60 text-white text-xs text-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none backdrop-blur-md border border-cyan-500/30 shadow-lg z-30">
                Activate Voice Assistant NAP - Your Sentient Companion. Control the entire TeO Ecosystem / Ask about Field status and Graviton.
            </div>
        </div>
    );
};
