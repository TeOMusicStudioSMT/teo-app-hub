/**
 * 🔧 Panel Kodeksa — warsztat Mechanika Katedry.
 *
 * Kodeks to gatunek TeOgochi od kodu, a Mechanik pracuje w tle mostu od dawna —
 * tylko nikt nie widział, czym mieli, co ma i co mu się nie udało.
 *
 * ⚠️ ZNALEZIONY BŁĄD (naprawiony 2026-08-27): Mechanik miał na sztywno model
 * `'gemma4'` — GOŁY TAG, który Ollama rozwija do `gemma4:latest`, a ten wywala
 * silnik na tej maszynie. Do tego gemma to model OGÓLNY, a on ma naprawiać KOD.
 * Stąd trzy próby z rzędu kończące się tym samym `Expected ")" but found ":"`.
 * Teraz rdzeń jest wybieralny, domyślnie kodowy, a most ODMAWIA zapisu modelu,
 * którego Ollama nie zna (HTTP 422) — zamiast pozwolić mu paść w tle.
 *
 * Panel pokazuje TYLKO to, co most realnie oddaje. Żadnych wykresów z powietrza.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Wrench, RefreshCw, AlertTriangle, CheckCircle2, RotateCcw, FolderOpen } from 'lucide-react';

const MOST = 'http://127.0.0.1:3001';

interface WpisDziennika {
    kiedy: string; plik: string; wynik: 'wdrozone' | 'cofniete';
    czym?: string; blad?: string; cofnieto?: boolean;
}
interface CoWiem {
    model: string;
    katalogi: Record<string, { sciezka: string; ile: number }>;
    trasy: string[];
    zasada: string;
}

export const PanelKodeks: React.FC = () => {
    const [model, setModel] = useState('');
    const [modele, setModele] = useState<string[]>([]);
    const [wiedza, setWiedza] = useState<CoWiem | null>(null);
    const [dziennik, setDziennik] = useState<WpisDziennika[]>([]);
    const [bilans, setBilans] = useState({ wdrozone: 0, cofniete: 0 });
    const [kolejka, setKolejka] = useState<{ total: number; pending: number } | null>(null);
    const [blad, setBlad] = useState('');
    const [zajety, setZajety] = useState(false);

    const odswiez = useCallback(async () => {
        setBlad('');
        try {
            const [m, w, d, mo] = await Promise.all([
                fetch(`${MOST}/api/mechanic/model`).then(r => r.json()),
                fetch(`${MOST}/api/mechanic/co-wiem`).then(r => r.json()),
                fetch(`${MOST}/api/mechanic/dziennik?ile=20`).then(r => r.json()),
                fetch(`${MOST}/api/ollama/models`).then(r => r.json()),
            ]);
            setModel(m.model ?? '');
            setWiedza(w.success ? w : null);
            setDziennik(d.wpisy ?? []);
            setBilans({ wdrozone: d.wdrozone ?? 0, cofniete: d.cofniete ?? 0 });
            setModele(mo.models ?? []);
        } catch {
            setBlad('Most nie odpowiada — Mechanik pracuje w jego wnętrzu, więc bez mostu nic tu nie zobaczysz.');
        }
        // Kolejka osobno: jej brak nie może wywalić reszty panelu.
        try {
            const q = await (await fetch(`${MOST}/api/mechanic/queue`)).json();
            const zadania = q.tasks ?? [];
            setKolejka({ total: zadania.length, pending: zadania.filter((t: { status: string }) => t.status === 'PENDING').length });
        } catch { setKolejka(null); }
    }, []);

    useEffect(() => { void odswiez(); }, [odswiez]);

    const zmienModel = async (nowy: string) => {
        setZajety(true); setBlad('');
        try {
            const r = await fetch(`${MOST}/api/mechanic/model`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: nowy }),
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.message || 'Most odmówił.');
            setModel(d.model);
        } catch (e) {
            setBlad((e as Error).message);
        } finally { setZajety(false); }
    };

    return (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-4">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Wrench size={18} className="text-emerald-400" />
                    <h3 className="font-bold text-emerald-200">Kodeks — warsztat Mechanika</h3>
                </div>
                <button onClick={odswiez} className="rounded-lg border border-slate-700 px-2 py-1.5 text-slate-300 hover:border-slate-500">
                    <RefreshCw size={14} />
                </button>
            </header>

            {blad && (
                <p className="flex items-start gap-2 text-sm text-amber-400">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{blad}</span>
                </p>
            )}

            {/* Rdzeń — zmiana idzie do MOSTU, nie do localStorage, bo Mechanik
                pracuje w tle i o przeglądarce nic nie wie. */}
            <label className="block">
                <span className="text-[11px] font-mono text-slate-500">rdzeń Mechanika (działa w tle mostu)</span>
                <select
                    value={model}
                    onChange={e => zmienModel(e.target.value)}
                    disabled={zajety || !modele.length}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                    {!modele.includes(model) && model && <option value={model}>{model}</option>}
                    {modele.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="text-[10px] text-slate-600">
                    Most odmówi zapisu modelu, którego Ollama nie zna — Mechanik nie padnie po cichu w tle.
                </span>
            </label>

            {/* Bilans napraw — liczby z dziennika, nie z powietrza */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/30 p-2">
                    <div className="text-lg font-bold text-emerald-300">{bilans.wdrozone}</div>
                    <div className="text-[10px] text-slate-500">wdrożone</div>
                </div>
                <div className="rounded-lg bg-black/30 p-2">
                    <div className="text-lg font-bold text-amber-400">{bilans.cofniete}</div>
                    <div className="text-[10px] text-slate-500">cofnięte</div>
                </div>
                <div className="rounded-lg bg-black/30 p-2">
                    <div className="text-lg font-bold text-slate-300">
                        {kolejka ? `${kolejka.pending}/${kolejka.total}` : '—'}
                    </div>
                    <div className="text-[10px] text-slate-500">kolejka</div>
                </div>
            </div>

            {/* Co ma i gdzie to leży */}
            {wiedza && (
                <div className="rounded-lg bg-black/30 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                        <FolderOpen size={12} /> co mam i gdzie
                    </div>
                    {Object.entries(wiedza.katalogi).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3 text-[11px] font-mono">
                            <span className="text-slate-500">{k}</span>
                            <span className="text-slate-400 truncate flex-1">{v.sciezka}</span>
                            <span className="text-slate-300">{v.ile}</span>
                        </div>
                    ))}
                    <p className="text-[10px] text-emerald-400/80 pt-1 leading-relaxed">{wiedza.zasada}</p>
                </div>
            )}

            {/* Dziennik działań i wniosków */}
            <div>
                <div className="text-[11px] font-mono text-slate-500 mb-1">dziennik napraw</div>
                <div className="max-h-56 overflow-y-auto rounded-lg bg-black/40 p-2 space-y-1">
                    {dziennik.length === 0 && (
                        <p className="text-[11px] text-slate-600">
                            Pusto — Mechanik jeszcze niczego nie wdrożył ani nie cofnął.
                        </p>
                    )}
                    {[...dziennik].reverse().map((w, i) => (
                        <div key={i} className="text-[11px] font-mono leading-relaxed">
                            <div className="flex items-start gap-2">
                                {w.wynik === 'wdrozone'
                                    ? <CheckCircle2 size={12} className="mt-0.5 text-emerald-400 shrink-0" />
                                    : <RotateCcw size={12} className="mt-0.5 text-amber-400 shrink-0" />}
                                <span className="text-slate-600 shrink-0">{w.kiedy.slice(11, 19)}</span>
                                <span className="text-slate-300 truncate flex-1">{w.plik}</span>
                                <span className="text-slate-600 shrink-0">{w.czym}</span>
                            </div>
                            {w.blad && (
                                <pre className="ml-6 mt-0.5 text-[10px] text-amber-500/80 whitespace-pre-wrap">{w.blad}</pre>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <p className="text-[10px] text-slate-600 leading-relaxed">
                Wnioski z dziennika trafiają do modelu przy kolejnej próbie naprawy — to <b>pamięć</b>,
                nie douczanie wag. Mówimy to wprost, bo „uczy się" bywa mylące.
            </p>
        </section>
    );
};

export default PanelKodeks;
