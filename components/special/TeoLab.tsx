/**
 * 🧪 TeoLab — Warsztat OtakOS: Symulatory & Pipeline'y
 *
 * Kontener-hub na narzędzia eksperymentalne Katedry. Zakładki:
 *   🌾 Agro-Robotics Simulator (SimulatorMap)
 *   🎛️ RadioSMT Pipeline (JasonFlowBridge)
 *
 * Rozszerzalny — kolejne symulatory/pipeline'y dorzucamy jako nowe zakładki,
 * bez zaśmiecania bocznego menu (jeden przycisk 🧪 zamiast wielu).
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import SimulatorMap from './SimulatorMap';
import { JasonFlowBridge } from './JasonFlowBridge';

type LabTab = 'agro' | 'radio';

const TABS: { key: LabTab; label: string }[] = [
    { key: 'agro',  label: '🌾 Agro-Robotics' },
    { key: 'radio', label: '🎛️ RadioSMT Pipeline' },
];

export const TeoLab: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [tab, setTab] = useState<LabTab>('agro');

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Pasek hubu */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-lime-300 to-emerald-400">🧪 TEO LAB</span>
                    <div className="flex gap-1.5">
                        {TABS.map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors border
                                    ${tab === t.key ? 'bg-lime-700/50 text-white border-lime-400/50' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-sm border border-slate-700 rounded-lg px-3 py-1">✕ Zamknij</button>
                )}
            </div>

            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                {tab === 'agro' && <SimulatorMap onClose={onClose} />}
                {tab === 'radio' && (
                    <div className="flex justify-center">
                        <JasonFlowBridge demoMode={true} onCreate={(p: unknown) => console.log('🎵 Pipeline:', p)} />
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default TeoLab;
