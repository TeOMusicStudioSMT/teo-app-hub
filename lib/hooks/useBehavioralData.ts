import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

type MouseMovement = { x: number; y: number; timestamp: number };

export const useBehavioralData = () => {
    const [mouseMovements, setMouseMovements] = useState<MouseMovement[]>([]);
    const [keystrokes, setKeystrokes] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState("Click to check behavioral status");
    const isEnabled = useRef(false);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isEnabled.current) return;
        setMouseMovements(prev => [...prev.slice(-200), { x: e.clientX, y: e.clientY, timestamp: Date.now() }]); // Keep last 200 movements
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isEnabled.current) return;
        setKeystrokes(prev => (prev + e.key).slice(-100)); // Keep last 100 keystrokes
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown, handleMouseMove]);

    const sendAndAnalyzeData = async (userId: string) => {
        if (isAnalyzing || !isEnabled.current) return;

        setIsAnalyzing(true);
        setAnalysisStatus("Analyzing behavioral data...");
        toast.loading('Analyzing behavioral data...', { id: 'behavioral-toast' });

        // In a real app, you would format this data and send it.
        // For now, we mock the call as in MentorFinAvatar.
        console.log(`Sending behavioral data for ${userId}:`, { mouseMovements, keystrokes });
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const anomaly_score = Math.random();
            const is_anomaly = anomaly_score > 0.8;
            
            if (is_anomaly) {
                setAnalysisStatus(`⚠️ Anomaly detected! Score: ${anomaly_score.toFixed(2)}`);
                toast.error(`High-risk behavioral anomaly detected!`, { id: 'behavioral-toast' });
            } else {
                setAnalysisStatus(`Systems stable. Score: ${anomaly_score.toFixed(2)}`);
                toast.success('Behavioral patterns are within normal parameters.', { id: 'behavioral-toast' });
            }
            // Reset data after sending
            setMouseMovements([]);
            setKeystrokes('');
        } catch (error) {
            setAnalysisStatus("Connection error with AI module.");
            toast.error("Could not connect to the behavioral AI module.", { id: 'behavioral-toast' });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const enable = () => { isEnabled.current = true; };
    const disable = () => { 
        isEnabled.current = false;
        setMouseMovements([]);
        setKeystrokes('');
    };
  
    return { isAnalyzing, analysisStatus, sendAndAnalyzeData, enable, disable };
};
