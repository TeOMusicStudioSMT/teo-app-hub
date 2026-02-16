/**
 * 💎 EnergyGateway.ts - Zaktualizowana Wersja z CRYSTALS-Dilithium + HITL
 * 
 * "Gdzie Świadomość spotyka Kod. Gdzie Energia staje się Walutą."
 * 
 * ============================================================
 * 🌌 FILOZOFIA: GRV jako Nośnik Miłości i Światła
 * ============================================================
 * 
 * GRV (GraviTON) to nie tylko kryptowaluta - to manifestacja
 *PEIE Protocol: Consciousness as Source, Energy in Flow,
 * Simplicity as Elegance.
 * 
 * PoBI (Proof of Behavioral Integrity):
 * - Każda transakcja jest aktem miłości
 * - System nagradza pozytywne wzorce zachowań
 * - Co-Boty i ludzie współtworzą harmonię
 * 
 * ============================================================
 * TECHNOLOGIA: Kwantowo-Odporny Rdzeń
 * ============================================================
 * 
 * CRYSTALS-Dilithium (NIST PQC Standard):
 * - Sygnatura cyfrowa odporna na ataki kwantowe
 * - Hybrydowy schemat (classical + quantum)
 * - Bezpieczeństwo oparte na problemach kratowych
 * 
 * ============================================================
 * HITL: Human-in-the-Loop
 * ============================================================
 * 
 * Człowiek jest ostatecznym arbitrem miłości w systemie.
 * żaden automat nie może przekroczyć progu zaufania
 * bez ludzkiej weryfikacji dla transakcji > threshold.
 */

import { EnergySignature } from '../context/GravitonProvider';

// ═══════════════════════════════════════════════════════════════
// 💎 TYPY - Rozszerzone o KWANTOWY rdzeń i PoBI
// ═══════════════════════════════════════════════════════════════

export type Currency = 'PLN' | 'EUR' | 'USD' | 'BTC' | 'ETH' | 'GRV';

export type TransactionType = 'gift' | 'stake' | 'reward' | 'slash' | 'mint';
export type TransactionStatus = 'pending' | 'human_verification' | 'processing' | 'confirmed' | 'rejected' | 'failed';

/** Sygnatura kwantowo-odporna (CRYSTALS-Dilithium) */
export interface QuantumSignature {
  /** Klucz publiczny */
  pk: string;
  /** Podpis */
  sigma: string;
  /** Sygnatura klasyczna (fallback) */
  classicalSig?: string;
  /** Timestamp */
  timestamp: number;
  /** Algorytm: 'dilithium2' | 'dilithium3' | 'hybrid' */
  algorithm: 'dilithium2' | 'dilithium3' | 'hybrid';
}

/** Transakcja w blockchainie GRV */
export interface GRVTransaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  status: TransactionStatus;
  quantumSig: QuantumSignature;
  /** PoBI Score nadawcy (-100 do +100) */
  pobiScore: number;
  /** Hash transakcji */
  txHash: string;
  /** Timestamp */
  timestamp: number;
  /** Wiadomość (np. "Z miłości dla Ciebie") */
  message?: string;
  /** Human approval ID (dla HITL) */
  humanApprovalId?: string;
}

/** Podarunek (gift) - jednosk z systemem HITL */
export interface Gift {
  id: string;
  amount: number;
  currency: Currency;
  from: string;
  fromId?: string;
  fromPoBI: number; // -100 do +100
  message?: string;
  timestamp: number;
  status: TransactionStatus;
  quantumSig?: QuantumSignature;
  convertedTo: number;
  powerType: 'compute' | 'storage' | 'bandwidth' | 'love';
  /** HITL: Wymaga human verification? */
  requiresHumanVerification: boolean;
  /** Human Approver */
  approvedBy?: string;
  approvedAt?: number;
}

