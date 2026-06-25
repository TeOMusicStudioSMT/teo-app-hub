import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TeOGenesis from './components/special/TeOGenesis';
import QuantumGuardianAlert from './components/AnomalyNotification';
import TeonautLounge from './components/TeonautLounge';
import CosmicPortal from './components/CosmicPortal';
import Onboarding from './components/Onboarding';
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
import { useResonance } from './hooks/useResonance';
import { AnimatePresence, motion } from 'framer-motion';
import { AvatarSelectionModal } from './components/identity/AvatarSelectionModal';
import { autoConnectWalletAtom, walletAtom } from './store/wallet';
import { signInWithGoogle, signOut, subscribeToAuthChanges, signInWithEmail, signUpWithEmail, loginWithWallet } from './services/authService';
import { applyAccountRole } from './lib/roles';
import { initializeUserInFirestore } from './services/firebaseService';
import { User } from 'firebase/auth';
import { useWeb3Auth } from './hooks/useWeb3Auth';
import { ApiKeyModal } from './components/settings/ApiKeyModal';
import { Secretariat } from './components/Secretariat';
import { GravitonProvider, useGraviton } from './context/GravitonProvider';
import { TeOKibel } from './components/special/TeOKibel';
import { CrewCreator } from './components/special/CrewCreator';
import TeODash from './components/special/TeODash';
import { initializeKwantowaKotwica } from './lib/KwantowaKotwica';
import OtakOSGateway from './components/special/OtakOSGateway';
import { RadaPodstawowa } from './components/special/RadaPodstawowa';
import { WniosekO } from './components/special/WniosekO';
import ScenographyManager from './components/special/ScenographyManager';
import { hasPioneerBypass } from './lib/SovereignGovernance';
import { startHeartBeat } from './lib/wir26heartbeat';
import { initializeKibel, flushKibel } from './lib/kibel';
import { setSystemReady } from './lib/memory/CityMemory';
import PathwaySelector from './components/special/PathwaySelector';
import QuantumJournal from './components/special/QuantumJournal';
import { BookIcon } from './components/icons';
import { KatedraRadioPlayer } from './components/KatedraRadioPlayer';
import { TestKoherencji } from './components/special/TestKoherencji';
import KwantowaCzytelnia from './components/KwantowaCzytelnia';
import AutoPanicSentinel from './components/special/AutoPanicSentinel';
import NotebookTwinPanel from './components/special/NotebookTwinPanel';
import SimulationDashboard from './components/special/SimulationDashboard';
import TeoLab from './components/special/TeoLab';



