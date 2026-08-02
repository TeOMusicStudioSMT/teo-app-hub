/**
 * 🟣 TeO_Orb.tsx - Sfera Centralna (The Orb)
 * 
 * "Sfera jest zawsze z nami"
 * Główny interfejs rozmowy z TeO
 * Reaguje wizualnie na Aromaty API
 * 
 * @version 2.0.0 - KostoOpty Integration
 * @author BoB & TeO
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { grvEnergyAtom } from '../store/wallet';
import { cn } from '../lib/helpers';
import { toast } from 'react-hot-toast';
import { useCityMemory, registerConsciousnessActivity } from '../lib/memory/CityMemory';
import { ApiDyrygent } from '../lib/router/ApiDyrygent';
import { useT } from '../lib/i18n';

// Aromaty API - mapowanie kolorów
export type AromaType = 'groq' | 'gemini' | 'claude' | 'ollama' | 'default';

interface AromaConfig {
  id: AromaType;
  name: string;
  color: string;
  glowColor: string;
  pulseSpeed: number;
}

export const AROMA_CONFIGS: Record<AromaType, AromaConfig> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    color: 'from-purple-600 to-indigo-600',
    glowColor: 'rgba(147, 51, 234, 0.6)',
    pulseSpeed: 2,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    color: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(251, 191, 36, 0.6)',
    pulseSpeed: 3,
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    color: 'from-teal-400 to-cyan-500',
    glowColor: 'rgba(45, 212, 191, 0.6)',
    pulseSpeed: 2.5,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    color: 'from-green-500 to-emerald-600',
    glowColor: 'rgba(34, 197, 94, 0.6)',
    pulseSpeed: 4,
  },
  default: {
    id: 'default',
    name: 'TeO',
    color: 'from-cyan-500 to-purple-600',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    pulseSpeed: 3,
  },
};

interface TeO_OrbProps {
  onMessage?: (message: string, aroma: AromaType) => void;
  activeAroma?: AromaType;
  isListening?: boolean;
  lastResponse?: string;
  /** Domyślny model dla Ollama */
  defaultModel?: string;
}