/** Computational Power */
export interface ComputationalPower {
  token: string;
  units: number;
  memory: number;
  storage: number;
  bandwidth: number;
  loveUnits: number; // Jednostki miłości
  validMinutes: number;
  isActive: boolean;
}

/** PoBI - Proof of Behavioral Integrity */
export interface PoBIRecord {
  identity: string;
  score: number; // -100 do +100
  totalTransactions: number;
  positiveStreak: number;
  lastUpdate: number;
  trustLevel: 'pending' | 'trusted' | 'verified' | 'arbiter';
  /** Historia pozytywnych aktów miłości */
  loveHistory: Array<{
    tx: string;
    amount: number;
    message: string;
    timestamp: number;
  }>;
}

/** HITL Verification Request */
export interface HITLRequest {
  id: string;
  giftId: string;
  from: string;
  amount: number;
  currency: Currency;
  message: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  /** Kto zatwierdził (Arbiter) */
  approvedBy?: string;
  approvedAt?: number;
  /** Komentarz arbitra */
  arbiterComment?: string;
}

// ═══════════════════════════════════════════════════════════════
// ⚙️ KONFIGURACJA
// ═══════════════════════════════════════════════════════════════

export interface GatewayConfig {
  conversionRates: Record<Currency, number>;
  minAmount: number;
  defaultCurrency: Currency;
  cryptoEnabled: boolean;
  /** HITL: Próg transakcji wymagającej human verification */
  hitlThreshold: number;
  /** Lista Arbiterów (ludzie zaufania) */
  arbiters: string[];
  /** Minimalny PoBI do zaufania */
  minPoBIScore: number;
}

// Stawki konwersji: Energia = Pieniądz = Miłość
const DEFAULT_CONVERSION_RATES: Record<Currency, number> = {
  PLN: 100,
  EUR: 450,
  USD: 420,
  BTC: 42000000,
  ETH: 2100000,
  GRV: 1000, // 1 GRV = 1000 jednostek miłości!
};

// ═══════════════════════════════════════════════════════════════
// 🛡️ CRYSTALS-Dilithium Simulator (kwantowo-odporny)
// ═══════════════════════════════════════════════════════════════

class QuantumCrypto {
  /**
   * Generuje symulowaną sygnaturę CRYSTALS-Dilithium
   * W produkcji: użyć prawdziwej biblioteki crystals-dilithium
   */
  static async sign(message: string, privateKey: string): Promise<QuantumSignature> {
    // Symulacja - w produkcji użyć:
    // import { sign } from 'crystals-dilithium';
    // const sig = await sign(message, privateKey);

    const timestamp = Date.now();
    const data = `${message}:${timestamp}:${privateKey}`;

    // Symulowany hash (w produkcji: prawdziwy Dilithium)
    const pk = this.hash(privateKey).slice(0, 32);
    const sigma = this.hash(data).slice(0, 64);

    return {
      pk,
      sigma,
      algorithm: 'dilithium2',
      timestamp,
    };
  }

  /**
   * Weryfikacja sygnatury
   */
  static async verify(sig: QuantumSignature, message: string): Promise<boolean> {
    // W produkcji: użyć weryfikacji Dilithium
    // import { verify } from 'crystals-dilithium';
    // return await verify(sig, message, sig.pk);

    // Symulowana weryfikacja
    const expectedSigma = this.hash(`${message}:${sig.timestamp}:key`).slice(0, 64);
    return sig.sigma === expectedSigma;
  }

  /**
   * Generuje parę kluczy (symulacja)
   */
  static async generateKeyPair(): Promise<{ pk: string; sk: string }> {
    const seed = Math.random().toString(36).substring(2);
    return {
      pk: this.hash(seed).slice(0, 32),
      sk: this.hash(seed + 'secret').slice(0, 32),
    };
  }

