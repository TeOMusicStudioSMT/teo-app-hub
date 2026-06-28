/**
 * 🎬 RezyserView — kompozytor „gra = Film = opowieść" (Reżyser, Etap I).
 *
 * Użytkownik składa film ze SCEN i UJĘĆ, wybiera środowiska i wtyczki (mody),
 * eksportuje JEDEN manifest (`POST /api/forge/story`) → wrzuca do UE
 * (Narzędzia → Wykonaj skrypt → `story_compiler.py`) → generuje się hybryda FILM→GRA.
 *
 * Panel wewnątrz TeoArcadeForge. Styl fuksja/cyan, font-mono. Autosave do localStorage.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  StoryManifest, ShotKind, Environment, ENVIRONMENTS,
  emptyStory, addScene, addShot, totalDurationS, validateStory, STORY_SCHEMA_VERSION,
} from '../../lib/storyManifest';

const BRIDGE = 'http://127.0.0.1:3001';
const LS_KEY = 'otakos_story';
const KINDS: { id: ShotKind; label: string }[] = [
  { id: 'establishing', label: 'szeroki' },
  { id: 'dialog', label: 'portret' },
  { id: 'akcja', label: 'akcja' },
];

function load(): StoryManifest {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* brak/uszkodzony — nowy */ }
  return emptyStory('Mój film 0.00G');
}

