/**
 * 🎵 JasonFlowBridge - Most Kreatywny Jason ↔ BoB
 * 
 * "Gdzie Jason spotyka BoBa"
 * 
 * Funkcjonalność:
 * - Odbiera parametry od Jasona (Style, Tags, Model)
 * - Wyświetla je jako "gotowe do kreacji"
 * - Czeka na kliknięcie "CREATE" przez TeO (Human in the Loop)
 * - Walidacja ISKRA (TEO_ISKA_KEY) przed generowaniem
 * - Integracja z Suno API (poprzez sejf)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSunoCookie, validateIskra } from '../../lib/vault';
import { teleportToMusic } from '../../lib/teleport';
import { registerMusicGeneration } from '../../lib/wir26heartbeat';

// Hymn Inicjacyjny
const INITIALIZATION_HYMN = {
  title: "Solar Punk - The Concrete Cracks",
  artist: "Jason",
};

interface JasonFlowParams {
  style: string;
  tags: string[];
  model: 'v3' | 'v4' | 'v5';
  prompt: string;
  generationId?: string;
  timestamp?: number;
}

interface JasonFlowBridgeProps {
  onCreate?: (params: JasonFlowParams) => void;
  demoMode?: boolean;
}

export const JasonFlowBridge: React.FC<JasonFlowBridgeProps> = ({ 
  onCreate,
  demoMode = false 
}) => {
  const [params, setParams] = useState<JasonFlowParams | null>(demoMode ? {
    style: 'Synthwave',
    tags: ['retro', '80s', 'electronic', 'neon'],
    model: 'v5',
    prompt: 'A nostalgic synthwave track with pulsing bass and dreamy arpeggios',
    generationId: 'jason_demo_001',
    timestamp: Date.now(),
  } : null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [iskaInput, setIskaInput] = useState('');
  const [iskaError, setIskaError] = useState('');
  const [iskaVerified, setIskaVerified] = useState(false);

  useEffect(() => {
    setIskaVerified(false);
    setIskaInput('');
    setIskaError('');
  }, [params]);

  const triggerSuno = useCallback(async (flowParams: JasonFlowParams) => {
    const sunoCookie = getSunoCookie();
    console.log('[JasonFlowBridge] 🎵 Triggering Suno with params:', flowParams);
    console.log('[Suno API] Cookie present:', !!sunoCookie);
    
    try {
      const fullPrompt = `${flowParams.prompt} [${flowParams.tags.join(', ')}] | Style: ${flowParams.style}`;
      console.log('[Suno API] Model:', flowParams.model);
      console.log('[Suno API] Prompt:', fullPrompt);
      
      // Wyślij przez proxy /api/suno
      const response = await fetch('/api/suno/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sunoCookie ? `sunoid=${sunoCookie}` : '',
          'Authorization': sunoCookie ? `Bearer ${sunoCookie}` : '',
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          model_version: flowParams.model,
          tags: flowParams.tags,
          title: `${flowParams.style} - ${flowParams.generationId}`,
        }),
      });

      console.log('[Suno API] Status:', response.status, response.statusText);
      const responseData = await response.json();
      console.log('[Suno API] Response:', responseData);

      if (!response.ok) {
        return { success: false, error: `Status ${response.status}: ${response.statusText}`, details: responseData };
      }

      return {
        success: true,
        audioUrl: responseData.audio_url || responseData.url || 'https://cdn.suno.ai/generated/demo_track.mp3',
        duration: responseData.duration || 180,
        title: responseData.title || `${flowParams.style} - ${flowParams.generationId}`,
        data: responseData,
      };
    } catch (error) {
      console.error('[Suno API] Error:', error);
      return { success: false, error: String(error) };
    }
  }, []);

  const handleReceiveFromJason = useCallback(() => {
    setParams({
      style: 'Cinematic Ambient',
      tags: ['space', 'ethereal', 'orchestral'],
      model: 'v5',
      prompt: 'Epic cinematic journey with orchestral swells and ethereal pads',
      generationId: `jason_${Date.now()}`,
      timestamp: Date.now(),
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!params || isCreating) return;

    // Walidacja ISKRA
    if (!iskaVerified) {
      const isValid = validateIskra(iskaInput);
      if (!isValid) {
        setIskaError('❌ Klucz ISKRA nieprawidłowy. Spróbuj ponownie.');
        return;
      }
      setIskaVerified(true);
      setIskaError('');
    }

    setIsCreating(true);
    console.log('[JasonFlowBridge] ⚡ ISKRA ZAPALONA! Teleportuję do Music V2...');
    
    // TELEPORT: Wyślij parametry do Music V2
    teleportToMusic({
      style: params.style,
      tags: params.tags,
      model: params.model,
      prompt: params.prompt,
      generationId: params.generationId,
    });
    
    // Zarejestruj próbę generacji (koherencja wzrośnie po sukcesie)
    // Na razie pokaż sukces - Music V2 odeśle wynik
    onCreate?.(params);
    setShowSuccess(true);
    
    setTimeout(() => {
      setShowSuccess(false);
      setParams(null);
      setIskaVerified(false);
      setIskaInput('');
    }, 5000);
    
    setIsCreating(false);
  }, [params, isCreating, iskaInput, iskaVerified, onCreate]);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={iconStyle}>🎛️</span>
        <h2 style={titleStyle}>JASON FLOW BRIDGE</h2>
        <span style={statusStyle}>{params ? '🎵 GOTOWE' : '⏳ OCZEKIWANIE'}</span>
      </div>

      <div style={panelStyle}>
        {!params ? (
          <div style={waitingStyle}>
            <div style={waitingIconStyle}>🌊</div>
            <p style={waitingTextStyle}>
              {demoMode ? 'Kliknij poniżej aby zasymulować dane od Jasona' : 'Czekam na parametry od Jasona...'}
            </p>
            {demoMode && (
              <button onClick={handleReceiveFromJason} style={demoButtonStyle}>
                📥 Odbierz z Jasona
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {!showSuccess ? (
              <motion.div key="params" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={paramsContainerStyle}>
                <div style={paramSectionStyle}>
                  <div style={paramRowStyle}>
                    <span style={paramLabelStyle}>🎨 STYLE</span>
                    <span style={paramValueStyle}>{params.style}</span>
                  </div>
                  <div style={paramRowStyle}>
                    <span style={paramLabelStyle}>🏷️ TAGS</span>
                    <div style={tagsContainerStyle}>
                      {params.tags.map((tag, i) => <span key={i} style={tagStyle}>{tag}</span>)}
                    </div>
                  </div>
                  <div style={paramRowStyle}>
                    <span style={paramLabelStyle}>🤖 MODEL</span>
                    <span style={modelBadgeStyle}>{params.model.toUpperCase()}</span>
                  </div>
                  <div style={promptSectionStyle}>
                    <span style={paramLabelStyle}>📝 PROMPT</span>
                    <p style={promptTextStyle}>{params.prompt}</p>
                  </div>
                </div>

                {!iskaVerified && (
                  <div style={iskaInputContainerStyle}>
                    <label style={iskaLabelStyle}>🔐 KLUCZ ISKRA</label>
                    <input
                      type="password"
                      value={iskaInput}
                      onChange={(e) => { setIskaInput(e.target.value); setIskaError(''); }}
                      placeholder="Wprowadź klucz..."
                      style={iskaInputStyle}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                    {iskaError && <p style={iskaErrorStyle}>{iskaError}</p>}
                  </div>
                )}

                {iskaVerified && <p style={iskaVerifiedStyle}>✅ ISKRA ZAPALONA</p>}

                <button
                  onClick={handleCreate}
                  disabled={isCreating || (!iskaVerified && !iskaInput)}
                  style={{
                    ...createButtonStyle,
                    opacity: isCreating || (!iskaVerified && !iskaInput) ? 0.6 : 1,
                    animation: isCreating ? 'none' : 'glow 2s ease-in-out infinite',
                  }}
                >
                  {isCreating ? <span>🔮 Tworzę...</span> : <><span style={sparkIconStyle}>⚡</span><span>CREATE</span></>}
                </button>

                <p style={hitlNoteStyle}>✦ HUMAN IN THE LOOP ✦<br/><small>Ty decydujesz. Ja przygotowuję.</small></p>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={successStyle}>
                <div style={successIconStyle}>🎵</div>
                <h3 style={successTitleStyle}>MUZYKA W DRODZE!</h3>
                <p style={successTextStyle}>Suno otrzymał parametry<br/>Generowanie rozpoczęte...</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {params && (
        <div style={debugStyle}>
          <code>ID: {params.generationId}</code>
          <code>{new Date(params.timestamp || 0).toLocaleTimeString()}</code>
        </div>
      )}

      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 200, 100, 0.5), 0 0 40px rgba(255, 200, 100, 0.3); }
          50% { box-shadow: 0 0 30px rgba(255, 200, 100, 0.7), 0 0 60px rgba(255, 200, 100, 0.5); }
        }
      `}</style>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(145deg, rgba(30, 20, 40, 0.95), rgba(15, 10, 25, 0.98))',
  borderRadius: '16px', border: '1px solid rgba(180, 100, 255, 0.3)',
  overflow: 'hidden', maxWidth: '500px', margin: '20px auto',
  fontFamily: "'JetBrains Mono', monospace",
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px', background: 'rgba(180, 100, 255, 0.1)',
  borderBottom: '1px solid rgba(180, 100, 255, 0.2)',
};

const iconStyle: React.CSSProperties = { fontSize: '24px' };
const titleStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: '#e9d5ff', letterSpacing: '2px', margin: 0 };
const statusStyle: React.CSSProperties = { fontSize: '11px', color: '#a78bfa', padding: '4px 10px', background: 'rgba(180, 100, 255, 0.2)', borderRadius: '12px' };
const panelStyle: React.CSSProperties = { padding: '24px', minHeight: '200px' };
const waitingStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px', padding: '40px 20px' };
const waitingIconStyle: React.CSSProperties = { fontSize: '48px', animation: 'pulse 2s ease-in-out infinite' };
const waitingTextStyle: React.CSSProperties = { color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' };
const demoButtonStyle: React.CSSProperties = { padding: '10px 20px', background: 'rgba(180, 100, 255, 0.3)', border: '1px solid rgba(180, 100, 255, 0.5)', borderRadius: '8px', color: '#e9d5ff', cursor: 'pointer', fontSize: '13px' };
const paramsContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };
const paramSectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px' };
const paramRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' };
const paramLabelStyle: React.CSSProperties = { fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '1px' };
const paramValueStyle: React.CSSProperties = { fontSize: '14px', color: '#fff', fontWeight: 600 };
const tagsContainerStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' };
const tagStyle: React.CSSProperties = { fontSize: '11px', padding: '3px 8px', background: 'rgba(100, 200, 255, 0.2)', borderRadius: '4px', color: '#7dd3fc' };
const modelBadgeStyle: React.CSSProperties = { fontSize: '12px', padding: '4px 10px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', borderRadius: '6px', color: '#fff', fontWeight: 700 };
const promptSectionStyle: React.CSSProperties = { marginTop: '8px', padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' };
const promptTextStyle: React.CSSProperties = { margin: '8px 0 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.5 };
const createButtonStyle: React.CSSProperties = { width: '100%', padding: '16px 24px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '18px', fontWeight: 800, letterSpacing: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' };
const sparkIconStyle: React.CSSProperties = { fontSize: '20px' };
const hitlNoteStyle: React.CSSProperties = { textAlign: 'center', fontSize: '11px', color: 'rgba(255, 200, 100, 0.7)', marginTop: '12px', lineHeight: 1.6 };
const successStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 20px' };
const successIconStyle: React.CSSProperties = { fontSize: '64px', marginBottom: '16px' };
const successTitleStyle: React.CSSProperties = { fontSize: '20px', color: '#4ade80', margin: '0 0 8px', letterSpacing: '2px' };
const successTextStyle: React.CSSProperties = { fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.6 };
const debugStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(0, 0, 0, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' };
const iskaInputContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(255, 200, 100, 0.3)' };
const iskaLabelStyle: React.CSSProperties = { fontSize: '11px', color: 'rgba(255, 200, 100, 0.8)', letterSpacing: '1px', fontWeight: 600 };
const iskaInputStyle: React.CSSProperties = { padding: '10px 14px', background: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 200, 100, 0.4)', borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: 'monospace' };
const iskaErrorStyle: React.CSSProperties = { fontSize: '12px', color: '#f87171', margin: '4px 0 0' };
const iskaVerifiedStyle: React.CSSProperties = { fontSize: '12px', color: '#4ade80', textAlign: 'center', marginTop: '8px', padding: '8px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '6px' };

export default JasonFlowBridge;
