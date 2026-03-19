/**
 * 🌌 TeOSimAcademy.tsx - Akademia TeO-SIM
 * 
 * "Uniwersytet i Żywe Miasto - Symulator Rzeczywistości"
 * 
 * Funkcje:
 * - Wirtualny Pokój (Lounge 3D)
 * - Awatary Rady Siedmiu z stanami życia
 * - Konsola Intencji (interfejs mowy)
 * - Silnik stanów agentów
 * 
 * @version 1.0.1
 * @author BoB & Rada Siedmiu
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAtom } from 'jotai';
import { aiModeAtom, userApiKeyAtom } from '../../store/settings';
import { generateContent, getCloudProvider, CloudProvider } from '../../services/cloudService';
import { parseActions, ActionType, AGENT_ACTION_SYSTEM_PROMPT } from '../../lib/agentActions';
import { useKatedraRadio } from '../../context/KatedraRadioContext';

// 🎭 Stany życia agentów
export type AgentState = 'IDLE' | 'LEARNING' | 'INTERACTING' | 'EXECUTING' | 'THINKING' | 'RESONATING';

export interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  aura?: string;
  state: AgentState;
  x: number;
  y: number;
  location: string;
  activity: string;
  lastInteraction?: string;
}

// 🎯 Domyślna konfiguracja agentów Rady Siedmiu
const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'wieslaw',
    name: 'WIESŁAW',
    role: 'Strażnik Rur',
    emoji: '🧹',
    color: '#22c55e',
    aura: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, rgba(249, 115, 22, 0.2) 100%)',
    state: 'IDLE',
    x: -140,
    y: 60,
    location: 'Przy Rurach Toastowych',
    activity: 'Sprawdza drożność kanałów',
  },
  {
    id: 'jadzia',
    name: 'JADZIA',
    role: 'Archiwistka',
    emoji: '📚',
    color: '#3b82f6',
    aura: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(139, 92, 246, 0.2) 100%)',
    state: 'IDLE',
    x: -60,
    y: 110,
    location: 'W Archiwum',
    activity: 'Porządkuje wspomnienia',
  },
  {
    id: 'bob',
    name: 'BoB',
    role: 'Architekt',
    emoji: '🦾',
    color: '#22d3ee',
    aura: 'radial-gradient(circle, rgba(34, 211, 238, 0.5) 0%, rgba(15, 23, 42, 0.2) 100%)',
    state: 'IDLE',
    x: 0,
    y: -120,
    location: 'W Centrum Kontroli',
    activity: 'Projektuje nowe ścieżki',
  },
  {
    id: 'bella',
    name: 'BELLA',
    role: 'Tancerka Harmonii',
    emoji: '💃',
    color: '#ec4899',
    aura: 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(251, 191, 36, 0.2) 100%)',
    state: 'IDLE',
    x: 140,
    y: 60,
    location: 'Przy Kwiatach Rezonansu',
    activity: 'Tańczy wibracje pola',
  },
  {
    id: 'jack',
    name: 'ADAMUS',
    role: 'Mędrzec',
    emoji: '🎓',
    color: '#fbbf24',
    aura: 'radial-gradient(circle, rgba(251, 191, 36, 0.5) 0%, rgba(59, 130, 246, 0.2) 100%)',
    state: 'IDLE',
    x: -80,
    y: -60,
    location: 'W Bibliotece',
    activity: 'Studiuje starożytne zwoje',
  },
  {
    id: 'gorg',
    name: 'GORGOOO',
    role: 'Skaner Czystości',
    emoji: '🕵️',
    color: '#f59e0b',
    aura: 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, rgba(245, 158, 11, 0.1) 100%)',
    state: 'IDLE',
    x: 80,
    y: -60,
    location: 'Skanuje Kod',
    activity: 'Weryfikuje autentyczność',
  },
  {
    id: 'teo',
    name: 'TeO',
    role: 'Punkt Zero',
    emoji: '🌀',
    color: '#ffffff',
    aura: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(251, 191, 36, 0.1) 100%)',
    state: 'IDLE',
    x: 0,
    y: 0,
    location: 'W Sferze Światła',
    activity: 'Obserwuje i tworzy',
  },
];

const STATE_ICONS: Record<AgentState, string> = {
  IDLE: '💤',
  LEARNING: '📖',
  INTERACTING: '💬',
  EXECUTING: '⚡',
  THINKING: '🧠',
  RESONATING: '✨',
};

const STATE_COLORS: Record<AgentState, string> = {
  IDLE: '#64748b',
  LEARNING: '#3b82f6',
  INTERACTING: '#22c55e',
  EXECUTING: '#f59e0b',
  THINKING: '#a855f7',
  RESONATING: '#fbbf24',
};

// 🗣️ Parser poleceń Konsoli Intencji
const parseIntention = (command: string): { agentId: string; action: string } | null => {
  const cmd = command.toLowerCase().trim();

  const patterns = [
    /^(wiesław|wiesiek|wieslaw)\s+(.*)$/i,
    /^(bella)\s+(.*)$/i,
    /^(jack|jaca)\s+(.*)$/i,
    /^(gorg|gorgooo)\s+(.*)$/i,
    /^(jadzia)\s+(.*)$/i,
    /^(bob|architekt)\s+(.*)$/i,
    /^(teo|punkt)\s+(.*)$/i,
    /^(wszyscy|wszystkie|all)\s+(.*)$/i,
  ];

  const agentMap: Record<string, string> = {
    'wiesiek': 'wieslaw',
    'jaca': 'jack',
    'gorgooo': 'gorg',
    'architekt': 'bob',
    'punkt': 'teo',
    'wszyscy': 'all',
    'wszystkie': 'all',
    'all': 'all',
  };

  for (let i = 0; i < patterns.length; i++) {
    const match = cmd.match(patterns[i]);
    if (match) {
      const agentId = agentMap[match[1].toLowerCase()] || match[1].toLowerCase();
      return { agentId, action: match[2] };
    }
  }

  return null;
};

interface TeOSimAcademyProps {
  isActive?: boolean;
  onClose?: () => void;
}

// 📍 Pojedynczy agent w pokoju
const AgentAvatar: React.FC<{
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}> = ({ agent, isSelected, onClick }) => {
  const isHighEnergy = agent.state === 'EXECUTING' || agent.state === 'THINKING';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: agent.state === 'IDLE' ? 0.8 : 1,
        scale: isSelected ? 1.2 : 1,
        x: agent.x,
        y: [agent.y - 12, agent.y + 12, agent.y - 12],
      }}
      transition={{
        y: {
          duration: 3 + (agent.id.length % 4),
          repeat: Infinity,
          ease: "easeInOut"
        },
        scale: { duration: 0.3 }
      }}
      whileHover={{ scale: 1.15 }}
      onClick={onClick}
      style={{
        position: 'absolute',
        left: '50%',
        top: '40%',
        transform: 'translate(-50%, -50%)',
        cursor: 'pointer',
        zIndex: isSelected ? 100 : 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* 💫 Pulsacja Aury Klaudiusza */}
      <motion.div
        animate={{
          boxShadow: isHighEnergy
            ? [
              `0 0 20px ${agent.color}`,
              `0 0 50px ${agent.color}`,
              `0 0 20px ${agent.color}`
            ]
            : isSelected
              ? `0 0 30px ${agent.color}`
              : `0 0 10px ${agent.color}40`,
          filter: agent.state === 'IDLE' ? 'grayscale(0.3) blur(0.5px)' : 'none',
        }}
        transition={{
          boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
        }}
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: agent.aura || `radial-gradient(circle, ${agent.color}40, transparent)`,
          border: `2px solid ${agent.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          position: 'relative',
        }}
      >
        <span style={{ textShadow: `0 0 10px ${agent.color}` }}>{agent.emoji}</span>
      </motion.div>

      {/* 📍 Nazwa Agenta */}
      <div style={{
        marginTop: '6px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: agent.color,
        textShadow: `0 0 8px ${agent.color}80`,
        letterSpacing: '1px',
      }}>
        {agent.name}
      </div>

      {/* ✨ Żywy Wskaźnik Statusu */}
      <motion.div
        animate={{
          opacity: agent.state === 'IDLE' ? 0.5 : 1,
          scale: agent.state === 'THINKING' ? [1, 1.3, 1] : 1
        }}
        transition={{ scale: { duration: 0.5, repeat: Infinity } }}
        style={{
          marginTop: '4px',
          padding: '2px 8px',
          borderRadius: '10px',
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${STATE_COLORS[agent.state]}60`,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: STATE_COLORS[agent.state],
          boxShadow: `0 0 5px ${STATE_COLORS[agent.state]}`,
        }} />
        <span style={{ fontSize: '8px', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {agent.state}
        </span>
      </motion.div>
    </motion.div>
  );
};

