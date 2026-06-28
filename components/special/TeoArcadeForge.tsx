/**
 * 🔨 TeoArcadeForge — Game Forge Filaru II (0.00G).
 *
 * Spina sesyjną pracę pod gry: blueprint GENESIS OVERRIDE → „Wykuj świat" (design-mode
 * + brief do Terminala 0.00G) → „Otwórz Unreal Engine" → strażnicy (Skaner/Pralka/Strażnik
 * Licencji). Tworzysz wolno, wydajesz świadomie, świat „nie krzywdzi" (teleport zamiast kary).
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { pickModelForTask, setActiveModel, getActiveModel } from '../../lib/modelRouter';
import PamiecHelper from './PamiecHelper';
import RezyserView from './RezyserView';

const BRIDGE = 'http://127.0.0.1:3001';

const LEVELS = [
  { icon: '🏝️', name: 'O TAK… Wyspa — punkt startu', desc: 'Brak danych → szablon wyspy + Antresola (punkt obserwacyjny). Z Twoimi katalogami zdjęć + danymi → ludzie/przedmioty/surowce materializują się na wyspie.' },
  { icon: '🍞', name: 'Antresola + lewitujący TOST', desc: 'TOST na wysokości wzroku → portal AETHER. Szklane panele = okna na wyspy innych suwerenów (sieć GRV).' },
  { icon: '🛡️', name: 'Strażnicy Progu', desc: 'Drony iFixAi (Tarcza) + Radca (Legal). Naruszenie = TELEPORTACJA, nie kara.' },
];

export const TeoArcadeForge: React.FC = () => {
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [scenePrompt, setScenePrompt] = useState(
    'Zbuduj punkt startu „O TAK… Wyspa": ocean wokół + wyspa (płaski teren). Na środku Antresola (uniesiona platforma — punkt obserwacyjny) z panelem OtakOS. Łagodne światło dnia (DirectionalLight 1.0), delikatne neony akcentowe. Bez nazw lokacji — czysta, dziewicza wyspa.'
  );
  const [ueCode, setUeCode] = useState('');
  const [ueFile, setUeFile] = useState('');
  const [gen, setGen] = useState(false);

  const generateScene = async () => {
    if (!scenePrompt.trim()) return;
    setGen(true); setUeCode(''); setUeFile('');
    const model = pickModelForTask('design', models) || getActiveModel();
    try {
      const d = await (await fetch(`${BRIDGE}/api/forge/ue-script`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: scenePrompt, model }),
      })).json();
      if (!d.success) throw new Error(d.message || 'Generacja nieudana');
      setUeCode(d.code); setUeFile(d.file);
      toast.success(`🐍 Skrypt UE gotowy (mózg: ${d.model}). Zapisany na dysku.`);
    } catch (e: any) { toast.error(`⚠ ${e.message} — uruchom most + Ollamę.`); }
    finally { setGen(false); }
  };

  useEffect(() => {
    (async () => {
      try { const d = await (await fetch(`${BRIDGE}/api/ollama/models`)).json(); setModels((d?.models || []).map((m: any) => m.name).filter(Boolean)); }
      catch { /* offline */ }
    })();
  }, []);

  const forgeWorld = () => {
    // Design-mode: dobierz model projektowy (glm) jeśli dostępny
    const m = pickModelForTask('design', models.length ? models : []);
    if (m) { setActiveModel(m); }
    const command =
      'Wykuj świat gry „GENESIS OVERRIDE" wg blueprintu TeO_Arcade_Forge/GENESIS_OVERRIDE.md w Unreal Engine 5.8. ' +
      'Zachowaj reguły 0.00G: nie krzywdzi (TELEPORTACJA zamiast kary), agenci-limity Epic (Strażnik Licencji), ' +
      'lokalnie/suwerennie. Etapy: O TAK… Wyspa (start) + Antresola z panelem OtakOS, Most + TOST → AETHER, Strażnicy iFixAi.';
    const tasks = JSON.parse(localStorage.getItem('otakos_terminal_tasks') || '[]');
    tasks.unshift({ id: `forge-${Date.now()}`, title: '🔨 Wykuj świat: GENESIS OVERRIDE', command });
    localStorage.setItem('otakos_terminal_tasks', JSON.stringify(tasks));
    window.dispatchEvent(new Event('otakos_new_terminal_task'));
    toast.success(`🔨 Świat zlecony do Kuźni 0.00G${m ? ` (mózg: ${m})` : ''}. Patrz Terminal 0.00G.`, { duration: 4000 });
  };

  const openUE = async () => {
    setBusy(true);
    try {
      const d = await (await fetch(`${BRIDGE}/api/uneng/launch`, { method: 'POST' })).json();
      toast(d.success ? `🎮 ${d.note}` : `⚠ ${d.message}`, { icon: d.success ? '🎮' : '⚠', duration: 5000 });
    } catch { toast.error('⚠ Most offline (:3001) — uruchom wiesio-bridge.js.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-fuchsia-500/25 bg-[#0a060f]/75 p-5 font-mono">
      <div className="mb-4">
        <div className="text-[10px] tracking-[0.3em] text-fuchsia-500/60">∴ FILAR II — TWÓRCZY ∴</div>
        <h3 className="text-lg font-bold text-fuchsia-300">🔨 TeO Arcade Forge</h3>
        <p className="text-[11px] text-zinc-400">Kuj grywalne światy mocą UE — suwerennie, ucząc się, nie krzywdząc. Projekt aktywny: <b className="text-fuchsia-200">GENESIS OVERRIDE</b>.</p>
      </div>

      {/* Poziomy blueprintu */}
      <div className="space-y-2 mb-4">
        {LEVELS.map(l => (
          <div key={l.name} className="flex items-start gap-3 rounded-lg border border-fuchsia-900/40 bg-black/30 p-2.5">
            <span className="text-lg shrink-0">{l.icon}</span>
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-fuchsia-200">{l.name}</div>
              <div className="text-[10px] text-zinc-400 leading-snug">{l.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Akcje */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={forgeWorld}
          className="px-4 py-2 rounded-lg border border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-300 text-xs font-bold hover:bg-fuchsia-900/50 transition-colors">
          🔨 Wykuj świat (Design-mode → Kuźnia)
        </button>
        <button onClick={openUE} disabled={busy}
          className="px-4 py-2 rounded-lg border border-cyan-500/50 bg-cyan-950/30 text-cyan-300 text-xs font-bold hover:bg-cyan-900/50 disabled:opacity-50 transition-colors">
          {busy ? '⟳ …' : '🎮 Otwórz Unreal Engine'}
        </button>
      </div>

      {/* 🧹 Przygotuj pamięć na UE */}
      <PamiecHelper />

      {/* 🐍 Agent buduje scenę (UE-Python, lokalnie) */}
      <div className="rounded-lg border border-violet-900/50 bg-black/30 p-3 mb-3">
        <div className="text-[11px] text-violet-300/80 tracking-wider mb-1.5">🐍 AGENT BUDUJE SCENĘ (UE-Python, lokalnie z Katedry)</div>
        <textarea value={scenePrompt} onChange={e => setScenePrompt(e.target.value)} rows={3}
          className="w-full bg-black/40 border border-violet-500/20 rounded px-2.5 py-2 text-[11px] text-violet-100 outline-none focus:border-violet-500 resize-y mb-2" />
        <button onClick={generateScene} disabled={gen}
          className="px-4 py-2 rounded-lg border border-violet-500/50 bg-violet-950/30 text-violet-300 text-xs font-bold hover:bg-violet-900/50 disabled:opacity-50 transition-colors">
          {gen ? '⟳ Mózg pisze skrypt…' : '🐍 Niech Agent napisze skrypt UE'}
        </button>
        {ueCode && (
          <div className="mt-2">
            <div className="text-[9px] text-emerald-400/80 mb-1">✅ Zapisano na dysku: <span className="text-zinc-400">{ueFile}</span></div>
            <pre className="text-[9px] text-violet-100/85 bg-black/50 border border-violet-900/50 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">{ueCode}</pre>
            <button onClick={() => navigator.clipboard?.writeText(ueCode).then(() => toast.success('Skopiowano skrypt.'))}
              className="text-[10px] mt-1 px-2 py-0.5 rounded border border-violet-500/40 text-violet-300 hover:bg-violet-950/40">📋 Kopiuj</button>
            <div className="text-[9px] text-zinc-500 mt-2 leading-relaxed">
              ▶ Uruchom w UE: <b>Narzędzia → Wykonaj skrypt Pythona</b> (wskaż plik powyżej), lub w konsoli UE: <code className="text-cyan-400">py "{ueFile}"</code>.
              <br />⚙ Najpierw RAZ: UE → Edycja → Wtyczki → włącz <b>„Python Editor Script Plugin"</b> → restart UE.
            </div>
          </div>
        )}
      </div>

      {/* 🎬 Reżyser — złóż film=grę ze scen i ujęć */}
      <RezyserView />

      {/* Strażnicy aktywni */}
      <div className="flex flex-wrap gap-1.5 text-[9px]">
        <span className="px-2 py-0.5 rounded-full border border-rose-500/40 text-rose-300">🛡️ Skaner Autentyczności</span>
        <span className="px-2 py-0.5 rounded-full border border-sky-500/40 text-sky-300">🤍 Pralka Kompasji</span>
        <span className="px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300">⚖️ Strażnik Licencji</span>
        <span className="px-2 py-0.5 rounded-full border border-violet-500/40 text-violet-300">🌊 Teleport zamiast kary</span>
      </div>

      <div className="text-[9px] text-zinc-600 mt-2 italic">
        Blueprint: TeO_Arcade_Forge/GENESIS_OVERRIDE.md · „Otwórz UE" odpala UnrealEditor.exe (env OTAKOS_UE_PATH).
      </div>
    </div>
  );
};

export default TeoArcadeForge;
