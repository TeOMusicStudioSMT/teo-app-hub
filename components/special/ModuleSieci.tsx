/**
 * 🗺️ ModuleSieci — Lazy Drill-Down mapy modułów OtakOS (3281+ modułów)
 *
 * Zamiast ładować całe drzewo (timeout/64k zatkany), ładuje TYLKO żądany poziom:
 *   macro → klik katalog → mezo → klik → mikro.
 *
 * Defensive Design: jeśli zapytanie do mostu zostanie przerwane (abort) albo
 * rzuci ReferenceError/TypeError — UI automatycznie podstawia lokalną mapę
 * zapasową (fallbackStructure) zamiast paraliżować panel.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Folder, FileCode, ChevronRight, RefreshCw, AlertTriangle, Network, X } from 'lucide-react';

const BRIDGE = 'http://127.0.0.1:3001';

type Level = 'macro' | 'mezo' | 'mikro';

interface MapNode {
    id: string; label: string; type: 'dir' | 'file';
    count: number; lines?: number; path: string; hasChildren: boolean;
}
interface Crumb { level: Level; parent: string; label: string; }

// 🛟 Lokalna mapa zapasowa — gdy most padnie, panel pozostaje użyteczny.
const FALLBACK_STRUCTURE: MapNode[] = [
    { id: 'components',      label: 'components',      type: 'dir',  count: 0, path: 'components',      hasChildren: true },
    { id: 'services',        label: 'services',        type: 'dir',  count: 0, path: 'services',        hasChildren: true },
    { id: 'src',             label: 'src',             type: 'dir',  count: 0, path: 'src',             hasChildren: true },
    { id: 'lib',             label: 'lib',             type: 'dir',  count: 0, path: 'lib',             hasChildren: true },
    { id: 'store',           label: 'store',           type: 'dir',  count: 0, path: 'store',           hasChildren: true },
    { id: 'context',         label: 'context',         type: 'dir',  count: 0, path: 'context',         hasChildren: true },
    { id: 'hooks',           label: 'hooks',           type: 'dir',  count: 0, path: 'hooks',           hasChildren: true },
    { id: 'wiesio-bridge.js', label: 'wiesio-bridge.js', type: 'file', count: 1, path: 'wiesio-bridge.js', hasChildren: false },
];

const NEXT_LEVEL: Record<Level, Level> = { macro: 'mezo', mezo: 'mikro', mikro: 'mikro' };

export const ModuleSieci: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [nodes, setNodes]     = useState<MapNode[]>([]);
    const [crumbs, setCrumbs]   = useState<Crumb[]>([{ level: 'macro', parent: '', label: 'KATEDRA' }]);
    const [loading, setLoading] = useState(true);
    const [fallback, setFallback] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const current = crumbs[crumbs.length - 1];

    /** Pobierz jeden poziom — z pełną obroną przed abort/Error. */
    const fetchLevel = useCallback(async (level: Level, parent: string) => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true); setErrorMsg(null); setFallback(false);

        // Twardy bezpiecznik czasowy — żeby panel nigdy nie wisiał.
        const guard = setTimeout(() => ctrl.abort(), 20_000);
        try {
            const url = `${BRIDGE}/api/modules/map?level=${level}` + (parent ? `&parent=${encodeURIComponent(parent)}` : '');
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error(`Most HTTP ${res.status}`);
            const data = await res.json();
            if (!data.success || !Array.isArray(data.nodes)) throw new TypeError('Niepoprawna struktura odpowiedzi.');
            setNodes(data.nodes);
        } catch (e: any) {
            // Defensive Design: abort / ReferenceError / TypeError / sieć → mapa zapasowa.
            const aborted = e?.name === 'AbortError';
            console.warn('[ModuleSieci] 🛟 Fallback:', e?.message || e);
            setNodes(FALLBACK_STRUCTURE);
            setFallback(true);
            setErrorMsg(aborted ? 'Most przerwał operację (timeout/abort) — pokazuję mapę zapasową.'
                : `${e?.name || 'Błąd'}: ${e?.message || 'nieznany'} — mapa zapasowa.`);
            // Cofnij breadcrumb do macro (mapa zapasowa to poziom macro).
            setCrumbs([{ level: 'macro', parent: '', label: 'KATEDRA (offline)' }]);
        } finally {
            clearTimeout(guard);
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLevel('macro', ''); return () => abortRef.current?.abort(); }, [fetchLevel]);

    const drillInto = (node: MapNode) => {
        if (node.type !== 'dir' || !node.hasChildren) return;
        const nextLevel = NEXT_LEVEL[current.level];
        setCrumbs(prev => [...prev, { level: nextLevel, parent: node.path, label: node.label }]);
        fetchLevel(nextLevel, node.path);
    };

    const jumpTo = (idx: number) => {
        const target = crumbs[idx];
        setCrumbs(crumbs.slice(0, idx + 1));
        fetchLevel(target.level, target.parent);
    };

    const levelColor = current.level === 'macro' ? '#22d3ee' : current.level === 'mezo' ? '#a78bfa' : '#34d399';

    return (
        <div className="w-full max-w-4xl mx-auto bg-[#04070d] border border-cyan-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] font-sans text-slate-200">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-gradient-to-r from-[#06121a] to-[#0a0a14]">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-black border border-cyan-500/40 flex items-center justify-center">
                        <Network size={22} className="text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-400">MAPA SIECI MODUŁÓW</h2>
                        <p className="text-[10px] text-slate-500 tracking-wider">Lazy Drill-Down · warstwa: <span style={{ color: levelColor }}>{current.level.toUpperCase()}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => fetchLevel(current.level, current.parent)} title="Odśwież"
                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white border border-slate-700"><X size={15} /></button>
                    )}
                </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center flex-wrap gap-1 px-6 py-2.5 border-b border-slate-800 text-[11px] font-mono">
                {crumbs.map((c, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <ChevronRight size={11} className="text-slate-600" />}
                        <button onClick={() => jumpTo(i)}
                            className={`px-2 py-0.5 rounded ${i === crumbs.length - 1 ? 'text-cyan-300 bg-cyan-500/10' : 'text-slate-500 hover:text-slate-300'}`}>
                            {c.label}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {/* Fallback banner */}
            {fallback && errorMsg && (
                <div className="mx-6 mt-3 flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="shrink-0" /> {errorMsg}
                </div>
            )}

            {/* Grid węzłów */}
            <div className="p-6 min-h-[320px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-slate-600 text-sm gap-2">
                        <RefreshCw size={16} className="animate-spin" /> Ładuję warstwę {current.level}...
                    </div>
                ) : nodes.length === 0 ? (
                    <div className="text-center text-slate-600 py-20 text-sm">Pusty poziom — brak modułów.</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {nodes.map(node => {
                            const clickable = node.type === 'dir' && node.hasChildren;
                            return (
                                <motion.button
                                    key={node.id}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    onClick={() => clickable && drillInto(node)}
                                    disabled={!clickable}
                                    whileHover={clickable ? { scale: 1.03 } : {}}
                                    className={`text-left rounded-xl p-3 border transition-colors
                                        ${node.type === 'dir'
                                            ? 'bg-cyan-950/20 border-cyan-500/25 hover:border-cyan-400/60'
                                            : 'bg-slate-900/40 border-slate-700/50 cursor-default'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {node.type === 'dir'
                                            ? <Folder size={15} className="text-cyan-400 shrink-0" />
                                            : <FileCode size={15} className="text-emerald-400 shrink-0" />}
                                        <span className="text-xs font-mono text-slate-200 truncate" title={node.label}>{node.label}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                                        <span>{node.type === 'dir' ? `${node.count} modułów` : `${node.lines ?? '?'} linii`}</span>
                                        {clickable && <ChevronRight size={11} className="text-cyan-600" />}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModuleSieci;
