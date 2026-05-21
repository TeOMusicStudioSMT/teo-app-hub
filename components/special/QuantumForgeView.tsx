import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Dodano 'FiTerminal' do importu ikon
import { FiX, FiUploadCloud, FiZap, FiLayers, FiAnchor, FiHexagon, FiBox, FiCheckCircle, FiActivity, FiTerminal } from 'react-icons/fi';
import toast from 'react-hot-toast';
// Dodano 'type' przy imporcie typów, żeby TypeScript nie krzyczał
import { mintGravitonNode, generateNodeTriplet, type NodeAsset, type StabilityLevel, type NodeType } from '../../services/appNodeService';
import { useAtomValue } from 'jotai';
import { electricBorderAtom } from '../../store/electricBorder';
import { walletAtom } from '../../store/wallet';
import { negotiateAccess } from '../../lib/jwProtocol';
// Upewnij się, że ten plik istnieje (krok z poprzedniej wiadomości)
import { useHermesCourier } from '../../lib/hooks/useHermesCourier';

// ... (StabilitySelector zostaje bez zmian) ...
const StabilitySelector = ({ selected, onSelect }: { selected: StabilityLevel, onSelect: (s: StabilityLevel) => void }) => {
    // ... (kod selektora bez zmian) ...
    // (Dla oszczędności miejsca wklejam tylko logikę, selektor masz w poprzednim pliku)
    const levels: { id: StabilityLevel, label: string, icon: any, color: string, desc: string }[] = [
        { id: 'FLASH', label: 'IMPULSE', icon: FiZap, color: 'text-yellow-400', desc: 'Tymczasowy sygnał. Znika szybko.' },
        { id: 'FLUID', label: 'FLUID', icon: FiLayers, color: 'text-blue-400', desc: 'Content, media. Płynna rzeczywistość.' },
        { id: 'STABLE', label: 'STABLE', icon: FiAnchor, color: 'text-emerald-400', desc: 'Aplikacje, trwałe zasoby.' },
        { id: 'GENESIS', label: 'GENESIS', icon: FiHexagon, color: 'text-purple-500', desc: 'Fundament systemu. Niezniszczalny.' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
            {levels.map((level) => (
                <div
                    key={level.id}
                    onClick={() => onSelect(level.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden group ${selected === level.id
                        ? 'bg-white/10 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                        : 'bg-black/40 border-white/5 hover:border-white/20'
                        }`}
                >
                    <div className={`text-2xl mb-2 ${level.color}`}>{<level.icon />}</div>
                    <div className="font-bold text-xs tracking-widest">{level.label}</div>
                    <div className="text-[10px] text-slate-400 mt-1 leading-tight">{level.desc}</div>
                    {selected === level.id && <motion.div layoutId="sel-ring" className="absolute inset-0 border-2 border-white/20 rounded-xl" />}
                </div>
            ))}
        </div>
    );
};

export const QuantumForgeView: React.FC<{
    onClose: () => void,
    initialFile?: File | null // TARCZA SUWERENA: Nowy prop do wstrzykiwania materii
}> = ({ onClose, initialFile }) => {
    const { globalMode } = useAtomValue(electricBorderAtom);
    const wallet         = useAtomValue(walletAtom);
    const [name, setName] = useState('');
    const [assetType, setAssetType] = useState<NodeType>('IMAGE');
    const [stability, setStability] = useState<StabilityLevel>('FLUID');
    const [isMinting, setIsMinting] = useState(false);
    // Przechowujemy oryginalny File, żeby wyciągnąć duration dla video/audio
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    // Ostatnio zmintowany tryplet (do pokazania ID w toaście)
    const [lastMintedIds, setLastMintedIds] = useState<string[]>([]);

    // Protokół J&W
    const [jwLogs, setJwLogs] = useState<string[]>([]);
    const [isHandshakeActive, setIsHandshakeActive] = useState(false);

    // AGENT HERMES (Upload Logic)
    const { isUploading, progress, currentShard, totalShards, fileUrl, processFile } = useHermesCourier();

    /** Wyciąga czas trwania pliku video/audio jako ms. */
    const getMediaDurationMs = (file: File): Promise<number | undefined> =>
        new Promise((resolve) => {
            if (!file.type.includes('video') && !file.type.includes('audio')) {
                return resolve(undefined);
            }
            const tag = file.type.includes('video') ? 'video' : 'audio';
            const el  = document.createElement(tag) as HTMLVideoElement | HTMLAudioElement;
            el.preload = 'metadata';
            const url = URL.createObjectURL(file);
            el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(isFinite(el.duration) ? el.duration * 1000 : undefined); };
            el.onerror          = () => { URL.revokeObjectURL(url); resolve(undefined); };
            el.src = url;
        });

    // Automatyczne załadowanie wstrzykniętego pliku (np. zrzutu z Katedry)
    useEffect(() => {
        if (initialFile && !fileUrl && !isUploading) {
            setName(initialFile.name.split('.')[0]); // Ustaw nazwę z pliku
            setAssetType('IMAGE'); // Zrzuty z canvasu to zawsze obraz
            setDroppedFile(initialFile);
            processFile(initialFile); // Uruchom Hermesa!
        }
    }, [initialFile]); // Uruchomi się tylko raz, gdy initialFile się pojawi

    const handleDrop = async (e: any) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files[0]) {
            const file = files[0];
            setName(file.name.split('.')[0]); // Automatyczna nazwa z pliku
            setDroppedFile(file);

            // Wykrywanie typu
            if (file.type.includes('video')) setAssetType('VIDEO');
            if (file.type.includes('image')) setAssetType('IMAGE');
            if (file.type.includes('audio')) setAssetType('AUDIO');

            // URUCHAMIAMY HERMESA
            await processFile(file);
        }
    };

    const handleMint = async () => {
        if (!name) { toast.error("Nazwij swój asset!"); return; }
        if (isUploading) { toast.error("Hermes wciąż transportuje materię! Czekaj."); return; }

        setIsMinting(true);
        setIsHandshakeActive(true);
        setJwLogs([]);

        try {
            // ── Krok 1: Protokół J&W ───────────────────────────────────────
            const jadziaToken = await negotiateAccess((msg) => setJwLogs(prev => [...prev, msg]));
            if (!jadziaToken) throw new Error('J&W handshake failed');

            // ── Krok 2: Finalny content URL ────────────────────────────────
            let finalContent = fileUrl || 'System Binary Data...';
            if (!fileUrl) {
                if (assetType === 'IMAGE') finalContent = 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=1000';
                if (assetType === 'VIDEO') finalContent = 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-circuit-board-997-large.mp4';
            }

            // ── Krok 3: Wyciągnij czas trwania (jeśli media) ───────────────
            setJwLogs(prev => [...prev, '[FORGE] Skanowanie metadanych temporalnych...']);
            const durationMs = droppedFile ? await getMediaDurationMs(droppedFile) : undefined;

            // ── Krok 4: Generuj NodeAsset tryplet ─────────────────────────
            const fileName = droppedFile?.name ?? `${name}.asset`;
            const triplet: NodeAsset[] = generateNodeTriplet(
                name,
                fileName,
                assetType,
                stability,
                globalMode,
                wallet.address,
                durationMs,
            );
            setJwLogs(prev => [...prev, `[FORGE] Wygenerowano ${triplet.length} węzłów temporalnych.`]);
            triplet.forEach(n => setJwLogs(prev => [...prev, `  · ${n.id}  ${n.name}`]));

            // ── Krok 5: POST do Wiesława ───────────────────────────────────
            setJwLogs(prev => [...prev, '[WIESŁAW] Otwieram kanał Quantum Forge...']);
            const mintResp = await fetch('http://localhost:3001/api/graviton/mint', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ nodes: triplet }),
            });

            // Najpierw sprawdź HTTP status — zanim spróbujesz parsować JSON
            if (!mintResp.ok) {
                const errText = await mintResp.text().catch(() => `HTTP ${mintResp.status}`);
                throw new Error(`Wiesław odpowiedział ${mintResp.status}: ${errText}`);
            }

            const mintData = await mintResp.json();
            if (!mintData.success) throw new Error(mintData.message ?? 'Błąd serwera Forge');
            setLastMintedIds(mintData.ids ?? []);
            setJwLogs(prev => [...prev, `[WIESŁAW] ✓ Zmintowano ${mintData.minted} węzłów. Archiwum: ${mintData.total}.`]);

            // ── Krok 6: Lokalny zapis (backward compat) ────────────────────
            mintGravitonNode(name, finalContent, assetType, stability, globalMode);

            // ── Krok 7: Toast sukcesu ──────────────────────────────────────
            toast.custom(() => (
                <div className="bg-slate-900 border border-purple-500 p-4 rounded-xl shadow-2xl flex items-center gap-4 text-white max-w-sm">
                    <div className="p-2 bg-purple-500/20 rounded-full text-purple-400 shrink-0"><FiHexagon /></div>
                    <div className="min-w-0">
                        <div className="font-bold text-sm">Zmaterializowano Tryplet!</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1 space-y-0.5">
                            {(mintData.ids as string[]).map((id: string) => (
                                <div key={id}>{id}</div>
                            ))}
                        </div>
                    </div>
                </div>
            ));

            setTimeout(() => {
                setIsMinting(false);
                setIsHandshakeActive(false);
                onClose();
            }, 1800);

        } catch (error: any) {
            toast.error(`Błąd Forge: ${error?.message ?? 'Nieznany błąd'}`);
            setIsMinting(false);
            setIsHandshakeActive(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[1000000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 pointer-events-auto"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-3xl bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-transparent">
                    <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                        <FiUploadCloud className="text-purple-400" />
                        QUANTUM FORGE <span className="text-xs opacity-50 font-normal self-end mb-1">UNIVERSAL TOKENIZER</span>
                    </h2>
                    <button onClick={onClose}><FiX className="w-6 h-6 text-slate-400 hover:text-white" /></button>
                </div>

                <div className="p-8 relative">

                    {/* --- STREFA HERMESA (DROPZONE & PROGRESS) --- */}
                    {!fileUrl && !isUploading ? (
                        // STAN 1: Czekam na plik
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            className="border-2 border-dashed border-white/10 rounded-2xl h-32 flex flex-col items-center justify-center mb-6 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                        >
                            <div className="p-3 bg-black/50 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                <FiUploadCloud className="w-6 h-6 text-purple-400" />
                            </div>
                            <p className="text-sm text-slate-300 font-bold">Przeciągnij ciężką materię (Video/Raw)</p>
                            <p className="text-[10px] text-slate-500">Hermes Sharding Active</p>
                        </div>
                    ) : isUploading ? (
                        // STAN 2: Hermes w biegu (Pasek postępu)
                        <div className="border border-purple-500/30 rounded-2xl h-32 flex flex-col items-center justify-center mb-6 bg-purple-900/10 relative overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center z-10 flex-col">
                                <div className="text-2xl font-black text-white mb-1">{progress}%</div>
                                <div className="text-[10px] font-mono text-purple-300 tracking-widest uppercase">
                                    Transporting Shard {currentShard}/{totalShards}
                                </div>
                            </div>
                            {/* Pasek postępu */}
                            <motion.div
                                className="absolute left-0 top-0 bottom-0 bg-purple-600/20"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                            />
                            {/* Animacja paczek */}
                            <FiBox className="absolute right-4 bottom-4 text-purple-500/20 w-8 h-8 animate-bounce" />
                        </div>
                    ) : (
                        // STAN 3: Plik dostarczony
                        <div className="border border-green-500/30 rounded-2xl h-32 flex flex-col items-center justify-center mb-6 bg-green-900/10">
                            <FiCheckCircle className="w-8 h-8 text-green-400 mb-2" />
                            <p className="text-sm text-green-300 font-bold">Materia Zabezpieczona</p>
                            <p className="text-[10px] text-slate-500">Gotowa do Tokenizacji</p>
                        </div>
                    )}

                    {/* FORMULARZ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="text-xs font-mono text-slate-500 uppercase">Nazwa Assetu</label>
                            <input
                                type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="Nazwij obiekt..."
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white mt-2 focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-mono text-slate-500 uppercase">Typ Materii</label>
                            <div className="flex gap-2 mt-2">
                                {['VIDEO', 'IMAGE', 'AUDIO', 'CODE'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setAssetType(t as NodeType)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${assetType === t ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <label className="text-xs font-mono text-slate-500 uppercase">Klasa Stabilności Węzła</label>
                    <StabilitySelector selected={stability} onSelect={setStability} />

                    <button
                        onClick={handleMint}
                        disabled={isMinting || isUploading} // Blokada podczas uploadu
                        className={`w-full py-4 rounded-xl font-black tracking-widest text-sm uppercase transition-all flex items-center justify-center gap-3 ${(isMinting || isUploading)
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]'
                            }`}
                    >
                        {isMinting
                            ? <><FiActivity className="animate-spin" /> Mintowanie trypletów węzłów...</>
                            : <><FiZap /> MINT TO GRAVITON NETWORK</>
                        }
                    </button>

                    {/* --- KONSOLA JADZIA & WIESŁAW --- */}
                    <AnimatePresence>
                        {isHandshakeActive && (
                            <motion.div
                                initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                                className="absolute inset-0 bg-[#0d1117]/95 backdrop-blur-md rounded-3xl z-20 flex flex-col p-6"
                            >
                                <div className="flex items-center gap-2 mb-4 text-green-500 border-b border-green-500/20 pb-2">
                                    <FiTerminal className="animate-pulse" />
                                    <span className="uppercase tracking-widest font-bold text-xs">SECURE CHANNEL: HUB {'<->'} FORGE</span>
                                </div>
                                <div className="flex-grow space-y-2 overflow-y-auto custom-scrollbar font-mono text-xs">
                                    {jwLogs.map((log, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                            className={`${log.includes('WIESŁAW') ? 'text-cyan-400' : ''} ${log.includes('JADZIA') ? 'text-pink-400' : ''} ${log.includes('SYSTEM') ? 'text-slate-500 italic' : ''}`}
                                        >
                                            {log}
                                        </motion.div>
                                    ))}
                                    <div className="animate-pulse text-green-500">_</div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};