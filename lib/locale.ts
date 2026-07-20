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

export type Lang = 'pl' | 'en' | 'it';
export const SUPPORTED_LANGS: Lang[] = ['pl', 'en', 'it'];
const KEY = 'otakos_lang';

/** Wykryj język sprzętu (raz), zapamiętaj, zwróć. Rozpoznaje pl/it, reszta → en. */
export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && (SUPPORTED_LANGS as string[]).includes(stored)) return stored as Lang;
    const nav = (navigator.language || navigator.languages?.[0] || 'pl').toLowerCase();
    let lang: Lang = 'en';
    if (nav.startsWith('pl')) lang = 'pl';
    else if (nav.startsWith('it')) lang = 'it';
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
