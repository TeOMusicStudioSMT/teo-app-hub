/**
 * 🎙️ STUDIO PODCASTU — przytulne studio pod Katedrą, w którym prowadzisz podcast (services/StudioPodcastu.js).
 *
 * Trzy kroki, wszystkie prawdziwe: (1) film wstępowy z nagraniem prowadzącego na tle ujęć studia,
 * (2) scenariusz odcinka — goście z bazy aktorów Katedry, (3) nagranie: głosy, kadry w studiu, wstęp + rozmowa
 * → katalog montaży projektu `studio-podcast` (Montażownia, „📺 do publikacji”).
 * Głos prowadzącego klonuje się z jego nagrania wstępu (klon-lokalny, XTTS) — bez tego mówi torem domyślnym.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import DashboardCard from '../DashboardCard';
import { Mic, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface Ujecie { id: string; nazwa: string }
interface Studio {
    nazwa: string; opis: string;
    prowadzacy: { imie: string; rola: string; kolor: string; zdjecie: string | null; glos: { profil?: string; voicestudio?: string } | null };
    ujecia: Ujecie[];
    wstep: { nagranie: string | null; tekst: string; plik: string | null; sekundy: number | null; zrobiono: string | null; napisy?: boolean; blad?: string };
}
interface Aktor { id: string; imie: string; rola: string; kolor: string; wideo?: string | null }
interface Kwestia { kto: string; tekst: string }
interface Odcinek { id: string; tytul: string; temat: string; goscie: string[]; goscieFilm?: string; kwestie: Kwestia[]; etap: string; blad?: string; plik?: string; sekundy?: number | null; postep?: { etap: string; zrobione: number; wszystkich: number }; bezGlosu?: boolean }
interface Stan { studio: Studio; postepWstepu: { etap: string } | null; aktorzy: Aktor[] }

async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}
const blad = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 });
const tekstKwestii = (k: Kwestia[]) => k.map((x) => `${x.kto}: ${x.tekst}`).join('\n');
const zTekstu = (t: string): Kwestia[] => t.split('\n').map((l) => l.match(/^\s*([a-z0-9-]+)\s*:\s*(.+)$/i)).filter((m): m is RegExpMatchArray => !!m).map((m) => ({ kto: m[1], tekst: m[2].trim() }));

export const StudioPodcastuCard: React.FC = () => {
    const [stan, setStan] = useState<Stan | null>(null);
    const [most, setMost] = useState<'zyje' | 'stary' | 'milczy' | null>(null);
    const [odcinki, setOdcinki] = useState<Odcinek[]>([]);
    const [napisy, setNapisy] = useState('');
    const [temat, setTemat] = useState('');
    const [goscie, setGoscie] = useState<string[]>([]);
    const [uwagi, setUwagi] = useState('');
    const [bezGlosu, setBezGlosu] = useState(false);
    const [wstepem, setWstepem] = useState(true);
    const [zGoscmi, setZGoscmi] = useState(true);
    const [praca, setPraca] = useState<string | null>(null);
    const [edycja, setEdycja] = useState<Record<string, string>>({});
    const napisyWpisane = useRef(false);

    const odswiez = useCallback(async () => {
        try {
            const s = await zMostu<Stan>('/api/studio-podcast');
            setStan(s); setMost('zyje');
            if (!napisyWpisane.current) { setNapisy(s.studio.wstep.tekst ?? ''); napisyWpisane.current = true; }
            setOdcinki((await zMostu<{ odcinki: Odcinek[] }>('/api/studio-podcast/odcinki')).odcinki);
        } catch (e) { setMost(/HTTP 404/.test(String(e)) ? 'stary' : 'milczy'); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);
    const trwa = !!stan?.postepWstepu || odcinki.some((o) => o.etap === 'nagrywa');
    useEffect(() => { if (!trwa) return undefined; const t = setInterval(() => void odswiez(), 2500); return () => clearInterval(t); }, [trwa, odswiez]);

    const akcja = async (nazwa: string, f: () => Promise<unknown>, ok?: string) => {
        setPraca(nazwa);
        try { await f(); if (ok) toast.success(ok); await odswiez(); } catch (e) { blad(e); } finally { setPraca(null); }
    };
    const zrobWstep = () => akcja('wstep', () => zMostu('/api/studio-podcast/wstep', { method: 'POST', body: JSON.stringify({ tekst: napisy }) }), 'Film wstępowy rusza w tle.');
    const klonujGlos = () => akcja('glos', () => zMostu('/api/studio-podcast/glos-prowadzacego', { method: 'POST', body: '{}' }), 'Głos prowadzącego sklonowany z nagrania.');
    const przygotuj = () => akcja('scenariusz', async () => {
        const d = await zMostu<{ odcinek: Odcinek }>('/api/studio-podcast/odcinki/przygotuj', { method: 'POST', body: JSON.stringify({ temat, goscie, uwagi }) });
        setEdycja((e) => ({ ...e, [d.odcinek.id]: tekstKwestii(d.odcinek.kwestie) }));
    }, 'Scenariusz gotowy — przeczytaj i popraw.');
    const nagraj = (o: Odcinek) => akcja(o.id, async () => {
        const t = edycja[o.id];
        if (t !== undefined && t !== tekstKwestii(o.kwestie)) await zMostu(`/api/studio-podcast/odcinki/${o.id}/zmien`, { method: 'POST', body: JSON.stringify({ kwestie: zTekstu(t) }) });
        await zMostu(`/api/studio-podcast/odcinki/${o.id}/nagraj`, { method: 'POST', body: JSON.stringify({ bezGlosu, zWstepem: wstepem, zGoscmi }) });
    }, 'Nagrywam odcinek w tle.');

    const w = stan?.studio.wstep;
    const glosNazwa = stan?.studio.prowadzacy.glos?.profil ?? stan?.studio.prowadzacy.glos?.voicestudio ?? null;
    const imie = (id: string) => (id === 'prowadzacy' ? stan?.studio.prowadzacy.imie : stan?.aktorzy.find((a) => a.id === id)?.imie) ?? id;
    return (
        <DashboardCard title="Studio Podcastu" icon={<Mic className="h-full w-full" />}>
            {most === 'stary' && <p className="text-[11px] text-amber-200">Most sprzed restartu — nie zna jeszcze Studia Podcastu. Zrestartuj Katedrę.</p>}
            {most === 'milczy' && <p className="text-[11px] text-slate-400">Most Katedry nie odpowiada — Studio działa tylko przy maszynie.</p>}
            {stan && (
                <div className="flex flex-col gap-3 text-[11px]">
                    <p className="leading-relaxed text-slate-400">{stan.studio.nazwa} · prowadzi <b className="text-slate-200">{stan.studio.prowadzacy.imie}</b> · {stan.studio.ujecia.length} ujęć studia ze zdjęć. Goście z bazy aktorów ({stan.aktorzy.length}).</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {stan.studio.ujecia.slice(0, 6).map((u) => <img key={u.id} src={`${MOST}/api/studio-podcast/plik/ujecie/${u.id}`} alt={u.nazwa} title={u.nazwa} className="aspect-video w-full rounded border border-slate-700 object-cover" />)}
                    </div>

                    <details className="rounded-lg border border-cyan-500/25 p-2" open>
                        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-cyan-300">🎬 Film wstępowy {w?.plik ? `· gotowy (${w.sekundy?.toFixed(1)} s${w.napisy ? ', z napisami' : ''})` : '· jeszcze nie zrobiony'}</summary>
                        <div className="mt-2 flex flex-col gap-2">
                            {w?.nagranie && <audio controls src={`${MOST}/api/studio-podcast/plik/nagranie`} className="h-8 w-full" />}
                            <textarea value={napisy} rows={3} onChange={(e) => setNapisy(e.target.value)} placeholder="Tekst nagrania (opcjonalnie) — pójdzie jako napisy rozłożone na czas nagrania. Bez tekstu film jest bez napisów." className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                            <div className="flex flex-wrap gap-2">
                                <button disabled={!!praca || !!stan.postepWstepu} onClick={zrobWstep} className="rounded border border-cyan-500/40 px-2 py-1 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40">{stan.postepWstepu ? <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />robię wstęp…</> : '🎬 Zrób film wstępowy'}</button>
                                <button disabled={!!praca} onClick={klonujGlos} className="rounded border border-fuchsia-500/40 px-2 py-1 text-fuchsia-200 hover:bg-fuchsia-500/10 disabled:opacity-40">🎙️ Sklonuj głos z nagrania</button>
                                <span className="self-center text-[10px] text-slate-500">{glosNazwa ? `głos: ${glosNazwa}` : 'głos: tor domyślny (sklonuj, żeby mówił jak Ty)'}</span>
                            </div>
                            {w?.blad && <p className="text-amber-300">⚠ {w.blad}</p>}
                            {w?.plik && <video controls src={`${MOST}/api/studio-podcast/plik/wstep?v=${encodeURIComponent(w.zrobiono ?? '')}`} className="w-full rounded border border-slate-700" />}
                        </div>
                    </details>

                    <details className="rounded-lg border border-emerald-500/25 p-2" open>
                        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-emerald-300">🗣️ Nowy odcinek</summary>
                        <div className="mt-2 flex flex-col gap-2">
                            <input value={temat} onChange={(e) => setTemat(e.target.value)} placeholder="Temat odcinka" className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                            <div className="flex flex-wrap gap-1.5">
                                {stan.aktorzy.length === 0 && <span className="text-slate-500">Baza aktorów jest pusta — dodaj aktorów (POST /api/aktorzy), potem wybierzesz gości tutaj.</span>}
                                {stan.aktorzy.filter((a) => a.id !== 'kronikarz').map((a) => (
                                    <button key={a.id} onClick={() => setGoscie((g) => (g.includes(a.id) ? g.filter((x) => x !== a.id) : g.length < 3 ? [...g, a.id] : g))} title={`${a.rola}${a.wideo ? ' · klip wideo' : ''}`}
                                        className={`rounded-full border px-2 py-0.5 ${goscie.includes(a.id) ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100' : 'border-slate-700 text-slate-400'}`}>{a.wideo ? '🎞️ ' : ''}{a.imie}</button>
                                ))}
                            </div>
                            <input value={uwagi} onChange={(e) => setUwagi(e.target.value)} placeholder="Uwagi dla scenarzysty (opcjonalnie)" className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                            <div className="flex flex-wrap items-center gap-3">
                                <button disabled={!!praca || !temat.trim() || !goscie.length} onClick={przygotuj} className="rounded border border-emerald-500/40 px-2 py-1 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40">{praca === 'scenariusz' ? 'piszę…' : '✍️ Napisz scenariusz'}</button>
                                <label className="text-slate-400"><input type="checkbox" checked={zGoscmi} onChange={(e) => setZGoscmi(e.target.checked)} /> wideo z gośćmi</label>
                                <label className="text-slate-400"><input type="checkbox" checked={wstepem} onChange={(e) => setWstepem(e.target.checked)} /> ze wstępem</label>
                                <label className="text-slate-400"><input type="checkbox" checked={bezGlosu} onChange={(e) => setBezGlosu(e.target.checked)} /> bez głosu (same napisy)</label>
                            </div>
                        </div>
                    </details>

                    {odcinki.map((o) => (
                        <div key={o.id} className="rounded-lg border border-slate-700 p-2">
                            <div className="flex items-center justify-between gap-2"><b className="text-slate-200">{o.tytul}</b><span className="text-[10px] text-slate-500">{o.goscie.map(imie).join(', ')} · {o.etap}</span></div>
                            {o.etap === 'nagrywa' && <p className="mt-1 text-cyan-300"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />{o.postep ? `${o.postep.etap} (${o.postep.zrobione}/${o.postep.wszystkich})` : 'nagrywam…'}</p>}
                            {o.etap === 'blad' && <p className="mt-1 text-amber-300">⚠ {o.blad}</p>}
                            {o.etap === 'gotowy' && o.plik && <video controls src={`${MOST}/api/studio-podcast/plik/odcinek/${o.id}`} className="mt-1 w-full rounded border border-slate-700" />}
                            {o.etap === 'gotowy' && <p className="mt-1 text-[10px] text-emerald-300">✓ {o.sekundy?.toFixed(1)} s · w montażach projektu studio-podcast — stamtąd „📺 do publikacji”.</p>}
                            {o.etap !== 'nagrywa' && o.etap !== 'gotowy' && (
                                <>
                                    <textarea value={edycja[o.id] ?? tekstKwestii(o.kwestie)} rows={Math.min(12, o.kwestie.length + 1)} onChange={(e) => setEdycja((x) => ({ ...x, [o.id]: e.target.value }))} className="mt-1 w-full rounded border border-slate-700 bg-black/40 px-2 py-1 font-mono text-[10px] text-slate-200" />
                                    <p className="text-[10px] text-slate-500">Format „id: kwestia” (id: prowadzacy albo id aktora). Poprawki zapiszą się przy nagrywaniu.</p>
                                    {o.goscieFilm && <video controls src={`${MOST}/api/studio-podcast/plik/goscie/${o.id}?v=${encodeURIComponent(o.goscieFilm)}`} className="mt-1 w-full rounded border border-slate-700" />}
                                    <button disabled={!!praca} onClick={() => akcja(`g-${o.id}`, () => zMostu(`/api/studio-podcast/odcinki/${o.id}/goscie`, { method: 'POST', body: JSON.stringify({ bezGlosu }) }), 'Wideo z gośćmi gotowe.')} className="mr-2 mt-1 rounded border border-fuchsia-500/40 px-2 py-1 text-fuchsia-200 hover:bg-fuchsia-500/10 disabled:opacity-40">{praca === `g-${o.id}` ? 'robię…' : '👥 Wideo z gośćmi'}</button>
                                    <button disabled={!!praca} onClick={() => nagraj(o)} className="mt-1 rounded border border-cyan-500/40 px-2 py-1 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40">🎥 Nagraj odcinek</button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </DashboardCard>
    );
};

export default StudioPodcastuCard;
