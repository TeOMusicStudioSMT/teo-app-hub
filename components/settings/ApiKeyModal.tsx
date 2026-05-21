import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtom } from 'jotai';
import { userApiKeyAtom } from '../../store/settings';
import { setSystemReady } from '../../lib/memory/CityMemory';
import { unlockGrvAtom } from '../../store/wallet';
import { detectKeyProvider, flushKibel } from '../../lib/kibel';
import { DepozytObfitości } from '../special/DepozytObfitości';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiKey, FiExternalLink, FiRefreshCw } from 'react-icons/fi';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useAtom(userApiKeyAtom);
    const [inputValue, setInputValue] = useState(apiKey);
    const [showKey, setShowKey] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showDepozyt, setShowDepozyt] = useState(false);

    const [, unlockGrv] = useAtom(unlockGrvAtom);

    // Mapa: provider → localStorage key (musi zgadzać się z kibel.ts getKeyDirect)
    const PROVIDER_STORAGE_MAP: Record<string, string> = {
        gemini:    'teo_gemini_api_key',
        anthropic: 'kibel_key_anthropic',
        groq:      'kibel_key_groq',
        openai:    'kibel_key_openai',
        suno:      'kibel_key_suno',
    };

    const handleSave = () => {
        const trimmedKey = inputValue.trim();
        if (!trimmedKey) {
            toast.error('Wpisz klucz API.');
            return;
        }

        const detection = detectKeyProvider(trimmedKey);

        if (!detection.isValid) {
            toast.error('Nie rozpoznano formatu klucza API! (AIza... / sk-ant-... / gsk_... / sk-...)');
            return;
        }

        setIsSyncing(true);

        // Zapisz do właściwego klucza localStorage dla danego providera
        const storageKey = PROVIDER_STORAGE_MAP[detection.provider] ?? 'kibel_key_custom';
        localStorage.setItem(storageKey, trimmedKey);

        // Dla Gemini - też zaktualizuj atom (używany przez resztę apki)
        if (detection.provider === 'gemini') {
            setApiKey(trimmedKey);
        }

        setSystemReady(true);
        unlockGrv();

        const flushResult = flushKibel();
        console.log(`[ApiKeyModal] ${flushResult.message}`);

        toast.success(`🔐 ${detection.provider.toUpperCase()} zapisany w Kiblu! SYSTEM_READY = TRUE`, { duration: 4000 });
        setShowDepozyt(true);
    };

    const handleCloseDepozyt = () => {
        setShowDepozyt(false);
        onClose();
        // Reload po zamknięciu Depozytu
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    const handleCancel = () => {
        setInputValue(apiKey);
        onClose();
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                        onClick={!isSyncing ? handleCancel : undefined}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', duration: 0.5 }}
                            className="relative max-w-md w-full bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.3)] p-6 md:p-8 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-2xl blur-xl" />

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center">
                                        {isSyncing ? (
                                            <FiRefreshCw className="text-cyan-300 text-xl animate-spin" />
                                        ) : (
                                            <FiKey className="text-cyan-300 text-xl" />
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.7)]">
                                            {isSyncing ? 'System Sync...' : 'Neural Link'}
                                        </h2>
                                        <p className="text-sm text-slate-400">
                                            {isSyncing ? 'Rebooting Consciousness Modules' : 'Configure your AI connection'}
                                        </p>
                                    </div>
                                </div>

                                <div className={isSyncing ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
                                    <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                                        Wrzuć klucz do Kibla — system rozpozna providera automatycznie.
                                        Klucz nigdy nie opuszcza Twojej przeglądarki.
                                    </p>

                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {[
                                            { label: 'Gemini', prefix: 'AIza...', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' },
                                            { label: 'Claude', prefix: 'sk-ant-...', color: 'text-orange-400 border-orange-400/30 bg-orange-400/5' },
                                            { label: 'Groq', prefix: 'gsk_...', color: 'text-green-400 border-green-400/30 bg-green-400/5' },
                                            { label: 'OpenAI', prefix: 'sk-...', color: 'text-blue-400 border-blue-400/30 bg-blue-400/5' },
                                        ].map(p => (
                                            <span key={p.label} className={`text-xs px-2 py-0.5 rounded border font-mono ${p.color}`}>
                                                {p.label}: {p.prefix}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-semibold text-cyan-300 mb-2">
                                            Klucz API (Kibel)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showKey ? 'text' : 'password'}
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                placeholder="AIza... / sk-ant-... / gsk_... / sk-..."
                                                className="w-full px-4 py-3 pr-12 bg-slate-800/50 border border-cyan-500/30 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(!showKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 transition-colors"
                                            >
                                                {showKey ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    <a
                                        href="https://aistudio.google.com/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-lime-400 hover:text-lime-300 transition-colors mb-2"
                                    >
                                        <span>Gemini — darmowy klucz</span>
                                        <FiExternalLink size={14} />
                                    </a>

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            onClick={handleCancel}
                                            className="flex-1 px-4 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 font-semibold transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={!inputValue.trim()}
                                            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-lg text-white font-semibold shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save & Reboot
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 🌟 DEPOZYT OBFITOŚCI - List Inicjacyjny */}
            <DepozytObfitości 
                isOpen={showDepozyt} 
                onClose={handleCloseDepozyt}
                unlockedAmount={4000000000}
            />
        </>
    );
};
