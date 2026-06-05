/**
 * 🌑 KatedraOrbita v4
 *
 * Podłączona do activeAura z KatedraRadioContext.
 * Gdy agent mówi → Orbita zmienia kolor na jego aurę.
 * Gdy aura wygaśnie → wraca do złotego.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { visualizerLayoutAtom, currentLyricAtom, isKaraokeEnabledAtom } from '../store/visualizerStore';

import { motion, AnimatePresence } from 'framer-motion';
import { useKatedraRadio } from '../context/KatedraRadioContext';
import QuantumEqualizer from './special/QuantumEqualizer';
import MatrixRainSkin from './special/MatrixRainSkin';

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

// Kolory domyślne HSL (złoty)
const DEFAULT_HSL = { h: 43, s: 100, l: 70 };

// Mapa agentId → HSL
const AGENT_COLORS: Record<string, { h: number; s: number; l: number }> = {
    wieslaw: { h: 30,  s: 100, l: 60 }, // Miedź
    jadzia:  { h: 280, s: 100, l: 70 }, // Różowo-fiolet
    bob:     { h: 195, s: 100, l: 70 }, // Cyjan
    bella:   { h: 330, s: 100, l: 65 }, // Różowy
    jack:    { h: 270, s: 100, l: 60 }, // Fiolet
    gorg:    { h: 45,  s: 100, l: 60 }, // Złoto-żółty
    teo:     { h: 0,   s: 0,   l: 95 }, // Biel/srebro
    claude:  { h: 260, s: 80,  l: 80 }, // Lawendowy
    gemini:  { h: 145, s: 100, l: 55 }, // Zielony
    gpt:     { h: 200, s: 100, l: 70 }, // Błękit
    groq:    { h: 10,  s: 100, l: 65 }, // Czerwony
};

function hexToHSL(hex: string) {
    let r = 0, g = 0, b = 0;
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m || m.length < 3) return { h: 43, s: 100, l: 70 };
    r = parseInt(m[0], 16) / 255;
    g = parseInt(m[1], 16) / 255;
    b = parseInt(m[2], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
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
    
    // UI States dla Modułów (Jotai)
    const layout = useAtomValue(visualizerLayoutAtom);
    const currentLyricGlobal = useAtomValue(currentLyricAtom);
    const isKaraokeEnabled = useAtomValue(isKaraokeEnabledAtom);


    const stateRef = useRef({
        rotation:     0,
        smoothBass:   0,
        // Wygładzony kolor HSL
        smoothH: DEFAULT_HSL.h,
        smoothS: DEFAULT_HSL.s,
        smoothL: DEFAULT_HSL.l,
        particles: createParticles(CONFIG.PARTICLE_COUNT, 200),
        vocalParticles: [] as { x: number; y: number; vx: number; vy: number; life: number; h: number; s: number; l: number }[],
        hueOffset: 0,
        storyScroll: 0, // Przewijanie Matrix Storytellera
        animId:    0,
    });

    const radio      = useKatedraRadio();
    const bassLevel  = staticMode ? 0 : radio.bassLevel;
    const activeAura = radio.activeAura;
    const vocalLevel = staticMode ? 0 : radio.vocalLevel;

    const bassRef = useRef(bassLevel);
    const auraRef = useRef(activeAura);
    const vocalRef = useRef(vocalLevel);
    const lyricRef = useRef(radio.currentLyric);
    const introRef = useRef(radio.showIntro);
    const outroRef = useRef(radio.showOutro);

    const leftModuleRef = useRef(layout.left);
    const rightModuleRef = useRef(layout.right);

    // --- Ghost Cursor Trail ---
    const mouseTrail = useRef<{ x: number; y: number; life: number }[]>([]);

    // Sync state to refs for the animation loop
    useEffect(() => {
        leftModuleRef.current = layout.left;
        rightModuleRef.current = layout.right;
    }, [layout]);

    useEffect(() => {
        lyricRef.current = currentLyricGlobal;
    }, [currentLyricGlobal]);

    bassRef.current = bassLevel;
    auraRef.current = activeAura;
    vocalRef.current = vocalLevel;
    introRef.current = radio.showIntro;
    outroRef.current = radio.showOutro;

    // Pamięć DNA - dzieli krawędzie na 100 pionowych sektorów (binów)
    const leftDNA = useRef(new Array(100).fill(0));
    const rightDNA = useRef(new Array(100).fill(0));

    // ── ResizeObserver ────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const applySize = (w: number, h: number) => {
            const canvas = canvasRef.current;
            if (canvas) { 
                canvas.width = 1920; 
                canvas.height = 1080; 
            }
            setSquareSize(w); // Używamy szerokości do skalowania CSS
            stateRef.current.particles = createParticles(CONFIG.PARTICLE_COUNT, 1920 * 0.15);
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
        const W   = canvas.width;  // 1920
        const H   = canvas.height; // 1080
        const cx  = W / 2; // 960
        const cy  = H / 2; // 540

        // --- TARCZA SUWERENA: Dynamiczny Hue i optymalizacja FPS ---
        if (radio.isAutoAura) {
            s.hueOffset = (s.hueOffset + 0.3) % 360;
        }

        const b   = (() => {
            s.smoothBass += (bassRef.current - s.smoothBass) * 0.22;
            return s.smoothBass / 100;
        })();

        // ── Docelowy kolor zależny od activeAura ─────────────────────
        const aura = auraRef.current;
        let targetHSL = DEFAULT_HSL;

        if (aura) {
            if (AGENT_COLORS[aura.agentId]) {
                targetHSL = AGENT_COLORS[aura.agentId];
            } else if (aura.color) {
                targetHSL = hexToHSL(aura.color);
            }
        }

        // Wygładzony przejazd kolorów HSL
        const lerpSpeed = aura ? 0.05 : 0.02;
        
        // Specjalny lerp dla Hue (żeby nie skakał przez 360/0)
        let hueDiff = targetHSL.h - s.smoothH;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        
        s.smoothH = (s.smoothH + hueDiff * lerpSpeed + 360) % 360;
        s.smoothS += (targetHSL.s - s.smoothS) * lerpSpeed;
        s.smoothL += (targetHSL.l - s.smoothL) * lerpSpeed;

        // Finalny Hue z uwzględnieniem Auto-Aury
        const finalH = (s.smoothH + s.hueOffset) % 360;
        const finalS = s.smoothS;
        const finalL = s.smoothL;

        // Smuga tła (Trail Effect) zamiast clearRect - oszczędza CPU i wygląda lepiej
        ctx.fillStyle = `hsla(${(230 + s.hueOffset) % 360}, 50%, 5%, 0.2)`;
        ctx.fillRect(0, 0, W, H);

        // --- 1. AUTOMATIC AURA FOG ---
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        const bExpand = b * 200;
        
        // Fog 1 (Główna mgławica)
        const fog1 = ctx.createRadialGradient(cx - 150, cy - 100, 0, cx - 150, cy - 100, W * 0.4 + bExpand);
        fog1.addColorStop(0, `hsla(${finalH}, ${finalS}%, ${finalL}%, ${0.08 + b * 0.05})`);
        fog1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fog1;
        ctx.fillRect(0, 0, W, H);

        // Fog 2 (Przeciwległa mgławica, przesunięty hue)
        const fog2 = ctx.createRadialGradient(cx + 200, cy + 150, 0, cx + 200, cy + 150, W * 0.35 + bExpand);
        fog2.addColorStop(0, `hsla(${(finalH + 30) % 360}, ${finalS}%, ${finalL}%, ${0.06 + b * 0.04})`);
        fog2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fog2;
        ctx.fillRect(0, 0, W, H);
        
        ctx.restore();

        // Mgławica tła (stała baza)
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
        bg.addColorStop(0,   `hsla(${finalH}, ${finalS}%, ${finalL * 0.4}%, ${0.05 + b * 0.12})`);
        bg.addColorStop(0.5, `hsla(${finalH}, ${finalS}%, ${finalL * 0.2}%, ${0.04 + b * 0.06})`);
        bg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // --- 1.2 Central Morphing Sphere ---
        const coreDistortion = b * 30;
        const coreRadius = 50 + coreDistortion;
        
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= Math.PI * 2; i += 0.1) {
            const noise = (Math.random() - 0.5) * b * 20;
            const px = cx + Math.cos(i) * (coreRadius + noise);
            const py = cy + Math.sin(i) * (coreRadius + noise);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.2, `hsl(${finalH}, 100%, 80%)`);
        coreGrad.addColorStop(1, `hsl(${finalH}, ${finalS}%, ${finalL}%)`);
        
        ctx.fillStyle = coreGrad;
        ctx.shadowBlur = 40 + b * 60;
        ctx.shadowColor = `hsl(${finalH}, 100%, 60%)`;
        ctx.fill();
        ctx.restore();

        const baseR = W * 0.15 + b * CONFIG.BASS_EXPAND;

        // Pierścienie rezonansowe
        for (let i = CONFIG.RESONANCE_RINGS; i >= 1; i--) {
            const rr = baseR + i * (12 + b * 45);
            const op = (0.06 - i * 0.015) * (1 + b * 2);
            if (op <= 0) continue;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${op})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Główny pierścień
        ctx.save();
        ctx.shadowBlur  = 18 + b * 35;
        ctx.shadowColor = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${0.18 + b * 0.3})`;
        const grad = ctx.createLinearGradient(cx - baseR, cy, cx + baseR, cy);
        grad.addColorStop(0,    `hsl(${finalH}, ${finalS}%, ${finalL * 0.6}%)`);
        grad.addColorStop(0.25, `hsl(${finalH}, ${finalS}%, ${finalL}%)`);
        grad.addColorStop(0.5,  `hsla(${finalH}, ${finalS}%, ${finalL}%, ${0.8 + b * 0.2})`);
        grad.addColorStop(0.75, `hsl(${finalH}, ${finalS}%, ${finalL}%)`);
        grad.addColorStop(1,    `hsl(${finalH}, ${finalS}%, ${finalL * 0.6}%)`);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = CONFIG.RING_BASE_WIDTH + b * 3.5;
        ctx.stroke();
        ctx.restore();

        // Wypełnienie pulsujące
        if (b > 0.05) {
            const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
            ig.addColorStop(0,   `hsla(${finalH}, ${finalS}%, ${finalL}%, ${b * 0.06})`);
            ig.addColorStop(0.7, `hsla(${finalH}, ${finalS}%, ${finalL * 0.8}%, ${b * 0.03})`);
            ig.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = ig;
            ctx.beginPath();
            ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Orbita wewnętrzna
        ctx.beginPath();
        ctx.arc(cx, cy, W * 0.08 + b * 12, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${finalH}, ${finalS}%, ${finalL * 0.6}%, ${0.12 + b * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Punkt obiegający
        s.rotation += CONFIG.ROTATION_SPEED * (1 + b * 3);
        ctx.save();
        ctx.shadowBlur  = 20 + b * 30;
        ctx.shadowColor = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${0.6 + b * 0.4})`;
        ctx.beginPath();
        ctx.arc(
            cx + Math.cos(s.rotation) * baseR,
            cy + Math.sin(s.rotation) * baseR,
            3 + b * 4, 0, Math.PI * 2
        );
        ctx.fillStyle = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${0.7 + b * 0.3})`;
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
                    ctx.shadowColor = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${b * 0.5})`;
                }
                ctx.beginPath();
                ctx.arc(ppx, ppy, p.size * (1 + b * 1.5), 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${p.opacity * (0.4 + b * 0.8)})`;
                ctx.fill();
                ctx.restore();
            });

            // Wokalny Pył (Spektrometria Głosowa)
            const vl = vocalRef.current;
            if (vl > 50) {
                // Wystrzel nowe szybkie cząsteczki
                const spawnCount = Math.floor((vl - 50) / 10);
                for (let i = 0; i < spawnCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 4 + (vl / 20);
                    s.vocalParticles.push({
                        x: cx, y: cy,
                        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                        life: 1.0,
                        h: finalH, s: finalS, l: Math.min(100, finalL + 20)
                    });
                }
            }

            // Rysowanie i aktualizacja wokalnego pyłu
            const captureZone = 100;
            const sectionHeight = H / 100;

            for (let i = s.vocalParticles.length - 1; i >= 0; i--) {
                const vp = s.vocalParticles[i];
                vp.x += vp.vx;
                vp.y += vp.vy;
                vp.life -= 0.015 + Math.random() * 0.01;

                // TARCZA SUWERENA: Przechwytywanie DNA na krawędziach
                const binIndex = Math.floor((vp.y / H) * 100);
                if (binIndex >= 0 && binIndex < 100) {
                    if (vp.x < captureZone) {
                        leftDNA.current[binIndex] += vp.life * 15;
                        vp.life = 0; // Cząsteczka wchłonięta
                    } else if (vp.x > W - captureZone) {
                        rightDNA.current[binIndex] += vp.life * 15;
                        vp.life = 0;
                    }
                }

                if (vp.life <= 0) {
                    s.vocalParticles.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(vp.x, vp.y, 2 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${vp.h}, ${vp.s}%, ${vp.l}%, ${vp.life})`;
                ctx.shadowBlur = 10;
                ctx.shadowColor = `hsla(${vp.h}, ${vp.s}%, ${vp.l}%, ${vp.life})`;
                ctx.fill();
                ctx.restore();
            }
        }

        // Centrum
        const coreR = 6 + b * 12;
        const cg    = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
        cg.addColorStop(0,   `hsla(${finalH}, ${finalS}%, ${finalL}%, ${0.15 + b * 0.35})`);
        cg.addColorStop(0.5, `hsla(${finalH}, ${finalS}%, ${finalL * 0.6}%, ${0.05 + b * 0.15})`);
        cg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.save();
        ctx.shadowBlur  = 15 + b * 25;
        ctx.shadowColor = `hsla(${finalH}, ${finalS}%, ${finalL * 0.6}%, ${0.2 + b * 0.4})`;
        ctx.fillStyle   = cg;
        // --- TARCZA SUWERENA: Reżyseria Napisów na Canvasie ---

        // Funkcja pomocnicza do rysowania wyśrodkowanego tekstu z poświatą (Glow)
        const drawCenteredTextWithGlow = (text: string, yPos: number, font: string, fillStyle: string, shadowColor: string, shadowBlur: number, xOffset = 0, yOffset = 0) => {
            ctx.save();
            ctx.font = font;
            ctx.fillStyle = fillStyle;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = shadowColor;
            ctx.shadowBlur = shadowBlur;
            
            ctx.fillText(text, cx + xOffset, yPos + yOffset);
            // Drugi pass dla silniejszego efektu glow
            ctx.fillText(text, cx + xOffset, yPos + yOffset); 
            ctx.restore();
        };


        // 1. 🎬 INTRO (Tytuł Utworu)
        if (introRef.current) {
            drawCenteredTextWithGlow(
                radio.currentTrack?.title || "NIEZNANA TRANSMISJA",
                cy,
                `900 50px "Inter", sans-serif`,
                `hsla(${(30 + s.hueOffset) % 360}, 100%, 80%, 1)`, 
                'rgba(245, 158, 11, 0.8)',
                30
            );
            // Podtytuł Intro
            drawCenteredTextWithGlow(
                "0.00G STUDIO",
                cy + W * 0.08,
                `400 ${Math.floor(W * 0.02)}px "Space Mono", sans-serif`,
                'rgba(252, 211, 77, 0.8)',
                'rgba(245, 158, 11, 0.4)',
                10
            );
        }



        // 3. 🎬 OUTRO (Sygnatura Suwerena)
        if (outroRef.current) {
            // Pociemnienie tła Canvasu dla efektu Outro
            ctx.save();
            ctx.fillStyle = 'rgba(2, 2, 5, 0.85)'; 
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

            // Cinematic Glitch Logic
            const glitchX = (Math.random() - 0.5) * 4;
            const glitchY = (Math.random() - 0.5) * 4;
            const intenseGlow = 30 + Math.random() * 20;

            // Sygnatura TeO Production
            drawCenteredTextWithGlow(
                "TeO Production",
                cy - 20,
                `900 ${Math.floor(W * 0.07)}px "Inter", sans-serif`,
                'rgba(6, 182, 212, 1)',
                '#00FFFF', // intense cyan glow
                intenseGlow,
                glitchX,
                glitchY
            );

            // Sygnatura Studio
            drawCenteredTextWithGlow(
                "OtakOS Engine Studio 0.00G",
                cy + 40,
                `400 ${Math.floor(W * 0.02)}px "Space Mono", sans-serif`,
                'rgba(148, 163, 184, 0.8)',
                '#00FFFF',
                intenseGlow / 2,
                glitchX * 0.5,
                glitchY * 0.5
            );
        }


        // --- RYSOWANIE WEKTOROWEGO DNA NA KRAWĘDZIACH ---
        const dnaSectionHeight = H / 100;
        const dnaCaptureZone = 80;

        ctx.save();
        ctx.shadowBlur = 12;
        
        for (let i = 0; i < 100; i++) {
            // Lewe DNA (Cyan/Chłodne)
            if (leftDNA.current[i] > 0) {
                const width = Math.min(leftDNA.current[i], dnaCaptureZone);
                ctx.fillStyle = `hsla(${(200 + s.hueOffset) % 360}, 100%, 60%, 0.7)`;
                ctx.shadowColor = `hsla(${(200 + s.hueOffset) % 360}, 100%, 50%, 0.5)`;
                ctx.fillRect(0, i * dnaSectionHeight, width, dnaSectionHeight - 1);
                leftDNA.current[i] *= 0.98; // Powolny zanik
            }

            // Prawe DNA (Magenta/Gorące)
            if (rightDNA.current[i] > 0) {
                const width = Math.min(rightDNA.current[i], dnaCaptureZone);
                ctx.fillStyle = `hsla(${(320 + s.hueOffset) % 360}, 100%, 60%, 0.7)`;
                ctx.shadowColor = `hsla(${(320 + s.hueOffset) % 360}, 100%, 50%, 0.5)`;
                ctx.fillRect(W - width, i * dnaSectionHeight, width, dnaSectionHeight - 1);
                rightDNA.current[i] *= 0.98;
            }
        }
        ctx.restore();

        // --- LEWA WIEŻA: Matrix Storyteller ---
        if (leftModuleRef.current === 'STORYTELLER') {
            const panelWidth = 400;
            ctx.save();
            ctx.fillStyle = 'rgba(5, 5, 10, 0.85)';
            ctx.fillRect(0, 0, panelWidth, H);
            
            // Granica Wieży (Cyan/Blue Glow)
            ctx.strokeStyle = `hsla(${(200 + s.hueOffset) % 360}, 100%, 50%, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(panelWidth, 0);
            ctx.lineTo(panelWidth, H);
            ctx.stroke();

            // Matrix Scrolling Text
            s.storyScroll += 0.5;
            const lore = [
                '[ SYSTEM BOOT ]',
                'Initiating TeOgoCHi...',
                'Analyzing quantum baselines...',
                'Synthesizing audio vectors...',
                'Collapse of the wave function detected...',
                'Generating lore...',
                'Accessing Akashic records...',
                'Syncing with BoB core...',
                'Vector DNA crystallized.'
            ];
            
            ctx.font = '16px "Space Mono", monospace';
            ctx.fillStyle = `hsla(${(180 + s.hueOffset) % 360}, 100%, 60%, 0.9)`;
            ctx.textAlign = 'left';
            
            const lineHeight = 30;
            const totalHeight = lore.length * lineHeight;
            
            lore.forEach((line, index) => {
                let y = (index * lineHeight + s.storyScroll) % (H + lineHeight);
                if (y > H) y -= (H + lineHeight);
                ctx.fillText(line, 30, y);
            });
            ctx.restore();
        }

        // --- PRAWA WIEŻA: Graviton Node Exchange ---
        if (rightModuleRef.current === 'GRAVITON_GRID') {
            const panelWidth = 400;
            ctx.save();
            ctx.fillStyle = 'rgba(10, 5, 10, 0.85)';
            ctx.fillRect(W - panelWidth, 0, panelWidth, H);

            // Granica Wieży (Magenta/Gold Glow)
            ctx.strokeStyle = `hsla(${(320 + s.hueOffset) % 360}, 100%, 50%, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(W - panelWidth, 0);
            ctx.lineTo(W - panelWidth, H);
            ctx.stroke();

            // Header
            ctx.font = '700 18px "Inter", sans-serif';
            ctx.fillStyle = `hsla(${(320 + s.hueOffset) % 360}, 100%, 70%, 1)`;
            ctx.textAlign = 'center';
            ctx.fillText("[ GRAVITON NODE AUCTION ]", W - panelWidth / 2, 50);

            // Grid Pattern
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            const gridSize = 30;
            for (let x = W - panelWidth + 20; x < W - 20; x += gridSize) {
                for (let y = 100; y < H - 20; y += gridSize) {
                    if (Math.random() > 0.98) {
                        ctx.fillStyle = `hsla(${(320 + s.hueOffset) % 360}, 100%, 50%, 0.2)`;
                        ctx.fillRect(x, y, gridSize - 2, gridSize - 2);
                    }
                    ctx.strokeRect(x, y, gridSize - 2, gridSize - 2);
                }
            }

            // --- DUMMY GRAVITON NODES ---
            const drawNode = (x: number, y: number, color: string, label: string) => {
                ctx.fillStyle = color;
                ctx.shadowBlur = 15;
                ctx.shadowColor = color;
                ctx.fillRect(x, y, gridSize - 2, gridSize - 2);
                
                ctx.font = '10px "Space Mono", monospace';
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.textAlign = 'left';
                ctx.shadowBlur = 0;
                ctx.fillText(label, x + gridSize + 5, y + 15);
            };

            drawNode(W - 350, 200, 'hsla(200, 100%, 50%, 0.8)', '[NODE: #GRV-8A21] ACTIVE');
            drawNode(W - 250, 400, 'hsla(300, 100%, 50%, 0.8)', '[NODE: #GRV-11B9] SYNC...');
            drawNode(W - 150, 700, 'hsla(40, 100%, 50%, 0.8)',  '[NODE: #GRV-99ZZ] SECURE');
            drawNode(W - 320, 850, 'hsla(150, 100%, 50%, 0.6)', '[NODE: #GRV-ALPHA] MINING');

            ctx.restore();
        }

        // --- 2. AUTOMATIC AURA GHOST TRAIL ---
        for (let i = mouseTrail.current.length - 1; i >= 0; i--) {
            const pt = mouseTrail.current[i];
            pt.life -= 0.015;
            if (pt.life <= 0) {
                mouseTrail.current.splice(i, 1);
                continue;
            }
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3 + pt.life * 8, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${pt.life * 0.4})`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsla(${finalH}, ${finalS}%, ${finalL}%, ${pt.life * 0.8})`;
            ctx.fill();
            ctx.restore();
        }

        // --- 3. SUBTITLES (Lyrics - bottom standalone) ---
        if (isKaraokeEnabled && lyricRef.current) {
            ctx.save();
            ctx.font = '700 36px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Subtitle shadow/glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsla(${finalH}, 100%, 50%, 0.9)`;
            ctx.fillStyle = 'white';
            
            ctx.fillText(lyricRef.current, cx, cy + 250);
            ctx.restore();
        }


        s.animId = requestAnimationFrame(draw);
    }, [showParticles, radio.isAutoAura, radio.showIntro, radio.showOutro, radio.currentLyric, radio.currentTrack]);

    useEffect(() => {
        stateRef.current.animId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(stateRef.current.animId);
    }, [draw]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '300px', overflow: 'hidden' }}>

            <div
                ref={containerRef}
                className={`${className || ''}`}
                style={{
                    position:  'absolute',
                    top: 0,
                    left: 0,
                    width:     '100%',
                    height:    '100%',
                    ...style,
                }}
            >
                <canvas
                    ref={canvasRef}
                    id="katedra-canvas"
                    style={{
                        position:  'absolute',
                        top:       '50%',
                        left:      '50%',
                        transform: 'translate(-50%, -50%)',
                        width:     '100%',
                        height:    'auto',
                        aspectRatio: '16 / 9',
                        display:   'block',
                        pointerEvents: 'auto',
                    }}
                    onMouseMove={(e) => {
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        const x = (e.clientX - rect.left) * scaleX;
                        const y = (e.clientY - rect.top) * scaleY;
                        mouseTrail.current.push({ x, y, life: 1.0 });
                    }}
                    aria-label="Wizualizator orbity Katedry"
                />

                {/* Left Module Slot — unmounted entirely when PUSTKA */}
                {layout.left !== 'PUSTKA' && (
                    <div className="absolute left-0 top-0 w-full h-full z-10 pointer-events-none">
                        {layout.left === 'QUANTUM_EQUALIZER' && (
                            <div className="pointer-events-auto w-full h-full">
                                <QuantumEqualizer />
                            </div>
                        )}
                        {layout.left === 'MATRIX_RAIN' && (
                            <div className="pointer-events-none absolute left-0 top-0 h-full">
                                <MatrixRainSkin
                                    width={squareSize || 400}
                                    height="100%"
                                    colorScheme="cyan"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Right Module Slot — unmounted entirely when PUSTKA */}
                {layout.right !== 'PUSTKA' && (
                    <div className="absolute right-0 top-0 w-full h-full z-10 pointer-events-none">
                        {layout.right === 'QUANTUM_EQUALIZER' && (
                            <div className="pointer-events-auto w-full h-full">
                                <QuantumEqualizer />
                            </div>
                        )}
                        {layout.right === 'MATRIX_RAIN' && (
                            <div className="pointer-events-none absolute right-0 top-0 h-full">
                                <MatrixRainSkin
                                    width={squareSize || 400}
                                    height="100%"
                                    colorScheme="magenta"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default KatedraOrbita;