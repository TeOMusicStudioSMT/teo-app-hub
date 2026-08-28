/**
 * 🏛️ WORKPalace — podgląd, co TeOgochi robią i o czym rozmawiają.
 *
 * Karmi się WYŁĄCZNIE szyną zdarzeń (`/api/szyna/*`). Nic tu nie jest
 * domyślane ani symulowane: agent, który nie melduje, jest niewidoczny.
 * To świadome — puste okno mówi prawdę, wymyślona krzątanina by kłamała.
 *
 * Żywy podgląd idzie przez SSE; przy wejściu dociągamy ogon dziennika, żeby
 * po restarcie mostu nie zaczynać od pustki.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Users, MessageSquare } from 'lucide-react';
import { pobierzZdarzenia, sluchajSzyny, imieAgenta, type Zdarzenie, type Pracujacy } from '../../lib/szyna';
import { gatunekPo } from '../../lib/teogochiGatunki';

const BARWA_RODZAJU: Record<string, string> = {
    pytanie: '#a855f7',
    odpowiedz: '#22d3ee',
    blad: '#ef4444',
    start: '#84cc16',
    praca: '#fbbf24',
};

const kiedy = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('pl-PL'); } catch { return iso; }
};

export const WorkPalace: React.FC = () => {
    const [zdarzenia, setZdarzenia] = useState<Zdarzenie[]>([]);
    const [pracuja, setPracuja] = useState<Pracujacy[]>([]);
    const [zywy, setZywy] = useState(false);
    const dol = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void pobierzZdarzenia(120).then(d => { setZdarzenia(d.zdarzenia); setPracuja(d.pracuja); });
        const zamknij = sluchajSzyny(z => {
            setZywy(true);
            setZdarzenia(l => [...l.slice(-199), z]);
            setPracuja(p => {
                const bez = p.filter(x => x.agent !== z.agent);
                return [{ agent: z.agent, ostatnie: z.kiedy, rodzaj: z.rodzaj, tresc: z.tresc,
                          ile: (p.find(x => x.agent === z.agent)?.ile ?? 0) + 1 }, ...bez];
            });
        });
        return zamknij;
    }, []);

    useEffect(() => { dol.current?.scrollIntoView({ behavior: 'smooth' }); }, [zdarzenia.length]);

    return (
        <section className="rounded-2xl border border-purple-500/30 bg-purple-950/10 p-5 space-y-4">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Radio size={18} className="text-purple-400" />
                    <h3 className="font-bold text-purple-200">WORKPalace — co robią TeOgochi</h3>
                </div>
                <span className="flex items-center gap-2 text-[11px] font-mono">
                    <span className={`h-2 w-2 rounded-full ${zywy ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <span className="text-slate-400">{zywy ? 'szyna żywa' : 'czekam na sygnał'}</span>
                </span>
            </header>

            {/* Kto ostatnio pracował */}
            <div className="flex flex-wrap gap-2">
                {pracuja.length === 0 && (
                    <p className="text-xs text-slate-500">
                        Nikt jeszcze nie meldował. WORKPalace pokazuje tylko to, co agenci realnie
                        wyślą na szynę — pusto znaczy „cisza", a nie „zepsute".
                    </p>
                )}
                {pracuja.slice(0, 8).map(p => {
                    const g = gatunekPo(p.agent);
                    return (
                        <div key={p.agent}
                            className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                            style={{ borderColor: (g?.kolor ?? '#64748b') + '66', background: (g?.kolor ?? '#64748b') + '14' }}>
                            <span className="text-base leading-none">{g?.formy['pisklę'] ?? '🥚'}</span>
                            <span className="text-xs font-bold" style={{ color: g?.kolor ?? '#cbd5e1' }}>
                                {imieAgenta(p.agent)}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">{p.ile} · {kiedy(p.ostatnie)}</span>
                        </div>
                    );
                })}
            </div>

            {/* Strumień zdarzeń */}
            <div className="max-h-72 overflow-y-auto rounded-lg bg-black/40 p-3 space-y-1.5">
                <AnimatePresence initial={false}>
                    {zdarzenia.map(z => {
                        const g = gatunekPo(z.agent);
                        const rozmowa = z.rodzaj === 'pytanie' || z.rodzaj === 'odpowiedz';
                        return (
                            <motion.div key={z.id}
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-start gap-2 text-[11px] font-mono leading-relaxed">
                                <span className="text-slate-600 shrink-0">{kiedy(z.kiedy)}</span>
                                <span className="shrink-0">{g?.formy['pisklę'] ?? '·'}</span>
                                <span className="shrink-0 font-bold" style={{ color: g?.kolor ?? '#94a3b8' }}>
                                    {imieAgenta(z.agent)}
                                </span>
                                <span className="shrink-0 uppercase" style={{ color: BARWA_RODZAJU[z.rodzaj] ?? '#64748b' }}>
                                    {rozmowa && <MessageSquare size={10} className="inline mr-1" />}
                                    {z.rodzaj}
                                </span>
                                <span className="text-slate-300 whitespace-pre-wrap break-words">{z.tresc}</span>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={dol} />
            </div>

            <p className="flex items-start gap-2 text-[10px] text-slate-600 leading-relaxed">
                <Users size={12} className="mt-0.5 shrink-0" />
                <span>
                    Szyna nie uruchamia agentów ani ich nie podgląda — pokazuje meldunki, które
                    same wysyłają. Rozmowy między nimi (<b>pytanie</b> → <b>odpowiedz</b>) idą tą samą drogą.
                </span>
            </p>
        </section>
    );
};

export default WorkPalace;
