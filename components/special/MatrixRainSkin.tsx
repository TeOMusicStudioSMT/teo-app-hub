import React from 'react';
import { motion, useMotionValue } from 'framer-motion';

interface MatrixRainProps {
  width: number;
  colorScheme: 'cyan' | 'magenta' | 'gold';
}

const MatrixRainSkin: React.FC<MatrixRainProps> = ({ width, colorScheme }) => {
  // Używamy useMotionValue do dynamicznego generowania efektu glitchu
  const glitchX = useMotionValue(0);
  const glitchY = useMotionValue(0);

  // Definicja elementów deszczu
  const rainElements = Array.from({ length: 50 }).map((_, index) => ({
    id: index,
    // Początkowe, losowo rozmieszczone pozycje w obrębie szerokości ekranu
    x: Math.random() * width,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1, // Rozmiar cząstki
    color: colorScheme === 'cyan'
      ? 'rgba(0, 255, 255, 0.8)'
      : colorScheme === 'magenta'
      ? 'rgba(255, 0, 255, 0.8)'
      : 'rgba(255, 215, 0, 0.8)', // gold
  }));

  // Generowanie animowanych cząstek deszczu
  const rainParticles = rainElements.map(particle => {
    // Aktualizacja pozycji na podstawie animacji (glitch) oraz efektu ruchu sinusoidalnego
    const currentX = particle.x + glitchX.get();
    const currentY = particle.y + glitchY.get();

    // Dodanie subtelnego, chaotycznego ruchu
    const offsetX = Math.sin(Date.now() / 500 + particle.id) * 2;
    const offsetY = Math.cos(Date.now() / 600 + particle.id) * 2;

    return (
      <motion.div
        key={particle.id}
        className="absolute top-0 left-0 h-full w-px"
        style={{
          left: `${currentX}px`,
          top: `${currentY}px`,
          width: '1px',
          height: `${particle.size}px`,
          backgroundColor: particle.color,
          opacity: 0.7,
          boxShadow: `0 0 2px ${particle.color}`,
          // Aplikacja glitchu i ruchu
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        // Indywidualne opóźnienia dla unikalnego efektu
        transition
        duration={1}
      />
    );
  });

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {rainParticles}
    </div>
  );
};

export default MatrixRainSkin;
