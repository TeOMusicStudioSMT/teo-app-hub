import React from 'react';

/**
 * 📖 StorytellerFrame.tsx
 * Brama do Kwantowego Bajki (Ink & Image).
 * Hostowana jako statyczny moduł w /public/storyteller/
 */
export const StorytellerFrame = () => {
  return (
    <div className="w-full h-[850px] border border-white/10 rounded-xl bg-black/50 overflow-hidden shadow-[0_0_30px_rgba(167,139,250,0.15)]">
      <iframe 
        src="/storyteller/index.html" 
        className="w-full h-full border-none"
        title="Quantum Storyteller"
      />
    </div>
  );
};