export const RezyserView: React.FC = () => {
  const [story, setStory] = useState<StoryManifest>(load);
  const [plugins, setPlugins] = useState<{ id: string; desc: string }[]>([]);
  const [busy, setBusy] = useState(false);
  // Generator modów (Etap II).
  const [modPrompt, setModPrompt] = useState('');
  const [modName, setModName] = useState('');
  const [modBusy, setModBusy] = useState(false);
  // Wystawianie modu w Marketplace (Etap II b).
  const [pubId, setPubId] = useState('');
  const [pubPrice, setPubPrice] = useState('100');
  const [pubBusy, setPubBusy] = useState(false);

  // Autosave + odśwież version znacznik.
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(story)); } catch { /* full */ } }, [story]);

  // Lista dostępnych wtyczek (modów) z mostu.
  const loadPlugins = async () => {
    try { const d = await (await fetch(`${BRIDGE}/api/forge/plugins`)).json(); setPlugins(d?.plugins || []); }
    catch { /* most offline — bez modów */ }
  };
  useEffect(() => { loadPlugins(); }, []);

  const generateMod = async () => {
    if (!modPrompt.trim()) { toast.error('Opisz mod, który ma powstać.'); return; }
    setModBusy(true);
    try {
      const d = await (await fetch(`${BRIDGE}/api/forge/plugin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: modPrompt, name: modName }),
      })).json();
      if (!d.success) throw new Error(d.message || 'Generacja nieudana');
      toast.success(`🔌 Mod „${d.id}" gotowy (mózg: ${d.model}). Dodaj go do sceny.`, { duration: 5000 });
      setModPrompt(''); setModName('');
      await loadPlugins();
    } catch (e: any) { toast.error(`⚠ ${e.message} — uruchom most + Ollamę.`); }
    finally { setModBusy(false); }
  };

  const publishMod = async () => {
    const id = pubId || plugins[0]?.id;
    if (!id) { toast.error('Brak modu do wystawienia — najpierw stwórz mod.'); return; }
    setPubBusy(true);
    try {
      const d = await (await fetch(`${BRIDGE}/api/forge/mod/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priceGrv: Math.max(0, +pubPrice || 0) }),
      })).json();
      if (!d.success) throw new Error(d.message || 'Publikacja nieudana');
      toast.success(`🏷️ Mod „${id}" wystawiony w Marketplace za ${d.product.priceGrv} GRV.`, { duration: 5000 });
    } catch (e: any) { toast.error(`⚠ ${e.message} — uruchom most (:3001).`); }
    finally { setPubBusy(false); }
  };

  const setScene = (sceneId: string, patch: Partial<StoryManifest['scenes'][0]>) =>
    setStory(s => ({ ...s, scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, ...patch } : sc) }));

  const removeScene = (sceneId: string) =>
    setStory(s => s.scenes.length <= 1 ? s : ({ ...s, scenes: s.scenes.filter(sc => sc.id !== sceneId) }));

  const moveScene = (idx: number, dir: -1 | 1) =>
    setStory(s => {
      const j = idx + dir;
      if (j < 0 || j >= s.scenes.length) return s;
      const arr = [...s.scenes];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...s, scenes: arr };
    });

  const togglePlugin = (sceneId: string, pid: string) =>
    setStory(s => ({
      ...s, scenes: s.scenes.map(sc => {
        if (sc.id !== sceneId) return sc;
        const has = (sc.plugins || []).some(p => p.id === pid);
        return { ...sc, plugins: has ? (sc.plugins || []).filter(p => p.id !== pid) : [...(sc.plugins || []), { id: pid }] };
      }),
    }));

  const setShot = (sceneId: string, shotId: string, patch: Partial<StoryManifest['scenes'][0]['shots'][0]>) =>
    setScene(sceneId, { shots: story.scenes.find(s => s.id === sceneId)!.shots.map(sh => sh.id === shotId ? { ...sh, ...patch } : sh) });

  const removeShot = (sceneId: string, shotId: string) => {
    const sc = story.scenes.find(s => s.id === sceneId)!;
    if (sc.shots.length <= 1) return;
    setScene(sceneId, { shots: sc.shots.filter(sh => sh.id !== shotId) });
  };

  const exportFilm = async () => {
    const errs = validateStory(story);
    if (errs.length) { toast.error(`⚠ ${errs[0]}`); return; }
    setBusy(true);
    const payload = { ...story, meta: { ...story.meta, version: STORY_SCHEMA_VERSION } };
    try {
      const d = await (await fetch(`${BRIDGE}/api/forge/story`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: payload }),
      })).json();
      if (!d.success) throw new Error(d.message || 'Eksport nieudany');
      toast.success(`🎬 Film zapisany (${d.scenes} scen). W UE: Wykonaj skrypt → story_compiler.py`, { duration: 6000 });
    } catch (e: any) { toast.error(`⚠ ${e.message} — uruchom most (:3001).`); }
    finally { setBusy(false); }
  };

  const mins = Math.floor(totalDurationS(story) / 60), secs = Math.round(totalDurationS(story) % 60);

  return (
    <div className="rounded-lg border border-amber-900/50 bg-black/30 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-amber-300/80 tracking-wider">🎬 REŻYSER — złóż film=grę ze scen i ujęć</div>
        <div className="text-[9px] text-zinc-500">{story.scenes.length} scen · ~{mins}:{String(secs).padStart(2, '0')} min</div>
      </div>

      {/* Tytuł filmu */}
      <input value={story.meta.title}
        onChange={e => setStory(s => ({ ...s, meta: { ...s.meta, title: e.target.value } }))}
        placeholder="Tytuł filmu…"
        className="w-full bg-black/40 border border-amber-500/20 rounded px-2.5 py-1.5 text-[12px] text-amber-100 outline-none focus:border-amber-500 mb-1.5" />

      {/* 🌍 Prompt Startowy Świata — modyfikatory przed wykuciem */}
      <input value={story.meta.worldPrompt || ''}
        onChange={e => setStory(s => ({ ...s, meta: { ...s.meta, worldPrompt: e.target.value } }))}
        placeholder="🌍 Prompt Startowy Świata (np. piasek na czarny bazalt, neony Rose Gold)…"
        className="w-full bg-black/30 border border-emerald-700/30 rounded px-2.5 py-1.5 text-[11px] text-emerald-100/90 outline-none focus:border-emerald-500 mb-2" />

      {/* Sceny */}
      <div className="space-y-2.5">
        {story.scenes.map((sc, i) => (
          <div key={sc.id} className="rounded-lg border border-amber-900/40 bg-black/40 p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-amber-500/60">#{i + 1}</span>
              <input value={sc.name} onChange={e => setScene(sc.id, { name: e.target.value })}
                className="flex-1 bg-transparent border-b border-amber-900/40 text-[12px] text-amber-200 outline-none focus:border-amber-500" />
              <button onClick={() => moveScene(i, -1)} disabled={i === 0} title="w górę"
                className="text-[10px] text-amber-400/60 hover:text-amber-300 disabled:opacity-20">▲</button>
              <button onClick={() => moveScene(i, 1)} disabled={i === story.scenes.length - 1} title="w dół"
                className="text-[10px] text-amber-400/60 hover:text-amber-300 disabled:opacity-20">▼</button>
              <button onClick={() => removeScene(sc.id)} disabled={story.scenes.length <= 1}
                className="text-[10px] text-rose-400/70 hover:text-rose-300 disabled:opacity-30">✕</button>
            </div>

            {/* Środowisko */}
            <div className="flex flex-wrap gap-1 mb-1.5">
              {ENVIRONMENTS.map(env => (
                <button key={env.id} onClick={() => setScene(sc.id, { environment: env.id as Environment })}
                  title={env.desc}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${sc.environment === env.id
                    ? 'border-amber-400 bg-amber-950/50 text-amber-200'
                    : 'border-zinc-700 text-zinc-400 hover:border-amber-700'}`}>
                  {env.icon} {env.name}
                </button>
              ))}
            </div>

            {/* Wtyczki (mody) */}
            {plugins.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                <span className="text-[9px] text-violet-400/60 self-center">mody:</span>
                {plugins.map(p => {
                  const on = (sc.plugins || []).some(x => x.id === p.id);
                  return (
                    <button key={p.id} onClick={() => togglePlugin(sc.id, p.id)} title={p.desc}
                      className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${on
                        ? 'border-violet-400 bg-violet-950/50 text-violet-200'
                        : 'border-zinc-700 text-zinc-500 hover:border-violet-700'}`}>
                      🔌 {p.id}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ujęcia */}
            <div className="space-y-1">
              {sc.shots.map((sh, j) => (
                <div key={sh.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-cyan-500/60 w-6">{j + 1}.</span>
                  <select value={sh.kind} onChange={e => setShot(sc.id, sh.id, { kind: e.target.value as ShotKind })}
                    className="bg-black/50 border border-cyan-900/50 rounded px-1 py-0.5 text-cyan-200 outline-none">
                    {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                  <input type="number" min={1} max={60} value={sh.durationS}
                    onChange={e => setShot(sc.id, sh.id, { durationS: Math.max(1, +e.target.value || 1) })}
                    className="w-12 bg-black/50 border border-cyan-900/50 rounded px-1 py-0.5 text-cyan-200 outline-none" />
                  <span className="text-zinc-600">s</span>
                  <input value={sh.caption || ''} onChange={e => setShot(sc.id, sh.id, { caption: e.target.value })}
                    placeholder="podpis na ekranie…"
                    className="flex-1 bg-black/40 border border-cyan-900/40 rounded px-1.5 py-0.5 text-cyan-100/90 outline-none focus:border-cyan-600" />
                  <button onClick={() => removeShot(sc.id, sh.id)} disabled={sc.shots.length <= 1}
                    className="text-rose-400/60 hover:text-rose-300 disabled:opacity-30">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setStory(s => addShot(s, sc.id))}
              className="text-[10px] mt-1.5 px-2 py-0.5 rounded border border-cyan-700/50 text-cyan-300 hover:bg-cyan-950/40">+ ujęcie</button>
          </div>
        ))}
      </div>

      {/* Akcje */}
      <div className="flex flex-wrap gap-2 mt-2.5">
        <button onClick={() => setStory(s => addScene(s))}
          className="px-3 py-1.5 rounded-lg border border-amber-700/50 text-amber-300 text-[11px] hover:bg-amber-950/40">+ scena</button>
        <button onClick={exportFilm} disabled={busy}
          className="px-4 py-1.5 rounded-lg border border-amber-500/50 bg-amber-950/40 text-amber-200 text-[11px] font-bold hover:bg-amber-900/50 disabled:opacity-50">
          {busy ? '⟳ zapis…' : '🎬 Eksportuj film'}
        </button>
        <button onClick={() => { if (confirm('Wyczyścić film i zacząć od nowa?')) setStory(emptyStory('Mój film 0.00G')); }}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[11px] hover:bg-zinc-900/40">↺ nowy</button>
      </div>
      {/* 🔌 Generator modów (Etap II) — Ollama pisze wtyczkę wg kontraktu */}
      <div className="rounded-lg border border-violet-900/50 bg-black/20 p-2.5 mt-3">
        <div className="text-[10px] text-violet-300/80 tracking-wider mb-1.5">🔌 STWÓRZ MOD (Agent pisze wtyczkę do generatora)</div>
        <div className="flex gap-1.5 mb-1.5">
          <input value={modName} onChange={e => setModName(e.target.value)} placeholder="nazwa moda (np. mgla_swietlik)"
            className="w-44 bg-black/40 border border-violet-500/20 rounded px-2 py-1 text-[10px] text-violet-100 outline-none focus:border-violet-500" />
          <button onClick={generateMod} disabled={modBusy}
            className="flex-1 px-3 py-1 rounded border border-violet-500/50 bg-violet-950/30 text-violet-300 text-[10px] font-bold hover:bg-violet-900/50 disabled:opacity-50">
            {modBusy ? '⟳ mózg pisze mod…' : '🔌 Wygeneruj mod'}
          </button>
        </div>
        <textarea value={modPrompt} onChange={e => setModPrompt(e.target.value)} rows={2}
          placeholder="Opisz mod: co ma dodać do sceny? Np. rój świetlików: 20 małych żółtych świateł lewitujących losowo nad sceną."
          className="w-full bg-black/40 border border-violet-500/20 rounded px-2 py-1.5 text-[10px] text-violet-100 outline-none focus:border-violet-500 resize-y" />
        <div className="text-[8px] text-zinc-600 mt-1">Mod ląduje w <code className="text-violet-400">forge_plugins/</code> i pojawia się wyżej jako 🔌 do wpięcia w scenę.</div>

        {/* 🏷️ Wystaw mod w Marketplace za GRV */}
        {plugins.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-violet-900/40">
            <span className="text-[9px] text-amber-400/70">🏷️ wystaw:</span>
            <select value={pubId || plugins[0]?.id} onChange={e => setPubId(e.target.value)}
              className="bg-black/50 border border-amber-900/50 rounded px-1 py-0.5 text-[10px] text-amber-200 outline-none max-w-[40%]">
              {plugins.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
            </select>
            <input type="number" min={0} value={pubPrice} onChange={e => setPubPrice(e.target.value)} title="cena GRV"
              className="w-16 bg-black/50 border border-amber-900/50 rounded px-1 py-0.5 text-[10px] text-amber-200 outline-none" />
            <span className="text-[9px] text-zinc-600">GRV</span>
            <button onClick={publishMod} disabled={pubBusy}
              className="px-2.5 py-0.5 rounded border border-amber-500/50 bg-amber-950/30 text-amber-300 text-[10px] font-bold hover:bg-amber-900/50 disabled:opacity-50">
              {pubBusy ? '⟳…' : 'do Marketplace'}
            </button>
          </div>
        )}
      </div>

      <div className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
        Po eksporcie w UE: <b>Narzędzia → Wykonaj skrypt Pythona → story_compiler.py</b> (bierze najnowszy film).
        Powstaje grywalny poziom + film (Cine_Story, auto_play). Mody dorzucasz w <code className="text-violet-400">forge_plugins/</code>.
      </div>
    </div>
  );
};

export default RezyserView;
