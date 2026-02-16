import React, { useState, useEffect } from 'react';
import { SplitText } from './react_bits/SplitText';
import { CryptoTicker } from './CryptoTicker';
import { UserCircleIcon, MarketIcon } from './icons';
import { LoungeNavigation } from './LoungeNavigation';
import { DashboardView } from './DashboardView';
import { ProjectsView } from './ProjectsView';
import { ProfileView } from './ProfileView';
import { QuantumCompass } from './education/QuantumCompass';
import { IdentityDashboard } from './identity/IdentityDashboard';
import { useAtomValue, useSetAtom } from 'jotai';
import { walletAtom, autoConnectWalletAtom } from '../store/wallet';
import { useEssenceIdentity } from '../hooks/useEssenceIdentity';
import { motion, AnimatePresence } from 'framer-motion';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { cn } from '../lib/helpers';
import { FieldControlView } from './FieldControlView';
import DashboardCard from './DashboardCard';
import { MarketTabView } from './MarketTabView';
import { GravitonWalletView } from './GravitonWalletView';
import { useAssistant } from '../hooks/useAssistant';
import { InstallPWA } from './InstallPWA';

type BehavioralDataProps = {
    isAnalyzing: boolean;
    analysisStatus: string;
    sendAndAnalyzeData: (userId: string) => Promise<void>;
    enable: () => void;
    disable: () => void;
};

interface TeonautLoungeProps {
    onSubscriptionToggle: (id: string) => void;
    onFavoriteToggle: (id: string) => void;
    onTriggerAnomaly: () => void;
    onLogout: () => void;
    behavioralData: BehavioralDataProps;
    onVisualAssistantOpen: () => void;
}

type View = 'dashboard' | 'projects' | 'teo-market' | 'identity' | 'academy' | 'field-control' | 'profile' | 'graviton-wallet';

export const TeonautLounge: React.FC<TeonautLoungeProps> = ({ onSubscriptionToggle, onFavoriteToggle, onLogout, onTriggerAnomaly, behavioralData, onVisualAssistantOpen }) => {
    const [staticBalance] = useState(3975.78);
    const [activeView, setActiveView] = useState<View>('dashboard');
    const wallet = useAtomValue(walletAtom);
    const { identity } = useEssenceIdentity();
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];
    const autoConnectWallet = useSetAtom(autoConnectWalletAtom);
    const { triggerWelcome } = useAssistant();

    const balance = wallet.balance ? parseFloat(wallet.balance) : staticBalance;
    const frequencyTier = wallet.frequencyTier;

    const formattedBalance = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(balance);

    const welcomeMessage = identity?.username ? `@${identity.username}` : 'Welcome, TeOnaut';

    const frequencyClasses = {
        'Low': 'text-slate-300',
        'Medium': theme.tw.text,
        'High': theme.tw.text,
        'Superposition': 'superposition-text'
    };

    const balanceColorClass = frequencyClasses[frequencyTier] || 'text-slate-300';

    useEffect(() => {
        if (identity?.username) {
            autoConnectWallet(identity.username);
        }
    }, [identity?.username, autoConnectWallet]);

    useEffect(() => {
        if (identity?.username) {
            const t = setTimeout(() => {
                triggerWelcome();
            }, 1500);
            return () => clearTimeout(t);
        }
    }, [identity?.username, triggerWelcome]);

    return (
        // GORGOO FIX: Używamy 'absolute inset-0', aby uniezależnić się od wysokości rodzica.
        // To wymusza, że ten DIV zajmie cały ekran i będzie miał własny scrollbar.
        // 'z-0' upewnia się, że jest pod innymi elementami fixed (jak modale).
        <div className="absolute inset-0 w-full h-full p-4 md:p-8 pt-24 pb-40 text-slate-100 overflow-y-auto animate-[fade-in_1s_ease-out] z-0">
            <div className="max-w-7xl mx-auto relative">

                {/* Top Section - Header */}
                <div className={cn("flex flex-col gap-6 mb-8 p-6 bg-slate-900/60 border rounded-3xl shadow-2xl...", theme.tw.border)}>

                    {/* Górna belka: Avatar + Powitanie + Saldo */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 w-full">
                        <div className="flex items-center gap-4">
                            <div className={cn("w-16 h-16...", theme.tw.text)}>
                                <UserCircleIcon />
                            </div>
                            <div>
                                <SplitText
                                    text={welcomeMessage}
                                    className="text-2xl font-bold text-white"
                                    delay={0.2}
                                />
                                <p className="text-slate-400 mt-1">All systems are nominal.</p>
                            </div>
                        </div>

                        {/* Saldo - bez zmian */}
                        <div className="text-center md:text-right">
                            {/* ... kod salda ... */}
                            <p className={cn("text-5xl font-bold", theme.tw.text)}>
                                {formattedBalance} <span className="text-3xl font-light text-slate-300">GRV</span>
                            </p>
                        </div>
                    </div>

                    {/* 👇 TU WSTAWIAMY NOWY WIDGET Z API 👇 */}
                    <div className="w-full border-t border-slate-700/30 pt-4">
                        <CryptoTicker />
                    </div>

                </div>



                <LoungeNavigation activeView={activeView} onViewChange={setActiveView} />

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeView}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                        {activeView === 'dashboard' && <DashboardView onTriggerAnomaly={onTriggerAnomaly} behavioralData={behavioralData} onVisualAssistantOpen={onVisualAssistantOpen} />}
                        {activeView === 'projects' && <ProjectsView onSubscriptionToggle={onSubscriptionToggle} onFavoriteToggle={onFavoriteToggle} />}
                        {activeView === 'teo-market' && (
                            <DashboardCard title="TeO Market" icon={<MarketIcon />}>
                                <MarketTabView />
                            </DashboardCard>
                        )}
                        {activeView === 'graviton-wallet' && <GravitonWalletView />}
                        {activeView === 'identity' && <IdentityDashboard />}
                        {activeView === 'academy' && <QuantumCompass />}
                        {activeView === 'field-control' && <FieldControlView />}
                        {activeView === 'profile' && <ProfileView onLogout={onLogout} />}
                    </motion.div>
                </AnimatePresence>

                {/* Przycisk instalacji */}
                <InstallPWA />

                <div className="mt-12 text-center text-slate-600 text-xs uppercase tracking-widest opacity-50">
                    TeO System OS v2.1 • UZ$ Protocol Active
                </div>
            </div>
        </div>
    );
};

export default TeonautLounge;