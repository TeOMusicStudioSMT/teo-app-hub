import React, { useState, useEffect, useRef } from 'react';
import DashboardCard from '../DashboardCard';
import { CameraIcon, StarIcon, PaperClipIcon } from '../icons'; // Upewnij się, że masz te ikony
import { motion, AnimatePresence } from 'framer-motion';
import { generateContent as apiCall } from '../../services/cloudService'; // CHMURA
import { generateOnDevice } from '../../services/mediaPipeService'; // LOKALNY MÓZG (Musisz mieć ten plik!)
import { saveManifestation } from '../../services/manifestHistoryService';
import { useAtomValue } from 'jotai';
import { electricBorderAtom } from '../../store/electricBorder';
import toast from 'react-hot-toast';
import { GlownyCzat } from '../special/GlownyCzat';
import { obrazyZ, nazwaZrzutu } from '../../lib/schowekObrazy';

// Ikona Mikrofonu (Inline dla pewności)
const MicIcon = ({ active }: { active: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${active ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-white'}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
);

interface CreativeZoneCardProps {
    onVisualAssistantOpen: () => void;
}

export const CreativeZoneCard: React.FC<CreativeZoneCardProps> = ({ onVisualAssistantOpen }) => {
    const [prompt, setPrompt] = useState('');
    const [wordOfDay, setWordOfDay] = useState("");
    const [proposals, setProposals] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isIgnited, setIsIgnited] = useState(false);
    const [isListening, setIsListening] = useState(false);
    // 👑 Creative Zone = centrum dowodzenia (Suweren 2026-10-01: „każdy TeOnauta zacznie od czatu w Creative Zone…
    // to miejsce powinno być głównym zarządzającym"). „Manifest" = dotychczasowy szybki model; „Główny" = Claude Code
    // w Katedrze (services/Glowny.js) z dostępem do plików, skilli i stada.
    const [tryb, setTryb] = useState<'manifest' | 'glowny'>(() => { try { return localStorage.getItem('otakos_cz_tryb') === 'glowny' ? 'glowny' : 'manifest'; } catch { return 'manifest'; } });
    const [doGlownego, setDoGlownego] = useState<string | undefined>(undefined);
    const [obrazyDoGlownego, setObrazyDoGlownego] = useState<File[] | undefined>(undefined);
    /** Manifest widzi tylko tekst — zrzut ekranu (Ctrl+V, upuszczenie, 📎) idzie do Głównego, który obrazy otwiera. */
    const obrazyDoGlownegoZ = (pliki: File[]) => {
        const o = pliki.filter((f) => f.type.startsWith('image/')).map((f) => new File([f], nazwaZrzutu(f), { type: f.type }));
        if (!o.length) { if (pliki.length) toast('Tu przyjmuję zrzuty ekranu (obrazy).', { icon: '🖼️' }); return; }
        setDoGlownego(prompt.trim() || undefined);
        setObrazyDoGlownego(o);
        ustawTryb('glowny');
        toast(`${o.length} obraz(y) → 👑 Główny (Manifest widzi tylko tekst)`, { icon: '🖼️' });
    };
    const ustawTryb = (t: 'manifest' | 'glowny') => { setTryb(t); try { localStorage.setItem('otakos_cz_tryb', t); } catch { /* bez pamięci trybu */ } };
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { globalMode } = useAtomValue(electricBorderAtom);

    // --- LOGIKA MIKROFONU ---
    const startListening = () => {
        if (!('webkitSpeechRecognition' in window)) {
            toast.error("Brak obsługi mowy w tej przeglądarce.");
            return;
        }
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'pl-PL';
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setPrompt(prev => prev + ' ' + transcript);
            setIsListening(false);
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };

    useEffect(() => {
        const pool = ["CONSCIOUSNESS", "GRAVITON", "SINGULARITY", "RESONANCE", "ETHER", "KINETIC", "MANIFEST", "AEND", "BE", "ABUNDANCE"];
        setWordOfDay(pool[Math.floor(Math.random() * pool.length)]);
    }, []);

    const igniteWord = async () => {
        setIsLoading(true);
        setIsIgnited(true);
        const finalPrompt = prompt.trim() || `Podaj 3 magiczne, krótkie skojarzenia dla słowa: ${wordOfDay}.`;

        try {
            let res = "";

            // --- PRZEŁĄCZNIK MÓZGÓW z AUTO-FALLBACKIEM (JusT → Ollama → Chmura) ---
            // Żaden mózg nie jest „martwy": jeśli brak .bin, schodzimy do Ollamy,
            // a gdy Ollama śpi — do Chmury. Suweren zawsze dostaje odpowiedź.
            if (globalMode === 'just') {
                // 1) JESTEM U SIEBIE (MediaPipe / plik .bin, w przeglądarce, bez Ollamy)
                toast("Budzenie lokalnego ducha (.bin)...", { icon: '🧠' });
                res = await generateOnDevice(finalPrompt);

                // 2) Fallback: brak .bin → Ollama (gemma4)
                if (!res || res.startsWith('Błąd:')) {
                    toast("Brak modelu .bin — próbuję Ollamę (gemma4)...", { icon: '🔁' });
                    res = await apiCall(finalPrompt, 'local');

                    // 3) Fallback: Ollama śpi → Chmura
                    if (!res || res.includes('Lokalny Duch śpi')) {
                        toast("Ollama niedostępna — łączę z Chmurą...", { icon: '☁️' });
                        res = await apiCall(finalPrompt, 'cloud');
                    }
                }
            } else {
                // TRYB REZONANS (Chmura)
                toast("Łączenie z polem globalnym...", { icon: '☁️' });
                res = await apiCall(finalPrompt, globalMode);
            }

            const newProposals = res.split('\n').filter((l: string) => l.length > 2).slice(0, 3);
            setProposals(newProposals);
            saveManifestation(wordOfDay, newProposals);

        } catch (e) {
            console.error(e);
            toast.error(globalMode === 'just' ? "Brak modelu lokalnego (.bin)!" : "Błąd połączenia.");
        } finally { setIsLoading(false); }
    };

    return (
        <DashboardCard title="Creative Portal" icon={<StarIcon filled />} className="h-full border-cyan-500/20 shadow-2xl">
            <div className="flex flex-col h-full min-h-[500px] p-4 lg:p-8 relative overflow-hidden">
                {/* Przełącznik: szybki Manifest albo Główny (centrum dowodzenia Imperium) */}
                <div className="absolute top-3 left-4 z-30 flex gap-1 rounded-full border border-slate-700 bg-slate-900/80 p-0.5 text-[10px] font-bold uppercase tracking-widest">
                    <button onClick={() => ustawTryb('manifest')} className={`rounded-full px-3 py-1 ${tryb === 'manifest' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-white'}`}>✨ Manifest</button>
                    <button onClick={() => ustawTryb('glowny')} className={`rounded-full px-3 py-1 ${tryb === 'glowny' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>👑 Główny</button>
                </div>
                {/* Wskaźnik trybu */}
                <div className="absolute top-4 right-4 text-[10px] uppercase tracking-widest opacity-40 font-bold text-cyan-500">
                    {tryb === 'glowny' ? 'Centrum dowodzenia: Claude Code w Katedrze' : `Active Brain: ${globalMode === 'just' ? 'ON-DEVICE (NPU)' : 'CLOUD (API)'}`}
                </div>

                {tryb === 'glowny' ? (
                    <div className="mt-10 flex-grow">
                        <GlownyCzat zrodlo="creative-zone" zadanie={doGlownego} obrazy={obrazyDoGlownego} className="h-full" />
                    </div>
                ) : (<>

                {/* SŁOWO DNIA (Responsywne + Break Words) */}
                <div className="flex-grow flex flex-col items-center justify-center space-y-6 my-6">
                    <motion.div whileHover={{ scale: 1.05 }} onClick={() => setPrompt(wordOfDay)} className="cursor-pointer relative group z-10 w-full text-center">
                        <motion.h1
                            className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tighter transition-all duration-1000 break-words w-full"
                            animate={{
                                textShadow: isIgnited ? "0 0 30px #22d3ee" : "0 0 0px rgba(0,0,0,0)",
                                color: isIgnited ? "#22d3ee" : "#ffffff"
                            }}
                        >
                            {wordOfDay}
                        </motion.h1>
                        {/* Glow effect */}
                        {isIgnited && <div className="absolute inset-0 bg-cyan-500/20 blur-[60px] -z-10 rounded-full" />}
                    </motion.div>

                    <div className="flex flex-col gap-2 w-full max-w-xl px-2">
                        <AnimatePresence>
                            {proposals.map((p, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs md:text-sm italic text-cyan-200/70 hover:bg-cyan-500/10 cursor-pointer"
                                    onClick={() => setPrompt(p)}
                                >
                                    {p}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* INPUT BAR (Większy + Ikony naprawione) */}
                <div className="bg-slate-900/90 border border-slate-700 p-4 rounded-3xl flex flex-col md:flex-row items-stretch md:items-center gap-4 shadow-xl z-20"
                    onDragOver={(e) => { if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault(); }}
                    onDrop={(e) => { const f = Array.from(e.dataTransfer?.files ?? []); if (f.length) { e.preventDefault(); obrazyDoGlownegoZ(f); } }}>

                    {/* IKONY (Zmniejszone i wyśrodkowane) */}
                    <div className="flex flex-row md:flex-col gap-4 justify-center items-center opacity-70 flex-shrink-0">
                        <div className="cursor-pointer hover:text-cyan-400 p-1 w-8 h-8 flex items-center justify-center" onClick={() => fileInputRef.current?.click()} title="Zrzut ekranu → Główny (albo wklej Ctrl+V / upuść)">
                            <div className="w-5 h-5">
                                <PaperClipIcon />
                            </div>
                        </div>
                        <div className="cursor-pointer hover:text-lime-400 p-1 w-8 h-8 flex items-center justify-center" onClick={onVisualAssistantOpen}>
                            <div className="w-5 h-5">
                                <CameraIcon />
                            </div>
                        </div>
                    </div>

                    <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden"
                        onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; obrazyDoGlownegoZ(f); }} />

                    {/* TEXTAREA (Większa) */}
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onPaste={(e) => { const o = obrazyZ(e.clipboardData); if (o.length) { e.preventDefault(); obrazyDoGlownegoZ(o); } }}
                        placeholder={isListening ? "Słucham..." : `Zasiej myśl w trybie ${globalMode}...`}
                        className="flex-grow bg-transparent border-none focus:ring-0 text-white placeholder-slate-600 resize-none text-lg md:text-xl font-light py-2 min-h-[80px]"
                    />

                    <div className="flex flex-row md:flex-col gap-3 justify-center items-center flex-shrink-0">
                        <button onClick={startListening} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all">
                            <MicIcon active={isListening} />
                        </button>

                        <button onClick={igniteWord} className="bg-cyan-600 hover:bg-cyan-500 text-black px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 whitespace-nowrap">
                            {isLoading ? "..." : "MANIFEST"}
                        </button>
                        <button onClick={() => { setDoGlownego(prompt.trim() || undefined); ustawTryb('glowny'); }}
                            title="Przekaż tę myśl Głównemu — zrobi z niej zadanie w Katedrze"
                            className="rounded-full border border-amber-500/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/10 whitespace-nowrap">
                            👑 Do Głównego
                        </button>
                    </div>
                </div>
                </>)}
            </div>
        </DashboardCard>
    );
};
