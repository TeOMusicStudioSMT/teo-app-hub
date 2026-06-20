/**
 * 📖 KsiegaOdbioru (KOOM) — KsięgOOdbioreM
 *
 * Zbiera plany z Rozczytelni (Podcast Twin), dekoduje je na zadania i wysyła do
 * Mechanika jednym klikiem. Agenci/Suweren zostawiają sugestie; multi-modelowanie
 * (lokalne modele) rozkłada plan na kroki. Rdzeń = ZERO tokenów chmury.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, ScanLine, Hammer, Network, Plus, Check, RefreshCw } from 'lucide-react';
import { KoomService, type KoomPlan, type ModelTake } from '../../src/services/KoomService';
import { toast } from 'react-hot-toast';

const PODCAST_KEY = 'teo_podcast_twin_log';
const KOOM_KEY    = 'teo_koom_plans';

const loadPlans = (): KoomPlan[] => {
    try { const p = JSON.parse(localStorage.getItem(KOOM_KEY) || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
};
const loadConversation = (): Array<{ hostA?: string; hostB?: string }> => {
    try { const m = JSON.parse(localStorage.getItem(PODCAST_KEY) || '{}'); return Array.isArray(m.turns) ? m.turns : []; } catch { return []; }
};

const SOURCE_COLOR: Record<string, string> = { ISKRA: '#f472b6', ECHO: '#22d3ee', SUWEREN: '#fbbf24' };

export const KsiegaOdbioru: React.FC = () => {
    const [plans, setPlans] = useState<KoomPlan[]>(loadPlans);
    const [draft, setDraft] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [takes, setTakes] = useState<Record<string, ModelTake[]>>({});

    useEffect(() => { try { localStorage.setItem(KOOM_KEY, JSON.stringify(plans)); } catch { /* limit */ } }, [plans]);

    const scan = useCallback(() => {
        const turns = loadConversation();
        if (!turns.length) { toast('Brak rozmowy w Rozczytelni — najpierw nagraj odcinek.', { icon: '📖' }); return; }
        const found = KoomService.extractPlans(turns);
        setPlans(prev => {
            const existing = new Set(prev.map(p => p.text.toLowerCase().slice(0, 80)));
            const fresh = found.filter(f => !existing.has(f.text.toLowerCase().slice(0, 80)));
            if (fresh.length === 0) toast('Brak nowych planów (wszystkie już w Księdze).', { icon: '✅' });
            else toast.success(`📖 Zdekodowano ${fresh.length} nowych planów z rozmowy.`);
            return [...fresh, ...prev];
        });
    }, []);

    const addSuggestion = () => {
        const text = draft.trim();
        if (!text) return;
        setPlans(prev => [{ id: `koom-s-${Date.now().toString(36)}`, text, source: 'SUWEREN', status: 'NEW', createdAt: new Date().toISOString() }, ...prev]);
        setDraft('');
    };

    const toMechanik = async (plan: KoomPlan) => {
        setBusyId(plan.id);
        const taskId = await KoomService.sendToMechanik(plan);
        if (taskId) {
            setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: 'QUEUED', taskId } : p));
            toast.success(`⚙️ Plan → Mechanik (${taskId})`);
        } else {
            toast.error('Most/Mechanik niedostępny (:3001).');
        }
        setBusyId(null);
    };

    const multiModel = async (plan: KoomPlan) => {
        setBusyId(plan.id + '-mm');
        toast('🔀 Zwołuję radę lokalnych modeli (darmowe)...', { icon: '🧠' });
        const result = await KoomService.councilAnalyze(plan.text);
        setTakes(prev => ({ ...prev, [plan.id]: result }));
        setBusyId(null);
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-[#0a0705] border border-amber-500/25 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] font-sans text-slate-200">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/20 bg-gradient-to-r from-[#140d03] to-[#0a0705]">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-black border border-amber-500/40 flex items-center justify-center">
                        <BookMarked size={22} className="text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">KSIĘGA ODBIORU · KOOM</h2>
                        <p className="text-[10px] text-slate-500 tracking-wider">Plany z Rozczytelni → zadania Mechanika · {plans.length} w księdze</p>
                    </div>
                </div>
                <button onClick={scan} title="Zdekoduj plany z ostatniej rozmowy (lokalnie, 0 tokenów)"
                    className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-amber-700/60 hover:bg-amber-600 text-black border border-amber-400/40 transition-colors">
                    <ScanLine size={14} /> SKANUJ ROZMOWĘ
                </button>
            </div>

            {/* Dodaj sugestię */}
            <div className="px-6 py-3 flex gap-2 border-b border-slate-800">
                <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSuggestion()}
                    placeholder="Zostaw własną sugestię planu..."
                    className="flex-1 bg-black/50 border border-amber-700/30 focus:border-amber-500/60 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none" />
                <button onClick={addSuggestion} disabled={!draft.trim()}
                    className="px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 disabled:opacity-40">
                    <Plus size={14} />
                </button>
            </div>

            {/* Lista planów */}
            <div className="p-6 max-h-[55vh] overflow-y-auto space-y-2.5">
                {plans.length === 0 ? (
                    <div className="text-center text-slate-600 py-12 text-sm">
                        Księga pusta. Kliknij <span className="text-amber-400">SKANUJ ROZMOWĘ</span>, aby zdekodować plany z Rozczytelni.
                    </div>
                ) : plans.map(plan => (
                    <div key={plan.id} className="rounded-xl border border-amber-900/30 bg-black/30 p-3">
                        <div className="flex items-start gap-2">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                                style={{ color: SOURCE_COLOR[plan.source] || '#94a3b8', border: `1px solid ${SOURCE_COLOR[plan.source] || '#94a3b8'}55` }}>
                                {plan.source}
                            </span>
                            <p className="text-xs text-slate-300 leading-relaxed flex-1">{plan.text}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pl-1">
                            {plan.status === 'QUEUED' ? (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check size={11} /> W kolejce Mechanika ({plan.taskId})</span>
                            ) : (
                                <button onClick={() => toMechanik(plan)} disabled={busyId === plan.id}
                                    className="px-2.5 py-1 text-[10px] rounded-lg bg-emerald-800/50 hover:bg-emerald-700 text-emerald-200 border border-emerald-500/40 flex items-center gap-1 disabled:opacity-40">
                                    {busyId === plan.id ? <RefreshCw size={11} className="animate-spin" /> : <Hammer size={11} />} → MECHANIK
                                </button>
                            )}
                            <button onClick={() => multiModel(plan)} disabled={busyId === plan.id + '-mm'}
                                className="px-2.5 py-1 text-[10px] rounded-lg bg-violet-900/40 hover:bg-violet-800/60 text-violet-300 border border-violet-500/40 flex items-center gap-1 disabled:opacity-40">
                                {busyId === plan.id + '-mm' ? <RefreshCw size={11} className="animate-spin" /> : <Network size={11} />} 🔀 Multi-Model
                            </button>
                        </div>

                        {/* Wyniki rady modeli */}
                        <AnimatePresence>
                            {takes[plan.id] && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 space-y-1.5 overflow-hidden">
                                    {takes[plan.id].map((t, i) => (
                                        <div key={i} className="rounded-lg bg-violet-950/20 border border-violet-500/20 p-2">
                                            <div className="text-[9px] font-mono text-violet-400 mb-0.5">🧠 {t.model}</div>
                                            <div className="text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed">{t.analysis}</div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KsiegaOdbioru;