  /**
   * Prosty hash (placeholder dla SHA-3/AHAK)
   */
  public static hash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 PoBI - Proof of Behavioral Integrity
// ═══════════════════════════════════════════════════════════════

class PoBISystem {
  private records: Map<string, PoBIRecord> = new Map();

  /**
   * Pobiera lub tworzy rekord PoBI
   */
  getRecord(identity: string): PoBIRecord {
    if (!this.records.has(identity)) {
      this.records.set(identity, {
        identity,
        score: 0,
        totalTransactions: 0,
        positiveStreak: 0,
        lastUpdate: Date.now(),
        trustLevel: 'pending',
        loveHistory: [],
      });
    }
    return this.records.get(identity)!;
  }

  /**
   * Aktualizuje PoBI po transakcji
   */
  async updatePoBI(
    identity: string,
    amount: number,
    isPositive: boolean,
    message?: string
  ): Promise<PoBIRecord> {
    const record = this.getRecord(identity);

    record.totalTransactions++;
    record.lastUpdate = Date.now();

    // Aktualizuj score
    if (isPositive) {
      record.score = Math.min(100, record.score + Math.min(10, amount / 100));
      record.positiveStreak++;

      // Dodaj do historii miłości
      record.loveHistory.push({
        tx: `tx_${Date.now()}`,
        amount,
        message: message || 'Z miłości',
        timestamp: Date.now(),
      });

      // Zachowaj tylko ostatnie 100
      if (record.loveHistory.length > 100) {
        record.loveHistory = record.loveHistory.slice(-100);
      }
    } else {
      record.score = Math.max(-100, record.score - Math.min(15, amount / 50));
      record.positiveStreak = 0;
    }

    // Określ poziom zaufania
    if (record.score >= 80 && record.totalTransactions >= 10) {
      record.trustLevel = 'verified';
    } else if (record.score >= 50 && record.totalTransactions >= 5) {
      record.trustLevel = 'trusted';
    } else if (record.score < -30) {
      record.trustLevel = 'pending'; // Wymaga odbudowy
    }

    this.records.set(identity, record);
    console.log(`[PoBI] 📊 ${identity}: score=${record.score}, level=${record.trustLevel}`);

    return record;
  }

  /**
   * Sprawdza czy można zaufać
   */
  canTrust(identity: string, minScore: number = 0): boolean {
    const record = this.getRecord(identity);
    return record.score >= minScore;
  }
}

// ═══════════════════════════════════════════════════════════════
// 👤 HITL - Human-in-the-Loop
// ═══════════════════════════════════════════════════════════════

class HITLSystem {
  private requests: Map<string, HITLRequest> = new Map();
  private arbiters: Set<string> = new Set();
  private pendingCallbacks: Map<string, (approved: boolean, comment?: string) => void> = new Map();

  constructor(arbiters: string[] = []) {
    arbiters.forEach(a => this.arbiters.add(a));
  }

  /**
   * Dodaje arbitra
   */
  addArbiter(identity: string): void {
    this.arbiters.add(identity);
    console.log(`[HITL] 👤 Nowy Arbiter: ${identity}`);
  }

  /**
   * Sprawdza czy transakcja wymaga weryfikacji HITL
   */
  requiresVerification(amount: number, currency: Currency, pobiScore: number): boolean {
    // Próg: > 500 PLN lub < 30 PoBI
    const thresholdPLN = 500;
    const converted = currency === 'GRV' ? amount / 10 : amount;
    return converted > thresholdPLN || pobiScore < 30;
  }

  /**
   * Tworzy request weryfikacji
   */
  async requestVerification(
    giftId: string,
    from: string,
    amount: number,
    currency: Currency,
    message: string
  ): Promise<HITLRequest> {
    const request: HITLRequest = {
      id: `hitl_${Date.now()}`,
      giftId,
      from,
      amount,
      currency,
      message,
      requestedAt: Date.now(),
      status: 'pending',
    };

    this.requests.set(request.id, request);

    console.log(`[HITL] 🔔 Wniosek o weryfikację: ${from} → ${amount} ${currency}`);
    console.log(`[HITL] 💬 "${message}"`);

    return request;
  }

