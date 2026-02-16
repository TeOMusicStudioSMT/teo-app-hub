
import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { GoogleGenAI } from '@google/genai';
import toast from 'react-hot-toast';
import { MarketView } from './MarketView';

interface ProjectModalProps {
    project: Project | null;
    isVisible: boolean;
    onLoginRequest: () => void;
    onClose: () => void;
    ai: GoogleGenAI | null;
}

const colorMap: { [key: string]: { border: string, text: string, shadow: string } } = {
    cyan: { border: 'border-cyan-400/50', text: 'text-cyan-300', shadow: 'shadow-cyan-400/20' },
    fuchsia: { border: 'border-fuchsia-400/50', text: 'text-fuchsia-300', shadow: 'shadow-fuchsia-400/20' },
    amber: { border: 'border-amber-400/50', text: 'text-amber-300', shadow: 'shadow-amber-400/20' },
    lime: { border: 'border-lime-400/50', text: 'text-lime-300', shadow: 'shadow-lime-400/20' },
    rose: { border: 'border-rose-400/50', text: 'text-rose-300', shadow: 'shadow-rose-400/20' },
    violet: { border: 'border-violet-400/50', text: 'text-violet-300', shadow: 'shadow-violet-400/20' },
    sky: { border: 'border-sky-400/50', text: 'text-sky-300', shadow: 'shadow-sky-400/20' },
    green: { border: 'border-green-400/50', text: 'text-green-300', shadow: 'shadow-green-400/20' },
};


