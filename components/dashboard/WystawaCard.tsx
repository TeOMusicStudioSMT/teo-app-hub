/**
 * 🖼️ WYSTAWA teo.center — co Katedra pokazuje światu.
 *
 * Suweren (2026-09-14): filmy Katedry, utwory Suno, produkty — na teo.center.
 * Ta karta to KURACJA: linki Suno, link YouTube do filmu (żeby grał u każdego,
 * nie tylko u gospodarza), ukrywanie pozycji i „Publikuj" — zapis statycznego
 * katalogu do teo-center/public/wystawa.json (+ plakaty). Reszta katalogu
 * zbiera się sama z tego, co powstało (services/Wystawa.js).
 *
 * ⚠️ „Publikuj" nie wgrywa niczego do internetu — pisze pliki do repo strony.
 * Stronę trzeba jeszcze zbudować i wgrać; karta mówi, gdzie leży wynik.
 */
import React, { useCallback, useEffect, useState } from 'react';
import DashboardCard from '../DashboardCard';
import { Image as ImageIcon, Upload, Loader2, Trash2, EyeOff, Eye, Youtube } from 'lucide-react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface Film { id: string; rodzaj: string; projekt: string; tytul: string; kiedy: string; bajtow: number; muzyka: boolean | null; ukryty: boolean; youtube: { id: string; url: string } | null }
interface Suno { typ?: 'utwor' | 'playlista'; id: string; url: string; tytul: string; embed?: string; utwory?: { id: string; tytul: string }[] }
interface Katalog { filmy: Film[]; utwory: { id: string; tytul: string; ukryty: boolean }[]; produkty: { id: string; tytul: string; dzial: string; ukryty: boolean }[]; suno: Suno[]; ostatniaPublikacja: string | null }

async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}

