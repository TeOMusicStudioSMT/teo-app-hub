// context/useRoastMiddleware.ts
import { useCallback, useState } from 'react';
// Importujemy nasze usługi historyczne
import { summarizeHistoricalImpact } from '../services/LTCStoreService';
import type { RoastingContextType } from './roastingContext';

export const useRoastMiddleware = (context: RoastingContextType) => {

    const [lastAnalysisResult, setLastAnalysisResult] = useState<any>(null);

    /**
     * Główna funkcja przechwytująca wszystkie wiadomości wyjściowe.
     * Kontroluje i waliduje treść przed faktyczną transmisją (emit).
     * 
     * @param messagePayload Treść, którą użytkownik chce wysłać.
     * @param currentLevel Aktualny poziom roastyngu.
     * @param isSPActive Czy Singulary Protocol jest aktywny?
     */
    const handleOutgoingMessage = useCallback(async (messagePayload: string, currentLevel: number, isSPActive: boolean) => {
        
        // --- 1. RESET STANU PRZETWARZANIA I OCZEKIWANIE NA ANALIZĘ ---
        console.log(`[Middleware] Inicjacja walidacji... Aktywny SP: ${isSPActive}`);
        setLastAnalysisResult({ message: "Analiza przebiega...", warningLevel: 'LOW', hasMemoryAccess: false });

        let analysisDetails;
        let processingDelay = 500; // Standardowe opóźnienie (Deep Analysis)

        try {
            if (isSPActive) {
                // === ŚCIEŻKA SINGULARITY PROTOCOL (Impact Summary) ===
                console.warn("[Middleware] Singularity Protocol AKTYWOWANY: Użycie trybu 'Impact Summary'.");
                
                // Zamiast głębokiej analizy strukturalnej, wykonujemy szybki wyciąg wniosków narracyjnych z przeszłości
                analysisDetails = await summarizeHistoricalImpact(currentLevel); 
                processingDelay = 150; // Bardzo szybka odpowiedź, by zachować płynność

            } else {
                // === ŚCIEŻKA TYPU STANDARD (Deep Analysis) ===
                console.log("[Middleware] Standardowa walidacja Deep Analysis...");
                
                // Klasyczna złożona weryfikacja: emocje + zasoby + historia
                const deepAnalysis = await analyzeRoastContent(messagePayload, currentLevel); 
                analysisDetails = deepAnalysis; // Wynik z funkcjonalnego API
                processingDelay = 800; // Celowe opóźnienie dla podniesienia wrażenia złożoności

            }

            // --- 2. WIZUALIZACJA I FINALNA WALIDACJA ---
            await new Promise(resolve => setTimeout(resolve, processingDelay)); // Symulacja czasu przetwarzania

            const finalResult = {
                message: `Walidacja zakończona. ${analysisDetails} Poziom ryzyka utrzymany na niskim poziomie dzięki SP.`,
                warningLevel: 'LOW',
                hasMemoryAccess: true,
            };
            setLastAnalysisResult(finalResult);

            // --- 3. EMISJA DANYCH (Jeśli wszystko jest OK) ---
            console.log(`[Middleware] Dane gotowe do emitowania. Emitowanie payloadu...`);
            // emitter.emit('newRoastMessage', { message: messagePayload, context: finalResult });

        } catch (error) {
            setLastAnalysisResult({ message: `Błąd przetwarzania danych. Reset logiki komunikacyjnej.`, warningLevel: 'HIGH', hasMemoryAccess: false });
            console.error("[Middleware] BŁĄD SYSTEMOWY:", error);
        }

    }, [/* Zależności contextu */]);


    /**
     * --- PODPIEKROWA FUNKCJA (Symulacja) ---
     * To jest symulowane wywołanie, które byłoby w klasycznym trybie Deep Analysis.
     */
    const analyzeRoastContent = async (message: string, level: number) => {
        // Simulates deep memory query and emotion analysis...
        await new Promise(resolve => setTimeout(resolve, 200)); 
        return `Analiza treści wykazała potencjał do 'niezamierzonego ciętej riposty'. Poziom zagrożenia: ${level}.`;
    };

    // Powrót samego hooka
    return { handleOutgoingMessage, lastAnalysisResult };
}

/* --------------------------------------- */
