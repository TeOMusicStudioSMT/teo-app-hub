
import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { projectsAtom } from '../store';
import DashboardCard from './DashboardCard';
import { AppIcon, StarIcon } from './icons';
import { walletAtom } from '../store/wallet';
import toast from 'react-hot-toast';
import { GPayButton } from './GPayButton';
import { COSMIC_VENTURES } from '../constants';
import { VentureCard } from './cosmic_ventures/VentureCard';
import { VentureDetailModal } from './cosmic_ventures/VentureDetailModal';
import { CosmicVenture } from '../types';
import { NetworkOfLoci } from './NetworkOfLoci';
import { UniverseCard } from './dashboard/UniverseCard';
import { WarpTransition } from './effects/WarpTransition';
import { FiMusic, FiPackage, FiShield, FiFeather } from 'react-icons/fi';

interface ProjectsViewProps {
    onSubscriptionToggle: (id: string) => void;
    onFavoriteToggle: (id: string) => void;
}

// Helper function to render bolded parts of the name
const renderProjectName = (name: string) => {
    const boldKeywords = ['music', 'app', 'blockchain', 'story', 'viton', 'master'];
    const italicKeywords = ['per'];

    const allKeywords = [...boldKeywords, ...italicKeywords];
    if (allKeywords.length === 0) return <>{name}</>;

    const regex = new RegExp(`(${allKeywords.join('|')})`, 'gi');
    const parts = name.split(regex);

    return (
        <>
            {parts.map((part, index) => {
                const lowerPart = part.toLowerCase();
                if (boldKeywords.includes(lowerPart)) {
                    return <strong key={index}>{part}</strong>;
                }
                if (italicKeywords.includes(lowerPart)) {
                    return <em key={index}>{part}</em>;
                }
                return part;
            })}
        </>
    );
};


export const ProjectsView: React.FC<ProjectsViewProps> = ({ onSubscriptionToggle, onFavoriteToggle }) => {
    const projects = useAtomValue(projectsAtom);
    const wallet = useAtomValue(walletAtom);
    const [selectedVenture, setSelectedVenture] = useState<CosmicVenture | null>(null);
    const projectsToList = projects.filter(p => p.id !== 'teo.market');

    const handleGRVSubscription = (projectId: string) => {
        if (!wallet.address) {
            toast.error('Please connect your wallet in the Profile tab to manage GRV subscriptions.');
            return;
        }
        onSubscriptionToggle(projectId);
    };

    const handleUSDSubscription = (projectId: string) => {
        // This is called on GPay success. We directly toggle subscription.
        onSubscriptionToggle(projectId);
    };

    const [isWarping, setIsWarping] = useState(false);
    const [targetUrl, setTargetUrl] = useState('');

    const handleEnterUniverse = async (url: string) => {
        // 1. Start the warp effect immediately for visual feedback
        setIsWarping(true);
        setTargetUrl(url);

        try {
            // 2. Generate Teleport Ticket
            const { auth } = await import('../lib/firebaseConfig');
            const { initiateTeleport } = await import('../services/teleportService');

            if (auth.currentUser) {
                const redirectUrl = await initiateTeleport(url, auth.currentUser);

                // 3. Wait for animation (min 2s) then redirect
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 2000);
            } else {
                // Fallback if no user
                console.warn("No user found for teleport, redirecting without ticket.");
                setTimeout(() => {
                    window.location.href = url;
                }, 2000);
            }
        } catch (error) {
            console.error("Teleport error:", error);
            // Fallback on error
            setTimeout(() => {
                window.location.href = url;
            }, 2000);
        }
    };

    const isLocked = (requiredTier: string) => {
        const tiers = ['observer', 'voyager', 'architect', 'singularity'];
        const userTierIndex = tiers.indexOf(wallet.tier || 'observer');
        const requiredTierIndex = tiers.indexOf(requiredTier);
        return userTierIndex < requiredTierIndex;
    };

    return (
        <div className="space-y-8">
            {/* Warp Transition Overlay */}
            <WarpTransition isActive={isWarping} />

            {/* Network of Loci Visualization */}
            <NetworkOfLoci />

            {/* Available Gateways Section */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-1 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
                    <h3 className="text-xl font-bold text-white tracking-wide">
                        Available Gateways
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <UniverseCard
                        title="TeO Story Studio"
                        subtitle="Forge your Narratives. Construct Reality."
                        onClick={() => handleEnterUniverse('https://teostory.studio')}
                        icon={<FiFeather className="w-8 h-8" />}
                        colorTheme="purple"
                        isLocked={isLocked('observer')}
                    />

                    <UniverseCard
                        title="TeO Music Studio"
                        subtitle="Harmonic Resonance. Audio Synthesis."
                        onClick={() => handleEnterUniverse('https://teostomusic.studio')}
                        icon={<FiMusic className="w-8 h-8" />}
                        colorTheme="pink"
                        isLocked={isLocked('voyager')}
                    />

                    <UniverseCard
                        title="TeO App Studio"
                        subtitle="Construct Tools. Code Reality."
                        onClick={() => handleEnterUniverse('https://teoapp.studio')}
                        icon={<FiPackage className="w-8 h-8" />}
                        colorTheme="cyan"
                        isLocked={isLocked('architect')}
                    />

                    <UniverseCard
                        title="Graviton Staking"
                        subtitle="Coming Soon. Accumulate Power."
                        onClick={() => { }}
                        isLocked={true}
                        icon={<FiShield className="w-8 h-8" />}
                        colorTheme="blue"
                    />
                </div>
            </div>

            <DashboardCard title="App Subscriptions & Projects" icon={<AppIcon />}>
                <div className="pr-2 overflow-y-auto max-h-[calc(100vh-20rem)]">
                    {projectsToList.map(project => (
                        <div key={project.id} className="flex items-center justify-between p-3 border-b border-slate-700/50 gap-4">
                            <div className="flex items-center flex-1 min-w-0">
                                <div className={`w-4 h-4 mr-4 flex-shrink-0 text-${project.color}-400`}>{project.icon}</div>
                                <span className="font-semibold truncate">{renderProjectName(project.name)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={() => onFavoriteToggle(project.id)}
                                    className="p-2 rounded-full text-amber-400 hover:bg-slate-700/50 transition-colors"
                                    aria-label={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    <div className="w-5 h-5">
                                        <StarIcon filled={project.isFavorite} />
                                    </div>
                                </button>

                                <div className="w-36">
                                    {project.isSubscribed ? (
                                        <button
                                            onClick={() => onSubscriptionToggle(project.id)} // Cancel is universal
                                            className={'w-full capsule-button capsule-rose text-sm py-1'}>
                                            Cancel
                                        </button>
                                    ) : project.currency === 'USD' ? (
                                        <GPayButton onPaymentSuccess={() => handleUSDSubscription(project.id)} />
                                    ) : (
                                        <button
                                            onClick={() => handleGRVSubscription(project.id)}
                                            className={'w-full capsule-button capsule-green text-sm py-1'}>
                                            Subscribe
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </DashboardCard>

            <div>
                <h2 className="text-3xl font-bold text-cyan-300 mb-4 drop-shadow-[0_0_4px_rgba(0,255,255,0.5)]">
                    COSMIC VENTURES / Project Launch Pad
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {COSMIC_VENTURES.map(venture => (
                        <VentureCard key={venture.id} venture={venture} onSelect={setSelectedVenture} />
                    ))}
                </div>
            </div>

            <VentureDetailModal venture={selectedVenture} onClose={() => setSelectedVenture(null)} />
        </div>
    );
};
