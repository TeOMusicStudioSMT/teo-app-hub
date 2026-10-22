/**
 * 🌙 Wieczór Tańca w Impresariacie (services/WieczorTanca.js): po nagraniu występu most zakłada Game Show, Zebrra Sports
 * o tańcu i Mame Leon Show (tancerz + choreograf na kanapie), a gdy wszystkie mają film — skleja jeden film-wieczór
 * do ✓ (Publikacje wyżej). Tu: stan części z faktów, „🧩 sklej teraz / bez …”, ustawienia, otwarcie studiów z automatem.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { otworzApke } from '../../lib/pierscien';

const MOST = 'http://127.0.0.1:3001';
async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}

interface Czesc { id: string | null; stan: string; plik: string | null; powod: string | null; blad?: string; wFilmie?: boolean }
interface Wieczor { id: string; stan: string; powod: string | null; tancerz: string; choreograf: string; jezyk: string; choreografia: { nazwa: string; utwor: string; ocena: number | null }; czesci: Record<string, Czesc>; plik: string | null; publikacja: { id: string | null; etap: string | null } | null; utworzono: string }
interface Ustawienia { auto: boolean; jezyk: string; narrator: string; wspolprowadzacy: string[]; choreograf: string }
interface Stan { wieczory: Wieczor[]; ustawienia: Ustawienia; czesci: string[]; nazwy: Record<string, string> }
const ZNAK: Record<string, string> = { gotowy: '✓', zastepstwo: '↪', studio: '🎥', robi: '⏳', w_kolejce: '⏳', blad: '⚠' };
const STAN: Record<string, string> = { czeka: '⏳ czeka na części', skleja: '🧩 skleja się', sklejony: '✓ sklejony', do_akceptacji: '✓ film-wieczór czeka na Twoje ✓ (Publikacje wyżej)' };

export const WieczorTancaPanel: React.FC = () => {
    const [s, setS] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const odswiez = useCallback(async () => {
        try { setS(await zMostu<Stan>('/api/wieczor-tanca')); setBlad(null); }
        catch (e) { setBlad(/HTTP 404/.test(String(e)) ? 'Most sprzed restartu — zrestartuj Katedrę, żeby włączyć Wieczór Tańca.' : String(e instanceof Error ? e.message : e)); }
    }, []);
    useEffect(() => { void odswiez(); const t = setInterval(odswiez, 20_000); return () => clearInterval(t); }, [odswiez]);
    const wolaj = async (sciezka: string, metoda: string, cialo: object, ok: string) => {
        try { await zMostu(sciezka, { method: metoda, body: JSON.stringify(cialo) }); toast.success(ok); await odswiez(); }
        catch (e) { toast.error(String(e instanceof Error ? e.message : e), { duration: 8000 }); }
    };
    const u = s?.ustawienia;

    return (
        <div className="rounded-lg border border-indigo-500/25 p-3 text-[11px]">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-indigo-300">🌙 Wieczór Tańca</span>
                <span className="text-slate-500">występ → 🎪 Game Show → 🩰 Zebrra Sports → 🦎 Mame Leon (tancerz + choreograf) = jeden film</span>
            </div>
            {blad && <div className="text-amber-300">⚠ {blad}</div>}
            {u && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={u.auto} onChange={(e) => void wolaj('/api/wieczor-tanca/ustawienia', 'PUT', { auto: e.target.checked }, e.target.checked ? 'Wieczór rusza sam po każdym nagraniu występu' : 'Wieczór wyłączony')} /> rusza sam po nagraniu występu</label>
                    <select value={u.jezyk} onChange={(e) => void wolaj('/api/wieczor-tanca/ustawienia', 'PUT', { jezyk: e.target.value }, 'Język wieczoru zmieniony')} className="rounded bg-slate-900 px-1">
                        <option value="en">🇬🇧 English</option><option value="pl">🇵🇱 polski</option>
                    </select>
                    <span className="text-slate-400">choreograf na kanapie: <b>{u.choreograf}</b> · prowadzą: {[u.narrator, ...u.wspolprowadzacy].join(' + ')}</span>
                </div>
            )}
            <div className="mb-2 flex flex-wrap gap-2">
                <button className="rounded border border-emerald-500/40 px-2 py-1 text-emerald-200" onClick={() => otworzApke({ id: 'studio-zebrra', tytul: 'Studio Zebrra Sports', url: `${MOST}/apki/studio-zebrra/`, znak: '🦓', kolor: '#22c55e' })}>🦓 Studio Zebrra Sports (🤖 automat)</button>
                <button className="rounded border border-fuchsia-500/40 px-2 py-1 text-fuchsia-200" onClick={() => otworzApke({ id: 'mame-leon', tytul: 'Mame Leon Show', url: `${MOST}/apki/studio-zebrra/mame-leon.html`, znak: '🦎', kolor: '#e879f9' })}>🦎 Mame Leon (🤖 automat)</button>
            </div>
            <div className="mb-2 text-slate-500">Studia nagrywają same, gdy w ich karcie zaznaczysz „🤖 Automat nagrywania — 🌙 Wieczór Tańca” i karta zostanie otwarta (Pierścień trzyma ją w tle).</div>
            {(s?.wieczory ?? []).slice(0, 8).map((w) => (
                <div key={w.id} className="mb-2 rounded border border-slate-700 p-2">
                    <div><b>{w.tancerz}</b> · „{w.choreografia.utwor}” · {w.choreografia.ocena ?? '—'}/100 · {w.jezyk} · <span className="text-indigo-200">{STAN[w.stan] ?? w.stan}</span></div>
                    <div className="mt-1 flex flex-wrap gap-3">
                        {(s?.czesci ?? []).map((k) => {
                            const c = w.czesci[k];
                            return <span key={k} title={c?.powod ?? c?.blad ?? ''}>{ZNAK[c?.stan] ?? '·'} {s?.nazwy[k]}{c?.stan === 'zastepstwo' ? ' (surowy występ)' : c?.stan === 'studio' ? ' — czeka na nagranie' : c?.stan === 'blad' ? ` — ${c.powod ?? c.blad ?? 'błąd'}` : ''}</span>;
                        })}
                    </div>
                    {w.powod && w.stan === 'czeka' && <div className="mt-1 text-slate-400">{w.powod}</div>}
                    <div className="mt-1 flex flex-wrap gap-2">
                        {['czeka', 'sklejony', 'do_akceptacji'].includes(w.stan) && (s?.czesci ?? []).filter((k) => w.czesci[k]?.stan === 'blad').map((k) => (
                            <button key={k} className="rounded border border-slate-600 px-2" onClick={() => void wolaj(`/api/wieczor-tanca/${w.id}/sklej`, 'POST', { pomin: [k] }, `Sklejone bez: ${s?.nazwy[k]}`)}>🧩 sklej bez {s?.nazwy[k]}</button>
                        ))}
                        {w.stan === 'czeka' && <button className="rounded border border-slate-600 px-2" onClick={() => void wolaj(`/api/wieczor-tanca/${w.id}/sklej`, 'POST', {}, 'Wieczór sklejony')}>🧩 sklej teraz</button>}
                        <button className="rounded border border-slate-700 px-2 text-slate-400" onClick={() => { if (confirm('Usunąć ten wieczór? (odcinki Game Show, Zebrra i Mame Leon zostają osobno)')) void wolaj(`/api/wieczor-tanca/${w.id}`, 'DELETE', {}, 'Wieczór usunięty'); }}>🗑</button>
                    </div>
                </div>
            ))}
            {s && !s.wieczory.length && <div className="text-slate-500">Jeszcze żadnego wieczoru — nagraj występ w Tanecznym Starciu.</div>}
        </div>
    );
};

export default WieczorTancaPanel;
