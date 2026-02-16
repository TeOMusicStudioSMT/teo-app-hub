import React from 'react';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { cn } from '../lib/helpers';

interface DashboardCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, icon, children, className = '' }) => {
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    return (
        <div className={cn(
            'bg-slate-900/60 border rounded-3xl shadow-2xl shadow-black/40 backdrop-blur-2xl p-6 flex flex-col h-full',
            theme.tw.border,
            className
        )}>
            <div className={cn("flex items-center mb-4", theme.tw.text)}>
                <div className={cn("w-7 h-7 mr-3", theme.tw.dropShadow)}>{icon}</div>
                <h3 className={cn("text-xl font-bold tracking-wider uppercase", theme.tw.dropShadow.replace('8px', '4px'))}>{title}</h3>
            </div>
            <div className="flex-grow text-slate-300">
                {children}
            </div>
        </div>
    );
};

export default DashboardCard;
