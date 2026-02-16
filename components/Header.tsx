
import React, { useState } from 'react';
import { FiHome, FiPower, FiSettings } from 'react-icons/fi';

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
                <h1 className="text-lg md:text-2xl font-bold tracking-widest uppercase text-cyan-300 drop-shadow-[0_0_5px_rgba(0,255,255,0.7)]">
                    <span key={title} className="font-light text-slate-300 inline-block animate-text-focus-in">{title}</span>
                </h1>
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
                ) : (
                    <button onClick={onLogin} className="capsule-button capsule-cyan text-sm md:text-base px-4 md:px-6">
                        Enter Lounge
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
