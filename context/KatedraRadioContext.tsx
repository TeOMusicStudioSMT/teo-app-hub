import React, {
    createContext, useContext, useRef,
    useState, useCallback, useEffect
} from 'react';
import bridgeService from '../lib/bridgeService';

// ── Typy ─────────────────────────────────────────────────────────────

export interface SunoTrack {
    id: string;
    title: string;
    audio_url: string;
    image_url?: string | null;
    duration?: number;
    tags?: string;
    filename?: string;
}

// Aura agenta — trafia do KatedraOrbita jako kolor wibracyjny
export interface AgentAura {
    agentId:   string;
    agentName: string;
    color:     string;   // CSS color np. '#22d3ee'
    message:   string;   // treść wypowiedzi
    timestamp: number;
}

interface RadioState {
    tracks:       SunoTrack[];
    currentIndex: number;
    isPlaying:    boolean;
    isLoading:    boolean;
    error:        string | null;
    volume:       number;
    currentTime:  number;
    duration:     number;
    bassLevel:    number;
    vocalLevel:   number;
    currentLyric: string;
    isAutoAura:   boolean;
    // ── Nowe pola aury ──
    activeAura:   AgentAura | null;   // aktywna aura agenta
    isSpeaking:   boolean;            // czy Sfera właśnie czyta komunikat
    isRecording:  boolean;            // czy trwa nagrywanie PoDCaT
    wiesioAlive:  boolean;            // czy Wiesio-Bridge żyje
    isMinimized:  boolean;            // czy odtwarzacz jest zwinięty
    showIntro:    boolean;            // czy pokazać intro (tytuł)
    showOutro:    boolean;            // czy pokazać outro (napisy)
    playbackRate: number;             // prędkość odtwarzania
}



interface RadioContextValue extends RadioState {
    play:         () => void;
    pause:        () => void;
    toggle:       () => void;
    next:         () => void;
    prev:         () => void;
    setVolume:    (v: number) => void;
    setTrack:     (index: number) => void;
    loadPlaylist: (playlistId?: string) => Promise<void>;
    currentTrack: SunoTrack | null;
    analyserRef:  React.RefObject<AnalyserNode | null>;
    // ── Nowe metody ──
    speakMessage: (aura: Omit<AgentAura, 'timestamp'>) => void;
    clearAura:    () => void;
    seekTo:       (time: number) => void;
    toggleRecording: () => void;
    setIsMinimized:  (m: boolean) => void;
    setCurrentLyric: (text: string) => void;
    setIsAutoAura:   (auto: boolean) => void;
    setShowIntro:    (s: boolean) => void;
    setShowOutro:    (s: boolean) => void;
    setPlaybackRate: (r: number) => void;
}


// ── Context ───────────────────────────────────────────────────────────

const KatedraRadioContext = createContext<RadioContextValue | null>(null);

export function useKatedraRadio(): RadioContextValue {
    const ctx = useContext(KatedraRadioContext);
    if (!ctx) throw new Error('useKatedraRadio must be used within KatedraRadioProvider');
    return ctx;
}

// ── Czas trwania aury w ms (potem Orbita wraca do złotego) ───────────
const AURA_DURATION_MS = 8000;

// ── Provider ──────────────────────────────────────────────────────────

