import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKatedraRadio } from '../context/KatedraRadioContext';

// Helper do formatowania czasu
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Minimalistyczna wizualizacja — słupki audio reaktywne
function AudioBars({ isPlaying, bassLevel }: { isPlaying: boolean; bassLevel: number }) {
    return (
        <div style={barsWrapStyle}>
            {[0.4, 0.8, 1, 0.7, 0.9, 0.5, 0.3].map((h, i) => {
                // Każdy słupek ma nieco inną czułość na bas
                const sensitivity = h * 0.25;
                const dynamicHeight = 4 + (bassLevel * sensitivity);
                
                return (
                    <motion.div
                        key={i}
                        style={barStyle}
                        animate={{
                            height: isPlaying ? Math.min(24, Math.max(4, dynamicHeight)) : 4,
                            opacity: isPlaying ? 0.5 + (bassLevel / 200) : 0.3,
                            backgroundColor: isPlaying && bassLevel > 60 ? '#c084fc' : '#a78bfa'
                        }}
                        transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 25
                        }}
                    />
                );
            })}
        </div>
    );
}

export function KatedraRadioPlayer() {
    const radio = useKatedraRadio();
    const [expanded, setExpanded] = useState(false);
    
    // Jeśli nic nie załadowano, pokaż przycisk startu
    if (radio.tracks.length === 0 && !radio.isLoading && !radio.error) {
        return (
            <button onClick={() => radio.loadPlaylist()} style={launchButtonStyle}>
                <span style={{ fontSize: '24px' }}>🎧</span>
                <span style={{ fontSize: '9px', letterSpacing: '0.15em', textAlign: 'center', lineHeight: '1.2' }}>
                    ASYSTENT<br />MUZYCZNY
                </span>
            </button>
        );
    }

    const progress = radio.duration > 0 ? (radio.currentTime / radio.duration) * 100 : 0;

    return (
        <div style={containerStyle}>
            <style>{playerCSS}</style>
            
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        style={playlistPanelStyle}
                    >
                        <div style={playlistHeaderStyle}>
                            <span>BIBLIOTEKA 0.00G</span>
                            <button onClick={() => setExpanded(false)} style={closeBtnStyle}>✕</button>
                        </div>
                        <div style={playlistScrollStyle}>
                            {radio.tracks.map((track, index) => (
                                <div 
                                    key={track.id} 
                                    style={{
                                        ...trackItemStyle,
                                        backgroundColor: radio.currentIndex === index ? 'rgba(180, 100, 255, 0.15)' : 'transparent',
                                        borderLeft: radio.currentIndex === index ? '2px solid #a78bfa' : '2px solid transparent'
                                    }}
                                    onClick={() => radio.setTrack(index)}
                                >
                                    <div style={trackIndexStyle}>{(index + 1).toString().padStart(2, '0')}</div>
                                    <div style={trackNameStyle}>
                                        <div style={{ color: radio.currentIndex === index ? '#e9d5ff' : '#a1a1aa' }}>
                                            {track.title}
                                        </div>
                                    </div>
                                    {radio.currentIndex === index && radio.isPlaying && (
                                        <div style={playingDotStyle} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                style={playerShellStyle}
                layout
                initial={false}
                animate={{ 
                    width: expanded ? 320 : 280,
                    height: 'auto'
                }}
            >
                {/* Pasek postępu u góry */}
                <div style={progressTrackStyle}>
                    <motion.div
                        style={progressFillStyle}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.2, ease: 'linear' }}
                    />
                </div>

                <div style={playerInnerStyle}>
                    {/* Wizualizacja / Ikona */}
                    <motion.div 
                        style={{
                            ...coverStyle,
                            boxShadow: radio.isPlaying 
                                ? `0 0 ${radio.bassLevel / 4}px rgba(180, 100, 255, ${radio.bassLevel / 100})` 
                                : 'none'
                        }} 
                        onClick={() => setExpanded(!expanded)}
                        animate={{ scale: radio.isPlaying ? 1 + (radio.bassLevel / 1000) : 1 }}
                    >
                        <AudioBars isPlaying={radio.isPlaying} bassLevel={radio.bassLevel} />
                    </motion.div>

                    {/* Info */}
                    <div style={infoStyle}>
                        <div style={trackTitleStyle} title={radio.currentTrack?.title}>
                            {radio.isLoading
                                ? '⟳ INICJALIZACJA...'
                                : radio.error
                                    ? '⚠ BŁĄD SYSTEMU'
                                    : radio.currentTrack?.title ?? 'BRAK DANYCH'
                            }
                        </div>
                        <div style={timeRowStyle}>
                            <span>{formatTime(radio.currentTime)}</span>
                            <span>{formatTime(radio.duration)}</span>
                        </div>
                    </div>

                    {/* Główne Kontrolki */}
                    <div style={controlsStyle}>
                        <button style={btnStyle} onClick={radio.prev}>⏮</button>
                        <button
                            style={{ ...btnStyle, ...playBtnStyle }}
                            onClick={radio.toggle}
                        >
                            {radio.isPlaying ? '⏸' : '▶'}
                        </button>
                        <button style={btnStyle} onClick={radio.next}>⏭</button>
                    </div>
                </div>

                {/* Sekcja dolna: Głośność i Status */}
                <div style={footerStyle}>
                    <div style={volumeControlStyle}>
                        <span style={{ fontSize: '10px', opacity: 0.5 }}>VOL</span>
                        <input
                            type="range" min={0} max={1} step={0.01}
                            value={radio.volume}
                            onChange={e => radio.setVolume(parseFloat(e.target.value))}
                            style={volumeSliderStyle}
                        />
                    </div>
                    <div style={statusStyle}>
                        {radio.isPlaying ? 'GRA' : 'PAUZA'}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ── Style ─────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 24,
    left: 24,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
};

const launchButtonStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '12px 18px',
    background: 'rgba(15, 10, 25, 0.92)',
    border: '1px solid rgba(180, 100, 255, 0.4)',
    borderRadius: 16, color: '#e9d5ff', cursor: 'pointer',
    backdropFilter: 'blur(16px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(180,100,255,0.15)',
    transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
    fontFamily: "'JetBrains Mono', monospace",
};

const playerShellStyle: React.CSSProperties = {
    background: 'rgba(15, 10, 25, 0.95)',
    border: '1px solid rgba(180, 100, 255, 0.2)',
    borderRadius: 16,
    backdropFilter: 'blur(24px)',
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    fontFamily: "'JetBrains Mono', monospace",
};

const playlistPanelStyle: React.CSSProperties = {
    width: 320,
    maxHeight: 400,
    background: 'rgba(10, 10, 15, 0.98)',
    border: '1px solid rgba(180, 100, 255, 0.2)',
    borderRadius: 16,
    backdropFilter: 'blur(32px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
};

const playlistHeaderStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '9px',
    letterSpacing: '0.2em',
    color: 'rgba(180, 100, 255, 0.6)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
};

const closeBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: '12px',
};

const playlistScrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
};

const trackItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '2px',
};

const trackIndexStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.2)',
    width: 24,
};

const trackNameStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '11px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const playingDotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    background: '#a78bfa',
    borderRadius: '50%',
    boxShadow: '0 0 10px #a78bfa',
};

const progressTrackStyle: React.CSSProperties = {
    height: 3, background: 'rgba(255,255,255,0.04)', position: 'relative',
};

const progressFillStyle: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, height: '100%',
    background: 'linear-gradient(90deg, #8b5cf6, #c084fc)',
};

const playerInnerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
};

const coverStyle: React.CSSProperties = {
    width: 50, height: 50, borderRadius: 12, flexShrink: 0,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
};

const infoStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
};

const trackTitleStyle: React.CSSProperties = {
    fontSize: '11px', color: '#e9d5ff', fontWeight: 600, letterSpacing: '0.02em',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};

const timeRowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', fontSize: '9px',
    color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em',
};

const controlsStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 2,
};

const btnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.4)', fontSize: '14px', padding: '6px',
    borderRadius: 8, transition: 'all 0.2s',
};

const playBtnStyle: React.CSSProperties = {
    color: '#e9d5ff',
    background: 'rgba(139, 92, 246, 0.2)',
};

const footerStyle: React.CSSProperties = {
    padding: '4px 16px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1px solid rgba(255,255,255,0.03)',
};

const volumeControlStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, flex: 0.6,
};

const volumeSliderStyle: React.CSSProperties = {
    flex: 1, height: 2, accentColor: '#8b5cf6', cursor: 'pointer',
};

const statusStyle: React.CSSProperties = {
    fontSize: '8px', letterSpacing: '0.2em', color: 'rgba(180, 100, 255, 0.5)',
};

const barsWrapStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 2,
};

const barStyle: React.CSSProperties = {
    width: 3, background: '#a78bfa', borderRadius: 1.5,
};

const playerCSS = `
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(180, 100, 255, 0.2); borderRadius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(180, 100, 255, 0.4); }
  
  button:hover { background: rgba(255,255,255,0.05); color: #fff !important; }
  input[type="range"] { -webkit-appearance: none; background: rgba(255,255,255,0.05); border-radius: 10px; }
  input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 8px; height: 8px; background: #c084fc; border-radius: 50%; box-shadow: 0 0 10px rgba(192,132,252,0.5); }
`;
