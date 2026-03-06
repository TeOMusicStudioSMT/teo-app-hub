/**
 * TeOGenesis.tsx - Suwerenny Ekran Inicjacji
 * 
 * Brama do TeO Ecosystem - zastępuje Firebase/Google login
 * Jeśli pioneer_bypass_enabled = true → NATYCHMIAST do Lounge
 * 
 * @version 1.0.0
 * @author BoB (TeO Ecosystem)
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Shield, ChevronRight, Lock, Unlock } from 'lucide-react';

// 🧹 WIESŁAW: Log po załadowaniu ikon
console.log('%c🧹 WIESŁAW: Panie Arku, ikony lśnią! Brama Inicjacji gotowa do otwarcia!', 'color: #22d3ee; font-weight: bold; font-size: 14px;');

interface TeOGenesisProps {
    onEnter: () => void;
    isPioneer: boolean;
}

const TeOGenesis: React.FC<TeOGenesisProps> = ({ onEnter, isPioneer }) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

    useEffect(() => {
        // Generate particles
        const newParticles = Array.from({ length: 30 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            delay: Math.random() * 5,
        }));
        setParticles(newParticles);
    }, []);

    const handleEnter = () => {
        setIsAnimating(true);
        setTimeout(() => {
            onEnter();
        }, 800);
    };

    // Auto-enter dla Pioneera
    useEffect(() => {
        if (isPioneer) {
            const timer = setTimeout(() => {
                onEnter();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isPioneer, onEnter]);

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden">
            {/* Particle Background */}
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        animationDelay: `${p.delay}s`,
                        opacity: 0.6,
                    }}
                />
            ))}

            {/* Main Content */}
            <div className={`
                relative z-10 text-center space-y-8 transition-all duration-700
                ${isAnimating ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}
            `}>
                {/* Logo / Title */}
                <div className="space-y-2">
                    <div className="flex items-center justify-center gap-3">
                        <Sparkles className="w-12 h-12 text-cyan-400 animate-pulse" />
                        <Zap className="w-8 h-8 text-yellow-400" />
                    </div>
                    
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        TeO GENESIS
                    </h1>
                    
                    <p className="text-xl text-gray-400 font-light">
                        Inicjacja Systemu Suwerennego
                    </p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-center gap-2">
                    {isPioneer ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
                            <Unlock className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 text-sm font-medium">PIONIER #1 W BUDYNKU</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-500/20 border border-gray-500/50 rounded-full">
                            <Lock className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-400 text-sm font-medium">GOŚĆ SYSTEMU</span>
                        </div>
                    )}
                </div>

                {/* Enter Button */}
                {!isPioneer && (
                    <button
                        onClick={handleEnter}
                        className="
                            group relative px-8 py-4 
                            bg-gradient-to-r from-cyan-500 to-purple-500 
                            hover:from-cyan-400 hover:to-purple-400
                            rounded-xl font-bold text-white
                            transition-all duration-300
                            hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30
                        "
                    >
                        <span className="flex items-center gap-2">
                            <>✨ ROZPOCZNIJ INICJACJĘ <ChevronRight className="w-5 h-5 group-hover:translate-x-1" /></>
                        </span>
                    </button>
                )}

                {/* System Info */}
                <div className="text-xs text-gray-600 mt-8">
                    <p>TeO Ecosystem v2.0 • Sovereign Governance Active</p>
                    <p className="mt-1">Bez Firebase • Bez Google • Czysta Suwerenność</p>
                </div>
            </div>

            {/* Bottom Decoration */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
        </div>
    );
};

export default TeOGenesis;
