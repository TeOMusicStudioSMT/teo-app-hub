/**
 * 🌍 Odwiedziny — kto zagląda na strony Suwerena (teo.center, otakos.wtf…) i skąd (services/LicznikWejsc.js).
 *
 * Kraj podaje Cloudflare, adresu IP most nie zapisuje. Gospodarza strona sama nie zgłasza, boty
 * są liczone osobno. Liczy tylko wtedy, gdy Katedra nie śpi — pełniejsze liczby (też w nocy)
 * są w Web Analytics Cloudflare.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';

interface Wejscie { kiedy: string; strona: string; kraj: string | null; sciezka: string; skad: string | null }
interface Podsumowanie {
    dni: number; ludzie: number; boty: number; dzis: number;
    kraje: { kod: string; nazwa: string; ile: number }[];
    skad: { host: string; ile: number }[];
    strony: { strona: string; ile: number }[];
    ostatnie: Wejscie[];
}

/** Flaga z kodu kraju (litery regionalne Unicode). */
const flaga = (kod: string | null) => (kod && /^[A-Z]{2}$/.test(kod) ? String.fromCodePoint(...[...kod].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌍');
const kiedy = (iso: string) => new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Pasek({ etykieta, ile, max }: { etykieta: React.ReactNode; ile: number; max: number }) {
    return (
        <li className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0 truncate text-slate-300">{etykieta}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800"><span className="block h-full rounded bg-cyan-500/70" style={{ width: `${Math.max(4, (ile / max) * 100)}%` }} /></span>
            <span className="w-8 text-right tabular-nums text-slate-400">{ile}</span>
        </li>
    );
}

export const OdwiedzinyView: React.FC = () => {
    const [dni, setDni] = useState(7);
    const [p, setP] = useState<Podsumowanie | null>(null);
    const [blad, setBlad] = useState<string | null>(null);

    const wczytaj = useCallback(async () => {
        try {
            const r = await fetch(`${MOST}/api/wejscia?dni=${dni}`);
            const d = await r.json().catch(() => null);
            if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
            setP(d); setBlad(null);
        } catch (e: any) { setBlad(e.message); }
    }, [dni]);
    useEffect(() => { void wczytaj(); const t = setInterval(wczytaj, 60_000); return () => clearInterval(t); }, [wczytaj]);

    const maxK = Math.max(1, ...(p?.kraje.map((k) => k.ile) ?? []));
    const maxS = Math.max(1, ...(p?.skad.map((k) => k.ile) ?? []));
    return (
        <div className="mx-auto max-w-3xl space-y-4 p-4 text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-cyan-200">🌍 Odwiedziny</h2>
                    <p className="text-xs text-slate-400">Kto zagląda na teo.center i skąd. Kraj podaje Cloudflare, adresów IP Katedra nie zapisuje; Ciebie i boty strona nie liczy jako gości. Liczy tylko, gdy Katedra nie śpi.</p>
                </div>
                <select value={dni} onChange={(e) => setDni(Number(e.target.value))} className="rounded-lg bg-slate-800 px-2 py-1 text-sm">
                    {[1, 7, 30, 90].map((d) => <option key={d} value={d}>{d === 1 ? 'dziś' : `${d} dni`}</option>)}
                </select>
            </div>
            {blad && <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">⚠ {blad} {blad.includes('fetch') ? '— most Katedry nie odpowiada.' : ''}</div>}
            {p && (
                <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        {[['dziś', p.dzis], [p.dni === 1 ? 'gości dziś' : `gości · ${p.dni} dni`, p.ludzie], ['boty (bez wieści)', p.boty]].map(([t, n]) => (
                            <div key={String(t)} className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
                                <div className="text-2xl font-bold tabular-nums text-cyan-100">{n}</div>
                                <div className="text-[11px] text-slate-400">{t}</div>
                            </div>
                        ))}
                    </div>
                    {p.ludzie === 0 && <div className="text-sm text-slate-400">Jeszcze nikt — pierwszy gość przyjdzie też jako wieść w Orbicie i na telefonie (StoL).</div>}
                    {p.kraje.length > 0 && (
                        <div className="rounded-xl border border-slate-700/60 p-3">
                            <div className="mb-2 text-sm font-bold">Kraje</div>
                            <ul className="space-y-1.5">{p.kraje.map((k) => <Pasek key={k.kod} etykieta={<>{flaga(k.kod)} {k.nazwa}</>} ile={k.ile} max={maxK} />)}</ul>
                        </div>
                    )}
                    {p.skad.length > 0 && (
                        <div className="rounded-xl border border-slate-700/60 p-3">
                            <div className="mb-2 text-sm font-bold">Skąd przyszli</div>
                            <ul className="space-y-1.5">{p.skad.map((s) => <Pasek key={s.host} etykieta={s.host} ile={s.ile} max={maxS} />)}</ul>
                        </div>
                    )}
                    {p.ostatnie.length > 0 && (
                        <div className="rounded-xl border border-slate-700/60 p-3">
                            <div className="mb-2 text-sm font-bold">Ostatnie wejścia</div>
                            <ul className="space-y-1 text-sm">
                                {p.ostatnie.map((w, i) => (
                                    <li key={i} className="flex flex-wrap gap-x-2 text-slate-300">
                                        <span className="text-slate-500 tabular-nums">{kiedy(w.kiedy)}</span>
                                        <span>{flaga(w.kraj)} {w.strona}{w.sciezka !== '/' ? w.sciezka : ''}</span>
                                        {w.skad && <span className="text-slate-500">← {w.skad}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" className="inline-block text-xs text-cyan-400 hover:text-cyan-300">
                        Pełne liczby (także gdy Katedra śpi): Cloudflare → teo.center → Analytics ↗
                    </a>
                </>
            )}
        </div>
    );
};

export default OdwiedzinyView;
