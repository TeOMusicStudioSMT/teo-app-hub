import React from 'react';
import { motion } from 'framer-motion';

export const QuantumCoreLink: React.FC = () => {
    return (
        <div className="relative w-5 h-5" title="Connected to GRAVITON Superposition">
            <motion.div
                className="absolute inset-0 rounded-full border border-amber-400/50"
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                }}
                transition={{
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                }}
            />
            <motion.div
                className="absolute inset-1 rounded-full bg-amber-400"
                 animate={{
                    scale: [0.8, 1, 0.8],
                }}
                transition={{
                    duration: 1.25,
                    ease: "easeInOut",
                    repeat: Infinity,
                }}
            />
        </div>
    );
};
