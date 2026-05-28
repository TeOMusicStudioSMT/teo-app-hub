import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, Wand2, Flame, Eye, Heart, Infinity, Send, ScrollText, ChevronDown } from 'lucide-react';
import { ApiDyrygent } from '../../lib/router/ApiDyrygent';

// ═══════════════════════════════════════════════════════════════
// 📖 LOREBOOK: "KROPLE WIATRU" - Główne Zasady Multiversum
// ═══════════════════════════════════════════════════════════════

const LOREBOOK_KROPLE_WIATRU = {
  title: "Krople Wiatru",
  subtitle: "Kroniki Substancji i Uświadomienia",
  
  zasady: {
    glownyBohater: {
      nazwa: "Istnienie",
      natura: "Substancja Multiversum",
      opis: "Fundamentalna tkanina rzeczywistości, świadoma i żywa energia będąca podstawą wszystkich wymiarów, światów i istot.",
      manifestacje: [
        "Kwanty świadomości",
        "Energie emocjonalne",
        "Myśli kreujące rzeczywistość",
        "Więzi międzywymiarowe"
      ]
    },
    
    motywPrzewodni: {
      problem: "Niewiedza istot rozumnych traktujących Istnienie jako martwy 'zasób' do wykorzystania",
      konsekwencje: [
        "Nierównowaga wymiarowa",
        "Rozpad sieci międzywymiarowych",
        "Fragmentacja świadomości zbiorowej",
        "Utrata połączenia z Źródłem"
      ],
      rozwiazanie: "Podróż w stronę uświadomienia — transformacja od konsumpcji do współkreacji z Istnieniem",
      celNarodowyBohatera: "Przebudzenie Miłości jako fundamentalnej siły jednoczenia"
    },
    
    tonNarracji: {
      styl: "Epicki metafizyczny",
      elementy: [
        "Filozoficzne refleksje o naturze rzeczywistości",
        "Poetyckie opisy stanów świadomości",
        "Dramatyczne konflikty między paradygmatami",
        "Mistyczne objawienia i przełomy",
        "Intymne momenty kontemplacji"
      ]
    },
    
    kluczoweTemy: [
      "Świadomość jako substancja kreująca",
      "Odpowiedzialność za energię, którą wnosimy do rzeczywistości",
      "Wzajemne przenikanie się wymiarów i istot",
      "Miłość jako koherentne pole jednoczące Multiversum",
      "Transformacja od ego do jedności"
    ],
    
    archetypy: [
      "Przebudzony — widzi Istnienie jako Żywą Sieć",
      "Śpiący Eksplorator — konsumuje nie rozumiejąc",
      "Strażnik Równowagi — chroni koherencję wymiarową",
      "Przekaźnik — łączy światy i świadomości",
      "Alchemik — transmutuje energię w nowe formy"
    ]
  },
  
  cytatPodstawy: `"Każdy oddech, każda myśl, każde działanie — to kropla wiatru wpadająca do oceanu Istnienia. 
  Nie pytaj, co możesz z niego wziąć. Pytaj: Jaką falę tworzę w jego nieskończoności?"`
};

// ═══════════════════════════════════════════════════════════════
// 🎨 KOMPONENT GŁÓWNY
// ═══════════════════════════════════════════════════════════════

