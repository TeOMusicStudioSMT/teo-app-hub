import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import IntroDialog from './components/IntroDialog';
import QuantumGuardianAlert from './components/AnomalyNotification';
import TeonautLounge from './components/TeonautLounge';
import CosmicPortal from './components/CosmicPortal';
import SubscriptionActivator from './components/SubscriptionActivator';
import { Toaster, toast } from 'react-hot-toast';
import { GoogleGenAI } from '@google/genai';
import { useAtom, useSetAtom } from 'jotai';
import { projectsAtom, PROJECTS_STORAGE_KEY, addAdminIncidentAtom } from './store';
import { useBehavioralData } from './lib/hooks/useBehavioralData';
import { CosmicBackground } from './components/CosmicBackground';
import { TransactionData } from './types';
import { useAegisClient } from './hooks/useAegisClient';
import { protectiveModeAtom, essenceIdentityAtom } from './store/identity';
import { useEssenceIdentity } from './hooks/useEssenceIdentity';
import { UsernameClaimModal } from './components/identity/UsernameClaimModal';
import { ProtectiveModeModal } from './components/identity/ProtectiveModeModal';
import { VisualAssistant } from './components/VisualAssistant';
import { AnimatePresence, motion } from 'framer-motion';
import { AvatarSelectionModal } from './components/identity/AvatarSelectionModal';
import { autoConnectWalletAtom, walletAtom } from './store/wallet';
import { signInWithGoogle, signOut, subscribeToAuthChanges, signInWithEmail, signUpWithEmail, loginWithWallet } from './services/authService';
import { initializeUserInFirestore } from './services/firebaseService';
import { User } from 'firebase/auth';
import { useWeb3Auth } from './hooks/useWeb3Auth';
import { ApiKeyModal } from './components/settings/ApiKeyModal';
import { Secretariat } from './components/Secretariat';
import { GravitonProvider, useGraviton } from './context/GravitonProvider';


