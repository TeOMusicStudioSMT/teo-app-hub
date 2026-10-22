/**
 * 📚 Biblioteka Shoudów — Akademia → zakładka (most: services/BazaWiedzy.js, trasy /api/baza-wiedzy/shoudy*).
 * Prywatna baza PDF-ów Crimson Circle Suwerena: stan indeksu, ▶ indeksuj, pytanie → odpowiedź większym modelem
 * tylko z fragmentów, każde twierdzenie z przypisem [n] (klik = fragment, seria, data, lekcja, nazwa PDF i strona).
 * Materiały © Crimson Circle IP — panel działa tylko przy maszynie Suwerena.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
const KOL = 'shoudy';

interface Seria { seria: string; lata: string | null; plikow: number; kawalkow: number }
interface Praca { etap: string; plikow?: number; zrobione?: number; nowych?: number; kawalkow?: number; eta?: number | null; powod?: string | null; biezacy?: string | null; sekundy?: number | null; bledy?: { plik: string; blad: string }[] }
interface Stan { zrodelPdf: number; zaindeksowanych: number; kawalkow: number; bajtowIndeksu: number; modelEmbeddingow: string; modelOdpowiedzi: string | null; serie: Seria[]; praca: Praca; modele: string[]; pustych: string[] }
interface Fragment { n: number; etykieta: string; plik: string; strona: number; tekst: string; cos: number | null; bm25: number }
interface Sprawdzenie { zdan: number; zZrodlem: number; bezZrodla: number; zleOdnosniki: number[]; brak: boolean; najdluzszyCytat: number }
interface Odpowiedz { pytanie: string; zapytanieEn: string | null; odpowiedz: string; fragmenty: Fragment[]; sprawdzenie: Sprawdzenie; model: string | null; przeszukano: number; sekundy: number }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || (r.status === 404 ? 'Most nie zna Biblioteki — zrestartuj most Katedry.' : `HTTP ${r.status}`));
    return d as T;
}

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

/** Tekst odpowiedzi z klikalnymi przypisami [n]. */
function ZPrzypisami({ tekst, onPrzypis, wybrany }: { tekst: string; onPrzypis: (n: number) => void; wybrany: number | null }) {
    const czesci = tekst.split(/(\[\d+\])/g);
    return (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100" data-bez-tlumaczenia>
            {czesci.map((c, i) => {
                const m = c.match(/^\[(\d+)\]$/);
                if (!m) return <React.Fragment key={i}>{c}</React.Fragment>;
                const n = Number(m[1]);
                return (
                    <button key={i} onClick={() => onPrzypis(n)} className={`mx-0.5 rounded-sm px-1 text-[11px] font-bold align-super ${wybrany === n ? 'bg-amber-400 text-black' : 'bg-cyan-800/70 text-cyan-200 hover:bg-cyan-600'}`}>{n}</button>
                );
            })}
        </p>
    );
}

