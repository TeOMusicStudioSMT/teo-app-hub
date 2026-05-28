import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Save, Download, Trash2, Play, Pause, ChevronRight, X } from 'lucide-react';
import { useKatedraRadio } from '../../context/KatedraRadioContext';
import toast from 'react-hot-toast';

interface SyncedLine {
  time: number;
  timestamp: string;
  text: string;
}

export function TeoKaraokeForge({ onClose }: { onClose: () => void }) {
  const radio = useKatedraRadio();
  const [rawText, setRawText] = useState('');
  const [parsedLines, setParsedLines] = useState<string[]>([]);
  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Parsowanie tekstu na linie
  useEffect(() => {
    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setParsedLines(lines);
    setSyncedLines([]);
    setCurrentIndex(0);
  }, [rawText]);

  // Formatowanie czasu: [mm:ss.xx]
  // NAPRAWA NaN: explicit cast + guard przed NaN/Infinity/ujemnymi
  const formatLRCTime = (seconds: number): string => {
    const s = Number(seconds);
    if (!isFinite(s) || s < 0) return '[00:00.00]';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms   = Math.floor((s % 1) * 100);
    return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
  };

  const handleSync = useCallback(() => {
    if (currentIndex >= parsedLines.length) return;

    // NAPRAWA NaN: wymuszone rzutowanie + guard
    const time = Number(radio.currentTime);
    if (!isFinite(time)) {
      toast.error('Odtwarzacz nie ma załadowanego utworu — czas jest niedostępny.');
      return;
    }
    const timestamp = formatLRCTime(time);
    const newLine: SyncedLine = {
      time,
      timestamp,
      text: parsedLines[currentIndex],
    };

    setSyncedLines(prev => [...prev, newLine]);
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex, parsedLines, radio.currentTime]);

  // Auto-scroll Effect: Sfera Płynności
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('.active-line');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentIndex]);

  // Obsługa spacji
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSync();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSync]);

  const downloadLRC = () => {
    const content = syncedLines
      .map(line => `${line.timestamp}${line.text}`)
      .join('\n');
    
    // Metadata
    const metadata = `[ti:${radio.currentTrack?.title || 'Unknown'}]\n[re:TeO Karaoke Forge 0.00G]\n[ve:1.0]\n\n`;
    const finalContent = metadata + content;

    const blob = new Blob([finalContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = (radio.currentTrack?.title || 'Song').replace(/\s+/g, '_') + '.lrc';
    
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetSync = () => {
    setSyncedLines([]);
    setCurrentIndex(0);
  };

  const adjustTime = (idx: number, amount: number) => {
    setSyncedLines(prev => prev.map((line, i) => {
      if (i === idx) {
        const newTime = Math.max(0, line.time + amount);
        return {
          ...line,
          time: newTime,
          timestamp: formatLRCTime(newTime)
        };
      }
      return line;
    }));
  };

  const handleAutoSync = async () => {
    if (!rawText.trim()) { toast.error('Wklej tekst piosenki przed Auto-Sync.'); return; }
    if (!radio.currentTrack) { toast.error('Brak aktywnego utworu w odtwarzaczu.'); return; }

    // NAPRAWA URL: preferujemy filename (ścieżka lokalna), nie CDN URL
    const audioPath = radio.currentTrack.filename
      ? radio.currentTrack.filename          // np. "Artysta/Tytuł.mp3" → backend doda prefiks muzyki
      : radio.currentTrack.audio_url;        // fallback: CDN URL (może nie działać offline)

    if (!radio.currentTrack.filename && !radio.currentTrack.audio_url?.includes('127.0.0.1')) {
      toast.error('Ten utwór pochodzi z CDN — Auto-Sync wymaga lokalnego pliku audio z biblioteki.');
      return;
    }

    setIsAutoSyncing(true);
    try {
      const response = await fetch('http://127.0.0.1:3001/api/bridge/autosync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, text: rawText, model: 'small' }),
      });

      // NAPRAWA: sprawdź HTTP status zanim sparsujemy JSON
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg: string = (errData as any).message || `Błąd HTTP ${response.status}`;
        // Specyficzny komunikat dla brakujących wektorów / silnika
        if (/whisper|model|silnik|bin|ggml/i.test(msg)) {
          toast.error(`Wektory soniczne nie są jeszcze gotowe: ${msg}`, { duration: 6000 });
        } else if (/nie znaleziono|not found/i.test(msg)) {
          toast.error(`Plik audio nie istnieje lokalnie. Sprawdź bibliotekę muzyki.`, { duration: 5000 });
        } else {
          toast.error(msg);
        }
        return;
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.syncedLines) && data.syncedLines.length > 0) {
        // NAPRAWA NaN: sanitacja każdego wpisu z backendu
        const safe: SyncedLine[] = data.syncedLines.map((line: any) => {
          const t = Number(line.time);
          const safeTime = isFinite(t) && t >= 0 ? t : 0;
          return {
            time:      safeTime,
            timestamp: line.timestamp && !line.timestamp.includes('NaN')
                         ? line.timestamp
                         : formatLRCTime(safeTime),
            text: String(line.text ?? ''),
          };
        });
        setSyncedLines(safe);
        setCurrentIndex(safe.length);
        toast.success(`✅ Auto-Sync zakończony! Zmapowano ${safe.length} linii.`);
      } else {
        toast.error(data.message || 'Silnik AI nie zwrócił wyników. Sprawdź logi Wiesława.');
      }
    } catch (err) {
      console.error('[Karaoke] Auto-Sync Error:', err);
      toast.error('Nie udało się połączyć z Wiesławem. Czy bridge (port 3001) działa?');
    } finally {
      setIsAutoSyncing(false);
    }
  };



  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[1000000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl pointer-events-auto"
      onClick={onClose} // Pozwól zamykać klikając w tło
    >
      <div 
        className="relative w-full max-w-7xl h-[85vh] flex flex-col bg-slate-950 border border-emerald-500/30 rounded-2xl shadow-[0_0_50_px_rgba(16,185,129,0.1)] overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Blokuj zamykanie przy kliknięciu w sam modal
      >

        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Mic size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-300 tracking-widest uppercase">TeO Karaoke Forge 0.00G</h2>
              <p className="text-[10px] text-slate-500 font-mono tracking-tighter">SYNCHRONIZATOR WEKTOROWY : {radio.currentTrack?.title || 'BRAK UTWORU'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Raw Text Input */}
          <div className="w-[40%] flex flex-col border-r border-white/5 p-6">
            <label className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Tekst Surowy
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Wklej tekst piosenki tutaj... jedna linia = jeden wers."
              className="flex-1 bg-black/40 border border-white/5 rounded-xl p-4 text-sm text-slate-300 font-mono outline-none focus:border-emerald-500/40 transition-colors resize-none placeholder:text-slate-700"
            />
            <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>LINII: {parsedLines.length}</span>
              <div className="flex gap-4">
                <button 
                  onClick={handleAutoSync}
                  disabled={isAutoSyncing || parsedLines.length === 0}
                  className={`flex items-center gap-1 transition-colors uppercase font-bold ${isAutoSyncing ? 'text-cyan-400 animate-pulse' : 'text-cyan-500 hover:text-cyan-300'}`}
                >
                  {isAutoSyncing ? '[ ANALIZA... ]' : '[ 🧠 AUTO-SYNC ]'}
                </button>
                <button 
                  onClick={() => setRawText('')}
                  className="flex items-center gap-1 hover:text-red-400 transition-colors uppercase"
                >
                  <Trash2 size={12} /> wyczyść
                </button>
              </div>
            </div>

          </div>

          {/* Right: Syncing Station */}
          <div className="w-[60%] flex flex-col p-6 bg-emerald-500/[0.02]">
            <label className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
              Stacja Synchronizacji
            </label>
            
            <div 
              ref={scrollRef}
              className="flex-1 bg-black/40 border border-white/5 rounded-xl p-4 overflow-y-auto space-y-2 custom-scrollbar"
            >
              {parsedLines.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-700 text-xs font-mono">
                  OCZEKIWANIE NA DANE WEJŚCIOWE...
                </div>
              ) : (
                parsedLines.map((line, idx) => {
                  const synced = syncedLines[idx];
                  const isActive = idx === currentIndex;
                  const isDone = idx < currentIndex;

                  return (
                    <div 
                      key={idx}
                      className={`
                        p-3 rounded-lg border transition-all duration-300 flex items-start gap-4
                        ${isActive ? 'active-line bg-emerald-500/10 border-emerald-500/50 scale-[1.01] shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-transparent'}
                        ${isDone ? 'opacity-40 grayscale-[0.5]' : ''}
                        ${!isActive && !isDone ? 'opacity-20' : ''}
                      `}
                    >
                      <div className="w-20 pt-0.5 text-[10px] font-mono text-emerald-400 shrink-0">
                        {synced ? synced.timestamp : isActive ? '[ --:--.-- ]' : ''}
                      </div>

                      {synced && (
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); adjustTime(idx, -0.1); }}
                            className="text-[9px] bg-white/5 hover:bg-white/10 px-1 rounded text-slate-500 hover:text-red-400"
                          >
                            -0.1s
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); adjustTime(idx, 0.1); }}
                            className="text-[9px] bg-white/5 hover:bg-white/10 px-1 rounded text-slate-500 hover:text-emerald-400"
                          >
                            +0.1s
                          </button>
                        </div>
                      )}

                      <div className={`flex-1 text-sm font-medium whitespace-normal break-words leading-relaxed ${isActive ? 'text-white' : 'text-slate-400'}`}>
                        {line}
                      </div>

                      {isActive && (
                        <div className="ml-auto animate-bounce text-emerald-400">
                          <ChevronRight size={16} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Controls */}
            <div className="mt-6 flex flex-col gap-4">
              
              <div className="flex items-center gap-4 justify-between bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase tracking-tighter">Aktualny Czas</span>
                  <span className="text-xl font-mono text-cyan-400 font-bold">{formatLRCTime(radio.currentTime)}</span>
                </div>

                <div className="flex flex-col gap-1 items-center">
                   <span className="text-[8px] text-slate-500 uppercase">Speed</span>
                   <div className="flex gap-1">
                     {[0.5, 0.75, 1.0].map(rate => (
                       <button
                         key={rate}
                         onClick={() => radio.setPlaybackRate(rate)}
                         className={`text-[10px] px-2 py-1 rounded border transition-all ${radio.playbackRate === rate ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-white/10 text-slate-500 hover:text-white'}`}
                       >
                         {rate}x
                       </button>
                     ))}
                   </div>
                </div>

                <div className="flex gap-2">

                  <button 
                    onClick={radio.toggle}
                    className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all scale-active"
                  >
                    {radio.isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button 
                    onClick={resetSync}
                    className="p-3 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded-full text-slate-400 transition-all scale-active"
                    title="Reset synchronizacji"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              <button
                disabled={currentIndex >= parsedLines.length || !radio.isPlaying}
                onClick={handleSync}
                className={`
                  w-full py-6 rounded-xl font-bold uppercase tracking-widest text-lg transition-all
                  ${radio.isPlaying && currentIndex < parsedLines.length
                    ? 'bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-[1.01] active:scale-95'
                    : 'bg-slate-900 text-slate-600 grayscale cursor-not-allowed'}
                `}
              >
                [ ZAPISZ CZAS DLA WERSU ]
              </button>

              <div className="text-[9px] text-slate-500 text-center font-mono uppercase">
                WSKAZÓWKA: MOŻESZ UŻYWAĆ [ SPACJI ], ABY ŁAPAĆ CZAS SZYBCIEJ
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            PROGRES: <span className="text-emerald-400 font-bold">{currentIndex}</span> / {parsedLines.length}
          </div>
          <button 
            disabled={syncedLines.length === 0}
            onClick={downloadLRC}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all
              ${syncedLines.length > 0 
                ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-105 active:scale-95' 
                : 'bg-slate-900 text-slate-700 grayscale cursor-not-allowed'}
            `}
          >
            <Download size={14} />
            Pobierz Plik .LRC
          </button>
        </div>

      </div>
    </motion.div>
  );
}
