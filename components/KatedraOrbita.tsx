/**
 * 🌑 KatedraOrbita v3
 *
 * NAPRAWA prostokątnej ramki:
 * - canvas.width = canvas.height = min(containerW, containerH)  ← KWADRAT
 * - canvas wycentrowany w divie przez CSS (position absolute + transform)
 * - cx i cy są zawsze prawdziwym centrum kwadratu
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useKatedraRadio } from '../context/KatedraRadioContext';

interface KatedraOrbitaProps {
    colorInner?: string;
    colorOuter?: string;
    showParticles?: boolean;
    staticMode?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const CONFIG = {
    PARTICLE_COUNT: 90,
    RING_BASE_WIDTH: 3.0,
    RESONANCE_RINGS: 4,
    BASS_EXPAND: 150,
    ROTATION_SPEED: 0.001,
};

function createParticles(count: number, radius: number) {
    return Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2,
        speed: 0.0003 + Math.random() * 0.0008,
        orbitR: radius + (Math.random() - 0.5) * 30,
        size: 0.8 + Math.random() * 2,
        opacity: 0.15 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
    }));
}

export function KatedraOrbita({
    colorInner = '#c9953a',
    colorOuter = '#6b3a0a',
    showParticles = true,
    staticMode = false,
    className,
    style,
}: KatedraOrbitaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Przechowujemy JEDEN wymiar — rozmiar kwadratu
    const [squareSize, setSquareSize] = useState(0);

    const stateRef = useRef({
        rotation: 0,
        smoothBass: 0,
        particles: createParticles(CONFIG.PARTICLE_COUNT, 200),
        animId: 0,
    });

    // Bass z kontekstu
    let bassLevel = 0;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const radio = useKatedraRadio();
        bassLevel = staticMode ? 0 : radio.bassLevel;
    } catch { /* brak providera */ }
    const bassRef = useRef(bassLevel);
    bassRef.current = bassLevel;

    // ── ResizeObserver: mierzy kontener, ustawia KWADRAT ─────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const applySize = (w: number, h: number) => {
            // Kwadrat = mniejszy wymiar kontenera
            const size = Math.floor(Math.min(w, h));
            if (size < 10) return;

            // Ustawiamy wewnętrzną rozdzielczość canvas — KWADRAT
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = size;
                canvas.height = size;
            }

            setSquareSize(size);
            stateRef.current.particles = createParticles(
                CONFIG.PARTICLE_COUNT,
                size * 0.15
            );
        };

        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                applySize(entry.contentRect.width, entry.contentRect.height);
            }
        });
        ro.observe(container);

        // Pierwsze ustawienie natychmiast
        const rect = container.getBoundingClientRect();
        applySize(rect.width || 600, rect.height || 600);

        return () => ro.disconnect();
    }, []);

    // ── Pętla rysowania ───────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || canvas.width === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const s = stateRef.current;

        // W === H (kwadrat) → cx i cy są prawdziwym centrum
        const W = canvas.width;
        const H = canvas.height;  // === W
        const cx = W / 2;
        const cy = H / 2;

        s.smoothBass += (bassRef.current - s.smoothBass) * 0.22;
        const b = s.smoothBass / 100;

        ctx.clearRect(0, 0, W, H);

        // Mgławica tła
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
        bg.addColorStop(0, `rgba(40,20,5,${0.05 + b * 0.12})`);
        bg.addColorStop(0.5, `rgba(20,8,2,${0.04 + b * 0.06})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // baseR bazuje na W (= H), więc orbita zawsze okrągła
        const baseR = W * 0.15 + b * CONFIG.BASS_EXPAND;

        // Pierścienie rezonansowe
        for (let i = CONFIG.RESONANCE_RINGS; i >= 1; i--) {
            const rr = baseR + i * (12 + b * 45);
            const op = (0.06 - i * 0.015) * (1 + b * 2);
            if (op <= 0) continue;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(201,149,58,${op})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Główny pierścień
        ctx.save();
        ctx.shadowBlur = 18 + b * 35;
        ctx.shadowColor = `rgba(201,149,58,${0.18 + b * 0.3})`;
        const grad = ctx.createLinearGradient(cx - baseR, cy, cx + baseR, cy);
        grad.addColorStop(0, colorOuter);
        grad.addColorStop(0.25, colorInner);
        grad.addColorStop(0.5, `hsl(38,${60 + b * 30}%,${55 + b * 20}%)`);
        grad.addColorStop(0.75, colorInner);
        grad.addColorStop(1, colorOuter);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = CONFIG.RING_BASE_WIDTH + b * 3.5;
        ctx.stroke();
        ctx.restore();

        // Wypełnienie pulsujące
        if (b > 0.05) {
            const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
            ig.addColorStop(0, `rgba(201,120,30,${b * 0.06})`);
            ig.addColorStop(0.7, `rgba(100,50,10,${b * 0.03})`);
            ig.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = ig;
            ctx.beginPath();
            ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Orbita wewnętrzna
        ctx.beginPath();
        ctx.arc(cx, cy, W * 0.08 + b * 12, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,100,30,${0.12 + b * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Punkt obiegający pierścień
        s.rotation += CONFIG.ROTATION_SPEED * (1 + b * 3);
        ctx.save();
        ctx.shadowBlur = 20 + b * 30;
        ctx.shadowColor = `rgba(255,200,80,${0.6 + b * 0.4})`;
        ctx.beginPath();
        ctx.arc(
            cx + Math.cos(s.rotation) * baseR,
            cy + Math.sin(s.rotation) * baseR,
            3 + b * 4, 0, Math.PI * 2
        );
        ctx.fillStyle = `rgba(255,220,120,${0.7 + b * 0.3})`;
        ctx.fill();
        ctx.restore();

        // Cząsteczki
        if (showParticles) {
            s.particles.forEach(p => {
                p.angle += p.speed * (1 + b * 8);
                const r = p.orbitR + b * 120 * Math.sin(p.phase + s.rotation * 2);
                const ppx = cx + Math.cos(p.angle) * r;
                const ppy = cy + Math.sin(p.angle) * r;
                ctx.save();
                if (b > 0.3) {
                    ctx.shadowBlur = 6 + b * 10;
                    ctx.shadowColor = `rgba(201,149,58,${b * 0.5})`;
                }
                ctx.beginPath();
                ctx.arc(ppx, ppy, p.size * (1 + b * 1.5), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(201,149,58,${p.opacity * (0.4 + b * 0.8)})`;
                ctx.fill();
                ctx.restore();
            });
        }

        // Centrum
        const coreR = 6 + b * 12;
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
        cg.addColorStop(0, `rgba(255,220,120,${0.15 + b * 0.35})`);
        cg.addColorStop(0.5, `rgba(201,100,20,${0.05 + b * 0.15})`);
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.shadowBlur = 15 + b * 25;
        ctx.shadowColor = `rgba(255,180,60,${0.2 + b * 0.4})`;
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,210,100,${0.3 + b * 0.5})`;
        ctx.fill();
        ctx.restore();

        s.animId = requestAnimationFrame(draw);
    }, [colorInner, colorOuter, showParticles]);

    useEffect(() => {
        stateRef.current.animId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(stateRef.current.animId);
    }, [draw]);

    return (
        // Kontener wypełnia dostępną przestrzeń (może być prostokąt)
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '300px',
                overflow: 'hidden',
                ...style,
            }}
        >
            {/* Canvas jest zawsze kwadratem, wycentrowanym absolutnie */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    // CSS size = square size (bez rozciągania)
                    width: squareSize > 0 ? `${squareSize}px` : '100%',
                    height: squareSize > 0 ? `${squareSize}px` : '100%',
                    display: 'block',
                }}
                aria-label="Wizualizator orbity Katedry"
            />
        </div>
    );
}

export default KatedraOrbita;