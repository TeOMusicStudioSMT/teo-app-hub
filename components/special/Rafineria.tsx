/**
 * 🔥 Rafineria.tsx — Kwantowa Transmutacja WebM → MP4
 *
 * "Surowa materia wchodzi jako .webm, wychodzi jako czyste MP4.
 *  Piece Wiesława pracują bez wytchnienia."
 *
 * @author BoB & TeO
 */

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, UploadCloud, Zap, CheckCircle2, XCircle, FileVideo, X } from 'lucide-react';

// ── Typy ──────────────────────────────────────────────────────────────
type Stage = 'idle' | 'uploading' | 'converting' | 'done' | 'error';

interface RafineriaState {
    stage:    Stage;
    filename: string;
    sizeMB:   string;
    progress: number;      // 0–100 — postęp uploadu (XMLHttpRequest)
    errorMsg: string;
}

const BRIDGE_URL = 'http://127.0.0.1:3001';

// ── Pomocnik: formatowanie rozmiaru ───────────────────────────────────
const fmtSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

// ══════════════════════════════════════════════════════════════════════
export const Rafineria: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const xhrRef       = useRef<XMLHttpRequest | null>(null);

    const [state, setState] = useState<RafineriaState>({
        stage:    'idle',
        filename: '',
        sizeMB:   '',
        progress: 0,
        errorMsg: '',
    });

    const [isDragOver, setIsDragOver] = useState(false);

    // ── Główna logika transmutacji ────────────────────────────────────
    const transmute = useCallback((file: File) => {
        const isWebm = file.name.toLowerCase().endsWith('.webm') || file.type === 'video/webm';
        if (!isWebm) {
            setState(s => ({ ...s, stage: 'error', errorMsg: 'Rafineria przyjmuje tylko pliki .webm' }));
            return;
        }

        setState({
            stage:    'uploading',
            filename: file.name,
            sizeMB:   fmtSize(file.size),
            progress: 0,
            errorMsg: '',
        });

        const formData = new FormData();
        formData.append('video', file);

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        // Postęp uploadu
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                setState(s => ({ ...s, progress: pct }));
            }
        };

        // Upload zakończony → serwer przetwarza → oczekuj na odpowiedź
        xhr.upload.onload = () => {
            setState(s => ({ ...s, stage: 'converting', progress: 100 }));
        };

        // Odpowiedź serwera (plik binarny lub błąd JSON)
        xhr.responseType = 'blob';

        xhr.onload = () => {
            if (xhr.status === 200) {
                // Pobierz nazwę pliku z nagłówka Content-Disposition
                const cd  = xhr.getResponseHeader('Content-Disposition') ?? '';
                const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                const outName = match?.[1]?.replace(/['"]/g, '') ?? file.name.replace(/\.webm$/i, '_MP4.mp4');

                // Wymuszony download w przeglądarce
                const url = URL.createObjectURL(xhr.response as Blob);
                const a   = document.createElement('a');
                a.href     = url;
                a.download = outName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 10_000);

                setState(s => ({ ...s, stage: 'done', filename: outName }));
            } else {
                // Serwer zwrócił błąd — spróbuj odczytać jako JSON
                const reader = new FileReader();
                reader.onload = () => {
                    let msg = `HTTP ${xhr.status}`;
                    try { msg = JSON.parse(reader.result as string).message ?? msg; } catch { /* */ }
                    setState(s => ({ ...s, stage: 'error', errorMsg: msg }));
                };
                reader.readAsText(xhr.response as Blob);
            }
            xhrRef.current = null;
        };

        xhr.onerror = () => {
            setState(s => ({ ...s, stage: 'error', errorMsg: 'Brak połączenia z Wiesławem (port 3001)' }));
            xhrRef.current = null;
        };

        xhr.open('POST', `${BRIDGE_URL}/api/rafineria/convert`);
        xhr.send(formData);
    }, []);

    // ── Anuluj ────────────────────────────────────────────────────────
    const handleAbort = () => {
        xhrRef.current?.abort();
        xhrRef.current = null;
        setState({ stage: 'idle', filename: '', sizeMB: '', progress: 0, errorMsg: '' });
    };

    // ── Drag & Drop ───────────────────────────────────────────────────
    const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDrop      = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) transmute(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) transmute(file);
        e.target.value = '';
    };

    const handleClick = () => {
        if (state.stage === 'idle' || state.stage === 'error' || state.stage === 'done') {
            setState(s => ({ ...s, errorMsg: '' }));
            fileInputRef.current?.click();
        }
    };

    const isActive = state.stage === 'uploading' || state.stage === 'converting';

    // ══ RENDER ═══════════════════════════════════════════════════════
    return (
        <div className="w-full space-y-4 font-mono">

            {/* ── Nagłówek z opisem ─────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-600/30 to-red-700/20 border border-orange-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                    <Flame className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                    <p className="text-xs text-orange-300 font-bold tracking-[0.15em] uppercase">Rafineria Wiesława</p>
                    <p className="text-[10px] text-slate-500 tracking-wider">WebM → MP4 • H.264 / AAC • Wysoka Jakość</p>
                </div>
            </div>

            {/* ── Strefa Upuść/Wybierz (idle + drop) ───────────────── */}
            <AnimatePresence mode="wait">
                {(state.stage === 'idle' || state.stage === 'error' || state.stage === 'done') && (
                    <motion.div
                        key="dropzone"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        onClick={handleClick}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className="relative cursor-pointer select-none rounded-2xl border-2 border-dashed transition-all duration-200"
                        style={{
                            borderColor: isDragOver ? 'rgba(249,115,22,0.8)' : 'rgba(249,115,22,0.25)',
                            background:  isDragOver ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)',
                        }}
                    >
                        {/* Poświata tła */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-orange-600/5 to-red-800/5 pointer-events-none" />

                        <div className="flex flex-col items-center gap-4 px-6 py-10 z-10 relative">
                            {/* Ikona */}
                            <motion.div
                                animate={isDragOver ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-600/20 to-red-700/15 border border-orange-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.15)]"
                            >
                                {isDragOver ? (
                                    <UploadCloud className="w-8 h-8 text-orange-300" />
                                ) : (
                                    <FileVideo className="w-7 h-7 text-orange-400" />
                                )}
                            </motion.div>

                            {/* Tekst */}
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-200">
                                    {isDragOver ? 'Upuść tutaj — Piece gotowe!' : 'Wrzuć plik .webm do Pieca'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Kliknij lub przeciągnij · Maks. 4 GB
                                </p>
                            </div>

                            {/* Badge formatu */}
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-orange-500/20 text-[10px] text-orange-400 font-bold tracking-widest">
                                    .webm
                                </span>
                                <Zap className="w-3 h-3 text-orange-500/50" />
                                <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-orange-500/20 text-[10px] text-orange-300 font-bold tracking-widest">
                                    .mp4
                                </span>
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".webm,video/webm"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </motion.div>
                )}

                {/* ── Stan: Uploading ─────────────────────────────────── */}
                {state.stage === 'uploading' && (
                    <motion.div
                        key="uploading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl bg-gradient-to-br from-orange-950/50 to-red-950/40 border border-orange-500/30 p-6"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-400 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-orange-300 truncate">{state.filename}</p>
                                <p className="text-[10px] text-slate-500">{state.sizeMB} · Wysyłam do Pieca…</p>
                            </div>
                            <button onClick={handleAbort} className="shrink-0 text-slate-500 hover:text-red-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Pasek postępu uploadu */}
                        <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-orange-600 to-red-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                                animate={{ width: `${state.progress}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <div className="flex justify-between mt-1.5 text-[9px] text-slate-500">
                            <span>Upload</span>
                            <span>{state.progress}%</span>
                        </div>
                    </motion.div>
                )}

                {/* ── Stan: Converting (server-side ffmpeg) ───────────── */}
                {state.stage === 'converting' && (
                    <motion.div
                        key="converting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl bg-gradient-to-br from-red-950/60 to-orange-950/40 border border-red-500/30 p-6"
                    >
                        <div className="flex flex-col items-center gap-5 py-2">
                            {/* Animowane piece */}
                            <div className="relative w-20 h-20">
                                {/* Zewnętrzny pierścień */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                    className="absolute inset-0 rounded-full border-2 border-dashed border-orange-500/30"
                                />
                                {/* Środkowy pierścień */}
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="absolute inset-3 rounded-full border-2 border-red-500/40 border-t-red-400"
                                />
                                {/* Ikona ognia */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                                        transition={{ duration: 1.2, repeat: Infinity }}
                                    >
                                        <Flame className="w-8 h-8 text-orange-400" />
                                    </motion.div>
                                </div>
                            </div>

                            <div className="text-center">
                                <p className="text-sm font-bold text-orange-300">Piece w pracy…</p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    FFmpeg transmutuje materię — to może chwilę potrwać
                                </p>
                                <p className="text-[10px] text-slate-600 mt-0.5 font-mono truncate max-w-[240px]">
                                    {state.filename}
                                </p>
                            </div>

                            {/* Animowany pasek "nieokreślony" */}
                            <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                                <motion.div
                                    className="h-full w-1/3 rounded-full bg-gradient-to-r from-orange-600 via-red-500 to-orange-600"
                                    animate={{ x: ['0%', '200%', '0%'] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{ transformOrigin: 'left' }}
                                />
                            </div>

                            <button
                                onClick={handleAbort}
                                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1.5 border border-slate-700/50 rounded-lg px-3 py-1.5"
                            >
                                <X className="w-3 h-3" /> Anuluj
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ── Stan: Done ──────────────────────────────────────── */}
                {state.stage === 'done' && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl bg-gradient-to-br from-emerald-950/50 to-green-950/40 border border-emerald-500/30 p-6"
                    >
                        <div className="flex flex-col items-center gap-4 py-2 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center"
                            >
                                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                            </motion.div>
                            <div>
                                <p className="text-sm font-bold text-emerald-300">Transmutacja zakończona!</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-mono truncate max-w-[260px]">{state.filename}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Plik .mp4 pobrany automatycznie</p>
                            </div>
                            <button
                                onClick={() => setState({ stage: 'idle', filename: '', sizeMB: '', progress: 0, errorMsg: '' })}
                                className="text-xs text-slate-400 hover:text-orange-300 transition-colors border border-slate-700/60 rounded-lg px-4 py-2 flex items-center gap-2"
                            >
                                <Flame className="w-3.5 h-3.5" /> Transmutuj kolejny plik
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Pasek błędu ───────────────────────────────────────── */}
            <AnimatePresence>
                {state.stage === 'error' && state.errorMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-950/40 border border-red-500/30"
                    >
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="flex-1 text-xs text-red-300">{state.errorMsg}</p>
                        <button
                            onClick={() => setState(s => ({ ...s, stage: 'idle', errorMsg: '' }))}
                            className="shrink-0 text-red-500 hover:text-red-300 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Legenda parametrów konwersji ──────────────────────── */}
            {(state.stage === 'idle' || state.stage === 'error') && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="grid grid-cols-2 gap-2"
                >
                    {[
                        { label: 'Kodek Video', value: 'H.264 (libx264)' },
                        { label: 'Kodek Audio', value: 'AAC 192k' },
                        { label: 'Jakość',      value: 'CRF 18 (wysoka)' },
                        { label: 'Profil',      value: 'Fast Start (streaming)' },
                    ].map(({ label, value }) => (
                        <div
                            key={label}
                            className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/40"
                        >
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{label}</span>
                            <span className="text-[10px] text-slate-300 font-mono">{value}</span>
                        </div>
                    ))}
                </motion.div>
            )}
        </div>
    );
};

export default Rafineria;
