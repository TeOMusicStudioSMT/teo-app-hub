import React from 'react';

/**
 * 🛠️ MockupGenFrame.tsx
 * Brama do skompilowanej aplikacji Produkt-Generatora (otakosgen).
 * Hostowana jako statyczny moduł w /public/mockupgen/
 */
export const MockupGenFrame = () => {
  return (
    <div className="w-full h-[800px] border border-white/10 rounded-xl bg-black/50 overflow-hidden shadow-[0_0_30px_rgba(201,149,58,0.1)]">
      {/* Tarcza wskazuje teraz na podfolder skompilowanej aplikacji! */}
      <iframe 
        src="/mockupgen/index.html" 
        className="w-full h-full border-none"
        title="Mockup Generator"
      />
    </div>
  );
};
