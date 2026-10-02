/**
 * 🌍 locale.ts — auto-identyfikacja języka sprzętu (Punkt 3, cegła 1).
 *
 * Przy pierwszym boocie wykrywa język systemu/przeglądarki (navigator.language)
 * i zapamiętuje wybór. To FUNDAMENT pod pełne i18n — na razie obsługuje pl/en
 * (rozszerzalne). Komponenty wspierające `lang` (np. KatedraNeuralMap) czytają
 * stąd, więc Katedra od pierwszego uruchomienia mówi w języku Suwerena.
 *
 * TODO (cegła 2 — większy projekt): LanguageContext + słownik tłumaczeń dla
 * CAŁEGO UI, żeby „wszystko budowało się w tym języku".
 */

/**
 * Kod języka (BCP-47: pl, en, de, uk, pt-BR…). pl/en/it mają ręczny słownik (lib/i18n.tsx); każdy inny
 * Katedra pokazuje przez Tłumacza (lib/tlumaczDom.ts + services/Tlumacz.js — lokalny model, pamięć na dysku).
 */
export type Lang = string;

/** Języki w przełączniku: kod → nazwa własna i flaga. Słownik ręczny mają tylko pl/en/it, resztę tłumaczy model. */
export const JEZYKI: Record<string, { nazwa: string; flaga: string }> = {
  pl: { nazwa: 'Polski', flaga: '🇵🇱' }, en: { nazwa: 'English', flaga: '🇬🇧' }, de: { nazwa: 'Deutsch', flaga: '🇩🇪' },
  it: { nazwa: 'Italiano', flaga: '🇮🇹' }, es: { nazwa: 'Español', flaga: '🇪🇸' }, fr: { nazwa: 'Français', flaga: '🇫🇷' },
  pt: { nazwa: 'Português', flaga: '🇵🇹' }, nl: { nazwa: 'Nederlands', flaga: '🇳🇱' }, cs: { nazwa: 'Čeština', flaga: '🇨🇿' },
  sk: { nazwa: 'Slovenčina', flaga: '🇸🇰' }, uk: { nazwa: 'Українська', flaga: '🇺🇦' }, lt: { nazwa: 'Lietuvių', flaga: '🇱🇹' },
  sv: { nazwa: 'Svenska', flaga: '🇸🇪' }, no: { nazwa: 'Norsk', flaga: '🇳🇴' }, da: { nazwa: 'Dansk', flaga: '🇩🇰' },
  fi: { nazwa: 'Suomi', flaga: '🇫🇮' }, hu: { nazwa: 'Magyar', flaga: '🇭🇺' }, ro: { nazwa: 'Română', flaga: '🇷🇴' },
  el: { nazwa: 'Ελληνικά', flaga: '🇬🇷' }, tr: { nazwa: 'Türkçe', flaga: '🇹🇷' }, ar: { nazwa: 'العربية', flaga: '🇸🇦' },
  he: { nazwa: 'עברית', flaga: '🇮🇱' }, hi: { nazwa: 'हिन्दी', flaga: '🇮🇳' }, ja: { nazwa: '日本語', flaga: '🇯🇵' },
  ko: { nazwa: '한국어', flaga: '🇰🇷' }, zh: { nazwa: '中文', flaga: '🇨🇳' }, vi: { nazwa: 'Tiếng Việt', flaga: '🇻🇳' },
  id: { nazwa: 'Bahasa Indonesia', flaga: '🇮🇩' },
};
export const SUPPORTED_LANGS: Lang[] = Object.keys(JEZYKI);
/** Języki z ręcznym słownikiem (reszta idzie przez Tłumacza). */
export const JEZYKI_SLOWNIKA = ['pl', 'en', 'it'] as const;
const KEY = 'otakos_lang';

/** Wykryj język sprzętu (raz), zapamiętaj, zwróć. Język z listy → ten; spoza listy → en. */
export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
    const nav = (navigator.language || navigator.languages?.[0] || 'pl').toLowerCase().split('-')[0];
    const lang: Lang = SUPPORTED_LANGS.includes(nav) ? nav : 'en';
    localStorage.setItem(KEY, lang);
    return lang;
  } catch {
    return 'pl';
  }
}

/** Ręczna zmiana języka (zapis lokalny). */
export function setLang(l: Lang): void {
  try { localStorage.setItem(KEY, l); } catch { /* brak localStorage — pomijamy */ }
}
