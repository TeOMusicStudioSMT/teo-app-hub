import React from 'react';
import { ChartBarIcon, AppIcon, UserCircleIcon, MortarBoardIcon, ShieldCheckIcon, MarketIcon, WalletIcon, BrainChipIcon, TrophyIcon } from './icons';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { cn } from '../lib/helpers';

type View = 'dashboard' | 'projects' | 'teo-market' | 'identity' | 'academy' | 'field-control' | 'profile' | 'graviton-wallet' | 'cobots' | 'crew-club';

interface LoungeNavigationProps {
    activeView: View;
    onViewChange: (view: View) => void;
}

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <ChartBarIcon /> },
    { id: 'projects', label: 'Universes', icon: <AppIcon /> },
    { id: 'crew-club', label: '🏆 Klub', icon: <TrophyIcon /> },
    { id: 'teo-market', label: 'TeO Market', icon: <MarketIcon /> },
    { id: 'graviton-wallet', label: 'GRAVITON Wallet', icon: <WalletIcon /> },
    { id: 'identity', label: 'Identity', icon: <UserCircleIcon /> },
    { id: 'cobots', label: '🤖 Co-Bots', icon: <BrainChipIcon /> },
    { id: 'academy', label: 'Academy', icon: <MortarBoardIcon /> },
    { id: 'field-control', label: 'Field Control', icon: <ShieldCheckIcon /> },
];

export const LoungeNavigation: React.FC<LoungeNavigationProps> = ({ activeView, onViewChange }) => {
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    return (
        <nav className="mb-6 w-full max-w-5xl mx-auto flex items-center justify-center space-x-1 md:space-x-2 p-2 bg-slate-900/60 border border-slate-700/50 rounded-full backdrop-blur-lg">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => onViewChange(item.id as View)}
                    className={cn(
                        'relative flex-1 md:flex-none flex items-center justify-center space-x-3 px-3 py-2 rounded-full text-sm font-bold transition-all duration-300',
                        activeView === item.id 
                        ? `${theme.tw.bg} text-slate-900 shadow-lg ${theme.tw.shadow}` 
                        : 'bg-transparent text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    )}
                >
                    <div className="w-5 h-5">{item.icon}</div>
                    <span className="hidden md:inline">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};
