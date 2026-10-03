/**
 * 🧭 Ścieżki od człowieka (2026-10-03) — Suweren: „jak zrobisz Ctrl+Shift+C, to kopiuje z "" … i tego potem
 * Katedra nie widzi, trzeba ręcznie usunąć”.
 *
 * Windows „Kopiuj jako ścieżkę” daje `"F:\5 stars\…\kadr.png"`, przeglądarki i część programów —
 * `file:///F:/5%20stars/…/kadr.png`. Jedno i drugie to ta sama ścieżka. Most czyści każde pole tekstowe
 * żądania, zanim dotknie go trasa — każda linia osobno (pola „jedna ścieżka na wiersz”).
 *
 * Granice (żeby nie psuć zwykłego tekstu): cudzysłowy zdejmujemy TYLKO, gdy cała linia to ścieżka
 * w cudzysłowie (`"C:\…"`, `"\\serwer\…"`, `"/home/…"`); `file://` tylko na początku linii; pomijamy
 * bardzo długie napisy (dataURL obrazów, base64) i nie schodzimy głębiej niż kilka poziomów.
 */
const SCIEZKA = /^(?:[A-Za-z]:[\\/]|\\\\[^\\]|\/[^/])/;
const MAX_DLUGOSC = 100_000;

/** Jedna linia: `"C:\x y"` → `C:\x y`, `file:///F:/a%20b` → `F:/a b`, `file:///home/x` → `/home/x`. */
export function oczyscSciezke(linia) {
    if (typeof linia !== 'string') return linia;
    let t = linia.trim();
    const cudzyslowy = t.match(/^(["'„”“])(.*)(["'”“])$/s);
    if (cudzyslowy && SCIEZKA.test(cudzyslowy[2].trim())) t = cudzyslowy[2].trim();
    if (/^file:\/\//i.test(t)) {
        let reszta = t.replace(/^file:\/\/(localhost)?/i, '');
        try { reszta = decodeURIComponent(reszta); } catch { /* zostaw, jak było */ }
        // file:///F:/… → F:/… ; file:///home/… → /home/…
        if (/^\/[A-Za-z]:[\\/]/.test(reszta)) reszta = reszta.slice(1);
        if (SCIEZKA.test(reszta)) t = reszta;
    }
    return t === linia.trim() ? linia : t;
}

/** Napis wielolinijkowy — każda linia osobno (pola „jedna ścieżka na wiersz”). */
function oczyscNapis(s) {
    if (s.length > MAX_DLUGOSC || s.startsWith('data:')) return s;
    if (!/["'„”“]|file:\/\//i.test(s)) return s;   // szybka ścieżka: nie ma czego czyścić
    if (!s.includes('\n')) return oczyscSciezke(s);
    return s.split('\n').map((l) => { const c = oczyscSciezke(l.replace(/\r$/, '')); return c === l.replace(/\r$/, '') ? l : c; }).join('\n');
}

/** Wartość z JSON-a (body/query): napisy czyszczone, tablice i obiekty rekurencyjnie (do `glebokosc`). */
export function oczyscWartosc(v, glebokosc = 5) {
    if (typeof v === 'string') return oczyscNapis(v);
    if (glebokosc <= 0 || v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => oczyscWartosc(x, glebokosc - 1));
    if (Buffer.isBuffer?.(v)) return v;
    for (const k of Object.keys(v)) v[k] = oczyscWartosc(v[k], glebokosc - 1);
    return v;
}

/** Middleware Expressa: po parserach ciała, przed trasami. */
export function czyscSciezkiMiddleware(req, _res, next) {
    try {
        if (req.body && typeof req.body === 'object') req.body = oczyscWartosc(req.body);
        // Express 5: `req.query` to getter liczony przy każdym odczycie — podstawiamy własną, oczyszczoną kopię.
        const q = req.query;
        if (q && typeof q === 'object' && Object.values(q).some((x) => typeof x === 'string' && /["'„”“]|file:\/\//i.test(x))) {
            Object.defineProperty(req, 'query', { value: oczyscWartosc({ ...q }), writable: true, enumerable: true, configurable: true });
        }
    } catch { /* czyszczenie nigdy nie wywraca żądania */ }
    next();
}

export default { oczyscSciezke, oczyscWartosc, czyscSciezkiMiddleware };
