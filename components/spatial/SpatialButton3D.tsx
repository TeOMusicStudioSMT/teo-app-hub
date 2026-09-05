/**
 * 🔘 SpatialButton3D — przycisk z głębią.
 *
 * ⚠️ NAPISANY OD NOWA, jak SpatialCard3D. Wersja z `_OtakOs_Wymiar/src` poza
 * brakiem three.js miała dwa błędy, które wywaliłyby ją od razu:
 *   · `useCallback` był używany, ale NIE zaimportowany,
 *   · renderowała `<TextCube>` — komponent, którego nie ma w żadnym pliku.
 *
 * Zamysł zostaje: przycisk, który wypycha się ku kursorowi i świeci barwą
 * rezonansu. Robią to transformacje CSS — bez renderera i bez zależności.
 */
import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { tokeny, type TokenyWizualne } from '../../lib/designTokens';

export interface SpatialButton3DProps {
    children: React.ReactNode;
    onClick?: () => void;
    /** Barwa; domyślnie wiodąca z rezonansu Katedry. */
    barwa?: string;
    t?: TokenyWizualne;
    disabled?: boolean;
}

const PRZECHYL = 12;

export const SpatialButton3D: React.FC<SpatialButton3DProps> = ({
    children, onClick, barwa, t, disabled = false,
}) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [obrot, setObrot] = useState({ x: 0, y: 0 });
    const [pod, setPod] = useState(false);

    const tok = t ?? tokeny();
    const kolor = barwa ?? tok.primary;

    const naRuch = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setObrot({ x: -py * PRZECHYL * 2, y: px * PRZECHYL * 2 });
    }, [disabled]);

    return (
        <div style={{ perspective: 600, display: 'inline-block' }}>
            <motion.button
                ref={ref}
                type="button"
                disabled={disabled}
                onMouseMove={naRuch}
                onMouseEnter={() => !disabled && setPod(true)}
                onMouseLeave={() => { setObrot({ x: 0, y: 0 }); setPod(false); }}
                onClick={onClick}
                animate={{ rotateX: obrot.x, rotateY: obrot.y, z: pod ? 14 : 0 }}
                whileTap={disabled ? undefined : { scale: 0.96, z: 4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                    transformStyle: 'preserve-3d',
                    padding: `calc(${tok.odstep} * 0.55) calc(${tok.odstep} * 1.1)`,
                    borderRadius: tok.promien,
                    border: `1px solid ${disabled ? tok.obrys : kolor}`,
                    background: disabled ? 'rgba(15,23,42,0.5)' : `${kolor}1f`,
                    color: disabled ? '#64748b' : kolor,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    boxShadow: pod ? `0 10px 24px -8px ${kolor}80` : 'none',
                }}
            >
                <span style={{ transform: 'translateZ(16px)', display: 'inline-block' }}>{children}</span>
            </motion.button>
        </div>
    );
};

export default SpatialButton3D;
