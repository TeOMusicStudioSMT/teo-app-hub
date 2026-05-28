/**
 * ⚡ TerminalZero.tsx - Centrum Dowodzenia "Superpowers" 0.00G
 * * NAPRAWIONO: Wykonywanie zadań Rady (Gubienie poleceń i wyników).
 * * ZINTEGROWANO: Niezależne, elastyczne panele boczne (Lewy i Prawy).
 * * AKTYWOWANO: Rzeczywiste, bieżące Logi Systemowe.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Send, BrainCircuit, RefreshCw, DownloadCloud, Database, Cpu, Server, Zap, ChevronLeft, ChevronRight, Activity, Pickaxe, Wrench, FolderPlus, FileText, Cloud, Layers, Search, Youtube, PanelLeftClose, PanelRightClose, PanelLeft, PanelRight, X, Bot } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useOtakOSBus, BUS } from '../../lib/otakosBus';

interface Message { id: string; role: 'user' | 'ai' | 'system' | 'wiesio'; content: string; timestamp: string; }
type ComputePower = 'LOCAL' | 'CLOUD_MAGISTRALA';

export const TerminalZero: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const savedLogs = localStorage.getItem('otakos_terminal_logs');
            return savedLogs ? JSON.parse(savedLogs) : [];
        } catch { return []; }
    });
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const logsRef = useRef<HTMLDivElement>(null);

    const [activeModel, setActiveModel] = useState<string>('');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [modelToPull, setModelToPull] = useState('');
    const [isPulling, setIsPulling] = useState(false);
    
    // UI Layout States (Naprawione, niezależne ukrywanie)
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    
    const [activeSkill, setActiveSkill] = useState('AUTO'); 
    const [computePower, setComputePower] = useState<ComputePower>('LOCAL');
    const [councilTasks, setCouncilTasks] = useState<any[]>([]);

    const [systemPrompt, setSystemPrompt] = useState('Jesteś Agentem Katedry 0.00G.');
    const [isForging, setIsForging] = useState(false);
    
    // Cel 1: Sandbox Context (Project Structure)
    const [isSandboxContextActive, setIsSandboxContextActive] = useState(false);
    const [projectStructure, setProjectStructure] = useState<string | null>(null);
    const [baseModelForForge, setBaseModelForForge] = useState<string>('');
    const [newModelName, setNewModelName] = useState<string>('');
    
    // Cel 2: File Context
    const [attachedFiles, setAttachedFiles] = useState<{ path: string; content: string }[]>([]);
    const [filePathToAttach, setFilePathToAttach] = useState('');

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isThinking]);
    useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, [messages]);

    // 🚌 Bus: odbieraj taski z innych modułów
    useOtakOSBus(ev => {
        if (ev.type === BUS.TERMINAL_RUN && ev.from !== 'terminal') {
            const cmd = ev.payload.command as string;
            const skill = (ev.payload.skill as string) || 'AUTO';
            if (cmd) {
                setActiveSkill(skill as any);
                setInput(cmd);
                addSystemMessage(`🚌 Bus → Task z [${ev.from}]: "${cmd.substring(0, 60)}..."`, 'wiesio');
                toast(`🚌 Task z Autobusu: ${ev.from}`, { icon: '⚡' });
            }
        }
    });

    useEffect(() => {
        localStorage.setItem('otakos_terminal_logs', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        const savedModel = localStorage.getItem('otakos_active_model');
        if (savedModel) setActiveModel(savedModel);
        fetchModels();
        const loadTasks = () => {
            try {
                setCouncilTasks(JSON.parse(localStorage.getItem('otakos_terminal_tasks') || '[]'));
            } catch {
                setCouncilTasks([]);
            }
        };
        loadTasks();
        window.addEventListener('otakos_new_terminal_task', loadTasks);

        const checkIncomingCode = () => {
            const incomingData = localStorage.getItem('otakos_terminal_auto_path');
            if (incomingData) {
                // Jeśli paczka zaczyna się od prefixu [CMD], to jest to komenda do tła
                if (incomingData.startsWith('[CMD]')) {
                    // TARCZA SUWERENA: Upewnij się, że używasz DOKŁADNIE takiego ID, 
                    // jakie ma przycisk ">_ SYSTEM CMD" w Twoim stanie (zazwyczaj 'SYSTEM_CMD').
                    setActiveSkill('SYSTEM_CMD'); 
                    setInput(incomingData.replace('[CMD]', '').trim());
                } else {
                    // W przeciwnym razie to stary, dobry kod do zapisu
                    setActiveSkill('WRITE');
                    setInput(incomingData);
                }
                localStorage.removeItem('otakos_terminal_auto_path');
            }
        };
        window.addEventListener('otakos_switch_to_terminal', checkIncomingCode);

        return () => {
            window.removeEventListener('otakos_new_terminal_task', loadTasks);
            window.removeEventListener('otakos_switch_to_terminal', checkIncomingCode);
        };
    }, []);

    const fetchModels = async () => {
        addSystemMessage("📡 Nawiązywanie połączenia z lokalnym rdzeniem Ollamy...", 'system');
        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            if (res.ok) {
                const data = await res.json();
                const modelNames = data.models.map((m: any) => m.name);
                setAvailableModels(modelNames);
                if(modelNames.length > 0) {
                    if (!activeModel) {
                        setActiveModel(modelNames[0]);
                        localStorage.setItem('otakos_active_model', modelNames[0]);
                    }
                    setBaseModelForForge(modelNames[0]);
                }
                addSystemMessage("✅ Połączenie nawiązane. Rdzenie gotowe do pracy.", 'system');
            }
        } catch (e) { 
            addSystemMessage("⚠️ Brak łączności z Ollamą. Odpal 'ollama serve' w konsoli.", 'wiesio'); 
        }
    };

    const addSystemMessage = (text: string, type: 'system' | 'wiesio' = 'system') => {
        setMessages(prev => [...prev, { id: `${type}-${Date.now()}-${Math.random()}`, role: type, content: text, timestamp: new Date().toLocaleTimeString() }]);
    };

    // 🚀 Ekstraktor Kodu z wiadomości AI (Zrobotyzowane Ramię)
    const extractCodeToWrite = (content: string) => {
        // Szukamy tekstu między potrójnymi grawisami (```), ignorując opcjonalną nazwę języka (np. ```tsx)
        const match = content.match(/```(?:[a-z]*\n)?([\s\S]*?)```/);
        if (match && match[1]) {
            setActiveSkill('WRITE');
            // Przygotowujemy input, Suweren musi tylko podać/zmienić ścieżkę
            setInput(`F:\\Katedra\\src\\components\\... | ${match[1].trim()}`);
            toast.success("Kod wyekstrahowany! Podaj ścieżkę docelową i wciśnij Enter.", { icon: '🚀' });
        } else {
            toast.error("Wizjer nie odnalazł czystego bloku kodu (znaczników ```).");
        }
    };

    // 🚀 NAPRAWIONA FUNKCJA SEND MESSAGE (Odporna na gubienie zadań)
    const sendMessage = async (overridePrompt?: string, overrideSkill?: string) => {
        // Jeśli funkcja jest wywołana przez przycisk Rady, używa 'AUTO', chyba że wymuszono inaczej
        const usedSkill = overrideSkill || activeSkill; 
        const textToSend = overridePrompt || input;
        
        if (!textToSend.trim() || isThinking) return;

        const powerTag = computePower === 'LOCAL' ? '[LOKAL]' : '[CHMURA]';
        const finalPrompt = `[Skill: ${usedSkill}] ${powerTag} ${textToSend}`;

        setMessages(prev => [...prev, { id: `usr-${Date.now()}`, role: 'user', content: finalPrompt, timestamp: new Date().toLocaleTimeString() }]);
        if (!overridePrompt) setInput('');
        setIsThinking(true);

        const currentModel = localStorage.getItem('otakos_active_model') || 'llama3';

        let contextualizedPrompt = textToSend;
        let hardContext = "";

        // Cel 1: Sandbox Context (Project Structure)
        if (isSandboxContextActive && (usedSkill === 'AUTO' || usedSkill === 'CODE' || usedSkill === 'SYSTEM_CMD')) {
            addSystemMessage("📁 Skanowanie struktury projektu...", 'system');
            try {
                const resStruct = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'read_project_structure' })
                });
                const dataStruct = await resStruct.json();
                if (dataStruct.success) {
                    const structureStr = JSON.stringify(dataStruct.structure, null, 2);
                    hardContext += `[STRUKTURA PROJEKTU TEOGENESIS]:\n${structureStr}\n\n`;
                    addSystemMessage("✅ Mapa projektu dodana do kontekstu.", 'system');
                }
            } catch (e) {
                addSystemMessage("⚠️ Błąd pobierania mapy projektu.", 'wiesio');
            }
        }

        // Cel 2: Attached Files Context
        if (attachedFiles.length > 0) {
            hardContext += `[ZAŁĄCZONE PLIKI (KONTEKST KODU)]:\n`;
            attachedFiles.forEach(file => {
                hardContext += `--- FILE: ${file.path} ---\n${file.content}\n\n`;
            });
            addSystemMessage(`🔗 Wstrzyknięto ${attachedFiles.length} plików do pamięci rdzenia.`, 'system');
        }

        if (hardContext) {
            contextualizedPrompt = `${hardContext}[POLECENIE SUWERENA]:\n${textToSend}`;
        }

        try {
            let responseData;
            addSystemMessage(`🚀 Inicjacja procesu: [${usedSkill}] na rdzeniu ${currentModel}...`, 'system');

            switch (usedSkill) {
                case 'AUTO':
                case 'CODE':
                    const resAuto = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'OLLAMA_CHAT', prompt: contextualizedPrompt, model: currentModel, timeout: 600000 })
                    });
                    responseData = await resAuto.json();
                    if (responseData.success) {
                        const content = responseData.response || "(Otrzymano pustą odpowiedź od LLM)";
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content, timestamp: new Date().toLocaleTimeString() }]);
                        addSystemMessage("✅ Zadanie analityczne zakończone sukcesem.", 'system');
                        // 🚌 Emituj wynik na Bus
                        import('../../lib/otakosBus').then(({ OtakOSBus }) =>
                            OtakOSBus.emit('terminal', BUS.TERMINAL_RESULT, { content, model: currentModel })
                        );
                    } else addSystemMessage(`❌ Błąd rdzenia LLM: ${responseData.error}`, 'wiesio');
                    break;

                case 'FILE':
                    const resFile = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'READ_FILE_CONTENT', path: textToSend.trim() })
                    });
                    responseData = await resFile.json();
                    if (responseData.success) {
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: `[SUROWY ODCZYT PLIKU]:\n\n${responseData.content}`, timestamp: new Date().toLocaleTimeString() }]);
                        addSystemMessage("✅ Odczyt pliku udany.", 'wiesio');
                    } else addSystemMessage(`❌ Błąd odczytu pliku: ${responseData.error}`, 'wiesio');
                    break;

                case 'DIR':
                    const resDir = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'CREATE_DIRECTORY', path: textToSend.trim() })
                    });
                    responseData = await resDir.json();
                    if (responseData.success) {
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: `[WIESIO POTWIERDZA]: ${responseData.message}`, timestamp: new Date().toLocaleTimeString() }]);
                        addSystemMessage("✅ Struktura katalogów utworzona.", 'wiesio');
                    } else addSystemMessage(`❌ Błąd budowy folderów: ${responseData.error}`, 'wiesio');
                    break;
                    
                case 'YOUTUBE':
                    const resYt = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'FETCH_URL_CONTENT', url: textToSend.trim() })
                    });
                    responseData = await resYt.json();
                    if (responseData.success) {
                         setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: `[DANE ZASSANE Z SIECI]:\n\n${responseData.text.substring(0, 1500)}...\n\n(Całość przeładowana do pamięci podręcznej Katedry).`, timestamp: new Date().toLocaleTimeString() }]);
                         addSystemMessage("✅ Zassano wiedzę do pamięci Katedry.", 'wiesio');
                    } else addSystemMessage(`❌ Błąd łącza sieciowego: ${responseData.error}`, 'wiesio');
                    break;

                case 'SEARCH':
                    const resSearch = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'WEB_SEARCH', query: textToSend.trim() })
                    });
                    responseData = await resSearch.json();
                    if (responseData.success) {
                         setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: responseData.content, timestamp: new Date().toLocaleTimeString() }]);
                         addSystemMessage("✅ Wyszukiwanie ukończone.", 'wiesio');
                    } else addSystemMessage(`❌ Błąd wyszukiwarki: ${responseData.error}`, 'wiesio');
                    break;
                    
                case 'WRITE':
                    const parts = textToSend.split('|');
                    if (parts.length < 2) {
                        addSystemMessage('❌ Błąd składni. Dla skilla ZAPISZ PLIK użyj formatu: Ścieżka_do_pliku | Treść_do_zapisu', 'system');
                        setIsThinking(false); return;
                    }
                    const targetPath = parts[0].trim();
                    const contentToWrite = parts.slice(1).join('|').trim();
                    
                    const resWrite = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'WRITE_FILE_CONTENT', path: targetPath, content: contentToWrite })
                    });
                    responseData = await resWrite.json();
                    if (responseData.success) {
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: `[POTWIERDZENIE ZAPISU]:\n${responseData.message}`, timestamp: new Date().toLocaleTimeString() }]);
                        addSystemMessage(`✅ Zapisano plik: ${targetPath}`, 'wiesio');
                    } else addSystemMessage(`❌ Błąd zapisu: ${responseData.error}`, 'wiesio');
                    break;

                case 'SYSTEM_CMD':
                    addSystemMessage(`⚡ Zlecenie dla Wiesia: Delegacja zadania do rdzenia (${currentModel})...`, 'wiesio');
                    const resCmd = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            action: 'OLLAMA_BUILD', 
                            model: currentModel, 
                            prompt: contextualizedPrompt,
                            timeout: 600000
                        })
                    });
                    const dataCmd = await resCmd.json();
                    
                    if (resCmd.ok && dataCmd.success) {
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, role: 'ai', content: `[WYNIK DELEGACJI]:\n${dataCmd.message}\nPodgląd odpowiedzi:\n${dataCmd.rawResponse.substring(0, 500)}...`, timestamp: new Date().toLocaleTimeString() }]);
                    } else {
                        addSystemMessage(`❌ Błąd systemu: ${dataCmd.message || dataCmd.error || 'Nieznany błąd skryptu'}`, 'wiesio');
                    }
                    break;

                default:
                    addSystemMessage("❌ BŁĄD KRYTYCZNY: Nieznany lub uszkodzony skill.", 'system');
            }
        } catch (err) { 
            addSystemMessage(`❌ AWARIA GŁÓWNEJ RURY DO WIESIA (Port 3001). Sprawdź konsolę CMD.`, 'wiesio'); 
        } finally { 
            setIsThinking(false); 
        }
    };

    // 🚀 NAPRAWIONE WYKONYWANIE ZADAŃ Z RADY
    const executeCouncilTask = (task: any, index: number) => {
        if(isThinking) {
            toast.error("Rdzeń jest zajęty, poczekaj na zakończenie poprzedniej operacji!");
            return;
        }
        addSystemMessage(`Dekret Rady: Uruchamiam zautomatyzowane zadanie: "${task.title}"`, 'system');
        // Wysyłamy komendę i na twardo ustawiamy skill 'AUTO' dla zadań od LLM-ów
        sendMessage(task.command, 'AUTO');
        
        // Zdejmujemy zadanie z paska po wysłaniu
        const updatedTasks = councilTasks.filter((_, i) => i !== index);
        setCouncilTasks(updatedTasks);
        localStorage.setItem('otakos_terminal_tasks', JSON.stringify(updatedTasks));
    };

    // 🧹 Usuwanie pojedynczego dekretu (bez wykonania)
    const dismissCouncilTask = (index: number) => {
        const updatedTasks = councilTasks.filter((_, i) => i !== index);
        setCouncilTasks(updatedTasks);
        localStorage.setItem('otakos_terminal_tasks', JSON.stringify(updatedTasks));
    };

    // 🧹 Usuwanie wszystkich dekretów naraz
    const clearAllTasks = () => {
        setCouncilTasks([]);
        localStorage.removeItem('otakos_terminal_tasks');
        toast.success("Oczyszczono listę Dekretów Rady.");
    };

    // 📄 FILE CONTEXT LOADER (Cel 2)
    const loadFileToContext = async () => {
        if (!filePathToAttach.trim()) return;
        addSystemMessage(`📄 Inicjacja odczytu do pamięci: ${filePathToAttach}`, 'system');
        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'READ_FILE_CONTENT', path: filePathToAttach.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setAttachedFiles(prev => [...prev, { path: filePathToAttach.trim(), content: data.content }]);
                addSystemMessage(`✅ Plik ${filePathToAttach} został zmergowany z pamięcią roboczą.`, 'wiesio');
                setFilePathToAttach('');
                toast.success("Plik w pamięci!");
            } else {
                addSystemMessage(`❌ Błąd odczytu: ${data.error}`, 'wiesio');
            }
        } catch (e) {
            addSystemMessage("❌ Błąd połączenia z Wiesiem przy zaczytywaniu pliku.", 'wiesio');
        }
    };

    // ⬇️ PULL
    const pullModel = async () => {
        if (!modelToPull.trim()) return;
        setIsPulling(true);
        addSystemMessage(`⬇️ Zlecono instalację rdzenia: ${modelToPull}. Wiesio inicjuje proces pobierania w tle.`, 'wiesio');
        try {
            await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'PULL_MODEL', modelName: modelToPull.trim() })
            });
            toast.success("Pobieranie rozpoczęte (w tle). Odśwież za chwilę listę.");
            setModelToPull('');
        } catch (err) { addSystemMessage("❌ Błąd polecenia pobierania.", 'wiesio'); } 
        finally { setIsPulling(false); }
    };

    // 🔨 KUŹNIA
    const forgeModel = async () => {
        if (!newModelName.trim() || !baseModelForForge || !systemPrompt.trim()) return toast.error("Uzupełnij parametry Kuźni!");
        setIsForging(true);
        const safeName = newModelName.trim().replace(/\s+/g, '_').toLowerCase();
        addSystemMessage(`🔨 Kucie modelu (Modelfile): ${safeName} na bazie ${baseModelForForge}. Cierpliwości, rdzeń się kompresuje.`, 'wiesio');

        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CREATE_CUSTOM_MODEL', baseModel: baseModelForForge, newModelName: safeName, systemPrompt })
            });
            const data = await res.json();
            if (data.success) { toast.success("Zlecono kucie!"); setNewModelName(''); } 
            else { addSystemMessage(`❌ Błąd Kuźni: ${data.error}`, 'wiesio'); }
        } catch (err) { addSystemMessage("❌ Zerwano połączenie z Kuźnią Wiesia.", 'wiesio'); } finally { setIsForging(false); }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#050510] text-slate-300 font-mono overflow-hidden rounded-3xl border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
            
            {/* GÓRNA BELKA NAWIGACYJNA - DODANO PRZYCISKI DO PANELÓW */}
            <div className="bg-[#020205] border-b border-cyan-500/30 p-3 flex flex-wrap gap-3 justify-between items-center shrink-0 z-10 min-h-[60px]">
                <div className="flex items-center gap-2">
                    {/* Przełącznik Lewego Panelu */}
                    <button onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} className={`p-1.5 rounded-lg transition-colors border ${isLeftPanelOpen ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400' : 'bg-black border-slate-700 text-slate-500 hover:text-cyan-400'}`} title="Panel Menedżera Modeli">
                        {isLeftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                    </button>
                    
                    <Terminal className="text-cyan-400 ml-2" size={20} />
                    <span className="text-cyan-400 font-bold tracking-widest text-sm hidden sm:block uppercase">Terminal 0.00G <span className="text-[10px] text-amber-500">(Superpowers)</span></span>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
                    
                    {/* Źródło Mocy */}
                    <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-slate-700 hidden sm:flex">
                        <button onClick={() => setComputePower('LOCAL')} className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all ${computePower === 'LOCAL' ? 'bg-emerald-900/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-slate-500 hover:text-slate-400'}`}>
                            <Cpu size={12} /> LOKAL
                        </button>
                        <button onClick={() => setComputePower('CLOUD_MAGISTRALA')} className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all ${computePower === 'CLOUD_MAGISTRALA' ? 'bg-fuchsia-900/50 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.3)]' : 'text-slate-500 hover:text-slate-400'}`}>
                            <Cloud size={12} /> MAGISTRALA
                        </button>
                    </div>

                    {/* KOPALNIA GRV */}
                    <button onClick={() => toast("Kopalnia GRV to projekt długofalowy. Katedra przygotowuje protokoły górnicze.", {icon: '⛏️'})} className="hidden lg:flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors">
                        <Pickaxe size={14} /> KOPALNIA
                    </button>

                    {/* Aktywny Model */}
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                        <Server size={14} className="text-emerald-400 hidden md:block" />
                        <select value={activeModel} onChange={(e) => { setActiveModel(e.target.value); localStorage.setItem('otakos_active_model', e.target.value); addSystemMessage(`🔌 Przełączono zmysły na rdzeń: ${e.target.value}`, 'system');}} className="bg-transparent text-[10px] md:text-xs text-emerald-300 outline-none w-24 md:w-32 truncate cursor-pointer">
                            {availableModels?.length > 0 ? availableModels.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>) : <option value="">Ładowanie...</option>}
                        </select>
                        <button onClick={fetchModels} className="text-slate-500 hover:text-cyan-400" title="Odśwież Listę Modeli"><RefreshCw size={14} /></button>
                    </div>
                    
                        {/* Przełącznik Prawego Panelu (Logi) */}
                    <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className={`p-1.5 rounded-lg transition-colors border ${isRightPanelOpen ? 'bg-amber-900/30 border-amber-500/50 text-amber-400' : 'bg-black border-slate-700 text-slate-500 hover:text-amber-400'}`} title="Panel Logów">
                        {isRightPanelOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
                    </button>

                    {/* NOWOŚĆ: Przycisk Contextualize Sandbox (Cel 1) */}
                    <button 
                        onClick={() => {
                            setIsSandboxContextActive(!isSandboxContextActive);
                            toast(isSandboxContextActive ? "📴 Sandbox Context wyłączony." : "🎯 Qwen teraz widzi strukturę projektu!", { icon: isSandboxContextActive ? '📴' : '🎯' });
                        }} 
                        className={`p-1.5 px-3 rounded-lg transition-all border flex items-center gap-2 text-[10px] font-bold ${isSandboxContextActive ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-black border-slate-700 text-slate-500 hover:text-cyan-400'}`}
                        title="Daj AI dostęp do struktury plików projektu"
                    >
                        <Layers size={14} /> {isSandboxContextActive ? 'SANDBOX ACTIVE' : 'SANDBOX CONTEXT'}
                    </button>
                </div>
            </div>

            {/* KONTENER ROBOCZY - FLEX PANCERNY (Unika ucinania) */}
            <div className="flex flex-1 min-h-0 overflow-hidden relative">
                
                {/* LEWY PANEL (Wsuwany niezależnie) */}
                <AnimatePresence initial={false}>
                    {isLeftPanelOpen && (
                        <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="h-full border-r border-slate-800 bg-[#080812] flex flex-col shrink-0 overflow-hidden">
                            <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar min-w-[280px]">
                                {/* 1. PULL MODEL */}
                                <div className="bg-black/40 p-3 rounded-xl border border-slate-800 shrink-0">
                                    <h3 className="text-[10px] font-bold text-fuchsia-400 mb-2 flex items-center gap-2"><DownloadCloud size={14} /> PULL - POBIERZ MODEL</h3>
                                    <div className="flex gap-2">
                                        <input type="text" value={modelToPull} onChange={(e) => setModelToPull(e.target.value)} placeholder="np. qwen2.5-coder:7b" className="flex-1 bg-black border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-fuchsia-500" onKeyDown={(e) => e.key === 'Enter' && pullModel()} />
                                        <button onClick={pullModel} disabled={isPulling || !modelToPull.trim()} className="bg-fuchsia-900/40 hover:bg-fuchsia-800/60 text-fuchsia-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"><Zap size={14} /></button>
                                    </div>
                                </div>

                                {/* 2. ZASOBY (Lista) */}
                                <div className="bg-black/40 p-3 rounded-xl border border-slate-800 flex flex-col max-h-[180px] shrink-0">
                                    <h3 className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-2"><Database size={14} /> BAZA LOKALNA</h3>
                                    <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                                        {availableModels.map(m => (
                                            <div key={m} onClick={() => { setActiveModel(m); localStorage.setItem('otakos_active_model', m); addSystemMessage(`🔌 Podłączono do rdzenia: ${m}`, 'system'); }} className={`text-[9px] p-1.5 rounded border cursor-pointer transition-colors ${m === activeModel ? 'bg-cyan-900/20 border-cyan-500/50 text-cyan-300 font-bold' : 'bg-black/50 border-slate-800 text-slate-400 hover:border-slate-600'}`}>{m}</div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. KUŹNIA */}
                                <div className="bg-black/40 p-3 rounded-xl border border-amber-500/20 flex-1 flex flex-col min-h-[220px]">
                                    <h3 className="text-[10px] font-bold text-amber-500 mb-2 flex items-center gap-2"><Wrench size={14} /> KUŹNIA DUSZ (Modelfile)</h3>
                                    <div className="flex flex-col gap-2 flex-1">
                                        <select value={baseModelForForge} onChange={(e) => setBaseModelForForge(e.target.value)} className="bg-black border border-slate-700 rounded-lg px-2 py-1.5 text-[9px] text-white outline-none shrink-0">
                                            {availableModels?.map?.(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <input type="text" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Nazwa Agenta (np. mistrz_kodu)" className="bg-black border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-amber-500 shrink-0" />
                                        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Instrukcja systemowa (Dusza)..." className="flex-1 min-h-[60px] bg-black border border-slate-700 rounded-lg px-2 py-1.5 text-[9px] text-white outline-none focus:border-amber-500 resize-none custom-scrollbar" />
                                        <button onClick={forgeModel} disabled={isForging || !newModelName} className="py-2 mt-auto bg-amber-900/40 hover:bg-amber-800/60 text-amber-400 border border-amber-500/30 rounded-lg text-[9px] font-bold transition-colors shrink-0 disabled:opacity-50">
                                            ROZPOCZNIJ KUCIE
                                        </button>
                                    </div>
                                </div>

                                {/* 4. KONTEKST PLIKOWY (Cel 2) */}
                                <div className="bg-black/40 p-3 rounded-xl border border-cyan-500/20 shrink-0">
                                    <h3 className="text-[10px] font-bold text-cyan-400 mb-2 flex items-center gap-2"><FileText size={14} /> 📄 KONTEKST PLIKOWY</h3>
                                    <div className="flex gap-2 mb-2">
                                        <input 
                                            type="text" 
                                            value={filePathToAttach} 
                                            onChange={(e) => setFilePathToAttach(e.target.value)} 
                                            placeholder="Ścieżka do pliku (kontekst)" 
                                            className="flex-1 bg-black border border-slate-700 rounded-lg px-2 py-1.5 text-[9px] text-white outline-none focus:border-cyan-500" 
                                            onKeyDown={(e) => e.key === 'Enter' && loadFileToContext()} 
                                        />
                                        <button 
                                            onClick={loadFileToContext} 
                                            disabled={!filePathToAttach.trim()} 
                                            className="bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-400 px-3 py-1.5 rounded-lg transition-colors border border-cyan-500/30"
                                        >
                                            <DownloadCloud size={14} />
                                        </button>
                                    </div>
                                    
                                    {/* Lista załączonych plików */}
                                    <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                                        {attachedFiles.map((file, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-cyan-950/20 border border-cyan-900/40 px-2 py-1 rounded text-[8px] text-cyan-200">
                                                <span className="truncate max-w-[160px]">{file.path}</span>
                                                <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400"><X size={10} /></button>
                                            </div>
                                        ))}
                                        {attachedFiles.length > 0 && (
                                            <button onClick={() => setAttachedFiles([])} className="w-full mt-1 text-[8px] text-slate-500 hover:text-red-400 flex items-center justify-center gap-1">
                                                <X size={10} /> WYCZYŚĆ KONTEKST
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ŚRODKOWY PANEL (Czat i Wyniki - Rozciąga się płynnie) */}
                <div className="flex-1 flex flex-col bg-[radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.05),transparent_60%)] relative min-w-0">
                    
                    {/* Zadania Oczekujące (Z Rady) */}
                    {councilTasks.length > 0 && (
                        <div className="p-2 bg-emerald-900/20 border-b border-emerald-500/30 flex gap-2 overflow-x-auto custom-scrollbar shrink-0 items-center min-h-[44px]">
                            <span className="text-[10px] font-bold text-emerald-400 whitespace-nowrap ml-2 uppercase">🔮 Dekrety ({councilTasks.length}):</span>
                            
                            {/* Przycisk czyszczenia całego paska */}
                            <button 
                                onClick={clearAllTasks} 
                                className="px-2 py-1.5 bg-red-900/40 hover:bg-red-800/80 text-red-300 border border-red-500/50 rounded-lg text-[9px] font-bold whitespace-nowrap transition-colors flex items-center shrink-0"
                            >
                                <X size={10} className="mr-1" /> WYCZYŚĆ WSZYSTKO
                            </button>

                            {councilTasks?.map?.((task, idx) => (
                                <div key={idx} className="flex items-center bg-emerald-900/40 border border-emerald-500/50 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)] shrink-0 overflow-hidden">
                                    <button 
                                        onClick={() => executeCouncilTask(task, idx)} 
                                        disabled={isThinking} 
                                        className="px-3 py-1.5 text-[9px] text-emerald-200 font-bold whitespace-nowrap hover:bg-emerald-800/60 transition-colors flex items-center h-full"
                                    >
                                        <Zap size={10} className="inline mr-1 text-emerald-400" /> [ WYKONAJ ]: {task?.title?.substring(0, 30) || 'Bez tytułu'}
                                    </button>
                                    <button 
                                        onClick={() => dismissCouncilTask(idx)} 
                                        className="px-2 py-1.5 border-l border-emerald-500/30 bg-red-900/40 hover:bg-red-800/80 text-red-300 transition-colors h-full"
                                        title="Usuń dekret"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Główny obszar czatu */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 flex flex-col gap-4">
                        {messages.filter(m => m.role !== 'system' && m.role !== 'wiesio').length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50 text-center">
                                <Terminal size={48} className="mb-4 text-cyan-500/30" />
                                <p className="text-sm font-bold tracking-widest text-cyan-500/50 uppercase">Centrum Operacyjne Superpowers</p>
                                <p className="text-[10px] mt-2 max-w-sm leading-relaxed">
                                    Gotowy do odbioru komend. Wybierz odpowiedni Skill z dolnego paska narzędzi.
                                </p>
                            </div>
                        )}
                        
                        <AnimatePresence>
                            {messages?.filter?.(m => m.role !== 'system' && m.role !== 'wiesio').map((msg) => (
                                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                                    <span className="text-[8px] md:text-[9px] text-slate-500 mb-1 font-bold">{msg.role === 'user' ? 'SUWEREN' : 'RDZEŃ OLLAMY'}</span>
                                    <div className={`p-3 md:p-4 rounded-2xl text-[10px] md:text-xs whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-cyan-600 text-black font-bold rounded-tr-none shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-black/60 border border-slate-700 text-slate-200 rounded-tl-none shadow-inner'}`}>
                                        {msg.content}
                                        
                                        {/* Magiczny Przycisk Ekstrakcji (Tylko dla AI i gdy jest kod) */}
                                        {msg.role === 'ai' && msg.content?.includes('```') && (
                                            <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-end">
                                                <button 
                                                    onClick={() => extractCodeToWrite(msg.content)}
                                                    className="px-3 py-1.5 bg-fuchsia-900/40 hover:bg-fuchsia-800/60 border border-fuchsia-500/50 text-[9px] font-bold rounded-lg text-fuchsia-300 transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(217,70,239,0.2)]"
                                                >
                                                    <Zap size={12} /> EKSTRAHUJ KOD DO WDROŻENIA
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {isThinking && <div className="text-cyan-500/50 text-[10px] italic flex items-center gap-2 mt-2"><BrainCircuit size={12} className="animate-spin"/> System analizuje polecenie...</div>}
                    </div>

                    {/* KONTROLA I SKILLE (Dolny pasek) */}
                    <div className="p-3 md:p-4 bg-[#080812] border-t border-slate-800 shrink-0">
                        {/* Wybór Skilli */}
                        <div className="flex gap-2 mb-3 items-center flex-wrap">
                            <Wrench size={12} className="text-fuchsia-400" />
                            <span className="text-[9px] text-fuchsia-400 font-bold tracking-widest mr-2 uppercase">Super-moce:</span>
                            
                            {[
                                { id: 'AUTO', icon: <BrainCircuit size={10}/>, label: 'LLM' },
                                { id: 'CODE', icon: <BrainCircuit size={10}/>, label: 'KODER' },
                                { id: 'SYSTEM_CMD', icon: <Terminal size={10}/>, label: 'SYSTEM CMD' },
                                { id: 'FILE', icon: <FileText size={10}/>, label: 'CZYTAJ PLIK' },
                                { id: 'DIR', icon: <FolderPlus size={10}/>, label: 'TWÓRZ FOLDER' },
                                { id: 'WRITE', icon: <FileText size={10}/>, label: 'ZAPISZ PLIK' },
                                { id: 'SEARCH', icon: <Search size={10}/>, label: 'SZUKAJ W SIECI' },
                                { id: 'YOUTUBE', icon: <Youtube size={10}/>, label: 'ZASSAJ WWW/YT' }
                            ].map(skill => (
                                <button 
                                    key={skill.id} 
                                    onClick={() => setActiveSkill(skill.id)} 
                                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold border transition-colors flex items-center gap-1 ${activeSkill === skill.id ? 'bg-fuchsia-900/40 border-fuchsia-500 text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.3)]' : 'bg-black border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-400'}`}
                                >
                                    {skill.icon} {skill.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Interfejs dla DELEGACJI W TLE (SYSTEM CMD) */}
                        {activeSkill === 'SYSTEM_CMD' && (
                            <div className="p-4 bg-amber-900/10 border border-amber-500/30 rounded-xl flex flex-col gap-3 mb-3">
                                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase mb-1">
                                    <Bot size={14} /> Delegacja Zadania w Absolutnym Tle (Ollama CMD)
                                </div>
                                <div className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                                    Wpisz poniżej samo zadanie. Katedra sama opakuje je w komendę i wyśle do modelu w tle.
                                    Upewnij się, że na górze w panelu BAZY LOKALNEJ masz wybrany odpowiedni model!
                                </div>
                                <textarea 
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="np. Napisz skrypt w Pythonie analizujący..." 
                                    className="w-full bg-black/60 border border-slate-700 rounded-xl p-4 text-sm text-amber-100 outline-none focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all font-mono resize-none min-h-[100px] custom-scrollbar"
                                />
                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={() => {
                                            if(!input.trim()) return toast.error("Zadanie jest puste!");
                                            sendMessage(input.trim(), 'SYSTEM_CMD');
                                        }}
                                        className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-xl transition-colors shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2"
                                    >
                                        <Zap size={16} /> WYŚLIJ DELEGACJĘ
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Wpisywanie komendy (Ukrywane gdy aktywny SYSTEM_CMD) */}
                        {activeSkill !== 'SYSTEM_CMD' && (
                            <div className="flex gap-2 h-[50px] md:h-[60px]">
                                <textarea 
                                    value={input} 
                                    onChange={(e) => setInput(e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} 
                                    disabled={isThinking} 
                                    placeholder={
                                        activeSkill === 'SEARCH' ? "Wpisz zapytanie do wyszukiwarki..." : 
                                        activeSkill === 'YOUTUBE' ? "Wklej URL YouTube/Artykułu..." :
                                        activeSkill === 'FILE' ? "Wpisz pełną ścieżkę do pliku..." :
                                        activeSkill === 'DIR' ? "Wpisz ścieżkę folderu do utworzenia..." :
                                        activeSkill === 'WRITE' ? "Ścieżka | Treść..." :
                                        activeSkill === 'CODE' ? "Opisz skrypt do wygenerowania..." :
                                        "Wpisz polecenie..."
                                    }
                                    className="flex-1 bg-black/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-cyan-100 outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all font-mono resize-none custom-scrollbar"
                                />
                                <button 
                                    onClick={() => sendMessage()} 
                                    disabled={isThinking || !input.trim()} 
                                    className="w-12 md:w-16 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-400 border border-cyan-500/50 rounded-xl transition-all flex items-center justify-center disabled:opacity-30 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* PRAWY PANEL (Logi Wsuwane) */}
                <AnimatePresence initial={false}>
                    {isRightPanelOpen && (
                        <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="h-full border-l border-slate-800 bg-[#020205] flex flex-col shrink-0 overflow-hidden">
                            <div className="p-4 bg-[#050a14] border-b border-amber-500/30 flex justify-between items-center shrink-0 min-w-[280px]">
                                <div className="flex items-center gap-3">
                                    <Activity size={18} className="text-amber-500" />
                                    <h2 className="text-amber-500 font-bold tracking-widest text-sm uppercase">Wizjer (Logi Operacyjne)</h2>
                                </div>
                                <button 
                                    onClick={() => setMessages([])} 
                                    className="p-1.5 hover:bg-red-900/40 text-slate-500 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/50"
                                    title="Wyczyść logi Terminala"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <div ref={logsRef} className="flex-1 p-3 overflow-y-auto custom-scrollbar bg-black/40 min-w-[280px]">
                                {messages.filter(m => m.role === 'system' || m.role === 'wiesio').map(msg => (
                                    <div key={msg.id} className={`border-l-2 pl-2 break-words mb-3 pb-2 border-b border-slate-800/50 ${msg.role === 'wiesio' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                                        <div className="text-[8px] text-slate-600 font-mono mb-1">{msg.role.toUpperCase()} • {msg.timestamp}</div>
                                        <div className={`text-[9px] font-mono leading-relaxed ${msg.role === 'wiesio' ? 'text-emerald-200/90' : 'text-amber-200/80'}`}>{msg.content}</div>
                                    </div>
                                ))}
                                {messages.filter(m => m.role === 'system' || m.role === 'wiesio').length === 0 && (
                                    <div className="text-center opacity-30 mt-10 text-[9px] font-mono text-slate-500">Oczekiwanie na sygnały z systemu...</div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.3); border-radius: 10px; }`}</style>
        </div>
    );
};

export default TerminalZero;
