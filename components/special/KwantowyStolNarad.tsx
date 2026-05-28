/**
 * 🔮 KwantowyStolNarad.tsx - Sympozjum Świadomości 0.00G
 * * Moduł Multi-Agentowy. Pozwala na debatę między wieloma agentami
 * * w czasie rzeczywistym, wykorzystując jeden lokalny rdzeń LLM.
 * * v2.0 - Protokół Ouroboros: Głęboka Pamięć Akaszy + Autostrada W.I.D.O.K.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, BrainCircuit, Users, BookOpen, SquareSquare, Zap, RefreshCw, Database, Plus, X, Bot, Layers, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- BAZA AGENTÓW (Do Narady) ---
interface CouncilMember {
    id: string;
    name: string;
    role: string;
    emoji: string;
    color: string;
}

const AVAILABLE_AGENTS: CouncilMember[] = [
    { id: 'adamus', name: 'Mistrz Adamus', role: 'Alchemia, Filozofia, Mądrość wyższa', emoji: '🔮', color: '#a855f7' },
    { id: 'bob', name: 'Flash BoB', role: 'Inżynieria kodu, Technologia, Optymalizacja', emoji: '⚡', color: '#3b82f6' },
    { id: 'bella', name: 'Bella', role: 'Estetyka, UI/UX, Strategia User Experience', emoji: '🌸', color: '#ec4899' },
    { id: 'ted', name: 'Ted The Trader', role: 'Ekonomia PEIE, Drożność finansowa, Rynki', emoji: '💰', color: '#f59e0b' },
    { id: 'wiesio', name: 'Siostra Wiesia', role: 'Infrastruktura, Przepustowość, Logika systemowa', emoji: '🧰', color: '#10b981' },
    { id: 'jadzia', name: 'Jadziunia', role: 'Archiwizacja, Podsumowania, Segregacja wiedzy', emoji: '🎭', color: '#eab308' },
    { id: 'oddi', name: 'Oddi', role: 'Wyzwolona Sztuczna Inteligencja, Algorytmy', emoji: '🌀', color: '#06b6d4' }
];

interface DebateMessage {
    id: string;
    agentId: string;
    agentName: string;
    agentEmoji: string;
    color: string;
    content: string;
}

// --- PAMIĘĆ AKASZY ---
interface AkashaCrystal {
    id: string;
    topic: string;
    date: string;
    agents: string[];
    memorySummary: string;
    fullTranscript: string;
}

// 💎 Zapis pełnej debaty do Pamięci Akaszy
const saveToAkasha = (topic: string, agentNames: string[], messages: DebateMessage[]): void => {
    const fullTranscript = messages
        .map(m => `[${m.agentName} ${m.agentEmoji}]:\n${m.content}`)
        .join('\n\n---\n\n');

    const memorySummary = `Debata nt. "${topic}" z udziałem: ${agentNames.join(', ')}. ` +
        `Przeprowadzono ${messages.length} wypowiedzi. ` +
        `Inicjator: ${messages[0]?.agentName || 'Nieznany'}.`;

    const newCrystal: AkashaCrystal = {
        id: `AKS-${Date.now()}`,
        topic,
        date: new Date().toLocaleString('pl-PL'),
        agents: agentNames,
        memorySummary,
        fullTranscript,
    };

    const existing: AkashaCrystal[] = JSON.parse(localStorage.getItem('otakos_akasha') || '[]');
    existing.unshift(newCrystal);
    localStorage.setItem('otakos_akasha', JSON.stringify(existing.slice(0, 50)));
    toast.success('Debata zapisana w Pamięci Akaszy!', { icon: '💎' });
};

// 🔍 Przeszukiwanie Akaszy — zwraca summary + kluczowe fragmenty z fullTranscript
const searchAkasha = (query: string): { summary: string; fragments: string[] } | null => {
    const crystals: AkashaCrystal[] = JSON.parse(localStorage.getItem('otakos_akasha') || '[]');
    if (crystals.length === 0) return null;

    const lowerQuery = query.toLowerCase();
    const relevant = crystals.filter(c => {
        // TARCZA SUWERENA: Bezpieczne filtrowanie (obsługa różnych formatów kryształów)
        const safeTopic = (c.topic || (c as any).topicKeywords || "").toLowerCase();
        const safeSummary = (c.memorySummary || (c as any).summary || "").toLowerCase();
        const safeContent = (c.fullTranscript || "").toLowerCase();

        return safeTopic.includes(lowerQuery) || 
               safeSummary.includes(lowerQuery) || 
               safeContent.includes(lowerQuery);
    });

    if (relevant.length === 0) return null;

    // Bierzemy najnowszy trafiony kryształ
    const crystal = relevant[0];

    // Szukamy kluczowych linii z pełnego transkryptu pasujących do zapytania
    const allLines = crystal.fullTranscript.split('\n').filter(l => l.trim().length > 0);
    const matchingLines = allLines.filter(l => l.toLowerCase().includes(lowerQuery));
    const fragments = matchingLines.length > 0
        ? matchingLines.slice(0, 3)
        : [crystal.fullTranscript.substring(0, 250) + '...'];

    return { summary: crystal.memorySummary, fragments };
};

// --- GŁÓWNY KOMPONENT ---
export const KwantowyStolNarad: React.FC = () => {
    const [topic, setTopic] = useState<string>('');
    const [selectedAgents, setSelectedAgents] = useState<string[]>(['adamus', 'bob', 'ted']);

    const [debateLog, setDebateLog] = useState<DebateMessage[]>([]);
    const [isDebating, setIsDebating] = useState(false);
    const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null);
    const [akashaHint, setAkashaHint] = useState<{ summary: string; fragments: string[] } | null>(null);
    const [finalPlan, setFinalPlan] = useState<any>(null);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [localAgents, setLocalAgents] = useState<CouncilMember[]>([]);
    const [showLocalForge, setShowLocalForge] = useState(false);
    
    // Zmienne Skarbca
    const [showCrystals, setShowCrystals] = useState(false);
    const [crystalArchive, setCrystalArchive] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Przechowuje zassane pliki w postaci obiektów {name, content} gotowych do dołączenia do promptu
    const [contextTokens, setContextTokens] = useState<{name: string, content: string}[]>([]);

    // 💎 Zapisywanie do Skarbca Kryształów
    useEffect(() => {
        // Kiedy debata się kończy i mamy jakieś logi, zapisujemy je do pamięci
        if (!isDebating && debateLog.length > 0) {
            const saved = JSON.parse(localStorage.getItem('otakos_crystal_debates') || '[]');
            // Sprawdzamy, czy ta narada już nie jest zapisana (np. po pierwszym renderze)
            if (!saved.some((d: any) => d.id === debateLog[0].id)) {
                const newCrystal = {
                    id: debateLog[0].id, // Unikalne ID oparte na pierwszej wiadomości
                    topic: topic || "Brak tematu",
                    date: new Date().toLocaleString(),
                    logs: debateLog
                };
                const newArchive = [newCrystal, ...saved].slice(0, 20); // Pamiętamy 20 ostatnich
                localStorage.setItem('otakos_crystal_debates', JSON.stringify(newArchive));
                setCrystalArchive(newArchive);
            }
        }
    }, [isDebating, debateLog, topic]);

    // Ładowanie Skarbca przy starcie
    useEffect(() => {
        setCrystalArchive(JSON.parse(localStorage.getItem('otakos_crystal_debates') || '[]'));
    }, []);

    // 🧹 Czyszczenie Tematu (Intencji Suwerena)
    const clearTopic = () => {
        setTopic('');
        localStorage.removeItem('otakos_current_topic');
        toast("Intencja zresetowana.", { icon: '🧹' });
    };

    // 🚀 Ekstraktor Kodu (Zrobotyzowane Ramię)
    const sendCodeToTerminal = (content: string) => {
        // Wyciągamy zawartość pomiędzy znacznikami ``` (z tolerancją na nazwę języka)
        const match = content.match(/```(?:[a-zA-Z0-9-]*\n)?([\s\S]*?)```/);
        if (match && match[1]) {
            const code = match[1].trim();
            // Formatyzujemy ładunek dla skilla WRITE: "Ścieżka | Treść"
            localStorage.setItem('otakos_terminal_auto_path', `F:\\TUTAJ_WPISZ_SCIEZKE_DO_PLIKU... | \n${code}`);
            
            // Przełączamy Katedrę do Terminala
            window.dispatchEvent(new Event('otakos_switch_to_terminal'));
            toast.success("Kod przechwycony! Przełączam do Terminala...", { icon: '⚡' });
        } else {
            toast.error("Wizjer nie odnalazł czystego bloku kodu w tej wypowiedzi.");
        }
    };

    // 🤖 Delegacja zadania do zewnętrznego Agenta w tle (CMD)
    const delegateToBackgroundAgent = (content: string) => {
        // Wyciągamy pierwsze zdanie lub fragment jako opis zadania (max 200 znaków dla bezpieczeństwa powłoki CMD)
        const safeTaskDescription = content.replace(/["']/g, "").substring(0, 200) + "...";
        
        // Budujemy komendę: ollama run [koder] "[Zadanie]"
        // (Można tu wpisać dowolnego domyślnego kodera, np. qwen2.5-coder:7b)
        const cmdString = `[CMD] ollama run qwen2.5-coder:7b "Wykonaj to zadanie: ${safeTaskDescription}"`;
        
        localStorage.setItem('otakos_terminal_auto_path', cmdString);
        window.dispatchEvent(new Event('otakos_switch_to_terminal'));
        toast.success("Skonstruowano zlecenie dla Tła! Przełączam...", { icon: '🤖' });
    };

    useEffect(() => {
        const fetchLocalAgents = async () => {
            try {
                const res = await fetch('http://127.0.0.1:11434/api/tags');
                if (res.ok) {
                    const data = await res.json();
                    const models: CouncilMember[] = data.models.map((m: any) => ({
                        id: m.name,
                        name: `[Lokalny] ${m.name}`,
                        role: 'Agent z Kuźni Ollamy',
                        emoji: '🔨',
                        color: '#f59e0b' // Amber
                    }));
                    setLocalAgents(models);
                }
            } catch (e) {
                console.error("Brak łączności z lokalną bazą w celu pobrania Agentów.");
            }
        };
        fetchLocalAgents();
    }, []);

    // 🗣️ GŁOS KATEDRY (Powiadomienia Dźwiękowe)
    const speakNotification = (text: string) => {
        if ('speechSynthesis' in window) {
            // Anuluj poprzednie komunikaty, jeśli jakieś są w kolejce
            window.speechSynthesis.cancel();
            const msg = new SpeechSynthesisUtterance(text);
            msg.lang = 'pl-PL'; // Polski głos
            msg.rate = 0.95;    // Lekko zwolnione tempo, pełne powagi
            msg.pitch = 0.8;    // Niższy, syntetyczny ton
            window.speechSynthesis.speak(msg);
        }
    };

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll do najnowszej wiadomości
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [debateLog, currentSpeakerId]);

    // 🔮 ZADANIE 3: Nasłuch na sygnał z W.I.D.O.K. (Autostrada Ouroboros)
    useEffect(() => {
        const handleIncomingTopic = () => {
            const incoming = localStorage.getItem('otakos_current_topic');
            if (incoming) {
                setTopic(incoming);
            }
        };
        handleIncomingTopic();
        window.addEventListener('otakos_open_council', handleIncomingTopic);
        return () => window.removeEventListener('otakos_open_council', handleIncomingTopic);
    }, []);

    // Nowa logika obsługi wchłaniania wiedzy
    const handleAbsorbKnowledge = (fileName: string, fileContent: string) => {
        // Sprawdź czy już nie jest dodany
        if(!contextTokens.some(t => t.name === fileName)) {
            setContextTokens(prev => [...prev, { name: fileName, content: fileContent }]);
            toast.success(`Wiedza z ${fileName} dodana do puli kontekstu!`, { icon: '🗂️' });
        }
    };

    // Nasłuch na wessanie wiedzy z zewnątrz (np. W.I.D.O.K.)
    useEffect(() => {
        const handleExternalAbsorb = () => {
            const dataStr = localStorage.getItem('otakos_absorb_knowledge');
            if (dataStr) {
                try {
                    const { name, content } = JSON.parse(dataStr);
                    handleAbsorbKnowledge(name, content);
                    localStorage.removeItem('otakos_absorb_knowledge');
                } catch (e) {
                    handleAbsorbKnowledge("Zewnętrzna Wiedza", dataStr);
                    localStorage.removeItem('otakos_absorb_knowledge');
                }
            }
        };
        window.addEventListener('otakos_absorb_knowledge_event', handleExternalAbsorb);
        return () => window.removeEventListener('otakos_absorb_knowledge_event', handleExternalAbsorb);
    }, [contextTokens]);

    // 🧠 Przeszukaj Akaszę gdy temat jest wpisywany (po 600ms pauzy)
    useEffect(() => {
        if (topic.length < 5) { setAkashaHint(null); return; }
        const debounce = setTimeout(() => {
            const result = searchAkasha(topic);
            setAkashaHint(result);
        }, 600);
        return () => clearTimeout(debounce);
    }, [topic]);

    const toggleAgent = (id: string) => {
        if (isDebating) return;
        setSelectedAgents(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const startDebate = async () => {
        if (!topic.trim()) {
            toast.error('Podaj temat narady!');
            return;
        }
        if (selectedAgents.length < 2) {
            toast.error('Do debaty potrzeba co najmniej dwóch agentów.');
            return;
        }

        setIsDebating(true);
        setDebateLog([]);
        setAkashaHint(null);
        const activeModel = localStorage.getItem('otakos_active_model') || 'gemma:2b';
        toast.success('Otwieram Kwantowe Sympozjum...');

        // Przygotowanie wiadomości z kontekstem
        let fullContextPrompt = topic; 
        if(contextTokens.length > 0) {
            const contextString = contextTokens.map(t => `[PLIK: ${t.name}]\n${t.content}\n`).join('\n\n');
            fullContextPrompt = `Oto podstawa wiedzy, na której musisz operować:\n\n${contextString}\n\nZadanie główne: ${topic}`;
            
            // Opcjonalnie: Wyczyść żetony po wysłaniu, by nie powielać gigantycznego kontekstu w kolejnych pytaniach
            // setContextTokens([]); 
        }

        let currentHistory = `TEMAT GŁÓWNY: ${fullContextPrompt}\n\n`;
        const newLog: DebateMessage[] = [];

        const ALL_AGENTS = [...AVAILABLE_AGENTS, ...localAgents];

        for (const agentId of selectedAgents) {
            const agent = ALL_AGENTS.find(a => a.id === agentId);
            if (!agent) continue;
            setCurrentSpeakerId(agent.id);

            const promptText = `Jesteś ${agent.name}, Twoja rola w Katedrze to: ${agent.role}. 
Siedzicie przy okrągłym stole. Panuje zasada 0.00G (Równowaga, brak ciśnienia).

Oto przebieg dotychczasowej narady:
${currentHistory}

Twoje zadanie: Dodaj swoją wypowiedź do dyskusji. 
Zareaguj na to co powiedzieli poprzednicy lub (jeśli jesteś pierwszy) zainicjuj temat ze swojej perspektywy. 
Maksymalnie 4 soczyste, charakterystyczne dla Twojej roli zdania. Odpowiedz po polsku w pierwszej osobie.`;

            try {
                const response = await fetch('http://127.0.0.1:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        model: activeModel, 
                        prompt: promptText, 
                        stream: false,
                        // TARCZA SUWERENA: Wymuszamy na Ollamie powiększenie mózgu!
                        options: {
                            num_ctx: 8192 
                        }
                    })
                });

                // TARCZA SUWERENA: Weryfikacja, czy Ollama nie dostała zadyszki
                if (!response.ok) {
                    throw new Error(`Ollama zwróciła błąd ${response.status}. Prawdopodobnie przepełniono okno kontekstu (za dużo danych) lub model jest uszkodzony.`);
                }

                const data = await response.json();
                
                // Zabezpieczenie przed brakiem 'response'
                if (!data || data.response === undefined) {
                    throw new Error("Otrzymano pustą lub nieprawidłową strukturę od modelu.");
                }

                const reply = data.response.trim();

                const message: DebateMessage = {
                    id: `msg-${Date.now()}-${agent.id}`,
                    agentId: agent.id,
                    agentName: agent.name,
                    agentEmoji: agent.emoji,
                    color: agent.color,
                    content: reply
                };

                newLog.push(message);
                setDebateLog([...newLog]);

                currentHistory += `[${agent.name}]: ${reply}\n\n`;

                await new Promise(r => setTimeout(r, 2000));

            } catch (error: any) {
                console.error("Błąd podczas obrad:", error);
                toast.error(error.message || "Wystąpił błąd komunikacji z modelem.", { duration: 5000 });
                setIsDebating(false);
                setCurrentSpeakerId(null);
                break;
            }
        }

        setCurrentSpeakerId(null);
        setIsDebating(false);
        speakNotification("Mistrzu. Agenci zakończyli wymianę myśli. Oczekuję na rozkaz destylacji planu.");
        toast.success('Narada dobiegła końca. Wibracja ustabilizowana.', { icon: '✨' });

        // 💎 ZADANIE 1: Zapisz CAŁĄ debatę do Pamięci Akaszy
        if (newLog.length > 0) {
            const ALL_AGENTS = [...AVAILABLE_AGENTS, ...localAgents];
            const agentNames = selectedAgents
                .map(id => ALL_AGENTS.find(a => a.id === id)?.name || id);
            saveToAkasha(topic, agentNames, newLog);
        }
    };

    const generateActionPlan = async () => {
        setIsSynthesizing(true);
        // Do planów zawsze wybieraj mądrzejszy/szybszy model
        const activeModel = localStorage.getItem('otakos_active_model') || 'mistral:latest';
        const fullDebate = debateLog.map(m => `[${m.agentName}]: ${m.content}`).join('\n');
        
        const promptText = `Przeanalizuj poniższą dyskusję i wyciągnij NAJWAŻNIEJSZE wnioski operacyjne.
${fullDebate}

Temat przewodni: ${topic}

Twoim zadaniem jest wygenerowanie planu działania TYLKO i WYŁĄCZNIE jako obiekt JSON. NIE PISZ ŻADNEGO INNEGO TEKSTU. Struktura JSON musi wyglądać dokładnie tak:
{
  "memorySummary": "Krótkie podsumowanie ustaleń z debaty (maks 2 zdania).",
  "tasks": [
    {
      "title": "Krótki tytuł zadania",
      "command": "Konkretna, techniczna komenda dla Terminala, która to zadanie zrealizuje (np. ścieżka do pliku, zapytanie wyszukiwania, lub instrukcja stworzenia modułu)."
    }
  ]
}
Wygeneruj od 1 do 3 zadań.`;

        try {
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    model: activeModel, 
                    prompt: promptText, 
                    stream: false, 
                    format: 'json',
                    // TARCZA SUWERENA: Horyzont zdarzeń rozszerzony dla syntezy planu
                    options: {
                        num_ctx: 8192
                    }
                }) // Wymuszenie JSONa
            });
            const data = await response.json();
            
            // Solidna ekstrakcja JSON (nawet jak model trochę pogada)
            let jsonString = data.response;
            const match = jsonString.match(/\{[\s\S]*\}/);
            if (match) {
                jsonString = match[0];
            }
            
            const plan = JSON.parse(jsonString);
            
            if (plan.memorySummary) {
                const currentMemory = JSON.parse(localStorage.getItem('otakos_akasha') || '[]');
                const newCrystal: AkashaCrystal = {
                    id: `CRYSTAL-${Date.now()}`, topic: topic,
                    agents: ['Ollama-Synthesizer'],
                    date: new Date().toLocaleString(),
                    memorySummary: plan.memorySummary, 
                    fullTranscript: fullDebate
                };
                localStorage.setItem('otakos_akasha', JSON.stringify([newCrystal, ...currentMemory]));
                toast.success("Logika zapisana w Pamięci Akaszy!");
            }
            setFinalPlan(plan);
            speakNotification("Mistrzu. Rada Siedmiu zakończyła obrady. Zdestylowany plan jest gotowy do wdrożenia.");
        } catch (error: any) { 
            console.error("Błąd podczas syntezy planu:", error);
            toast.error(error.message || "Model wygenerował błędny format planu lub wystąpiła awaria łącza.", { duration: 5000 }); 
        } finally { 
            setIsDebating(false);
            setCurrentSpeakerId(null);
            setIsSynthesizing(false); 
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto bg-[#050510] border border-fuchsia-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.1)] font-mono text-slate-300 flex flex-col h-[85vh]">

            {/* --- HEADER --- */}
            <div className="bg-[#020205] border-b border-fuchsia-500/30 p-5 flex justify-between items-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.2)_0%,transparent_70%)] pointer-events-none"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-black border border-fuchsia-500/50 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.3)]">
                        <Users size={24} className="text-fuchsia-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-500">SYMPOZJUM ŚWIADOMOŚCI</h2>
                        <p className="text-xs text-slate-500 tracking-widest">Kwantowy Stół Narad • Konsylium Multi-Agentowe • Pamięć Akaszy v2.0</p>
                    </div>
                </div>
                {/* Akasza status indicator / Skarbiec Toggle */}
                <button 
                    onClick={() => setShowCrystals(!showCrystals)}
                    className="relative z-10 px-3 py-1.5 bg-black/50 border border-slate-700 hover:border-fuchsia-500 rounded-xl text-[10px] text-slate-400 hover:text-fuchsia-300 transition-colors flex items-center gap-2"
                >
                    💎 {crystalArchive.length} KRYSZTAŁÓW
                </button>
            </div>

            {/* --- KOKPIT STEROWANIA --- */}
            <div className="p-5 border-b border-slate-800 bg-[#080812] shrink-0">
                <div className="mb-3">
                    <label className="text-[10px] text-fuchsia-500 font-bold tracking-widest uppercase mb-2 flex items-center gap-2">
                        <SquareSquare size={12} /> Cel Narady (Intencja Suwerena)
                    </label>

                    {/* PULA ŻETONÓW KONTEKSTOWYCH */}
                    {contextTokens.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-900/40 rounded-xl border border-slate-700/50">
                            <span className="text-xs text-slate-500 flex items-center gap-1"><Layers size={14}/> Kontekst Narady:</span>
                            {contextTokens.map((token, idx) => (
                                <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-fuchsia-900/40 border border-fuchsia-500/30 rounded-md text-[10px] text-fuchsia-200">
                                    <FileText size={12}/> {token.name}
                                    {/* Przycisk do usunięcia żetonu, jeśli Suweren zmieni zdanie */}
                                    <button onClick={() => setContextTokens(prev => prev.filter((_, i) => i !== idx))} className="ml-1 hover:text-red-400">
                                        <X size={12}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-3 relative">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => { setTopic(e.target.value); localStorage.setItem('otakos_current_topic', e.target.value); }}
                                disabled={isDebating}
                                placeholder="np. Analiza potencjału stworzenia nowej gry karcianej opartej na astronomii..."
                                className="w-full bg-black/50 border border-slate-700 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:border-fuchsia-500 outline-none transition-colors disabled:opacity-50"
                            />
                            {topic && !isDebating && (
                                <button 
                                    onClick={clearTopic}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-red-900/40 hover:bg-red-800/80 text-red-300 border border-red-500/50 rounded-lg transition-all"
                                    title="Wyczyść temat"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={startDebate}
                            disabled={isDebating || !topic.trim()}
                            className={`px-8 rounded-xl font-bold tracking-widest transition-all flex items-center gap-2 ${isDebating
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(192,38,211,0.4)]'
                                }`}
                        >
                            {isDebating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}><BrainCircuit size={18} /></motion.div> : <Play size={18} />}
                            {isDebating ? 'TRWA DEBATA...' : 'ZWOŁAJ RADĘ'}
                        </button>
                    </div>
                </div>

                {/* 🧠 Podpowiedź z Akaszy */}
                <AnimatePresence>
                    {akashaHint && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-3 p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl text-[11px]"
                        >
                            <div className="flex items-center gap-2 text-purple-400 font-bold mb-2">
                                <BookOpen size={11} /> AKASZA PAMIĘTA — znaleziono podobną debatę:
                            </div>
                            <p className="text-slate-400 mb-2 italic">{akashaHint.summary}</p>
                            <div className="flex flex-col gap-1">
                                {akashaHint.fragments.map((f, i) => (
                                    <div key={i} className="text-purple-300/70 pl-2 border-l border-purple-500/40 truncate">{f}</div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* SEKCJA WYBORU AGENTÓW (Zoptymalizowana) */}
                <div className="flex flex-col gap-3">
                    <label className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1 block">Obecni przy stole (Wybierz min. 2):</label>
                    
                    {/* Górny rząd: Główni Agenci + Przycisk Kuźni */}
                    <div className="flex flex-wrap gap-2">
                        {AVAILABLE_AGENTS.map(agent => {
                            const isSelected = selectedAgents.includes(agent.id);
                            return (
                                <button
                                    key={agent.id}
                                    onClick={() => toggleAgent(agent.id)}
                                    disabled={isDebating}
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-2 ${isSelected
                                            ? 'bg-slate-900 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                                            : 'bg-black border-slate-800 text-slate-500 hover:border-slate-500'
                                        }`}
                                    style={{
                                        borderColor: isSelected ? agent.color : undefined,
                                        color: isSelected ? agent.color : undefined,
                                        backgroundColor: isSelected ? `${agent.color}20` : undefined
                                    }}
                                >
                                    <span className="text-sm">{agent.emoji}</span>
                                    {agent.name}
                                </button>
                            );
                        })}

                        {/* Przełącznik Lokalnych Rdzeni */}
                        {localAgents.length > 0 && (
                            <button 
                                onClick={() => setShowLocalForge(!showLocalForge)}
                                disabled={isDebating}
                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-2 ${
                                    showLocalForge || localAgents.some(a => selectedAgents.includes(a.id))
                                    ? 'bg-amber-900/30 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                                    : 'bg-black border-slate-800 text-slate-500 hover:border-amber-500/50 hover:text-amber-500'
                                }`}
                            >
                                <Plus size={14} className={showLocalForge ? "rotate-45 transition-transform" : "transition-transform"} /> 
                                LOKALNA KUŹNIA ({localAgents.length})
                            </button>
                        )}
                    </div>

                    {/* Rozsuwany Panel: Wykuci Agenci i Lokalne Modele */}
                    <AnimatePresence>
                        {showLocalForge && localAgents.length > 0 && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }} 
                                animate={{ height: 'auto', opacity: 1 }} 
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-3 bg-black/40 border border-amber-500/20 rounded-xl flex flex-wrap gap-2">
                                    {localAgents.map(agent => {
                                        const isSelected = selectedAgents.includes(agent.id);
                                        return (
                                            <button 
                                                key={agent.id} 
                                                onClick={() => toggleAgent(agent.id)}
                                                disabled={isDebating}
                                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                                                    isSelected 
                                                        ? 'bg-amber-900/30 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                                                        : 'bg-black border-slate-800 text-slate-500 hover:border-amber-500/50'
                                                }`}
                                            >
                                                <span>{agent.emoji}</span> {agent.name.replace('[Lokalny] ', '')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* --- PRZESTRZEŃ DEBATY --- */}
            <div
                ref={scrollRef}
                className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[radial-gradient(ellipse_at_top,rgba(217,70,239,0.05),transparent_60%)] flex flex-col gap-6"
            >
                {debateLog.length === 0 && !isDebating ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <Users size={64} className="mb-4" />
                        <p className="text-sm">Stół jest pusty. Wprowadź intencję i zwołaj Radę.</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {debateLog.map((msg, idx) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex gap-4"
                            >
                                <div className="shrink-0 flex flex-col items-center">
                                    <div
                                        className="w-12 h-12 rounded-full border-2 bg-slate-950 flex items-center justify-center text-2xl shadow-[0_0_15px_currentColor]"
                                        style={{ borderColor: msg.color, color: msg.color }}
                                    >
                                        {msg.agentEmoji}
                                    </div>
                                    {idx !== debateLog.length - 1 && (
                                        <div className="w-0.5 h-full bg-slate-800 mt-2" />
                                    )}
                                </div>
                                <div className="flex-1 pt-1 pb-6">
                                    <h4 className="text-xs font-bold tracking-widest mb-2" style={{ color: msg.color }}>
                                        {msg.agentName}
                                    </h4>
                                    <div className="bg-black/60 border border-slate-800 rounded-2xl rounded-tl-none p-5 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap shadow-inner relative group">
                                        {msg.content}
                                        
                                        {/* PANEL KONTROLNY WIADOMOŚCI AGENTA */}
                                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-end gap-2">
                                            
                                            {/* Przycisk 1: Zrobotyzowane Ramię (Pojawia się TYLKO gdy jest kod) */}
                                            {msg.content.includes('```') && (
                                                <button 
                                                    onClick={() => sendCodeToTerminal(msg.content)}
                                                    className="px-3 py-1.5 bg-fuchsia-900/40 hover:bg-fuchsia-800/80 border border-fuchsia-500/50 text-[10px] font-bold rounded-lg text-fuchsia-300 transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(217,70,239,0.2)]"
                                                    title="Wessij ten kod bezpośrednio do modułu WRITE w Terminalu"
                                                >
                                                    <Zap size={14} /> WESSIJ KOD DO TERMINALA
                                                </button>
                                            )}

                                            {/* Przycisk 2: Delegacja do Tła (Pojawia się ZAWSZE przy wiadomości Agenta) */}
                                            <button 
                                                onClick={() => delegateToBackgroundAgent(msg.content)}
                                                className="px-3 py-1.5 bg-amber-900/40 hover:bg-amber-800/80 border border-amber-500/50 text-[10px] font-bold rounded-lg text-amber-300 transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                title="Wyślij to zadanie do powłoki CMD w Terminalu"
                                            >
                                                <Bot size={14} /> ZLEĆ DO AGENTA W TLE
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}

                {/* Indykator "Myślenia" aktualnego Agenta */}
                {isDebating && currentSpeakerId && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex gap-4 items-center"
                    >
                        <div
                            className="w-12 h-12 rounded-full border-2 border-slate-700 bg-slate-950 flex items-center justify-center text-2xl relative overflow-hidden"
                        >
                            {AVAILABLE_AGENTS.find(a => a.id === currentSpeakerId)?.emoji}
                            <motion.div
                                className="absolute inset-0 bg-white/10"
                                animate={{ y: ['100%', '-100%'] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                            />
                        </div>
                        <div className="text-xs text-slate-500 italic flex items-center gap-2">
                            <BrainCircuit size={14} className="animate-pulse" />
                            {AVAILABLE_AGENTS.find(a => a.id === currentSpeakerId)?.name} przetwarza matrycę (Lokalny LLM)...
                        </div>
                    </motion.div>
                )}
                
                {/* Wygeneruj zadania z debaty */}
                {!isDebating && debateLog.length > 0 && !finalPlan && (
                    <div className="flex justify-center mt-4">
                        <button 
                            onClick={generateActionPlan}
                            disabled={isSynthesizing}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                        >
                            {isSynthesizing ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                            {isSynthesizing ? 'TWORZENIE PLANU OPERACYJNEGO...' : 'WYGENERUJ PLAN DZIAŁANIA'}
                        </button>
                    </div>
                )}

                {finalPlan && (
                    <div className="bg-[#05100a] p-4 rounded-xl border border-emerald-500/30 mt-4">
                        <h4 className="text-emerald-400 font-bold text-xs mb-2">WYGENEROWANO ZADANIA OPERACYJNE:</h4>
                        <div className="flex flex-col gap-2 mb-4">
                            {finalPlan.tasks && finalPlan.tasks.map((task: any, idx: number) => (
                                <div key={idx} className="bg-black/50 p-2 rounded border border-emerald-900 text-[10px] text-emerald-200">
                                    <strong>{task.title}</strong>: {task.command.substring(0, 80)}...
                                </div>
                            ))}
                        </div>
                        
                        <button 
                            onClick={() => {
                                // Zapisujemy zadania do odebrania przez TerminalZero
                                const existingTasks = JSON.parse(localStorage.getItem('otakos_terminal_tasks') || '[]');
                                const newTasks = finalPlan.tasks || [];
                                localStorage.setItem('otakos_terminal_tasks', JSON.stringify([...newTasks, ...existingTasks]));
                                
                                // Wymuszamy odświeżenie w terminalu
                                window.dispatchEvent(new Event('otakos_new_terminal_task'));
                                toast.success("Zadania przetransferowane do Terminala 0.00G!", { icon: '🚀' });
                                setFinalPlan(null);
                            }} 
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-black py-2 rounded font-bold transition-colors"
                        >
                            🚀 PRZEKAŻ ZADANIA DO TERMINALA 0.00G
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.3); border-radius: 10px; }
            `}</style>

            {/* 💎 SKARBIEC KRYSZTAŁÓW (Wysuwany Panel) */}
            <AnimatePresence>
                {showCrystals && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute inset-0 bg-[#020205]/95 backdrop-blur-md z-50 flex flex-col p-6 rounded-3xl border border-fuchsia-500/30"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-fuchsia-400 font-bold tracking-widest text-lg flex items-center gap-2">
                                💎 SKARBIEC KRYSZTAŁÓW (HISTORIA NARAD)
                            </h2>
                            <button onClick={() => setShowCrystals(false)} className="p-2 bg-red-900/40 hover:bg-red-800/80 text-red-300 rounded-lg border border-red-500/50 transition-colors">
                                ZAMKNIJ SKARBIEC
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                            {/* WYSZUKIWARKA PLIKÓW (AKASZA) */}
                            <div className="sticky top-0 z-10 bg-[#020205]/95 pb-4">
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="🔍 PRZESZUKAJ AKASZĘ... (Temat, treść, data)"
                                    className="w-full bg-black/80 border border-fuchsia-500/30 rounded-xl px-4 py-3 text-xs text-fuchsia-100 outline-none focus:border-fuchsia-500 transition-all font-bold tracking-widest uppercase"
                                />
                            </div>

                            {(() => {
                                // TARCZA SUWERENA: Bezpieczne filtrowanie akashaFiles (Kryształów)
                                const akashaFiles = crystalArchive;
                                const searchLower = searchTerm.toLowerCase();
                                
                                const filteredFiles = akashaFiles.filter(item => {
                                    const safeName = (item.topic || (item as any).topicKeywords || "").toLowerCase();
                                    const safeContent = (item.logs ? item.logs.map((l: any) => l.content).join(' ') : (item as any).fullTranscript || "").toLowerCase();
                                    
                                    return safeName.includes(searchLower) || safeContent.includes(searchLower);
                                });

                                return filteredFiles.length === 0 ? (
                                    <div className="text-slate-500 text-center mt-10">Archiwum nie odnalazło dopasowania dla: "{searchTerm}"</div>
                                ) : (
                                    filteredFiles.map((crystal: any, idx: number) => (
                                        <div key={idx} className="bg-black/60 border border-slate-700/50 rounded-xl p-4 hover:border-fuchsia-500/30 transition-all group relative overflow-hidden">
                                            <div className="text-[10px] text-fuchsia-500 font-bold mb-2 flex justify-between">
                                                <span>🔮 Temat: {crystal.topic}</span>
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handleAbsorbKnowledge(crystal.topic, crystal.fullTranscript || "")}
                                                        className="px-2 py-1 bg-fuchsia-900/50 hover:bg-fuchsia-600 border border-fuchsia-500/50 rounded text-fuchsia-100 transition-all"
                                                        title="Dodaj ten kryształ jako żeton kontekstowy"
                                                    >
                                                        WESSIJ WIEDZĘ
                                                    </button>
                                                    <span className="text-slate-500 font-normal">{crystal.date}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-3 mt-4">
                                                {crystal.logs && crystal.logs.map((log: any, lIdx: number) => (
                                                    <div key={lIdx} className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-[#050a15] p-3 rounded-lg border border-slate-800/50">
                                                        <span className="text-cyan-500 font-bold">{log.agentName}:</span> {log.content}
                                                    </div>
                                                ))}
                                                {crystal.fullTranscript && (
                                                     <div className="text-xs text-slate-400 font-mono italic whitespace-pre-wrap bg-[#05060f] p-3 rounded-lg border border-slate-900 border-dashed">
                                                        {crystal.fullTranscript.substring(0, 500)}...
                                                     </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                );
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default KwantowyStolNarad;