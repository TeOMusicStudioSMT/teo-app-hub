import React from 'react';
import { CameraIcon } from './icons';

interface VisualAssistantButtonProps {
    onClick: () => void;
}

export const VisualAssistantButton: React.FC<VisualAssistantButtonProps> = ({ onClick }) => {
    return (
        <div className="relative z-20 flex items-center justify-center group">
            <button
                onClick={onClick}
                className="w-16 h-16 p-4 rounded-full bg-slate-800/50 backdrop-blur-md text-lime-300 border border-lime-500/30 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_15px_rgba(163,230,53,0.5)]"
                aria-label="Activate Visual Assistant"
            >
               <CameraIcon />
            </button>
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-max max-w-xs px-4 py-2 bg-slate-800/60 text-white text-xs text-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none backdrop-blur-md border border-lime-500/30 shadow-lg z-30">
                Activate NAP's Vision. Use your camera to create and edit images with AI.
            </div>
        </div>
    );
}
