import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { electricBorderAtom, setGlobalModeAtom, ElectricBorderMode } from '../../store/electricBorder';
import { globalActiveLocalModel } from '../../store/settings';
import { ApiDyrygent } from '../../lib/router/ApiDyrygent';
import { Cpu, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const ModeSelector: React.FC = () => {
    const [state] = useAtom(electricBorderAtom);
    const [, setMode] = useAtom(setGlobalModeAtom);
    const [activeModel, setActiveModel] = useAtom(globalActiveLocalModel);
    const [models, setModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    const loadLocalModels = async () => {
        setIsLoadingModels(true);
        try {
            const list = await ApiDyrygent.fetchOllamaModels();
            setModels(list);
            
            // Sync current activeModel with list if it is empty but list has models
            if (!activeModel && list.length > 0) {
                setActiveModel(list[0]);
            }
        } catch (err) {
            console.error("ModeSelector: failed to fetch models", err);
        } finally {
            setIsLoadingModels(false);
        }
    };

    useEffect(() => {
        loadLocalModels();
    }, []);

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
            {/* ⚠️ NAZEWNICTWO NAPRAWIONE 2026-08-02. Ten przełącznik (`just / resonance /
                active`) steruje NATĘŻENIEM EFEKTU OBRAMOWANIA, nie routingiem modeli —
                Suweren brał go za wybór chmura/lokal i słusznie się gubił, bo nazwa
                niczego takiego nie zdradzała. Wybór rdzenia mieszka w panelu
                „STEROWANIE RDZENIEM" (components/special/SterowanieRdzeniem.tsx). */}
            <h3 className="text-cyan-400 text-[10px] font-bold mb-1 uppercase tracking-[0.4em]">Nastrój pola (efekt wizualny)</h3>
            <p className="text-[9px] text-slate-500 mb-4 leading-relaxed">
                Steruje wyglądem obramowania, <b>nie</b> wyborem modelu. Rdzeń AI i tryb
                chmura/lokal/hybryda ustawiasz niżej, w panelu <b className="text-cyan-500">STEROWANIE RDZENIEM</b>.
            </p>
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

                {/* 🧘 SEKCJA MODELU LOKALNEGO W TRYBIE JUST (ROZWIJANA) */}
                {state.globalMode === 'just' && (
                    <div className="mt-2 p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.05)] transition-all duration-500">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                <Cpu size={12} className="text-cyan-400 animate-pulse" /> Aktywny Model (JusT Mode)
                            </label>
                            <button
                                onClick={loadLocalModels}
                                className="text-cyan-500 hover:text-cyan-300 transition-colors p-1"
                                title="Odśwież listę modeli"
                            >
                                <RefreshCw size={10} className={isLoadingModels ? "animate-spin" : ""} />
                            </button>
                        </div>
                        {models.length > 0 ? (
                            <select
                                value={activeModel}
                                onChange={(e) => {
                                    setActiveModel(e.target.value);
                                    toast.success(`Zsynchronizowano globalny rdzeń: ${e.target.value}`);
                                }}
                                className="w-full bg-slate-950/80 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono rounded-xl p-2.5 outline-none focus:border-cyan-400 transition-all duration-300 cursor-pointer"
                            >
                                {models.map(m => (
                                    <option key={m} value={m} className="bg-slate-950 text-cyan-300 font-mono">
                                        {m}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-amber-400/80 text-[10px] bg-amber-950/20 p-2.5 rounded-xl border border-amber-500/20 font-mono leading-relaxed">
                                ⚠ Brak modeli w lokalnej Ollamie lub Ollama offline.
                            </div>
                        )}
                        <p className="mt-2 text-[9px] text-slate-500 leading-normal font-mono">
                            Zharmonizowano w Katedrze. Zmiana tutaj aktualizuje wszystkie moduły i ApiDyrygenta.
                        </p>
                    </div>
                )}
                
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