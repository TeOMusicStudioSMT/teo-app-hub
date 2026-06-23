/**
 * ⚖️🔐 GravitonWalletView — Skarbiec Grawitacyjny (GRAVITON)
 *
 * Dopasowane do nowych założeń:
 *   • GENEZA GRV — realne tiery z mostu (/api/grv/genesis): TeO=∞, Mistrz
 *     Arkadiusz=1M, pule Founder/Filar/Herold, nowy węzeł=1000.
 *   • CRYPTO-AGILITY — tryb post-kwantowy (/api/crypto/status, /mode, /selftest):
 *     ML-KEM-768 (Kyber), ML-DSA-65 (Dilithium), AES-256-GCM.
 */

import React, { useState, useEffect, useCallback } from 'react';
import DashboardCard from './DashboardCard';
import { WalletIcon, ShieldCheckIcon, BrainCircuitIcon } from './icons';
import WalletConnect from './WalletConnect';
import { useAtomValue } from 'jotai';
import { walletAtom } from '../store/wallet';
import { cn } from '../lib/helpers';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const BRIDGE = 'http://127.0.0.1:3001';

const tierStyles: Record<string, string> = {
    Low: 'text-slate-400 border-slate-500',
    Medium: 'text-cyan-400 border-cyan-500 shadow-cyan-500/30',
    High: 'text-violet-400 border-violet-500 shadow-violet-500/30',
    Superposition: 'superposition-text border-amber-400 shadow-amber-400/30',
};
const TIER_LABEL: Record<string, string> = { founder: '🏛️ Founder', pillar: '🗿 Filar', herald: '📯 Herold' };
const TIER_COLOR: Record<string, string> = { founder: '#f59e0b', pillar: '#22d3ee', herald: '#a78bfa' };
const MODE_LABEL: Record<string, string> = { classical: 'KLASYCZNY', pqc: 'POST-KWANT', hybrid: 'HYBRYDA' };

interface Genesis { manager: string; newNodeGrv: number; giftPool: number; nodeCount: number; tiers: { tier: string; grv: number; count: number; used: number; left: number }[]; }
interface Crypto { mode: string; modes: string[]; pqcAvailable: boolean; suite: Record<string, any>; library: string; }
interface SelfTest { aes256gcm: boolean; mlkem768: boolean; mldsa65: boolean; allPass: boolean; }