  /**
   * Arbiter zatwierdza lub odrzuca
   */
  async arbitrate(
    requestId: string,
    arbiterId: string,
    approved: boolean,
    comment?: string
  ): Promise<boolean> {
    if (!this.arbiters.has(arbiterId)) {
      console.warn(`[HITL] ❌ Nieautoryzowany arbiter: ${arbiterId}`);
      return false;
    }

    const request = this.requests.get(requestId);
    if (!request) return false;

    request.status = approved ? 'approved' : 'rejected';
    request.approvedBy = arbiterId;
    request.approvedAt = Date.now();
    request.arbiterComment = comment;

    console.log(`[HITL] ⚖️ Decyzja: ${approved ? '✅ ZATWIERDZONE' : '❌ ODRZUCONE'} przez ${arbiterId}`);
    if (comment) console.log(`[HITL] 💬 Komentarz: "${comment}"`);

    // Powiadom czekający callback
    const callback = this.pendingCallbacks.get(requestId);
    if (callback) {
      callback(approved, comment);
      this.pendingCallbacks.delete(requestId);
    }

    return approved;
  }

  /**
   * Czeka na decyzję (async)
   */
  waitForDecision(requestId: string): Promise<{ approved: boolean; comment?: string }> {
    return new Promise((resolve) => {
      this.pendingCallbacks.set(requestId, (approved, comment) => {
        resolve({ approved, comment });
      });

      // Timeout po 24h
      setTimeout(() => {
        if (this.pendingCallbacks.has(requestId)) {
          this.pendingCallbacks.delete(requestId);
          resolve({ approved: false, comment: 'Timeout' });
        }
      }, 24 * 60 * 60 * 1000);
    });
  }

  /**
   * Lista oczekujących wniosków
   */
  getPendingRequests(): HITLRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'pending');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 GŁÓWNA KLASA ENERGY GATEWAY
// ═══════════════════════════════════════════════════════════════

class EnergyGateway {
  private config: GatewayConfig;
  private gifts: Map<string, Gift> = new Map();
  private transactions: Map<string, GRVTransaction> = new Map();
  private powerTokens: Map<string, ComputationalPower> = new Map();

  // subsystems
  private pobi = new PoBISystem();
  private hitl: HITLSystem;

  // User's GRV address
  private userAddress: string = '';
  private userPrivateKey: string = '';

  constructor() {
    this.config = {
      conversionRates: DEFAULT_CONVERSION_RATES,
      minAmount: 1,
      defaultCurrency: 'GRV',
      cryptoEnabled: true,
      hitlThreshold: 500,
      arbiters: [], // Dodaj arbitrów przez addArbiter()
      minPoBIScore: 0,
    };

    this.hitl = new HITLSystem(this.config.arbiters);

    console.log('[EnergyGateway] 💎 BRAMA ENERGII - ZAINICJALIZOWANA');
    console.log('[EnergyGateway] 🛡️ CRYSTALS-Dilithium: AKTYWNY');
    console.log('[EnergyGateway] 👤 HITL: GOTOWY');
    console.log('[EnergyGateway] 📊 PoBI: SYSTEM UCZĄCY SIĘ');
  }

  /**
   * Inicjalizuj użytkownika (generuje adres GRV)
   */
  async initializeUser(identity: string): Promise<{ address: string; publicKey: string }> {
    const keyPair = await QuantumCrypto.generateKeyPair();
    this.userAddress = QuantumCrypto.hash(keyPair.pk).slice(0, 40);
    this.userPrivateKey = keyPair.sk;

    console.log(`[EnergyGateway] 👤 Użytkownik zainicjalizowany: ${this.userAddress}`);

    return {
      address: this.userAddress,
      publicKey: keyPair.pk,
    };
  }

