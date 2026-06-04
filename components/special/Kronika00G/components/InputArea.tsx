import React, { useCallback, useState, useEffect } from 'react';
import { 
    Upload, 
    Sparkles, 
    Cpu, 
    Tv, 
    Cloud, 
    FolderDown, 
    Layers 
} from 'lucide-react';

interface InputAreaProps {
  onGenerate: (prompt: string, file?: File) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const CyclingText = () => {
    const words = [
        "dzisiejszą wyprawę",
        "moment triumfu",
        "nowe odkrycie",
        "chwilę refleksji",
        "dowód Twojej siły",
        "wpis do kroniki"
    ];
    const [index, setIndex] = useState(0);
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false); // fade out
            setTimeout(() => {
                setIndex(prev => (prev + 1) % words.length);
                setFade(true); // fade in
            }, 500); // Wait for fade out
        }, 3000); 
        return () => clearInterval(interval);
    }, [words.length]);

    return (
        <span className={`inline-block whitespace-nowrap transition-all duration-500 transform ${fade ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-2 blur-sm'} text-white font-medium pb-1 border-b-2 border-[#c9953a]/50`}>
            {words[index]}
        </span>
    );
};

export const InputArea: React.FC<InputAreaProps> = ({ onGenerate, isGenerating, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputText, setInputText] = useState('');

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      onGenerate(inputText, file);
    } else {
      alert("Proszę wgrać obraz lub PDF.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isGenerating) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, isGenerating, inputText]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!disabled && !isGenerating) {
        setIsDragging(true);
    }
  }, [disabled, isGenerating]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
        onGenerate(inputText, undefined);
    }
  };

  const executeWiesioCommand = async (commandName: string, payload = {}) => {
    try {
        const response = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: commandName, ...payload })
        });
        const data = await response.json();
        console.log(`[WIESIO BRIDGE] Sukces: ${commandName}`, data);
    } catch (error) {
        console.error(`[WIESIO BRIDGE] Błąd połączenia dla ${commandName}:`, error);
    }
  };

  const handleAlchemikClick = () => {
    // Lokalny dialog wyboru pliku (zawsze tryb lokalny — Gemma 4)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  return (
    <div className="w-full max-w-6xl mx-auto perspective-1000 relative z-10">
      <div className="space-y-12">
        {/* Action Buttons Section */}
        <div className="p-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/10 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative group">
            {/* Neon Frame Accent */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
            
            <div className="relative flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-mono text-cyan-400 uppercase tracking-[0.4em] font-bold">
                        Narzędzia Materializacji (Wiesio Bridge)
                    </h4>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {/* 🧠 Skanuj Podświadomość */}
                    <button 
                        type="button"
                        onClick={() => executeWiesioCommand('LIST_DIRECTORY')}
                        className="flex flex-col items-center justify-center gap-3 p-4 bg-[#0c0e16]/60 backdrop-blur-md border border-pink-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 shadow-pink-500/20 text-pink-400"
                    >
                        <Cloud className="w-6 h-6" />
                        <span>Skanuj Podświadomość</span>
                    </button>

                    {/* ✨ Alchemik — lokalny (Gemma 4) */}
                    <button
                        type="button"
                        onClick={handleAlchemikClick}
                        className="flex flex-col items-center justify-center gap-3 p-4 bg-[#0c0e16]/60 backdrop-blur-md border border-amber-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 text-amber-400"
                    >
                        <Sparkles className="w-6 h-6" />
                        <span>Alchemik Pliku</span>
                    </button>

                    {/* 💾 Przybij Pieczęć */}
                    <button 
                        type="button"
                        onClick={() => executeWiesioCommand('SAVE_FILE', { filename: 'pieczec.txt', content: 'Pieczęć 0.00G Złożona' })}
                        className="flex flex-col items-center justify-center gap-3 p-4 bg-[#0c0e16]/60 backdrop-blur-md border border-blue-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 shadow-blue-500/20 text-blue-400"
                    >
                        <FolderDown className="w-6 h-6" />
                        <span>Przybij Pieczęć</span>
                    </button>

                    {/* 🧱 Zespawaj Klocki */}
                    <button 
                        type="button"
                        onClick={() => executeWiesioCommand('MERGE_VIDEO')}
                        className="flex flex-col items-center justify-center gap-3 p-4 bg-[#0c0e16]/60 backdrop-blur-md border border-orange-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 shadow-orange-500/20 text-orange-400"
                    >
                        <Layers className="w-6 h-6" />
                        <span>Zespawaj Klocki</span>
                    </button>
                </div>
            </div>
        </div>

        <div className="space-y-4">
        {/* Text Input Area */}
        <form onSubmit={handleTextSubmit} className="relative group">
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Opisz dzisiejszą misję..."
                className={`
                    w-full h-32 bg-[#0c0e16]/80 backdrop-blur-md border rounded-xl p-4 
                    text-zinc-100 placeholder:text-zinc-600 focus:outline-none 
                    transition-all duration-500 resize-none font-mono text-sm
                    ${isFocused 
                        ? 'border-[#c9953a]/60 shadow-[0_0_20px_rgba(201,149,58,0.15)] ring-1 ring-[#c9953a]/20' 
                        : 'border-zinc-800 hover:border-zinc-700'
                    }
                `}
                disabled={isGenerating || disabled}
            />
            <button
                type="submit"
                disabled={isGenerating || disabled || !inputText.trim()}
                className={`
                    absolute bottom-4 right-4 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all
                    ${inputText.trim() && !isGenerating 
                        ? 'bg-[#c9953a] text-black hover:bg-[#d4a75a] shadow-[0_0_15px_rgba(201,149,58,0.3)]' 
                        : 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                    }
                `}
            >
                {isGenerating ? 'Materializacja...' : 'Zapisz Tekst'}
            </button>
        </form>

        <div className="flex items-center gap-4 px-4">
            <div className="h-px flex-1 bg-zinc-800"></div>
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">LUB</span>
            <div className="h-px flex-1 bg-zinc-800"></div>
        </div>

        {/* File Drop Area */}
        <label
          className={`
            relative flex flex-col items-center justify-center
            h-48 sm:h-56
            bg-[#0c0e16]/50 
            backdrop-blur-sm
            rounded-xl border border-dashed
            cursor-pointer overflow-hidden
            transition-all duration-500 group/drop
            ${isDragging 
              ? 'border-[#c9953a] bg-[#0c0e16]/80 shadow-[inset_0_0_30px_rgba(201,149,58,0.15)] scale-[1.01]' 
              : 'border-zinc-800 hover:border-zinc-700 hover:bg-[#0c0e16]/60 hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]'
            }
            ${isGenerating ? 'pointer-events-none opacity-50' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
            <div className="relative z-10 flex flex-col items-center text-center space-y-4 p-6 w-full">
                <div className={`
                    relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500
                    ${isDragging ? 'scale-110 rotate-3' : 'group-hover/drop:-translate-y-1 group-hover/drop:scale-105'}
                `}>
                    <div className={`
                        absolute inset-0 rounded-2xl bg-zinc-900 border transition-colors duration-500
                        ${isDragging ? 'border-[#c9953a] shadow-[0_0_20px_rgba(201,149,58,0.3)]' : 'border-zinc-800 group-hover/drop:border-zinc-700'}
                        ${isGenerating ? 'animate-pulse' : ''}
                    `}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            {isGenerating ? (
                                <Cpu className="w-7 h-7 text-[#c9953a] animate-spin-slow" />
                            ) : (
                                <Upload className={`
                                    w-7 h-7 transition-all duration-500
                                    ${isDragging ? 'text-[#c9953a] -translate-y-1' : 'text-zinc-500 group-hover/drop:text-zinc-300'}
                                `} />
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-1 w-full max-w-3xl">
                    <h3 className="flex flex-col items-center justify-center text-lg sm:text-xl text-zinc-100 leading-none font-bold tracking-tighter gap-2">
                        <span>Zmaterializuj</span>
                        <div className="h-8 flex items-center justify-center w-full">
                           <CyclingText />
                        </div>
                    </h3>
                    <p className="text-zinc-500 text-[10px] font-light tracking-wide uppercase">
                        Przeciągnij plik lub kliknij by wybrać
                    </p>
                </div>
            </div>

            <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isGenerating || disabled}
            />
        </label>
      </div>
    </div>
  </div>
  );
};
