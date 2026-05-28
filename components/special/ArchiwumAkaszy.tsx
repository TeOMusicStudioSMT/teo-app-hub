/**
 * 💾 ArchiwumAkaszy.tsx - Wbudowany Eksplorator Materii
 * * ZINTEGROWANO: Nawigację po dysku, sortowanie, wysuwany podgląd plików oraz edycję bezpośrednią.
 */

import React, { useState, useEffect } from 'react';
import { Folder, File, HardDrive, FileText, CornerUpLeft, RefreshCw, X, ChevronRight, Terminal, BrainCircuit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface FileItem {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modified: string;
}

export const ArchiwumAkaszy: React.FC = () => {
    // Domyślny dysk startowy Suwerena
    const defaultPath = 'F:\\'; 
    const [currentPath, setCurrentPath] = useState(defaultPath);
    const [items, setItems] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pathInput, setPathInput] = useState(defaultPath);
    
    // Podgląd i Edycja plików
    const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadDirectory(currentPath);
    }, [currentPath]);

    const loadDirectory = async (pathToLoad: string) => {
        setIsLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'READ_DIR', path: pathToLoad })
            });
            const data = await res.json();
            if (data.success) {
                setItems(data.items);
                setCurrentPath(data.currentPath);
                setPathInput(data.currentPath);
            } else {
                toast.error(`Błąd: ${data.error}`);
            }
        } catch (e) {
            toast.error("Brak łączności z mostem Wiesia (Port 3001).");
        } finally {
            setIsLoading(false);
        }
    };

    const loadFileContent = async (filePath: string, fileName: string) => {
        setIsLoadingFile(true);
        setSelectedFileContent(null);
        setSelectedFileName(fileName);
        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'READ_FILE_CONTENT', path: filePath })
            });
            const data = await res.json();
            if (data.success) {
                setSelectedFileContent(data.content);
                setEditedContent(data.content); // Inicjacja treści do edycji
                setIsEditing(false); // Reset trybu
            } else {
                setSelectedFileContent(`❌ Błąd dekodowania materii: ${data.error}`);
            }
        } catch (e) {
            setSelectedFileContent("❌ Błąd łączności z serwerem Katedry.");
        } finally {
            setIsLoadingFile(false);
        }
    };

    const saveEditedFile = async () => {
        setIsSaving(true);
        try {
            const fullPath = currentPath.endsWith('\\') ? `${currentPath}${selectedFileName}` : `${currentPath}\\${selectedFileName}`;
            
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'WRITE_FILE_CONTENT', 
                    path: fullPath, 
                    content: editedContent 
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Materia zaktualizowana!");
                setSelectedFileContent(editedContent); // Aktualizacja podglądu
                setIsEditing(false);
            } else {
                toast.error(`Błąd zapisu: ${data.error}`);
            }
        } catch (e) {
            toast.error("Zerwano łączność z Wiesiem.");
        } finally {
            setIsSaving(false);
        }
    };

    // 🧠 Przyswajanie wiedzy z pliku do Akaszy
    const absorbKnowledge = () => {
        if (!selectedFileContent) return;
        const currentMemory = JSON.parse(localStorage.getItem('otakos_akasha') || '[]');
        const newCrystal = {
            id: `KOD-${Date.now()}`,
            topicKeywords: `[ARCHITEKTURA KATEDRY]: ${selectedFileName}`,
            summary: `Zassano strukturę pliku kodowego: ${selectedFileName}. Pamięć podręczna przygotowana do analizy na Stole Narad.`,
            fullTranscript: `Oto zawartość pliku ${selectedFileName}:\n\n${selectedFileContent}`,
            timestamp: Date.now()
        };
        localStorage.setItem('otakos_akasha', JSON.stringify([newCrystal, ...currentMemory]));
        toast.success(`Wiedza z pliku ${selectedFileName} wchłonięta do Pamięci!`, { icon: '🧠' });
    };

    // >_ Przekazanie ścieżki do Terminala 0.00G
    const sendToTerminal = (targetPath: string) => {
        localStorage.setItem('otakos_terminal_auto_path', targetPath);
        window.dispatchEvent(new Event('otakos_switch_to_terminal'));
        toast.success("Przekierowano do Terminala!", { icon: '⚡' });
    };

    const goUp = () => {
        const parts = currentPath.split('\\').filter(Boolean);
        if (parts.length > 1) {
            parts.pop();
            loadDirectory(parts.join('\\') + '\\');
        } else if (parts.length === 1) {
            toast("Osiągnięto korzeń dysku.", {icon: 'ℹ️'});
        }
    };

    const handleItemClick = (item: FileItem) => {
        if (item.isDirectory) {
            setSelectedFileContent(null);
            loadDirectory(item.path);
        } else {
            loadFileContent(item.path, item.name);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full h-full min-h-[600px] bg-[#050510] border border-fuchsia-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(217,70,239,0.1)] font-mono flex flex-col text-slate-300">
            
            {/* GÓRNA BELKA TYTUŁOWA */}
            <div className="bg-[#020205] border-b border-fuchsia-500/30 p-4 flex justify-between items-center shrink-0 h-[60px]">
                <div className="flex items-center gap-3">
                    <HardDrive className="text-fuchsia-400" />
                    <span className="text-fuchsia-400 font-bold tracking-widest text-lg uppercase">Archiwum Akaszy</span>
                </div>
            </div>

            {/* PASEK NAWIGACJI (Ścieżka) */}
            <div className="bg-[#080812] border-b border-slate-800 p-3 flex gap-2 items-center shrink-0">
                <button onClick={goUp} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-slate-300" title="Katalog wyżej">
                    <CornerUpLeft size={16} />
                </button>
                <input 
                    type="text" 
                    value={pathInput} 
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadDirectory(pathInput)}
                    className="flex-1 bg-black border border-slate-700 rounded-lg px-3 py-2 text-xs text-fuchsia-100 outline-none focus:border-fuchsia-500 font-bold tracking-wide"
                />
                <button onClick={() => loadDirectory(currentPath)} disabled={isLoading} className="p-2 bg-fuchsia-900/30 hover:bg-fuchsia-900/60 text-fuchsia-400 rounded-lg transition-colors border border-fuchsia-500/30" title="Odśwież">
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => sendToTerminal(currentPath)} className="px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-500/50 text-[10px] font-bold rounded-lg text-cyan-300 transition-colors flex items-center gap-2">
                    <Terminal size={14} /> W TERMINALU
                </button>
            </div>

            {/* GŁÓWNA PRZESTRZEŃ ROBOCZA */}
            <div className="flex-1 flex overflow-hidden relative min-h-0">
                
                {/* WIDOK FOLDERÓW I PLIKÓW */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-[radial-gradient(ellipse_at_bottom,rgba(217,70,239,0.05),transparent_60%)]">
                    {items.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center mt-20 text-slate-600 opacity-50">
                            <Folder size={48} className="mb-4 text-fuchsia-500/30" />
                            <p className="text-sm font-bold tracking-widest uppercase">Katalog pusty lub brak dostępu</p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {items.map((item, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => handleItemClick(item)}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:-translate-y-0.5 ${item.isDirectory ? 'bg-[#0a0f16] border-slate-700 hover:border-fuchsia-500/50 hover:shadow-[0_0_15px_rgba(217,70,239,0.15)]' : 'bg-black border-slate-800 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]'}`}
                            >
                                <div className="shrink-0">
                                    {item.isDirectory ? <Folder size={28} className="text-fuchsia-500/80" /> : <FileText size={28} className="text-cyan-500/80" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold truncate text-slate-200" title={item.name}>{item.name}</div>
                                    <div className="text-[9px] text-slate-500 flex justify-between mt-1 font-mono">
                                        <span>{new Date(item.modified).toLocaleDateString()}</span>
                                        {!item.isDirectory && <span className="text-cyan-500/50">{formatSize(item.size)}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PODGLĄD PLIKU (Panel Prawy Wsuwany - Wizjer) */}
                <AnimatePresence>
                    {(selectedFileContent !== null || isLoadingFile) && (
                        <motion.div 
                            initial={{ width: 0, opacity: 0 }} 
                            animate={{ width: '45%', opacity: 1 }} 
                            exit={{ width: 0, opacity: 0 }} 
                            className="h-full border-l border-slate-800 bg-[#020205] flex flex-col shrink-0 min-w-[350px] max-w-[600px] z-10"
                        >
                            {/* Nagłówek Wizjera */}
                            <div className="p-3 bg-[#050a14] border-b border-cyan-500/30 flex justify-between items-center shrink-0 h-[50px]">
                                <div className="flex items-center gap-2 truncate flex-1 pr-2">
                                    <File size={16} className="text-cyan-400 shrink-0" />
                                    <span className="text-[10px] font-bold text-cyan-400 truncate uppercase tracking-wider">{selectedFileName}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {!isEditing && (
                                        <>
                                            <button onClick={absorbKnowledge} className="px-3 py-1.5 bg-fuchsia-900/40 hover:bg-fuchsia-800/60 border border-fuchsia-500/50 text-[10px] font-bold rounded-lg text-fuchsia-300 transition-colors shadow-[0_0_15px_rgba(217,70,239,0.2)] flex items-center gap-1" title="Zapisz do Pamięci Akaszy">
                                                <BrainCircuit size={12}/> PRZYSWÓJ
                                            </button>
                                            <button onClick={() => sendToTerminal(currentPath.endsWith('\\') ? `${currentPath}${selectedFileName}` : `${currentPath}\\${selectedFileName}`)} className="px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-500/50 text-[10px] font-bold rounded-lg text-cyan-300 transition-colors flex items-center gap-1" title="Podaj ścieżkę do Terminala">
                                                <Terminal size={12}/> DO TERMINALA
                                            </button>
                                        </>
                                    )}
                                    {isEditing ? (
                                        <>
                                            <button onClick={() => setIsEditing(false)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[9px] font-bold rounded text-slate-300 transition-colors">ANULUJ</button>
                                            <button onClick={saveEditedFile} disabled={isSaving} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-[9px] font-bold rounded text-black transition-colors flex items-center gap-1">
                                                {isSaving ? <RefreshCw size={12} className="animate-spin"/> : null} ZAPISZ
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className="px-2 py-1 bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-500/50 text-[9px] font-bold rounded text-cyan-300 transition-colors uppercase">Edytuj</button>
                                    )}
                                    <button onClick={() => setSelectedFileContent(null)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 ml-1 transition-colors border border-transparent hover:border-slate-700">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Obszar Treści */}
                            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar bg-black/40 flex flex-col">
                                {isLoadingFile ? (
                                    <div className="flex flex-col items-center justify-center h-full text-cyan-500/50 gap-3">
                                        <RefreshCw size={24} className="animate-spin" /> 
                                        <span className="text-xs tracking-widest uppercase">Dekodowanie matrycy...</span>
                                    </div>
                                ) : isEditing ? (
                                    <textarea 
                                        value={editedContent}
                                        onChange={(e) => setEditedContent(e.target.value)}
                                        className="flex-1 w-full bg-transparent text-[11px] text-slate-200 font-mono resize-none outline-none custom-scrollbar leading-relaxed"
                                        spellCheck={false}
                                    />
                                ) : (
                                    <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                                        {selectedFileContent}
                                    </pre>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(217, 70, 239, 0.3); border-radius: 10px; }`}</style>
        </div>
    );
};

export default ArchiwumAkaszy;
