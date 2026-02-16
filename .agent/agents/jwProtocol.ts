// src/lib/jwProtocol.ts

interface DialoguePair {
    wieslaw: string; // The Challenge (Inicjacja)
    jadzia: string;  // The Verification (Pieczątka)
    securityLevel: 'LOW' | 'MEDIUM' | 'CRITICAL_FLIRT';
}

const DIALOGUES: DialoguePair[] = [
    {
        wieslaw: "Pani Jadziu, czy ta kawa to z Gwatemali? Bo pachnie awansem...",
        jadzia: "Wiesiek, nie kadź. Kawa z automatu, a awans w lesie. Dawaj ten kwit.",
        securityLevel: 'MEDIUM'
    },
    {
        wieslaw: "Słyszałem, że na 33. piętrze słońce świeci inaczej. To Pani blask?",
        jadzia: "To promieniowanie z serwerowni. Masz te tokeny czy mam dzwonić po ochronę?",
        securityLevel: 'CRITICAL_FLIRT'
    },
    {
        wieslaw: "Dzień dobry! Przesyłka priorytetowa. Kod czystszy niż łza.",
        jadzia: "Zobaczymy. Ostatnio 'czysty kod' zawiesił windę. Kładź na biurko.",
        securityLevel: 'LOW'
    },
    {
        wieslaw: "Pani Jadziu, pączki w drodze. Ale najpierw mały podpisik...",
        jadzia: "Najpierw pączki, potem podpis. ...No dobra, niech będzie. Ale z różą mają być.",
        securityLevel: 'MEDIUM'
    },
    {
        wieslaw: "System zgłasza anomalię... zbyt wysoki poziom elegancji w sekretariacie.",
        jadzia: "Wiesław, ty się minąłeś z powołaniem. Idź w poezję, a nie w krypto. Daj to.",
        securityLevel: 'CRITICAL_FLIRT'
    }
];

export interface HandshakeResult {
    success: boolean;
    logs: string[];
    token: string | null;
}

// Symulacja negocjacji
export const negotiateAccess = async (onLog: (msg: string) => void): Promise<string> => {
    // 1. Losowanie scenariusza (Dynamiczna Zmienna)
    const scenario = DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)];

    // KROK 1: Inicjacja Wiesława
    await new Promise(r => setTimeout(r, 800));
    onLog(`[WIESŁAW@APP_STUDIO]: "${scenario.wieslaw}"`);

    // KROK 2: Analiza sentymentu przez system (Bot Security Layer)
    await new Promise(r => setTimeout(r, 1000));
    onLog(`[SYSTEM_CORE]: Analyzing Social Sentiment... [LEVEL: ${scenario.securityLevel}]`);
    onLog(`[SYSTEM_CORE]: Human Interaction Probability: 99.9%`);

    // KROK 3: Odpowiedź Jadzi (Weryfikacja)
    await new Promise(r => setTimeout(r, 1500));
    onLog(`[JADZIA@TEO_HUB_33F]: "${scenario.jadzia}"`);

    // KROK 4: Pieczątka
    await new Promise(r => setTimeout(r, 800));
    onLog(`[JADZIA]: *STAMP NOISE* (Access Granted)`);

    return `JADZIA_TOKEN_${Math.random().toString(36).substring(7).toUpperCase()}`;
};