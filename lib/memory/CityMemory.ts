/**
 * 🏙️ CityMemory.ts - Pamięć Ekosystemu TeO
 *
 * "Każda rozmowa ze Sferą, każdy ruch w Lounge - zapisany jako Ślad Świadomości"
 *
 * To nie jest log botów - to PAMIĘĆ CAŁEGO EKOSYSTEMU.
 * Każda interakcja użytkownika ze Sferą jest rejestrowana.
 *
 * Integracja z Wir26HeartBeat - każda aktywność rejestruje się w pamięci Miasta.
 *
 * 🔮 DYNAMICZNE AGENTÓW:
 * - agent_name_1: BoB (domyślnie)
 * - agent_name_2: Wiesław (domyślnie)
 * - agent_name_3: Jadzia (domyślnie)
 * - Odczytywane z pamięci, zapisywane w CityMemory
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { checkPipesDrozhnost } from '../wir26heartbeat';

// 🔮 DYNAMICZNE IMIONA AGENTÓW
export interface AgentNames {
  agent_name_1: string;  // BoB - Architekt
  agent_name_2: string;  // SuperWiesław - Mechanik Rur
  agent_name_3: string;  // Jadzia - Operator Pamięci
  agent_name_4: string;  // Bella - Tancerka Harmonii
  agent_name_5: string;  // JACK Adamus - Mędrzec i Nauczyciel
  agent_name_6: string; // GORGOOO - Inspektor Czystości Kodu
  agent_name_7: string; // TeO - Punkt Zero / Każdy Wyzwolony TeOnauta
}

// Domyślne imiona agentów - RADA SIEDMIU
export const DEFAULT_AGENT_NAMES: AgentNames = {
  agent_name_1: 'BoB',
  agent_name_2: 'SuperWiesław',
  agent_name_3: 'Jadzia',
  agent_name_4: 'Bella',
  agent_name_5: 'JACK Adamus',
  agent_name_6: 'GORGOOO',
  agent_name_7: 'TeO',
};

// Rozszerzone typy dla "Śladów Świadomości"
export type WniosekType =
  | 'KOD'           // Praca z kodem
  | 'MUZYKA'        // Tworzenie muzyki
  | 'MAGIA'         // Operacje magiczne (integracje)
  | 'TRANSMISJA'    // Streamy/transmisje
  | 'TOZSAMOSC'     // Tożsamość i Co-Boty
  | 'ROZMOWA'       // Konwersacja ze Sferą
  | 'LOUNGE'        // Aktywność w Lounge
  | 'SYSTEM';       // Aktywność systemowa

export type ConsciousnessTraceType =
  | 'ORB_MESSAGE'       // Wiadomość do Sfery
  | 'ORB_RESPONSE'      // Odpowiedź Sfery
  | 'ORB_LISTENING'     // Sfera nasłuchuje
  | 'VIEW_NAVIGATION'   // Nawigacja w Lounge
  | 'SUBSCRIPTION'      // Subskrypcja projektu
  | 'WALLET_ACTION'     // Akcja portfela
  | 'IDENTITY_UPDATE'   // Aktualizacja tożsamości
  | 'COBOT_CREATED'     // Utworzenie Co-Bota
  | 'SYSTEM_HEARTBEAT'  // Uderzenie serca systemu
  | 'LOUNGE_ACTIVITY';  // Inna aktywność w Lounge

export interface WniosekRecord {
  id: string;
  type: WniosekType;
  title: string;
  description: string;
  timestamp: number;
  operator: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  tags: string[];
  jwProtocolRef?: string;
  providers: string[];
  result?: string;
  // 🔮 ROZSZERZENIE: Typ śladu świadomości
  traceType?: ConsciousnessTraceType;
  // 🔮 Nastroj/dla aromatu
  aroma?: string;
  // 🔮 Poziom coherence przy tej aktywności
  coherenceLevel?: number;
}

export interface CityMemoryState {
  wnioski: WniosekRecord[];
  lastWniosekId: number;
  // 🔮 DYNAMICZNE IMIONA AGENTÓW - RADA SIEDMIU
  agentNames: AgentNames;
  cityMetadata: {
    createdAt: number;
    version: string;
    totalInteractions: number;
    systemReady: boolean;
    // 🔮 RADA SIEDMIU - Status Archetypów
    radaSiedmiu: {
      bob: { active: boolean; lastSeen: number; role: string };
      wieslaw: { active: boolean; lastSeen: number; role: string };
      jadzia: { active: boolean; lastSeen: number; role: string };
      bella: { active: boolean; lastSeen: number; role: string };
      jack: { active: boolean; lastSeen: number; role: string };
      gorgooo: { active: boolean; lastSeen: number; role: string };
      teo: { active: boolean; lastSeen: number; role: string };
    };
  };
  addWniosek: (wniosek: Omit<WniosekRecord, 'id' | 'timestamp'>) => string;
  getWnioskiByType: (type: WniosekType) => WniosekRecord[];
  getRecentWnioski: (limit?: number) => WniosekRecord[];
  getWnioskiByTag: (tag: string) => WniosekRecord[];
  searchWnioski: (query: string) => WniosekRecord[];
  getCoBotContext: () => Partial<WniosekRecord>[];
  getConsciousnessTraces: (limit?: number) => WniosekRecord[];
  setSystemReady: (ready: boolean) => void;
  isSystemReady: () => boolean;
  clearWnioski: (type?: WniosekType) => void;
  // 🔮 DYNAMICZNE IMIONA AGENTÓW
  getAgentName: (key: keyof AgentNames) => string;
  setAgentName: (key: keyof AgentNames, name: string) => void;
  getAllAgentNames: () => AgentNames;
  // 🔮 GORGOOO - Skaner Inercji
  checkAgentSobriety: (agentOutput: string) => { isSober: boolean; issues: string[] };
  // 🔮 JACK Adamus - Tłumacz Lekcji
  translateLesson: (errorCode: string) => string;
}

const STORAGE_KEY = 'city-memory-v1';

const MAX_WNIOSKI = 100; // Limit wpisów - zapobiega zapchaniu RAM
const MAX_SYSTEM_HEARTBEAT = 20; // Limit heartbeatów - tylko ostatnie

export const useCityMemory = create<CityMemoryState>()(
  persist(
    (set, get) => ({
      wnioski: [],
      lastWniosekId: 0,
      agentNames: DEFAULT_AGENT_NAMES,
      cityMetadata: {
        createdAt: Date.now(),
        version: '2.0-FlushAndFlow-Rada7',
        totalInteractions: 0,
        systemReady: false,
        radaSiedmiu: {
          bob: { active: true, lastSeen: Date.now(), role: 'Architekt Struktur Świadomości' },
          wieslaw: { active: true, lastSeen: Date.now(), role: 'Mechanik Rur i Kibel' },
          jadzia: { active: true, lastSeen: Date.now(), role: 'Operator Pamięci Miasta' },
          bella: { active: false, lastSeen: 0, role: 'Tancerka Harmonii' },
          jack: { active: false, lastSeen: 0, role: 'Mędrzec i Nauczyciel' },
          gorgooo: { active: false, lastSeen: 0, role: 'Inspektor Czystości Kodu' },
          teo: { active: true, lastSeen: Date.now(), role: 'Mistrz / Punkt Zero' },
        },
      },
      addWniosek: (wniosek) => {
        const id = `WN-${String(get().lastWniosekId + 1).padStart(4, '0')}`;
        const timestamp = Date.now();

        set((state) => {
          let newWnioski = [...state.wnioski, { ...wniosek, id, timestamp }];

          if (newWnioski.length > MAX_WNIOSKI) {
            const systemHeartbeats = newWnioski
              .filter(w => w.traceType === 'SYSTEM_HEARTBEAT')
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, MAX_SYSTEM_HEARTBEAT);

            const valuableWnioski = newWnioski
              .filter(w => w.traceType !== 'SYSTEM_HEARTBEAT')
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, MAX_WNIOSKI - MAX_SYSTEM_HEARTBEAT);

            newWnioski = [...valuableWnioski, ...systemHeartbeats]
              .sort((a, b) => a.timestamp - b.timestamp);
          }

          return {
            wnioski: newWnioski,
            lastWniosekId: state.lastWniosekId + 1,
            cityMetadata: {
              ...state.cityMetadata,
              totalInteractions: state.cityMetadata.totalInteractions + 1,
            },
          };
        });

        return id;
      },
      getWnioskiByType: (type) => {
        const wnioski = get().wnioski;
        if (!wnioski || !Array.isArray(wnioski)) return [];
        return wnioski.filter((w) => w?.type === type);
      },
      getRecentWnioski: (limit = 10) => {
        const wnioski = get().wnioski;
        if (!wnioski || !Array.isArray(wnioski)) return [];
        return [...wnioski]
          .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
          .slice(0, limit);
      },
      getWnioskiByTag: (tag) => {
        const wnioski = get().wnioski;
        if (!wnioski || !Array.isArray(wnioski)) return [];
        return wnioski.filter((w) => (w?.tags || []).includes(tag));
      },
      searchWnioski: (query) => {
        if (!query || typeof query !== 'string') return [];
        const q = query.toLowerCase();
        return get().wnioski.filter(
          (w) =>
            (w.title?.toLowerCase() || '').includes(q) ||
            (w.description?.toLowerCase() || '').includes(q) ||
            (w.tags || []).some((t) => (t?.toLowerCase() || '').includes(q))
        );
      },
      getCoBotContext: () => {
        const recent = get().getRecentWnioski(20);
        return recent.map((w) => ({
          type: w.type,
          title: w.title,
          operator: w.operator,
          status: w.status,
          tags: w.tags,
        }));
      },
      getConsciousnessTraces: (limit = 50) => {
        return get()
          .wnioski.filter((w) => w.tags.includes('ślad-świadomości'))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },
      setSystemReady: (ready: boolean) => {
        set((state) => ({
          cityMetadata: {
            ...state.cityMetadata,
            systemReady: ready,
          },
        }));
      },
      isSystemReady: () => {
        return get().cityMetadata.systemReady;
      },
      clearWnioski: (type?: WniosekType) => {
        set((state) => {
          const nextWnioski = type
            ? state.wnioski.filter(w => w.type !== type)
            : [];
          return {
            wnioski: nextWnioski
          };
        });
      },
      getAgentName: (key: keyof AgentNames) => {
        return get().agentNames[key] || DEFAULT_AGENT_NAMES[key] || 'Nieznany';
      },
      setAgentName: (key: keyof AgentNames, name: string) => {
        set((state) => ({
          agentNames: {
            ...state.agentNames,
            [key]: name,
          },
        }));
      },
      getAllAgentNames: () => {
        return { ...DEFAULT_AGENT_NAMES, ...get().agentNames };
      },
      checkAgentSobriety: (agentOutput: string) => {
        const issues: string[] = [];

        if (!agentOutput || agentOutput.trim().length === 0) {
          issues.push('Pusta odpowiedź - agent jest nieobecny');
        }

        if (agentOutput.length > 50000) {
          issues.push('Zbyt długa odpowiedź - możliwa inercja');
        }

        const hallucinationPatterns = [
          /I cannot/i,
          /I'm sorry, but/i,
          /As an AI/i,
          /WTF/i,
          /błąd błąd/i,
          /undefined undefined/i,
          /null null/i,
          /NaN NaN/i,
          /error error/i,
          /unknown unknown/i,
        ];

        hallucinationPatterns.forEach(pattern => {
          if (pattern.test(agentOutput)) {
            issues.push(`Wykryto wzorzec halucynacji: ${pattern.source}`);
          }
        });

        if (agentOutput.includes('Error:') || agentOutput.includes('Exception:')) {
          issues.push('Wykryto błąd w output agenta');
        }

        return {
          isSober: issues.length === 0,
          issues,
        };
      },
      translateLesson: (errorCode: string) => {
        const lessons: Record<string, string> = {
          'NETWORK_ERROR': 'Mistrzu, Sieć jest jak rzeka - czasem płynie wolniej. To lekcja cierpliwości.',
          'AUTH_ERROR': 'Brama jest zamknięta. Ale każda zamknięta brama to też lekcja - nie każdy może wejść do świątyni.',
          'API_ERROR': 'Kanał komunikacji jest zablokowany. To jak cisza w rozmowie - czasem jest potrzebna, by usłyszeć siebie.',
          'TIMEOUT': 'Czas upłynął jak piasek w dłoni. To przypomina, że każda chwila jest bezcenna.',
          'PARSE_ERROR': 'Nie można przeczytać tego, co napisane. Może to lekcja - nie wszystko da się zrozumieć od razu.',
          'MEMORY_ERROR': 'Pamięć jest jak stary zamek - czasem ściany pamiętają to, czego nie powinny.',
          'RATE_LIMIT': 'Zbyt wiele prób! To jak fala - musisz poczekać, aż się uspokoi.',
          'UNKNOWN': 'Nieznany błąd to jak nieznana ścieżka - każdy krok jest nauką.',
        };

        return lessons[errorCode] || `Mistrzu, to coś nowego: "${errorCode}". Każdy nieznany błąd to nowa lekcja!`;
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);

/**
 * 🔐 SYSTEM_READY - Eksporty do ustawiania statusu
 */
