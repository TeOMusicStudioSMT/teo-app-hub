/**
 * 🌍 tlumaczDom — Katedra w dowolnym języku bez przepisywania ekranów.
 *
 * Katedra jest pisana po polsku (źródło prawdy). Po wyborze innego języka ten moduł zbiera teksty z ekranu
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

const MOST = 'http://127.0.0.1:3001';
const ATRYBUTY = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const POMIN_TAGI = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'KBD', 'SAMP', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME']);
const KLUCZ_PAMIECI = (j: string) => `otakos_tl_${j}`;

export interface StanTlumacza { jezyk: string; czeka: number; tlumaczy: boolean; blad: string | null }

let jezyk = 'pl';
let slownik = new Map<string, string>();
let obserwator: MutationObserver | null = null;
const oryginal = new WeakMap<Text, string>();
const wpisane = new WeakMap<Text, string>();
const zmianyWezla = new WeakMap<Text, { n: number; od: number }>();
const oryginalAtr = new WeakMap<Element, Record<string, string>>();
const wpisaneAtr = new WeakMap<Element, Record<string, string>>();
const dotkniete = new Set<WeakRef<Node>>();
const znane = new WeakSet<Node>();   // każdy węzeł w `dotkniete` RAZ — dopisywanie w trakcie przeglądu zbioru zapętlało kartę
const dotknij = (n: Node) => { if (!znane.has(n)) { znane.add(n); dotkniete.add(new WeakRef(n)); } };
const brakujace = new Set<string>();
const wDrodze = new Set<string>();
const nieudane = new Set<string>();
let stan: StanTlumacza = { jezyk: 'pl', czeka: 0, tlumaczy: false, blad: null };
const sluchacze = new Set<(s: StanTlumacza) => void>();
const ogloś = (z: Partial<StanTlumacza>) => {
    // Tylko PRAWDZIWA zmiana — inaczej: ogłoszenie → przerysowanie przełącznika → mutacja DOM → ogłoszenie… (zamarznięta karta).
    const nowy = { ...stan, ...z };
    if ((Object.keys(nowy) as (keyof StanTlumacza)[]).every((k) => nowy[k] === stan[k])) return;
    stan = nowy;
    sluchacze.forEach((f) => f(stan));
};

/** Ten sam filtr co w moście: słowa tak, liczby/adresy/pliki nie. */
export function doTlumaczenia(t: string): boolean {
    const s = t.trim();
    if (s.length < 2 || s.length > 600) return false;
    if (!/\p{L}{2,}/u.test(s)) return false;
    if (/^(https?:\/\/|www\.|\/api\/|[\w.-]+@[\w.-]+$)/i.test(s)) return false;
    if (/^[\w.-]+\.(js|ts|tsx|json|mjs|md|png|jpg|mp4|gguf|zip)$/i.test(s)) return false;
    if (/^[0-9a-f]{7,40}\b/.test(s) || /^[\w.-]+\/[\w./-]+$/.test(s)) return false;   // hash commita, gałąź/ścieżka
    if (/^[A-Z0-9_]{2,}$/.test(s) && !/[a-ząćęłńóśźż]/.test(s)) return s.length > 3 && /[AEIOUY]/.test(s);
    return true;
}

function pominiety(el: Element | null): boolean {
    for (let e = el; e; e = e.parentElement) {
        if (POMIN_TAGI.has(e.tagName)) return true;
        if (e.getAttribute('translate') === 'no' || e.classList.contains('notranslate') || e.hasAttribute('data-bez-tlumaczenia')) return true;
        if ((e as HTMLElement).isContentEditable) return true;
    }
    return false;
}

/** Podmień tekst, zachowując spacje wokół (tłumaczymy treść, nie białe znaki). */
const wstaw = (oryg: string, klucz: string, tl: string) => oryg.replace(klucz, tl);

function tekst(node: Text) {
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
    const docelowy = jezyk === 'pl' ? oryg : (slownik.has(klucz) ? wstaw(oryg, klucz, slownik.get(klucz)!) : null);
    if (docelowy === null) { if (!nieudane.has(klucz)) brakujace.add(klucz); return; }
    if (teraz !== docelowy) { wpisane.set(node, docelowy); node.nodeValue = docelowy; }
}

function atrybuty(el: Element) {
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
        const docelowy = jezyk === 'pl' ? org[a] : (slownik.has(klucz) ? wstaw(org[a], klucz, slownik.get(klucz)!) : null);
        if (docelowy === null) { if (!nieudane.has(klucz)) brakujace.add(klucz); continue; }
        if (teraz !== docelowy) { wp[a] = docelowy; el.setAttribute(a, docelowy); }
    }
    oryginalAtr.set(el, org);
    wpisaneAtr.set(el, wp);
}

