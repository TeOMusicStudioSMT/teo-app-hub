/**
 * 🚨 AutoPanicSentinel — Pętla Samonaprawy Katedry (Auto-Panic Pipeline)
 *
 * Globalny chwytacz błędów aplikacji. Gdy wyskoczy awaria (Vite, React, CORS,
 * Timeout, błąd składni/sieci) powiązana z Katedrą / W.I.D.O.K., Sentinel po cichu
 * zgłasza crash do Mechanika i — gdy łatka jest gotowa — pokazuje dyskretny,
 * pulsujący szmaragdowy komunikat z jednym przyciskiem zatwierdzenia.
 *
 * Potok:
 *   window.onerror / unhandledrejection
 *     → filtr trafności (Katedra/W.I.D.O.K./sieć/składnia)
 *     → POST /api/mechanic/auto-panic { message, stack }
 *     → MechanicService: turbovec enrichment → Gemma4 → patch → READY_FOR_REVIEW
 *     → polling /api/mechanic/queue aż task = READY_FOR_REVIEW
 *     → 🟢 banner: "MECHANIK PRZYGOTOWAŁ ŁATKĘ DLA OSTATNIEJ AWARII"
 *     → klik → POST /api/mechanic/apply (backup .bak + wdrożenie)
 *
 * Bezpieczeństwo:
 *   - Anty-sztorm: ten sam błąd w oknie cooldown nie generuje kolejnego zgłoszenia.
 *   - Self-guard: błędy pochodzące z własnych wywołań mostu są ignorowane
 *     (brak nieskończonej pętli paniki).
 *   - Wdrożenie wymaga JEDNEGO kliknięcia Suwerena (bezpiecznik).
 *
 * Standard ESM · samodzielny komponent · montowany raz w App.tsx.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const BRIDGE = 'http://127.0.0.1:3001';
const PANIC_COOLDOWN_MS = 30_000;   // ten sam crash nie częściej niż co 30s
const POLL_INTERVAL_MS  = 4_000;    // sprawdzaj kolejkę co 4s
const POLL_MAX_TICKS     = 60;      // poddaj się po ~4 min (zimny start VRAM gemma4)

type PatchState = 'idle' | 'diagnosing' | 'ready' | 'applying' | 'applied' | 'failed';

interface ActivePanic {
    taskId: string;
    message: string;
    state:  PatchState;
}

/** Czy ten błąd jest dla nas istotny? (Katedra / W.I.D.O.K. / sieć / składnia) */
function isRelevantError(message: string, stack: string): boolean {
    const hay = `${message}\n${stack}`.toLowerCase();

    // Ignoruj błędy pochodzące z własnej komunikacji z mostem (anty-pętla)
    if (/auto-panic|\/api\/mechanic|127\.0\.0\.1:3001|localhost:3001/.test(hay)) return false;
    // Ignoruj szum rozszerzeń / zewnętrznych skryptów
    if (/extension:\/\/|chrome-extension|resizeobserver loop/.test(hay)) return false;

    return /katedra|widok|w\.i\.d\.o\.k|cors|timeout|failed to fetch|networkerror|ollama|gemma|bridge|wiesio|unexpected token|syntaxerror|is not defined|cannot read|undefined is not/.test(hay);
}

