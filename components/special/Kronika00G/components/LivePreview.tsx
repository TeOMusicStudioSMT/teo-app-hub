import React, { useEffect, useState, useRef } from 'react';
import { 
    X, 
    Sparkles, 
    Share2, 
    Download, 
    Globe, 
    FlaskConical, 
    ShieldCheck, 
    CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Creation } from './types';

interface LivePreviewProps {
  creation: Creation | null;
  history: Creation[];
  isLoading: boolean;
  isFocused: boolean;
  onReset: () => void;
  onSelect: (creation: Creation) => void;
}

const useGlitch = (active: boolean) => {
    const [isGlitching, setIsGlitching] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!active) {
            setIsGlitching(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        const triggerGlitch = () => {
            setIsGlitching(true);
            setTimeout(() => setIsGlitching(false), 300);
            
            const nextInterval = Math.random() * 8000 + 3000; // 3-11 seconds
            timeoutRef.current = setTimeout(triggerGlitch, nextInterval);
        };

        timeoutRef.current = setTimeout(triggerGlitch, 2000);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [active]);

    return isGlitching;
};

const AuraIndicator = ({ aura }: { aura: 'gold' | 'cyan' | 'violet' }) => {
    const colors = {
        gold: 'from-[#c9953a] to-[#f3d08c] shadow-[#c9953a]/40',
        cyan: 'from-[#00e5ff] to-[#80f2ff] shadow-[#00e5ff]/40',
        violet: 'from-[#a78bfa] to-[#c4b5fd] shadow-[#a78bfa]/40'
    };
    const labels = {
        gold: 'Legenda',
        cyan: 'Odkrycie',
        violet: 'Refleksja'
    };

    return (
        <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors[aura]} shadow-[0_0_15px_rgba(0,0,0,0.5)] animate-pulse`}></div>
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-zinc-400">{labels[aura]}</span>
        </div>
    );
};

const CosmicCoordinates = ({ id }: { id: string }) => {
    const getCoord = (seed: string, offset: number) => {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs((hash + offset) % 1000) / 10;
    };

    return (
        <div className="flex flex-col items-end text-[8px] font-mono text-zinc-700 uppercase tracking-widest">
            <span>Sektor: {id.slice(0, 4).toUpperCase()}</span>
            <span>Koordynaty: {getCoord(id, 10)}°N / {getCoord(id, 20)}°E</span>
        </div>
    );
};

export const LivePreview: React.FC<LivePreviewProps> = ({ creation, history, isLoading, isFocused, onReset, onSelect }) => {
    const [copied, setCopied] = useState(false);
    const [notification, setNotification] = useState<{ show: boolean, message: string } | null>(null);
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const isGlitching = useGlitch(isFocused && !!creation);

    const currentIndex = history.findIndex(c => c.id === creation?.id);

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex < history.length - 1) {
            onSelect(history[currentIndex + 1]);
        }
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            onSelect(history[currentIndex - 1]);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isFocused || !creation) return;
            if (e.key === 'ArrowLeft') {
                if (currentIndex < history.length - 1) {
                    onSelect(history[currentIndex + 1]);
                }
            } else if (e.key === 'ArrowRight') {
                if (currentIndex > 0) {
                    onSelect(history[currentIndex - 1]);
                }
            } else if (e.key === 'Escape') {
                onReset();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFocused, creation, currentIndex, history, onSelect, onReset]);

    const showNotification = (message: string) => {
        setNotification({ show: true, message });
        setTimeout(() => setNotification(null), 2000);
    };

    const handleShare = () => {
        if (!creation?.mission) return;
        const text = `📜 KRONIKA 0.00G\n\n✨ ${creation.mission.title}\n\n"${creation.mission.narrative}"\n\n💎 GRV: ${creation.mission.xp}\n🔮 AURA: ${creation.mission.aura.toUpperCase()}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        showNotification('Skopiowano do schowka');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExport = () => {
        if (!creation) return;
        const dataStr = JSON.stringify(creation, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kronika_${creation.id.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('Eksport zakończony');
    };

    const auraColors = {
        gold: 'border-[#c9953a]/30 shadow-[#c9953a]/10',
        cyan: 'border-[#00e5ff]/30 shadow-[#00e5ff]/10',
        violet: 'border-[#a78bfa]/30 shadow-[#a78bfa]/10'
    };

    const auraTextColors = {
        gold: 'text-[#c9953a]',
        cyan: 'text-[#00e5ff]',
        violet: 'text-[#a78bfa]'
    };

    return (
        <div
            className={`
                fixed z-40 inset-0 flex flex-col items-center
                transition-all duration-700
                ${isFocused
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-95 pointer-events-none'
                }
            `}
        >
            {/* Backdrop Blur */}
            <div 
                className="absolute inset-0 bg-[#06080f]/90 backdrop-blur-xl pointer-events-none" 
            ></div>

            {/* Scrollable Wrapper */}
            <div 
                className="absolute inset-0 overflow-y-auto overflow-x-hidden flex flex-col items-center cursor-pointer group/wrapper"
                onClick={onReset}
            >
                {isLoading ? (
                    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen space-y-8 cursor-default" onClick={(e) => e.stopPropagation()}>
                        <div className="relative w-24 h-24">
                            <div className="absolute inset-0 border-2 border-[#c9953a]/20 rounded-full animate-ping"></div>
                            <div className="absolute inset-0 border-2 border-[#c9953a]/40 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="w-10 h-10 text-[#c9953a] animate-spin-slow" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-white tracking-widest">Materializacja Kroniki</h3>
                            <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Analiza dokonań suwerena...</p>
                        </div>
                    </div>
                ) : creation?.mission ? (
                    <div 
                        className="relative z-10 w-full max-w-4xl px-4 py-20 flex flex-col items-center cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Metadata */}
                        <div className="w-full max-w-2xl flex justify-between items-end mb-6 px-4">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-xl font-bold text-white tracking-[0.2em] uppercase">Mission Dossier</h1>
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">ID: {creation.id.toUpperCase()}</span>
                            </div>
                            <CosmicCoordinates id={creation.id} />
                        </div>

                        {/* The Mission Card */}
                        <div className={`
                            relative w-full max-w-2xl bg-[#06080f] border-2 ${creation.mission.aura === 'gold' ? 'border-[#c9953a]' : auraColors[creation.mission.aura]} 
                            rounded-2xl p-8 md:p-12 shadow-[0_0_100px_rgba(201,149,58,0.15)] overflow-hidden
                        `}>
                            {/* Card Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12 relative z-10">
                                <div className="flex items-center space-x-6">
                                    <AuraIndicator aura={creation.mission.aura} />
                                    <div className="h-4 w-px bg-zinc-800"></div>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Status: Kompletna</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                                        <Globe className="w-3 h-3" />
                                        <span>Data:</span>
                                        <span className="text-zinc-300">{creation.timestamp.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Title */}
                            <div className="relative mb-8 z-10">
                                <h2 className={`text-4xl md:text-6xl font-black text-white leading-tight tracking-tight ${isGlitching ? 'opacity-50' : ''}`}>
                                    {creation.mission.title}
                                </h2>
                                <div className={`h-1 w-24 mt-4 bg-gradient-to-r ${creation.mission.aura === 'gold' ? 'from-[#c9953a]' : creation.mission.aura === 'cyan' ? 'from-[#00e5ff]' : 'from-[#a78bfa]'} to-transparent`}></div>
                            </div>

                            {/* Card Narrative */}
                            <div className="relative mb-12 z-10">
                                <div className="absolute -left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-zinc-800 to-transparent"></div>
                                <p className={`text-xl md:text-2xl text-zinc-300 font-light leading-relaxed italic ${isGlitching ? 'opacity-50' : ''}`}>
                                    "{creation.mission.narrative}"
                                </p>
                            </div>

                            {/* Mission Log Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 relative z-10">
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-2 text-zinc-600">
                                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                        <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Log Operacyjny</span>
                                    </div>
                                    <div className="space-y-2 font-mono text-[10px] text-zinc-500 leading-relaxed border-l border-zinc-800/50 pl-4">
                                        <p>01: Inicjalizacja Kroniki...</p>
                                        <p>02: Analiza: {creation.name.toUpperCase()}</p>
                                        <p>03: Aura: {creation.mission.aura.toUpperCase()}</p>
                                        <p className="text-zinc-400">04: Przyznano +{creation.mission.xp} GRV</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-2 text-zinc-600">
                                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                        <span className="text-[10px] font-mono uppercase tracking-[0.3em]">System</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 font-mono text-[10px] text-zinc-500 border-l border-zinc-800/50 pl-4">
                                        <span>Integracja:</span> <span className="text-green-500/60">100%</span>
                                        <span>Szyfrowanie:</span> <span className="text-green-500/60">Aktywne</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="relative z-10 pt-8 mt-4">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center space-x-12">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Potencjał</span>
                                            <div className="flex items-baseline space-x-1">
                                                <span className={`text-3xl font-bold ${auraTextColors[creation.mission.aura]}`}>{creation.mission.xp}</span>
                                                <span className="text-[10px] font-mono text-zinc-600">GRV</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <button onClick={handleShare} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Udostępnij">
                                            <Share2 className="w-5 h-5" />
                                        </button>
                                        <button onClick={handleExport} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Eksportuj">
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Original Image Preview */}
                        {creation.originalImage && (
                            <div className="mt-12 w-full max-w-2xl flex items-center justify-between px-4">
                                <div className="group relative" onClick={() => setIsImageExpanded(true)}>
                                    <img src={creation.originalImage} alt="Oryginał" className="w-32 h-32 object-cover rounded-2xl opacity-40 hover:opacity-100 transition-all cursor-zoom-in" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Połączenie Stabilne</span>
                                    <span className="text-[8px] font-mono text-zinc-800 uppercase tracking-[0.4em]">Kronika 0.00G</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Close Button */}
            <button onClick={onReset} className="absolute top-6 right-6 z-50 flex items-center space-x-3 group">
                <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-zinc-600 group-hover:text-zinc-400">Zamknij</span>
                <div className="p-2 border border-zinc-800 rounded-full group-hover:border-zinc-600">
                    <X className="w-6 h-6 text-zinc-500 group-hover:text-white" />
                </div>
            </button>
        </div>
    );
};
