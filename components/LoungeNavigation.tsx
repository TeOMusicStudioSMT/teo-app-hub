/**
 * 🧭 LoungeNavigation.tsx
 *
 * Główny pasek nawigacji TeOnauta.
 * 5 pierwszoplanowych przycisków + schowany panel "Więcej (...)"
 * z glassmorphism dropdownem dla rzadziej używanych sekcji.
 *
 * @author BoB & TeO
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, EyeOff } from 'lucide-react';
import {
    ChartBarIcon,
    AppIcon,
    UserCircleIcon,
    MortarBoardIcon,
    ShieldCheckIcon,
    MarketIcon,
    WalletIcon,
    BrainChipIcon,
    TrophyIcon,
} from './icons';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { cn } from '../lib/helpers';
import { canAccess, currentTier, requiredPillar } from '../lib/tiers';

type View =
    | 'dashboard'
    | 'projects'
    | 'teo-market'
    | 'identity'
    | 'academy'
    | 'field-control'
    | 'profile'
    | 'graviton-wallet'
    | 'cobots'
    | 'crew-club'
    | 'teolab'
    | 'robotics'
    | 'sonic';

interface LoungeNavigationProps {
    activeView: View;
    onViewChange: (view: View) => void;
    onToggleZen?: () => void;
}

// ── 5 głównych pozycji zawsze widocznych ──────────────────────────────
const PRIMARY_NAV: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard',       label: 'Dashboard',  icon: <ChartBarIcon /> },
    { id: 'projects',        label: 'Universes',  icon: <AppIcon /> },
    { id: 'crew-club',       label: '🏆 Klub',    icon: <TrophyIcon /> },
    { id: 'teo-market',      label: 'TeO Market', icon: <MarketIcon /> },
    { id: 'graviton-wallet', label: 'GRAVITON',   icon: <WalletIcon /> },
];

// ── Pozycje schowane w panelu "Więcej" ────────────────────────────────
const MORE_NAV: { id: View; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'sonic',         label: 'Kolektor Soniczny', icon: <span className="text-base">🎼</span>, desc: 'Zbiór wektorów z własnej muzyki (Filar I)' },
    { id: 'identity',      label: 'Identity',      icon: <UserCircleIcon />,  desc: 'Karta tożsamości Suwerena' },
    { id: 'cobots',        label: 'Co-Bots',        icon: <BrainChipIcon />,   desc: 'Fabryka autonomicznych agentów' },
    { id: 'academy',       label: 'Academy',        icon: <MortarBoardIcon />, desc: 'Quantum Compass & nauka' },
    { id: 'field-control', label: 'Field Control',  icon: <ShieldCheckIcon />, desc: 'Tarcza Pola i bezpieczeństwo' },
    { id: 'teolab',        label: 'TeO Lab',        icon: <span className="text-base">🧪</span>, desc: 'Laboratorium eksperymentów (Filar II)' },
    { id: 'robotics',      label: 'OtakOS Robotics', icon: <span className="text-base">🚜</span>, desc: 'Garaż: Agro Traktorek i flota (Filar II)' },
];

// ── Komponent ─────────────────────────────────────────────────────────
export const LoungeNavigation: React.FC<LoungeNavigationProps> = ({
    activeView,
    onViewChange,
    onToggleZen,
}) => {
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];
    const tier = currentTier(); // 🏛️ FILAR — bramkuje dostęp do widoków

    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);

    // Zamknij dropdown po kliknięciu poza nim
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
                setIsMoreOpen(false);
            }
        };
        if (isMoreOpen) document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isMoreOpen]);

    // Czy aktywny widok jest schowany w "Więcej"?
    const isMoreActive = MORE_NAV.some(item => item.id === activeView);

    const handleMoreItemClick = (view: View) => {
        onViewChange(view);
        setIsMoreOpen(false);
    };

    return (
        <nav className="relative z-[100] mb-6 w-full max-w-5xl mx-auto flex items-center justify-center gap-1 md:gap-1.5 p-2 bg-slate-900/60 border border-slate-700/50 rounded-full backdrop-blur-lg">

            {/* ── Godło FILARU ──────────────────────────────────────── */}
            <div title={`${tier.name.pl} · ${tier.title.pl}`}
                className="shrink-0 hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono mr-1"
                style={{ color: tier.color, border: `1px solid ${tier.color}55`, background: `${tier.color}14` }}>
                🏛️ {tier.title.pl}
            </div>

            {/* ── Główne przyciski ──────────────────────────────────── */}
            {PRIMARY_NAV.map(item => {
                const locked = !canAccess(item.id, tier);
                return (
                <button
                    key={item.id}
                    onClick={() => { if (!locked) onViewChange(item.id); }}
                    disabled={locked}
                    title={locked ? `Odblokujesz na Filarze ${requiredPillar(item.id)}` : item.label}
                    className={cn(
                        'relative flex-1 md:flex-none flex items-center justify-center gap-2',
                        'px-3 py-2 rounded-full text-sm font-bold transition-all duration-300',
                        locked
                            ? 'opacity-40 cursor-not-allowed text-slate-500'
                            : activeView === item.id
                                ? `${theme.tw.bg} text-slate-900 shadow-lg ${theme.tw.shadow}`
                                : 'bg-transparent text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    )}
                >
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">{locked ? '🔒' : item.icon}</div>
                    <span className="hidden md:inline whitespace-nowrap">{item.label}</span>
                </button>
            );})}

            {/* ── Separator ─────────────────────────────────────────── */}
            <div className="w-px h-6 bg-slate-700/60 shrink-0 mx-1" />

            {/* ── Przycisk "Więcej (...)" z dropdownem ──────────────── */}
            <div className="relative shrink-0" ref={moreRef}>
                <button
                    onClick={() => setIsMoreOpen(prev => !prev)}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold',
                        'transition-all duration-300 select-none',
                        isMoreOpen || isMoreActive
                            ? `${theme.tw.bg} text-slate-900 shadow-lg ${theme.tw.shadow}`
                            : 'bg-transparent text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    )}
                >
                    {/* Wskaźnik aktywnego widoku z "Więcej" */}
                    {isMoreActive && !isMoreOpen && (
                        <motion.span
                            layoutId="more-active-dot"
                            className="w-1.5 h-1.5 rounded-full bg-current"
                        />
                    )}
                    <MoreHorizontal className="w-5 h-5" />
                </button>

                {/* ── Panel glassmorphism ───────────────────────────── */}
                <AnimatePresence>
                    {isMoreOpen && (
                        <motion.div
                            key="more-dropdown"
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0,   scale: 1    }}
                            exit={{   opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                            className={cn(
                                'absolute right-0 top-full mt-2 z-[110]',
                                'w-64 rounded-2xl p-2',
                                'bg-slate-950/90 backdrop-blur-2xl',
                                'border border-slate-700/60',
                                'shadow-2xl shadow-black/60',
                            )}
                            style={{
                                // Delikatna poświata akcentu
                                boxShadow: '0 0 0 1px rgba(100,116,139,0.4), 0 25px 50px rgba(0,0,0,0.6)',
                            }}
                        >
                            {/* Nagłówek panelu */}
                            <div className="px-3 py-2 mb-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                                    Pozostałe moduły
                                </p>
                            </div>

                            {/* Pozycje */}
                            {MORE_NAV.map((item, idx) => {
                                const locked = !canAccess(item.id, tier);
                                return (
                                <motion.button
                                    key={item.id}
                                    onClick={() => { if (!locked) handleMoreItemClick(item.id); }}
                                    disabled={locked}
                                    title={locked ? `Odblokujesz na Filarze ${requiredPillar(item.id)}` : item.desc}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.045, duration: 0.18 }}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
                                        'text-sm font-medium transition-all duration-200 text-left',
                                        locked ? 'opacity-40 cursor-not-allowed text-slate-500' :
                                        activeView === item.id
                                            ? `bg-gradient-to-r ${theme.tw.bg} text-slate-900 shadow-md`
                                            : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                                    )}
                                >
                                    {/* Ikona */}
                                    <div className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                        activeView === item.id
                                            ? 'bg-black/20'
                                            : 'bg-slate-800/80'
                                    )}>
                                        <div className="w-4 h-4 flex items-center justify-center">{locked ? '🔒' : item.icon}</div>
                                    </div>

                                    {/* Tekst */}
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm leading-tight">
                                            {item.label}
                                        </span>
                                        <span className={cn(
                                            'text-[10px] leading-tight truncate',
                                            activeView === item.id ? 'text-black/60' : 'text-slate-500'
                                        )}>
                                            {item.desc}
                                        </span>
                                    </div>

                                    {/* Aktywny wskaźnik */}
                                    {activeView === item.id && (
                                        <motion.div
                                            layoutId="more-item-indicator"
                                            className="ml-auto w-1.5 h-1.5 rounded-full bg-current shrink-0"
                                        />
                                    )}
                                </motion.button>
                            );})}

                            {/* Separator */}
                            <div className="mx-3 my-2 h-px bg-slate-700/50" />

                            {/* Tryb Zen */}
                            <motion.button
                                onClick={() => { onToggleZen?.(); setIsMoreOpen(false); }}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: MORE_NAV.length * 0.045, duration: 0.18 }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-700/60 hover:text-white transition-all duration-200"
                            >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800/80 shrink-0">
                                    <EyeOff className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm leading-tight">Tryb Zen</span>
                                    <span className="text-[10px] text-slate-500 leading-tight">
                                        Ukryj interfejs — tylko sfera
                                    </span>
                                </div>
                            </motion.button>

                            {/* Dekoracyjny gradient u dołu panelu */}
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl bg-gradient-to-r from-transparent via-slate-600/40 to-transparent" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </nav>
    );
};

export default LoungeNavigation;
