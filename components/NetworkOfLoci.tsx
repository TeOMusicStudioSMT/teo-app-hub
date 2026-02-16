
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { useEssenceIdentity } from '../hooks/useEssenceIdentity';
import { DigitalSelfAvatar } from './identity/DigitalSelfAvatar';
import { ShieldCheckIcon, LockClosedIcon } from './icons';
import toast from 'react-hot-toast';
import { cn } from '../lib/helpers';

// --- Mock Graviton Data ---
const LOCI_DATA = [
    {
        id: "genesis_001",
        name: "Aethelgard's Echo",
        type: "RPG World Genesis",
        source: "TeO Story Studio",
        hash: "0x7f3a...9b12",
        integrity: "100% PoBI Verified",
        resonance: "High-Volatile",
        color: "lime",
        icon: "🐉"
    },
    {
        id: "asset_002",
        name: "Genesis Music Key",
        type: "Audio Access",
        source: "TeO Music",
        hash: "0x8b2c...11ff",
        integrity: "100% Secured",
        resonance: "Harmonic",
        color: "cyan",
        icon: "🎵"
    },
    {
        id: "asset_003",
        name: "Orbital Deed #404",
        type: "Land Ownership",
        source: "TeO Market",
        hash: "0xa1d4...88ee",
        integrity: "Verifying...",
        resonance: "Stable",
        color: "amber",
        icon: "🪐"
    }
];

const colorMap: Record<string, string> = {
    lime: 'text-lime-400 border-lime-500 shadow-lime-500/30 bg-lime-500/10',
    cyan: 'text-cyan-400 border-cyan-500 shadow-cyan-500/30 bg-cyan-500/10',
    amber: 'text-amber-400 border-amber-500 shadow-amber-500/30 bg-amber-500/10',
};

export const NetworkOfLoci: React.FC = () => {
    const [selectedLocus, setSelectedLocus] = useState<typeof LOCI_DATA[0] | null>(null);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];
    const { identity } = useEssenceIdentity();

    const handleIncarnate = (e: React.MouseEvent) => {
        e.stopPropagation();
        toast('Waiting for Neural Link initialization...', {
            icon: '🧠',
            style: {
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #a855f7'
            }
        });
    };

    return (
        <div className="w-full mb-8 relative">
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-cyan-300 drop-shadow-[0_0_4px_rgba(0,255,255,0.5)]">
                    Network of Loci <span className="text-sm font-normal text-slate-400 ml-2">/ Graviton Sync Active</span>
                </h2>
                <div className="flex items-center gap-2 text-xs font-mono text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-500/30">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    LIVE
                </div>
            </div>

            <div className="relative h-[400px] w-full bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden flex items-center justify-center shadow-2xl shadow-black/50">
                
                {/* Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(56,189,248,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(56,189,248,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
                
                {/* Connecting Lines (SVG Layer) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={theme.hex} stopOpacity="0" />
                            <stop offset="50%" stopColor={theme.hex} stopOpacity="0.5" />
                            <stop offset="100%" stopColor={theme.hex} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {LOCI_DATA.map((locus, index) => {
                        // Simple static positioning logic for lines based on known render positions
                        // In a real app, we'd calculate these based on container width
                        const angle = (index / LOCI_DATA.length) * Math.PI * 2 - (Math.PI / 2);
                        const radius = 140; 
                        // Assuming center is 50%, 50%
                        const x2 = 50 + (Math.cos(angle) * (radius / 4)); // Approximation for SVG % coordinates
                        const y2 = 50 + (Math.sin(angle) * (radius / 4)); // Approximation
                        
                        return (
                            <motion.line
                                key={`line-${locus.id}`}
                                x1="50%" y1="50%"
                                x2={`${50 + Math.cos(angle) * 35}%`}
                                y2={`${50 + Math.sin(angle) * 35}%`} // Adjust multiplier for responsiveness
                                stroke={`url(#line-gradient)`}
                                strokeWidth="1.5"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: [0.2, 0.6, 0.2] }}
                                transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
                            />
                        );
                    })}
                </svg>

                {/* Central Essence (User) */}
                <motion.div 
                    className="absolute z-20 cursor-default"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className={cn("relative rounded-full p-4 bg-slate-900 border border-slate-600 shadow-[0_0_30px_rgba(0,0,0,0.8)]", theme.tw.shadow)}>
                        <DigitalSelfAvatar form={identity?.avatarForm || 'humanoid'} color={theme.hex} sizeClass="w-16 h-16" />
                         <div className={cn("absolute inset-0 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite] opacity-30", theme.tw.border)} />
                    </div>
                </motion.div>

                {/* Satellites (Loci) */}
                {LOCI_DATA.map((locus, index) => {
                    const angle = (index / LOCI_DATA.length) * Math.PI * 2 - (Math.PI / 2);
                    const radius = 140; // Distance from center in px
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const style = colorMap[locus.color];

                    return (
                        <motion.div
                            key={locus.id}
                            className={cn(
                                "absolute z-30 w-12 h-12 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-300",
                                style,
                                selectedLocus?.id === locus.id ? 'scale-125 bg-opacity-30 z-40 ring-2 ring-white/50' : 'hover:scale-110'
                            )}
                            style={{ x, y }}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 + (index * 0.1), type: 'spring' }}
                            onClick={() => setSelectedLocus(locus)}
                            whileHover={{ y: y - 5 }} // Float up slightly
                        >
                            <span className="text-xl filter drop-shadow-lg">{locus.icon}</span>
                            {/* Pulse ring */}
                            <div className={cn("absolute inset-0 rounded-full animate-ping opacity-20", style.split(' ')[1])} />
                        </motion.div>
                    );
                })}

                {/* Details Hologram (Tooltip) */}
                <AnimatePresence>
                    {selectedLocus && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-4 right-4 z-50 w-72 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 shadow-2xl"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className={`font-bold text-lg ${colorMap[selectedLocus.color].split(' ')[0]}`}>
                                    {selectedLocus.name}
                                </h3>
                                <button onClick={(e) => { e.stopPropagation(); setSelectedLocus(null); }} className="text-slate-500 hover:text-white">
                                    &times;
                                </button>
                            </div>
                            
                            <div className="space-y-2 text-sm text-slate-300 mb-4">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Type</span>
                                    <span>{selectedLocus.type}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Source</span>
                                    <span>{selectedLocus.source}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Resonance</span>
                                    <span className="text-amber-300">{selectedLocus.resonance}</span>
                                </div>
                                <div className="bg-black/30 p-2 rounded font-mono text-xs text-slate-500 break-all border border-slate-700">
                                    HASH: {selectedLocus.hash}
                                </div>
                                <div className="flex items-center gap-1 text-green-400 text-xs mt-1">
                                    <ShieldCheckIcon /> {selectedLocus.integrity}
                                </div>
                            </div>

                            <button 
                                onClick={handleIncarnate}
                                className="w-full capsule-button capsule-violet flex items-center justify-center gap-2 text-sm py-2"
                            >
                                <LockClosedIcon /> Incarnate Asset
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};
