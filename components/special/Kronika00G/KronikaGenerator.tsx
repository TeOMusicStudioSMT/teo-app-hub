/**
 * 📜 KronikaGenerator — Moduł Dziennika Pokładowego 0.00G
 *
 * Silnik: Gemma 4 (lokalny, przez ApiDyrygent.dispatchDirectOllama)
 * Zapis: Wiesław /api/bridge/execute → WRITE_FILE → _AntiGravity_Wymiar/Kronika/
 */

import React, { useState, useEffect, useRef } from 'react';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { Creation } from './components/types';
import { bringToLife } from './services/gemini';

const WIESLAW_URL = 'http://127.0.0.1:3001';

// ─── Zapis fizyczny przez Wiesława ─────────────────────────────────────────────

/**
 * Materializuje wpis do pliku JSON w _AntiGravity_Wymiar/Kronika/
 * przez akcję WRITE_FILE Wiesława.
 */
const sendToWieslaw = async (kreacja: Creation): Promise<void> => {
  const timestamp = kreacja.timestamp instanceof Date
    ? kreacja.timestamp.toISOString().replace(/[:.]/g, '-')
    : new Date().toISOString().replace(/[:.]/g, '-');

  const filename = `Kronika/wpis_${timestamp}_${kreacja.id.slice(0, 8)}.json`;

  const payload = {
    action:  'WRITE_FILE',
    payload: {
      filename,
      content:  JSON.stringify(kreacja, null, 2),
      encoding: 'utf-8',
    },
  };

  try {
    const res = await fetch(`${WIESLAW_URL}/api/bridge/execute`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      console.log(`[Kronika] ✅ Wpis zmaterializowany: ${data.filePath ?? filename}`);
    } else {
      console.warn('[Kronika] ⚠️ Wiesław nie zapisał wpisu:', data.message);
    }
  } catch (err) {
    console.error('[Kronika] ❌ WRITE_FILE — połączenie z Wiesławem nieudane:', err);
  }
};

// ─── Komponent ─────────────────────────────────────────────────────────────────

const KronikaGenerator: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [history,        setHistory]        = useState<Creation[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Wczytaj historię z localStorage ─────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('kronika_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loaded: Creation[] = parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        setHistory(loaded);
        return;
      } catch (e) {
        console.error('[Kronika] Błąd odczytu historii:', e);
      }
    }

    // Przykładowy wpis startowy
    setHistory([{
      id:        'ex-1',
      name:      'Początek Sagi',
      mission: {
        title:     'Dzień 0: Przebudzenie Suwerena',
        narrative: 'W mroku kosmicznej pustki narodziła się nowa świadomość. Twoje pierwsze kroki w Kronice 0.00G zostały odnotowane przez gwiazdy.',
        xp:        100,
        aura:      'cyan',
      },
      timestamp: new Date(),
    }]);
  }, []);

  // ── Zapisuj historię w localStorage ─────────────────────────────────────────

  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem('kronika_history', JSON.stringify(history));
      } catch (e) {
        console.warn('[Kronika] localStorage pełne:', e);
      }
    }
  }, [history]);

  // ── Konwersja pliku do Base64 ────────────────────────────────────────────────

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Konwersja base64 nieudana'));
        }
      };
      reader.onerror = reject;
    });

  // ── Główna logika generowania ────────────────────────────────────────────────

  const handleGenerate = async (promptText: string, file?: File) => {
    setIsGenerating(true);
    setActiveCreation(null);

    try {
      let imageBase64: string | undefined;
      let mimeType:    string | undefined;

      if (file) {
        imageBase64 = await fileToBase64(file);
        mimeType    = file.type.toLowerCase();
      }

      // ── Lokalny silnik Gemma 4 ─────────────────────────────────────────────
      console.log('[Kronika] 🧠 Generuję wpis przez lokalny silnik Gemma 4...');
      const mission = await bringToLife(promptText, imageBase64, mimeType);

      const newCreation: Creation = {
        id:            crypto.randomUUID(),
        name:          file ? file.name : promptText.slice(0, 40) || 'Nowy Wpis',
        mission,
        originalImage: imageBase64 && mimeType
                          ? `data:${mimeType};base64,${imageBase64}`
                          : undefined,
        timestamp:     new Date(),
      };

      setActiveCreation(newCreation);
      setHistory(prev => [newCreation, ...prev]);

      // ── Fizyczny zapis przez Wiesława ──────────────────────────────────────
      await sendToWieslaw(newCreation);

    } catch (error) {
      console.error('[Kronika] Błąd generowania:', error);
      alert('Materializacja nie powiodła się. Sprawdź czy Wiesław i Ollama są uruchomione.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Import / Export ──────────────────────────────────────────────────────────

  const handleReset           = () => { setActiveCreation(null); setIsGenerating(false); };
  const handleSelectCreation  = (c: Creation) => setActiveCreation(c);
  const handleImportClick     = () => importInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.mission && parsed.id) {
          const imported: Creation = {
            ...parsed,
            timestamp: new Date(parsed.timestamp || Date.now()),
          };
          setHistory(prev => {
            const exists = prev.some(c => c.id === imported.id);
            return exists ? prev : [imported, ...prev];
          });
          setActiveCreation(imported);
        }
      } catch (err) {
        console.error('[Kronika] Import błąd:', err);
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="min-h-[600px] bg-[#06080f] text-zinc-50 relative flex flex-col rounded-2xl border border-white/5 overflow-hidden">

      {/* Hidden import input */}
      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Content Container */}
      <div
        className={`
          flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 relative z-10
          transition-all duration-700
          ${isFocused
            ? 'opacity-0 scale-95 blur-sm pointer-events-none'
            : 'opacity-100 scale-100 blur-0'
          }
        `}
      >
        <div className="flex-1 flex flex-col justify-center items-center w-full py-8">
          <div className="w-full flex justify-center mb-8">
            <InputArea
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              disabled={isFocused}
            />
          </div>
        </div>

        <div className="pb-6 mt-auto flex flex-col items-center gap-4">
          {/* Przycisk importu */}
          <button
            onClick={handleImportClick}
            className="text-[9px] font-mono uppercase tracking-[0.4em] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ⬆ Importuj wpis z pliku .json
          </button>
          <div className="flex flex-col items-center gap-1 opacity-40">
            <span className="text-zinc-700 text-[8px] font-mono uppercase tracking-[0.5em]">
              Kronika 0.00G // Silnik: Gemma 4 // Lokalny
            </span>
          </div>
        </div>
      </div>

      {/* Live Preview Overlay */}
      <LivePreview
        creation={activeCreation}
        history={history}
        isLoading={isGenerating}
        isFocused={isFocused}
        onReset={handleReset}
        onSelect={handleSelectCreation}
      />
    </div>
  );
};

export default KronikaGenerator;
