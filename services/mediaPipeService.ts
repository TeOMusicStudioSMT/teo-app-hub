// Nie importujemy nic na górze, żeby Vite nie krzyczał przy starcie
// Ścieżka do modelu
const MODEL_FILE_NAME = '/models/gemma-2b-it-gpu-int4.bin';

let llmInference: any = null;

export const initializeOnDeviceModel = async () => {
    if (llmInference) return true;

    try {
        console.log("📱 Ładowanie MediaPipe GenAI (Dynamic Bypass)...");

        // MAGIA: Importujemy bibliotekę dynamicznie w trakcie działania
        // /* @vite-ignore */ mówi systemowi, żeby nie próbował tego analizować przy budowaniu
        // @ts-ignore
        const genai = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@google/mediapipe-tasks-genai@latest/+esm");

        const FilesetResolver = genai.FilesetResolver;
        const LlmInference = genai.LlmInference;

        // 1. Ładowanie silnika WASM
        const genaiFileset = await FilesetResolver.forGenAiTasks(
            "https://cdn.jsdelivr.net/npm/@google/mediapipe-tasks-genai/wasm"
        );

        // 2. Ładowanie Twojego modelu .bin
        llmInference = await LlmInference.createFromOptions(genaiFileset, {
            baseOptions: {
                modelAssetPath: MODEL_FILE_NAME
            },
            maxTokens: 1000, // Dłuższe odpowiedzi
            topK: 40,
            temperature: 0.8, // Kreatywność
            randomSeed: 101
        });

        console.log("✅ Model lokalny (.bin) załadowany i gotowy!");
        return true;
    } catch (e) {
        console.error("❌ Błąd krytyczny ładowania modelu:", e);
        return false;
    }
};

export const generateOnDevice = async (prompt: string): Promise<string> => {
    if (!llmInference) {
        // Próba inicjalizacji przy pierwszym zapytaniu
        const success = await initializeOnDeviceModel();
        if (!success) return "Błąd: Nie udało się załadować modelu. Sprawdź czy plik .bin jest w folderze public/models.";
    }
    return llmInference.generateResponse(prompt);
};