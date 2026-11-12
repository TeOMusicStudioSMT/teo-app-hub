/**
 * 🎛️ JasonKampania — panel kampanii Jasona w Hubie (duży Stół Narad, Stół Mobilny).
 * Most robi wszystko kodem (services/JasonOrchestrator.js): Suno audio-create → okładka Palety → pakiet do odsłuchu.
 * NIC nie jest pobierane samo (limit pobrań komercyjnych Suno) — tu Suweren odsłuchuje wersje w Suno i pobiera JEDNĄ.
 * To samo ✓ jest w Izbie Akceptacji w StoL (źródło `jason`).
 * Po pobraniu: „🚀 Przygotuj i wyślij na Spotify” = paczka wydawnicza na dysku (master.wav, okładka 3000×3000, tekst, metadane)
 * + karta z otwarciem folderu i panelu dystrybutora. Katedra niczego do Spotify nie wysyła — wgrywa Suweren u dystrybutora.
 */
import React, { useCallback, useEffect, useState } from 'react';

type Klip = { id: string; status: string; plik?: string | null; sekundy?: number | null; odsluch?: string | null; bladPobrania?: string };
type Kampania = {
    id: string; album: string; stan: string; blad?: string; uwagi?: string[];
    stacja: { nr: number; tytul: string }; klipy: Klip[]; glos?: { nazwa?: string } | null;
    okladka?: { plik?: string; blad?: string; rysuje?: boolean; wersja?: number } | null; etapy?: Record<string, { stan: string }>; wybrana?: { wersja: number; plik: string };
    spotify?: { folder: string; pliki: string[]; uwagi: string[]; okladka?: { plik: string } | null; master: { hz: number; bity: number; kanaly: number; zrodlo: string; sekundy: number; bajtow: number } } | null;
};
type Stacja = { nr: number; tytul: string; artysci?: string[]; glos?: string | null };
const czas = (s?: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '?:??');

