/**
 * 🧠 NeuralFlowPreview — Podgląd Sieci Neuronowej Bytów Katedry
 *
 * Generyczny wizualizator grafu przepływu danych dla modułów OtakOS.
 * Każdy "byt" (entity) to rejestr węzłów + krawędzi. Kliknięcie węzła
 * otwiera panel z opisem i ŚCIEŻKĄ DO WĘZŁA DANYCH (plik źródłowy/skarbiec).
 *
 * Obsługiwane byty: Pralka (Roasting), TOST Messenger, Pralka EXIF, Impresario.
 * Nowe byty dodaje się przez rozszerzenie ENTITY_REGISTRY.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Typy rejestru ────────────────────────────────────────────────────────────

export interface NeuralNode {
    id:       string;
    label:    string;
    icon:     string;
    dataPath: string;   // ścieżka do węzła danych (plik / endpoint / skarbiec)
    desc:     string;
    x:        number;   // pozycja w viewBox 800×340
    y:        number;
    color?:   string;
}

export interface NeuralEdge {
    from:    string;
    to:      string;
    label?:  string;
    dashed?: boolean;   // krawędź warunkowa (np. bypass SP)
}

export interface NeuralEntity {
    id:    string;
    name:  string;
    icon:  string;
    theme: string;      // kolor przewodni
    nodes: NeuralNode[];
    edges: NeuralEdge[];
}

// ─── Rejestr bytów Katedry ────────────────────────────────────────────────────

export const ENTITY_REGISTRY: NeuralEntity[] = [
    {
        id: 'pralka-roast',
        name: 'PRALKA — Roasting Station',
        icon: '🧺',
        theme: '#f97316',
        nodes: [
            { id: 'suweren',      label: 'Suweren Input',      icon: '👑', x:  70, y: 170, dataPath: 'components/special/PralkaStation.tsx',  desc: 'Wejście Suwerena: tekst + suwak poziomu 1-9 + media.' },
            { id: 'statemachine', label: 'State Machine',      icon: '⚙️', x: 230, y:  60, dataPath: 'hooks/useRoastStateMachine.ts',          desc: 'Maszyna Stanów: IDLE → ENGAGED → OVERLOAD. Definiuje ProtocolPolicy wg poziomu.' },
            { id: 'context',      label: 'Roasting Context',   icon: '🧠', x: 230, y: 170, dataPath: 'context/roastingContext.tsx',            desc: 'Jądro Sterujące: scala State Machine, Guardrail, Chronos i SP w jeden przepływ.' },
            { id: 'tone',         label: 'Tone Validator',     icon: '🛡️', x: 400, y:  90, dataPath: 'services/ToneValidatorService.ts',       desc: 'Ethical Guardrail: riskScore 0-1, blokada toksycznych transmisji.' },
            { id: 'chronos',      label: 'Chronos (LTC)',      icon: '⏳', x: 400, y: 250, dataPath: 'services/LTCStoreService.ts',            desc: 'Pamięć Długoterminowa: trajektoria tożsamości, historicalImpactScore.' },
            { id: 'sp',           label: 'Singularity Proto.', icon: '🔮', x: 400, y: 170, dataPath: 'context/roastingContext.tsx',            desc: 'Kontrolowany chaos: bypass Deep Analysis → Impact Summary (150ms).' },
            { id: 'media',        label: 'Media Input',        icon: '📸', x: 230, y: 280, dataPath: 'components/MediaInput/MediaInput.tsx',   desc: 'WebRTC kamera. Gate: policy.canSendMedia (poziom ≥ 5).' },
            { id: 'veil',         label: 'The Veil',           icon: '👁️', x: 570, y: 170, dataPath: 'components/TheVeil.tsx',                 desc: 'Warstwa Interpretacyjna: wizualizacja walidacji, pamięci i obciążenia.' },
            { id: 'stream',       label: 'Strumień Wyjścia',   icon: '📡', x: 720, y: 170, dataPath: 'context/roastingContext.tsx',            desc: 'Emisja zwalidowanego przekazu do strumienia komunikacji.' },
        ],
        edges: [
            { from: 'suweren',      to: 'context' },
            { from: 'statemachine', to: 'context',  label: 'policy' },
            { from: 'media',        to: 'context',  label: 'gated' },
            { from: 'context',      to: 'tone',     label: 'deep' },
            { from: 'context',      to: 'sp',       label: 'chaos', dashed: true },
            { from: 'tone',         to: 'chronos',  label: 'zapis' },
            { from: 'chronos',      to: 'veil' },
            { from: 'sp',           to: 'veil',     dashed: true },
            { from: 'veil',         to: 'stream' },
        ],
    },
    {
        id: 'tost-messenger',
        name: 'TOST Messenger — Schron Suwerena',
        icon: '💬',
        theme: '#22c55e',
        nodes: [
            { id: 'ui',      label: 'TOST UI',           icon: '💬', x:  80, y: 170, dataPath: 'components/special/TostMessenger.tsx',           desc: 'Zielony terminal szpiegowski. Optymistyczne UI + Szmaragdowy Terminal P2P.' },
            { id: 'laundry', label: 'Pralka EXIF',       icon: '🧽', x: 250, y:  80, dataPath: 'services/LaundryService.js',                      desc: 'Sterylizacja binarna: JPEG APP1/APP2/COM, PNG tEXt/eXIf/iCCP. 100% czystości.' },
            { id: 'bridge',  label: 'Wiesio Bridge',     icon: '🌉', x: 420, y: 170, dataPath: 'wiesio-bridge.js',                                desc: 'Express :3001 — endpointy /api/tost/*, /api/laundry/*, /api/tost/p2p/*.' },
            { id: 'gemma',   label: 'Gemma4 (Ollama)',   icon: '🤖', x: 620, y:  70, dataPath: 'http://127.0.0.1:11434/api/generate',             desc: 'Lokalny rdzeń AI — offline, zero chmury. Timeout 120s na zimny VRAM.' },
            { id: 'vault',   label: 'TOST Vault',        icon: '🔐', x: 620, y: 170, dataPath: '_AntiGravity_Wymiar/secure/tost_vault.json',      desc: 'Skarbiec Base64, atomowy zapis, owner: local, max 200 wiadomości.' },
            { id: 'p2p',     label: 'Szmaragdowy Tunel', icon: '🔗', x: 620, y: 270, dataPath: 'wiesio-bridge.js → /api/tost/p2p/stream/:token',  desc: 'SSE relay P2P. Token XXXX-XXXX-XXXX, RAM-only, TTL 4h, mergeLiveStreams.' },
        ],
        edges: [
            { from: 'ui',      to: 'laundry', label: 'obraz' },
            { from: 'laundry', to: 'bridge',  label: 'sterylny' },
            { from: 'ui',      to: 'bridge',  label: 'tekst' },
            { from: 'bridge',  to: 'gemma',   label: 'prompt' },
            { from: 'bridge',  to: 'vault',   label: 'zapis' },
            { from: 'bridge',  to: 'p2p',     label: 'relay', dashed: true },
        ],
    },
    {
        id: 'impresario',
        name: 'Impresario — Agent Wydawniczy',
        icon: '🎙️',
        theme: '#a78bfa',
        nodes: [
            { id: 'dash',    label: 'Dashboard',      icon: '🎛️', x:  80, y: 170, dataPath: 'components/special/ImpresarioDashboard.tsx',      desc: 'Formularz zleceń: tytuł, album, filePath, platformy.' },
            { id: 'queue',   label: 'Kolejka Zadań',  icon: '📋', x: 280, y: 170, dataPath: '_AntiGravity_Wymiar/media/publish_queue.json',    desc: 'Atomowa kolejka publikacji — PENDING → PROCESSING → COMPLETE.' },
            { id: 'service', label: 'ImpresarioSvc',  icon: '🎙️', x: 460, y: 170, dataPath: 'services/ImpresarioService.js',                   desc: 'Procesor co 15s. OAuth2 refresh flow + streaming upload.' },
            { id: 'youtube', label: 'YouTube',        icon: '▶️', x: 650, y:  80, dataPath: 'services/ImpresarioService.js → uploadToYouTube', desc: 'Resumable upload: createReadStream → HTTPS, zero RAM bufora.' },
            { id: 'spotify', label: 'DistroKid',      icon: '🎵', x: 650, y: 260, dataPath: '_AntiGravity_Wymiar/media/exports/',              desc: 'Eksport paczkowy: metadata.txt + audio + cover_placeholder.png.' },
        ],
        edges: [
            { from: 'dash',    to: 'queue' },
            { from: 'queue',   to: 'service' },
            { from: 'service', to: 'youtube', label: 'stream' },
            { from: 'service', to: 'spotify', label: 'export' },
        ],
    },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface NeuralFlowPreviewProps {
    defaultEntityId?: string;
    /** Węzły aktualnie aktywne (pulsujące) — np. z żywego stanu modułu */
    activeNodeIds?: string[];
}

