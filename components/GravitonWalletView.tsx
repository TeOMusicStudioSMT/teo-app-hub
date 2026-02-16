

import React, { useState, useEffect } from 'react';
import DashboardCard from './DashboardCard';
import { WalletIcon, ShieldCheckIcon, BrainCircuitIcon } from './icons';
import { useAtomValue } from 'jotai';
import { walletAtom } from '../store/wallet';
import * as gravitonClient from '../lib/graviton/client';
import { GravitonActivity } from '../lib/graviton/types';
import { cn } from '../lib/helpers';
import { GravitonNode, NetworkSimulator, ValidationStatus } from '../lib/graviton/node';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const tierStyles: { [key: string]: string } = {
    'Low': 'text-slate-400 border-slate-500',
    'Medium': 'text-cyan-400 border-cyan-500 shadow-cyan-500/30',
    'High': 'text-violet-400 border-violet-500 shadow-violet-500/30',
    'Superposition': 'superposition-text border-amber-400 shadow-amber-400/30'
};

const activityTypeStyles = {
    INBOUND: { text: 'text-green-400', symbol: '+' },
    OUTBOUND: { text: 'text-rose-400', symbol: '-' },
    STAKE: { text: 'text-sky-400', symbol: 'S' },
    YIELD: { text: 'text-amber-400', symbol: 'Y' },
};

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
);

