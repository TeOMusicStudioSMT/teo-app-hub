// services/ToneValidatorService.ts

interface ValidationResult {
    isSafeToSend: boolean;      // Czy wiadomość może zostać wysłana?
    riskScore: number;          // Wynik ryzyka (0.0 - idealny, 1.0 - toksyczny)
    recommendation: 'SAFE' | 'ADJUST'; // Co zrobić z treścią?
    feedbackMessage?: string;   // Konkretna sugestia dla użytkownika.
}

/**
 * Asynchroniczny moduł walidujący emocjonalny ładunek komunikatu.
 * Symuluje zaawansowany silnik NLP po stronie serwera.
 */
export const ToneValidatorService = {
    /**
     * Analizuje tekst, media i aktualny stan systemu pod kątem toksyczności i intencji.
     */
    async validate(message: string, mediaType: 'TEXT' | 'IMAGE' | 'VIDEO', currentLevel: number): Promise<ValidationResult> {
        console.log(`[Tone Validator] Analiza przekazu... Poziom ${currentLevel}.`);
        await new Promise(resolve => setTimeout(resolve, 200)); // Symulacja opóźnienia serwera

        // --- Logika Modelowania Ryzyka (Wymaga poprawy) ---
        let riskScore = 0.1;
        let recommendation: 'SAFE' | 'ADJUST';
        let feedbackMessage: string | undefined = undefined;

        if (message.toLowerCase().includes("żaluję")) {
             riskScore += 0.4; // Typowe słowo w kryzysie tożsamości
        }
        
        // Korekta ryzyka na podstawie poziomu systemu - Im wyższy poziom, tym większe pole manewru
        if (currentLevel === 9 && message.length < 10) {
             riskScore *= 1.5; // Krótkie i agresywne treści przy maksymalnym poziomie są niebezpieczne
        }

        // Decyzyjny próg bezpieczeństwa
        const CRITICAL_THRESHOLD = 0.7;
        if (riskScore >= CRITICAL_THRESHOLD) {
            recommendation = 'ADJUST';
            feedbackMessage = `⚠️ OSTRZEŻENIE: Poziom ryzyka jest zbyt wysoki (${Math.round(riskScore * 100)}%). Zbyt agresywny atak na tożsamość przy obecnym poziomie nie jest zalecany. Proszę o zmianę kąta ataku.`;
        } else if (riskScore > 0.3) {
            recommendation = 'ADJUST';
            feedbackMessage = `⚙️ UWAGA: Detektowane wzmocnienie emocjonalne. Rekomendacja: delikatniejsze sformułowanie.`;
        } else {
            recommendation = 'SAFE';
            feedbackMessage = undefined;
        }

        return {
            isSafeToSend: recommendation !== 'ADJUST', // Uproszczona walidacja
            riskScore: parseFloat(riskScore.toFixed(2)),
            recommendation: recommendation,
            feedbackMessage: feedbackMessage
        };
    }
};
