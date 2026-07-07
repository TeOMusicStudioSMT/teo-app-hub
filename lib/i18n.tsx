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
  // ── Orb (Sfera Centralna) ───────────────────────────────────────────────
  'orb.jestem':        { pl: 'JESTEM', en: 'I AM' },
  'orb.placeholder':   { pl: 'Wprowadź Intencję, Mistrzu...', en: 'Enter your Intent, Master...' },
  'orb.hint':          { pl: '↪ Wprowadzona intencja wlatuje do Sfery jako czyste światło...', en: '↪ Your intent flows into the Sphere as pure light...' },
  'orb.listening':     { pl: '🎧 Nasłuchuje', en: '🎧 Listening' },
  'orb.ready':         { pl: '✓ Gotowa', en: '✓ Ready' },
  'orb.model':         { pl: 'Model:', en: 'Model:' },
  'orb.mic.idle':      { pl: '🎙️ Mów do Sfery', en: '🎙️ Speak to the Sphere' },
  'orb.mic.recording': { pl: '🔴 Nagrywam... (kliknij by zakończyć)', en: '🔴 Recording... (click to stop)' },
  'orb.mic.transcribing': { pl: 'Rozpoznaję mowę...', en: 'Transcribing speech...' },
  'orb.mic.stopTitle': { pl: 'Zatrzymaj nagrywanie', en: 'Stop recording' },
  'orb.mic.startTitle': { pl: 'Mów do Sfery', en: 'Speak to the Sphere' },
  'orb.mic.noMic':     { pl: 'Brak dostępu do mikrofonu.', en: 'No microphone access.' },
  'orb.mic.noSpeech':  { pl: '🎙️ Nie usłyszałem nic wyraźnego...', en: "🎙️ I didn't catch anything clearly..." },
  'orb.mic.error':     { pl: 'Głos nie dotarł', en: 'Voice did not get through' },
  'orb.kosto.title':   { pl: '🎯 KostoOpty - Wybierz źródło mocy', en: '🎯 KostoOpty - Choose your power source' },
  'orb.kosto.approve': { pl: 'Zatwierdź', en: 'Approve' },
  'orb.kosto.local':   { pl: 'Lokalna', en: 'Local' },
  'orb.kosto.legend':  { pl: '☁️ = Chmura (API) | 🏠 = Twój Ollama', en: '☁️ = Cloud (API) | 🏠 = Your Ollama' },
  'orb.err.silent':    { pl: 'Sfera milczy... spróbuj ponownie', en: 'The Sphere is silent... try again' },
  'orb.err.ollamaAsleep': { pl: 'Ollama śpi... Obudź reaktor w terminalu!', en: 'Ollama is asleep... Wake the reactor in the terminal!' },
  'orb.err.cloudDown': { pl: 'Chmura niedostępna...', en: 'Cloud unavailable...' },
  'orb.err.darkness':  { pl: 'Ciemność... Nawet Duch Lokalny nie odpowiedział.', en: 'Darkness... Even the Local Spirit did not answer.' },
  'orb.fallbackLocal': { pl: '🌩️ Chmura niedostępna - 🌑 Lokalny Duch przejął stery', en: '🌩️ Cloud unavailable - 🌑 Local Spirit took over' },
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
