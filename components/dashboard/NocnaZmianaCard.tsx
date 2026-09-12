/**
 * 🌙 NOCNA ZMIANA — karta na dashboardzie.
 *
 * Pokazuje TRZY BRAMY z powodami (bezczynność / karta / RAM), kolejkę robót
 * i dziennik. Dodawanie tylko z białej listy mostu (services/NocnaZmiana.js) —
 * karta nie zna żadnej ścieżki, której most nie zna.
 *
 * ⚠️ „Uruchom teraz" omija bramy ŚWIADOMIE, ręką człowieka, i tak jest w dzienniku
 * oznaczone. Automat nigdy nie omija.
 */

import React, { useCallback, useEffect, useState } from 'react';
import DashboardCard from '../DashboardCard';
import { Moon, Play, Trash2, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface OpisPola { nazwa: string; etykieta: string; wybor?: string; opcje?: string[]; typ?: 'liczba' | 'tekst' | 'lista'; zalezyOd?: string[]; wymagane: boolean }
interface Robota { rodzaj: string; opis: string; pola: string[]; wymagane?: string[]; opisPol?: OpisPola[] }
interface Zadanie { id: string; rodzaj: string; parametry: Record<string, unknown>; notatka: string; stan: 'czeka' | 'trwa' | 'gotowe' | 'blad'; dodano: string; sekund?: number; blad?: string | null; recznie?: boolean }
interface Stan {
    wlaczona: boolean;
    bezczynnySek: number | null;
    bramy: { bezczynnosc: boolean; karta: boolean; ram: boolean };
    powody: string[];
    trwa: { id: string; rodzaj: string; od: string } | null;
    ostatnieSprawdzenie: number | null;
    prog: { bezczynnoscS: number; minRamGb: number; minVramMiB: number; coIleS: number };
    zadania: Zadanie[];
    dziennik: { kiedy: string; rodzaj: string; stan: string; sekund: number; blad: string | null; recznie?: boolean }[];
    roboty: Robota[];
}

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

const KOLOR_STANU: Record<Zadanie['stan'], string> = { czeka: 'text-slate-400', trwa: 'text-cyan-300', gotowe: 'text-emerald-300', blad: 'text-red-300' };

export const NocnaZmianaCard: React.FC = () => {
    const [stan, setStan] = useState<Stan | null>(null);
    // null = nie wiadomo · 'zyje' · 'milczy' · 'stary' (most odpowiada, ale nie zna trasy — wymaga restartu)
    const [most, setMost] = useState<null | 'zyje' | 'milczy' | 'stary'>(null);
    const [rodzaj, setRodzaj] = useState('');
    // Parametry jako obiekt — pola z wyborem (projekt, odcinek, reżyser…) idą z list mostu, nie z pamięci.
    const [parametry, setParametry] = useState<Record<string, string>>({});
    const [zajety, setZajety] = useState(false);

    const odswiez = useCallback(async () => {
        try { setStan(await zMostu<Stan>('/api/nocna/stan')); setMost('zyje'); }
        catch (e) {
            // ⚠️ 404 to NIE „most milczy" — to most sprzed restartu, który tej trasy nie zna.
            // Mówienie „milczy", gdy odpowiada, wysłałoby Suwerena na złe polowanie.
            setMost(/HTTP 404/.test(e instanceof Error ? e.message : '') ? 'stary' : 'milczy');
        }
    }, []);

    useEffect(() => {
        void odswiez();
        const i = window.setInterval(() => void odswiez(), 15_000);
        return () => window.clearInterval(i);
    }, [odswiez]);

    const przelacz = async () => {
        if (!stan) return;
        setZajety(true);
        try { await zMostu('/api/nocna/przelacz', { method: 'POST', body: JSON.stringify({ wlaczona: !stan.wlaczona }) }); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const sprawdzBramy = async () => {
        setZajety(true);
        try { await zMostu('/api/nocna/bramy'); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const dodaj = async () => {
        if (!rodzaj) return;
        const robota = stan?.roboty.find((r) => r.rodzaj === rodzaj);
        const brak = (robota?.opisPol ?? []).filter((o) => o.wymagane && !String(parametry[o.nazwa] ?? '').trim());
        if (brak.length) { toast.error(`Wskaż: ${brak.map((o) => o.etykieta).join(', ')} — bez tego robota nie wie, co ma robić.`); return; }
        const p: Record<string, unknown> = {};
        for (const o of robota?.opisPol ?? []) {
            const v = String(parametry[o.nazwa] ?? '').trim();
            if (!v) continue;
            p[o.nazwa] = o.typ === 'liczba' ? Number(v) : o.typ === 'lista' ? v.split(',').map((x) => x.trim()).filter(Boolean) : v;
        }
        setZajety(true);
        try { await zMostu('/api/nocna/dodaj', { method: 'POST', body: JSON.stringify({ rodzaj, parametry: p }) }); setParametry({}); await odswiez(); toast.success('Dodane do kolejki — ruszy, gdy odejdziesz od klawiatury.'); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const usun = async (id: string) => {
        try { await zMostu(`/api/nocna/${encodeURIComponent(id)}`, { method: 'DELETE' }); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    };

    const teraz = async (id: string) => {
        setZajety(true);
        try { const r = await zMostu<{ sekund: number }>(`/api/nocna/${encodeURIComponent(id)}/teraz`, { method: 'POST' }); toast.success(`Zrobione ręcznie w ${r.sekund} s.`); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 }); await odswiez(); }
        finally { setZajety(false); }
    };

    const wybrana = stan?.roboty.find((r) => r.rodzaj === rodzaj);
    const Brama: React.FC<{ nazwa: string; ok: boolean }> = ({ nazwa, ok }) => (
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono ${ok ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-slate-700/60 bg-slate-800/40 text-slate-500'}`}>
            {ok ? '●' : '○'} {nazwa}
        </span>
    );

    return (
        <DashboardCard title="Nocna Zmiana" icon={<Moon className="w-full h-full" />}>
            <div className="flex flex-col gap-3 text-xs">
                {most === 'milczy' && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200">Most (:3001) milczy — Nocna Zmiana żyje w moście.</div>}
                {most === 'stary' && <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200">Most odpowiada, ale nie zna jeszcze Nocnej Zmiany — to proces sprzed restartu. Zrestartuj Katedrę (START_KATEDRA.bat).</div>}

                {stan && (
                    <>
                        {/* ── Włącznik + bramy ── */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                                onClick={przelacz}
                                disabled={zajety}
                                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${stan.wlaczona ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                            >
                                {stan.wlaczona ? '🌙 WŁĄCZONA' : 'WYŁĄCZONA'}
                            </button>
                            <div className="flex items-center gap-1.5">
                                <Brama nazwa={`bezczynność ${stan.bezczynnySek !== null ? Math.round(stan.bezczynnySek / 60) + ' min' : '?'}`} ok={stan.bramy.bezczynnosc} />
                                <Brama nazwa="karta" ok={stan.bramy.karta} />
                                <Brama nazwa="RAM" ok={stan.bramy.ram} />
                                <button onClick={sprawdzBramy} disabled={zajety} title="Sprawdź bramy teraz" className="p-1 text-slate-500 hover:text-slate-200">
                                    {zajety ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                </button>
                            </div>
                        </div>

                        <p className="text-[10px] leading-relaxed text-slate-500">
                            Rusza jedno zadanie naraz, gdy nie dotykasz klawiatury ≥ {Math.round(stan.prog.bezczynnoscS / 60)} min, karta nie liczy i wolnego RAM jest ≥ {stan.prog.minRamGb} GB.
                            Sprawdza co {stan.prog.coIleS} s{stan.ostatnieSprawdzenie ? ` · ostatnio ${new Date(stan.ostatnieSprawdzenie).toLocaleTimeString('pl-PL')}` : ''}.
                        </p>
                        {stan.powody.length > 0 && stan.zadania.some((z) => z.stan === 'czeka') && (
                            <ul className="space-y-0.5 text-[10px] text-slate-400">
                                {stan.powody.map((p) => <li key={p}>· {p}</li>)}
                            </ul>
                        )}
                        {stan.trwa && <div className="text-[11px] text-cyan-300">⟳ trwa: {stan.trwa.rodzaj} od {new Date(stan.trwa.od).toLocaleTimeString('pl-PL')}</div>}

                        {/* ── Kolejka ── */}
                        <div className="space-y-1">
                            {stan.zadania.length === 0 && <div className="text-[10px] text-slate-600">Kolejka pusta — dodaj robotę niżej.</div>}
                            {stan.zadania.map((z) => (
                                <div key={z.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-2 py-1.5">
                                    <div className="min-w-0">
                                        <span className={`font-mono ${KOLOR_STANU[z.stan]}`}>{z.stan}</span>
                                        <span className="ml-2 text-slate-200">{stan.roboty.find((r) => r.rodzaj === z.rodzaj)?.opis ?? z.rodzaj}</span>
                                        {Object.keys(z.parametry ?? {}).length > 0 && <span className="ml-2 text-[10px] text-slate-500">{JSON.stringify(z.parametry)}</span>}
                                        {z.blad && <div className="text-[10px] text-red-300">{z.blad}</div>}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {z.stan === 'czeka' && <button onClick={() => void teraz(z.id)} disabled={zajety} title="Uruchom teraz (omija bramy — świadomie)" className="p-1 text-slate-500 hover:text-cyan-300"><Play size={12} /></button>}
                                        {z.stan !== 'trwa' && <button onClick={() => void usun(z.id)} title="Usuń" className="p-1 text-slate-600 hover:text-red-300"><Trash2 size={12} /></button>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Dodaj z białej listy ── */}
                        <div className="flex flex-col gap-1.5 rounded-lg border border-slate-700/50 p-2">
                            <div className="flex gap-1.5">
                                <select value={rodzaj} onChange={(e) => { setRodzaj(e.target.value); setParametry({}); }} className="flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1 text-[11px] text-slate-200">
                                    <option value="">— robota z białej listy —</option>
                                    {stan.roboty.map((r) => <option key={r.rodzaj} value={r.rodzaj}>{r.opis}</option>)}
                                </select>
                                <button onClick={dodaj} disabled={!rodzaj || zajety} className="rounded bg-indigo-500/30 px-2 text-indigo-200 disabled:opacity-40" title="Dodaj do kolejki"><Plus size={14} /></button>
                            </div>
                            {wybrana && (wybrana.opisPol?.length ?? 0) > 0 && (
                                <PolaRoboty opisy={wybrana.opisPol!} wartosci={parametry} onChange={(k, v) => setParametry((p) => ({ ...p, [k]: v }))} />
                            )}
                            {wybrana && !wybrana.opisPol && wybrana.pola.length > 0 && (
                                <div className="text-[10px] text-amber-300">Most sprzed restartu — nie zna jeszcze opisów pól. Zrestartuj Katedrę, żeby wybierać projekt z listy.</div>
                            )}
                        </div>

                        {/* ── Dziennik ── */}
                        {stan.dziennik.length > 0 && (
                            <details className="text-[10px] text-slate-500">
                                <summary className="cursor-pointer">dziennik ({stan.dziennik.length})</summary>
                                <ul className="mt-1 space-y-0.5">
                                    {stan.dziennik.slice(0, 10).map((w, i) => (
                                        <li key={i} className="font-mono">
                                            {new Date(w.kiedy).toLocaleString('pl-PL')} · {w.rodzaj} · <span className={w.stan === 'gotowe' ? 'text-emerald-400' : 'text-red-300'}>{w.stan}</span> · {w.sekund}s{w.recznie ? ' · ręcznie' : ''}{w.blad ? ` · ${w.blad}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </>
                )}
            </div>
        </DashboardCard>
    );
};

/**
 * Formularz pól roboty. Pole z `wybor` bierze listę z mostu (projekt Story, odcinek
 * tego projektu, reżyser, silnik obrazu, apka Labu, projekt chipu, biznes); reszta
 * to liczba/tekst. Wymagane pole ma gwiazdkę i blokuje „Dodaj".
 */
const ZRODLA: Record<string, (zalezne: Record<string, string>) => Promise<{ id: string; nazwa: string }[]>> = {
    'projekt-story': async () => (await zMostu<{ projekty: { nazwa: string; odcinkow?: number }[] }>('/api/rezyser/projekty')).projekty.map((p) => ({ id: p.nazwa, nazwa: `${p.nazwa}${p.odcinkow ? ` · ${p.odcinkow} odc.` : ''}` })),
    'odcinek': async (z) => {
        const serial = z.projekt || z.serial || '';
        if (!serial) return [];
        const d = await zMostu<{ pamiec: { odcinki?: { id: string; numer: number; tytul: string; status: string }[] } }>(`/api/rezyser/pamiec?serial=${encodeURIComponent(serial)}`);
        return (d.pamiec.odcinki ?? []).map((o) => ({ id: o.id, nazwa: `#${o.numer} ${o.tytul} · ${o.status}` }));
    },
    'rezyser': async () => (await zMostu<{ rezyserzy: { id: string; nazwa: string }[] }>('/api/rezyserzy')).rezyserzy,
    'silnik-obrazu': async () => (await zMostu<{ silniki: { id: string; nazwa: string }[] }>('/api/silniki-obrazu')).silniki,
    'lab-apka': async () => (await zMostu<{ apki: { id: string; nazwa: string; jest: boolean }[] }>('/api/lab/apki')).apki.filter((a) => a.jest),
    'lab-chip': async () => (await zMostu<{ lista: { id: string; nazwa: string; pytanOtwartych?: number }[] }>('/api/lab/chipy')).lista.map((c) => ({ id: c.id, nazwa: `${c.nazwa}${c.pytanOtwartych ? ` · ${c.pytanOtwartych} pytań` : ''}` })),
    'biznes': async () => (await zMostu<{ biznesy: { id: string; nazwa: string }[] }>('/api/latarnik/biznesy')).biznesy,
};

const PolaRoboty: React.FC<{ opisy: OpisPola[]; wartosci: Record<string, string>; onChange: (k: string, v: string) => void }> = ({ opisy, wartosci, onChange }) => {
    const [listy, setListy] = useState<Record<string, { id: string; nazwa: string }[]>>({});
    const [bledy, setBledy] = useState<Record<string, string>>({});
    const zalezne = `${wartosci.projekt ?? ''}|${wartosci.serial ?? ''}`;

    useEffect(() => {
        let zywy = true;
        for (const o of opisy) {
            if (!o.wybor || o.wybor === 'opcje') continue;
            const zr = ZRODLA[o.wybor];
            if (!zr) continue;
            zr(wartosci).then((l) => { if (zywy) { setListy((s) => ({ ...s, [o.nazwa]: l })); setBledy((b) => ({ ...b, [o.nazwa]: '' })); } })
                .catch((e) => { if (zywy) setBledy((b) => ({ ...b, [o.nazwa]: e instanceof Error ? e.message : String(e) })); });
        }
        return () => { zywy = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opisy, zalezne]);

    return (
        <div className="grid grid-cols-2 gap-1.5">
            {opisy.map((o) => {
                const wspolne = 'rounded border border-slate-700 bg-black/40 px-2 py-1 text-[11px] text-slate-200';
                const et = <span className="text-[9px] uppercase tracking-wider text-slate-500">{o.etykieta}{o.wymagane && <span className="text-amber-300"> *</span>}</span>;
                if (o.wybor === 'opcje') return (
                    <label key={o.nazwa} className="flex flex-col gap-0.5">{et}
                        <select value={wartosci[o.nazwa] ?? ''} onChange={(e) => onChange(o.nazwa, e.target.value)} className={wspolne}>
                            <option value="">— domyślnie —</option>
                            {(o.opcje ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                    </label>
                );
                if (o.wybor) {
                    const l = listy[o.nazwa];
                    const czekaNa = o.zalezyOd && !o.zalezyOd.some((z) => wartosci[z]);
                    return (
                        <label key={o.nazwa} className="flex flex-col gap-0.5">{et}
                            <select value={wartosci[o.nazwa] ?? ''} onChange={(e) => onChange(o.nazwa, e.target.value)} className={wspolne} disabled={!!czekaNa}>
                                <option value="">{czekaNa ? `najpierw ${o.zalezyOd!.join('/')}` : bledy[o.nazwa] ? 'lista niedostępna' : l ? (o.wymagane ? '— wybierz —' : '— wszystkie / domyślnie —') : 'ładuję…'}</option>
                                {(l ?? []).map((x) => <option key={x.id} value={x.id}>{x.nazwa}</option>)}
                            </select>
                            {bledy[o.nazwa] && <span className="text-[9px] text-red-300">{bledy[o.nazwa]}</span>}
                        </label>
                    );
                }
                return (
                    <label key={o.nazwa} className="flex flex-col gap-0.5">{et}
                        <input type={o.typ === 'liczba' ? 'number' : 'text'} value={wartosci[o.nazwa] ?? ''} onChange={(e) => onChange(o.nazwa, e.target.value)} className={wspolne} placeholder={o.typ === 'lista' ? 'joanna, klatka' : ''} />
                    </label>
                );
            })}
        </div>
    );
};
