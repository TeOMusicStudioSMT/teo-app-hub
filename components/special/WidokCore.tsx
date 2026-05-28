/**
 * 👁️ WidokCore.tsx - Kwantowy Krasher Danych
 * * Oddzielny moduł do destylacji szumu informacyjnego (1, 13 i 26 dni).
 * * Posiada funkcję "Perspektywa Suwerena" - re-analiza raportu przez lokalny LLM
 * na podstawie ręcznie dopisanego wniosku/kontekstu.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Filter, CalendarDays, Moon, Sun, Zap, BrainCircuit, RefreshCw, MessageSquarePlus, Globe, Users, FileText, Upload, Link as LinkIcon, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { OtakOSBus, BUS } from '../../lib/otakosBus';

// --- TYPY ---
type TimeFrame = '1_DAY' | '13_DAYS' | '26_DAYS';

interface DistilledReport {
    id: string;
    timeframe: TimeFrame;
    date: string;
    baseNoise: string; // Symulowany "szum"
    baseReport: string; // Wygenerowany przez LLM raport
    suwerenInput?: string; // Słowa od Suwerena
    finalSynthesis?: string; // Re-analiza LLM
}

export const WidokCore: React.FC = () => {
    const [activeTimeframe, setActiveTimeframe] = useState<TimeFrame>('1_DAY');
    const [reports, setReports] = useState<DistilledReport[]>([]);
    const [activeReportId, setActiveReportId] = useState<string | null>(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [suwerenInput, setSuwerenInput] = useState('');
    const [seedTopic, setSeedTopic] = useState('');

    const [uploadedFileContent, setUploadedFileContent] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

    // --- URL FETCHER ---
    const [urlInput, setUrlInput] = useState('');
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);

    const handleUrlFetch = async () => {
        if (!urlInput.trim()) return;
        setIsFetchingUrl(true);
        toast('Wyrzucam sieć pająka...', { icon: '🕸️' });

        try {
            const res = await fetch('http://127.0.0.1:3001/api/bridge/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'FETCH_URL_CONTENT', url: urlInput.trim() })
            });
            const data = await res.json();
            if (data.success && data.text) {
                setUploadedFileContent(data.text);
                setUploadedFileName(`[LINK] ${urlInput.trim()}`);
                toast.success('Pomyślnie wessano treść ze strony!');
                setUrlInput('');
            } else {
                toast.error(data.error || "Błąd sieciarza.");
            }
        } catch (err) {
            toast.error("Brak łączności z Wiesiem.");
        } finally {
            setIsFetchingUrl(false);
        }
    };

    // Funkcja obsługująca wgranie pliku przez Suwerena
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setUploadedFileContent(text);
            setUploadedFileName(file.name);
            toast.success(`Wczytano dokument: ${file.name}`);
        };
        reader.onerror = () => toast.error("Błąd odczytu pliku.");
        reader.readAsText(file);
    };

    // Ładowanie historii WIDOKU
    useEffect(() => {
        const saved = localStorage.getItem('otakos_widok_reports');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setReports(parsed);
                if (parsed.length > 0) setActiveReportId(parsed[0].id);
            } catch (e) { }
        }
    }, []);

    // Zapis historii
    useEffect(() => {
        if (reports.length > 0) {
            localStorage.setItem('otakos_widok_reports', JSON.stringify(reports));
        }
    }, [reports]);

    const activeReport = reports.find(r => r.id === activeReportId);

    // 🧹 Synchronizacja Archiwum między kartami
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'otakos_widok_reports') {
                try {
                    const updated = JSON.parse(e.newValue || '[]');
                    setReports(updated);
                } catch (err) {}
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // 🧹 Czyszczenie pojedynczego raportu
    const deleteReport = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const currentReports = JSON.parse(localStorage.getItem('otakos_widok_reports') || '[]');
        const updatedReports = currentReports.filter((r: any) => r.id !== id);
        localStorage.setItem('otakos_widok_reports', JSON.stringify(updatedReports));
        setReports(updatedReports);
        if (activeReportId === id) setActiveReportId(null);
        toast.success("Raport usunięty z Archiwum W.I.D.O.K.", { icon: '🗑️' });
    };

    // 🌪️ FAZA 1: DESTYLACJA SZUMU (Generowanie Raportu)
    const distillNoise = async () => {
        setIsGenerating(true);
        const activeModel = localStorage.getItem('otakos_active_model') || 'gemma:2b';

        let context = '';
        if (activeTimeframe === '1_DAY') context = "Raport Dzienny (Puls 24h). Skup się na mikrotrenach, nagłych skokach emocji na rynkach i szybkich decyzjach.";
        if (activeTimeframe === '13_DAYS') context = "Raport 13-dniowy (Fala Kwantowa). Skup się na średnioterminowych łańcuchach zdarzeń, geopolityce i przesunięciach zasobów.";
        if (activeTimeframe === '26_DAYS') context = "Raport 26-dniowy (Cykl Księżycowy). Skup się na makroekonomii, głębokich zmianach psychologii tłumu i długoterminowym przetrwaniu.";

        // JEŚLI JEST WGRANY PLIK, ZMIEŃ PROMPT:
        let promptText = '';
        if (uploadedFileContent) {
            promptText = `Jesteś systemem W.I.D.O.K. Przeanalizuj poniższy, surowy dokument wgrany przez Suwerena.
Nazwa dokumentu: ${uploadedFileName}
Treść dokumentu:
"""
${uploadedFileContent.substring(0, 3000)} // Zabezpieczenie przed przepełnieniem kontekstu małych modeli
"""
Wygeneruj raport w 3 krótkich, analitycznych punktach:
1. Główne przesłanie.
2. Ukryte znaczenie/wartość.
3. Potencjalne zastosowanie w Katedrze (Złota Pauza/0.00G).`;
        } else {
             promptText = `Jesteś systemem W.I.D.O.K w Katedrze OtakOS. Przeprowadź destylację danych.
Temat / Cel analizy: ${seedTopic || 'Globalne nastroje i szum rynkowy'}
Kontekst czasowy: ${context}
Wygeneruj raport w 3 krótkich, cyberpunkowych punktach:
1. Główne napięcie/wydarzenie.
2. Ukryte przepływy kapitału/energii.
3. Potencjalne zagrożenie/szansa.
Odpowiedz po polsku.`;
        }

        try {
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: activeModel, prompt: promptText, stream: false })
            });
            if (!response.ok) throw new Error('Ollama offline');
            const data = await response.json();

            const newReport: DistilledReport = {
                id: `WDK-${Date.now()}`,
                timeframe: activeTimeframe,
                date: new Date().toLocaleString(),
                baseNoise: uploadedFileContent ? `Plik: ${uploadedFileName}` : "Pobrano 1,402,012 nagłówków. Szum zdestylowany.",
                baseReport: data.response.trim()
            };

            setReports(prev => [newReport, ...prev]);
            // 🚌 Emituj raport na Bus
            OtakOSBus.emit('widok', BUS.WIDOK_REPORT, {
                id:          newReport.id,
                timeframe:   activeTimeframe,
                baseReport:  newReport.baseReport,
                synthesis:   newReport.baseReport,
            });
            setActiveReportId(newReport.id);
            toast.success(`Destylacja dla ${activeTimeframe} zakończona!`, { icon: '🌪️' });
        } catch (error) {
            toast.error("Błąd Krashera Danych. Sprawdź rdzeń Ollamy.");
        } finally {
            setIsGenerating(false);
        }
    };

    // ⚡ FAZA 2: PERSPEKTYWA SUWERENA (Re-Analiza)
    const synthesizeWithSuweren = async () => {
        if (!activeReport || !suwerenInput.trim()) return;
        setIsSynthesizing(true);
        const activeModel = localStorage.getItem('otakos_active_model') || 'gemma:2b';

        const promptText = `Jesteś systemem W.I.D.O.K. 
Oto Twój pierwotny raport bazowy:
"${activeReport.baseReport}"

SUWEREN (Architekt Systemu) dodaje do tego swoją nową perspektywę/wniosek:
"${suwerenInput}"

Twoje zadanie: Przeanalizuj pierwotny raport PONOWNIE, ale całkowicie przez pryzmat słów Suwerena. 
Jak jego perspektywa zmienia ten raport? Jakie nowe wnioski z tego płyną?
Napisz "ZAKTUALIZOWANA SYNTEZA W.I.D.O.K:" a następnie podaj 2-3 zdania głębokiej konkluzji uwzględniającej słowa Suwerena. Polskie tłumaczenie.`;

        try {
            const response = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: activeModel, prompt: promptText, stream: false })
            });
            if (!response.ok) throw new Error('Ollama offline');
            const data = await response.json();

            // Aktualizacja raportu o perspektywę i nową syntezę
            const updatedReports = reports.map(r => {
                if (r.id === activeReport.id) {
                    return { ...r, suwerenInput: suwerenInput, finalSynthesis: data.response.trim() };
                }
                return r;
            });

            setReports(updatedReports);
            setSuwerenInput('');
            toast.success('Nowa Perspektywa wpleciona w matrycę!', { icon: '👁️' });
        } catch (error) {
            toast.error("Błąd Syntezy. Rdzeń niedostępny.");
        } finally {
            setIsSynthesizing(false);
        }
    };

    const dispatchToCouncil = () => {
        if (!activeReport) return;
        const topicToDiscuss = activeReport.finalSynthesis || activeReport.baseReport;
        localStorage.setItem('otakos_current_topic', `Analiza WIDOK: ${topicToDiscuss}`);
        window.dispatchEvent(new Event('otakos_open_council'));
        OtakOSBus.emit('widok', BUS.WIDOK_COUNCIL, { topic: topicToDiscuss.substring(0, 200) });
        toast.success("Raport przekazany na Stół Narad!", { icon: '🔮' });
    };

    const getThemeColor = (tf: TimeFrame) => {
        if (tf === '1_DAY') return 'text-emerald-400 border-emerald-500/30 bg-emerald-900/20';
        if (tf === '13_DAYS') return 'text-cyan-400 border-cyan-500/30 bg-cyan-900/20';
        return 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-900/20';
    };

    return (
        <div className="w-full max-w-7xl mx-auto bg-[#030712] border border-slate-800 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] font-mono text-slate-300 min-h-[80vh] flex flex-col">

            {/* HEADER Z DODAWANIEM WIEDZY - Wersja Harmonijna */}
            <div className="bg-[#050a14] border-b border-slate-800 p-5 flex flex-col gap-4 relative overflow-hidden shrink-0">
                
                {/* Wiersz 1: Tytuł i Przyciski Czasowe */}
                <div className="flex justify-between items-center z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black border border-cyan-500/50 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                            <Eye size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">W.I.D.O.K.</h2>
                            <p className="text-[10px] text-slate-500 tracking-widest">Identyfikacja Danych i Surowców</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                        {(['1_DAY', '13_DAYS', '26_DAYS'] as TimeFrame[]).map(tf => (
                            <button 
                                key={tf} 
                                onClick={() => setActiveTimeframe(tf)} 
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTimeframe === tf ? getThemeColor(tf) : 'text-slate-600 border border-slate-800'}`}
                            >
                                {tf === '1_DAY' ? '1 DZIEŃ' : tf === '13_DAYS' ? '13 DNI' : '26 DNI'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Wiersz 2: Inputy (Link, Plik, Temat) i Przycisk Główny */}
                <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between z-10 border-t border-slate-800/50 pt-4">
                    
                    {/* Sekcja wprowadzania danych (Lewa strona) */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        
                        {/* Wprowadzanie Linku */}
                        <div className="flex items-center bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                            <input 
                                type="text" 
                                value={urlInput} 
                                onChange={(e) => setUrlInput(e.target.value)} 
                                placeholder="Wklej link YouTube / URL..."
                                className="w-40 bg-[#0a0f16] border-none rounded-lg px-2 py-1 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                            />
                            <button 
                                onClick={handleUrlFetch} 
                                disabled={isFetchingUrl || !urlInput} 
                                className="ml-1 bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
                                title="Pobierz treść ze strony"
                            >
                                {isFetchingUrl ? <RefreshCw size={14} className="animate-spin" /> : <LinkIcon size={14} />}
                            </button>
                        </div>

                        {/* Wgrywanie Pliku */}
                        <label className="cursor-pointer px-3 py-2 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-2 transition-all border border-slate-700 whitespace-nowrap">
                            <Upload size={14} /> 
                            {uploadedFileName ? 'ZMIEŃ DOKUMENT' : 'WGRAJ PLIK (TXT)'}
                            <input type="file" accept=".txt,.json,.md,.csv" className="hidden" onChange={handleFileUpload} />
                        </label>

                        {/* Temat Analizy */}
                        <input 
                            type="text" 
                            value={seedTopic} 
                            onChange={(e) => setSeedTopic(e.target.value)} 
                            placeholder="Cel (np. Wyciągnij strukturę klas)..."
                            className="flex-1 min-w-[200px] bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                        />
                    </div>

                    {/* Sekcja Akcji (Prawa strona) */}
                    <div className="flex items-center gap-3 shrink-0">
                        {uploadedFileName && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded border border-emerald-500/30 truncate max-w-[150px]" title={uploadedFileName}>
                                🗃️ {uploadedFileName}
                            </span>
                        )}
                        <button 
                            onClick={distillNoise} 
                            disabled={isGenerating} 
                            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 text-black hover:bg-cyan-500 flex gap-2 items-center shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                        >
                            {isGenerating ? <RefreshCw size={14} className="animate-spin"/> : <Filter size={14} />} KRASHUJ DANE
                        </button>
                    </div>
                </div>
            </div>

            {/* --- JĄDRO WIDOKU --- */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0">

                {/* ARCHIWUM RAPORTÓW (Lewy Panel) */}
                <div className="border-r border-slate-800 bg-[#050a10] p-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold text-slate-500 tracking-widest mb-4">ARCHIWUM DESTYLACJI</h3>
                    <div className="flex flex-col gap-3">
                        {reports.length === 0 ? (
                            <div className="text-xs text-slate-600 italic text-center mt-10">Brak raportów. Inicjuj krashowanie danych.</div>
                        ) : (
                            reports.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => setActiveReportId(r.id)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all hover:-translate-y-1 relative group ${activeReportId === r.id ? getThemeColor(r.timeframe) : 'bg-black/50 border-slate-800 hover:border-slate-700'}`}
                                >
                                    {/* Przycisk usuwania (pojawia się po najechaniu) */}
                                    <button 
                                        onClick={(e) => deleteReport(r.id, e)}
                                        className="absolute top-2 right-2 p-1.5 bg-red-900/40 hover:bg-red-800/80 text-red-300 border border-red-500/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                        title="Usuń raport"
                                    >
                                        <X size={12} />
                                    </button>

                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold">{r.timeframe.replace('_', ' ')}</span>
                                        <span className="text-[9px] opacity-70">{r.date.split(',')[0]}</span>
                                    </div>
                                    <div className="text-[10px] truncate opacity-80">{r.baseReport.substring(0, 40)}...</div>
                                    {r.finalSynthesis && <div className="mt-2 text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded inline-block">PERSPEKTYWA SUWERENA ✓</div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* OBSZAR ROBOCZY (Środek i Prawy) */}
                <div className="lg:col-span-2 p-6 flex flex-col gap-6 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.05),transparent_50%)]">

                    <AnimatePresence mode="wait">
                        {activeReport ? (
                            <motion.div key={activeReport.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 h-full">

                                {/* 1. RAPORT BAZOWY (Zdestylowany szum) */}
                                <div className={`p-6 rounded-2xl border ${getThemeColor(activeReport.timeframe)}`}>
                                    <div className="flex justify-between items-center mb-4 border-b border-current pb-2 opacity-80">
                                        <h4 className="text-xs font-bold tracking-widest flex items-center gap-2">
                                            <Globe size={14} /> RAPORT BAZOWY ({activeReport.timeframe.replace('_', ' ')})
                                        </h4>
                                        <span className="text-[10px]">{activeReport.date}</span>
                                    </div>
                                    <div className="text-[10px] opacity-50 mb-3 italic">{activeReport.baseNoise}</div>
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-bold">
                                        {activeReport.baseReport}
                                    </div>
                                </div>

                                {/* 2. ZŁOTA PAUZA / PERSPEKTYWA SUWERENA (Input) */}
                                {!activeReport.finalSynthesis && (
                                    <div className="bg-[#0a0500] border border-amber-500/40 rounded-2xl p-5 shadow-[0_0_30px_rgba(245,158,11,0.05)] relative overflow-hidden">
                                        <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none"><BrainCircuit size={100} className="text-amber-500" /></div>
                                        <h4 className="text-xs font-bold text-amber-400 tracking-widest mb-3 flex items-center gap-2 relative z-10">
                                            <MessageSquarePlus size={14} /> WNIOSEK SUWERENA (NADANIE KONTEKSTU)
                                        </h4>
                                        <textarea
                                            value={suwerenInput} onChange={(e) => setSuwerenInput(e.target.value)}
                                            placeholder="Napisz swoją perspektywę... Jak ten raport ma się do Twoich celów? Czego maszyna nie zauważyła?"
                                            className="w-full h-24 bg-black/50 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-100 placeholder-amber-900/50 focus:border-amber-500 outline-none resize-none relative z-10"
                                        />
                                        <div className="flex justify-end mt-3 relative z-10">
                                            <button
                                                onClick={synthesizeWithSuweren} disabled={isSynthesizing || !suwerenInput.trim()}
                                                className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${isSynthesizing ? 'bg-amber-900/50 text-amber-700' : 'bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/40'}`}
                                            >
                                                {isSynthesizing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                                                RE-ANALIZUJ PRZEZ MÓJ PRYZMAT
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 3. ZAKTUALIZOWANA SYNTEZA W.I.D.O.K. (Po reakcji Suwerena) */}
                                {activeReport.finalSynthesis && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-[#10051a] to-black border border-fuchsia-500/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(217,70,239,0.15)] relative">

                                        <div className="mb-4 pb-4 border-b border-fuchsia-500/20">
                                            <h4 className="text-[10px] font-bold text-fuchsia-500/50 tracking-widest mb-1">TWOJE SŁOWA WPROWADZONE DO MATRYCY:</h4>
                                            <p className="text-xs text-fuchsia-300 italic">"{activeReport.suwerenInput}"</p>
                                        </div>

                                        <h4 className="text-sm font-bold text-fuchsia-400 tracking-widest mb-3 flex items-center gap-2">
                                            <Eye size={16} /> ZAKTUALIZOWANA SYNTEZA W.I.D.O.K.
                                        </h4>
                                        <div className="text-sm text-fuchsia-100 leading-relaxed font-bold whitespace-pre-wrap">
                                            {activeReport.finalSynthesis}
                                        </div>

                                        {/* NOWOŚĆ: PRZYCISK TRANSFERU */}
                                        <button 
                                            onClick={dispatchToCouncil}
                                            className="mt-6 w-full py-3 bg-fuchsia-900/40 hover:bg-fuchsia-800/60 border border-fuchsia-500/50 text-fuchsia-400 rounded-xl font-bold tracking-widest flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Users size={18} /> PRZEKAŻ RAPORT NA STÓŁ NARAD
                                        </button>
                                    </motion.div>
                                )}

                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                                <Filter size={48} className="mb-4 opacity-20" />
                                <p>Oczekuję na dane z Matrixa...</p>
                                <p className="text-xs">Kliknij "KRASHUJ DANE", aby wygenerować pierwszy raport.</p>
                            </div>
                        )}
                    </AnimatePresence>

                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.2); border-radius: 4px; }
            `}</style>
        </div>
    );
};

export default WidokCore;