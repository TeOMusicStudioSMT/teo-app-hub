import React from 'react';
import { motion, useMotionValue, useAnimation } from 'framer-motion';

// Definicja typu dla pojedynczego paska
interface EqualizerBarProps {
  index: number;
  initialHeight: number;
  color: string;
}

// Konfiguracja dla poszczególnych pasków
const barData: EqualizerBarProps[] = Array.from({ length: 10 }, (_, i) => ({
  index: i,
  // Losowa początkowa wysokość w procentach (aby stworzyć dynamiczny efekt)
  initialHeight: Math.random() * 80 + 10, // Od 10% do 90%
  color: i % 2 === 0 ? '#FF00FF' : '#00FFFF', // Fuksja (magenta) i Cyjan
}));

const QuantumEqualizer: React.FC = () => {
  // Używamy useMotionValue do zarządzania dynamicznymi wartościami animacji
  const barHeights = barData.map(data => useMotionValue(data.initialHeight));
  const animations = [];

  // Generowanie unikalnych animacji dla każdego paska
  barData.forEach((data, index) => {
    // Definiujemy animację, która płynnie zmienia wysokość w nieskończonej pętli
    const heightAnimation = {
      transition: {
        duration: 3,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: 'loop' as const,
      },
    };
    animations.push(
      <motion.div
        key={index}
        style={{
          height: `${barHeights[index].get()}%`,
          backgroundColor: barData[index].color,
          borderRadius: '2px',
          margin: '5px 0',
          width: '40px', // Stała szerokość paska
          boxShadow: `0 0 15px ${barData[index].color}`, // Neonowy efekt
          transformOrigin: 'bottom',
        }}
        animate={{
          y: [0, 300], // Animujemy przesunięcie Y
        }}
        transition={heightAnimation.transition}
      />
    );
  });

  return (
    <div
      style={{
        width: '400px',
        height: '1080px',
        backgroundColor: 'rgba(10, 5, 10, 0.85)', // Półprzezroczyste tło
        padding: '20px',
        boxSizing: 'border-box',
        fontFamily: 'monospace', // Cyberpunkowy font
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Górny napis - świecący efekt */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00FFFF',
          textShadow: '0 0 5px #00FFFF, 0 0 10px #00FFFF',
          fontSize: '24px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          textTransform: 'uppercase',
        }}
      >
        [ AUDIO TELEMETRY ]
      </div>

      {/* Pionowy Equalizer */}
      {animations}
    </div>
  );
};

export default QuantumEqualizer;