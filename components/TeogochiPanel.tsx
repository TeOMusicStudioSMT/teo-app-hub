/**
 * 🐣 TeogochiPanel.tsx — Uniwersalny panel zarządzania dowolnym TeOgochi.
 *
 * Dynamicznie renderuje interfejs dla dowolnego gatunku z 13 szablonów:
 * - Statystyki (XP, Etap ewolucji, Sytość, Nastrój)
 * - Akcje opieki (Karmienie smakołykiem, Głaskanie, Chrzcielnica / zmiana imienia, Test głosu)
 * - Wybór rdzenia LLM (per gatunek)
 * - Dedykowany warsztat: Joanna (muzyka), Klatka (wideo), Wektor (wiedza), Kodeks (kod), Bilans (biznes),
 *   lub dynamiczna konsola narzędzi mostu dla pozostałych postaci.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GATUNKI, gatunekPo, type Gatunek } from '../lib/teogochiGatunki';
import {
    stageOf, nextStageOf, moodLabel, pet as petAction, feedTreat,
    type TeogochiState
} from '../lib/teogochiState';
import {
    stanGatunku, zapiszStanGatunku, aktywnyGatunek, ustawAktywny,
    modelGatunku, ustawModelGatunku
} from '../lib/teogochiStado';
import { speak, ucisz } from '../services/voiceService';
import { pobierzPanele, type PanelDef } from '../lib/paneleTeogochi';
import { melduj } from '../lib/szyna';
import { X, Sparkles, Heart, Utensils, Cpu, Wrench, Shield, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';

// Importy wbudowanych podpaneli
import PanelKlatka from './special/PanelKlatka';
import PanelWektor from './special/PanelWektor';
import PanelKodeks from './special/PanelKodeks';
import PanelBilans from './special/PanelBilans';
import PanelWlasny from './special/PanelWlasny';
import { TeOgochiDom } from './TeOgochiDom';

interface TeogochiPanelProps {
    gatunekId: string;
    onClose: () => void;
    onSwitchGatunek?: (id: string) => void;
}

const StatBar: React.FC<{ label: string; value: number; color: string; icon?: React.ReactNode }> = ({
    label, value, color, icon
}) => (
    <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">{icon}{label}</span>
            <span className="font-bold text-slate-200">{Math.round(Math.min(100, Math.max(0, value)))}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800/80 overflow-hidden border border-white/5">
            <motion.div
                animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color}88`
                }}
            />
        </div>
    </div>
);

export const TeogochiPanel: React.FC<TeogochiPanelProps> = ({
    gatunekId,
    onClose,
    onSwitchGatunek,
}) => {
    const gatunek = useMemo(() => gatunekPo(gatunekId) || GATUNKI[0], [gatunekId]);
    const [stan, setStan] = useState<TeogochiState>(() => stanGatunku(gatunek.id));
    const [isDyzing, setIsDyzing] = useState(() => aktywnyGatunek() === gatunek.id);
    const [rdzen, setRdzen] = useState<string>(() => modelGatunku(gatunek.id));
    const [modeleOllama, setModeleOllama] = useState<string[]>([]);
    const [wlasnyPanel, setWlasnyPanel] = useState<PanelDef | null>(null);
    const [activeTab, setActiveTab] = useState<'glowny' | 'warsztat' | 'ewolucja'>('glowny');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [dymekMowy, setDymekMowy] = useState<string | null>(null);
    const [narzedziaStatus, setNarzedziaStatus] = useState<Record<string, 'ok' | 'checking' | 'err'>>({});

    // Uciszanie przy zamknięciu
    useEffect(() => {
        return () => { ucisz(); };
    }, []);

    // Odświeżanie stanu przy zmianie gatunku
    useEffect(() => {
        const s = stanGatunku(gatunek.id);
        setStan(s);
        setIsDyzing(aktywnyGatunek() === gatunek.id);
        setRdzen(modelGatunku(gatunek.id));
        setDymekMowy(null);

        // Pobranie paneli własnych
        pobierzPanele().then(panele => {
            const found = panele.find(p => p.gatunek === gatunek.id);
            setWlasnyPanel(found ?? null);
        }).catch(() => setWlasnyPanel(null));
    }, [gatunek.id]);

    // Pobranie listy modeli Ollama z mostu
    useEffect(() => {
        fetch('http://127.0.0.1:3001/api/ollama/models')
            .then(r => r.json())
            .then((d: { models?: string[] }) => setModeleOllama(d.models ?? []))
            .catch(() => setModeleOllama([]));
    }, []);

    const etap = stageOf(stan.xp);
    const nastepnyEtap = nextStageOf(stan.xp);
    const forma = gatunek.formy[etap.stage] || '🥚';
    const nastroj = moodLabel(stan);

    // Obliczenie postępu do następnego etapu
    const xpProgress = useMemo(() => {
        if (!nastepnyEtap) return 100;
        const currentMin = etap.minXp;
        const targetXP = nastepnyEtap.minXp;
        const range = targetXP - currentMin;
        if (range <= 0) return 100;
        return Math.min(100, Math.max(0, ((stan.xp - currentMin) / range) * 100));
    }, [stan.xp, etap, nastepnyEtap]);

    // Obsługa mowy
    const powiedz = useCallback(async (tekst: string) => {
        setDymekMowy(tekst);
        setIsSpeaking(true);
        try {
            const glosRodzaj = (gatunek.glos?.includes('female') || gatunek.id === 'joanna' || gatunek.id === 'paleta')
                ? 'zenski' : 'meski';
            await speak(tekst, {
                voiceId: gatunek.id,
                rodzaj: glosRodzaj,
                przewod: 'piper-pl'
            });
        } finally {
            setIsSpeaking(false);
        }
    }, [gatunek]);

    // Głaskanie
    const handlePet = () => {
        const { state, ok } = petAction(stan);
        zapiszStanGatunku(gatunek.id, state);
        setStan({ ...state });
        if (ok) {
            void powiedz(etap.stage === 'jajko'
                ? 'Skorupka robi się ciepła i lekko pulsuje z zadowolenia ✨'
                : `Dziękuję! Moje serce bije w rytmie Katedry. Humor wzrósł!`);
            void melduj(gatunek.id, 'glaskanie', `${gatunek.imie} został pogłaskany.`);
        } else {
            void powiedz(`Jestem już zrelaksowany, daj mi chwilę oddechu 😊`);
        }
    };

    // Karmienie smakołykiem
    const handleTreat = () => {
        const { state, ok } = feedTreat(stan);
        zapiszStanGatunku(gatunek.id, state);
        setStan({ ...state });
        if (ok) {
            void powiedz(`Pyszny wektor soniczny! Moja moc wzrosła o +${etap.stage === 'jajko' ? 30 : 20} XP!`);
            void melduj(gatunek.id, 'smakolyk', `${gatunek.imie} otrzymał smakołyk.`);
        } else {
            void powiedz(`Brzuszek pełny! Wrócimy do jedzenia za jakiś czas 🫧`);
        }
    };

    // Zmiana imienia (Chrzcielnica)
    const handleRename = () => {
        const newName = window.prompt(`Nadaj nowe imię swojemu kompanowi (${gatunek.imie}):`, stan.name || gatunek.imie);
        if (!newName || !newName.trim()) return;
        const nextState = { ...stan, name: newName.trim().slice(0, 24) };
        zapiszStanGatunku(gatunek.id, nextState);
        setStan(nextState);
        void powiedz(`Od teraz z dumą noszę imię ${nextState.name}!`);
    };

    // Ustawienie na dyżur
    const handleSetDyzur = () => {
        ustawAktywny(gatunek.id);
        setIsDyzing(true);
        void melduj(gatunek.id, 'dyzur', `${gatunek.imie} objął główny dyżur.`);
        void powiedz(`Obejmuję dyżur w Katedrze. Stoję na posterunku w dziedzinie: ${gatunek.dziedzina}!`);
    };

    // Test wywołania narzędzia mostu
    const testNarzedzie = async (endpoint: string) => {
        setNarzedziaStatus(prev => ({ ...prev, [endpoint]: 'checking' }));
        try {
            const res = await fetch(`http://127.0.0.1:3001${endpoint}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });
            if (res.ok || res.status < 500) {
                setNarzedziaStatus(prev => ({ ...prev, [endpoint]: 'ok' }));
                void powiedz(`Narzędzie ${endpoint} odpowiada prawidłowo.`);
            } else {
                setNarzedziaStatus(prev => ({ ...prev, [endpoint]: 'err' }));
                void powiedz(`Narzędzie ${endpoint} zgłosiło kod ${res.status}.`);
            }
        } catch {
            setNarzedziaStatus(prev => ({ ...prev, [endpoint]: 'err' }));
            void powiedz(`Most milczy dla trasy ${endpoint}.`);
        }
    };

    // Kliknięcie w przykładowe zadanie
    const executeZadanie = (zadanie: string) => {
        void melduj(gatunek.id, 'polecenie', zadanie);
        void powiedz(`Przyjąłem polecenie: „${zadanie}". Rejestruję intencję w szynie Katedry.`);
    };

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-[fade-in_0.2s_ease-out]">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900/95 border border-slate-700/60 shadow-2xl overflow-hidden text-slate-100"
                style={{
                    boxShadow: `0 0 40px ${gatunek.kolor}22, 0 20px 50px rgba(0,0,0,0.8)`
                }}
            >
                {/* ── Belka Górna ── */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b border-white/10"
                    style={{
                        background: `linear-gradient(90deg, ${gatunek.kolor}18 0%, rgba(15,23,42,0.6) 100%)`
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl select-none border"
                            style={{
                                background: `${gatunek.kolor}22`,
                                borderColor: `${gatunek.kolor}66`,
                                boxShadow: `0 0 16px ${gatunek.kolor}44`
                            }}
                        >
                            {forma}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white tracking-wide">
                                    {stan.name || gatunek.imie}
                                </h3>
                                {isDyzing ? (
                                    <span
                                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase"
                                        style={{ background: gatunek.kolor, color: '#0a0f1c' }}
                                    >
                                        Dyżur
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleSetDyzur}
                                        className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-600 text-slate-300 hover:border-white hover:text-white transition"
                                    >
                                        Weź na dyżur
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                <span style={{ color: gatunek.kolor }}>{gatunek.dziedzina}</span>
                                <span>•</span>
                                <span>{etap.title}</span>
                                <span>•</span>
                                <span>{stan.xp} XP</span>
                            </div>
                        </div>
                    </div>

                    {/* Przełącznik nawigacji i zamknięcie */}
                    <div className="flex items-center gap-2">
                        {/* Zakładki */}
                        <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/5 text-xs">
                            <button
                                onClick={() => setActiveTab('glowny')}
                                className={`px-3 py-1.5 rounded-lg transition font-medium ${activeTab === 'glowny' ? 'bg-white/15 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Podsumowanie
                            </button>
                            <button
                                onClick={() => setActiveTab('warsztat')}
                                className={`px-3 py-1.5 rounded-lg transition font-medium ${activeTab === 'warsztat' ? 'bg-white/15 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Warsztat {gatunek.dziedzina}
                            </button>
                            <button
                                onClick={() => setActiveTab('ewolucja')}
                                className={`px-3 py-1.5 rounded-lg transition font-medium ${activeTab === 'ewolucja' ? 'bg-white/15 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Ewolucja
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800/80 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                            title="Zamknij panel"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── Ciało Panelu (Scrollowalne) ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Dymek Mowy / Komentarz */}
                    <AnimatePresence>
                        {dymekMowy && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="p-3.5 rounded-2xl border flex items-start gap-3 bg-slate-950/70"
                                style={{ borderColor: `${gatunek.kolor}55` }}
                            >
                                <div className="text-2xl select-none">{forma}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-0.5">
                                        <span>{stan.name || gatunek.imie} mówi:</span>
                                        {isSpeaking && <span className="text-purple-400 animate-pulse">🔊 odtwarzanie...</span>}
                                    </div>
                                    <p className="text-sm text-slate-200 italic leading-relaxed">
                                        „{dymekMowy}"
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ZAKŁADKA 1: GŁÓWNY (STATYSTYKI & OPIEKA) */}
                    {activeTab === 'glowny' && (
                        <div className="space-y-6">
                            {/* Karta Opisu & Postępu */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2 p-4 rounded-2xl bg-slate-800/40 border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-mono text-slate-400">MISJA GATUNKU</span>
                                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-white/10" style={{ color: gatunek.kolor }}>
                                            {nastroj}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {gatunek.opis}
                                    </p>

                                    {/* Pasek XP do następnego etapu */}
                                    <div className="pt-2 border-t border-white/5 space-y-1">
                                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                                            <span>Etap: <b className="text-white">{etap.title}</b> ({stan.xp} XP)</span>
                                            <span>Kolejny: {nastepnyEtap ? `${nastepnyEtap.title} (${nastepnyEtap.minXp} XP)` : 'MAKSYMALNY'}</span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-slate-900 border border-white/10 overflow-hidden">
                                            <motion.div
                                                animate={{ width: `${xpProgress}%` }}
                                                className="h-full rounded-full"
                                                style={{ background: `linear-gradient(90deg, ${gatunek.kolor}, #c084fc)` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Paski potrzeb */}
                                <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/5 flex flex-col justify-around gap-3">
                                    <StatBar label="Sytość (Energia)" value={stan.satiety} color="#10b981" icon={<Utensils className="w-3 h-3 text-emerald-400" />} />
                                    <StatBar label="Humor / Rezonans" value={stan.mood} color="#ec4899" icon={<Heart className="w-3 h-3 text-pink-400" />} />
                                    <StatBar label="Doświadczenie" value={xpProgress} color={gatunek.kolor} icon={<Sparkles className="w-3 h-3" />} />
                                </div>
                            </div>

                            {/* Pasek Akcji Opieki */}
                            <div>
                                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" style={{ color: gatunek.kolor }} />
                                    Interakcje i Opieka nad Kompanem
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleTreat}
                                        className="p-3.5 rounded-2xl bg-slate-800/60 border border-emerald-500/30 hover:border-emerald-400/70 flex flex-col items-center gap-1.5 text-center transition"
                                    >
                                        <span className="text-2xl">🍱</span>
                                        <span className="text-xs font-bold text-emerald-300">Smakołyk</span>
                                        <span className="text-[10px] text-slate-400">+20 XP • +Sytość</span>
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handlePet}
                                        className="p-3.5 rounded-2xl bg-slate-800/60 border border-pink-500/30 hover:border-pink-400/70 flex flex-col items-center gap-1.5 text-center transition"
                                    >
                                        <span className="text-2xl">✨</span>
                                        <span className="text-xs font-bold text-pink-300">Pogłaszcz</span>
                                        <span className="text-[10px] text-slate-400">+Humor • +Rezonans</span>
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => powiedz(`Cześć! Jestem ${stan.name || gatunek.imie}. Moja rola w Katedrze to: ${gatunek.dziedzina}. ${gatunek.opis}`)}
                                        className="p-3.5 rounded-2xl bg-slate-800/60 border border-cyan-500/30 hover:border-cyan-400/70 flex flex-col items-center gap-1.5 text-center transition"
                                    >
                                        <span className="text-2xl">🎙️</span>
                                        <span className="text-xs font-bold text-cyan-300">Test Głosu</span>
                                        <span className="text-[10px] text-slate-400">Przedstawienie</span>
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleRename}
                                        className="p-3.5 rounded-2xl bg-slate-800/60 border border-purple-500/30 hover:border-purple-400/70 flex flex-col items-center gap-1.5 text-center transition"
                                    >
                                        <span className="text-2xl">🏷️</span>
                                        <span className="text-xs font-bold text-purple-300">Chrzcielnica</span>
                                        <span className="text-[10px] text-slate-400">Zmień imię</span>
                                    </motion.button>
                                </div>
                            </div>

                            {/* Konfiguracja Rdzenia LLM */}
                            <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                                    <Cpu className="w-4 h-4 text-amber-400" />
                                    <span>RDZEŃ MYŚLĄCY (MODEL LLM DLA TEGO GATUNKU)</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 items-center">
                                    <select
                                        value={rdzen}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setRdzen(v);
                                            ustawModelGatunku(gatunek.id, v);
                                            void powiedz(`Mój rdzeń został przestawiony na: ${v || 'globalny model Katedry'}.`);
                                        }}
                                        className="w-full sm:w-80 rounded-xl border border-slate-700 bg-black/60 px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500"
                                    >
                                        <option value="">jak Katedra (globalny rdzeń)</option>
                                        {modeleOllama.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <span className="text-[11px] text-slate-400 leading-tight">
                                        {rdzen ? `Dedykowany model: ${rdzen}` : 'Używa domyślnego modelu systemowego OtakOS'}
                                    </span>
                                </div>
                            </div>

                            {/* Szybkie Polecenia */}
                            <div>
                                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                                    Przykładowe Polecenia dla {stan.name || gatunek.imie}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {gatunek.zadania.map(z => (
                                        <button
                                            key={z}
                                            onClick={() => executeZadanie(z)}
                                            className="p-2.5 rounded-xl bg-slate-800/50 border border-white/5 hover:border-purple-500/40 text-left text-xs text-slate-300 hover:text-white transition flex items-center justify-between group"
                                        >
                                            <span className="truncate">„{z}"</span>
                                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition text-purple-400 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ZAKŁADKA 2: WARSZTAT DZIEDZINOWY */}
                    {activeTab === 'warsztat' && (
                        <div className="space-y-6">
                            {/* Render dedykowanego modułu w zależności od gatunku */}
                            {gatunek.id === 'joanna' && (
                                <div className="rounded-2xl border border-purple-500/30 overflow-hidden bg-slate-950/60 p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-bold text-purple-300">🎵 Dom & Studio Muzyczne Joanny</h4>
                                        <span className="text-xs font-mono text-slate-400">Asystent Muzyczny</span>
                                    </div>
                                    <TeOgochiDom onClose={onClose} />
                                </div>
                            )}

                            {gatunek.id === 'klatka' && <PanelKlatka />}
                            {gatunek.id === 'wektor' && <PanelWektor />}
                            {gatunek.id === 'kodeks' && <PanelKodeks />}
                            {gatunek.id === 'bilans' && <PanelBilans />}

                            {/* Własny warsztat z kreatora */}
                            {!['joanna', 'klatka', 'wektor', 'kodeks', 'bilans'].includes(gatunek.id) && wlasnyPanel && (
                                <PanelWlasny
                                    panel={wlasnyPanel}
                                    kolor={gatunek.kolor}
                                    onUsuniety={() => setWlasnyPanel(null)}
                                />
                            )}

                            {/* Uniwersalna Konsola Narzędzi Mostu dla pozostałych postaci */}
                            {!['joanna', 'klatka', 'wektor', 'kodeks', 'bilans'].includes(gatunek.id) && !wlasnyPanel && (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/5 space-y-2">
                                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                            <Shield className="w-4 h-4" style={{ color: gatunek.kolor }} />
                                            Narzędzia Mostu dla {gatunek.imie} ({gatunek.dziedzina})
                                        </h4>
                                        <p className="text-xs text-slate-400">
                                            Agent posiada bezpośredni dostęp do poniższych tras i modułów Katedry. Możesz sprawdzić ich łączność jednym kliknięciem:
                                        </p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {gatunek.narzedzia.map(n => {
                                            const status = narzedziaStatus[n];
                                            return (
                                                <div
                                                    key={n}
                                                    className="p-3.5 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-between gap-3"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-mono text-xs text-slate-200 truncate">{n}</div>
                                                        <div className="text-[10px] text-slate-400">Trasa API Katedry</div>
                                                    </div>
                                                    <button
                                                        onClick={() => testNarzedzie(n)}
                                                        disabled={status === 'checking'}
                                                        className="px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition flex items-center gap-1.5 shrink-0"
                                                        style={{
                                                            borderColor: status === 'ok' ? '#10b981' : status === 'err' ? '#ef4444' : `${gatunek.kolor}66`,
                                                            color: status === 'ok' ? '#10b981' : status === 'err' ? '#ef4444' : gatunek.kolor,
                                                            background: status === 'ok' ? '#10b98114' : status === 'err' ? '#ef444414' : 'transparent'
                                                        }}
                                                    >
                                                        {status === 'checking' && <RefreshCw className="w-3 h-3 animate-spin" />}
                                                        {status === 'ok' && <CheckCircle2 className="w-3 h-3" />}
                                                        <span>{status === 'ok' ? 'Online' : status === 'err' ? 'Błąd' : 'Pinguj'}</span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ZAKŁADKA 3: DRZEWO EWOLUCJI */}
                    {activeTab === 'ewolucja' && (
                        <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/5">
                                <h4 className="text-sm font-bold text-slate-200 mb-1">
                                    Ścieżka Ewolucji Gatunku: {gatunek.imie}
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Karmienie, słuchanie radia, dialogi i wykonywanie zadań rozwijają Twojego TeOgochi przez kolejne stadia:
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                {(['jajko', 'pisklę', 'młodzik', 'kompan', 'legenda'] as const).map((stageKey) => {
                                    const isCurrent = etap.stage === stageKey;
                                    const stageForm = gatunek.formy[stageKey];
                                    const minXP = stageKey === 'jajko' ? 0 : stageKey === 'pisklę' ? 100 : stageKey === 'młodzik' ? 500 : stageKey === 'kompan' ? 1500 : 3000;
                                    const isUnlocked = stan.xp >= minXP;

                                    return (
                                        <div
                                            key={stageKey}
                                            className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-2 transition ${isCurrent ? 'bg-white/10 shadow-lg' : isUnlocked ? 'bg-slate-800/40 border-white/10' : 'bg-slate-900/40 border-white/5 opacity-50'}`}
                                            style={{
                                                borderColor: isCurrent ? gatunek.kolor : undefined,
                                                boxShadow: isCurrent ? `0 0 20px ${gatunek.kolor}33` : undefined
                                            }}
                                        >
                                            <div className="text-4xl select-none">{stageForm}</div>
                                            <div className="font-bold text-xs capitalize text-slate-200">
                                                {stageKey}
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-400">
                                                {minXP} XP
                                            </div>
                                            {isCurrent && (
                                                <span
                                                    className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full"
                                                    style={{ background: gatunek.kolor, color: '#0a0f1c' }}
                                                >
                                                    AKTUALNY
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Stopka z wyborem innych TeOgochi ── */}
                <div className="px-6 py-3 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[80%]">
                        <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">Przełącz:</span>
                        {GATUNKI.map(g => (
                            <button
                                key={g.id}
                                onClick={() => onSwitchGatunek ? onSwitchGatunek(g.id) : null}
                                title={`${g.imie} (${g.dziedzina})`}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-base border shrink-0 transition ${g.id === gatunek.id ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
                                style={{
                                    borderColor: g.kolor,
                                    background: g.id === gatunek.id ? `${g.kolor}33` : 'transparent',
                                    boxShadow: g.id === gatunek.id ? `0 0 10px ${g.kolor}` : undefined
                                }}
                            >
                                {g.formy[stageOf(stanGatunku(g.id).xp).stage]}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
                    >
                        Zamknij
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default TeogochiPanel;
