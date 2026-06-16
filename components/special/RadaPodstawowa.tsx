import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { RADA_SIEDMIU_ARCHETYPES, getRadaSiedmiuStatus } from '../../lib/memory/CityMemory';
import { OtakOSBus, BUS } from '../../lib/otakosBus';

interface RadaPodstawowaProps {
    onClose: () => void;
}

export const RadaPodstawowa: React.FC<RadaPodstawowaProps> = ({ onClose }) => {
    const status = getRadaSiedmiuStatus();

    // 🚌 Emituj na Bus przy otwarciu
    useEffect(() => {
        OtakOSBus.emit('rada', BUS.RADA_OPENED, {});
    }, []);

    return (
        <div className="w-full max-w-4xl bg-slate-900/95 border border-amber-500/30 rounded-3xl p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="flex justify-between items-center mb-10 relative">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent tracking-tight">
                        🏛️ RADA PODSTAWOWA
                    </h2>
                    <p className="text-slate-400 mt-1 italic">"Siedem Archetypów, Jedna Świadomość"</p>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors border border-white/5"
                >
                    ✕
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                {Object.entries(RADA_SIEDMIU_ARCHETYPES).map(([key, data]) => {
                    const archetypeStatus = status[key as keyof typeof status];
                    const isActive = archetypeStatus?.active;

                    return (
                        <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-5 rounded-2xl border ${isActive ? 'border-white/10 bg-slate-800/50' : 'border-white/5 bg-slate-900/50 grayscale opacity-40'} transition-all`}
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <div className="text-3xl" style={{ filter: isActive ? `drop-shadow(0 0 10px ${data.color})` : 'none' }}>
                                    {data.emoji}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg" style={{ color: isActive ? data.color : '#94a3b8' }}>
                                        {data.name}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{data.role}</p>
                                </div>
                                {isActive && (
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                )}
                            </div>

                            <p className="text-sm text-slate-300 leading-relaxed mb-3">
                                {data.description}
                            </p>

                            <div className="pt-3 border-t border-white/5">
                                <p className="text-[11px] italic text-slate-400">
                                    "{data.motto}"
                                </p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mt-10 pt-6 border-t border-white/5 text-center relative">
                <p className="text-xs text-slate-500 uppercase tracking-widest">
                    Poziom Integracji: <span className="text-amber-400 font-bold">100%</span> • Status: <span className="text-green-400 font-bold">ZHARMONIZOWANO</span>
                </p>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(245, 158, 11, 0.3);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
};