const ProjectModal: React.FC<ProjectModalProps> = ({ project, isVisible, onLoginRequest, onClose, ai }) => {
    const [isAccessing, setIsAccessing] = useState(false);
    const [accessGranted, setAccessGranted] = useState(false);
    const [narratorLoading, setNarratorLoading] = useState(false);
    const [narratorText, setNarratorText] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    
    const colors = colorMap[project?.color || 'cyan'];
    const requiresSubscription = project ? !project.isSubscribed : false;
    
    const animationClass = isVisible && project ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none';

    useEffect(() => {
        if (!isVisible) {
            // Reset state when panel is closed
            const timer = setTimeout(() => {
                setIsAccessing(false);
                setAccessGranted(false);
                setNarratorLoading(false);
                setNarratorText(null);
                setIsSpeaking(false);
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

     useEffect(() => {
        // Cleanup speech synthesis on component unmount
        return () => {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const handleEnterLibrary = () => {
        setIsAccessing(true);
        setAccessGranted(false);
        setTimeout(() => { // Linking duration
            setAccessGranted(true);
            setTimeout(() => { // Success message duration
                onClose();
            }, 2000); 
        }, 3000);
    };

    const handleNarrator = async () => {
        if (!ai || !project) return;

        if (isSpeaking) {
             window.speechSynthesis.cancel();
             setIsSpeaking(false);
             if(utteranceRef.current) {
                utteranceRef.current.onend = null;
             }
             return;
        }

        setNarratorLoading(true);
        setNarratorText(null);
        toast.loading('VISeL AI is crafting a story...', { id: 'narrator-toast' });
        
        try {
            const prompt = `You are a mystical storyteller. Based on the following project, generate a short, immersive, and imaginative narrative intro (about 50 words). Project name: "${project.name}". Description: "${project.description}".`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            
            const text = response.text;
            setNarratorText(text);
            toast.success('Narrator activated! Beginning transmission.', { id: 'narrator-toast' });

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.pitch = 1.1;
            utterance.rate = 1;
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => {
                setIsSpeaking(false);
                utteranceRef.current = null;
            };
            utteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);

        } catch (error) {
            console.error("Error generating narration:", error);
            toast.error('Narration failed. Quantum interference.', { id: 'narrator-toast' });
            setNarratorText("Narration failed due to quantum interference. Please try again later.");
        } finally {
            setNarratorLoading(false);
        }
    };

    const renderProjectDetails = () => (
        <div className="p-6 overflow-y-auto h-full flex flex-col gap-6 pt-16">
            <header>
                <div className={`w-16 h-16 mb-4 ${colors.text}`}>{project.icon}</div>
                <h3 className={`text-3xl font-bold ${colors.text}`}>{project.name}</h3>
                <p className="text-slate-400">Holographic Protocol Briefing</p>
            </header>

            <p className="text-slate-300 flex-shrink-0">{project.description}</p>
            
            {project.media && project.media.length > 0 && (
                <section>
                    <h4 className="font-semibold text-white mb-3">Media Gallery</h4>
                    <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6">
                        {project.media.map((item, index) => (
                            <div key={index} className="flex-shrink-0 w-48 bg-black/40 rounded-lg overflow-hidden border border-slate-700">
                                <img src={item.url} alt={item.title} className="w-full h-24 object-cover" />
                                <p className="text-xs p-2 text-slate-300">{item.title}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {(project.documents && project.documents.length > 0) && (
                <section>
                    <h4 className="font-semibold text-white mb-3">Project Documents</h4>
                    <div className="flex flex-col gap-2">
                        {project.documents.map((doc, index) => (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" key={index} className="bg-slate-800/60 hover:bg-slate-700/80 p-3 rounded-md text-slate-300 hover:text-white transition-colors duration-200">
                                {doc.title}
                            </a>
                        ))}
                    </div>
                </section>
            )}
            
            {(project.docs && project.docs.length > 0) && (
                <section>
                    <h4 className="font-semibold text-white mb-3">Technical Documentation</h4>
                    <div className="flex flex-col gap-2">
                        {project.docs.map((doc, index) => (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" key={index} className="bg-slate-800/60 hover:bg-slate-700/80 p-3 rounded-md text-slate-300 hover:text-white transition-colors duration-200">
                                {doc.name}
                            </a>
                        ))}
                    </div>
                </section>
            )}

            <footer className="mt-auto border-t border-slate-700/50 pt-6">
                {project.id === 'teostory.studio' ? (
                    <>
                        <h4 className="text-lg font-semibold text-white mb-2">Magic Library Access</h4>
                        {project.isSubscribed ? (
                            <div className="p-4 bg-green-900/30 border border-green-500/30 rounded-2xl text-center">
                                <p className="text-green-400">Status: Subscription Active</p>
                                <button 
                                    onClick={handleEnterLibrary}
                                    disabled={isAccessing}
                                    className="mt-4 w-full capsule-button capsule-lime py-3"
                                >
                                    Enter Magic Library
                                </button>

                                {project.narratorAvailable && (
                                    <div className="mt-4 pt-4 border-t border-lime-500/20">
                                        {narratorText && (
                                            <p className="text-sm text-lime-200/90 mb-4 italic p-3 bg-black/20 rounded-md animate-[fade-in_0.5s]">
                                                {narratorText}
                                            </p>
                                        )}
                                        <button
                                            onClick={handleNarrator}
                                            disabled={!ai || narratorLoading}
                                            className={`w-full relative capsule-button py-3 ${
                                                isSpeaking ? 'capsule-rose' : 'capsule-violet'
                                            }`}
                                        >
                                            {narratorLoading && <span className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                                            {narratorLoading ? 'Generating...' : isSpeaking ? 'Stop Narration' : 'Activate AI Narrator'}
                                        </button>
                                        {!ai && <p className="text-xs text-amber-400 mt-2">AI Engine offline.</p>}
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div className="p-4 bg-amber-900/40 border border-amber-500/30 rounded-2xl text-center">
                                <p className="text-amber-300">Subscription Required</p>
                                <p className="text-sm text-slate-400 mt-1">Activate subscription in the TeOnaut Lounge to access the Magic Library.</p>
                                <button
                                    onClick={onLoginRequest}
                                    className="mt-4 w-full capsule-button capsule-cyan py-3"
                                >
                                    Enter TeOnaut Lounge
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                        <>
                        <h4 className="text-lg font-semibold text-white mb-2">Access Status</h4>
                        {requiresSubscription ? (
                            <div className="p-4 bg-amber-900/40 border border-amber-500/30 rounded-2xl text-center">
                                <p className="text-amber-300">Subscription Required</p>
                                <p className="text-sm text-slate-400 mt-1">Enter the Lounge to manage subscriptions.</p>
                            </div>
                        ) : (
                            <div className="p-4 bg-green-900/30 border border-green-500/30 rounded-2xl text-center">
                                <p className="text-green-400">Core Service: Access Granted</p>
                            </div>
                        )}
                        <button
                            onClick={onLoginRequest}
                            className="mt-4 w-full capsule-button capsule-cyan py-3"
                        >
                            Enter TeOnaut Lounge
                        </button>
                    </>
                )}
            </footer>
        </div>
    );


    return (
        <div 
            className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-900/50 backdrop-blur-xl border-l-2 ${colors.border} shadow-2xl ${colors.shadow} rounded-l-3xl transition-all duration-500 ease-in-out transform ${animationClass} z-40 flex flex-col`}
            aria-hidden={!isVisible}
        >
             <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-50 p-2"
                aria-label="Close panel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            
            {project && (project.id === 'teo.market' ? <MarketView project={project} /> : renderProjectDetails())}
            
            {isAccessing && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-[fade-in_0.5s_ease-out] p-4 text-center">
                    {!accessGranted ? (
                        <>
                           <div className="relative w-40 h-40 mb-4">
                                <div className={`absolute inset-0 flex items-center justify-center text-5xl ${colors.text} animate-[pulse-ring_2s_ease-in-out_infinite]`}>{project?.icon}</div>
                                <svg className="w-full h-full animate-[spin_3s_linear_infinite]" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-lime-500/30" />
                                    <circle
                                        cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.5"
                                        className="text-lime-400 animate-[progress-ring_3s_ease-out_forwards]"
                                        strokeDasharray="301.59" strokeDashoffset="301.59" strokeLinecap="round"
                                        transform="rotate(-90 50 50)"
                                    />
                                     <circle
                                        cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="1"
                                        className="text-lime-400/80 origin-center animate-[pulse-ring_2s_ease-in-out_infinite]"
                                        style={{ animationDelay: '0.5s' }}
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lime-300 text-xl font-bold mb-2 uppercase tracking-widest animate-pulse">Establishing quantum link...</h3>
                            <p className="text-slate-400">VISeL Ai: Verifying subscription...</p>
                        </>
                    ) : (
                        <div className="animate-[scale-in_0.5s_ease-out]">
                            <div className="relative w-40 h-40 mb-4 flex items-center justify-center">
                                 <svg className="w-24 h-24 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path
                                        className="animate-[checkmark-draw_0.7s_ease-out_forwards]"
                                        strokeLinecap="round" strokeLinejoin="round"
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        pathLength="1" strokeDasharray="1" strokeDashoffset="1"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lime-300 text-2xl font-bold mb-2 uppercase tracking-widest">Access Granted!</h3>
                            <p className="text-slate-400">Welcome to the Magic Library.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProjectModal;
