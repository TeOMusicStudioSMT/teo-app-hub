import React, { useState } from 'react';
import { FaGoogle, FaWallet } from 'react-icons/fa';
import { MdEmail } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import RingKey from './RingKey';

interface EventHorizonProps {
    onLoginRequest: () => void;
    onEmailLogin?: (email: string, password: string) => void;
    onEmailSignup?: (email: string, password: string) => void;
    onWalletLogin?: () => void;
    /** Wejście suwerenne — tożsamość lokalna (identity.json), bez Firebase. Domyślna ścieżka 0.00G. */
    onSovereignEnter?: () => void;
}

const EventHorizon: React.FC<EventHorizonProps> = ({ onLoginRequest, onEmailLogin, onEmailSignup, onWalletLogin, onSovereignEnter }) => {
    const [isOrbActive, setIsOrbActive] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setIsLoading(true);
        try {
            if (isSignup && onEmailSignup) {
                await onEmailSignup(email, password);
            } else if (onEmailLogin) {
                await onEmailLogin(email, password);
            }
            // Reset form on success
            setEmail('');
            setPassword('');
            setShowEmailForm(false);
        } catch (error) {
            // Error handling is done in authService
        } finally {
            setIsLoading(false);
        }
    };

    // Email Form View
    if (showEmailForm) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md px-6"
            >
                <div className="relative bg-slate-900/40 backdrop-blur-xl border border-cyan-500/30 rounded-3xl p-8 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                    {/* Holographic glow effect */}
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none"></div>

                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 mb-6 text-center">
                            {isSignup ? 'Create New Node' : 'Initialize Session'}
                        </h2>

                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div>
                                <label className="block text-cyan-300 text-sm font-semibold mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900/60 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-3 text-cyan-100 placeholder-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 outline-none transition-all"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-cyan-300 text-sm font-semibold mb-2">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/60 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-3 text-cyan-100 placeholder-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/50"
                            >
                                {isLoading ? 'Processing...' : isSignup ? 'Create New Node' : 'Initialize Session'}
                            </button>
                        </form>

                        <div className="mt-6 space-y-3">
                            <button
                                onClick={() => setIsSignup(!isSignup)}
                                className="w-full text-cyan-300 hover:text-cyan-200 text-sm transition-colors"
                            >
                                {isSignup ? 'Already have a node? Initialize Session' : "Don't have a node? Create New Node"}
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-700"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-slate-900/40 text-slate-400">or</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowEmailForm(false)}
                                className="w-full text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                ← Back to options
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Login Options View (after orb activation)
    if (isOrbActive) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md px-6 space-y-4"
            >
                {/* Google Login */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative w-full bg-slate-900/40 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 cursor-pointer group hover:border-cyan-400/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                    onClick={onLoginRequest}
                >
                    <div className="flex items-center justify-center space-x-4">
                        <FaGoogle className="text-3xl text-cyan-300 group-hover:text-cyan-200 transition-colors" />
                        <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
                            Continue with Google
                        </span>
                    </div>
                </motion.div>

                {/* Divider */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="relative"
                >
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-700/50"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-transparent text-slate-500">- OR -</span>
                    </div>
                </motion.div>

                {/* Email Login */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="relative w-full bg-slate-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 cursor-pointer group hover:border-purple-400/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                    onClick={() => setShowEmailForm(true)}
                >
                    <div className="flex items-center justify-center space-x-4">
                        <MdEmail className="text-3xl text-purple-300 group-hover:text-purple-200 transition-colors" />
                        <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-400">
                            Continue with Email
                        </span>
                    </div>
                </motion.div>

                {/* Wallet Login */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    className="relative w-full bg-slate-900/40 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 cursor-pointer group hover:border-amber-400/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]"
                    onClick={onWalletLogin}
                >
                    <div className="flex items-center justify-center space-x-4">
                        <FaWallet className="text-3xl text-amber-300 group-hover:text-amber-200 transition-colors" />
                        <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-400">
                            Initialize via Wallet
                        </span>
                    </div>
                    {/* Hardware Key subtitle */}
                    <div className="absolute bottom-1 right-3 text-xs text-amber-500/50 font-mono">
                        HARDWARE KEY
                    </div>
                </motion.div>
            </motion.div>
        );
    }

    // Initial State: Primordial Graviton Orb
    return (
        <div className="flex flex-col items-center gap-5">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="event-horizon-container relative w-40 h-40 md:w-52 md:h-52 flex items-center justify-center group cursor-pointer"
                onClick={() => setIsOrbActive(true)}
                aria-label="Activate Graviton Interface"
                role="button"
            >
                {/* Crystalline Sphere effect - Restored with inline Tailwind/CSS for visibility */}
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.4)] animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-2 rounded-full border border-purple-500/40 opacity-70 animate-[spin_15s_linear_infinite_reverse]" />

                {/* Quantum Shield Pulse Integration */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-900/20 to-purple-900/20 blur-xl animate-pulse" />

                {/* Core */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 blur-md animate-pulse shadow-[0_0_30px_rgba(168,85,247,0.6)]" />

                {/* Subtle hint text that appears on hover */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-cyan-300/70 text-sm pointer-events-none"
                >
                    Click to Connect
                </motion.div>
            </motion.div>

            {/* ⚡ Suwerenne wejście lokalne — domyślna, bezchmurna ścieżka 0.00G */}
            {onSovereignEnter && (
                <>
                    <button
                        onClick={onSovereignEnter}
                        className="px-6 py-2 rounded-full border border-emerald-500/45 bg-emerald-950/30 text-emerald-300 text-xs font-mono tracking-wider hover:bg-emerald-900/50 transition-colors"
                    >
                        ⚡ WEJDŹ SUWERENNIE (LOKALNIE)
                    </button>
                    <div className="text-[10px] text-zinc-500 font-mono max-w-xs text-center leading-relaxed">
                        Suwerennie = tożsamość lokalna (<span className="text-emerald-400">identity.json</span>), zero chmury.<br />
                        Sfera = opcjonalne konto chmurowe (jak chcesz).
                    </div>
                    {/* 💍 Klucz Pierścienia — wejście dotknięciem NFC */}
                    <RingKey onAuthSuccess={onSovereignEnter} />
                </>
            )}
        </div>
    );
};

export default EventHorizon;