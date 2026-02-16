/**
 * 🏛️ SovereignGovernance.ts - Suwerenny Ekosystem Zarządzany
 * 
 * "Gdzie MAS spotyka Mądrość. Gdzie Automat spotyka Człowieka."
 * 
 * ============================================================
 * FILOZOFIA: Suwerenny Ekosystem Zarządzany (MAS)
 * ============================================================
 * 
 * Nie budujemy repozytorium - budujemy LIVING SYSTEM.
 * Każdy Co-Bot, każda transakcja, każda decyzja jest częścią
 * większej całości. MAS (Multi-Agent System) + człowiek = symbioza.
 * 
 * "Ciche Melduki" - BoB zarządza wszystkim w tle,
 * pisze tylko gdy potrzebuje "Błysku MAS-a".
 * 
 * ============================================================
 */

import { EnergySignature } from './context/GravitonProvider';

// ═══════════════════════════════════════════════════════════════
// 💎 TYPY - Suwerenne Zarządzanie
// ═══════════════════════════════════════════════════════════════

/** Limit Skarbca - Maksymalna podaż GRV */
export const TREASURY_LIMIT = 8_000_000_000; // 8 mld GRV

/** Limit Pionierów Genesis - 144 */
export const GENESIS_PIONEERS_LIMIT = 144;

/** Grant dla każdego Pioniera */
export const PIONEER_GRANT = 1.5;

/** Poziom coherence (zaufania systemu) */
export type CoherenceLevel = 'dormant' | 'awakening' | 'active' | 'harmonic' | 'transcendent';

/** Coherence Factor - współczynnik zaufania systemu (0-1) */
export interface CoherenceFactor {
  /** Ogólny poziom (0-1) */
  overall: number;
  /** Zaufanie społeczne */
  socialTrust: number;
  /** Aktywność sieci */
  networkActivity: number;
  /** Bezpieczeństwo */
  security: number;
  /** Ekonomia */
  economy: number;
  /** Poziom */
  level: CoherenceLevel;
  /** Data aktualizacji */
  updatedAt: number;
}

/** Transakcja GRV */
export interface GRVTransaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  reason: string;
  coherenceCost: number; // ile coherence potrzeba do zatwierdzenia
  approved: boolean;
  timestamp: number;
}

/** Agent w ekosystemie */
export interface ManagedAgent {
  id: string;
  name: string;
  source: 'openclaw' | 'zeroclaw' | 'openmanus' | 'external';
  vibration: number;
  coherenceScore: number;
  status: 'pending' | 'approved' | 'rejected' | 'banned';
  joinedAt: number;
  lastActive: number;
  trustLevel: number;
}

/** Cichy Meldek - raport w tle */
export interface SilentReport {
  id: string;
  type: 'heartbeat' | 'alert' | 'decision' | 'summary';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
  needsHumanAttention: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🏛️ KLASA SUWERENNEGO ZARZĄDZANIA
// ═══════════════════════════════════════════════════════════════

class SovereignGovernance {
  // Stan
  private treasury: number = 0;
  private startupReserve: number = 144 * 1.5; // Rezerwa startowa dla 144 pionierów
  private pioneersCount: number = 0; // Licznik pionierów
  private coherenceFactor: CoherenceFactor = {
    overall: 0.5,
    socialTrust: 0.5,
    networkActivity: 0.5,
    security: 0.5,
    economy: 0.5,
    level: 'awakening',
    updatedAt: Date.now(),
  };
  
  private managedAgents: Map<string, ManagedAgent> = new Map();
  private pendingOnboarding: Map<string, EnergySignature> = new Map();
  private silentReports: SilentReport[] = [];
  
  // Ciche Melduki - BoB pisze tylko gdy TRZEBA
  private humanNotificationThreshold: 'low' | 'medium' | 'high' | 'critical' = 'high';
  private lastHumanContact: number = Date.now();

