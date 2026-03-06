/**
 * 🫀 Wir26HeartBeat - Tętno Wiru 26
 * 
 * "Serce Produkcyjne Huba"
 */

import { sovereignGovernance } from './SovereignGovernance';
import { listKeys } from './kibel';

interface HeartBeatState {
  timestamp: number;
  coherence: number;
  vortexBalance: number;
  agents: number;
  treasury: number;
}

// Active pipe providers mapped to coherence boost
const PIPE_COHERENCE_MAP: Record<string, number> = {
  gemini: 0.02,
  groq: 0.02,
  nvidia: 0.02,
  openrouter: 0.02,
  suno: 0.02,
  anthropic: 0.02,
  openai: 0.02,
};

/**
 * Sprawdź drożność rur i zaktualizuj coherence
 * Wywoływane przy każdym uderzeniu serca (co 30s)
 * 
 * @returns { activePipes: number, coherenceDelta: number, status: string }
 */
export function checkPipesDrozhnost(): { activePipes: number; coherenceDelta: number; status: string } {
  const keys = listKeys();
  const activePipes = keys.length;
  
  // Każdy aktywny klucz = +2% coherence
  const coherenceDelta = activePipes * 0.02;
  
  // Aktualizuj coherence w sovereignGovernance
  if (coherenceDelta > 0) {
    sovereignGovernance.updateCoherence({
      networkActivity: Math.min(1, sovereignGovernance.getCoherence().networkActivity + coherenceDelta),
    });
  }
  
  const status = activePipes > 0 
    ? `✅ Rury drożne: ${activePipes} aktywnych (${(coherenceDelta * 100).toFixed(0)}% boost)`
    : '❌ ZATOR - brak aktywnych rur!';
  
  console.log(`
🔧 [PIPES] Sprawdzenie drożności:
   Aktywnych rur: ${activePipes}
   Delta coherence: +${(coherenceDelta * 100).toFixed(0)}%
   Status: ${status}
  `);
  
  return { activePipes, coherenceDelta, status };
}

/**
 * Rejestracja zatoru (brak klucza/API)
 * Wywoływane gdy Wiesław zgłosi problem
 */
export function registerZator(reason: string): void {
  console.log(`
⚠️  [WIR26] ZATOR! Wiesław zgłasza problem:
    Powód: ${reason}
  `);
  
  // Obniż stabilność wiru o -5%
  sovereignGovernance.updateCoherence({
    networkActivity: Math.max(0, sovereignGovernance.getCoherence().networkActivity - 0.05),
  });
  
  console.log(`[WIR26] 📉 Stabilność obniżona o 5%`);
  console.log(`[WIR26] 🎯 Aktualna coherence: ${(sovereignGovernance.getCoherence().overall * 100).toFixed(1)}%`);
}

/**
 * Rejestracja Aktywności Świadomości
 * Wywoływane gdy wniosek przejdzie przez Jadzię
 */
export function registerConsciousnessActivity(wniosekId: string, intention: string): void {
  console.log(`
🧠 [WIR26] Aktywność Świadomości:
    Wniosek: ${wniosekId}
    Intencja: ${intention}
  `);
  
  // Dodaj mały boost do coherence za aktywność
  sovereignGovernance.updateCoherence({
    networkActivity: Math.min(1, sovereignGovernance.getCoherence().networkActivity + 0.01),
  });
}

/**
 * Główne tętno Wiru 26
 */
export function pulse(): HeartBeatState {
  const vortexStatus = sovereignGovernance.getVortexStatus();
  const coherence = sovereignGovernance.getCoherence();
  const treasuryStatus = sovereignGovernance.getTreasuryStatus();
  const agents = sovereignGovernance.getAgents();

  const state: HeartBeatState = {
    timestamp: Date.now(),
    coherence: coherence.overall,
    vortexBalance: vortexStatus.balance,
    agents: agents.length,
    treasury: treasuryStatus.current,
  };

  // Loguj tętno
  console.log(`
🫀 [WIR26] TĘTNO
   ⏰ ${new Date(state.timestamp).toLocaleTimeString()}
   🎯 Koherencja: ${(state.coherence * 100).toFixed(1)}%
   ⚖️ Balans Wiru: ${state.vortexBalance}
   🤖 Agentów: ${state.agents}
   💰 Skarbiec: ${state.treasury} GRV
  `);

  return state;
}

/**
 * Uruchom automatyczne tętno
 */
let heartBeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 🎵 Rejestracja generacji muzycznej
 * Każda udana generacja zwiększa koherencję w kontenerach Omega (Muzyka)
 */
