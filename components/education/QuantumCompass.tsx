
import React, { useState, useRef } from 'react';
import { useAtom } from 'jotai';
import { quizProgressAtom, quizDueDatesAtom, quizPrioritiesAtom, Priority } from '../../store/education';
import { QUIZZES, TUTORIALS, PROG_ODZNAKI } from '../../constants/education';
import { QuizChallenge } from './QuizChallenge';
import { TutorialCard } from './TutorialCard';
import { MortarBoardIcon, TrophyIcon, FaCheckCircle, CalendarIcon, FlagIcon } from '../icons';
import DashboardCard from '../DashboardCard';
import toast from 'react-hot-toast';
import { Quiz } from '../../types';
import { cn } from '../../lib/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { FundamentKatedry, RecenzjeKatedry } from './AkademiaTresci';

type Zakladka = 'quizzes' | 'tutorials' | 'fundament' | 'recenzje';
const ZAKLADKI: { id: Zakladka; nazwa: string }[] = [
    { id: 'quizzes', nazwa: '🎓 Quizy' },
    { id: 'tutorials', nazwa: '🧭 Przewodniki' },
    { id: 'fundament', nazwa: '🏛️ Fundament' },
    { id: 'recenzje', nazwa: '💬 Recenzje' },
];

const priorityConfig: { [key in Priority]: { label: string; selected: string; unselected: string; pill: string } } = {
    low: {
        label: 'Niski',
        selected: 'bg-sky-600/90 text-white border-sky-500',
        unselected: 'border-transparent text-slate-400 hover:text-white hover:border-sky-500 hover:bg-sky-500/30',
        pill: 'bg-sky-600/80 text-white',
    },
    medium: {
        label: 'Średni',
        selected: 'bg-amber-500/90 text-white border-amber-400',
        unselected: 'border-transparent text-slate-400 hover:text-white hover:border-amber-500 hover:bg-amber-500/30',
        pill: 'bg-amber-500/80 text-white',
    },
    high: {
        label: 'Wysoki',
        selected: 'bg-rose-500/90 text-white border-rose-400',
        unselected: 'border-transparent text-slate-400 hover:text-white hover:border-rose-500 hover:bg-rose-500/30',
        pill: 'bg-rose-500/80 text-white',
    },
};