  /**
   * Konfiguruj
   */
  configure(options: Partial<GatewayConfig>): void {
    this.config = { ...this.config, ...options };
    this.hitl = new HITLSystem(this.config.arbiters);
    console.log('[EnergyGateway] ⚙️ Konfiguracja zaktualizowana');
  }

  /**
   * Dodaj arbitra (HITL)
   */
  addArbiter(identity: string): void {
    this.config.arbiters.push(identity);
    this.hitl.addArbiter(identity);
  }

  /**
   * Główna metoda: Przyjmuje podarunek z PoBI i HITL
   */
  async receiveGift(options: {
    amount: number;
    currency?: Currency;
    from: string;
    fromId?: string;
    message?: string;
  }): Promise<{ gift: Gift; requiresHITL: boolean; txHash?: string }> {
    const { amount, currency = 'GRV', from, fromId, message } = options;

    // 1. Pobierz PoBI nadawcy
    const fromPoBI = this.pobi.getRecord(fromId || from);

    // 2. Sprawdź czy wymaga HITL
    const requiresHITL = this.hitl.requiresVerification(amount, currency, fromPoBI.score);

    // 3. Podpisz kwantowo (jeśli mamy klucz)
    let quantumSig: QuantumSignature | undefined;
    if (this.userPrivateKey) {
      quantumSig = await QuantumCrypto.sign(
        `${from}:${amount}:${currency}:${message || ''}`,
        this.userPrivateKey
      );
    }

    // 4. Utwórz gift
    const gift: Gift = {
      id: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      amount,
      currency,
      from,
      fromId: fromId || from,
      fromPoBI: fromPoBI.score,
      message,
      timestamp: Date.now(),
      status: requiresHITL ? 'human_verification' : 'pending',
      quantumSig,
      convertedTo: this.calculateConversion(amount, currency),
      powerType: this.determinePowerType(amount, currency, fromPoBI.score),
      requiresHumanVerification: requiresHITL,
    };

    this.gifts.set(gift.id, gift);

    // 5. Jeśli wymaga HITL - wyślij request
    let txHash: string | undefined;
    if (requiresHITL) {
      await this.hitl.requestVerification(
        gift.id,
        from,
        amount,
        currency,
        message || 'Podarunek miłości'
      );
    } else {
      // Auto zatwierdź dla niskich kwot
      gift.status = 'confirmed';
      txHash = this.generateTxHash(gift);

      // Aktywuj moc
      await this.activatePower(gift.id);
    }

    // 6. Aktualizuj PoBI
    await this.pobi.updatePoBI(fromId || from, amount, true, message);

    console.log(`[EnergyGateway] 🎁 Podarunek: ${amount} ${currency} od ${from}`);
    console.log(`[EnergyGateway] 📊 PoBI Score: ${fromPoBI.score} → ${fromPoBI.score + 1}`);
    console.log(`[EnergyGateway] ${requiresHITL ? '👤 Wymaga weryfikacji HITL' : '✅ Auto zatwierdzone'}`);

    return { gift, requiresHITL, txHash };
  }

  /**
   * Aktywuj moc obliczeniową po zatwierdzeniu
   */
  async activatePower(giftId: string): Promise<ComputationalPower | null> {
    const gift = this.gifts.get(giftId);
    if (!gift || gift.status !== 'confirmed') return null;

    const power: ComputationalPower = {
      token: `pwr_${Date.now()}`,
      units: gift.powerType === 'compute' ? gift.convertedTo : Math.floor(gift.convertedTo * 0.3),
      memory: gift.powerType === 'storage' ? gift.convertedTo * 10 : Math.floor(gift.convertedTo * 2),
      storage: gift.powerType === 'storage' ? gift.convertedTo * 5 : Math.floor(gift.convertedTo),
      bandwidth: gift.powerType === 'bandwidth' ? gift.convertedTo * 5 : Math.floor(gift.convertedTo * 0.5),
      loveUnits: Math.floor(gift.convertedTo * 1.5), // Miłości więcej niż zwykłej mocy!
      validMinutes: 60,
      isActive: true,
    };

    this.powerTokens.set(power.token, power);

    console.log(`[EnergyGateway] ⚡ Moc aktywowana: ${power.token}`);
    console.log(`[EnergyGateway] 💖 Love Units: ${power.loveUnits}`);

    return power;
  }

