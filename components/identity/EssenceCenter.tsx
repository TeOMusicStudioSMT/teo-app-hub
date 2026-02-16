import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { isClaimUsernameModalOpenAtom } from '../../store/identity';
import { useEssenceIdentity } from '../../hooks/useEssenceIdentity';
import { DigitalSelfAvatar } from './DigitalSelfAvatar';
import { cn } from '../../lib/helpers';
import { resonanceColorAtom, RESONANCE_THEMES } from '../../store/personalization';

const coherenceConfig = {
    LOW: { text: 'Coherence: Stable', color: 'text-green-400', ring: 'ring-green-500/50' },
    MEDIUM: { text: 'Coherence: Fluctuating', color: 'text-amber-400', ring: 'ring-amber-500/50' },
    HIGH: { text: 'Coherence: Unstable', color: 'text-rose-400', ring: 'ring-rose-500/50' },
};

export const EssenceCenter: React.FC = () => {
    const { identity, isLoading } = useEssenceIdentity();
    const setClaimModalOpen = useSetAtom(isClaimUsernameModalOpenAtom);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    if (isLoading || !identity) {
        return <div className="w-24 h-24 border-2 border-cyan-500/50 border-t-cyan-300 rounded-full animate-spin" />;
    }

    const coherence = coherenceConfig[identity.coherence.riskLevel];

    return (
        <div className="flex flex-col items-center justify-center text-center gap-6 transition-opacity duration-500">
            
            {/* Orb Container / Energy Field Wrapper */}
            <div className="relative w-48 h-48 md:w-60 md:h-60 flex items-center justify-center">
                {/* Outer Rotating Field (Restored Orb Visuals) */}
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.4)] animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-2 rounded-full border border-purple-500/40 opacity-70 animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-900/20 to-purple-900/20 blur-xl animate-pulse" />

                {/* Avatar Core */}
                <div className="relative z-10">
                    <DigitalSelfAvatar
                        form={identity.avatarForm}
                        color={theme.hex}
                        sizeClass="w-32 h-32"
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                {identity.username ? (
                    <h1 className="text-3xl font-bold text-slate-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                        @{identity.username}
                    </h1>
                ) : (
                    <button
                        onClick={() => setClaimModalOpen(true)}
                        className="capsule-button capsule-cyan"
                    >
                        Claim Your Username
                    </button>
                )}

                <div className={cn("px-3 py-1 text-sm rounded-full bg-slate-900/50 ring-1 inline-block", coherence.ring, coherence.color)}>
                    {coherence.text}
                </div>
            </div>
        </div>
    );
};