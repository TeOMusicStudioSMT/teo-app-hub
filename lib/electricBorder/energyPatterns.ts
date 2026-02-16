/**
 * Energy Pattern Generators for ElectricBorder
 * Based on PEIE Philosophy: Protocol of Energy, Information & Exchange
 * 
 * These functions generate visual patterns that represent different states
 * of consciousness and interaction in the TeO ecosystem.
 */

/**
 * JusT Mode: Zero-Gravity Wave Pattern
 * 
 * Generates smooth, gentle wave patterns with minimal displacement.
 * Represents passive presence - the system is aware but not intrusive.
 * 
 * @param ctx - Canvas rendering context
 * @param x1 - Start X coordinate
 * @param y1 - Start Y coordinate
 * @param x2 - End X coordinate
 * @param y2 - End Y coordinate
 * @param time - Current animation time (ms)
 */
export function drawJusTWave(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    time: number
): void {
    const segments = 20;           // Smooth interpolation points
    const amplitude = 2;           // 2px max displacement (zero-gravity)
    const frequency = 0.1;         // Gentle wave frequency
    const phaseSpeed = 0.001;      // Slow, breathing-like movement

    ctx.beginPath();
    ctx.moveTo(x1, y1);

    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;

        // Sinusoidal offset for smooth wave
        const offset = Math.sin(t * Math.PI * 2 * frequency + time * phaseSpeed) * amplitude;

        ctx.lineTo(x, y + offset);
    }
}

/**
 * Resonance Mode: Harmonic Wave Pattern
 * 
 * Generates synchronized harmonic patterns that pulse in rhythm.
 * Represents deep connection - user and system in harmony.
 * 
 * @param ctx - Canvas rendering context
 * @param x1 - Start X coordinate
 * @param y1 - Start Y coordinate
 * @param x2 - End X coordinate
 * @param y2 - End Y coordinate
 * @param time - Current animation time (ms)
 */
export function drawResonanceWave(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    time: number
): void {
    const segments = 30;           // More segments for complexity
    const amplitude = 5;           // Medium displacement (7px max)
    const frequency = 0.3;         // Multiple harmonics
    const phaseSpeed = 0.002;      // Medium speed

    ctx.beginPath();
    ctx.moveTo(x1, y1);

    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;

        // Harmonic combination: fundamental + overtone
        const fundamental = Math.sin(t * Math.PI * 2 * frequency + time * phaseSpeed);
        const overtone = Math.sin(t * Math.PI * 4 * frequency + time * phaseSpeed * 1.5) * 0.3;
        const offset = (fundamental + overtone) * amplitude;

        ctx.lineTo(x, y + offset);
    }
}

/**
 * Active Mode: Lightning Segment (Existing Logic)
 * 
 * Recursive fractal lightning generation.
 * Represents high energy - system is fully engaged.
 * 
 * @param ctx - Canvas rendering context
 * @param x1 - Start X coordinate
 * @param y1 - Start Y coordinate
 * @param x2 - End X coordinate
 * @param y2 - End Y coordinate
 * @param displacement - Maximum random displacement
 */
export function drawLightningSegment(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    displacement: number
): void {
    if (displacement < 2) {
        ctx.lineTo(x2, y2);
        return;
    }

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const midX_disp = midX + (Math.random() - 0.5) * displacement;
    const midY_disp = midY + (Math.random() - 0.5) * displacement;

    drawLightningSegment(ctx, x1, y1, midX_disp, midY_disp, displacement / 2);
    drawLightningSegment(ctx, midX_disp, midY_disp, x2, y2, displacement / 2);
}

/**
 * Breathing Animation Function
 * 
 * Generates a smooth breathing pattern based on sine wave.
 * Inspired by ProtectiveModeModal - creates calm, meditative rhythm.
 * 
 * @param time - Current animation time (ms)
 * @param duration - Full breath cycle duration (default: 4000ms)
 * @returns Value between 0 and 1 representing breath phase
 */
export function breathingCycle(time: number, duration: number = 4000): number {
    const t = (time % duration) / duration;
    const phase = t * Math.PI * 2;

    // Normalize sine wave to 0-1 range
    // Inhale: 0 → 0.5 (2s)
    // Exhale: 0.5 → 1 (2s)
    return (Math.sin(phase - Math.PI / 2) + 1) / 2;
}

/**
 * Get visual parameters for a given mode
 * 
 * @param mode - The ElectricBorder mode
 * @param time - Current animation time (ms)
 * @returns Visual parameters object
 */
export function getModeParameters(
    mode: 'active' | 'just' | 'resonance',
    time: number
) {
    const breath = breathingCycle(time);

    switch (mode) {
        case 'just':
            return {
                opacity: 0.7 + breath * 0.15,      // 0.7 - 0.85
                shadowBlur: 8 + breath * 2,        // 8px - 10px
                lineWidth: 1.3 + breath * 0.2,     // 1.3px - 1.5px
                displacement: 2,                    // Minimal (zero-gravity)
                frameRate: 30,                      // Optimized for passive state
                drawFunction: drawJusTWave
            };

        case 'resonance':
            return {
                opacity: 0.8 + breath * 0.2,       // 0.8 - 1.0
                shadowBlur: 15 + breath * 5,       // 15px - 20px
                lineWidth: 1.5 + breath * 0.5,     // 1.5px - 2.0px
                displacement: 5,                    // Medium harmonic displacement
                frameRate: 45,                      // Medium frame rate
                drawFunction: drawResonanceWave
            };

        case 'active':
        default:
            return {
                opacity: 1.0,                       // Full opacity
                shadowBlur: 20,                     // Maximum glow
                lineWidth: 2,                       // Bold line
                displacement: 10,                   // High energy chaos
                frameRate: 60,                      // Full frame rate
                drawFunction: drawLightningSegment
            };
    }
}

/**
 * Zero-Gravity Offset Calculator
 * 
 * Calculates minimal displacement for "floating" effect.
 * Used in JusT mode for subtle, calming movement.
 * 
 * @param position - Normalized position along path (0-1)
 * @param time - Current animation time (ms)
 * @returns Offset in pixels
 */
export function zeroGravityOffset(position: number, time: number): number {
    const amplitude = 2;           // 2px maximum
    const frequency = 0.1;         // Spatial frequency
    const phaseSpeed = 0.001;      // Temporal speed

    return amplitude * Math.sin(frequency * position + phaseSpeed * time);
}

/**
 * Calculate frame delay for target FPS
 * 
 * @param targetFps - Desired frames per second
 * @returns Milliseconds to wait between frames
 */
export function getFrameDelay(targetFps: number): number {
    return 1000 / targetFps;
}
