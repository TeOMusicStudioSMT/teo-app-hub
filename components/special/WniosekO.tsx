/**
 * 🎯 WniosekO — Uniwersalny Moduł Zapytań
 * 
 * "Punkt wejścia do systemu TeO"
 * 
 * Funkcje:
 * - Uniwersalny formularz wniosków
 * - Filtrowanie przez Panią Jadzię
 * - Przekierowanie do odpowiedniego modułu
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { negotiateAccess } from '../../lib/jwProtocol';
import { registerConsciousnessActivity } from '../../lib/wir26heartbeat';

type WniosekType = 'muzyka' | 'kod' | 'cuda' | 'inne';

interface WniosekOProps {
  onClose?: () => void;
}

export const WniosekO: React.FC<WniosekOProps> = ({ onClose }) => {
  const [wniosek, setWniosek] = useState('');
  const [type, setType] = useState<WniosekType>('inne');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jwLogs, setJwLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{ type: WniosekType; message: string; destination: string } | null>(null);

  const jadziaLog = useCallback((msg: string) => {
    console.log(`[JADZIA]: ${msg}`);
    setJwLogs(prev => [...prev.slice(-3), `[JADZIA]: ${msg}`]);
  }, []);

  // Auto-detekcja typu wniosku
  const detectType = (text: string): WniosekType => {
    const lower = text.toLowerCase();
    
    if (/muzyka|piosenka|utwór|sun[o]|audio|beat|radiosmt|generator/i.test(lower)) {
      return 'muzyka';
    }
    if (/kod|program|funkcja|bug|napraw|implement|api|component|build/i.test(lower)) {
      return 'kod';
    }
    if (/cud|magia|laboratorium|lab|eksperyment|teolab|te[o]/i.test(lower)) {
      return 'cuda';
    }
    return 'inne';
  };

  const handleTypeChange = (newType: WniosekType) => {
    setType(newType);
    const hints: Record<WniosekType, string> = {
      muzyka: '🎵 Generowanie muzyki przez TeO_Music_V2',
      kod: '💻 Implementacja przez BoB',
      cuda: '🔮 TeO_LaB_V.1 - Laboratorium Cudów',
      inne: '📋 Ogólne zapytanie',
    };
    jadziaLog(hints[newType]);
  };

  const handleWniosekChange = (text: string) => {
    setWniosek(text);
    // Auto-detekcja
    const detected = detectType(text);
    if (detected !== type) {
      handleTypeChange(detected);
    }
  };

  const handleSubmit = async () => {
    if (!wniosek.trim() || isSubmitting) return;

    setIsSubmitting(true);
    jadziaLog('Otrzymałam wniosek. Sprawdzam pieczątkę...');

    // Negocjacja z Jadzią
    const token = await negotiateAccess((msg) => {
      console.log(msg);
      if (msg.includes('JADZIA')) {
        setJwLogs(prev => [...prev.slice(-3), msg]);
      }
    });

    // Analiza i przekierowanie
    jadziaLog(`Wniosek przeanalizowany. Typ: ${type}`);
    
    await new Promise(r => setTimeout(r, 500));
    
    const destinations: Record<WniosekType, { destination: string; message: string }> = {
      muzyka: {
        destination: 'TeO_Music_V2',
        message: '🎵 Przekierowuję do generatora muzyki!',
      },
      kod: {
        destination: 'BoB',
        message: '💻 BoB zajmie się implementacją.',
      },
      cuda: {
        destination: 'TeO_LaB_V.1',
        message: '🔮 Cud nadchodzi z Laboratorium!',
      },
      inne: {
        destination: 'Sekretariat',
        message: '📋 Przyjęto do rozpatrzenia.',
      },
    };

    const result = destinations[type];
    jadziaLog(result.message);
    
    setResult({
      type,
      message: result.message,
      destination: result.destination,
    });

    // Rejestracja Aktywności Świadomości w HeartBeat
    registerConsciousnessActivity(`WN_${Date.now()}`, type.toUpperCase());

    setIsSubmitting(false);
  };

  const typeOptions: { value: WniosekType; label: string; icon: string; color: string }[] = [
    { value: 'muzyka', label: 'Muzyka', icon: '🎵', color: '#8b5cf6' },
    { value: 'kod', label: 'Kod', icon: '💻', color: '#22d3ee' },
    { value: 'cuda', label: 'Cuda', icon: '🔮', color: '#f59e0b' },
    { value: 'inne', label: 'Inne', icon: '📋', color: '#64748b' },
  ];

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: '24px' }}>📋</span>
        <h2 style={titleStyle}>WNIOSEK O...</h2>
        <button onClick={onClose} style={closeButtonStyle}>✕</button>
      </div>

      {/* JW Logs */}
      {jwLogs.length > 0 && (
        <div style={logsStyle}>
          {jwLogs.map((log, i) => (
            <div key={i} style={{ ...logItemStyle, color: '#a855f7' }}>{log}</div>
          ))}
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={resultStyle}
          >
            <div style={resultIconStyle}>
              {typeOptions.find(t => t.value === type)?.icon}
            </div>
            <p style={resultTextStyle}>{result.message}</p>
            <p style={resultDestStyle}>→ {result.destination}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      {!result && (
        <>
          {/* Typy wniosków */}
          <div style={typesGridStyle}>
            {typeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleTypeChange(opt.value)}
                style={{
                  ...typeButtonStyle,
                  borderColor: type === opt.value ? opt.color : 'rgba(255,255,255,0.1)',
                  background: type === opt.value ? `${opt.color}20` : 'rgba(0,0,0,0.3)',
                  boxShadow: type === opt.value ? `0 0 15px ${opt.color}40` : 'none',
                }}
              >
                <span style={{ fontSize: '20px' }}>{opt.icon}</span>
                <span style={{ fontSize: '11px', marginTop: '4px' }}>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={wniosek}
            onChange={(e) => handleWniosekChange(e.target.value)}
            placeholder="Opisz czego potrzebujesz..."
            style={textareaStyle}
            rows={4}
          />

          {/* Hint */}
          <p style={hintStyle}>
            💡 {type === 'muzyka' && 'Muzyka → TeO_Music_V2'}
            {type === 'kod' && 'Kod → BoB'}
            {type === 'cuda' && 'Cuda → TeO_LaB_V.1'}
            {type === 'inne' && 'Ogólne → Sekretariat'}
          </p>

          {/* Submit */}
          <motion.button
            onClick={handleSubmit}
            disabled={isSubmitting || !wniosek.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              ...submitButtonStyle,
              opacity: isSubmitting || !wniosek.trim() ? 0.5 : 1,
            }}
          >
            {isSubmitting ? '🔄 Przetwarzam...' : '📨 ZŁÓŻ WNIOSEK'}
          </motion.button>
        </>
      )}
    </div>
  );
};

// Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '24px',
  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(8, 10, 20, 0.99))',
  borderRadius: '20px',
  border: '1px solid rgba(168, 85, 247, 0.3)',
  maxWidth: '400px',
  margin: '0 auto',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#a855f7',
  letterSpacing: '3px',
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  fontSize: '18px',
  cursor: 'pointer',
};

const logsStyle: React.CSSProperties = {
  padding: '8px',
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '8px',
  marginBottom: '12px',
  fontSize: '11px',
  fontFamily: 'monospace',
};

const logItemStyle: React.CSSProperties = {
  padding: '2px 0',
};

const resultStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px',
  background: 'rgba(168, 85, 247, 0.1)',
  borderRadius: '12px',
  border: '1px solid rgba(168, 85, 247, 0.3)',
};

const resultIconStyle: React.CSSProperties = {
  fontSize: '48px',
  marginBottom: '12px',
};

const resultTextStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '16px',
  marginBottom: '8px',
};

const resultDestStyle: React.CSSProperties = {
  color: '#a855f7',
  fontSize: '12px',
  fontFamily: 'monospace',
};

const typesGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '8px',
  marginBottom: '16px',
};

const typeButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '12px 8px',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  background: 'rgba(0,0,0,0.3)',
  color: '#fff',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(168, 85, 247, 0.2)',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '14px',
  resize: 'none',
  marginBottom: '12px',
  fontFamily: 'inherit',
};

const hintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748b',
  textAlign: 'center',
  marginBottom: '16px',
};

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
  border: 'none',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '2px',
  cursor: 'pointer',
  boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
};

export default WniosekO;
