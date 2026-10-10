/**
 * 🌍 tlumaczRdzen — rdzeń Tłumacza DOM, bez Reacta i bez bundlera (czysty moduł ES).
 *
 * Jedno źródło dla dwóch miejsc (Suweren 2026-10-10: „czy tłumacz z Huba działa też na stronach apek w karuzeli?”):
 *   · Hub — lib/tlumaczDom.ts tworzy tłumacza na własnym dokumencie;
 *   · apki w Pierścieniu (studia na swoich portach, gry z /apki/, buildy z /apps/) — most serwuje ten plik pod
 *     `/tlumacz-rdzen.js`, a `/tlumacz.js` (public/tlumacz.js) odpala go w apce i słucha języka z Huba.
 *
 * Katedra jest pisana po polsku (źródło prawdy). Po wyborze innego języka tłumacz zbiera teksty z ekranu
 * (węzły tekstu + placeholder/title/aria-label/alt), podmienia je tłumaczeniami ze słownika i pyta most
 * (services/Tlumacz.js) o brakujące — most tłumaczy je lokalnym modelem i zapamiętuje na dysku węzła.
 *
 * Bezpieczne dla Reacta: zmieniamy tylko `nodeValue` istniejących węzłów tekstu i wartości atrybutów (jak tłumacz
 * przeglądarki, ale bez owijania w <font>, które psuje React). Gdy React wpisze nowy tekst, obserwator go widzi,
 * zapamiętuje nowy polski oryginał i tłumaczy od nowa. Powrót na „pl" przywraca oryginały.
 *
 * Pomijane: pola do pisania, kod (<code>/<pre>), contenteditable, wszystko pod `translate="no"`,
 * `.notranslate` i `[data-bez-tlumaczenia]` (rozmowy z agentami — to treść, nie interfejs), oraz liczniki,
 * które zmieniają się co chwilę (nie mielimy modelu na „⟳ 45%").
 */

export const ATRYBUTY = ['placeholder', 'title', 'aria-label', 'alt'];
const POMIN_TAGI = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'KBD', 'SAMP', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME']);
export const KLUCZ_PAMIECI = (j) => `otakos_tl_${j}`;
const TEKST = 3, ELEMENT = 1, DOKUMENT = 9, FRAGMENT = 11;
const POKAZ_TEKST = 4;   // NodeFilter.SHOW_TEXT

/** Ten sam filtr co w moście: słowa tak, liczby/adresy/pliki nie. */
export function doTlumaczenia(t) {
    const s = String(t ?? '').trim();
    if (s.length < 2 || s.length > 600) return false;
    if (!/\p{L}{2,}/u.test(s)) return false;
    if (/^(https?:\/\/|www\.|\/api\/|[\w.-]+@[\w.-]+$)/i.test(s)) return false;
    if (/^[\w.-]+\.(js|ts|tsx|json|mjs|md|png|jpg|mp4|gguf|zip)$/i.test(s)) return false;
    if (/^[0-9a-f]{7,40}\b/.test(s) || /^[\w.-]+\/[\w./-]+$/.test(s)) return false;   // hash commita, gałąź/ścieżka
    if (/^[A-Z0-9_]{2,}$/.test(s) && !/[a-ząćęłńóśźż]/.test(s)) return s.length > 3 && /[AEIOUY]/.test(s);
    return true;
}

const HOST_MASZYNY = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
/**
 * Czy wiadomość o języku przyszła od Huba Katedry: strona z tej maszyny (localhost/127.0.0.1/[::1], dowolny port)
 * albo z originu mostu, z którego apka wzięła tłumacza (np. tunel). Obca strona nie przestawi języka apki.
 */
export function czyOriginKatedry(origin, mostOrigin) {
    let u;
    try { u = new URL(String(origin)); } catch { return false; }
    if (!/^https?:$/.test(u.protocol)) return false;
    if (HOST_MASZYNY.test(u.host)) return true;
    return !!mostOrigin && u.origin === mostOrigin;
}

/** Poprawny kod języka (jak w moście: en, de, pt-BR). */
export const kodJezyka = (j) => (typeof j === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(j.trim()) ? j.trim() : null);

/**
 * Tłumacz jednego dokumentu.
 * @param {{ most: string, dokument?: Document, pamiec?: Storage | null, pobierz?: typeof fetch }} o
 */
