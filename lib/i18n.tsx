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

type Entry = { pl: string; en: string; it?: string };
type Dict = Record<string, Entry>;

/** Słownik — rośnie wraz z migracją UI. Klucz: 'obszar.nazwa'. it? fallback → en. */
export const TR: Dict = {
  // ── Wspólne ───────────────────────────────────────────────────────────
  'common.language':   { pl: 'Język',        en: 'Language',    it: 'Lingua' },
  'common.close':      { pl: 'Zamknij',      en: 'Close',       it: 'Chiudi' },
  'common.save':       { pl: 'Zapisz',       en: 'Save',        it: 'Salva' },
  'common.loading':    { pl: 'Ładowanie...', en: 'Loading...',  it: 'Caricamento...' },
  // ── Dashboard / Univers ───────────────────────────────────────────────
  'dash.network':      { pl: 'Sieć Katedr',  en: 'Cathedral Network', it: 'Rete delle Cattedrali' },
  'dash.networkDesc':  { pl: 'Żywa mapa lokalnej AGI — suwerenne węzły na Twoich tranzystorach.',
                         en: 'Live local-AGI map — sovereign nodes on your transistors.',
                         it: "Mappa viva dell'AGI locale — nodi sovrani sui tuoi transistor." },
  'dash.universes':    { pl: 'Wszechświaty',  en: 'Universes',  it: 'Universi' },
  // ── Studia (Univers cards) ────────────────────────────────────────────
  'studio.story':      { pl: 'Studio Opowieści', en: 'Story Studio', it: 'Studio Racconti' },
  'studio.storySub':   { pl: 'Twórz Rzeczywistość.', en: 'Construct Reality.', it: 'Costruisci la Realtà.' },
  'studio.music':      { pl: 'Studio Muzyczne', en: 'Music Studio', it: 'Studio Musicale' },
  'studio.musicSub':   { pl: 'Synteza Dźwięku.', en: 'Audio Synthesis.', it: 'Sintesi del Suono.' },
  'studio.app':        { pl: 'Studio Aplikacji', en: 'App Studio', it: 'Studio Applicazioni' },
  'studio.appSub':     { pl: 'Narzędzia Kodu.', en: 'Code Tools.', it: 'Strumenti di Codice.' },
  // ── Orb (Sfera Centralna) ───────────────────────────────────────────────
  'orb.jestem':        { pl: 'JESTEM', en: 'I AM', it: 'IO SONO' },
  'orb.placeholder':   { pl: 'Wprowadź Intencję, Mistrzu...', en: 'Enter your Intent, Master...', it: 'Inserisci la tua Intenzione, Maestro...' },
  'orb.hint':          { pl: '↪ Wprowadzona intencja wlatuje do Sfery jako czyste światło...', en: '↪ Your intent flows into the Sphere as pure light...', it: "↪ L'intenzione entra nella Sfera come pura luce..." },
  'orb.listening':     { pl: '🎧 Nasłuchuje', en: '🎧 Listening', it: '🎧 In ascolto' },
  'orb.ready':         { pl: '✓ Gotowa', en: '✓ Ready', it: '✓ Pronta' },
  'orb.model':         { pl: 'Model:', en: 'Model:', it: 'Modello:' },
  'orb.mic.idle':      { pl: '🎙️ Mów do Sfery', en: '🎙️ Speak to the Sphere', it: '🎙️ Parla alla Sfera' },
  'orb.mic.recording': { pl: '🔴 Nagrywam... (kliknij by zakończyć)', en: '🔴 Recording... (click to stop)', it: '🔴 Registro... (clicca per terminare)' },
  'orb.mic.transcribing': { pl: 'Rozpoznaję mowę...', en: 'Transcribing speech...', it: 'Riconosco la voce...' },
  'orb.mic.stopTitle': { pl: 'Zatrzymaj nagrywanie', en: 'Stop recording', it: 'Ferma la registrazione' },
  'orb.mic.startTitle': { pl: 'Mów do Sfery', en: 'Speak to the Sphere', it: 'Parla alla Sfera' },
  'orb.mic.noMic':     { pl: 'Brak dostępu do mikrofonu.', en: 'No microphone access.', it: 'Nessun accesso al microfono.' },
  'orb.mic.noSpeech':  { pl: '🎙️ Nie usłyszałem nic wyraźnego...', en: "🎙️ I didn't catch anything clearly...", it: '🎙️ Non ho colto nulla di chiaro...' },
  'orb.mic.error':     { pl: 'Głos nie dotarł', en: 'Voice did not get through', it: 'La voce non è arrivata' },
  'orb.kosto.title':   { pl: '🎯 KostoOpty - Wybierz źródło mocy', en: '🎯 KostoOpty - Choose your power source', it: '🎯 KostoOpty - Scegli la fonte di potere' },
  'orb.kosto.approve': { pl: 'Zatwierdź', en: 'Approve', it: 'Conferma' },
  'orb.kosto.local':   { pl: 'Lokalna', en: 'Local', it: 'Locale' },
  'orb.kosto.legend':  { pl: '☁️ = Chmura (API) | 🏠 = Twój Ollama', en: '☁️ = Cloud (API) | 🏠 = Your Ollama', it: '☁️ = Cloud (API) | 🏠 = Il tuo Ollama' },
  'orb.err.silent':    { pl: 'Sfera milczy... spróbuj ponownie', en: 'The Sphere is silent... try again', it: 'La Sfera tace... riprova' },
  'orb.err.ollamaAsleep': { pl: 'Ollama śpi... Obudź reaktor w terminalu!', en: 'Ollama is asleep... Wake the reactor in the terminal!', it: 'Ollama dorme... Sveglia il reattore nel terminale!' },
  'orb.err.cloudDown': { pl: 'Chmura niedostępna...', en: 'Cloud unavailable...', it: 'Cloud non disponibile...' },
  'orb.err.darkness':  { pl: 'Ciemność... Nawet Duch Lokalny nie odpowiedział.', en: 'Darkness... Even the Local Spirit did not answer.', it: 'Oscurità... Nemmeno lo Spirito Locale ha risposto.' },
  'orb.fallbackLocal': { pl: '🌩️ Chmura niedostępna - 🌑 Lokalny Duch przejął stery', en: '🌩️ Cloud unavailable - 🌑 Local Spirit took over', it: '🌩️ Cloud non disponibile - 🌑 Lo Spirito Locale ha preso il timone' },
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
    // it? → fallback en → pl → podany fallback → klucz (żaden język nie zostaje pusty)
    return e[lang] ?? e.en ?? e.pl ?? fallback ?? key;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
};

export const useT = (): I18nCtx => useContext(Ctx);
