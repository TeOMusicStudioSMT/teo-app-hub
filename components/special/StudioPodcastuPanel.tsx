/**
 * 🎛️ STUDIO PODCASTU — zakładka w panelu mikrofonu (Podcast Twin). Dawniej karta na Dashboardzie (2026-10-04:
 * Suweren „przeniósłbym to do menu prawego »mikrofon« i tam w zakładce”).
 *
 * Wszystko prawdziwe (services/StudioPodcastu.js):
 *   · STUDIA — pierwsze („teo”) z paczki zdjęć Suwerena + własne studia z własnym prowadzącym (inni tworzą swoje),
 *   · film wstępowy z nagraniem prowadzącego, klon jego głosu (silnik klonu instalowany tu, za zgodą na licencję),
 *   · odcinek: temat + goście z bazy aktorów, STYL rozmowy, PRALKA (temperatura 1–9), PL/EN,
 *     DOGRYWKA (kolejne rundy wydłużające materiał), nagranie → montaże projektu studia (Montażownia, publikacja).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Settings2, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface Glos { profil?: string; voicestudio?: string }
interface Ujecie { id: string; nazwa: string }
interface Studio {
    nazwa: string; opis: string;
    prowadzacy: { imie: string; rola: string; kolor: string; zdjecie: string | null; glos: Glos | null };
    ujecia: Ujecie[];
    wstep: { nagranie: string | null; tekst: string; plik: string | null; sekundy: number | null; zrobiono: string | null; napisy?: boolean; blad?: string };
}
interface Aktor { id: string; imie: string; rola: string; kolor: string; projekt?: string | null; zdjecie?: string | null; wideo?: string | null; glos?: Glos | null }
interface Kwestia { kto: string; tekst: string }
interface Odcinek { id: string; tytul: string; temat: string; goscie: string[]; goscieFilm?: string; kwestie: Kwestia[]; etap: string; blad?: string; plik?: string; sekundy?: number | null; postep?: { etap: string; zrobione: number; wszystkich: number }; bezGlosu?: boolean; jezyk?: 'pl' | 'en'; styl?: string; pralka?: number | null; rundy?: number }
interface Stan { studio: Studio; postepWstepu: { etap: string } | null; aktorzy: Aktor[] }
interface SkrotStudia { id: string; nazwa: string; prowadzacy: string; kolor: string; ujec: number; odcinkow: number; domyslne: boolean }
interface Silnik { silnik: { uruchomiony?: boolean; powod?: string; model?: string | null }; instalacja: { stan: string; etap: string | null; log: string[]; blad: string | null; cuda: boolean | null }; zgoda: boolean; licencja: string }
interface Glosy { katedra: { id: string; nazwa: string; przewod: string }[]; voicestudio: { zywe: boolean; profile: { id: string; nazwa: string }[] } }

async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}
const blad = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); toast.error(m, { id: `studio-${m.slice(0, 60)}`, duration: 8000 }); };
const tekstKwestii = (k: Kwestia[]) => k.map((x) => `${x.kto}: ${x.tekst}`).join('\n');
const zTekstu = (t: string): Kwestia[] => t.split('\n').map((l) => l.match(/^\s*([a-z0-9-]+)\s*:\s*(.+)$/i)).filter((m): m is RegExpMatchArray => !!m).map((m) => ({ kto: m[1], tekst: m[2].trim() }));
const glosNaWartosc = (g: Glos | null | undefined) => (g?.voicestudio ? `vs:${g.voicestudio}` : g?.profil ? `k:${g.profil}` : '');
const wartoscNaGlos = (v: string): Glos | null => (v.startsWith('vs:') ? { voicestudio: v.slice(3) } : v.startsWith('k:') ? { profil: v.slice(2) } : null);
const PRALKA_OPIS = ['domyślna temperatura modelu', 'spokojnie, przewidywalnie', 'stonowanie', 'rozważnie', 'pewnie', 'zwykle', 'żywo', 'odważnie', 'iskrząco', 'szalona wena'];

const pole = 'rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200';
const guzik = 'rounded border px-2 py-1 disabled:opacity-40';

export const StudioPodcastuPanel: React.FC = () => {
    const [studia, setStudia] = useState<SkrotStudia[]>([]);
    const [style, setStyle] = useState<{ id: string; nazwa: string }[]>([]);
    const [idStudia, setIdStudia] = useState(() => { try { return localStorage.getItem('teo_studio_podcast') || 'teo'; } catch { return 'teo'; } });
    const [stan, setStan] = useState<Stan | null>(null);
    const [most, setMost] = useState<'zyje' | 'stary' | 'milczy' | null>(null);
    const [odcinki, setOdcinki] = useState<Odcinek[]>([]);
    const [silnik, setSilnik] = useState<Silnik | null>(null);
    const [glosy, setGlosy] = useState<Glosy | null>(null);
    const [napisy, setNapisy] = useState('');
    const [temat, setTemat] = useState('');
    const [goscie, setGoscie] = useState<string[]>([]);
    const [uwagi, setUwagi] = useState('');
    const [jezyk, setJezyk] = useState<'pl' | 'en'>('pl');
    const [styl, setStyl] = useState('domyslny');
    const [pralka, setPralka] = useState(0);
    const [bezGlosu, setBezGlosu] = useState(false);
    const [wstepem, setWstepem] = useState(true);
    const [zGoscmi, setZGoscmi] = useState(true);
    const [praca, setPraca] = useState<string | null>(null);
    const [edycja, setEdycja] = useState<Record<string, string>>({});
    const [rundy, setRundy] = useState<Record<string, number>>({});
    const [zgoda, setZgoda] = useState(false);
    const [nowe, setNowe] = useState<{ nazwa: string; opis: string; imie: string; rola: string; kolor: string } | null>(null);
    const [ustawienia, setUstawienia] = useState(false);
    const [host, setHost] = useState({ imie: '', rola: '', kolor: '#22d3ee', zdjecie: '', glos: '', nagranie: '', ujecie: '' });
    const napisyWpisane = useRef<string | null>(null);
    const q = `studio=${encodeURIComponent(idStudia)}`;

    const odswiez = useCallback(async () => {
        try {
            const lista = await zMostu<{ studia: SkrotStudia[]; style: { id: string; nazwa: string }[] }>('/api/studio-podcast/studia');
            setStudia(lista.studia); setStyle(lista.style);
            const id = lista.studia.some((s) => s.id === idStudia) ? idStudia : 'teo';
            if (id !== idStudia) { setIdStudia(id); return; }
            const s = await zMostu<Stan>(`/api/studio-podcast?studio=${encodeURIComponent(id)}`);
            setStan(s); setMost('zyje');
            if (napisyWpisane.current !== id) {
                setNapisy(s.studio.wstep.tekst ?? '');
                setHost({ imie: s.studio.prowadzacy.imie, rola: s.studio.prowadzacy.rola, kolor: s.studio.prowadzacy.kolor, zdjecie: '', glos: glosNaWartosc(s.studio.prowadzacy.glos), nagranie: '', ujecie: '' });
                if (!s.studio.wstep.nagranie) setWstepem(false);
                napisyWpisane.current = id;
            }
            setOdcinki((await zMostu<{ odcinki: Odcinek[] }>(`/api/studio-podcast/odcinki?studio=${encodeURIComponent(id)}`)).odcinki);
            zMostu<Silnik>('/api/glos/silnik').then(setSilnik).catch(() => setSilnik(null));
            zMostu<Glosy>('/api/glos/glosy').then(setGlosy).catch(() => setGlosy(null));
        } catch (e) { setMost(/HTTP 404/.test(String(e)) ? 'stary' : 'milczy'); }
    }, [idStudia]);
    useEffect(() => { void odswiez(); }, [odswiez]);
    useEffect(() => { try { localStorage.setItem('teo_studio_podcast', idStudia); } catch { /* bez pamięci */ } }, [idStudia]);
    const trwa = !!stan?.postepWstepu || odcinki.some((o) => o.etap === 'nagrywa') || silnik?.instalacja.stan === 'trwa';
    useEffect(() => { if (!trwa) return undefined; const t = setInterval(() => void odswiez(), 2500); return () => clearInterval(t); }, [trwa, odswiez]);

    const akcja = async (nazwa: string, f: () => Promise<unknown>, ok?: string) => {
        setPraca(nazwa);
        try { await f(); if (ok) toast.success(ok); await odswiez(); } catch (e) { blad(e); } finally { setPraca(null); }
    };
    const post = (sciezka: string, body: unknown) => zMostu(`${sciezka}${sciezka.includes('?') ? '&' : '?'}${q}`, { method: 'POST', body: JSON.stringify(body) });

    const zrobWstep = () => akcja('wstep', () => post('/api/studio-podcast/wstep', { tekst: napisy }), 'Film wstępowy rusza w tle.');
    const klonujGlos = () => akcja('glos', () => post('/api/studio-podcast/glos-prowadzacego', {}), 'Głos prowadzącego sklonowany z nagrania.');
    const przygotuj = () => akcja('scenariusz', async () => {
        const d = await post('/api/studio-podcast/odcinki/przygotuj', { temat, goscie, uwagi, jezyk, styl, pralka: pralka || null }) as { odcinek: Odcinek };
        setEdycja((e) => ({ ...e, [d.odcinek.id]: tekstKwestii(d.odcinek.kwestie) }));
    }, 'Scenariusz gotowy — przeczytaj i popraw.');
    const zapiszPoprawki = async (o: Odcinek) => {
        const t = edycja[o.id];
        if (t !== undefined && t !== tekstKwestii(o.kwestie)) await post(`/api/studio-podcast/odcinki/${o.id}/zmien`, { kwestie: zTekstu(t) });
    };
    const nagraj = (o: Odcinek) => akcja(o.id, async () => {
        await zapiszPoprawki(o);
        await post(`/api/studio-podcast/odcinki/${o.id}/nagraj`, { bezGlosu, zWstepem: wstepem, zGoscmi });
    }, 'Nagrywam odcinek w tle.');
    const dogrywka = (o: Odcinek) => akcja(`d-${o.id}`, async () => {
        await zapiszPoprawki(o);
        const d = await post(`/api/studio-podcast/odcinki/${o.id}/dogrywka`, { rundy: rundy[o.id] ?? 1, styl, pralka: pralka || null }) as { odcinek: Odcinek };
        setEdycja((e) => ({ ...e, [o.id]: tekstKwestii(d.odcinek.kwestie) }));
    }, 'Dogrywka dopisana — rozmowa dłuższa.');
    const instalujSilnik = () => akcja('silnik', () => zMostu('/api/glos/silnik/instaluj', { method: 'POST', body: JSON.stringify({ zgodaLicencji: zgoda }) }), 'Instalacja silnika klonu ruszyła w tle (kilka–kilkanaście minut).');
    const stworzStudio = () => nowe && akcja('nowe', async () => {
        const d = await zMostu<{ studio: SkrotStudia }>('/api/studio-podcast/studia', { method: 'POST', body: JSON.stringify({ nazwa: nowe.nazwa, opis: nowe.opis, prowadzacy: { imie: nowe.imie, rola: nowe.rola, kolor: nowe.kolor } }) });
        setNowe(null); setUstawienia(true); napisyWpisane.current = null; setIdStudia(d.studio.id);
    }, 'Nowe studio gotowe — dodaj zdjęcia sceny i nagranie prowadzącego.');
    const usunStudio = () => { if (window.confirm(`Usunąć studio „${stan?.studio.nazwa}”? Zdjęcia i odcinki robocze znikną; gotowe filmy zostają w Montażowni.`)) void akcja('usun', async () => { await zMostu(`/api/studio-podcast/studia/${encodeURIComponent(idStudia)}`, { method: 'DELETE' }); setIdStudia('teo'); }, 'Studio usunięte.'); };
    const zapiszHosta = () => akcja('host', async () => {
        await post('/api/studio-podcast', { prowadzacy: { imie: host.imie, rola: host.rola, kolor: host.kolor, ...(host.zdjecie.trim() ? { zdjecie: host.zdjecie.trim() } : {}), glos: wartoscNaGlos(host.glos) }, ...(host.nagranie.trim() ? { nagranieWstepu: host.nagranie.trim() } : {}) });
        setHost((h) => ({ ...h, zdjecie: '', nagranie: '' }));
    }, 'Prowadzący zapisany.');
    const dodajUjecie = () => akcja('ujecie', async () => { await post('/api/studio-podcast/ujecie', { plik: host.ujecie.trim() }); setHost((h) => ({ ...h, ujecie: '' })); }, 'Ujęcie dodane.');

    const w = stan?.studio.wstep;
    const glosOpis = (g: Glos | null | undefined) => (g?.voicestudio ? `VoiceStudio: ${glosy?.voicestudio.profile.find((p) => p.id === g.voicestudio)?.nazwa ?? g.voicestudio}` : g?.profil ? `Katedra: ${g.profil}` : 'tor domyślny (klon-lokalny)');
    const imie = (id: string) => (id === 'prowadzacy' ? stan?.studio.prowadzacy.imie : stan?.aktorzy.find((a) => a.id === id)?.imie) ?? id;
    const klonDziala = !!silnik?.silnik.uruchomiony && silnik.silnik.model !== 'blad';
    const opcjeGlosow = (
        <>
            <option value="">tor domyślny (klon-lokalny)</option>
            {!!glosy?.katedra.length && <optgroup label="Katedra">{glosy.katedra.map((p) => <option key={p.id} value={`k:${p.id}`}>{p.nazwa} ({p.przewod})</option>)}</optgroup>}
            {glosy?.voicestudio.zywe ? <optgroup label="VoiceStudio">{glosy.voicestudio.profile.map((p) => <option key={p.id} value={`vs:${p.id}`}>{p.nazwa}</option>)}</optgroup> : <option value="" disabled>VoiceStudio nie odpowiada</option>}
        </>
    );

    return (
        <div className="w-full max-w-4xl mx-auto rounded-3xl border border-cyan-500/25 bg-[#05080d] p-4 text-[11px] text-slate-300">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-base font-black tracking-widest text-cyan-300">🎛️ STUDIO PODCASTU</h2>
                <select value={idStudia} onChange={(e) => { napisyWpisane.current = null; setIdStudia(e.target.value); }} className={pole}>
                    {studia.map((s) => <option key={s.id} value={s.id}>{s.nazwa} · {s.prowadzacy} ({s.odcinkow} odc.)</option>)}
                </select>
                <button onClick={() => setNowe(nowe ? null : { nazwa: '', opis: '', imie: '', rola: '', kolor: '#a855f7' })} className={`${guzik} border-emerald-500/40 text-emerald-200`}><Plus className="mr-1 inline h-3 w-3" />Nowe studio</button>
                <button onClick={() => setUstawienia((u) => !u)} className={`${guzik} border-slate-600 text-slate-300`}><Settings2 className="mr-1 inline h-3 w-3" />Prowadzący i scena</button>
                {idStudia !== 'teo' && <button onClick={usunStudio} className={`${guzik} border-red-500/40 text-red-300`} title="Usuń to studio"><Trash2 className="inline h-3 w-3" /></button>}
            </div>
            {most === 'stary' && <p className="text-amber-200">Most sprzed restartu — nie zna jeszcze wielu studiów. Zrestartuj Katedrę.</p>}
            {most === 'milczy' && <p className="text-slate-400">Most Katedry nie odpowiada — Studio działa tylko przy maszynie.</p>}

            {nowe && (
                <div className="mb-3 grid gap-2 rounded-lg border border-emerald-500/30 p-3 md:grid-cols-2">
                    <input value={nowe.nazwa} onChange={(e) => setNowe({ ...nowe, nazwa: e.target.value })} placeholder="Nazwa studia (np. Nocne Radio Miry)" className={pole} />
                    <input value={nowe.opis} onChange={(e) => setNowe({ ...nowe, opis: e.target.value })} placeholder="Opis sceny (dla scenarzysty)" className={pole} />
                    <input value={nowe.imie} onChange={(e) => setNowe({ ...nowe, imie: e.target.value })} placeholder="Prowadzący — imię" className={pole} />
                    <div className="flex gap-2"><input value={nowe.rola} onChange={(e) => setNowe({ ...nowe, rola: e.target.value })} placeholder="Jak prowadzi (rola)" className={`${pole} flex-1`} /><input type="color" value={nowe.kolor} onChange={(e) => setNowe({ ...nowe, kolor: e.target.value })} className="h-7 w-10" /></div>
                    <button disabled={!!praca || !nowe.nazwa.trim() || !nowe.imie.trim()} onClick={stworzStudio} className={`${guzik} border-emerald-500/40 text-emerald-200 md:col-span-2`}>{praca === 'nowe' ? 'tworzę…' : '➕ Utwórz studio'}</button>
                </div>
            )}

            {stan && (
                <div className="flex flex-col gap-3">
                    <p className="leading-relaxed text-slate-400">{stan.studio.nazwa} · prowadzi <b style={{ color: stan.studio.prowadzacy.kolor }}>{stan.studio.prowadzacy.imie}</b> · głos: {glosOpis(stan.studio.prowadzacy.glos)} · {stan.studio.ujecia.length} ujęć · goście z bazy aktorów ({stan.aktorzy.length}).</p>

                    {silnik && !klonDziala && (
                        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-100">
                            <p>⚠ Silnik klonu Katedry (:5002) nie mówi{silnik.silnik.powod ? ` — ${silnik.silnik.powod}` : ''}. Głosy „tor domyślny / Katedra” nie zabrzmią — wybierz profil VoiceStudio albo zainstaluj silnik.</p>
                            {silnik.instalacja.stan === 'trwa' ? (
                                <p className="mt-1 text-cyan-200"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Instaluję: {silnik.instalacja.etap} <span className="text-slate-400">· {silnik.instalacja.log.at(-1)}</span></p>
                            ) : (
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <label className="text-[10px] text-amber-200"><input type="checkbox" checked={zgoda} onChange={(e) => setZgoda(e.target.checked)} /> Akceptuję {silnik.licencja} (XTTS-v2 — tylko użycie niekomercyjne)</label>
                                    <button disabled={!zgoda || !!praca} onClick={instalujSilnik} className={`${guzik} border-amber-400/60 text-amber-100`}>{praca === 'silnik' ? '…' : '🛠️ Zainstaluj silnik klonu'}</button>
                                </div>
                            )}
                            {silnik.instalacja.stan === 'blad' && <p className="mt-1 text-red-300">✕ {silnik.instalacja.blad}</p>}
                            {silnik.instalacja.stan === 'gotowe' && <p className="mt-1 text-emerald-300">✓ Zainstalowany ({silnik.instalacja.cuda ? 'karta graficzna' : 'procesor'}) — pierwszy start pobiera model (~1,8 GB), potem mówi.</p>}
                        </div>
                    )}

                    {ustawienia && (
                        <div className="grid gap-2 rounded-lg border border-slate-600 p-3 md:grid-cols-2">
                            <input value={host.imie} onChange={(e) => setHost({ ...host, imie: e.target.value })} placeholder="Imię prowadzącego" className={pole} />
                            <div className="flex gap-2"><input value={host.rola} onChange={(e) => setHost({ ...host, rola: e.target.value })} placeholder="Jak prowadzi" className={`${pole} flex-1`} /><input type="color" value={host.kolor} onChange={(e) => setHost({ ...host, kolor: e.target.value })} className="h-7 w-10" /></div>
                            <input value={host.zdjecie} onChange={(e) => setHost({ ...host, zdjecie: e.target.value })} placeholder="Zdjęcie prowadzącego — ścieżka (png/jpg)" className={pole} />
                            <input value={host.nagranie} onChange={(e) => setHost({ ...host, nagranie: e.target.value })} placeholder={w?.nagranie ? 'Nagranie wstępu — nowa ścieżka (mp3/wav)' : 'Nagranie wstępu — ścieżka (mp3/wav)'} className={pole} />
                            <select value={host.glos} onChange={(e) => setHost({ ...host, glos: e.target.value })} className={pole}>{opcjeGlosow}</select>
                            <button disabled={!!praca || !host.imie.trim()} onClick={zapiszHosta} className={`${guzik} border-cyan-500/40 text-cyan-200`}>{praca === 'host' ? '…' : '💾 Zapisz prowadzącego'}</button>
                            <input value={host.ujecie} onChange={(e) => setHost({ ...host, ujecie: e.target.value })} placeholder="Nowe ujęcie sceny — ścieżka do zdjęcia (najlepiej panorama)" className={pole} />
                            <button disabled={!!praca || !host.ujecie.trim()} onClick={dodajUjecie} className={`${guzik} border-cyan-500/40 text-cyan-200`}>{praca === 'ujecie' ? '…' : '🖼️ Dodaj ujęcie'}</button>
                            {stan.studio.ujecia.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 md:col-span-2">
                                    {stan.studio.ujecia.map((u) => <button key={u.id} disabled={!!praca || stan.studio.ujecia.length <= 1} onClick={() => akcja('ujecie', () => zMostu(`/api/studio-podcast/ujecie/${u.id}?${q}`, { method: 'DELETE' }), 'Ujęcie usunięte.')} className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-40" title="Usuń ujęcie">✕ {u.nazwa}</button>)}
                                </div>
                            )}
                        </div>
                    )}

                    {stan.studio.ujecia.length === 0 ? (
                        <p className="rounded border border-slate-700 p-2 text-slate-400">To studio nie ma jeszcze zdjęć sceny — dodaj ujęcia w „Prowadzący i scena”. Bez nich odcinek się nie nagra.</p>
                    ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                            {stan.studio.ujecia.slice(0, 6).map((u) => <img key={u.id} src={`${MOST}/api/studio-podcast/plik/ujecie/${u.id}?${q}`} alt={u.nazwa} title={u.nazwa} className="aspect-video w-full rounded border border-slate-700 object-cover" />)}
                        </div>
                    )}

                    <details className="rounded-lg border border-cyan-500/25 p-2">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-cyan-300">🎬 Film wstępowy {w?.plik ? `· gotowy (${w.sekundy?.toFixed(1)} s${w.napisy ? ', z napisami' : ''})` : w?.nagranie ? '· jeszcze nie zrobiony' : '· brak nagrania prowadzącego'}</summary>
                        <div className="mt-2 flex flex-col gap-2">
                            {w?.nagranie && <audio controls src={`${MOST}/api/studio-podcast/plik/nagranie?${q}`} className="h-8 w-full" />}
                            <textarea value={napisy} rows={3} onChange={(e) => setNapisy(e.target.value)} placeholder="Tekst nagrania (opcjonalnie) — napisy rozłożone na czas nagrania." className={pole} />
                            <div className="flex flex-wrap gap-2">
                                <button disabled={!!praca || !!stan.postepWstepu || !w?.nagranie} onClick={zrobWstep} className={`${guzik} border-cyan-500/40 text-cyan-200`}>{stan.postepWstepu ? <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />robię wstęp…</> : '🎬 Zrób film wstępowy'}</button>
                                <button disabled={!!praca || !w?.nagranie} onClick={klonujGlos} className={`${guzik} border-fuchsia-500/40 text-fuchsia-200`} title={klonDziala ? '' : 'Profil powstanie, ale zabrzmi dopiero przy działającym silniku klonu'}>🎙️ Sklonuj głos z nagrania</button>
                            </div>
                            {w?.blad && <p className="text-amber-300">⚠ {w.blad}</p>}
                            {w?.plik && <video controls src={`${MOST}/api/studio-podcast/plik/wstep?${q}&v=${encodeURIComponent(w.zrobiono ?? '')}`} className="w-full rounded border border-slate-700" />}
                        </div>
                    </details>

                    <details className="rounded-lg border border-emerald-500/25 p-2" open>
                        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-emerald-300">🗣️ Nowy odcinek</summary>
                        <div className="mt-2 flex flex-col gap-2">
                            <input value={temat} onChange={(e) => setTemat(e.target.value)} placeholder="Temat odcinka" className={pole} />
                            <div className="flex flex-wrap gap-1.5">
                                {stan.aktorzy.length === 0 && <span className="text-slate-500">Baza aktorów jest pusta — dodaj aktorów w TeO Story Studio → Aktorzy.</span>}
                                {stan.aktorzy.filter((a) => a.id !== 'kronikarz').map((a) => (
                                    <button key={a.id} onClick={() => setGoscie((g) => (g.includes(a.id) ? g.filter((x) => x !== a.id) : g.length < 3 ? [...g, a.id] : g))} title={`${a.rola} · głos: ${glosOpis(a.glos)}`}
                                        className={`rounded-full border px-2 py-0.5 ${goscie.includes(a.id) ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100' : 'border-slate-700 text-slate-400'}`}>{a.wideo ? '🎞️ ' : ''}{a.imie}</button>
                                ))}
                            </div>
                            <input value={uwagi} onChange={(e) => setUwagi(e.target.value)} placeholder="Uwagi dla scenarzysty (opcjonalnie)" className={pole} />
                            <div className="grid gap-2 md:grid-cols-3">
                                <label className="flex items-center gap-2">Styl
                                    <select value={styl} onChange={(e) => setStyl(e.target.value)} className={`${pole} flex-1`}>{style.map((s) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}</select>
                                </label>
                                <label className="flex items-center gap-2" title="Suwak jak w Pralce: temperatura modelu (0 = domyślna)">🧺 Pralka {pralka || '—'}
                                    <input type="range" min={0} max={9} value={pralka} onChange={(e) => setPralka(Number(e.target.value))} className="flex-1 accent-orange-500" />
                                </label>
                                <div className="flex items-center gap-1">Język
                                    {(['pl', 'en'] as const).map((j) => <button key={j} onClick={() => setJezyk(j)} className={`rounded px-2 py-0.5 font-bold ${jezyk === j ? 'bg-cyan-500/25 text-cyan-100' : 'text-slate-500'}`}>{j.toUpperCase()}</button>)}
                                </div>
                            </div>
                            <p className="text-[10px] text-orange-300/70">🧺 {PRALKA_OPIS[pralka]}</p>
                            <div className="flex flex-wrap items-center gap-3">
                                <button disabled={!!praca || !temat.trim() || !goscie.length} onClick={przygotuj} className={`${guzik} border-emerald-500/40 text-emerald-200`}>{praca === 'scenariusz' ? 'piszę…' : '✍️ Napisz scenariusz'}</button>
                                <label className="text-slate-400"><input type="checkbox" checked={zGoscmi} onChange={(e) => setZGoscmi(e.target.checked)} /> wideo z gośćmi</label>
                                <label className="text-slate-400"><input type="checkbox" checked={wstepem} disabled={!w?.nagranie} onChange={(e) => setWstepem(e.target.checked)} /> ze wstępem</label>
                                <label className="text-slate-400"><input type="checkbox" checked={bezGlosu} onChange={(e) => setBezGlosu(e.target.checked)} /> bez głosu (same napisy)</label>
                            </div>
                        </div>
                    </details>

                    {odcinki.map((o) => (
                        <div key={o.id} className="rounded-lg border border-slate-700 p-2">
                            <div className="flex items-center justify-between gap-2"><b className="text-slate-200">{o.tytul}</b><span className="text-[10px] text-slate-500">{o.goscie.map(imie).join(', ')} · {(o.jezyk ?? 'pl').toUpperCase()} · {style.find((s) => s.id === o.styl)?.nazwa ?? 'domyślny'}{o.pralka ? ` · 🧺${o.pralka}` : ''} · rund {o.rundy ?? 1} · {o.kwestie.length} kwestii · {o.etap}</span></div>
                            {o.etap === 'nagrywa' && <p className="mt-1 text-cyan-300"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />{o.postep ? `${o.postep.etap} (${o.postep.zrobione}/${o.postep.wszystkich})` : 'nagrywam…'}</p>}
                            {o.etap === 'blad' && <p className="mt-1 text-amber-300">⚠ {o.blad}</p>}
                            {o.etap === 'gotowy' && o.plik && <video controls src={`${MOST}/api/studio-podcast/plik/odcinek/${o.id}?${q}`} className="mt-1 w-full rounded border border-slate-700" />}
                            {o.etap === 'gotowy' && <p className="mt-1 text-[10px] text-emerald-300">✓ {o.sekundy?.toFixed(1)} s · w montażach projektu studia — stamtąd „📺 do publikacji”.</p>}
                            {o.etap !== 'nagrywa' && o.etap !== 'gotowy' && (
                                <>
                                    <textarea value={edycja[o.id] ?? tekstKwestii(o.kwestie)} rows={Math.min(14, o.kwestie.length + 1)} onChange={(e) => setEdycja((x) => ({ ...x, [o.id]: e.target.value }))} className={`mt-1 w-full font-mono text-[10px] ${pole}`} />
                                    <p className="text-[10px] text-slate-500">Format „id: kwestia” (id: prowadzacy albo id aktora). Poprawki zapiszą się przy nagrywaniu i dogrywce.</p>
                                    {o.goscieFilm && <video controls src={`${MOST}/api/studio-podcast/plik/goscie/${o.id}?${q}&v=${encodeURIComponent(o.goscieFilm)}`} className="mt-1 w-full rounded border border-slate-700" />}
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <select value={rundy[o.id] ?? 1} onChange={(e) => setRundy((r) => ({ ...r, [o.id]: Number(e.target.value) }))} className={pole} title="Ile rund dopisać">{[1, 2, 3].map((n) => <option key={n} value={n}>+{n} {n === 1 ? 'runda' : 'rundy'}</option>)}</select>
                                        <button disabled={!!praca || (o.rundy ?? 1) >= 6} onClick={() => dogrywka(o)} className={`${guzik} border-orange-500/40 text-orange-200`} title="Dopisuje dalszy ciąg rozmowy obecnym stylem i Pralką (limit 6 rund)"><Repeat className="mr-1 inline h-3 w-3" />{praca === `d-${o.id}` ? 'dopisuję…' : 'Dogrywka'}</button>
                                        <button disabled={!!praca} onClick={() => akcja(`g-${o.id}`, () => post(`/api/studio-podcast/odcinki/${o.id}/goscie`, { bezGlosu }), 'Wideo z gośćmi gotowe.')} className={`${guzik} border-fuchsia-500/40 text-fuchsia-200`}>{praca === `g-${o.id}` ? 'robię…' : '👥 Wideo z gośćmi'}</button>
                                        <button disabled={!!praca} onClick={() => nagraj(o)} className={`${guzik} border-cyan-500/40 text-cyan-200`}>🎥 Nagraj odcinek</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudioPodcastuPanel;
