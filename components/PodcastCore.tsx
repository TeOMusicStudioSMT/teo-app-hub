import React, { useEffect, useRef, useState, useCallback } from 'react';
import { KoomService } from '../src/services/KoomService';
import { getBridgeBase } from '../lib/bridgeService';

// Types & Interfaces
export type LayoutMode = 'GRID' | 'FOCUS_SELF' | 'FOCUS_GUEST' | 'FOCUS_ORB';

/** Źródło inteligencji AI Orba. LOCAL = zero tokenów chmury, praca offline. */
export type BrainMode = 'CLOUD' | 'LOCAL';

/** Persona Orba — pod tą flagą wniosek ląduje w Księdze Odbioru. */
export type OrbPersona = 'ISKRA' | 'ECHO';

const BRAIN_KEY = 'teo_podcast_brain';
const LOCAL_MODEL_KEY = 'otakos_active_model';   // wspólny z resztą Katedry
const CLOUD_MODEL = 'gemini-1.5-flash';

/**
 * 🎚️ SONIC — domyślny profil głosu Katedry.
 * Głęboki, stabilny, magnetyczny: pierś podbita, ostrość ścięta, dynamika spięta
 * kompresorem, żeby ton nie skakał. Wartości wyłuskane na zewnątrz — to jest
 * pokrętło do strojenia, nie magiczne liczby zakopane w kodzie.
 */
export const SONIC_VOICE_PROFILE = {
  chest:      { frequency: 140,  gain: 4.5 },                 // lowshelf — głębia, „pierś"
  body:       { frequency: 320,  gain: 2.0, Q: 0.8 },         // peaking — magnetyzm, ciało tonu
  presence:   { frequency: 2600, gain: 1.5, Q: 0.9 },         // peaking — zrozumiałość spółgłosek
  warmth:     { frequency: 7200, Q: 0.7 },                    // lowpass — ocieplenie, ścięcie szkła
  stability:  { threshold: -24, knee: 24, ratio: 3.2, attack: 0.006, release: 0.22 },
  makeupGain: 1.15,
} as const;

/**
 * Buduje łańcuch Web Audio nadający sygnałowi profil Sonica.
 * Zwraca węzeł wyjściowy — podłącz go do analizatora i/lub głośników.
 */
export const createSonicChain = (ctx: BaseAudioContext, source: AudioNode): GainNode => {
  const P = SONIC_VOICE_PROFILE;

  const chest = ctx.createBiquadFilter();
  chest.type = 'lowshelf';
  chest.frequency.value = P.chest.frequency;
  chest.gain.value = P.chest.gain;

  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = P.body.frequency;
  body.Q.value = P.body.Q;
  body.gain.value = P.body.gain;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = P.presence.frequency;
  presence.Q.value = P.presence.Q;
  presence.gain.value = P.presence.gain;

  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = P.warmth.frequency;
  warmth.Q.value = P.warmth.Q;

  const stability = ctx.createDynamicsCompressor();
  stability.threshold.value = P.stability.threshold;
  stability.knee.value      = P.stability.knee;
  stability.ratio.value     = P.stability.ratio;
  stability.attack.value    = P.stability.attack;
  stability.release.value   = P.stability.release;

  const out = ctx.createGain();
  out.gain.value = P.makeupGain;

  source.connect(chest).connect(body).connect(presence).connect(warmth).connect(stability).connect(out);
  return out;
};

export interface PodcastCoreProps {
  wsUrl?: string;
  onStreamStateChange?: (isBroadcasting: boolean) => void;
  guestStream?: MediaStream | null;
  audioStreamSource?: MediaStream | AudioNode | null;
  /** Wywoływane, gdy wypowiedź Orba trafi do Księgi Odbioru jako zadanie NEW. */
  onPlanInjected?: (texts: string[]) => void;
}

