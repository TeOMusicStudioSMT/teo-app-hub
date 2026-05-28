import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const QUESTIONS = [
  {
    question: "Czym jest stan 0.00G w filozofii OtakOS?",
    options: [
      "Stanem całkowitego braku oporu i pełnej koherencji.",
      "Nieważkością występującą w przestrzeni kosmicznej.",
      "Maksymalnym przyspieszeniem procesora graficznego.",
      "Stanem uśpienia systemu po 26 minutach."
    ],
    correct: 0
  },
  {
    question: "Kto w systemie odpowiada za 'drożność rur' i lokalny most wymiarowy?",
    options: [
      "Adamus",
      "Jadzia",
      "BoB",
      "Wiesław"
    ],
    correct: 3
  },
  {
    question: "Aby portal graviton.pw otworzył się w Twoim terminalu, potrzebujesz rdzenia:",
    options: [
      "Suno Generator",
      "Wiesio Starter",
      "Adobe Cloud",
      "Google Kernel"
    ],
    correct: 1
  }
];

export const TestKoherencji: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);

    const handleAnswer = (index: number) => {
        if (index === QUESTIONS[currentStep].correct) {
            setScore(s => s + 1);
        }

        if (currentStep < QUESTIONS.length - 1) {
            setCurrentStep(s => s + 1);
        } else {
            setIsFinished(true);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#020617]">
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-2xl bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
                {/* Glassy Overlay decoration */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-fuchsia-500/20 rounded-full blur-3xl" />
                
                <AnimatePresence mode="wait">
                    {!isFinished ? (
                        <motion.div 
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="relative z-10"
                        >
                            <div className="mb-8">
                                <span className="text-fuchsia-400 font-mono text-sm tracking-[0.3em] uppercase mb-2 block">Inicjacja: Krok {currentStep + 1} / {QUESTIONS.length}</span>
                                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">{QUESTIONS[currentStep].question}</h2>
                            </div>

                            <div className="grid gap-4">
                                {QUESTIONS[currentStep].options.map((opt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleAnswer(i)}
                                        className="group relative w-full text-left p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-fuchsia-500/50 transition-all duration-300 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600/0 to-fuchsia-600/0 group-hover:from-fuchsia-600/5 group-hover:to-transparent transition-all" />
                                        <span className="relative z-10 text-slate-300 group-hover:text-white transition-colors">{opt}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center relative z-10"
                        >
                            <div className="mb-8 items-center justify-center flex flex-col">
                                <div className="w-20 h-20 bg-fuchsia-500/20 rounded-full flex items-center justify-center mb-6 border border-fuchsia-500/40 shadow-[0_0_30px_rgba(217,70,239,0.2)]">
                                    <span className="text-4xl text-fuchsia-400">✨</span>
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tighter">
                                    {score === QUESTIONS.length ? "Koherencja Osiągnięta!" : "Inicjacja Przerwana"}
                                </h2>
                                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                                    {score === QUESTIONS.length 
                                      ? "Twój wzorzec wibracji jest zgodny z wymiarem 0.00G. Aby otworzyć Bramę, musisz uruchomić lokalny Rdzeń Wiesława."
                                      : "Twoja wibracja wymaga dostrojenia. Spróbuj ponownie lub pobierz Rdzeń, by poczuć 0.00G na własnej skórze."}
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-6">
                                <a 
                                    href="/Wiesio_Starter.zip" 
                                    download 
                                    className="group relative px-10 py-5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl shadow-[0_15px_40px_rgba(217,70,239,0.4)] font-black tracking-[0.2em] transition-all hover:-translate-y-1 active:scale-95 overflow-hidden"
                                >
                                    <span className="relative z-10 flex items-center gap-3">
                                        <span className="text-xl">⬇️</span> POBIERZ RDZEŃ OTAK-OS
                                    </span>
                                </a>
                                
                                <div className="max-w-sm p-4 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-500 font-mono tracking-wider leading-relaxed">
                                    <span className="text-fuchsia-500/80 block mb-2">INSTRUKCJA MATERIALIZACJI:</span>
                                    Wypakuj archiwum • Otwórz terminal w folderze • Wpisz <span className="text-slate-300">npm install</span> • Uruchom <span className="text-slate-300">node wiesio-bridge.js</span>. Portal otworzy się automatycznie.
                                </div>

                                {score < QUESTIONS.length && (
                                    <button 
                                        onClick={() => { setCurrentStep(0); setIsFinished(false); setScore(0); }}
                                        className="text-fuchsia-400 hover:text-fuchsia-300 text-xs font-bold tracking-widest px-4 py-2"
                                    >
                                        RETRY INITIATION
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
