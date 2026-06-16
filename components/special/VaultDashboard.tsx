/**
 * 🔐 VaultDashboard — Wizualny Kokpit Skarbca 0.00G
 *
 * Grid kart usług (GitHub Bridge, Ollama Ecosystem, Voice Cloning Vector…) z
 * ikonami i pulsującym złoto-szmaragdowym statusem drożności + poziomem
 * bezpieczeństwa. Pod spodem: Menedżer AI & Pralka Świadomości — mapuje pasje
 * Suwerena na przychodowe mikrousługi, bezwzględnie odrzucając iluzje.
 *
 * Dane: Wiesio Bridge (:3001) — /api/vault/status, /api/vault/set, /api/scout/scan.
 * Surowe klucze NIGDY nie wychodzą z backendu — kokpit operuje na maskach.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock, Shield, ShieldCheck, Github, Cpu, Mic, Brain, Sparkles, Key,
    RefreshCw, Check, X, Eye, EyeOff, TrendingUp, AlertTriangle, Zap, Gauge, Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';

const BRIDGE = 'http://127.0.0.1:3001';

interface VaultField  { field: string; configured: boolean; masked: string | null; }
interface VaultStatus {
    id: string; label: string; glyph: string;
    security: 'CRITICAL' | 'HIGH' | 'STANDARD';
    connected: boolean; configuredCount: number; totalFields: number;
    fields: VaultField[]; updatedAt: string | null;
}
interface ScoutTool {
    name: string; service: string; apiNeeded: string; vaultKey?: string;
    automation: string; revenue: string; realityScore: number;
}
interface ScoutRejected { illusion: string; reason: string; }
interface ScoutResult { verdict: string; tools: ScoutTool[]; rejected: ScoutRejected[]; }

const ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
    github_bridge:    Github,
    ollama_ecosystem: Cpu,
    voice_cloning:    Mic,
    apilayer_gateway: Globe,
    anthropic:        Brain,
    gemini:           Sparkles,
};

const SECURITY_BADGE: Record<string, { label: string; cls: string }> = {
    CRITICAL: { label: 'KRYTYCZNY', cls: 'text-rose-300 border-rose-500/40 bg-rose-900/20' },
    HIGH:     { label: 'WYSOKI',    cls: 'text-amber-300 border-amber-500/40 bg-amber-900/20' },
    STANDARD: { label: 'STANDARD',  cls: 'text-slate-300 border-slate-500/40 bg-slate-800/40' },
};

export const VaultDashboard: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [services, setServices] = useState<VaultStatus[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [drafts,   setDrafts]   = useState<Record<string, string>>({});   // `${id}.${field}` → value
    const [reveal,   setReveal]   = useState<Record<string, boolean>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);

    // Pralka Świadomości
    const [profile,  setProfile]  = useState('');
    const [scanning, setScanning] = useState(false);
    const [scan,     setScan]     = useState<ScoutResult | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res  = await fetch(`${BRIDGE}/api/vault/status`);
            const data = await res.json();
            if (data.success) setServices(data.services);
        } catch {
            toast.error('Skarbiec offline — czy Wiesio działa? (:3001)');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const saveSecret = useCallback(async (service: string, field: string) => {
        const k = `${service}.${field}`;
        const value = (drafts[k] || '').trim();
        if (!value) return;
        setSavingKey(k);
        try {
            const res = await fetch(`${BRIDGE}/api/vault/set`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service, field, value }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`🔐 Zapisano ${service}.${field} (zaszyfrowany)`);
                setDrafts(d => ({ ...d, [k]: '' }));
                fetchStatus();
            } else {
                toast.error(data.error || 'Błąd zapisu sekretu');
            }
        } catch {
            toast.error('Skarbiec offline (:3001)');
        } finally {
            setSavingKey(null);
        }
    }, [drafts, fetchStatus]);

    const runScout = useCallback(async () => {
        if (!profile.trim() || scanning) return;
        setScanning(true);
        setScan(null);
        try {
            const res = await fetch(`${BRIDGE}/api/scout/scan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: profile.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setScan({ verdict: data.verdict, tools: data.tools || [], rejected: data.rejected || [] });
                toast.success('🧭 Pralka Świadomości zakończyła analizę');
            } else {
                toast.error(data.error || 'Pralka Świadomości: błąd');
            }
        } catch {
            toast.error('Pralka offline (:3001 / Ollama gemma4)');
        } finally {
            setScanning(false);
        }
    }, [profile, scanning]);

    const connectedCount = services.filter(s => s.connected).length;

    return (
        <div className="w-full max-w-6xl mx-auto h-[88vh] bg-[#04070d] border border-emerald-500/20 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)] flex flex-col font-sans text-slate-200">

            {/* ── HEADER ── */}
            <div className="relative px-6 py-5 border-b border-emerald-500/20 bg-gradient-to-r from-[#0a0f08] via-[#0d0a05] to-[#0a0f08] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="vault-glow w-14 h-14 rounded-2xl bg-black border border-amber-500/40 flex items-center justify-center">
                        <Lock size={26} className="text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-emerald-400">
                            SKARBIEC 0.00G
                        </h2>
                        <p className="text-[11px] text-slate-500 tracking-wider flex items-center gap-2">
                            <ShieldCheck size={12} className="text-emerald-500" />
                            Izolacja lokalna · {connectedCount}/{services.length} usług drożnych · AES-256-GCM
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchStatus} title="Odśwież"
                        className="p-2 rounded-lg text-slate-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 transition-colors">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {onClose && (
                        <button onClick={onClose}
                            className="p-2 rounded-lg text-slate-400 hover:text-white border border-slate-700 transition-colors">
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── SCROLL BODY ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 vault-scroll">

                {/* ── GRID KART USŁUG ── */}
                <section>
                    <h3 className="text-xs font-bold text-slate-500 tracking-[0.25em] uppercase mb-4 flex items-center gap-2">
                        <Key size={13} /> Podpięte Profile i Portfele
                    </h3>

                    {loading ? (
                        <div className="text-center text-slate-600 py-12 text-sm">Otwieram skarbiec...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {services.map(svc => {
                                const Icon  = ICONS[svc.id] || Key;
                                const badge = SECURITY_BADGE[svc.security] || SECURITY_BADGE.STANDARD;
                                return (
                                    <motion.div
                                        key={svc.id}
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className={`relative rounded-2xl p-4 border bg-gradient-to-br from-[#080c12] to-black overflow-hidden
                                            ${svc.connected ? 'vault-card-live border-emerald-500/40' : 'border-slate-700/60'}`}
                                    >
                                        {/* Status dot */}
                                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                            <span className={`text-[8px] tracking-widest font-bold ${svc.connected ? 'text-emerald-400' : 'text-slate-600'}`}>
                                                {svc.connected ? 'DROŻNY' : 'PUSTY'}
                                            </span>
                                            <span className={`w-2 h-2 rounded-full ${svc.connected ? 'vault-dot-live' : 'bg-slate-700'}`} />
                                        </div>

                                        {/* Glyph + tytuł */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border
                                                ${svc.connected ? 'border-emerald-500/40 bg-emerald-900/10' : 'border-slate-700 bg-black'}`}>
                                                <Icon size={20} className={svc.connected ? 'text-emerald-300' : 'text-slate-500'} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-slate-100 truncate">{svc.label}</div>
                                                <span className={`inline-block mt-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded border tracking-wider ${badge.cls}`}>
                                                    <Shield size={8} className="inline mr-0.5 -mt-0.5" />{badge.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Pola (klucze) */}
                                        <div className="space-y-2">
                                            {svc.fields.map(f => {
                                                const k = `${svc.id}.${f.field}`;
                                                return (
                                                    <div key={f.field}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] text-slate-500 font-mono">{f.field}</span>
                                                            {f.configured && (
                                                                <span className="text-[9px] text-emerald-500 font-mono flex items-center gap-1">
                                                                    <Check size={9} /> {f.masked}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type={reveal[k] ? 'text' : 'password'}
                                                                value={drafts[k] || ''}
                                                                onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))}
                                                                placeholder={f.configured ? 'Nadpisz klucz...' : 'Wklej klucz...'}
                                                                className="flex-1 min-w-0 bg-black/60 border border-slate-700 focus:border-amber-500/60 rounded-lg px-2 py-1.5 text-[11px] text-amber-100 outline-none font-mono"
                                                            />
                                                            <button onClick={() => setReveal(r => ({ ...r, [k]: !r[k] }))}
                                                                className="p-1.5 text-slate-500 hover:text-slate-300" title="Pokaż/ukryj">
                                                                {reveal[k] ? <EyeOff size={13} /> : <Eye size={13} />}
                                                            </button>
                                                            <button onClick={() => saveSecret(svc.id, f.field)}
                                                                disabled={savingKey === k || !(drafts[k] || '').trim()}
                                                                className="p-1.5 rounded-lg bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/40 disabled:opacity-30 transition-colors"
                                                                title="Zapisz w skarbcu">
                                                                {savingKey === k ? <RefreshCw size={13} className="animate-spin" /> : <Lock size={13} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ── PRALKA ŚWIADOMOŚCI / MENEDŻER AI ── */}
                <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#0a0703] to-black p-5">
                    <h3 className="text-xs font-bold text-amber-400 tracking-[0.2em] uppercase mb-1 flex items-center gap-2">
                        <Gauge size={14} /> Menedżer AI · Pralka Świadomości
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                        Mapuje Twoje pasje na <span className="text-emerald-400">przychodowe mikrousługi</span>.
                        Bezwzględnie odrzuca iluzje — tylko surowe, techniczne osiągi.
                    </p>

                    <textarea
                        value={profile}
                        onChange={e => setProfile(e.target.value)}
                        placeholder="Opisz swoje pasje, kompetencje, narzędzia (np. produkcja muzyki, klonowanie głosu, automatyzacja, kod TS/React)..."
                        rows={3}
                        className="w-full bg-black/50 border border-slate-700 focus:border-amber-500/60 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none"
                    />
                    <div className="flex justify-end mt-3">
                        <button onClick={runScout} disabled={scanning || !profile.trim()}
                            className="px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-gradient-to-r from-amber-600/70 to-emerald-600/70 hover:from-amber-500 hover:to-emerald-500 text-black border border-amber-400/40 disabled:opacity-40 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            {scanning ? <><RefreshCw size={14} className="animate-spin" /> Pralka wiruje...</> : <><Zap size={14} /> Uruchom Pralkę Świadomości</>}
                        </button>
                    </div>

                    {/* Wyniki skanu */}
                    <AnimatePresence>
                        {scan && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-5 space-y-4 overflow-hidden">
                                {/* Werdykt */}
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                                    <div className="text-[9px] font-bold text-emerald-500 tracking-widest uppercase mb-1">Werdykt Pralki</div>
                                    <div className="text-sm text-emerald-100 font-medium">{scan.verdict}</div>
                                </div>

                                {/* Narzędzia przychodowe */}
                                {scan.tools.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-amber-400 tracking-widest uppercase mb-2 flex items-center gap-1">
                                            <TrendingUp size={12} /> Narzędzia Przychodowe ({scan.tools.length})
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {scan.tools.map((t, i) => (
                                                <div key={i} className="rounded-xl border border-emerald-500/25 bg-black/50 p-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-bold text-emerald-200">{t.name}</span>
                                                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300">
                                                            REALNOŚĆ {t.realityScore}%
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 space-y-0.5">
                                                        <div><span className="text-slate-600">API:</span> {t.service} · {t.apiNeeded}</div>
                                                        <div><span className="text-slate-600">Auto-wdrożenie:</span> {t.automation}</div>
                                                        <div className="text-emerald-400/90"><span className="text-slate-600">Przychód:</span> {t.revenue}</div>
                                                        {t.vaultKey && <div className="text-[9px] text-amber-500/70 font-mono mt-1">🔐 wymaga: {t.vaultKey}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Odrzucone iluzje */}
                                {scan.rejected.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-rose-400 tracking-widest uppercase mb-2 flex items-center gap-1">
                                            <AlertTriangle size={12} /> Odrzucone Iluzje ({scan.rejected.length})
                                        </div>
                                        <div className="space-y-1.5">
                                            {scan.rejected.map((r, i) => (
                                                <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-950/10 px-3 py-2">
                                                    <span className="text-xs text-rose-300 font-medium line-through">{r.illusion}</span>
                                                    <span className="text-[10px] text-slate-500 block">{r.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>

            {/* Pulsacja złoto-szmaragdowa */}
            <style>{`
                @keyframes vaultGlow {
                    0%,100% { box-shadow: 0 0 8px rgba(245,158,11,0.3); border-color: rgba(245,158,11,0.4); }
                    50%     { box-shadow: 0 0 20px rgba(16,185,129,0.5); border-color: rgba(16,185,129,0.7); }
                }
                .vault-glow { animation: vaultGlow 2.6s ease-in-out infinite; }
                @keyframes vaultDot {
                    0%,100% { box-shadow: 0 0 4px rgba(245,158,11,0.6); background: #f59e0b; }
                    50%     { box-shadow: 0 0 10px rgba(16,185,129,0.9); background: #10b981; }
                }
                .vault-dot-live { animation: vaultDot 1.8s ease-in-out infinite; }
                @keyframes vaultCard {
                    0%,100% { box-shadow: inset 0 0 18px rgba(245,158,11,0.05), 0 0 10px rgba(16,185,129,0.06); }
                    50%     { box-shadow: inset 0 0 22px rgba(16,185,129,0.10), 0 0 16px rgba(245,158,11,0.10); }
                }
                .vault-card-live { animation: vaultCard 3.2s ease-in-out infinite; }
                .vault-scroll::-webkit-scrollbar { width: 6px; }
                .vault-scroll::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.2); border-radius: 4px; }
            `}</style>
        </div>
    );
};

export default VaultDashboard;
