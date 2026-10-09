/**
 * 🥚 JaJo Mistrza — okno w Inkubatorze (most: services/JajoMistrza.js, trasy /api/mistrz*).
 * Pokazuje, co JaJo naprawdę widział (Twoje poprawki i decyzje), jak daleko do wyklucia, zasady stylu z dowodami
 * i przygotowanie danych do Kuźni Soup. Nic tu nie jest wymyślone — wszystko z dziennika obserwacji.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
interface Obserwacja { nr: number; kiedy: string; rodzaj: 'poprawka' | 'decyzja'; zrodlo: string; tytul?: string; kto?: string; przed?: string; po?: string; werdykt?: string; opis?: string }
interface Etap { nazwa: string; opis: string; punkty: number; nastepny: { nazwa: string; od: number; brakuje: number } | null }
interface Zasada { zasada: string; dowody: number[] }
interface RundaKodeksa { nr: number; projekt: string; cel: string; model: string; runda: number; sedzia: string; rundaPrzyjeta: number }
interface Stan { obserwacji: number; poprawki: number; decyzje: number; zrodla: Record<string, { nazwa: string; poprawki: number; decyzje: number }>; etap: Etap; ostatnie: Obserwacja[]; zasady: { kiedy: string; obserwacji: number; zasady: Zasada[] } | null; rundyKodeksa?: { par: number; zadan: number; sedziowie: Record<string, number>; ostatnie: RundaKodeksa[] } }

const IKONA: Record<string, string> = { jajo: '🥚', 'drży': '🥚', 'pęka': '🐣', wykluty: '🐥' };
const WERDYKT: Record<string, string> = { przyjmij: '✅ przyjął', odrzuc: '✖ odrzucił', ratyfikuj: '📜 ratyfikował', zatwierdz: '✅ zatwierdził', skrot: '✂️ przyciął' };

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}

export default function JajoMistrzaPanel() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [trwa, setTrwa] = useState<'lekcja' | 'kurs' | null>(null);
    const [komunikat, setKomunikat] = useState<string | null>(null);

    const wczytaj = useCallback(() => zMostu<Stan>('/api/mistrz').then((s) => { setStan(s); setBlad(null); }).catch((e) => setBlad(e.message)), []);
    useEffect(() => { void wczytaj(); const t = setInterval(() => void wczytaj(), 30_000); return () => clearInterval(t); }, [wczytaj]);

    const lekcja = async () => {
        setTrwa('lekcja'); setKomunikat(null);
        try { const l = await zMostu<{ zasady: Zasada[]; odrzucone: number }>('/api/mistrz/lekcja', { method: 'POST', body: '{}' }); setKomunikat(`📜 ${l.zasady.length} zasad z dowodami${l.odrzucone ? ` (${l.odrzucone} bez dowodu odrzucone)` : ''}`); await wczytaj(); }
        catch (e) { setKomunikat(`⚠ ${(e as Error).message}`); } finally { setTrwa(null); }
    };
    const kurs = async () => {
        setTrwa('kurs'); setKomunikat(null);
        try {
            const k = await zMostu<{ pary: number; sft: number; paryKodeksa: number; katalog: string | null; katalogKodeksa: string | null }>('/api/mistrz/kurs', { method: 'POST', body: '{}' });
            const czesci = [k.pary ? `${k.pary} par „model → Ty” i ${k.sft} przykładów SFT → ${k.katalog}` : null, k.paryKodeksa ? `${k.paryKodeksa} par kodu „źle → dobrze” → ${k.katalogKodeksa}` : null].filter(Boolean);
            setKomunikat(czesci.length ? `⚒️ ${czesci.join(' · ')}` : '⚒️ Brak poprawek i rund Kodeksa — nie ma z czego ułożyć kursu.');
        }
        catch (e) { setKomunikat(`⚠ ${(e as Error).message}`); } finally { setTrwa(null); }
    };

    if (blad && !stan) return <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-300">🥚 JaJo Mistrza: most nie odpowiada ({blad}). Po restarcie mostu JaJo zacznie patrzeć.</div>;
    if (!stan) return null;
    const e = stan.etap;
    const postep = e.nastepny ? Math.min(100, Math.round((e.punkty / e.nastepny.od) * 100)) : 100;

    return (
        <div className="mb-6 rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-500/5 to-slate-900/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className={`text-4xl ${e.nazwa === 'drży' ? 'animate-pulse' : ''}`}>{IKONA[e.nazwa] ?? '🥚'}</span>
                    <div>
                        <h3 className="text-lg font-bold tracking-widest text-yellow-300">JAJO MISTRZA <span className="text-xs font-normal text-yellow-500/70">· {e.nazwa}</span></h3>
                        <p className="text-[11px] text-slate-400">{e.opis}</p>
                    </div>
                </div>
                <div className="flex gap-2 text-xs">
                    <button onClick={() => void lekcja()} disabled={!!trwa} className="rounded-lg border border-yellow-400/40 px-3 py-1.5 text-yellow-200 hover:bg-yellow-400/10 disabled:opacity-40">{trwa === 'lekcja' ? 'pisze lekcję…' : '📜 Lekcja stylu'}</button>
                    <button onClick={() => void kurs()} disabled={!!trwa} className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 hover:bg-slate-700/40 disabled:opacity-40">{trwa === 'kurs' ? 'układa…' : '⚒️ Dane do Kuźni'}</button>
                </div>
            </div>
            <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-gradient-to-r from-yellow-500 to-amber-300 transition-all" style={{ width: `${postep}%` }} /></div>
                <p className="mt-1 text-[10px] text-slate-500">{e.punkty} pkt (poprawka = 2, decyzja = 1){e.nastepny ? ` · do „${e.nastepny.nazwa}” brakuje ${e.nastepny.brakuje}` : ' · wykluty'} · {stan.poprawki} poprawek, {stan.decyzje} decyzji</p>
            </div>
            {komunikat && <p className="mt-2 text-[11px] text-yellow-100/90">{komunikat}</p>}
            {stan.obserwacji === 0 && <p className="mt-3 text-[11px] text-slate-400">JaJo jeszcze nic nie widział. Grzeją go: Twoje poprawki kwestii (Wywiady, Studio Podcastu, Sceny dialogowe), poprawki tytułu i opisu publikacji YouTube przed ✓ oraz decyzje na Stole.</p>}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Co widział</p>
                    <div className="flex flex-wrap gap-1.5">{Object.entries(stan.zrodla).map(([id, z]) => <span key={id} className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{z.nazwa}: {z.poprawki}✎ {z.decyzje}⚖</span>)}</div>
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                        {stan.ostatnie.map((o) => (
                            <div key={o.nr} className="rounded-lg bg-black/30 px-2 py-1 text-[10px]">
                                <span className="text-slate-500">#{o.nr} · </span>
                                {o.rodzaj === 'poprawka'
                                    ? <><span className="text-red-300/70 line-through">{o.przed?.slice(0, 90)}</span> <span className="text-emerald-300">→ {o.po?.slice(0, 90)}</span></>
                                    : <span className="text-sky-300">{WERDYKT[o.werdykt ?? ''] ?? o.werdykt} {o.tytul ? `„${o.tytul.slice(0, 60)}”` : ''} {o.werdykt === 'skrot' ? o.opis : ''}</span>}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Zasady Twojego stylu {stan.zasady ? `· ${new Date(stan.zasady.kiedy).toLocaleDateString('pl-PL')}, z ${stan.zasady.obserwacji} obserwacji` : ''}</p>
                    {stan.zasady?.zasady.length
                        ? <ol className="list-decimal space-y-1 pl-4 text-[11px] text-slate-200">{stan.zasady.zasady.map((z, i) => <li key={i}>{z.zasada} <span className="text-[9px] text-slate-500">{z.dowody.map((n) => `#${n}`).join(' ')}</span></li>)}</ol>
                        : <p className="text-[11px] text-slate-500">Jeszcze bez lekcji. Po 5 poprawkach „📜 Lekcja stylu” spisze zasady — każdą z numerami obserwacji, na których stoi.</p>}
                </div>
            </div>
            {stan.rundyKodeksa && stan.rundyKodeksa.par > 0 && (
                <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">⚖️ Rundy Kodeksa „źle → dobrze” · {stan.rundyKodeksa.par} par z {stan.rundyKodeksa.zadan} zadań · {Object.entries(stan.rundyKodeksa.sedziowie).map(([k, v]) => `${k} ${v}`).join(', ')}</p>
                    <div className="space-y-1">{stan.rundyKodeksa.ostatnie.map((r) => <div key={r.nr} className="rounded-lg bg-black/30 px-2 py-1 text-[10px] text-slate-300"><span className="text-red-300/80">runda {r.runda} ✖ {r.sedzia}</span> → <span className="text-emerald-300">✓ w {r.rundaPrzyjeta}.</span> <span className="text-slate-500">{r.projekt}: {r.cel.slice(0, 80)}</span></div>)}</div>
                </div>
            )}
            <p className="mt-3 text-[10px] leading-snug text-slate-500">📯 JaJo odzywa się przez Orbitę (prawy klik na środku → „Kanał Mistrza”). Dalej (po wykluciu): Mistrz Gry Teterhii — rozstrzyga bitwy, turnieje i eventy na tych zasadach; głos Katedry w Globalnym Klubie Mistrzów.</p>
        </div>
    );
}
