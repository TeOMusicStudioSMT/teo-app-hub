/**
 * 🖨️ Pracownia merchu — zakładka Marketplace (most: services/Merch.js, /api/merch*).
 * Creative Lab Meshy: z bryły albo zdjęcia → koncept (6 kr.) → Twoja akceptacja → bryła (do 30 kr.) → druk.
 * Druk z bryły: darmowa analiza drukowalności, 3MF wielokolorowy za zgodą (10 kr.). Gotowe → Wystawa i Marketplace.
 * Każdy płatny krok: wycena z saldem → okno potwierdzenia kwoty. Nic nie wychodzi bez kliknięcia.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
interface Produkt { slug: string; nazwa: string; sprawdzone: boolean; ksztalt?: boolean; grawer?: boolean }
interface Raport { werdykt: string; bledy: number; ostrzezenia: number; szczelna: boolean | null; dziury: number | null; krawedzieNieRozmaitosci: number | null; cienkieScianki: { sa: boolean; udzial: number | null } | null; wymiaryMm: number[] | null }
interface Merch { id: string; rodzaj: 'lab' | 'druk'; produkt: string; nazwa: string; stan: string; blad?: string; kredyty: number; pliki: Record<string, string>; druk?: { stan: string; raport?: Raport | null }; market?: string; liczy?: boolean; postep?: { etap: string; procent: number } }
interface Bryla { id: string; nazwa: string; opis: string; stan: string; tekstury?: boolean }
interface Stan { merch: Merch[]; produkty: Record<string, Produkt>; cennik: Record<string, number | string>; ksztalty: string[]; drukarki: string[]; maKlucz: boolean }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}
const plikUrl = (m: Merch, k: string) => (m.pliki[k] ? `${MOST}/api/merch/${m.id}/plik/${m.pliki[k]}` : null);
const KSZTALT: Record<string, string> = { circle: '⚪ koło', 'rounded-rect': '▢ prostokąt', hexagon: '⬡ heksagon', shield: '🛡 tarcza', star: '⭐ gwiazda' };

export default function PracowniaMerchu() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [bryly, setBryly] = useState<Bryla[]>([]);
    const [blad, setBlad] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [trwa, setTrwa] = useState(false);
    // nowy gadżet (Creative Lab)
    const [produkt, setProdukt] = useState('figurka');
    const [zrodlo, setZrodlo] = useState<'bryla' | 'zdjecie'>('bryla');
    const [bryla, setBryla] = useState('');
    const [zdjecie, setZdjecie] = useState<string | null>(null);
    const [nazwa, setNazwa] = useState('');
    const [grawer, setGrawer] = useState('');
    const [ksztalt, setKsztalt] = useState('circle');
    const [mm, setMm] = useState(40);
    // druk
    const [druk, setDruk] = useState({ drukarkaTyp: 'fdm', mm: 80, kolory: 4, styl: 'cartoon', marka: 'bambu' });
    const plikRef = useRef<HTMLInputElement>(null);

    const wczytaj = useCallback(async () => {
        try { setStan(await zMostu<Stan>('/api/merch')); setBlad(null); } catch (e) { setBlad((e as Error).message); }
    }, []);
    useEffect(() => {
        void wczytaj();
        zMostu<{ assety: Bryla[] }>('/api/assety3d').then((d) => setBryly(d.assety.filter((a) => a.stan === 'gotowe'))).catch(() => {});
    }, [wczytaj]);
    // odświeżanie, póki coś się liczy w chmurze
    useEffect(() => {
        if (!stan?.merch.some((m) => m.liczy)) return;
        const t = setInterval(() => void wczytaj(), 5000);
        return () => clearInterval(t);
    }, [stan, wczytaj]);

    /** Wycena + okno zgody → kredyty do potwierdzenia albo null. */
    const zgoda = async (krok: string, co: string): Promise<number | null> => {
        const w = await zMostu<{ kredyty: number; usdOkolo: number; saldo: number | null }>('/api/merch/wycena', { method: 'POST', body: JSON.stringify({ krok }) });
        if (!w.kredyty) return 0;
        if (w.saldo !== null && w.saldo < w.kredyty) { setBlad(`Za mało kredytów Meshy: ${co} kosztuje ${w.kredyty}, saldo ${w.saldo}.`); return null; }
        return window.confirm(`🖨️ ${co}\n\nKoszt: do ${w.kredyty} kredytów Meshy (≈ $${w.usdOkolo}) — saldo ${w.saldo}.\nObraz / bryła wyjdzie z Katedry do chmury Meshy.`) ? w.kredyty : null;
    };
    const akcja = async (f: () => Promise<unknown>, ok: string) => {
        setTrwa(true); setBlad(null); setInfo(null);
        try { await f(); setInfo(ok); await wczytaj(); } catch (e) { setBlad((e as Error).message); } finally { setTrwa(false); }
    };

    const nowyPrototyp = () => akcja(async () => {
        const k = await zgoda('prototyp', `Koncept: ${stan?.produkty[produkt]?.nazwa}`);
        if (k === null) throw new Error('Anulowano.');
        await zMostu('/api/merch/prototyp', { method: 'POST', body: JSON.stringify({ zlecenie: { produkt, nazwa, grawer, ksztalt, mm }, ...(zrodlo === 'bryla' ? { bryla } : { dataURL: zdjecie }), zgodaKredyty: k }) });
    }, '🎨 Koncept w drodze — pojawi się poniżej do akceptacji.');
    const buduj = (m: Merch) => akcja(async () => {
        const k = await zgoda('budowa', `Budowa bryły „${m.nazwa}” z konceptu`);
        if (k === null) throw new Error('Anulowano.');
        await zMostu(`/api/merch/${m.id}/buduj`, { method: 'POST', body: JSON.stringify({ zgodaKredyty: k }) });
    }, '🧱 Budowa ruszyła.');
    const drukuj = (cel: { id?: string; bryla?: string }, z3mf: boolean) => akcja(async () => {
        const k = z3mf ? await zgoda('druk3mf', `Plik 3MF wielokolorowy (${druk.kolory} kolorów, ${druk.marka})`) : 0;
        if (k === null) throw new Error('Anulowano.');
        await zMostu('/api/merch/druk', { method: 'POST', body: JSON.stringify({ ...cel, ustawienia: { ...druk, nazwa: cel.bryla }, z3mf, zgodaKredyty: k }) });
    }, z3mf ? '🖨️ Analiza druku + 3MF w drodze.' : '🔍 Darmowa analiza drukowalności w drodze.');
    const naMarket = (m: Merch) => akcja(async () => {
        const cena = window.prompt(`Cena „${m.nazwa}” w GRV (0 = za darmo):`, '100');
        if (cena === null) throw new Error('Anulowano.');
        await zMostu(`/api/merch/${m.id}/market`, { method: 'POST', body: JSON.stringify({ cenaGRV: Number(cena) || 0 }) });
    }, '🛒 Wystawione na Marketplace (moduł „merch”).');
    const wczytajZdjecie = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => setZdjecie(String(r.result)); r.readAsDataURL(f); };

    if (!stan) return <p className="text-sm text-zinc-500">{blad ? `⚠ ${blad}` : 'Wczytuję pracownię…'}</p>;
    const p = stan.produkty[produkt];
    const wybor = 'rounded border border-amber-500/20 bg-black/40 px-2 py-1 text-xs text-amber-100 outline-none';

    return (
        <div className="space-y-4">
            {!stan.maKlucz && <p className="text-[11px] text-amber-300/90">Brak klucza Meshy w moście — Hub → TeO Kibel → klucz msy_… → „🔗 Udostępnij mostowi”.</p>}

            <section className="space-y-2 rounded-lg border border-amber-500/20 bg-black/30 p-3">
                <h4 className="text-sm font-bold text-amber-200">🎨 Nowy gadżet (Creative Lab Meshy)</h4>
                <p className="text-[10px] text-zinc-500">Z obrazu bryły albo zdjęcia → koncept do akceptacji ({String(stan.cennik.prototyp)} kr.) → bryła do druku (do {String(stan.cennik.budowa)} kr.).</p>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(stan.produkty).map(([id, x]) => <button key={id} onClick={() => setProdukt(id)} title={x.sprawdzone ? '' : 'Ten produkt nie ma jeszcze sprawdzonej dokumentacji API — Meshy może odmówić (powiemy wprost)'} className={`rounded border px-2 py-1 text-xs ${produkt === id ? 'border-amber-400 text-amber-200' : 'border-zinc-700 text-zinc-400'}`}>{x.nazwa}{x.sprawdzone ? '' : ' ⚠'}</button>)}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select value={zrodlo} onChange={(e) => setZrodlo(e.target.value as 'bryla' | 'zdjecie')} className={wybor}><option value="bryla">z bryły Assetów 3D</option><option value="zdjecie">z mojego zdjęcia</option></select>
                    {zrodlo === 'bryla'
                        ? <select value={bryla} onChange={(e) => setBryla(e.target.value)} className={`${wybor} min-w-0 flex-1`}><option value="">— wybierz bryłę —</option>{bryly.map((b) => <option key={b.id} value={b.id}>{b.nazwa}{b.tekstury ? ' ☁️' : ''} · {b.id.slice(-4)}</option>)}</select>
                        : <><button onClick={() => plikRef.current?.click()} className="rounded border border-zinc-600 px-2 py-1 text-zinc-300">📷 wybierz zdjęcie</button><input ref={plikRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => wczytajZdjecie(e.target.files?.[0])} />{zdjecie && <img src={zdjecie} alt="" className="h-10 w-10 rounded object-cover" />}</>}
                </div>
                {zrodlo === 'bryla' && bryla && <img src={`${MOST}/api/assety3d/${encodeURIComponent(bryla)}/plik/obraz.png`} alt="" className="h-24 rounded border border-zinc-800 object-contain" />}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input value={nazwa} onChange={(e) => setNazwa(e.target.value)} maxLength={100} placeholder={`nazwa (domyślnie: ${p?.nazwa})`} className={`${wybor} min-w-0 flex-1`} />
                    {p?.grawer && <input value={grawer} onChange={(e) => setGrawer(e.target.value)} maxLength={10} placeholder="grawer (≤ 10 znaków)" className={`${wybor} w-36`} />}
                    {p?.ksztalt && <select value={ksztalt} onChange={(e) => setKsztalt(e.target.value)} className={wybor}>{stan.ksztalty.map((k) => <option key={k} value={k}>{KSZTALT[k] ?? k}</option>)}</select>}
                    {p?.ksztalt && <label className="flex items-center gap-1 text-zinc-400"><input type="number" min={15} max={150} value={mm} onChange={(e) => setMm(Number(e.target.value))} className={`${wybor} w-16`} /> mm</label>}
                </div>
                <button onClick={() => void nowyPrototyp()} disabled={trwa || !stan.maKlucz || (zrodlo === 'bryla' ? !bryla : !zdjecie)} className="rounded border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-900/50 disabled:opacity-40">🎨 Koncept ({String(stan.cennik.prototyp)} kr.)</button>
            </section>

            <section className="space-y-2 rounded-lg border border-zinc-700/60 bg-black/30 p-3">
                <h4 className="text-sm font-bold text-zinc-200">🖨️ Ustawienia druku</h4>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select value={druk.drukarkaTyp} onChange={(e) => setDruk({ ...druk, drukarkaTyp: e.target.value })} className={wybor}><option value="fdm">FDM (filament)</option><option value="sla">SLA (żywica)</option><option value="full_color">pełny kolor</option></select>
                    <label className="flex items-center gap-1 text-zinc-400">najdłuższy bok <input type="number" min={10} max={1000} value={druk.mm} onChange={(e) => setDruk({ ...druk, mm: Number(e.target.value) })} className={`${wybor} w-16`} /> mm</label>
                    <label className="flex items-center gap-1 text-zinc-400">kolorów <input type="number" min={1} max={16} value={druk.kolory} onChange={(e) => setDruk({ ...druk, kolory: Number(e.target.value) })} className={`${wybor} w-14`} /></label>
                    <select value={druk.styl} onChange={(e) => setDruk({ ...druk, styl: e.target.value })} className={wybor} title="cartoon: płaskie kolory, mniejszy plik, przyjmuje bryły TRELLIS; realistic: z tekstury"><option value="cartoon">cartoon</option><option value="realistic">realistic (tekstura)</option></select>
                    <select value={druk.marka} onChange={(e) => setDruk({ ...druk, marka: e.target.value })} className={wybor}>{stan.drukarki.map((d) => <option key={d} value={d}>{d}</option>)}</select>
                </div>
                {zrodlo === 'bryla' && bryla && <div className="flex gap-2"><button onClick={() => void drukuj({ bryla }, false)} disabled={trwa || !stan.maKlucz} className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40">🔍 Analiza druku bryły (za darmo)</button><button onClick={() => void drukuj({ bryla }, true)} disabled={trwa || !stan.maKlucz} className="rounded border border-sky-500/50 px-2 py-1 text-xs text-sky-300 disabled:opacity-40">🖨️ Analiza + 3MF ({String(stan.cennik.druk3mf)} kr.)</button></div>}
            </section>

            {blad && <p className="text-[11px] text-amber-300">⚠ {blad}</p>}
            {info && <p className="text-[11px] text-emerald-300">{info}</p>}

            <section className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider text-zinc-500">Twój merch ({stan.merch.length})</h4>
                {stan.merch.length === 0 && <p className="text-[11px] text-zinc-500">Pusto. Zacznij od konceptu albo analizy druku bryły.</p>}
                {stan.merch.map((m) => {
                    const obraz = plikUrl(m, 'miniatura') ?? plikUrl(m, 'koncept');
                    return (
                        <div key={m.id} className="flex gap-3 rounded-lg border border-zinc-800/70 bg-black/30 p-3">
                            {obraz ? <img src={obraz} alt="" className="h-20 w-20 shrink-0 rounded object-contain" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-zinc-900 text-2xl">🖨️</div>}
                            <div className="min-w-0 flex-1 space-y-1 text-xs">
                                <div className="font-bold text-amber-200">{m.nazwa} <span className="font-normal text-[10px] text-zinc-500">· {stan.produkty[m.produkt]?.nazwa ?? 'druk z bryły'} · {m.stan}{m.liczy && m.postep ? ` (${m.postep.etap} ${m.postep.procent}%)` : ''} · {m.kredyty} kr.</span></div>
                                {m.stan === 'blad' && <div className="text-[11px] text-amber-300">⚠ {m.blad}</div>}
                                {m.druk?.raport && <div className="text-[11px] text-zinc-300">{m.druk.raport.werdykt} <span className="text-[10px] text-zinc-500">· szczelna: {m.druk.raport.szczelna === null ? '?' : m.druk.raport.szczelna ? 'tak' : 'NIE'} · dziury: {m.druk.raport.dziury ?? '?'} · krawędzie nierozmaitościowe: {m.druk.raport.krawedzieNieRozmaitosci ?? '?'}{m.druk.raport.cienkieScianki?.sa ? ` · cienkie ścianki ${Math.round((m.druk.raport.cienkieScianki.udzial ?? 0) * 100)}%` : ''}{m.druk.raport.wymiaryMm ? ` · ${m.druk.raport.wymiaryMm.map((x) => Math.round(x)).join('×')} mm` : ''}</span></div>}
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {m.stan === 'koncept' && <button onClick={() => void buduj(m)} disabled={trwa} className="rounded border border-amber-500/50 px-2 py-0.5 text-[11px] text-amber-300 disabled:opacity-40">✓ Akceptuję koncept → bryła</button>}
                                    {m.stan === 'gotowy' && m.rodzaj === 'lab' && !m.liczy && <><button onClick={() => void drukuj({ id: m.id }, false)} disabled={trwa} className="rounded border border-zinc-600 px-2 py-0.5 text-[11px] text-zinc-300 disabled:opacity-40">🔍 analiza druku</button><button onClick={() => void drukuj({ id: m.id }, true)} disabled={trwa} className="rounded border border-sky-500/50 px-2 py-0.5 text-[11px] text-sky-300 disabled:opacity-40">🖨️ 3MF ({String(stan.cennik.druk3mf)} kr.)</button></>}
                                    {plikUrl(m, 'model') && <a href={plikUrl(m, 'model')!} download className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">⬇ GLB</a>}
                                    {plikUrl(m, 'druk') && <a href={plikUrl(m, 'druk')!} download className="rounded border border-emerald-600/50 px-2 py-0.5 text-[11px] text-emerald-300">⬇ 3MF do drukarki</a>}
                                    {m.stan === 'gotowy' && !m.market && <button onClick={() => void naMarket(m)} disabled={trwa} className="rounded border border-amber-500/50 bg-amber-950/40 px-2 py-0.5 text-[11px] font-bold text-amber-300 disabled:opacity-40">🛒 Na Marketplace</button>}
                                    {m.market && <span className="text-[10px] text-emerald-400">✓ na Marketplace</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>
            <p className="text-[10px] text-zinc-600">Gotowy merch pokazuje się też w Wystawie (wizytówka w sieci). Druk fizyczny robisz na swojej drukarce z pliku 3MF/GLB — Meshy nie wysyła paczek.</p>
        </div>
    );
}
