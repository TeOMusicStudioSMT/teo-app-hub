import React, { useState } from 'react';
import { UserCircleIcon } from './icons';
import DashboardCard from './DashboardCard';
import { useAtom, useAtomValue } from 'jotai';
import { walletAtom } from '../store/wallet';
import { userApiKeyAtom } from '../store/settings';
import { ApiKeyModal } from './settings/ApiKeyModal';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { FiKey } from 'react-icons/fi';

interface ProfileViewProps {
    onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onLogout }) => {
    const [wallet, setWallet] = useAtom(walletAtom);
    const apiKey = useAtomValue(userApiKeyAtom);
    const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);

    const isApiKeyConfigured = apiKey && apiKey.trim().length > 0;

    const handleConnectWallet = async () => {
        if (typeof (window as any).ethereum === 'undefined') {
            toast.error('MetaMask is not installed. Please install it to connect.');
            return;
        }
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            const balanceWei = await provider.getBalance(address);
            const balanceEth = ethers.formatEther(balanceWei);

            // FIX: Use updater function to preserve existing state fields like frequencyTier.
            setWallet(prev => ({
                ...prev,
                address,
                balance: parseFloat(balanceEth).toFixed(4),
            }));
            toast.success('Wallet connected successfully!');
        } catch (e: any) {
            console.error("Failed to connect wallet:", e);
            toast.error('Failed to connect wallet. See console for details.');
        }
    };

    const handleLogoutAndDisconnect = () => {
        // FIX: Use updater function to preserve existing state fields like frequencyTier.
        setWallet(prev => ({ ...prev, address: null, balance: null }));
        onLogout();
        toast('Wallet disconnected.');
    };

    const tierColors = {
        observer: 'text-slate-400',
        voyager: 'text-cyan-400',
        architect: 'text-fuchsia-400',
        singularity: 'text-amber-400 animate-pulse'
    };

    const tierLabels = {
        observer: 'Observer',
        voyager: 'Voyager',
        architect: 'Architect',
        singularity: 'Singularity'
    };

    return (
        <DashboardCard title="TeOnaut Profile" icon={<UserCircleIcon />}>
            <div className="p-4 flex flex-col items-center text-center">
                <div className={`w-24 h-24 mb-4 ${tierColors[wallet.tier] || 'text-cyan-300'}`}>
                    <UserCircleIcon />
                </div>
                <h2 className="text-2xl font-bold text-white">TeOnaut #001</h2>
                <p className={`text-lg font-medium ${tierColors[wallet.tier] || 'text-slate-400'} mb-6 uppercase tracking-widest`}>
                    {tierLabels[wallet.tier] || 'Observer'}
                </p>

                <div className="w-full max-w-md text-left space-y-4 my-6">
                    {/* Neural Link Configuration Section */}
                    <div className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 p-4 rounded-lg border border-cyan-500/30">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <FiKey className="text-cyan-300 text-lg" />
                                <h3 className="text-sm font-semibold text-cyan-300">Neural Link Configuration</h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {isApiKeyConfigured ? (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                                        <span className="text-xs text-lime-400 font-semibold">Active</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                                        <span className="text-xs text-rose-400 font-semibold">Not Configured</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">
                            {isApiKeyConfigured
                                ? "Your AI connection is established. All features unlocked."
                                : "Configure your Gemini API key to unlock AI features."}
                        </p>
                        <button
                            onClick={() => setApiKeyModalOpen(true)}
                            className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition-all ${isApiKeyConfigured
                                ? 'bg-slate-700/50 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                                : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                                }`}
                        >
                            {isApiKeyConfigured ? 'Update API Key' : 'Configure API Key'}
                        </button>
                    </div>

                    <div className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="text-xs text-slate-400">Wallet Address (GRV)</p>
                        {wallet.address ? (
                            <p className="font-mono text-cyan-300 truncate">{wallet.address}</p>
                        ) : (
                            <p className="text-slate-500 italic">Not connected</p>
                        )}
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="text-xs text-slate-400">Joined</p>
                        <p className="text-white">July 26, 2024</p>
                    </div>
                </div>

                {!wallet.address && (
                    <button
                        onClick={handleConnectWallet}
                        className="mt-6 capsule-button capsule-cyan py-3 w-full max-w-md"
                    >
                        Connect Wallet
                    </button>
                )}

                <button
                    onClick={handleLogoutAndDisconnect}
                    className="mt-4 capsule-button capsule-rose py-3 w-full max-w-md"
                >
                    Logout & Disconnect
                </button>

                {/* API Key Configuration Modal */}
                <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
            </div>
        </DashboardCard>
    );
};
