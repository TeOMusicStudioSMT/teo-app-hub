import React from 'react';

/**
 * PirateShipButton - Kwantowy Szkutnik Edition
 * A magical, oceanic-themed button for photon payloads.
 */
interface PirateShipButtonProps {
    url: string;
}

const PirateShipButton: React.FC<PirateShipButtonProps> = ({ url }) => {
    return (
        <div className="flex items-center justify-center sm:justify-start py-4">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center justify-center sm:justify-start gap-0 sm:gap-4 w-16 h-16 sm:w-auto sm:h-auto sm:px-10 sm:py-5 bg-[#020617] backdrop-blur-2xl border border-cyan-500/30 rounded-full overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:border-cyan-300/60 active:scale-95 no-underline shadow-2xl"
            >
                {/* Deep Ocean Layer (Base) */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950 to-black z-0" />

                {/* --- WAVE SYSTEMS --- */}
                {/* Wave Layer 1 (Back/Slow) */}
                <div className="absolute inset-0 z-0 pointer-events-none translate-y-full group-hover:translate-y-[35%] transition-transform duration-[800ms] ease-out opacity-40">
                    <div className="absolute top-0 left-0 w-[400%] h-full flex animate-wave-slow">
                        <WaveSVG color="fill-cyan-500" opacity="0.4" />
                        <WaveSVG color="fill-cyan-500" opacity="0.4" />
                    </div>
                </div>

                {/* Wave Layer 2 (Front/Fast) */}
                <div className="absolute inset-0 z-0 pointer-events-none translate-y-full group-hover:translate-y-[15%] transition-transform duration-[1200ms] ease-out opacity-60">
                    <div className="absolute top-0 left-0 w-[400%] h-full flex animate-wave-fast">
                        <WaveSVG color="fill-cyan-300" opacity="0.6" />
                        <WaveSVG color="fill-cyan-300" opacity="0.6" />
                    </div>
                </div>

                {/* --- SHIP & ARTIFACT --- */}
                <div className="relative z-20 flex items-center justify-center text-3xl group-hover:animate-ship-rock transition-all duration-300">
                    <span role="img" aria-label="pirate ship">⛵</span>
                </div>

                {/* --- TEXT (Hidden on mobile compact mode) --- */}
                <span className="hidden sm:inline relative z-20 text-cyan-50 font-bold uppercase tracking-[0.2em] text-sm drop-shadow-[0_0_12px_rgba(6,182,212,1)]">
                    Otwórz Ładunek Fotonu
                </span>

                {/* --- GLASS REFLECTION --- */}
                <div className="absolute inset-0 z-30 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

                {/* --- MOBILE PULSE (Aura for the artifact) --- */}
                <div className="absolute inset-0 sm:hidden rounded-full border-4 border-cyan-500/20 animate-pulse z-10" />
            </a>
        </div>
    );
};

/* Internal Wave Helper to keep things clean */
const WaveSVG = ({ color, opacity }: { color: string; opacity: string }) => (
    <svg className={`h-full w-1/2 ${color}`} viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ opacity }}>
        <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5,73.84-4.36,147.54,16.88,218.2,35.26,69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113,14.29,1200,52.47V0Z"></path>
    </svg>
);

export default PirateShipButton;