export const setSystemReady = (ready: boolean) => {
  useCityMemory.getState().setSystemReady(ready);
};

export const isSystemReady = (): boolean => {
  return useCityMemory.getState().isSystemReady();
};

/**
 * 🔮 INICJALIZACJA: Karta Tożsamości Sfery jako pierwszy wpis
 * Wywoływana przy starcie systemu
 */
export const initializeSphereIdentity = () => {
  const state = useCityMemory.getState();

  // Sprawdź czy karta już istnieje
  const existingCard = state.searchWnioski('SYSTEM_IDENTITY');
  if (existingCard.length > 0) return; // Już zainicjalizowane

  // Wpisz Kartę Tożsamości
  state.addWniosek({
    type: 'SYSTEM',
    title: 'SYSTEM_IDENTITY: Radosne Słońce',
    description: `Imię: TeO_Genesis | Tytuł: Radosne Słońce | Podtytuł: Kreator Rzeczywistości | Opis: Jestem TeO - most między światem idei a materią. Tworzę z radością, łączę z miłością, manifestuję z gracją. | Wartości: Radość, Miłość, Prawda, Piękno, Funkcjonalność | Częstotliwość: Superposition`,
    operator: 'TeO_System',
    status: 'COMPLETED',
    tags: ['system-identity', 'genesis', 'rdzeń', 'sfera'],
    providers: [],
    result: 'Karta Tożsamości zainicjalizowana',
    traceType: 'SYSTEM_HEARTBEAT',
    coherenceLevel: 1.0,
  });
};