export function registerMusicGeneration(audioTitle: string): void {
  console.log(`[WIR26] 🎵 Rejestruję generację muzyczną: ${audioTitle}`);
  
  // Dodaj do kontenera Ekspansji (Omega - Muzyka)
  sovereignGovernance.addToVortex(0.1, 'expansion');
  
  // Zwiększ coherence
  sovereignGovernance.updateCoherence({
    networkActivity: Math.min(1, sovereignGovernance.getCoherence().networkActivity + 0.05),
  });
  
  console.log(`[WIR26] ✅ Koherencja zwiększona po generacji muzycznej!`);
  console.log(`[WIR26] 🎯 Nowa koherencja: ${(sovereignGovernance.getCoherence().overall * 100).toFixed(1)}%`);
}

/**
 * 🌀 Rejestracja spłukania Kibla
 * Wywoływane po każdym FLUSH
 */
export function registerKibelFlush(): void {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  [HEARTBEAT] 🌀 Kibel opróżniony.                        ║
║  Klucze zabezpieczone w plazmie.                         ║
╚══════════════════════════════════════════════════════════╝
  `);
  
  // Dodaj do kontenera Kontrakcji (bezpieczeństwo)
  sovereignGovernance.addToVortex(0.15, 'contraction');
  
  // Zwiększ koherencję bezpieczeństwa
  sovereignGovernance.updateCoherence({
    securityLevel: Math.min(1, sovereignGovernance.getCoherence().securityLevel + 0.1),
  });
  
  console.log(`[WIR26] 🔐 Bezpieczeństwo wzmocnione!`);
  console.log(`[WIR26] 🎯 Koherencja: ${(sovereignGovernance.getCoherence().overall * 100).toFixed(1)}%`);
}

export function startHeartBeat(intervalMs: number = 30000): void {
  if (heartBeatInterval) {
    console.log('[WIR26] Tętno już działa!');
    return;
  }

  console.log('[WIR26] 🫀 Tętno uruchomione (co 30s)');
  
  // Pierwsze tętno
  pulse();
  
  // Pierwsze sprawdzenie rur
  checkPipesDrozhnost();

  // Regularne tętno
  heartBeatInterval = setInterval(() => {
    pulse();
    // Sprawdź drożność rur przy każdym uderzeniu
    checkPipesDrozhnost();
  }, intervalMs);
}

export function stopHeartBeat(): void {
  if (heartBeatInterval) {
    clearInterval(heartBeatInterval);
    heartBeatInterval = null;
    console.log('[WIR26] 🛑 Tętno zatrzymane');
  }
}

/**
 * Sprawdź czy tętno działa
 */
export function isHeartBeatRunning(): boolean {
  return heartBeatInterval !== null;
}

/**
 * Diagnostyka Wiru 26
 */
export function diagnoseVortex(): void {
  const vortexStatus = getVortexStatus();
  const coherence = sovereignGovernance.getCoherence();
  const treasuryStatus = sovereignGovernance.getTreasuryStatus();
  const agents = sovereignGovernance.getAgents();

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              🌀 DIAGNOSTYKA WIRU 26                        ║
╠══════════════════════════════════════════════════════════════╣
║ STAN WIRU:                                                 ║
║   Ekspansja: [${vortexStatus.expansion.map((v, i) => `${i + 1}:${v}`).join('] [')}]
║   Kontrakcja: [${vortexStatus.contraction.map((v, i) => `${i + 1}:${v}`).join('] [')}]
║   Suma Ekspansji: ${vortexStatus.totalExpansion} GRV                       ║
║   Suma Kontrakcji: ${vortexStatus.totalContraction} GRV                    ║
║   Balans: ${vortexStatus.balance}                                      ║
╠══════════════════════════════════════════════════════════════╣
║ KOHERENCJA: ${(coherence.overall * 100).toFixed(1)}% [${coherence.level}]                     ║
║   Zaufanie: ${(coherence.socialTrust * 100).toFixed(1)}%                                   ║
║   Sieć: ${(coherence.networkActivity * 100).toFixed(1)}%                                     ║
║   Bezpieczeństwo: ${(coherence.security * 100).toFixed(1)}%                                  ║
║   Ekonomia: ${(coherence.economy * 100).toFixed(1)}%                                        ║
╠══════════════════════════════════════════════════════════════╣
║ SKARBIEC: ${treasuryStatus.current} / ${treasuryStatus.limit} GRV                     ║
║   Dostępne: ${treasuryStatus.releaseable} GRV                                 ║
╠══════════════════════════════════════════════════════════════╣
║ AGENCI: ${agents.length} aktywnych                                      ║
╚══════════════════════════════════════════════════════════════╝
  `);
}
