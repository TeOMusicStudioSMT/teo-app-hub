/**
 * 🚜 OtakosRobotics — Garaż Robotyczny Suwerena (Filar II, 0.00G).
 *
 * „Zawsze coś na start": darmowy Agro Traktorek. Wyślij go na pole — zbiera dane
 * agro/energię lokalnie (symulacja 0.00G), reszta floty odblokowuje się później.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface Bot {
  id: string; icon: string; name: string; role: string; locked?: boolean;
}

const FLEET: Bot[] = [
  { id: 'agro', icon: '🚜', name: 'Agro Traktorek', role: 'Zbiór danych agro + energii (starter)' },
  { id: 'dron', icon: '🛸', name: 'Dron Siewca', role: 'Mapowanie pól z lotu', locked: true },
  { id: 'kombajn', icon: '⚙️', name: 'Kombajn Kwantowy', role: 'Żniwa wektorów na skalę', locked: true },
  { id: 'pszczola', icon: '🐝', name: 'Pszczoła-Bot', role: 'Mikro-zapylanie sieci', locked: true },
];

const HARVEST_KEY = 'otakos_agro_harvest';

export const OtakosRobotics: React.FC = () => {
  const [harvest, setHarvest] = useState<number>(() => { try { return Number(localStorage.getItem(HARVEST_KEY) || 0); } catch { return 0; } });
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const sendToField = () => {
    if (working) return;
    setWorking(true); setProgress(0);
    setLog(l => ['🚜 Traktorek wyjeżdża w pole 0.00G…', ...l].slice(0, 6));
    timer.current = window.setInterval(() => {
      setProgress(p => {
        const np = p + 100 / 24; // ~3s
        if (np >= 100) {
          if (timer.current) window.clearInterval(timer.current);
          const gained = 12 + Math.floor(Math.random() * 40);
          setHarvest(h => { const nh = h + gained; try { localStorage.setItem(HARVEST_KEY, String(nh)); } catch { /* noop */ } return nh; });
          setWorking(false);
          setLog(l => [`🌾 Zebrano ${gained} jednostek danych sonicznych/agro.`, ...l].slice(0, 6));
          toast.success(`🌾 +${gained} jednostek do zbioru!`, { icon: '🚜' });
          return 0;
        }
        return np;
      });
    }, 125);
  };

  return (
    <div className="rounded-2xl border border-lime-500/25 bg-[#06090a]/70 p-5 font-mono">
      <div className="mb-4">
        <div className="text-[10px] tracking-[0.3em] text-lime-500/60">∴ FILAR II — TWÓRCZY ∴</div>
        <h3 className="text-lg font-bold text-lime-300">🚜 OtakOS Robotics — Garaż Suwerena</h3>
        <p className="text-[11px] text-zinc-400">Zawsze coś na start: darmowy Agro Traktorek. Wyślij go w pole — zbiera dane na 2. etap (0.00G, lokalnie).</p>
      </div>

      {/* Licznik zbioru */}
      <div className="flex items-center justify-between rounded-xl border border-lime-900/50 bg-black/30 px-4 py-3 mb-4">
        <span className="text-[11px] text-zinc-400">🌾 Zbiór łączny</span>
        <span className="text-xl font-bold text-lime-300">{harvest.toLocaleString('pl-PL')} <span className="text-xs text-zinc-500">jednostek</span></span>
      </div>

      {/* Agro Traktorek — sterowanie */}
      <div className="rounded-xl border border-lime-500/30 bg-lime-950/10 p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <motion.span animate={working ? { x: [0, 6, 0] } : {}} transition={{ repeat: Infinity, duration: 0.6 }} style={{ fontSize: 30 }}>🚜</motion.span>
          <div>
            <div className="text-sm font-bold text-lime-200">Agro Traktorek <span className="text-[9px] text-lime-500/70">· starter 0.00G</span></div>
            <div className="text-[10px] text-zinc-400">{working ? 'W polu — pracuje…' : 'Zaparkowany w garażu.'}</div>
          </div>
        </div>

        {/* Pasek pracy */}
        <div className="h-2 rounded-full bg-black/50 overflow-hidden mb-3">
          <motion.div className="h-full bg-gradient-to-r from-lime-500 to-emerald-400" animate={{ width: `${progress}%` }} transition={{ ease: 'linear' }} />
        </div>

        <button onClick={sendToField} disabled={working}
          className="w-full py-2.5 rounded-lg border border-lime-500/50 bg-lime-950/40 text-lime-300 text-sm font-bold hover:bg-lime-900/50 disabled:opacity-50 transition-colors">
          {working ? '⏳ W polu…' : '🌾 Wyślij na pole'}
        </button>
      </div>

      {/* Reszta floty (wkrótce) */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {FLEET.filter(b => b.locked).map(b => (
          <div key={b.id} title={b.role} className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-white/10 bg-black/30 opacity-60">
            <span style={{ fontSize: 20 }}>{b.icon}</span>
            <span className="text-[10px] font-bold text-slate-400">{b.name}</span>
            <span className="text-[8px] text-zinc-600">🔒 wkrótce</span>
          </div>
        ))}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-lg border border-zinc-800/70 bg-black/30 p-2.5 space-y-1">
          {log.map((l, i) => <div key={i} className="text-[11px] text-zinc-400">{l}</div>)}
        </div>
      )}
    </div>
  );
};

export default OtakosRobotics;