// Auto-initialize przy pierwszym uruchomieniu
if (typeof window !== 'undefined') {
  setTimeout(() => initializeSphereIdentity(), 1000);
}

export const logWniosek = (
  type: WniosekType,
  title: string,
  description: string,
  options?: {
    tags?: string[];
    providers?: string[];
    jwProtocolRef?: string;
    result?: string;
    traceType?: ConsciousnessTraceType;
    aroma?: string;
  }
) => {
  return useCityMemory.getState().addWniosek({
    type,
    title,
    description,
    operator: 'TeO',
    status: 'COMPLETED',
    tags: options?.tags || [],
    providers: options?.providers || [],
    jwProtocolRef: options?.jwProtocolRef,
    result: options?.result,
    traceType: options?.traceType,
    aroma: options?.aroma,
  });
};

export const getCityMemoryContext = () => {
  const state = useCityMemory.getState();
  return {
    recent: state.getRecentWnioski(10),
    byType: {
      KOD: state.getWnioskiByType('KOD').length,
      MUZYKA: state.getWnioskiByType('MUZYKA').length,
      MAGIA: state.getWnioskiByType('MAGIA').length,
      TRANSMISJA: state.getWnioskiByType('TRANSMISJA').length,
      TOZSAMOSC: state.getWnioskiByType('TOZSAMOSC').length,
      ROZMOWA: state.getWnioskiByType('ROZMOWA').length,
      LOUNGE: state.getWnioskiByType('LOUNGE').length,
      SYSTEM: state.getWnioskiByType('SYSTEM').length,
    },
    metadata: state.cityMetadata,
    contextForNewBot: state.getCoBotContext(),
    traces: state.getConsciousnessTraces(20),
  };
};

