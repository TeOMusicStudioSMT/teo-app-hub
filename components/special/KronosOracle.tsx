/**
 * 🔮 KronosOracle — Nasiono Rynkowe
 *
 * Wizualizacja lokalnej projekcji świec K-line (most: /api/kronos/forecast).
 * Pobiera bieżącą cenę + ostatnie zamknięcia z CoinGecko (fallback demo),
 * wysyła do Nasiona Rynkowego w moście i rysuje prognozę + stożek ufności.
 *
 * Zero chmury AI — projekcja liczona lokalnie (Kronos-Seed). Gdy obecny jest
 * pełny model Kronos (Python/Qlib), most może podmienić silnik bez zmian UI.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getWalletPortfolio, WalletAsset } from '../../services/walletPortfolioService';

const BRIDGE = 'http://127.0.0.1:3001';

const ASSETS = [
    { id: 'bitcoin',  symbol: 'BTC', name: 'Bitcoin'  },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'solana',   symbol: 'SOL', name: 'Solana'   },
];

const HORIZONS = [12, 24, 48];

interface Candle { i: number; open: number; high: number; low: number; close: number; up: boolean; }
interface Band   { i: number; upper: number; lower: number; }
interface Forecast {
    model: string; symbol: string; lastPrice: number; predLen: number;
    drift: number; volatility: number; projChangePct: number;
    candles: Candle[]; band: Band[]; verdict: string;
}

const fEUR = (n: number) =>
    n >= 1000 ? n.toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' €'
              : n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const ChartTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload.find((x: any) => x.dataKey === 'close')?.value;
    return (
        <div style={{ background: 'rgba(10,8,18,.97)', border: '1px solid rgba(0,229,255,.4)', borderRadius: 6, padding: '5px 10px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#00e5ff' }}>
            {p != null ? fEUR(Number(p)) : '—'}
        </div>
    );
};

export const KronosOracle: React.FC = () => {
    const [asset, setAsset]     = useState(ASSETS[0]);
    const [horizon, setHorizon] = useState(24);
    const [fc, setFc]           = useState<Forecast | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus]   = useState('');
    const [held, setHeld]       = useState<WalletAsset[]>([]);

    // Realny portfel (MetaMask/Ledger) → prognozuj co faktycznie trzymasz.
    useEffect(() => { getWalletPortfolio().then(p => { if (p) setHeld(p.assets); }); }, []);

    const runHeld = useCallback(async (a: WalletAsset) => {
        setLoading(true); setStatus(`🔮 Prognoza dla ${a.symbol} (z portfela)...`); setFc(null);
        try {
            const r = await fetch(`${BRIDGE}/api/kronos/forecast`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: a.symbol, lastPrice: a.price, predLen: horizon }),
            });
            const out = await r.json();
            if (!out.success) throw new Error(out.message || 'błąd');
            setFc(out);
            setStatus(`✅ ${a.symbol} z Twojego portfela · ${a.balance.toFixed(4)} szt.`);
        } catch (e: any) { setStatus(`⚠ ${e.message}`); }
        finally { setLoading(false); }
    }, [horizon]);

    const run = useCallback(async () => {
        setLoading(true); setStatus('⟳ Pobieram dane rynkowe...'); setFc(null);
        let lastPrice = 0;
        let history: number[] = [];
        // 1) Dane wejściowe z CoinGecko (cena + 30 dni zamknięć) — fallback demo.
        try {
            const r = await fetch(`https://api.coingecko.com/api/v3/coins/${asset.id}/market_chart?vs_currency=eur&days=30&interval=daily`);
            if (!r.ok) throw new Error();
            const d = await r.json();
            history = (d.prices as [number, number][]).map(([, p]) => p);
            lastPrice = history[history.length - 1];
        } catch {
            const base = asset.symbol === 'BTC' ? 58000 : asset.symbol === 'ETH' ? 2800 : 145;
            history = Array.from({ length: 30 }, (_, i) => base * (1 + Math.sin(i * 0.4) * 0.05));
            lastPrice = history[history.length - 1];
            setStatus('⚠ CoinGecko offline — dane demo');
        }
        // 2) Projekcja z mostu (Nasiono Rynkowe).
        try {
            setStatus('🔮 Kronos projektuje sekwencję świecową...');
            const r = await fetch(`${BRIDGE}/api/kronos/forecast`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: asset.symbol, lastPrice, history, predLen: horizon }),
            });
            if (!r.ok) throw new Error('most offline');
            const out = await r.json();
            if (!out.success) throw new Error(out.message || 'błąd projekcji');
            setFc(out);
            setStatus(`✅ Projekcja ${horizon} świec · ${new Date().toLocaleTimeString('pl-PL')}`);
        } catch (e: any) {
            setStatus(`⚠ Most niedostępny (${e.message}) — uruchom Wiesio-Bridge (port 3001)`);
        } finally {
            setLoading(false);
        }
    }, [asset, horizon]);

    // Dane do wykresu: świece + band (stack: base=lower, range=upper-lower).
    const chartData = fc
        ? fc.candles.map((c, idx) => {
            const b = fc.band[idx];
            return {
                t: `+${c.i + 1}`,
                close: c.close,
                bandBase: b.lower,
                bandRange: b.upper - b.lower,
                up: c.up,
            };
        })
        : [];

    const verdictColor = fc?.verdict === 'WZROST' ? '#4ade80' : fc?.verdict === 'SPADEK' ? '#f87171' : '#c9953a';

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(0,229,255,.18)', borderRadius: 12, padding: 14, marginTop: 12 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(0,229,255,.5)' }}>∴ KATEDRA OTAKOS · CENTRUM FINANSOWE ∴</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e8f6ff' }}>🔮 KRONOS ORACLE</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>Nasiono Rynkowe — lokalna projekcja świec K-line (zero chmury)</div>
                </div>
                {fc && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: verdictColor }}>{fc.verdict}</div>
                        <div style={{ fontSize: 11, color: verdictColor }}>{fc.projChangePct >= 0 ? '+' : ''}{fc.projChangePct}% proj.</div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,.3)' }}>vol {(fc.volatility * 100).toFixed(1)}% · drift {(fc.drift * 100).toFixed(2)}%</div>
                    </div>
                )}
            </div>

            {/* Kontrolki */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
                {ASSETS.map(a => (
                    <button key={a.id} onClick={() => setAsset(a)}
                        style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: 'pointer',
                            border: `1px solid ${asset.id === a.id ? 'rgba(0,229,255,.6)' : 'rgba(255,255,255,.1)'}`,
                            background: asset.id === a.id ? 'rgba(0,229,255,.1)' : 'rgba(255,255,255,.03)',
                            color: asset.id === a.id ? '#00e5ff' : 'rgba(232,223,200,.7)' }}>
                        {a.symbol}
                    </button>
                ))}
                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,.12)', margin: '0 4px' }} />
                {HORIZONS.map(h => (
                    <button key={h} onClick={() => setHorizon(h)}
                        style={{ padding: '5px 10px', borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", cursor: 'pointer',
                            border: `1px solid ${horizon === h ? 'rgba(201,149,58,.6)' : 'rgba(255,255,255,.1)'}`,
                            background: horizon === h ? 'rgba(201,149,58,.1)' : 'rgba(255,255,255,.03)',
                            color: horizon === h ? '#f0c060' : 'rgba(232,223,200,.6)' }}>
                        {h} świec
                    </button>
                ))}
                <motion.button whileTap={{ scale: 0.95 }} onClick={run} disabled={loading}
                    style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                        border: '1px solid rgba(0,229,255,.5)', background: 'rgba(0,229,255,.12)', color: '#00e5ff', opacity: loading ? 0.6 : 1 }}>
                    {loading ? '⟳ PROJEKCJA...' : '🔮 PROGNOZUJ'}
                </motion.button>
            </div>

            {/* 💼 Twój portfel (MetaMask/Ledger) — prognozuj co realnie trzymasz */}
            {held.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 9, color: 'rgba(167,139,250,.7)', letterSpacing: '.1em' }}>💼 TWÓJ PORTFEL:</span>
                    {held.map(a => (
                        <button key={a.chain} onClick={() => runHeld(a)} disabled={loading}
                            title={`${a.balance.toFixed(4)} ${a.symbol} · ${a.value.toLocaleString('pl-PL')} €`}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", cursor: loading ? 'default' : 'pointer',
                                border: '1px solid rgba(167,139,250,.4)', background: 'rgba(167,139,250,.1)', color: '#c4b5fd' }}>
                            {a.symbol} · {a.value.toLocaleString('pl-PL')} €
                        </button>
                    ))}
                </div>
            )}

            {/* Wykres */}
            <div style={{ height: 200, background: 'rgba(0,0,0,.25)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', padding: '8px 4px' }}>
                {fc ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                            <defs>
                                <linearGradient id="kband" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"  stopColor="#00e5ff" stopOpacity={0.18} />
                                    <stop offset="100%" stopColor="#00e5ff" stopOpacity={0.04} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="t" tick={{ fontSize: 7, fill: 'rgba(255,255,255,.25)', fontFamily: "'JetBrains Mono',monospace" }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 7, fill: 'rgba(255,255,255,.25)', fontFamily: "'JetBrains Mono',monospace" }} domain={['auto', 'auto']} />
                            <Tooltip content={<ChartTip />} />
                            <ReferenceLine y={fc.lastPrice} stroke="rgba(240,192,96,.5)" strokeDasharray="4 4" />
                            {/* Stożek ufności (stack: niewidzialna baza + wypełniony zakres) */}
                            <Area dataKey="bandBase" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
                            <Area dataKey="bandRange" stackId="b" stroke="none" fill="url(#kband)" isAnimationActive={false} />
                            <Line dataKey="close" stroke="#00e5ff" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#00e5ff' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: 'rgba(0,229,255,.4)' }}>
                        <div style={{ fontSize: 28 }}>🔮</div>
                        <div style={{ fontSize: 11, letterSpacing: '.1em' }}>Wybierz aktyw i horyzont — naciśnij PROGNOZUJ</div>
                    </div>
                )}
            </div>

            {/* Stopka */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,.3)', letterSpacing: '.08em' }}>{status}</div>
                {fc && <div style={{ fontSize: 8, color: 'rgba(0,229,255,.35)' }}>{fc.model}</div>}
            </div>
            {fc && (
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,.25)', marginTop: 6, lineHeight: 1.5 }}>
                    ⚠ Projekcja edukacyjna (Nasiono Rynkowe) — NIE jest poradą inwestycyjną. Linia złota = cena obecna {fEUR(fc.lastPrice)}; cień = stożek ufności 95%.
                </div>
            )}
        </div>
    );
};

export default KronosOracle;
