import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    onInitiateForge: (data: any) => void;
}

export const QuantumStudioFrame: React.FC<Props> = ({ onInitiateForge }) => {
    // Domyślnie panel JEST ZWINIĘTY (zgodnie z życzeniem Suwerena)
    const [isStudioOpen, setIsStudioOpen] = useState(false);
    const [isThinking, setIsThinking] = useState(false);

    useEffect(() => {
        // Nasłuch do odbierania gotowych GDD, Map i Postaci z HTML'a Klaudiusza
        const bcArcade = new BroadcastChannel('katedra_arcade');
        // Nasłuch do wysyłania zapytań LLM (np. Auto-Wypełniacz)
        const bcDispatch = new BroadcastChannel('katedra_dispatch');

        bcArcade.onmessage = (e) => {
            const data = e.data;
            if (data.type === 'AGENT_FORGE') {
                console.log('🔥 Zaczynamy generowanie gry z danymi ze Studia!');
                // Przekazujemy dane wyżej, do FabrykaGier.tsx, aby Agent zaczął kodować
                onInitiateForge(data);
            }
        };

        bcDispatch.onmessage = async (e) => {
            const data = e.data;
            if (data.type === 'DISPATCH_INTENTION') {
                console.log(`🤖 Żądanie LLM otrzymane od: ${data.from || 'nieznany'}! Budzę Ollamę...`);
                setIsThinking(true);
                try {
                    // BEZPOŚREDNIA RURA DO LOKALNEGO OLLAMY (0.00 PLN!)
                    const activeModel = localStorage.getItem('otakos_active_model') || 'gemma:2b';
                    const response = await fetch('http://127.0.0.1:11434/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: activeModel,
                            prompt: data.text,
                            stream: false,
                            options: { temperature: 0.8 }
                        })
                    });

                    if (!response.ok) throw new Error('Brak połączenia z Ollamą');
                    const result = await response.json();

                    // Odsyłamy wygenerowany tekst z powrotem do Iframe'a (QuantumGameStudio.html)
                    bcDispatch.postMessage({
                        type: 'DISPATCH_RESPONSE',
                        text: result.response
                    });
                } catch (error) {
                    console.error('Błąd generatora GDD:', error);
                    bcDispatch.postMessage({
                        type: 'DISPATCH_RESPONSE',
                        text: "Wystąpił błąd lokalnego LLM. Czy Ollama jest włączona i ma odblokowany CORS (OLLAMA_ORIGINS=*)?"
                    });
                } finally {
                    setIsThinking(false);
                }
            }
        };

        return () => {
            bcArcade.close();
            bcDispatch.close();
        };
    }, [onInitiateForge]);

    return (
        <div className="w-full flex flex-col items-center">
            {/* Przycisk rozwijania Studia */}
            <button
                onClick={() => setIsStudioOpen(!isStudioOpen)}
                className={`px-8 py-3 rounded-lg font-mono tracking-widest text-[11px] transition-all flex items-center gap-3 border ${isStudioOpen
                        ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                    }`}
            >
                {isStudioOpen ? '✕ ZAMKNIJ QUANTUM GAME STUDIO' : '⚡ OTWÓRZ QUANTUM GAME STUDIO'}
            </button>

            {/* Wskaźnik myślenia lokalnego modelu */}
            {isThinking && (
                <div className="mt-3 text-[10px] text-purple-400 animate-pulse font-mono tracking-widest">
                    🤖 Lokalna AI (Ollama) wymyśla koncepcję GDD...
                </div>
            )}

            {/* Kontener Iframe (Animowany) */}
            <AnimatePresence>
                {isStudioOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 800, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="w-full mt-6 overflow-hidden border border-white/10 rounded-xl bg-black/50"
                    >
                        <iframe
                            src="/QuantumGameStudio.html"
                            className="w-full h-full border-none"
                            title="Quantum Game Studio"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};