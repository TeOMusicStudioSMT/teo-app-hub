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
import TeoLab from './special/TeoLab';
import OtakosRobotics from './special/OtakosRobotics';
import { GravitonWalletView } from './GravitonWalletView';
import { useAssistant } from '../hooks/useAssistant';
import { InstallPWA } from './InstallPWA';
import { CoBotDashboard } from './special/CoBotFactory';
import { CrewCreator } from './special/CrewCreator';
import { TeO_Orb, AromaType } from './TeO_Orb';
import { IdentityCard, CoreStatusPanel } from './IdentityCard';
import { logLoungeActivity, registerConsciousnessActivity, initializeSphereIdentity } from '../lib/memory/CityMemory';
import { Mic, MicOff } from 'lucide-react';

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
    onOpenCrewClub?: () => void;
}

type View = 'dashboard' | 'projects' | 'teo-market' | 'identity' | 'academy' | 'field-control' | 'profile' | 'graviton-wallet' | 'cobots' | 'crew-club' | 'teolab' | 'robotics';

export const TeonautLounge: React.FC<TeonautLoungeProps> = ({ onSubscriptionToggle, onFavoriteToggle, onLogout, onTriggerAnomaly, behavioralData, onVisualAssistantOpen, onOpenCrewClub }) => {
    const [staticBalance] = useState(3975.78);
    const [activeView, setActiveView] = useState<View>('dashboard');
    const [isHudVisible, setIsHudVisible] = useState(true);
    const [activeAroma, setActiveAroma] = useState<AromaType>('default');
    const [orbListening, setOrbListening] = useState(false);
    // 🟣 Sfera Głosowa — domyślnie schowana; toggle przyciskiem MIC
    const [isVoiceModuleOpen, setIsVoiceModuleOpen] = useState(false);
    const wallet = useAtomValue(walletAtom);
    const { identity } = useEssenceIdentity();
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];
    const autoConnectWallet = useSetAtom(autoConnectWalletAtom);
    const { triggerWelcome } = useAssistant();

    const handleViewChange = (view: View) => {
        if (view === 'crew-club' && onOpenCrewClub) {
            onOpenCrewClub();
            return;
        }
        logLoungeActivity(view);
        setActiveView(view);
    };

    const balance = wallet.balance ? parseFloat(wallet.balance) : staticBalance;
    const frequencyTier = wallet.frequencyTier;

    const formattedBalance = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(balance);

    const localTeonauta = JSON.parse(localStorage.getItem('teonauta_data') || '{}');
    const welcomeMessage = identity?.username 
        ? `@${identity.username}` 
        : (localTeonauta.name ? `Witaj, ${localTeonauta.name}` : 'Welcome, TeOnaut');

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

    // Inicjalizacja Karty Tożsamości Sfery
    useEffect(() => {
        initializeSphereIdentity();
    }, []);

    return (
        // GORGOO FIX: Używamy 'absolute inset-0', aby uniezależnić się od wysokości rodzica.
        // To wymusza, że ten DIV zajmie cały ekran i będzie miał własny scrollbar.
        // 'z-0' upewnia się, że jest pod innymi elementami fixed (jak modale).
        <div className="absolute inset-0 w-full h-full p-4 md:p-8 pt-24 pb-40 text-slate-100 overflow-y-auto animate-[fade-in_1s_ease-out] z-0">
            <div className="max-w-7xl mx-auto relative">

                {isHudVisible && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -20 }}
                        className="w-full"
                    >
                        {/* Top Section - Header */}
                        <div className={cn("flex flex-col gap-6 mb-8 p-6 bg-slate-900/60 border rounded-3xl shadow-2xl transition-all duration-500", theme.tw.border)}>

                            {/* Górna belka: Avatar + Powitanie + Saldo */}
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 w-full">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-16 h-16", theme.tw.text)}>
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

                                {/* Saldo */}
                                <div className="text-center md:text-right">
                                    <p className={cn("text-5xl font-bold", theme.tw.text)}>
                                        {formattedBalance} <span className="text-3xl font-light text-slate-300">GRV</span>
                                    </p>
                                </div>
                            </div>

                            <div className="w-full border-t border-slate-700/30 pt-4">
                                <CryptoTicker />
                            </div>
                        </div>

                        <LoungeNavigation 
                            activeView={activeView} 
                            onViewChange={handleViewChange} 
                            onToggleZen={() => setIsHudVisible(false)}
                        />
                    </motion.div>
                )}

                {/* ── Sfera Głosowa JESTEM — chowana/wysuwana przyciskiem MIC ── */}
                <AnimatePresence>
                    {isVoiceModuleOpen && (
                        <motion.div
                            key="voice-module"
                            initial={{ opacity: 0, scale: 0.82, y: -20 }}
                            animate={{ opacity: 1, scale: 1,   y: 0  }}
                            exit={{   opacity: 0, scale: 0.82, y: -20 }}
                            transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                            className="flex justify-center my-6 gap-6 items-start overflow-hidden"
                        >
                            <TeO_Orb
                                activeAroma={activeAroma}
                                isListening={orbListening}
                                onMessage={(msg, aroma) => {
                                    setActiveAroma(aroma);
                                    setOrbListening(true);
                                    setTimeout(() => setOrbListening(false), 2000);
                                }}
                            />
                            {isHudVisible && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="w-64 hidden lg:block"
                                >
                                    <CoreStatusPanel />
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {isHudVisible && (
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
                            {activeView === 'cobots' && <CoBotDashboard />}
                            {activeView === 'crew-club' && <div className="text-center py-20 text-slate-500 italic">Ładowanie Kokpitu Mistrzów...</div>}
                            {activeView === 'academy' && <QuantumCompass />}
                            {activeView === 'field-control' && <FieldControlView />}
                            {activeView === 'teolab' && <TeoLab />}
                            {activeView === 'robotics' && <OtakosRobotics />}
                            {activeView === 'profile' && <ProfileView onLogout={onLogout} />}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── 🟣 FAB: Toggle Sfery Głosowej JESTEM ───────────────────── */}
                {isHudVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.7, y: 20 }}
                        animate={{ opacity: 1, scale: 1,   y: 0  }}
                        transition={{ delay: 0.6, duration: 0.4, ease: 'backOut' }}
                        className="fixed bottom-10 right-6 z-[3000]"
                    >
                        <motion.button
                            onClick={() => setIsVoiceModuleOpen(prev => !prev)}
                            whileHover={{ scale: 1.07 }}
                            whileTap={{ scale: 0.92 }}
                            className={cn(
                                'flex items-center gap-2.5 px-4 py-2.5 rounded-full backdrop-blur-xl',
                                'font-semibold text-sm shadow-2xl transition-colors duration-300 border',
                                isVoiceModuleOpen
                                    ? 'bg-purple-900/70 border-purple-400/60 text-purple-200 shadow-[0_0_28px_rgba(147,51,234,0.55)]'
                                    : 'bg-slate-900/70 border-purple-500/25 text-slate-400 hover:border-purple-400/50 hover:text-purple-300'
                            )}
                        >
                            {/* Ikona MIC z animacją */}
                            <motion.span
                                key={String(isVoiceModuleOpen)}
                                initial={{ scale: 0.6, rotate: -15 }}
                                animate={{ scale: 1,   rotate: 0   }}
                                transition={{ duration: 0.25, ease: 'backOut' }}
                            >
                                {isVoiceModuleOpen
                                    ? <MicOff className="w-4 h-4 text-purple-300" />
                                    : <Mic    className="w-4 h-4" />}
                            </motion.span>

                            <span>{isVoiceModuleOpen ? 'Ukryj Sferę' : 'Sfera JESTEM'}</span>

                            {/* Pulsujący wskaźnik aktywności */}
                            {isVoiceModuleOpen && (
                                <motion.span
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                    className="w-2 h-2 rounded-full bg-purple-400 shrink-0"
                                />
                            )}
                        </motion.button>
                    </motion.div>
                )}

                {/* Return from Zen Button */}
                {!isHudVisible && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[3000]"
                    >
                        <button 
                            onClick={() => setIsHudVisible(true)}
                            className="px-8 py-3 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/50 rounded-full text-cyan-300 font-bold hover:bg-cyan-900/40 transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse"
                        >
                            [ POKAŻ INTERFEJS ]
                        </button>
                    </motion.div>
                )}

                {/* Przycisk instalacji */}
                {isHudVisible && <InstallPWA />}

                {isHudVisible && (
                    <div className="mt-12 text-center text-slate-600 text-xs uppercase tracking-widest opacity-50">
                        TeO System OS v2.1 • UZ$ Protocol Active
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeonautLounge;