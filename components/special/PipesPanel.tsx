/**
 * 🔧 Drożność Rur — Panel Kontrolny Wiesława
 * 
 * "Im więcej kluczy, tym rury czystsze"
 * 
 * Funkcje:
 * - Wizualizacja stanu rur (API)
 * - Koherencja systemu
 * - Status kluczy
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { listKeys } from '../../lib/kibel';
import RuryKiblaGame from './RuryKiblaGame';

interface PipeProps {
  isActive: boolean;
  level: number; // 0-1
  index: number;
}

const Pipe: React.FC<PipeProps> = ({ isActive, level, index }) => {
  const pipeColors = [
    { base: '#ef4444', active: '#22c55e' },  // Red → Green
    { base: '#f97316', active: '#22c55e' },
    { base: '#eab308', active: '#22c55e' },
    { base: '#22c55e', active: '#22c55e' },
    { base: '#14b8a6', active: '#22c55e' },
    { base: '#3b82f6', active: '#22c55e' },
  ];
  
  const colors = pipeColors[index % pipeColors.length];
  const color = isActive && level > 0.5 ? colors.active : colors.base;
  
  return (
    <div style={pipeContainerStyle}>
      {/* Rura */}
      <div style={{
        ...pipeStyle,
        background: `linear-gradient(to right, ${color}30, ${color}60, ${color}30)`,
        borderColor: isActive ? color : 'rgba(255,255,255,0.1)',
      }}>
        {/* Wnętrze rury - przepływ */}
        {isActive && (
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{
              ...flowStyle,
              background: `linear-gradient(90deg, transparent, ${color}80, transparent)`,
            }}
          />
        )}
        
        {/* Zawór */}
        <div style={{
          ...valveStyle,
          background: isActive && level > 0.7 ? '#22c55e' : '#64748b',
          boxShadow: isActive && level > 0.7 ? '0 0 10px #22c55e' : 'none',
        }}>
          {isActive ? '●' : '○'}
        </div>
      </div>
      
      {/* Etykieta */}
      <span style={{
        ...labelStyle,
        color: isActive ? color : '#64748b',
      }}>
        {isActive ? 'OTWARTA' : 'ZAMKNIĘTA'}
      </span>
    </div>
  );
};

interface PipesPanelProps {
  onOpenKibel?: () => void;
}

export const PipesPanel: React.FC<PipesPanelProps> = ({ onOpenKibel }) => {
  const [keys, setKeys] = useState<any[]>([]);
  const [coherence, setCoherence] = useState(0);
  const [showGame, setShowGame] = useState(false);   // 🚽 zabawna rura z Arcade
  void onOpenKibel;  // przejście do Kibla usunięte — Rury są teraz WEWNĄTRZ Kibla
  
  // Pobierz klucze
  useEffect(() => {
    const refresh = () => {
      const k = listKeys();
      setKeys(k);
      // Koherencja = % aktywnych rur (maks 6)
      setCoherence(Math.min(1, k.length / 6));
    };
    refresh();
    
    // Odświeżaj co 5 sekund
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Sprawdź które rury są "otwarte"
  const getPipeStatus = (index: number): boolean => {
    const providers = ['gemini', 'suno', 'openai', 'anthropic', 'groq', 'nvidia', 'openrouter'];
    return keys.some(k => k.provider === providers[index]);
  };
  
  // Status tekstowy
  const getStatus = () => {
    if (keys.length === 0) return { text: 'Rury zablokowane', color: '#ef4444' };
    if (keys.length < 3) return { text: 'Rury częściowo otwarte', color: '#eab308' };
    return { text: 'Rury drożne!', color: '#22c55e' };
  };
  
  const status = getStatus();
  
  // Rury (6 sztuk)
  const pipes = [...Array(6)].map((_, i) => ({
    isActive: getPipeStatus(i),
    level: keys.length / 6,
    index: i,
  }));
  
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: '18px' }}>🔧</span>
        <h3 style={titleStyle}>DROŻNOŚĆ RUR</h3>
      </div>
      
      {/* Koherencja */}
      <div style={coherenceContainerStyle}>
        <div style={coherenceLabelStyle}>
          <span>KOHERENCJA</span>
          <span style={{ color: status.color }}>{(coherence * 100).toFixed(0)}%</span>
        </div>
        <div style={coherenceBarBgStyle}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${coherence * 100}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              ...coherenceBarStyle,
              background: `linear-gradient(90deg, #ef4444, #eab308, #22c55e)`,
            }}
          />
        </div>
        <p style={{ ...statusTextStyle, color: status.color }}>{status.text}</p>
      </div>
      
      {/* Rury */}
      <div style={pipesGridStyle}>
        {pipes.map((pipe, i) => (
          <Pipe key={i} {...pipe} />
        ))}
      </div>
      
      {/* Liczba kluczy */}
      <div style={keysCountStyle}>
        <span>Kluczy w Kibel:</span>
        <span style={{ color: status.color }}>{keys.length}</span>
      </div>
      
      {/* 🚽 Zabawna Rura — mini-gra z TeO Arcade (na temat kibla i rur) */}
      <button
        onClick={() => setShowGame(g => !g)}
        style={openKibelButtonStyle}
      >
        {showGame ? '🔧 WRÓĆ DO RUR' : '🚽 ZAGRAJ: RURY KIBLA'}
      </button>

      {showGame && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(244,114,182,0.7)', marginBottom: 6, textAlign: 'center' }}>
            🕹️ TEO ARCADE · FLUSH FRENZY 0.00G
          </div>
          <RuryKiblaGame />
        </div>
      )}
    </div>
  );
};

// Style
const containerStyle: React.CSSProperties = {
  padding: '20px',
  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(8, 10, 20, 0.98))',
  borderRadius: '16px',
  border: '1px solid rgba(244, 114, 182, 0.3)',
  maxWidth: '320px',
  margin: '0 auto',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#f472b6',
  letterSpacing: '2px',
  margin: 0,
};

const coherenceContainerStyle: React.CSSProperties = {
  marginBottom: '20px',
};

const coherenceLabelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  color: '#94a3b8',
  letterSpacing: '1px',
  marginBottom: '6px',
};

const coherenceBarBgStyle: React.CSSProperties = {
  height: '8px',
  background: 'rgba(0,0,0,0.4)',
  borderRadius: '4px',
  overflow: 'hidden',
};

const coherenceBarStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '4px',
};

const statusTextStyle: React.CSSProperties = {
  fontSize: '11px',
  textAlign: 'center',
  marginTop: '6px',
};

const pipesGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginBottom: '16px',
};

const pipeContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const pipeStyle: React.CSSProperties = {
  flex: 1,
  height: '16px',
  borderRadius: '8px',
  border: '1px solid',
  position: 'relative',
  overflow: 'hidden',
};

const flowStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  width: '50%',
};

const valveStyle: React.CSSProperties = {
  position: 'absolute',
  right: '-6px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '8px',
  color: '#fff',
};

const labelStyle: React.CSSProperties = {
  fontSize: '9px',
  letterSpacing: '1px',
  width: '70px',
};

const keysCountStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: '#64748b',
  marginBottom: '12px',
  padding: '8px',
  background: 'rgba(0,0,0,0.2)',
  borderRadius: '6px',
};

const openKibelButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '1px',
  cursor: 'pointer',
  boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)',
};

export default PipesPanel;
