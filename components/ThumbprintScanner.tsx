import React, { useEffect, useRef } from 'react';

export const ThumbprintScanner: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const scanline = svg.querySelector('.scan-line');
        if (scanline) {
            scanline.classList.add('animate-scan');
        }
    }, []);

    return (
        <div className="relative w-60 h-60 md:w-80 md:h-80 rounded-full flex items-center justify-center bg-slate-800/80 border border-lime-700/50 backdrop-blur-sm z-10">
            <svg ref={svgRef} className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                {/* Pulsing background rings */}
                <g className="animate-pulse">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(163, 230, 53, 0.2)" strokeWidth="0.5" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(163, 230, 53, 0.3)" strokeWidth="0.5" />
                </g>
                
                {/* Main static rings */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#a3e635" strokeWidth="0.5" opacity="0.4" />
                
                {/* Thumbprint-like arcs */}
                <path d="M 35 65 A 15 15 0 0 1 65 65" fill="none" stroke="rgba(163, 230, 53, 0.5)" strokeWidth="1"/>
                <path d="M 40 60 A 10 10 0 0 1 60 60" fill="none" stroke="rgba(163, 230, 53, 0.6)" strokeWidth="1"/>
                <path d="M 45 55 A 5 5 0 0 1 55 55" fill="none" stroke="rgba(163, 230, 53, 0.7)" strokeWidth="1"/>
                <path d="M 30 70 A 20 20 0 0 1 70 70" fill="none" stroke="rgba(163, 230, 53, 0.4)" strokeWidth="1"/>


                {/* Animated Scan Line */}
                <line
                    x1="50" y1="25"
                    x2="50" y2="75"
                    stroke="#a3e635"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="scan-line origin-center"
                    style={{ filter: 'drop-shadow(0 0 3px #a3e635)' }}
                />
            </svg>
            <h1 className="text-xl font-bold text-lime-400 text-center z-10 drop-shadow-[0_0_5px_rgba(163,230,53,0.7)]">
                TeO Hub
            </h1>
        </div>
    );
};