/**
 * 🌌 NetworkOfLoci — mapa TWOJEJ Katedry, nie wymyślonego kosmosu.
 *
 * ⚠️ CO TU BYŁO DO 2026-08-15 (i dlaczego Suweren słusznie nie wiedział, po co
 * to jest): trzy WYMYŚLONE aktywa — „Aethelgard's Echo", „Genesis Music Key",
 * „Orbital Deed #404" — wpisane na sztywno w plik, z fałszywymi skrótami
 * `0x7f3a...9b12` i etykietą „100% PoBI Verified". Napisy „Graviton Sync
 * Active" i migający „LIVE" były czystą ozdobą: nic się z niczym nie
 * synchronizowało. Przycisk „Incarnate Asset" pokazywał komunikat
 * „Waiting for Neural Link initialization…" i NIE ROBIŁ NIC.
 *
 * Odpowiedź na „z czym to się łączy?" brzmiała: z niczym.
 *
 * TERAZ pokazuje realne moduły Katedry i ich prawdziwy stan: czy Most żyje,
 * ile modułów jest w rejestrze, ile subskrybujesz, ile GRV masz w księdze
 * i czy jej łańcuch pieczęci jest spójny. Gdy Most nie stoi — mówi to wprost,
 * zamiast migać na zielono.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';
import { useEssenceIdentity } from '../hooks/useEssenceIdentity';
import { DigitalSelfAvatar } from './identity/DigitalSelfAvatar';
import { cn } from '../lib/helpers';
import {
    pobierzModuly, saldoWezla, integralnoscKsiegi, MOJ_WEZEL,
    type Modul, type StanRejestru,
} from '../lib/universa';

interface StanMapy {
    most: boolean | null;
    moduly: Modul[];
    rejestr: StanRejestru | null;
    grv: number | 'INFINITE' | null;
    ksiegaOk: boolean | null;
    dlugoscLancucha: number;
    powod?: string;
}

const BARWA_KATEGORII: Record<string, string> = {
    kreacja: 'text-fuchsia-300 border-fuchsia-500/50 bg-fuchsia-500/10',
    wiedza: 'text-cyan-300 border-cyan-500/50 bg-cyan-500/10',
    zabawa: 'text-amber-300 border-amber-500/50 bg-amber-500/10',
    narzedzie: 'text-emerald-300 border-emerald-500/50 bg-emerald-500/10',
};

export const NetworkOfLoci: React.FC = () => {
    const [stan, setStan] = useState<StanMapy>({
        most: null, moduly: [], rejestr: null, grv: null, ksiegaOk: null, dlugoscLancucha: 0,
    });
    const [wybrany, setWybrany] = useState<Modul | null>(null);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];
    const { identity } = useEssenceIdentity();

    useEffect(() => {
        let zywy = true;
        (async () => {
            try {
                const [m, w, k] = await Promise.all([
                    pobierzModuly(MOJ_WEZEL),
                    saldoWezla(MOJ_WEZEL).catch(() => null),
                    integralnoscKsiegi().catch(() => null),
                ]);
                if (!zywy) return;
                setStan({
                    most: true,
                    moduly: m.moduly,
                    rejestr: m.stan,
                    grv: w?.grv ?? null,
                    ksiegaOk: k?.ok ?? null,
                    dlugoscLancucha: k?.length ?? 0,
                });
            } catch (e) {
                if (zywy) setStan(s => ({ ...s, most: false, powod: e instanceof Error ? e.message : String(e) }));
            }
        })();
        return () => { zywy = false; };
    }, []);

    // Na orbicie pokazujemy do ośmiu modułów — więcej zamienia mapę w karuzelę.
    const naOrbicie = stan.moduly.slice(0, 8);

    return (
        <div className="w-full mb-8 relative">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-2xl font-bold text-cyan-300 drop-shadow-[0_0_4px_rgba(0,255,255,0.5)]">
                    Mapa Katedry
                    <span className="text-sm font-normal text-slate-400 ml-2">
                        / {stan.most ? `${stan.moduly.length} modułów w rejestrze` : 'stan nieznany'}
                    </span>
                </h2>

                {/* Wskaźnik mówi prawdę: zielono TYLKO gdy Most naprawdę odpowiedział. */}
                <div className={cn(
                    'flex items-center gap-2 text-xs font-mono px-2 py-1 rounded border',
                    stan.most === null ? 'text-slate-400 bg-slate-900/40 border-slate-600/40'
                        : stan.most ? 'text-green-400 bg-green-900/20 border-green-500/30'
                            : 'text-amber-400 bg-amber-900/20 border-amber-500/30',
                )}>
                    <div className={cn('w-2 h-2 rounded-full',
                        stan.most === null ? 'bg-slate-500' : stan.most ? 'bg-green-500 animate-pulse' : 'bg-amber-500')} />
                    {stan.most === null ? 'SPRAWDZAM' : stan.most ? 'MOST ŻYWY' : 'MOST NIE ODPOWIADA'}
                </div>
            </div>

            <div className="relative h-[400px] w-full bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden flex items-center justify-center shadow-2xl shadow-black/50">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(56,189,248,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(56,189,248,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

                {stan.most === false && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center p-8">
                        <div className="max-w-md text-center">
                            <div className="text-4xl mb-3">🌉</div>
                            <p className="text-amber-300 font-bold mb-1">Most nie odpowiada</p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Mapa pokazuje realne moduły Katedry, więc bez Mostu nie ma czego rysować.
                                Odpal Katedrę (START_KATEDRA.bat) i odśwież.
                            </p>
                            {stan.powod && <p className="mt-2 text-[10px] font-mono text-slate-600">{stan.powod}</p>}
                        </div>
                    </div>
                )}

                {/* Linie do modułów */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={theme.hex} stopOpacity="0" />
                            <stop offset="50%" stopColor={theme.hex} stopOpacity="0.5" />
                            <stop offset="100%" stopColor={theme.hex} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {naOrbicie.map((m, i) => {
                        const kat = (i / Math.max(1, naOrbicie.length)) * Math.PI * 2 - Math.PI / 2;
                        return (
                            <motion.line
                                key={`l-${m.id}`}
                                x1="50%" y1="50%"
                                x2={`${50 + Math.cos(kat) * 33}%`} y2={`${50 + Math.sin(kat) * 33}%`}
                                stroke="url(#line-gradient)" strokeWidth="1.5"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: m.subskrybowany ? [0.4, 0.9, 0.4] : [0.1, 0.3, 0.1] }}
                                transition={{ duration: 3, repeat: Infinity, delay: i * 0.35 }}
                            />
                        );
                    })}
                </svg>

                {/* Środek — Suweren */}
                <motion.div className="absolute z-20" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }}>
                    <div className={cn('relative rounded-full p-4 bg-slate-900 border border-slate-600 shadow-[0_0_30px_rgba(0,0,0,0.8)]', theme.tw.shadow)}>
                        <DigitalSelfAvatar form={identity?.avatarForm || 'humanoid'} color={theme.hex} sizeClass="w-16 h-16" />
                        <div className={cn('absolute inset-0 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite] opacity-30', theme.tw.border)} />
                    </div>
                    {stan.grv !== null && (
                        <div className="mt-2 text-center">
                            <div className="text-[9px] font-mono text-slate-500">TWOJE GRV</div>
                            <div className="text-sm font-bold text-amber-300">
                                {stan.grv === 'INFINITE' ? '∞' : Number(stan.grv).toLocaleString('pl-PL')}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Moduły na orbicie */}
                {naOrbicie.map((m, i) => {
                    const kat = (i / Math.max(1, naOrbicie.length)) * Math.PI * 2 - Math.PI / 2;
                    const promien = 150;
                    return (
                        <motion.div
                            key={m.id}
                            className={cn(
                                'absolute z-30 w-12 h-12 rounded-full border flex items-center justify-center cursor-pointer transition-all',
                                BARWA_KATEGORII[m.kategoria] ?? BARWA_KATEGORII.narzedzie,
                                wybrany?.id === m.id ? 'scale-125 z-40 ring-2 ring-white/50' : 'hover:scale-110',
                                !m.subskrybowany && !m.wbudowany && 'opacity-50',
                            )}
                            style={{ x: Math.cos(kat) * promien, y: Math.sin(kat) * promien }}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.15 + i * 0.07, type: 'spring' }}
                            onClick={() => setWybrany(m)}
                            title={m.nazwa}
                        >
                            <span className="text-xl drop-shadow-lg">{m.ikona}</span>
                        </motion.div>
                    );
                })}

                {/* Szczegóły — realne pola, nie wymyślone skróty */}
                <AnimatePresence>
                    {wybrany && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-4 right-4 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 shadow-2xl"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-cyan-200">{wybrany.ikona} {wybrany.nazwa}</h3>
                                <button onClick={() => setWybrany(null)} className="text-slate-500 hover:text-white">&times;</button>
                            </div>
                            <p className="text-xs text-slate-400 mb-3 leading-relaxed">{wybrany.opis || '—'}</p>
                            <div className="space-y-1.5 text-xs text-slate-300 mb-3">
                                <div className="flex justify-between"><span className="text-slate-500">Rodzaj</span><span>{wybrany.wbudowany ? 'część Katedry' : `dodany przez ${wybrany.autor ?? '—'}`}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Cena</span><span className={wybrany.cenaGRV ? 'text-amber-300' : 'text-emerald-300'}>{wybrany.cenaGRV ? `${wybrany.cenaGRV} GRV` : 'bez opłat'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Subskrybentów</span><span>{wybrany.subskrybentow}</span></div>
                            </div>
                            {wybrany.url ? (
                                <a href={wybrany.url} target={wybrany.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                                    className="block w-full text-center capsule-button capsule-violet text-sm py-2">
                                    Otwórz moduł
                                </a>
                            ) : (
                                // Uczciwie: nie każdy moduł ma osobne wejście — część żyje w zakładkach Katedry.
                                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                                    Ten moduł nie ma osobnego adresu — mieszka w zakładkach Katedry.
                                </p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Pasek prawdy o księdze */}
            {stan.most && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500">
                    <span>rejestr: {stan.rejestr?.modulowWbudowanych ?? 0} wbudowanych + {stan.rejestr?.modulowDodanych ?? 0} dodanych</span>
                    <span>subskrypcji: {stan.rejestr?.subskrypcji ?? 0}</span>
                    <span>wypraw: {stan.rejestr?.wypraw ?? 0} · wpłat: {stan.rejestr?.wplat ?? 0}</span>
                    {stan.ksiegaOk !== null && (
                        <span className={stan.ksiegaOk ? 'text-emerald-400' : 'text-red-400'}>
                            księga GRV: {stan.ksiegaOk ? `spójna (${stan.dlugoscLancucha} pieczęci)` : 'ŁAŃCUCH NARUSZONY'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
