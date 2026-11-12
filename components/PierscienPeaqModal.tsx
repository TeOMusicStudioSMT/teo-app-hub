import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { peaqRingService, PeaqRingState } from '../services/peaqRingService';
import { stanTunelu } from '../lib/tunel';
import { toast } from 'react-hot-toast';

interface PierscienPeaqModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PierscienPeaqModal: React.FC<PierscienPeaqModalProps> = ({ isOpen, onClose }) => {
    const [state, setState] = useState<PeaqRingState>(peaqRingService.getState());
    const [isForging, setIsForging] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [activeTab, setActiveTab] = useState<'kardio' | 'most' | 'gatt'>('kardio');
    const [onlyPeaqFilter, setOnlyPeaqFilter] = useState<boolean>(true);
    const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const unsub = peaqRingService.subscribe(setState);
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        // Sprawdzenie adresu tunelu dla telefonu
        stanTunelu()
            .then((t) => {
                if (t && t.stan === 'dziala' && t.adres) {
                    setTunnelUrl(t.adres);
                } else {
                    setTunnelUrl(null);
                }
            })
            .catch(() => setTunnelUrl(null));
    }, [isOpen]);

    if (!isOpen) return null;

    const handlePair = async () => {
        const ok = await peaqRingService.pairRing(onlyPeaqFilter);
        if (ok) {
            toast.success('💍 Pierścień PEAQ PSR 100 połączony bezpośrednio z PC!');
        } else {
            toast.error('Nie udało się sparować pierścienia BLE.');
        }
    };

    const handleActivateImpulse = async () => {
        setIsActivating(true);
        try {
            await peaqRingService.sendActivationImpulse();
            toast.success('⚡ Wysłano impuls aktywacji pomiaru PPG (0000fee2 / 0000fee3)!');
        } catch {
            toast.error('Nie udało się wysłać impulsu aktywacyjnego.');
        } finally {
            setIsActivating(false);
        }
    };

    const handleToggleSim = () => {
        if (state.isSimulated) {
            peaqRingService.stopSimulation();
            toast('🛑 Wyłączono symulację rezonansu.');
        } else {
            peaqRingService.startSimulation();
            toast.success('⚗️ Aktywowano kalibrację rezonansu 0.00G.');
        }
    };

    const handleForgeGrv = async () => {
        setIsForging(true);
        try {
            const res = await peaqRingService.forgeGrv();
            if (res.success) {
                toast.success(res.message);
            } else {
                toast(res.message, { icon: '⏳' });
            }
        } finally {
            setIsForging(false);
        }
    };

    // Obliczenie adresu Stołu Biometrycznego dla telefonu
    const getMobileTableUrl = () => {
        if (tunnelUrl) {
            return `${tunnelUrl.replace(/\/+$/, '')}/stol/biometria.html`;
        }
        const host = typeof window !== 'undefined' ? (window.location.hostname || '127.0.0.1') : '127.0.0.1';
        return `http://${host}:3001/stol/biometria.html`;
    };

    const copyMobileUrl = () => {
        const url = getMobileTableUrl();
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            toast.success('📋 Skopiowano link Stołu Mobilnego dla telefonu!');
            setTimeout(() => setCopied(false), 2500);
        });
    };

    const heartDuration = state.bpm > 0 ? (60 / state.bpm).toFixed(2) : '1.0';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-cyan-500/30 bg-slate-950/95 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-slate-100 overflow-hidden"
                >
                    {/* Górna belka modalu */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/60">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl animate-pulse">💍</span>
                            <div>
                                <h2 className="text-base md:text-lg font-bold tracking-widest text-cyan-300 font-mono uppercase flex items-center gap-2">
                                    Pierścień Suwerena — PEAQ 0.00G
                                    <span className="text-xs px-2 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-950/50 text-cyan-200 font-mono">
                                        ROZMIAR {state.ringSize}
                                    </span>
                                </h2>
                                <p className="text-[11px] text-slate-400 font-mono">
                                    Model: {state.ringModel} · {state.deviceName} · BLE & Mobile Relay
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Pasek statusu */}
                    <div className="px-5 py-2.5 bg-slate-900/40 border-b border-white/5 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                    state.isRelayed
                                        ? 'bg-blue-400 shadow-[0_0_10px_#60a5fa]'
                                        : state.connected
                                            ? state.isSimulated
                                                ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                                                : 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                                            : state.autoReconnectCount > 0
                                                ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]'
                                                : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                                } animate-pulse`}
                            />
                            <span className="text-slate-300 font-semibold">{state.statusText}</span>

                            {state.isRelayed && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-950/70 text-blue-300 text-[10px] border border-blue-500/40 flex items-center gap-1 font-bold">
                                    📱 STÓŁ MOBILNY
                                </span>
                            )}

                            {state.isSimulated && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30">
                                    KALIBRACJA 0.00G
                                </span>
                            )}

                            {state.keepAliveActive && !state.isRelayed && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 text-[10px] border border-emerald-500/40 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    Keep-Alive 8s
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                            <span>🔋 Bateria: <strong className="text-slate-200">{state.battery}%</strong></span>
                            <span>📡 Źródło: <strong className={state.isRelayed ? 'text-blue-400' : 'text-cyan-400'}>{state.source || 'BRAK'}</strong></span>
                            {state.lastUpdate && <span>🕒 {state.lastUpdate}</span>}
                        </div>
                    </div>

                    {/* Nawigacja 3 zakładek */}
                    <div className="flex border-b border-white/10 bg-slate-950 px-5 pt-2 gap-2 text-xs font-mono">
                        <button
                            onClick={() => setActiveTab('kardio')}
                            className={`px-4 py-2 rounded-t-lg border-t border-x transition-all ${
                                activeTab === 'kardio'
                                    ? 'border-cyan-500/40 bg-slate-900 text-cyan-300 font-bold'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            💓 Kardiomonitor & Rezonans
                        </button>
                        <button
                            onClick={() => setActiveTab('most')}
                            className={`px-4 py-2 rounded-t-lg border-t border-x transition-all ${
                                activeTab === 'most'
                                    ? 'border-blue-500/40 bg-slate-900 text-blue-300 font-bold'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            📱 Most ze Stołem (Poza Domem) {state.isRelayed && '🟢'}
                        </button>
                        <button
                            onClick={() => setActiveTab('gatt')}
                            className={`px-4 py-2 rounded-t-lg border-t border-x transition-all ${
                                activeTab === 'gatt'
                                    ? 'border-cyan-500/40 bg-slate-900 text-cyan-300 font-bold'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            🔍 Inspektor GATT & Pakiety OEM
                        </button>
                    </div>

                    {/* Treść okna */}
                    <div className="p-5 overflow-y-auto flex-1 space-y-5">
                        {activeTab === 'kardio' ? (
                            <>
                                {/* Kafelki biometryczne */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Puls BPM */}
                                    <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 flex flex-col items-center justify-center text-center relative overflow-hidden">
                                        <div
                                            className="text-4xl my-1 select-none"
                                            style={{
                                                animation: state.bpm > 0 ? `pulse ${heartDuration}s infinite ease-in-out` : 'none',
                                            }}
                                        >
                                            ❤️
                                        </div>
                                        <div className="text-3xl md:text-4xl font-extrabold text-rose-300 font-mono tracking-tight">
                                            {state.bpm > 0 ? state.bpm : '--'}
                                            <span className="text-xs font-normal text-rose-400/80 ml-1">BPM</span>
                                        </div>
                                        <div className="text-[10px] text-rose-400 font-mono uppercase mt-1">
                                            {state.isRelayed ? 'Tętno (ze Stołu Mobilnego)' : 'Tętno Suwerena'}
                                        </div>
                                    </div>

                                    {/* SpO2 */}
                                    <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl text-cyan-400 mb-1">🫁</span>
                                        <div className="text-3xl md:text-4xl font-extrabold text-cyan-300 font-mono tracking-tight">
                                            {state.spo2 > 0 ? state.spo2 : (state.bpm > 0 ? 98 : '--')}
                                            <span className="text-xs font-normal text-cyan-400/80 ml-1">%</span>
                                        </div>
                                        <div className="text-[10px] text-cyan-400 font-mono uppercase mt-1">
                                            Saturacja SpO2
                                        </div>
                                    </div>

                                    {/* Koherencja 0.00G */}
                                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl text-emerald-400 mb-1">⚖️</span>
                                        <div className="text-3xl md:text-4xl font-extrabold text-emerald-300 font-mono tracking-tight">
                                            {state.bpm > 0 ? (state.coherence * 100).toFixed(0) : '--'}
                                            <span className="text-xs font-normal text-emerald-400/80 ml-1">%</span>
                                        </div>
                                        <div className="text-[10px] text-emerald-400 font-mono uppercase mt-1">
                                            Koherencja 0.00G
                                        </div>
                                        <span className="text-[9px] text-emerald-300/80 font-mono font-bold mt-0.5">
                                            {state.level}
                                        </span>
                                    </div>

                                    {/* Ekosystem (Jam & Tetheria) */}
                                    <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl text-purple-400 mb-1">🎹</span>
                                        <div className="text-xl md:text-2xl font-bold text-purple-300 font-mono">
                                            {state.tempo} <span className="text-xs text-purple-400">BPM Jam</span>
                                        </div>
                                        <div className="text-xs font-bold text-purple-300 font-mono mt-0.5">
                                            x{state.manaBonus} <span className="text-[10px] text-purple-400">Mana TGS</span>
                                        </div>
                                        <div className="text-[10px] text-purple-400 font-mono uppercase mt-1">
                                            Synchronizacja Świata
                                        </div>
                                    </div>
                                </div>

                                {/* Pasek Koherencji */}
                                <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
                                    <div className="flex justify-between items-center text-xs font-mono">
                                        <span className="text-slate-400">Harmonia Oddechu i Tętna (Koherencja Rezonansowa):</span>
                                        <span className="font-bold text-cyan-300">{(state.coherence * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-300 transition-all duration-700 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                                            style={{ width: `${Math.min(100, Math.max(5, state.coherence * 100))}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                                        Optymalny spoczynkowy rezonans Katedry: 60–78 BPM. Rytmiczny oddech stabilizuje falę pulsu,
                                        synchronizując tempo perkusji w <em>Jam z Joanną</em> oraz przyspieszając regenerację many w <em>Tetherii</em>.
                                    </p>
                                </div>

                                {/* Opcje parowania i filtr BLE */}
                                <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="peaqFilterCheck"
                                            checked={onlyPeaqFilter}
                                            onChange={(e) => setOnlyPeaqFilter(e.target.checked)}
                                            className="w-4 h-4 rounded border-cyan-500/50 bg-slate-900 text-cyan-500 focus:ring-0"
                                        />
                                        <label htmlFor="peaqFilterCheck" className="text-slate-300 cursor-pointer select-none">
                                            Szybki filtr urządzenia: <strong className="text-cyan-300">Tylko PSR 100 / PEAQ</strong> (ukrywa obce urządzenia)
                                        </label>
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        Auto-Reconnect: <span className="text-emerald-400 font-semibold">Ograniczony do 3 prób (odstęp 3s)</span>
                                    </div>
                                </div>

                                {/* Przyciski akcji */}
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                    <button
                                        onClick={handlePair}
                                        className="px-5 py-2.5 rounded-xl border border-cyan-500/50 bg-cyan-600/20 text-cyan-200 font-mono text-xs font-bold tracking-wider hover:bg-cyan-600/35 transition flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                    >
                                        <span>💍</span> Sparuj Pierścień Bezpośrednio (PC BLE)
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('most')}
                                        className="px-4 py-2.5 rounded-xl border border-blue-500/40 bg-blue-950/30 text-blue-200 font-mono text-xs font-bold hover:bg-blue-900/40 transition flex items-center gap-2 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                    >
                                        <span>📱</span> Użyj Telefonu (Stół Mobilny)
                                    </button>

                                    {state.connected && !state.isRelayed && (
                                        <button
                                            onClick={handleActivateImpulse}
                                            disabled={isActivating}
                                            className="px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-200 font-mono text-xs font-bold hover:bg-amber-900/40 transition flex items-center gap-2"
                                        >
                                            <span>⚡</span> {isActivating ? 'Aktywowanie...' : 'Impuls OEM'}
                                        </button>
                                    )}

                                    <button
                                        onClick={handleToggleSim}
                                        className={`px-4 py-2.5 rounded-xl border font-mono text-xs font-bold transition flex items-center gap-2 ${
                                            state.isSimulated
                                                ? 'border-amber-500/60 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50'
                                                : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/50'
                                        }`}
                                    >
                                        <span>⚗️</span> {state.isSimulated ? 'Zatrzymaj Kalibrację' : 'Symulacja 0.00G'}
                                    </button>

                                    <button
                                        onClick={handleForgeGrv}
                                        disabled={isForging || state.bpm <= 0}
                                        className="px-5 py-2.5 rounded-xl border border-emerald-500/50 bg-emerald-600/20 text-emerald-200 font-mono text-xs font-bold tracking-wider hover:bg-emerald-600/35 transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                    >
                                        <span>🪙</span> {isForging ? 'Przekuwanie...' : 'Przekuj Oddech w GRV'}
                                    </button>

                                    {state.connected && !state.isRelayed && (
                                        <button
                                            onClick={() => peaqRingService.disconnect()}
                                            className="px-3 py-2.5 rounded-xl border border-rose-500/30 text-rose-300 text-xs font-mono hover:bg-rose-950/40 transition ml-auto"
                                        >
                                            Rozłącz
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : activeTab === 'most' ? (
                            /* ZAKŁADKA 2: MOST ZE STOŁEM MOBILNYM */
                            <div className="space-y-4 font-mono text-xs">
                                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">📱</span>
                                            <div>
                                                <h3 className="font-bold text-blue-300 text-sm">
                                                    Architektura Przekaźnika Stołu Mobilnego
                                                </h3>
                                                <p className="text-[11px] text-slate-400">
                                                    Pierścień PEAQ łączy się z telefonem, a Stół Mobilny przesyła biometrię do Katedry.
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                                            state.isRelayed
                                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50 animate-pulse'
                                                : 'bg-slate-800 text-slate-400 border-white/10'
                                        }`}>
                                            {state.isRelayed ? 'TRANSMISJA Z TELEFONU AKTYWNA' : 'OCZEKIWANIE NA TELEFON'}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-2">
                                        <div className="text-slate-300 text-[11px] font-semibold">
                                            Adres Stołu Biometrycznego dla telefonu:
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={getMobileTableUrl()}
                                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-cyan-300 font-mono text-[11px]"
                                            />
                                            <button
                                                onClick={copyMobileUrl}
                                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold whitespace-nowrap transition"
                                            >
                                                {copied ? '✓ Skopiowano' : 'Kopiuj link'}
                                            </button>
                                            <a
                                                href={getMobileTableUrl()}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-slate-300 transition"
                                                title="Otwórz w nowej karcie"
                                            >
                                                ↗
                                            </a>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                                            <span>
                                                Tryb połączenia: <strong className={tunnelUrl ? 'text-amber-400' : 'text-cyan-400'}>{tunnelUrl ? 'Kwantowy Tunel Cloudflare' : 'Lokalna sieć Wi-Fi (LAN)'}</strong>
                                            </span>
                                            <span>Dostępne na Android Chrome i iOS Safari</span>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-white/5 space-y-1">
                                        <p><strong>💡 Jak to działa, gdy jesteś poza domem lub przy biurku:</strong></p>
                                        <p>1. Otwórz powyższy link na telefonie (np. przez Wi-Fi lub Kwantowy Tunel).</p>
                                        <p>2. Na telefonie kliknij <strong>"💍 Sparuj Pierścień PEAQ na Telefonie"</strong>.</p>
                                        <p>3. Stół Mobilny automatycznie podtrzymuje sesję z pierścieniem i przesyła odczyty (BPM, SpO2, bateria) do Katedry.</p>
                                        <p>4. Komputer PC automatycznie wyświetla tętno na Kardiomonitorze i zasila Jam z Joanną oraz manę Tetherii bez żadnych zerwań sesji!</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ZAKŁADKA 3: INSPEKTOR GATT */
                            <div className="space-y-4 font-mono text-xs">
                                {/* Pakiety HEX */}
                                <div className="p-4 rounded-xl border border-cyan-500/30 bg-slate-900/70">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <h3 className="font-bold text-cyan-300 flex items-center gap-2">
                                            <span>📦</span> Ostatnie pakiety telemetryczne HEX (0000fee2 / 0000fee3)
                                        </h3>
                                        <span className="text-[10px] text-cyan-400">
                                            {state.rawPackets.length} odebranych ramek
                                        </span>
                                    </div>
                                    {state.rawPackets.length === 0 ? (
                                        <div className="text-slate-500 italic py-3 text-center text-[11px]">
                                            Brak odebranych pakietów HEX. Kliknij przycisk „Impuls OEM” lub połącz pierścień, aby rozpocząć odbiór ramek.
                                        </div>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px]">
                                            {state.rawPackets.map((pkt, idx) => (
                                                <div key={idx} className="flex flex-wrap items-center gap-2 text-slate-300 hover:text-white border-b border-white/5 pb-1">
                                                    <span className="text-slate-500 text-[10px]">[{pkt.time}]</span>
                                                    <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold text-[10px]">
                                                        {pkt.source}
                                                    </span>
                                                    <span className="text-emerald-400 font-semibold tracking-wide">
                                                        {pkt.hex}
                                                    </span>
                                                    <span className="text-slate-500 text-[10px] ml-auto">
                                                        ({pkt.length} B)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Usługi GATT */}
                                <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60">
                                    <h3 className="font-bold text-cyan-300 mb-2 flex items-center gap-2">
                                        <span>🔍</span> Wykryte usługi GATT (Primary Services)
                                    </h3>
                                    {state.services.length === 0 ? (
                                        <div className="text-slate-500 italic py-4 text-center">
                                            Brak przeskanowanych usług GATT na PC. (Jeśli pierścień jest połączony z telefonem, telemetria spływa przez Stół Mobilny).
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {state.services.map((srv, idx) => (
                                                <div key={idx} className="p-2.5 rounded-lg border border-white/5 bg-slate-950/80">
                                                    <div className="text-cyan-400 font-bold break-all flex items-center justify-between">
                                                        <span>Service: {srv.uuid}</span>
                                                        {srv.uuid.includes('feea') && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-normal">
                                                                Główna usługa OEM Smart Ring
                                                            </span>
                                                        )}
                                                        {srv.uuid.includes('180f') && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-normal">
                                                                Battery Service
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="pl-3 mt-1.5 space-y-1">
                                                        {srv.characteristics.map((c, cIdx) => (
                                                            <div key={cIdx} className="text-slate-300 flex flex-wrap items-center gap-2 text-[11px]">
                                                                <span className="text-slate-400">└ char:</span>
                                                                <span className="break-all font-semibold">{c.uuid}</span>
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                                                                    {c.properties.read ? 'READ ' : ''}
                                                                    {c.properties.write ? 'WRITE ' : ''}
                                                                    {c.properties.notify ? 'NOTIFY ' : ''}
                                                                    {c.properties.indicate ? 'INDICATE' : ''}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Dziennik zdarzeń GATT */}
                                <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-slate-300">Dziennik zdarzeń GATT na żywo</h3>
                                        <span className="text-[10px] text-slate-500">{state.gattLogs.length} wpisów</span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-lg bg-black/50 border border-white/5 font-mono text-[10px] text-slate-300">
                                        {state.gattLogs.map((log, i) => (
                                            <div key={i} className="leading-tight text-slate-300/90 hover:text-white">
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dolny pasek modalu */}
                    <div className="px-5 py-3 border-t border-white/10 bg-slate-900/70 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>Wymiar 0.00G · Most Biometryczny Suwerena (PEAQ PSR 100 & Stół Mobilny)</span>
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-slate-200 transition"
                        >
                            Zamknij panel
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PierscienPeaqModal;
