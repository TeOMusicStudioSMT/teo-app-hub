/**
 * 📜 KronikaGenerator — Moduł Dziennika Pokładowego 0.00G
 *
 * Silnik:     Gemma 4 (lokalny, przez ApiDyrygent.dispatchDirectOllama)
 * Stan:       Jotai atomWithStorage → kronika_history w localStorage (trwały po F5)
 * Zapis:      Wiesław /api/bridge/execute → WRITE_FILE → _AntiGravity_Wymiar/Kronika/
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { InputArea }   from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { Creation }    from './components/types';
import { bringToLife } from './services/gemini';
import {
  kronikaHistoryAtom,
  totalGrvAtom,
} from '../../../store/kronikaStore';

const WIESLAW_URL = 'http://127.0.0.1:3001';

// ─── Starter wpis (wyświetlany gdy baza jest pusta) ───────────────────────────

const STARTER_ENTRY: Creation = {
  id:        'ex-0',
  name:      'Początek Sagi',
  mission: {
    title:     'Dzień 0: Przebudzenie Suwerena',
    narrative: 'W mroku kosmicznej pustki narodziła się nowa świadomość. Twoje pierwsze kroki w Kronice 0.00G zostały odnotowane przez gwiazdy.',
    xp:        100,
    aura:      'cyan',
  },
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
};

// ─── Fizyczny zapis przez Wiesława ────────────────────────────────────────────

const sendToWieslaw = async (kreacja: Creation): Promise<void> => {
  const ts = kreacja.timestamp instanceof Date
    ? kreacja.timestamp.toISOString().replace(/[:.]/g, '-')
    : new Date().toISOString().replace(/[:.]/g, '-');

  const filename = `Kronika/wpis_${ts}_${kreacja.id.slice(0, 8)}.json`;

  try {
    const res = await fetch(`${WIESLAW_URL}/api/bridge/execute`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:  'WRITE_FILE',
        payload: {
          filename,
          content:  JSON.stringify(kreacja, null, 2),
          encoding: 'utf-8',
        },
      }),
    });
    const data = await res.json();
    if (data.success) {
      console.log(`[Kronika] ✅ Zmaterializowany: ${data.filePath ?? filename}`);
    } else {
      console.warn('[Kronika] ⚠️ Wiesław nie zapisał wpisu:', data.message);
    }
  } catch (err) {
    console.error('[Kronika] ❌ WRITE_FILE nieudany:', err);
  }
};

// ─── Komponent ─────────────────────────────────────────────────────────────────

const KronikaGenerator: React.FC = () => {
  // ── Trwały stan (Jotai atomWithStorage → localStorage) ──────────────────────
  const [history,   setHistory]   = useAtom(kronikaHistoryAtom);
  const totalGrv                  = useAtomValue(totalGrvAtom);

  // ── Stan lokalny ─────────────────────────────────────────────────────────────
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Starter wpis przy pierwszym uruchomieniu (gdy baza pusta) ────────────────
  useEffect(() => {
    if (history.length === 0) {
      setHistory([STARTER_ENTRY]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // tylko przy montowaniu

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

      console.log('[Kronika] 🧠 Generuję wpis przez lokalny silnik Gemma 4...');
      const mission = await bringToLife(promptText, imageBase64, mimeType);

      const newCreation: Creation = {
        id:            crypto.randomUUID(),
        name:          file ? file.name : (promptText.slice(0, 40) || 'Nowy Wpis'),
        mission,
        originalImage: (imageBase64 && mimeType)
                         ? `data:${mimeType};base64,${imageBase64}`
                         : undefined,
        timestamp:     new Date(),
      };

      setActiveCreation(newCreation);
      // atomWithStorage automatycznie persystuje do localStorage
      setHistory(prev => [newCreation, ...prev]);

      // Fizyczny zapis pliku przez Wiesława (fire-and-forget)
      sendToWieslaw(newCreation).catch(err =>
        console.warn('[Kronika] Wiesław niedostępny, wpis żyje w localStorage:', err)
      );

    } catch (error) {
      console.error('[Kronika] Błąd generowania:', error);
      alert('Materializacja nie powiodła się. Sprawdź czy Wiesław i Ollama są uruchomione.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Import JSON ───────────────────────────────────────────────────────────────

  const handleImportClick = () => importInputRef.current?.click();

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

  const handleReset          = () => { setActiveCreation(null); setIsGenerating(false); };
  const handleSelectCreation = (c: Creation) => setActiveCreation(c);

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

        {/* Stopka z GRV i przyciskiem importu */}
        <div className="pb-6 mt-auto flex flex-col items-center gap-3">
          {/* Licznik GRV */}
          <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/40 border border-white/5 rounded-xl">
            <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-zinc-600">
              Łączne GRV
            </span>
            <span className="text-sm font-bold text-[#c9953a] font-mono">
              {totalGrv.toLocaleString('pl-PL')}
            </span>
            <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">
              / {history.length} wpisów
            </span>
          </div>

          <button
            onClick={handleImportClick}
            className="text-[9px] font-mono uppercase tracking-[0.4em] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ⬆ Importuj wpis z pliku .json
          </button>

          <span className="text-zinc-800 text-[8px] font-mono uppercase tracking-[0.5em]">
            Kronika 0.00G // Silnik: Gemma 4 // Lokalny
          </span>
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
