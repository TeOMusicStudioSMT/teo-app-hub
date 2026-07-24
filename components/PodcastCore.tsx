import React, { useEffect, useRef, useState, useCallback } from 'react';
import { KoomService } from '../src/services/KoomService';
import { getBridgeBase } from '../lib/bridgeService';

// ═══════════════════════════════════════════════════════════════════════════════
//  TYPY
// ═══════════════════════════════════════════════════════════════════════════════

/** Układ kompozycji na kanwie programowej (to, co realnie leci w świat). */
export type LayoutMode = 'PROGRAM' | 'QUAD' | 'PIP';

/** Źródło inteligencji AI Orba. LOCAL = zero tokenów chmury, praca offline. */
export type BrainMode = 'CLOUD' | 'LOCAL';

/** Persona Orba — pod tą flagą wniosek ląduje w Księdze Odbioru. */
export type OrbPersona = 'ISKRA' | 'ECHO';

/** Cztery gniazda kamer Katedry — sprzęt Suwerena. */
export type CamId = 'CAM_1_SONY_4K' | 'CAM_2_PHONE_A' | 'CAM_3_PHONE_B' | 'CAM_4_WEBBY';

/** Co aktualnie idzie na wizję (program). Orb to pełnoprawne „ujęcie". */
export type ProgramSource = CamId | 'ORB';

/** Reżyser: AUTO = cięcie po głosie, MANUAL = Suweren klika sam. */
export type DirectorMode = 'AUTO' | 'MANUAL';

const BRAIN_KEY = 'teo_podcast_brain';
const VOICE_KEY = 'teo_podcast_voice';
const LOCAL_MODEL_KEY = 'otakos_active_model';   // wspólny z resztą Katedry
const CLOUD_MODEL = 'gemini-1.5-flash';

/** Domyślny profil głosu — gdy nie ma klonu, Orb mówi „Sonikiem", nie ciszą. */
const SONIC_VOICE_ID = 'SONIC';

export const CAM_SLOTS: ReadonlyArray<{ id: CamId; label: string; tag: string }> = [
  { id: 'CAM_1_SONY_4K', label: 'SONY 4K',    tag: 'CAM 1' },
  { id: 'CAM_2_PHONE_A', label: 'TELEFON A',  tag: 'CAM 2' },
  { id: 'CAM_3_PHONE_B', label: 'TELEFON B',  tag: 'CAM 3' },
  { id: 'CAM_4_WEBBY',   label: 'WEBBY / JA', tag: 'CAM 4' },
];

const CAM_IDS: CamId[] = CAM_SLOTS.map((s) => s.id);

/** Reżyser nie tnie częściej — inaczej obraz miga przy każdym „yhym". */
const MIN_SHOT_MS = 2500;
/** Poniżej tego poziomu (0-255, średnia widma) uznajemy, że źródło milczy. */
const SPEAK_THRESHOLD = 24;
/** Puls reżysera — dziesięć spojrzeń na scenę w ciągu dwóch sekund. */
const DIRECTOR_TICK_MS = 200;

/** Mapa „po jednej wartości na gniazdo" — używana do refów i stanów kamer. */
function camMap<T>(value: T): Record<CamId, T> {
  return {
    CAM_1_SONY_4K: value,
    CAM_2_PHONE_A: value,
    CAM_3_PHONE_B: value,
    CAM_4_WEBBY: value,
  };
}

/**
 * Adres kanału WebSocket na Moście Wiesia. Jedzie tym samym torem co reszta
 * Katedry — więc działa i lokalnie (`ws://127.0.0.1:3001`), i przez Kwantowy
 * Tunel z telefonu (`wss://...trycloudflare.com`).
 */
const bridgeWs = (path: string): string => `${getBridgeBase().replace(/^http/i, 'ws')}${path}`;

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

/** Blob → data URI (base64). Tak próbka głosu jedzie do Mostu. */
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Nie udało się odczytać nagrania.'));
    reader.readAsDataURL(blob);
  });

/** Najlepszy dostępny kontener webm — VP8 jest najbezpieczniejszy dla ffmpeg. */
const pickMimeType = (): string => {
  const candidates = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch { /* stara przeglądarka */ }
  }
  return 'video/webm';
};

export interface PodcastCoreProps {
  /** Nadpisanie adresu relaya RTMP. Puste = kanał Mostu (`/api/rtmp-relay`). */
  wsUrl?: string;
  /** Nadpisanie adresu recordera. Puste = kanał Mostu (`/api/recorder`). */
  recorderUrl?: string;
  onStreamStateChange?: (isBroadcasting: boolean) => void;
  /** Zewnętrzny gość (WebRTC) — ląduje w gnieździe CAM 2, jeśli jest wolne. */
  guestStream?: MediaStream | null;
  audioStreamSource?: MediaStream | AudioNode | null;
  /** Wywoływane, gdy wypowiedź Orba trafi do Księgi Odbioru jako zadanie NEW. */
  onPlanInjected?: (texts: string[]) => void;
}

