/**
 * 🔀 LiveModelSwitcher — przełączanie Live modeli wg ZADANIA (+ tryb AUTO).
 * Dobiera mózg do pracy: Design/Ciężkie/Kod/Szybkie/Rozmowa. Czyta modele z Ollamy.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  TASK_MODES, pickModelForTask, getActiveModel, setActiveModel, isAuto, setAuto,
} from '../../lib/modelRouter';

const BRIDGE = 'http://127.0.0.1:3001';

export const LiveModelSwitcher: React.FC = () => {
  const [models, setModels] = useState<string[]>([]);
  const [active, setActive] = useState<string>(() => getActiveModel());
  const [mode, setMode] = useState<string>('design');
  const [auto, setAutoState] = useState<boolean>(() => isAuto());
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await (await fetch(`${BRIDGE}/api/ollama/models`)).json();
        const list: string[] = (d?.models || d?.tags || []).map((m: any) => m.name || m.model || m).filter(Boolean);
        if (list.length) setModels(list); else setOffline(true);
      } catch { setOffline(true); }
    })();
    const onChange = (e: any) => setActive(e.detail || getActiveModel());
    window.addEventListener('otakos-model-changed', onChange);
    return () => window.removeEventListener('otakos-model-changed', onChange);
  }, []);

  const apply = (m: string) => { setActiveModel(m); setActive(m); toast.success(`🔀 Mózg: ${m}`); };

  const pickMode = (id: string) => {
    setMode(id);
    const m = pickModelForTask(id, models.length ? models : [active]);
    if (m && (auto || true)) apply(m); // klik trybu zawsze dobiera model
  };

  const toggleAuto = () => { const v = !auto; setAuto(v); setAutoState(v); toast(v ? '🔀 AUTO ON — mózg podąża za zadaniem' : 'AUTO OFF — wybierasz ręcznie', { icon: v ? '🤖' : '✋' }); };

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/10 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-violet-300/80 tracking-wider">🔀 LIVE MODEL — mózg wg zadania</div>
        <button onClick={toggleAuto}
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors ${auto ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30' : 'border-zinc-700 text-zinc-500'}`}>
          {auto ? '🤖 AUTO' : '✋ RĘCZNIE'}
        </button>
      </div>

      {/* Tryby zadań */}
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {TASK_MODES.map(m => {
          const on = mode === m.id;
          const target = pickModelForTask(m.id, models.length ? models : [active]);
          return (
            <button key={m.id} onClick={() => pickMode(m.id)} title={`${m.desc}${target ? ` → ${target}` : ''}`}
              className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-colors"
              style={{ borderColor: on ? '#a855f7' : 'rgba(255,255,255,.08)', background: on ? 'rgba(168,85,247,.15)' : 'rgba(0,0,0,.3)' }}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span className="text-[8px] font-bold" style={{ color: on ? '#c4b5fd' : '#94a3b8' }}>{m.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Aktywny model + ręczny wybór */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 shrink-0">aktywny:</span>
        {models.length > 0 ? (
          <select value={active} onChange={e => apply(e.target.value)}
            className="flex-1 bg-black/40 border border-violet-500/20 rounded px-2 py-1 text-[11px] text-violet-200 outline-none focus:border-violet-500 cursor-pointer">
            {!models.includes(active) && <option value={active}>{active}</option>}
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <span className="text-[11px] text-amber-400/80 flex-1">{offline ? '⚠ Most/Ollama offline — pokazuję bieżący' : 'ładuję…'}: <b>{active}</b></span>
        )}
      </div>
    </div>
  );
};

export default LiveModelSwitcher;
