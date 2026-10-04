/**
 * 🎙️ NotebookTwinPanel — Spectrum Podcast Twin (wizualizacja dwóch gospodarzy)
 *
 * Dwa awatary (Iskra 🔥 / Echo 🌊) z dynamicznymi equalizerami mowy reagującymi
 * na to, kto aktualnie mówi (triggerAnimation). Pole tematu + generowanie kolejnych
 * tur dialogu + log skryptu rozmowy na żywo.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, Play, RotateCcw, Download, Send, FileUp, Repeat, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { NotebookPodcastService, SOVEREIGN_WELCOME, rozmowaDoTekstu, czyBlad, materialProjektu, type PodcastTurn, type TwinAnimation, type ProjektDoRozmowy } from '../../src/services/NotebookPodcastService';
import KsiegaOdbioru from './KsiegaOdbioru';
import KwantowyTunel from './KwantowyTunel';
import { PodcastCore } from '../PodcastCore';
import StudioPodcastuPanel from './StudioPodcastuPanel';

const service = new NotebookPodcastService();
const STORE_KEY = 'teo_podcast_twin_log';   // pamięć trwała rozmowy (Rozczytelnia agentów)

/** 🔁 Projekt stada, który wrócił do gospodarzy: o nim jest rozmowa, z niej idą uwagi na kolejne rundy. */
interface Warsztat { id: string; nazwa: string; material: string; stan: string; runda: number; rundy: number; ocena: number | null; karta: { id: string; etap: string } | null; }
interface PodcastMemory { topic: string; turns: PodcastTurn[]; warsztat?: Warsztat | null; }
interface ProjektNaLiscie { id: string; nazwa: string; stan: string; runda?: number; rundy?: number; oceny?: { ocena: number | null }[] }
const MOST = 'http://127.0.0.1:3001';
const loadMemory = (): PodcastMemory => {
    try { const m = JSON.parse(localStorage.getItem(STORE_KEY) || ''); if (m && Array.isArray(m.turns)) return m; } catch { /* brak */ }
    return { topic: 'Suwerenność danych i lokalne AI w Katedrze OtakOS', turns: [] };
};

/** Equalizer 5 słupków — animuje się gdy host „mówi". */
const Equalizer: React.FC<{ active: boolean; color: string }> = ({ active, color }) => (
    <div className="flex items-end gap-[3px] h-6" aria-hidden>
        {[0, 1, 2, 3, 4].map(i => (
            <span key={i}
                className={active ? 'eq-bar' : ''}
                style={{
                    width: 4, borderRadius: 2, background: color,
                    height: active ? undefined : 4,
                    opacity: active ? 1 : 0.35,
                    animationDelay: `${i * 0.12}s`,
                }}
            />
        ))}
    </div>
);

interface HostProps { name: string; emoji: string; color: string; active: boolean; }
const HostAvatar: React.FC<HostProps> = ({ name, emoji, color, active }) => (
    <div className="flex flex-col items-center gap-2">
        <motion.div
            animate={active ? { scale: [1, 1.06, 1], boxShadow: `0 0 28px ${color}80` } : { scale: 1, boxShadow: `0 0 8px ${color}30` }}
            transition={active ? { repeat: Infinity, duration: 0.9 } : {}}
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-2"
            style={{ borderColor: color, background: `radial-gradient(circle, ${color}22, #05080d)` }}
        >
            {emoji}
        </motion.div>
        <div className="text-xs font-bold tracking-widest" style={{ color }}>{name}</div>
        <Equalizer active={active} color={color} />
    </div>
);