export const PodcastCore: React.FC<PodcastCoreProps> = ({
  wsUrl,
  recorderUrl,
  onStreamStateChange,
  guestStream = null,
  audioStreamSource = null,
  onPlanInjected,
}) => {
  // ─── Stan sceny ─────────────────────────────────────────────────────────────
  const [layout, setLayout] = useState<LayoutMode>('PROGRAM');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // ─── Reżyser ────────────────────────────────────────────────────────────────
  const [directorMode, setDirectorMode] = useState<DirectorMode>('AUTO');
  const [program, setProgram] = useState<ProgramSource>('CAM_4_WEBBY');
  const [camActive, setCamActive] = useState<Record<CamId, boolean>>(camMap(false));
  const [camDevice, setCamDevice] = useState<Record<CamId, string>>(camMap(''));
  const [micSlot, setMicSlot] = useState<CamId>('CAM_4_WEBBY');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});

  // ─── Studio (relay + recorder) ──────────────────────────────────────────────
  const [relayMsg, setRelayMsg] = useState('');
  const [recMsg, setRecMsg] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [wantMp4, setWantMp4] = useState(false);
  const [rtmpKeyInput, setRtmpKeyInput] = useState('');
  const [studio, setStudio] = useState<{ ffmpeg: boolean; rtmpConfigured: boolean; rtmpKeyMasked: string; recordingsDir: string }>({
    ffmpeg: false, rtmpConfigured: false, rtmpKeyMasked: '', recordingsDir: '',
  });

  // ─── Mózg Orba ──────────────────────────────────────────────────────────────
  const [brain, setBrain] = useState<BrainMode>(() => {
    try { return (localStorage.getItem(BRAIN_KEY) as BrainMode) || 'LOCAL'; } catch { return 'LOCAL'; }
  });
  const [persona, setPersona] = useState<OrbPersona>('ECHO');
  const [orbPrompt, setOrbPrompt] = useState('');
  const [orbAnswer, setOrbAnswer] = useState('');
  const [orbBusy, setOrbBusy] = useState(false);
  const [injectedCount, setInjectedCount] = useState(0);
  const [sonicOn, setSonicOn] = useState(true);

  // ─── Klonowanie głosu ───────────────────────────────────────────────────────
  const [voiceId, setVoiceId] = useState<string>(() => {
    try { return localStorage.getItem(VOICE_KEY) || SONIC_VOICE_ID; } catch { return SONIC_VOICE_ID; }
  });
  const [voiceEngine, setVoiceEngine] = useState<{ available: boolean; voices: string[] }>({ available: false, voices: [] });
  const [sampling, setSampling] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(0);
  const [voiceMsg, setVoiceMsg] = useState('');
  const [orbVoiceOn, setOrbVoiceOn] = useState(true);

  useEffect(() => { try { localStorage.setItem(BRAIN_KEY, brain); } catch { /* noop */ } }, [brain]);
  useEffect(() => { try { localStorage.setItem(VOICE_KEY, voiceId); } catch { /* noop */ } }, [voiceId]);

  // ─── Refy: obraz ────────────────────────────────────────────────────────────
  const camVideoRefs      = useRef<Record<CamId, HTMLVideoElement | null>>(camMap<HTMLVideoElement | null>(null));
  const camStreamsRef     = useRef<Record<CamId, MediaStream | null>>(camMap<MediaStream | null>(null));
  const camExternalRef    = useRef<Record<CamId, boolean>>(camMap(false)); // stream cudzy — nie gasimy jego ścieżek
  const orbCanvasRef      = useRef<HTMLCanvasElement | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ─── Refy: dźwięk ───────────────────────────────────────────────────────────
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const mixDestRef        = useRef<MediaStreamAudioDestinationNode | null>(null); // magistrala transmisji
  const camSourceRef      = useRef<Record<CamId, MediaStreamAudioSourceNode | null>>(camMap<MediaStreamAudioSourceNode | null>(null));
  const camAnalyserRef    = useRef<Record<CamId, AnalyserNode | null>>(camMap<AnalyserNode | null>(null));
  const orbAnalyserRef    = useRef<AnalyserNode | null>(null);
  const orbSpeakingRef    = useRef(false);

  // ─── Refy: transport ────────────────────────────────────────────────────────
  const relayWsRef        = useRef<WebSocket | null>(null);
  const relayRecorderRef  = useRef<MediaRecorder | null>(null);
  const fileWsRef         = useRef<WebSocket | null>(null);
  const fileRecorderRef   = useRef<MediaRecorder | null>(null);

  // ─── Refy: pętle i lustra stanu (pętle rAF nie widzą świeżego state) ────────
  const animFrameRef      = useRef<number | null>(null);
  const compositeAnimRef  = useRef<number | null>(null);
  const levelsRef         = useRef<Record<string, number>>({});
  const programRef        = useRef<ProgramSource>('CAM_4_WEBBY');
  const layoutRef         = useRef<LayoutMode>('PROGRAM');
  const directorRef       = useRef<DirectorMode>('AUTO');
  const camActiveRef      = useRef<Record<CamId, boolean>>(camMap(false));
  const micSlotRef        = useRef<CamId>('CAM_4_WEBBY');
  const liveRef           = useRef(false);
  const recRef            = useRef(false);

  useEffect(() => { programRef.current = program; }, [program]);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { directorRef.current = directorMode; }, [directorMode]);
  useEffect(() => { liveRef.current = isBroadcasting; }, [isBroadcasting]);
  useEffect(() => { recRef.current = isRecording; }, [isRecording]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  DŹWIĘK — jeden kontekst, jedna magistrala
  // ═════════════════════════════════════════════════════════════════════════════

  /**
   * Kontekst audio + magistrala miksu. `mixDest` to dźwięk, który realnie leci
   * na transmisję i do pliku — bez niej YouTube dostawał nieme wideo.
   */
  const ensureAudio = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext
          || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      if (!mixDestRef.current) mixDestRef.current = ctx.createMediaStreamDestination();
      return ctx;
    } catch (e) {
      console.warn('[PodcastCore] AudioContext niedostępny:', e);
      return null;
    }
  }, []);

  /**
   * Na magistralę transmisji wchodzi TYLKO jedno źródło mikrofonowe.
   * Reszta kamer ma analizatory (reżyser słyszy, kto mówi), ale nie dubluje dźwięku.
   * Mikrofon NIGDY nie idzie do `ctx.destination` — to byłoby sprzężenie.
   */
  const routeMic = useCallback(() => {
    const mix = mixDestRef.current;
    if (!mix) return;
    for (const id of CAM_IDS) {
      const src = camSourceRef.current[id];
      if (!src) continue;
      try { src.disconnect(mix); } catch { /* nie był podłączony */ }
    }
    const chosen = camSourceRef.current[micSlotRef.current];
    if (chosen) {
      try { chosen.connect(mix); } catch { /* kontekst zamknięty */ }
    }
  }, []);

  useEffect(() => { micSlotRef.current = micSlot; routeMic(); }, [micSlot, routeMic]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  KAMERY — cztery gniazda
  // ═════════════════════════════════════════════════════════════════════════════

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === 'videoinput'));
    } catch (e) {
      console.warn('[PodcastCore] Nie mogę wylistować kamer:', e);
    }
  }, []);

  /** Wpina gotowy strumień w gniazdo: obraz do <video>, dźwięk do analizatora. */
  const attachCamStream = useCallback((id: CamId, stream: MediaStream, external = false) => {
    camStreamsRef.current[id] = stream;
    camExternalRef.current[id] = external;

    const el = camVideoRefs.current[id];
    if (el) {
      el.srcObject = stream;
      void el.play().catch(() => { /* autoplay dogoni przy pierwszym kliknięciu */ });
    }

    if (stream.getAudioTracks().length) {
      const ctx = ensureAudio();
      if (ctx) {
        try {
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.6;
          src.connect(analyser);
          camSourceRef.current[id] = src;
          camAnalyserRef.current[id] = analyser;
          routeMic();
        } catch (e) {
          console.warn(`[PodcastCore] ${id}: analizator dźwięku pominięty:`, e);
        }
      }
    }

    camActiveRef.current = { ...camActiveRef.current, [id]: true };
    setCamActive((prev) => ({ ...prev, [id]: true }));
  }, [ensureAudio, routeMic]);

  const stopCam = useCallback((id: CamId) => {
    const stream = camStreamsRef.current[id];
    if (stream && !camExternalRef.current[id]) {
      stream.getTracks().forEach((t) => t.stop());
    }
    camStreamsRef.current[id] = null;
    camExternalRef.current[id] = false;

    const src = camSourceRef.current[id];
    if (src) { try { src.disconnect(); } catch { /* już odpięty */ } }
    camSourceRef.current[id] = null;
    camAnalyserRef.current[id] = null;

    const el = camVideoRefs.current[id];
    if (el) el.srcObject = null;

    camActiveRef.current = { ...camActiveRef.current, [id]: false };
    setCamActive((prev) => ({ ...prev, [id]: false }));
  }, []);

  /**
   * Odpala gniazdo kamery. Telefony wpinają się jako wirtualne kamery
   * (DroidCam/Iriun) albo przez `guestStream` — dla Katedry to zwykłe wejścia.
   */
  const startCam = useCallback(async (id: CamId, deviceId?: string) => {
    const wanted = deviceId ?? camDevice[id];
    const video: MediaTrackConstraints = wanted
      ? { deviceId: { exact: wanted }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
      : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

    ensureAudio();
    try {
      // Najpierw z dźwiękiem — reżyser potrzebuje wiedzieć, kto mówi.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      }
      attachCamStream(id, stream);
      void refreshDevices(); // po zgodzie etykiety urządzeń przestają być puste
    } catch (err) {
      console.error(`[PodcastCore] ${id}: brak dostępu do kamery:`, err);
      setRelayMsg(`Gniazdo ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [attachCamStream, camDevice, ensureAudio, refreshDevices]);

  // Gość z zewnątrz (WebRTC) — ląduje w CAM 2, jeśli gniazdo wolne.
  useEffect(() => {
    if (!guestStream) return;
    if (camStreamsRef.current.CAM_2_PHONE_A) return;
    attachCamStream('CAM_2_PHONE_A', guestStream, true);
  }, [guestStream, attachCamStream]);

  const toggleMic = useCallback(() => {
    const stream = camStreamsRef.current[micSlotRef.current];
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicMuted(!track.enabled);
  }, []);

  // ═════════════════════════════════════════════════════════════════════════════
  //  AI ORB — wizualizacja reagująca na dźwięk
  // ═════════════════════════════════════════════════════════════════════════════

  const drawOrb = useCallback(() => {
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
      const analyser = orbAnalyserRef.current;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        for (let i = 0; i < bufferLength; i++) dataArray[i] = Math.sin(Date.now() * 0.005 + i) * 20 + 30;
      }

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const avgAmplitude = sum / bufferLength;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 60 + (avgAmplitude / 255) * 45;

      const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.8);
      gradient.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
      gradient.addColorStop(0.5, 'rgba(138, 43, 226, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.shadowBlur = 0;

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
  }, []);

  // Głos AI Orba z zewnętrznego źródła — przez profil Sonica, w głośniki i na antenę.
  useEffect(() => {
    if (!audioStreamSource) return;
    const isNode = typeof AudioNode !== 'undefined' && audioStreamSource instanceof AudioNode;
    const ctx = isNode ? (audioStreamSource as AudioNode).context : ensureAudio();
    if (!ctx) return;

    try {
      const source: AudioNode = isNode
        ? (audioStreamSource as AudioNode)
        : (ctx as AudioContext).createMediaStreamSource(audioStreamSource as MediaStream);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      const tail: AudioNode = sonicOn ? createSonicChain(ctx, source) : source;
      tail.connect(analyser);
      tail.connect(ctx.destination);

      // Węzeł z obcego kontekstu nie wejdzie na naszą magistralę — Web Audio
      // nie łączy kontekstów. Mówimy to wprost zamiast udawać, że leci na antenę.
      if (ctx === audioCtxRef.current && mixDestRef.current) tail.connect(mixDestRef.current);
      else if (isNode) console.warn('[PodcastCore] Głos Orba z obcego AudioContext — słychać go lokalnie, ale nie wejdzie na transmisję.');

      orbAnalyserRef.current = analyser;
      orbSpeakingRef.current = true;
      drawOrb();
    } catch (e) {
      console.warn('[PodcastCore] Tor głosu Orba pominięty:', e);
    }
  }, [audioStreamSource, sonicOn, ensureAudio, drawOrb]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  REŻYSER AI — kto mówi, ten jest na wizji
  // ═════════════════════════════════════════════════════════════════════════════

  const cutTo = useCallback((src: ProgramSource) => {
    programRef.current = src;
    setProgram(src);
  }, []);

  const lastCutRef = useRef(0);

  const manualCut = useCallback((src: ProgramSource) => {
    setDirectorMode('MANUAL');
    directorRef.current = 'MANUAL';
    lastCutRef.current = Date.now();
    cutTo(src);
  }, [cutTo]);

  useEffect(() => {
    const readLevel = (analyser: AnalyserNode | null): number => {
      if (!analyser) return 0;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      return sum / buf.length;
    };

    const tick = () => {
      const next: Record<string, number> = {};
      for (const id of CAM_IDS) {
        next[id] = camActiveRef.current[id] ? readLevel(camAnalyserRef.current[id]) : 0;
      }
      next.ORB = orbSpeakingRef.current ? readLevel(orbAnalyserRef.current) : 0;
      levelsRef.current = next;
      setLevels(next);

      if (directorRef.current !== 'AUTO') return;

      const now = Date.now();
      if (now - lastCutRef.current < MIN_SHOT_MS) return;

      // Orb ma pierwszeństwo: gdy mówi AI, kamera idzie na Orba.
      let best: ProgramSource | null = null;
      if (next.ORB > SPEAK_THRESHOLD) {
        best = 'ORB';
      } else {
        let bestLevel = SPEAK_THRESHOLD;
        for (const id of CAM_IDS) {
          if (!camActiveRef.current[id]) continue;
          if (next[id] > bestLevel) { bestLevel = next[id]; best = id; }
        }
      }

      if (!best) {
        // Cisza na planie — trzymamy ujęcie, chyba że źródło programowe padło.
        const current = programRef.current;
        if (current !== 'ORB' && !camActiveRef.current[current]) {
          const fallback = CAM_IDS.find((id) => camActiveRef.current[id]);
          if (fallback) { lastCutRef.current = now; cutTo(fallback); }
        }
        return;
      }

      if (best !== programRef.current) {
        lastCutRef.current = now;
        cutTo(best);
      }
    };

    const timer = window.setInterval(tick, DIRECTOR_TICK_MS);
    return () => window.clearInterval(timer);
  }, [cutTo]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  KANWA PROGRAMOWA — to, co realnie leci w świat (1920×1080)
  // ═════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /** Rysuje wideo „na kadr" (cover) — bez czarnych pasów i bez rozciągania. */
    const drawCover = (el: HTMLVideoElement | null, x: number, y: number, w: number, h: number): boolean => {
      if (!el || el.readyState < 2 || !el.videoWidth || !el.videoHeight) return false;
      const srcRatio = el.videoWidth / el.videoHeight;
      const dstRatio = w / h;
      let sx = 0, sy = 0, sw = el.videoWidth, sh = el.videoHeight;
      if (srcRatio > dstRatio) { sw = el.videoHeight * dstRatio; sx = (el.videoWidth - sw) / 2; }
      else { sh = el.videoWidth / dstRatio; sy = (el.videoHeight - sh) / 2; }
      ctx.drawImage(el, sx, sy, sw, sh, x, y, w, h);
      return true;
    };

    const drawPlaceholder = (label: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(148,163,184,0.65)';
      ctx.font = `${Math.round(h / 14)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
    };

    const drawOrbInto = (x: number, y: number, size: number) => {
      const orb = orbCanvasRef.current;
      if (orb) ctx.drawImage(orb, x, y, size, size);
    };

    const labelOf = (src: ProgramSource): string =>
      src === 'ORB' ? 'AI ORB' : (CAM_SLOTS.find((s) => s.id === src)?.label ?? src);

    const drawComposite = () => {
      const W = canvas.width;
      const H = canvas.height;

      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, W, H);

      const prog = programRef.current;
      const mode = layoutRef.current;

      if (mode === 'QUAD') {
        // Multiview 2×2 — cztery gniazda naraz, ramka na źródle programowym.
        const cw = W / 2, ch = H / 2;
        CAM_SLOTS.forEach((slot, i) => {
          const x = (i % 2) * cw;
          const y = Math.floor(i / 2) * ch;
          const drawn = camActiveRef.current[slot.id] && drawCover(camVideoRefs.current[slot.id], x, y, cw, ch);
          if (!drawn) drawPlaceholder(`${slot.tag} — ${slot.label}`, x, y, cw, ch);
          if (slot.id === prog) {
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 6;
            ctx.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
          }
        });
        drawOrbInto(W / 2 - 140, H - 300, 280);
      } else {
        // PROGRAM / PIP — pełny kadr źródła programowego.
        if (prog === 'ORB') {
          drawPlaceholder('', 0, 0, W, H);
          drawOrbInto(W / 2 - 320, H / 2 - 320, 640);
        } else {
          const drawn = camActiveRef.current[prog] && drawCover(camVideoRefs.current[prog], 0, 0, W, H);
          if (!drawn) drawPlaceholder(`${labelOf(prog)} — BRAK SYGNAŁU`, 0, 0, W, H);
          drawOrbInto(W - 320, H - 320, 280);
        }

        if (mode === 'PIP') {
          // Pasek podglądów pozostałych źródeł — reżyserka na wizji.
          const pw = 300, ph = 169, gap = 16;
          const others = CAM_IDS.filter((id) => id !== prog && camActiveRef.current[id]);
          others.slice(0, 3).forEach((id, i) => {
            const x = gap;
            const y = gap + i * (ph + gap);
            if (!drawCover(camVideoRefs.current[id], x, y, pw, ph)) drawPlaceholder(labelOf(id), x, y, pw, ph);
            ctx.strokeStyle = 'rgba(0,240,255,0.35)';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, pw, ph);
          });
        }
      }

      // Belka: nazwa ujęcia + realny stan transmisji i nagrania.
      const barY = H - 70;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, barY, W, 70);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '28px monospace';
      ctx.fillText(`TeO STUDIO // ${labelOf(prog)}`, 32, barY + 45);

      let badgeX = W - 32;
      const badge = (text: string, color: string) => {
        ctx.font = 'bold 24px monospace';
        const w = ctx.measureText(text).width + 32;
        badgeX -= w + 12;
        ctx.fillStyle = color;
        ctx.fillRect(badgeX, barY + 18, w, 34);
        ctx.fillStyle = '#000';
        ctx.fillText(text, badgeX + 16, barY + 43);
      };
      if (recRef.current) badge('● REC', '#f59e0b');
      if (liveRef.current) badge('● LIVE', '#ef4444');

      compositeAnimRef.current = requestAnimationFrame(drawComposite);
    };

    drawComposite();
    return () => { if (compositeAnimRef.current) cancelAnimationFrame(compositeAnimRef.current); };
  }, []);

  // ═════════════════════════════════════════════════════════════════════════════
  //  TRANSPORT — miks A/V z kanwy
  // ═════════════════════════════════════════════════════════════════════════════

  /**
   * Strumień, który wychodzi z Katedry: obraz z kanwy programowej
   * + dźwięk z magistrali (mikrofon + głos Orba). Bez tej drugiej połowy
   * transmisja była niema — i to była właśnie „głuchota".
   */
  const buildMixStream = useCallback((fps: number): MediaStream | null => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return null;
    ensureAudio();
    const video = canvas.captureStream(fps);
    const audio = mixDestRef.current ? mixDestRef.current.stream.getAudioTracks() : [];
    return new MediaStream([...video.getVideoTracks(), ...audio]);
  }, [ensureAudio]);

  const stopBroadcast = useCallback(() => {
    const rec = relayRecorderRef.current;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* już stanął */ } }
    relayRecorderRef.current = null;

    const ws = relayWsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try { ws.close(1000, 'stop'); } catch { /* noop */ }
    }
    relayWsRef.current = null;

    setIsBroadcasting(false);
    onStreamStateChange?.(false);
  }, [onStreamStateChange]);

  const startBroadcast = useCallback(() => {
    if (relayWsRef.current) return;

    const stream = buildMixStream(30);
    if (!stream) { setRelayMsg('Brak kanwy kompozycji — nie mam czego nadawać.'); return; }

    const url = wsUrl || bridgeWs('/api/rtmp-relay?vkbps=4500&fps=30');
    setRelayMsg(`Pukam do Mostu: ${url}`);

    try {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      relayWsRef.current = ws;

      ws.onopen = () => {
        try {
          const recorder = new MediaRecorder(stream, {
            mimeType: pickMimeType(),
            videoBitsPerSecond: 4_500_000,
            audioBitsPerSecond: 128_000,
          });
          recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(ev.data);
          };
          recorder.start(250); // paczka co 250 ms — kompromis opóźnienie/stabilność
          relayRecorderRef.current = recorder;
          setIsBroadcasting(true);
          onStreamStateChange?.(true);
        } catch (e) {
          setRelayMsg(`MediaRecorder nie wystartował: ${e instanceof Error ? e.message : String(e)}`);
          stopBroadcast();
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type: string; message?: string; line?: string; target?: string; code?: number };
          if (msg.type === 'live')       setRelayMsg(`● NA ANTENIE → ${msg.target ?? 'RTMP'}`);
          else if (msg.type === 'error') { setRelayMsg(`Most: ${msg.message ?? 'błąd'}`); stopBroadcast(); }
          else if (msg.type === 'ended') { setRelayMsg(`Relay zakończony (ffmpeg ${msg.code}).`); stopBroadcast(); }
          else if (msg.type === 'ffmpeg') setRelayMsg(`ffmpeg: ${msg.line ?? ''}`);
        } catch { /* nie-JSON — ignorujemy */ }
      };

      ws.onerror = () => {
        setRelayMsg('Kanał relaya nieosiągalny — czy Most Wiesia stoi?');
        stopBroadcast();
      };

      ws.onclose = () => {
        if (relayWsRef.current === ws) stopBroadcast();
      };
    } catch (e) {
      setRelayMsg(`Nie mogę otworzyć kanału: ${e instanceof Error ? e.message : String(e)}`);
      relayWsRef.current = null;
    }
  }, [buildMixStream, onStreamStateChange, stopBroadcast, wsUrl]);

  // ─── Lokalny recorder — fizyczny plik na dysku Suwerena ──────────────────────

  const stopRecording = useCallback(() => {
    const rec = fileRecorderRef.current;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* już stanął */ } }
    fileRecorderRef.current = null;

    const ws = fileWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Chwila zwłoki: ostatnia paczka MediaRecordera musi zdążyć wyjść, potem
      // prosimy Most o domknięcie pliku i czekamy na „saved" (ref zeruje onclose).
      setTimeout(() => {
        try { ws.send(JSON.stringify({ type: 'stop' })); } catch { /* noop */ }
        setTimeout(() => { try { ws.close(1000, 'stop'); } catch { /* noop */ } }, 3000);
      }, 400);
    } else if (ws) {
      try { ws.close(1000, 'stop'); } catch { /* noop */ }
      fileWsRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (fileWsRef.current) return;

    const stream = buildMixStream(30);
    if (!stream) { setRecMsg('Brak kanwy kompozycji — nie mam czego nagrywać.'); return; }

    const query = `?mp4=${wantMp4 ? '1' : '0'}&title=${encodeURIComponent(episodeTitle || 'Odcinek')}`;
    const url = recorderUrl || bridgeWs(`/api/recorder${query}`);
    setRecMsg('Otwieram plik na dysku...');

    try {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      fileWsRef.current = ws;

      ws.onopen = () => {
        try {
          const recorder = new MediaRecorder(stream, {
            mimeType: pickMimeType(),
            videoBitsPerSecond: 6_000_000, // zapis na dysk może być hojniejszy niż antena
            audioBitsPerSecond: 160_000,
          });
          recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(ev.data);
          };
          recorder.start(1000);
          fileRecorderRef.current = recorder;
          setIsRecording(true);
        } catch (e) {
          setRecMsg(`MediaRecorder nie wystartował: ${e instanceof Error ? e.message : String(e)}`);
          stopRecording();
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type: string; message?: string; fileName?: string; dir?: string; bytes?: number; mp4?: boolean };
          if (msg.type === 'recording')  setRecMsg(`● NAGRYWAM → ${msg.dir ?? ''}\\${msg.fileName ?? ''}`);
          else if (msg.type === 'saved') {
            setRecMsg(`✅ Zapisano ${msg.fileName} (${((msg.bytes ?? 0) / 1048576).toFixed(1)} MB)${msg.mp4 ? ' — MP4 konwertuje się w tle' : ''}`);
            try { ws.close(1000, 'saved'); } catch { /* noop */ }
          }
          else if (msg.type === 'error') { setRecMsg(`Most: ${msg.message ?? 'błąd zapisu'}`); stopRecording(); }
        } catch { /* nie-JSON — ignorujemy */ }
      };

      ws.onerror = () => {
        setRecMsg('Kanał recordera nieosiągalny — czy Most Wiesia stoi?');
        stopRecording();
      };

      ws.onclose = () => {
        if (fileWsRef.current === ws) { fileWsRef.current = null; setIsRecording(false); }
      };
    } catch (e) {
      setRecMsg(`Nie mogę otworzyć kanału: ${e instanceof Error ? e.message : String(e)}`);
      fileWsRef.current = null;
    }
  }, [buildMixStream, episodeTitle, recorderUrl, stopRecording, wantMp4]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  STUDIO — status Mostu i klucz transmisji
  // ═════════════════════════════════════════════════════════════════════════════

  const refreshStudio = useCallback(async () => {
    try {
      const r = await fetch(`${getBridgeBase()}/api/studio/status`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { ffmpeg?: boolean; rtmpConfigured?: boolean; rtmpKeyMasked?: string; recordingsDir?: string };
      setStudio({
        ffmpeg:         !!data.ffmpeg,
        rtmpConfigured: !!data.rtmpConfigured,
        rtmpKeyMasked:  data.rtmpKeyMasked ?? '',
        recordingsDir:  data.recordingsDir ?? '',
      });
    } catch {
      setStudio({ ffmpeg: false, rtmpConfigured: false, rtmpKeyMasked: '', recordingsDir: '' });
    }
  }, []);

  const saveRtmpKey = useCallback(async () => {
    try {
      const r = await fetch(`${getBridgeBase()}/api/studio/rtmp-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamKey: rtmpKeyInput.trim() }),
      });
      const data = await r.json() as { success?: boolean; message?: string };
      if (!r.ok || !data.success) throw new Error(data.message ?? `HTTP ${r.status}`);
      setRtmpKeyInput('');
      setRelayMsg('🔐 Klucz transmisji zapisany w skarbcu Mostu (nie w przeglądarce).');
      void refreshStudio();
    } catch (e) {
      setRelayMsg(`Nie zapisałem klucza: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [refreshStudio, rtmpKeyInput]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  KLONOWANIE GŁOSU
  // ═════════════════════════════════════════════════════════════════════════════

  const refreshVoice = useCallback(async () => {
    try {
      const r = await fetch(`${getBridgeBase()}/api/voice/status`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { available?: boolean; voices?: string[] };
      setVoiceEngine({ available: !!data.available, voices: data.voices ?? [] });
    } catch {
      setVoiceEngine({ available: false, voices: [] });
    }
  }, []);

  /** Nagrywa 10 s próbki i odsyła ją do Mostu (`/api/voice/clone`). */
  const recordVoiceSample = useCallback(async () => {
    if (sampling) return;

    let source = camStreamsRef.current[micSlotRef.current];
    let temporary: MediaStream | null = null;
    if (!source || source.getAudioTracks().length === 0) {
      try {
        temporary = await navigator.mediaDevices.getUserMedia({ audio: true });
        source = temporary;
      } catch (e) {
        setVoiceMsg(`Brak dostępu do mikrofonu: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    const cleanup = () => temporary?.getTracks().forEach((t) => t.stop());

    try {
      const recorder = new MediaRecorder(new MediaStream(source.getAudioTracks()));
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };

      recorder.onstop = async () => {
        cleanup();
        setSampling(false);
        setSampleProgress(100);
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const sample = await blobToBase64(blob);
          setVoiceMsg('Wysyłam próbkę do Mostu...');
          const r = await fetch(`${getBridgeBase()}/api/voice/clone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sample, voiceId: 'suweren' }),
          });
          const data = await r.json() as { success?: boolean; voiceId?: string; bytes?: number; message?: string };
          if (!r.ok || !data.success) throw new Error(data.message ?? `HTTP ${r.status}`);
          setVoiceMsg(`✅ Próbka zapisana lokalnie: ${data.voiceId} (${((data.bytes ?? 0) / 1024).toFixed(0)} kB)`);
          await refreshVoice();
          if (data.voiceId) setVoiceId(data.voiceId);
        } catch (e) {
          setVoiceMsg(`Próbka nie doszła: ${e instanceof Error ? e.message : String(e)}`);
        }
      };

      recorder.start();
      setSampling(true);
      setSampleProgress(0);
      setVoiceMsg('🎙️ Mów normalnie — zbieram 10 sekund...');

      const started = Date.now();
      const timer = window.setInterval(() => {
        const pct = Math.min(100, ((Date.now() - started) / 10_000) * 100);
        setSampleProgress(pct);
        if (pct >= 100) {
          window.clearInterval(timer);
          try { recorder.stop(); } catch { /* już stanął */ }
        }
      }, 100);
    } catch (e) {
      cleanup();
      setSampling(false);
      setVoiceMsg(`Nagrywanie próbki padło: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [refreshVoice, sampling]);

  /**
   * Głos Orba. Klon lokalny TYLKO gdy Suweren go wybrał i silnik faktycznie stoi —
   * inaczej lecimy domyślnym profilem SONIC przez syntezator przeglądarki.
   * Ta ścieżka nie dotyka GPU, więc nie ma z czego wysypać VRAM-u.
   */
  const speakWithBrowser = useCallback((text: string) => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pl-PL';
      utter.rate = 0.98;
      utter.pitch = 0.9;
      orbSpeakingRef.current = true;
      utter.onend = () => { orbSpeakingRef.current = false; };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (e) {
      orbSpeakingRef.current = false;
      console.warn('[PodcastCore] speechSynthesis niedostępny:', e);
    }
  }, []);

  const speakOrb = useCallback(async (text: string) => {
    const line = text.trim();
    if (!orbVoiceOn || !line) return;

    const useClone = voiceId !== SONIC_VOICE_ID && voiceEngine.available;
    if (!useClone) { speakWithBrowser(line); return; }

    try {
      const r = await fetch(`${getBridgeBase()}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: line, voiceId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const ctx = ensureAudio();
      if (!ctx) throw new Error('brak AudioContext');
      const buffer = await ctx.decodeAudioData(await r.arrayBuffer());

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const tail: AudioNode = sonicOn ? createSonicChain(ctx, src) : src;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      tail.connect(analyser);
      tail.connect(ctx.destination);
      if (mixDestRef.current) tail.connect(mixDestRef.current); // Orb słyszalny na antenie

      orbAnalyserRef.current = analyser;
      orbSpeakingRef.current = true;
      src.onended = () => { orbSpeakingRef.current = false; };
      src.start();
      drawOrb();
    } catch (e) {
      setVoiceMsg(`Silnik klonu milczy (${e instanceof Error ? e.message : String(e)}) — gram profilem SONIC.`);
      speakWithBrowser(line);
    }
  }, [drawOrb, ensureAudio, orbVoiceOn, sonicOn, speakWithBrowser, voiceEngine.available, voiceId]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  MÓZG ORBA — jedno zapytanie, dwa źródła inteligencji
  // ═════════════════════════════════════════════════════════════════════════════

  const askOrb = useCallback(async (question: string) => {
    const prompt = question.trim();
    if (!prompt || orbBusy) return;

    setOrbBusy(true);
    setOrbAnswer('');
    if (directorRef.current === 'AUTO') cutTo('ORB');

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

      void speakOrb(full);

      // 💉 Wnioski prosto z anteny do Księgi Odbioru — jako zadania NEW dla Mechanika.
      const injected = KoomService.injectFromSpeech(full, persona);
      if (injected.length) {
        setInjectedCount((c) => c + injected.length);
        onPlanInjected?.(injected.map((p) => p.text));
      }
    } catch (e) {
      setOrbAnswer(`(Most nieosiągalny: ${e instanceof Error ? e.message : String(e)})`);
    } finally {
      setOrbBusy(false);
    }
  }, [brain, cutTo, onPlanInjected, orbBusy, persona, speakOrb]);

  // ═════════════════════════════════════════════════════════════════════════════
  //  CYKL ŻYCIA
  // ═════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    void startCam('CAM_4_WEBBY');
    void refreshDevices();
    void refreshVoice();
    void refreshStudio();
    drawOrb();

    return () => {
      stopBroadcast();
      stopRecording();
      for (const id of CAM_IDS) stopCam(id);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (compositeAnimRef.current) cancelAnimationFrame(compositeAnimRef.current);
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      mixDestRef.current = null;
      if (ctx && ctx.state !== 'closed') void ctx.close();
    };
    // Montaż jednorazowy — sprzątanie korzysta z refów, nie ze stanu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═════════════════════════════════════════════════════════════════════════════
  //  WIDOK
  // ═════════════════════════════════════════════════════════════════════════════

  const levelOf = (key: string): number => Math.min(100, ((levels[key] ?? 0) / 128) * 100);
  const programLabel = program === 'ORB' ? 'AI ORB' : (CAM_SLOTS.find((s) => s.id === program)?.label ?? program);

  return (
    <div className="relative w-full h-full min-h-[650px] bg-[#050608] text-white flex flex-col p-4 rounded-2xl border border-cyan-500/20 shadow-2xl overflow-y-auto backdrop-blur-xl">

      {/* --- GÓRNA BELKA: status + transport --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 z-10 bg-black/40 px-5 py-3 rounded-xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-cyan-300">TeO Studio // Podcast 1/1</h2>
          <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-white/5 border border-white/10 text-cyan-300">
            PROGRAM: {programLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['PROGRAM', 'QUAD', 'PIP'] as LayoutMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setLayout(mode)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-mono transition-all ${
                layout === mode
                  ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            title="Zapis fizycznego pliku .webm przez Most Wiesia"
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-lg ${
              isRecording
                ? 'bg-amber-500 text-black shadow-amber-500/40 animate-pulse'
                : 'bg-white/5 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            {isRecording ? '■ STOP NAGRYWANIA' : '● NAGRAJ ODCINEK'}
          </button>

          <button
            onClick={isBroadcasting ? stopBroadcast : startBroadcast}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-lg ${
              isBroadcasting
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/50 animate-pulse'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-cyan-500/30'
            }`}
          >
            {isBroadcasting ? '● LIVE RTMP' : 'START BROADCAST'}
          </button>
        </div>
      </div>

      {/* --- REŻYSERKA: monitor programowy + multiview --- */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4 my-4">

        {/* Monitor programowy = DOKŁADNIE to, co idzie w świat */}
        <div className="relative rounded-xl overflow-hidden border border-cyan-500/30 bg-black shadow-[0_0_30px_rgba(0,240,255,0.12)]">
          <canvas ref={compositeCanvasRef} width={1920} height={1080} className="w-full h-auto block" />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="bg-black/70 px-2.5 py-1 rounded-md text-[10px] font-mono border border-white/10">
              PROGRAM 1920×1080
            </span>
            {isBroadcasting && <span className="bg-red-600 text-white px-2.5 py-1 rounded-md text-[10px] font-mono">● LIVE</span>}
            {isRecording && <span className="bg-amber-500 text-black px-2.5 py-1 rounded-md text-[10px] font-mono">● REC</span>}
          </div>
        </div>

        {/* Multiview: cztery gniazda + Orb */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-gray-400">🎥 REŻYSER</span>
            <div className="flex gap-1">
              {(['AUTO', 'MANUAL'] as DirectorMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setDirectorMode(m)}
                  title={m === 'AUTO' ? 'Cięcie po głosie — kto mówi, ten jest na wizji' : 'Cięcie ręczne — klikasz kafelek'}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                    directorMode === m ? 'bg-cyan-500 text-black font-bold' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {CAM_SLOTS.map((slot) => (
            <div
              key={slot.id}
              onClick={() => manualCut(slot.id)}
              className={`relative rounded-lg overflow-hidden border cursor-pointer bg-black/60 aspect-video transition-all ${
                program === slot.id ? 'border-cyan-400 shadow-[0_0_16px_rgba(0,240,255,0.35)]' : 'border-white/10 hover:border-cyan-500/40'
              }`}
            >
              <video
                ref={(el) => { camVideoRefs.current[slot.id] = el; }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${slot.id === 'CAM_4_WEBBY' ? 'transform -scale-x-100' : ''}`}
              />
              {!camActive[slot.id] && (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-gray-500">
                  {slot.tag} — WOLNE
                </div>
              )}

              {/* Wskaźnik poziomu — z tego reżyser czyta, kto mówi */}
              <div className="absolute left-0 bottom-0 h-1 bg-cyan-400/80 transition-all" style={{ width: `${levelOf(slot.id)}%` }} />

              <div className="absolute top-1 left-1 flex items-center gap-1">
                <span className="bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-mono border border-white/10">{slot.tag}</span>
                {micSlot === slot.id && <span className="bg-emerald-500/80 text-black px-1.5 py-0.5 rounded text-[9px] font-mono">MIC</span>}
              </div>

              <div className="absolute top-1 right-1 flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setMicSlot(slot.id); }}
                  title="Ten wejście zostaje mikrofonem anteny"
                  className="bg-black/70 hover:bg-emerald-600/70 px-1.5 py-0.5 rounded text-[9px] font-mono border border-white/10"
                >
                  🎙
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (camActive[slot.id]) stopCam(slot.id); else void startCam(slot.id); }}
                  className="bg-black/70 hover:bg-cyan-600/70 px-1.5 py-0.5 rounded text-[9px] font-mono border border-white/10"
                >
                  {camActive[slot.id] ? '■' : '▶'}
                </button>
              </div>
            </div>
          ))}

          {/* Orb jako pełnoprawne ujęcie */}
          <div
            onClick={() => manualCut('ORB')}
            className={`relative rounded-lg overflow-hidden border cursor-pointer bg-black/60 flex items-center justify-center py-2 transition-all ${
              program === 'ORB' ? 'border-cyan-400 shadow-[0_0_16px_rgba(0,240,255,0.35)]' : 'border-white/10 hover:border-cyan-500/40'
            }`}
          >
            <canvas ref={orbCanvasRef} width={240} height={240} className="w-24 h-24 rounded-full" />
            <span className="ml-2 text-[10px] font-mono tracking-widest text-cyan-300">AI ORB</span>
            <div className="absolute left-0 bottom-0 h-1 bg-violet-400/80 transition-all" style={{ width: `${levelOf('ORB')}%` }} />
          </div>
        </div>
      </div>

      {/* --- PRZYPISANIE URZĄDZEŃ DO GNIAZD --- */}
      <div className="z-10 bg-black/40 px-4 py-3 rounded-xl border border-white/10 backdrop-blur-md mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono tracking-widest text-gray-400">🎛️ PRZYPISANIE KAMER</span>
          <button
            onClick={() => void refreshDevices()}
            className="px-2.5 py-1 rounded text-[10px] font-mono bg-white/5 border border-white/10 hover:bg-white/10"
          >
            ODŚWIEŻ ({devices.length})
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {CAM_SLOTS.map((slot) => (
            <div key={slot.id} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyan-300 w-16 shrink-0">{slot.tag}</span>
              <select
                value={camDevice[slot.id]}
                onChange={(e) => {
                  const id = e.target.value;
                  setCamDevice((prev) => ({ ...prev, [slot.id]: id }));
                  if (camActive[slot.id]) { stopCam(slot.id); void startCam(slot.id, id); }
                }}
                className="flex-1 min-w-0 bg-black/50 border border-cyan-700/30 rounded-md px-2 py-1 text-[10px] text-slate-300 outline-none"
              >
                <option value="">— domyślne urządzenie —</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Kamera ${i + 1}`}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* --- SYSTEM KLONOWANIA GŁOSU --- */}
      <div className="z-10 bg-black/40 px-4 py-3 rounded-xl border border-violet-500/20 backdrop-blur-md mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest text-violet-300 mr-1">🎛️ SYSTEM KLONOWANIA GŁOSU</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            voiceEngine.available
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-white/5 border-white/10 text-gray-400'
          }`}>
            SILNIK: {voiceEngine.available ? 'LOKALNY ONLINE' : 'OFFLINE → profil SONIC'}
          </span>
          <button
            onClick={() => void refreshVoice()}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 hover:bg-white/10"
          >
            ODŚWIEŻ
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void recordVoiceSample()}
            disabled={sampling}
            className="px-3 py-1.5 rounded-md text-[11px] font-mono bg-violet-600/30 border border-violet-400/50 text-violet-100 hover:bg-violet-600/50 disabled:opacity-40 transition-all"
          >
            {sampling ? `NAGRYWAM... ${Math.round(sampleProgress)}%` : '🎙️ Nagraj próbkę głosu (10s)'}
          </button>

          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            title="Głos, którym mówi AI Orb"
            className="bg-black/50 border border-violet-700/40 rounded-md px-2 py-1.5 text-[11px] text-slate-200 outline-none"
          >
            <option value={SONIC_VOICE_ID}>🎚️ SONIC (profil domyślny — bez klonu)</option>
            {voiceEngine.voices.map((v) => (
              <option key={v} value={v}>🗣️ {v}{voiceEngine.available ? '' : ' (silnik offline)'}</option>
            ))}
          </select>

          <button
            onClick={() => setOrbVoiceOn((s) => !s)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-mono transition-all border ${
              orbVoiceOn ? 'bg-violet-600/30 border-violet-400/50 text-violet-200' : 'bg-white/5 border-white/10 text-gray-500'
            }`}
          >
            🔊 GŁOS ORBA {orbVoiceOn ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setSonicOn((s) => !s)}
            title="Profil głosu Sonica — ocieplenie i stabilizacja pasma AI Orba"
            className={`px-3 py-1.5 rounded-md text-[11px] font-mono transition-all border ${
              sonicOn ? 'bg-violet-600/30 border-violet-400/50 text-violet-200' : 'bg-white/5 border-white/10 text-gray-500'
            }`}
          >
            🎚️ SONIC {sonicOn ? 'ON' : 'OFF'}
          </button>
        </div>

        {sampling && (
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-violet-400 transition-all" style={{ width: `${sampleProgress}%` }} />
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-gray-500">
          {voiceEngine.available
            ? 'Klon mówi lokalnie (XTTS/OpenVoice na :5002) i wchodzi na antenę przez profil SONIC.'
            : 'Brak klonu → Orb mówi syntezatorem przeglądarki (zero VRAM, zero chmury). Ten tor słychać w pokoju, ale NIE wchodzi na transmisję — na antenę wejdzie dopiero klon z lokalnego silnika.'}
        </p>
        {voiceMsg && <p className="text-[10px] font-mono text-violet-300 break-all">{voiceMsg}</p>}
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
            onClick={() => setPersona((p) => (p === 'ECHO' ? 'ISKRA' : 'ECHO'))}
            title="Pod tą flagą wniosek trafia do Księgi Odbioru"
            className="px-3 py-1.5 rounded-md text-[11px] font-mono bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            style={{ color: persona === 'ISKRA' ? '#f472b6' : '#22d3ee' }}
          >
            {persona === 'ISKRA' ? '🔥 ISKRA' : '🌊 ECHO'}
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

      {/* --- DOLNA BELKA: mikrofon, nagranie, antena --- */}
      <div className="z-10 bg-black/40 px-4 py-3 rounded-xl border border-white/10 backdrop-blur-md space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleMic}
            className={`px-3 py-2 rounded-lg border text-[11px] font-mono transition-all ${
              isMicMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            {isMicMuted ? 'MIC OFF' : 'MIC ON'}
          </button>

          <input
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="Tytuł odcinka (nazwa pliku)"
            className="bg-black/50 border border-amber-700/30 focus:border-amber-500/60 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none w-56"
          />

          <button
            onClick={() => setWantMp4((v) => !v)}
            title="Po zatrzymaniu Most przekonwertuje .webm → .mp4 w tle (obciąża CPU)"
            className={`px-3 py-2 rounded-lg text-[11px] font-mono border transition-all ${
              wantMp4 ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'bg-white/5 border-white/10 text-gray-500'
            }`}
          >
            → MP4 {wantMp4 ? 'TAK' : 'NIE'}
          </button>

          <span className="text-[10px] font-mono text-gray-500 truncate max-w-full">
            💾 {studio.recordingsDir || '(Most nie odpowiada)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
            studio.ffmpeg ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}>
            ffmpeg: {studio.ffmpeg ? 'OK' : 'BRAK'}
          </span>
          <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
            studio.rtmpConfigured ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
          }`}>
            klucz RTMP: {studio.rtmpConfigured ? studio.rtmpKeyMasked : 'BRAK'}
          </span>
          <input
            type="password"
            value={rtmpKeyInput}
            onChange={(e) => setRtmpKeyInput(e.target.value)}
            placeholder="Klucz transmisji YouTube (zostaje na Moście)"
            className="flex-1 min-w-[200px] bg-black/50 border border-cyan-700/30 focus:border-cyan-500/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-200 outline-none"
          />
          <button
            onClick={() => void saveRtmpKey()}
            disabled={!rtmpKeyInput.trim()}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono bg-white/5 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
          >
            ZAPISZ KLUCZ
          </button>
        </div>

        {(relayMsg || recMsg) && (
          <div className="text-[10px] font-mono text-gray-400 space-y-0.5 break-all">
            {relayMsg && <div>📡 {relayMsg}</div>}
            {recMsg && <div>💾 {recMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PodcastCore;
