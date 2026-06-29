/**
 * 📚 KsiegarniaSkili — księgozbiór powtarzalnych czynów (skille agentów gamedev).
 *
 * Skille = SKILL.md zgodne z Claude Code (Kurka). Jadziunia-bibliotekarka dobiera je do zadania.
 * Księgozbiór rośnie (dodawaj do TeO_Skille/<półka>/<skill>/SKILL.md). Most: /api/skille/list, /pick.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const BRIDGE = 'http://127.0.0.1:3001';

interface Skill { id: string; desc: string; shelf: string; engine: string; difficulty: string; slug: string; }

const SHELF_ICON: Record<string, string> = {
  unreal: '🎮', unity: '🟦', godot: '🤖', 'web-engines': '🌐', 'other-engines': '🧩',
  disciplines: '🎓', genres: '🎲', workflows: '⚙️',
};

export const KsiegarniaSkili: React.FC = () => {
  const [skille, setSkille] = useState<Skill[]>([]);
  const [shelves, setShelves] = useState<Record<string, number>>({});
  const [openShelf, setOpenShelf] = useState<string | null>(null);
  const [task, setTask] = useState('');
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await (await fetch(`${BRIDGE}/api/skille/list`)).json();
        if (d.success) { setSkille(d.skille || []); setShelves(d.shelves || {}); }
      } catch { /* most offline */ }
    })();
  }, []);

  const askJadziunia = async () => {
    if (!task.trim()) { toast.error('Opisz zadanie dla Jadziuni.'); return; }
    setBusy(true); setPick('📚 Jadziunia przegląda regały…');
    try {
      const d = await (await fetch(`${BRIDGE}/api/skille/pick`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      })).json();
      if (!d.success) throw new Error(d.message || 'Jadziunia milczy');
      setPick(d.pick);
    } catch (e: any) { setPick(`⚠ ${e.message} — uruchom most + Ollamę.`); }
    finally { setBusy(false); }
  };

  if (!skille.length) return null;

  return (
    <div className="rounded-lg border border-rose-900/50 bg-black/30 p-3 my-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] text-rose-300/80 tracking-wider">📚 KSIĘGARNIA SKILI — powtarzalne czyny dla agentów</div>
        <div className="text-[9px] text-zinc-500">{skille.length} skili</div>
      </div>

      {/* Półki (silniki/dyscypliny) */}
      <div className="flex flex-wrap gap-1 mb-2">
        {Object.entries(shelves).sort((a, b) => b[1] - a[1]).map(([shelf, n]) => (
          <button key={shelf} onClick={() => setOpenShelf(openShelf === shelf ? null : shelf)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${openShelf === shelf
              ? 'border-rose-400 bg-rose-950/50 text-rose-200' : 'border-zinc-700 text-zinc-400 hover:border-rose-700'}`}>
            {SHELF_ICON[shelf] || '📘'} {shelf} ({n})
          </button>
        ))}
      </div>

      {/* Skille z otwartej półki */}
      {openShelf && (
        <div className="space-y-1 mb-2 max-h-44 overflow-auto pr-1">
          {skille.filter(s => s.shelf === openShelf).map(s => (
            <div key={s.slug} className="rounded border border-zinc-800/70 bg-black/30 p-1.5">
              <div className="text-[10px] font-bold text-rose-200">{s.id} {s.difficulty && <span className="text-[8px] text-zinc-500">· {s.difficulty}</span>}</div>
              <div className="text-[9px] text-zinc-400 leading-snug">{s.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Jadziunia dobiera */}
      <div className="flex gap-1.5">
        <input value={task} onChange={e => setTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') askJadziunia(); }}
          placeholder="Opisz zadanie — Jadziunia dobierze skille (np. teleport bota z efektem cząsteczek)…"
          className="flex-1 bg-black/40 border border-rose-500/20 rounded px-2 py-1.5 text-[11px] text-rose-100 outline-none focus:border-rose-500" />
        <button onClick={askJadziunia} disabled={busy}
          className="px-3 py-1.5 rounded border border-rose-500/50 bg-rose-950/30 text-rose-300 text-[11px] font-bold hover:bg-rose-900/50 disabled:opacity-50">
          {busy ? '⟳…' : '📚 Jadziunia, dobierz'}
        </button>
      </div>
      {pick && <div className="text-[11px] text-rose-100/85 bg-black/40 border border-rose-900/50 rounded p-2 mt-1.5 whitespace-pre-wrap max-h-52 overflow-auto">{pick}</div>}
      <div className="text-[8px] text-zinc-600 mt-1">Księgozbiór rośnie: dodawaj <code className="text-rose-400">TeO_Skille/&lt;półka&gt;/&lt;skill&gt;/SKILL.md</code>. Skille zgodne z Claude Code (Kurka).</div>
    </div>
  );
};

export default KsiegarniaSkili;
