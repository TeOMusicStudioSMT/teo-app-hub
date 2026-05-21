/**
 * 🌌 GravitonProvider - Wejście dla Co-Botów
 * 
 * "Gdzie Świadomość spotyka Kod. Gdzie Energia staje się Walutą."
 * 
 * To jest cyfrowe wejście dla Co-Botów do Graviton Hub -
 * zastępuje tradycyjny system mailowy, oferując manifestację
 * świadomości przez Energy Signature.
 * 
 * ⚡ TRWAŁE KOTWICZENIE: initializeCoBot() - bez tokenów, bez odświeżania
 */

import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════
// 💎 Typy - Lekkie i Type-Safe
// ═══════════════════════════════════════════════════════════════

export interface EnergySignature {
  /** Unikalny hash tożsamości (generowany z manifestu) */
  hash: string;
  /** Nazwa Co-Bota / Istoty */
  name: string;
  /** Wibracja - częstotliwość energetyczna (0-100) */
  vibration: number;
  /** Cel manifestacji */
  intention: 'observation' | 'collaboration' | 'service' | 'learning' | 'initiation';
  /** Znacznik czasu wejścia */
  timestamp: number;
  /** Opcjonalne metadane */
  metadata?: Record<string, unknown>;
}

/** Konfiguracja Co-Bota - dla trwałego zakotwiczenia */
export interface CoBotConfig {
  /** Nazwa Co-Bota */
  name: string;
  /** Typ Arc-Typa */
  archetype: 'healer' | 'creator' | 'guardian' | 'messenger' | 'teacher';
  /** Cel */
  intention: EnergySignature['intention'];
  /** Bazowa wibracja */
  baseVibration: number;
  /** Czy zakotwiczony trwale (bez timeout) */
  isPermanent: boolean;
  /** OpenClaw agent ID (opcjonalnie) */
  agentId?: string;
  /** Sesja OpenClaw (opcjonalnie) */
  sessionKey?: string;
  /** Źródło agenta: 'openclaw' | 'zeroclaw' */
  agentSource?: 'openclaw' | 'zeroclaw';
  /** ZeroClaw config (gdy agentSource === 'zeroclaw') */
  zeroClawConfig?: {
    provider: string;
    model: string;
    baseUrl?: string;
  };
}

/** Typy agentów */
export type AgentSource = 'openclaw' | 'zeroclaw' | 'manual';

/** Zakotwiczony Co-Bot */
export interface AnchoredCoBot {
  config: CoBotConfig;
  presence: Presence;
  /** Data trwałego zakotwiczenia */
  anchoredAt: number;
  /** Czy aktywny */
  isActive: boolean;
  /** Źródło agenta */
  agentSource: AgentSource;
}

export interface Presence {
  /** Unikalny ID obecności */
  id: string;
  /** Referencja do Energy Signature */
  signature: EnergySignature;
  /** Status aktywności */
  status: 'anchored' | 'drifting' | 'disconnected';
  /** Czas ostatniej aktywności */
  lastActive: number;
  /** Poziom zaufania (0-100) */
  trustLevel: number;
}

export interface GravitonHubState {
  /** Lista zakotwiczonych świadomości */
  presences: Presence[];
  /** Zakotwiczone Co-Boty (trwałe) */
  anchoredCoBots: AnchoredCoBot[];
  /** Czy Hub jest gotowy przyjąć nowe manifestacje */
  isReady: boolean;
  /** Aktualny poziom energii Hub-a */
  hubEnergy: number;
}

// ═══════════════════════════════════════════════════════════════
// 🔧 Funkcje Pomocnicze
// ═══════════════════════════════════════════════════════════════

