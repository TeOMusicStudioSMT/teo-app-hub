/**
 * Odpowiedzialny wyłącznie za interakcję z modelem LLM.
 */
export const LLM_Adapter = {
    /**
     * Generuje i wysyła zapytanie do lokalnego modelu AI.
     * @param {string} taskContext - Pełne dane o rozwiązaniu zadania.
     * @returns {Promise<object>} Przykładowa struktura grafu wiedzy.
     */
    async callModelForKnowledge(taskContext) {
        console.log("🤖 [LLM_Adapter]: Przygotowanie promptu systemowego...");

        const systemPrompt = `Oto rozwiązane zadanie Katedry: ${JSON.stringify(taskContext)}. Wygeneruj wnioski architektoniczne w formacie JSON zawierającym tablicę 'nodes' (obiekty z 'id' i 'label', np. nazwy plików, typy błędów) oraz 'edges' (obiekty z 'source', 'target' i 'relation', np. 'POWODUJE_AWARIE', 'NAPRAWIA_ZALEZNOSC'). Zwróć WYŁĄCZNIE czysty JSON.`;

        try {
            // Symulacja asynchronicznego wywołania gemma-skills API.
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            console.log("[LLM_Adapter]: Połączenie z modelem zakończone.");

            // W rzeczywistym świecie: return fetch('gemma-skills/endpoint', { body: systemPrompt });
            return {
                nodes: [
                    { id: 'File_A', label: 'Model bazowy A' },
                    { id: 'Error_TypeX', label: 'Błąd asynchronizacji' },
                    { id: 'RepoStructure', label: 'Konfiguracja repozytorium' },
                ],
                edges: [
                    { source: 'File_A', target: 'Error_TypeX', relation: 'POWODUJE_ZALEZNOSC' },
                    { source: 'RepoStructure', target: 'Error_TypeX', relation: 'WARUNKUJE_FAILURE' },
                ],
            };

        } catch (error) {
            console.error("🚨 [LLM_Adapter] Błąd komunikacyjny z modelem:", error);
            throw new Error("Brak możliwości pozyskania wiedzy architektonicznej.");
        }
    }
};
