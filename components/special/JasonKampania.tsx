/**
 * 🎛️ JasonKampania — panel kampanii Jasona w Hubie (duży Stół Narad, Stół Mobilny).
 * Most robi wszystko kodem (services/JasonOrchestrator.js): Suno audio-create → okładka Palety → pakiet do odsłuchu.
 * NIC nie jest pobierane samo (limit pobrań komercyjnych Suno) — tu Suweren odsłuchuje wersje w Suno i pobiera JEDNĄ.
 * To samo ✓ jest w Izbie Akceptacji w StoL (źródło `jason`).
 */
import React, { useCallback, useEffect, useState } from 'react';

type Klip = { id: string; status: string; plik?: string | null; sekundy?: number | null; odsluch?: string | null; bladPobrania?: string };
type Kampania = {
    id: string; album: string; stan: string; blad?: string; uwagi?: string[];
    stacja: { nr: number; tytul: string }; klipy: Klip[]; glos?: { nazwa?: string } | null;
    okladka?: { plik?: string; blad?: string } | null; etapy?: Record<string, { stan: string }>; wybrana?: { wersja: number; plik: string };
};
const czas = (s?: number | null) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '?:??');

export const JasonKampania: React.FC<{ bridgeUrl?: string; kompakt?: boolean; skad?: string }> = ({ bridgeUrl = 'http://127.0.0.1:3001', kompakt = false, skad = 'stol-narad' }) => {
    const [k, setK] = useState<Kampania | null>(null);
    const [info, setInfo] = useState('');
    const [trwa, setTrwa] = useState(false);
    const [glos, setGlos] = useState('');
    const [glosy, setGlosy] = useState<{ id: string; name: string }[]>([]);

    const api = useCallback(async (sciezka: string, cialo?: unknown) => {
        const r = await fetch(`${bridgeUrl}${sciezka}`, cialo === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cialo) });
        const d = await r.json().catch(() => null);
        if (!d) throw new Error(`Most odpowiedział HTTP ${r.status}.`);
        return d;
    }, [bridgeUrl]);

    // start: ostatnia otwarta kampania (pracuje / czeka na wybór wersji / stanęła) + persony głosowe konta Suno
    useEffect(() => {
        let zywy = true;
        api('/api/jason/kampanie').then((d) => { const o = (d.kampanie ?? []).find((x: Kampania) => ['robi', 'do_akceptacji', 'blad'].includes(x.stan)); if (zywy && o) setK(o); }).catch(() => {});
        api('/api/jason/glosy').then((d) => { if (zywy && d.success) setGlosy(d.glosy ?? []); }).catch(() => {});
        return () => { zywy = false; };
    }, [api]);

    // podgląd pracy co 10 s, dopóki Jason pracuje
    useEffect(() => {
        if (k?.stan !== 'robi') return;
        const t = setInterval(() => { api(`/api/jason/kampanie/${k.id}`).then((d) => { if (d.kampania) setK(d.kampania); }).catch(() => {}); }, 10000);
        return () => clearInterval(t);
    }, [k?.id, k?.stan, api]);

    const wykonaj = async (sciezka: string, cialo: unknown, poCzym: string) => {
        setTrwa(true); setInfo(poCzym);
        try {
            const d = await api(sciezka, cialo);
            if (d.kampania) setK(d.kampania);
            setInfo(d.success ? '' : `⚠ ${d.message}`);
        } catch (e: any) { setInfo(`⚠ ${e?.message || e}`); }
        setTrwa(false);
    };
    const zlec = () => wykonaj('/api/jason/wykonaj-kampanie', { stacja: 1, skad, ...(glos ? { glos } : {}) }, 'Zlecam Jasonowi…');
    const pobierz = (nr: number, c: Klip) => {
        if (!window.confirm(`Pobrać wersję ${nr} (${czas(c.sekundy)})?\n\nTo zużyje 1 z miesięcznych pobrań Suno z prawami komercyjnymi. Druga wersja zostaje w Suno.`)) return;
        void wykonaj(`/api/jason/kampanie/${k!.id}/pobierz`, { wersja: nr }, `Pobieram wersję ${nr}…`);
    };

    const pracuje = k?.stan === 'robi';
    const opis = !k ? '' : pracuje ? `Jason pracuje: ${Object.entries(k.etapy ?? {}).map(([n, e]) => `${n} ${e.stan}`).join(' → ') || 'start'}…`
        : k.stan === 'blad' ? `⚠ ${k.blad}`
        : k.stan === 'do_akceptacji' ? 'Gotowe do odsłuchu. Nic nie pobrano — odsłuchaj w Suno i pobierz jedną wersję:'
        : k.stan === 'przyjeta' ? `✓ Wersja ${k.wybrana?.wersja} pobrana: _OtakOs_Muzyka/${k.wybrana?.plik}`
        : `Kampania ${k.stan}.`;

    return (
        <div className={`rounded-xl border border-violet-500/40 bg-violet-950/30 font-mono text-violet-200 ${kompakt ? 'mt-2 p-2 text-[11px]' : 'mt-3 px-4 py-2.5 text-xs'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span>🎛️ Jason · „Zero Gravity Heart (0.00G Sessions)” · Stacja 1: Velvet Booth for Two (82 BPM Intro)</span>
                <div className="flex shrink-0 items-center gap-2">
                    <select value={glos} onChange={(e) => setGlos(e.target.value)} disabled={trwa || pracuje}
                        title="Persona głosowa z My Voices w Suno. Suno przyjmuje JEDEN głos na utwór — w duecie zaśpiewa on obie partie."
                        className="rounded-lg border border-violet-500/40 bg-slate-950 px-2 py-1.5 text-violet-100">
                        <option value="">🎤 duet bez persony</option>
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
            {k && k.stan === 'blad' && (
                <button onClick={() => wykonaj(`/api/jason/kampanie/${k.id}/ponow`, {}, 'Wznawiam…')} disabled={trwa}
                    title="Wznawia od miejsca przerwania — utwór NIE zostanie stworzony drugi raz i nic nie zostanie pobrane."
                    className="mt-1.5 rounded bg-violet-700 px-2 py-0.5 font-bold text-white hover:bg-violet-600 disabled:opacity-50">↻ wznów (bez nowych kredytów)</button>
            )}
        </div>
    );
};

export default JasonKampania;