// --- Node Monitor Component ---
const NodeMonitor: React.FC<{ isProcessing: boolean; stage: string; onSimulate: () => void }> = ({ isProcessing, stage, onSimulate }) => {
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        if (isProcessing) {
            setLogs(prev => [...prev.slice(-4), `> ${stage}`]);
        }
    }, [stage, isProcessing]);

    return (
        <div className="bg-black/90 rounded-lg p-4 font-mono text-xs border border-slate-700 h-full flex flex-col relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
            {/* Matrix/Scanlines Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:100%_3px] pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-1">
                <span className="text-green-500 font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    GRAVITON NODE
                </span>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onSimulate(); }}
                        disabled={isProcessing}
                        className="text-[10px] px-2 py-0.5 rounded border border-slate-700 hover:border-cyan-500 hover:text-cyan-400 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                        <PlayIcon /> Sim Tx
                    </button>
                    <span className="text-slate-500">v0.9.2</span>
                </div>
            </div>
            
            <div className="flex-grow space-y-1 text-slate-300">
                <div className="flex justify-between">
                    <span>STATUS:</span>
                    <span className="text-cyan-400">SYNCED (MAINNET)</span>
                </div>
                <div className="flex justify-between">
                    <span>PEERS:</span>
                    <span className="text-cyan-400">12 ACTIVE</span>
                </div>
                <div className="flex justify-between">
                    <span>PoBI SCORE:</span>
                    <span className="text-green-400">98% (TRUSTED)</span>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-800">
                     {logs.map((log, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-green-400/80 truncate"
                        >
                            {log}
                        </motion.div>
                    ))}
                    {isProcessing && (
                        <motion.span 
                            animate={{ opacity: [0, 1, 0] }} 
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="text-green-500 font-bold"
                        >
                            _
                        </motion.span>
                    )}
                </div>
            </div>
        </div>
    );
};

export const GravitonWalletView: React.FC = () => {
    const wallet = useAtomValue(walletAtom);
    const [activity, setActivity] = useState<GravitonActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Node Simulation State
    const [node] = useState(new GravitonNode());
    const [simState, setSimState] = useState({
        isProcessing: false,
        stage: 'IDLE',
        status: 'IDLE' as ValidationStatus | 'IDLE'
    });

    useEffect(() => {
        const fetchActivity = async () => {
            setIsLoading(true);
            const data = await gravitonClient.getActivity();
            setActivity(data);
            setIsLoading(false);
        };
        fetchActivity();
    }, []);

    const handleSimulateTransaction = async () => {
        if (simState.isProcessing) return;

        setSimState({ isProcessing: true, stage: 'INITIATING HANDSHAKE...', status: 'IDLE' });

        // Phase 1: Biometric/Behavioral Scan
        setTimeout(() => setSimState(prev => ({ ...prev, stage: 'SCANNING BEHAVIORAL BIOMETRICS...' })), 800);

        // Phase 2: Validation
        setTimeout(async () => {
            setSimState(prev => ({ ...prev, stage: 'VALIDATING PoBI INTEGRITY...' }));
            
            // Call logic
            const integrity = Math.floor(Math.random() * 20) + 80; // Random 80-100 score
            const result = await node.validateTransaction({
                senderDid: 'did:key:user',
                recipientDid: 'did:key:shop',
                amount: 50,
                signature: 'mock_sig',
                timestamp: Date.now()
            }, integrity);

            // Phase 3: Network Broadcast
            setSimState(prev => ({ ...prev, stage: `CONSENSUS REACHED: ${result.status}` }));
            await NetworkSimulator.broadcastToMesh(result);

            setTimeout(() => {
                setSimState(prev => ({ ...prev, stage: 'MINING BLOCK...', status: result.status }));
                toast.success(`Block Mined! Kinetic Yield Applied.`);
                
                setTimeout(() => {
                    setSimState({ isProcessing: false, stage: 'IDLE', status: 'IDLE' });
                }, 2000);
            }, 1000);

        }, 2500);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel: Balance & Node Visualizer */}
            <div className="lg:col-span-1 flex flex-col gap-4">
                <DashboardCard title="Core Balance" icon={<WalletIcon />}>
                    <div className="flex flex-col items-center justify-center text-center p-4">
                        <p className="text-lg text-slate-400 uppercase tracking-widest">Frequency Tier</p>
                        <p className={cn(
                            "text-3xl font-bold my-2 transition-all duration-300 border-b-2 pb-2",
                             tierStyles[wallet.frequencyTier] || tierStyles['Low']
                        )}>
                            {wallet.frequencyTier}
                        </p>
                        
                        <div className="mt-4">
                             <p className="text-lg text-slate-400 uppercase tracking-widest">Available Balance</p>
                             <p className="text-4xl font-bold text-white">
                                 {wallet.balance ? parseFloat(wallet.balance).toLocaleString() : '...'} GRV
                             </p>
                             {wallet.isGenesisNode && (
                                 <span className="inline-block mt-2 px-2 py-0.5 bg-amber-900/30 border border-amber-500/50 rounded text-[10px] text-amber-400 uppercase font-bold tracking-wider">
                                     Genesis Node
                                 </span>
                             )}
                        </div>
                    </div>
                </DashboardCard>

                {/* Node Simulator UI */}
                <div className="h-64 relative group">
                    <NodeMonitor isProcessing={simState.isProcessing} stage={simState.stage} onSimulate={handleSimulateTransaction} />
                    
                    {/* Flash Effect for Validation */}
                    <AnimatePresence>
                        {simState.status === 'FAST_LANE' && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: [0, 0.8, 0] }} 
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-green-500/30 z-20 pointer-events-none rounded-lg mix-blend-screen"
                            />
                        )}
                        {simState.status === 'QUARANTINE' && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: [0, 0.8, 0] }} 
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-rose-500/30 z-20 pointer-events-none rounded-lg mix-blend-screen"
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Right Panel: Activity Log */}
            <div className="lg:col-span-2">
                <DashboardCard title="Distributed Ledger" icon={<ShieldCheckIcon />}>
                    <div className="pr-2 space-y-2 overflow-y-auto max-h-[calc(100vh-22rem)]">
                        {isLoading ? (
                            <p className="text-slate-400 text-center py-8">Syncing with mainnet...</p>
                        ) : (
                            activity.map(tx => {
                                const typeStyle = activityTypeStyles[tx.type];
                                return (
                                    <div key={tx.id} className="grid grid-cols-12 items-center p-3 bg-slate-800/50 rounded-md text-sm gap-2 border-l-2 border-transparent hover:border-cyan-500 transition-colors">
                                        <div className="col-span-1 flex items-center justify-center">
                                            <span className={`font-bold text-lg ${typeStyle.text}`}>{typeStyle.symbol}</span>
                                        </div>
                                        <div className="col-span-6">
                                            <p className="font-semibold text-white truncate">{tx.peer}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-slate-400 font-mono">{tx.id}</p>
                                                <span className="text-[10px] bg-slate-700 px-1 rounded text-slate-300">
                                                    {tx.type === 'YIELD' ? 'Kinetic' : 'Confirmed'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`col-span-5 text-right font-mono font-bold ${typeStyle.text}`}>
                                             {tx.amount.toFixed(2)} GRV
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DashboardCard>
            </div>
        </div>
    );
};