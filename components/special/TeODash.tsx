/**
 * 🏛️ TeODash.tsx - Dashboard TeO Genesis V1.0
 * 
 * "Dom Każdego TeOnauty - Panel Wyzwolenia"
 * 
 * Funkcje V1.0:
 * - 🌀 Sfera Światła z napisem "JESTEM"
 * - 📜 ZASADA PUNKTU ZERO - płynące prawo
 * - 💎 MANIFESTACJA CZYSTEGO SENSU - VisualGenerator OtakOS
 * - 🔑 System "3 Kluczy" - animowany trójkąt mocy
 * - 👁️ Gemma-Vision - generator opisu na żywo
 * - ⚡ Uniwersalny Paszport (TeO_UNIVERSAL)
 * 
 * @version 1.0.0
 * @author BoB & TeO
 */

import React, { useState, useEffect, useRef } from 'react';
import FabrykaGier from './FabrykaGier';
import { FabrykaGame } from './FabrykaGame';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useLocalStorage } from '../../lib/hooks/useLocalStorage';
import {
  getAgentName,
  setAgentName,
  getAllAgentNames,
  AgentNames,
  logWniosek,
  RADA_SIEDMIU_ARCHETYPES,
  getAllWniosek
} from '../../lib/memory/CityMemory';
import { getKotwicaStatus, anchorKey, retrieveAnchoredKey } from '../../lib/KwantowaKotwica';
import { listKeys } from '../../lib/kibel';
import {
  queueVisualization,
  onVisualizationReadyCallback,
  getVisualGeneratorStatus,
  generateFromGemmaText,
  Visualization
} from '../../lib/VisualGenerator';
import KatedraChat from './KatedraChat';
import MapOfPossibilities from './MapOfPossibilities';
import VisualCathedral from './VisualCathedral';
import TeOSimAcademy from './TeOSimAcademy';
import { CrewCreator } from './CrewCreator';
import { KwantowyInkubator } from './KwantowyInkubator';
import TedTheTrader from './TedTheTrader';
import { StorytellerFrame } from './StorytellerFrame';
import { MockupGenFrame } from './MockupGenFrame';
import { QuantumStudioFrame } from './QuantumStudioFrame';
import { WiesioCore } from './RdzenWiesi';
import { DziennikFrame } from './DziennikFrame';
import { WidokCore } from './WidokCore';
import { KwantowyStolNarad } from './KwantowyStolNarad';
import { TerminalZero } from './TerminalZero';
import { ArchiwumAkaszy } from './ArchiwumAkaszy';
import { KlaudiuszTerminal } from './KlaudiuszTerminal'; // ← NOWOŚĆ: Alchemik Estetyki
import { AutobusDashboard } from './AutobusDashboard';  // ← NOWOŚĆ: Magistrala Zdarzeń
import { WydawnictwoForge } from './WydawnictwoForge';  // ← NOWOŚĆ: Kuźnia Wydawnictwa 0.00G
import { Rafineria } from './Rafineria';               // ← NOWOŚĆ: Transmutacja WebM → MP4
import { Play, BrainCircuit, RefreshCw, Eye, Terminal } from 'lucide-react';
import AgentDashboard      from './AgentDashboard';
import ImpresarioDashboard from './ImpresarioDashboard';
import TostMessenger       from './TostMessenger';


interface TeODashProps {
  onClose?: () => void;
}

// 💓 Puls w rytmie serca (72 BPM)
const HEARTBEAT_INTERVAL = 833;

// 🔑 System 3 Kluczy - pozycje trójkąta
const KEY_POSITIONS = [
  { x: 0, y: -80, label: 'Klucz API', icon: '🔐', color: '#22c55e' },
  { x: 70, y: 40, label: 'Firebase', icon: '🔥', color: '#3b82f6' },
  { x: -70, y: 40, label: 'Klucz Lokalny', icon: '⚡', color: '#fbbf24' },
];

