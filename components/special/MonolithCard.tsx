import React from 'react';
import PrideSpace from './PrideSpace';
import SwipeShop from './SwipeShop';
import PirateShipButton from './PirateShipButton';

interface Entry {
    id: string;
    title: string;
    date: string;
    content: string;
    status: string;
    achievements: string[];
    artifacts: any[];
    youtubeUrl?: string;
    audioUrl?: string;
    photonPayloadUrl?: string;
}

interface MonolithCardProps {
    entry: Entry;
    isExpanded: boolean;
    onToggle: () => void;
}

const MonolithCard: React.FC<MonolithCardProps> = ({ entry, isExpanded, onToggle }) => {
    return (
        <div
            className={`relative transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3 scale-100 z-50' : 'hover:scale-105 active:scale-95'
                }`}
        >
            <div
                onClick={!isExpanded ? onToggle : undefined}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer ${isExpanded
                    ? 'bg-slate-900/90 border-white/20 shadow-2xl backdrop-blur-3xl p-8 md:p-12 max-h-[90vh] overflow-y-auto custom-scrollbar'
                    : 'bg-white/5 border-white/10 hover:border-cyan-500/50 hover:bg-white/10 shadow-lg p-6 h-full'
                    }`}
            >
                {/* Holographic Border Glow (Hover) */}
                {!isExpanded && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-tr from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />
                )}

                {/* Card Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className="text-cyan-400 font-mono text-[10px] tracking-widest uppercase">
                            Entry_{entry.id} // {entry.date}
                        </span>
                        <h3 className={`font-bold transition-all duration-500 ${isExpanded ? 'text-4xl md:text-5xl mt-2 mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400' : 'text-xl text-white'}`}>
                            {entry.title}
                        </h3>
                    </div>
                    {isExpanded && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggle(); }}
                            className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Content Section */}
                <div className={`prose prose-invert max-w-none transition-all duration-700 ${isExpanded ? 'opacity-100 mt-8' : 'opacity-60 line-clamp-3'}`}>
                    <p className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap">
                        {entry.content}
                    </p>

                    {isExpanded && (
                        <div className="mt-12 space-y-12">
                            {/* Multimedia Section */}
                            {(entry.youtubeUrl || entry.audioUrl || entry.photonPayloadUrl) && (
                                <div className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/10">
                                    <h4 className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.2em] mb-4">Gniazda Multimedialne</h4>

                                    {entry.youtubeUrl && (
                                        <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                                            <iframe
                                                width="100%"
                                                height="100%"
                                                src={entry.youtubeUrl.includes('list=')
                                                    ? entry.youtubeUrl.replace('playlist?list=', 'embed/videoseries?list=').replace('watch?v=', 'embed/')
                                                    : entry.youtubeUrl.replace('watch?v=', 'embed/')}
                                                title="YouTube video player"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            ></iframe>
                                        </div>
                                    )}

                                    {entry.audioUrl && (
                                        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/10">
                                            <p className="text-xs text-cyan-400 font-mono mb-2">AUDIO_STREAM // PODCAST</p>
                                            <audio controls className="w-full h-10 accent-cyan-500">
                                                <source src={entry.audioUrl} type="audio/mpeg" />
                                                Your browser does not support the audio element.
                                            </audio>
                                        </div>
                                    )}


                                    {entry.photonPayloadUrl && (
                                        <div className="pt-4 mt-4 border-t border-cyan-500/10">
                                            <PirateShipButton url={entry.photonPayloadUrl} />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                {/* Left Column: Achievements & Stats */}
                                <div className="space-y-8">
                                    <div className="p-6 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                                        <h4 className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                                            Kwantowy Status
                                        </h4>
                                        <p className="text-white text-xl font-light italic">"{entry.status}"</p>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.2em]">Osiągnięcia Suwerena</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {entry.achievements.map((ach, idx) => (
                                                <span key={idx} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
                                                    ✨ {ach}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Space of Pride */}
                                <div className="h-full">
                                    <h4 className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.2em] mb-4 text-center">Przestrzeń Dumy (Co-Bots Celebration)</h4>
                                    <PrideSpace entryId={entry.id} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Swipe Shop integration */}
                {isExpanded && (
                    <div className="mt-16 border-t border-white/10 pt-12">
                        <h4 className="text-center text-slate-500 font-mono text-[10px] uppercase tracking-[0.5em] mb-8">Gestowy Sklep Artefaktów ($GRV)</h4>
                        <SwipeShop items={entry.artifacts} />
                    </div>
                )}

                {/* Expand Indicator (Collapsed only) */}
                {!isExpanded && (
                    <div className="mt-6 flex items-center gap-2 text-[10px] font-mono text-cyan-500/50 group-hover:text-cyan-400 transition-colors">
                        <span>EXPAND_MONOLITH</span>
                        <div className="h-px flex-1 bg-cyan-500/20 group-hover:bg-cyan-400/40" />
                        <svg className="w-3 h-3 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonolithCard;