function skanuj(korzen: Node) {
    if (korzen.nodeType === Node.TEXT_NODE) { tekst(korzen as Text); return; }
    if (!(korzen instanceof Element || korzen instanceof Document || korzen instanceof DocumentFragment)) return;
    const w = document.createTreeWalker(korzen, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) tekst(n as Text);
    const el = korzen as ParentNode;
    if (korzen instanceof Element) atrybuty(korzen);
    el.querySelectorAll?.(ATRYBUTY.map((a) => `[${a}]`).join(',')).forEach(atrybuty);
    planujPobranie();
}

let zegar: ReturnType<typeof setTimeout> | null = null;
function planujPobranie() {
    ogloś({ czeka: brakujace.size });
    if (jezyk === 'pl' || !brakujace.size || zegar) return;
    zegar = setTimeout(() => { zegar = null; void pobierz(); }, 400);
}

let pobiera = false;
async function pobierz() {
    if (pobiera || jezyk === 'pl') return;
    pobiera = true;
    const dlaJezyka = jezyk;
    try {
        while (brakujace.size && jezyk === dlaJezyka) {
            const paczka = [...brakujace].filter((t) => !wDrodze.has(t)).slice(0, 30);
            if (!paczka.length) break;
            paczka.forEach((t) => { brakujace.delete(t); wDrodze.add(t); });
            ogloś({ tlumaczy: true, czeka: brakujace.size + wDrodze.size });
            try {
                const r = await fetch(`${MOST}/api/tlumacz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jezyk: dlaJezyka, teksty: paczka }) });
                const d = await r.json();
                if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
                if (jezyk !== dlaJezyka) break;
                for (const [k, v] of Object.entries(d.mapa as Record<string, string>)) slownik.set(k, v);
                (d.pominiete as string[] ?? []).forEach((t) => nieudane.add(t));   // model ich nie oddał — zostają po polsku
                zapamietaj();
                ogloś({ blad: d.blad ?? null });
                odswiez();
            } catch (e: any) {
                paczka.forEach((t) => nieudane.add(t));   // bez mostu/modelu nie mielimy w kółko — polski zostaje
                ogloś({ blad: `Tłumaczenie nie doszło: ${e.message}` });
            } finally { paczka.forEach((t) => wDrodze.delete(t)); }
        }
    } finally { pobiera = false; ogloś({ tlumaczy: false, czeka: brakujace.size }); }
}

function zapamietaj() {
    try { localStorage.setItem(KLUCZ_PAMIECI(jezyk), JSON.stringify(Object.fromEntries(slownik))); } catch { /* pełny localStorage — most i tak pamięta */ }
}

/** Ponownie przejdź po tym, co już tłumaczyliśmy, i po całym ekranie (po dojściu nowych tłumaczeń / zmianie języka). */
function odswiez() {
    for (const ref of dotkniete) {
        const n = ref.deref();
        if (!n || !n.isConnected) { dotkniete.delete(ref); if (n) znane.delete(n); continue; }
        if (n.nodeType === Node.TEXT_NODE) tekst(n as Text); else atrybuty(n as Element);
    }
    if (document.body) skanuj(document.body);
}

/** Włącz tłumaczenie na język (`pl` = oryginał). Wołane przez I18nProvider przy starcie i zmianie języka. */
export async function ustawJezyk(j: string) {
    const nowy = (j || 'pl').trim();
    if (nowy === jezyk && (obserwator || nowy === 'pl')) return;
    jezyk = nowy;
    brakujace.clear(); nieudane.clear();
    document.documentElement.lang = nowy;
    slownik = new Map();
    ogloś({ jezyk: nowy, blad: null, czeka: 0 });
    if (nowy !== 'pl') {
        try { slownik = new Map(Object.entries(JSON.parse(localStorage.getItem(KLUCZ_PAMIECI(nowy)) || '{}'))); } catch { /* pusto */ }
    }
    if (!obserwator && typeof MutationObserver !== 'undefined') {
        obserwator = new MutationObserver((zmiany) => {
            for (const z of zmiany) {
                if (z.type === 'characterData') tekst(z.target as Text);
                else if (z.type === 'attributes') atrybuty(z.target as Element);
                else z.addedNodes.forEach((n) => skanuj(n));
            }
            planujPobranie();
        });
        obserwator.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRYBUTY] });
    }
    odswiez();
    if (nowy !== 'pl') {
        // Słownik z dysku węzła (ten sam dla Hubu, telefonu przez tunel i kolejnych przeglądarek).
        try {
            const d = await (await fetch(`${MOST}/api/tlumacz/${encodeURIComponent(nowy)}`)).json();
            if (jezyk === nowy && d?.slownik) { for (const [k, v] of Object.entries(d.slownik as Record<string, string>)) slownik.set(k, v); zapamietaj(); odswiez(); }
        } catch { /* most offline — działa to, co w przeglądarce */ }
    }
}

export function obserwujStan(f: (s: StanTlumacza) => void): () => void { sluchacze.add(f); f(stan); return () => { sluchacze.delete(f); }; }
export const stanTlumacza = () => stan;
