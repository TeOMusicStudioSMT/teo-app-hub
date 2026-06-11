/**
 * 🧺 roastingContext — Jądro Sterujące modułu PRALKA (Roasting Station)
 *
 * Architektura Rady (Adamus) + implementacja Klaudiusza:
 *  - State Machine (useRoastStateMachine) — polityka protokołu wg poziomu 1-9
 *  - Ethical Guardrail (ToneValidatorService) — walidacja tonu przed wysyłką
 *  - Chronos Module (LTCStoreService) — pamięć długoterminowa trajektorii
 *  - Singularity Protocol — tryb kontrolowanego chaosu (Impact Summary)
 *  - The Veil — lastAnalysisResult konsumowany przez warstwę interpretacyjną
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { LTCStoreService, summarizeHistoricalImpact, MemoryRecord } from '../services/LTCStoreService';
import { ToneValidatorService } from '../services/ToneValidatorService';
import { useRoastStateMachine } from '../hooks/useRoastStateMachine';

// ─── Typy ─────────────────────────────────────────────────────────────────────

export type MediaKind = 'TEXT' | 'IMAGE' | 'VIDEO';

export interface ProtocolPolicy {
    canSendMedia: boolean;
    requiredCodec: 'text' | 'video-audio' | 'advanced';
    maxStreamingRateKbps: number;
    stateDescription: string;
}

export interface RoastMessage {
    id: string;
    sender: 'self' | 'system';
    content: string;
    mediaUrl?: string;
    timestamp: Date;
}

export interface AnalysisResult {
    message: string;
    warningLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    hasMemoryAccess: boolean;
}

export interface RoastingContextType {
    // Stan poziomu i maszyny
    currentLevel: number;
    state: string;                                  // stan State Machine (IDLE/ENGAGED/OVERLOAD...)
    systemState: 'ACTIVE' | 'WARNING' | 'BLOCKED';  // stan bezpieczeństwa
    policy: ProtocolPolicy;
    setLevel: (level: number) => void;

    // Komunikacja
    messages: RoastMessage[];
    sendMessageWithMedia: (message: string, mediaType?: MediaKind, mediaUrl?: string) => Promise<void>;

    // The Veil — warstwa interpretacyjna
    lastAnalysisResult: AnalysisResult | null;
    isAnalyzing: boolean;

    // Singularity Protocol — kontrolowany chaos
    isSingularityProtocolActive: boolean;
    activateSP: () => void;
    deactivateSP: () => void;
}

const RoastContext = createContext<RoastingContextType | null>(null);

// ─── Silnik Roastowania (lokalna Gemma4 przez Wiesio Bridge SSE) ─────────────

const BRIDGE_URL = 'http://127.0.0.1:3001';

const roastBand = (level: number): string => {
    if (level <= 3) return 'Pasmo ŁAGODNE: ciepła, przyjacielska satyra. Drobne szpileczki, dużo humoru, zero bólu.';
    if (level <= 6) return 'Pasmo OSTRE: cięta riposta, ironia, bezlitosne celne obserwacje. Satyra na poziomie stand-upu.';
    return 'Pasmo OVERLOAD: brutalny, bezpardonowy roast klasy mistrzowskiej. Miażdżąca hiperbola, ale zawsze inteligentna — nigdy prostacka.';
};

async function generateRoast(userText: string, level: number, spActive: boolean, hasMedia: boolean): Promise<string> {
    const system =
        `Jesteś PRALKA — silnik roastowania Katedry OtakOS. Twoja misja: uwalniać blokady węzłowe Suwerena przez satyrę. ` +
        `Poziom intensywności: ${level}/9. ${roastBand(level)} ` +
        (spActive ? 'SINGULARITY PROTOCOL AKTYWNY: pełen chaos narracyjny, łam czwartą ścianę, bądź nieprzewidywalny. ' : '') +
        (hasMedia ? 'Suweren przesłał też materiał wizualny — wpleć go w roast. ' : '') +
        `Odpowiadasz PO POLSKU, krótko (2-4 zdania), kończysz ciętą puentą. Cel: śmiech i wyzwolenie, nigdy realna krzywda.`;

    const res = await fetch(`${BRIDGE_URL}/api/ollama`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            model:    'gemma4',
            system,
            messages: [{ role: 'user', content: userText || 'Roastuj mnie na podstawie przesłanego materiału.' }],
        }),
    });

    if (!res.ok || !res.body) throw new Error(`Bridge HTTP ${res.status}`);

    // Parsowanie strumienia SSE: data: {type:'text'|'done'|'error'}
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', fullText = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === 'text' && evt.text) fullText += evt.text;
                if (evt.type === 'error') throw new Error(evt.error);
            } catch (e: any) {
                if (e?.message && !e.message.includes('JSON')) throw e;
            }
        }
    }

    return fullText.trim();
}

// ─── Hooki dostępu (aliasy dla wszystkich wariantów użytych w plikach Rady) ───
export const useRoastingContext = (): RoastingContextType => {
    const ctx = useContext(RoastContext);
    if (!ctx) throw new Error('useRoastingContext musi być użyty wewnątrz <RoastingProvider>');
    return ctx;
};
export const useRoastContext      = useRoastingContext; // alias (TheVeil)
export const useRoastRoastContext = useRoastingContext; // alias (MediaInput)

// ─── Provider ─────────────────────────────────────────────────────────────────

export const RoastingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { state, policy, setLevelPolicy } = useRoastStateMachine();

    const [currentLevel, setCurrentLevel]       = useState(1);
    const [systemState, setSystemState]         = useState<'ACTIVE' | 'WARNING' | 'BLOCKED'>('ACTIVE');
    const [messages, setMessages]               = useState<RoastMessage[]>([]);
    const [lastAnalysisResult, setLastAnalysis] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing]         = useState(false);
    const [isSingularityProtocolActive, setIsSPActive] = useState(false);

    // ── Kontrolowana zmiana poziomu (przez State Machine) ─────────────────────
    const setLevel = useCallback((level: number) => {
        const clamped = Math.min(9, Math.max(1, level));
        setCurrentLevel(clamped);
        setLevelPolicy(clamped);
    }, [setLevelPolicy]);

    // ── Singularity Protocol ──────────────────────────────────────────────────
    const activateSP = useCallback(() => {
        setIsSPActive(true);
        setLastAnalysis({
            message: '🔮 SINGULARITY PROTOCOL AKTYWNY — analiza przełączona na Impact Summary. Chaos kontrolowany.',
            warningLevel: 'MEDIUM',
            hasMemoryAccess: true,
        });
    }, []);

    const deactivateSP = useCallback(() => {
        setIsSPActive(false);
        setLastAnalysis({
            message: 'Powrót do Deep Analysis. Pełna ścieżka walidacji przywrócona.',
            warningLevel: 'LOW',
            hasMemoryAccess: false,
        });
    }, []);

    // ── KRYTYCZNA FUNKCJA: wysyłka przez wszystkie warstwy walidacji ──────────
    const sendMessageWithMedia = useCallback(async (
        message: string,
        mediaType: MediaKind = 'TEXT',
        mediaUrl?: string,
    ): Promise<void> => {
        if (!message && !mediaUrl) return;

        setIsAnalyzing(true);
        setLastAnalysis({ message: 'Analiza przebiega...', warningLevel: 'LOW', hasMemoryAccess: false });

        try {
            let analysisDetails: string;

            if (isSingularityProtocolActive) {
                // === ŚCIEŻKA SP (Impact Summary) — szybki wyciąg narracyjny ===
                analysisDetails = await summarizeHistoricalImpact(currentLevel);
            } else {
                // === ŚCIEŻKA STANDARD (Deep Analysis) ===
                // KROK 1: Ethical Guardrail
                const validation = await ToneValidatorService.validate(message, mediaType, currentLevel);

                if (!validation.isSafeToSend) {
                    setSystemState('WARNING');
                    setLastAnalysis({
                        message: validation.feedbackMessage ?? 'Przekaz wymaga korekty tonu.',
                        warningLevel: validation.riskScore >= 0.7 ? 'HIGH' : 'MEDIUM',
                        hasMemoryAccess: false,
                    });
                    return;
                }

                // KROK 2: Chronos — zapis trajektorii
                const record: MemoryRecord = {
                    timestamp: new Date(),
                    sessionLevel: currentLevel,
                    userActionType: mediaUrl ? 'MEDIA_USED' : 'MESSAGE',
                    dataPayload: { message, mediaUsed: mediaType },
                    historicalImpactScore: validation.riskScore * 0.5 + (currentLevel / 10),
                };
                await LTCStoreService.saveMemoryRecord(record);

                analysisDetails = `Walidacja tonalna pozytywna (ryzyko ${Math.round(validation.riskScore * 100)}%). Rekord Chronos zapisany.`;
            }

            // KROK 3: Transfer do strumienia + aktualizacja Veila
            setMessages(prev => [...prev, {
                id: `roast_${Date.now().toString(36)}`,
                sender: 'self',
                content: message,
                mediaUrl,
                timestamp: new Date(),
            }]);

            setLastAnalysis({
                message: analysisDetails,
                warningLevel: 'LOW',
                hasMemoryAccess: true,
            });
            setSystemState('ACTIVE');

            // KROK 4: ROAST! — lokalna Gemma4 odpowiada z intensywnością poziomu
            const typingId = `pralka_typing_${Date.now().toString(36)}`;
            setMessages(prev => [...prev, {
                id: typingId,
                sender: 'system',
                content: '🧺 Pralka wiruje... formułuję roast...',
                timestamp: new Date(),
            }]);

            try {
                const roast = await generateRoast(message, currentLevel, isSingularityProtocolActive, !!mediaUrl);
                setMessages(prev => prev.map(m =>
                    m.id === typingId
                        ? { ...m, content: roast || '...Pralka zaniemówiła. To się nie zdarza często.' }
                        : m
                ));
            } catch (roastErr: any) {
                setMessages(prev => prev.map(m =>
                    m.id === typingId
                        ? { ...m, content: `[PRALKA OFFLINE] Silnik Gemma4 nie odpowiada: ${roastErr.message}. Sprawdź Wiesio Bridge i Ollamę.` }
                        : m
                ));
            }

        } catch (err: any) {
            setLastAnalysis({
                message: `Błąd przetwarzania danych: ${err.message}. Reset logiki komunikacyjnej.`,
                warningLevel: 'HIGH',
                hasMemoryAccess: false,
            });
            setSystemState('BLOCKED');
        } finally {
            setIsAnalyzing(false);
        }
    }, [currentLevel, isSingularityProtocolActive]);

    const value: RoastingContextType = {
        currentLevel,
        state,
        systemState,
        policy,
        setLevel,
        messages,
        sendMessageWithMedia,
        lastAnalysisResult,
        isAnalyzing,
        isSingularityProtocolActive,
        activateSP,
        deactivateSP,
    };

    return <RoastContext.Provider value={value}>{children}</RoastContext.Provider>;
};
