import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCloudProvider } from "../../../../services/cloudService";

/**
 * 🔮 gemini.ts - Serwis AI dla Kroniki 0.00G
 * Zintegrowany z systemem TeO Genesis (Kibel/CloudService)
 */

const GEMINI_MODEL = 'gemini-1.5-pro'; // Stabilny model dla złożonych zadań

const SYSTEM_INSTRUCTION = `Jesteś Mistrzem Kronik w uniwersum OtakOS 0.00G. Twoim zadaniem jest przekształcenie opisu dnia użytkownika (tekst lub obraz) w epicki "Wpis do Kroniki" - kartę misji.

WYMAGANIA DOTYCZĄCE TREŚCI:
1. **Tytuł Misji**: Krótki, uderzający tytuł w stylu "Dzień X: [Epicka Nazwa]".
2. **Narracja**: 3-4 zdania napisane w stylu wysokiego fantasy / sci-fi (styl epicki 0.00G). Używaj podniosłego słownictwa.
3. **GRV**: Liczba punktów grawitacji (od 50 do 500) przyznana na podstawie wagi dokonań.
4. **Aura Dnia**: Wybierz jeden z trzech typów:
    - "gold" (Sukces, triumf, przełom)
    - "cyan" (Odkrycie, nauka, nowa wiedza)
    - "violet" (Refleksja, spokój, planowanie)

FORMAT ODPOWIEDZI:
Musisz odpowiedzieć WYŁĄCZNIE w formacie JSON. Nie używaj bloków kodu markdown.
Struktura JSON:
{
  "title": "Tytuł Misji",
  "narrative": "Epicki opis dokonań...",
  "xp": 250,
  "aura": "gold" | "cyan" | "violet"
}

ZASADY:
- Jeśli użytkownik wrzuci zdjęcie, przeanalizuj co na nim jest i zinterpretuj to jako element misji (np. zdjęcie kawy -> "Eliksir Skupienia", zdjęcie biurka -> "Stanowisko Dowodzenia").
- Język: Polski.
- Styl: Mityczny, kosmiczny, OtakOS 0.00G.`;

export interface MissionCard {
  title: string;
  narrative: string;
  xp: number; // Keeping key as xp for compatibility, but labeling as GRV in UI
  aura: 'gold' | 'cyan' | 'violet';
}

export async function bringToLife(prompt: string, fileBase64?: string, mimeType?: string): Promise<MissionCard> {
  const { apiKey } = await getCloudProvider('gemini');
  if (!apiKey) throw new Error("Brak klucza Gemini w systemie. Dodaj go w Portalu Dyplomatycznym.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION 
  });

  const parts: any[] = [];
  
  const finalPrompt = fileBase64 
    ? "Przeanalizuj to wejście i stwórz wpis do Kroniki. Zinterpretuj wizualia jako epickie dokonania." 
    : prompt || "Opisz dzisiejszy dzień jako początek wielkiej sagi.";

  parts.push({ text: finalPrompt });

  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    });
  }

  try {
    const result = await model.generateContent({
        contents: [{ role: 'user', parts }]
    });

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim() || "{}";
    
    try {
      return JSON.parse(text) as MissionCard;
    } catch (e) {
      console.error("JSON Parse Error:", text);
      return {
        title: "Błąd Transmisji",
        narrative: "Kronika nie mogła odczytać Twoich dokonań. Spróbuj ponownie, Suwerenie.",
        xp: 0,
        aura: "violet"
      };
    }
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
