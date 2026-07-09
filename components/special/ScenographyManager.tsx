/**
 * 🎭 ScenographyManager — Menedżer Scenografii Katedry
 *
 * Dedykowany panel kontroli wizualnej Orbity:
 *  - Układ (Layout): Pusty / Panele Boczne / Pełny Ekran
 *  - Skóra (Skin): przypisanie konkretnego wizualizatora do lewego / prawego slotu
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtom } from 'jotai';
import { visualizerLayoutAtom, VisualizerType, VisualizerLayout } from '../../store/visualizerStore';

interface ScenographyManagerProps {
  onClose?: () => void;
}

// ─── Presety Układu ───────────────────────────────────────────────────────────

interface LayoutPreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  layout: VisualizerLayout;
  comingSoon?: boolean;
}

const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'EMPTY',
    label: 'Pusty',
    icon: '⬜',
    description: 'Czysta Orbita – żadnych skórek',
    layout: { left: 'PUSTKA', right: 'PUSTKA' },
  },
  {
    id: 'SIDE_PANELS',
    label: 'Panele Boczne',
    icon: '◧◨',
    description: 'Lewa i prawa skórka aktywne',
    layout: { left: 'STORYTELLER', right: 'GRAVITON_GRID' },
  },
  {
    id: 'MATRIX_FULL',
    label: 'Matrix Pełny',
    icon: '🟩',
    description: 'Matrix Rain na obu panelach',
    layout: { left: 'MATRIX_RAIN', right: 'MATRIX_RAIN' },
  },
  {
    id: 'FULLSCREEN',
    label: 'Pełny Ekran',
    icon: '⬛',
    description: 'Tryb pełnoekranowy (wkrótce)',
    layout: { left: 'MATRIX_RAIN', right: 'PUSTKA' },
    comingSoon: true,
  },
];

// ─── Skórki ───────────────────────────────────────────────────────────────────

interface SkinOption {
  value: VisualizerType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const SKINS: SkinOption[] = [
  { value: 'PUSTKA',            label: 'Pustka',       icon: '⬛', color: '#334155', description: 'Brak wizualizatora' },
  { value: 'STORYTELLER',       label: 'Storyteller',  icon: '🐣', color: '#22d3ee', description: 'TeOgochi komentuje na żywo to, co gra' },
  { value: 'QUANTUM_EQUALIZER', label: 'Quantum EQ',   icon: '🌊', color: '#a855f7', description: 'Korektor kwantowy' },
  { value: 'GRAVITON_GRID',     label: 'Graviton Grid',icon: '🔷', color: '#f59e0b', description: 'Wieża Partnerów — węzły i reklamy firm' },
  { value: 'MATRIX_RAIN',       label: 'Matrix Rain',  icon: '🟩', color: '#22c55e', description: 'Cyfrowy deszcz Matrixa' },
  { value: 'PULS',              label: 'Puls Maszyny', icon: '🫀', color: '#ef4444', description: 'Żywe tętno sprzętu: RAM / CPU / VRAM / temperatura' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectActivePreset(layout: VisualizerLayout): string | null {
  for (const p of LAYOUT_PRESETS) {
    if (p.layout.left === layout.left && p.layout.right === layout.right) return p.id;
  }
  return null;
}

// ─── Komponent ────────────────────────────────────────────────────────────────

export const ScenographyManager: React.FC<ScenographyManagerProps> = ({ onClose }) => {
  const [layout, setLayout] = useAtom(visualizerLayoutAtom);
  const [activeTab, setActiveTab] = useState<'layout' | 'skin'>('layout');

  const activePreset = detectActivePreset(layout);

  const applyPreset = (preset: LayoutPreset) => {
    if (preset.comingSoon) return;
    setLayout(preset.layout);
  };

  const setSkin = (slot: 'left' | 'right', skin: VisualizerType) => {
    setLayout(prev => ({ ...prev, [slot]: skin }));
  };

  const getSkinByValue = (v: VisualizerType) => SKINS.find(s => s.value === v);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      style={containerStyle}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>🎭</span>
          <div>
            <h2 style={titleStyle}>SCENOGRAFIA</h2>
            <p style={subtitleStyle}>Konfiguracja Wizualna Katedry</p>
          </div>
        </div>
        <button onClick={onClose} style={closeButtonStyle} aria-label="Zamknij">✕</button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={tabsStyle}>
        {(['layout', 'skin'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...tabButtonStyle,
              borderBottomColor: activeTab === tab ? '#a855f7' : 'transparent',
              color: activeTab === tab ? '#a855f7' : '#64748b',
            }}
          >
            {tab === 'layout' ? '🗺️  UKŁAD' : '🎨  SKÓRY'}
          </button>
        ))}
      </div>

      {/* ── Tab: Układ ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'layout' && (
          <motion.div
            key="layout"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <p style={sectionHintStyle}>Wybierz gotowy preset — określa, które sloty są aktywne.</p>
            {LAYOUT_PRESETS.map(preset => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  disabled={preset.comingSoon}
                  style={{
                    ...presetButtonStyle,
                    borderColor: isActive ? '#a855f7' : 'rgba(255,255,255,0.08)',
                    background: isActive
                      ? 'rgba(168,85,247,0.12)'
                      : preset.comingSoon
                      ? 'rgba(0,0,0,0.1)'
                      : 'rgba(0,0,0,0.3)',
                    opacity: preset.comingSoon ? 0.45 : 1,
                    cursor: preset.comingSoon ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ fontSize: '20px', minWidth: '28px', textAlign: 'center' }}>{preset.icon}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={presetLabelStyle}>
                      {preset.label}
                      {preset.comingSoon && (
                        <span style={comingSoonBadgeStyle}>wkrótce</span>
                      )}
                    </div>
                    <div style={presetDescStyle}>{preset.description}</div>
                  </div>
                  {isActive && <span style={checkStyle}>✓</span>}
                </button>
              );
            })}
          </motion.div>
        )}

        {/* ── Tab: Skóry ─────────────────────────────────────────────────────── */}
        {activeTab === 'skin' && (
          <motion.div
            key="skin"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <p style={sectionHintStyle}>Przypisz skórkę do lewego i prawego slotu Orbity.</p>

            {/* Lewy slot */}
            <div>
              <div style={slotLabelStyle}>
                <span style={{ color: '#22d3ee' }}>◧</span> LEWY SLOT
                <span style={currentSkinBadgeStyle(getSkinByValue(layout.left)?.color)}>
                  {getSkinByValue(layout.left)?.icon} {getSkinByValue(layout.left)?.label}
                </span>
              </div>
              <div style={skinGridStyle}>
                {SKINS.map(skin => (
                  <SkinButton
                    key={skin.value}
                    skin={skin}
                    isActive={layout.left === skin.value}
                    onClick={() => setSkin('left', skin.value)}
                  />
                ))}
              </div>
            </div>

            {/* Prawy slot */}
            <div>
              <div style={slotLabelStyle}>
                <span style={{ color: '#f59e0b' }}>◨</span> PRAWY SLOT
                <span style={currentSkinBadgeStyle(getSkinByValue(layout.right)?.color)}>
                  {getSkinByValue(layout.right)?.icon} {getSkinByValue(layout.right)?.label}
                </span>
              </div>
              <div style={skinGridStyle}>
                {SKINS.map(skin => (
                  <SkinButton
                    key={skin.value}
                    skin={skin}
                    isActive={layout.right === skin.value}
                    onClick={() => setSkin('right', skin.value)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer — aktualny stan ─────────────────────────────────────────── */}
      <div style={footerStyle}>
        <div style={footerRowStyle}>
          <span style={{ color: '#22d3ee', fontSize: '11px' }}>◧ {getSkinByValue(layout.left)?.label}</span>
          <span style={{ color: '#475569', fontSize: '11px' }}>│</span>
          <span style={{ color: '#f59e0b', fontSize: '11px' }}>◨ {getSkinByValue(layout.right)?.label}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── SkinButton sub-komponent ─────────────────────────────────────────────────

const SkinButton: React.FC<{
  skin: SkinOption;
  isActive: boolean;
  onClick: () => void;
}> = ({ skin, isActive, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    title={skin.description}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      padding: '10px 6px',
      border: `1px solid ${isActive ? skin.color : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '10px',
      background: isActive ? `${skin.color}20` : 'rgba(0,0,0,0.35)',
      color: '#fff',
      cursor: 'pointer',
      boxShadow: isActive ? `0 0 14px ${skin.color}55` : 'none',
      transition: 'all 0.2s ease',
    }}
  >
    <span style={{ fontSize: '18px' }}>{skin.icon}</span>
    <span style={{ fontSize: '9px', letterSpacing: '0.5px', color: isActive ? skin.color : '#94a3b8' }}>
      {skin.label}
    </span>
  </motion.button>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '24px',
  background: 'linear-gradient(145deg, rgba(10, 15, 30, 0.99), rgba(5, 8, 18, 0.99))',
  borderRadius: '20px',
  border: '1px solid rgba(168, 85, 247, 0.35)',
  boxShadow: '0 0 40px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
  maxWidth: '420px',
  width: '100%',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 800,
  color: '#a855f7',
  letterSpacing: '4px',
  margin: 0,
  lineHeight: 1,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#475569',
  letterSpacing: '2px',
  margin: '3px 0 0 0',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#64748b',
  fontSize: '14px',
  cursor: 'pointer',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
};

const tabsStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const tabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '2px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const sectionHintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#475569',
  margin: '4px 0 2px',
  lineHeight: 1.5,
};

const presetButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  background: 'rgba(0,0,0,0.3)',
  color: '#fff',
  width: '100%',
  transition: 'all 0.25s ease',
  textAlign: 'left',
};

const presetLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#e2e8f0',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '2px',
};

const presetDescStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#64748b',
  letterSpacing: '0.5px',
};

const comingSoonBadgeStyle: React.CSSProperties = {
  fontSize: '8px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '4px',
  padding: '1px 5px',
  color: '#94a3b8',
  letterSpacing: '1px',
  textTransform: 'uppercase',
};

const checkStyle: React.CSSProperties = {
  color: '#a855f7',
  fontSize: '16px',
  fontWeight: 700,
};

const slotLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '3px',
  color: '#64748b',
  marginBottom: '8px',
};

const currentSkinBadgeStyle = (color?: string): React.CSSProperties => ({
  marginLeft: 'auto',
  fontSize: '10px',
  color: color ?? '#64748b',
  border: `1px solid ${color ? color + '50' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: '6px',
  padding: '1px 6px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

const skinGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: '6px',
};

const footerStyle: React.CSSProperties = {
  paddingTop: '12px',
  borderTop: '1px solid rgba(255,255,255,0.06)',
};

const footerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '12px',
  fontFamily: 'monospace',
};

export default ScenographyManager;
