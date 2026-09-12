/**
 * 🌙 NOCNA ZMIANA — karta na dashboardzie.
 *
 * Pokazuje TRZY BRAMY z powodami (bezczynność / karta / RAM), kolejkę robót
 * i dziennik. Dodawanie tylko z białej listy mostu (services/NocnaZmiana.js) —
 * karta nie zna żadnej ścieżki, której most nie zna.
 *
 * ⚠️ „Uruchom teraz" omija bramy ŚWIADOMIE, ręką człowieka, i tak jest w dzienniku
 * oznaczone. Automat nigdy nie omija.
 */

import React, { useCallback, useEffect, useState } from 'react';
import DashboardCard from '../DashboardCard';
import { Moon, Play, Trash2, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface Robota { rodzaj: string; opis: string; pola: string[] }
interface Zadanie { id: string; rodzaj: string; parametry: Record<string, unknown>; notatka: string; stan: 'czeka' | 'trwa' | 'gotowe' | 'blad'; dodano: string; sekund?: number; blad?: string | null; recznie?: boolean }
interface Stan {
    wlaczona: boolean;
    bezczynnySek: number | null;
    bramy: { bezczynnosc: boolean; karta: boolean; ram: boolean };
    powody: string[];
    trwa: { id: string; rodzaj: string; od: string } | null;
    ostatnieSprawdzenie: number | null;
    prog: { bezczynnoscS: number; minRamGb: number; minVramMiB: number; coIleS: number };
    zadania: Zadanie[];
    dziennik: { kiedy: string; rodzaj: string; stan: string; sekund: number; blad: string | null; recznie?: boolean }[];
    roboty: Robota[];
}

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

const KOLOR_STANU: Record<Zadanie['stan'], string> = { czeka: 'text-slate-400', trwa: 'text-cyan-300', gotowe: 'text-emerald-300', blad: 'text-red-300' };

export const NocnaZmianaCard: React.FC = () => {
    const [stan, setStan] = useState<Stan | null>(null);
    // null = nie wiadomo · 'zyje' · 'milczy' · 'stary' (most odpowiada, ale nie zna trasy — wymaga restartu)
    const [most, setMost] = useState<null | 'zyje' | 'milczy' | 'stary'>(null);
    const [rodzaj, setRodzaj] = useState('');
    const [parametry, setParametry] = useState('');
    const [zajety, setZajety] = useState(false);

    const odswiez = useCallback(async () => {
        try { setStan(await zMostu<Stan>('/api/nocna/stan')); setMost('zyje'); }
        catch (e) {
            // ⚠️ 404 to NIE „most milczy" — to most sprzed restartu, który tej trasy nie zna.
            // Mówienie „milczy", gdy odpowiada, wysłałoby Suwerena na złe polowanie.
            setMost(/HTTP 404/.test(e instanceof Error ? e.message : '') ? 'stary' : 'milczy');
        }
    }, []);

    useEffect(() => {
        void odswiez();
        const i = window.setInterval(() => void odswiez(), 15_000);
        return () => window.clearInterval(i);
    }, [odswiez]);

    const przelacz = async () => {
        if (!stan) return;
        setZajety(true);
        try { await zMostu('/api/nocna/przelacz', { method: 'POST', body: JSON.stringify({ wlaczona: !stan.wlaczona }) }); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const sprawdzBramy = async () => {
        setZajety(true);
        try { await zMostu('/api/nocna/bramy'); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const dodaj = async () => {
        if (!rodzaj) return;
        let p: Record<string, unknown> = {};
        if (parametry.trim()) {
            try { p = JSON.parse(parametry); } catch { toast.error('Parametry muszą być JSON-em, np. {"projekt":"SOLLET"}'); return; }
        }
        setZajety(true);
        try { await zMostu('/api/nocna/dodaj', { method: 'POST', body: JSON.stringify({ rodzaj, parametry: p }) }); setParametry(''); await odswiez(); toast.success('Dodane do kolejki — ruszy, gdy odejdziesz od klawiatury.'); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const usun = async (id: string) => {
        try { await zMostu(`/api/nocna/${encodeURIComponent(id)}`, { method: 'DELETE' }); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    };

    const teraz = async (id: string) => {
        setZajety(true);
        try { const r = await zMostu<{ sekund: number }>(`/api/nocna/${encodeURIComponent(id)}/teraz`, { method: 'POST' }); toast.success(`Zrobione ręcznie w ${r.sekund} s.`); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 }); await odswiez(); }
        finally { setZajety(false); }
    };

    const wybrana = stan?.roboty.find((r) => r.rodzaj === rodzaj);
    const Brama: React.FC<{ nazwa: string; ok: boolean }> = ({ nazwa, ok }) => (
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono ${ok ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-700/60 bg-slate-800/40 text-slate-500'}`}>
            {ok ? '●' : '○'} {nazwa}
        </span>
    );

    return (
        <DashboardCard title="Nocna Zmiana" icon={<Moon className="w-full h-full" />}>
            <div className="flex flex-col gap-3 text-xs">
                {most === 'milczy' && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200">Most (:3001) milczy — Nocna Zmiana żyje w moście.</div>}
                {most === 'stary' && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200">Most odpowiada, ale nie zna jeszcze Nocnej Zmiany — to proces sprzed restartu. Zrestartuj Katedrę (START_KATEDRA.bat).</div>}

                {stan && (
                    <>
                        {/* ── Włącznik + bramy ── */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                                onClick={przelacz}
                                disabled={zajety}
                                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${stan.wlaczona ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                            >
                                {stan.wlaczona ? '🌙 WŁĄCZONA' : 'WYŁĄCZONA'}
                            </button>
                            <div className="flex items-center gap-1.5">
                                <Brama nazwa={`bezczynność ${stan.bezczynnySek !== null ? Math.round(stan.bezczynnySek / 60) + ' min' : '?'}`} ok={stan.bramy.bezczynnosc} />
                                <Brama nazwa="karta" ok={stan.bramy.karta} />
                                <Brama nazwa="RAM" ok={stan.bramy.ram} />
                                <button onClick={sprawdzBramy} disabled={zajety} title="Sprawdź bramy teraz" className="p-1 text-slate-500 hover:text-slate-200">
                                    {zajety ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                </button>
                            </div>
                        </div>

                        <p className="text-[10px] leading-relaxed text-slate-500">
                            Rusza jedno zadanie naraz, gdy nie dotykasz klawiatury ≥ {Math.round(stan.prog.bezczynnoscS / 60)} min, karta nie liczy i wolnego RAM jest ≥ {stan.prog.minRamGb} GB.
                            Sprawdza co {stan.prog.coIleS} s{stan.ostatnieSprawdzenie ? ` · ostatnio ${new Date(stan.ostatnieSprawdzenie).toLocaleTimeString('pl-PL')}` : ''}.
                        </p>
                        {stan.powody.length > 0 && stan.zadania.some((z) => z.stan === 'czeka') && (
                            <ul className="space-y-0.5 text-[10px] text-slate-400">
                                {stan.powody.map((p) => <li key={p}>· {p}</li>)}
                            </ul>
                        )}
                        {stan.trwa && <div className="text-[11px] text-cyan-300">⟳ trwa: {stan.trwa.rodzaj} od {new Date(stan.trwa.od).toLocaleTimeString('pl-PL')}</div>}

                        {/* ── Kolejka ── */}
                        <div className="space-y-1">
                            {stan.zadania.length === 0 && <div className="text-[10px] text-slate-600">Kolejka pusta — dodaj robotę niżej.</div>}
                            {stan.zadania.map((z) => (
                                <div key={z.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-2 py-1.5">
                                    <div className="min-w-0">
                                        <span className={`font-mono ${KOLOR_STANU[z.stan]}`}>{z.stan}</span>
                                        <span className="ml-2 text-slate-200">{stan.roboty.find((r) => r.rodzaj === z.rodzaj)?.opis ?? z.rodzaj}</span>
                                        {Object.keys(z.parametry ?? {}).length > 0 && <span className="ml-2 text-[10px] text-slate-500">{JSON.stringify(z.parametry)}</span>}
                                        {z.blad && <div className="text-[10px] text-red-300">{z.blad}</div>}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {z.stan === 'czeka' && <button onClick={() => void teraz(z.id)} disabled={zajety} title="Uruchom teraz (omija bramy — świadomie)" className="p-1 text-slate-500 hover:text-cyan-300"><Play size={12} /></button>}
                                        {z.stan !== 'trwa' && <button onClick={() => void usun(z.id)} title="Usuń" className="p-1 text-slate-600 hover:text-red-300"><Trash2 size={12} /></button>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Dodaj z białej listy ── */}
                        <div className="flex flex-col gap-1.5 rounded-lg border border-slate-700/50 p-2">
                            <div className="flex gap-1.5">
                                <select value={rodzaj} onChange={(e) => setRodzaj(e.target.value)} className="flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1 text-[11px] text-slate-200">
                                    <option value="">— robota z białej listy —</option>
                                    {stan.roboty.map((r) => <option key={r.rodzaj} value={r.rodzaj}>{r.opis}</option>)}
                                </select>
                                <button onClick={dodaj} disabled={!rodzaj || zajety} className="rounded bg-indigo-500/30 px-2 text-indigo-200 disabled:opacity-40" title="Dodaj do kolejki"><Plus size={14} /></button>
                            </div>
                            {wybrana && wybrana.pola.length > 0 && (
                                <input
                                    value={parametry}
                                    onChange={(e) => setParametry(e.target.value)}
                                    placeholder={`JSON: {${wybrana.pola.map((p) => `"${p}": …`).join(', ')}}`}
                                    className="rounded border border-slate-700 bg-black/40 px-2 py-1 font-mono text-[10px] text-slate-200"
                                />
                            )}
                        </div>

                        {/* ── Dziennik ── */}
                        {stan.dziennik.length > 0 && (
                            <details className="text-[10px] text-slate-500">
                                <summary className="cursor-pointer">dziennik ({stan.dziennik.length})</summary>
                                <ul className="mt-1 space-y-0.5">
                                    {stan.dziennik.slice(0, 10).map((w, i) => (
                                        <li key={i} className="font-mono">
                                            {new Date(w.kiedy).toLocaleString('pl-PL')} · {w.rodzaj} · <span className={w.stan === 'gotowe' ? 'text-emerald-400' : 'text-red-300'}>{w.stan}</span> · {w.sekund}s{w.recznie ? ' · ręcznie' : ''}{w.blad ? ` · ${w.blad}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </>
                )}
            </div>
        </DashboardCard>
    );
};
