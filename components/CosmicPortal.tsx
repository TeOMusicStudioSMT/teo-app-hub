import React, { useState, useEffect, useRef } from 'react';
import EventHorizon from './EventHorizon';
import { EssenceCenter } from './identity/EssenceCenter';
import { VoiceAssistant } from './VoiceAssistant';
import { VisualAssistantButton } from './VisualAssistantButton';

interface CosmicPortalProps {
    onLoginRequest: () => void;
    onEmailLogin?: (email: string, password: string) => void;
    onEmailSignup?: (email: string, password: string) => void;
    onWalletLogin?: () => void;
    isAuthenticated?: boolean;
    onVisualAssistantOpen?: () => void;
    onSovereignEnter?: () => void;
}

const CosmicPortal: React.FC<CosmicPortalProps> = ({ onLoginRequest, onEmailLogin, onEmailSignup, onWalletLogin, isAuthenticated, onVisualAssistantOpen, onSovereignEnter }) => {
    const [time, setTime] = useState(0);
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        const animate = () => {
            setTime(prevTime => prevTime + 0.0005);
            frameRef.current = requestAnimationFrame(animate);
        };
        frameRef.current = requestAnimationFrame(animate);
        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, []);

    // For VoiceAssistant orbit
    const orbitRadius = 150; // px
    const angle = time * 2.5; // Controls speed
    const voiceX = Math.cos(angle) * orbitRadius;
    const voiceY = Math.sin(angle) * orbitRadius;
    const voiceAssistantStyle = {
        transform: `translate(${voiceX}px, ${voiceY}px)`,
    };

    // For VisualAssistant orbit (opposite side)
    const visualX = Math.cos(angle + Math.PI) * orbitRadius;
    const visualY = Math.sin(angle + Math.PI) * orbitRadius;
    const visualAssistantStyle = {
        transform: `translate(${visualX}px, ${visualY}px)`,
    };

    return (
        <div className="w-full h-full relative flex flex-col items-center justify-center p-4">
            <div className="w-full h-full flex items-center justify-center absolute top-0 left-0 transition-all duration-500">
                {isAuthenticated ? <EssenceCenter /> : <EventHorizon onLoginRequest={onLoginRequest} onEmailLogin={onEmailLogin} onEmailSignup={onEmailSignup} onWalletLogin={onWalletLogin} onSovereignEnter={onSovereignEnter} />}

                {/* The orbiting assistants, only visible when authenticated */}
                {isAuthenticated && (
                    <>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={voiceAssistantStyle}>
                            <VoiceAssistant />
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={visualAssistantStyle}>
                            <VisualAssistantButton onClick={onVisualAssistantOpen!} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CosmicPortal;