export function KatedraRadioProvider({ children }: { children: React.ReactNode }) {
    const audioRef    = useRef<HTMLAudioElement | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);
    const animRef     = useRef<number>(0);
    const auraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const currentFilenameRef = useRef<string>('');
    
    // Pamięć Wektorowa dla Muzycznego Agenta
    const sonicVectors = useRef<any[]>([]);
    const lastSampleTime = useRef<number>(0);

    const [state, setState] = useState<RadioState>({
        tracks: [], currentIndex: 0,
        isPlaying: false, isLoading: false,
        error: null, volume: 0.7,
        currentTime: 0, duration: 0, bassLevel: 0, vocalLevel: 0, currentLyric: '', isAutoAura: false,
        activeAura: null, isSpeaking: false, isRecording: false, wiesioAlive: false,
        isMinimized: true, showIntro: false, showOutro: false,
        playbackRate: 1.0,
    });


    const currentTrack = state.tracks[state.currentIndex] ?? null;

    // ── Singleton Audio ───────────────────────────────────────────────
    useEffect(() => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.volume = 0.7;
        audio.preload = 'metadata'; // Pije po kropelce, nie połyka jeziora (zapobiega RAM overflow)

        audio.addEventListener('ended', () => {
            handleStopSequence();
            setState(s => ({ ...s, currentIndex: (s.currentIndex + 1) % Math.max(s.tracks.length, 1) }));
        });
        audio.addEventListener('timeupdate', () =>
            setState(s => ({ ...s, currentTime: audio.currentTime }))
        );
        audio.addEventListener('loadedmetadata', () =>
            setState(s => ({ ...s, duration: audio.duration || 0 }))
        );
        audio.addEventListener('error', () => {
            handleStopSequence();
            setState(s => ({ ...s, error: 'Błąd pliku — skip', isPlaying: false }));
            setTimeout(() =>
                setState(s => ({
                    ...s, error: null,
                    currentIndex: (s.currentIndex + 1) % Math.max(s.tracks.length, 1),
                    isPlaying: true,
                })), 2000
            );
        });

        audioRef.current = audio;
        return () => {
            cancelAnimationFrame(animRef.current);
            if (auraTimerRef.current) clearTimeout(auraTimerRef.current);
            audio.pause();
            audio.src = '';
        };
    }, []);

    // ── Wiesio-Pulsometr ──────────────────────────────────────────────
    useEffect(() => {
        const checkWiesioPulse = async () => {
            try {
                const res = await fetch('http://127.0.0.1:3001/wiesio/ping');
                setState(s => s.wiesioAlive !== res.ok ? { ...s, wiesioAlive: res.ok } : s);
            } catch (err) {
                setState(s => s.wiesioAlive !== false ? { ...s, wiesioAlive: false } : s);
            }
        };
        checkWiesioPulse(); 
        const interval = setInterval(checkWiesioPulse, 3000);
        return () => clearInterval(interval);
    }, []);

    // ── Zmiana ścieżki ────────────────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || state.tracks.length === 0) return;
        const track = state.tracks[state.currentIndex];
        if (!track) return;

        // Konstrukcja bezpośredniego strumienia wg Rozkazu Suwerena
        const streamUrl = track.filename 
            ? `http://127.0.0.1:3001/music/${track.filename.split('/').map(encodeURIComponent).join('/')}`
            : track.audio_url;

        if (!streamUrl) return;

        setupAudioContext(); // Upewnienie się, że AudioContext żyje przed nowym źródłem

        audio.src = streamUrl;
        audio.load(); // Wymuszenie przeładowania strumienia

        if (state.isPlaying) {
            audio.play().catch(e => {
                console.error("[Radio] Błąd odtwarzania strumienia:", e);
                setState(s => ({ ...s, isPlaying: false }));
            });
        }
        
        // Reset prędkości przy zmianie utworu
        audio.playbackRate = 1.0;
        setState(s => ({ ...s, playbackRate: 1.0 }));

        // Zjazd danych przy zmianie utworu

        handleStopSequence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.currentIndex, state.tracks]);

    // ── Play / Pause ──────────────────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (state.isPlaying) {
            audio.play().catch(() => setState(s => ({ ...s, isPlaying: false })));
        } else {
            audio.pause();
        }
    }, [state.isPlaying]);

    // ── Głośność ──────────────────────────────────────────────────────
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = state.volume;
    }, [state.volume]);

    // ── FFT Bass Loop ─────────────────────────────────────────────────
    useEffect(() => {
        if (!state.isPlaying || !analyserRef.current) {
            cancelAnimationFrame(animRef.current);
            setState(s => s.bassLevel !== 0 ? { ...s, bassLevel: 0 } : s);
            return;
        }
        const analyser  = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < 8; i++) sum += dataArray[i];
            const bass = (sum / 8 / 255) * 100;
            
            const vocalBand = dataArray.slice(10, 50); 
            const vocalVolume = vocalBand.reduce((a, b) => a + b, 0) / vocalBand.length;
            
            // --- SONICZNY HARVESTER (Próbkowanie Wektorowe co 1s) ---
            const now = Date.now();
            if (now - lastSampleTime.current > 1000 && audioRef.current && !audioRef.current.paused) {
                const getAverage = (arr: Uint8Array, start: number, end: number) => {
                    let sum = 0;
                    for (let i = start; i < end; i++) sum += arr[i];
                    return Math.round(sum / (end - start));
                };

                const bassLvl = getAverage(dataArray, 0, 10);
                const midLvl  = getAverage(dataArray, 10, 50);
                const highLvl = getAverage(dataArray, 50, 120);

                sonicVectors.current.push({
                    s: sonicVectors.current.length,
                    b: bassLvl,
                    v: midLvl,
                    h: highLvl
                });
                lastSampleTime.current = now;
            }

            setState(s => ({ ...s, bassLevel: bass, vocalLevel: vocalVolume }));
            animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animRef.current);
    }, [state.isPlaying]);

    // ── Web Audio Context ─────────────────────────────────────────────
    const setupAudioContext = useCallback(() => {
        if (!audioRef.current) return;
        if (!audioCtxRef.current) {
            const AC = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AC();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            const dest = ctx.createMediaStreamDestination();
            try {
                const source = ctx.createMediaElementSource(audioRef.current);
                source.connect(analyser);
                analyser.connect(ctx.destination);
                analyser.connect(dest);
                audioCtxRef.current = ctx;
                analyserRef.current = analyser;
                sourceRef.current   = source;
                audioDestinationRef.current = dest;
            } catch (e) {
                console.warn('[Radio] Web Audio błąd:', e);
            }
        }
        if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, []);

    // ── Akcje audio ───────────────────────────────────────────────────
    const play  = useCallback(() => { setupAudioContext(); setState(s => ({ ...s, isPlaying: true })); }, [setupAudioContext]);
    const pause = useCallback(() => setState(s => ({ ...s, isPlaying: false })), []);
    const toggle = useCallback(() => { setupAudioContext(); setState(s => ({ ...s, isPlaying: !s.isPlaying })); }, [setupAudioContext]);
    const next  = useCallback(() => setState(s => ({ ...s, currentIndex: (s.currentIndex + 1) % Math.max(s.tracks.length, 1), isPlaying: true })), []);
    const prev  = useCallback(() => setState(s => ({ ...s, currentIndex: (s.currentIndex - 1 + s.tracks.length) % Math.max(s.tracks.length, 1), isPlaying: true })), []);
    const setVolume = useCallback((v: number) => setState(s => ({ ...s, volume: Math.max(0, Math.min(1, v)) })), []);
    const setTrack  = useCallback((index: number) => { setupAudioContext(); setState(s => ({ ...s, currentIndex: Math.max(0, Math.min(index, s.tracks.length - 1)), isPlaying: true })); }, [setupAudioContext]);

    const seekTo = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setState(s => ({ ...s, currentTime: time }));
        }
    }, []);

    const toggleRecording = useCallback(async () => {
        if (!state.isRecording) {
            setupAudioContext();

            const canvas = document.querySelector('canvas[aria-label="Wizualizator orbity Katedry"]') as HTMLCanvasElement;
            if (!canvas) {
                console.error("[PodCaT] Canvas nie znaleziony!");
                return;
            }

            try {
                const canvasStream = (canvas as any).captureStream(60);
                const audioStream = audioDestinationRef.current?.stream;
                
                const tracks = [...canvasStream.getVideoTracks()];
                if (audioStream) {
                    tracks.push(...audioStream.getAudioTracks());
                }
                
                const mixedStream = new MediaStream(tracks);
                const recorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm' });
                
                // Generujemy jedną, stałą nazwę pliku dla tej sesji
                currentFilenameRef.current = `PodCaT_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                
                recorder.ondataavailable = async (e) => {
                    if (e.data && e.data.size > 0) {
                        // Natychmiast ślemy do Wiesława!
                        const reader = new FileReader();
                        reader.readAsDataURL(e.data);
                        reader.onloadend = async () => {
                            try {
                                await fetch('http://127.0.0.1:3001/wiesio/action', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'APPEND_CHUNK',
                                        payload: { 
                                            filename: currentFilenameRef.current, 
                                            chunkData: reader.result 
                                        }
                                    })
                                });
                            } catch (err) { 
                                console.error("[PodCaT] Błąd taśmociągu!", err); 
                            }
                        };
                    }
                };
                
                recorder.onstop = async () => {
                    setState(s => ({ ...s, isRecording: false }));
                    // Mówimy Wiesławowi: "To wszystko, odpalaj Rafinerię!"
                    try {
                        const res = await fetch('http://127.0.0.1:3001/wiesio/action', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'FINISH_PODCAT',
                                payload: { filename: currentFilenameRef.current }
                            })
                        });
                        const data = await res.json();
                        console.log(`[PodCaT] 🏁 Taśmociąg zatrzymany. Wiesio: ${data.status}`);
                    } catch (err) {
                        console.error("[PodCaT] Błąd przy finalizacji!", err);
                    }
                };

                // WYMUSZENIE CIĘCIA CO 10 SEKUND
                recorder.start(10000);
                mediaRecorderRef.current = recorder;
                setState(s => ({ ...s, isRecording: true, showIntro: true }));

                // Auto-Intro: Zniknij po 5 sekundach
                setTimeout(() => {
                    setState(s => ({ ...s, showIntro: false }));
                }, 5000);

            } catch (err) {
                console.error("Recording error:", err);
            }
        } else {
            // STOP RECORDING z Auto-Outro
            setState(s => ({ ...s, showOutro: true }));
            
            // Odczekaj 4 sekundy, by Outro się nagrało na ostatnim chunku
            setTimeout(() => {
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.stop();
                    mediaRecorderRef.current = null;
                }
                setState(s => ({ ...s, showOutro: false }));
            }, 4000);
        }
    }, [state.isRecording, setupAudioContext]);

    const loadPlaylist = useCallback(async (_playlistId?: string) => {
        setupAudioContext();
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            const response = await bridgeService.sendCommand('GET_LOCAL_PLAYLIST', {});
            if (!response.success) throw new Error(response.message ?? 'Wiesław nie odpowiada');
            const tracks: SunoTrack[] = response.tracks ?? [];
            if (tracks.length === 0) throw new Error('Brak plików w _OtakOs_Muzyka/');
            setState(s => ({ ...s, tracks, currentIndex: 0, isLoading: false, isPlaying: true, error: null }));
        } catch (e: any) {
            setState(s => ({ ...s, isLoading: false, error: e.message }));
        }
    }, [setupAudioContext]);

    // ── Sonic Harvester — Zrzut danych ──
    const handleStopSequence = useCallback(async () => {
        if (sonicVectors.current.length > 0) {
            const trackTitle = currentTrack?.title || "Unknown_Track";
            const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
            const filename   = `SonicVectors_${trackTitle.replace(/\s+/g, '_')}_${timestamp}.json`;

            console.log(`💎 ZEJŚCIE DANYCH Z MEMBRAN: ${filename} (${sonicVectors.current.length} próbek)`);

            try {
                await fetch('http://127.0.0.1:3001/wiesio/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'SAVE_SONIC_VECTORS', 
                        payload: { filename, vectors: sonicVectors.current } 
                    })
                });
            } catch (err) {
                console.error("[Sonic Harvester] ❌ Błąd zapisu do Wiesława!", err);
            }

            sonicVectors.current = [];
            lastSampleTime.current = 0;
        }
    }, [currentTrack]);

    // ── speakMessage — NOWE ───────────────────────────────────────────
    // Wywołaj to po każdej odpowiedzi agenta.
    // Orbita zmieni kolor na aurę agenta przez AURA_DURATION_MS ms.
    const speakMessage = useCallback((aura: Omit<AgentAura, 'timestamp'>) => {
        // Wyczyść poprzedni timer aury
        if (auraTimerRef.current) clearTimeout(auraTimerRef.current);

        const full: AgentAura = { ...aura, timestamp: Date.now() };

        setState(s => ({ ...s, activeAura: full, isSpeaking: true }));

        console.log(
            `%c[Sfera] ${aura.agentName} mówi:`,
            `color: ${aura.color}; font-weight: bold`,
            aura.message.substring(0, 80) + '...'
        );

        // Po czasie aura gaśnie, Orbita wraca do złotego
        auraTimerRef.current = setTimeout(() => {
            setState(s => ({ ...s, activeAura: null, isSpeaking: false }));
        }, AURA_DURATION_MS);
    }, []);

    const clearAura = useCallback(() => {
        if (auraTimerRef.current) clearTimeout(auraTimerRef.current);
        setState(s => ({ ...s, activeAura: null, isSpeaking: false }));
    }, []);

    return (
        <KatedraRadioContext.Provider value={{
            ...state, currentTrack, analyserRef,
            play, pause, toggle, next, prev,
            setVolume, setTrack, loadPlaylist,
            speakMessage, clearAura, seekTo, toggleRecording,
            setIsMinimized: (m: boolean) => setState(s => ({ ...s, isMinimized: m })),
            setCurrentLyric: (t: string) => setState(s => ({ ...s, currentLyric: t })),
            setIsAutoAura: (a: boolean) => setState(s => ({ ...s, isAutoAura: a })),
            setShowIntro: (s: boolean) => setState(state => ({ ...state, showIntro: s })),
            setShowOutro: (s: boolean) => setState(state => ({ ...state, showOutro: s })),
            setPlaybackRate: (r: number) => {
                if (audioRef.current) {
                    audioRef.current.playbackRate = r;
                    setState(s => ({ ...s, playbackRate: r }));
                }
            },
        }}>

            {children}
        </KatedraRadioContext.Provider>
    );
}
