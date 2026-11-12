/**
 * 🧱📱 Świat i telefon — dwa widoki z menu „Moduły Katedry".
 *
 * Suweren (2026-09-25): „nigdzie nie mogę znaleźć tego Stołu w dashboardzie czy zakładkach".
 * Karta StoL siedziała głęboko na Dashboardzie, a Świat klocków tylko jako link z niej.
 * Teraz oba mają własne pozycje w menu:
 *   · SwiatKlockowView — scena mostu (/swiat/) osadzona w Hubie (ten sam origin co most,
 *     więc Straż widzi „maszynę" i pokazuje przyciski zmian: projekty, silniki, rzeźbę),
 *   · TelefonView — StoL (apka, obserwacja stada) i Delegat Mobilny (strona, rozmowa)
 *     obok siebie, z jednym zdaniem, czym się różnią.
 */
import React, { useState } from 'react';
import { ExternalLink, Smartphone } from 'lucide-react';
import { StolCard } from './dashboard/StolCard';
import { DelegatCard } from './dashboard/DelegatCard';
import { StolMobilny } from './special/StolMobilny';

const MOST = 'http://127.0.0.1:3001';

export const SwiatKlockowView: React.FC = () => (
    <div className="w-full flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1">
            <div>
                <h2 className="text-xl font-bold text-white">🧱 Świat klocków</h2>
                <p className="text-xs text-slate-400">Płytki TeOgochi z prawdziwych dzieł Katedry, projekty stada, film klockowy. Na telefonie ten sam świat pokazuje StoL.</p>
            </div>
            <a href={`${MOST}/swiat/`} target="_blank" rel="noopener" className="shrink-0 flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200">
                <ExternalLink className="w-3.5 h-3.5" /> W osobnej karcie
            </a>
        </div>
        <iframe
            title="Świat klocków"
            src={`${MOST}/swiat/`}
            className="w-full rounded-2xl border border-slate-700/60 bg-slate-950"
            style={{ height: 'min(78vh, 900px)' }}
            allow="fullscreen"
        />
        <p className="text-[11px] text-slate-500 px-1">Pusto? Most (Wiesio-Bridge) musi działać na :3001 — Świat to jego strona, nie Huba.</p>
    </div>
);

export const TelefonView: React.FC = () => {
    const [widok, setWidok] = useState<'stol' | 'parowanie'>('stol');

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>📱 Katedra w telefonie</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono">
                            StoL 0.00G
                        </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        <b className="text-slate-300">StoL</b> to mobilna Katedra pod kciuk: Kwantowy Stół Narad, pamięć akaszy, EXP Jaja, obserwacja stada i projekty.
                    </p>
                </div>

                {/* Nawigacja zakładek StoL */}
                <div className="flex rounded-xl bg-slate-900/90 border border-slate-700/80 p-1 shrink-0 font-mono text-xs">
                    <button
                        onClick={() => setWidok('stol')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            widok === 'stol'
                                ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>🪑 Stół Narad</span>
                    </button>
                    <button
                        onClick={() => setWidok('parowanie')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            widok === 'parowanie'
                                ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>📲 Parowanie & Tunel</span>
                    </button>
                </div>
            </div>

            {widok === 'stol' ? (
                <div className="w-full max-w-4xl mx-auto">
                    <StolMobilny />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    <StolCard />
                    <DelegatCard />
                </div>
            )}
        </div>
    );
};