const App: React.FC = () => {
    const [showIntro, setShowIntro] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [isLoungeOpen, setIsLoungeOpen] = useState(false); // New state for lounge visibility
    const [anomaly, setAnomaly] = useState<string | null>(null);
    const [ai, setAi] = useState<GoogleGenAI | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [projects, setProjects] = useAtom(projectsAtom);
    const behavioralData = useBehavioralData();
    const addAdminIncident = useSetAtom(addAdminIncidentAtom);
    const api = useAegisClient();
    const setProtectiveState = useSetAtom(protectiveModeAtom);
    const { identity } = useEssenceIdentity();
    const riskLevel = identity?.coherence.riskLevel || 'LOW';
    const [isVisualAssistantOpen, setVisualAssistantOpen] = useState(false);
    const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const autoConnectWallet = useSetAtom(autoConnectWalletAtom);
    const setWallet = useSetAtom(walletAtom);
    const [secretariatState, setSecretariatState] = useState<{
        isOpen: boolean;
        onVerified?: (token: string) => void;
        onCancel?: () => void;
        actionName?: string;
    } | null>(null);

    // --- Real Auth State ---
    const [user, setUser] = useState<User | null>(null);
    const setEssenceIdentity = useSetAtom(essenceIdentityAtom);

    // --- Effects ---

    // 1. Monitor Authentication State
    useEffect(() => {
        const unsubscribe = subscribeToAuthChanges((currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    // 2. Handle authentication side effects & Firestore initialization
    useEffect(() => {
        if (user) {
            // Initialize user in Firestore (creates with Genesis Pack if new)
            initializeUserInFirestore(user)
                .then((userData) => {
                    // Auto-connect wallet with the authenticated email
                    autoConnectWallet(user.email || undefined);

                    // Update wallet balance from Firestore
                    setWallet(prev => ({
                        ...prev,
                        balance: userData.balance?.toString() || prev.balance,
                        tier: userData.tier || 'observer'
                    }));

                    // CRITICAL FIX: Update Identity State with FULL data from Firestore
                    // This includes both username AND companionName (assistantDomain)
                    setEssenceIdentity(prev => {
                        // If user already has identity data in Firestore, use it
                        if (userData.username && userData.companionName) {
                            return prev ? {
                                ...prev,
                                username: userData.username,
                                assistantDomain: userData.companionName
                            } : null;
                        }
                        // New user - keep identity null so UsernameClaimModal will open
                        return prev;
                    });
                })
                .catch((error) => {
                    console.error("Failed to initialize user in Firestore:", error);
                    // Fallback: still connect wallet with local data
                    autoConnectWallet(user.email || undefined);
                });
        }
    }, [user]); // Only run when user changes

    // 3. Init ready state after intro
    useEffect(() => {
        if (!showIntro) {
            const timer = setTimeout(() => setIsReady(true), 500); // Delay for intro fade-out
            return () => clearTimeout(timer);
        }
    }, [showIntro]);

    //4. Behavioral Tracking & Wallet Init
    useEffect(() => {
        if (user) {
            behavioralData.enable();
        } else {
            behavioralData.disable();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); // Only react to user changes, not behavioralData object


    // This effect runs whenever 'projects' state changes, saving it to localStorage
    useEffect(() => {
        try {
            const dataToStore = projects.map(({ id, isSubscribed, isFavorite }) => ({ id, isSubscribed, isFavorite }));
            localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (e: any) {
            console.error("Failed to save projects to localStorage", e);
        }
    }, [projects]);


    const handleStartJourney = () => {
        setShowIntro(false);
    };

    const handleLogin = async () => {
        try {
            await signInWithGoogle();
            setIsLoungeOpen(false); // Ensure user lands on the hub first
            toast.success('Identity Verified. Welcome back, TeOnaut.');
        } catch (error) {
            toast.error('Authentication failed.');
        }
    };

    const handleEmailLogin = async (email: string, password: string) => {
        try {
            await signInWithEmail(email, password);
            setIsLoungeOpen(false);
        } catch (error) {
            // Error handling is done in authService
        }
    };

    const handleEmailSignup = async (email: string, password: string) => {
        try {
            await signUpWithEmail(email, password);
            setIsLoungeOpen(false);
        } catch (error) {
            // Error handling is done in authService
        }
    };

    const { connect: connectWallet } = useWeb3Auth();

    const handleWalletLogin = async () => {
        try {
            const result = await connectWallet();
            if (result) {
                const { address, domainName } = result;
                await loginWithWallet(address, domainName);
                setIsLoungeOpen(false);
            }
        } catch (error) {
            // Error handling is done in hooks and authService
        }
    };

    const handleLogout = async () => {
        await signOut();
        setIsLoungeOpen(false);
        toast('Secure logout complete.');
    };

    const handleToggleLounge = () => {
        setIsLoungeOpen(prev => !prev);
    }

    const proceedWithSubscription = (projectId: string) => {
        setProjects(prevProjects =>
            prevProjects.map(p =>
                p.id === projectId ? { ...p, isSubscribed: !p.isSubscribed } : p
            )
        );
        toast.success('Transaction Secure. Mission Complete!', { duration: 4000 });
    }

    const handleSubscriptionToggle = (projectId: string) => {
        const projectDetails = projects.find(p => p.id === projectId);
        if (!projectDetails) return;

        const txData = {
            amount: projectDetails.isSubscribed ? 0 : (['graviton.wif', 'teoblockchain.studio'].includes(projectId) ? (Math.random() > 0.5 ? 9500 : 150) : 50),
            recipientId: projectId,
            currency: projectDetails.currency || 'GRV',
        };

        runAegisQValidation(txData, () => proceedWithSubscription(projectId));
    };


    const handleFavoriteToggle = (projectId: string) => {
        let projectName = '';
        let isNowFavorite = false;
        setProjects(prevProjects =>
            prevProjects.map(p => {
                if (p.id === projectId) {
                    projectName = p.name;
                    isNowFavorite = !p.isFavorite;
                    return { ...p, isFavorite: !p.isFavorite };
                }
                return p;
            })
        );
        toast(`${projectName} ${isNowFavorite ? 'added to' : 'removed from'} favorites.`, { icon: '⭐' });
    };

    const runAegisQValidation = async (txData: Omit<TransactionData, 'senderId' | 'transactionId'>, onSuccess: () => void) => {
        if (isGenerating) return;
        setIsGenerating(true);

        const toastId = 'aegis-q-toast';

        // --- SECRETARIAT INTEGRATION (Bot Test Module) ---
        setSecretariatState({
            isOpen: true,
            actionName: txData.recipientId === 'system_integrity_check' ? "SYSTEM_SCAN" : `TRANSACTION: ${txData.amount} ${txData.currency}`,
            onVerified: async (token) => {
                setSecretariatState(null);
                toast.loading('Initializing Quantum Secure Transaction...', { id: toastId });
                try {
                    const result = await api.validateTransaction(txData);
                    handleValidationResult(result, onSuccess, toastId);
                } catch (e) {
                    console.error("Error during Aegis-Q validation:", e);
                    toast.error('Aegis-Q system malfunction.', { id: toastId });
                } finally {
                    setIsGenerating(false);
                }
            },
            onCancel: () => {
                setSecretariatState(null);
                setIsGenerating(false);
                toast.error('Transaction Aborted by Secretariat.');
            }
        });
    };

    const handleValidationResult = (result: any, onSuccess: () => void, toastId: string) => {
        if (result.status === 'BLOCKED') {
            toast.error(`Threat Detected! ${result.reason}`, { id: toastId, duration: 5000 });
            setAnomaly(`Quantum Guardian neutralized threat. Report ID: ${result.reportId?.substring(0, 8)}`);

            addAdminIncident({
                userId: user?.email || 'Teonaut_Unknown',
                incidentType: 'anomalous transaction',
                confidenceScore: 95,
            });

            // Activate Protective Mode
            setProtectiveState({
                isOpen: true,
                reportId: result.reportId,
                onConfirm: () => {
                    toast("Retrying transaction after security delay...", { icon: '⏳' });
                    setTimeout(() => {
                        onSuccess(); // Retry the transaction
                    }, 2000);
                }
            });

            setTimeout(() => setAnomaly(null), 8000);
        } else if (result.status === 'APPROVED') {
            toast.dismiss(toastId);
            onSuccess(); // Directly call the success callback
        } else { // REVIEW case
            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-amber-500/50`}>
                    <div className="flex-1 w-0 p-4">
                        <p className="font-bold text-amber-300">Transaction Under Review</p>
                        <p className="mt-1 text-sm text-slate-300">{result.reason}</p>
                    </div>
                </div>
            ), { id: toastId, duration: 6000 });
        }
    };
    const handleSystemScan = () => {
        const dummyTx = {
            amount: Math.random() > 0.7 ? 6000 : 20, // 30% chance of anomaly
            recipientId: 'system_integrity_check',
            currency: 'GRV' as const,
        };
        runAegisQValidation(dummyTx, () => {
            toast.success("System scan complete. No threats found.");
        });
    };

    return (
        <GravitonProvider>
            <div className="relative w-screen h-screen flex flex-col items-center justify-center overflow-hidden">
                <CosmicBackground riskLevel={riskLevel} />
                <div className="relative z-10 w-full h-full flex flex-col">
                    <Header
                        isVisible={isReady}
                        isAuthenticated={!!user}
                        isLoungeOpen={isLoungeOpen}
                        onLogin={handleLogin}
                        onLogout={handleLogout}
                        onToggleLounge={handleToggleLounge}
                        onOpenSettings={() => setApiKeyModalOpen(true)}
                    />

                <main className="w-full h-full">
                    {/* Always render Portal, animation handled inside */}
                    <AnimatePresence mode="wait">
                        {!user && (
                            <motion.div
                                key="portal-guest"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8 }}
                                className="w-full h-full"
                            >
                                <CosmicPortal onLoginRequest={handleLogin} onEmailLogin={handleEmailLogin} onEmailSignup={handleEmailSignup} onWalletLogin={handleWalletLogin} />
                            </motion.div>
                        )}
                        {user && (
                            isLoungeOpen
                                ? (
                                    <motion.div
                                        key="lounge"
                                        className="w-full h-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <TeonautLounge onSubscriptionToggle={handleSubscriptionToggle} onFavoriteToggle={handleFavoriteToggle} onTriggerAnomaly={handleSystemScan} onLogout={handleLogout} behavioralData={behavioralData} onVisualAssistantOpen={() => setVisualAssistantOpen(true)} />
                                    </motion.div>
                                )
                                : (
                                    <motion.div
                                        key="portal-auth"
                                        className="w-full h-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <CosmicPortal onLoginRequest={handleLogin} onEmailLogin={handleEmailLogin} onEmailSignup={handleEmailSignup} onWalletLogin={handleWalletLogin} isAuthenticated={true} onVisualAssistantOpen={() => setVisualAssistantOpen(true)} />
                                    </motion.div>
                                )
                        )}
                    </AnimatePresence>
                </main>

                <IntroDialog isVisible={showIntro} onStart={handleStartJourney} />
                {user && !identity?.username && <UsernameClaimModal />}
                {user && <AvatarSelectionModal />}
                <ProtectiveModeModal />

                <AnimatePresence>
                    {isVisualAssistantOpen && (
                        <VisualAssistant onClose={() => setVisualAssistantOpen(false)} />
                    )}
                </AnimatePresence>

                {/* API Key Settings Modal */}
                <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />

                {anomaly && <QuantumGuardianAlert message={anomaly} onClose={() => setAnomaly(null)} />}

                <Toaster
                    position="bottom-right"
                    toastOptions={{
                        style: {
                            background: 'rgba(9, 10, 15, 0.8)',
                            color: '#e2e8f0',
                            border: '1px solid #0891b2',
                            backdropFilter: 'blur(10px)',
                        },
                        success: {
                            iconTheme: {
                                primary: '#10b981',
                                secondary: '#0f172a',
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: '#f43f5e',
                                secondary: '#0f172a',
                            },
                        },
                    }}
                />
                <SubscriptionActivator />

                <AnimatePresence>
                    {secretariatState?.isOpen && (
                        <Secretariat
                            onVerified={secretariatState.onVerified!}
                            onCancel={secretariatState.onCancel!}
                            actionName={secretariatState.actionName}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
        </GravitonProvider>
    );
};

export default App;
