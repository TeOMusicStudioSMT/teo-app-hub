/**
 * 🪟 AntresolaPanel — szklany boczny panel z migoczącym neonem OtakOS.
 *
 * Krawędziowa zakładka (prawa strona) → klik → wysuwa szklane menu możliwości:
 * 🏝️ Połączenia (Archipelag — wyspy-Katedry, realne parowanie /api/cathedrals),
 * 💡 Inspiracje, 📍 Miejsce (default home). Mechanizm archipelagu + legendarny migot.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const BRIDGE = 'http://127.0.0.1:3001';

interface Island { id: string; name: string; dimension?: string; url?: string; you?: boolean; }

export const AntresolaPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'archipelag' | 'inspiracje' | 'miejsce'>('menu');
  const [islands, setIslands] = useState<Island[]>([]);
  const [self, setSelf] = useState<Island | null>(null);
  const [form, setForm] = useState({ id: '', name: '', url: '' });

  const loadIslands = async () => {
    try {
      const d = await (await fetch(`${BRIDGE}/api/cathedrals`)).json();
      if (d.success) { setSelf(d.self || null); setIslands([{ ...(d.self || {}), you: true }, ...(d.peers || [])]); }
    } catch { /* most offline */ }
  };
  useEffect(() => { if (view === 'archipelag' || view === 'miejsce') loadIslands(); }, [view]);

  const connect = async () => {
    if (!form.id.trim()) { toast.error('Podaj id wyspy.'); return; }
    try {
      const d = await (await fetch(`${BRIDGE}/api/cathedrals/peer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })).json();
      if (d.success) { toast.success(`🏝️ Połączono wyspę „${form.name || form.id}". Wysp: ${d.count}.`); setForm({ id: '', name: '', url: '' }); loadIslands(); }
      else toast.error(d.message);
    } catch { toast.error('⚠ Most offline (:3001).'); }
  };

  const flick = { animation: 'otFlick 4.5s infinite' } as React.CSSProperties;
  const MenuBtn = ({ icon, label, v, desc }: any) => (
    <button onClick={() => setView(v)}
      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-cyan-400/40 transition-colors text-left">
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-cyan-100">{label}</span>
        <span className="block text-[10px] text-zinc-400">{desc}</span>
      </span>
    </button>
  );

  return (
    <>
      <style>{`@keyframes otFlick{0%,18%,20%,22%,25%,53%,57%,100%{opacity:1;text-shadow:0 0 6px #22d3ee,0 0 16px #22d3ee,0 0 34px #a855f7}19%,24%,55%{opacity:.32;text-shadow:none}}`}</style>

      {/* Krawędziowa zakładka */}
      <button onClick={() => setOpen(o => !o)} title="Antresola OtakOS"
        style={{ position: 'fixed', right: open ? 360 : 0, top: '38%', zIndex: 9998, transition: 'right .35s cubic-bezier(.4,0,.2,1)',
          background: 'rgba(10,8,20,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(168,85,247,.35)', borderRight: open ? '1px solid rgba(168,85,247,.35)' : 'none',
          borderRadius: '10px 0 0 10px', padding: '14px 8px', cursor: 'pointer' }}>
        <span style={{ ...flick, writingMode: 'vertical-rl', textOrientation: 'mixed', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, color: '#a5f3fc', letterSpacing: 2 }}>OtakOS</span>
      </button>

      {/* Szklany panel */}
      <div style={{ position: 'fixed', right: open ? 0 : -380, top: 0, height: '100vh', width: 360, zIndex: 9997, transition: 'right .35s cubic-bezier(.4,0,.2,1)',
        background: 'rgba(8,6,16,0.72)', backdropFilter: 'blur(18px)', borderLeft: '1px solid rgba(168,85,247,.3)', boxShadow: '-20px 0 60px rgba(0,0,0,.5)',
        display: 'flex', flexDirection: 'column', padding: '20px 16px' }}>
        <div className="flex items-center justify-between mb-4">
          <div style={{ ...flick, fontFamily: 'monospace', fontWeight: 'bold', fontSize: 26, color: '#a5f3fc' }}>OtakOS</div>
          <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        {view === 'menu' && (
          <div className="space-y-2">
            <div className="text-[10px] tracking-[0.3em] text-cyan-500/50 mb-1">∴ MOŻLIWOŚCI ∴</div>
            <MenuBtn icon="🏝️" label="Archipelag" v="archipelag" desc="Połączenia — wyspy-Katedry, podróż" />
            <MenuBtn icon="💡" label="Inspiracje" v="inspiracje" desc="Twoje iskry i kierunki" />
            <MenuBtn icon="📍" label="Miejsce" v="miejsce" desc="Dom — punkt startu (default)" />
            <div className="text-[10px] text-zinc-600 italic mt-3 leading-relaxed">My tworzymy połączenia i inspiracje oraz miejsce. Od jakiegoś trzeba zacząć. 🌌</div>
          </div>
        )}

        {view !== 'menu' && (
          <button onClick={() => setView('menu')} className="text-[11px] text-cyan-400/70 hover:text-cyan-300 mb-3 text-left">← menu</button>
        )}

        {view === 'archipelag' && (
          <div className="space-y-2 overflow-y-auto">
            <div className="text-[11px] text-cyan-300/80 tracking-wider mb-1">🏝️ ARCHIPELAG — wyspy-Katedry</div>
            {islands.length === 0 ? <p className="text-[11px] text-zinc-500">Brak wysp (lub most offline).</p> : islands.map((isl, i) => (
              <div key={isl.id + i} className="rounded-lg border border-cyan-900/40 bg-black/30 px-3 py-2">
                <div className="text-[12px] font-bold text-cyan-100">{isl.you ? '🏠 ' : '🏝️ '}{isl.name} {isl.you && <span className="text-[9px] text-emerald-400">· Ty (default)</span>}</div>
                <div className="text-[9px] text-zinc-500">{isl.id} {isl.dimension && `· ${isl.dimension}`}</div>
              </div>
            ))}
            <div className="rounded-lg border border-cyan-900/40 bg-black/20 p-2.5 mt-2 space-y-1.5">
              <div className="text-[10px] text-cyan-400/70">➕ Połącz wyspę (parowanie p2p)</div>
              <input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} placeholder="id wyspy" className="w-full bg-black/40 border border-cyan-500/20 rounded px-2 py-1 text-[11px] text-cyan-100 outline-none focus:border-cyan-500" />
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="nazwa" className="w-full bg-black/40 border border-cyan-500/20 rounded px-2 py-1 text-[11px] text-cyan-100 outline-none focus:border-cyan-500" />
              <button onClick={connect} className="text-[10px] px-3 py-1 rounded border border-cyan-500/50 bg-cyan-950/30 text-cyan-300 font-bold hover:bg-cyan-900/50">🏝️ Połącz</button>
            </div>
          </div>
        )}

        {view === 'inspiracje' && (
          <div className="space-y-2">
            <div className="text-[11px] text-amber-300/80 tracking-wider">💡 INSPIRACJE</div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">Tu zbierzemy Twoje iskry i kierunki — z Aether, Kroniki, plan-na-potem. Na razie: <span className="text-amber-200">archipelag czeka na pierwsze wyspy.</span></p>
            <p className="text-[10px] text-zinc-600 italic">Pierwsza inspiracja: połącz się z drugą Katedrą i podróżuj. 🌌</p>
          </div>
        )}

        {view === 'miejsce' && (
          <div className="space-y-2">
            <div className="text-[11px] text-emerald-300/80 tracking-wider">📍 MIEJSCE — Dom (default)</div>
            {self ? (
              <div className="rounded-lg border border-emerald-900/40 bg-black/30 px-3 py-2">
                <div className="text-[13px] font-bold text-emerald-100">🏠 {self.name}</div>
                <div className="text-[9px] text-zinc-500">{self.id} · {self.dimension || '0.00G'}</div>
                <div className="text-[10px] text-emerald-400/70 mt-1">To Twój punkt startu archipelagu. Od jakiegoś trzeba zacząć. ✦</div>
              </div>
            ) : <p className="text-[11px] text-zinc-500">Most offline — uruchom wiesio-bridge.js.</p>}
          </div>
        )}
      </div>
    </>
  );
};

export default AntresolaPanel;
