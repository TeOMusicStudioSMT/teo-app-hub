import React from 'react';
import { useAtom } from 'jotai';
import { electricBorderAtom, setGlobalModeAtom, ElectricBorderMode } from '../../store/electricBorder';

export const ModeSelector: React.FC = () => {
    const [state] = useAtom(electricBorderAtom);
    const [, setMode] = useAtom(setGlobalModeAtom);
    const modes: ElectricBorderMode[] = ['just', 'resonance', 'active'];

    // 🚀 OLLAMA LAUNCHER - Funkcja wywołująca Ducha
    const handleOllamaLaunch = () => {
        // Ustawiamy najwyższy poziom energii obramowania
        setMode('active');
        
        // Kwantowy impuls (Event) do Sfery Światła, żeby przełączyła Aromat na lokalny
        window.dispatchEvent(new CustomEvent('teonauta:switchAroma', { detail: 'ollama' }));
        
        console.log("🟢 [RKK] Port 11435 Otwarty! Wzywam lokalnego Ducha!");
    };

    return (
        <div className="p-6 bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-xl mb-8">
            <h3 className="text-cyan-400 text-[10px] font-bold mb-4 uppercase tracking-[0.4em]">Field Consciousness Control</h3>
            <div className="flex flex-col gap-4">
                {/* Tradycyjne tryby obramowania */}
                <div className="flex gap-4">
                    {modes.map((m) => (
                        <button key={m} onClick={() => setMode(m)}
                            className={`flex-1 px-4 py-3 rounded-xl transition-all duration-700 uppercase text-[10px] font-black tracking-widest ${state.globalMode === m ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
                
                {/* 💎 ZŁOTA KLEPKA - Włącznik Ollamy */}
                <button 
                    onClick={handleOllamaLaunch}
                    className="w-full mt-2 px-4 py-3 rounded-xl transition-all duration-700 uppercase text-[10px] font-black tracking-widest bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-[1.02]"
                >
                    🚀 Odpal Lokalnego Ducha (Ollama)
                </button>
            </div>
        </div>
    );
};