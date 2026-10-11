/**
 * 🏝️ Gry Katedr — paczki gier (services/PaczkiGier.js) w Marketplace.
 *
 * Suweren 2026-10-11: „inni mogą zagrać w Teterhię i pojawić się na wyspie Suwerena, a jego komputer nie płonie —
 * gra liczy się u GRAJĄCEGO”. Tu: (1) udostępnienie własnej gry jako podpisanej paczki (zip + manifest ed25519,
 * wpis w Marketplace), (2) gry innych Katedr online z rejestru otakos.wtf → instalacja (podpis kluczem z rejestru,
 * SHA-256) → Pierścień apek. UCZCIWIE: przelewu GRV między Katedrami jeszcze nie ma (etap 4).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { otworzApke } from '../../lib/pierscien';

const BRIDGE = 'http://127.0.0.1:3001';
const MB = 1048576;

interface MojaGra { id: string; nazwa: string; zainstalowana: { nick: string; wersja: string } | null; udostepniona: { wersja: string; bajtow: number; cenaGRV: number; udostepniono: string; produkt?: string } | null }
interface Stan { nick: string | null; gry: MojaGra[]; goscie: { aktywni: number; max: number }; paczka: { kbps: number; pobrania: number } }
interface KatedraZGrami { nick: string; adres: string; gry: { id: string; nazwa: string; wersja: string; bajtow: number }[] }

const post = async (url: string, body?: unknown, method = 'POST') => {
    const d = await (await fetch(`${BRIDGE}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
    if (!d.success) throw new Error(d.message || 'most odmówił');
    return d;
};

export default function GryKatedr() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [siec, setSiec] = useState<KatedraZGrami[] | null>(null);
    const [bladSieci, setBladSieci] = useState('');
    const [ceny, setCeny] = useState<Record<string, string>>({});
    const [praca, setPraca] = useState('');
    const [info, setInfo] = useState('');

    const wczytaj = useCallback(async () => {
        try { const d = await (await fetch(`${BRIDGE}/api/gry`)).json(); if (d.success) setStan(d); else setInfo(d.message); }
        catch { setInfo('Most milczy — po aktualizacji Katedry zrestartuj most, żeby trasy /api/gry działały.'); }
    }, []);
    const wczytajSiec = useCallback(async () => {
        setBladSieci('');
        try { const d = await (await fetch(`${BRIDGE}/api/gry/siec`)).json(); if (d.success) setSiec(d.katedry); else setBladSieci(d.message); }
        catch (e) { setBladSieci((e as Error).message); }
    }, []);
    useEffect(() => { void wczytaj(); void wczytajSiec(); }, [wczytaj, wczytajSiec]);

    const udostepnij = async (g: MojaGra) => {
        setPraca(g.id); setInfo(`Pakuję „${g.nazwa}” i podpisuję kluczem wizytówki… (duża gra = chwila)`);
        try {
            const d = await post('/api/gry/udostepnij', { gra: g.id, cenaGRV: Number(ceny[g.id] ?? g.udostepniona?.cenaGRV ?? 333) });
            setInfo(`✅ „${d.manifest.nazwa}” ${d.manifest.wersja} udostępniona: ${Math.round(d.manifest.bajtow / MB)} MB, ${d.manifest.plikow} plików. Wpis w Marketplace: ${d.produkt.priceGrv} GRV (płatność ręczna — etap 4).`);
            await wczytaj();
        } catch (e) { setInfo(`⚠ ${(e as Error).message}`); }
        setPraca('');
    };
    const wycofaj = async (g: MojaGra) => {
        setPraca(g.id);
        try { await post(`/api/gry/udostepnij/${encodeURIComponent(g.id)}`, undefined, 'DELETE'); setInfo(`„${g.nazwa}” wycofana — paczka i pliki gościa już nie wychodzą.`); await wczytaj(); }
        catch (e) { setInfo(`⚠ ${(e as Error).message}`); }
        setPraca('');
    };
    const instaluj = async (nick: string, gra: { id: string; nazwa: string; bajtow: number }) => {
        setPraca(`${nick}/${gra.id}`); setInfo(`Pobieram „${gra.nazwa}” od „${nick}” (${Math.round(gra.bajtow / MB)} MB), sprawdzam podpis i SHA-256…`);
        try {
            const d = await post('/api/gry/instaluj', { nick, gra: gra.id });
            setInfo(`✅ Zainstalowana „${d.gra.nazwa}” (${d.gra.wersja}) — podpis Katedry „${nick}” i suma SHA-256 się zgadzają. Liczy się u Ciebie.`);
            otworzApke({ id: d.gra.id, tytul: `${d.gra.nazwa} · ${nick}`, url: `${BRIDGE}${d.gra.url}`, znak: '🏝️', kolor: '#22c55e' });
            await wczytaj();
        } catch (e) { setInfo(`⚠ ${(e as Error).message}`); }
        setPraca('');
    };
    const zagraj = (g: MojaGra) => otworzApke({ id: g.id, tytul: g.zainstalowana ? `${g.nazwa} · ${g.zainstalowana.nick}` : g.nazwa, url: `${BRIDGE}/apki/${g.id}/`, znak: '🏝️', kolor: '#22c55e' });

    const moje = stan?.gry.filter((g) => !g.zainstalowana) ?? [];
    const zainstalowane = stan?.gry.filter((g) => g.zainstalowana) ?? [];
    return (
        <div className="space-y-4 text-sm">
            <p className="text-[11px] text-zinc-400">Gra jako podpisana paczka: instaluje się w Katedrze grającego i tam się liczy — Twój komputer tylko wydaje pliki (z ograniczeniem łącza{stan ? ` ${Math.round(stan.paczka.kbps / 1024)} MB/s, ${stan.paczka.pobrania} pobrania naraz` : ''}). <b className="text-amber-300">Płatność: ręczne potwierdzenie między Suwerenami — przelew GRV między Katedrami to etap 4.</b></p>

            <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-300/80">🏝️ Twoje gry {stan?.nick ? <span className="normal-case text-zinc-500">· Katedra „{stan.nick}”</span> : null}</h3>
                {stan && !stan.nick && <p className="text-[11px] text-rose-300">Bez nicka wizytówki nie ma czym podpisać paczki — ustaw nick w karcie Wystawy (🪪).</p>}
                {stan && <p className="text-[10px] text-zinc-500">Goście na wyspie teraz: {stan.goscie.aktywni}/{stan.goscie.max} (OTAKOS_GOSCIE_MAX).</p>}
                {moje.length === 0 && <p className="text-[11px] text-zinc-500">Brak zbudowanych gier w _OtakOs_Apki (dist/index.html).</p>}
                {moje.map((g) => (
                    <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/70 bg-black/30 p-3">
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-amber-200">{g.nazwa} <span className="text-[9px] text-zinc-500">· {g.id}</span></div>
                            <div className="text-[10px] text-zinc-500">{g.udostepniona ? `udostępniona ${g.udostepniona.wersja} · ${Math.round(g.udostepniona.bajtow / MB)} MB · ${g.udostepniona.cenaGRV} GRV` : 'tylko w tej Katedrze'}</div>
                        </div>
                        <input value={ceny[g.id] ?? String(g.udostepniona?.cenaGRV ?? 333)} onChange={(e) => setCeny({ ...ceny, [g.id]: e.target.value.replace(/\D/g, '') })} title="Cena w GRV (płatność ręczna — etap 4)"
                            className="w-20 rounded border border-zinc-700 bg-black/50 px-2 py-1 text-xs text-amber-200" />
                        <button disabled={!!praca || !stan?.nick} onClick={() => void udostepnij(g)} className="rounded border border-emerald-500/50 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-40">
                            {praca === g.id ? '⏳' : g.udostepniona ? '↻ Nowa paczka' : '🏝️ Udostępnij grę'}
                        </button>
                        {g.udostepniona && <button disabled={!!praca} onClick={() => void wycofaj(g)} className="rounded border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-40">✕ Wycofaj</button>}
                    </div>
                ))}
            </section>

            {zainstalowane.length > 0 && (
                <section className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300/80">📥 Zainstalowane od innych Katedr</h3>
                    {zainstalowane.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-black/30 p-3">
                            <div className="min-w-0 flex-1"><div className="truncate font-bold text-emerald-200">{g.nazwa}</div><div className="text-[10px] text-zinc-500">od „{g.zainstalowana!.nick}” · {g.zainstalowana!.wersja}</div></div>
                            <button onClick={() => zagraj(g)} className="rounded border border-emerald-500/50 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-950/40">▶ Zagraj</button>
                        </div>
                    ))}
                </section>
            )}

            <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-300/80">🌍 Gry Katedr online <button onClick={() => void wczytajSiec()} className="normal-case text-zinc-500 hover:text-white">↻</button></h3>
                {bladSieci && <p className="text-[11px] text-rose-300">Rejestr otakos.wtf: {bladSieci}</p>}
                {siec && siec.length === 0 && <p className="text-[11px] text-zinc-500">Żadna Katedra online nie udostępnia teraz gry (albo rejestr jeszcze nie niesie pola paczek).</p>}
                {siec?.map((k) => k.gry.map((g) => (
                    <div key={`${k.nick}/${g.id}`} className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-black/30 p-3">
                        <div className="min-w-0 flex-1"><div className="truncate font-bold text-sky-200">{g.nazwa}</div><div className="text-[10px] text-zinc-500">Katedra „{k.nick}” · {g.wersja} · {Math.round(g.bajtow / MB)} MB</div></div>
                        <button disabled={!!praca} onClick={() => void instaluj(k.nick, g)} className="rounded border border-sky-500/50 px-3 py-1 text-xs font-bold text-sky-300 hover:bg-sky-950/40 disabled:opacity-40">
                            {praca === `${k.nick}/${g.id}` ? '⏳' : '📥 Zainstaluj'}
                        </button>
                    </div>
                )))}
            </section>
            {info && <p className="text-[11px] text-zinc-300">{info}</p>}
        </div>
    );
}
