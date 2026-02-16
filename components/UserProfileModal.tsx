
import React from 'react';
import { motion } from 'framer-motion';
import { UserCircleIcon, ShieldCheckIcon, WalletIcon } from './icons';
import { cn } from '../lib/helpers';

interface UserProfileModalProps {
    user: { id: string; name: string; pos: any; status: string; avatarSeed?: string };
    onClose: () => void;
    onTransfer: (amount: number) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose, onTransfer }) => {
    
    const handleTransferClick = () => {
        // Simple confirmation for now, could be expanded
        const confirmed = window.confirm(`Initiate transfer of 10 GRV to ${user.name}?`);
        if (confirmed) {
            onTransfer(10);
            onClose();
        }
    };

    const bgSeed = user.name.charCodeAt(0) % 5;
    const gradients = [
        'from-cyan-500/20 to-blue-600/20',
        'from-purple-500/20 to-pink-600/20',
        'from-emerald-500/20 to-teal-600/20',
        'from-amber-500/20 to-orange-600/20',
        'from-rose-500/20 to-red-600/20',
    ];

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header / Banner */}
                <div className={cn("h-32 bg-gradient-to-br relative", gradients[bgSeed])}>
                    <button 
                        onClick={onClose} 
                        className="absolute top-3 right-3 text-white/70 hover:text-white bg-black/20 rounded-full p-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Avatar & Info */}
                <div className="px-6 pb-6 -mt-12 relative">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center shadow-lg mb-4">
                        <div className="text-cyan-300 w-12 h-12">
                            <UserCircleIcon />
                        </div>
                    </div>
                    
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                        <p className="text-slate-400 text-sm">TeOnaut Explorer</p>
                        
                        <div className="flex justify-center gap-4 mt-3 text-xs font-mono">
                            <div className="flex items-center gap-1 text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-500/20">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                ONLINE
                            </div>
                            <div className="flex items-center gap-1 text-amber-400 bg-amber-900/20 px-2 py-1 rounded border border-amber-500/20">
                                <ShieldCheckIcon />
                                PoBI: 98%
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                            <p className="text-xs text-slate-500">Energy</p>
                            <p className="font-bold text-white">High</p>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                            <p className="text-xs text-slate-500">Created</p>
                            <p className="font-bold text-white">12 Worlds</p>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                            <p className="text-xs text-slate-500">Tier</p>
                            <p className="font-bold text-cyan-300">Medium</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <button 
                            onClick={handleTransferClick}
                            className="w-full capsule-button capsule-cyan flex items-center justify-center gap-2"
                        >
                            <div className="w-4 h-4"><WalletIcon /></div>
                            Transfer GRV
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button className="py-2 px-4 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-semibold">
                                Message
                            </button>
                            <button className="py-2 px-4 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-semibold">
                                Collection
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
