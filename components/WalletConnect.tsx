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
interface Token extends Asset { kontrakt: string; bezCeny: boolean; }
interface Widocznosc {
    sprawdzonychKontraktow: number;
    znalezionychTokenow: number;
    bezCeny: number;
    problemy: { chain: string; powod: string }[];
    uwaga: string;
}
interface TokenDodatkowy { chain: string; adres: string; }

export const WalletConnect: React.FC = () => {
    const [addresses, setAddresses] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('teo_wallet_addrs') || '[]'); } catch { return []; }
    });
    const [manual, setManual] = useState('');
    const [assets, setAssets] = useState<Asset[] | null>(null);
    const [tokeny, setTokeny] = useState<Token[]>([]);
    const [widocznosc, setWidocznosc] = useState<Widocznosc | null>(null);
    const [total, setTotal] = useState(0);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');

    // Tokeny spoza listy Katedry — bez tego cokolwiek egzotycznego zostaje niewidoczne.
    const [dodatkowe, setDodatkowe] = useState<TokenDodatkowy[]>(() => {
        try { return JSON.parse(localStorage.getItem('teo_wallet_tokeny') || '[]'); } catch { return []; }
    });
    const [nowyToken, setNowyToken] = useState('');
    const [nowySiec, setNowySiec] = useState('eth');

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
        setBusy(true); setStatus('🔄 Pobieram salda natywne i tokeny (RPC + ceny)...');
        try {
            const r = await fetch(`${BRIDGE}/api/wallet/portfolio`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addresses, vs: 'eur', tokenyDodatkowe: dodatkowe }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'błąd');
            setAssets(d.assets); setTokeny(d.tokeny ?? []); setWidocznosc(d.widocznosc ?? null); setTotal(d.total);
            const ile = (d.assets?.length ?? 0) + (d.tokeny?.length ?? 0);
            setStatus(ile ? `✅ ${ile} pozycji · ${new Date().toLocaleTimeString('pl-PL')}` : (d.note || 'Brak salda.'));
        } catch (e: any) { setStatus(`⚠ ${e.message} — uruchom Wiesio-Bridge (:3001)`); }
        finally { setBusy(false); }
    }, [addresses, dodatkowe]);

    const dodajToken = () => {
        const a = nowyToken.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(a)) { setStatus('⚠ Adres kontraktu musi mieć postać 0x… (40 znaków hex).'); return; }
        if (dodatkowe.some(t => t.adres.toLowerCase() === a.toLowerCase() && t.chain === nowySiec)) { setStatus('⚠ Ten token już jest na liście.'); return; }
        const next = [...dodatkowe, { chain: nowySiec, adres: a }];
        setDodatkowe(next); localStorage.setItem('teo_wallet_tokeny', JSON.stringify(next));
        setNowyToken(''); setStatus('✅ Token dodany — kliknij „Odśwież salda".');
    };

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

            {/* 🪙 Tokeny ERC-20 — do 2026-08-13 NIEWIDZIALNE, więc suma była zaniżona. */}
            {tokeny.length > 0 && (
                <div className="space-y-1.5 mt-2">
                    <div className="text-[9px] tracking-widest text-emerald-500/60 mt-3">∴ TOKENY ERC-20 ∴</div>
                    {tokeny.map(t => (
                        <div key={`${t.chain}-${t.kontrakt}`} className="flex items-center justify-between bg-black/30 rounded px-3 py-1.5 text-[12px]">
                            <span className="text-zinc-200 font-bold">
                                {t.symbol} <span className="text-zinc-500 font-normal text-[10px]">{t.name}</span>
                            </span>
                            <span className="text-zinc-400">{t.balance.toLocaleString('pl-PL', { maximumFractionDigits: 4 })}</span>
                            {t.bezCeny
                                ? <span className="text-amber-400/80 text-[10px]">bez notowania</span>
                                : <span className="text-emerald-400 font-bold">{fEUR(t.value)}</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* Uczciwość zasięgu: mówimy, ILE sprawdziliśmy i czego NIE widać. */}
            {widocznosc && (
                <div className={`text-[9px] mt-3 leading-relaxed p-2 rounded border ${widocznosc.problemy.length ? 'text-amber-300/90 border-amber-500/30 bg-amber-950/20' : 'text-zinc-500 border-zinc-700/40'}`}>
                    Sprawdzono {widocznosc.sprawdzonychKontraktow} kontraktów, znaleziono {widocznosc.znalezionychTokenow}.
                    {' '}{widocznosc.uwaga}
                </div>
            )}

            {/* Dołożenie tokenu spoza listy — zamyka lukę „mam coś egzotycznego". */}
            <div className="flex gap-2 mt-2">
                <select value={nowySiec} onChange={e => setNowySiec(e.target.value)}
                    className="bg-black/40 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none">
                    <option value="eth">Ethereum</option>
                    <option value="polygon">Polygon</option>
                    <option value="bsc">BNB Chain</option>
                </select>
                <input value={nowyToken} onChange={e => setNowyToken(e.target.value)} placeholder="adres kontraktu tokenu 0x…"
                    className="flex-1 min-w-0 bg-black/40 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none focus:border-emerald-500" />
                <button onClick={dodajToken} className="px-3 rounded border border-zinc-600 text-zinc-300 text-[10px] hover:border-emerald-500">+ Token</button>
            </div>
            {dodatkowe.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {dodatkowe.map(t => (
                        <span key={`${t.chain}-${t.adres}`} className="px-2 py-0.5 rounded-full bg-black/40 border border-zinc-700 text-[9px] text-zinc-400 flex items-center gap-1">
                            {t.chain}:{short(t.adres)}
                            <button onClick={() => { const n = dodatkowe.filter(x => !(x.adres === t.adres && x.chain === t.chain)); setDodatkowe(n); localStorage.setItem('teo_wallet_tokeny', JSON.stringify(n)); }}
                                className="text-rose-400 hover:text-rose-300">×</button>
                        </span>
                    ))}
                </div>
            )}

            <div className="text-[9px] text-zinc-500 mt-3 leading-relaxed">
                🔒 Read-only — tylko adres, <b>zero kluczy i zero podpisów</b>. Ledger → przez MetaMask.
                Salda natywne i tokeny ERC-20 czytane z publicznych RPC, ceny z CoinGecko. Bez klucza API.
                Dane zasilają Teda i Kronosa. Katedra nie zawiera transakcji.
            </div>
            {status && <div className="text-[10px] text-zinc-400 mt-2">{status}</div>}
        </div>
    );
};

export default WalletConnect;
