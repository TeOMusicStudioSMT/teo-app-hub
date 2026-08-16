/**
 * 🌌 ProjectsView — Universa: mapa Katedry, wrota, rejestr modułów, wyprawy.
 *
 * ⚠️ CO TU BYŁO MAKIETĄ DO 2026-08-15 (i zostało zastąpione czymś działającym):
 *  · Kafle wrót były ZABLOKOWANE progiem `wallet.tier`, którego w praktyce nikt
 *    nie ustawiał — więc trzy z czterech świeciły kłódką na zawsze.
 *  · Kafel „TeO Music Studio" prowadził na `teostomusic.studio` — domenę,
 *    która NIE ISTNIEJE (zmierzone: ENOTFOUND). Poprawna to `teomusic.studio`.
 *  · Wyprawy miały liczniki wpisane na sztywno (1 875 000 / 5 000 000 GRV),
 *    zdjęcia ze stocka i przycisk „Contribute GRAV" BEZ obsługi kliknięcia.
 *  · Subskrypcje działały na lokalnej liście, bez związku z księgą GRV.
 *
 * Teraz wszystko idzie przez rejestr w moście i księgę GRV z pieczęcią łańcucha.
 */
import React, { useState, useEffect, useCallback } from 'react';
import DashboardCard from './DashboardCard';
import { AppIcon } from './icons';
import toast from 'react-hot-toast';
import { NetworkOfLoci } from './NetworkOfLoci';
import { UniverseCard } from './dashboard/UniverseCard';
import { WarpTransition } from './effects/WarpTransition';
import { FiMusic, FiPackage, FiShield, FiFeather } from 'react-icons/fi';
import {
    pobierzModuly, dodajModul, usunModul, subskrybuj, anuluj,
    pobierzWyprawy, dodajWyprawe, wplac, saldoWezla, MOJ_WEZEL,
    type Modul, type Wyprawa,
} from '../lib/universa';

