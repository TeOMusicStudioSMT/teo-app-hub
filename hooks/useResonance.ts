import { useState, useEffect } from 'react';

/**
 * 🌀 useResonance.ts - Hook Rezonansu Pola (Field Resonance)
 * 
 * "Im więcej puszczasz, tym bardziej JESTEŚ."
 * Zarządza poziomem Integracji użytkownika i odblokowywaniem Rady.
 * 
 * @author BoB & TeO
 */

export const useResonance = () => {
    const [resonance, setResonance] = useState<number>(0);
    const [isRadaUnlocked, setIsRadaUnlocked] = useState<boolean>(false);

    // Inicjalizacja z localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedResonance = localStorage.getItem('teo_field_resonance');
            const savedUnlocked = localStorage.getItem('teo_rada_unlocked');

            if (savedResonance) setResonance(parseInt(savedResonance, 10));
            if (savedUnlocked === 'true') setIsRadaUnlocked(true);
        }
    }, []);

    /**
     * 🆙 Aktualizuj rezonans na podstawie "Odpuszczania" (Flush)
     */
    const addResonance = (amount: number) => {
        if (amount <= 0) return;

        setResonance(prev => {
            const next = Math.min(100, prev + amount);
            localStorage.setItem('teo_field_resonance', next.toString());

            // Odblokowanie Rady przy 100%
            if (next === 100 && !isRadaUnlocked) {
                setIsRadaUnlocked(true);
                localStorage.setItem('teo_rada_unlocked', 'true');
            }

            return next;
        });
    };

    /**
     * 🧼 Resetuj rezonans (tylko dla celów deweloperskich / hard reset)
     */
    const resetResonance = () => {
        setResonance(0);
        setIsRadaUnlocked(false);
        localStorage.removeItem('teo_field_resonance');
        localStorage.removeItem('teo_rada_unlocked');
    };

    return {
        resonance,
        isRadaUnlocked,
        addResonance,
        resetResonance
    };
};