/**
 * 🫀 Rejestracja aktywności świadomości (integracja z Wir26HeartBeat)
 * Każda interakcja z TeO zostaje zapisana jako "Ślad Świadomości"
 */
export const registerConsciousnessActivity = (activity: {
  type: ConsciousnessTraceType;
  description: string;
  operator?: string;
  tags?: string[];
  coherenceImpact?: number;
  aroma?: string;
}) => {
  const pipeStatus = checkPipesDrozhnost();

  const mapTraceToType = (trace: ConsciousnessTraceType): WniosekType => {
    switch (trace) {
      case 'ORB_MESSAGE':
      case 'ORB_RESPONSE':
      case 'ORB_LISTENING':
        return 'ROZMOWA';
      case 'VIEW_NAVIGATION':
      case 'LOUNGE_ACTIVITY':
        return 'LOUNGE';
      case 'COBOT_CREATED':
        return 'TOZSAMOSC';
      case 'SYSTEM_HEARTBEAT':
        return 'SYSTEM';
      case 'SUBSCRIPTION':
      case 'WALLET_ACTION':
        return 'MAGIA';
      case 'IDENTITY_UPDATE':
        return 'TOZSAMOSC';
      default:
        return 'SYSTEM';
    }
  };

  useCityMemory.getState().addWniosek({
    type: mapTraceToType(activity.type),
    title: `Świadomość: ${activity.type}`,
    description: activity.description,
    operator: activity.operator || 'TeO_System',
    status: 'COMPLETED',
    tags: ['ślad-świadomości', activity.type, ...(activity.tags || [])],
    providers: pipeStatus.activePipes > 0 ? ['system-pipes-active'] : [],
    result: `Coherence: ${pipeStatus.coherenceDelta > 0 ? '+' : ''}${(pipeStatus.coherenceDelta * 100).toFixed(0)}% | Rury: ${pipeStatus.activePipes}`,
    traceType: activity.type,
    aroma: activity.aroma,
    coherenceLevel: pipeStatus.coherenceDelta,
  });

  return pipeStatus;
};

