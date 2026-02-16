
import React from 'react';
import { motion } from 'framer-motion';
import { PendingIncident } from '../../types';


interface IncidentCardProps {
    incident: PendingIncident;
    onResolve: (incidentId: string, decision: 'Approve' | 'Reject') => void;
    isProcessing: boolean;
}

function timeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const getPriorityStyles = (score: number) => {
    if (score > 90) return { border: 'border-rose-500', bg: 'bg-rose-500', text: 'text-rose-400' };
    if (score > 75) return { border: 'border-amber-500', bg: 'bg-amber-500', text: 'text-amber-400' };
    return { border: 'border-sky-500', bg: 'bg-sky-500', text: 'text-sky-400' };
};


export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onResolve, isProcessing }) => {
    const { border, bg, text } = getPriorityStyles(incident.confidenceScore);

    return (
        <div className={`bg-slate-800/70 p-4 rounded-xl border border-slate-700 border-l-4 ${border} transition-opacity ${isProcessing ? 'opacity-50' : ''}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <p className={`font-bold uppercase text-sm ${text}`}>
                    {incident.incidentType.replace('_', ' ')}
                </p>
                <p className="text-xs text-slate-400">{timeAgo(incident.timestamp)}</p>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <p className="text-xs text-slate-400">User ID</p>
                    <p className="font-mono text-white truncate">{incident.userId}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-400">AI Confidence</p>
                    <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-700 rounded-full h-2.5 mt-1">
                             <div className={`${bg} h-2.5 rounded-full`} style={{ width: `${incident.confidenceScore}%` }}></div>
                        </div>
                        <span className={`font-bold ${text}`}>{incident.confidenceScore}%</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-700/50">
                <button 
                    onClick={() => onResolve(incident.incidentId, 'Reject')}
                    disabled={isProcessing}
                    className="capsule-button capsule-rose"
                >
                    {isProcessing ? 'Processing...' : 'Reject'}
                </button>
                <button
                    onClick={() => onResolve(incident.incidentId, 'Approve')}
                    disabled={isProcessing}
                    className="capsule-button capsule-green"
                >
                     {isProcessing ? 'Processing...' : 'Approve'}
                </button>
            </div>
        </div>
    );
};
