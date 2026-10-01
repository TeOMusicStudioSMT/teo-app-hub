/**
 * 👑 GlownyCzat — rozmowa z Głównym (Claude Code w tle, services/Glowny.js) w Hubie: Creative Zone, KatedraChat, Orb.
 *
 * Zamiast okna terminala, którego nikt nie widział: wiadomości, narzędzia, odpowiedzi i PROŚBY na żywo (SSE).
 * Prośba = polecenie, którego Główny nie może wykonać bez zgody Suwerena. Tłumacz mówi po ludzku, co ono zrobi,
 * czym grozi i po co Główny go chce — dopiero potem ✓ albo ✕. Pliki Katedry Główny zmienia sam (decyzja Suwerena).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { obrazyZ, nazwaZrzutu, doDataUrl } from '../../lib/schowekObrazy';

const MOST = 'http://127.0.0.1:3001';

interface Prosba { id: string; narzedzie: string; polecenie: string; coRobi: string; ryzyko: string; ryzykoSlownie: string; dlaczego: string | null; stan: 'czeka' | 'zgoda' | 'odmowa' }
interface Wpis { kto: 'suweren' | 'glowny' | 'narzedzie' | 'prosba' | 'decyzja' | 'blad'; tresc?: string; zalaczniki?: string[]; narzedzie?: string; opis?: string | null; prosba?: Prosba; kiedy: string }
interface Sesja { id: string; tytul: string; model: string; wpisy: Wpis[]; prosby: Prosba[]; trwa: boolean; blad: string | null }
interface SesjaSkrot { id: string; tytul: string; ostatnia: string; trwa: boolean; czeka: number }
interface StanGlownego { program: string; zrodlo: string; model: string; chmura: boolean; katalogi: string[] }

const KLUCZ_MODELU = 'otakos_glowny_model';
/** Małe modele (≤ 4B, „e2b/e4b") gubią się w narzędziach Claude Code — mówimy to przy wyborze, nie po porażce. */
export const malyModel = (m: string) => /(^|[:\-_])(e[24]b|[0-4](\.\d+)?b)(\b|[-_:]|$)/i.test(m);
const czytajModel = () => { try { return localStorage.getItem(KLUCZ_MODELU) || ''; } catch { return ''; } };

const KOLOR_RYZYKA: Record<string, string> = { niskie: 'border-emerald-500/50 bg-emerald-950/30', srednie: 'border-amber-500/50 bg-amber-950/30', wysokie: 'border-rose-500/60 bg-rose-950/40', nieznane: 'border-slate-500/50 bg-slate-900/50' };

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

