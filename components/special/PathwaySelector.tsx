/**
 * 🌀 PathwaySelector.tsx - Wybór Ścieżki Suwerena
 * 
 * "Duch czy Materia? Wybierz swoją drogę."
 * 
 * Ekran startowy z dwoma artystycznymi przyciskami:
 * - Ścieżka Ducha (Mistycyzm, Import, Kibel)
 * - Ścieżka Materii (HardwareID, Vault, Suwerenność)
 * 
 * @version 1.0.0
 * @author BoB
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeVault, generateHardwareID, verifySessionIntegrity } from '../../lib/VaultStorage';
import { logWniosek } from '../../lib/memory/CityMemory';

interface PathwaySelectorProps {
  onSelectPath: (path: 'duch' | 'materia') => void;
}

const PathwaySelector: React.FC<PathwaySelectorProps> = ({ onSelectPath }) => {
  const [selected, setSelected] = useState<'duch' | 'materia' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSelect = async (path: 'duch' | 'materia') => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setSelected(path);

    // Logowanie wyboru
    logWniosek({
      typ: 'SCIEZKA',
      tytul: `Wybór ścieżki: ${path === 'duch' ? 'Duch' : 'Materia'}`,
      status: 'aktywny',
      tags: ['pathway', path],
    });

    // Czekaj na animację dymu
    setTimeout(() => {
      setIsAnimating(false);
      onSelectPath(path);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Tło - mgławica */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Tytuł */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 text-center mb-16"
      >
        <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 mb-4">
          WYBIERZ ŚCIEŻKĘ
        </h1>
        <p className="text-slate-400 text-xl md:text-2xl font-light">
          Twoja podróż jako Suwerena rozpoczyna się tutaj
        </p>
      </motion.div>

      {/* Przyciski ścieżek */}
      <div className="relative z-10 flex flex-col md:flex-row gap-8 md:gap-16">
        {/* ŚCIEŻKA DUCHA */}
        <PathwayCard
          type="duch"
          title="ŚCIEŻKA DUCHA"
          description="Mistycyzm • Import kluczy • Tradycyjny Kibel"
          icon={
            <svg className="w-20 h-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
            </svg>
          }
          gradient="from-violet-600 to-purple-800"
          glowColor="violet"
          isSelected={selected === 'duch'}
          isAnimating={isAnimating}
          onClick={() => handleSelect('duch')}
        />

        {/* ŚCIEŻKA MATERII */}
        <PathwayCard
          type="materia"
          title="ŚCIEŻKA MATERII"
          description="Suwerenność • Szyfrowanie • Kwantowa Kotwica"
          icon={
            <svg className="w-20 h-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          gradient="from-amber-600 to-orange-800"
          glowColor="amber"
          isSelected={selected === 'materia'}
          isAnimating={isAnimating}
          onClick={() => handleSelect('materia')}
        />
      </div>

      {/* Dymny efekt przy wyborze */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Złoty dym dla Ducha */}
            {selected === 'duch' && (
              <>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 3, opacity: [0, 0.8, 0] }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full blur-3xl"
                />
                <motion.div
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: -100, opacity: [0, 1, 0] }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="absolute bottom-1/4 left-1/2 -translate-x-1/2 text-4xl"
                >
                  🌙
                </motion.div>
              </>
            )}

            {/* Bursztynowy dym dla Materii */}
            {selected === 'materia' && (
              <>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 3, opacity: [0, 0.8, 0] }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur-3xl"
                />
                <motion.div
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: -100, opacity: [0, 1, 0] }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="absolute bottom-1/4 left-1/2 -translate-x-1/2 text-4xl"
                >
                  💎
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wskazówka */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="relative z-10 mt-16 text-slate-500 text-sm"
      >
        ⚡ Wybierz mądrze - każda ścieżka prowadzi do innej formy suwerenności
      </motion.p>
    </div>
  );
};

// Komponent karty ścieżki
interface PathwayCardProps {
  type: 'duch' | 'materia';
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: 'violet' | 'amber';
  isSelected: boolean;
  isAnimating: boolean;
  onClick: () => void;
}

const PathwayCard: React.FC<PathwayCardProps> = ({
  title,
  description,
  icon,
  gradient,
  glowColor,
  isSelected,
  isAnimating,
  onClick,
}) => {
  const glowColors = {
    violet: 'shadow-violet-500/50',
    amber: 'shadow-amber-500/50',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={isAnimating}
      className={`
        relative group p-8 md:p-12 rounded-3xl 
        bg-gradient-to-br ${gradient}
        border-2 border-slate-700/50
        transition-all duration-500
        ${isSelected ? 'scale-105' : ''}
        hover:border-slate-500
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      style={{
        boxShadow: isSelected ? `0 0 60px var(--${glowColor}-500/30)` : undefined,
      }}
    >
      {/* Inner glow */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Ikona */}
      <div className="text-white mb-6 flex justify-center">
        {icon}
      </div>

      {/* Tytuł */}
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center">
        {title}
      </h2>

      {/* Opis */}
      <p className="text-slate-300 text-center text-sm md:text-base">
        {description}
      </p>

      {/* Wybrany indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-4 -right-4 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg"
        >
          ✓
        </motion.div>
      )}
    </motion.button>
  );
};

export default PathwaySelector;
