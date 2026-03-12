import React, { useRef, useEffect } from 'react';
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
    youtubeId?: string;   // ← czyste YouTube ID (video lub playlist)
    youtubeUrl?: string;  // fallback (stary format)
    audioUrl?: string;
    photonPayloadUrl?: string;
    isTranslationMissing?: boolean;
}

interface MonolithCardProps {
    entry: Entry;
    isExpanded: boolean;
    onToggle: () => void;
    lang?: 'pl' | 'en';
}

// ── Labels ───────────────────────────────────────────────────────────────────
const L = {
    multimedia: { pl: 'Gniazda Multimedialne', en: 'Media Nodes' },
    podcast: { pl: 'STRUMIEŃ // PODCAST', en: 'AUDIO STREAM // PODCAST' },
    status: { pl: 'Kwantowy Status', en: 'Quantum Status' },
    achievements: { pl: 'Osiągnięcia Suwerena', en: 'Sovereign Achievements' },
    prideSpace: { pl: 'Przestrzeń Dumy', en: 'Space of Pride' },
    prideSubtitle: { pl: 'Celebracja Co-Botów', en: 'Co-Bot Celebration' },
    shop: { pl: 'Gestowy Sklep Artefaktów', en: 'Gesture Artifact Shop' },
    expand: { pl: 'ROZWIŃ_MONOLIT', en: 'EXPAND_MONOLITH' },
    translating: { pl: '', en: '[ English translation is crystallizing... ]' },
};
const t = (key: keyof typeof L, lang: 'pl' | 'en' = 'pl') => L[key][lang];

// ── YouTube embed URL builder ─────────────────────────────────────────────────
const buildYoutubeSrc = (id?: string, fallbackUrl?: string): string => {
    const raw = id || '';
    if (!raw && !fallbackUrl) return '';

    // If raw is a clean ID/playlist prefix
    if (raw) {
        const isPlaylist = raw.startsWith('PL') || raw.startsWith('UU') || raw.startsWith('RD') || raw.startsWith('LL');
        if (isPlaylist) return `https://www.youtube.com/embed/videoseries?list=${raw}&modestbranding=1&rel=0`;
        // Single video ID (typically 11 chars)
        if (raw.length >= 8 && !raw.includes('/') && !raw.includes('=')) {
            return `https://www.youtube.com/embed/${raw}?modestbranding=1&rel=0`;
        }
    }

    // Fallback: try to extract from legacy URL
    if (fallbackUrl) {
        const listMatch = fallbackUrl.match(/[?&]list=([^&]+)/);
        if (listMatch) return `https://www.youtube.com/embed/videoseries?list=${listMatch[1]}&modestbranding=1&rel=0`;
        const vidMatch = fallbackUrl.match(/(?:v=|embed\/|youtu\.be\/)([^?&/]+)/);
        if (vidMatch) return `https://www.youtube.com/embed/${vidMatch[1]}?modestbranding=1&rel=0`;
    }
    return '';
};

