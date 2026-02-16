import React, { useState, useEffect } from 'react';
import DashboardCard from './DashboardCard';
import { ShieldCheckIcon, ClockIcon, CpuIcon, SignalIcon, EyeIcon, TruckIcon, MapIcon } from './icons';
import { useEssenceIdentity } from '../hooks/useEssenceIdentity';
import { ModeSelector } from './dashboard/ModeSelector';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

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

// --- Offline Brain Component ---
const OfflineBrainControl = () => {
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    // Mock check for existing model
    useEffect(() => {
        const checkModel = async () => {
            // Check logic
        };
        checkModel();
    }, []);

    const handleDownload = () => {
        setIsDownloading(true);
        // Simulation of download trigger
        // In a real app, this might call an electron bridge or local server endpoint
        console.log("Triggering fetch-local-brain.ps1...");
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            setDownloadProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setIsDownloading(false);
                setIsDownloaded(true);
                toast.success("Gemma 270m (GGUF) download sequence initiated.");
            }
        }, 200);
    };

    return (
        <DashboardCard title="Offline Brain (Gemma 270m)" icon={<CpuIcon />}>
            <div className="p-6 space-y-4">
                <p className="text-slate-400 text-sm">
                    Local LLM for offline intelligence. Zero latency, zero cost.
                    <br /><span className="text-xs text-slate-600">Format: GGUF (Ollama/MediaPipe)</span>
                </p>

                {isDownloaded ? (
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-900/20 p-3 rounded">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="font-mono text-sm">BRAIN: ONLINE (LOCAL)</span>
                    </div>
                ) : (
                    <div>
                        {isDownloading ? (
                            <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                                <div 
                                    className="bg-cyan-500 h-full transition-all duration-200" 
                                    style={{ width: `${downloadProgress}%` }}
                                />
                            </div>
                        ) : (
                            <button 
                                onClick={handleDownload}
                                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <SignalIcon className="w-4 h-4" />
                                Download Gemma 270m
                            </button>
                        )}
                        {isDownloading && <p className="text-center text-xs text-cyan-400 mt-2 font-mono">Fetching GGUF... {downloadProgress}%</p>}
                    </div>
                )}
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