// ─── Komponent ────────────────────────────────────────────────────────────────

const NeuralFlowPreview: React.FC<NeuralFlowPreviewProps> = ({
    defaultEntityId = 'pralka-roast',
    activeNodeIds = [],
}) => {
    const [entityId, setEntityId]     = useState(defaultEntityId);
    const [selectedNode, setSelected] = useState<NeuralNode | null>(null);
    const [pathCopied, setPathCopied] = useState(false);

    const entity = useMemo(
        () => ENTITY_REGISTRY.find(e => e.id === entityId) ?? ENTITY_REGISTRY[0],
        [entityId]
    );

    const nodeById = useMemo(() => {
        const map = new Map<string, NeuralNode>();
        entity.nodes.forEach(n => map.set(n.id, n));
        return map;
    }, [entity]);

    const copyPath = async (path: string) => {
        try {
            await navigator.clipboard.writeText(path);
            setPathCopied(true);
            setTimeout(() => setPathCopied(false), 1800);
        } catch { /* brak clipboard API */ }
    };

    return (
        <div
            className="rounded-xl overflow-hidden font-mono"
            style={{
                background: 'rgba(2, 4, 10, 0.97)',
                border:     `1px solid ${entity.theme}33`,
                boxShadow:  `0 0 24px ${entity.theme}11`,
            }}
        >
            {/* ── Nagłówek + selektor bytu ── */}
            <div
                className="flex items-center justify-between px-4 py-2.5 flex-wrap gap-2"
                style={{ borderBottom: `1px solid ${entity.theme}26`, background: 'rgba(0,2,8,0.9)' }}
            >
                <span
                    className="text-[10px] font-bold tracking-[0.2em] uppercase"
                    style={{ color: entity.theme, textShadow: `0 0 8px ${entity.theme}66` }}
                >
                    🧠 SIEĆ NEURONOWA · {entity.icon} {entity.name}
                </span>

                <select
                    value={entityId}
                    onChange={e => { setEntityId(e.target.value); setSelected(null); }}
                    className="text-[9px] font-mono px-2 py-1 rounded outline-none cursor-pointer"
                    style={{
                        background: 'rgba(0,8,20,0.9)',
                        border:     `1px solid ${entity.theme}40`,
                        color:      entity.theme,
                    }}
                >
                    {ENTITY_REGISTRY.map(e => (
                        <option key={e.id} value={e.id}>{e.icon} {e.name}</option>
                    ))}
                </select>
            </div>

            {/* ── Graf SVG ── */}
            <div className="relative">
                <svg viewBox="0 0 800 340" className="w-full" style={{ minHeight: '260px' }}>
                    <defs>
                        <marker id={`arrow-${entity.id}`} viewBox="0 0 10 10" refX="9" refY="5"
                            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill={entity.theme} opacity="0.5" />
                        </marker>
                    </defs>

                    {/* Krawędzie + pulsy danych */}
                    {entity.edges.map((edge, i) => {
                        const a = nodeById.get(edge.from);
                        const b = nodeById.get(edge.to);
                        if (!a || !b) return null;
                        const midX = (a.x + b.x) / 2;
                        const midY = (a.y + b.y) / 2;
                        return (
                            <g key={`${edge.from}-${edge.to}`}>
                                <line
                                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                    stroke={entity.theme}
                                    strokeOpacity={edge.dashed ? 0.25 : 0.35}
                                    strokeWidth="1.2"
                                    strokeDasharray={edge.dashed ? '5 4' : undefined}
                                    markerEnd={`url(#arrow-${entity.id})`}
                                />
                                {/* Puls neuronu wędrujący po krawędzi */}
                                <circle r="2.6" fill={entity.theme}>
                                    <animateMotion
                                        dur={`${2.2 + (i % 3) * 0.7}s`}
                                        repeatCount="indefinite"
                                        path={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                                    />
                                    <animate attributeName="opacity" values="0;0.9;0.9;0" dur={`${2.2 + (i % 3) * 0.7}s`} repeatCount="indefinite" />
                                </circle>
                                {edge.label && (
                                    <text x={midX} y={midY - 6} textAnchor="middle"
                                        fontSize="8" fill={entity.theme} opacity="0.45" fontFamily="monospace">
                                        {edge.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Węzły */}
                    {entity.nodes.map(node => {
                        const isActive   = activeNodeIds.includes(node.id);
                        const isSelected = selectedNode?.id === node.id;
                        return (
                            <g
                                key={node.id}
                                onClick={() => setSelected(isSelected ? null : node)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Aura aktywności */}
                                {(isActive || isSelected) && (
                                    <circle cx={node.x} cy={node.y} r="30" fill={entity.theme} opacity="0.1">
                                        <animate attributeName="r" values="26;34;26" dur="1.8s" repeatCount="indefinite" />
                                    </circle>
                                )}
                                <circle
                                    cx={node.x} cy={node.y} r="22"
                                    fill="rgba(0,4,12,0.95)"
                                    stroke={isSelected ? '#fff' : entity.theme}
                                    strokeWidth={isSelected ? 2 : 1.2}
                                    strokeOpacity={isSelected ? 0.9 : 0.6}
                                />
                                <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="16">
                                    {node.icon}
                                </text>
                                <text
                                    x={node.x} y={node.y + 38} textAnchor="middle"
                                    fontSize="9" fontFamily="monospace"
                                    fill={isSelected ? '#fff' : entity.theme}
                                    opacity={isSelected ? 1 : 0.7}
                                >
                                    {node.label}
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {/* ── Panel szczegółów węzła ── */}
                <AnimatePresence>
                    {selectedNode && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-2 left-2 right-2 rounded-lg px-3 py-2.5"
                            style={{
                                background: 'rgba(0, 4, 14, 0.96)',
                                border:     `1px solid ${entity.theme}55`,
                                boxShadow:  `0 0 16px ${entity.theme}22`,
                            }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold" style={{ color: entity.theme }}>
                                        {selectedNode.icon} {selectedNode.label}
                                    </p>
                                    <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                                        {selectedNode.desc}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
                                        <span className="text-[8px] shrink-0 uppercase tracking-wider" style={{ color: `${entity.theme}99` }}>
                                            WĘZEŁ DANYCH:
                                        </span>
                                        <code
                                            className="text-[9px] truncate px-1.5 py-0.5 rounded"
                                            style={{ background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}
                                            title={selectedNode.dataPath}
                                        >
                                            {selectedNode.dataPath}
                                        </code>
                                        <button
                                            onClick={() => copyPath(selectedNode.dataPath)}
                                            className="text-[9px] shrink-0 px-2 py-0.5 rounded transition-all"
                                            style={{
                                                border: `1px solid ${entity.theme}55`,
                                                color:  pathCopied ? '#4ade80' : entity.theme,
                                                background: pathCopied ? 'rgba(74,222,128,0.1)' : 'transparent',
                                            }}
                                        >
                                            {pathCopied ? '✓ skopiowano' : '⎘ kopiuj'}
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelected(null)}
                                    className="text-slate-600 hover:text-slate-300 text-xs shrink-0"
                                >
                                    ✕
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Stopka ── */}
            <div
                className="text-[7px] text-center py-1 tracking-[0.2em] uppercase"
                style={{ color: `${entity.theme}55`, background: 'rgba(0,2,6,0.9)', borderTop: `1px solid ${entity.theme}1a` }}
            >
                {entity.nodes.length} neuronów · {entity.edges.length} synaps · kliknij węzeł aby zobaczyć ścieżkę danych
            </div>
        </div>
    );
};

export default NeuralFlowPreview;
