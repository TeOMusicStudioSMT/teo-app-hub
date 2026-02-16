import React from 'react';
import DashboardCard from '../DashboardCard';
import { ChartPieIcon } from '../icons';

const clarityLog = [
    { action: "Transfer 1000 GRV to @jano", clarity: 45, status: 'High Risk' },
    { action: "List 'Genesis Key' on Market", clarity: 98, status: 'Clear' },
    { action: "Stake 500 GRV", clarity: 95, status: 'Clear' },
];

export const ValueClarityCard: React.FC = () => {
    return (
        <DashboardCard title="Value Clarity Log" icon={<ChartPieIcon />}>
            <div className="space-y-3 h-full flex flex-col justify-around">
                {clarityLog.map((item, index) => (
                    <div key={index} className="p-2 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <p className="text-slate-200 text-sm">{item.action}</p>
                            <p className={`font-bold text-sm ${item.clarity > 80 ? 'text-green-400' : 'text-amber-400'}`}>
                                {item.clarity}%
                            </p>
                        </div>
                        <p className={`text-xs ${item.clarity > 80 ? 'text-slate-400' : 'text-amber-500'}`}>
                            Status: {item.status}
                        </p>
                    </div>
                ))}
            </div>
        </DashboardCard>
    );
};