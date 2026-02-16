import React, { useState } from 'react';
import { Quiz, QuizQuestion } from '../../types';
import { TrophyIcon, FaCheckCircle, FaExclamationCircle } from '../icons';
import { cn } from '../../lib/helpers';

interface QuizChallengeProps {
    quiz: Quiz;
    onComplete: (quizId: string, score: number, reward: string) => void;
    onBack: () => void;
}

export const QuizChallenge: React.FC<QuizChallengeProps> = ({ quiz, onComplete, onBack }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);

    const currentQuestion = quiz.questions[currentQuestionIndex];
    const totalQuestions = quiz.questions.length;

    const handleSelectAnswer = (answer: string) => {
        if (isFinished) return;
        setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));
    };

    const handleNext = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        let correctAnswers = 0;
        quiz.questions.forEach((q, index) => {
            if (selectedAnswers[index] === q.correctAnswer) {
                correctAnswers++;
            }
        });
        const finalScore = Math.round((correctAnswers / totalQuestions) * 100);
        setScore(finalScore);
        setIsFinished(true);
    };

    if (isFinished) {
        return (
            <div className="p-6 bg-slate-900/80 backdrop-blur-md rounded-lg border border-cyan-500/20 text-center animate-[fade-in_0.5s]">
                <div className="w-16 h-16 mx-auto text-amber-300 mb-4">
                    <TrophyIcon />
                </div>
                <h2 className="text-2xl font-bold text-white">Challenge Complete!</h2>
                <p className="text-slate-400 mb-6">You have completed the "{quiz.title}" quiz.</p>
                <p className="text-6xl font-bold text-cyan-300 drop-shadow-[0_0_8px_rgba(0,255,255,0.7)]">{score}%</p>
                <p className="text-slate-300">Your Score</p>
                
                <div className="my-6 space-y-2 text-left max-w-lg mx-auto">
                    {quiz.questions.map((q, i) => (
                        <div key={i} className={`p-2 rounded-md text-sm ${selectedAnswers[i] === q.correctAnswer ? 'bg-green-900/50' : 'bg-rose-900/50'}`}>
                           {selectedAnswers[i] === q.correctAnswer ? (
                               <FaCheckCircle className="inline w-4 h-4 mr-2 text-green-400" />
                           ) : (
                               <FaExclamationCircle className="inline w-4 h-4 mr-2 text-rose-400" />
                           )}
                            {i+1}. {q.question} - Correct: <strong>{q.correctAnswer}</strong>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={() => onComplete(quiz.id, score, quiz.reward.value)}
                    className="capsule-button capsule-green py-3 px-8 text-lg"
                >
                    Claim Reward & Exit
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 bg-slate-900/80 backdrop-blur-md rounded-lg border border-cyan-500/20">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-xl font-bold text-cyan-300">{quiz.title}</h3>
                    <p className="text-slate-400">Question {currentQuestionIndex + 1} of {totalQuestions}</p>
                </div>
                <button onClick={onBack} className="text-slate-400 hover:text-white">&times; Close</button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-700 rounded-full h-2 mb-6">
                <div 
                    className="bg-cyan-400 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                ></div>
            </div>

            {/* Question */}
            <div className="min-h-[6rem]">
                 <p className="text-lg text-white font-semibold">{currentQuestion.question}</p>
            </div>

            {/* Options */}
            <div className="my-6 space-y-3">
                {currentQuestion.options.map(option => (
                    <button
                        key={option}
                        onClick={() => handleSelectAnswer(option)}
                        className={cn(
                            'w-full text-left p-4 rounded-lg border-2 transition-all duration-200 font-semibold',
                            selectedAnswers[currentQuestionIndex] === option
                                ? 'bg-cyan-500/30 border-cyan-400 text-white'
                                : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-cyan-500'
                        )}
                    >
                        {option}
                    </button>
                ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-end">
                <button
                    onClick={handleNext}
                    disabled={!selectedAnswers[currentQuestionIndex]}
                    className="capsule-button capsule-cyan py-2 px-8"
                >
                    {currentQuestionIndex < totalQuestions - 1 ? 'Next' : 'Submit Answers'}
                </button>
            </div>
        </div>
    );
};