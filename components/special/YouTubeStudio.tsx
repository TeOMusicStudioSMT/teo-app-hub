/**
 * 📺 YouTube w Katedrze — „Połącz z YouTube” i publikacje stada do akceptacji (2026-10-03).
 *
 * Rdzeń: services/YouTubeKonto.js (OAuth z pętlą zwrotną na most) i services/PublikacjeYouTube.js
 * (Kronikarz pisze tytuł/opis/tagi → Suweren ✓ → Impresariat wysyła NIEPUBLICZNIE → link sam na Wystawę).
 * Ten sam etap „do akceptacji” widać w StoL (Izba Akceptacji).
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

interface KanalYT { id: string; nazwa: string; adres: string; polaczono?: string; blad?: string | null }
interface StanYT { klient: boolean; polaczony: boolean; kanaly: KanalYT[]; domyslny: string | null; kanal: KanalYT | null; blad: string | null; zwrot: string }

export const PolaczYouTube: React.FC<{ onZmiana?: () => void }> = ({ onZmiana }) => {
    const [s, setS] = useState<StanYT | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const odswiez = useCallback(async () => {
        try { setS(await zMostu<StanYT>('/api/impresario/youtube/stan')); setBlad(null); }
        catch (e) { setBlad(/HTTP 404/.test(String(e)) ? 'Most sprzed restartu — zrestartuj Katedrę.' : String(e instanceof Error ? e.message : e)); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);
    // Po powrocie z okna zgody Google karta odświeża się sama.
    useEffect(() => { const f = () => { void odswiez(); onZmiana?.(); }; window.addEventListener('focus', f); return () => window.removeEventListener('focus', f); }, [odswiez, onZmiana]);

    const polacz = () => window.open(`${MOST}/api/impresario/youtube/polacz`, '_blank', 'width=520,height=720');
    const wyslij = async (sciezka: string, cialo: object, pytanie?: string) => {
        if (pytanie && !confirm(pytanie)) return;
        try { await zMostu(sciezka, { method: 'POST', body: JSON.stringify(cialo) }); await odswiez(); onZmiana?.(); }
        catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
    };

    if (blad) return <div className="rounded-lg border border-amber-500/30 p-3 text-[11px] text-amber-200">📺 {blad}</div>;
    if (!s) return null;
    const kanaly = s.kanaly ?? [];
    return (
        <div className="rounded-lg border border-red-500/30 bg-red-950/10 p-3 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-red-200">📺 YouTube</span>
                {kanaly.length > 0 && <span className="text-emerald-300">✓ połączone kanały: {kanaly.length}</span>}
                {!kanaly.length && s.blad && <span className="text-amber-300">⚠ {s.blad}</span>}
                {!kanaly.length && !s.blad && <span className="text-slate-400">{s.klient ? 'klient OAuth zapisany — zostało kliknąć „Połącz”' : 'najpierw klient OAuth z Google Cloud (instrukcja wyżej)'}</span>}
                <span className="ml-auto flex gap-2">
                    <button disabled={!s.klient} onClick={polacz}
                        className={`rounded px-3 py-1 font-bold ${s.klient ? 'bg-red-600/60 text-white hover:bg-red-600/80' : 'bg-slate-800 text-slate-500'}`}>
                        {kanaly.length ? '➕ Dodaj kanał' : '🔗 Połącz z YouTube'}
                    </button>
                </span>
            </div>
            {kanaly.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                    {kanaly.map((k) => (
                        <div key={k.id} className="flex flex-wrap items-center gap-2 rounded bg-black/30 px-2 py-1">
                            <button onClick={() => k.id !== s.domyslny && void wyslij('/api/impresario/youtube/domyslny', { kanalId: k.id })} title={k.id === s.domyslny ? 'kanał domyślny' : 'ustaw jako domyślny'} className={k.id === s.domyslny ? 'text-amber-300' : 'text-slate-600 hover:text-amber-200'}>{k.id === s.domyslny ? '⭐' : '☆'}</button>
                            <a href={k.adres} target="_blank" rel="noreferrer" className="font-bold text-slate-100 underline">{k.nazwa || k.id}</a>
                            {k.id === s.domyslny && <span className="text-[9px] text-slate-500">domyślny</span>}
                            {k.blad && <span className="text-[10px] text-amber-300">⚠ {k.blad}</span>}
                            <span className="ml-auto flex gap-2">
                                {k.blad && <button onClick={polacz} className="text-red-300 underline">połącz ponownie</button>}
                                <button onClick={() => void wyslij('/api/impresario/youtube/rozlacz', { kanalId: k.id }, `Rozłączyć kanał „${k.nazwa}”? Jego token zniknie z Katedry.`)} className="text-slate-500 hover:text-slate-200">rozłącz</button>
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                <b>Wiele kanałów:</b> „➕ Dodaj kanał” → w okienku Google wybierz konto (np. drugie konto Google) i — jeśli ma kanały marki — ten kanał. Każdy kanał ma swój token. ⭐ = domyślny; publikacja projektu idzie na kanał wybrany przy jego ostatnim ✓.
                Nowego kanału nie da się założyć przez API YouTube — załóż go w YouTube (<a href="https://www.youtube.com/account" target="_blank" rel="noreferrer" className="underline">Konto → Dodaj lub zarządzaj kanałami</a>), a potem dołącz tutaj.
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Filmy idą jako <b>niepubliczne</b> i dopiero po Twoim ✓ (tu albo w Izbie na telefonie). Uczciwie: YouTube trzyma filmy z projektu API bez audytu jako <b>prywatne</b> — Katedra sprawdza prawdziwy status, a link na Wystawę wstawia dopiero, gdy film da się obejrzeć (zmień widoczność w YouTube Studio albo złóż w Google o audyt projektu).
                Ekran zgody w Google Cloud ustaw na „W produkcji” — w „Testowaniu” token wygasa po 7 dniach.
            </p>
        </div>
    );
};

interface Publikacja { id: string; etap: string; nazwa: string; tytul?: string; opis?: string; tagi?: string[]; model?: string | null; blad?: string | null; uwaga?: string | null; url?: string; utworzono: string; kanalId?: string | null; kanalNazwa?: string | null }
const ETAP: Record<string, string> = { przygotowuje: '✍️ Kronikarz pisze…', do_akceptacji: '⏳ czeka na Twoje ✓', wysylanie: '⬆️ Impresariat wysyła', prywatna: '🔒 na YouTube, ale prywatny', opublikowana: '✓ na YouTube', odrzucona: '✕ odrzucona', blad: '⚠ błąd' };

export const PublikacjeYouTubePanel: React.FC = () => {
    const [lista, setLista] = useState<Publikacja[] | null>(null);
    const [edycja, setEdycja] = useState<Record<string, { tytul: string; opis: string; tagi: string }>>({});
    const [pracuje, setPracuje] = useState<string | null>(null);
    const [kanaly, setKanaly] = useState<KanalYT[]>([]);
    const odswiez = useCallback(async () => {
        try { setLista((await zMostu<{ publikacje: Publikacja[] }>('/api/youtube/publikacje')).publikacje); } catch { setLista(null); }
        try { setKanaly((await zMostu<{ kanaly: KanalYT[] }>('/api/youtube/kanaly')).kanaly); } catch { /* bez listy — wybór kanału ukryty */ }
    }, []);
    const zmienKanal = async (p: Publikacja, kanalId: string) => {
        try { await zMostu(`/api/youtube/publikacje/${p.id}/zmien`, { method: 'POST', body: JSON.stringify({ kanalId }) }); await odswiez(); }
        catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
    };
    useEffect(() => { void odswiez(); const t = setInterval(odswiez, 20_000); return () => clearInterval(t); }, [odswiez]);
    const akcja = async (p: Publikacja, co: 'zatwierdz' | 'odrzuc' | 'zmien') => {
        setPracuje(p.id);
        try {
            const e = edycja[p.id];
            if (e && (co === 'zmien' || co === 'zatwierdz')) await zMostu(`/api/youtube/publikacje/${p.id}/zmien`, { method: 'POST', body: JSON.stringify({ tytul: e.tytul, opis: e.opis, tagi: e.tagi.split(',').map((x) => x.trim()).filter(Boolean) }) });
            if (co === 'zatwierdz') await zMostu(`/api/youtube/publikacje/${p.id}/zatwierdz`, { method: 'POST', body: '{}' });
            if (co === 'odrzuc') await zMostu(`/api/youtube/publikacje/${p.id}/odrzuc`, { method: 'POST', body: '{}' });
            toast.success(co === 'zatwierdz' ? `„${e?.tytul ?? p.tytul}” idzie na YouTube${p.kanalNazwa ? ` (${p.kanalNazwa})` : ''} — niepubliczny.` : co === 'odrzuc' ? 'Odrzucona.' : 'Zapisano poprawki.');
            setEdycja((x) => { const n = { ...x }; delete n[p.id]; return n; });
            await odswiez();
        } catch (e) { toast.error(String(e instanceof Error ? e.message : e), { duration: 8000 }); }
        finally { setPracuje(null); }
    };
    if (!lista) return null;
    const widoczne = lista.filter((p) => p.etap !== 'odrzucona').slice(0, 20);
    return (
        <div className="rounded-lg border border-red-500/20 p-3 text-[11px]">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-red-300">🎬 Publikacje YouTube od stada</div>
            {!widoczne.length && <p className="text-[10px] text-slate-500">Pusto. Film na YouTube przygotujesz przyciskiem 📺 przy filmie na Wystawie albo „Wyślij” w Bibliotece odcinków (plan z kanałem YouTube) — Kronikarz napisze tytuł, opis i tagi.</p>}
            {widoczne.map((p) => {
                const e = edycja[p.id];
                const doAkc = p.etap === 'do_akceptacji' || p.etap === 'blad';
                return (
                    <div key={p.id} className="mb-2 rounded border border-white/5 bg-black/30 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-400">{ETAP[p.etap] ?? p.etap}</span>
                            <span className="truncate text-[10px] text-slate-600" title={p.nazwa}>{p.nazwa}</span>
                            {p.model && <span className="text-[9px] text-slate-600">· {p.model}</span>}
                            {!doAkc && p.kanalNazwa && <span className="text-[10px] text-slate-500">→ {p.kanalNazwa}</span>}
                            {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="ml-auto text-red-300 underline">{p.url}</a>}
                        </div>
                        {(p.blad || p.uwaga) && <div className="mt-1 text-[10px] text-amber-300">{p.blad ?? p.uwaga}</div>}
                        {doAkc && (
                            <div className="mt-2 flex flex-col gap-1.5">
                                <input value={e?.tytul ?? p.tytul ?? ''} maxLength={100} onChange={(ev) => setEdycja((x) => ({ ...x, [p.id]: { tytul: ev.target.value, opis: x[p.id]?.opis ?? p.opis ?? '', tagi: x[p.id]?.tagi ?? (p.tagi ?? []).join(', ') } }))} placeholder="tytuł" className="rounded border border-slate-700 bg-black/40 px-2 py-1 font-bold text-slate-100" />
                                <textarea value={e?.opis ?? p.opis ?? ''} rows={4} onChange={(ev) => setEdycja((x) => ({ ...x, [p.id]: { tytul: x[p.id]?.tytul ?? p.tytul ?? '', opis: ev.target.value, tagi: x[p.id]?.tagi ?? (p.tagi ?? []).join(', ') } }))} placeholder="opis" className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-300" />
                                <input value={e?.tagi ?? (p.tagi ?? []).join(', ')} onChange={(ev) => setEdycja((x) => ({ ...x, [p.id]: { tytul: x[p.id]?.tytul ?? p.tytul ?? '', opis: x[p.id]?.opis ?? p.opis ?? '', tagi: ev.target.value } }))} placeholder="tagi, po przecinku" className="rounded border border-slate-700 bg-black/40 px-2 py-1 font-mono text-[10px] text-slate-400" />
                                {kanaly.length > 0 && (
                                    <label className="flex items-center gap-2 text-[10px] text-slate-400">kanał:
                                        <select value={p.kanalId ?? ''} onChange={(ev) => void zmienKanal(p, ev.target.value)} className="rounded border border-slate-700 bg-black/60 px-1.5 py-0.5 text-slate-200">
                                            {!p.kanalId && <option value="">— domyślny —</option>}
                                            {kanaly.map((k) => <option key={k.id} value={k.id}>{k.nazwa || k.id}</option>)}
                                        </select>
                                    </label>
                                )}
                                <div className="flex gap-2">
                                    <button disabled={pracuje === p.id} onClick={() => void akcja(p, 'zatwierdz')} className="rounded bg-emerald-600/50 px-3 py-1 font-bold text-emerald-50">✓ Wyślij na YouTube</button>
                                    {e && <button disabled={pracuje === p.id} onClick={() => void akcja(p, 'zmien')} className="rounded bg-slate-700/60 px-2 py-1 text-slate-200">zapisz poprawki</button>}
                                    <button disabled={pracuje === p.id} onClick={() => void akcja(p, 'odrzuc')} className="ml-auto rounded bg-rose-600/30 px-2 py-1 text-rose-100">✕</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/** Przycisk 📺 przy filmie na Wystawie: Kronikarz przygotowuje publikację (czeka potem na ✓). */
export async function przygotujZWystawy(wystawaId: string): Promise<string> {
    const d = await zMostu<{ publikacja: Publikacja }>('/api/youtube/publikacje/przygotuj', { method: 'POST', body: JSON.stringify({ wystawaId }) });
    return d.publikacja.etap === 'do_akceptacji' ? `Kronikarz przygotował „${d.publikacja.tytul}” — czeka na Twoje ✓ w Impresariacie albo w Izbie na telefonie.` : (d.publikacja.blad ?? ETAP[d.publikacja.etap] ?? d.publikacja.etap);
}
