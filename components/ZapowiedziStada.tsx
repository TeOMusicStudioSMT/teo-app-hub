/**
 * 🔊 Zapowiedzi Stada — Katedra mówi na głos, gdy stado skończy projekt.
 *
 * Suweren (2026-09-27): „niech stół ma też jakieś powiadomienie głosowe jak wykona projekt".
 * Most (services/ProjektStada.js) przy końcu projektu nadaje na szynę zdarzenie z `dane.glos` —
 * gotowym zdaniem do wypowiedzenia. Tu tylko słuchamy szyny i mówimy tym, co Katedra ma
 * (lokalny głos mostu → synteza przeglądarki). Na telefonie to samo robi StoL.
 * Wyłączenie: localStorage `otakos_zapowiedzi` = "0".
 */
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { sluchajSzyny } from '../lib/szyna';
import { speak } from '../services/voiceService';

export const KLUCZ_ZAPOWIEDZI = 'otakos_zapowiedzi';

const wlaczone = () => { try { return localStorage.getItem(KLUCZ_ZAPOWIEDZI) !== '0'; } catch { return true; } };

/** Zdanie do powiedzenia albo null — tylko zdarzenia z gotowym `dane.glos`. */
export function zapowiedz(z: { dane?: unknown }): string | null {
    const glos = (z.dane as { glos?: unknown } | null | undefined)?.glos;
    return typeof glos === 'string' && glos.trim() ? glos.trim().slice(0, 300) : null;
}

export default function ZapowiedziStada() {
    useEffect(() => sluchajSzyny((z) => {
        const tekst = zapowiedz(z);
        if (!tekst) return;
        toast(tekst, { icon: '🔊', duration: 8000 });
        if (wlaczone()) void speak(tekst, { nieprzerywaj: true });
    }), []);
    return null;
}
