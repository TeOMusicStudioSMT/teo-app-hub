/**
 * 🌍 Tłumacz Katedry dla apek w Pierścieniu (studia, gry z /apki/, buildy z /apps/, Świat).
 *
 * Wpięcie: `<script type="module" src="http://127.0.0.1:3001/tlumacz.js"></script>` w index.html apki
 * (most sam dokleja to w HTML spod /apps/, /apki/ i /swiat/). Rdzeń = lib/tlumaczRdzen.js (ten sam co w Hubie),
 * serwowany przez most pod /tlumacz-rdzen.js.
 *
 * Język przychodzi z Huba: Pierścień (components/PierscienApek.tsx) wysyła `postMessage({typ:'otakos-jezyk', jezyk})`
 * każdej warstwie po załadowaniu i przy zmianie; apka sama pyta rodzica `{typ:'otakos-jezyk?'}` na starcie.
 * Przyjmujemy tylko od rodzica z tej maszyny (localhost/127.0.0.1/[::1]) albo z originu mostu. Ostatni język apka
 * pamięta (localStorage `otakos_tl_jezyk` swojego originu) — po przeładowaniu warstwy nie mruga polskim.
 * W apce: `window.__otakosTlumacz` {ustawJezyk, obserwujStan, stan}.
 */
import { utworzTlumacza, czyOriginKatedry, kodJezyka } from './tlumacz-rdzen.js';

const KLUCZ = 'otakos_tl_jezyk';

if (!window.__otakosTlumacz) {
    const most = new URL(import.meta.url).origin;
    const t = utworzTlumacza({ most });
    window.__otakosTlumacz = t;

    let zapamietany = null;
    try { zapamietany = kodJezyka(localStorage.getItem(KLUCZ)); } catch { /* prywatne okno */ }
    if (zapamietany && zapamietany !== 'pl') void t.ustawJezyk(zapamietany);

    window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.typ !== 'otakos-jezyk') return;
        if (e.source !== window.parent || window.parent === window) return;   // tylko okno, które nas osadziło (Hub)
        if (!czyOriginKatedry(e.origin, most)) return;
        const j = kodJezyka(d.jezyk);
        if (!j) return;
        try { localStorage.setItem(KLUCZ, j); } catch { /* bez pamięci */ }
        void t.ustawJezyk(j);
    });

    // Warstwa wstała później niż Hub wysłał język (albo przeładowana ↻) — zapytaj. Pytanie nic nie zdradza.
    if (window.parent !== window) { try { window.parent.postMessage({ typ: 'otakos-jezyk?' }, '*'); } catch { /* brak rodzica */ } }
}
