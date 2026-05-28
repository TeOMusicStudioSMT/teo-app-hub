/**
 * 📚 Biblioteka.tsx — Kwantowa Biblioteka Zwojów
 *
 * "Każda opowieść czeka na czytelnika. Ty jesteś bramą."
 *
 * Wczytuje pliki .txt z dysku i otwiera je w pełnoekranowej
 * KwantowejCzytelni poprzez most localStorage + event story_ready.
 *
 * @author BoB & TeO
 */

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, UploadCloud, ScrollText, Sparkles, X } from 'lucide-react';

interface RecentScroll {
    name: string;
    size: number;
    loadedAt: number;
}

export const Biblioteka: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [recentScrolls, setRecentScrolls] = useState<RecentScroll[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('biblioteka_recent_scrolls') ?? '[]');
        } catch {
            return [];
        }
    });

    // ── Główna logika wczytania pliku ─────────────────────────────
    const openScroll = useCallback((file: File) => {
        if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
            setLoadError('Przyjmuję tylko Zwoje w formacie .txt');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setLoadError('Zwój przekracza 5 MB — zbyt ciężki dla kwantowego pola');
            return;
        }

        setIsLoading(true);
        setLoadError(null);

        const reader = new FileReader();

        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text?.trim()) {
                setLoadError('Zwój jest pusty lub nieczytelny');
                setIsLoading(false);
                return;
            }

            // Most do KwantowejCzytelni
            localStorage.setItem('teo_active_story', text);
            window.dispatchEvent(new Event('story_ready'));

            // Zapisz ostatnio otwarte
            const entry: RecentScroll = { name: file.name, size: file.size, loadedAt: Date.now() };
            setRecentScrolls(prev => {
                const updated = [entry, ...prev.filter(r => r.name !== file.name)].slice(0, 5);
                localStorage.setItem('biblioteka_recent_scrolls', JSON.stringify(updated));
                return updated;
            });

            setIsLoading(false);
        };

        reader.onerror = () => {
            setLoadError('Nie udało się odczytać Zwoju. Sprawdź plik.');
            setIsLoading(false);
        };

        reader.readAsText(file, 'UTF-8');
    }, []);

    // ── Obsługa kliknięcia ─────────────────────────────────────────
    const handleClick = () => {
        setLoadError(null);
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) openScroll(file);
        // Reset inputu, żeby można było wczytać ten sam plik ponownie
        e.target.value = '';
    };

    // ── Drag & Drop ────────────────────────────────────────────────
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => setIsDragOver(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) openScroll(file);
    };

    // ── Pomocnik: rozmiar ──────────────────────────────────────────
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="w-full">
            {/* ── Strefa Upload ─────────────────────────────────────────── */}
            <motion.div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                animate={{
                    borderColor: isDragOver
                        ? 'rgba(251,191,36,0.8)'
                        : 'rgba(251,191,36,0.2)',
                    backgroundColor: isDragOver
                        ? 'rgba(251,191,36,0.08)'
                        : 'rgba(255,255,255,0.03)',
                }}
                whileHover={{ backgroundColor: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.5)' }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.2 }}
                className="
                    relative cursor-pointer rounded-2xl border-2 border-dashed
                    px-6 py-8 flex flex-col items-center justify-center gap-4
                    group select-none
                "
            >
                {/* Subtelna poświata w tle */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />

                {/* Ikona główna */}
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                            >
                                <Sparkles className="w-7 h-7 text-amber-400" />
                            </motion.div>
                        </motion.div>
                    ) : isDragOver ? (
                        <motion.div
                            key="dragover"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center"
                        >
                            <UploadCloud className="w-8 h-8 text-amber-300" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-400/25 flex items-center justify-center group-hover:border-amber-400/50 transition-colors duration-300"
                        >
                            <BookOpen className="w-7 h-7 text-amber-400 group-hover:text-amber-300 transition-colors duration-300" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tekst */}
                <div className="text-center z-10">
                    <p className="text-base font-semibold text-slate-200 group-hover:text-white transition-colors duration-200">
                        {isLoading ? 'Odczytuję Zwój…' : isDragOver ? 'Upuść Zwój tutaj' : 'Wczytaj Zwój / Otwórz Opowieść'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {isLoading ? 'Przygotowuję kwantowe pole…' : 'Kliknij lub przeciągnij plik .txt'}
                    </p>
                </div>

                {/* Piktogram formatu */}
                <div className="flex items-center gap-2 z-10">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/50">
                        <ScrollText className="w-3 h-3 text-amber-400/70" />
                        <span className="text-[10px] text-slate-400 font-mono">.txt</span>
                    </div>
                    <span className="text-[10px] text-slate-600">maks. 5 MB</span>
                </div>

                {/* Ukryty input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </motion.div>

            {/* ── Błąd ─────────────────────────────────────────────────── */}
            <AnimatePresence>
                {loadError && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mt-3 flex items-start gap-2 px-4 py-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs"
                    >
                        <span className="flex-1">{loadError}</span>
                        <button onClick={() => setLoadError(null)} className="shrink-0 hover:text-red-200 transition-colors">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Ostatnio otwarte ─────────────────────────────────────── */}
            <AnimatePresence>
                {recentScrolls.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-5"
                    >
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2.5 px-1">
                            Ostatnio otwarte
                        </p>
                        <div className="space-y-1.5">
                            {recentScrolls.map((scroll, i) => (
                                <motion.div
                                    key={scroll.name + scroll.loadedAt}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group/recent"
                                >
                                    <ScrollText className="w-3.5 h-3.5 text-amber-500/60 shrink-0" />
                                    <span className="flex-1 text-xs text-slate-400 truncate group-hover/recent:text-slate-300 transition-colors">
                                        {scroll.name}
                                    </span>
                                    <span className="text-[9px] text-slate-600 font-mono shrink-0">
                                        {formatSize(scroll.size)}
                                    </span>
                                    <span className="text-[9px] text-slate-600 shrink-0">
                                        {new Date(scroll.loadedAt).toLocaleDateString('pl-PL', {
                                            day: '2-digit', month: '2-digit'
                                        })}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Biblioteka;
