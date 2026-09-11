/**
 * 💰 PORTFEL GRV — to, co KSIĘGA wie, i nic ponadto.
 *
 * ⚠️ ZASTĄPIŁ ATRAPĘ (2026-09-11). Poprzednia wersja pokazywała na głównym
 * ekranie Katedry `liquid = 100; solid = 3500; yielding = 500` wpisane na
 * sztywno, „⚡ 12.2% APY", „+8.4% Yield" i listę „Top Performing Assets"
 * z lib/mockData.ts („Aethelgard's Echo ▲12%") — podczas gdy prawdziwe saldo
 * Suwerena w księdze wynosiło 1 338 600 GRV. `walletAtom` był pobierany
 * i nigdy nie użyty. Atrapa na ekranie startowym uczy, że liczbom w Katedrze
 * nie wolno wierzyć — a to jest dokładnie to, czego Katedra ma NIE robić.
 *
 * ⚠️ NIE MA TU „STAKED", „APY" ANI „YIELD", bo w księdze GRV nie ma takich
 * pojęć. Księga zna: saldo, węzeł, tier, flagę Genesis. Marketplace zna
 * zakupy (/api/market/posiadane). Wszystko inne byłoby wymyślone.
 */

import React, { useEffect, useState } from 'react';
import DashboardCard from './DashboardCard';
import { ChartPieIcon } from './icons';
import { useAtomValue } from 'jotai';
import { walletAtom } from '../store/wallet';
import { cn } from '../lib/helpers';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';

const MOST = 'http://127.0.0.1:3001';

interface Posiadane {
    id: string;
    nazwa: string;
    modul: string;
    typ: string;
    zaplacono: number;
    kiedy: string;
}

const IKONA_TYPU: Record<string, string> = {
    button: '🔘', core: '🧠', panel: '🪟', skill: '🧩', voice: '🎙️', model: '🦙',
};

export const PortfolioDashboard: React.FC = () => {
    const wallet = useAtomValue(walletAtom);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    const [posiadane, setPosiadane] = useState<Posiadane[] | null>(null);
    const [bladZakupow, setBladZakupow] = useState('');

    useEffect(() => {
        if (!wallet.address) { setPosiadane(null); return; }
        let zywy = true;
        fetch(`${MOST}/api/market/posiadane?wezel=${encodeURIComponent(wallet.address)}`)
            .then((r) => r.json())
            .then((d) => { if (zywy) setPosiadane(Array.isArray(d.aktywa) ? d.aktywa : []); })
            .catch((e) => { if (zywy) setBladZakupow(e instanceof Error ? e.message : String(e)); });
        return () => { zywy = false; };
    }, [wallet.address]);

    // Saldo Zarządcy jest w księdze napisem „INFINITE" — pokazujemy ∞, nie NaN.
    const saldo = wallet.balance === null
        ? '—'
        : /INFINITE/i.test(wallet.balance) ? '∞' : Math.round(Number(wallet.balance)).toLocaleString('pl-PL');

    const sumaZaplacono = (posiadane ?? []).reduce((s, p) => s + (Number(p.zaplacono) || 0), 0);

    return (
        <DashboardCard title="Portfel GRV" icon={<ChartPieIcon />}>
            <div className="flex flex-col gap-5 h-full">

                {/* ── Saldo z księgi ── */}
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">saldo w księdze</div>
                        <div className="text-4xl font-bold text-white tracking-tighter">
                            {saldo} <span className={cn('text-lg font-mono', theme.tw.text)}>GRV</span>
                        </div>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-500 space-y-0.5">
                        <div>węzeł: <span className="text-slate-300">{wallet.address ?? 'niepołączony'}</span></div>
                        <div>tier: <span className="text-slate-300">{wallet.tier}</span>{wallet.isGenesisNode && <span className="text-amber-400"> · Genesis</span>}</div>
                    </div>
                </div>

                {!wallet.address && (
                    <div className="text-[10px] font-mono text-slate-500 border border-slate-700/50 rounded-lg p-3">
                        Portfel nie jest połączony z żadnym węzłem — saldo i zakupy pojawią się po wejściu na konto.
                    </div>
                )}

                {/* ── Zakupy z Marketplace — jedyne prawdziwe „assety" ── */}
                {wallet.address && (
                    <div>
                        <div className="flex items-baseline justify-between mb-2">
                            <h4 className={cn('text-sm font-bold uppercase tracking-wider', theme.tw.text)}>Posiadane w Marketplace</h4>
                            {posiadane && posiadane.length > 0 && (
                                <span className="text-[10px] font-mono text-slate-500">
                                    {posiadane.length} · wydane {sumaZaplacono.toLocaleString('pl-PL')} GRV
                                </span>
                            )}
                        </div>

                        {bladZakupow && (
                            <div className="text-[10px] font-mono text-red-300">Most nie oddał zakupów: {bladZakupow}</div>
                        )}
                        {posiadane === null && !bladZakupow && (
                            <div className="text-[10px] font-mono text-slate-600">czytam z mostu…</div>
                        )}
                        {posiadane && posiadane.length === 0 && (
                            <div className="text-[10px] font-mono text-slate-500">Jeszcze nic nie kupione — Marketplace czeka.</div>
                        )}

                        <div className="space-y-2">
                            {(posiadane ?? []).map((p) => (
                                <div key={p.id} className="flex items-center justify-between p-2 px-3 rounded-lg bg-slate-800/30 border border-transparent hover:border-slate-600 transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xl">{IKONA_TYPU[p.typ] ?? '📦'}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-200 truncate">{p.nazwa}</p>
                                            <p className="text-[10px] text-slate-500">{p.modul} · {p.typ}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-mono font-bold text-white">
                                            {Number(p.zaplacono) > 0 ? `${Number(p.zaplacono).toLocaleString('pl-PL')} GRV` : 'za darmo'}
                                        </p>
                                        <p className="text-[10px] text-slate-500">{new Date(p.kiedy).toLocaleDateString('pl-PL')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
};
