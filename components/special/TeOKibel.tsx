/**
 * 🔐 TeO-Kibel — Lokalny Skarbiec v1.1
 * 
 * "Błękitna neonowa misa Wiru 26"
 * 
 * Funkcje v1.1:
 * - Wirująca misa zgodnie z Wir 26
 * - Drag & Drop (.env.local) - naprawione
 * - Paste (schowek) - Wiesław parsuje
 * - Wielkie Spłukiwanie (The Flush) z JW Protocol
 * - Aromatyzer (Zapachy)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listKeys, clearKibel, storeKey, retrieveKey, detectKeyProvider, flushKibel } from '../../lib/kibel';
import { pulse, registerKibelFlush } from '../../lib/wir26heartbeat';
import { negotiateAccess } from '../../lib/jwProtocol';
import { registerZator } from '../../lib/wir26heartbeat';
import { useResonance } from '../../hooks/useResonance';
import { clearHistory, useCityMemory } from '../../lib/memory/CityMemory';

// Aromaty - "Zapachy" - mapowanie na providerów z kibel.ts
const AROMATS = [
  { id: 'gemini', name: 'Gemini Blue', icon: '🔵', color: '#3b82f6', keyName: 'gemini' },
  { id: 'suno', name: 'Suno Gold', icon: '🟡', color: '#eab308', keyName: 'suno' },
  { id: 'anthropic', name: 'Gaia Green', icon: '🟢', color: '#22c55e', keyName: 'anthropic' },
];

// Mapa kluczy do rozpoznawania
const KEY_PATTERNS = [
  { pattern: /SUNO_COOKIE|SUNO_TOKEN/i, provider: 'suno', name: 'Suno Cookie' },
  { pattern: /GEMINI_API_KEY|GEMINI_KEY/i, provider: 'gemini', name: 'Gemini API' },
  { pattern: /ANTHROPIC_API_KEY|CLAUDE_KEY/i, provider: 'anthropic', name: 'Anthropic API' },
  { pattern: /OPENAI_API_KEY|OPENAI_KEY/i, provider: 'openai', name: 'OpenAI API' },
  { pattern: /GROQ_API_KEY|GROQ_KEY/i, provider: 'groq', name: 'Groq API' },
  { pattern: /NVIDIA_API_KEY|NVIDIA_KEY|NIM_KEY/i, provider: 'nvidia', name: 'NVIDIA API' },
  { pattern: /OPENROUTER_API_KEY|OPENROUTER_KEY/i, provider: 'openrouter', name: 'OpenRouter API' },
  // 🆕 SUROWE KLUCZE - bez nazwy zmiennej
  { pattern: /(gsk_[a-zA-Z0-9_-]{20,})/i, provider: 'groq', name: 'Groq (raw)' },
  { pattern: /(AIzaSy[a-zA-Z0-9_-]{33})/i, provider: 'gemini', name: 'Gemini (raw)' },
  { pattern: /(sk-or-[a-zA-Z0-9_-]{20,})/i, provider: 'openrouter', name: 'OpenRouter (raw)' },
  { pattern: /(sk-[a-zA-Z0-9_-]{20,})/i, provider: 'openai', name: 'OpenAI (raw)' },
  { pattern: /(sk-ant-[a-zA-Z0-9_-]{20,})/i, provider: 'anthropic', name: 'Anthropic (raw)' },
];

interface TeOKibelProps {
  onFlush?: () => void;
}

export const TeOKibel: React.FC<TeOKibelProps> = ({ onFlush }) => {
  const [isFlushing, setIsFlushing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [keys, setKeys] = useState<any[]>([]);
  const [rotation, setRotation] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(1);
  const [jwLogs, setJwLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [keyActive, setKeyActive] = useState(false); // ✅ Status "klucz aktywny w rurach"
  const [systemReady, setSystemReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addResonance } = useResonance();

  // Dodaj log od Wiesława lub Jadzi
  const wieslawLog = useCallback((msg: string) => {
    console.log(`[WIESŁAW]: ${msg}`);
    setJwLogs(prev => [...prev.slice(-4), `[WIESŁAW]: ${msg}`]);
  }, []);

  const jadziaLog = useCallback((msg: string) => {
    console.log(`[JADZIA]: ${msg}`);
    setJwLogs(prev => [...prev.slice(-4), `[JADZIA]: ${msg}`]);
  }, []);

  // Wir 26 - rotacja
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => prev + (isDragOver ? 8 : 2));
    }, 50);
    return () => clearInterval(interval);
  }, [isDragOver]);

  // Intensywność glow przy drag
  useEffect(() => {
    setGlowIntensity(isDragOver ? 2.5 : 1);
  }, [isDragOver]);

  // Pobierz klucze + sprawdź status systemu
  const refreshKeys = useCallback(() => {
    const keyList = listKeys();
    setKeys(keyList);

    // ✅ Sprawdź status systemu (flushKibel)
    const status = flushKibel();
    setSystemReady(status.systemReady);
    setKeyActive(status.systemReady); // Klucz aktywny = system gotowy
  }, []);

  useEffect(() => {
    // ✅ Nie resetuj stanu jeśli systemReady jest true - klucze są bezpieczne!
    if (systemReady) return;
    refreshKeys();
  }, [refreshKeys, showSuccess, systemReady]);

  // Sprawdź czy klucz istnieje
  const hasKey = (keyName: string) => keys.some(k => k.provider === keyName);

  // ====== PASTE - Wiesław parsuje schowek ======
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      wieslawLog('Widzę, że coś wklejasz! Zaraz sprawdzę...');

      const text = e.clipboardData?.getData('text') || '';

      if (!text || text.length < 5) {
        wieslawLog('Pusty schowek? Nic nie widzę!');
        return;
      }

      wieslawLog(`Otrzymano ${text.length} znaków. Szukam kluczy...`);

      // Parsuj tekst w poszukiwaniu kluczy
      await parseAndStoreKeys(text);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('paste', handlePaste);
    }

    return () => {
      if (container) {
        container.removeEventListener('paste', handlePaste);
      }
    };
  }, []);

  // Funkcja parsująca i zapisująca klucze
  const parseAndStoreKeys = async (content: string) => {
    setIsProcessing(true);

    // DEBUG: Kibel widzi wejście (sanitized!)
    const sanitized = content.length > 50 ? content.substring(0, 20) + "****" + content.substring(content.length - 10) : "****";
    console.log("🟣 Kibel widzi wejście:", sanitized);

    const lines = content.split('\n');
    let foundKeys = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let stored = false;

      // Sprawdź każdy wzorzec regex
      for (const { pattern, provider, name } of KEY_PATTERNS) {
        if (pattern.test(trimmed)) {
          // Wyciągnij wartość po =
          const value = trimmed.split('=')[1]?.replace(/^["']|["']$/g, '').trim();

          if (value && value.length > 5) {
            storeKey({
              id: crypto.randomUUID(),
              name,
              provider: provider as any,
              value,
              createdAt: Date.now(),
              lastUsed: Date.now(),
            });

            // 🧹 WIESŁAW: Log z aromatami
            const providerColors: Record<string, string> = {
              gemini: '#3b82f6',
              groq: '#a855f7',
              openai: '#10b981',
              anthropic: '#22c55e',
              nvidia: '#f59e0b',
              openrouter: '#6366f1',
              suno: '#ec4899',
            };
            const color = providerColors[provider] || '#06b6d4';
            console.log(`%c🧹 WIESŁAW: Wyczulem aromat ${provider.toUpperCase()}! Panie Arku, pieczatka gotowa!`, `color: ${color}; font-weight: bold; font-size: 12px;`);
            wieslawLog(`Znalazłem klucz ${name}! Dodaję do Kibla.`);
            foundKeys++;
            stored = true;
            break;
          }
        }
      }

      // 🔍 FALLBACK: Użyj detectKeyProvider() - "wzrok" Kibla!
      if (!stored && trimmed.length > 15) {
        const detection = detectKeyProvider(trimmed);
        if (detection.isValid) {
          console.log("🟣 Kibel rozpoznał wzrokiem:", detection);
          wieslawLog(`Widzę! ${detection.provider.toUpperCase()} (${detection.format})`);

          storeKey({
            id: crypto.randomUUID(),
            name: `${detection.provider.toUpperCase()} Key (rozpoznany)`,
            provider: detection.provider as any,
            value: trimmed,
            createdAt: Date.now(),
            lastUsed: Date.now(),
          });

          foundKeys++;
        }
      }
    }

    if (foundKeys > 0) {
      jadziaLog(`Przyjęto ${foundKeys} kluczy. *pieczątka*`);
      refreshKeys(); // To też zaktualizuje systemReady i keyActive
    } else {
      jadziaLog('Nie rozpoznaję żadnego klucza. A gdzie kwit?');
      // Zarejestruj zator - brak rozpoznanych kluczy
      registerZator('Brak rozpoznanych kluczy API w strumieniu wejściowym');
    }

    setIsProcessing(false);
  };

  // ====== DRAG & DROP - naprawione ======
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    wieslawLog('Widzę plik! Powoli, zaraz łapię...');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    wieslawLog('Łapię ten plik! Czytam jako tekst...');

    // Pobierz pliki
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      try {
        // Czytaj jako TEXT (nie binary!)
        const content = await file.text();

        wieslawLog(`Przeczytałem ${file.name}: ${content.length} znaków`);

        // Parsuj zawartość
        await parseAndStoreKeys(content);

      } catch (err) {
        jadziaLog(`Błąd czytania: ${file.name}. Wiesiek, co namąciłeś?`);
        console.error('[Kibel] Drop error:', err);
      }
    }
  };

  // Odtwórz hymn "The Flush"
  const playFlushHymn = () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const createLiquidTone = (freq: number, delay: number, duration: number) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, ctx.currentTime);
        filter.Q.setValueAtTime(5, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
      }, delay);
    };

    createLiquidTone(110, 0, 1.5);
    createLiquidTone(147, 200, 1.5);
    createLiquidTone(165, 400, 1.5);
    createLiquidTone(220, 600, 2);
    createLiquidTone(294, 800, 2);
    createLiquidTone(330, 1000, 2.5);
    createLiquidTone(440, 1200, 3);

    setTimeout(() => {
      const noise = ctx.createOscillator();
      const noiseGain = ctx.createGain();
      noise.type = 'sawtooth';
      noise.frequency.setValueAtTime(80, ctx.currentTime);
      noise.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
      noiseGain.gain.setValueAtTime(0.3, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + 0.5);
    }, 1500);
  };

  const handleFlush = async () => {
    if (isFlushing) return;

    setIsFlushing(true);
    wieslawLog('Panie Arku, rozpoczynam wielkie spłukiwanie!');

    // Odtwórz hymn
    playFlushHymn();

    // Symulacja spłukiwania
    setTimeout(async () => {
      // Negocjacja z Jadzią przez JW Protocol
      jadziaLog('A gdzie kwit? Proszę poczekać w kolejce...');

      const token = await negotiateAccess((msg) => {
        console.log(msg);
        if (msg.includes('WIESŁAW')) {
          setJwLogs(prev => [...prev.slice(-4), msg]);
        } else if (msg.includes('JADZIA')) {
          setJwLogs(prev => [...prev.slice(-4), msg]);
        }
      });

      jadziaLog(`Wniosek o hałas przyjęty! *pieczątka* Token: ${token.substring(0, 15)}...`);

      // 🌀 MECHANIKA ODPUSZCZANIA (Resonancja)
      const chatHistory = useCityMemory.getState().getWnioskiByType('ROZMOWA');
      const messageCount = chatHistory.length / 2; // Dzielimy na 2 (User + Bot)

      if (messageCount >= 4) {
        const gain = Math.min(20, Math.floor(messageCount / 4) * 10);
        addResonance(gain);
        wieslawLog(`Odpuszczono ${messageCount} poziomów myśli. Rezonans wzrósł o ${gain}%!`);
      } else if (messageCount > 0) {
        wieslawLog('Zbyt mały bagaż myśli, by zwiększyć rezonans. Potrzeba więcej głębi (min. 4).');
      }

      // Najpierw wyczyść, POTEM odśwież status
      clearKibel();
      clearHistory('ROZMOWA'); // Wyczyść rozmowę ze Sferą
      refreshKeys(); // To zaktualizuje systemReady=false i keyActive=false

      setIsFlushing(false);
      setShowSuccess(true);

      // Komunikat
      console.log('%c🔐 Twoje Flekimenta, Twój Skarbiec. Koherencja 100%',
        'color: #22d3ee; font-size: 16px; font-weight: bold; text-shadow: 0 0 10px #22d3ee;');

      wieslawLog('Panie Arku, spłukane, czysto aż lśni!');

      // Wyślij impuls do Wir26 HeartBeat
      registerKibelFlush();
      pulse();

      onFlush?.();

      setTimeout(() => {
        setShowSuccess(false);
        setJwLogs([]);
      }, 4000);
    }, 2500);
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: '24px' }}>🔐</span>
        <h2 style={titleStyle}>TeO-KIBEL</h2>
        <span style={statusStyle}>{keys.length} ZAPACHY</span>
      </div>

      {/* JW Protocol Logs */}
      {jwLogs.length > 0 && (
        <div style={logsContainerStyle}>
          {jwLogs.map((log, i) => (
            <div key={i} style={{
              ...logStyle,
              color: log.includes('WIESŁAW') ? '#f472b6' : '#a855f7',
            }}>
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Misa - Wir 26 z Drag & Drop + Paste */}
      <div
        style={{
          ...bowlContainerStyle,
          borderColor: isDragOver ? '#22d3ee' : 'rgba(34, 211, 238, 0.3)',
          boxShadow: isDragOver
            ? `0 0 ${40 * glowIntensity}px rgba(34, 211, 238, ${0.8 * glowIntensity})`
            : '0 0 20px rgba(34, 211, 238, 0.3)',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div style={dragOverlayStyle}>
            <span style={{ fontSize: '32px' }}>📥</span>
            <span>Upuść .env.local</span>
          </div>
        )}

        {isProcessing && (
          <div style={processingStyle}>
            <span>🔄</span>
            <span>Parsuję...</span>
          </div>
        )}

        {/* Wir 26 */}
        <motion.div
          animate={{ rotate: rotation }}
          style={vortexStyle}
        >
          {/* Kontenery ekspansji */}
          {[...Array(13)].map((_, i) => (
            <div
              key={`exp-${i}`}
              style={{
                ...containerDotStyle,
                transform: `rotate(${i * 27.7}deg) translateY(-65px)`,
                background: `rgba(34, 211, 238, ${0.4 + (isDragOver ? 0.4 : 0)})`,
                boxShadow: `0 0 ${8 * glowIntensity}px rgba(34, 211, 238, ${0.6 * glowIntensity})`,
                width: isDragOver ? '10px' : '6px',
                height: isDragOver ? '10px' : '6px',
              }}
            />
          ))}

          {/* Kontenery kontrakcji */}
          {[...Array(13)].map((_, i) => (
            <div
              key={`cont-${i}`}
              style={{
                ...containerDotStyle,
                transform: `rotate(${i * 27.7 + 180}deg) translateY(-45px)`,
                background: `rgba(168, 85, 247, ${0.4 + (isDragOver ? 0.4 : 0)})`,
                boxShadow: `0 0 ${8 * glowIntensity}px rgba(168, 85, 247, ${0.6 * glowIntensity})`,
                width: isDragOver ? '10px' : '6px',
                height: isDragOver ? '10px' : '6px',
              }}
            />
          ))}

          {/* Środek */}
          <div style={{
            ...centerStyle,
            background: isDragOver
              ? 'radial-gradient(circle, rgba(34, 211, 238, 0.6), transparent)'
              : 'radial-gradient(circle, rgba(34, 211, 238, 0.3), transparent)',
          }}>
            {isFlushing ? '🚿' : showSuccess ? '💎' : isDragOver ? '📥' : isProcessing ? '⚙️' : '🌀'}
          </div>
        </motion.div>

        <div style={{
          ...glowStyle,
          opacity: 0.3 + (isDragOver ? 0.5 : 0),
          transform: `scale(${1 + (isDragOver ? 0.3 : 0)})`,
        }} />
      </div>

      {/* ✅ Status klucza - zamiast pustego pola */}
      {keyActive ? (
        <div style={{
          ...hintStyle,
          color: '#22c55e',
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          padding: '8px 12px',
          borderRadius: '8px',
          marginBottom: '12px',
        }}>
          ✅ Klucz aktywny w rurach
        </div>
      ) : (
        <div style={hintStyle}>
          {/* 🔒 Input z toggle widoczności 👁️ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text && text.length > 5) {
                    wieslawLog(`Wklejam ze schowka! ${text.length} znaków`);
                    await parseAndStoreKeys(text);
                  } else {
                    wieslawLog('Pusty schowek!');
                  }
                } catch (err) {
                  wieslawLog('Nie mogę czytać ze schowka - wklej ręcznie');
                }
              }}
              style={{
                background: 'rgba(34, 211, 238, 0.2)',
                border: '1px solid rgba(34, 211, 238, 0.4)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: '#22d3ee',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              📋 Wklej ze schowka
            </button>
            <span style={{ color: '#64748b', fontSize: '11px' }}>lub upuść plik</span>
          </div>
        </div>
      )}

      {/* Aromatyzer */}
      <div style={aromatsContainerStyle}>
        <span style={aromatsLabelStyle}>ZAPACHY</span>
        <div style={aromatsGridStyle}>
          {AROMATS.map(aromat => {
            const isActive = hasKey(aromat.keyName);
            return (
              <div
                key={aromat.id}
                style={{
                  ...aromatStyle,
                  borderColor: isActive ? aromat.color : 'rgba(255,255,255,0.1)',
                  boxShadow: isActive ? `0 0 15px ${aromat.color}50` : 'none',
                  opacity: isActive ? 1 : 0.4,
                }}
                title={aromat.name}
              >
                <span style={{ fontSize: '20px', filter: isActive ? 'none' : 'grayscale(100%)' }}>
                  {aromat.icon}
                </span>
                {isActive && <div style={{ ...activeDotStyle, background: aromat.color }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Przycisk FLUSH */}
      <motion.button
        onClick={handleFlush}
        disabled={isFlushing}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        title="Twoje Flekimenta, Twój Skarbiec"
        style={{
          ...flushButtonStyle,
          opacity: isFlushing ? 0.5 : 1,
        }}
      >
        {isFlushing ? (
          <>
            <span>🚿</span> SPŁUKUJĘ...
          </>
        ) : showSuccess ? (
          <>
            <span>✅</span> CZYSTO!
          </>
        ) : (
          <>
            <span style={flushIconStyle}>⟳</span> FLUSH
          </>
        )}
      </motion.button>
    </div>
  );
};

// Style
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '28px',
  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(8, 10, 20, 0.98))',
  borderRadius: '24px',
  border: '1px solid rgba(34, 211, 238, 0.3)',
  maxWidth: '420px',
  margin: '20px auto',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  marginBottom: '16px',
  paddingBottom: '16px',
  borderBottom: '1px solid rgba(34, 211, 238, 0.2)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#22d3ee',
  letterSpacing: '4px',
  margin: 0,
  textShadow: '0 0 10px rgba(34, 211, 238, 0.5)',
};

const statusStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#94a3b8',
  padding: '4px 10px',
  background: 'rgba(34, 211, 238, 0.1)',
  borderRadius: '10px',
};

const logsContainerStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: '80px',
  overflow: 'hidden',
  marginBottom: '12px',
  padding: '8px',
  background: 'rgba(0, 0, 0, 0.4)',
  borderRadius: '8px',
  fontSize: '11px',
  fontFamily: 'monospace',
};

const logStyle: React.CSSProperties = {
  padding: '2px 0',
  opacity: 0.9,
};

const bowlContainerStyle: React.CSSProperties = {
  position: 'relative',
  width: '180px',
  height: '180px',
  marginBottom: '12px',
  borderRadius: '50%',
  border: '2px solid rgba(34, 211, 238, 0.3)',
  background: 'radial-gradient(circle, rgba(34, 211, 238, 0.05), transparent 70%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
};

const dragOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'rgba(34, 211, 238, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  color: '#22d3ee',
  fontSize: '12px',
  zIndex: 10,
  backdropFilter: 'blur(4px)',
};

const processingStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'rgba(34, 211, 238, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  color: '#22d3ee',
  fontSize: '11px',
  zIndex: 5,
};

const hintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#64748b',
  marginBottom: '16px',
  textAlign: 'center',
};

const vortexStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const containerDotStyle: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  transition: 'all 0.3s ease',
};

const centerStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '28px',
  transition: 'all 0.3s ease',
};

