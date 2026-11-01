/**
 * 🎵🔌 Suno w Impresariacie (2026-11-01) — konto Suno Suwerena podłączone do Katedry przez oficjalny serwer MCP Suno
 * (services/SunoMcp.js): „🔌 Połącz z Suno” = logowanie w Suno → powrót do mostu, token w Skarbcu 0.00G.
 * Narzędzia biorą się z listy Suno (nic tu nie zgadujemy); 💳 = może wydać kredyty → okno zgody przed wywołaniem.
 * Gotowe utwory most zapisuje w _OtakOs_Muzyka/Suno MCP/ (biblioteka, Radio, Taneczne Starcie, Warsztat).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';
async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}

interface Schemat { type?: string; properties?: Record<string, { type?: string; description?: string; enum?: unknown[] }>; required?: string[] }
interface Narzedzie { nazwa: string; opis: string; zgoda: boolean; schemat: Schemat | null }
interface Historia { kiedy: string; narzedzie: string; zgoda: boolean; blad: boolean; utwory: string[] }
interface Stan { polaczone: boolean; powod?: string; blad?: string | null; katalog: string; polaczono: string | null; narzedzia?: Narzedzie[]; serwer?: { name?: string; version?: string } | null; historia: Historia[] }
interface Utwor { id: string; tytul: string; plik?: string; nowy?: boolean; blad?: string }
interface Wynik { wynik: { content?: { type: string; text?: string }[]; isError?: boolean }; utwory: Utwor[] }

/** Szablon argumentów ze schematu narzędzia — Suweren tylko dopisuje treść. */
function szablon(s: Schemat | null): string {
    const o: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(s?.properties ?? {})) {
        if (!(s?.required ?? []).includes(k) && Object.keys(o).length >= 4) continue;
        o[k] = p.enum?.[0] ?? (p.type === 'number' || p.type === 'integer' ? 0 : p.type === 'boolean' ? false : p.type === 'array' ? [] : '');
    }
    return JSON.stringify(o, null, 2);
}