export const WystawaCard: React.FC = () => {
    const [k, setK] = useState<Katalog | null>(null);
    const [most, setMost] = useState<'zyje' | 'stary' | 'milczy' | null>(null);
    const [suno, setSuno] = useState('');
    const [yt, setYt] = useState<Record<string, string>>({});
    const [publikuje, setPublikuje] = useState(false);
    const [wynik, setWynik] = useState<{ filmy: number; bezYouTube: number; utwory: number; suno: number; produkty: number; plik: string; sekundy: number } | null>(null);

    const odswiez = useCallback(async () => {
        try { setK(await zMostu<Katalog>('/api/wystawa')); setMost('zyje'); }
        catch (e) { setMost(/HTTP 404/.test(String(e)) ? 'stary' : 'milczy'); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);

    const dodajSuno = async () => {
        if (!suno.trim()) return;
        try { await zMostu('/api/wystawa/suno', { method: 'POST', body: JSON.stringify({ url: suno }) }); setSuno(''); await odswiez(); toast.success('Utwór Suno na wystawie.'); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    };
    const ustawYt = async (filmId: string) => {
        try { await zMostu('/api/wystawa/youtube', { method: 'POST', body: JSON.stringify({ filmId, url: yt[filmId] ?? '' }) }); await odswiez(); toast.success(yt[filmId] ? 'Film gra z YouTube.' : 'Link YouTube zdjęty.'); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    };
    const ukryj = async (id: string, ukryty: boolean) => { try { await zMostu('/api/wystawa/ukryj', { method: 'POST', body: JSON.stringify({ id, ukryty }) }); await odswiez(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } };
    const publikuj = async () => {
        setPublikuje(true);
        try { const w = await zMostu<typeof wynik & object>('/api/wystawa/publikuj', { method: 'POST', body: '{}' }); setWynik(w); await odswiez(); toast.success(`Wystawa zapisana: ${w!.filmy} filmów, ${w!.suno} Suno, ${w!.produkty} produktów.`, { duration: 8000 }); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 }); }
        finally { setPublikuje(false); }
    };

    const filmy = k?.filmy ?? [];
    return (
        <DashboardCard title="Wystawa teo.center" icon={<ImageIcon className="w-full h-full" />}>
            <div className="flex flex-col gap-3 text-xs">
                {most === 'milczy' && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200">Most (:3001) milczy — wystawa zbiera się w moście.</div>}
                {most === 'stary' && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200">Most sprzed restartu — nie zna jeszcze /api/wystawa. Zrestartuj Katedrę.</div>}
                {k && (
                    <>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                            <span><b className="text-slate-200">{filmy.filter((f) => !f.ukryty).length}</b> filmów · <b className="text-slate-200">{filmy.filter((f) => f.youtube && !f.ukryty).length}</b> na YouTube</span>
                            <span><b className="text-slate-200">{k.suno.length}</b> Suno</span>
                            <span><b className="text-slate-200">{k.utwory.filter((u) => !u.ukryty).length}</b> utworów z dysku</span>
                            <span><b className="text-slate-200">{k.produkty.filter((p) => !p.ukryty).length}</b> produktów</span>
                            <span className="ml-auto text-slate-600">{k.ostatniaPublikacja ? `opublikowano ${new Date(k.ostatniaPublikacja).toLocaleString('pl-PL')}` : 'jeszcze nieopublikowana'}</span>
                        </div>

                        {/* ── Suno ── */}
                        <div className="flex gap-1.5">
                            <input value={suno} onChange={(e) => setSuno(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void dodajSuno(); }} placeholder="link Suno: https://suno.com/song/… albo /playlist/…" className="flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1 font-mono text-[10px] text-slate-200" />
                            <button onClick={() => void dodajSuno()} className="rounded bg-fuchsia-500/30 px-2 text-fuchsia-100">+ Suno</button>
                        </div>
                        {k.suno.length > 0 && (
                            <ul className="space-y-0.5">
                                {k.suno.map((s) => (
                                    <li key={s.id} className="flex items-center gap-2 text-[10px]">
                                        <span className="truncate text-slate-300">{s.typ === 'playlista' ? `📀 ${s.tytul} · ${s.utwory?.length ?? 0} utworów` : `🎵 ${s.tytul || s.id}`}</span>
                                        <button onClick={() => zMostu(`/api/wystawa/suno/${s.id}`, { method: 'DELETE' }).then(odswiez)} className="ml-auto text-slate-600 hover:text-red-400"><Trash2 size={11} /></button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* ── Filmy: YouTube per film + ukrywanie ── */}
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-800 p-2">
                            {filmy.map((f) => (
                                <div key={f.id} className={`flex flex-wrap items-center gap-1.5 text-[10px] ${f.ukryty ? 'opacity-40' : ''}`}>
                                    <button onClick={() => void ukryj(f.id, !f.ukryty)} title={f.ukryty ? 'pokaż' : 'ukryj'} className="text-slate-500 hover:text-white">{f.ukryty ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                                    <span className="w-44 truncate text-slate-200" title={f.tytul}>{f.tytul}</span>
                                    <span className="text-slate-600">{Math.round(f.bajtow / 1e6)} MB{f.muzyka ? ' · 🎵' : ''}</span>
                                    <span className={`font-mono ${f.youtube ? 'text-red-300' : 'text-amber-300'}`}>{f.youtube ? 'YouTube' : 'tylko u gospodarza'}</span>
                                    <input value={yt[f.id] ?? f.youtube?.url ?? ''} onChange={(e) => setYt((y) => ({ ...y, [f.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') void ustawYt(f.id); }} placeholder="link YouTube po wgraniu" className="min-w-40 flex-1 rounded border border-slate-800 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-slate-300" />
                                    <button onClick={() => void ustawYt(f.id)} className="text-red-300 hover:text-red-200" title="zapisz link YouTube"><Youtube size={12} /></button>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-600">Film bez linku YouTube gra tylko na tej maszynie (strona pyta Most). Wgraj go na kanał, wklej link — i gra u każdego. Suno gra z ramki Suno wszędzie. <b>Oko = ukryj</b> — pozycja znika ze strony po następnym „Publikuj".</p>

                        {/* ── Produkty i utwory z dysku: to samo oko ── */}
                        <details className="rounded-lg border border-slate-800 p-2">
                            <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-slate-400">Produkty ({k.produkty.length}) · utwory z dysku ({k.utwory.length}) — co pokazać</summary>
                            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                                {k.produkty.map((p) => (
                                    <div key={p.id} className={`flex items-center gap-1.5 text-[10px] ${p.ukryty ? 'opacity-40' : ''}`}>
                                        <button onClick={() => void ukryj(p.id, !p.ukryty)} title={p.ukryty ? 'pokaż' : 'ukryj'} className="text-slate-500 hover:text-white">{p.ukryty ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                                        <span className="text-slate-600">{p.dzial}</span>
                                        <span className="truncate text-slate-200">{p.tytul}</span>
                                    </div>
                                ))}
                                {k.utwory.map((u) => (
                                    <div key={u.id} className={`flex items-center gap-1.5 text-[10px] ${u.ukryty ? 'opacity-40' : ''}`}>
                                        <button onClick={() => void ukryj(u.id, !u.ukryty)} title={u.ukryty ? 'pokaż' : 'ukryj'} className="text-slate-500 hover:text-white">{u.ukryty ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                                        <span className="text-slate-600">🎧</span>
                                        <span className="truncate text-slate-200">{u.tytul}</span>
                                    </div>
                                ))}
                            </div>
                        </details>

                        <button onClick={() => void publikuj()} disabled={publikuje} className="flex items-center justify-center gap-2 rounded-lg bg-indigo-500/30 py-2 text-[11px] font-bold text-indigo-100 disabled:opacity-50">
                            {publikuje ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Publikuj wystawę do teo-center
                        </button>
                        {wynik && <div className="font-mono text-[10px] text-slate-500">zapisano {wynik.plik.split(/[\\/]/).slice(-3).join('/')} · {wynik.filmy} filmów ({wynik.bezYouTube} bez YouTube) · {wynik.suno} Suno · {wynik.produkty} produktów · {wynik.sekundy} s. Dalej: `npm run build` w teo-center i wgranie.</div>}
                    </>
                )}
            </div>
        </DashboardCard>
    );
};
