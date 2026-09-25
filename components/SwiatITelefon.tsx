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
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { StolCard } from './dashboard/StolCard';
import { DelegatCard } from './dashboard/DelegatCard';

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

export const TelefonView: React.FC = () => (
    <div className="w-full flex flex-col gap-4">
        <div className="px-1">
            <h2 className="text-xl font-bold text-white">📱 Katedra w telefonie</h2>
            <p className="text-xs text-slate-400">
                <b className="text-slate-300">StoL</b> to apka na Androida: patrzysz na całe stado na żywo, Świat klocków, projekty (i zakładasz nowe).{' '}
                <b className="text-slate-300">Delegat Mobilny</b> to strona w przeglądarce telefonu: rozmawiasz z jednym TeOgochi, który może coś zlecić.
                Oba idą przez ten sam Kwantowy Tunel.
            </p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <StolCard />
            <DelegatCard />
        </div>
    </div>
);