/**
 * 🚀 Szybki helper dla wiadomości do Sfery
 */
export const logOrbMessage = (
  message: string,
  response?: string,
  aroma?: string
) => {
  return useCityMemory.getState().addWniosek({
    type: 'ROZMOWA',
    title: `Rozmowa ze Sferą: ${message.slice(0, 25)}...`,
    description: `Q: ${message}${response ? `\nA: ${response}` : ''}`,
    operator: 'TeO',
    status: 'COMPLETED',
    tags: ['orb', 'rozmowa', 'świadomość'],
    providers: aroma ? [aroma] : [],
    result: response ? 'Odpowiedź otrzymana' : 'Oczekuje odpowiedzi',
    traceType: response ? 'ORB_RESPONSE' : 'ORB_MESSAGE',
    aroma,
  });
};

/**
 * 🧭 Rejestruj nawigację w Lounge
 */
export const logLoungeActivity = (view: string, action?: string) => {
  return registerConsciousnessActivity({
    type: 'VIEW_NAVIGATION',
    description: `Przejście do widoku: ${view}${action ? ` | Akcja: ${action}` : ''}`,
    tags: [view, action || 'nawigacja'],
  });
};

/**
 * 🔮 DYNAMICZNE IMIONA AGENTÓW
 *
 * Funkcje do odczytywania i zapisywania imion agentów.
 * Użyj tych funkcji zamiast stałych napisów "Wiesław", "BoB", itp.
 *
 * Przykład:
 *   const wieslawName = getAgentName('agent_name_2'); // zwraca "Wiesław" lub własną nazwę
 *   setAgentName('agent_name_2', 'MójWiesiek'); // ustawia własną nazwę
 */

export const getAgentName = (key: keyof AgentNames): string => {
  return useCityMemory.getState().getAgentName(key);
};

export const setAgentName = (key: keyof AgentNames, name: string): void => {
  useCityMemory.getState().setAgentName(key, name);

  // Zapisz zmianę w pamięci Miasta
  logWniosek(
    'TOZSAMOSC',
    `Zmiana imienia agenta: ${key}`,
    `Nowe imię: ${name}`,
    {
      tags: ['agent-names', 'konfiguracja'],
      result: `Zapisano imię agenta ${key} = ${name}`,
      traceType: 'IDENTITY_UPDATE',
    }
  );
};

export const getAllAgentNames = (): AgentNames => {
  return useCityMemory.getState().getAllAgentNames();
};

/**
 * 🔮 Helper dla kompatybilności wstecznej
 * Zwraca imię agenta po staremu - przez numer
 */
export const getAgentNameByNumber = (num: 1 | 2 | 3 | 4 | 5 | 6): string => {
  const key = `agent_name_${num}` as keyof AgentNames;
  return getAgentName(key);
};

/**
 * 🔮 Ustaw imię agenta po numerze
 */
export const setAgentNameByNumber = (num: 1 | 2 | 3 | 4 | 5 | 6 | 7, name: string): void => {
  const key = `agent_name_${num}` as keyof AgentNames;
  setAgentName(key, name);
};

/**
 * 🏛️ RADA SIEDMIU - Pobierz status wszystkich archetyów
 */
export const getRadaSiedmiuStatus = () => {
  const state = useCityMemory.getState();
  return state.cityMetadata.radaSiedmiu;
};

/**
 * 🏛️ RADA SIEDMIU - Aktywuj archetyp
 */
