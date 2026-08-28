/**
 * 🕸️ Panel Wektora — graf wiedzy Katedry (Graphify).
 *
 * ⚠️ TO BYŁA MOJA ZALEGŁOŚĆ. Trasy `/api/wiedza/*` powstały wcześniej i działają
 * (zmierzone: 11771 węzłów, 19709 krawędzi, 795 społeczności, koszt 0 tokenów),
 * ale NIE MIAŁY ŻADNEGO INTERFEJSU. Suweren słusznie zauważył, że „nie widzi
 * panela" — bo go nie było. Ten plik to nadrabia.
 *
 * Wektor jest gatunkiem od wiedzy, więc graf jest JEGO warsztatem.
 *
 * Co panel robi naprawdę:
 *   · stan grafu        → GET  /api/wiedza/stan       (rozmiar, data przeliczenia)
 *   · przelicz          → POST /api/wiedza/buduj      (AST, bez LLM, ~2 min)
 *   · wyjaśnij węzeł    → GET  /api/wiedza/wyjasnij
 *   · najkrótsza droga  → GET  /api/wiedza/sciezka
 *   · raport / wizualka → GET  /api/wiedza/raport, /api/wiedza/graf.html
 *
 * ⚠️ Surowy `graph.json` (~14 MB) NIE jest tu ładowany. Most świadomie go nie
 * wystawia — wpychanie czternastu megabajtów do przeglądarki nie jest usługą.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Network, RefreshCw, Search, Route, FileText, AlertTriangle } from 'lucide-react';

const MOST = 'http://127.0.0.1:3001';

interface StanGrafu {
    zainstalowany: boolean;
    graf: boolean;
    katalog: string;
    rozmiarMB?: number;
    policzony?: string;
    message?: string;
}

export const PanelWektor: React.FC = () => {
    const [stan, setStan] = useState<StanGrafu | null>(null);
    const [blad, setBlad] = useState('');
    const [zajety, setZajety] = useState(false);
    const [wynik, setWynik] = useState('');

    const [wezel, setWezel] = useState('');
    const [odA, setOdA] = useState('');
    const [doB, setDoB] = useState('');

    const odswiez = useCallback(async () => {
        setBlad('');
        try {
            const r = await fetch(`${MOST}/api/wiedza/stan`);
            setStan(await r.json());
        } catch (e) {
            setBlad('Most nie odpowiada — odpal Katedrę (START_KATEDRA.bat).');
            setStan(null);
        }
    }, []);

    useEffect(() => { void odswiez(); }, [odswiez]);

    /** Wspólny wjazd: pokazujemy POWÓD z mostu, nie sam kod HTTP. */
    const zawolaj = async (opis: string, wykonaj: () => Promise<Response>) => {
        setZajety(true); setBlad(''); setWynik(`⟳ ${opis}…`);
        try {
            const r = await wykonaj();
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d?.success === false) {
                throw new Error(d?.message || d?.hint || `HTTP ${r.status}`);
            }
            return d;
        } catch (e) {
            setBlad((e as Error).message);
            setWynik('');
            return null;
        } finally { setZajety(false); }
    };

    const przelicz = async () => {
        const d = await zawolaj('Liczę graf Katedry (AST, bez modelu — to potrwa)', () =>
            fetch(`${MOST}/api/wiedza/buduj`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            }));
        if (d) {
            setWynik(`✅ ${d.wezly} węzłów · ${d.krawedzie} krawędzi · ${d.spolecznosci} społeczności`);
            void odswiez();
        }
    };

    const wyjasnij = async () => {
        if (!wezel.trim()) { setBlad('Podaj nazwę węzła.'); return; }
        const d = await zawolaj(`Szukam „${wezel}"`, () =>
            fetch(`${MOST}/api/wiedza/wyjasnij?wezel=${encodeURIComponent(wezel.trim())}`));
        if (d) setWynik(d.opis || '(most nic nie zwrócił)');
    };

    const droga = async () => {
        if (!odA.trim() || !doB.trim()) { setBlad('Podaj oba końce drogi.'); return; }
        const d = await zawolaj(`Szukam drogi ${odA} → ${doB}`, () =>
            fetch(`${MOST}/api/wiedza/sciezka?a=${encodeURIComponent(odA.trim())}&b=${encodeURIComponent(doB.trim())}`));
        if (d) setWynik(d.sciezka || '(brak połączenia)');
    };

    const brakSilnika = stan && !stan.zainstalowany;

    return (
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-5 space-y-4">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Network size={18} className="text-cyan-400" />
                    <h3 className="font-bold text-cyan-200">Wektor — graf wiedzy Katedry</h3>
                </div>
                <button
                    onClick={odswiez}
                    className="rounded-lg border border-slate-700 px-2 py-1.5 text-slate-300 hover:border-slate-500"
                    title="Odśwież stan grafu"
                >
                    <RefreshCw size={14} />
                </button>
            </header>

            {blad && (
                <p className="flex items-start gap-2 text-sm text-amber-400">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{blad}</span>
                </p>
            )}

            {stan && (
                <div className="rounded-lg bg-black/30 p-3 text-xs font-mono text-slate-400 space-y-1">
                    <div>
                        silnik: {stan.zainstalowany
                            ? <span className="text-emerald-400">graphify obecny</span>
                            : <span className="text-amber-400">BRAK — moduł nie ma czym liczyć</span>}
                    </div>
                    {stan.graf ? (
                        <>
                            <div>graf: <span className="text-slate-300">{stan.rozmiarMB} MB</span></div>
                            <div>policzony: <span className="text-slate-300">
                                {stan.policzony ? new Date(stan.policzony).toLocaleString('pl-PL') : '—'}
                            </span></div>
                        </>
                    ) : (
                        <div className="text-amber-400">{stan.message || 'Grafu jeszcze nie ma.'}</div>
                    )}
                    <div className="text-slate-600 truncate">{stan.katalog}</div>
                </div>
            )}

            {brakSilnika && (
                <p className="text-xs text-amber-500/90 leading-relaxed">
                    ⚠ Graphify nie jest zainstalowany. W konsoli Katedry:
                    <code className="mx-1 text-cyan-300">zainstaluj repo graphify</code>
                </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                    <span className="text-[11px] font-mono text-slate-500">wyjaśnij węzeł</span>
                    <div className="mt-1 flex gap-2">
                        <input
                            value={wezel} onChange={e => setWezel(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && wyjasnij()}
                            placeholder="np. TeoArcadeForge"
                            className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm outline-none focus:border-cyan-500"
                        />
                        <button onClick={wyjasnij} disabled={zajety}
                            className="rounded-lg border border-cyan-500/50 px-3 text-cyan-300 disabled:opacity-40">
                            <Search size={15} />
                        </button>
                    </div>
                </label>

                <label className="block">
                    <span className="text-[11px] font-mono text-slate-500">najkrótsza droga</span>
                    <div className="mt-1 flex gap-2">
                        <input value={odA} onChange={e => setOdA(e.target.value)} placeholder="od"
                            className="w-full min-w-0 rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm outline-none focus:border-cyan-500" />
                        <input value={doB} onChange={e => setDoB(e.target.value)} placeholder="do"
                            className="w-full min-w-0 rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm outline-none focus:border-cyan-500" />
                        <button onClick={droga} disabled={zajety}
                            className="rounded-lg border border-cyan-500/50 px-3 text-cyan-300 disabled:opacity-40">
                            <Route size={15} />
                        </button>
                    </div>
                </label>
            </div>

            <div className="flex flex-wrap gap-2">
                <button onClick={przelicz} disabled={zajety || brakSilnika === true}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-40">
                    Przelicz graf
                </button>
                <a href={`${MOST}/api/wiedza/raport`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
                    <FileText size={15} /> Raport
                </a>
                <a href={`${MOST}/api/wiedza/graf.html`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
                    <Network size={15} /> Wizualizacja
                </a>
            </div>

            {wynik && (
                <pre className="max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                    {wynik}
                </pre>
            )}

            <p className="text-[10px] text-slate-600 leading-relaxed">
                Graf liczy się z AST, lokalnie, <b>za zero tokenów</b>. Surowy <code>graph.json</code>
                (~14 MB) świadomie nie jest tu ładowany — od tego jest raport i wizualizacja.
            </p>
        </section>
    );
};

export default PanelWektor;
