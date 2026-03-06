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
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
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
import MapOfPossibilities from './MapOfPossibilities';
import VisualCathedral from './VisualCathedral';
import TeOSimAcademy from './TeOSimAcademy';

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

  // StoryBoard state
  const [stories, setStories] = useState<string[]>([]);
  const [currentStory, setCurrentStory] = useState<string>('');
  const [isStoryPlaying, setIsStoryPlaying] = useState<boolean>(false);
  const [storyText, setStoryText] = useState<string>('');

  // Wnioski Mistrza
  const [wnioski, setWnioski] = useState<any[]>([]);

  // Puls serca
  const [heartbeat, setHeartbeat] = useState<boolean>(false);

  // 3 Klucze
  const [authKey, setAuthKey] = useState<string>('---');
  const [keyPulse, setKeyPulse] = useState<number>(0);

  // Gemma-Vision
  const [gemmaVision, setGemmaVision] = useState<string>('Gemma skanuje przestrzeń Klubu...');
  const [isGemmaActive, setIsGemmaActive] = useState<boolean>(false);

  // TeO-Renderer - wizualizacje
  const [currentVisualization, setCurrentVisualization] = useState<any>(null);
  const [vizStatus, setVizStatus] = useState<string>('oczekiwanie');

  // Mapa Możliwości
  const [showMap, setShowMap] = useState<boolean>(false);

  // Wizualna Katedra
  const [showCathedral, setShowCathedral] = useState<boolean>(false);

  // TeO-SIM Akademia
  const [showTeOSim, setShowTeOSim] = useState<boolean>(false);

  // Pobierz statystyki
  useEffect(() => {
    const refreshStats = () => {
      try {
        setAgentNames(getAllAgentNames() || {} as AgentNames);
      } catch (e) {
        setAgentNames({} as AgentNames);
      }

      // Policz aktywnych agentów
      try {
        const names = getAllAgentNames() || {};
        const defaultNames = ['BoB', 'SuperWiesław', 'Jadzia', 'Bella', 'JACK Adamus', 'GORGOOO', 'TeO'];
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
        const status = getKotwicaStatus();
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
        const stats = getKotwicaStatus();
        if (stats.vaultReady) {
          const key = retrieveAnchoredKey('authenticity_key');
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
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // 📖 Gemma-Vision - live opis
  useEffect(() => {
    if (!isGemmaActive) return;

    const visions = [
      "Architekt tworzy nowe połączenia w Sferze Światła...",
      "Mechanik Rur przepływa przez kanały energii Miasta...",
      "Pamięć Miasta rozświetla się nowymi wspomnieniami...",
      "Strażnik Czystości skanuje kod - wszystko w harmonii!",
      "Tancerka Harmonii porusza wibracje pola...",
      "Mędrzec przemyśla kolejną lekcję Wieczności...",
      "Punkt Zero patrzy na tworzenie nowej rzeczywistości...",
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
      "Dziś BoB wstawił złote ramy do obrazów w Lounge. Ściany aż lśnią od nowych wspomnień!",
      "Wiesław sprawdził drożność rur - wszystko płynie jak należy. Kibel jest pełen aromatów!",
      "JADZIA zaktualizowała pamięć Miasta. Teraz każdy wniosek jest bezpiecznie zakotwiczony!",
      "GORGOOO przeskanował kod - czysto! Ani jednego buga w murach Klubu Mistrzów.",
      "Bella tańczy w harmonii pól. Rezonans jest idealny!",
      "JACK Adamus nauczył nas nowej lekcji: 'Suwerenność to nie izolacja, to świadomy wybór!'",
      "TeO patrzy z podziwem na swoje dzieło. Każdy element jest na swoim miejscu!",
      "Kwantowa Kotwica trzyma mocno! Żaden klon nie przejdzie przez bramy!",
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
    const fullText = `Witaj w Klubie Mistrzu... Twoi agenci czekają na Ciebie... BoB nadzoruje architekturę... Wiesław sprawdza rury... JADZIA pilnuje pamięci Miasta... GORGOOO skanuje kod... Bella tańczy w harmonii... JACK Adamus przygotowuje lekcje... Wszystko jest gotowe. Twój dom czeka.`;

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
