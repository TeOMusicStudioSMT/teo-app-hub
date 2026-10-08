
import React, { useEffect, useState } from 'react';
import { FiHome, FiPower, FiSettings } from 'react-icons/fi';
import { useAtom } from 'jotai';
import { aiModeAtom } from '../store/settings';
import { pobierzTryb, ustawTryb, opisTrybu, type StanTrybu } from '../lib/trybKatedry';
import { motion } from 'framer-motion';

interface HeaderProps {
    isVisible: boolean;
    isAuthenticated: boolean;
    isLoungeOpen: boolean;
    onLogin: () => void;
    onLogout: () => void;
    onToggleLounge: () => void;
    onOpenSettings?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isVisible, isAuthenticated, isLoungeOpen, onLogin, onLogout, onToggleLounge, onOpenSettings }) => {
    const title = isAuthenticated && isLoungeOpen ? "TEONAUT LOUNGE" : "HUB";
    const [logoError, setLogoError] = useState(false);
    const [aiMode, setAiMode] = useAtom(aiModeAtom);
    // ☁️/🏠 Tryb Katedry: most jest źródłem prawdy (lib/trybKatedry.ts) — przełącznik zmienia CAŁĄ Katedrę.
    const [tryb, setTryb] = useState<StanTrybu | null>(null);
    useEffect(() => {
        let zywy = true;
        const sync = () => pobierzTryb().then((s) => { if (!zywy || !s) return; setTryb(s); setAiMode(s.tryb === 'chmura' ? 'cloud' : 'local'); });
        void sync();
        const t = setInterval(sync, 60_000);
        return () => { zywy = false; clearInterval(t); };
    }, [setAiMode]);
    const przelacz = async (cel: 'cloud' | 'local') => {
        setAiMode(cel);
        try { setTryb(await ustawTryb({ tryb: cel === 'cloud' ? 'chmura' : 'lokalnie' })); }
        catch { setTryb(await pobierzTryb()); }
    };

    return (
        <header className={`absolute top-0 left-0 right-0 p-4 md:p-12 z-30 flex justify-between items-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}>
            <div className="flex items-center gap-2 md:gap-4">
                {!logoError ? (
                    <img
                        src="/logo.png"
                        alt="TeO Hub"
                        className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-[0_0_10px_rgba(6,182,212,0.7)]"
                        onError={() => setLogoError(true)}
                    />
                ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-cyan-300 font-bold text-xl drop-shadow-[0_0_10px_rgba(6,182,212,0.7)]">
                        TeO
                    </div>
                )}
                <div className="flex flex-col">
                    <h1 className="text-lg md:text-2xl font-bold tracking-widest uppercase text-cyan-300 drop-shadow-[0_0_5px_rgba(0,255,255,0.7)] flex items-center gap-2">
                        <span key={title} className="font-light text-slate-300 inline-block animate-text-focus-in">{title}</span>
                        <div
                            className={`w-2 h-2 rounded-full ${aiMode === 'local' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-blue-500 shadow-[0_0_10px_#3b82f6]'} animate-pulse`}
                            title={aiMode === 'local' ? 'Duch Lokalny Aktywny' : 'Chmura Aktywna'}
                        />
                    </h1>

                    {/* JusT Global Switch */}
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex bg-slate-900/60 backdrop-blur-md rounded-full p-0.5 border border-white/10 text-[9px] font-bold">
                            <button
                                onClick={() => void przelacz('cloud')}
                                className={`px-2 py-0.5 rounded-full transition-all ${aiMode === 'cloud' ? 'bg-blue-600/40 text-blue-300 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                CLOUD
                            </button>
                            <button
                                onClick={() => void przelacz('local')}
                                className={`px-2 py-0.5 rounded-full transition-all ${aiMode === 'local' ? 'bg-green-600/40 text-green-300 shadow-[0_0_10px_rgba(22,163,74,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                JusT
                            </button>
                        </div>
                        {tryb?.tryb === 'chmura' && (
                            <select
                                value={tryb.dostawca}
                                onChange={(e) => void ustawTryb({ dostawca: e.target.value as StanTrybu['dostawca'], model: null }).then(setTryb).catch(() => {})}
                                title="Którą chmurą liczy Katedra (klucz z Kibla, „🔗 Udostępnij mostowi”)"
                                className="bg-slate-900/60 border border-white/10 rounded-full px-1.5 py-0.5 text-[9px] text-slate-300"
                            >
                                <option value="auto">auto (Claude → Gemini)</option>
                                <option value="anthropic">Claude</option>
                                <option value="gemini">Gemini</option>
                            </select>
                        )}
                    </div>
                    <p
                        className={`mt-0.5 max-w-[260px] truncate text-[9px] ${tryb?.tryb === 'chmura' && !tryb.chmuraAktywna ? 'text-amber-300' : 'text-slate-500'}`}
                        title={`${opisTrybu(tryb)}${tryb ? `\nDzienny limit chmury: ${tryb.limitTokenow || 'bez limitu'} tokenów (po nim Katedra sama wraca do lokalnych). Obrazy, narzędzia i embeddingi zawsze lokalnie.` : ''}`}
                        onDoubleClick={() => {
                            const v = window.prompt('Dzienny limit tokenów chmury (0 = bez limitu):', String(tryb?.limitTokenow ?? 2000000));
                            if (v !== null) void ustawTryb({ limitTokenow: Number(v) || 0 }).then(setTryb).catch(() => {});
                        }}
                    >
                        {opisTrybu(tryb)}
                    </p>
                </div>
            </div>
            <div>
                {isAuthenticated ? (
                    <div className="flex items-center gap-2 md:gap-3">
                        <button
                            onClick={onToggleLounge}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-800/50 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                            title={isLoungeOpen ? 'Back to Hub' : 'Enter Lounge'}
                            aria-label={isLoungeOpen ? 'Back to Hub' : 'Enter Lounge'}
                        >
                            <FiHome size={20} />
                        </button>
                        {onOpenSettings && (
                            <button
                                onClick={onOpenSettings}
                                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-800/50 backdrop-blur-md border border-lime-500/30 flex items-center justify-center text-lime-300 hover:bg-lime-900/50 hover:border-lime-400 transition-all duration-300 hover:shadow-[0_0_15px_rgba(163,230,53,0.5)]"
                                title="Neural Link Settings"
                                aria-label="Neural Link Settings"
                            >
                                <FiSettings size={20} />
                            </button>
                        )}
                        <button
                            onClick={onLogout}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-800/50 backdrop-blur-md border border-rose-500/30 flex items-center justify-center text-rose-300 hover:bg-rose-900/50 hover:border-rose-400 transition-all duration-300 hover:shadow-[0_0_15px_rgba(244,63,94,0.5)]"
                            title="Logout"
                            aria-label="Logout"
                        >
                            <FiPower size={20} />
                        </button>
                    </div>
                ) : null}
            </div>
        </header>
    );
};

export default Header;
