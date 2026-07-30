import React, {
    createContext, useContext, useRef,
    useState, useCallback, useEffect
} from 'react';
import { toast } from 'react-hot-toast';
import bridgeService, { getBridgeBase as bridgeBase } from '../lib/bridgeService';
import {
    SonicVectorExtractor, CURRENT_VECTORS_FILE, CURRENT_PLAN_FILE,
    type SonicVectorSet,
} from '../lib/sonicVectors';

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
    autoAdvance:  boolean;            // ⏭ auto-następny po końcu utworu (OFF = stop na końcu, np. do nagrań)
    // ── 🧬 Wektory soniczne ──
    sonicSet:       SonicVectorSet | null;  // ostatni domknięty zbiór
    sonicReady:     boolean;                // zapisany na dysku → gotowy dla Story V2
    storyboardCuts: number;                 // ile cięć policzył Most
}



interface RadioContextValue extends RadioState {
    play:         () => void;
    pause:        () => void;
    toggle:       () => void;
    next:         () => void;
    prev:         () => void;
    setVolume:    (v: number) => void;
    setTrack:     (index: number) => void;
    loadPlaylist: (playlistId?: string, autoPlay?: boolean) => Promise<void>;
    playFavorite: (track: SunoTrack) => void;
    sendToStoryboard: () => Promise<{ ok: boolean; message: string }>;
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
    setAutoAdvance:  (a: boolean) => void;
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
    
    // 🧬 Generator wektorów sonicznych — karmi się z pętli FFT niżej.
    // Jeden ekstraktor na cały odtwarzacz; NIE tworzy własnego AudioContextu.
    const sonicRef = useRef<SonicVectorExtractor>(new SonicVectorExtractor());

    const [state, setState] = useState<RadioState>({
        tracks: [], currentIndex: 0,
        isPlaying: false, isLoading: false,
        error: null, volume: 0.7,
        currentTime: 0, duration: 0, bassLevel: 0, vocalLevel: 0, currentLyric: '', isAutoAura: false,
        activeAura: null, isSpeaking: false, isRecording: false, wiesioAlive: false,
        isMinimized: true, showIntro: false, showOutro: false,
        playbackRate: 1.0,
        autoAdvance: (() => { try { return localStorage.getItem('otakos_auto_advance') !== '0'; } catch { return true; } })(),
        sonicSet: null, sonicReady: false, storyboardCuts: 0,
    });

    // Ref dla listenera 'ended' (bindowany raz) — bez niego przełącznik nie działałby na żywo
    const autoAdvanceRef = useRef(true);
    useEffect(() => { autoAdvanceRef.current = state.autoAdvance; }, [state.autoAdvance]);


    const currentTrack = state.tracks[state.currentIndex] ?? null;

