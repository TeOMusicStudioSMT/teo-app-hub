/**
 * ⚡ Giełda mocy (TeOkoP GRV) — etap 1: OGŁOSZENIA.
 *
 * Moja oferta (VRAM, modele z Ollamy, cena w GRV za 1000 tokenów) idzie w publicznej wizytówce do rejestru
 * otakos.wtf; niżej — oferty innych Katedr online z rejestru. Prawdziwe dane, bez licznika z sufitu.
 * ⚠️ Etap 1 nie wykonuje cudzych zadań i nie przelewa GRV — panel mówi to wprost (services/GieldaMocy.js).
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface Oferta { udostepniam: boolean; vramGB: number; gpu: string; modele: string[]; cenaGRV: number; godziny: string; opis: string; zmieniono: string | null }
interface Moc { vramGB: number; gpu: string; modele: string[]; cenaGRV: number; jednostka: string; godziny: string; opis: string; od?: string }
interface Stan { oferta: Oferta; publiczna: Moc | null; wykryte: { nazwa: string; vramGB: number } | null; modele: string[]; jednostka: string }
interface Siec { online: number; oferty: { nick: string; adres: string; motto: string; moc: Moc }[]; vramGB: number }

async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}

export const GieldaMocyPanel: React.FC = () => {
    const [stan, setStan] = useState<Stan | null>(null);
    const [form, setForm] = useState<Oferta | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [siec, setSiec] = useState<Siec | null>(null);
    const [bladSieci, setBladSieci] = useState<string | null>(null);

    const odswiez = useCallback(async () => {
        try { const d = await zMostu<Stan>('/api/gielda-mocy'); setStan(d); setForm(d.oferta); setBlad(null); }
        catch (e) { setBlad(/HTTP 404/.test(String(e)) ? 'Most sprzed restartu — nie zna jeszcze Giełdy mocy. Zrestartuj Katedrę.' : String(e instanceof Error ? e.message : e)); }
    }, []);
    const sieci = useCallback(async () => {
        try { setSiec(await zMostu<Siec>('/api/gielda-mocy/oferty')); setBladSieci(null); }
        catch (e) { setBladSieci(e instanceof Error ? e.message : String(e)); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);

    const zapisz = async (zmiana: Partial<Oferta>) => {
        if (!form) return;
        try { const d = await zMostu<{ oferta: Oferta }>('/api/gielda-mocy', { method: 'PUT', body: JSON.stringify({ ...form, ...zmiana }) }); setForm(d.oferta); toast.success(d.oferta.udostepniam ? 'Oferta zapisana — pójdzie w wizytówce.' : 'Zapisano — nie udostępniasz mocy.'); void odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 }); }
    };

    if (blad) return <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200">⚡ {blad}</div>;
    if (!stan || !form) return null;
    const przelacz = (m: string) => setForm((f) => f && ({ ...f, modele: f.modele.includes(m) ? f.modele.filter((x) => x !== m) : [...f.modele, m].slice(0, 12) }));

    return (
        <details className="rounded-lg border border-yellow-500/25 p-2" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !siec) void sieci(); }}>
            <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-yellow-300">⚡ Giełda mocy (TeOkoP GRV) {stan.publiczna ? `· udostępniam ${stan.publiczna.vramGB} GB` : '· nie udostępniam'}</summary>
            <div className="mt-2 flex flex-col gap-2 text-[11px]">
                <p className="rounded border border-yellow-500/20 bg-yellow-950/20 p-2 text-[10px] leading-relaxed text-yellow-100/80">
                    Etap 1 = <b>ogłoszenia</b>. Oferta jedzie w Twojej wizytówce do rejestru otakos.wtf (widać ją, gdy Katedra jest online i nick zatwierdzony). Katedra <b>nie wykonuje jeszcze cudzych zadań i nie przelewa GRV</b> — to etap 2.
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_1fr]">
                    <label className="text-slate-400">Karta</label>
                    <div className="flex items-center gap-2">
                        <input value={form.gpu} maxLength={80} onChange={(e) => setForm({ ...form, gpu: e.target.value })} placeholder="np. RTX 4090" className="flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                        <input type="number" min={1} max={512} value={form.vramGB} onChange={(e) => setForm({ ...form, vramGB: Number(e.target.value) })} className="w-20 rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                        <span className="text-slate-500">GB VRAM</span>
                    </div>
                    {stan.wykryte && <><span /><span className="text-[10px] text-slate-500">wykryto (nvidia-smi): {stan.wykryte.nazwa} · {stan.wykryte.vramGB} GB</span></>}
                    <label className="text-slate-400">Modele</label>
                    <div className="flex flex-wrap gap-1">
                        {stan.modele.length === 0 && <span className="text-[10px] text-amber-300">Ollama nie podała modeli — bez modelu nie ma czego udostępnić.</span>}
                        {stan.modele.map((m) => (
                            <button key={m} onClick={() => przelacz(m)} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${form.modele.includes(m) ? 'border-yellow-400/60 bg-yellow-500/20 text-yellow-100' : 'border-slate-700 text-slate-400'}`}>{m}</button>
                        ))}
                    </div>
                    <label className="text-slate-400">Cena</label>
                    <div className="flex items-center gap-2">
                        <input type="number" min={0} step={0.1} value={form.cenaGRV} onChange={(e) => setForm({ ...form, cenaGRV: Number(e.target.value) })} className="w-24 rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                        <span className="text-slate-500">GRV / {stan.jednostka}</span>
                    </div>
                    <label className="text-slate-400">Kiedy</label>
                    <input value={form.godziny} maxLength={60} onChange={(e) => setForm({ ...form, godziny: e.target.value })} className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                    <label className="text-slate-400">Opis</label>
                    <input value={form.opis} maxLength={300} onChange={(e) => setForm({ ...form, opis: e.target.value })} placeholder="np. dobre do polskich tekstów, długi kontekst" className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => void zapisz({})} className="rounded bg-yellow-500/25 px-3 py-1 font-bold text-yellow-100">Zapisz ofertę</button>
                    <label className="ml-auto flex items-center gap-1.5 text-slate-300">
                        <input type="checkbox" checked={form.udostepniam} onChange={(e) => void zapisz({ udostepniam: e.target.checked })} />
                        Udostępniam moc w sieci
                    </label>
                </div>

                <div className="mt-1 border-t border-slate-800 pt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest text-slate-400">Oferty Katedr online</span>
                        <button onClick={() => void sieci()} className="ml-auto text-[10px] text-yellow-300 underline">odśwież</button>
                    </div>
                    {bladSieci && <div className="mt-1 text-[10px] text-amber-300">⚠ {bladSieci}</div>}
                    {siec && (
                        <>
                            <div className="mt-1 text-[10px] text-slate-500">online w rejestrze: {siec.online} · z ofertą (bez Twojej): {siec.oferty.length} · razem {siec.vramGB} GB VRAM</div>
                            {siec.oferty.length === 0 && <div className="mt-1 text-[10px] text-slate-500">Nikt jeszcze nie ogłosił mocy.</div>}
                            <ul className="mt-1 flex flex-col gap-1">
                                {siec.oferty.map((k) => (
                                    <li key={k.nick} className="rounded border border-slate-800 bg-black/30 p-1.5">
                                        <div className="flex flex-wrap items-baseline gap-2">
                                            <b className="font-mono text-yellow-200">{k.nick}</b>
                                            <span className="text-slate-400">{k.moc.gpu || 'GPU'} · {k.moc.vramGB} GB</span>
                                            <span className="ml-auto text-yellow-300">{k.moc.cenaGRV} GRV / {k.moc.jednostka}</span>
                                        </div>
                                        <div className="font-mono text-[10px] text-slate-400">{k.moc.modele.join(' · ')}</div>
                                        {(k.moc.opis || k.moc.godziny) && <div className="text-[10px] text-slate-500">{k.moc.opis}{k.moc.opis && k.moc.godziny ? ' — ' : ''}{k.moc.godziny}</div>}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </details>
    );
};
