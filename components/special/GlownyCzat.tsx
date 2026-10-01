/**
 * 👑 GlownyCzat — rozmowa z Głównym (Claude Code w tle, services/Glowny.js) w Hubie: Creative Zone, KatedraChat, Orb.
 *
 * Zamiast okna terminala, którego nikt nie widział: wiadomości, narzędzia, odpowiedzi i PROŚBY na żywo (SSE).
 * Prośba = polecenie, którego Główny nie może wykonać bez zgody Suwerena. Tłumacz mówi po ludzku, co ono zrobi,
 * czym grozi i po co Główny go chce — dopiero potem ✓ albo ✕. Pliki Katedry Główny zmienia sam (decyzja Suwerena).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface Prosba { id: string; narzedzie: string; polecenie: string; coRobi: string; ryzyko: string; ryzykoSlownie: string; dlaczego: string | null; stan: 'czeka' | 'zgoda' | 'odmowa' }
interface Wpis { kto: 'suweren' | 'glowny' | 'narzedzie' | 'prosba' | 'decyzja' | 'blad'; tresc?: string; narzedzie?: string; opis?: string | null; prosba?: Prosba; kiedy: string }
interface Sesja { id: string; tytul: string; model: string; wpisy: Wpis[]; prosby: Prosba[]; trwa: boolean; blad: string | null }
interface SesjaSkrot { id: string; tytul: string; ostatnia: string; trwa: boolean; czeka: number }
interface StanGlownego { program: string; zrodlo: string; model: string; chmura: boolean; katalogi: string[] }

const KOLOR_RYZYKA: Record<string, string> = { niskie: 'border-emerald-500/50 bg-emerald-950/30', srednie: 'border-amber-500/50 bg-amber-950/30', wysokie: 'border-rose-500/60 bg-rose-950/40', nieznane: 'border-slate-500/50 bg-slate-900/50' };

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

export const GlownyCzat: React.FC<{ zrodlo?: string; zadanie?: string; kompaktowy?: boolean; className?: string }> = ({ zrodlo = 'czat', zadanie, kompaktowy = false, className = '' }) => {
    const [stan, setStan] = useState<StanGlownego | null>(null);
    const [sesje, setSesje] = useState<SesjaSkrot[]>([]);
    const [sesja, setSesja] = useState<Sesja | null>(null);
    const [tekst, setTekst] = useState(zadanie ?? '');
    const [wysyla, setWysyla] = useState(false);
    const dol = useRef<HTMLDivElement>(null);

    const wczytajSesje = useCallback(async () => {
        try { setSesje((await zMostu<{ sesje: SesjaSkrot[] }>('/api/glowny/sesje')).sesje); } catch { /* most offline */ }
    }, []);
    useEffect(() => {
        zMostu<StanGlownego>('/api/glowny/stan').then(setStan).catch(() => setStan(null));
        wczytajSesje();
    }, [wczytajSesje]);
    useEffect(() => { if (zadanie) setTekst(zadanie); }, [zadanie]);

    // Strumień otwartej sesji: pełny stan na start, potem wpisy i zmiany stanu.
    const id = sesja?.id;
    useEffect(() => {
        if (!id) return;
        const es = new EventSource(`${MOST}/api/glowny/sesja/${id}/strumien`);
        es.onmessage = (ev) => {
            let z: any; try { z = JSON.parse(ev.data); } catch { return; }
            if (z.typ === 'sesja') setSesja(z.sesja);
            else if (z.typ === 'wpis') setSesja((s) => (s && s.id === id ? { ...s, wpisy: [...s.wpisy, z.wpis], prosby: z.wpis.prosba && z.wpis.kto === 'prosba' ? [...s.prosby, z.wpis.prosba] : s.prosby } : s));
            else if (z.typ === 'stan') {
                setSesja((s) => (s && s.id === id ? { ...s, trwa: z.trwa, blad: z.blad ?? s.blad } : s));
                if (!z.trwa) { wczytajSesje(); if (z.czeka) toast(`👑 Główny prosi o zgodę (${z.czeka})`, { icon: '✋' }); }
            }
        };
        return () => es.close();
    }, [id, wczytajSesje]);
    useEffect(() => { dol.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [sesja?.wpisy.length]);

    const otworz = async (sid: string) => {
        try { setSesja((await zMostu<{ sesja: Sesja }>(`/api/glowny/sesja/${sid}`)).sesja); } catch (e: any) { toast.error(e.message); }
    };
    const wyslij = async () => {
        const t = tekst.trim();
        if (!t || wysyla) return;
        setWysyla(true);
        try {
            const d = await zMostu<{ sesja: string }>('/api/glowny/wiadomosc', { method: 'POST', body: JSON.stringify({ tekst: t, sesja: sesja?.id ?? null, zrodlo }) });
            setTekst('');
            if (!sesja || sesja.id !== d.sesja) await otworz(d.sesja);
            wczytajSesje();
        } catch (e: any) { toast.error(`👑 ${e.message}`); }
        finally { setWysyla(false); }
    };
    const decyduj = async (p: Prosba, zgoda: boolean) => {
        if (!sesja) return;
        try {
            await zMostu(`/api/glowny/sesja/${sesja.id}/prosba/${p.id}`, { method: 'POST', body: JSON.stringify({ zgoda }) });
            setSesja((s) => (s ? { ...s, prosby: s.prosby.map((x) => (x.id === p.id ? { ...x, stan: zgoda ? 'zgoda' : 'odmowa' } : x)), wpisy: s.wpisy.map((w) => (w.prosba?.id === p.id ? { ...w, prosba: { ...w.prosba, stan: zgoda ? 'zgoda' : 'odmowa' } } : w)) } : s));
        } catch (e: any) { toast.error(e.message); }
    };
    const przerwij = async () => { if (sesja) await zMostu(`/api/glowny/sesja/${sesja.id}/przerwij`, { method: 'POST', body: '{}' }).catch(() => {}); };

    const czeka = sesja?.prosby.filter((p) => p.stan === 'czeka') ?? [];
    return (
        <div className={`flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-black/40 p-3 text-xs text-slate-200 ${className}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-amber-200">👑 Główny <span className="font-normal text-slate-400">— Claude Code w Katedrze{stan ? ` · ${stan.chmura ? 'chmura' : 'Ollama'}: ${stan.model}` : ''}</span></div>
                <div className="flex items-center gap-1.5">
                    {!kompaktowy && sesje.length > 0 && (
                        <select value={sesja?.id ?? ''} onChange={(e) => (e.target.value ? otworz(e.target.value) : setSesja(null))}
                            className="max-w-[14rem] rounded border border-slate-700 bg-black/50 px-1.5 py-0.5 text-[11px]">
                            <option value="">+ nowa rozmowa</option>
                            {sesje.map((s) => <option key={s.id} value={s.id}>{s.czeka ? '✋ ' : s.trwa ? '⟳ ' : ''}{s.tytul.slice(0, 40)}</option>)}
                        </select>
                    )}
                    {sesja && <button onClick={() => setSesja(null)} className="rounded border border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-800">+ nowa</button>}
                </div>
            </div>
            {stan === null && <div className="text-[11px] text-rose-300">⚠ Most offline (:3001) — Główny działa przez most Katedry.</div>}

            <div className={`space-y-1.5 overflow-y-auto pr-1 ${kompaktowy ? 'max-h-64' : 'max-h-[28rem]'}`}>
                {!sesja && <div className="text-[11px] text-slate-400">Napisz zadanie — Główny czyta i zmienia pliki Katedry sam, zleca pracę TeOgochi, a o polecenia (instalacje, git, usuwanie…) prosi Cię z wyjaśnieniem.</div>}
                {sesja?.wpisy.map((w, i) => {
                    if (w.kto === 'suweren') return <div key={i} className="ml-8 rounded-lg bg-sky-950/50 px-2 py-1.5 text-sky-100">{w.tresc}</div>;
                    if (w.kto === 'glowny') return <div key={i} className="mr-8 whitespace-pre-wrap rounded-lg bg-amber-950/30 px-2 py-1.5">{w.tresc}</div>;
                    if (w.kto === 'narzedzie') return <div key={i} className="text-[10px] text-slate-500">🔧 {w.narzedzie}{w.opis ? ` — ${w.opis}` : ''}</div>;
                    if (w.kto === 'decyzja') return <div key={i} className="text-[10px] text-slate-400">{w.tresc}</div>;
                    if (w.kto === 'blad') return <div key={i} className="rounded border border-rose-600/50 bg-rose-950/40 px-2 py-1 text-rose-200">⚠ {w.tresc}</div>;
                    if (w.kto === 'prosba' && w.prosba) {
                        const p = sesja.prosby.find((x) => x.id === w.prosba!.id) ?? w.prosba;
                        return (
                            <div key={i} className={`rounded-lg border p-2 ${KOLOR_RYZYKA[p.ryzyko] ?? KOLOR_RYZYKA.nieznane}`}>
                                <div className="font-bold">✋ Główny prosi o zgodę · ryzyko {p.ryzykoSlownie}</div>
                                <div className="mt-0.5">🗣️ <b>O co mu chodzi:</b> {p.coRobi}</div>
                                {p.dlaczego && <div className="mt-0.5 text-slate-300">💭 <b>Po co (jego słowami):</b> {p.dlaczego}</div>}
                                <div className="mt-1 break-all rounded bg-black/50 px-1.5 py-1 font-mono text-[10px] text-slate-300">{p.narzedzie}: {p.polecenie}</div>
                                {p.stan === 'czeka'
                                    ? <div className="mt-1.5 flex gap-1.5">
                                        <button onClick={() => decyduj(p, true)} className="rounded bg-emerald-700/80 px-2 py-0.5 font-bold text-emerald-50 hover:bg-emerald-600">✓ Zgoda</button>
                                        <button onClick={() => decyduj(p, false)} className="rounded border border-slate-500 px-2 py-0.5 hover:bg-slate-800">✕ Nie</button>
                                      </div>
                                    : <div className="mt-1 text-[10px] text-slate-400">{p.stan === 'zgoda' ? '✓ zgodziłeś się' : '✕ odmówiłeś'}</div>}
                            </div>
                        );
                    }
                    return null;
                })}
                {sesja?.trwa && <div className="text-[11px] text-amber-300">⟳ Główny pracuje… <button onClick={przerwij} className="ml-1 underline hover:text-amber-100">przerwij</button></div>}
                <div ref={dol} />
            </div>

            <div className="flex gap-1.5">
                <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={kompaktowy ? 2 : 3}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) wyslij(); }}
                    placeholder={czeka.length ? 'Najpierw zdecyduj o prośbie powyżej (✓ / ✕)…' : sesja ? 'Dalej… (Ctrl+Enter)' : 'Zadanie dla Głównego… (Ctrl+Enter)'}
                    disabled={!!sesja?.trwa || czeka.length > 0}
                    className="flex-1 resize-none rounded border border-slate-700 bg-black/50 px-2 py-1.5 text-xs disabled:opacity-50" />
                <button onClick={wyslij} disabled={!tekst.trim() || wysyla || !!sesja?.trwa || czeka.length > 0}
                    className="self-end rounded bg-amber-600/80 px-3 py-1.5 font-bold text-amber-50 hover:bg-amber-500 disabled:opacity-40">{wysyla ? '⟳' : '👑 Wyślij'}</button>
            </div>
        </div>
    );
};

export default GlownyCzat;