export const JasonKampania: React.FC<{ bridgeUrl?: string; kompakt?: boolean; skad?: string }> = ({ bridgeUrl = 'http://127.0.0.1:3001', kompakt = false, skad = 'stol-narad' }) => {
    const [k, setK] = useState<Kampania | null>(null);
    const [info, setInfo] = useState('');
    const [trwa, setTrwa] = useState(false);
    const [glos, setGlos] = useState('');
    const [glosy, setGlosy] = useState<{ id: string; name: string }[]>([]);
    const [dystrybutor, setDystrybutor] = useState<string | null>(null);
    const [nr, setNr] = useState(1);
    const [stacje, setStacje] = useState<Stacja[]>([]);
    const [adres, setAdres] = useState('');

    const api = useCallback(async (sciezka: string, cialo?: unknown) => {
        const r = await fetch(`${bridgeUrl}${sciezka}`, cialo === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cialo) });
        const d = await r.json().catch(() => null);
        if (!d) throw new Error(`Most odpowiedział HTTP ${r.status}.`);
        return d;
    }, [bridgeUrl]);

    // start: ostatnia otwarta kampania (pracuje / czeka na wybór wersji / stanęła) + persony głosowe konta Suno
    useEffect(() => {
        let zywy = true;
        api('/api/jason/kampanie').then((d) => { const o = (d.kampanie ?? []).find((x: Kampania) => x.stan !== 'odrzucona'); if (!zywy) return; setStacje(d.stacje ?? []); if (o) { setK(o); setNr(o.stacja.nr); } }).catch(() => {});
        api('/api/jason/ustawienia').then((d) => { if (zywy && d.success) setDystrybutor(d.ustawienia?.dystrybutor ?? null); }).catch(() => {});
        api('/api/jason/glosy').then((d) => { if (zywy && d.success) setGlosy(d.glosy ?? []); }).catch(() => {});
        return () => { zywy = false; };
    }, [api]);

    // podgląd pracy co 10 s, dopóki Jason pracuje
    useEffect(() => {
        if (k?.stan !== 'robi' && !k?.okladka?.rysuje) return;
        const t = setInterval(() => { api(`/api/jason/kampanie/${k.id}`).then((d) => { if (d.kampania) setK(d.kampania); }).catch(() => {}); }, 10000);
        return () => clearInterval(t);
    }, [k?.id, k?.stan, k?.okladka?.rysuje, api]);

    const wykonaj = async (sciezka: string, cialo: unknown, poCzym: string) => {
        setTrwa(true); setInfo(poCzym);
        try {
            const d = await api(sciezka, cialo);
            if (d.kampania) setK(d.kampania);
            setInfo(d.success ? '' : `⚠ ${d.message}`);
        } catch (e: any) { setInfo(`⚠ ${e?.message || e}`); }
        setTrwa(false);
    };
    const zlec = () => wykonaj('/api/jason/wykonaj-kampanie', { stacja: nr, skad, ...(glos ? { glos } : {}) }, 'Zlecam Jasonowi…');
    const pobierz = (nr: number, c: Klip) => {
        if (!window.confirm(`Pobrać wersję ${nr} (${czas(c.sekundy)})?\n\nTo zużyje 1 z miesięcznych pobrań Suno z prawami komercyjnymi. Druga wersja zostaje w Suno.`)) return;
        void wykonaj(`/api/jason/kampanie/${k!.id}/pobierz`, { wersja: nr }, `Pobieram wersję ${nr}…`);
    };

    const zapiszDystrybutora = async () => {
        try {
            const r = await fetch(`${bridgeUrl}/api/jason/ustawienia`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dystrybutor: adres }) });
            const d = await r.json();
            if (d.success) { setDystrybutor(d.ustawienia?.dystrybutor ?? null); setAdres(''); setInfo(''); } else setInfo(`⚠ ${d.message}`);
        } catch (e: any) { setInfo(`⚠ ${e?.message || e}`); }
    };
    const otworzFolder = async () => {
        try { const d = await api(`/api/jason/kampanie/${k!.id}/otworz-folder`, {}); setInfo(d.success ? '' : `⚠ ${d.message}`); } catch (e: any) { setInfo(`⚠ ${e?.message || e}`); }
    };
    const distrokid = /^https:\/\/([a-z0-9-]+\.)*distrokid\.com\//i.test(dystrybutor ?? '');
    const [skopiowano, setSkopiowano] = useState('');
    const kopiuj = async (tekst: string, co: string) => {
        try { await navigator.clipboard.writeText(tekst); setSkopiowano(co); setTimeout(() => setSkopiowano(''), 2500); }
        catch { setInfo('⚠ Przeglądarka nie pozwoliła skopiować do schowka.'); }
    };
    const kopiujTekst = async () => {
        try { const d = await api(`/api/jason/kampanie/${k!.id}/tekst`); if (d.success) await kopiuj(d.tekst, 'czysty tekst'); else setInfo(`⚠ ${d.message}`); }
        catch (e: any) { setInfo(`⚠ ${e?.message || e}`); }
    };
    const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

    // 🎚️ zmiana stacji: pokaż jej ostatnią nieodrzuconą kampanię (albo pusty panel gotowy do zlecenia)
    const wybierzStacje = (n: number) => {
        setNr(n); setGlos(''); setInfo(''); setK(null);
        api('/api/jason/kampanie').then((d) => setK((d.kampanie ?? []).find((x: Kampania) => x.stan !== 'odrzucona' && x.stacja.nr === n) ?? null)).catch(() => {});
    };
    const stacja = stacje.find((x) => x.nr === nr);
    const przerysuj = () => {
        if (!window.confirm('Narysować okładkę od nowa?\n\nPaleta (FLUX) zajmie kartę na około minutę. Poprzednia okładka zostaje, dopóki nowa nie wyjdzie; paczka Spotify dostanie nową od razu.')) return;
        void wykonaj(`/api/jason/kampanie/${k!.id}/przerysuj-okladke`, {}, 'Zlecam Palecie nową okładkę…');
    };

    const pracuje = k?.stan === 'robi';
    const opis = !k ? '' : pracuje ? `Jason pracuje: ${Object.entries(k.etapy ?? {}).map(([n, e]) => `${n} ${e.stan}`).join(' → ') || 'start'}…`
        : k.stan === 'blad' ? `⚠ ${k.blad}`
        : k.stan === 'do_akceptacji' ? 'Gotowe do odsłuchu. Nic nie pobrano — odsłuchaj w Suno i pobierz jedną wersję:'
        : k.stan === 'przyjeta' ? `✓ Wersja ${k.wybrana?.wersja} pobrana: _OtakOs_Muzyka/${k.wybrana?.plik}${k.spotify ? ' · paczka Spotify gotowa' : ''}`
        : `Kampania ${k.stan}.`;

    return (
        <div className={`rounded-xl border border-violet-500/40 bg-violet-950/30 font-mono text-violet-200 ${kompakt ? 'mt-2 p-2 text-[11px]' : 'mt-3 px-4 py-2.5 text-xs'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">🎛️ Jason · „Zero Gravity Heart (0.00G Sessions)” ·
                    {stacje.length > 1
                        ? <select value={nr} onChange={(e) => wybierzStacje(Number(e.target.value))} disabled={trwa || pracuje} className="rounded-lg border border-violet-500/40 bg-slate-950 px-2 py-1 text-violet-100">
                            {stacje.map((x) => <option key={x.nr} value={x.nr}>Stacja {x.nr}: {x.tytul}</option>)}
                        </select>
                        : <span>Stacja {nr}: {stacja?.tytul ?? k?.stacja.tytul ?? 'Velvet Booth for Two (82 BPM Intro)'}</span>}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                    <select value={glos} onChange={(e) => setGlos(e.target.value)} disabled={trwa || pracuje}
                        title="Persona głosowa z My Voices w Suno. Suno przyjmuje JEDEN głos na utwór — w duecie zaśpiewa on obie partie."
                        className="rounded-lg border border-violet-500/40 bg-slate-950 px-2 py-1.5 text-violet-100">
                        <option value="">{stacja?.glos ? `🎤 ${stacja.glos} (persona stacji)` : (stacja?.artysci?.length ?? 2) > 1 ? '🎤 duet bez persony' : '🎤 głos artysty stacji'}</option>
                        {glosy.map((g) => <option key={g.id} value={g.id}>🎤 {g.name}</option>)}
                    </select>
                    <button onClick={zlec} disabled={trwa || pracuje}
                        title="Suno audio-create (2 wersje z kredytów konta) → okładka Palety → odsłuch. Pobrania nie będzie, dopóki nie wybierzesz wersji."
                        className="rounded-lg bg-violet-600 px-3 py-1.5 font-bold tracking-wider text-white hover:bg-violet-500 disabled:opacity-50">
                        {pracuje ? 'JASON PRACUJE…' : 'WYKONAJ KAMPANIĘ'}
                    </button>
                </div>
            </div>
            {(info || opis) && <div className="mt-1.5 text-violet-300/90">{info || opis}{k?.glos?.nazwa ? ` · głos: ${k.glos.nazwa}` : ''}</div>}
            {k && k.stan === 'do_akceptacji' && (
                <div className="mt-2 flex flex-col gap-1.5">
                    {k.klipy.map((c, i) => c.status !== 'complete' ? null : (
                        <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-950/50 px-2 py-1.5">
                            <span className="font-bold text-violet-100">Wersja {i + 1} · {czas(c.sekundy)}</span>
                            <a href={c.odsluch ?? `https://suno.com/song/${c.id}`} target="_blank" rel="noreferrer" className="rounded border border-violet-400/50 px-2 py-0.5 text-violet-100 hover:bg-violet-800/40">▶ odsłuchaj w Suno</a>
                            <button onClick={() => pobierz(i + 1, c)} disabled={trwa} className="rounded bg-emerald-600 px-2 py-0.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">✓ Pobierz tę wersję</button>
                            {c.bladPobrania && <span className="text-amber-300">⚠ {c.bladPobrania}</span>}
                        </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-2 text-violet-300/80">
                        {k.okladka?.plik
                            ? <a href={`${bridgeUrl}/api/jason/kampanie/${k.id}/okladka`} target="_blank" rel="noreferrer" className="underline">🖼️ okładka Palety</a>
                            : k.okladka?.blad ? <button onClick={() => wykonaj(`/api/jason/kampanie/${k.id}/ponow`, { okladka: true }, 'Zlecam okładkę…')} disabled={trwa} className="underline">↻ okładka (nie wyszła: {k.okladka.blad})</button> : null}
                        <button onClick={() => wykonaj(`/api/jason/kampanie/${k.id}/odrzuc`, {}, 'Odrzucam…')} disabled={trwa} className="underline">✕ odrzuć bez pobierania</button>
                    </div>
                    {(k.uwagi ?? []).map((u, i) => <div key={i} className="text-amber-200/80">ℹ {u}</div>)}
                </div>
            )}
            {k && k.stan === 'przyjeta' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-violet-300/90">
                    {k.okladka?.plik && <a href={`${bridgeUrl}/api/jason/kampanie/${k.id}/okladka?v=${k.okladka.wersja ?? 1}`} target="_blank" rel="noreferrer" className="underline">🖼️ okładka Palety{k.okladka.wersja ? ` (wersja ${k.okladka.wersja})` : ''}</a>}
                    {k.okladka?.rysuje
                        ? <span>🎨 Paleta rysuje nową okładkę…</span>
                        : <button onClick={przerysuj} disabled={trwa} title="FLUX, czyste wnętrze baru bez napisów i szyldów. Poprzednia okładka zostaje do udanej zamiany." className="rounded border border-violet-400/50 px-2 py-0.5 text-violet-100 hover:bg-violet-800/40 disabled:opacity-50">🎨 Przerysuj okładkę</button>}
                    {k.okladka?.blad && <span className="text-amber-300">⚠ {k.okladka.blad}</span>}
                </div>
            )}
            {k && k.stan === 'przyjeta' && !k.spotify && (
                <button onClick={() => wykonaj(`/api/jason/kampanie/${k.id}/przygotuj-spotify`, {}, 'Składam paczkę wydawniczą (master.wav, okładka, tekst, metadane)…')} disabled={trwa}
                    title="Składa folder wydawniczy na dysku. Nic nie kosztuje i nic nie wychodzi z Katedry — do Spotify wgrywasz paczkę sam w panelu dystrybutora."
                    className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50">🚀 Przygotuj i wyślij na Spotify</button>
            )}
            {k && k.stan === 'przyjeta' && k.spotify && (
                <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-2.5 text-emerald-100">
                    <div className="flex flex-wrap items-start gap-3">
                        {k.spotify.okladka && <img src={`${bridgeUrl}/api/jason/kampanie/${k.id}/spotify/okladka?v=${k.okladka?.wersja ?? 1}`} alt="okładka 3000×3000" className="h-24 w-24 rounded-md object-cover" />}
                        <div className="min-w-0 flex-1">
                            <div className="font-bold">🚀 Karta wydawnicza · {k.stacja.tytul}</div>
                            <div className="break-all text-emerald-200/80">📂 _OtakOs_Muzyka/{k.spotify.folder}</div>
                            <div className="mt-1 text-emerald-200/90">
                                master.wav — {k.spotify.master.hz / 1000} kHz / {k.spotify.master.bity} bit / {k.spotify.master.kanaly === 2 ? 'stereo' : `${k.spotify.master.kanaly} kan.`} · {czas(k.spotify.master.sekundy)} · {mb(k.spotify.master.bajtow)} · {k.spotify.master.zrodlo === 'wav-suno' ? 'z bezstratnego WAV Suno' : 'z MP3'}
                            </div>
                            <div className="text-emerald-200/70">{k.spotify.pliki.join(' · ')}</div>
                        </div>
                    </div>
                    {k.spotify.uwagi.map((u, i) => <div key={i} className="mt-1 text-amber-200/80">ℹ {u}</div>)}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button onClick={otworzFolder} className="rounded bg-emerald-600 px-2.5 py-1 font-bold text-white hover:bg-emerald-500">📂 Otwórz folder</button>
                        {dystrybutor
                            ? <a href={dystrybutor} target="_blank" rel="noreferrer" className="rounded bg-violet-600 px-2.5 py-1 font-bold text-white hover:bg-violet-500">{distrokid ? '🌐 Otwórz DistroKid (Upload)' : '🌐 Panel dystrybutora'}</a>
                            : <>
                                <input value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="https://… adres panelu Twojego dystrybutora" className="min-w-[14rem] flex-1 rounded border border-violet-500/40 bg-slate-950 px-2 py-1 text-violet-100" />
                                <button onClick={zapiszDystrybutora} disabled={!adres.trim()} className="rounded bg-violet-600 px-2.5 py-1 font-bold text-white hover:bg-violet-500 disabled:opacity-50">zapisz</button>
                            </>}
                        <button onClick={() => kopiuj(k.stacja.tytul, 'tytuł')} title={k.stacja.tytul} className="rounded border border-emerald-400/50 px-2 py-1 text-emerald-100 hover:bg-emerald-800/40">📋 Kopiuj tytuł</button>
                        {k.spotify.pliki.includes('lyrics_clean.txt') && <button onClick={kopiujTekst} title="Zawartość lyrics_clean.txt — bez [Verse…] i (Kael:)" className="rounded border border-emerald-400/50 px-2 py-1 text-emerald-100 hover:bg-emerald-800/40">📋 Kopiuj czysty tekst (Lyrics)</button>}
                        {skopiowano && <span className="text-emerald-300">✓ skopiowano: {skopiowano}</span>}
                        {distrokid && <a href="https://distrokid.com/mymusic/" target="_blank" rel="noreferrer" className="underline text-emerald-200/70">moje wydania</a>}
                        {dystrybutor && <button onClick={() => { setAdres(dystrybutor); setDystrybutor(null); }} className="underline text-emerald-200/70">zmień adres</button>}
                        <button onClick={() => wykonaj(`/api/jason/kampanie/${k.id}/przygotuj-spotify`, {}, 'Składam paczkę od nowa…')} disabled={trwa} className="underline text-emerald-200/70">↻ złóż od nowa</button>
                    </div>
                    <div className="mt-1 text-emerald-200/60">Spotify przyjmuje utwory tylko od dystrybutora — Katedra niczego nie wysyła sama; paczkę wgrywasz w jego panelu.</div>
                </div>
            )}
            {k && k.stan === 'blad' && (
                <button onClick={() => wykonaj(`/api/jason/kampanie/${k.id}/ponow`, {}, 'Wznawiam…')} disabled={trwa}
                    title="Wznawia od miejsca przerwania — utwór NIE zostanie stworzony drugi raz i nic nie zostanie pobrane."
                    className="mt-1.5 rounded bg-violet-700 px-2 py-0.5 font-bold text-white hover:bg-violet-600 disabled:opacity-50">↻ wznów (bez nowych kredytów)</button>
            )}
        </div>
    );
};

export default JasonKampania;
