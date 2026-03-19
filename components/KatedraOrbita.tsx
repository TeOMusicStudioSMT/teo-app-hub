/**
 * 🌑 KatedraOrbita v4
 *
 * Podłączona do activeAura z KatedraRadioContext.
 * Gdy agent mówi → Orbita zmienia kolor na jego aurę.
 * Gdy aura wygaśnie → wraca do złotego.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useKatedraRadio } from '../context/KatedraRadioContext';

interface KatedraOrbitaProps {
    showParticles?: boolean;
    staticMode?:    boolean;
    className?:     string;
    style?:         React.CSSProperties;
}

const CONFIG = {
    PARTICLE_COUNT:  90,
    RING_BASE_WIDTH: 3.0,
    RESONANCE_RINGS: 4,
    BASS_EXPAND:     150,
    ROTATION_SPEED:  0.001,
};

// Kolory domyślne (złoty)
const DEFAULT_RGB = { r1: 255, g1: 210, b1: 100, r2: 201, g2: 149, b2: 58 };

// Mapa agentId → kolor RGB na potrzeby Canvas
const AGENT_COLORS: Record<string, { r1: number; g1: number; b1: number; r2: number; g2: number; b2: number }> = {
    wieslaw: { r1: 255, g1: 150, b1:  50, r2: 220, g2:  90, b2:  20 }, // Miedź
    jadzia:  { r1: 180, g1: 100, b1: 255, r2: 130, g2:  50, b2: 220 }, // Różowo-fiolet
    bob:     { r1: 100, g1: 220, b1: 255, r2:  60, g2: 180, b2: 255 }, // Cyjan
    bella:   { r1: 255, g1:  80, b1: 180, r2: 200, g2:  40, b2: 140 }, // Różowy
    jack:    { r1: 200, g1: 120, b1: 255, r2: 150, g2:  60, b2: 255 }, // Fiolet
    gorg:    { r1: 255, g1: 200, b1:  50, r2: 200, g2: 140, b2:  20 }, // Złoto-żółty
    teo:     { r1: 255, g1: 255, b1: 255, r2: 200, g2: 200, b2: 255 }, // Biel/srebro
    // Modele zewnętrzne
    claude:  { r1: 210, g1: 160, b1: 255, r2: 160, g2: 100, b2: 230 }, // Lawendowy
    gemini:  { r1:  80, g1: 200, b1: 120, r2:  40, g2: 150, b2:  80 }, // Zielony
    gpt:     { r1: 100, g1: 200, b1: 255, r2:  50, g2: 150, b2: 220 }, // Błękit
    groq:    { r1: 255, g1: 100, b1:  80, r2: 200, g2:  60, b2:  40 }, // Czerwony
};

function parseColor(hex: string) {
    // Parsuje CSS hex color → {r,g,b}
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m || m.length < 3) return null;
    return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function createParticles(count: number, radius: number) {
    return Array.from({ length: count }, (_, i) => ({
        angle:   (i / count) * Math.PI * 2,
        speed:   0.0003 + Math.random() * 0.0008,
        orbitR:  radius + (Math.random() - 0.5) * 30,
        size:    0.8 + Math.random() * 2,
        opacity: 0.15 + Math.random() * 0.5,
        phase:   Math.random() * Math.PI * 2,
    }));
}

export function KatedraOrbita({
    showParticles = true,
    staticMode    = false,
    className,
    style,
}: KatedraOrbitaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const [squareSize, setSquareSize] = useState(0);

    const stateRef = useRef({
        rotation:     0,
        smoothBass:   0,
        // Wygładzony kolor (lerp między złotym a aurą)
        smoothR1: DEFAULT_RGB.r1, smoothG1: DEFAULT_RGB.g1, smoothB1: DEFAULT_RGB.b1,
        smoothR2: DEFAULT_RGB.r2, smoothG2: DEFAULT_RGB.g2, smoothB2: DEFAULT_RGB.b2,
        particles: createParticles(CONFIG.PARTICLE_COUNT, 200),
        animId:    0,
    });

    const radio      = useKatedraRadio();
    const bassLevel  = staticMode ? 0 : radio.bassLevel;
    const activeAura = radio.activeAura;

    const bassRef = useRef(bassLevel);
    const auraRef = useRef(activeAura);
    bassRef.current = bassLevel;
    auraRef.current = activeAura;

    // ── ResizeObserver ────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const applySize = (w: number, h: number) => {
            const size = Math.floor(Math.min(w, h));
            if (size < 10) return;
            const canvas = canvasRef.current;
            if (canvas) { canvas.width = size; canvas.height = size; }
            setSquareSize(size);
            stateRef.current.particles = createParticles(CONFIG.PARTICLE_COUNT, size * 0.15);
        };

        const ro = new ResizeObserver(entries => {
            for (const entry of entries) applySize(entry.contentRect.width, entry.contentRect.height);
        });
        ro.observe(container);
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

        const s   = stateRef.current;
        const W   = canvas.width;
        const H   = canvas.height;
        const cx  = W / 2;
        const cy  = H / 2;
        const b   = (() => {
            s.smoothBass += (bassRef.current - s.smoothBass) * 0.22;
            return s.smoothBass / 100;
        })();

        // ── Docelowy kolor zależny od activeAura ─────────────────────
        const aura = auraRef.current;
        let targetRGB = DEFAULT_RGB;

        if (aura) {
            // Najpierw sprawdzamy mapę agentId
            if (AGENT_COLORS[aura.agentId]) {
                const c = AGENT_COLORS[aura.agentId];
                targetRGB = { r1: c.r1, g1: c.g1, b1: c.b1, r2: c.r2, g2: c.g2, b2: c.b2 };
            } else if (aura.color) {
                // Fallback: parsuj hex color agenta
                const parsed = parseColor(aura.color);
                if (parsed) {
                    targetRGB = {
                        r1: parsed.r, g1: parsed.g, b1: parsed.b,
                        r2: Math.floor(parsed.r * 0.7), g2: Math.floor(parsed.g * 0.7), b2: Math.floor(parsed.b * 0.7),
                    };
                }
            }
        }

        // Wygładzony przejazd kolorów (lerp 0.04 = powolna zmiana)
        const lerpSpeed = aura ? 0.04 : 0.02; // szybciej do aury, wolniej z powrotem
        s.smoothR1 += (targetRGB.r1 - s.smoothR1) * lerpSpeed;
        s.smoothG1 += (targetRGB.g1 - s.smoothG1) * lerpSpeed;
        s.smoothB1 += (targetRGB.b1 - s.smoothB1) * lerpSpeed;
        s.smoothR2 += (targetRGB.r2 - s.smoothR2) * lerpSpeed;
        s.smoothG2 += (targetRGB.g2 - s.smoothG2) * lerpSpeed;
        s.smoothB2 += (targetRGB.b2 - s.smoothB2) * lerpSpeed;

        const r1 = Math.round(s.smoothR1), g1 = Math.round(s.smoothG1), b1 = Math.round(s.smoothB1);
        const r2 = Math.round(s.smoothR2), g2 = Math.round(s.smoothG2), b2 = Math.round(s.smoothB2);

        ctx.clearRect(0, 0, W, H);

        // Mgławica tła
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
        bg.addColorStop(0,   `rgba(${r2},${g2},${b2},${0.05 + b * 0.12})`);
        bg.addColorStop(0.5, `rgba(${Math.floor(r2/2)},${Math.floor(g2/2)},${Math.floor(b2/2)},${0.04 + b * 0.06})`);
        bg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const baseR = W * 0.15 + b * CONFIG.BASS_EXPAND;

        // Pierścienie rezonansowe
        for (let i = CONFIG.RESONANCE_RINGS; i >= 1; i--) {
            const rr = baseR + i * (12 + b * 45);
            const op = (0.06 - i * 0.015) * (1 + b * 2);
            if (op <= 0) continue;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${r1},${g1},${b1},${op})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Główny pierścień
        ctx.save();
        ctx.shadowBlur  = 18 + b * 35;
        ctx.shadowColor = `rgba(${r1},${g1},${b1},${0.18 + b * 0.3})`;
        const grad = ctx.createLinearGradient(cx - baseR, cy, cx + baseR, cy);
        grad.addColorStop(0,    `rgb(${r2},${g2},${b2})`);
        grad.addColorStop(0.25, `rgb(${r1},${g1},${b1})`);
        grad.addColorStop(0.5,  `rgba(${r1},${g1},${b1},${0.8 + b * 0.2})`);
        grad.addColorStop(0.75, `rgb(${r1},${g1},${b1})`);
        grad.addColorStop(1,    `rgb(${r2},${g2},${b2})`);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = CONFIG.RING_BASE_WIDTH + b * 3.5;
        ctx.stroke();
        ctx.restore();

        // Wypełnienie pulsujące
        if (b > 0.05) {
            const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
            ig.addColorStop(0,   `rgba(${r1},${g1},${b1},${b * 0.06})`);
            ig.addColorStop(0.7, `rgba(${r2},${g2},${b2},${b * 0.03})`);
            ig.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = ig;
            ctx.beginPath();
            ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Orbita wewnętrzna
        ctx.beginPath();
        ctx.arc(cx, cy, W * 0.08 + b * 12, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r2},${g2},${b2},${0.12 + b * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Punkt obiegający
        s.rotation += CONFIG.ROTATION_SPEED * (1 + b * 3);
        ctx.save();
        ctx.shadowBlur  = 20 + b * 30;
        ctx.shadowColor = `rgba(${r1},${g1},${b1},${0.6 + b * 0.4})`;
        ctx.beginPath();
        ctx.arc(
            cx + Math.cos(s.rotation) * baseR,
            cy + Math.sin(s.rotation) * baseR,
            3 + b * 4, 0, Math.PI * 2
        );
        ctx.fillStyle = `rgba(${r1},${g1},${b1},${0.7 + b * 0.3})`;
        ctx.fill();
        ctx.restore();

        // Cząsteczki
        if (showParticles) {
            s.particles.forEach(p => {
                p.angle += p.speed * (1 + b * 8);
                const r   = p.orbitR + b * 120 * Math.sin(p.phase + s.rotation * 2);
                const ppx = cx + Math.cos(p.angle) * r;
                const ppy = cy + Math.sin(p.angle) * r;
                ctx.save();
                if (b > 0.3) {
                    ctx.shadowBlur  = 6 + b * 10;
                    ctx.shadowColor = `rgba(${r1},${g1},${b1},${b * 0.5})`;
                }
                ctx.beginPath();
                ctx.arc(ppx, ppy, p.size * (1 + b * 1.5), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r1},${g1},${b1},${p.opacity * (0.4 + b * 0.8)})`;
                ctx.fill();
                ctx.restore();
            });
        }

        // Centrum
        const coreR = 6 + b * 12;
        const cg    = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
        cg.addColorStop(0,   `rgba(${r1},${g1},${b1},${0.15 + b * 0.35})`);
        cg.addColorStop(0.5, `rgba(${r2},${g2},${b2},${0.05 + b * 0.15})`);
        cg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.save();
        ctx.shadowBlur  = 15 + b * 25;
        ctx.shadowColor = `rgba(${r2},${g2},${b2},${0.2 + b * 0.4})`;
        ctx.fillStyle   = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r1},${g1},${b1},${0.3 + b * 0.5})`;
        ctx.fill();
        ctx.restore();

        // ── Napis agenta gdy aktywna aura ─────────────────────────────
        if (aura && (r1 !== DEFAULT_RGB.r1 || g1 !== DEFAULT_RGB.g1)) {
            const elapsed = Date.now() - aura.timestamp;
            const fadeOut = Math.max(0, 1 - elapsed / 8000);
            ctx.save();
            ctx.globalAlpha = fadeOut * 0.7;
            ctx.font        = `bold ${Math.floor(W * 0.028)}px 'JetBrains Mono', monospace`;
            ctx.fillStyle   = `rgb(${r1},${g1},${b1})`;
            ctx.textAlign   = 'center';
            ctx.shadowBlur  = 10;
            ctx.shadowColor = `rgb(${r1},${g1},${b1})`;
            ctx.fillText(aura.agentName.toUpperCase(), cx, cy - W * 0.18);
            ctx.restore();
        }

        s.animId = requestAnimationFrame(draw);
    }, [showParticles]);

    useEffect(() => {
        stateRef.current.animId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(stateRef.current.animId);
    }, [draw]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position:  'relative',
                width:     '100%',
                height:    '100%',
                minHeight: '300px',
                overflow:  'hidden',
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position:  'absolute',
                    top:       '50%',
                    left:      '50%',
                    transform: 'translate(-50%, -50%)',
                    width:     squareSize > 0 ? `${squareSize}px` : '100%',
                    height:    squareSize > 0 ? `${squareSize}px` : '100%',
                    display:   'block',
                }}
                aria-label="Wizualizator orbity Katedry"
            />
        </div>
    );
}

export default KatedraOrbita;