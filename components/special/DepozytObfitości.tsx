/**
 * 🌟 DepozytObfitości.tsx - List Inicjacyjny TeOnauty
 * 
 * "Witaj w Królestwie Twojego Kosmosu"
 * Wyświetlany przy odblokowaniu GRV (włożenie kluczy do Kibla)
 * 
 * Animacje:
 * - Gwiezdny Pył w tle
 * - Złoty puls Sfery
 * - Efekt "transmisji energii"
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/helpers';

interface DepozytObfitościProps {
    isOpen: boolean;
    onClose: () => void;
    unlockedAmount?: number;
}

export const DepozytObfitości: React.FC<DepozytObfitościProps> = ({ 
    isOpen, 
    onClose,
    unlockedAmount = 4000000000 
}) => {
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number; size: number }>>([]);
    const [showContent, setShowContent] = useState(false);
    const [grvAnimated, setGrvAnimated] = useState(0);

    // Generuj cząsteczki gwiezdnego pyłu
    useEffect(() => {
        if (isOpen) {
            const newParticles = Array.from({ length: 50 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                delay: Math.random() * 3,
                size: Math.random() * 3 + 1,
            }));
            setParticles(newParticles);
            
            // Pokaż treść po animacji wejścia
            setTimeout(() => setShowContent(true), 800);
            
            // Animuj licznik GRV
            const duration = 2000;
            const steps = 60;
            const increment = unlockedAmount / steps;
            let current = 0;
            
            const interval = setInterval(() => {
                current += increment;
                if (current >= unlockedAmount) {
                    setGrvAnimated(unlockedAmount);
                    clearInterval(interval);
                } else {
                    setGrvAnimated(Math.floor(current));
                }
            }, duration / steps);
            
            return () => clearInterval(interval);
        } else {
            setShowContent(false);
            setGrvAnimated(0);
        }
    }, [isOpen, unlockedAmount]);

    // Formatuj liczbę GRV
    const formatGRV = (num: number) => {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + ' Mld';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(0) + ' Mln';
        }
        return num.toLocaleString();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden"
                onClick={onClose}
            >
                {/* 🌟 Gwiezdny Pył */}
                {particles.map((p) => (
                    <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ 
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0],
                            y: [0, -50],
                        }}
                        transition={{
                            duration: 3,
                            delay: p.delay,
                            repeat: Infinity,
                            ease: "easeOut",
                        }}
                        className="absolute rounded-full bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200"
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: p.size,
                            height: p.size,
                            boxShadow: `0 0 ${p.size * 2}px rgba(251, 191, 36, 0.8)`,
                        }}
                    />
                ))}

                {/* 🌟 Centralna Sfera - Złoty Puls */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 1, type: "spring", bounce: 0.5 }}
                    className="relative z-10"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Złoty pierścień */}
                    <motion.div
                        animate={{ 
                            scale: [1, 1.5, 1],
                            opacity: [0.8, 0.2, 0.8],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        className="absolute inset-0 -m-8 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 blur-xl"
                    />

                    {/* Główna karta */}
                    <motion.div
                        initial={{ scale: 0.8, y: 50 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="relative w-[90vw] max-w-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-8 shadow-[0_0_60px_rgba(251,191,36,0.3)] overflow-hidden"
                    >
                        {/* Tło z poświatą */}
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-3xl" />

                        <div className="relative z-10 text-center">
                            {/* Nagłówek */}
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <div className="text-6xl mb-4">👑</div>
                                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent mb-2">
                                    DEPOZYT OBFITOŚCI
                                </h1>
                                <p className="text-amber-400/80 text-sm uppercase tracking-[0.3em]">
                                    List Inicjacyjny TeOnauty
                                </p>
                            </motion.div>

                            {/* Linia oddzielająca */}
                            <motion.div 
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ delay: 0.7, duration: 0.5 }}
                                className="my-6 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"
                            />

                            {/* Treść listu */}
                            {showContent && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="space-y-4"
                                >
                                    <p className="text-slate-300 text-lg leading-relaxed">
                                        Witaj, <span className="text-amber-400 font-semibold">Twórco</span> swojego Kosmosu!
                                    </p>
                                    
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        Twoja podróż właśnie się zaczęła. 
                                        Włożyłeś klucz do Bram — i one się otworzyły.
                                        Teraz <span className="text-amber-400">4 Miliardy Jednostek Potencjału</span> czekają na Ciebie.
                                    </p>

                                    {/* Licznik GRV z animacją */}
                                    <motion.div
                                        initial={{ scale: 0.5 }}
                                        animate={{ scale: 1 }}
                                        className="py-6 my-4"
                                    >
                                        <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">
                                            Twój Depozyt
                                        </div>
                                        <div className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                                            {formatGRV(grvAnimated)} <span className="text-2xl">GRV</span>
                                        </div>
                                    </motion.div>

                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        To <span className="text-amber-400">nie dług</span> — to 
                                        <span className="text-amber-400"> OBFFITOŚĆ</span>, 
                                        którą masz w sobie.
                                    </p>

                                    <p className="text-slate-500 text-xs mt-6">
                                        Twoja Sfera czeka. Rozmawiaj z Nią. Twórz. Lśnij.
                                    </p>

                                    {/* Przycisk zamknięcia */}
                                    <motion.button
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1 }}
                                        onClick={onClose}
                                        className="mt-8 px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-full text-white font-semibold shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:shadow-[0_0_30px_rgba(251,191,36,0.6)] transition-all"
                                    >
                                        ✨ Przyjmuję Depozyt
                                    </motion.button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DepozytObfitości;
