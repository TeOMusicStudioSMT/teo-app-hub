/**
 * 🌑 KatedraOrbita v4
 *
 * Podłączona do activeAura z KatedraRadioContext.
 * Gdy agent mówi → Orbita zmienia kolor na jego aurę.
 * Gdy aura wygaśnie → wraca do złotego.
 *
 * 🗣️ ŚRODEK ORBITY TO NIEWIDZIALNY PRZYCISK. Kliknięcie łączy z aktualnie
 * wybranym jajem (aktywnym TeOgochi): kompan wita się swoim głosem, potem
 * słucha, a odpowiada własnym rdzeniem. To DOKŁADNIE ta sama logika, co
 * w Sferze — obie powierzchnie wołają `lib/rozmowaKompana`, a nie dwie kopie.
 *
 * ⚠️ Przycisk jest niewidzialny, ale NIE niemy: w trakcie rozmowy pod orbitą
 * pojawia się stan („słucha", „myśli", „mówi") i transkrypcja. Cichy przycisk,
 * po którym nie wiadomo, czy cokolwiek się dzieje, byłby gorszy niż jego brak.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { visualizerLayoutAtom, currentLyricAtom, isKaraokeEnabledAtom } from '../store/visualizerStore';

import { motion, AnimatePresence } from 'framer-motion';
import { useKatedraRadio } from '../context/KatedraRadioContext';
import QuantumEqualizer from './special/QuantumEqualizer';
import { useRozmowaKompana } from '../lib/rozmowaKompana';
import {
    ZDARZENIE_AKTYWACJI, silnikOrbity, ustawSilnikOrbity, chmuraGotowa,
    domenaSfery, ustawDomeneSfery, pamiec, zapomnij, type SilnikOrbity,
} from '../lib/mozgOrbity';
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
    // 🗣️ Rozmowa z wybranym jajem — ten sam hook, którego używa Sfera.
    const rozmowa = useRozmowaKompana();

    // 🌑 Mózg tła: silnik, własna pamięć i wołanie po domenie.
    const [ustawienia, setUstawienia] = useState(false);
    const [silnik, setSilnik] = useState<SilnikOrbity>(() => silnikOrbity());
    const [domena, setDomena] = useState(() => domenaSfery());
    const [sladow, setSladow] = useState(0);
    const chmura = chmuraGotowa();

    useEffect(() => {
        const przelicz = () => setSladow(pamiec().length);
        przelicz();
        const iv = setInterval(przelicz, 4000);
        return () => clearInterval(iv);
    }, []);

    // Wołanie po domenie Sfery budzi rozmowę tak samo jak dotknięcie środka.
    useEffect(() => {
        const naWywolanie = () => { if (rozmowa.faza === 'cisza') void rozmowa.dotknij(); };
        window.addEventListener(ZDARZENIE_AKTYWACJI, naWywolanie);
        return () => window.removeEventListener(ZDARZENIE_AKTYWACJI, naWywolanie);
    }, [rozmowa]);
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

    // 🐣 TeOgochi — żywe komentarze do lewej wieży STORYTELLER
    const teogochiRef = useRef<string[]>([]);
    const teogochiNameRef = useRef('TEOGOCHI');
    const teogochiLastRef = useRef({ lyric: '', at: 0 });
    useEffect(() => {
        if (staticMode) return;
        const tick = async () => {
            if (leftModuleRef.current !== 'STORYTELLER' || !radio.isPlaying) return;
            const lyric = radio.currentLyric || '';
            const now = Date.now();
            const changed = lyric && lyric !== teogochiLastRef.current.lyric;
            if (!changed && now - teogochiLastRef.current.at < 25_000) return;
            teogochiLastRef.current = { lyric, at: now };
            try {
                // Imię/etap/nastrój z lokalnego stanu tamagotchi (bez importu — unik cyklu zależności canvas)
                let tg: any = {};
                try { tg = JSON.parse(localStorage.getItem('teogochi_state') || '{}'); } catch {}
                if (tg.name) teogochiNameRef.current = String(tg.name).toUpperCase();
                const r = await fetch('http://127.0.0.1:3001/api/teogochi/comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ track: radio.currentTrack?.title, lyric, name: tg.name }),
                });
                const d = await r.json();
                if (d.success && d.comment) {
                    teogochiRef.current = [...teogochiRef.current, `🐣 ${d.comment}`].slice(-9);
                }
            } catch { /* most offline — wieża zostaje na statycznym lore */ }
        };
        const iv = setInterval(tick, 5_000);
        return () => clearInterval(iv);
    }, [staticMode, radio.isPlaying, radio.currentLyric, radio.currentTrack]);

    // 📢 Wieża Partnerów — aktywne reklamy do prawej wieży GRAVITON_GRID
    const adsRef = useRef<{ company: string; slogan: string }[]>([]);
    useEffect(() => {
        const load = async () => {
            try {
                const r = await fetch('http://127.0.0.1:3001/api/ads');
                const d = await r.json();
                if (d.success) adsRef.current = d.ads || [];
            } catch { /* most offline — dummy nodes zostają */ }
        };
        load();
        const iv = setInterval(load, 300_000); // co 5 min
        return () => clearInterval(iv);
    }, []);

    // 🫀 Puls Maszyny — dane sprzętowe do skórki PULS
    const pulseRef = useRef<{ ram?: any; cpu?: any; gpu?: any } | null>(null);
    useEffect(() => {
        const load = async () => {
            if (leftModuleRef.current !== 'PULS' && rightModuleRef.current !== 'PULS') return;
            try {
                const r = await fetch('http://127.0.0.1:3001/api/system/pulse');
                const d = await r.json();
                if (d.success) pulseRef.current = d;
            } catch { pulseRef.current = null; }
        };
        load();
        const iv = setInterval(load, 5_000);
        return () => clearInterval(iv);
    }, [layout]);

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

            // Matrix Scrolling Text — gdy TeOgochi komentuje na żywo, jego głos
            // zastępuje statyczny lore (kompan naprawdę słucha tego, co gra).
            s.storyScroll += 0.5;
            const lore = teogochiRef.current.length
                ? [`[ ${teogochiNameRef.current} · SŁUCHA NA ŻYWO ]`, ...teogochiRef.current]
                : [
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

            lore.forEach((line, index) => {
                let y = (index * lineHeight + s.storyScroll) % (H + lineHeight);
                if (y > H) y -= (H + lineHeight);
                // Dłuższe komentarze zawijamy ręcznie do szerokości wieży
                if (line.length > 42) {
                    ctx.fillText(line.slice(0, 42), 30, y);
                    ctx.fillText('   ' + line.slice(42, 84), 30, y + 18);
                } else {
                    ctx.fillText(line, 30, y);
                }
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

            // --- 📢 WIEŻA PARTNERÓW: opłacone reklamy firm (z /api/ads) ---
            const ads = adsRef.current;
            const adAreaTop = 100;
            if (ads.length) {
                ads.slice(0, 4).forEach((ad, i) => {
                    const ax = W - panelWidth + 24, ay = adAreaTop + i * 96, aw = panelWidth - 48, ah = 80;
                    ctx.save();
                    ctx.fillStyle = 'rgba(245, 158, 11, 0.07)';
                    ctx.strokeStyle = `hsla(40, 100%, 55%, 0.55)`;
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = 'hsla(40, 100%, 50%, 0.35)';
                    ctx.fillRect(ax, ay, aw, ah);
                    ctx.strokeRect(ax, ay, aw, ah);
                    ctx.shadowBlur = 0;
                    ctx.font = '700 15px "Inter", sans-serif';
                    ctx.fillStyle = 'hsla(40, 100%, 70%, 1)';
                    ctx.textAlign = 'left';
                    ctx.fillText(ad.company.slice(0, 30), ax + 14, ay + 28);
                    ctx.font = '11px "Space Mono", monospace';
                    ctx.fillStyle = 'rgba(255,255,255,0.7)';
                    ctx.fillText(ad.slogan.slice(0, 44), ax + 14, ay + 50);
                    ctx.font = '8px "Space Mono", monospace';
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillText('PARTNER KATEDRY', ax + 14, ay + 68);
                    ctx.restore();
                });
            } else {
                // Wolny slot — zaproszenie zamiast pustki
                ctx.font = '11px "Space Mono", monospace';
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.textAlign = 'center';
                ctx.fillText('TWOJA REKLAMA W KATEDRZE', W - panelWidth / 2, H - 60);
                ctx.fillStyle = `hsla(40, 100%, 60%, 0.7)`;
                ctx.fillText('otakos.wtf → REKLAMA', W - panelWidth / 2, H - 40);
            }

            ctx.restore();
        }

        // --- 🫀 WIEŻA: PULS MASZYNY (lewa lub prawa) ---
        const drawPulse = (side: 'left' | 'right') => {
            const panelWidth = 400;
            const x0 = side === 'left' ? 0 : W - panelWidth;
            const p = pulseRef.current;
            ctx.save();
            ctx.fillStyle = 'rgba(10, 5, 5, 0.85)';
            ctx.fillRect(x0, 0, panelWidth, H);
            ctx.strokeStyle = 'hsla(0, 90%, 55%, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(side === 'left' ? panelWidth : x0, 0);
            ctx.lineTo(side === 'left' ? panelWidth : x0, H);
            ctx.stroke();

            ctx.font = '700 18px "Inter", sans-serif';
            ctx.fillStyle = 'hsla(0, 90%, 70%, 1)';
            ctx.textAlign = 'center';
            ctx.fillText('[ PULS MASZYNY ]', x0 + panelWidth / 2, 50);

            if (!p) {
                ctx.font = '12px "Space Mono", monospace';
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText('most milczy — brak tętna', x0 + panelWidth / 2, H / 2);
                ctx.restore();
                return;
            }

            // Słupki życiowe: RAM / CPU / VRAM / TEMP — z EKG-pulsem przy wysokim obciążeniu
            const vitals: { label: string; pct: number; extra: string }[] = [
                { label: 'RAM', pct: p.ram?.pct ?? 0, extra: `${((p.ram?.usedMB ?? 0) / 1024).toFixed(1)} / ${((p.ram?.totalMB ?? 0) / 1024).toFixed(0)} GB` },
                { label: 'CPU', pct: p.cpu?.pct ?? 0, extra: `${p.cpu?.cores ?? '?'} rdzeni` },
            ];
            if (p.gpu) {
                vitals.push({ label: 'VRAM', pct: Math.round(p.gpu.vramUsedMB / p.gpu.vramTotalMB * 100), extra: `${(p.gpu.vramUsedMB / 1024).toFixed(1)} / ${(p.gpu.vramTotalMB / 1024).toFixed(0)} GB` });
                vitals.push({ label: 'TEMP', pct: Math.min(100, p.gpu.tempC), extra: `${p.gpu.tempC}°C GPU` });
            }

            const barW = panelWidth - 80, barH = 26, gap = 74, top = 120;
            vitals.forEach((v, i) => {
                const bx = x0 + 40, by = top + i * gap;
                const danger = v.pct >= 85;
                const pulse = danger ? 0.7 + 0.3 * Math.abs(Math.sin(Date.now() / 180)) : 1;
                const hue = v.pct < 60 ? 140 : v.pct < 85 ? 40 : 0;
                ctx.font = '700 12px "Space Mono", monospace';
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.textAlign = 'left';
                ctx.fillText(`${v.label}  ${v.pct}%`, bx, by - 8);
                ctx.textAlign = 'right';
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText(v.extra, bx + barW, by - 8);
                ctx.textAlign = 'left';
                ctx.fillStyle = 'rgba(255,255,255,0.07)';
                ctx.fillRect(bx, by, barW, barH);
                ctx.fillStyle = `hsla(${hue}, 90%, 50%, ${0.75 * pulse})`;
                ctx.shadowBlur = danger ? 18 : 6;
                ctx.shadowColor = `hsla(${hue}, 90%, 50%, 0.8)`;
                ctx.fillRect(bx, by, barW * (v.pct / 100), barH);
                ctx.shadowBlur = 0;
            });

            // Linia EKG na dole — serce Katedry bije w rytmie basu
            const ekgY = H - 120;
            ctx.strokeStyle = 'hsla(0, 90%, 60%, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let px = 0; px < panelWidth - 60; px += 2) {
                const t = (Date.now() / 6 + px) % 160;
                const spike = t < 8 ? Math.sin(t / 8 * Math.PI) * (26 + bassRef.current * 0.35) : 0;
                const y = ekgY - spike + Math.sin((px + Date.now() / 40) / 14) * 2;
                px === 0 ? ctx.moveTo(x0 + 30 + px, y) : ctx.lineTo(x0 + 30 + px, y);
            }
            ctx.stroke();
            ctx.restore();
        };
        if (leftModuleRef.current === 'PULS') drawPulse('left');
        if (rightModuleRef.current === 'PULS') drawPulse('right');

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

                {/* ── 🗣️ NIEWIDZIALNY PRZYCISK ŚRODKA ──────────────────────────
                    Bez tła, bez ramki, bez ikony — widać przez niego orbitę.
                    Klik łączy z wybranym jajem i prowadzi całą rozmowę. */}
                <button
                    onClick={() => { void rozmowa.dotknij(); }}
                    onContextMenu={(e) => { e.preventDefault(); setUstawienia(u => !u); }}
                    title={rozmowa.faza === 'cisza'
                        ? `Porozmawiaj z: ${rozmowa.kompan.imie} (${rozmowa.kompan.dziedzina}) · prawy klik = ustawienia Orbity`
                        : `${rozmowa.kompan.imie} — ${rozmowa.opisFazy}`}
                    aria-label={`Rozmowa z kompanem ${rozmowa.kompan.imie}`}
                    style={{
                        position: 'absolute',
                        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '22%', aspectRatio: '1 / 1',
                        minWidth: 64, maxWidth: 220,
                        borderRadius: '50%',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        zIndex: 20,
                        // Puls tylko wtedy, gdy rozmowa TRWA. W ciszy — nic.
                        boxShadow: rozmowa.faza === 'cisza'
                            ? 'none'
                            : `0 0 40px ${rozmowa.kompan.kolor}66, inset 0 0 30px ${rozmowa.kompan.kolor}33`,
                        transition: 'box-shadow .4s ease',
                    }}
                />

                {/* ── 🌑 USTAWIENIA ORBITY — prawy klik na środku ──────────────
                    Świadomie schowane: Orbita jest tłem, nie kolejnym panelem
                    zasłaniającym obraz. Widać je dopiero, gdy Suweren ich szuka. */}
                {ustawienia && (
                    <div className="absolute right-3 top-3 z-40 w-72 rounded-xl border border-white/10 bg-slate-950/90 p-3 backdrop-blur-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-slate-300">🌑 Mózg Orbity</span>
                            <button onClick={() => setUstawienia(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
                        </div>

                        <label className="block">
                            <span className="text-[10px] font-mono text-slate-500">silnik</span>
                            <select
                                value={silnik}
                                onChange={(e) => { const v = e.target.value as SilnikOrbity; setSilnik(v); ustawSilnikOrbity(v); }}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-slate-500"
                            >
                                <option value="ollama">Lokalna Ollama (nic nie wychodzi z maszyny)</option>
                                <option value="chmura" disabled={!chmura.gotowa}>
                                    Chmura{chmura.gotowa ? '' : ' — brak klucza w TeO Kibel'}
                                </option>
                            </select>
                            {!chmura.gotowa && (
                                <span className="text-[10px] text-amber-500/80 leading-relaxed">{chmura.powod}</span>
                            )}
                        </label>

                        <label className="block">
                            <span className="text-[10px] font-mono text-slate-500">domena Sfery — wypowiedz ją, a Orbita się zbudzi</span>
                            <input
                                value={domena}
                                onChange={(e) => { setDomena(e.target.value); ustawDomeneSfery(e.target.value); }}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-black/40 px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-slate-500"
                            />
                        </label>

                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-500">
                                pamięć własna: {sladow} śladów
                            </span>
                            <button
                                onClick={() => { zapomnij(); setSladow(0); }}
                                className="text-[10px] text-slate-500 hover:text-red-400"
                            >
                                zapomnij
                            </button>
                        </div>

                        <p className="text-[10px] text-slate-600 leading-relaxed">
                            Obserwacja jest pasywna i zostaje na tej maszynie. Orbita niczego nie wysyła
                            sama z siebie — zapisuje, co widziała, i czeka.
                        </p>
                    </div>
                )}

                {/* Stan rozmowy — pojawia się tylko, gdy coś się dzieje. */}
                <AnimatePresence>
                    {(rozmowa.faza !== 'cisza' || rozmowa.blad) && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute left-1/2 bottom-4 -translate-x-1/2 z-30 pointer-events-none
                                       max-w-[80%] rounded-xl px-3 py-2 text-center backdrop-blur-sm"
                            style={{ background: 'rgba(8,6,16,0.72)', border: `1px solid ${rozmowa.kompan.kolor}55` }}
                        >
                            <div className="text-[10px] font-mono" style={{ color: rozmowa.kompan.kolor }}>
                                {rozmowa.kompan.imie} · {rozmowa.opisFazy}
                            </div>
                            {rozmowa.blad
                                ? <div className="text-[11px] text-amber-400 mt-0.5">{rozmowa.blad}</div>
                                : rozmowa.tekst && (
                                    <div className="text-[12px] text-slate-200 mt-0.5 leading-snug line-clamp-3">
                                        {rozmowa.tekst}
                                    </div>
                                )}
                        </motion.div>
                    )}
                </AnimatePresence>

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