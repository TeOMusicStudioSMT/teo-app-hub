/**
 * 🌍 tlumaczDom — Katedra w dowolnym języku bez przepisywania ekranów (Hub).
 *
 * Rdzeń (zbieranie tekstów z ekranu, słownik z mostu, pamięć w localStorage, pomijanie pól, kodu, translate="no"
 * i [data-bez-tlumaczenia]) siedzi w lib/tlumaczRdzen.js — ten sam plik most serwuje apkom w Pierścieniu
 * (`/tlumacz-rdzen.js` + `/tlumacz.js`), więc Hub i apki tłumaczą identycznie. Tu: tłumacz dokumentu Huba.
 */
import { utworzTlumacza, doTlumaczenia as filtr } from './tlumaczRdzen.js';

const MOST = 'http://127.0.0.1:3001';

export interface StanTlumacza { jezyk: string; czeka: number; tlumaczy: boolean; blad: string | null }

const tlumacz = utworzTlumacza({ most: MOST });

/** Ten sam filtr co w moście: słowa tak, liczby/adresy/pliki nie. */
export const doTlumaczenia = (t: string): boolean => filtr(t);

/** Włącz tłumaczenie na język (`pl` = oryginał). Wołane przez I18nProvider przy starcie i zmianie języka. */
export const ustawJezyk = (j: string): Promise<void> => tlumacz.ustawJezyk(j);

export const obserwujStan = (f: (s: StanTlumacza) => void): (() => void) => tlumacz.obserwujStan(f);
export const stanTlumacza = (): StanTlumacza => tlumacz.stan();
