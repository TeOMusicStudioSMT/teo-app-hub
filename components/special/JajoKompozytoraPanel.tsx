/**
 * 🏛️⚡ JaJo Kompozytor — okno w Inkubatorze obok JaJa Mistrza (most: services/JajoKompozytora.js, trasy /api/kompozytor*).
 * Komponuje oś czasu (sekcje w taktach, ruchy TeOgochi, sceny ekranów LED, prompt dla generatora), pokazuje ją jako pas
 * sekcji, pozwala ją poprawić (para „model → Suweren” pod trening), przyjąć / odrzucić i zamówić utwór u Joanny.
 * Jajo grzeją tylko prawdziwe decyzje i poprawki Suwerena (poprawka 2 pkt, decyzja 1 pkt).
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
const TYPY: Record<string, { nazwa: string; kolor: string }> = {
    intro: { nazwa: 'Intro', kolor: '#7c3aed' }, staccato: { nazwa: 'Staccato', kolor: '#2563eb' }, buildup: { nazwa: 'Build-up', kolor: '#9333ea' },
    drop: { nazwa: 'Drop', kolor: '#dc2626' }, outro: { nazwa: 'Outro', kolor: '#f59e0b' },
};
const SCENY = ['korektor', 'fale', 'gwiazdy', 'napis', 'kolor', 'stroboskop'];
interface Sekcja { typ: string; nazwa: string; od: number; do: number; energia: number; ruch: string; muzyka: string; swiatla: { scena: string; kolor: string; opis: string } }
interface Os {
    id: string; tytul: string; opis: string; bpm: number; takty: number; stan: 'propozycja' | 'przyjeta' | 'odrzucona'; poprawiona: boolean; prompt: string; model: string | null;
    utwor: { plik: string; tytul: string } | null; zamowienie: { id: string; stan?: string; blad?: string | null } | null; sekcje: Sekcja[]; markery: { takt: number; typ: string; opis: string }[];
}
interface Etap { nazwa: string; opis: string; punkty: number; nastepny: { nazwa: string; od: number; brakuje: number } | null }
interface Stan { obserwacji: number; poprawki: number; decyzje: number; etap: Etap; osie: Os[] }
interface Utwor { plik: string; tytul: string }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || (r.status === 404 ? 'Most nie zna Kompozytora — zrestartuj most Katedry.' : `HTTP ${r.status}`));
    return d as T;
}
const STAN: Record<Os['stan'], string> = { propozycja: '📝 propozycja', przyjeta: '✅ przyjęta', odrzucona: '✖ odrzucona' };

function PasOsi({ os }: { os: Os }) {
    return (
        <div className="relative mt-1 h-7 overflow-hidden rounded-md bg-slate-900">
            {os.sekcje.map((s, i) => (
                <div key={i} title={`${s.nazwa} · takty ${s.od}–${s.do} · ${s.ruch || ''} · 📺 ${s.swiatla.scena}`} className="absolute top-0 flex h-full items-center justify-center overflow-hidden border-r border-black/40 text-[9px] font-bold text-white"
                    style={{ left: `${(s.od / os.takty) * 100}%`, width: `${((s.do - s.od) / os.takty) * 100}%`, background: `linear-gradient(180deg, ${s.swiatla.kolor}, ${TYPY[s.typ]?.kolor ?? '#555'}aa)`, opacity: 0.45 + 0.55 * s.energia }}>
                    {TYPY[s.typ]?.nazwa ?? s.typ}
                </div>
            ))}
            {os.markery.map((m, i) => <div key={`m${i}`} title={`${m.typ} · takt ${m.takt}: ${m.opis}`} className="absolute top-0 h-full w-0.5 bg-yellow-300" style={{ left: `${(m.takt / os.takty) * 100}%` }} />)}
        </div>
    );
}

function Edytor({ os, onZapisz, onAnuluj }: { os: Os; onZapisz: (d: { sekcje: Sekcja[]; prompt: string; tytul: string }) => void; onAnuluj: () => void }) {
    const [sekcje, setSekcje] = useState<Sekcja[]>(() => os.sekcje.map((s) => ({ ...s, swiatla: { ...s.swiatla } })));
    const [prompt, setPrompt] = useState(os.prompt);
    const [tytul, setTytul] = useState(os.tytul);
    const zmien = (i: number, d: Partial<Sekcja>) => setSekcje((l) => l.map((s, k) => (k === i ? { ...s, ...d } : s)));
    const pole = 'rounded-sm bg-black/40 px-1 py-0.5 text-[11px] text-slate-200 border border-slate-700';
    return (
        <div className="mt-2 space-y-1 rounded-lg border border-purple-500/30 bg-black/30 p-2">
            <input className={`${pole} w-full`} value={tytul} onChange={(e) => setTytul(e.target.value)} />
            {sekcje.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1">
                    <select className={pole} value={s.typ} onChange={(e) => zmien(i, { typ: e.target.value })}>{Object.entries(TYPY).map(([k, v]) => <option key={k} value={k}>{v.nazwa}</option>)}</select>
                    <input className={`${pole} w-12`} type="number" value={s.od} onChange={(e) => zmien(i, { od: Number(e.target.value) })} title="od taktu" />–
                    <input className={`${pole} w-12`} type="number" value={s.do} onChange={(e) => zmien(i, { do: Number(e.target.value) })} title="do taktu" />
                    <select className={pole} value={s.swiatla.scena} onChange={(e) => zmien(i, { swiatla: { ...s.swiatla, scena: e.target.value } })} title="scena ekranów LED">{SCENY.map((x) => <option key={x}>{x}</option>)}</select>
                    <input className={pole} type="color" value={s.swiatla.kolor} onChange={(e) => zmien(i, { swiatla: { ...s.swiatla, kolor: e.target.value } })} />
                    <input className={`${pole} min-w-[180px] flex-1`} value={s.ruch} onChange={(e) => zmien(i, { ruch: e.target.value })} placeholder="ruch TeOgochi" />
                    <button className="text-[11px] text-red-300" onClick={() => setSekcje((l) => l.filter((_, k) => k !== i))}>✕</button>
                </div>
            ))}
            <button className="text-[11px] text-purple-300" onClick={() => { const ost = sekcje.at(-1); setSekcje((l) => [...l, { typ: 'outro', nazwa: 'Outro', od: ost?.do ?? 0, do: os.takty, energia: 0.3, ruch: '', muzyka: '', swiatla: { scena: 'napis', kolor: '#f59e0b', opis: '' } }]); }}>＋ sekcja</button>
            <textarea className={`${pole} w-full`} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} title="prompt dla generatora muzyki (po angielsku)" />
            <p className="text-[10px] text-slate-500">Takty 0–{os.takty}. Most sprawdzi oś tak samo jak u modelu — zła = błąd wprost. Zapis = para „model → Ty” dla Kuźni.</p>
            <div className="flex gap-2"><button className="rounded-sm border border-purple-400/50 px-2 py-1 text-[11px] text-purple-200" onClick={() => onZapisz({ sekcje, prompt, tytul })}>💾 Zapisz poprawkę</button><button className="text-[11px] text-slate-400" onClick={onAnuluj}>anuluj</button></div>
        </div>
    );
}

export default function JajoKompozytoraPanel() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [utwory, setUtwory] = useState<Utwor[]>([]);
    const [f, setF] = useState({ utwor: '', opis: '', bpm: 126, sekundy: 90, styl: 'organy + electro' });
    const [trwa, setTrwa] = useState<string | null>(null);
    const [komunikat, setKomunikat] = useState<string | null>(null);
    const [edycja, setEdycja] = useState<string | null>(null);

    const wczytaj = useCallback(() => zMostu<Stan>('/api/kompozytor').then((s) => { setStan(s); setBlad(null); }).catch((e) => setBlad(e.message)), []);
    useEffect(() => {
        void wczytaj();
        zMostu<{ utwory: Utwor[] }>('/api/rytm/utwory').then((u) => setUtwory(u.utwory ?? [])).catch(() => {});
        const t = setInterval(() => void wczytaj(), 30_000);
        return () => clearInterval(t);
    }, [wczytaj]);

    const akcja = async (co: string, f2: () => Promise<string>) => {
        setTrwa(co); setKomunikat(null);
        try { setKomunikat(await f2()); await wczytaj(); } catch (e) { setKomunikat(`⚠ ${(e as Error).message}`); } finally { setTrwa(null); }
    };
    const komponuj = () => akcja('komponuj', async () => {
        const cialo = f.utwor ? { utwor: f.utwor, opis: f.opis, styl: f.styl } : { opis: f.opis, bpm: f.bpm, sekundy: f.sekundy, styl: f.styl };
        const { os } = await zMostu<{ os: Os }>('/api/kompozytor/komponuj', { method: 'POST', body: JSON.stringify(cialo) });
        return `⚡ Bam! „${os.tytul}” — ${os.takty} taktów, ${os.sekcje.length} sekcji (model ${os.model ?? '?'}).`;
    });

    if (blad && !stan) return <div className="mb-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 text-xs text-purple-300">🏛️⚡ JaJo Kompozytor: {blad}</div>;
    if (!stan) return null;
    const e = stan.etap;
    const postep = e.nastepny ? Math.min(100, Math.round((e.punkty / e.nastepny.od) * 100)) : 100;
    const pole = 'rounded-lg bg-black/40 px-2 py-1 text-xs text-slate-200 border border-slate-700';

    return (
        <div className="mb-6 rounded-2xl border border-purple-400/30 bg-linear-to-br from-purple-600/10 to-slate-900/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <img src="/kompozytor/jajo-kompozytora.jpg" alt="JaJo Kompozytor" className={`h-14 w-14 rounded-xl border border-purple-400/40 ${e.nazwa === 'drży' ? 'animate-pulse' : ''}`} />
                    <div>
                        <h3 className="text-lg font-bold tracking-widest text-purple-300">🏛️⚡ JAJO KOMPOZYTOR <span className="text-xs font-normal text-purple-400/70">· {e.nazwa} · 🎹🔥 👾🏰</span></h3>
                        <p className="text-[11px] text-slate-400">Kompozytor i Producent TeO Game Show — domena „Bam”: organy + electro 124–128 BPM, osie czasu z markerami, ruchami i światłami.</p>
                    </div>
                </div>
                <button onClick={() => void akcja('kurs', async () => { const k = await zMostu<{ pary: number; sft: number; katalog: string | null }>('/api/kompozytor/kurs', { method: 'POST', body: '{}' }); return k.pary || k.sft ? `⚒️ ${k.pary} par „model → Ty” i ${k.sft} przyjętych osi → ${k.katalog}` : '⚒️ Nie ma jeszcze poprawek ani przyjętych osi.'; })} disabled={!!trwa} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/40 disabled:opacity-40">⚒️ Dane do Kuźni</button>
            </div>
            <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-linear-to-r from-purple-600 to-fuchsia-400 transition-all" style={{ width: `${postep}%` }} /></div>
                <p className="mt-1 text-[10px] text-slate-500">{e.punkty} pkt (poprawiona oś = 2, przyjęta/odrzucona = 1){e.nastepny ? ` · do „${e.nastepny.nazwa}” brakuje ${e.nastepny.brakuje}` : ' · wykluty'} · {stan.poprawki} poprawek, {stan.decyzje} decyzji</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className={`${pole} max-w-[260px]`} value={f.utwor} onChange={(x) => setF({ ...f, utwor: x.target.value })}>
                    <option value="">— nowy utwór (do zamówienia) —</option>
                    {utwory.map((u) => <option key={u.plik} value={u.plik}>{u.tytul}</option>)}
                </select>
                {!f.utwor && <><input className={`${pole} w-16`} type="number" min={60} max={180} value={f.bpm} onChange={(x) => setF({ ...f, bpm: Number(x.target.value) })} title="BPM" /><span className="text-[10px] text-slate-500">BPM</span>
                    <input className={`${pole} w-16`} type="number" min={20} max={240} value={f.sekundy} onChange={(x) => setF({ ...f, sekundy: Number(x.target.value) })} title="sekundy" /><span className="text-[10px] text-slate-500">s</span></>}
                <input className={`${pole} w-36`} value={f.styl} onChange={(x) => setF({ ...f, styl: x.target.value })} placeholder="styl" />
                <input className={`${pole} min-w-[220px] flex-1`} value={f.opis} onChange={(x) => setF({ ...f, opis: x.target.value })} placeholder="prośba do Kompozytora (np. majestatyczny drop w połowie, d-moll)" />
                <button onClick={() => void komponuj()} disabled={!!trwa} className="rounded-lg border border-purple-400/50 px-3 py-1.5 text-xs text-purple-100 hover:bg-purple-500/20 disabled:opacity-40">{trwa === 'komponuj' ? 'komponuje…' : '🏛️⚡ Komponuj oś'}</button>
            </div>
            {komunikat && <p className="mt-2 text-[11px] text-purple-100/90">{komunikat}</p>}
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {stan.osie.length === 0 && <p className="text-[11px] text-slate-500">Jeszcze bez osi. Wybierz utwór z biblioteki (oś do niego) albo opisz nowy (oś + zamówienie u Joanny).</p>}
                {stan.osie.slice(0, 8).map((o) => (
                    <div key={o.id} className="rounded-lg bg-black/30 p-2 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span><b className="text-purple-200">{o.tytul}</b> <span className="text-slate-500">· {o.bpm} BPM · {o.takty} taktów · {STAN[o.stan]}{o.poprawiona ? ' · ✎ poprawiona' : ''}{o.utwor ? ` · ♪ ${o.utwor.tytul}` : ''}{o.zamowienie && !o.utwor ? ` · 🎤 zamówienie: ${o.zamowienie.stan ?? 'czeka'}${o.zamowienie.blad ? ` (${o.zamowienie.blad})` : ''}` : ''}</span></span>
                            <span className="flex gap-1">
                                {o.stan !== 'przyjeta' && <button disabled={!!trwa} className="rounded-sm border border-emerald-500/40 px-2 text-emerald-300" onClick={() => void akcja('d', async () => { await zMostu(`/api/kompozytor/os/${o.id}/przyjmij`, { method: 'POST', body: '{}' }); return `✅ „${o.tytul}” przyjęta.`; })}>✓</button>}
                                {o.stan !== 'odrzucona' && <button disabled={!!trwa} className="rounded-sm border border-red-500/40 px-2 text-red-300" onClick={() => void akcja('d', async () => { await zMostu(`/api/kompozytor/os/${o.id}/odrzuc`, { method: 'POST', body: '{}' }); return `✖ „${o.tytul}” odrzucona.`; })}>✖</button>}
                                <button className="rounded-sm border border-slate-600 px-2 text-slate-300" onClick={() => setEdycja(edycja === o.id ? null : o.id)}>✎</button>
                                {!o.utwor && !o.zamowienie && o.stan !== 'odrzucona' && <button disabled={!!trwa} className="rounded-sm border border-fuchsia-500/40 px-2 text-fuchsia-200" title="Zamów utwór u Joanny z promptem Kompozytora (generator na GPU)" onClick={() => void akcja('z', async () => { await zMostu(`/api/kompozytor/os/${o.id}/zamow`, { method: 'POST', body: '{}' }); return '🎤 Zamówione u Joanny — utwór powstaje w tle (Bazylika Dźwięku), potem sam przypnie się do osi.'; })}>🎤 Zamów</button>}
                                <button className="px-1 text-slate-500" onClick={() => { if (confirm('Usunąć tę oś?')) void akcja('u', async () => { await zMostu(`/api/kompozytor/os/${o.id}`, { method: 'DELETE' }); return '🗑 Usunięta.'; }); }}>🗑</button>
                            </span>
                        </div>
                        <PasOsi os={o} />
                        <p className="mt-1 text-[10px] text-slate-400">{o.sekcje.map((s) => `${TYPY[s.typ]?.nazwa ?? s.typ} ${s.od}–${s.do}${s.ruch ? `: ${s.ruch}` : ''}`).join(' · ')}</p>
                        <p className="text-[10px] italic text-slate-500">🎛️ {o.prompt}</p>
                        {edycja === o.id && <Edytor os={o} onAnuluj={() => setEdycja(null)} onZapisz={(d) => void akcja('p', async () => { const r = await zMostu<{ zmiana: boolean }>(`/api/kompozytor/os/${o.id}`, { method: 'PUT', body: JSON.stringify(d) }); setEdycja(null); return r.zmiana ? '✎ Poprawka zapisana — para „model → Ty” w dzienniku Kompozytora.' : 'Bez zmian.'; })} />}
                    </div>
                ))}
            </div>
            <p className="mt-3 text-[10px] leading-snug text-slate-500">Oś trafia do Bazyliki Dźwięku (Teterhia → zakładka „🏛️⚡ Kompozytor”), do choreografii (nazwy sekcji na frazach, 🔥 mocniejsze ruchy na Drop, sceny ekranów LED) i do ⚔️ PvP rytmicznego w Tanecznym Starciu.</p>
        </div>
    );
}
