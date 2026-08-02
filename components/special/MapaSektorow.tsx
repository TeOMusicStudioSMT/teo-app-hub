/**
 * 🗺️ MapaSektorow — co się z czym rusza.
 *
 * Macierz korelacji liczona z realnych notowań (7 dni godzinowych). W krypto
 * prawie wszystko chodzi za Bitcoinem, więc „portfel z pięciu monet" bywa jedną
 * pozycją w pięciu przebraniach. Ta mapa pokazuje, gdzie dywersyfikacja jest
 * realna, a gdzie pozorna.
 *
 * ⚠️ Statystyka opisowa okna, nie prognoza i nie przyczynowość.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Network, RefreshCw } from 'lucide-react';
import { getBridgeBase } from '../../lib/bridgeService';

interface Aktywo { id: string; symbol: string; nazwa: string; sektor: string; cena: number; zmiana24h: number | null; probek: number }
interface Pominiete { id: string; powod: string }
interface WobecBtc { symbol: string; sektor: string; r: number }
interface Mapa {
    aktywa: Aktywo[]; macierz: (number | null)[][]; wobecBtc: WobecBtc[];
    pominiete: Pominiete[]; probek: number; okno: string; policzonoO: string; disclaimer: string;
}

/** Barwa komórki: silna korelacja = ciepła, słaba/ujemna = chłodna. */
const barwa = (r: number | null): string => {
    if (r === null) return 'rgba(255,255,255,.04)';
    if (r >= 0.85) return 'rgba(248,113,113,.55)';
    if (r >= 0.70) return 'rgba(251,146,60,.45)';
    if (r >= 0.50) return 'rgba(251,191,36,.35)';
    if (r >= 0.25) return 'rgba(163,230,53,.25)';
    if (r >= 0)    return 'rgba(74,222,128,.22)';
    return 'rgba(56,189,248,.35)';
};

export const MapaSektorow: React.FC = () => {
    const [mapa, setMapa]   = useState<Mapa | null>(null);
    const [laduje, setLad]  = useState(false);
    const [blad, setBlad]   = useState<string | null>(null);

    const pobierz = useCallback(async (odswiez = false) => {
        setLad(true); setBlad(null);
        try {
            const r = await fetch(`${getBridgeBase()}/api/rynek/sektory${odswiez ? '?odswiez=1' : ''}`);
            const d = await r.json();
            if (!d.success) throw new Error(d.message || `HTTP ${r.status}`);
            setMapa(d);
        } catch (e: any) {
            setBlad(`Mapa nie doszła do skutku: ${e?.message || e}`);
        } finally { setLad(false); }
    }, []);

    useEffect(() => { pobierz(); }, [pobierz]);

    return (
        <div style={{ background: 'rgba(8,10,18,.6)', border: '1px solid rgba(56,189,248,.18)', borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'rgba(56,189,248,.5)' }}>∴ KATEDRA OTAKOS · CENTRUM FINANSOWE ∴</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e8f6ff', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Network size={16} /> MAPA SEKTORÓW
                    </div>
                    {mapa && (
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>
                            {mapa.aktywa.length} aktywów · {mapa.probek} próbek · {mapa.okno}
                        </div>
                    )}
                </div>
                <button onClick={() => pobierz(true)} disabled={laduje}
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, cursor: laduje ? 'wait' : 'pointer',
                        border: '1px solid rgba(56,189,248,.4)', background: 'rgba(56,189,248,.08)', color: '#7dd3fc',
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                    <RefreshCw size={12} className={laduje ? 'animate-spin' : ''} /> PRZELICZ
                </button>
            </div>

            {/* Granica interpretacyjna — widoczna, nie zakopana */}
            <div style={{ marginTop: 9, padding: '6px 9px', borderRadius: 8, background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.22)' }}>
                <div style={{ fontSize: 8.5, color: '#fcd34d', lineHeight: 1.55 }}>
                    ⚠️ Korelacja mówi, co poruszało się <b>razem w tym oknie</b> — nie że jedno powoduje drugie
                    i nie co będzie dalej. W krypto te zależności potrafią się odwrócić w tydzień.
                </div>
            </div>

            {blad && <div style={{ marginTop: 8, fontSize: 9.5, color: '#fca5a5' }}>{blad}</div>}

            {mapa?.pominiete?.length ? (
                <div style={{ marginTop: 7, fontSize: 8.5, color: 'rgba(252,165,165,.8)' }}>
                    ❌ Pominięte: {mapa.pominiete.map(p => `${p.id} (${p.powod})`).join(' · ')}
                </div>
            ) : null}

            {!mapa && laduje && (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.4)' }}>⟳ Liczę korelacje...</div>
            )}

            {mapa && (
                <>
                    {/* Ranking wobec BTC — najważniejsza pojedyncza liczba w krypto */}
                    <div style={{ marginTop: 11 }}>
                        <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'rgba(56,189,248,.6)', marginBottom: 6 }}>
                            KORELACJA Z BITCOINEM — im niżej, tym bardziej „to samo"
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {mapa.wobecBtc.map(x => (
                                <div key={x.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#e8f6ff', width: 46 }}>{x.symbol}</span>
                                    <div style={{ flex: 1, height: 12, borderRadius: 3, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.max(0, Math.min(1, x.r)) * 100}%`, height: '100%', background: barwa(x.r) }} />
                                    </div>
                                    <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,.65)', width: 40, textAlign: 'right' }}>{x.r.toFixed(2)}</span>
                                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,.3)', width: 74 }}>{x.sektor}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,.32)', marginTop: 6, lineHeight: 1.5 }}>
                            Wysokie wartości = ruch praktycznie razem z BTC; taki „dodatek" do portfela
                            nie rozkłada ryzyka, tylko je zwielokrotnia. Niskie = porusza się własnym rytmem.
                        </div>
                    </div>

                    {/* Macierz */}
                    <div style={{ marginTop: 12, overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 8 }}>
                            <thead>
                                <tr>
                                    <th />
                                    {mapa.aktywa.map(a => (
                                        <th key={a.id} style={{ padding: '2px 3px', color: 'rgba(255,255,255,.45)', fontWeight: 400 }}>{a.symbol}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {mapa.aktywa.map((a, i) => (
                                    <tr key={a.id}>
                                        <td style={{ padding: '2px 5px 2px 0', color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap', textAlign: 'right' }}>{a.symbol}</td>
                                        {mapa.macierz[i].map((r, j) => (
                                            <td key={j} title={`${a.symbol} ↔ ${mapa.aktywa[j].symbol}: ${r ?? 'brak'}`}
                                                style={{ background: barwa(r), textAlign: 'center', padding: '3px 4px',
                                                    color: i === j ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)',
                                                    border: '1px solid rgba(0,0,0,.35)', minWidth: 26 }}>
                                                {r === null ? '–' : i === j ? '·' : r.toFixed(2)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default MapaSektorow;
