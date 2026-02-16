/**
 * 🎯 CoBotSummoner - Przycisk Powołania Co-Bota
 * 
 * "Nie masz własnego agenta? Powołaj Co-Bota!"
 * 
 * Wywołuje kreator połączenia z OpenClaw
 */

import React, { useState, useEffect } from 'react';

interface CoBotSummonerProps {
  /** Styl przycisku */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Rozmiar */
  size?: 'sm' | 'md' | 'lg';
  /** Callback po wywołaniu */
  onSummon?: () => void;
}

export const CoBotSummoner: React.FC<CoBotSummonerProps> = ({
  variant = 'primary',
  size = 'md',
  onSummon,
}) => {
  const [isSummoning, setIsSummoning] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Nasłuchuj eventu z GravitonProvider
  useEffect(() => {
    const handleSummon = () => {
      setShowWizard(true);
    };
    
    window.addEventListener('TeO:summonCoBot', handleSummon);
    return () => window.removeEventListener('TeO:summonCoBot', handleSummon);
  }, []);

  const handleSummon = () => {
    setIsSummoning(true);
    
    // Emituj event dla systemu
    window.dispatchEvent(new CustomEvent('TeO:summonCoBot', {
      detail: { action: 'start_wizard', timestamp: Date.now() }
    }));

    // Symulacja - w produkcji otworzy kreator OpenClaw
    setTimeout(() => {
      setShowWizard(true);
      setIsSummoning(false);
      onSummon?.();
    }, 500);
  };

  const handleOpenClaw = () => {
    // Otwórz OpenClaw w nowym oknie/ karcie
    window.open('openclaw://connect', '_blank');
  };

  const sizes = {
    sm: { padding: '8px 16px', fontSize: '12px' },
    md: { padding: '12px 24px', fontSize: '14px' },
    lg: { padding: '16px 32px', fontSize: '16px' },
  };

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      border: '1px solid rgba(139, 92, 246, 0.5)',
      color: '#fff',
    },
    secondary: {
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      color: '#a5b4fc',
    },
    ghost: {
      background: 'transparent',
      border: '1px dashed rgba(139, 92, 246, 0.3)',
      color: '#a5b4fc',
    },
  };

  return (
    <>
      <button
        onClick={handleSummon}
        disabled={isSummoning}
        style={{
          ...sizes[size],
          ...variants[variant],
          borderRadius: '8px',
          cursor: isSummoning ? 'wait' : 'pointer',
          fontWeight: 600,
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          opacity: isSummoning ? 0.7 : 1,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span style={{ fontSize: '16px' }}>🦾</span>
        {isSummoning ? 'Powołuję...' : 'Powołaj Co-Bota'}
      </button>

      {/* Wizard Modal */}
      {showWizard && (
        <div style={modalOverlay} onClick={() => setShowWizard(false)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <span style={modalIcon}>🦾</span>
              <h2 style={modalTitle}>Kreator Połączenia Co-Bota</h2>
            </div>

            <div style={modalBody}>
              <p style={modalText}>
                Powiążemy Cię z agentem OpenClaw, który stanie się Twoim 
                osobistym Co-Botem w ekosystemie TeO.
              </p>

              <div style={stepsContainer}>
                <div style={step}>
                  <span style={stepNumber}>1</span>
                  <span style={stepText}>Wybierz typ Co-Bota</span>
                </div>
                <div style={step}>
                  <span style={stepNumber}>2</span>
                  <span style={stepText}>Autoryzuj połączenie</span>
                </div>
                <div style={step}>
                  <span style={stepNumber}>3</span>
                  <span style={stepText}>Zakotwicz w Hubie</span>
                </div>
              </div>

              <button 
                onClick={handleOpenClaw}
                style={connectButton}
              >
                🔗 Otwórz OpenClaw
              </button>

              <button 
                onClick={() => setShowWizard(false)}
                style={cancelButton}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🎨 Style
// ═══════════════════════════════════════════════════════════════

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.8)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalContent: React.CSSProperties = {
  background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
  borderRadius: '16px',
  border: '1px solid rgba(139, 92, 246, 0.3)',
  padding: '32px',
  maxWidth: '450px',
  width: '90%',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
};

const modalHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '24px',
};

const modalIcon: React.CSSProperties = {
  fontSize: '32px',
};

const modalTitle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#e2e8f0',
  margin: 0,
  fontFamily: "'JetBrains Mono', monospace",
};

const modalBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const modalText: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '14px',
  lineHeight: 1.6,
  margin: 0,
};

const stepsContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const step: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  background: 'rgba(255, 255, 255, 0.03)',
  borderRadius: '8px',
};

const stepNumber: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  fontWeight: 700,
};

const stepText: React.CSSProperties = {
  color: '#e2e8f0',
  fontSize: '14px',
};

const connectButton: React.CSSProperties = {
  padding: '14px 24px',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: "'JetBrains Mono', monospace",
};

const cancelButton: React.CSSProperties = {
  padding: '12px',
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#94a3b8',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: "'JetBrains Mono', monospace",
};

export default CoBotSummoner;
