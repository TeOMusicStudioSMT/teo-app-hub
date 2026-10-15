/**
 * ⚽ Gol Dnia (services/GolDnia.js, /api/gol-dnia) — TeOgochi rysuje i opowiada bramki z FAKTÓW meczów.
 * Liga → mecz → fakty (Zwiadowca z sieci, sprawdzone wynikiem; do poprawki ręcznie) → narrator z temperamentem →
 * odcinek (scenariusz, FLUX, głos, sklejenie, publikacja do ✓ w Izbie). Studio: ten sam mecz, inny narrator.
 * 🦓🦁 Prowadzący Studia Zebrra Football (Gol Donna, Zlat Kadabra) — solo albo w duecie; wideo z napisami albo nagrane
 * w apce 3D (`_OtakOs_Apki/studio-zebrra`, Pierścień apek) → POST /api/gol-dnia/:id/studio.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { GlosTeogochi } from '../GlosTeogochi';
import { otworzApke } from '../../lib/pierscien';

const MOST = 'http://127.0.0.1:3001';
interface Mecz { id: string; liga: string | null; data: string | null; gospodarze: string; goscie: string; wynik: [number, number] }
interface Gol { minuta: string; strzelec: string; druzyna: 'gospodarze' | 'goscie' | null; asysta: string | null; opis: string | null; karny?: boolean; samobojczy?: boolean }
interface ScenaGola { przed: string; okrzyk: string; po: string; scena: string }
interface Odcinek {
    id: string; stan: string; powod: string | null; mecz: Mecz; gole: Gol[]; zrodla: string[]; narrator: string; wspol?: string | null; wideo?: string; jezyk: string;
    studio?: { plik: string; prowadzacy: string[]; publikacja: { id: string | null } | null } | null;
    etapy: Record<string, { stan: string; powod?: string }>; scenariusz: { intro: string; gole: ScenaGola[]; outro: string } | null;
    obrazy: { intro: string; gole: { karta: string; scena: string }[]; wynik: string } | null; uwagi: string[]; plik: string | null; publikacja: { id: string | null } | null; utworzono: string;
}
interface Stan { odcinki: Odcinek[]; ustawienia: { jezyk: string; narrator: string; liga: number }; ligi: Record<string, string>; jezyki: Record<string, string>; narratorzy: Record<string, { imie: string; emoji: string; temperament: string; rola?: string }>; wideo?: Record<string, string>; kanal: { kanalId?: string | null; kanalNazwa?: string | null } | null }

async function api<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}
const ETAPY = ['scenariusz', 'obrazy', 'segmenty', 'sklejenie', 'publikacja'];
const ZNAK: Record<string, string> = { gotowy: '✓', robi: '⟳', blad: '✕', czeka: '·', pominiety: '–' };
const otworzStudio = (id: string) => otworzApke({ id: 'studio-zebrra', tytul: 'Studio Zebrra Football', url: `${MOST}/apki/studio-zebrra/?odcinek=${id}`, znak: '🦓', kolor: '#22c55e' });
const mow = async (tekst: string, teogochi: string) => {
    try { const r = await fetch(`${MOST}/api/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: tekst, teogochi }) }); if (r.ok) void new Audio(URL.createObjectURL(await r.blob())).play(); } catch { /* bez głosu */ }
};

