/**
 * 🔨 TeoArcadeForge — Game Forge Filaru II (0.00G).
 *
 * Spina sesyjną pracę pod gry: blueprint GENESIS OVERRIDE → „Wykuj świat" (design-mode
 * + brief do Terminala 0.00G) → „Otwórz Unreal Engine" → strażnicy (Skaner/Pralka/Strażnik
 * Licencji). Tworzysz wolno, wydajesz świadomie, świat „nie krzywdzi" (teleport zamiast kary).
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { pickModelForTask, setActiveModel } from '../../lib/modelRouter';

const BRIDGE = 'http://127.0.0.1:3001';

const LEVELS = [
  { icon: '🏛️', name: 'Poziom 1 — Cyber-Schron Emmerich', desc: 'Odwzorowanie Katedry: Smart Ring → Web NFC → wrota EventHorizon.' },
  { icon: '🍞', name: 'Poziom 2 — Most + lewitujący TOST', desc: 'Gwiazdy NeuralMap/Graviton → portal AETHER. Wybór Art → Beat-Sync z teledysk.mp4.' },
  { icon: '🛡️', name: 'Strażnicy Progu', desc: 'Drony iFixAi (Tarcza) + Radca (Legal). Naruszenie = TELEPORTACJA, nie kara.' },
];

export const TeoArcadeForge: React.FC = () => {
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

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
      'lokalnie/suwerennie. Poziomy: Cyber-Schron Emmerich, Most + TOST → AETHER, Strażnicy iFixAi.';
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