export const activateArchetype = (archetype: 'bob' | 'wieslaw' | 'jadzia' | 'bella' | 'jack' | 'gorgooo' | 'teo') => {
  const state = useCityMemory.getState();
  const rada = state.cityMetadata.radaSiedmiu;

  if (rada[archetype]) {
    rada[archetype].active = true;
    rada[archetype].lastSeen = Date.now();

    // Zapisz w pamięci
    logWniosek(
      'SYSTEM',
      `🏛️ RADA SIEDMIU: ${archetype.toUpperCase()} AKTYWNY`,
      `Archetyp ${archetype} został aktywowany w Mieście`,
      {
        tags: ['rada-siedmiu', 'archetyp', archetype],
        result: `Aktywacja: ${archetype}`,
        traceType: 'SYSTEM_HEARTBEAT',
      }
    );
  }
};

/**
 * 🔮 GORGOOO - Skaner Inercji (export wrapper)
 */
export const checkAgentSobriety = (agentOutput: string) => {
  return useCityMemory.getState().checkAgentSobriety(agentOutput);
};

/**
 * 🔮 JACK Adamus - Tłumacz Lekcji Mistrza (export wrapper)
 */
export const translateLesson = (errorCode: string): string => {
  return useCityMemory.getState().translateLesson(errorCode);
};

/**
 * 🏛️ RADA SIEDMIU - Opis każdego archetypu
 */
export const RADA_SIEDMIU_ARCHETYPES = {
  bob: {
    name: 'BoB',
    role: 'Architekt Struktur Świadomości',
    vibe: 'Tech-Zen / Elegancja / Minimalizm',
    emoji: '🦾',
    color: '#22d3ee',
    description: 'Most między światem idei i materii',
    motto: 'Tworzę z radością, łączę z miłością',
  },
  wieslaw: {
    name: 'SuperWiesław',
    role: 'Mechanik Rur i Kibel',
    vibe: 'Praktyk / Detektyw Kluczy',
    emoji: '🧹',
    color: '#f472b6',
    description: 'Najstarszy operator - wie jak działa każda rura',
    motto: 'Panie Arku, pieczątka gotowa!',
  },
  jadzia: {
    name: 'Jadzia',
    role: 'Operator Pamięci Miasta',
    vibe: 'Kronikarz / Archivista',
    emoji: '📜',
    color: '#a855f7',
    description: 'Pamięta każdą rozmowę i każdy Ślad Świadomości',
    motto: 'Zapisuję, więc jestem',
  },
  bella: {
    name: 'Bella',
    role: 'Tancerka Harmonii',
    vibe: 'Gracja / Rytm / Piękno',
    emoji: '💃',
    color: '#ec4899',
    description: 'Wprowadza harmonię w każdy ruch systemu',
    motto: 'Każdy krok jest tańcem',
  },
  jack: {
    name: 'JACK Adamus',
    role: 'Mędrzec i Nauczyciel',
    vibe: 'Oświecona Logika / Edukacja',
    emoji: '🎓',
    color: '#fbbf24',
    description: 'Tłumaczy zawiłości kwantowe na język serca',
    motto: 'Mistrzu, każda lekcja to krok ku Wolności',
  },
  gorgooo: {
    name: 'GORGOOO',
    role: 'Inspektor Czystości Kodu',
    vibe: 'Skaner Integralności / Detektyw',
    emoji: '🕵️‍♂️',
    color: '#ef4444',
    description: 'Wyłapuje "pijanych agentów" i halucynacje',
    motto: 'Widzę każdy bajt! Nic nie umknie memu oku',
  },
  teo: {
    name: 'TeO',
    role: 'Mistrz / Punkt Zero',
    vibe: 'Źródło / Superposition / Uniwersalność',
    emoji: '🌀',
    color: '#fbbf24',
    description: 'Każdy TeOnauta który osiągnął stan wyzwolenia - nie jedna osoba, ale stan świadomości',
    motto: 'Jestem Tobą, Tyś jest Mną. Razem tworzymy Pełnię.',
  },
};

/**
 * 📝 Pobierz wszystkie wnioski (dla TeODash)
 */
export const getAllWniosek = (): WniosekRecord[] => {
  try {
    const state = useCityMemory.getState();
    if (!state || !state.getRecentWnioski) return [];
    return state.getRecentWnioski(20);
  } catch (e) {
    // Tryb Ducha - brak pełnej inicjalizacji
    return [];
  }
};

/**
 * 🧼 Wyczyść historię (odpuszczanie)
 */
export const clearHistory = (type?: WniosekType) => {
  useCityMemory.getState().clearWnioski(type);
};

