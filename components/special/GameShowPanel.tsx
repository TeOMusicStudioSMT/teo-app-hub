/**
 * 🎪 TeO Game Show w Impresariacie (2026-10-13) — odcinki składane z nagrań Tanecznego Starcia
 * (services/TeoGameShow.js): etapy intro → konkurencja → finał → sklejenie → publikacja, „↻ Ponów” / „bez intro”,
 * kanał programu (dedykowany kanał YouTube), karta zarządzania na Stół, instrukcja kanału, inne sieci (niepodłączone).
 * ✓ samej publikacji jest wyżej — w „Publikacjach YouTube od stada” (i w Izbie na telefonie).
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';
async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}

interface Etap { stan: string; powod?: string }
interface Odcinek {
    id: string; stan: string; powod: string | null; utworzono: string; plik: string | null; uwagi: string[];
    tancerz: { imie: string }; utwor: { tytul: string; bpm: number | null }; ocena: { wynik: number }; konkurencja: { nazwa: string };
    etapy: Record<string, Etap>; publikacja: { id: string; tytul: string | null; kanalNazwa: string | null } | null;
}
interface Kanal { kanalId: string | null; kanalNazwa: string | null; zapamietany: string | null }
interface Stan { odcinki: Odcinek[]; kanal: Kanal; inneSieci: { siec: string; stan: string; powod: string }[]; instrukcja: string[]; automat: boolean }
interface KanalYT { id: string; nazwa: string }

const ETAPY: [string, string][] = [['intro', '🎬 intro'], ['konkurencja', '🏷️ konkurencja'], ['final', '🏆 finał'], ['sklejanie', '🧱 sklejenie'], ['publikacja', '✍️ Kronikarz']];
const ZNAK: Record<string, string> = { czeka: '·', robi: '⏳', gotowy: '✓', blad: '⚠', pominiety: '—' };
const STAN: Record<string, string> = { w_kolejce: '⏳ w kolejce', robi: '⏳ składa się', blad: '⚠ stanął', do_akceptacji: '✓ czeka na Twoje ✓ (Publikacje wyżej)' };

export const GameShowPanel: React.FC = () => {
    const [s, setS] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [kanaly, setKanaly] = useState<KanalYT[]>([]);
    const [pokaz, setPokaz] = useState(false);
    const odswiez = useCallback(async () => {
        try { setS(await zMostu<Stan>('/api/game-show')); setBlad(null); }
        catch (e) { setBlad(/HTTP 404/.test(String(e)) ? 'Most sprzed restartu — zrestartuj Katedrę, żeby włączyć TeO Game Show.' : String(e instanceof Error ? e.message : e)); }
        try { setKanaly((await zMostu<{ kanaly: KanalYT[] }>('/api/youtube/kanaly')).kanaly); } catch { /* bez kanałów */ }
    }, []);
    useEffect(() => { void odswiez(); const t = setInterval(odswiez, 15_000); return () => clearInterval(t); }, [odswiez]);
    const wolaj = async (sciezka: string, metoda: string, cialo: object, ok: string) => {
        try { await zMostu(sciezka, { method: metoda, body: JSON.stringify(cialo) }); toast.success(ok); await odswiez(); }
        catch (e) { toast.error(String(e instanceof Error ? e.message : e), { duration: 8000 }); }
    };

    return (
        <div className="rounded-lg border border-amber-500/25 p-3 text-[11px]">
            <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-amber-300">🎪 TeO Game Show</span>
                {s && <span className="text-[10px] text-slate-500">{s.automat ? 'nagranie występu w Tanecznym Starciu samo robi odcinek' : 'automat wyłączony (OTAKOS_GAME_SHOW=0)'}</span>}
                <button onClick={() => setPokaz((x) => !x)} className="ml-auto text-[10px] text-slate-400 hover:text-amber-200">{pokaz ? 'zwiń' : 'kanał i sieci'}</button>
            </div>
            {blad && <p className="text-[10px] text-amber-300">⚠ {blad}</p>}
            {s && (
                <>
                    <label className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">Kanał programu:
                        <select value={s.kanal.zapamietany ?? ''} onChange={(ev) => void wolaj('/api/game-show/kanal', 'PUT', { kanalId: ev.target.value || null }, ev.target.value ? 'Kanał programu ustawiony — odcinki pójdą tam same.' : 'Kanał programu zapomniany — odcinki idą na domyślny.')} className="rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200">
                            <option value="">— domyślny kanał Katedry —</option>
                            {kanaly.map((k) => <option key={k.id} value={k.id}>{k.nazwa || k.id}</option>)}
                        </select>
                        <span className="text-slate-500">{s.kanal.kanalNazwa ? `→ ${s.kanal.kanalNazwa}` : 'YouTube niepołączony'}</span>
                    </label>
                    {pokaz && (
                        <div className="mb-2 rounded border border-white/5 bg-black/30 p-2 text-[10px] text-slate-400">
                            <b className="text-slate-300">Dedykowany kanał (zakładasz Ty — API YouTube nie zakłada kanałów):</b>
                            <ol className="mt-1 list-none space-y-0.5">{s.instrukcja.map((l) => <li key={l}>{l}</li>)}</ol>
                            <button onClick={() => void wolaj('/api/game-show/stol', 'POST', {}, 'Karta „TeO Game Show — zarządzanie kanałem” leży na Stole.')} className="mt-2 rounded bg-amber-600/30 px-2 py-1 text-amber-100">🏛️ Karta zarządzania kanałem na Stół</button>
                            <div className="mt-2 text-slate-300">Inne sieci:</div>
                            <ul>{s.inneSieci.map((x) => <li key={x.siec}>✕ <b>{x.siec}</b> — {x.stan}: {x.powod}</li>)}</ul>
                        </div>
                    )}
                    {!s.odcinki.length && <p className="text-[10px] text-slate-500">Pusto. Nagraj występ w Tanecznym Starciu (🩰 Choreografia → 🎥 Nagraj) — odcinek złoży się sam.</p>}
                    {s.odcinki.slice(0, 12).map((o) => (
                        <div key={o.id} className="mb-2 rounded border border-white/5 bg-black/30 p-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <b className="text-slate-200">{o.tancerz.imie}</b>
                                <span className="text-slate-500">· {o.konkurencja.nazwa} · „{o.utwor.tytul}” · {o.ocena?.wynik ?? '?'}/100</span>
                                <span className="ml-auto text-slate-400">{STAN[o.stan] ?? o.stan}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                                {ETAPY.map(([k, n]) => <span key={k} title={o.etapy[k]?.powod ?? ''} className={o.etapy[k]?.stan === 'blad' ? 'text-amber-300' : o.etapy[k]?.stan === 'gotowy' ? 'text-emerald-300' : 'text-slate-500'}>{ZNAK[o.etapy[k]?.stan] ?? '·'} {n}</span>)}
                            </div>
                            {o.powod && <div className="mt-1 text-[10px] text-amber-300">{o.powod}</div>}
                            {o.uwagi?.length > 0 && <div className="mt-1 text-[10px] text-slate-500">uwagi: {o.uwagi.join(' · ')}</div>}
                            {o.publikacja?.tytul && <div className="mt-1 text-[10px] text-slate-400">✍️ „{o.publikacja.tytul}”{o.publikacja.kanalNazwa ? ` → ${o.publikacja.kanalNazwa}` : ''}</div>}
                            <div className="mt-1 flex gap-2">
                                {o.stan === 'blad' && <button onClick={() => void wolaj(`/api/game-show/${o.id}/ponow`, 'POST', {}, 'Ponawiam od etapu, który stanął.')} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-100">↻ Ponów</button>}
                                {o.stan === 'blad' && o.etapy.intro?.stan === 'blad' && <button onClick={() => void wolaj(`/api/game-show/${o.id}/ponow`, 'POST', { bezIntro: true }, 'Składam odcinek bez intro.')} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-100">bez intro</button>}
                                {!['robi', 'w_kolejce'].includes(o.stan) && <button onClick={() => confirm('Usunąć odcinek (pliki robocze)? Gotowy film w montażach i publikacja zostają.') && void wolaj(`/api/game-show/${o.id}`, 'DELETE', {}, 'Usunięty.')} className="ml-auto text-[10px] text-slate-600 hover:text-rose-300">✕</button>}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

export default GameShowPanel;
