/**
 * 🏢 Firma Katedry w WORKPalace (skrzydło ⚖️): 🥚 Jajo Założyciela (profil biznesu), 💰 Skarbnik, ⚖️ Mecenas.
 * Serwis: services/Firma.js (`/api/firma/*`, tylko przy maszynie). Każda Katedra ma swój profil — tu go zakłada.
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

interface Profil {
    nazwa: string; marki: string[]; branza: string; kraj: string; jurysdykcja: string; forma: string; kleinunternehmer: boolean; waluta: string;
    domeny: string[]; wlasciciel: string; adres: { ulica: string; kod: string; miasto: string; kraj: string }; email: string; telefon: string;
    progi: { poprzedniRok: number; biezacyRok: number }; zalozony: boolean;
}
interface Prog { kwota: number; prog: number; procent: number; stan: 'ok' | 'blisko' | 'przekroczony' }
interface Pozycja { id: string; data: string; rodzaj: 'przychod' | 'koszt'; kwota: number; waluta: string; opis: string; zrodlo: string }
interface Skarb {
    rok: number; waluta: string; przychody: number; koszty: number; wynik: number; inneWaluty: Record<string, number>;
    kleinunternehmer: { poprzedniRok: Prog; biezacyRok: Prog; uwaga: string } | null; zrodla: { stripe: number; reczne: number; brak: string[] }; pozycje: Pozycja[];
}
const BARWA = { ok: 'text-emerald-300', blisko: 'text-amber-300', przekroczony: 'text-red-300' };
const kw = (n: number, w: string) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${w}`;
const pole = 'w-full rounded bg-black/50 px-2 py-1 text-xs';

export const FirmaPanel: React.FC = () => {
    const [p, setP] = useState<Profil | null>(null);
    const [edycja, setEdycja] = useState(false);
    const [s, setS] = useState<Skarb | null>(null);
    const [rok, setRok] = useState(new Date().getFullYear());
    const [nowa, setNowa] = useState({ data: new Date().toISOString().slice(0, 10), rodzaj: 'przychod', kwota: '', opis: '' });
    const [dok, setDok] = useState<{ tekst: string; braki: string[]; plik: string } | null>(null);
    const [blad, setBlad] = useState<string | null>(null);

    const wczytaj = useCallback(async () => {
        try {
            const { profil } = await zMostu<{ profil: Profil }>('/api/firma/profil'); setP(profil); setEdycja(!profil.zalozony);
            setS(await zMostu<Skarb>(`/api/firma/skarbnik?rok=${rok}`)); setBlad(null);
        } catch (e) { setBlad((e as Error).message); }
    }, [rok]);
    useEffect(() => { void wczytaj(); }, [wczytaj]);

    const zapiszProfil = async () => {
        if (!p) return;
        try { const { profil } = await zMostu<{ profil: Profil }>('/api/firma/profil', { method: 'PUT', body: JSON.stringify(p) }); setP(profil); setEdycja(false); toast.success('🥚 Profil firmy zapisany'); void wczytaj(); }
        catch (e) { toast.error((e as Error).message); }
    };
    const dodaj = async () => {
        try { await zMostu('/api/firma/ksiega', { method: 'POST', body: JSON.stringify({ ...nowa, kwota: Number(nowa.kwota.replace(',', '.')) }) }); setNowa({ ...nowa, kwota: '', opis: '' }); void wczytaj(); }
        catch (e) { toast.error((e as Error).message); }
    };
    const usun = async (id: string) => { try { await zMostu(`/api/firma/ksiega/${id}`, { method: 'DELETE' }); void wczytaj(); } catch (e) { toast.error((e as Error).message); } };
    const mecenas = async (dokument: string, jezyk: string) => {
        try { setDok(await zMostu<{ tekst: string; braki: string[]; plik: string }>('/api/firma/mecenas', { method: 'POST', body: JSON.stringify({ dokument, jezyk }) })); }
        catch (e) { toast.error((e as Error).message); }
    };
    const ust = (zm: Partial<Profil>) => p && setP({ ...p, ...zm });

    if (blad) return <div className="rounded bg-red-900/40 p-2 text-xs text-red-200">⚠ Firma: {blad}</div>;
    if (!p) return <p className="text-xs text-slate-500">…</p>;
    return (
        <div className="space-y-4 text-sm">
            {/* 🥚 Jajo Założyciela */}
            <div className="rounded-xl border border-amber-500/30 bg-black/30 p-3">
                <div className="flex items-center justify-between">
                    <b className="text-amber-200">🥚 Jajo Założyciela — {p.zalozony ? p.nazwa : 'Twoja firma'}</b>
                    {p.zalozony && !edycja && <button onClick={() => setEdycja(true)} className="text-xs text-amber-300">✎ zmień</button>}
                </div>
                {!edycja ? (
                    <p className="mt-1 text-xs text-white/70">{[p.marki.join(' · '), p.branza, p.jurysdykcja || p.kraj, p.kleinunternehmer ? 'Kleinunternehmer § 19 UStG' : '', p.waluta, p.domeny.join(', ')].filter(Boolean).join(' · ')}</p>
                ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {!p.zalozony && <p className="md:col-span-2 text-xs text-white/60">Ta Katedra nie ma jeszcze profilu firmy. Wpisz dane własnego biznesu: Skarbnik i Mecenas będą liczyć i pisać pod nie.</p>}
                        <label className="text-xs">Nazwa firmy<input value={p.nazwa} onChange={(e) => ust({ nazwa: e.target.value })} className={pole} /></label>
                        <label className="text-xs">Marki (po przecinku)<input value={p.marki.join(', ')} onChange={(e) => ust({ marki: e.target.value.split(',') })} className={pole} /></label>
                        <label className="text-xs md:col-span-2">Branża<input value={p.branza} onChange={(e) => ust({ branza: e.target.value })} className={pole} /></label>
                        <label className="text-xs">Kraj podatków (kod, np. DE, PL)<input value={p.kraj} onChange={(e) => ust({ kraj: e.target.value })} maxLength={2} className={pole} /></label>
                        <label className="text-xs">Jurysdykcja (np. DE-NRW)<input value={p.jurysdykcja} onChange={(e) => ust({ jurysdykcja: e.target.value })} className={pole} /></label>
                        <label className="text-xs">Forma (np. Einzelunternehmen, JDG)<input value={p.forma} onChange={(e) => ust({ forma: e.target.value })} className={pole} /></label>
                        <label className="text-xs">Waluta<input value={p.waluta} onChange={(e) => ust({ waluta: e.target.value })} maxLength={3} className={pole} /></label>
                        <label className="text-xs md:col-span-2">Domeny (po przecinku)<input value={p.domeny.join(', ')} onChange={(e) => ust({ domeny: e.target.value.split(',') })} className={pole} /></label>
                        <label className="flex items-center gap-2 text-xs md:col-span-2"><input type="checkbox" checked={p.kleinunternehmer} onChange={(e) => ust({ kleinunternehmer: e.target.checked })} /> Kleinunternehmer (§ 19 UStG) — progi: poprzedni rok
                            <input type="number" value={p.progi.poprzedniRok} onChange={(e) => ust({ progi: { ...p.progi, poprzedniRok: Number(e.target.value) } })} className="w-24 rounded bg-black/50 px-1" /> bieżący
                            <input type="number" value={p.progi.biezacyRok} onChange={(e) => ust({ progi: { ...p.progi, biezacyRok: Number(e.target.value) } })} className="w-24 rounded bg-black/50 px-1" /></label>
                        <p className="md:col-span-2 text-[11px] text-white/50">Do Impressum (zostają w tej Katedrze, wychodzą tylko w szkicach Mecenasa):</p>
                        <label className="text-xs">Właściciel (imię i nazwisko)<input value={p.wlasciciel} onChange={(e) => ust({ wlasciciel: e.target.value })} className={pole} /></label>
                        <label className="text-xs">E-mail kontaktowy<input value={p.email} onChange={(e) => ust({ email: e.target.value })} className={pole} /></label>
                        <label className="text-xs">Ulica i numer<input value={p.adres.ulica} onChange={(e) => ust({ adres: { ...p.adres, ulica: e.target.value } })} className={pole} /></label>
                        <label className="text-xs">Kod i miasto<span className="flex gap-1"><input value={p.adres.kod} onChange={(e) => ust({ adres: { ...p.adres, kod: e.target.value } })} className="w-20 rounded bg-black/50 px-2 py-1 text-xs" /><input value={p.adres.miasto} onChange={(e) => ust({ adres: { ...p.adres, miasto: e.target.value } })} className={pole} /></span></label>
                        <div className="md:col-span-2 flex gap-2"><button onClick={() => void zapiszProfil()} className="rounded bg-amber-600 px-3 py-1 text-xs font-bold">🥚 Zapisz profil</button>
                            {p.zalozony && <button onClick={() => { setEdycja(false); void wczytaj(); }} className="text-xs text-white/50">anuluj</button>}</div>
                    </div>
                )}
            </div>

            {/* 💰 Skarbnik */}
            {s && (
                <div className="rounded-xl border border-emerald-500/30 bg-black/30 p-3">
                    <div className="flex items-center justify-between">
                        <b className="text-emerald-200">💰 Skarbnik — rok
                            <select value={rok} onChange={(e) => setRok(Number(e.target.value))} className="ml-2 rounded bg-black/50 px-1 text-xs">{[0, 1, 2].map((i) => <option key={i}>{new Date().getFullYear() - i}</option>)}</select></b>
                        <span className="text-xs text-white/50">Stripe: {s.zrodla.stripe} · wpisy: {s.zrodla.reczne}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded bg-emerald-950/40 p-2">Przychody<br /><b className="text-base">{kw(s.przychody, s.waluta)}</b></div>
                        <div className="rounded bg-red-950/30 p-2">Koszty<br /><b className="text-base">{kw(s.koszty, s.waluta)}</b></div>
                        <div className="rounded bg-white/5 p-2">Wynik<br /><b className="text-base">{kw(s.wynik, s.waluta)}</b></div>
                    </div>
                    {Object.keys(s.inneWaluty).length > 0 && <p className="mt-1 text-[11px] text-white/50">Inne waluty (nieprzeliczone): {Object.entries(s.inneWaluty).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
                    {s.kleinunternehmer && (
                        <div className="mt-2 text-xs">
                            <span className={BARWA[s.kleinunternehmer.poprzedniRok.stan]}>Rok {s.rok - 1}: {kw(s.kleinunternehmer.poprzedniRok.kwota, s.waluta)} / {s.kleinunternehmer.poprzedniRok.prog.toLocaleString('pl-PL')} ({s.kleinunternehmer.poprzedniRok.procent}%)</span>
                            {' · '}<span className={BARWA[s.kleinunternehmer.biezacyRok.stan]}>Rok {s.rok}: {kw(s.kleinunternehmer.biezacyRok.kwota, s.waluta)} / {s.kleinunternehmer.biezacyRok.prog.toLocaleString('pl-PL')} ({s.kleinunternehmer.biezacyRok.procent}%)</span>
                            <p className="text-[11px] text-white/50">{s.kleinunternehmer.uwaga}</p>
                        </div>
                    )}
                    <p className="mt-1 text-[11px] text-white/40">Katedra nie widzi: {s.zrodla.brak.join('; ')}.</p>
                    <div className="mt-2 flex flex-wrap items-end gap-1 text-xs">
                        <input type="date" value={nowa.data} onChange={(e) => setNowa({ ...nowa, data: e.target.value })} className="rounded bg-black/50 px-1 py-1" />
                        <select value={nowa.rodzaj} onChange={(e) => setNowa({ ...nowa, rodzaj: e.target.value })} className="rounded bg-black/50 px-1 py-1"><option value="przychod">przychód</option><option value="koszt">koszt</option></select>
                        <input value={nowa.kwota} onChange={(e) => setNowa({ ...nowa, kwota: e.target.value })} placeholder={`kwota ${s.waluta}`} className="w-24 rounded bg-black/50 px-1 py-1" />
                        <input value={nowa.opis} onChange={(e) => setNowa({ ...nowa, opis: e.target.value })} placeholder="opis (np. Shopify wypłata, Printful)" className="flex-1 rounded bg-black/50 px-1 py-1" />
                        <button onClick={() => void dodaj()} disabled={!nowa.kwota} className="rounded bg-emerald-700 px-2 py-1 font-bold disabled:opacity-40">＋</button>
                    </div>
                    <div className="mt-2 max-h-40 overflow-y-auto text-[11px]">
                        {s.pozycje.map((x) => (
                            <div key={x.id} className="flex gap-2 border-b border-white/5 py-0.5">
                                <span className="text-white/50">{x.data}</span><span className={x.rodzaj === 'koszt' ? 'text-red-300' : 'text-emerald-300'}>{x.rodzaj === 'koszt' ? '−' : '+'}{kw(x.kwota, x.waluta)}</span>
                                <span className="truncate text-white/70">{x.opis}</span><span className="ml-auto text-white/40">{x.zrodlo}</span>
                                {x.zrodlo !== 'stripe' && <button onClick={() => void usun(x.id)} className="text-white/40">✕</button>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ⚖️ Mecenas */}
            <div className="rounded-xl border border-sky-500/30 bg-black/30 p-3">
                <b className="text-sky-200">⚖️ Mecenas — szkice dokumentów</b>
                <p className="text-[11px] text-white/50">Składane z profilu firmy, z nagłówkiem ENTWURF/DRAFT. To nie porada prawna — przed publikacją daj do sprawdzenia Steuerberaterowi albo prawnikowi.</p>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                    {[['impressum', 'Impressum'], ['datenschutz', 'Datenschutz'], ['agb', 'AGB']].map(([d, n]) => ['de', 'en'].map((j) => (
                        <button key={d + j} onClick={() => void mecenas(d, j)} className="rounded border border-sky-500/40 px-2 py-1">{n} · {j}</button>
                    )))}
                </div>
                {dok && (
                    <div className="mt-2">
                        {dok.braki.length > 0 && <p className="text-xs text-amber-300">⚠ Brakuje w profilu: {dok.braki.join(', ')} — w tekście stoi [FEHLT]/[MISSING].</p>}
                        <div className="flex items-center gap-2 text-[11px] text-white/50">zapisany: _OtakOs_Wymiar/{dok.plik}<button onClick={() => { void navigator.clipboard.writeText(dok.tekst); toast.success('Skopiowano'); }} className="text-sky-300">📋 kopiuj</button></div>
                        <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-black/50 p-2 text-[11px] text-white/80">{dok.tekst}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FirmaPanel;
