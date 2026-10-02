/**
 * 🏛️ TOST · Katedry — rozmowa z innymi Katedrami (services/TostSiec.js).
 *
 * Kontakty = Katedry online z rejestru otakos.wtf (tylko nicki). Wiadomość szyfrowana end-to-end
 * leci przez tunel odbiorcy; gdy ten jest offline, czeka w tej Katedrze i wychodzi sama.
 * Stan każdej wiadomości jest prawdziwy: „czeka” / „dostarczona” / „niedostarczona” (+ powód).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';

interface Kontakt { nick: string; motto?: string; online: boolean; nieprzeczytane?: number; czeka?: number; ostatnia?: { tekst: string; czas: string } | null }
interface Wiadomosc { id: string; kierunek: 'przychodzaca' | 'wychodzaca'; tekst: string; czas: string; stan?: 'czeka' | 'dostarczona' | 'niedostarczona'; blad?: string }

async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}
const godz = (iso: string) => new Date(iso).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export const TostKatedry: React.FC = () => {
    const [ja, setJa] = useState<string | null>(null);
    const [kontakty, setKontakty] = useState<Kontakt[]>([]);
    const [rejestrBlad, setRejestrBlad] = useState<string | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [z, setZ] = useState<string | null>(null);
    const [watek, setWatek] = useState<Wiadomosc[]>([]);
    const [tekst, setTekst] = useState('');
    const [wysyla, setWysyla] = useState(false);
    const dol = useRef<HTMLDivElement>(null);

    const odswiezKontakty = useCallback(async () => {
        try {
            const d = await zMostu<{ ja: string; kontakty: Kontakt[]; rejestr: { blad?: string } }>('/api/tost/siec/kontakty');
            setJa(d.ja || null); setKontakty(d.kontakty); setRejestrBlad(d.rejestr?.blad ?? null); setBlad(null);
        } catch (e) { setBlad(/HTTP 404/.test(String(e)) ? 'Most sprzed restartu — nie zna jeszcze TOST-a między Katedrami. Zrestartuj Katedrę.' : String(e instanceof Error ? e.message : e)); }
    }, []);
    const odswiezWatek = useCallback(async (nick: string) => {
        try { setWatek((await zMostu<{ wiadomosci: Wiadomosc[] }>(`/api/tost/siec/rozmowa/${nick}`)).wiadomosci); } catch { /* zostaje stary */ }
    }, []);

    useEffect(() => { void odswiezKontakty(); const t = setInterval(odswiezKontakty, 15_000); return () => clearInterval(t); }, [odswiezKontakty]);
    useEffect(() => { if (!z) return; void odswiezWatek(z); const t = setInterval(() => odswiezWatek(z), 5_000); return () => clearInterval(t); }, [z, odswiezWatek]);
    useEffect(() => { dol.current?.scrollIntoView({ block: 'end' }); }, [watek.length]);

    const wyslij = async () => {
        if (!z || !tekst.trim()) return;
        setWysyla(true);
        try { await zMostu('/api/tost/siec/wyslij', { method: 'POST', body: JSON.stringify({ do: z, tekst }) }); setTekst(''); await odswiezWatek(z); void odswiezKontakty(); }
        catch (e) { setBlad(e instanceof Error ? e.message : String(e)); }
        finally { setWysyla(false); }
    };

    if (blad && !ja && !kontakty.length) return <div className="p-5 text-xs text-amber-300">⚠ {blad}</div>;
    if (!ja) return <div className="p-5 text-xs leading-relaxed text-green-700">Ta Katedra nie ma jeszcze nicka. Dashboard → „Wystawa teo.center” → 🪪 Wizytówka: nick, a do rozmów także Kwantowy Tunel + „Melduj w sieci” (inne Katedry muszą Cię widzieć w rejestrze).</div>;

    return (
        <div className="flex min-h-[420px] font-mono text-xs" style={{ background: 'rgba(2, 8, 4, 0.97)' }}>
            <aside className="w-48 shrink-0 border-r border-green-900/40">
                <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-green-800">jesteś: <span className="text-green-400">{ja}</span></div>
                {rejestrBlad && <div className="px-3 pb-2 text-[9px] text-amber-400">rejestr: {rejestrBlad}</div>}
                {!kontakty.length && <div className="px-3 py-2 text-[10px] text-green-900">Żadna inna Katedra nie jest teraz online.</div>}
                {kontakty.map((k) => (
                    <button key={k.nick} onClick={() => setZ(k.nick)} className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-green-950/40 ${z === k.nick ? 'bg-green-950/60' : ''}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${k.online ? 'bg-green-400' : 'bg-slate-700'}`} />
                        <span className="flex-1 truncate text-green-300">{k.nick}</span>
                        {!!k.nieprzeczytane && <span className="rounded-full bg-green-500 px-1.5 text-[9px] font-bold text-black">{k.nieprzeczytane}</span>}
                        {!!k.czeka && <span title="czeka na wysłanie" className="text-[9px] text-amber-400">⏳{k.czeka}</span>}
                    </button>
                ))}
            </aside>
            <section className="flex flex-1 flex-col">
                {!z ? <div className="m-auto max-w-xs p-6 text-center text-[11px] leading-relaxed text-green-800">Wybierz Katedrę po lewej. Wiadomości lecą zaszyfrowane end-to-end; gdy druga Katedra jest offline, czekają tutaj i wyjdą same.</div> : (
                    <>
                        <div className="border-b border-green-900/40 px-4 py-2 text-green-400">🏛️ {z} <span className="text-[9px] text-green-900">· szyfrowane E2E</span></div>
                        <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
                            {watek.map((m) => (
                                <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 ${m.kierunek === 'wychodzaca' ? 'ml-auto bg-green-900/40 text-green-100' : 'bg-slate-900/80 text-slate-200'}`}>
                                    <div className="whitespace-pre-wrap break-words" data-bez-tlumaczenia>{m.tekst}</div>
                                    <div className="mt-1 text-[9px] text-green-800">
                                        {godz(m.czas)}
                                        {m.kierunek === 'wychodzaca' && (m.stan === 'dostarczona' ? ' · ✓ dostarczona' : m.stan === 'niedostarczona' ? ` · ✕ niedostarczona${m.blad ? ` (${m.blad})` : ''}` : ` · ⏳ czeka${m.blad ? ` (${m.blad})` : ''}`)}
                                    </div>
                                </div>
                            ))}
                            <div ref={dol} />
                        </div>
                        {blad && <div className="px-4 text-[10px] text-amber-400">⚠ {blad}</div>}
                        <div className="flex gap-2 border-t border-green-900/40 p-3">
                            <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={2} maxLength={4000}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void wyslij(); } }}
                                placeholder={`Do ${z}… (Enter = wyślij)`} className="flex-1 resize-none rounded border border-green-900/60 bg-black/50 px-2 py-1 text-green-100 outline-none focus:border-green-500" />
                            <button onClick={() => void wyslij()} disabled={wysyla || !tekst.trim()} className="rounded bg-green-600/80 px-4 font-bold text-black disabled:opacity-40">{wysyla ? '…' : 'Wyślij'}</button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default TostKatedry;
