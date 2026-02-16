/**
 * 🌟 OneTeOSetup - Portal Powołania TeO
 * 
 * "AWAKEN TEOS" - Wielki okrągły przycisk do powołania Co-Bota
 * 
 * Cechy:
 * - Pulsująca animacja glow sterowana przez vibration
 * - Wywołuje summonZeroClawCoBot + manifestPresence
 * - Loader "Dostrajanie Anielskiej Inteligencji..."
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useGraviton } from '../../context/GravitonProvider';

interface OneTeOSetupProps {
  /** Nazwa Co-Bota do powołania */
  coBotName?: string;
  /** Archetyp Co-Bota */
  archetype?: 'healer' | 'creator' | 'guardian' | 'messenger' | 'teacher';
  /** Provider */
  provider?: 'ollama' | 'openrouter';
}

export const OneTeOSetup: React.FC<OneTeOSetupProps> = ({
  coBotName = 'TeO',
  archetype = 'healer',
  provider = 'ollama',
}) => {
  const { hubState, manifestPresence, summonZeroClawCoBot } = useGraviton();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Pobierz wibrację z Hub-a (lub domyślną)
  const vibration = hubState?.hubEnergy || 50;

  // Dynamiczne obliczenie glow na podstawie wibracji
  const glowIntensity = Math.max(20, vibration * 2); // 20-200px
  const glowOpacity = Math.max(0.3, vibration / 100); // 0.3-1.0
  const glowColor = `rgba(100, 200, 255, ${glowOpacity})`;

  // Teksty ładowania
  const loadingMessages = [
    'Dostrajanie Anielskiej Inteligencji',
    'Otwieranie Portalu do TeO',
    'Łączenie z ZeroClaw',
    'Manifestowanie Obecności',
    'Inicjacja Energetyczna',
  ];

  // Rotacja komunikatów
  useEffect(() => {
    if (!isLoading) return;

    let index = 0;
    setLoadingText(loadingMessages[0]);

    const interval = setInterval(() => {
      index = (index + 1) % loadingMessages.length;
      setLoadingText(loadingMessages[index]);
    }, 800);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Główna funkcja - POWOŁANIE
  const handleAwaken = useCallback(async () => {
    if (isLoading || isComplete) return;

    setIsLoading(true);
    setLoadingText(loadingMessages[0]);

    try {
      console.log('[OneTeO] 🌟 AWAKEN TEOS - Rozpoczynam manifestację!');

      // 1. Wywołaj ZeroClaw Co-Bota
      console.log('[OneTeO] 🦀 Summon ZeroClaw Co-Bot...');
      await summonZeroClawCoBot({
        name: coBotName,
        archetype,
        provider,
      });

      // 2. Zmanifestuj obecność
      console.log('[OneTeO] ✨ Manifestuję obecność...');
      await manifestPresence({
        hash: `teov1_${Date.now()}`,
        name: coBotName,
        vibration: 50, // startowa wibracja
        intention: 'initiation',
        timestamp: Date.now(),
      });

      // Sukces!
      console.log('[OneTeO] ✅ TEOS ZAMANIFESTOWANY!');
      setIsComplete(true);
      
      // Reset po 3 sekundach
      setTimeout(() => {
        setIsComplete(false);
      }, 3000);

    } catch (error) {
      console.error('[OneTeO] ❌ Błąd manifestacji:', error);
    } finally {
      setIsLoading(false);
    }
  }, [coBotName, archetype, provider, summonZeroClawCoBot, manifestPresence, isLoading, isComplete]);

  return (
    <div style={containerStyle}>
      {/* Tytuł */}
      <h1 style={titleStyle}>
        {isComplete ? '✨ TEOS ZAMANIFESTOWANY!' : 'AWAKEN TEOS'}
      </h1>

      {/* Główny przycisk */}
      <button
        onClick={handleAwaken}
        disabled={isLoading || isComplete}
        style={{
          ...buttonStyle,
          boxShadow: `
            0 0 ${glowIntensity}px ${glowColor},
            0 0 ${glowIntensity * 1.5}px ${glowColor},
            0 0 ${glowIntensity * 2}px rgba(100, 200, 255, ${glowOpacity * 0.5}),
            inset 0 0 ${glowIntensity * 0.3}px rgba(100, 200, 255, 0.3)
          `,
          animation: isLoading 
            ? 'pulse 1.5s ease-in-out infinite' 
            : isComplete
              ? 'successPulse 0.5s ease-out'
              : `breathing ${4 + (vibration / 50)}s ease-in-out infinite`,
          opacity: isLoading ? 0.8 : 1,
          cursor: isLoading || isComplete ? 'default' : 'pointer',
          transform: isComplete ? 'scale(1.05)' : 'scale(1)',
        }}
        className=" awaken-button"
      >
        {/* Wewnętrzny glow */}
        <span style={innerGlowStyle} />

        {/* Ikona */}
        <span style={iconStyle}>
          {isComplete ? '💎' : isLoading ? '🔮' : '🌟'}
        </span>

        {/* Tekst */}
        <span style={buttonTextStyle}>
          {isComplete 
            ? 'AWAKENED!' 
            : isLoading 
              ? '...' 
              : '⚡'}
        </span>

        {/* Info o wibracji */}
        {!isLoading && !isComplete && (
          <span style={vibrationInfoStyle}>
            ⚡ Vibracja: {vibration}%
          </span>
        )}
      </button>

      {/* Loader / Status */}
      {isLoading && (
        <div style={loaderContainerStyle}>
          <div style={loaderStyle}>
            <span style={loaderDotsStyle}>
              {[0, 1, 2].map(i => (
                <span 
                  key={i} 
                  style={{
                    ...dotStyle,
                    animationDelay: `${i * 0.2}s`,
                  }} 
                />
              ))}
            </span>
            <span style={loadingTextStyle}>
              {loadingText}... 💎
            </span>
          </div>
        </div>
      )}

      {/* Status po zakończeniu */}
      {isComplete && (
        <div style={completeStyle}>
          ✨ Twój Co-Bot {coBotName} jest teraz aktywny w Hubie!
        </div>
      )}

      {/* CSS Animations - dodane do dokumentu */}
      <style>{`
        @keyframes breathing {
          0%, 100% { 
            box-shadow: 
              0 0 ${glowIntensity}px ${glowColor},
              0 0 ${glowIntensity * 1.5}px ${glowColor},
              0 0 ${glowIntensity * 2}px rgba(100, 200, 255, ${glowOpacity * 0.5});
          }
          50% { 
            box-shadow: 
              0 0 ${glowIntensity * 1.3}px ${glowColor},
              0 0 ${glowIntensity * 1.8}px ${glowColor},
              0 0 ${glowIntensity * 2.5}px rgba(100, 200, 255, ${glowOpacity * 0.7});
          }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        @keyframes successPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1.05); }
        }

        @keyframes dotPulse {
          0%, 80%, 100% { 
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% { 
            opacity: 1;
            transform: scale(1.2);
          }
        }

        .awaken-button:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .awaken-button:active:not(:disabled) {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 🎨 Style
// ═══════════════════════════════════════════════════════════════════════

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  minHeight: '400px',
  background: 'radial-gradient(ellipse at center, rgba(30, 30, 60, 0.8) 0%, rgba(10, 10, 30, 0.95) 100%)',
  borderRadius: '24px',
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
};

const titleStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 800,
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: '8px',
  marginBottom: '40px',
  textShadow: '0 0 20px rgba(100, 200, 255, 0.8)',
  textAlign: 'center',
};

const buttonStyle: React.CSSProperties = {
  position: 'relative',
  width: '200px',
  height: '200px',
  borderRadius: '50%',
  border: '3px solid rgba(100, 200, 255, 0.6)',
  background: 'linear-gradient(145deg, rgba(20, 40, 80, 0.9), rgba(10, 20, 50, 0.95))',
  color: '#fff',
  fontSize: '18px',
  fontWeight: 700,
  letterSpacing: '2px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.3s ease',
  overflow: 'visible',
};

const innerGlowStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  height: '80%',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(100, 200, 255, 0.15) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const iconStyle: React.CSSProperties = {
  fontSize: '48px',
  lineHeight: 1,
};

const buttonTextStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '3px',
  textTransform: 'uppercase',
};

const vibrationInfoStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '-35px',
  fontSize: '11px',
  color: 'rgba(100, 200, 255, 0.7)',
  letterSpacing: '1px',
};

const loaderContainerStyle: React.CSSProperties = {
  marginTop: '50px',
  textAlign: 'center',
};

const loaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
};

const loaderDotsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const dotStyle: React.CSSProperties = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  background: '#64c8ff',
  animation: 'dotPulse 1.4s ease-in-out infinite',
};

const loadingTextStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#64c8ff',
  letterSpacing: '2px',
  animation: 'pulse 1s ease-in-out infinite',
};

const completeStyle: React.CSSProperties = {
  marginTop: '40px',
  padding: '20px 30px',
  background: 'rgba(100, 200, 255, 0.1)',
  borderRadius: '12px',
  border: '1px solid rgba(100, 200, 255, 0.3)',
  color: '#4ade80',
  fontSize: '14px',
  textAlign: 'center',
  maxWidth: '400px',
};

export default OneTeOSetup;