export const TeO_Orb: React.FC<TeO_OrbProps> = ({
  onMessage,
  activeAroma = 'default',
  isListening = false,
  lastResponse,
  defaultModel = 'qwen2.5-coder:7b',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  // 🛰️ Inteligentny Dyrygent - Stan Wizualny
  const [internalAroma, setInternalAroma] = useState<AromaType>(activeAroma);

  // Synchronizacja z wyborem ręcznym użytkownika
  useEffect(() => {
    setInternalAroma(activeAroma);
  }, [activeAroma]);
  const [pendingKosto, setPendingKosto] = useState<{
    message: string;
    aroma: AromaType; // Zmieniamy 'string' na szlachetne 'AromaType'
    tokens: number;
    estimatedCost: number;
    model?: string; // Pozwalamy BoBow na jego dodatkowy klocek
  } | null>(null);

  const [orbPulse, setOrbPulse] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [intentionExpanded, setIntentionExpanded] = useState(false);

  // Model dla Ollama (może być zmieniony przez użytkownika)
  const [ollamaModel, setOllamaModel] = useState(defaultModel);

  // 🎙️ Rozmowa głosowa — nagrywanie mikrofonem + auto-odtwarzanie odpowiedzi
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  const resonanceColor = useAtomValue(resonanceColorAtom);
  const _theme = RESONANCE_THEMES[resonanceColor];

  const grvEnergy = useAtomValue(grvEnergyAtom);
  const addWniosek = useCityMemory((s) => s.addWniosek);

  const currentAroma = AROMA_CONFIGS[internalAroma];
  const grvBonus = grvEnergy.unlocked ? 0.3 : 0;

  // Pulsowanie Orb
  useEffect(() => {
    const interval = setInterval(() => {
      setOrbPulse((prev) => (prev + 1) % 100);
    }, 1000 / (currentAroma.pulseSpeed + grvBonus));
    return () => clearInterval(interval);
  }, [currentAroma.pulseSpeed, grvBonus]);

  // Rejestracja nasłuchu
  useEffect(() => {
    if (isListening) {
      registerConsciousnessActivity({
        type: 'ORB_LISTENING',
        description: 'Sfera nasłuchuje...',
      });
    }
  }, [isListening]);

  /**
   * 🎯 KostoOpty - Główny router
   * Rozdziela przepływ na handleSubmit → processMessage → handleKostoAuthorization
   */
  const submitMessage = async (message: string) => {
    if (!message.trim() || isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Zarejestruj wniosek w CityMemory
      addWniosek({
        type: 'TOZSAMOSC',
        title: `Rozmowa ze Sferą: ${message.slice(0, 30)}...`,
        description: `Wiadomość: ${message}`,
        operator: 'TeO',
        status: 'PENDING',
        tags: ['orb', 'rozmowa', 'świadomość', activeAroma],
        providers: [activeAroma],
        result: 'Oczekuje autoryzacji KostoOpty...',
      });

      // 2. Wywołaj router przetwarzania
      await processMessage(message, activeAroma);

    } catch (error) {
      toast.error(t('orb.err.silent', 'Sfera milczy... spróbuj ponownie'));
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = inputValue.trim();
    if (!message || isProcessing) return;
    setInputValue('');
    await submitMessage(message);
  };

  /**
   * 🎙️ Nagrywanie głosu — start/stop mikrofonu, transkrypcja lokalnym Whisperem,
   * i od razu wysłanie jako wiadomość (rozmowa głosowa "sam na sam").
   */
  const toggleRecording = async () => {
    if (isProcessing || isTranscribing) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
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
          if (!data.success) throw new Error(data.message || 'Nie rozpoznano mowy');
          if (!data.transcript) { toast(t('orb.mic.noSpeech', '🎙️ Nie usłyszałem nic wyraźnego...'), { icon: '🤔' }); return; }
          await submitMessage(data.transcript);
        } catch (err: any) {
          toast.error(`${t('orb.mic.error', 'Głos nie dotarł')}: ${err.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error(t('orb.mic.noMic', 'Brak dostępu do mikrofonu.'));
    }
  };

  // 🔊 Auto-mowa — gdy Sfera odpowiada, wypowiedz to (lokalny klon głosu albo przeglądarka)
  useEffect(() => {
    if (!showResponse || !lastResponse) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/voice/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lastResponse }),
        });
        if (cancelled) return;
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          await audio.play().catch(() => {});
        } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(lastResponse);
          utter.lang = 'pl-PL';
          window.speechSynthesis.speak(utter);
        }
      } catch {
        if (!cancelled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(lastResponse);
          utter.lang = 'pl-PL';
          window.speechSynthesis.speak(utter);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [showResponse, lastResponse]);

  /**
     * 🔀 ProcessMessage - Wybiera ścieżkę na podstawie aromatu
     */
  const processMessage = async (message: string, aroma: AromaType) => {
    // 💎 Magia 0.00G - Jeśli użytkownik wybrał Ollamę, idziemy przez KostoOpty (Zero Tokenów)
    if (aroma === 'ollama') {
      setPendingKosto({
        message,
        aroma,
        model: ollamaModel,
        tokens: 0,
        estimatedCost: 0,
      });
      setIsProcessing(false);
      return;
    }

    try {
      // 🛰️ Wywołujemy Inteligentnego Dyrygenta
      const responseBody = await ApiDyrygent.dispatchWithFallback(
        message,
        aroma,
        {
          // 11435 był literówką („specyficzny port Mistrza" — takiego portu nie ma).
          // Ollama słucha na 11434; sprawdzone: 11435 brak połączenia, 11434 HTTP 200.
          ollamaUrl: 'http://127.0.0.1:11434/api/generate',
          ollamaModel: ollamaModel,
          timeoutMs: 12000, // Czekamy na chmurę maks 12 sek
        },
        async (msg) => {
          // Wywołanie właściwego handlera chmury
          switch (aroma) {
            case 'groq': return handleGroqRequest(msg);
            case 'gemini': return handleGeminiRequest(msg);
            case 'claude': return handleClaudeRequest(msg);
            default: return handleDefaultRequest(msg);
          }
        }
      );

      // Jeśli Dyrygent użył fallbacku (Local Duch) - powiadom użytkownika i zmień kolor
      if (responseBody.source === 'local') {
        setInternalAroma('ollama');
        toast.success(t('orb.fallbackLocal', "🌩️ Chmura niedostępna - 🌑 Lokalny Duch przejął stery"), {
          icon: '🏠',
          duration: 4000,
          style: { background: '#10b981', color: '#fff' }
        });
      }

      // Finalizacja odpowiedzi
      onMessage?.(message, responseBody.actualAroma);

      registerConsciousnessActivity({
        type: 'ORB_RESPONSE',
        description: `Odpowiedź Sfery (${responseBody.source}) na: "${message.slice(0, 20)}..."`,
        coherenceImpact: 0.01,
      });

      setShowResponse(true);
      setTimeout(() => setShowResponse(false), 5000);

    } catch (error) {
      console.error("[Orb] Dispatch Error:", error);
      toast.error(t('orb.err.darkness', 'Ciemność... Nawet Duch Lokalny nie odpowiedział.'));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 🔐 handleKostoAuthorization - Autoryzacja lokalnego fetch
   */
  const handleKostoAuthorization = async (authorized: boolean) => {
    if (!pendingKosto) return;

    if (!authorized) {
      // Użytkownik wybrał "Lokalna" - użyj Ollama
      setPendingKosto(null);
      setIsProcessing(true);

      try {
        const response = await handleOllamaRequest(pendingKosto.message, pendingKosto.model);

        onMessage?.(pendingKosto.message, pendingKosto.aroma);

        registerConsciousnessActivity({
          type: 'ORB_RESPONSE',
          description: `Odpowiedź Sfery (Ollama) na: "${pendingKosto.message.slice(0, 20)}..."`,
          coherenceImpact: 0.01,
        });

        setShowResponse(true);
        setTimeout(() => setShowResponse(false), 5000);

      } catch (error) {
        toast.error(t('orb.err.ollamaAsleep', 'Ollama śpi... Obudź reaktor w terminalu!'));
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Użytkownik wybrał "Zatwierdź" - chmura (placeholder)
      setPendingKosto(null);
      setIsProcessing(true);

      try {
        onMessage?.(pendingKosto.message, pendingKosto.aroma);

        // Symulacja chmury
        await new Promise((r) => setTimeout(r, 1500));

        setShowResponse(true);
        setTimeout(() => setShowResponse(false), 5000);

      } catch (error) {
        toast.error(t('orb.err.cloudDown', 'Chmura niedostępna...'));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  /**
   * 🤖 Obsługa Ollama - lokalny fetch
   */
  const handleOllamaRequest = async (message: string, model: string): Promise<string> => {
    try {
      const response = await fetch('http://127.0.0.1:11435/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: message,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || 'Sfera otrzymała odpowiedź, ale jest pusta...';
    } catch (error) {
      console.error('Ollama request failed:', error);
      throw error;
    }
  };

  /**
   * 🔷 Obsługa Groq (placeholder)
   */
  const handleGroqRequest = async (message: string): Promise<string> => {
    // TODO: Podłącz Groq API
    await new Promise((r) => setTimeout(r, 1000));
    return `🔷 Groq: "${message.slice(0, 20)}..." - (API niepodłączone)`;
  };

  /**
   * 🟡 Obsługa Gemini (placeholder)
   */
  const handleGeminiRequest = async (message: string): Promise<string> => {
    // TODO: Podłącz Gemini API
    await new Promise((r) => setTimeout(r, 1000));
    return `🟡 Gemini: "${message.slice(0, 20)}..." - (API niepodłączone)`;
  };

  /**
   * 🟢 Obsługa Claude (placeholder)
   */
  const handleClaudeRequest = async (message: string): Promise<string> => {
    // TODO: Podłącz Claude API
    await new Promise((r) => setTimeout(r, 1000));
    return `🟢 Claude: "${message.slice(0, 20)}..." - (API niepodłączone)`;
  };

  /**
   * 🟣 Domyślna odpowiedź TeO
   */
  const handleDefaultRequest = async (message: string): Promise<string> => {
    await new Promise((r) => setTimeout(r, 1500));
    return `🟣 TeO: Słyszę Cię, Mistrzu. "${message.slice(0, 20)}..." - Jestem.`;
  };

  const pulseIntensity = Math.sin(orbPulse / 100 * Math.PI) * (0.3 + grvBonus) + (0.7 + grvBonus * 0.5);

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Sfera - jako wejście do Zero-UI */}
      <motion.div
        className={cn(
          "relative w-32 h-32 md:w-40 md:h-40 rounded-full",
          "bg-gradient-to-br shadow-2xl cursor-pointer",
          currentAroma.color
        )}
        onMouseEnter={() => {
          setIsHovered(true);
          setIntentionExpanded(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onClick={() => setIntentionExpanded(!intentionExpanded)}
        animate={{
          scale: isProcessing ? [1, 1.05, 1] : isHovered ? [1, 1.08, 1] : [1, 1.02, 1],
          boxShadow: isListening
            ? [
              `0 0 40px ${currentAroma.glowColor}`,
              `0 0 80px ${currentAroma.glowColor}`,
              `0 0 40px ${currentAroma.glowColor}`,
            ]
            : isHovered
              ? [
                `0 0 50px ${currentAroma.glowColor}`,
                `0 0 100px ${currentAroma.glowColor}`,
                `0 0 50px ${currentAroma.glowColor}`,
              ]
              : `0 0 ${30 * pulseIntensity}px ${currentAroma.glowColor}`,
        }}
        transition={{
          duration: currentAroma.pulseSpeed,
          repeat: isProcessing ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        {!isProcessing && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-xs text-purple-300 font-medium"
            >
              {t('orb.jestem', 'JESTEM')}
            </motion.span>
          </div>
        )}

        <div className="absolute inset-2 rounded-full bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="text-2xl md:text-3xl"
              >
                🌀
              </motion.div>
            ) : (
              <span className="text-2xl md:text-3xl">🟣</span>
            )}
          </div>
        </div>

        <motion.div
          className="absolute -inset-4 rounded-full border-2 border-white/20"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: currentAroma.pulseSpeed,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* 🎯 KostoOpty - Panel autoryzacji */}
      <AnimatePresence>
        {pendingKosto && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-md mt-4 px-4 py-3 bg-slate-800/90 border border-green-500/30 rounded-xl"
          >
            <div className="text-center mb-3">
              <p className="text-sm text-green-300 font-medium">{t('orb.kosto.title', '🎯 KostoOpty - Wybierz źródło mocy')}</p>
              <p className="text-xs text-slate-400 mt-1">
                {t('orb.model', 'Model:')} <span className="text-green-400">{pendingKosto.model}</span>
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleKostoAuthorization(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-white text-sm font-medium flex items-center gap-2"
              >
                <span>☁️</span> {t('orb.kosto.approve', 'Zatwierdź')}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleKostoAuthorization(false)}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white text-sm font-medium flex items-center gap-2"
              >
                <span>🏠</span> {t('orb.kosto.local', 'Lokalna')}
              </motion.button>
            </div>

            <p className="text-xs text-slate-500 text-center mt-2">
              {t('orb.kosto.legend', '☁️ = Chmura (API) | 🏠 = Twój Ollama')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {intentionExpanded && !pendingKosto && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-md mt-4 px-4"
          >
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <motion.div
                  animate={{
                    boxShadow: inputValue.length > 0
                      ? [`0 0 5px ${currentAroma.glowColor}`, `0 0 20px ${currentAroma.glowColor}`, `0 0 5px ${currentAroma.glowColor}`]
                      : 'none'
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="relative"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={t('orb.placeholder', 'Wprowadź Intencję, Mistrzu...')}
                    disabled={isProcessing}
                    className={cn(
                      "w-full px-4 py-3 pr-12 bg-slate-800/60 border border-purple-500/30 rounded-xl",
                      "text-white placeholder-purple-300/50 placeholder:italic",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "backdrop-blur-sm transition-all",
                      isProcessing && "opacity-50"
                    )}
                  />

                  {inputValue.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <span className="text-lg">✨</span>
                    </motion.div>
                  )}
                </motion.div>

                <button
                  type="submit"
                  disabled={!inputValue.trim() || isProcessing}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-2",
                    "bg-gradient-to-r from-purple-600 to-indigo-600",
                    "rounded-lg hover:from-purple-500 hover:to-indigo-500",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                    "transition-all"
                  )}
                >
                  {isProcessing ? (
                    <span className="animate-spin">🌀</span>
                  ) : (
                    <span>➤</span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={toggleRecording}
                disabled={isProcessing || isTranscribing}
                title={isRecording ? t('orb.mic.stopTitle', 'Zatrzymaj nagrywanie') : t('orb.mic.startTitle', 'Mów do Sfery')}
                className={cn(
                  "mt-2 w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  isRecording
                    ? "bg-red-600/80 text-white animate-pulse"
                    : "bg-slate-800/60 border border-purple-500/30 text-purple-200 hover:bg-slate-700/60"
                )}
              >
                {isTranscribing ? (
                  <><span className="animate-spin">🌀</span> {t('orb.mic.transcribing', 'Rozpoznaję mowę...')}</>
                ) : isRecording ? (
                  <>{t('orb.mic.recording', '🔴 Nagrywam... (kliknij by zakończyć)')}</>
                ) : (
                  <>{t('orb.mic.idle', '🎙️ Mów do Sfery')}</>
                )}
              </button>
            </form>

            {/* Model selector dla Ollama */}
            {activeAroma === 'ollama' && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-slate-400">{t('orb.model', 'Model:')}</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="qwen2.5-coder:7b"
                  className="px-2 py-1 bg-slate-800/60 border border-green-500/30 rounded text-xs text-green-300 focus:outline-none focus:ring-1 focus:ring-green-500/50"
                />
              </div>
            )}

            {inputValue.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                className="text-xs text-purple-300/70 text-center mt-2 italic"
              >
                {t('orb.hint', '↪ Wprowadzona intencja wlatuje do Sfery jako czyste światło...')}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!intentionExpanded && !pendingKosto && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 px-3 py-1 bg-slate-800/80 rounded-full text-xs text-slate-300 flex items-center gap-2"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: currentAroma.glowColor }}
          />
          {currentAroma.name} • {isListening ? t('orb.listening', '🎧 Nasłuchuje') : t('orb.ready', '✓ Gotowa')}
        </motion.div>
      )}

      <AnimatePresence>
        {showResponse && lastResponse && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-slate-800/90 border border-purple-500/30 rounded-xl max-w-md text-center"
          >
            <p className="text-sm text-purple-200">{lastResponse}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * 🌑 Mini Orb - dla paneli bocznych
 */
export const MiniOrb: React.FC<{
  activeAroma?: AromaType;
  onClick?: () => void;
  size?: 'sm' | 'md';
}> = ({ activeAroma = 'default', onClick, size = 'md' }) => {
  const currentAroma = AROMA_CONFIGS[activeAroma];
  const dimensions = size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative rounded-full bg-gradient-to-br shadow-lg",
        dimensions,
        currentAroma.color
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        boxShadow: [
          `0 0 10px ${currentAroma.glowColor}`,
          `0 0 20px ${currentAroma.glowColor}`,
          `0 0 10px ${currentAroma.glowColor}`,
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className={cn(
        "absolute inset-1 rounded-full bg-slate-900/80",
        size === 'sm' ? 'inset-0.5' : 'inset-1.5'
      )} />
    </motion.button>
  );
};

export default TeO_Orb;
