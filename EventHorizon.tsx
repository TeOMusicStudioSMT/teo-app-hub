import React from 'react';
import RingKey from './components/RingKey';

interface EventHorizonProps {
    onLoginRequest: () => void;
    /** Wejście suwerenne — tożsamość lokalna (identity.json), bez Firebase. */
    onSovereignEnter?: () => void;
}

const EventHorizon: React.FC<EventHorizonProps> = ({ onLoginRequest, onSovereignEnter }) => {
    return (
        <div className="flex flex-col items-center gap-5">
            <div
                className="event-horizon-container relative w-40 h-40 md:w-52 md:h-52 flex items-center justify-center group cursor-pointer"
                onClick={onLoginRequest}
                aria-label="Połącz z Firebase (opcjonalnie)"
                role="button"
            >
                {/* Crystalline Sphere effect */}
                <div className="crystal-sphere"></div>

                {/* Inner nebula and core pulse effects */}
                <div className="mini-nebula"></div>
                <div className="core-pulse-warm"></div>

                {/* Central Text */}
                <div className="relative text-center font-bold tracking-widest uppercase transition-all duration-300 group-hover:scale-105 z-10">
                    <span className="text-4xl md:text-5xl text-amber-100 drop-shadow-[0_0_12px_rgba(255,220,150,0.9)]">TeO</span>
                </div>
            </div>

            {/* ⚡ Suwerenne wejście lokalne — domyślna, bezchmurna ścieżka */}
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
                        Sfera <span className="text-amber-200">TeO</span> = opcjonalne połączenie Firebase (jak chcesz).
                    </div>
                    {/* 💍 Klucz Pierścienia — wejście dotknięciem NFC */}
                    <RingKey onAuthSuccess={onSovereignEnter} />
                </>
            )}
        </div>
    );
};

export default EventHorizon;
