
import React from 'react';
import { motion } from 'framer-motion';
import { AvatarForm } from '../../lib/identity/types';

const humanoidPaths = [
    "M 50 20 A 10 10 0 1 1 50 19.99 Z", // Head
    "M 45 22 A 1 1 0 1 1 45 21.99 Z", // Left eye
    "M 55 22 A 1 1 0 1 1 55 21.99 Z", // Right eye
    "M 45 32 L 55 32 L 60 60 L 40 60 Z", // Torso
    "M 40 35 L 20 50", // Left Arm
    "M 60 35 L 80 50", // Right Arm
    "M 40 60 L 30 85", // Left Leg
    "M 60 60 L 70 85", // Right Leg
];

const energyPaths = [
    "M 50 50 A 30 15 0 1 0 50 50.1 Z", // Outer ellipse 1
    "M 50 50 A 15 30 0 1 0 50 50.1 Z", // Outer ellipse 2
    "M 50 50 A 25 25 0 1 1 50 49.9 Z", // Inner circle
    "M 50 20 L 50 30", // Top spark
    "M 50 80 L 50 70", // Bottom spark
    "M 20 50 L 30 50", // Left spark
    "M 80 50 L 70 50", // Right spark
    "M 30 30 L 35 35", // Top-left spark
    "M 70 70 L 65 65", // Bottom-right spark
    "M 70 30 L 65 35", // Top-right spark
    "M 30 70 L 35 65", // Bottom-left spark
];

const constructPaths = [
    "M 50 15 L 70 35 L 70 65 L 50 85 L 30 65 L 30 35 Z", // Outer Hex
    "M 50 25 L 30 60 L 70 60 Z", // Triangle 1
    "M 50 75 L 30 40 L 70 40 Z", // Triangle 2
    "M 50 15 L 50 25", // connect top
    "M 30 35 L 30 40", // connect left-top
    "M 70 35 L 70 40", // connect right-top
    "M 30 65 L 30 60", // connect left-bottom
    "M 70 65 L 70 60", // connect right-bottom
    "M 50 85 L 50 75", // connect bottom
];


const pathVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay: i * 0.1 + 0.5, type: "spring", duration: 1.5, bounce: 0 },
      opacity: { delay: i * 0.1 + 0.5, duration: 0.01 }
    }
  }),
  exit: (i: number) => ({
    pathLength: 0,
    opacity: 0,
    transition: {
      pathLength: { delay: i * 0.05, type: "spring", duration: 0.7, bounce: 0 },
      opacity: { delay: i * 0.05, duration: 0.01 }
    }
  })
};

const svgVariants = {
  hidden: { rotate: -180, scale: 0, opacity: 0 },
  visible: {
    rotate: 0,
    scale: 1,
    opacity: 1,
    transition: { duration: 0.7, ease: 'circOut' }
  },
  exit: {
    rotate: 180,
    scale: 0,
    opacity: 0,
    transition: { duration: 0.5, ease: 'circIn' }
  }
};

const formMap = {
    humanoid: humanoidPaths,
    energy: energyPaths,
    construct: constructPaths,
};

interface DigitalSelfAvatarProps {
  form: AvatarForm;
  color: string;
  sizeClass?: string;
  customImageUrl?: string | null;
}

export const DigitalSelfAvatar: React.FC<DigitalSelfAvatarProps> = ({ form, color, sizeClass = 'w-28 h-28', customImageUrl }) => {
    const paths = formMap[form] || humanoidPaths;

    if (customImageUrl) {
        return (
            <motion.div
                className={`relative flex items-center justify-center ${sizeClass} rounded-full overflow-hidden border-2`}
                style={{ borderColor: color, boxShadow: `0 0 15px ${color}40` }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <img src={customImageUrl} alt="Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </motion.div>
        );
    }

    return (
        <motion.div
            className={`relative flex items-center justify-center ${sizeClass}`}
            variants={svgVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                <defs>
                    <filter id="hologram-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <g style={{ filter: `url(#hologram-glow) drop-shadow(0 0 6px ${color}aa)` }}>
                    {paths.map((path, i) => (
                        <motion.path
                            key={`${form}-${i}`}
                            d={path}
                            fill="none"
                            stroke={color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            variants={pathVariants}
                            custom={i}
                        />
                    ))}
                </g>
            </svg>
        </motion.div>
    );
};
