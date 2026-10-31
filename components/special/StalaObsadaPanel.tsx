/**
 * 🎭 Stała Obsada Katedry w Impresariacie (2026-10-31): aktor z jednego obrazu → karta 6 ujęć (FLUX, lokalnie) →
 * Twoje ✓ → odtąd twarz, przód i bok są wzorem każdego kadru z nim (filmy gry: obsada `s:<id>`; „🎬 kadr z aktorem”).
 * Serwis: services/StalaObsada.js. ↻ rysuje kartę od nowa, gdy FLUX nie utrzymał siatki albo twarzy.
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

interface Aktor {
    id: string; imie: string; opis: string; stan: 'nowy' | 'rysuje' | 'do_akceptacji' | 'zatwierdzony' | 'blad'; powod: string | null;
    ujecia: Record<string, string>; wersja: number; kadry: { plik: string; scena: string }[];
}
interface Stan { aktorzy: Aktor[]; zajete: string | null; ujecia: Record<string, string> }
const ZNAK: Record<Aktor['stan'], string> = { nowy: '· bez karty', rysuje: '⏳ FLUX rysuje kartę', do_akceptacji: '👀 czeka na Twoje ✓', zatwierdzony: '✓ stały aktor', blad: '⚠ błąd' };
const plik = (a: Aktor, p: string) => `${MOST}/api/obsada/${a.id}/plik/${p}?v=${a.wersja}`;

const wczytajObraz = (f: File): Promise<string> => new Promise((ok, zle) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => zle(new Error('Nie udało się wczytać obrazu.'));
    r.readAsDataURL(f);
});

export const StalaObsadaPanel: React.FC = () => {
    const [s, setS] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [otwarte, setOtwarte] = useState(false);
    const [imie, setImie] = useState('');
    const [opis, setOpis] = useState('');
    const [zdjecie, setZdjecie] = useState<string | null>(null);
    const [sceny, setSceny] = useState<Record<string, string>>({});
    const [pracuje, setPracuje] = useState<string | null>(null);

    const odswiez = useCallback(() => zMostu<Stan>('/api/obsada').then((d) => { setS(d); setBlad(null); }).catch((e: Error) => setBlad(e.message)), []);
    useEffect(() => { void odswiez(); }, [odswiez]);
    useEffect(() => {
        if (!s?.aktorzy.some((a) => a.stan === 'rysuje')) return;
        const t = setInterval(() => void odswiez(), 4000);
        return () => clearInterval(t);
    }, [s, odswiez]);

    const wolaj = async (sciezka: string, metoda: string, cialo: unknown, ok: string) => {
        try { await zMostu(sciezka, { method: metoda, body: cialo ? JSON.stringify(cialo) : undefined }); toast.success(ok); }
        catch (e) { toast.error((e as Error).message); }
        void odswiez();
    };

    const dodaj = async () => {
        if (!imie.trim() || !zdjecie) { toast.error('Imię i jeden obraz postaci.'); return; }
        setPracuje('nowy');
        try {
            const d = await zMostu<{ aktor: Aktor }>('/api/obsada', { method: 'POST', body: JSON.stringify({ imie, opis, zdjecie }) });
            await zMostu(`/api/obsada/${d.aktor.id}/karta`, { method: 'POST' });
            toast.success(`${d.aktor.imie}: FLUX rysuje kartę 6 ujęć (około minuty).`);
            setImie(''); setOpis(''); setZdjecie(null);
        } catch (e) { toast.error((e as Error).message); }
        setPracuje(null);
        void odswiez();
    };

    const kadr = async (a: Aktor) => {
        const scena = sceny[a.id]?.trim();
        if (!scena) { toast.error('Opisz scenę kadru.'); return; }
        setPracuje(a.id);
        try { await zMostu(`/api/obsada/${a.id}/kadr`, { method: 'POST', body: JSON.stringify({ scena }) }); toast.success(`Kadr z ${a.imie} gotowy.`); }
        catch (e) { toast.error((e as Error).message); }
        setPracuje(null);
        void odswiez();
    };

    return (
        <div className="rounded-lg border border-fuchsia-500/25 p-3 text-[11px]">
            <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-fuchsia-300">🎭 Stała Obsada Katedry</span>
                <span className="text-[10px] text-slate-500">jeden obraz → karta 6 ujęć → ta sama twarz w każdym kadrze</span>
                <button onClick={() => setOtwarte((x) => !x)} className="ml-auto text-[10px] text-slate-400 hover:text-fuchsia-200">{otwarte ? 'zwiń' : `aktorzy (${s?.aktorzy.length ?? 0})`}</button>
            </div>
            {blad && <p className="text-[10px] text-amber-300">⚠ {blad}</p>}
            {otwarte && s && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-700/60 p-2">
                        <input value={imie} onChange={(e) => setImie(e.target.value)} maxLength={40} placeholder="Imię aktora"
                            className="w-32 rounded-sm border border-slate-700 bg-black/60 px-1.5 py-1 text-slate-200" />
                        <input value={opis} onChange={(e) => setOpis(e.target.value)} maxLength={600} placeholder="Wygląd (opcjonalnie — tożsamość niesie obraz)"
                            className="min-w-[220px] flex-1 rounded-sm border border-slate-700 bg-black/60 px-1.5 py-1 text-slate-200" />
                        <label className="cursor-pointer rounded-sm border border-slate-600 px-2 py-1 text-slate-300 hover:border-fuchsia-400">
                            {zdjecie ? '🖼️ obraz wybrany' : '🖼️ jeden obraz postaci'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void wczytajObraz(f).then(setZdjecie).catch((er: Error) => toast.error(er.message)); }} />
                        </label>
                        <button disabled={pracuje === 'nowy'} onClick={() => void dodaj()} className="rounded-sm bg-fuchsia-600/80 px-2 py-1 font-bold text-white hover:bg-fuchsia-500 disabled:opacity-50">＋ Dodaj i narysuj kartę</button>
                    </div>
                    {s.zajete && <p className="text-[10px] text-slate-400">⏳ Karta graficzna rysuje: {s.zajete}</p>}
                    {!s.aktorzy.length && <p className="text-[10px] text-slate-500">Jeszcze nikt — dodaj pierwszego aktora z jednego zdjęcia albo rysunku.</p>}
                    {s.aktorzy.map((a) => (
                        <div key={a.id} className="rounded-md border border-slate-700/60 p-2">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <img src={plik(a, 'zrodlo.png')} alt="" className="h-10 w-10 rounded-sm object-cover" />
                                <b className="text-sm text-slate-100">{a.imie}</b>
                                <span className="text-[10px] text-slate-400">{ZNAK[a.stan]}{a.powod ? ` — ${a.powod}` : ''}</span>
                                <div className="ml-auto flex gap-1">
                                    {a.stan === 'do_akceptacji' && <button onClick={() => void wolaj(`/api/obsada/${a.id}/przyjmij`, 'POST', null, `${a.imie} jest stałym aktorem.`)} className="rounded-sm bg-emerald-600/80 px-2 py-0.5 text-white">✓ Zatwierdź kartę</button>}
                                    {a.stan !== 'rysuje' && <button onClick={() => void wolaj(`/api/obsada/${a.id}/karta`, 'POST', null, 'FLUX rysuje kartę od nowa.')} className="rounded-sm border border-slate-600 px-2 py-0.5 text-slate-300">↻ karta</button>}
                                    <button onClick={() => { if (confirm(`Usunąć aktora ${a.imie}? (do kosza Stałej Obsady)`)) void wolaj(`/api/obsada/${a.id}`, 'DELETE', null, 'Do kosza.'); }} className="rounded-sm border border-slate-700 px-2 py-0.5 text-slate-500">🗑</button>
                                </div>
                            </div>
                            {a.opis && <p className="mb-1 text-[10px] text-slate-500">{a.opis}</p>}
                            {Object.keys(a.ujecia ?? {}).length > 0 && (
                                <div className="grid grid-cols-6 gap-1">
                                    {Object.entries(s.ujecia).map(([klucz, nazwa]) => a.ujecia[klucz] && (
                                        <figure key={klucz} className="text-center">
                                            <img src={plik(a, a.ujecia[klucz])} alt={nazwa} className="aspect-square w-full rounded-sm object-cover" />
                                            <figcaption className="text-[9px] text-slate-500">{nazwa}</figcaption>
                                        </figure>
                                    ))}
                                </div>
                            )}
                            {a.stan === 'zatwierdzony' && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <input value={sceny[a.id] ?? ''} onChange={(e) => setSceny({ ...sceny, [a.id]: e.target.value })} placeholder={`Scena z ${a.imie} (np. na plaży o świcie, w studiu nagraniowym)`}
                                        className="min-w-[220px] flex-1 rounded-sm border border-slate-700 bg-black/60 px-1.5 py-1 text-slate-200" />
                                    <button disabled={pracuje === a.id} onClick={() => void kadr(a)} className="rounded-sm bg-fuchsia-700/70 px-2 py-1 text-white disabled:opacity-50">{pracuje === a.id ? '⏳ rysuje…' : '🎬 kadr z aktorem'}</button>
                                    <span className="text-[10px] text-slate-500">w filmach gry: obsada „{a.imie}”</span>
                                </div>
                            )}
                            {a.kadry?.length > 0 && (
                                <div className="mt-2 flex gap-1 overflow-x-auto">
                                    {a.kadry.slice(0, 6).map((k) => <img key={k.plik} src={plik(a, k.plik)} title={k.scena} alt={k.scena} className="h-16 rounded-sm" />)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
