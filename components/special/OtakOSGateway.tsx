"use client";

import { useState, useEffect } from "react";

interface OtakOSGatewayProps {
  onInitiate: () => void;
}

export default function OtakOSGateway({ onInitiate }: OtakOSGatewayProps) {
  const [isInitiating, setIsInitiating] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleInitiate = () => {
    if (isInitiating) return;
    
    setIsInitiating(true);
    
    // Delay to allow for fade-out animation
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onInitiate();
      }, 800); // Wait for fade-out to complete
    }, 500);
  };

  // Subtle pulse animation for background glow
  const [pulsePhase, setPulsePhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((prev) => (prev + 0.02) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const glowIntensity = 0.3 + Math.sin(pulsePhase) * 0.15;

  if (!isVisible) {
    return (
      <div 
        className="fixed inset-0 bg-slate-950 transition-opacity duration-800 ease-in-out opacity-0"
        style={{ pointerEvents: "none" }}
      />
    );
  }

  return (
    <div 
      className={`fixed inset-0 overflow-hidden transition-all duration-800 ease-in-out ${isInitiating ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
      style={{
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(16, 185, 129, ${glowIntensity * 0.15}) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(6, 182, 212, ${glowIntensity * 0.1}) 0%, transparent 50%),
          linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)
        `,
      }}
    >
      {/* Subtle grid overlay for tech feel */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Ambient particles */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-cyan-500/20"
          style={{
            width: Math.random() * 4 + 1,
            height: Math.random() * 4 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${Math.random() * 8 + 6}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 4}s`,
          }}
        />
      ))}

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <button
          onClick={handleInitiate}
          disabled={isInitiating}
          className={`
            group relative px-16 py-6 
            bg-slate-950/60 
            border border-slate-800/60
            rounded-full
            tracking-widest
            text-slate-300
            font-light
            text-lg
            uppercase
            transition-all duration-500
            hover:tracking-[0.6em]
            hover:border-cyan-500/50
            hover:text-cyan-100
            disabled:pointer-events-none
            before:absolute
            before:inset-0
            before:rounded-full
            before:border
            before:border-transparent
            before:transition-all
            before:duration-500
            hover:before:border-cyan-500/30
            hover:before:scale-110
            hover:before:opacity-100
            after:absolute
            after:inset-0
            after:rounded-full
            after:border
            after:border-transparent
            after:transition-all
            after:duration-500
            hover:after:border-emerald-500/20
            hover:after:scale-125
            hover:after:opacity-100
            before:opacity-0
            after:opacity-0
            hover:scale-105
            animate-pulse-slow
          `}
          style={{
            boxShadow: `
              0 0 40px rgba(16, 185, 129, 0.1),
              0 0 80px rgba(6, 182, 212, 0.05),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
          }}
        >
          {/* Inner glow on hover */}
          <span 
            className={`
              absolute inset-0 rounded-full opacity-0 transition-opacity duration-500
              group-hover:opacity-100
            `}
            style={{
              background: `
                radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, transparent 70%),
                radial-gradient(ellipse at center, rgba(6, 182, 212, 0.1) 0%, transparent 50%)
              `,
            }}
          />
          
          {/* Text with glow effect */}
          <span className="relative z-10 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)] group-hover:drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            INICJACJA OtakOS
          </span>
        </button>
      </div>

      {/* Bottom info text */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <p className="text-slate-600 text-xs tracking-[0.3em] uppercase font-light">
          System Gotowy • 0.00G • Ω
        </p>
      </div>

      {/* CSS for custom animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { 
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% { opacity: 0.8; }
          50% { 
            transform: translateY(-100px) translateX(20px);
            opacity: 0.4;
          }
          90% { opacity: 0.6; }
        }

        .animate-pulse-slow {
          animation: breathe 4s ease-in-out infinite;
        }

        @keyframes breathe {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 
              0 0 40px rgba(16, 185, 129, 0.1),
              0 0 80px rgba(6, 182, 212, 0.05),
              inset 0 1px 0 rgba(255,255,255,0.05);
          }
          50% { 
            transform: scale(1.02);
            box-shadow: 
              0 0 60px rgba(16, 185, 129, 0.15),
              0 0 100px rgba(6, 182, 212, 0.08),
              inset 0 1px 0 rgba(255,255,255,0.08);
          }
        }
      `}</style>
    </div>
  );
}
