
import React, { useEffect } from 'react';
import DashboardCard from '../DashboardCard';
import { BrainCircuitIcon } from '../icons';
import { useAtom, useAtomValue } from 'jotai';
import { assistantStateAtom, balanceModeAtom } from '../../store/assistant';
import { motion, AnimatePresence } from 'framer-motion';

const BalanceTimer = () => {
    const [balanceMode, setBalanceMode] = useAtom(balanceModeAtom);
    const { countdown, timerVisible } = balanceMode;
  
    useEffect(() => {
      if (!timerVisible) return;
  
      const interval = setInterval(() => {
        setBalanceMode(prev => {
          const newCountdown = prev.countdown - 1;
          if (newCountdown <= 0) {
            clearInterval(interval);
            // Reset state after timer finishes
            return { ...prev, timerVisible: false, countdown: 17 };
          }
          return { ...prev, countdown: newCountdown };
        });
      }, 1000);
  
      return () => clearInterval(interval);
    }, [timerVisible, setBalanceMode]);
  
    return (
      <AnimatePresence>
        {timerVisible && (
          <motion.div
            className="bg-amber-900/50 border border-amber-500/50 rounded-lg p-2 text-center mb-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <p className="text-amber-300 font-bold text-sm">Focus on a new creation...</p>
            <p className="text-2xl font-mono text-white">{countdown}</p>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };
  

export const AssistantLogCard: React.FC = () => {
    const { conversationHistory } = useAtomValue(assistantStateAtom);
    const recentHistory = conversationHistory.slice(-10);

    return (
        <DashboardCard 
            title="Resonance History / Assistant Log" 
            icon={<BrainCircuitIcon />}
        >
             <BalanceTimer />
            <div className="space-y-3 pr-2 overflow-y-auto h-full max-h-72 custom-scrollbar">
                {recentHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400 text-center py-8">No recent conversations with your Essence Companion.</p>
                    </div>
                ) : (
                    recentHistory.map((msg, index) => (
                        <div key={index} className={`p-2 rounded-lg text-sm ${
                            msg.role === 'user' ? 'bg-slate-800/50' : 'bg-slate-700/50'
                        }`}>
                            <p className={`font-bold ${msg.role === 'user' ? 'text-cyan-300' : 'text-violet-300'}`}>
                                {msg.role === 'user' ? 'You' : 'NAP'}
                            </p>
                            <p className="text-slate-200 whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                    ))
                )}
            </div>
        </DashboardCard>
    );
};