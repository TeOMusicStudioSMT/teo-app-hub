import React, { useState, useEffect } from 'react';
import DashboardCard from './DashboardCard';
import { ShieldCheckIcon, ClockIcon, CpuIcon, SignalIcon, EyeIcon, TruckIcon, MapIcon } from './icons';
import { useEssenceIdentity } from '../hooks/useEssenceIdentity';
import { ModeSelector } from './dashboard/ModeSelector';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import MobilePocketBadge from './special/MobilePocketBadge';

// --- Quantum Shield Mock Component ---
const QuantumShieldControl = () => (
    <div className="bg-slate-900/50 p-4 rounded border border-emerald-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse" />
        <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5" /> QUANTUM SHIELD ACTIVE
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-emerald-200/70">
            <div>
                <p>ULTRASONIC SCAN</p>
                <p className="text-white font-mono">18-22 kHz [CLEAN]</p>
            </div>
            <div>
                <p>GIBBER-LINK</p>
                <p className="text-white font-mono">0 DETECTED</p>
            </div>
        </div>
    </div>
);

// --- Rdzeń Lokalny (Gemma 4 / Gemma Diffusion) ---
const BRIDGE = 'http://127.0.0.1:3001';
const ENGINES = [
    { id: 'gemma4',          label: 'Gemma 4',         main: true,  desc: 'Główny rdzeń Katedry — szybki, lokalny.' },
    { id: 'gemma-diffusion', label: 'Gemma Diffusion', main: false, desc: 'Wariant dyfuzyjny (eksperymentalny).' },
];

const OfflineBrainControl = () => {
    const [active, setActive] = useState<string>(() => localStorage.getItem('otakos_active_model') || 'gemma4');
    const [status, setStatus] = useState<{ online?: boolean; hasGemma4?: boolean } | null>(null);
    const [pulling, setPulling] = useState(false);

    const loadStatus = async () => {
        try { setStatus(await (await fetch(`${BRIDGE}/api/models/status`)).json()); }
        catch { setStatus({ online: false }); }
    };
    useEffect(() => {
        if (!localStorage.getItem('otakos_active_model')) localStorage.setItem('otakos_active_model', 'gemma4');
        loadStatus();
        const iv = setInterval(loadStatus, 8000);
        return () => clearInterval(iv);
    }, []);

    const pick = (id: string) => { setActive(id); localStorage.setItem('otakos_active_model', id); toast.success(`Silnik: ${ENGINES.find(e => e.id === id)?.label}`); };
    const pull = async () => {
        setPulling(true);
        try { await fetch(`${BRIDGE}/api/models/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: active }) }); toast.success('Pobieranie modelu rozpoczęte (na USB).'); }
        catch { toast.error('Most offline (:3001).'); }
        finally { setPulling(false); }
    };

    const online = status?.online;
    const has = status?.hasGemma4;

    return (
        <DashboardCard title="Rdzeń Lokalny (Gemma 4)" icon={<CpuIcon />}>
            <div className="p-6 space-y-4">
                <MobilePocketBadge />
                <p className="text-slate-400 text-sm">Lokalny silnik AI — zero latencji, zero kosztów, zero chmury.</p>
                {/* Selektor silnika */}
                <div className="flex gap-2">
                    {ENGINES.map(e => (
                        <button key={e.id} onClick={() => pick(e.id)} title={e.desc}
                            className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${active === e.id ? 'border-cyan-500 text-cyan-300 bg-cyan-950/40' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            {e.label}{e.main && <span className="block text-[8px] opacity-60">MAIN</span>}
                        </button>
                    ))}
                </div>
                {/* Status */}
                <div className={`flex items-center gap-2 p-3 rounded ${online ? 'text-emerald-400 bg-emerald-900/20' : 'text-amber-400 bg-amber-900/20'}`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="font-mono text-sm">{online ? `RDZEŃ ONLINE${has ? ' · Gemma OK' : ' · brak modelu'}` : 'RDZEŃ OFFLINE (uruchom Ollama / pobierz)'}</span>
                </div>
                {(!online || !has) && (
                    <button onClick={pull} disabled={pulling}
                        className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                        <SignalIcon className="w-4 h-4" /> {pulling ? 'Pobieranie...' : `⬇️ Pobierz ${ENGINES.find(e => e.id === active)?.label} (na USB)`}
                    </button>
                )}
                <p className="text-[10px] text-slate-600">Pierwszy boot może pobrać model na pendrive (zalecane USB 25–64 GB). Domyślny silnik: Gemma 4.</p>
            </div>
        </DashboardCard>
    );
};

// --- Sub-views ---
const DashboardTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuantumShieldControl />
        <OfflineBrainControl />
    </div>
);

const DronesTab = () => <div className="p-10 text-center text-slate-600 border border-slate-800 border-dashed rounded">DRONE FLEET OFFLINE</div>;
const IntelTab = () => <div className="p-10 text-center text-slate-600 border border-slate-800 border-dashed rounded">RECON DATA EMPTY</div>;

export const FieldControlView: React.FC = () => {
    const { identity, isLoading } = useEssenceIdentity();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'drones' | 'intel' | 'comms' | 'supply'>('dashboard');

    if (isLoading || !identity) {
        return <div className="p-20 text-center animate-pulse text-cyan-400 tracking-tighter">SYNCING FIELD DATA...</div>;
    }

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <CpuIcon className="w-4 h-4" /> },
        { id: 'drones', label: 'Drones', icon: <EyeIcon className="w-4 h-4" /> },
        { id: 'intel', label: 'Intel', icon: <MapIcon className="w-4 h-4" /> },
        { id: 'comms', label: 'Comms', icon: <SignalIcon className="w-4 h-4" /> },
        { id: 'supply', label: 'Supply', icon: <TruckIcon className="w-4 h-4" /> },
    ];

    return (
        <div className="flex flex-col gap-6">
            <ModeSelector />

            {/* Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition-colors ${
                            activeTab === tab.id 
                                ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-500/30' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'dashboard' && <DashboardTab />}
                        {activeTab === 'drones' && <DronesTab />}
                        {activeTab === 'intel' && <IntelTab />}
                        {/* Placeholders for others */}
                        {(activeTab === 'comms' || activeTab === 'supply') && (
                            <div className="p-10 text-center text-slate-600 border border-slate-800 border-dashed rounded uppercase">
                                {activeTab} MODULE INITIALIZING...
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
