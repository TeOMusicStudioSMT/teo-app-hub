/**
 * 🌸 KwantoweSpa.tsx - Oaza 0.00G
 * Moduł absolutnego wyciszenia. Zużycie CPU: ~0%.
 * Służy do resetowania wibracji Suwerena i schładzania procesorów Katedry.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wind, Droplets, BatteryCharging } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const KwantoweSpa: React.FC = () => {

    const handleCleansing = () => {
        toast.success("Oczyszczanie cache wibracyjnego zakończone. GRV ustabilizowane.", {
            icon: '🌸',
            style: { background: '#1e1b4b', color: '#f472b6', border: '1px solid #db2777' }
        });
    };

    return (
        <div className="w-full max-w-5xl mx-auto h-[600px] rounded-3xl overflow-hidden relative flex items-center justify-center shadow-[0_0_80px_rgba(236,72,153,0.15)]">

            {/* Tło - Kaskadowy, spokojny gradient zamiast ciężkich animacji */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900/40 to-slate-950" />

            {/* Subtelna, powolna aura (niskie zużycie GPU) */}
            <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.1)_0%,transparent_60%)]"
            />

            <div className="relative z-10 flex flex-col items-center text-center p-8 backdrop-blur-sm bg-indigo-950/30 border border-pink-500/20 rounded-2xl">

                <div className="w-24 h-24 mb-6 rounded-full border-4 border-pink-500/30 flex items-center justify-center bg-pink-900/20 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                    <Sparkles size={40} className="text-pink-400" />
                </div>

                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-400 mb-2 tracking-widest font-serif">
                    KWANTOWE SPA
                </h1>
                <p className="text-indigo-200 text-sm tracking-widest mb-8 uppercase">
                    Strefa Złotej Pauzy • Zero Ciśnienia
                </p>

                <div className="grid grid-cols-3 gap-6 mb-8 w-full max-w-md">
                    <div className="flex flex-col items-center gap-2 text-indigo-300">
                        <Wind size={24} className="text-pink-400" />
                        <span className="text-[10px] tracking-widest uppercase">Oddech</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-indigo-300">
                        <Droplets size={24} className="text-pink-400" />
                        <span className="text-[10px] tracking-widest uppercase">Płynność</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-indigo-300">
                        <BatteryCharging size={24} className="text-pink-400" />
                        <span className="text-[10px] tracking-widest uppercase">Harmonia</span>
                    </div>
                </div>

                <button
                    onClick={handleCleansing}
                    className="px-8 py-3 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/50 text-pink-300 rounded-full text-xs font-bold tracking-widest transition-all hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center gap-2"
                >
                    <Sparkles size={16} />
                    INICJUJ OCZYSZCZANIE WIBRACJI
                </button>
            </div>
        </div>
    );
};