export const GravitonWalletView: React.FC = () => {
    const wallet = useAtomValue(walletAtom);
    const [genesis, setGenesis] = useState<Genesis | null>(null);
    const [crypto, setCrypto] = useState<Crypto | null>(null);
    const [selftest, setSelftest] = useState<SelfTest | null>(null);
    const [busy, setBusy] = useState(false);
    const [offline, setOffline] = useState(false);

    const loadCrypto = useCallback(async () => {
        const r = await fetch(`${BRIDGE}/api/crypto/status`); const d = await r.json();
        if (d.success) setCrypto(d);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const g = await (await fetch(`${BRIDGE}/api/grv/genesis`)).json();
                if (g.success) setGenesis(g);
                await loadCrypto();
            } catch { setOffline(true); }
        })();
    }, [loadCrypto]);

    const switchMode = async (mode: string) => {
        setBusy(true);
        try { await fetch(`${BRIDGE}/api/crypto/mode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }); await loadCrypto(); toast.success(`Tryb krypto: ${MODE_LABEL[mode]}`); }
        catch { toast.error('Most niedostępny'); }
        finally { setBusy(false); }
    };
    const runSelfTest = async () => {
        setBusy(true);
        try { const d = await (await fetch(`${BRIDGE}/api/crypto/selftest`)).json(); setSelftest(d.result); toast[d.result?.allPass ? 'success' : 'error'](d.result?.allPass ? 'Self-test: wszystko OK ⚛️' : 'Self-test: błąd'); }
        catch { toast.error('Most niedostępny'); }
        finally { setBusy(false); }
    };

    const fGRV = (n: number) => n.toLocaleString('pl-PL');

    return (
        <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEWA: Bilans + Crypto-Agility */}
            <div className="lg:col-span-1 flex flex-col gap-4">
                <DashboardCard title="Skarbiec GRV" icon={<WalletIcon />}>
                    <div className="flex flex-col items-center justify-center text-center p-4">
                        <p className="text-sm text-slate-400 uppercase tracking-widest">Tier Częstotliwości</p>
                        <p className={cn('text-2xl font-bold my-2 border-b-2 pb-2', tierStyles[wallet.frequencyTier] || tierStyles.Low)}>{wallet.frequencyTier}</p>
                        <p className="text-sm text-slate-400 uppercase tracking-widest mt-3">Saldo</p>
                        <p className="text-4xl font-bold text-white">{wallet.balance ? parseFloat(wallet.balance).toLocaleString() : '...'} <span className="text-lg text-amber-400">GRV</span></p>
                        {wallet.isGenesisNode && <span className="inline-block mt-2 px-2 py-0.5 bg-amber-900/30 border border-amber-500/50 rounded text-[10px] text-amber-400 uppercase font-bold tracking-wider">Węzeł Genezy</span>}
                    </div>
                </DashboardCard>

                <DashboardCard title="Crypto-Agility" icon={<ShieldCheckIcon />}>
                    <div className="p-3 font-mono text-xs">
                        {!crypto ? <p className="text-slate-500 text-center py-4">{offline ? '⚠ Most offline (:3001)' : 'Ładowanie...'}</p> : (
                            <>
                                <div className="flex gap-1.5 mb-3">
                                    {crypto.modes.map(m => (
                                        <button key={m} onClick={() => switchMode(m)} disabled={busy}
                                            className={cn('flex-1 px-2 py-1 rounded border text-[10px] font-bold transition-colors',
                                                crypto.mode === m ? 'border-emerald-500 text-emerald-300 bg-emerald-950/40' : 'border-slate-700 text-slate-400 hover:border-slate-500')}>
                                            {MODE_LABEL[m]}
                                        </button>
                                    ))}
                                </div>
                                <div className="space-y-1 text-slate-300">
                                    <div className="flex justify-between"><span>KEM:</span><span className="text-cyan-400">{crypto.suite?.pqc?.kem}</span></div>
                                    <div className="flex justify-between"><span>Podpis:</span><span className="text-violet-400">{crypto.suite?.pqc?.sign}</span></div>
                                    <div className="flex justify-between"><span>Symetria:</span><span className="text-emerald-400">AES-256-GCM</span></div>
                                    <div className="flex justify-between"><span>PQC:</span><span className={crypto.pqcAvailable ? 'text-emerald-400' : 'text-rose-400'}>{crypto.pqcAvailable ? 'NIST gotowe ⚛️' : 'brak'}</span></div>
                                </div>
                                <button onClick={runSelfTest} disabled={busy} className="mt-3 w-full px-2 py-1.5 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40 text-[11px] font-bold transition-colors disabled:opacity-50">
                                    {busy ? '⟳ ...' : '🔬 SELF-TEST KRYPTO'}
                                </button>
                                {selftest && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
                                        {[['AES-256-GCM', selftest.aes256gcm], ['ML-KEM-768', selftest.mlkem768], ['ML-DSA-65', selftest.mldsa65], ['RAZEM', selftest.allPass]].map(([k, v]) => (
                                            <div key={k as string} className="flex justify-between bg-black/30 rounded px-2 py-0.5">
                                                <span className="text-slate-400">{k}</span><span className={v ? 'text-emerald-400' : 'text-rose-400'}>{v ? '✓' : '✗'}</span>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </>
                        )}
                    </div>
                </DashboardCard>
            </div>

            {/* PRAWA: Geneza GRV */}
            <div className="lg:col-span-2">
                <DashboardCard title="Geneza GRV — Ekonomia Suwerennych Węzłów" icon={<BrainCircuitIcon />}>
                    <div className="p-4 font-mono text-sm">
                        {!genesis ? <p className="text-slate-500 text-center py-8">{offline ? '⚠ Most niedostępny (:3001) — uruchom Wiesio-Bridge' : 'Ładowanie genezy...'}</p> : (
                            <>
                                <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-3">
                                        <div className="text-[10px] text-amber-400/70 uppercase">Zarządca</div>
                                        <div className="text-xl font-bold text-amber-300">{genesis.manager}</div>
                                        <div className="text-[10px] text-amber-400/60">∞ GRV (dzieli)</div>
                                    </div>
                                    <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-3">
                                        <div className="text-[10px] text-cyan-400/70 uppercase">Pula Obdarowań</div>
                                        <div className="text-xl font-bold text-cyan-300">{fGRV(genesis.giftPool)}</div>
                                        <div className="text-[10px] text-cyan-400/60">GRV</div>
                                    </div>
                                    <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3">
                                        <div className="text-[10px] text-emerald-400/70 uppercase">Nowy Węzeł</div>
                                        <div className="text-xl font-bold text-emerald-300">{fGRV(genesis.newNodeGrv)}</div>
                                        <div className="text-[10px] text-emerald-400/60">GRV na start</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {genesis.tiers.map(t => {
                                        const pct = (t.used / t.count) * 100;
                                        return (
                                            <div key={t.tier}>
                                                <div className="flex justify-between items-center text-xs mb-1">
                                                    <span style={{ color: TIER_COLOR[t.tier] }} className="font-bold">{TIER_LABEL[t.tier] || t.tier}</span>
                                                    <span className="text-slate-400">{fGRV(t.grv)} GRV × {t.count} · <span className="text-slate-300">{t.left} wolnych</span></span>
                                                </div>
                                                <div className="h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: TIER_COLOR[t.tier], opacity: 0.7 }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between text-[11px] text-slate-400">
                                    <span>Węzłów w rejestrze: <span className="text-emerald-400 font-bold">{genesis.nodeCount}</span></span>
                                    <span className="text-slate-500">grv_ledger.json · lokalnie, suwerennie</span>
                                </div>
                            </>
                        )}
                    </div>
                </DashboardCard>
            </div>
            </div>
            <WalletConnect />
        </div>
    );
};
