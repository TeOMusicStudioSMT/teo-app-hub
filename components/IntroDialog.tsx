import React from 'react';

interface IntroDialogProps {
    isVisible: boolean;
    onStart: () => void;
}

const IntroDialog: React.FC<IntroDialogProps> = ({ isVisible, onStart }) => {
    const animationClass = isVisible ? 'animate-[fade-in_1s_ease-out_forwards]' : 'animate-[fade-out_0.5s_ease-in_forwards]';

    if (!isVisible && animationClass.includes('fade-out')) {
         // A bit of a trick to keep the component mounted during fade-out
         setTimeout(() => {}, 500);
    }

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`bg-slate-900/60 border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-500/10 p-8 max-w-lg text-center ${animationClass} opacity-0 backdrop-blur-lg`}>
                <h2 className="text-3xl font-bold text-cyan-300 drop-shadow-[0_0_5px_rgba(0,255,255,0.7)] mb-4">
                    TeO Hub: Online
                </h2>
                <p className="text-slate-300 mb-2">Welcome to the TeO Hub. <strong className="text-white">All systems synced with GRAVITON mainnet.</strong></p>
                <p className="text-slate-400 mb-6">Your gateway to the TeO ecosystem is fully operational.</p>
                <button
                    onClick={onStart}
                    className="capsule-button capsule-cyan text-lg py-3 px-8"
                >
                    Enter Hub
                </button>
            </div>
        </div>
    );
};

export default IntroDialog;