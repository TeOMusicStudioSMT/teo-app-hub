/**
 * 🔮 kronika-engine.ts — Silnik Kroniki 0.00G
 *
 * Przepięty na lokalny rdzeń Gemma 4 przez ApiDyrygent.
 * Plik zachowuje oryginalną nazwę i export dla kompatybilności wstecznej.
 *
 * Prompt wymusza odpowiedź w formacie JSON — parsowanie zabezpieczone try-catch.
 */

import { ApiDyrygent } from '../../../../lib/router/ApiDyrygent';

// ─── Typy ──────────────────────────────────────────────────────────────────────

export interface MissionCard {
  title:     string;
  narrative: string;
  xp:        number;   // aliasowane jako "GRV" w UI
  aura:      'gold' | 'cyan' | 'violet';
}

// ─── Stały prompt systemowy ────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Jesteś Mistrzem Kronik w uniwersum OtakOS 0.00G. \
Twoim zadaniem jest przekształcenie notatek Suwerena w epicki wpis do Dziennika Pokładowego.

WYMAGANIA:
1. Tytuł Misji – krótki, uderzający tytuł w stylu "Dzień X: [Epicka Nazwa]".
2. Narracja – 3-4 zdania w stylu wysokiego fantasy/sci-fi. Podniosłe słownictwo, klimat OtakOS.
3. GRV – liczba punktów (od 50 do 500) zależna od wagi dokonań.
4. Aura Dnia:
   - "gold"   → Sukces, triumf, przełom
   - "cyan"   → Odkrycie, nauka, nowa wiedza
   - "violet" → Refleksja, spokój, planowanie

FORMAT ODPOWIEDZI:
Odpowiedz WYŁĄCZNIE w formacie JSON. Nie używaj bloków kodu markdown ani żadnego tekstu poza JSON.
Przykład poprawnej odpowiedzi:
{"title":"Dzień 1: Przebudzenie","narrative":"Narracja...","xp":200,"aura":"cyan"}

Język: Polski. Styl: Mityczny, kosmiczny, OtakOS 0.00G.`;

// ─── Fallback ──────────────────────────────────────────────────────────────────

const FALLBACK_MISSION: MissionCard = {
  title:     'Błąd Transmisji',
  narrative: 'Kronika nie mogła odczytać Twoich dokonań. Lokalny Mózg milczy lub zwrócił niepoprawny format. Spróbuj ponownie, Suwerenie.',
  xp:        0,
  aura:      'violet',
};

// ─── Główna funkcja ────────────────────────────────────────────────────────────

/**
 * Generuje wpis do Kroniki 0.00G korzystając z lokalnego modelu Gemma 4.
 * Zachowuje sygnaturę kompatybilną z poprzednim serwisem Gemini.
 *
 * @param prompt    - tekst notatek Suwerena
 * @param fileBase64 - opcjonalne (ignorowane w trybie lokalnym; API Ollama nie przyjmuje obrazów)
 * @param mimeType   - opcjonalne (j.w.)
 */
export async function bringToLife(
  prompt:      string,
  fileBase64?: string,
  mimeType?:   string,
): Promise<MissionCard> {

  const userContent = prompt?.trim() || 'Opisz dzisiejszy dzień jako początek wielkiej sagi.';

  const fullPrompt = `${SYSTEM_INSTRUCTION}\n\n--- NOTATKI SUWERENA ---\n${userContent}`;

  try {
    const raw = await ApiDyrygent.dispatchDirectOllama(
      fullPrompt,
      ApiDyrygent.getFastModel(),   // domyślnie: gemma4
    );

    // ── Wyciągamy JSON z odpowiedzi (model może dodać dodatkowy tekst) ─────────
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Kronika] Brak JSON w odpowiedzi modelu:', raw.slice(0, 200));
      return FALLBACK_MISSION;
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<MissionCard>;

    // ── Walidacja pól ──────────────────────────────────────────────────────────
    const validAuras: MissionCard['aura'][] = ['gold', 'cyan', 'violet'];
    return {
      title:     typeof parsed.title     === 'string' && parsed.title.trim()
                    ? parsed.title.trim()
                    : 'Misja Bez Tytułu',
      narrative: typeof parsed.narrative === 'string' && parsed.narrative.trim()
                    ? parsed.narrative.trim()
                    : raw.slice(0, 300),
      xp:        typeof parsed.xp        === 'number' && parsed.xp > 0
                    ? Math.min(parsed.xp, 500)
                    : 100,
      aura:      validAuras.includes(parsed.aura as MissionCard['aura'])
                    ? (parsed.aura as MissionCard['aura'])
                    : 'cyan',
    };

  } catch (err) {
    console.error('[Kronika] bringToLife — błąd silnika lokalnego:', err);
    return FALLBACK_MISSION;
  }
}
