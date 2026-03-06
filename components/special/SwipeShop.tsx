import React, { useRef } from 'react';

interface Artifact {
    id: string;
    name: string;
    price: string;
    image: string;
}

const SwipeShop: React.FC<{ items: Artifact[] }> = ({ items }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
        <div className="relative group/shop">
            {/* Swipe Navigation Hints */}
            <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-cyan-500/30 hidden lg:block opacity-0 group-hover/shop:opacity-100 transition-opacity">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 19l-7-7 7-7" />
                </svg>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide px-4"
            >
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="flex-shrink-0 w-[280px] snap-center group/card"
                    >
                        <div className="bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-2xl p-6 transition-all duration-500 hover:border-cyan-500/40 relative overflow-hidden">
                            {/* Scanline Effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 h-1/2 top-0 -translate-y-full group-hover/card:animate-[scan_2s_linear_infinite]" />

                            <div className="h-40 flex items-center justify-center mb-6 relative">
                                <div className="absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                <img src={item.image} alt={item.name} className="w-32 h-32 object-contain relative z-10 transition-transform duration-700 group-hover/card:scale-110 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                            </div>

                            <div className="text-center relative z-10">
                                <h5 className="text-white font-medium mb-1">{item.name}</h5>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-cyan-400 font-mono text-sm tracking-tighter">{item.price}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_cyan]" />
                                </div>
                            </div>

                            <button className="w-full mt-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-[10px] tracking-[0.2em] transition-all hover:bg-cyan-500 hover:text-black hover:border-cyan-500 uppercase overflow-hidden relative group/btn">
                                <span className="relative z-10">BUY_ARTIFACT</span>
                                <div className="absolute inset-0 bg-white translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Placeholder for more */}
                <div className="flex-shrink-0 w-[280px] snap-center flex items-center justify-center border-2 border-dashed border-white/5 rounded-2xl group/more cursor-pointer hover:bg-white/5 transition-colors">
                    <div className="text-center space-y-2 opacity-30 group-hover:opacity-100 transition-opacity">
                        <svg className="w-12 h-12 mx-auto text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="font-mono text-[10px] tracking-widest uppercase">Mining Near...</p>
                    </div>
                </div>
            </div>

            <div className="absolute -right-12 top-1/2 -translate-y-1/2 text-cyan-500/30 hidden lg:block opacity-0 group-hover/shop:opacity-100 transition-opacity">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5l7 7-7 7" />
                </svg>
            </div>

            <style>{`
        @keyframes scan {
          from { transform: translateY(-100%); }
          to { transform: translateY(200%); }
        }
      `}</style>
        </div>
    );
};

export default SwipeShop;