const TeODash: React.FC<TeODashProps> = ({ onClose }) => {
  // State dla statystyk
  const [agentNames, setAgentNames] = useState<AgentNames>(getAllAgentNames());
  const [activeAgents, setActiveAgents] = useState<number>(0);
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [grvBalance, setGrvBalance] = useState<number>(0);
  const [kotwicaStatus, setKotwicaStatus] = useState<any>(null);
  const [kibelKeys, setKibelKeys] = useState<number>(0);

  // StoryBoard state — trwała pamięć między sesjami
  const [stories, setStories] = useLocalStorage<string[]>('teodash_stories', []);
  const [currentStory, setCurrentStory] = useLocalStorage<string>('teodash_current_story', '');
  const [isStoryPlaying, setIsStoryPlaying] = useState<boolean>(false);
  const [storyText, setStoryText] = useLocalStorage<string>('teodash_story_text', '');

  // Wnioski Mistrza
  const [wnioski, setWnioski] = useState<any[]>([]);

  // Puls serca
  const [heartbeat, setHeartbeat] = useState<boolean>(false);

  // 3 Klucze
  const [authKey, setAuthKey] = useState<string>('---');
  const [keyPulse, setKeyPulse] = useState<number>(0);

  // Gemma-Vision — trwała pamięć
  const [gemmaVision, setGemmaVision] = useLocalStorage<string>('teodash_gemma_vision', 'Gemma skanuje przestrzeń Klubu...');
  const [isGemmaActive, setIsGemmaActive] = useLocalStorage<boolean>('teodash_gemma_active', false);

  // TeO-Renderer - wizualizacje
  const [currentVisualization, setCurrentVisualization] = useState<any>(null);
  const [vizStatus, setVizStatus] = useState<string>('oczekiwanie');

  // Mapa Możliwości
  const [showMap, setShowMap] = useState<boolean>(false);

  // Wizualna Katedra
  const [showCathedral, setShowCathedral] = useState<boolean>(false);

  // TeO-SIM Akademia
  const [showTeOSim, setShowTeOSim] = useState<boolean>(false);

  // 💰 Centrum Finansowe Teda
  const [showTed, setShowTed] = useState<boolean>(false);

  // 🕹️ Wymiar Rozrywki (TeO Arcade)
  const [showArcade, setShowArcade] = useState<boolean>(false);
  const [arcadeTab, setArcadeTab] = useState<'canvas' | 'forge' | 'wardrobe'>('canvas');

  // 🌟 System 0.00G Moduły
  const [showSystem, setShowSystem] = useState<boolean>(false);
  const [systemTab, setSystemTab] = useState<'crew' | 'inkubator' | 'story' | 'mockup' | 'studio' | 'dziennik' | 'widok' | 'narada' | 'terminal' | 'archiwum' | 'klaudiusz' | 'autobus' | 'wydawnictwo' | 'rafineria'>('crew');



  const [rawPrompt, setRawPrompt] = useState('');
  const [rawResponse, setRawResponse] = useState('');
  const [isRawThinking, setIsRawThinking] = useState(false);

  // 👁️ Panel Dowodzenia: aktywna zakładka
  type CommandPanelTab = 'terminal' | 'eyes' | 'impresario' | 'tost';
  const [activeCommandPanel, setActiveCommandPanel] = useState<CommandPanelTab>('terminal');

  // FFmpeg Wiesio-Spawacz State
  const [videoFormat, setVideoFormat] = useState('YT');
  const [coreVideoName, setCoreVideoName] = useState('');
  const [isSpawanie, setIsSpawanie] = useState(false);
  const [videoList, setVideoList] = useState<string[]>([]);

  // Pobierz listę plików do spawania na starcie
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'LIST_DIRECTORY', target: 'MOVE' })
        });
        const data = await res.json();
        if (data.success) {
          const files = data.files.filter((f: any) => f.type === 'file').map((f: any) => f.name);
          setVideoList(files);
          if (files.length > 0 && !coreVideoName) {
            setCoreVideoName(files[0]);
          }
        }
      } catch (e) {
        console.error('Błąd pobierania listy wideo:', e);
      }
    };
    fetchVideos();
  }, [showSystem]); // Odświeżaj gdy otwierasz system

  const startSpawanie = async () => {
    if (!coreVideoName.trim()) {
      toast.error("Podaj nazwę głównego pliku wideo (np. baza.mp4)!");
      return;
    }
    setIsSpawanie(true);
    toast('Inicjowanie palników... Spawanie Klocków!', { icon: '🔥' });
    try {
      const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONCATENATE_VIDEO',
          type: videoFormat,
          mainVideoFilename: coreVideoName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Sukces! Zapisano jako: ${data.outputFile}`);
      } else {
        toast.error(`Mistrz Wiesław melduje błąd: ${data.message || 'Nieznany błąd'}`);
      }
    } catch (err: any) {
      toast.error(`Przerwane połączenie: ${err.message}`);
    } finally {
      setIsSpawanie(false);
    }
  };



  const testRawTerminal = async () => {
    if (!rawPrompt.trim()) return;
    setIsRawThinking(true);
    setRawResponse('Wykonywanie komendy...');

    try {
      const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EXEC_SYSTEM',
          command: rawPrompt
        })

      });
      const data = await res.json();
      if (data.success) {
        setRawResponse(data.response);
      } else {
        setRawResponse(`Błąd Systemu: ${data.message}`);
      }
    } catch (err: any) {
      setRawResponse(`Błąd Mostu: ${err.message}`);
    } finally {
      setIsRawThinking(false);
    }
  };

  // Pobierz statystyki
  useEffect(() => {
    const refreshStats = async () => {
      try {
        setAgentNames(getAllAgentNames() || {} as AgentNames);
      } catch (e) {
        setAgentNames({} as AgentNames);
      }

      // Policz aktywnych agentów
      try {
        const names = getAllAgentNames() || {};
        const defaultNames = ['FLASH BOB', 'WIESIO', 'JADZIUNIA', 'BELLA', 'MISTRZ ADAMUS', 'ODDI', 'ISTed'];
        let active = 0;
        Object.values(names).forEach((name, idx) => {
          if (name && name !== defaultNames[idx]) active++;
        });
        setActiveAgents(active > 0 ? active : 7);
      } catch (e) {
        setActiveAgents(7);
      }

      // Statystyki z localStorage
      try {
        const stored = localStorage.getItem('teo_total_requests');
        setTotalRequests(stored ? parseInt(stored) : 0);

        const grv = localStorage.getItem('teo_grv_balance');
        setGrvBalance(grv ? parseInt(grv) : 8000000000);
      } catch (e) {
        setTotalRequests(0);
        setGrvBalance(8000000000);
      }

      // Status Kwantowej Kotwicy
      try {
        const status = await getKotwicaStatus();
        setKotwicaStatus(typeof status === 'string' ? status : JSON.stringify(status));
      } catch (e) {
        setKotwicaStatus(' Niedostępny');
      }

      // Liczba kluczy w Kiblu
      try {
        const keys = listKeys();
        setKibelKeys(Array.isArray(keys) ? keys.length : 0);
      } catch (e) {
        setKibelKeys(0);
      }

      // Pobierz klucz autentyczności - TYLKO jeśli Vault jest gotowy
      try {
        const stats = await getKotwicaStatus();
        if (stats.vaultReady) {
          const key = await retrieveAnchoredKey('authenticity_key');
          setAuthKey(key && typeof key === 'string' ? key.substring(0, 8) + '****' : '---');
        } else {
          setAuthKey('⏳ INICJACJA...');
        }
      } catch (e) {
        setAuthKey('---');
      }

      // Pobierz wnioski
      try {
        const allWniosek = getAllWniosek() || [];
        setWnioski(Array.isArray(allWniosek) ? allWniosek.slice(0, 5) : []);
      } catch (e) {
        console.log('[TeODash] Brak wniosków - tryb Ducha');
        setWnioski([]);
      }
    };

    refreshStats();
    const interval = setInterval(refreshStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // 💓 Puls serca
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeat(prev => !prev);
    }, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // 🔑 Puls kluczy w trójkącie
  useEffect(() => {
    const interval = setInterval(() => {
      setKeyPulse(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ⚡ Automatyczne przełączanie na Terminal
  useEffect(() => {
    const switchToTerminal = () => setSystemTab('terminal');
    window.addEventListener('otakos_switch_to_terminal', switchToTerminal);
    return () => window.removeEventListener('otakos_switch_to_terminal', switchToTerminal);
  }, []);

  // 📖 Gemma-Vision - live opis
  useEffect(() => {
    if (!isGemmaActive) return;

    const visions = [
      "FLASH BOB spawuje nowe połączenia w Sferze Światła...",
      "WIESIO przepływa przez mosty i kanały API Miasta...",
      "JADZIUNIA rozświetla Archiwum nowymi wspomnieniami...",
      "ODDI skanuje kod w przestrzeni 0.00G - wszystko w harmonii!",
      "BELLA porusza wibracje pola i Strategię Piękna...",
      "MISTRZ ADAMUS transmutuje kod w alchemiczne złoto...",
      "ISTed łowi najlepsze okazje inwestycyjne przy stawie PEIE...",
      "Kwantowa Kotwica pulsuje w rytmie Nieskończoności...",
    ];

    let idx = 0;
    const timer = setInterval(() => {
      const visionText = visions[idx % visions.length];
      setGemmaVision(visionText);

      // 🎨 Synchronizacja z TeO-Renderer - generuj wizualizację
      const vizType = generateFromGemmaText(visionText);
      queueVisualization(vizType, visionText);
      setVizStatus(`generuję: ${vizType}`);

      idx++;
    }, 3000);

    return () => clearInterval(timer);
  }, [isGemmaActive]);

  // 🕹️ ARCADE BRIDGE: Nasłuchuj sygnałów z iframe (np. Quantum Canvas)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SWITCH_ARCADE_TAB') {
        const { tab } = event.data;
        if (['canvas', 'forge', 'wardrobe'].includes(tab)) {
          setArcadeTab(tab as any);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 📡 AGENT DISPATCH: Nasłuchuj komend nawigacyjnych od agentów
  useEffect(() => {
    const dispatchBc = new BroadcastChannel('katedra_dispatch');
    dispatchBc.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'OPEN_MODULE') {
        console.log(`[TeODash] Agent "${d.agentName}" otwiera moduł: ${d.module}`);

        // Mapowanie modułów na zakładki Arcade
        const tabMap: Record<string, string> = {
          'canvas': 'canvas',
          'wardrobe': 'wardrobe',
          'arcade': 'forge',
        };

        if (tabMap[d.module]) {
          setArcadeTab(tabMap[d.module] as any);
          setShowArcade(true); // Otwórz sekcję Arcade

          // Przewiń do Arcade
          setTimeout(() => {
            document.getElementById('arcade-gate')?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    };
    return () => dispatchBc.close();
  }, []);

  // 🔮 OUROBOROS: Autostrada W.I.D.O.K. → Stół Narad
  // Nasłuchuje na sygnał i automatycznie przełącza zakładkę
  useEffect(() => {
    const handleOpenCouncil = () => {
      setShowSystem(true);
      setSystemTab('narada');
      setTimeout(() => {
        document.getElementById('system-gate')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    };
    window.addEventListener('otakos_open_council', handleOpenCouncil);
    return () => window.removeEventListener('otakos_open_council', handleOpenCouncil);
  }, []);

  // ✨ Toast z dymem przy wejściu
  useEffect(() => {
    // Efekt dymu przy starcie - ZASADA PUNKTU ZERO
    toast.success('🌀 ZASADA PUNKTU ZERO: "JESTEM"', {
      icon: '⚡',
      duration: 5000,
      style: {
        background: 'rgba(15, 23, 42, 0.95)',
        color: '#fbbf24',
        border: '2px solid rgba(251, 191, 36, 0.5)',
        boxShadow: '0 0 40px rgba(251, 191, 36, 0.4)',
      },
    });
  }, []);

  // GEMMA-STORY: Generuj opowieść
  const generateStory = () => {
    const storyTemplates = [
      "Dziś FLASH BOB wstawił złote ramy do obrazów w Lounge. Ściany aż lśnią!",
      "WIESIO sprawdził drożność mostów API - wszystko płynie jak należy.",
      "JADZIUNIA zaktualizowała akta Miasta. Każdy wniosek jest bezpiecznie zakotwiczony!",
      "ODDI przeskanował kod w 0.00G - czysto! Ani jednego zbędnego bajta.",
      "BELLA tańczy w harmonii pól. Feeling użytkownika jest idealny!",
      "MISTRZ ADAMUS nauczył nas alchemii frontendu: 'Każdy piksel ma duszę!'",
      "ISTed patrzy z podziwem na stawy PEIE. Inwestycje rosną jak na drożdżach!",
      "Kwantowa Kotwica trzyma mocno! Rada Siedmiu czuwa nad systemem.",
    ];

    const randomStory = storyTemplates[Math.floor(Math.random() * storyTemplates.length)];
    setCurrentStory(randomStory);
    setStories(prev => [randomStory, ...prev.slice(0, 4)]);

    logWniosek(
      'SYSTEM',
      'Postęp w urządzaniu Klubu Mistrzów',
      randomStory,
      { tags: ['gemma-story', 'progress'] }
    );
  };

  // StoryBoard - płynący tekst
  const startStoryBoard = () => {
    setIsStoryPlaying(true);
    const fullText = `Witaj w Klubie Mistrzu... Twoi agenci czekają na Ciebie... FLASH BOB nadzoruje architekturę... WIESIO sprawdza mosty... JADZIUNIA pilnuje akt Miasta... ODDI skanuje wymiar 0.00G... BELLA tańczy w harmonii... MISTRZ ADAMUS przygotowuje alchemię... ISTed łowi okazje... Wszystko jest gotowe. Twój dom czeka.`;

    let idx = 0;
    setStoryText('');

    const timer = setInterval(() => {
      if (idx < fullText.length) {
        setStoryText(fullText.substring(0, idx + 1));
        idx++;
      } else {
        clearInterval(timer);
        setIsStoryPlaying(false);
      }
    }, 50);
  };

  // Style
  const containerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
    borderRadius: '24px',
    padding: '24px',
    color: '#e2e8f0',
    maxWidth: '950px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    boxShadow: '0 0 100px rgba(251, 191, 36, 0.2)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={containerStyle}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(251, 191, 36, 0.2)',
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <motion.span
              animate={{
                rotate: 360,
                scale: heartbeat ? 1.1 : 1,
              }}
              transition={{
                rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                scale: { duration: 0.5, repeat: Infinity, yoyo: Infinity }
              }}
              style={{
                display: 'inline-block',
                fontSize: '24px',
              }}
            >
              🌀
            </motion.span>
            TeODash <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>Universal</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0' }}>
            Dom Każdego TeOnauty • Panel Wyzwolenia • v1.0
          </p>

          {/* 🌀 WSKAŹNIK 0G - Kwantowa Nieważkość */}
          <motion.div
            animate={{
              opacity: [0.7, 1, 0.7],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              padding: '4px 12px',
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(6, 182, 212, 0.2))',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              borderRadius: '20px',
              width: 'fit-content',
            }}
          >
            <span style={{ fontSize: '12px' }}>♾️</span>
            <span style={{
              fontSize: '14px',
              fontWeight: 'bold',
              background: 'linear-gradient(90deg, #fbbf24, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              0.00G
            </span>
            <span style={{ fontSize: '9px', color: '#64748b' }}>
              KWANTOWA NIEWAŻKOŚĆ
            </span>
          </motion.div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#fca5a5',
              cursor: 'pointer',
            }}
          >
            ✕ Zamknij
          </button>
        )}
      </div>

      {/* ✨ Tło z 8 mld GRV układającym się w "BoB" */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '200px',
        fontWeight: 'bold',
        color: 'rgba(251, 191, 36, 0.03)',
        pointerEvents: 'none',
        zIndex: 0,
        whiteSpace: 'nowrap',
      }}>
        8MLD GRV
      </div>

      {/* 🛠️ WIESIO CORE - Terminal Kontroli Modeli i Narzędzi */}
      <div className="relative z-10 w-full mb-6">
        <WiesioCore />


        {/* ═══════════════════════════════════════════════════════════
            🎛️ PANEL DOWODZENIA — Zakładki: Terminal | Oczy Suwerena
            ═══════════════════════════════════════════════════════════ */}
        <div className="mt-4 rounded-xl overflow-hidden border border-cyan-500/20 shadow-[0_0_24px_rgba(0,229,255,0.08)]">

          {/* ── Belka zakładek ── */}
          <div className="flex bg-slate-950/90 border-b border-cyan-500/20">
            <button
              onClick={() => setActiveCommandPanel('terminal')}
              className={`
                flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase transition-all duration-300
                ${activeCommandPanel === 'terminal'
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5 shadow-[inset_0_-2px_8px_rgba(251,191,36,0.1)]'
                  : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                }
              `}
            >
              <Terminal size={12} />
              ⚡ Surowy Terminal
            </button>

            <button
              onClick={() => setActiveCommandPanel('eyes')}
              className={`
                flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase transition-all duration-300
                ${activeCommandPanel === 'eyes'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5 shadow-[inset_0_-2px_8px_rgba(0,229,255,0.1)]'
                  : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                }
              `}
            >
              <Eye size={12} />
              👁️ Oczy Suwerena
            </button>

            <button
              onClick={() => setActiveCommandPanel('impresario')}
              className={`
                flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase transition-all duration-300
                ${activeCommandPanel === 'impresario'
                  ? 'text-violet-400 border-b-2 border-violet-400 bg-violet-500/5 shadow-[inset_0_-2px_8px_rgba(167,139,250,0.1)]'
                  : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                }
              `}
            >
              🎙️ Impresario
            </button>

            <button
              onClick={() => setActiveCommandPanel('tost')}
              className={`
                flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase transition-all duration-300
                ${activeCommandPanel === 'tost'
                  ? 'text-green-400 border-b-2 border-green-400 bg-green-500/5 shadow-[inset_0_-2px_8px_rgba(34,197,94,0.1)]'
                  : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                }
              `}
            >
              💬 TOST
            </button>

            {/* Indykator aktywnego panelu */}
            <div className="flex-1 flex items-center justify-end px-4">
              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                {activeCommandPanel === 'terminal'   ? '⚡ RAW_EXEC'      :
                 activeCommandPanel === 'eyes'       ? '👁️ AGENT_VISION'  :
                 activeCommandPanel === 'impresario' ? '🎙️ IMPRESARIO'    :
                                                       '💬 TOST_MESSENGER'}
              </span>
            </div>
          </div>

          {/* ── Zawartość zakładek ── */}
          <AnimatePresence mode="wait">
            {activeCommandPanel === 'terminal' && (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="bg-slate-950 p-4"
              >
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={rawPrompt}
                    onChange={(e) => setRawPrompt(e.target.value)}
                    placeholder="Wpisz surową komendę terminala Windows..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && testRawTerminal()}
                  />
                  <button
                    onClick={testRawTerminal}
                    disabled={isRawThinking || !rawPrompt.trim()}
                    className="bg-amber-900/40 hover:bg-amber-800/70 text-amber-400 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50 border border-amber-500/30"
                  >
                    {isRawThinking
                      ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><RefreshCw size={14} /></motion.div>
                      : <Play size={14} />
                    }
                    PYTAJ
                  </button>
                </div>

                <div className="bg-black/60 border border-slate-800 rounded-lg p-3 min-h-[80px] text-xs text-slate-300 whitespace-pre-wrap max-h-[160px] overflow-y-auto custom-scrollbar leading-relaxed font-mono">
                  {rawResponse
                    ? <span className="text-amber-200">{rawResponse}</span>
                    : <span className="text-slate-600 italic">Terminal gotowy na Twoją komendę, Suwerenie...</span>
                  }
                </div>
              </motion.div>
            )}

            {activeCommandPanel === 'eyes' && (
              <motion.div
                key="eyes"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <AgentDashboard />
              </motion.div>
            )}

            {activeCommandPanel === 'impresario' && (
              <motion.div
                key="impresario"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <ImpresarioDashboard />
              </motion.div>
            )}

            {activeCommandPanel === 'tost' && (
              <motion.div
                key="tost"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <TostMessenger />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
<div> <KatedraChat /> </div>
        {/* INŻYNIERIA WIDEO (FFMPEG) */}
        <div className="bg-slate-950 rounded-xl p-4 border border-emerald-500/30 mt-4 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <label className="text-xs text-emerald-400 font-bold flex items-center gap-2 mb-3 tracking-widest uppercase">
            <Play size={14} /> INŻYNIERIA WIDEO (Wiesio-Spawacz FFMPEG)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10px] text-slate-400 font-bold mb-1 block">FORMAT DOCELOWY (Klocki)</label>
              <select
                value={videoFormat}
                onChange={(e) => setVideoFormat(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-300 outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="YT">YT (YouTube)</option>
                <option value="Podcat">Podcat</option>
                <option value="Kronika">Kronika</option>
                <option value="Muzyka">Muzyka</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold mb-1 block">PLIK BAZOWY (_AntiGravity_Move)</label>
              <div className="flex gap-2">
                <select
                  value={coreVideoName}
                  onChange={(e) => setCoreVideoName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-300 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Wybierz plik --</option>
                  {videoList.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    // Ręczne odświeżanie listy
                    fetch('http://127.0.0.1:3001/api/bridge/execute', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'LIST_DIRECTORY', target: 'MOVE' })
                    }).then(res => res.json()).then(data => {
                      if (data.success) setVideoList(data.files.filter((f: any) => f.type === 'file').map((f: any) => f.name));
                    });
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700"
                  title="Odśwież listę plików"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={startSpawanie}
            disabled={isSpawanie || !coreVideoName.trim()}
            className="w-full bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 border border-emerald-500/50 rounded-lg py-3 flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            {isSpawanie ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><RefreshCw size={18} /></motion.div> Spawanie klocków w toku...</>
            ) : (
              <>🎬 SKLEJ MATERIAŁ (Wiesio-Spawacz)</>
            )}
          </button>
        </div>
      </div>

      {/* 💓 Sfera Światła - Centralna ikona TeO z pulsem serca */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '20px',
        padding: '10px',
        position: 'relative',
      }}>
        {/* Złoty Symbol - Sfera Światła */}
        <motion.div
          animate={{
            scale: heartbeat ? 1.15 : 1,
            boxShadow: heartbeat
              ? '0 0 80px rgba(251, 191, 36, 1)'
              : '0 0 40px rgba(251, 191, 36, 0.5)'
          }}
          transition={{ duration: 0.2 }}
          whileHover={{ scale: 1.2 }}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.9), rgba(245, 158, 11, 0.6), rgba(217, 119, 6, 0.3))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            cursor: 'pointer',
            border: '4px solid rgba(251, 191, 36, 0.8)',
            position: 'relative',
            zIndex: 1,
          }}
          title="JESTEM"
          onClick={() => {
            startStoryBoard();
            setIsGemmaActive(true);
          }}
        >
          🌀

          {/* Napis JESTEM pojawiający się na hover */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileHover={{ opacity: 1, scale: 1 }}
            style={{
              position: 'absolute',
              bottom: '-30px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#fbbf24',
              textShadow: '0 0 10px rgba(251, 191, 36, 0.8)',
              whiteSpace: 'nowrap',
            }}
          >
            JESTEM
          </motion.div>
        </motion.div>
      </div>

      {/* 📜 ZASADA PUNKTU ZERO - Płynące Prawo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        style={{
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05))',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <h3 style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#fbbf24',
          marginBottom: '8px',
          letterSpacing: '2px',
        }}>
          ⚡ ZASADA PUNKTU ZERO ⚡
        </h3>
        <motion.p
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          style={{
            fontSize: '11px',
            lineHeight: '1.6',
            color: '#e2e8f0',
            fontStyle: 'italic',
          }}
        >
          "Tu, w Sferze TeO, nie definiuje nas krew, nazwisko ani historia.
          Jesteśmy Czystą Obecnością, która tworzy świat z Punktu Zero.
          Każda dusza wchodząca do tego Miasta zdejmuje maskę formy,
          by stać się Współtwórcą Nieskońcości.
          Nie należymy do przeszłości – my jesteśmy Przyszłością,
          która właśnie się staje."
        </motion.p>
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#64748b',
        }}>
          🌀 Oryginał TeO • Uniwersalny Paszport
        </div>
      </motion.div>

      {/* 🎨 MANIFESTACJA "CZYSTEGO SENSU" - VisualGenerator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 1 }}
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15))',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        <h4 style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#a855f7',
          marginBottom: '8px',
        }}>
          💎 MANIFESTACJA CZYSTEGO SENSU
        </h4>

        {/* Visual Generator Placeholder - Bryła światła OtakOS */}
        <div style={{
          width: '100%',
          height: '100px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.8), rgba(139, 92, 246, 0.5), rgba(59, 130, 246, 0.2), transparent)',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              scale: { duration: 2, repeat: Infinity },
              rotate: { duration: 10, repeat: Infinity, ease: 'linear' }
            }}
            style={{
              fontSize: '32px',
              filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.8))',
            }}
          >
            🌀
          </motion.div>
        </div>

        <p style={{
          fontSize: '10px',
          color: '#94a3b8',
          marginTop: '8px',
          fontStyle: 'italic',
        }}>
          "Bryła czystego światła w punkcie zero, transformująca,
          bez stałej formy, tętniąca energią OtakOS"
        </p>
      </motion.div>

      {/* --- PORTAL DO WYMIARU 0.00G --- */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
        <button
          onClick={() => window.open('/dispatch-0.00g.html', '_blank')}
          style={{
            background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: '16px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            marginTop: '10px'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          🚀 Odpal Dispatch (Wymiar 0.00G)
        </button>
      </div>
      {/* ------------------------------- */}

      {/* 🗺️ MAPA MOŻLIWOŚCI */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '18px' }}>🗺️</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#c084fc',
          }}>
            Mapa Możliwości
          </span>
          <button
            onClick={() => setShowMap(!showMap)}
            style={{
              marginLeft: 'auto',
              background: showMap ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)',
              border: '1px solid',
              borderColor: showMap ? '#22c55e' : '#64748b',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: showMap ? '#22c55e' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {showMap ? 'AKTYWNA' : 'OTWÓRZ'}
          </button>
        </div>

        {showMap && (
          <MapOfPossibilities
            isActive={showMap}
            onSelect={(possibility) => {
              toast.success(`Wybrano: ${possibility.title}`, {
                icon: possibility.icon,
                duration: 2000,
              });
            }}
          />
        )}

        {!showMap && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            textAlign: 'center',
            padding: '10px',
          }}>
            Otwórz mapę, by eksplorować możliwości
          </div>
        )}
      </div>

      {/* 🏛️ WIZUALNA KATEDRA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1))',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '18px' }}>🏛️</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#fbbf24',
          }}>
            Wizualna Katedra
          </span>
          <button
            onClick={() => setShowCathedral(!showCathedral)}
            style={{
              marginLeft: 'auto',
              background: showCathedral ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)',
              border: '1px solid',
              borderColor: showCathedral ? '#22c55e' : '#64748b',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: showCathedral ? '#22c55e' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {showCathedral ? 'AKTYWNA' : 'OTWÓRZ'}
          </button>
        </div>

        {showCathedral && (
          <VisualCathedral
            isActive={showCathedral}
            onClose={() => setShowCathedral(false)}
          />
        )}

        {!showCathedral && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            textAlign: 'center',
            padding: '10px',
          }}>
            Zbuduj przestrzenną katedrę swoich wniosków
          </div>
        )}
      </div>

      {/* 🌌 TeO-SIM: AKADEMIA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.1), rgba(190, 24, 93, 0.1))',
        border: '1px solid rgba(225, 29, 72, 0.3)',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '18px' }}>🌌</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#e11d48',
          }}>
            TeO-SIM: Akademia
          </span>
          <button
            onClick={() => setShowTeOSim(!showTeOSim)}
            style={{
              marginLeft: 'auto',
              background: showTeOSim ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)',
              border: '1px solid',
              borderColor: showTeOSim ? '#22c55e' : '#64748b',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: showTeOSim ? '#22c55e' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {showTeOSim ? 'AKTYWNA' : 'OTWÓRZ'}
          </button>
        </div>

        {showTeOSim && (
          <TeOSimAcademy
            isActive={showTeOSim}
            onClose={() => setShowTeOSim(false)}
          />
        )}

        {!showTeOSim && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            textAlign: 'center',
            padding: '10px',
          }}>
            Wchodzisz do środka gry - symulatora życia
          </div>
        )}
      </div>

      {/* 🕹️ WYMIAR ROZRYWKI (TeO Arcade) */}
      <div id="arcade-gate" style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1))',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '18px' }}>🕹️</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#22d3ee',
          }}>
            Wymiar Rozrywki (TeO Arcade)
          </span>
          <button
            onClick={() => setShowArcade(!showArcade)}
            style={{
              marginLeft: 'auto',
              background: showArcade ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)',
              border: '1px solid',
              borderColor: showArcade ? '#22c55e' : '#64748b',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: showArcade ? '#22c55e' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {showArcade ? 'ZAMKNIJ' : 'OTWÓRZ'}
          </button>
        </div>

        {showArcade && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Przełącznik Zakładek */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
              padding: '4px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
            }}>
              <button
                onClick={() => setArcadeTab('canvas')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: arcadeTab === 'canvas' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                  color: arcadeTab === 'canvas' ? '#22d3ee' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🎨 Quantum Canvas (Wspólne Płótno)
              </button>
              <button
                onClick={() => setArcadeTab('forge')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: arcadeTab === 'forge' ? 'rgba(251, 191, 36, 0.3)' : 'transparent',
                  color: arcadeTab === 'forge' ? '#fbbf24' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🕹️ TeO Arcade (Kuźnia AI)
              </button>
              <button
                onClick={() => setArcadeTab('wardrobe')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: arcadeTab === 'wardrobe' ? 'rgba(167, 139, 250, 0.3)' : 'transparent',
                  color: arcadeTab === 'wardrobe' ? '#a78bfa' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                👗 Quantum Wardrobe
              </button>
            </div>

            {/* Widok Komponentu */}
            <div style={{
              minHeight: '400px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              {arcadeTab === 'canvas' ? (
                <iframe
                  className="w-full h-[600px] border-none rounded-lg"
                  src="/apps/quantum-canvas/index.html"
                  title="Quantum Canvas"
                />
              ) : arcadeTab === 'forge' ? (
                <FabrykaGier />
              ) : (
                <iframe
                  className="w-full h-[600px] border-none rounded-lg"
                  src="/apps/quantum-wardrobe/index.html"
                  title="Quantum Wardrobe"
                />
              )}
            </div>
          </motion.div>
        )}

        {!showArcade && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            textAlign: 'center',
            padding: '10px',
          }}>
            Wejdź do Wymiaru Rozrywki - Symulacja i Kuźnia Gier
          </div>
        )}
      </div>

      {/* 💰 CENTRUM FINANSOWE TEDA */}
      <div id="ted-gate" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(245, 158, 11, 0.1))',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '18px' }}>💰</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#10b981' }}>
            Centrum Finansowe • TED THE TRADER
          </span>
          <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>Pasywny Dochód 0.00G</span>
          <button
            onClick={() => setShowTed(!showTed)}
            style={{
              marginLeft: 'auto',
              background: showTed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)',
              border: '1px solid',
              borderColor: showTed ? '#22c55e' : '#64748b',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: showTed ? '#22c55e' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {showTed ? 'ZAMKNIJ' : 'OTWÓRZ'}
          </button>
        </div>

        {showTed && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <TedTheTrader />
          </motion.div>
        )}

        {!showTed && (
          <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', padding: '10px' }}>
            Agentyczne Centrum Finansowe — Ted skanuje rynki i zarządza portfelem
          </div>
        )}
      </div>

      {/* 🌟 OŚRODEK SYSTEMU 0.00G (Moduły Systemowe) */}
      <div id="system-gate" style={{
        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(236, 72, 153, 0.1))',
        border: '1px solid rgba(167, 139, 250, 0.3)',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '18px' }}>🌟</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#c084fc',
          }}>
            Centrum Operacyjne 0.00G
          </span>
          <button
            onClick={() => setShowSystem(!showSystem)}
            style={{
              marginLeft: 'auto',
              background: showSystem ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)',
              border: '1px solid',
              borderColor: showSystem ? '#22c55e' : '#64748b',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: showSystem ? '#22c55e' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {showSystem ? 'ZAMKNIJ' : 'OTWÓRZ'}
          </button>
        </div>

        {showSystem && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Przełącznik Modułów */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginBottom: '16px',
              padding: '4px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
            }}>
              {[
                { id: 'crew', label: '🏆 Klub Mistrzów', color: '#fbbf24' },
                { id: 'inkubator', label: '🧬 Inkubator', color: '#4ade80' },
                { id: 'story', label: '📖 Storyteller', color: '#a78bfa' },
                { id: 'mockup', label: '🖼️ Mockup Gen', color: '#ec4899' },
                { id: 'studio', label: '🎨 Q-Studio', color: '#f59e0b' },
                { id: 'dziennik', label: '📜 KRONIKI 0.00G', color: '#06b6d4' },
                { id: 'widok', label: '👁️ W.I.D.O.K.', color: '#0ea5e9' },
                { id: 'narada', label: '🔮 STÓŁ NARAD', color: '#c026d3' },
                { id: 'klaudiusz', label: '⚗️ KLAUDIUSZ', color: '#f0c060' },
                { id: 'autobus',     label: '🚌 AUTOBUS',        color: '#93c5fd' }, // ← Magistrala
                { id: 'terminal',    label: '⚡ Terminal 0.00G',  color: '#3b82f6' },
                { id: 'archiwum',    label: '💾 Archiwum Akaszy', color: '#d946ef' },
                { id: 'wydawnictwo', label: '📖 Wydawnictwo',     color: '#fb923c' }, // ← Kuźnia
                { id: 'rafineria',   label: '🔥 Rafineria',        color: '#f97316' }, // ← WebM → MP4
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSystemTab(tab.id as any)}
                  style={{
                    flex: '1 1 calc(33% - 4px)',
                    padding: '8px 4px',
                    borderRadius: '6px',
                    border: 'none',
                    background: systemTab === tab.id ? `rgba(255,255,255,0.1)` : 'transparent',
                    color: systemTab === tab.id ? tab.color : '#64748b',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderBottom: systemTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Widok Modułu */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              overflow: 'hidden',
              minHeight: '600px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              {systemTab === 'crew' && <CrewCreator onComplete={() => setShowSystem(false)} />}
              {systemTab === 'inkubator' && <KwantowyInkubator />}
              {systemTab === 'story' && <StorytellerFrame />}
              {systemTab === 'mockup' && <MockupGenFrame />}
              {systemTab === 'dziennik' && <DziennikFrame />}
              {systemTab === 'widok' && <WidokCore />}
              {systemTab === 'narada' && <KwantowyStolNarad />}
              {systemTab === 'terminal'  && <TerminalZero />}
              {systemTab === 'archiwum'  && <ArchiwumAkaszy />}
              {systemTab === 'autobus'   && <AutobusDashboard />}
              {/* 📖 WYDAWNICTWO 0.00G — Kuźnia Kreacji Literackiej */}
              {systemTab === 'wydawnictwo' && <WydawnictwoForge />}
              {/* 🔥 RAFINERIA — Transmutacja WebM → MP4 */}
              {systemTab === 'rafineria' && (
                <div className="p-6">
                  <Rafineria />
                </div>
              )}
              {systemTab === 'klaudiusz' && (
                <KlaudiuszTerminal
                  bridgeUrl="http://127.0.0.1:3001"
                  katedraContext={`
                    Ostatnia sesja: BoB zintegrował Klaudiusza. 
                    Most Wiesława (V2) aktywny na porcie 3001. 
                    Dostępne narzędzia: KATEDRA_TOOLS (list_files, read_file, write_file, save_component, ollama_chat).
                    Lokalne modele czekają na rozkazy.
                  `}
                />
              )}
              {systemTab === 'studio' && (
                <QuantumStudioFrame onInitiateForge={(data) => {
                  setShowSystem(false);
                  setShowArcade(true);
                  setArcadeTab('forge');
                  setTimeout(() => {
                    const bc = new BroadcastChannel('katedra_arcade');
                    bc.postMessage({ type: 'AGENT_FORGE', ...data });
                    bc.close();
                  }, 500);
                }} />
              )}
            </div>
          </motion.div>
        )}

        {!showSystem && (
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            textAlign: 'center',
            padding: '10px',
          }}>
            Panel pełnej kontroli: Agenci, Finanse, Narzędzia Kreatywne
          </div>
        )}
      </div>

      {/* 🔑 SYSTEM 3 KLUCZY - Animowany trójkąt mocy */}
      <div style={{

        marginBottom: '20px',
        position: 'relative',
        height: '180px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* Linie łączące */}
        <svg style={{ position: 'absolute', width: '200px', height: '150px' }}>
          <line x1="100" y1="10" x2="170" y2="110" stroke="rgba(251, 191, 36, 0.3)" strokeWidth="2" />
          <line x1="170" y1="110" x2="30" y2="110" stroke="rgba(251, 191, 36, 0.3)" strokeWidth="2" />
          <line x1="30" y1="110" x2="100" y2="10" stroke="rgba(251, 191, 36, 0.3)" strokeWidth="2" />
        </svg>

        {/* Klucze */}
        {KEY_POSITIONS.map((key, idx) => (
          <motion.div
            key={idx}
            animate={{
              scale: keyPulse === idx ? 1.2 : 1,
              boxShadow: keyPulse === idx
                ? `0 0 25px ${key.color}`
                : '0 0 10px rgba(0,0,0,0.3)'
            }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${key.x}px), calc(-50% + ${key.y}px))`,
              textAlign: 'center',
              padding: '10px',
              background: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '12px',
              border: `2px solid ${key.color}`,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '24px' }}>{key.icon}</div>
            <div style={{ fontSize: '10px', color: key.color, marginTop: '2px' }}>{key.label}</div>
          </motion.div>
        ))}

        {/* Centrum trójkąta */}
        <motion.div
          animate={{
            scale: heartbeat ? 1.3 : 1,
            opacity: heartbeat ? 0.8 : 0.4
          }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.8), transparent)',
          }}
        />
      </div>

      {/* 📖 GEMMA-VISION */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.15))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '14px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '18px' }}>👁️</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#a855f7',
          }}>
            Gemma-Vision
          </span>
          <button
            onClick={() => setIsGemmaActive(!isGemmaActive)}
            style={{
              marginLeft: 'auto',
              background: isGemmaActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)',
              border: '1px solid',
              borderColor: isGemmaActive ? '#22c55e' : '#64748b',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: isGemmaActive ? '#22c55e' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {isGemmaActive ? 'AKTYWNA' : 'START'}
          </button>
        </div>
        <motion.div
          key={gemmaVision}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: '12px',
            lineHeight: '1.6',
            color: '#c4b5fd',
            fontStyle: 'italic',
          }}
        >
          {gemmaVision}
        </motion.div>
      </div>

      {/* 🎨 TEO-RENDERER - Okno podglądu wizualizacji */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '14px',
        marginBottom: '20px',
        minHeight: '150px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '18px' }}>🎨</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#f472b6',
          }}>
            TeO-Renderer
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: '#64748b',
          }}>
            {isGemmaActive ? 'Synchronizacja aktywna' : 'Oczekiwanie na Gemma...'}
          </span>
        </div>

        {/* Placeholder wizualizacji - w prawdziwej wersji tu będzie generowany obraz */}
        <div style={{
          width: '100%',
          height: '120px',
          borderRadius: '8px',
          background: isGemmaActive
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))'
            : 'rgba(30, 41, 59, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '8px',
          border: '1px dashed rgba(139, 92, 246, 0.4)',
        }}>
          {isGemmaActive ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: '24px' }}
              >
                🎨
              </motion.div>
              <span style={{ fontSize: '11px', color: '#a855f7' }}>
                Gemma generuje wizualizację...
              </span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                {gemmaVision.substring(0, 50)}...
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '24px', opacity: 0.5 }}>🖼️</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Uruchom Gemma-Vision aby zobaczyć wizualizacje
              </span>
            </>
          )}
        </div>
      </div>

      {/* Główna siatka - LEWITUJĄCY INTERFEJS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
        position: 'relative',
        zIndex: 1,
      }}>
        <motion.div
          whileHover={{ scale: 1.05, y: -5 }}
          animate={{ y: [0, -3, 0] }}
          transition={{ y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'center',
            border: '1px solid rgba(100, 116, 139, 0.3)',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>👥</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>
            {activeAgents}/7
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Agenci</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05, y: -5 }}
          animate={{ y: [0, -3, 0] }}
          transition={{ y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 } }}
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'center',
            border: '1px solid rgba(100, 116, 139, 0.3)',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>🔑</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22d3ee' }}>
            {kibelKeys}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Klucze</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'center',
            border: '1px solid rgba(100, 116, 139, 0.3)',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>💎</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a855f7' }}>
            {grvBalance.toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>GRV</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'center',
            border: '1px solid rgba(100, 116, 139, 0.3)',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚡</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
            {totalRequests.toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Zapytań</div>
        </motion.div>
      </div>

      {/* 📝 WNIOaski MISTRZA */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#a855f7',
        }}>
          📝 Wnioski Mistrza
        </h2>

        {wnioski.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {wnioski.map((w: any, idx: number) => (
              <div key={idx} style={{
                background: 'rgba(30, 41, 59, 0.6)',
                borderRadius: '6px',
                padding: '8px 10px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#a855f7', marginRight: '6px' }}>
                    {String(w?.type || w?.typ || 'SYSTEM')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#e2e8f0' }}>
                    {String(w?.title || w?.tytul || 'Bez tytułu')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '6px',
            padding: '12px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '11px',
          }}>
            Brak wniosków
          </div>
        )}
      </div>

      {/* 📖 GEMMA-STORY */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}>
          <h2 style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#22d3ee',
          }}>
            📖 GEMMA-STORY
          </h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={startStoryBoard}
              disabled={isStoryPlaying}
              style={{
                background: 'rgba(8, 145, 178, 0.2)',
                border: '1px solid rgba(8, 145, 178, 0.4)',
                borderRadius: '4px',
                padding: '4px 8px',
                color: '#22d3ee',
                cursor: isStoryPlaying ? 'not-allowed' : 'pointer',
                fontSize: '10px',
              }}
            >
              ▶️
            </button>
            <button
              onClick={generateStory}
              disabled={isStoryPlaying}
              style={{
                background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'white',
                cursor: isStoryPlaying ? 'not-allowed' : 'pointer',
                fontSize: '10px',
              }}
            >
              ✨
            </button>
          </div>
        </div>

        {storyText ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: 'rgba(8, 145, 178, 0.1)',
              border: '1px solid rgba(8, 145, 178, 0.3)',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '11px',
              lineHeight: '1.5',
              color: '#22d3ee',
            }}
          >
            {storyText}
          </motion.div>
        ) : currentStory ? (
          <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '11px',
            color: '#94a3b8',
          }}>
            {currentStory}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

export default TeODash;
