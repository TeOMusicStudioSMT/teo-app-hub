import React, { useState, useMemo } from 'react';
import { Clock, ArrowRight, Sparkles, Image, ArrowUpDown, IdCard } from 'lucide-react';
import { type Creation } from './types';
import { type MissionCard } from '../services/gemini';

type SortOption = 'date-desc' | 'date-asc' | 'grv-desc' | 'grv-asc';

interface CreationHistoryProps {
  history: Creation[];
  onSelect: (creation: Creation) => void;
  selectedId?: string;
}

export const CreationHistory: React.FC<CreationHistoryProps> = ({ history, onSelect, selectedId }) => {
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return b.timestamp.getTime() - a.timestamp.getTime();
        case 'date-asc':
          return a.timestamp.getTime() - b.timestamp.getTime();
        case 'grv-desc':
          return (b.mission?.xp || 0) - (a.mission?.xp || 0);
        case 'grv-asc':
          return (a.mission?.xp || 0) - (b.mission?.xp || 0);
        default:
          return 0;
      }
    });
  }, [history, sortBy]);

  React.useEffect(() => {
    if (selectedId && itemRefs.current.has(selectedId)) {
      const element = itemRefs.current.get(selectedId);
      element?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [selectedId, sortBy]);

  const auraStats = useMemo(() => {
    const stats = { gold: 0, cyan: 0, violet: 0 };
    history.forEach(item => {
      const aura = item.mission?.aura;
      if (aura === 'gold' || aura === 'cyan' || aura === 'violet') {
        stats[aura]++;
      }
    });
    return stats;
  }, [history]);

  if (history.length === 0) return null;

  const auraColors = {
    gold: 'border-[#c9953a]/30 text-[#c9953a]',
    cyan: 'border-[#00e5ff]/30 text-[#00e5ff]',
    violet: 'border-[#a78bfa]/30 text-[#a78bfa]'
  };

  const maxAuraCount = Math.max(auraStats.gold, auraStats.cyan, auraStats.violet, 1);

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 relative z-10">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center space-x-3">
          <Clock className="w-4 h-4 text-zinc-600" />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600">Archiwum Kronik</h2>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <ArrowUpDown className="w-3 h-3 text-zinc-700" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-[9px] font-mono uppercase tracking-widest text-zinc-500 hover:text-zinc-300 outline-none cursor-pointer transition-colors"
            >
              <option value="date-desc">Najnowsze</option>
              <option value="date-asc">Najstarsze</option>
              <option value="grv-desc">Najwięcej GRV</option>
              <option value="grv-asc">Najmniej GRV</option>
            </select>
          </div>

          <div className="flex items-end space-x-1.5 h-6 px-4 border-l border-zinc-900 hidden sm:flex">
            {(['gold', 'cyan', 'violet'] as const).map((aura) => {
              const count = auraStats[aura];
              const height = (count / maxAuraCount) * 100;
              return (
                <div key={aura} className="flex flex-col items-center group/bar relative">
                  <div 
                    className={`w-2 rounded-t-[1px] transition-all duration-700 ease-out ${
                      aura === 'gold' ? 'bg-[#c9953a]' : aura === 'cyan' ? 'bg-[#00e5ff]' : 'bg-[#a78bfa]'
                    } ${count === 0 ? 'opacity-10' : 'opacity-80 group-hover/bar:opacity-100'}`}
                    style={{ height: `${Math.max(height, 15)}%` }}
                  ></div>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-[7px] font-mono text-zinc-300 pointer-events-none whitespace-nowrap z-50 shadow-2xl">
                    {count} {aura.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div 
        ref={scrollContainerRef}
        className="flex overflow-x-auto space-x-4 pb-4 px-2 scrollbar-hide"
      >
        {sortedHistory.map((item) => {
          const aura = item.mission?.aura || 'violet';
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el);
                else itemRefs.current.delete(item.id);
              }}
              onClick={() => onSelect(item)}
              className={`
                group flex-shrink-0 relative flex flex-col text-left w-56 h-32 
                ${isSelected ? 'bg-[#0c0e16] border-opacity-100 ring-1 ring-inset ring-white/10' : 'bg-[#0c0e16]/50 border-opacity-30'}
                hover:bg-[#0c0e16]/80 
                border ${auraColors[aura]} 
                rounded-xl transition-all duration-300 overflow-hidden
                hover:scale-[1.02] hover:shadow-2xl hover:shadow-black
                ${isSelected ? 'scale-[1.02] shadow-xl shadow-black' : ''}
              `}
            >
              <div className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-1.5 bg-black/50 rounded-lg border ${auraColors[aura]} transition-colors`}>
                      {item.originalImage ? (
                          <Image className="w-4 h-4" />
                      ) : (
                          <Sparkles className="w-4 h-4" />
                      )}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-600 group-hover:text-zinc-400 uppercase tracking-widest">
                    {item.timestamp.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                
                <div className="mt-auto">
                  <h3 className="text-sm font-bold text-zinc-200 group-hover:text-white truncate mb-1">
                    {item.mission?.title || item.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase tracking-widest ${auraColors[aura]}`}>
                        {item.mission?.xp || 0} GRV
                    </span>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Dossier</span>
                        <IdCard className="w-3 h-3 text-zinc-500" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Subtle Aura Glow */}
              <div className={`absolute -bottom-8 -right-8 w-16 h-16 rounded-full blur-2xl opacity-20 bg-current ${auraColors[aura]}`}></div>
            </button>
          );
        })}
      </div>
      <style children={`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `} />
    </div>
  );
};
