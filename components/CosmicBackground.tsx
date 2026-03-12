import React, { useRef, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { assistantStateAtom } from '../store/assistant';
import { cn } from '../lib/helpers';
import { resonanceColorAtom, pulseIntensityAtom } from '../store/personalization';
import { walletAtom } from '../store/wallet';
import { useKatedraRadio } from '../context/KatedraRadioContext';
import { KatedraOrbita } from './KatedraOrbita';

interface CosmicBackgroundProps {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const CosmicBackground: React.FC<CosmicBackgroundProps> = ({ riskLevel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gradientRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [assistantState] = useAtom(assistantStateAtom);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const pulseIntensityValue = useAtomValue(pulseIntensityAtom);
    const { frequencyTier } = useAtomValue(walletAtom);
    const radio = useKatedraRadio();


    const riskClass = `risk-${riskLevel.toLowerCase()}`;
    const assistantClass = `assistant-${assistantState.status}`;
    const resonanceClass = `resonance-${resonanceColor}`;
    const pulseIntensityMap = ['slow', 'medium', 'dynamic'];
    const pulseClass = `pulse-${pulseIntensityMap[pulseIntensityValue]}`;
    const tierClass = `tier-${frequencyTier.toLowerCase()}`;



    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let animationFrameId: number;
        let particles: any[] = [];
        const numParticles = 150; 

        const resizeCanvas = () => {
            canvas.width = window.innerWidth * 2;
            canvas.height = window.innerHeight * 2;
        };
        resizeCanvas();

        const createParticles = () => {
            particles = [];
            for (let i = 0; i < numParticles; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: Math.random() * 0.1 - 0.05,
                    vy: Math.random() * 0.1 - 0.05,
                    angle: Math.random() * Math.PI * 2,
                    radius: Math.random() * 0.8 + 0.2,
                    color: `hsla(285, 100%, 90%, ${Math.random() * 0.4 + 0.1})`,
                    trail: [],
                    trailLength: Math.floor(Math.random() * 15) + 10,
                });
            }
        };
        createParticles();

        const draw = () => {
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                if (p.trail.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let i = 1; i < p.trail.length - 2; i++) {
                    const xc = (p.trail[i].x + p.trail[i + 1].x) / 2;
                    const yc = (p.trail[i].y + p.trail[i + 1].y) / 2;
                    ctx.quadraticCurveTo(p.trail[i].x, p.trail[i].y, xc, yc);
                }
                if(p.trail.length > 2) {
                     ctx.quadraticCurveTo(
                        p.trail[p.trail.length - 2].x,
                        p.trail[p.trail.length - 2].y,
                        p.trail[p.trail.length - 1].x,
                        p.trail[p.trail.length - 1].y
                    );
                }
                ctx.lineWidth = p.radius;
                ctx.strokeStyle = p.color;
                ctx.stroke();
            });
        };

        const update = () => {
            if (!canvas) return;
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vx += Math.sin(p.angle) * 0.0005;
                p.vy += Math.cos(p.angle) * 0.0005;
                p.angle += 0.005;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > p.trailLength) p.trail.shift();
                if (Math.random() > 0.98) {
                    p.color = `hsla(285, 100%, 90%, ${Math.random() * 0.4 + 0.1})`;
                }
            });
        };
        
        const animate = () => {
            draw();
            update();
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;
            const xPercent = (clientX / window.innerWidth - 0.5);
            const yPercent = (clientY / window.innerHeight - 0.5);
            if (gradientRef.current) gradientRef.current.style.transform = `translate(${xPercent * -5}%, ${yPercent * -5}%)`;
            if (canvasRef.current) canvasRef.current.style.transform = `translate(${xPercent * -10}%, ${yPercent * -10}%)`;
        };

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div ref={containerRef} id="cosmic-bg-container" className={cn(riskClass, assistantClass, resonanceClass, pulseClass, tierClass)}>
             <div ref={gradientRef} id="cosmic-gradient"></div>
             
             <div className="absolute inset-0 w-full h-full pointer-events-none">
                <KatedraOrbita staticMode={!radio.isPlaying} className="w-full h-full" />
             </div>
             
             <div id="grawiton-core-container">
                <div id="grawiton-core"></div>
             </div>

             <canvas ref={canvasRef} id="starfield"></canvas>
        </div>
    );
};
