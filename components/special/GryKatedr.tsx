/**
 * 🏝️ Gry Katedr — paczki gier (services/PaczkiGier.js) w Marketplace.
 *
 * Suweren 2026-10-11: „inni mogą zagrać w Teterhię i pojawić się na wyspie Suwerena, a jego komputer nie płonie —
 * gra liczy się u GRAJĄCEGO”. Tu: (1) udostępnienie własnej gry jako podpisanej paczki (zip + manifest ed25519,
 * wpis w Marketplace), (2) gry innych Katedr online z rejestru otakos.wtf → instalacja (podpis kluczem z rejestru,
 * SHA-256) → Pierścień apek. 💳 Płatna gra: przelew GRV między Katedrami (services/RozliczeniaKatedr.js) — Suweren
 * potwierdza cenę z manifestu sprzedającego, jego księga odkłada GRV, sprzedający kwituje podpisem, potem paczka.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { otworzApke } from '../../lib/pierscien';

const BRIDGE = 'http://127.0.0.1:3001';
const MB = 1048576;

interface MojaGra { id: string; nazwa: string; zainstalowana: { nick: string; gra: string; wersja: string } | null; udostepniona: { wersja: string; bajtow: number; lekka?: number; cenaGRV: number; udostepniono: string; produkt?: string } | null }
interface Stan { nick: string | null; gry: MojaGra[]; goscie: { aktywni: number; max: number }; paczka: { kbps: number; pobrania: number } }
interface KatedraZGrami { nick: string; adres: string; gry: { id: string; nazwa: string; wersja: string; bajtow: number }[] }
interface Oferta { gra: string; nazwa: string; wersja: string; bajtow: number; autor: string; cenaGRV: number | null; zaplacone: boolean; rozmiary?: { pelna: number; lekka: number } | null }
interface Rozliczenie { id: string; od: string; do: string; kwota: number; gra: string; stan?: string; blad?: string | null; kiedy: string; pokwitowanie?: { czas: string } }

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
    const [oferta, setOferta] = useState<Oferta | null>(null);
    const [rozl, setRozl] = useState<{ zakupy: Rozliczenie[]; sprzedaz: Rozliczenie[] }>({ zakupy: [], sprzedaz: [] });

    const wczytaj = useCallback(async () => {
        try { const d = await (await fetch(`${BRIDGE}/api/gry`)).json(); if (d.success) setStan(d); else setInfo(d.message); }
        catch { setInfo('Most milczy — po aktualizacji Katedry zrestartuj most, żeby trasy /api/gry działały.'); }
    }, []);
    const wczytajSiec = useCallback(async () => {
        setBladSieci('');
        try { const d = await (await fetch(`${BRIDGE}/api/gry/siec`)).json(); if (d.success) setSiec(d.katedry); else setBladSieci(d.message); }
        catch (e) { setBladSieci((e as Error).message); }
    }, []);
    const wczytajRozliczenia = useCallback(async () => {
        try { const d = await (await fetch(`${BRIDGE}/api/gry/rozliczenia`)).json(); if (d.success) setRozl({ zakupy: d.zakupy, sprzedaz: d.sprzedaz }); } catch { /* most stary albo milczy */ }
    }, []);
    useEffect(() => { void wczytaj(); void wczytajSiec(); void wczytajRozliczenia(); }, [wczytaj, wczytajSiec, wczytajRozliczenia]);

    const udostepnij = async (g: MojaGra) => {
        setPraca(g.id); setInfo(`Pakuję „${g.nazwa}” i podpisuję kluczem wizytówki… (duża gra = chwila)`);
        try {
            const d = await post('/api/gry/udostepnij', { gra: g.id, cenaGRV: Number(ceny[g.id] ?? g.udostepniona?.cenaGRV ?? 333) });
            setInfo(`✅ „${d.manifest.nazwa}” ${d.manifest.wersja} udostępniona: ${Math.round(d.manifest.bajtow / MB)} MB, ${d.manifest.plikow} plików. Wpis w Marketplace: ${d.produkt.priceGrv} GRV — płatność przelewem GRV z pokwitowaniami.`);
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
    /** Krok 1: oferta z manifestu sprzedającego (cena, rozmiar, czy już zapłacone) — Suweren potwierdza. */
    const pokazOferte = async (nick: string, gra: { id: string }) => {
        setPraca(`${nick}/${gra.id}`); setInfo('');
        try {
            const d = await (await fetch(`${BRIDGE}/api/gry/oferta?nick=${encodeURIComponent(nick)}&gra=${encodeURIComponent(gra.id)}`)).json();
            if (!d.success) throw new Error(d.message);
            setOferta(d.oferta);
        } catch (e) { setInfo(`⚠ ${(e as Error).message}`); }
        setPraca('');
    };
    /** Krok 2: zapłać (gdy płatna i jeszcze nie) i zainstaluj → Pierścień. */
    const kup = async (o: Oferta) => {
        setPraca(`${o.autor}/${o.gra}`);
        setInfo(o.cenaGRV && !o.zaplacone ? `💳 Płacę ${o.cenaGRV} GRV Katedrze „${o.autor}”, czekam na pokwitowanie…` : `Pobieram „${o.nazwa}” (${Math.round(o.bajtow / MB)} MB), sprawdzam podpis i SHA-256…`);
        try {
            const r = await fetch(`${BRIDGE}/api/gry/kup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: o.autor, gra: o.gra, kwota: o.cenaGRV }) });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || `most HTTP ${r.status}`);
            setOferta(null);
            const jak = d.gra.tryb === 'pliki'
                ? `Zaktualizowana do ${d.gra.wersja} po podpisanej liście plików: ${d.gra.zmienione} zmienionych (${(d.gra.pobrano / MB).toFixed(1)} MB z ${Math.round(d.gra.bajtow / MB)} MB paczki), usunięte ${d.gra.usuniete}.`
                : `Zainstalowana „${d.gra.nazwa}” (${d.gra.wersja}) — cała paczka${d.gra.powod && d.gra.powod !== 'pierwsza instalacja' ? ` (${d.gra.powod})` : ''}, podpis i SHA-256 się zgadzają.`;
            setInfo(`✅ ${d.zakup ? `Zapłacone ${d.zakup.kwota} GRV (pokwitowanie Katedry „${o.autor}”). ` : ''}${jak} Liczy się u Ciebie.`);
            otworzApke({ id: d.gra.id, tytul: `${d.gra.nazwa} · ${o.autor}`, url: `${BRIDGE}${d.gra.url}`, znak: '🏝️', kolor: '#22c55e' });
            await wczytaj();
        } catch (e) { setInfo(`⚠ ${(e as Error).message}`); }
        await wczytajRozliczenia();
        setPraca('');
    };
    const ponow = async (id: string) => {
        setPraca(id);
        try { const d = await post(`/api/gry/rozliczenia/${id}/ponow`); setInfo(d.zakup.stan === 'potwierdzona' ? '✅ Rozliczenie zamknięte pokwitowaniem — teraz „Kup i zainstaluj” pobierze paczkę.' : `⚠ ${d.zakup.blad ?? d.zakup.stan}`); }
        catch (e) { setInfo(`⚠ ${(e as Error).message}`); }
        await wczytajRozliczenia(); setPraca('');
    };
    const zagraj = (g: MojaGra) => otworzApke({ id: g.id, tytul: g.zainstalowana ? `${g.nazwa} · ${g.zainstalowana.nick}` : g.nazwa, url: `${BRIDGE}/apki/${g.id}/`, znak: '🏝️', kolor: '#22c55e' });

    const moje = stan?.gry.filter((g) => !g.zainstalowana) ?? [];
    const zainstalowane = stan?.gry.filter((g) => g.zainstalowana) ?? [];
    return (
        <div className="space-y-4 text-sm">
            <p className="text-[11px] text-zinc-400">Gra jako podpisana paczka: instaluje się w Katedrze grającego i tam się liczy — Twój komputer tylko wydaje pliki (z ograniczeniem łącza{stan ? ` ${Math.round(stan.paczka.kbps / 1024)} MB/s, ${stan.paczka.pobrania} pobrania naraz` : ''}). <b className="text-amber-300">Płatność: przelew GRV między Katedrami — każda księga robi swoją połowę, spinają je podpisane zlecenie i pokwitowanie.</b></p>

            <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-300/80">🏝️ Twoje gry {stan?.nick ? <span className="normal-case text-zinc-500">· Katedra „{stan.nick}”</span> : null}</h3>
                {stan && !stan.nick && <p className="text-[11px] text-rose-300">Bez nicka wizytówki nie ma czym podpisać paczki — ustaw nick w karcie Wystawy (🪪).</p>}
                {stan && <p className="text-[10px] text-zinc-500">Goście na wyspie teraz: {stan.goscie.aktywni}/{stan.goscie.max} (OTAKOS_GOSCIE_MAX).</p>}
                {moje.length === 0 && <p className="text-[11px] text-zinc-500">Brak zbudowanych gier w _OtakOs_Apki (dist/index.html).</p>}
                {moje.map((g) => (
                    <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/70 bg-black/30 p-3">
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-amber-200">{g.nazwa} <span className="text-[9px] text-zinc-500">· {g.id}</span></div>
                            <div className="text-[10px] text-zinc-500">{g.udostepniona ? `udostępniona ${g.udostepniona.wersja} · paczka ${Math.round(g.udostepniona.bajtow / MB)} MB${g.udostepniona.lekka ? ` · 📱 telefon: cała gra z lekkimi bryłami ${Math.round(g.udostepniona.lekka / MB)} MB` : ''} · ${g.udostepniona.cenaGRV} GRV` : 'tylko w tej Katedrze'}</div>
                        </div>
                        <input value={ceny[g.id] ?? String(g.udostepniona?.cenaGRV ?? 333)} onChange={(e) => setCeny({ ...ceny, [g.id]: e.target.value.replace(/\D/g, '') })} title="Cena w GRV — płatność przelewem między Katedrami z pokwitowaniami"
                            className="w-20 rounded-sm border border-zinc-700 bg-black/50 px-2 py-1 text-xs text-amber-200" />
                        <button disabled={!!praca || !stan?.nick} onClick={() => void udostepnij(g)} className="rounded-sm border border-emerald-500/50 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-40">
                            {praca === g.id ? '⏳' : g.udostepniona ? '↻ Nowa paczka' : '🏝️ Udostępnij grę'}
                        </button>
                        {g.udostepniona && <button disabled={!!praca} onClick={() => void wycofaj(g)} className="rounded-sm border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-40">✕ Wycofaj</button>}
                    </div>
                ))}
            </section>

            {zainstalowane.length > 0 && (
                <section className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300/80">📥 Zainstalowane od innych Katedr</h3>
                    {zainstalowane.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-black/30 p-3">
                            <div className="min-w-0 flex-1"><div className="truncate font-bold text-emerald-200">{g.nazwa}</div><div className="text-[10px] text-zinc-500">od „{g.zainstalowana!.nick}” · {g.zainstalowana!.wersja}</div></div>
                            <button disabled={!!praca} onClick={() => void pokazOferte(g.zainstalowana!.nick, { id: g.zainstalowana!.gra })} title="Sprawdź nową wersję — pobiera tylko zmienione pliki (podpisana lista)" className="rounded-sm border border-sky-500/50 px-3 py-1 text-xs text-sky-300 hover:bg-sky-950/40 disabled:opacity-40">↻ Aktualizuj</button>
                            <button onClick={() => zagraj(g)} className="rounded-sm border border-emerald-500/50 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-950/40">▶ Zagraj</button>
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
                        <button disabled={!!praca} onClick={() => void pokazOferte(k.nick, g)} className="rounded-sm border border-sky-500/50 px-3 py-1 text-xs font-bold text-sky-300 hover:bg-sky-950/40 disabled:opacity-40">
                            {praca === `${k.nick}/${g.id}` ? '⏳' : '💳 Kup i zainstaluj'}
                        </button>
                    </div>
                )))}
            </section>
            {oferta && (
                <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-950/30 p-3 text-xs">
                    <div className="font-bold text-amber-200">{oferta.nazwa} <span className="font-normal text-zinc-400">· Katedra „{oferta.autor}” · {oferta.wersja} · paczka {Math.round(oferta.bajtow / MB)} MB</span></div>
                    {oferta.cenaGRV == null ? <p className="text-rose-300">Ta Katedra ma starszy most — manifest nie podaje ceny, nie da się zapłacić.</p>
                        : oferta.cenaGRV === 0 ? <p className="text-emerald-300">Gra darmowa.</p>
                        : oferta.zaplacone ? <p className="text-emerald-300">Już zapłacone (pokwitowanie w rozliczeniach) — instalacja bez płacenia.</p>
                        : <p className="text-zinc-300">Cena: <b className="text-amber-300">{oferta.cenaGRV} GRV</b>. Twoja księga odłoży kwotę, Katedra „{oferta.autor}” dopisze ją u siebie i odeśle pokwitowanie podpisane swoim kluczem — dopiero wtedy paczka. Odrzucone = zwrot; zerwane łącze = GRV czekają, „↻ Ponów” w rozliczeniach.</p>}
                    <div className="flex gap-2">
                        {oferta.cenaGRV != null && <button disabled={!!praca} onClick={() => void kup(oferta)} className="rounded-sm border border-emerald-500/60 bg-emerald-900/40 px-3 py-1 font-bold text-emerald-200 disabled:opacity-40">
                            {praca ? '⏳' : oferta.cenaGRV > 0 && !oferta.zaplacone ? `💳 Zapłać ${oferta.cenaGRV} GRV i zainstaluj` : '📥 Zainstaluj'}
                        </button>}
                        <button disabled={!!praca} onClick={() => setOferta(null)} className="rounded-sm border border-zinc-600 px-3 py-1 text-zinc-300">Anuluj</button>
                    </div>
                </div>
            )}
            {(rozl.zakupy.length > 0 || rozl.sprzedaz.length > 0) && (
                <section className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-amber-300/80">💳 Rozliczenia z Katedrami</h3>
                    {rozl.zakupy.map((z) => (
                        <div key={z.id} className="flex items-center gap-2 text-[11px] text-zinc-300">
                            <span className="flex-1">↗ {z.kwota} GRV → „{z.do}” za {z.gra} · <b className={z.stan === 'potwierdzona' ? 'text-emerald-300' : z.stan === 'zwrot' ? 'text-zinc-400' : 'text-amber-300'}>{z.stan === 'potwierdzona' ? 'pokwitowane' : z.stan === 'zwrot' ? 'zwrot' : 'czeka'}</b>{z.blad ? <span className="text-zinc-500"> — {z.blad}</span> : null}</span>
                            {z.stan === 'wyslana' && <button disabled={!!praca} onClick={() => void ponow(z.id)} className="rounded-sm border border-amber-500/50 px-2 text-amber-200">↻ Ponów</button>}
                        </div>
                    ))}
                    {rozl.sprzedaz.map((z) => <div key={z.id} className="text-[11px] text-zinc-300">↙ {z.kwota} GRV od „{z.od}” za {z.gra} · <b className="text-emerald-300">dopisane, pokwitowanie wysłane</b> <span className="text-zinc-500">{new Date(z.kiedy).toLocaleString('pl-PL')}</span></div>)}
                </section>
            )}
            {info && <p className="text-[11px] text-zinc-300">{info}</p>}
        </div>
    );
}
