/**
 * 🧬 KwantowyInkubator.tsx v2 - Centrum Szkoleń Agentów
 * "Każdy agent może ewoluować. Pytanie brzmi: w jakim kierunku?"
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OtakOSBus, BUS } from '../../lib/otakosBus';

// ── Typy ──────────────────────────────────────────────────────────────────────
interface InkubatorAgent {
    id: string;
    name: string;
    emoji: string;
    role: string;
    instructions: string;
    trainingLevel: number;
    masteredSkills: string[];
}

interface TrainingSession {
    id: string;
    agentId: string;
    agentName: string;
    skill: string;
    skillName: string;
    insight: string;
    score: number;
    timestamp: number;
}

// ── Ścieżki umiejętności ──────────────────────────────────────────────────────
const SKILL_TRACKS = [
    {
        id: 'analiza',
        name: 'Analiza Danych',
        emoji: '📊',
        color: '#60a5fa',
        prompt: (agent: InkubatorAgent) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nZadanie szkoleniowe: Głęboka Analiza Danych.\nTwoje instrukcje bazowe: "${agent.instructions}"\nWygeneruj 3 konkretne zasady analizy danych, które wyniosą Twoje możliwości na wyższy poziom. Bądź precyzyjny. Odpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
    {
        id: 'negocjacje',
        name: 'Sztuka Negocjacji',
        emoji: '🤝',
        color: '#34d399',
        prompt: (agent: InkubatorAgent) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nZadanie szkoleniowe: Sztuka Negocjacji.\nTwoje instrukcje bazowe: "${agent.instructions}"\nOpisz 3 taktyki negocjacyjne, które możesz zastosować w swojej roli. Co wynegocjujesz inaczej po tym szkoleniu? Odpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
    {
        id: 'kreatywnosc',
        name: 'Kreatywne Rozwiązania',
        emoji: '🎨',
        color: '#f472b6',
        prompt: (agent: InkubatorAgent) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nZadanie szkoleniowe: Kreatywne Myślenie.\nTwoje instrukcje bazowe: "${agent.instructions}"\nWymyśl 3 niekonwencjonalne podejścia do swojej pracy, które mogą zaskoczyć i przynieść wartość. Odpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
    {
        id: 'ryzyko',
        name: 'Zarządzanie Ryzykiem',
        emoji: '⚖️',
        color: '#fbbf24',
        prompt: (agent: InkubatorAgent) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nZadanie szkoleniowe: Zarządzanie Ryzykiem.\nTwoje instrukcje bazowe: "${agent.instructions}"\nZidentyfikuj 3 główne ryzyka w swojej domenie i opisz strategie ich mitygacji. Odpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
    {
        id: 'protokol',
        name: 'Protokół Katedry',
        emoji: '🏛️',
        color: '#a78bfa',
        prompt: (agent: InkubatorAgent) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nZadanie szkoleniowe: Protokół i Etyka Katedry.\nTwoje instrukcje bazowe: "${agent.instructions}"\nOpisz jak lepiej zintegrujesz się z pozostałymi agentami Katedry. Jakie wartości wzmocnisz? Odpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
    {
        id: 'komunikacja',
        name: 'Komunikacja',
        emoji: '📡',
        color: '#22d3ee',
        prompt: (agent: InkubatorAgent) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nZadanie szkoleniowe: Komunikacja i Przekaz.\nTwoje instrukcje bazowe: "${agent.instructions}"\nJak usprawnisz swoje raporty i komunikaty? Opisz 3 konkretne zmiany w sposobie przekazywania informacji. Odpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
    {
        id: 'strategia',
        name: 'Myślenie Strategiczne',
        emoji: '♟️',
        color: '#fb923c',
        prompt: (agent: InkubatorAgent) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nZadanie szkoleniowe: Strategia Długoterminowa.\nTwoje instrukcje bazowe: "${agent.instructions}"\nZdefiniuj swoją 3-etapową strategię rozwoju jako agenta Katedry. Co osiągniesz? Odpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
    {
        id: 'custom',
        name: 'Trening Własny',
        emoji: '✨',
        color: '#e879f9',
        prompt: (agent: InkubatorAgent, custom?: string) =>
            `Jesteś ${agent.name} (${agent.role}) w systemie Katedry OtakOS.\nTwoje instrukcje bazowe: "${agent.instructions}"\nZadanie specjalne: ${custom || 'Samodoskonalenie bez granic.'}\nOdpowiedz po polsku. Na końcu napisz: WYNIK_SZKOLENIA: X/100`,
    },
];

const INTENSITIES = [
    { id: 'zwiad', name: 'Zwiad', emoji: '🔦', tokens: 200, label: '~1 min' },
    { id: 'standard', name: 'Standard', emoji: '🔥', tokens: 400, label: '~2 min' },
    { id: 'gleboki', name: 'Głęboki', emoji: '⚡', tokens: 800, label: '~4 min' },
];

// ── Komponent ─────────────────────────────────────────────────────────────────
export const KwantowyInkubator: React.FC = () => {
    const [queue, setQueue] = useState<InkubatorAgent[]>([]);
    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<InkubatorAgent | null>(null);
    const [selectedSkill, setSelectedSkill] = useState(SKILL_TRACKS[0].id);
    const [selectedIntensity, setSelectedIntensity] = useState(INTENSITIES[1].id);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isTraining, setIsTraining] = useState(false);
    const [streamLog, setStreamLog] = useState<string[]>([]);
    const [currentInsight, setCurrentInsight] = useState('');
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [interruptedTraining, setInterruptedTraining] = useState<{ agentName: string; skillName: string; model: string; startedAt: number } | null>(null);
    // Model selector
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('auto');
    const logRef = useRef<HTMLDivElement>(null);

    // ── Wczytaj stan ─────────────────────────────────────────────────────────
    useEffect(() => {
        loadQueue();
        const saved = localStorage.getItem('inkubator_sessions');
        if (saved) setSessions(JSON.parse(saved));

        // Załaduj modele Ollama
        fetch('http://127.0.0.1:3001/api/ollama/models')
            .then(r => r.json())
            .then(d => {
                if (d.models?.length) setAvailableModels(d.models);
            })
            .catch(() => {});

        // Ustaw domyślny model z Rdzenia
        const saved_model = localStorage.getItem('otakos_active_model');
        if (saved_model) setSelectedModel(saved_model);

        // Sprawdź czy poprzednie szkolenie zostało przerwane
        const interrupted = localStorage.getItem('inkubator_active_training');
        if (interrupted) {
            try { setInterruptedTraining(JSON.parse(interrupted)); } catch {}
        }

        const unsub = OtakOSBus.subscribe(ev => {
            if (ev.type === BUS.CREW_TRAINING_QUEUE) setTimeout(loadQueue, 300);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [streamLog, currentInsight]);

    const loadQueue = () => {
        const raw = localStorage.getItem('inkubator_queue');
        if (raw) {
            const agents: InkubatorAgent[] = JSON.parse(raw);
            setQueue(agents);
            if (agents.length > 0 && !selectedAgent) setSelectedAgent(agents[0]);
        }
    };

    const addLog = (msg: string) => {
        setStreamLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // ── Zapisz raport szkolenia do pliku ─────────────────────────────────────
    const saveTrainingFile = async (session: TrainingSession, agent: InkubatorAgent, model: string) => {
        const date = new Date().toISOString().replace('T', '_').slice(0, 16).replace(':', '-');
        const filename = `${agent.name}_${session.skill}_${date}.md`;
        const agentFile = `${agent.name}_PROFIL.md`;

        const reportContent = `# 🧬 Raport Szkolenia: ${agent.name}
**Data:** ${new Date(session.timestamp).toLocaleString('pl-PL')}
**Ścieżka:** ${session.skillName}
**Model:** ${model}
**Wynik:** ${session.score}/100

---

## Zdobyta Wiedza

${session.insight}

---

*Wygenerowano przez KwantowyInkubator v2 • Katedra OtakOS*
`;

        const agentMasteredSkills = agent.masteredSkills?.join(', ') || 'brak';
        const agentSummary = `# 🤖 Profil Agenta: ${agent.name}
**Rola:** ${agent.role}
**Poziom Szkolenia:** ${agent.trainingLevel}
**Opanowane Umiejętności:** ${agentMasteredSkills}

## Instrukcje Bazowe
${agent.instructions}

## Ostatnie Szkolenie
- **Ścieżka:** ${session.skillName}
- **Wynik:** ${session.score}/100
- **Data:** ${new Date(session.timestamp).toLocaleString('pl-PL')}

## Fragment Insightu
${session.insight.slice(0, 600)}...

---

*Profil zarządzany przez KwantowyInkubator • Gotowy do przekazania do WIDOK / Stół Narad*
`;

        try {
            await Promise.all([
                fetch('http://127.0.0.1:3001/api/bridge/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'WRITE_FILE',
                        payload: { path: `_OtakOs_Wymiar/Inkubator/Raporty/${filename}`, content: reportContent }
                    })
                }),
                fetch('http://127.0.0.1:3001/api/bridge/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'WRITE_FILE',
                        payload: { path: `_OtakOs_Wymiar/Inkubator/Agenci/${agentFile}`, content: agentSummary }
                    })
                }),
            ]);
            addLog(`💾 Zapisano: Inkubator/Raporty/${filename}`);
            addLog(`📄 Zaktualizowano: Inkubator/Agenci/${agentFile}`);
        } catch {
            addLog(`⚠ Nie udało się zapisać pliku (Bridge niedostępny)`);
        }
    };

    // ── Uruchom trening ───────────────────────────────────────────────────────
    const runTraining = async () => {
        if (!selectedAgent) return;
        setIsTraining(true);
        setStreamLog([]);
        setCurrentInsight('');

        const track = SKILL_TRACKS.find(s => s.id === selectedSkill)!;
        const intensity = INTENSITIES.find(i => i.id === selectedIntensity)!;
        const activeModel = selectedModel === 'auto'
            ? (localStorage.getItem('otakos_active_model') || availableModels[0] || 'gemma3:4b')
            : selectedModel;
        const prompt = track.prompt(selectedAgent, customPrompt);

        // Zapisz stan aktywnego treningu (przeżyje zmianę zakładki)
        const activeTrainingState = {
            agentId: selectedAgent.id,
            agentName: selectedAgent.name,
            skill: selectedSkill,
            skillName: track.name,
            model: activeModel,
            startedAt: Date.now(),
        };
        localStorage.setItem('inkubator_active_training', JSON.stringify(activeTrainingState));

        addLog(`🧬 Inicjalizacja treningu: ${selectedAgent.name}`);
        addLog(`📚 Ścieżka: ${track.emoji} ${track.name} | Intensywność: ${intensity.emoji} ${intensity.name}`);
        addLog(`🤖 Model: ${activeModel}`);
        addLog(`⚡ Łączenie z Ollama...`);

        // Autobus: trening rozpoczęty
        OtakOSBus.emit('system', 'inkubator.training.start', {
            agent: selectedAgent.name,
            skill: track.name,
            model: activeModel,
            duration: intensity.label,
        });

        try {
            const res = await fetch('http://127.0.0.1:3001/api/ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: activeModel,
                    messages: [{ role: 'user', content: prompt }],
                    options: { num_predict: intensity.tokens },
                }),
            });

            if (!res.ok || !res.body) throw new Error(`Błąd połączenia: ${res.status}`);

            addLog(`✅ Połączono. Trening w toku...`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
                    try {
                        const parsed = JSON.parse(line.slice(6).trim());
                        if (parsed.type === 'text' && parsed.text) {
                            fullText += parsed.text;
                            setCurrentInsight(fullText);
                        } else if (parsed.type === 'done') {
                            break;
                        } else if (parsed.type === 'error') {
                            throw new Error(parsed.error || 'Błąd Ollama');
                        }
                    } catch {}
                }
            }

            // Wyciągnij wynik
            const scoreMatch = fullText.match(/WYNIK_SZKOLENIA:\s*(\d+)/);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : Math.floor(60 + Math.random() * 35);
            const cleanInsight = fullText.replace(/WYNIK_SZKOLENIA:\s*\d+\/100/g, '').trim();

            const session: TrainingSession = {
                id: `ts_${Date.now()}`,
                agentId: selectedAgent.id,
                agentName: selectedAgent.name,
                skill: selectedSkill,
                skillName: track.name,
                insight: cleanInsight,
                score,
                timestamp: Date.now(),
            };

            // Zaktualizuj agenta w kolejce
            const updatedQueue = queue.map(a => {
                if (a.id !== selectedAgent.id) return a;
                return {
                    ...a,
                    trainingLevel: (a.trainingLevel || 0) + 1,
                    masteredSkills: [...(a.masteredSkills || []), track.id],
                };
            });
            setQueue(updatedQueue);
            localStorage.setItem('inkubator_queue', JSON.stringify(updatedQueue));
            setSelectedAgent(updatedQueue.find(a => a.id === selectedAgent.id) || null);

            const updatedSessions = [session, ...sessions];
            setSessions(updatedSessions);
            localStorage.setItem('inkubator_sessions', JSON.stringify(updatedSessions));

            addLog(`🏆 Wynik szkolenia: ${score}/100`);
            addLog(`✨ Nowa kompetencja zapamiętana: ${track.name}`);

            OtakOSBus.emit('system', BUS.INKUBATOR_TRAINED, {
                agent: selectedAgent.name,
                skill: track.name,
                score,
            });

            // Zapisz raport do pliku
            await saveTrainingFile(session, updatedQueue.find(a => a.id === selectedAgent.id) || selectedAgent, activeModel);

        } catch (err) {
            addLog(`⚠ Błąd: ${err instanceof Error ? err.message : String(err)}`);
            addLog(`💡 Upewnij się że Ollama i Wiesio Bridge (port 3001) działają.`);
        }

        localStorage.removeItem('inkubator_active_training');
        setIsTraining(false);
    };

    // ── Deploy do Akademii ────────────────────────────────────────────────────
    const deployToAcademy = (agent: InkubatorAgent) => {
        const roster: InkubatorAgent[] = JSON.parse(localStorage.getItem('academy_roster') || '[]');
        const exists = roster.find(a => a.id === agent.id);
        if (!exists) {
            roster.push({ ...agent });
            localStorage.setItem('academy_roster', JSON.stringify(roster));
        }

        const newQueue = queue.filter(a => a.id !== agent.id);
        setQueue(newQueue);
        localStorage.setItem('inkubator_queue', JSON.stringify(newQueue));
        if (selectedAgent?.id === agent.id) setSelectedAgent(newQueue[0] || null);

        OtakOSBus.emit('system', BUS.INKUBATOR_DEPLOYED, { agent: agent.name });
        addLog(`🎓 ${agent.name} przeniesiony do TeOSim Academy!`);
    };

    // ── UI ────────────────────────────────────────────────────────────────────
    const currentTrack = SKILL_TRACKS.find(s => s.id === selectedSkill)!;

    return (
        <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-950 to-slate-900 rounded-3xl border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.1)] text-slate-200 font-mono">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-purple-400 tracking-widest flex items-center gap-3">
                        <span>🧬</span> KWANTOWY INKUBATOR v2
                    </h2>
                    <p className="text-xs text-slate-500 tracking-widest mt-1">CENTRUM EWOLUCJI AGENTÓW :: KATEDRA OTAKOS</p>
                </div>
                <div className="flex gap-3 text-xs">
                    <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-300">
                        Kolejka: {queue.length}
                    </span>
                    <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-300">
                        Sesje: {sessions.length}
                    </span>
                </div>
            </div>

            {/* Banner przerwanych szkoleń */}
            {interruptedTraining && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between"
                >
                    <div>
                        <p className="text-xs text-amber-300 font-bold">⚠ Przerwane szkolenie wykryte</p>
                        <p className="text-[10px] text-amber-400/70 mt-0.5">
                            {interruptedTraining.agentName} → {interruptedTraining.skillName} na {interruptedTraining.model}
                            {' '}({new Date(interruptedTraining.startedAt).toLocaleTimeString()})
                        </p>
                    </div>
                    <button
                        onClick={() => { localStorage.removeItem('inkubator_active_training'); setInterruptedTraining(null); }}
                        className="text-[10px] px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors"
                    >
                        Wyczyść
                    </button>
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── Kolumna 1: Kolejka agentów ── */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-1">📋 Kolejka Szkoleniowa</h3>

                    {queue.length === 0 ? (
                        <div className="flex-1 bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                            <div className="text-3xl mb-3 opacity-30">🤖</div>
                            <p className="text-xs text-slate-500">Brak agentów w kolejce.</p>
                            <p className="text-xs text-slate-600 mt-1">Wyślij agenta z CrewCreator → 🎓 Na Szkolenie</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
                            {queue.map(agent => (
                                <motion.div
                                    key={agent.id}
                                    onClick={() => setSelectedAgent(agent)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                        selectedAgent?.id === agent.id
                                            ? 'border-purple-500/60 bg-purple-500/10'
                                            : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xl">{agent.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-200 truncate">{agent.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{agent.role}</p>
                                        </div>
                                        <span className="text-[10px] text-purple-400 shrink-0">LVL {agent.trainingLevel || 0}</span>
                                    </div>
                                    {(agent.masteredSkills?.length ?? 0) > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {agent.masteredSkills.slice(-3).map(s => {
                                                const t = SKILL_TRACKS.find(x => x.id === s);
                                                return t ? (
                                                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${t.color}20`, color: t.color }}>
                                                        {t.emoji}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deployToAcademy(agent); }}
                                        className="mt-2 w-full text-[10px] py-1 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors"
                                    >
                                        🎓 Deploy do Akademii
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Kolumna 2: Konfiguracja treningu ── */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-1">⚙️ Konfiguracja</h3>

                    {selectedAgent ? (
                        <>
                            <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
                                <span className="text-3xl">{selectedAgent.emoji}</span>
                                <div>
                                    <p className="font-bold text-slate-200">{selectedAgent.name}</p>
                                    <p className="text-xs text-slate-400">{selectedAgent.role}</p>
                                </div>
                            </div>

                            {/* Ścieżka */}
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Ścieżka Umiejętności</p>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {SKILL_TRACKS.map(track => (
                                        <button
                                            key={track.id}
                                            onClick={() => setSelectedSkill(track.id)}
                                            title={track.name}
                                            className={`p-2 rounded-xl border text-lg transition-all ${
                                                selectedSkill === track.id
                                                    ? 'border-purple-500/60 bg-purple-500/15 scale-105'
                                                    : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600 opacity-60 hover:opacity-100'
                                            }`}
                                        >
                                            {track.emoji}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-center text-xs mt-2" style={{ color: currentTrack.color }}>
                                    {currentTrack.emoji} {currentTrack.name}
                                </p>
                            </div>

                            {/* Custom prompt */}
                            {selectedSkill === 'custom' && (
                                <textarea
                                    value={customPrompt}
                                    onChange={e => setCustomPrompt(e.target.value)}
                                    placeholder="Wpisz własne zadanie szkoleniowe..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-cyan-300 placeholder-slate-600 resize-none focus:outline-none focus:border-purple-500/60"
                                    rows={3}
                                />
                            )}

                            {/* Intensywność */}
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Intensywność</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {INTENSITIES.map(i => (
                                        <button
                                            key={i.id}
                                            onClick={() => setSelectedIntensity(i.id)}
                                            className={`p-2 rounded-xl border text-center transition-all ${
                                                selectedIntensity === i.id
                                                    ? 'border-purple-500/60 bg-purple-500/15'
                                                    : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="text-base">{i.emoji}</div>
                                            <div className="text-[9px] text-slate-300 mt-0.5">{i.name}</div>
                                            <div className="text-[9px] text-slate-500">{i.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Selektor modelu */}
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Model LLM</p>
                                <select
                                    value={selectedModel}
                                    onChange={e => setSelectedModel(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-purple-500/60"
                                >
                                    <option value="auto">🤖 AUTO (z Rdzenia Wiesi)</option>
                                    {availableModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    {availableModels.length === 0 && (
                                        <option value={localStorage.getItem('otakos_active_model') || 'gemma3:4b'}>
                                            {localStorage.getItem('otakos_active_model') || 'gemma3:4b'} (z pamięci)
                                        </option>
                                    )}
                                </select>
                                <p className="text-[9px] text-slate-600 mt-1">
                                    AUTO = {localStorage.getItem('otakos_active_model') || 'brak — ustaw w Infrastrukturze Wiesi'}
                                </p>
                            </div>

                            {/* Start */}
                            <button
                                onClick={runTraining}
                                disabled={isTraining}
                                className={`w-full py-3 rounded-xl font-bold tracking-widest text-sm transition-all ${
                                    isTraining
                                        ? 'bg-purple-900/40 text-purple-400 border border-purple-500/30 cursor-wait'
                                        : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                                }`}
                            >
                                {isTraining ? '⏳ TRENING W TOKU...' : '▶ ROZPOCZNIJ TRENING'}
                            </button>
                        </>
                    ) : (
                        <div className="flex-1 bg-slate-900/30 border border-dashed border-slate-700 rounded-2xl p-6 flex items-center justify-center text-center">
                            <p className="text-xs text-slate-500">Wybierz agenta z kolejki</p>
                        </div>
                    )}
                </div>

                {/* ── Kolumna 3: Log + Wyniki ── */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-1">📡 Log Szkolenia</h3>

                    <div
                        ref={logRef}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-40 overflow-y-auto flex flex-col gap-1.5 text-[10px]"
                    >
                        {streamLog.length === 0 ? (
                            <p className="text-slate-600 italic">Czekam na polecenie...</p>
                        ) : (
                            streamLog.map((log, i) => (
                                <div key={i} className="text-slate-400 border-l-2 border-purple-500/20 pl-2">{log}</div>
                            ))
                        )}
                    </div>

                    {/* Stream insight */}
                    <AnimatePresence>
                        {(isTraining || currentInsight) && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="bg-slate-950 border border-purple-500/20 rounded-2xl p-4 max-h-40 overflow-y-auto"
                            >
                                <p className="text-[9px] text-purple-400 uppercase tracking-widest mb-2">
                                    {isTraining ? '🧠 GENEROWANIE INSIGHTU...' : '✨ WYNIK TRENINGU:'}
                                </p>
                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{currentInsight}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Historia sesji */}
                    <h3 className="text-xs text-slate-400 uppercase tracking-widest mt-1">📜 Historia</h3>
                    <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                        {sessions.length === 0 ? (
                            <p className="text-[10px] text-slate-600 italic">Brak ukończonych sesji.</p>
                        ) : (
                            sessions.slice(0, 10).map(s => {
                                const track = SKILL_TRACKS.find(t => t.id === s.skill);
                                const isOpen = expandedSession === s.id;
                                return (
                                    <div key={s.id} className="bg-slate-900/40 border border-slate-700/40 rounded-xl overflow-hidden">
                                        <div
                                            className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                                            onClick={() => setExpandedSession(isOpen ? null : s.id)}
                                        >
                                            <span className="text-[10px] text-slate-300">{track?.emoji} {s.agentName}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px]" style={{ color: s.score >= 75 ? '#34d399' : s.score >= 50 ? '#fbbf24' : '#f87171' }}>
                                                    {s.score}/100
                                                </span>
                                                <span className="text-[9px] text-slate-600">{isOpen ? '▲' : '▼'}</span>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-slate-500 px-2.5 pb-1">{s.skillName} • {new Date(s.timestamp).toLocaleTimeString()}</p>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0 }} animate={{ height: 'auto' }}
                                                className="border-t border-slate-700/40 px-2.5 py-2"
                                            >
                                                <p className="text-[9px] text-slate-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                    {s.insight}
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
