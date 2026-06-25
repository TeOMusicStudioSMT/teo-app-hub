/**
 * 🦀 OdpalKurka — pierwszy produkt Marketplace 0.00G.
 * Buton w KatedraChat: odpala Klaudiusza (Claude Code) w Katedrze przez Ollamę
 * (`ollama launch claude`), na modelu obecnym w interfejsie Wiesi.
 */
import React, { useState } from 'react';

const BRIDGE = 'http://127.0.0.1:3001';

export const OdpalKurka: React.FC<{ task?: string }> = ({ task }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const launch = async () => {
    setBusy(true); setMsg('🦀 Odpalam Klaudiusza w Katedrze...');
    try {
      const model = localStorage.getItem('otakos_active_model') || 'gemma4';
      const d = await (await fetch(`${BRIDGE}/api/claude/launch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, task }),
      })).json();
      setMsg(d.success ? `✅ Odpalono (model: ${d.model}).${d.brief ? ' Zadanie przekazane 📋' : ''}` : `⚠ ${d.message}`);
    } catch (e: any) { setMsg(`⚠ ${e.message} — uruchom Wiesia (:3001) + Ollamę.`); }
    finally { setBusy(false); }
  };

  return (
    <div className="pt-1 flex items-center gap-2">
      <button onClick={launch} disabled={busy}
        title="Odpala Claude Code w Katedrze (ollama launch claude) na bieżącym modelu"
        className="px-3 py-1 text-[11px] font-mono font-bold rounded-md border border-orange-500/50 bg-orange-950/30 text-orange-300 hover:bg-orange-900/50 disabled:opacity-50 transition-colors">
        {busy ? '⟳ ...' : '🦀 Odpal Tu...Kurka!'}
      </button>
      {msg && <span className="text-[10px] text-slate-400">{msg}</span>}
    </div>
  );
};

export default OdpalKurka;
