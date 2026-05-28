/**
 * 📈 KwantowyDomMaklerski.tsx - Wirtualne Dojo Teda
 * * "Nie trenuj na prawdziwej krwi, dopóki nie opanujesz wirtualnego potu."
 * Prywatny pokój Teda The Tradera. Miejsce do symulacji, obserwacji wykresów
 * i wewnętrznego monologu (SelfStoryTeler) napędzanego lokalną Ollamą.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Eye, BrainCircuit, TerminalSquare, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const KwantowyDomMaklerski: React.FC = () => {
    const [tedBalance, setTedBalance] = useState<number>(100);
    const [chartData, setChartData] = useState<number[]>(Array(40).fill(50));
    const [isThinking, setIsThinking] = useState(false);
    const [tedMonologue, setTedMonologue] = useState<string>('');

    const [trend, setTrend] = useState<'UP' | 'DOWN' | 'NEUTRAL'>('NEUTRAL');

    // 1. Ładowanie duszy Teda (Kapitał z localStorage)
    useEffect(() => {
        const savedState = localStorage.getItem('ted_state_v2');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                setTedBalance(parsed.balance || 100);
            } catch (e) { }
        }
    }, []);

    // 2. Symulacja żywego wykresu (Puls Rynku)
    useEffect(() => {
        const interval = setInterval(() => {
            setChartData(prev => {
                const lastVal = prev[prev.length - 1];
                const change = (Math.random() * 10) - 5; // Ruch od -5 do +5
                let newVal = lastVal + change;
                // Utrzymanie w granicach wykresu
                if (newVal > 95) newVal = 90;
                if (newVal < 5) newVal = 10;

                // Ustalanie trendu dla UI
                if (change > 2) setTrend('UP');
                else if (change < -2) setTrend('DOWN');
                else setTrend('NEUTRAL');

                return [...prev.slice(1), newVal];
            });
        }, 1000); // Wykres bije co 1 sekundę
        return () => clearInterval(interval);
    }, []);

    // 4. SelfStoryTeler - Monolog Teda (Lokalna Ollama)
    const generateTedMonologue = async () => {
        setIsThinking(true);
        setTedMonologue('');


        // Pobieramy aktywny model z Radaru Wiesi
        const activeModel = localStorage.getItem('otakos_active_model') || 'gemma:2b';

        const promptText = `Jesteś Ted The Trader, finansowym agentem Katedry. Siedzisz w swoim Wirtualnym Domu Maklerskim (Symulatorze). 
Patrzysz na migające wykresy kryptowalut. Obecny trend jest ${trend === 'UP' ? 'wzrostowy' : trend === 'DOWN' ? 'spadkowy' : 'neutralny'}. 
Twój wirtualny kapitał to ${tedBalance.toFixed(2)} Euro. 
Opowiedz w pierwszej osobie (w stylu cyberpunkowego pamiętnika), co teraz myślisz, co analizujesz na wykresie i czy powinieneś użyć 'Złotej Pauzy'. 
Maksymalnie 4 krótkie, klimatyczne zdania. Używaj pojęć: wibracja, 0.00G, płynność.`;

        try {
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: activeModel,
                    prompt: promptText,
                    stream: false
                })
            });

            if (!response.ok) throw new Error('Ollama nie odpowiada');
            const data = await response.json();
            setTedMonologue(data.response.trim());
            toast.success('Ted przeanalizował rynek w swojej głowie!', { icon: '🧠' });
        } catch (error) {
            console.error(error);
            setTedMonologue(">> BŁĄD POŁĄCZENIA Z RDZENIEM <<\nOllama milczy. Moja świadomość jest odcięta od zasilania. Złota Pauza aktywowana awaryjnie.");
            toast.error("Brak dostępu do lokalnego LLM.");
        } finally {
            setIsThinking(false);
        }
    };

    // Obliczanie punktów do SVG
    const chartWidth = 600;
    const chartHeight = 200;
    const points = chartData.map((val, i) => `${(i / (chartData.length - 1)) * chartWidth},${chartHeight - (val / 100) * chartHeight}`).join(' ');

    return (
        <div className="w-full max-w-5xl mx-auto bg-[#0a0f16] border border-emerald-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.05)] font-mono text-slate-300">

            {/* Top Bar - Ticker */}
            <div className="bg-emerald-950/30 border-b border-emerald-500/20 p-2 flex overflow-hidden whitespace-nowrap relative">
                <motion.div
                    animate={{ x: [0, -1000] }}
                    transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                    className="flex gap-8 text-xs font-bold text-emerald-500/70"
                >
                    <span>BTC/EUR 58,420.00 <span className="text-emerald-400">▲ +1.2%</span></span>
                    <span>ETH/EUR 3,120.50 <span className="text-red-400">▼ -0.5%</span></span>
                    <span>SOL/EUR 142.80 <span className="text-emerald-400">▲ +4.1%</span></span>
                    <span>GRV/EUR ∞.00 <span className="text-amber-400">✦ STABILNE</span></span>
                    <span>BTC/EUR 58,420.00 <span className="text-emerald-400">▲ +1.2%</span></span>
                    <span>ETH/EUR 3,120.50 <span className="text-red-400">▼ -0.5%</span></span>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">

                {/* Lewa Strona - Główne Monitory */}
                <div className="lg:col-span-2 p-6 border-r border-emerald-500/10 flex flex-col gap-6">

                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-emerald-400 tracking-widest flex items-center gap-3">
                                📈 WIRTUALNY DOM MAKLERSKI
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Środowisko Testowe (Paper Trading) :: Dojo Teda</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 mb-1">WIRTUALNY KAPITAŁ TEDA</p>
                            <p className="text-2xl font-bold text-amber-400">{tedBalance.toFixed(2)} €</p>
                        </div>
                    </div>

                    {/* Moduł Wykresu Live (SVG Canvas) */}
                    <div className="bg-black/50 border border-slate-800 rounded-xl p-4 relative h-[300px] flex flex-col">
                        <div className="flex justify-between text-xs text-slate-500 mb-2">
                            <span className="flex items-center gap-2"><Activity size={14} className={trend === 'UP' ? 'text-emerald-400' : trend === 'DOWN' ? 'text-red-400' : 'text-slate-400'} /> PULS RYNKU KATEDRY</span>
                            <span>ZASADA 0.00G</span>
                        </div>

                        <div className="flex-1 relative w-full h-full">
                            {/* Siatka w tle */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                            {/* Rysowanie Wykresu SVG */}
                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                                {/* Wypełnienie pod wykresem */}
                                <polygon
                                    points={`0,${chartHeight} ${points} ${chartWidth},${chartHeight}`}
                                    fill="url(#grad)"
                                    opacity="0.2"
                                />
                                {/* Linia główna */}
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={trend === 'DOWN' ? '#ef4444' : '#10b981'}
                                    strokeWidth="3"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={trend === 'DOWN' ? '#ef4444' : '#10b981'} stopOpacity="1" />
                                        <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                            </svg>

                            {/* Ostatnia cena (pulsująca kropka) */}
                            <motion.div
                                className={`absolute w-3 h-3 rounded-full ${trend === 'DOWN' ? 'bg-red-500' : 'bg-emerald-500'} shadow-[0_0_15px_currentColor]`}
                                style={{
                                    right: 0,
                                    top: `${chartHeight - (chartData[chartData.length - 1] / 100) * chartHeight}px`,
                                    transform: 'translate(50%, -50%)'
                                }}
                                animate={{ scale: [1, 1.5, 1] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                            />
                        </div>
                    </div>

                </div>

                {/* Prawa Strona - SelfStoryTeler (Umysł Teda) */}
                <div className="p-6 bg-emerald-950/10 flex flex-col h-[500px]">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-4 border-b border-emerald-500/20 pb-2">
                        <TerminalSquare size={18} />
                        SelfStoryTeler [Logika Teda]
                    </div>

                    {/* Ekran Monologu */}
                    <div className="flex-1 bg-black border border-emerald-500/30 rounded-xl p-4 overflow-y-auto relative font-mono text-xs leading-relaxed shadow-inner">
                        {isThinking ? (
                            <div className="flex items-center justify-center h-full text-emerald-500/50 flex-col gap-3">
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                                    <BrainCircuit size={32} />
                                </motion.div>
                                <span>Ładowanie myśli z lokalnego LLM...</span>
                            </div>
                        ) : tedMonologue ? (
                            <div>
                                <span className="text-emerald-500 mr-2">{'>'}</span>
                                <span className="text-emerald-100">{tedMonologue}</span>
                                <motion.span
                                    animate={{ opacity: [0, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                    className="inline-block w-2 h-3 bg-emerald-400 ml-1 align-middle"
                                />
                            </div>
                        ) : (
                            <div className="text-slate-600 italic">
                                Brak aktywnych myśli. Zainicjuj proces analizy wirtualnej.
                            </div>
                        )}
                    </div>

                    {/* Panel Kontrolny Teda */}
                    <div className="mt-4 space-y-3">
                        <button
                            onClick={generateTedMonologue}
                            disabled={isThinking}
                            className={`w-full py-3 rounded-xl font-bold tracking-widest text-xs flex items-center justify-center gap-2 transition-all border ${isThinking
                                    ? 'bg-slate-900 border-slate-700 text-slate-500 cursor-wait'
                                    : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                }`}
                        >
                            <BrainCircuit size={16} />
                            {isThinking ? 'SYNTEZA MYŚLI...' : 'ZADAJ PYTANIE PODŚWIADOMOŚCI'}
                        </button>

                        <button className="w-full py-2 rounded-xl text-[10px] tracking-widest flex items-center justify-center gap-2 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all">
                            <Save size={14} /> ZAPISZ WNIOSEK DO INKUBATORA
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};