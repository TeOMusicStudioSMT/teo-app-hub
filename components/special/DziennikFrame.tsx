/**
 * 📜 DziennikFrame — Operator Dziennika Pokładowego.
 * Lista podcastów (_OtakOs_Wymiar/Podcasti) → przemiał w infografikę 0.00G
 * (LLM → szablon) → podgląd. Wklej transkrypcję albo wybierz folder podcastu.
 */
import React, { useState, useEffect, useCallback } from 'react';

const BRIDGE = 'http://127.0.0.1:3001';

export const DziennikFrame: React.FC = () => {
  const [podcasts, setPodcasts] = useState<string[]>([]);
  const [dzienniki, setDzienniki] = useState<string[]>([]);
  const [src, setSrc] = useState('/Dziennik_Pokladowy_Autonomia.html');
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const refresh = useCallback(async () => {
    try { const d = await (await fetch(`${BRIDGE}/api/dziennik/list`)).json(); if (d.success) { setPodcasts(d.podcasts || []); setDzienniki(d.dzienniki || []); } }
    catch { setStatus('⚠ Most offline (:3001) — podgląd działa, przemiał wymaga Wiesia.'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const forge = useCallback(async (body: any, label: string) => {
    setBusy(true); setStatus(`🔮 Przemiał: ${label}... (LLM strukturyzuje rozmowę)`);
    try {
      const d = await (await fetch(`${BRIDGE}/api/dziennik/forge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
      if (!d.success) throw new Error(d.message || 'błąd');
      setSrc(d.url + '?t=' + Date.now());
      setStatus(`✅ Dziennik gotowy: ${d.title} ${d.usedLLM ? '(LLM)' : '(szkielet)'}`);
      refresh();
    } catch (e: any) { setStatus(`⚠ ${e.message}`); }
    finally { setBusy(false); }
  }, [refresh]);

  return (
    <div className="mt-4 space-y-3">
      {/* Operator */}
      <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-4 font-mono">
        <div className="text-[10px] tracking-widest text-cyan-500/60">∴ OPERATOR DZIENNIKA POKŁADOWEGO ∴</div>
        <div className="text-sm font-bold text-cyan-300 mb-3">📜 Przemiał Podcastów → Infografika 0.00G</div>

        {podcasts.length > 0 && (
          <>
            <div className="text-[9px] text-slate-400 mb-1">FOLDERY PODCASTÓW ({podcasts.length}) — klik przemiela (wymaga pliku tekstu w folderze):</div>
            <div className="flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto">
              {podcasts.map(p => (
                <button key={p} onClick={() => forge({ podcastDir: p }, `Podcast ${p}`)} disabled={busy}
                  className="px-2 py-0.5 rounded border border-fuchsia-500/30 text-fuchsia-300 text-[10px] hover:bg-fuchsia-950/40 disabled:opacity-50">
                  {p}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="text-[9px] text-slate-400 mb-1">LUB WKLEJ TRANSKRYPCJĘ / ROZMOWĘ:</div>
        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={3}
          placeholder="Wklej tekst rozmowy/podcastu..."
          className="w-full bg-black/40 border border-cyan-500/20 rounded px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-cyan-500 resize-y" />
        <div className="flex gap-2 mt-2 items-center flex-wrap">
          <button onClick={() => forge({ transcript }, 'wklejka')} disabled={busy || transcript.trim().length < 30}
            className="px-4 py-1.5 rounded border border-cyan-500/50 bg-cyan-950/40 text-cyan-300 text-[11px] font-bold hover:bg-cyan-900/50 disabled:opacity-40">
            {busy ? '⟳ Przemiał...' : '🔮 PRZEMIEL W DZIENNIK'}
          </button>
          {dzienniki.length > 0 && (
            <select onChange={e => e.target.value && setSrc('/dzienniki/' + e.target.value + '?t=' + Date.now())}
              className="bg-black/40 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300">
              <option value="">📚 Gotowe dzienniki ({dzienniki.length})...</option>
              {dzienniki.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
        {status && <div className="text-[10px] text-slate-400 mt-2">{status}</div>}
      </div>

      {/* Podgląd */}
      <div className="w-full h-[75vh] border border-cyan-500/30 rounded-2xl bg-slate-950/80 overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)]">
        <iframe src={src} className="w-full h-full border-none" title="Dziennik Pokładowy Katedry" />
      </div>
    </div>
  );
};

export default DziennikFrame;
