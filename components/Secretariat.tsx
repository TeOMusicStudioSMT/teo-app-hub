
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { negotiateAccess, HandshakeResult } from '../lib/jwProtocol';
import { ShieldCheckIcon, CpuIcon } from './icons';
import { cn } from '../lib/helpers';

interface SecretariatProps {
    onVerified: (token: string) => void;
    onCancel: () => void;
    actionName?: string;
}

export const Secretariat: React.FC<SecretariatProps> = ({ onVerified, onCancel, actionName = "ACCESSING_SECURE_MODULE" }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isVerifying, setIsVerifying] = useState(false);
    const [status, setStatus] = useState<'idle' | 'verifying' | 'granted' | 'denied'>('idle');
    const scrollRef = useRef<HTMLDivElement>(null);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, msg]);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const startHandshake = async () => {
        setIsVerifying(true);
        setStatus('verifying');
        setLogs(["[SYSTEM]: Initializing jwProtocol handshake...", `[SYSTEM]: Destination: ${actionName}`]);

        try {
            const token = await negotiateAccess(addLog);
            setStatus('granted');
            addLog("[SYSTEM]: Verification Successful. Asset movement authorized.");

            setTimeout(() => {
                onVerified(token);
            }, 1000);
        } catch (error) {
            setStatus('denied');
            addLog("[ERROR]: Handshake rejected by Secretariat.");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        >
            <div className="w-full max-w-2xl bg-slate-950 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.1)] flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-6 border-b border-cyan-500/20 bg-slate-900/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-cyan-400 font-mono tracking-tighter flex items-center gap-2">
                            <ShieldCheckIcon className="w-6 h-6" /> TEO_SECRETARIAT_V1
                        </h2>
                        <p className="text-xs text-slate-500 font-mono uppercase">Officer: Pani Jadzia | Location: 33F</p>
                    </div>
                    <div className="text-right">
                        <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold font-mono border",
                            status === 'granted' ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" :
                                status === 'denied' ? "border-rose-500 text-rose-400 bg-rose-500/10" :
                                    status === 'verifying' ? "border-amber-500 text-amber-400 animate-pulse" : "border-slate-700 text-slate-500"
                        )}>
                            {status.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Terminal Area */}
                <div
                    ref={scrollRef}
                    className="flex-grow p-6 font-mono text-sm overflow-y-auto bg-black/40 custom-scrollbar"
                >
                    <AnimatePresence>
                        {logs.map((log, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "mb-2 leading-relaxed whitespace-pre-wrap",
                                    log.includes("[WIESŁAW") ? "text-cyan-300" :
                                        log.includes("[JADZIA") ? "text-amber-400" :
                                            log.includes("[SYSTEM") ? "text-slate-500" :
                                                log.includes("STAMP") ? "text-emerald-400 font-bold" : "text-slate-300"
                                )}
                            >
                                {log}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {status === 'idle' && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-10">
                            <CpuIcon className="w-12 h-12 text-slate-700 animate-pulse" />
                            <p className="text-slate-400 max-w-xs">
                                Verification required for <span className="text-cyan-400">[{actionName}]</span>.
                                Please initiate the protocol to verify identity.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                <div className="p-6 border-t border-cyan-500/20 bg-slate-900/50 flex gap-4">
                    {status === 'idle' ? (
                        <>
                            <button
                                onClick={onCancel}
                                className="flex-1 py-3 px-6 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors font-mono uppercase text-sm"
                            >
                                Abort
                            </button>
                            <button
                                onClick={startHandshake}
                                className="flex-1 py-3 px-6 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(8,145,178,0.4)] font-mono uppercase text-sm"
                            >
                                Initiate Handshake
                            </button>
                        </>
                    ) : status === 'verifying' ? (
                        <div className="w-full py-3 text-center text-slate-500 font-mono animate-pulse uppercase text-sm tracking-widest">
                            Negotiation in progress...
                        </div>
                    ) : status === 'granted' ? (
                        <div className="w-full py-3 text-center text-emerald-400 font-bold font-mono uppercase text-sm tracking-widest flex items-center justify-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5" /> ACCESS GRANTED
                        </div>
                    ) : (
                        <button
                            onClick={() => { setLogs([]); setStatus('idle'); }}
                            className="w-full py-3 px-6 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all font-mono uppercase text-sm"
                        >
                            Retry
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
