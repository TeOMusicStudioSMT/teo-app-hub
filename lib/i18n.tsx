/**
 * 🌍 i18n.tsx — rdzeń internacjonalizacji Katedry (Punkt 3, cegła 2).
 *
 * LanguageContext + hook useT() + słownik PL/EN. Język startowy z detectLang()
 * (locale sprzętu), przełączalny i zapamiętywany. Stringi NIE w słowniku
 * degradują się łagodnie (zwracają fallback/klucz), więc migracja UI może iść
 * stopniowo — dodajesz klucze, UI samo „dojrzewa" w obu językach.
 *
 * Użycie:
 *   const { t, lang, setLang } = useT();
 *   <h1>{t('dash.network', 'Sieć Katedr')}</h1>
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { detectLang, setLang as persistLang, Lang } from './locale';

type Entry = { pl: string; en: string };
type Dict = Record<string, Entry>;

/** Słownik — rośnie wraz z migracją UI. Klucz: 'obszar.nazwa'. */
export const TR: Dict = {
  // ── Wspólne ───────────────────────────────────────────────────────────
  'common.language':   { pl: 'Język',        en: 'Language' },
  'common.close':      { pl: 'Zamknij',      en: 'Close' },
  'common.save':       { pl: 'Zapisz',       en: 'Save' },
  'common.loading':    { pl: 'Ładowanie...', en: 'Loading...' },
  // ── Dashboard / Univers ───────────────────────────────────────────────
  'dash.network':      { pl: 'Sieć Katedr',  en: 'Cathedral Network' },
  'dash.networkDesc':  { pl: 'Żywa mapa lokalnej AGI — suwerenne węzły na Twoich tranzystorach.',
                         en: 'Live local-AGI map — sovereign nodes on your transistors.' },
  'dash.universes':    { pl: 'Wszechświaty',  en: 'Universes' },
  // ── Studia (Univers cards) ────────────────────────────────────────────
  'studio.story':      { pl: 'Studio Opowieści', en: 'Story Studio' },
  'studio.storySub':   { pl: 'Twórz Rzeczywistość.', en: 'Construct Reality.' },
  'studio.music':      { pl: 'Studio Muzyczne', en: 'Music Studio' },
  'studio.musicSub':   { pl: 'Synteza Dźwięku.', en: 'Audio Synthesis.' },
  'studio.app':        { pl: 'Studio Aplikacji', en: 'App Studio' },
  'studio.appSub':     { pl: 'Narzędzia Kodu.', en: 'Code Tools.' },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: 'pl', setLang: () => {}, t: (k, fb) => fb ?? k });

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => detectLang());
  const setLang = useCallback((l: Lang) => { setLangState(l); persistLang(l); }, []);
  const t = useCallback((key: string, fallback?: string) => {
    const e = TR[key];
    if (!e) return fallback ?? key;
    return e[lang] ?? e.pl ?? fallback ?? key;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
};

export const useT = (): I18nCtx => useContext(Ctx);
