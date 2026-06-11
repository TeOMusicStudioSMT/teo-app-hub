import { useState, useEffect, useCallback } from 'react';

// 1. Definicje Strumieni (Typowanie policyk i stanów)
type RoastingState = 'IDLE' | 'LEVEL_TRANSITIONING' | 'ENGAGED' | 'OVERLOAD' | 'DISCONNECTED';
type RoastLevel = number;

interface ProtocolPolicy {
    stateDescription: string;
    canSendMedia: boolean;
    requiredCodec: 'text' | 'video-audio' | 'advanced'; 
    maxStreamingRateKbps: number;
}

export const useRoastStateMachine = () => {
    const [state, setState] = useState<RoastingState>('IDLE');
    const [currentLevel, setCurrentLevel] = useState<RoastLevel>(0);
    const [policy, setPolicy] = useState<ProtocolPolicy>({
        stateDescription: "Gotowość do inicjacji.",
        canSendMedia: false,
        requiredCodec: 'text', 
        maxStreamingRateKbps: 50 // Minimalna przepustowość tekstowa
    });

    // Implementacja zaawansowanej logiki zmiany stanu (CORE LOGIC)
    const setLevelPolicy = useCallback((newLevel: number) => {
        if (currentLevel === newLevel) return; // Suwak działa w obie strony — Suweren kontroluje poziom
        
        console.log(`[STATE] Przejście z poziomu ${currentLevel} na ${newLevel}`);

        // 1. Zmiana Stanu
        setState('LEVEL_TRANSITIONING');

        let nextPolicy: ProtocolPolicy = {
            stateDescription: "Tryb tekstowy, minimalna przepustowość.",
            canSendMedia: false,
            requiredCodec: 'text',
            maxStreamingRateKbps: 50
        };
        let newStateName: RoastingState;

        // 2. Filtr Transakcyjny (Definicja Polik) - Klucz do rozwiązania Adamusa!
        if (newLevel === 1) {
            nextPolicy = { stateDescription: "Poziom 1: Wymiana słów.", canSendMedia: false, requiredCodec: 'text', maxStreamingRateKbps: 50 };
            newStateName = 'IDLE';
        } else if (newLevel === 5) {
            nextPolicy = { stateDescription: "Poziom 5: Pełny Multimedialny Strumień.", canSendMedia: true, requiredCodec: 'video-audio', maxStreamingRateKbps: 1000 };
            newStateName = 'ENGAGED';
        } else if (newLevel === 9) {
            // Protokół specjalny dla maksymalnego wyzwolenia energetycznego
            nextPolicy = { stateDescription: "Poziom 9: Overload - Synchronizacja Multimediów i Tekstu.", canSendMedia: true, requiredCodec: 'advanced', maxStreamingRateKbps: 5000 };
            newStateName = 'OVERLOAD';
        } else {
             // Obsługa ewentualnych poziomów pośrednich (załadowanie wartości domyślnej)
             nextPolicy = { stateDescription: "Poziom pośredni.", canSendMedia: true, requiredCodec: 'video-audio', maxStreamingRateKbps: 500 };
             newStateName = 'ENGAGED';
        }

        // 3. Aktualizacja Stanu i Polityki (Potwierdzenie)
        setCurrentLevel(newLevel);
        setPolicy(nextPolicy);
        setState(newStateName);
    }, [currentLevel]);


    // --- SYMULACJA AWARYJNEGO PRZEŁĄCZENIA STANU ---
    useEffect(() => {
        let eventListener: any;

        // Obsługa odłączenia Socket.io (Resource Failure Handling)
        const handleSocketError = () => {
            if (state !== 'DISCONNECTED') {
                console.error("[CRITICAL] Połączenie WebRTC/Socket.io zostało zerwane.");
                setState('DISCONNECTED');
                // Resetowanie polityki na stan awaryjny
                setPolicy({ 
                    stateDescription: "AWARIA POŁĄCZENIA", 
                    canSendMedia: false, 
                    requiredCodec: 'text', 
                    maxStreamingRateKbps: 0 
                });
            }
        };

        // Zakładamy załączenie listenera do Globalnego Managementa Socket.io
        // (socketClient jest opcjonalny — moduł działa też bez Socket.io)
        eventListener = (window as any).socketClient?.on?.('disconnect', handleSocketError);

        return () => {
            if (eventListener) eventListener();
            console.log("[STATE MACHINE] Cleanup completed.");
        };
    }, [state]);


    // Podsumowanie stanu dla UI/Komponentów
    return { state, policy, setLevelPolicy };
};
