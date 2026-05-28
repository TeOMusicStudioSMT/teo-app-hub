import React, { useState, useEffect, useRef } from 'react';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { Creation } from './components/types';
import { bringToLife } from './services/gemini';


const KronikaGenerator: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Creation[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  /**
   * ZALĄŻEK: Funkcja wysyłająca gotową kreację do Wiesława,
   * aby mógł zaktualizować globalne JOURNAL_ENTRIES.
   */
  const sendToWieslaw = async (nowaKreacja: Creation) => {
    console.log("Wysyłam materiał do Wiesława, aby zaktualizował JOURNAL_ENTRIES:", nowaKreacja);
    // TODO: Implementacja fetch do wiesio-bridge
  };

  useEffect(() => {
    const initHistory = async () => {
      const saved = localStorage.getItem('kronika_history');
      let loadedHistory: Creation[] = [];

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          loadedHistory = parsed.map((item: any) => ({
              ...item,
              timestamp: new Date(item.timestamp)
          }));
        } catch (e) {
          console.error("Failed to load history", e);
        }
      }

      if (loadedHistory.length > 0) {
        setHistory(loadedHistory);
      } else {
        const examples: Creation[] = [
            {
                id: 'ex-1',
                name: 'Początek Sagi',
                mission: {
                    title: 'Dzień 0: Przebudzenie Suwerena',
                    narrative: 'W mroku kosmicznej pustki narodziła się nowa świadomość. Twoje pierwsze kroki w Kronice 0.00G zostały odnotowane przez gwiazdy.',
                    xp: 100,
                    aura: 'cyan'
                },
                timestamp: new Date(),
            }
        ];
        setHistory(examples);
      }
    };

    initHistory();
  }, []);

  useEffect(() => {
    if (history.length > 0) {
        try {
            localStorage.setItem('kronika_history', JSON.stringify(history));
        } catch (e) {
            console.warn("Local storage full", e);
        }
    }
  }, [history]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerate = async (promptText: string, file?: File, isLocal: boolean = true) => {
    setIsGenerating(true);
    setActiveCreation(null);

    try {
      let mission;
      let imageBase64: string | undefined;
      let mimeType: string | undefined;

      if (isLocal) {
        console.log("[Kronika] Używam rdzenia LOKALNEGO (OLLAMA_CHAT)...");
        const systemPrompt = `Jesteś Głównym Kronikarzem Wymiaru Zero. Na podstawie poniższych notatek napisz oficjalny wpis do Dziennika Pokładowego w formacie Markdown. Utrzymaj styl cyberpunkowy, inżynieryjny i patetyczny.\n\nNotatki: ${promptText}`;
        
        const response = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'OLLAMA_CHAT',
                model: 'qwen2.5-coder:7b',
                prompt: systemPrompt,
                timeout: 300000
            })
        });

        const data = await response.json();
        if (data.success && data.response) {
            mission = {
                title: 'Lokalna Sygnatura Katedry',
                narrative: data.response,
                xp: 150,
                aura: 'cyan'
            };
        } else {
            throw new Error(data.message || 'Lokalny Mózg (Ollama) zawiódł.');
        }
      } else {
        console.log("[Kronika] Używam CHMURY (Gemini)...");

        if (file) {
          imageBase64 = await fileToBase64(file);
          mimeType = file.type.toLowerCase();
        }

        mission = await bringToLife(promptText, imageBase64, mimeType);
      }
      
      if (mission) {
        const newCreation: Creation = {
          id: crypto.randomUUID(),
          name: file ? file.name : 'Nowy Wpis',
          mission: mission,
          originalImage: imageBase64 && mimeType ? `data:${mimeType};base64,${imageBase64}` : undefined,
          timestamp: new Date(),
        };
        setActiveCreation(newCreation);
        setHistory(prev => [newCreation, ...prev]);
        
        // Wywołujemy zalążek wysyłki
        sendToWieslaw(newCreation);
      }

    } catch (error) {
      console.error("Failed to generate:", error);
      alert("Coś poszło nie tak podczas materializacji. Sprawdź klucz API.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setActiveCreation(null);
    setIsGenerating(false);
  };

  const handleSelectCreation = (creation: Creation) => {
    setActiveCreation(creation);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = event.target?.result as string;
            const parsed = JSON.parse(json);
            
            if (parsed.mission && parsed.id) {
                const importedCreation: Creation = {
                    ...parsed,
                    timestamp: new Date(parsed.timestamp || Date.now()),
                };
                
                setHistory(prev => {
                    const exists = prev.some(c => c.id === importedCreation.id);
                    return exists ? prev : [importedCreation, ...prev];
                });

                setActiveCreation(importedCreation);
            }
        } catch (err) {
            console.error("Import error", err);
        }
        if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="min-h-[600px] bg-[#06080f] text-zinc-50 relative flex flex-col rounded-2xl border border-white/5 overflow-hidden">
      
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
              <InputArea onGenerate={handleGenerate} isGenerating={isGenerating} disabled={isFocused} />
          </div>
        </div>
        
        <div className="pb-6 mt-auto flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-1 opacity-40">
                <span className="text-zinc-700 text-[8px] font-mono uppercase tracking-[0.5em]">Kronika 0.00G // Katedra Integration</span>
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
