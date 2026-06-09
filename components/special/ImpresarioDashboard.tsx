/**
 * 🎙️ ImpresarioDashboard — Panel Agenta Medialnego
 *
 * Trzy sekcje:
 *   A. Kontrola Stacji API (Vault) — karty platform z togglem połączenia
 *   B. Nowe Zlecenie (Enqueue) — formularz publikacji
 *   C. Kolejka Wydawnicza (Live) — polling co 5s z paskami postępu
 *
 * Estetyka: Cyberpunk / Neon — Tailwind CSS + Framer Motion
 * Brak zewnętrznych paczek (styled-components, redux etc.)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Stałe ────────────────────────────────────────────────────────────────────

const BRIDGE_URL = 'http://127.0.0.1:3001';

const PLATFORM_META: Record<string, { label: string; icon: string; accent: string; glow: string }> = {
    youtube: {
        label:  'YouTube',
        icon:   '📺',
        accent: 'border-red-500/60',
        glow:   'rgba(239,68,68,0.15)',
    },
    spotify: {
        label:  'Spotify',
        icon:   '🎵',
        accent: 'border-green-500/60',
        glow:   'rgba(34,197,94,0.15)',
    },
    soundcloud: {
        label:  'SoundCloud',
        icon:   '🌊',
        accent: 'border-orange-500/60',
        glow:   'rgba(249,115,22,0.15)',
    },
};

const STATUS_META: Record<string, { label: string; color: string; bar: string }> = {
    PENDING:    { label: 'OCZEKUJE',     color: 'text-slate-400',  bar: 'bg-slate-600'  },
    PROCESSING: { label: 'W REALIZACJI', color: 'text-cyan-400',   bar: 'bg-cyan-500'   },
    COMPLETE:   { label: 'UKOŃCZONE',    color: 'text-green-400',  bar: 'bg-green-500'  },
    FAILED:     { label: 'BŁĄD',         color: 'text-red-400',    bar: 'bg-red-500'    },
};

// ─── Typy ─────────────────────────────────────────────────────────────────────

interface PlatformVault {
    connected:    boolean;
    last_updated: string;
    [key: string]: unknown;
}

interface VaultData {
    [platform: string]: PlatformVault;
}

interface QueueJob {
    id:               string;
    title:            string;
    album?:           string | null;
    status:           'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
    platforms:        string[];
    progress_percent: number;
    last_updated:     string;
    createdAt?:       string;
    filePath?:        string | null;
    error?:           string;
    // Pola wyników — wypełniane po zakończeniu
    note?:            string;   // "Wyeksportowano paczkę dla DistroKid!" itp.
    exportPath?:      string;   // Ścieżka do folderu paczki Spotify
    youtubeUrl?:      string;   // "https://youtu.be/..."
    youtubeVideoId?:  string;
}

// ─── ImpresarioDashboard ──────────────────────────────────────────────────────

const ImpresarioDashboard: React.FC = () => {

    // ── State ─────────────────────────────────────────────────────────────────
    const [vault,        setVault]        = useState<VaultData>({});
    const [queue,        setQueue]        = useState<QueueJob[]>([]);
    const [statusLoaded, setStatusLoaded] = useState(false);
    const [vaultUpdating, setVaultUpdating] = useState<string | null>(null);

    // Formularz nowego zlecenia
    const [formTitle,     setFormTitle]     = useState('');
    const [formAlbum,     setFormAlbum]     = useState('');
    const [formFilePath,  setFormFilePath]  = useState('');
    const [formPlatforms, setFormPlatforms] = useState<Set<string>>(new Set());
    const [submitting,    setSubmitting]    = useState(false);
    const [submitMsg,     setSubmitMsg]     = useState<{ ok: boolean; text: string } | null>(null);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch status ──────────────────────────────────────────────────────────
    const fetchStatus = useCallback(async () => {
        try {
            const res  = await fetch(`${BRIDGE_URL}/api/impresario/status`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                setVault(data.vault  ?? {});
                setQueue(data.queue  ?? []);
                setStatusLoaded(true);
            }
        } catch (_) { /* bridge offline */ }
    }, []);

    useEffect(() => {
        fetchStatus();
        pollRef.current = setInterval(fetchStatus, 5_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [fetchStatus]);

    // ── Toggle połączenia platformy ────────────────────────────────────────────
    const togglePlatform = useCallback(async (platform: string) => {
        if (vaultUpdating) return;
        const current   = vault[platform]?.connected ?? false;
        const newStatus = !current;

        setVaultUpdating(platform);
        try {
            await fetch(`${BRIDGE_URL}/api/impresario/vault/update`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ platform, isConnected: newStatus }),
            });
            setVault(prev => ({
                ...prev,
                [platform]: { ...(prev[platform] ?? {}), connected: newStatus, last_updated: new Date().toISOString() },
            }));
        } catch (_) { /* network error */ } finally {
            setVaultUpdating(null);
        }
    }, [vault, vaultUpdating]);

    // ── Checkbox platform w formularzu ────────────────────────────────────────
    const toggleFormPlatform = (p: string) => {
        setFormPlatforms(prev => {
            const s = new Set(prev);
            s.has(p) ? s.delete(p) : s.add(p);
            return s;
        });
    };

    // ── Submit nowego zlecenia ─────────────────────────────────────────────────
    const handleEnqueue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() || formPlatforms.size === 0) {
            setSubmitMsg({ ok: false, text: 'Wpisz tytuł i wybierz przynajmniej jedną platformę.' });
            return;
        }
        if (!formFilePath.trim()) {
            setSubmitMsg({ ok: false, text: '📁 Ścieżka do pliku jest wymagana (np. C:\\muzyka\\utwor.wav).' });
            return;
        }
        setSubmitting(true);
        setSubmitMsg(null);
        try {
            const res  = await fetch(`${BRIDGE_URL}/api/impresario/enqueue`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    title:     formTitle.trim(),
                    album:     formAlbum.trim() || null,
                    platforms: [...formPlatforms],
                    filePath:  formFilePath.trim(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSubmitMsg({ ok: true, text: `✅ Zlecenie "${formTitle}" przyjęte do Katedry!` });
                setFormTitle('');
                setFormAlbum('');
                setFormFilePath('');
                setFormPlatforms(new Set());
                setTimeout(fetchStatus, 600);
            } else {
                setSubmitMsg({ ok: false, text: data.message ?? 'Nieznany błąd.' });
            }
        } catch (err: any) {
            setSubmitMsg({ ok: false, text: `Bridge offline: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div
            className="flex flex-col w-full text-[#E6F7FF] overflow-y-auto"
            style={{ backgroundColor: 'rgba(3, 4, 14, 0.97)', minHeight: '420px' }}
        >
            {/* ══ Nagłówek ══ */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3"
                 style={{ borderBottom: '1px solid rgba(0,229,255,0.1)' }}
            >
                <div>
                    <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-[0.3em]">
                        🎙️ Impresario — Agent Medialny Katedry
                    </span>
                    <p className="text-[8px] text-slate-600 mt-0.5 font-mono">
                        Automatyzacja publikacji muzycznej · YouTube · Spotify · SoundCloud
                    </p>
                </div>
                {!statusLoaded && (
                    <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                        className="text-[9px] font-mono text-cyan-700"
                    >
                        ⏳ Łączę z Agencją…
                    </motion.span>
                )}
            </div>

            <div className="flex flex-col gap-0 p-4">

                {/* ══ SEKCJA A: Vault — Karty Platform ══ */}
                <section className="mb-5">
                    <h2 className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-3">
                        A. Kontrola Stacji API
                    </h2>

                    <div className="grid grid-cols-3 gap-3">
                        {Object.entries(PLATFORM_META).map(([key, meta]) => {
                            const isConn    = vault[key]?.connected ?? false;
                            const isUpdating = vaultUpdating === key;

                            return (
                                <motion.div
                                    key={key}
                                    whileHover={{ scale: 1.02 }}
                                    className={`relative p-4 rounded-lg border ${meta.accent} transition-all duration-300`}
                                    style={{
                                        background:   `rgba(5, 5, 20, 0.9)`,
                                        boxShadow:    isConn ? `0 0 16px ${meta.glow}` : '0 0 6px rgba(0,0,0,0.4)',
                                    }}
                                >
                                    {/* Status dot */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <motion.div
                                            animate={isConn ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] } : {}}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isConn ? 'bg-green-400' : 'bg-red-600'}`}
                                        />
                                        <span className="text-[9px] font-mono font-bold tracking-widest">
                                            {meta.icon} {meta.label}
                                        </span>
                                    </div>

                                    <p className={`text-[9px] font-mono mb-3 uppercase tracking-widest ${isConn ? 'text-green-500' : 'text-red-500'}`}>
                                        {isConn ? '● POŁĄCZONO' : '○ ODŁĄCZONO'}
                                    </p>

                                    <p className="text-[8px] text-slate-600 font-mono mb-3">
                                        {vault[key]?.last_updated
                                            ? new Date(vault[key].last_updated).toLocaleTimeString('pl-PL')
                                            : '—'}
                                    </p>

                                    <button
                                        onClick={() => togglePlatform(key)}
                                        disabled={!!vaultUpdating}
                                        className={`w-full py-1.5 text-[9px] font-mono uppercase tracking-widest rounded transition-all duration-200
                                            ${isConn
                                                ? 'bg-red-900/60 hover:bg-red-800 border border-red-600/50 text-red-300'
                                                : 'bg-green-900/60 hover:bg-green-800 border border-green-600/50 text-green-300'
                                            }
                                            ${vaultUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        {isUpdating ? '...' : isConn ? '⏏ Odłącz' : '⚡ Połącz'}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                {/* ══ Dolny rząd: B + C ══ */}
                <div className="grid grid-cols-2 gap-4">

                    {/* ══ SEKCJA B: Formularz Nowego Zlecenia ══ */}
                    <section>
                        <h2 className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-3">
                            B. Nowe Zlecenie Wydawnicze
                        </h2>

                        <form
                            onSubmit={handleEnqueue}
                            className="rounded-lg p-4 space-y-3"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.08)' }}
                        >
                            {/* Tytuł */}
                            <div>
                                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                                    Tytuł Utworu *
                                </label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="np. Echoes of the Void"
                                    className="w-full bg-black/60 border border-slate-700 focus:border-cyan-500 text-white text-xs font-mono rounded px-3 py-2 outline-none transition-colors placeholder-slate-600"
                                    required
                                />
                            </div>

                            {/* Album */}
                            <div>
                                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                                    Album (opcjonalnie)
                                </label>
                                <input
                                    type="text"
                                    value={formAlbum}
                                    onChange={e => setFormAlbum(e.target.value)}
                                    placeholder="np. Cycles"
                                    className="w-full bg-black/60 border border-slate-700 focus:border-cyan-500 text-white text-xs font-mono rounded px-3 py-2 outline-none transition-colors placeholder-slate-600"
                                />
                            </div>

                            {/* Ścieżka do pliku */}
                            <div>
                                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                                    📁 Ścieżka do pliku na dysku (filePath) *
                                </label>
                                <input
                                    type="text"
                                    value={formFilePath}
                                    onChange={e => setFormFilePath(e.target.value)}
                                    placeholder="np. C:\muzyka\moj_utwór.wav lub /home/teo/tracks/song.mp4"
                                    className="w-full bg-black/60 border border-slate-700 focus:border-yellow-500/70 text-white text-xs font-mono rounded px-3 py-2 outline-none transition-colors placeholder-slate-600"
                                    required
                                    spellCheck={false}
                                />
                                <p className="text-[8px] font-mono text-slate-600 mt-1">
                                    Akceptowane: .mp4 .mov .wav .mp3 .flac .m4a .webm
                                </p>
                            </div>

                            {/* Platformy */}
                            <div>
                                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-2">
                                    Platformy Docelowe *
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(PLATFORM_META).map(([key, meta]) => (
                                        <label
                                            key={key}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer text-[9px] font-mono uppercase tracking-widest transition-all duration-200 border
                                                ${formPlatforms.has(key)
                                                    ? `${meta.accent} text-white bg-white/5`
                                                    : 'border-slate-700 text-slate-500 hover:border-slate-500'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={formPlatforms.has(key)}
                                                onChange={() => toggleFormPlatform(key)}
                                            />
                                            {meta.icon} {meta.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <motion.button
                                type="submit"
                                disabled={submitting}
                                whileHover={{ scale: submitting ? 1 : 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full py-2.5 text-[10px] font-mono uppercase tracking-widest rounded transition-all duration-200 border
                                    ${submitting
                                        ? 'bg-cyan-900/30 border-cyan-700/30 text-cyan-700 cursor-not-allowed'
                                        : 'bg-cyan-900/50 hover:bg-cyan-800/60 border-cyan-600/50 text-cyan-300'
                                    }`}
                                style={{ boxShadow: submitting ? 'none' : '0 0 12px rgba(0,229,255,0.15)' }}
                            >
                                {submitting ? '⏳ Wysyłam...' : '🚀 ZLEĆ PUBLIKACJĘ W KATEDRZE'}
                            </motion.button>

                            {/* Feedback */}
                            <AnimatePresence>
                                {submitMsg && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`text-[9px] font-mono rounded px-2 py-1 ${submitMsg.ok ? 'text-green-400 bg-green-900/20' : 'text-orange-400 bg-orange-900/20'}`}
                                    >
                                        {submitMsg.text}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </form>
                    </section>

                    {/* ══ SEKCJA C: Kolejka Live ══ */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest">
                                C. Kolejka Wydawnicza
                            </h2>
                            <span className="text-[8px] font-mono text-slate-600">
                                {queue.length} zadań · poll 5s
                            </span>
                        </div>

                        <div
                            className="rounded-lg overflow-hidden"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.08)', minHeight: '180px' }}
                        >
                            {!statusLoaded ? (
                                <div className="flex items-center justify-center h-full py-10">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                        className="w-5 h-5 rounded-full border-2 border-cyan-700 border-t-transparent"
                                    />
                                </div>
                            ) : queue.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-2">
                                    <span className="text-3xl opacity-20">🎙️</span>
                                    <p className="text-[9px] font-mono text-slate-600 text-center">
                                        Kolejka pusta.<br />
                                        <span className="text-slate-700">Zleć nową publikację w sekcji B.</span>
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-y-auto max-h-[320px] p-3 space-y-3">
                                    <AnimatePresence>
                                        {queue.map(job => {
                                            const meta = STATUS_META[job.status] ?? STATUS_META['PENDING'];
                                            return (
                                                <motion.div
                                                    key={job.id}
                                                    layout
                                                    initial={{ opacity: 0, x: 10 }}
                                                    animate={{ opacity: 1,  x:  0 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                    transition={{ duration: 0.22 }}
                                                    className="rounded-lg p-3"
                                                    style={{
                                                        background: 'rgba(5,5,20,0.8)',
                                                        border:     job.status === 'PROCESSING'
                                                            ? '1px solid rgba(0,229,255,0.25)'
                                                            : job.status === 'COMPLETE'
                                                            ? '1px solid rgba(34,197,94,0.2)'
                                                            : job.status === 'FAILED'
                                                            ? '1px solid rgba(239,68,68,0.2)'
                                                            : '1px solid rgba(100,100,100,0.2)',
                                                    }}
                                                >
                                                    {/* Nagłówek joba */}
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-mono text-cyan-300 truncate font-bold">
                                                                {job.title}
                                                            </p>
                                                            {job.album && (
                                                                <p className="text-[8px] text-slate-500 font-mono">
                                                                    {job.album}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className={`flex-shrink-0 text-[8px] font-mono font-bold uppercase tracking-widest ${meta.color}`}>
                                                            {meta.label}
                                                        </span>
                                                    </div>

                                                    {/* Platformy */}
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {job.platforms.map(p => (
                                                            <span
                                                                key={p}
                                                                className="text-[7px] font-mono px-1.5 py-0.5 rounded"
                                                                style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)' }}
                                                            >
                                                                {PLATFORM_META[p]?.icon} {p}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Pasek postępu */}
                                                    <div className="h-1.5 rounded-full overflow-hidden bg-slate-900">
                                                        <motion.div
                                                            className={`h-full rounded-full ${meta.bar}`}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${job.progress_percent}%` }}
                                                            transition={{ duration: 0.6, ease: 'easeOut' }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-[7px] font-mono text-slate-600">
                                                            {job.progress_percent}%
                                                        </span>
                                                        {job.status === 'PROCESSING' && (
                                                            <motion.span
                                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                                transition={{ repeat: Infinity, duration: 0.9 }}
                                                                className="text-[7px] font-mono text-cyan-600"
                                                            >
                                                                ⚙️ PUBLISHING...
                                                            </motion.span>
                                                        )}
                                                        {job.status === 'COMPLETE' && (
                                                            <span className="text-[7px] font-mono text-green-600">
                                                                ✓ DONE
                                                            </span>
                                                        )}
                                                        {job.status === 'FAILED' && (
                                                            <span className="text-[7px] font-mono text-red-500">
                                                                ✗ FAILED
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Log błędu */}
                                                    {job.error && (
                                                        <div
                                                            className="mt-2 rounded px-2 py-1.5"
                                                            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
                                                        >
                                                            <p className="text-[8px] font-mono text-red-400 leading-relaxed break-all">
                                                                ✗ {job.error}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Log sukcesu / wyniki */}
                                                    {job.status === 'COMPLETE' && (job.note || job.exportPath || job.youtubeUrl) && (
                                                        <div
                                                            className="mt-2 rounded px-2 py-1.5 space-y-0.5"
                                                            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}
                                                        >
                                                            {job.note && (
                                                                <p className="text-[8px] font-mono text-green-400 leading-relaxed">
                                                                    ✓ {job.note}
                                                                </p>
                                                            )}
                                                            {job.exportPath && (
                                                                <p
                                                                    className="text-[7px] font-mono text-yellow-400/70 truncate leading-relaxed"
                                                                    title={job.exportPath}
                                                                >
                                                                    📁 {job.exportPath}
                                                                </p>
                                                            )}
                                                            {job.youtubeUrl && (
                                                                <a
                                                                    href={job.youtubeUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-[7px] font-mono text-red-400/80 hover:text-red-300 block truncate leading-relaxed transition-colors"
                                                                    title={job.youtubeUrl}
                                                                >
                                                                    ▶ {job.youtubeUrl}
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ImpresarioDashboard;
