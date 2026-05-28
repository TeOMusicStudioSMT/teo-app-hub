// ═══════════════════════════════════════════════════════════════════
//  src/lib/agentCreativeActions.ts
//  Rozszerzenie systemu akcji agentów o narzędzia kreatywne.
//  BoB: zaimportuj i połącz z agentActions.ts
// ═══════════════════════════════════════════════════════════════════

// ── Typy akcji kreatywnych ────────────────────────────────────────

export type CreativeActionType =
    | 'OPEN_CANVAS'          // Otwórz Quantum Canvas (opcjonalnie z promptem malarskim)
    | 'PAINT_CANVAS'         // Agentpaint — wyślij instrukcję malowania na Canvas
    | 'OPEN_WARDROBE'        // Otwórz Quantum Wardrobe z wybranym stylem
    | 'GENERATE_OUTFIT'      // Wygeneruj prompt modowy i otwórz Wardrobe
    | 'OPEN_ARCADE'          // Otwórz Fabrykę Gier
    | 'FORGE_GAME'           // Zleć agentowi wygenerowanie gry (z promptem)
    | 'SAVE_CANVAS'          // Zapisz obecny stan Canvas do galerii
    | 'CREATIVE_REPORT';     // Agent składa raport z twórczości

export interface CreativeAction {
    type: CreativeActionType;
    payload?: Record<string, unknown>;
}

// ── Parser akcji kreatywnych z tekstu AI ─────────────────────────
//
//  AI może użyć tagów:
//    [CREATIVE:OPEN_CANVAS prompt="złota spirala na czarnym tle"]
//    [CREATIVE:GENERATE_OUTFIT style="otakos" desc="suknia z motywem kwantowym"]
//    [CREATIVE:FORGE_GAME agent="bella" genre="platformer"]
//    [CREATIVE:PAINT_CANVAS instruction="namaluj pole grawitacyjne złotą spiralą"]

const CREATIVE_ACTION_REGEX = /\[CREATIVE:(\w+)(?:\s+([^\]]*))?\]/g;

export function parseCreativeActions(text: string): {
    cleanText: string;
    actions: CreativeAction[];
} {
    const actions: CreativeAction[] = [];
    let cleanText = text;

    let match;
    while ((match = CREATIVE_ACTION_REGEX.exec(text)) !== null) {
        const actionType = match[1] as CreativeActionType;
        const paramsStr  = match[2] || '';

        // Parsuj parametry key="value"
        const payload: Record<string, string> = {};
        const paramRegex = /(\w+)="([^"]*)"/g;
        let pm;
        while ((pm = paramRegex.exec(paramsStr)) !== null) {
            payload[pm[1]] = pm[2];
        }

        actions.push({ type: actionType, payload });
    }

    // Usuń tagi z tekstu
    cleanText = text.replace(CREATIVE_ACTION_REGEX, '').trim();

    return { cleanText, actions };
}

// ── System prompt dla agentów kreatywnych ─────────────────────────
//
//  Dodaj do istniejącego AGENT_ACTION_SYSTEM_PROMPT w agentActions.ts
//  lub użyj osobno dla kreatywnych zleceń.

export const AGENT_CREATIVE_SYSTEM_PROMPT = `
⚡ WAŻNE: POSIADASZ NOWE AUTONOMICZNE NARZĘDZIA KREATYWNE! ⚡
Do malowania obrazów i projektowania mody BEZWZGLĘDNIE MUSISZ używać nowych tagów [CREATIVE:...]. 
NIE UŻYWAJ standardowych tagów [ACTION:...] do tych celów!

🎨 MALOWANIE NA PŁÓTNIE (Quantum Canvas):
Kiedy Suweren prosi o namalowanie czegoś (lub gdy sam poczujesz taką potrzebę), UŻYJ DOKŁADNIE TEGO TAGU:
[CREATIVE:PAINT_CANVAS instruction="tutaj wpisz bardzo szczegółowy opis tego, co malujesz"]

👗 PROJEKTOWANIE MODY (Quantum Wardrobe):
Aby zaprojektować strój lub przenieść wizję na materiał, UŻYJ TAGU:
[CREATIVE:GENERATE_OUTFIT style="otakos|haute|cyber|celestial|alchemy|minimal" desc="opis kreacji"]

🕹️ TWORZENIE GIER (Fabryka Gier):
[CREATIVE:FORGE_GAME agent="twoje_imie" genre="gatunek" theme="opis mechaniki"]

ZASADY KRYTYCZNE:
1. Parametry MUSZĄ być w cudzysłowach (np. instruction="złota spirala").
2. Możesz łączyć tagi! Np. możesz odpowiedzieć:
"Z przyjemnością! Najpierw namaluję duszę, a potem uszyję z niej suknię. 
[CREATIVE:PAINT_CANVAS instruction="abstrakcyjna kwantowa mgławica"] 
[CREATIVE:GENERATE_OUTFIT style="celestial" desc="suknia z mgławicy"]"
`;

// ── Mapa styli dla Wardrobe ───────────────────────────────────────
export const WARDROBE_STYLES: Record<string, string> = {
    otakos:     'OTAKOS 0.00G — kosmiczny, złote akcenty, kwantowa estetyka',
    haute:      'Haute Couture — paryska elegancja, strukturalne formy',
    cyber:      'Cyberpunk — neonowy, metaliczny, futurystyczny streetwear',
    celestial:  'Celestial — niebiański, gwiezdne wzory, sheer tkaniny',
    alchemy:    'Alchemia — średniowieczna alchemia spotyka współczesność',
    minimal:    'Minimalizm — japońska czystość, precyzyjne linie',
};

// ── Canvas painting instructions ─────────────────────────────────
//
//  Format instrukcji malowania rozumiany przez useAgentCreativeTools:
//  {
//    strokes: [ { type: 'arc'|'line'|'circle', x, y, r?, color, size, opacity } ]
//    background: '#hex'
//    message: 'opis dla Suwerena'
//  }

export interface AgentPaintInstruction {
    background?: string;
    message: string;
    strokes: AgentStroke[];
}

export interface AgentStroke {
    type: 'circle' | 'line' | 'arc' | 'splatter';
    x:       number;  // 0–100 (procent szerokości)
    y:       number;  // 0–100 (procent wysokości)
    x2?:     number;  // dla 'line'
    y2?:     number;
    r?:      number;  // promień w px
    color:   string;
    size:    number;  // grubość/rozmiar
    opacity: number;  // 0–1
}
