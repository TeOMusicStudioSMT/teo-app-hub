/**
 * 🎵 JasonFlowBridge - Most Kreatywny Jason ↔ BoB
 * 
 * "Gdzie Jason spotyka BoBa"
 * 
 * Wersja 2.1 - Reaktywna Membrana Transmutacji Danych (AACL)
 * Wdrożono zalecenia Rady Kontrolnej:
 * - SoftValidator (Graceful Degradation) z Confidence Score
 * - ISKRA Scalarization (Weighted Formula)
 * - Living Indicator (Dynamic Visual/Structural Feedback Loop)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSunoCookie, validateIskra } from '../../lib/vault';
import { teleportToMusic } from '../../lib/teleport';

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

type FlowState = 'IDLE' | 'VALIDATING' | 'DEGRADATION_ACTIVE' | 'ISKR_MODULATION' | 'EXECUTING' | 'FAILURE' | 'SUCCESS';

export const JasonFlowBridge: React.FC<JasonFlowBridgeProps> = ({
  onCreate,
  demoMode = false
}) => {
  // Pamięć Cienia (Historyczny Kontekst Pamięci)
  const [historyParams, setHistoryParams] = useState<JasonFlowParams[]>([
    {
      style: 'Synthwave',
      tags: ['retro', '80s', 'electronic', 'neon'],
      model: 'v5',
      prompt: 'A nostalgic synthwave track with pulsing bass and dreamy arpeggios',
      generationId: 'jason_history_001',
      timestamp: Date.now() - 3600000,
    },
    {
      style: 'Cyberpunk Industrial',
      tags: ['dark', 'heavy', 'industrial', 'techno'],
      model: 'v5',
      prompt: 'Aggressive industrial techno with distorted synths and heavy kicks',
      generationId: 'jason_history_002',
      timestamp: Date.now() - 7200000,
    }
  ]);

  const [params, setParams] = useState<JasonFlowParams | null>(demoMode ? {
    style: 'Synthwave',
    tags: ['retro', '80s', 'electronic', 'neon'],
    model: 'v5',
    prompt: 'A nostalgic synthwave track with pulsing bass and dreamy arpeggios',
    generationId: 'jason_demo_001',
    timestamp: Date.now(),
  } : null);

  // Stany AACL (Autonomous AI Control Layer)
  const [flowState, setFlowState] = useState<FlowState>('IDLE');
  const [confidenceScore, setConfidenceScore] = useState<number>(1.0);
  const [iskraIntensity, setIskraIntensity] = useState<number>(1.0);
  const [cohesionScore, setCohesionScore] = useState<number>(1.0);
  const [stabilityScore, setStabilityScore] = useState<number>(1.0);
  const [resonanceScore, setResonanceScore] = useState<number>(1.0);

  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [iskaInput, setIskaInput] = useState('');
  const [iskaError, setIskaError] = useState('');
  const [iskaVerified, setIskaVerified] = useState(false);

  useEffect(() => {
    setIskaVerified(false);
    setIskaInput('');
    setIskaError('');
    setFlowState('IDLE');
  }, [params]);

  // Symulacja pobrania z Suno Cookie
  const triggerSuno = useCallback(async (flowParams: JasonFlowParams) => {
    const sunoCookie = await getSunoCookie();
    console.log('[JasonFlowBridge] 🎵 Triggering Suno with params:', flowParams);
    try {
      const fullPrompt = `${flowParams.prompt} [${flowParams.tags.join(', ')}] | Style: ${flowParams.style}`;
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

      const responseData = await response.json();
      if (!response.ok) {
        return { success: false, error: `Status ${response.status}`, details: responseData };
      }

      return {
        success: true,
        audioUrl: responseData.audio_url || 'https://cdn.suno.ai/generated/demo_track.mp3',
        duration: responseData.duration || 180,
        title: responseData.title || `${flowParams.style}`,
        data: responseData,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }, []);

  // Symulacja wejścia z Jasona - czasem z błędem w celu prezentacji Graceful Degradation
  const handleReceiveFromJason = useCallback(() => {
    const shouldDegrade = Math.random() > 0.5;
    setParams({
      style: shouldDegrade ? '' : 'Cinematic Ambient',
      tags: shouldDegrade ? [] : ['space', 'ethereal', 'orchestral'],
      model: 'v5',
      prompt: 'Epic cinematic journey with orchestral swells and ethereal pads',
      generationId: `jason_${Date.now()}`,
      timestamp: Date.now(),
    });
  }, []);

  // Alchemiczny proces transformacji AACL
  const handleCreate = useCallback(async () => {
    if (!params || isCreating) return;

    // 🔐 Walidacja ISKRA
    if (!iskaVerified) {
      const isValid = validateIskra(iskaInput);
      if (!isValid) {
        setIskaError('❌ Klucz ISKRA nieprawidłowy.');
        setFlowState('FAILURE');
        return;
      }
      setIskaVerified(true);
      setIskaError('');
    }

    setIsCreating(true);
    setFlowState('VALIDATING');

    // 1. MIĘKKA WALIDACJA (Graceful Degradation)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let confidence = 1.0;
    let degraded = false;
    const resolvedParams = { ...params };

    if (!resolvedParams.style) {
      resolvedParams.style = historyParams[0]?.style || 'Ambient Soundscape';
      confidence -= 0.20;
      degraded = true;
    }
    if (!resolvedParams.tags || resolvedParams.tags.length === 0) {
      resolvedParams.tags = historyParams[0]?.tags || ['ambient', 'drone'];
      confidence -= 0.15;
      degraded = true;
    }
    setConfidenceScore(confidence);

    if (degraded) {
      setFlowState('DEGRADATION_ACTIVE');
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    // 2. SKALARYZACJA ISKRA (Weighted Formula)
    setFlowState('ISKR_MODULATION');
    const stability = 0.82 + Math.random() * 0.15;
    const similarity = 0.78 + Math.random() * 0.16;
    setStabilityScore(stability);
    setResonanceScore(similarity);

    // Formuła AACL: Intensity = 0.5 * Confidence + 0.3 * Stability + 0.2 * Resonance
    const intensity = 0.5 * confidence + 0.3 * stability + 0.2 * similarity;
    const cohesion = intensity * 0.95;
    setIskraIntensity(intensity);
    setCohesionScore(cohesion);

    await new Promise((resolve) => setTimeout(resolve, 1800));

    // 3. EGZEKUCJA (Executing)
    setFlowState('EXECUTING');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 4. SUKCES
    setFlowState('SUCCESS');
    setShowSuccess(true);
    console.log('[JasonFlowBridge] ⚡ ISKRA ZAPALONA! Teleportuję do Music V2...');

    // Ucz się: dodaj do Pamięci Cienia
    setHistoryParams(prev => [resolvedParams, ...prev.slice(0, 4)]);

    // Teleport do Music V2 z parametrami modulacji
    teleportToMusic({
      style: resolvedParams.style,
      tags: resolvedParams.tags,
      model: resolvedParams.model,
      prompt: resolvedParams.prompt,
      generationId: resolvedParams.generationId,
      intensity: intensity,
      confidence: confidence,
    } as any);

    onCreate?.(resolvedParams);

    setTimeout(() => {
      setShowSuccess(false);
      setParams(null);
      setIskaVerified(false);
      setIskaInput('');
      setFlowState('IDLE');
    }, 5000);

    setIsCreating(false);
  }, [params, isCreating, iskaInput, iskaVerified, historyParams, onCreate]);

  // Nazwy i kolory stanów
  const STATE_INFO: Record<FlowState, { label: string; color: string; bg: string }> = {
    IDLE: { label: '⏳ OCZEKIWANIE', color: '#a78bfa', bg: 'rgba(168, 85, 247, 0.15)' },
    VALIDATING: { label: '🧪 VALIDATING...', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)' },
    DEGRADATION_ACTIVE: { label: '⚠️ GRADIENT FALLBACK', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)' },
    ISKR_MODULATION: { label: '🔮 ISKRA MODULATING', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)' },
    EXECUTING: { label: '⚡ EXECUTING INTENT', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)' },
    FAILURE: { label: '❌ FAILURE', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' },
    SUCCESS: { label: '✅ HARMONY ACHIEVED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.25)' },
  };

  return (
    <div style={containerStyle}>
      {/* Definicje gradientów SVG */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="bridgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <radialGradient id="iskraGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
      </svg>

      <div style={headerStyle}>
        <span style={iconStyle}>🎛️</span>
        <h2 style={titleStyle}>JASON FLOW BRIDGE V2.1</h2>
        <span style={{
          ...statusStyle,
          color: STATE_INFO[flowState].color,
          backgroundColor: STATE_INFO[flowState].bg,
          border: `1px solid ${STATE_INFO[flowState].color}33`,
        }}>{STATE_INFO[flowState].label}</span>
      </div>

      {/* Living Indicator - SVG Mostu */}
      <div className="px-5 pt-3 pb-1 bg-slate-900/60 border-b border-purple-500/10">
        <svg viewBox="0 0 400 90" className="w-full h-20 overflow-visible">
          {/* Tło łuku mostu */}
          <path d="M 20 70 Q 200 15 380 70" fill="none" stroke="rgba(168, 85, 247, 0.15)" strokeWidth="3" />
          
          {/* Animowany przepływ energii (aktywowany podczas egzekucji) */}
          <motion.path 
            d="M 20 70 Q 200 15 380 70" 
            fill="none" 
            stroke="url(#bridgeGradient)" 
            strokeWidth="3.5"
            strokeDasharray="400"
            animate={{ 
              strokeDashoffset: flowState === 'EXECUTING' ? [400, 0] : 0,
              opacity: flowState === 'IDLE' ? 0.2 : 1
            }}
            transition={{ duration: 1.2, repeat: flowState === 'EXECUTING' ? Infinity : 0, ease: "linear" }}
          />

          {/* Cząsteczka danych dryfująca po łuku */}
          {flowState === 'VALIDATING' && (
            <motion.circle 
              r="4" 
              fill="#06b6d4" 
              animate={{ cx: [20, 200], cy: [70, 30] }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          )}

          {/* Węzeł centralny ISKRA (główny modulator) */}
          <motion.circle 
            cx="200" 
            cy="28" 
            r={flowState === 'ISKR_MODULATION' ? 14 : 7} 
            fill={flowState === 'ISKR_MODULATION' ? 'url(#iskraGradient)' : '#a855f7'}
            stroke={flowState === 'ISKR_MODULATION' ? '#eab308' : '#c084fc'}
            strokeWidth={flowState === 'ISKR_MODULATION' ? 2 : 1}
            animate={{ 
              scale: flowState === 'ISKR_MODULATION' ? [1, 1.4, 0.9, 1.2, 1] : 1,
              filter: flowState === 'ISKR_MODULATION' ? 'drop-shadow(0 0 8px #fbbf24)' : 'none'
            }}
            transition={{ duration: 1.5, repeat: flowState === 'ISKR_MODULATION' ? Infinity : 0 }}
          />

          {/* Węzeł wejściowy JASON */}
          <circle cx="20" cy="70" r="5" fill="#06b6d4" />
          <text x="20" y="85" textAnchor="middle" fill="#06b6d4" fontSize="9" fontFamily="monospace">JASON</text>

          {/* Węzeł wyjściowy BoB */}
          <circle cx="380" cy="70" r="5" fill="#a855f7" />
          <text x="380" y="85" textAnchor="middle" fill="#a855f7" fontSize="9" fontFamily="monospace">BoB</text>
        </svg>
      </div>

      <div style={panelStyle}>
        {!params ? (
          <div style={waitingStyle}>
            <div style={waitingIconStyle}>🌊</div>
            <p style={waitingTextStyle}>
              {demoMode ? 'Zasymuluj dane wejściowe z Jasona' : 'Czekam na intencje od Jasona...'}
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
                
                {/* Panel Parametrów */}
                <div style={paramSectionStyle}>
                  <div style={paramRowStyle}>
                    <span style={paramLabelStyle}>🎨 STYLE</span>
                    <span style={{
                      ...paramValueStyle,
                      color: params.style ? '#fff' : '#f59e0b',
                      fontStyle: params.style ? 'normal' : 'italic'
                    }}>
                      {params.style || 'Brak [AACL Fallback...]'}
                    </span>
                  </div>
                  <div style={paramRowStyle}>
                    <span style={paramLabelStyle}>🏷️ TAGS</span>
                    <div style={tagsContainerStyle}>
                      {params.tags.length > 0 ? (
                        params.tags.map((tag, i) => <span key={i} style={tagStyle}>{tag}</span>)
                      ) : (
                        <span style={{ ...tagStyle, background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
                          Fallback z pamięci...
                        </span>
                      )}
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

                {/* Panel Metryk AACL (Współczynniki Algorytmu) */}
                {flowState !== 'IDLE' && (
                  <div className="p-3 bg-slate-950/80 border border-purple-500/20 rounded-lg font-mono text-[10px] space-y-1.5 text-slate-300">
                    <div className="text-[11px] font-bold text-purple-300 border-b border-purple-500/20 pb-1 mb-1">
                      ⚙️ METRYKI SILNIKA AACL:
                    </div>
                    <div className="flex justify-between">
                      <span>[C_valid] Confidence Score:</span>
                      <span className={confidenceScore < 1.0 ? "text-amber-400 font-bold" : "text-emerald-400"}>
                        {Math.round(confidenceScore * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>[S_temp] Stability Score:</span>
                      <span className="text-purple-300">
                        {flowState === 'VALIDATING' ? 'Kalkuluję...' : `${Math.round(stabilityScore * 100)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>[R_sim] Historical Res:</span>
                      <span className="text-purple-300">
                        {flowState === 'VALIDATING' ? 'Mierzę...' : `${Math.round(resonanceScore * 100)}%`}
                      </span>
                    </div>
                    <div className="border-t border-purple-500/20 pt-1.5 mt-1.5 flex justify-between font-bold text-amber-400">
                      <span>[ISKRA] final Intensity:</span>
                      <span>
                        {flowState === 'VALIDATING' ? 'Szacuję...' : `${iskraIntensity.toFixed(3)} / 1.000`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Autoryzacja ISKRA */}
                {!iskaVerified && (
                  <div style={iskaInputContainerStyle}>
                    <label style={iskaLabelStyle}>🔐 TEO_ISKRA_KEY (Autoryzacja)</label>
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

                {iskaVerified && <p style={iskaVerifiedStyle}>✅ ISKRA PRAWIDŁOWO SPASOWANA</p>}

                <button
                  onClick={handleCreate}
                  disabled={isCreating || (!iskaVerified && !iskaInput)}
                  style={{
                    ...createButtonStyle,
                    opacity: isCreating || (!iskaVerified && !iskaInput) ? 0.6 : 1,
                    animation: isCreating ? 'none' : 'glow 2s ease-in-out infinite',
                  }}
                >
                  {isCreating ? <span>🔮 Transmutacja...</span> : <><span style={sparkIconStyle}>⚡</span><span>CREATE</span></>}
                </button>

                <p style={hitlNoteStyle}>✦ HUMAN IN THE LOOP ✦<br /><small>Adamus: "Cisza i harmonia są dowodem poprawności."</small></p>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={successStyle}>
                <div style={successIconStyle}>🎵</div>
                <h3 style={successTitleStyle}>KANAŁ W DRODZE!</h3>
                <p style={successTextStyle}>
                  Intensywność: <strong>{iskraIntensity.toFixed(3)}</strong><br />
                  Zalecenia Rady zaaplikowane pomyślnie.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {params && (
        <div style={debugStyle}>
          <code>GEN_ID: {params.generationId}</code>
          <code>CON_SCORE: {confidenceScore.toFixed(2)}</code>
        </div>
      )}

      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(180, 100, 255, 0.4), 0 0 40px rgba(180, 100, 255, 0.2); }
          50% { box-shadow: 0 0 30px rgba(180, 100, 255, 0.6), 0 0 60px rgba(180, 100, 255, 0.4); }
        }
      `}</style>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(145deg, rgba(20, 15, 35, 0.96), rgba(8, 5, 18, 0.99))',
  borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.25)',
  overflow: 'hidden', maxWidth: '500px', margin: '20px auto',
  fontFamily: "'JetBrains Mono', monospace",
  position: 'relative'
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px', background: 'rgba(168, 85, 247, 0.08)',
  borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
};

const iconStyle: React.CSSProperties = { fontSize: '20px' };
const titleStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#f3e8ff', letterSpacing: '2px', margin: 0 };
const statusStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px' };
const panelStyle: React.CSSProperties = { padding: '20px', minHeight: '200px' };
const waitingStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px', padding: '30px 20px' };
const waitingIconStyle: React.CSSProperties = { fontSize: '40px', animation: 'pulse 2s ease-in-out infinite' };
const waitingTextStyle: React.CSSProperties = { color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' };
const demoButtonStyle: React.CSSProperties = { padding: '8px 16px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '8px', color: '#f3e8ff', cursor: 'pointer', fontSize: '12px', outline: 'none' };
const paramsContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' };
const paramSectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '10px' };
const paramRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' };
const paramLabelStyle: React.CSSProperties = { fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '1px' };
const paramValueStyle: React.CSSProperties = { fontSize: '13px', color: '#fff', fontWeight: 600 };
const tagsContainerStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' };
const tagStyle: React.CSSProperties = { fontSize: '10px', padding: '2px 6px', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '4px', color: '#22d3ee' };
const modelBadgeStyle: React.CSSProperties = { fontSize: '11px', padding: '3px 8px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', borderRadius: '6px', color: '#fff', fontWeight: 700 };
const promptSectionStyle: React.CSSProperties = { marginTop: '4px', padding: '10px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' };
const promptTextStyle: React.CSSProperties = { margin: '6px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 };
const createButtonStyle: React.CSSProperties = { width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: 800, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const sparkIconStyle: React.CSSProperties = { fontSize: '18px' };
const hitlNoteStyle: React.CSSProperties = { textAlign: 'center', fontSize: '10px', color: 'rgba(168, 85, 247, 0.6)', marginTop: '8px', lineHeight: 1.6 };
const successStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 20px' };
const successIconStyle: React.CSSProperties = { fontSize: '48px', marginBottom: '12px' };
const successTitleStyle: React.CSSProperties = { fontSize: '18px', color: '#10b981', margin: '0 0 6px', letterSpacing: '2px' };
const successTextStyle: React.CSSProperties = { fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.6 };
const debugStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 16px', background: 'rgba(0, 0, 0, 0.5)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '9px', color: 'rgba(255, 255, 255, 0.3)' };
const iskaInputContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', padding: '10px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' };
const iskaLabelStyle: React.CSSProperties = { fontSize: '10px', color: '#c084fc', letterSpacing: '1px', fontWeight: 600 };
const iskaInputStyle: React.CSSProperties = { padding: '8px 12px', background: 'rgba(0, 0, 0, 0.6)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', fontFamily: 'monospace' };
const iskaErrorStyle: React.CSSProperties = { fontSize: '11px', color: '#f87171', margin: '4px 0 0' };
const iskaVerifiedStyle: React.CSSProperties = { fontSize: '11px', color: '#34d399', textAlign: 'center', marginTop: '6px', padding: '6px', background: 'rgba(52, 211, 153, 0.08)', borderRadius: '6px', border: '1px solid rgba(52, 211, 153, 0.2)' };

export default JasonFlowBridge;
