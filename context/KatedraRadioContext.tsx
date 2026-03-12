import React, {
    createContext, useContext, useRef,
    useState, useCallback, useEffect
} from 'react';
import bridgeService from '../lib/bridgeService';

// ── Typy ────────────────────────────────────────────────────────────

export interface SunoTrack {
    id: string;
    title: string;
    audio_url: string;
    image_url?: string | null;
    duration?: number;
    tags?: string;
    filename?: string;
}

interface RadioState {
    tracks: SunoTrack[];
    currentIndex: number;
    isPlaying: boolean;
    isLoading: boolean;
    error: string | null;
    volume: number;
    currentTime: number;
    duration: number;
    bassLevel: number;  // 0–100, z FFT analizatora
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
}

// ── Context ──────────────────────────────────────────────────────────

const KatedraRadioContext = createContext<RadioContextValue | null>(null);

export function useKatedraRadio(): RadioContextValue {
    const ctx = useContext(KatedraRadioContext);
    if (!ctx) throw new Error('useKatedraRadio must be used within KatedraRadioProvider');
    return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────

export function KatedraRadioProvider({ children }: { children: React.ReactNode }) {
    const audioRef    = useRef<HTMLAudioElement | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);
    const animRef     = useRef<number>(0);

    const [state, setState] = useState<RadioState>({
        tracks: [], currentIndex: 0,
        isPlaying: false, isLoading: false,
        error: null, volume: 0.7,
        currentTime: 0, duration: 0, bassLevel: 0,
    });

    // ── Singleton Audio ───────────────────────────────────────────────
    useEffect(() => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous'; // wymagane dla Web Audio API cross-origin
        audio.volume = 0.7;
        audio.preload = 'auto';

        audio.addEventListener('ended', () =>
            setState(s => ({ ...s, currentIndex: (s.currentIndex + 1) % Math.max(s.tracks.length, 1) }))
        );
        audio.addEventListener('timeupdate', () =>
            setState(s => ({ ...s, currentTime: audio.currentTime }))
        );
        audio.addEventListener('loadedmetadata', () =>
            setState(s => ({ ...s, duration: audio.duration || 0 }))
        );
        audio.addEventListener('error', (e) => {
            console.error('🔥 [Radio] KRYTYCZNY BŁĄD AUDIO!');
            console.error('🔥 [Radio] Próbowano odtworzyć URL:', audio.src);
            console.error('🔥 [Radio] Sprawdź w przeglądarce, czy ten link działa!');
            // Twarde zatrzymanie, ZERO Auto-skipu!
            setState(s => ({ ...s, error: 'BŁĄD SYSTEMU', isPlaying: false }));
        });

        audioRef.current = audio;
        return () => {
            cancelAnimationFrame(animRef.current);
            audio.pause();
            audio.src = '';
        };
    }, []);

    // ── Zmiana ścieżki → załaduj ─────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || state.tracks.length === 0) return;
        const track = state.tracks[state.currentIndex];
        if (!track?.audio_url) return;

        audio.src = track.audio_url;
        audio.load();
        if (state.isPlaying) {
            audio.play().catch(err => {
                console.warn('[Radio] Autoplay zablokowany:', err);
                setState(s => ({ ...s, isPlaying: false }));
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.currentIndex, state.tracks]);

    // ── Play / Pause ─────────────────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (state.isPlaying) {
            audio.play().catch(() => setState(s => ({ ...s, isPlaying: false })));
        } else {
            audio.pause();
        }
    }, [state.isPlaying]);

    // ── Głośność ─────────────────────────────────────────────────────
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
            // Bins 0–7 = bas (ok. 0–300Hz przy fftSize=256)
            let sum = 0;
            for (let i = 0; i < 8; i++) sum += dataArray[i];
            const bass = (sum / 8 / 255) * 100;
            setState(s => ({ ...s, bassLevel: bass }));
            animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(animRef.current);
    }, [state.isPlaying]);

    // ── Web Audio Context (lazy, po interakcji użytkownika) ──────────
    const setupAudioContext = useCallback(() => {
        if (!audioRef.current) return;

        if (!audioCtxRef.current) {
            const AC = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AC();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;

            try {
                const source = ctx.createMediaElementSource(audioRef.current);
                source.connect(analyser);
                analyser.connect(ctx.destination);
                audioCtxRef.current = ctx;
                analyserRef.current = analyser;
                sourceRef.current   = source;
                console.log('[Radio] Web Audio API gotowe 🎛️');
            } catch (e) {
                console.warn('[Radio] Błąd Web Audio:', e);
            }
        }

        if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, []);

    // ── loadPlaylist — naprawiony! ────────────────────────────────────
    const loadPlaylist = useCallback(async (_playlistId?: string) => {
        setupAudioContext();
        setState(s => ({ ...s, isLoading: true, error: null }));

        try {
            // Uderzamy do Wiesia po lokalne pliki muzyczne
            const response = await bridgeService.sendCommand('GET_LOCAL_PLAYLIST', {});

            if (!response.success) {
                throw new Error(response.message ?? 'Wiesław nie odpowiada');
            }

            const tracks: SunoTrack[] = response.tracks ?? [];

            if (tracks.length === 0) {
                throw new Error(`Brak plików w _AntiGravity_Muzyka/ — wrzuć tam muzykę!`);
            }

            console.log(`[Radio] Załadowano ${tracks.length} utworów od Wiesia 🎵`);

            setState(s => ({
                ...s,
                tracks,
                currentIndex: 0,
                isLoading: false,
                isPlaying: true,
                error: null,
            }));
        } catch (e: any) {
            console.error('[Radio] Błąd ładowania:', e);
            setState(s => ({ ...s, isLoading: false, error: e.message }));
        }
    }, [setupAudioContext]);

    // ── Akcje ─────────────────────────────────────────────────────────
    const play = useCallback(() => {
        setupAudioContext();
        setState(s => {
            // Jeśli z jakiegoś powodu playlista jest pusta, pobierz ją najpierw!
            if (s.tracks.length === 0) {
                setTimeout(() => loadPlaylist(), 0);
                return { ...s, isLoading: true };
            }
            return { ...s, isPlaying: true };
        });
    }, [setupAudioContext, loadPlaylist]);

    const pause = useCallback(() => setState(s => ({ ...s, isPlaying: false })), []);

    const toggle = useCallback(() => {
        setupAudioContext();
        setState(s => {
            // Zabezpieczenie przed kliknięciem toggle na pustym odtwarzaczu
            if (s.tracks.length === 0) {
                setTimeout(() => loadPlaylist(), 0);
                return { ...s, isLoading: true };
            }
            return { ...s, isPlaying: !s.isPlaying };
        });
    }, [setupAudioContext, loadPlaylist]);

    const next = useCallback(() => {
        setState(s => ({
            ...s,
            currentIndex: (s.currentIndex + 1) % Math.max(s.tracks.length, 1),
            isPlaying: true,
        }));
    }, []);

    const prev = useCallback(() => {
        setState(s => ({
            ...s,
            currentIndex: (s.currentIndex - 1 + s.tracks.length) % Math.max(s.tracks.length, 1),
            isPlaying: true,
        }));
    }, []);

    const setVolume = useCallback((v: number) =>
        setState(s => ({ ...s, volume: Math.max(0, Math.min(1, v)) })), []);

    const setTrack = useCallback((index: number) => {
        setupAudioContext();
        setState(s => ({
            ...s,
            currentIndex: Math.max(0, Math.min(index, s.tracks.length - 1)),
            isPlaying: true,
        }));
    }, [setupAudioContext]);


    const currentTrack = state.tracks[state.currentIndex] ?? null;

    return (
        <KatedraRadioContext.Provider value={{
            ...state, currentTrack, analyserRef,
            play, pause, toggle, next, prev,
            setVolume, setTrack, loadPlaylist,
        }}>
            {children}
        </KatedraRadioContext.Provider>
    );
}