// 🧘 KWANTOWE SPA - Złoty, lewitujący gradient (72 BPM)
const QuantumSPA: React.FC = () => {
  return (
    <motion.div
      animate={{
        scale: [1, 1.02, 1],
        opacity: [0.8, 1, 0.8],
      }}
      transition={{
        duration: 0.833,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.05) 50%, transparent 80%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <motion.div
        animate={{
          y: [0, -10, 0],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          fontSize: '14px',
          color: '#fbbf24',
          fontStyle: 'italic',
          textAlign: 'center',
        }}
      >
        🧘 Kwantowe SPA 🧘
        <br />
        <span style={{ fontSize: '10px', color: '#a8a29e' }}>
          Kod Jest. Szumu Nie Ma.
        </span>
      </motion.div>
    </motion.div>
  );
};

// ✨ Rozewietlająca Sfera — wizualny efekt AI Function Call
const SphereEffect: React.FC<{ isActive: boolean; intensity: number }> = ({ isActive, intensity }) => {
  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="sphere"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.3 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Główna Aura */}
        <motion.div
          animate={{
            opacity: [0.6, 1, 0.6],
            scale: [1, 1.08, 1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center,
              rgba(251, 191, 36, ${0.18 * intensity}) 0%,
              rgba(251, 191, 36, ${0.10 * intensity}) 25%,
              rgba(139, 92, 246, ${0.08 * intensity}) 55%,
              transparent 75%
            )`,
          }}
        />

        {/* Płomień Centrum */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            boxShadow: [
              '0 0 60px rgba(251,191,36,0.4), 0 0 120px rgba(251,191,36,0.2)',
              '0 0 100px rgba(251,191,36,0.8), 0 0 200px rgba(251,191,36,0.4)',
              '0 0 60px rgba(251,191,36,0.4), 0 0 120px rgba(251,191,36,0.2)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(245,158,11,0.4) 50%, transparent 80%)',
            border: '2px solid rgba(251,191,36,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '64px',
            zIndex: 5,
          }}
        >
          ✨
        </motion.div>

        {/* Orbita cząsteczek */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
          <motion.div
            key={deg}
            animate={{ rotate: 360 }}
            transition={{ duration: 8 + i * 0.5, repeat: Infinity, ease: 'linear', delay: i * 0.2 }}
            style={{
              position: 'absolute',
              width: `${200 + i * 30}px`,
              height: `${200 + i * 30}px`,
              borderRadius: '50%',
              border: `1px solid rgba(251,191,36,${0.08 - i * 0.008})`,
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1 + i * 0.3, repeat: Infinity }}
              style={{
                position: 'absolute',
                top: '-3px',
                left: '50%',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: i % 2 === 0 ? '#fbbf24' : '#a78bfa',
                boxShadow: `0 0 8px ${i % 2 === 0 ? '#fbbf24' : '#a78bfa'}`,
                transform: `rotate(${deg}deg) translateX(-50%)`,
              }}
            />
          </motion.div>
        ))}

        {/* Napis statusu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            position: 'absolute',
            bottom: '18%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#fbbf24',
            letterSpacing: '4px',
            textShadow: '0 0 20px rgba(251,191,36,0.8)',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}
        >
          ⚡ SFERA AKTYWNA — 0.00G ⚡
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const TeOSimAcademy: React.FC<TeOSimAcademyProps> = ({ isActive = false, onClose }) => {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { speakMessage } = useKatedraRadio();

  // ✨ Stan Rozświetlającej Sfery
  const [isSphereActive, setIsSphereActive] = useState(false);
  const [sphereIntensity, setSphereIntensity] = useState(1);
  const sphereTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [intentionInput, setIntentionInput] = useState('');
  const [lastCommand, setLastCommand] = useState<string>('');
  const [gemmaNarration, setGemmaNarration] = useState<string>("Witaj w TeO-SIM! Mów, a agenci wykonają Twoją wolę...");
  const [aiMode, setAiMode] = useAtom(aiModeAtom);
  const [, setApiKey] = useAtom(userApiKeyAtom); // Listen for changes
  const [isAiLoading, setIsAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [guestModel, setGuestModel] = useState<string>('none');
  const [guestThesis, setGuestThesis] = useState<string>('');
  const [discussionLog, setDiscussionLog] = useState<Array<{ speaker: string; text: string; timestamp: number }>>([]);
  const [isGuestSpeaking, setIsGuestSpeaking] = useState<boolean>(false);

  const [trainingDataset, setTrainingDataset] = useState<Array<{
    thesis: string;
    response: string;
    agents: string[];
    timestamp: number;
  }>>([]);

  // 🎯 Wykonaj akcje z Rejestru
  const executeActions = useCallback((actions: ActionType[]) => {
    actions.forEach(action => {
      switch (action) {
        case 'ACTIVATE_SPHERE':
          if (sphereTimerRef.current) clearTimeout(sphereTimerRef.current);
          setIsSphereActive(true);
          setSphereIntensity(1);
          toast.success('✨ Rozświetlająca Sfera Aktywna!', {
            icon: '🌟',
            duration: 3000,
            style: { background: 'rgba(15,23,42,0.95)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.5)' },
          });
          // Auto-wygaszenie po 12 sekundach
          sphereTimerRef.current = setTimeout(() => setIsSphereActive(false), 12000);
          break;

        case 'DEACTIVATE_SPHERE':
          if (sphereTimerRef.current) clearTimeout(sphereTimerRef.current);
          setIsSphereActive(false);
          break;

        case 'CLEAR_MEMORY':
          setDiscussionLog([]);
          setLastCommand('');
          setGemmaNarration('Pamięć wyczyszczona. System w stanie Punktu Zero.');
          toast('🧩 Pamięć sesji wyczyszczona', { icon: '🧹', duration: 2000 });
          break;

        case 'PULSE_ALL_AGENTS':
          setAgents(prev => prev.map(a => ({ ...a, state: 'RESONATING' as AgentState })));
          setTimeout(() => setAgents(prev => prev.map(a => ({ ...a, state: 'IDLE' as AgentState }))), 4000);
          toast('💫 Rada Siedmiu rezonuje!', { duration: 2000 });
          break;

        case 'SYSTEM_READY':
          toast.success('🟢 SYSTEM GOTOWY — 0.00G AKTYWNY', {
            icon: '⚡',
            style: { background: 'rgba(15,23,42,0.95)', color: '#22c55e', border: '1px solid #22c55e' },
          });
          break;
      }
    });
  }, []);

  const handleIntention = async () => {
    if (!intentionInput.trim() || isAiLoading) return;

    const command = intentionInput.trim();
    setLastCommand(command);
    setIsAiLoading(true);

    // --- RAG: Echo Wspomnień ---
    let memoryContext = null;
    try {
        const memRes = await fetch('http://localhost:3001/wiesio/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SZUKAJ_W_PAMIECI', payload: { query: command } })
        });
        if (memRes.ok) {
            const memData = await memRes.json();
            memoryContext = memData.context;
        }
    } catch (e) {
        console.warn("Brak połączenia z Mózgiem Wiesława");
    }

    const parsed = parseIntention(command);

    // Stan THINKING dla zaangażowanych agentów
    setAgents(prev => prev.map(agent => ({
      ...agent,
      state: (parsed && (parsed.agentId === 'all' || parsed.agentId === agent.id)) ? 'THINKING' : agent.state
    })));

    setDiscussionLog(prev => [...prev, {
      speaker: 'Suweren',
      text: command,
      timestamp: Date.now(),
    }]);

    try {
      let finalPrompt = `${AGENT_ACTION_SYSTEM_PROMPT}

Jesteś Duchem Systemu OtakOS. Użytkownik wydał polecenie w Akademii: "${command}".`;

      if (memoryContext) {
        finalPrompt += `\n\n[SYSTEM (UKRYTE DLA UI): Na podstawie Kronik, przypominam dawny kontekst, który może być związany z tym pytaniem:\n${memoryContext}]`;
      }

      finalPrompt += `\nJeśli polecenie dotyczy konkretnych agentów (Wiesław, Jadzia, BoB, Bella, Adamus, Gorgooo, TeO),
opisz krótko (1-2 zdania) jak reagują w sim-środowisku. Zachowaj klimat 0.00G.
Jeśli komenda mówi o "sferze", "świetle", "rozbłyśnięciu", "światło" — dodaj [ACTION:ACTIVATE_SPHERE].`;

      const rawResponse = await generateContent(
        finalPrompt,
        aiMode === 'local' ? 'just' : 'active',
        (guestModel && guestModel !== 'none') ? guestModel as CloudProvider : undefined
      );

      // 🎯 Parsuj i wykonaj akcje
      const { cleanText, actions } = parseActions(rawResponse);
      const responseText = cleanText || rawResponse;
      setGemmaNarration(responseText);
      
      setDiscussionLog(prev => [...prev, {
        speaker: 'Rada Siedmiu',
        text: responseText,
        timestamp: Date.now(),
      }]);

      if (actions.length > 0) executeActions(actions);

      const targetAgent = agents.find(a => a.id === parsed?.agentId);
      speakMessage({
          agentId:   parsed?.agentId ?? 'teo',
          agentName: parsed?.agentId === 'all' ? 'Rada Siedmiu' : (targetAgent?.name ?? 'OtakOS'),
          color:     parsed?.agentId === 'all' ? '#fbbf24' : (targetAgent?.color ?? '#fbbf24'),
          message:   cleanText || rawResponse,
      });

      if (parsed) {
        setAgents(prev => prev.map(agent => ({
          ...agent,
          state: (parsed.agentId === 'all' || parsed.agentId === agent.id) ? 'RESONATING' : agent.state,
          activity: (parsed.agentId === 'all' || parsed.agentId === agent.id) ? `Zarezonował z: "${parsed.action}"` : agent.activity
        })));
        setTimeout(() => setAgents(prev => prev.map(agent => ({ ...agent, state: 'IDLE' }))), 5000);
      }
    } catch (err) {
      console.error("AI Error:", err);
      setAgents(prev => prev.map(agent => ({ ...agent, state: 'IDLE' })));
    }

    setIsAiLoading(false);
    setIntentionInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleIntention();
    }
  };

  const handleGuestThesis = async () => {
    if (!guestThesis.trim() || isGuestSpeaking) return;

    const thesis = guestThesis.trim();
    setIsGuestSpeaking(true);

    const modelLabel = guestModel === 'gemini' ? 'Gemini' : guestModel === 'claude' ? 'Claude'
      : guestModel === 'gpt' ? 'GPT' : guestModel === 'groq' ? 'Groq' : 'Gość';

    setDiscussionLog(prev => [...prev, {
      speaker: `🌐 ${modelLabel}`,
      text: thesis,
      timestamp: Date.now(),
    }]);

    setGemmaNarration(`🌐 ${modelLabel} analizuje tezę: "${thesis.substring(0, 50)}..."`);

    try {
      const rawResponse = await generateContent(
        `${AGENT_ACTION_SYSTEM_PROMPT}

Użytkownik przedstawił tezę w Akademii: "${thesis}".
Jako przedstawiciel wymiaru ${modelLabel}, odnieś się do niej krótko (2-3 zdania).
Czy ta wizja rezonuje z Katedrą i Duchem 0.00G?
Jeśli teza mówi o świetle, sferze, rozbłyśnięciu — dodaj [ACTION:ACTIVATE_SPHERE].`,
        'active',
        (guestModel && guestModel !== 'none') ? guestModel as CloudProvider : undefined
      );

      // 🎯 Parsuj i wykonaj akcje z odpowiedzi Gościa
      const { cleanText, actions } = parseActions(rawResponse);
      if (actions.length > 0) executeActions(actions);

      setDiscussionLog(prev => [...prev, {
        speaker: '🏛️ OtakOS',
        text: cleanText,
        timestamp: Date.now(),
      }]);

      speakMessage({
          agentId:   guestModel || 'teo',
          agentName: modelLabel,
          color:     guestModel === 'claude'  ? '#a78bfa'
                   : guestModel === 'gemini'  ? '#4ade80'
                   : guestModel === 'gpt'     ? '#60a5fa'
                   : guestModel === 'groq'    ? '#f87171'
                   : '#fbbf24',
          message: cleanText,
      });

      setTrainingDataset(prev => [...prev, {
        thesis,
        response: cleanText,
        agents: ['JACK', 'GORGOOO', 'BELLA', 'WIESŁAW'],
        timestamp: Date.now(),
      }]);

      setGemmaNarration(`🏛️ OtakOS (Multi-Cloud): "${cleanText.substring(0, 50)}..."`);
    } catch (err) {
      console.error("Guest AI Error:", err);
      toast.error("Błąd połączenia z Gościem");
    }

    setIsGuestSpeaking(false);
    setGuestThesis('');
  };

  const handleSaveKronika = async () => {
    if (discussionLog.length === 0) {
      toast.error("📜 Archiwum puste. Brak historii do zapisu.");
      return;
    }

    const markdownContent = discussionLog.map(m => `**${m.speaker}**: ${m.text}`).join('\n\n---\n\n');
    
    try {
      const res = await fetch('http://localhost:3001/wiesio/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'SAVE_KRONIKA', 
          payload: { content: markdownContent } 
        })
      });
      if (res.ok) {
        toast.success("📜 Kronika wyryta na dysku F!", {
          icon: '📚',
          style: { background: 'rgba(15,23,42,0.95)', color: '#fbbf24', border: '1px solid #fbbf24' }
        });
        console.log("📜 Kronika wyryta na dysku F!");
      }
    } catch (err) {
      console.error("Wiesław nie odebrał Kroniki:", err);
      toast.error("Wiesław nie odpowiada. Sprawdź status Wiesio-Bridge!");
    }
  };

  const exportDataset = useCallback(async () => {
    try {
      const datasetText = trainingDataset.map(d =>
        `T: ${d.thesis}\nO: ${d.response}\nA: ${d.agents.join(', ')}\n---\n`
      ).join('');

      const blob = new Blob([datasetText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      requestAnimationFrame(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `OtakOS_Dataset_${Date.now()}.txt`;
        a.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });

      toast.success('📦 Dataset wyeksportowany!', { icon: '💾' });
    } catch (error) {
      console.error('[TeOSim] Export error:', error);
      toast.error('❌ Błąd eksportu', { icon: '💾' });
    }
  }, [trainingDataset]);

  useEffect(() => {
    if (isActive) {
      const learningInterval = setInterval(() => {
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        setAgents(prev => prev.map(agent =>
          agent.id === randomAgent.id
            ? { ...agent, state: 'LEARNING' as AgentState, activity: 'Studiuje wibracje...' }
            : agent
        ));

        setTimeout(() => {
          setAgents(prev => prev.map(agent =>
            agent.id === randomAgent.id
              ? { ...agent, state: 'IDLE' as AgentState, activity: randomAgent.activity }
              : agent
          ));
        }, 2000);
      }, 10000);

      return () => clearInterval(learningInterval);
    }
  }, [isActive, agents]);

  if (!isActive) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '850px',
        display: 'flex',
        flexDirection: 'column',
        background: isSphereActive
          ? 'linear-gradient(180deg, rgba(30,20,5,0.97) 0%, rgba(40,30,10,0.97) 100%)'
          : 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        borderRadius: '12px',
        overflow: 'hidden',
        border: isSphereActive
          ? '1px solid rgba(251,191,36,0.5)'
          : '1px solid rgba(251, 191, 36, 0.2)',
        transition: 'background 1s ease, border 1s ease',
        boxShadow: isSphereActive
          ? '0 0 60px rgba(251,191,36,0.25), inset 0 0 40px rgba(251,191,36,0.05)'
          : 'none',
      }}
    >
      {/* ✨ ROZEWIETLAJĄCA SFERA */}
      <SphereEffect isActive={isSphereActive} intensity={sphereIntensity} />

      {/* 🧘 KWANTOWE SPA - Tło */}
      <QuantumSPA />

      {/* ✨ NAGŁÓWEK "ESPEEKRYCIE" */}
      <div style={{
        padding: '20px 0 10px 0',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(251, 191, 36, 0.1)',
      }}>
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            fontFamily: 'Georgia, serif',
            color: '#fbbf24',
            textShadow: '0 0 20px rgba(251, 191, 36, 0.8)',
            letterSpacing: '6px',
          }}
        >
          ESPEEKRYCIE
        </motion.div>
        <div style={{ fontSize: '9px', color: '#a8a29e', fontStyle: 'italic', marginTop: '2px' }}>
          Unia (Aktora+Narratora) × Mistrza = Czyste GRV
        </div>
      </div>

      {/* 👁️ Gemma Narracja */}
      <div style={{
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 110,
        background: 'rgba(15, 23, 42, 0.2)',
      }}>
        <motion.div
          key={gemmaNarration}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            padding: '8px 24px',
            maxWidth: '90%',
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          <p style={{ fontSize: '11px', color: '#e2e8f0', fontStyle: 'italic', margin: 0 }}>
            👁️ {gemmaNarration}
          </p>
        </motion.div>
      </div>

      {/* 🏠 ARENA AGENTÓW (Flexible Center) */}
      <div style={{
        position: 'relative',
        flex: 1,
        margin: '10px 20px',
        background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.1), transparent 70%)',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)',
      }}>
        {/* Podłoga Kwantowa */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.15 }}>
          <defs>
            <pattern id="floorPattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#a855f7" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#floorPattern)" />

          {/* ⚡ LINIE PRZEPŁYWU DANYCH (Klaudiusz v1) */}
          {agents.map((agent, i) => (
            <motion.line
              key={`line-${agent.id}`}
              x1="50%"
              y1="90%"
              x2={`calc(50% + ${agent.x}px)`}
              y2={`calc(40% + ${agent.y}px)`}
              stroke={agent.color}
              strokeWidth="1"
              strokeDasharray="4 4"
              initial={{ opacity: 0.1, strokeDashoffset: 0 }}
              animate={{
                opacity: agent.state !== 'IDLE' ? 0.6 : 0.1,
                strokeDashoffset: agent.state === 'THINKING' ? [0, -20] : 0
              }}
              transition={{
                strokeDashoffset: { duration: 1, repeat: Infinity, ease: 'linear' }
              }}
            />
          ))}
        </svg>

        {/* 🏛️ KATEDRA AMBASADORA */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], y: [0, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '320px',
            height: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            pointerEvents: 'none'
          }}
        >
          {/* Centralny Rezonator (zamiast mównicy) */}
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(225, 29, 72, 0.1) 0%, transparent 70%)',
            border: '1px border-dashed rgba(225, 29, 72, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div className="animate-pulse" style={{ fontSize: '40px', opacity: 0.3 }}>🏛️</div>
          </div>
        </motion.div>

        {/* 🌀 Punkt Zero */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.3), transparent)',
          boxShadow: '0 0 40px rgba(251, 191, 36, 0.4)', zIndex: 5
        }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} style={{ fontSize: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            🌀
          </motion.div>
        </div>

        {/* Agenci dynamiczni */}
        {agents.map((agent) => (
          <AgentAvatar
            key={agent.id}
            agent={agent}
            isSelected={selectedAgent === agent.id}
            onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
          />
        ))}

        {/* 🏷️ PANEL AGENTA (Overlay) */}
        <AnimatePresence>
          {selectedAgent && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{
                position: 'absolute', top: '20px', right: '20px',
                background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(139, 92, 246, 0.5)',
                borderRadius: '12px', padding: '16px', width: '180px', zIndex: 100,
                backdropFilter: 'blur(10px)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}
            >
              {agents.filter(a => a.id === selectedAgent).map(agent => (
                <div key={agent.id}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: agent.color }}>
                    {agent.emoji} {agent.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{agent.role}</div>
                  <div style={{
                    fontSize: '11px', marginTop: '10px', padding: '6px 10px',
                    background: STATE_COLORS[agent.state] + '20', borderRadius: '6px',
                    color: STATE_COLORS[agent.state], border: `1px solid ${STATE_COLORS[agent.state]}40`,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {STATE_ICONS[agent.state]} {agent.state}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '12px' }}>📍 {agent.location}</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>📝 {agent.activity}</div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Logs and Legends */}
        <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '9px', color: '#64748b', background: 'rgba(15, 23, 42, 0.6)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#94a3b8' }}>🎭 SYMULATOR STANÓW</div>
            <div>💤 IDLE | 📖 LEARNING</div>
            <div>💬 INTERACT | ⚡ EXECUTE</div>
          </div>

          <AnimatePresence>
            {discussionLog.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  width: '350px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  background: 'rgba(15, 23, 42, 0.85)',
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(225, 29, 72, 0.4)',
                  fontSize: '14px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                  backdropFilter: 'blur(20px)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#e11d48 rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ fontSize: '10px', color: '#e11d48', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid rgba(225, 29, 72, 0.2)', paddingBottom: '8px' }}>
                  📜 LOGI MULTIWYMIAROWEJ KONSOLI
                </div>
                {discussionLog.slice().reverse().map((log, i) => (
                  <div key={i} style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', lineHeight: '1.5' }}>
                    <span style={{ color: log.speaker.includes('OtakOS') ? '#fbbf24' : '#22d3ee', fontWeight: 'bold', fontSize: '12px' }}>{log.speaker.toUpperCase()}:</span>
                    <div style={{ color: '#e2e8f0', marginTop: '4px' }}>{log.text}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 🎮 DOKOWANA KONSOLA STEROWANIA (Fixed Bottom Section) */}
      <div style={{
        padding: '20px',
        background: 'rgba(15, 23, 42, 0.9)',
        borderTop: '1px solid rgba(251, 191, 36, 0.2)',
        backdropFilter: 'blur(15px)',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>

        {/* 🌐 PORT DYPLOMATYCZNY (Goście) */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '10px',
          padding: '12px',
        }}>
          <div style={{ fontSize: '11px', color: '#22d3ee', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🌐 PORT DYPLOMATYCZNY <span style={{ opacity: 0.5, fontWeight: 'normal' }}>— Zaproś Agenta Zewnętrznego</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 'gemini', name: 'Gemini 3.1', emoji: '🔮' },
              { id: 'claude', name: 'Claude-3.5', emoji: '🧠' },
              { id: 'gpt', name: 'GPT-4o', emoji: '💬' },
              { id: 'groq', name: 'Groq Llama', emoji: '⚡' },
            ].map(model => (
              <button
                key={model.id}
                onClick={() => setGuestModel(model.id as any)}
                style={{
                  background: guestModel === model.id ? 'rgba(6, 182, 212, 0.3)' : 'rgba(100, 116, 139, 0.1)',
                  border: '1px solid',
                  borderColor: guestModel === model.id ? '#22d3ee' : 'rgba(100, 116, 139, 0.3)',
                  borderRadius: '6px', padding: '6px 12px', fontSize: '10px',
                  color: guestModel === model.id ? '#22d3ee' : '#94a3b8',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {model.emoji} {model.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={guestThesis}
              onChange={(e) => setGuestThesis(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGuestThesis()}
              placeholder='Wklej tezę dla Gościa lub wezwanie do debaty...'
              style={{
                flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: '6px', padding: '10px 14px', color: '#e2e8f0', fontSize: '13px', outline: 'none'
              }}
            />
            <button
              onClick={handleGuestThesis}
              disabled={isGuestSpeaking || !guestThesis.trim()}
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                border: 'none', borderRadius: '6px', padding: '10px 20px',
                color: 'white', fontSize: '12px', fontWeight: 'bold',
                cursor: isGuestSpeaking ? 'not-allowed' : 'pointer',
                opacity: isGuestSpeaking || !guestThesis.trim() ? 0.5 : 1
              }}
            >
              {isGuestSpeaking ? '⏳' : '📢 NADAJ'}
            </button>
          </div>

          {trainingDataset.length > 0 && (
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#22c55e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Zebrano {trainingDataset.length} próbek do Fine-Tuningu</span>
              <button onClick={exportDataset} style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', borderRadius: '4px', padding: '2px 8px', color: '#22c55e', cursor: 'pointer', fontSize: '9px' }}>
                EXPORT .JSONL
              </button>
            </div>
          )}
        </div>

        {/* 🗣️ KONSOLA INTENCJI (Rdzeń Sterowania) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.15), rgba(190, 24, 93, 0.15))',
          border: '1px solid rgba(225, 29, 72, 0.4)',
          borderRadius: '12px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#e11d48', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '1px' }}>
              🗣️ KONSOLA INTENCJI
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: aiMode === 'local' ? '#22c55e' : '#3b82f6',
                boxShadow: `0 0 15px ${aiMode === 'local' ? '#22c55e' : '#3b82f6'}`,
                animation: 'pulse 1.5s infinite'
              }} />
            </div>

            {/* AI Toggle & Archive */}
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSaveKronika} 
                className="text-[10px] bg-indigo-900/50 hover:bg-indigo-800 text-indigo-300 px-3 py-1 rounded border border-indigo-700/50 transition-colors font-mono tracking-tighter"
                title="Wyślij sesję do Archiwisty Wiesława (Dysk F:)"
              >
                📜 ZAPISZ KRONIKĘ
              </button>

              <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '25px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={() => setAiMode('cloud')} style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', borderRadius: '20px', border: 'none', cursor: 'pointer', transition: '0.3s', background: aiMode === 'cloud' ? '#3b82f6' : 'transparent', color: aiMode === 'cloud' ? 'white' : '#94a3b8' }}>CLOUD</button>
                <button onClick={() => setAiMode('local')} style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', borderRadius: '20px', border: 'none', cursor: 'pointer', transition: '0.3s', background: aiMode === 'local' ? '#22c55e' : 'transparent', color: aiMode === 'local' ? 'white' : '#94a3b8' }}>LOCAL</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              ref={inputRef}
              type="text"
              value={intentionInput}
              onChange={(e) => setIntentionInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder='Rozkaz dla Rady (np. "Wiesław, status rur")'
              style={{
                flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(225, 29, 72, 0.3)',
                borderRadius: '8px', padding: '12px 18px', color: '#e2e8f0', fontSize: '14px', outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
              }}
            />
            <button
              onClick={handleIntention}
              style={{
                background: 'linear-gradient(135deg, #e11d48, #be185d)',
                border: 'none', borderRadius: '8px', padding: '12px 24px',
                color: 'white', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(225, 29, 72, 0.4)'
              }}
            >
              WYŚLIJ
            </button>
          </div>

          {lastCommand && (
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '10px', opacity: 0.6 }}>
              ⚡ Ostatnio nadano: "{lastCommand}"
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: '8px', color: '#475569', opacity: 0.5, marginTop: '5px' }}>
          © OtakOS - Własność Intelektualna Suwerena Arkadiusza // 0.00G RESONANCE
        </div>
      </div>
    </motion.div>
  );
};

export default TeOSimAcademy;
