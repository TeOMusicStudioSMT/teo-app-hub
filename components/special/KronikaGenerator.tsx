// src/components/KronikaGenerator.tsx (Fragment modyfikowany)
import { writeToFile } from '../utils/storage'; // Załóżmy, że taka funkcja istnieje
import { getGemma4Content, AgentComment } from '../services/aiService';

const generateEntryWithFeedback = async (primaryNarrative: string, title: string): Promise<any> => {
    console.log("[CORE] Rozpoczęcie generacji: Treść GŁÓWNA...");
    
    // KROK 1: Generowanie głównej treści (Synchronous)
    const gemmaOutput = await getGemma4Content(primaryNarrative); // Wywołanie do Gemma 4
    const mainEntryJson = {
        id: Date.now().toString(),
        title: title,
        narrative: gemmaOutput.text,
        xp: Math.floor(Math.random() * 30) + 50, // Base XP
        aura: "cyan",
        timestamp: new Date().toISOString(),
        type: 'AI_GENERATED',
        comments: [], // Tutaj zostaną wstrzyknięte wyniki z AI
    };

    // KROK 2: Asynchroniczne zapytania do komentarzy (Paralelne)
    const agentPromises = [
        getAgentFeedback("Adamus", `Skomentuj ten wpis w 1 zdaniu jako strategiczny mentor. Treść: ${gemmaOutput.text}`),
        getAgentFeedback("Bella", `Skomentuj ten wpis w 1 zdaniu z perspektywy estetyki i wizji. Treść: ${gemmaOutput.text}`),
        getAgentFeedback("ODDI", `Skomentuj ten wpis w 1 zdaniu jako bezwzględna sztuczna logika. Treść: ${gemmaOutput.text}`)
    ];

    console.log("[CORE] Rozpoczynanie równoległego zapytania Agentów...");
    const agentResponses = await Promise.all(agentPromises); // Czekamy na wszystkie odpowiedzi!

    // KROK 3: Integracja i finalizacja JSON
    const comments: AgentComment[] = agentResponses.map((response, index) => ({
        agent: ["Adamus", "Bella", "ODDI"][index],
        text: response.text || `Nie udało się pobrać feedbacku od ${["Adamus", "Bella", "ODDI"][index]}.`
    }));

    const finalEntry = { ...mainEntryJson, comments };
    
    console.log("[CORE] Sukces! Gotowy wpis z komentarzami AI.");
    
    // KROK 4: Zapis do systemu (WRITE_FILE)
    await writeToFile(`Kroniki/${finalEntry.id}.json`, finalEntry); 
};

/** Helper function for Agent API call */
const getAgentFeedback = async (agentName: string, prompt: string): Promise<{ text: string }> => {
    // Symulowany wywołanie do /api/ollama z gemma4
    console.log(`[API CALL] Querying ${agentName} with prompt...`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Symulacja opóźnienia sieci
    return { text: `Odpowiedź od ${agentName}: To jest profesjonalne, ale musi być bardziej agresywne.` };
};

export default { generateEntryWithFeedback };
