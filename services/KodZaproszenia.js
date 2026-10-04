/**
 * 🗝️ Kod zaproszenia przy pierwszym wejściu do Katedry.
 *
 * Suweren (2026-10-04): „chcę dać możliwość wpisania kodu przed pierwszą instalacją, który przyzna użytkownikom GRV”
 * → kod daje nowemu węzłowi 12 345 GRV zamiast zwykłych 1000 (decyzja Suwerena). Wpisuje się go w Katedrze przy
 * pierwszym wejściu (krok „Twój węzeł w księdze GRV”), bo tam żyje księga — nadanie jest prawdziwym wpisem
 * z pieczęcią w łańcuchu, a nie obietnicą strony.
 *
 * Słowo kodu = hasło kręgu Filarów (`HASLO_FILARA` w services/Rangi.js) — jawne z założenia, „to zaproszenie, nie
 * sekret”. Jedno źródło prawdy: zmiana hasła w Rangach zmienia też kod startowy.
 * Kod działa RAZ na księgę (pierwszy węzeł, który go użyje) i tylko przy rejestracji NOWEGO węzła.
 */
import { HASLO_FILARA } from './Rangi.js';

/** Normalizacja tego, co człowiek wpisał: „ kod ”, „Kod”, „KOD”, „K O D”, ogonki — to samo. */
export const normalizujKod = (kod) => String(kod ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/gi, 'L')
    .replace(/\s+/g, '').toUpperCase();

/** Kody startowe: słowo (po normalizacji) → co dostaje nowy węzeł. */
export const KODY = {
    [normalizujKod(HASLO_FILARA)]: { id: 'zaproszenie-filarow', grv: 12_345 },
};

/** Kod → { id, grv } albo null (zły / pusty). */
export function sprawdzKod(kod, kody = KODY) {
    const n = normalizujKod(kod);
    return n ? (kody[n] ?? null) : null;
}

/**
 * Czy ten kod można jeszcze użyć w tej księdze. `uzyte` = `L.kody` (mapa id kodu → węzeł, który go użył).
 * Zwraca { ok, kod?, powod? }.
 */
export function kodDoUzycia(kod, uzyte = {}, kody = KODY) {
    const k = sprawdzKod(kod, kody);
    if (!k) return { ok: false, powod: 'Nieprawidłowy kod zaproszenia.' };
    if (uzyte?.[k.id]) return { ok: false, powod: `Ten kod został już użyty w tej Katedrze (węzeł „${uzyte[k.id]}”).` };
    return { ok: true, kod: k };
}

export default { KODY, normalizujKod, sprawdzKod, kodDoUzycia };