const glowStyle: React.CSSProperties = {
  position: 'absolute',
  inset: '-30px',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(34, 211, 238, 0.3), transparent 70%)',
  pointerEvents: 'none',
  transition: 'all 0.3s ease',
};

const aromatsContainerStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '20px',
  padding: '16px',
  background: 'rgba(0, 0, 0, 0.3)',
  borderRadius: '12px',
};

const aromatsLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#64748b',
  letterSpacing: '2px',
  marginBottom: '12px',
  textAlign: 'center',
};

const aromatsGridStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '16px',
};

const aromatStyle: React.CSSProperties = {
  position: 'relative',
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'rgba(0, 0, 0, 0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.3s ease',
};

const activeDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-4px',
  right: '-4px',
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  boxShadow: '0 0 8px currentColor',
};

const flushButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px 28px',
  background: `
    linear-gradient(135deg, 
      rgba(255,255,255,0.1) 0%, 
      rgba(255,255,255,0.05) 25%, 
      rgba(255,255,255,0.1) 50%, 
      rgba(255,255,255,0.05) 75%, 
      rgba(255,255,255,0.1) 100%
    )
  `,
  backgroundSize: '200% 200%',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '14px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 700,
  letterSpacing: '3px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
  transition: 'all 0.3s ease',
};

const flushIconStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '18px',
};

export default TeOKibel;