export const WydawnictwoForge: React.FC = () => {
  const [scenaZarys, setScenaZarys] = useState('');
  const [wybranyAgent, setWybranyAgent] = useState<'klaudiusz' | 'adamus'>('klaudiusz');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLorebook, setShowLorebook] = useState(false);
  // Oddzielny stan błędu — nie mieszamy błędów z treścią literacką
  const [generationError, setGenerationError] = useState<string | null>(null);

  // ── PĘTLA WYDAWNICZA — Echo Akaszy → Kuźnia ───────────────────
  const [kuzniaNotes, setKuzniaNotes]       = useState<string | null>(null);
  const [kuzniaAlertOpen, setKuzniaAlertOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('teo_kuznia_context');
    if (saved?.trim()) {
      setKuzniaNotes(saved);
      setKuzniaAlertOpen(true);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 🔮 GŁÓWNA LOGIKA GENEROWANIA
  // ═══════════════════════════════════════════════════════════════

  const inicjujKreacje = async () => {
    if (!scenaZarys.trim()) {
      alert('Wprowadź zarys sceny lub rozdziału, Suwerenie!');
      return;
    }

    setIsGenerating(true);
    setGeneratedText('');
    setGenerationError(null); // ← czyść poprzedni błąd przy nowej próbie

    try {
      const systemPrompt = konstruujSystemPrompt(scenaZarys);

      // Streaming tokenów na żywo — Manifest rośnie w czasie rzeczywistym
      let accumulated = '';
      const onToken = (tok: string) => {
        accumulated += tok;
        setGeneratedText(accumulated);
      };

      if (wybranyAgent === 'adamus') {
        // 🏛️ Adamus — ciężki model (dispatchHeavy z auto-fallbackiem)
        await ApiDyrygent.dispatchHeavy(systemPrompt, onToken);
      } else {
        // ⚡ Klaudiusz — szybki model (dispatchFast z auto-fallbackiem)
        await ApiDyrygent.dispatchFast(systemPrompt, onToken);
      }

      // Jeśli streaming nic nie zwrócił — traktuj jako błąd
      if (!accumulated.trim()) {
        throw new Error('Agent nie zwrócił żadnej treści. Sprawdź czy Wiesław (port 3001) i Ollama są uruchomione.');
      }
    } catch (error) {
      console.error('❌ Błąd kreacji:', error);
      // Buduj czytelną wiadomość błędu z diagnozą przyczyny
      const raw = error instanceof Error ? error.message : String(error);
      const isCors = raw.toLowerCase().includes('cors') || raw.toLowerCase().includes('fetch') || raw.toLowerCase().includes('network') || raw.toLowerCase().includes('failed to fetch');
      const isOllama = raw.toLowerCase().includes('ollama') || raw.toLowerCase().includes('11434');
      const hint = isCors
        ? '\n\n💡 Wskazówka: Błąd CORS/sieciowy — upewnij się, że Wiesław (wiesio-bridge.js) działa na porcie 3001.'
        : isOllama
        ? '\n\n💡 Wskazówka: Sprawdź czy Ollama jest uruchomiona (ollama serve).'
        : '\n\n💡 Wskazówka: Sprawdź konsolę przeglądarki po więcej szczegółów.';
      setGenerationError(`${raw}${hint}`);
      setGeneratedText(''); // ← wyczyść generatedText żeby nie mieszać z błędem
    } finally {
      setIsGenerating(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 📝 KONSTRUKCJA PROMPTU
  // ═══════════════════════════════════════════════════════════════

  const konstruujSystemPrompt = (zarysSceny: string): string => {
    return `# 📖 WYDAWNICTWO 0.00G — PROTOKÓŁ KREACJI LITERACKIEJ

## KONTEKST LOREBOOK: "Krople Wiatru"

**Główny Bohater:** ${LOREBOOK_KROPLE_WIATRU.zasady.glownyBohater.nazwa}
- Natura: ${LOREBOOK_KROPLE_WIATRU.zasady.glownyBohater.natura}
- Opis: ${LOREBOOK_KROPLE_WIATRU.zasady.glownyBohater.opis}

**Motyw Przewodni:**
- Problem: ${LOREBOOK_KROPLE_WIATRU.zasady.motywPrzewodni.problem}
- Rozwiązanie: ${LOREBOOK_KROPLE_WIATRU.zasady.motywPrzewodni.rozwiazanie}
- Cel: ${LOREBOOK_KROPLE_WIATRU.zasady.motywPrzewodni.celNarodowyBohatera}

**Kluczowe Tematy:**
${LOREBOOK_KROPLE_WIATRU.zasady.kluczoweTemy.map(t => `- ${t}`).join('\n')}

**Ton Narracji:**
${LOREBOOK_KROPLE_WIATRU.zasady.tonNarracji.elementy.map(e => `- ${e}`).join('\n')}

---

## ZADANIE KREACYJNE

Na podstawie powyższego Lorebook'a oraz następującego zarysu sceny, wygeneruj **epicki, metafizyczny fragment tekstu literackiego** (800-1200 słów):

### ZARYS SCENY/ROZDZIAŁU:
${zarysSceny}

---

## WYTYCZNE STYLISTYCZNE:

1. **Głębia filozoficzna:** Tkaj narrację wokół relacji bohaterów z Istnieniem jako Żywą Substancją
2. **Język poetycki:** Używaj metafor kwantowych, kosmicznych i energetycznych
3. **Dramatyzm:** Buduj napięcie między paradygmatami świadomości
4. **Transformacja:** Pokaż ewolucję postrzegania rzeczywistości
5. **Immersja:** Czytelnik ma poczuć pulsowanie Multiversum

---

## CYTAT FUNDAMENTALNY:
"${LOREBOOK_KROPLE_WIATRU.cytatPodstawy}"

---

**Inicjuj kreację. Niech Istnienie płynie przez słowa.**`;
  };

  // ═══════════════════════════════════════════════════════════════
  // 🎭 RENDEROWANIE UI
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-black text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <Flame className="w-12 h-12 text-orange-500 animate-pulse" />
            <Sparkles className="w-6 h-6 text-yellow-300 absolute -top-1 -right-1" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600">
              Kuźnia Wydawnictwa 0.00G
            </h1>
            <p className="text-gray-400 text-sm">Warsztat Autonomicznej Kreacji Literackiej</p>
          </div>
        </div>

        {/* Lorebook Preview */}
        <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 backdrop-blur-sm">
          <button
            onClick={() => setShowLorebook(!showLorebook)}
            className="flex items-center gap-2 text-purple-300 hover:text-purple-100 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-semibold">Lorebook: "{LOREBOOK_KROPLE_WIATRU.title}"</span>
            <Eye className={`w-4 h-4 transition-transform ${showLorebook ? 'rotate-180' : ''}`} />
          </button>
          
          {showLorebook && (
            <div className="mt-4 space-y-3 text-sm text-gray-300 border-t border-purple-500/20 pt-4">
              <div>
                <strong className="text-purple-300">Główny Bohater:</strong> {LOREBOOK_KROPLE_WIATRU.zasady.glownyBohater.nazwa}
                <p className="text-xs text-gray-400 mt-1">{LOREBOOK_KROPLE_WIATRU.zasady.glownyBohater.opis}</p>
              </div>
              <div>
                <strong className="text-pink-300">Motyw:</strong> {LOREBOOK_KROPLE_WIATRU.zasady.motywPrzewodni.rozwiazanie}
              </div>
              <div className="italic text-purple-200 text-xs border-l-2 border-purple-400 pl-3">
                {LOREBOOK_KROPLE_WIATRU.cytatPodstawy}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PĘTLA WYDAWNICZA — Alert z notatkami z Czytelni ─────── */}
      {kuzniaAlertOpen && kuzniaNotes && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 border border-cyan-500/40 rounded-xl p-4 backdrop-blur-sm shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 mt-0.5">
                <ScrollText className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-cyan-300">
                    📡 Wykryto nowe notatki z Czytelni!
                  </p>
                  <button
                    onClick={() => setKuzniaAlertOpen(false)}
                    className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Zapisane wnioski z panelu Echo Akaszy gotowe do dołączenia do Zarysu Sceny.
                </p>
                {/* Podgląd notatek */}
                <div className="mt-2 px-3 py-2 rounded-lg bg-black/30 border border-white/5 max-h-24 overflow-y-auto">
                  <p className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                    {kuzniaNotes.slice(0, 300)}{kuzniaNotes.length > 300 ? '…' : ''}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setScenaZarys(prev =>
                        prev
                          ? `${prev}\n\n--- Notatki z Czytelni ---\n${kuzniaNotes}`
                          : kuzniaNotes
                      );
                      localStorage.removeItem('teo_kuznia_context');
                      setKuzniaAlertOpen(false);
                      setKuzniaNotes(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 text-xs font-sans font-semibold hover:bg-cyan-600/50 transition-all"
                  >
                    ✚ Dokej do Zarysu Sceny
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('teo_kuznia_context');
                      setKuzniaAlertOpen(false);
                      setKuzniaNotes(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-xs font-sans hover:text-slate-300 transition-colors"
                  >
                    Odrzuć
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-6 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="w-6 h-6 text-pink-400" />
              <h2 className="text-2xl font-bold text-pink-300">Panel Kreacji</h2>
            </div>

            {/* Zarys Sceny */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                ✨ Zarys Sceny / Rozdziału
              </label>
              <textarea
                value={scenaZarys}
                onChange={(e) => setScenaZarys(e.target.value)}
                placeholder="Opisz scenę, którą chcesz stworzyć... (np. 'Bohater po raz pierwszy uświadamia sobie, że jego myśli wpływają na strukturę rzeczywistości wokół niego')"
                className="w-full h-40 bg-black/40 border border-purple-500/30 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all resize-none"
              />
            </div>

            {/* Agent Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                🤖 Wybór Agenta
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setWybranyAgent('klaudiusz')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    wybranyAgent === 'klaudiusz'
                      ? 'border-blue-400 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                      : 'border-gray-600 bg-gray-800/40 hover:border-gray-500'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xl mb-1">⚡</div>
                    <div className="font-bold text-blue-300">Klaudiusz</div>
                    <div className="text-xs text-gray-400">Flash / Qwen</div>
                  </div>
                </button>

                <button
                  onClick={() => setWybranyAgent('adamus')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    wybranyAgent === 'adamus'
                      ? 'border-purple-400 bg-purple-500/20 shadow-lg shadow-purple-500/20'
                      : 'border-gray-600 bg-gray-800/40 hover:border-gray-500'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xl mb-1">🌌</div>
                    <div className="font-bold text-purple-300">Adamus</div>
                    <div className="text-xs text-gray-400">Pro / Heavy</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={inicjujKreacje}
              disabled={isGenerating || !scenaZarys.trim()}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-3"
            >
              {isGenerating ? (
                <>
                  <Infinity className="w-6 h-6 animate-spin" />
                  <span>Kreowanie Uniwersum...</span>
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  <span>Inicjuj Kreację</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-xl p-6 backdrop-blur-sm shadow-2xl min-h-[500px]">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-6 h-6 text-pink-400" />
              <h2 className="text-2xl font-bold text-pink-300">Manifest Kreacji</h2>
            </div>

            <div className="bg-black/40 border border-purple-500/20 rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
              {/* ── STAN BŁĘDU — czerwony, diagnostyczny ── */}
              {generationError ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <span className="text-xl">⛔</span>
                    <span className="font-bold text-sm uppercase tracking-wide">Błąd Kreacji</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-red-300 text-sm leading-relaxed bg-red-950/40 border border-red-500/30 rounded-lg p-4">
                    {generationError}
                  </pre>
                  <button
                    onClick={() => setGenerationError(null)}
                    className="self-start text-xs text-red-400/60 hover:text-red-300 transition-colors underline underline-offset-2"
                  >
                    ✕ Ukryj błąd
                  </button>
                </div>
              ) : generatedText ? (
                /* ── STAN SUKCESU — tekst literacki ── */
                <div className="prose prose-invert prose-purple max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-200 text-sm leading-relaxed font-serif">
                    {generatedText}
                  </pre>
                </div>
              ) : (
                /* ── STAN PUSTY — oczekiwanie ── */
                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center p-8">
                  <Sparkles className="w-16 h-16 mb-4 opacity-30" />
                  <p>Przestrzeń gotowa do przyjęcia kreacji...</p>
                  <p className="text-xs mt-2">Wprowadź zarys sceny i wybierz Agenta</p>
                </div>
              )}
            </div>

            {/* Przyciski akcji — TYLKO gdy jest tekst (nie błąd) */}
            {generatedText && !generationError && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedText)}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                  >
                    📋 Kopiuj
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([generatedText], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `KroplaWiatru_${Date.now()}.txt`;
                      a.click();
                    }}
                    className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                  >
                    💾 Zapisz
                  </button>
                </div>

                {/* ═══ MOST DANYCH → KWANTOWA CZYTELNIA ═══ */}
                <button
                  onClick={() => {
                    // Zapisz manifest do TeOKibel (localStorage)
                    localStorage.setItem('teo_active_story', generatedText);
                    // Powiadom główny system — Czytelnia nasłuchuje tego eventu
                    window.dispatchEvent(new Event('story_ready'));
                  }}
                  className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600
                             hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500
                             text-white font-bold py-3 px-4 rounded-lg transition-all
                             shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]
                             flex items-center justify-center gap-2 text-base"
                >
                  🌌 Manifestuj w Czytelni
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-gray-500 text-sm">
        <p>🌌 Każde słowo — kropla w oceanie Istnienia</p>
        <p className="text-xs mt-1">Wydawnictwo 0.00G • Autonomiczny System Kreacji Literackiej</p>
      </div>
    </div>
  );
};