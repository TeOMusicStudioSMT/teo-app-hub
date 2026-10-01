/**
 * 🦀 OdpalKurka — pierwszy produkt Marketplace 0.00G.
 * Buton w KatedraChat: Klaudiusz (Claude Code) w Katedrze na modelu z Ollamy.
 *
 * 2026-10-01 (Suweren: „po odpaleniu się rozdziela… powinien dostać nowe zdolności — katalogi i skille"):
 * domyślnie Claude Code rusza W CZACIE jako Główny (services/Glowny.js — strumień, prośby z Tłumaczem, skille, stado),
 * a nie w odłączonym oknie terminala. Stare okno zostaje jako „w terminalu" (`ollama launch claude`).
 */
import React, { useState } from 'react';
import { GlownyCzat } from './GlownyCzat';

const BRIDGE = 'http://127.0.0.1:3001';

export const OdpalKurka: React.FC<{ task?: string }> = ({ task }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [wCzacie, setWCzacie] = useState(false);

  const terminal = async () => {
    setBusy(true); setMsg('🦀 Odpalam Klaudiusza w terminalu...');
    try {
      const model = localStorage.getItem('otakos_active_model') || 'gemma4';
      const d = await (await fetch(`${BRIDGE}/api/claude/launch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, task }),
      })).json();
      setMsg(d.success ? `✅ Odpalono w terminalu (model: ${d.model}).${d.brief ? ' Zadanie przekazane 📋' : ''} Czat tego okna nie widzi.` : `⚠ ${d.message}`);
    } catch (e: any) { setMsg(`⚠ ${e.message} — uruchom Wiesia (:3001) + Ollamę.`); }
    finally { setBusy(false); }
  };

  return (
    <div className="pt-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setWCzacie((x) => !x)}
          title="Claude Code jako Główny — tu, w czacie: widać, co robi, a o polecenia prosi z wyjaśnieniem"
          className="px-3 py-1 text-[11px] font-mono font-bold rounded-md border border-orange-500/50 bg-orange-950/30 text-orange-300 hover:bg-orange-900/50 transition-colors">
          {wCzacie ? '🦀 Schowaj Głównego' : '🦀 Odpal Tu...Kurka! (w czacie)'}
        </button>
        <button onClick={terminal} disabled={busy}
          title="Stary tryb: osobne okno terminala (ollama launch claude) — czat go nie widzi"
          className="px-2 py-1 text-[10px] font-mono rounded-md border border-slate-600 text-slate-400 hover:bg-slate-800 disabled:opacity-50">
          {busy ? '⟳ ...' : '🖥️ w terminalu'}
        </button>
        {msg && <span className="text-[10px] text-slate-400">{msg}</span>}
      </div>
      {wCzacie && <GlownyCzat zrodlo="katedra-chat" zadanie={task} />}
    </div>
  );
};

export default OdpalKurka;
