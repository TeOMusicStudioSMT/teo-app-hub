/**
 * 📥 Własny Manuskrypt — książka autora (PDF / DOCX / TXT) + jego ilustracje → Głosek czyta → audiobook mp3,
 * film na YouTube (✓ w Izbie) i Żywa Księga do Wypożyczalni teostory.studio. Most: services/WlasnyManuskrypt.js.
 * Tekst autora zostaje w 100% — panel pokazuje sceny i zgodność ze źródłem przed produkcją.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';

interface Scena { nr: number; rozdzial: string | null; naglowek: string | null; tekst: string; obraz: { plik: string; zrodlo: string } | null; obrazUrl: string | null; audioUrl: string | null; sekundy?: number; strona?: number | null }
interface Zadanie { id: string; stan: string; tytul: string; autor: string; rodzaj: string; plik: string; jezyk: 'pl' | 'en'; tryb?: string; slowNaScene?: number; sceny: Scena[];
    zgodnosc?: { znakowZrodla: number; znakowScen: number; zgodne: boolean }; nieuzyteObrazy?: number; powod?: string | null; kroki?: { kiedy: string; opis: string }[];
    wideo?: string | null; audiobook?: string | null; sekundyAudio?: number | null; youtube?: { id: string; etap: string } | null; wypozyczalnia?: { id: string; tier: string; cenaEur: number } | null }
interface Skrot { id: string; stan: string; tytul: string; autor: string; rodzaj: string; scen: number; utworzono: string; powod: string | null; krok: string | null }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    let r: Response;
    try { r = await fetch(`${MOST}${sciezka}`, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined }); }
    catch { throw new Error('Most (127.0.0.1:3001) milczy — odpal Katedrę.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) throw new Error(d?.message || `Most odpowiedział HTTP ${r.status}`);
    return d as T;
}
const naDataUrl = (f: File) => new Promise<string>((ok, zle) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => zle(r.error); r.readAsDataURL(f); });
const PRACUJE = ['czeka', 'obrazy', 'glos', 'wideo', 'audiobook'];
const ETAPY: Record<string, string> = { sceny: '✂️ sceny do przejrzenia', czeka: '⏳ w kolejce', obrazy: '🎨 ilustracje', glos: '🎙️ Głosek czyta', wideo: '🎬 film', audiobook: '🎧 audiobook', gotowe: '✅ gotowe', blad: '⛔ błąd' };
const ZRODLO: Record<string, string> = { pdf: '📄 z PDF', docx: '📝 z DOCX', autor: '🖼️ autora', paleta: '🎨 Paleta', poprzedni: '↩ poprzednia' };

export default function WlasnyManuskrypt() {
    const [lista, setLista] = useState<Skrot[]>([]);
    const [akt, setAkt] = useState<Zadanie | null>(null);
    const [plik, setPlik] = useState<File | null>(null);
    const [ilustracje, setIlustracje] = useState<File[]>([]);
    const [tytul, setTytul] = useState('');
    const [autor, setAutor] = useState('');
    const [jezyk, setJezyk] = useState<'pl' | 'en'>('pl');
    const [prawa, setPrawa] = useState(false);
    const [domaluj, setDomaluj] = useState(false);
    const [slow, setSlow] = useState(140);
    const [cena, setCena] = useState('1.99');
    const [praca, setPraca] = useState('');
    const [blad, setBlad] = useState('');

    const odswiez = useCallback(async () => {
        try {
            setLista((await zMostu<{ manuskrypty: Skrot[] }>('/api/manuskrypt')).manuskrypty);
            if (akt) setAkt((await zMostu<{ zadanie: Zadanie }>(`/api/manuskrypt/${akt.id}`)).zadanie);
        } catch (e) { setBlad((e as Error).message); }
    }, [akt?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { void odswiez(); }, [odswiez]);
    const wToku = akt && PRACUJE.includes(akt.stan);
    useEffect(() => { if (!wToku) return; const t = setInterval(() => void odswiez(), 4000); return () => clearInterval(t); }, [wToku, odswiez]);

    const rob = async (opis: string, fn: () => Promise<void>) => { setBlad(''); setPraca(opis); try { await fn(); } catch (e) { setBlad((e as Error).message); } finally { setPraca(''); } };
    const otworz = (id: string) => rob('otwieram…', async () => setAkt((await zMostu<{ zadanie: Zadanie }>(`/api/manuskrypt/${id}`)).zadanie));
    const wczytaj = () => rob('wczytuję książkę i dzielę na sceny…', async () => {
        if (!plik) throw new Error('Wybierz plik książki.');
        const dane = await naDataUrl(plik);
        const ilu = await Promise.all(ilustracje.map(async (f) => ({ nazwa: f.name, dane: await naDataUrl(f) })));
        const { zadanie } = await zMostu<{ zadanie: Zadanie }>('/api/manuskrypt', { method: 'POST', body: JSON.stringify({ nazwa: plik.name, dane, ilustracje: ilu, tytul, autor, jezyk, prawa, slowNaScene: slow }) });
        setAkt(zadanie); setPlik(null); setIlustracje([]); await odswiez();
    });
    const akcja = (sciezka: string, body: object, opis: string) => rob(opis, async () => {
        if (!akt) return;
        const d = await zMostu<{ zadanie?: Zadanie }>(`/api/manuskrypt/${akt.id}${sciezka}`, { method: 'POST', body: JSON.stringify(body) });
        if (d.zadanie) setAkt(d.zadanie); else await odswiez();
        await odswiez();
    });
    const podmienIlustracje = (nr: number, f: File) => rob(`ilustracja sceny ${nr}…`, async () => {
        if (!akt) return;
        const { zadanie } = await zMostu<{ zadanie: Zadanie }>(`/api/manuskrypt/${akt.id}/scena/${nr}/ilustracja`, { method: 'POST', body: JSON.stringify({ nazwa: f.name, dane: await naDataUrl(f) }) });
        setAkt(zadanie);
    });
    const usun = (id: string) => rob('usuwam…', async () => { if (!confirm('Przenieść ten manuskrypt do kosza Katedry?')) return; await zMostu(`/api/manuskrypt/${id}`, { method: 'DELETE' }); if (akt?.id === id) setAkt(null); await odswiez(); });

    const brakObrazu = akt?.sceny.filter((s) => !s.obraz || s.obraz.zrodlo === 'poprzedni').length ?? 0;

    return (
        <div className="mx-auto max-w-4xl space-y-5 p-4 text-amber-50">
            <header className="text-center">
                <h1 className="font-serif text-3xl text-amber-300 drop-shadow">📥 Własny Manuskrypt</h1>
                <p className="text-xs text-amber-200/60">Twoja książka (PDF, DOCX, TXT) z Twoimi ilustracjami → Głosek czyta → audiobook, film na YouTube i Żywa Księga do teostory.studio. Tekst zostaje dokładnie Twój.</p>
            </header>

            <section className="space-y-3 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-950 to-[#160f08] p-4">
                <div className="text-sm font-bold text-amber-200">1 · Wgraj książkę</div>
                <label className="block rounded-xl border border-dashed border-amber-600/50 p-3 text-xs"
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = [...e.dataTransfer.files]; const k = f.find((x) => /\.(pdf|docx|txt)$/i.test(x.name)); if (k) setPlik(k); setIlustracje((p) => [...p, ...f.filter((x) => x.type.startsWith('image/'))]); }}>
                    📄 Plik książki: <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setPlik(e.target.files?.[0] ?? null)} /> {plik && <b>{plik.name} ({Math.round(plik.size / 1024)} KB)</b>}
                    <div className="mt-2">🖼️ Ilustracje (opcjonalnie, kolejność wg nazw plików): <input type="file" accept="image/*" multiple onChange={(e) => setIlustracje([...(e.target.files ?? [])])} /> {ilustracje.length > 0 && <b>{ilustracje.length} obrazów</b>}</div>
                    <div className="mt-1 text-amber-200/50">Obrazy wstawione w PDF/DOCX Katedra wyjmie sama. Upuść tu plik i obrazy naraz.</div>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                    <input value={tytul} onChange={(e) => setTytul(e.target.value)} placeholder="Tytuł (pusty = z pliku)" className="rounded-lg border border-amber-700/40 bg-black/40 p-2 text-sm" />
                    <input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Autor" className="rounded-lg border border-amber-700/40 bg-black/40 p-2 text-sm" />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label>Język książki: <select value={jezyk} onChange={(e) => setJezyk(e.target.value as 'pl' | 'en')} className="rounded bg-black/50 p-1"><option value="pl">polski</option><option value="en">English</option></select></label>
                    <label>Słów na scenę (DOCX/TXT): <input type="number" min={20} max={600} value={slow} onChange={(e) => setSlow(Number(e.target.value))} className="w-20 rounded bg-black/50 p-1" /></label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={prawa} onChange={(e) => setPrawa(e.target.checked)} /> Mam prawa do tekstu i ilustracji (jestem autorem albo mam zgodę)</label>
                    <button disabled={!plik || !prawa || !!praca} onClick={wczytaj} className="ml-auto rounded-xl bg-gradient-to-r from-amber-500 to-amber-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">📥 Wczytaj i podziel</button>
                </div>
            </section>

            {praca && <div className="text-center text-xs text-amber-200/70">⏳ {praca}</div>}
            {blad && <div className="rounded-lg bg-rose-950/50 p-2 text-xs text-rose-300">⚠ {blad}</div>}

            {akt && (
                <section className="space-y-3 rounded-3xl border border-amber-500/30 bg-black/30 p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                        <div className="font-serif text-xl text-amber-200">„{akt.tytul}”</div>
                        {akt.autor && <div className="text-xs text-amber-200/60">— {akt.autor}</div>}
                        <div className="ml-auto text-xs">{ETAPY[akt.stan] ?? akt.stan}</div>
                    </div>
                    <div className="text-xs text-amber-200/70">
                        {akt.rodzaj.toUpperCase()} · {akt.sceny.length} scen ({akt.tryb === 'strony' ? 'strony PDF' : akt.tryb === 'ilosc' ? 'tyle, ile ilustracji' : `ok. ${akt.slowNaScene} słów`}) ·
                        {akt.zgodnosc?.zgodne ? <span className="text-emerald-300"> ✓ tekst zgodny ze źródłem ({akt.zgodnosc.znakowScen} znaków)</span> : <span className="text-rose-300"> ⚠ tekst NIEZGODNY ze źródłem</span>}
                        {brakObrazu > 0 && <> · bez własnej ilustracji: {brakObrazu}</>}{akt.nieuzyteObrazy ? <> · nieużytych obrazów: {akt.nieuzyteObrazy}</> : null}
                    </div>
                    {akt.powod && <div className="text-xs text-rose-300">⛔ {akt.powod}</div>}

                    {['sceny', 'gotowe', 'blad'].includes(akt.stan) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <button disabled={!!praca} onClick={() => akcja('/podziel', { slowNaScene: slow, tryb: 'slowa' }, 'dzielę od nowa…')} className="rounded-lg border border-amber-600/50 px-2 py-1">✂️ podziel wg słów ({slow})</button>
                            {akt.rodzaj === 'pdf' && <button disabled={!!praca} onClick={() => akcja('/podziel', { tryb: 'strony' }, 'dzielę…')} className="rounded-lg border border-amber-600/50 px-2 py-1">📄 wg stron PDF</button>}
                            <label className="flex items-center gap-1"><input type="checkbox" checked={domaluj} onChange={(e) => setDomaluj(e.target.checked)} /> 🎨 Domaluj brakujące ilustracje (Paleta FLUX, Twoje obrazy jako wzór)</label>
                            <button disabled={!!praca || !akt.zgodnosc?.zgodne} onClick={() => akcja('/produkuj', { domaluj, glos: 'glosek', jezyk: akt.jezyk }, 'zlecam produkcję…')}
                                className="ml-auto rounded-xl bg-gradient-to-r from-teal-500 to-emerald-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">▶ Produkuj: Głosek czyta → audiobook, film, Żywa Księga</button>
                        </div>
                    )}

                    {akt.stan === 'gotowe' && (
                        <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs">
                            <div className="flex flex-wrap items-center gap-3">
                                <a className="rounded-lg bg-emerald-700/60 px-2 py-1" href={`${MOST}/api/manuskrypt/${akt.id}/audiobook`}>🎧 Pobierz audiobook (mp3{akt.sekundyAudio ? `, ${Math.round(akt.sekundyAudio / 60)} min` : ''})</a>
                                <button disabled={!!praca} onClick={() => akcja('/youtube', {}, 'Kronikarz pisze opis filmu…')} className="rounded-lg bg-rose-700/60 px-2 py-1">📺 Film do publikacji YouTube</button>
                                {akt.youtube && <span>📺 {akt.youtube.etap === 'do_akceptacji' ? 'czeka na ✓ w Izbie zgód' : akt.youtube.etap}</span>}
                            </div>
                            <video controls className="w-full rounded-xl" src={`${MOST}/api/manuskrypt/${akt.id}/wideo`} />
                            <div className="flex flex-wrap items-center gap-2">
                                📚 Wypożyczalnia teostory.studio:
                                <button disabled={!!praca} onClick={() => akcja('/wypozyczalnia', { rentalTier: 'demo' }, 'wystawiam…')} className="rounded-lg border border-amber-500/50 px-2 py-1">za darmo (demo)</button>
                                <input value={cena} onChange={(e) => setCena(e.target.value)} className="w-16 rounded bg-black/50 p-1" /> €
                                <button disabled={!!praca} onClick={() => akcja('/wypozyczalnia', { rentalTier: 'rental_48h', cenaEur: Number(cena.replace(',', '.')) }, 'wystawiam…')} className="rounded-lg border border-amber-500/50 px-2 py-1">wypożyczenie 48 h</button>
                                {akt.wypozyczalnia && <span className="text-emerald-300">✓ wystawiona: {akt.wypozyczalnia.id} ({akt.wypozyczalnia.tier}{akt.wypozyczalnia.cenaEur ? `, ${akt.wypozyczalnia.cenaEur} €` : ''})</span>}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        {akt.sceny.map((s) => (
                            <div key={s.nr} className="space-y-1 rounded-2xl border border-amber-800/40 bg-[#1b130a] p-2">
                                <div className="flex items-center gap-2 text-[11px] text-amber-300/80">
                                    <b>Scena {s.nr}</b>{s.strona ? <span>· str. {s.strona}</span> : null}{s.rozdzial && <span className="truncate">· {s.rozdzial}</span>}
                                    <span className="ml-auto">{s.obraz ? ZRODLO[s.obraz.zrodlo] ?? s.obraz.zrodlo : '— bez obrazu'}</span>
                                </div>
                                {s.obrazUrl && <img src={`${MOST}${s.obrazUrl}`} alt="" className="aspect-video w-full rounded-lg object-cover" />}
                                <div className="max-h-28 overflow-y-auto whitespace-pre-line font-serif text-xs text-amber-50/90">{s.naglowek && <b>{s.naglowek}{'\n'}</b>}{s.tekst}</div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    {['sceny', 'gotowe', 'blad'].includes(akt.stan) && <label className="cursor-pointer text-amber-300/80">🖼️ zmień ilustrację<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void podmienIlustracje(s.nr, f); }} /></label>}
                                    {s.audioUrl && <audio controls preload="none" className="ml-auto h-7" src={`${MOST}${s.audioUrl}`} />}
                                </div>
                            </div>
                        ))}
                    </div>
                    {akt.kroki && <details className="text-[11px] text-amber-200/60"><summary>Przebieg ({akt.kroki.length})</summary>{akt.kroki.map((k, i) => <div key={i}>{k.kiedy.slice(11, 19)} {k.opis}</div>)}</details>}
                </section>
            )}

            <section className="space-y-1">
                <div className="text-sm font-bold text-amber-200">📚 Manuskrypty w Katedrze</div>
                {lista.length === 0 ? <div className="text-xs text-amber-200/50">Jeszcze żadnego.</div> : lista.map((m) => (
                    <div key={m.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${akt?.id === m.id ? 'bg-amber-900/40' : 'bg-black/30'}`}>
                        <button onClick={() => void otworz(m.id)} className="truncate text-left">„{m.tytul}”{m.autor ? ` — ${m.autor}` : ''} · {m.rodzaj} · {m.scen} scen</button>
                        <span className="ml-auto shrink-0">{ETAPY[m.stan] ?? m.stan}</span>
                        <button onClick={() => void usun(m.id)} title="do kosza" className="shrink-0 opacity-60 hover:opacity-100">🗑</button>
                    </div>
                ))}
            </section>
        </div>
    );
}