export function utworzTlumacza({ most, dokument = globalThis.document, pamiec = globalThis.localStorage ?? null, pobierz = (...a) => globalThis.fetch(...a) }) {
    const MOST = String(most).replace(/\/+$/, '');
    let jezyk = 'pl';
    let slownik = new Map();
    let obserwator = null;
    const oryginal = new WeakMap();
    const wpisane = new WeakMap();
    const zmianyWezla = new WeakMap();
    const oryginalAtr = new WeakMap();
    const wpisaneAtr = new WeakMap();
    const dotkniete = new Set();
    const znane = new WeakSet();   // każdy węzeł w `dotkniete` RAZ — dopisywanie w trakcie przeglądu zbioru zapętlało kartę
    const dotknij = (n) => { if (!znane.has(n)) { znane.add(n); dotkniete.add(new WeakRef(n)); } };
    const brakujace = new Set();
    const wDrodze = new Set();
    const nieudane = new Set();
    let stan = { jezyk: 'pl', czeka: 0, tlumaczy: false, blad: null };
    const sluchacze = new Set();
    const oglos = (z) => {
        // Tylko PRAWDZIWA zmiana — inaczej: ogłoszenie → przerysowanie przełącznika → mutacja DOM → ogłoszenie… (zamarznięta karta).
        const nowy = { ...stan, ...z };
        if (Object.keys(nowy).every((k) => nowy[k] === stan[k])) return;
        stan = nowy;
        sluchacze.forEach((f) => f(stan));
    };

    function pominiety(el) {
        for (let e = el; e; e = e.parentElement) {
            if (POMIN_TAGI.has(e.tagName)) return true;
            if (e.getAttribute('translate') === 'no' || e.classList?.contains('notranslate') || e.hasAttribute('data-bez-tlumaczenia')) return true;
            if (e.isContentEditable) return true;
        }
        return false;
    }

    /** Podmień tekst, zachowując spacje wokół (tłumaczymy treść, nie białe znaki). */
    const wstaw = (oryg, klucz, tl) => oryg.replace(klucz, tl);

    function tekst(node) {
        const teraz = node.nodeValue ?? '';
        let oryg = oryginal.get(node);
        if (oryg === undefined || teraz !== wpisane.get(node)) {
            // Nowy tekst od Reacta (albo pierwszy raz) — to jest teraz polski oryginał.
            if (oryg !== undefined && teraz !== oryg) {
                const z = zmianyWezla.get(node) ?? { n: 0, od: Date.now() };
                if (Date.now() - z.od > 60_000) { z.n = 0; z.od = Date.now(); }
                z.n++;
                zmianyWezla.set(node, z);
            }
            oryg = teraz;
            oryginal.set(node, oryg);
            wpisane.set(node, teraz);
        }
        if ((zmianyWezla.get(node)?.n ?? 0) > 5) return;   // licznik/zegar — zostaje jak jest
        const klucz = oryg.trim();
        if (!doTlumaczenia(klucz) || pominiety(node.parentElement)) return;
        dotknij(node);
        const docelowy = jezyk === 'pl' ? oryg : (slownik.has(klucz) ? wstaw(oryg, klucz, slownik.get(klucz)) : null);
        if (docelowy === null) { if (!nieudane.has(klucz)) brakujace.add(klucz); return; }
        if (teraz !== docelowy) { wpisane.set(node, docelowy); node.nodeValue = docelowy; }
    }

    function atrybuty(el) {
        if (pominiety(el) && !['INPUT', 'TEXTAREA'].includes(el.tagName)) return;   // placeholder pól do pisania tłumaczymy
        const org = oryginalAtr.get(el) ?? {};
        const wp = wpisaneAtr.get(el) ?? {};
        for (const a of ATRYBUTY) {
            const teraz = el.getAttribute(a);
            if (teraz == null) continue;
            if (org[a] === undefined || teraz !== wp[a]) { org[a] = teraz; wp[a] = teraz; }
            const klucz = org[a].trim();
            if (!doTlumaczenia(klucz)) continue;
            dotknij(el);
            const docelowy = jezyk === 'pl' ? org[a] : (slownik.has(klucz) ? wstaw(org[a], klucz, slownik.get(klucz)) : null);
            if (docelowy === null) { if (!nieudane.has(klucz)) brakujace.add(klucz); continue; }
            if (teraz !== docelowy) { wp[a] = docelowy; el.setAttribute(a, docelowy); }
        }
        oryginalAtr.set(el, org);
        wpisaneAtr.set(el, wp);
    }

    function skanuj(korzen) {
        if (korzen.nodeType === TEKST) { tekst(korzen); return; }
        if (![ELEMENT, DOKUMENT, FRAGMENT].includes(korzen.nodeType)) return;
        const w = dokument.createTreeWalker(korzen, POKAZ_TEKST);
        for (let n = w.nextNode(); n; n = w.nextNode()) tekst(n);
        if (korzen.nodeType === ELEMENT) atrybuty(korzen);
        korzen.querySelectorAll?.(ATRYBUTY.map((a) => `[${a}]`).join(',')).forEach(atrybuty);
        planujPobranie();
    }

    let zegar = null;
    function planujPobranie() {
        oglos({ czeka: brakujace.size });
        if (jezyk === 'pl' || !brakujace.size || zegar) return;
        zegar = setTimeout(() => { zegar = null; void pobierzBrakujace(); }, 400);
    }

    let pobiera = false;
    async function pobierzBrakujace() {
        if (pobiera || jezyk === 'pl') return;
        pobiera = true;
        const dlaJezyka = jezyk;
        try {
            while (brakujace.size && jezyk === dlaJezyka) {
                const paczka = [...brakujace].filter((t) => !wDrodze.has(t)).slice(0, 30);
                if (!paczka.length) break;
                paczka.forEach((t) => { brakujace.delete(t); wDrodze.add(t); });
                oglos({ tlumaczy: true, czeka: brakujace.size + wDrodze.size });
                try {
                    const r = await pobierz(`${MOST}/api/tlumacz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jezyk: dlaJezyka, teksty: paczka }) });
                    const d = await r.json();
                    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
                    if (jezyk !== dlaJezyka) break;
                    for (const [k, v] of Object.entries(d.mapa ?? {})) slownik.set(k, v);
                    (d.pominiete ?? []).forEach((t) => nieudane.add(t));   // model ich nie oddał — zostają po polsku
                    zapamietaj();
                    oglos({ blad: d.blad ?? null });
                    odswiez();
                } catch (e) {
                    paczka.forEach((t) => nieudane.add(t));   // bez mostu/modelu nie mielimy w kółko — polski zostaje
                    oglos({ blad: `Tłumaczenie nie doszło: ${e.message}` });
                } finally { paczka.forEach((t) => wDrodze.delete(t)); }
            }
        } finally { pobiera = false; oglos({ tlumaczy: false, czeka: brakujace.size }); }
    }

    function zapamietaj() {
        try { pamiec?.setItem(KLUCZ_PAMIECI(jezyk), JSON.stringify(Object.fromEntries(slownik))); } catch { /* pełny localStorage — most i tak pamięta */ }
    }

    /** Ponownie przejdź po tym, co już tłumaczyliśmy, i po całym ekranie (po dojściu nowych tłumaczeń / zmianie języka). */
    function odswiez() {
        for (const ref of dotkniete) {
            const n = ref.deref();
            if (!n || !n.isConnected) { dotkniete.delete(ref); if (n) znane.delete(n); continue; }
            if (n.nodeType === TEKST) tekst(n); else atrybuty(n);
        }
        if (dokument.body) skanuj(dokument.body);
    }

    /** Włącz tłumaczenie na język (`pl` = oryginał). */
    async function ustawJezyk(j) {
        const nowy = (j || 'pl').trim();
        if (nowy === jezyk && (obserwator || nowy === 'pl')) return;
        jezyk = nowy;
        brakujace.clear(); nieudane.clear();
        dokument.documentElement.lang = nowy;
        slownik = new Map();
        oglos({ jezyk: nowy, blad: null, czeka: 0 });
        if (nowy !== 'pl') {
            try { slownik = new Map(Object.entries(JSON.parse(pamiec?.getItem(KLUCZ_PAMIECI(nowy)) || '{}'))); } catch { /* pusto */ }
        }
        if (!obserwator && typeof MutationObserver !== 'undefined' && dokument.body) {
            obserwator = new MutationObserver((zmiany) => {
                for (const z of zmiany) {
                    if (z.type === 'characterData') tekst(z.target);
                    else if (z.type === 'attributes') atrybuty(z.target);
                    else z.addedNodes.forEach((n) => skanuj(n));
                }
                planujPobranie();
            });
            obserwator.observe(dokument.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRYBUTY] });
        }
        odswiez();
        if (nowy !== 'pl') {
            // Słownik z dysku węzła (ten sam dla Hubu, apek w Pierścieniu, telefonu przez tunel i kolejnych przeglądarek).
            try {
                const d = await (await pobierz(`${MOST}/api/tlumacz/${encodeURIComponent(nowy)}`)).json();
                if (jezyk === nowy && d?.slownik) { for (const [k, v] of Object.entries(d.slownik)) slownik.set(k, v); zapamietaj(); odswiez(); }
            } catch { /* most offline — działa to, co w przeglądarce */ }
        }
    }

    return {
        ustawJezyk,
        obserwujStan(f) { sluchacze.add(f); f(stan); return () => { sluchacze.delete(f); }; },
        stan: () => stan,
    };
}
