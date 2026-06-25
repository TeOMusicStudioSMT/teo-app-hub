/**
 * 🏆 CrewCreator.tsx - Klub Mistrzów / Kreator Załogi v2.1
 * * Funkcje:
 * - Edycja Rady Siedmiu (naprawiona)
 * - Auto-Generowanie Agentów przez lokalne AI (Ollama)
 * - Pole Instrukcji/Promptu (Dusza Agenta)
 * - Naprawiony responsywny Scroll
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OtakOSBus, BUS } from '../../lib/otakosBus';
import { generateContent } from '../../services/cloudService';
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
  Zap, Heart, Wand2, Edit3, Bot, Cpu
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import TaskSkinPicker from './TaskSkinPicker';

const CREW_ROLES = [
  { id: 'strażnik', name: 'Strażnik', icon: '🛡️', color: '#22c55e' },
  { id: 'nawigator', name: 'Nawigator', icon: '🧭', color: '#3b82f6' },
  { id: 'alchemik', name: 'Alchemik', icon: '⚗️', color: '#a855f7' },
  { id: 'tancerz', name: 'Tancerz', icon: '💃', color: '#ec4899' },
  { id: 'kronikarz', name: 'Kronikarz', icon: '📜', color: '#eab308' },
  { id: 'szaman', name: 'Szaman', icon: '🔮', color: '#06b6d4' },
];

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'aktywny' | 'oczekujący' | 'uśpiony';
  joinedAt: number;
  emoji: string;
  instructions?: string;
  isEditing?: boolean;
  originalName?: string;
}

interface InkubatorAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  instructions: string;
  trainingLevel: number;
  masteredSkills: string[];
}

export const CrewCreator: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clubName, setClubName] = useState('');

  // Stany dla ręcznego tworzenia
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('strażnik');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');

  // Stany dla AI Generatora
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiProvider, setAiProvider] = useState<'cloud' | 'local'>('cloud');
  const [autoCreate, setAutoCreate] = useState(true);

  // Stany systemowe
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSmoke, setShowSmoke] = useState(false);
  const [smokeAgentId, setSmokeAgentId] = useState<string | null>(null);
  const [isRitualComplete, setIsRitualComplete] = useState(false);
  const [grvPulse, setGrvPulse] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Do odświeżania imion Rady

  // Edycja Rady Siedmiu
  const [editingRadaKey, setEditingRadaKey] = useState<string | null>(null);
  const [editingRadaName, setEditingRadaName] = useState('');

  const EMOJIS = ['🦊', '🐺', '🦅', '🐉', '🦄', '🐙', '🦋', '🌙', '⭐', '🔥', '🌊', '💎', '🗡️', '🛡️', '🎭', '🎪', '💰', '⚖️'];
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [skinId, setSkinId] = useState<string | undefined>(undefined); // 🎴 Skórka specjalizacji

  useEffect(() => {
    const state = useCityMemory.getState();
    const crewWnioski = state.getWnioskiByType('TOZSAMOSC').filter(
      w => w.tags.includes('klub-mistrzów') && w.tags.includes('agent')
    );
    const savedNames = getAllAgentNames();

    if (crewWnioski.length > 0) {
      const loadedAgents: Agent[] = crewWnioski.map(w => {
        const roleMatch = w.description.match(/Rola: (\w+)/);
        const emojiMatch = w.description.match(/Emoji: (\S+)/);
        const instrMatch = w.description.match(/Dusza: (.*)/);
        const nameFromTitle = w.title.replace('Agent: ', '');

        const agentKey = Object.keys(savedNames).find(
          key => savedNames[key as keyof AgentNames] === nameFromTitle
        );
        const displayName = agentKey ? savedNames[agentKey as keyof AgentNames] : nameFromTitle;

        return {
          id: w.id,
          name: displayName,
          role: roleMatch ? roleMatch[1] : 'strażnik',
          status: w.status === 'COMPLETED' ? 'aktywny' : 'oczekujący',
          joinedAt: w.timestamp,
          emoji: emojiMatch ? emojiMatch[1] : '⭐',
          instructions: instrMatch ? instrMatch[1] : '',
        };
      });
      setAgents(loadedAgents);

      const clubWniosek = state.getWnioskiByType('TOZSAMOSC').find(
        w => w.tags.includes('klub-mistrzów') && w.tags.includes('nazwa-klubu')
      );
      if (clubWniosek) setClubName(clubWniosek.title.replace('Klub: ', ''));
    }
  }, []);

  const triggerSmokeEffect = (agentId: string) => {
    setSmokeAgentId(agentId);
    setShowSmoke(true);
    setTimeout(() => { setShowSmoke(false); setSmokeAgentId(null); }, 2000);
  };

  // ─── EDYCJA RADY SIEDMIU ──────────────────────────────────────────────────
  const handleRadaEditStart = (key: string, idx: number) => {
    const currentName = getAgentName(`agent_name_${idx + 1}` as keyof AgentNames);
    setEditingRadaKey(key);
    setEditingRadaName(currentName);
  };

  const handleRadaEditSave = (idx: number) => {
    if (editingRadaName.trim()) {
      const agentKey = `agent_name_${idx + 1}` as keyof AgentNames;
      setAgentName(agentKey, editingRadaName.trim());
      setRefreshTrigger(prev => prev + 1);
      triggerSmokeEffect(`rada-${idx}`);
    }
    setEditingRadaKey(null);
  };

  // ─── AI GENERATOR ────────────────────────────────────────────────────────
  const generateAgentWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    const promptText = `Jesteś Kreatorem Agentów w Katedrze OtakOS. Użytkownik prosi o: "${aiPrompt}".
Wygeneruj profil agenta. Zwróć TYLKO czysty obiekt JSON (bez markdown, bez tekstu przed/po):
{"name": "Imię", "role": "strażnik|nawigator|alchemik|tancerz|kronikarz|szaman", "emoji": "jedno emoji", "instructions": "System prompt po polsku (max 3 zdania)"}`;

    try {
        let rawText = '';

        if (aiProvider === 'cloud') {
            // ── CHMURA (Gemini / Claude / Groq) ─────────────────────────────
            rawText = await generateContent(promptText, 'active');
        } else {
            // ── LOKALNIE via Wiesio Bridge (EXEC_OLLAMA_CLI) ─────────────────
            const activeModel = localStorage.getItem('otakos_active_model') || 'gemma3:4b';
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'EXEC_OLLAMA_CLI',
                    payload: { model: activeModel, prompt: promptText, timeout: 60000 }
                })
            });
            if (!res.ok) throw new Error('Wiesio Bridge nie odpowiada (port 3001)');
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Ollama zwróciła błąd');
            rawText = data.response;
        }

        // Wyciągnij JSON z odpowiedzi
        const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error('Brak JSON w odpowiedzi AI');
        const aiResult = JSON.parse(jsonMatch[0]);

        if (aiResult.name) setNewAgentName(aiResult.name);
        if (aiResult.role) {
            const validRole = CREW_ROLES.find(r => r.id.toLowerCase() === aiResult.role.toLowerCase());
            setNewAgentRole(validRole ? validRole.id : 'strażnik');
        }
        if (aiResult.emoji) setSelectedEmoji(aiResult.emoji);
        if (aiResult.instructions) setNewAgentInstructions(aiResult.instructions);

        toast.success(`🧠 Profil wygenerowany przez ${aiProvider === 'cloud' ? 'Chmurę ☁️' : 'Ollama 🏠'}!`);
        triggerSmokeEffect('ai-gen');

        // Auto-utwórz agenta jeśli opcja włączona
        if (autoCreate && aiResult.name) {
            const autoAgent: Agent = {
                id: `AG-${Date.now()}`,
                name: aiResult.name,
                role: (() => { const v = CREW_ROLES.find(r => r.id.toLowerCase() === (aiResult.role || '').toLowerCase()); return v ? v.id : 'strażnik'; })(),
                status: 'aktywny',
                joinedAt: Date.now(),
                emoji: aiResult.emoji || '⭐',
                instructions: aiResult.instructions || '',
            };
            setAgents(prev => [...prev, autoAgent]);
            OtakOSBus.emit('crew', BUS.CREW_AGENT, { name: autoAgent.name, role: autoAgent.role, emoji: autoAgent.emoji });
            triggerSmokeEffect(autoAgent.id);
            toast.success(`✅ Agent "${autoAgent.name}" dodany! Kliknij 🎓 by wysłać do Inkubatora.`, { duration: 4000 });
            setAiPrompt('');
        }
    } catch (err) {
        console.error(err);
        toast.error("⚠️ " + (err instanceof Error ? err.message : 'Błąd generowania'));
    }
    setIsGenerating(false);
  };

  // ─── OBSŁUGA LISTY ────────────────────────────────────────────────────────
  const addAgent = () => {
    if (!newAgentName.trim()) return;
    const newAgent: Agent = {
      id: `AG-${Date.now()}`,
      name: newAgentName.trim(),
      role: newAgentRole,
      status: 'aktywny',
      joinedAt: Date.now(),
      emoji: selectedEmoji,
      instructions: newAgentInstructions.trim()
    };
    setAgents([...agents, newAgent]);
    setNewAgentName('');
    setNewAgentInstructions('');
    setAiPrompt('');
    setSelectedEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    triggerSmokeEffect(newAgent.id);
    // 🚌 Emituj na Bus
    OtakOSBus.emit('crew', BUS.CREW_AGENT, { name: newAgent.name, role: newAgent.role, emoji: newAgent.emoji });
  };

  const removeAgent = (id: string) => setAgents(agents.filter(a => a.id !== id));

  const sendToInkubator = (agent: Agent) => {
    const queue: InkubatorAgent[] = JSON.parse(localStorage.getItem('inkubator_queue') || '[]');
    if (!queue.find(a => a.id === agent.id)) {
      const inkAgent: InkubatorAgent = {
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        role: agent.role,
        instructions: agent.instructions || '',
        trainingLevel: 0,
        masteredSkills: [],
      };
      queue.push(inkAgent);
      localStorage.setItem('inkubator_queue', JSON.stringify(queue));
    }
    OtakOSBus.emit('crew', BUS.CREW_TRAINING_QUEUE, { agentId: agent.id, agentName: agent.name });
    toast.success(`🎓 ${agent.name} wysłany do Inkubatora!`);
  };

  // Edycja w liście
  const startEditing = (agentId: string) => {
    setAgents(agents.map(a => a.id === agentId ? { ...a, isEditing: true, originalName: a.name } : a));
  };
  const finishEditing = (agentId: string, newName: string) => {
    if (!newName.trim()) return;
    setAgents(agents.map(a => a.id === agentId ? { ...a, name: newName.trim(), isEditing: false } : a));
    triggerSmokeEffect(agentId);
  };

  const dispatchAgentToTerminal = () => {
      if (!newAgentName || !newAgentInstructions) {
          toast.error("Najpierw uzupełnij nazwę i duszę (prompt) Agenta!");
          return;
      }
      
      const safeName = newAgentName.replace(/\s+/g, '_').toLowerCase();
      const command = `Skonfiguruj i wykuj dla mnie Agenta w Ollamie. Nazwa: ${safeName}. Rola i dusza: ${newAgentInstructions}. Użyj skilla CREATE_CUSTOM_MODEL.`;
      
      const existingTasks = JSON.parse(localStorage.getItem('otakos_terminal_tasks') || '[]');
      const newTask = {
          id: `agent-${Date.now()}`,
          title: `Wykuj Agenta: ${newAgentName}`,
          command: command
      };
      
      localStorage.setItem('otakos_terminal_tasks', JSON.stringify([newTask, ...existingTasks]));
      window.dispatchEvent(new Event('otakos_new_terminal_task'));
      
      toast.success(`Matryca "${newAgentName}" wysłana do Terminala 0.00G! Kliknij 🎓 by wysłać do Inkubatora.`, { icon: '🔨', duration: 4000 });
      addAgent();
  };

  // ─── RYTUAŁ & ZAPIS ───────────────────────────────────────────────────────
  const handleRitual = () => {
    setIsRitualComplete(true);
    setGrvPulse(true);
    const pulseInterval = setInterval(() => setGrvPulse(p => !p), 500);
    setTimeout(() => { clearInterval(pulseInterval); setGrvPulse(false); }, 3000);
    logWniosek('TOZSAMOSC', `🌟 RYTUAŁ UKOŃCZONY`, `8 MLD GRV!`, { tags: ['rytuał'] });
    // Panel pozostaje otwarty — użytkownik zamknij ręcznie lub wyślij agentów do Inkubatora
  };

  const saveCrew = async () => {
    if (agents.length === 0) return;
    setIsSaving(true);
    try {
      if (clubName.trim()) {
        logWniosek('TOZSAMOSC', `Klub: ${clubName.trim()}`, `Załoga: ${agents.length}`, { tags: ['klub-mistrzów'] });
      }
      agents.forEach((agent, index) => {
        logWniosek('TOZSAMOSC', `Agent: ${agent.name}`,
          `Rola: ${agent.role} | Emoji: ${agent.emoji} | Dusza: ${agent.instructions || 'brak'}`,
          { tags: ['klub-mistrzów', 'agent', `agent_name_${index + 1}`] }
        );
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      // 🚌 Emituj zapis załogi na Bus
      OtakOSBus.emit('crew', BUS.CREW_SAVED, { count: agents.length, club: clubName.trim() });
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
        <div style={agentCountStyle}><Users style={{ width: 16, height: 16 }} /> {agents.length}</div>
      </div>

      {/* Wewnętrzny kontener scrollowany (Naprawa ucinania) */}
      <div style={scrollableContentStyle} className="custom-scrollbar">

        {/* RADA SIEDMIU (Teraz w pełni edytowalna!) */}
        <div style={agentsNamesSectionStyle}>
          <label style={labelStyle}>🏛️ RADA SIEDMIU (kliknij imię aby edytować)</label>
          <div style={agentNamesGridStyle}>
            {Object.keys(RADA_SIEDMIU_ARCHETYPES).map((key, idx) => {
              const archetype = RADA_SIEDMIU_ARCHETYPES[key as keyof typeof RADA_SIEDMIU_ARCHETYPES];
              const name = getAgentName(`agent_name_${idx + 1}` as keyof AgentNames);
              const isEditing = editingRadaKey === key;

              return (
                <div key={key + refreshTrigger} style={{ ...agentNameChipStyle, borderColor: archetype.color }}>
                  <span style={{ fontSize: '14px' }}>{archetype.emoji}</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingRadaName}
                      onChange={e => setEditingRadaName(e.target.value)}
                      onBlur={() => handleRadaEditSave(idx)}
                      onKeyDown={e => e.key === 'Enter' && handleRadaEditSave(idx)}
                      style={radaEditInputStyle}
                    />
                  ) : (
                    <span
                      style={{ fontWeight: 600, color: archetype.color, cursor: 'pointer' }}
                      onClick={() => handleRadaEditStart(key, idx)}
                    >
                      {name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Nazwa klubu */}
        <div style={sectionBoxStyle}>
          <label style={labelStyle}>Nazwa Twojego Klubu</label>
          <input type="text" value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Wpisz nazwę klubu..." style={inputStyle} />
        </div>

        {/* AI GENERATOR (Nowość!) */}
        <div style={{ ...sectionBoxStyle, background: 'rgba(168, 85, 247, 0.05)', borderColor: 'rgba(168, 85, 247, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ ...labelStyle, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
              <Cpu size={12} /> ZEROWY ASYSTENT KREACJI (AI)
            </label>
            {/* Toggle CLOUD / LOCAL */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setAiProvider('cloud')}
                style={{ padding: '3px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: '0.2s', background: aiProvider === 'cloud' ? 'linear-gradient(135deg,#3b82f6,#a855f7)' : 'transparent', color: aiProvider === 'cloud' ? 'white' : '#64748b' }}
              >☁️ CHMURA</button>
              <button
                onClick={() => setAiProvider('local')}
                style={{ padding: '3px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: '0.2s', background: aiProvider === 'local' ? 'rgba(34,197,94,0.3)' : 'transparent', color: aiProvider === 'local' ? '#22c55e' : '#64748b' }}
              >🏠 OLLAMA</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateAgentWithAI()}
              placeholder="np. 'Potrzebuję eksperta od inwestycji krypto w stylu cyberpunk'"
              style={{ ...inputStyle, borderColor: 'rgba(168,85,247,0.3)', flex: 1 }}
            />
            <button
              onClick={generateAgentWithAI} disabled={isGenerating || !aiPrompt.trim()}
              style={{ ...addButtonStyle, background: aiProvider === 'cloud' ? 'linear-gradient(135deg,#3b82f6,#a855f7)' : 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', opacity: isGenerating || !aiPrompt.trim() ? 0.5 : 1 }}
            >
              {isGenerating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Cpu size={18} /></motion.div> : <Bot size={18} />}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>
              {aiProvider === 'cloud' ? '☁️ Gemini/Claude/Groq — szybko i tanio' : '🏠 Ollama przez Wiesio Bridge (port 3001)'}
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 9, color: autoCreate ? '#22c55e' : '#64748b', userSelect: 'none' }}>
              <input type="checkbox" checked={autoCreate} onChange={e => setAutoCreate(e.target.checked)} style={{ accentColor: '#22c55e', width: 11, height: 11 }} />
              🤖 AUTO-UTWÓRZ AGENTA
            </label>
          </div>
        </div>

        {/* 🎴 SKÓRKA SPECJALIZACJI — primuje duszę agenta */}
        <div style={{ ...sectionBoxStyle, borderColor: 'rgba(196,181,253,0.2)' }}>
          <label style={{ ...labelStyle, color: '#c4b5fd' }}>🎴 SKÓRKA SPECJALIZACJI (wlewa duszę w agenta)</label>
          <TaskSkinPicker
            selectedId={skinId}
            allowSell={false}
            onSelect={(s) => {
              setSkinId(s.id);
              setNewAgentInstructions(s.systemPrompt);
              if (s.icon) setSelectedEmoji(s.icon);
              toast.success(`🎴 Skórka „${s.name}" wlana w duszę agenta`);
            }}
          />
        </div>

        {/* Ręczne Dodawanie Agenta */}
        <div style={sectionBoxStyle}>
          <label style={labelStyle}>MANUALNA KREACJA AGENTA</label>
          <div style={addAgentTopStyle}>
            <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="Imię agenta..." style={addAgentInputStyle} />
            <select value={newAgentRole} onChange={e => setNewAgentRole(e.target.value)} style={roleSelectStyle}>
              {CREW_ROLES.map(r => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={emojiPickerStyle}>
              {EMOJIS.slice(0, 10).map(e => (
                <button key={e} onClick={() => setSelectedEmoji(e)} style={{ ...emojiButtonStyle, background: selectedEmoji === e ? 'rgba(251, 191, 36, 0.3)' : 'transparent', borderColor: selectedEmoji === e ? '#fbbf24' : 'rgba(255,255,255,0.1)' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={newAgentInstructions} onChange={e => setNewAgentInstructions(e.target.value)}
            placeholder="Dusza Agenta (System Prompt) - np. 'Jesteś Ted The Trader. Twoją misją jest dbanie o finanse w oparciu o 0.00G...'"
            style={textareaStyle} rows={3}
          />

          <button 
              onClick={dispatchAgentToTerminal}
              className="w-full py-3 bg-amber-500 text-black rounded-xl font-bold tracking-widest hover:bg-amber-400 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 mt-4"
          >
              <Zap size={18} /> ZAAKCEPTUJ MATRYCĘ AGENTA (Wyślij do Kuźni)
          </button>
        </div>

        {/* Lista agentów */}
        <div style={agentsListStyle}>
          <AnimatePresence>
            {agents.map((agent) => (
              <motion.div key={agent.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }}
                style={{ ...agentCardStyle, borderColor: showSmoke && smokeAgentId === agent.id ? '#fbbf24' : 'rgba(255, 255, 255, 0.05)' }}>
                <div style={agentInfoStyle}>
                  <span style={agentEmojiStyle}>{agent.emoji}</span>
                  <div>
                    {agent.isEditing ? (
                      <input autoFocus defaultValue={agent.name} onBlur={e => finishEditing(agent.id, e.target.value)} onKeyDown={e => e.key === 'Enter' && finishEditing(agent.id, e.currentTarget.value)} style={editInputStyle} />
                    ) : (
                      <div style={agentNameContainerStyle}>
                        <div style={agentNameStyle}>{agent.name}</div>
                        <button onClick={() => startEditing(agent.id)} style={editButtonStyle}><Edit3 size={12} /></button>
                      </div>
                    )}
                    <div style={agentRoleStyle}>{CREW_ROLES.find(r => r.id === agent.role)?.icon} {agent.role}</div>
                  </div>
                </div>
                <div style={agentActionsStyle}>
                  <button onClick={() => sendToInkubator(agent)} title="Wyślij na szkolenie" style={trainButtonStyle}>🎓</button>
                  <button onClick={() => removeAgent(agent.id)} style={removeButtonStyle}><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div> {/* Koniec scrollowanego obszaru */}

      {/* Przyciski Akcji (Zawsze na dole) */}
      <div style={stickyFooterStyle}>
        {!isRitualComplete && agents.length > 0 && (
          <motion.button onClick={handleRitual} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ ...ritualButtonStyle, animation: 'pulse 2s infinite' }}>
            <Wand2 size={20} /> <span>🌟 NIECH SIĘ STANIE! 🌟</span>
          </motion.button>
        )}

        <motion.button onClick={saveCrew} disabled={agents.length === 0 || isSaving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ ...saveButtonStyle, opacity: agents.length > 0 && !isSaving ? 1 : 0.5 }}>
          {isSaving ? "ZAPISUJĘ..." : showSuccess ? "ZAPISANE! ✅" : "💾 ZAPISZ ZAŁOGĘ"}
        </motion.button>
      </div>

      {/* Dym globalny */}
      <AnimatePresence>
        {showSmoke && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={globalSmokeStyle}>
            <motion.div animate={{ y: [0, -20, 0], opacity: [0.8, 0] }} transition={{ duration: 2 }} style={smokeCloudStyle}>
              ✨ OSOBOWOŚĆ ZAKOTWICZONA ✨
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.4); border-radius: 10px; }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 10px rgba(251, 191, 36, 0.2); } 50% { box-shadow: 0 0 25px rgba(251, 191, 36, 0.6); } }
      `}</style>
    </div>
  );
};

// ─── STYLIZACJA (Poprawiona) ────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', padding: '24px',
  background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(8, 10, 20, 0.99))',
  borderRadius: '20px', border: '1px solid rgba(251, 191, 36, 0.3)',
  width: '100%', maxWidth: '600px', margin: '0 auto',
  maxHeight: '85vh', // Poprawiona wysokość
  overflowY: 'auto', // Cały panel przewijalny
};

const scrollableContentStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', paddingRight: '8px', marginBottom: '16px'
};

const stickyFooterStyle: React.CSSProperties = {
  marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0
};

const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(251, 191, 36, 0.2)', flexShrink: 0 };
const headerLeftStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px' };
const titleStyle: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#fbbf24', margin: 0, letterSpacing: '2px' };
const subtitleStyle: React.CSSProperties = { fontSize: '11px', color: '#94a3b8', margin: 0 };
const agentCountStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '20px', fontSize: '12px', color: '#fbbf24' };

const sectionBoxStyle: React.CSSProperties = { marginBottom: '16px', padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' };
const agentsNamesSectionStyle: React.CSSProperties = { ...sectionBoxStyle, borderColor: 'rgba(251, 191, 36, 0.1)' };
const agentNamesGridStyle: React.CSSProperties = { display: 'flex', gap: '8px', flexWrap: 'wrap' };
const agentNameChipStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid', transition: 'all 0.3s ease' };
const radaEditInputStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: 'inherit', fontSize: '14px', fontWeight: 600, outline: 'none', borderBottom: '1px dashed #fbbf24', width: '80px' };

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '8px', letterSpacing: '1px', fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: '60px', fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' };

const addAgentTopStyle: React.CSSProperties = { display: 'flex', gap: '8px', marginBottom: '12px' };
const addAgentInputStyle: React.CSSProperties = { ...inputStyle, flex: 2 };
const roleSelectStyle: React.CSSProperties = { ...inputStyle, flex: 1, cursor: 'pointer' };
const addButtonStyle: React.CSSProperties = { padding: '10px 16px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const emojiPickerStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px' };
const emojiButtonStyle: React.CSSProperties = { width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const agentsListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px' };
const agentCardStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '10px', border: '1px solid', transition: 'all 0.3s' };
const agentInfoStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px' };
const agentEmojiStyle: React.CSSProperties = { fontSize: '20px' };
const agentNameContainerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px' };
const agentNameStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#fff' };
const editButtonStyle: React.CSSProperties = { padding: 4, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' };
const editInputStyle: React.CSSProperties = { padding: '2px 6px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24', borderRadius: '4px', color: '#fbbf24', fontSize: '14px', fontWeight: 600, outline: 'none', width: '100px' };
const agentRoleStyle: React.CSSProperties = { fontSize: '11px', color: '#94a3b8', marginTop: 2 };
const agentActionsStyle: React.CSSProperties = { display: 'flex', gap: '8px' };
const trainButtonStyle: React.CSSProperties = { padding: '4px 8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#22c55e', cursor: 'pointer', fontSize: '14px' };
const removeButtonStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' };

const globalSmokeStyle: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, background: 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, transparent 70%)' };
const smokeCloudStyle: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#fbbf24', textShadow: '0 0 20px #fbbf24' };

const ritualButtonStyle: React.CSSProperties = { width: '100%', padding: '16px', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))', border: '1px solid rgba(251, 191, 36, 0.5)', borderRadius: '12px', color: '#fbbf24', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' };
const saveButtonStyle: React.CSSProperties = { width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#94a3b8', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

export default CrewCreator;