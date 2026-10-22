/**
 * 🎪 TeO Game Show w Impresariacie (2026-10-13) — odcinki składane z nagrań Tanecznego Starcia
 * (services/TeoGameShow.js): etapy intro → konkurencja → finał → sklejenie → publikacja, „↻ Ponów” / „bez intro”,
 * kanał programu (dedykowany kanał YouTube), karta zarządzania na Stół, instrukcja kanału, inne sieci (niepodłączone).
 * ✓ samej publikacji jest wyżej — w „Publikacjach YouTube od stada” (i w Izbie na telefonie).
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';
async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}

interface Etap { stan: string; powod?: string }
interface Odcinek {
    id: string; stan: string; powod: string | null; jezyk?: string; silnikIntro?: string; klockiDoklejone?: { start: string[]; end: string[] }; utworzono: string; plik: string | null; uwagi: string[];
    tancerz: { imie: string }; utwor: { tytul: string; bpm: number | null }; ocena: { wynik: number }; konkurencja: { nazwa: string };
    etapy: Record<string, Etap>; publikacja: { id: string; tytul: string | null; kanalNazwa: string | null } | null;
}
interface Kanal { kanalId: string | null; kanalNazwa: string | null; zapamietany: string | null }
interface Stan { odcinki: Odcinek[]; kanal: Kanal; inneSieci: { siec: string; stan: string; powod: string }[]; instrukcja: string[]; automat: boolean; ustawienia?: { jezyk: string; silnikIntro?: string; playlista: string | null; playlistaTytul: string | null; playlistaKanal: string | null; playlisty?: { id: string; kanal: string | null; tytul: string | null }[]; kanalyDodatkowe?: string[] }; jezyki?: Record<string, string>; silnikiIntro?: Record<string, string> }
const FLAGA: Record<string, string> = { en: '🇬🇧', pl: '🇵🇱' };
interface KanalYT { id: string; nazwa: string }
interface UtworSuno { id: string; tytul: string; sekundy: number | null; bpm: number | null; stan: string; powod?: string; plik?: string }
interface AlbumSunoStan { album: string | null; nazwa?: string; katalog?: string; utwory?: UtworSuno[]; sprawdzono?: string; blad?: string | null }
const ZNAK_SUNO: Record<string, string> = { 'na-dysku': '✓', pobrany: '⬇ nowy', prywatny: '🔒 prywatny' };

const ETAPY: [string, string][] = [['intro', '🎬 intro'], ['konkurencja', '🏷️ konkurencja'], ['final', '🏆 finał'], ['sklejanie', '🧱 sklejenie'], ['publikacja', '✍️ Kronikarz']];
const ZNAK: Record<string, string> = { czeka: '·', robi: '⏳', gotowy: '✓', blad: '⚠', pominiety: '—' };
const STAN: Record<string, string> = { w_kolejce: '⏳ w kolejce', robi: '⏳ składa się', blad: '⚠ stanął', do_akceptacji: '✓ czeka na Twoje ✓ (Publikacje wyżej)' };

export const GameShowPanel: React.FC = () => {
    const [s, setS] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [kanaly, setKanaly] = useState<KanalYT[]>([]);
    const [pokaz, setPokaz] = useState(false);
    const [playlista, setPlaylista] = useState('');
    const [album, setAlbum] = useState<AlbumSunoStan | null>(null);
    const [albumLink, setAlbumLink] = useState('');
    const [synchro, setSynchro] = useState(false);
    const odswiez = useCallback(async () => {
        try { setS(await zMostu<Stan>('/api/game-show')); setBlad(null); }
        catch (e) { setBlad(/HTTP 404/.test(String(e)) ? 'Most sprzed restartu — zrestartuj Katedrę, żeby włączyć TeO Game Show.' : String(e instanceof Error ? e.message : e)); }
        try { setKanaly((await zMostu<{ kanaly: KanalYT[] }>('/api/youtube/kanaly')).kanaly); } catch { /* bez kanałów */ }
        try { setAlbum((await zMostu<{ album: AlbumSunoStan }>('/api/suno-album')).album); } catch { /* most bez albumu Suno */ }
    }, []);
    useEffect(() => { void odswiez(); const t = setInterval(odswiez, 15_000); return () => clearInterval(t); }, [odswiez]);
    const wolaj = async (sciezka: string, metoda: string, cialo: object, ok: string) => {
        try { await zMostu(sciezka, { method: metoda, body: JSON.stringify(cialo) }); toast.success(ok); await odswiez(); }
        catch (e) { toast.error(String(e instanceof Error ? e.message : e), { duration: 8000 }); }
    };

    return (
        <div className="rounded-lg border border-amber-500/25 p-3 text-[11px]">
            <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-amber-300">🎪 TeO Game Show</span>
                {s && <span className="text-[10px] text-slate-500">{s.automat ? 'nagranie występu w Tanecznym Starciu samo robi odcinek' : 'automat wyłączony (OTAKOS_GAME_SHOW=0)'}</span>}
                <button onClick={() => setPokaz((x) => !x)} className="ml-auto text-[10px] text-slate-400 hover:text-amber-200">{pokaz ? 'zwiń' : 'kanał i sieci'}</button>
            </div>
            {blad && <p className="text-[10px] text-amber-300">⚠ {blad}</p>}
            {s && (
                <>
                    <label className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">Język odcinków:
                        <select value={s.ustawienia?.jezyk ?? 'en'} onChange={(ev) => void wolaj('/api/game-show/ustawienia', 'PUT', { jezyk: ev.target.value }, ev.target.value === 'en' ? 'Nowe odcinki po angielsku (wstęp, wywiad, opis).' : 'Nowe odcinki po polsku.')} className="rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200">
                            {Object.entries(s.jezyki ?? { en: 'English', pl: 'polski' }).map(([k, n]) => <option key={k} value={k}>{FLAGA[k] ?? ''} {n}</option>)}
                        </select>
                        <span className="ml-2">Intro:</span>
                        <select value={s.ustawienia?.silnikIntro ?? 'flux'} onChange={(ev) => void wolaj('/api/game-show/ustawienia', 'PUT', { silnikIntro: ev.target.value }, ev.target.value === 'flux' ? 'Intro nowych odcinków: kadr FLUX + ruch kamery.' : 'Intro nowych odcinków: Wan 2.2 (długo na 6 GB).')} className="rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200">
                            {Object.entries(s.silnikiIntro ?? { flux: 'FLUX', wan: 'Wan 2.2' }).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                        </select>
                    </label>
                    <div className="mb-2 text-[10px] text-slate-400">📋 Playlisty programu (po jednej na kanał — wysłane odcinki trafiają na playlistę SWOJEGO kanału; pierwsza idzie do wizytówki otakos.wtf):
                        {(s.ustawienia?.playlisty ?? []).map((pl) => (
                            <div key={pl.id} className="ml-2 flex flex-wrap items-center gap-2">
                                <a href={`https://www.youtube.com/playlist?list=${pl.id}`} target="_blank" rel="noreferrer" className="text-amber-200 underline">{pl.tytul || pl.id}</a>
                                <span className="text-slate-500">· {kanaly.find((k) => k.id === pl.kanal)?.nazwa ?? pl.kanal ?? 'kanał nieznany'}</span>
                                <button onClick={() => confirm('Odpiąć tę playlistę? Odcinki z jej kanału przestaną być na nią dopisywane.') && void wolaj('/api/game-show/ustawienia', 'PUT', { playlistaUsun: pl.id }, 'Playlista odpięta.')} className="text-slate-600 hover:text-rose-300">odepnij</button>
                            </div>))}
                        <div className="ml-2 mt-1 flex flex-wrap items-center gap-2">
                            <input value={playlista} onChange={(ev) => setPlaylista(ev.target.value)} placeholder="➕ link do playlisty YouTube (…/playlist?list=PL…)" className="min-w-[260px] rounded border border-slate-700 bg-black/40 px-1.5 py-0.5 text-slate-200" />
                            <button disabled={!playlista.trim()} onClick={() => void wolaj('/api/game-show/ustawienia', 'PUT', { playlista: playlista.trim() }, 'Playlista dodana — most rozpoznał jej kanał.').then(() => setPlaylista(''))} className="rounded bg-amber-600/30 px-2 py-0.5 text-amber-100">dodaj</button>
                        </div>
                    </div>
                    <label className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">Kanał programu:
                        <select value={s.kanal.zapamietany ?? ''} onChange={(ev) => void wolaj('/api/game-show/kanal', 'PUT', { kanalId: ev.target.value || null }, ev.target.value ? 'Kanał programu ustawiony — odcinki pójdą tam same.' : 'Kanał programu zapomniany — odcinki idą na domyślny.')} className="rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200">
                            <option value="">— domyślny kanał Katedry —</option>
                            {kanaly.map((k) => <option key={k.id} value={k.id}>{k.nazwa || k.id}</option>)}
                        </select>
                        <span className="text-slate-500">{s.kanal.kanalNazwa ? `→ ${s.kanal.kanalNazwa}` : 'YouTube niepołączony'}</span>
                    </label>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">📡 Jedno ✓ wysyła też na:
                        {kanaly.filter((k) => k.id !== s.kanal.zapamietany).map((k) => {
                            const dod = s.ustawienia?.kanalyDodatkowe ?? [];
                            const wl = dod.includes(k.id);
                            return <label key={k.id} className="flex items-center gap-1"><input type="checkbox" checked={wl} onChange={() => void wolaj('/api/game-show/ustawienia', 'PUT', { kanalyDodatkowe: wl ? dod.filter((x) => x !== k.id) : [...dod, k.id] }, wl ? `„${k.nazwa}” — bez kopii.` : `„${k.nazwa}” — każdy ✓ odcinka wyśle tam też kopię.`)} />{k.nazwa || k.id}</label>;
                        })}
                        <span className="text-slate-500">(kopie z tym samym tytułem i opisem, każdy kanał ma własny dobowy limit YouTube)</span>
                    </div>
                    <div className="mb-2 rounded border border-white/5 bg-black/20 p-2 text-[10px] text-slate-400">
                        <div className="flex flex-wrap items-center gap-2">🎵 Album Suno do tańca:
                            {album?.album
                                ? <><a href={`https://suno.com/album/${album.album}`} target="_blank" rel="noreferrer" className="text-amber-200 underline">{album.nazwa || album.album}</a>
                                    <span className="text-slate-500">→ biblioteka „{album.katalog ?? '…'}” (choreografia i wszystkie tryby Tanecznego Starcia)</span>
                                    <button disabled={synchro} onClick={async () => { setSynchro(true); try { setAlbum((await zMostu<{ album: AlbumSunoStan }>('/api/suno-album/synchronizuj', { method: 'POST', body: '{}' })).album); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); } finally { setSynchro(false); } }} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-100">{synchro ? '⏳' : '↻ synchronizuj'}</button></>
                                : <><input value={albumLink} onChange={(ev) => setAlbumLink(ev.target.value)} placeholder="https://suno.com/album/…" className="min-w-[260px] rounded border border-slate-700 bg-black/40 px-1.5 py-0.5 text-slate-200" />
                                    <button disabled={!albumLink.trim()} onClick={() => void wolaj('/api/suno-album', 'PUT', { album: albumLink.trim() }, 'Album Suno podpięty — utwory idą do biblioteki.').then(() => setAlbumLink(''))} className="rounded bg-amber-600/30 px-2 py-0.5 text-amber-100">podepnij</button></>}
                        </div>
                        {album?.blad && <div className="text-amber-300">⚠ {album.blad}</div>}
                        {(album?.utwory ?? []).map((u) => <div key={u.id} title={u.powod ?? u.plik ?? ''} className={u.stan === 'prywatny' ? 'text-amber-300' : 'text-slate-400'}>{ZNAK_SUNO[u.stan] ?? u.stan} {u.tytul}{u.sekundy ? ` · ${Math.floor(u.sekundy / 60)}:${String(u.sekundy % 60).padStart(2, '0')}` : ''}{u.bpm ? ` · ${u.bpm} BPM` : ''}{u.powod ? ` — ${u.powod}` : ''}</div>)}
                    </div>
                    {pokaz && (
                        <div className="mb-2 rounded border border-white/5 bg-black/30 p-2 text-[10px] text-slate-400">
                            <b className="text-slate-300">Dedykowany kanał (zakładasz Ty — API YouTube nie zakłada kanałów):</b>
                            <ol className="mt-1 list-none space-y-0.5">{s.instrukcja.map((l) => <li key={l}>{l}</li>)}</ol>
                            <button onClick={() => void wolaj('/api/game-show/stol', 'POST', {}, 'Karta „TeO Game Show — zarządzanie kanałem” leży na Stole.')} className="mt-2 rounded bg-amber-600/30 px-2 py-1 text-amber-100">🏛️ Karta zarządzania kanałem na Stół</button>
                            <div className="mt-2 text-slate-300">Inne sieci:</div>
                            <ul>{s.inneSieci.map((x) => <li key={x.siec}>✕ <b>{x.siec}</b> — {x.stan}: {x.powod}</li>)}</ul>
                        </div>
                    )}
                    {!s.odcinki.length && <p className="text-[10px] text-slate-500">Pusto. Nagraj występ w Tanecznym Starciu (🩰 Choreografia → 🎥 Nagraj) — odcinek złoży się sam.</p>}
                    {s.odcinki.slice(0, 12).map((o) => (
                        <div key={o.id} className="mb-2 rounded border border-white/5 bg-black/30 p-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span title={o.jezyk ?? 'pl'}>{FLAGA[o.jezyk ?? 'pl']}</span>
                                <b className="text-slate-200">{o.tancerz.imie}</b>
                                <span className="text-slate-500">· {o.konkurencja.nazwa} · „{o.utwor.tytul}” · {o.ocena?.wynik ?? '?'}/100</span>
                                <span className="ml-auto text-slate-400">{STAN[o.stan] ?? o.stan}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                                {ETAPY.map(([k, n]) => <span key={k} title={o.etapy[k]?.powod ?? ''} className={o.etapy[k]?.stan === 'blad' ? 'text-amber-300' : o.etapy[k]?.stan === 'gotowy' ? 'text-emerald-300' : 'text-slate-500'}>{ZNAK[o.etapy[k]?.stan] ?? '·'} {n}</span>)}
                            </div>
                            {o.powod && <div className="mt-1 text-[10px] text-amber-300">{o.powod}</div>}
                            {o.uwagi?.length > 0 && <div className="mt-1 text-[10px] text-slate-500">uwagi: {o.uwagi.join(' · ')}</div>}
                            {o.publikacja?.tytul && <div className="mt-1 text-[10px] text-slate-400">✍️ „{o.publikacja.tytul}”{o.publikacja.kanalNazwa ? ` → ${o.publikacja.kanalNazwa}` : ''}</div>}
                            <div className="mt-1 flex gap-2">
                                {['blad', 'do_akceptacji'].includes(o.stan) && Object.keys(FLAGA).filter((j) => j !== (o.jezyk ?? 'pl')).map((j) => <button key={j} onClick={() => confirm(`Przerobić odcinek na ${j === 'en' ? 'angielski' : 'polski'}? Intro zostaje, plansze, wywiad i opis Kronikarza powstaną od nowa, a obecna publikacja (jeśli czeka na ✓) pójdzie do odrzuconych.`) && void wolaj(`/api/game-show/${o.id}/ponow`, 'POST', { jezyk: j }, 'Przerabiam odcinek — intro zostaje.')} className="rounded bg-sky-700/40 px-2 py-0.5 text-sky-100">{FLAGA[j]} przerób {j === 'en' ? 'po angielsku' : 'po polsku'}</button>)}
                                {o.stan === 'do_akceptacji' && !o.klockiDoklejone && !((o.etapy.sklejanie as Etap & { klocki?: { start: number; end: number } })?.klocki?.start || (o.etapy.sklejanie as Etap & { klocki?: { start: number; end: number } })?.klocki?.end) && <button onClick={() => void wolaj(`/api/game-show/${o.id}/klocki`, 'POST', {}, 'Klocki Start/End doklejone — publikacja czeka na ✓ z nowym plikiem.')} className="rounded bg-violet-700/40 px-2 py-0.5 text-violet-100">🧱 doklej klocki Dance</button>}
                                {o.klockiDoklejone && <span className="text-[10px] text-violet-300">🧱 {[...o.klockiDoklejone.start, ...o.klockiDoklejone.end].join(' + ')}</span>}
                                {o.stan === 'blad' && <button onClick={() => void wolaj(`/api/game-show/${o.id}/ponow`, 'POST', {}, 'Ponawiam od etapu, który stanął.')} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-100">↻ Ponów</button>}
                                {o.stan === 'blad' && o.etapy.intro?.stan === 'blad' && <button onClick={() => void wolaj(`/api/game-show/${o.id}/ponow`, 'POST', { bezIntro: true }, 'Składam odcinek bez intro.')} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-100">bez intro</button>}
                                {o.stan === 'blad' && o.etapy.intro?.stan === 'blad' && (o.silnikIntro ?? 'flux') !== 'flux' && <button onClick={() => void wolaj(`/api/game-show/${o.id}/ponow`, 'POST', { silnikIntro: 'flux' }, 'Ponawiam intro na FLUX.')} className="rounded bg-amber-700/40 px-2 py-0.5 text-amber-100">↻ intro na FLUX</button>}
                                {!['robi', 'w_kolejce'].includes(o.stan) && <button onClick={() => confirm('Usunąć odcinek (pliki robocze)? Gotowy film w montażach i publikacja zostają.') && void wolaj(`/api/game-show/${o.id}`, 'DELETE', {}, 'Usunięty.')} className="ml-auto text-[10px] text-slate-600 hover:text-rose-300">✕</button>}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

export default GameShowPanel;
