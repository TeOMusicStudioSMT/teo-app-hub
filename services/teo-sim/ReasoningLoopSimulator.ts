/**
 * 🎮 ReasoningLoopSimulator — Rdzeń TeO-Sim Academy (Kotwica Prawdy + 3 warstwy)
 *
 * Wdraża zatwierdzony przez Radę raport (konwersacja_1781644057217.md):
 *   WARSTWA 1 — Validator-Czarodziej (State Delta Check): "myśl" agenta musi
 *               faktycznie zmniejszyć liczbę błędów stanu, inaczej = halucynacja.
 *   WARSTWA 2 — Dynamiczna Alokacja (Model Switcher): start LIGHT; eskalacja do
 *               HEAVY gdy agent utknie / Validator odrzuci rozwiązanie.
 *   WARSTWA 3 — Logika Kar i Nagród (Ekonomia Tokenowa): nagroda za rozwiązanie
 *               przy minimalnej liczbie tokenów; kara za halucynacje.
 *   + Chaos Engine: wstrzykiwanie sztucznych błędów VRAM (Stall/Aborted).
 *
 * Stream logów myślowych trafia do simulationStore (zustand) → Dashboard.
 */

import { LocalModelAdapter } from './LocalModelAdapter';
import { useSimulationStore, type SimulationResult } from '../../store/simulationStore';

// ── WARSTWA 1: Validator-Czarodziej (State Delta Check) ────────────────────────
class StateValidator {
    /** Czy liczba błędów (error/stall/aborted) spadła? */
    checkDelta(before: string, after: string): boolean {
        const count = (s: string) => (s.match(/error|stall|aborted/gi) || []).length;
        return count(after) < count(before);
    }
}

// ── WARSTWA 2: Dynamiczna Alokacja ─────────────────────────────────────────────
enum ModelTier { LIGHT = 'LIGHT (szybki)', HEAVY = 'HEAVY (głęboki)' }

const MAX_LOOPS = 8;

export class ReasoningLoopSimulator {
    private adapter   = new LocalModelAdapter();
    private validator = new StateValidator();

    /** Inicjuje autonomiczny trening agenta w symulowanej awarii. */
    async launchAutonomousTraining(agentId: string, crisisScenario: string): Promise<SimulationResult> {
        const store = useSimulationStore.getState();
        store.reset();
        store.setAgent(agentId);
        store.setRunning(true);
        store.pushLog({ role: 'ACTION', text: `Agent ${agentId} wdrożony w scenariusz: "${crisisScenario}"` });

        let tier: ModelTier = ModelTier.LIGHT;
        let loop = 0, totalTokens = 0, resolved = false;
        // Stan symulowanego systemu (Chaos Engine startuje z aktywną awarią)
        let systemState = `VRAM_STALL_ERROR :: ${crisisScenario}`;

        try {
            while (!resolved && loop < MAX_LOOPS) {
                loop++;
                const before = systemState;
                useSimulationStore.getState().pushLog({ role: 'SYSTEM', text: `Snapshot stanu: ${before}`, loop, tier });

                // 1. GENEROWANIE MYŚLI (wnioskowanie lokalnym modelem przez most)
                const sysPrompt = tier === ModelTier.HEAVY
                    ? 'Jesteś starszym inżynierem TeO-Sim. Przeprowadź GŁĘBOKĄ analizę awarii i podaj jeden konkretny krok naprawczy. Jeśli system jest sprawny, napisz dokładnie SUKCES.'
                    : 'Jesteś agentem TeO-Sim. Podaj jeden zwięzły krok naprawczy dla awarii. Jeśli sprawny, napisz dokładnie SUKCES.';
                const prompt =
                    `Awaria w pętli #${loop}. Stan systemu: "${before}". ` +
                    `Zaproponuj krok naprawczy (np. flush_vram, restart_core, dealloc_buffer). ` +
                    `Jeśli błędy zniknęły — napisz SUKCES.`;

                const thought = await this.adapter.query(prompt, sysPrompt);
                totalTokens += thought.tokens || thought.tokensUsed || 0;
                useSimulationStore.getState().pushLog({ role: 'THOUGHT', text: thought.content || '(brak)', loop, tier });

                // Awaria modelu (VRAM stall po stronie wnioskowania) → eskalacja
                if (thought.error) {
                    useSimulationStore.getState().pushLog({ role: 'ERROR', text: 'Model zwrócił BŁĄD_VRAM_STALL — eskalacja warstwy.', loop, tier });
                    tier = ModelTier.HEAVY;
                    continue;
                }

                // 2. Symulacja działania w sandboxie (Truth-Anchor: liczy się STAN, nie deklaracja)
                const claimsSuccess = /sukces/i.test(thought.content);
                // Chaos Engine: 30% szans na wstrzyknięcie nowego błędu VRAM
                const chaos = Math.random() > 0.7;
                let after = claimsSuccess && !chaos ? 'SYSTEM_OK :: stan stabilny' : before;
                if (chaos) {
                    after = `${before} :: VRAM_STALL (Chaos Engine)`;
                    useSimulationStore.getState().pushLog({ role: 'ERROR', text: 'Chaos Engine: wstrzyknięto VRAM_STALL do bufora wnioskowania.', loop, tier });
                }

                // WARSTWA 1: State Delta Check — czy NAPRAWDĘ naprawił?
                const improved = this.validator.checkDelta(before, after);
                useSimulationStore.getState().pushLog({
                    role: 'VALIDATION',
                    text: improved ? 'Kotwica Prawdy: stan POPRAWIONY (delta < 0).' : 'Kotwica Prawdy: brak poprawy — myśl odrzucona jako halucynacja.',
                    loop, tier,
                });

                if (improved && /SYSTEM_OK/.test(after)) {
                    resolved = true;
                    systemState = after;
                    // WARSTWA 3: Nagroda za efektywność tokenową
                    const reward = totalTokens < 40 ? 'MAX (niski koszt tokenowy)' : 'STD';
                    useSimulationStore.getState().pushLog({ role: 'REWARD', text: `Agent ${agentId}: nagroda ${reward} · łącznie ${totalTokens} tok.`, loop, tier });
                } else {
                    // WARSTWA 2 + 3: eskalacja modelu + kara za halucynację/brak poprawy
                    if (tier === ModelTier.LIGHT) {
                        tier = ModelTier.HEAVY;
                        useSimulationStore.getState().pushLog({ role: 'SYSTEM', text: 'Dynamiczna Alokacja: eskalacja LIGHT → HEAVY (Arbitraż Logiczny).', loop });
                    }
                    useSimulationStore.getState().pushLog({ role: 'PENALTY', text: `Agent ${agentId}: kara LOGIC_ERROR (myśl niespójna ze stanem).`, loop, tier });
                    systemState = after;
                }
            }

            const result: SimulationResult = { agentId, resolved, loops: loop, totalTokens, finalTier: tier };
            useSimulationStore.getState().pushLog({
                role: resolved ? 'REWARD' : 'ERROR',
                text: resolved
                    ? `Pętla zamknięta: rozwiązano w ${loop} pętlach (${totalTokens} tok, ${tier}).`
                    : `Pętla wyczerpana (${MAX_LOOPS}) bez stabilizacji — wymagana interwencja.`,
            });
            useSimulationStore.getState().setResult(result);
            return result;

        } finally {
            useSimulationStore.getState().setRunning(false);
        }
    }
}

export const reasoningLoopSimulator = new ReasoningLoopSimulator();
