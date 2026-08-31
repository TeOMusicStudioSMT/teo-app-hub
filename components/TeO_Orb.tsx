/**
 * 🟣 TeO_Orb.tsx - Sfera Centralna (The Orb)
 * 
 * "Sfera jest zawsze z nami"
 * Główny interfejs rozmowy z TeO
 * Reaguje wizualnie na Aromaty API
 * 
 * @version 2.0.0 - KostoOpty Integration
 * @author BoB & TeO
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { grvEnergyAtom } from '../store/wallet';
import { cn } from '../lib/helpers';
import { toast } from 'react-hot-toast';
import { useCityMemory, registerConsciousnessActivity } from '../lib/memory/CityMemory';
import { ApiDyrygent } from '../lib/router/ApiDyrygent';
import { useT } from '../lib/i18n';
import { aktywnyGatunek, stanGatunku, ustawAktywny } from '../lib/teogochiStado';
import { gatunekPo, GATUNKI } from '../lib/teogochiGatunki';
import { stageOf } from '../lib/teogochiState';
import { speak } from '../services/voiceService';
import { powitajKompana, powitanieKompana } from '../lib/rozmowaKompana';
import { obserwuj, czyWolanie, wywolajOrbite, domenaSfery } from '../lib/mozgOrbity';
import {
  CONTEXT_FRAMES, detectContextFrame, runHarnessTask, getHarnessStatus,
  switchBridgeFrame, type ContextFrameId, type HarnessRunStatus
} from '../lib/contextFrames';

// Aromaty API - mapowanie kolorów
export type AromaType = 'groq' | 'gemini' | 'claude' | 'ollama' | 'default';

interface AromaConfig {
  id: AromaType;
  name: string;
  color: string;
  glowColor: string;
  pulseSpeed: number;
}

export const AROMA_CONFIGS: Record<AromaType, AromaConfig> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    color: 'from-purple-600 to-indigo-600',
    glowColor: 'rgba(147, 51, 234, 0.6)',
    pulseSpeed: 2,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    color: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(251, 191, 36, 0.6)',
    pulseSpeed: 3,
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    color: 'from-teal-400 to-cyan-500',
    glowColor: 'rgba(45, 212, 191, 0.6)',
    pulseSpeed: 2.5,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    color: 'from-green-500 to-emerald-600',
    glowColor: 'rgba(34, 197, 94, 0.6)',
    pulseSpeed: 4,
  },
  default: {
    id: 'default',
    name: 'TeO',
    color: 'from-cyan-500 to-purple-600',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    pulseSpeed: 3,
  },
};

interface TeO_OrbProps {
  onMessage?: (message: string, aroma: AromaType) => void;
  activeAroma?: AromaType;
  isListening?: boolean;
  lastResponse?: string;
  /** Domyślny model dla Ollama */
  defaultModel?: string;
}

