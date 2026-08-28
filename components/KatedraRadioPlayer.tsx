import React, { useState, useRef } from 'react';

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useKatedraRadio } from '../context/KatedraRadioContext';
import { QuantumForgeView } from './special/QuantumForgeView';
import { Camera } from 'lucide-react';
import { useAtom } from 'jotai';
import { currentLyricAtom, isKaraokeEnabledAtom } from '../store/visualizerStore';
import { Mic, FileText, Hammer } from 'lucide-react';
import { TeoKaraokeForge } from './special/TeoKaraokeForge';
import { TeOgochi } from './TeOgochi';
import { TeOgochiDom } from './TeOgochiDom';
import { TeogochiPanel } from './TeogochiPanel';
import { loadTeogochi, saveTeogochi, tickListening, stageOf } from '../lib/teogochiState';
import { aktywnyGatunek } from '../lib/teogochiStado';
import { getTunnelUrl, setTunnelUrl } from '../lib/bridgeService';
import WirTeogochi from './special/WirTeogochi';



// Helper do formatowania czasu
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface ParsedLyric {
    time: number;
    text: string;
}


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
    
    // Jotai State for Lyrics
    const [, setCurrentLyricGlobal] = useAtom(currentLyricAtom);
    
    React.useEffect(() => {
        setCurrentLyricGlobal(radio.currentLyric);
    }, [radio.currentLyric, setCurrentLyricGlobal]);
    
    // Quantum Forge States
    const [showQuantumForge, setShowQuantumForge] = useState(false);
    const [forgedDNAFile, setForgedDNAFile] = useState<File | null>(null);
    // Karaoke States
    const [isKaraokeEnabled, setIsKaraokeEnabled] = useAtom(isKaraokeEnabledAtom);
    const [showKaraokeForge, setShowKaraokeForge] = useState(false);
    const [syncLyrics, setSyncLyrics] = useState<ParsedLyric[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🔎 Filtr biblioteki — przy setkach ścieżek lista bez wyszukiwarki jest bezużyteczna
    const [query, setQuery] = useState('');
    // 🛰️ Czy komendy jadą przez tunel (a nie na lokalny Most) — pokazujemy to przy awarii
    const [tunelUrl, setTunelUrl] = useState<string>(() => getTunnelUrl());

    // 📂 Otwarcie Biblioteki samo zaciąga katalog (rekurencyjnie, z podfolderami
    // albumów). Bez tego panel witał pustką i trzeba było zgadnąć, że gdzieś jest 🔄.
    // `autoPlay=false` — pokazujemy ścieżki, nie napadamy dźwiękiem.
    React.useEffect(() => {
        if (expanded && radio.tracks.length === 0 && !radio.isLoading) {
            radio.loadPlaylist(undefined, false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded]);
    // 🧬 Wektory soniczne — komunikat po wysyłce do storyboardu
    const [sonicMsg, setSonicMsg] = useState<string | null>(null);
    const [sonicBusy, setSonicBusy] = useState(false);

    const handleSendToStoryboard = async () => {
        setSonicBusy(true);
        setSonicMsg('Liczę cięcia...');
        try {
            const r = await radio.sendToStoryboard();
            setSonicMsg(r.message);
        } finally {
            setSonicBusy(false);
        }
    };

    // 🐣 TeOgochi Dom — kompan mieszka przy radiu; słuchanie = karmienie
    const [showTeogochiDom, setShowTeogochiDom] = useState(false);
    const [teogochiEmoji, setTeogochiEmoji] = useState(() => stageOf(loadTeogochi().xp).emoji);
    React.useEffect(() => {
        if (!radio.isPlaying) return;
        const iv = setInterval(() => {
            const next = tickListening(loadTeogochi());
            saveTeogochi(next);
            setTeogochiEmoji(stageOf(next.xp).emoji);
        }, 60_000);
        return () => clearInterval(iv);
    }, [radio.isPlaying]);

    // 🎙️ Dyktowanie MELDUNKU głosem (zamiast pisania) — transkrypcja lokalnym Whisperem
    const [isMsgRecording, setIsMsgRecording] = useState(false);
    const [isMsgTranscribing, setIsMsgTranscribing] = useState(false);
    const msgRecorderRef = useRef<MediaRecorder | null>(null);
    const msgChunksRef = useRef<Blob[]>([]);

    const toggleMsgRecording = async () => {
        if (isMsgTranscribing) return;
        if (isMsgRecording) {
            msgRecorderRef.current?.stop();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            msgChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) msgChunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                setIsMsgRecording(false);
                setIsMsgTranscribing(true);
                try {
                    const blob = new Blob(msgChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(String(reader.result));
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    const res = await fetch('http://127.0.0.1:3001/api/voice/transcribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sample: base64 }),
                    });
                    const data = await res.json();
                    if (data.success && data.transcript) setMsg(data.transcript);
                } catch (err) {
                    console.error('[Asystent Muzyczny] ❌ Transkrypcja nie powiodła się:', err);
                } finally {
                    setIsMsgTranscribing(false);
                }
            };
            msgRecorderRef.current = recorder;
            recorder.start();
            setIsMsgRecording(true);
        } catch {
            console.error('[Asystent Muzyczny] ❌ Brak dostępu do mikrofonu.');
        }
    };



    const crystallizeDNA = async () => {
        const canvas = document.getElementById('katedra-canvas') as HTMLCanvasElement;
        if (!canvas) {
            console.error('Canvas not found!');
            return;
        }

        try {
            // Capture PNG
            const dataUrl = canvas.toDataURL('image/png');
            
            // Convert Base64 to Blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            // Create File
            const file = new File([blob], `VectorDNA_Snapshot_${Date.now()}.png`, { type: 'image/png' });
            
            setForgedDNAFile(file);
            setShowQuantumForge(true);
        } catch (error) {
            console.error('Crystallization failed:', error);
        }
    };

    // --- LOGIKA PARSOWANIA I SYNCHRONIZACJI LRC ---
    const parseLRC = (text: string) => {
        const lines = text.split('\n');
        const lrcRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        const parsed: ParsedLyric[] = [];

        lines.forEach(line => {
            const match = line.match(lrcRegex);
            if (match) {
                const mins = parseInt(match[1]);
                const secs = parseInt(match[2]);
                const ms = parseInt(match[3]);
                const time = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100);
                const text = match[4].trim();
                parsed.push({ time, text });
            }
        });
        
        parsed.sort((a, b) => a.time - b.time);
        setSyncLyrics(parsed);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            parseLRC(content);
            setIsKaraokeEnabled(true); // Auto-enable karaoke on upload
        };
        reader.readAsText(file);
    };

    // Synchronizacja w czasie rzeczywistym
    React.useEffect(() => {
        if (!syncLyrics.length || !isKaraokeEnabled) return;
        
        // Znajdź ostatnią linię, której czas jest mniejszy lub równy aktualnemu czasowi
        let currentLine = null;
        for (let i = syncLyrics.length - 1; i >= 0; i--) {
            if (radio.currentTime >= syncLyrics[i].time) {
                currentLine = syncLyrics[i];
                break;
            }
        }

        let currentText = "";
        if (currentLine) {
            // Jeśli minęło więcej niż 5 sekund od startu linii, wygaś ją (chyba że to długa fraza, ale 5s to bezpieczny standard)
            if (radio.currentTime < currentLine.time + 5) {
                currentText = currentLine.text;
            }
        }

        if (currentText !== radio.currentLyric) {
            radio.setCurrentLyric(currentText);
        }
    }, [radio.currentTime, syncLyrics, isKaraokeEnabled, radio]);

    
    // Resetuj napisy przy zmianie utworu (Ochrona Stanu)
    React.useEffect(() => {
        setSyncLyrics([]);
        radio.setCurrentLyric("");
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Umożliwia ponowne wgranie tego samego pliku
        }
    }, [radio.currentIndex]);


    // Jeśli nic nie załadowano, pokaż przycisk startu

    if (radio.tracks.length === 0 && !radio.isLoading && !radio.error) {
        // 🔎 PUŁAPKA (naprawiona 2026-07-30): samo `loadPlaylist()` zaciągało 137
        // utworów, ale odtwarzacz zwijał się zaraz potem w krążek 56×56 px, bo
        // `isMinimized` startuje jako `true`. Z perspektywy Suwerena wyglądało to
        // jak „katalog się nie ładuje" — dane były, tylko nie miał ich gdzie zobaczyć.
        // Klik na ten przycisk to jawna prośba „pokaż mi muzykę": rozwijamy Katedrę
        // i otwieramy Bibliotekę, żeby wynik był widoczny od razu.
        const odpalAsystenta = async () => {
            await radio.loadPlaylist();
            radio.setIsMinimized(false);
            setExpanded(true);
        };
        // 🌀 Zamiast pojedynczego przycisku „asystenta" — WIR. Kliknięcie rozwija
        // krążące TeOgochi ze stada; wybór Joanny odpala odtwarzacz tak jak dawniej,
        // bo muzyka to JEJ warsztat. Reszta gatunków ma panele w Domu TeOgochi.
        return <WirTeogochi naJoanne={() => { void odpalAsystenta(); }} />;
    }

    const progress = radio.duration > 0 ? (radio.currentTime / radio.duration) * 100 : 0;

    if (radio.isMinimized) {
        // 🌀 TU BYŁ KRĘCĄCY SIĘ WINYL. Teraz stoi wir: klik rozwija krążące
        // TeOgochi ze stada, a wybór Joanny rozwija odtwarzacz — bo muzyka to
        // JEJ warsztat. Kropka stanu Wiesia zostaje, bo mówi prawdę o moście.
        return createPortal(
            <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 2147483647 }}>
                <div style={{ position: 'relative' }}>
                    <WirTeogochi naJoanne={() => radio.setIsMinimized(false)} />
                    <div
                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-black ${radio.wiesioAlive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}
                        title={radio.wiesioAlive ? 'Wiesław Aktywny' : 'Wiesław Uśpiony'}
                        style={{ zIndex: 3, pointerEvents: 'none' }}
                    />
                </div>
            </div>,
            document.body
        );
    }

    return (
        <div style={containerStyle}>
            <style>{playerCSS}</style>

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
                                            ? 'TEOGOCHI GOTOWE'
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

                            <button 
                                style={{ ...btnStyle, color: 'rgba(255,255,255,0.6)' }}
                                onClick={crystallizeDNA}
                                title="Krystalizuj DNA (Screenshot)"
                            >
                                <Camera size={16} />
                            </button>
                        </div>

                        {/* --- MODUŁ KARAOKE --- */}
                        <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                            <button 
                                onClick={() => setIsKaraokeEnabled(!isKaraokeEnabled)}
                                style={{
                                    ...btnStyle,
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    fontSize: '9px',
                                    fontWeight: 'bold',
                                    border: `1px solid ${isKaraokeEnabled ? '#22d3ee' : 'rgba(255,255,255,0.1)'}`,
                                    background: isKaraokeEnabled ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                                    color: isKaraokeEnabled ? '#22d3ee' : 'rgba(255,255,255,0.4)',
                                    letterSpacing: '0.1em'
                                }}
                            >
                                <Mic size={12} />
                                [ KARAOKE: {isKaraokeEnabled ? 'ON' : 'OFF'} ]
                            </button>
                            
                            <button 
                                style={{
                                    ...btnStyle,
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    fontSize: '8px',
                                    opacity: 0.6,
                                    border: '1px dashed rgba(255,255,255,0.2)',
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <FileText size={10} />
                                [ 📄 WGRAJ PLIK .LRC ]
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                accept=".lrc" 
                                onChange={handleFileUpload} 
                                style={{ display: 'none' }} 
                            />


                            <button 
                                style={{
                                    ...btnStyle,
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    fontSize: '8px',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    color: '#10b981',
                                }}
                                onClick={() => setShowKaraokeForge(true)}
                            >
                                <Hammer size={10} />
                                [ 🔨 KREATOR LRC (SYNC) ]
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
                    <button
                        onClick={() => radio.setIsAutoAura(!radio.isAutoAura)}
                        style={{ ...btnStyle, fontSize: '9px', marginLeft: 8, padding: '2px 6px', color: radio.isAutoAura ? '#22d3ee' : 'rgba(255,255,255,0.4)', border: radio.isAutoAura ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.1)' }}
                    >
                        🔄 AUTO-AURA
                    </button>
                    <button
                        onClick={() => radio.setAutoAdvance(!radio.autoAdvance)}
                        title={radio.autoAdvance ? 'Po utworze gra następny (kliknij: stop na końcu — np. do nagrań)' : 'Stop na końcu utworu — nic nie przeskoczy podczas nagrania'}
                        style={{ ...btnStyle, fontSize: '9px', marginLeft: 4, padding: '2px 6px', color: radio.autoAdvance ? '#4ade80' : '#fbbf24', border: radio.autoAdvance ? '1px solid #4ade80' : '1px solid #fbbf24' }}
                    >
                        {radio.autoAdvance ? '⏭ AUTO-NEXT' : '⏹ STOP NA KOŃCU'}
                    </button>
                </div>

                {/* Konsola Komunikacyjna Rady */}
                <div style={commPanelStyle}>
                    <input
                        type="text"
                        placeholder={isMsgTranscribing ? 'Rozpoznaję mowę...' : 'MELDUNEK...'}
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
                    <button
                        type="button"
                        onClick={toggleMsgRecording}
                        disabled={isMsgTranscribing}
                        title={isMsgRecording ? 'Zatrzymaj nagrywanie' : 'Dyktuj meldunek'}
                        style={{
                            ...commBtnStyle,
                            borderColor: isMsgRecording ? '#ef4444' : 'rgba(255,255,255,0.2)',
                            color: isMsgRecording ? '#ef4444' : 'rgba(255,255,255,0.6)',
                            opacity: isMsgTranscribing ? 0.5 : 1,
                        }}
                    >
                        <Mic size={12} />
                    </button>
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

            {/* ── Biblioteka 0.00G — wyjeżdża W PRAWO od playera ─────── */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        key="playlist-panel"
                        initial={{ opacity: 0, x: -24, scale: 0.97 }}
                        animate={{ opacity: 1, x: 0,   scale: 1    }}
                        exit={{   opacity: 0, x: -24, scale: 0.97 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        style={playlistPanelStyle}
                    >
                        <div style={playlistHeaderStyle}>
                            <span>BIBLIOTEKA 0.00G {radio.tracks.length > 0 && <span style={{ opacity: 0.45 }}>· {radio.tracks.length}</span>}</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => radio.loadPlaylist()} title="Odśwież listę utworów z katalogu _OtakOs_Muzyka" style={closeBtnStyle}>🔄</button>
                                <button onClick={() => setExpanded(false)} style={closeBtnStyle}>✕</button>
                            </div>
                        </div>

                        {/* 🔎 Filtr — wybór ścieżki produkcyjnej z setek plików */}
                        {radio.tracks.length > 6 && (
                            <div style={{ padding: '6px 10px 0' }}>
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="szukaj ścieżki..."
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(180,100,255,0.22)',
                                        borderRadius: 8, padding: '5px 8px', fontSize: 9, color: '#e9d5ff',
                                        outline: 'none', fontFamily: "'JetBrains Mono', monospace",
                                    }}
                                />
                            </div>
                        )}
                        {/* 🐣 TeOgochi słucha razem z Tobą i komentuje co gra */}
                        <div style={{ padding: '6px 8px 0', position: 'relative' }}>
                            <div style={{ cursor: 'pointer' }} onClick={() => setShowTeogochiDom(v => !v)} title="Otwórz Dom TeOgochi">
                                <TeOgochi />
                            </div>
                            <button
                                onClick={() => setShowTeogochiDom(v => !v)}
                                title="Dom TeOgochi — karm, głaszcz, patrz jak rośnie"
                                style={{ position: 'absolute', top: 2, right: 12, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 8, fontSize: 12, padding: '2px 7px', cursor: 'pointer' }}
                            >
                                {teogochiEmoji} 🏠
                            </button>
                            {/* Panel TeOgochi przez portal na body */}
                            {createPortal(
                                <AnimatePresence>
                                    {showTeogochiDom && (
                                        <TeogochiPanel
                                            gatunekId={aktywnyGatunek()}
                                            onClose={() => setShowTeogochiDom(false)}
                                        />
                                    )}
                                </AnimatePresence>,
                                document.body
                            )}
                        </div>
                        {/* 🧬 GENERATOR WEKTORÓW SONICZNYCH — łącznik z montażownią Story V2 */}
                        <div style={{ margin: '8px 10px 0', padding: 8, borderRadius: 10, background: 'rgba(34,211,238,0.05)', border: `1px solid rgba(34,211,238,${radio.sonicReady ? 0.4 : 0.15})` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: radio.sonicReady ? 6 : 0 }}>
                                <span style={{ fontSize: 10 }}>🧬</span>
                                <span style={{ fontSize: 8, letterSpacing: '0.12em', color: radio.sonicReady ? '#67e8f9' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                                    {radio.sonicReady ? 'SONIC VECTOR READY' : 'WEKTORY: ZBIERAM...'}
                                </span>
                                {radio.sonicSet && (
                                    <span style={{ marginLeft: 'auto', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
                                        {radio.sonicSet.beats.length} ud.{radio.sonicSet.bpm ? ` · ${radio.sonicSet.bpm} BPM` : ''}
                                    </span>
                                )}
                            </div>

                            {radio.sonicReady && (
                                <button
                                    onClick={handleSendToStoryboard}
                                    disabled={sonicBusy}
                                    title="Policz cięcia zgrane z beatem i odłóż plan dla TeO Story V2"
                                    style={{
                                        width: '100%', padding: '5px 4px', borderRadius: 7,
                                        border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.1)',
                                        color: '#a5f3fc', fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                                        cursor: sonicBusy ? 'wait' : 'pointer', opacity: sonicBusy ? 0.5 : 1,
                                        fontFamily: "'JetBrains Mono', monospace",
                                    }}
                                >
                                    🎬 {sonicBusy ? 'LICZĘ...' : 'WYŚLIJ DO STORYBOARDU'}
                                </button>
                            )}

                            {!radio.sonicReady && (
                                <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: 1.5 }}>
                                    Wektory domykają się przy końcu utworu lub zmianie ścieżki.
                                </div>
                            )}

                            {sonicMsg && (
                                <div style={{ marginTop: 5, fontSize: 7.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                    {sonicMsg}
                                </div>
                            )}
                        </div>

                        <div style={playlistScrollStyle}>
                            {radio.tracks
                                .map((track, index) => ({ track, index }))
                                // Szukamy w tytule ORAZ w ścieżce — `title` to sama nazwa pliku,
                                // więc bez `filename` nie dało się znaleźć utworu po nazwie albumu
                                // (np. „Krople" nie trafiało w „OtakOS RADIO Album's/7 Krople Wiatru/…").
                                .filter(({ track }) => {
                                    const q = query.trim().toLowerCase();
                                    if (!q) return true;
                                    return `${track.title ?? ''} ${track.filename ?? ''}`.toLowerCase().includes(q);
                                })
                                .map(({ track, index }) => (
                                <div
                                    key={track.id}
                                    style={{
                                        ...trackItemStyle,
                                        backgroundColor: radio.currentIndex === index ? 'rgba(180, 100, 255, 0.15)' : 'transparent',
                                        borderLeft: radio.currentIndex === index ? '2px solid #a78bfa' : '2px solid transparent',
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
                            {radio.tracks.length > 0 && query.trim() &&
                                !radio.tracks.some(t => `${t.title ?? ''} ${t.filename ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) && (
                                <div style={{ padding: '14px 10px', fontSize: 8.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                                    Brak ścieżki pasującej do „{query.trim()}"
                                </div>
                            )}

                            {/* Pusta biblioteka — powiedz wprost, gdzie leży muzyka i co kliknąć */}
                            {radio.tracks.length === 0 && (
                                <div style={{ padding: '18px 12px', textAlign: 'center', lineHeight: 1.7 }}>
                                    {radio.isLoading ? (
                                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>⟳ DJ Wiesław przegląda katalog...</span>
                                    ) : (
                                        <>
                                            {/* Pokazujemy PRAWDZIWY powód, nie ogólnik. „Katalog pusty" przy
                                                działającym Moście wysyłało Suwerena na polowanie na nieistniejący
                                                problem — a naprawdę padało samo żądanie. */}
                                            <div style={{ fontSize: 9, color: radio.error ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}>
                                                {radio.error
                                                    ? '⚠️ Skan katalogu nie doszedł do skutku.'
                                                    : radio.wiesioAlive ? 'Katalog pusty.' : 'Most śpi — obudź Wiesława (:3001).'}
                                            </div>
                                            {radio.error && (
                                                <div style={{ fontSize: 7.5, color: 'rgba(252,165,165,0.75)', marginTop: 5, wordBreak: 'break-all', lineHeight: 1.5 }}>
                                                    {radio.error}
                                                </div>
                                            )}
                                            {/* 🛰️ Najczęstsza przyczyna: stary adres Kwantowego Tunelu w localStorage.
                                                Komendy jadą wtedy do tunelu, a kontrolka pinguje lokalny Most — stąd
                                                „zielono, ale nic nie działa". Dajemy wyjście jednym kliknięciem. */}
                                            {tunelUrl && (
                                                <div style={{ marginTop: 8, padding: 7, borderRadius: 8, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.3)' }}>
                                                    <div style={{ fontSize: 7.5, color: '#67e8f9', lineHeight: 1.5 }}>
                                                        🛰️ Komendy idą przez Kwantowy Tunel:<br />
                                                        <span style={{ color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all' }}>{tunelUrl}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => { setTunnelUrl(''); setTunelUrl(''); radio.loadPlaylist(undefined, false); }}
                                                        style={{
                                                            marginTop: 6, padding: '4px 10px', borderRadius: 7,
                                                            border: '1px solid rgba(34,211,238,0.45)', background: 'rgba(34,211,238,0.12)',
                                                            color: '#a5f3fc', fontSize: 7.5, fontWeight: 700, cursor: 'pointer',
                                                            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em',
                                                        }}
                                                    >
                                                        🏠 WRÓĆ NA MOST LOKALNY
                                                    </button>
                                                </div>
                                            )}
                                            <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.28)', marginTop: 6 }}>
                                                Wrzuć pliki do <code style={{ color: '#c4b5fd' }}>_OtakOs_Muzyka/</code><br />
                                                (podfoldery albumów też są skanowane)
                                            </div>
                                            <button
                                                onClick={() => radio.loadPlaylist()}
                                                style={{
                                                    marginTop: 10, padding: '5px 12px', borderRadius: 8,
                                                    border: '1px solid rgba(180,100,255,0.4)', background: 'rgba(180,100,255,0.1)',
                                                    color: '#e9d5ff', fontSize: 8, fontWeight: 700, cursor: 'pointer',
                                                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em',
                                                }}
                                            >
                                                🔄 SKANUJ KATALOG
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showQuantumForge && (
                    <QuantumForgeView 
                        onClose={() => { 
                            setShowQuantumForge(false); 
                            setForgedDNAFile(null); 
                        }} 
                        initialFile={forgedDNAFile} 
                    />
                )}
                {showKaraokeForge && (
                    <TeoKaraokeForge 
                        onClose={() => setShowKaraokeForge(false)}
                    />
                )}
            </AnimatePresence>

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
    flexDirection: 'row',   // ← playlist wyjeżdża W PRAWO
    alignItems: 'flex-end', // ← wyrównaj do dołu (do poziomu playera)
    gap: 12,
    pointerEvents: 'none',
};

const playerShellStyle: React.CSSProperties = {
    background: 'rgba(15, 10, 25, 0.95)',
    border: '1px solid rgba(180, 100, 255, 0.2)',
    borderRadius: 16,
    backdropFilter: 'blur(24px)',
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    fontFamily: "'JetBrains Mono', monospace",
    pointerEvents: 'auto',
};

const playlistPanelStyle: React.CSSProperties = {
    width: 340,             // trochę szerzej — miejsce na tytuły i przyszłe okładki
    maxHeight: 520,         // dopasowane do wysokości playera z marginesem
    background: 'rgba(10, 10, 15, 0.97)',
    border: '1px solid rgba(180, 100, 255, 0.25)',
    borderRadius: 16,
    backdropFilter: 'blur(32px)',
    boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(180,100,255,0.08)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'auto',
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
    // `minHeight: 0` jest tu konieczne, nie kosmetyczne: dziecko flexa domyślnie
    // ma `min-height: auto`, więc lista 137 utworów rozpychałaby się na pełną
    // wysokość zamiast scrollować, a panel (`maxHeight: 520`, `overflow: hidden`)
    // po prostu by ją przyciął.
    minHeight: 0,
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
