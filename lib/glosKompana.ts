/**
 * 🐣🔊 glosKompana — Joanna przestaje być niema.
 *
 * Dotąd `TeOgochiDom.say()` tylko wypełniał dymek tekstem. Kompan pisał,
 * ale nie mówił — a `speakAloud` był podpięty wyłącznie pod aury agentów
 * w czacie, nie pod Dom.
 *
 * Tor mowy jest ten sam co u reszty Katedry (`services/voiceService`):
 * najpierw lokalny silnik klonu na :5002, a gdy go nie ma — synteza
 * przeglądarki. Zero VRAM, zero chmury, działa od razu, a podbija się samo,
 * gdy Suweren postawi XTTS.
 *
 * ⚠️ CZEGO TEN TOR NIE POTRAFI: mowy z przeglądarki NIE DA SIĘ wpiąć w Web Audio,
 * więc głos Joanny **nie wejdzie na antenę** wideopodcastu. Na transmisji usłyszysz
 * ją dopiero z lokalnego silnika. To ograniczenie samego `speechSynthesis`,
 * nie naszego kodu — patrz PodcastCore, gdzie ta sama granica już obowiązuje.
 */

import {
    speak, ucisz, czyJestGlosPl, czyWolnoMowic, nazwaGlosu, type ZrodloGlosu,
} from '../services/voiceService';

const KLUCZ = 'teogochi_glos';

/**
 * Profil głosowy kompana: głos ŻEŃSKI, odrobinę wyżej i wolniej niż domyślny —
 * Joanna ma brzmieć ciepło, nie jak lektor komunikatów kolejowych.
 *
 * `rodzaj: 'zenski'` NIE jest ozdobnikiem. Zmierzone na żywej przeglądarce:
 * w systemie są dwa polskie głosy, „Microsoft Adam" i „Microsoft Paulina",
 * i bez tego pola Joanna dostawała pierwszy z listy — czyli Adama.
 * Dotyczy toru przeglądarki; lokalny klon ma własną barwę z próbki.
 */
export const PROFIL_JOANNY = { pitch: 1.15, rate: 0.95, rodzaj: 'zenski' } as const;

/** Identyfikator próbki dla lokalnego silnika klonu (`_OtakOs_AI/voices/joanna.wav`). */
export const KLON_JOANNY = 'joanna';

export function czyGlosWlaczony(): boolean {
    if (typeof localStorage === 'undefined') return false;
    // Domyślnie WŁĄCZONY — Suweren prosił o głos, więc brak wpisu znaczy „tak".
    // Wyciszenie jest świadomą decyzją i wtedy zapisuje się jawnie.
    return localStorage.getItem(KLUCZ) !== '0';
}

export function ustawGlos(wlaczony: boolean): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KLUCZ, wlaczony ? '1' : '0');
    if (!wlaczony) ucisz();
}

/**
 * Powiedz zdanie głosem kompana. Zwraca faktyczne źródło dźwięku albo
 * `'wylaczony'`, gdy Suweren go uciszył.
 *
 * `'cisza'` znaczy, że NIC nie zabrzmiało (brak gestu użytkownika albo brak
 * syntezatora) — wołający ma prawo to pokazać zamiast zakładać, że słychać.
 */
export async function powiedzJakKompan(tekst: string): Promise<ZrodloGlosu | 'wylaczony'> {
    if (!czyGlosWlaczony()) return 'wylaczony';
    return speak(tekst, { voiceId: KLON_JOANNY, ...PROFIL_JOANNY });
}

/**
 * Dlaczego (ewentualnie) nie słychać — zdanie wprost do pokazania w UI.
 * `null` znaczy, że nie ma o czym mówić.
 */
export function czemuNieSlychac(): string | null {
    if (!czyGlosWlaczony()) return null;                    // sam wyciszył, wie o tym
    if (!czyWolnoMowic()) return 'Kliknij cokolwiek — przeglądarka nie puści dźwięku przed pierwszym kliknięciem.';
    if (!czyJestGlosPl()) return 'Brak polskiego głosu w systemie — czyta głosem domyślnym, więc wymowa będzie kulawa.';
    return null;
}

/** Czym Joanna faktycznie mówi — np. „Microsoft Paulina". `null` = jeszcze nie wiadomo. */
export function ktoMowi(): string | null {
    return nazwaGlosu(PROFIL_JOANNY.rodzaj);
}

export { ucisz };
