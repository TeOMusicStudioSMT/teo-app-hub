/**
 * 🏆 CrewCreator.tsx - Klub Mistrzów / Kreator Załogi
 * 
 * "Każdy Mistrz potrzebuje swojej Załogi!"
 * 
 * Funkcje v2.0:
 * - Dynamiczne imiona agentów (z CityMemory)
 * - Suwaki do edycji imion
 * - Dymny Efekt przy zmianie osobowości
 * - Przycisk "NIECH SIĘ STANIE" - 8 mld GRV pulsujące w rytm serca
 * 
 * @version 2.0.0
 * @author BoB (Klub Mistrzów)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useCityMemory,
  logWniosek,
  registerConsciousnessActivity,
  getAgentName,
  setAgentName,
  getAllAgentNames,
  AgentNames,
  RADA_SIEDMIU_ARCHETYPES
} from '../../lib/memory/CityMemory';
import {
  Sparkles, Users, Plus, Trash2, Crown, Star, Save, UserCheck,
  Zap, Heart, Wand2, Edit3, Check
} from 'lucide-react';

// Role dla agentów
const CREW_ROLES = [
  { id: 'strażnik', name: 'Strażnik', icon: '🛡️', color: '#22c55e', description: 'Chroni i pilnuje bezpieczeństwa' },
  { id: 'nawigator', name: 'Nawigator', icon: '🧭', color: '#3b82f6', description: 'Wskazuje kierunki i cele' },
  { id: 'alchemik', name: 'Alchemik', icon: '⚗️', color: '#a855f7', description: 'Przetwarza i tworzy nowe' },
  { id: 'tancerz', name: 'Tancerz', icon: '💃', color: '#ec4899', description: 'Porusza się z gracją' },
  { id: 'kronikarz', name: 'Kronikarz', icon: '📜', color: '#eab308', description: 'Zapisuje i dokumentuje' },
  { id: 'szaman', name: 'Szaman', icon: '🔮', color: '#06b6d4', description: 'Łączy światy' },
];

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'aktywny' | 'oczekujący' | 'uśpiony';
  joinedAt: number;
  emoji: string;
  isEditing?: boolean;
  originalName?: string;
}

interface CrewCreatorProps {
  onComplete?: () => void;
}

export const CrewCreator: React.FC<CrewCreatorProps> = ({ onComplete }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('strażnik');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clubName, setClubName] = useState('');
  const [showSmoke, setShowSmoke] = useState(false);
  const [smokeAgentId, setSmokeAgentId] = useState<string | null>(null);
  const [isRitualComplete, setIsRitualComplete] = useState(false);
  const [grvPulse, setGrvPulse] = useState(false);

  // Emoji do wyboru
  const EMOJIS = ['🦊', '🐺', '🦅', '🐉', '🦄', '🐙', '🦋', '🌙', '⭐', '🔥', '🌊', '💎', '🗡️', '🛡️', '🎭', '🎪'];
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);

  // 🔮 Pobierz dynamiczne imiona z CityMemory
  const loadAgentNamesFromMemory = () => {
    const savedNames = getAllAgentNames();
    console.log('[CrewCreator] 🔮 Wczytane imiona agentów:', savedNames);
    return savedNames;
  };

  // Pobierz istniejącą załogę z CityMemory
  useEffect(() => {
    const loadExistingCrew = () => {
      const state = useCityMemory.getState();
      const crewWnioski = state.getWnioskiByType('TOZSAMOSC').filter(
        w => w.tags.includes('klub-mistrzów') && w.tags.includes('agent')
      );

      // Pobierz dynamiczne imiona
      const savedNames = loadAgentNamesFromMemory();

      if (crewWnioski.length > 0) {
        const loadedAgents: Agent[] = crewWnioski.map(w => {
          const roleMatch = w.description.match(/Rola: (\w+)/);
          const emojiMatch = w.description.match(/Emoji: (\S+)/);
          const nameFromTitle = w.title.replace('Agent: ', '');

          // Użyj zapisanego imienia lub domyślnego
          const agentKey = Object.keys(savedNames).find(
            key => savedNames[key as keyof AgentNames] === nameFromTitle ||
              nameFromTitle.toLowerCase().includes(key.replace('agent_name_', ''))
          );
          const displayName = agentKey ? savedNames[agentKey as keyof AgentNames] : nameFromTitle;

          return {
            id: w.id,
            name: displayName,
            role: roleMatch ? roleMatch[1] : 'strażnik',
            status: w.status === 'COMPLETED' ? 'aktywny' : 'oczekujący',
            joinedAt: w.timestamp,
            emoji: emojiMatch ? emojiMatch[1] : '⭐',
          };
        });
        setAgents(loadedAgents);

        // Pobierz nazwę klubu
        const clubWniosek = state.getWnioskiByType('TOZSAMOSC').find(
          w => w.tags.includes('klub-mistrzów') && w.tags.includes('nazwa-klubu')
        );
        if (clubWniosek) {
          setClubName(clubWniosek.title.replace('Klub: ', ''));
        }
      }
    };

    loadExistingCrew();
  }, []);

  // 🔥 Dymny Efekt - wywoływany przy zmianie imienia
  const triggerSmokeEffect = (agentId: string) => {
    setSmokeAgentId(agentId);
    setShowSmoke(true);

    // Zapisz w pamięci Miasta
    logWniosek(
      'TOZSAMOSC',
      `Dymny Efekt: Zakotwiczenie osobowości`,
      `Agent ${agentId} - nowa tożsamość zakotwiczona w Sferze`,
      {
        tags: ['dymny-efekt', 'osobowość', 'inzynieria-świadomości'],
        result: `Osobowość zakotwiczona`,
        traceType: 'IDENTITY_UPDATE',
      }
    );

    setTimeout(() => {
      setShowSmoke(false);
      setSmokeAgentId(null);
    }, 2000);
  };

  // ✏️ Rozpocznij edycję imienia
  const startEditing = (agentId: string) => {
    setAgents(agents.map(a =>
      a.id === agentId
        ? { ...a, isEditing: true, originalName: a.name }
        : a
    ));
  };

  // ✅ Zakończ edycję z Dymnym Efektem
  const finishEditing = (agentId: string, newName: string) => {
    if (!newName.trim()) return;

    setAgents(agents.map(a =>
      a.id === agentId
        ? { ...a, name: newName.trim(), isEditing: false, originalName: undefined }
        : a
    ));

    // Znajdź klucz agenta (agent_name_1, agent_name_2, itp.)
    const agentIndex = agents.findIndex(a => a.id === agentId);
    const agentKey = `agent_name_${agentIndex + 1}` as keyof AgentNames;

    // 🔮 Zapisz nowe imię do CityMemory
    setAgentName(agentKey, newName.trim());

    // 🔥 Wywołaj Dymny Efekt
    triggerSmokeEffect(agentId);
  };

  // Anuluj edycję
  const cancelEditing = (agentId: string) => {
    setAgents(agents.map(a => {
      if (a.id === agentId && a.originalName) {
        return { ...a, name: a.originalName, isEditing: false, originalName: undefined };
      }
      return a;
    }));
  };

  // Dodaj agenta
  const addAgent = () => {
    if (!newAgentName.trim()) return;

    const newAgent: Agent = {
      id: `AG-${Date.now()}`,
      name: newAgentName.trim(),
      role: newAgentRole,
      status: 'aktywny',
      joinedAt: Date.now(),
      emoji: selectedEmoji,
    };

    setAgents([...agents, newAgent]);
    setNewAgentName('');
    setSelectedEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);

    // 🔥 Dymny efekt dla nowego agenta
    triggerSmokeEffect(newAgent.id);
  };

  // Usuń agenta
  const removeAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id));
  };

  // 🌟 Przycisk "NIECH SIĘ STANIE" - 8 mld GRV pulsujące
  const handleRitual = async () => {
    setIsRitualComplete(true);
    setGrvPulse(true);

    // Pulsowanie przez 3 sekundy
    const pulseInterval = setInterval(() => {
      setGrvPulse(prev => !prev);
    }, 500);

    setTimeout(() => {
      clearInterval(pulseInterval);
      setGrvPulse(false);
    }, 3000);

    // Zapisz w pamięci Miasta
    logWniosek(
      'TOZSAMOSC',
      `🌟 RYTUAŁ UKOŃCZONY: Niech się Stanie!`,
      `8 MILIARDÓW GRV ZAPULSOWAŁO W RYTM SERCA MISTRZA!`,
      {
        tags: ['rytuał', 'moc', '8-mld-grv', 'inkarnacja'],
        result: `Moc Przebudzenia: 8,000,000,000 GRV`,
        traceType: 'IDENTITY_UPDATE',
      }
    );

    // Rejestruj w Sferze
    registerConsciousnessActivity({
      type: 'IDENTITY_UPDATE',
      description: `Rytuał Przebudzenia Mistrza ukończony! 8mld GRV pulsują w rytm serca!`,
      operator: getAgentName('agent_name_1'),
      tags: ['rytuał', 'przebudzenie', 'moc'],
    });

    setTimeout(() => {
      onComplete?.();
    }, 4000);
  };

  // Zapisz załogę do CityMemory
  const saveCrew = async () => {
    if (agents.length === 0) return;

    setIsSaving(true);

    try {
      // Zapisz nazwę klubu
      if (clubName.trim()) {
        logWniosek(
          'TOZSAMOSC',
          `Klub: ${clubName.trim()}`,
          `Klub Mistrzów | Załoga: ${agents.length} agentów | Data: ${new Date().toISOString()}`,
          {
            tags: ['klub-mistrzów', 'nazwa-klubu', 'inzynieria-świadomości'],
            result: 'Nazwa klubu zapisana',
            traceType: 'IDENTITY_UPDATE',
          }
        );
      }

      // Zapisz każdego agenta z dynamicznym imieniem
      agents.forEach((agent, index) => {
        const agentKey = `agent_name_${index + 1}` as keyof AgentNames;

        logWniosek(
          'TOZSAMOSC',
          `Agent: ${agent.name}`,
          `Rola: ${agent.role} | Emoji: ${agent.emoji} | Status: ${agent.status} | Klucz: ${agentKey} | Dołączył: ${new Date(agent.joinedAt).toLocaleDateString()}`,
          {
            tags: ['klub-mistrzów', 'agent', 'inzynieria-świadomości', agentKey],
            result: `Pieczątka: LIFE-LONG-MEMORY-${agent.id}`,
            traceType: 'COBOT_CREATED',
          }
        );
      });

      // Zapisz całą załogę jako jeden wpis
      const crewIds = agents.map(a => a.id).join(', ');
      logWniosek(
        'TOZSAMOSC',
        `Załoga: ${clubName || 'Klub Mistrzów'}`,
        `Liczba agentów: ${agents.length} | Lista: ${crewIds}`,
        {
          tags: ['klub-mistrzów', 'załoga', 'inzynieria-świadomości'],
          result: `Załoga zapisana | LIFE-LONG-MEMORY-CREW-${Date.now()}`,
          traceType: 'IDENTITY_UPDATE',
        }
      );

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('[CrewCreator] Błąd zapisu:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <Crown style={{ color: '#fbbf24', width: 28, height: 28 }} />
          <div>
            <h2 style={titleStyle}>🏆 KLUB MISTRZÓW</h2>
            <p style={subtitleStyle}>Zbuduj swoją drużynę Agentów</p>
          </div>
        </div>
        <div style={agentCountStyle}>
          <Users style={{ width: 16, height: 16 }} />
          <span>{agents.length} Agentów</span>
        </div>
      </div>

      {/* 🔮 Dynamiczne imiona agentów - RADA SIEDMIU */}
      <div style={agentsNamesSectionStyle}>
        <label style={labelStyle}>🏛️ RADA SIEDMIU (kliknij imię aby edytować)</label>
        <div style={agentNamesGridStyle}>
          {Object.keys(RADA_SIEDMIU_ARCHETYPES).map((key, idx) => {
            const archetype = RADA_SIEDMIU_ARCHETYPES[key as keyof typeof RADA_SIEDMIU_ARCHETYPES];
            const name = getAgentName(`agent_name_${idx + 1}` as keyof AgentNames);
            const isEditingThis = agents.some(a => a.isEditing);

            return (
              <motion.div
                key={key}
                whileHover={{ scale: 1.05 }}
                style={{
                  ...agentNameChipStyle,
                  opacity: isEditingThis ? 0.5 : 1,
                  borderColor: archetype.color,
                  cursor: 'pointer',
                }}
                title={`${archetype.role}: ${archetype.motto}`}
                onClick={() => {
                  // Tutaj można dodać edycję
                }}
              >
                <span style={{ fontSize: '14px' }}>{archetype.emoji}</span>
                <span style={{ fontWeight: 600, color: archetype.color }}>{name}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Nazwa klubu */}
      <div style={clubNameContainerStyle}>
        <label style={labelStyle}>Nazwa Twojego Klubu</label>
        <input
          type="text"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          placeholder="Wpisz nazwę swojego klubu..."
          style={inputStyle}
        />
      </div>

      {/* Dodawanie agenta */}
      <div style={addAgentContainerStyle}>
        <div style={addAgentTopStyle}>
          <input
            type="text"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addAgent()}
            placeholder="Imię agenta..."
            style={addAgentInputStyle}
          />
          <button
            onClick={addAgent}
            disabled={!newAgentName.trim()}
            style={{
              ...addButtonStyle,
              opacity: newAgentName.trim() ? 1 : 0.5,
            }}
          >
            <Plus style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Wybór roli */}
        <div style={roleSelectContainerStyle}>
          <select
            value={newAgentRole}
            onChange={(e) => setNewAgentRole(e.target.value)}
            style={roleSelectStyle}
          >
            {CREW_ROLES.map(role => (
              <option key={role.id} value={role.id}>
                {role.icon} {role.name}
              </option>
            ))}
          </select>

          {/* Wybór emoji */}
          <div style={emojiPickerStyle}>
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                style={{
                  ...emojiButtonStyle,
                  background: selectedEmoji === emoji ? 'rgba(251, 191, 36, 0.3)' : 'transparent',
                  borderColor: selectedEmoji === emoji ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista agentów - z suwakami do edycji */}
      <div style={agentsListStyle}>
        <AnimatePresence>
          {agents.map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              style={{
                ...agentCardStyle,
                borderColor: showSmoke && smokeAgentId === agent.id ? '#fbbf24' : 'rgba(255, 255, 255, 0.05)',
                boxShadow: showSmoke && smokeAgentId === agent.id
                  ? '0 0 30px rgba(251, 191, 36, 0.5), inset 0 0 20px rgba(251, 191, 36, 0.1)'
                  : 'none',
              }}
            >
              <div style={agentInfoStyle}>
                <span style={agentEmojiStyle}>{agent.emoji}</span>
                <div>
                  {/* Suwak do edycji imienia */}
                  {agent.isEditing ? (
                    <input
                      type="text"
                      defaultValue={agent.name}
                      autoFocus
                      onBlur={(e) => finishEditing(agent.id, (e.target as HTMLInputElement).value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') finishEditing(agent.id, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') cancelEditing(agent.id);
                      }}
                      style={editInputStyle}
                    />
                  ) : (
                    <div style={agentNameContainerStyle}>
                      <div style={agentNameStyle}>{agent.name}</div>
                      <button
                        onClick={() => startEditing(agent.id)}
                        style={editButtonStyle}
                        title="Kliknij aby edytować imię"
                      >
                        <Edit3 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  )}
                  <div style={agentRoleStyle}>
                    {CREW_ROLES.find(r => r.id === agent.role)?.icon}{' '}
                    {CREW_ROLES.find(r => r.id === agent.role)?.name}
                  </div>
                </div>
              </div>

              {/* Dymny Efekt overlay */}
              {showSmoke && smokeAgentId === agent.id && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={smokeOverlayStyle}
                >
                  <div style={smokeTextStyle}>🔥 OSOBOWOŚĆ ZAKOTWICZONA 🔥</div>
                </motion.div>
              )}

              <div style={agentActionsStyle}>
                <div style={{
                  ...statusBadgeStyle,
                  color: agent.status === 'aktywny' ? '#22c55e' : '#64748b',
                  borderColor: agent.status === 'aktywny' ? '#22c55e' : '#64748b',
                }}>
                  {agent.status === 'aktywny' ? <Star style={{ width: 12, height: 12 }} /> : null}
                  {agent.status}
                </div>
                <button
                  onClick={() => removeAgent(agent.id)}
                  style={removeButtonStyle}
                >
                  <Trash2 style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {agents.length === 0 && (
          <div style={emptyStateStyle}>
            <Users style={{ width: 48, height: 48, opacity: 0.3 }} />
            <p>Dodaj pierwszego agenta do swojej załogi!</p>
          </div>
        )}
      </div>

      {/* 🔥 Dymny Efekt globalny */}
      <AnimatePresence>
        {showSmoke && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={globalSmokeStyle}
          >
            <motion.div
              animate={{ y: [0, -20, 0], opacity: [0.8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={smokeCloudStyle}
            >
              ✨ DYMNY EFEKT ✨
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🌟 Przycisk "NIECH SIĘ STANIE" */}
      {!isRitualComplete && agents.length > 0 && (
        <motion.button
          onClick={handleRitual}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            ...ritualButtonStyle,
            animation: 'pulse 2s infinite',
          }}
        >
          <Wand2 style={{ width: 20, height: 20 }} />
          <span>🌟 NIECH SIĘ STANIE! 🌟</span>
          <span style={grvAmountStyle}>8,000,000,000 GRV</span>
        </motion.button>
      )}

      {/* 🌟 Animacja po rytuale */}
      {isRitualComplete && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={ritualCompleteStyle}
        >
          <motion.div
            animate={{
              scale: grvPulse ? 1.2 : 1,
              boxShadow: grvPulse
                ? '0 0 60px rgba(251, 191, 36, 0.8)'
                : '0 0 30px rgba(251, 191, 36, 0.4)',
            }}
            transition={{ duration: 0.5 }}
            style={grvPulseStyle}
          >
            <Zap style={{ width: 48, height: 48, color: '#fbbf24' }} />
            <span style={grvPulseTextStyle}>
              {grvPulse ? '💎 8,000,000,000 GRV 💎' : '🌟 RYTUAŁ UKOŃCZONY 🌟'}
            </span>
            <Heart style={{
              width: 24,
              height: 24,
              color: '#ef4444',
              animation: 'heartbeat 1s infinite'
            }} />
          </motion.div>
          <p style={ritualMessageStyle}>
            Moc Przebudzenia płynie przez Ciebie!
          </p>
        </motion.div>
      )}

      {/* Przycisk zapisu */}
      <motion.button
        onClick={saveCrew}
        disabled={agents.length === 0 || isSaving}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          ...saveButtonStyle,
          opacity: agents.length > 0 && !isSaving ? 1 : 0.5,
        }}
      >
        {isSaving ? (
          <>
            <Sparkles style={{ width: 20, height: 20 }} />
            ZAPISUJĘ...
          </>
        ) : showSuccess ? (
          <>
            <UserCheck style={{ width: 20, height: 20 }} />
            ZAPISANE! ✅
          </>
        ) : (
          <>
            <Save style={{ width: 20, height: 20 }} />
            ZAPISZ ZAŁOGĘ
          </>
        )}
      </motion.button>

      {/* Stopka */}
      <div style={footerStyle}>
        <p style={footerTextStyle}>
          {agents.length > 0
            ? `✨ ${getAgentName('agent_name_1')} czuwa nad swoją załogą!`
            : `🔮 Każdy Mistrz potrzebuje swojej Załogi`}
        </p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.4); }
          50% { box-shadow: 0 0 40px rgba(251, 191, 36, 0.8); }
        }
      `}</style>
    </div>
  );
};

// Style
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '24px',
  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(8, 10, 20, 0.99))',
  borderRadius: '20px',
  border: '1px solid rgba(251, 191, 36, 0.3)',
  maxWidth: '520px',
  margin: '0 auto',
  maxHeight: '85vh',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
  paddingBottom: '16px',
  borderBottom: '1px solid rgba(251, 191, 36, 0.2)',
};

const headerLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#fbbf24',
  margin: 0,
  letterSpacing: '2px',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#94a3b8',
  margin: 0,
};

const agentCountStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  background: 'rgba(251, 191, 36, 0.1)',
  borderRadius: '20px',
  fontSize: '12px',
  color: '#fbbf24',
};

const agentsNamesSectionStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '12px',
  background: 'rgba(0, 0, 0, 0.3)',
  borderRadius: '10px',
  border: '1px solid rgba(251, 191, 36, 0.1)',
};

const agentNamesGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const agentNameChipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 10px',
  background: 'rgba(251, 191, 36, 0.1)',
  borderRadius: '12px',
  fontSize: '12px',
  transition: 'all 0.3s ease',
};

const clubNameContainerStyle: React.CSSProperties = {
  marginBottom: '16px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#64748b',
  marginBottom: '6px',
  letterSpacing: '1px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(251, 191, 36, 0.2)',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
};

const addAgentContainerStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '16px',
  background: 'rgba(0, 0, 0, 0.3)',
  borderRadius: '12px',
};

const addAgentTopStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '12px',
};

const addAgentInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
};

const addButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
  border: 'none',
  borderRadius: '8px',
  color: '#000',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const roleSelectContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const roleSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
};

const emojiPickerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
};

const emojiButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'transparent',
  fontSize: '16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
};

const agentsListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  marginBottom: '16px',
  minHeight: '120px',
  maxHeight: '220px',
};

const agentCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px',
  background: 'rgba(0, 0, 0, 0.3)',
  borderRadius: '10px',
  marginBottom: '8px',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
};

const agentInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const agentEmojiStyle: React.CSSProperties = {
  fontSize: '24px',
};

const agentNameContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const agentNameStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#fff',
};

const editButtonStyle: React.CSSProperties = {
  padding: '4px',
  background: 'transparent',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
};

const editInputStyle: React.CSSProperties = {
  padding: '4px 8px',
  background: 'rgba(251, 191, 36, 0.2)',
  border: '1px solid #fbbf24',
  borderRadius: '4px',
  color: '#fbbf24',
  fontSize: '14px',
  fontWeight: 600,
  outline: 'none',
  width: '120px',
};

const agentRoleStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#94a3b8',
};

const agentActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const statusBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  borderRadius: '12px',
  border: '1px solid',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const removeButtonStyle: React.CSSProperties = {
  padding: '6px',
  background: 'transparent',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// Dymny Efekt Style
const smokeOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(251, 191, 36, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '10px',
};

const smokeTextStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#fbbf24',
  letterSpacing: '1px',
};

const globalSmokeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const smokeCloudStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#fbbf24',
  textShadow: '0 0 20px rgba(251, 191, 36, 0.8)',
};

// Przycisk Rytuału
const ritualButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '18px',
  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.2))',
  border: '2px solid rgba(251, 191, 36, 0.5)',
  borderRadius: '14px',
  color: '#fbbf24',
  fontSize: '16px',
  fontWeight: 700,
  letterSpacing: '2px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  marginBottom: '12px',
  transition: 'all 0.3s ease',
};

const grvAmountStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#f59e0b',
  opacity: 0.8,
};

// Animacja po rytuale
const ritualCompleteStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  marginBottom: '16px',
  padding: '24px',
  background: 'rgba(251, 191, 36, 0.1)',
  borderRadius: '14px',
  border: '1px solid rgba(251, 191, 36, 0.3)',
};

const grvPulseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '20px 30px',
  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))',
  borderRadius: '14px',
  border: '1px solid rgba(251, 191, 36, 0.5)',
  transition: 'all 0.5s ease',
};

const grvPulseTextStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#fbbf24',
  letterSpacing: '1px',
};

const ritualMessageStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#94a3b8',
  textAlign: 'center',
  margin: 0,
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px',
  color: '#64748b',
  fontSize: '13px',
  gap: '12px',
};

const saveButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))',
  border: '1px solid rgba(251, 191, 36, 0.3)',
  borderRadius: '12px',
  color: '#fbbf24',
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '2px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.3s ease',
};

const footerStyle: React.CSSProperties = {
  marginTop: '12px',
  textAlign: 'center',
  paddingTop: '12px',
  borderTop: '1px solid rgba(251, 191, 36, 0.1)',
};

const footerTextStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748b',
  margin: 0,
};

export default CrewCreator;