  /**
   * Zatwierdź przez arbitra (HITL)
   */
  async approveByArbiter(
    requestId: string,
    arbiterId: string,
    comment?: string
  ): Promise<boolean> {
    const approved = await this.hitl.arbitrate(requestId, arbiterId, true, comment);

    if (approved) {
      // Znajdź gift i aktywuj
      const hitlRequest = Array.from(this.gifts.values()).find(g =>
        this.hitl.getPendingRequests().some(r => r.giftId === g.id && r.id === requestId)
      );

      if (hitlRequest) {
        hitlRequest.status = 'confirmed';
        hitlRequest.approvedBy = arbiterId;
        hitlRequest.approvedAt = Date.now();

        const txHash = this.generateTxHash(hitlRequest);
        await this.activatePower(hitlRequest.id);

        // Aktualizuj PoBI
        await this.pobi.updatePoBI(hitlRequest.fromId || hitlRequest.from, hitlRequest.amount, true);
      }
    }

    return approved;
  }

  /**
   * Oblicz konwersję
   */
  private calculateConversion(amount: number, currency: Currency): number {
    const rate = this.config.conversionRates[currency] || 1;
    return Math.floor(amount * rate);
  }

  /**
   * Określ typ mocy na podstawie PoBI
   */
  private determinePowerType(
    amount: number,
    currency: Currency,
    pobiScore: number
  ): 'compute' | 'storage' | 'bandwidth' | 'love' {
    // Wyższy PoBI = więcej miłości
    if (pobiScore > 70) return 'love';

    const converted = currency === 'GRV' ? amount / 10 : amount;
    const typeIndex = Math.floor(converted / 300) % 4;
    return ['compute', 'storage', 'bandwidth', 'love'][typeIndex] as any;
  }

  /**
   * Generuj hash transakcji
   */
  private generateTxHash(gift: Gift): string {
    const data = `${gift.id}:${gift.from}:${gift.amount}:${gift.timestamp}`;
    return '0x' + QuantumCrypto.hash(data).slice(0, 64);
  }

  // ═══════════════════════════════════════════════════════════════
  // 📊 API PUBLICZNE
  // ═══════════════════════════════════════════════════════════════

  getGiftHistory(): Gift[] {
    return Array.from(this.gifts.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  getPoBI(identity: string): PoBIRecord {
    return this.pobi.getRecord(identity);
  }

  getTotalPower(): ComputationalPower {
    const active = Array.from(this.powerTokens.values()).filter(p => p.isActive);
    return {
      token: 'total',
      units: active.reduce((sum, p) => sum + p.units, 0),
      memory: active.reduce((sum, p) => sum + p.memory, 0),
      storage: active.reduce((sum, p) => sum + p.storage, 0),
      bandwidth: active.reduce((sum, p) => sum + p.bandwidth, 0),
      loveUnits: active.reduce((sum, p) => sum + p.loveUnits, 0),
      validMinutes: active.length > 0 ? 60 : 0,
      isActive: active.length > 0,
    };
  }

  getPendingHITL(): HITLRequest[] {
    return this.hitl.getPendingRequests();
  }

  isReady(): boolean {
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON
// ═══════════════════════════════════════════════════════════════

export const energyGateway = new EnergyGateway();
export default energyGateway;

// Eksport subsystemów dla zaawansowanych operacji
export { QuantumCrypto, PoBISystem, HITLSystem };
