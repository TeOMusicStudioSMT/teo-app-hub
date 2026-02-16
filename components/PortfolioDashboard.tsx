import React from 'react';
import DashboardCard from './DashboardCard';
// ✅ Używamy poprawnej nazwy ikony, która już działała w starym kodzie
import { ChartPieIcon } from './icons';
import { useAtomValue } from 'jotai';
import { walletAtom } from '../store/wallet';
import { topAssetsList } from '../lib/mockData'; // Przywracamy listę assetów
import { KineticChart } from './dashboard/KineticChart'; // ✅ Nasz nowy wykres
import { cn } from '../lib/helpers';
import { resonanceColorAtom, RESONANCE_THEMES } from '../store/personalization';

export const PortfolioDashboard: React.FC = () => {
    const wallet = useAtomValue(walletAtom);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    // Dane do wyświetlania w paskach (zamiast starego wykresu kołowego)
    const liquid = 100;
    const solid = 3500;
    const yielding = 500;
    const total = liquid + solid + yielding;

    return (
        <DashboardCard title="Assets & Kinetic Yield" icon={<ChartPieIcon />}>
            <div className="flex flex-col gap-6 h-full">

                {/* 1. SEKCJA GŁÓWNA: NOWY WYKRES KINETYCZNY */}
                <div className="w-full">
                    <KineticChart />
                </div>

                {/* 2. SEKCJA ROZKŁADU (Paski postępu zamiast koła) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {/* Liquid */}
                    <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Liquid (GRV)</span>
                            <span>{((liquid / total) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full mb-2">
                            <div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: `${(liquid / total) * 100}%` }}></div>
                        </div>
                        <div className="text-lg font-bold text-white">{liquid}</div>
                    </div>

                    {/* Solid Assets */}
                    <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Solid (Assets)</span>
                            <span>{((solid / total) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full mb-2">
                            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${(solid / total) * 100}%` }}></div>
                        </div>
                        <div className="text-lg font-bold text-white">{solid}</div>
                    </div>

                    {/* Yielding */}
                    <div className="md:col-span-2 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Yielding (Staked)</span>
                            <span className="text-amber-400 flex items-center gap-1">⚡ 12.2% APY</span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full mb-2">
                            <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${(yielding / total) * 100}%` }}></div>
                        </div>
                        <div className="text-lg font-bold text-white">{yielding}</div>
                    </div>
                </div>

                {/* 3. SEKCJA DOLNA: TOP PERFORMING ASSETS (Przywrócona ze starego pliku) */}
                <div className="mt-2">
                    <h4 className={cn("text-sm font-bold uppercase tracking-wider mb-3", theme.tw.text)}>Top Performing Assets</h4>
                    <div className="space-y-2">
                        {topAssetsList.map(asset => (
                            <div key={asset.id} className="flex items-center justify-between p-2 px-3 rounded-lg bg-slate-800/30 border border-transparent hover:border-slate-600 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl filter drop-shadow-sm">{asset.icon}</span>
                                    <div>
                                        <p className="text-sm font-bold text-slate-200">{asset.name}</p>
                                        <p className="text-[10px] text-slate-500">{asset.type}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-mono font-bold text-white">{asset.value} GRV</p>
                                    <p className={`text-[10px] font-bold ${asset.trend === 'up' ? 'text-green-400' : 'text-slate-500'}`}>
                                        {asset.trend === 'up' ? '▲' : '•'} {asset.trendValue}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </DashboardCard>
    );
};