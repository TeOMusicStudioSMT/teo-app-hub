/**
 * 🏛️ Globalny Klub Mistrzów — okno w Inkubatorze, pod JaJem Mistrza (most: services/KlubMistrzow.js, /api/klub-mistrzow*).
 * Przedstawicielstwo tej Katedry (pole `mistrz` w wizytówce), Katedry w Klubie (zwiad po rejestrze otakos.wtf, nick + klucz
 * zgodne), eventy globalne z rankingami i ogłaszanie własnego turnieju. Wyniki są deklarowane przez Katedry — mówimy to wprost.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
const DZIEDZINY: Record<string, string> = { takt: '🎵 Takt', zwinnosc: '🌀 Zwinność', spryt: '🧩 Spryt', urok: '✨ Urok' };
interface Ev { klucz: string; id: string; organizator: string; nazwa: string; opis: string; od: string; do: string; dziedzina: string }
interface Wynik { nick: string; wygrane: number; starc: number; kiedy: string }
interface Czlonek { nick: string; motto: string; etap: string; teterhia: string | null; eventy: Ev[] }
interface Stan {
    nick: string | null; blad: string | null;
    przedstawiciel: { etap?: string; teterhia?: string | null; wyniki: { event: string; wygrane: number; starc: number }[] } | null;
    moje: Ev[];
    pole: { kiedy: string; online: number; czlonkowie: Czlonek[]; pominiete: { nick: string; powod: string }[]; eventy: Ev[]; rankingi: Record<string, Wynik[]> } | null;
}

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

export default function KlubMistrzowPanel() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [trwa, setTrwa] = useState(false);
    const [dziedzina, setDziedzina] = useState('takt');
    const [dni, setDni] = useState(3);
    const [opis, setOpis] = useState('');

    const wczytaj = useCallback(async (zwiad = false) => {
        setTrwa(true);
        try { setStan(await zMostu<Stan>(`/api/klub-mistrzow${zwiad ? '?zwiad=1' : ''}`)); setBlad(null); }
        catch (e) { setBlad((e as Error).message); } finally { setTrwa(false); }
    }, []);
    useEffect(() => { void wczytaj(); }, [wczytaj]);

    const oglos = async () => {
        setTrwa(true);
        try { await zMostu('/api/klub-mistrzow/eventy', { method: 'POST', body: JSON.stringify({ dziedzina, dni, opis }) }); setOpis(''); await wczytaj(); }
        catch (e) { setBlad((e as Error).message); setTrwa(false); }
    };
    const wycofaj = async (id: string) => {
        try { await zMostu(`/api/klub-mistrzow/eventy/${id}`, { method: 'DELETE' }); await wczytaj(); } catch (e) { setBlad((e as Error).message); }
    };

    if (!stan) return blad ? <p className="mt-3 text-[11px] text-amber-300">🏛️ Klub Mistrzów: {blad}</p> : null;
    const eventy = stan.pole?.eventy ?? stan.moje;

    return (
        <div className="mt-4 rounded-xl border border-amber-300/25 bg-black/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold tracking-widest text-amber-200">🏛️ GLOBALNY KLUB MISTRZÓW</h4>
                <button onClick={() => void wczytaj(true)} disabled={trwa || !stan.nick} className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/40 disabled:opacity-40">{trwa ? 'zwiad…' : '🔭 Zwiad po sieci'}</button>
            </div>
            {!stan.nick
                ? <p className="mt-2 text-[11px] text-amber-300/90">Katedra nie ma jeszcze nicku w sieci — ustaw go w 🪪 Wizytówce (karta Wystawy). Wtedy JaJo przedstawi Katedrę w Klubie, a Meldunek (z Tunelem) pokaże ją innym.</p>
                : <p className="mt-1 text-[11px] text-slate-400">Przedstawiciel: JaJo Mistrza Katedry <b className="text-amber-200">„{stan.nick}”</b> · etap {stan.przedstawiciel?.etap ?? '?'}{stan.przedstawiciel?.teterhia ? ` · w Teterhii: ${stan.przedstawiciel.teterhia}` : ''}{stan.pole ? ` · w sieci online: ${stan.pole.online}, w Klubie: ${stan.pole.czlonkowie.length}` : ''}</p>}
            {(stan.blad || blad) && <p className="mt-1 text-[10px] text-amber-400">⚠ {stan.blad || blad}</p>}

            {stan.pole && stan.pole.czlonkowie.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">{stan.pole.czlonkowie.map((c) => <span key={c.nick} title={c.motto} className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">🏛️ {c.nick} · {c.etap || '?'}{c.teterhia ? ` · ${c.teterhia}` : ''}</span>)}</div>
            )}
            {stan.pole && stan.pole.pominiete.length > 0 && <p className="mt-1 text-[10px] text-slate-600">poza Klubem: {stan.pole.pominiete.map((p) => `${p.nick} (${p.powod})`).join('; ')}</p>}

            <p className="mb-1 mt-3 text-[10px] uppercase tracking-wider text-slate-500">Eventy globalne</p>
            {eventy.length === 0 && <p className="text-[11px] text-slate-500">Żaden event nie trwa. Ogłoś pierwszy — gracze grają go w swojej Teterhii (K → 🏛️).</p>}
            <div className="space-y-1.5">{eventy.map((e) => {
                const r = stan.pole?.rankingi[e.klucz] ?? [];
                const moj = e.organizator === stan.nick;
                return (
                    <div key={e.klucz} className="rounded-lg bg-black/30 px-2 py-1.5 text-[11px]">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-200">{e.nazwa} <span className="text-slate-500">· {DZIEDZINY[e.dziedzina]} · „{e.organizator}”{moj ? ' (Ty)' : ''} · do {e.do}</span>{e.opis ? <span className="block text-[10px] text-slate-400">{e.opis}</span> : null}</span>
                            {moj && <button onClick={() => void wycofaj(e.id)} className="text-[10px] text-slate-500 hover:text-red-400">wycofaj</button>}
                        </div>
                        {r.length > 0 && <ol className="mt-1 list-decimal pl-4 text-[10px] text-emerald-200/90">{r.slice(0, 5).map((w) => <li key={w.nick}>{w.nick} — {w.wygrane}/{w.starc}</li>)}</ol>}
                    </div>
                );
            })}</div>

            {stan.nick && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-400">Ogłoś turniej:</span>
                    <select value={dziedzina} onChange={(e) => setDziedzina(e.target.value)} className="rounded border border-slate-700 bg-black/40 px-1 py-0.5">{Object.entries(DZIEDZINY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <select value={dni} onChange={(e) => setDni(Number(e.target.value))} className="rounded border border-slate-700 bg-black/40 px-1 py-0.5">{[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'dzień' : 'dni'}</option>)}</select>
                    <input value={opis} onChange={(e) => setOpis(e.target.value)} maxLength={200} placeholder="zapowiedź (opcjonalnie)" className="min-w-0 flex-1 rounded border border-slate-700 bg-black/40 px-2 py-0.5 outline-none" />
                    <button onClick={() => void oglos()} disabled={trwa} className="rounded-lg border border-amber-400/50 px-2 py-0.5 text-amber-200 hover:bg-amber-400/10 disabled:opacity-40">🏛️ Ogłoś</button>
                </div>
            )}
            <p className="mt-2 text-[10px] leading-snug text-slate-600">Tożsamość Katedr potwierdza rejestr otakos.wtf (nick + klucz), ale wyniki są deklarowane przez same Katedry. Za udział nie płyną GRV między Katedrami. Nowe eventy i wyniki JaJo mówi przez Orbitę (📯).</p>
        </div>
    );
}
