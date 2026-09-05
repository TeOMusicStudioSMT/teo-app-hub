/**
 * 🔲 PrzyciskTokenowy — płaski przycisk na tokenach Katedry.
 *
 * ⚠️ TO POPRAWIONA WERSJA `_OtakOs_Wymiar/src/components/core/Button.tsx`.
 * Tamta składała klasy Tailwinda przez interpolację:
 *
 *     `px-${tokens.spacingUnit} rounded-${tokens.borderRadius} bg-[${tokens.primaryColor}]`
 *
 * czyli `px-1rem`, `rounded-12px`, `bg-[#A0E0FF]`. Tailwind skanuje ŹRÓDŁO
 * tekstowo — klas budowanych w locie NIGDY nie wygeneruje, więc przycisk
 * renderował się BEZ STYLU. Ta sama pułapka zapadła ramki modułów w Story V2
 * i kosztowała nas wtedy pół dnia szukania.
 *
 * Nazwa jest inna niż `Button`, bo w projekcie żyje już kilka przycisków —
 * dokładanie kolejnego `Button.tsx` skończyłoby się importem nie tego, co trzeba.
 */
import React from 'react';
import { tokeny, type TokenyWizualne } from '../../lib/designTokens';

export interface PrzyciskTokenowyProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Wiodący = wypełniony barwą rezonansu. Poboczny = sam obrys. */
    wiodacy?: boolean;
    t?: TokenyWizualne;
}

export const PrzyciskTokenowy: React.FC<PrzyciskTokenowyProps> = ({
    children, wiodacy = true, t, style, disabled, ...reszta
}) => {
    const tok = t ?? tokeny();

    // Wszystko idzie przez `style`, nie przez nazwy klas — dzięki temu wartości
    // z tokenów działają niezależnie od tego, co Tailwind zdążył zeskanować.
    const wspolne: React.CSSProperties = {
        padding: `calc(${tok.odstep} * 0.55) calc(${tok.odstep} * 1.15)`,
        borderRadius: tok.promien,
        fontWeight: 700,
        fontSize: 14,
        transition: 'filter .2s ease, background .2s ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
    };

    const wyglad: React.CSSProperties = wiodacy
        ? { background: tok.primary, color: '#0a0f1c', border: `1px solid ${tok.primary}`, boxShadow: tok.poswiata }
        : { background: 'rgba(30,41,59,0.6)', color: '#cbd5e1', border: `1px solid ${tok.obrys}` };

    return (
        <button {...reszta} disabled={disabled} style={{ ...wspolne, ...wyglad, ...style }}>
            {children}
        </button>
    );
};

export default PrzyciskTokenowy;