// ── MonolithCard ─────────────────────────────────────────────────────────────
const MonolithCard: React.FC<MonolithCardProps> = ({ entry, isExpanded, onToggle, lang = 'pl' }) => {
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded && cardRef.current) {
            setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        }
    }, [isExpanded]);

    const youtubeSrc = buildYoutubeSrc(entry.youtubeId, entry.youtubeUrl);

    return (
        <div
            ref={cardRef}
            className={`
        relative transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${isExpanded
                    ? 'col-span-1 md:col-span-2 lg:col-span-3 z-50'
                    : 'hover:scale-[1.03] active:scale-[0.97]'}
      `}
        >
            <div
                onClick={!isExpanded ? onToggle : undefined}
                className={`
          group relative overflow-hidden rounded-2xl border transition-all duration-500
          ${isExpanded
                        ? 'cursor-default bg-[#0a0f1e]/95 border-slate-700/50 shadow-[0_0_60px_rgba(6,182,212,0.08)] backdrop-blur-3xl p-8 md:p-12 overflow-y-auto max-h-[85vh] custom-scrollbar'
                        : 'cursor-pointer bg-white/[0.04] border-white/[0.08] hover:border-cyan-500/40 hover:bg-white/[0.07] shadow-lg p-6 h-full'}
        `}
            >
                {/* Collapsed glow overlays */}
                {!isExpanded && (
                    <>
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-cyan-500/10 via-transparent to-violet-500/10 pointer-events-none rounded-2xl" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl"
                            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(34,211,238,0.06) 0%, transparent 70%)' }} />
                    </>
                )}

                {/* ── Card Header ── */}
                <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 min-w-0">
                        <span className="block text-cyan-400/60 font-mono text-[9px] tracking-[0.3em] uppercase mb-1 select-none">
                            ENTRY_{entry.id}&nbsp;·&nbsp;{entry.date}
                        </span>
                        <h3 className={`font-bold leading-tight transition-all duration-500 ${isExpanded
                                ? 'text-3xl md:text-4xl mt-2 mb-3 bg-clip-text text-transparent bg-gradient-to-br from-white via-slate-100 to-slate-400'
                                : 'text-base md:text-lg text-white leading-snug'
                            }`}>
                            {entry.title}
                        </h3>
                    </div>
                    {isExpanded && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggle(); }}
                            className="ml-4 shrink-0 w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 hover:border-white/30 text-slate-400 hover:text-white transition-all duration-200 flex items-center justify-center"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* ── Collapsed preview ── */}
                {!isExpanded && (
                    <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 opacity-60">
                        {entry.content}
                    </p>
                )}

                {/* ── Expanded body ── */}
                {isExpanded && (
                    <div className="space-y-12">

                        {/* Przestrzeń Dumania */}
                        <div className="relative">
                            <div className="absolute -inset-4 rounded-3xl pointer-events-none"
                                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.04) 0%, transparent 70%)' }} />
                            {/* Fallback notice for missing EN translation */}
                            {entry.isTranslationMissing && (
                                <p className="relative mb-4 font-mono text-[10px] tracking-[0.3em] text-cyan-500/40 italic">
                                    {t('translating', lang)}
                                </p>
                            )}
                            <p className="relative text-slate-200 text-[1.05rem] leading-[1.9] whitespace-pre-wrap font-light tracking-wide">
                                {entry.content}
                            </p>
                        </div>

                        {/* Multimedia */}
                        {(youtubeSrc || entry.audioUrl || entry.photonPayloadUrl) && (
                            <div className="space-y-5 bg-white/[0.03] p-6 rounded-2xl border border-white/[0.07]">
                                <p className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.35em]">
                                    {t('multimedia', lang)}
                                </p>

                                {youtubeSrc && (
                                    <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
                                        <iframe
                                            key={youtubeSrc}
                                            width="100%"
                                            height="100%"
                                            src={youtubeSrc}
                                            title={entry.title}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                            className="w-full h-full"
                                        />
                                    </div>
                                )}

                                {entry.audioUrl && (
                                    <div className="bg-slate-900/60 px-5 py-4 rounded-xl border border-white/[0.07]">
                                        <p className="text-[9px] text-cyan-400/70 font-mono tracking-[0.3em] uppercase mb-3">
                                            {t('podcast', lang)}
                                        </p>
                                        <audio controls className="w-full h-9 accent-cyan-500">
                                            <source src={entry.audioUrl} type="audio/mpeg" />
                                        </audio>
                                    </div>
                                )}

                                {entry.photonPayloadUrl && (
                                    <div className="pt-3 border-t border-cyan-500/10">
                                        <PirateShipButton url={entry.photonPayloadUrl} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Status + Achievements + Pride */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="space-y-7">
                                {/* Status */}
                                <div className="relative p-5 rounded-xl overflow-hidden bg-cyan-500/[0.04] border border-cyan-500/20">
                                    <div className="absolute inset-0 pointer-events-none"
                                        style={{ background: 'radial-gradient(circle at 0% 50%, rgba(34,211,238,0.07) 0%, transparent 60%)' }} />
                                    <h4 className="relative text-cyan-400 font-mono text-[9px] uppercase tracking-[0.35em] mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                                        {t('status', lang)}
                                    </h4>
                                    <p className="relative text-white text-lg font-light italic leading-relaxed">"{entry.status}"</p>
                                </div>

                                {/* Achievements */}
                                <div className="space-y-3">
                                    <h4 className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.35em]">
                                        {t('achievements', lang)}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {entry.achievements.map((ach, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-white/80 border border-white/[0.08] bg-white/[0.04] hover:border-cyan-500/40 hover:bg-cyan-500/[0.07] transition-all duration-200">
                                                <span className="text-[9px] text-cyan-400/60">✦</span> {ach}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Pride Space */}
                            <div>
                                <h4 className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.35em] mb-4 text-center">
                                    {t('prideSpace', lang)} <span className="text-slate-700">·</span> {t('prideSubtitle', lang)}
                                </h4>
                                <PrideSpace entryId={entry.id} />
                            </div>
                        </div>

                        {/* Swipe Shop */}
                        {entry.artifacts?.length > 0 && (
                            <div className="pt-10 border-t border-white/[0.06]">
                                <h4 className="text-center text-slate-600 font-mono text-[9px] uppercase tracking-[0.5em] mb-8">
                                    {t('shop', lang)} ($GRV)
                                </h4>
                                <SwipeShop items={entry.artifacts} />
                            </div>
                        )}
                    </div>
                )}

                {/* Expand indicator (collapsed) */}
                {!isExpanded && (
                    <div className="mt-5 flex items-center gap-2 text-[9px] font-mono text-cyan-500/40 group-hover:text-cyan-400/70 transition-colors duration-300">
                        <span className="tracking-widest">{t('expand', lang)}</span>
                        <div className="h-px flex-1 bg-cyan-500/15 group-hover:bg-cyan-400/30 transition-colors" />
                        <svg className="w-2.5 h-2.5 rotate-45 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonolithCard;
