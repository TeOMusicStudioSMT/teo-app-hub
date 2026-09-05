/**
 * 🎨 Tokeny wizualne Katedry — jedno źródło prawdy dla komponentów przestrzennych.
 *
 * ⚠️ TO JEST PRZEPISANA WERSJA `_OtakOs_Wymiar/src/design-tokens/tokens.ts`.
 * Tamta miała wpisane na sztywno `#A0E0FF`, `#FF6B6B`, `#0D0D1A` — barwy, których
 * w Katedrze nie ma. Komponenty na nich oparte wyglądałyby jak wklejone z innej
 * aplikacji. Teraz kolory biorą się z rezonansu (`RESONANCE_THEMES`), a więc
 * z tego samego miejsca, co reszta interfejsu.
 *
 * ⚠️ DRUGA, WAŻNIEJSZA POPRAWKA — TAILWIND.
 * Pierwotny `Button.tsx` budował klasy przez interpolację:
 *
 *     `px-${tokens.spacingUnit} rounded-${tokens.borderRadius} bg-[${tokens.primaryColor}]`
 *
 * co daje `px-1rem`, `rounded-12px`, `bg-[#A0E0FF]`. Tailwind skanuje ŹRÓDŁO
 * tekstowo i klas składanych w locie NIGDY nie generuje — przycisk wyszedłby
 * bez stylu. To dokładnie ta sama pułapka, która zapadła ramki w Story V2.
 * Dlatego tokeny oddajemy jako **wartości CSS do `style`**, a nie jako fragmenty
 * nazw klas.
 */
import type React from 'react';
import { RESONANCE_THEMES, type ResonanceColorKey } from '../store/personalization';

export interface TokenyWizualne {
    /** Barwa wiodąca — z aktywnego rezonansu Katedry. */
    primary: string;
    /** Akcent — cieplejszy kontrapunkt do barwy wiodącej. */
    accent: string;
    /** Tło kontenerów. */
    tlo: string;
    /** Tło o stopień jaśniejsze — karty na tle. */
    tloKarty: string;
    /** Obrys. */
    obrys: string;
    /** Promień zaokrąglenia (CSS). */
    promien: string;
    /** Jednostka odstępu (CSS). */
    odstep: string;
    /** Poświata pod barwę wiodącą. */
    poswiata: string;
}

/** Akcent dobierany do rezonansu — nie jeden na sztywno dla wszystkich. */
const AKCENT: Record<string, string> = {
    nebula: '#f472b6', ocean: '#38bdf8', forest: '#a3e635',
    ember: '#fbbf24', void: '#94a3b8',
};

/**
 * Tokeny dla danego rezonansu. Bez argumentu — Nebula, czyli domyślny wygląd
 * Katedry; nie wymyślona paleta.
 */
export function tokeny(rezonans: ResonanceColorKey = 'nebula'): TokenyWizualne {
    const motyw = RESONANCE_THEMES[rezonans] ?? RESONANCE_THEMES.nebula;
    const primary = motyw.hex;
    return {
        primary,
        accent: AKCENT[rezonans] ?? '#f472b6',
        tlo: '#020617',          // slate-950 — tło Katedry
        tloKarty: 'rgba(15,23,42,0.55)',
        obrys: 'rgba(148,163,184,0.18)',
        promien: '12px',
        odstep: '1rem',
        poswiata: `0 0 24px ${primary}40`,
    };
}

/**
 * Gotowy `style` dla powierzchni (karta, panel). Oddajemy OBIEKT STYLU, bo
 * tylko on przechodzi przez Tailwinda bez udziału skanera klas.
 */
export function stylPowierzchni(t: TokenyWizualne, aktywna = false): React.CSSProperties {
    return {
        background: t.tloKarty,
        border: `1px solid ${aktywna ? t.primary : t.obrys}`,
        borderRadius: t.promien,
        padding: t.odstep,
        boxShadow: aktywna ? t.poswiata : undefined,
    };
}

export default { tokeny, stylPowierzchni };
