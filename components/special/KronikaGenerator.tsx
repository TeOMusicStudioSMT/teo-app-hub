/**
 * ✨ KronikaGenerator — ŻYWY kreator wpisów Kroniki 0.00G.
 *
 * Z atrapy (symulowane setTimeout) → prawdziwy organizm: lokalny Gemma 4 pisze
 * narrację + RÓWNOLEGLE 3 agenci (Adamus/Bella/ODDI) dają feedback
 * (/api/kronika/forge). Wpisy żyją w kronikaEntriesAtom (localStorage) i są
 * renderowane jako KronikaCard. Wklej rozmowę/podcast → wyczaruj żywą kartę.
 */

import React, { useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { kronikaEntriesAtom, KronikaEntry } from '../../store/kronikaStore';
import KronikaCard from './KronikaCard';

const BRIDGE = 'http://127.0.0.1:3001';

export const KronikaGenerator: React.FC = () => {
  const [entries, setEntries] = useAtom(kronikaEntriesAtom);
  const [title, setTitle] = useState('');
  const [narrative, setNarrative] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const forge = useCallback(async () => {
    if (narrative.trim().length < 20) { setStatus('⚠ Wklej treść (min 20 znaków).'); return; }
    setBusy(true); setStatus('✨ Gemma 4 pisze narrację, agenci się zbierają...');
    try {
      const r = await fetch(`${BRIDGE}/api/kronika/forge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || undefined, narrative, videoUrl: videoUrl || undefined }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'błąd');
      setEntries(prev => [d.entry as KronikaEntry, ...prev]);
      setStatus(`✅ Wpis wykuty ${d.usedLLM ? '(Gemma 4 + agenci)' : '(tryb offline — szkielet)'}.`);
      setTitle(''); setNarrative(''); setVideoUrl('');
    } catch (e: any) { setStatus(`⚠ ${e.message} — uruchom Wiesio-Bridge (:3001) + Ollama.`); }
    finally { setBusy(false); }
  }, [title, narrative, videoUrl, setEntries]);

  return (
    <div className="space-y-4">
      {/* Kreator */}
      <div className="p-4 rounded-xl border border-cyan-500/25 bg-gray-900/70 space-y-2">
        <div className="text-[10px] tracking-widest text-cyan-500/60 font-mono">∴ ŻYWY KRONIKARZ 0.00G ∴</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tytuł wpisu (opcjonalnie)"
          className="w-full bg-black/40 border border-cyan-500/20 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500 font-mono" />
        <textarea value={narrative} onChange={e => setNarrative(e.target.value)} rows={4}
          placeholder="Wklej rozmowę / podcast / intencję — Kronikarz przemieli to w żywy wpis..."
          className="w-full bg-black/40 border border-cyan-500/20 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500 resize-y" />
        <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="Ścieżka/URL wideo (opcjonalnie)"
          className="w-full bg-black/40 border border-cyan-500/20 rounded px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-cyan-500 font-mono" />
        <div className="flex items-center gap-3">
          <button onClick={forge} disabled={busy}
            className="px-5 py-2 rounded border border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-300 text-sm font-bold hover:bg-fuchsia-900/50 disabled:opacity-50 font-mono">
            {busy ? '⟳ Czaruję...' : '✨ WYCZARUJ ŻYWY WPIS'}
          </button>
          {status && <span className="text-xs text-gray-400 font-mono">{status}</span>}
        </div>
      </div>

      {/* Żywe karty */}
      <div className="space-y-4">
        {entries.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8 font-mono">Brak wpisów — wyczaruj pierwszy. ✨</p>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="relative group">
              <KronikaCard entry={entry} />
              <button onClick={() => setEntries(prev => prev.filter(e => e.id !== entry.id))}
                title="Usuń wpis"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 text-xs transition-opacity">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KronikaGenerator;
