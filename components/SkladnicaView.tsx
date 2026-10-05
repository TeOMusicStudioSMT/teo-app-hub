/**
 * 📦 Składnica Katedry — wspólne assety (`_OtakOs_Assety`) dla Story, Gier, Fashion, Podcastu i Music Studio.
 * Most: services/Skladnica.js, trasy /api/skladnica*.
 *
 * Suweren (2026-10-05): „główny katalog z assetami do postaci i modeli scen, z którego mogą czerpać wszystkie
 * moduły”. Asset = katalog z plikami + karta (nazwa, opis, tagi; postać: rola, kolor, głos). Pliki można też
 * wrzucać Eksploratorem do `_OtakOs_Assety/<rodzaj>/<asset>` — Składnica je widzi. Usunięte idzie do `_kosz`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';

type Rodzaj = 'postacie' | 'sceny' | 'rekwizyty' | 'kreacje' | 'bryly';
interface Plik { nazwa: string; rodzaj: 'obraz' | 'wideo' | 'audio' | 'bryla' | 'inne'; bajtow: number; url: string; sciezka: string }
interface Glos { profil?: string; voicestudio?: string }
interface Asset {
    id: string; rodzaj: Rodzaj; nazwa: string; opis: string; tagi: string[]; kolor: string | null; glos: Glos | null; rola: string;
    glowny: string | null; pliki: Plik[]; katalog: string; zrodlo: string | null;
}
interface RodzajInfo { etykieta: string; ikona: string; opis: string }
interface Glosy { katedra: { id: string; nazwa: string }[]; voicestudio: { profile: { id: string; nazwa: string }[] } }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    let r: Response;
    try { r = await fetch(`${MOST}${sciezka}`, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined }); }
    catch { throw new Error('Most (127.0.0.1:3001) milczy — odpal Katedrę.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) throw new Error(d?.message || `Most odpowiedział HTTP ${r.status}`);
    return d as T;
}
const czytajDataURL = (b: Blob) => new Promise<string>((ok, zle) => {
    const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => zle(r.error ?? new Error('Nie udało się odczytać pliku.')); r.readAsDataURL(b);
});
const rozmiar = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const ilePlikow = (n: number) => `${n} ${n === 1 ? 'plik' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'pliki' : 'plików'}`;
const blad = (e: unknown) => (e instanceof Error ? e.message : String(e));

const btn = 'rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-40';
const pole = 'w-full rounded-lg border border-slate-700 bg-black/60 px-3 py-1.5 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none';

const Miniatura: React.FC<{ plik?: Plik | null; duza?: boolean }> = ({ plik, duza }) => {
    const kl = duza ? 'h-48 w-full' : 'h-28 w-full';
    if (!plik) return <div className={`${kl} flex items-center justify-center rounded-lg bg-slate-900 text-2xl text-slate-600`}>∅</div>;
    if (plik.rodzaj === 'obraz') return <img src={`${MOST}${plik.url}`} alt={plik.nazwa} className={`${kl} rounded-lg object-cover`} loading="lazy" />;
    if (plik.rodzaj === 'wideo') return <video src={`${MOST}${plik.url}`} className={`${kl} rounded-lg object-cover`} muted loop playsInline autoPlay={duza} controls={duza} />;
    return <div className={`${kl} flex items-center justify-center rounded-lg bg-slate-900 text-3xl`}>{plik.rodzaj === 'bryla' ? '🗿' : plik.rodzaj === 'audio' ? '🎵' : '📄'}</div>;
};

export const SkladnicaView: React.FC = () => {
    const [assety, setAssety] = useState<Asset[]>([]);
    const [rodzaje, setRodzaje] = useState<Record<string, RodzajInfo>>({});
    const [katalog, setKatalog] = useState('');
    const [filtr, setFiltr] = useState<Rodzaj | ''>('');
    const [szukaj, setSzukaj] = useState('');
    const [wybrany, setWybrany] = useState<Asset | null>(null);
    const [edycja, setEdycja] = useState({ nazwa: '', opis: '', tagi: '', rola: '', kolor: '#f4c84a', glos: '' });
    const [nowy, setNowy] = useState({ rodzaj: 'postacie' as Rodzaj, nazwa: '' });
    const [imp, setImp] = useState({ sciezka: '', rodzaj: 'sceny' as Rodzaj, tryb: 'podkatalogi' });
    const [zDysku, setZDysku] = useState('');
    const [glosy, setGlosy] = useState<Glosy | null>(null);
    const [praca, setPraca] = useState('');
    const [info, setInfo] = useState<{ ok: boolean; tekst: string } | null>(null);
    const [nadPolem, setNadPolem] = useState(false);
    const plikRef = useRef<HTMLInputElement | null>(null);

    const odswiez = useCallback(async () => {
        try {
            const d = await zMostu<{ assety: Asset[]; rodzaje: Record<string, RodzajInfo>; katalog: string }>('/api/skladnica');
            setAssety(d.assety); setRodzaje(d.rodzaje); setKatalog(d.katalog);
            setWybrany((w) => (w ? d.assety.find((a) => a.rodzaj === w.rodzaj && a.id === w.id) ?? null : null));
        } catch (e) { setInfo({ ok: false, tekst: blad(e) }); }
    }, []);
    useEffect(() => { void odswiez(); zMostu<Glosy>('/api/glos/glosy').then(setGlosy).catch(() => setGlosy(null)); }, [odswiez]);

    useEffect(() => {
        if (!wybrany) return;
        const g = wybrany.glos?.voicestudio ? `vs:${wybrany.glos.voicestudio}` : wybrany.glos?.profil ? `k:${wybrany.glos.profil}` : '';
        setEdycja({ nazwa: wybrany.nazwa, opis: wybrany.opis, tagi: wybrany.tagi.join(', '), rola: wybrany.rola, kolor: wybrany.kolor ?? '#f4c84a', glos: g });
    }, [wybrany]);

    const widoczne = useMemo(() => {
        const q = szukaj.trim().toLowerCase();
        return assety.filter((a) => (!filtr || a.rodzaj === filtr) && (!q || [a.nazwa, a.opis, a.id, ...a.tagi].join(' ').toLowerCase().includes(q)));
    }, [assety, filtr, szukaj]);

    const akcja = async (nazwa: string, f: () => Promise<string | void>) => {
        setPraca(nazwa); setInfo(null);
        try { const t = await f(); if (t) setInfo({ ok: true, tekst: t }); await odswiez(); }
        catch (e) { setInfo({ ok: false, tekst: blad(e) }); }
        finally { setPraca(''); }
    };

    const utworz = () => akcja('nowy', async () => {
        const d = await zMostu<{ asset: Asset }>('/api/skladnica', { method: 'POST', body: JSON.stringify(nowy) });
        setNowy((n) => ({ ...n, nazwa: '' })); setWybrany(d.asset);
        return `Dodano „${d.asset.nazwa}” — wrzuć pliki.`;
    });
    const zapisz = () => wybrany && akcja('zapis', async () => {
        const glos = edycja.glos.startsWith('vs:') ? { voicestudio: edycja.glos.slice(3) } : edycja.glos.startsWith('k:') ? { profil: edycja.glos.slice(2) } : null;
        const d = await zMostu<{ asset: Asset }>('/api/skladnica', { method: 'POST', body: JSON.stringify({
            rodzaj: wybrany.rodzaj, id: wybrany.id, nazwa: edycja.nazwa, opis: edycja.opis, tagi: edycja.tagi,
            ...(wybrany.rodzaj === 'postacie' ? { rola: edycja.rola, kolor: edycja.kolor, glos } : {}),
        }) });
        setWybrany(d.asset);
        return 'Karta zapisana.';
    });
    const wgraj = (pliki: FileList | File[]) => wybrany && akcja('pliki', async () => {
        let n = 0;
        for (const f of Array.from(pliki)) {
            await zMostu(`/api/skladnica/${wybrany.rodzaj}/${encodeURIComponent(wybrany.id)}/plik`, { method: 'POST', body: JSON.stringify({ nazwa: f.name, dataURL: await czytajDataURL(f) }) });
            n++;
        }
        return `Wgrano ${ilePlikow(n)}.`;
    });
    const kopiujZDysku = () => wybrany && zDysku.trim() && akcja('dysk', async () => {
        for (const linia of zDysku.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
            await zMostu(`/api/skladnica/${wybrany.rodzaj}/${encodeURIComponent(wybrany.id)}/plik`, { method: 'POST', body: JSON.stringify({ sciezka: linia }) });
        }
        setZDysku('');
        return 'Skopiowano z dysku (oryginały zostały na miejscu).';
    });
    const ustawGlowny = (plik: string) => wybrany && akcja('glowny', async () => {
        const d = await zMostu<{ asset: Asset }>('/api/skladnica', { method: 'POST', body: JSON.stringify({ rodzaj: wybrany.rodzaj, id: wybrany.id, glowny: plik }) });
        setWybrany(d.asset);
    });
    const usunPlik = (plik: string) => wybrany && window.confirm(`Przenieść „${plik}” do kosza Składnicy?`) && akcja('usun', async () => {
        await zMostu(`/api/skladnica/${wybrany.rodzaj}/${encodeURIComponent(wybrany.id)}/plik?plik=${encodeURIComponent(plik)}`, { method: 'DELETE' });
        return `„${plik}” w koszu (_OtakOs_Assety/_kosz).`;
    });
    const usunAsset = () => wybrany && window.confirm(`Przenieść cały asset „${wybrany.nazwa}” do kosza Składnicy?`) && akcja('usun', async () => {
        await zMostu(`/api/skladnica/${wybrany.rodzaj}/${encodeURIComponent(wybrany.id)}`, { method: 'DELETE' });
        setWybrany(null);
        return 'Asset w koszu (_OtakOs_Assety/_kosz) — da się go stamtąd przywrócić.';
    });
    const importObsady = () => akcja('obsada', async () => {
        const d = await zMostu<{ dodane: string[]; pominiete: { id: string; powod: string }[] }>('/api/skladnica/import/obsada', { method: 'POST', body: '{}' });
        return `Obsada → Składnica: ${d.dodane.length} nowych postaci${d.pominiete.length ? `, ${d.pominiete.length} już było` : ''}.`;
    });
    const importKatalogu = () => imp.sciezka.trim() && akcja('katalog', async () => {
        const d = await zMostu<{ dodane: string[] }>('/api/skladnica/import/katalog', { method: 'POST', body: JSON.stringify({ ...imp, sciezka: imp.sciezka.trim() }) });
        return `Z katalogu: ${d.dodane.length} assetów (${rodzaje[imp.rodzaj]?.etykieta ?? imp.rodzaj}) — kopie, oryginały zostały.`;
    });

    const glowny = wybrany ? wybrany.pliki.find((p) => p.nazwa === wybrany.glowny) ?? null : null;

    return (
        <div className="mx-auto max-w-6xl space-y-4 rounded-2xl border border-amber-500/30 bg-black/50 p-5 text-sm text-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-amber-200">📦 Składnica Katedry</h2>
                    <p className="text-xs text-slate-400">Wspólne postacie, sceny, rekwizyty, kreacje i bryły — dla Story, Gier, Fashion, Podcastu i Music Studio.</p>
                    {katalog && <p className="mt-1 font-mono text-[10px] text-slate-500" data-bez-tlumaczenia>{katalog}</p>}
                </div>
                <button onClick={() => void odswiez()} className={`${btn} border-amber-500/50 text-amber-200 hover:bg-amber-900/40`}>⟳ Odśwież</button>
            </div>

            {info && <div className={`rounded-lg border px-3 py-2 text-xs ${info.ok ? 'border-emerald-600/50 bg-emerald-950/40 text-emerald-200' : 'border-rose-600/50 bg-rose-950/40 text-rose-200'}`}>{info.ok ? '✓' : '⚠'} {info.tekst}</div>}

            <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFiltr('')} className={`${btn} ${!filtr ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-slate-700 text-slate-400'}`}>Wszystko ({assety.length})</button>
                {Object.entries(rodzaje).map(([k, r]) => (
                    <button key={k} onClick={() => setFiltr(k as Rodzaj)} title={r.opis}
                        className={`${btn} ${filtr === k ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-slate-700 text-slate-400'}`}>
                        {r.ikona} {r.etykieta} ({assety.filter((a) => a.rodzaj === k).length})
                    </button>
                ))}
                <input className={`${pole} ml-auto !w-56`} placeholder="Szukaj (nazwa, tag)…" value={szukaj} onChange={(e) => setSzukaj(e.target.value)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
                {/* Siatka */}
                <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {widoczne.map((a) => (
                        <button key={`${a.rodzaj}/${a.id}`} onClick={() => setWybrany(a)}
                            className={`rounded-xl border p-2 text-left transition hover:border-amber-400/70 ${wybrany?.id === a.id && wybrany.rodzaj === a.rodzaj ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                            <Miniatura plik={a.pliki.find((p) => p.nazwa === a.glowny)} />
                            <div className="mt-1.5 flex items-center gap-1.5">
                                {a.kolor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.kolor }} />}
                                <span className="truncate text-xs font-bold text-slate-100">{rodzaje[a.rodzaj]?.ikona} {a.nazwa}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{ilePlikow(a.pliki.length)}{a.tagi.length ? ` · ${a.tagi.slice(0, 3).join(', ')}` : ''}</div>
                        </button>
                    ))}
                    {!widoczne.length && <p className="col-span-full py-8 text-center text-xs text-slate-500">Pusto. Dodaj asset obok, przenieś obsadę albo zaimportuj katalog z dysku.</p>}
                </div>

                {/* Panel boczny */}
                <div className="space-y-3">
                    {wybrany ? (
                        <div className={`space-y-2 rounded-xl border p-3 ${nadPolem ? 'border-amber-300 bg-amber-500/10' : 'border-slate-800 bg-slate-950/60'}`}
                            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setNadPolem(true); } }}
                            onDragLeave={() => setNadPolem(false)}
                            onDrop={(e) => { e.preventDefault(); setNadPolem(false); if (e.dataTransfer.files.length) void wgraj(e.dataTransfer.files); }}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-200">{rodzaje[wybrany.rodzaj]?.ikona} {rodzaje[wybrany.rodzaj]?.etykieta}</span>
                                <button onClick={() => setWybrany(null)} className="text-xs text-slate-500 hover:text-slate-200">✕</button>
                            </div>
                            <Miniatura plik={glowny} duza />
                            <input className={pole} value={edycja.nazwa} onChange={(e) => setEdycja({ ...edycja, nazwa: e.target.value })} placeholder="Nazwa" />
                            <textarea className={`${pole} h-16`} value={edycja.opis} onChange={(e) => setEdycja({ ...edycja, opis: e.target.value })} placeholder="Opis (wygląd, charakter, gdzie się pojawia)" />
                            <input className={pole} value={edycja.tagi} onChange={(e) => setEdycja({ ...edycja, tagi: e.target.value })} placeholder="Tagi po przecinku" />
                            {wybrany.rodzaj === 'postacie' && (
                                <div className="flex gap-2">
                                    <input className={pole} value={edycja.rola} onChange={(e) => setEdycja({ ...edycja, rola: e.target.value })} placeholder="Rola" />
                                    <input type="color" className="h-8 w-10 shrink-0 cursor-pointer rounded bg-transparent" value={edycja.kolor} onChange={(e) => setEdycja({ ...edycja, kolor: e.target.value })} title="Kolor postaci" />
                                    <select className={pole} value={edycja.glos} onChange={(e) => setEdycja({ ...edycja, glos: e.target.value })} title="Głos postaci">
                                        <option value="">— głos —</option>
                                        {(glosy?.katedra ?? []).map((g) => <option key={g.id} value={`k:${g.id}`}>🗣️ {g.nazwa}</option>)}
                                        {(glosy?.voicestudio.profile ?? []).map((g) => <option key={g.id} value={`vs:${g.id}`}>🎛️ {g.nazwa}</option>)}
                                    </select>
                                </div>
                            )}
                            <button onClick={() => void zapisz()} disabled={!!praca} className={`${btn} w-full border-amber-400 bg-amber-500/15 text-amber-100 hover:bg-amber-500/30`}>{praca === 'zapis' ? '…' : '💾 Zapisz kartę'}</button>

                            <div className="space-y-1 pt-1">
                                {wybrany.pliki.map((p) => (
                                    <div key={p.nazwa} className="flex items-center gap-2 rounded-lg bg-black/40 px-2 py-1 text-[11px]">
                                        <span>{{ obraz: '🖼️', wideo: '🎬', audio: '🎵', bryla: '🗿', inne: '📄' }[p.rodzaj]}</span>
                                        <a href={`${MOST}${p.url}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-slate-200 hover:text-cyan-300" data-bez-tlumaczenia>{p.nazwa}</a>
                                        <span className="text-slate-500">{rozmiar(p.bajtow)}</span>
                                        {(p.rodzaj === 'obraz' || p.rodzaj === 'wideo') && (
                                            <button onClick={() => void ustawGlowny(p.nazwa)} title="Główny (miniatura, karta)" className={p.nazwa === wybrany.glowny ? 'text-amber-300' : 'text-slate-600 hover:text-amber-300'}>★</button>
                                        )}
                                        <button onClick={() => void usunPlik(p.nazwa)} title="Do kosza" className="text-slate-600 hover:text-rose-300">🗑</button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => plikRef.current?.click()} disabled={!!praca} className={`${btn} flex-1 border-cyan-500/50 text-cyan-200 hover:bg-cyan-900/40`}>{praca === 'pliki' ? '…' : '⬆ Wgraj pliki'}</button>
                                <input ref={plikRef} type="file" multiple className="hidden" onChange={(e) => { const f = e.target.files; if (f?.length) void wgraj(Array.from(f)); e.target.value = ''; }} />
                            </div>
                            <p className="text-[10px] text-slate-500">…albo przeciągnij pliki tutaj, albo wklej ścieżki z dysku (po jednej w linii — Katedra robi kopię):</p>
                            <div className="flex gap-2">
                                <textarea className={`${pole} h-12`} value={zDysku} onChange={(e) => setZDysku(e.target.value)} placeholder={'"F:\\…\\Teogachi2.png"'} />
                                <button onClick={() => void kopiujZDysku()} disabled={!!praca || !zDysku.trim()} className={`${btn} border-slate-600 text-slate-200`}>⤵</button>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <span className="truncate font-mono text-[9px] text-slate-600" title={wybrany.katalog} data-bez-tlumaczenia>{wybrany.katalog}</span>
                                <button onClick={() => void usunAsset()} disabled={!!praca} className="text-[11px] text-slate-500 hover:text-rose-300">🗑 do kosza</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                            <span className="text-xs font-bold text-amber-200">＋ Nowy asset</span>
                            <div className="flex gap-2">
                                <select className={`${pole} !w-36`} value={nowy.rodzaj} onChange={(e) => setNowy({ ...nowy, rodzaj: e.target.value as Rodzaj })}>
                                    {Object.entries(rodzaje).map(([k, r]) => <option key={k} value={k}>{r.ikona} {r.etykieta}</option>)}
                                </select>
                                <input className={pole} value={nowy.nazwa} onChange={(e) => setNowy({ ...nowy, nazwa: e.target.value })} placeholder="Nazwa (np. Aria Thorne)" onKeyDown={(e) => { if (e.key === 'Enter' && nowy.nazwa.trim()) void utworz(); }} />
                            </div>
                            <button onClick={() => void utworz()} disabled={!!praca || !nowy.nazwa.trim()} className={`${btn} w-full border-amber-400 bg-amber-500/15 text-amber-100`}>Dodaj</button>
                        </div>
                    )}

                    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <span className="text-xs font-bold text-slate-200">⤵ Wnieś to, co już masz</span>
                        <button onClick={() => void importObsady()} disabled={!!praca} className={`${btn} w-full border-fuchsia-500/50 text-fuchsia-200 hover:bg-fuchsia-900/30`}>
                            {praca === 'obsada' ? '…' : '🎭 Obsada aktorów → Postacie'}
                        </button>
                        <input className={pole} value={imp.sciezka} onChange={(e) => setImp({ ...imp, sciezka: e.target.value })} placeholder={'Katalog z dysku, np. "F:\\TeO_Genesis\\_OtakOs_Wymiar\\aktorzy\\wywiady\\studio"'} />
                        <div className="flex gap-2">
                            <select className={pole} value={imp.rodzaj} onChange={(e) => setImp({ ...imp, rodzaj: e.target.value as Rodzaj })}>
                                {Object.entries(rodzaje).map(([k, r]) => <option key={k} value={k}>{r.ikona} {r.etykieta}</option>)}
                            </select>
                            <select className={pole} value={imp.tryb} onChange={(e) => setImp({ ...imp, tryb: e.target.value })}>
                                <option value="podkatalogi">każdy podkatalog = asset</option>
                                <option value="pliki">każdy plik = asset</option>
                                <option value="folder">cały katalog = jeden asset</option>
                            </select>
                        </div>
                        <button onClick={() => void importKatalogu()} disabled={!!praca || !imp.sciezka.trim()} className={`${btn} w-full border-slate-600 text-slate-200 hover:bg-slate-800`}>{praca === 'katalog' ? '…' : '📁 Importuj katalog (kopie)'}</button>
                        <p className="text-[10px] text-slate-500">Importuje obrazy, klipy, dźwięki i bryły 3D. Oryginały zostają na miejscu.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SkladnicaView;
