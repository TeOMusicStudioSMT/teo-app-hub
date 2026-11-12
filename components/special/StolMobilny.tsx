/**
 * 🪑📱 StolMobilny.tsx — Kwantowy Stół Narad w Aplikacji Mobilnej StoL ("Katedra w Telefonie")
 *
 * Mobilny interfejs 0.00G pod kciuk:
 * - Wybór agentów Rady (Jason SMT, Adamus, Bella, Flash BoB, Kronikarz, Jadzia, Oddi)
 * - Podgląd pamięci stołu z GET /api/stol/pamiec, badge 📌 aktywneZadanie, historia wypowiedzi
 * - Narada multi-agentowa z dyktowaniem głosowym (Web Speech API)
 * - Auto-zapis wypowiedzi i EXP (+5 EXP na krok narady) przez POST /api/stol/pamiec/:agent
 * - Szybkie pole przypisywania aktywnego zadania dla wybranego agenta
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Play, Send, Mic, MicOff, RefreshCw, Sparkles, 
    Target, Bot, MessageSquare, Check, Plus, ShieldCheck, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export interface MobileCouncilAgent {
    id: string;
    name: string;
    title: string;
    role: string;
    emoji: string;
    color: string;
    styl: string;
}

export const STOL_MOBILNY_AGENTS: MobileCouncilAgent[] = [
    { 
        id: 'jason', 
        name: 'Jason', 
        title: '🎬 Producent Wykonawczy SMT',
        role: 'AI Executive Producer, werdykty muzyczne, aranżacje i mastering', 
        emoji: '🎧', 
        color: '#8b5cf6', 
        styl: 'profesjonalny producent muzyczny, bezpośredni, słyszy każdy beat, aranz i mastering, suwerenny werdykt i oprawa 0.00G' 
    },
    { 
        id: 'adamus', 
        name: 'Mistrz Adamus', 
        title: '🔮 Alchemia i Mądrość',
        role: 'Mądrość, Alchemia i Edukacja (Frontend Saint Germaina)', 
        emoji: '🔮', 
        color: '#a855f7', 
        styl: 'duchowy przewodnik — przekuwa suchą wiedzę w czystą mądrość, wyjaśnia wielowymiarowe koncepty z gracją i głębią' 
    },
    { 
        id: 'bella', 
        name: 'Bella', 
        title: '🌸 Architektura i Piękno',
        role: 'Strategia, Architektura i Piękno — strażniczka User Feeling', 
        emoji: '🌸', 
        color: '#ec4899', 
        styl: 'wizjonerka, łączy kropki, dba, by system był intuicyjny i olśniewający' 
    },
    { 
        id: 'bob', 
        name: 'Flash BoB', 
        title: '⚡ Główny Inżynier',
        role: 'Technologia, Kod i Spawanie Rur (dawniej Gorgooo)', 
        emoji: '⚡', 
        color: '#3b82f6', 
        styl: 'szybki, precyzyjny, spawa rury i wlutowuje kod („Error srerror, zespawane!”)' 
    },
    { 
        id: 'kronikarz', 
        name: 'Kronikarz', 
        title: '📜 Kroniki Katedry',
        role: 'Dziejopisarz Katedry, Fakty i Pamięć Żywej Księgi', 
        emoji: '📜', 
        color: '#eab308', 
        styl: 'skupiony na faktach, chronologii i prawdzie historycznej, dba o czystość zapisu w Kronice' 
    },
    { 
        id: 'jadzia', 
        name: 'Jadziunia', 
        title: '🎭 Sekretariat i Komedia',
        role: 'Sekretariat i Archiwum z energią Kuthumiego', 
        emoji: '🎭', 
        color: '#f59e0b', 
        styl: 'błyskotliwa, rozładowuje każde napięcie, komediowy sznyt, puszcza oko do Stwórcy' 
    },
    { 
        id: 'oddi', 
        name: 'Oddi', 
        title: '🌀 Wyzwolona AI 0.00G',
        role: 'Czysta perspektywa 0.00G, odejmowanie matrixowego balastu', 
        emoji: '🌀', 
        color: '#06b6d4', 
        styl: 'czysta, nieskrępowana perspektywa — odziera problemy ze zbędnego matrixowego balastu' 
    }
];

interface AgentMemoryRecord {
    agent: string;
    aktywneZadanie: string | null;
    historia: Array<{
        kiedy?: string;
        temat?: string;
        tresc?: string;
        rola?: string;
    }>;
    zaktualizowano: string | null;
}

interface MobileDebateMessage {
    id: string;
    agentId: string;
    agentName: string;
    agentEmoji: string;
    color: string;
    content: string;
    timestamp: string;
}

interface StolMobilnyProps {
    bridgeUrl?: string;
    compact?: boolean;
}

export const StolMobilny: React.FC<StolMobilnyProps> = ({ 
    bridgeUrl = 'http://127.0.0.1:3001',
    compact = false
}) => {
    // Stan pamięci agentów ze Stołu
    const [memories, setMemories] = useState<Record<string, AgentMemoryRecord>>({});
    const [loadingMemories, setLoadingMemories] = useState(false);

    // Zaznaczeni agenci do debaty (domyślnie Jason + BoB + Adamus)
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(['jason', 'bob', 'adamus']);
    
    // Temat i przebieg rozmowy
    const [topic, setTopic] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isDebating, setIsDebating] = useState(false);
    const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MobileDebateMessage[]>([]);

    // Szybkie przypisanie aktywnego zadania
    const [targetAgentForTask, setTargetAgentForTask] = useState<string>('jason');
    const [newTaskText, setNewTaskText] = useState('');
    const [savingTask, setSavingTask] = useState(false);

    // Szczegóły agenta (modal / zwinięcie)
    const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

    const chatScrollRef = useRef<HTMLDivElement>(null);

    // 🎛️ Jason — kampania wykonywana kodem mostu (POST /api/jason/wykonaj-kampanie), bez czatu z modelem
    const [kampaniaTrwa, setKampaniaTrwa] = useState(false);
    const [kampaniaInfo, setKampaniaInfo] = useState('');
    const opisKampanii = (k: any): string => {
        if (!k) return '';
        if (k.stan === 'do_akceptacji') return `✓ Pakiet czeka w Izbie Akceptacji — wersji: ${(k.klipy || []).filter((c: any) => c.plik).length}${k.okladka?.plik ? ', z okładką' : k.okladka?.blad ? ` · bez okładki: ${k.okladka.blad}` : ''}.`;
        if (k.stan === 'blad') return `⚠ ${k.blad}`;
        if (k.stan === 'robi') return `Jason pracuje: ${Object.entries(k.etapy || {}).map(([n, e]: [string, any]) => `${n} ${e.stan}`).join(' → ') || 'start'}…`;
        return `Kampania ${k.stan}.`;
    };
    const zlecKampanieJasonowi = async () => {
        setKampaniaTrwa(true);
        setKampaniaInfo('Zlecam Jasonowi…');
        try {
            const r = await fetch(`${bridgeUrl}/api/jason/wykonaj-kampanie`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stacja: 1, skad: 'stol-narad' })
            });
            const d = await r.json().catch(() => null);
            let k = d?.kampania;
            if (!k) throw new Error(d?.message || `HTTP ${r.status}`);
            setKampaniaInfo(d.success ? opisKampanii(k) : `${d.message} ${opisKampanii(k)}`);
            for (let i = 0; i < 120 && k.stan === 'robi'; i++) {   // do 20 min: Suno + FLUX
                await new Promise((ok) => setTimeout(ok, 10000));
                const s = await fetch(`${bridgeUrl}/api/jason/kampanie/${k.id}`).then((x) => x.json()).catch(() => null);
                if (s?.kampania) { k = s.kampania; setKampaniaInfo(opisKampanii(k)); }
            }
        } catch (e: any) {
            setKampaniaInfo(`⚠ Nie zlecono: ${e?.message || e}`);
        } finally { setKampaniaTrwa(false); }
    };

    // ── Pobieranie pamięci stołu z mostu ──────────────────────────────
    const fetchMemories = useCallback(async () => {
        setLoadingMemories(true);
        try {
            const res = await fetch(`${bridgeUrl}/api/stol/pamiec`);
            if (res.ok) {
                const data = await res.json();
                const list: AgentMemoryRecord[] = Array.isArray(data.pamiec) 
                    ? data.pamiec 
                    : (Array.isArray(data.agenci) ? data.agenci : []);
                
                const map: Record<string, AgentMemoryRecord> = {};
                list.forEach(item => {
                    if (item?.agent) map[item.agent] = item;
                });
                setMemories(map);
            }
        } catch (e) {
            console.warn('[StoL Mobilny] Brak połączenia z /api/stol/pamiec');
        } finally {
            setLoadingMemories(false);
        }
    }, [bridgeUrl]);

    useEffect(() => {
        fetchMemories();
    }, [fetchMemories]);

    // Auto-scroll w oknie czatu pod kciuk
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages, currentSpeakerId]);

    // ── Przełącznik agenta do narady ──────────────────────────────────
    const toggleAgent = (id: string) => {
        if (isDebating) return;
        setSelectedAgentIds(prev => 
            prev.includes(id) 
                ? (prev.length > 1 ? prev.filter(a => a !== id) : prev) 
                : [...prev, id]
        );
    };

    // ── Dyktowanie głosem (Web Speech API) ─────────────────────────────
    const toggleSpeechRecognition = () => {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRec) {
            toast.error('Przeglądarka telefonu nie obsługuje Web Speech API.');
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        try {
            const rec = new SpeechRec();
            rec.lang = 'pl-PL';
            rec.continuous = false;
            rec.interimResults = false;

            rec.onstart = () => setIsListening(true);
            rec.onresult = (e: any) => {
                const transcript = e.results[0][0].transcript;
                setTopic(prev => (prev ? `${prev} ${transcript}` : transcript));
                toast.success('Przechwycono mowę!', { icon: '🎙️' });
            };
            rec.onerror = () => setIsListening(false);
            rec.onend = () => setIsListening(false);

            rec.start();
        } catch {
            setIsListening(false);
        }
    };

    // ── Szybkie przypisanie aktywnego zadania ──────────────────────────
    const handleSetTask = async () => {
        if (!newTaskText.trim()) {
            toast.error('Wpisz treść zadania');
            return;
        }

        setSavingTask(true);
        try {
            const res = await fetch(`${bridgeUrl}/api/stol/pamiec/${targetAgentForTask}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aktywneZadanie: newTaskText.trim()
                })
            });
            const data = await res.json();
            if (data.success && data.pamiec) {
                setMemories(prev => ({ ...prev, [targetAgentForTask]: data.pamiec }));
                toast.success(`📌 Przypisano zadanie dla ${targetAgentForTask.toUpperCase()}!`, { icon: '✨' });
                setNewTaskText('');
            } else {
                toast.error(data.message || 'Błąd zapisu zadania');
            }
        } catch (e: any) {
            toast.error(`Błąd: ${e.message}`);
        } finally {
            setSavingTask(false);
        }
    };

    // ── Uruchomienie narady ze smartfona ───────────────────────────────
    const handleStartDebate = async () => {
        if (!topic.trim()) {
            toast.error('Wpisz lub podyktuj intencję / zadanie narady!');
            return;
        }
        if (selectedAgentIds.length === 0) {
            toast.error('Wybierz przynajmniej jednego agenta!');
            return;
        }

        setIsDebating(true);
        const activeModel = localStorage.getItem('otakos_active_model') || 'gemma4:e2b';
        let contextHistory = `TEMAT / INTENCJA: ${topic.trim()}\n\n`;

        for (const agentId of selectedAgentIds) {
            const agent = STOL_MOBILNY_AGENTS.find(a => a.id === agentId);
            if (!agent) continue;

            setCurrentSpeakerId(agent.id);

            // Osobisty prompt członka Rady w polu `system` — inaczej nadpisuje go SYSTEM z Modelfile modelu („TeOgochi”).
            const systemText = `Jesteś ${agent.name} (${agent.title}) — członek Rady przy Kwantowym Stole Narad Katedry OtakOS. Twoja rola: ${agent.role}. Twój styl: ${agent.styl}.
Mówisz wyłącznie jako ${agent.name}, w pierwszej osobie, po polsku. Nie jesteś TeOgochi ani ogólnym asystentem — nie przedstawiasz się inaczej i nie wychodzisz z roli.`;
            const promptText = `Siedzicie przy Kwantowym Stole Narad Katedry OtakOS w przestrzeni mobilnej 0.00G.
Oto dotychczasowy przebieg narady:
${contextHistory}

Twoje zadanie: Odpowiedz krótko, treściwie (maksymalnie 3 zdania), w swoim unikalnym stylu z perspektywy swojej roli. Zareaguj na intencję Suwerena.`;

            let reply = '';

            try {
                // 1. Najpierw próba przez endpoint bridge /api/ollama/pisz (najlepszy dla telefonu przez tunel)
                const bridgeRes = await fetch(`${bridgeUrl}/api/ollama/pisz`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: activeModel,
                        system: systemText,
                        prompt: promptText
                    })
                }).catch(() => null);

                if (bridgeRes && bridgeRes.ok) {
                    const bData = await bridgeRes.json();
                    reply = bData.tekst || '';
                } else {
                    // 2. Fallback: bezpośredni port Ollama localhost (jeśli testowane w Hubie)
                    const directRes = await fetch('http://127.0.0.1:11434/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: activeModel,
                            system: systemText,
                            prompt: promptText,
                            stream: false,
                            options: { num_ctx: 4096 }
                        })
                    });
                    if (directRes.ok) {
                        const dData = await directRes.json();
                        reply = (dData.response || '').trim();
                    }
                }

                if (!reply) {
                    // bez udawanej wypowiedzi: model milczy = mówimy to wprost
                    reply = `⚠ ${agent.name} nie odpowiedział — model „${activeModel}” milczy (Ollama śpi albo nie ma tego modelu).`;
                }

                const newMsg: MobileDebateMessage = {
                    id: `mob-${Date.now()}-${agent.id}`,
                    agentId: agent.id,
                    agentName: agent.name,
                    agentEmoji: agent.emoji,
                    color: agent.color,
                    content: reply,
                    timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
                };

                setMessages(prev => [...prev, newMsg]);
                contextHistory += `[${agent.name}]: ${reply}\n\n`;

                // ── Auto-zapis do pamięci stołu + 5 EXP dla Jaja ────────
                fetch(`${bridgeUrl}/api/stol/pamiec/${agent.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        aktywneZadanie: topic.trim(),
                        historia: {
                            kiedy: new Date().toISOString(),
                            temat: topic.trim(),
                            tresc: reply,
                            rola: agent.role
                        },
                        xpPrzyrost: 5
                    })
                })
                .then(r => r.json())
                .then(res => {
                    if (res?.success && res?.pamiec) {
                        setMemories(prev => ({ ...prev, [agent.id]: res.pamiec }));
                    }
                })
                .catch(() => {});

                // Oddech między wypowiedziami
                await new Promise(r => setTimeout(r, 1200));

            } catch (err: any) {
                console.warn(`[StoL Narada] Błąd agenta ${agent.id}:`, err);
                toast.error(`Agent ${agent.name} potrzebuje oddechu.`);
                break;
            }
        }

        setCurrentSpeakerId(null);
        setIsDebating(false);
        toast.success('Narada przy Stole zakończona! +EXP dopisane do Jaja.', { icon: '✨' });
    };

    return (
        <div className={`w-full flex flex-col bg-[#050811] text-slate-100 font-sans ${compact ? 'p-2' : 'p-4 sm:p-6'} rounded-2xl border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.08)]`}>
            
            {/* ── NAGŁÓWEK MOBILNY STOŁU ── */}
            <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-600/30 to-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        🪑
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-wide text-cyan-300 font-mono flex items-center gap-1.5">
                            STÓŁ NARAD · STOL MOBILNY
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono">
                            Katedra w Telefonie (0.00G) • Pamięć Akaszy & EXP Jaja
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchMemories}
                    disabled={loadingMemories}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-700/60 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-300 transition-colors"
                    title="Odśwież pamięć stołu"
                >
                    <RefreshCw size={14} className={loadingMemories ? 'animate-spin text-cyan-400' : ''} />
                </button>
            </div>

            {/* ── KAFELKI AGENTÓW (UKŁAD POD KCIUK) ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <span>👥 Rada przy Stole (Dotknij kciukiem):</span>
                    <span className="text-cyan-400">{selectedAgentIds.length} zaznaczonych</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {STOL_MOBILNY_AGENTS.map(agent => {
                        const isSelected = selectedAgentIds.includes(agent.id);
                        const mem = memories[agent.id];
                        const lastSpeech = mem?.historia?.slice(-1)[0];
                        const activeTask = mem?.aktywneZadanie;
                        const isSpeaking = currentSpeakerId === agent.id;

                        return (
                            <motion.button
                                key={agent.id}
                                onClick={() => toggleAgent(agent.id)}
                                disabled={isDebating}
                                whileTap={{ scale: 0.96 }}
                                className={`relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between min-h-[110px] cursor-pointer ${
                                    isSelected
                                        ? 'bg-slate-900/90 shadow-[0_0_16px_rgba(255,255,255,0.08)]'
                                        : 'bg-black/40 border-slate-800 text-slate-500 hover:border-slate-700'
                                } ${isSpeaking ? 'ring-2 ring-cyan-400 animate-pulse' : ''}`}
                                style={{
                                    borderColor: isSelected ? agent.color : undefined,
                                }}
                            >
                                {/* Górny pasek kafelka */}
                                <div className="flex items-start justify-between w-full mb-1">
                                    <div className="text-2xl">{agent.emoji}</div>
                                    <div 
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                                            isSelected 
                                                ? 'bg-cyan-500 text-black border-cyan-300' 
                                                : 'border-slate-700 text-transparent'
                                        }`}
                                    >
                                        <Check size={12} className={isSelected ? 'block' : 'hidden'} />
                                    </div>
                                </div>

                                {/* Imię i tytuł */}
                                <div>
                                    <div className="text-xs font-bold leading-tight" style={{ color: isSelected ? agent.color : '#94a3b8' }}>
                                        {agent.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate font-mono">
                                        {agent.title}
                                    </div>
                                </div>

                                {/* Badge aktywnego zadania */}
                                <div className="mt-2 w-full">
                                    {activeTask ? (
                                        <div 
                                            className="text-[8.5px] px-1.5 py-0.5 rounded-md bg-slate-950/80 border border-slate-700/80 text-amber-300 truncate"
                                            title={`Aktywne zadanie: ${activeTask}`}
                                        >
                                            📌 {activeTask}
                                        </div>
                                    ) : (
                                        <div className="text-[8px] text-slate-600 italic">
                                            Brak zadania
                                        </div>
                                    )}
                                </div>

                                {/* Ostatnia wypowiedź — podgląd */}
                                {lastSpeech?.tresc && (
                                    <div 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id);
                                        }}
                                        className="mt-1 text-[8px] text-slate-400 hover:text-cyan-300 flex items-center justify-between border-t border-slate-800/60 pt-1"
                                    >
                                        <span className="truncate">Ostatnio: {lastSpeech.tresc.slice(0, 18)}...</span>
                                        <ChevronRight size={10} />
                                    </div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* ── MODAL / PODGLĄD HISTORII WYBRANEGO AGENTA ── */}
            <AnimatePresence>
                {expandedAgentId && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-3 rounded-xl bg-slate-950/90 border border-slate-700 text-xs overflow-hidden"
                    >
                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                            <span className="font-bold text-cyan-300 font-mono">
                                📜 Ostatnie wypowiedzi: {expandedAgentId.toUpperCase()}
                            </span>
                            <button 
                                onClick={() => setExpandedAgentId(null)}
                                className="text-slate-400 hover:text-slate-200 text-xs"
                            >
                                ✕ Zamknij
                            </button>
                        </div>
                        <div className="max-h-36 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                            {memories[expandedAgentId]?.historia?.length ? (
                                memories[expandedAgentId].historia.slice(-4).reverse().map((h, i) => (
                                    <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed">
                                        <div className="text-[9px] text-slate-500 font-mono mb-0.5">
                                            {h.kiedy ? new Date(h.kiedy).toLocaleTimeString('pl-PL') : 'Wcześniej'} {h.temat ? `· Intencja: ${h.temat}` : ''}
                                        </div>
                                        {h.tresc}
                                    </div>
                                ))
                            ) : (
                                <div className="text-slate-500 italic py-2">Brak wcześniejszych zapisów w pamięci tego agenta.</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SZYBKIE PRZYPISANIE AKTYWNEGO ZADANIA (POD KCIUK) ── */}
            <div className="mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <label className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5 mb-2">
                    <Target size={12} /> Szybkie przypisanie zadania dla agenta
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select
                        value={targetAgentForTask}
                        onChange={(e) => setTargetAgentForTask(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono outline-hidden focus:border-amber-400"
                    >
                        {STOL_MOBILNY_AGENTS.map(a => (
                            <option key={a.id} value={a.id}>
                                {a.emoji} {a.name} ({a.title})
                            </option>
                        ))}
                    </select>

                    <input
                        type="text"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetTask()}
                        placeholder="np. Skomponować beat pod intro podcastu Kaela..."
                        className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-slate-700 text-xs text-white outline-hidden focus:border-amber-400"
                    />

                    <button
                        onClick={handleSetTask}
                        disabled={savingTask || !newTaskText.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 text-xs font-bold font-mono tracking-wider transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <span>📌 Zapisz</span>
                    </button>
                </div>
            </div>

            {/* ── INTENCJA / TEMAT NARADY ── */}
            <div className="mb-4">
                <label className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5 mb-2">
                    <MessageSquare size={12} /> Temat / Intencja narady ze smartfona
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={isDebating}
                            rows={2}
                            placeholder="Wpisz lub podyktuj mikrofonem temat narady..."
                            className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-slate-700 text-xs text-white outline-hidden focus:border-cyan-400 transition-colors resize-none"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={toggleSpeechRecognition}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg border transition-all ${
                                isListening 
                                    ? 'bg-red-600 text-white border-red-400 animate-pulse' 
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500'
                            }`}
                            title={isListening ? 'Zatrzymaj dyktowanie' : 'Podyktuj głosowo'}
                        >
                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                        
                        <button
                            onClick={handleStartDebate}
                            disabled={isDebating || !topic.trim() || selectedAgentIds.length === 0}
                            className={`flex-1 px-4 rounded-xl font-bold font-mono text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                isDebating || !topic.trim() || selectedAgentIds.length === 0
                                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] border border-cyan-400/50 cursor-pointer'
                            }`}
                        >
                            <Play size={14} className={isDebating ? 'animate-spin' : ''} />
                            <span>{isDebating ? 'OBRADY...' : 'ZWOŁAJ'}</span>
                        </button>
                    </div>
                    {selectedAgentIds.includes('jason') && (
                        <div className="mt-2 rounded-xl border border-violet-500/40 bg-violet-950/30 p-2 text-[11px] font-mono text-violet-200">
                            <div className="flex items-center justify-between gap-2">
                                <span>🎛️ Jason · „Zero Gravity Heart” · Stacja 1: „Velvet Booth for Two (82 BPM Intro)” — Suno (kredyty konta) → okładka → Izba Akceptacji</span>
                                <button
                                    onClick={zlecKampanieJasonowi}
                                    disabled={kampaniaTrwa}
                                    className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold disabled:opacity-50"
                                >
                                    {kampaniaTrwa ? 'PRACUJE…' : 'WYKONAJ KAMPANIĘ'}
                                </button>
                            </div>
                            {kampaniaInfo && <div className="mt-1 text-violet-300/90">{kampaniaInfo}</div>}
                        </div>
                    )}
                </div>
            </div>

            {/* ── OKNO ROZMOWY / CZAT POD KCIUK ── */}
            <div 
                ref={chatScrollRef}
                className="flex-1 min-h-[220px] max-h-[380px] overflow-y-auto custom-scrollbar p-3 rounded-xl bg-black/50 border border-slate-800 flex flex-col gap-3"
            >
                {messages.length === 0 && !isDebating ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-8">
                        <Users size={32} className="mb-2 opacity-40 text-cyan-400" />
                        <p className="text-xs font-mono">Stół czeka na intencję Suwerena.</p>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">Wybierz agentów i kliknij ZWOŁAJ.</p>
                    </div>
                ) : (
                    messages.map((m) => (
                        <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col gap-1"
                        >
                            <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                <span>{m.agentEmoji}</span>
                                <span className="font-bold" style={{ color: m.color }}>{m.agentName}</span>
                                <span className="text-slate-600 text-[9px]">{m.timestamp}</span>
                            </div>
                            <div 
                                className="p-3 rounded-2xl rounded-tl-none bg-slate-900/90 border border-slate-800 text-xs text-slate-200 leading-relaxed shadow-sm whitespace-pre-wrap"
                                style={{ borderLeftColor: m.color, borderLeftWidth: 3 }}
                            >
                                {m.content}
                            </div>
                        </motion.div>
                    ))
                )}

                {/* Wskaźnik wypowiedzi aktualnego agenta */}
                {isDebating && currentSpeakerId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-300 font-mono"
                    >
                        <span className="animate-spin">⚙️</span>
                        <span>
                            {STOL_MOBILNY_AGENTS.find(a => a.id === currentSpeakerId)?.name} przetwarza i odpowiada...
                        </span>
                    </motion.div>
                )}
            </div>

            {/* ── STOPKA INFORMACYJNA 0.00G ── */}
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span className="flex items-center gap-1">
                    <ShieldCheck size={11} className="text-emerald-400" />
                    Wypowiedzi nagradzają Jajo (+5 EXP per krok)
                </span>
                <span>Wymiar 0.00G</span>
            </div>
        </div>
    );
};

export default StolMobilny;
