import React, { useEffect, useState } from 'react';
import DashboardCard from '../DashboardCard';
import { ClockIcon } from '../icons';
import { getManifestHistory, ManifestEntry } from '../../services/manifestHistoryService';
import { motion, AnimatePresence } from 'framer-motion';

export const ManifestHistoryCard = () => {
    const [history, setHistory] = useState<ManifestEntry[]>([]);

    useEffect(() => {
        setHistory(getManifestHistory());
        const handleStorage = () => setHistory(getManifestHistory());
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return (
        <DashboardCard title="Chronicles of Manifestation" icon={<ClockIcon />}>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                    {history.map((entry) => (
                        <motion.div key={entry.timestamp} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="p-3 bg-white/5 border border-white/5 rounded-xl"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-cyan-400 font-bold text-sm">{entry.word}</span>
                                <span className="text-[9px] text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {entry.proposals.map((p, i) => (
                                    <span key={i} className="text-[9px] text-slate-400 italic"># {p}</span>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </DashboardCard>
    );
};