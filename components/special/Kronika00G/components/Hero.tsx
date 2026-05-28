import React from 'react';
import { Sparkles } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-12 duration-1000 relative z-10">
      <div className="flex flex-col items-center">
        <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white leading-none mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
          Dziennik Pokładowy
        </h1>
        <div className="flex items-center space-x-4">
          <div className="h-px w-12 bg-zinc-800"></div>
          <p className="text-zinc-500 text-[10px] md:text-xs font-mono uppercase tracking-[0.5em]">
            Rada Kwantowego Kolektywu - Wpis 0.00G
          </p>
          <div className="h-px w-12 bg-zinc-800"></div>
        </div>
      </div>
    </div>
  );
};