/** 🎓 Akademia Katedry (widok 'academy'). `onOtworz` — przewodniki otwierają opisywany ekran Hubu. */
export const QuantumCompass: React.FC<{ onOtworz?: (widok: string) => void }> = ({ onOtworz }) => {
    const [activeTab, setActiveTab] = useState<Zakladka>('quizzes');
    const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
    const [quizProgress, setQuizProgress] = useAtom(quizProgressAtom);
    const [dueDates, setDueDates] = useAtom(quizDueDatesAtom);
    const [priorities, setPriorities] = useAtom(quizPrioritiesAtom);
    const datePickerRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});


    const handleQuizComplete = (quizId: string, score: number, reward: string) => {
        const zdany = score >= PROG_ODZNAKI;
        setQuizProgress(prev => ({
            ...prev,
            // raz zdobyta odznaka zostaje — słabsza powtórka jej nie odbiera
            [quizId]: { completed: zdany || !!prev[quizId]?.completed, score: Math.max(score, prev[quizId]?.score ?? 0) },
        }));
        setSelectedQuiz(null); // Return to quiz list
        if (zdany) toast.success(`Quiz zdany! Odznaka „${reward}” zdobyta!`, { icon: '🏆', duration: 5000 });
        else toast(`${score}% — odznaka od ${PROG_ODZNAKI}%. Spróbuj jeszcze raz.`, { icon: '📚', duration: 5000 });
    };

    const handleSetDueDate = (quizId: string, date: string) => {
        if (!date) return;
        setDueDates(prev => ({ ...prev, [quizId]: date }));
    };

    const handleClearDueDate = (quizId: string) => {
        setDueDates(prev => {
            const newDates = { ...prev };
            delete newDates[quizId];
            return newDates;
        });
    };

    const handleSetPriority = (quizId: string, priority: Priority) => {
        setPriorities(prev => {
            // If the same priority is clicked again, unset it
            if (prev[quizId] === priority) {
                const newPriorities = { ...prev };
                delete newPriorities[quizId];
                return newPriorities;
            }
            return { ...prev, [quizId]: priority };
        });
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('pl-PL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };


    if (selectedQuiz) {
        return (
            <QuizChallenge 
                quiz={selectedQuiz} 
                onComplete={handleQuizComplete} 
                onBack={() => setSelectedQuiz(null)}
            />
        );
    }

    return (
        <DashboardCard title="Akademia Katedry" icon={<MortarBoardIcon />}>
            <div className="flex border-b border-cyan-500/20 mb-4 overflow-x-auto">
                {ZAKLADKI.map((z) => (
                    <button
                        key={z.id}
                        onClick={() => setActiveTab(z.id)}
                        className={`px-4 py-2 font-bold transition-colors whitespace-nowrap ${activeTab === z.id ? 'text-cyan-300 border-b-2 border-cyan-300' : 'text-slate-400 hover:text-white'}`}
                    >
                        {z.nazwa}
                    </button>
                ))}
            </div>

            <div className="space-y-4 pr-2 max-h-[calc(100vh-22rem)] overflow-y-auto">
                {activeTab === 'quizzes' && QUIZZES.map(quiz => {
                    const progress = quizProgress[quiz.id];
                    const dueDate = dueDates[quiz.id];
                    const priority = priorities[quiz.id];
                    return (
                        <div key={quiz.id} className={cn("p-4 bg-slate-800/60 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors duration-500", progress?.completed && 'bg-slate-800/80 border-slate-600')}>
                            <div className="flex-grow">
                                <div className="flex items-center gap-3">
                                    <AnimatePresence>
                                        {progress?.completed && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                                className="w-5 h-5 text-green-400 flex-shrink-0"
                                            >
                                                <FaCheckCircle />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <h4 className={cn(
                                        "text-lg font-bold transition-colors duration-500 relative",
                                        progress?.completed ? 'text-slate-500' : 'text-white'
                                    )}>
                                        {quiz.title}
                                        <AnimatePresence>
                                            {progress?.completed && (
                                                <motion.div 
                                                    className="absolute top-[55%] left-0 w-full h-[1.5px] bg-slate-500"
                                                    initial={{ scaleX: 0 }}
                                                    animate={{ scaleX: 1 }}
                                                    transition={{ duration: 0.4, ease: 'circOut', delay: 0.2 }}
                                                    style={{ transformOrigin: 'left' }}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </h4>
                                    {priority && (
                                        <span className={cn('px-2 py-0.5 text-xs font-bold uppercase rounded-full transition-opacity', priorityConfig[priority].pill, progress?.completed && 'opacity-50')}>
                                            {priorityConfig[priority].label}
                                        </span>
                                    )}
                                </div>
                                <p className={cn("text-sm text-slate-400 mt-1 transition-colors duration-500", progress?.completed && 'text-slate-600')}>{quiz.description}</p>
                                <div className={cn("flex items-center gap-2 mt-2 text-xs text-amber-300 transition-opacity", progress?.completed && 'opacity-50')}>
                                    <div className="w-4 h-4"><TrophyIcon /></div>
                                    <span>Nagroda: odznaka „{quiz.reward.value}”</span>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-col gap-3">
                                    {/* Due Date Section */}
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-5 h-5 text-slate-400 flex-shrink-0"><CalendarIcon /></div>
                                        {dueDate ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-cyan-300 font-semibold">Termin: {formatDate(dueDate)}</p>
                                                <button 
                                                    onClick={() => handleClearDueDate(quiz.id)} 
                                                    className="text-rose-400 hover:text-rose-300 text-xs font-bold underline"
                                                >
                                                    Usuń
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <button 
                                                    onClick={() => datePickerRefs.current[quiz.id]?.showPicker()} 
                                                    className="text-slate-400 hover:text-white hover:underline"
                                                >
                                                    Ustaw termin
                                                </button>
                                                <input
                                                    type="datetime-local"
                                                    ref={(el) => { datePickerRefs.current[quiz.id] = el; }}
                                                    onChange={(e) => handleSetDueDate(quiz.id, e.target.value)}
                                                    className="opacity-0 w-0 h-0 absolute"
                                                    aria-label="Ustaw termin"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {/* Priority Section */}
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-5 h-5 text-slate-400 flex-shrink-0"><FlagIcon /></div>
                                        <div className="flex items-center gap-2">
                                            {(Object.keys(priorityConfig) as Priority[]).map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => handleSetPriority(quiz.id, p)}
                                                    className={cn(
                                                        'px-3 py-1 text-xs font-semibold rounded-full border-2 transition-colors',
                                                        priority === p ? priorityConfig[p].selected : priorityConfig[p].unselected
                                                    )}
                                                >
                                                    {priorityConfig[p].label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full sm:w-auto flex-shrink-0">
                                {progress?.completed ? (
                                    <button 
                                        onClick={() => setSelectedQuiz(quiz)}
                                        className="w-full capsule-button capsule-violet py-2 px-6"
                                    >
                                        Powtórz quiz ({progress.score}%)
                                    </button>
                                ) : (
                                     <button 
                                        onClick={() => setSelectedQuiz(quiz)}
                                        className="w-full capsule-button capsule-cyan py-2 px-6"
                                    >
                                        {progress ? `Spróbuj ponownie (${progress.score}%)` : 'Rozpocznij'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {activeTab === 'tutorials' && TUTORIALS.map(tutorial => (
                    <TutorialCard key={tutorial.id} tutorial={tutorial} onOtworz={onOtworz} />
                ))}

                {activeTab === 'fundament' && <FundamentKatedry onOtworz={onOtworz} />}
                {activeTab === 'recenzje' && <RecenzjeKatedry />}
            </div>
        </DashboardCard>
    );
};