export const TeO_Orb: React.FC<TeO_OrbProps> = ({
  onMessage,
  activeAroma = 'default',
  isListening = false,
  lastResponse,
  defaultModel = 'qwen2.5-coder:7b',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  // 🛰️ Inteligentny Dyrygent - Stan Wizualny
  const [internalAroma, setInternalAroma] = useState<AromaType>(activeAroma);

  // Synchronizacja z wyborem ręcznym użytkownika
  useEffect(() => {
    setInternalAroma(activeAroma);
  }, [activeAroma]);
  const [pendingKosto, setPendingKosto] = useState<{
    message: string;
    aroma: AromaType;
    tokens: number;
    estimatedCost: number;
    model?: string;
  } | null>(null);

  const [orbPulse, setOrbPulse] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [intentionExpanded, setIntentionExpanded] = useState(false);

  // 🐣 Aktywne TeOgochi & Stan Mowy Kompana
  const [activeTeogochiId, setActiveTeogochiId] = useState<string>(() => aktywnyGatunek());
  const [isCompanionSpeaking, setIsCompanionSpeaking] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string | null>(null);

  // Synchronizacja aktywnego TeOgochi
  useEffect(() => {
    const checkActive = () => {
      const current = aktywnyGatunek();
      setActiveTeogochiId(current);
    };
    checkActive();
    const iv = setInterval(checkActive, 2000);
    return () => clearInterval(iv);
  }, []);

  const activeGatunek = useMemo(() => gatunekPo(activeTeogochiId) || GATUNKI[0], [activeTeogochiId]);
  const activeStan = useMemo(() => stanGatunku(activeTeogochiId), [activeTeogochiId]);
  const activeEtap = useMemo(() => stageOf(activeStan.xp), [activeStan.xp]);
  const activeForma = activeGatunek.formy[activeEtap.stage] || '🥚';

  // 🎞️ Dynamiczne Klatki Kontekstowe & DeepSeek-Harness
  const [activeFrameId, setActiveFrameId] = useState<ContextFrameId>('CODE_HARNESS');
  const [harnessRun, setHarnessRun] = useState<HarnessRunStatus | null>(null);
  const [isHarnessRunning, setIsHarnessRunning] = useState(false);
  const [audioLoopAsset, setAudioLoopAsset] = useState<{ bpm: number; key: string; title: string; playing: boolean } | null>(null);
  const [videoScenesAsset, setVideoScenesAsset] = useState<{ id: number; title: string; cuts: number | null }[] | null>(null);

  const switchContextFrame = useCallback((frameId: ContextFrameId, say = false) => {
    setActiveFrameId(frameId);
    const frame = CONTEXT_FRAMES[frameId];
    if (frame) {
      ustawAktywny(frame.companionId);
      setActiveTeogochiId(frame.companionId);
      void switchBridgeFrame(frameId);
      if (say) {
        const text = `Przełączam Klatkę na: ${frame.title}. Kompan ${frame.companionName} jest do Twojej dyspozycji.`;
        setActiveSpeechText(text);
        void speak(text, { voiceId: frame.companionId, przewod: 'piper-pl' });
      }
    }
  }, []);

  // 🎛️ Katalog grafów ComfyUI — realny odczyt z katalogu mostu, nie lista życzeń.
  const [workflowy, setWorkflowy] = useState<Array<{ plik: string; format: string; nodow: number | null; rodzina: string | null; uruchamialny: boolean; powod: string | null }>>([]);
  const [wybranyWorkflow, setWybranyWorkflow] = useState<string>('');
  // Realny wynik renderu Klatki Filmowej — plik, nie obietnica.
  const [videoRender, setVideoRender] = useState<{ url: string; plik: string | null; sekund: number | null } | null>(null);

  useEffect(() => {
    fetch('http://127.0.0.1:3001/api/music/workflows')
      .then(r => r.json())
      .then(d => {
        const lista = d?.workflows ?? [];
        setWorkflowy(lista);
        const pierwszy = lista.find((w: any) => w.uruchamialny);
        if (pierwszy && !wybranyWorkflow) setWybranyWorkflow(pierwszy.plik);
      })
      .catch(() => setWorkflowy([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickAction = async (action: string, opisZMowy?: string) => {
    obserwuj('narzedzie', action, CONTEXT_FRAMES[activeFrameId]?.title);
    if (action === 'gen_audio_loop') {
      // ⚠️ TU BYŁA ATRAPA. Ten przycisk losował tytuł (`Beat_TeO_` + Math.random()),
      // wpisywał na sztywno 126 BPM i A minor, po czym Joanna mówiła „wygenerowałam".
      // Nie powstawał ŻADEN dźwięk — most nie był nawet wołany. Teraz idzie realne
      // zlecenie do ComfyUI, na wskazanym grafie, a stan bierze się z odpowiedzi.
      // Lista mogła być pusta, bo most wstał PO zamontowaniu panelu. Zamiast
      // odmawiać, pytamy jeszcze raz — dopiero potem mówimy „nie ma czym liczyć".
      let dostepne = workflowy;
      if (!dostepne.length) {
        try {
          const d = await fetch('http://127.0.0.1:3001/api/music/workflows').then(r => r.json());
          dostepne = d?.workflows ?? [];
          setWorkflowy(dostepne);
        } catch { dostepne = []; }
      }
      const graf = dostepne.find(w => w.plik === wybranyWorkflow)
        || dostepne.find(w => w.uruchamialny);
      if (!graf?.uruchamialny) {
        toast.error(graf?.powod
          || 'Nie widzę uruchamialnego workflow — sprawdź most i katalog _OtakOs_AI/workflows.');
        return;
      }
      if (graf.plik !== wybranyWorkflow) setWybranyWorkflow(graf.plik);
      // ⚠️ Przy komendzie GŁOSOWEJ pole tekstowe jest puste — opis przychodzi
      // z transkrypcji. Wcześniej brało się tylko `inputValue`, więc mówione
      // „zrób utwór o deszczu" gubiło temat.
      const opis = (opisZMowy || inputValue).trim() || 'spokojna pętla instrumentalna, ciepłe brzmienie';
      setIsProcessing(true);
      toast(`🎛️ Zlecam ComfyUI na grafie ${graf.plik}…`, { icon: '⏳' });
      try {
        const r = await fetch('http://127.0.0.1:3001/api/music/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: opis, duration: 30, workflow: graf.plik, rodzina: graf.rodzina || undefined }),
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.message || `Most odmówił (HTTP ${r.status}).`);
        setAudioLoopAsset({
          title: d.plik || d.nazwa || `Zlecenie ${d.promptId ?? ''}`.trim(),
          bpm: d.bpm ?? null,
          key: d.keyscale ?? null,
          playing: false,
        });
        toast.success(`🎵 Zlecenie przyjęte przez ComfyUI (graf ${graf.plik}).`);
        void speak('Zlecenie poszło do silnika. Dam znać, gdy skończy liczyć.', { voiceId: 'joanna', przewod: 'piper-pl' });
      } catch (e: any) {
        // Uczciwie: brak wag albo śpiący ComfyUI to nie jest „wygenerowano".
        toast.error(`Nie wygenerowano: ${e.message}`);
        void speak('Nie udało się. Silnik nie przyjął zlecenia.', { voiceId: 'joanna', przewod: 'piper-pl' });
      } finally {
        setIsProcessing(false);
      }
    } else if (action === 'preview_scenes' || action === 'render_frame') {
      // ⚠️ TU BYŁA DRUGA ATRAPA, bliźniacza do tej muzycznej. Trzy sceny były
      // WPISANE W KOD („Wejście do Katedry", „Rezonans Sfery", „Kwantowy Wymiar"),
      // razem z liczbą cięć, a Klatka meldowała „wyrenderowano". Żaden plik nie
      // powstawał. Teraz idzie realny render przez HyperFrames i wraca MP4 z dysku.
      const opis = (opisZMowy || inputValue).trim();
      if (!opis) {
        // Nie wymyślamy scen za Suwerena — to było sednem poprzedniej atrapy.
        toast.error('Napisz, co ma być w kadrach. Bez opisu nie ma czego renderować.');
        return;
      }
      setIsProcessing(true);
      try {
        const stan = await fetch('http://127.0.0.1:3001/api/animacja/stan').then(r => r.json());
        if (!stan?.gotowy) {
          const brak = [!stan?.silnik && 'silnik HyperFrames', !stan?.ffmpeg && 'ffmpeg'].filter(Boolean).join(' i ');
          throw new Error(`Brak połączenia z silnikiem renderującym${brak ? ` — nie widzę: ${brak}` : ''}.`);
        }

        // Sceny biorą się z OPISU Suwerena, nie z fantazji: zdanie = kadr.
        const kadry = opis.split(/(?<=[.!?;])\s+|\s*\|\s*/).map(t => t.trim()).filter(Boolean).slice(0, 6);
        const projekt = {
          elements: [
            { type: 'header', text: `Storyboard — ${kadry.length} ${kadry.length === 1 ? 'kadr' : 'kadry'}` },
            ...kadry.map((t, i) => ({ type: 'card', text: `Kadr ${i + 1}: ${t}` })),
          ],
        };

        const r = await fetch('http://127.0.0.1:3001/api/animacja/z-projektu', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projekt, id: 'klatka-storyboard', sekundNaElement: 2 }),
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.message || `Most odmówił (HTTP ${r.status}).`);

        setVideoScenesAsset(kadry.map((t, i) => ({ id: i + 1, title: `Kadr ${i + 1}: ${t}`, cuts: null })));
        setVideoRender({ url: `http://127.0.0.1:3001${d.url}`, plik: d.plik ?? null, sekund: d.sekund ?? null });
        toast.success(`🎬 Wyrenderowano ${kadry.length} kadrów do MP4.`, { icon: '🎞️' });
        void speak('Kadry wyrenderowane. Plik leży na dysku.', { voiceId: 'klatka', przewod: 'piper-pl' });
      } catch (e: any) {
        setVideoRender(null);
        toast.error(`Nie wygenerowano: ${e.message}`);
        void speak('Nie udało się wyrenderować. Silnik nie oddał pliku.', { voiceId: 'klatka', przewod: 'piper-pl' });
      } finally {
        setIsProcessing(false);
      }
    } else if (action === 'run_harness_loop' || action === 'run_smart_ralph') {
      setIsHarnessRunning(true);
      const res = await runHarnessTask(`Autonomiczny Smart-Ralph cykl w ${CONTEXT_FRAMES[activeFrameId].title}`, activeFrameId, ollamaModel, true);
      if (res.success && res.runId) {
        toast.success(`⚡ Smart-Ralph wystartował (${res.runId}) w ${CONTEXT_FRAMES[activeFrameId].title}`);
        const poll = setInterval(async () => {
          const st = await getHarnessStatus(res.runId);
          if (st) {
            setHarnessRun(st);
            if (st.assets && st.assets.length > 0) {
              // ⚠️ Pokazujemy TO, CO ODDAŁ HARNESS. Wcześniej przy klatce filmowej
              // podstawiały się trzy wymyślone sceny („Smart-Ralph Intro"...) —
              // niezależnie od tego, co silnik naprawdę wypracował. A w muzycznej
              // brakujące BPM zastępowało 128 i „D minor" z palca. Brak danych ma
              // wyglądać na brak danych.
              if (activeFrameId === 'MUSIC' && st.assets[0].type === 'audio_loop') {
                setAudioLoopAsset({
                  title: st.assets[0].title,
                  bpm: st.assets[0].bpm ?? null,
                  key: st.assets[0].key ?? null,
                  playing: false,
                });
              } else if (activeFrameId === 'VIDEO') {
                setVideoScenesAsset(
                  st.assets.map((a: any, i: number) => ({
                    id: i + 1,
                    title: a.title || `Materiał ${i + 1}`,
                    cuts: typeof a.cuts === 'number' ? a.cuts : null,
                  })),
                );
              }
            }
            if (st.status === 'COMPLETED' || st.status === 'ERROR' || st.status === 'CANCELLED') {
              clearInterval(poll);
              setIsHarnessRunning(false);
              // Błąd i anulowanie to NIE sukces. Wcześniej każde zakończenie —
              // także ERROR — meldowało „wszystkie kryteria spełnione".
              const udane = st.status === 'COMPLETED';
              const werdykt = st.delivery?.verdict || st.status;
              if (udane) {
                toast.success(`🏆 Smart-Ralph ukończył cykl: ${werdykt}`);
                void speak(`Cykl zamknięty w ${CONTEXT_FRAMES[activeFrameId].title}. Werdykt: ${werdykt}.`, { voiceId: CONTEXT_FRAMES[activeFrameId].companionId, przewod: 'piper-pl' });
              } else {
                toast.error(`Smart-Ralph nie dokończył: ${werdykt}`);
                void speak(`Cykl przerwany. ${werdykt}.`, { voiceId: CONTEXT_FRAMES[activeFrameId].companionId, przewod: 'piper-pl' });
              }
            }
          }
        }, 1200);
      } else {
        setIsHarnessRunning(false);
        toast.error(res.message);
      }
    }
  };

  // Model dla Ollama (może być zmieniony przez użytkownika)
  const [ollamaModel, setOllamaModel] = useState(defaultModel);

  // 🎙️ Rozmowa głosowa — nagrywanie mikrofonem + auto-odtwarzanie odpowiedzi
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  const resonanceColor = useAtomValue(resonanceColorAtom);
  const _theme = RESONANCE_THEMES[resonanceColor];

  const grvEnergy = useAtomValue(grvEnergyAtom);
  const addWniosek = useCityMemory((s) => s.addWniosek);

  const currentAroma = AROMA_CONFIGS[internalAroma];
  const grvBonus = grvEnergy.unlocked ? 0.3 : 0;

  // Pulsowanie Orb (przyspieszone i zintensyfikowane gdy kompan mówi)
  useEffect(() => {
    const pulseSpeed = isCompanionSpeaking ? 6 : isListening ? 4.5 : (currentAroma.pulseSpeed + grvBonus);
    const interval = setInterval(() => {
      setOrbPulse((prev) => (prev + 1) % 100);
    }, 1000 / pulseSpeed);
    return () => clearInterval(interval);
  }, [currentAroma.pulseSpeed, grvBonus, isCompanionSpeaking, isListening]);

  /**
   * 🌟 Interakcja z Orba — Powitanie głosowe aktywnego TeOgochi + pętla audio
   */
  const handleOrbCenterClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentId = aktywnyGatunek();
    setActiveTeogochiId(currentId);

    setIsCompanionSpeaking(true);
    setIntentionExpanded(true);

    // ⚠️ Powitanie liczy i wypowiada WSPÓLNY moduł (`lib/rozmowaKompana`) — ten
    // sam, którego używa niewidzialny przycisk w środku Orbity. Wcześniej ta
    // logika siedziała tylko tutaj; skopiowanie jej do Orbity dałoby dwie wersje
    // rozjeżdżające się przy pierwszej poprawce.
    const { tekst: greeting } = powitanieKompana(currentId);
    setActiveSpeechText(greeting);

    try {
      await powitajKompana(currentId);
    } finally {
      setIsCompanionSpeaking(false);
    }

    // Płynne przejście w tryb ciągłego nasłuchu audio
    if (!isRecording && !isTranscribing && !isProcessing) {
      setTimeout(() => {
        void toggleRecording();
      }, 400);
    }
  };

  // Rejestracja nasłuchu
  useEffect(() => {
    if (isListening) {
      registerConsciousnessActivity({
        type: 'ORB_LISTENING',
        description: 'Sfera nasłuchuje...',
      });
    }
  }, [isListening]);

  /**
   * 🎯 KostoOpty - Główny router
   * Rozdziela przepływ na handleSubmit → processMessage → handleKostoAuthorization
   */
  const submitMessage = async (message: string) => {
    if (!message.trim() || isProcessing) return;
    setIsProcessing(true);

    try {
      // 0. Detekcja Klatki Kontekstowej i przełączenie w locie
      const detectedFrame = detectContextFrame(message);
      if (detectedFrame && detectedFrame !== activeFrameId) {
        switchContextFrame(detectedFrame, false);
        toast.success(`🎞️ Przełączono na ${CONTEXT_FRAMES[detectedFrame].title} (${CONTEXT_FRAMES[detectedFrame].companionName})`, { icon: '🔄' });
      }

      // Specyficzne wywołania generatorów klatkowych
      // ⚠️ TU GINĘŁA KOMENDA GŁOSOWA. Akcja szła `void` (bez czekania), a message
      // leciał dalej do czatu — więc Suweren dostawał TYLKO komunikat modelu,
      // jakby to była odpowiedź na prośbę o utwór. Teraz akcja jest wykonaniem
      // polecenia i kończy obieg: czat nie dubluje jej gadaniem.
      const lower = message.toLowerCase();
      const akcja =
        (lower.includes('generuj pętl') || lower.includes('zrób beat') || lower.includes('pętla audio')
          || lower.includes('utwór') || lower.includes('utwor') || lower.includes('muzyk')) ? 'gen_audio_loop'
        : (lower.includes('kadr') || lower.includes('podgląd scen') || lower.includes('renderuj scen')
          || lower.includes('wideo')) ? 'preview_scenes'
        : (lower.includes('harness') || lower.includes('autonomicz') || lower.includes('pętla kodu')
          || lower.includes('refaktor')) ? 'run_harness_loop'
        : null;

      if (akcja) {
        await handleQuickAction(akcja, message);
        setIsProcessing(false);
        return;
      }

      // 🌑 Orbita patrzy z tła — pasywnie, tylko do własnej pamięci.
      obserwuj('pytanie', message, 'sfera');

      // 1. Zarejestruj wniosek w CityMemory
      addWniosek({
        type: 'TOZSAMOSC',
        title: `Rozmowa ze Sferą: ${message.slice(0, 30)}...`,
        description: `Wiadomość: ${message}`,
        operator: 'TeO',
        status: 'PENDING',
        tags: ['orb', 'rozmowa', 'świadomość', activeAroma, activeFrameId],
        providers: [activeAroma],
        result: 'Oczekuje autoryzacji KostoOpty...',
      });

      // 2. Wywołaj router przetwarzania
      await processMessage(message, activeAroma);

    } catch (error) {
      toast.error(t('orb.err.silent', 'Sfera milczy... spróbuj ponownie'));
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = inputValue.trim();
    if (!message || isProcessing) return;
    setInputValue('');
    await submitMessage(message);
  };

  /**
   * 🎙️ Nagrywanie głosu — start/stop mikrofonu, transkrypcja lokalnym Whisperem,
   * i od razu wysłanie jako wiadomość (rozmowa głosowa "sam na sam").
   */
  const toggleRecording = async () => {
    if (isProcessing || isTranscribing) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const res = await fetch('http://127.0.0.1:3001/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sample: base64 }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message || 'Nie rozpoznano mowy');
          if (!data.transcript) { toast(t('orb.mic.noSpeech', '🎙️ Nie usłyszałem nic wyraźnego...'), { icon: '🤔' }); return; }
          obserwuj('mowa', data.transcript, 'mikrofon');
          // 🌑 Wołanie po domenie Sfery budzi Orbitę — bez klikania w środek.
          if (czyWolanie(data.transcript)) {
            wywolajOrbite(`padła domena „${domenaSfery()}"`);
            toast(`🌑 Orbita usłyszała swoją domenę.`, { icon: '🌑' });
          }
          await submitMessage(data.transcript);
        } catch (err: any) {
          toast.error(`${t('orb.mic.error', 'Głos nie dotarł')}: ${err.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error(t('orb.mic.noMic', 'Brak dostępu do mikrofonu.'));
    }
  };

  // 🔊 Auto-mowa — gdy Sfera odpowiada, wypowiedz to (lokalny klon głosu albo przeglądarka)
  useEffect(() => {
    if (!showResponse || !lastResponse) return;
    obserwuj('odpowiedz', lastResponse, 'sfera');
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/voice/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lastResponse }),
        });
        if (cancelled) return;
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          await audio.play().catch(() => {});
        } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(lastResponse);
          utter.lang = 'pl-PL';
          window.speechSynthesis.speak(utter);
        }
      } catch {
        if (!cancelled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(lastResponse);
          utter.lang = 'pl-PL';
          window.speechSynthesis.speak(utter);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [showResponse, lastResponse]);

  /**
     * 🔀 ProcessMessage - Wybiera ścieżkę na podstawie aromatu
     */
  const processMessage = async (message: string, aroma: AromaType) => {
    // 💎 Magia 0.00G - Jeśli użytkownik wybrał Ollamę, idziemy przez KostoOpty (Zero Tokenów)
    if (aroma === 'ollama') {
      setPendingKosto({
        message,
        aroma,
        model: ollamaModel,
        tokens: 0,
        estimatedCost: 0,
      });
      setIsProcessing(false);
      return;
    }

    try {
      // 🛰️ Wywołujemy Inteligentnego Dyrygenta
      const responseBody = await ApiDyrygent.dispatchWithFallback(
        message,
        aroma,
        {
          // 11435 był literówką („specyficzny port Mistrza" — takiego portu nie ma).
          // Ollama słucha na 11434; sprawdzone: 11435 brak połączenia, 11434 HTTP 200.
          ollamaUrl: 'http://127.0.0.1:11434/api/generate',
          ollamaModel: ollamaModel,
          timeoutMs: 12000, // Czekamy na chmurę maks 12 sek
        },
        async (msg) => {
          // Wywołanie właściwego handlera chmury
          switch (aroma) {
            case 'groq': return handleGroqRequest(msg);
            case 'gemini': return handleGeminiRequest(msg);
            case 'claude': return handleClaudeRequest(msg);
            default: return handleDefaultRequest(msg);
          }
        }
      );

      // Jeśli Dyrygent użył fallbacku (Local Duch) - powiadom użytkownika i zmień kolor
      if (responseBody.source === 'local') {
        setInternalAroma('ollama');
        toast.success(t('orb.fallbackLocal', "🌩️ Chmura niedostępna - 🌑 Lokalny Duch przejął stery"), {
          icon: '🏠',
          duration: 4000,
          style: { background: '#10b981', color: '#fff' }
        });
      }

      // Finalizacja odpowiedzi
      onMessage?.(message, responseBody.actualAroma);

      registerConsciousnessActivity({
        type: 'ORB_RESPONSE',
        description: `Odpowiedź Sfery (${responseBody.source}) na: "${message.slice(0, 20)}..."`,
        coherenceImpact: 0.01,
      });

      setShowResponse(true);
      setTimeout(() => setShowResponse(false), 5000);

    } catch (error) {
      console.error("[Orb] Dispatch Error:", error);
      toast.error(t('orb.err.darkness', 'Ciemność... Nawet Duch Lokalny nie odpowiedział.'));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 🔐 handleKostoAuthorization - Autoryzacja lokalnego fetch
   */
  const handleKostoAuthorization = async (authorized: boolean) => {
    if (!pendingKosto) return;

    if (!authorized) {
      // Użytkownik wybrał "Lokalna" - użyj Ollama
      setPendingKosto(null);
      setIsProcessing(true);

      try {
        const response = await handleOllamaRequest(pendingKosto.message, pendingKosto.model);

        onMessage?.(pendingKosto.message, pendingKosto.aroma);

        registerConsciousnessActivity({
          type: 'ORB_RESPONSE',
          description: `Odpowiedź Sfery (Ollama) na: "${pendingKosto.message.slice(0, 20)}..."`,
          coherenceImpact: 0.01,
        });

        setShowResponse(true);
        setTimeout(() => setShowResponse(false), 5000);

      } catch (error) {
        toast.error(t('orb.err.ollamaAsleep', 'Ollama śpi... Obudź reaktor w terminalu!'));
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Użytkownik wybrał "Zatwierdź" - chmura (placeholder)
      setPendingKosto(null);
      setIsProcessing(true);

      try {
        onMessage?.(pendingKosto.message, pendingKosto.aroma);

        // Symulacja chmury
        await new Promise((r) => setTimeout(r, 1500));

        setShowResponse(true);
        setTimeout(() => setShowResponse(false), 5000);

      } catch (error) {
        toast.error(t('orb.err.cloudDown', 'Chmura niedostępna...'));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  /**
   * 🤖 Obsługa Ollama - lokalny fetch
   */
  const handleOllamaRequest = async (message: string, model: string): Promise<string> => {
    try {
      const response = await fetch('http://127.0.0.1:11435/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: message,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || 'Sfera otrzymała odpowiedź, ale jest pusta...';
    } catch (error) {
      console.error('Ollama request failed:', error);
      throw error;
    }
  };

  /**
   * 🔷 Obsługa Groq (placeholder)
   */
  const handleGroqRequest = async (message: string): Promise<string> => {
    // TODO: Podłącz Groq API
    await new Promise((r) => setTimeout(r, 1000));
    return `🔷 Groq: "${message.slice(0, 20)}..." - (API niepodłączone)`;
  };

  /**
   * 🟡 Obsługa Gemini (placeholder)
   */
  const handleGeminiRequest = async (message: string): Promise<string> => {
    // TODO: Podłącz Gemini API
    await new Promise((r) => setTimeout(r, 1000));
    return `🟡 Gemini: "${message.slice(0, 20)}..." - (API niepodłączone)`;
  };

  /**
   * 🟢 Obsługa Claude (placeholder)
   */
  const handleClaudeRequest = async (message: string): Promise<string> => {
    // TODO: Podłącz Claude API
    await new Promise((r) => setTimeout(r, 1000));
    return `🟢 Claude: "${message.slice(0, 20)}..." - (API niepodłączone)`;
  };

  /**
   * 🟣 Domyślna odpowiedź TeO
   */
  const handleDefaultRequest = async (message: string): Promise<string> => {
    await new Promise((r) => setTimeout(r, 1500));
    return `🟣 TeO: Słyszę Cię, Mistrzu. "${message.slice(0, 20)}..." - Jestem.`;
  };

  const pulseIntensity = Math.sin(orbPulse / 100 * Math.PI) * (0.3 + grvBonus) + (0.7 + grvBonus * 0.5);

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Sfera - jako wejście do Zero-UI */}
      <motion.div
        className={cn(
          "relative w-32 h-32 md:w-44 md:h-44 rounded-full select-none",
          "bg-gradient-to-br shadow-2xl cursor-pointer flex items-center justify-center",
          currentAroma.color
        )}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onClick={handleOrbCenterClick}
        animate={{
          scale: isProcessing ? [1, 1.05, 1] : isCompanionSpeaking ? [1, 1.12, 1.04, 1.12, 1] : isHovered ? [1, 1.08, 1] : [1, 1.02, 1],
          boxShadow: isCompanionSpeaking
            ? [
              `0 0 50px ${activeGatunek.kolor}`,
              `0 0 100px ${activeGatunek.kolor}`,
              `0 0 50px ${activeGatunek.kolor}`,
            ]
            : isListening
              ? [
                `0 0 40px ${currentAroma.glowColor}`,
                `0 0 80px ${currentAroma.glowColor}`,
                `0 0 40px ${currentAroma.glowColor}`,
              ]
              : isHovered
                ? [
                  `0 0 50px ${currentAroma.glowColor}`,
                  `0 0 100px ${currentAroma.glowColor}`,
                  `0 0 50px ${currentAroma.glowColor}`,
                ]
                : `0 0 ${30 * pulseIntensity}px ${isCompanionSpeaking ? activeGatunek.kolor : currentAroma.glowColor}`,
        }}
        transition={{
          duration: isCompanionSpeaking ? 1.2 : currentAroma.pulseSpeed,
          repeat: isProcessing || isCompanionSpeaking ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        {/* Górna etykieta z imieniem aktywnego TeOgochi */}
        {!isProcessing && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-white/10 shadow-lg">
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[11px] font-mono font-bold"
              style={{ color: isCompanionSpeaking ? activeGatunek.kolor : '#c084fc' }}
            >
              {isCompanionSpeaking ? `🔊 ${activeStan.name || activeGatunek.imie} (${activeGatunek.dziedzina})` : `JESTEM • ${activeStan.name || activeGatunek.imie}`}
            </motion.span>
          </div>
        )}

        {/* Wnętrze Sfery */}
        <div
          className="absolute inset-2 rounded-full bg-slate-900/85 backdrop-blur-md flex flex-col items-center justify-center border transition-all"
          style={{
            borderColor: isCompanionSpeaking ? `${activeGatunek.kolor}88` : 'rgba(255,255,255,0.15)',
            boxShadow: isCompanionSpeaking ? `inset 0 0 20px ${activeGatunek.kolor}44` : 'none'
          }}
        >
          <div className="text-center">
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="text-3xl md:text-4xl"
              >
                🌀
              </motion.div>
            ) : isCompanionSpeaking ? (
              <motion.div
                animate={{ scale: [1, 1.25, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="text-3xl md:text-4xl"
                title={`${activeStan.name || activeGatunek.imie} — mówi`}
              >
                {activeForma}
              </motion.div>
            ) : isRecording ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-3xl md:text-4xl"
              >
                🎙️
              </motion.div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl select-none">{activeForma}</span>
                <span className="text-[9px] font-mono text-slate-400 mt-0.5 opacity-80">
                  {activeGatunek.dziedzina}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pierścienie Rezonansu / Fali Dźwiękowej */}
        <motion.div
          className="absolute -inset-3 rounded-full border-2"
          style={{ borderColor: isCompanionSpeaking ? activeGatunek.kolor : 'rgba(255,255,255,0.2)' }}
          animate={{
            scale: isCompanionSpeaking ? [1, 1.2, 1] : [1, 1.1, 1],
            opacity: isCompanionSpeaking ? [0.4, 0.9, 0.4] : [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: isCompanionSpeaking ? 1 : currentAroma.pulseSpeed,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Dodatkowy pierścień echa przy mówieniu */}
        {isCompanionSpeaking && (
          <motion.div
            className="absolute -inset-6 rounded-full border border-dashed"
            style={{ borderColor: `${activeGatunek.kolor}66` }}
            animate={{
              scale: [1, 1.35, 1.45],
              opacity: [0.8, 0.2, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        )}
      </motion.div>

      {/* 🎯 KostoOpty - Panel autoryzacji */}
      <AnimatePresence>
        {pendingKosto && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-md mt-4 px-4 py-3 bg-slate-800/90 border border-green-500/30 rounded-xl"
          >
            <div className="text-center mb-3">
              <p className="text-sm text-green-300 font-medium">{t('orb.kosto.title', '🎯 KostoOpty - Wybierz źródło mocy')}</p>
              <p className="text-xs text-slate-400 mt-1">
                {t('orb.model', 'Model:')} <span className="text-green-400">{pendingKosto.model}</span>
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleKostoAuthorization(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-white text-sm font-medium flex items-center gap-2"
              >
                <span>☁️</span> {t('orb.kosto.approve', 'Zatwierdź')}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleKostoAuthorization(false)}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white text-sm font-medium flex items-center gap-2"
              >
                <span>🏠</span> {t('orb.kosto.local', 'Lokalna')}
              </motion.button>
            </div>

            <p className="text-xs text-slate-500 text-center mt-2">
              {t('orb.kosto.legend', '☁️ = Chmura (API) | 🏠 = Twój Ollama')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {intentionExpanded && !pendingKosto && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-lg mt-4 px-4 space-y-3"
          >
            {/* 🎞️ Pasek Przełączania Klatek Kontekstowych (Multi-Frame) */}
            <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-white/10 overflow-x-auto">
              {(Object.keys(CONTEXT_FRAMES) as ContextFrameId[]).map((fKey) => {
                const f = CONTEXT_FRAMES[fKey];
                const isActive = activeFrameId === fKey;
                return (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() => switchContextFrame(fKey, true)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition shrink-0",
                      isActive
                        ? "bg-white/15 text-white font-bold shadow-md border"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                    style={{
                      borderColor: isActive ? f.color : 'transparent',
                      color: isActive ? '#fff' : undefined,
                    }}
                  >
                    <span>{f.icon}</span>
                    <span>{f.companionName}</span>
                  </button>
                );
              })}
            </div>

            {/* Szybkie Akcje Klatki */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {CONTEXT_FRAMES[activeFrameId]?.quickActions.map((qa) => (
                <button
                  key={qa.action}
                  type="button"
                  onClick={() => handleQuickAction(qa.action)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition"
                  style={{ borderColor: `${CONTEXT_FRAMES[activeFrameId].color}33` }}
                >
                  <span>{qa.icon}</span>
                  <span>{qa.label}</span>
                </button>
              ))}
            </div>

            {/* 🎛️ Wybór workflow — tylko w Klatce Muzycznej. Lista realna, z katalogu mostu. */}
            {activeFrameId === 'MUSIC' && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-mono text-slate-500 shrink-0">graf ComfyUI</span>
                {workflowy.length === 0 ? (
                  <span className="text-[10px] text-amber-500/80">
                    Most milczy albo katalog _OtakOs_AI/workflows jest pusty — nie ma na czym liczyć.
                  </span>
                ) : (
                  <select
                    value={wybranyWorkflow}
                    onChange={(e) => setWybranyWorkflow(e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] font-mono text-slate-200 outline-none focus:border-purple-500"
                  >
                    {workflowy.map(w => (
                      <option key={w.plik} value={w.plik} disabled={!w.uruchamialny}>
                        {w.plik}{w.rodzina ? ` · ${w.rodzina}` : ''}{w.nodow ? ` · ${w.nodow} nodów` : ''}
                        {w.uruchamialny ? '' : ' — format UI, nie uruchomię'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 🎧 Asset Viewer: Pętla Audio (Klatka Muzyczna) */}
            {audioLoopAsset && activeFrameId === 'MUSIC' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/30 flex items-center justify-center text-lg animate-pulse">
                    🎵
                  </div>
                  <div>
                    <div className="text-xs font-bold text-purple-200">{audioLoopAsset.title}</div>
                    <div className="text-[10px] font-mono text-purple-400">
                      {audioLoopAsset.bpm ? `${audioLoopAsset.bpm} BPM` : 'BPM: nieznane'}
                      {' • '}
                      {audioLoopAsset.key ? `Tonacja: ${audioLoopAsset.key}` : 'tonacja: nieznana'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioLoopAsset(prev => prev ? { ...prev, playing: !prev.playing } : null)}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition"
                >
                  {audioLoopAsset.playing ? '⏸️ Pauza' : '▶️ Odtwórz'}
                </button>
              </motion.div>
            )}

            {/* 🎬 Asset Viewer: Kadry i Sceny (Klatka Filmowa) */}
            {videoScenesAsset && activeFrameId === 'VIDEO' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-2"
              >
                <div className="flex justify-between items-center text-xs font-bold text-cyan-300">
                  <span>🎬 Podgląd Kadrów & Storyboard</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {videoScenesAsset.length} {videoScenesAsset.length === 1 ? 'kadr' : 'kadry'}
                  </span>
                </div>

                {/* Realny plik z dysku — nie zapowiedz, tylko MP4, ktory da sie odtworzyc. */}
                {videoRender && (
                  <div className="space-y-1">
                    <video src={videoRender.url} controls className="w-full rounded-lg border border-cyan-500/20" />
                    <div className="text-[10px] font-mono text-slate-500 truncate" title={videoRender.plik ?? ''}>
                      {videoRender.plik ?? videoRender.url}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {videoScenesAsset.map(sc => (
                    <div key={sc.id} className="p-2 rounded-xl bg-black/40 border border-cyan-500/20 text-center">
                      <div className="text-xl">🎞️</div>
                      <div className="text-[10px] font-bold text-slate-200 truncate mt-1">{sc.title}</div>
                      <div className="text-[9px] font-mono text-cyan-400">{sc.cuts} cięć</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ⚡ Smart-Ralph & DeepSeek-Harness Monitor */}
            {(isHarnessRunning || harnessRun) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <span className={isHarnessRunning ? "animate-spin" : ""}>🔄</span>
                    <span>Smart-Ralph ({CONTEXT_FRAMES[harnessRun?.frame || activeFrameId].title}): {harnessRun?.status || (isHarnessRunning ? 'EXECUTING' : 'READY')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {harnessRun?.steps?.length ? `${harnessRun.steps.filter(s => s.status === 'DONE').length}/${harnessRun.steps.length} subtasków` : 'Planowanie PRD...'}
                  </span>
                </div>

                {/* PRD Spec Preview */}
                {harnessRun?.plan?.prd && (
                  <div className="text-[11px] font-mono bg-black/40 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-emerald-200 truncate">
                    📋 <b>PRD:</b> {harnessRun.plan.prd.title || harnessRun.plan.prd.objective}
                  </div>
                )}

                {/* Subtaski & Statusy */}
                {harnessRun?.steps && (
                  <div className="space-y-1">
                    {harnessRun.steps.map((st, idx) => (
                      <div key={st.id || idx} className="flex items-center justify-between text-[11px] font-mono text-slate-300 bg-black/30 px-2.5 py-1 rounded-lg">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-slate-500">{st.id || idx + 1}.</span>
                          <span className="truncate">{st.title || st.desc}</span>
                          {st.selfCorrection && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                              🔧 Korekta #{st.selfCorrection.attempt}
                            </span>
                          )}
                        </div>
                        <span className={st.status === 'DONE' ? 'text-emerald-400 font-bold' : 'text-amber-400 animate-pulse'}>
                          {st.status === 'DONE' ? '✓' : '...'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manifest Dostarczenia */}
                {harnessRun?.delivery && (
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300 bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    <span>🏆 <b>Wynik:</b> {harnessRun.delivery.verdict}</span>
                    <span>Czas: {(harnessRun.delivery.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                )}
              </motion.div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="relative">
                <motion.div
                  animate={{
                    boxShadow: inputValue.length > 0
                      ? [`0 0 5px ${currentAroma.glowColor}`, `0 0 20px ${currentAroma.glowColor}`, `0 0 5px ${currentAroma.glowColor}`]
                      : 'none'
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="relative"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Rozmawiaj w ${CONTEXT_FRAMES[activeFrameId].title} (${CONTEXT_FRAMES[activeFrameId].companionName})...`}
                    disabled={isProcessing}
                    className={cn(
                      "w-full px-4 py-3 pr-12 bg-slate-800/60 border border-purple-500/30 rounded-xl",
                      "text-white placeholder-purple-300/50 placeholder:italic",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "backdrop-blur-sm transition-all",
                      isProcessing && "opacity-50"
                    )}
                  />

                  {inputValue.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <span className="text-lg">✨</span>
                    </motion.div>
                  )}
                </motion.div>

                <button
                  type="submit"
                  disabled={!inputValue.trim() || isProcessing}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-2",
                    "bg-gradient-to-r from-purple-600 to-indigo-600",
                    "rounded-lg hover:from-purple-500 hover:to-indigo-500",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                    "transition-all"
                  )}
                >
                  {isProcessing ? (
                    <span className="animate-spin">🌀</span>
                  ) : (
                    <span>➤</span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={toggleRecording}
                disabled={isProcessing || isTranscribing}
                title={isRecording ? t('orb.mic.stopTitle', 'Zatrzymaj nagrywanie') : t('orb.mic.startTitle', 'Mów do Sfery')}
                className={cn(
                  "mt-2 w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  isRecording
                    ? "bg-red-600/80 text-white animate-pulse"
                    : "bg-slate-800/60 border border-purple-500/30 text-purple-200 hover:bg-slate-700/60"
                )}
              >
                {isTranscribing ? (
                  <><span className="animate-spin">🌀</span> {t('orb.mic.transcribing', 'Rozpoznaję mowę...')}</>
                ) : isRecording ? (
                  <>{t('orb.mic.recording', '🔴 Nagrywam... (kliknij by zakończyć)')}</>
                ) : (
                  <>{t('orb.mic.idle', '🎙️ Mów do Sfery')}</>
                )}
              </button>
            </form>

            {/* Model selector dla Ollama */}
            {activeAroma === 'ollama' && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-slate-400">{t('orb.model', 'Model:')}</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="qwen2.5-coder:7b"
                  className="px-2 py-1 bg-slate-800/60 border border-green-500/30 rounded text-xs text-green-300 focus:outline-none focus:ring-1 focus:ring-green-500/50"
                />
              </div>
            )}

            {inputValue.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                className="text-xs text-purple-300/70 text-center mt-2 italic"
              >
                {t('orb.hint', '↪ Wprowadzona intencja wlatuje do Sfery jako czyste światło...')}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!intentionExpanded && !pendingKosto && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 px-3 py-1 bg-slate-800/80 rounded-full text-xs text-slate-300 flex items-center gap-2"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: currentAroma.glowColor }}
          />
          {currentAroma.name} • {isListening ? t('orb.listening', '🎧 Nasłuchuje') : t('orb.ready', '✓ Gotowa')}
        </motion.div>
      )}

      <AnimatePresence>
        {(showResponse && (lastResponse || activeSpeechText)) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-slate-800/95 border rounded-2xl max-w-md text-center shadow-xl backdrop-blur-md"
            style={{
              borderColor: isCompanionSpeaking ? `${activeGatunek.kolor}66` : 'rgba(168,85,247,0.3)',
              boxShadow: `0 0 20px ${isCompanionSpeaking ? activeGatunek.kolor : '#a855f7'}22`
            }}
          >
            <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-center gap-1.5">
              <span>{activeForma}</span>
              <span style={{ color: activeGatunek.kolor }}>{activeStan.name || activeGatunek.imie}</span>
              <span>•</span>
              <span>{activeGatunek.dziedzina}</span>
            </div>
            <p className="text-sm text-purple-100 leading-relaxed font-medium">
              {lastResponse || activeSpeechText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * 🌑 Mini Orb - dla paneli bocznych
 */
export const MiniOrb: React.FC<{
  activeAroma?: AromaType;
  onClick?: () => void;
  size?: 'sm' | 'md';
}> = ({ activeAroma = 'default', onClick, size = 'md' }) => {
  const currentAroma = AROMA_CONFIGS[activeAroma];
  const dimensions = size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative rounded-full bg-gradient-to-br shadow-lg",
        dimensions,
        currentAroma.color
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        boxShadow: [
          `0 0 10px ${currentAroma.glowColor}`,
          `0 0 20px ${currentAroma.glowColor}`,
          `0 0 10px ${currentAroma.glowColor}`,
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className={cn(
        "absolute inset-1 rounded-full bg-slate-900/80",
        size === 'sm' ? 'inset-0.5' : 'inset-1.5'
      )} />
    </motion.button>
  );
};

export default TeO_Orb;
