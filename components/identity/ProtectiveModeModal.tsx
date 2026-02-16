import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { protectiveModeAtom } from '../../store/identity';
import { useAegisClient } from '../../hooks/useAegisClient';
import toast from 'react-hot-toast';

const BREATH_DURATION_S = 15; // Shortened for demo purposes

export const ProtectiveModeModal: React.FC = () => {
    const [protectiveState, setProtectiveState] = useAtom(protectiveModeAtom);
    const [countdown, setCountdown] = useState(BREATH_DURATION_S);
    const [isResonating, setIsResonating] = useState(false);
    const api = useAegisClient();

    useEffect(() => {
        if (protectiveState.isOpen) {
            setIsResonating(true);
            setCountdown(BREATH_DURATION_S);
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setIsResonating(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [protectiveState.isOpen]);

    const handleConfirm = async () => {
        if (!protectiveState.reportId) return;
        const promise = api.confirmResonance({ reportId: protectiveState.reportId });
        toast.promise(promise, {
            loading: 'Confirming resonance...',
            success: (res) => res.message,
            error: 'Confirmation failed.',
        });

        try {
            await promise;
            if (protectiveState.onConfirm) {
                protectiveState.onConfirm();
            }
        } finally {
            handleClose();
        }
    };

    const handleClose = () => {
        setProtectiveState({ isOpen: false });
    };

    if (!protectiveState.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-[fade-in_0.5s]">
            <div className="bg-slate-900/60 border border-amber-500/20 backdrop-blur-lg rounded-3xl shadow-2xl shadow-amber-500/10 p-8 max-w-md w-full m-4 text-center">
                <h2 className="text-2xl font-bold text-amber-300 mb-2">Protective Mode</h2>
                <p className="text-slate-300 mb-6">AEGIS has detected unusual activity. Take a moment to ensure this action is intentional.</p>
                
                <div className="relative w-40 h-40 mx-auto my-8 flex items-center justify-center">
                    <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-[pulse_4s_ease-in-out_infinite]"></div>
                    <div 
                        className="w-16 h-16 bg-amber-400 rounded-full transition-transform duration-[4000ms] ease-in-out"
                        style={{ animation: isResonating ? `breathe ${BREATH_DURATION_S}s ease-in-out forwards` : 'none' }}
                    ></div>
                    <p className="absolute text-3xl font-mono text-white">{countdown > 0 ? countdown : '✔'}</p>
                </div>

                <p className="text-slate-400 mb-8 h-10">
                    {isResonating ? 'Follow the circle. Breathe in... and out...' : 'Your intention is clear. You may proceed.'}
                </p>
                
                <div className="flex justify-center items-center gap-4">
                    <button onClick={handleClose} className="text-slate-400 hover:text-white px-4 py-2">Cancel</button>
                    <button
                        onClick={handleConfirm}
                        disabled={isResonating}
                        className="capsule-button capsule-violet"
                    >
                        Confirm Transaction
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes breathe {
                    0% { transform: scale(1); }
                    50% { transform: scale(2); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
};