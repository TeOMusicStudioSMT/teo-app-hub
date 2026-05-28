import React from 'react';

export const DziennikFrame: React.FC = () => {
  return (
    <div className="w-full h-[85vh] border border-cyan-500/30 rounded-2xl bg-slate-950/80 overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)] mt-4">
      <iframe 
        src="/Dziennik_Pokladowy_Autonomia.html" 
        className="w-full h-full border-none"
        title="Dziennik Pokładowy Katedry"
      />
    </div>
  );
};