/** `obrazy` — zrzuty przekazane z zewnątrz (np. wklejone w Manifest Creative Zone) — trafiają do załączników. */
export const GlownyCzat: React.FC<{ zrodlo?: string; zadanie?: string; obrazy?: File[]; kompaktowy?: boolean; className?: string }> = ({ zrodlo = 'czat', zadanie, obrazy, kompaktowy = false, className = '' }) => {
    const [stan, setStan] = useState<StanGlownego | null>(null);
    const [sesje, setSesje] = useState<SesjaSkrot[]>([]);
    const [sesja, setSesja] = useState<Sesja | null>(null);
    const [tekst, setTekst] = useState(zadanie ?? '');
    const [wysyla, setWysyla] = useState(false);
    const [modele, setModele] = useState<string[]>([]);
    const [model, setModel] = useState<string>(czytajModel);
    const [zalaczniki, setZalaczniki] = useState<string[]>([]);   // nazwy plików w moście (po wgraniu)
    const [wgrywa, setWgrywa] = useState(0);
    const [przeciaga, setPrzeciaga] = useState(false);
    const dol = useRef<HTMLDivElement>(null);
    const plikRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch(`${MOST}/api/ollama/models`).then((r) => r.json()).then((d) => setModele(d.models ?? [])).catch(() => {});
    }, []);
    const wybierzModel = (m: string) => { setModel(m); try { m ? localStorage.setItem(KLUCZ_MODELU, m) : localStorage.removeItem(KLUCZ_MODELU); } catch { /* bez pamięci */ } };
    const modelTeraz = model || sesja?.model || stan?.model || '';

    /** Zrzut ekranu → most (plik w _OtakOs_Wymiar/glowny/zalaczniki) → Główny otworzy go narzędziem Read. */
    const wgraj = async (pliki: File[]) => {
        const obrazy = pliki.filter((f) => f.type.startsWith('image/'));
        if (!obrazy.length) { if (pliki.length) toast('👑 Główny przyjmuje tu obrazy (zrzuty ekranu). Pliki Katedry czyta sam — podaj ścieżkę.'); return; }
        setWgrywa((n) => n + obrazy.length);
        for (const f of obrazy) {
            try {
                const d = await zMostu<{ plik: string }>('/api/glowny/zalacznik', { method: 'POST', body: JSON.stringify({ dane: await doDataUrl(f), nazwa: nazwaZrzutu(f) }) });
                setZalaczniki((z) => [...z, d.plik].slice(0, 10));
            } catch (e: any) { toast.error(`🖼️ ${e.message}`); }
            finally { setWgrywa((n) => n - 1); }
        }
    };

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

    useEffect(() => { if (obrazy?.length) wgraj(obrazy); }, [obrazy]); // eslint-disable-line react-hooks/exhaustive-deps

    const otworz = async (sid: string) => {
        try { setSesja((await zMostu<{ sesja: Sesja }>(`/api/glowny/sesja/${sid}`)).sesja); } catch (e: any) { toast.error(e.message); }
    };
    const wyslij = async () => {
        const t = tekst.trim();
        if ((!t && !zalaczniki.length) || wysyla || wgrywa) return;
        setWysyla(true);
        try {
            const d = await zMostu<{ sesja: string }>('/api/glowny/wiadomosc', { method: 'POST', body: JSON.stringify({ tekst: t, sesja: sesja?.id ?? null, zrodlo, model: model || null, zalaczniki }) });
            setTekst(''); setZalaczniki([]);
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
        <div className={`flex flex-col gap-2 rounded-xl border bg-black/40 p-3 text-xs text-slate-200 ${przeciaga ? 'border-cyan-400 ring-1 ring-cyan-400/60' : 'border-amber-500/30'} ${className}`}
            onDragOver={(e) => { if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) { e.preventDefault(); setPrzeciaga(true); } }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setPrzeciaga(false); }}
            onDrop={(e) => { setPrzeciaga(false); const f = Array.from(e.dataTransfer?.files ?? []); if (f.length) { e.preventDefault(); wgraj(f); } }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-amber-200">👑 Główny <span className="font-normal text-slate-400">— Claude Code w Katedrze{stan ? ` · ${stan.chmura ? 'chmura' : 'Ollama'}` : ''}</span></div>
                <div className="flex items-center gap-1.5">
                    {stan && !stan.chmura && (
                        <select value={model} onChange={(e) => wybierzModel(e.target.value)}
                            title="Model Głównego (Ollama). Zmiana działa od następnej wiadomości — także w trwającej rozmowie."
                            className={`max-w-[11rem] rounded border bg-black/50 px-1.5 py-0.5 text-[11px] ${malyModel(modelTeraz) ? 'border-amber-500/70 text-amber-200' : 'border-slate-700'}`}>
                            <option value="">domyślny ({stan.model})</option>
                            {modele.map((m) => <option key={m} value={m}>{malyModel(m) ? '⚠ ' : ''}{m}</option>)}
                        </select>
                    )}
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
            {stan && !stan.chmura && malyModel(modelTeraz) && (
                <div className="text-[10px] text-amber-300/90">⚠ {modelTeraz} to mały model — Claude Code potrzebuje mocnego w narzędziach (np. qwen3-coder, gpt-oss:20b, gemma4 26B/31B). Mały często mówi „nie mam narzędzia”, choć Katedra je ma.</div>
            )}

            <div className={`space-y-1.5 overflow-y-auto pr-1 ${kompaktowy ? 'max-h-64' : 'max-h-[28rem]'}`}>
                {!sesja && <div className="text-[11px] text-slate-400">Napisz zadanie — Główny czyta i zmienia pliki Katedry sam, zleca pracę TeOgochi, a o polecenia (instalacje, git, usuwanie…) prosi Cię z wyjaśnieniem.</div>}
                {sesja?.wpisy.map((w, i) => {
                    if (w.kto === 'suweren') return (
                        <div key={i} className="ml-8 rounded-lg bg-sky-950/50 px-2 py-1.5 text-sky-100">
                            {w.tresc}
                            {!!w.zalaczniki?.length && <div className="mt-1 flex flex-wrap gap-1">{w.zalaczniki.map((z) => (
                                <a key={z} href={`${MOST}/api/glowny/zalacznik/${encodeURIComponent(z)}`} target="_blank" rel="noreferrer">
                                    <img src={`${MOST}/api/glowny/zalacznik/${encodeURIComponent(z)}`} alt={z} className="h-14 rounded border border-sky-700/60 object-cover" />
                                </a>))}</div>}
                        </div>);
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
                                <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded bg-black/50 px-1.5 py-1 font-mono text-[10px] text-slate-300">{p.narzedzie}: {p.polecenie}</div>
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

            {(zalaczniki.length > 0 || wgrywa > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {zalaczniki.map((z) => (
                        <div key={z} className="relative">
                            <img src={`${MOST}/api/glowny/zalacznik/${encodeURIComponent(z)}`} alt={z} className="h-12 rounded border border-slate-600 object-cover" />
                            <button onClick={() => setZalaczniki((x) => x.filter((y) => y !== z))} title="Usuń z wiadomości"
                                className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-black/80 text-[9px] leading-4 text-slate-200 hover:bg-rose-700">✕</button>
                        </div>))}
                    {wgrywa > 0 && <span className="text-[10px] text-cyan-300">⟳ wgrywam {wgrywa}…</span>}
                </div>
            )}
            <div className="flex gap-1.5">
                <input ref={plikRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; wgraj(f); }} />
                <button onClick={() => plikRef.current?.click()} title="Dołącz zrzut ekranu (albo wklej Ctrl+V / upuść tutaj)"
                    disabled={!!sesja?.trwa || czeka.length > 0}
                    className="self-end rounded border border-slate-600 px-2 py-1.5 hover:bg-slate-800 disabled:opacity-40">🖼️</button>
                <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={kompaktowy ? 2 : 3}
                    onPaste={(e) => { const o = obrazyZ(e.clipboardData); if (o.length) { e.preventDefault(); wgraj(o); } }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) wyslij(); }}
                    placeholder={czeka.length ? 'Najpierw zdecyduj o prośbie powyżej (✓ / ✕)…' : sesja ? 'Dalej… (Ctrl+Enter · Ctrl+V wkleja zrzut)' : 'Zadanie dla Głównego… (Ctrl+Enter · zrzut ekranu: Ctrl+V albo upuść)'}
                    disabled={!!sesja?.trwa || czeka.length > 0}
                    className="flex-1 resize-none rounded border border-slate-700 bg-black/50 px-2 py-1.5 text-xs disabled:opacity-50" />
                <button onClick={wyslij} disabled={(!tekst.trim() && !zalaczniki.length) || wgrywa > 0 || wysyla || !!sesja?.trwa || czeka.length > 0}
                    className="self-end rounded bg-amber-600/80 px-3 py-1.5 font-bold text-amber-50 hover:bg-amber-500 disabled:opacity-40">{wysyla ? '⟳' : '👑 Wyślij'}</button>
            </div>
        </div>
    );
};

export default GlownyCzat;