    // ── Singleton Audio ───────────────────────────────────────────────
    useEffect(() => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.volume = 0.7;
        audio.preload = 'metadata'; // Pije po kropelce, nie połyka jeziora (zapobiega RAM overflow)

        audio.addEventListener('ended', () => {
            handleStopSequence();
            if (autoAdvanceRef.current) {
                setState(s => ({ ...s, currentIndex: (s.currentIndex + 1) % Math.max(s.tracks.length, 1) }));
            } else {
                // ⏹ Tryb "stop na końcu" (np. nagrywanie teledysku) — zostań na utworze
                setState(s => ({ ...s, isPlaying: false }));
            }
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
                // ⚠️ MUSI iść tą samą drogą co komendy (`getBridgeBase()`), a nie po
                // zahardkodowanym 127.0.0.1. Inaczej przy ustawionym Kwantowym Tunelu
                // kontrolka świeci na zielono („Most żyje"), podczas gdy KAŻDA komenda
                // leci do tunelu i pada — playlista pusta, Joanna niema, teledysk nie
                // startuje, a interfejs twierdzi, że wszystko gra. Kontrolka ma mówić
                // prawdę o tej drodze, którą naprawdę jedzie ruch.
                const res = await fetch(`${bridgeBase()}/wiesio/ping`);
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
            
            // --- 🧬 SONICZNY HARVESTER (wektory + beat-detection, 20 Hz) ---
            // Próbkujemy po CZASIE UTWORU, nie po zegarze ściennym — pauza nie
            // wstrzykuje fałszywej ciszy, a przewinięcie nie rozjeżdża osi.
            const audioEl = audioRef.current;
            if (audioEl && !audioEl.paused) {
                sonicRef.current.sample(analyser, audioEl.currentTime);
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

    /**
     * 🎶 Odtwórz ulubiony (playlista Domu Kompana) — TYM SAMYM torem co radio.
     * Jeśli utwór jest już w kolejce, przeskakujemy na niego; jeśli nie — dopinamy
     * na koniec. Świadomie NIE tworzymy drugiego <audio> ani drugiego AudioContextu:
     * `createMediaElementSource` wolno wywołać raz na element, a dwa równoległe
     * odtwarzacze biłyby się o wyjście z mikserem PodcastCore. Jedno źródło = zero konfliktu.
     */
    const playFavorite = useCallback((track: SunoTrack) => {
        setupAudioContext();
        const key = (t: SunoTrack) => t.filename || t.audio_url || t.id;
        setState(s => {
            const idx = s.tracks.findIndex(t => key(t) === key(track));
            if (idx >= 0) return { ...s, currentIndex: idx, isPlaying: true, error: null };
            const tracks = [...s.tracks, track];
            return { ...s, tracks, currentIndex: tracks.length - 1, isPlaying: true, error: null };
        });
    }, [setupAudioContext]);

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
                // Nagrywamy OBRAZ Orbity — bez niej nie ma czego nagrać. Wcześniej ta
                // ścieżka kończyła się cichym `console.error` i `return`: Suweren
                // naciskał REC i nie działo się absolutnie nic, bez słowa wyjaśnienia.
                console.error('[PodCaT] Kanwa Orbity nie znaleziona — nagrywanie przerwane.');
                toast.error('Nie ma czego nagrywać — Orbita Katedry nie jest widoczna. Wróć na widok z Orbitą i spróbuj ponownie.', { duration: 6000 });
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

    /**
     * Zaciąga listę z lokalnego katalogu `_OtakOs_Muzyka` (skan REKURENCYJNY —
     * podfoldery albumów też wchodzą, ze ścieżką względną w `filename`).
     * `autoPlay=false` przy cichym doczytaniu listy (otwarcie Biblioteki) —
     * pokazujemy ścieżki, ale nie napadamy Suwerena dźwiękiem.
     */
    const loadPlaylist = useCallback(async (_playlistId?: string, autoPlay = true) => {
        setupAudioContext();
        setState(s => ({ ...s, isLoading: true, error: null }));
        try {
            const response = await bridgeService.sendCommand('GET_LOCAL_PLAYLIST', {});
            if (!response.success) throw new Error(response.message ?? 'Wiesław nie odpowiada');
            const tracks: SunoTrack[] = response.tracks ?? [];
            if (tracks.length === 0) throw new Error('Brak plików w _OtakOs_Muzyka/');
            setState(s => ({
                ...s, tracks, currentIndex: 0, isLoading: false,
                isPlaying: autoPlay ? true : s.isPlaying, error: null,
            }));
        } catch (e: any) {
            setState(s => ({ ...s, isLoading: false, error: e.message }));
        }
    }, [setupAudioContext]);

    // ── 🧬 Sonic Harvester — zrzut wektorów na dysk ────────────────────
    // Zapisuje DWA pliki: archiwalny (z datą) i `current_track_vectors.json`,
    // po który sięga silnik montażowy TeO Story V2.
    const handleStopSequence = useCallback(async () => {
        const ex = sonicRef.current;
        if (ex.isEmpty) return;

        const trackTitle = currentTrack?.title || 'Unknown_Track';
        const set = ex.finish(audioRef.current?.duration || 0, trackTitle);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archive = `SonicVectors_${trackTitle.replace(/\s+/g, '_')}_${timestamp}.json`;

        console.log(`💎 ZEJŚCIE DANYCH Z MEMBRAN: ${set.vectors.length} próbek, ${set.beats.length} uderzeń, BPM ${set.bpm ?? '?'}`);

        const save = async (filename: string, vectors: unknown) => {
            const r = await fetch(`${bridgeBase()}/wiesio/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'SAVE_SONIC_VECTORS', payload: { filename, vectors } }),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
        };

        try {
            await save(archive, set);                  // kopia archiwalna
            await save(CURRENT_VECTORS_FILE, set);     // „gorący" plik dla Story V2
            setState(s => ({ ...s, sonicSet: set, sonicReady: true }));
        } catch (err) {
            console.error('[Sonic Harvester] ❌ Błąd zapisu do Wiesława!', err);
            setState(s => ({ ...s, sonicSet: set, sonicReady: false }));
        }

        ex.reset(trackTitle);
    }, [currentTrack]);

    /**
     * 🎬 WYŚLIJ DO STORYBOARDU — wektory → plan cięć zgranych z beatem.
     * Most liczy plan (`/api/teledysk/plan`) i odkładamy go jako
     * `current_track_plan.json`, gotowy do zaciągnięcia przez montażownię.
     */
    const sendToStoryboard = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
        const set = state.sonicSet;
        if (!set || set.vectors.length < 4) {
            return { ok: false, message: 'Brak wektorów — puść utwór do końca albo przełącz ścieżkę.' };
        }
        try {
            const res = await fetch(`${bridgeBase()}/api/teledysk/plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vectors: set.vectors, fps: 30, duration: set.duration }),
            });
            const plan = await res.json();
            if (!res.ok || !plan.success) {
                return { ok: false, message: plan.message || `Most odmówił (HTTP ${res.status})` };
            }

            await fetch(`${bridgeBase()}/wiesio/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'SAVE_SONIC_VECTORS',
                    payload: {
                        filename: CURRENT_PLAN_FILE,
                        vectors: { track: set.track, bpm: set.bpm, duration: set.duration, ...plan },
                    },
                }),
            });

            setState(s => ({ ...s, storyboardCuts: plan.cutCount ?? 0 }));
            return { ok: true, message: `🎬 ${plan.cutCount} cięć → ${CURRENT_PLAN_FILE}` };
        } catch (e: any) {
            return { ok: false, message: `Most nieosiągalny: ${e?.message || e}` };
        }
    }, [state.sonicSet]);

    // 🔊 Głos Rady — realne odtworzenie tego, co agent "mówi" (lokalny klon głosu
    // per agentId, fallback przeglądarki gdy silnik XTTS niedostępny).
    const speakAloud = useCallback(async (agentId: string, text: string) => {
        try {
            const res = await fetch('http://127.0.0.1:3001/api/voice/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voiceId: agentId }),
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.onended = () => URL.revokeObjectURL(url);
                await audio.play().catch(() => {});
                return;
            }
        } catch { /* silnik lokalny niedostępny — spadamy na przeglądarkę */ }
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'pl-PL';
            window.speechSynthesis.speak(utter);
        }
    }, []);

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

        speakAloud(aura.agentId, aura.message);

        // Po czasie aura gaśnie, Orbita wraca do złotego
        auraTimerRef.current = setTimeout(() => {
            setState(s => ({ ...s, activeAura: null, isSpeaking: false }));
        }, AURA_DURATION_MS);
    }, [speakAloud]);

    const clearAura = useCallback(() => {
        if (auraTimerRef.current) clearTimeout(auraTimerRef.current);
        setState(s => ({ ...s, activeAura: null, isSpeaking: false }));
    }, []);

    return (
        <KatedraRadioContext.Provider value={{
            ...state, currentTrack, analyserRef,
            play, pause, toggle, next, prev,
            setVolume, setTrack, loadPlaylist, playFavorite, sendToStoryboard,
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
            setAutoAdvance: (a: boolean) => {
                autoAdvanceRef.current = a;
                try { localStorage.setItem('otakos_auto_advance', a ? '1' : '0'); } catch {}
                setState(s => ({ ...s, autoAdvance: a }));
            },
        }}>

            {children}
        </KatedraRadioContext.Provider>
    );
}