const App: React.FC = () => {
    const [isInitiated, setIsInitiated] = useState(false);
    const [showIntro, setShowIntro] = useState(false);
    const [showGenesis, setShowGenesis] = useState(false); // TeOGenesis - suwerenna brama
    const [isPioneer, setIsPioneer] = useState(true);
    const [isReady, setIsReady] = useState(true);
    const [isLoungeOpen, setIsLoungeOpen] = useState(true); // New state for lounge visibility
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
    const [showRada, setShowRada] = useState(false);
    const { resonance, isRadaUnlocked } = useResonance();
    const autoConnectWallet = useSetAtom(autoConnectWalletAtom);
    const setWallet = useSetAtom(walletAtom);
    const [secretariatState, setSecretariatState] = useState<{
        isOpen: boolean;
        onVerified?: (token: string) => void;
        onCancel?: () => void;
        actionName?: string;
    } | null>(null);


    // --- Kibel State ---
    const [showKibel, setShowKibel] = useState(false);
    const [showCrewClub, setShowCrewClub] = useState(false); // 🏆 Klub Mistrzów
    const [showTeODash, setShowTeODash] = useState(false); // ⚙️ TeODash
    const [showWniosekO, setShowWniosekO] = useState(false);
    const [showScenography, setShowScenography] = useState(false);
    const [showJournal, setShowJournal] = useState(false); // 📓 Kwantowy Dziennik
    const [showPodcast, setShowPodcast] = useState(false); // 🎙️ Podcast Twin
    const [showTeoSim, setShowTeoSim] = useState(false); // 🧠 TeO-Sim Reasoning Loops
    const [showLab, setShowLab] = useState(false); // 🧪 TeO Lab (Agro + RadioSMT)
    const [isWiesioOnline, setIsWiesioOnline] = useState<boolean | null>(null);

    // --- Real Auth State ---
    const [user, setUser] = useState<User | null>(null);
    // Suwerenne wejście lokalne — tożsamość z identity.json, Firebase opcjonalny.
    const [sovereignLocal, setSovereignLocal] = useState<boolean>(() => localStorage.getItem('otakos_sovereign_local') === 'true');
    const handleEnterSovereign = () => { localStorage.setItem('otakos_sovereign_local', 'true'); setSovereignLocal(true); };
    // Onboarding (pogawędka + głos) na pierwszym wejściu.
    const [onboarded, setOnboarded] = useState<boolean>(() => localStorage.getItem('otakos_onboarded') === '1');
    const setEssenceIdentity = useSetAtom(essenceIdentityAtom);

    // --- Pathway State (Duch / Materia) ---
    const [selectedPathway, setSelectedPathway] = useState<'duch' | 'materia' | null>('duch');
    const [showPathwaySelector, setShowPathwaySelector] = useState(false);

    // ── KWANTOWA CZYTELNIA — Most Danych ─────────────────────────────────────────
    // Nasłuchuje na teo_active_story w localStorage (wypełniane przez WydawnictwoForge).
    // Gdy klucz jest obecny, przysłania cały interfejs pełnoekranową Czytelnią.
    const [activeStory, setActiveStory] = useState<string | null>(() =>
        localStorage.getItem('teo_active_story')
    );

    // --- PIONEER BYPASS - NATYCHMIAST do Lounge ---
    useEffect(() => {
        // Sprawdź czy Pioneer #1 (po auth lub localStorage)
        const checkPioneer = () => {
            const isPioneerUser = user?.email === 'arkadiusz.szczepaniak@gmail.com';
            const pioneerBypass = localStorage.getItem('pioneer_bypass_enabled') === 'true';

            if (isPioneerUser || pioneerBypass) {
                console.log('%c🚀 PIONEER #1 W BUDYNKU - NATYCHMIAST DO LOUNGE!', 'color: #10b981; font-weight: bold; font-size: 14px;');
                setIsPioneer(true);
                setShowGenesis(false);
                setShowIntro(false);
                setIsLoungeOpen(true);
                setIsReady(true);
            }
        };

        if (user) {
            checkPioneer();
        }
    }, [user]);

    // --- Effects ---

    // 1. Monitor Authentication State
    useEffect(() => {
        const unsubscribe = subscribeToAuthChanges((currentUser) => {
            setUser(currentUser);
            // 🔐 Rola konta → Filar + tożsamość (TeO „łączy" / Mistrz Arkadiusz / węzeł).
            if (currentUser?.email) {
                const role = applyAccountRole(currentUser.email);
                console.log(`[Role] ${role.label} · Filar: ${role.tier} · ingerencja w system: ${role.canInterfereSystem}`);
            }
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
                        // ALE - Pioneer #1 ma bypass!
                        if (hasPioneerBypass(user.email)) {
                            return null; // Nie wymagaj username dla Pioneera
                        }
                        return prev;
                    });

                    // Dla Pioneera #1 automatycznie otwórz Lounge
                    if (hasPioneerBypass(user.email)) {
                        console.log('[FLASH BOB] 🚀 Pioneer #1 detected - Auto-opening Lounge');
                        setIsLoungeOpen(true);
                    }
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

    // 5. Uruchom tętno Wiru 26 i sprawdź Kibel
    useEffect(() => {
        console.log('[FLASH BOB] 🫀 Inicjacja tętna Wiru 26...');

        // Sprawdź czy to tryb Ducha (bez logowania)
        const isDuchMode = localStorage.getItem('pathway_duch_mode') === 'true';

        // 🌊 KROK 1: Kwantowa Kotwica (Absolutny Start)
        const isDuch = localStorage.getItem('pathway_duch_mode') === 'true';
        const isMateria = localStorage.getItem('pathway_materia_mode') === 'true';
        const path = isDuch ? 'duch' : isMateria ? 'materia' : null;

        if (path) {
            console.log(`[FLASH BOB] ⚓ Wczesna Inicjalizacja Kotwicy (${path})`);
            initializeKwantowaKotwica('anonymous', path as 'duch' | 'materia');
        }

        // 🔄 Initialize Kibel with fallback
        const kibelStatus = initializeKibel();
        console.log('[App] Kibel status:', kibelStatus);

        // 🔄 Sprawdź rury i ustaw SYSTEM_READY
        const flushResult = flushKibel();
        if (flushResult.systemReady || isDuchMode) {
            console.log('[App] 🔐 SYSTEM_READY = TRUE');
            // W trybie Ducha - nie wymagaj pełnej struktury tożsamości
            if (isDuchMode) {
                console.log('[App] 🌙 Tryb Ducha - pomijam pełną inicjalizację tożsamości');
                setSystemReady(true);
            } else {
                setSystemReady(true);
            }
        }

        // Uruchom tętno
        startHeartBeat(30000); // Co 30 sekund
    }, []);

    // 5a. KWANTOWA CZYTELNIA — nasłuchiwacz mostów danych
    useEffect(() => {
        // Aktywuj Czytelnię gdy WydawnictwoForge wyzwoli event
        const onStoryReady = () => {
            const story = localStorage.getItem('teo_active_story');
            if (story) setActiveStory(story);
        };

        // Obsługa cross-tab (gdy Wydawnictwo jest w innej karcie)
        const onStorageChange = (e: StorageEvent) => {
            if (e.key === 'teo_active_story') {
                if (e.newValue) {
                    setActiveStory(e.newValue);
                } else {
                    setActiveStory(null); // klucz wyczyszczony — zamknij Czytelnię
                }
            }
        };

        window.addEventListener('story_ready', onStoryReady);
        window.addEventListener('storage', onStorageChange);
        return () => {
            window.removeEventListener('story_ready', onStoryReady);
            window.removeEventListener('storage', onStorageChange);
        };
    }, []);

    /** Zamknięcie Czytelni — czyści klucz i wraca do normalnego widoku */
    const handleCzytelniaClosed = () => {
        localStorage.removeItem('teo_active_story');
        setActiveStory(null);
    };

    // 5b. STRAŻNIK WYMIARÓW: Sprawdź czy Wiesio (Local Bridge) żyje
    useEffect(() => {
        const checkWiesio = async () => {
            try {
                const res = await fetch('http://127.0.0.1:3001/wiesio/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'PING' })
                });
                const data = await res.json();
                if (data.status === 'AHOJ') {
                    console.log('%c[Strażnik] 🟢 Wymiar 0.00G Stabilny. WIESIO obecny.', 'color: #22d3ee; font-weight: bold;');
                    setIsWiesioOnline(true);
                } else {
                    setIsWiesioOnline(false);
                }
            } catch (e) {
                console.warn('[Strażnik] 🔴 Lokalny Most WIESIA przerwany. Inicjacja Testu Koherencji.');
                setIsWiesioOnline(false);
            }
        };
        checkWiesio();
    }, []);

    // 6. Przywróć Kotwicę (Vault Identity) po odświeżeniu
    useEffect(() => {
        const isDuch = localStorage.getItem('pathway_duch_mode') === 'true';
        const isMateria = localStorage.getItem('pathway_materia_mode') === 'true';
        const path = isDuch ? 'duch' : isMateria ? 'materia' : null;

        if (path) {
            const userId = user?.email || 'anonymous';
            console.log(`[FLASH BOB] ⚓ Przywracanie Kotwicy (${path}) dla: ${userId}`);
            initializeKwantowaKotwica(userId, path as 'duch' | 'materia');
        }
    }, [user]);


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
            // Dla Pioneera #1 automatycznie otwórz Lounge
            const email = (window as any)?.firebase?.auth()?.currentUser?.email;
            if (hasPioneerBypass(email)) {
                setIsLoungeOpen(true);
            } else {
                setIsLoungeOpen(false); // Ensure user lands on the hub first
            }
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
        setSelectedPathway(null);
        setShowPathwaySelector(true);
        toast('Secure logout complete.');
    };

    // --- Handler wyboru ścieżki ---
    const handlePathwaySelect = (path: 'duch' | 'materia') => {
        console.log(`[FLASH BOB] 🌀 Wybrano ścieżkę: ${path}`);
        setSelectedPathway(path);
        setShowPathwaySelector(false);

        // Zainicjalizuj Kwantową Kotwicę
        const userId = user?.email || 'anonymous';
        initializeKwantowaKotwica(userId, path);

        // Dla Ścieżki Ducha - całkowicie POMIŃ logowanie!
        if (path === 'duch') {
            console.log('[FLASH BOB] 🌙 Ścieżka Ducha - POMIJAM logowanie, wchodzę do TeODash!');

            // Ustaw specjalny tryb "Gość Ducha"
            localStorage.setItem('pathway_duch_mode', 'true');

            // Wymuś otwarcie Lounge (bez Firebase user)
            setIsLoungeOpen(true);
            setShowGenesis(false);
            setShowIntro(false);
            setIsReady(true);

            // 🏛️ Pokaż TeODash natychmiast po wejściu!
            setTimeout(() => setShowTeODash(true), 1500);

            // 🔥 Toast Mistrza - pierwszy!
            toast.success('🏛️ Witaj w TeODash! Twój dom czeka!', {
                icon: '💎',
                duration: 5000,
                style: {
                    background: 'rgba(15, 23, 42, 0.95)',
                    color: '#fbbf24',
                    border: '2px solid rgba(251, 191, 36, 0.5)',
                    boxShadow: '0 0 40px rgba(251, 191, 36, 0.4)',
                },
            });
        }
        // Dla Ścieżki Materii - przejdź do Genesis (logowanie)
        else {
            console.log('[FLASH BOB] 💎 Ścieżka Materii - przechodzę do logowania');
            setShowGenesis(true);
            localStorage.setItem('pathway_materia_mode', 'true');
        }

        toast.success(`Wybrano ścieżkę: ${path === 'duch' ? '🌙 Duch' : '💎 Materia'}`);
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
                {(!!user || sovereignLocal) && !onboarded && <Onboarding onDone={() => setOnboarded(true)} />}
                <div className="relative w-screen h-screen flex flex-col items-center justify-center overflow-hidden">
                    <CosmicBackground riskLevel={riskLevel} />
                    <div className="relative z-10 w-full h-full flex flex-col">
                        {!isInitiated ? (
                            <OtakOSGateway onInitiate={() => setIsInitiated(true)} />
                        ) : isWiesioOnline === false ? (
                            <TestKoherencji />
                        ) : (
                            <>
                                {/* 🚀 TE0 GENESIS - Suwerenna Brama (tylko dla Ścieżki Materii) */}
                                {!showPathwaySelector && selectedPathway === 'materia' && showGenesis && !isPioneer && (
                                    <TeOGenesis
                                        onEnter={() => {
                                            setShowGenesis(false);
                                            setShowIntro(false);
                                        }}
                                        isPioneer={isPioneer}
                                    />
                                )}

                                {/* Ścieżka Ducha */}
                                {!showPathwaySelector && selectedPathway === 'duch' && (
                                    <>
                                        <Header
                                            isVisible={isReady}
                                            isAuthenticated={false}
                                            isLoungeOpen={isLoungeOpen}
                                            onLogin={handleLogin}
                                            onLogout={handleLogout}
                                            onToggleLounge={handleToggleLounge}
                                            onOpenSettings={() => setApiKeyModalOpen(true)}
                                        />
                                        <main className="w-full h-full">
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key="lounge-duch"
                                                    className="w-full h-full"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.5 }}
                                                >
                                                    <TeonautLounge
                                                        onSubscriptionToggle={handleSubscriptionToggle}
                                                        onFavoriteToggle={handleFavoriteToggle}
                                                        onTriggerAnomaly={handleSystemScan}
                                                        onLogout={handleLogout}
                                                        behavioralData={behavioralData}
                                                        onVisualAssistantOpen={() => setVisualAssistantOpen(true)}
                                                        onOpenCrewClub={() => setShowCrewClub(true)}
                                                    />
                                                </motion.div>
                                            </AnimatePresence>
                                        </main>
                                    </>
                                )}

                                {/* Ścieżka Materii */}
                                {!showPathwaySelector && selectedPathway === 'materia' && (
                                    <>
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
                                            <AnimatePresence mode="wait">
                                                {(!user && !sovereignLocal) ? (
                                                    <motion.div
                                                        key="portal-guest"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.8 }}
                                                        className="w-full h-full"
                                                    >
                                                        <CosmicPortal onLoginRequest={handleLogin} onEmailLogin={handleEmailLogin} onEmailSignup={handleEmailSignup} onWalletLogin={handleWalletLogin} onSovereignEnter={handleEnterSovereign} />
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        key={isLoungeOpen ? "lounge" : "portal-auth"}
                                                        className="w-full h-full"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.5 }}
                                                    >
                                                        {isLoungeOpen ? (
                                                            <TeonautLounge
                                                                onSubscriptionToggle={handleSubscriptionToggle}
                                                                onFavoriteToggle={handleFavoriteToggle}
                                                                onTriggerAnomaly={handleSystemScan}
                                                                onLogout={handleLogout}
                                                                behavioralData={behavioralData}
                                                                onVisualAssistantOpen={() => setVisualAssistantOpen(true)}
                                                                onOpenCrewClub={() => setShowCrewClub(true)}
                                                            />
                                                        ) : (
                                                            <CosmicPortal
                                                                onLoginRequest={handleLogin}
                                                                onEmailLogin={handleEmailLogin}
                                                                onEmailSignup={handleEmailSignup}
                                                                onWalletLogin={handleWalletLogin}
                                                                isAuthenticated={true}
                                                                onVisualAssistantOpen={() => setVisualAssistantOpen(true)}
                                                            />
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </main>
                                    </>
                                )}

                                {/* 🌀 Field Resonance Indicator - Vibe Pulse */}
                                <div className="fixed top-1/2 -translate-y-1/2 right-3 z-[1500] pointer-events-none flex flex-col items-center gap-2">
                                    <motion.div
                                        className="w-1.5 h-64 bg-slate-900/40 rounded-full border border-white/5 overflow-hidden flex flex-col-reverse relative"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                    >
                                        <motion.div
                                            animate={{
                                                height: `${resonance}%`,
                                                boxShadow: resonance > 0 ? `0 0 15px rgba(34,211,238,${0.2 + resonance / 200})` : 'none'
                                            }}
                                            className="w-full bg-gradient-to-t from-cyan-500 via-blue-400 to-indigo-400 rounded-full"
                                            transition={{ type: "spring", stiffness: 50, damping: 20 }}
                                        />
                                    </motion.div>
                                    <motion.span
                                        className="text-[10px] text-cyan-400/70 font-bold uppercase tracking-widest [writing-mode:vertical-lr] rotate-180"
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                    >
                                        INTEGRACJA {resonance}%
                                    </motion.span>
                                </div>

                                {/* 🛰️ Quantum Navigation - Scentralizowany Panel Boczny */}
                                <div className="fixed bottom-10 right-6 flex flex-col items-center gap-6 z-[2000] pointer-events-none">
                                    <div className="pointer-events-auto">
                                        <button
                                            onClick={() => setShowJournal(true)}
                                            className="w-14 h-14 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-cyan-300/50 shadow-[0_0_20px_rgba(6,182,212,0.6)] cursor-pointer hover:scale-110 transition-all duration-300 group relative"
                                            title="WPIS (Dziennik)"
                                        >
                                            <div className="w-6 h-6 text-white group-hover:animate-pulse">
                                                <BookIcon />
                                            </div>
                                            <span className="absolute -left-32 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold text-cyan-300 border border-cyan-500/30 whitespace-nowrap pointer-events-none">
                                                WPIS (Dziennik)
                                            </span>
                                        </button>
                                    </div>
                                    {/* 🔧 Drożność Rur — przeniesione do TeO-Kibel · 📋 Wniosek O — ukryte na razie */}
                                    <div className="pointer-events-auto">
                                        <button
                                            onClick={() => setShowScenography(true)}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-emerald-500 to-teal-700 border-2 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer hover:scale-110 transition-transform"
                                            title="🎭 Scenografia Katedry"
                                        >
                                            🎭
                                        </button>
                                    </div>
                                    <div className="pointer-events-auto">
                                        <button
                                            onClick={() => setShowCrewClub(true)}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-300/50 shadow-[0_0_15px_rgba(251,191,36,0.5)] cursor-pointer hover:scale-110 transition-transform"
                                            title="🏆 Klub Mistrzów"
                                        >
                                            👑
                                        </button>
                                    </div>
                                    <div className="pointer-events-auto">
                                        <button
                                            onClick={() => setShowKibel(true)}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-cyan-600 to-cyan-800 border-2 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.5)] cursor-pointer hover:scale-110 transition-transform"
                                            title="🔐 TeO-Kibel"
                                        >
                                            🌀
                                        </button>
                                    </div>
                                    {/* 🔐 Skarbiec → przeniesiony do zakładki w TeO-Sim (🧠) */}
                                    <div className="pointer-events-auto">
                                        <button
                                            onClick={() => setShowPodcast(true)}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-fuchsia-500 to-cyan-700 border-2 border-fuchsia-300/50 shadow-[0_0_15px_rgba(232,121,249,0.5)] cursor-pointer hover:scale-110 transition-transform"
                                            title="🎙️ Podcast Twin"
                                        >
                                            🎙️
                                        </button>
                                    </div>
                                    <div className="pointer-events-auto">
                                        <button
                                            onClick={() => setShowTeoSim(true)}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-green-500 to-emerald-800 border-2 border-green-300/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer hover:scale-110 transition-transform"
                                            title="🧠 TeO-Sim: Reasoning Loops"
                                        >
                                            🧠
                                        </button>
                                    </div>
                                    {/* 🧪 TeO Lab — hub: Agro-Robotics + RadioSMT Pipeline (🗺️ Mapa Sieci → w TeO-Sim) */}
                                    <div className="pointer-events-auto">
                                        <button
                                            onClick={() => setShowLab(true)}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gradient-to-br from-lime-500 to-emerald-800 border-2 border-lime-300/50 shadow-[0_0_15px_rgba(132,204,22,0.5)] cursor-pointer hover:scale-110 transition-transform"
                                            title="🧪 TeO Lab — Symulatory & Pipeline'y"
                                        >
                                            🧪
                                        </button>
                                    </div>

                                    {/* 🏛️ Nagroda - Rada Podstawowa (Unlocked at 100%) */}
                                    {isRadaUnlocked && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0, rotate: -45 }}
                                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                            className="pointer-events-auto mt-4"
                                        >
                                            <button
                                                onClick={() => setShowRada(true)}
                                                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-gradient-to-tr from-amber-400 via-orange-500 to-red-600 border-2 border-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.8)] cursor-pointer hover:scale-125 transition-transform group relative"
                                                title="🏛️ Rada Podstawowa - Odblokowano!"
                                            >
                                                🏛️
                                                <div className="absolute inset-0 rounded-full animate-ping bg-amber-500/30 -z-10" />
                                                <div className="absolute -inset-1 rounded-full border border-amber-400 opacity-50 animate-pulse" />
                                            </button>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Modale */}
                                <AnimatePresence>
                                    {showKibel && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/90 flex justify-center overflow-y-auto z-[2002] p-4"
                                            onClick={() => setShowKibel(false)}
                                        >
                                            <motion.div
                                                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="my-auto w-full"
                                                style={{ maxWidth: 820 }}
                                            >
                                                <TeOKibel onFlush={() => { setShowKibel(false); setShowCrewClub(true); }} />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                    {showWniosekO && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[2003]"
                                            onClick={() => setShowWniosekO(false)}
                                        >
                                            <motion.div onClick={(e) => e.stopPropagation()}>
                                                <WniosekO onClose={() => setShowWniosekO(false)} />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                    {showScenography && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/85 flex items-center justify-center z-[2003]"
                                            onClick={() => setShowScenography(false)}
                                        >
                                            <motion.div onClick={(e) => e.stopPropagation()}>
                                                <ScenographyManager onClose={() => setShowScenography(false)} />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                    {/* 🔧 Drożność Rur przeniesione do wnętrza TeO-Kibel (showKibel) */}
                                    {showCrewClub && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/95 flex items-center justify-center z-[2004]"
                                        >
                                            <TeODash onClose={() => setShowCrewClub(false)} />
                                        </motion.div>
                                    )}
                                    {showRada && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/95 flex items-center justify-center z-[2010]"
                                            onClick={() => setShowRada(false)}
                                        >
                                            <motion.div
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.9, opacity: 0 }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <RadaPodstawowa onClose={() => setShowRada(false)} />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                    {/* 🎛️ RadioSMT (JasonFlowBridge) przeniesione do 🧪 TeO Lab */}
                                    {showJournal && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 100 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 100 }}
                                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                            className="fixed inset-0 z-[3000] bg-black"
                                        >
                                            <QuantumJournal onClose={() => setShowJournal(false)} />
                                        </motion.div>
                                    )}
                                    {showPodcast && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/90 flex justify-center overflow-y-auto z-[3001] p-4"
                                            onClick={() => setShowPodcast(false)}
                                        >
                                            <motion.div
                                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="my-auto w-full"
                                            >
                                                <NotebookTwinPanel onClose={() => setShowPodcast(false)} />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                    {showTeoSim && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[3001] p-4"
                                            onClick={() => setShowTeoSim(false)}
                                        >
                                            <motion.div
                                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full max-w-3xl"
                                            >
                                                <div className="flex justify-end mb-2">
                                                    <button onClick={() => setShowTeoSim(false)} className="text-slate-400 hover:text-white text-sm border border-slate-700 rounded-lg px-3 py-1">✕ Zamknij</button>
                                                </div>
                                                <SimulationDashboard />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                    {showLab && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/90 flex justify-center overflow-y-auto z-[3001] p-4"
                                            onClick={() => setShowLab(false)}
                                        >
                                            <motion.div
                                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="my-auto w-full"
                                            >
                                                <TeoLab onClose={() => setShowLab(false)} />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                    {isVisualAssistantOpen && (
                                        <VisualAssistant onClose={() => setVisualAssistantOpen(false)} />
                                    )}
                                    {secretariatState?.isOpen && (
                                        <Secretariat
                                            onVerified={secretariatState.onVerified!}
                                            onCancel={secretariatState.onCancel!}
                                            actionName={secretariatState.actionName}
                                        />
                                    )}
                                </AnimatePresence>

                                {/* Globalne elementy */}
                                {user && !identity?.username && !hasPioneerBypass(user.email) && <UsernameClaimModal />}
                                {user && <AvatarSelectionModal />}
                                <ProtectiveModeModal />
                                <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
                                {anomaly && <QuantumGuardianAlert message={anomaly} onClose={() => setAnomaly(null)} />}

                                <Toaster
                                    position="bottom-right"
                                    toastOptions={{
                                        style: { background: 'rgba(9, 10, 15, 0.8)', color: '#e2e8f0', border: '1px solid #0891b2', backdropFilter: 'blur(10px)' },
                                        success: { iconTheme: { primary: '#10b981', secondary: '#0f172a' } },
                                        error: { iconTheme: { primary: '#f43f5e', secondary: '#0f172a' } },
                                    }}
                                />
                                <SubscriptionActivator />
                            </>
                        )}
                        <KatedraRadioPlayer />
                    </div>
                </div>

            {/* ══════════════════════════════════════════════════════════
                🌌 KWANTOWA CZYTELNIA — Pełnoekranowy Overlay
                Aktywowana przez WydawnictwoForge przez teo_active_story.
                Z-index 9999 — ponad wszystkimi modałami i dashboardami.
                ══════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {activeStory && (
                    <motion.div
                        key="kwantowa-czytelnia"
                        initial={{ opacity: 0, scale: 1.03 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                        className="fixed inset-0 z-[9999]"
                    >
                        <KwantowaCzytelnia
                            text={activeStory}
                            onClose={handleCzytelniaClosed}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 🚨 Pętla Samonaprawy Katedry — globalny chwytacz błędów + szmaragdowa notyfikacja.
                Zawsze zamontowana (poza bramką auth), by łapać awarie w całej aplikacji. */}
            <AutoPanicSentinel />

            </GravitonProvider>

    );
};

export default App;
