/**
 * 🛡️ StraznikLicencji — Agent-Limit licencji Unreal Engine (responsibility-layer Forge).
 *
 * „Odpowiedzialność = Komunikacja." Pilnuje progów Epic UE, by Suweren tworzył wolno, a
 * wydawał świadomie. NIE pilnuje człowiek pamięcią — pilnuje agent w komunikacji.
 * ⚠ To NIE porada prawna/finansowa — orientacyjnie wg ogólnych zasad Epic. Sprawdź aktualny EULA.
 */
import React, { useState } from 'react';

const THRESHOLD = 1_000_000; // USD przychodu brutto
const ROYALTY = 0.05;        // 5% od nadwyżki

export const StraznikLicencji: React.FC = () => {
  const [project, setProject] = useState('');
  const [revStr, setRevStr] = useState('');

  const rev = Math.max(0, Number(revStr) || 0);
  const over = Math.max(0, rev - THRESHOLD);
  const royalty = over * ROYALTY;
  const near = rev >= THRESHOLD * 0.8 && rev < THRESHOLD; // 80% progu = ostrzeżenie
  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  const state = over > 0 ? 'over' : near ? 'near' : 'free';
  const ui = {
    free: { c: '#22c55e', label: '✅ DARMOWE', msg: 'Poniżej progu 1 MLN USD. Tworzysz i wydajesz bez tantiem — ale POWIADOM Epic o premierze gry.' },
    near: { c: '#f59e0b', label: '⚠ BLISKO PROGU', msg: `Zbliżasz się do 1 MLN USD (${(rev / THRESHOLD * 100).toFixed(0)}%). Przygotuj zgłoszenie do Epic i procedury produktu.` },
    over: { c: '#ef4444', label: '🔴 POWYŻEJ PROGU', msg: `Powyżej 1 MLN USD. Należne tantiemy: ${fmt(royalty)} (5% od nadwyżki ${fmt(over)}). Zgłoś tytuł do Epic w terminie.` },
  }[state];

  return (
    <div className="rounded-xl border border-rose-700/30 bg-black/30 p-3 mt-4">
      <div className="text-[11px] text-rose-300/80 tracking-wider mb-2">🛡️ STRAŻNIK LICENCJI — Unreal Engine (agent-limit)</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <input value={project} onChange={e => setProject(e.target.value)} placeholder="Nazwa projektu / gry"
          className="bg-black/40 border border-rose-500/20 rounded px-2.5 py-1.5 text-xs text-rose-100 outline-none focus:border-rose-500" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500">przychód:</span>
          <input value={revStr} onChange={e => setRevStr(e.target.value)} type="number" min={0} placeholder="0"
            className="flex-1 bg-black/40 border border-rose-500/20 rounded px-2.5 py-1.5 text-xs text-rose-100 outline-none focus:border-rose-500" />
          <span className="text-[10px] text-zinc-500">USD</span>
        </div>
      </div>

      {/* Pasek progu */}
      <div className="h-2 rounded-full bg-black/50 overflow-hidden mb-2">
        <div className="h-full transition-all" style={{ width: `${Math.min(100, (rev / THRESHOLD) * 100)}%`, background: ui.c }} />
      </div>

      <div className="rounded-lg px-3 py-2 text-[11px] leading-relaxed" style={{ background: `${ui.c}14`, border: `1px solid ${ui.c}44`, color: ui.c }}>
        <b>{ui.label}</b> — {ui.msg}
      </div>

      {/* Dwie ścieżki */}
      <div className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
        <b className="text-zinc-400">Dwie ścieżki:</b> (a) tworzenie/nauka w Katedrze = lekkie, lokalne, nie obciąża; (b) produkt do realnego wydania = osobne procedury i agenci (compliance, royalties, zgłoszenie Epic).
        <br />⚠ Orientacyjnie — to nie porada prawna. Sprawdź aktualny EULA Epic.
      </div>
    </div>
  );
};

export default StraznikLicencji;