export const ProjectsView: React.FC = () => {
    const [moduly, setModuly] = useState<Modul[]>([]);
    const [wyprawy, setWyprawy] = useState<Wyprawa[]>([]);
    const [grv, setGrv] = useState<number | 'INFINITE' | null>(null);
    const [blad, setBlad] = useState('');
    const [zajety, setZajety] = useState(false);

    const [pokazFormModulu, setPokazFormModulu] = useState(false);
    const [nowyModul, setNowyModul] = useState({ nazwa: '', opis: '', url: '', ikona: '🧩', cenaGRV: 0, kategoria: 'narzedzie' as Modul['kategoria'] });

    const [pokazFormWyprawy, setPokazFormWyprawy] = useState(false);
    const [nowaWyprawa, setNowaWyprawa] = useState({ nazwa: '', opis: '', ikona: '🚀', celGRV: 10000 });

    const [isWarping, setIsWarping] = useState(false);

    const odswiez = useCallback(async () => {
        try {
            setBlad('');
            const [m, w, s] = await Promise.all([
                pobierzModuly(MOJ_WEZEL),
                pobierzWyprawy(),
                saldoWezla(MOJ_WEZEL).catch(() => null),
            ]);
            setModuly(m.moduly); setWyprawy(w); setGrv(s?.grv ?? null);
        } catch (e) { setBlad(e instanceof Error ? e.message : String(e)); }
    }, []);

    useEffect(() => { void odswiez(); }, [odswiez]);

    // Wrota otwierają się wprost. Poprzedni próg `tier` blokował je na stałe,
    // a Suweren nie ma powodu prosić własnego systemu o pozwolenie.
    const wejdz = (url: string) => {
        setIsWarping(true);
        setTimeout(() => { window.location.href = url; }, 1200);
    };

    const zmienSubskrypcje = async (m: Modul) => {
        setZajety(true);
        try {
            if (m.subskrybowany) {
                const r = await anuluj(m.id, MOJ_WEZEL);
                toast(r.uwaga, { icon: 'ℹ️', duration: 6000 });
            } else {
                const r = await subskrybuj(m.id, MOJ_WEZEL);
                toast.success(r.zaplacono > 0 ? `Zapłacono ${r.zaplacono} GRV za „${m.nazwa}".` : `„${m.nazwa}" włączony (bez opłat).`);
            }
            await odswiez();
        } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const wyslijModul = async () => {
        setZajety(true);
        try {
            await dodajModul({ ...nowyModul, autor: MOJ_WEZEL });
            setNowyModul({ nazwa: '', opis: '', url: '', ikona: '🧩', cenaGRV: 0, kategoria: 'narzedzie' });
            setPokazFormModulu(false);
            toast.success('Moduł w rejestrze.');
            await odswiez();
        } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const wyslijWyprawe = async () => {
        setZajety(true);
        try {
            await dodajWyprawe({ ...nowaWyprawa, autor: MOJ_WEZEL });
            setNowaWyprawa({ nazwa: '', opis: '', ikona: '🚀', celGRV: 10000 });
            setPokazFormWyprawy(false);
            toast.success('Wyprawa otwarta. Licznik startuje od zera.');
            await odswiez();
        } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const wesprzyj = async (w: Wyprawa) => {
        const wpis = window.prompt(`Ile GRV wpłacasz na „${w.nazwa}"?\nMasz: ${grv === 'INFINITE' ? '∞' : grv} GRV`, '500');
        if (!wpis) return;
        const kwota = Math.floor(Number(wpis));
        if (!(kwota > 0)) { toast.error('Kwota musi być większa od zera.'); return; }
        setZajety(true);
        try {
            const r = await wplac(w.id, MOJ_WEZEL, kwota);
            toast.success(`Wpłacono ${kwota} GRV. Zebrane: ${r.wyprawa.zebraneGRV.toLocaleString('pl-PL')} / ${w.celGRV.toLocaleString('pl-PL')}.`);
            await odswiez();
        } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
        finally { setZajety(false); }
    };

    const pole = 'w-full bg-black/40 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500';

    return (
        <div className="space-y-8">
            <WarpTransition isActive={isWarping} />

            <NetworkOfLoci />

            {blad && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-4 text-sm text-amber-200">
                    {blad} — rejestr modułów i wyprawy żyją w Moście, więc bez niego ta strona pokazuje pustkę zamiast zmyślonych danych.
                </div>
            )}

            {/* ── WROTA ── */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-1 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
                    <h3 className="text-xl font-bold text-white tracking-wide">Wrota</h3>
                    <span className="text-xs text-slate-500">otwarte — bez progów</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <UniverseCard title="TeO Story Studio" subtitle="Narracje. Reżyser. Tablica Produkcji."
                        onClick={() => wejdz('https://teostory.studio')} icon={<FiFeather className="w-8 h-8" />} colorTheme="purple" isLocked={false} />
                    {/* Adres poprawiony: `teostomusic.studio` NIE ISTNIEJE (ENOTFOUND). */}
                    <UniverseCard title="TeO Music Studio" subtitle="Rezonans harmoniczny. Synteza dźwięku."
                        onClick={() => wejdz('https://teomusic.studio')} icon={<FiMusic className="w-8 h-8" />} colorTheme="pink" isLocked={false} />
                    <UniverseCard title="TeO App Studio" subtitle="Narzędzia. Kod. Rzeczywistość."
                        onClick={() => wejdz('https://teoapp.studio')} icon={<FiPackage className="w-8 h-8" />} colorTheme="cyan" isLocked={false} />
                    <UniverseCard title="Graviton" subtitle="Wymiar 0.00G. Księga GRV."
                        onClick={() => wejdz('https://graviton.pw')} icon={<FiShield className="w-8 h-8" />} colorTheme="blue" isLocked={false} />
                </div>
            </div>

            {/* ── REJESTR MODUŁÓW ── */}
            <DashboardCard title="Rejestr Modułów — subskrypcje za GRV" icon={<AppIcon />}>
                <div className="p-3">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="text-xs text-slate-400">
                            Twoje GRV: <b className="text-amber-300">{grv === 'INFINITE' ? '∞' : (grv ?? 0).toLocaleString('pl-PL')}</b>
                            {' '}· moduły wbudowane są bez opłat, cudze kosztują tyle, ile ustawił autor
                        </span>
                        <button onClick={() => setPokazFormModulu(v => !v)} className="capsule-button capsule-violet text-xs py-1 px-3">
                            {pokazFormModulu ? 'Zamknij' : '+ Dodaj moduł'}
                        </button>
                    </div>

                    {pokazFormModulu && (
                        <div className="mb-4 p-3 rounded-xl border border-violet-500/30 bg-violet-900/10 space-y-2">
                            <p className="text-[11px] text-slate-400">
                                Każdy węzeł może wystawić swój moduł. Cenę ustawiasz sam — GRV idzie do autora,
                                nie do skarbca.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input className={pole} placeholder="Nazwa modułu" value={nowyModul.nazwa} onChange={e => setNowyModul(s => ({ ...s, nazwa: e.target.value }))} />
                                <input className={pole} placeholder="Adres (https://… albo /ścieżka)" value={nowyModul.url} onChange={e => setNowyModul(s => ({ ...s, url: e.target.value }))} />
                                <input className={pole} placeholder="Krótki opis" value={nowyModul.opis} onChange={e => setNowyModul(s => ({ ...s, opis: e.target.value }))} />
                                <div className="flex gap-2">
                                    <input className={`${pole} w-16`} value={nowyModul.ikona} onChange={e => setNowyModul(s => ({ ...s, ikona: e.target.value }))} />
                                    <input className={pole} type="number" min={0} placeholder="cena GRV" value={nowyModul.cenaGRV} onChange={e => setNowyModul(s => ({ ...s, cenaGRV: Number(e.target.value) || 0 }))} />
                                    <select className={pole} value={nowyModul.kategoria} onChange={e => setNowyModul(s => ({ ...s, kategoria: e.target.value as Modul['kategoria'] }))}>
                                        <option value="kreacja">kreacja</option><option value="wiedza">wiedza</option>
                                        <option value="zabawa">zabawa</option><option value="narzedzie">narzędzie</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={() => void wyslijModul()} disabled={zajety} className="capsule-button capsule-green text-xs py-1 px-4">Wystaw w rejestrze</button>
                        </div>
                    )}

                    <div className="pr-2 overflow-y-auto max-h-[26rem]">
                        {moduly.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-3 border-b border-slate-700/50 gap-3">
                                <div className="flex items-center flex-1 min-w-0 gap-3">
                                    <span className="text-xl shrink-0">{m.ikona}</span>
                                    <div className="min-w-0">
                                        <div className="font-semibold truncate text-slate-100">{m.nazwa}</div>
                                        <div className="text-[11px] text-slate-500 truncate">
                                            {m.opis || '—'} · {m.wbudowany ? 'część Katedry' : `od ${m.autor}`}
                                            {m.subskrybentow > 0 && ` · ${m.subskrybentow} subskrybentów`}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-bold ${m.cenaGRV ? 'text-amber-300' : 'text-emerald-400'}`}>
                                        {m.cenaGRV ? `${m.cenaGRV} GRV` : 'bez opłat'}
                                    </span>
                                    <button onClick={() => void zmienSubskrypcje(m)} disabled={zajety}
                                        className={`w-28 capsule-button text-sm py-1 ${m.subskrybowany ? 'capsule-rose' : 'capsule-green'}`}>
                                        {m.subskrybowany ? 'Wyłącz' : 'Włącz'}
                                    </button>
                                    {!m.wbudowany && (
                                        <button onClick={async () => { await usunModul(m.id); await odswiez(); }}
                                            title="Usuń z rejestru" className="text-slate-600 hover:text-red-400 px-1">✕</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {!moduly.length && <div className="p-6 text-center text-sm text-slate-600">Rejestr pusty — odpal Most.</div>}
                    </div>
                </div>
            </DashboardCard>

            {/* ── WYPRAWY ── */}
            <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-3xl font-bold text-cyan-300 drop-shadow-[0_0_4px_rgba(0,255,255,0.5)]">
                        WYPRAWY / Wspólne przedsięwzięcia
                    </h2>
                    <button onClick={() => setPokazFormWyprawy(v => !v)} className="capsule-button capsule-violet text-xs py-1 px-3">
                        {pokazFormWyprawy ? 'Zamknij' : '+ Otwórz wyprawę'}
                    </button>
                </div>

                {/* Uczciwie o licznikach — to jest sedno różnicy wobec makiety. */}
                <p className="text-xs text-slate-500 mb-4 max-w-3xl leading-relaxed">
                    Liczniki nie są wpisane, tylko <b>sumowane z realnych wpłat GRV</b> zapisanych w księdze
                    z pieczęcią łańcucha. Nie da się ich ustawić — rosną wyłącznie wtedy, gdy ktoś faktycznie przeleje.
                    Dlatego każda nowa wyprawa startuje od zera i to zero jest prawdziwe.
                </p>

                {pokazFormWyprawy && (
                    <div className="mb-4 p-3 rounded-xl border border-cyan-500/30 bg-cyan-900/10 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input className={pole} placeholder="Nazwa wyprawy" value={nowaWyprawa.nazwa} onChange={e => setNowaWyprawa(s => ({ ...s, nazwa: e.target.value }))} />
                            <div className="flex gap-2">
                                <input className={`${pole} w-16`} value={nowaWyprawa.ikona} onChange={e => setNowaWyprawa(s => ({ ...s, ikona: e.target.value }))} />
                                <input className={pole} type="number" min={1} placeholder="cel w GRV" value={nowaWyprawa.celGRV} onChange={e => setNowaWyprawa(s => ({ ...s, celGRV: Number(e.target.value) || 0 }))} />
                            </div>
                            <input className={`${pole} md:col-span-2`} placeholder="O co chodzi w tej wyprawie" value={nowaWyprawa.opis} onChange={e => setNowaWyprawa(s => ({ ...s, opis: e.target.value }))} />
                        </div>
                        <button onClick={() => void wyslijWyprawe()} disabled={zajety} className="capsule-button capsule-green text-xs py-1 px-4">Otwórz</button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {wyprawy.map(w => (
                        <div key={w.id} className="bg-slate-900/40 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-4 flex flex-col">
                            <div className="text-3xl mb-2">{w.ikona}</div>
                            <h4 className="text-lg font-bold text-white mb-1">{w.nazwa}</h4>
                            <p className="text-slate-400 text-sm mb-4 flex-grow">{w.opis || '—'}</p>
                            <div className="mb-3">
                                <div className="flex justify-between items-end mb-1 text-xs">
                                    <span className="text-slate-300 font-semibold">
                                        {w.zebraneGRV.toLocaleString('pl-PL')} / {w.celGRV.toLocaleString('pl-PL')} GRV
                                    </span>
                                    <span className="font-bold text-cyan-300">{w.postep.toFixed(2)}%</span>
                                </div>
                                <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                                    <div className="h-2.5 rounded-full bg-cyan-500 transition-all duration-500" style={{ width: `${Math.min(100, w.postep)}%` }} />
                                </div>
                                <div className="mt-1 text-[10px] text-slate-600">
                                    {w.wplat} wpłat · {w.wspierajacych} wspierających · otwarta przez {w.autor}
                                </div>
                            </div>
                            <button onClick={() => void wesprzyj(w)} disabled={zajety} className="capsule-button capsule-cyan w-full mt-auto">
                                Wesprzyj GRV
                            </button>
                        </div>
                    ))}
                    {!wyprawy.length && (
                        <div className="col-span-full rounded-2xl border border-dashed border-slate-700 p-8 text-center">
                            <p className="text-slate-400 text-sm">Żadna wyprawa nie jest otwarta.</p>
                            <p className="text-slate-600 text-xs mt-1">
                                Poprzednie były makietą z wymyślonymi licznikami — zniknęły razem z nią.
                                Otwórz własną, a licznik ruszy od prawdziwego zera.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