export const GolDniaPanel: React.FC = () => {
    const [stan, setStan] = useState<Stan | null>(null);
    const [mecze, setMecze] = useState<Mecz[]>([]);
    const [mecz, setMecz] = useState<Mecz | null>(null);
    const [gole, setGole] = useState<Gol[] | null>(null);
    const [zrodla, setZrodla] = useState<string[]>([]);
    const [narrator, setNarrator] = useState('pilkarka');
    const [wspol, setWspol] = useState('');
    const [wideo, setWideo] = useState('napisy');
    const [pracuje, setPracuje] = useState<string | null>(null);
    const [otwarty, setOtwarty] = useState<string | null>(null);
    const [edycja, setEdycja] = useState<Odcinek['scenariusz']>(null);
    const [kanaly, setKanaly] = useState<{ id: string; nazwa: string }[]>([]);
    useEffect(() => { api<{ kanaly: { id: string; nazwa: string }[] }>('/api/youtube/kanaly').then((d) => setKanaly(d.kanaly ?? [])).catch(() => {}); }, []);

    const odswiez = useCallback(async () => { try { const d = await api<Stan>('/api/gol-dnia'); setStan(d); } catch { /* most bez Gola Dnia */ } }, []);
    useEffect(() => { void odswiez(); const t = window.setInterval(odswiez, 8000); return () => window.clearInterval(t); }, [odswiez]);
    useEffect(() => { if (stan && narrator === 'pilkarka') setNarrator(stan.ustawienia.narrator); }, [stan?.ustawienia.narrator]); // eslint-disable-line react-hooks/exhaustive-deps

    const zajety = (co: string, fn: () => Promise<void>) => async () => { setPracuje(co); try { await fn(); } catch (e: any) { toast.error(`⚽ ${e.message}`); } finally { setPracuje(null); } };
    const ustaw = (z: Record<string, unknown>) => api('/api/gol-dnia/ustawienia', { method: 'PUT', body: JSON.stringify(z) }).then(odswiez).catch((e) => toast.error(e.message));
    const wczytajMecze = zajety('mecze', async () => { const d = await api<{ mecze: Mecz[] }>(`/api/gol-dnia/mecze?liga=${stan?.ustawienia.liga ?? ''}`); setMecze(d.mecze); setMecz(null); setGole(null); });
    const fakty = zajety('fakty', async () => { if (!mecz) return; const d = await api<{ gole: Gol[]; zrodla: string[] }>('/api/gol-dnia/fakty', { method: 'POST', body: JSON.stringify({ mecz }) }); setGole(d.gole); setZrodla(d.zrodla); toast.success(`⚽ ${d.gole.length} bramek, zgodne z wynikiem`); });
    const zrob = zajety('odcinek', async () => {
        if (!mecz) return;
        const d = await api<{ odcinek: Odcinek }>('/api/gol-dnia', { method: 'POST', body: JSON.stringify({ mecz, gole: gole ?? undefined, narrator, wspol: wspol && wspol !== narrator ? wspol : null, wideo }) });
        toast.success('⚽ Odcinek w kolejce'); setOtwarty(d.odcinek.id); setMecz(null); setGole(null); void odswiez();
    });
    const zmienGol = (i: number, pole: keyof Gol, v: string) => setGole((g) => g ? g.map((x, j) => (j === i ? { ...x, [pole]: v || null } : x)) : g);

    if (!stan) return null;
    const ligi = Object.entries(stan.ligi);
    const N = stan.narratorzy;
    return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-4 text-xs text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-emerald-200">⚽ Gol Dnia — TeOgochi rysuje i opowiada bramki</h3>
                <div className="flex items-center gap-2 text-[11px]">
                    <select value={stan.ustawienia.jezyk} onChange={(e) => void ustaw({ jezyk: e.target.value })} className="rounded border border-slate-700 bg-black/40 px-1 py-0.5">
                        {Object.entries(stan.jezyki).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={stan.kanal?.kanalId ?? ''} title="Kanał programu (zakładasz go ręcznie w YouTube, potem „➕ Dodaj kanał” w Impresariacie)"
                        onChange={(e) => void api('/api/gol-dnia/kanal', { method: 'PUT', body: JSON.stringify({ kanalId: e.target.value || null }) }).then(odswiez).catch((x) => toast.error(x.message))}
                        className="max-w-[12rem] rounded border border-slate-700 bg-black/40 px-1 py-0.5">
                        <option value="">kanał: domyślny</option>
                        {kanaly.map((k) => <option key={k.id} value={k.id}>📺 {k.nazwa}</option>)}
                    </select>
                </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Obraz nie pochodzi z nagrań meczów — Katedra rysuje gole z FAKTÓW (wynik z TheSportsDB, strzelcy od Zwiadowcy z sieci ze źródłami, sprawdzeni wynikiem). Stworki TeOgochi w barwach drużyn, bez prawdziwych twarzy i herbów.</p>

            {/* 1. mecz */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <select value={stan.ustawienia.liga} onChange={(e) => void ustaw({ liga: Number(e.target.value) })} className="rounded border border-slate-700 bg-black/40 px-1 py-1">
                    {ligi.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                </select>
                <button onClick={wczytajMecze} disabled={!!pracuje} className="rounded border border-emerald-500/50 px-2 py-1 hover:bg-emerald-900/30 disabled:opacity-40">{pracuje === 'mecze' ? '⟳' : '📋 Ostatnie mecze'}</button>
                <button onClick={() => { setMecz({ id: `r-${Date.now().toString(36)}`, liga: stan.ligi[stan.ustawienia.liga] ?? null, data: new Date().toISOString().slice(0, 10), gospodarze: '', goscie: '', wynik: [0, 0] }); setGole(null); }} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800">✎ Mecz ręcznie</button>
            </div>
            {mecze.length > 0 && (
                <div className="mt-2 grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                    {mecze.map((m) => (
                        <button key={m.id} onClick={() => { setMecz(m); setGole(null); }} className={`rounded border px-2 py-1 text-left ${mecz?.id === m.id ? 'border-emerald-400 bg-emerald-900/30' : 'border-slate-800 hover:border-slate-600'}`}>
                            <span className="text-slate-400">{m.data}</span> {m.gospodarze} <b>{m.wynik[0]}:{m.wynik[1]}</b> {m.goscie}
                        </button>
                    ))}
                </div>
            )}

            {/* 2. fakty + narrator */}
            {mecz && (
                <div className="mt-3 space-y-2 rounded-lg border border-slate-700 bg-black/30 p-2">
                    {mecz.id.startsWith('r-') ? (
                        <div className="flex flex-wrap items-center gap-1">
                            <input value={mecz.gospodarze} onChange={(e) => setMecz({ ...mecz, gospodarze: e.target.value })} placeholder="gospodarze" className="w-36 rounded border border-slate-700 bg-black/40 px-1" />
                            <input type="number" min={0} max={20} value={mecz.wynik[0]} onChange={(e) => setMecz({ ...mecz, wynik: [Number(e.target.value) || 0, mecz.wynik[1]] })} className="w-12 rounded border border-slate-700 bg-black/40 px-1" />
                            :
                            <input type="number" min={0} max={20} value={mecz.wynik[1]} onChange={(e) => setMecz({ ...mecz, wynik: [mecz.wynik[0], Number(e.target.value) || 0] })} className="w-12 rounded border border-slate-700 bg-black/40 px-1" />
                            <input value={mecz.goscie} onChange={(e) => setMecz({ ...mecz, goscie: e.target.value })} placeholder="goście" className="w-36 rounded border border-slate-700 bg-black/40 px-1" />
                            <input type="date" value={mecz.data ?? ''} onChange={(e) => setMecz({ ...mecz, data: e.target.value })} className="rounded border border-slate-700 bg-black/40 px-1" />
                        </div>
                    ) : <div className="font-bold">{mecz.gospodarze} {mecz.wynik[0]}:{mecz.wynik[1]} {mecz.goscie} <span className="font-normal text-slate-400">{mecz.data}</span></div>}
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={fakty} disabled={!!pracuje} className="rounded border border-sky-500/50 px-2 py-1 hover:bg-sky-900/30 disabled:opacity-40">{pracuje === 'fakty' ? '⟳ Zwiadowca szuka…' : '🔭 Zbierz fakty bramek'}</button>
                        <button onClick={() => setGole(Array.from({ length: mecz.wynik[0] + mecz.wynik[1] }, (_, i) => ({ minuta: '', strzelec: '', druzyna: i < mecz.wynik[0] ? 'gospodarze' : 'goscie', asysta: null, opis: null })))} className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800">✎ Wpiszę sam</button>
                        <span className="text-[10px] text-slate-500">Zwiadowca = wyszukiwanie w sieci (Claude albo Gemini z Kibla, grosze za mecz)</span>
                    </div>
                    {gole && (
                        <div className="space-y-1">
                            {gole.map((g, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-1">
                                    <input value={g.minuta} onChange={(e) => zmienGol(i, 'minuta', e.target.value)} placeholder="min" className="w-12 rounded border border-slate-700 bg-black/40 px-1" />
                                    <input value={g.strzelec} onChange={(e) => zmienGol(i, 'strzelec', e.target.value)} placeholder="strzelec" className="w-36 rounded border border-slate-700 bg-black/40 px-1" />
                                    <select value={g.druzyna ?? ''} onChange={(e) => zmienGol(i, 'druzyna', e.target.value)} className="rounded border border-slate-700 bg-black/40 px-1">
                                        <option value="gospodarze">{mecz.gospodarze}</option><option value="goscie">{mecz.goscie}</option>
                                    </select>
                                    <input value={g.asysta ?? ''} onChange={(e) => zmienGol(i, 'asysta', e.target.value)} placeholder="asysta" className="w-28 rounded border border-slate-700 bg-black/40 px-1" />
                                    <input value={g.opis ?? ''} onChange={(e) => zmienGol(i, 'opis', e.target.value)} placeholder="opis akcji" className="min-w-[10rem] flex-1 rounded border border-slate-700 bg-black/40 px-1" />
                                </div>
                            ))}
                            {zrodla.length > 0 && <div className="text-[10px] text-slate-500">źródła: {zrodla.slice(0, 4).map((z) => z.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]).join(', ')}</div>}
                        </div>
                    )}
                    {([['prowadzacy', '🦓🦁 Prowadzący studia — najciekawsze mecze i podsumowania'], ['stado', '🐾 Stado — reszta meczów']] as const).map(([rola, opis]) => (
                        <div key={rola} className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">{opis}:</span>
                            {Object.entries(N).filter(([, n]) => (n.rola ?? 'stado') === rola).map(([id, n]) => (
                                <button key={id} onClick={() => { setNarrator(id); if (wspol === id) setWspol(''); }} title={n.temperament} className={`rounded-full border px-2 py-0.5 ${narrator === id ? 'border-emerald-400 bg-emerald-900/40 text-emerald-100' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{n.emoji} {n.imie}</button>
                            ))}
                        </div>
                    ))}
                    <div className="text-[10px] text-slate-400">{N[narrator]?.temperament}</div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <label>👥 drugi prowadzący <select value={wspol} onChange={(e) => setWspol(e.target.value)} className="rounded border border-slate-700 bg-black/40 px-1">
                            <option value="">— solo</option>
                            {Object.entries(N).filter(([id]) => id !== narrator).map(([id, n]) => <option key={id} value={id}>{n.emoji} {n.imie}</option>)}
                        </select></label>
                        <label>wideo <select value={wideo} onChange={(e) => setWideo(e.target.value)} className="rounded border border-slate-700 bg-black/40 px-1">
                            {Object.entries(stan.wideo ?? { napisy: '🎞️ kadry z napisami' }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select></label>
                        {wspol && <span className="text-[10px] text-slate-500">{N[narrator]?.imie}: intro, strzelec, outro · {N[wspol]?.imie}: okrzyk i opis gola</span>}
                    </div>
                    <details className="text-[10px]"><summary className="cursor-pointer text-slate-400">🗣️ Głos narratora {N[narrator]?.imie}</summary><GlosTeogochi id={narrator} imie={N[narrator]?.imie ?? narrator} onTest={(t) => void mow(t, narrator)} /></details>
                    <button onClick={zrob} disabled={!!pracuje || !gole || gole.some((g) => !g.strzelec || !g.minuta)} className="rounded bg-emerald-600/80 px-3 py-1 font-bold text-white hover:bg-emerald-500 disabled:opacity-40">{pracuje === 'odcinek' ? '⟳' : `🎬 Zrób odcinek — ${N[narrator]?.emoji} ${N[narrator]?.imie}${wspol ? ` & ${N[wspol]?.emoji} ${N[wspol]?.imie}` : ''}`}</button>
                </div>
            )}

            {/* 3. odcinki */}
            {stan.odcinki.length > 0 && (
                <div className="mt-3 space-y-1.5">
                    {stan.odcinki.slice(0, 12).map((o) => {
                        const n = N[o.narrator];
                        const tu = otwarty === o.id;
                        return (
                            <div key={o.id} className="rounded-lg border border-slate-800 bg-black/30 p-2">
                                <button onClick={() => { setOtwarty(tu ? null : o.id); setEdycja(null); }} className="flex w-full flex-wrap items-center justify-between gap-1 text-left">
                                    <span>{n?.emoji}{o.wspol ? N[o.wspol]?.emoji : ''} <b>{o.mecz.gospodarze} {o.mecz.wynik[0]}:{o.mecz.wynik[1]} {o.mecz.goscie}</b> <span className="text-slate-400">· {n?.imie}{o.wspol ? ` & ${N[o.wspol]?.imie}` : ''} · {o.jezyk}{o.wideo === 'studio' ? ' · 🎥 studio' : ''}</span></span>
                                    <span className="font-mono text-[10px] text-slate-400">{ETAPY.map((e) => `${ZNAK[o.etapy[e]?.stan] ?? '·'}`).join(' ')} {o.stan === 'gotowy' ? '✅' : o.stan === 'blad' ? '⚠' : o.stan === 'studio' ? '🎥' : '⟳'}</span>
                                </button>
                                {tu && (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-[10px] text-slate-400">{ETAPY.map((e) => `${e}: ${o.etapy[e]?.stan ?? '—'}${o.etapy[e]?.powod ? ` (${o.etapy[e].powod})` : ''}`).join(' · ')}</div>
                                        {o.powod && <div className="text-rose-300">⚠ {o.powod}</div>}
                                        {o.uwagi.length > 0 && <div className="text-amber-300">{o.uwagi.join(' · ')}</div>}
                                        {o.obrazy && (
                                            <div className="flex gap-1 overflow-x-auto">
                                                {[o.obrazy.intro, ...o.obrazy.gole.flatMap((g) => [g.karta, g.scena]), o.obrazy.wynik].map((p) => <img key={p} src={`${MOST}/api/gol-dnia/${o.id}/obraz/${p}`} alt={p} className="h-16 rounded border border-slate-700" />)}
                                            </div>
                                        )}
                                        {o.scenariusz && !edycja && (
                                            <div className="space-y-0.5 text-[11px]">
                                                <div><b>Intro:</b> {o.scenariusz.intro}</div>
                                                {o.scenariusz.gole.map((g, i) => <div key={i}><b>{o.gole[i]?.minuta}' {o.gole[i]?.strzelec}:</b> {g.przed} <i>„{g.okrzyk}”</i> {g.po}</div>)}
                                                <div><b>Outro:</b> {o.scenariusz.outro}</div>
                                            </div>
                                        )}
                                        {edycja && (
                                            <div className="space-y-1">
                                                {(['intro', 'outro'] as const).map((k) => <textarea key={k} value={edycja[k]} onChange={(e) => setEdycja({ ...edycja, [k]: e.target.value })} rows={2} className="w-full rounded border border-slate-700 bg-black/40 px-1" />)}
                                                {edycja.gole.map((g, i) => (['przed', 'okrzyk', 'po', 'scena'] as const).map((k) => (
                                                    <input key={`${i}-${k}`} value={g[k]} onChange={(e) => setEdycja({ ...edycja, gole: edycja.gole.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} placeholder={`${i + 1} ${k}`} className="w-full rounded border border-slate-700 bg-black/40 px-1" />
                                                )))}
                                                <button onClick={zajety('popraw', async () => { await api(`/api/gol-dnia/${o.id}/scenariusz`, { method: 'PUT', body: JSON.stringify({ scenariusz: edycja }) }); setEdycja(null); toast.success('✎ Zapisane — narrator uczy się z poprawki, odcinek liczy się od nowa'); void odswiez(); })} className="rounded border border-emerald-500/60 px-2 py-0.5">💾 Zapisz i przerób</button>
                                            </div>
                                        )}
                                        {o.stan === 'studio' && <div className="rounded border border-emerald-500/40 bg-emerald-900/20 p-2 text-emerald-100">🎥 Scenariusz i obrazy gotowe — odcinek czeka na nagranie w Studiu Zebrra Football. <button onClick={() => otworzStudio(o.id)} className="ml-1 rounded bg-emerald-600/80 px-2 py-0.5 font-bold text-white">🦓 Otwórz Studio</button></div>}
                                        {o.plik && <video src={`${MOST}/api/gol-dnia/${o.id}/wideo`} controls className="max-h-56 rounded" />}
                                        {o.studio?.plik && o.studio.plik !== o.plik && <div className="text-[10px] text-slate-400">🎥 Wersja ze Studia (obok): <video src={`${MOST}/api/gol-dnia/${o.id}/wideo?studio=1`} controls className="mt-1 max-h-56 rounded" />{o.studio.publikacja?.id && <span className="text-emerald-300">📺 opis od Kronikarza czeka na ✓ w Izbie</span>}</div>}
                                        <div className="flex flex-wrap gap-1.5">
                                            {o.scenariusz && !edycja && !['robi', 'w_kolejce'].includes(o.stan) && <button onClick={() => setEdycja(o.scenariusz)} className="rounded border border-slate-600 px-2 py-0.5">✎ Popraw scenariusz</button>}
                                            {o.scenariusz && o.obrazy && !['robi', 'w_kolejce', 'studio'].includes(o.stan) && <button onClick={() => otworzStudio(o.id)} className="rounded border border-emerald-500/60 px-2 py-0.5">🎥 Nagraj w Studiu</button>}
                                            {o.stan === 'blad' && <button onClick={zajety('ponow', async () => { await api(`/api/gol-dnia/${o.id}/ponow`, { method: 'POST', body: '{}' }); void odswiez(); })} className="rounded border border-amber-500/60 px-2 py-0.5">↻ Ponów</button>}
                                            <span className="text-[10px] text-slate-500">🎙️ Ten sam mecz innym głosem:</span>
                                            {Object.entries(N).filter(([id]) => id !== o.narrator).map(([id, x]) => (
                                                <button key={id} onClick={zajety('wersja', async () => { const d = await api<{ odcinek: Odcinek }>(`/api/gol-dnia/${o.id}/wersja`, { method: 'POST', body: JSON.stringify({ narrator: id }) }); setOtwarty(d.odcinek.id); void odswiez(); })} title={x.temperament} className="rounded-full border border-slate-700 px-2 py-0.5 hover:border-emerald-400">{x.emoji} {x.imie}</button>
                                            ))}
                                            <button onClick={zajety('usun', async () => { if (!confirm('Usunąć odcinek (pliki pracy)? Gotowy film w Montażowni zostaje.')) return; await api(`/api/gol-dnia/${o.id}`, { method: 'DELETE' }); void odswiez(); })} className="ml-auto rounded border border-rose-700/60 px-2 py-0.5 text-rose-300">🗑</button>
                                        </div>
                                        {o.publikacja?.id && <div className="text-[10px] text-emerald-300">📺 Opis od Kronikarza czeka na Twoje ✓ w Izbie (publikacje YouTube wyżej).</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default GolDniaPanel;