export const PodcastCore: React.FC<PodcastCoreProps> = ({
  wsUrl = 'wss://relay.teo.studio/rtmp-out',
  onStreamStateChange,
  guestStream = null,
  audioStreamSource = null,
  onPlanInjected,
}) => {
  // --- States ---
  const [layout, setLayout] = useState<LayoutMode>('GRID');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [isCamActive, setIsCamActive] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'SELF' | 'GUEST' | 'ORB'>('SELF');

  // --- Mózg Orba ---
  const [brain, setBrain] = useState<BrainMode>(() => {
    try { return (localStorage.getItem(BRAIN_KEY) as BrainMode) || 'LOCAL'; } catch { return 'LOCAL'; }
  });
  const [persona, setPersona] = useState<OrbPersona>('ECHO');
  const [orbPrompt, setOrbPrompt] = useState('');
  const [orbAnswer, setOrbAnswer] = useState('');
  const [orbBusy, setOrbBusy] = useState(false);
  const [injectedCount, setInjectedCount] = useState(0);
  const [sonicOn, setSonicOn] = useState(true);

  useEffect(() => { try { localStorage.setItem(BRAIN_KEY, brain); } catch { /* noop */ } }, [brain]);

  // --- Refs ---
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const guestVideoRef = useRef<HTMLVideoElement | null>(null);
  const orbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const compositeAnimRef = useRef<number | null>(null);

  // 1. WebRTC Local Camera Capture (Widok Siebie)
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsCamActive(true);
      initAudioAnalyser(stream);
    } catch (err) {
      console.error('[PodcastCore] Error accessing camera/mic:', err);
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setIsCamActive(false);
  }, []);

  // 2. AI Orb (Web Audio API Analyser + profil Sonica)
  //    `sonic`      → sygnał przechodzi przez łańcuch ocieplający (głos Katedry)
  //    `toSpeakers` → sygnał leci też na wyjście; NIGDY dla mikrofonu (sprzężenie!)
  const initAudioAnalyser = (
    input: MediaStream | AudioNode,
    opts: { sonic?: boolean; toSpeakers?: boolean } = {},
  ) => {
    try {
      const isNode = typeof AudioNode !== 'undefined' && input instanceof AudioNode;

      // Węzeł obcy przynosi własny kontekst — nie wolno mieszać kontekstów.
      let ctx: BaseAudioContext;
      if (isNode) {
        ctx = (input as AudioNode).context;
      } else {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = audioCtxRef.current ?? new AudioCtx();
        audioCtxRef.current = ctx as AudioContext;
      }

      const source = isNode ? (input as AudioNode) : (ctx as AudioContext).createMediaStreamSource(input as MediaStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      const tail: AudioNode = opts.sonic ? createSonicChain(ctx, source) : source;
      tail.connect(analyser);
      if (opts.toSpeakers) tail.connect(ctx.destination);

      analyserRef.current = analyser;

      drawOrb();
    } catch (e) {
      console.warn('[PodcastCore] AudioContext init skipped or restrained:', e);
    }
  };

  // Głos AI Orba (zewnętrzne źródło) — zawsze przez profil Sonica, prosto w głośniki.
  useEffect(() => {
    if (!audioStreamSource) return;
    initAudioAnalyser(audioStreamSource, { sonic: sonicOn, toSpeakers: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStreamSource, sonicOn]);

  const drawOrb = () => {
    const canvas = orbCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Jedna pętla rAF na Orb — przy przełączeniu źródła dźwięku nie mnożymy klatek.
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const bufferLength = 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      // Analizator czytany co klatkę — Orb podłapuje zmianę źródła w locie.
      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Subtle fallback idle pulse
        for (let i = 0; i < bufferLength; i++) dataArray[i] = Math.sin(Date.now() * 0.005 + i) * 20 + 30;
      }

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const avgAmplitude = sum / bufferLength;

      // Speaker auto-detection simulation for Orb responsiveness
      if (avgAmplitude > 70 && activeSpeaker !== 'ORB') {
        setActiveSpeaker('ORB');
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 60 + (avgAmplitude / 255) * 45;

      // Glow Aura
      const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.8);
      gradient.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
      gradient.addColorStop(0.5, 'rgba(138, 43, 226, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic Core Orb
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Waveform Orbit Ring
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      for (let i = 0; i < bufferLength; i++) {
        const angle = (i / bufferLength) * Math.PI * 2;
        const offset = (dataArray[i] / 255) * 20;
        const x = centerX + Math.cos(angle) * (baseRadius + 12 + offset);
        const y = centerY + Math.sin(angle) * (baseRadius + 12 + offset);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  // 3. Gość Live (Guest Stream Attachment)
  useEffect(() => {
    if (guestVideoRef.current && guestStream) {
      guestVideoRef.current.srcObject = guestStream;
    }
  }, [guestStream]);

  // 4. RTMP Broadcast Base (Offscreen Composite Canvas + WebSocket Ingest)
  const startRTMPBroadcast = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[PodcastCore] Connected to RTMP WebSocket Relay');
        setIsBroadcasting(true);
        onStreamStateChange?.(true);

        const stream = canvas.captureStream(60); // 60 FPS Canvas stream
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 4500000,
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send chunk every 250ms
        mediaRecorderRef.current = mediaRecorder;
      };

      ws.onerror = (err) => {
        console.error('[PodcastCore] WebSocket RTMP Relay Error:', err);
        stopRTMPBroadcast();
      };

      ws.onclose = () => {
        stopRTMPBroadcast();
      };
    } catch (e) {
      console.error('[PodcastCore] Failed to initialize RTMP WebSocket:', e);
    }
  }, [wsUrl, onStreamStateChange]);

  const stopRTMPBroadcast = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
    mediaRecorderRef.current = null;
    setIsBroadcasting(false);
    onStreamStateChange?.(false);
  }, [onStreamStateChange]);

  // 5. Composite Canvas Render Loop for RTMP Export
  useEffect(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawComposite = () => {
      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render video feeds onto offscreen 1920x1080 canvas for YouTube
      if (localVideoRef.current && isCamActive) {
        ctx.drawImage(localVideoRef.current, 0, 0, canvas.width / 2, canvas.height);
      }
      if (guestVideoRef.current && guestStream) {
        ctx.drawImage(guestVideoRef.current, canvas.width / 2, 0, canvas.width / 2, canvas.height);
      }
      if (orbCanvasRef.current) {
        ctx.drawImage(orbCanvasRef.current, canvas.width / 2 - 150, canvas.height - 320, 300, 300);
      }

      compositeAnimRef.current = requestAnimationFrame(drawComposite);
    };

    drawComposite();

    return () => {
      if (compositeAnimRef.current) cancelAnimationFrame(compositeAnimRef.current);
    };
  }, [isCamActive, guestStream]);

  // Initial stream trigger
  useEffect(() => {
    initLocalStream();
    return () => {
      stopLocalStream();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [initLocalStream, stopLocalStream]);

  // 6. MÓZG ORBA — jedno zapytanie, dwa źródła inteligencji.
  //    LOCAL → /api/ollama (Gemma 4 na sprzęcie Suwerena, ZERO tokenów chmury)
  //    CLOUD → /api/gemini (Flash, gdy Suweren świadomie sięga po chmurę)
  //    Oba idą przez Most, więc działają też przez Kwantowy Tunel z telefonu.
  const askOrb = useCallback(async (question: string) => {
    const prompt = question.trim();
    if (!prompt || orbBusy) return;

    setOrbBusy(true);
    setOrbAnswer('');
    setActiveSpeaker('ORB');

    const base = getBridgeBase();
    const endpoint = brain === 'LOCAL' ? '/api/ollama' : '/api/gemini';
    const model = brain === 'LOCAL'
      ? (localStorage.getItem(LOCAL_MODEL_KEY) || 'gemma4')
      : CLOUD_MODEL;

    const system =
      'Jesteś AI Orbem wideopodcastu Katedry OtakOS. Odpowiadaj po polsku, zwięźle (2-4 zdania), ' +
      'konkretnie i kończ jasnym wnioskiem albo propozycją działania — np. "Powinniśmy zoptymalizować ' +
      'zużycie energii o 15%". Bez wstępów i bez lania wody.';

    let full = '';
    try {
      const res = await fetch(`${base}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, system, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Strumień SSE — tekst dopisuje się na żywo, jak w rozmowie.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'text' && evt.text) { full += evt.text; setOrbAnswer(full); }
            if (evt.type === 'error') throw new Error(evt.error);
          } catch { /* niedomknięty kawałek JSON — dojdzie w następnej porcji */ }
        }
      }

      if (!full.trim()) {
        setOrbAnswer(brain === 'LOCAL'
          ? '(Orb milczy — sprawdź, czy Ollama stoi i model jest pobrany.)'
          : '(Orb milczy — sprawdź klucz Gemini w Moście.)');
        return;
      }

      // 💉 Wnioski prosto z anteny do Księgi Odbioru — jako zadania NEW dla Mechanika.
      const injected = KoomService.injectFromSpeech(full, persona);
      if (injected.length) {
        setInjectedCount(c => c + injected.length);
        onPlanInjected?.(injected.map(p => p.text));
      }
    } catch (e) {
      setOrbAnswer(`(Most nieosiągalny: ${e instanceof Error ? e.message : String(e)})`);
    } finally {
      setOrbBusy(false);
      setActiveSpeaker('SELF');
    }
  }, [brain, persona, orbBusy, onPlanInjected]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[650px] bg-[#050608] text-white flex flex-col justify-between p-4 rounded-2xl border border-cyan-500/20 shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Hidden Offscreen Composite Canvas for RTMP Stream Capture */}
      <canvas ref={compositeCanvasRef} width={1920} height={1080} className="hidden" />

      {/* --- TOP BAR (Status & Broadcast controls) --- */}
      <div className="flex items-center justify-between z-10 bg-black/40 px-6 py-3 rounded-xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-cyan-300">TeO Studio // Podcast 1/1</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-gray-400">LAYOUT:</span>
            <span className="text-cyan-400 font-bold">{layout}</span>
          </div>

          <button
            onClick={isBroadcasting ? stopRTMPBroadcast : startRTMPBroadcast}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-lg ${
              isBroadcasting
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/50 animate-pulse'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-cyan-500/30'
            }`}
          >
            {isBroadcasting ? '● LIVE RTMP' : 'START BROADCAST'}
          </button>
        </div>
      </div>

      {/* --- DYNAMIC STAGE / GRID LAYOUT --- */}
      <div className="relative flex-1 my-4 grid gap-4 transition-all duration-500 ease-out grid-cols-1 md:grid-cols-2">
        {/* 1. WIDOK SIEBIE (WebRTC Local View) */}
        <div
          onClick={() => setLayout('FOCUS_SELF')}
          className={`relative rounded-xl overflow-hidden border transition-all duration-500 cursor-pointer bg-black/60 flex items-center justify-center ${
            layout === 'FOCUS_SELF'
              ? 'col-span-2 row-span-2 border-cyan-400 shadow-[0_0_30px_rgba(0,240,255,0.3)]'
              : 'border-white/10 hover:border-cyan-500/50'
          } ${layout === 'FOCUS_GUEST' || layout === 'FOCUS_ORB' ? 'absolute bottom-4 right-4 w-48 h-32 z-20 border-cyan-400 shadow-2xl' : ''}`}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <div className="absolute bottom-3 left-3 bg-black/70 px-3 py-1 rounded-md text-xs font-mono border border-white/10 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isCamActive ? 'bg-green-400' : 'bg-red-500'}`} />
            <span>JA (LOKALNY)</span>
          </div>
        </div>

        {/* 2. GOŚĆ LIVE (External Stream Slot) */}
        <div
          onClick={() => setLayout('FOCUS_GUEST')}
          className={`relative rounded-xl overflow-hidden border transition-all duration-500 cursor-pointer bg-black/60 flex items-center justify-center ${
            layout === 'FOCUS_GUEST'
              ? 'col-span-2 row-span-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]'
              : 'border-white/10 hover:border-purple-500/50'
          } ${layout === 'FOCUS_SELF' ? 'absolute bottom-4 right-4 w-48 h-32 z-20 border-purple-400 shadow-2xl' : ''}`}
        >
          {guestStream ? (
            <video ref={guestVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center text-xs font-mono">
                +
              </div>
              <span className="text-xs font-mono tracking-wider">WAITING FOR LIVE GUEST</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/70 px-3 py-1 rounded-md text-xs font-mono border border-white/10 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${guestStream ? 'bg-green-400' : 'bg-amber-400 animate-ping'}`} />
            <span>GOŚĆ LIVE</span>
          </div>
        </div>

        {/* 3. AI ORB (Sound-Reactive Model Visualizer) */}
        <div
          onClick={() => setLayout(layout === 'FOCUS_ORB' ? 'GRID' : 'FOCUS_ORB')}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 z-30 cursor-pointer ${
            layout === 'FOCUS_ORB' ? 'scale-150' : 'scale-100 hover:scale-110'
          }`}
        >
          <div className="relative flex flex-col items-center justify-center">
            <canvas ref={orbCanvasRef} width={240} height={240} className="rounded-full" />
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-[10px] font-mono tracking-widest text-cyan-300 shadow-lg">
              AI MODEL ORB
            </span>
          </div>
        </div>
      </div>

      {/* --- MÓZG ORBA (źródło inteligencji + wtrysk do Księgi) --- */}
      <div className="z-10 bg-black/40 px-4 py-3 rounded-xl border border-white/10 backdrop-blur-md mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest text-gray-400 mr-1">MÓZG ORBA:</span>

          {(['LOCAL', 'CLOUD'] as BrainMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setBrain(mode)}
              title={mode === 'LOCAL'
                ? 'Gemma 4 na sprzęcie Suwerena — offline, zero tokenów chmury'
                : 'Gemini Flash przez Most — zużywa tokeny chmury'}
              className={`px-3 py-1.5 rounded-md text-[11px] font-mono transition-all ${
                brain === mode
                  ? mode === 'LOCAL'
                    ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/30'
                    : 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {mode === 'LOCAL' ? '🏠 LOCAL · Gemma 4' : '☁️ CLOUD · Flash'}
            </button>
          ))}

          <span className="text-[10px] font-mono text-gray-600">|</span>

          <button
            onClick={() => setPersona(p => (p === 'ECHO' ? 'ISKRA' : 'ECHO'))}
            title="Pod tą flagą wniosek trafia do Księgi Odbioru"
            className="px-3 py-1.5 rounded-md text-[11px] font-mono bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            style={{ color: persona === 'ISKRA' ? '#f472b6' : '#22d3ee' }}
          >
            {persona === 'ISKRA' ? '🔥 ISKRA' : '🌊 ECHO'}
          </button>

          <button
            onClick={() => setSonicOn(s => !s)}
            title="Profil głosu Sonica — ocieplenie i stabilizacja pasma AI Orba"
            className={`px-3 py-1.5 rounded-md text-[11px] font-mono transition-all border ${
              sonicOn
                ? 'bg-violet-600/30 border-violet-400/50 text-violet-200'
                : 'bg-white/5 border-white/10 text-gray-500'
            }`}
          >
            🎚️ SONIC {sonicOn ? 'ON' : 'OFF'}
          </button>

          {injectedCount > 0 && (
            <span className="ml-auto text-[10px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-md">
              📖 {injectedCount} → KSIĘGA
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={orbPrompt}
            onChange={(e) => setOrbPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askOrb(orbPrompt)}
            placeholder="Zapytaj AI Orba na antenie — wnioski lecą prosto do Księgi Odbioru..."
            className="flex-1 bg-black/50 border border-cyan-700/30 focus:border-cyan-500/60 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
          />
          <button
            onClick={() => askOrb(orbPrompt)}
            disabled={orbBusy || !orbPrompt.trim()}
            className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-gradient-to-r from-cyan-500 to-blue-600 text-black disabled:opacity-40 transition-all"
          >
            {orbBusy ? 'MYŚLI...' : 'ZAPYTAJ ORB'}
          </button>
        </div>

        {orbAnswer && (
          <div className="text-[11px] leading-relaxed text-slate-300 bg-black/40 border border-cyan-900/40 rounded-lg p-2.5 max-h-28 overflow-y-auto whitespace-pre-wrap">
            <span className="font-bold" style={{ color: persona === 'ISKRA' ? '#f472b6' : '#22d3ee' }}>
              {persona === 'ISKRA' ? '🔥 ISKRA' : '🌊 ECHO'}:
            </span>{' '}
            {orbAnswer}
          </div>
        )}
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div className="flex items-center justify-between z-10 bg-black/40 px-6 py-3 rounded-xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMic}
            className={`p-2.5 rounded-lg border transition-all ${
              isMicMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            {isMicMuted ? 'MIC OFF' : 'MIC ON'}
          </button>
          <button
            onClick={isCamActive ? stopLocalStream : initLocalStream}
            className={`p-2.5 rounded-lg border transition-all ${
              !isCamActive ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            {isCamActive ? 'CAM ON' : 'CAM OFF'}
          </button>
        </div>

        {/* Layout Selectors */}
        <div className="flex items-center gap-2">
          {(['GRID', 'FOCUS_SELF', 'FOCUS_GUEST', 'FOCUS_ORB'] as LayoutMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setLayout(mode)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-mono transition-all ${
                layout === mode
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {mode.replace('FOCUS_', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PodcastCore;