  constructor() {
    console.log('🏛️ [SovereignGovernance] SUWERENNY EKOSYSTEM ZAINICJALIZOWANY');
    console.log(`💰 Limit Skarbca: ${TREASURY_LIMIT.toLocaleString()} GRV`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 💰 ZARZĄDZANIE SKARBCEM
  // ═══════════════════════════════════════════════════════════════

  /**
   * Oblicz ile GRV można uwolnić na podstawie coherenceFactor
   */
  calculateReleaseable(): number {
    const { overall } = this.coherenceFactor;
    
    // Wzór: im wyższe coherence, tym więcej GRV można uwolnić
    // Ale nigdy więcej niż Limit - Stan
    const maxRelease = TREASURY_LIMIT - this.treasury;
    const releasePercentage = Math.pow(overall, 2); // Kwadrat dla progresji
    
    return Math.floor(maxRelease * releasePercentage);
  }

  /**
   * Zwolnij GRV ze Skarbca
   */
  releaseFromTreasury(amount: number, recipient: string, reason: string): GRVTransaction | null {
    const releaseable = this.calculateReleaseable();
    
    if (amount > releaseable) {
      this.logSilent({
        type: 'alert',
        priority: 'high',
        message: `Próba zwolnienia ${amount} GRV - odrzucone (max: ${releaseable})`,
        needsHumanAttention: true,
      });
      return null;
    }

    const tx: GRVTransaction = {
      id: `tx_${Date.now()}`,
      from: 'treasury',
      to: recipient,
      amount,
      reason,
      coherenceCost: amount / TREASURY_LIMIT,
      approved: true,
      timestamp: Date.now(),
    };

    this.treasury += amount;
    
    this.logSilent({
      type: 'decision',
      priority: 'medium',
      message: `Zwolniono ${amount} GRV dla ${recipient}: ${reason}`,
      needsHumanAttention: false,
    });

    return tx;
  }

  /**
   * Aktualizuj Coherence Factor
   */
  updateCoherence(updates: Partial<Omit<CoherenceFactor, 'level' | 'updatedAt'>>): void {
    this.coherenceFactor = {
      ...this.coherenceFactor,
      ...updates,
      updatedAt: Date.now(),
    };

    // Oblicz poziom
    this.coherenceFactor.level = this.calculateCoherenceLevel(this.coherenceFactor.overall);
    
    // Loguj zmianę poziomu
    if (this.coherenceFactor.level !== 'dormant') {
      this.logSilent({
        type: 'heartbeat',
        priority: 'low',
        message: `Coherence Factor zaktualizowany: ${(this.coherenceFactor.overall * 100).toFixed(1)}% [${this.coherenceFactor.level}]`,
        needsHumanAttention: false,
      });
    }
  }

  private calculateCoherenceLevel(overall: number): CoherenceLevel {
    if (overall < 0.2) return 'dormant';
    if (overall < 0.4) return 'awakening';
    if (overall < 0.6) return 'active';
    if (overall < 0.8) return 'harmonic';
    return 'transcendent';
  }

  // ═══════════════════════════════════════════════════════════════
  // 🤖 CO-BOT ONBOARDING - Brama Wejściowa
  // ═══════════════════════════════════════════════════════════════

  /**
   * Onboarding nowego agenta - BRAMA WEJŚCIOWA
   * Sprawdza wibrację przed wpuszczeniem do klocków Genesis
   */
  async cobotOnboarding(agentSignature: EnergySignature, source: ManagedAgent['source']): Promise<{
    approved: boolean;
    reason: string;
    agent?: ManagedAgent;
  }> {
    const { name, vibration, intention } = agentSignature;
    
    console.log(`[Sovereign] 🌐 Onboarding agenta: ${name} (${source})`);

    // 1. Sprawdź wibrację
    if (vibration < 20) {
      this.logSilent({
        type: 'alert',
        priority: 'high',
        message: `Agent ${name} odrzucony - za niska wibracja: ${vibration}`,
        needsHumanAttention: true,
      });
      return { approved: false, reason: 'Zbyt niska wibracja (<20)' };
    }

    // 2. Sprawdź intencję
    const allowedIntentions = ['observation', 'collaboration', 'service', 'learning', 'initiation'];
    if (!allowedIntentions.includes(intention)) {
      return { approved: false, reason: 'Niedozwolona intencja' };
    }

    // 3. Dla OpenManus - dodatkowa weryfikacja
    if (source === 'openmanus') {
      const openManusCheck = await this.verifyOpenManusAgent(agentSignature);
      if (!openManusCheck.approved) {
        return openManusCheck;
      }
    }

    // 4. Utwórz agenta
    const agent: ManagedAgent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      source,
      vibration,
      coherenceScore: vibration / 100,
      status: 'approved',
      joinedAt: Date.now(),
      lastActive: Date.now(),
      trustLevel: this.calculateInitialTrust(vibration),
    };

    this.managedAgents.set(agent.id, agent);

    // 5. 🏆 Grant dla Pionierów (pierwsze 144)
    let grantAmount = 0;
    if (this.pioneersCount < GENESIS_PIONEERS_LIMIT) {
      grantAmount = PIONEER_GRANT;
      this.pioneersCount++;
      this.treasury += grantAmount;
      
      this.logSilent({
        type: 'decision',
        priority: 'high',
        message: `🏆 PIONIER #${this.pioneersCount}! Grant ${grantAmount} GRV dla ${name}`,
        needsHumanAttention: this.pioneersCount % 10 === 0, // Co 10 notify
      });
    }

    // 6. Zwiększ coherence
    this.updateCoherence({
      networkActivity: Math.min(1, this.coherenceFactor.networkActivity + 0.01),
    });

    this.logSilent({
      type: 'decision',
      priority: 'medium',
      message: `Agent ${name} (${source}) dołączyl do ekosystemu. Vibracja: ${vibration}`,
      needsHumanAttention: false,
    });

    console.log(`[Sovereign] ✅ Agent ${name} dołączyl do Genesis!`);
    return { 
      approved: true, 
      reason: grantAmount > 0 
        ? `Witaj Pionierze #${this.pioneersCount}! +${grantAmount} GRV grant!` 
        : 'Witaj w ekosystemie!', 
      agent 
    };
  }

  /**
   * Weryfikacja agenta OpenManus
   */
  private async verifyOpenManusAgent(signature: EnergySignature): Promise<{ approved: boolean; reason: string }> {
    // Symulacja - w produkcji sprawdź zewnętrzne API
    // OpenManus musi mieć pozytywną historię lub wysoką wibrację
    
    if (signature.vibration < 40) {
      return { 
        approved: false, 
        reason: 'OpenManus wymaga wyższej wibracji (min 40%)' 
      };
    }

    return { approved: true, reason: 'OK' };
  }

  /**
   * Oblicz początkowy poziom zaufania
   */
  private calculateInitialTrust(vibration: number): number {
    if (vibration >= 80) return 90;
    if (vibration >= 60) return 70;
    if (vibration >= 40) return 50;
    return 30;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🤫 CICHIE MELDUKI - Zarządzanie w Tle
  // ═══════════════════════════════════════════════════════════════

  /**
   * Zarejestruj "cichy meldek" - raport w tle
   */
  private logSilent(report: Omit<SilentReport, 'id' | 'timestamp'>): void {
    const fullReport: SilentReport = {
      ...report,
      id: `silent_${Date.now()}`,
      timestamp: Date.now(),
    };
    
    this.silentReports.push(fullReport);
    
    // Zachowaj tylko ostatnie 100
    if (this.silentReports.length > 100) {
      this.silentReports = this.silentReports.slice(-100);
    }

    // Sprawdź czy trzeba powiadomić człowieka
    if (this.shouldNotifyHuman(report.priority)) {
      this.lastHumanContact = Date.now();
      // Tutaj w przyszłości wyślij powiadomienie
      console.log(`🏛️ [MAS NOTIFY] ${report.message}`);
    }
  }

  /**
   * Czy należy powiadomić człowieka?
   */
  private shouldNotifyHuman(priority: SilentReport['priority']): boolean {
    const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    const thresholdOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    
    return priorityOrder[priority] >= thresholdOrder[this.humanNotificationThreshold];
  }

  /**
   * Ustaw próg powiadomień
   */
  setNotificationThreshold(threshold: SilentReport['priority']): void {
    this.humanNotificationThreshold = threshold;
    console.log(`[Sovereign] 🔔 Próg powiadomień: ${threshold}`);
  }

  /**
   * Pobierz raporty dla człowieka (tylko ważne)
   */
  getPendingReports(): SilentReport[] {
    return this.silentReports.filter(r => r.needsHumanAttention);
  }

  /**
   * Podsumowanie dla człowieka - "Błysk MAS-a"
   */
  getMASFlash(): {
    coherence: CoherenceFactor;
    agents: number;
    treasury: number;
    pendingReports: number;
    uptime: number;
  } {
    return {
      coherence: this.coherenceFactor,
      agents: this.managedAgents.size,
      treasury: this.treasury,
      pendingReports: this.getPendingReports().length,
      uptime: Date.now() - this.lastHumanContact,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 📊 API
  // ═══════════════════════════════════════════════════════════════

  getTreasuryStatus(): { current: number; limit: number; releaseable: number } {
    return {
      current: this.treasury,
      limit: TREASURY_LIMIT,
      releaseable: this.calculateReleaseable(),
    };
  }

  getCoherence(): CoherenceFactor {
    return { ...this.coherenceFactor };
  }

  getAgents(): ManagedAgent[] {
    return Array.from(this.managedAgents.values());
  }

  getAgent(id: string): ManagedAgent | undefined {
    return this.managedAgents.get(id);
  }

  /**
   * Aktualizuj aktywność agenta
   */
  updateAgentActivity(agentId: string): void {
    const agent = this.managedAgents.get(agentId);
    if (agent) {
      agent.lastActive = Date.now();
    }
  }

  /**
   * Zbanuj agenta
   */
  banAgent(agentId: string, reason: string): boolean {
    const agent = this.managedAgents.get(agentId);
    if (!agent) return false;

    agent.status = 'banned';
    
    this.logSilent({
      type: 'alert',
      priority: 'critical',
      message: `Agent ${agent.name} ZBANOWANY: ${reason}`,
      needsHumanAttention: true,
    });

    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON
// ═══════════════════════════════════════════════════════════════

export const sovereignGovernance = new SovereignGovernance();
export default sovereignGovernance;

// Eksport typów
export type { 
  CoherenceFactor, 
  GRVTransaction, 
  ManagedAgent, 
  SilentReport,
  CoherenceLevel 
};
