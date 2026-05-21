/**
 * 🧰 WiesioCore.tsx - Terminal Kontroli Modeli i Narzędzi (Skills)
 * * Moduł odpowiedzialny za:
 * 1. Wykrywanie dostępnych modeli w lokalnej Ollamie (127.0.0.1:11434)
 * 2. Przełączanie aktywnego mózgu Katedry
 * 3. Zwijanie/rozwijanie panelu kontroli
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Server, RefreshCw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAtom } from 'jotai';
import { globalActiveLocalModel } from '../../store/settings';

// Definicja modelu z Ollamy
interface OllamaModel {
    name: string;
    size: number;
    details: {
        family: string;
        parameter_size: string;
    };
}

export const WiesioCore: React.FC = () => {
    // Stany dla Modeli
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [activeModel, setActiveModel] = useAtom(globalActiveLocalModel);
    const [isScanning, setIsScanning] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    // Stany dla pobierania modeli
    const [modelToDownload, setModelToDownload] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    // 1. Skanowanie lokalnej Ollamy w poszukiwaniu modeli
    const scanLocalModels = async () => {
        setIsScanning(true);
        try {
            const response = await fetch('http://127.0.0.1:11434/api/tags');
            if (!response.ok) throw new Error('Ollama nie odpowiada na porcie 11434');

            const data = await response.json();
            setModels(data.models || []);

            // Jeśli nie ma wybranego modelu w atomie lub nie ma go na liście pobranych, wybierz pierwszy
            if (activeModel && data.models.some((m: any) => m.name === activeModel)) {
                // zachowaj obecny model
            } else if (data.models.length > 0) {
                setActiveModel(data.models[0].name);
            }

            toast.success(`Wykryto ${data.models.length} modeli w lokalnej zbrojowni!`);
        } catch (error) {
            console.error(error);
            toast.error('Brak połączenia z Ollamą. Czy aplikacja działa w tle?');
        } finally {
            setIsScanning(false);
        }
    };

    // Uruchom przy montowaniu
    useEffect(() => {
        scanLocalModels();
    }, []);

    // Zmiana modelu
    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value;
        setActiveModel(newModel);
        toast.success(`Przełączono rdzeń na: ${newModel}`);
    };

    // Pobieranie nowego modelu z Ollamy
    const pullNewModel = async () => {
        if (!modelToDownload.trim()) return;
        setIsDownloading(true);
        toast(`⬇️ Zlecam pobranie: ${modelToDownload} do terminala...`, { icon: '⬇️' });
        
        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'PULL_MODEL',
                    modelName: modelToDownload.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message, { duration: 5000 });
                setModelToDownload('');
                // Odśwież listę modeli po chwili
                setTimeout(() => scanLocalModels(), 10000);
            } else {
                toast.error(`Błąd: ${data.error}`);
            }
        } catch (err) {
            toast.error('Brak łączności z Wiesławem.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="w-full bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(16,185,129,0.1)] font-mono mb-6 transition-all duration-500 hover:border-emerald-400/50">
            {/* Nagłówek zawsze widoczny */}
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-emerald-400 font-bold text-sm md:text-lg flex items-center gap-2 tracking-widest">
                        <Server size={20} className="text-emerald-400 animate-pulse" /> INFRASTRUKTURA WIESI
                    </h2>
                    
                    {/* Wskaźnik aktywnego modelu na nagłówku (gdy zminimalizowany) */}
                    {isCollapsed && (
                        <div className="hidden sm:flex items-center gap-2 bg-slate-950/60 border border-emerald-500/20 px-3 py-1 rounded-lg text-[10px] text-emerald-300">
                            <Cpu size={12} className="text-cyan-400" />
                            <span className="opacity-80">RDZEŃ:</span>
                            <span className="font-bold text-cyan-300">{activeModel || 'gemma4:e2b'}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Szybkie odświeżanie zawsze pod ręką */}
                    <button
                        onClick={scanLocalModels}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-cyan-400 border border-cyan-500/20 hover:border-cyan-400 hover:scale-105 transition-all duration-300"
                        title="Odśwież listę modeli"
                    >
                        <motion.div animate={{ rotate: isScanning ? 360 : 0 }} transition={{ repeat: isScanning ? Infinity : 0, duration: 1 }}>
                            <RefreshCw size={14} />
                        </motion.div>
                    </button>

                    {/* Przycisk zwijania/rozwijania */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 hover:border-emerald-400 hover:scale-105 transition-all duration-300"
                    >
                        {isCollapsed ? (
                            <>Rozwiń <ChevronDown size={14} /></>
                        ) : (
                            <>Zwiń <ChevronUp size={14} /></>
                        )}
                    </button>
                </div>
            </div>

            {/* Reaktywne szczegóły z animacją wysuwania */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5 pt-1">
                            {/* SEKCJA 1: RADAR OLLAMY */}
                            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 hover:border-cyan-500/30 transition-all duration-300">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs text-slate-400 font-bold tracking-wider flex items-center gap-2">
                                        <Cpu size={14} className="text-cyan-400" /> AKTYWNY RDZEŃ (LLM)
                                    </label>
                                </div>

                                {models.length > 0 ? (
                                    <select
                                        value={activeModel}
                                        onChange={handleModelChange}
                                        className="w-full bg-slate-900 border border-cyan-500/30 text-cyan-100 text-sm rounded-lg p-2.5 outline-none focus:border-cyan-400 transition-colors cursor-pointer font-mono"
                                    >
                                        {models.map(m => (
                                            <option key={m.name} value={m.name}>
                                                {m.name} ({(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="text-red-400 text-xs bg-red-900/20 p-2.5 rounded border border-red-500/20 font-mono">
                                        ⚠ Brak połączenia z Ollamą. Sprawdź, czy serwis działa na porcie 11434.
                                    </div>
                                )}
                                <div className="mt-2 text-[9px] text-slate-500 leading-normal">
                                    Ten model będzie używany przez wszystkich Agentów w Katedrze.
                                </div>
                            </div>

                            {/* SEKCJA 1B: POBIERANIE MODELI */}
                            <div className="bg-slate-950 rounded-xl p-4 border border-teal-500/20 hover:border-teal-500/30 transition-all duration-300">
                                <label className="text-xs text-teal-400 font-bold tracking-wider flex items-center gap-2 mb-3">
                                    <Download size={14} className="text-teal-400" /> POBIERANIE MODELU
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={modelToDownload}
                                        onChange={(e) => setModelToDownload(e.target.value)}
                                        placeholder="np. llama3, qwen2.5-coder:7b"
                                        className="flex-1 bg-slate-900 border border-teal-500/30 text-teal-100 text-xs rounded-lg p-2.5 outline-none focus:border-teal-400 placeholder:text-slate-600 font-mono"
                                        onKeyDown={(e) => e.key === 'Enter' && pullNewModel()}
                                    />
                                    <button
                                        onClick={pullNewModel}
                                        disabled={isDownloading || !modelToDownload.trim()}
                                        className="bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 text-xs font-bold px-4 py-2.5 rounded-lg border border-teal-500/30 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] transition-all duration-300"
                                    >
                                        {isDownloading ? '...' : '⬇️'}
                                    </button>
                                </div>
                                <div className="mt-2 text-[9px] text-slate-500 leading-normal">
                                    Wpisz nazwę modelu z Ollama. Pobieranie ruszy w tle.
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};