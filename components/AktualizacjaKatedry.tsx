/**
 * 🔄 Aktualizacja Katedry — widok w menu (Rdzeń i tarcza) + pasek, gdy jest nowsza wersja (services/Aktualizator.js).
 *
 * Węzeł z gita: porównanie z origin i `git pull --ff-only`. Węzeł z paczki otakos.wtf: wersja.json strony,
 * pobranie zipa, suma SHA-256, podmiana TYLKO kodu (dane, sekrety i skille zostają), kopia do cofnięcia.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';

interface Zmiana { data?: string; ref?: string; tytul: string }
interface Sprawdzenie { tryb: 'git' | 'paczka'; lokalna: any; zdalna: any; nowsza: boolean; zmiany: Zmiana[]; uwaga?: string }
interface Stan { stan: 'brak' | 'trwa' | 'gotowe' | 'blad'; etap?: string; postep?: number | null; blad?: string | null; wynik?: any }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

const opisWersji = (s: Sprawdzenie | null, ktora: 'lokalna' | 'zdalna') => {
    const w = s?.[ktora];
    if (!w) return '—';
    if (s?.tryb === 'git') return `${w.commit ?? '?'}${w.galaz ? ` (${w.galaz})` : ''}`;
    return w.numer ? `${w.wersja ?? ''} ${w.numer}`.trim() : 'bez numeru (paczka sprzed Aktualizatora)';
};

export const AktualizacjaView: React.FC = () => {
    const [spr, setSpr] = useState<Sprawdzenie | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [sprawdza, setSprawdza] = useState(false);
    const [stan, setStan] = useState<Stan>({ stan: 'brak' });
    const [cofniecie, setCofniecie] = useState<string | null>(null);

    const sprawdz = useCallback(async () => {
        setSprawdza(true); setBlad(null);
        try { setSpr(await zMostu<Sprawdzenie>('/api/aktualizacja/sprawdz')); }
        catch (e: any) { setBlad(e.message); setSpr(null); }
        finally { setSprawdza(false); }
    }, []);
    useEffect(() => { sprawdz(); zMostu<Stan>('/api/aktualizacja/stan').then(setStan).catch(() => {}); }, [sprawdz]);

    // Sondaż w trakcie aktualizacji.
    useEffect(() => {
        if (stan.stan !== 'trwa') return;
        const t = setInterval(() => zMostu<Stan>('/api/aktualizacja/stan').then(setStan).catch(() => {}), 1500);
        return () => clearInterval(t);
    }, [stan.stan]);

    const zastosuj = async () => {
        setBlad(null);
        try { await zMostu('/api/aktualizacja/zastosuj', { method: 'POST', body: '{}' }); setStan({ stan: 'trwa', etap: 'start' }); }
        catch (e: any) { setBlad(e.message); }
    };
    const cofnij = async () => {
        if (!window.confirm('Cofnąć ostatnią aktualizację? Nadpisane pliki wrócą z kopii, potem trzeba uruchomić Katedrę ponownie.')) return;
        try { const d = await zMostu<{ przywrocone: number }>('/api/aktualizacja/cofnij', { method: 'POST', body: '{}' }); setCofniecie(`Przywrócono ${d.przywrocone} plików — uruchom Katedrę ponownie.`); }
        catch (e: any) { setCofniecie(`⚠ ${e.message}`); }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-cyan-500/30 bg-black/50 p-5 text-sm text-slate-200">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-cyan-200">🔄 Aktualizacja Katedry</h2>
                    <p className="text-xs text-slate-400">
                        {spr?.tryb === 'git' ? 'Węzeł z gita — porównanie z origin, aktualizacja przez git pull.'
                            : 'Węzeł z paczki otakos.wtf — podmiana tylko kodu; dzieła, stado, sekrety i Twoje skille zostają.'}
                    </p>
                </div>
                <button onClick={sprawdz} disabled={sprawdza || stan.stan === 'trwa'}
                    className="rounded-lg border border-cyan-500/50 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-40">
                    {sprawdza ? '⟳ Sprawdzam…' : '⟳ Sprawdź'}
                </button>
            </div>

            {blad && <div className="rounded-lg border border-rose-600/50 bg-rose-950/40 px-3 py-2 text-rose-200">⚠ {blad}</div>}

            {spr && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                        <div className="text-slate-400">Ta Katedra</div>
                        <div className="mt-1 font-mono text-slate-100">{opisWersji(spr, 'lokalna')}</div>
                    </div>
                    <div className={`rounded-lg border p-3 ${spr.nowsza ? 'border-emerald-500/50 bg-emerald-950/30' : 'border-slate-700 bg-slate-900/60'}`}>
                        <div className="text-slate-400">{spr.tryb === 'git' ? 'origin' : 'otakos.wtf'}</div>
                        <div className="mt-1 font-mono text-slate-100">{opisWersji(spr, 'zdalna')}</div>
                    </div>
                </div>
            )}
            {spr?.uwaga && <div className="text-xs text-amber-300">ℹ {spr.uwaga}</div>}

            {spr && !spr.nowsza && !spr.uwaga && <div className="text-emerald-300">✓ Ta Katedra jest aktualna.</div>}

            {spr?.nowsza && (
                <div className="space-y-2">
                    <div className="font-bold text-emerald-200">✨ Jest nowsza Katedra{spr.zmiany.length ? ` — ${spr.zmiany.length} zmian` : ''}</div>
                    {spr.zmiany.length > 0 && (
                        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs">
                            {spr.zmiany.map((z, i) => (
                                <li key={i}><span className="font-mono text-slate-500">{z.data ?? ''}{z.ref ? ` ${z.ref}` : ''}</span> {z.tytul}</li>
                            ))}
                        </ul>
                    )}
                    {stan.stan !== 'trwa' && stan.stan !== 'gotowe' && (
                        <button onClick={zastosuj} className="rounded-lg bg-emerald-700/80 px-4 py-2 font-bold text-emerald-50 hover:bg-emerald-600">
                            🔄 Zaktualizuj Katedrę
                        </button>
                    )}
                </div>
            )}

            {stan.stan === 'trwa' && (
                <div className="rounded-lg border border-cyan-600/50 bg-cyan-950/30 px-3 py-2 text-cyan-100">
                    ⟳ {stan.etap}{stan.postep != null ? ` — ${stan.postep}%` : ''}…
                </div>
            )}
            {stan.stan === 'gotowe' && stan.wynik && (
                <div className="rounded-lg border border-emerald-600/50 bg-emerald-950/30 px-3 py-2 text-emerald-100">
                    ✓ Zaktualizowano: {stan.wynik.opis}. <b>Uruchom Katedrę ponownie</b> (zamknij okna mostu i UI, potem START), żeby zmiany zadziałały.
                </div>
            )}
            {stan.stan === 'blad' && <div className="rounded-lg border border-rose-600/50 bg-rose-950/40 px-3 py-2 text-rose-200">⚠ Aktualizacja przerwana: {stan.blad}</div>}

            {spr?.tryb === 'paczka' && (
                <div className="border-t border-slate-800 pt-3 text-xs text-slate-400">
                    Coś nie tak po aktualizacji? <button onClick={cofnij} className="underline hover:text-slate-200">Cofnij ostatnią aktualizację</button>
                    {cofniecie && <span className="ml-2 text-slate-200">{cofniecie}</span>}
                </div>
            )}
        </div>
    );
};

const KLUCZ_SPRAWDZENIA = 'otakos_aktualizacja_sprawdzona';
const KLUCZ_ODLOZONA = 'otakos_aktualizacja_odlozona';

/** Pasek nad widokiem: raz na 6 godzin pyta most; pokazuje się tylko, gdy jest nowsza Katedra (i nie odłożono jej). */
export const AktualizacjaBaner: React.FC<{ onOtworz: () => void }> = ({ onOtworz }) => {
    const [spr, setSpr] = useState<Sprawdzenie | null>(null);
    useEffect(() => {
        let ostatnio = 0;
        try { ostatnio = Number(localStorage.getItem(KLUCZ_SPRAWDZENIA) || 0); } catch { /* bez pamięci */ }
        if (Date.now() - ostatnio < 6 * 3600_000) return;
        zMostu<Sprawdzenie>('/api/aktualizacja/sprawdz').then((s) => {
            try { localStorage.setItem(KLUCZ_SPRAWDZENIA, String(Date.now())); } catch { /* bez pamięci */ }
            setSpr(s);
        }).catch(() => { /* offline albo strona bez wersja.json — nie męczymy paskiem */ });
    }, []);
    const id = spr ? String(spr.zdalna?.numer ?? spr.zdalna?.commit ?? '') : '';
    let odlozona = '';
    try { odlozona = localStorage.getItem(KLUCZ_ODLOZONA) ?? ''; } catch { /* bez pamięci */ }
    if (!spr?.nowsza || (id && odlozona === id)) return null;
    return (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100">
            <span>🔄 Jest nowsza Katedra{spr.zmiany.length ? ` (${spr.zmiany.length} zmian)` : ''}.</span>
            <span className="flex gap-2">
                <button onClick={onOtworz} className="rounded-lg bg-emerald-700/80 px-3 py-1 text-xs font-bold hover:bg-emerald-600">Zobacz</button>
                <button onClick={() => { try { localStorage.setItem(KLUCZ_ODLOZONA, id); } catch { /* bez pamięci */ } setSpr(null); }}
                    className="rounded-lg border border-emerald-600/50 px-3 py-1 text-xs hover:bg-emerald-900/40">Później</button>
            </span>
        </div>
    );
};

export default AktualizacjaView;
