/**
 * 🎟️ Kody QR tańca 0.00G Style w Impresariacie (2026-11-06): nowe jednorazowe kody kupujących, lista ze stanem
 * i wydruk arkusza metek (A4, 3 × 7). Kod prowadzi na stały adres (`qr.teo.center`), kupujący wybiera tancerza,
 * automat Tanecznego Starcia nagrywa prywatny taniec. Serwis: services/KodyTanca.js.
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

interface Kod {
    kod: string; produkt: string; tylko: string[] | null; stan: 'wolny' | 'zuzyty' | 'gotowy' | string;
    utworzono: string; wydrukowano?: string; url: string | null; qr: string | null; bonusGrv?: number; bonusOdebrany?: string | null;
}
interface Stan { kody: Kod[]; tunel: boolean; adres: string | null; staly: boolean; powod: string | null; tancerze: { id: string; nazwa: string }[]; wszystkich: number }
const ZNAK: Record<string, string> = { wolny: '🟢 wolny', gotowy: '🎬 taniec gotowy', zuzyty: '⏳ wybrany, nagrywa się' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Arkusz A4: 3 kolumny × 7 rzędów metek 70 × 42 mm (typowy arkusz etykiet 21 szt.). */
export function arkusz(kody: Kod[]) {
    const metki = kody.map((k) => `<div class="m"><img src="${k.qr}" alt=""><div class="t"><b>0.00G Style</b><span>Scan for your private dance</span><i>${esc(k.kod)}</i>${k.produkt ? `<small>${esc(k.produkt)}</small>` : ''}</div></div>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>0.00G Style — kody tańca (${kody.length})</title><style>
@page { size: A4; margin: 15mm 0 0 0; }
* { box-sizing: border-box; } body { margin: 0; font-family: Georgia, serif; font-variant-numeric: lining-nums; }
.a { display: grid; grid-template-columns: repeat(3, 70mm); grid-auto-rows: 42mm; }
.m { display: flex; align-items: center; gap: 3mm; padding: 3mm; border: 0.2mm dashed #ccc; overflow: hidden; break-inside: avoid; }
.m img { width: 34mm; height: 34mm; } .t { display: flex; flex-direction: column; gap: 1mm; font-size: 8pt; line-height: 1.15; }
.t b { font-size: 11pt; } .t i { font-family: monospace; font-style: normal; font-size: 7pt; color: #555; } .t small { font-size: 6.5pt; color: #777; }
@media print { .m { border-color: transparent; } }
</style></head><body><div class="a">${metki}</div><script>window.onload = () => setTimeout(() => window.print(), 300);</script></body></html>`;
}

export const KodyQrPanel: React.FC = () => {
    const [s, setS] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [otwarte, setOtwarte] = useState(false);
    const [ile, setIle] = useState(21);
    const [produkt, setProdukt] = useState('');
    const [postac, setPostac] = useState('');
    const [bonusGrv, setBonusGrv] = useState(0);
    const [filtr, setFiltr] = useState<'do-druku' | 'wolne' | 'wszystkie'>('do-druku');
    const [wybrane, setWybrane] = useState<Set<string>>(new Set());
    const [pracuje, setPracuje] = useState(false);

    const odswiez = useCallback(async () => {
        try { setS(await zMostu<Stan>('/api/taniec/kody')); setBlad(null); } catch (e) { setBlad((e as Error).message); }
    }, []);
    useEffect(() => { if (otwarte) void odswiez(); }, [otwarte, odswiez]);

    const widoczne = useMemo(() => (s?.kody ?? []).filter((k) => filtr === 'wszystkie' || (k.stan === 'wolny' && (filtr === 'wolne' || !k.wydrukowano))), [s, filtr]);
    useEffect(() => { setWybrane(new Set(widoczne.filter((k) => k.qr).map((k) => k.kod))); }, [widoczne]);

    const nowe = async () => {
        setPracuje(true);
        try {
            const d = await zMostu<{ kody: Kod[] }>('/api/taniec/kody', { method: 'POST', body: JSON.stringify({ ile, produkt: produkt.trim(), postac: postac || null, bonusGrv }) });
            toast.success(`🎟️ ${d.kody.length} nowych kodów`); setFiltr('do-druku'); await odswiez();
        } catch (e) { toast.error((e as Error).message); } finally { setPracuje(false); }
    };
    const drukuj = async () => {
        const lista = widoczne.filter((k) => wybrane.has(k.kod) && k.qr);
        if (!lista.length) return;
        if (!s?.staly && !window.confirm(`Kody prowadzą na adres tunelu (${s?.adres ?? 'brak'}), który nie jest stały — po zmianie adresu metki przestaną działać. Drukować mimo to?`)) return;
        const okno = window.open('', '_blank');
        if (!okno) { toast.error('Przeglądarka zablokowała okno wydruku — pozwól na wyskakujące okna dla Huba.'); return; }
        okno.document.open(); okno.document.write(arkusz(lista)); okno.document.close();
        try { await zMostu('/api/taniec/kody/wydrukowane', { method: 'POST', body: JSON.stringify({ kody: lista.map((k) => k.kod) }) }); await odswiez(); }
        catch (e) { toast.error(`Arkusz otwarty, ale znacznik wydruku nie zapisał się: ${(e as Error).message}`); }
    };
    const przelacz = (kod: string) => setWybrane((w) => { const n = new Set(w); if (n.has(kod)) n.delete(kod); else n.add(kod); return n; });

    return (
        <div className="rounded-xl border border-amber-500/30 bg-black/30 p-4">
            <button onClick={() => setOtwarte((o) => !o)} className="flex w-full items-center justify-between text-left">
                <span className="font-bold text-amber-200">🎟️ Kody QR tańca — 0.00G Style</span>
                <span className="text-xs text-white/50">{otwarte ? '▲' : '▼'} jednorazowe kody kupujących, wydruk metek</span>
            </button>
            {otwarte && (
                <div className="mt-3 flex flex-col gap-3 text-sm">
                    {blad && <div className="rounded bg-red-900/40 p-2 text-red-200">⚠ {blad}</div>}
                    {s && (
                        <div className="text-xs text-white/70">
                            Adres kodów: <b className="text-white">{s.adres ?? '— brak —'}</b> {s.staly ? '(stały)' : '(tunel — zmienny)'} · tunel {s.tunel ? '✓ działa' : '✕ wyłączony'}
                            {s.powod && <div className="mt-1 text-amber-300">⚠ {s.powod}</div>}
                        </div>
                    )}
                    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 p-2">
                        <label className="flex flex-col text-xs">Ile kodów
                            <input type="number" min={1} max={100} value={ile} onChange={(e) => setIle(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="w-20 rounded bg-black/50 px-2 py-1" />
                        </label>
                        <label className="flex flex-1 flex-col text-xs">Produkt (dla Ciebie, na metce drobnym drukiem)
                            <input value={produkt} onChange={(e) => setProdukt(e.target.value)} maxLength={120} placeholder="np. Borowik · Varsity Jacket" className="rounded bg-black/50 px-2 py-1" />
                        </label>
                        <label className="flex flex-col text-xs">Tancerz
                            <select value={postac} onChange={(e) => setPostac(e.target.value)} className="rounded bg-black/50 px-2 py-1">
                                <option value="">kupujący wybiera z wszystkich</option>
                                {(s?.tancerze ?? []).map((t) => <option key={t.id} value={t.id}>tylko {t.nazwa}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col text-xs" title="Kupujący widzi kod bonusu po wybraniu tancerza; GRV dopisze jego WŁASNA Katedra przy pierwszym wejściu">🎁 Bonus GRV
                            <select value={bonusGrv} onChange={(e) => setBonusGrv(Number(e.target.value))} className="rounded bg-black/50 px-2 py-1">
                                {[0, 1000, 2500, 5000].map((n) => <option key={n} value={n}>{n ? `+${n.toLocaleString('pl-PL')} GRV` : 'bez bonusu'}</option>)}
                            </select>
                        </label>
                        <button onClick={() => void nowe()} disabled={pracuje} className="rounded bg-amber-600 px-3 py-1.5 font-bold disabled:opacity-40">＋ Utwórz</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {(['do-druku', 'wolne', 'wszystkie'] as const).map((f) => (
                            <button key={f} onClick={() => setFiltr(f)} className={`rounded-full border px-3 py-1 ${filtr === f ? 'border-amber-400 text-amber-200' : 'border-white/20 text-white/60'}`}>
                                {f === 'do-druku' ? 'wolne, jeszcze niedrukowane' : f === 'wolne' ? 'wszystkie wolne' : 'wszystkie'}
                            </button>
                        ))}
                        <button onClick={() => void odswiez()} className="text-white/50">↻</button>
                        <span className="ml-auto text-white/50">zaznaczone {wybrane.size} z {widoczne.length}{s && s.wszystkich > s.kody.length ? ` · lista pokazuje ${s.kody.length} najnowszych z ${s.wszystkich}` : ''}</span>
                        <button onClick={() => void drukuj()} disabled={!wybrane.size} className="rounded bg-emerald-700 px-3 py-1.5 font-bold disabled:opacity-40">🖨️ Drukuj arkusz ({wybrane.size})</button>
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded border border-white/10">
                        {widoczne.length === 0 && <div className="p-3 text-white/50">Brak kodów w tym widoku.</div>}
                        {widoczne.map((k) => (
                            <label key={k.kod} className="flex cursor-pointer items-center gap-3 border-b border-white/5 px-2 py-1.5 hover:bg-white/5">
                                <input type="checkbox" checked={wybrane.has(k.kod)} disabled={!k.qr} onChange={() => przelacz(k.kod)} />
                                {k.qr ? <img src={k.qr} alt="" className="h-10 w-10 rounded bg-white" /> : <span className="h-10 w-10" />}
                                <span className="font-mono text-xs">{k.kod}</span>
                                <span className="text-xs text-white/70">{ZNAK[k.stan] ?? k.stan}</span>
                                <span className="truncate text-xs text-white/50">{k.produkt}{k.tylko ? ` · tylko: ${k.tylko.map((id) => s?.tancerze.find((t) => t.id === id)?.nazwa ?? id).join(', ')}` : ''}</span>
                                {k.bonusGrv ? <span className="text-[10px] text-amber-300">🎁 +{k.bonusGrv.toLocaleString('pl-PL')} GRV{k.bonusOdebrany ? ' · odebrany' : ''}</span> : null}
                                <span className="ml-auto text-[10px] text-white/40">{k.wydrukowano ? `🖨️ ${new Date(k.wydrukowano).toLocaleDateString()}` : ''}</span>
                                {k.url && <a href={k.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-sky-300">↗</a>}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
