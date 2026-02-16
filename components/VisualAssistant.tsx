import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MicIcon } from './icons';
import toast from 'react-hot-toast';
import { GoogleGenAI, Modality } from '@google/genai';
import { useSetAtom, useAtomValue } from 'jotai';
import { generatedImageAtom } from '../store/assistant';
import { userApiKeyAtom } from '../store/settings';
import { ApiKeyModal } from './settings/ApiKeyModal';
import { cn } from '../lib/helpers';

// --- Typy dla SpeechRecognition (aby uniknąć 'any') ---
interface IWindow extends Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
}

export const VisualAssistant: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);

    // Ref do śledzenia czy komponent jest zamontowany (bezpieczeństwo async)
    const isMounted = useRef(true);
    const recognitionRef = useRef<any | null>(null);
    const setGeneratedImage = useSetAtom(generatedImageAtom);
    const apiKey = useAtomValue(userApiKeyAtom);

    // Cleanup przy odmontowaniu
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Initialize SpeechRecognition
    useEffect(() => {
        const { SpeechRecognition, webkitSpeechRecognition } = window as unknown as IWindow;
        const SpeechRecognitionConstructor = SpeechRecognition || webkitSpeechRecognition;

        if (SpeechRecognitionConstructor) {
            const recognition = new SpeechRecognitionConstructor();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                if (!isMounted.current) return;

                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                setTranscript(finalTranscript + interimTranscript);
            };

            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                if (isMounted.current) {
                    setError('Speech recognition error. Please try again.');
                    setStatus('error');
                }
            };

            recognitionRef.current = recognition;
        } else {
            setError('Speech recognition not supported in this browser.');
            setStatus('error');
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    // Setup camera stream
    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false
                });

                if (videoRef.current && isMounted.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                if (isMounted.current) {
                    setError('Camera access is required. Please enable it in your browser settings.');
                    setStatus('error');
                    toast.error('Camera access denied.');
                    setTimeout(onClose, 2000);
                }
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [onClose]);

    const captureFrameAsBase64 = useCallback((): string | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas && video.readyState >= 2) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Dodano kompresję 0.8 dla lżejszego requestu
            }
        }
        return null;
    }, []);

    const handleInteraction = async () => {
        if (status === 'idle' || status === 'error') {
            setTranscript('');
            setError('');
            try {
                // Check if recognition is already started before attempting to start
                if (recognitionRef.current) {
                    recognitionRef.current.start();
                    setStatus('listening');
                }
            } catch (e: any) {
                // Gracefully handle "already started" error
                if (e?.message?.includes('already started')) {
                    console.log('[VisualAssistant] Recognition already active, continuing...');
                    setStatus('listening');
                } else {
                    console.error('[VisualAssistant] Recognition start failed:', e);
                    setError('Could not start voice recognition. Please try again.');
                    setStatus('error');
                }
            }
        } else if (status === 'listening') {
            recognitionRef.current?.stop();
            setStatus('processing');

            const imageData = captureFrameAsBase64();
            const promptText = transcript;

            if (!imageData) {
                toast.error('Could not capture image from camera.');
                setStatus('error');
                return;
            }

            if (!promptText.trim()) {
                toast.error('Please describe what you want to create.');
                setStatus('listening'); // Wróć do słuchania
                recognitionRef.current?.start();
                return;
            }

            // Check if API key is configured
            if (!apiKey || apiKey.trim().length === 0) {
                toast.error('Neural Link not configured. Please enter your API key.');
                setApiKeyModalOpen(true);
                setStatus('idle');
                return;
            }

            const toastId = toast.loading('NAP is creating your vision...');

            try {
                const ai = new GoogleGenAI({ apiKey: apiKey });

                // Uwaga: Upewnij się, że model obsługuje generowanie obrazów (np. imagen-3.0)
                // Gemini Flash zazwyczaj zwraca tekst. Jeśli masz dostęp do modelu multimodalnego
                // zwracającego obraz, nazwa modelu musi być poprawna.
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image', // Upewnij się co do nazwy modelu! Może 'gemini-1.5-pro' lub 'imagen-3.0-generate-001'?
                    contents: {
                        parts: [
                            { inlineData: { data: imageData, mimeType: 'image/jpeg' } },
                            { text: `Create an image based on this sketch/photo with the following instruction: ${promptText}` }
                        ]
                    },
                    config: { responseModalities: [Modality.IMAGE] },
                });

                const generatedPart = response.candidates?.[0]?.content?.parts?.[0];

                if (isMounted.current) {
                    if (generatedPart?.inlineData) {
                        setGeneratedImage(generatedPart.inlineData.data);
                        toast.success('Creation successful!', { id: toastId });
                        onClose();
                    } else {
                        // Fallback jeśli model zwrócił tekst zamiast obrazu
                        console.warn("Model returned text instead of image:", response);
                        throw new Error("The model did not return an image. It might have returned a text description.");
                    }
                }

            } catch (err) {
                console.error("Gemini generation error:", err);
                if (isMounted.current) {
                    const message = err instanceof Error ? err.message : "An unknown error occurred.";
                    toast.error(`Creation failed: ${message}`, { id: toastId, duration: 4000 });
                    setStatus('error');
                    setError(`Generation failed. ${message}`);
                }
            }
        }
    };

    const statusConfig = {
        idle: { text: "Tap to Speak", color: "bg-lime-500", icon: <MicIcon isActive={false} /> },
        listening: { text: "Listening... Tap to Finish", color: "bg-rose-500", icon: <MicIcon isActive={true} /> },
        processing: { text: "Processing...", color: "bg-cyan-500", icon: <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div> },
        error: { text: "Try Again", color: "bg-amber-500", icon: <MicIcon isActive={false} /> },
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
        >
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="relative z-10 flex flex-col items-center justify-between h-full w-full p-8 text-white">
                <div className="w-full flex justify-between items-center">
                    <h2 className="text-xl font-bold tracking-widest uppercase text-lime-300 drop-shadow-[0_0_5px_rgba(163,230,53,0.7)]">
                        NAP's Vision
                    </h2>
                    <button onClick={onClose} className="text-3xl p-2 hover:text-rose-400 transition-colors">&times;</button>
                </div>

                <div className="flex-grow flex items-center justify-center max-w-2xl text-center">
                    <p className="text-2xl font-semibold drop-shadow-lg px-4">
                        {transcript || (status === 'error' ? error : "Point at an object and tell NAP what to create.")}
                    </p>
                </div>

                <div className="flex flex-col items-center pb-8">
                    <button
                        onClick={handleInteraction}
                        disabled={status === 'processing'}
                        className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 text-white shadow-lg disabled:opacity-70 disabled:cursor-not-allowed hover:scale-105 active:scale-95",
                            statusConfig[status].color
                        )}
                    >
                        {statusConfig[status].icon}
                    </button>
                    <p className="mt-4 font-semibold tracking-wide">{statusConfig[status].text}</p>
                </div>
            </div>

            {/* API Key Configuration Modal */}
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
        </motion.div>
    );
};