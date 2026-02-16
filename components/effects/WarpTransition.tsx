import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WarpTransitionProps {
    isActive: boolean;
}

export const WarpTransition: React.FC<WarpTransitionProps> = ({ isActive }) => {
    return (
        <AnimatePresence>
            {isActive && (
                <motion.div
                    className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden pointer-events-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Central Light Source */}
                    <motion.div
                        className="absolute top-1/2 left-1/2 w-4 h-4 bg-white rounded-full blur-xl"
                        animate={{ scale: [1, 50] }}
                        transition={{ duration: 2, ease: "easeIn" }}
                    />

                    {/* Star Streaks */}
                    {[...Array(60)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-1/2 left-1/2 origin-center"
                            style={{
                                transform: `rotate(${Math.random() * 360}deg)`,
                                width: '2px',
                                height: '2px'
                            }}
                        >
                            <motion.div
                                className="bg-gradient-to-t from-transparent via-blue-200 to-white rounded-full"
                                style={{
                                    width: Math.random() > 0.7 ? '3px' : '1px',
                                    height: '40px', // Base length
                                }}
                                initial={{ y: 0, opacity: 0, scaleY: 0.1 }}
                                animate={{
                                    y: [-50, -1200], // Move outwards from near center to off-screen
                                    opacity: [0, 1, 0],
                                    scaleY: [1, 20, 40] // Stretch massively as they speed up
                                }}
                                transition={{
                                    duration: Math.random() * 0.5 + 0.8, // 0.8s to 1.3s
                                    ease: "easeIn",
                                    delay: Math.random() * 0.5,
                                    repeat: Infinity
                                }}
                            />
                        </div>
                    ))}

                    {/* Final Whiteout Flash */}
                    <motion.div
                        className="absolute inset-0 bg-white"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5, duration: 0.5, ease: "easeIn" }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};
