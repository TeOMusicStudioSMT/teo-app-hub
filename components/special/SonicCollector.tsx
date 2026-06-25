/**
 * 🎼 SonicCollector — Kolektor Soniczny (Filar I — Poznawczy, 0.00G).
 *
 * Wybierasz WŁASNĄ muzykę z dysku lokalnego → Web Audio analizuje ją w przeglądarce
 * (zero uploadu) i wyciąga REALNY wektor soniczny (energia, jasność, obwiednia czasowa)
 * na 2. etap. Etap 1: fale nie są otagowane — dawaj SWOJE utwory.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface SonicVector {
  name: string; durationSec: number; energy: number; peak: number; brightness: number; envelope: number[]; at: number;
}

const STORE = 'otakos_sonic_vectors';

async function analyze(file: File): Promise<SonicVector> {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  try {
    const buf: AudioBuffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const ch = buf.getChannelData(0);
    const N = ch.length;
    const stride = Math.max(1, Math.floor(N / 200000)); // cap pracy
    let sumSq = 0, peak = 0, zc = 0, prev = 0, count = 0;
    for (let i = 0; i < N; i += stride) {
      const v = ch[i];
      sumSq += v * v;
      const a = Math.abs(v); if (a > peak) peak = a;
      if ((v >= 0) !== (prev >= 0)) zc++;
      prev = v; count++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    const zcr = zc / Math.max(1, count);
    // 8-segmentowa obwiednia energii (kształt utworu w czasie)
    const seg = 8, segLen = Math.floor(N / seg), env: number[] = [];
    for (let s = 0; s < seg; s++) {
      let ss = 0, c = 0;
      for (let i = s * segLen; i < (s + 1) * segLen; i += stride) { ss += ch[i] * ch[i]; c++; }
      env.push(+Math.sqrt(ss / Math.max(1, c)).toFixed(4));
    }
    return {
      name: file.name, durationSec: +buf.duration.toFixed(1),
      energy: +rms.toFixed(4), peak: +peak.toFixed(3), brightness: +zcr.toFixed(4),
      envelope: env, at: Date.now(),
    };
  } finally { ctx.close().catch(() => {}); }
}

export const SonicCollector: React.FC = () => {
  const [vectors, setVectors] = useState<SonicVector[]>(() => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } });
  const [busy, setBusy] = useState(false);

  const save = (list: SonicVector[]) => { setVectors(list); try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* noop */ } };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('audio'));
    if (!files.length) return;
    setBusy(true);
    const out: SonicVector[] = [];
    for (const f of files) {
      try { out.push(await analyze(f)); }
      catch { toast.error(`Nie udało się przeanalizować: ${f.name}`); }
    }
    if (out.length) { save([...out, ...vectors].slice(0, 50)); toast.success(`🎼 Zebrano ${out.length} wektor(ów) sonicznych!`, { icon: '🎼' }); }
    setBusy(false);
    e.target.value = '';
  };

  const clear = () => { save([]); toast('Zbiór wyczyszczony.'); };
  const maxEnv = Math.max(0.0001, ...vectors.flatMap(v => v.envelope));

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-[#04080a]/70 p-5 font-mono">
      <div className="mb-3">
        <div className="text-[10px] tracking-[0.3em] text-cyan-500/60">∴ FILAR I — POZNAWCZY ∴</div>
        <h3 className="text-lg font-bold text-cyan-300">🎼 Kolektor Soniczny 0.00G</h3>
        <p className="text-[11px] text-zinc-400">Wybierz WŁASNĄ muzykę z dysku — analiza lokalna (Web Audio, zero uploadu) wyciąga wektor soniczny na 2. etap.</p>
      </div>

      {/* Nota etapu 1 */}
      <div className="text-[10px] text-amber-300/80 bg-amber-950/20 border border-amber-500/25 rounded-lg px-3 py-2 mb-4 leading-relaxed">
        ⚠ Etap 1: fale soniczne nie są otagowane prawami — <b>dawaj swoje wytworzone utwory</b>. Pełne tagowanie/prawa dochodzą w etapie 2.
      </div>

      {/* Wczytaj */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <label className={`px-4 py-2 rounded-lg border border-cyan-500/50 bg-cyan-950/30 text-cyan-300 text-xs font-bold cursor-pointer hover:bg-cyan-900/50 transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? '⏳ Analizuję…' : '🎵 Wczytaj muzykę (lokalnie)'}
          <input type="file" accept="audio/*" multiple onChange={onFiles} className="hidden" disabled={busy} />
        </label>
        <div className="text-[11px] text-cyan-400 font-bold">🎼 {vectors.length} wektor(ów)</div>
      </div>

      {/* Lista wektorów */}
      {vectors.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-6">Brak wektorów. Wczytaj utwór, by rozpocząć zbiór soniczny.</p>
      ) : (
        <div className="space-y-2">
          {vectors.map((v, i) => (
            <motion.div key={v.at + '-' + i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-zinc-800/70 bg-black/30 p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[12px] font-bold text-cyan-200 truncate">{v.name}</span>
                <span className="text-[9px] text-zinc-500 shrink-0">{v.durationSec}s</span>
              </div>
              {/* obwiednia energii */}
              <div className="flex items-end gap-0.5 h-8 mb-1.5">
                {v.envelope.map((e, j) => (
                  <div key={j} className="flex-1 bg-gradient-to-t from-cyan-600 to-cyan-300 rounded-sm" style={{ height: `${Math.max(6, (e / maxEnv) * 100)}%` }} />
                ))}
              </div>
              <div className="flex gap-3 text-[9px] text-zinc-500">
                <span>energia: <span className="text-cyan-400">{v.energy}</span></span>
                <span>jasność: <span className="text-cyan-400">{v.brightness}</span></span>
                <span>peak: <span className="text-cyan-400">{v.peak}</span></span>
              </div>
            </motion.div>
          ))}
          <button onClick={clear} className="text-[10px] text-zinc-600 hover:text-rose-400 transition-colors mt-1">wyczyść zbiór</button>
        </div>
      )}
    </div>
  );
};

export default SonicCollector;
