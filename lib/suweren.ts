/**
 * 👑 suweren — kto jest gospodarzem tego węzła.
 *
 * Służy do chowania paneli sterowania maszyną (Kwantowy Tunel/Pilot) przed
 * przypadkowymi gośćmi publicznego wdrożenia (graviton.pw).
 *
 * ⚠️ UCZCIWIE O SILE TEJ ZASŁONY: to jest kontrola po stronie przeglądarki.
 * Zasłania panel przed gościem, ale NIE jest zamkiem — kod frontu jest jawny,
 * a localStorage da się podmienić w narzędziach deweloperskich. Prawdziwym
 * zamkiem jest autoryzacja po stronie Mostu (klucz sesji + tryb ograniczony
 * dla żądań z tunelu). Dopóki jej nie ma, adres tunelu pozostaje sekretem.
 *
 * Konfiguracja: `VITE_SUWEREN_EMAIL` w `.env` (można podać kilka po przecinku).
 */

const DEFAULT_SUWEREN = 'teo@teo.center';

/** Lista kont uznawanych za Suwerena (małe litery, bez spacji). */
export const SUWEREN_EMAILS: string[] = String(
    (import.meta as any).env?.VITE_SUWEREN_EMAIL || DEFAULT_SUWEREN
)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

/**
 * Czy Katedra działa lokalnie (na maszynie Suwerena, nie na publicznym hostingu)?
 * Live-USB i `npm run dev` jadą z localhost/pliku — tam gospodarzem jest ten,
 * kto siedzi przy klawiaturze, więc pytanie o konto Google nie ma sensu.
 */
export function isLocalKatedra(): boolean {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '' || h === '[::1]'
        || h.endsWith('.local') || window.location.protocol === 'file:';
}

/** E-mail zalogowanego TeOnauty (z Bramy) albo null. */
export function currentEmail(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('teonauta_data');
        if (!raw) return null;
        const email = JSON.parse(raw)?.email;
        return typeof email === 'string' && email ? email.toLowerCase() : null;
    } catch { return null; }
}

/** Czy bieżący użytkownik to gospodarz tego węzła. */
export function isSuweren(): boolean {
    if (isLocalKatedra()) return true;      // własna maszyna — zawsze gospodarz
    const email = currentEmail();
    return !!email && SUWEREN_EMAILS.includes(email);
}
