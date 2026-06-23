/**
 * 💰 WalletConnect — read-only agregator portfeli zewnętrznych (MetaMask/Ledger).
 *
 * Podejście NAJPROSTSZE i suwerenne:
 *   • MetaMask (window.ethereum) → adres, bez kluczy/podpisów (read-only).
 *   • Ledger → podłączasz PRZEZ MetaMask (pojawia się jako konto). Bez osobnej integracji.
 *   • Ręczny adres 0x... → śledzenie bez łączenia portfela.
 * Most (/api/wallet/portfolio) liczy saldo natywne (ETH/MATIC/BNB) × cena → suma.
 * Tokeny ERC-20 = przyszłość (opcjonalny klucz w Skarbcu). Dane do Teda/Kronosa.
 */

import React, { useState, useCallback } from 'react';

const BRIDGE = 'http://127.0.0.1:3001';

interface Asset { chain: string; name: string; symbol: string; balance: number; price: number; value: number; }

export const WalletConnect: React.FC = () => {
    const [addresses, setAddresses] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('teo_wallet_addrs') || '[]'); } catch { return []; }
    });
    const [manual, setManual] = useState('');
    const [assets, setAssets] = useState<Asset[] | null>(null);
    const [total, setTotal] = useState(0);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');

    const persist = (a: string[]) => { setAddresses(a); localStorage.setItem('teo_wallet_addrs', JSON.stringify(a)); };
    const addAddr = (a: string) => { const x = a.trim(); if (/^0x[a-fA-F0-9]{40}$/.test(x) && !addresses.includes(x)) persist([...addresses, x]); };

    const connectMetaMask = useCallback(async () => {
        const eth = (window as any).ethereum;
        if (!eth) { setStatus('⚠ Brak MetaMask. Zainstaluj rozszerzenie (Ledger podłącz przez MetaMask).'); return; }
        try {
            const accs: string[] = await eth.request({ method: 'eth_requestAccounts' });
            const merged = Array.from(new Set([...addresses, ...accs.map(a => a.toLowerCase())]));
            persist(merged);
            setStatus(`✅ MetaMask: ${accs.length} kont podłączonych`);
        } catch (e: any) { setStatus(`⚠ MetaMask: ${e.message || 'odrzucono'}`); }
    }, [addresses]);

    const refresh = useCallback(async () => {
        if (!addresses.length) { setStatus('⚠ Dodaj adres lub połącz MetaMask'); return; }
        setBusy(true); setStatus('🔄 Pobieram salda (RPC + ceny)...');
        try {
            const r = await fetch(`${BRIDGE}/api/wallet/portfolio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addresses, vs: 'eur' }) });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'błąd');
            setAssets(d.assets); setTotal(d.total);
            setStatus(d.assets.length ? `✅ Zaktualizowano · ${new Date().toLocaleTimeString('pl-PL')}` : (d.note || 'Brak salda natywnego.'));
        } catch (e: any) { setStatus(`⚠ ${e.message} — uruchom Wiesio-Bridge (:3001)`); }
        finally { setBusy(false); }
    }, [addresses]);

    const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
    const fEUR = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

    return (
        <div className="rounded-xl border border-emerald-500/20 bg-[#04080c]/80 p-4 font-mono">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-[10px] tracking-widest text-emerald-500/60">∴ PORTFEL ZEWNĘTRZNY (READ-ONLY) ∴</div>
                    <div className="text-sm font-bold text-emerald-300">💰 MetaMask / Ledger — zbiorcza zasobność</div>
                </div>
                {assets && <div className="text-right"><div className="text-[9px] text-zinc-500">SUMA</div><div className="text-lg font-bold text-white">{fEUR(total)}</div></div>}
            </div>

            <div className="flex gap-2 flex-wrap mb-2">
                <button onClick={connectMetaMask} className="px-3 py-1.5 rounded border border-amber-500/50 bg-amber-950/30 text-amber-300 text-[11px] font-bold hover:bg-amber-900/40">🦊 Połącz MetaMask</button>
                <button onClick={refresh} disabled={busy} className="px-3 py-1.5 rounded border border-emerald-500/50 bg-emerald-950/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-900/40 disabled:opacity-50">{busy ? '⟳...' : '🔄 Odśwież salda'}</button>
            </div>
            <div className="flex gap-2 mb-3">
                <input value={manual} onChange={e => setManual(e.target.value)} placeholder="lub wklej adres 0x..."
                    className="flex-1 bg-black/40 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-emerald-500" />
                <button onClick={() => { addAddr(manual); setManual(''); }} className="px-3 rounded border border-zinc-600 text-zinc-300 text-[11px] hover:border-emerald-500">+ Dodaj</button>
            </div>

            {addresses.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {addresses.map(a => (
                        <span key={a} className="px-2 py-0.5 rounded-full bg-black/40 border border-zinc-700 text-[10px] text-zinc-300 flex items-center gap-1">
                            {short(a)}
                            <button onClick={() => persist(addresses.filter(x => x !== a))} className="text-rose-400 hover:text-rose-300">×</button>
                        </span>
                    ))}
                </div>
            )}

            {assets && assets.length > 0 && (
                <div className="space-y-1.5">
                    {assets.map(a => (
                        <div key={a.chain} className="flex items-center justify-between bg-black/30 rounded px-3 py-1.5 text-[12px]">
                            <span className="text-zinc-200 font-bold">{a.symbol} <span className="text-zinc-500 font-normal text-[10px]">{a.name}</span></span>
                            <span className="text-zinc-400">{a.balance.toFixed(4)}</span>
                            <span className="text-emerald-400 font-bold">{fEUR(a.value)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="text-[9px] text-zinc-500 mt-3 leading-relaxed">
                🔒 Read-only (tylko adres, zero kluczy/podpisów). Ledger → przez MetaMask. Saldo natywne + cena CoinGecko;
                tokeny ERC-20 = z kluczem API w Skarbcu (wkrótce). Dane zasilą Teda + Kronosa.
            </div>
            {status && <div className="text-[10px] text-zinc-400 mt-2">{status}</div>}
        </div>
    );
};

export default WalletConnect;
