/**
 * 🧹 PamiecHelper — raport RAM + bezpieczne zwolnienie pamięci (przygotowanie na UE).
 * UE chce ~14 GB. Katedra pokazuje, co zżera RAM, i zamyka WSKAZANE procesy (Ty wybierasz).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const BRIDGE = 'http://127.0.0.1:3001';
const BROWSERS = /brave|chrome|msedge|firefox|opera/i;

interface Proc { Name: string; MB: number; }

export const PamiecHelper: React.FC = () => {
  const [mem, setMem] = useState<{ totalGB: number; freeGB: number; usedGB: number } | null>(null);
  const [procs, setProcs] = useState<Proc[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await (await fetch(`${BRIDGE}/api/system/memory`)).json();
      if (d.success) { setMem({ totalGB: d.totalGB, freeGB: d.freeGB, usedGB: d.usedGB }); setProcs(d.processes || []); }
    } catch { /* most offline */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (n: string) => setSel(s => ({ ...s, [n]: !s[n] }));
  const pickBrowsers = () => { const s: Record<string, boolean> = {}; procs.forEach(p => { if (BROWSERS.test(p.Name)) s[p.Name] = true; }); setSel(s); };

  const free = async () => {
    const names = Object.keys(sel).filter(n => sel[n]);
    if (!names.length) { toast('Zaznacz, co zamknąć.', { icon: '✋' }); return; }
    setBusy(true);
    try {
      const d = await (await fetch(`${BRIDGE}/api/system/free`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names }) })).json();
      if (d.success) { toast.success(`🧹 Zamknięto: ${d.closed.join(', ') || '(nic)'}.`); setSel({}); setTimeout(load, 800); }
      else toast.error(`⚠ ${d.message}`);
    } catch { toast.error('⚠ Most offline (:3001).'); }
    finally { setBusy(false); }
  };

  const freeGB = mem?.freeGB ?? 0;
  const okForUE = freeGB >= 14;

  return (
    <div className="rounded-lg border border-orange-900/50 bg-black/30 p-3 mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] text-orange-300/80 tracking-wider">🧹 PAMIĘĆ — przygotuj na UE (~14 GB)</div>
        <button onClick={load} className="text-[9px] text-orange-400/70 hover:text-orange-300" title="Odśwież">↻</button>
      </div>

      {mem ? (
        <>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-zinc-400">wolne: <b className={okForUE ? 'text-emerald-400' : 'text-orange-400'}>{freeGB} GB</b> / {mem.totalGB} GB</span>
            <span className={okForUE ? 'text-emerald-400' : 'text-orange-400'}>{okForUE ? '✅ wystarczy na UE' : '⚠ za mało na UE — zwolnij'}</span>
          </div>
          <div className="h-2 rounded-full bg-black/50 overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-orange-600 to-rose-500" style={{ width: `${Math.min(100, (mem.usedGB / mem.totalGB) * 100)}%` }} />
          </div>

          <div className="max-h-36 overflow-y-auto space-y-0.5 mb-2">
            {procs.map((p, i) => (
              <label key={p.Name + i} className="flex items-center justify-between gap-2 text-[10px] text-zinc-300 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5">
                <span className="flex items-center gap-1.5 truncate">
                  <input type="checkbox" checked={!!sel[p.Name]} onChange={() => toggle(p.Name)} className="accent-orange-500 w-3 h-3" />
                  {BROWSERS.test(p.Name) ? '🌐' : '▪'} {p.Name}
                </span>
                <span className="text-zinc-500 shrink-0">{p.MB} MB</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={pickBrowsers} className="text-[10px] px-2 py-1 rounded border border-orange-500/40 text-orange-300 hover:bg-orange-950/40">🌐 Zaznacz przeglądarki</button>
            <button onClick={free} disabled={busy} className="text-[10px] px-2 py-1 rounded border border-rose-500/50 bg-rose-950/30 text-rose-300 font-bold hover:bg-rose-900/50 disabled:opacity-50">
              {busy ? '⟳ …' : '🧹 Zwolnij zaznaczone'}
            </button>
          </div>
          <div className="text-[9px] text-zinc-600 mt-1.5 italic">⚠ Zapisz pracę w zamykanych appach! Krytyczne procesy systemowe są blokowane.</div>
        </>
      ) : (
        <div className="text-[10px] text-amber-400/80">⚠ Most offline (:3001) — uruchom wiesio-bridge.js, by zobaczyć pamięć.</div>
      )}
    </div>
  );
};

export default PamiecHelper;
