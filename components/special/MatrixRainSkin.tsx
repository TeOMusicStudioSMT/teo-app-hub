/**
 * 🟩 MatrixRainSkin — Deszcz Matrixa
 *
 * NAPRAWKA:
 *  - Próg resetu cząstek: containerRef.offsetHeight zamiast `height as unknown as number`
 *    (poprzednia wersja: `'100vh' as unknown as number = NaN` → cząstki nigdy się nie resetowały,
 *     padały poza ekran i znikały na stałe po ~2 sekundach)
 *  - Cząstki resetują się na górę zaraz po przekroczeniu dolnej krawędzi kontenera
 */

import React, { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';

interface MatrixRainProps {
    width:        number;                      // Szerokość (px) — dla rozmieszczenia cząstek
    height?:      number | string;             // Wysokość CSS kontenera (string) lub próg resetu (number)
    colorScheme:  'cyan' | 'magenta' | 'gold';
}

interface RainParticle {
    id:    number;
    x:     number;
    y:     number;
    speed: number;   // px/ms — indywidualne tempo dla każdej cząstki
    size:  number;   // px — długość strumienia
    color: string;
}

const PARTICLE_COUNT = 60;

const colorMap: Record<MatrixRainProps['colorScheme'], string> = {
    cyan:    'rgba(0, 255, 255, 0.85)',
    magenta: 'rgba(255, 0, 255, 0.85)',
    gold:    'rgba(255, 215, 0, 0.85)',
};

const MatrixRainSkin: FC<MatrixRainProps> = ({ width, colorScheme, height = '100%' }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Pozycje cząstek aktualizowane poza React (rAF nie triggeruje renderów)
    const particlesRef = useRef<RainParticle[]>([]);
    const animIdRef    = useRef<number>(0);
    const lastTimeRef  = useRef<number>(0);

    // Tylko "tick" jest stanem React — minimalizuje re-rendery
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const color = colorMap[colorScheme];

        // ── Inicjalizacja cząstek ──────────────────────────────────────────────
        const containerH = containerRef.current?.offsetHeight ?? window.innerHeight;

        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
            id:    i,
            x:     Math.random() * width,
            y:     Math.random() * -containerH,   // start rozłożony PONAD kontenerem
            speed: 0.08 + Math.random() * 0.22,   // px/ms: 80–300 px/s (różne prędkości)
            size:  Math.random() * 14 + 4,         // 4–18 px
            color,
        }));

        lastTimeRef.current = performance.now();

        // ── Pętla animacji ─────────────────────────────────────────────────────
        const animate = (time: DOMHighResTimeStamp) => {
            const dt = time - lastTimeRef.current;
            lastTimeRef.current = time;

            // Próg resetu: rzeczywista wysokość kontenera (lub fallback)
            const resetH = containerRef.current?.offsetHeight ?? window.innerHeight;

            particlesRef.current = particlesRef.current.map(p => {
                let newY = p.y + dt * p.speed;

                // ✅ Poprawny reset — gdy cząstka wychodzi poza dół, wraca na górę
                if (newY > resetH + p.size) {
                    newY = -(p.size + Math.random() * 40);
                }

                return { ...p, y: newY };
            });

            // Jeden setState co klatkę — minimalne koszty React
            forceUpdate(n => n + 1);

            animIdRef.current = requestAnimationFrame(animate);
        };

        animIdRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animIdRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, colorScheme]); // reinicjalizuj tylko przy zmianie propów

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden"
            style={{ width: `${width}px`, height }}
        >
            {particlesRef.current.map(p => (
                <div
                    key={p.id}
                    style={{
                        position:        'absolute',
                        left:            `${p.x}px`,
                        top:             `${p.y}px`,
                        width:           '1px',
                        height:          `${p.size}px`,
                        backgroundColor: p.color,
                        boxShadow:       `0 0 4px ${p.color}, 0 0 8px ${p.color}50`,
                        opacity:         0.75,
                        borderRadius:    '1px',
                        pointerEvents:   'none',
                    }}
                />
            ))}
        </div>
    );
};

export default MatrixRainSkin;
