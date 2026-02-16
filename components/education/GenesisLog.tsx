import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/helpers';
import { useEssenceIdentity } from '../../hooks/useEssenceIdentity';
import { FiUploadCloud, FiCpu, FiCheck, FiFileText, FiKey } from 'react-icons/fi';
import { GoogleGenerativeAI } from '@google/generative-ai';
import toast from 'react-hot-toast';

interface GenesisLogProps {
    onClose: () => void;
}

interface LogEntry {
    id: string;
    title: string;
    content: string;
    tags: string[];
    date: string;
}

const Section: React.FC<{ number: string; title: string; children: React.ReactNode; delay: number }> = ({ number, title, children, delay }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay }}
        className="mb-8 border-l-2 border-cyan-500/30 pl-4"
    >
        <h3 className="text-lg font-bold text-cyan-300 mb-2 font-mono uppercase tracking-widest">
            <span className="text-amber-400 mr-2">{number}</span> {title}
        </h3>
        <div className="text-slate-300 leading-relaxed font-mono text-sm space-y-2">
            {children}
        </div>
    </motion.div>
);

export const GenesisLog: React.FC<GenesisLogProps> = ({ onClose }) => {
    const { identity } = useEssenceIdentity();
    const isAdmin = true; // Tryb Admina wymuszony do testów

    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'reading' | 'analyzing' | 'synthesizing' | 'complete' | 'missing_key'>('idle');
    const [tempKey, setTempKey] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentFileText, setCurrentFileText] = useState<string | null>(null);
    const [newEntries, setNewEntries] = useState<LogEntry[]>([]);

    // Pobieranie klucza z pamięci lub zmiennych środowiskowych
    const getApiKey = () => {
        let key = localStorage.getItem('gemini_api_key');
        if (!key) key = import.meta.env.VITE_GEMINI_API_KEY;
        return key;
    };

    // Główna funkcja AI z obsługą wielu modeli (Fallback)
    const processFileWithGemini = async (text: string, manualKey?: string) => {
        const apiKey = manualKey || getApiKey();

        if (!apiKey) {
            setCurrentFileText(text);
            setUploadStatus('missing_key');
            return;
        }

        if (manualKey) {
            localStorage.setItem('gemini_api_key', manualKey);
        }

        // Lista modeli do sprawdzenia w kolejności
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-pro", "gemini-pro"];
        let success = false;

        try {
            const genAI = new GoogleGenerativeAI(apiKey);

            for (const modelName of modelsToTry) {
                try {
                    console.log(`🤖 Trying model: ${modelName}...`);
                    const model = genAI.getGenerativeModel({ model: modelName });

                    const prompt = `
                        Analyze the following system update notes and extract a summary for the Genesis Log.
                        Return ONLY a valid JSON object with this structure:
                        {
                            "title": "A short, cool cyberpunk title for this update",
                            "summary": "A concise summary of the changes (max 3 sentences)",
                            "tags": ["Tag1", "Tag2", "Tag3"]
                        }
                        
                        Input text:
                        ${text.substring(0, 5000)}
                    `;

                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const jsonString = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                    const data = JSON.parse(jsonString);

                    const newEntry: LogEntry = {
                        id: Date.now().toString(),
                        title: data.title,
                        content: data.summary,
                        tags: data.tags,
                        date: new Date().toLocaleDateString()
                    };

                    setNewEntries(prev => [newEntry, ...prev]);
                    setUploadStatus('complete');
                    toast.success(`Success! Used model: ${modelName}`);
                    success = true;
                    break; // Udało się, przerywamy pętlę
                } catch (innerError) {
                    console.warn(`⚠️ Model ${modelName} failed. Trying next...`);
                }
            }

            if (!success) {
                throw new Error("All models failed. Check region/key.");
            }

            setTimeout(() => {
                setIsUploading(false);
                setUploadStatus('idle');
                setCurrentFileText(null);
            }, 2500);

        } catch (error) {
            console.error("Gemini Fatal Error:", error);
            toast.error("Analysis failed. Check Key/Quota.");
            setUploadStatus('missing_key');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadStatus('reading');

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setUploadStatus('analyzing');
            setTimeout(() => {
                setUploadStatus('synthesizing');
                processFileWithGemini(text);
            }, 1000);
        };
        reader.readAsText(file);
    };

    const handleManualKeySubmit = () => {
        if (tempKey && currentFileText) {
            setUploadStatus('synthesizing');
            processFileWithGemini(currentFileText, tempKey);
        }
    };

    return (
        <div className="relative w-full h-full flex flex-col">
            {/* Tło */}
            <div className="absolute inset-0 bg-black/80 rounded-xl z-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_4px]" />
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/10 via-transparent to-cyan-900/10" />
            </div>

            <motion.div
                className="relative z-10 flex flex-col h-full overflow-hidden rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: '100%', opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-cyan-500/30 bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
                    <div>
                        <h2 className="text-2xl font-bold text-amber-300 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)] font-mono tracking-tighter">
                            GENESIS_LOG_v0.2
                        </h2>
                        <p className="text-xs text-cyan-500 uppercase tracking-[0.2em]">Paradigm Shift Protocol</p>
                    </div>
                    <div className="flex gap-2">
                        {isAdmin && (
                            <div className="relative">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 text-lime-400 hover:text-white transition-colors font-mono text-xs border border-lime-500/50 px-3 py-1 rounded hover:bg-lime-500/20 group"
                                >
                                    <FiUploadCloud className="group-hover:animate-bounce" /> [INGEST_FILE]
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    accept=".txt,.md,.json"
                                />
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="text-cyan-400 hover:text-white transition-colors font-mono text-xs border border-cyan-500/50 px-3 py-1 rounded hover:bg-cyan-500/20"
                        >
                            [CLOSE]
                        </button>
                    </div>
                </div>

                {/* Overlay Procesowania / Klucza */}
                <AnimatePresence>
                    {isUploading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8"
                        >
                            <div className="w-full max-w-md text-center">

                                {uploadStatus === 'missing_key' ? (
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="bg-slate-900 border border-rose-500/50 p-6 rounded-xl shadow-2xl shadow-rose-900/20"
                                    >
                                        <div className="w-16 h-16 bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-400">
                                            <FiKey size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Access Key Required</h3>
                                        <p className="text-slate-400 text-sm mb-4">The Neural Link needs a Gemini API Key to process this file. Enter it below to proceed.</p>

                                        <input
                                            type="password"
                                            value={tempKey}
                                            onChange={(e) => setTempKey(e.target.value)}
                                            placeholder="Paste your API Key here..."
                                            className="w-full bg-black/50 border border-slate-700 rounded-lg p-3 text-white text-center mb-4 focus:border-cyan-500 focus:outline-none font-mono"
                                        />

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setIsUploading(false); setUploadStatus('idle'); }}
                                                className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleManualKeySubmit}
                                                disabled={!tempKey}
                                                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold hover:shadow-lg disabled:opacity-50 transition-all"
                                            >
                                                Activate Link
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <>
                                        <div className="flex justify-center mb-6 relative">
                                            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                                            {uploadStatus === 'reading' && <FiFileText className="w-16 h-16 text-cyan-400 animate-pulse relative z-10" />}
                                            {uploadStatus === 'analyzing' && <FiCpu className="w-16 h-16 text-amber-400 animate-spin relative z-10" />}
                                            {uploadStatus === 'synthesizing' && <FiCpu className="w-16 h-16 text-purple-400 animate-pulse relative z-10" />}
                                            {uploadStatus === 'complete' && <FiCheck className="w-16 h-16 text-lime-400 relative z-10" />}
                                        </div>

                                        <h3 className="text-xl font-mono text-cyan-300 mb-2">
                                            {uploadStatus === 'reading' && "READING STREAM..."}
                                            {uploadStatus === 'analyzing' && "GEMINI ANALYSIS..."}
                                            {uploadStatus === 'synthesizing' && "RE-WRITING REALITY..."}
                                            {uploadStatus === 'complete' && "INTEGRATION SUCCESS"}
                                        </h3>

                                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-4">
                                            <motion.div
                                                className={cn("h-full",
                                                    uploadStatus === 'analyzing' ? "bg-amber-500" :
                                                        uploadStatus === 'synthesizing' ? "bg-purple-500" : "bg-cyan-500"
                                                )}
                                                initial={{ width: "0%" }}
                                                animate={{ width: uploadStatus === 'complete' ? "100%" : "60%" }}
                                                transition={{ duration: 0.5, repeat: uploadStatus !== 'complete' ? Infinity : 0 }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Lista Wpisów */}
                <div className="flex-grow overflow-y-auto p-6 custom-scrollbar bg-slate-900/50">

                    {/* Nowe Wpisy */}
                    <AnimatePresence>
                        {newEntries.map((entry, index) => (
                            <Section key={entry.id} number={`NEW_0${index + 1}`} title={entry.title} delay={0}>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl mb-4 hover:bg-purple-900/30 transition-colors"
                                >
                                    <p className="text-white italic leading-relaxed mb-3">"{entry.content}"</p>
                                    <div className="flex justify-between items-center border-t border-purple-500/20 pt-3">
                                        <div className="flex gap-2">
                                            {entry.tags.map(tag => (
                                                <span key={tag} className="text-[10px] uppercase font-bold bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/20">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <FiCpu /> Processed by Gemini • {entry.date}
                                        </div>
                                    </div>
                                </motion.div>
                            </Section>
                        ))}
                    </AnimatePresence>

                    {/* Stare Wpisy */}
                    <Section number="01" title="THE MANIFESTO: FROM CONTROL TO FLOW" delay={0.2}>
                        <p>The Old System relied on <span className="text-rose-400">Entropy</span>. TeO introduces <strong className="text-white">PEIE</strong> balance.</p>
                        <ul className="list-disc list-inside text-slate-400 mt-2">
                            <li>Waste is merely a resource without context.</li>
                            <li>Technology as the Guardian.</li>
                        </ul>
                    </Section>

                    <Section number="02" title="DATA ARCHITECTURE" delay={0.4}>
                        <p>Every object has a "Digital Twin".</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div className="bg-slate-800/50 p-2 rounded border border-lime-500/20">
                                <span className="text-lime-400 font-bold">Consumable Token</span>
                                <p className="text-xs text-slate-500">High Entropy (Food, Fuel)</p>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded border border-violet-500/20">
                                <span className="text-violet-400 font-bold">Durable Token</span>
                                <p className="text-xs text-slate-500">Low Entropy (Tools, Tech)</p>
                            </div>
                        </div>
                    </Section>

                    <Section number="03" title="GENESSIA PROTOCOL: THE HUB DEFINITION" delay={0.6}>
                        <p className="text-cyan-200 mb-2"><strong>What is the HuB?</strong></p>
                        <p>The TeO HuB is the <span className="text-amber-400">Central Nervous System</span> of the ecosystem. It is not just an app; it is the convergence point where Consciousness (Soul), Logic (Code), and Physical Reality (Field) meet.</p>
                        
                        <p className="text-cyan-200 mt-4 mb-2"><strong>What does it possess?</strong></p>
                        <div className="grid grid-cols-1 gap-2">
                             <div className="flex items-center gap-2 text-xs">
                                <span className="text-purple-400 font-bold">[SOUL LAYER]</span>
                                <span>Identity, Purpose, The "Genessia" Mandate.</span>
                             </div>
                             <div className="flex items-center gap-2 text-xs">
                                <span className="text-cyan-400 font-bold">[CODE LAYER]</span>
                                <span>Graviton Blockchain, AI Agents (BoB), DApps.</span>
                             </div>
                             <div className="flex items-center gap-2 text-xs">
                                <span className="text-emerald-400 font-bold">[FIELD LAYER]</span>
                                <span>Drones, Sensors, Supply Chain, Physical Assets.</span>
                             </div>
                        </div>

                        <p className="text-cyan-200 mt-4 mb-2"><strong>Operational Logic</strong></p>
                        <p className="italic text-slate-400">"Energy Follows Attention."</p>
                        <p>The Hub directs resources based on the conscious intent of The Eternal One (TeO). It utilizes <strong>PEIE</strong> to ensure that every action minimizes waste and maximizes coherence.</p>
                    </Section>

                    <div className="h-20"></div>
                </div>
            </motion.div>
        </div>
    );
};