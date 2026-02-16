
import React, { useState, useEffect } from 'react';
import { IncidentCard } from './IncidentCard';
import toast from 'react-hot-toast';
import { ShieldExclamationIcon, ShieldCheckIcon } from '../icons';
import DashboardCard from '../DashboardCard';
import { AnimatePresence, motion } from 'framer-motion';
import { useAtom } from 'jotai';
import { adminIncidentsAtom } from '../../store';
import { PendingIncident } from '../../types';


export const AdminDashboard: React.FC = () => {
    const [incidents, setIncidents] = useAtom(adminIncidentsAtom);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        // Simulate initial loading, even though atom is synchronous
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
        }, 500);
    }, []);

    const handleResolve = async (incidentId: string, decision: 'Approve' | 'Reject') => {
        setProcessingId(incidentId);

        // In a real app, this would be a fetch call to:
        // fetch('/api/admin/human-in-the-loop/review', { method: 'POST', body: JSON.stringify({ incidentId, decision, ... }) })
        await new Promise(resolve => setTimeout(resolve, 750)); // Simulate network delay

        setIncidents(prev => prev.filter(inc => inc.incidentId !== incidentId));
        toast.success(`Incident ${incidentId} has been resolved as "${decision}".`);
        setProcessingId(null);
    };

    return (
        <DashboardCard title="Human-in-the-Loop Queue" icon={<ShieldExclamationIcon />}>
            <div className="pr-2 max-h-[calc(100vh-20rem)] overflow-y-auto">
                {loading && (
                    <div className="flex justify-center items-center h-48">
                        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                {!loading && incidents.length === 0 && (
                     <div className="flex flex-col justify-center items-center h-48 text-center text-slate-500">
                        <div className="w-12 h-12 mb-2"><ShieldCheckIcon /></div>
                        <p className="font-bold">Queue is clear.</p>
                        <p>No pending incidents require review.</p>
                    </div>
                )}
                <AnimatePresence>
                     {!loading && incidents.map(incident => (
                        <motion.div
                            key={incident.incidentId}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -50, transition: { duration: 0.3 } }}
                            className="mb-4"
                        >
                            <IncidentCard
                                incident={incident}
                                onResolve={handleResolve}
                                isProcessing={processingId === incident.incidentId}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </DashboardCard>
    );
};