export const BibliotekaShoudow: React.FC = () => {
    const [stan, setStan] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [pytanie, setPytanie] = useState('');
    const [serie, setSerie] = useState<string[]>([]);
    const [rokOd, setRokOd] = useState('');
    const [rokDo, setRokDo] = useState('');
    const [qa, setQa] = useState<'wszystko' | 'bez' | 'tylko'>('wszystko');
    const [mysli, setMysli] = useState(false);
    const [wynik, setWynik] = useState<Odpowiedz | null>(null);
    const [wybrany, setWybrany] = useState<number | null>(null);

    const odswiez = useCallback(async () => {
        try { setStan(await zMostu<Stan>(`/api/baza-wiedzy/${KOL}`)); setBlad(null); } catch (e) { setBlad((e as Error).message); }
    }, []);
    useEffect(() => { odswiez(); }, [odswiez]);
    const pracuje = stan && ['indeksuje', 'czeka'].includes(stan.praca.etap);
    useEffect(() => { if (!pracuje) return; const t = setInterval(odswiez, 3000); return () => clearInterval(t); }, [pracuje, odswiez]);

    const indeksuj = async () => {
        try { await zMostu(`/api/baza-wiedzy/${KOL}/indeksuj`, { method: 'POST', body: '{}' }); odswiez(); } catch (e) { setBlad((e as Error).message); }
    };
    const zatrzymaj = async () => { try { await zMostu(`/api/baza-wiedzy/${KOL}/zatrzymaj`, { method: 'POST', body: '{}' }); odswiez(); } catch (e) { setBlad((e as Error).message); } };
    const ustawModel = async (model: string) => {
        try { await zMostu(`/api/baza-wiedzy/${KOL}/ustawienia`, { method: 'PUT', body: JSON.stringify({ model: model || null }) }); odswiez(); } catch (e) { setBlad((e as Error).message); }
    };
    const zapytaj = async () => {
        if (!pytanie.trim()) return;
        setMysli(true); setBlad(null); setWybrany(null);
        try {
            setWynik(await zMostu<Odpowiedz>(`/api/baza-wiedzy/${KOL}/pytanie`, {
                method: 'POST', body: JSON.stringify({ pytanie, serie, rokOd: rokOd || null, rokDo: rokDo || null, qa }),
            }));
        } catch (e) { setBlad((e as Error).message); } finally { setMysli(false); }
    };

    const fragment = wynik?.fragmenty.find((f) => f.n === wybrany) ?? null;
    const p = stan?.praca;

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-slate-800/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-lg font-bold text-amber-200">📚 Biblioteka Shoudów</h4>
                    <span className="text-[11px] text-slate-400">🔒 prywatna · © Crimson Circle IP · tylko ta maszyna</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                    Odpowiada większy model Katedry wyłącznie z fragmentów Twoich PDF-ów — każde twierdzenie z przypisem. Czego w Shoudach nie ma, tego nie dopowie.
                </p>
                {stan && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
                        <div>PDF: <b>{stan.zaindeksowanych}</b> / {stan.zrodelPdf}</div>
                        <div>kawałków: <b>{stan.kawalkow.toLocaleString('pl-PL')}</b></div>
                        <div>indeks: <b>{mb(stan.bajtowIndeksu)}</b></div>
                        <div>serii: <b>{stan.serie.length}</b></div>
                    </div>
                )}
                {p && p.etap !== 'bezczynny' && (
                    <div className="mt-2 text-xs text-slate-300">
                        {pracuje ? (
                            <>
                                <div className="h-2 overflow-hidden rounded-sm bg-slate-900"><div className="h-full bg-amber-400" style={{ width: `${((p.zrobione ?? 0) / Math.max(1, p.plikow ?? 1)) * 100}%` }} /></div>
                                <div className="mt-1">{p.etap === 'czeka' ? `⏸ czeka na kartę: ${p.powod}` : `⏳ ${p.zrobione}/${p.plikow} · ${p.kawalkow} kawałków${p.eta ? ` · ~${Math.ceil(p.eta / 60)} min` : ''}`}</div>
                                {p.biezacy && <div className="truncate text-slate-500" data-bez-tlumaczenia>{p.biezacy}</div>}
                            </>
                        ) : (
                            <div>{p.etap === 'gotowe' ? '✅' : p.etap === 'blad' ? '⚠️' : '⏹'} ostatnio: {p.etap}{p.sekundy != null ? ` · ${p.sekundy} s` : ''}{p.nowych != null ? ` · nowych plików ${p.nowych}` : ''}{p.powod ? ` · ${p.powod}` : ''}</div>
                        )}
                        {!!p.bledy?.length && <div className="text-rose-300">Błędy plików: {p.bledy.map((b) => `${b.plik}: ${b.blad}`).join(' · ')}</div>}
                    </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {pracuje
                        ? <button onClick={zatrzymaj} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600">⏹ Zatrzymaj</button>
                        : <button onClick={indeksuj} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-500">▶ Indeksuj {stan?.zaindeksowanych ? '(tylko nowe i zmienione)' : ''}</button>}
                    {stan && (
                        <label className="flex items-center gap-1 text-xs text-slate-300">Model odpowiedzi:
                            <select value={stan.modelOdpowiedzi ?? ''} onChange={(e) => ustawModel(e.target.value)} className="rounded-sm bg-slate-900 px-2 py-1 text-xs text-white">
                                <option value="">domyślny Katedry (gemma4:12B)</option>
                                {stan.modele.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </label>
                    )}
                    <span className="text-[11px] text-slate-500" data-bez-tlumaczenia>embeddingi: {stan?.modelEmbeddingow}</span>
                </div>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-slate-800/60 p-4">
                <textarea value={pytanie} onChange={(e) => setPytanie(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) zapytaj(); }}
                    rows={2} placeholder="Zapytaj Shoudy… (po polsku albo po angielsku; Ctrl+Enter)"
                    className="w-full rounded-lg bg-slate-900 p-2 text-sm text-white placeholder:text-slate-500" />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <select multiple value={serie} onChange={(e) => setSerie([...e.target.selectedOptions].map((o) => o.value))} className="h-16 min-w-48 rounded-sm bg-slate-900 p-1 text-xs text-white" title="Serie (Ctrl = kilka; nic = wszystkie)">
                        {stan?.serie.map((s) => <option key={s.seria} value={s.seria}>{s.seria}{s.lata ? ` (${s.lata})` : ''}</option>)}
                    </select>
                    <label>lata <input value={rokOd} onChange={(e) => setRokOd(e.target.value.replace(/\D/g, ''))} placeholder="od" className="w-14 rounded-sm bg-slate-900 px-1 py-1" /> – <input value={rokDo} onChange={(e) => setRokDo(e.target.value.replace(/\D/g, ''))} placeholder="do" className="w-14 rounded-sm bg-slate-900 px-1 py-1" /></label>
                    <select value={qa} onChange={(e) => setQa(e.target.value as typeof qa)} className="rounded-sm bg-slate-900 px-2 py-1">
                        <option value="wszystko">Shoudy i Q&A</option><option value="bez">bez Q&A</option><option value="tylko">tylko Q&A</option>
                    </select>
                    {!!serie.length && <button onClick={() => setSerie([])} className="text-slate-400 underline">wszystkie serie</button>}
                    <button onClick={zapytaj} disabled={mysli || !pytanie.trim() || !stan?.kawalkow} className="ml-auto rounded-lg bg-cyan-600 px-4 py-1.5 font-bold text-white hover:bg-cyan-500 disabled:opacity-40">
                        {mysli ? '⏳ szukam i czytam…' : '🔎 Zapytaj'}
                    </button>
                </div>
                {!stan?.kawalkow && stan && <p className="mt-2 text-xs text-amber-300">Indeks pusty — najpierw ▶ Indeksuj.</p>}
            </div>

            {blad && <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">{blad}</div>}

            {wynik && (
                <div className="rounded-xl border border-slate-600 bg-slate-900/70 p-4">
                    <ZPrzypisami tekst={wynik.odpowiedz} onPrzypis={setWybrany} wybrany={wybrany} />
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
                        <span>🧾 zdań ze źródłem: <b className="text-slate-200">{wynik.sprawdzenie.zZrodlem}/{wynik.sprawdzenie.zdan}</b></span>
                        {!!wynik.sprawdzenie.zleOdnosniki.length && <span className="text-rose-300">usunięte odnośniki spoza fragmentów: {wynik.sprawdzenie.zleOdnosniki.join(', ')}</span>}
                        {wynik.sprawdzenie.najdluzszyCytat > 15 && <span className="text-amber-300">⚠ dosłowny ciąg {wynik.sprawdzenie.najdluzszyCytat} słów</span>}
                        {wynik.zapytanieEn && <span data-bez-tlumaczenia>🔤 szukano też: „{wynik.zapytanieEn}”</span>}
                        <span data-bez-tlumaczenia>🧠 {wynik.model ?? '—'} · {wynik.sekundy} s · przeszukano {wynik.przeszukano} kawałków</span>
                    </div>
                    {fragment && (
                        <div className="mt-3 rounded-lg border border-amber-500/40 bg-slate-950 p-3">
                            <div className="text-xs font-bold text-amber-200">[{fragment.n}] {fragment.etykieta}, s. {fragment.strona}</div>
                            <div className="text-[11px] text-slate-500" data-bez-tlumaczenia>{fragment.plik}</div>
                            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300" data-bez-tlumaczenia>{fragment.tekst}</p>
                        </div>
                    )}
                    <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-slate-400">Wszystkie fragmenty ({wynik.fragmenty.length})</summary>
                        <ul className="mt-2 space-y-1 text-xs">
                            {wynik.fragmenty.map((f) => (
                                <li key={f.n}><button onClick={() => setWybrany(f.n)} className="text-left text-cyan-300 hover:underline">[{f.n}] {f.etykieta}, s. {f.strona}</button>
                                    <span className="ml-2 text-slate-500">{f.cos != null ? `cos ${f.cos.toFixed(2)}` : ''}{f.bm25 ? ` · słowa ${f.bm25.toFixed(1)}` : ''}</span></li>
                            ))}
                        </ul>
                    </details>
                </div>
            )}
        </div>
    );
};
