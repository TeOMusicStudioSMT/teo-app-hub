/**
 * 🫧 FloatingButton — unosząca się kula akcji.
 *
 * ⚠️ NAPISANY OD NOWA. Wersja z `_OtakOs_Wymiar/src` importowała `Mesh`
 * z `@react-three/fiber` (fiber tego nie eksportuje — to klasa THREE),
 * destrukturyzowała `camera` i nigdy jej nie używała, a `tokens.primaryColor`
 * podawała jako `emissive` materiału, którego bez renderera i tak nie ma.
 *
 * Zamysł — świecąca kula, która oddycha i zaprasza do kliknięcia — robi się
 * gradientem i animacją CSS, bez WebGL-a.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { tokeny, type TokenyWizualne } from '../../lib/designTokens';

export interface FloatingButtonProps {
    onClick?: () => void;
    /** Znak w środku — emoji albo litera. */
    znak?: string;
    tytul?: string;
    barwa?: string;
    t?: TokenyWizualne;
    /** Róg ekranu; `false` = zwykły element w przepływie. */
    przypieta?: boolean;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({
    onClick, znak = '✦', tytul, barwa, t, przypieta = false,
}) => {
    const tok = t ?? tokeny();
    const kolor = barwa ?? tok.primary;

    return (
        <motion.button
            type="button"
            onClick={onClick}
            title={tytul}
            aria-label={tytul ?? 'Akcja'}
            // Oddech: delikatna pulsacja poświaty. Bez skalowania samego przycisku,
            // bo skakanie geometrii pod kursorem czyta się jak usterka.
            animate={{ boxShadow: [`0 0 18px ${kolor}55`, `0 0 34px ${kolor}88`, `0 0 18px ${kolor}55`] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
                position: przypieta ? 'fixed' : 'relative',
                right: przypieta ? 24 : undefined,
                bottom: przypieta ? 24 : undefined,
                zIndex: przypieta ? 60 : undefined,
                width: 56, height: 56, borderRadius: '50%',
                border: `1px solid ${kolor}`,
                background: `radial-gradient(circle at 35% 30%, ${kolor}55, ${tok.tlo} 70%)`,
                color: kolor, fontSize: 22, lineHeight: 1, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {znak}
        </motion.button>
    );
};

export default FloatingButton;
