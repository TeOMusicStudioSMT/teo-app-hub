import React from 'react';
import { motion } from 'framer-motion';

interface MentorFinAvatarProps {
    isAnalyzing: boolean;
    analysisStatus: string;
    sendAndAnalyzeData: (userId: string) => Promise<void>;
}

const MentorFinAvatar: React.FC<MentorFinAvatarProps> = ({ isAnalyzing, analysisStatus, sendAndAnalyzeData }) => {

    const checkStatus = () => {
        sendAndAnalyzeData('Teonaut_001');
    };

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
                onClick={checkStatus}
                className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-2 border-cyan-500/50 cursor-pointer"
                animate={{ scale: isAnalyzing ? 1.1 : 1 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 300 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {isAnalyzing ? (
                     <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                     <span className="text-white text-4xl">🤖</span>
                )}
            </motion.div>
            <motion.div 
                className="mt-4 text-sm text-slate-400 h-10 w-full"
                key={analysisStatus} // re-trigger animation on status change
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {analysisStatus}
            </motion.div>
        </div>
    );
};

export default MentorFinAvatar;
