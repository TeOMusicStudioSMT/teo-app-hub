/**
 * 🎓 Economis — moduł TeO Sim Academy o ekonomii GRV.
 * Agenci (ISTed/Adamus/ODDI) czytają KATALOG WIEDZY (_OtakOs_Aula/economis/) i
 * dyskutują ULEPSZENIA ekosystemu GRV. Wzorzec katalogowy = standard dla Academy.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const BRIDGE = 'http://127.0.0.1:3001';
const AGENT_COLOR: Record<string, string> = { ISTed: '#10b981', Adamus: '#f0c060', ODDI: '#22d3ee' };

interface Doc { name: string; content: string; }
interface Proposal { agent: string; text: string; }

export const Economis: React.FC = () => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [topic, setTopic] = useState('jak rozwinąć obieg GRV i zachęcić twórców');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch(`${BRIDGE}/api/academy/knowledge/economis`).then(r => r.json()).then(d => { if (d.success) setDocs(d.docs); }).catch(() => setStatus('⚠ Most offline (:3001)'));
  }, []);

  const discuss = useCallback(async () => {
    setBusy(true); setStatus('🔮 Rada Economis obraduje (Gemma 4 + agenci)...'); setProposals(null);
    try {
      const d = await (await fetch(`${BRIDGE}/api/academy/discuss`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'economis', topic }) })).json();
      if (!d.success) throw new Error(d.message || 'błąd');
      setProposals(d.proposals);
      setStatus(`✅ ${d.proposals.length} propozycji ${d.usedLLM ? '(Gemma 4)' : '(rdzeń offline)'}`);
    } catch (e: any) { setStatus(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  }, [topic]);

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-[#04080a]/70 p-5 font-mono">
      <div className="text-[10px] tracking-[0.3em] text-emerald-500/60">∴ TEO SIM ACADEMY ∴</div>
      <h3 className="text-lg font-bold text-emerald-300 mb-1">🎓 ECONOMIS — Rada Ekonomii GRV</h3>
      <p className="text-[11px] text-zinc-400 mb-4">Agenci czytają katalog wiedzy domenowej i proponują ulepszenia ekosystemu GRV.</p>

      {/* Katalog wiedzy */}
      <div className="rounded-lg border border-zinc-800 bg-black/30 p-3 mb-4">
        <div className="text-[10px] text-emerald-400/70 mb-1">📚 KATALOG WIEDZY (_OtakOs_Aula/economis/) — {docs.length} dok.</div>
        {docs.length === 0 ? <div className="text-[11px] text-zinc-500">Brak (lub most offline).</div> : (
          <div className="flex flex-wrap gap-1.5">
            {docs.map(d => <span key={d.name} className="px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-[10px] text-emerald-300">📄 {d.name}</span>)}
          </div>
        )}
      </div>

      {/* Temat + zwołanie Rady */}
      <div className="flex gap-2 flex-wrap mb-3">
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="temat dyskusji..."
          className="flex-1 min-w-[200px] bg-black/40 border border-emerald-500/20 rounded px-2 py-1.5 text-xs text-emerald-100 outline-none focus:border-emerald-500" />
        <button onClick={discuss} disabled={busy}
          className="px-4 py-1.5 rounded border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 text-xs font-bold hover:bg-emerald-900/50 disabled:opacity-50">
          {busy ? '⟳ Obrady...' : '🔮 ZWOŁAJ RADĘ ECONOMIS'}
        </button>
      </div>

      {/* Propozycje agentów */}
      {proposals && (
        <div className="space-y-2">
          {proposals.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="rounded-lg border border-zinc-800/70 bg-black/30 p-3">
              <div className="text-xs font-bold mb-1" style={{ color: AGENT_COLOR[p.agent] || '#94a3b8' }}>[{p.agent}]</div>
              <div className="text-[12px] text-zinc-200 leading-relaxed">{p.text}</div>
            </motion.div>
          ))}
        </div>
      )}
      {status && <div className="text-[10px] text-zinc-400 mt-3">{status}</div>}
    </div>
  );
};

export default Economis;
