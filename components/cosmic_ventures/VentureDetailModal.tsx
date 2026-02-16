
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CosmicVenture } from '../../types';
import { useAtomValue } from 'jotai';
import { resonanceColorAtom, RESONANCE_THEMES } from '../../store/personalization';
import { cn } from '../../lib/helpers';

interface VentureDetailModalProps {
    venture: CosmicVenture | null;
    onClose: () => void;
}

export const VentureDetailModal: React.FC<VentureDetailModalProps> = ({ venture, onClose }) => {
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    if (!venture) return null;

    const progressPercentage = (venture.currentGRV / venture.goalGRV) * 100;

    return (
        <AnimatePresence>
            {venture && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="claim-modal-container max-w-4xl w-full h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="relative h-64 w-full flex-shrink-0">
                            <img src={venture.imageUrl} alt={venture.name} className="w-full h-full object-cover rounded-t-3xl" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent" />
                            <h2 className="absolute bottom-6 left-8 text-4xl font-bold text-white drop-shadow-lg">{venture.name}</h2>
                            <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 bg-black/30 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </header>

                        <div className="p-8 flex-grow overflow-y-auto space-y-8">
                            {/* Funding Progress */}
                            <div>
                                <h3 className="text-xl font-semibold text-white mb-3">Funding Progress</h3>
                                <div className="flex justify-between items-end mb-1 text-sm">
                                    <span className="text-slate-300 font-semibold">{venture.currentGRV.toLocaleString()} / {venture.goalGRV.toLocaleString()} GRV</span>
                                    <span className={cn("font-bold", theme.tw.text)}>{progressPercentage.toFixed(2)}%</span>
                                </div>
                                <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                                    <div
                                        className={cn("h-2.5 rounded-full", theme.tw.bg)}
                                        style={{ width: `${progressPercentage}%`, transition: 'width 0.5s ease-in-out' }}
                                    ></div>
                                </div>
                            </div>

                            {/* About Section */}
                            {venture.detailedDescription && (
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-3">About This Venture</h3>
                                    <p className="text-slate-300 whitespace-pre-line">{venture.detailedDescription}</p>
                                </div>
                            )}

                            {/* Gallery Section */}
                            {venture.gallery && venture.gallery.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-3">Gallery</h3>
                                    <div className="flex gap-4 overflow-x-auto pb-3 -mx-8 px-8">
                                        {venture.gallery.map((item, index) => (
                                            <div key={index} className="flex-shrink-0 w-64 bg-slate-800/60 rounded-lg overflow-hidden border border-slate-700">
                                                <img src={item.url} alt={item.title} className="w-full h-32 object-cover" />
                                                <p className="text-xs p-2 text-slate-300">{item.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Downloads Section */}
                            {venture.downloads && venture.downloads.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-3">Downloads</h3>
                                    <div className="flex flex-col gap-2">
                                        {venture.downloads.map((doc, index) => (
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer" key={index} className="bg-slate-800/60 hover:bg-slate-700/80 p-3 rounded-md text-slate-300 hover:text-white transition-colors duration-200">
                                                {doc.name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-slate-700/50 pt-6 text-center">
                                <button className="capsule-button capsule-cyan text-lg py-3 px-8">
                                    Contribute GRAV to {venture.name}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};