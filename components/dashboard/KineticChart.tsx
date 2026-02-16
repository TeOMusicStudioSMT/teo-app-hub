import React from 'react';
import { motion } from 'framer-motion';

export const KineticChart: React.FC = () => {
    // Dane wykresu (symulacja krzywej wzrostu)
    const points = [
        [0, 80], [10, 75], [20, 78], [30, 72], [40, 60],
        [50, 65], [60, 50], [70, 45], [80, 30], [90, 15], [100, 5]
    ];

    // Generujemy ścieżkę SVG
    const pathData = `M ${points.map(p => p.join(',')).join(' L ')}`;
    // Generujemy obszar pod wykresem (dla gradientu)
    const areaData = `${pathData} L 100,100 L 0,100 Z`;

    return (
        <div className="relative w-full h-40 overflow-hidden rounded-xl bg-slate-900/50 border border-slate-700/30 flex items-center justify-center">

            {/* Tło Siatki */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

            <svg viewBox="0 0 100 100" className="w-full h-full p-4 preserve-3d">
                <defs>
                    <linearGradient id="gradientArea" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Obszar pod wykresem (Wypełnienie) */}
                <motion.path
                    d={areaData}
                    fill="url(#gradientArea)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                />

                {/* Linia Wykresu */}
                <motion.path
                    d={pathData}
                    fill="none"
                    stroke="#4ade80" // Green-400
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                />

                {/* Pulsujący punkt na końcu */}
                <motion.circle
                    cx="100"
                    cy="5"
                    r="4"
                    fill="#fff"
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 2, delay: 2, repeat: Infinity }}
                />
                <motion.circle
                    cx="100"
                    cy="5"
                    r="8"
                    fill="#4ade80"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, delay: 2, repeat: Infinity }}
                />
            </svg>

            {/* Wskaźnik procentowy */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
                className="absolute top-4 left-4"
            >
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white tracking-tighter">4100</span>
                    <span className="text-sm text-slate-400 font-mono">GRV</span>
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-900/30 px-2 py-1 rounded-full w-fit mt-1 border border-green-500/30">
                    <span>↗</span> +8.4% Yield
                </div>
            </motion.div>
        </div>
    );
};