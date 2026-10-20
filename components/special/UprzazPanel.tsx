/**
 * 🧬 Harness² po katedralnemu — okno w Inkubatorze (most: services/Uprzaz.js, trasy /api/uprzaz*).
 * Propose–Probe–Compose na prawdziwym zadaniu i tym samym materiale: ulepszacz proponuje zmiany uprzęży, każda wersja
 * robi to samo zadanie, sędziowie (twarde sprawdziany + Jev albo model lokalny z adnotacją) porównują, zwycięzcy się
 * składają. Nowa uprząż czeka tu na ✓ Suwerena — dopiero wtedy wchodzi do scenariuszy. Zeszyt lekcji z dowodami.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
interface Zmiana { rodzaj: string; ref: string | number | null; tresc: string; dlaczego: string }
interface Zadanie { id: string; nazwa: string; opis: string; aktywna: string | null }
interface Uprzaz { id: string; zadanie: string; stan: 'proponowana' | 'aktywna' | 'odrzucona' | 'wycofana'; zmiany: Zmiana[]; blok: string; przebieg: string; wynik: { start: number; koniec: number }; sedzia: string | null; utworzono: string }
interface PrzebiegSkrot { id: string; zadanie: string; material: string; stan: 'robi' | 'gotowy' | 'blad'; powod: string | null; k: number; glebokosc: number; rund: number; propozycja: string | null; utworzono: string; ostatniKrok: string | null }
interface Wersja { lit: string; nazwa: string; zmiany: Zmiana[]; nowe?: Zmiana[]; tekst: string; twarde: { ok: boolean; punkty: number; bledy: string[] }; ocena?: { puenta: number | null; puenty: number[]; wybor: number }; wynik?: number | null; ms: number; bladModelu?: string }
interface Runda { nr: number; wersje: Wersja[]; sedzia: { kto?: string; uwaga?: string | null; jevBlad?: string; dlaczego?: string } | null; zwyciezcy: string[]; zlozona: { wersja: Wersja; wyniki: number[]; przeciw: string } | null; wybrana: { lit: string; wynik: number } | null }
interface Przebieg extends Omit<PrzebiegSkrot, 'rund'> { rundy: Runda[]; kroki: { czas: string; t: string }[]; model: string | null; ulepszacz: string | null }
interface Lekcja { czas: string; zadanie: string; zmiana: Zmiana; efekt: 'pomogla' | 'zaszkodzila' | 'bez-zmian'; delta: number; dowod: { przebieg: string; runda: number; wersja: string; sedzia: string | null } }
interface Stan { zadania: Zadanie[]; uprzeze: Uprzaz[]; przebiegi: PrzebiegSkrot[]; lekcje: Lekcja[]; jev: boolean; margines: number; maxK: number; maxGlebokosc: number }
interface Material { id: string; opis: string; tytuly: string[] }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || (r.status === 404 ? 'Most nie zna Uprzęży — zrestartuj most Katedry.' : `HTTP ${r.status}`));
    return d as T;
}
const EFEKT = { pomogla: '✓ pomogła', zaszkodzila: '✗ zaszkodziła', 'bez-zmian': '· bez różnicy' } as const;
const STAN_U = { proponowana: '📝 czeka na ✓', aktywna: '✅ aktywna', odrzucona: '✖ odrzucona', wycofana: '↩ wycofana' } as const;
const wynik = (x?: number | null) => (x == null ? '—' : x < 0 ? '✖' : x.toFixed(2));

function WersjaWiersz({ w, zwyciezca }: { w: Wersja; zwyciezca: boolean }) {
    const [tekst, setTekst] = useState(false);
    return (
        <div className={`rounded border p-1.5 ${zwyciezca ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-black/20'}`}>
            <div className="flex flex-wrap items-center gap-2">
                <b className="text-emerald-200">{w.lit}</b><span className="text-slate-300">{w.nazwa}</span>
                <span className="text-slate-400">wynik {wynik(w.wynik)}</span>
                {w.bladModelu && <span className="text-red-300">model padł — bez oceny i bez lekcji</span>}
                {w.ocena?.puenta != null && <span className="text-slate-500">puenta {w.ocena.puenta.toFixed(2)} · wybór {w.ocena.wybor.toFixed(2)}</span>}
                <span className="text-slate-500">twarde {w.twarde.ok ? `✓ ${w.twarde.punkty.toFixed(2)}` : '✖'}</span>
                <span className="text-slate-600">{Math.round(w.ms / 1000)} s</span>
                <button className="text-[10px] text-cyan-300" onClick={() => setTekst(!tekst)}>{tekst ? 'zwiń' : 'tekst'}</button>
            </div>
            {(w.nowe ?? []).map((z, i) => <div key={i} className="text-[10px] text-purple-200">＋ [{z.rodzaj}] {z.tresc} <span className="text-slate-500">— {z.dlaczego}</span></div>)}
            {w.twarde.bledy.length > 0 && <div className="text-[10px] text-amber-300/80">{w.twarde.bledy.slice(0, 4).join(' · ')}</div>}
            {tekst && <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-[10px] text-slate-300">{w.tekst}</pre>}
        </div>
    );
}

export default function UprzazPanel() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [zad, setZad] = useState('');
    const [materialy, setMaterialy] = useState<Material[]>([]);
    const [f, setF] = useState({ material: '', k: 2, glebokosc: 1 });
    const [podglad, setPodglad] = useState<Przebieg | null>(null);
    const [komunikat, setKomunikat] = useState<string | null>(null);
    const [otwarte, setOtwarte] = useState(false);

    const wczytaj = useCallback(() => zMostu<Stan>('/api/uprzaz').then((s) => { setStan(s); setBlad(null); setZad((z) => z || s.zadania[0]?.id || ''); return s; }).catch((e) => { setBlad(e.message); return null; }), []);
    useEffect(() => { void wczytaj(); }, [wczytaj]);
    useEffect(() => {
        if (!zad) return;
        zMostu<{ materialy: Material[] }>(`/api/uprzaz/materialy/${zad}`).then((m) => { setMaterialy(m.materialy); setF((x) => ({ ...x, material: x.material || m.materialy[0]?.id || '' })); }).catch(() => setMaterialy([]));
    }, [zad]);
    // przebieg w toku → co 4 s
    const robi = stan?.przebiegi.find((p) => p.stan === 'robi');
    useEffect(() => {
        if (!robi) return;
        const t = setInterval(() => { void wczytaj(); void zMostu<{ przebieg: Przebieg }>(`/api/uprzaz/przebieg/${robi.id}`).then((p) => setPodglad(p.przebieg)).catch(() => {}); }, 4000);
        return () => clearInterval(t);
    }, [robi?.id, wczytaj]);

    const akcja = async (f2: () => Promise<string>) => {
        setKomunikat(null);
        try { setKomunikat(await f2()); await wczytaj(); } catch (e) { setKomunikat(`⚠ ${(e as Error).message}`); }
    };
    const pokaz = (id: string) => zMostu<{ przebieg: Przebieg }>(`/api/uprzaz/przebieg/${id}`).then((p) => setPodglad(p.przebieg)).catch((e) => setKomunikat(`⚠ ${e.message}`));

    if (blad && !stan) return <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-300">🧬 Harness²: {blad}</div>;
    if (!stan) return null;
    const pole = 'rounded-lg bg-black/40 px-2 py-1 text-xs text-slate-200 border border-slate-700';
    const zadanie = stan.zadania.find((z) => z.id === zad);
    const uZad = stan.uprzeze.filter((u) => u.zadanie === zad);
    const aktywna = uZad.find((u) => u.stan === 'aktywna');

    return (
        <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-600/10 to-slate-900/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold tracking-widest text-emerald-300">🧬 HARNESS² <span className="text-xs font-normal text-emerald-400/70">· uprząż TeOgochi po katedralnemu</span></h3>
                    <p className="text-[11px] text-slate-400">Wagi modelu stałe — ulepszamy to, co wokół: zasady, wskazówki, głos, pamięć, skille. Propose → Probe na tym samym materiale → Compose zwycięzców. Do użytku po Twoim ✓.</p>
                    <p className="text-[10px] text-slate-500">Sędzia: {stan.jev ? '⚖️ Jev (TypeSafe) + twarde sprawdziany' : 'model lokalny + twarde sprawdziany (bez klucza Jev — słabszy, może faworyzować własny styl)'} · próg zwycięstwa +{stan.margines}</p>
                </div>
                <button onClick={() => setOtwarte(!otwarte)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/40">{otwarte ? 'zwiń' : 'rozwiń'}</button>
            </div>
            {uZad.filter((u) => u.stan === 'proponowana').map((u) => (
                <div key={u.id} className="mt-3 rounded-lg border border-yellow-400/40 bg-yellow-500/5 p-2 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-yellow-200">📝 Nowa uprząż {u.id} · wynik {wynik(u.wynik.start)} → {wynik(u.wynik.koniec)} · sędzia: {u.sedzia ?? '—'}</span>
                        <span className="flex gap-2">
                            <button className="rounded border border-emerald-400/60 px-2 py-0.5 text-emerald-200" onClick={() => void akcja(async () => { await zMostu(`/api/uprzaz/${u.id}/przyjmij`, { method: 'POST', body: '{}' }); return '✅ Uprząż aktywna — następne scenariusze ją dostaną.'; })}>✓ Przyjmij</button>
                            <button className="rounded border border-red-400/50 px-2 py-0.5 text-red-200" onClick={() => void akcja(async () => { await zMostu(`/api/uprzaz/${u.id}/odrzuc`, { method: 'POST', body: '{}' }); return '✖ Odrzucona.'; })}>✖</button>
                            <button className="text-cyan-300" onClick={() => void pokaz(u.przebieg)}>dowody</button>
                        </span>
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap text-[10px] text-slate-300">{u.blok}</pre>
                </div>
            ))}
            {otwarte && <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select className={pole} value={zad} onChange={(e) => { setZad(e.target.value); setF({ ...f, material: '' }); }}>{stan.zadania.map((z) => <option key={z.id} value={z.id}>{z.nazwa}</option>)}</select>
                    <select className={`${pole} max-w-[300px]`} value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} title={materialy.find((m) => m.id === f.material)?.tytuly.join('\n')}>
                        {materialy.length === 0 && <option value="">— brak materiału —</option>}
                        {materialy.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.opis}</option>)}
                    </select>
                    <span className="text-[10px] text-slate-500">k</span><input className={`${pole} w-12`} type="number" min={1} max={stan.maxK} value={f.k} onChange={(e) => setF({ ...f, k: Number(e.target.value) })} title="ile wersji równolegle (kandydatów w rundzie)" />
                    <span className="text-[10px] text-slate-500">głębokość</span><input className={`${pole} w-12`} type="number" min={1} max={stan.maxGlebokosc} value={f.glebokosc} onChange={(e) => setF({ ...f, glebokosc: Number(e.target.value) })} title="ile rund jedna po drugiej" />
                    <button disabled={!!robi || !f.material} onClick={() => void akcja(async () => { const { przebieg } = await zMostu<{ przebieg: Przebieg }>('/api/uprzaz/przebieg', { method: 'POST', body: JSON.stringify({ zadanie: zad, ...f }) }); setPodglad(przebieg); return `🧬 Przebieg ${przebieg.id} ruszył — ok. ${(f.k + 3) * f.glebokosc} wywołań modelu, jeden naraz na karcie.`; })}
                        className="rounded-lg border border-emerald-400/50 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40">{robi ? `trwa: ${robi.ostatniKrok ?? '…'}` : '🧬 Propose–Probe–Compose'}</button>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{zadanie?.opis} · {aktywna ? <>aktywna: {aktywna.id} <button className="text-red-300" onClick={() => void akcja(async () => { await zMostu('/api/uprzaz/wycofaj', { method: 'POST', body: JSON.stringify({ zadanie: zad }) }); return '↩ Uprząż zdjęta — gołe zasady zadania.'; })}>↩ wycofaj</button></> : 'bez aktywnej uprzęży (gołe zasady zadania)'}</p>
                {aktywna && <pre className="mt-1 whitespace-pre-wrap rounded bg-black/30 p-1.5 text-[10px] text-emerald-100/80">{aktywna.blok}</pre>}
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                    {stan.przebiegi.filter((p) => p.zadanie === zad).slice(0, 8).map((p) => (
                        <button key={p.id} onClick={() => void pokaz(p.id)} className={`rounded border px-1.5 py-0.5 ${p.stan === 'blad' ? 'border-red-500/40 text-red-300' : p.stan === 'robi' ? 'border-yellow-500/40 text-yellow-200' : 'border-slate-600 text-slate-300'}`} title={p.powod ?? p.ostatniKrok ?? ''}>
                            {p.id} · {p.material} · {p.stan === 'robi' ? '⏳' : p.stan === 'blad' ? '⚠' : p.propozycja ? '📝' : '·'}
                        </button>
                    ))}
                </div>
            </>}
            {komunikat && <p className="mt-2 text-[11px] text-emerald-100/90">{komunikat}</p>}
            {podglad && (
                <div className="mt-3 space-y-2 rounded-lg bg-black/30 p-2 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-300">Przebieg {podglad.id} · {podglad.material} · model {podglad.model ?? '?'} · ulepszacz {podglad.ulepszacz ?? '?'} · {podglad.stan}</span>
                        <button className="text-slate-500" onClick={() => setPodglad(null)}>✕</button>
                    </div>
                    {podglad.powod && <p className="text-red-300">⚠ {podglad.powod}</p>}
                    {podglad.rundy.map((r) => (
                        <div key={r.nr} className="space-y-1">
                            <p className="text-emerald-200">Runda {r.nr} · sędzia: {r.sedzia?.kto ?? '…'}{r.sedzia?.jevBlad ? ` (Jev padł: ${r.sedzia.jevBlad})` : ''} · zwycięzcy: {r.zwyciezcy.join(', ') || 'brak'}{r.wybrana ? ` · dalej: ${r.wybrana.lit} (${wynik(r.wybrana.wynik)})` : ''}</p>
                            {r.sedzia?.uwaga && <p className="text-[10px] text-amber-300/80">{r.sedzia.uwaga}</p>}
                            {r.wersje.map((w) => <WersjaWiersz key={w.lit} w={w} zwyciezca={r.zwyciezcy.includes(w.lit)} />)}
                            {r.zlozona && <div><p className="text-[10px] text-purple-200">Złożona vs {r.zlozona.przeciw}: baza {wynik(r.zlozona.wyniki[0])} · najlepsza {wynik(r.zlozona.wyniki[1])} · złożona {wynik(r.zlozona.wyniki[2])}</p><WersjaWiersz w={r.zlozona.wersja} zwyciezca={r.wybrana?.lit === r.zlozona.wersja.lit} /></div>}
                        </div>
                    ))}
                    {podglad.stan === 'robi' && <p className="text-yellow-200">⏳ {podglad.kroki.at(-1)?.t}</p>}
                </div>
            )}
            {otwarte && stan.lekcje.filter((l) => l.zadanie === zad).length > 0 && (
                <div className="mt-3 text-[10px]">
                    <p className="text-slate-400">📓 Zeszyt lekcji (dowody: przebieg · runda · wersja)</p>
                    {stan.lekcje.filter((l) => l.zadanie === zad).slice(0, 10).map((l, i) => (
                        <div key={i} className={l.efekt === 'pomogla' ? 'text-emerald-300' : l.efekt === 'zaszkodzila' ? 'text-red-300' : 'text-slate-500'}>
                            {EFEKT[l.efekt]} ({l.delta >= 0 ? '+' : ''}{l.delta.toFixed(2)}) [{l.zmiana.rodzaj}] {l.zmiana.tresc} <span className="text-slate-600">— {l.dowod.przebieg} · r{l.dowod.runda} · {l.dowod.wersja} · {l.dowod.sedzia ?? '—'}</span>
                        </div>
                    ))}
                </div>
            )}
            <p className="mt-2 text-[10px] text-slate-600">Uczciwie: jedna próba na wersję — losowość modelu bywa większa niż różnica uprzęży. Stąd próg i sprawdzian wersji złożonej. Stan: {Object.entries(STAN_U).map(([k, v]) => `${v} ${uZad.filter((u) => u.stan === k).length}`).join(' · ')}</p>
        </div>
    );
}