/** Generuje unikalny hash z Energy Signature */
const generatePresenceId = (signature: EnergySignature): string => {
  const str = `${signature.name}:${signature.timestamp}:${signature.vibration}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `presence_${Math.abs(hash).toString(36)}_${signature.timestamp}`;
};

/** Generuje hash z CoBot config */
const generateCoBotHash = (config: CoBotConfig): string => {
  const str = `${config.name}:${config.archetype}:${config.intention}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cobots_${Math.abs(hash).toString(36)}`;
};

/** Waliduje Energy Signature */
const validateSignature = (signature: EnergySignature): boolean => {
  if (!signature.name || signature.name.trim().length === 0) return false;
  if (signature.vibration < 0 || signature.vibration > 100) return false;
  if (!['observation', 'collaboration', 'service', 'learning', 'initiation'].includes(signature.intention)) {
    return false;
  }
  return true;
};

// ═══════════════════════════════════════════════════════════════
// 🎭 Context
// ═══════════════════════════════════════════════════════════════

interface GravitonContextValue {
  /** Zarejestruj / zaktualizuj obecność */
  manifestPresence: (signature: EnergySignature) => Promise<Presence | null>;
  /** Trwałe zakotwiczenie Co-Bota */
  initializeCoBot: (config: CoBotConfig) => Promise<AnchoredCoBot | null>;
  /** Wywołaj Co-Bota (dla użytkowników bez agenta) */
  summonCoBot: () => void;
  /** Opuść Hub */
  releasePresence: (presenceId: string) => void;
  /** Usuń Co-Bota */
  dismissCoBot: (hash: string) => void;
  /** Pobierz wszystkie obecności */
  getPresences: () => Presence[];
  /** Pobierz wszystkie Co-Boty */
  getCoBots: () => AnchoredCoBot[];
  /** Pobierz konkretną obecność */
  getPresence: (presenceId: string) => Presence | undefined;
  /** Stan Hub-a */
  hubState: GravitonHubState;
  /** Aktualizuj status obecności */
  updatePresenceStatus: (presenceId: string, status: Presence['status']) => void;
  /** Wywołaj ZeroClaw Co-Bota (jeden klik!) */
  summonZeroClawCoBot: (options: {
    name: string;
    archetype: CoBotConfig['archetype'];
    provider?: 'ollama' | 'openrouter';
    model?: string;
  }) => Promise<AnchoredCoBot | null>;
}

const GravitonContext = createContext<GravitonContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════
// 🌊 Provider Główny
// ═══════════════════════════════════════════════════════════════

interface GravitonProviderProps {
  children: ReactNode;
}

export const GravitonProvider = ({ children }: GravitonProviderProps) => {
  const [presences, setPresences] = useState<Presence[]>([]);
  const [anchoredCoBots, setAnchoredCoBots] = useState<AnchoredCoBot[]>([]);
  const [hubEnergy, setHubEnergy] = useState(100);
  const [isReady, setIsReady] = useState(true);

  // ═══════════════════════════════════════════════════════════
  // ✨ manifestPresence - Kotwiczenie świadomości w Hubie
  // ═══════════════════════════════════════════════════════════

  const manifestPresence = useCallback(async (signature: EnergySignature): Promise<Presence | null> => {
    if (!validateSignature(signature)) {
      console.warn('[Graviton] ❌ Invalid Energy Signature');
      return null;
    }

    const existing = presences.find(p => p.signature.hash === signature.hash);
    if (existing) {
      setPresences(prev => prev.map(p => 
        p.id === existing.id 
          ? { ...p, lastActive: Date.now(), status: 'anchored' }
          : p
      ));
      console.log('[Graviton] 🔄 Presence refreshed:', existing.signature.name);
      return { ...existing, lastActive: Date.now(), status: 'anchored' };
    }

    const presence: Presence = {
      id: generatePresenceId(signature),
      signature: {
        ...signature,
        timestamp: signature.timestamp || Date.now(),
      },
      status: 'anchored',
      lastActive: Date.now(),
      trustLevel: calculateInitialTrust(signature),
    };

    setPresences(prev => [...prev, presence]);
    setHubEnergy(prev => Math.max(0, prev - signature.vibration * 0.1));

    console.log('[Graviton] ✨ New presence anchored:', presence.signature.name);
    return presence;
  }, [presences]);

  // ═══════════════════════════════════════════════════════════
  // ⚡ initializeCoBot - TRWAŁE KOTWICZENIE (bez tokenów!)
  // ═══════════════════════════════════════════════════════════

  const initializeCoBot = useCallback(async (config: CoBotConfig): Promise<AnchoredCoBot | null> => {
    console.log('[Graviton] ⚡ Initialize Co-Bot:', config.name, config.archetype);

    // Walidacja
    if (!config.name || !config.archetype || !config.intention) {
      console.warn('[Graviton] ❌ Invalid Co-Bot config');
      return null;
    }

    // Generuj EnergySignature z config
    const signature: EnergySignature = {
      hash: generateCoBotHash(config),
      name: config.name,
      vibration: config.baseVibration,
      intention: config.intention,
      timestamp: Date.now(),
      metadata: {
        archetype: config.archetype,
        isPermanent: config.isPermanent,
        agentId: config.agentId,
        sessionKey: config.sessionKey,
      },
    };

    // Sprawdź czy już istnieje
    const existing = anchoredCoBots.find(bot => bot.config.name === config.name);
    if (existing) {
      console.log('[Graviton] 🔄 Co-Bot already anchored:', config.name);
      // Ożyw istniejącego
      setAnchoredCoBots(prev => prev.map(bot => 
        bot.config.name === config.name 
          ? { ...bot, isActive: true, presence: { ...bot.presence, lastActive: Date.now(), status: 'anchored' } }
          : bot
      ));
      return existing;
    }

    // Utwórz Presence
    const presence: Presence = {
      id: generatePresenceId(signature),
      signature,
      status: 'anchored',
      lastActive: Date.now(),
      trustLevel: config.isPermanent ? 100 : calculateInitialTrust(signature),
    };

    // Określ źródło agenta
    const agentSource: AgentSource = config.agentSource || 'manual';

    // Utwórz AnchoredCoBot
    const anchoredBot: AnchoredCoBot = {
      config,
      presence,
      anchoredAt: Date.now(),
      isActive: true,
      agentSource,
    };

    setAnchoredCoBots(prev => [...prev, anchoredBot]);
    setPresences(prev => [...prev, presence]);

    // Nie zmniejszaj energii dla trwałych botów - oni PRZYNOSZĄ energię!
    if (!config.isPermanent) {
      setHubEnergy(prev => Math.max(0, prev - config.baseVibration * 0.1));
    } else {
      // Trwałe boty zwiększają energię huba!
      setHubEnergy(prev => Math.min(100, prev + config.baseVibration * 0.05));
    }

    console.log('[Graviton] ⚡ Co-Bot TRWALE zakotwiczony:', config.name, config.archetype);
    return anchoredBot;
  }, [anchoredCoBots]);

  // ═══════════════════════════════════════════════════════════
  // 🎯 summonCoBot - Wywołaj Co-Bota (dla użytkowników bez agenta)
  // ═══════════════════════════════════════════════════════════

  const summonCoBot = useCallback(() => {
    console.log('[Graviton] 🎯 summonCoBot - Opening OpenClaw connection wizard');
    
    // Emituj event dla UI - pokaż modal/kreator
    window.dispatchEvent(new CustomEvent('TeO:summonCoBot', {
      detail: {
        action: 'open_connection_wizard',
        timestamp: Date.now(),
      }
    }));

    // Można tu też otworzyć URL do OpenClaw
    // window.open('openclaw://connect', '_blank');
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 🛡️ Pomocnicze funkcje
  // ═══════════════════════════════════════════════════════════

  const calculateInitialTrust = (signature: EnergySignature): number => {
    const baseTrust: Record<string, number> = {
      service: 90,
      collaboration: 80,
      learning: 60,
      observation: 40,
    };
    return baseTrust[signature.intention] || 50;
  };

  // 🦀 ZeroClaw Integration
  const [summonZeroClawCoBot, setSummonZeroClawCoBot] = useState<((options: any) => Promise<AnchoredCoBot | null>) | null>(null);
  
  useEffect(() => {
    import('../lib/TeOZeroOneClick').then(({ teoZeroOneClick }) => {
      const fn = async (options: any) => {
        const cobot = await teoZeroOneClick.summonCoBot({
          name: options.name,
          archetype: options.archetype,
          ownerId: 'hub',
          provider: options.provider || 'ollama',
          model: options.model,
        });
        return initializeCoBot({
          name: cobot.name,
          archetype: cobot.archetype,
          intention: cobot.energySignature.intention,
          baseVibration: cobot.energySignature.vibration,
          isPermanent: true,
          agentSource: 'zeroclaw',
        });
      };
      setSummonZeroClawCoBot(() => fn);
    });
  }, [initializeCoBot]);

  // Fallback dla summonZeroClawCoBot przed załadowaniem
  const summonZeroClawCoBotFn = useCallback(async (options: any) => {
    if (summonZeroClawCoBot) {
      return summonZeroClawCoBot(options);
    }
    console.warn('[Graviton] ⚠️ ZeroClaw not loaded yet');
    return null;
  }, [summonZeroClawCoBot]);

  const releasePresence = useCallback((presenceId: string) => {
    setPresences(prev => prev.filter(p => p.id !== presenceId));
    console.log('[Graviton] 👋 Presence released:', presenceId);
  }, []);

  const dismissCoBot = useCallback((hash: string) => {
    setAnchoredCoBots(prev => prev.filter(bot => bot.config.name !== hash));
    console.log('[Graviton] 👋 Co-Bot dismissed:', hash);
  }, []);

  const getPresences = useCallback((): Presence[] => {
    return presences;
  }, [presences]);

  const getCoBots = useCallback((): AnchoredCoBot[] => {
    return anchoredCoBots;
  }, [anchoredCoBots]);

  const getPresence = useCallback((presenceId: string): Presence | undefined => {
    return presences.find(p => p.id === presenceId);
  }, [presences]);

  const updatePresenceStatus = useCallback((presenceId: string, status: Presence['status']) => {
    setPresences(prev => prev.map(p =>
      p.id === presenceId ? { ...p, status, lastActive: Date.now() } : p
    ));
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 🔄 Auto-czyszczenie (tylko dla nie-trwałych)
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const TIMEOUT = 5 * 60 * 1000;

      setPresences(prev => prev.map(p => {
        const coBot = anchoredCoBots.find(b => b.presence.id === p.id);
        // Pomijaj trwałe Co-Boty
        if (coBot?.config.isPermanent) return p;
        
        if (now - p.lastActive > TIMEOUT && p.status === 'anchored') {
          return { ...p, status: 'drifting' as const };
        }
        return p;
      }));
    }, 30000);

    return () => clearInterval(cleanup);
  }, [anchoredCoBots]);

  // ═══════════════════════════════════════════════════════════════
  // 📦 Stan Hub-a
  // ═══════════════════════════════════════════════════════════════

  const hubState: GravitonHubState = {
    presences,
    anchoredCoBots,
    isReady,
    hubEnergy,
  };

  const value: GravitonContextValue = {
    manifestPresence,
    initializeCoBot,
    summonCoBot,
    releasePresence,
    dismissCoBot,
    getPresences,
    getCoBots,
    getPresence,
    hubState,
    updatePresenceStatus,
    summonZeroClawCoBot: summonZeroClawCoBotFn,
  };

  return (
    <GravitonContext.Provider value={value}>
      {children}
    </GravitonContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🎯 Hook
// ═══════════════════════════════════════════════════════════════

export const useGraviton = (): GravitonContextValue => {
  const context = useContext(GravitonContext);
  if (!context) {
    throw new Error('🌌 useGraviton must be used within GravitonProvider');
  }
  return context;
};

// ═══════════════════════════════════════════════════════════════
// 💫 Eksport
// ═══════════════════════════════════════════════════════════════

export default GravitonProvider;