export const AutoPanicSentinel: React.FC = () => {
    const [panic, setPanic]   = useState<ActivePanic | null>(null);
    const [visible, setVisible] = useState(false);

    // Refs unikające stale-closure w listenerach/pollerach
    const recentRef  = useRef<Map<string, number>>(new Map());   // sig → ts
    const busyRef    = useRef(false);                            // jedna aktywna panika na raz
    const pollerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollerRef.current) { clearInterval(pollerRef.current); pollerRef.current = null; }
    }, []);

    /** Odpytuj kolejkę aż znajdziesz task w READY_FOR_REVIEW (lub FAILED). */
    const pollForPatch = useCallback((taskId: string, message: string) => {
        stopPolling();
        let ticks = 0;

        pollerRef.current = setInterval(async () => {
            ticks++;
            if (ticks > POLL_MAX_TICKS) {
                stopPolling();
                busyRef.current = false;
                return;
            }
            try {
                const res  = await fetch(`${BRIDGE}/api/mechanic/queue`);
                const data = await res.json();
                if (!data.success) return;

                const task = (data.tasks ?? []).find((t: any) => t.id === taskId);
                if (!task) return;

                if (task.status === 'READY_FOR_REVIEW') {
                    stopPolling();
                    setPanic({ taskId, message, state: 'ready' });
                    setVisible(true);
                } else if (task.status === 'FAILED') {
                    stopPolling();
                    busyRef.current = false;
                    setPanic({ taskId, message, state: 'failed' });
                    setVisible(true);
                }
            } catch { /* most chwilowo niedostępny — następny tick */ }
        }, POLL_INTERVAL_MS);
    }, [stopPolling]);

    /** Zgłoś crash do Mechanika (po cichu). */
    const reportPanic = useCallback(async (message: string, stack: string, source: string) => {
        // Dedupe po stronie frontu (anty-sztorm)
        const sig = `${message.slice(0, 120)}|${stack.slice(0, 120)}`;
        const now = Date.now();
        const last = recentRef.current.get(sig);
        if (last && now - last < PANIC_COOLDOWN_MS) return;
        recentRef.current.set(sig, now);

        // Tylko jedna aktywna panika naraz (kolejne crashe nie zaśmiecają UI)
        if (busyRef.current) return;
        busyRef.current = true;

        setPanic({ taskId: '', message, state: 'diagnosing' });

        try {
            const res = await fetch(`${BRIDGE}/api/mechanic/auto-panic`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ message, stack, source }),
            });
            const data = await res.json();
            if (data.success && data.taskId) {
                pollForPatch(data.taskId, message);
            } else {
                busyRef.current = false;
            }
        } catch {
            // Most offline — nie panikuj dalej, zwolnij blokadę
            busyRef.current = false;
        }
    }, [pollForPatch]);

    // ── Instalacja globalnych listenerów barierowych ────────────────────────
    useEffect(() => {
        const onError = (ev: ErrorEvent) => {
            const message = ev.message || ev.error?.message || 'Nieznany błąd';
            const stack   = ev.error?.stack || `${ev.filename}:${ev.lineno}:${ev.colno}`;
            if (isRelevantError(message, stack)) {
                reportPanic(message, stack, 'window.error');
            }
        };

        const onRejection = (ev: PromiseRejectionEvent) => {
            const reason  = ev.reason;
            const message = reason?.message || String(reason ?? 'Nieznane odrzucenie Promise');
            const stack   = reason?.stack || '';
            if (isRelevantError(message, stack)) {
                reportPanic(message, stack, 'unhandledrejection');
            }
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        console.log('%c[AutoPanic] 🚨 Pętla samonaprawy aktywna — barierowe listenery zainstalowane.', 'color:#10b981;font-weight:bold;');

        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            stopPolling();
        };
    }, [reportPanic, stopPolling]);

    // ── Akcja: zatwierdź i napraw ───────────────────────────────────────────
    const handleApprove = useCallback(async () => {
        if (!panic?.taskId) return;
        setPanic(p => p ? { ...p, state: 'applying' } : p);
        try {
            const res = await fetch(`${BRIDGE}/api/mechanic/apply`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ id: panic.taskId }),
            });
            const data = await res.json();
            if (data.success) {
                setPanic(p => p ? { ...p, state: 'applied' } : p);
                toast.success(`⚙️ Łatka wdrożona → ${data.targetFile || 'plik'} (backup .bak)`, { duration: 5000 });
                setTimeout(() => { setVisible(false); busyRef.current = false; }, 2500);
            } else {
                setPanic(p => p ? { ...p, state: 'failed' } : p);
                toast.error(`⚠️ ${data.message || 'Nie udało się wdrożyć łatki'}${data.manualHint ? ` · ${data.manualHint}` : ''}`, { duration: 7000 });
                busyRef.current = false;
            }
        } catch (e: any) {
            setPanic(p => p ? { ...p, state: 'failed' } : p);
            toast.error(`❌ Wiesław offline: ${e.message}`);
            busyRef.current = false;
        }
    }, [panic]);

    const dismiss = useCallback(() => {
        setVisible(false);
        busyRef.current = false;
        stopPolling();
    }, [stopPolling]);

    // Nie renderuj banera dopóki łatka nie jest gotowa (diagnoza biegnie cicho w tle)
    const showBanner = visible && panic && (panic.state === 'ready' || panic.state === 'applying' || panic.state === 'applied' || panic.state === 'failed');

    return (
        <AnimatePresence>
            {showBanner && (
                <motion.div
                    key="auto-panic-banner"
                    initial={{ opacity: 0, y: 40, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9998] pointer-events-auto"
                >
                    <div
                        className="auto-panic-pulse flex items-center gap-3 px-4 py-3 rounded-xl font-mono
                                   bg-[#001a0d] border border-emerald-500/60 backdrop-blur-md max-w-[92vw]"
                    >
                        <span className="text-lg leading-none">⚙️</span>

                        <div className="flex flex-col min-w-0">
                            {panic?.state === 'failed' ? (
                                <span className="text-[11px] font-bold text-amber-300 tracking-wide">
                                    ⚠️ MECHANIK NIE ZDOŁAŁ WYGENEROWAĆ ŁATKI — sprawdź Szmaragdowy Terminal
                                </span>
                            ) : panic?.state === 'applied' ? (
                                <span className="text-[11px] font-bold text-emerald-300 tracking-wide">
                                    ✅ AWARIA NAPRAWIONA — łatka wdrożona (backup .bak utworzony)
                                </span>
                            ) : (
                                <span className="text-[11px] font-bold text-emerald-300 tracking-wide">
                                    ⚙️ MECHANIK PRZYGOTOWAŁ ŁATKĘ DLA OSTATNIEJ AWARII
                                </span>
                            )}
                            {panic?.message && panic.state !== 'applied' && (
                                <span className="text-[9px] text-emerald-600 truncate max-w-[420px]">
                                    {panic.message}
                                </span>
                            )}
                        </div>

                        {(panic?.state === 'ready' || panic?.state === 'applying') && (
                            <button
                                onClick={handleApprove}
                                disabled={panic.state === 'applying'}
                                className="flex-shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg
                                           bg-emerald-600/80 hover:bg-emerald-500 text-black
                                           border border-emerald-400/60 transition-colors
                                           disabled:opacity-60 disabled:cursor-wait
                                           shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                            >
                                {panic.state === 'applying'
                                    ? '⏳ NAPRAWIAM...'
                                    : '🟢 KLIKNIJ ABY ZATWIERDŹ I NAPRAWIĆ'}
                            </button>
                        )}

                        <button
                            onClick={dismiss}
                            title="Ukryj"
                            className="flex-shrink-0 text-emerald-700 hover:text-emerald-400 transition-colors text-sm px-1"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Pulsacja szmaragdowa */}
                    <style>{`
                        @keyframes autoPanicPulse {
                            0%, 100% { box-shadow: 0 0 8px rgba(16,185,129,0.25); border-color: rgba(16,185,129,0.45); }
                            50%      { box-shadow: 0 0 22px rgba(16,185,129,0.7);  border-color: rgba(52,211,153,0.9); }
                        }
                        .auto-panic-pulse { animation: autoPanicPulse 1.8s ease-in-out infinite; }
                    `}</style>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AutoPanicSentinel;
