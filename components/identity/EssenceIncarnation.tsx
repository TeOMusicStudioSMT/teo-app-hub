
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAegisClient } from '../../hooks/useAegisClient';
import { useEssenceIdentity } from '../../hooks/useEssenceIdentity';
import { ResonanceColorKey, RESONANCE_THEMES } from '../../store/personalization';
import { MicIcon } from '../icons';
import { cn } from '../../lib/helpers';

interface EssenceIncarnationProps {
    username: string;
    assistantDomain: string;
    resonanceColor: ResonanceColorKey;
    onComplete: () => void;
    onFailure: () => void;
}

export const EssenceIncarnation: React.FC<EssenceIncarnationProps> = ({
    username,
    assistantDomain,
    resonanceColor,
    onComplete,
    onFailure,
}) => {
    const api = useAegisClient();
    const { refreshIdentity } = useEssenceIdentity();
    const [textIndex, setTextIndex] = useState(0);

    const theme = RESONANCE_THEMES[resonanceColor];
    const texts = [
        "Synchronizing with Graviton Fields...",
        "Incarnating Essence Companion...",
        `Welcome, ${assistantDomain}. Your Field Resonates.`,
    ];

    useEffect(() => {
        const claimAndAnimate = async () => {
            try {
                // API Call first
                await api.claimUsername({ username, assistantDomain });
                // We don't toast here; the final text serves as success feedback.

                // CRITICAL FIX: Add artificial delay to ensure user sees the animation
                // This gives the "Synchronizing / Incarnating" animation time to complete
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Start text animation
                setTimeout(() => setTextIndex(1), 1500);
                setTimeout(() => setTextIndex(2), 3500);

                // Final cleanup and callback to close the modal state
                setTimeout(() => {
                    onComplete();
                }, 5500);

            } catch (e: any) {
                toast.error(e.message || 'Failed to claim username.');
                onFailure();
            }
        };

        claimAndAnimate();
    }, []); // This effect runs only once on mount

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Animation container */}
            <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Rings */}
                <motion.div
                    className={cn("absolute w-full h-full rounded-full border-2", theme.tw.border)}
                    initial={{ scale: 3, opacity: 0.5 }}
                    animate={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 3, ease: 'easeIn' }}
                />
                <motion.div
                    className={cn("absolute w-full h-full rounded-full border", theme.tw.border)}
                    initial={{ scale: 2, opacity: 0.7 }}
                    animate={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 3, ease: 'easeIn', delay: 0.2 }}
                />

                {/* Central Capsule */}
                <motion.div
                    className={cn("absolute w-32 h-32 rounded-full", theme.tw.bg)}
                    style={{ filter: `blur(10px)` }}
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.5, delay: 3 }}
                />

                {/* Flash of Light */}
                <motion.div
                    className={cn("absolute w-full h-full rounded-full", theme.tw.bg)}
                    style={{ filter: `blur(30px) brightness(1.5)` }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 4, opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, delay: 3.2, ease: 'easeOut' }}
                />

                {/* Voice Assistant Icon Emergence */}
                <motion.div
                    className="absolute w-20 h-20 text-white"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 3.8 }}
                >
                    <MicIcon isActive={false} />
                </motion.div>
            </div>

            {/* Animated Text Area */}
            <div className="absolute bottom-1/4 h-8 text-center w-full">
                <AnimatePresence>
                    <motion.p
                        key={textIndex}
                        className="text-slate-300 text-lg tracking-wider"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5 }}
                    >
                        {texts[textIndex]}
                    </motion.p>
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
