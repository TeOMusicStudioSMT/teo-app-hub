/**
 * 🛠️ Panel zbudowany przez Suwerena — warsztat gatunku bez wbudowanego panelu.
 *
 * Każdy guzik woła DOKŁADNIE tę trasę mostu, która została wybrana w kreatorze
 * i sprawdzona przy zapisie. Odpowiedź pokazujemy surową, razem ze statusem —
 * także wtedy, gdy most odmówił. Zielone „gotowe!" po nieudanym wywołaniu
 * byłoby atrapą na ostatnim metrze, a tu chodzi o narzędzie, nie o dekorację.
 */
import React, { useState } from 'react';
import { Wrench, Play, Trash2, Store } from 'lucide-react';
import { wywolajNarzedzie, usunPanel, type PanelDef, type Narzedzie } from '../../lib/paneleTeogochi';

interface Props {
    panel: PanelDef;
    kolor: string;
    onUsuniety: () => void;
}

const Narzedzie_: React.FC<{ n: Narzedzie; kolor: string }> = ({ n, kolor }) => {
    const [parametry, setParametry] = useState<Record<string, string>>({});
    const [cialo, setCialo] = useState('{}');
    const [wynik, setWynik] = useState<{ status: number; tekst: string } | null>(null);
    const [zajety, setZajety] = useState(false);

    const potrzebneParametry = n.parametry ?? [];
    const brakuje = potrzebneParametry.some(p => !parametry[p]?.trim());
    const zCialem = n.metoda !== 'GET' && n.metoda !== 'HEAD';

    const odpal = async () => {
        setZajety(true);
        setWynik(await wywolajNarzedzie(n, parametry, cialo));
        setZajety(false);
    };

    const udane = wynik !== null && wynik.status >= 200 && wynik.status < 300;

    return (
        <div className="rounded-lg border border-slate-700/60 bg-black/30 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: n.metoda === 'GET' ? '#1e293b' : '#422006', color: n.metoda === 'GET' ? '#94a3b8' : '#fbbf24' }}>
                    {n.metoda}
                </span>
                <code className="text-[11px] text-slate-300 truncate flex-1">{n.sciezka}</code>
                <button onClick={odpal} disabled={zajety || brakuje}
                    title={brakuje ? 'Uzupełnij parametry trasy' : 'Wywołaj'}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-slate-900 shrink-0 disabled:opacity-40"
                    style={{ background: kolor }}>
                    <Play size={10} /> {zajety ? '…' : 'Odpal'}
                </button>
            </div>

            {potrzebneParametry.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                    {potrzebneParametry.map(p => (
                        <input key={p} value={parametry[p] ?? ''}
                            onChange={e => setParametry(s => ({ ...s, [p]: e.target.value }))}
                            placeholder={`:${p}`}
                            className="min-w-0 flex-1 rounded border border-slate-700 bg-black/50 px-2 py-1 text-[11px] font-mono outline-none focus:border-slate-500" />
                    ))}
                </div>
            )}

            {zCialem && (
                <textarea value={cialo} onChange={e => setCialo(e.target.value)} rows={2}
                    className="w-full rounded border border-slate-700 bg-black/50 px-2 py-1 text-[11px] font-mono outline-none focus:border-slate-500"
                    placeholder='{"klucz": "wartość"}' />
            )}

            {wynik && (
                <div className="rounded bg-black/50 p-2">
                    <div className="text-[10px] font-mono mb-1" style={{ color: udane ? '#34d399' : '#fbbf24' }}>
                        HTTP {wynik.status || '—'}
                    </div>
                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                        {wynik.tekst.slice(0, 1500)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export const PanelWlasny: React.FC<Props> = ({ panel, kolor, onUsuniety }) => {
    const [potwierdz, setPotwierdz] = useState(false);

    const usun = async () => {
        try { await usunPanel(panel.gatunek); onUsuniety(); } catch { /* most milczy */ }
    };

    return (
        <section className="rounded-2xl border p-5 space-y-4"
            style={{ borderColor: `${kolor}4d`, background: `${kolor}0d` }}>
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Wrench size={18} style={{ color: kolor }} />
                    <h3 className="font-bold text-slate-100">Warsztat — {panel.nazwa}</h3>
                    <span className="text-[10px] font-mono text-slate-500">
                        {panel.domena ?? '—'} · {panel.narzedzia.length} narzędzi
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {panel.ofertaId && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-amber-300/80">
                            <Store size={11} /> wystawiony
                        </span>
                    )}
                    {potwierdz ? (
                        <button onClick={usun} className="text-[11px] text-red-400 hover:text-red-300">na pewno usunąć?</button>
                    ) : (
                        <button onClick={() => setPotwierdz(true)} title="usuń panel"
                            className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
                    )}
                </div>
            </header>

            <div className="grid gap-2 lg:grid-cols-2">
                {panel.narzedzia.map(n => (
                    <Narzedzie_ key={`${n.metoda} ${n.sciezka}`} n={n} kolor={kolor} />
                ))}
            </div>

            <p className="text-[10px] text-slate-600 leading-relaxed">
                Każdy guzik woła prawdziwą trasę mostu — tę, która została sprawdzona przy zapisie panelu.
                Odpowiedź widzisz surową, razem ze statusem, także gdy most odmówi.
            </p>
        </section>
    );
};

export default PanelWlasny;
