import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiActivity, FiCpu, FiChevronDown, FiTrendingUp, FiLayers, FiGlobe, FiZap } from 'react-icons/fi';
import { FuzzyText } from './react_bits/FuzzyText';
import { GradientText } from './react_bits/GradientText';

// --- KONFIGURACJA ZEWNĘTRZNA (CoinGecko IDs) ---
const MARKET_LISTS = {
    titans: {
        label: "Market Titans",
        ids: ['bitcoin', 'ethereum', 'solana'],
        names: { bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana' }
    },
    infrastructure: {
        label: "Infra & L1",
        ids: ['polkadot', 'avalanche-2', 'near'],
        names: { polkadot: 'Polkadot', 'avalanche-2': 'Avalanche', near: 'NEAR Protocol' }
    },
    ai: {
        label: "AI Swarm",
        ids: ['fetch-ai', 'render-token', 'singularitynet'],
        names: { 'fetch-ai': 'Fetch.ai', 'render-token': 'Render', singularitynet: 'SingularityNET' }
    }
};

// --- KONFIGURACJA WEWNĘTRZNA (TeO Stats) ---
const TEO_METRICS = [
    { label: "Capital Inflow (TVL)", value: "4.2M GRV", trend: "+12%", icon: <FiTrendingUp /> },
    { label: "Network Velocity", value: "840 TPS", trend: "Stable", icon: <FiZap /> },
    { label: "Top Utility App", value: "Story Studio", trend: "#1 Rank", icon: <FiLayers /> }
];

export const CryptoTicker: React.FC = () => {
    // Stan dla Rynku Zewnętrznego
    const [activeCategory, setActiveCategory] = useState<keyof typeof MARKET_LISTS>('titans');
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [marketExpanded, setMarketExpanded] = useState(false);
    const [loading, setLoading] = useState(true);

    // Stan dla Ekosystemu TeO
    const [teoExpanded, setTeoExpanded] = useState(false);

    // 1. Pobieranie danych z API (zależne od kategorii)
    useEffect(() => {
        const fetchPrices = async () => {
            setLoading(true);
            try {
                const currentList = MARKET_LISTS[activeCategory];
                const ids = currentList.ids.join(',');
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
                const data = await response.json();

                const newPrices: Record<string, number> = {};
                currentList.ids.forEach(id => {
                    if (data[id]) newPrices[id] = data[id].usd;
                });

                setPrices(newPrices);
                setLoading(false);
            } catch (error) {
                console.error("Crypto fetch error:", error);
                setLoading(false);
            }
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 60000);
        return () => clearInterval(interval);
    }, [activeCategory]); // Odśwież, gdy zmieni się kategoria

    return (
        <div className="flex flex-col md:flex-row gap-4 w-full relative z-10">

            {/* ==============================================
                KARTA 1: EXTERNAL REALITY (Dynamiczny Rynek) 
               ============================================== */}
            <motion.div
                layout
                className="flex-1 bg-slate-900/80 border border-orange-500/20 rounded-2xl p-4 shadow-lg relative overflow-hidden cursor-pointer group"
                onClick={() => setMarketExpanded(!marketExpanded)}
                initial={{ borderRadius: 16 }}
                animate={{ borderRadius: marketExpanded ? 24 : 16 }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* Nagłówek Karty */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-orange-400">
                        <FiActivity className={marketExpanded ? "animate-spin" : ""} />
                        <span className="text-xs font-bold tracking-widest uppercase opacity-80">
                            External / {MARKET_LISTS[activeCategory].label}
                        </span>
                    </div>
                    <FiChevronDown className={`text-orange-400 transition-transform duration-300 ${marketExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Główna Cena (Lider Kategorii) */}
                <div className="flex justify-between items-end">
                    <div className="text-slate-400 text-sm">
                        {MARKET_LISTS[activeCategory].names[MARKET_LISTS[activeCategory].ids[0]]}
                    </div>
                    {loading ? (
                        <div className="h-8 w-24 bg-slate-800 animate-pulse rounded" />
                    ) : (
                        <FuzzyText
                            fontSize="2rem"
                            color="#fb923c"
                            baseIntensity={0.03}
                            hoverIntensity={0.06}
                        >
                            ${prices[MARKET_LISTS[activeCategory].ids[0]]?.toLocaleString()}
                        </FuzzyText>
                    )}
                </div>

                {/* Sekcja Rozwijana: Wybór Kategorii + Lista */}
                <AnimatePresence>
                    {marketExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 border-t border-orange-500/10"
                        >
                            {/* Selector Kategorii */}
                            <div className="flex gap-2 py-3 overflow-x-auto no-scrollbar">
                                {(Object.keys(MARKET_LISTS) as Array<keyof typeof MARKET_LISTS>).map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={(e) => { e.stopPropagation(); setActiveCategory(cat); }}
                                        className={`px-3 py-1 text-xs rounded-full border transition-all whitespace-nowrap ${activeCategory === cat
                                            ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                            : 'border-slate-700 text-slate-500 hover:text-orange-400'
                                            }`}
                                    >
                                        {MARKET_LISTS[cat].label}
                                    </button>
                                ))}
                            </div>

                            {/* Lista Pozostałych Tokenów */}
                            <div className="space-y-3 pb-2">
                                {MARKET_LISTS[activeCategory].ids.slice(1).map(id => (
                                    <div key={id} className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 flex items-center gap-2">
                                            <FiGlobe className="text-slate-600" />
                                            {MARKET_LISTS[activeCategory].names[id]}
                                        </span>
                                        <span className="font-mono text-orange-300/80">
                                            ${prices[id]?.toLocaleString() || '---'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>


            {/* ==============================================
                KARTA 2: TEO ECOSYSTEM (Stabilność & Rankingi) 
               ============================================== */}
            <motion.div
                layout
                className="flex-1 bg-slate-900/80 border border-purple-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden cursor-pointer group"
                onClick={() => setTeoExpanded(!teoExpanded)}
                initial={{ borderRadius: 16 }}
                animate={{ borderRadius: teoExpanded ? 24 : 16 }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-transparent opacity-30" />

                {/* Nagłówek */}
                <div className="flex items-center justify-between mb-2 relative z-10">
                    <div className="flex items-center gap-2 text-purple-400">
                        <FiCpu />
                        <span className="text-xs font-bold tracking-widest uppercase">TeO Core / Pulse</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-500/20">
                        <FiTrendingUp /> Stable
                    </div>
                </div>

                {/* Główna Wartość (Energy) */}
                <div className="flex justify-between items-end relative z-10">
                    <div className="text-slate-400 text-sm">Graviton (GRV)</div>
                    <GradientText
                        colors={["#c084fc", "#a855f7", "#e879f9", "#c084fc"]}
                        animationSpeed={6}
                        showBorder={false}
                        className="text-4xl font-bold font-mono"
                    >
                        1.00 <span className="text-sm font-light ml-1 opacity-70">ENERGY</span>
                    </GradientText>
                </div>

                {/* Sekcja Rozwijana: Wewnętrzne Rankingi */}
                <AnimatePresence>
                    {teoExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-purple-500/20 space-y-4 relative z-10"
                        >
                            <p className="text-xs text-purple-300/50 uppercase tracking-widest mb-2">Internal Velocity Stats</p>

                            {TEO_METRICS.map((metric, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-purple-900/10 border border-purple-500/10 hover:bg-purple-900/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-500/10 rounded-md text-purple-400">
                                            {metric.icon}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-400">{metric.label}</span>
                                            <span className="text-sm font-bold text-white">{metric.value}</span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-green-400 bg-green-900/20 px-2 py-1 rounded">
                                        {metric.trend}
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

        </div>
    );
};