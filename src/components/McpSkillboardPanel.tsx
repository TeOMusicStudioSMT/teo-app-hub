/**
 * 🎛️ McpSkillboardPanel.tsx
 *
 * Centralny Moduł MCP SKILLBOARD w Głównym Hubie Katedry OtakOS (0.00G Cyber-Minimalizm).
 * Łączy Kolektyw Agentów Katedry (Klaudiusz, Bob, Ostry, Mechanik, Archiwista, Wezyr)
 * z katalogiem MCPMarket i Mostem wiesio-bridge (127.0.0.1:3001/api/mcp/*).
 *
 * @author Maestro 0.00G & TeO Collective
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    McpSkill,
    McpCategory,
    AgentProfile,
    BridgeMcpStatus,
    mcpMarketService,
    AGENTS_COLLECTIVE
} from '../services/mcpMarketService';
import { toast } from 'react-hot-toast';
import {
    Terminal,
    Search,
    RefreshCw,
    Plus,
    CheckCircle2,
    XCircle,
    Activity,
    ExternalLink,
    Play,
    Radio,
    Shield,
    Database,
    GitBranch,
    FolderKanban,
    Globe,
    Cpu,
    Zap,
    X,
    Users,
    Sliders,
    Sparkles
} from 'lucide-react';

interface McpSkillboardPanelProps {
    onClose?: () => void;
    embedded?: boolean;
}

const CATEGORIES: { id: McpCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'all',       label: 'Wszystkie Skille',     icon: <Sparkles className="w-4 h-4" />,      color: 'from-cyan-500 to-blue-600' },
    { id: 'databases', label: 'Bazy Danych',          icon: <Database className="w-4 h-4" />,      color: 'from-sky-500 to-cyan-700' },
    { id: 'devops',    label: 'DevOps & Git',         icon: <GitBranch className="w-4 h-4" />,     color: 'from-purple-500 to-indigo-700' },
    { id: 'system',    label: 'System & Pliki',       icon: <FolderKanban className="w-4 h-4" />,  color: 'from-emerald-500 to-teal-700' },
    { id: 'scraping',  label: 'Web Scraping & Search',icon: <Globe className="w-4 h-4" />,         color: 'from-orange-500 to-amber-700' },
    { id: 'ai_media',  label: 'AI & Media',           icon: <Cpu className="w-4 h-4" />,           color: 'from-fuchsia-500 to-pink-700' },
];

export const McpSkillboardPanel: React.FC<McpSkillboardPanelProps> = ({ onClose, embedded = false }) => {
    const [skills, setSkills] = useState<McpSkill[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<McpCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAgentFilter, setSelectedAgentFilter] = useState<string | null>(null);
    const [bridgeStatus, setBridgeStatus] = useState<BridgeMcpStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Test Runner Drawer State
    const [activeTestSkill, setActiveTestSkill] = useState<McpSkill | null>(null);
    const [selectedToolName, setSelectedToolName] = useState<string>('');
    const [toolArgsJson, setToolArgsJson] = useState<string>('{}');
    const [isExecutingTool, setIsExecutingTool] = useState(false);
    const [toolExecutionOutput, setToolExecutionOutput] = useState<any | null>(null);

    // Add Custom MCP Modal State
    const [showAddCustomModal, setShowAddCustomModal] = useState(false);
    const [customForm, setCustomForm] = useState({
        name: '',
        category: 'system' as McpCategory,
        command: '',
        description: '',
        tags: 'custom, mcp',
        assignedAgents: ['klaudiusz']
    });

    // Inicjalizacja i pobranie danych
    const loadSkillsAndStatus = async () => {
        try {
            const [fetchedSkills, status] = await Promise.all([
                mcpMarketService.getSkills(selectedCategory, searchQuery),
                mcpMarketService.getBridgeStatus()
            ]);
            setSkills(fetchedSkills);
            setBridgeStatus(status);
        } catch (err) {
            console.error('[McpSkillboard] Błąd ładowania danych:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadSkillsAndStatus();
    }, [selectedCategory]);

    // Odświeżanie
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await mcpMarketService.syncFromMCPMarket();
        await loadSkillsAndStatus();
        toast.success('Zsynchronizowano rejestr MCP z Mostem!', {
            icon: '⚡',
            style: { background: '#090a0f', color: '#22d3ee', border: '1px solid #0891b2' }
        });
    };

    // Aktywacja 1-Click
    const handleActivateSkill = async (skill: McpSkill) => {
        const toastId = toast.loading(`Aktywuję ${skill.name} w Moście...`);
        try {
            const res = await mcpMarketService.activateSkill(skill.id);
            if (res.success) {
                toast.success(res.message, { id: toastId, icon: '⚡' });
                await loadSkillsAndStatus();
            } else {
                toast.error(res.message || 'Nie udało się aktywować skilla', { id: toastId });
            }
        } catch (e: any) {
            toast.error(`Błąd: ${e.message}`, { id: toastId });
        }
    };

    // Deaktywacja
    const handleDeactivateSkill = async (skill: McpSkill) => {
        try {
            const res = await mcpMarketService.deactivateSkill(skill.id);
            if (res.success) {
                toast(`Skill [${skill.name}] odłączony`, { icon: '🔌' });
                await loadSkillsAndStatus();
            }
        } catch (e: any) {
            toast.error('Błąd deaktywacji');
        }
    };

    // Przypinanie/Odpinanie Agenta
    const handleToggleAgentAssignment = async (skill: McpSkill, agentId: string) => {
        const isAssigned = (skill.assignedAgents || []).includes(agentId);
        const res = await mcpMarketService.assignAgent(skill.id, agentId, !isAssigned);
        if (res.success) {
            const agentName = AGENTS_COLLECTIVE.find(a => a.id === agentId)?.name || agentId;
            toast.success(`${agentName} ${!isAssigned ? 'podpięty pod' : 'odpięty od'} ${skill.name}`, {
                icon: !isAssigned ? '🤖' : '🔌',
                style: { background: '#0f172a', color: '#38bdf8', border: '1px solid #0284c7' }
            });
            await loadSkillsAndStatus();
        }
    };

    // Otwórz Test Runner
    const handleOpenTestRunner = (skill: McpSkill) => {
        setActiveTestSkill(skill);
        const firstTool = skill.tools[0]?.name || '';
        setSelectedToolName(firstTool);
        const defaultArgs: Record<string, any> = {};
        if (skill.tools[0]?.inputSchema?.properties) {
            Object.keys(skill.tools[0].inputSchema.properties).forEach(k => {
                defaultArgs[k] = k.includes('path') ? '.' : k.includes('query') ? 'test' : '';
            });
        }
        setToolArgsJson(JSON.stringify(defaultArgs, null, 2));
        setToolExecutionOutput(null);
    };

    // Uruchomienie narzędzia
    const handleExecuteTool = async () => {
        if (!activeTestSkill || !selectedToolName) return;
        setIsExecutingTool(true);
        try {
            let parsedArgs = {};
            try {
                parsedArgs = JSON.parse(toolArgsJson);
            } catch (jsonErr) {
                toast.error('Nieprawidłowy format JSON argumentów');
                setIsExecutingTool(false);
                return;
            }

            const result = await mcpMarketService.executeTool(activeTestSkill.id, selectedToolName, parsedArgs);
            setToolExecutionOutput(result);
            if (result.success) {
                toast.success(`Narzędzie [${selectedToolName}] wykonane w ${result.durationMs}ms!`, { icon: '✨' });
            } else {
                toast.error(`Błąd wykonania: ${result.error}`);
            }
        } catch (e: any) {
            toast.error(`Błąd: ${e.message}`);
        } finally {
            setIsExecutingTool(false);
        }
    };

    // Dodawanie własnego serwera MCP
    const handleCreateCustomSkill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customForm.name || !customForm.command) {
            toast.error('Wypełnij nazwę i komendę serwera MCP');
            return;
        }

        const tagsArray = customForm.tags.split(',').map(t => t.trim()).filter(Boolean);
        const res = await mcpMarketService.addCustomSkill({
            name: customForm.name,
            category: (customForm.category === 'all' ? 'system' : customForm.category) as any,
            command: customForm.command,
            description: customForm.description || 'Własny serwer MCP zintegrowany przez Suwerena.',
            tags: tagsArray,
            assignedAgents: customForm.assignedAgents,
            tools: [
                {
                    name: 'execute',
                    description: 'Domyślna komenda wykonawcza własnego serwera MCP.',
                    inputSchema: { type: 'object', properties: {} }
                }
            ]
        });

        if (res.success) {
            toast.success(`Własny skill [${res.skill.name}] dodany do Mostu!`, { icon: '🚀' });
            setShowAddCustomModal(false);
            setCustomForm({
                name: '',
                category: 'system',
                command: '',
                description: '',
                tags: 'custom, mcp',
                assignedAgents: ['klaudiusz']
            });
            await loadSkillsAndStatus();
        }
    };

    // Przefiltrowane skille
    const filteredSkills = useMemo(() => {
        return skills.filter(skill => {
            const matchesCat = selectedCategory === 'all' || skill.category === selectedCategory;
            const matchesSearch = searchQuery.trim() === '' ||
                skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
                skill.tools.some(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesAgent = !selectedAgentFilter || (skill.assignedAgents || []).includes(selectedAgentFilter);

            return matchesCat && matchesSearch && matchesAgent;
        });
    }, [skills, selectedCategory, searchQuery, selectedAgentFilter]);

    const activeSkillsCount = skills.filter(s => s.status === 'active').length;

    return (
        <div className={`relative w-full ${embedded ? 'min-h-[600px]' : 'min-h-screen'} bg-slate-950/80 backdrop-blur-2xl text-slate-100 p-4 md:p-8 rounded-3xl border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col gap-6`}>
            {/* 🌌 Cyber Background Matrix Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-purple-950/20 pointer-events-none rounded-3xl" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* ── NAGŁÓWEK GŁÓWNY & STATUS MOSTU ─────────────────────────────── */}
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-cyan-500/20">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center">
                        <div className="w-full h-full bg-slate-950/90 rounded-[14px] flex items-center justify-center text-cyan-400">
                            <Zap className="w-7 h-7 animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-black tracking-wider uppercase bg-gradient-to-r from-cyan-300 via-blue-200 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                                MCP SKILLBOARD
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                                0.00G PROTOCOL
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-slate-400 mt-1 flex items-center gap-2">
                            <span>Centralny Rejestr Model Context Protocol</span>
                            <span>•</span>
                            <span className="text-cyan-400 font-semibold">Kolektyw Katedry OtakOS</span>
                        </p>
                    </div>
                </div>

                {/* Status Bridge Pill & Akcje */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Wskaźnik Mostu */}
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/80 border border-cyan-500/30 backdrop-blur-md shadow-inner">
                        <div className={`w-2.5 h-2.5 rounded-full ${bridgeStatus?.online ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'} animate-pulse`} />
                        <div className="text-xs">
                            <span className="font-semibold text-slate-200">
                                {bridgeStatus?.online ? 'WIESIO-BRIDGE ONLINE' : 'TRYB SUWERENNY'}
                            </span>
                            <span className="text-slate-400 ml-1.5 text-[11px]">(127.0.0.1:3001)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                            {activeSkillsCount}/{skills.length} AKTYWNYCH
                        </span>
                    </div>

                    {/* Przycisk Odśwież */}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        title="Zsynchronizuj z MCPMarket"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Przycisk Dodaj Własny */}
                    <button
                        onClick={() => setShowAddCustomModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>DODAJ MCP</span>
                    </button>

                    {/* Zamknij jeśli modal */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/50 border border-slate-700 text-slate-400 hover:text-rose-300 transition-all"
                            title="Zamknij Panel"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── PAS AGENTÓW KATEDRY (PODPIĘCIA & FILTRY) ────────────────────── */}
            <div className="relative z-10 flex flex-col gap-2.5 p-4 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span className="uppercase tracking-wider">Status Kolektywu Agentów (Kliknij, aby przefiltrować skille Agenta):</span>
                    </div>
                    {selectedAgentFilter && (
                        <button
                            onClick={() => setSelectedAgentFilter(null)}
                            className="text-cyan-400 hover:text-cyan-200 underline font-mono text-[11px]"
                        >
                            ✕ Wyczyść filtr agenta
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {AGENTS_COLLECTIVE.map(agent => {
                        const isSelected = selectedAgentFilter === agent.id;
                        const agentSkillCount = skills.filter(s => (s.assignedAgents || []).includes(agent.id) && s.status === 'active').length;

                        return (
                            <button
                                key={agent.id}
                                onClick={() => setSelectedAgentFilter(isSelected ? null : agent.id)}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-102'
                                        : 'bg-slate-900/60 border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-800/40'
                                }`}
                            >
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center text-lg shadow-md shrink-0`}>
                                    {agent.avatar}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-200 truncate">{agent.name}</div>
                                    <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                                        <Zap className="w-2.5 h-2.5" />
                                        <span>{agentSkillCount} skilli MCP</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── BELKA WYSZUKIWANIA I KRAINY SKILLI ──────────────────────────── */}
            <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Zakładki Krain */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
                    {CATEGORIES.map(cat => {
                        const isActive = selectedCategory === cat.id;
                        const count = cat.id === 'all' ? skills.length : skills.filter(s => s.category === cat.id).length;

                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-gradient-to-r ' + cat.color + ' text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                            >
                                {cat.icon}
                                <span>{cat.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${isActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Pole Wyszukiwania */}
                <div className="relative min-w-[240px] md:w-72">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Szukaj skilla, narzędzia, tagu..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900/80 border border-slate-800 focus:border-cyan-500/60 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all shadow-inner"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* ── KATALOG SKILLI (GRID KART 0.00G) ────────────────────────────── */}
            <div className="relative z-10">
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-4 text-cyan-400">
                        <RefreshCw className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-mono tracking-widest uppercase">Inicjalizacja Węzłów MCP...</span>
                    </div>
                ) : filteredSkills.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 border border-dashed border-slate-800 rounded-3xl">
                        <Radio className="w-10 h-10 stroke-1 text-slate-600" />
                        <p className="text-sm font-semibold">Brak skilli MCP spełniających kryteria filtrowania.</p>
                        <button
                            onClick={() => { setSelectedCategory('all'); setSearchQuery(''); setSelectedAgentFilter(null); }}
                            className="text-xs text-cyan-400 hover:underline"
                        >
                            Zresetuj filtry
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredSkills.map(skill => {
                            const isActive = skill.status === 'active';
                            const isInstalling = skill.status === 'installing';

                            return (
                                <motion.div
                                    key={skill.id}
                                    layout
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 group ${
                                        isActive
                                            ? 'bg-slate-900/70 border-cyan-500/30 hover:border-cyan-400 shadow-[0_4px_25px_rgba(6,182,212,0.12)]'
                                            : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 opacity-90'
                                    }`}
                                >
                                    {/* Górny pasek karty: Ikona, Nazwa, Wersja, Status */}
                                    <div>
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                                                    {skill.icon}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors">
                                                        {skill.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-mono text-slate-400">v{skill.version}</span>
                                                        <span className="text-slate-600">•</span>
                                                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{skill.author}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border flex items-center gap-1.5 shrink-0 ${
                                                isActive
                                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                    : isInstalling
                                                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 animate-pulse'
                                                    : 'bg-slate-800/60 text-slate-400 border-slate-700'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : isInstalling ? 'bg-amber-400' : 'bg-slate-500'}`} />
                                                <span>{isActive ? 'W MOŚCIE' : isInstalling ? 'INSTALACJA' : 'UŚPIONY'}</span>
                                            </div>
                                        </div>

                                        {/* Opis skilla */}
                                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">
                                            {skill.description}
                                        </p>

                                        {/* Narzędzia (Tools) udostępniane przez MCP */}
                                        <div className="mb-4">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                                                <Terminal className="w-3 h-3 text-cyan-400" />
                                                <span>Dostępne Narzędzia MCP ({skill.tools.length}):</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
                                                {skill.tools.map(tool => (
                                                    <span
                                                        key={tool.name}
                                                        className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-cyan-900/50 text-[10px] font-mono truncate max-w-[180px]"
                                                        title={tool.description}
                                                    >
                                                        ⚙️ {tool.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Podpięci Agenci Katedry */}
                                        <div className="mb-4 pt-2 border-t border-slate-800/60">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                                                <span>Podpięci Agenci:</span>
                                                <span className="text-[10px] text-cyan-400 font-mono">{(skill.assignedAgents || []).length} / 6</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {AGENTS_COLLECTIVE.map(agent => {
                                                    const isAssigned = (skill.assignedAgents || []).includes(agent.id);

                                                    return (
                                                        <button
                                                            key={agent.id}
                                                            onClick={() => handleToggleAgentAssignment(skill, agent.id)}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                                                                isAssigned
                                                                    ? 'bg-slate-800 border-cyan-500/50 text-slate-200 shadow-sm'
                                                                    : 'bg-slate-950/40 border-slate-800 text-slate-600 hover:text-slate-400 hover:border-slate-700'
                                                            }`}
                                                            title={isAssigned ? `Odłącz ${agent.name}` : `Podłącz ${agent.name}`}
                                                        >
                                                            <span>{agent.avatar}</span>
                                                            <span>{agent.name.split(' ')[0]}</span>
                                                            <span className={`text-[8px] font-mono ${isAssigned ? 'text-emerald-400' : 'text-slate-600'}`}>
                                                                {isAssigned ? '✓' : '+'}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stopka: Przyciski Aktywacji & Testowania */}
                                    <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                                        {isActive ? (
                                            <>
                                                <button
                                                    onClick={() => handleOpenTestRunner(skill)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition-all hover:scale-102 cursor-pointer shadow-sm"
                                                >
                                                    <Play className="w-3.5 h-3.5 fill-cyan-300" />
                                                    <span>TESTUJ</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeactivateSkill(skill)}
                                                    className="py-2 px-3 rounded-xl bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs border border-slate-800 hover:border-rose-700/50 transition-all cursor-pointer"
                                                    title="Odłącz z Mostu"
                                                >
                                                    ODŁĄCZ
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleActivateSkill(skill)}
                                                disabled={isInstalling}
                                                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all hover:scale-102 active:scale-98 disabled:opacity-50 cursor-pointer"
                                            >
                                                <Zap className="w-4 h-4 fill-slate-950" />
                                                <span>⚡ AKTYWUJ SKILL W MOST</span>
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── DRAWER / MODAL: TEST RUNNER NARZĘDZI MCP ─────────────────────── */}
            <AnimatePresence>
                {activeTestSkill && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setActiveTestSkill(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-2xl bg-slate-950 border border-cyan-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.3)] flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
                        >
                            {/* Nagłówek Test Runera */}
                            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{activeTestSkill.icon}</span>
                                    <div>
                                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                            <span>Konsola Wykonawcza: {activeTestSkill.name}</span>
                                            <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-md border border-cyan-800">
                                                0.00G MCP
                                            </span>
                                        </h2>
                                        <p className="text-xs text-slate-400">Wywołaj narzędzie bezpośrednio przez most wiesio-bridge.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveTestSkill(null)}
                                    className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Wybór Narzędzia */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Wybierz Narzędzie (Tool):
                                </label>
                                <select
                                    value={selectedToolName}
                                    onChange={e => {
                                        const name = e.target.value;
                                        setSelectedToolName(name);
                                        const toolObj = activeTestSkill.tools.find(t => t.name === name);
                                        const sampleArgs: Record<string, any> = {};
                                        if (toolObj?.inputSchema?.properties) {
                                            Object.keys(toolObj.inputSchema.properties).forEach(k => {
                                                sampleArgs[k] = k.includes('path') ? '.' : k.includes('query') ? 'test' : '';
                                            });
                                        }
                                        setToolArgsJson(JSON.stringify(sampleArgs, null, 2));
                                    }}
                                    className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono"
                                >
                                    {activeTestSkill.tools.map(t => (
                                        <option key={t.name} value={t.name}>
                                            {t.name} — {t.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Edytor JSON Argumentów */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span className="font-semibold uppercase tracking-wider">Argumenty Narzędzia (JSON):</span>
                                    <span className="font-mono text-[11px] text-cyan-400">Standard MCP ToolCall</span>
                                </div>
                                <textarea
                                    value={toolArgsJson}
                                    onChange={e => setToolArgsJson(e.target.value)}
                                    rows={4}
                                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:outline-none shadow-inner"
                                />
                            </div>

                            {/* Przycisk Uruchomienia */}
                            <button
                                onClick={handleExecuteTool}
                                disabled={isExecutingTool}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                            >
                                {isExecutingTool ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>PRZETWARZANIE W MOŚCIE 0.00G...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-slate-950" />
                                        <span>URUCHOM NARZĘDZIE W MOŚCIE</span>
                                    </>
                                )}
                            </button>

                            {/* Wynik Wykonania (Terminal Output) */}
                            {toolExecutionOutput && (
                                <div className="flex flex-col gap-1.5 mt-2">
                                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                                        <span className="flex items-center gap-1.5 text-emerald-400">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Odpowiedź Mostu ({toolExecutionOutput.durationMs} ms):</span>
                                        </span>
                                        <span className="font-mono text-[10px] text-slate-500">
                                            {new Date().toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <pre className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/20 text-xs font-mono text-cyan-300 overflow-x-auto max-h-48 shadow-inner">
                                        {JSON.stringify(toolExecutionOutput.result || toolExecutionOutput, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MODAL: DODAJ WŁASNY SERWER MCP ──────────────────────────────── */}
            <AnimatePresence>
                {showAddCustomModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowAddCustomModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg bg-slate-950 border border-cyan-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.3)] flex flex-col gap-4"
                        >
                            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-cyan-400" />
                                    <span>Podepnij Własny Serwer MCP</span>
                                </h2>
                                <button
                                    onClick={() => setShowAddCustomModal(false)}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateCustomSkill} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-300">Nazwa Serwera MCP:</label>
                                    <input
                                        type="text"
                                        placeholder="np. Custom Vector Search MCP"
                                        value={customForm.name}
                                        onChange={e => setCustomForm({ ...customForm, name: e.target.value })}
                                        className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-300">Kraina / Kategoria:</label>
                                    <select
                                        value={customForm.category}
                                        onChange={e => setCustomForm({ ...customForm, category: e.target.value as any })}
                                        className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                                    >
                                        <option value="system">System & Pliki</option>
                                        <option value="databases">Bazy Danych</option>
                                        <option value="devops">DevOps & Git</option>
                                        <option value="scraping">Web Scraping & Search</option>
                                        <option value="ai_media">AI & Media</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-300">Komenda Uruchomieniowa (CLI / npx / python):</label>
                                    <input
                                        type="text"
                                        placeholder="np. npx -y @modelcontextprotocol/server-custom"
                                        value={customForm.command}
                                        onChange={e => setCustomForm({ ...customForm, command: e.target.value })}
                                        className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-cyan-500"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-300">Opis:</label>
                                    <textarea
                                        placeholder="Krótki opis przeznaczenia i narzędzi serwera MCP..."
                                        value={customForm.description}
                                        onChange={e => setCustomForm({ ...customForm, description: e.target.value })}
                                        rows={2}
                                        className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
                                >
                                    ZAREJESTRUJ SKILL W MOŚCIE 0.00G
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default McpSkillboardPanel;
