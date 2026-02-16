

import React from 'react';
import { useAtomValue } from 'jotai';
import { CosmicVenture } from '../../types';
import { resonanceColorAtom, RESONANCE_THEMES } from '../../store/personalization';
import { cn } from '../../lib/helpers';
import { walletAtom } from '../../store/wallet';
import { LockClosedIcon } from '../icons';

interface VentureCardProps {
    venture: CosmicVenture;
    onSelect: (venture: CosmicVenture) => void;
}

export const VentureCard: React.FC<VentureCardProps> = ({ venture, onSelect }) => {
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const wallet = useAtomValue(walletAtom);
    const theme = RESONANCE_THEMES[resonanceColor];
    const progressPercentage = (venture.currentGRV / venture.goalGRV) * 100;

    const tierLevels = { 'Low': 0, 'Medium': 1, 'High': 2, 'Superposition': 3 };
    const userTierLevel = tierLevels[wallet.frequencyTier];
    const requiredTierLevel = venture.requiredFrequencyTier ? tierLevels[venture.requiredFrequencyTier] : 0;
    const isLocked = userTierLevel < requiredTierLevel;


    return (
        <div className="bg-slate-900/40 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-4 flex flex-col h-full overflow-hidden shadow-lg hover:shadow-cyan-500/20 hover:-translate-y-1 transition-all duration-300">
            <div className="relative group cursor-pointer" onClick={() => onSelect(venture)}>
                <img src={venture.imageUrl} alt={venture.name} className="w-full h-40 object-cover rounded-lg mb-4" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-lg mb-4">
                    <p className="text-white font-bold tracking-wider border-2 border-white rounded-full px-4 py-2">View Details</p>
                </div>
                {venture.requiredFrequencyTier && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/50 text-xs text-white px-2 py-1 rounded-full backdrop-blur-sm">
                        <div className="w-3 h-3"><LockClosedIcon /></div>
                        <span>Requires {venture.requiredFrequencyTier} Tier</span>
                    </div>
                )}
            </div>
            <div className="flex flex-col flex-grow">
                <h4 className="text-xl font-bold text-white mb-2">{venture.name}</h4>
                <p className="text-slate-400 text-sm mb-4 flex-grow">{venture.description}</p>

                <div className="mb-4">
                    <div className="flex justify-between items-end mb-1 text-sm">
                        <span className="text-slate-300 font-semibold">{venture.currentGRV.toLocaleString()} / {venture.goalGRV.toLocaleString()} GRV</span>
                        <span className={cn("font-bold", theme.tw.text)}>{progressPercentage.toFixed(2)}%</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                        <div
                            className={cn("h-2.5 rounded-full", theme.tw.bg)}
                            style={{ width: `${progressPercentage}%`, transition: 'width 0.5s ease-in-out' }}
                        ></div>
                    </div>
                </div>

                <button disabled={isLocked} className="capsule-button capsule-cyan w-full mt-auto">
                    Contribute GRAV
                </button>
            </div>
        </div>
    );
};