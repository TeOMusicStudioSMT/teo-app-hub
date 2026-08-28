import React from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { FiLock } from 'react-icons/fi';

interface UniverseCardProps {
    title: string;
    subtitle: string;
    onClick: () => void;
    isLocked?: boolean;
    icon?: React.ReactNode;
    colorTheme?: 'purple' | 'blue' | 'cyan' | 'pink' | 'green';
}

export const UniverseCard: React.FC<UniverseCardProps> = ({
    title,
    subtitle,
    onClick,
    isLocked = false,
    icon,
    colorTheme = 'purple'
}) => {

    const handleCardClick = () => {
        if (isLocked) {
            toast.error("Module initializing... Access restricted.", {
                style: {
                    background: '#1a1a1a',
                    color: '#fff',
                    border: '1px solid #333'
                },
                icon: '🔒'
            });
            return;
        }
        onClick();
    };

    // Dynamic gradient based on theme
    const getGradient = () => {
        switch (colorTheme) {
            case 'blue': return 'from-blue-950 via-indigo-950 to-black';
            case 'cyan': return 'from-cyan-950 via-blue-950 to-black';
            case 'pink': return 'from-pink-950 via-purple-950 to-black';
            case 'green': return 'from-emerald-950 via-teal-950 to-black';
            default: return 'from-indigo-950 via-purple-950 to-black';
        }
    };

    const getGlowColor = () => {
        switch (colorTheme) {
            case 'blue': return 'bg-blue-500';
            case 'cyan': return 'bg-cyan-500';
            case 'pink': return 'bg-pink-500';
            case 'green': return 'bg-emerald-500';
            default: return 'bg-purple-500';
        }
    };

    const getTextColor = () => {
        switch (colorTheme) {
            case 'blue': return 'from-blue-200 via-white to-blue-200';
            case 'cyan': return 'from-cyan-200 via-white to-cyan-200';
            case 'pink': return 'from-pink-200 via-white to-pink-200';
            case 'green': return 'from-emerald-200 via-white to-emerald-200';
            default: return 'from-purple-200 via-white to-purple-200';
        }
    };

    return (
        <motion.div
            className={`relative w-full h-64 rounded-2xl overflow-hidden cursor-pointer group shadow-2xl ${isLocked ? 'grayscale opacity-80' : 'shadow-purple-900/20'}`}
            onClick={handleCardClick}
            whileHover={!isLocked ? { scale: 1.02 } : {}}
            whileTap={!isLocked ? { scale: 0.98 } : {}}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLocked ? 0.7 : 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Background - Deep Void / Nebula */}
            <div className="absolute inset-0 bg-black">
                {/* Base Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${getGradient()}`} />

                {/* Animated Nebula Image (Placeholder) */}
                <motion.div
                    className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2342&auto=format&fit=crop')] bg-cover bg-center opacity-60 mix-blend-screen"
                    animate={!isLocked ? {
                        scale: [1, 1.15, 1],
                        rotate: [0, 3, -3, 0],
                    } : {}}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />

                {/* Hover Speed/Glow Effect */}
                {!isLocked && (
                    <motion.div
                        className={`absolute inset-0 ${getGlowColor()} mix-blend-overlay opacity-0 group-hover:opacity-40 transition-opacity duration-700 ease-out`}
                    />
                )}

                {/* Starfield overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30" />
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6 z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center"
                >
                    {isLocked ? (
                        <div className="mb-4 p-3 bg-white/5 rounded-full backdrop-blur-sm border border-white/10">
                            <FiLock className="w-8 h-8 text-gray-400" />
                        </div>
                    ) : icon && (
                        <div className="mb-4 text-white/80 opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-110 duration-300 transform">
                            {icon}
                        </div>
                    )}

                    <h2
                        className={`text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${getTextColor()} mb-2 tracking-wider font-display`}
                        style={{ textShadow: !isLocked ? '0 0 30px rgba(168, 85, 247, 0.6)' : 'none' }}
                    >
                        {title}
                    </h2>

                    {!isLocked && <div className={`h-0.5 w-16 ${getGlowColor()}/50 mx-auto mb-3 blur-[1px]`} />}

                    <p className="text-purple-100 text-sm font-light tracking-widest uppercase text-shadow-sm max-w-[80%]">
                        {subtitle}
                    </p>
                </motion.div>
            </div>

            {/* Interactive Border */}
            <div className={`absolute inset-0 border border-white/10 ${!isLocked ? 'group-hover:border-purple-400/50' : ''} rounded-2xl transition-colors duration-500`} />
        </motion.div>
    );
};
