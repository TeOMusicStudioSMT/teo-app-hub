import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc3 } from 'lucide-react';
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
    const [msg, setMsg] = useState('');
    
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

    if (radio.isMinimized) {
        return createPortal(
            <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 2147483647 }}>
                <button 
                    onClick={() => radio.setIsMinimized(false)} 
                    className="w-14 h-14 rounded-full bg-amber-950 border-2 border-amber-500 text-amber-500 flex items-center justify-center hover:scale-110 shadow-[0_0_20px_rgba(201,149,58,0.9)] relative"
                    title="Rozwiń Katedrę"
                >
                    <Disc3 size={32} className="animate-spin" style={{ animationDuration: '3s' }} />
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-black ${radio.wiesioAlive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`} title={radio.wiesioAlive ? "Wiesław Aktywny" : "Wiesław Uśpiony"} />
                </button>
            </div>,
            document.body
        );
    }

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

                <div style={playerInnerStyle}>
                    {/* Header: Wyzwalacz Minimalizacji & Status Wiesława */}
                    <div className="flex justify-between items-center px-4 pt-2 pb-0">
                       <div className="flex items-center gap-1.5">
                           <div className={`w-2 h-2 rounded-full ${radio.wiesioAlive ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                           <span className="text-[8px] font-mono tracking-tighter opacity-50">
                               WIESŁAW: {radio.wiesioAlive ? 'AKTYWNY' : 'UŚPIONY'}
                           </span>
                       </div>
                       <button 
                         onClick={() => radio.setIsMinimized(!radio.isMinimized)} 
                         style={{ ...btnStyle, fontSize: '10px', opacity: 0.5 }}
                       >
                         {radio.isMinimized ? '＋' : '−'}
                       </button>
                    </div>

                    <div className="flex flex-col gap-3 w-full p-4 pt-1">
                        {/* Piętro GZ: Tytuł i Wizualizacja */}
                        <div className="flex items-center gap-3">
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

                            <div style={infoStyle}>
                                <div 
                                    style={{
                                        ...trackTitleStyle,
                                        color: radio.error ? 'rgba(245, 158, 11, 0.5)' : '#e9d5ff'
                                    }} 
                                    title={radio.currentTrack?.title}
                                >
                                    {radio.isLoading
                                        ? '⟳ INICJALIZACJA...'
                                        : radio.error
                                            ? 'ASYSTENT GOTOWY'
                                            : radio.currentTrack?.title ?? 'BRAK DANYCH'
                                    }
                                </div>
                            </div>
                        </div>

                        {/* Piętro FoGrA: Suwak (100% szerokości) */}
                        <div className="flex flex-col gap-1 w-full relative z-10">
                            <div style={seekerContainerStyle}>
                                <input 
                                    type="range" 
                                    min={0} 
                                    max={radio.duration || 0.01} 
                                    value={radio.currentTime} 
                                    onChange={(e) => radio.seekTo(Number(e.target.value))}
                                    style={seekerStyle}
                                    className="fogra-seeker w-full"
                                />
                            </div>
                            <div className="flex justify-between w-full text-[9px] font-mono text-amber-500/70">
                                <span>{formatTime(radio.currentTime)}</span>
                                <span>{formatTime(radio.duration)}</span>
                            </div>
                        </div>

                        {/* Piętro Kontroli: Przyciski */}
                        <div className="flex items-center justify-center gap-4 relative z-20 pt-1">
                            <button style={btnStyle} onClick={radio.prev}>⏮</button>
                            <button
                                style={{ ...btnStyle, ...playBtnStyle, fontSize: '18px', padding: '10px' }}
                                onClick={radio.toggle}
                            >
                                {radio.isPlaying ? '⏸' : '▶'}
                            </button>
                            <button style={btnStyle} onClick={radio.next}>⏭</button>

                            <button 
                                style={{ 
                                    ...btnStyle, 
                                    color: radio.isRecording ? '#ef4444' : 'rgba(255,255,255,0.4)',
                                    position: 'relative'
                                }} 
                                onClick={radio.toggleRecording}
                                className={radio.isRecording ? 'podcat-rec-active' : ''}
                            >
                                🔴 <span style={{ fontSize: '7px', position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)' }}>REC</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Selekcja Aury Rady */}
                <div style={auraPanelStyle}>
                    {(['default', 'bob', 'wieslaw', 'adamus'] as const).map(aura => (
                            <button
                                key={aura}
                                onClick={() => {
                                    const colorsMap: Record<string, string> = {
                                        default: '#fbbf24', bob: '#22d3ee', wieslaw: '#f97316', adamus: '#a855f7'
                                    };
                                    const namesMap: Record<string, string> = {
                                        default: 'SYSTEM', bob: 'BOB', wieslaw: 'WIESŁAW', adamus: 'ADAMUS'
                                    };
                                    radio.speakMessage({
                                        agentId: aura === 'default' ? 'teo' : aura,
                                        agentName: namesMap[aura],
                                        color: colorsMap[aura],
                                        message: `Ręczna zmiana aury na: ${aura.toUpperCase()}`
                                    });
                                }}
                                style={{
                                    ...auraDotStyle,
                                    backgroundColor: aura === 'default' ? '#fbbf24' : 
                                                    aura === 'bob' ? '#22d3ee' :
                                                    aura === 'wieslaw' ? '#f97316' : '#a855f7',
                                    opacity: radio.activeAura?.agentId === (aura === 'default' ? 'teo' : aura) ? 1 : 0.3,
                                    transform: radio.activeAura?.agentId === (aura === 'default' ? 'teo' : aura) ? 'scale(1.2)' : 'scale(1)',
                                    boxShadow: radio.activeAura?.agentId === (aura === 'default' ? 'teo' : aura) ? `0 0 10px currentColor` : 'none',
                                    color: aura === 'default' ? '#fbbf24' : 
                                        aura === 'bob' ? '#22d3ee' :
                                        aura === 'wieslaw' ? '#f97316' : '#a855f7',
                                }}
                                title={`Aura: ${aura.toUpperCase()}`}
                            />
                    ))}
                </div>

                {/* Konsola Komunikacyjna Rady */}
                <div style={commPanelStyle}>
                    <input 
                        type="text" 
                        placeholder="MELDUNEK..." 
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                        style={commInputStyle}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && msg) {
                                radio.speakMessage({
                                    agentId: 'bob',
                                    agentName: 'BOB',
                                    color: '#22d3ee',
                                    message: msg
                                });
                                setMsg('');
                            }
                        }}
                    />
                    <div style={commBtnRowStyle}>
                        {(['adamus', 'bob', 'wieslaw'] as const).map(p => (
                            <button
                                key={p}
                                    onClick={() => {
                                        if (!msg) return;
                                        const colorsMap: Record<string, string> = {
                                            adamus: '#a855f7', bob: '#22d3ee', wieslaw: '#f97316'
                                        };
                                        radio.speakMessage({
                                            agentId: p,
                                            agentName: p.toUpperCase(),
                                            color: colorsMap[p],
                                            message: msg
                                        });
                                        setMsg('');
                                    }}
                                style={{
                                    ...commBtnStyle,
                                    borderColor: p === 'adamus' ? '#a855f7' : p === 'bob' ? '#22d3ee' : '#f97316',
                                    color: p === 'adamus' ? '#a855f7' : p === 'bob' ? '#22d3ee' : '#f97316',
                                }}
                            >
                                {p[0].toUpperCase()}
                            </button>
                        ))}
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
    zIndex: 999999,
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
    display: 'flex', flexDirection: 'column', width: '100%'
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
    color: 'rgba(251, 191, 36, 0.6)', letterSpacing: '0.05em', // amber-400
    marginTop: 2,
};

const seekerContainerStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', marginTop: 6,
};

const seekerStyle: React.CSSProperties = {
    flex: 1, height: 4, appearance: 'none', background: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 2, cursor: 'pointer', outline: 'none',
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

const auraPanelStyle: React.CSSProperties = {
    display: 'flex', gap: 8, padding: '0 16px 8px', justifyContent: 'center',
};

const auraDotStyle: React.CSSProperties = {
    width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
    transition: 'all 0.3s ease', padding: 0,
};

const commPanelStyle: React.CSSProperties = {
    padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6,
};

const commInputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(180, 100, 255, 0.1)',
    borderRadius: 8, padding: '6px 10px', fontSize: '10px', color: '#e9d5ff',
    outline: 'none', fontFamily: "'JetBrains Mono', monospace",
};

const commBtnRowStyle: React.CSSProperties = {
    display: 'flex', gap: 6,
};

const commBtnStyle: React.CSSProperties = {
    flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid',
    borderRadius: 6, fontSize: '9px', padding: '4px 0', cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold',
    transition: 'all 0.2s',
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
  
  .fogra-seeker::-webkit-slider-thumb {
    background: #f59e0b !important; /* amber-500 */
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.8) !important;
    width: 6px !important;
    height: 12px !important;
    border-radius: 2px !important;
  }
  .fogra-seeker {
    accent-color: #f59e0b;
  }

  @keyframes podcat-pulse {
    0% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); text-shadow: 0 0 10px rgba(239, 68, 68, 0.8); }
    100% { opacity: 0.6; transform: scale(1); }
  }
  .podcat-rec-active {
    animation: podcat-pulse 1.2s infinite ease-in-out;
  }

  input::placeholder {
    color: rgba(180, 100, 255, 0.3);
    font-size: 8px;
    letter-spacing: 0.1em;
  }
`;
