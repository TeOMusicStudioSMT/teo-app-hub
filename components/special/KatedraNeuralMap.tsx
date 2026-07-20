/**
 * 🧠 NeuralMap — żywa mapa lokalnej sieci neuronowej (AGI 0.00G)
 *
 * Renderuje manifest agi.local.ts jako animowaną sieć: węzły = neurony,
 * krawędzie = synapsy z przepływem sygnału. Hover = opis węzła. Cykliczny
 * „puls myśli" rozświetla kolejne neurony. Zero zależności poza React.
 */

import React, { useMemo, useState, useEffect } from 'react';
import AGI_LOCAL, { AgiLayer } from '../../lib/agi.local';

const LAYERS: AgiLayer[] = ['SENSE', 'CORE', 'ACT', 'GUARD'];
const LAYER_LABEL: Record<AgiLayer, { pl: string; en: string }> = {
  SENSE: { pl: 'ZMYSŁY', en: 'SENSE' },
  CORE:  { pl: 'RDZEŃ',  en: 'CORE' },
  ACT:   { pl: 'DZIAŁANIE', en: 'ACT' },
  GUARD: { pl: 'TARCZA', en: 'GUARD' },
};
const LAYER_COLOR: Record<AgiLayer, string> = {
  SENSE: '#22d3ee', // cyan
  CORE:  '#34d399', // emerald
  ACT:   '#f59e0b', // amber
  GUARD: '#fb7185', // rose
};

const W = 1000, H = 540, PAD_X = 120, PAD_Y = 70;
const BRIDGE = 'http://127.0.0.1:3001';

type LiveState = Record<string, { status: string; load: number }>;

