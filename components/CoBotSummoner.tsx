/**
 * 🦾 CoBotSummoner - Przycisk Powołania Co-Bota (v2, suwerenny 0.00G)
 *
 * "Nie masz własnego agenta? Powołaj Co-Bota!"
 *
 * Wybierasz Skórkę Zadania (Art/Economic/Tactic/Health/Energotonic/Respond + własne),
 * a Co-Bot jest wykuwany suwerennie w Ollamie przez Terminal 0.00G (skill CREATE_CUSTOM_MODEL)
 * — bez chmury, bez OpenClaw. „Twór" = wystaw+wykonaj, NIE na sprzedaż (na sprzedaż są skórki).
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { TaskSkin } from '../lib/taskSkins';
import TaskSkinPicker from './special/TaskSkinPicker';

interface CoBotSummonerProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onSummon?: () => void;
}

export const CoBotSummoner: React.FC<CoBotSummonerProps> = ({
  variant = 'primary',
  size = 'md',
  onSummon,
}) => {
  const [showWizard, setShowWizard] = useState(false);
  const [skin, setSkin] = useState<TaskSkin | null>(null);
  const [coBotName, setCoBotName] = useState('');

  // Nasłuchuj eventu z GravitonProvider (zewnętrzne wywołanie kreatora)
  useEffect(() => {
    const handleSummon = () => setShowWizard(true);
    window.addEventListener('TeO:summonCoBot', handleSummon);
    return () => window.removeEventListener('TeO:summonCoBot', handleSummon);
  }, []);

  // 🔨 Suwerenne wykucie Co-Bota przez Terminal 0.00G (jak Klub Mistrzów).
  const summon = () => {
    if (!skin) { toast.error('Najpierw wybierz Skórkę Zadania.'); return; }

    const label = coBotName.trim() || skin.name;
    const safe = label.replace(/\s+/g, '_').toLowerCase();
    const command =
      `Skonfiguruj i wykuj dla mnie Co-Bota w Ollamie. ` +
      `Nazwa modelu: cobot_${safe}. Skórka: ${skin.name} ${skin.icon}. ` +
      `Dusza (system prompt): ${skin.systemPrompt} ` +
      `Użyj skilla CREATE_CUSTOM_MODEL i zakotwicz Co-Bota w Hubie.`;

    const tasks = JSON.parse(localStorage.getItem('otakos_terminal_tasks') || '[]');
    tasks.unshift({
      id: `cobot-${Date.now()}`,
      title: `Przywołaj Co-Bota: ${skin.icon} ${label}`,
      command,
    });
    localStorage.setItem('otakos_terminal_tasks', JSON.stringify(tasks));
    window.dispatchEvent(new Event('otakos_new_terminal_task'));

    toast.success(`🦾 Co-Bot „${label}" (${skin.icon} ${skin.name}) wysłany do Kuźni 0.00G!`, { duration: 4000 });
    setShowWizard(false);
    setCoBotName('');
    onSummon?.();
  };

  const sizes = {
    sm: { padding: '8px 16px', fontSize: '12px' },
    md: { padding: '12px 24px', fontSize: '14px' },
    lg: { padding: '16px 32px', fontSize: '16px' },
  };
  const variants = {
    primary: { background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: '1px solid rgba(139, 92, 246, 0.5)', color: '#fff' },
    secondary: { background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc' },
    ghost: { background: 'transparent', border: '1px dashed rgba(139, 92, 246, 0.3)', color: '#a5b4fc' },
  };

  return (
    <>
      <button
        onClick={() => setShowWizard(true)}
        style={{
          ...sizes[size], ...variants[variant],
          borderRadius: '8px', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.5px',
          display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span style={{ fontSize: '16px' }}>🦾</span>
        Powołaj Co-Bota
      </button>

      {showWizard && (
        <div style={modalOverlay} onClick={() => setShowWizard(false)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <span style={modalIcon}>🦾</span>
              <h2 style={modalTitle}>Przywołanie Co-Bota</h2>
            </div>

            <div style={modalBody}>
              <p style={modalText}>
                Wybierz <strong style={{ color: '#c4b5fd' }}>Skórkę Zadania</strong> — to „dusza", którą
                Co-Bot dostanie na start. Zostanie wykuty suwerennie w Ollamie (0.00G), bez chmury.
              </p>

              <TaskSkinPicker selectedId={skin?.id} onSelect={setSkin} />

              {skin && (
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: `1px solid ${skin.color}44` }}>
                  <span style={{ color: skin.color, fontWeight: 700 }}>{skin.icon} {skin.name}</span> — {skin.desc}
                </div>
              )}

              <input
                value={coBotName}
                onChange={e => setCoBotName(e.target.value)}
                placeholder={skin ? `Nazwa Co-Bota (domyślnie: ${skin.name})` : 'Nazwa Co-Bota (opcjonalnie)'}
                style={nameInput}
              />

              <button onClick={summon} disabled={!skin} style={{ ...connectButton, opacity: skin ? 1 : 0.4, cursor: skin ? 'pointer' : 'not-allowed' }}>
                🔨 Wykuj Co-Bota w Kuźni 0.00G
              </button>

              <button onClick={() => setShowWizard(false)} style={cancelButton}>
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════ Style
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 };
const modalContent: React.CSSProperties = { background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '28px', maxWidth: '480px', width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' };
const modalHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' };
const modalIcon: React.CSSProperties = { fontSize: '30px' };
const modalTitle: React.CSSProperties = { fontSize: '19px', fontWeight: 700, color: '#e2e8f0', margin: 0, fontFamily: "'JetBrains Mono', monospace" };
const modalBody: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' };
const modalText: React.CSSProperties = { color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, margin: 0 };
const nameInput: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
const connectButton: React.CSSProperties = { padding: '14px 24px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '15px', fontWeight: 600, transition: 'all 0.2s ease', fontFamily: "'JetBrains Mono', monospace" };
const cancelButton: React.CSSProperties = { padding: '12px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: "'JetBrains Mono', monospace" };

export default CoBotSummoner;
