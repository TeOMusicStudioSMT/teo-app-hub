import { useSpring, animated } from '@react-spring/web';
import { useEffect, useRef, useState } from 'react';

// Uwaga: React Bits często korzysta z react-spring.
// Jeśli nie masz react-spring, zainstaluj: npm install @react-spring/web
// Jeśli wolisz Framer Motion (który mamy), możemy użyć wersji Framerowej.

// Opcja FRAMER MOTION (Bezpieczniejsza, bo już to mamy):
import { motion } from 'framer-motion';

interface SplitTextProps {
    text: string;
    className?: string;
    delay?: number;
}

export const SplitText: React.FC<SplitTextProps> = ({ text, className = "", delay = 0 }) => {
    // Rozbijamy tekst na litery
    const letters = text.split("");

    const container = {
        hidden: { opacity: 0 },
        visible: (i = 1) => ({
            opacity: 1,
            transition: { staggerChildren: 0.03, delayChildren: 0.04 * i + delay },
        }),
    };

    const child = {
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 100,
            },
        },
        hidden: {
            opacity: 0,
            y: 20,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 100,
            },
        },
    };

    return (
        <motion.div
            style={{ overflow: "hidden", display: "flex", flexWrap: "wrap" }}
            variants={container}
            initial="hidden"
            animate="visible"
            className={className}
        >
            {letters.map((letter, index) => (
                <motion.span variants={child} key={index} style={{ marginRight: letter === " " ? "0.3em" : "0" }}>
                    {letter}
                </motion.span>
            ))}
        </motion.div>
    );
};