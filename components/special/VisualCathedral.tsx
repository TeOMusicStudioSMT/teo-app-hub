/**
 * 🏛️ VisualCathedral.tsx - Wizualna Katedra Wniosków (Status: Krystalizacja)
 * 
 * "Przestrzeń przygotowywana pod integrację z Genie 3 World Models. Trwa krystalizacja..."
 */

import React from 'react';
import { motion } from 'framer-motion';

interface VisualCathedralProps {
  isActive?: boolean;
  onClose?: () => void;
}

const VisualCathedral: React.FC<VisualCathedralProps> = ({ isActive = false, onClose }) => {
  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      style={{
        position: 'relative',
        width: '100%',
        height: '450px',
        background: 'radial-gradient(circle at center, rgba(15, 23, 42, 1) 0%, rgba(2, 6, 23, 1) 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 50px rgba(0,0,0,0.9), inset 0 0 100px rgba(251, 191, 36, 0.05)',
      }}
    >
      {/* Background Glow */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        zIndex: 1
      }} />

      {/* Main Content */}
      <div style={{ zIndex: 10, textAlign: 'center', padding: '40px' }}>
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
            boxShadow: ['0 0 20px rgba(25, 158, 11, 0.2)', '0 0 60px rgba(251, 191, 36, 0.4)', '0 0 20px rgba(25, 158, 11, 0.2)']
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '2px solid #fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            margin: '0 auto 30px'
          }}
        >
          🌀
        </motion.div>

        <h2 style={{
          color: '#fbbf24',
          fontSize: '22px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          marginBottom: '15px',
          fontFamily: 'Georgia, serif',
          textShadow: '0 0 15px rgba(251, 191, 36, 0.5)'
        }}>
          KRYSTALIZACJA KATEDRY
        </h2>

        <p style={{
          color: '#94a3b8',
          fontSize: '14px',
          fontStyle: 'italic',
          lineHeight: '1.6',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          "Przestrzeń przygotowywana pod integrację z Genie 3 World Models. <br />
          Trwa krystalizacja pierwotnych wniosków wibracyjnych..."
        </p>

        <div style={{
          marginTop: '30px',
          display: 'flex',
          gap: '10px',
          justifyContent: 'center'
        }}>
          <div className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></div>
          <div className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', animationDelay: '0.2s' }}></div>
          <div className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', animationDelay: '0.4s' }}></div>
        </div>
      </div>

      {/* Decorative corners */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', width: '20px', height: '2px', background: '#fbbf2433' }}></div>
      <div style={{ position: 'absolute', top: '20px', left: '20px', width: '2px', height: '20px', background: '#fbbf2433' }}></div>
      <div style={{ position: 'absolute', top: '20px', right: '20px', width: '20px', height: '2px', background: '#fbbf2433' }}></div>
      <div style={{ position: 'absolute', top: '20px', right: '20px', width: '2px', height: '20px', background: '#fbbf2433' }}></div>
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '20px', height: '2px', background: '#fbbf2433' }}></div>
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '2px', height: '20px', background: '#fbbf2433' }}></div>
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '20px', height: '2px', background: '#fbbf2433' }}></div>
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '2px', height: '20px', background: '#fbbf2433' }}></div>

      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '25px',
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '12px',
            zIndex: 100
          }}
        >
          [ZAMKNIJ]
        </button>
      )}
    </motion.div>
  );
};

export default VisualCathedral;
