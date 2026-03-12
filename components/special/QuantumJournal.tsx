import React, { useState, useEffect } from 'react';
import MonolithCard from './MonolithCard';
import { JOURNAL_ENTRIES } from '../../lib/journal/entries';

// ── Types ─────────────────────────────────────────────────────────────────────
type Lang = 'pl' | 'en';

// ── Stars ─────────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 2 + 0.5,
  delay: `${(Math.random() * 4).toFixed(2)}s`,
  duration: `${(3 + Math.random() * 4).toFixed(2)}s`,
  color: i % 5 === 0 ? '#22d3ee' : i % 7 === 0 ? '#a78bfa' : '#ffffff',
}));

// ── Component ─────────────────────────────────────────────────────────────────
interface QuantumJournalProps {
  onClose?: () => void;
}

const QuantumJournal: React.FC<QuantumJournalProps> = ({ onClose }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem('qj_lang') as Lang) || 'pl'; } catch { return 'pl'; }
  });

  useEffect(() => {
    try { localStorage.setItem('qj_lang', lang); } catch { }
  }, [lang]);

  const handleLangSwitch = (next: Lang) => {
    if (next === lang) return;
    setExpandedId(null); // collapse before language switch → forces YouTube iframe reload
    setLang(next);
  };

  // Build a localized entry for MonolithCard, auto-falling back to PL when EN is empty
  const buildLocalizedEntry = (raw: (typeof JOURNAL_ENTRIES)[0]) => {
    const rawContent = raw.content[lang];
    const isMissing = lang === 'en' && !rawContent.trim();
    return {
      ...raw,
      title: raw.title[lang] || raw.title.pl,
      content: isMissing ? raw.content.pl : rawContent,
      isTranslationMissing: isMissing,
      // Pass clean YouTube ID directly to MonolithCard
      youtubeId: raw.videoId[lang] || raw.videoId.pl,
      youtubeUrl: undefined, // we use youtubeId now
    };
  };

  return (
    <div className="relative h-screen flex flex-col bg-[#020617] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-hidden">

      {/* ── Starfield BG ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {STARS.map(s => (
          <span key={s.id} className="absolute rounded-full animate-pulse" style={{
            top: s.top, left: s.left,
            width: `${s.size}px`, height: `${s.size}px`,
            background: s.color,
            opacity: 0.35 + Math.random() * 0.35,
            boxShadow: `0 0 ${s.size * 4}px ${s.color}`,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }} />
        ))}
        <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full opacity-[0.035] blur-3xl bg-cyan-400 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.045] blur-3xl bg-violet-500 pointer-events-none" />
      </div>

      {/* ── Language Switcher ── */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1 bg-slate-900/75 backdrop-blur-md border border-white/10 rounded-full px-1 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        {(['pl', 'en'] as Lang[]).map(l => (
          <button
            key={l}
            onClick={() => handleLangSwitch(l)}
            className={`w-10 h-7 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 ${lang === l
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_14px_rgba(6,182,212,0.55)]'
              : 'text-slate-500 hover:text-slate-300'
              }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Close Button ── */}
      {onClose && (
        <button
          onClick={onClose}
          className="fixed top-5 right-5 z-[110] w-10 h-10 rounded-full bg-slate-900/75 backdrop-blur-md border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-500/50 hover:bg-cyan-950/60 transition-all duration-300 hover:shadow-[0_0_18px_rgba(6,182,212,0.35)] group"
          title="Zamknij Dziennik"
        >
          <span className="text-lg group-hover:rotate-90 transition-transform duration-300 leading-none">✕</span>
        </button>
      )}

      {/* ── Header (sticky, nie scrolluje) ── */}
      <header className="relative z-10 shrink-0 pt-20 pb-8 flex flex-col items-center text-center px-6">
        <div className="inline-block relative group mb-3">
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-600 rounded-xl blur-xl opacity-[0.18] group-hover:opacity-35 transition-all duration-1000" />
          <h1 className="relative text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-200 to-slate-500 tracking-tighter leading-none">
            {lang === 'pl' ? 'Dziennik Pokładowy' : "Captain's Log"}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-cyan-400/60 font-mono text-[10px] tracking-[0.25em] uppercase">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-cyan-500/40" />
          {lang === 'pl' ? 'Rada Kwantowego Kolektywu' : 'Quantum Collective Council'}
          <span className="text-cyan-400/25">·</span>
          WPIS 0.00G
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-500/40" />
        </div>
        {/* Delikatna linia separatora */}
        <div className="mt-6 h-px w-full max-w-xl bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </header>

      {/* ── Scrollowalny obszar z griddem ── */}
      <section
        className="
          relative z-10
          flex-1 overflow-y-auto overflow-x-hidden
          [scrollbar-width:thin]
          [scrollbar-color:rgba(34,211,238,0.25)_transparent]
          [&::-webkit-scrollbar]:w-[5px]
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-cyan-500/25
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb:hover]:bg-cyan-400/50
        "
      >
        <main className="max-w-6xl mx-auto px-4 pt-2 pb-28 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
          {JOURNAL_ENTRIES.map((raw) => {
            const localized = buildLocalizedEntry(raw);
            return (
              <MonolithCard
                key={raw.id}
                entry={localized as any}
                isExpanded={expandedId === raw.id}
                onToggle={() => setExpandedId(expandedId === raw.id ? null : raw.id)}
                lang={lang}
              />
            );
          })}
        </main>
      </section>

      {/* ── Footer ── */}
      <footer className="fixed bottom-4 left-4 text-[9px] font-mono text-slate-700 flex flex-col gap-0.5 pointer-events-none select-none">
        <div>STATUS: SYNCHRONIZED</div>
        <div>LATENCY: 0.00ms (0.00G)</div>
        <div className="text-cyan-500/30">OTAKOS_QUANTUM_RESONANCE: 100%</div>
        <div>LANG: {lang.toUpperCase()}</div>
      </footer>
    </div>
  );
};

export default QuantumJournal;