export const NeuralMap: React.FC<{ lang?: 'pl' | 'en' | 'it' }> = ({ lang = 'pl' }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [live, setLive] = useState<LiveState | null>(null);
  const mode: 'LIVE' | 'STATIC' = live ? 'LIVE' : 'STATIC';

  // MOST: pytamy uruchomioną Katedrę (Wiesio-Bridge) o żywy stan węzłów.
  // Online → mapa = lustro realnej AGI. Offline → statyczny manifest.
  useEffect(() => {
    let alive = true;
    const probe = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const r = await fetch(`${BRIDGE}/api/agi/state`, { signal: ctrl.signal });
        clearTimeout(t);
        const d = await r.json();
        if (alive && d?.success && d.nodes) setLive(d.nodes);
        else if (alive) setLive(null);
      } catch { if (alive) setLive(null); }
    };
    probe();
    const iv = setInterval(probe, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // Pozycje węzłów: kolumny = warstwy, pionowo rozłożone.
  const pos = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    LAYERS.forEach((layer, ci) => {
      const nodes = AGI_LOCAL.nodes.filter(n => n.layer === layer);
      const x = PAD_X + (ci * (W - 2 * PAD_X)) / (LAYERS.length - 1);
      nodes.forEach((n, ri) => {
        const span = H - 2 * PAD_Y;
        const y = nodes.length === 1 ? H / 2 : PAD_Y + (ri * span) / (nodes.length - 1);
        map[n.id] = { x, y };
      });
    });
    return map;
  }, []);

  // Puls myśli — co 1.3s aktywny inny węzeł.
  useEffect(() => {
    const t = setInterval(() => setPulse(p => (p + 1) % AGI_LOCAL.nodes.length), 1300);
    return () => clearInterval(t);
  }, []);
  const activeId = AGI_LOCAL.nodes[pulse]?.id;

  const nodeById = (id: string) => AGI_LOCAL.nodes.find(n => n.id === id)!;
  const hoveredNode = hovered ? nodeById(hovered) : null;
  const isLit = (id: string) => hovered === id || activeId === id;
  const edgeLit = (e: { from: string; to: string }) =>
    hovered ? (e.from === hovered || e.to === hovered) : (e.from === activeId || e.to === activeId);

  return (
    <div className="relative w-full rounded-2xl border border-emerald-500/25 bg-[#03060a]/80 p-4 sm:p-6 overflow-hidden">
      <style>{`
        @keyframes agiFlow { to { stroke-dashoffset: -24; } }
        @keyframes agiBreath { 0%,100% { opacity:.35 } 50% { opacity:.9 } }
        .agi-flow { stroke-dasharray: 4 8; animation: agiFlow 1.1s linear infinite; }
        .agi-node-core { animation: agiBreath 3.2s ease-in-out infinite; }
      `}</style>

      {/* Nagłówek */}
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-emerald-500/60 font-mono">∴ KATEDRA OTAKOS ∴</div>
          <h3 className="text-lg sm:text-xl font-bold text-emerald-300 font-mono">
            {lang === 'pl' ? '🧠 SIEĆ NEURONOWA 0.00G' : '🧠 NEURAL NETWORK 0.00G'}
          </h3>
          <p className="text-[11px] text-zinc-400 max-w-md">
            {lang === 'pl'
              ? 'Żywa mapa lokalnej AGI — suwerenne węzły na Twoich tranzystorach. Zero chmury.'
              : 'Live local-AGI map — sovereign nodes on your transistors. Zero cloud.'}
          </p>
        </div>
        <div className="text-right font-mono">
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border mb-1 ${
            mode === 'LIVE' ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40' : 'border-zinc-700 text-zinc-500 bg-black/30'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${mode === 'LIVE' ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
            {mode === 'LIVE' ? (lang === 'pl' ? 'ŻYWY MOST' : 'LIVE BRIDGE') : (lang === 'pl' ? 'MANIFEST' : 'STATIC')}
          </div>
          <div className="text-[10px] text-zinc-500">agi.local · {AGI_LOCAL.origin}</div>
          <div className="text-xs text-emerald-400">{AGI_LOCAL.nodes.length} {lang === 'pl' ? 'neuronów' : 'neurons'}</div>
          <div className="text-[10px] text-zinc-500">{AGI_LOCAL.version} · {AGI_LOCAL.dimension}</div>
        </div>
      </div>

      {/* Mapa */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Etykiety warstw */}
        {LAYERS.map((layer, ci) => {
          const x = PAD_X + (ci * (W - 2 * PAD_X)) / (LAYERS.length - 1);
          return (
            <text key={layer} x={x} y={28} textAnchor="middle"
              fontFamily="monospace" fontSize="13" fontWeight="bold"
              fill={LAYER_COLOR[layer]} opacity={0.7}>
              {LAYER_LABEL[layer][lang]}
            </text>
          );
        })}

        {/* Synapsy */}
        {AGI_LOCAL.edges.map((e, i) => {
          const a = pos[e.from], b = pos[e.to];
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
          const lit = edgeLit(e);
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={lit ? '#34d399' : '#1f3a34'}
                strokeWidth={lit ? 2 : 1} opacity={lit ? 0.95 : 0.4} />
              {lit && <path d={d} fill="none" stroke="#a7f3d0" strokeWidth={2} className="agi-flow" opacity={0.9} />}
            </g>
          );
        })}

        {/* Neurony */}
        {AGI_LOCAL.nodes.map(n => {
          const p = pos[n.id]; if (!p) return null;
          const c = LAYER_COLOR[n.layer];
          const ls = live?.[n.id];
          const online = ls?.status === 'online';
          const offline = ls?.status === 'offline';
          const load = ls?.load ?? 0;
          const lit = isLit(n.id) || online;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer' }}
               onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}>
              {online && <circle r={30 + load * 16} fill={c} opacity={0.10 + load * 0.18} />}
              {lit && <circle r={34} fill={c} opacity={0.16} />}
              <circle r={24} fill="#04080c" stroke={c} strokeWidth={online ? 3 : lit ? 2.5 : 1.5}
                className={n.layer === 'CORE' ? 'agi-node-core' : ''}
                opacity={offline ? 0.35 : lit ? 1 : 0.85} />
              <text textAnchor="middle" dy="6" fontSize="20">{n.emoji}</text>
              <text textAnchor="middle" y={42} fontFamily="monospace" fontSize="11"
                fill={lit ? c : '#a1a1aa'} fontWeight={lit ? 'bold' : 'normal'}>
                {(lang === 'pl' ? n.label : n.labelEn).slice(0, 18)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip / opis aktywnego węzła */}
      <div className="mt-3 min-h-[44px] rounded-lg border border-zinc-700/60 bg-black/40 px-4 py-2 font-mono">
        {hoveredNode ? (
          <div className="flex items-start gap-2">
            <span className="text-lg">{hoveredNode.emoji}</span>
            <div>
              <div className="text-sm font-bold" style={{ color: LAYER_COLOR[hoveredNode.layer] }}>
                {lang === 'pl' ? hoveredNode.label : hoveredNode.labelEn}
                <span className="ml-2 text-[10px] text-zinc-500">{LAYER_LABEL[hoveredNode.layer][lang]}</span>
              </div>
              <div className="text-[11px] text-zinc-400">{lang === 'pl' ? hoveredNode.desc : hoveredNode.descEn}</div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-zinc-500 flex items-center h-full">
            {lang === 'pl'
              ? '↑ Najedź na neuron, by odczytać jego funkcję. Puls pokazuje żywą aktywność sieci.'
              : '↑ Hover a neuron to read its function. The pulse shows live network activity.'}
          </div>
        )}
      </div>

      {/* Legenda warstw */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-mono">
        {LAYERS.map(l => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: LAYER_COLOR[l] }} />
            <span className="text-zinc-400">{LAYER_LABEL[l][lang]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NeuralMap;
