import React from "react";
import { motion } from "framer-motion";

interface FuzzyTextProps {
    children: React.ReactNode;
    fontSize?: string | number;
    fontWeight?: string | number;
    fontFamily?: string;
    color?: string;
    enableHover?: boolean;
    baseIntensity?: number;
    hoverIntensity?: number;
}

export const FuzzyText: React.FC<FuzzyTextProps> = ({
    children,
    fontSize = "clamp(2rem, 8vw, 6rem)",
    fontWeight = 900,
    fontFamily = "inherit",
    color = "#fff",
    enableHover = true,
    baseIntensity = 0.18,
    hoverIntensity = 0.5,
}) => {
    return (
        <div style={{ position: "relative", overflow: "hidden" }}>
            <svg style={{ position: "absolute", width: 0, height: 0 }}>
                <defs>
                    <filter id="fuzzy-filter">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency={baseIntensity}
                            numOctaves="1"
                            result="noise"
                        />
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="noise"
                            scale={enableHover ? hoverIntensity * 5 : 2}
                        />
                    </filter>
                </defs>
            </svg>

            <motion.div
                style={{
                    fontSize,
                    fontWeight,
                    fontFamily,
                    color,
                    filter: "url(#fuzzy-filter)", // Aplikujemy filtr
                }}
                whileHover={enableHover ? { opacity: 0.8 } : {}}
            >
                {children}
            </motion.div>
        </div>
    );
};