export function SunoPanel() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [otwarty, setOtwarty] = useState(false);
    const [wybrane, setWybrane] = useState('');
    const [argumenty, setArgumenty] = useState('{}');
    const [pracuje, setPracuje] = useState(false);
    const [wynik, setWynik] = useState<Wynik | null>(null);

    const odswiez = useCallback(async (pelne = false) => {
        try { setStan((await zMostu<{ suno: Stan }>(`/api/suno/stan${pelne ? '?odswiez=1' : ''}`)).suno); }
        catch (e) { setStan({ polaczone: false, katalog: '', polaczono: null, historia: [], blad: e instanceof Error ? e.message : String(e) }); }
    }, []);
    useEffect(() => { if (otwarty) void odswiez(); }, [otwarty, odswiez]);
    // po powrocie z okna logowania Suno
    useEffect(() => { const f = () => { if (otwarty) void odswiez(); }; window.addEventListener('focus', f); return () => window.removeEventListener('focus', f); }, [otwarty, odswiez]);

    const narzedzie = useMemo(() => stan?.narzedzia?.find((n) => n.nazwa === wybrane) ?? null, [stan, wybrane]);
    const wybierz = (n: string) => { setWybrane(n); setArgumenty(szablon(stan?.narzedzia?.find((x) => x.nazwa === n)?.schemat ?? null)); setWynik(null); };

    const wywolaj = async () => {
        if (!narzedzie) return;
        let args: unknown;
        try { args = JSON.parse(argumenty || '{}'); } catch { toast.error('Argumenty to nie jest poprawny JSON.'); return; }
        if (narzedzie.zgoda && !window.confirm(`„${narzedzie.nazwa}” może wydać kredyty Suno z Twojego konta albo zmienić bibliotekę.\n\n${argumenty}\n\nWywołać?`)) return;
        setPracuje(true);
        try {
            const r = await zMostu<Wynik>('/api/suno/wywolaj', { method: 'POST', body: JSON.stringify({ narzedzie: narzedzie.nazwa, argumenty: args, zgoda: narzedzie.zgoda }) });
            setWynik(r);
            const nowe = r.utwory.filter((u) => u.nowy).length;
            if (nowe) toast.success(`🎵 ${nowe} utwór(ów) w bibliotece Katedry`);
            void odswiez();
        } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setPracuje(false); }
    };

    return (
        <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/20 p-3 text-xs text-slate-200">
            <button onClick={() => setOtwarty((v) => !v)} className="flex w-full items-center justify-between text-left">
                <span className="font-semibold text-fuchsia-200">🎵🔌 Suno — Twoje konto w Katedrze</span>
                <span className="text-slate-400">{stan ? (stan.polaczone ? '● połączone' : '○ niepołączone') : ''} {otwarty ? '▾' : '▸'}</span>
            </button>
            {otwarty && stan && (
                <div className="mt-2 flex flex-col gap-2">
                    {!stan.polaczone ? (
                        <>
                            <p className="text-slate-300">{stan.powod ?? 'Konto Suno niepołączone.'}</p>
                            <p className="text-slate-400">Logujesz się w Suno (nie w Katedrze) i zatwierdzasz dostęp — Katedra dostaje token, który trzyma Skarbiec 0.00G. Utwory zużywają kredyty Twojego planu Suno.</p>
                            <button onClick={() => window.open(`${MOST}/api/suno/polacz`, '_blank', 'width=560,height=760')} className="self-start rounded bg-fuchsia-600 px-3 py-1 font-semibold text-white">🔌 Połącz z Suno</button>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-2 text-slate-400">
                                <span>Połączono {stan.polaczono ? new Date(stan.polaczono).toLocaleString('pl-PL') : ''}{stan.serwer?.name ? ` · ${stan.serwer.name} ${stan.serwer.version ?? ''}` : ''}</span>
                                <span>· utwory → <code>{stan.katalog}</code></span>
                                <button onClick={() => void odswiez(true)} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-100">↻ narzędzia</button>
                                <button onClick={async () => { if (!window.confirm('Odłączyć konto Suno od Katedry? (token zostanie unieważniony)')) return; try { setStan((await zMostu<{ suno: Stan }>('/api/suno/rozlacz', { method: 'POST', body: '{}' })).suno); } catch (e) { toast.error(String(e)); } }} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-100">✕ odłącz</button>
                            </div>
                            {stan.narzedzia && (
                                <div className="flex flex-wrap gap-1">
                                    {stan.narzedzia.map((n) => (
                                        <button key={n.nazwa} title={n.opis} onClick={() => wybierz(n.nazwa)} className={`rounded px-2 py-0.5 ${wybrane === n.nazwa ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{n.zgoda ? '💳 ' : ''}{n.nazwa}</button>
                                    ))}
                                </div>
                            )}
                            {narzedzie && (
                                <div className="flex flex-col gap-1">
                                    <p className="whitespace-pre-wrap text-slate-300">{narzedzie.opis}</p>
                                    <textarea value={argumenty} onChange={(e) => setArgumenty(e.target.value)} rows={Math.min(12, argumenty.split('\n').length + 1)} className="rounded bg-black/40 p-2 font-mono text-[11px] text-slate-100" />
                                    <button disabled={pracuje} onClick={() => void wywolaj()} className="self-start rounded bg-fuchsia-600 px-3 py-1 font-semibold text-white disabled:opacity-50">{pracuje ? '⏳ Suno pracuje…' : `${narzedzie.zgoda ? '💳 ' : ''}Wywołaj`}</button>
                                </div>
                            )}
                            {wynik && (
                                <div className={`rounded p-2 ${wynik.wynik.isError ? 'bg-rose-950/50' : 'bg-black/30'}`}>
                                    {wynik.utwory.map((u) => <div key={u.id}>{u.blad ? `⚠ ${u.tytul}: ${u.blad}` : `🎵 ${u.tytul} → _OtakOs_Muzyka/${u.plik}${u.nowy ? '' : ' (był)'}`}</div>)}
                                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-slate-300">{(wynik.wynik.content ?? []).map((c) => c.text ?? `[${c.type}]`).join('\n')}</pre>
                                </div>
                            )}
                            {stan.historia.length > 0 && <div className="text-slate-500">Ostatnio: {stan.historia.slice(0, 5).map((h) => `${h.blad ? '⚠' : h.zgoda ? '💳' : '·'} ${h.narzedzie}${h.utwory.length ? ` (+${h.utwory.length} 🎵)` : ''}`).join(' · ')}</div>}
                        </>
                    )}
                    {stan.blad && <p className="text-rose-300">⚠ {stan.blad}</p>}
                </div>
            )}
        </div>
    );
}