export const NotebookTwinPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const mem0 = loadMemory();
    const [topic, setTopic] = useState(mem0.topic);
    const [turns, setTurns] = useState<PodcastTurn[]>(mem0.turns);
    const [anim, setAnim]   = useState<TwinAnimation>('IDLE');
    const [busy, setBusy]   = useState(false);
    const [view, setView]   = useState<'rozmowa' | 'video_podcast' | 'studio' | 'koom'>('rozmowa');
    const [warsztat, setWarsztat] = useState<Warsztat | null>(mem0.warsztat ?? null);
    const [projekty, setProjekty] = useState<ProjektNaLiscie[] | null>(null);   // lista do wyboru (null = zamknięta)
    const [rundyDalej, setRundyDalej] = useState(1);
    const [odsylam, setOdsylam] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [turns]);

    // 💾 Pamięć trwała — zapis rozmowy, by gospodarze kontynuowali zamiast zaczynać od nowa.
    useEffect(() => {
        try { localStorage.setItem(STORE_KEY, JSON.stringify({ topic, turns, warsztat })); } catch { /* limit storage */ }
    }, [topic, turns, warsztat]);

    const handleStreamStateChange = useCallback((isBroadcasting: boolean) => {
        const timestamp = new Date().toLocaleTimeString();
        setTurns(prev => [
            ...prev,
            {
                hostA: `[BROADCAST ${timestamp}] ${isBroadcasting ? '● Rozpoczęto transmisję wideo RTMP na żywo (YouTube Ingest)' : '◯ Zakończono transmisję wideo'}`,
                hostB: `[AI ORB 0.00G] Strumień ${isBroadcasting ? 'aktywny' : 'zakończony'}. Zdarzenie przekazane do pamięci Księgi Odbioru (KOOM).`,
                triggerAnimation: 'BOTH',
            }
        ]);
    }, []);

    // 💉 Wnioski Orba wstrzyknięte do Księgi lądują też w skrypcie rozmowy —
    // Rozczytelnia i KOOM widzą to samo zdarzenie, każde po swojemu.
    const handlePlanInjected = useCallback((texts: string[]) => {
        if (!texts.length) return;
        setTurns(prev => [
            ...prev,
            {
                hostA: `[KOOM 💉] Wniosek z anteny → Księga Odbioru (${texts.length} zadań NEW dla Mechanika).`,
                hostB: texts.map(t => `• ${t}`).join('\n'),
                triggerAnimation: 'B_SPEAKING',
            }
        ]);
    }, []);

    const generate = useCallback(async () => {
        if (busy || !topic.trim()) return;
        setBusy(true); setAnim('BOTH');
        try {
            const turn = await service.generateTurn(topic, turns, warsztat?.material);
            setTurns(prev => [...prev, turn]);
            // Sekwencja mowy: najpierw A, potem B (efekt rozmowy).
            setAnim('A_SPEAKING');
            setTimeout(() => setAnim('B_SPEAKING'), 1600);
            setTimeout(() => setAnim('IDLE'), 3200);
        } finally {
            setBusy(false);
        }
    }, [busy, topic, turns, warsztat]);

    // 🔁 Projekt stada wraca do rozmowy: lista projektów z mostu → wybrany staje się materiałem odcinka.
    const pokazProjekty = async () => {
        if (projekty) { setProjekty(null); return; }
        try {
            const d = await fetch(`${MOST}/api/stado/projekty`).then((r) => r.json());
            setProjekty(d.projekty ?? []);
        } catch (e) { toast.error(`Most nie odpowiada: ${(e as Error).message}`); }
    };
    const wezProjekt = async (id: string) => {
        try {
            const [d, st] = await Promise.all([
                fetch(`${MOST}/api/stado/projekty/${encodeURIComponent(id)}`).then((r) => r.json()),
                fetch(`${MOST}/api/stol`).then((r) => r.json()).catch(() => ({ karty: [] })),
            ]);
            if (!d.success) throw new Error(d.message || 'brak projektu');
            const p = d.projekt as ProjektDoRozmowy;
            if (turns.length && !window.confirm('Zacząć nowy odcinek o tym projekcie? Obecna rozmowa zniknie (zapisz ją wcześniej do .txt).')) return;
            const karta = (st.karty ?? []).find((k: { projektSkrot?: { id: string } }) => k.projektSkrot?.id === p.id);
            setWarsztat({
                id: p.id, nazwa: p.nazwa, material: materialProjektu(p), stan: p.stan, runda: p.runda ?? 1, rundy: p.rundy ?? 1,
                ocena: p.oceny?.at(-1)?.ocena ?? null, karta: karta ? { id: karta.id, etap: karta.etap } : null,
            });
            setTopic(`Projekt „${p.nazwa}" wraca z warsztatu — co mamy i co dalej?`);
            setTurns([]); setAnim('IDLE'); setProjekty(null);
        } catch (e) { toast.error(`Nie wczytałem projektu: ${(e as Error).message}`); }
    };
    /** Odeślij projekt na kolejne rundy z tą rozmową jako uwagami (karta Stołu → „Doskonal", inaczej wprost). */
    const odeslijNaRundy = async () => {
        if (!warsztat) return;
        setOdsylam(true);
        try {
            const uwagi = rozmowaDoTekstu(topic, turns);
            const przezStol = warsztat.karta && ['do_akceptacji', 'zratyfikowane'].includes(warsztat.karta.etap);
            const url = przezStol ? `${MOST}/api/stol/${encodeURIComponent(warsztat.karta!.id)}/doskonal` : `${MOST}/api/stado/projekt/${encodeURIComponent(warsztat.id)}/runda`;
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rundy: rundyDalej, uwagi, zrodloUwag: 'rozmowa Podcast Twin' }) });
            const d = await r.json().catch(() => ({ success: false, message: `most odpowiedział ${r.status}` }));
            if (!d.success) throw new Error(d.message);
            toast.success(`„${warsztat.nazwa}" wraca do stada — ${rundyDalej} ${rundyDalej === 1 ? 'runda' : 'rundy'} z uwagami z tej rozmowy. Katedra powie, gdy skończą.`, { duration: 7000 });
            setWarsztat({ ...warsztat, stan: 'trwa', karta: warsztat.karta ? { ...warsztat.karta, etap: 'opracowuje' } : null });
        } catch (e) { toast.error(`Nie odesłałem: ${(e as Error).message}`); }
        finally { setOdsylam(false); }
    };

    // 💾 Rozmowa do pliku .txt (Suweren składał je dotąd ręcznie) — bez tur z błędem mostu.
    const pobierzTxt = () => {
        const tekst = rozmowaDoTekstu(topic, turns);
        const nazwa = (topic.trim().slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'rozmowa');
        const url = URL.createObjectURL(new Blob([tekst], { type: 'text/plain;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = `PodcastTwin_${nazwa}.txt`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const turWRozmowie = turns.filter(t => !czyBlad(t)).length;

    // 🪑 Na Stół ratyfikacji (services/Stol.js): karta czeka na decyzję Suwerena — w Katedrze albo w StoL.
    const plikRef = useRef<HTMLInputElement>(null);
    const [naStol, setNaStol] = useState(false);
    const polozNaStol = async (tytul: string, tresc: string, zrodlo: 'podcast-twin' | 'plik') => {
        setNaStol(true);
        try {
            const r = await fetch('http://127.0.0.1:3001/api/stol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tytul, tresc, zrodlo }) });
            const d = await r.json().catch(() => ({ success: false, message: `most odpowiedział ${r.status}` }));
            if (d.success) toast.success(`„${d.karta.tytul}" leży na Stole — decyzja w Katedrze albo w StoL`);
            else toast.error(`Stół nie przyjął karty: ${d.message}`);
        } catch (e) { toast.error(`Most nie odpowiada: ${(e as Error).message}`); }
        finally { setNaStol(false); }
    };
    const plikNaStol = async (plik: File | undefined) => {
        if (!plik) return;
        const tresc = await plik.text();
        // Tytuł: pierwsza linia pliku (bez dopisku po „—"), a gdy jej brak — nazwa pliku.
        const pierwsza = tresc.split('\n').map(l => l.trim()).find(Boolean) ?? '';
        const tytul = (pierwsza.split(' — ')[0] || plik.name.replace(/\.txt$/i, '')).slice(0, 80);
        await polozNaStol(tytul, tresc, 'plik');
        if (plikRef.current) plikRef.current.value = '';
    };

    const reset = () => {
        setTurns([]); setAnim('IDLE'); setWarsztat(null);
        try { localStorage.removeItem(STORE_KEY); } catch { /* noop */ }
    };

    const aActive = busy || anim === 'A_SPEAKING' || anim === 'BOTH';
    const bActive = busy || anim === 'B_SPEAKING' || anim === 'BOTH';

    // Zakładki: 🎙️ Rozmowa (Rozczytelnia) | 📺 Wideopodcast 1/1 | 🎛️ Studio Podcastu (studia z hostami, odcinki z gośćmi) | 📖 Księga KOOM
    const tabBar = (
        <div className="flex items-center gap-2 mb-2">
            {([['rozmowa', '🎙️ Rozmowa'], ['video_podcast', '📺 Wideopodcast 1/1'], ['studio', '🎛️ Studio Podcastu'], ['koom', '📖 Księga KOOM']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors border
                        ${view === k ? 'bg-fuchsia-700/50 text-white border-fuchsia-400/50' : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
                    {label}
                </button>
            ))}
            {onClose && (
                <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white text-sm border border-slate-700 rounded-lg px-3 py-1">✕ Zamknij</button>
            )}
        </div>
    );

    if (view === 'koom') {
        return <div className="w-full max-w-3xl mx-auto">{tabBar}<KsiegaOdbioru /></div>;
    }

    if (view === 'studio') {
        return <div className="w-full max-w-4xl mx-auto">{tabBar}<StudioPodcastuPanel /></div>;
    }

    if (view === 'video_podcast') {
        return (
            <div className="w-full max-w-4xl mx-auto space-y-3">
                {tabBar}
                <div className="w-full h-[650px]">
                    <PodcastCore onStreamStateChange={handleStreamStateChange} onPlanInjected={handlePlanInjected} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto">
        {tabBar}
        <KwantowyTunel />
        <div className="bg-[#05080d] border border-fuchsia-500/25 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] font-sans text-slate-200">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-fuchsia-500/20 bg-gradient-to-r from-[#140518] to-[#0a0814]">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-black border border-fuchsia-500/40 flex items-center justify-center">
                        <Mic size={22} className="text-fuchsia-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-cyan-400">PODCAST TWIN</h2>
                        <p className="text-[10px] text-slate-500 tracking-wider">
                            Spectrum · Rozczytelnia agentów · {turns.length > 0 ? <span className="text-fuchsia-400/70">💾 {turns.length} tur w pamięci</span> : 'NotebookLM-style'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Powitanie Suwerena + awatary */}
            <div className="px-6 pt-5">
                <div className="text-center text-sm italic text-fuchsia-300/80 mb-4">„{SOVEREIGN_WELCOME}"</div>
                <div className="flex items-center justify-center gap-12">
                    <HostAvatar name="ISKRA" emoji="🔥" color="#f472b6" active={aActive} />
                    <span className="text-2xl opacity-40">🎙️</span>
                    <HostAvatar name="ECHO" emoji="🌊" color="#22d3ee" active={bActive} />
                </div>
            </div>

            {/* Sterowanie */}
            <div className="px-6 py-4 flex flex-wrap gap-2">
                <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generate()}
                    placeholder="Temat odcinka..."
                    className="flex-1 min-w-[220px] bg-black/60 border border-fuchsia-700/30 focus:border-fuchsia-500/60 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                />
                <button onClick={generate} disabled={busy || !topic.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-fuchsia-700/70 hover:bg-fuchsia-600 text-white border border-fuchsia-400/40 disabled:opacity-40 transition-all">
                    <Play size={14} /> {busy ? 'GENERUJĘ...' : turns.length ? 'KOLEJNA TURA' : 'START ROZMOWY'}
                </button>
                <button onClick={pobierzTxt} disabled={turWRozmowie === 0} title="Zapisz rozmowę do pliku .txt (bez tur z błędem mostu)"
                    className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 disabled:opacity-40 flex items-center gap-1">
                    <Download size={14} /> .txt
                </button>
                <button onClick={() => polozNaStol(topic.trim().slice(0, 80), rozmowaDoTekstu(topic, turns), 'podcast-twin')} disabled={turWRozmowie === 0 || naStol}
                    title="Połóż tę rozmowę na Stół ratyfikacji (decyzja w Katedrze albo w StoL)"
                    className="px-3 py-2 rounded-xl text-xs bg-amber-900/40 hover:bg-amber-800/50 border border-amber-600/40 text-amber-200 disabled:opacity-40 flex items-center gap-1">
                    <Send size={14} /> Na Stół
                </button>
                <button onClick={() => plikRef.current?.click()} disabled={naStol}
                    title="Połóż gotowy plik .txt na Stół (np. rozmowę przepisaną na GRV)"
                    className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 disabled:opacity-40 flex items-center gap-1">
                    <FileUp size={14} /> Plik
                </button>
                <input ref={plikRef} type="file" accept=".txt,text/plain" className="hidden" onChange={e => plikNaStol(e.target.files?.[0])} />
                <button onClick={pokazProjekty} disabled={busy}
                    title="Projekt stada wraca do rozmowy: Iskra i Echo omawiają Biblię, oceny Sędziego i braki — potem odsyłasz go na kolejne rundy"
                    className="px-3 py-2 rounded-xl text-xs bg-violet-900/40 hover:bg-violet-800/50 border border-violet-500/40 text-violet-200 disabled:opacity-40 flex items-center gap-1">
                    <Repeat size={14} /> Projekt stada
                </button>
                <button onClick={reset} disabled={busy} title="Nowy odcinek (wyczyść pamięć rozmowy)"
                    className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 disabled:opacity-40">
                    <RotateCcw size={14} />
                </button>
            </div>

            {/* 🔁 Wybór projektu stada do rozmowy */}
            {projekty && (
                <div className="mx-6 mb-3 rounded-xl border border-violet-500/30 bg-violet-950/20 p-2 space-y-1">
                    {projekty.length === 0 && <div className="text-[11px] text-slate-500">Stado nie ma jeszcze projektów.</div>}
                    {projekty.map((p) => {
                        const o = p.oceny?.at(-1)?.ocena;
                        return (
                            <button key={p.id} onClick={() => wezProjekt(p.id)} disabled={p.stan === 'trwa'}
                                className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-violet-900/40 disabled:opacity-40">
                                <b className="text-violet-100">{p.nazwa}</b>
                                <span className="text-slate-500"> · {p.stan === 'trwa' ? 'stado pracuje' : p.stan}{(p.rundy ?? 1) > 1 ? ` · runda ${p.runda ?? 1}/${p.rundy}` : ''}{o != null ? ` · Sędzia ${o}/10` : ''}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 🔁 Projekt na warsztacie: o nim jest rozmowa, z niej idą uwagi na kolejne rundy */}
            {warsztat && (
                <div className="mx-6 mb-3 rounded-xl border border-violet-500/40 bg-violet-950/30 p-3 text-xs space-y-2">
                    <div className="flex items-center gap-2">
                        <Repeat size={14} className="text-violet-300" />
                        <span className="text-violet-100 font-bold">{warsztat.nazwa}</span>
                        <span className="text-slate-400">· runda {warsztat.runda}/{warsztat.rundy}{warsztat.ocena != null ? ` · Sędzia ${warsztat.ocena}/10` : ''}{warsztat.karta ? ` · karta Stołu (${warsztat.karta.etap})` : ''}{warsztat.stan === 'trwa' ? ' · stado pracuje' : ''}</span>
                        <button onClick={() => setWarsztat(null)} title="Odłącz projekt od rozmowy" className="ml-auto text-slate-500 hover:text-slate-200"><X size={14} /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-slate-400 flex items-center gap-1">rund
                            <input type="number" min={1} max={5} value={rundyDalej} onChange={(e) => setRundyDalej(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                                className="w-12 bg-black/60 border border-violet-700/40 rounded px-1 py-0.5 text-slate-200" />
                        </label>
                        <button onClick={odeslijNaRundy} disabled={odsylam || turWRozmowie === 0 || warsztat.stan === 'trwa'}
                            title="Stado dostanie tę rozmowę jako uwagi Suwerena do kolejnych rund (i Sędzia sprawdzi, czy je uwzględniło)"
                            className="px-3 py-1.5 rounded-lg bg-violet-700/60 hover:bg-violet-600 text-white border border-violet-400/40 disabled:opacity-40 flex items-center gap-1">
                            <Send size={12} /> {odsylam ? 'Odsyłam…' : 'Odeślij na rundy z uwagami z rozmowy'}
                        </button>
                        {turWRozmowie === 0 && <span className="text-slate-500">— najpierw niech porozmawiają (START).</span>}
                    </div>
                </div>
            )}

            {/* Log skryptu rozmowy */}
            <div ref={logRef} className="mx-6 mb-6 max-h-72 overflow-y-auto bg-black/40 rounded-xl border border-fuchsia-900/30 p-3 space-y-2">
                {turns.length === 0 ? (
                    <div className="text-[11px] text-slate-600 text-center py-6">Wpisz temat i kliknij START — gospodarze zaczną rozmowę.</div>
                ) : turns.map((t, i) => (
                    <div key={i} className="space-y-1">
                        {t.hostA && (
                            <div className="text-xs"><span className="font-bold" style={{ color: '#f472b6' }}>🔥 ISKRA:</span> <span className="text-slate-300">{t.hostA}</span></div>
                        )}
                        {t.hostB && (
                            <div className="text-xs"><span className="font-bold" style={{ color: '#22d3ee' }}>🌊 ECHO:</span> <span className="text-slate-300">{t.hostB}</span></div>
                        )}
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes eqPulse { 0%,100% { height: 5px; } 50% { height: 22px; } }
                .eq-bar { animation: eqPulse 0.85s ease-in-out infinite; }
            `}</style>
        </div>
        </div>
    );
};

export default NotebookTwinPanel;
