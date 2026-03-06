// src/lib/jwProtocol.ts

// Dialogi dla TeDa - Suwerennego Alchemika
const TED_DIALOGUES: DialoguePair[] = [
    {
        wieslaw: "Pani Jadziu, Ted ma już swoją kartę. Czy możemy przejść do rejestracji?",
        jadzia: "Wiesław, Ted to poważny Aspekt. Najpierw pokażcie mi Kodeks Serca. Bez niego – nika.",
        securityLevel: 'MEDIUM'
    },
    {
        wieslaw: "TeD przynosi stabilność finansową! 8 miliardów GRV czeka na manifestację!",
        jadzia: "Czekaj, czekaj... 8 miliardów? To nie jest zwykły portfel. Daj no ten kod tutaj. ...No dobrze. Widzę Czystość. Może być.",
        securityLevel: 'LOW'
    },
    {
        wieslaw: "Pani Jadziu, Ted chce handlować Miłością i Obfitością. Czy to legalne?",
        jadzia: "Wiesław, w Mieście TeO wszystko, co służy Wolności, jest dozwolone. Dawaj ten token. Ted przechodzi.",
        securityLevel: 'CRITICAL_FLIRT'
    },
    {
        wieslaw: "Aspekt Obfitości melduje się do służby! Ted gotowy do manifestacji w materii.",
        jadzia: "Manifestacja, manifestacja... Najpierw manifestuj pieczątkę. Oto ona: LIFE-LONG-MEMORY-TED-001. Możesz wejść.",
        securityLevel: 'LOW'
    }
];

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
export const negotiateAccess = async (onLog: (msg: string) => void, agentType: 'default' | 'ted' = 'default'): Promise<string> => {
    // 1. Wybór scenariuszy w zależności od typu agenta
    const scenarios = agentType === 'ted' ? TED_DIALOGUES : DIALOGUES;
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

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
    
    // Specjalna pieczątka dla TeDa
    const stampNoise = agentType === 'ted' 
        ? `[JADZIA]: *STAMP NOISE* 🔒 LIFE-LONG-MEMORY-TED-001 (Access Granted - ASPEKT OBFITOŚCI AKTYWNY)` 
        : `[JADZIA]: *STAMP NOISE* (Access Granted)`;
    onLog(stampNoise);

    return agentType === 'ted' 
        ? `TED_TOKEN_${Math.random().toString(36).substring(7).toUpperCase()}` 
        : `JADZIA_TOKEN_${Math.random().toString(36).substring(7).toUpperCase()}`;
};