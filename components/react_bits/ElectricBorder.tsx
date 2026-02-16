import React, { useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { electricBorderAtom, setGlobalModeAtom, ElectricBorderMode } from '../../store/electricBorder';
import {
    drawJusTWave,
    drawResonanceWave,
    drawLightningSegment,
    getModeParameters
} from '../../lib/electricBorder/energyPatterns';

interface ElectricBorderProps {
    children: React.ReactNode;

    // Visual customization
    color?: string;
    className?: string;
    cornerRadius?: number;

    // JusT Mode support
    mode?: ElectricBorderMode;
    autoTransition?: boolean;
    inactivityTimeout?: number;
    onModeChange?: (mode: ElectricBorderMode) => void;
    useGlobalState?: boolean;
}

export const ElectricBorder: React.FC<ElectricBorderProps> = ({
    children,
    color = "#22d3ee", // Jasny Cyan
    className = "",
    cornerRadius = 24,
    mode: propMode = 'active',
    autoTransition = false,
    inactivityTimeout = 30000,
    onModeChange,
    useGlobalState = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State management
    const [localMode, setLocalMode] = useState<ElectricBorderMode>(propMode);
    const [isHovered, setIsHovered] = useState(false);
    const globalState = useAtomValue(electricBorderAtom);
    const [, setGlobalMode] = useAtom(setGlobalModeAtom);

    // Determine active mode: global or local
    const activeMode = useGlobalState ? globalState.globalMode : localMode;

    // Inactivity timer for auto-transition
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastInteractionRef = useRef<number>(Date.now());

    // Check for reduced motion preference
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const handler = (e: MediaQueryListEvent) => {
            setPrefersReducedMotion(e.matches);
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    // Mode transition function
    const transitionToMode = (newMode: ElectricBorderMode) => {
        if (useGlobalState) {
            setGlobalMode(newMode);
        } else {
            setLocalMode(newMode);
        }

        onModeChange?.(newMode);
    };

    // Handle interaction events
    const handleInteraction = () => {
        lastInteractionRef.current = Date.now();

        if (autoTransition && activeMode === 'just') {
            transitionToMode('active');
        }

        // Reset inactivity timer
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }

        // Set new inactivity timer
        if (autoTransition) {
            inactivityTimerRef.current = setTimeout(() => {
                transitionToMode('just');
            }, inactivityTimeout);
        }
    };

    // Mouse event handlers
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseEnter = () => {
            setIsHovered(true);
            handleInteraction();
        };

        const handleMouseLeave = () => {
            setIsHovered(false);
        };

        const handleMouseMove = () => {
            handleInteraction();
        };

        container.addEventListener('mouseenter', handleMouseEnter);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('mousemove', handleMouseMove);

        return () => {
            container.removeEventListener('mouseenter', handleMouseEnter);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('mousemove', handleMouseMove);
        };
    }, [autoTransition, activeMode, inactivityTimeout]);

    // Cleanup inactivity timer
    useEffect(() => {
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
        };
    }, []);

    // Main animation loop
    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        const padding = 40;

        let lastWidth = 0;
        let lastHeight = 0;
        let lastFrameTime = 0;

        // Get mode parameters
        const params = getModeParameters(activeMode, Date.now());
        const targetFrameDelay = 1000 / params.frameRate;

        const drawPath = (
            x1: number, y1: number,
            x2: number, y2: number,
            time: number
        ) => {
            // Choose drawing function based on mode
            if (prefersReducedMotion) {
                // No animation for reduced motion
                ctx.lineTo(x2, y2);
            } else if (activeMode === 'just') {
                drawJusTWave(ctx, x1, y1, x2, y2, time);
            } else if (activeMode === 'resonance') {
                drawResonanceWave(ctx, x1, y1, x2, y2, time);
            } else {
                // Active mode: lightning
                drawLightningSegment(ctx, x1, y1, x2, y2, params.displacement);
            }
        };

        const animate = (currentTime: number) => {
            if (!container || !canvas || !ctx) return;

            // Frame rate limiting
            const deltaTime = currentTime - lastFrameTime;
            if (deltaTime < targetFrameDelay) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }
            lastFrameTime = currentTime - (deltaTime % targetFrameDelay);

            const rect = container.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            // Auto-resize canvas if container size changed
            if (w !== lastWidth || h !== lastHeight) {
                lastWidth = w;
                lastHeight = h;
                canvas.width = w + padding * 2;
                canvas.height = h + padding * 2;
                canvas.style.top = `-${padding}px`;
                canvas.style.left = `-${padding}px`;
                canvas.style.width = `${w + padding * 2}px`;
                canvas.style.height = `${h + padding * 2}px`;
            }

            // Skip drawing if hidden
            if (w === 0 || h === 0) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            const r = cornerRadius;
            const ox = padding;
            const oy = padding;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Get current mode parameters with breathing
            const currentParams = getModeParameters(activeMode, currentTime);

            // Configure drawing style
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = currentParams.lineWidth;
            ctx.shadowBlur = currentParams.shadowBlur;
            ctx.shadowColor = color;
            ctx.globalAlpha = currentParams.opacity;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            // Draw path (rounded rectangle with animated edges)
            // Start: Top-left (after corner)
            ctx.moveTo(ox + r, oy);

            // Top edge
            drawPath(ox + r, oy, ox + w - r, oy, currentTime);
            // Top-right corner
            ctx.quadraticCurveTo(ox + w, oy, ox + w, oy + r);

            // Right edge
            drawPath(ox + w, oy + r, ox + w, oy + h - r, currentTime);
            // Bottom-right corner
            ctx.quadraticCurveTo(ox + w, oy + h, ox + w - r, oy + h);

            // Bottom edge
            drawPath(ox + w - r, oy + h, ox + r, oy + h, currentTime);
            // Bottom-left corner
            ctx.quadraticCurveTo(ox, oy + h, ox, oy + h - r);

            // Left edge
            drawPath(ox, oy + h - r, ox, oy + r, currentTime);
            // Top-left corner
            ctx.quadraticCurveTo(ox, oy, ox + r, oy);

            ctx.stroke();

            // Random flash effect (only in active mode)
            if (activeMode === 'active' && Math.random() > 0.9) {
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 30;
                ctx.stroke();
            }

            // Reset global alpha
            ctx.globalAlpha = 1.0;

            animationFrameId = requestAnimationFrame(animate);
        };

        // Start animation
        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [color, cornerRadius, activeMode, prefersReducedMotion]);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Canvas for border animation */}
            <canvas
                ref={canvasRef}
                className="pointer-events-none absolute z-50"
                style={{
                    transition: 'opacity 0.3s ease-in-out'
                }}
            />

            {/* Content container */}
            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
};